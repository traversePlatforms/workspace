<?php
/**
 * Shared by api.php and manage.php (2026-10-13). Not a page: opened directly it answers 404.
 *
 * Settings: ../traverse-site-private/site-config.php (outside public_html) returns an array that overrides DEFAULTS below.
 * That file holds the Gmail app password for sending (smtp.pass) and the manage-page key; nothing secret is in this file.
 * Mail goes through Gmail logged in as the mailbox (the Sixfold lesson, 2026-09-28: SiteGround's own mail() is refused by
 * Google as spam for a domain whose mail lives at Google).
 */
declare(strict_types=1);
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const SITE_DEFAULTS = [
    'timezone' => 'America/Denver',
    'timezone_label' => 'Mountain Time',
    'slot_minutes' => 30,
    /* weekday (1 = Monday .. 7 = Sunday) => list of [start, end] windows, local time; a demo must END by the window's end */
    'hours' => [1 => [['09:00', '17:00']], 2 => [['09:00', '17:00']], 3 => [['09:00', '17:00']], 4 => [['09:00', '17:00']], 5 => [['09:00', '17:00']]],
    'min_notice_hours' => 18,          /* no booking sooner than this */
    'max_days' => 45,                  /* how far ahead */
    'blocked_dates' => [],             /* 'YYYY-MM-DD' days off (the manage page adds to the file's own list) */
    'notify_to' => 'm.sharpe@traverseplatforms.com',
    'organizer_name' => 'Matthew Sharpe, Traverse Platforms',
    'phone' => '(303) 596-9515',
    'smtp' => ['host' => 'smtp.gmail.com', 'port' => 587, 'user' => 'm.sharpe@traverseplatforms.com', 'pass' => '', 'from_name' => 'Traverse Platforms', 'timeout' => 15, 'ehlo' => 'traverseplatforms.com'],
    'manage_key' => '',
];

function site_config(): array {
    static $c = null; if ($c !== null) return $c;
    $dir = dirname(__DIR__, 2) . '/traverse-site-private';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $own = is_file($dir . '/site-config.php') ? (include $dir . '/site-config.php') : [];
    $c = array_replace_recursive(SITE_DEFAULTS, is_array($own) ? $own : []);
    if (isset($own['hours'])) $c['hours'] = $own['hours'];                       /* a whole new week, not merged day by day */
    $extra = json_decode((string) @file_get_contents($dir . '/blocked.json'), true);
    $c['blocked_dates'] = array_values(array_unique(array_merge((array) $c['blocked_dates'], is_array($extra) ? $extra : [])));
    $c['smtp']['pass'] = preg_replace('/\s+/', '', (string) $c['smtp']['pass']);   /* Google shows app passwords in groups of four */
    $c['dir'] = $dir;
    return $c;
}

function out(array $a): never { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400): never { http_response_code($code); out(['ok' => false, 'error' => $m]); }
function client_ip(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? ''); }
function append_line(string $f, array $row): void { @file_put_contents($f, json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }

function clean_fields(array $in, array $max): array {
    $o = [];
    foreach ($max as $k => $n) {
        $v = (string) ($in[$k] ?? '');
        $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
        $v = trim(preg_replace('/[ \t]+/', ' ', $v));
        $o[$k] = mb_substr($v, 0, $n);
    }
    return $o;
}

function rate_limit(int $perHour, string $bucket = ''): void {
    $c = site_config(); $f = $c['dir'] . '/rate.json'; $ip = hash('sha256', $bucket . '|' . client_ip()); $now = time();
    $fp = @fopen($f, 'c+'); if (!$fp) return;
    flock($fp, LOCK_EX);
    $j = json_decode((string) stream_get_contents($fp), true); if (!is_array($j)) $j = [];
    foreach ($j as $k => $ts) { $j[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$j[$k]) unset($j[$k]); }
    $mine = $j[$ip] ?? [];
    if (count($mine) >= $perHour) { flock($fp, LOCK_UN); fclose($fp); fail('Too many tries from here. Please wait a while, or email hello@traverseplatforms.com.', 429); }
    $mine[] = $now; $j[$ip] = $mine;
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($j)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
}

/** run $fn on the bookings list under an exclusive lock, and save it after */
function with_bookings(callable $fn): array {
    $c = site_config(); $f = $c['dir'] . '/bookings.json';
    $fp = fopen($f, 'c+'); if (!$fp) fail('The booking could not be saved. Please email hello@traverseplatforms.com.', 500);
    flock($fp, LOCK_EX);
    $all = json_decode((string) stream_get_contents($fp), true); if (!is_array($all)) $all = [];
    $res = $fn($all);
    ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); fflush($fp);
    flock($fp, LOCK_UN); fclose($fp);
    return $res;
}
function read_bookings(): array { $j = json_decode((string) @file_get_contents(site_config()['dir'] . '/bookings.json'), true); return is_array($j) ? $j : []; }

/** every open start time for each day from $start, as [{date, times: ['09:00', ...]}] */
function open_slots(array $c, DateTimeImmutable $start, int $days): array {
    $tz = new DateTimeZone($c['timezone']); $now = new DateTimeImmutable('now', $tz);
    $earliest = $now->modify('+' . (int) $c['min_notice_hours'] . ' hours');
    $last = $now->setTime(0, 0)->modify('+' . (int) $c['max_days'] . ' days');
    $taken = [];
    foreach (read_bookings() as $b) if (($b['status'] ?? '') === 'booked') $taken[$b['date'] . ' ' . $b['time']] = true;
    $out = [];
    for ($i = 0; $i < $days; $i++) {
        $d = $start->setTime(0, 0)->modify('+' . $i . ' days');
        if ($d > $last) break;
        $ds = $d->format('Y-m-d'); $times = [];
        if (!in_array($ds, $c['blocked_dates'], true)) {
            foreach (($c['hours'][(int) $d->format('N')] ?? []) as $w) {
                [$h1, $m1] = array_map('intval', explode(':', $w[0])); [$h2, $m2] = array_map('intval', explode(':', $w[1]));
                $t = $d->setTime($h1, $m1); $end = $d->setTime($h2, $m2);
                while ($t->modify('+' . (int) $c['slot_minutes'] . ' minutes') <= $end) {
                    if ($t >= $earliest && empty($taken[$ds . ' ' . $t->format('H:i')])) $times[] = $t->format('H:i');
                    $t = $t->modify('+' . (int) $c['slot_minutes'] . ' minutes');
                }
            }
        }
        $out[] = ['date' => $ds, 'times' => $times];
    }
    return $out;
}
function slot_is_open(array $c, string $date, string $time, array $all): bool {
    foreach ($all as $b) if (($b['status'] ?? '') === 'booked' && $b['date'] === $date && $b['time'] === $time) return false;
    $tz = new DateTimeZone($c['timezone']);
    foreach (open_slots($c, new DateTimeImmutable($date, $tz), 1) as $d) return in_array($time, $d['times'], true);
    return false;
}

function when_text(array $c, array $b): string {
    $tz = new DateTimeZone($c['timezone']); $t = new DateTimeImmutable($b['date'] . ' ' . $b['time'], $tz);
    return $t->format('l, F j') . ' at ' . $t->format('g:i a') . ' ' . $c['timezone_label'];
}

/* ---- email ---- */
function ics(array $c, array $b, string $method): string {
    $tz = new DateTimeZone($c['timezone']); $utc = new DateTimeZone('UTC');
    $s = (new DateTimeImmutable($b['date'] . ' ' . $b['time'], $tz))->setTimezone($utc);
    $e = $s->modify('+' . (int) $b['minutes'] . ' minutes');
    $esc = fn($v) => str_replace(["\\", ';', ',', "\n"], ["\\\\", '\;', '\,', '\n'], (string) $v);
    $L = ['BEGIN:VCALENDAR', 'PRODID:-//Traverse Platforms//Demo booking//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:' . $method, 'BEGIN:VEVENT',
          'UID:' . $b['id'] . '@traverseplatforms.com', 'DTSTAMP:' . gmdate('Ymd\THis\Z'), 'DTSTART:' . $s->format('Ymd\THis\Z'), 'DTEND:' . $e->format('Ymd\THis\Z'),
          'SUMMARY:' . $esc('Traverse demo: ' . $b['company']),
          'DESCRIPTION:' . $esc(($b['meet'] === 'phone' ? 'Phone call. We call ' . $b['phone'] : 'Video call. The link comes by email before the demo') . '.'),
          'ORGANIZER;CN=' . $esc($c['organizer_name']) . ':mailto:' . $c['smtp']['user'],
          'ATTENDEE;CN=' . $esc($b['name']) . ';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:' . $b['email'],
          'STATUS:' . ($method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'), 'SEQUENCE:' . ($method === 'CANCEL' ? '1' : '0'), 'END:VEVENT', 'END:VCALENDAR'];
    return implode("\r\n", $L) . "\r\n";
}

function notify_booking(array $c, array $b): bool {
    $when = when_text($c, $b);
    $how = $b['meet'] === 'phone' ? 'Phone call to ' . $b['phone'] : 'Video call (send the link)';
    $mine = "New demo booked.\n\nWhen: $when (" . (int) $b['minutes'] . " minutes)\nHow: $how\n\nName: {$b['name']}\nCompany: {$b['company']}\nTrade: {$b['trade']}\n"
          . "Team size: {$b['team']}\nTowns or areas: {$b['towns']}\nEmail: {$b['email']}\nPhone: {$b['phone']}\n\nNotes:\n" . ($b['notes'] !== '' ? $b['notes'] : '(none)') . "\n\n"
          . "Reply to this email to write to them. The invite is attached for your calendar.";
    $r1 = send_mail($c, $c['notify_to'], 'Demo booked: ' . $b['company'] . ' · ' . $when, $mine, ['Reply-To: ' . $b['email']], ics($c, $b, 'PUBLISH'));
    log_mail($c, 'book-notify ' . $b['id'], $r1);
    $cancel = 'https://traverseplatforms.com/demo/api.php?action=cancel&id=' . rawurlencode($b['id']) . '&k=' . $b['key'];
    $theirs = "Hi {$b['name']},\n\nYour Traverse demo is booked for $when.\n\n"
            . ($b['meet'] === 'phone' ? "We'll call you at {$b['phone']}." : "We'll email you a video call link before the demo.") . "\n\n"
            . "We'll show you a full day in your trade's edition: at the door, on the phone and in the office. If there's a town or area you'd like to see, reply and tell us.\n\n"
            . "Need a different time? Cancel here and book again: $cancel\n\nThanks,\n" . $c['organizer_name'] . "\n" . $c['phone'] . "\nhello@traverseplatforms.com";
    $r2 = send_mail($c, $b['email'], 'Your Traverse demo · ' . $when, $theirs, ['Reply-To: ' . $c['notify_to']], ics($c, $b, 'REQUEST'));
    log_mail($c, 'book-confirm ' . $b['id'], $r2);
    return $r1['ok'];
}
function notify_cancel(array $c, array $b): void {
    $when = when_text($c, $b);
    $r = send_mail($c, $c['notify_to'], 'Demo cancelled: ' . $b['company'] . ' · ' . $when, "{$b['name']} ({$b['company']}) cancelled the demo on $when.\nEmail: {$b['email']}\nPhone: {$b['phone']}", ['Reply-To: ' . $b['email']], ics($c, $b, 'CANCEL'));
    log_mail($c, 'cancel ' . $b['id'], $r);
}
function log_mail(array $c, string $what, array $r): void { append_line($c['dir'] . '/mail.log', ['at' => time(), 'what' => $what, 'ok' => $r['ok'], 'stage' => $r['stage'], 'error' => $r['error']]); }

function mime_h(string $s): string { return preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }

/** one message through Gmail, logged in as the mailbox; a calendar invite rides along when $ics is given. Never throws. */
function send_mail(array $c, string $to, string $subject, string $body, array $extra = [], ?string $ics = null): array {
    $s = $c['smtp']; $fail = fn($st, $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    if ($s['pass'] === '') return $fail('config', 'no Gmail app password in traverse-site-private/site-config.php yet');
    $fp = @stream_socket_client('tcp://' . $s['host'] . ':' . (int) $s['port'], $errno, $errstr, (int) $s['timeout']);
    if (!$fp) return $fail('connect', trim($errno . ' ' . $errstr));
    stream_set_timeout($fp, (int) $s['timeout']);
    $read = function () use ($fp): array { $lines = []; while (true) { $l = @fgets($fp, 2048); if ($l === false) return [0, 'connection closed']; $lines[] = rtrim($l, "\r\n"); if (strlen($l) < 4 || $l[3] !== '-') break; } $last = (string) end($lines); return [(int) substr($last, 0, 3), implode(' | ', $lines)]; };
    $w = function (string $cmd) use ($fp) { @fwrite($fp, $cmd . "\r\n"); };
    $quit = function () use ($fp) { @fwrite($fp, "QUIT\r\n"); @fclose($fp); };
    [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('greeting', $rep); }
    $w('EHLO ' . $s['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo', $rep); }
    $w('STARTTLS'); [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('starttls', $rep); }
    $cm = STREAM_CRYPTO_METHOD_TLS_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
    if (@stream_socket_enable_crypto($fp, true, $cm) !== true) { $quit(); return $fail('starttls', 'TLS negotiation failed'); }
    $w('EHLO ' . $s['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo-tls', $rep); }
    $w('AUTH LOGIN'); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode($s['user'])); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode($s['pass'])); [$code, $rep] = $read(); if ($code !== 235) { $quit(); return $fail('auth', $rep); }
    $w('MAIL FROM:<' . $s['user'] . '>'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('from', $rep); }
    $w('RCPT TO:<' . $to . '>'); [$code, $rep] = $read(); if ($code !== 250 && $code !== 251) { $quit(); return $fail('to', $rep); }
    $w('DATA'); [$code, $rep] = $read(); if ($code !== 354) { $quit(); return $fail('data', $rep); }
    $eol = "\r\n"; $dom = 'traverseplatforms.com';
    $h = ['Date: ' . date('r'), 'From: ' . mime_h($s['from_name']) . ' <' . $s['user'] . '>', 'To: ' . $to, 'Subject: ' . mime_h($subject),
          'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $dom . '>', 'MIME-Version: 1.0'];
    foreach ($extra as $x) { $x = trim(preg_replace('/[\r\n]+/', ' ', (string) $x)); if ($x !== '') $h[] = $x; }
    $text = 'Content-Type: text/plain; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($body), 76, $eol);
    if ($ics === null) { $payload = implode($eol, $h) . $eol . $text; }
    else {
        preg_match('/^METHOD:(\w+)/m', $ics, $mm); $method = $mm[1] ?? 'PUBLISH'; $bd = 'tv' . bin2hex(random_bytes(8));
        $h[] = 'Content-Type: multipart/mixed; boundary="' . $bd . '"';
        $payload = implode($eol, $h) . $eol . $eol . '--' . $bd . $eol . $text
                 . '--' . $bd . $eol . 'Content-Type: text/calendar; charset=UTF-8; method=' . $method . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($ics), 76, $eol)
                 . '--' . $bd . $eol . 'Content-Type: application/ics; name="invite.ics"' . $eol . 'Content-Disposition: attachment; filename="invite.ics"' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($ics), 76, $eol)
                 . '--' . $bd . '--' . $eol;
    }
    $payload = preg_replace('/^\./m', '..', $payload);
    @fwrite($fp, $payload . $eol . '.' . $eol); [$code, $rep] = $read(); $quit();
    return $code === 250 ? ['ok' => true, 'stage' => 'sent', 'error' => ''] : $fail('data', $rep);
}

function page_msg(string $title, string $text): string {
    $t = htmlspecialchars($title); $x = htmlspecialchars($text);
    return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex\"><title>$t</title>"
         . "<style>body{margin:0;font:17px/1.6 system-ui,sans-serif;background:#f4f6f9;color:#0f1b2d}main{max-width:560px;margin:12vh auto;padding:0 20px}h1{font-size:28px;margin:0 0 8px}a{color:#d6400c}</style></head>"
         . "<body><main><h1>$t</h1><p>$x</p><p><a href=\"../\">traverseplatforms.com</a></p></main></body></html>";
}

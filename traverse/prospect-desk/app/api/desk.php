<?php
/* Traverse Prospect Desk (2026-10-26, TR-21, Matthew: "build these leads out similar to how we did the peak app ... where i can input
 * information and knock people off the list"; "a way i can send emails to everyone at once"). The Colorado companies that could buy
 * Traverse (roofing, solar, pest, security, yards), worked like the Peak Sponsor Desk: status from Not contacted to Customer, notes,
 * next steps, contact details, knock a company off (No / Not now) and put it back.
 * Storage: plain files outside the public folder. The companies start from seed.json (tools/build-seed.mjs, from the prospect list);
 * everything after is an append-only log (events.log), replayed on each read, so a new seed never drops what was done on the desk.
 * Sign-in: a 6-digit code per person, kept hashed. Make one from the command line (prints the code once):
 *   php desk.php addaccount "Matthew Sharpe" admin
 * Email to many (2026-10-26): the desk writes one message per company from a template, Matthew previews them and queues them; the
 * hourly cron job (traverse/app/tools/morning-email.php starts it) drip-sends from his Traverse mailbox, one message per company,
 * weekdays 8 am to 5 pm Colorado time, about 2 minutes apart, at most the daily cap (default 40). Nothing is queued without his tap,
 * and nothing can be queued until a postal address is set (the law wants one in every commercial email). Each message carries an
 * unsubscribe link this file answers without a sign-in; an unsubscribed company is never emailed again.
 *   php desk.php sendqueue [max]     (the cron job: sends up to max, default 10, if it is time)
 * Test hooks (the harness only): DESK_DATA (data folder), DESK_MAIL_MOCK (a file: messages are written there, none are sent),
 * DESK_ANYTIME=1 (skip the weekday hours), DESK_GAP (seconds between messages; default 120). */
declare(strict_types=1);
define('DESK', 1);
date_default_timezone_set('America/Denver');
$LOCAL = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
$outside = dirname(__DIR__, 3) . '/traverse-prospects-data';
define('DATA_DIR', getenv('DESK_DATA') ?: (is_dir($outside) ? $outside : ($LOCAL ? dirname(__DIR__) . '/../desk-data-local' : $outside)));
if (!is_dir(DATA_DIR)) { if ($LOCAL) @mkdir(DATA_DIR, 0770, true); else { http_response_code(500); exit('{"ok":false,"error":"No data folder."}'); } }

function jread(string $f, $def) { $s = @file_get_contents(DATA_DIR . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function jwrite(string $f, $v): bool { $t = DATA_DIR . '/' . $f . '.tmp' . bin2hex(random_bytes(3)); if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) === false) return false; return rename($t, DATA_DIR . '/' . $f); }
function logAdd(array $row): bool { return (bool) file_put_contents(DATA_DIR . '/events.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
function logRows(): array { $out = []; $fh = @fopen(DATA_DIR . '/events.log', 'r'); if (!$fh) return $out; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; } fclose($fh); return $out; }
function clean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function cleanText($v, int $max): string { $t = str_replace(["\r\n", "\r"], "\n", (string) $v); $t = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $t) ?? ''; return mb_substr(trim($t), 0, $max); }   /* keeps line breaks */
function codeHash(string $c): string { return hash('sha256', 'prospectdesk|' . $c); }
const STATUSES = ['new' => 'Not contacted', 'emailed' => 'Emailed', 'called' => 'Called / left voicemail', 'talking' => 'Talking', 'demo' => 'Demo booked', 'pilot' => 'Pilot', 'customer' => 'Customer', 'notnow' => 'Not now', 'no' => 'No'];
const OFF = ['notnow', 'no'];   /* knocked off the list: hidden unless asked for */
const TRADES = ['roofing' => 'Roofing', 'roofing solar' => 'Roofing and solar', 'solar' => 'Solar', 'pest' => 'Pest control', 'security' => 'Security', 'yards' => 'Lawn and yards'];
const CAP_MAX = 80;

/* the starting templates, one a trade (2026-10-26): drafts for Matthew to make his own in Settings. They say what the app does in
   plain words and make no claim about any company's results; no data source is named. */
function defaultTemplates(): array {
    $ask = "\n\nWould a 20-minute look be worth it? I can show it to you on a call this week.\n\nThanks,";
    $open = "Hi {first},\n\nI'm Matthew with Traverse, here in Colorado. We make an app for crews that sell door to door";
    return [
        'roofing' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows which streets around {city} had hail lately, which houses to knock first, and keeps every knock, quote and follow-up in one place." . $ask],
        'roofing solar' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows which streets around {city} had hail lately, which houses to knock first, and keeps every knock, quote and follow-up in one place, for roofing and solar." . $ask],
        'solar' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks which houses around {city} to knock first and keeps every knock, quote and follow-up in one place." . $ask],
        'pest' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks the houses worth knocking near the customers you already have and keeps every knock, quote and follow-up in one place." . $ask],
        'security' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks which streets around {city} to work and keeps every knock, quote and follow-up in one place." . $ask],
        'yards' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows lawn size house by house around {city}, picks the streets worth knocking, and keeps every knock, quote and follow-up in one place." . $ask],
    ];
}
function defaultSettings(): array { return ['address' => '', 'signature' => "Matthew Sharpe\nTraverse Platforms LLC\n(303) 596-9515", 'cap' => 40]; }

/* ---- the state: the seed, replayed with the log ---- */
function noteKey(array $r): string { return substr(sha1($r['at'] . '|' . $r['by'] . '|' . $r['note']), 0, 8); }
function state(): array {
    $seed = jread('seed.json', ['leads' => []]);
    $base = ['status' => 'new', 'notes' => [], 'next' => null, 'log' => [], 'person' => '', 'unsub' => false, 'sent' => []];
    $L = []; foreach ($seed['leads'] as $l) $L[$l['id']] = $l + $base;
    $tpl = defaultTemplates(); $set = defaultSettings(); $team = [];
    foreach (logRows() as $r) {
        $id = (string) ($r['id'] ?? ''); $t = (string) ($r['t'] ?? '');
        if (!empty($r['by'])) { $b = (string) $r['by']; $team[$b][$t] = ($team[$b][$t] ?? 0) + 1; }
        switch ($t) {
            case 'lead': $L[$id] = $r['lead'] + $base; break;
            case 'status': if (isset($L[$id])) { $L[$id]['status'] = $r['status']; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Status: ' . (STATUSES[$r['status']] ?? $r['status'])]; } break;
            case 'note': if (isset($L[$id])) $L[$id]['notes'][] = ['k' => noteKey($r), 'at' => $r['at'], 'by' => $r['by'], 'note' => $r['note']]; break;
            case 'notedel': if (isset($L[$id])) $L[$id]['notes'] = array_values(array_filter($L[$id]['notes'], fn($n) => $n['k'] !== ($r['nk'] ?? ''))); break;
            case 'next': if (isset($L[$id])) $L[$id]['next'] = $r['next']; break;
            case 'edit': if (isset($L[$id])) foreach ((array) $r['f'] as $k => $v) if (in_array($k, ['phone', 'email', 'site', 'person', 'name'], true)) { $L[$id][$k] = $v; if ($k === 'email') { $L[$id]['emailOk'] = ''; $L[$id]['emailSrc'] = 'desk'; } } break;
            case 'sent': if (isset($L[$id])) { $L[$id]['sent'][] = ['at' => $r['at'], 'subject' => $r['subject'], 'to' => $r['to']]; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Emailed: ' . $r['subject']]; } break;
            case 'unsub': if (isset($L[$id])) { $L[$id]['unsub'] = true; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Asked not to be emailed']; } break;
            case 'template': if (isset(TRADES[$r['trade'] ?? ''])) $tpl[$r['trade']] = ['subject' => $r['subject'], 'body' => $r['body']]; break;
            case 'settings': $set = array_merge($set, array_intersect_key((array) $r['s'], $set)); break;
        }
    }
    return ['leads' => $L, 'templates' => $tpl, 'settings' => $set, 'team' => $team];
}

/* ---- email ---- */
function secret(): string { $f = DATA_DIR . '/secret.key'; $s = @file_get_contents($f); if (!$s) { $s = bin2hex(random_bytes(32)); file_put_contents($f, $s); @chmod($f, 0600); } return trim($s); }
function unsubToken(string $id): string { return substr(hash_hmac('sha256', 'unsub|' . $id, secret()), 0, 20); }
function firstName(string $person): string { $p = preg_split('/\s+/', trim($person)) ?: []; $f = $p[0] ?? ''; return preg_match('/^[A-Za-z][A-Za-z\'-]{1,30}$/', $f) ? $f : ''; }
function fill(string $s, array $l): string {
    return strtr($s, ['{company}' => (string) $l['name'], '{city}' => (string) ($l['city'] ?: 'your area'), '{trade}' => strtolower(TRADES[$l['trade']] ?? 'your trade'), '{first}' => firstName((string) $l['person']) ?: 'there']);
}
/** one company's message: the template filled in, the signature, the address, the unsubscribe line */
function render(array $l, array $tpl, array $set, string $unsubUrl): array {
    $t = $tpl[$l['trade']] ?? reset($tpl);
    $body = fill((string) $t['body'], $l) . "\n" . trim((string) $set['signature']) . ($set['address'] !== '' ? "\n" . trim((string) $set['address']) : '')
          . "\n\nIf you would rather not get emails from me, reply \"no thanks\" or use this link: " . $unsubUrl;
    return ['id' => $l['id'], 'to' => (string) $l['email'], 'subject' => fill((string) $t['subject'], $l), 'body' => $body];
}
/** why a company cannot be emailed ('' = it can) */
function noMail(array $l): string {
    if (empty($l['email']) || !filter_var($l['email'], FILTER_VALIDATE_EMAIL)) return 'no email';
    if (!empty($l['unsub'])) return 'asked not to be emailed';
    if (($l['emailOk'] ?? '') === 'no') return 'email address cannot take mail';
    if (in_array($l['status'], OFF, true) || $l['status'] === 'customer') return 'knocked off or a customer';
    return '';
}
function sentToday(): int { $d = date('Y-m-d'); $n = 0; foreach (logRows() as $r) if (($r['t'] ?? '') === 'sent' && date('Y-m-d', (int) $r['at']) === $d) $n++; return $n; }
function mailCfg(): array {
    $c = ['host' => 'smtp.gmail.com', 'port' => 587, 'user' => 'm.sharpe@traverseplatforms.com', 'pass' => '', 'from_name' => 'Matthew Sharpe', 'timeout' => 15, 'ehlo' => 'traverseplatforms.com'];
    $f = dirname(__DIR__, 3) . '/traverse-site-private/site-config.php';   /* the same Gmail sender as the website's demo bookings */
    $own = is_file($f) ? (include $f) : [];
    if (is_array($own['smtp'] ?? null)) foreach (['host', 'port', 'user', 'pass', 'timeout', 'ehlo'] as $k) if (isset($own['smtp'][$k])) $c[$k] = $own['smtp'][$k];
    $c['pass'] = preg_replace('/\s+/', '', (string) $c['pass']);
    return $c;
}
function mimeH(string $s): string { return preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }
/** one plain-text message to one address; never throws. DESK_MAIL_MOCK writes it to a file instead (tests). */
function mailSend(string $to, string $subject, string $body, array $extra): array {
    $mock = getenv('DESK_MAIL_MOCK');
    if ($mock) { file_put_contents($mock, json_encode(['at' => time(), 'to' => $to, 'subject' => $subject, 'body' => $body, 'headers' => $extra]) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'mock', 'error' => '']; }
    $s = mailCfg(); $fail = fn($st, $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    if ($s['pass'] === '') return $fail('config', 'no Gmail app password in traverse-site-private/site-config.php');
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
    $eol = "\r\n";
    $h = ['Date: ' . date('r'), 'From: ' . mimeH($s['from_name']) . ' <' . $s['user'] . '>', 'To: ' . $to, 'Subject: ' . mimeH($subject),
          'Message-ID: <' . bin2hex(random_bytes(12)) . '@traverseplatforms.com>', 'MIME-Version: 1.0'];
    foreach ($extra as $x) { $x = trim(preg_replace('/[\r\n]+/', ' ', (string) $x)); if ($x !== '') $h[] = $x; }
    $payload = implode($eol, $h) . $eol . 'Content-Type: text/plain; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($body), 76, $eol);
    $payload = preg_replace('/^\./m', '..', $payload);
    @fwrite($fp, $payload . $eol . '.' . $eol); [$code, $rep] = $read(); $quit();
    return $code === 250 ? ['ok' => true, 'stage' => 'sent', 'error' => ''] : $fail('data', $rep);
}
/** the cron job: send up to $max waiting messages if it is a weekday between 8 am and 5 pm, within today's cap; 0 = fine */
function sendQueue(int $max): int {
    $lk = fopen(DATA_DIR . '/queue.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { echo "another run is sending\n"; return 0; }
    $h = (int) date('G'); $dow = (int) date('N');
    if (!getenv('DESK_ANYTIME') && ($dow > 5 || $h < 8 || $h >= 17)) { echo "not sending hours\n"; return 0; }
    $gap = getenv('DESK_GAP') !== false ? max(0, (int) getenv('DESK_GAP')) : 120;
    $sentN = 0;
    for ($i = 0; $i < $max; $i++) {
        $S = state(); $set = $S['settings'];
        if (trim((string) $set['address']) === '') { echo "no postal address: not sending\n"; break; }
        if (sentToday() >= max(1, min(CAP_MAX, (int) $set['cap']))) { echo "today's cap reached\n"; break; }
        $Q = jread('queue.json', []); if (!$Q) { echo "nothing waiting\n"; break; }
        $m = array_shift($Q); jwrite('queue.json', $Q);
        $l = $S['leads'][$m['id']] ?? null;
        $why = $l ? noMail($l) : 'company gone';
        if ($l && $why === '' && strtolower((string) $l['email']) !== strtolower((string) $m['to'])) $why = 'email changed since it was queued';
        if ($why !== '') { logAdd(['t' => 'skipped', 'id' => $m['id'], 'why' => $why, 'by' => 'queue', 'at' => time()]); $i--; continue; }   /* a skip costs no send */
        if ($sentN > 0 && $gap) sleep($gap);
        $r = mailSend($m['to'], $m['subject'], $m['body'], ['List-Unsubscribe: <' . $m['unsub'] . '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']);
        if ($r['ok']) {
            logAdd(['t' => 'sent', 'id' => $m['id'], 'to' => $m['to'], 'subject' => $m['subject'], 'by' => $m['by'], 'at' => time()]);
            if ($l['status'] === 'new') logAdd(['t' => 'status', 'id' => $m['id'], 'status' => 'emailed', 'by' => $m['by'], 'at' => time()]);
            $sentN++;
        } else {
            $m['tries'] = (int) ($m['tries'] ?? 0) + 1;
            logAdd(['t' => 'sendfail', 'id' => $m['id'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 200), 'by' => 'queue', 'at' => time()]);
            if ($m['tries'] < 3 && in_array($r['stage'], ['connect', 'greeting', 'ehlo', 'starttls', 'ehlo-tls', 'data'], true)) { $Q = jread('queue.json', []); $Q[] = $m; jwrite('queue.json', $Q); }   /* the mail server, not the address: try later */
            if (in_array($r['stage'], ['config', 'auth'], true)) { echo "mail login problem: stopped\n"; $Q = jread('queue.json', []); array_unshift($Q, $m); jwrite('queue.json', $Q); break; }
        }
    }
    echo "sent $sentN\n"; flock($lk, LOCK_UN); return 0;
}

/* ---- the command line: accounts, the send job ---- */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'admin'];
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    if ($cmd === 'sendqueue') exit(sendQueue(max(1, min(20, (int) ($name ?: 10)))));
    fwrite(STDERR, "usage: php desk.php addaccount \"Name\" admin|seller | sendqueue [max]\n"); exit(1);
}

$action = (string) ($_GET['action'] ?? '');
/* ---- unsubscribe: no sign-in (the link in every email, and the one-click button mail apps show) ---- */
if ($action === 'unsub') {
    $id = (string) ($_GET['id'] ?? ''); $tk = (string) ($_GET['t'] ?? '');
    $S = state(); $ok = preg_match('/^[a-z0-9]{6,24}$/', $id) && isset($S['leads'][$id]) && hash_equals(unsubToken($id), $tk);
    if ($ok && empty($S['leads'][$id]['unsub'])) logAdd(['t' => 'unsub', 'id' => $id, 'by' => 'the company', 'at' => time()]);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') { header('Content-Type: text/plain; charset=utf-8'); echo $ok ? 'Unsubscribed.' : 'Link not recognised.'; exit; }
    header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Traverse</title>'
       . '<body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#f4f6f9;color:#0f1b2d;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center"><div>'
       . ($ok ? '<p style="font-size:20px;font-weight:700;margin:0 0 6px">You are unsubscribed</p><p style="margin:0">Traverse will not email you again. Sorry for the bother.</p>'
              : '<p style="font-size:20px;font-weight:700;margin:0 0 6px">That link did not work</p><p style="margin:0">Reply to the email with "no thanks" and we will take you off the list.</p>')
       . '</div>';
    exit;
}

header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function out(array $a): void {
    $j = (string) json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    /* the full list is about 4 MB as text, 0.3 MB packed: packed here with its length, so no browser waits on a stream (2026-10-26) */
    if (strlen($j) > 20000 && function_exists('gzencode') && str_contains((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''), 'gzip')) { $j = (string) gzencode($j, 5); header('Content-Encoding: gzip'); header('Vary: Accept-Encoding'); }
    header('Content-Length: ' . strlen($j)); echo $j; exit;
}
function fail(string $m, int $code = 400): void { http_response_code($code); out(['ok' => false, 'error' => $m]); }
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
if ($isPost && ($_SERVER['HTTP_X_DESK'] ?? '') !== '1') fail('Bad request.', 400);   /* a plain form post from another site cannot set this header */

/* ---- sign-in ---- */
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $tries = jread('tries.json', []); $now = time();
    $mine = array_values(array_filter($tries[$ip] ?? [], fn($t) => $t > $now - 900));
    if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
    $recent = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $recent += count($tries[$k]); }
    if ($recent >= 100) fail('Sign-in is paused for a while after too many wrong codes. Try again later.', 429);
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $acc = jread('accounts.json', ['codes' => []]); $a = $acc['codes'][codeHash($code)] ?? null;
    if (!$a || strlen($code) !== 6) { $mine[] = $now; $tries[$ip] = $mine; jwrite('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = jread('sessions.json', []);
    foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - 60 * 86400) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; jwrite('sessions.json', $ses);
    setcookie('prospectdesk', $tok, ['expires' => $now + 60 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    out(['ok' => true, 'name' => $a['name'], 'role' => $a['role']]);
}
$ses = jread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['prospectdesk'] ?? '')); $me = $ses[$tokH] ?? null;
if (!$me) fail('Signed out.', 401);
$ME = (string) $me['name'];
if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('prospectdesk', '', ['expires' => 1, 'path' => '/']); out(['ok' => true]); }
if ($action === 'me') out(['ok' => true, 'name' => $ME, 'role' => $me['role']]);

function needLead(array $S, string $id): array { if (!preg_match('/^[a-z0-9]{6,24}$/', $id) || !isset($S['leads'][$id])) fail('No such company.', 404); return $S['leads'][$id]; }
function okDay(string $d): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d); }
function okPhone(string $p): string { $d = preg_replace('/\D/', '', $p); if ($p === '') return ''; if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1); if (strlen($d) !== 10) fail('That phone number does not look right.'); return '(' . substr($d, 0, 3) . ') ' . substr($d, 3, 3) . '-' . substr($d, 6); }
function okSite(string $s): string { if ($s === '') return ''; if (!preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $s)) fail('That website does not look right.'); return $s; }
function unsubUrl(string $id): string {
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'traverseplatforms.com'); $path = (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/desk.php');
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || !preg_match('/^(127\.|localhost)/', $host) ? 'https' : 'http';
    return $proto . '://' . $host . $path . '?action=unsub&id=' . $id . '&t=' . unsubToken($id);
}
function queueView(array $S): array {
    $Q = jread('queue.json', []); $recent = [];
    foreach (array_reverse(logRows()) as $r) { $t = $r['t'] ?? ''; if (!in_array($t, ['sent', 'sendfail', 'skipped'], true)) continue; $recent[] = ['t' => $t, 'id' => $r['id'], 'name' => $S['leads'][$r['id']]['name'] ?? '', 'at' => $r['at'], 'subject' => $r['subject'] ?? '', 'why' => $r['why'] ?? ($r['stage'] ?? '')]; if (count($recent) >= 60) break; }
    return ['waiting' => count($Q), 'next' => array_map(fn($m) => ['id' => $m['id'], 'name' => $S['leads'][$m['id']]['name'] ?? '', 'to' => $m['to']], array_slice($Q, 0, 8)), 'sentToday' => sentToday(), 'recent' => $recent, 'mailbox' => mailCfg()['user']];
}

if ($action === 'data') {
    $S = state(); $queued = array_flip(array_column(jread('queue.json', []), 'id'));
    $leads = []; foreach ($S['leads'] as $l) { $l['queued'] = isset($queued[$l['id']]); $l['nomail'] = noMail($l); unset($l['log']); $leads[] = $l; }
    out(['ok' => true, 'me' => ['name' => $ME, 'role' => $me['role']], 'statuses' => STATUSES, 'trades' => TRADES, 'leads' => $leads, 'templates' => $S['templates'], 'settings' => $S['settings'], 'queue' => queueView($S), 'capMax' => CAP_MAX]);
}
if ($action === 'history') { $S = state(); $L = needLead($S, (string) ($_GET['id'] ?? '')); out(['ok' => true, 'log' => array_slice(array_reverse($L['log']), 0, 30)]); }
if ($ME === 'Claude Check') fail('This account only looks, so nothing is saved.', 403);
if (!$isPost) fail('POST required', 405);
$S = state();
switch ($action) {
    case 'status': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $st = (string) ($body['status'] ?? '');
        if (!isset(STATUSES[$st])) fail('Pick a status.');
        logAdd(['t' => 'status', 'id' => $id, 'status' => $st, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'note': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $n = clean($body['note'] ?? '', 1000); if ($n === '') fail('Write the note first.');
        logAdd(['t' => 'note', 'id' => $id, 'note' => $n, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'notedel': {
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $nk = (string) ($body['nk'] ?? '');
        if (!in_array($nk, array_column($L['notes'], 'k'), true)) fail('No such note.', 404);
        logAdd(['t' => 'notedel', 'id' => $id, 'nk' => $nk, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'next': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $d = (string) ($body['date'] ?? ''); $w = clean($body['what'] ?? '', 160);
        if ($d !== '' && !okDay($d)) fail('Pick a date.');
        logAdd(['t' => 'next', 'id' => $id, 'next' => $d === '' && $w === '' ? null : ['date' => $d, 'what' => $w], 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'edit': {
        /* the contact details, as Matthew learns them: who to ask for, phone, email, website */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $f = [];
        if (array_key_exists('person', $body)) $f['person'] = clean($body['person'], 80);
        if (array_key_exists('phone', $body)) $f['phone'] = okPhone(clean($body['phone'], 40));
        if (array_key_exists('email', $body)) { $e = strtolower(clean($body['email'], 120)); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.'); $f['email'] = $e; }
        if (array_key_exists('site', $body)) $f['site'] = okSite(clean($body['site'], 160));
        foreach ($f as $k => $v) if ((string) ($L[$k] ?? '') === $v) unset($f[$k]);
        if (!$f) out(['ok' => true, 'same' => true]);
        logAdd(['t' => 'edit', 'id' => $id, 'f' => $f, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'lead': {
        /* a company added by hand */
        $n = clean($body['name'] ?? '', 100); if ($n === '') fail('Give the company name.');
        foreach ($S['leads'] as $x) if (strtolower(trim($x['name'])) === strtolower($n) && strtolower((string) $x['city']) === strtolower(clean($body['city'] ?? '', 60))) fail('That company is already on the list.');
        $tr = (string) ($body['trade'] ?? ''); if (!isset(TRADES[$tr])) fail('Pick the trade.');
        $e = strtolower(clean($body['email'] ?? '', 120)); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        $id = substr(sha1('added|' . $n . '|' . microtime()), 0, 10);
        $lead = ['id' => $id, 'name' => $n, 'trade' => $tr, 'type' => '', 'city' => clean($body['city'] ?? '', 60), 'zip' => '', 'formed' => '', 'where' => clean($body['where'] ?? 'in our towns', 40),
                 'record' => '', 'phone' => okPhone(clean($body['phone'] ?? '', 40)), 'email' => $e, 'emailOk' => '', 'emailSrc' => $e !== '' ? 'desk' : '', 'site' => okSite(clean($body['site'] ?? '', 160)), 'place' => '', 'cat' => '', 'added' => true, 'person' => clean($body['person'] ?? '', 80)];
        logAdd(['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'id' => $id]);
    }
    case 'template': {
        $tr = (string) ($body['trade'] ?? ''); if (!isset(TRADES[$tr])) fail('Pick the trade.');
        $sub = clean($body['subject'] ?? '', 160); $bd = cleanText($body['body'] ?? '', 4000);
        if ($sub === '' || $bd === '') fail('Give the template a subject and a message.');
        logAdd(['t' => 'template', 'trade' => $tr, 'subject' => $sub, 'body' => $bd, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'settings': {
        $s = [];
        if (array_key_exists('address', $body)) $s['address'] = cleanText($body['address'], 300);
        if (array_key_exists('signature', $body)) $s['signature'] = cleanText($body['signature'], 400);
        if (array_key_exists('cap', $body)) { $c = (int) $body['cap']; if ($c < 1 || $c > CAP_MAX) fail('Emails a day: 1 to ' . CAP_MAX . '.'); $s['cap'] = $c; }
        if (!$s) fail('Nothing to save.');
        logAdd(['t' => 'settings', 's' => $s, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'preview':
    case 'queue': {
        /* one message per company, exactly as it will go: the preview shows them, Queue puts them in line for the cron job */
        $ids = array_values(array_unique(array_filter(array_map('strval', (array) ($body['ids'] ?? [])), fn($x) => preg_match('/^[a-z0-9]{6,24}$/', $x))));
        if (!$ids) fail('Tick at least one company.');
        if (count($ids) > 2000) fail('At most 2,000 at a time.');
        $tplPick = (string) ($body['tpl'] ?? 'auto'); $tpl = $S['templates'];
        if ($tplPick !== 'auto') { if (!isset($tpl[$tplPick])) fail('Pick a template.'); $tpl = array_fill_keys(array_keys(TRADES), $tpl[$tplPick]); }
        $queued = array_flip(array_column(jread('queue.json', []), 'id')); $msgs = []; $skip = [];
        foreach ($ids as $id) {
            $l = $S['leads'][$id] ?? null; if (!$l) { $skip['not on the desk'] = ($skip['not on the desk'] ?? 0) + 1; continue; }
            $why = noMail($l); if ($why === '' && isset($queued[$id])) $why = 'already waiting to send';
            if ($why !== '') { $skip[$why] = ($skip[$why] ?? 0) + 1; continue; }
            $msgs[] = render($l, $tpl, $S['settings'], unsubUrl($id));
        }
        if ($action === 'preview') out(['ok' => true, 'messages' => $msgs, 'skipped' => $skip, 'addressSet' => trim((string) $S['settings']['address']) !== '']);
        if (trim((string) $S['settings']['address']) === '') fail('Add your postal address in Settings first. The law wants it in every email like this, so sending stays off until it is there.');
        if (!$msgs) fail('None of those can be emailed.');
        $lk = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($lk, LOCK_EX);
        $Q = jread('queue.json', []);
        foreach ($msgs as $m) $Q[] = $m + ['unsub' => unsubUrl($m['id']), 'by' => $ME, 'at' => time()];
        jwrite('queue.json', $Q); flock($lk, LOCK_UN);
        logAdd(['t' => 'queued', 'n' => count($msgs), 'by' => $ME, 'at' => time()]);
        out(['ok' => true, 'queued' => count($msgs), 'skipped' => $skip, 'waiting' => count($Q)]);
    }
    case 'queueclear': {
        /* stop: everything still waiting comes off; what was sent stays sent */
        $lk = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($lk, LOCK_EX);
        $n = count(jread('queue.json', [])); jwrite('queue.json', []); flock($lk, LOCK_UN);
        logAdd(['t' => 'queueclear', 'n' => $n, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'cleared' => $n]);
    }
    case 'unsubmark': {
        /* someone replied "no thanks": Matthew marks it, the same as their own link */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); if (!empty($L['unsub'])) out(['ok' => true]);
        logAdd(['t' => 'unsub', 'id' => $id, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
}
fail('Unknown action.', 404);

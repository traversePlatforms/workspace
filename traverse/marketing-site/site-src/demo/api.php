<?php
/**
 * Book a demo + "forgot my app link" for traverseplatforms.com (2026-10-13, Matthew: "a book a demo application ... email to me
 * but also have a built in calendar feature that allows people to select dates").
 *
 *   GET  api.php?action=slots&from=YYYY-MM-DD&days=35   open times per day (Mountain Time), from the availability rules
 *   POST api.php?action=book       {date, time, name, company, trade, email, phone, team, towns, meet, notes, hp, t}
 *   POST api.php?action=linkhelp   {name, company, email, phone, hp, t}   a client who lost their app's address
 *   GET  api.php?action=cancel&id=..&k=..   the visitor's own cancel link (from their confirmation email)
 *
 * Everything is kept OUTSIDE public_html, in ../traverse-site-private/ (site-config.php, bookings.json, requests.log,
 * mail.log). Bookings are saved before any email is tried, so a mail failure never loses one; the manage page lists them.
 * A booking takes its slot under a file lock, so two people cannot take the same time. Spam: a hidden field, a minimum
 * time on the page, and a per-address limit.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/_lib.php';

$action = (string) ($_GET['action'] ?? '');
$cfg = site_config();

if ($action === 'slots') {
    $from = (string) ($_GET['from'] ?? '');
    $tz = new DateTimeZone($cfg['timezone']);
    $start = preg_match('/^\d{4}-\d{2}-\d{2}$/D', $from) ? new DateTimeImmutable($from, $tz) : new DateTimeImmutable('today', $tz);
    $days = max(1, min(62, (int) ($_GET['days'] ?? 35)));
    out(['ok' => true, 'tz' => $cfg['timezone'], 'tzLabel' => $cfg['timezone_label'], 'minutes' => $cfg['slot_minutes'],
         'days' => open_slots($cfg, $start, $days)]);
}

if ($action === 'cancel') {
    $id = (string) ($_GET['id'] ?? ''); $k = (string) ($_GET['k'] ?? '');
    $res = with_bookings(function (array &$all) use ($id, $k) {
        foreach ($all as &$b) {
            if (($b['id'] ?? '') === $id && hash_equals((string) ($b['key'] ?? ''), $k)) {
                if (($b['status'] ?? '') === 'cancelled') return ['ok' => true, 'already' => true, 'b' => $b];
                $b['status'] = 'cancelled'; $b['cancelled_at'] = time(); $b['cancelled_by'] = 'visitor';
                return ['ok' => true, 'b' => $b];
            }
        }
        return ['ok' => false];
    });
    header('Content-Type: text/html; charset=utf-8');
    if (!$res['ok']) { http_response_code(404); echo page_msg('That link did not match a booking', 'It may have been changed. Email hello@traverseplatforms.com and we will sort it out.'); exit; }
    if (empty($res['already'])) notify_cancel($cfg, $res['b']);
    echo page_msg('Your demo is cancelled', 'Thanks for letting us know. If you would like another time, book again at traverseplatforms.com/demo.'); exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Not found.', 404);
$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) fail('Send the form again.');
/* spam: the hidden field must stay empty, the page must have been open a few seconds, and one address gets a few tries an hour */
if (trim((string) ($in['hp'] ?? '')) !== '') out(['ok' => true]);            /* a bot filled the hidden field: pretend it worked */
if ((int) ($in['t'] ?? 0) > 0 && (int) ($in['t'] ?? 0) < 4000) fail('That was very quick. Please try again.');
rate_limit($action === 'book' ? 6 : 4, $action);

if ($action === 'book') {
    $f = clean_fields($in, ['name' => 80, 'company' => 100, 'trade' => 40, 'email' => 120, 'phone' => 40, 'team' => 20, 'towns' => 300, 'meet' => 20, 'notes' => 1000]);
    foreach (['name' => 'your name', 'company' => 'your company', 'email' => 'your email', 'phone' => 'a phone number'] as $k => $what)
        if ($f[$k] === '') fail('Please add ' . $what . '.');
    if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('That email address does not look right.');
    if (strlen(preg_replace('/\D+/', '', $f['phone'])) < 10) fail('Please add a phone number with the area code.');
    if (!in_array($f['meet'], ['phone', 'video'], true)) $f['meet'] = 'video';
    $date = (string) ($in['date'] ?? ''); $time = (string) ($in['time'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) || !preg_match('/^\d{2}:\d{2}$/D', $time)) fail('Pick a day and a time.');

    $res = with_bookings(function (array &$all) use ($cfg, $date, $time, $f) {
        if (!slot_is_open($cfg, $date, $time, $all)) return ['ok' => false, 'error' => 'That time was just taken. Please pick another.'];
        $b = $f + ['id' => 'd' . date('ymd') . bin2hex(random_bytes(4)), 'key' => bin2hex(random_bytes(16)), 'date' => $date, 'time' => $time,
                   'minutes' => $cfg['slot_minutes'], 'status' => 'booked', 'at' => time(), 'ip' => client_ip()];
        $all[] = $b;
        return ['ok' => true, 'b' => $b];
    });
    if (!$res['ok']) fail($res['error'], 409);
    $mail = notify_booking($cfg, $res['b']);
    out(['ok' => true, 'when' => when_text($cfg, $res['b']), 'emailed' => $mail]);
}

if ($action === 'linkhelp') {
    $f = clean_fields($in, ['name' => 80, 'company' => 100, 'email' => 120, 'phone' => 40]);
    if ($f['name'] === '' || $f['company'] === '') fail('Please add your name and your company.');
    if (!filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('That email address does not look right.');
    append_line($cfg['dir'] . '/requests.log', ['what' => 'linkhelp', 'at' => time(), 'ip' => client_ip()] + $f);
    $body = "Someone asked for their Traverse app link.\n\nName: {$f['name']}\nCompany: {$f['company']}\nEmail: {$f['email']}\nPhone: {$f['phone']}\n\n"
          . "Check they are on that company's account before sending the address. Reply to this email to answer them.";
    $r = send_mail($cfg, $cfg['notify_to'], 'App link request: ' . $f['company'], $body, ['Reply-To: ' . $f['email']]);
    log_mail($cfg, 'linkhelp', $r);
    out(['ok' => true]);
}

fail('Not found.', 404);

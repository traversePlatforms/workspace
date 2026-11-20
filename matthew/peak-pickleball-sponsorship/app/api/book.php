<?php
/* The booking page (2026-11-19): where a booking link from the Peak desk lands. Public at https://traverseplatforms.com/peak-book/ (a
 * two-line index.php there requires this file); book-lib.php explains the links, the shared schedule and what a booking does.
 * It shows the open times and a short form, and nothing of the desk: no company names but the visitor's own (from their email's link),
 * no other bookings, no desk address. Opening it only logs a view; only the button (a POST, with a token of this page) books.
 *   ?p= ?g= ?m= ?o=  a booking link     ?px=  a desk email's open image (when that setting is on)     ?ics=  the visit as a calendar file */
declare(strict_types=1);
require __DIR__ . '/desk-store.php';
require __DIR__ . '/tour-mail.php';
require __DIR__ . '/book-lib.php';
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer'); header('X-Content-Type-Options: nosniff');
$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$q = $_GET; $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');

/* a desk email's open image */
if (isset($q['px'])) {
    if (preg_match('/^(dm[0-9a-f]{10})-([0-9a-f]{12})$/', (string) $q['px'], $m) && hash_equals(bkSig('px|' . $m[1], 12), $m[2])) bkLog(['t' => 'open', 'ref' => $m[1], 'proxy' => preg_match('/GoogleImageProxy|YahooMailProxy/i', $ua) ? 1 : 0]);
    header('Content-Type: image/gif'); echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); exit;
}
/* the visit as a calendar file (the "Add it to my calendar" button after booking) */
if (isset($q['ics'])) {
    if (preg_match('/^([0-9a-f]{10})-([0-9a-f]{12})$/', (string) $q['ics'], $m) && hash_equals(bkSig('ics|' . $m[1], 12), $m[2])) {
        foreach (['sponsor', 'expo'] as $w) foreach (toursOf($w) as $t) if ($t['tid'] === $m[1]) {
            header('Content-Type: text/calendar; charset=utf-8'); header('Content-Disposition: attachment; filename="peak-visit-' . $t['date'] . '.ics"');
            echo bkIcs($t, bkMeet()); exit;   /* who meets visitors (the desk setting), never the seller (2026-11-20) */
        }
    }
    http_response_code(404); exit;
}

header('Content-Type: text/html; charset=utf-8'); header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
$page = function (string $title, string $inner) use ($h): void {
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Peak Pickleball: book a time</title>',
        '<body style="margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#eef3f0;color:#14231d;padding:16px">',
        '<main style="max-width:560px;margin:4vh auto;background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08)">',
        '<p style="margin:0 0 4px;font-weight:800;letter-spacing:.02em;color:#1f5b46">PEAK PICKLEBALL</p>',
        '<h1 style="font-size:21px;margin:0 0 10px">', $h($title), '</h1>', $inner, '</main></body></html>';
    exit;
};
$phone = '<p style="margin:12px 0 0">Or call Peak at <a href="tel:+17193774725" style="color:#1f5b46">' . BK_PHONE . '</a>.</p>';
$ctx = bkParse($q);
if (!$ctx) $page('That link did not work', '<p style="margin:0">Reply to the email it came in, and we will find a time with you.</p>' . $phone);
$c = bkConf();
if (!$c['on']) $page('Not taking bookings right now', '<p style="margin:0">Online booking is closed for the moment. Reply to the email this link came in, and we will find a time with you.</p>' . $phone);
/* who the visitor meets: the desk's "Who meets visitors" setting, never the seller whose link it was (they book tours, they don't give
   them; 2026-11-20). Empty leaves the name out. */
$meet = (string) $c['meet']; $with = $meet !== '' ? ', with ' . $h($meet) : '';
$when = fn(string $d, string $t) => date('l, F j', (int) strtotime($d)) . ' at ' . date('g:i a', (int) strtotime($d . ' ' . $t));
$where = '<p style="margin:10px 0 0"><b>Where:</b> ' . $h(BK_ADDRESS) . '. The entrance is from the parking lot off Jamboree Drive; there is no way in from inside Chapel Hills Mall.</p>';
$ftok = bkSig('f|' . $ctx['key']);
$err = ''; $val = ['name' => $ctx['name'], 'email' => $ctx['email'], 'company' => '', 'note' => '', 'topic' => '', 'slot' => ''];

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    foreach ($val as $k => $v) if (isset($_POST[$k])) $val[$k] = (string) $_POST[$k];
    if (!hash_equals($ftok, (string) ($_POST['ft'] ?? '')) || (string) ($_POST['website'] ?? '') !== '') $page('That did not go through', '<p style="margin:0">Go back, reload the page and try again.</p>' . $phone);
    /* at most 10 tries an hour from one address */
    $ip = hash('sha256', 'bk|' . (string) ($_SERVER['REMOTE_ADDR'] ?? '')); $tries = jread('book-tries.json', []); $now = time();
    foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); }
    if (count($tries[$ip] ?? []) >= 10) $page('Too many tries', '<p style="margin:0">Wait a little and try again.</p>' . $phone);
    $tries[$ip][] = $now; jwrite('book-tries.json', $tries);
    $r = bkBook($ctx, $val);
    if (!empty($r['ok'])) {
        $t = null; foreach (toursOf($r['w']) as $x) if ($x['tid'] === $r['tid']) $t = $x;
        $mail = ($r['tm']['state'] ?? '') === 'sent' || !empty($r['dup']);
        $page('You are booked', '<p style="margin:0"><b>' . $h($when($r['date'], $r['time'])) . '</b> (Mountain time), ' . (int) $r['mins'] . ' minutes' . $with . '.</p>' . $where
            . ($mail ? '<p style="margin:10px 0 0">A confirmation email with a calendar invite is on its way to ' . $h(strtolower($val['email'])) . '.</p>' : '')
            . '<p style="margin:14px 0 0"><a href="?ics=' . $h($r['tid'] . '-' . bkSig('ics|' . $r['tid'], 12)) . '" style="display:inline-block;background:#1f5b46;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:10px 18px">Add it to my calendar</a></p>'
            . '<p style="margin:14px 0 0">Need to change it? Reply to the email' . ($mail ? '' : ' this link came in') . ', or call Peak at ' . BK_PHONE . '.</p>');
    }
    if (($r['code'] ?? '') === 'mine') $page('You already have a time', '<p style="margin:0">' . $h($when($r['date'], $r['time'])) . ' (Mountain time)' . $with . '.</p>' . $where . '<p style="margin:12px 0 0">To change it, reply to the email or call Peak at ' . BK_PHONE . '.</p>');
    if (($r['code'] ?? '') === 'closed') $page('Not taking bookings right now', '<p style="margin:0">Online booking just closed. Reply to the email this link came in, and we will find a time with you.</p>' . $phone);
    $err = (string) ($r['why'] ?? 'That did not go through. Try again.');
} else {
    bkLog(['t' => 'view', 'src' => $ctx['src'], 'host' => $ctx['host'], 'ref' => $ctx['ref'], 'bot' => bkBot($ua, (int) ($ctx['sentAt'] ?? 0)) ? 1 : 0]);
}

$slots = bkSlots(400, $c);
if (!$slots) $page('No open times just now', '<p style="margin:0">Every time in the next ' . (int) $c['ahead'] . ' days is taken. Reply to the email this link came in, and we will find a time with you.</p>' . $phone);
$known = $ctx['id'] !== '' && empty($ctx['off']);
$in = 'width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #c3d3ca;border-radius:8px';
$f = ($err !== '' ? '<p role="alert" style="margin:0 0 12px;padding:9px 12px;border-radius:9px;background:#fdecea;color:#7a1d12">' . $h($err) . '</p>' : '')
    . '<p style="margin:0">A ' . (int) $c['mins'] . '-minute visit to Peak Pickleball' . ($meet !== '' ? ' with ' . $h($meet) : '') . ($known ? ', for ' . $h($ctx['company']) : '') . '. Pick a time below. Times are Mountain time.</p>' . $where
    . '<form method="post" style="margin-top:6px">';
$by = []; foreach ($slots as [$d, $t]) $by[$d][] = $t;
foreach ($by as $d => $ts) {
    $f .= '<fieldset style="border:0;margin:14px 0 0;padding:0"><legend style="font-weight:700;padding:0;margin-bottom:6px">' . $h(date('l, F j', (int) strtotime($d))) . '</legend><div style="display:flex;flex-wrap:wrap;gap:6px">';
    foreach ($ts as $t) { $v = $d . ' ' . $t; $f .= '<label style="border:1px solid #c3d3ca;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap"><input type="radio" name="slot" value="' . $h($v) . '" required' . ($val['slot'] === $v ? ' checked' : '') . '> ' . $h(date('g:i a', (int) strtotime($v))) . '</label>'; }
    $f .= '</div></fieldset>';
}
$lab = fn(string $t, string $for) => '<label for="' . $for . '" style="display:block;margin:14px 0 4px;font-weight:600">' . $t . '</label>';
$f .= $lab('Your name', 'bkn') . '<input id="bkn" name="name" maxlength="80" required autocomplete="name" value="' . $h($val['name']) . '" style="' . $in . '">'
    . $lab('Your email', 'bke') . '<input id="bke" name="email" type="email" maxlength="160" required autocomplete="email" value="' . $h($val['email']) . '" style="' . $in . '">';
if (!$known) {
    $f .= $lab('Company or organisation', 'bkc') . '<input id="bkc" name="company" maxlength="100" required autocomplete="organization" value="' . $h($val['company']) . '" style="' . $in . '">';
    if ($ctx['w'] === '') $f .= '<fieldset style="border:0;margin:14px 0 0;padding:0"><legend style="font-weight:600;padding:0;margin-bottom:4px">What would you like to talk about?</legend>'
        . '<label style="display:block"><input type="radio" name="topic" value="sponsor"' . ($val['topic'] !== 'expo' ? ' checked' : '') . '> Sponsoring at Peak</label>'
        . '<label style="display:block"><input type="radio" name="topic" value="expo"' . ($val['topic'] === 'expo' ? ' checked' : '') . '> Holding an event or expo at Peak</label></fieldset>';
}
$f .= $lab('Anything we should know (optional)', 'bkt') . '<textarea id="bkt" name="note" maxlength="400" rows="3" style="' . $in . '">' . $h($val['note']) . '</textarea>'
    . '<div style="position:absolute;left:-9999px" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>'
    . '<input type="hidden" name="ft" value="' . $h($ftok) . '">'
    . '<p style="margin:16px 0 0"><button type="submit" style="font:700 16px system-ui,sans-serif;background:#1f5b46;color:#fff;border:0;border-radius:10px;padding:12px 22px;cursor:pointer">Book this time</button></p></form>';
$page('Book a time with Peak Pickleball', $f);

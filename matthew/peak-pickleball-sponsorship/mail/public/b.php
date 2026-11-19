<?php
declare(strict_types=1);
/* The "book a time" page a Peak email can link to with {book} (2026-11-18, Matthew: "I also need whatever replies to come to me unless they
   are just booking things directly"). The person picks a tour or call time from the weekly pattern Matthew sets in Outbox (Settings, Book a
   time); nobody's calendar is read. A booking:
     - is logged here ('booked', with the slot, so nobody else gets it),
     - goes on the Peak desk as a tour for that company (deskBooked: Meeting / tour booked, or Tour booked on expo),
     - and sends Matthew a short heads-up from the server (the way Traverse's own notices go).
   Opening the page only shows it ('bookview'); only the button (a POST) books. A reply to the email still goes to Matthew's inbox as before. */
require __DIR__ . '/lib.php';
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY'); header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
$h = fn(string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$rid = (string) ($_GET['r'] ?? ''); $sg = (string) ($_GET['s'] ?? '');
$p = pmReady() && preg_match('/^[0-9a-f]{10}$/', $rid) && hash_equals(pmSig('b|' . $rid), $sg) ? pmByRid($rid) : [];
$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$when = fn(string $d, string $t) => date('D M j', (int) strtotime($d)) . ', ' . date('g:i a', (int) strtotime($d . ' ' . $t));
$page = function (string $title, string $inner) use ($h) {
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Peak Pickleball</title>',
         '<body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#f3f6f4;color:#14231d;padding:16px"><div style="max-width:520px;margin:6vh auto;background:#fff;border-radius:14px;padding:22px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08)">',
         '<p style="font-size:20px;font-weight:700;margin:0 0 8px">', $h($title), '</p>', $inner, '</div>';
    exit;
};
if (!$p) $page('That link did not work', '<p style="margin:0">Reply to the email and Matthew will set up a time with you.</p>');
/* 2026-11-19: the Peak desk's booking page takes over when its code is on this server (one schedule for the whole desk); the view is counted here */
if (($desk = pmBookDesk($p)) !== '') { pmLog(['t' => 'bookview', 'to' => $p['to'], 'l' => $p['list'], 'desk' => 1]); header('Location: ' . $desk, true, 302); exit; }
$S = pmState(); $B = $S['settings']['book']; $kind = PM_BOOK_KINDS[$B['kind']] ?? 'Tour of Peak'; $mins = (int) $B['mins'];
$mine = $S['people'][$p['to']]['booked'] ?? null;
if ($mine) $page('You are booked', '<p style="margin:0">' . $h($kind) . ', ' . $h($when($mine['date'], $mine['time'])) . ' (Colorado time). Matthew has it. To change it, reply to the email.</p>');
if (empty($B['on'])) $page('Booking online is closed', '<p style="margin:0">Reply to the email and Matthew will set up a time with you.</p>');

if ($post) {
    $slot = (string) ($_POST['slot'] ?? ''); $note = pmClean($_POST['note'] ?? '', 300); $name = pmClean($_POST['name'] ?? '', 80);
    if (!preg_match('/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/', $slot, $m)) $page('Pick a time', '<p style="margin:0">Go back and pick one of the times.</p>');
    /* one booking at a time, so two people never get the same slot */
    $lk = fopen(pmData() . '/book.lock', 'c'); flock($lk, LOCK_EX);
    $S = pmState(); $free = in_array([$m[1], $m[2]], pmBookSlots($S, 1000), true); $mine = $S['people'][$p['to']]['booked'] ?? null; $row = null;
    if ($free && !$mine) {
        $who = $name !== '' ? $name : ($p['person'] !== '' ? $p['person'] : $p['to']);
        $row = ['t' => 'booked', 'to' => $p['to'], 'who' => $who, 'l' => $p['list'], 'date' => $m[1], 'time' => $m[2], 'kind' => (string) $B['kind'], 'mins' => $mins, 'note' => $note, 'at' => pmNow()]
             + pmDeskTag($p, 'book:' . substr(sha1($rid . '|' . $slot), 0, 16));
        pmLog($row);
    }
    flock($lk, LOCK_UN); fclose($lk);
    if (!$row) $page($mine ? 'You are booked' : 'That time just went', $mine ? '<p style="margin:0">You already have a time with Matthew. To change it, reply to the email.</p>' : '<p style="margin:0">Someone took it a moment ago. Go back and pick another time.</p>');
    /* the desk and Matthew hear of it; neither can undo the booking if it fails (the desk is tried again on the next hourly run) */
    pmDeskNow($row, $S['settings']);
    $n = pmNotify('Peak: ' . ($p['company'] ?: $p['to']) . ' booked a ' . strtolower($kind) . ', ' . $when($m[1], $m[2]),
        $row['who'] . ' (' . $p['to'] . ($p['role'] !== '' ? ', ' . $p['role'] : '') . ') at ' . ($p['company'] ?: 'their organisation') . " booked from the Peak email.\n\n"
        . $kind . ': ' . $when($m[1], $m[2]) . ' Colorado time, ' . $mins . " minutes.\nList: " . (PM_LISTS[$p['list']] ?? $p['list']) . "\n" . ($note !== '' ? 'They wrote: ' . $note . "\n" : '')
        . "\nIt is on the Peak desk as a tour (Meeting / tour booked). Their email address is above if you want to confirm.\n");
    pmLog(['t' => 'notify', 'what' => 'booked', 'to' => $p['to'], 'ok' => $n['ok'], 'stage' => $n['stage']]);
    $page('You are booked', '<p style="margin:0">' . $h($kind) . ', ' . $h($when($m[1], $m[2])) . ' (Colorado time), ' . $mins . ' minutes. Matthew has it and will see you then.</p>'
        . ($B['kind'] === 'tour' ? '<p style="margin:10px 0 0">' . $h((string) $S['settings']['address']) . '</p>' : '<p style="margin:10px 0 0">Matthew will call ' . $h($row['who']) . '. If a different number is best, reply to the email with it.</p>'));
}

pmLog(['t' => 'bookview', 'to' => $p['to'], 'l' => $p['list']]);
$slots = pmBookSlots($S, 120);
if (!$slots) $page('No open times just now', '<p style="margin:0">Reply to the email and Matthew will set up a time with you.</p>');
$by = []; foreach ($slots as [$d, $t]) $by[$d][] = $t;
$f = '<p style="margin:0 0 12px">' . $h($kind) . ' with Matthew Sharpe, ' . $mins . ' minutes. Pick a time (Colorado time).</p><form method="post" action="b.php?r=' . $h($rid) . '&amp;s=' . $h($sg) . '">';
foreach ($by as $d => $ts) {
    $f .= '<p style="margin:12px 0 4px;font-weight:600">' . $h(date('l, M j', (int) strtotime($d))) . '</p><div style="display:flex;flex-wrap:wrap;gap:6px">';
    foreach ($ts as $t) $f .= '<label style="border:1px solid #c9d6cf;border-radius:8px;padding:5px 9px;cursor:pointer"><input type="radio" name="slot" value="' . $h($d . ' ' . $t) . '" required> ' . $h(date('g:i a', (int) strtotime($d . ' ' . $t))) . '</label>';
    $f .= '</div>';
}
$f .= '<p style="margin:14px 0 4px">Your name</p><input name="name" maxlength="80" value="' . $h($p['person']) . '" style="width:100%;box-sizing:border-box;font:inherit;padding:7px;border:1px solid #c9d6cf;border-radius:8px">'
    . '<p style="margin:10px 0 4px">Anything Matthew should know (optional)</p><textarea name="note" maxlength="300" rows="3" style="width:100%;box-sizing:border-box;font:inherit;padding:7px;border:1px solid #c9d6cf;border-radius:8px"></textarea>'
    . '<p style="margin:14px 0 0"><button type="submit" style="font:700 16px system-ui,sans-serif;background:#1f5b46;color:#fff;border:0;border-radius:10px;padding:12px 22px">Book this time</button></p></form>';
$page('Book a time with Peak Pickleball', $f);

<?php
/**
 * Matthew's page for demo bookings (2026-10-13): upcoming and past bookings, cancel one, block or unblock a day.
 * Open with manage.php?k=<manage_key> (the key is in traverse-site-private/site-config.php; keep the link private).
 * Wrong or missing key: 404, as if the page were not here.
 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$c = site_config();
$k = (string) ($_GET['k'] ?? $_POST['k'] ?? '');
if ($c['manage_key'] === '' || !hash_equals($c['manage_key'], $k)) { http_response_code(404); header('Content-Type: text/html'); echo 'Not found.'; exit; }
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$tz = new DateTimeZone($c['timezone']); $msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $do = (string) ($_POST['do'] ?? '');
    if ($do === 'cancel') {
        $id = (string) ($_POST['id'] ?? '');
        $r = with_bookings(function (array &$all) use ($id) { foreach ($all as &$b) if ($b['id'] === $id && $b['status'] === 'booked') { $b['status'] = 'cancelled'; $b['cancelled_at'] = time(); $b['cancelled_by'] = 'Traverse'; return ['ok' => true, 'b' => $b]; } return ['ok' => false]; });
        if ($r['ok']) {
            $b = $r['b']; $when = when_text($c, $b);
            $mr = send_mail($c, $b['email'], 'Your Traverse demo on ' . $when . ' is cancelled',
                "Hi {$b['name']},\n\nWe need to move your demo on $when. Sorry about that. Please pick another time at https://traverseplatforms.com/demo/ or reply to this email.\n\nThanks,\n{$c['organizer_name']}\n{$c['phone']}",
                ['Reply-To: ' . $c['notify_to']], ics($c, $b, 'CANCEL'));
            log_mail($c, 'manage-cancel ' . $b['id'], $mr);
            $msg = 'Cancelled. ' . ($mr['ok'] ? 'They were emailed.' : 'The email to them did not send (' . $mr['stage'] . '); let them know yourself.');
        }
    }
    if ($do === 'block' || $do === 'unblock') {
        $d = (string) ($_POST['date'] ?? '');
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $d)) {
            $f = $c['dir'] . '/blocked.json'; $list = json_decode((string) @file_get_contents($f), true); if (!is_array($list)) $list = [];
            $list = $do === 'block' ? array_values(array_unique(array_merge($list, [$d]))) : array_values(array_diff($list, [$d]));
            sort($list); file_put_contents($f, json_encode($list), LOCK_EX);
            $msg = ($do === 'block' ? 'Blocked ' : 'Opened ') . $d . '.';
        }
    }
    header('Location: manage.php?k=' . rawurlencode($k) . '&m=' . rawurlencode($msg)); exit;
}
$c = site_config();
$msg = (string) ($_GET['m'] ?? '');
$all = read_bookings(); usort($all, fn($a, $b) => strcmp($a['date'] . $a['time'], $b['date'] . $b['time']));
$today = (new DateTimeImmutable('today', $tz))->format('Y-m-d');
$up = array_filter($all, fn($b) => $b['date'] >= $today && $b['status'] === 'booked');
$past = array_reverse(array_filter($all, fn($b) => !($b['date'] >= $today && $b['status'] === 'booked')));
$mailOk = $c['smtp']['pass'] !== '';
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES);
$row = function (array $b, bool $act) use ($c, $e, $k) {
    $h = '<tr><td><b>' . $e(when_text($c, $b)) . '</b>' . ($b['status'] !== 'booked' ? '<br><small>' . $e($b['status']) . '</small>' : '') . '</td><td>' . $e($b['name']) . '<br><small>' . $e($b['company']) . ' · ' . $e($b['trade']) . ' · team ' . $e($b['team']) . '</small></td>'
       . '<td><a href="mailto:' . $e($b['email']) . '">' . $e($b['email']) . '</a><br><small>' . $e($b['phone']) . ' · ' . ($b['meet'] === 'phone' ? 'phone call' : 'video call') . '</small></td><td><small>' . $e($b['towns']) . ($b['notes'] !== '' ? '<br>' . nl2br($e($b['notes'])) : '') . '</small></td><td>';
    if ($act) $h .= '<form method="post"><input type="hidden" name="k" value="' . $e($k) . '"><input type="hidden" name="do" value="cancel"><input type="hidden" name="id" value="' . $e($b['id']) . '"><button>Cancel and email them</button></form>';
    return $h . '</td></tr>';
};
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Demo bookings · Traverse</title>
<style>
body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f6f9;color:#0f1b2d}
main{max-width:1100px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:26px;margin:0 0 4px} h2{font-size:18px;margin:28px 0 8px}
.note{background:#fff;border:1px solid #dce2ea;border-radius:10px;padding:10px 14px;margin:12px 0}
.warn{border-color:#d6400c;background:#fde6dc}
.tw{overflow-x:auto;background:#fff;border:1px solid #dce2ea;border-radius:10px}
table{border-collapse:collapse;width:100%} td,th{padding:9px 12px;border-bottom:1px solid #eef1f5;text-align:left;vertical-align:top} small{color:#566476}
button{font:inherit;padding:6px 10px;border-radius:8px;border:1.5px solid #dce2ea;background:#fff;cursor:pointer}
form.inline{display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap} input[type=date]{font:inherit;padding:5px 8px;border:1.5px solid #dce2ea;border-radius:8px}
a{color:#d6400c}
</style></head><body><main>
<h1>Demo bookings</h1>
<div style="color:#566476">Times in <?= $e($c['timezone_label']) ?>. <?= (int) $c['slot_minutes'] ?>-minute demos. The booking page is traverseplatforms.com/demo/.</div>
<?php if ($msg !== ''): ?><div class="note"><?= $e($msg) ?></div><?php endif; ?>
<?php if (!$mailOk): ?><div class="note warn"><b>Emails are not sending yet.</b> Bookings are saved here, but nobody is emailed until the Gmail app password is added to traverse-site-private/site-config.php.</div><?php endif; ?>
<h2>Coming up (<?= count($up) ?>)</h2>
<div class="tw"><table><?php foreach ($up as $b) echo $row($b, true); if (!$up) echo '<tr><td>No demos booked yet.</td></tr>'; ?></table></div>
<h2>Days off</h2>
<div class="note">
<form method="post" class="inline"><input type="hidden" name="k" value="<?= $e($k) ?>"><input type="hidden" name="do" value="block"><input type="date" name="date" required><button>Block this day</button></form>
<?php foreach ($c['blocked_dates'] as $d): ?>
 <form method="post" class="inline" style="margin:8px 8px 0 0"><input type="hidden" name="k" value="<?= $e($k) ?>"><input type="hidden" name="do" value="unblock"><input type="hidden" name="date" value="<?= $e($d) ?>"><span><?= $e($d) ?></span><button>Open again</button></form>
<?php endforeach; ?>
<div style="margin-top:8px;color:#566476">Regular hours: Monday to Friday, 9 am to 5 pm, set in site-config.php.</div>
</div>
<h2>Past and cancelled (<?= count($past) ?>)</h2>
<div class="tw"><table><?php foreach (array_slice($past, 0, 100) as $b) echo $row($b, false); if (!$past) echo '<tr><td>None yet.</td></tr>'; ?></table></div>
</main></body></html>

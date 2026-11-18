<?php
declare(strict_types=1);
/* The unsubscribe link in every Peak email. Opening it only shows the page; the button on it (a POST) takes the address off, because
   mail scanners open every link in a message as it lands and would otherwise unsubscribe people who never read it. */
require __DIR__ . '/lib.php';
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
$rid = (string) ($_GET['r'] ?? ''); $sg = (string) ($_GET['s'] ?? '');
$pp = pmReady() && preg_match('/^[0-9a-f]{10}$/', $rid) && hash_equals(pmSig('u|' . $rid), $sg) ? pmByRid($rid) : [];
$to = (string) ($pp['to'] ?? '');
$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$S = $to !== '' ? pmState() : null; $already = $S && !empty($S['people'][$to]['unsub']);
if ($post && $to !== '' && !$already) {
    /* the Peak desk hears of it as a STOP (Not now, or the owner's follow-up); if the desk is down the next hourly run tells it */
    $row = ['t' => 'unsub', 'to' => $to, 'who' => $pp['person'] !== '' ? $pp['person'] : $to, 'l' => (string) ($S['people'][$to]['list'] ?? $pp['list']), 'via' => 'link', 'at' => pmNow()] + pmDeskTag($pp, 'unsub:' . $rid);
    pmLog($row); $already = true;
    pmDeskNow($row, $S['settings']);
}
$h = fn(string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Peak Pickleball</title>',
     '<body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#f3f6f4;color:#14231d;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center"><div style="max-width:420px">';
if ($to === '') echo '<p style="font-size:20px;font-weight:700;margin:0 0 6px">That link did not work</p><p style="margin:0">Reply to the email with STOP and you will not be emailed again.</p>';
elseif ($already) echo '<p style="font-size:20px;font-weight:700;margin:0 0 6px">You are unsubscribed</p><p style="margin:0">You will not get these emails from Matthew at Peak Pickleball again. Sorry for the bother.</p>';
else echo '<p style="font-size:20px;font-weight:700;margin:0 0 6px">Stop these emails?</p><p style="margin:0 0 14px">One tap and Matthew at Peak Pickleball will not email ', $h($to), ' again.</p>',
          '<form method="post" action="u.php?r=', $h($rid), '&amp;s=', $h($sg), '"><button type="submit" style="font:700 16px system-ui,sans-serif;background:#1f5b46;color:#fff;border:0;border-radius:10px;padding:12px 22px">Unsubscribe</button></form>';
echo '</div>';

<?php
declare(strict_types=1);
/* A tracked link in a Peak email: logs the click, then forwards at once to the web address the email showed. Only addresses an email
   really carried (links.json) are forwarded to, so this is no open redirect. Mail scanners that open every link as a message lands
   (Safe Links, Proofpoint ...) are logged as 'scan', not as a click. */
require __DIR__ . '/lib.php';
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
$rid = (string) ($_GET['r'] ?? ''); $h = (string) ($_GET['l'] ?? ''); $sg = (string) ($_GET['s'] ?? '');
$dest = 'https://peakpickleball.us/';
if (pmReady() && preg_match('/^[0-9a-f]{10}$/', $rid) && preg_match('/^[0-9a-f]{8}$/', $h) && hash_equals(pmSig('r|' . $rid . '|' . $h), $sg)) {
    $u = (string) (pmJ('links.json', [])[$h] ?? '');
    if (preg_match('#^https?://#i', $u)) $dest = $u;
    $to = ''; foreach ((array) (pmJ('lists.json', ['lists' => []])['lists'] ?? []) as $ps) foreach ($ps as $p) if ($p['rid'] === $rid) { $to = $p['to']; break 2; }
    if ($to !== '') {
        $S = pmState(); $sent = (int) ($S['people'][$to]['sent'] ?? 0); $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $bot = ($sent && pmNow() - $sent >= 0 && pmNow() - $sent < 60) || $ua === '' || preg_match('/bot|crawler|spider|preview|scanner|safelinks|barracuda|mimecast|proofpoint|urldefense|google-?image|facebookexternalhit|slackbot|curl|wget|python|java\/|go-http|headless/i', $ua);
        pmLog(['t' => $bot ? 'scan' : 'click', 'to' => $to, 'l' => (string) ($S['people'][$to]['list'] ?? ''), 'link' => $h]);
    }
}
header('Location: ' . $dest, true, 302);

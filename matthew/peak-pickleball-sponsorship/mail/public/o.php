<?php
declare(strict_types=1);
/* The open image in a Peak email (2026-11-18, Matthew: "track all the analytics involved with that, clicks opens, views"): a 1x1 GIF at the
   end of the HTML part. Each load is logged as an 'open' for the person the signed link names (first open, total, last open are counted
   in lib.php). Opens are a rough count: Apple Mail loads every image when the email arrives (opens run high), Outlook and many work
   mailboxes block images until asked (opens run low). The image is the same whatever happens, so the link reveals nothing. */
require __DIR__ . '/lib.php';
header('Content-Type: image/gif'); header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0'); header('Pragma: no-cache'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
$rid = (string) ($_GET['r'] ?? ''); $sg = (string) ($_GET['s'] ?? '');
if (pmReady() && preg_match('/^[0-9a-f]{10}$/', $rid) && hash_equals(pmSig('o|' . $rid), $sg)) {
    $p = pmByRid($rid);
    if ($p) {
        $S = pmState(); $x = $S['people'][$p['to']] ?? null;
        if ($x && $x['sent']) {
            $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
            $via = preg_match('/GoogleImageProxy/i', $ua) ? 'gmail proxy' : (preg_match('/YahooMailProxy/i', $ua) ? 'yahoo proxy' : (preg_match('/Outlook|Microsoft Office/i', $ua) ? 'outlook' : ''));
            pmLog(['t' => 'open', 'to' => $p['to'], 'l' => (string) $x['list'], 'via' => $via]);
        }
    }
}
echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

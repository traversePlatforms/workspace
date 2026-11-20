<?php
declare(strict_types=1);
/* traverseplatforms.com/m/ : opens and clicks for Sixfold 365's customer emails (2026-11-18, Matthew: "I think that we also need to track the
 * analytics for the emails we send out for sixfold"); since 2026-11-20 every automatic email on this host (Matthew: "I want to track everything
 * we can data is key"; the senders use api/mailtrack-lib.php). Source traverse/app/mailtrack/index.php; it goes up as public_html/m/index.php.
 *   ?o=<id>      the 1x1 image at the end of an email's HTML: logs an 'open', always answers the same image
 *   ?c=<id>.<n>  a link in an email: logs a 'click' (or a mail scanner's 'scan'), then forwards at once to address n of that email
 * <id> is the send's own random id (20 hex; nothing about the customer in it). The addresses are only the ones that email really carried, kept
 * by rounds.php (a365SendTracked) in sixfold-data/rounds/mail-sends.log, so nothing else can be forwarded to (no open redirect). Unknown or
 * broken ids: the image still answers, a link answers 404 with a plain page. Events go to mail-events.log beside it: time, id, kind, link
 * number, and for opens which mail app's image proxy fetched it. Never an address, a name or an IP. Standalone on purpose: it does not load
 * the app, so a pay link forwards even while the app is busy. Scanners (the rule the Prospect Desk and Peak use): within 60 seconds of the
 * send, no browser name, a known scanner or script, or a HEAD request. */
header('X-Robots-Tag: noindex, nofollow'); header('Referrer-Policy: no-referrer'); header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0'); header('Pragma: no-cache');
$ROOT = dirname(__DIR__, 2);
/* where sends are noted (2026-11-20, every automatic email, api/mailtrack-lib.php): Sixfold's log first (its customer emails since 18 Nov, and its
   internal emails), then Traverse's own (traverse-shared/mailtrack: demo bookings, sign-up, notes to Matthew, the post calendar), then any client
   install's data folder that has a sends log (<id>-data/rounds: its customer care emails and end-of-day report). Each event is written beside
   the send it belongs to. */
function mtStores(string $ROOT): array {
    $o = [$ROOT . '/sixfold-data/rounds', $ROOT . '/traverse-shared/mailtrack'];
    foreach (glob($ROOT . '/*-data/rounds/mail-sends.log') ?: [] as $f) { $d = dirname($f); if (!in_array($d, $o, true)) $o[] = $d; }
    return $o;
}
/** [the store, the send row] for an id, or [null, null] */
function mtFind(string $ROOT, string $id): array { foreach (mtStores($ROOT) as $d) if ($s = mtSend($d, $id)) return [$d, $s]; return [null, null]; }
/** the send row for an id, or null */
function mtSend(string $D, string $id): ?array {
    $fh = @fopen($D . '/mail-sends.log', 'r'); if (!$fh) return null; $o = null; $needle = '"id":"' . $id . '"';
    while (($l = fgets($fh)) !== false) { if (!str_contains($l, $needle)) continue; $r = json_decode($l, true); if (is_array($r) && ($r['t'] ?? '') === 'send' && ($r['id'] ?? '') === $id) { $o = $r; break; } }
    fclose($fh); return $o;
}
function mtLog(string $D, array $row): void { @file_put_contents($D . '/mail-events.log', json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX); }
$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
$o = $_GET['o'] ?? null; $c = $_GET['c'] ?? null;
if (is_string($o)) {
    if (preg_match('/^[0-9a-f]{20}$/D', $o) && ([$D, $s] = mtFind($ROOT, $o)) && $s) {
        $via = preg_match('/GoogleImageProxy/i', $ua) ? 'gmail' : (preg_match('/YahooMailProxy/i', $ua) ? 'yahoo' : (preg_match('/Outlook|Microsoft Office|ms-office/i', $ua) ? 'outlook' : ''));
        mtLog($D, ['t' => 'open', 'id' => $o, 'k' => (string) ($s['k'] ?? ''), 'at' => time()] + (isset($s['src']) ? ['src' => (string) $s['src']] : []) + ($via !== '' ? ['via' => $via] : []));
    }
    header('Content-Type: image/gif');
    echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    exit;
}
$found = null;
if (is_string($c) && preg_match('/^([0-9a-f]{20})\.(\d{1,3})$/D', $c, $m) && ([$D, $s] = mtFind($ROOT, $m[1])) && $s) {
    $found = $D; $n = (int) $m[2]; $u = (string) (((array) ($s['links'] ?? []))[$n] ?? '');
    if (preg_match('#^https://[^\s<>"\'\\\\]{4,1500}$#iD', $u)) {
        $head = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD'; $age = time() - (int) ($s['at'] ?? 0);
        $bot = $head || $ua === '' || ($age >= 0 && $age < 60)
            || preg_match('/bot|crawler|spider|preview|scanner|safelinks|barracuda|mimecast|proofpoint|urldefense|google-?image|facebookexternalhit|slackbot|curl|wget|python|java\/|go-http|headless/i', $ua);
        mtLog($D, ['t' => $bot ? 'scan' : 'click', 'id' => $m[1], 'k' => (string) ($s['k'] ?? ''), 'n' => $n, 'at' => time()] + (isset($s['src']) ? ['src' => (string) $s['src']] : []));
        header('Location: ' . $u, true, 302);
        exit;
    }
}
http_response_code(404); header('Content-Type: text/html; charset=utf-8');
/* a link of one of the other senders' emails with a bad number: a plain page that names no business (never Sixfold's on a Traverse email) */
if ($found !== null && $found !== $ROOT . '/sixfold-data/rounds') {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link not found</title></head>'
       . '<body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#0f1b2d"><div style="max-width:520px;margin:40px auto;padding:0 18px">'
       . '<p>This link is not complete. Please use the link in your email again, or reply to that email and we will help.</p></div></body></html>';
    exit;
}
echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link not found</title></head>'
   . '<body style="margin:0;background:#fdf8ee;font-family:Arial,Helvetica,sans-serif;color:#1d2a1c"><div style="max-width:520px;margin:40px auto;padding:0 18px">'
   . '<div style="font-size:20px;font-weight:800;color:#21451f;margin-bottom:14px">Sixfold 365</div><p>This link is not complete. Please use the link in your email again, or reply to that email and we will help.</p>'
   . '<p><a href="https://365aeration.com/" style="color:#2e5e2c">365aeration.com</a></p></div></body></html>';

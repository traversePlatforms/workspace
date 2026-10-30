<?php
declare(strict_types=1);
/* 365aeration.com's relay to the app (2026-10-14).
 * The quote form and the customer quote page used to send straight from the visitor's browser to traverseplatforms.com. SiteGround's
 * bot check on that server stopped some of those requests ("Failed to fetch" in a real browser), and the visitor saw an error or
 * nothing at all. Now the browser talks only to this site, and this file passes the request on, server to server, with a key and
 * the visitor's address (so the app's per-address limits still count visitors, not this server).
 * Settings live above public_html in a365-private/relay.php:  <?php return ['key' => '<64 hex>', 'app' => '<optional app URL>'];
 * Only the actions the site uses are passed on. Nothing is stored here. */
$action = (string) ($_GET['action'] ?? '');
/* the Zelle QR code for the signing page's "Ways to pay" (2026-10-30): the app's public image, passed through as it is (PNG or JPG only) */
if ($action === 'zelleqr' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $cfgFile = dirname(__DIR__, 2) . '/a365-private/relay.php'; $cfg = is_readable($cfgFile) ? (array) (require $cfgFile) : [];
    $app = (string) ($cfg['app'] ?? 'https://traverseplatforms.com/api/rounds.php'); $v = preg_match('/^[0-9a-f]{12}$/', (string) ($_GET['v'] ?? '')) ? (string) $_GET['v'] : '';
    $c = function_exists('curl_init') ? curl_init($app . '?action=zelleqr&v=' . $v) : null;
    if ($c) { curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTPHEADER => ['X-Site-Key: ' . (string) ($cfg['key'] ?? ''), 'X-Client-IP: ' . (string) ($_SERVER['REMOTE_ADDR'] ?? ''), 'Origin: https://365aeration.com']]); $img = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); $ct = (string) curl_getinfo($c, CURLINFO_CONTENT_TYPE); curl_close($c); } else { $img = false; $code = 0; $ct = ''; }
    if (!is_string($img) || $code !== 200 || !in_array($ct, ['image/png', 'image/jpeg'], true)) { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); exit('No QR code.'); }
    header('Content-Type: ' . $ct); header('X-Content-Type-Options: nosniff'); header("Content-Security-Policy: default-src 'none'; sandbox"); header('Cache-Control: ' . ($v !== '' ? 'public, max-age=31536000, immutable' : 'no-cache'));
    echo $img; exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$ok = ['a365lead' => 'POST', 'a365quote' => 'GET', 'a365accept' => 'POST', 'a365sign' => 'GET', 'a365signed' => 'POST', 'a365savecard' => 'POST'];   /* + saving the card for the balance (2026-10-15) */   /* + the one-page form (2026-10-14) */
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!isset($ok[$action]) || $ok[$action] !== $method) { http_response_code(404); echo '{"ok":false,"error":"Not here."}'; exit; }
$cfgFile = dirname(__DIR__, 2) . '/a365-private/relay.php';
$cfg = is_readable($cfgFile) ? (array) (require $cfgFile) : [];
$key = (string) ($cfg['key'] ?? '');
$app = (string) ($cfg['app'] ?? 'https://traverseplatforms.com/api/rounds.php');
if (strlen($key) < 32 || !function_exists('curl_init')) { http_response_code(503); echo '{"ok":false,"error":"Something went wrong on our side. Please call or text us at (720) 830-4553."}'; exit; }
$q = ['action' => $action]; if ($action === 'a365quote') $q['q'] = (string) ($_GET['q'] ?? ''); if ($action === 'a365sign') { $q['s'] = (string) ($_GET['s'] ?? ''); if (!empty($_GET['staff'])) $q['staff'] = '1'; }   /* opened from the app: not counted as the customer opening it (2026-10-15) */
$c = curl_init($app . '?' . http_build_query($q));
$opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Site-Key: ' . $key, 'X-Client-IP: ' . (string) ($_SERVER['REMOTE_ADDR'] ?? ''), 'X-Client-UA: ' . substr(str_replace(["\r", "\n"], ' ', (string) ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 200), 'Origin: https://365aeration.com']];
if ($method === 'POST') { $opt[CURLOPT_POST] = true; $opt[CURLOPT_POSTFIELDS] = substr((string) file_get_contents('php://input'), 0, 20000); }
curl_setopt_array($c, $opt);
$body = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
$j = is_string($body) ? json_decode($body, true) : null;
if (!is_array($j)) { http_response_code(502); echo '{"ok":false,"error":"We could not reach our system just now. Please try again, or call or text us at (720) 830-4553."}'; exit; }
http_response_code($code >= 200 && $code < 600 ? $code : 502);
echo json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

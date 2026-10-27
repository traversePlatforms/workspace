<?php
/* Connect Square: the address Square sends a company back to after it allows Traverse's Square app (2026-10-27, TR-33).
 * One file for every install on this server: the app's company admin taps Connect Square (rounds action squareoauth), which leaves a
 * one-time code in that install's private folder (square-oauth-state.json) and sends them to Square with state "<private folder>.<code>".
 * Here: the code is checked against that folder's file (an hour at most, used once), Square's answer is swapped for the company's access
 * token with Traverse's app id and secret (traverse-shared/square-app.json, made when Traverse's Square developer app exists), the first
 * active location is read, and the install's square.json is written (token, refresh, expiry, location): the same file the app already
 * reads for deposit links and payments. Then back to the app's Company screen. Nothing here ever prints a token.
 * Register this address in the Square app's OAuth settings: https://traverseplatforms.com/api/square-oauth.php */
declare(strict_types=1);
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$ROOT = dirname(__DIR__, 2);
function back(string $to, string $msg): void {
    if ($to === '') { http_response_code(400); header('Content-Type: text/plain; charset=utf-8'); echo $msg; exit; }
    header('Location: ' . $to . '?square=' . rawurlencode($msg)); exit;
}
$state = (string) ($_GET['state'] ?? '');
if (!preg_match('/^([a-z0-9-]{3,40}-private)\.([0-9a-f]{32})$/D', $state, $m)) back('', 'This link does not look right. Start again from Connect Square in the app.');
$dir = $ROOT . '/' . $m[1]; $sf = $dir . '/square-oauth-state.json';
$st = is_file($sf) ? json_decode((string) file_get_contents($sf), true) : null;
if (!is_array($st) || !hash_equals((string) ($st['nonce'] ?? ''), $m[2]) || (int) ($st['at'] ?? 0) < time() - 3600) back('', 'This Connect Square link has run out. Start again from Connect Square in the app.');
@unlink($sf);   /* used once */
$backTo = preg_match('#^https://[a-z0-9.-]+(:\d+)?/[a-z0-9-]+/$#D', (string) ($st['back'] ?? '')) ? (string) $st['back'] : '';
if (!empty($_GET['error'])) back($backTo, 'not-allowed');
$code = (string) ($_GET['code'] ?? ''); if (!preg_match('/^[A-Za-z0-9_-]{10,200}$/D', $code)) back($backTo, 'no-code');
$app = json_decode((string) @file_get_contents($ROOT . '/traverse-shared/square-app.json'), true);
if (!is_array($app) || empty($app['app_id']) || empty($app['secret'])) back($backTo, 'not-ready');
function sq(string $method, string $path, ?array $body, string $token = ''): array {
    $h = curl_init('https://connect.squareup.com' . $path);
    $hd = ['Content-Type: application/json', 'Square-Version: 2025-01-23']; if ($token !== '') $hd[] = 'Authorization: Bearer ' . $token;
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $hd]);
    if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($h); curl_close($h);
    return is_string($raw) ? (json_decode($raw, true) ?: []) : [];
}
$t = sq('POST', '/oauth2/token', ['client_id' => $app['app_id'], 'client_secret' => $app['secret'], 'code' => $code, 'grant_type' => 'authorization_code']);
if (empty($t['access_token'])) { error_log('square-oauth: token exchange failed for ' . $m[1]); back($backTo, 'failed'); }
$locs = sq('GET', '/v2/locations', null, (string) $t['access_token'])['locations'] ?? [];
$loc = null; foreach ($locs as $x) if (($x['status'] ?? 'ACTIVE') === 'ACTIVE') { $loc = $x; break; }
if (!$loc) back($backTo, 'no-location');
$j = ['token' => (string) $t['access_token'], 'refresh' => (string) ($t['refresh_token'] ?? ''), 'expires' => (int) strtotime((string) ($t['expires_at'] ?? '+30 days')),
      'merchant' => (string) ($t['merchant_id'] ?? ''), 'location' => (string) $loc['id'], 'locName' => mb_substr((string) ($loc['name'] ?? ''), 0, 60), 'env' => 'production',
      'oauth' => true, 'how' => 'connected', 'by' => (string) ($st['by'] ?? ''), 'at' => time()];
$tmp = $dir . '/square.json.tmp' . bin2hex(random_bytes(3));
if (file_put_contents($tmp, json_encode($j, JSON_UNESCAPED_SLASHES)) === false || !rename($tmp, $dir . '/square.json')) back($backTo, 'not-saved');
@chmod($dir . '/square.json', 0600);
back($backTo, 'connected');

<?php
declare(strict_types=1);
/* QR scan counts for the app's stats page (2026-10-21). Answers only a request carrying the key the relay already shares with the app
   (a365-private/relay.php); everyone else gets a 404. Time + piece only, as go.php writes them; no IP, no cookie. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$cfg = @include dirname(__DIR__, 2) . '/a365-private/relay.php';
$key = is_array($cfg) ? (string) ($cfg['key'] ?? '') : '';
$sent = (string) ($_SERVER['HTTP_X_SITE_KEY'] ?? '');
if (strlen($key) < 32 || !hash_equals($key, $sent)) { http_response_code(404); echo '{"ok":false}'; exit; }
$f = dirname(__DIR__, 2) . '/scan-log/scans.csv';
$out = []; $week = time() - 7 * 86400;
foreach (is_file($f) ? (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) : [] as $ln) {
    $p = explode(',', $ln); if (count($p) < 2) continue;
    $t = strtotime($p[0]); $k = preg_replace('/[^a-z]/', '', $p[1]); if (!$t || $k === '') continue;
    $out[$k] = $out[$k] ?? ['total' => 0, 'week' => 0, 'last' => 0];
    $out[$k]['total']++; if ($t >= $week) $out[$k]['week']++; if ($t > $out[$k]['last']) $out[$k]['last'] = $t;
}
echo json_encode(['ok' => true, 'pieces' => $out, 'at' => time()]);

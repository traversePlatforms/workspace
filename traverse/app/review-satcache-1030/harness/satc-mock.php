<?php
/* a stand-in Planetary Computer for satcache-test.mjs (php -S 127.0.0.1:8847 satc-mock.php). Flags are files in $D:
   regdown (register answers 500), down (tiles answer 500), expired.txt (ids that answer 410). Every call goes in calls.log. */
$D = getenv('SATC_MOCK_DIR') ?: __DIR__ . '/satc-mock';
@mkdir($D, 0777, true);
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$p = preg_replace('#^/api/data/v1#', '', $p);
file_put_contents("$D/calls.log", $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI'] . "\n", FILE_APPEND);
$png = function (string $seed) { header('Content-Type: image/png'); mt_srand(crc32($seed)); $b = "\x89PNG\r\n\x1a\n" . $seed . '|'; while (strlen($b) < 200000) $b .= pack('N', mt_rand()); echo $b; };
if ($p === '/mosaic/register') {
    if (is_file("$D/regdown")) { http_response_code(500); echo '{}'; return; }
    $n = (int) @file_get_contents("$D/regcount") + 1; file_put_contents("$D/regcount", (string) $n);
    header('Content-Type: application/json');
    echo json_encode(['id' => 'pc1.' . (time() + 86400) . '.' . str_pad(dechex($n), 32, '0', STR_PAD_LEFT)]);
    return;
}
if (preg_match('#^/mosaic/([^/]+)/tiles/WebMercatorQuad/(\d+)/(\d+)/(\d+)$#', $p, $m)) {
    if (is_file("$D/down")) { http_response_code(500); echo 'down'; return; }
    $exp = is_file("$D/expired.txt") ? file("$D/expired.txt", FILE_IGNORE_NEW_LINES) : [];
    if (in_array($m[1], $exp, true)) { http_response_code(410); header('Content-Type: application/json'); echo '{"error":"Search ID is no longer available; register a new search."}'; return; }
    if ($m[4] === '49999') { http_response_code(404); header('Content-Type: application/json'); echo '{"error":{"code":"ResourceNotFound"}}'; return; }
    $png("m/$m[2]/$m[3]/$m[4]");
    return;
}
if (preg_match('#^/item/tiles/WebMercatorQuad/(\d+)/(\d+)/(\d+)@1x$#', $p, $m)) {
    if (is_file("$D/down")) { http_response_code(500); echo 'down'; return; }
    $png('i/' . ($_GET['item'] ?? '') . "/$m[1]/$m[2]/$m[3]");
    return;
}
http_response_code(404); echo 'mock: no route ' . $p;

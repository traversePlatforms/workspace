<?php
declare(strict_types=1);
/* Peak website mock: private viewer (2026-11-23). Same pattern as /stats-54b859/: a small PHP gate in public_html, everything else
 * outside it. Lives at public_html/peak-site-mock-<hex>/index.php; .htaccess sends every request in the folder here.
 *
 *   ~/www/traverseplatforms.com/peak-site-mock-private/        0700
 *       config.php   0600  ['code_hash' => sha256('pm|' . code)]   written on the server from ~/.ssh/peak-mock-code.txt, never in git
 *       site/              the mock's files (html, css, js, img, fonts), uploaded from matthew/clients/peak-pickleball/website-mock/
 *       data/        0700  sessions.json, attempts.json
 *
 * Signed in: serves site/<path> with no-store and noindex headers. Not signed in: the sign-in form only. 10 wrong codes per IP per 15 min. */

$P = getenv('PM_PRIVATE') ?: dirname(__DIR__, 2) . '/peak-site-mock-private';
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow, noarchive'); header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer'); header('X-Frame-Options: SAMEORIGIN');
$cfg = is_readable("$P/config.php") ? (array) (require "$P/config.php") : [];
$hash = (string) ($cfg['code_hash'] ?? '');
if (strlen($hash) !== 64) { http_response_code(503); exit('Not set up.'); }
$D = "$P/data"; if (!is_dir($D)) @mkdir($D, 0700, true);
$base = '/' . trim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/';
$ck = 'pm_s';

function pmPut(string $f, string $s): void { $t = $f . '.tmp' . bin2hex(random_bytes(3)); file_put_contents($t, $s); @chmod($t, 0600); rename($t, $f); }
function pmJson(string $f): array { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : []; }
function pmSessions(string $D): array { $now = time(); return array_filter(pmJson("$D/sessions.json"), fn($e) => (int) $e > $now); }
function pmAttempts(string $D, string $ip, bool $fail): bool {
    $fp = fopen("$D/att.lock", 'c'); if ($fp) flock($fp, LOCK_EX);
    $j = pmJson("$D/attempts.json"); $b = intdiv(time(), 900); if (($j['b'] ?? null) !== $b) $j = ['b' => $b, 'c' => []];
    $k = substr(hash('sha256', 'pm|' . $ip), 0, 16); $n = (int) ($j['c'][$k] ?? 0);
    if ($fail) { $j['c'][$k] = $n + 1; pmPut("$D/attempts.json", json_encode($j)); }
    if ($fp) { flock($fp, LOCK_UN); fclose($fp); }
    return $n < 10;
}

$tok = (string) ($_COOKIE[$ck] ?? '');
$signed = $tok !== '' && preg_match('/^[0-9a-f]{64}$/', $tok) && isset(pmSessions($D)[hash('sha256', $tok)]);
$msg = '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST' && isset($_POST['out'])) {
    $s = pmSessions($D); unset($s[hash('sha256', $tok)]); pmPut("$D/sessions.json", json_encode($s));
    setcookie($ck, '', ['expires' => 1, 'path' => $base, 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    header('Location: ' . $base, true, 303); exit;
}
if (!$signed && $method === 'POST') {
    $code = trim((string) ($_POST['code'] ?? ''));
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if (!pmAttempts($D, $ip, false)) $msg = 'Too many tries. Wait 15 minutes.';
    elseif ($code !== '' && hash_equals($hash, hash('sha256', 'pm|' . $code))) {
        $t = bin2hex(random_bytes(32)); $s = pmSessions($D); $s[hash('sha256', $t)] = time() + 86400 * 30; pmPut("$D/sessions.json", json_encode($s));
        setcookie($ck, $t, ['expires' => time() + 86400 * 30, 'path' => $base, 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
        header('Location: ' . $base, true, 303); exit;
    } else { pmAttempts($D, $ip, true); $msg = 'That code did not work.'; }
}

if (!$signed) {
    http_response_code($msg ? 401 : 200);
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'");
    $m = $msg ? '<p class="err" role="alert">' . htmlspecialchars($msg, ENT_QUOTES) . '</p>' : '';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow,noarchive"><title>Private preview</title><style>'
        . 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F5F7;font:16px/1.5 Arial,Helvetica,sans-serif;color:#231F20}'
        . 'main{background:#fff;border:1px solid #dfe5ea;border-radius:14px;padding:32px;width:min(360px,90vw);box-shadow:0 8px 24px rgba(31,61,103,.08)}'
        . 'h1{font-size:1.3rem;color:#1F3D67;margin:0 0 6px}p{margin:0 0 18px;color:#5D6670}label{display:block;font-weight:600}'
        . 'input{display:block;width:100%;box-sizing:border-box;margin:6px 0 16px;padding:12px;font:inherit;border:1.5px solid #BAC1C7;border-radius:10px}'
        . 'button{width:100%;min-height:48px;border:0;border-radius:999px;background:#1F3D67;color:#fff;font:700 1rem Arial,sans-serif;cursor:pointer}'
        . '.err{color:#a3001b;font-weight:600}</style></head><body><main><h1>Private preview</h1><p>Enter the sign-in code you were given.</p>' . $m
        . '<form method="post" autocomplete="off"><label>Sign-in code<input name="code" type="password" autofocus required></label><button>Open</button></form></main></body></html>';
    exit;
}

// Signed in: serve the requested file from site/
$uri = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$rel = substr($uri, strlen($base)); if ($rel === false || $rel === '') $rel = 'index.html';
if (str_ends_with($rel, '/')) $rel .= 'index.html';
$root = realpath("$P/site");
$f = realpath("$root/$rel");
if ($f === false || !str_starts_with($f, $root . '/') || !is_file($f)) { http_response_code(404); header('Content-Type: text/plain'); exit('Not found'); }
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'webp' => 'image/webp',
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'svg' => 'image/svg+xml', 'woff2' => 'font/woff2', 'pdf' => 'application/pdf'];
$ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
if (!isset($types[$ext])) { http_response_code(404); exit; }
header('Content-Type: ' . $types[$ext]);
if ($ext !== 'html') header('Cache-Control: private, max-age=3600'); // assets: cached in this browser only
header('Content-Length: ' . filesize($f));
readfile($f);

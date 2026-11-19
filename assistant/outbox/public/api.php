<?php
declare(strict_types=1);
/* Outbox's API (index.php). Everything needs the sign-in code except signin itself. A POST must carry X-OB: 1 (a form from another site
   cannot set it). The Traverse section is read only. The Sixfold section is read only except for the WORDS of its four customer emails
   (sxwords, sxpreview, sxsave, sxrestore, 2026-11-18), which the Sixfold app itself checks, keeps in versions and logs; nothing here turns an
   email on or off or changes who gets it. The Peak section's controls are the Peak sender's own API (peak/api.php), which takes this sign-in. */
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff'); header('X-Robots-Tag: noindex');
function out(array $a): never { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function fail(string $m, int $code = 400, array $more = []): never { http_response_code($code); out(['ok' => false, 'error' => $m] + $more); }
if (!obReady()) fail('Outbox is not set up on the server.', 500);

$action = (string) ($_GET['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
if ($isPost && ($_SERVER['HTTP_X_OB'] ?? '') !== '1') fail('Bad request.');
$https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
$now = obNow(); $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

/* ---- sign-in: ten wrong tries in 15 minutes from one place, or 50 in an hour anywhere, pause it ---- */
if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $tries = obJ('tries.json', []); $mine = array_values(array_filter((array) ($tries[$ip] ?? []), fn($t) => $t > $now - 900));
    $all = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $all += count($tries[$k]); }
    if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
    if ($all >= 50) fail('Sign-in is paused for a while after too many wrong codes.', 429);
    $code = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
    $hash = trim((string) @file_get_contents(obData() . '/code.hash'));
    if ($hash === '' || strlen($code) < 10 || !password_verify($code, $hash)) { $mine[] = $now; $tries[$ip] = $mine; obW('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = obJ('sessions.json', []);
    foreach ($ses as $k => $s) if ((int) ($s['last'] ?? 0) < $now - 365 * OB_DAY) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['at' => $now, 'last' => $now]; obW('sessions.json', $ses);
    setcookie(obCookie(), $tok, ['expires' => $now + 365 * OB_DAY, 'path' => OB_PATH . '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
    out(['ok' => true]);
}
if (!obSignedIn()) fail('Sign in first.', 401, ['signin' => true]);
if ($action === 'signout') {
    $ses = obJ('sessions.json', []); unset($ses[hash('sha256', (string) $_COOKIE[obCookie()])]); obW('sessions.json', $ses);
    setcookie(obCookie(), '', ['expires' => 1, 'path' => OB_PATH . '/']); out(['ok' => true]);
}
if ($action === 'state') out(obView());
/* the words of Sixfold's customer emails (2026-11-18): Outbox asks the Sixfold app, which checks, keeps and uses them (rounds.php a365words*).
   Only here, with Matthew's sign-in. A save or a put-back changes what Jen's customers get from the next email on, and the app logs who did it. */
if ($action === 'sxwords') out(obApp('a365words'));
if (in_array($action, ['sxpreview', 'sxsave', 'sxrestore'], true)) {
    if (!$isPost) fail('POST required', 405);
    $kind = (string) ($body['kind'] ?? ''); if (!in_array($kind, OB_SX_EDITABLE, true)) fail('Which email?');
    $send = ['kind' => $kind, 'by' => 'Matthew (Outbox)'];
    if ($action === 'sxpreview') $r = obApp('a365wordspreview', $send + ['lines' => (array) ($body['lines'] ?? []), 'sample' => (string) ($body['sample'] ?? 'a')]);
    elseif ($action === 'sxsave') $r = obApp('a365wordssave', $send + ['lines' => (array) ($body['lines'] ?? []), 'note' => (string) ($body['note'] ?? '')]);
    else $r = obApp('a365wordsrestore', $send + ['v' => (string) ($body['v'] ?? '')]);
    if (empty($r['ok'])) { http_response_code(400); out(['ok' => false, 'error' => (string) ($r['error'] ?? 'That did not work.')] + (isset($r['errors']) ? ['errors' => $r['errors']] : [])); }
    out($r);
}
/* which redirect Microsoft returns to after Connect Microsoft: the old registered address, or Outbox's own once Matthew has added it in Entra */
if ($action === 'peakreturn') {
    if (!$isPost) fail('POST required', 405);
    $to = (string) ($body['to'] ?? ''); if (!in_array($to, ['old', 'outbox'], true)) fail('Old or outbox?');
    $s = obSettings(); $s['peakReturn'] = $to; $s['peakReturnAt'] = $now; if (!obW('settings.json', $s)) fail('Could not save.', 500);
    out(['ok' => true, 'redirect' => obPeakRedirect()]);
}
fail('Unknown action.', 404);

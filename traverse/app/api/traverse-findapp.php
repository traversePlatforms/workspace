<?php
declare(strict_types=1);
/**
 * Find my app (2026-10-30, Matthew: the "forgot your app's link" form, automated). A person types their email on the website; if that address
 * signs in to a Traverse install (an admin's or an invited person's email), that install's sign-in link is emailed to THAT address. Nothing
 * else: the link only ever goes to the address on file, so nobody can get someone else's link.
 *
 *   POST  {email, hp, t}   hp: the hidden field (filled = a bot), t: milliseconds on the page
 *     200 {ok, said}       for every well-formed request, matched or not, a bot or not, over the per-email limit or not: the same words
 *     400 {ok:false}       only a malformed address (that says nothing about any account)
 *     429 {ok:false}       too many requests from this address (per IP, the demo page's limiter)
 *     405                  anything but POST
 *
 * NO ENUMERATION: the screen never says whether an address has an account. The answer is sent BEFORE the lookup and the email (the connection
 * is closed, as traverse-start.php's startAnswerThen), so even the time it takes is the same either way. Per-email limits (3 an hour, 6 a day)
 * quietly send nothing; they never change the answer.
 *
 * Where it looks: the five editions (traverse-shared/client-templates/<edition>/edition.json names each one's folders) and every live client
 * install in the registry; never Sixfold. In each: rounds-codes.php (its people and session key) and rounds-accounts.json; an address counts only
 * for an account that is still on (the codes file's people less "off", plus the people added in the app): its password sign-in ("login") or a
 * pending invite ("inv"). Sign-in codes are read to work out account ids and are never printed, logged or sent.
 * Log: traverse-shared/clients/findapp.log, one line per request; the address itself only when it matched (a stranger's typing is kept as a hash).
 * TRAV_MAIL_MOCK (a file path, tests) writes the email there instead of sending it (tcMail).
 */
require_once dirname(__DIR__) . '/demo/_lib.php';
require_once __DIR__ . '/traverse-clients-lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

const FA_SAID = "If that email has a Traverse account, we've sent the link to it.";
const FA_MIN_MS = 1500;                 /* a person takes longer than this to type an address */
const FA_EMAIL_HOUR = 3, FA_EMAIL_DAY = 6;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') { header('Allow: POST'); fail('POST required', 405); }
rate_limit(10, 'findapp');
$body = (array) (json_decode((string) file_get_contents('php://input'), true) ?: []);
$em = strtolower(trim((string) ($body['email'] ?? '')));
if ($em === '' || strlen($em) > 160 || !filter_var($em, FILTER_VALIDATE_EMAIL)) fail('That email address does not look right.');
$hash = substr(hash('sha256', $em), 0, 16);
$why = '';
if (trim((string) ($body['hp'] ?? '')) !== '') $why = 'honeypot';
elseif ((int) ($body['t'] ?? 0) < FA_MIN_MS) $why = 'fast';
elseif (!faEmailTake($hash)) $why = 'email-limit';

/* the answer first, the same for everyone; the work after it */
$txt = (string) json_encode(['ok' => true, 'said' => FA_SAID], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
ignore_user_abort(true); @set_time_limit(120);
header('Content-Length: ' . strlen($txt)); header('Connection: close');
echo $txt;
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { @ob_flush(); flush(); }

$row = ['at' => time(), 'ip' => client_ip(), 'email' => $hash];
if ($why !== '') { faLog($row + ['did' => 'nothing', 'why' => $why]); exit; }
$hits = faFind($em);
if (!$hits) { faLog($row + ['matched' => 0]); exit; }
$ok = tcMail($em, 'Your Traverse sign-in link', faText($hits));
faLog($row + ['address' => $em, 'matched' => count($hits), 'installs' => array_column($hits, 'key'), 'sent' => $ok]);
exit;

/** one more request for this address, if it is under 3 an hour and 6 a day (kept as a hash) */
function faEmailTake(string $hash): bool {
    $f = tcDir() . '/findapp-rate.json'; $now = time();
    $fp = @fopen($f, 'c+'); if (!$fp) return false;
    flock($fp, LOCK_EX);
    $j = json_decode((string) stream_get_contents($fp), true); if (!is_array($j)) $j = [];
    foreach ($j as $k => $ts) { $j[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 86400)); if (!$j[$k]) unset($j[$k]); }
    $mine = $j[$hash] ?? [];
    $hour = count(array_filter($mine, fn($t) => $t > $now - 3600));
    $go = $hour < FA_EMAIL_HOUR && count($mine) < FA_EMAIL_DAY;
    if ($go) { $mine[] = $now; $j[$hash] = $mine; ftruncate($fp, 0); rewind($fp); fwrite($fp, (string) json_encode($j)); fflush($fp); }
    flock($fp, LOCK_UN); fclose($fp);
    return $go;
}
function faLog(array $row): void { @file_put_contents(tcDir() . '/findapp.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }

/** every install to look in: [key, name, url, priv, data] */
function faInstalls(): array {
    $S = tcSettings(); $o = [];
    foreach (array_keys(TC_EDITIONS) as $ed) {
        $e = tcJson(tcTplDir($ed) . '/edition.json');
        if (empty($e['priv']) || empty($e['folder']) || $e['priv'] === 'sixfold-private') continue;
        $co = tcJson(tcSite() . '/' . ($e['data'] ?? '') . '/rounds/company.json');
        $url = (string) ($co['appUrl'] ?? '') ?: rtrim($S['app_base'], '/') . '/' . $e['folder'] . '/';
        $o[] = ['key' => $ed, 'name' => (string) ($e['name'] ?? $ed), 'url' => $url, 'priv' => (string) $e['priv'], 'data' => (string) ($e['data'] ?? '')];
    }
    foreach (tcReg() as $cid => $c) {
        if (($c['status'] ?? '') !== 'live' || empty($c['priv']) || empty($c['url'])) continue;
        $o[] = ['key' => (string) $cid, 'name' => (string) ($c['name'] ?? ''), 'url' => (string) $c['url'], 'priv' => (string) $c['priv'], 'data' => (string) ($c['data'] ?? '')];
    }
    return $o;
}
/** the installs where this address belongs to an account that is still on: [key, name, url] */
function faFind(string $em): array {
    $hits = [];
    foreach (faInstalls() as $in) {
        $priv = tcSite() . '/' . $in['priv'];
        if (!is_readable($priv . '/rounds-codes.php')) continue;
        $cfg = (function ($f) { return require $f; })($priv . '/rounds-codes.php');
        if (!is_array($cfg) || empty($cfg['session_key'])) continue;
        $key = (string) $cfg['session_key']; $acct = tcJson($priv . '/rounds-accounts.json');
        $on = [];
        foreach ((array) ($cfg['people'] ?? []) as $code => $who) $on[substr(hash_hmac('sha256', 'code|' . $code, $key), 0, 20)] = true;
        foreach ((array) ($acct['off'] ?? []) as $id => $x) unset($on[(string) $id]);
        foreach ((array) ($acct['people'] ?? []) as $code => $who) $on[substr(hash_hmac('sha256', 'code|' . $code, $key), 0, 20)] = true;
        unset($cfg);
        $found = false;
        foreach (['login', 'inv'] as $k) foreach ((array) ($acct[$k] ?? []) as $id => $x)
            if (isset($on[(string) $id]) && is_array($x) && strtolower(trim((string) ($x['email'] ?? ''))) === $em) $found = true;
        if (!$found) continue;
        $name = (string) (tcJson(tcSite() . '/' . $in['data'] . '/rounds/company-local.json')['name'] ?? '')
            ?: (string) (tcJson(tcSite() . '/' . $in['data'] . '/rounds/company.json')['name'] ?? '') ?: $in['name'];
        $hits[] = ['key' => $in['key'], 'name' => $name, 'url' => $in['url']];
    }
    return $hits;
}
function faText(array $hits): string {
    $one = count($hits) === 1;
    $list = implode("\n\n", array_map(fn($h) => $h['name'] . ":\n" . $h['url'], $hits));
    return "Hi,\n\nYou asked for your Traverse sign-in link. " . ($one ? 'Here it is:' : 'This email address is on more than one company\'s app:') . "\n\n" . $list . "\n\n"
        . "Sign in with this email address and your password. Forgot it? Tap Forgot password on the sign-in screen. "
        . "Invited but haven't set a password yet? Use the link in your invite email, or ask your admin to send it again. "
        . "Save the link to your phone's home screen so it opens like any other app.\n\n"
        . "If you didn't ask for this, you can ignore this email.\n\nTraverse Platforms\n";
}

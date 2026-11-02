<?php
declare(strict_types=1);
/**
 * Sign in with Google / Sign in with Microsoft for Setup › Email (2026-10-30, Matthew: a client company connects its own mailbox with one click
 * instead of an app password). Not a page: opened directly it answers 404. Used by every install's rounds.php (the editions and the client
 * installs: public_html/api/<install>-rounds.php all sit beside this file) and by api/mail-oauth.php, the one address Google and Microsoft send
 * an admin back to for every install on this server.
 *
 * ---- THE PATH ---------------------------------------------------------------------------------------------------------------------------
 *   1. Setup › Email, an admin taps Sign in with Google (rounds action mailoauth). moStart() leaves a one-time record in the install's private
 *      folder (<private>/mail-oauth-state.json: a nonce, the PKCE verifier, the admin, where to come back to, a hash of a cookie only this
 *      browser holds) and sends them to Google with a signed state: base64url({i: private folder, n: nonce, p: provider, t: time}) . "." .
 *      HMAC-SHA256 of it under the server's mail-OAuth key. Ten minutes at most, used once.
 *   2. Google (or Microsoft) asks them to allow "send email as you" and sends them to api/mail-oauth.php?code=..&state=.. . moCallback():
 *      the signature, the age, the install's own record (the nonce must match and is claimed by a rename, so a second use finds nothing) and
 *      the browser cookie are all checked before anything else; then the code is swapped for tokens (with the PKCE verifier), the scope they
 *      really granted is checked (Google lets people untick it), and the account's address is read (openid userinfo / Graph /me).
 *   3. The refresh token is kept ENCRYPTED in that install's private folder, <private>/mail-oauth.json (AES-256-GCM; the key is derived from
 *      traverse-shared/mail-oauth.key and the install's folder name, which is also the authenticated data, so a file copied to another install
 *      does not open there). Never in the data folder, never in a backup (the backups list their files by name; this is not one of them),
 *      never sent to the page. An app password saved before (mail.json) is removed: the newest way wins.
 *   4. Back to the app: <page>/?mailoauth=connected&as=<address>; the page opens Setup › Email ("Connected as ...").
 *   Sending (rounds.php sendMail): the same MIME message smtpSend writes (mailMime), through Gmail API users.messages.send or Microsoft Graph
 *   /me/sendMail (MIME, base64), with an access token renewed from the refresh token as needed (under a lock; Microsoft's new refresh token
 *   replaces the old). invalid_grant (access removed, password changed, or a Testing-mode Google grant past its 7 days): the connection is
 *   marked "needs reconnect", Setup › Email says so, and the install behaves as not connected (see rounds.php mailOwnCfg) until an admin
 *   signs in again. Disconnect revokes the token at Google; Microsoft has no per-app revoke for a refresh token, so the token is deleted here
 *   and the admin is shown where to remove Traverse from their Microsoft account.
 *
 * ---- ON THE SERVER (never in git, never in public_html) ---------------------------------------------------------------------------------
 *   traverse-shared/mail-oauth.json  {"google": {"client_id": "...", "client_secret": "..."}, "microsoft": {"client_id": "...", "client_secret": "..."}}
 *                                    (chmod 600; Google's downloaded {"web": {...}} is accepted for the google entry; a provider left out is off)
 *   traverse-shared/mail-oauth.key   64 hex characters (32 random bytes), chmod 600. Made once and never changed: a new key makes every saved
 *                                    connection unreadable (each then shows "needs reconnect").
 *   Redirect URI registered with both: https://traverseplatforms.com/api/mail-oauth.php
 * Tests (the PHP test server only): TRAV_MAILOAUTH_MOCK=http://127.0.0.1:<port> sends every Google and Microsoft call to a local stand-in.
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const MO_PROV = [
    'google' => ['label' => 'Google', 'scope' => 'openid email https://www.googleapis.com/auth/gmail.send', 'need' => 'gmail.send',
                 'auth' => 'https://accounts.google.com/o/oauth2/v2/auth', 'token' => 'https://oauth2.googleapis.com/token',
                 'who' => 'https://openidconnect.googleapis.com/v1/userinfo', 'send' => 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                 'revoke' => 'https://oauth2.googleapis.com/revoke'],
    'microsoft' => ['label' => 'Microsoft', 'scope' => 'openid email offline_access User.Read Mail.Send', 'need' => 'mail.send',
                    'auth' => 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', 'token' => 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
                    'who' => 'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', 'send' => 'https://graph.microsoft.com/v1.0/me/sendMail',
                    'revoke' => '']];
const MO_REDIRECT = 'https://traverseplatforms.com/api/mail-oauth.php';
const MO_TTL = 600;   /* the state and the one-time record: ten minutes */
/* where a Microsoft account removes Traverse's access (no API revokes one app's refresh token) */
const MO_MS_REMOVE = 'account.live.com/consent/Manage (personal Outlook or Hotmail) or myapps.microsoft.com (work or school)';

/* ---------------------------------------------------------------- where things are */
function moRoot(): string { return dirname(__DIR__, 2); }
function moShared(): string { return moRoot() . '/traverse-shared'; }
/** the test server's stand-in for Google and Microsoft, or '' (only ever on PHP's own test server, only on 127.0.0.1) */
function moMock(): string {
    $m = PHP_SAPI === 'cli-server' ? (string) getenv('TRAV_MAILOAUTH_MOCK') : '';
    return preg_match('#^http://127\.0\.0\.1:\d{2,5}$#D', $m) ? $m : '';
}
function moUrl(string $p, string $k): string {
    $m = moMock(); if ($m === '') return MO_PROV[$p][$k];
    return $m . '/' . ($p === 'google' ? 'google' : 'ms') . '/' . $k;
}
function moRedirect(): string {
    if (moMock() === '') return MO_REDIRECT;
    $h = (string) ($_SERVER['HTTP_HOST'] ?? ''); return preg_match('/^127\.0\.0\.1:\d{2,5}$/D', $h) ? 'http://' . $h . '/api/mail-oauth.php' : MO_REDIRECT;
}
/** Traverse's own app at Google and Microsoft: [provider => [id, secret]] for the ones set up */
function moApps(): array {
    static $a = null; if ($a !== null) return $a;
    $j = json_decode((string) @file_get_contents(moShared() . '/mail-oauth.json'), true); $j = is_array($j) ? $j : []; $a = [];
    foreach (array_keys(MO_PROV) as $p) {
        $x = $j[$p] ?? null; if (is_array($x) && is_array($x['web'] ?? null)) $x = $x['web'];   /* Google's downloaded file as it comes */
        if (is_array($x) && is_string($x['client_id'] ?? null) && $x['client_id'] !== '' && is_string($x['client_secret'] ?? null) && $x['client_secret'] !== '') $a[$p] = ['id' => $x['client_id'], 'secret' => $x['client_secret']];
    }
    return $a;
}
/** the server's 32-byte key, or null (no key = no way to keep a token safely = the sign-in buttons stay off) */
function moKey(): ?string {
    static $k = false; if ($k !== false) return $k;
    $h = trim((string) @file_get_contents(moShared() . '/mail-oauth.key'));
    return $k = preg_match('/^[0-9a-f]{64}$/D', $h) ? (string) hex2bin($h) : null;
}
/** which sign-ins the page may show: {google: bool, microsoft: bool} */
function moReady(): array {
    $ok = moKey() !== null && in_array('aes-256-gcm', openssl_get_cipher_methods(), true); $a = moApps(); $o = [];
    foreach (array_keys(MO_PROV) as $p) $o[$p] = $ok && isset($a[$p]);
    return $o;
}
/** an install's private folder that this flow may write to: a folder beside public_html named *-private, with sign-ins in it */
function moPrivOk(string $name): bool {
    return (bool) preg_match('/^[a-z0-9-]{3,40}-private$/D', $name) && is_file(moRoot() . '/' . $name . '/rounds-codes.php');
}
function moFile(string $priv): string { return $priv . '/mail-oauth.json'; }
function moStateFile(string $priv): string { return $priv . '/mail-oauth-state.json'; }
function moCookie(string $priv): string { return 'trav_mo_' . substr(hash('sha256', basename($priv)), 0, 10); }

/* ---------------------------------------------------------------- small pieces */
function moB64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function moUnb64(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }
function moSub(string $use, string $priv = ''): string { return hash_hmac('sha256', $use . '|' . basename($priv), (string) moKey(), true); }
function moWrite(string $f, array $j): bool {
    $tmp = $f . '.tmp' . bin2hex(random_bytes(4)); $txt = (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== strlen($txt)) { @unlink($tmp); return false; }
    @chmod($tmp, 0600); return @rename($tmp, $f);
}
function moRead(string $f): ?array { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : null; }
/** the token box, sealed to this install: 'g1.' + base64(iv . tag . ciphertext) */
function moSeal(string $priv, array $data): string {
    $iv = random_bytes(12); $tag = '';
    $ct = openssl_encrypt((string) json_encode($data), 'aes-256-gcm', moSub('mail-oauth-enc', $priv), OPENSSL_RAW_DATA, $iv, $tag, 'traverse-mail-oauth|' . basename($priv), 16);
    return 'g1.' . base64_encode($iv . $tag . $ct);
}
function moOpen(string $priv, string $box): ?array {
    if (moKey() === null || !str_starts_with($box, 'g1.')) return null;
    $raw = (string) base64_decode(substr($box, 3), true); if (strlen($raw) < 29) return null;
    $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', moSub('mail-oauth-enc', $priv), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), 'traverse-mail-oauth|' . basename($priv));
    $j = is_string($pt) ? json_decode($pt, true) : null; return is_array($j) ? $j : null;
}
/** one HTTP call to Google or Microsoft: [status, body]; never throws; 0 = no answer */
function moHttp(string $method, string $url, array $headers, ?string $body): array {
    /* the practice copy (2026-11-02, rounds.php PRACTICE): Google, Microsoft, Facebook and Jobber are never called from it */
    if (function_exists('practiceOn') && practiceOn()) { practiceLog('outside system', ['method' => $method, 'url' => (string) preg_replace('/[?#].*$/', '', $url)]); return [0, '']; }
    if (function_exists('curl_init')) {
        $h = curl_init($url);
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_FOLLOWLOCATION => false]);
        if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, $body);
        $raw = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
        return [is_string($raw) ? $code : 0, is_string($raw) ? $raw : ''];
    }
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $headers), 'content' => (string) $body, 'timeout' => 20, 'ignore_errors' => true, 'follow_location' => 0]]);
    $raw = @file_get_contents($url, false, $ctx);
    $hd = function_exists('http_get_last_response_headers') ? (array) http_get_last_response_headers() : (array) ($http_response_header ?? []);
    return [preg_match('#^HTTP/\S+ (\d{3})#', (string) ($hd[0] ?? ''), $m) ? (int) $m[1] : 0, is_string($raw) ? $raw : ''];
}
function moForm(string $url, array $f): array { [$s, $b] = moHttp('POST', $url, ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], http_build_query($f)); return [$s, json_decode($b, true) ?: []]; }
/** a line in the install's mail.log, beside its other email lines (the data folder named like the private one: x-private -> x-data/rounds) */
function moLog(string $priv, array $row): void {
    $d = defined('DATA_DIR') ? (string) DATA_DIR : moRoot() . '/' . substr(basename($priv), 0, -8) . '-data/rounds';
    if (is_dir($d)) @file_put_contents($d . '/mail.log', json_encode(['at' => time()] + $row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/* ---------------------------------------------------------------- 1. start */
/** the address to send the admin to, and the browser cookie that must come back with them; ['error'] when it cannot start */
function moStart(string $priv, string $p, string $adminId, string $by, string $back): array {
    $app = moApps()[$p] ?? null; if (!$app || empty(moReady()[$p])) return ['error' => 'not-ready'];
    if (!moPrivOk(basename($priv))) return ['error' => 'Could not start that here.'];
    $nonce = bin2hex(random_bytes(16)); $ver = moB64(random_bytes(48)); $browser = bin2hex(random_bytes(16)); $now = time();
    if (!moWrite(moStateFile($priv), ['n' => $nonce, 'p' => $p, 'v' => $ver, 'a' => $adminId, 'by' => $by, 'back' => $back, 'b' => hash('sha256', $browser), 'at' => $now])) return ['error' => 'Could not start that. Try again.'];
    $pl = moB64((string) json_encode(['i' => basename($priv), 'n' => $nonce, 'p' => $p, 't' => $now]));
    $state = $pl . '.' . moB64(hash_hmac('sha256', $pl, moSub('mail-oauth-state'), true));
    $q = ['client_id' => $app['id'], 'redirect_uri' => moRedirect(), 'response_type' => 'code', 'scope' => MO_PROV[$p]['scope'], 'state' => $state,
          'code_challenge' => moB64(hash('sha256', $ver, true)), 'code_challenge_method' => 'S256'];
    /* Google: a refresh token every time (offline + consent); Microsoft: let them pick the account */
    $q += $p === 'google' ? ['access_type' => 'offline', 'prompt' => 'consent'] : ['response_mode' => 'query', 'prompt' => 'select_account'];
    return ['url' => moUrl($p, 'auth') . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), 'cookie' => [moCookie($priv), $browser]];
}

/* ---------------------------------------------------------------- 2. the callback */
/** what api/mail-oauth.php does: ['back' => the app's page or '' (no trusted way back: plain words), 'msg' => what happened, 'as' => address, 'cookie' => name to clear] */
function moCallback(array $get, array $cookies): array {
    $bad = fn(string $say) => ['back' => '', 'msg' => $say, 'as' => '', 'cookie' => ''];
    $again = 'This sign-in link has run out or was already used. Go back to the app and press Sign in with Google (or Microsoft) again.';
    if (moKey() === null) return $bad('Email sign-in is not set up on this server yet.');
    $state = (string) ($get['state'] ?? '');
    if (!preg_match('/^([A-Za-z0-9_-]{20,400})\.([A-Za-z0-9_-]{43})$/D', $state, $m)) return $bad('This link does not look right. Start again from Setup, Email in the app.');
    if (!hash_equals(moB64(hash_hmac('sha256', $m[1], moSub('mail-oauth-state'), true)), $m[2])) return $bad('This link does not look right. Start again from Setup, Email in the app.');
    $pl = json_decode(moUnb64($m[1]), true);
    if (!is_array($pl) || !is_string($pl['i'] ?? null) || !is_string($pl['n'] ?? null) || !isset(MO_PROV[(string) ($pl['p'] ?? '')]) || !moPrivOk($pl['i'])) return $bad('This link does not look right. Start again from Setup, Email in the app.');
    $t = (int) ($pl['t'] ?? 0); if ($t < time() - MO_TTL || $t > time() + 60) return $bad($again);
    $priv = moRoot() . '/' . $pl['i']; $sf = moStateFile($priv); $p = (string) $pl['p'];
    $st = moRead($sf);
    if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n']) || ($st['p'] ?? '') !== $p) return $bad($again);
    /* used once: claimed by a rename (only one request can win it), then read again from the claimed copy */
    $claim = $sf . '.used' . bin2hex(random_bytes(4)); if (!@rename($sf, $claim)) return $bad($again);
    $st = moRead($claim); @unlink($claim);
    if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n']) || (int) ($st['at'] ?? 0) < time() - MO_TTL) return $bad($again);
    $back = (string) ($st['back'] ?? '');
    $okBack = moMock() !== '' ? '#^http://127\.0\.0\.1:\d{2,5}/[a-z0-9-]+/$#D' : '#^https://[a-z0-9.-]+/[a-z0-9-]+/$#D';
    if (!preg_match($okBack, $back)) return $bad('Signed in, but the way back to the app was lost. Open the app and try again.');
    $go = fn(string $msg, string $as = '') => ['back' => $back, 'msg' => $msg, 'as' => $as, 'cookie' => moCookie($priv)];
    /* the browser that pressed the button, and no other */
    $ck = (string) ($cookies[moCookie($priv)] ?? '');
    if ($ck === '' || !hash_equals((string) ($st['b'] ?? ''), hash('sha256', $ck))) return $go('browser');
    if (!empty($get['error'])) return $go('denied');
    $code = (string) ($get['code'] ?? ''); if (!preg_match('/^[\x21-\x7e]{8,2048}$/D', $code)) return $go('failed');
    $app = moApps()[$p] ?? null; if (!$app) return $go('not-ready');
    $f = ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'code' => $code, 'code_verifier' => (string) $st['v'], 'grant_type' => 'authorization_code', 'redirect_uri' => moRedirect()];
    if ($p === 'microsoft') $f['scope'] = MO_PROV[$p]['scope'];
    [$s, $tk] = moForm(moUrl($p, 'token'), $f);
    if (empty($tk['access_token'])) { error_log('mail-oauth: token exchange failed for ' . basename($priv) . ' (' . $p . ', ' . $s . ', ' . preg_replace('/[^a-z_]/', '', (string) ($tk['error'] ?? '')) . ')'); return $go('failed'); }
    $acc = (string) $tk['access_token']; $ref = (string) ($tk['refresh_token'] ?? '');
    /* what they really allowed: Google lets people untick "send email on your behalf" */
    if (isset($tk['scope']) && stripos((string) $tk['scope'], MO_PROV[$p]['need']) === false) { moRevoke($p, $ref !== '' ? $ref : $acc); return $go('noscope'); }
    if ($ref === '') return $go('failed');
    [$s2, $wb] = moHttp('GET', moUrl($p, 'who'), ['Authorization: Bearer ' . $acc, 'Accept: application/json'], null); $w = json_decode($wb, true) ?: [];
    $email = strtolower(trim((string) ($p === 'google' ? (!empty($w['email_verified']) ? ($w['email'] ?? '') : '') : (($w['mail'] ?? '') ?: ($w['userPrincipalName'] ?? '')))));
    if ($s2 !== 200 || strlen($email) > 120 || !filter_var($email, FILTER_VALIDATE_EMAIL)) { moRevoke($p, $ref); return $go('noemail'); }
    /* a different account than the one connected before: its grant is revoked (the same account is not: at Google that would undo the new one) */
    $old = moRead(moFile($priv));
    if ($old && (($old['email'] ?? '') !== $email || ($old['p'] ?? '') !== $p) && ($ot = moOpen($priv, (string) ($old['tok'] ?? ''))) && !empty($ot['r'])) moRevoke((string) $old['p'], (string) $ot['r']);
    $j = ['p' => $p, 'email' => $email, 'tok' => moSeal($priv, ['r' => $ref, 'a' => $acc, 'x' => time() + max(60, (int) ($tk['expires_in'] ?? 3600))]),
          'status' => 'ok', 'by' => (string) ($st['by'] ?? ''), 'admin' => (string) ($st['a'] ?? ''), 'at' => time()];
    if (!moWrite(moFile($priv), $j)) return $go('failed');
    $had = is_file($priv . '/mail.json'); if ($had) @unlink($priv . '/mail.json');   /* the app password it replaces */
    moLog($priv, ['what' => 'connected ' . $p, 'to' => $email, 'by' => (string) ($st['by'] ?? ''), 'ok' => true, 'replaced' => $had ? 'app password' : ($old ? 'sign-in' : '')]);
    return $go('connected', $email);
}

/* ---------------------------------------------------------------- 3. using it */
/** the connection as rounds.php's mailOwnCfg() shapes it, only while it works (needs reconnect = null) */
function moCfg(string $priv): ?array {
    $j = moRead(moFile($priv)); if (!$j || ($j['status'] ?? '') !== 'ok' || empty($j['email']) || !isset(MO_PROV[(string) ($j['p'] ?? '')])) return null;
    return ['oauth' => (string) $j['p'], 'kind' => (string) $j['p'], 'user' => (string) $j['email'], 'host' => '', 'port' => 0, 'pass' => '', 'by' => (string) ($j['by'] ?? ''), 'at' => (int) ($j['at'] ?? 0)];
}
/** for the Email screen: which sign-ins are offered, how it is connected, and a lost connection; never a token */
function moState(string $priv): array {
    $j = moRead(moFile($priv)); $o = ['oauth' => moReady()];
    if ($j && ($j['status'] ?? '') === 'ok') $o['via'] = (string) $j['p'];
    if ($j && ($j['status'] ?? '') === 'reconnect') $o['lost'] = ['via' => (string) $j['p'], 'user' => (string) ($j['email'] ?? ''), 'at' => (int) ($j['lost'] ?? 0)];
    return $o;
}
/** the sign-in stopped working: kept (so the screen can say who), marked, logged once */
function moLost(string $priv, string $why): void {
    $j = moRead(moFile($priv)); if (!$j || ($j['status'] ?? '') === 'reconnect') return;
    $j['status'] = 'reconnect'; $j['lost'] = time(); $j['why'] = mb_substr($why, 0, 80); moWrite(moFile($priv), $j);
    moLog($priv, ['what' => 'needs reconnect', 'via' => (string) ($j['p'] ?? ''), 'to' => (string) ($j['email'] ?? ''), 'ok' => false, 'stage' => 'reconnect', 'error' => mb_substr($why, 0, 80)]);
}
/** a working access token: ['ok' => true, 't' => token] or [ok false, stage, error]; renews under a lock when it is old or $force */
function moAccess(string $priv, bool $force = false): array {
    $no = fn(string $st, string $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    $lk = @fopen($priv . '/mail-oauth.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    try {
        $j = moRead(moFile($priv)); if (!$j || ($j['status'] ?? '') !== 'ok') return $no('config', 'Email is not connected yet (Setup, Email).');
        $p = (string) $j['p']; $lbl = MO_PROV[$p]['label'] ?? $p; $tok = moOpen($priv, (string) ($j['tok'] ?? ''));
        $lost = 'The ' . $lbl . ' sign-in for ' . $j['email'] . ' stopped working. An admin signs in again in Setup, Email.';
        if (!$tok || empty($tok['r'])) { moLost($priv, 'unreadable'); return $no('reconnect', $lost); }
        if (!$force && !empty($tok['a']) && (int) ($tok['x'] ?? 0) > time() + 60) return ['ok' => true, 't' => (string) $tok['a'], 'p' => $p];
        $app = moApps()[$p] ?? null; if (!$app) return $no('oauth-app', 'Sign in with ' . $lbl . ' is switched off on this server.');
        $f = ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'refresh_token', 'refresh_token' => (string) $tok['r']];
        if ($p === 'microsoft') $f['scope'] = MO_PROV[$p]['scope'];
        [$s, $r] = moForm(moUrl($p, 'token'), $f);
        if (empty($r['access_token'])) {
            $err = preg_replace('/[^a-z_]/', '', (string) ($r['error'] ?? ''));
            if (in_array($err, ['invalid_grant', 'interaction_required', 'consent_required'], true)) { moLost($priv, $err); return $no('reconnect', $lost); }
            return $no('oauth-token', $lbl . ' did not renew the sign-in just now (' . ($s ?: 'no answer') . ($err !== '' ? ', ' . $err : '') . '). Try again in a minute.');
        }
        $tok['a'] = (string) $r['access_token']; $tok['x'] = time() + max(60, (int) ($r['expires_in'] ?? 3600));
        if (!empty($r['refresh_token'])) $tok['r'] = (string) $r['refresh_token'];   /* Microsoft hands out a new one each time */
        $j['tok'] = moSeal($priv, $tok); moWrite(moFile($priv), $j);
        return ['ok' => true, 't' => $tok['a'], 'p' => $p];
    } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
}
/** one message (the MIME text rounds.php mailMime writes) from the connected mailbox. [ok, stage, error], as smtpSend */
function moSend(string $priv, string $mime): array {
    $a = moAccess($priv); if (!$a['ok']) return $a;
    $p = $a['p']; $lbl = MO_PROV[$p]['label'];
    for ($try = 0; $try < 2; $try++) {
        [$s, $b] = $p === 'google'
            ? moHttp('POST', moUrl($p, 'send'), ['Authorization: Bearer ' . $a['t'], 'Content-Type: application/json'], (string) json_encode(['raw' => moB64($mime)]))
            : moHttp('POST', moUrl($p, 'send'), ['Authorization: Bearer ' . $a['t'], 'Content-Type: text/plain'], base64_encode($mime));
        if ($s === 200 || $s === 202) return ['ok' => true, 'stage' => 'sent', 'error' => ''];
        if ($s === 401 && $try === 0) { $a = moAccess($priv, true); if (!$a['ok']) return $a; continue; }
        break;
    }
    $e = json_decode($b, true); $why = mb_substr(trim((string) (is_array($e['error'] ?? null) ? ($e['error']['message'] ?? '') : ($e['error'] ?? ''))), 0, 160);
    if ($s === 403 && preg_match('/insufficient|scope|permission/i', $why . ' ' . $b)) { moLost($priv, 'no send permission'); return ['ok' => false, 'stage' => 'reconnect', 'error' => 'The ' . $lbl . ' sign-in no longer allows sending email. An admin signs in again in Setup, Email.']; }
    if ($s === 429) return ['ok' => false, 'stage' => 'oauth-send', 'error' => $lbl . ' says this mailbox has sent too many emails for now. Try again later.'];
    return ['ok' => false, 'stage' => 'oauth-send', 'error' => $lbl . ' did not take the email (' . ($s ?: 'no answer') . ($why !== '' ? ': ' . $why : '') . ').'];
}
/** revoke a token at Google (Microsoft has no such call); true when Google said yes */
function moRevoke(string $p, string $token): bool {
    if ($p !== 'google' || $token === '') return false;
    return moHttp('POST', moUrl($p, 'revoke'), ['Content-Type: application/x-www-form-urlencoded'], http_build_query(['token' => $token]))[0] === 200;
}
/** disconnect: revoked at Google, deleted here. ['was' => provider|'', 'revoked' => bool, 'note' => what the admin still does (Microsoft)] */
function moDisconnect(string $priv, string $by, string $why = 'disconnected'): array {
    $j = moRead(moFile($priv)); @unlink(moStateFile($priv)); if (!$j) return ['was' => '', 'revoked' => false, 'note' => ''];
    $p = (string) ($j['p'] ?? ''); $tok = moOpen($priv, (string) ($j['tok'] ?? ''));
    $rv = $tok && !empty($tok['r']) ? moRevoke($p, (string) $tok['r']) : false;
    @unlink(moFile($priv));
    moLog($priv, ['what' => $why . ' ' . $p, 'to' => (string) ($j['email'] ?? ''), 'by' => $by, 'ok' => true, 'revoked' => $rv]);
    return ['was' => $p, 'revoked' => $rv, 'note' => $p === 'microsoft' ? 'To remove Traverse from the Microsoft account too: ' . MO_MS_REMOVE . '.' : ''];
}

/* ---------------------------------------------------------------- the app's action (rounds.php, Setup › Email) */
/** mailoauth POST admin {provider: google|microsoft}: the address to send them to ({ready: false} when that sign-in is not set up here) */
function moAction(): never {
    global $isPost, $body, $me, $session;
    if (!kitOn()) fail('Not here.', 404);   /* Sixfold 365 keeps its own mailbox */
    if (!adminOr('set.setup')) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $p = (string) ($body['provider'] ?? ''); if (!isset(MO_PROV[$p])) fail('Google or Microsoft?');
    if (empty(moReady()[$p])) out(['ok' => true, 'ready' => false]);
    if (!throttleTake(rateFile('mailoauth|' . (string) ($session['c'] ?? $me)), 20, 3600)) fail('That is a lot of tries in an hour. Wait a little and try again.', 429);
    $r = moStart(pushPrivDir(), $p, (string) ($session['c'] ?? ''), (string) $me, kitBase());
    if (isset($r['error'])) { if ($r['error'] === 'not-ready') out(['ok' => true, 'ready' => false]); fail($r['error'], 500); }
    $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
    setcookie($r['cookie'][0], $r['cookie'][1], ['expires' => time() + MO_TTL, 'path' => '/api/mail-oauth.php', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
    out(['ok' => true, 'ready' => true, 'url' => $r['url']]);
}

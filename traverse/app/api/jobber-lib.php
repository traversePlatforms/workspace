<?php
declare(strict_types=1);
/**
 * Jobber for Sync from another system (TR-46, 2026-10-31, Matthew: "and tr46"). The editions and the client installs (impOn()); never Sixfold
 * 365. Not a page: opened directly it answers 404. Loaded by every install's rounds.php (public_html/api/<install>-rounds.php sits beside this
 * file), by api/jobber-oauth.php (the one address Jobber sends a company's admin back to, for every install on this server) and by
 * api/jobber-hook.php (Jobber's APP_DISCONNECT webhook).
 *
 * Jobber has no API keys: a company's Jobber admin connects an app Traverse registers in Jobber's Developer Center (OAuth 2.0, the
 * authorization code grant, with PKCE), and the app reads Jobber's GraphQL API. Built from Jobber's own developer docs (developer.getjobber.com,
 * read 2026-10-31: App Authorization, Refresh Token Rotation, API Versioning, API Rate Limits, Setting up Webhooks, Custom Integrations, App
 * Review Process) and the field names of Jobber's published GraphQL schema (GetJobber/Jobber-AppTemplate-RailsAPI db/schema.json, Jobber's own
 * repository), checked against the changelog's breaking changes up to 2026-09-25 (none touch the fields read here).
 * API version: X-JOBBER-GRAPHQL-VERSION 2025-04-16 (the version Jobber's own docs use in every example; supported at least 12 months from its
 * release, readable up to 18; Jobber warns in the answer's extensions.versioning as its end nears, and that warning is logged). Change it in
 * traverse-shared/jobber-app.json ("version") without touching code.
 *
 * ---- THE PATH ---------------------------------------------------------------------------------------------------------------------------
 *   1. Setup › Sync from another system › Jobber › Connect Jobber (rounds action jobberoauth, admins or a role given cust.sync). jbStart()
 *      leaves a one-time record in the install's private folder (<private>/jobber-oauth-state.json: a nonce, the PKCE verifier, the admin,
 *      the way back, a hash of a cookie only this browser holds) and sends them to https://api.getjobber.com/api/oauth/authorize with a signed
 *      state: base64url({i: private folder, n: nonce, t: time}) . "." . HMAC-SHA256 under a key derived from traverse-shared/mail-oauth.key.
 *      Ten minutes at most, used once (Jobber's authorization codes also last ten minutes and work once).
 *   2. The admin allows access on Jobber's screen (the scopes are set on the app in the Developer Center, not in the address) and Jobber sends
 *      them to api/jobber-oauth.php?code=..&state=.. . jbCallback(): signature, age, the install's own record (claimed by a rename, so a second
 *      use finds nothing) and the browser cookie first; then the code is swapped at /api/oauth/token (client secret + PKCE verifier) for an
 *      access token (60 minutes) and a refresh token, and the account is read (query { account { id name } }) so the connection names it.
 *   3. Both tokens are kept SEALED in that install's private folder, <private>/jobber.json (AES-256-GCM, a key derived from
 *      traverse-shared/mail-oauth.key and the install's folder name, which is also the authenticated data). Never in the data folder, never in
 *      a backup, never sent to the page. traverse-shared/jobber-accounts.json lists which install each Jobber account is connected to (for the
 *      disconnect webhook): Jobber's account id and the install's folder name only.
 *   4. Back to the app: <page>/?jobber=connected; the page opens Setup › Sync from another system. The admin turns Jobber on (off by default,
 *      as every source is) and picks who new leads go to.
 *   READING (the 5-minute job, traverse-tools/crm-sync.php --pull, and Sync now): jbPull() asks for clients, requests, quotes and jobs changed
 *   since the last read, 50 to a page, carrying the page cursor to the next run when a first read is long; read-only: the only mutation this
 *   file ever sends is appDisconnect, when the admin disconnects. Everything goes through the Import's engine (rounds.php syncApply: link ids,
 *   fingerprints, a lead moved here is not moved back, nothing deleted).
 *   TOKENS: an access token older than 55 minutes is renewed with the refresh token under a lock; Jobber's Refresh Token Rotation (on by
 *   default, required to publish) hands back a new refresh token every time, and it is saved before anything else is asked. A 401 renews once
 *   and asks again. A refused refresh (the admin disconnected the app in Jobber, the account churned, the client secret was regenerated, or the
 *   app was authorized again elsewhere) marks the connection "needs connecting again"; the run fails, and after an hour of failures the sync's
 *   own rule pauses Jobber and tells the admins (rounds.php syncNote).
 *   DISCONNECT (the app's Disconnect): appDisconnect is sent so Jobber shows it disconnected and drops the tokens, then the file is deleted.
 *   Jobber's own Disconnect fires APP_DISCONNECT at api/jobber-hook.php (checked with X-Jobber-Hmac-SHA256), which marks the install's
 *   connection disconnected and forgets its tokens.
 *
 * ---- ON THE SERVER (never in git, never in public_html) ---------------------------------------------------------------------------------
 *   traverse-shared/jobber-app.json  {"client_id": "...", "client_secret": "...", "version": "2025-04-16"}  chmod 600. Without it, Jobber
 *                                    stays listed as coming soon on the screen, exactly as before.
 *   traverse-shared/mail-oauth.key   the key the mail sign-in already uses (32 bytes, hex); its use here is separated by its own label.
 *   Redirect (OAuth Callback URL in the Developer Center): https://traverseplatforms.com/api/jobber-oauth.php
 *   Webhook (APP_DISCONNECT, needed for App Review only): https://traverseplatforms.com/api/jobber-hook.php
 *   The steps for Matthew: traverse/ops/jobber-app-setup.md.
 * Tests: TRAV_JOBBER_MOCK=http://127.0.0.1:<port> sends the authorize page, the token endpoint and GraphQL to a local stand-in (PHP's test
 * server and the command line only, and only to 127.0.0.1).
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
if (is_file(__DIR__ . '/mail-oauth-lib.php')) require_once __DIR__ . '/mail-oauth-lib.php';   /* moKey, moHttp, moB64: the shared pieces */

const JB_AUTH = 'https://api.getjobber.com/api/oauth/authorize';
const JB_TOKEN = 'https://api.getjobber.com/api/oauth/token';
const JB_GQL = 'https://api.getjobber.com/api/graphql';
const JB_REDIRECT = 'https://traverseplatforms.com/api/jobber-oauth.php';
const JB_VERSION = '2025-04-16';
const JB_TTL = 600;
const JB_PAGE = 50;   /* records a page: small enough for Jobber's query cost (10,000 points, 500 back a second), large enough for a first read */

/* ---------------------------------------------------------------- where things are */
function jbRoot(): string { return dirname(__DIR__, 2); }
function jbMock(): string {
    $m = in_array(PHP_SAPI, ['cli-server', 'cli'], true) ? (string) getenv('TRAV_JOBBER_MOCK') : '';
    return preg_match('#^http://127\.0\.0\.1:\d{2,5}$#D', $m) ? $m : '';
}
/** Traverse's Jobber app, or null: [id, secret, version] */
function jbApp(): ?array {
    static $a = false; if ($a !== false) return $a;
    $j = json_decode((string) @file_get_contents(jbRoot() . '/traverse-shared/jobber-app.json'), true); $a = null;
    if (is_array($j) && is_string($j['client_id'] ?? null) && preg_match('/^[A-Za-z0-9._-]{8,200}$/D', $j['client_id']) && is_string($j['client_secret'] ?? null) && preg_match('/^[\x21-\x7e]{8,400}$/D', $j['client_secret']))
        $a = ['id' => $j['client_id'], 'secret' => $j['client_secret'], 'version' => preg_match('/^\d{4}-\d{2}-\d{2}$/D', (string) ($j['version'] ?? '')) ? (string) $j['version'] : JB_VERSION];
    return $a;
}
/** a key to seal tokens with, or null (then nothing connects) */
function jbKey(): ?string {
    if (!function_exists('moKey') || moKey() === null || !in_array('aes-256-gcm', openssl_get_cipher_methods(), true)) return null;
    return hash_hmac('sha256', 'traverse-jobber', (string) moKey(), true);
}
/** the app is registered (its file is on the server) and tokens can be kept safely: the screen offers Connect Jobber */
function jbReady(): bool { return jbApp() !== null && jbKey() !== null; }
function jbUrl(string $k): string { $m = jbMock(); if ($m !== '') return $m . ['auth' => '/oauth/authorize', 'token' => '/oauth/token', 'gql' => '/graphql'][$k]; return ['auth' => JB_AUTH, 'token' => JB_TOKEN, 'gql' => JB_GQL][$k]; }
function jbRedirect(): string {
    if (jbMock() === '') return JB_REDIRECT;
    $h = (string) ($_SERVER['HTTP_HOST'] ?? ''); return preg_match('/^127\.0\.0\.1:\d{2,5}$/D', $h) ? 'http://' . $h . '/api/jobber-oauth.php' : JB_REDIRECT;
}
function jbPrivOk(string $name): bool { return (bool) preg_match('/^[a-z0-9-]{3,40}-private$/D', $name) && is_file(jbRoot() . '/' . $name . '/rounds-codes.php'); }
function jbFile(string $priv): string { return $priv . '/jobber.json'; }
function jbOauthFile(string $priv): string { return $priv . '/jobber-oauth-state.json'; }
function jbCookie(string $priv): string { return 'trav_jb_' . substr(hash('sha256', basename($priv)), 0, 10); }
function jbAccountsFile(): string { return jbRoot() . '/traverse-shared/jobber-accounts.json'; }

/* ---------------------------------------------------------------- small pieces */
function jbRead(string $f): ?array { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : null; }
function jbWrite(string $f, array $j): bool {
    $tmp = $f . '.tmp' . bin2hex(random_bytes(4)); $txt = (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== strlen($txt)) { @unlink($tmp); return false; }
    @chmod($tmp, 0600); return @rename($tmp, $f);
}
function jbSeal(string $priv, array $data): string {
    $iv = random_bytes(12); $tag = '';
    $ct = openssl_encrypt((string) json_encode($data), 'aes-256-gcm', hash_hmac('sha256', 'enc|' . basename($priv), (string) jbKey(), true), OPENSSL_RAW_DATA, $iv, $tag, 'traverse-jobber|' . basename($priv), 16);
    return 'j1.' . base64_encode($iv . $tag . $ct);
}
function jbOpen(string $priv, string $box): ?array {
    if (jbKey() === null || !str_starts_with($box, 'j1.')) return null;
    $raw = (string) base64_decode(substr($box, 3), true); if (strlen($raw) < 29) return null;
    $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', hash_hmac('sha256', 'enc|' . basename($priv), (string) jbKey(), true), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), 'traverse-jobber|' . basename($priv));
    $j = is_string($pt) ? json_decode($pt, true) : null; return is_array($j) ? $j : null;
}
function jbB64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function jbUnb64(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }
function jbStateKey(): string { return hash_hmac('sha256', 'state', (string) jbKey(), true); }
/** the token endpoint: [status, decoded body]; never throws */
function jbForm(array $f): array {
    [$s, $b] = function_exists('moHttp') ? moHttp('POST', jbUrl('token'), ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], http_build_query($f)) : [0, ''];
    $j = json_decode($b, true); return [$s, is_array($j) ? $j : []];
}
/** the account index for the disconnect webhook: Jobber account id -> the install folders connected to it */
function jbIndex(callable $fn): void {
    $f = jbAccountsFile(); if (!is_dir(dirname($f))) return;
    $lk = @fopen($f . '.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    $all = jbRead($f) ?? []; $all = $fn($all); jbWrite($f, $all);
    if ($lk) { flock($lk, LOCK_UN); fclose($lk); }
}

/* ---------------------------------------------------------------- 1. start (Connect Jobber) */
function jbStart(string $priv, string $adminId, string $by, string $back): array {
    $app = jbApp(); if (!$app || jbKey() === null) return ['error' => 'not-ready'];
    if (!jbPrivOk(basename($priv))) return ['error' => 'Could not start that here.'];
    $nonce = bin2hex(random_bytes(16)); $ver = jbB64(random_bytes(48)); $browser = bin2hex(random_bytes(16)); $now = time();
    if (!jbWrite(jbOauthFile($priv), ['n' => $nonce, 'v' => $ver, 'a' => $adminId, 'by' => $by, 'back' => $back, 'b' => hash('sha256', $browser), 'at' => $now])) return ['error' => 'Could not start that. Try again.'];
    $pl = jbB64((string) json_encode(['i' => basename($priv), 'n' => $nonce, 't' => $now]));
    $state = $pl . '.' . jbB64(hash_hmac('sha256', $pl, jbStateKey(), true));
    $q = ['response_type' => 'code', 'client_id' => $app['id'], 'redirect_uri' => jbRedirect(), 'state' => $state, 'code_challenge' => jbB64(hash('sha256', $ver, true)), 'code_challenge_method' => 'S256'];
    return ['url' => jbUrl('auth') . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), 'cookie' => [jbCookie($priv), $browser]];
}

/* ---------------------------------------------------------------- 2. the callback (api/jobber-oauth.php) */
/** ['back' => the app's page or '' (no trusted way back: plain words), 'msg' => what happened, 'cookie' => name to clear] */
function jbCallback(array $get, array $cookies): array {
    $bad = fn(string $say) => ['back' => '', 'msg' => $say, 'cookie' => ''];
    $again = 'This Jobber link has run out or was already used. Go back to the app and press Connect Jobber again.';
    $wrong = 'This link does not look right. Start again from Setup, Sync from another system in the app.';
    if (!jbReady()) return $bad('Jobber is not set up on this server yet.');
    $state = (string) ($get['state'] ?? '');
    /* no state: the Connect button on Jobber's App Marketplace (Jobber sends neither state nor PKCE from there): the app is not listed there */
    if ($state === '') return $bad('Connect Jobber from inside the app: Setup, Sync from another system, Jobber.');
    if (!preg_match('/^([A-Za-z0-9_-]{20,400})\.([A-Za-z0-9_-]{43})$/D', $state, $m) || !hash_equals(jbB64(hash_hmac('sha256', $m[1], jbStateKey(), true)), $m[2])) return $bad($wrong);
    $pl = json_decode(jbUnb64($m[1]), true);
    if (!is_array($pl) || !is_string($pl['i'] ?? null) || !is_string($pl['n'] ?? null) || !jbPrivOk($pl['i'])) return $bad($wrong);
    $t = (int) ($pl['t'] ?? 0); if ($t < time() - JB_TTL || $t > time() + 60) return $bad($again);
    $priv = jbRoot() . '/' . $pl['i']; $sf = jbOauthFile($priv);
    $st = jbRead($sf); if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n'])) return $bad($again);
    $claim = $sf . '.used' . bin2hex(random_bytes(4)); if (!@rename($sf, $claim)) return $bad($again);   /* used once */
    $st = jbRead($claim); @unlink($claim);
    if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n']) || (int) ($st['at'] ?? 0) < time() - JB_TTL) return $bad($again);
    $back = (string) ($st['back'] ?? '');
    $okBack = jbMock() !== '' ? '#^http://127\.0\.0\.1:\d{2,5}/[a-z0-9-]+/$#D' : '#^https://[a-z0-9.-]+/[a-z0-9-]+/$#D';
    if (!preg_match($okBack, $back)) return $bad('Connected, but the way back to the app was lost. Open the app and try again.');
    $go = fn(string $msg) => ['back' => $back, 'msg' => $msg, 'cookie' => jbCookie($priv)];
    $ck = (string) ($cookies[jbCookie($priv)] ?? '');
    if ($ck === '' || !hash_equals((string) ($st['b'] ?? ''), hash('sha256', $ck))) return $go('browser');
    if (!empty($get['error'])) return $go('denied');
    $code = (string) ($get['code'] ?? ''); if (!preg_match('/^[\x21-\x7e]{8,2048}$/D', $code)) return $go('failed');
    $app = jbApp();
    [$s, $tk] = jbForm(['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => jbRedirect(), 'code_verifier' => (string) $st['v']]);
    if (empty($tk['access_token']) || empty($tk['refresh_token'])) { error_log('jobber: code swap failed for ' . basename($priv) . ' (' . $s . ', ' . preg_replace('/[^a-z_]/', '', (string) ($tk['error'] ?? '')) . ')'); return $go('failed'); }
    $tok = ['a' => (string) $tk['access_token'], 'r' => (string) $tk['refresh_token'], 'x' => time() + max(60, (int) ($tk['expires_in'] ?? 3600))];
    [$acc, $err] = jbAsk($tok['a'], 'query Account { account { id name } }', [], $app);
    $aid = (string) ($acc['account']['id'] ?? '');
    if ($err !== '' || $aid === '') { error_log('jobber: account read failed for ' . basename($priv) . ': ' . $err); return $go('failed'); }
    /* a different Jobber account than the one connected before: that one is told we are gone (its tokens stop working), then forgotten */
    $old = jbRead(jbFile($priv));
    if ($old && ($old['account']['id'] ?? '') !== $aid && ($ot = jbOpen($priv, (string) ($old['tok'] ?? ''))) && !empty($ot['a'])) jbAsk((string) $ot['a'], 'mutation Disconnect { appDisconnect { userErrors { message } } }', [], $app);
    $c = ['account' => ['id' => $aid, 'name' => mb_substr((string) ($acc['account']['name'] ?? ''), 0, 120)], 'tok' => jbSeal($priv, $tok), 'status' => 'ok',
          'by' => mb_substr((string) ($st['by'] ?? ''), 0, 80), 'admin' => (string) ($st['a'] ?? ''), 'at' => time()];
    if (!jbWrite(jbFile($priv), $c)) return $go('failed');
    $name = basename($priv); $oldId = (string) ($old['account']['id'] ?? '');
    jbIndex(function (array $all) use ($aid, $oldId, $name) {
        if ($oldId !== '' && $oldId !== $aid) $all[$oldId] = array_values(array_diff((array) ($all[$oldId] ?? []), [$name]));
        $all[$aid] = array_values(array_unique(array_merge((array) ($all[$aid] ?? []), [$name]))); return array_filter($all);
    });
    return $go('connected');
}

/* ---------------------------------------------------------------- 3. using it */
/** one GraphQL question with a token: [data or null, error text ('' when fine), HTTP status, the whole answer]. The error text never carries a token */
function jbAsk(string $token, string $query, array $vars, ?array $app = null): array {
    $app = $app ?? jbApp();
    $body = (string) json_encode(['query' => $query] + ($vars ? ['variables' => $vars] : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    [$s, $b] = function_exists('moHttp') ? moHttp('POST', jbUrl('gql'), ['Authorization: Bearer ' . $token, 'X-JOBBER-GRAPHQL-VERSION: ' . ($app['version'] ?? JB_VERSION), 'Content-Type: application/json', 'Accept: application/json'], $body) : [0, ''];
    $j = json_decode($b, true); $j = is_array($j) ? $j : [];
    $w = (string) ($j['extensions']['versioning']['warning'] ?? ''); if ($w !== '') error_log('jobber: ' . mb_substr($w, 0, 300));   /* the version nears its end */
    if ($s === 401) return [null, 'unauthorized', $s, $j];
    if ($s === 429) return [null, 'Jobber asked us to slow down (429). The next run tries again.', $s, $j];
    $e = (array) ($j['errors'] ?? []);
    if ($e) {
        $codes = array_map(fn($x) => (string) ($x['extensions']['code'] ?? ''), $e);
        if (in_array('THROTTLED', $codes, true)) return [null, 'Jobber asked us to slow down (its query limit). The next run carries on.', $s, $j];
        $msg = mb_substr((string) ($e[0]['message'] ?? 'error'), 0, 160);
        if (!is_array($j['data'] ?? null)) return [null, 'Jobber answered ' . ($s ?: 'nothing') . ': ' . $msg . '.', $s, $j];
    }
    if ($s !== 200 || !is_array($j['data'] ?? null)) return [null, 'Jobber answered ' . ($s ?: 'nothing') . '.', $s, $j];
    return [$j['data'], '', $s, $j];
}
/** the connection stopped working: kept (so the screen can say so), its tokens forgotten, marked */
function jbLost(string $priv, string $why): void {
    $c = jbRead(jbFile($priv)); if (!$c || ($c['status'] ?? '') === 'reconnect') return;
    $c['status'] = 'reconnect'; $c['lost'] = time(); $c['why'] = mb_substr($why, 0, 160); unset($c['tok']); jbWrite(jbFile($priv), $c);
}
/** a working access token: ['ok' => true, 't' => token] or ['ok' => false, 'err' => text]; renewed under a lock when it is old or $force */
function jbAccess(string $priv, bool $force = false, string $seen = ''): array {
    $no = fn(string $e) => ['ok' => false, 'err' => $e];
    $lk = @fopen($priv . '/jobber.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    try {
        $c = jbRead(jbFile($priv));
        if (!$c) return $no('Not connected.');
        $lost = 'Jobber needs connecting again (' . ($c['why'] ?? 'the connection stopped working') . '). An admin presses Connect Jobber in Setup, Sync from another system.';
        if (($c['status'] ?? '') !== 'ok') return $no($lost);
        $t = jbOpen($priv, (string) ($c['tok'] ?? ''));
        if (!$t || empty($t['r'])) { jbLost($priv, 'the saved connection could not be read'); return $no('Jobber needs connecting again (the saved connection could not be read).'); }
        /* another run renewed it while this one waited for the lock: use that (Jobber's rotation makes the old refresh token useless) */
        if ($force && $seen !== '' && !empty($t['a']) && !hash_equals($seen, (string) $t['a'])) $force = false;
        if (!$force && !empty($t['a']) && (int) ($t['x'] ?? 0) > time() + 300) return ['ok' => true, 't' => (string) $t['a']];
        $app = jbApp(); if (!$app) return $no('Jobber is switched off on this server.');
        [$s, $r] = jbForm(['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'refresh_token', 'refresh_token' => (string) $t['r']]);
        if (empty($r['access_token'])) {
            $err = preg_replace('/[^a-z_ ]/i', '', (string) ($r['error'] ?? ''));
            if ($s === 400 || $s === 401 || in_array($err, ['invalid_grant', 'invalid_client', 'unauthorized_client'], true)) { jbLost($priv, 'Jobber refused the saved connection'); return $no('Jobber needs connecting again (it refused the saved connection: disconnected in Jobber, or connected again elsewhere). An admin presses Connect Jobber in Setup, Sync from another system.'); }
            return $no('Jobber did not renew the connection just now (' . ($s ?: 'no answer') . '). The next run tries again.');
        }
        if (!empty($r['warning'])) error_log('jobber: ' . mb_substr((string) $r['warning'], 0, 300));
        $t['a'] = (string) $r['access_token']; $t['x'] = time() + max(60, (int) ($r['expires_in'] ?? 3600));
        if (!empty($r['refresh_token'])) $t['r'] = (string) $r['refresh_token'];   /* rotation: saved before anything else is asked */
        $c['tok'] = jbSeal($priv, $t); $c['renewed'] = time();
        if (!jbWrite(jbFile($priv), $c)) return $no('Could not save the renewed Jobber connection.');
        return ['ok' => true, 't' => $t['a']];
    } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
}
/** one question as this install: a 401 renews the token once and asks again. [data or null, error text] */
function jbGql(string $priv, string $query, array $vars = []): array {
    $a = jbAccess($priv); if (!$a['ok']) return [null, $a['err']];
    [$d, $e] = jbAsk($a['t'], $query, $vars);
    if ($e === 'unauthorized') {
        $a = jbAccess($priv, true, $a['t']); if (!$a['ok']) return [null, $a['err']];
        [$d, $e] = jbAsk($a['t'], $query, $vars);
        if ($e === 'unauthorized') { jbLost($priv, 'Jobber refused the token'); return [null, 'Jobber needs connecting again (it refused the token). An admin presses Connect Jobber in Setup, Sync from another system.']; }
    }
    return [$d, $e];
}
/** what the screen may know: never a token */
function jbState(string $priv): array {
    $c = jbRead(jbFile($priv)); $o = ['ready' => jbReady(), 'connected' => false];
    if (!$c) return $o;
    return ['connected' => ($c['status'] ?? '') === 'ok', 'ready' => $o['ready'], 'account' => (string) ($c['account']['name'] ?? ''), 'by' => (string) ($c['by'] ?? ''), 'at' => (int) ($c['at'] ?? 0),
                 'lost' => ($c['status'] ?? '') !== 'ok' ? ['at' => (int) ($c['lost'] ?? 0), 'why' => (string) ($c['why'] ?? '')] : null];
}
/** disconnect from the app: Jobber told (appDisconnect: it shows disconnected there and its tokens stop), the file deleted. ['told' => bool] */
function jbDisconnect(string $priv): array {
    $c = jbRead(jbFile($priv)); @unlink(jbOauthFile($priv)); $told = false;
    if (!$c) return ['was' => false, 'told' => false];
    if (($c['status'] ?? '') === 'ok') { [$d, $e] = jbGql($priv, 'mutation Disconnect { appDisconnect { app { name } userErrors { message } } }'); $told = $e === '' && is_array($d['appDisconnect'] ?? null) && !($d['appDisconnect']['userErrors'] ?? []); }
    @unlink(jbFile($priv));
    $aid = (string) ($c['account']['id'] ?? ''); $name = basename($priv);
    if ($aid !== '') jbIndex(function (array $all) use ($aid, $name) { $all[$aid] = array_values(array_diff((array) ($all[$aid] ?? []), [$name])); return array_filter($all); });
    return ['was' => true, 'told' => $told];
}
/** APP_DISCONNECT from Jobber (api/jobber-hook.php): every install connected to that account marks it disconnected and forgets the tokens.
    $raw: the body exactly as it came; $sig: X-Jobber-Hmac-SHA256. -> [HTTP status, what happened (no secrets)] */
function jbHook(string $raw, string $sig): array {
    $app = jbApp(); if (!$app) return [404, 'not set up'];
    if ($sig === '' || !hash_equals(base64_encode(hash_hmac('sha256', $raw, $app['secret'], true)), $sig)) return [401, 'bad signature'];
    $j = json_decode($raw, true); $ev = (array) ($j['data']['webHookEvent'] ?? []);
    $topic = (string) ($ev['topic'] ?? ''); $aid = (string) ($ev['accountId'] ?? '');
    if ($topic !== 'APP_DISCONNECT' || $aid === '') return [200, 'ignored'];
    $n = 0;
    foreach ((array) ((jbRead(jbAccountsFile()) ?? [])[$aid] ?? []) as $name) {
        if (!is_string($name) || !jbPrivOk($name)) continue;
        $priv = jbRoot() . '/' . $name; $c = jbRead(jbFile($priv));
        if ($c && ($c['account']['id'] ?? '') === $aid) { jbLost($priv, 'disconnected in Jobber'); $n++; }
    }
    jbIndex(function (array $all) use ($aid) { unset($all[$aid]); return $all; });
    return [200, 'disconnected ' . $n];
}

/* ---------------------------------------------------------------- 4. reading (rounds.php syncConnRun for 'jobber') */
/* the fields asked for, by Jobber's own names (schema: Client, ClientPhoneNumber, Email, ClientAddress, Property, PropertyAddress, Request,
   Quote, QuoteAmounts, Job) */
const JB_WHO = 'id name firstName lastName companyName isLead isCompany createdAt updatedAt phones { number primary } emails { address primary } billingAddress { street city province postalCode }';
const JB_PROP = 'property { address { street city province postalCode } }';
const JB_Q = [
    'clients' => 'query Clients($first: Int, $after: String, $filter: ClientFilterAttributes) { clients(first: $first, after: $after, filter: $filter) { nodes { ' . JB_WHO . ' } pageInfo { hasNextPage endCursor } } }',
    'requests' => 'query Requests($first: Int, $after: String, $filter: RequestFilterAttributes) { requests(first: $first, after: $after, filter: $filter) { nodes { id title contactName companyName phone email source requestStatus createdAt updatedAt client { ' . JB_WHO . ' } ' . JB_PROP . ' } pageInfo { hasNextPage endCursor } } }',
    'quotes' => 'query Quotes($first: Int, $after: String, $filter: QuoteFilterAttributes) { quotes(first: $first, after: $after, filter: $filter) { nodes { id quoteNumber title quoteStatus createdAt updatedAt amounts { total } client { ' . JB_WHO . ' } ' . JB_PROP . ' } pageInfo { hasNextPage endCursor } } }',
    /* jobs have no "updated since" filter: newest change first (sort UPDATED_AT), read until one is older than the last run */
    'jobs' => 'query Jobs($first: Int, $after: String, $sort: [JobsSortInput!]) { jobs(first: $first, after: $after, sort: $sort) { nodes { id jobNumber title jobStatus startAt endAt completedAt total createdAt updatedAt client { ' . JB_WHO . ' } ' . JB_PROP . ' } pageInfo { hasNextPage endCursor } } }',
];
/** a Jobber client (and the job's property, when there is one) in our field names */
function jbWho(array $c, ?array $prop = null): array {
    $pick = function (array $list, string $k) { $first = ''; foreach ($list as $x) { $v = trim((string) ($x[$k] ?? '')); if ($v === '') continue; if (!empty($x['primary'])) return $v; if ($first === '') $first = $v; } return $first; };
    $a = is_array($prop['address'] ?? null) ? $prop['address'] : (is_array($c['billingAddress'] ?? null) ? $c['billingAddress'] : []);
    $name = trim((string) ($c['name'] ?? '')) ?: (trim(($c['firstName'] ?? '') . ' ' . ($c['lastName'] ?? '')) ?: (string) ($c['companyName'] ?? ''));
    return ['name' => $name, 'phone' => $pick((array) ($c['phones'] ?? []), 'number'), 'email' => $pick((array) ($c['emails'] ?? []), 'address'),
            'address' => (string) ($a['street'] ?? ''), 'town' => (string) ($a['city'] ?? ''), 'zip' => (string) ($a['postalCode'] ?? '')];
}
/** clients, requests, quotes and jobs changed since the last read, in our field names: ['leads' => [...], 'customers' => [...], 'jobs' => [...], 'err' => ...].
 *  $st (kept in sync.json between runs): per kind {since: the newest updatedAt read, cur: a page cursor while a long read carries on, top}.
 *  $rec / $day: rounds.php's syncRec and syncDay (passed in so this file has no other tie to it) */
function jbPull(string $priv, array &$st, float $until, callable $rec, callable $day, string $today): array {
    $out = ['leads' => [], 'customers' => [], 'jobs' => []];
    foreach (['clients', 'requests', 'quotes', 'jobs'] as $what) {
        $s = (array) ($st[$what] ?? []); $since = (string) ($s['since'] ?? ''); $cur = isset($s['cur']) ? (string) $s['cur'] : null; $top = (string) ($s['top'] ?? ''); $done = false; $n = 0;
        while (!$done && $n < 10 && microtime(true) < $until) {
            $v = ['first' => JB_PAGE];
            if ($cur !== null && $cur !== '') $v['after'] = $cur;
            if ($what === 'jobs') $v['sort'] = [['key' => 'UPDATED_AT', 'direction' => 'DESCENDING']];
            elseif ($since !== '') $v['filter'] = ['updatedAt' => ['after' => $since]];
            [$d, $e] = jbGql($priv, JB_Q[$what], $v);
            if ($e !== '') { $st[$what] = $s; return $out + ['err' => $e]; }   /* read again from the same place next time */
            $conn = (array) ($d[$what] ?? []); $list = (array) ($conn['nodes'] ?? []); $n++;
            foreach ($list as $r) {
                if (!is_array($r)) continue;
                $ut = (string) ($r['updatedAt'] ?? ''); if ($ut !== '' && ($top === '' || strtotime($ut) > strtotime($top))) $top = $ut;
                if ($what === 'jobs' && $since !== '' && $ut !== '' && strtotime($ut) < strtotime($since)) { $done = true; break; }
                $id = (string) ($r['id'] ?? ''); if ($id === '') continue;
                $c = is_array($r['client'] ?? null) ? $r['client'] : [];
                if ($what === 'clients') {
                    $f = jbWho($r);
                    if (!empty($r['isLead'])) $out['leads'][] = $rec('jobber:c:' . $id, $f + ['date' => $r['createdAt'] ?? '', 'source' => 'Jobber']);
                    else $out['customers'][] = $rec('jobber:c:' . $id, $f + ['start' => $day($r['createdAt'] ?? '')]);
                    continue;
                }
                $prop = is_array($r['property'] ?? null) ? $r['property'] : null;
                if ($what === 'requests') {
                    $f = jbWho($c, $prop);
                    if (trim((string) ($r['contactName'] ?? '')) !== '') $f['name'] = (string) $r['contactName'];
                    if (trim((string) ($r['phone'] ?? '')) !== '') $f['phone'] = (string) $r['phone'];
                    if (trim((string) ($r['email'] ?? '')) !== '') $f['email'] = (string) $r['email'];
                    $out['leads'][] = $rec('jobber:r:' . $id, $f + ['need' => mb_substr((string) ($r['title'] ?? ''), 0, 60), 'date' => $r['createdAt'] ?? '', 'source' => trim('Jobber request' . (($r['source'] ?? '') !== '' ? ' (' . $r['source'] . ')' : '')),
                        'notes' => 'Jobber request' . (($r['requestStatus'] ?? '') !== '' ? ', ' . str_replace('_', ' ', (string) $r['requestStatus']) : '')]);
                    continue;
                }
                if ($what === 'quotes') {
                    $qs = (string) ($r['quoteStatus'] ?? ''); if ($qs === 'draft') continue;   /* not sent yet: nothing for the Pipeline */
                    $tot = is_numeric($r['amounts']['total'] ?? null) ? (float) $r['amounts']['total'] : null;
                    $f = jbWho($c, $prop);
                    $status = in_array($qs, ['approved', 'converted'], true) ? 'won' : (in_array($qs, ['awaiting_response', 'changes_requested'], true) ? 'quoted' : '');
                    $out['leads'][] = $rec('jobber:q:' . $id, $f + ['need' => mb_substr((string) ($r['title'] ?? ''), 0, 60), 'status' => $status, 'date' => $r['createdAt'] ?? '', 'source' => 'Jobber',
                        'notes' => 'Jobber quote #' . ($r['quoteNumber'] ?? '') . ($tot !== null ? ', $' . number_format($tot, 2) : '') . ($qs !== '' ? ' (' . str_replace('_', ' ', $qs) . ')' : '')]);
                    continue;
                }
                /* a job: finished ones are past work, scheduled ones the customer's next visit (rounds.php syncJobRows); not scheduled yet: nothing */
                $done0 = (string) ($r['completedAt'] ?? ''); $when = $done0 !== '' ? $done0 : (string) ($r['startAt'] ?? '');
                if ($when === '') continue;
                if ($done0 === '' && $day($when) <= $today) continue;   /* past its day and not finished: left until it is */
                $f = jbWho($c, $prop);
                $out['jobs'][] = $rec('jobber:j:' . $id, $f + ['date' => $day($when), 'price' => $done0 !== '' && is_numeric($r['total'] ?? null) ? round((float) $r['total'], 2) : '', 'status' => str_replace('_', ' ', (string) ($r['jobStatus'] ?? '')),
                    'service' => mb_substr((string) ($r['title'] ?? ''), 0, 60), 'notes' => 'Jobber job #' . ($r['jobNumber'] ?? '')]);
            }
            $more = !empty($conn['pageInfo']['hasNextPage']) && (string) ($conn['pageInfo']['endCursor'] ?? '') !== '';
            if (!$done && $more) { $cur = (string) $conn['pageInfo']['endCursor']; continue; }
            $done = true;
        }
        /* finished: the next read starts from the newest change seen; stopped by time or the page cap: carry on from the cursor next run */
        $st[$what] = $done ? ['since' => $top !== '' ? $top : ($since !== '' ? $since : gmdate('c'))] : ['since' => $since, 'cur' => (string) $cur, 'top' => $top];
    }
    return $out;
}

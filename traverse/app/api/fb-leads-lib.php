<?php
declare(strict_types=1);
/**
 * Facebook lead ads into the Pipeline, for the editions and the client installs (2026-10-30, Matthew: "FACEBOOK LEAD ADS -> PIPELINE EVERY 5
 * MINUTES"). Not a page: opened directly it answers 404. Loaded by every install's rounds.php (public_html/api/<install>-rounds.php sits beside
 * this file) and by api/fb-oauth.php, the one address Facebook sends a company's admin back to for every install on this server.
 * Sixfold 365 never uses this: it keeps its own Facebook job (rounds.php metapoll, sixfold-tools/meta-leads.php), untouched.
 *
 * ---- WHAT THE COMPANY DOES (Setup › Facebook leads, admins, or a role given "Facebook lead ads") ------------------------------------------
 *   1. Connect Facebook: Facebook Login for Business with Traverse's own Meta app (fboauth). They pick their business and Pages on Facebook's
 *      screen and allow reading their lead forms. Back at api/fb-oauth.php the code is swapped for a token (a business integration system
 *      user token, which never expires, when the app's login configuration asks for one; else a user token, swapped for a 60-day one, whose
 *      Page tokens do not expire), its permissions are checked, and the Pages it can reach are listed with their own tokens.
 *   2. Pick the Pages and which lead forms (all of a Page's forms, new ones included, or chosen ones), and match each form's questions to
 *      the lead's name, phone, email, address or notes (fbforms shows the questions; a sensible match is filled in for them).
 *   3. Who new leads go to: nobody yet (the Pipeline's New list), one person, or taking turns among chosen people; and whether that
 *      person (or, for unassigned leads, the admins and office) gets an alert. Alerts are off until they turn them on.
 *   4. Every 5 minutes (traverse-tools/fb-leads.php, run once per install by push-alerts.sh), each chosen form's leads since the last look
 *      come in: source "Meta ad" (src meta) with the ad, campaign and form names; a phone or email already in the Pipeline gets a note on
 *      that lead instead of a second lead; a Couldn't-reach lead with that phone or email comes back. "Check now" does the same at once.
 *   5. Disconnect: Traverse's permissions are removed at Facebook (DELETE /me/permissions) and every token here is deleted. The choices
 *      (Pages, forms, matching, who gets leads) stay, so connecting again picks up where it was. Leads already in the Pipeline stay: they
 *      are the company's own customers.
 *   The super admin can also connect with a token pasted from Meta Business Settings (a system user's token, or one Page's token): this is
 *   what works today, before Meta's App Review, for Pages in a business where Traverse's system user has been given the Page.
 *
 * ---- WHY POLLING AND NOT META'S WEBHOOK ------------------------------------------------------------------------------------------------
 *   The leadgen webhook needs the app Live with Advanced Access, a public endpoint checking X-Hub-Signature-256, and each Page subscribed
 *   (POST /{page}/subscribed_apps, pages_manage_metadata). Polling needs none of that, works today in Development mode for Pages Traverse's
 *   own people manage, and 5 minutes meets the brief. The webhook can be added later as a "check this install now" ping.
 *
 * ---- FILES (per install) ---------------------------------------------------------------------------------------------------------------
 *   <data>/fb-leads.json        the choices: pages {id: {name, on, all, forms {id: {name, on, map {question key: field}}}}}, assign {mode:
 *                               none|one|rr, who, pool}, alert. No token, nothing personal: in both backups.
 *   <data>/fbleads.log          what happened (connected, disconnected, a run that added leads: counts and lead ids, never people's details).
 *                               A *.log beside the door files, so both backups take it as they take every log there.
 *   <private>/fb-leads.json     the connection: tokens SEALED (AES-256-GCM, a key derived from traverse-shared/mail-oauth.key and the
 *                               install's folder name, which is also the authenticated data), the Pages it reaches, who connected and when.
 *                               Never in a backup, never sent to the page.
 *   <private>/fb-leads-state.json  the poll's place: last lead time per Page, whose turn it is, last run and its errors.
 *   <private>/fb-leads-oauth.json  the one-time sign-in record (nonce, admin, way back, browser cookie hash), ten minutes, used once.
 *
 * ---- ON THE SERVER (never in git, never in public_html) --------------------------------------------------------------------------------
 *   traverse-shared/meta-app.json  {"app_id": "...", "app_secret": "...", "config_id": "...", "graph": "https://graph.facebook.com/v23.0"}
 *                                  chmod 600. config_id = the Facebook Login for Business configuration; without it the classic scope list
 *                                  is asked for. Without the file, Connect Facebook says it is not set up yet (the token paste still works).
 *   traverse-shared/mail-oauth.key the key the mail sign-in already uses (32 bytes, hex); its use here is separated by its own label.
 *   Redirect URI to register in the Meta app (Facebook Login for Business > Settings > Valid OAuth Redirect URIs):
 *                                  https://traverseplatforms.com/api/fb-oauth.php
 * Tests: TRAV_META_MOCK=http://127.0.0.1:<port> sends every Graph call and the login dialog to a local stand-in (PHP's test server and
 * the command line only, and only to 127.0.0.1).
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
if (is_file(__DIR__ . '/mail-oauth-lib.php')) require_once __DIR__ . '/mail-oauth-lib.php';   /* moKey, moHttp, moB64: the shared pieces */

const FL_GRAPH = 'https://graph.facebook.com/v23.0';
const FL_DIALOG = 'https://www.facebook.com/v23.0/dialog/oauth';
const FL_REDIRECT = 'https://traverseplatforms.com/api/fb-oauth.php';
const FL_TTL = 600;
/* asked for when the app has no Facebook Login for Business configuration (with one, the configuration says what is asked). leads_retrieval
   and what Meta lists it as depending on; FL_NEED must come back granted or the connection is refused */
const FL_SCOPES = ['leads_retrieval', 'pages_show_list', 'pages_read_engagement', 'pages_manage_ads', 'ads_management', 'business_management'];
const FL_NEED = ['leads_retrieval', 'pages_show_list'];
/* the lead's fields a form question can fill */
const FL_FIELDS = ['name' => 'Name', 'phone' => 'Phone', 'email' => 'Email', 'address' => 'Address', 'notes' => 'Notes', 'skip' => 'Leave out'];
const FL_ACTIONS = ['fbleads', 'fbleadsset', 'fbforms', 'fboauth', 'fbleadsoff', 'fbpollnow', 'fbleadstoken', 'fbpoll'];
/* the lead fields asked for; if Meta refuses one (a field it no longer has), the run asks again with the plain ones */
const FL_LEAD_FIELDS = 'id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_id,is_organic,platform';
const FL_LEAD_FIELDS_MIN = 'id,created_time,field_data';

/* ---------------------------------------------------------------- where things are */
function flRoot(): string { return dirname(__DIR__, 2); }
function flMock(): string {
    $m = in_array(PHP_SAPI, ['cli-server', 'cli'], true) ? (string) getenv('TRAV_META_MOCK') : '';
    return preg_match('#^http://127\.0\.0\.1:\d{2,5}$#D', $m) ? $m : '';
}
/** Traverse's Meta app, or null: [id, secret, config, graph] */
function flApp(): ?array {
    static $a = false; if ($a !== false) return $a;
    $j = json_decode((string) @file_get_contents(flRoot() . '/traverse-shared/meta-app.json'), true); $a = null;
    if (is_array($j) && preg_match('/^\d{5,25}$/D', (string) ($j['app_id'] ?? '')) && is_string($j['app_secret'] ?? null) && preg_match('/^[0-9a-f]{16,64}$/iD', $j['app_secret']))
        $a = ['id' => (string) $j['app_id'], 'secret' => $j['app_secret'], 'config' => preg_match('/^\d{5,25}$/D', (string) ($j['config_id'] ?? '')) ? (string) $j['config_id'] : '',
              'graph' => preg_match('#^https://graph\.facebook\.com/v\d{1,2}\.\d$#D', (string) ($j['graph'] ?? '')) ? (string) $j['graph'] : FL_GRAPH];
    return $a;
}
function flGraph(): string { $m = flMock(); return $m !== '' ? $m . '/graph' : (flApp()['graph'] ?? FL_GRAPH); }
function flDialog(): string { $m = flMock(); if ($m !== '') return $m . '/dialog'; return preg_match('#/(v\d{1,2}\.\d)$#', flApp()['graph'] ?? FL_GRAPH, $v) ? 'https://www.facebook.com/' . $v[1] . '/dialog/oauth' : FL_DIALOG; }
function flRedirect(): string {
    if (flMock() === '') return FL_REDIRECT;
    $h = (string) ($_SERVER['HTTP_HOST'] ?? ''); return preg_match('/^127\.0\.0\.1:\d{2,5}$/D', $h) ? 'http://' . $h . '/api/fb-oauth.php' : FL_REDIRECT;
}
/** a key to seal tokens with, or null (then nothing connects) */
function flKey(): ?string {
    if (!function_exists('moKey') || moKey() === null || !in_array('aes-256-gcm', openssl_get_cipher_methods(), true)) return null;
    return hash_hmac('sha256', 'traverse-fb-leads', (string) moKey(), true);
}
function flPrivOk(string $name): bool { return (bool) preg_match('/^[a-z0-9-]{3,40}-private$/D', $name) && is_file(flRoot() . '/' . $name . '/rounds-codes.php'); }
function flConnFile(string $priv): string { return $priv . '/fb-leads.json'; }
function flStateFile(string $priv): string { return $priv . '/fb-leads-state.json'; }
function flOauthFile(string $priv): string { return $priv . '/fb-leads-oauth.json'; }
function flCookie(string $priv): string { return 'trav_fb_' . substr(hash('sha256', basename($priv)), 0, 10); }
/** the install's data folder: DATA_DIR inside its rounds.php; in the callback, named like the private one (x-private -> x-data/rounds) */
function flData(): string { return defined('DATA_DIR') ? (string) DATA_DIR : (string) ($GLOBALS['flDataDir'] ?? ''); }
function flSetFile(): string { return flData() . '/fb-leads.json'; }

/* ---------------------------------------------------------------- small pieces */
function flRead(string $f): ?array { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : null; }
function flWrite(string $f, array $j): bool {
    $tmp = $f . '.tmp' . bin2hex(random_bytes(4)); $txt = (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== strlen($txt)) { @unlink($tmp); return false; }
    @chmod($tmp, 0600); return @rename($tmp, $f);
}
function flSeal(string $priv, array $data): string {
    $iv = random_bytes(12); $tag = '';
    $ct = openssl_encrypt((string) json_encode($data), 'aes-256-gcm', hash_hmac('sha256', 'enc|' . basename($priv), (string) flKey(), true), OPENSSL_RAW_DATA, $iv, $tag, 'traverse-fb-leads|' . basename($priv), 16);
    return 'f1.' . base64_encode($iv . $tag . $ct);
}
function flOpen(string $priv, string $box): ?array {
    if (flKey() === null || !str_starts_with($box, 'f1.')) return null;
    $raw = (string) base64_decode(substr($box, 3), true); if (strlen($raw) < 29) return null;
    $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', hash_hmac('sha256', 'enc|' . basename($priv), (string) flKey(), true), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), 'traverse-fb-leads|' . basename($priv));
    $j = is_string($pt) ? json_decode($pt, true) : null; return is_array($j) ? $j : null;
}
function flB64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function flUnb64(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }
/** one Graph call: [status, decoded body]. The token goes as access_token, with appsecret_proof when it is our app's own token ($proof: a
    token pasted from Meta Business Settings may belong to another app, and a wrong proof is refused). Never throws. */
function flCall(string $method, string $path, array $q, string $token = '', bool $proof = true): array {
    if ($token !== '') { $q['access_token'] = $token; if ($proof && ($a = flApp()) && flMock() === '') $q['appsecret_proof'] = hash_hmac('sha256', $token, $a['secret']); }
    $url = (preg_match('#^https?://#', $path) ? $path : flGraph() . '/' . ltrim($path, '/')) . ($q ? (str_contains($path, '?') ? '&' : '?') . http_build_query($q) : '');
    [$s, $b] = function_exists('moHttp') ? moHttp($method, $url, ['Accept: application/json'], $method === 'GET' ? null : '') : [0, ''];
    $j = json_decode($b, true); return [$s, is_array($j) ? $j : ['error' => ['message' => 'no answer (HTTP ' . $s . ')', 'code' => 0]]];
}
/** Meta's words for an error, short, never a token */
function flErr(array $r): string {
    $e = $r['error'] ?? null; if (!is_array($e)) return '';
    return mb_substr(trim((string) preg_replace('/access_token=[^&\s]+/', 'access_token=…', (string) ($e['message'] ?? 'error'))), 0, 200);
}
/** the token no longer works: invalid, expired, the user changed their password or removed the app */
function flTokenDead(array $r): bool { $e = $r['error'] ?? null; return is_array($e) && ((int) ($e['code'] ?? 0) === 190 || (int) ($e['code'] ?? 0) === 102 || in_array((int) ($e['error_subcode'] ?? 0), [458, 459, 460, 463, 464, 467], true)); }
function flLog(array $row): void { if (flData() !== '' && is_dir(flData())) @file_put_contents(flData() . '/fbleads.log', json_encode(['id' => 'f' . date('YmdHis') . bin2hex(random_bytes(2)), 'at' => time()] + $row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }

/* ---------------------------------------------------------------- the choices */
function flSettings(): array {
    $j = flRead(flSetFile()) ?? [];
    $o = ['pages' => [], 'assign' => ['mode' => 'none', 'who' => '', 'pool' => []], 'alert' => false, 'by' => (string) ($j['by'] ?? ''), 'at' => (int) ($j['at'] ?? 0)];
    foreach ((array) ($j['pages'] ?? []) as $pid => $p) {
        if (!preg_match('/^\d{3,25}$|^p[0-9a-z]{1,20}$/D', (string) $pid) || !is_array($p)) continue;
        $forms = [];
        foreach ((array) ($p['forms'] ?? []) as $fid => $f) {
            if (!preg_match('/^\d{3,25}$|^f[0-9a-z]{1,20}$/D', (string) $fid) || !is_array($f)) continue;
            $map = []; foreach ((array) ($f['map'] ?? []) as $k => $v) if (is_string($k) && preg_match('/^[A-Za-z0-9_.:-]{1,80}$/D', $k) && isset(FL_FIELDS[(string) $v])) $map[$k] = (string) $v;
            $forms[(string) $fid] = ['name' => mb_substr((string) ($f['name'] ?? ''), 0, 120), 'on' => !empty($f['on']), 'map' => $map];
        }
        $o['pages'][(string) $pid] = ['name' => mb_substr((string) ($p['name'] ?? ''), 0, 120), 'on' => !empty($p['on']), 'all' => ($p['all'] ?? true) !== false, 'forms' => $forms];
    }
    $a = (array) ($j['assign'] ?? []);
    $o['assign'] = ['mode' => in_array($a['mode'] ?? '', ['none', 'one', 'rr'], true) ? (string) $a['mode'] : 'none', 'who' => mb_substr((string) ($a['who'] ?? ''), 0, 60),
                    'pool' => array_values(array_slice(array_filter(array_map(fn($n) => is_string($n) ? mb_substr(trim($n), 0, 60) : '', (array) ($a['pool'] ?? [])), fn($n) => $n !== ''), 0, 50))];
    $o['alert'] = !empty($j['alert']);
    return $o;
}
/** the people a lead can go to: active sign-ins, never the test ones */
function flPeople(): array {
    global $TEAM; $o = [];
    foreach ((array) ($TEAM['byName'] ?? []) as $n => $x) if (!boardHidden((string) $n) && ($x['role'] ?? '') !== 'super') $o[] = ['name' => (string) $n, 'role' => (string) ($x['role'] ?? '')];
    usort($o, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    return $o;
}

/* ---------------------------------------------------------------- the connection */
/** what the screen may know: never a token */
function flConnState(string $priv): array {
    $c = flRead(flConnFile($priv));
    $o = ['ready' => flApp() !== null && flKey() !== null, 'keyOk' => flKey() !== null, 'on' => false];
    if (!$c) return $o;
    return $o + ['on' => ($c['status'] ?? '') === 'ok', 'lost' => ($c['status'] ?? '') === 'reconnect' ? ['at' => (int) ($c['lost'] ?? 0), 'why' => (string) ($c['why'] ?? '')] : null,
        'via' => (string) ($c['via'] ?? ''), 'kind' => (string) ($c['kind'] ?? ''), 'who' => (string) ($c['user']['name'] ?? ''), 'by' => (string) ($c['by'] ?? ''), 'at' => (int) ($c['at'] ?? 0),
        'pages' => array_map(fn($p) => ['id' => (string) $p['id'], 'name' => (string) $p['name'], 'leads' => in_array('MANAGE_LEADS', (array) ($p['tasks'] ?? []), true) || in_array('ADVERTISE', (array) ($p['tasks'] ?? []), true) || !isset($p['tasks'])], (array) ($c['pages'] ?? []))];
}
/** the Pages a token reaches, with their own tokens: [[id, name, token, tasks]] or ['error' => ...] */
function flPagesOf(string $token, bool $proof = true): array {
    $out = []; $url = 'me/accounts'; $q = ['fields' => 'id,name,access_token,tasks', 'limit' => 100];
    for ($i = 0; $i < 5 && $url !== ''; $i++) {
        [, $r] = flCall('GET', $url, $q, $i === 0 ? $token : '', $proof);
        if (isset($r['error'])) return $i === 0 ? ['error' => flErr($r), 'dead' => flTokenDead($r)] : $out;
        foreach ((array) ($r['data'] ?? []) as $p) if (!empty($p['id']) && !empty($p['access_token']))
            $out[] = ['id' => (string) $p['id'], 'name' => mb_substr((string) ($p['name'] ?? ''), 0, 120), 'token' => (string) $p['access_token'], 'tasks' => array_values(array_filter((array) ($p['tasks'] ?? []), 'is_string'))];
        $url = (string) ($r['paging']['next'] ?? ''); $q = [];
    }
    return $out;
}
/** keep a connection: the tokens sealed, the Pages listed; an earlier connection's grant is removed first when it was someone else's */
function flSaveConn(string $priv, array $c, string $userTok, int $userExp, array $pages): bool {
    $toks = []; foreach ($pages as $p) $toks[$p['id']] = $p['token'];
    $c['tok'] = flSeal($priv, ['u' => $userTok, 'ux' => $userExp, 'p' => $toks]);
    $c['pages'] = array_map(fn($p) => ['id' => $p['id'], 'name' => $p['name'], 'tasks' => $p['tasks']], $pages);
    $c['status'] = 'ok'; $c['at'] = time();
    if (!flWrite(flConnFile($priv), $c)) return false;
    if (flData() === '' || !is_dir(flData())) return true;   /* no data folder found: the screen offers the Pages from the connection anyway */
    /* the Pages it reaches are offered in the choices; a Page seen for the first time starts off (they pick) unless it is the only one */
    $S = flRead(flSetFile()) ?? []; $S['pages'] = (array) ($S['pages'] ?? []);
    foreach ($pages as $p) if (!isset($S['pages'][$p['id']])) $S['pages'][$p['id']] = ['name' => $p['name'], 'on' => count($pages) === 1, 'all' => true, 'forms' => []];
    else $S['pages'][$p['id']]['name'] = $p['name'];
    return flWrite(flSetFile(), $S);
}
/** the connection stopped working: kept (so the screen can say so), marked, the admins told once */
function flLost(string $priv, string $why): void {
    global $basePeople, $acct, $sessionKey;
    $c = flRead(flConnFile($priv)); if (!$c || ($c['status'] ?? '') === 'reconnect') return;
    $c['status'] = 'reconnect'; $c['lost'] = time(); $c['why'] = mb_substr($why, 0, 160); flWrite(flConnFile($priv), $c);
    flLog(['what' => 'needs reconnect', 'why' => mb_substr($why, 0, 160)]);
    try { foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && $r['role'] === 'admin' && !boardHidden((string) $r['name']))
        feedAdd((string) $r['name'], 'Facebook leads need reconnecting', 'Facebook stopped accepting the connection, so new ad leads are not coming in. Open Setup, Facebook leads and connect again.', './?fbleads=lost', 'fbleads-lost-' . (int) $c['lost']); } catch (Throwable $e) { error_log('fb leads: ' . $e->getMessage()); }
}
/** disconnect: Traverse's permissions removed at Facebook, every token deleted here. ['revoked' => bool] */
function flDisconnect(string $priv, string $by): array {
    $c = flRead(flConnFile($priv)); @unlink(flOauthFile($priv));
    if (!$c) return ['was' => false, 'revoked' => false];
    $t = flOpen($priv, (string) ($c['tok'] ?? '')); $rv = false;
    if ($t && !empty($t['u']) && in_array($c['kind'] ?? '', ['USER', 'SYSTEM_USER'], true)) { [$s, $r] = flCall('DELETE', 'me/permissions', [], (string) $t['u'], ($c['via'] ?? '') === 'login'); $rv = $s === 200 && !empty($r['success']); }
    @unlink(flConnFile($priv)); @unlink(flStateFile($priv));
    flLog(['what' => 'disconnected', 'by' => $by, 'revoked' => $rv]);
    return ['was' => true, 'revoked' => $rv];
}

/* ---------------------------------------------------------------- 1. start (Connect Facebook) */
function flStart(string $priv, string $adminId, string $by, string $back): array {
    $app = flApp(); if (!$app || flKey() === null) return ['error' => 'not-ready'];
    if (!flPrivOk(basename($priv))) return ['error' => 'Could not start that here.'];
    $nonce = bin2hex(random_bytes(16)); $browser = bin2hex(random_bytes(16)); $now = time();
    if (!flWrite(flOauthFile($priv), ['n' => $nonce, 'a' => $adminId, 'by' => $by, 'back' => $back, 'b' => hash('sha256', $browser), 'at' => $now])) return ['error' => 'Could not start that. Try again.'];
    $pl = flB64((string) json_encode(['i' => basename($priv), 'n' => $nonce, 't' => $now]));
    $state = $pl . '.' . flB64(hash_hmac('sha256', $pl, hash_hmac('sha256', 'state', (string) flKey(), true), true));
    $q = ['client_id' => $app['id'], 'redirect_uri' => flRedirect(), 'state' => $state, 'response_type' => 'code'];
    /* Facebook Login for Business: the configuration says which token, Pages and permissions; the code, never a token in the address */
    if ($app['config'] !== '') $q += ['config_id' => $app['config'], 'override_default_response_type' => 'true'];
    else $q['scope'] = implode(',', FL_SCOPES);
    return ['url' => flDialog() . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), 'cookie' => [flCookie($priv), $browser]];
}

/* ---------------------------------------------------------------- 2. the callback (api/fb-oauth.php) */
function flCallback(array $get, array $cookies): array {
    $bad = fn(string $say) => ['back' => '', 'msg' => $say, 'n' => 0, 'cookie' => ''];
    $again = 'This Facebook link has run out or was already used. Go back to the app and press Connect Facebook again.';
    if (flKey() === null || !flApp()) return $bad('Facebook leads are not set up on this server yet.');
    $state = (string) ($get['state'] ?? '');
    if (!preg_match('/^([A-Za-z0-9_-]{20,400})\.([A-Za-z0-9_-]{43})$/D', $state, $m)) return $bad('This link does not look right. Start again from Setup, Facebook leads in the app.');
    if (!hash_equals(flB64(hash_hmac('sha256', $m[1], hash_hmac('sha256', 'state', (string) flKey(), true), true)), $m[2])) return $bad('This link does not look right. Start again from Setup, Facebook leads in the app.');
    $pl = json_decode(flUnb64($m[1]), true);
    if (!is_array($pl) || !is_string($pl['i'] ?? null) || !is_string($pl['n'] ?? null) || !flPrivOk($pl['i'])) return $bad('This link does not look right. Start again from Setup, Facebook leads in the app.');
    $t = (int) ($pl['t'] ?? 0); if ($t < time() - FL_TTL || $t > time() + 60) return $bad($again);
    $priv = flRoot() . '/' . $pl['i']; $sf = flOauthFile($priv);
    if (!defined('DATA_DIR')) $GLOBALS['flDataDir'] = flRoot() . '/' . substr($pl['i'], 0, -8) . '-data/rounds';
    $st = flRead($sf); if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n'])) return $bad($again);
    $claim = $sf . '.used' . bin2hex(random_bytes(4)); if (!@rename($sf, $claim)) return $bad($again);   /* used once */
    $st = flRead($claim); @unlink($claim);
    if (!$st || !hash_equals((string) ($st['n'] ?? ''), $pl['n']) || (int) ($st['at'] ?? 0) < time() - FL_TTL) return $bad($again);
    $back = (string) ($st['back'] ?? '');
    $okBack = flMock() !== '' ? '#^http://127\.0\.0\.1:\d{2,5}/[a-z0-9-]+/$#D' : '#^https://[a-z0-9.-]+/[a-z0-9-]+/$#D';
    if (!preg_match($okBack, $back)) return $bad('Connected, but the way back to the app was lost. Open the app and try again.');
    $go = fn(string $msg, int $n = 0) => ['back' => $back, 'msg' => $msg, 'n' => $n, 'cookie' => flCookie($priv)];
    $ck = (string) ($cookies[flCookie($priv)] ?? '');
    if ($ck === '' || !hash_equals((string) ($st['b'] ?? ''), hash('sha256', $ck))) return $go('browser');
    if (!empty($get['error']) || !empty($get['error_reason'])) return $go('denied');
    $code = (string) ($get['code'] ?? ''); if (!preg_match('/^[\x21-\x7e]{8,2048}$/D', $code)) return $go('failed');
    $app = flApp();
    [, $tk] = flCall('GET', 'oauth/access_token', ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'redirect_uri' => flRedirect(), 'code' => $code]);
    if (empty($tk['access_token'])) { error_log('fb-leads: code swap failed for ' . basename($priv) . ': ' . flErr($tk)); return $go('failed'); }
    $tok = (string) $tk['access_token'];
    /* which token this is and what was granted, asked with the app's own token */
    [, $dbg] = flCall('GET', 'debug_token', ['input_token' => $tok, 'access_token' => $app['id'] . '|' . $app['secret']]);
    $d = (array) ($dbg['data'] ?? []); $kind = strtoupper((string) ($d['type'] ?? 'USER')); $scopes = array_map('strval', (array) ($d['scopes'] ?? []));
    if (empty($d['is_valid'])) return $go('failed');
    foreach (FL_NEED as $need) if (!in_array($need, $scopes, true)) { flCall('DELETE', 'me/permissions', [], $tok); return $go('noscope'); }
    $exp = (int) ($d['expires_at'] ?? 0);
    if ($kind === 'USER' && $exp > 0 && $exp < time() + 7 * 86400) {   /* a short user token: swapped for a 60-day one, whose Page tokens never expire */
        [, $ll] = flCall('GET', 'oauth/access_token', ['grant_type' => 'fb_exchange_token', 'client_id' => $app['id'], 'client_secret' => $app['secret'], 'fb_exchange_token' => $tok]);
        if (!empty($ll['access_token'])) { $tok = (string) $ll['access_token']; $exp = time() + (int) ($ll['expires_in'] ?? 5184000); }
    }
    [, $me] = flCall('GET', 'me', ['fields' => 'id,name'], $tok);
    $pages = flPagesOf($tok);
    if (isset($pages['error'])) return $go('failed');
    if (!$pages) return $go('nopages');
    $old = flRead(flConnFile($priv));
    if ($old && ($ot = flOpen($priv, (string) ($old['tok'] ?? ''))) && !empty($ot['u']) && ($old['user']['id'] ?? '') !== (string) ($me['id'] ?? '') && in_array($old['kind'] ?? '', ['USER', 'SYSTEM_USER'], true)) flCall('DELETE', 'me/permissions', [], (string) $ot['u']);   /* a different account than before: its grant goes */
    $c = ['via' => 'login', 'kind' => $kind, 'user' => ['id' => (string) ($me['id'] ?? ''), 'name' => mb_substr((string) ($me['name'] ?? ''), 0, 80)], 'scopes' => $scopes, 'by' => (string) ($st['by'] ?? ''), 'admin' => (string) ($st['a'] ?? '')];
    if (!flSaveConn($priv, $c, $tok, $exp, $pages)) return $go('failed');
    @unlink(flStateFile($priv));
    flLog(['what' => 'connected', 'via' => 'login', 'kind' => $kind, 'pages' => count($pages), 'by' => (string) ($st['by'] ?? '')]);
    return $go('connected', count($pages));
}

/* ---------------------------------------------------------------- the super admin's token (works before App Review) */
function flUseToken(string $priv, string $tok, string $by): array {
    if (flKey() === null) return ['error' => 'The server has no key to keep the token safe (traverse-shared/mail-oauth.key).'];
    if (!preg_match('/^[A-Za-z0-9_|.-]{40,600}$/D', $tok)) return ['error' => 'That does not look like a Facebook access token.'];
    [, $me] = flCall('GET', 'me', ['fields' => 'id,name'], $tok, false);
    if (isset($me['error'])) return ['error' => 'Facebook did not accept it: ' . flErr($me)];
    $pages = flPagesOf($tok, false); $kind = 'SYSTEM_USER';
    if (isset($pages['error']) || !$pages) { $pages = [['id' => (string) $me['id'], 'name' => mb_substr((string) ($me['name'] ?? ''), 0, 120), 'token' => $tok, 'tasks' => []]]; $kind = 'PAGE'; }   /* one Page's own token */
    $c = ['via' => 'token', 'kind' => $kind, 'user' => ['id' => (string) ($me['id'] ?? ''), 'name' => mb_substr((string) ($me['name'] ?? ''), 0, 80)], 'scopes' => [], 'by' => $by, 'admin' => ''];
    if (!flSaveConn($priv, $c, $kind === 'PAGE' ? '' : $tok, 0, $pages)) return ['error' => 'Could not save that. Try again.'];
    @unlink(flStateFile($priv));
    flLog(['what' => 'connected', 'via' => 'token', 'kind' => $kind, 'pages' => count($pages), 'by' => $by]);
    return ['pages' => count($pages)];
}

/* ---------------------------------------------------------------- forms and matching */
/** the field a question fills when nobody chose: by Meta's key and question type */
function flDefField(string $key, string $type = ''): string {
    $k = strtolower($key); $t = strtoupper($type);
    if (in_array($k, ['full_name', 'name', 'first_name', 'last_name'], true) || in_array($t, ['FULL_NAME', 'FIRST_NAME', 'LAST_NAME'], true)) return 'name';
    if (in_array($k, ['phone_number', 'phone'], true) || $t === 'PHONE') return 'phone';
    if ($k === 'email' || $t === 'EMAIL' || $t === 'WORK_EMAIL') return 'email';
    if (in_array($k, ['street_address', 'address', 'city', 'state', 'province', 'zip_code', 'zip', 'post_code', 'postal_code', 'country'], true) || in_array($t, ['STREET_ADDRESS', 'CITY', 'STATE', 'PROVINCE', 'ZIP', 'POST_CODE', 'COUNTRY'], true)) return 'address';
    return 'notes';
}
/** a Page's lead forms with their questions and how each fills the lead */
function flForms(string $priv, string $pid): array {
    $c = flRead(flConnFile($priv)); $t = $c ? flOpen($priv, (string) ($c['tok'] ?? '')) : null;
    if (!$c || ($c['status'] ?? '') !== 'ok' || !$t) return ['error' => 'Facebook is not connected.'];
    $ptok = (string) (($t['p'] ?? [])[$pid] ?? ''); if ($ptok === '') return ['error' => 'That Page is not part of this connection.'];
    [, $r] = flCall('GET', $pid . '/leadgen_forms', ['fields' => 'id,name,status,created_time,questions{key,label,type}', 'limit' => 100], $ptok, ($c['via'] ?? '') === 'login');
    if (isset($r['error'])) { if (flTokenDead($r)) flLost($priv, flErr($r)); return ['error' => 'Facebook said: ' . flErr($r)]; }
    $S = flSettings(); $saved = $S['pages'][$pid]['forms'] ?? []; $o = [];
    foreach ((array) ($r['data'] ?? []) as $f) {
        if (empty($f['id'])) continue; $fid = (string) $f['id']; $qs = [];
        foreach ((array) ($f['questions'] ?? []) as $qq) if (isset($qq['key'])) { $k = (string) $qq['key'];
            $qs[] = ['key' => $k, 'label' => mb_substr((string) ($qq['label'] ?? $k), 0, 120), 'type' => (string) ($qq['type'] ?? ''), 'field' => $saved[$fid]['map'][$k] ?? flDefField($k, (string) ($qq['type'] ?? ''))]; }
        $o[] = ['id' => $fid, 'name' => mb_substr((string) ($f['name'] ?? $fid), 0, 120), 'status' => (string) ($f['status'] ?? ''), 'on' => isset($saved[$fid]) ? $saved[$fid]['on'] : true, 'questions' => $qs];
    }
    return ['forms' => $o];
}
/** one lead's answers through the form's matching: name, phone, email, address, street + city (for the house), notes */
function flApply(array $fd, array $labels, array $types, array $map): array {
    $v = [];
    foreach ($fd as $x) { $k = trim((string) ($x['name'] ?? '')); if ($k !== '') $v[$k] = trim(implode(', ', array_map('strval', (array) ($x['values'] ?? [])))); }
    $o = ['name' => [], 'phone' => '', 'email' => '', 'address' => [], 'notes' => [], 'street' => '', 'city' => ''];
    $first = ''; $last = '';
    foreach ($v as $k => $val) {
        if ($val === '') continue;
        $f = $map[$k] ?? flDefField($k, $types[$k] ?? ''); $lk = strtolower($k);
        if ($f === 'skip') continue;
        if ($f === 'name') { if ($lk === 'first_name') $first = $val; elseif ($lk === 'last_name') $last = $val; else $o['name'][] = $val; continue; }
        if ($f === 'phone') { if ($o['phone'] === '') $o['phone'] = (string) preg_replace('/^p:/i', '', $val); else $o['notes'][] = ($labels[$k] ?? $k) . ': ' . $val; continue; }
        if ($f === 'email') { if ($o['email'] === '' && filter_var($val, FILTER_VALIDATE_EMAIL)) $o['email'] = strtolower($val); else $o['notes'][] = ($labels[$k] ?? $k) . ': ' . $val; continue; }
        if ($f === 'address') { $o['address'][] = $val; if (in_array($lk, ['street_address', 'address'], true) || ($o['street'] === '' && preg_match('/^\d+\s+\S/', $val))) $o['street'] = $val; if ($lk === 'city') $o['city'] = $val; continue; }
        $o['notes'][] = rtrim(trim((string) ($labels[$k] ?? ucfirst(str_replace('_', ' ', $k)))), ' ?:') . ': ' . str_replace('_', ' ', $val);
    }
    if ($first !== '' || $last !== '') array_unshift($o['name'], trim($first . ' ' . $last));
    $o['name'] = implode(' ', array_unique($o['name'])); $o['address'] = implode(', ', $o['address']);
    return $o;
}

/* ---------------------------------------------------------------- 3. the 5-minute run */
/** whom the next lead goes to ('' = nobody yet), moving the turn on */
function flNextOwner(array $S, array &$state): string {
    $A = $S['assign'];
    if ($A['mode'] === 'one') return activeName($A['who']) && !boardHidden($A['who']) ? $A['who'] : '';
    if ($A['mode'] !== 'rr') return '';
    $pool = array_values(array_filter($A['pool'], fn($n) => activeName($n) && !boardHidden($n))); if (!$pool) return '';
    $i = ((int) ($state['rr'] ?? 0)) % count($pool); $state['rr'] = $i + 1;
    return $pool[$i];
}
/** the alert for a new lead: its person, or for a lead with nobody yet the admins and the office */
function flAlert(string $owner, string $title, string $text, string $url, string $tag): void {
    global $basePeople, $acct, $sessionKey;
    try {
        if ($owner !== '') { pushName($owner, $title, $text, $url, $tag); return; }
        foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && in_array($r['role'], ['admin', 'office'], true) && !boardHidden((string) $r['name'])) pushName((string) $r['name'], $title, $text, $url, $tag);
    } catch (Throwable $e) { error_log('fb leads alert: ' . $e->getMessage()); }
}
/** one run for this install: every chosen form's leads since the last look. ['added', 'notes', 'back', 'errors', 'note'] */
function flPoll(string $priv, string $by = 'Facebook'): array {
    $res = ['added' => 0, 'notes' => 0, 'back' => 0, 'errors' => [], 'note' => '', 'who' => []];
    $c = flRead(flConnFile($priv)); if (!$c) { $res['note'] = 'not connected'; return $res; }
    if (($c['status'] ?? '') !== 'ok') { $res['note'] = 'needs reconnect'; return $res; }
    $t = flOpen($priv, (string) ($c['tok'] ?? '')); if (!$t) { flLost($priv, 'the saved connection could not be read'); $res['note'] = 'needs reconnect'; return $res; }
    $S = flSettings(); $on = array_filter($S['pages'], fn($p) => $p['on']);
    if (!$on) { $res['note'] = 'no Page chosen'; return $res; }
    $lk = @fopen($priv . '/fb-leads.lock', 'c'); if ($lk && !flock($lk, LOCK_EX | LOCK_NB)) { $res['note'] = 'already running'; return $res; }   /* the cron and Check now never overlap */
    $pf = ($c['via'] ?? '') === 'login';   /* appsecret_proof only with our own app's tokens */
    try {
        $state = flRead(flStateFile($priv)) ?? []; $state['last'] = (array) ($state['last'] ?? []);
        $digits = fn($p) => substr((string) preg_replace('/\D/', '', (string) $p), -10);
        $seenExt = array_fill_keys(array_map('strval', (array) ($state['seen'] ?? [])), true); $who = [];   /* + the lead ids that became a note or brought a lead back: never in leads.log, so kept here */
        foreach (readLines(leadsDir() . '/leads.log') as $l) {
            if (!empty($l['ext'])) $seenExt[preg_replace('/^l:/', '', (string) $l['ext'])] = true;
        }
        foreach (leadsAllRaw() as $id => $l) {   /* by phone and email, the open and closed leads alike (Couldn't reach is handled below) */
            if (($l['status'] ?? '') === 'unreached') continue;
            $d = $digits($l['phone'] ?? ''); if (strlen($d) === 10) $who['p' . $d] = $who['p' . $d] ?? $id;
            $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $who['e' . $e] = $who['e' . $e] ?? $id;
        }
        $unWho = unreachedWho();
        foreach ($on as $pid => $P) {
            $ptok = (string) (($t['p'] ?? [])[$pid] ?? ''); if ($ptok === '') { $res['errors'][] = $P['name'] . ': not part of the connection any more (connect again and tick it)'; continue; }
            $since = (int) ($state['last'][$pid] ?? (time() - 86400)); $newest = $since; $errBefore = count($res['errors']);   /* a Page's first run looks back one day */
            /* the forms: all of the Page's (new ones too), or the chosen ones */
            $forms = [];
            if ($P['all']) {
                [, $r] = flCall('GET', $pid . '/leadgen_forms', ['fields' => 'id,name,status,questions{key,label,type}', 'limit' => 100], $ptok, $pf);
                if (isset($r['error'])) { if (flTokenDead($r)) { flLost($priv, flErr($r)); $res['note'] = 'needs reconnect'; $res['lostNow'] = true; break; } $res['errors'][] = $P['name'] . ': ' . flErr($r); continue; }
                foreach ((array) ($r['data'] ?? []) as $f) if (!empty($f['id']) && !in_array(strtoupper((string) ($f['status'] ?? '')), ['ARCHIVED', 'DELETED'], true) && ($P['forms'][(string) $f['id']]['on'] ?? true))
                    $forms[] = ['id' => (string) $f['id'], 'name' => (string) ($f['name'] ?? ''), 'questions' => (array) ($f['questions'] ?? [])];
            } else {
                foreach ($P['forms'] as $fid => $F) if ($F['on']) {
                    [, $r] = flCall('GET', (string) $fid, ['fields' => 'id,name,questions{key,label,type}'], $ptok, $pf);
                    if (isset($r['error']) && flTokenDead($r)) { flLost($priv, flErr($r)); $res['note'] = 'needs reconnect'; $res['lostNow'] = true; break 2; }
                    $forms[] = ['id' => (string) $fid, 'name' => (string) ($r['name'] ?? $F['name']), 'questions' => (array) ($r['questions'] ?? [])];
                }
            }
            foreach ($forms as $F) {
                $labels = []; $types = []; foreach ($F['questions'] as $q) if (isset($q['key'])) { $labels[(string) $q['key']] = (string) ($q['label'] ?? ''); $types[(string) $q['key']] = (string) ($q['type'] ?? ''); }
                $map = $P['forms'][$F['id']]['map'] ?? [];
                $fields = FL_LEAD_FIELDS; $url = $F['id'] . '/leads';
                $q = ['fields' => $fields, 'limit' => 100, 'filtering' => json_encode([['field' => 'time_created', 'operator' => 'GREATER_THAN', 'value' => $since]])];
                for ($pg = 0; $pg < 10 && $url !== ''; $pg++) {
                    [, $r] = flCall('GET', $url, $q, $q ? $ptok : '', $pf);
                    if (isset($r['error']) && $pg === 0 && $fields === FL_LEAD_FIELDS && (int) ($r['error']['code'] ?? 0) === 100 && stripos(flErr($r), 'field') !== false) {   /* a field Meta no longer has: the plain ones */
                        $fields = FL_LEAD_FIELDS_MIN; $q['fields'] = $fields; [, $r] = flCall('GET', $url, $q, $ptok, $pf);
                    }
                    if (isset($r['error'])) {
                        if (flTokenDead($r)) { flLost($priv, flErr($r)); $res['note'] = 'needs reconnect'; $res['lostNow'] = true; break 3; }
                        $res['errors'][] = $P['name'] . ' / ' . ($F['name'] ?: $F['id']) . ': ' . flErr($r); break;
                    }
                    foreach ((array) ($r['data'] ?? []) as $L) {
                        $ext = substr((string) preg_replace('/[^0-9A-Za-z_:.-]/', '', (string) ($L['id'] ?? '')), 0, 64); if ($ext === '') continue;
                        $at = strtotime((string) ($L['created_time'] ?? '')) ?: time(); $newest = max($newest, $at);
                        if (isset($seenExt[$ext])) continue;
                        $seenExt[$ext] = true;
                        $v = flApply((array) ($L['field_data'] ?? []), $labels, $types, $map);
                        $name = a365Clean($v['name'], 120); $phone = a365Clean($v['phone'], 40); $email = a365Clean($v['email'], 160);
                        if ($name === '' && $phone === '' && $email === '') continue;
                        $d = $digits($phone); $keys = array_values(array_filter([strlen($d) === 10 ? 'p' . $d : '', $email !== '' ? 'e' . strtolower($email) : '']));
                        $adLine = array_values(array_filter([!empty($L['ad_name']) ? 'Facebook ad: ' . a365Clean($L['ad_name'], 120) : (!empty($L['is_organic']) ? 'Facebook form (not from an ad)' : 'Facebook ad'),
                            !empty($L['campaign_name']) ? 'Campaign: ' . a365Clean($L['campaign_name'], 120) : '', 'Form: ' . a365Clean($F['name'] ?: $F['id'], 120) . ' · Page: ' . a365Clean($P['name'], 80)]));
                        /* Couldn't reach, then the form again: that lead comes back */
                        $un = ''; foreach ($keys as $k) if (isset($unWho[$k])) { $un = $unWho[$k]; break; }
                        if ($un !== '') { $state['seen'][] = $ext; leadRevive($un, 'filled in a Facebook form again (' . a365Clean($F['name'], 60) . ')', 'Facebook'); foreach ($keys as $k) unset($unWho[$k]); $res['back']++; continue; }
                        /* already in the Pipeline: a note on that lead, not a second lead */
                        $have = ''; foreach ($keys as $k) if (isset($who[$k])) { $have = $who[$k]; break; }
                        if ($have !== '') {
                            $state['seen'][] = $ext;
                            appendLine(leadsDir() . '/leadst.log', ['id' => $have, 'note' => 'Filled in a Facebook form again. ' . implode(' · ', $adLine) . ($v['notes'] ? "\n" . implode("\n", $v['notes']) : ''), 'by' => 'Facebook', 'at' => time()]);
                            $res['notes']++; continue;
                        }
                        $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'meta', 'at' => $at, 'need' => a365Clean($F['name'] ?: 'Facebook ad', 60),
                                'name' => $name, 'phone' => $phone, 'email' => $email, 'town' => a365Clean($v['address'], 160), 'msg' => a365Clean(implode("\n", array_merge($v['notes'], $adLine)), 2000),
                                'by' => 'Facebook ad', 'ext' => $ext, 'page' => a365Clean($P['name'], 80), 'ad' => a365Clean((string) ($L['ad_name'] ?? ''), 120), 'form' => a365Clean($F['name'], 120)];
                        if (!appendLine(leadsDir() . '/leads.log', $row)) { $res['errors'][] = 'could not save a lead'; continue; }
                        foreach ($keys as $k) $who[$k] = $row['id'];
                        $owner = flNextOwner($S, $state);
                        if ($owner !== '') appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'owner' => $owner, 'by' => 'Facebook', 'at' => time()]);
                        if ($v['street'] !== '' && function_exists('a365Match')) { try { $h = a365Match($v['street'], $v['city']); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => 'Facebook', 'at' => time()]); } catch (Throwable $e) {} }
                        if ($S['alert']) flAlert($owner, 'New Facebook lead' . ($owner !== '' ? ' for you' : ''), ($name ?: $phone) . ' · ' . ($F['name'] ?: 'Facebook ad'), './?lead=' . $row['id'], 'fblead-' . $row['id']);
                        $res['added']++; $res['who'][] = $row['id'];
                    }
                    $url = (string) ($r['paging']['next'] ?? ''); $q = [];
                }
            }
            if (count($res['errors']) === $errBefore) $state['last'][$pid] = max($since, $newest - 60);   /* a minute of overlap for the two clocks; the lead ids stop doubles; never past a form that failed */
        }
        $res['fresh'] = array_values(array_diff($res['errors'], (array) ($state['errors'] ?? [])));   /* the command line says an error once, not every 5 minutes */
        $state['ran'] = time(); $state['errors'] = array_slice($res['errors'], 0, 10); $state['seen'] = array_slice(array_values(array_unique(array_map('strval', (array) ($state['seen'] ?? [])))), -500);
        if ($res['added'] || $res['notes'] || $res['back']) { $state['lastAdded'] = time(); $state['n'] = (int) ($state['n'] ?? 0) + $res['added']; }
        flWrite(flStateFile($priv), $state);
        if ($res['added'] || $res['notes'] || $res['back'] || $res['errors']) flLog(['what' => 'run', 'by' => $by, 'added' => $res['added'], 'notes' => $res['notes'], 'back' => $res['back'], 'leads' => $res['who'], 'errors' => array_slice($res['errors'], 0, 5)]);
    } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
    return $res;
}

/* ---------------------------------------------------------------- the app's actions (rounds.php) */
function flAction(string $action): never {
    global $isPost, $body, $me, $session, $realSuper, $viewing;
    $priv = pushPrivDir();
    if ($action === 'fbpoll') {   /* the 5-minute job: traverse-tools/fb-leads.php, the command line only */
        if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
        if (!edition()) out(['ok' => true, 'added' => 0, 'note' => 'not this install']);
        $r = flPoll($priv); out(['ok' => true] + $r);
    }
    if (!edition()) fail('Not here.', 404);   /* Sixfold 365 keeps its own Facebook job */
    if (!adminOr('set.fbleads')) fail('Not allowed.', 403);
    if ($action === 'fbleads') {
        $st = flRead(flStateFile($priv)) ?? [];
        $log = array_slice(array_reverse(array_values(array_filter(jsonLines(DATA_DIR . '/fbleads.log'), fn($x) => isset($x['what'])))), 0, 8);
        out(['ok' => true, 'conn' => flConnState($priv), 'set' => flSettings(), 'people' => flPeople(), 'fields' => FL_FIELDS, 'super' => (bool) $realSuper,
             'run' => ['ran' => (int) ($st['ran'] ?? 0), 'errors' => (array) ($st['errors'] ?? []), 'lastAdded' => (int) ($st['lastAdded'] ?? 0), 'n' => (int) ($st['n'] ?? 0)],
             'log' => array_map(fn($x) => ['at' => (int) $x['at'], 'what' => (string) $x['what'], 'added' => (int) ($x['added'] ?? 0), 'notes' => (int) ($x['notes'] ?? 0), 'back' => (int) ($x['back'] ?? 0), 'by' => (string) ($x['by'] ?? ''), 'errors' => count((array) ($x['errors'] ?? []))], $log)]);
    }
    if ($action === 'fbforms') {
        $pid = (string) ($_GET['page'] ?? ''); if (!preg_match('/^\d{3,25}$|^p[0-9a-z]{1,20}$/D', $pid)) fail('Which Page?');
        $r = flForms($priv, $pid); if (isset($r['error'])) fail($r['error']);
        out(['ok' => true, 'page' => $pid, 'forms' => $r['forms']]);
    }
    if (!$isPost) fail('POST required', 405);
    if ($action === 'fboauth') {
        if (!throttleTake(rateFile('fboauth|' . (string) ($session['c'] ?? $me)), 20, 3600)) fail('That is a lot of tries in an hour. Wait a little and try again.', 429);
        $r = flStart($priv, (string) ($session['c'] ?? ''), (string) $me, kitBase());
        if (isset($r['error'])) { if ($r['error'] === 'not-ready') out(['ok' => true, 'ready' => false]); fail($r['error'], 500); }
        $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
        setcookie($r['cookie'][0], $r['cookie'][1], ['expires' => time() + FL_TTL, 'path' => '/api/fb-oauth.php', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
        out(['ok' => true, 'ready' => true, 'url' => $r['url']]);
    }
    if ($action === 'fbleadstoken') {   /* Traverse only: a token from Meta Business Settings */
        if (!$realSuper) fail('Not allowed.', 403);
        $r = flUseToken($priv, trim((string) ($body['token'] ?? '')), (string) $me); if (isset($r['error'])) fail($r['error']);
        out(['ok' => true, 'pages' => $r['pages'], 'conn' => flConnState($priv), 'set' => flSettings()]);
    }
    if ($action === 'fbleadsoff') { $r = flDisconnect($priv, (string) $me); out(['ok' => true, 'revoked' => $r['revoked'], 'conn' => flConnState($priv)]); }
    if ($action === 'fbpollnow') {
        if (!throttleTake(rateFile('fbpollnow|' . COOKIE), 12, 3600)) fail('Checked a lot this hour. The app checks by itself every 5 minutes.', 429);
        $r = flPoll($priv, (string) $me);
        out(['ok' => true, 'added' => $r['added'], 'notes' => $r['notes'], 'back' => $r['back'], 'errors' => $r['errors'], 'note' => $r['note']]);
    }
    if ($action === 'fbleadsset') {
        $old = flRead(flSetFile()) ?? []; $S = flSettings(); $conn = flConnState($priv); $known = [];
        foreach ((array) ($conn['pages'] ?? []) as $p) $known[$p['id']] = $p['name'];
        foreach ((array) ($body['pages'] ?? []) as $pid => $p) {
            $pid = (string) $pid; if (!is_array($p) || (!isset($known[$pid]) && !isset($S['pages'][$pid]))) continue;
            $forms = $S['pages'][$pid]['forms'] ?? [];
            foreach ((array) ($p['forms'] ?? []) as $fid => $f) {
                $fid = (string) $fid; if (!is_array($f) || !preg_match('/^\d{3,25}$|^f[0-9a-z]{1,20}$/D', $fid)) continue;
                $map = []; foreach ((array) ($f['map'] ?? []) as $k => $v) { if (!is_string($k) || !preg_match('/^[A-Za-z0-9_.:-]{1,80}$/D', $k)) continue; if (!isset(FL_FIELDS[(string) $v])) fail('Pick what each question fills in.'); $map[$k] = (string) $v; }
                $forms[$fid] = ['name' => mb_substr((string) ($f['name'] ?? ($forms[$fid]['name'] ?? '')), 0, 120), 'on' => !empty($f['on']), 'map' => $map];
            }
            $S['pages'][$pid] = ['name' => $known[$pid] ?? $S['pages'][$pid]['name'], 'on' => !empty($p['on']), 'all' => ($p['all'] ?? true) !== false, 'forms' => $forms];
        }
        if (isset($body['assign']) && is_array($body['assign'])) {
            $a = $body['assign']; $mode = (string) ($a['mode'] ?? 'none'); if (!in_array($mode, ['none', 'one', 'rr'], true)) fail('Who should new leads go to?');
            $who = trim((string) ($a['who'] ?? '')); $pool = array_values(array_unique(array_filter(array_map(fn($n) => is_string($n) ? trim($n) : '', (array) ($a['pool'] ?? [])), fn($n) => $n !== '')));
            if ($mode === 'one' && (!activeName($who) || boardHidden($who))) fail('Pick the person new leads go to.');
            foreach ($pool as $n) if (!activeName($n) || boardHidden($n)) fail($n . ' has no sign-in here.');
            if ($mode === 'rr' && count($pool) < 2) fail('Pick at least two people to take turns.');
            $S['assign'] = ['mode' => $mode, 'who' => $mode === 'one' ? $who : '', 'pool' => $mode === 'rr' ? array_slice($pool, 0, 50) : []];
        }
        if (array_key_exists('alert', $body)) $S['alert'] = !empty($body['alert']);
        $S['by'] = (string) $me; $S['at'] = time();
        if (!flWrite(flSetFile(), $S)) fail('Could not save that. Try again.', 500);
        out(['ok' => true, 'set' => flSettings()]);
    }
    fail('Unknown action', 400);
}

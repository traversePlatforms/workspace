<?php
declare(strict_types=1);
/* Post calendar: LinkedIn company-page posting (2026-11-18, Matthew: "I want this connected to my posts app under the surge section. We are
 * going to schedule posts similiar to how we do with surge. I am still putting surge facebook on hold until i gain access to the appropriate
 * surge account."). Loaded by lib.php. Same rules as Facebook and Instagram: an approver taps Approve on the one post, the fingerprint is
 * checked again before anything is sent, each part is recorded the moment it goes and never sent twice, and a failure emails Matthew.
 *
 * Only the clients in PC_LI_CLIENTS can have a LinkedIn target ('li'); today that is Surge alone.
 *
 * The app: Surge Inc's own LinkedIn developer app (Community Management API, Development tier requested 18 Nov 2026). Its client id and
 * secret are in post-calendar-data/private/linkedin-app.json (chmod 600), sent there from the laptop through a pipe
 * (tools/linkedin-app.sh push), never printed. Optional keys in that file: "version" (LinkedIn-Version header, YYYYMM), "scopes_extra".
 *
 * Connecting (Matthew only, from Manage clients > Surge > Connect LinkedIn): the 3-legged OAuth flow
 * (learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow). LinkedIn sends the browser back to
 * api/linkedin-oauth.php with a code, which is swapped for an access token (60 days) and, for approved apps, a refresh token (365 days,
 * programmatic-refresh-tokens). Both are kept ENCRYPTED (AES-256-GCM) in post-calendar-data/private/linkedin-<client>.json; the key is
 * private/linkedin.key mixed with the app secret, so the token file alone is useless. Never sent to the page, never logged (pcScrub).
 * The access token is refreshed by itself when it has under 7 days left (the runner checks every run; a post or a stats read checks too).
 *
 * Posting (learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api, version 202611): POST /rest/posts as
 * urn:li:organization:<id>; pictures through the Images API (initializeUpload, then the bytes PUT to the upload address, then wait for
 * AVAILABLE); one picture = content.media, 2-20 = content.multiImage; no picture = a text post. The words go in LinkedIn's "little" text
 * format, so its reserved characters are escaped (little-text-format). The optional first comment (Surge's voice rule: links in the first
 * comment) goes up as the organisation right after the post: POST /rest/socialActions/<post urn>/comments.
 *
 * Stats (Page analytics): organizationalEntityShareStatistics for each published LinkedIn post, read by the runner about 2 hours, 1 day,
 * 3 days and 7 days after it went: likes, comments, shares, impressions, unique impressions, clicks and engagement.
 *
 * Test hooks (never set on the server): PC_LI_API (stand-in for https://api.linkedin.com/rest/), PC_LI_OAUTH (for
 * https://www.linkedin.com/oauth/v2/). */
if (!defined('PC')) { http_response_code(404); exit; }

const PC_LI_CLIENTS = ['surge'];          /* LinkedIn is Surge's channel (Matthew 2026-11-18); nobody else gets the target */
const PC_LI_VERSION = '202611';           /* LinkedIn-Version: versions are monthly and sunset after about a year; bump before Nov 2027 */
const PC_LI_MAX = 3000;                   /* a post's commentary */
const PC_LI_COMMENT_MAX = 1250;           /* a comment, as LinkedIn's own comment box allows */
const PC_LI_IMAGES_MAX = 20;              /* multiImage: 2 to 20 */
const PC_LI_NEED = ['w_organization_social', 'rw_organization_admin'];   /* post as the Page; list the Pages he administers + Page analytics */
const PC_LI_WANT = ['r_organization_social', 'r_basicprofile'];          /* asked for too; dropped by themselves if LinkedIn refuses them */
const PC_LI_POST_ROLES = ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR', 'CONTENT_ADMIN', 'DIRECT_SPONSORED_CONTENT_POSTER'];
const PC_LI_STATS_AFTER = [7200, 86400, 3 * 86400, 7 * 86400];   /* when the runner reads a post's numbers, counted from when it went */
define('PC_LI_API', (string) (getenv('PC_LI_API') ?: 'https://api.linkedin.com/rest/'));
define('PC_LI_OAUTH', (string) (getenv('PC_LI_OAUTH') ?: 'https://www.linkedin.com/oauth/v2/'));

function pcLiAllowed(string $cid): bool { return in_array($cid, PC_LI_CLIENTS, true); }
function pcPlace(string $k): string { return ['fb' => 'Facebook', 'ig' => 'Instagram', 'li' => 'LinkedIn', 'lic' => 'LinkedIn first comment'][$k] ?? $k; }
function pcLiRedirect(): string { return PC_ORIGIN . '/' . PC_PUBLIC . '/api/linkedin-oauth.php'; }
function pcLiPostUrl(string $urn): string { return 'https://www.linkedin.com/feed/update/' . $urn . '/'; }

/* ---- the app's keys ---- */
function pcLiApp(): array {
    static $a = null; if ($a !== null) return $a;
    $j = json_decode((string) @file_get_contents(PC_DATA . '/private/linkedin-app.json'), true);
    $a = is_array($j) && ($j['client_id'] ?? '') !== '' && ($j['client_secret'] ?? '') !== '' ? $j : [];
    if ($a) pcTokensSeen((string) $a['client_secret']);
    return $a;
}
function pcLiVersion(): string { $v = (string) (pcLiApp()['version'] ?? ''); return preg_match('/^\d{6}$/', $v) ? $v : PC_LI_VERSION; }

/* ---- encryption at rest: AES-256-GCM, key = HMAC(private/linkedin.key, app secret) ---- */
function pcLiKey(): string {
    $f = pcDir('private') . '/linkedin.key'; $k = @file_get_contents($f);
    if ($k === false || strlen($k) !== 32) {
        $h = @fopen($f, 'x');   /* only one process ever makes it; the others read what it wrote */
        if ($h) { fwrite($h, random_bytes(32)); fclose($h); @chmod($f, 0600); }
        clearstatcache(); $k = (string) @file_get_contents($f);
    }
    return hash_hmac('sha256', $k, 'postcal-li|' . (string) (pcLiApp()['client_secret'] ?? ''), true);
}
function pcLiSeal(array $v): string { $iv = random_bytes(12); $tag = ''; $ct = openssl_encrypt(json_encode($v), 'aes-256-gcm', pcLiKey(), OPENSSL_RAW_DATA, $iv, $tag, 'postcal-li', 16); return base64_encode($iv . $tag . $ct); }
function pcLiOpen(string $s): ?array {
    $b = base64_decode($s, true); if ($b === false || strlen($b) < 29) return null;
    $pt = openssl_decrypt(substr($b, 28), 'aes-256-gcm', pcLiKey(), OPENSSL_RAW_DATA, substr($b, 0, 12), substr($b, 12, 16), 'postcal-li');
    $j = $pt === false ? null : json_decode($pt, true); return is_array($j) ? $j : null;
}

/* ---- one client's LinkedIn file: the connection (tokens sealed), the Pages he can post to, the last thing LinkedIn said ---- */
function pcLiFile(string $cid): string { return 'private/linkedin-' . preg_replace('/[^a-z0-9-]/', '', $cid) . '.json'; }
function pcLiRead(string $cid): array { $L = pcJread(pcLiFile($cid), []); return is_array($L) ? $L + ['conn' => null, 'last' => null, 'dropped' => []] : ['conn' => null, 'last' => null, 'dropped' => []]; }
function pcLiWrite(string $cid, array $L): void { pcDir('private'); pcJwrite(pcLiFile($cid), $L, 0600); }
/** change the file under its own lock (a refresh from the runner and a tap on the page never cross) */
function pcLiMutate(string $cid, callable $fn) {
    $lk = fopen(pcDir('private') . '/linkedin-' . preg_replace('/[^a-z0-9-]/', '', $cid) . '.lock', 'c'); flock($lk, LOCK_EX);
    try { $L = pcLiRead($cid); $r = $fn($L); pcLiWrite($cid, $L); return $r; } finally { flock($lk, LOCK_UN); fclose($lk); }
}
function pcLiSay(array &$L, string $kind, string $text): void { $L['last'] = ['kind' => $kind, 'text' => pcScrub(mb_substr($text, 0, 600)), 'at' => pcNow()]; }
function pcLiTokens(array $conn): ?array { $t = pcLiOpen((string) ($conn['sealed'] ?? '')); if ($t) { pcTokensSeen((string) ($t['access'] ?? '')); pcTokensSeen((string) ($t['refresh'] ?? '')); } return $t; }
function pcLiScopes(string $s): array { return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $s) ?: []))); }
/** true when the connection can no longer be used without Matthew going through Connect again */
function pcLiStale(?array $conn): bool {
    if (!$conn) return true; if (!empty($conn['bad'])) return true;
    $now = pcNow(); $refreshOk = !empty($conn['has_refresh']) && (int) ($conn['refresh_exp'] ?? 0) > $now + 60;
    return (int) ($conn['access_exp'] ?? 0) <= $now + 60 && !$refreshOk;
}

/** what the page may know (no tokens): ok | pick (connected, no Page chosen) | reconnect | refused | none | noapp */
function pcLiView(array $c): ?array {
    if (!pcLiAllowed((string) $c['id'])) return null;
    $L = pcLiRead((string) $c['id']); $conn = $L['conn'];
    $state = !pcLiApp() ? 'noapp' : ($conn ? (pcLiStale($conn) ? 'reconnect' : (($c['li_org'] ?? '') === '' ? 'pick' : 'ok')) : (($L['last']['kind'] ?? '') === 'refused' ? 'refused' : 'none'));
    $v = ['state' => $state, 'org_id' => (string) ($c['li_org'] ?? ''), 'org_name' => (string) ($c['li_org_name'] ?? ''), 'last' => $L['last']];
    if ($conn) $v += ['member' => (string) ($conn['member'] ?? ''), 'by' => (string) ($conn['by'] ?? ''), 'at' => (int) ($conn['at'] ?? 0), 'access_exp' => (int) ($conn['access_exp'] ?? 0),
        'refresh_exp' => !empty($conn['has_refresh']) ? (int) ($conn['refresh_exp'] ?? 0) : 0, 'scopes' => array_values((array) ($conn['scopes'] ?? [])),
        'orgs' => array_values(array_map(fn($o) => ['id' => (string) $o['id'], 'name' => (string) $o['name'], 'roles' => array_values((array) $o['roles']), 'canPost' => (bool) $o['canPost']], (array) ($conn['orgs'] ?? [])))];
    return $v;
}

/* ---- HTTP to LinkedIn: never throws, never returns or logs a token ---- */
/** $body: array = JSON (or form when $form), string = raw bytes (PUT upload). Returns ['code', 'json', 'head' (lower-case names), 'error' (plain words or '')] */
function pcLiHttp(string $method, string $url, $body = null, ?string $tok = null, bool $rest = true, bool $form = false): array {
    if ($tok !== null) pcTokensSeen($tok);
    $h = []; $head = [];
    if ($tok !== null) $h[] = 'Authorization: Bearer ' . $tok;
    if ($rest) { $h[] = 'LinkedIn-Version: ' . pcLiVersion(); $h[] = 'X-Restli-Protocol-Version: 2.0.0'; }
    $ch = curl_init($url);
    $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 20, CURLOPT_CUSTOMREQUEST => $method,
          CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$head) { $p = strpos($line, ':'); if ($p !== false) $head[strtolower(trim(substr($line, 0, $p)))] = trim(substr($line, $p + 1)); return strlen($line); }];
    if (is_string($body)) { $o[CURLOPT_POSTFIELDS] = $body; $h[] = 'Content-Type: application/octet-stream'; }
    elseif (is_array($body)) { if ($form) { $o[CURLOPT_POSTFIELDS] = http_build_query($body); $h[] = 'Content-Type: application/x-www-form-urlencoded'; } else { $o[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); $h[] = 'Content-Type: application/json'; } }
    $o[CURLOPT_HTTPHEADER] = array_merge($h, ['Expect:']);
    curl_setopt_array($ch, $o);
    $r = curl_exec($ch); $e = curl_error($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($r === false) return ['code' => 0, 'json' => null, 'head' => [], 'error' => 'no answer from LinkedIn: ' . pcScrub($e)];
    $j = json_decode((string) $r, true); $j = is_array($j) ? $j : null;
    $err = '';
    if ($code >= 400 || $code === 0) {
        $said = (string) ($j['message'] ?? $j['error_description'] ?? $j['error'] ?? trim(substr(preg_replace('/\s+/', ' ', (string) $r) ?? '', 0, 200)));
        $err = 'LinkedIn said: ' . pcScrub($said !== '' ? $said : 'no reason given') . ' (HTTP ' . $code . (isset($j['serviceErrorCode']) ? ', code ' . (int) $j['serviceErrorCode'] : '') . ')';
    }
    return ['code' => $code, 'json' => $j, 'head' => $head, 'error' => $err];
}
function pcLiV2(): string { return (string) preg_replace('#/rest/$#', '/v2/', PC_LI_API); }

/* ---- connecting ---- */
/** the scopes asked for: the two it cannot do without, the wanted ones LinkedIn has not refused before, and any extra from the app file */
function pcLiAsk(string $cid): array {
    $dropped = (array) pcLiRead($cid)['dropped'];
    $extra = pcLiScopes((string) (pcLiApp()['scopes_extra'] ?? ''));
    return array_values(array_unique(array_merge(PC_LI_NEED, array_diff(PC_LI_WANT, $dropped), $extra)));
}
/** the address to send Matthew's browser to; the state is kept 15 minutes and works once */
function pcLiStart(string $cid, string $by): array {
    $app = pcLiApp(); if (!$app) return ['error' => 'The LinkedIn app keys are not on the server yet.'];
    $state = bin2hex(random_bytes(16)); $ask = pcLiAsk($cid);
    $all = pcJread('private/linkedin-oauth.json', []); $now = pcNow();
    foreach ($all as $k => $s) if (($s['at'] ?? 0) < $now - 900) unset($all[$k]);
    $all[hash('sha256', $state)] = ['client' => $cid, 'by' => $by, 'at' => $now, 'scopes' => $ask];
    pcDir('private'); pcJwrite('private/linkedin-oauth.json', $all, 0600);
    $q = ['response_type' => 'code', 'client_id' => (string) $app['client_id'], 'redirect_uri' => pcLiRedirect(), 'state' => $state, 'scope' => implode(' ', $ask)];
    pcEvent(['t' => 'linkedin', 'client' => $cid, 'by' => $by, 'what' => 'Connect LinkedIn started (' . implode(' ', $ask) . ')']);
    return ['url' => PC_LI_OAUTH . 'authorization?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986)];
}
/** take a state back (once); null when unknown or older than 15 minutes */
function pcLiTakeState(string $state): ?array {
    if ($state === '') return null;
    $lk = fopen(pcDir('private') . '/linkedin-oauth.lock', 'c'); flock($lk, LOCK_EX);
    try {
        $all = pcJread('private/linkedin-oauth.json', []); $k = hash('sha256', $state); $s = $all[$k] ?? null;
        if ($s) { unset($all[$k]); pcJwrite('private/linkedin-oauth.json', $all, 0600); }
        return $s && ($s['at'] ?? 0) >= pcNow() - 900 ? $s : null;
    } finally { flock($lk, LOCK_UN); fclose($lk); }
}
/** LinkedIn sent the browser back with ?error=...: say it plainly; a refused optional scope is dropped so the next Connect works */
function pcLiRefused(string $cid, string $error, string $desc): array {
    $named = []; if (preg_match_all('/\b([rw]{1,2}_[a-z_]+)\b/', $desc, $m)) $named = array_values(array_unique($m[1]));
    if (in_array($error, ['user_cancelled_login', 'user_cancelled_authorize'], true)) { $kind = 'cancelled'; $text = 'You stopped at LinkedIn, so nothing changed.'; }
    elseif ($named && !array_diff($named, PC_LI_WANT)) { $kind = 'retry'; $text = 'LinkedIn does not give this app ' . implode(', ', $named) . ' (an extra, not needed to post). It is left out from now on: press Connect LinkedIn again.'; }
    else { $kind = 'refused'; $text = 'LinkedIn hasn\'t approved posting yet. LinkedIn said: ' . ($desc !== '' ? $desc : $error) . '.'; }
    pcLiMutate($cid, function (array &$L) use ($kind, $text, $named) { if ($kind === 'retry') $L['dropped'] = array_values(array_unique(array_merge((array) $L['dropped'], $named))); pcLiSay($L, $kind, $text); });
    pcEvent(['t' => 'linkedin', 'client' => $cid, 'what' => 'Connect LinkedIn: ' . $kind . ' (' . pcScrub($error) . ')']);
    return ['kind' => $kind, 'text' => $text];
}
/** LinkedIn sent the browser back with ?code=...: swap it for tokens, read who it is and which Pages he can post to, keep it all sealed */
function pcLiFinish(string $cid, string $code, string $by): array {
    $app = pcLiApp(); if (!$app) return ['kind' => 'error', 'text' => 'The LinkedIn app keys are not on the server.'];
    $r = pcLiHttp('POST', PC_LI_OAUTH . 'accessToken', ['grant_type' => 'authorization_code', 'code' => $code, 'client_id' => (string) $app['client_id'], 'client_secret' => (string) $app['client_secret'], 'redirect_uri' => pcLiRedirect()], null, false, true);
    $at = (string) ($r['json']['access_token'] ?? '');
    if ($r['error'] !== '' || $at === '') { $t = 'LinkedIn did not hand over the sign-in. ' . ($r['error'] ?: 'No access token came back.'); pcLiMutate($cid, fn(array &$L) => pcLiSay($L, 'error', $t)); return ['kind' => 'error', 'text' => $t]; }
    pcTokensSeen($at); $rt = (string) ($r['json']['refresh_token'] ?? ''); pcTokensSeen($rt);
    $scopes = pcLiScopes((string) ($r['json']['scope'] ?? ''));
    if ($scopes && !in_array('w_organization_social', $scopes, true)) {
        $t = 'LinkedIn hasn\'t approved posting yet: it signed you in but did not give this app permission to post as a Page (w_organization_social). Nothing was saved.';
        pcLiMutate($cid, fn(array &$L) => pcLiSay($L, 'refused', $t)); return ['kind' => 'refused', 'text' => $t];
    }
    $now = pcNow();
    /* who: the member's name when LinkedIn gives the basic profile; else whoever pressed Connect */
    $member = '';
    if (!$scopes || in_array('r_basicprofile', $scopes, true)) {
        $me = pcLiHttp('GET', pcLiV2() . 'me', null, $at, false);
        if ($me['error'] === '') $member = trim((string) ($me['json']['localizedFirstName'] ?? '') . ' ' . (string) ($me['json']['localizedLastName'] ?? ''));
    }
    /* which Pages: organizationAcls (organization-access-control-by-role), approved roles, grouped per Page; names from organizations/{id} */
    $acl = pcLiHttp('GET', PC_LI_API . 'organizationAcls?q=roleAssignee&state=APPROVED&count=100', null, $at);
    $orgs = [];
    foreach ((array) ($acl['json']['elements'] ?? []) as $e) {
        $urn = (string) ($e['organization'] ?? $e['organizationTarget'] ?? ''); if (!preg_match('/^urn:li:organization:(\d+)$/', $urn, $m)) continue;
        $orgs[$m[1]]['id'] = $m[1]; $orgs[$m[1]]['roles'][] = (string) ($e['role'] ?? '');
    }
    foreach (array_slice($orgs, 0, 20, true) as $id => $o) {
        $g = pcLiHttp('GET', PC_LI_API . 'organizations/' . $id, null, $at);
        $orgs[$id]['name'] = (string) ($g['json']['localizedName'] ?? '') ?: 'LinkedIn Page ' . $id;
        $orgs[$id]['roles'] = array_values(array_unique($orgs[$id]['roles']));
        $orgs[$id]['canPost'] = (bool) array_intersect($orgs[$id]['roles'], PC_LI_POST_ROLES);
    }
    $orgs = array_values(array_filter($orgs, fn($o) => isset($o['name'])));
    $conn = ['sealed' => pcLiSeal(['access' => $at, 'refresh' => $rt]), 'access_exp' => $now + (int) ($r['json']['expires_in'] ?? 5184000), 'has_refresh' => $rt !== '',
             'refresh_exp' => $rt !== '' ? $now + (int) ($r['json']['refresh_token_expires_in'] ?? 31536000) : 0, 'scopes' => $scopes, 'member' => $member !== '' ? $member : $by,
             'member_from' => $member !== '' ? 'linkedin' : 'signin', 'by' => $by, 'at' => $now, 'orgs' => $orgs, 'mailed' => 0];
    $text = $acl['error'] !== '' ? 'Signed in to LinkedIn, but the list of Pages could not be read: ' . $acl['error'] : (count(array_filter($orgs, fn($o) => $o['canPost'])) ? 'Signed in to LinkedIn. Pick the Page to post as.' : 'Signed in to LinkedIn, but this account cannot post for any Page (it needs Super admin or Content admin on the Page).');
    pcLiMutate($cid, function (array &$L) use ($conn, $text) { $L['conn'] = $conn; pcLiSay($L, 'connected', $text); });
    /* the Page chosen before stays chosen if this account can still post for it */
    pcMutate(function (array &$S) use ($cid, $orgs) { $cur = (string) ($S['clients'][$cid]['li_org'] ?? ''); if ($cur !== '' && !array_filter($orgs, fn($o) => $o['id'] === $cur && $o['canPost'])) { $S['clients'][$cid]['li_org'] = ''; $S['clients'][$cid]['li_org_name'] = ''; } });
    pcEvent(['t' => 'linkedin', 'client' => $cid, 'by' => $by, 'what' => 'Connected LinkedIn as ' . $conn['member'] . ' (' . count($orgs) . ' Pages)']);
    return ['kind' => 'connected', 'text' => $text];
}
/** a Page from the list, chosen by Matthew; approvals of this client's LinkedIn posts drop when the Page changes */
function pcLiPick(string $cid, string $org, string $by): array {
    $conn = pcLiRead($cid)['conn']; if (!$conn || pcLiStale($conn)) return ['error' => 'Connect LinkedIn first.'];
    $o = null; foreach ((array) $conn['orgs'] as $x) if ((string) $x['id'] === $org) $o = $x;
    if (!$o) return ['error' => 'That Page is not one this LinkedIn account manages.'];
    if (!$o['canPost']) return ['error' => 'This LinkedIn account cannot post for ' . $o['name'] . ' (it needs Super admin or Content admin on the Page).'];
    return pcMutate(function (array &$S) use ($cid, $o, $by) {
        foreach ($S['clients'] as $c) if ($c['id'] !== $cid && empty($c['archived']) && (string) ($c['li_org'] ?? '') === (string) $o['id']) return ['error' => 'That LinkedIn Page is already assigned to ' . $c['name'] . '.'];
        $moved = (string) ($S['clients'][$cid]['li_org'] ?? '') !== (string) $o['id'];
        $S['clients'][$cid]['li_org'] = (string) $o['id']; $S['clients'][$cid]['li_org_name'] = (string) $o['name'];
        if ($moved) foreach ($S['posts'] as &$p) if ($p['client'] === $cid && $p['status'] === 'approved' && in_array('li', (array) $p['targets'], true)) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $by, 'Approval dropped: the LinkedIn Page changed'); }
        unset($p);
        pcEvent(['t' => 'linkedin', 'client' => $cid, 'by' => $by, 'what' => 'LinkedIn Page: ' . $o['name'] . ' (' . $o['id'] . ')']);
        return ['ok' => true];
    });
}
function pcLiDisconnect(string $cid, string $by): void {
    pcLiMutate($cid, function (array &$L) use ($by) { $L['conn'] = null; pcLiSay($L, 'none', 'Disconnected by ' . $by . '. The tokens were deleted from the server.'); });
    pcMutate(function (array &$S) use ($cid, $by) {
        $S['clients'][$cid]['li_org'] = ''; $S['clients'][$cid]['li_org_name'] = '';
        foreach ($S['posts'] as &$p) if ($p['client'] === $cid && $p['status'] === 'approved' && in_array('li', (array) $p['targets'], true)) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $by, 'Approval dropped: LinkedIn was disconnected'); }
        unset($p);
    });
    pcEvent(['t' => 'linkedin', 'client' => $cid, 'by' => $by, 'what' => 'LinkedIn disconnected']);
}

/** a usable access token, refreshed when it has under 7 days left (or $force). ['token' => ...] or ['error' => plain words] */
function pcLiToken(string $cid, bool $force = false): array {
    return pcLiMutate($cid, function (array &$L) use ($force) {
        $conn = $L['conn']; if (!$conn) return ['error' => 'LinkedIn is not connected'];
        if (!empty($conn['bad'])) return ['error' => 'LinkedIn needs reconnecting (' . $conn['bad'] . ')'];
        $t = pcLiTokens($conn); if (!$t) { $L['conn']['bad'] = 'the saved sign-in could not be read'; return ['error' => 'LinkedIn needs reconnecting (the saved sign-in could not be read)']; }
        $now = pcNow(); $left = (int) $conn['access_exp'] - $now;
        if ($left > 7 * 86400 && !$force) return ['token' => (string) $t['access']];
        $canRefresh = !empty($conn['has_refresh']) && (string) ($t['refresh'] ?? '') !== '' && (int) $conn['refresh_exp'] > $now + 60;
        if (!$canRefresh) {
            if ($left > 60) return ['token' => (string) $t['access']];
            $L['conn']['bad'] = 'the sign-in ran out on ' . pcWall((int) $conn['access_exp'], 'D j M Y'); return ['error' => 'LinkedIn needs reconnecting (' . $L['conn']['bad'] . ')'];
        }
        $app = pcLiApp();
        $r = pcLiHttp('POST', PC_LI_OAUTH . 'accessToken', ['grant_type' => 'refresh_token', 'refresh_token' => (string) $t['refresh'], 'client_id' => (string) ($app['client_id'] ?? ''), 'client_secret' => (string) ($app['client_secret'] ?? '')], null, false, true);
        $at = (string) ($r['json']['access_token'] ?? '');
        if ($r['error'] !== '' || $at === '') {
            if ($left > 60 && $r['code'] !== 400 && $r['code'] !== 401) return ['token' => (string) $t['access']];   /* LinkedIn hiccup: the old token still works for now */
            $L['conn']['bad'] = 'the refresh was refused: ' . ($r['error'] ?: 'no token came back'); pcLiSay($L, 'reconnect', 'LinkedIn needs reconnecting: ' . $L['conn']['bad']);
            return ['error' => 'LinkedIn needs reconnecting (' . $L['conn']['bad'] . ')'];
        }
        pcTokensSeen($at); $rt = (string) ($r['json']['refresh_token'] ?? '') ?: (string) $t['refresh']; pcTokensSeen($rt);
        $L['conn']['sealed'] = pcLiSeal(['access' => $at, 'refresh' => $rt]); $L['conn']['access_exp'] = $now + (int) ($r['json']['expires_in'] ?? 5184000);
        if (isset($r['json']['refresh_token_expires_in'])) $L['conn']['refresh_exp'] = $now + (int) $r['json']['refresh_token_expires_in'];
        $L['conn']['refreshed'] = $now;
        pcEvent(['t' => 'linkedin', 'what' => 'access token refreshed']);
        return ['token' => $at];
    });
}

/* ---- the words: LinkedIn's "little" text format. Reserved: | { } @ [ ] ( ) < > # \ * _ ~ ; a backslash makes each plain text.
   A # that starts a word is left alone so hashtags stay hashtags. ---- */
function pcLiLittle(string $t): string {
    $t = (string) preg_replace('/#(?=[\p{L}\p{N}])/u', "\x01", $t);   /* hashtags kept (pcText leaves no control characters in the words) */
    $t = (string) preg_replace('/[\\\\|{}@\[\]()<>*_~#]/u', '\\\\$0', $t);
    return str_replace("\x01", '#', $t);
}

/* ---- checks before Approve, the LinkedIn part ---- */
function pcLiProblems(array $S, array $p, ?array $c): array {
    $why = []; $t = (array) $p['targets']; if (!in_array('li', $t, true)) return $why;
    if (!$c || !pcLiAllowed((string) $c['id'])) return ['LinkedIn is not set up for this client.'];
    $txt = (string) ($p['li'] ?? ''); $com = (string) ($p['li_comment'] ?? '');
    if (trim($txt) === '') $why[] = 'Write the LinkedIn post.';
    elseif (mb_strlen(pcLiLittle($txt)) > PC_LI_MAX) $why[] = 'The LinkedIn post is over 3,000 characters.';
    if (preg_match('#https?://|www\.#i', $txt)) $why[] = 'Links go in the first comment, not the LinkedIn post.';
    if (mb_strlen($com) > PC_LI_COMMENT_MAX) $why[] = 'The first comment is over 1,250 characters.';
    if (pcHasVideo($p)) $why[] = 'LinkedIn video is not set up here: a LinkedIn post takes pictures, or none.';
    if (($p['type'] ?? '') === 'photoset' && count((array) $p['images']) > PC_LI_IMAGES_MAX) $why[] = 'A LinkedIn post takes at most 20 pictures.';
    $v = pcLiView($c);
    if ($v['state'] === 'reconnect') $why[] = 'LinkedIn needs reconnecting (Manage clients > ' . $c['name'] . ').';
    elseif ($v['state'] === 'pick') $why[] = 'Pick the LinkedIn Page for ' . $c['name'] . ' (Manage clients).';
    elseif ($v['state'] !== 'ok') $why[] = 'LinkedIn is not connected for ' . $c['name'] . ' yet (Manage clients > ' . $c['name'] . ' > Connect LinkedIn).';
    return $why;
}

/* ---- sending: the post (once), then the first comment (once). $record($key, $done) saves each part the moment it went. ---- */
function pcSendLinkedIn(array $p, array $c, callable $record): array {
    $cid = (string) $c['id']; $org = (string) ($c['li_org'] ?? '');
    if (!pcLiAllowed($cid)) return ['error' => 'LinkedIn is not set up for this client'];
    if ($org === '') return ['error' => 'no LinkedIn Page is assigned to ' . $c['name']];
    $tk = pcLiToken($cid); if (isset($tk['error'])) return ['error' => $tk['error']];
    $tok = $tk['token']; $author = 'urn:li:organization:' . $org; $done = (array) ($p['done'] ?? []);
    $urn = (string) ($done['li']['id'] ?? '');
    if ($urn === '') {
        $ids = [];
        foreach ((array) $p['images'] as $k => $im) {
            if (pcIsVideo($im)) return ['error' => 'LinkedIn video is not set up here'];
            $path = PC_MEDIA_DIR . '/' . basename((string) ($im['file'] ?? ''));
            $bytes = ($im['file'] ?? '') !== '' && is_file($path) ? (string) file_get_contents($path) : '';
            if ($bytes === '' && ($im['url'] ?? '') !== '') { $g = @file_get_contents((string) $im['url']); $bytes = $g === false ? '' : $g; }
            if ($bytes === '') return ['error' => 'picture ' . ($k + 1) . ' could not be read on the server, so nothing was posted'];
            $i = pcLiHttp('POST', PC_LI_API . 'images?action=initializeUpload', ['initializeUploadRequest' => ['owner' => $author]], $tok);
            $up = (string) ($i['json']['value']['uploadUrl'] ?? ''); $img = (string) ($i['json']['value']['image'] ?? '');
            if ($i['error'] !== '' || $up === '' || $img === '') return ['error' => 'picture ' . ($k + 1) . ' was not accepted, so nothing was posted: ' . ($i['error'] ?: 'no upload address came back')];
            /* the token only ever goes to LinkedIn's own hosts (or the test stand-in) */
            if (!getenv('PC_LI_API') && !preg_match('#^https://([a-z0-9-]+\.)*linkedin\.com/#i', $up)) return ['error' => 'LinkedIn gave an upload address that is not LinkedIn\'s, so nothing was sent'];
            $u = pcLiHttp('PUT', $up, $bytes, $tok, false);
            if ($u['error'] !== '') return ['error' => 'picture ' . ($k + 1) . ' did not upload, so nothing was posted: ' . $u['error']];
            $ready = false; $wait = getenv('PC_POLL_SLEEP'); $wait = $wait === false || $wait === '' ? 3 : (int) $wait;
            for ($n = 0; $n < 20 && !$ready; $n++) { $s = pcLiHttp('GET', PC_LI_API . 'images/' . rawurlencode($img), null, $tok); $st = (string) ($s['json']['status'] ?? ''); if ($st === 'AVAILABLE') $ready = true; elseif ($st === 'PROCESSING_FAILED') return ['error' => 'LinkedIn could not process picture ' . ($k + 1) . ', so nothing was posted']; elseif ($wait) sleep($wait); }
            if (!$ready) return ['error' => 'LinkedIn had not finished picture ' . ($k + 1) . ' after a minute, so nothing was posted'];
            $ids[] = $img;
        }
        $body = ['author' => $author, 'commentary' => pcLiLittle((string) ($p['li'] ?? '')), 'visibility' => 'PUBLIC',
                 'distribution' => ['feedDistribution' => 'MAIN_FEED', 'targetEntities' => [], 'thirdPartyDistributionChannels' => []], 'lifecycleState' => 'PUBLISHED', 'isReshareDisabledByAuthor' => false];
        if (count($ids) === 1) $body['content'] = ['media' => ['id' => $ids[0]]];
        elseif (count($ids) > 1) $body['content'] = ['multiImage' => ['images' => array_map(fn($x) => ['id' => $x], $ids)]];
        $r = pcLiHttp('POST', PC_LI_API . 'posts', $body, $tok);
        $urn = (string) ($r['head']['x-restli-id'] ?? $r['json']['id'] ?? '');
        if ($r['error'] !== '') return ['error' => 'the post was not made: ' . $r['error']];
        if (!preg_match('/^urn:li:(share|ugcPost):\d+$/', $urn)) return ['error' => 'the post was not made: LinkedIn gave no post id'];
        $record('li', ['id' => $urn, 'link' => pcLiPostUrl($urn), 'org' => $org, 'pictures' => count($ids)]);
    }
    $com = trim((string) ($p['li_comment'] ?? ''));
    if ($com !== '' && empty($done['lic'])) {
        $r = pcLiHttp('POST', PC_LI_API . 'socialActions/' . rawurlencode($urn) . '/comments', ['actor' => $author, 'object' => $urn, 'message' => ['text' => $com]], $tok);
        if ($r['error'] !== '') return ['error' => 'the post went up (' . pcLiPostUrl($urn) . ') but the first comment was not added: ' . $r['error']];
        $cidc = (string) ($r['head']['x-restli-id'] ?? $r['json']['id'] ?? '');
        $record('lic', ['id' => $cidc, 'link' => pcLiPostUrl($urn)]);
    }
    return [];
}

/* ---- the runner's LinkedIn chores, every run: keep the sign-in fresh (and say so once when it cannot be), and read the numbers ---- */
function pcLiChores(callable $say): void {
    if (!pcLiApp()) return;
    $S = pcState();
    foreach (PC_LI_CLIENTS as $cid) {
        if (!isset($S['clients'][$cid])) continue;
        $L = pcLiRead($cid); $conn = $L['conn']; if (!$conn) continue;
        $now = pcNow();
        if (empty($conn['bad']) && (int) $conn['access_exp'] - $now < 7 * 86400) { $t = pcLiToken($cid); if (isset($t['error'])) $say("linkedin $cid: " . $t['error']); else $say("linkedin $cid: sign-in checked"); }
        $L = pcLiRead($cid); $conn = $L['conn'];
        $soon = !$conn['has_refresh'] && empty($conn['bad']) && (int) $conn['access_exp'] - $now < 7 * 86400;
        if ((pcLiStale($conn) || $soon) && (int) ($conn['mailed'] ?? 0) < (int) ($conn['at'] ?? 0) + 1) {
            $c = $S['clients'][$cid];
            $text = 'The post calendar\'s LinkedIn connection for ' . $c['name'] . ' ' . (pcLiStale($conn) ? 'needs reconnecting now' : 'runs out on ' . pcWall((int) $conn['access_exp'], 'D j M Y') . ' and LinkedIn gave no way to renew it by itself') . ".\n\n"
                . (!empty($conn['bad']) ? 'Why: ' . $conn['bad'] . "\n\n" : '') . "To fix it: open the post calendar, Manage clients, " . $c['name'] . ", Connect LinkedIn.\nNo LinkedIn post goes out until then.\n\n" . PC_ORIGIN . '/' . PC_PUBLIC . "/\n";
            $m = pcMail('Post calendar: LinkedIn needs reconnecting for ' . $c['name'], $text);
            pcLiMutate($cid, function (array &$L) use ($now) { if ($L['conn']) $L['conn']['mailed'] = $now; });
            $say("linkedin $cid: reconnect email " . ($m['ok'] ? 'sent' : 'not sent (' . $m['stage'] . ')'));
        }
    }
    pcLiStats($say);
}
/** each published LinkedIn post's numbers, read about 2 h, 1 day, 3 days and 7 days after it went; one call per Page */
function pcLiStats(callable $say): void {
    $S = pcState(); $now = pcNow(); $due = [];
    foreach ($S['posts'] as $p) {
        $d = $p['done']['li'] ?? null; if (!$d || empty($d['id']) || !pcLiAllowed((string) $p['client'])) continue;
        $n = (int) ($p['li_stats']['n'] ?? 0); if ($n >= count(PC_LI_STATS_AFTER)) continue;
        if ($now >= (int) ($d['at'] ?? 0) + PC_LI_STATS_AFTER[$n]) $due[$p['client'] . '|' . (string) ($d['org'] ?? ($S['clients'][$p['client']]['li_org'] ?? ''))][] = $p['id'];
    }
    foreach ($due as $key => $ids) {
        [$cid, $org] = explode('|', $key, 2); if ($org === '') continue;
        $tk = pcLiToken($cid);
        $urns = []; foreach ($ids as $id) $urns[$id] = (string) $S['posts'][$id]['done']['li']['id'];
        $got = []; $err = $tk['error'] ?? '';
        if ($err === '') {
            $shares = array_filter($urns, fn($u) => strpos($u, 'urn:li:share:') === 0); $ugc = array_filter($urns, fn($u) => strpos($u, 'urn:li:ugcPost:') === 0);
            $q = 'q=organizationalEntity&organizationalEntity=' . rawurlencode('urn:li:organization:' . $org)
               . ($shares ? '&shares=List(' . implode(',', array_map('rawurlencode', $shares)) . ')' : '') . ($ugc ? '&ugcPosts=List(' . implode(',', array_map('rawurlencode', $ugc)) . ')' : '');
            $r = pcLiHttp('GET', PC_LI_API . 'organizationalEntityShareStatistics?' . $q, null, $tk['token']);
            $err = $r['error'];
            foreach ((array) ($r['json']['elements'] ?? []) as $e) { $u = (string) ($e['share'] ?? $e['ugcPost'] ?? ''); if ($u !== '') $got[$u] = (array) ($e['totalShareStatistics'] ?? []); }
        }
        pcMutate(function (array &$S) use ($urns, $got, $err, $now) {
            foreach ($urns as $id => $u) {
                $q = &$S['posts'][$id]; $n = (int) ($q['li_stats']['n'] ?? 0) + 1;
                if ($err !== '') { $q['li_stats'] = ['n' => $n, 'error' => $err, 'tried' => $now] + array_intersect_key((array) ($q['li_stats'] ?? []), array_flip(['likes', 'comments', 'shares', 'impressions', 'unique', 'clicks', 'engagement', 'at'])); continue; }
                $g = $got[$u] ?? [];   /* a post LinkedIn leaves out has no actions or impressions yet: all 0 */
                $q['li_stats'] = ['n' => $n, 'at' => $now, 'likes' => (int) ($g['likeCount'] ?? 0), 'comments' => (int) ($g['commentCount'] ?? 0), 'shares' => (int) ($g['shareCount'] ?? 0),
                                  'impressions' => (int) ($g['impressionCount'] ?? 0), 'unique' => (int) ($g['uniqueImpressionsCount'] ?? 0), 'clicks' => (int) ($g['clickCount'] ?? 0), 'engagement' => (float) ($g['engagement'] ?? 0)];
                unset($q);
            }
        });
        $say("linkedin stats $cid: " . count($urns) . ' post(s) ' . ($err === '' ? 'read' : 'NOT read: ' . $err));
    }
}

/* ---- the Facebook / Instagram hold (2026-11-18): a client-level flag; held platforms cannot be approved and the runner never sends to them ---- */
function pcHeld(?array $c, string $where): ?array { $h = $c['holds'][$where] ?? null; return is_array($h) ? $h : null; }
function pcSetHold(string $cid, array $targets, ?string $why, string $by): int {
    return pcMutate(function (array &$S) use ($cid, $targets, $why, $by) {
        if (!isset($S['clients'][$cid])) return -1;
        $h = (array) ($S['clients'][$cid]['holds'] ?? []); $n = 0;
        foreach ($targets as $t) { if (!in_array($t, ['fb', 'ig'], true)) continue; if ($why === null) unset($h[$t]); else $h[$t] = ['why' => $why, 'by' => $by, 'at' => pcNow()]; }
        $S['clients'][$cid]['holds'] = $h;
        if ($why !== null) foreach ($S['posts'] as &$p) if ($p['client'] === $cid && $p['status'] === 'approved' && array_intersect($targets, (array) $p['targets'])) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $by, 'Approval dropped: ' . implode(' and ', array_map('pcPlace', $targets)) . ' put on hold'); $n++; }
        unset($p);
        pcEvent(['t' => 'client', 'id' => $cid, 'by' => $by, 'what' => ($why === null ? 'hold lifted: ' : 'on hold: ') . implode(', ', $targets) . ($why ? ' (' . $why . ')' : '')]);
        return $n;
    });
}

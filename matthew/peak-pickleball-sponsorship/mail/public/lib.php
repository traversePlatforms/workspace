<?php
declare(strict_types=1);
/* Peak outreach email (2026-11-17, Matthew: "I need to start doing emails for peak, similiar to how I do email for traverse, sending X amount out
 * each hour until our list is tapped. I need it to go to the inbox ... for peak sponsors and for potential people that want to rent that expo
 * space"). Sends through Microsoft Graph as Peak Partnerships, the shared mailbox (since 2026-11-19; it was Matthew's own Peak Outlook
 * before), one plain-text email per person, in
 * hourly batches inside a sending window, until each list is done. Not a page: opened directly this file answers 404.
 *
 * Where things are (live):
 *   public_html/peak-mail-31dc56/   this folder: index.php (the admin page), api.php, oauth.php (Microsoft's redirect), r.php (tracked
 *                                   links), u.php (unsubscribe), cron.php (the hourly run, command line only)
 *   peak-mail-data/ (0700, beside public_html, never in git or a backup)
 *     app.json      the Entra app "Matthew outreach": client_id, tenant, secret (0600)
 *     key           32 random bytes (hex): seals the Microsoft token, signs links and sign-in state (0600). Never changed.
 *     ms.json       the connected mailbox and its refresh token, sealed (AES-256-GCM)
 *     code.hash     the admin page's sign-in code, hashed (the code itself is only on Matthew's laptop)
 *     lists.json    the two lists as imported from the Peak desk (peak-desk-data)
 *     events.log    everything that happened, one JSON line each, append-only: sent, reply, bounce, unsub, click, start, pause, template ...
 *     run.log       one line per hourly run
 * Rules built in: lists start PAUSED and only Matthew's Start sends; Start is refused while a template is still a DRAFT, while the postal
 * address is missing, or while Microsoft is not connected; a template edit or a re-import that adds people pauses a running list; nobody
 * suppressed (unsubscribed, bounced, replied STOP, added by hand) is ever emailed; no open-tracking pixel; every web address in an email
 * goes through r.php so clicks are counted. Mail is only READ (replies and bounce notices): nothing is moved or deleted; in Peak
 * Partnerships a handled reply is marked read, and Matthew's own mailbox is never changed.
 * The Peak desk (2026-11-18, Matthew: "Hook the email tool into peak desk"): the desk's own record code (public_html/peak-desk-28d38d/api/
 * desk-store.php) is required here. The lists are read through it, and every send, reply, STOP, unsubscribe and bounce is put on the
 * desk card (deskEmailed / deskReplied / deskBounced, by "Peak email"). A desk write that fails never stops or repeats a send: it is logged
 * and tried again on the next hourly run. Companies someone owns, or a person touched in the last 14 days, are skipped (a setting).
 * Tests: PEAK_MAIL_DATA, PEAK_DESK_DATA, PEAK_DESK_STORE, PEAK_MAIL_MOCK (http://127.0.0.1:port stands in for Microsoft), PEAK_MAIL_NOW,
 * PEAK_MAIL_GAP, PEAK_MAIL_MX=skip, PEAK_MAIL_DESKFAIL (any value: every desk write fails); honoured only from the command line or PHP's own
 * test server. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

/* Where this copy is installed (2026-11-17, Matthew: "attach it to the same url ... call it something else not peak related"). The live
   copy sits inside Outbox, at public_html/outbox-092b0f/peak/. A site.php beside lib.php there sets PM_PATH, PM_ROOT (the folder that holds
   peak-mail-data) and the hooks for Outbox's own sign-in (pmSiteSignedIn, pmSiteRedirect, pmSiteHome). Without a site.php (the repo copy,
   the tests) this is the stand-alone tool at /peak-mail-31dc56/. The old address keeps oauth.php, r.php, u.php and cron.php as one-line
   pointers to the Outbox copy, so Microsoft's registered redirect and the hourly cron still work. */
if (is_file(__DIR__ . '/site.php')) require_once __DIR__ . '/site.php';
defined('PM_PATH') || define('PM_PATH', '/peak-mail-31dc56');
defined('PM_ROOT') || define('PM_ROOT', dirname(__DIR__, 2));
const PM_LISTS = ['sponsors' => 'Peak sponsors', 'expo' => 'Expo space rental'];
/* Peak Partnerships (2026-11-19, Matthew set up the shared mailbox "Peak Partnerships" <partnerships@peakpickleball.us> in Peak's Microsoft 365
   with Send As and Full Access for himself, and Mail.Send.Shared + Mail.ReadWrite.Shared on "Matthew outreach", admin-consented): every Peak
   email goes out as the shared mailbox (/v1.0/users/{it}/sendMail, kept in its Sent Items), and replies, bounces, auto-replies and STOP are
   read from its Inbox and shown on the Peak desk. The setting "sendFrom" (Outbox, Peak, Settings) can fall back to the connected mailbox
   ('me'). A Send As refusal is said plainly and never falls back by itself. Peak's other shared mailboxes belong to Peak's staff: never here. */
const PM_SCOPE_BASE = 'offline_access User.Read Mail.ReadWrite Mail.Send';
const PM_SCOPE = PM_SCOPE_BASE . ' Mail.Send.Shared Mail.ReadWrite.Shared';
const PM_SHARED = 'partnerships@peakpickleball.us';
const PM_SHARED_NAME = 'Peak Partnerships';
const PM_SENDAS = 'Microsoft hasn\'t finished giving Send As yet, or it was removed';
const PM_ORIGIN = 'https://traverseplatforms.com';
const PM_RATE_MAX = 30;
const PM_RAMP = 10;        /* the first sending day: at most 10 an hour, whatever the rate */
const PM_TTL = 600;        /* a Microsoft sign-in must come back within ten minutes */
const PM_DAYS = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
const PM_ADMIN_HELP = 'Peak\'s Global admin signs in at entra.microsoft.com, opens Identity > Applications > Enterprise applications (or App registrations > All applications), picks "Matthew outreach", then Permissions (API permissions) and presses "Grant admin consent for Peak Pickleball". Then press Connect Microsoft here again.';

/* ---------------------------------------------------------------- where things are */
function pmTestOk(): bool { return PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server'; }
function pmEnv(string $k): string { return pmTestOk() ? (string) getenv($k) : ''; }
function pmData(): string { $e = pmEnv('PEAK_MAIL_DATA'); return $e !== '' ? $e : PM_ROOT . '/peak-mail-data'; }
function pmDesk(): string { $e = pmEnv('PEAK_DESK_DATA'); return $e !== '' ? $e : PM_ROOT . '/peak-desk-data'; }
function pmNow(): int { $e = pmEnv('PEAK_MAIL_NOW'); return ctype_digit($e) ? (int) $e : time(); }
function pmMock(): string { $m = pmEnv('PEAK_MAIL_MOCK'); return preg_match('#^http://127\.0\.0\.1:\d{2,5}$#D', $m) ? $m : ''; }
function pmLogin(): string { return pmMock() !== '' ? pmMock() . '/login' : 'https://login.microsoftonline.com'; }
function pmGraphBase(): string { return pmMock() !== '' ? pmMock() . '/graph' : 'https://graph.microsoft.com'; }
function pmOrigin(): string {
    if (pmMock() === '') return PM_ORIGIN;
    $h = (string) ($_SERVER['HTTP_HOST'] ?? (pmEnv('PEAK_MAIL_HOST') ?: '127.0.0.1:8791'));
    return preg_match('/^127\.0\.0\.1:\d{2,5}$/D', $h) ? 'http://' . $h : PM_ORIGIN;
}
function pmBase(): string { return pmOrigin() . (pmMock() !== '' ? '' : PM_PATH); }   /* the test server serves this folder at its root */
/* Peak's own link address (X-16, 2026-11-20, Matthew: "we want to try and seperate the two in terms of the wordage"). Every address a Peak
   email carries (r.php clicks, o.php opens, b.php, u.php, the logo; and the desk's booking page, book-lib.php bkBase) is built on ONE
   setting: peak-desk-data/peak-links.json {"base": "https://links.peakpickleball.us"}, read by this sender and by the desk. No file (or a
   base that is not https on a peakpickleball.us name) = the old addresses on traverseplatforms.com, exactly as before. On the Peak name
   the site's root .htaccess sends /r.php /o.php /u.php /peak-logo.png here, /book.php to b.php (SiteGround's front server refuses /b.php
   at the top of a site), and /book/ to the desk's booking page, and nothing else.
   `php cron.php links` checks the name (DNS, certificate, every handler); `php cron.php links-on` switches it on only when all of that
   passes; `links-off` goes back. Links already sent keep working at their old addresses: the files there are unchanged. Microsoft's
   redirect (oauth.php) and the admin page never move. */
const PM_LINKS_FILE = 'peak-links.json';
function pmLinkOk(string $b): bool { return (bool) preg_match('#^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.peakpickleball\.us$#D', $b); }
/** the Peak address from the setting ('' = off) */
function pmLinkSet(): string {
    $j = json_decode((string) @file_get_contents(pmDesk() . '/' . PM_LINKS_FILE), true);
    $b = is_array($j) ? strtolower((string) ($j['base'] ?? '')) : ''; return pmLinkOk($b) ? $b : '';
}
/** where the addresses in an email start: the Peak address when it is on, else this folder on traverseplatforms.com (pmBase) */
function pmLinkBase(): string { static $b = null; if ($b === null || pmTestOk()) $b = pmLinkSet() ?: pmBase(); return $b; }
/** where Microsoft sends Matthew back: it must be a redirect registered on the Entra app (Outbox chooses between the old and the new one) */
function pmRedirect(): string { return pmMock() === '' && function_exists('pmSiteRedirect') ? pmSiteRedirect() : pmBase() . '/oauth.php'; }
/** the folder of that redirect: the short-lived Connect cookie must be sent there */
function pmCookiePath(): string { return rtrim(str_replace('\\', '/', dirname((string) parse_url(pmRedirect(), PHP_URL_PATH))), '/') . '/'; }
/** where oauth.php sends Matthew once Microsoft has answered */
function pmHome(string $kind, string $here): string { return function_exists('pmSiteHome') ? pmSiteHome($kind) : $here . '?ms=' . rawurlencode($kind); }

/* ---------------------------------------------------------------- files */
function pmReady(): bool { $d = pmData(); if (!is_dir($d)) return false; return true; }
function pmJ(string $f, $def) { $s = @file_get_contents(pmData() . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function pmW(string $f, $v): bool {
    $p = pmData() . '/' . $f; $t = $p . '.tmp' . bin2hex(random_bytes(3)); $s = (string) json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($t, $s, LOCK_EX) !== strlen($s)) { @unlink($t); return false; }
    @chmod($t, 0600); return @rename($t, $p);
}
function pmLog(array $row): void {
    $row += ['at' => pmNow()];
    @file_put_contents(pmData() . '/events.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
function pmRows(string $f = 'events.log', ?string $dir = null): array {
    $out = []; $fh = @fopen(($dir ?? pmData()) . '/' . $f, 'r'); if (!$fh) return $out;
    while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; }
    fclose($fh); return $out;
}
function pmDeskJ(string $f, $def) { $s = @file_get_contents(pmDesk() . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return is_array($j) ? $j : $def; }
function pmClean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function pmText($v, int $max): string { $t = str_replace(["\r\n", "\r"], "\n", (string) $v); $t = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $t) ?? ''; return mb_substr(trim($t), 0, $max); }

/* ---------------------------------------------------------------- keys and sealing */
function pmKey(): string {
    static $k = null; if ($k !== null) return $k;
    $f = pmData() . '/key'; $h = trim((string) @file_get_contents($f));
    if (!preg_match('/^[0-9a-f]{64}$/D', $h)) {
        if (is_file($f)) throw new RuntimeException('peak-mail key file is damaged');   /* never silently replaced: the saved token would stop opening */
        $h = bin2hex(random_bytes(32)); @file_put_contents($f, $h, LOCK_EX); @chmod($f, 0600);
    }
    return $k = (string) hex2bin($h);
}
function pmSub(string $use): string { return hash_hmac('sha256', 'peak-mail|' . $use, pmKey(), true); }
function pmB64(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function pmUnb64(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); }
function pmSeal(array $data): string {
    $iv = random_bytes(12); $tag = '';
    $ct = (string) openssl_encrypt((string) json_encode($data), 'aes-256-gcm', pmSub('enc'), OPENSSL_RAW_DATA, $iv, $tag, 'peak-mail-token', 16);
    return 'p1.' . base64_encode($iv . $tag . $ct);
}
function pmOpen(string $box): ?array {
    if (!str_starts_with($box, 'p1.')) return null;
    $raw = (string) base64_decode(substr($box, 3), true); if (strlen($raw) < 29) return null;
    $pt = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', pmSub('enc'), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16), 'peak-mail-token');
    $j = is_string($pt) ? json_decode($pt, true) : null; return is_array($j) ? $j : null;
}
/** the Entra app: [id, tenant, secret] or null */
function pmApp(): ?array {
    $j = pmJ('app.json', null);
    if (!is_array($j)) return null;
    $id = (string) ($j['client_id'] ?? ''); $tn = (string) ($j['tenant'] ?? ''); $sc = (string) ($j['secret'] ?? '');
    $uuid = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D';
    return preg_match($uuid, $id) && preg_match($uuid, $tn) && $sc !== '' ? ['id' => $id, 'tenant' => $tn, 'secret' => $sc] : null;
}
/** a person's stable id in links: 10 hex characters, the same for the same address */
function pmRid(string $email): string { return substr(hash_hmac('sha256', 'rid|' . strtolower(trim($email)), pmSub('links')), 0, 10); }
function pmSig(string $what): string { return substr(hash_hmac('sha256', $what, pmSub('links')), 0, 12); }

/* ---------------------------------------------------------------- HTTP */
/** one call to Microsoft: [status, body]; never throws; 0 = no answer */
function pmHttp(string $method, string $url, array $headers, ?string $body): array {
    $h = curl_init($url);
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_FOLLOWLOCATION => false]);
    if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, $body);
    $raw = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
    return [is_string($raw) ? $code : 0, is_string($raw) ? $raw : ''];
}
function pmForm(string $url, array $f): array { [$s, $b] = pmHttp('POST', $url, ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], http_build_query($f)); return [$s, json_decode($b, true) ?: []]; }

/* ---------------------------------------------------------------- Microsoft sign-in */
function pmCookieName(): string { return 'peakmail_ms'; }
/** where to send Matthew to sign in, and the browser cookie that must come back; ['error'] when it cannot start */
function pmAuthStart(string $by): array {
    $app = pmApp(); if (!$app) return ['error' => 'The Microsoft app keys are not on the server yet.'];
    $nonce = bin2hex(random_bytes(16)); $ver = pmB64(random_bytes(48)); $browser = bin2hex(random_bytes(16)); $now = pmNow();
    if (!pmW('oauth-state.json', ['n' => $nonce, 'v' => $ver, 'b' => hash('sha256', $browser), 'by' => $by, 'at' => $now])) return ['error' => 'Could not start. Try again.'];
    $pl = pmB64((string) json_encode(['n' => $nonce, 't' => $now]));
    $state = $pl . '.' . pmB64(hash_hmac('sha256', $pl, pmSub('state'), true));
    $q = ['client_id' => $app['id'], 'response_type' => 'code', 'redirect_uri' => pmRedirect(), 'response_mode' => 'query', 'scope' => PM_SCOPE,
          'state' => $state, 'code_challenge' => pmB64(hash('sha256', $ver, true)), 'code_challenge_method' => 'S256', 'prompt' => 'select_account'];
    return ['url' => pmLogin() . '/' . $app['tenant'] . '/oauth2/v2.0/authorize?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986), 'cookie' => $browser];
}
/** true when what Microsoft said means Peak's admin has to approve the app */
function pmNeedsAdmin(string $err, string $desc): bool {
    return (bool) preg_match('/AADSTS(65001|65004|90094|90095|900941)|admin(istrator)? (approval|consent)|need admin|consent_required|requires admin/i', $err . ' ' . $desc);
}
/** what oauth.php does with Microsoft's answer: ['kind' => connected|admin|denied|expired|browser|failed, 'msg' => plain words, 'as' => mailbox] */
function pmAuthCallback(array $get, array $cookies): array {
    $r = fn(string $k, string $m, string $as = '') => ['kind' => $k, 'msg' => $m, 'as' => $as];
    $again = 'This sign-in link ran out or was already used. Go back to the Peak email page and press Connect Microsoft again.';
    $err = pmClean($get['error'] ?? '', 80); $desc = pmClean($get['error_description'] ?? '', 400);
    $state = (string) ($get['state'] ?? '');
    if (!preg_match('/^([A-Za-z0-9_-]{20,300})\.([A-Za-z0-9_-]{43})$/D', $state, $m) || !hash_equals(pmB64(hash_hmac('sha256', $m[1], pmSub('state'), true)), $m[2])) {
        if ($err !== '' && pmNeedsAdmin($err, $desc)) return $r('admin', PM_ADMIN_HELP);
        return $r('failed', 'This link does not look right. Start again from the Peak email page.');
    }
    $pl = json_decode(pmUnb64($m[1]), true); $t = (int) ($pl['t'] ?? 0);
    if (!is_array($pl) || $t < pmNow() - PM_TTL || $t > pmNow() + 60) return $r('expired', $again);
    $sf = pmData() . '/oauth-state.json'; $claim = $sf . '.used' . bin2hex(random_bytes(4));
    if (!@rename($sf, $claim)) return $r('expired', $again);   /* used once: only one request can claim it */
    $st = json_decode((string) @file_get_contents($claim), true); @unlink($claim);
    if (!is_array($st) || !hash_equals((string) ($st['n'] ?? ''), (string) ($pl['n'] ?? '')) || (int) ($st['at'] ?? 0) < pmNow() - PM_TTL) return $r('expired', $again);
    $ck = (string) ($cookies[pmCookieName()] ?? '');
    if ($ck === '' || !hash_equals((string) ($st['b'] ?? ''), hash('sha256', $ck))) return $r('browser', 'Finish the sign-in in the same browser that pressed Connect Microsoft.');
    if ($err !== '') {
        if (pmNeedsAdmin($err, $desc)) { pmLog(['t' => 'msadmin', 'by' => (string) ($st['by'] ?? '')]); return $r('admin', PM_ADMIN_HELP); }
        return $r('denied', 'Microsoft did not connect (' . $err . '). Nothing was changed. Press Connect Microsoft to try again.');
    }
    $code = (string) ($get['code'] ?? ''); if (!preg_match('/^[\x21-\x7e]{8,4096}$/D', $code)) return $r('failed', 'Microsoft did not send a sign-in code back. Try again.');
    $app = pmApp(); if (!$app) return $r('failed', 'The Microsoft app keys are not on the server.');
    [$s, $tk] = pmForm(pmLogin() . '/' . $app['tenant'] . '/oauth2/v2.0/token', ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'authorization_code',
        'code' => $code, 'redirect_uri' => pmRedirect(), 'code_verifier' => (string) $st['v'], 'scope' => PM_SCOPE]);
    if (empty($tk['access_token'])) {
        $e = preg_replace('/[^a-z_]/', '', (string) ($tk['error'] ?? '')); $d = (string) ($tk['error_description'] ?? '');
        error_log('peak-mail: token exchange failed (' . $s . ', ' . $e . ')');
        if (pmNeedsAdmin($e, $d)) { pmLog(['t' => 'msadmin', 'by' => (string) ($st['by'] ?? '')]); return $r('admin', PM_ADMIN_HELP); }
        return $r('failed', 'Microsoft did not finish the sign-in (' . ($s ?: 'no answer') . ($e !== '' ? ', ' . $e : '') . '). Try again.');
    }
    $acc = (string) $tk['access_token']; $ref = (string) ($tk['refresh_token'] ?? '');
    if ($ref === '') return $r('failed', 'Microsoft did not give a lasting sign-in (no offline access). Try again.');
    $granted = strtolower((string) ($tk['scope'] ?? ''));
    foreach (['mail.send', 'mail.readwrite'] as $need) if ($granted !== '' && !str_contains($granted, $need)) return $r('failed', 'Microsoft connected without the ' . $need . ' permission. Ask Peak\'s admin to grant consent, then connect again.');
    [$s2, $wb] = pmHttp('GET', pmGraphBase() . '/v1.0/me?$select=displayName,mail,userPrincipalName', ['Authorization: Bearer ' . $acc, 'Accept: application/json'], null);
    $w = json_decode($wb, true) ?: [];
    $mail = strtolower(trim((string) (($w['mail'] ?? '') ?: ($w['userPrincipalName'] ?? ''))));
    if ($s2 !== 200 || !filter_var($mail, FILTER_VALIDATE_EMAIL)) return $r('failed', 'Signed in, but Microsoft did not say which mailbox this is. Try again.');
    $j = ['email' => $mail, 'upn' => strtolower((string) ($w['userPrincipalName'] ?? '')), 'name' => pmClean($w['displayName'] ?? '', 80), 'status' => 'ok', 'scope' => pmClean($granted, 300),
          'tok' => pmSeal(['r' => $ref, 'a' => $acc, 'x' => pmNow() + max(60, (int) ($tk['expires_in'] ?? 3600))]), 'at' => pmNow(), 'refreshed' => pmNow(), 'by' => (string) ($st['by'] ?? '')];
    if (!pmW('ms.json', $j)) return $r('failed', 'Could not save the sign-in. Try again.');
    pmLog(['t' => 'connected', 'as' => $mail, 'by' => (string) ($st['by'] ?? '')]);
    return $r('connected', 'Connected', $mail);
}
/** the connection for the page: never a token */
function pmConn(): array {
    $j = pmJ('ms.json', null); $o = ['app' => pmApp() !== null, 'connected' => false];
    if (is_array($j)) { $o += ['email' => (string) $j['email'], 'name' => (string) ($j['name'] ?? ''), 'since' => (int) ($j['at'] ?? 0), 'status' => (string) $j['status'], 'why' => (string) ($j['why'] ?? '')]; $o['connected'] = $j['status'] === 'ok'; }
    return $o;
}
function pmLost(string $why): void {
    $j = pmJ('ms.json', null); if (!is_array($j) || ($j['status'] ?? '') === 'reconnect') return;
    $j['status'] = 'reconnect'; $j['why'] = mb_substr($why, 0, 120); $j['lost'] = pmNow(); pmW('ms.json', $j);
    pmLog(['t' => 'mslost', 'why' => mb_substr($why, 0, 120)]);
}
/** a working access token: ['ok' => true, 't' => token] or ['ok' => false, 'why' => ..., 'stop' => bool]; renews under a lock */
function pmAccess(bool $force = false): array {
    $lk = @fopen(pmData() . '/ms.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    try {
        $j = pmJ('ms.json', null);
        if (!is_array($j) || ($j['status'] ?? '') !== 'ok') return ['ok' => false, 'why' => 'Microsoft is not connected.', 'stop' => true];
        $tok = pmOpen((string) ($j['tok'] ?? ''));
        if (!$tok || empty($tok['r'])) { pmLost('saved sign-in unreadable'); return ['ok' => false, 'why' => 'The saved Microsoft sign-in could not be read. Connect again.', 'stop' => true]; }
        if (!$force && !empty($tok['a']) && (int) ($tok['x'] ?? 0) > pmNow() + 120) return ['ok' => true, 't' => (string) $tok['a']];
        $app = pmApp(); if (!$app) return ['ok' => false, 'why' => 'The Microsoft app keys are missing on the server.', 'stop' => true];
        $ask = fn(string $scope) => pmForm(pmLogin() . '/' . $app['tenant'] . '/oauth2/v2.0/token', ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'refresh_token', 'refresh_token' => (string) $tok['r'], 'scope' => $scope]);
        [$s, $r] = $ask(PM_SCOPE);
        /* a sign-in made before the shared-mailbox permissions (2026-11-19) that Microsoft will not widen: renew it as it was; the shared
           mailbox then answers 403 and says so, rather than the whole sign-in being lost */
        if (empty($r['access_token']) && preg_match('/^(invalid_scope|consent_required)$/', (string) ($r['error'] ?? ''))) [$s, $r] = $ask(PM_SCOPE_BASE);
        if (empty($r['access_token'])) {
            $e = preg_replace('/[^a-z_]/', '', (string) ($r['error'] ?? ''));
            if (in_array($e, ['invalid_grant', 'interaction_required', 'consent_required', 'invalid_client', 'unauthorized_client'], true)) {
                pmLost($e . (pmNeedsAdmin($e, (string) ($r['error_description'] ?? '')) ? ' (needs admin approval)' : ''));
                return ['ok' => false, 'why' => 'The Microsoft sign-in stopped working (' . $e . '). Press Reconnect Microsoft.', 'stop' => true];
            }
            return ['ok' => false, 'why' => 'Microsoft did not renew the sign-in just now (' . ($s ?: 'no answer') . ($e !== '' ? ', ' . $e : '') . ').', 'stop' => false];
        }
        $tok['a'] = (string) $r['access_token']; $tok['x'] = pmNow() + max(60, (int) ($r['expires_in'] ?? 3600));
        if (!empty($r['refresh_token'])) $tok['r'] = (string) $r['refresh_token'];   /* Microsoft hands out a new one each time */
        $j['tok'] = pmSeal($tok); $j['refreshed'] = pmNow(); if (!empty($r['scope'])) $j['scope'] = pmClean(strtolower((string) $r['scope']), 300); pmW('ms.json', $j);
        return ['ok' => true, 't' => $tok['a']];
    } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
}
/** one Graph call with the mailbox's token: [status, decoded body, raw]; a 401 renews the token and tries once more */
function pmGraph(string $method, string $path, ?array $json = null, array $extra = [], ?string $mime = null): array {
    $a = pmAccess(); if (!$a['ok']) return [-1, ['error' => ['message' => $a['why']]], '', $a];
    for ($try = 0; $try < 2; $try++) {
        $h = array_merge(['Authorization: Bearer ' . $a['t'], 'Accept: application/json'], $json !== null ? ['Content-Type: application/json'] : ($mime !== null ? ['Content-Type: text/plain'] : []), $extra);
        [$s, $b] = pmHttp($method, pmGraphBase() . $path, $h, $json !== null ? (string) json_encode($json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : $mime);
        if ($s === 401 && $try === 0) { $a = pmAccess(true); if (!$a['ok']) return [-1, ['error' => ['message' => $a['why']]], '', $a]; continue; }
        return [$s, json_decode($b, true) ?: [], $b, $a];
    }
    return [0, [], '', $a];
}
/** keeps the sign-in alive: renewed at least once a day (a Microsoft refresh token that is never used runs out after 90 days) */
function pmKeepAlive(): void {
    $j = pmJ('ms.json', null); if (!is_array($j) || ($j['status'] ?? '') !== 'ok') return;
    if ((int) ($j['refreshed'] ?? 0) < pmNow() - 20 * 3600) pmAccess(true);
}

/* ---------------------------------------------------------------- who the emails go out as (2026-11-19) */
/** the mailbox every Peak email goes out as: ['email', 'name', 'shared' => bool, 'base' => its Graph path, 'mine' => the connected mailbox,
    'choice' => the setting]. Shared = Peak Partnerships, unless the setting says 'me' (or the connected mailbox is that address itself). */
function pmFrom(?array $set = null): array {
    $set ??= pmState()['settings']; $c = pmJ('ms.json', null); $me = strtolower((string) ($c['email'] ?? ''));
    $want = strtolower(trim((string) ($set['sendFrom'] ?? PM_SHARED)));
    if ($want !== PM_SHARED || $want === $me) return ['email' => $me, 'name' => (string) ($c['name'] ?? ''), 'shared' => false, 'base' => '/v1.0/me', 'mine' => $me, 'choice' => $want === PM_SHARED ? PM_SHARED : 'me'];
    $f = pmJ('from.json', []);
    return ['email' => PM_SHARED, 'name' => (string) (($f['name'] ?? '') ?: PM_SHARED_NAME), 'shared' => true, 'base' => '/v1.0/users/' . rawurlencode(PM_SHARED), 'mine' => $me, 'choice' => PM_SHARED];
}
/** a From: line for a MIME email sent as the shared mailbox ('' for the connected mailbox: Microsoft fills it in) */
function pmFromHead(array $F): string {
    if (empty($F['shared'])) return '';
    $n = trim(str_replace(['"', '\\', "\r", "\n", '<', '>'], '', (string) $F['name']));
    return 'From: ' . ($n !== '' ? (preg_match('/[\x80-\xFF]/', $n) ? '=?UTF-8?B?' . base64_encode($n) . '?=' : '"' . $n . '"') . ' ' : '') . '<' . $F['email'] . ">\r\n";
}
/** remember how the shared mailbox last answered: kind 'access' (it can be opened) or 'sendas' (it can be sent as); written only on a change
    (and 'access' at least every six hours, which is how old a look may be) */
function pmFromMark(string $kind, bool $ok, string $why = ''): void {
    $f = pmJ('from.json', []); $was = $f[$kind] ?? null;
    if (is_array($was) && (bool) $was['ok'] === $ok && ($ok || (string) $was['why'] === $why) && ($kind !== 'access' || (int) $was['at'] > pmNow() - 6 * 3600)) return;
    $f[$kind] = ['ok' => $ok, 'why' => mb_substr($why, 0, 200), 'at' => pmNow()]; pmW('from.json', $f);
    if (!$ok && (!is_array($was) || !empty($was['ok']))) pmLog(['t' => 'fromwarn', 'kind' => $kind, 'why' => mb_substr($why, 0, 200)]);
}
/** look at the shared mailbox (read only): can it be opened, and its display name as Microsoft has it (from its Sent Items). At most every
    six hours unless $force; nothing is sent. */
function pmFromProbe(bool $force = false, ?array $set = null): void {
    $F = pmFrom($set); if (!$F['shared'] || !pmConn()['connected']) return;
    $f = pmJ('from.json', []); if (!$force && (int) ($f['access']['at'] ?? 0) > pmNow() - 6 * 3600) return;
    [$s, $j] = pmGraph('GET', $F['base'] . '/mailFolders/inbox?$select=id');
    if ($s === -1 || $s === 0 || $s === 429 || $s >= 500) return;   /* Microsoft not answering just now says nothing about the mailbox */
    if ($s !== 200) { pmFromMark('access', false, ($s > 0 ? $s . ' ' : '') . trim((string) ($j['error']['code'] ?? '') . ': ' . (string) ($j['error']['message'] ?? ''), ': ')); return; }
    pmFromMark('access', true);
    [$s2, $j2] = pmGraph('GET', $F['base'] . '/mailFolders/sentitems/messages?$top=1&$select=from');
    $nm = $s2 === 200 ? pmClean($j2['value'][0]['from']['emailAddress']['name'] ?? '', 80) : '';
    if ($nm !== '' && strtolower((string) ($j2['value'][0]['from']['emailAddress']['address'] ?? '')) === PM_SHARED) { $f = pmJ('from.json', []); if (($f['name'] ?? '') !== $nm) { $f['name'] = $nm; pmW('from.json', $f); } }
}
/** for the pages: pmFrom() plus how it last answered, and 'warn': the plain words to show when something is wrong ('' when fine) */
function pmFromStatus(?array $set = null): array {
    $F = pmFrom($set); $f = pmJ('from.json', []); $F['warn'] = '';
    if (!$F['shared']) return $F;
    $F['access'] = $f['access'] ?? null; $F['sendas'] = $f['sendas'] ?? null;
    if (is_array($F['sendas']) && empty($F['sendas']['ok'])) $F['warn'] = PM_SENDAS . ': ' . $F['sendas']['why'] . ' (' . date('M j, g:i a', (int) $F['sendas']['at']) . '). Nothing goes out from Matthew\'s own mailbox instead.';
    elseif (is_array($F['access']) && empty($F['access']['ok'])) $F['warn'] = 'Microsoft does not let the connected mailbox open ' . PM_SHARED . ' (' . $F['access']['why'] . '). Check Full Access on Peak Partnerships in Exchange admin, then reconnect Microsoft.';
    return $F;
}

/* ---------------------------------------------------------------- settings, templates, state */
function pmDefaults(): array {
    return ['rate' => 12, 'days' => [1, 2, 3, 4, 5], 'from' => 9, 'to' => 16, 'ramp' => true,
            /* days the office is out: Thanksgiving and the day after, Christmas Eve and Day, New Year's Eve and Day */
            'skip' => ['2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01'],
            /* Peak's street address, as Peak's own website, CourtReserve and BBB list it (checked 22 Oct and 13 Nov 2026) */
            'address' => 'Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920',
            'signature' => "Matthew Sharpe\nPeak Pickleball", 'perOrg' => 1,
            /* deskNotes: put each send, reply and bounce on the Peak desk card. deskSkip (2026-11-18): leave out a company someone owns, or one
               a person touched in the last PM_TOUCH_DAYS days */
            'deskNotes' => true, 'deskSkip' => true,
            /* opens (2026-11-18, Matthew: "track all the analytics ... clicks opens, views"): each email goes as plain text plus the same words
               in HTML with a 1x1 image from o.php. Off = plain text only, as before. */
            'opens' => true,
            /* who every Peak email goes out as (2026-11-19): Peak Partnerships, or 'me' (the connected mailbox) */
            'sendFrom' => PM_SHARED,
            /* the "book a time" page (2026-11-18, Matthew: "whatever replies to come to me unless they are just booking things directly"): {book}
               in an email is a link to b.php, where they pick a time from this weekly pattern (Colorado time). Off until Matthew turns it on. */
            'book' => ['on' => false, 'kind' => 'tour', 'mins' => 30, 'ahead' => 14, 'notice' => 24,
                'week' => [2 => ['10:00-12:00', '13:00-16:00'], 3 => ['10:00-12:00', '13:00-16:00'], 4 => ['10:00-12:00', '13:00-16:00']]]];
}
/* The starting templates are PLACEHOLDERS ONLY (the real emails are written separately and Matthew approves them). They carry the DRAFT
   marker, and nothing with that marker can be started or sent. */
function pmDefaultTemplates(): array {
    $b = "[DRAFT PLACEHOLDER - NOT APPROVED. Replace this whole email with the approved copy before pressing Start.]\n\nHi {first},\n\n(The %s email for {company} goes here.)\n\nhttps://peakpickleball.us/";
    return ['sponsors' => ['subject' => '[DRAFT] Peak sponsor email - not approved', 'body' => sprintf($b, 'sponsor')],
            'expo' => ['subject' => '[DRAFT] Peak expo space email - not approved', 'body' => sprintf($b, 'expo space')]];
}
function pmIsDraft(array $t): bool { return (bool) preg_match('/\[DRAFT|DRAFT PLACEHOLDER|NOT APPROVED/i', ($t['subject'] ?? '') . "\n" . ($t['body'] ?? '')); }
function pmAddressOk(string $a): bool { return mb_strlen(trim($a)) >= 15 && !preg_match('/\[|\]|placeholder|todo|address here/i', $a) && preg_match('/\d/', $a); }

/** everything the log says, replayed */
function pmState(): array {
    $set = pmDefaults(); $tpl = pmDefaultTemplates();
    $L = []; foreach (PM_LISTS as $k => $n) $L[$k] = ['status' => 'paused', 'started' => 0, 'by' => '', 'pausedWhy' => '', 'done' => 0];
    $P = [];   /* per address: sent, reply, bounce, unsub, clicks, ... */
    $sup = []; $first = 0; $byDay = []; $recent = [];
    $p = function (string $to) use (&$P) { $to = strtolower($to); if (!isset($P[$to])) $P[$to] = ['sent' => 0, 'list' => '', 'reply' => 0, 'stop' => false, 'auto' => 0, 'bounce' => 0, 'unsub' => 0, 'clicks' => 0, 'scans' => 0, 'fails' => 0, 'bad' => '',
        'opens' => 0, 'open1' => 0, 'openLast' => 0, 'booked' => null, 'views' => 0]; return $to; };
    $B = [];   /* bookings by ref, for the slots already taken */
    foreach (pmRows() as $r) {
        $t = (string) ($r['t'] ?? ''); $at = (int) ($r['at'] ?? 0); $to = isset($r['to']) ? strtolower((string) $r['to']) : '';
        switch ($t) {
            case 'settings': foreach ((array) ($r['s'] ?? []) as $k => $v) if (array_key_exists($k, $set)) $set[$k] = $v; break;
            case 'template': if (isset($tpl[$r['l'] ?? ''])) $tpl[$r['l']] = ['subject' => (string) $r['subject'], 'body' => (string) $r['body']]; break;
            case 'start': if (isset($L[$r['l'] ?? ''])) { $L[$r['l']]['status'] = 'running'; $L[$r['l']]['started'] = $at; $L[$r['l']]['by'] = (string) ($r['by'] ?? ''); $L[$r['l']]['pausedWhy'] = ''; $L[$r['l']]['done'] = 0; } break;
            case 'pause': if (isset($L[$r['l'] ?? ''])) { $L[$r['l']]['status'] = 'paused'; $L[$r['l']]['pausedWhy'] = (string) ($r['why'] ?? ''); } break;
            case 'done': if (isset($L[$r['l'] ?? ''])) $L[$r['l']]['done'] = $at; break;
            case 'sent': $k = $p($to); $P[$k]['sent'] = $at; $P[$k]['list'] = (string) ($r['l'] ?? ''); $first = $first ?: $at; $d = date('Y-m-d', $at); $byDay[$d] = ($byDay[$d] ?? 0) + 1; $recent[] = $at; break;
            case 'fail': $k = $p($to); $P[$k]['fails']++; if (!empty($r['final'])) $P[$k]['bad'] = (string) ($r['why'] ?? 'refused'); break;
            case 'reply': $k = $p($to); $P[$k]['reply'] = $P[$k]['reply'] ?: $at; if (!empty($r['stop'])) { $P[$k]['stop'] = true; $sup[$k] = 'replied STOP'; } break;
            case 'auto': $k = $p($to); $P[$k]['auto']++; break;
            case 'bounce': $k = $p($to); $P[$k]['bounce'] = $P[$k]['bounce'] ?: $at; $sup[$k] = 'bounced'; break;
            case 'unsub': $k = $p($to); $P[$k]['unsub'] = $P[$k]['unsub'] ?: $at; $sup[$k] = 'unsubscribed'; break;
            case 'click': $k = $p($to); $P[$k]['clicks']++; break;
            case 'scan': $k = $p($to); $P[$k]['scans']++; break;
            case 'open': $k = $p($to); $P[$k]['opens']++; $P[$k]['open1'] = $P[$k]['open1'] ?: $at; $P[$k]['openLast'] = max($P[$k]['openLast'], $at); break;
            case 'bookview': $k = $p($to); $P[$k]['views']++; break;
            case 'booked': $k = $p($to); $P[$k]['booked'] = ['date' => (string) $r['date'], 'time' => (string) $r['time'], 'at' => $at, 'ref' => (string) ($r['dref'] ?? '')]; $B[(string) ($r['dref'] ?? $at)] = $r['date'] . ' ' . $r['time']; break;
            case 'suppress': $sup[$to] = 'added by hand' . (!empty($r['why']) ? ': ' . $r['why'] : ''); break;
            case 'unsuppress': if (($sup[$to] ?? '') !== '' && str_starts_with($sup[$to], 'added by hand')) unset($sup[$to]); break;
        }
    }
    $set['rate'] = max(1, min(PM_RATE_MAX, (int) $set['rate'])); $set['book'] = (array) $set['book'] + pmDefaults()['book'];
    return ['settings' => $set, 'templates' => $tpl, 'lists' => $L, 'people' => $P, 'suppressed' => $sup, 'firstSent' => $first, 'byDay' => $byDay, 'sentTimes' => $recent, 'taken' => array_values($B)];
}
/** why an address may not be emailed now ('' = it may) */
function pmBlocked(array $S, string $to): string {
    $to = strtolower($to); $x = $S['people'][$to] ?? null;
    if (isset($S['suppressed'][$to])) return 'suppressed: ' . $S['suppressed'][$to];
    if ($x && $x['sent']) return 'already emailed';
    if ($x && $x['reply']) return 'wrote to Peak already';
    if ($x && $x['bad'] !== '') return 'Microsoft refused the address: ' . $x['bad'];
    if ($x && $x['fails'] >= 3) return 'three tries failed';
    return '';
}

/* ---------------------------------------------------------------- the lists, from the Peak desk */
const PM_GENERIC = '/^(info|contact|contactus|hello|hi|sales|marketing|sponsor|sponsors|sponsorship|sponsorships|events?|admin|office|support|help|media|press|pr|news|team|community|giving|donations?|foundation|hr|careers|jobs|recruiting|billing|accounts?|accounting|finance|noreply|no-reply|mail|email|enquiries|inquiries|general|service|customerservice|reception|frontdesk|membership|members|partners?|partnerships?|advertising|ads|communications|comms|webmaster|director|manager|bookings?|reservations?|rentals?|venue|outreach|social)$/i';
function pmGeneric(string $email): bool { return (bool) preg_match(PM_GENERIC, (string) strstr($email, '@', true)); }
function pmAddrBad(string $e): string {
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) return 'does not look like an email address';
    if (preg_match('/%[0-9a-f]{2}|^(sample|example|test|your|yourname|name|someone|email)@|@(example|domain|yourdomain|email)\.|\.(png|jpe?g|gif|webp|svg)$/i', $e)) return 'a placeholder or broken address';
    if (preg_match('/@peakpickleball\.us$/i', $e)) return 'a Peak address';
    return '';
}
/** can the domain take mail (MX, or an address to fall back on); cached a month */
function pmMxOk(string $email): bool {
    if (pmEnv('PEAK_MAIL_MX') === 'skip') return true;
    $d = strtolower((string) substr((string) strrchr($email, '@'), 1)); if ($d === '') return false;
    static $c = null; if ($c === null) $c = pmJ('mx.json', []);
    if (isset($c[$d]) && $c[$d]['at'] > pmNow() - 30 * 86400) return (bool) $c[$d]['ok'];
    $ok = @checkdnsrr($d, 'MX') || @checkdnsrr($d, 'A');
    $c[$d] = ['ok' => $ok, 'at' => pmNow()]; pmW('mx.json', $c); return $ok;
}
function pmFirst(string $name, string $email): string {
    if ($name === '' || pmGeneric($email) || preg_match('/\b(inbox|team|office|desk|department|general|info|contact|staff|events|marketing|sponsorship|front|main|line)\b/i', $name)) return '';
    $p = preg_split('/\s+/', trim(preg_replace('/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i', '', $name))) ?: [];
    $f = $p[0] ?? ''; return preg_match('/^[A-Z][A-Za-z\'-]{1,30}$/', $f) ? $f : '';
}
/** the name as people say it: "(Memorial Hospital; ...)" and the legal ending off */
function pmCompany(string $n): string {
    $n = trim((string) preg_replace('/\s*\([^)]*\)\s*/', ' ', $n));
    $n = trim((string) preg_replace('/[\s,.]+(l\.?\s?l\.?\s?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|ltd\.?|limited|p\.?l\.?l\.?c\.?|l\.?l\.?p\.?)\s*$/i', '', $n), " ,.\t");
    if ($n !== '' && $n === strtoupper($n) && preg_match('/[A-Z]{4,}/', $n)) $n = ucwords(strtolower($n));
    return $n;
}
/* the town in a street address found on their website: "..., Colorado Springs, CO 80920" (the zip is required, so a street is never taken) */
function pmTown(string $addr): string { return preg_match('/([A-Z][A-Za-z.\' ]{2,30}),\s*(?:CO|Colorado)\.?\s+\d{5}/', $addr, $m) ? trim($m[1]) : ''; }

/* ---------------------------------------------------------------- the Peak desk (2026-11-18) */
const PM_BY = 'Peak email';          /* who the desk shows for everything this sender does */
const PM_TOUCH_DAYS = 14;            /* a company a person touched within this many days is left alone */
const PM_DESK_TRIES = 48;            /* a desk write is tried this many hours, then given up (and shown) */
const PM_SKIP = ['removed' => 'removed from the desk', 'sponsor' => 'already a Peak sponsor', 'signed' => 'signed or booked', 'stage' => 'someone is working it',
    'owned' => 'owned by someone', 'touched' => 'touched by a person in the last ' . PM_TOUCH_DAYS . ' days', 'noemail' => 'no email on file', 'noaddress' => 'no address that can be emailed'];
/** where the desk's record code is: beside the desk page on the server (the test points it at the repo copy) */
function pmDeskStore(): string { $e = pmEnv('PEAK_DESK_STORE'); return $e !== '' ? $e : PM_ROOT . '/public_html/peak-desk-28d38d/api/desk-store.php'; }
/** load the desk's record code, pointed at pmDesk(): '' when it is ready, otherwise why not */
function pmDeskLoad(): string {
    static $why = null; if ($why !== null) return $why;
    if (!function_exists('deskBounced')) {
        $f = pmDeskStore(); if (!is_file($f)) return $why = 'the desk\'s code is not on the server';
        if (defined('DATA_DIR') && realpath((string) DATA_DIR) !== realpath(pmDesk())) return $why = 'another desk folder is already open';
        defined('DATA_DIR') || define('DATA_DIR', pmDesk());
        try { require_once $f; } catch (Throwable $e) { return $why = 'the desk\'s code did not load (' . mb_substr($e->getMessage(), 0, 100) . ')'; }
    }
    foreach (['seedModel', 'apply', 'logRows', 'deskEmailed', 'deskReplied', 'deskBounced', 'deskBooked'] as $fn) if (!function_exists($fn)) return $why = 'the desk\'s code is an older version';
    return $why = '';
}
function pmWorld(array $p): string { return ($p['kind'] ?? '') === 'xorg' ? 'expo' : 'sponsor'; }
/** a world's companies as the desk has them (its research lists plus its log, read with the desk's own code; nothing is written): null when
    the desk cannot be read. $fresh reads the log again (the hourly run checks each company just before its email). */
function pmDeskRecs(string $w, bool $fresh = false): ?array {
    static $c = [];
    if (!$fresh && array_key_exists($w, $c)) return $c[$w];
    if (pmDeskLoad() !== '') return null;
    try { $M = seedModel($w); foreach (logRows(W($w)['log']) as $r) apply($M, $w, $r); $c[$w] = $M['recs']; }
    catch (Throwable $e) { error_log('peak-mail: desk read failed: ' . $e->getMessage()); $c[$w] = null; }
    return $c[$w];
}
/** true when the company's stage is the one this sender's own email put it in (Emailed; Contacted on expo) */
function pmOurStage(string $w, array $R): bool {
    $st = (string) ($R['stage'] ?? ''); if ($st !== ($w === 'expo' ? 'contacted' : 'emailed')) return false;
    $h = null; foreach ((array) ($R['hist'] ?? []) as $x) if (($x['to'] ?? '') === $st) $h = $x;
    return $h !== null && ($h['by'] ?? '') === PM_BY;
}
/** why a desk company is left off the lists (a PM_SKIP key), '' when it may be emailed */
function pmCompanySkip(string $w, array $R, array $set, int $now): string {
    if (!empty($R['off'])) return 'removed';
    if ($w === 'sponsor' && ($R['list'] ?? '') === 'renew') return 'sponsor';
    if (!empty($R['signed']) || in_array((string) $R['stage'], ['signed', 'booked'], true)) return 'signed';
    if ((string) $R['stage'] !== 'new' && !pmOurStage($w, $R)) return 'stage';
    if (!empty($set['deskSkip'])) {
        $o = (string) ($R['owner'] ?? ''); if ($o !== '' && $o !== PM_BY) return 'owned';
        foreach ((array) ($R['touches'] ?? []) as $t) if (($t['by'] ?? '') !== PM_BY && empty($t['auto']) && (int) ($t['when'] ?? 0) >= $now - PM_TOUCH_DAYS * 86400) return 'touched';
    }
    return '';
}
function pmSkipWhy(string $w, string $code, array $R): string {
    if ($code === 'stage') { $S = W($w)['stages']; return 'the desk shows ' . ($S[$R['stage']] ?? $R['stage']) . ': someone is already working it'; }
    if ($code === 'owned') return 'owned by ' . $R['owner'] . ' on the desk';
    if ($code === 'touched') { $l = null; foreach ((array) ($R['touches'] ?? []) as $t) if (($t['by'] ?? '') !== PM_BY && empty($t['auto']) && (!$l || $t['when'] > $l['when'])) $l = $t; return 'touched by ' . ($l['by'] ?? 'a person') . ' on ' . date('M j', (int) ($l['when'] ?? 0)); }
    return PM_SKIP[$code] ?? $code;
}
/** just before an email: why this person's company should not get it now ('' = send). The desk is read again for this. */
function pmSkipNow(array $p, array $set): string {
    $w = pmWorld($p); $all = pmDeskRecs($w, true);
    if ($all === null) return 'the Peak desk could not be read';
    $R = $all[$p['org']] ?? null; if (!$R) return 'no longer on the desk';
    $c = pmCompanySkip($w, $R, $set, pmNow()); return $c === '' ? '' : pmSkipWhy($w, $c, $R);
}

/** both lists as the desk has them now: ['lists' => [list => [person ...]], 'left' => [list => [[name, why, code] ...]], 'skips' => [list =>
    [code => n]], 'error' => '']. One person per address across both lists (sponsors first); per organisation up to perOrg people are queued,
    the others are kept as "held". When the desk cannot be read nobody is queued and 'error' says why. */
function pmImport(array $set): array {
    $perOrg = max(1, min(3, (int) ($set['perOrg'] ?? 1))); $now = pmNow();
    $lists = ['sponsors' => [], 'expo' => []]; $left = ['sponsors' => [], 'expo' => []]; $skips = ['sponsors' => [], 'expo' => []]; $used = [];
    $SP = pmDeskRecs('sponsor'); $XP = pmDeskRecs('expo');
    if ($SP === null || $XP === null) return ['lists' => $lists, 'left' => $left, 'skips' => $skips, 'error' => 'The Peak desk could not be read (' . (pmDeskLoad() ?: 'its records did not load') . '), so nobody is queued until it can be.'];
    $leave = function (string $list, string $name, string $code, string $why) use (&$left, &$skips) { $left[$list][] = ['name' => $name, 'why' => $why, 'code' => $code]; $skips[$list][$code] = ($skips[$list][$code] ?? 0) + 1; };
    /* the addresses of current Peak sponsors (the Peak sponsors tab): never emailed from either list */
    $peakMail = [];
    foreach ($SP as $R) if (($R['list'] ?? '') === 'renew') foreach (array_merge((array) ($R['contacts'] ?? []), (array) ($R['added'] ?? [])) as $c) if (!empty($c['email'])) $peakMail[strtolower((string) $c['email'])] = (string) ($R['name'] ?? '');
    $add = function (string $list, string $org, string $kind, string $company, string $town, array $cands) use (&$lists, &$used, $perOrg, $peakMail): int {
        $n = 0; $seen = [];
        foreach ($cands as $c) {
            $to = strtolower(trim((string) $c['email'])); if ($to === '' || isset($seen[$to])) continue; $seen[$to] = 1;
            $flags = []; if (pmGeneric($to)) $flags[] = 'generic'; if (!empty($c['guess'])) $flags[] = 'guessed';
            $bad = pmAddrBad($to);
            if ($bad === '' && isset($peakMail[$to])) $bad = 'a contact at a current Peak sponsor (' . $peakMail[$to] . ')';
            if ($bad === '' && !pmMxOk($to)) $bad = 'its domain cannot take mail';
            $hold = $bad;
            if ($hold === '' && isset($used[$to])) $hold = 'same address as ' . $used[$to];
            if ($hold === '' && $n >= $perOrg) $hold = 'another contact at this organisation is queued';
            if ($hold === '') { $n++; $used[$to] = $company . ' (' . PM_LISTS[$list] . ')'; }
            $lists[$list][] = ['rid' => pmRid($to), 'to' => $to, 'first' => pmFirst((string) $c['name'], $to), 'person' => pmClean($c['name'], 80), 'role' => pmClean($c['role'], 100),
                'company' => $company, 'town' => $town, 'org' => $org, 'kind' => $kind, 'flags' => $flags, 'hold' => $hold, 'src' => (string) ($c['src'] ?? '')];
        }
        return $n;
    };
    $scans = pmDeskJ('scans.json', []);
    foreach ($SP as $id => $R) {
        $id = (string) $id; $name = (string) ($R['name'] ?? ''); $code = pmCompanySkip('sponsor', $R, $set, $now);
        $c = [];
        foreach ((array) ($R['contacts'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['pos'] ?? ''), 'pick' => !empty($x['pick']), 'conf' => $x['conf'] ?? null, 'src' => 'desk research', 'guess' => is_numeric($x['conf'] ?? null) && (int) $x['conf'] < 80];
        foreach ((array) ($R['added'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['pos'] ?? $x['role'] ?? ''), 'pick' => true, 'conf' => 100, 'src' => 'added on the desk', 'guess' => false];
        foreach ((array) ($scans[$id]['emails'] ?? []) as $e) if (is_string($e) && $e !== '') $c[] = ['email' => $e, 'name' => '', 'role' => 'on their website', 'pick' => false, 'conf' => 90, 'src' => 'their website', 'guess' => false];
        if ($code === '' && !$c) $code = 'noemail';
        if ($code !== '') { $leave('sponsors', $name, $code, pmSkipWhy('sponsor', $code, $R)); continue; }
        /* who first: the desk's own pick, then a named person over a shared inbox, then the surest address */
        usort($c, fn($a, $b) => [(int) $b['pick'], (int) !pmGeneric((string) $b['email']), (int) ($b['conf'] ?? 75)] <=> [(int) $a['pick'], (int) !pmGeneric((string) $a['email']), (int) ($a['conf'] ?? 75)]);
        if ($add('sponsors', $id, 'lead', pmCompany($name), pmTown((string) ($scans[$id]['addr'] ?? '')), $c) === 0) $leave('sponsors', $name, 'noaddress', PM_SKIP['noaddress']);
    }
    uasort($XP, fn($a, $b) => ((int) ($a['pri'] ?? 9)) <=> ((int) ($b['pri'] ?? 9)));
    foreach ($XP as $id => $R) {
        $id = (string) $id; $name = (string) ($R['name'] ?? ''); $code = pmCompanySkip('expo', $R, $set, $now);
        $c = [];
        foreach ((array) ($R['contacts'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['role'] ?? ''), 'pick' => !empty($x['best']), 'conf' => stripos((string) ($x['estat'] ?? ''), 'published') !== false ? 95 : 70, 'src' => 'desk research', 'guess' => stripos((string) ($x['estat'] ?? ''), 'pattern') !== false || stripos((string) ($x['estat'] ?? ''), 'unverified') !== false];
        foreach ((array) ($R['added'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['role'] ?? $x['pos'] ?? ''), 'pick' => true, 'conf' => 100, 'src' => 'added on the desk', 'guess' => false];
        if ($code === '' && !$c) $code = 'noemail';
        if ($code !== '') { $leave('expo', $name, $code, pmSkipWhy('expo', $code, $R)); continue; }
        usort($c, fn($a, $b) => [(int) $b['pick'], (int) !pmGeneric((string) $b['email']), (int) $b['conf']] <=> [(int) $a['pick'], (int) !pmGeneric((string) $a['email']), (int) $a['conf']]);
        if ($add('expo', $id, 'xorg', pmCompany($name), '', $c) === 0) $leave('expo', $name, 'noaddress', PM_SKIP['noaddress']);
    }
    return ['lists' => $lists, 'left' => $left, 'skips' => $skips, 'error' => ''];
}
/** the skip counts in words, biggest first: [["owned by someone", 3], ...] */
function pmSkipList(array $counts): array { arsort($counts); $o = []; foreach ($counts as $k => $n) $o[] = [PM_SKIP[$k] ?? (string) $k, (int) $n]; return $o; }

/* ---- what the desk is told: each sent / reply / bounce / unsub row carries w (sponsor|expo), org (the desk id) and dref (the ref the desk
   keeps, so telling it twice is harmless). A 'desk' row records each try. A failed try never touches the send; the next run tries again. */
function pmDeskTag(array $p, string $ref): array { return ['w' => pmWorld($p), 'org' => (string) $p['org'], 'dref' => $ref]; }
/** tell the desk about one row: ['ok' => bool, 'final' => bool (no point trying again), 'why' => ...]; never throws */
function pmDeskPush(array $r): array {
    try {
        if (pmEnv('PEAK_MAIL_DESKFAIL') !== '') throw new RuntimeException('the desk did not answer (test)');
        $l = pmDeskLoad(); if ($l !== '') return ['ok' => false, 'final' => false, 'why' => $l];
        /* the desk waits on its lock for as long as it takes; the sender waits at most 8 seconds, then leaves it for the next run */
        $fh = @fopen(pmDesk() . '/desk.lock', 'c'); if (!$fh) return ['ok' => false, 'final' => false, 'why' => 'the desk\'s lock file could not be opened'];
        $free = false; for ($i = 0; $i < 40 && !($free = flock($fh, LOCK_EX | LOCK_NB)); $i++) usleep(200000);
        if ($free) flock($fh, LOCK_UN); fclose($fh);
        if (!$free) return ['ok' => false, 'final' => false, 'why' => 'the desk was busy'];
        $w = (string) $r['w']; $org = (string) $r['org']; $ref = (string) $r['dref']; $to = (string) ($r['to'] ?? ''); $who = (string) ($r['who'] ?? '') ?: $to;
        $x = match ((string) ($r['t'] ?? '')) {
            'sent' => deskEmailed($w, $org, $to, (string) ($r['subject'] ?? ''), PM_BY, $ref, (int) ($r['at'] ?? 0)),
            /* a reply (2026-11-19: with its own words, read from Peak Partnerships, shown on the card for everyone on the desk) */
            'reply' => is_array($r['mail'] ?? null)
                ? deskReplied($w, $org, $who, '“' . (string) ($r['mail']['subject'] ?? '') . '”' . (($r['mail']['mb'] ?? '') === PM_SHARED ? '' : ' (in Matthew\'s mailbox)'), PM_BY, $ref, !empty($r['stop']), (array) $r['mail'])
                : deskReplied($w, $org, $who, 'the reply is in Matthew\'s Peak Outlook (' . date('M j', (int) ($r['at'] ?? pmNow())) . ')', PM_BY, $ref, !empty($r['stop'])),
            'auto' => function_exists('deskAutoReplied') ? deskAutoReplied($w, $org, $who, (array) ($r['mail'] ?? []), PM_BY, $ref) : ['ok' => false, 'code' => 400, 'error' => 'the desk\'s code is an older version'],
            'unsub' => deskReplied($w, $org, $who, 'used the unsubscribe link in the email (' . date('M j', (int) ($r['at'] ?? pmNow())) . ')', PM_BY, $ref, true),
            'bounce' => deskBounced($w, $org, $to, '', PM_BY, $ref),
            'booked' => deskBooked($w, $org, (string) ($r['date'] ?? ''), (string) ($r['time'] ?? ''), trim($who . ($to !== '' && $to !== $who ? ' <' . $to . '>' : '')),
                'Booked online from the Peak email: ' . (PM_BOOK_KINDS[(string) ($r['kind'] ?? '')] ?? 'Tour of Peak') . ', ' . (int) ($r['mins'] ?? 30) . ' minutes' . (!empty($r['note']) ? '. They wrote: ' . $r['note'] : ''), PM_BY, $ref),
            default => ['ok' => false, 'code' => 400, 'error' => 'nothing to tell the desk'],
        };
        if (!empty($x['ok'])) return ['ok' => true, 'final' => true, 'why' => !empty($x['dup']) ? 'already on the desk' : '', 'stage' => (string) ($x['stage'] ?? '')];
        return ['ok' => false, 'final' => in_array((int) ($x['code'] ?? 0), [400, 404], true), 'why' => (string) ($x['error'] ?? 'the desk said no')];
    } catch (Throwable $e) { return ['ok' => false, 'final' => false, 'why' => mb_substr($e->getMessage(), 0, 160)]; }
}
/** the rows the desk has not been told about yet, by ref (with how many tries so far) */
function pmDeskPending(?array $rows = null): array {
    $jobs = []; $done = []; $tries = [];
    foreach ($rows ?? pmRows() as $r) {
        $t = (string) ($r['t'] ?? ''); $k = (string) ($r[$t === 'desk' ? 'ref' : 'dref'] ?? ''); if ($k === '') continue;
        if ($t === 'desk') { if (!empty($r['ok']) || !empty($r['final'])) $done[$k] = 1; else $tries[$k] = ($tries[$k] ?? 0) + 1; }
        elseif (in_array($t, ['sent', 'reply', 'bounce', 'unsub', 'booked', 'auto'], true) && !empty($r['org']) && !empty($r['w'])) $jobs[$k] = $r;
    }
    $o = []; foreach ($jobs as $k => $r) if (!isset($done[$k])) $o[$k] = $r + ['tries' => $tries[$k] ?? 0];
    return $o;
}
/** tell the desk about one row now, and log the try: 'ok', 'final' (refused for good, e.g. the company is gone) or 'later'. After one 'later'
    the rest of this run's rows wait for the next run (no time is lost on a desk that is down). */
function pmDeskNow(array $r, array $set, int $tries = 0): string {
    static $down = false;
    if (empty($set['deskNotes']) || empty($r['dref']) || $down) return 'later';
    $x = pmDeskPush($r); $final = $x['final'] || (!$x['ok'] && $tries + 1 >= PM_DESK_TRIES);
    pmLog(['t' => 'desk', 'ref' => (string) $r['dref'], 'op' => (string) $r['t'], 'w' => (string) $r['w'], 'org' => (string) $r['org'], 'ok' => $x['ok'], 'final' => $final,
        'why' => $x['why'] . (!$x['ok'] && $final && !$x['final'] ? ' (gave up after ' . PM_DESK_TRIES . ' tries)' : '')]);
    if ($x['ok']) return 'ok';
    if ($final) return 'final';
    $down = true; return 'later';
}
/** at the start of each run: anything the desk missed, oldest first. A few words for run.log ('' when nothing was waiting). */
function pmDeskFlush(array $set): string {
    if (empty($set['deskNotes'])) return '';
    $p = pmDeskPending(); if (!$p) return '';
    $ok = 0; foreach ($p as $r) { $x = pmDeskNow($r, $set, (int) $r['tries']); if ($x === 'ok') $ok++; elseif ($x === 'later') break; }
    $still = count(pmDeskPending());
    return 'desk: ' . $ok . ' caught up' . ($still ? ', ' . $still . ' still waiting' : '');
}
/** import and save; a running list that gains people is paused, so nobody new is emailed without Matthew's Start */
function pmImportSave(string $by): array {
    $S = pmState(); $old = pmJ('lists.json', null); $new = pmImport($S['settings']);
    if ($new['error'] !== '') return ['error' => $new['error']];   /* the lists already brought in stay as they are */
    $out = ['at' => pmNow(), 'lists' => $new['lists'], 'left' => $new['left'], 'skips' => $new['skips']]; pmW('lists.json', $out);
    $diff = [];
    foreach (PM_LISTS as $k => $n) {
        $was = []; foreach ((array) ($old['lists'][$k] ?? []) as $p) if ($p['hold'] === '') $was[$p['to']] = 1;
        $now = array_filter($new['lists'][$k], fn($p) => $p['hold'] === '');
        $added = count(array_filter($now, fn($p) => !isset($was[$p['to']])));
        $diff[$k] = ['queued' => count($now), 'added' => $old ? $added : count($now), 'held' => count($new['lists'][$k]) - count($now), 'left' => count($new['left'][$k]),
            'orgs' => count(array_unique(array_column($now, 'org'))), 'skips' => $new['skips'][$k]];
        if ($old && $added > 0 && $S['lists'][$k]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $k, 'by' => $by, 'why' => $added . ' new people came in from the Peak desk: check the preview and press Start again']);
    }
    pmLog(['t' => 'import', 'by' => $by, 'counts' => $diff]);
    return $diff;
}

/* ---------------------------------------------------------------- one email */
function pmUnsubUrl(string $rid): string { return pmLinkBase() . '/u.php?r=' . $rid . '&s=' . pmSig('u|' . $rid); }
/** a web address in an email, through r.php (the address itself is kept in links.json by a short key) */
function pmTrack(string $url, string $rid, bool $save): string {
    $h = substr(hash('sha256', $url), 0, 8);
    if ($save) { $m = pmJ('links.json', []); if (($m[$h] ?? '') !== $url) { $m[$h] = $url; pmW('links.json', $m); } }
    return pmLinkBase() . '/r.php?r=' . $rid . '&l=' . $h . '&s=' . pmSig('r|' . $rid . '|' . $h);
}
/** one person's email: subject, body (plain text), and what to warn about */
function pmRender(array $p, array $tpl, array $set, bool $save = false): array {
    /* merge fields, each with a fallback that still reads right when the desk has no value */
    $v = ['{first}' => $p['first'] !== '' ? $p['first'] : 'there', '{company}' => $p['company'] !== '' ? $p['company'] : 'your team', '{town}' => $p['town'] !== '' ? $p['town'] : 'your area'];
    $usedTpl = (string) $tpl['subject'] . "\n" . (string) $tpl['body']; $miss = [];
    foreach (['first' => 'first name', 'company' => 'company', 'town' => 'town'] as $f => $label) if ($p[$f] === '' && str_contains($usedTpl, '{' . $f . '}')) $miss[] = $label;
    $subject = pmClean(strtr((string) $tpl['subject'], $v), 200);
    $main = rtrim(strtr(pmText($tpl['body'], 8000), $v));
    $links = 0; $labels = [];
    $main = (string) preg_replace_callback('~\bhttps?://[^\s<>()"\']+[^\s<>().,;:!?"\']~i', function ($m) use ($p, $save, &$links, &$labels) {
        $links++; $t = pmTrack($m[0], $p['rid'], $save); $labels[$t] = pmLinkLabel($m[0]); return $t; }, $main);
    /* {book}: their own link to the book-a-time page (not sent through r.php: the page counts its own views) */
    $subject = trim(str_replace('{book}', '', $subject));
    if (str_contains($main, '{book}')) { $bu = pmBookUrl($p['rid']); $labels[$bu] = 'Book a time'; $main = str_replace('{book}', $bu, $main); }
    $sig = trim((string) $set['signature']);
    $body = $main . "\n\n" . ($sig !== '' ? $sig . "\n" : '') . trim((string) $set['address'])
          /* 2026-11-20 (Matthew): no Traverse address in Peak's words, so the opt-out is a reply. STOP replies are read and suppressed;
             u.php stays for links already sent. The links themselves are on Peak's own address once it is on (pmLinkBase, X-16). */
          . "\n\nIf you'd rather not hear from us again, just reply STOP.";
    $m = ['to' => $p['to'], 'name' => $p['person'], 'subject' => $subject, 'body' => $body, 'links' => $links, 'fallbacks' => $miss];
    if (!empty($set['opens'])) $m['html'] = pmHtml($body, pmOpenUrl($p['rid']), $sig, $labels);
    if (preg_match('/\{[a-z_]+\}/i', $subject . "\n" . $main, $ph)) $m['badph'] = $ph[0];
    return $m;
}
/** the HTML part: the same words as the plain text, its web addresses as links, and the 1x1 open image at the end */
const PM_LOGO = 'peak-logo.png';   /* Peak's own logo (from peakpickleball.us, 852x90), served from this folder */
/** what the reader sees for a link: the address they will land on, short ("peakpickleball.us", "peakpickleball.us/events") */
function pmLinkLabel(string $url): string {
    $u = parse_url($url); $host = strtolower((string) ($u['host'] ?? ''));
    if ($host === '') return $url;
    if (str_starts_with($host, 'www.')) $host = substr($host, 4);
    $path = rtrim((string) ($u['path'] ?? ''), '/');
    return $host . $path;
}
/* $labels: tracked address => the words shown for it (2026-11-20, Matthew: show peakpickleball.us, "keep the tracking"). The link still goes
   through r.php on Peak's own name; label and link share peakpickleball.us, so filters see no mismatched domain. Plain text keeps the address. */
function pmHtml(string $text, string $pixel, string $sig = '', array $labels = []): string {
    $h = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $h = (string) preg_replace_callback('~\bhttps?://[^\s<>"\']+[^\s<>().,;:!?"\']~i', function ($m) use ($labels) {
        $raw = html_entity_decode($m[0], ENT_QUOTES, 'UTF-8');
        $show = isset($labels[$raw]) ? htmlspecialchars($labels[$raw], ENT_QUOTES, 'UTF-8') : $m[0];
        return '<a href="' . $m[0] . '">' . $show . '</a>'; }, $h);
    /* Peak's logo under the signature (2026-11-20, Matthew: "does the signature have the peak logo? because it should"); HTML part only,
       the plain-text part is unchanged */
    $hs = htmlspecialchars($sig, ENT_QUOTES, 'UTF-8');
    if ($hs !== '' && ($i = strrpos($h, $hs)) !== false)
        $h = substr($h, 0, $i + strlen($hs)) . "\x01" . substr($h, $i + strlen($hs));
    $h = str_replace("\n", "<br>\n", $h);
    $h = str_replace("\x01", '<img src="' . htmlspecialchars(pmLinkBase() . '/' . PM_LOGO, ENT_QUOTES, 'UTF-8') . '" width="220" alt="Peak Pickleball" style="display:block;border:0;width:220px;max-width:100%;height:auto;margin:8px 0 2px">', $h);
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div style="font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;color:#111">'
        . $h . '</div><img src="' . htmlspecialchars($pixel, ENT_QUOTES, 'UTF-8') . '" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"></body></html>';
}
function pmOpenUrl(string $rid): string { return pmLinkBase() . '/o.php?r=' . $rid . '&s=' . pmSig('o|' . $rid); }
/* on the Peak name b.php is /book.php: SiteGround's front server refuses /b.php (and most one-letter .php names) at the top of a site */
function pmBookUrl(string $rid): string { $b = pmLinkBase(); return $b . ($b !== pmBase() ? '/book.php' : '/b.php') . '?r=' . $rid . '&s=' . pmSig('b|' . $rid); }
/** the person on the lists with this link id, with their list ([] when none) */
function pmByRid(string $rid): array {
    foreach ((array) (pmJ('lists.json', ['lists' => []])['lists'] ?? []) as $k => $ps) foreach ($ps as $p) if (($p['rid'] ?? '') === $rid) return $p + ['list' => $k];
    return [];
}
/** the whole email as MIME, plain text first and HTML second (multipart/alternative), for Graph's MIME sendMail */
function pmMime(array $m): string {
    $b = 'pm-' . bin2hex(random_bytes(12)); $enc = fn(string $s) => preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $to = $m['to']; $nm = trim((string) ($m['name'] ?? '')); if ($nm !== '') $to = $enc(str_replace(['"', '\\'], '', $nm)) . ' <' . $m['to'] . '>';
    $part = fn(string $type, string $s) => "--$b\r\nContent-Type: $type; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . rtrim(chunk_split(base64_encode($s), 76, "\r\n")) . "\r\n";
    return "To: $to\r\n" . (string) ($m['fromHead'] ?? '') . "Subject: " . $enc((string) $m['subject']) . "\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$b\"\r\n\r\n"
        . $part('text/plain', str_replace("\n", "\r\n", (string) $m['body'])) . $part('text/html', (string) $m['html']) . "--$b--\r\n";
}
/** send one email as pmFrom() (Peak Partnerships, or the connected mailbox): ['ok' => true, 'from' => address] or ['ok' => false, 'kind' =>
    server|address|blocked|auth|sendas|other, 'why']. As the shared mailbox a refusal (403, ErrorSendAsDenied, the mailbox gone) is 'sendas':
    said plainly, and never sent from Matthew's own mailbox instead. Saved in that mailbox's Sent Items. */
function pmSendOne(array $m, ?array $set = null, ?array $F = null): array {
    $F ??= pmFrom($set); $p = $F['base'] . '/sendMail';
    if (isset($m['mime'])) [$s, $j, $raw, $a] = pmGraph('POST', $p, null, [], base64_encode((string) $m['mime']));   /* a whole MIME email made by the caller (its From: line from pmFromHead) */
    elseif (isset($m['html'])) [$s, $j, $raw, $a] = pmGraph('POST', $p, null, [], base64_encode(pmMime($m + ['fromHead' => pmFromHead($F)])));   /* MIME: saved to Sent Items too */
    else {
        $msg = ['message' => ['subject' => $m['subject'], 'body' => ['contentType' => 'Text', 'content' => $m['body']],
                'toRecipients' => [['emailAddress' => array_filter(['address' => $m['to'], 'name' => $m['name'] ?? ''], 'strlen')]]], 'saveToSentItems' => true];
        if ($F['shared']) $msg['message']['from'] = ['emailAddress' => ['address' => $F['email'], 'name' => $F['name']]];
        [$s, $j, $raw, $a] = pmGraph('POST', $p, $msg);
    }
    if ($s === 202 || $s === 200) { if ($F['shared']) pmFromMark('sendas', true); return ['ok' => true, 'from' => $F['email']]; }
    return pmSendErr($s, $j, $raw, $a, $F);
}
/** what a refused send means, in the shape pmSendOne answers */
function pmSendErr(int $s, array $j, string $raw, array $a, array $F): array {
    if ($s === -1) return ['ok' => false, 'kind' => !empty($a['stop']) ? 'auth' : 'server', 'why' => (string) ($j['error']['message'] ?? 'not connected')];
    $code = (string) ($j['error']['code'] ?? ''); $why = mb_substr(trim($code . ': ' . (string) ($j['error']['message'] ?? '')), 0, 200);
    /* Microsoft holding the whole tenant's or mailbox's sending back (spam, quota) is the same trouble whichever mailbox it is */
    if (preg_match('/SubmissionBlocked|OutboundSpam|QuotaExceeded|suspended/i', $code)) return ['ok' => false, 'kind' => 'blocked', 'why' => $why];
    if ($F['shared'] && ($s === 403 || $s === 404 || preg_match('/SendAsDenied|AccessDenied|MailboxNotFound|ResourceNotFound/i', $code))) {
        pmFromMark('sendas', false, $s . ' ' . $why);
        return ['ok' => false, 'kind' => 'sendas', 'why' => PM_SENDAS . ': ' . $s . ' ' . $why];
    }
    if (preg_match('/SubmissionBlocked|OutboundSpam|SendAsDenied|QuotaExceeded|MailboxNotEnabled|blocked|suspended/i', $code . ' ' . $raw)) return ['ok' => false, 'kind' => 'blocked', 'why' => $why];
    if ($s === 403 || $s === 401) return ['ok' => false, 'kind' => 'auth', 'why' => $why];
    if ($s === 0 || $s === 429 || $s >= 500) return ['ok' => false, 'kind' => 'server', 'why' => ($s ?: 'no answer') . ' ' . $why];
    if (preg_match('/InvalidRecipients|InvalidRecipient|ErrorInvalidEmail|recipient/i', $code . ' ' . $why)) return ['ok' => false, 'kind' => 'address', 'why' => $why];
    return ['ok' => false, 'kind' => 'other', 'why' => $s . ' ' . $why];
}

/* ---------------------------------------------------------------- tour confirmations (2026-11-19) */
/* The Peak desk (api/tour-mail.php) sends a tour confirmation through this mailbox when someone books, moves or cancels a tour with a
   contact's email (OFF until Matthew turns it on in the desk's Settings). The desk writes the words and the calendar invite; this sends
   them: one email per ref (tc-<tour>-<version>-<r|c>), checked under a lock against this log, so a retry never sends twice. It is outside
   the outreach lists, the hourly rate and the sending window (it answers a booking), and carries no open image and no tracked links. Each
   try is a 'tourmail' row in events.log; Outbox's Peak section counts them. */
function pmTourRow(string $ref): ?array { $o = null; foreach (pmRows() as $r) if (($r['t'] ?? '') === 'tourmail' && ($r['ref'] ?? '') === $ref && !empty($r['ok'])) $o = $r; return $o; }
/** the email as MIME: multipart/mixed { multipart/alternative { text, HTML, text/calendar; method }, the invite as invite.ics } */
function pmTourMime(array $m): string {
    $enc = fn(string $s) => preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $b64 = fn(string $s) => rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
    $mx = 'pmx-' . bin2hex(random_bytes(10)); $al = 'pma-' . bin2hex(random_bytes(10)); $meth = ($m['method'] ?? '') === 'CANCEL' ? 'CANCEL' : 'REQUEST';
    $to = (string) $m['to']; $nm = trim(str_replace(['"', '\\', "\r", "\n"], '', (string) ($m['name'] ?? ''))); if ($nm !== '') $to = $enc($nm) . ' <' . $to . '>';
    $part = fn(string $bd, string $head, string $body) => "--$bd\r\n$head\r\nContent-Transfer-Encoding: base64\r\n\r\n" . $b64($body) . "\r\n";
    return "To: $to\r\n" . (string) ($m['fromHead'] ?? '') . "Subject: " . $enc((string) $m['subject']) . "\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$mx\"\r\n\r\n"
        . "--$mx\r\nContent-Type: multipart/alternative; boundary=\"$al\"\r\n\r\n"
        . $part($al, 'Content-Type: text/plain; charset=UTF-8', str_replace("\n", "\r\n", str_replace("\r", '', (string) $m['text'])))
        . $part($al, 'Content-Type: text/html; charset=UTF-8', (string) $m['html'])
        . $part($al, 'Content-Type: text/calendar; charset=UTF-8; method=' . $meth, (string) $m['ics'])
        . "--$al--\r\n"
        . $part($mx, 'Content-Type: application/ics; name="invite.ics"' . "\r\n" . 'Content-Disposition: attachment; filename="invite.ics"', (string) $m['ics'])
        . "--$mx--\r\n";
}
/** send one tour confirmation now: ['ok' => true, 'dup' => bool] or ['ok' => false, 'kind' => ..., 'why' => ...]; never throws */
function pmTourSend(array $m): array {
    try {
        if (!pmReady()) return ['ok' => false, 'kind' => 'setup', 'why' => 'the Peak email data folder is missing'];
        $ref = (string) ($m['ref'] ?? ''); $to = strtolower(trim((string) ($m['to'] ?? '')));
        if (!preg_match('/^[a-z0-9-]{4,80}$/', $ref)) return ['ok' => false, 'kind' => 'other', 'why' => 'no reference for this email'];
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'kind' => 'address', 'why' => 'that email does not look right'];
        if (trim((string) ($m['subject'] ?? '')) === '' || trim((string) ($m['text'] ?? '')) === '' || !str_contains((string) ($m['ics'] ?? ''), 'BEGIN:VCALENDAR')) return ['ok' => false, 'kind' => 'other', 'why' => 'the email is incomplete'];
        $lk = @fopen(pmData() . '/tour.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
        try {
            if (pmTourRow($ref)) return ['ok' => true, 'dup' => true];
            $F = pmFrom(); $x = pmSendOne(['to' => $to, 'mime' => pmTourMime(['to' => $to, 'fromHead' => pmFromHead($F)] + $m)], null, $F);
            $row = ['t' => 'tourmail', 'ref' => $ref, 'to' => $to, 'from' => $F['email'], 'method' => ($m['method'] ?? '') === 'CANCEL' ? 'CANCEL' : 'REQUEST', 'seq' => (int) ($m['seq'] ?? 0),
                'w' => (string) ($m['w'] ?? ''), 'org' => (string) ($m['org'] ?? ''), 'company' => pmClean($m['company'] ?? '', 100), 'tid' => (string) ($m['tid'] ?? ''), 'by' => pmClean($m['by'] ?? '', 60),
                'subject' => pmClean($m['subject'] ?? '', 160), 'ok' => !empty($x['ok'])];
            if (!empty($m['test'])) $row['test'] = 1;
            if (empty($x['ok'])) { $row['kind'] = (string) ($x['kind'] ?? 'other'); $row['why'] = mb_substr((string) ($x['why'] ?? ''), 0, 200); }
            pmLog($row);
            if (!empty($x['ok'])) return ['ok' => true, 'dup' => false];
            $why = pmWhyText($row['kind'], $row['why']);
            return ['ok' => false, 'kind' => $row['kind'], 'why' => $why];
        } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
    } catch (Throwable $e) { return ['ok' => false, 'kind' => 'other', 'why' => mb_substr($e->getMessage(), 0, 160)]; }
}
/** for Outbox: tour confirmations sent (times), and the ones whose last try failed with no later success for that tour */
function pmTourStats(?array $rows = null): array {
    $sent = []; $last = []; $tests = 0;
    foreach ($rows ?? pmRows() as $r) {
        if (($r['t'] ?? '') !== 'tourmail') continue;
        if (!empty($r['test'])) { if (!empty($r['ok'])) $tests++; continue; }
        if (!empty($r['ok'])) $sent[] = (int) ($r['at'] ?? 0);
        $k = (string) ($r['w'] ?? '') . '|' . (string) ($r['tid'] ?? ''); $last[$k] = $r;
    }
    $open = array_values(array_filter($last, fn($r) => empty($r['ok'])));
    return ['sent' => $sent, 'tests' => $tests, 'open' => array_map(fn($r) => ['at' => (int) ($r['at'] ?? 0), 'company' => (string) ($r['company'] ?? ''), 'to' => (string) ($r['to'] ?? ''),
        'method' => (string) ($r['method'] ?? ''), 'why' => (string) ($r['why'] ?? ''), 'by' => (string) ($r['by'] ?? '')], $open)];
}
/* ---------------------------------------------------------------- desk emails (2026-11-19) */
/* A seller writes an email to one prospect on the Peak desk (app/api/desk-email.php, OFF until Matthew turns "Desk emails" on in the desk's
   Settings) and it goes from this mailbox: the desk writes the words, this sends them, once per ref (dm + 10 hex), checked under a lock
   against this log (rows 'deskmail'). Outside the outreach lists, the hourly rate and the sending window (a person wrote it and pressed Send).
   Plain text plus the same words as simple HTML; an open image only when the desk's admin setting asks for one (off by default); the one
   link that is counted is the booking link, which the desk's booking page counts itself. Reply-To is the seller's own address when they set
   one, so their replies go to them. */
function pmDeskRow(string $ref): ?array { $o = null; foreach (pmRows() as $r) if (($r['t'] ?? '') === 'deskmail' && ($r['ref'] ?? '') === $ref && !empty($r['ok'])) $o = $r; return $o; }
function pmDeskMime(array $m): string {
    $enc = fn(string $s) => preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $b64 = fn(string $s) => rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
    $al = 'pmd-' . bin2hex(random_bytes(10));
    $to = (string) $m['to']; $nm = trim(str_replace(['"', '\\', "\r", "\n", '<', '>'], '', (string) ($m['name'] ?? ''))); if ($nm !== '') $to = $enc($nm) . ' <' . $to . '>';
    $rt = strtolower(trim((string) ($m['replyTo'] ?? ''))); $rtName = trim(str_replace(['"', '\\', "\r", "\n", '<', '>'], '', (string) ($m['replyName'] ?? '')));
    $head = "To: $to\r\n" . (string) ($m['fromHead'] ?? '') . "Subject: " . $enc((string) $m['subject']) . "\r\n";
    if ($rt !== '' && filter_var($rt, FILTER_VALIDATE_EMAIL)) $head .= 'Reply-To: ' . ($rtName !== '' ? $enc($rtName) . ' ' : '') . '<' . $rt . ">\r\n";
    /* a reply to their email when Microsoft's own reply cannot be used (2026-11-19): the thread is kept by these two lines */
    $ir = (string) ($m['inReplyTo'] ?? ''); if (preg_match('/^<[\x21-\x3B\x3D\x3F-\x7E]{3,250}>$/', $ir)) $head .= "In-Reply-To: $ir\r\nReferences: $ir\r\n";
    $part = fn(string $head, string $body) => "--$al\r\n$head\r\nContent-Transfer-Encoding: base64\r\n\r\n" . $b64($body) . "\r\n";
    return $head . "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"$al\"\r\n\r\n"
        . $part('Content-Type: text/plain; charset=UTF-8', str_replace("\n", "\r\n", str_replace("\r", '', (string) $m['text'])))
        . $part('Content-Type: text/html; charset=UTF-8', (string) $m['html'])
        . "--$al--\r\n";
}
/** send one desk email now: ['ok' => true, 'dup' => bool] or ['ok' => false, 'kind' => ..., 'why' => ...]; never throws */
function pmDeskSend(array $m): array {
    try {
        if (!pmReady()) return ['ok' => false, 'kind' => 'setup', 'why' => 'the Peak email data folder is missing'];
        $ref = (string) ($m['ref'] ?? ''); $to = strtolower(trim((string) ($m['to'] ?? '')));
        if (!preg_match('/^dm[0-9a-f]{10}$/', $ref)) return ['ok' => false, 'kind' => 'other', 'why' => 'no reference for this email'];
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'kind' => 'address', 'why' => 'that email does not look right'];
        if (trim((string) ($m['subject'] ?? '')) === '' || trim((string) ($m['text'] ?? '')) === '') return ['ok' => false, 'kind' => 'other', 'why' => 'the email is incomplete'];
        $S = pmState(); if (isset($S['suppressed'][$to])) return ['ok' => false, 'kind' => 'blocked', 'why' => $to . ' is on the do-not-email list (' . $S['suppressed'][$to] . ')'];
        $lk = @fopen(pmData() . '/deskmail.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
        try {
            if (pmDeskRow($ref)) return ['ok' => true, 'dup' => true];
            $F = pmFrom(); $re = is_array($m['reply'] ?? null) ? $m['reply'] : null;
            $x = $re ? pmReplySend($re, $to, $m, $F) : pmSendOne(['to' => $to, 'mime' => pmDeskMime(['to' => $to, 'fromHead' => pmFromHead($F)] + $m)], null, $F);
            $row = ['t' => 'deskmail', 'ref' => $ref, 'to' => $to, 'from' => $F['email'], 'w' => (string) ($m['w'] ?? ''), 'org' => (string) ($m['org'] ?? ''), 'company' => pmClean($m['company'] ?? '', 100),
                'by' => pmClean($m['by'] ?? '', 60), 'subject' => pmClean($m['subject'] ?? '', 160), 'ok' => !empty($x['ok'])];
            if ($re) $row['re'] = (string) ($x['via'] ?? 'reply');
            if (empty($x['ok'])) { $row['kind'] = (string) ($x['kind'] ?? 'other'); $row['why'] = mb_substr((string) ($x['why'] ?? ''), 0, 200); }
            pmLog($row);
            if (!empty($x['ok'])) return ['ok' => true, 'dup' => false];
            $why = pmWhyText($row['kind'], $row['why']);
            return ['ok' => false, 'kind' => $row['kind'], 'why' => $why];
        } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
    } catch (Throwable $e) { return ['ok' => false, 'kind' => 'other', 'why' => mb_substr($e->getMessage(), 0, 160)]; }
}
/** a failed tour confirmation or desk email in words for the desk */
function pmWhyText(string $kind, string $why): string {
    return match ($kind) { 'auth' => 'Microsoft refused the sign-in: connect Microsoft again in Outbox, Peak section (' . $why . ')', 'blocked' => 'Microsoft is blocking the mailbox from sending (' . $why . ')',
        'sendas' => $why, 'address' => 'Microsoft refused the address (' . $why . ')', 'server' => 'Microsoft did not answer just now (' . $why . '). Try again', default => $why !== '' ? $why : 'it did not send' };
}
/** a desk email that answers one of their emails (2026-11-19): Microsoft's own reply on that message in the mailbox it came to (createReply,
    the seller's words put above their email, then send), so it stays in one thread for them and in Peak Partnerships. When that message is no
    longer there, or it came to another mailbox (Matthew's own, before), it goes as a new email with In-Reply-To instead. Their email is never
    moved or deleted. Answers like pmSendOne, plus 'via' => reply | thread. */
function pmReplySend(array $re, string $to, array $m, array $F): array {
    $mid = (string) ($re['mid'] ?? ''); $mb = strtolower((string) ($re['mb'] ?? '')); $imid = (string) ($re['imid'] ?? '');
    $fallback = fn() => pmSendOne(['to' => $to, 'mime' => pmDeskMime(['to' => $to, 'fromHead' => pmFromHead($F), 'inReplyTo' => $imid] + $m)], null, $F) + ['via' => 'thread'];
    if ($mid === '' || !preg_match('#^[A-Za-z0-9+/=_-]{1,400}$#D', $mid) || $mb === '' || $mb !== $F['email']) return $fallback();
    $base = $F['base'] . '/messages/';
    $msg = ['toRecipients' => [['emailAddress' => array_filter(['address' => $to, 'name' => trim(str_replace(['"', "\r", "\n"], '', (string) ($m['name'] ?? '')))], 'strlen')]]];
    $rt = strtolower(trim((string) ($m['replyTo'] ?? '')));
    if ($rt !== '' && filter_var($rt, FILTER_VALIDATE_EMAIL)) $msg['replyTo'] = [['emailAddress' => array_filter(['address' => $rt, 'name' => trim(str_replace(['"', "\r", "\n"], '', (string) ($m['replyName'] ?? '')))], 'strlen')]];
    [$s, $d, $raw, $a] = pmGraph('POST', $base . rawurlencode($mid) . '/createReply', ['message' => $msg]);
    if ($s === 404 && (string) ($d['error']['code'] ?? '') !== 'MailboxNotFound') return $fallback();   /* their email is no longer in the mailbox */
    if (($s !== 200 && $s !== 201) || empty($d['id'])) return pmSendErr($s, $d, $raw, $a, $F) + ['via' => 'reply'];
    $id = (string) $d['id']; $orig = (string) ($d['body']['content'] ?? '');
    if (strtolower((string) ($d['body']['contentType'] ?? 'html')) === 'text') $orig = '<div>' . str_replace("\n", "<br>\n", htmlspecialchars($orig, ENT_QUOTES, 'UTF-8')) . '</div>';
    $mine = (string) ($m['html'] ?? ''); if (preg_match('~<body[^>]*>(.*)</body>~is', $mine, $x)) $mine = $x[1];
    if (preg_match('/<body[^>]*>/i', $orig, $bm, PREG_OFFSET_CAPTURE)) { $at = $bm[0][1] + strlen($bm[0][0]); $html = substr($orig, 0, $at) . $mine . '<br>' . substr($orig, $at); }
    else $html = $mine . '<br>' . $orig;
    $left = ' (a draft of it is left in the mailbox\'s Drafts)';
    [$s2, $d2, $raw2, $a2] = pmGraph('PATCH', $base . rawurlencode($id), ['subject' => (string) ($m['subject'] ?? ''), 'body' => ['contentType' => 'HTML', 'content' => $html]]);
    if ($s2 !== 200) { $e = pmSendErr($s2, $d2, $raw2, $a2, $F); $e['why'] .= $left; return $e + ['via' => 'reply']; }
    [$s3, $d3, $raw3, $a3] = pmGraph('POST', $base . rawurlencode($id) . '/send', null, ['Content-Length: 0']);
    if ($s3 === 202 || $s3 === 200) { if ($F['shared']) pmFromMark('sendas', true); return ['ok' => true, 'from' => $F['email'], 'via' => 'reply']; }
    $e = pmSendErr($s3, $d3, $raw3, $a3, $F); $e['why'] .= $left; return $e + ['via' => 'reply'];
}
/** for Outbox: desk emails sent (times), and the ones whose last try failed with no later success */
function pmDeskMailStats(?array $rows = null): array {
    $sent = []; $last = [];
    foreach ($rows ?? pmRows() as $r) {
        if (($r['t'] ?? '') !== 'deskmail') continue;
        if (!empty($r['ok'])) $sent[] = (int) ($r['at'] ?? 0);
        $last[(string) ($r['ref'] ?? '')] = $r;
    }
    $open = array_values(array_filter($last, fn($r) => empty($r['ok'])));
    return ['sent' => $sent, 'open' => array_map(fn($r) => ['at' => (int) ($r['at'] ?? 0), 'company' => (string) ($r['company'] ?? ''), 'to' => (string) ($r['to'] ?? ''),
        'by' => (string) ($r['by'] ?? ''), 'why' => (string) ($r['why'] ?? '')], $open)];
}
/** is an address on this sender's do-not-email list (unsubscribed, bounced, STOP, added by hand): the reason, or '' */
function pmSuppressedWhy(string $to): string { if (!pmReady()) return ''; $S = pmState(); return (string) ($S['suppressed'][strtolower(trim($to))] ?? ''); }

/* ---- {book} on the Peak desk's booking page (2026-11-19, Matthew: one shared schedule for the whole Peak desk). When the desk's booking
   code is on this server, b.php sends the person on to the desk's own booking page (app/api/book.php, public at /peak-book/) with a link the
   desk signs: the same hours, one booking per slot across the whole desk, the tour on the right card. The view is still counted here
   ('bookview'), and a booking made there is logged here too ('booked'), so this sender's counts and rates stay right. ---- */
function pmBookLib(): string {
    static $why = null; if ($why !== null) return $why;
    if (pmEnv('PEAK_MAIL_BOOK_LEGACY') !== '') return $why = 'the old booking page (test)';
    $l = pmDeskLoad(); if ($l !== '') return $why = $l;
    $f = dirname(pmDeskStore()) . '/book-lib.php'; if (!is_file($f)) return $why = 'the desk\'s booking code is not on the server';
    try { if (!function_exists('bkOutreachUrl')) require_once $f; } catch (Throwable $e) { return $why = 'the desk\'s booking code did not load'; }
    return $why = function_exists('bkOutreachUrl') ? '' : 'the desk\'s booking code is an older version';
}
/** the desk's booking page for this person on the lists ('' when the desk's code is not here: b.php's own page answers) */
function pmBookDesk(array $p): string {
    if (pmBookLib() !== '') return '';
    try { return bkOutreachUrl(['w' => pmWorld($p), 'org' => (string) $p['org'], 'to' => (string) $p['to'], 'n' => (string) ($p['person'] ?? ''), 'c' => (string) ($p['company'] ?? ''), 'l' => (string) ($p['list'] ?? ''), 'r' => (string) ($p['rid'] ?? '')]); }
    catch (Throwable $e) { return ''; }
}
/** can {book} be used in an email now: the desk's Booking links switch and its open times, or (no desk code) this sender's own setting */
function pmBookReady(array $S): bool {
    if (pmBookLib() === '') { try { return bkConf()['on'] && (bool) bkSlots(1); } catch (Throwable $e) { return false; } }
    return !empty($S['settings']['book']['on']) && (bool) pmBookSlots($S, 1);
}

/** a calendar answer to an invite ("Accepted: ...") is not a reply to the outreach */
function pmIsCalReply(array $m): bool { return (bool) preg_match('/^\s*(accepted|declined|tentative(ly accepted)?|tentative)\s*:/i', (string) ($m['subject'] ?? '')); }

/* ---------------------------------------------------------------- the sending window */
function pmInWindow(array $set, int $t): bool {
    $d = (int) date('N', $t); $h = (int) date('G', $t);
    return in_array($d, array_map('intval', (array) $set['days']), true) && !in_array(date('Y-m-d', $t), (array) $set['skip'], true) && $h >= (int) $set['from'] && $h < (int) $set['to'];
}
function pmWindowText(array $set): string {
    $d = array_map('intval', (array) $set['days']); sort($d);
    $days = $d === [1, 2, 3, 4, 5] ? 'Mon-Fri' : implode(', ', array_map(fn($x) => PM_DAYS[$x] ?? '?', $d));
    $hr = fn(int $h) => $h === 0 ? '12 am' : ($h < 12 ? $h . ' am' : ($h === 12 ? '12 pm' : ($h - 12) . ' pm'));
    return $days . ' ' . $hr((int) $set['from']) . ' to ' . $hr((int) $set['to']) . ' Colorado time';
}
/** how many may go this hour: the rate, at most 10 on the first sending day, less what went in the last 60 minutes */
function pmHourBudget(array $S): int {
    $n = (int) $S['settings']['rate'];
    $today = date('Y-m-d', pmNow());
    if (!empty($S['settings']['ramp']) && (!$S['firstSent'] || date('Y-m-d', $S['firstSent']) === $today)) $n = min($n, PM_RAMP);
    $last = count(array_filter($S['sentTimes'], fn($t) => $t > pmNow() - 3600));
    return max(0, $n - $last);
}

/* ---------------------------------------------------------------- who is next */
/** the people still to email on a list, in order (only those the desk still lists and nothing blocks) */
function pmQueue(array $S, string $list, ?array $fresh = null): array {
    $lj = pmJ('lists.json', ['lists' => []]); $fresh ??= pmImport($S['settings']);
    $ok = []; foreach ($fresh['lists'][$list] ?? [] as $p) if ($p['hold'] === '') $ok[$p['to']] = 1;
    $q = [];
    foreach ((array) ($lj['lists'][$list] ?? []) as $p) if ($p['hold'] === '' && isset($ok[$p['to']]) && pmBlocked($S, $p['to']) === '') $q[] = $p;
    return $q;
}
/** what stops Start on a list ([] = nothing) */
function pmStartBlocks(array $S, string $list): array {
    $b = []; $c = pmConn();
    if (!$c['app']) $b[] = 'The Microsoft app keys are not on the server.';
    if (!$c['connected']) $b[] = 'Microsoft is not connected.';
    $F = pmFromStatus($S['settings']); if ($F['shared'] && is_array($F['access']) && empty($F['access']['ok'])) $b[] = $F['warn'];
    if (!pmAddressOk((string) $S['settings']['address'])) $b[] = 'Peak\'s postal address is missing in Settings (the law wants it in every email).';
    if (pmIsDraft($S['templates'][$list])) $b[] = 'The template is still the DRAFT placeholder. Put the approved email in and save it.';
    if (!str_contains(strtolower((string) $S['templates'][$list]['body']), 'http') ) $b[] = 'The email has no web address, so clicks cannot be counted (add Peak\'s website).';
    if (str_contains((string) $S['templates'][$list]['body'], '{book}') && !pmBookReady($S)) $b[] = pmBookLib() === '' ? 'The email has a {book} link, but Booking links are off on the Peak desk (More, Settings), or it has no open times.' : 'The email has a {book} link, but booking is off in Settings (or has no open times).';
    if (!is_file(pmData() . '/lists.json')) $b[] = 'The list has not been brought in from the Peak desk yet.';
    elseif (!pmQueue($S, $list)) $b[] = 'Nobody is waiting on this list.';
    return $b;
}

/* ---------------------------------------------------------------- the book-a-time page (b.php) */
const PM_BOOK_KINDS = ['tour' => 'Tour of Peak', 'call' => 'Phone call'];
/** "Mon 10:00-12:00, 13:00-16:00" lines <-> the weekly pattern [day => ["10:00-12:00", ...]] */
function pmWeekText(array $w): string { $o = []; foreach (PM_DAYS as $d => $n) if (!empty($w[$d])) $o[] = $n . ' ' . implode(', ', (array) $w[$d]); return implode("\n", $o); }
function pmWeekParse(string $t): ?array {
    $w = []; $days = array_flip(array_map('strtolower', PM_DAYS));
    foreach (preg_split('/\R/', trim($t)) ?: [] as $line) {
        $line = trim($line); if ($line === '') continue;
        if (!preg_match('/^([A-Za-z]{3})[a-z]*\s+(.+)$/', $line, $m) || !isset($days[strtolower($m[1])])) return null;
        foreach (preg_split('/\s*,\s*/', trim($m[2])) ?: [] as $r) {
            if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/', $r, $x) || (int) $x[1] * 60 + (int) $x[2] >= (int) $x[3] * 60 + (int) $x[4]) return null;
            $w[$days[strtolower($m[1])]][] = sprintf('%02d:%02d-%02d:%02d', $x[1], $x[2], $x[3], $x[4]);
        }
    }
    return $w;
}
/** the open times, soonest first, at most $max: [["2026-11-24", "10:00"], ...] (the weekly pattern, the days off, the notice, minus taken) */
function pmBookSlots(array $S, int $max = 200): array {
    $b = $S['settings']['book']; $mins = max(15, min(120, (int) $b['mins'])); $taken = array_flip($S['taken'] ?? []); $o = [];
    $earliest = pmNow() + max(0, (int) $b['notice']) * 3600; $day0 = strtotime(date('Y-m-d', pmNow()) . ' 00:00');
    for ($i = 0; $i <= max(1, min(60, (int) $b['ahead'])); $i++) {
        $d = strtotime('+' . $i . ' days', $day0); $ds = date('Y-m-d', $d);
        if (in_array($ds, (array) $S['settings']['skip'], true)) continue;
        foreach ((array) ($b['week'][(int) date('N', $d)] ?? []) as $r) {
            [$f, $t] = explode('-', $r); $a = strtotime($ds . ' ' . $f); $z = strtotime($ds . ' ' . $t);
            for ($s = $a; $s + $mins * 60 <= $z; $s += $mins * 60) { if ($s < $earliest || isset($taken[$ds . ' ' . date('H:i', $s)])) continue; $o[] = [$ds, date('H:i', $s)]; if (count($o) >= $max) return $o; }
        }
    }
    return $o;
}
/** a short note to Matthew from the server, the way Traverse's own notices go (the website's mailbox, public_html/demo/_lib.php).
    PEAK_MAIL_NOTIFY (a file) catches it in tests. Never blocks what called it. */
function pmNotify(string $subject, string $body): array {
    $f = pmEnv('PEAK_MAIL_NOTIFY');
    if ($f !== '') { @file_put_contents($f, json_encode(['subject' => $subject, 'body' => $body], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'test']; }
    $lib = PM_ROOT . '/public_html/demo/_lib.php';
    if (!is_file($lib)) return ['ok' => false, 'stage' => 'no mail code'];
    try { require_once $lib; $c = site_config(); $r = send_mail($c, (string) ($c['notify_to'] ?? 'm.sharpe@traverseplatforms.com'), $subject, $body); return ['ok' => (bool) $r['ok'], 'stage' => (string) $r['stage']]; }
    catch (Throwable $e) { return ['ok' => false, 'stage' => mb_substr($e->getMessage(), 0, 100)]; }
}

/* ---------------------------------------------------------------- replies and bounce notices (read only) */
function pmIsNdr(array $m): bool {
    $from = strtolower((string) ($m['from']['emailAddress']['address'] ?? '')); $sub = (string) ($m['subject'] ?? '');
    if (preg_match('/delay|delayed|will retry/i', $sub)) return false;
    return (bool) (preg_match('/^(postmaster|mailer-daemon|microsoftexchange[0-9a-f]*|mail-daemon)@/i', $from)
        || preg_match('/^(undeliverable|undelivered|delivery (has )?failed|delivery status notification \(failure\)|mail delivery (failed|subsystem)|returned mail|failure notice|message not delivered)/i', $sub));
}
function pmIsAuto(array $m): bool { return (bool) preg_match('/^(automatic reply|auto(matic)?[- ]?(reply|response)|out of (the )?office|ooo\b|away from|on vacation|i am (currently )?out)/i', trim((string) ($m['subject'] ?? ''))); }
function pmIsStop(string $text): bool { return (bool) preg_match('/^\W*(stop|unsubscribe|remove( me)?|take me off|no thanks|not interested)\b|\b(unsubscribe me|remove me from|stop emailing|take me off|do not (email|contact)|don\'t (email|contact))\b/i', trim($text)); }
/** their own words from a reply, as plain text for the desk (2026-11-19): the quoted history under "On ... wrote:", "-----Original Message-----",
    Outlook's "From: ... Sent:" block or its line of underscores is cut off, and so are lines starting with ">"; at most $max characters */
function pmReplyText(string $t, int $max = 3000): string {
    $t = str_replace(["\r\n", "\r", "\u{00A0}"], ["\n", "\n", ' '], $t);
    $t = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $t);
    if (!mb_check_encoding($t, 'UTF-8')) $t = (string) mb_convert_encoding($t, 'UTF-8', 'UTF-8');
    $cut = strlen($t);
    foreach (['/^[ \t>]*On [^\n]{4,250}(\n[^\n]{0,250})?wrote:[ \t]*$/mu', '/^[ \t]*-{2,}[ \t]*Original Message[ \t]*-{2,}/mi', '/^[ \t]*_{10,}[ \t]*$/m',
              '/^[ \t]*\*?From:\*?[ \t][^\n]+\n[ \t]*\*?(Sent|Date):\*?[ \t]/mi', '/^[ \t]*-{2,}[ \t]*Forwarded message[ \t]*-{2,}/mi'] as $re)
        if (preg_match($re, $t, $m, PREG_OFFSET_CAPTURE) && $m[0][1] < $cut) $cut = (int) $m[0][1];
    $own = substr($t, 0, $cut);
    $own = implode("\n", array_filter(explode("\n", $own), fn($l) => !preg_match('/^\s*>/', $l)));
    $own = trim((string) preg_replace("/\n{3,}/", "\n\n", (string) preg_replace('/[ \t]+$/m', '', $own)));
    if ($own === '') $own = trim(mb_substr(trim($t), 0, 600));   /* nothing above the quote: the start of what they sent */
    return mb_strlen($own) > $max ? rtrim(mb_substr($own, 0, $max)) . "\n[… the rest is in the mailbox]" : $own;
}
/** one email in full for the desk (read only): their own words, the attachments by name (inline images left out), its internet message id */
function pmMailFull(array $box, string $id, array $m): array {
    [$s, $j] = pmGraph('GET', $box['base'] . '/messages/' . rawurlencode($id) . '?$select=uniqueBody,body,internetMessageId,hasAttachments', null, ['Prefer: outlook.body-content-type="text"']);
    $raw = $s === 200 ? (string) ((string) ($j['uniqueBody']['content'] ?? '') !== '' ? $j['uniqueBody']['content'] : ($j['body']['content'] ?? '')) : '';
    $text = pmReplyText($raw !== '' ? $raw : (string) ($m['bodyPreview'] ?? ''));
    $files = []; $att = [];
    if (!empty($m['hasAttachments']) || !empty($j['hasAttachments'])) {
        [$s2, $a] = pmGraph('GET', $box['base'] . '/messages/' . rawurlencode($id) . '/attachments?$select=id,name,isInline,size,contentType');
        if ($s2 === 200) foreach ((array) ($a['value'] ?? []) as $x) if (empty($x['isInline']) && count($files) < 12) {
            $files[] = $nm = pmClean($x['name'] ?? 'attachment', 120) ?: 'attachment';
            /* for the desk's Inbox (2026-11-20): which one it is, so a plain file can be downloaded through the desk */
            $att[] = ['name' => $nm, 'id' => pmClean($x['id'] ?? '', 600), 'size' => (int) ($x['size'] ?? 0), 'type' => pmClean($x['contentType'] ?? '', 100), 'kind' => pmClean($x['@odata.type'] ?? '', 60)];
        }
    }
    return ['text' => $text, 'files' => $files, 'att' => $att, 'imid' => pmClean(((string) ($m['internetMessageId'] ?? '')) ?: (string) ($j['internetMessageId'] ?? ''), 300)];
}
/** whose mail is looked for in a mailbox, and where each belongs on the desk: [address => [to, person, company, org, kind, list, last (the
    latest email to them, 0 = none)]]. 'shared' (Peak Partnerships): everyone on the lists, everyone a desk email or tour confirmation went
    to, and anyone whose address is on one desk card. 'me' (Matthew's own mailbox): only people this sender emailed from it (before
    2026-11-19), so the rest of his mail stays his. Where several fit, the latest email to them wins. */
function pmWho(array $S, string $box): array {
    $me = strtolower((string) (pmJ('ms.json', [])['email'] ?? '')); $via = []; $sent = [];
    foreach (pmRows() as $r) {
        $t = (string) ($r['t'] ?? ''); if (!in_array($t, ['sent', 'deskmail', 'tourmail'], true) || ($t !== 'sent' && (empty($r['ok']) || !empty($r['test'])))) continue;
        $to = strtolower((string) ($r['to'] ?? '')); if ($to === '') continue; $at = (int) ($r['at'] ?? 0);
        $via[$to][strtolower((string) ($r['from'] ?? '')) ?: $me] = 1;   /* rows from before 2026-11-19 all went from Matthew's own mailbox */
        if ($t !== 'sent' && (string) ($r['org'] ?? '') !== '' && in_array($r['w'] ?? '', ['sponsor', 'expo'], true) && (!isset($sent[$to]) || $sent[$to]['last'] <= $at))
            $sent[$to] = ['to' => $to, 'person' => '', 'company' => (string) ($r['company'] ?? ''), 'org' => (string) $r['org'], 'kind' => $r['w'] === 'expo' ? 'xorg' : 'lead', 'list' => '', 'last' => $at];
    }
    $who = [];
    if ($box === 'shared') {
        $twice = [];
        foreach (['sponsor', 'expo'] as $w) foreach ((array) pmDeskRecs($w) as $id => $R) foreach (array_merge((array) ($R['contacts'] ?? []), (array) ($R['added'] ?? [])) as $c) {
            $e = strtolower(trim((string) ($c['email'] ?? ''))); if ($e === '' || !filter_var($e, FILTER_VALIDATE_EMAIL)) continue;
            if (isset($who[$e]) && $who[$e]['org'] !== (string) $id) { $twice[$e] = 1; continue; }
            $who[$e] ??= ['to' => $e, 'person' => pmClean($c['name'] ?? '', 80), 'company' => (string) ($R['name'] ?? ''), 'org' => (string) $id, 'kind' => $w === 'expo' ? 'xorg' : 'lead', 'list' => '', 'last' => 0];
        }
        foreach ($twice as $e => $_) unset($who[$e]);   /* an address on two cards: only an email to them says which */
    }
    $fromList = [];
    foreach ((pmJ('lists.json', ['lists' => []])['lists'] ?? []) as $k => $ps) foreach ($ps as $p) {
        if (($p['hold'] !== '' && !isset($S['people'][$p['to']])) || isset($fromList[$p['to']])) continue;
        $fromList[$p['to']] = 1; $who[$p['to']] = $p + ['list' => $k, 'last' => (int) ($S['people'][$p['to']]['sent'] ?? 0)];
    }
    foreach ($sent as $e => $x) {
        $o = $who[$e] ?? null; if ($o && (int) $o['last'] > $x['last']) continue;
        if ($o && (string) $o['org'] === $x['org']) { $x['person'] = (string) ($o['person'] ?? ''); $x['list'] = (string) ($o['list'] ?? ''); $x['company'] = $x['company'] ?: (string) ($o['company'] ?? ''); }
        $who[$e] = $x;
    }
    if ($box === 'me') $who = array_filter($who, fn($e) => isset($via[$e][$me]), ARRAY_FILTER_USE_KEY);
    return $who;
}
/** why an email in Peak Partnerships' Inbox sits under Other on the desk's Inbox ('' = mail to answer): Microsoft's and other systems'
    notices, bounces, auto-replies, calendar answers, CourtReserve (its notices go to Matthew's own mailbox, but in case), and STOP replies
    (handled by themselves) (2026-11-20) */
function pmInboxOther(array $m, bool $stop = false): string {
    $from = strtolower((string) ($m['from']['emailAddress']['address'] ?? '')); $dom = substr((string) strrchr($from, '@'), 1); $nm = (string) ($m['from']['emailAddress']['name'] ?? '');
    if (pmIsNdr($m)) return 'bounce';
    if (pmIsAuto($m)) return 'auto-reply';
    if (pmIsCalReply($m)) return 'calendar answer';
    if (preg_match('/(^|\.)courtreserve\.com$/', $dom) || stripos($nm, 'courtreserve') !== false) return 'CourtReserve';
    if ($from === '' || preg_match('/(^|\.)(microsoft\.com|microsoftonline\.com|office365\.com|microsoft365\.com|sharepointonline\.com|onmicrosoft\.com)$/', $dom)) return 'Microsoft or system notice';
    if (preg_match('/^(no-?reply|do-?not-?reply|donotreply|noreply-[a-z0-9.-]+|notifications?|mailer|bounces?)@/', $from)) return 'system notice';
    if ($stop) return 'STOP (handled by itself)';
    return '';
}
/** one email from Peak Partnerships' Inbox onto the desk's Inbox (the desk's deskInboxIn: one row in its inbox.log). Never throws. */
function pmInboxPut(array $box, string $id, array $m, ?array $full, string $why, ?array $x, array $flags = []): void {
    try {
        $full ??= ['text' => pmReplyText((string) ($m['bodyPreview'] ?? ''), 600), 'att' => [], 'imid' => ''];
        deskInboxIn(['from' => strtolower((string) ($m['from']['emailAddress']['address'] ?? '')), 'name' => pmClean($m['from']['emailAddress']['name'] ?? '', 80), 'subject' => pmClean($m['subject'] ?? '', 200),
            'at' => (int) strtotime((string) ($m['receivedDateTime'] ?? '')) ?: pmNow(), 'text' => (string) $full['text'], 'att' => (array) ($full['att'] ?? []), 'mid' => $id, 'mb' => $box['addr'],
            'imid' => (string) (($full['imid'] ?? '') ?: ($m['internetMessageId'] ?? '')), 'cat' => $why !== '' ? 'other' : 'mail', 'why' => $why,
            'w' => $x ? pmWorld($x) : '', 'id' => $x ? (string) $x['org'] : '', 'stop' => !empty($flags['stop']), 'auto' => !empty($flags['auto'])]);
    } catch (Throwable $e) { error_log('peak-mail: desk inbox: ' . mb_substr($e->getMessage(), 0, 160)); }
}
/** read Peak Partnerships' Inbox and Junk folder (and Matthew's own, for people emailed from it before 2026-11-19) since the last look. A
    reply, STOP, auto-reply or bounce notice from someone pmWho() knows goes on their desk card: the reply's own words, its attachments by name,
    an auto-reply shown as one and not counted as a reply. Each one handled in Peak Partnerships is marked read there; nothing is ever moved
    or deleted, and Matthew's own mailbox is only read. Since 2026-11-20 every email in Peak Partnerships' Inbox also goes on the desk's Inbox
    tab (pmInboxPut), matched or not; the ones that matched nobody stay unread until a seller opens them there.
    $quick (2026-11-20, the 5-minute read, `cron.php inbox`): Peak Partnerships' Inbox only, the last 15 minutes and anything not seen yet;
    the hourly run reads every folder with two days' overlap. One lock (scan.lock): two reads never overlap (the 5-minute one skips, the
    hourly one waits up to a minute). A 429 from Microsoft: no read for 10 minutes. $fresh = how many new emails were read. Returns a summary. */
function pmScan(array $S, bool $quick = false, int &$fresh = 0): string {
    $fresh = 0;
    $lk = @fopen(pmData() . '/scan.lock', 'c'); if (!$lk) return 'read mail: the lock file could not be opened';
    $got = false; for ($i = 0; $i < ($quick ? 1 : 30); $i++) { if (flock($lk, LOCK_EX | LOCK_NB)) { $got = true; break; } sleep(2); }
    if (!$got) { fclose($lk); return 'read mail: another read is going'; }
    try { return pmScanLocked($S, $quick, $fresh); } finally { flock($lk, LOCK_UN); fclose($lk); }
}
function pmScanLocked(array $S, bool $quick, int &$fresh): string {
    $F = pmFrom($S['settings']); $boxes = [];
    if ($F['shared']) $boxes[] = ['base' => $F['base'], 'addr' => $F['email'], 'shared' => true, 'name' => PM_SHARED_NAME, 'kind' => 'shared'];
    if (!$quick) $boxes[] = ['base' => '/v1.0/me', 'addr' => $F['mine'], 'shared' => false, 'name' => 'Matthew\'s mailbox', 'kind' => 'me'];
    if (!$boxes) return 'read mail: nothing to read';
    $deskIn = $F['shared'] && pmDeskLoad() === '' && function_exists('deskInboxIn');
    $sc = pmJ('scan.json', ['last' => 0, 'seen' => []]); $seen = (array) ($sc['seen'] ?? []); $now = pmNow();
    if ((int) ($sc['wait'] ?? 0) > $now) return 'read mail: Microsoft asked us to slow down, next look after ' . date('g:i a', (int) $sc['wait']);
    $last = (int) ($sc['last'] ?? 0);
    $since = $last > 0 ? $last - ($quick ? 900 : 2 * 86400) : $now - 3 * 86400;
    $iso = gmdate('Y-m-d\TH:i:s\Z', $since); $n = ['reply' => 0, 'bounce' => 0, 'auto' => 0, 'stop' => 0, 'other' => 0]; $err = []; $slow = false;
    foreach ($boxes as $box) {
        $who = null; $whoOf = function () use (&$who, $S, $box): array { return $who ??= pmWho($S, $box['kind']); };
        if (!$box['shared'] && !$whoOf()) continue;   /* Matthew's own mailbox: only for people emailed from it before */
        $tag = $box['shared'] ? 'p:' : 'm:';
        $read = function (string $id) use ($box): void { if ($box['shared']) pmGraph('PATCH', $box['base'] . '/messages/' . rawurlencode($id), ['isRead' => true]); };
        foreach ($quick ? ['inbox'] : ['inbox', 'junkemail'] as $folder) {
            $toDesk = $deskIn && $box['shared'] && $folder === 'inbox';
            $path = $box['base'] . '/mailFolders/' . $folder . '/messages?$select=id,from,subject,receivedDateTime,bodyPreview,internetMessageId,hasAttachments&$filter=' . rawurlencode('receivedDateTime ge ' . $iso) . '&$orderby=' . rawurlencode('receivedDateTime desc') . '&$top=50';
            for ($page = 0; $page < 8 && $path !== ''; $page++) {
                [$s, $j] = pmGraph('GET', $path);
                if ($s !== 200) { if ($s === 429) $slow = true; $err[] = 'could not read the ' . $folder . ' of ' . $box['name'] . ' (' . $s . ': ' . mb_substr((string) ($j['error']['message'] ?? ''), 0, 80) . ')'; if ($box['shared'] && in_array($s, [403, 404], true)) pmFromMark('access', false, $s . ' ' . (string) ($j['error']['code'] ?? '')); break; }
                foreach ((array) ($j['value'] ?? []) as $m) {
                    $id = (string) ($m['id'] ?? ''); if ($id === '' || isset($seen[$tag . $id])) continue; $seen[$tag . $id] = $now;
                    $imid = (string) ($m['internetMessageId'] ?? ''); if ($imid !== '' && isset($seen['i:' . $imid])) continue;   /* the same email in both mailboxes: once */
                    if ($imid !== '') $seen['i:' . $imid] = $now;
                    $fresh++;
                    $from = strtolower((string) ($m['from']['emailAddress']['address'] ?? '')); $at = (int) strtotime((string) ($m['receivedDateTime'] ?? '')) ?: $now;
                    if (pmIsNdr($m)) {
                        $who = $whoOf();
                        [$s2, $full] = pmGraph('GET', $box['base'] . '/messages/' . rawurlencode($id) . '?$select=body', null, ['Prefer: outlook.body-content-type="text"']);
                        $txt = ($s2 === 200 ? (string) ($full['body']['content'] ?? '') : '') . ' ' . (string) ($m['bodyPreview'] ?? '');
                        preg_match_all('/[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $txt, $em); $hit = false;
                        foreach (array_unique(array_map('strtolower', $em[0])) as $e) {
                            if (!isset($who[$e]) || empty($who[$e]['last']) || !empty($S['people'][$e]['bounce'])) continue;
                            $row = ['t' => 'bounce', 'to' => $e, 'l' => (string) $who[$e]['list'], 'at' => $at] + pmDeskTag($who[$e], 'bounce:' . substr(sha1($id . '|' . $e), 0, 16));
                            pmLog($row); pmDeskNow($row, $S['settings']); $S['people'][$e]['bounce'] = $at; $n['bounce']++; $hit = true;
                        }
                        if ($toDesk) pmInboxPut($box, $id, $m, null, 'bounce', null);
                        if ($hit) $read($id); elseif ($box['shared']) $n['other']++;
                        continue;
                    }
                    $who = $whoOf();
                    if (!isset($who[$from])) {
                        if ($toDesk) pmInboxPut($box, $id, $m, pmMailFull($box, $id, $m), pmInboxOther($m), null, ['auto' => pmIsAuto($m)]);
                        if ($box['shared']) $n['other']++;
                        continue;
                    }
                    $x = $who[$from];
                    if (pmIsCalReply($m)) { if ($toDesk) pmInboxPut($box, $id, $m, null, 'calendar answer', $x); continue; }   /* their calendar answering a tour invite (2026-11-19) */
                    $full = pmMailFull($box, $id, $m);
                    $mail = ['from' => $from, 'name' => pmClean($m['from']['emailAddress']['name'] ?? '', 80), 'subject' => pmClean($m['subject'] ?? '', 160), 'at' => $at,
                        'text' => $full['text'], 'files' => $full['files'], 'mid' => $id, 'mb' => $box['addr'], 'imid' => $full['imid'] ?: $imid];
                    $name = (string) ($x['person'] ?? '') !== '' ? (string) $x['person'] : ($mail['name'] !== '' ? $mail['name'] : $from);
                    if (pmIsAuto($m)) {
                        if ($toDesk) pmInboxPut($box, $id, $m, $full, 'auto-reply', $x, ['auto' => true]);
                        $mail['text'] = mb_substr($mail['text'], 0, 600); $mail['auto'] = 1;
                        $row = ['t' => 'auto', 'to' => $from, 'who' => $name, 'l' => (string) $x['list'], 'at' => $at, 'mail' => $mail] + pmDeskTag($x, 'auto:' . substr(sha1($id), 0, 16));
                        pmLog($row); pmDeskNow($row, $S['settings']); $read($id); $n['auto']++; continue;
                    }
                    $subj = (string) preg_replace('/^((re|aw|fw|fwd)\s*:\s*)+/i', '', (string) ($m['subject'] ?? ''));
                    $stop = pmIsStop($full['text'] !== '' ? $full['text'] : (string) ($m['bodyPreview'] ?? '')) || (bool) preg_match('/^\W*(stop|unsubscribe)\W*$/i', $subj);
                    if ($toDesk) pmInboxPut($box, $id, $m, $full, pmInboxOther($m, $stop), $x, ['stop' => $stop]);
                    $firstReply = empty($S['people'][$from]['reply']);
                    /* every reply goes on the card (2026-11-19: the team reads them there); only the first counts as "replied" */
                    $row = ['t' => 'reply', 'to' => $from, 'who' => $name, 'l' => (string) $x['list'], 'stop' => $stop, 'before' => empty($x['last']) && empty($S['people'][$from]['sent']),
                            'subject' => pmClean($m['subject'] ?? '', 120), 'at' => $at, 'mail' => $mail + ($stop ? ['stop' => 1] : [])] + pmDeskTag($x, 'reply:' . substr(sha1($id), 0, 16));
                    pmLog($row); pmDeskNow($row, $S['settings']); $read($id);
                    if ($firstReply) $n['reply']++;
                    $S['people'][$from]['reply'] = $at; if ($stop) $n['stop']++;
                }
                $next = (string) ($j['@odata.nextLink'] ?? '');
                $path = $next !== '' ? (string) preg_replace('#^https://graph\.microsoft\.com|^' . preg_quote(pmGraphBase(), '#') . '#', '', $next) : '';
            }
        }
    }
    foreach ($seen as $k => $t) if ($t < $now - 30 * 86400) unset($seen[$k]);
    pmW('scan.json', ['last' => $err ? $last : $now, 'seen' => $seen] + ($slow ? ['wait' => $now + 600] : []));
    return ($err ? implode('; ', $err) . '; ' : '') . 'read mail: ' . $n['reply'] . ' replies (' . $n['stop'] . ' STOP), ' . $n['bounce'] . ' bounces, ' . $n['auto'] . ' auto-replies'
        . ($n['other'] ? '; ' . $n['other'] . ' other email' . ($n['other'] === 1 ? '' : 's') . ' in ' . PM_SHARED_NAME . ' not matched to the desk (left unread' . ($deskIn ? ', on the desk\'s Inbox' : '') . ')' : '');
}
/** the desk's alerts that are due (desk-inbox.php alertsFlush): a few words for the run line ('' when nothing moved) */
function pmAlertsFlush(): string {
    if (pmDeskLoad() !== '' || !function_exists('alertsFlush')) return '';
    try { $a = alertsFlush(pmNow()); return $a['push'] || $a['mail'] || $a['held'] ? 'alerts: ' . $a['push'] . ' pushed, ' . $a['mail'] . ' emailed' . ($a['held'] ? ', ' . $a['held'] . ' held (quiet hours or the 10-minute gap)' : '') : ''; }
    catch (Throwable $e) { return 'alerts: ' . mb_substr($e->getMessage(), 0, 80); }
}
/** the one-time fill of the desk's Inbox (2026-11-20, `cron.php inbox-backfill [days]`): the emails already in Peak Partnerships' Inbox from
    the last $days days (14 by default, 60 at most), which the hourly read had already looked at before the Inbox existed. Each goes on the
    desk's Inbox once (never twice; an email already there is left as it is), with its card when it is from someone on the desk. Nobody is
    alerted; one already read in Outlook goes straight to Done; nothing in the mailbox is changed (read only). Counts only. */
function pmInboxBackfill(int $days = 14): array {
    $days = max(1, min(60, $days)); $o = ['read' => 0, 'added' => 0, 'already' => 0, 'open' => 0, 'done' => 0, 'other' => 0, 'error' => ''];
    if (!pmReady() || !pmConn()['connected']) { $o['error'] = 'Microsoft is not connected'; return $o; }
    $S = pmState(); $F = pmFrom($S['settings']);
    if (!$F['shared']) { $o['error'] = 'the emails do not go out as Peak Partnerships'; return $o; }
    if (pmDeskLoad() !== '' || !function_exists('deskInboxIn') || !function_exists('inGet')) { $o['error'] = 'the desk\'s Inbox code is not here'; return $o; }
    $lk = @fopen(pmData() . '/scan.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { $o['error'] = 'another read is going: try again in a minute'; return $o; }
    try {
        $box = ['base' => $F['base'], 'addr' => $F['email'], 'shared' => true, 'name' => PM_SHARED_NAME, 'kind' => 'shared']; $who = pmWho($S, 'shared');
        $path = $F['base'] . '/mailFolders/inbox/messages?$select=id,from,subject,receivedDateTime,bodyPreview,internetMessageId,hasAttachments,isRead&$filter=' . rawurlencode('receivedDateTime ge ' . gmdate('Y-m-d\TH:i:s\Z', pmNow() - $days * 86400)) . '&$orderby=' . rawurlencode('receivedDateTime desc') . '&$top=50';
        for ($page = 0; $page < 20 && $path !== ''; $page++) {
            [$s, $j] = pmGraph('GET', $path);
            if ($s !== 200) { $o['error'] = 'Microsoft answered ' . $s . ' reading the Inbox'; break; }
            foreach ((array) ($j['value'] ?? []) as $m) {
                $id = (string) ($m['id'] ?? ''); if ($id === '') continue; $o['read']++;
                $iid = inIid((string) ($m['internetMessageId'] ?? ''), $id);
                if (inGet($iid)) { $o['already']++; continue; }
                $from = strtolower((string) ($m['from']['emailAddress']['address'] ?? '')); $x = $who[$from] ?? null;
                $full = pmIsNdr($m) || pmIsCalReply($m) ? null : pmMailFull($box, $id, $m);
                $stop = $x && $full && !pmIsAuto($m) && pmIsStop($full['text'] !== '' ? $full['text'] : (string) ($m['bodyPreview'] ?? ''));
                $why = pmInboxOther($m, $stop); $read = !empty($m['isRead']) && $why === '';
                $full ??= ['text' => pmReplyText((string) ($m['bodyPreview'] ?? ''), 600), 'att' => [], 'imid' => ''];
                deskInboxIn(['from' => $from, 'name' => pmClean($m['from']['emailAddress']['name'] ?? '', 80), 'subject' => pmClean($m['subject'] ?? '', 200),
                    'at' => (int) strtotime((string) ($m['receivedDateTime'] ?? '')) ?: pmNow(), 'text' => (string) $full['text'], 'att' => (array) ($full['att'] ?? []), 'mid' => $id, 'mb' => $box['addr'],
                    'imid' => (string) (($full['imid'] ?? '') ?: ($m['internetMessageId'] ?? '')), 'cat' => $why !== '' ? 'other' : 'mail', 'why' => $why,
                    'w' => $x ? pmWorld($x) : '', 'id' => $x ? (string) $x['org'] : '', 'stop' => $stop, 'auto' => pmIsAuto($m), 'quiet' => true, 'read' => $read]);
                $o['added']++; $o[$why !== '' ? 'other' : ($read ? 'done' : 'open')]++;
            }
            $next = (string) ($j['@odata.nextLink'] ?? '');
            $path = $next !== '' ? (string) preg_replace('#^https://graph\.microsoft\.com|^' . preg_quote(pmGraphBase(), '#') . '#', '', $next) : '';
        }
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return $o;
}
/** the 5-minute read (2026-11-20, `cron.php inbox`, started by the 5-minute cron): Peak Partnerships' Inbox onto the desk (and replies onto
    their cards), then the alerts that are due. A line in run.log only when something new came in or went wrong. */
function pmInboxRun(): int {
    if (!pmReady()) { echo "no data folder\n"; return 1; }
    $said = []; $fresh = 0;
    if (pmConn()['connected']) { $S = pmState(); $r = pmScan($S, true, $fresh); if ($fresh || !str_starts_with($r, 'read mail: 0 replies') || str_contains($r, 'could not')) $said[] = $r; }
    $a = pmAlertsFlush(); if ($a !== '') $said[] = $a;
    if ($said) pmRunLine('inbox: ' . implode('; ', $said)); else echo "inbox: nothing new\n";
    return 0;
}

/* ---------------------------------------------------------------- the hourly run */
function pmRunLine(string $s): void { @file_put_contents(pmData() . '/run.log', date('Y-m-d H:i', pmNow()) . ' ' . $s . "\n", FILE_APPEND | LOCK_EX); echo $s, "\n"; }
function pmCronRun(): int {
    if (!pmReady()) { echo "no data folder\n"; return 1; }
    $lk = fopen(pmData() . '/run.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { pmRunLine('another run is still going'); return 0; }
    $S = pmState(); $c = pmConn(); $running = array_keys(array_filter($S['lists'], fn($l) => $l['status'] === 'running'));
    /* first, anything the Peak desk has not heard about yet (it was down, or busy, last time) */
    $said = []; $d = pmDeskFlush($S['settings']); if ($d !== '') $said[] = $d;
    if (!$c['connected']) { pmRunLine(implode('; ', array_merge($said, [$running ? 'Microsoft is not connected: nothing sent' : 'idle (not connected)']))); return 0; }
    pmKeepAlive(); pmFromProbe(false, $S['settings']);
    $said[] = pmScan($S);   /* every run (2026-11-19): replies to desk emails and tour confirmations come to Peak Partnerships too, lists or not */
    $al = pmAlertsFlush(); if ($al !== '') $said[] = $al;   /* the desk's alerts (2026-11-20; the 5-minute read delivers them too) */
    $S = pmState();
    /* a list whose bounces pass 8% after 20 sends stops itself: a mailbox that keeps hitting dead addresses gets blocked */
    foreach (PM_LISTS as $k => $nm) {
        if ($S['lists'][$k]['status'] !== 'running') continue;
        $sent = 0; $bn = 0; foreach ($S['people'] as $x) if ($x['list'] === $k && $x['sent']) { $sent++; if ($x['bounce']) $bn++; }
        if ($sent >= 20 && $bn / $sent > 0.08) { pmLog(['t' => 'pause', 'l' => $k, 'by' => 'the hourly run', 'why' => "bounces are $bn of $sent: paused to protect the mailbox"]); $said[] = "$k paused (bounces $bn/$sent)"; }
    }
    $S = pmState(); $running = array_keys(array_filter($S['lists'], fn($l) => $l['status'] === 'running'));
    if (!$running) { pmRunLine(implode('; ', array_merge($said, ['no list running']))); return 0; }
    if (!pmInWindow($S['settings'], pmNow())) { pmRunLine(implode('; ', array_merge($said, ['outside the sending window (' . pmWindowText($S['settings']) . ')']))); return 0; }
    $fresh = pmImport($S['settings']);
    if ($fresh['error'] !== '') { pmRunLine(implode('; ', array_merge($said, ['nothing sent: ' . $fresh['error']]))); return 0; }
    $Q = []; foreach ($running as $k) {
        $why = pmStartBlocks($S, $k);
        $why = array_values(array_filter($why, fn($w) => !str_starts_with($w, 'Nobody is waiting')));
        if ($why) { $said[] = $k . ' not sending: ' . $why[0]; continue; }
        $Q[$k] = pmQueue($S, $k, $fresh);
        if (!$Q[$k]) { if (!$S['lists'][$k]['done']) pmLog(['t' => 'done', 'l' => $k]); $said[] = $k . ' done: everyone on the list has been emailed'; unset($Q[$k]); }
    }
    $n = pmHourBudget($S);
    if (!$Q || $n === 0) { pmRunLine(implode('; ', array_merge($said, [$n === 0 && $Q ? 'this hour\'s ' . $S['settings']['rate'] . ' already went' : 'nothing to send']))); return 0; }
    $gapEnv = pmEnv('PEAK_MAIL_GAP');
    $gap = $gapEnv !== '' ? max(0, (int) $gapEnv) : ($n > 1 ? min(300, intdiv(3300, $n)) : 0);   /* spread over about 55 minutes */
    $sent = ['sponsors' => 0, 'expo' => 0]; $skipped = 0; $turn = array_keys($Q); $ti = 0; $stopWhy = ''; $tried = false;
    for ($i = 0; $i < $n && $Q; $i++) {
        if ($tried && $gap) sleep($gap);   /* only after an email went (a skipped person costs no wait) */
        $tried = false;
        $S = pmState();
        if (!pmInWindow($S['settings'], pmNow())) { $stopWhy = 'the sending window closed'; break; }
        $k = $turn[$ti % count($turn)]; $ti++;
        if ($S['lists'][$k]['status'] !== 'running') { unset($Q[$k]); $turn = array_keys($Q); $i--; if (!$turn) break; continue; }
        if (pmIsDraft($S['templates'][$k]) || !pmAddressOk((string) $S['settings']['address'])) { unset($Q[$k]); $turn = array_keys($Q); $i--; if (!$turn) break; continue; }
        $p = null; while ($Q[$k] && $p === null) { $x = array_shift($Q[$k]); if (pmBlocked($S, $x['to']) === '') $p = $x; }
        if (!$Q[$k]) { unset($Q[$k]); $turn = array_keys($Q); }
        if ($p === null) { $i--; if (!$turn) break; continue; }
        /* the desk again, just before this email: someone may have taken the company on since the run started */
        if (pmSkipNow($p, $S['settings']) !== '') { $skipped++; $i--; if (!$turn) break; continue; }
        $m = pmRender($p, $S['templates'][$k], $S['settings'], true);
        if (isset($m['badph'])) { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => 'the template has ' . $m['badph'] . ' in it', 'final' => false]); $stopWhy = 'the ' . $k . ' template has ' . $m['badph'] . ' in it'; pmLog(['t' => 'pause', 'l' => $k, 'by' => 'the hourly run', 'why' => $stopWhy]); break; }
        $sid = 'pm-' . bin2hex(random_bytes(6));   /* this send's own id: the desk keeps it, so telling the desk twice is harmless */
        $r = pmSendOne($m, $S['settings']); $tried = true;
        if ($r['ok']) {
            /* the send is logged first; the desk is told after, and a desk failure only leaves a row for the next run to retry */
            $row = ['t' => 'sent', 'l' => $k, 'to' => $p['to'], 'from' => (string) ($r['from'] ?? ''), 'subject' => $m['subject'], 'by' => $S['lists'][$k]['by'], 'sid' => $sid, 'html' => isset($m['html']), 'at' => pmNow()] + pmDeskTag($p, $sid);
            pmLog($row); $sent[$k]++;
            try { pmDeskNow($row, $S['settings']); } catch (Throwable $e) { error_log('peak-mail: desk after send: ' . $e->getMessage()); }
            continue;
        }
        if ($r['kind'] === 'address') { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => $r['why'], 'final' => true]); $i--; continue; }
        if ($r['kind'] === 'other') { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => $r['why'], 'final' => false]); continue; }
        if ($r['kind'] === 'blocked') { foreach (PM_LISTS as $kk => $nn) if ($S['lists'][$kk]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $kk, 'by' => 'the hourly run', 'why' => 'Microsoft refused to send from the mailbox: ' . $r['why']]); $stopWhy = 'Microsoft refused to send (' . $r['why'] . '): both lists paused'; break; }
        if ($r['kind'] === 'sendas') { $stopWhy = $r['why'] . ': nothing sent, and nothing from Matthew\'s own mailbox instead (the next run tries again)'; break; }
        $stopWhy = ($r['kind'] === 'auth' ? 'the Microsoft sign-in needs attention: ' : 'Microsoft trouble, trying next hour: ') . $r['why']; break;
    }
    $dk = !empty($S['settings']['deskNotes']) ? count(pmDeskPending()) : 0;
    $said[] = 'sent ' . $sent['sponsors'] . ' sponsors, ' . $sent['expo'] . ' expo' . ($skipped ? ' (' . $skipped . ' skipped: the desk moved them on)' : '') . ($dk ? '; ' . $dk . ' desk updates wait for the next run' : '') . ($stopWhy !== '' ? ' (stopped: ' . $stopWhy . ')' : '');
    pmRunLine(implode('; ', $said)); flock($lk, LOCK_UN); return 0;
}

/* ---------------------------------------------------------------- stats */
function pmStats(?array $S = null): array {
    $S ??= pmState(); $lj = pmJ('lists.json', ['lists' => [], 'left' => []]); $fresh = is_file(pmData() . '/lists.json') ? pmImport($S['settings']) : null; $o = [];
    $pend = !empty($S['settings']['deskNotes']) ? count(pmDeskPending()) : 0;
    foreach (PM_LISTS as $k => $nm) {
        $ps = (array) ($lj['lists'][$k] ?? []); $on = array_filter($ps, fn($p) => $p['hold'] === '');
        $c = ['people' => count($on), 'held' => count($ps) - count($on), 'left' => count((array) ($lj['left'][$k] ?? [])), 'queued' => $fresh ? count(pmQueue($S, $k, $fresh)) : 0,
              'sent' => 0, 'replied' => 0, 'bounced' => 0, 'unsubscribed' => 0, 'clicked' => 0, 'clicks' => 0, 'auto' => 0, 'failed' => 0, 'generic' => 0, 'guessed' => 0,
              'opened' => 0, 'opens' => 0, 'booked' => 0, 'views' => 0, 'orgs' => count(array_unique(array_column($on, 'org'))),
              'skips' => pmSkipList((array) ($fresh['skips'][$k] ?? $lj['skips'][$k] ?? [])), 'deskError' => (string) ($fresh['error'] ?? ''), 'deskPending' => $pend];
        foreach ($on as $p) { if (in_array('generic', $p['flags'], true)) $c['generic']++; if (in_array('guessed', $p['flags'], true)) $c['guessed']++; }
        foreach ($S['people'] as $to => $x) {
            if ($x['list'] !== $k && !($x['list'] === '' && in_array($to, array_column($on, 'to'), true))) continue;
            if ($x['sent']) $c['sent']++; if ($x['reply']) $c['replied']++; if ($x['bounce']) $c['bounced']++; if ($x['unsub']) $c['unsubscribed']++;
            if ($x['clicks']) $c['clicked']++; $c['clicks'] += $x['clicks']; if ($x['auto']) $c['auto']++; if ($x['bad'] !== '') $c['failed']++;
            if ($x['opens']) $c['opened']++; $c['opens'] += $x['opens']; if ($x['booked']) $c['booked']++; if ($x['views']) $c['views']++;
        }
        $st = $S['lists'][$k]['status']; if ($st === 'running' && $c['queued'] === 0 && $c['sent'] > 0) $st = 'done';
        /* rates, as a share of the emails sent (opens: Apple Mail loads the image for every email, so it reads high; Outlook often blocks it, so low) */
        $pc = fn(int $n) => $c['sent'] ? round(100 * $n / $c['sent'], 1) : 0;
        $c['rates'] = ['open' => $pc($c['opened']), 'click' => $pc($c['clicked']), 'reply' => $pc($c['replied']), 'bounce' => $pc($c['bounced']), 'booked' => $pc($c['booked'])];
        $o[$k] = $c + ['status' => $st, 'pausedWhy' => $S['lists'][$k]['pausedWhy']];
    }
    return $o;
}
/** one line for the overnight check */
function pmStatsLine(): string {
    if (!pmReady()) return 'Peak email: not set up';
    $S = pmState(); $c = pmConn(); $st = pmStats($S); $parts = [];
    foreach (PM_LISTS as $k => $nm) { $x = $st[$k]; $parts[] = $k . ' ' . strtoupper($x['status']) . ' ' . $x['sent'] . ' sent/' . $x['queued'] . ' waiting, ' . $x['replied'] . ' replied, ' . $x['bounced'] . ' bounced, ' . $x['unsubscribed'] . ' unsub, ' . $x['opened'] . ' opened, ' . $x['clicked'] . ' clicked, ' . $x['booked'] . ' booked'; }
    $dp = !empty($S['settings']['deskNotes']) ? count(pmDeskPending()) : 0; if ($dp) $parts[] = $dp . ' desk updates waiting';
    $last = ''; $rl = @file(pmData() . '/run.log', FILE_IGNORE_NEW_LINES); if ($rl) $last = ' | last run ' . mb_substr((string) end($rl), 0, 90);
    $F = pmFromStatus($S['settings']); if ($F['warn'] !== '') $parts[] = 'ATTENTION: ' . $F['warn'];
    return 'Peak email: Microsoft ' . ($c['connected'] ? 'connected (' . $c['email'] . ', sending as ' . $F['email'] . ')' :(($c['status'] ?? '') === 'reconnect' ? 'NEEDS RECONNECT' : 'not connected')) . '; ' . implode('; ', $parts) . $last;
}

/* ---------------------------------------------------------------- deliverability (public DNS, read only) */
function pmDns(string $domain): array {
    $domain = strtolower(trim($domain)); if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain)) return ['error' => 'no domain'];
    $txt = fn(string $n) => array_map(fn($r) => (string) ($r['txt'] ?? implode('', (array) ($r['entries'] ?? []))), (array) @dns_get_record($n, DNS_TXT));
    $spf = array_values(array_filter($txt($domain), fn($t) => stripos($t, 'v=spf1') === 0));
    $dmarc = array_values(array_filter($txt('_dmarc.' . $domain), fn($t) => stripos($t, 'v=DMARC1') === 0));
    $dk = [];
    foreach (['selector1', 'selector2'] as $s) { $r = (array) @dns_get_record($s . '._domainkey.' . $domain, DNS_CNAME); $dk[$s] = (string) ($r[0]['target'] ?? ''); }
    $mx = array_map(fn($r) => (string) $r['target'], (array) @dns_get_record($domain, DNS_MX));
    $fix = [];
    if (!$spf) $fix[] = 'No SPF record: add TXT "v=spf1 include:spf.protection.outlook.com -all" at the domain.';
    elseif (stripos($spf[0], 'spf.protection.outlook.com') === false) $fix[] = 'SPF does not include Microsoft 365 (include:spf.protection.outlook.com).';
    if ($dk['selector1'] === '' || $dk['selector2'] === '') $fix[] = 'DKIM for Microsoft 365 is not set up: no selector1/selector2._domainkey CNAMEs. In the Microsoft Defender portal (Email & collaboration > Policies > Email authentication settings > DKIM) pick ' . $domain . ', copy the two CNAME values into the domain\'s DNS, then turn DKIM signing on.';
    if (!$dmarc) $fix[] = 'No DMARC record: add TXT at _dmarc.' . $domain . ' "v=DMARC1; p=none; rua=mailto:postmaster@' . $domain . '".';
    return ['domain' => $domain, 'spf' => $spf, 'dkim' => $dk, 'dmarc' => $dmarc, 'mx' => $mx, 'fix' => $fix, 'at' => pmNow()];
}

/* ---------------------------------------------------------------- Peak's own link address: the check before it goes on (X-16) */
const PM_LINKS_HOST = 'links.peakpickleball.us';
const PM_LINKS_SITE = 'traverseplatforms.com';   /* the SiteGround site the Peak name must point at (its A record) */
/** one request to the Peak name, the certificate checked by curl: code, type, location, body, error */
function pmLinksGet(string $url): array {
    $h = curl_init($url);
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_USERAGENT => 'Mozilla/5.0 (Peak link address check)', CURLOPT_NOSIGNAL => true]);
    $r = curl_exec($h); $err = $r === false ? curl_error($h) : ''; $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); $hs = (int) curl_getinfo($h, CURLINFO_HEADER_SIZE);
    $type = (string) curl_getinfo($h, CURLINFO_CONTENT_TYPE); curl_close($h);
    $head = $r === false ? '' : substr((string) $r, 0, $hs); $loc = preg_match('/^Location:\s*(\S+)/mi', $head, $m) ? $m[1] : '';
    return ['code' => $code, 'type' => $type, 'loc' => $loc, 'body' => $r === false ? '' : substr((string) $r, $hs), 'err' => $err];
}
/** is the Peak name ready: DNS to this site, a valid certificate, and every handler answering as itself (with bad signatures, so nothing
    is logged or counted). ['ok' => bool, 'base' => ..., 'lines' => [[pass|warn|FAIL, words], ...]]. Nothing is changed. */
function pmLinksHost(): string { return pmEnv('PEAK_LINKS_HOST') ?: PM_LINKS_HOST; }   /* the tests check a name that does not exist */
function pmLinksCheck(string $host = ''): array {
    $host = $host !== '' ? $host : pmLinksHost();
    $L = []; $ok = true; $add = function (string $s, string $t) use (&$L, &$ok) { $L[] = [$s, $t]; if ($s === 'FAIL') $ok = false; };
    $base = 'https://' . $host; $done = function () use (&$ok, &$L, $base) { return ['ok' => $ok, 'base' => $base, 'lines' => $L]; };
    if (!pmLinkOk($base)) { $add('FAIL', $host . ' is not a name under peakpickleball.us'); return $done(); }
    /* 1. DNS: an A record to this SiteGround site */
    $a = (array) (@gethostbynamel($host) ?: []); $site = (array) (@gethostbynamel(PM_LINKS_SITE) ?: []);
    if (!$a) { $add('FAIL', 'DNS: ' . $host . ' does not resolve yet. GoDaddy, peakpickleball.us, DNS: add an A record, name "links", value ' . ($site[0] ?? 'this site\'s IP') . '.'); return $done(); }
    if (!$site || array_diff($a, $site)) { $add('FAIL', 'DNS: ' . $host . ' points at ' . implode(', ', $a) . ', not this site (' . implode(', ', $site) . ').'); return $done(); }
    $add('pass', 'DNS: ' . $host . ' -> ' . implode(', ', $a) . ' (this site)');
    /* 2. the certificate: valid for the name, not about to run out */
    $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host, 'SNI_enabled' => true]]);
    $s = @stream_socket_client('ssl://' . $host . ':443', $en, $es, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$s) { $add('FAIL', 'Certificate: none valid for ' . $host . ' yet (SiteGround, Site Tools, Security, SSL Manager: Let\'s Encrypt for ' . $host . ').'); return $done(); }
    $x = @openssl_x509_parse(stream_context_get_params($s)['options']['ssl']['peer_certificate'] ?? ''); fclose($s);
    $days = is_array($x) ? (int) floor(((int) ($x['validTo_time_t'] ?? 0) - time()) / 86400) : -1;
    $add($days >= 7 ? 'pass' : 'FAIL', 'Certificate: valid for ' . $host . ', ' . (string) ($x['issuer']['O'] ?? $x['issuer']['CN'] ?? 'issuer unknown') . ', ' . $days . ' days left');
    /* 3. every handler on the Peak name answers as itself; nothing else of this site shows there; no traverseplatforms.com in any answer */
    $logo = (string) (@md5_file(__DIR__ . '/' . PM_LOGO) ?: '');
    $gif = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    $want = [
        ['/peak-logo.png', 200, fn($r) => str_starts_with($r['type'], 'image/png') && ($logo === '' || md5($r['body']) === $logo), 'the logo'],
        ['/o.php?r=0000000000&s=0', 200, fn($r) => str_starts_with($r['type'], 'image/gif') && $r['body'] === $gif, 'the open image (o.php)'],
        ['/r.php?r=0000000000&l=00000000&s=0', 302, fn($r) => $r['loc'] === 'https://peakpickleball.us/', 'tracked links (r.php)'],
        ['/book.php?r=0000000000&s=0', 200, fn($r) => str_contains($r['body'], 'That link did not work'), 'book a time (/book.php is b.php)'],
        ['/u.php?r=0000000000&s=0', 200, fn($r) => str_contains($r['body'], 'That link did not work'), 'the old unsubscribe page (u.php)'],
        ['/book/?g=0000000000000000', 200, fn($r) => str_contains($r['body'], 'PEAK PICKLEBALL') && str_contains($r['body'], 'That link did not work'), 'the desk\'s booking page (/book/)'],
        ['/', 302, fn($r) => $r['loc'] === 'https://peakpickleball.us/', 'the bare name goes to peakpickleball.us'],
        ['/peak-desk-28d38d/', 404, fn($r) => true, 'the desk is not served on the Peak name'],
        ['/outbox-092b0f/', 404, fn($r) => true, 'Outbox is not served on the Peak name'],
        ['/index.html', 404, fn($r) => true, 'the Traverse website is not served on the Peak name (if 200: SiteGround serves plain files itself on this name; turn that off for it: site-tools-client domain-alias update id=<its id> settings.static_direct=0)'],
        ['/peak-desk-28d38d/index.html', 404, fn($r) => true, 'the desk page is not served on the Peak name'],
    ];
    foreach ($want as [$p, $code, $test, $what]) {
        $r = pmLinksGet($base . $p);
        if ($r['err'] !== '') { $add('FAIL', $what . ': ' . $p . ' did not answer (' . mb_substr($r['err'], 0, 120) . ')'); continue; }
        $leak = stripos($r['body'] . ' ' . $r['loc'], 'traverseplatforms') !== false;
        $good = $r['code'] === $code && $test($r) && !$leak;
        $add($good ? 'pass' : 'FAIL', $what . ': ' . $p . ' -> ' . $r['code'] . ($r['loc'] !== '' ? ' ' . $r['loc'] : '') . ($leak ? ' (says traverseplatforms.com)' : '') . ($good ? '' : ' (expected ' . $code . ')'));
    }
    /* 4. plain http goes to https (the emails only carry https, so this is a warning) */
    $r = pmLinksGet('http://' . $host . '/peak-logo.png');
    $add(in_array($r['code'], [301, 302, 307, 308], true) && str_starts_with($r['loc'], 'https://' . $host . '/') ? 'pass' : 'warn',
        'http goes to https: ' . ($r['err'] !== '' ? 'no answer' : $r['code'] . ' ' . $r['loc']) . ' (if not: SiteGround, Security, HTTPS Enforce, on for ' . $host . ')');
    return $done();
}
/** switch Peak's own link address on (only after the check passes) or off. The setting is one file the desk reads too. */
function pmLinksSwitch(bool $on, string $by): array {
    $f = pmDesk() . '/' . PM_LINKS_FILE;
    $log = function (array $r) use ($by) { @file_put_contents(pmDesk() . '/peak-links.log', json_encode($r + ['by' => $by, 'at' => time()], JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX); };
    if (!$on) { $was = pmLinkSet(); if (is_file($f) && !@unlink($f)) return ['ok' => false, 'why' => 'could not remove ' . $f]; $log(['t' => 'off', 'was' => $was]); return ['ok' => true, 'base' => pmBase()]; }
    $c = pmEnv('PEAK_LINKS_CHECK_PASS') !== '' ? ['ok' => true, 'base' => 'https://' . pmLinksHost(), 'lines' => [['pass', 'test: check skipped']]] : pmLinksCheck();
    if (!$c['ok']) return ['ok' => false, 'why' => 'the check did not pass, so nothing changed', 'check' => $c];
    $s = (string) json_encode(['base' => $c['base'], 'by' => $by, 'at' => time()], JSON_UNESCAPED_SLASHES); $t = $f . '.tmp' . bin2hex(random_bytes(3));
    if (@file_put_contents($t, $s, LOCK_EX) !== strlen($s) || !@chmod($t, 0600) || !@rename($t, $f)) { @unlink($t); return ['ok' => false, 'why' => 'could not write ' . $f]; }
    if (pmLinkSet() !== $c['base']) return ['ok' => false, 'why' => 'written, but it does not read back'];
    $log(['t' => 'on', 'base' => $c['base']]); return ['ok' => true, 'base' => $c['base'], 'check' => $c];
}

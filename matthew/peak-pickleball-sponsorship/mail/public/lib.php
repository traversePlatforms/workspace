<?php
declare(strict_types=1);
/* Peak outreach email (2026-11-17, Matthew: "I need to start doing emails for peak, similiar to how I do email for traverse, sending X amount out
 * each hour until our list is tapped. I need it to go to the inbox ... for peak sponsors and for potential people that want to rent that expo
 * space"). Sends from Matthew's Peak Pickleball Outlook mailbox through Microsoft Graph (/me/sendMail), one plain-text email per person, in
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
 * goes through r.php so clicks are counted. Matthew's mailbox is only READ (replies and bounce notices): nothing in it is moved, marked
 * or deleted.
 * Tests: PEAK_MAIL_DATA, PEAK_DESK_DATA, PEAK_MAIL_MOCK (http://127.0.0.1:port stands in for Microsoft), PEAK_MAIL_NOW, PEAK_MAIL_GAP,
 * PEAK_MAIL_MX=skip; honoured only from the command line or PHP's own test server. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const PM_LISTS = ['sponsors' => 'Peak sponsors', 'expo' => 'Expo space rental'];
const PM_SCOPE = 'offline_access User.Read Mail.ReadWrite Mail.Send';
const PM_PATH = '/peak-mail-31dc56';
const PM_ORIGIN = 'https://traverseplatforms.com';
const PM_RATE_MAX = 30;
const PM_RAMP = 10;        /* the first sending day: at most 10 an hour, whatever the rate */
const PM_TTL = 600;        /* a Microsoft sign-in must come back within ten minutes */
const PM_DAYS = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
const PM_ADMIN_HELP = 'Peak\'s Global admin signs in at entra.microsoft.com, opens Identity > Applications > Enterprise applications (or App registrations > All applications), picks "Matthew outreach", then Permissions (API permissions) and presses "Grant admin consent for Peak Pickleball". Then press Connect Microsoft here again.';

/* ---------------------------------------------------------------- where things are */
function pmTestOk(): bool { return PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server'; }
function pmEnv(string $k): string { return pmTestOk() ? (string) getenv($k) : ''; }
function pmData(): string { $e = pmEnv('PEAK_MAIL_DATA'); return $e !== '' ? $e : dirname(__DIR__, 2) . '/peak-mail-data'; }
function pmDesk(): string { $e = pmEnv('PEAK_DESK_DATA'); return $e !== '' ? $e : dirname(__DIR__, 2) . '/peak-desk-data'; }
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
function pmRedirect(): string { return pmBase() . '/oauth.php'; }

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
    $j = ['email' => $mail, 'upn' => strtolower((string) ($w['userPrincipalName'] ?? '')), 'name' => pmClean($w['displayName'] ?? '', 80), 'status' => 'ok',
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
        [$s, $r] = pmForm(pmLogin() . '/' . $app['tenant'] . '/oauth2/v2.0/token', ['client_id' => $app['id'], 'client_secret' => $app['secret'], 'grant_type' => 'refresh_token', 'refresh_token' => (string) $tok['r'], 'scope' => PM_SCOPE]);
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
        $j['tok'] = pmSeal($tok); $j['refreshed'] = pmNow(); pmW('ms.json', $j);
        return ['ok' => true, 't' => $tok['a']];
    } finally { if ($lk) { flock($lk, LOCK_UN); fclose($lk); } }
}
/** one Graph call with the mailbox's token: [status, decoded body, raw]; a 401 renews the token and tries once more */
function pmGraph(string $method, string $path, ?array $json = null, array $extra = []): array {
    $a = pmAccess(); if (!$a['ok']) return [-1, ['error' => ['message' => $a['why']]], '', $a];
    for ($try = 0; $try < 2; $try++) {
        $h = array_merge(['Authorization: Bearer ' . $a['t'], 'Accept: application/json'], $json !== null ? ['Content-Type: application/json'] : [], $extra);
        [$s, $b] = pmHttp($method, pmGraphBase() . $path, $h, $json !== null ? (string) json_encode($json, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null);
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

/* ---------------------------------------------------------------- settings, templates, state */
function pmDefaults(): array {
    return ['rate' => 12, 'days' => [1, 2, 3, 4, 5], 'from' => 9, 'to' => 16, 'ramp' => true,
            /* days the office is out: Thanksgiving and the day after, Christmas Eve and Day, New Year's Eve and Day */
            'skip' => ['2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01'],
            /* Peak's street address, as Peak's own website, CourtReserve and BBB list it (checked 22 Oct and 13 Nov 2026) */
            'address' => 'Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920',
            'signature' => "Matthew Sharpe\nPeak Pickleball", 'perOrg' => 1, 'deskNotes' => true];
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
    $p = function (string $to) use (&$P) { $to = strtolower($to); if (!isset($P[$to])) $P[$to] = ['sent' => 0, 'list' => '', 'reply' => 0, 'stop' => false, 'auto' => 0, 'bounce' => 0, 'unsub' => 0, 'clicks' => 0, 'scans' => 0, 'fails' => 0, 'bad' => '']; return $to; };
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
            case 'suppress': $sup[$to] = 'added by hand' . (!empty($r['why']) ? ': ' . $r['why'] : ''); break;
            case 'unsuppress': if (($sup[$to] ?? '') !== '' && str_starts_with($sup[$to], 'added by hand')) unset($sup[$to]); break;
        }
    }
    $set['rate'] = max(1, min(PM_RATE_MAX, (int) $set['rate']));
    return ['settings' => $set, 'templates' => $tpl, 'lists' => $L, 'people' => $P, 'suppressed' => $sup, 'firstSent' => $first, 'byDay' => $byDay, 'sentTimes' => $recent];
}
/** why an address may not be emailed now ('' = it may) */
function pmBlocked(array $S, string $to): string {
    $to = strtolower($to); $x = $S['people'][$to] ?? null;
    if (isset($S['suppressed'][$to])) return 'suppressed: ' . $S['suppressed'][$to];
    if ($x && $x['sent']) return 'already emailed';
    if ($x && $x['reply']) return 'wrote to Matthew already';
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

/** the Peak desk's sponsor leads, replayed as desk.php does (seed, Peak's own sponsor records, the desk log, the website look-ups) */
function pmSponsorLeads(): array {
    $seed = pmDeskJ('seed.json', ['leads' => []]); $L = []; $peakMail = [];
    foreach (($seed['leads'] ?? []) as $l) if (isset($l['id'])) $L[$l['id']] = $l + ['status' => 'new', 'added' => [], 'signed' => false];
    foreach ((pmDeskJ('peak-records.json', ['leads' => []])['leads'] ?? []) as $r) {
        $id = (string) ($r['id'] ?? ''); if ($id === '') continue;
        if (!isset($L[$id])) $L[$id] = ['id' => $id, 'name' => (string) ($r['name'] ?? ''), 'contacts' => [], 'status' => 'new', 'added' => [], 'signed' => false];
        $L[$id]['list'] = 'renew';
        foreach (($r['contacts'] ?? []) as $c) if (!empty($c['email'])) $peakMail[strtolower((string) $c['email'])] = (string) ($r['name'] ?? '');
    }
    foreach (pmRows('events.log', pmDesk()) as $r) {
        $id = (string) ($r['id'] ?? '');
        switch ((string) ($r['t'] ?? '')) {
            case 'lead': if (is_array($r['lead'] ?? null)) $L[$id] = $r['lead'] + ['status' => 'new', 'added' => [], 'signed' => false, 'contacts' => []]; break;
            case 'status': if (isset($L[$id])) $L[$id]['status'] = (string) $r['status']; break;
            case 'contact': if (isset($L[$id]) && is_array($r['contact'] ?? null)) $L[$id]['added'][] = $r['contact']; break;
            case 'leaddel': if (isset($L[$id])) $L[$id]['off'] = true; break;
            case 'leadback': if (isset($L[$id])) unset($L[$id]['off']); break;
            case 'signed': if (isset($L[$id])) $L[$id]['signed'] = true; break;
        }
    }
    foreach (pmDeskJ('scans.json', []) as $id => $s) if (isset($L[$id]) && is_array($s)) { $L[$id]['scanEmails'] = (array) ($s['emails'] ?? []); $L[$id]['addr'] = (string) ($s['addr'] ?? ''); }
    return [$L, $peakMail];
}
/** the Peak desk's Expo leads, replayed as desk.php's expoState() does */
function pmExpoOrgs(): array {
    $seed = pmDeskJ('expo-seed.json', ['orgs' => []]); $O = [];
    foreach (($seed['orgs'] ?? []) as $o) if (isset($o['id'])) $O[$o['id']] = $o + ['stage' => 'new', 'added' => []];
    foreach (pmRows('expo-events.log', pmDesk()) as $r) {
        $id = (string) ($r['id'] ?? '');
        switch ((string) ($r['t'] ?? '')) {
            case 'xlead': if (is_array($r['org'] ?? null)) $O[$id] = $r['org'] + ['stage' => 'new', 'added' => [], 'contacts' => []]; break;
            case 'xstage': if (isset($O[$id])) $O[$id]['stage'] = (string) $r['stage']; break;
            case 'xcontact': if (isset($O[$id]) && is_array($r['contact'] ?? null)) $O[$id]['added'][] = $r['contact']; break;
            case 'xdel': if (isset($O[$id])) $O[$id]['off'] = true; break;
            case 'xback': if (isset($O[$id])) unset($O[$id]['off']); break;
        }
    }
    uasort($O, fn($a, $b) => ((int) ($a['pri'] ?? 9)) <=> ((int) ($b['pri'] ?? 9)));
    return $O;
}
const PM_SPONSOR_STATUS = ['contacted' => 'Contacted', 'tour' => 'Tour booked', 'toured' => 'Toured', 'proposal' => 'Proposal sent', 'signed' => 'Signed', 'notnow' => 'Not now', 'no' => 'No'];
const PM_EXPO_STAGE = ['contacted' => 'Contacted', 'talking' => 'Talking', 'visit' => 'Site visit booked', 'proposal' => 'Proposal sent', 'booked' => 'Booked', 'notfit' => 'Not a fit'];
/** both lists as the desk has them now: ['lists' => [list => [person ...]], 'left' => [list => [[name, why] ...]]]. One person per address
    across both lists (sponsors first); per organisation up to perOrg people are queued, the others are kept as "held". */
function pmImport(int $perOrg = 1): array {
    $perOrg = max(1, min(3, $perOrg));
    $lists = ['sponsors' => [], 'expo' => []]; $left = ['sponsors' => [], 'expo' => []]; $used = [];
    [$L, $peakMail] = pmSponsorLeads();
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
    foreach ($L as $id => $l) {
        $name = (string) ($l['name'] ?? ''); $why = '';
        if (!empty($l['off'])) $why = 'removed from the desk';
        elseif (($l['list'] ?? '') === 'renew') $why = 'already a Peak sponsor (Peak sponsors tab)';
        elseif (!empty($l['signed']) || ($l['status'] ?? '') === 'signed') $why = 'signed';
        elseif (($l['status'] ?? 'new') !== 'new') $why = 'the desk shows ' . (PM_SPONSOR_STATUS[$l['status']] ?? $l['status']) . ': someone is already working it';
        $c = [];
        foreach ((array) ($l['contacts'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['pos'] ?? ''), 'pick' => !empty($x['pick']), 'conf' => $x['conf'] ?? null, 'src' => 'desk research', 'guess' => is_numeric($x['conf'] ?? null) && (int) $x['conf'] < 80];
        foreach ((array) ($l['added'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['pos'] ?? ''), 'pick' => true, 'conf' => 100, 'src' => 'added on the desk', 'guess' => false];
        foreach ((array) ($l['scanEmails'] ?? []) as $e) if (is_string($e) && $e !== '') $c[] = ['email' => $e, 'name' => '', 'role' => 'on their website', 'pick' => false, 'conf' => 90, 'src' => 'their website', 'guess' => false];
        if ($why === '' && !$c) $why = 'no email on file';
        if ($why !== '') { $left['sponsors'][] = ['name' => $name, 'why' => $why]; continue; }
        /* who first: the desk's own pick, then a named person over a shared inbox, then the surest address */
        usort($c, fn($a, $b) => [(int) $b['pick'], (int) !pmGeneric((string) $b['email']), (int) ($b['conf'] ?? 75)] <=> [(int) $a['pick'], (int) !pmGeneric((string) $a['email']), (int) ($a['conf'] ?? 75)]);
        if ($add('sponsors', (string) $id, 'lead', pmCompany($name), pmTown((string) ($l['addr'] ?? '')), $c) === 0) $left['sponsors'][] = ['name' => $name, 'why' => 'no address that can be emailed'];
    }
    foreach (pmExpoOrgs() as $id => $o) {
        $name = (string) ($o['name'] ?? ''); $why = '';
        if (!empty($o['off'])) $why = 'removed from the desk';
        elseif (($o['stage'] ?? 'new') !== 'new') $why = 'the desk shows ' . (PM_EXPO_STAGE[$o['stage']] ?? $o['stage']) . ': someone is already working it';
        $c = [];
        foreach ((array) ($o['contacts'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['role'] ?? ''), 'pick' => !empty($x['best']), 'conf' => stripos((string) ($x['estat'] ?? ''), 'published') !== false ? 95 : 70, 'src' => 'desk research', 'guess' => stripos((string) ($x['estat'] ?? ''), 'pattern') !== false || stripos((string) ($x['estat'] ?? ''), 'unverified') !== false];
        foreach ((array) ($o['added'] ?? []) as $x) if (!empty($x['email'])) $c[] = ['email' => $x['email'], 'name' => (string) ($x['name'] ?? ''), 'role' => (string) ($x['role'] ?? ''), 'pick' => true, 'conf' => 100, 'src' => 'added on the desk', 'guess' => false];
        if ($why === '' && !$c) $why = 'no email on file';
        if ($why !== '') { $left['expo'][] = ['name' => $name, 'why' => $why]; continue; }
        usort($c, fn($a, $b) => [(int) $b['pick'], (int) !pmGeneric((string) $b['email']), (int) $b['conf']] <=> [(int) $a['pick'], (int) !pmGeneric((string) $a['email']), (int) $a['conf']]);
        if ($add('expo', (string) $id, 'xorg', pmCompany($name), '', $c) === 0) $left['expo'][] = ['name' => $name, 'why' => 'no address that can be emailed'];
    }
    return ['lists' => $lists, 'left' => $left];
}
/** import and save; a running list that gains people is paused, so nobody new is emailed without Matthew's Start */
function pmImportSave(string $by): array {
    $S = pmState(); $old = pmJ('lists.json', null); $new = pmImport((int) $S['settings']['perOrg']);
    $out = ['at' => pmNow(), 'lists' => $new['lists'], 'left' => $new['left']]; pmW('lists.json', $out);
    $diff = [];
    foreach (PM_LISTS as $k => $n) {
        $was = []; foreach ((array) ($old['lists'][$k] ?? []) as $p) if ($p['hold'] === '') $was[$p['to']] = 1;
        $now = array_filter($new['lists'][$k], fn($p) => $p['hold'] === '');
        $added = count(array_filter($now, fn($p) => !isset($was[$p['to']])));
        $diff[$k] = ['queued' => count($now), 'added' => $old ? $added : count($now), 'held' => count($new['lists'][$k]) - count($now), 'left' => count($new['left'][$k])];
        if ($old && $added > 0 && $S['lists'][$k]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $k, 'by' => $by, 'why' => $added . ' new people came in from the Peak desk: check the preview and press Start again']);
    }
    pmLog(['t' => 'import', 'by' => $by, 'counts' => $diff]);
    return $diff;
}

/* ---------------------------------------------------------------- one email */
function pmUnsubUrl(string $rid): string { return pmBase() . '/u.php?r=' . $rid . '&s=' . pmSig('u|' . $rid); }
/** a web address in an email, through r.php (the address itself is kept in links.json by a short key) */
function pmTrack(string $url, string $rid, bool $save): string {
    $h = substr(hash('sha256', $url), 0, 8);
    if ($save) { $m = pmJ('links.json', []); if (($m[$h] ?? '') !== $url) { $m[$h] = $url; pmW('links.json', $m); } }
    return pmBase() . '/r.php?r=' . $rid . '&l=' . $h . '&s=' . pmSig('r|' . $rid . '|' . $h);
}
/** one person's email: subject, body (plain text), and what to warn about */
function pmRender(array $p, array $tpl, array $set, bool $save = false): array {
    /* merge fields, each with a fallback that still reads right when the desk has no value */
    $v = ['{first}' => $p['first'] !== '' ? $p['first'] : 'there', '{company}' => $p['company'] !== '' ? $p['company'] : 'your team', '{town}' => $p['town'] !== '' ? $p['town'] : 'your area'];
    $usedTpl = (string) $tpl['subject'] . "\n" . (string) $tpl['body']; $miss = [];
    foreach (['first' => 'first name', 'company' => 'company', 'town' => 'town'] as $f => $label) if ($p[$f] === '' && str_contains($usedTpl, '{' . $f . '}')) $miss[] = $label;
    $subject = pmClean(strtr((string) $tpl['subject'], $v), 200);
    $main = rtrim(strtr(pmText($tpl['body'], 8000), $v));
    $links = 0;
    $main = (string) preg_replace_callback('~\bhttps?://[^\s<>()"\']+[^\s<>().,;:!?"\']~i', function ($m) use ($p, $save, &$links) { $links++; return pmTrack($m[0], $p['rid'], $save); }, $main);
    $sig = trim((string) $set['signature']);
    $body = $main . "\n\n" . ($sig !== '' ? $sig . "\n" : '') . trim((string) $set['address'])
          . "\n\nIf you'd rather not hear from me again, reply STOP or use this link: " . pmUnsubUrl($p['rid']);
    $m = ['to' => $p['to'], 'name' => $p['person'], 'subject' => $subject, 'body' => $body, 'links' => $links, 'fallbacks' => $miss];
    if (preg_match('/\{[a-z_]+\}/i', $subject . "\n" . $main, $ph)) $m['badph'] = $ph[0];
    return $m;
}
/** send one email from the connected mailbox: ['ok'] or ['ok' => false, 'kind' => server|address|blocked|auth, 'why'] */
function pmSendOne(array $m): array {
    $msg = ['message' => ['subject' => $m['subject'], 'body' => ['contentType' => 'Text', 'content' => $m['body']],
            'toRecipients' => [['emailAddress' => array_filter(['address' => $m['to'], 'name' => $m['name'] ?? ''], 'strlen')]]], 'saveToSentItems' => true];
    [$s, $j, $raw, $a] = pmGraph('POST', '/v1.0/me/sendMail', $msg);
    if ($s === 202 || $s === 200) return ['ok' => true];
    if ($s === -1) return ['ok' => false, 'kind' => !empty($a['stop']) ? 'auth' : 'server', 'why' => (string) ($j['error']['message'] ?? 'not connected')];
    $code = (string) ($j['error']['code'] ?? ''); $why = mb_substr(trim($code . ': ' . (string) ($j['error']['message'] ?? '')), 0, 200);
    if (preg_match('/SubmissionBlocked|OutboundSpam|SendAsDenied|QuotaExceeded|MailboxNotEnabled|blocked|suspended/i', $code . ' ' . $raw)) return ['ok' => false, 'kind' => 'blocked', 'why' => $why];
    if ($s === 403 || $s === 401) return ['ok' => false, 'kind' => 'auth', 'why' => $why];
    if ($s === 0 || $s === 429 || $s >= 500) return ['ok' => false, 'kind' => 'server', 'why' => ($s ?: 'no answer') . ' ' . $why];
    if (preg_match('/InvalidRecipients|InvalidRecipient|ErrorInvalidEmail|recipient/i', $code . ' ' . $why)) return ['ok' => false, 'kind' => 'address', 'why' => $why];
    return ['ok' => false, 'kind' => 'other', 'why' => $s . ' ' . $why];
}

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
    $lj = pmJ('lists.json', ['lists' => []]); $fresh ??= pmImport((int) $S['settings']['perOrg']);
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
    if (!pmAddressOk((string) $S['settings']['address'])) $b[] = 'Peak\'s postal address is missing in Settings (the law wants it in every email).';
    if (pmIsDraft($S['templates'][$list])) $b[] = 'The template is still the DRAFT placeholder. Put the approved email in and save it.';
    if (!str_contains(strtolower((string) $S['templates'][$list]['body']), 'http') ) $b[] = 'The email has no web address, so clicks cannot be counted (add Peak\'s website).';
    if (!is_file(pmData() . '/lists.json')) $b[] = 'The list has not been brought in from the Peak desk yet.';
    elseif (!pmQueue($S, $list)) $b[] = 'Nobody is waiting on this list.';
    return $b;
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
/** read the inbox and junk folder since the last look; mark replies and bounces. Returns a short summary. Nothing in the mailbox is changed. */
function pmScan(array $S): string {
    $lj = pmJ('lists.json', ['lists' => []]); $who = [];
    foreach ($lj['lists'] ?? [] as $k => $ps) foreach ($ps as $p) if ($p['hold'] === '' || isset($S['people'][$p['to']])) $who[$p['to']] ??= $p + ['list' => $k];
    if (!$who) return 'nothing to look for';
    $sc = pmJ('scan.json', ['last' => 0, 'seen' => []]);
    $since = max((int) $sc['last'] - 2 * 86400, ($S['firstSent'] ?: pmNow()) - 3 * 86400);
    $iso = gmdate('Y-m-d\TH:i:s\Z', $since); $n = ['reply' => 0, 'bounce' => 0, 'auto' => 0, 'stop' => 0]; $seen = (array) $sc['seen']; $now = pmNow();
    foreach (['inbox', 'junkemail'] as $folder) {
        $path = '/v1.0/me/mailFolders/' . $folder . '/messages?$select=id,from,subject,receivedDateTime,bodyPreview&$filter=' . rawurlencode('receivedDateTime ge ' . $iso) . '&$orderby=' . rawurlencode('receivedDateTime desc') . '&$top=50';
        for ($page = 0; $page < 8 && $path !== ''; $page++) {
            [$s, $j] = pmGraph('GET', $path);
            if ($s !== 200) return 'could not read the ' . $folder . ' (' . $s . ': ' . mb_substr((string) ($j['error']['message'] ?? ''), 0, 80) . ')';
            foreach ((array) ($j['value'] ?? []) as $m) {
                $id = (string) ($m['id'] ?? ''); if ($id === '' || isset($seen[$id])) continue; $seen[$id] = $now;
                $from = strtolower((string) ($m['from']['emailAddress']['address'] ?? '')); $at = (int) strtotime((string) ($m['receivedDateTime'] ?? '')) ?: $now;
                if (pmIsNdr($m)) {
                    [$s2, $full] = pmGraph('GET', '/v1.0/me/messages/' . rawurlencode($id) . '?$select=body', null, ['Prefer: outlook.body-content-type="text"']);
                    $txt = ($s2 === 200 ? (string) ($full['body']['content'] ?? '') : '') . ' ' . (string) ($m['bodyPreview'] ?? '');
                    preg_match_all('/[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $txt, $em);
                    foreach (array_unique(array_map('strtolower', $em[0])) as $e) {
                        if (!isset($who[$e]) || empty($S['people'][$e]['sent']) || !empty($S['people'][$e]['bounce'])) continue;
                        pmLog(['t' => 'bounce', 'to' => $e, 'l' => $who[$e]['list'], 'at' => $at]); $S['people'][$e]['bounce'] = $at; $n['bounce']++;
                    }
                    continue;
                }
                if (!isset($who[$from])) continue;
                if (pmIsAuto($m)) { pmLog(['t' => 'auto', 'to' => $from, 'l' => $who[$from]['list'], 'at' => $at]); $n['auto']++; continue; }
                $subj = (string) preg_replace('/^((re|aw|fw|fwd)\s*:\s*)+/i', '', (string) ($m['subject'] ?? ''));
                $stop = pmIsStop((string) ($m['bodyPreview'] ?? '')) || preg_match('/^\W*(stop|unsubscribe)\W*$/i', $subj);
                if (!empty($S['people'][$from]['reply']) && !$stop) continue;
                pmLog(['t' => 'reply', 'to' => $from, 'l' => $who[$from]['list'], 'stop' => (bool) $stop, 'before' => empty($S['people'][$from]['sent']), 'subject' => pmClean($m['subject'] ?? '', 120), 'at' => $at]);
                if (empty($S['people'][$from]['reply'])) { $n['reply']++; pmDeskNote($S, $who[$from], $stop !== '', $at); }
                $S['people'][$from]['reply'] = $at; if ($stop) $n['stop']++;
            }
            $next = (string) ($j['@odata.nextLink'] ?? '');
            $path = $next !== '' ? (string) preg_replace('#^https://graph\.microsoft\.com|^' . preg_quote(pmGraphBase(), '#') . '#', '', $next) : '';
        }
    }
    foreach ($seen as $k => $t) if ($t < $now - 30 * 86400) unset($seen[$k]);
    pmW('scan.json', ['last' => $now, 'seen' => $seen]);
    return 'read mail: ' . $n['reply'] . ' replies (' . $n['stop'] . ' STOP), ' . $n['bounce'] . ' bounces, ' . $n['auto'] . ' auto-replies';
}
/** a dated note on the Peak desk card for someone who replied (Settings: on by default); the desk's own append-only logs */
function pmDeskNote(array $S, array $p, bool $stop, int $at): void {
    if (empty($S['settings']['deskNotes']) || !is_dir(pmDesk())) return;
    $note = ($p['person'] !== '' ? $p['person'] : $p['to']) . ' replied to the Peak email from Matthew on ' . date('M j', $at) . ($stop ? ' (asked to stop: not emailed again)' : '') . '. The reply is in Matthew\'s Peak Outlook.';
    $row = $p['kind'] === 'xorg' ? ['t' => 'xnote', 'id' => $p['org'], 'note' => $note, 'by' => 'Peak email', 'at' => pmNow()] : ['t' => 'note', 'id' => $p['org'], 'note' => $note, 'by' => 'Peak email', 'at' => pmNow()];
    @file_put_contents(pmDesk() . '/' . ($p['kind'] === 'xorg' ? 'expo-events.log' : 'events.log'), json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/* ---------------------------------------------------------------- the hourly run */
function pmRunLine(string $s): void { @file_put_contents(pmData() . '/run.log', date('Y-m-d H:i', pmNow()) . ' ' . $s . "\n", FILE_APPEND | LOCK_EX); echo $s, "\n"; }
function pmCronRun(): int {
    if (!pmReady()) { echo "no data folder\n"; return 1; }
    $lk = fopen(pmData() . '/run.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { pmRunLine('another run is still going'); return 0; }
    $S = pmState(); $c = pmConn(); $running = array_keys(array_filter($S['lists'], fn($l) => $l['status'] === 'running'));
    if (!$c['connected']) { pmRunLine($running ? 'Microsoft is not connected: nothing sent' : 'idle (not connected)'); return 0; }
    pmKeepAlive();
    $said = [];
    if ($S['firstSent'] || $running) $said[] = pmScan($S);
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
    $fresh = pmImport((int) $S['settings']['perOrg']);
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
    $sent = ['sponsors' => 0, 'expo' => 0]; $turn = array_keys($Q); $ti = 0; $stopWhy = ''; $tried = false;
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
        $m = pmRender($p, $S['templates'][$k], $S['settings'], true);
        if (isset($m['badph'])) { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => 'the template has ' . $m['badph'] . ' in it', 'final' => false]); $stopWhy = 'the ' . $k . ' template has ' . $m['badph'] . ' in it'; pmLog(['t' => 'pause', 'l' => $k, 'by' => 'the hourly run', 'why' => $stopWhy]); break; }
        $r = pmSendOne($m); $tried = true;
        if ($r['ok']) { pmLog(['t' => 'sent', 'l' => $k, 'to' => $p['to'], 'subject' => $m['subject'], 'by' => $S['lists'][$k]['by']]); $sent[$k]++; continue; }
        if ($r['kind'] === 'address') { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => $r['why'], 'final' => true]); $i--; continue; }
        if ($r['kind'] === 'other') { pmLog(['t' => 'fail', 'l' => $k, 'to' => $p['to'], 'why' => $r['why'], 'final' => false]); continue; }
        if ($r['kind'] === 'blocked') { foreach (PM_LISTS as $kk => $nn) if ($S['lists'][$kk]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $kk, 'by' => 'the hourly run', 'why' => 'Microsoft refused to send from the mailbox: ' . $r['why']]); $stopWhy = 'Microsoft refused to send (' . $r['why'] . '): both lists paused'; break; }
        $stopWhy = ($r['kind'] === 'auth' ? 'the Microsoft sign-in needs attention: ' : 'Microsoft trouble, trying next hour: ') . $r['why']; break;
    }
    $said[] = 'sent ' . $sent['sponsors'] . ' sponsors, ' . $sent['expo'] . ' expo' . ($stopWhy !== '' ? ' (stopped: ' . $stopWhy . ')' : '');
    pmRunLine(implode('; ', $said)); flock($lk, LOCK_UN); return 0;
}

/* ---------------------------------------------------------------- stats */
function pmStats(?array $S = null): array {
    $S ??= pmState(); $lj = pmJ('lists.json', ['lists' => [], 'left' => []]); $fresh = is_file(pmData() . '/lists.json') ? pmImport((int) $S['settings']['perOrg']) : null; $o = [];
    foreach (PM_LISTS as $k => $nm) {
        $ps = (array) ($lj['lists'][$k] ?? []); $on = array_filter($ps, fn($p) => $p['hold'] === '');
        $c = ['people' => count($on), 'held' => count($ps) - count($on), 'left' => count((array) ($lj['left'][$k] ?? [])), 'queued' => $fresh ? count(pmQueue($S, $k, $fresh)) : 0,
              'sent' => 0, 'replied' => 0, 'bounced' => 0, 'unsubscribed' => 0, 'clicked' => 0, 'clicks' => 0, 'auto' => 0, 'failed' => 0, 'generic' => 0, 'guessed' => 0];
        foreach ($on as $p) { if (in_array('generic', $p['flags'], true)) $c['generic']++; if (in_array('guessed', $p['flags'], true)) $c['guessed']++; }
        foreach ($S['people'] as $to => $x) {
            if ($x['list'] !== $k && !($x['list'] === '' && in_array($to, array_column($on, 'to'), true))) continue;
            if ($x['sent']) $c['sent']++; if ($x['reply']) $c['replied']++; if ($x['bounce']) $c['bounced']++; if ($x['unsub']) $c['unsubscribed']++;
            if ($x['clicks']) $c['clicked']++; $c['clicks'] += $x['clicks']; if ($x['auto']) $c['auto']++; if ($x['bad'] !== '') $c['failed']++;
        }
        $st = $S['lists'][$k]['status']; if ($st === 'running' && $c['queued'] === 0 && $c['sent'] > 0) $st = 'done';
        $o[$k] = $c + ['status' => $st, 'pausedWhy' => $S['lists'][$k]['pausedWhy']];
    }
    return $o;
}
/** one line for the overnight check */
function pmStatsLine(): string {
    if (!pmReady()) return 'Peak email: not set up';
    $S = pmState(); $c = pmConn(); $st = pmStats($S); $parts = [];
    foreach (PM_LISTS as $k => $nm) { $x = $st[$k]; $parts[] = $k . ' ' . strtoupper($x['status']) . ' ' . $x['sent'] . ' sent/' . $x['queued'] . ' waiting, ' . $x['replied'] . ' replied, ' . $x['bounced'] . ' bounced, ' . $x['unsubscribed'] . ' unsub, ' . $x['clicked'] . ' clicked'; }
    $last = ''; $rl = @file(pmData() . '/run.log', FILE_IGNORE_NEW_LINES); if ($rl) $last = ' | last run ' . mb_substr((string) end($rl), 0, 90);
    return 'Peak email: Microsoft ' . ($c['connected'] ? 'connected (' . $c['email'] . ')' : (($c['status'] ?? '') === 'reconnect' ? 'NEEDS RECONNECT' : 'not connected')) . '; ' . implode('; ', $parts) . $last;
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

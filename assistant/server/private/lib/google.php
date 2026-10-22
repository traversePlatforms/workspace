<?php
/* Google: sign in to each Gmail account once (OAuth, offline access), keep its refresh token, and call the Gmail API with it.
   Scope gmail.modify: read mail and write drafts. It cannot delete mail for good, and this app never sends. Plain HTTP to Google's
   own endpoints; no Google library. */
declare(strict_types=1);

const G_SCOPES = 'https://www.googleapis.com/auth/gmail.modify';

function gClient(): array {
    $c = cfg();
    return ['id' => (string) ($c['googleClientId'] ?? ''), 'secret' => (string) ($c['googleClientSecret'] ?? '')];
}
function gRedirect(): string {
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/api.php?action=oauth';
}
function http(string $method, string $url, ?array $form = null, ?array $json = null, array $headers = []): array {
    $h = curl_init($url);
    $hd = $headers;
    $body = null;
    if ($form !== null) { $body = http_build_query($form); $hd[] = 'Content-Type: application/x-www-form-urlencoded'; }
    if ($json !== null) { $body = json_encode($json, JSON_UNESCAPED_SLASHES); $hd[] = 'Content-Type: application/json'; }
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $hd]);
    if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, $body);
    $raw = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
    $j = is_string($raw) ? (json_decode($raw, true) ?: []) : [];
    $j['_status'] = $code;
    return $j;
}
/** where the person goes to say yes; the state ties the answer back to this signed-in session */
function gAuthUrl(): string {
    aSessionStart();
    $_SESSION['gstate'] = bin2hex(random_bytes(16));
    return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query(['client_id' => gClient()['id'], 'redirect_uri' => gRedirect(), 'response_type' => 'code',
        'scope' => G_SCOPES, 'access_type' => 'offline', 'prompt' => 'consent select_account', 'include_granted_scopes' => 'true', 'state' => $_SESSION['gstate']]);
}
/** Google sends the person back here with a code: trade it for tokens, find out which address it is, keep the refresh token */
function gCallback(string $code, string $state): ?string {
    aSessionStart();
    if ($state === '' || !hash_equals((string) ($_SESSION['gstate'] ?? ''), $state)) return 'That sign-in did not start here. Try Connect again.';
    unset($_SESSION['gstate']);
    $c = gClient();
    $t = http('POST', 'https://oauth2.googleapis.com/token', ['code' => $code, 'client_id' => $c['id'], 'client_secret' => $c['secret'], 'redirect_uri' => gRedirect(), 'grant_type' => 'authorization_code']);
    if (empty($t['access_token'])) return 'Google did not give a token: ' . ($t['error_description'] ?? $t['error'] ?? ('HTTP ' . $t['_status']));
    $p = http('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/profile', null, null, ['Authorization: Bearer ' . $t['access_token']]);
    $email = strtolower((string) ($p['emailAddress'] ?? ''));
    if ($email === '') return 'Could not read which Gmail address that is.';
    jedit('accounts.json', function ($a) use ($email, $t) {
        $old = $a[$email] ?? [];
        $a[$email] = ['email' => $email, 'label' => $old['label'] ?? accountLabel($email), 'about' => $old['about'] ?? accountAbout($email), 'signature' => $old['signature'] ?? 'Matthew',
            'refresh' => (string) ($t['refresh_token'] ?? ($old['refresh'] ?? '')), 'access' => (string) $t['access_token'], 'accessUntil' => time() + (int) ($t['expires_in'] ?? 3000) - 60,
            'connected' => $old['connected'] ?? time(), 'lastCheck' => $old['lastCheck'] ?? 0, 'on' => $old['on'] ?? true];
        return $a;
    });
    alog('account connected', ['email' => $email]);
    return null;
}
function accountLabel(string $email): string {
    if (str_ends_with($email, '@gmail.com')) return 'Personal';
    if (str_contains($email, 'traverseplatforms')) return 'Traverse';
    if (str_contains($email, 'sixfold') || str_contains($email, '365aeration') || str_contains($email, 'aeration365')) return 'Sixfold / 365';
    return explode('@', $email)[1] ?? $email;
}
function accountAbout(string $email): string {
    $l = accountLabel($email);
    if ($l === 'Personal') return "Matthew's personal email: family, friends, personal purchases and accounts.";
    if ($l === 'Traverse') return "Traverse Platforms, Matthew's own software company: a field-sales app for door-to-door crews, sold to trades companies.";
    if ($l === 'Sixfold / 365') return 'Sixfold 365 (365 Aeration & Seeding), a lawn aeration and seeding company in the Denver area. Brandon owns it; Matthew runs its systems; Jen runs the office and talks to customers.';
    return '';
}
/** a fresh access token for one account (refreshed when it is near its end) */
function gToken(string $email): ?string {
    $a = jget('accounts.json')[$email] ?? null;
    if (!$a || empty($a['refresh'])) return null;
    if (!empty($a['access']) && ($a['accessUntil'] ?? 0) > time()) return (string) $a['access'];
    $c = gClient();
    $t = http('POST', 'https://oauth2.googleapis.com/token', ['refresh_token' => $a['refresh'], 'client_id' => $c['id'], 'client_secret' => $c['secret'], 'grant_type' => 'refresh_token']);
    if (empty($t['access_token'])) {
        alog('token refresh failed', ['email' => $email, 'error' => $t['error'] ?? $t['_status']]);
        if (($t['error'] ?? '') === 'invalid_grant') jedit('accounts.json', function ($x) use ($email) { if (isset($x[$email])) $x[$email]['needsReconnect'] = true; return $x; });
        return null;
    }
    jedit('accounts.json', function ($x) use ($email, $t) { if (isset($x[$email])) { $x[$email]['access'] = $t['access_token']; $x[$email]['accessUntil'] = time() + (int) ($t['expires_in'] ?? 3000) - 60; unset($x[$email]['needsReconnect']); } return $x; });
    return (string) $t['access_token'];
}
/** one Gmail API call for one account */
function gmail(string $email, string $method, string $path, ?array $json = null): array {
    $tok = gToken($email);
    if (!$tok) return ['_status' => 401, 'error' => 'not connected'];
    return http($method, 'https://gmail.googleapis.com/gmail/v1/users/me/' . ltrim($path, '/'), null, $json, ['Authorization: Bearer ' . $tok]);
}

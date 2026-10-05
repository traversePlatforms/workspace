<?php
declare(strict_types=1);
/* webpush.php (research prototype, 2026-10-05)
 *
 * Web Push from plain PHP, nothing to install:
 *   - the push request itself                 RFC 8030  (POST to the subscription's endpoint, TTL, Urgency, Topic)
 *   - who we are, so the push service trusts  RFC 8292  (VAPID: an ES256 JWT signed with our P-256 key)
 *   - the payload nobody but the phone reads  RFC 8291  (ECDH with the phone's p256dh key + its auth secret,
 *                                                        HKDF, then RFC 8188 "aes128gcm" content coding)
 *
 * Needs only what every PHP 8 build on shared hosting has: ext/openssl (ECDH is openssl_pkey_derive, PHP 7.3+),
 * ext/hash (hash_hkdf, PHP 7.1.2+) and curl (or allow_url_fopen) for the POST. No Composer, no sodium, no gmp.
 * Checked on PHP 8.4 / OpenSSL 3.0: the encryption reproduces RFC 8291 Appendix A byte for byte (test-webpush.php).
 *
 * The three calls you use:
 *   vapidKeysGenerate(): array                                  once, when the site is set up; keep privateKey PRIVATE
 *   webpushSend(array $subscription, ?string $payload, array $vapid, int $ttl = 3600, array $opts = []): array
 *   webpushSubscriptionError(array $subscription): ?string      when a browser posts its subscription, before storing it
 *
 *   $subscription = the JSON the browser's PushSubscription.toJSON() gives: {endpoint, keys:{p256dh, auth}, expirationTime?}
 *   $payload      = string (usually JSON) up to WEBPUSH_MAX_PLAINTEXT bytes, or null for a payload-less push
 *   $vapid        = ['publicKey' => <base64url, from vapidKeysGenerate>, 'privateKey' => <PEM>, 'subject' => 'mailto:you@example.com']
 *   returns         ['ok' => bool, 'status' => int, 'gone' => bool, 'error' => ?string, 'body' => string, 'retryAfter' => ?int]
 *                   gone = the push service answered 404 or 410: delete that subscription, the phone will make a new one.
 *
 * Every function is prefixed wp/vapid/webpush so the file can be required beside api/rounds.php without a clash. */

const WEBPUSH_RS = 4096;                                   /* RFC 8188 record size we write into the header */
const WEBPUSH_HEADER_LEN = 16 + 4 + 1 + 65;                 /* salt + rs + idlen + our ephemeral public key = 86 */
const WEBPUSH_MAX_BODY = 4096;                              /* RFC 8030 §7.2: a push service need not accept more */
const WEBPUSH_MAX_PLAINTEXT = WEBPUSH_MAX_BODY - WEBPUSH_HEADER_LEN - 1 - 16;   /* 3993: minus delimiter and GCM tag */
const VAPID_JWT_LIFETIME = 12 * 3600;                       /* RFC 8292 §2: exp at most 24 h out; 12 h leaves clock slack */

/* ---- base64url (RFC 4648 §5, no padding) ---- */
function wpB64u(string $bin): string { return rtrim(strtr(base64_encode($bin), '+/', '-_'), '='); }
function wpB64uDecode(string $s): string {
    $s = strtr(trim($s), '-_', '+/');
    if (($m = strlen($s) % 4) !== 0) $s .= str_repeat('=', 4 - $m);
    $r = base64_decode($s, true);
    if ($r === false) throw new InvalidArgumentException('not base64url');
    return $r;
}

/* ---- P-256 keys in and out of OpenSSL ----
 * OpenSSL speaks DER/PEM; browsers and the RFCs speak 65-byte uncompressed points (0x04 || X || Y) and 32-byte scalars.
 * The DER wrappers below are constants for this one curve, so no ASN.1 library is needed. */
function wpPublicKeyFromRaw(string $point): OpenSSLAsymmetricKey {
    if (strlen($point) !== 65 || $point[0] !== "\x04") throw new InvalidArgumentException('P-256 public key must be 65 bytes, uncompressed (0x04 ...)');
    /* SubjectPublicKeyInfo { AlgorithmIdentifier { ecPublicKey, prime256v1 }, BIT STRING point } */
    $der = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00" . $point;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    $k = openssl_pkey_get_public($pem);
    if ($k === false) throw new RuntimeException('OpenSSL rejected the public key: ' . (openssl_error_string() ?: '?'));
    return $k;
}
function wpPrivateKeyFromRaw(string $d, string $point): OpenSSLAsymmetricKey {
    if (strlen($d) !== 32) throw new InvalidArgumentException('P-256 private scalar must be 32 bytes');
    if (strlen($point) !== 65 || $point[0] !== "\x04") throw new InvalidArgumentException('P-256 public key must be 65 bytes, uncompressed');
    /* RFC 5915 ECPrivateKey { version 1, OCTET STRING d, [0] namedCurve prime256v1, [1] BIT STRING point } = 119 bytes */
    $der = "\x30\x77\x02\x01\x01\x04\x20" . $d . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\xa1\x44\x03\x42\x00" . $point;
    $pem = "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
    $k = openssl_pkey_get_private($pem);
    if ($k === false) throw new RuntimeException('OpenSSL rejected the private key: ' . (openssl_error_string() ?: '?'));
    return $k;
}
/** The 65-byte uncompressed point of a P-256 key (public or private). */
function wpRawPublicKey(OpenSSLAsymmetricKey $key): string {
    $ec = openssl_pkey_get_details($key)['ec'] ?? null;
    if (!$ec || ($ec['curve_name'] ?? '') !== 'prime256v1') throw new InvalidArgumentException('not a P-256 (prime256v1) key');
    /* OpenSSL strips leading zero bytes from x and y; put them back */
    return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
}
/** OpenSSL options for key generation and export. On Linux (SiteGround) none are needed. On Windows, PHP's OpenSSL has
 *  no config file to read and openssl_pkey_new fails with "error:80000003:system library::No such process"; an empty
 *  config file in the temp folder is enough (measured 2026-10-05 on PHP 8.4 / OpenSSL 3.0). Tried only after a plain
 *  call fails, so a working server never touches the disk for this. */
function wpOpensslOptions(bool $fallback): array {
    static $cnf = null;
    if (!$fallback) return [];
    if ($cnf === null) { $cnf = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'webpush-empty-openssl.cnf'; if (!is_file($cnf)) @file_put_contents($cnf, ''); }
    return ['config' => $cnf];
}
function wpClearErrors(): void { while (openssl_error_string() !== false); }
function wpNewP256Key(): OpenSSLAsymmetricKey {
    $args = ['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1'];
    $k = @openssl_pkey_new($args);
    if ($k === false) { wpClearErrors(); $k = openssl_pkey_new($args + wpOpensslOptions(true)); }
    if ($k === false) throw new RuntimeException('openssl_pkey_new failed: ' . (openssl_error_string() ?: '?'));
    wpClearErrors();
    return $k;
}

/* ---- VAPID (RFC 8292) ---- */

/** New VAPID key pair. publicKey goes to the browser (applicationServerKey) and into the Authorization header;
 *  privateKey (PEM) is stored in a file outside public_html, mode 0600, and never in git. privateKeyRaw is the same
 *  secret as 32 bytes base64url, for tools that want that shape; store one or the other, not both. */
function vapidKeysGenerate(): array {
    $k = wpNewP256Key();
    if (!@openssl_pkey_export($k, $pem) && !openssl_pkey_export($k, $pem, null, wpOpensslOptions(true))) throw new RuntimeException('openssl_pkey_export failed: ' . (openssl_error_string() ?: '?'));
    wpClearErrors();
    $ec = openssl_pkey_get_details($k)['ec'];
    return ['publicKey' => wpB64u(wpRawPublicKey($k)), 'privateKey' => $pem, 'privateKeyRaw' => wpB64u(str_pad($ec['d'], 32, "\0", STR_PAD_LEFT))];
}
/** Load the private key from either shape: a PEM string, or the 32-byte base64url scalar (needs publicKey beside it). */
function vapidPrivateKey(array $vapid): OpenSSLAsymmetricKey {
    $p = (string) ($vapid['privateKey'] ?? '');
    if (str_contains($p, '-----BEGIN')) {
        $k = openssl_pkey_get_private($p);
        if ($k === false) throw new RuntimeException('VAPID private key PEM did not load: ' . (openssl_error_string() ?: '?'));
        return $k;
    }
    return wpPrivateKeyFromRaw(wpB64uDecode($p), wpB64uDecode((string) ($vapid['publicKey'] ?? '')));
}
/** ECDSA signature DER (SEQUENCE { INTEGER r, INTEGER s }) -> raw r||s, each left-padded to 32 bytes (JWS ES256 form). */
function wpEcdsaDerToRaw(string $der, int $n = 32): string {
    $p = 0;
    if (ord($der[$p++]) !== 0x30) throw new RuntimeException('bad ECDSA signature: no SEQUENCE');
    $len = ord($der[$p++]);
    if ($len & 0x80) $p += $len & 0x7f;                       /* long form length: cannot happen for P-256 but skip it anyway */
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        if (ord($der[$p++]) !== 0x02) throw new RuntimeException('bad ECDSA signature: no INTEGER');
        $l = ord($der[$p++]);
        $int = ltrim(substr($der, $p, $l), "\0"); $p += $l;
        if (strlen($int) > $n) throw new RuntimeException('bad ECDSA signature: integer too long');
        $out .= str_pad($int, $n, "\0", STR_PAD_LEFT);
    }
    return $out;
}
/** The reverse, for verifying with openssl_verify (used by the test). */
function wpEcdsaRawToDer(string $raw): string {
    $n = intdiv(strlen($raw), 2);
    $int = function (string $v): string {
        $v = ltrim($v, "\0"); if ($v === '') $v = "\0";
        if (ord($v[0]) & 0x80) $v = "\0" . $v;                   /* keep it positive */
        return "\x02" . chr(strlen($v)) . $v;
    };
    $body = $int(substr($raw, 0, $n)) . $int(substr($raw, $n));
    return "\x30" . chr(strlen($body)) . $body;
}
/** Origin of a push endpoint, the JWT audience: scheme://host[:port]. */
function vapidAudience(string $endpoint): string {
    $u = parse_url($endpoint);
    if (!$u || empty($u['scheme']) || empty($u['host'])) throw new InvalidArgumentException('endpoint is not a URL');
    return strtolower($u['scheme']) . '://' . strtolower($u['host']) . (isset($u['port']) ? ':' . $u['port'] : '');
}
/** A signed VAPID JWT for one push service. Cached in the process until 10 minutes before it expires, so a cron run
 *  sending to 40 phones on the same service signs once. */
function vapidJwt(string $audience, array $vapid, int $lifetime = VAPID_JWT_LIFETIME): string {
    static $cache = [];
    $ck = md5($audience . '|' . ($vapid['publicKey'] ?? '') . '|' . ($vapid['subject'] ?? ''));
    if (isset($cache[$ck]) && $cache[$ck][1] > time() + 600) return $cache[$ck][0];
    $priv = vapidPrivateKey($vapid);
    $exp = time() + min($lifetime, 24 * 3600 - 60);
    $claims = ['aud' => $audience, 'exp' => $exp];
    if (!empty($vapid['subject'])) $claims['sub'] = (string) $vapid['subject'];   /* mailto: or https:, RFC 8292 §2.1 */
    $data = wpB64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . wpB64u(json_encode($claims, JSON_UNESCAPED_SLASHES));
    if (!openssl_sign($data, $der, $priv, OPENSSL_ALGO_SHA256)) throw new RuntimeException('openssl_sign failed: ' . (openssl_error_string() ?: '?'));
    $jwt = $data . '.' . wpB64u(wpEcdsaDerToRaw($der));
    $cache[$ck] = [$jwt, $exp];
    return $jwt;
}
/** The Authorization header value, RFC 8292 §3: vapid t=<jwt>, k=<our public key>. */
function vapidAuthorization(string $endpoint, array $vapid): string {
    if (empty($vapid['publicKey'])) throw new InvalidArgumentException('vapid.publicKey missing');
    return 'vapid t=' . vapidJwt(vapidAudience($endpoint), $vapid) . ', k=' . $vapid['publicKey'];
}

/* ---- payload encryption (RFC 8291 + RFC 8188 aes128gcm) ---- */

/** Encrypt $plaintext for one subscription. $p256dh and $auth are the base64url strings the browser gave.
 *  $salt (16 bytes) and $asKey (our ephemeral key) are injectable only so the test can replay RFC 8291 Appendix A;
 *  leave them null and fresh random ones are used, one pair per message, as the RFC requires.
 *  $pad = extra zero bytes after the delimiter, hides the exact length. Returns the whole body: header || ciphertext. */
function webpushEncrypt(string $plaintext, string $p256dh, string $auth, ?string $salt = null, ?OpenSSLAsymmetricKey $asKey = null, int $pad = 0): string {
    $uaPublic = wpB64uDecode($p256dh);
    $authSecret = wpB64uDecode($auth);
    if (strlen($authSecret) !== 16) throw new InvalidArgumentException('auth secret must be 16 bytes');
    if (strlen($plaintext) + $pad > WEBPUSH_MAX_PLAINTEXT) throw new LengthException('payload too long: at most ' . WEBPUSH_MAX_PLAINTEXT . ' bytes including padding');
    $uaKey = wpPublicKeyFromRaw($uaPublic);
    $asKey ??= wpNewP256Key();
    $asPublic = wpRawPublicKey($asKey);
    $salt ??= random_bytes(16);
    if (strlen($salt) !== 16) throw new InvalidArgumentException('salt must be 16 bytes');

    /* RFC 8291 §3.3-3.4 */
    $ecdh = openssl_pkey_derive($uaKey, $asKey, 32);
    if ($ecdh === false || strlen($ecdh) !== 32) throw new RuntimeException('ECDH failed: ' . (openssl_error_string() ?: '?'));
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $authSecret);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);

    /* RFC 8188 §2: one record, delimiter 0x02 (last record), optional zero padding, AES-128-GCM with the tag appended */
    $record = $plaintext . "\x02" . str_repeat("\0", $pad);
    $ct = openssl_encrypt($record, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($ct === false) throw new RuntimeException('AES-GCM failed: ' . (openssl_error_string() ?: '?'));
    $header = $salt . pack('N', WEBPUSH_RS) . chr(65) . $asPublic;
    return $header . $ct . $tag;
}

/** The receiving side, exactly what the browser does. Not needed on the server; here so the test can prove the
 *  round trip and so a reader can see both halves. $uaKey is the subscription's private key. */
function webpushDecrypt(string $body, OpenSSLAsymmetricKey $uaKey, string $authSecret): string {
    if (strlen($body) < WEBPUSH_HEADER_LEN + 17) throw new InvalidArgumentException('body too short');
    $salt = substr($body, 0, 16);
    $rs = unpack('N', substr($body, 16, 4))[1];
    $idlen = ord($body[20]);
    if ($idlen !== 65) throw new InvalidArgumentException('keyid is not a P-256 point');
    $asPublic = substr($body, 21, 65);
    $rest = substr($body, 21 + 65);
    if (strlen($rest) > $rs) throw new InvalidArgumentException('more than one record; this decoder handles the single-record push case');
    $uaPublic = wpRawPublicKey($uaKey);
    $ecdh = openssl_pkey_derive(wpPublicKeyFromRaw($asPublic), $uaKey, 32);
    if ($ecdh === false) throw new RuntimeException('ECDH failed');
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $authSecret);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $ct = substr($rest, 0, -16); $tag = substr($rest, -16);
    $record = openssl_decrypt($ct, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($record === false) throw new RuntimeException('authentication failed (wrong key, auth secret or tampered body)');
    $i = strlen(rtrim($record, "\0")) - 1;                   /* strip zero padding, then the delimiter must be 0x02 (or 0x01) */
    if ($i < 0 || !in_array($record[$i], ["\x02", "\x01"], true)) throw new RuntimeException('bad padding delimiter');
    return substr($record, 0, $i);
}

/* ---- the push itself (RFC 8030) ---- */

/** Why a subscription posted by a browser cannot be used, or null when it is fine to store. */
function webpushSubscriptionError(array $s): ?string {
    $e = (string) ($s['endpoint'] ?? '');
    if ($e === '' || strlen($e) > 2048 || !preg_match('~^https://[^\s/]+/.+~', $e)) return 'endpoint is not an https URL';
    try {
        $p = wpB64uDecode((string) ($s['keys']['p256dh'] ?? ''));
        if (strlen($p) !== 65 || $p[0] !== "\x04") return 'keys.p256dh is not a 65-byte P-256 point';
        wpPublicKeyFromRaw($p);                                    /* on the curve, says OpenSSL */
        if (strlen(wpB64uDecode((string) ($s['keys']['auth'] ?? ''))) !== 16) return 'keys.auth is not 16 bytes';
    } catch (Throwable $t) { return 'keys are not valid base64url: ' . $t->getMessage(); }
    return null;
}

/** Send one push. See the header comment for the shapes. $opts: urgency (very-low|low|normal|high), topic (<= 32
 *  URL-safe chars: a newer push with the same topic replaces an unread older one), pad (bool, default true: pad the
 *  payload to a 32-byte multiple), timeout (seconds, default 20). */
function webpushSend(array $subscription, ?string $payload, array $vapid, int $ttl = 3600, array $opts = []): array {
    $r = ['ok' => false, 'status' => 0, 'gone' => false, 'error' => null, 'body' => '', 'retryAfter' => null];
    $endpoint = (string) ($subscription['endpoint'] ?? '');
    /* allowHttp is for test-webpush.php only (a plain listener on 127.0.0.1); real push services are all https */
    $check = $subscription;
    if (!empty($opts['allowHttp']) && str_starts_with($endpoint, 'http://127.0.0.1')) $check['endpoint'] = 'https://' . substr($endpoint, 7);
    if (($why = webpushSubscriptionError($check)) !== null) { $r['error'] = 'bad subscription: ' . $why; return $r; }
    $headers = ['TTL: ' . max(0, $ttl), 'Authorization: ' . vapidAuthorization($endpoint, $vapid)];
    if (!empty($opts['urgency'])) {
        if (!in_array($opts['urgency'], ['very-low', 'low', 'normal', 'high'], true)) { $r['error'] = 'bad urgency'; return $r; }
        $headers[] = 'Urgency: ' . $opts['urgency'];
    }
    if (!empty($opts['topic'])) {
        if (!preg_match('/^[A-Za-z0-9_-]{1,32}$/', (string) $opts['topic'])) { $r['error'] = 'bad topic'; return $r; }
        $headers[] = 'Topic: ' . $opts['topic'];
    }
    $body = '';
    if ($payload !== null && $payload !== '') {
        $pad = 0;
        if ($opts['pad'] ?? true) { $pad = (32 - (strlen($payload) + 1) % 32) % 32; if (strlen($payload) + $pad > WEBPUSH_MAX_PLAINTEXT) $pad = 0; }
        try { $body = webpushEncrypt($payload, (string) $subscription['keys']['p256dh'], (string) $subscription['keys']['auth'], null, null, $pad); }
        catch (Throwable $t) { $r['error'] = 'encrypt: ' . $t->getMessage(); return $r; }
        $headers[] = 'Content-Type: application/octet-stream';
        $headers[] = 'Content-Encoding: aes128gcm';
    }
    $headers[] = 'Content-Length: ' . strlen($body);
    $timeout = (int) ($opts['timeout'] ?? 20);

    $respHeaders = [];
    if (function_exists('curl_init')) {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => $timeout, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$respHeaders) { if (($i = strpos($line, ':')) !== false) $respHeaders[strtolower(trim(substr($line, 0, $i)))] = trim(substr($line, $i + 1)); return strlen($line); }]);
        $out = curl_exec($ch);
        if ($out === false) { $r['error'] = 'curl: ' . curl_error($ch); curl_close($ch); return $r; }
        $r['status'] = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $r['body'] = (string) $out;
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => $timeout, 'ignore_errors' => true, 'follow_location' => 0]]);
        $out = @file_get_contents($endpoint, false, $ctx);
        if ($out === false) { $r['error'] = 'http: ' . (error_get_last()['message'] ?? 'request failed'); return $r; }
        $r['body'] = $out;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('~^HTTP/\S+\s+(\d{3})~', $line, $m)) $r['status'] = (int) $m[1];
            elseif (($i = strpos($line, ':')) !== false) $respHeaders[strtolower(trim(substr($line, 0, $i)))] = trim(substr($line, $i + 1));
        }
    }
    if (isset($respHeaders['retry-after']) && ctype_digit($respHeaders['retry-after'])) $r['retryAfter'] = (int) $respHeaders['retry-after'];
    $s = $r['status'];
    if ($s === 201 || $s === 200 || $s === 202) { $r['ok'] = true; return $r; }
    if ($s === 404 || $s === 410) { $r['gone'] = true; $r['error'] = 'subscription gone (' . $s . '): delete it'; return $r; }
    $r['error'] = match (true) {
        $s === 400 => 'bad request (400): ' . trim($r['body']),
        $s === 401, $s === 403 => 'VAPID rejected (' . $s . '): check the key pair, the subject and the server clock: ' . trim($r['body']),
        $s === 413 => 'payload too large (413)',
        $s === 429 => 'rate limited (429)' . ($r['retryAfter'] !== null ? ', retry after ' . $r['retryAfter'] . ' s' : ''),
        $s >= 500 => 'push service error (' . $s . '), try later',
        default => 'unexpected status ' . $s . ': ' . trim($r['body']),
    };
    return $r;
}

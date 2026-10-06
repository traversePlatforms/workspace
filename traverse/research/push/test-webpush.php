<?php
declare(strict_types=1);
/* test-webpush.php: proves the crypto in webpush.php without a browser or a network.
 *
 *   php test-webpush.php [exchange-dir]
 *
 * Every key is made at run time; nothing secret is written anywhere except, when exchange-dir is given, a throwaway
 * test key pair (not a VAPID key anyone uses) in <exchange-dir>/webpush-exchange.json for verify-with-node.mjs,
 * which checks the same JWT and body with Node's crypto / WebCrypto, i.e. the way a browser would.
 *
 *   1. VAPID keys: shapes and sizes; PEM and raw forms load to the same key.
 *   2. JWT: ES256 signature verified by OpenSSL (raw r||s converted back to DER); a changed claim fails.
 *   3. RFC 8291 Appendix A: with the RFC's receiver key, sender key, auth secret and salt, our encryption equals the
 *      RFC's 145-byte body exactly, and our decrypt of the RFC's body gives the RFC's plaintext.
 *   4. Random round trips with fresh keys and padding; wrong auth secret, wrong key and a flipped byte all fail.
 *   5. webpushSubscriptionError accepts a good subscription and names what is wrong with bad ones.
 *   6. webpushSend builds a request and reports 'gone' on 410 (against a tiny local listener). */
require __DIR__ . '/webpush.php';

$fails = 0; $n = 0;
function check(string $what, bool $ok, string $detail = ''): void {
    global $fails, $n; $n++;
    if (!$ok) $fails++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $what . ($detail !== '' ? '  (' . $detail . ')' : '') . "\n";
}
function expectThrow(string $what, callable $fn): void {
    try { $fn(); check($what, false, 'did not throw'); } catch (Throwable $t) { check($what, true, get_class($t) . ': ' . $t->getMessage()); }
}

echo "1. VAPID keys\n";
$vk = vapidKeysGenerate();
$pub = wpB64uDecode($vk['publicKey']);
check('public key is a 65-byte uncompressed P-256 point', strlen($pub) === 65 && $pub[0] === "\x04", $vk['publicKey']);
check('private key is a PEM', str_starts_with($vk['privateKey'], '-----BEGIN') && str_contains($vk['privateKey'], 'PRIVATE KEY-----'));
check('privateKeyRaw is 32 bytes', strlen(wpB64uDecode($vk['privateKeyRaw'])) === 32);
$fromPem = vapidPrivateKey(['privateKey' => $vk['privateKey']]);
$fromRaw = vapidPrivateKey(['privateKey' => $vk['privateKeyRaw'], 'publicKey' => $vk['publicKey']]);
check('PEM and raw forms give the same public point', wpRawPublicKey($fromPem) === $pub && wpRawPublicKey($fromRaw) === $pub);
$vapid = ['publicKey' => $vk['publicKey'], 'privateKey' => $vk['privateKey'], 'subject' => 'mailto:test@example.invalid'];

echo "2. VAPID JWT (ES256)\n";
$endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';
check('audience is the endpoint origin', vapidAudience($endpoint) === 'https://fcm.googleapis.com');
$jwt = vapidJwt('https://fcm.googleapis.com', $vapid);
[$h, $c, $s] = explode('.', $jwt);
$hdr = json_decode(wpB64uDecode($h), true); $claims = json_decode(wpB64uDecode($c), true);
check('header is {typ:JWT, alg:ES256}', ($hdr['typ'] ?? '') === 'JWT' && ($hdr['alg'] ?? '') === 'ES256');
check('claims: aud, exp within 24 h, sub', ($claims['aud'] ?? '') === 'https://fcm.googleapis.com' && $claims['exp'] > time() && $claims['exp'] <= time() + 86400 && ($claims['sub'] ?? '') === 'mailto:test@example.invalid');
$sig = wpB64uDecode($s);
check('signature is raw r||s, 64 bytes', strlen($sig) === 64);
$pubKey = wpPublicKeyFromRaw($pub);
check('OpenSSL verifies the signature with the public key', openssl_verify("$h.$c", wpEcdsaRawToDer($sig), $pubKey, OPENSSL_ALGO_SHA256) === 1);
$c2 = wpB64u(json_encode(['aud' => 'https://evil.example', 'exp' => $claims['exp']]));
check('a changed claim does not verify', openssl_verify("$h.$c2", wpEcdsaRawToDer($sig), $pubKey, OPENSSL_ALGO_SHA256) !== 1);
$other = vapidKeysGenerate();
check('another key does not verify it', openssl_verify("$h.$c", wpEcdsaRawToDer($sig), wpPublicKeyFromRaw(wpB64uDecode($other['publicKey'])), OPENSSL_ALGO_SHA256) !== 1);
check('DER<->raw conversion round-trips', wpEcdsaDerToRaw(wpEcdsaRawToDer($sig)) === $sig);
check('Authorization header has the RFC 8292 shape', preg_match('/^vapid t=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+, k=[A-Za-z0-9_-]{87}$/', vapidAuthorization($endpoint, $vapid)) === 1);
check('JWT is cached for the same audience', vapidJwt('https://fcm.googleapis.com', $vapid) === $jwt);

echo "3. RFC 8291 Appendix A test vector\n";
$rfc = [
    'plaintext'  => 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
    'as_public'  => 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    'as_private' => 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    'ua_public'  => 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'ua_private' => 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
    'salt'       => 'DGv6ra1nlYgDCS1FRnbzlw',
    'auth'       => 'BTBZMqHH6r4Tts7J_aSIgg',
    'body'       => 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
];
$asKey = wpPrivateKeyFromRaw(wpB64uDecode($rfc['as_private']), wpB64uDecode($rfc['as_public']));
check('sender key loads from the raw scalar + point', wpB64u(wpRawPublicKey($asKey)) === $rfc['as_public']);
$plain = wpB64uDecode($rfc['plaintext']);
check('plaintext is the watermelon sentence', $plain === 'When I grow up, I want to be a watermelon');
$body = webpushEncrypt($plain, $rfc['ua_public'], $rfc['auth'], wpB64uDecode($rfc['salt']), $asKey, 0);
/* the RFC's example request says "Content-Length: 145", but its own body decodes to 144 bytes: 86 header + 41 plaintext
   ("When I grow up, I want to be a watermelon" is 41 characters) + 1 delimiter + 16 tag. The byte-for-byte match below
   is the check that matters. */
check('encrypted body is 144 bytes (86 + 41 + 1 + 16)', strlen($body) === 144, (string) strlen($body));
check('encrypted body EQUALS the RFC body, byte for byte', wpB64u($body) === $rfc['body']);
$uaKey = wpPrivateKeyFromRaw(wpB64uDecode($rfc['ua_private']), wpB64uDecode($rfc['ua_public']));
check('decrypting the RFC body with the receiver key gives the RFC plaintext', webpushDecrypt(wpB64uDecode($rfc['body']), $uaKey, wpB64uDecode($rfc['auth'])) === $plain);
/* the intermediate values too, so a future failure says WHERE */
$ecdh = openssl_pkey_derive(wpPublicKeyFromRaw(wpB64uDecode($rfc['ua_public'])), $asKey, 32);
check('ecdh_secret matches Appendix A', wpB64u($ecdh) === 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs');
$ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . wpB64uDecode($rfc['ua_public']) . wpB64uDecode($rfc['as_public']), wpB64uDecode($rfc['auth']));
check('IKM matches Appendix A', wpB64u($ikm) === 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg');
check('CEK matches Appendix A', wpB64u(hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", wpB64uDecode($rfc['salt']))) === 'oIhVW04MRdy2XN9CiKLxTg');
check('NONCE matches Appendix A', wpB64u(hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", wpB64uDecode($rfc['salt']))) === '4h_95klXJ5E_qnoN');

echo "4. Round trips with fresh keys\n";
$ua = wpNewP256Key(); $uaPub = wpB64u(wpRawPublicKey($ua)); $auth = random_bytes(16); $authB = wpB64u($auth);
foreach (['{"title":"Severe Thunderstorm Warning","body":"Monument, until 4:45 PM","url":"./#alerts"}', '', str_repeat('x', WEBPUSH_MAX_PLAINTEXT), "bytes\0\xff\x01\x02 unicode ✓"] as $i => $pt) {
    $pad = $i === 0 ? 17 : 0;
    $b = webpushEncrypt($pt, $uaPub, $authB, null, null, $pad);
    check('round trip #' . $i . ' (' . strlen($pt) . ' bytes, pad ' . $pad . ')', webpushDecrypt($b, $ua, $auth) === $pt);
}
$b1 = webpushEncrypt('same', $uaPub, $authB); $b2 = webpushEncrypt('same', $uaPub, $authB);
check('two encryptions of one message differ (fresh salt and key each time)', $b1 !== $b2);
expectThrow('wrong auth secret fails', fn() => webpushDecrypt($b1, $ua, random_bytes(16)));
expectThrow('wrong receiver key fails', fn() => webpushDecrypt($b1, wpNewP256Key(), $auth));
$flip = $b1; $flip[100] = chr(ord($flip[100]) ^ 1);
expectThrow('a flipped ciphertext byte fails', fn() => webpushDecrypt($flip, $ua, $auth));
expectThrow('payload over the limit is refused', fn() => webpushEncrypt(str_repeat('x', WEBPUSH_MAX_PLAINTEXT + 1), $uaPub, $authB));
expectThrow('a point off the curve is refused', fn() => wpPublicKeyFromRaw("\x04" . str_repeat("\x01", 64)));

echo "5. Subscription checks\n";
$good = ['endpoint' => 'https://web.push.apple.com/QAbc', 'keys' => ['p256dh' => $uaPub, 'auth' => $authB]];
check('a good subscription passes', webpushSubscriptionError($good) === null);
check('http endpoint refused', str_contains((string) webpushSubscriptionError(['endpoint' => 'http://x.example/y', 'keys' => $good['keys']]), 'https'));
check('short p256dh refused', str_contains((string) webpushSubscriptionError(['endpoint' => $good['endpoint'], 'keys' => ['p256dh' => 'AAAA', 'auth' => $authB]]), 'p256dh'));
check('short auth refused', str_contains((string) webpushSubscriptionError(['endpoint' => $good['endpoint'], 'keys' => ['p256dh' => $uaPub, 'auth' => 'AAAA']]), 'auth'));
check('missing keys refused', webpushSubscriptionError(['endpoint' => $good['endpoint']]) !== null);

echo "6. webpushSend against a local listener\n";
/* a one-shot HTTP listener on a spare port, in this process: answers 410 Gone, so we can see the request and the 'gone' flag */
$srv = @stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
if (!$srv) check('local listener', false, "$errstr");
else {
    $port = (int) explode(':', stream_socket_get_name($srv, false))[1];
    $sub = ['endpoint' => "http://127.0.0.1:$port/push/one", 'keys' => $good['keys']];
    /* The real webpushSend, in a child process (so curl and this listener run at once), with the test-only allowHttp
       option: a TLS listener would prove nothing more about the request. The VAPID key in the child is this run's
       throwaway key, passed on the command line of a temp file that is deleted below. */
    $php = PHP_BINARY; $lib = __DIR__ . '/webpush.php';
    $code = '<?php require ' . var_export($lib, true) . '; echo json_encode(webpushSend(' . var_export($sub, true) . ', "hello", ' . var_export($vapid, true) . ', 60, ["allowHttp" => true, "urgency" => "high", "topic" => "nws-test", "pad" => false]));';
    $tmp = tempnam(sys_get_temp_dir(), 'wp'); file_put_contents($tmp, $code);
    $proc = proc_open([$php, $tmp], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    stream_set_blocking($srv, true); stream_set_timeout($srv, 10);
    $conn = @stream_socket_accept($srv, 10);
    $req = '';
    if ($conn) {
        stream_set_timeout($conn, 5);
        while (($line = fgets($conn)) !== false) { $req .= $line; if ($line === "\r\n") break; }
        if (preg_match('/Content-Length: (\d+)/i', $req, $m)) { $need = (int) $m[1]; $got = ''; while (strlen($got) < $need && ($chunk = fread($conn, $need - strlen($got))) !== false && $chunk !== '') $got .= $chunk; $req .= $got; }
        fwrite($conn, "HTTP/1.1 410 Gone\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); fclose($conn);
    }
    fclose($srv);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]); proc_close($proc); @unlink($tmp);
    $res = json_decode($out, true) ?: [];
    check('request carried TTL, vapid Authorization, aes128gcm, Urgency, Topic', preg_match('/^TTL: 60\r?$/m', $req) && preg_match('/^Authorization: vapid t=\S+, k=\S+\r?$/m', $req) && preg_match('/^Content-Encoding: aes128gcm\r?$/m', $req) && preg_match('/^Urgency: high\r?$/m', $req) && preg_match('/^Topic: nws-test\r?$/m', $req) === 1, $err !== '' ? trim($err) : '');
    check('body is header(86) + ciphertext', preg_match('/Content-Length: (\d+)/i', $req, $m) && (int) $m[1] === 86 + strlen('hello') + 1 + 16);
    check('the JWT in that header verifies', preg_match('/vapid t=([^,]+),/', $req, $m) && (function () use ($m, $pubKey) { [$h, $c, $s] = explode('.', $m[1]); return openssl_verify("$h.$c", wpEcdsaRawToDer(wpB64uDecode($s)), $pubKey, OPENSSL_ALGO_SHA256) === 1; })());
    check('webpushSend reports 410 as gone', ($res['status'] ?? 0) === 410 && ($res['gone'] ?? false) === true && ($res['ok'] ?? true) === false, json_encode($res));
}

/* exchange file for the Node cross-check: a throwaway receiver key (made above), its auth secret, one encrypted body,
   plus the VAPID public key and JWT from step 2. The VAPID private key is NOT written. */
$dir = $argv[1] ?? '';
if ($dir !== '' && is_dir($dir)) {
    $ec = openssl_pkey_get_details($ua)['ec'];
    $payload = json_encode(['title' => 'Test push', 'body' => 'from PHP ' . date('c'), 'url' => './']);
    $x = ['uaPrivateJwk' => ['kty' => 'EC', 'crv' => 'P-256', 'x' => wpB64u(str_pad($ec['x'], 32, "\0", STR_PAD_LEFT)), 'y' => wpB64u(str_pad($ec['y'], 32, "\0", STR_PAD_LEFT)), 'd' => wpB64u(str_pad($ec['d'], 32, "\0", STR_PAD_LEFT))],
          'p256dh' => $uaPub, 'auth' => $authB, 'plaintext' => $payload, 'body' => wpB64u(webpushEncrypt($payload, $uaPub, $authB, null, null, 5)),
          'vapidPublicKey' => $vk['publicKey'], 'jwt' => $jwt, 'aud' => 'https://fcm.googleapis.com'];
    file_put_contents(rtrim($dir, '/\\') . '/webpush-exchange.json', json_encode($x, JSON_PRETTY_PRINT));
    echo "  wrote $dir/webpush-exchange.json for verify-with-node.mjs\n";
}

echo "\n$n checks, $fails failed\n";
exit($fails ? 1 : 0);

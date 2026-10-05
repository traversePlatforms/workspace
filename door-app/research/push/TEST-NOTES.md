# Test notes, 2026-10-05

Machine: Windows 11, PHP 8.4.24 (OpenSSL 3.0.21), Node 24.19.0, Chrome 154.0.8037.97. No key in this folder: every
test makes its keys at run time; the end-to-end test keeps a throwaway pair in `%TEMP%\webpush-e2e\` (delete it when
done, it is not a key anyone uses).

## 1. `php test-webpush.php [dir]`: 42 checks, 0 failed

```
php "test-webpush.php" "%TEMP%\wp-ex"
```

What it proved:
- **VAPID keys**: 65-byte uncompressed P-256 public point, PEM private key, 32-byte raw scalar; the PEM and the raw form load to the same key.
- **JWT**: `{typ:JWT, alg:ES256}`, claims `aud` (endpoint origin), `exp` within 24 h, `sub`; signature is 64-byte `r||s`; **OpenSSL verifies it** after conversion back to DER; a changed claim and a different key both fail; DER/raw conversion round-trips; `Authorization: vapid t=…, k=…` has the RFC 8292 shape; the JWT is cached per audience.
- **RFC 8291 Appendix A**: with the RFC's receiver key, sender key, auth secret and salt, our body **equals the RFC's example body byte for byte** (144 bytes), decrypting the RFC's body gives "When I grow up, I want to be a watermelon", and `ecdh_secret`, `IKM`, `CEK` and `NONCE` each equal the values printed in the RFC. (The RFC's example request says `Content-Length: 145`; its own body decodes to 144 = 86 + 41 + 1 + 16. The byte match is the check that counts.)
- **Round trips with fresh keys**: 90 bytes with padding, 0 bytes, the 3,993-byte maximum, binary and unicode; two encryptions of one text differ; wrong auth secret, wrong key, one flipped byte, oversize payload and an off-curve point are all refused.
- **Subscription checks**: a good one passes; http endpoint, short `p256dh`, short `auth`, missing keys are each named.
- **`webpushSend` against a local listener answering 410**: the request carried `TTL`, `Authorization: vapid …`, `Content-Encoding: aes128gcm`, `Urgency: high`, `Topic`; the body was 86 + plaintext + 1 + 16 bytes; the JWT in the header verifies; the result was `{ok:false, status:410, gone:true}`.

## 2. `node verify-with-node.mjs <dir>/webpush-exchange.json`: all passed

A second implementation checking the first. Node's `crypto.verify` (not OpenSSL through PHP) accepts the PHP-signed
JWT and rejects a tampered one; Node's **WebCrypto** (ECDH P-256, HKDF-SHA-256, AES-128-GCM, the same primitives a
browser uses) decrypts the PHP-encrypted body to the same plaintext, with the `0x02` delimiter and the padding where
RFC 8188 puts them.

## 3. `node e2e-run.mjs`: END-TO-END PASSED, through Google's push service

```
19:58:51  starting Chrome headless (new headless), fresh profile
19:58:51  granted "notifications" to http://127.0.0.1:8790 over DevTools (what tapping Allow would do)
19:59:21  SUBSCRIBED: https://fcm.googleapis.com/fcm/send/fsysLlck8D4:...
19:59:26  attempt 1: push service answered 201 (accepted)
19:59:26  RECEIVED in the service worker: hadPayload=true shown="Severe Thunderstorm Warning / Monument until 4:45 PM, hail to 1.5 in (TEST 13:59:26)"
19:59:26  payload decrypted by Chrome is byte-identical to what PHP encrypted
19:59:26  now a push with no payload
19:59:26  push service answered 201 (accepted)
19:59:27  RECEIVED bare push: hadPayload=false shown="Weather alert / Open the app for the latest warning."
```

So headless Chrome **is** feasible for this, with two things learned:
- **`subscribe()` took about 30 seconds** on a fresh profile (Chrome registering with Google's messaging service), and the **first run failed with 410 "push subscription has unsubscribed or expired"** when PHP sent one second after the subscription reached the server. Five seconds later it was accepted. The driver now waits 5 s, asks Chrome over DevTools whether it still holds the subscription, and retries. On a real phone this is invisible (nobody sends within a second of subscribing), but the cron script should treat a 410 on a subscription **younger than a minute** as "not yet", not "gone".
- Push arrived in **under one second** from the 201. The payload-less push worked the same way, with the worker's fallback text (in the app the worker would fetch `pushlatest` instead).

What headless cannot show: the notification itself on a screen, a tap on it (`notificationclick`), and anything about
iOS. Those are the phone checks in INTEGRATION-PLAN.md §5.

## 4. Traps met

- **Windows PHP has no `openssl.cnf`**: `openssl_pkey_new()` fails with `error:80000003:system library::No such process`. An empty config file passed as `config` fixes it; the library does this automatically after a failed plain call. Linux hosting never sees it.
- A stale OpenSSL error stays in the queue and makes the NEXT unrelated failure report the wrong reason; the library clears the queue after its fallbacks.
- The exchange file for the Node check is only written if every PHP step before it completes, so a PHP failure shows up in Node as a missing file: read the PHP output first.

## 5. Running it again

```
set PHP=C:\Users\Surge Inc\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe
"%PHP%" test-webpush.php %TEMP%\wp-ex   && node verify-with-node.mjs %TEMP%\wp-ex\webpush-exchange.json
node e2e-run.mjs            (needs the internet; starts and stops its own php -S and Chrome; ~1 minute)
```

A person can also run the end-to-end page by hand: `php -S 127.0.0.1:8790 -t e2e`, open http://127.0.0.1:8790/ in
Chrome, tap the three buttons. On a phone it would need https, which `php -S` does not do.

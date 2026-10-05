/* verify-with-node.mjs: checks what test-webpush.php produced with a SECOND implementation, Node's crypto and WebCrypto,
   which is what a browser runs. If PHP's encryption only matched PHP's own decryption, a shared mistake would hide;
   this file decrypts the body with the receiver's JWK the way a service worker's push subscription does internally
   (ECDH P-256, HKDF-SHA-256, AES-128-GCM) and verifies the VAPID JWT with an independent ES256 verifier.

     php test-webpush.php <dir>   &&   node verify-with-node.mjs <dir>/webpush-exchange.json
*/
import { readFileSync } from 'node:fs';
import { createPublicKey, verify as nodeVerify, webcrypto } from 'node:crypto';
const { subtle } = webcrypto;

const x = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const b64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
let fails = 0;
const check = (what, ok, detail = '') => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? `  (${detail})` : '')); };

/* 1. the VAPID JWT, verified by Node (not OpenSSL-via-PHP) with the raw public point */
{
  const [h, c, s] = x.jwt.split('.');
  const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(x.vapidPublicKey).subarray(1, 33).toString('base64url'), y: b64u(x.vapidPublicKey).subarray(33, 65).toString('base64url') }, format: 'jwk' });
  const ok = nodeVerify('sha256', Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: 'ieee-p1363' }, b64u(s));
  check('Node verifies the PHP-signed ES256 JWT (raw r||s)', ok);
  const claims = JSON.parse(b64u(c).toString());
  check('aud matches', claims.aud === x.aud, claims.aud);
  const bad = nodeVerify('sha256', Buffer.from(`${h}.${c}x`), { key: pub, dsaEncoding: 'ieee-p1363' }, b64u(s));
  check('a tampered JWT fails in Node', !bad);
}

/* 2. the encrypted body, decrypted with WebCrypto as a browser would (RFC 8291 + RFC 8188) */
{
  const body = b64u(x.body);
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20];
  check('header: rs 4096, keyid 65 bytes', rs === 4096 && idlen === 65, `rs=${rs} idlen=${idlen}`);
  const asPublic = body.subarray(21, 86), ct = body.subarray(86);
  const uaPublic = b64u(x.p256dh), authSecret = b64u(x.auth);
  const uaPriv = await subtle.importKey('jwk', x.uaPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asPub = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = await subtle.deriveBits({ name: 'ECDH', public: asPub }, uaPriv, 256);
  const hkdf = async (ikm, salt, info, len) => {
    const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return Buffer.from(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
  };
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = await hkdf(ecdh, authSecret, keyInfo, 32);
  const cek = await hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  let record;
  try { record = Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, ct)); }
  catch (e) { check('AES-GCM decrypt in WebCrypto', false, String(e)); }
  if (record) {
    let i = record.length - 1; while (i >= 0 && record[i] === 0) i--;
    check('padding delimiter is 0x02', record[i] === 2, `0x${record[i]?.toString(16)} with ${record.length - 1 - i} pad bytes`);
    const plain = record.subarray(0, i).toString('utf8');
    check('WebCrypto decrypts the PHP body to the same plaintext', plain === x.plaintext, plain);
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nall Node checks passed');
process.exit(fails ? 1 : 0);

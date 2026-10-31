/* 31 Oct deep review, the real bugs found and fixed, each checked (edition mode, terms pre-accepted; run through run-one.sh):
   1 an email-and-password sign-in carries the role permissions, session id, lock and super flag into the page (signedIn);
   2 the read-only Claude Check sign-in never sees the Sync link's key; 3 the Setup rows work under the setup lock (BILL_ADMIN_OK);
   4 the backup carries the Zelle QR code; 5 a right password gives back the per-address try; 6 the update bar sits above the phone menu bar;
   7 a welcome-page logo is taken without the white backing. Harness codes only, never printed. */
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync, renameSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { DIR, ORIGIN, R, t, call, signin, browser, sleep, jars } from './lib1030.mjs';
const CO = DIR + '/sixfold-data/rounds/company.json', BILL = DIR + '/sixfold-data/rounds/billing.json', MAIL = DIR + '/mail-mock.log', ROUNDS = DIR + '/sixfold-data/rounds', PRIV = DIR + '/sixfold-private';
const post = (w, a, b) => call(w, a, null, b);
const mails = () => existsSync(MAIL) ? readFileSync(MAIL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const codeOf = (name) => { const s = readFileSync(PRIV + '/rounds-codes.php', 'utf8'); const m = s.match(new RegExp("'(\\d{6,12})' => \\['" + name + "'")); return m ? m[1] : ''; };
const U = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5);
/* a 16 x 16 opaque PNG (logoTake wants 16 px at least) */
function png16() {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(16, 0); ihdr.writeUInt32BE(16, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(16 * (1 + 48)); for (let y = 0; y < 16; y++) { raw[y * 49] = 0; for (let x = 0; x < 16; x++) { raw[y * 49 + 1 + x * 3] = 30; raw[y * 49 + 2 + x * 3] = 60; raw[y * 49 + 3 + x * 3] = 120; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
let B = null;
try {
  await signin('admin', '222222'); await signin('super', '777777'); await signin('crew', codeOf('Test Crew'));
  const CC = codeOf('Claude Check'); if (CC) await signin('cc', CC);

  /* ---- 1. the password sign-in, in the page ---- */
  console.log('1. email and password sign-in carries the whole answer');
  const em = 'office.' + U + '@acme-test.example', PW = 'correct horse ' + U;
  const ps = await post('admin', 'permset', { role: 'office', perms: { 'set.company': true } });
  t(ps.ok, 'office gets the Company screen (permset set.company, off by default): ' + (ps.error || 'ok'));
  const m0 = mails().length;
  const add = await post('admin', 'accountadd', { name: 'Olive ' + U.charAt(0).toUpperCase() + U.slice(1), role: 'office', email: em });
  t(add.ok && add.invited, 'an office person is added with an email invite: ' + (add.error || 'ok'));
  const inv = mails().slice(m0).find((x) => x.to === em);
  const tok = inv && (inv.body.match(/#pw=(i\.[0-9a-f]{48})/) || [])[1];
  t(!!tok, 'the invite email carries the set-password link');
  const set = await post('anon', 'pwset', { t: tok, password: PW });
  t(set.ok && set.role === 'office' && Array.isArray(set.permAdded) && set.permAdded.includes('set.company') && set.sid, 'pwset signs them in: the answer carries permAdded [set.company] and a session id');
  const pw = await post('anon2', 'pwsignin', { email: em, password: PW, dev: 'c' });
  t(pw.ok && (pw.permAdded || []).includes('set.company') && 'lock' in pw && pw.sid, 'pwsignin: the same answer shape as a code sign-in (permAdded, lock, sid)');
  B = await browser(9512);
  await B.send('Network.clearBrowserCookies'); await B.size(390, 844);
  await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() });
  await B.waitFor(`document.querySelector('.signin button.pwgo')`, 'sign-in screen with the email link');
  await B.js(`document.querySelector('.signin button.pwgo').click()`);
  await B.waitFor(`document.querySelector('form.pwf input[type=password]')`, 'the email and password form');
  await B.js(`(function(){var f=document.querySelector('form.pwf');f.querySelector('input[type=email]').value=${JSON.stringify(em)};f.querySelector('input[type=password]').value=${JSON.stringify(PW)};f.requestSubmit();})()`);
  await B.waitFor(`document.querySelector('.signin.terms button.tagree') || document.querySelector('.tile .tt')`, 'the terms step or home', 25000);
  if (await B.js(`!!document.querySelector('.signin.terms button.tagree')`)) {   /* a new sign-in accepts the terms first */
    await B.js(`[...document.querySelectorAll('.signin.terms input[type=checkbox]')].forEach(function(c){ if(!c.checked) c.click(); }); document.querySelector('.signin.terms button.tagree').click()`);
  }
  await B.waitFor(`document.querySelector('.tile .tt') && !document.querySelector('form.pwf')`, 'home after the password sign-in', 25000);
  const tiles = await B.js(`[...document.querySelectorAll('.tile .tt')].map(e=>e.textContent.trim()).join('|')`);
  t(/(^|\|)Company(Name|\||$)/.test(tiles), 'the Company tile (a granted permission) shows right after a password sign-in (it only showed after the app was reopened): ' + tiles.slice(0, 120));
  await B.shot('deep-1-pw-signin-home', true);
  /* ---- 6. the update bar above the phone menu bar ---- */
  console.log('6. the update bar on a phone');
  await B.js(`document.body.classList.add('has-tabs'); document.body.classList.remove('has-dock'); var d=document.createElement('div'); d.className='updbar'; d.id='updProbe'; d.textContent='probe'; document.body.appendChild(d);`);
  const bottom = await B.js(`parseFloat(getComputedStyle(document.getElementById('updProbe')).bottom)`);
  t(bottom >= 80, 'with the phone menu bar the update bar sits ' + bottom + ' px up (was 14: over Home and Pipeline)');
  await B.js(`document.getElementById('updProbe').remove()`);

  /* ---- 5. the per-address limiter ---- */
  console.log('5. a right password costs no tries');
  let okN = 0; for (let i = 0; i < 12; i++) { const r = await post('pw' + i, 'pwsignin', { email: em, password: PW, dev: 'c' }); if (r.ok) okN++; }
  t(okN === 12, '12 right sign-ins in a row on one address all work (the per-address count used to stop at 10): ' + okN);

  /* ---- 2. Claude Check and the Sync link ---- */
  console.log('2. the read-only sign-in and the Sync link');
  const hs = await post('admin', 'synchookset', { on: true, kind: 'leads' });
  const sa = await call('admin', 'sync');
  const urls = sa.hook && sa.hook.urls;
  t(sa.ok && urls && Object.values(urls).every((u) => /[?&]k=[0-9a-f]{40}/.test(u)), 'the admin sees the link addresses with their key' + (hs.error ? ' (' + hs.error + ')' : ''));
  if (CC) {
    const sc = await call('cc', 'sync');
    t(sc.ok && sc.hook && sc.hook.urls === null && sc.hook.keysHidden === true, 'Claude Check sees the screen without the addresses (the key was in them)');
    t(!JSON.stringify(sc).match(/[0-9a-f]{40}/), 'no 40-hex key anywhere in the read-only answer');
  } else t(false, 'no Claude Check sign-in in this harness');
  await post('admin', 'synchookset', { on: false, kind: 'leads' });

  /* ---- 4. the backup carries the Zelle QR ---- */
  console.log('4. backups');
  writeFileSync(ROUNDS + '/zelle-qr.png', png16());
  const bk = await call('admin', 'backup');
  t(bk.binary && Object.keys(bk.binary).some((k) => /zelle-qr\.png$/.test(k)), 'action=backup carries zelle-qr.png: ' + Object.keys(bk.binary || {}).filter((k) => /zelle|logo/.test(k)).join(', '));
  unlinkSync(ROUNDS + '/zelle-qr.png');

  /* ---- 7. the welcome-page logo, no white backing ---- */
  console.log('7. the welcome-page logo');
  writeFileSync(PRIV + '/logo-pending.png', png16());
  await call('nobody', 'company');
  const loc = JSON.parse(readFileSync(ROUNDS + '/company-local.json', 'utf8'));
  t(loc.logo && loc.logo.type === 'png' && loc.logo.bg === false, 'logoAdopt takes it with the white backing off, as a new upload (bg=' + (loc.logo && loc.logo.bg) + ')');
  t(!existsSync(PRIV + '/logo-pending.png'), 'and the pending file is gone');
  await post('admin', 'logodel', {});

  /* ---- 3. the Setup rows under the setup lock ---- */
  console.log('3. the setup lock');
  const co = JSON.parse(readFileSync(CO, 'utf8')); const coKeep = JSON.stringify(co);
  const hadBill = existsSync(BILL); if (hadBill) renameSync(BILL, BILL + '.deep');
  co.features.billexempt = false; writeFileSync(CO, JSON.stringify(co));
  try {
    const me = await call('admin', 'me');
    t(me.lock && me.lock.kind, 'with the exemption off and nothing paid the admin is in ' + (me.lock && me.lock.kind) + ' mode');
    for (const a of ['training', 'eodget', 'svcarea']) { const r = await call('admin', a); t(r.why !== 'locked', 'admin ' + a + ' is not refused as locked (' + (r.ok ? 'ok' : r.error || r.why) + ')'); }
    const zq = await post('admin', 'zelleqrset', { data: 'data:image/png;base64,' + png16().toString('base64') });
    t(zq.why !== 'locked', 'admin zelleqrset is not refused as locked (' + (zq.ok ? 'ok' : zq.error || zq.why) + ')');
    const cr = await call('crew', 'training');
    t(cr.why === 'locked', 'a crew sign-in stays locked out of Training in setup mode');
  } finally { writeFileSync(CO, coKeep); if (hadBill) renameSync(BILL + '.deep', BILL); }
  await post('admin', 'paywaysset', { zelleQr: null }).catch(() => {});
  for (const x of ['png', 'jpg']) if (existsSync(ROUNDS + '/zelle-qr.' + x)) unlinkSync(ROUNDS + '/zelle-qr.' + x);
} catch (e) { t(false, 'stopped: ' + (e && e.stack || e)); }
finally { if (B) B.close(); }
console.log(`\ndeep1031-test: ${R.pass} passed, ${R.fail} failed`);
process.exit(R.fail ? 1 : 0);

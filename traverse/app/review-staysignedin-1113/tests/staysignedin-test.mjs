/* Matthew stays signed in, 13 Nov 2026 (Matthew: "i also need to stay logged in when im on this computer, i am noticing i am having to
   constantly login on my phone and on this computer"; asked, "Yes, my account only"). His own sign-in (the super line named Matthew Sharpe)
   gets a year, renewed a day after each cookie as he uses the app, and no one-device rule; everyone else keeps 45 days and one phone + one
   computer. Two throwaway installs from the source (traverse/app/api) on PHP's test server, each in a fresh temp folder with throwaway codes:
   Sixfold (company with a365) and an edition (no a365). Older cookies are made here with the test's own session key, as if given days ago.
   Run once per run (fresh data every time):   node traverse/app/review-staysignedin-1113/tests/staysignedin-test.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const DAY = 86400, now = () => Math.floor(Date.now() / 1000);
const near = (a, b, slack = 120) => Math.abs(a - b) <= slack;
const CODES = { matt: '715301', other: '715302', office: '715303', crew: '715304', admin: '715305' };
const PEOPLE = { [CODES.matt]: ['Matthew Sharpe', 'super'], [CODES.other]: ['Other Super', 'super'], [CODES.office]: ['Jen Office', 'office'], [CODES.crew]: ['Brad Crew', 'crew'], [CODES.admin]: ['Pat Admin', 'admin'] };
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

async function install(mode, port) {
  console.log('\n==== ' + mode + ' install ====');
  const TMP = mkdtempSync(join(tmpdir(), 'staysignedin-' + mode + '-')), API = 'http://127.0.0.1:' + port + '/api/rounds.php';
  const WWW = join(TMP, 'www'), DATA = join(TMP, 'sixfold-data', 'rounds'), PRIV = join(TMP, 'sixfold-private');
  mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
  for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php')) cpSync(join(APP, 'api', f), join(WWW, 'api', f));
  const co = { name: 'Test Co', short: 'Test', phone: '(555) 010-0100', features: { crew: true, billexempt: true } };
  if (mode === 'sixfold') co.a365 = { name: '365 Test Aeration', phone: '(555) 010-0199', base: [39.65, -104.99], radius: 45 };
  writeFileSync(join(DATA, 'company.json'), JSON.stringify(co, null, 2));
  writeFileSync(join(DATA, 'index.json'), '{"regions":[]}');
  const KEY = randomBytes(32).toString('hex');
  writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + KEY + "', 'session_days' => 45, 'people' => " + JSON.stringify(PEOPLE).replace(/\{/g, '[').replace(/\}/g, ']').replace(/":/g, '" =>') + "];\n");
  const codeId = (code) => createHmac('sha256', KEY).update('code|' + code).digest('hex').slice(0, 20);
  const tagOf = (tok) => createHash('sha256').update('sid|' + tok).digest('hex').slice(0, 20);
  const forge = (p) => { const body = b64u(JSON.stringify(p)); return body + '.' + b64u(createHmac('sha256', KEY).update(body).digest()); };
  const payloadOf = (tok) => JSON.parse(unb64u(tok.split('.')[0]));
  const sessFile = () => JSON.parse(readFileSync(join(PRIV, 'rounds-sessions.json'), 'utf8'));
  const srv = spawn('php', ['-d', 'memory_limit=512M', '-S', '127.0.0.1:' + port, '-t', WWW], { stdio: 'ignore' });
  function req(url, { method = 'GET', body = null, cookie = '' } = {}) {
    return new Promise((res) => {
      const data = body == null ? null : JSON.stringify(body);
      const r = http.request(url, { method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: 'sfr=' + cookie } : {}) } }, (x) => {
        let s = ''; x.setEncoding('utf8'); x.on('data', (d) => (s += d)); x.on('end', () => {
          let j = {}; try { j = JSON.parse(s); } catch { j = { raw: s.slice(0, 300) }; }
          j._status = x.statusCode; j._set = null;
          for (const c of x.headers['set-cookie'] || []) { const m = /^sfr=([^;]*)/.exec(c); if (m) { const e = /expires=([^;]+)/i.exec(c); j._set = { tok: m[1], expires: e ? Math.floor(Date.parse(e[1]) / 1000) : 0 }; } }
          res(j);
        });
      });
      r.on('error', (e) => res({ _status: 0, error: String(e) })); if (data) r.write(data); r.end();
    });
  }
  const call = (cookie, action, body, q = '') => req(API + '?action=' + action + q, { method: body ? 'POST' : 'GET', body, cookie });
  async function signin(who, dev = 'c') {
    const s = await req(API + '?action=signin', { method: 'POST', body: { code: CODES[who], dev } });
    const tok = s._set ? s._set.tok : '';
    if (s.terms && s.terms.due) await call(tok, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' });
    return { s, tok };
  }
  try {
    for (let i = 0; i < 60; i++) { if ((await req(API + '?action=kitbrand'))._status) break; await sleep(150); }
    const MID = codeId(CODES.matt);

    console.log('\nMatthew signs in: a year, on as many devices as he likes');
    const A = await signin('matt', 'c'); const pA = payloadOf(A.tok);
    t(A.s.ok && A.s.super === true, 'Matthew signs in (super)');
    t(near(pA.exp, now() + 365 * DAY) && pA.d === 365, 'his cookie runs 365 days and says so (d=365): exp in ' + ((pA.exp - now()) / DAY).toFixed(2) + ' days');
    t(near(A.s._set.expires, now() + 365 * DAY), 'the browser is told to keep it a year (Set-Cookie expires)');
    let L = sessFile().s[tagOf(A.tok)];
    t(L && L[0] === MID && near(L[1], now() + 365 * DAY) && L[5] === 365, 'his line in the signed-in list runs a year and carries 365');
    const B = await signin('matt', 'c'), P = await signin('matt', 'm'), P2 = await signin('matt', 'm');
    t(B.s.ok && P.s.ok && P2.s.ok, 'he signs in on a second computer and two phones');
    for (const [nm, tok] of [['first computer', A.tok], ['second computer', B.tok], ['first phone', P.tok], ['second phone', P2.tok]]) {
      const m = await call(tok, 'me'); t(m._status === 200 && m.ok && m.name === 'Matthew Sharpe', 'his ' + nm + ' is still signed in');
    }
    const sf = sessFile(); const mine = Object.values(sf.s).filter((l) => l[0] === MID);
    t(mine.length === 4 && !Object.keys(sf.x || {}).length, 'four lines of his in the signed-in list, none ended elsewhere');
    const fresh = await call(A.tok, 'me');
    t(fresh._status === 200 && !fresh._set && fresh.sid === tagOf(A.tok), 'a cookie given today is not renewed, and the page\'s sid is its own');

    console.log('\nThe year starts again as he uses the app');
    const old = forge({ n: 'Matthew Sharpe', r: 'super', c: MID, exp: now() + 363 * DAY, j: 'aaaa0001', d: 365 });   /* given two days ago */
    const r1 = await call(old, 'me');
    const np = r1._set ? payloadOf(r1._set.tok) : {};
    t(r1._status === 200 && r1._set && near(np.exp, now() + 365 * DAY) && np.d === 365, 'a two-day-old cookie gets a fresh one running 365 days from now');
    t(np.t === tagOf(old) && r1.sid === tagOf(old), 'the fresh cookie keeps the same sign-in tag, and the page is told that sid');
    t(r1._set && near(r1._set.expires, now() + 365 * DAY), 'the browser is told the new expiry');
    L = sessFile().s[tagOf(old)];
    t(L && L[0] === MID && near(L[1], now() + 365 * DAY) && L[5] === 365 && !sessFile().s[tagOf(r1._set.tok)], 'his line keeps its tag and its expiry moves on a year (no second line)');
    const r2 = await call(r1._set.tok, 'me');
    t(r2._status === 200 && !r2._set && r2.sid === tagOf(old), 'the renewed cookie works, is not renewed again the same day, and names the same sid');
    const acc = await call(r1._set.tok, 'accounts');
    const meRow = (acc.accounts || acc.list || []).find((a) => a.id === MID);
    t(acc.ok && meRow && meRow.live.length === 5 && meRow.live.every((x) => x.since > now() - 600), 'the Accounts list shows his five sign-ins, each "since" today, not a year ago' + (meRow ? '' : ' (' + Object.keys(acc).join(',') + ')'));
    const o45 = forge({ n: 'Matthew Sharpe', r: 'super', c: MID, exp: now() + 42 * DAY, j: 'aaaa0002' });   /* one of today's 45-day cookies, three days old */
    const r3 = await call(o45, 'me'); const p3 = r3._set ? payloadOf(r3._set.tok) : {};
    t(r3._status === 200 && near(p3.exp, now() + 365 * DAY) && p3.d === 365 && p3.t === tagOf(o45), 'his existing 45-day cookie becomes a year on its next use (no new sign-in needed), same tag');
    const so = await req(API + '?action=signout&sid=' + r1.sid, { method: 'POST', body: {}, cookie: r1._set.tok });
    t(so.ok && !so.kept && !sessFile().s[tagOf(old)], 'Sign out on the renewed cookie, with the sid the page holds, signs out and removes his line');

    console.log('\nAnother super admin (not Matthew) keeps the usual rules');
    const O = await signin('other', 'c'); const pO = payloadOf(O.tok);
    t(O.s.ok && near(pO.exp, now() + 45 * DAY) && pO.d === undefined, 'Other Super gets 45 days, no d');
    const O2 = await signin('other', 'c');
    const oo = await call(O.tok, 'me');
    t(oo._status === 401 && oo.why === 'elsewhere', 'and Other Super\'s second computer ends the first (401 elsewhere)');

    console.log('\nThe office (Jen) keeps today\'s rules exactly');
    const J1 = await signin('office', 'c'); const pJ = payloadOf(J1.tok);
    t(J1.s.ok && near(pJ.exp, now() + 45 * DAY) && pJ.d === undefined && pJ.t === undefined, 'Jen\'s cookie runs 45 days, nothing added to it');
    L = sessFile().s[tagOf(J1.tok)];
    t(L && L.length === 5 && near(L[1], now() + 45 * DAY), 'her line is the same five fields as before');
    const jo = forge({ n: 'Jen Office', r: 'office', c: codeId(CODES.office), exp: now() + 43 * DAY, j: 'bbbb0001' });
    const jr = await call(jo, 'me');
    t(jr._status === 200 && !jr._set, 'a two-day-old cookie of Jen\'s is not renewed');
    const J2 = await signin('office', 'c');
    const j1 = await call(J1.tok, 'me');
    t(j1._status === 401 && j1.why === 'elsewhere', 'Jen signing in on a second computer still ends the first (401 elsewhere)');
    const j2 = await call(J2.tok, 'me'); t(j2._status === 200, 'her second computer is signed in');
    const C1 = await signin('crew', 'm'); const C2 = await signin('crew', 'm');
    t((await call(C1.tok, 'me')).why === 'elsewhere' && payloadOf(C2.tok).exp - now() <= 45 * DAY + 5, 'crew: 45 days, and a second phone ends the first');
    const mStill = await call(B.tok, 'me');
    t(mStill._status === 200, 'nobody else signing in has ended any of Matthew\'s');
    const jd = forge({ n: 'Jen Office', r: 'office', c: codeId(CODES.office), exp: now() + 315 * DAY, j: 'bbbb0002', d: 365 });   /* a year-long cookie on a line that is not Matthew's, given 50 days ago */
    t((await call(jd, 'me'))._status === 401, 'a year-long cookie on a line that is not Matthew\'s is refused once past 45 days');
    const jd2 = forge({ n: 'Jen Office', r: 'office', c: codeId(CODES.office), exp: now() + 355 * DAY, j: 'bbbb0003', d: 365 });   /* given 10 days ago */
    const jd2r = await call(jd2, 'me'); t(jd2r._status === 200 && !jd2r._set, '... and within 45 days it works but is never renewed');

    console.log('\nAn admin\'s Sign out still ends Matthew\'s sign-ins');
    await sleep(1100);
    const k = await call(O2.tok, 'accountsignout', { id: MID });
    t(k.ok, 'Other Super signs Matthew out from the Accounts screen');
    const after = await Promise.all([A.tok, B.tok, P.tok, r3._set.tok].map((x) => call(x, 'me')));
    t(after.every((x) => x._status === 401), 'every one of his sign-ins is refused after it, the renewed ones included');
    t(!Object.values(sessFile().s).some((l) => l[0] === MID), 'his lines are gone from the signed-in list');
    await sleep(1100);
    const A2 = await signin('matt', 'c');
    t((await call(A2.tok, 'me'))._status === 200, 'he can sign in again afterwards');
  } finally {
    srv.kill(); await sleep(300);
    try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  }
}
await install('sixfold', 8891);
await install('edition', 8892);
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

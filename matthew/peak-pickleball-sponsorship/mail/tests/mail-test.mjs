// Peak email: end-to-end test with a stand-in for Microsoft. NOTHING here reaches Microsoft or sends an email: every login and Graph call
// goes to a local mock (PEAK_MAIL_MOCK), the data folders are throwaway copies, and the desk data is the repo's own seed files.
//   node matthew/peak-pickleball-sponsorship/mail/tests/mail-test.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '..', 'public');
const DESKSRC = path.resolve(HERE, '..', '..', 'data');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'peakmail-'));
const DATA = path.join(TMP, 'mail-data'), DESK = path.join(TMP, 'desk-data');
fs.mkdirSync(DATA); fs.mkdirSync(DESK);
const PORT = 8791, MPORT = 8792;
const T = (y, mo, d, h, mi = 5) => Math.floor(Date.UTC(y, mo - 1, d, h + 7, mi) / 1000);   // Colorado time in November = UTC-7
const NOW1 = T(2026, 11, 17, 10);   // a Tuesday, 10:05 am

let pass = 0, failN = 0;
const ok = (c, what) => { if (c) { pass++; } else { failN++; console.log('FAIL:', what); } };

/* ---- the desk's data: the repo seeds, plus a few desk events to test the replay ---- */
const seed = JSON.parse(fs.readFileSync(path.join(DESKSRC, 'desk-seed.json'), 'utf8'));
fs.writeFileSync(path.join(DESK, 'seed.json'), JSON.stringify(seed));
fs.copyFileSync(path.join(DESKSRC, 'expo-seed.json'), path.join(DESK, 'expo-seed.json'));
const withMail = seed.leads.filter(l => l.list !== 'renew' && (l.contacts || []).some(c => c.email));
const movedLead = withMail[1];   // Brandon moved this one on: it must be left out
/* the skip rules (2026-11-18): claimed but not contacted; a person's call 3 days ago (stage left at To contact); a call 20 days ago */
const ownedLead = withMail[2], touchedLead = withMail[3], oldTouchLead = withMail[4];
fs.writeFileSync(path.join(DESK, 'events.log'), [
  { t: 'status', id: movedLead.id, status: 'tour', by: 'Brandon', at: NOW1 - 86400 },
  { t: 'owner', id: ownedLead.id, owner: 'Nneka', by: 'Nneka', at: NOW1 - 3600, v: 2 },
  { t: 'touch', id: touchedLead.id, k: 'tk00000001', touch: { m: 'call', out: 'noanswer', note: '', when: NOW1 - 3 * 86400 }, by: 'Lance', at: NOW1 - 3 * 86400, v: 2 },
  { t: 'touch', id: oldTouchLead.id, k: 'tk00000002', touch: { m: 'call', out: 'noanswer', note: '', when: NOW1 - 20 * 86400 }, by: 'Lance', at: NOW1 - 20 * 86400, v: 2 },
].map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(DESK, 'peak-records.json'), JSON.stringify({ leads: [] }));
fs.writeFileSync(path.join(DESK, 'scans.json'), JSON.stringify({}));

/* ---- the mail data folder: fake app keys and a sign-in code ---- */
const CODE = 'TESTCODE12';
fs.writeFileSync(path.join(DATA, 'app.json'), JSON.stringify({ client_id: '11111111-2222-3333-4444-555555555555', tenant: '66666666-7777-8888-9999-000000000000', secret: 'mock-secret-not-real' }));
const hash = spawnSync('php', ['-r', 'echo password_hash(trim(stream_get_contents(STDIN)), PASSWORD_DEFAULT);'], { input: CODE }).stdout.toString();
fs.writeFileSync(path.join(DATA, 'code.hash'), hash);

/* a MIME email as Graph would take it, in the same shape as the JSON one (Graph keeps a MIME send in Sent Items too) */
function fromMime(raw) {
  const head = raw.split('\r\n\r\n')[0], hd = k => (head.match(new RegExp('^' + k + ': (.*)$', 'mi')) || [])[1] || '';
  const dec = s => s.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, x) => Buffer.from(x, 'base64').toString('utf8'));
  const bnd = (hd('Content-Type').match(/boundary="([^"]+)"/) || [])[1];
  const parts = {}; for (const p of raw.split('--' + bnd).slice(1, -1)) { const [ph, ...rest] = p.replace(/^\r\n/, '').split('\r\n\r\n'); const ty = (ph.match(/Content-Type: ([^;\r\n]+)/i) || [])[1]; parts[ty] = Buffer.from(rest.join('').replace(/\s+/g, ''), 'base64').toString('utf8'); }
  const to = hd('To'), addr = (to.match(/<([^>]+)>/) || [null, to])[1];
  return { mime: true, saveToSentItems: true, multipart: /multipart\/alternative/.test(hd('Content-Type')), html: parts['text/html'] || '',
    message: { subject: dec(hd('Subject')), body: { contentType: 'Text', content: (parts['text/plain'] || '').replace(/\r\n/g, '\n') }, toRecipients: [{ emailAddress: { address: addr } }] } };
}
/* the Peak desk as its own code reads it (the throwaway copy): both worlds and their tours */
const STORE = path.resolve(HERE, '..', '..', 'app', 'api', 'desk-store.php');
const NOTIFY = path.join(TMP, 'notify.jsonl');
fs.writeFileSync(path.join(TMP, 'desk-read.php'), "<?php define('DATA_DIR', getenv('PEAK_DESK_DATA')); require getenv('PEAK_DESK_STORE'); echo json_encode(['sponsor' => recs('sponsor'), 'expo' => recs('expo'), 'tours' => array_merge(toursOf('sponsor'), toursOf('expo'))]);");
const desk = () => JSON.parse(spawnSync('php', [path.join(TMP, 'desk-read.php')], { env: { ...process.env, PEAK_DESK_DATA: DESK, PEAK_DESK_STORE: STORE } }).stdout.toString());
const auto = R => (R.touches || []).filter(t => t.by === 'Peak email');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---- the stand-in for Microsoft ---- */
const M = { sent: [], calls: [], inbox: [], bodies: {}, sendFail: null, refreshFail: null, tokenN: 0 };
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); M.calls.push(req.method + ' ' + u.pathname);
    const j = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && /\/login\/[0-9a-f-]+\/oauth2\/v2.0\/token$/.test(u.pathname)) {
      const f = new URLSearchParams(b);
      if (f.get('client_secret') !== 'mock-secret-not-real') return j(401, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code') {
        if (f.get('code') === 'needs-admin') return j(400, { error: 'invalid_grant', error_description: 'AADSTS65001: The user or administrator has not consented to use the application.' });
        if (!f.get('code_verifier')) return j(400, { error: 'invalid_request' });
        M.tokenN++; return j(200, { access_token: 'AT-' + M.tokenN, refresh_token: 'RT-SECRET-' + M.tokenN, expires_in: 3600, scope: 'Mail.ReadWrite Mail.Send User.Read profile openid email' });
      }
      if (f.get('grant_type') === 'refresh_token') {
        if (M.refreshFail) return j(400, { error: M.refreshFail });
        M.tokenN++; return j(200, { access_token: 'AT-' + M.tokenN, refresh_token: 'RT-SECRET-' + M.tokenN, expires_in: 3600 });
      }
    }
    if (!/^Bearer AT-\d+$/.test(req.headers.authorization || '')) return j(401, { error: { code: 'InvalidAuthenticationToken' } });
    if (req.method === 'GET' && u.pathname === '/graph/v1.0/me') return j(200, { displayName: 'Matthew Sharpe', mail: 'M.Sharpe@PeakPickleball.us', userPrincipalName: 'm.sharpe@peakpickleball.us' });
    if (req.method === 'POST' && u.pathname === '/graph/v1.0/me/sendMail') {
      /* JSON (plain text only) or MIME (base64, Content-Type text/plain: the plain text plus the HTML part with the open image) */
      if (/^text\/plain/.test(req.headers['content-type'] || '')) (M.raw ||= []).push(Buffer.from(b, 'base64').toString('utf8'));   /* the whole MIME, as sent (tour confirmations) */
      const m = /^text\/plain/.test(req.headers['content-type'] || '') ? fromMime(Buffer.from(b, 'base64').toString('utf8')) : JSON.parse(b);
      if (M.sendFail) { const f = M.sendFail; if (f.once) M.sendFail = null; return j(f.code, { error: { code: f.err, message: f.msg || f.err } }); }
      M.sent.push(m); res.writeHead(202); return res.end();
    }
    if (req.method === 'GET' && /^\/graph\/v1.0\/me\/mailFolders\/(inbox|junkemail)\/messages$/.test(u.pathname)) {
      const f = u.pathname.includes('inbox') ? M.inbox : []; return j(200, { value: f });
    }
    if (req.method === 'GET' && /^\/graph\/v1.0\/me\/messages\//.test(u.pathname)) {
      const id = decodeURIComponent(u.pathname.split('/').pop()); return j(200, { body: { contentType: 'text', content: M.bodies[id] || '' } });
    }
    j(404, { error: { code: 'NotFound' } });
  });
});
await new Promise(r => mock.listen(MPORT, '127.0.0.1', r));

const ENV = { ...process.env, PEAK_MAIL_DATA: DATA, PEAK_DESK_DATA: DESK, PEAK_DESK_STORE: STORE, PEAK_MAIL_NOTIFY: NOTIFY, PEAK_MAIL_MOCK: 'http://127.0.0.1:' + MPORT, PEAK_MAIL_MX: 'skip', PEAK_MAIL_GAP: '0', PEAK_MAIL_HOST: '127.0.0.1:' + PORT };
delete ENV.PEAK_MAIL_DESKFAIL;
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', PUB], { env: { ...ENV, PEAK_MAIL_NOW: String(NOW1) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));

let COOKIE = '';
function req(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const h = { Cookie: COOKIE, ...headers }; if (data !== null && typeof body !== 'string') { h['Content-Type'] = 'application/json'; h['X-PM'] = '1'; }
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: h, agent: false }, res => {
      let s = ''; res.on('data', d => s += d); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch { } resolve({ status: res.statusCode, headers: res.headers, text: s, json: j }); });
    });
    r.on('error', reject); if (data !== null) r.write(data); r.end();
  });
}
const api = (a, body, q = '') => req(body === undefined ? 'GET' : 'POST', '/api.php?action=' + a + q, body);
/* async: the mock lives in this process, so a blocking spawn would leave it unable to answer */
const cron = (now, cmd = 'run', extra = {}) => new Promise(res => { const p = spawn('php', [path.join(PUB, 'cron.php'), cmd], { env: { ...ENV, PEAK_MAIL_NOW: String(now), ...extra } }); let o = ''; p.stdout.on('data', d => o += d); p.on('close', () => res(o)); });
const events = () => fs.readFileSync(path.join(DATA, 'events.log'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

try {
  /* 1. sign-in */
  ok((await api('state')).status === 401, 'state needs sign-in');
  ok((await api('signin', { code: 'WRONGCODE1' })).status === 401, 'wrong code refused');
  const si = await api('signin', { code: CODE.toLowerCase() });
  ok(si.status === 200, 'right code (any case) signs in');
  COOKIE = (si.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  ok((await req('POST', '/api.php?action=pause', JSON.stringify({ list: 'expo' }), { 'Content-Type': 'application/json' })).status === 400, 'a POST without X-PM is refused');
  const pg = await req('GET', '/');
  ok(pg.status === 200 && pg.text.includes('Peak outreach email') && /no-store/.test(pg.headers['cache-control']), 'admin page served, no-store');

  /* 2. lists */
  let s = (await api('state')).json;
  ok(s.lists.sponsors.status === 'paused' && s.lists.expo.status === 'paused', 'both lists start PAUSED');
  ok(s.lists.sponsors.draft && s.lists.expo.draft, 'templates start as DRAFT placeholders');
  const imp = (await api('import', {})).json;
  console.log('import (repo seed):', JSON.stringify(imp.diff));
  ok(imp.diff.sponsors.queued > 20 && imp.diff.expo.queued > 20, 'both lists have people');
  const L = JSON.parse(fs.readFileSync(path.join(DATA, 'lists.json'), 'utf8'));
  const all = [...L.lists.sponsors, ...L.lists.expo].filter(p => !p.hold);
  ok(new Set(all.map(p => p.to)).size === all.length, 'one person per address across both lists');
  ok(!L.lists.sponsors.some(p => p.org === movedLead.id && !p.hold) && L.left.sponsors.some(x => x.name === movedLead.name && /tour booked/i.test(x.why) && x.code === 'stage'), 'a lead Brandon moved on is left out');
  ok(!L.lists.sponsors.some(p => p.org === ownedLead.id) && L.left.sponsors.some(x => x.name === ownedLead.name && x.code === 'owned' && /Nneka/.test(x.why)), 'a company Nneka claimed (still To contact) is skipped: owned');
  ok(!L.lists.sponsors.some(p => p.org === touchedLead.id) && L.left.sponsors.some(x => x.name === touchedLead.name && x.code === 'touched' && /Lance/.test(x.why)), 'a company Lance called 3 days ago is skipped: touched in 14 days');
  ok(L.lists.sponsors.some(p => p.org === oldTouchLead.id && !p.hold), 'a call 20 days ago does not keep a company off');
  s = (await api('state')).json;
  const sk = Object.fromEntries(s.lists.sponsors.skips);
  ok(sk['owned by someone'] === 1 && sk['touched by a person in the last 14 days'] === 1 && imp.diff.sponsors.skips.owned === 1, 'the page shows the skip counts ("owned by someone", 1)');
  let off = (await api('settings', { s: { deskSkip: false } })).json;
  ok(off.lists.sponsors.skips.every(x => !/owned|touched/.test(x[0])) && JSON.parse(fs.readFileSync(path.join(DATA, 'lists.json'), 'utf8')).lists.sponsors.some(p => p.org === ownedLead.id && !p.hold), 'the setting off: owned and touched companies come back (re-imported)');
  off = (await api('settings', { s: { deskSkip: true } })).json;
  ok(off.settings.deskSkip === true && !JSON.parse(fs.readFileSync(path.join(DATA, 'lists.json'), 'utf8')).lists.sponsors.some(p => p.org === ownedLead.id && !p.hold), 'and on again (the default)');
  const orgs = {}; L.lists.sponsors.filter(p => !p.hold).forEach(p => orgs[p.org] = (orgs[p.org] || 0) + 1);
  ok(Object.values(orgs).every(n => n === 1), 'one person per organisation by default');
  ok(L.lists.sponsors.some(p => p.flags.includes('generic')) || L.lists.expo.some(p => p.flags.includes('generic')), 'generic addresses flagged');
  ok(!all.some(p => /@peakpickleball\.us$/.test(p.to)), 'no Peak addresses');

  /* 3. Start is blocked while things are missing */
  let st = await api('start', { list: 'sponsors' });
  ok(st.status === 409 && /DRAFT/.test(st.json.error) && /not connected/.test(st.json.error), 'Start blocked: draft + not connected');

  /* 4. Microsoft connect: the state, the cookie, PKCE, the callback */
  const cn = await api('connect', {});
  const au = new URL(cn.json.url);
  ok(au.pathname === '/login/66666666-7777-8888-9999-000000000000/oauth2/v2.0/authorize', 'sign-in goes to Peak\'s tenant');
  ok(au.searchParams.get('scope') === 'offline_access User.Read Mail.ReadWrite Mail.Send' && au.searchParams.get('code_challenge_method') === 'S256', 'scopes + PKCE');
  ok(au.searchParams.get('redirect_uri') === 'http://127.0.0.1:' + PORT + '/oauth.php', 'redirect is oauth.php');
  const msCookie = (cn.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms=')).split(';')[0];
  const stt = au.searchParams.get('state');
  let cb = await req('GET', '/oauth.php?code=abcdefghij&state=' + encodeURIComponent(stt), undefined, { Cookie: COOKIE });
  ok(cb.status === 302 && /ms=browser/.test(cb.headers.location), 'callback without the browser cookie refused');
  cb = await req('GET', '/oauth.php?code=abcdefghij&state=' + encodeURIComponent(stt), undefined, { Cookie: COOKIE + '; ' + msCookie });
  ok(/ms=expired/.test(cb.headers.location), 'a state is used once only');
  // admin approval, as Microsoft says it at the token step
  let c2 = await api('connect', {}); let ck2 = (c2.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms=')).split(';')[0];
  cb = await req('GET', '/oauth.php?code=needs-admin&state=' + encodeURIComponent(new URL(c2.json.url).searchParams.get('state')), undefined, { Cookie: COOKIE + '; ' + ck2 });
  ok(/ms=admin/.test(cb.headers.location), 'AADSTS65001 -> admin approval message');
  s = (await api('state')).json; ok(s.oauth.kind === 'admin' && /Grant admin consent/.test(s.adminHelp), 'page shows what the admin must do');
  // admin approval, as Microsoft's redirect error
  c2 = await api('connect', {}); ck2 = (c2.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms=')).split(';')[0];
  cb = await req('GET', '/oauth.php?error=access_denied&error_description=' + encodeURIComponent('AADSTS90094: Admin approval required') + '&state=' + encodeURIComponent(new URL(c2.json.url).searchParams.get('state')), undefined, { Cookie: COOKIE + '; ' + ck2 });
  ok(/ms=admin/.test(cb.headers.location), 'AADSTS90094 redirect -> admin approval message');
  // the real thing
  c2 = await api('connect', {}); ck2 = (c2.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms=')).split(';')[0];
  cb = await req('GET', '/oauth.php?code=abcdefghij&state=' + encodeURIComponent(new URL(c2.json.url).searchParams.get('state')), undefined, { Cookie: COOKIE + '; ' + ck2 });
  ok(/ms=connected/.test(cb.headers.location), 'connected');
  s = (await api('state')).json;
  ok(s.conn.connected && s.conn.email === 'm.sharpe@peakpickleball.us', 'page shows the mailbox from /me');
  const msj = fs.readFileSync(path.join(DATA, 'ms.json'), 'utf8');
  ok(!/RT-SECRET|AT-\d/.test(msj), 'tokens are sealed, not plain, in ms.json');
  ok(!JSON.stringify(s).includes('mock-secret') && !JSON.stringify(s).includes('RT-SECRET'), 'the page never gets a secret or token');

  /* 5. still blocked by the draft; a real template; preview */
  st = await api('start', { list: 'sponsors' }); ok(st.status === 409 && /DRAFT/.test(st.json.error) && !/not connected/.test(st.json.error), 'still blocked by the DRAFT');
  ok((await api('template', { list: 'sponsors', subject: 'Hi {name}', body: 'x' })).status === 400, 'unknown merge field refused');
  await api('template', { list: 'sponsors', subject: 'Test subject for {company}', body: 'Hi {first},\n\nTest body for {company} in {town}.\n\nhttps://peakpickleball.us/sponsors\n\nOr pick a time: {book}' });
  await api('template', { list: 'expo', subject: 'Expo test for {company}', body: 'Hi {first},\n\nExpo test.\n\nhttps://peakpickleball.us/' });
  const pv = (await api('preview', undefined, '&list=sponsors')).json;
  ok(pv.messages.length === 3, 'preview shows 3');
  const m0 = pv.messages[0];
  ok(/\/r\.php\?r=[0-9a-f]{10}&l=[0-9a-f]{8}&s=[0-9a-f]{12}/.test(m0.body) && !m0.body.includes('peakpickleball.us/sponsors'), 'web address replaced by a tracked link');
  ok(m0.body.includes('1730 Briargate Blvd') && /reply STOP or use this link: http:\/\/127\.0\.0\.1:8791\/u\.php\?r=/.test(m0.body), 'footer: address + STOP + unsubscribe link');
  ok(!/\{(first|company|town)\}/.test(m0.subject + m0.body), 'merge fields filled');
  ok(!/<img|<html/i.test(m0.body), 'plain text, no pixel');

  ok(/\/b\.php\?r=[0-9a-f]{10}&s=[0-9a-f]{12}/.test(m0.body) && !/r\.php[^\s]*b\.php/.test(m0.body), '{book} is their own book-a-time link (not sent through r.php)');
  ok(m0.html && /<img src="http:\/\/127\.0\.0\.1:8791\/o\.php\?r=[0-9a-f]{10}&amp;s=[0-9a-f]{12}" width="1" height="1"/.test(m0.html) && m0.html.includes('1730 Briargate Blvd'), 'opens on (the default): an HTML twin with the same words and a 1x1 image');
  st = await api('start', { list: 'sponsors' }); ok(st.status === 409 && /\{book\}/.test(st.json.error), 'Start blocked: {book} in the email while booking is off');
  ok((await api('settings', { s: { book: { week: 'Tue 10:00-12:00\nWdd 9' } } })).status === 400, 'a weekly pattern that does not read right is refused');
  s = (await api('settings', { s: { book: { on: true, kind: 'tour', mins: 30, week: 'Wed 10:00-12:00\nThu 10:00-12:00, 13:00-15:00' } } })).json;
  ok(s.settings.book.on && s.book.open > 0 && s.book.week === 'Wed 10:00-12:00\nThu 10:00-12:00, 13:00-15:00', 'booking on, with the weekly hours (' + s.book.open + ' open times)');

  /* 6. Start, then the hourly runs */
  st = await api('start', { list: 'sponsors' }); ok(st.status === 200 && st.json.lists.sponsors.status === 'running', 'sponsors started');
  let out = await cron(T(2026, 11, 17, 8)); ok(/outside the sending window/.test(out) && M.sent.length === 0, '8 am: outside the window');
  out = await cron(NOW1); ok(M.sent.length === 10, 'first day: ramp holds it to 10 (got ' + M.sent.length + ')');
  const g = M.sent[0];
  ok(g.mime && g.multipart && g.saveToSentItems === true && g.message.toRecipients.length === 1 && /Test body for/.test(g.message.body.content) && /Test body for/.test(g.html) && /o\.php\?r=/.test(g.html) && !/o\.php/.test(g.message.body.content), 'sendMail: one person, multipart (the plain text as before, plus HTML with the open image), saved to Sent Items');
  /* the desk after the first run: each company emailed has exactly one Emailed touch by "Peak email", and moved To contact -> Emailed */
  let D = desk(); const ev0 = events(), sent0 = ev0.filter(e => e.t === 'sent');
  ok(sent0.length === 10 && sent0.every(e => /^pm-[0-9a-f]{12}$/.test(e.sid) && e.dref === e.sid && e.w === 'sponsor' && e.org), 'each send logged with its own send id and the desk company');
  ok(sent0.every(e => { const R = D.sponsor[e.org]; return R && R.stage === 'emailed' && auto(R).length === 1 && auto(R)[0].ref === e.sid && auto(R)[0].m === 'email' && auto(R)[0].out === 'sent' && R.owner === ''; }), 'a send logs exactly one Emailed touch on the desk and moves the stage; nobody becomes owner');
  ok(ev0.filter(e => e.t === 'desk' && e.ok).length === 10, 'ten desk updates, all ok');
  /* the same send told to the desk again (as a retry would): the desk keeps it once */
  fs.writeFileSync(path.join(TMP, 'push.php'), "<?php require getenv('PUB') . '/lib.php'; echo json_encode(pmDeskPush(json_decode(stream_get_contents(STDIN), true)));");
  const again = JSON.parse(spawnSync('php', [path.join(TMP, 'push.php')], { input: JSON.stringify(sent0[0]), env: { ...ENV, PUB } }).stdout.toString() || '{}');
  ok(again.ok && /already/.test(again.why) && auto(desk().sponsor[sent0[0].org]).length === 1, 'a repeated ref is not doubled');
  ok(!M.sent.some(x => /\[DRAFT/.test(x.message.subject)), 'no draft went out');
  ok(M.sent.every(x => L.lists.sponsors.some(p => p.to === x.message.toRecipients[0].emailAddress.address)), 'only sponsors went (expo is paused)');
  out = await cron(NOW1 + 600); ok(/already went/.test(out) && M.sent.length === 10, 'same hour again: nothing more');
  const before = M.tokenN;
  /* day two with the desk down: the emails still go, once each; the desk is told on the next run */
  out = await cron(T(2026, 11, 18, 10), 'run', { PEAK_MAIL_DESKFAIL: '1' }); ok(M.sent.length === 22, 'day two: 12 an hour (total ' + M.sent.length + ')');
  ok(M.tokenN > before, 'expired access token renewed from the refresh token');
  ok(!fs.readFileSync(path.join(DATA, 'ms.json'), 'utf8').includes('RT-SECRET'), 'renewed token still sealed');
  const day2 = events().filter(e => e.t === 'sent').slice(10);
  D = desk();
  ok(day2.length === 12 && day2.every(e => D.sponsor[e.org].stage === 'new' && !auto(D.sponsor[e.org]).length) && /12 desk updates wait for the next run/.test(out), 'desk down: all 12 sent anyway, none on the desk yet, and the run says so: ' + out.trim().slice(-90));
  ok(events().filter(e => e.t === 'desk' && !e.ok).length === 1, 'after the first desk failure the run stops trying (one failed try logged, no time lost)');
  out = await cron(T(2026, 11, 18, 10, 30));
  D = desk();
  ok(/desk: 12 caught up/.test(out) && M.sent.length === 22, 'the next run catches the desk up and sends nothing more this hour: ' + out.trim());
  ok(day2.every(e => auto(D.sponsor[e.org]).length === 1 && D.sponsor[e.org].stage === 'emailed'), 'a desk failure did not break or repeat a send: each of the 12 has exactly one Emailed touch');

  /* 7. a click, a scanner, an unsubscribe */
  /* a day-two email: the test server's clock is day one, so the click is not "within a minute of sending" (a scanner) */
  const body0 = M.sent[12].message.body.content, to0 = M.sent[12].message.toRecipients[0].emailAddress.address;
  const link = body0.match(/http:\/\/127\.0\.0\.1:8791(\/r\.php\?[^\s]+)/)[1];
  let rr = await req('GET', link, undefined, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130' });
  ok(rr.status === 302 && rr.headers.location === 'https://peakpickleball.us/sponsors', 'tracked link forwards to the real page');
  await req('GET', link, undefined, { 'User-Agent': 'Microsoft SafeLinks scanner' });
  rr = await req('GET', link.replace(/s=[0-9a-f]+/, 's=000000000000'), undefined, {});
  ok(rr.headers.location === 'https://peakpickleball.us/', 'a forged link goes to the homepage, not anywhere');
  const ev1 = events(); ok(ev1.filter(e => e.t === 'click' && e.to === to0).length === 1 && ev1.filter(e => e.t === 'scan').length === 1, 'click counted once, scanner kept apart');
  const to1 = M.sent[1].message.toRecipients[0].emailAddress.address;
  const un = M.sent[1].message.body.content.match(/http:\/\/127\.0\.0\.1:8791(\/u\.php\?[^\s]+)/)[1];
  rr = await req('GET', un); ok(rr.status === 200 && /Unsubscribe<\/button>/.test(rr.text) && !events().some(e => e.t === 'unsub'), 'opening the link only shows the button');
  rr = await req('POST', un, ''); ok(/You are unsubscribed/.test(rr.text) && events().some(e => e.t === 'unsub' && e.to === to1), 'the button unsubscribes');
  const orgOf = to => events().find(e => e.t === 'sent' && e.to === to).org;
  D = desk(); let R1 = D.sponsor[orgOf(to1)];
  ok(R1.stage === 'notnow' && /not to be emailed/i.test(R1.notnow.why) && auto(R1).some(t => t.out === 'replied' && /unsubscribe link/.test(t.note)), 'an unsubscribe reaches the desk as a STOP: Not now, with the reason');

  /* 7b. opens: the 1x1 image in the HTML part */
  const px = M.sent[12].html.match(/http:\/\/127\.0\.0\.1:8791(\/o\.php\?[^"]+)"/)[1].replace(/&amp;/g, '&');
  rr = await req('GET', px); ok(rr.status === 200 && /image\/gif/.test(rr.headers['content-type']) && /no-store/.test(rr.headers['cache-control']), 'the open image answers as a GIF, never cached');
  await req('GET', px, undefined, { 'User-Agent': 'Mozilla/5.0 (via ggpht.com GoogleImageProxy)' });
  rr = await req('GET', px.replace(/s=[0-9a-f]+/, 's=000000000000'));
  ok(rr.status === 200 && events().filter(e => e.t === 'open').length === 2 && events().filter(e => e.t === 'open' && e.to === to0).length === 2, 'two opens counted for that person; a forged image link counts nothing but still answers');
  let pp = (await api('people', undefined, '&list=sponsors')).json.people.find(p => p.to === to0);
  ok(pp.opens === 2 && pp.open1 > 0 && pp.openLast >= pp.open1 && pp.clicks === 1, 'the per-person table: opens (first, last) and clicks');

  /* 7c. the book-a-time page */
  const to5 = M.sent[5].message.toRecipients[0].emailAddress.address, to6 = M.sent[6].message.toRecipients[0].emailAddress.address;
  const bk = x => M.sent[x].message.body.content.match(/http:\/\/127\.0\.0\.1:8791(\/b\.php\?[^\s]+)/)[1];
  rr = await req('GET', bk(5)); const slot = (rr.text.match(/name="slot" value="([^"]+)"/) || [])[1];
  ok(rr.status === 200 && slot === '2026-11-18 10:30' && /Tour of Peak/.test(rr.text) && events().some(e => e.t === 'bookview' && e.to === to5), 'the page shows the open times (24 hours notice: the first is Wed 10:30) and counts the view: ' + slot);
  const form = s => 'slot=' + encodeURIComponent(s) + '&name=Pat+Tester&note=' + encodeURIComponent('Bring the sponsor sheet');
  const FH = { 'Content-Type': 'application/x-www-form-urlencoded' };
  rr = await req('POST', bk(5), form(slot), FH);
  ok(/You are booked/.test(rr.text) && /1730 Briargate/.test(rr.text), 'booking a time: confirmed, with Peak\'s address');
  const bev = events().find(e => e.t === 'booked' && e.to === to5);
  D = desk(); const tour = D.tours.find(t => t.lead === orgOf(to5));
  ok(bev && bev.date === '2026-11-18' && bev.time === '10:30' && tour && tour.date === '2026-11-18' && tour.time === '10:30' && tour.by === 'Peak email' && /Pat Tester/.test(tour.who) && /sponsor sheet/.test(tour.note), 'the booking is on the Peak desk as a tour, with the contact and their note');
  ok(D.sponsor[orgOf(to5)].stage === 'meeting', 'and the company moved to Meeting / tour booked');
  const nt = fs.existsSync(NOTIFY) ? fs.readFileSync(NOTIFY, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  ok(nt.length === 1 && /booked a tour of peak/.test(nt[0].subject) && nt[0].body.includes(to5) && /Peak desk/.test(nt[0].body), 'Matthew gets a short heads-up from the server');
  rr = await req('POST', bk(6), form(slot), FH); ok(/That time just went/.test(rr.text) && !events().some(e => e.t === 'booked' && e.to === to6), 'the same time for someone else: refused, nothing booked');
  rr = await req('GET', bk(5)); ok(/You are booked/.test(rr.text), 'opening the link again shows their booking');
  rr = await req('GET', bk(6)); ok(!rr.text.includes('value="' + slot + '"'), 'a taken time is not offered again');

  /* 8. replies, STOP, bounce notices, auto-replies; the mailbox is only read */
  const to2 = M.sent[2].message.toRecipients[0].emailAddress.address, to3 = M.sent[3].message.toRecipients[0].emailAddress.address, to4 = M.sent[4].message.toRecipients[0].emailAddress.address;
  const q = L.lists.sponsors.filter(p => !p.hold && !M.sent.some(x => x.message.toRecipients[0].emailAddress.address === p.to));
  const unsentReplier = q[0].to;
  const iso = t => new Date(t * 1000).toISOString();
  M.inbox = [
    { id: 'm1', from: { emailAddress: { address: to2.toUpperCase() } }, subject: 'RE: Test subject', bodyPreview: 'Sounds interesting, call me Thursday.', receivedDateTime: iso(T(2026, 11, 18, 11)) },
    { id: 'm2', from: { emailAddress: { address: to3 } }, subject: 'Re: Test subject', bodyPreview: 'STOP', receivedDateTime: iso(T(2026, 11, 18, 11)) },
    { id: 'm3', from: { emailAddress: { address: 'postmaster@peakpickleball.us' } }, subject: 'Undeliverable: Test subject', bodyPreview: 'Delivery has failed to these recipients or groups:', receivedDateTime: iso(T(2026, 11, 18, 11)) },
    { id: 'm4', from: { emailAddress: { address: to0 } }, subject: 'Automatic reply: Test subject', bodyPreview: 'I am out of the office until Monday.', receivedDateTime: iso(T(2026, 11, 18, 11)) },
    { id: 'm5', from: { emailAddress: { address: unsentReplier } }, subject: 'Sponsorship question', bodyPreview: 'We saw Peak and wondered ...', receivedDateTime: iso(T(2026, 11, 18, 11)) },
    { id: 'm6', from: { emailAddress: { address: 'someone@else.com' } }, subject: 'Lunch?', bodyPreview: 'unrelated', receivedDateTime: iso(T(2026, 11, 18, 11)) },
  ];
  M.bodies.m3 = 'Your message to ' + to4 + ' couldn\'t be delivered. ' + to4 + ' wasn\'t found at the domain.';
  const deskBefore = fs.readFileSync(path.join(DESK, 'events.log'), 'utf8').split('\n').length;
  out = await cron(T(2026, 11, 19, 10));
  const ev = events();
  ok(ev.some(e => e.t === 'reply' && e.to === to2 && !e.stop), 'reply found (address case ignored)');
  ok(ev.some(e => e.t === 'reply' && e.to === to3 && e.stop), 'STOP reply found');
  ok(ev.some(e => e.t === 'bounce' && e.to === to4), 'bounce notice read and matched');
  ok(ev.some(e => e.t === 'auto' && e.to === to0) && !ev.some(e => e.t === 'reply' && e.to === to0), 'auto-reply is not a reply');
  ok(ev.some(e => e.t === 'reply' && e.to === unsentReplier && e.before), 'someone who wrote before being emailed is marked');
  ok(!M.sent.some(x => x.message.toRecipients[0].emailAddress.address === unsentReplier), '... and never emailed');
  ok(!ev.some(e => e.to === 'someone@else.com'), 'unrelated mail ignored');
  ok(!M.calls.some(c => /^(PATCH|DELETE|PUT)/.test(c) || /\/move|\/copy/.test(c)), 'the mailbox is only read (no PATCH, DELETE, move)');
  D = desk();
  const R2 = D.sponsor[orgOf(to2)], R3 = D.sponsor[orgOf(to3)], R4 = D.sponsor[orgOf(to4)];
  ok(auto(R2).some(t => t.out === 'replied' && /Outlook/.test(t.note)) && R2.next && R2.next.date === today() && /answer them/.test(R2.next.what) && R2.stage === 'emailed', 'a reply shows on the desk’s Today: a Replied touch and a follow-up today');
  ok(R3.stage === 'notnow' && auto(R3).some(t => t.out === 'replied' && /not to be emailed/.test(t.note)), 'a STOP reply: the desk marks it Not now (nobody owned it)');
  ok(auto(R4).some(t => t.out === 'bounced' && t.note.includes(to4)) && R4.stage === 'emailed', 'a bounce: a Bounced touch on the desk, the stage stays');
  const unsentOrg = L.lists.sponsors.find(p => p.to === unsentReplier).org;
  ok(auto(D.sponsor[unsentOrg]).some(t => t.out === 'replied') && D.sponsor[unsentOrg].next.date === today(), 'someone who wrote in before being emailed: on the desk too, with a follow-up today');
  ok(!fs.readFileSync(path.join(DESK, 'events.log'), 'utf8').split('\n').some(l => /"t":"note"/.test(l) && /Peak email/.test(l)), 'no more loose notes written into the desk log: everything goes through the desk’s own code');
  ok(M.sent.length === 34, 'day three: 12 more (total ' + M.sent.length + ')');
  const sentTo = M.sent.map(x => x.message.toRecipients[0].emailAddress.address);
  ok(new Set(sentTo).size === sentTo.length, 'nobody emailed twice');
  out = await cron(T(2026, 11, 19, 10, 30)); // inbox again: the same messages are not counted twice
  ok(events().filter(e => e.t === 'reply' && e.to === to2).length === 1, 'a reply is counted once');

  /* 9. stats */
  out = await cron(T(2026, 11, 19, 10, 40), 'stats');
  ok(/Peak email: Microsoft connected \(m\.sharpe@peakpickleball\.us\); sponsors RUNNING 34 sent\/\d+ waiting, 3 replied, 1 bounced, 1 unsub, 1 opened, 1 clicked, 1 booked/.test(out), 'stats line: ' + out.trim());
  s = (await api('state')).json;
  ok(s.lists.sponsors.sent === 34 && s.lists.sponsors.replied === 3 && s.lists.sponsors.bounced === 1 && s.lists.sponsors.unsubscribed === 1 && s.lists.sponsors.clicked === 1 && s.lists.sponsors.auto === 1, 'page counts');
  const rt = s.lists.sponsors.rates;
  ok(s.lists.sponsors.opened === 1 && s.lists.sponsors.opens === 2 && s.lists.sponsors.booked === 1 && rt.open === 2.9 && rt.click === 2.9 && rt.reply === 8.8 && rt.bounce === 2.9 && rt.booked === 2.9, 'rates per list: opened, clicked, replied, bounced, booked (of 34 sent) ' + JSON.stringify(rt));
  ok(s.deskPending === 0 && s.lists.sponsors.deskPending === 0, 'nothing waiting for the desk');
  ok(s.suppressedCount === 3, 'suppression: unsubscribed + STOP + bounced');

  /* 10. pause; a template edit pauses; an import that adds people pauses */
  await api('pause', { list: 'sponsors' }); let n0 = M.sent.length;
  await cron(T(2026, 11, 20, 10)); ok(M.sent.length === n0, 'paused: nothing sent');
  await api('start', { list: 'sponsors' });
  await api('template', { list: 'sponsors', subject: 'Test subject 2 for {company}', body: 'Hi {first}, https://peakpickleball.us/' });
  s = (await api('state')).json; ok(s.lists.sponsors.status === 'paused' && /email changed/.test(s.lists.sponsors.pausedWhy), 'editing the email pauses the list');
  await api('start', { list: 'sponsors' });
  const noMail = seed.leads.find(l => l.list !== 'renew' && !(l.contacts || []).length);
  fs.appendFileSync(path.join(DESK, 'events.log'), JSON.stringify({ t: 'contact', id: noMail.id, contact: { name: 'Pat Example', pos: 'Owner', email: 'pat@newcontact-test.com', phone: '' }, by: 'Brandon', at: NOW1 }) + '\n');
  const im2 = (await api('import', {})).json; ok(im2.diff.sponsors.added === 1 && im2.lists.sponsors.status === 'paused', 'new people from the desk pause a running list');
  await api('start', { list: 'sponsors' });

  /* 11. Brandon moves a queued lead on after the import: skipped at send time */
  const nextUp = JSON.parse(fs.readFileSync(path.join(DATA, 'lists.json'), 'utf8')).lists.sponsors.filter(p => !p.hold && !sentTo.includes(p.to) && p.to !== unsentReplier)[0];
  const nextUp2 = JSON.parse(fs.readFileSync(path.join(DATA, 'lists.json'), 'utf8')).lists.sponsors.filter(p => !p.hold && !sentTo.includes(p.to) && p.to !== unsentReplier && p.org !== nextUp.org)[0];
  fs.appendFileSync(path.join(DESK, 'events.log'), JSON.stringify({ t: 'status', id: nextUp.org, status: 'contacted', by: 'Brandon', at: NOW1 }) + '\n'
    + JSON.stringify({ t: 'owner', id: nextUp2.org, owner: 'Cai Silva', by: 'Cai Silva', at: NOW1, v: 2 }) + '\n');
  n0 = M.sent.length; await cron(T(2026, 11, 20, 11));
  ok(M.sent.length > n0 && !M.sent.slice(n0).some(x => x.message.toRecipients[0].emailAddress.address === nextUp.to), 'a lead moved on the desk after import is not emailed');
  ok(!M.sent.slice(n0).some(x => x.message.toRecipients[0].emailAddress.address === nextUp2.to), 'a company Cai claimed after the import is not emailed (owned)');

  /* 12. Microsoft trouble (the sponsors list has run out by now: the expo list carries these) */
  await api('template', { list: 'expo', subject: 'Expo test for {company}', body: 'Hi {first}, https://peakpickleball.us/' });
  ok((await api('start', { list: 'expo' })).status === 200, 'expo started');
  M.sendFail = { code: 429, err: 'ApplicationThrottled', once: true }; n0 = M.sent.length;
  out = await cron(T(2026, 11, 20, 12)); ok(/trying next hour/.test(out) && M.sent.length === n0, '429: stops, nothing lost');
  M.sendFail = { code: 400, err: 'ErrorInvalidRecipients', msg: 'invalid recipient', once: true };
  out = await cron(T(2026, 11, 20, 13)); ok(events().some(e => e.t === 'fail' && e.final), 'a refused address is marked and skipped');
  M.sendFail = { code: 403, err: 'ErrorMessageSubmissionBlocked', msg: 'blocked', once: true };
  out = await cron(T(2026, 11, 20, 14)); s = (await api('state')).json;
  ok(s.lists.sponsors.status === 'paused' && s.lists.expo.status === 'paused' && /refused to send/.test(s.lists.expo.pausedWhy), 'mailbox blocked: both lists paused');
  ok((await api('start', { list: 'expo' })).status === 200, 'expo started again after the block');
  out = await cron(T(2026, 11, 21, 10)); ok(/outside the sending window/.test(out), 'Saturday: outside the window');
  out = await cron(T(2026, 11, 26, 10)); ok(/outside the sending window/.test(out), 'Thanksgiving: day off');
  M.refreshFail = 'invalid_grant'; n0 = M.sent.length;
  out = await cron(T(2026, 11, 30, 10)); s = (await api('state')).json;
  ok(M.sent.length === n0 && s.conn.status === 'reconnect' && !s.conn.connected, 'refresh refused: needs reconnect, nothing sent');
  ok((await api('start', { list: 'expo' })).status === 409, 'Start blocked while it needs reconnect');

  /* 13b. tour confirmations from the Peak desk (2026-11-19): one per ref, the invite inside, failures kept for Outbox */
  M.refreshFail = null; M.sendFail = null;
  const php = (code, extra = {}) => new Promise(res => { const p = spawn('php', ['-r', 'require getenv("LIB"); ' + code], { env: { ...ENV, LIB: path.join(PUB, 'lib.php'), ...extra } }); let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d); p.on('close', () => res(o)); });
  await php('pmW("ms.json", ["email" => "m.sharpe@peakpickleball.us", "name" => "Matthew Sharpe", "status" => "ok", "tok" => pmSeal(["r" => "RT-SECRET-9", "a" => "AT-9", "x" => time() + 3600]), "at" => time(), "refreshed" => time()]); echo "ok";');
  const tmsg = { ref: 'tc-abc123-0-r', to: 'Pat@Example.com', name: 'Pat Example', subject: 'Confirmed: your visit to Peak Pickleball', text: 'Hi Pat,\n\nWhen: Monday', html: '<p>Hi Pat</p>', ics: 'BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR\r\n',
    method: 'REQUEST', w: 'sponsor', org: 'x1', company: 'Acme', tid: 'abc123', seq: 0, by: 'Cai' };
  const tsend = (m) => php('echo json_encode(pmTourSend(json_decode(getenv("M"), true)));', { M: JSON.stringify(m) }).then(o => { try { return JSON.parse(o); } catch { return { raw: o }; } });
  n0 = M.sent.length;
  let tr = await tsend(tmsg); const raw = (M.raw || []).slice(-1)[0] || '';
  ok(tr.ok && !tr.dup && M.sent.length === n0 + 1, 'tour confirmation: sent once ' + JSON.stringify(tr));
  ok(/^To: Pat Example <pat@example.com>\r\n/m.test(raw) && /Content-Type: multipart\/mixed/.test(raw) && /Content-Type: multipart\/alternative/.test(raw) && /Content-Type: text\/calendar; charset=UTF-8; method=REQUEST/.test(raw) && /filename="invite.ics"/.test(raw) && !/o\.php|r\.php/.test(raw), 'tour confirmation MIME: text, HTML and text/calendar (method=REQUEST), plus invite.ics; no open image or tracked links');
  tr = await tsend(tmsg); ok(tr.ok && tr.dup && M.sent.length === n0 + 1, 'the same ref again: not sent twice');
  M.sendFail = { code: 503, err: 'ServiceUnavailable' };
  tr = await tsend({ ...tmsg, ref: 'tc-abc123-1-r', seq: 1 }); ok(!tr.ok && tr.kind === 'server' && /Microsoft did not answer/.test(tr.why) && M.sent.length === n0 + 1, 'Microsoft down: not sent, said plainly');
  let ts = JSON.parse(await php('echo json_encode(pmTourStats());')); ok(ts.sent.length === 1 && ts.open.length === 1 && ts.open[0].company === 'Acme', 'stats for Outbox: 1 sent, 1 not sent');
  M.sendFail = null; tr = await tsend({ ...tmsg, ref: 'tc-abc123-1-r', seq: 1 }); ts = JSON.parse(await php('echo json_encode(pmTourStats());'));
  ok(tr.ok && ts.sent.length === 2 && ts.open.length === 0, 'retried: sent, nothing left open');
  tr = await tsend({ ...tmsg, ref: 'tc-zzz-0-r', to: 'not-an-email' }); ok(!tr.ok && tr.kind === 'address' && M.sent.length === n0 + 2, 'a bad address is refused before Microsoft');
  tr = await tsend({ ...tmsg, ref: 'test-abc', test: 1, to: 'matthew@example.com' }); ts = JSON.parse(await php('echo json_encode(pmTourStats());'));
  ok(tr.ok && ts.tests === 1 && ts.sent.length === 2, 'a test from the desk\u2019s Settings is counted apart');
  ok((await php('echo json_encode([pmIsCalReply(["subject" => "Accepted: Confirmed: your visit"]), pmIsCalReply(["subject" => "Tentative: x"]), pmIsCalReply(["subject" => "Re: Confirmed: your visit"])]);')).trim() === '[true,true,false]', 'a calendar\u2019s Accepted/Tentative answer is not read as a reply; a real reply is');
  s = (await api('state')).json;
  ok(s.activity.some(a => /^Tour confirmation sent to pat@example.com \(Acme\), from the Peak desk by Cai$/.test(a.what)) && s.activity.some(a => /^Tour confirmation NOT sent to pat@example.com/.test(a.what)), 'the page\u2019s activity lists them');

  /* 13. the address guard */
  ok((await api('settings', { s: { address: '[ADDRESS]' } })).status === 400, 'a placeholder address is refused');
  ok((await api('settings', { s: { rate: 31 } })).status === 400 && (await api('settings', { s: { rate: 20 } })).json.settings.rate === 20, 'rate capped at 30');

  /* 14. nothing secret anywhere it could be seen */
  const logs = ['events.log', 'run.log'].map(f => fs.readFileSync(path.join(DATA, f), 'utf8')).join('');
  ok(!/RT-SECRET|AT-\d|mock-secret|TESTCODE12/.test(logs), 'no token, secret or code in the logs');
  ok((await req('GET', '/lib.php')).status === 404, 'lib.php answers 404');
  ok(!/Peak email/.test((await req('GET', '/cron.php')).text), 'cron.php does nothing on the web');
} catch (e) { failN++; console.log('ERROR', e); }
finally {
  srv.kill(); mock.close();
  console.log(`\n${pass} passed, ${failN} failed  (throwaway data: ${TMP})`);
  if (!failN) fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(failN ? 1 : 0);
}

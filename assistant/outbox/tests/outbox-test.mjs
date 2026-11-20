// Outbox: end-to-end test on a throwaway copy of the server's layout. NOTHING here sends an email or reaches Microsoft: every sender's log
// is a made-up file in a temp folder, and the only Microsoft step tested stops before any call to Microsoft.
//   node assistant/outbox/tests/outbox-test.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-'));   // stands in for ~/www/traverseplatforms.com
const PUB = path.join(R, 'public_html');
const PORT = 18795 + Math.floor(Math.random() * 400);   /* a free port: another tool's local server sometimes holds 8795 */
const T = (y, mo, d, h, mi = 0) => Math.floor(Date.UTC(y, mo - 1, d, h + 7, mi) / 1000);   // Colorado time in November = UTC-7
const NOW = T(2026, 11, 17, 15), DAY = 86400;
let pass = 0, failN = 0;
const ok = (c, what) => { if (c) pass++; else { failN++; console.log('FAIL:', what); } };
const mk = (rel, s) => { const f = path.join(R, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const jl = rows => rows.map(r => JSON.stringify(r)).join('\n') + '\n';

/* ---- the pages, assembled the way they go up ---- */
const as = spawnSync('node', [path.join(REPO, 'assistant', 'outbox', 'tools', 'assemble.mjs'), PUB]);
ok(as.status === 0, 'assemble ran: ' + as.stderr);
fs.mkdirSync(path.join(PUB, 'api'), { recursive: true }); fs.writeFileSync(path.join(PUB, 'api', 'config.php'), '<?php return [];');   // the Sixfold website's mail settings exist
/* the Peak desk's record code, where it is on the server: the sender reads the desk and writes to it through it (2026-11-18) */
fs.mkdirSync(path.join(PUB, 'peak-desk-28d38d', 'api'), { recursive: true });
fs.copyFileSync(path.join(REPO, 'matthew', 'peak-pickleball-sponsorship', 'app', 'api', 'desk-store.php'), path.join(PUB, 'peak-desk-28d38d', 'api', 'desk-store.php'));

/* ---- Outbox's data: a sign-in code ---- */
const CODE = 'OUTBOXTEST12';
const hash = c => spawnSync('php', ['-r', 'echo password_hash(trim(stream_get_contents(STDIN)), PASSWORD_DEFAULT);'], { input: c }).stdout.toString();
const cs = spawnSync('php', [path.join(PUB, 'outbox-092b0f', 'cli.php'), 'setcode'], { input: CODE });
ok(cs.status === 0 && /saved \(hashed\)/.test(cs.stdout) && !cs.stdout.includes(CODE), 'setcode saves the code hashed and does not print it');
ok(fs.existsSync(path.join(R, 'outbox-data', 'code.hash')) && !fs.readFileSync(path.join(R, 'outbox-data', 'code.hash'), 'utf8').includes(CODE), 'code.hash is a hash');

/* ---- Peak: the sender's data folder (fake app keys, nothing connected) and the desk seeds from the repo ---- */
const DESKSRC = path.join(REPO, 'matthew', 'peak-pickleball-sponsorship', 'data');
mk('peak-desk-data/seed.json', fs.readFileSync(path.join(DESKSRC, 'desk-seed.json')));
mk('peak-desk-data/expo-seed.json', fs.readFileSync(path.join(DESKSRC, 'expo-seed.json')));
mk('peak-desk-data/events.log', ''); mk('peak-desk-data/desk-settings.json', JSON.stringify({ tourmail: { on: false } })); mk('peak-desk-data/peak-records.json', '{"leads":[]}'); mk('peak-desk-data/scans.json', '{}');
mk('peak-mail-data/app.json', JSON.stringify({ client_id: '11111111-2222-3333-4444-555555555555', tenant: '66666666-7777-8888-9999-000000000000', secret: 'mock-secret-not-real' }));
mk('peak-mail-data/code.hash', hash('OLDPEAKCODE1'));
mk('peak-mail-data/events.log', jl([{ t: 'import', by: 'test', at: NOW - 3600 }]));
mk('peak-mail-data/run.log', '2026-11-17 14:15 idle (not connected)\n');

/* ---- Sixfold: made-up logs and switches ---- */
mk('sixfold-private/a365-mail.json', JSON.stringify({ host: 'smtp.example.test', user: 'm@example.test', pass: 'NOT-A-REAL-PASSWORD', from: 'hello@example.test' }));
mk('sixfold-data/rounds/a365-mail.log', jl([
  { at: NOW - 2 * 3600, lead: 'L1', job: 'J1', what: 'aftercare', ok: true, stage: 'sent', error: '' },          // today
  { at: NOW - 3 * DAY, lead: 'L2', job: 'J2', what: 'aftercare', ok: true, stage: 'sent', error: '' },           // 7 days
  { at: NOW - 20 * DAY, lead: 'L3', job: 'J3', what: 'aftercare', ok: true, stage: 'sent', error: '' },          // 30 days
  { at: NOW - 40 * DAY, lead: 'L4', job: 'J4', what: 'aftercare', ok: true, stage: 'sent', error: '' },          // older
  { at: NOW - DAY, lead: 'L5', job: 'J5', what: 'aftercare', ok: false, stage: 'noemail', error: '' },           // skipped, not a failure
  { at: NOW - 3600, lead: 'L6', job: 'J6', what: 'followup', ok: false, stage: 'auth', error: '535 bad credentials' },   // a failure today
  { at: NOW - 5 * DAY, lead: 'L7', job: 'J7', what: 'followup', ok: true, stage: 'sent', error: '' },
  { at: NOW - 6 * DAY, lead: 'L8', what: 'deposit reminder d1', ok: true, stage: 'sent', error: '' },
  { at: NOW - 9 * DAY, lead: 'L9', what: 'signed', ok: true, stage: 'sent', error: '' }]));
mk('sixfold-data/rounds/emails2.json', JSON.stringify({ on: true, from: NOW - 15 * DAY }));
mk('sixfold-data/rounds/followup.json', JSON.stringify({ on: true, at: NOW - 15 * DAY, from: NOW - 15 * DAY, past: true }));
mk('sixfold-data/rounds/deprem.json', JSON.stringify({ on: false, from: NOW - 15 * DAY, no: {}, sent: {} }));
mk('sixfold-data/rounds/newsletter.json', JSON.stringify({ address: '1 Test St', issues: [
  { id: 'n1ad205ec33', subject: 'November notes', approved: { for: NOW - 15 * DAY }, sent: { start: NOW - 15 * DAY, n: 3, ok: 2, bad: 1, done: true, end: NOW - 15 * DAY + 60, queue: [] } },
  { id: 'n2dec', subject: 'December notes', approved: { for: T(2026, 12, 1, 9) }, sent: null }] }));
mk('sixfold-data/rounds/newsletter-sent-n1ad205ec33.log', jl([{ id: 'a@x.test', ok: true, stage: 'sent', at: NOW - 15 * DAY }, { id: 'b@x.test', ok: true, stage: 'sent', at: NOW - 15 * DAY }, { id: 'c@x.test', ok: false, stage: 'unsubscribed', at: NOW - 15 * DAY }]));
mk('sixfold-data/rounds/newsletter-unsub.json', JSON.stringify({ 'c@x.test': { at: 1, how: 'link' } }));
mk('sixfold-data/rounds/weblead-mail.log', jl([{ at: NOW - 4 * DAY, ok: true, stage: 'sent', queued: NOW - 4 * DAY }]));
mk('sixfold-data/rounds/weblead-mail-queue.jsonl', '');
mk('sixfold-data/digest/digest.log', jl([{ at: T(2026, 11, 17, 6), ok: true, stage: 'sent', subject: 'Morning' }, { at: T(2026, 11, 16, 6), ok: true, stage: 'sent', subject: 'Morning' }]));
mk('sixfold-data/digest/last-sent.txt', '2026-11-17');
mk('sixfold-data/digest/eod.log', jl([
  { at: T(2026, 11, 16, 20), to: 'x', ok: true, stage: 'sent', subject: 'End of day, Mon 16 Nov' }, { at: T(2026, 11, 16, 20), to: 'y', ok: true, stage: 'sent', subject: 'End of day, Mon 16 Nov' },
  { at: T(2026, 11, 14, 20), to: 'x', ok: true, stage: 'sent', subject: 'The week, 9 to 14 Nov' }, { at: T(2026, 11, 14, 20), to: 'z', ok: false, stage: 'connect', subject: 'The week, 9 to 14 Nov' },
  { at: T(2026, 11, 13, 20), to: 'x', ok: true, stage: 'sent', subject: 'TEST End of day' }]));
mk('sixfold-data/digest/eod-last-sent.txt', '2026-11-16');
mk('sixfold-data/digest/profit-monthly.txt', '2026-10');

/* ---- Traverse: the desk, the website, sign-ups ---- */
const desk = [{ t: 'settings', s: { address: '1 Test St, Englewood, CO 80110', cap: 360 }, by: 'M', at: NOW - 30 * DAY }];
for (let i = 0; i < 30; i++) desk.push({ t: 'sent', id: 'p' + i, to: 'p' + i + '@x.test', subject: 'Hi', by: 'queue', at: NOW - (i < 5 ? 3600 : 10 * DAY), ...(i < 4 ? { style: 'plain', links: 3 } : {}) });   /* 18 Nov: the first four carry the style, as rows written since then do */
desk.push({ t: 'bounce', id: 'p1', to: 'p1@x.test', by: 'Bounce log', at: NOW - 9 * DAY }, { t: 'bounce', id: 'p2', to: 'p2@x.test', by: 'Bounce log', at: NOW - 9 * DAY });
desk.push({ t: 'click', id: 'p3', to: 'home', by: 'the company', at: NOW - 2 * DAY }, { t: 'scan', id: 'p3', to: 'home', by: 'the company', at: NOW - 2 * DAY });
desk.push({ t: 'click', id: 'p0', to: 'demo', u: 'https://traverseplatforms.com/demo', c: 'abcdefghi', s: 'plain', by: 'the company', at: NOW - 3000 }, { t: 'click', id: 'p0', to: 'home', u: 'https://traverseplatforms.com/', c: 'bcdefghij', s: 'plain', by: 'the company', at: NOW - 2900 }, { t: 'scan', id: 'p1', to: 'home', u: 'https://traverseplatforms.com/', c: 'cdefghijk', s: 'plain', by: 'the company', at: NOW - 3500 });   /* plain tracked links (18 Nov) */
desk.push({ t: 'unsub', id: 'p4', by: 'the company', at: NOW - DAY }, { t: 'sendfail', id: 'p5', stage: 'to', error: '550 no such user', by: 'queue', at: NOW - 2 * 3600 });
mk('traverse-prospects-data/events.log', jl(desk));
mk('traverse-prospects-data/queue.json', JSON.stringify([{ id: 'q1', to: 'q1@x.test', after: NOW - 60 }, { id: 'q2', to: 'q2@x.test', after: NOW + DAY }]));
mk('traverse-prospects-data/send-after.txt', String(NOW - DAY));
mk('traverse-prospects-data/send.log', 'sent 3\nsent 2\n');
mk('traverse-prospects-data/bounce-scan.log', '2026-11-17 15:00 {"logged":[],"already":0,"not on desk":0}\n');
mk('traverse-site-private/site-config.php', "<?php return ['smtp' => ['pass' => 'NOT-A-REAL-PASSWORD']];");
mk('traverse-site-private/mail.log', jl([{ at: NOW - 10 * DAY, what: 'book-notify d1', ok: true, stage: 'sent', error: '' }, { at: NOW - 10 * DAY, what: 'book-confirm d1', ok: true, stage: 'sent', error: '' }, { at: NOW - 10 * DAY, what: 'cancel d1', ok: true, stage: 'sent', error: '' }]));
mk('traverse-shared/clients/clients.log', jl([{ what: 'mail', subject: 'Finish setting up your Traverse', ok: true, stage: 'sent', at: NOW - 17 * DAY }, { what: 'mail', subject: 'Traverse: new paid company (Lawn)', ok: true, stage: 'sent', at: NOW - 17 * DAY }, { what: 'checkout', at: NOW - 17 * DAY }]));
mk('traverse-shared/clients/billing-config.php', '<?php return [];');
mk('traverse-yards-data/rounds/company.json', '{}');
mk('sixfold-data/digest/setup-trial-sweep.log', '2026-11-17 04:00 traverse-yards-rounds.php: {"ok":true,"did":""}\n');
mk('post-calendar-data/events.log', jl([{ t: 'post', id: 'x', client: 'c', by: 'runner', what: 'Emailed Matthew about the failure', at: NOW - 3 * DAY }]));

/* every file the read-only sections read: their bytes must not change */
const watched = ['sixfold-data', 'sixfold-private', 'traverse-prospects-data', 'traverse-site-private', 'traverse-shared', 'traverse-yards-data', 'post-calendar-data', 'peak-desk-data'];
const snap = () => { const h = crypto.createHash('sha256'); for (const w of watched) for (const f of fs.readdirSync(path.join(R, w), { recursive: true }).sort()) { const p = path.join(R, w, f); if (fs.statSync(p).isFile()) h.update(f + fs.readFileSync(p)); } return h.digest('hex'); };
const before = snap();

/* ---- the test server: public_html as the web root ---- */
const env = { ...process.env, OUTBOX_NOW: String(NOW) }; for (const k of Object.keys(env)) if (k.startsWith('PEAK_MAIL_') || k.startsWith('PEAK_DESK_')) delete env[k];
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', PUB], { env, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
function req(method, p, body, headers = {}) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers } }, x => {
      let b = ''; x.on('data', d => b += d); x.on('end', () => { let j = null; try { j = JSON.parse(b); } catch {} res({ status: x.statusCode, headers: x.headers, text: b, json: j }); });
    });
    r.on('error', rej); if (body !== undefined) r.write(JSON.stringify(body)); r.end();
  });
}
let COOKIE = '';
const api = (a, body, base = '/outbox-092b0f/api.php', hdr = { 'X-OB': '1' }) => req(body === undefined ? 'GET' : 'POST', base + '?action=' + a, body, { Cookie: COOKIE, ...(body !== undefined ? hdr : {}) });

try {
  /* 1. sign-in */
  let r = await req('GET', '/outbox-092b0f/'); ok(r.status === 200 && /<title>Outbox<\/title>/.test(r.text) && r.headers['x-frame-options'] === 'SAMEORIGIN', 'page loads, frameable by the hub only');
  ok(!/peak-mail-data|outbox-data|sixfold-private/.test(r.text), 'the page names no private folder');
  r = await api('state'); ok(r.status === 401 && r.json.signin, 'state refused without sign-in');
  r = await req('POST', '/outbox-092b0f/api.php?action=signin', { code: CODE }); ok(r.status === 400, 'a POST without X-OB is refused');
  r = await api('signin', { code: 'WRONGCODE123' }); ok(r.status === 401, 'wrong code refused');
  r = await api('signin', { code: 'OLDPEAKCODE1' }); ok(r.status === 401, 'the old Peak code does not open Outbox');
  r = await api('signin', { code: CODE.toLowerCase() }); ok(r.status === 200 && r.json.ok, 'right code (any case) signs in');
  const sc = (r.headers['set-cookie'] || []).find(c => c.startsWith('outbox='));
  ok(sc && /path=\/outbox-092b0f\//i.test(sc) && /httponly/i.test(sc) && /samesite=lax/i.test(sc), 'cookie is HttpOnly, SameSite=Lax, Outbox path only');
  COOKIE = sc.split(';')[0];

  /* 2. the whole view */
  r = await api('state'); const V = r.json; ok(r.status === 200 && V.ok, 'state after sign-in');
  ok(!r.text.includes('NOT-A-REAL-PASSWORD') && !r.text.includes('mock-secret-not-real') && !r.text.includes(CODE), 'no password, secret or code in the answer');
  const S = id => V.sixfold.items.find(i => i.id === id), X = id => V.traverse.items.find(i => i.id === id);
  const ac = S('aftercare'); ok(ac.today === 1 && ac.d7 === 2 && ac.d30 === 3 && ac.last === NOW - 2 * 3600, 'aftercare: 1 today, 2 in 7 days, 3 in 30, last time');
  ok(ac.skipped30 === 1 && ac.fail30 === 0, 'aftercare: "no email on file" is a skip, not a failure');
  ok(ac.on === true && /pay link at Done: on/.test(ac.state), 'aftercare on, with the emails2 switch read');
  const fu = S('followup'); ok(fu.on === true && fu.d7 === 1 && fu.failToday === 1 && /password was refused/.test(fu.fails[0].why), 'follow-up: on, one sent, today\'s failure explained');
  ok(S('deposit').on === false && S('deposit').state === 'off' && S('deposit').d7 === 1, 'deposit reminder: switch off read from deprem.json, past send counted');
  ok(S('signed').d30 === 1 && S('signed').d7 === 0, 'signed copy counted in 30 days only');
  const nl = S('newsletter'); ok(nl.on === true && /approved: "December notes"/.test(nl.state) && nl.d30 === 2 && nl.skipped30 === 1, 'newsletter: next approved issue shown, sent log counted, unsubscribed skipped');
  ok(/to 2, /.test(nl.note) && /Unsubscribed so far: 1/.test(nl.note), 'newsletter: last issue and unsubscribes');
  ok(S('weblead').on === true && S('weblead').d7 === 1, 'website-form email counted');
  ok(S('morning').today === 1 && S('morning').d7 === 2, 'morning email: today and the week');
  ok(S('eod').d7 === 2 && /1 test copies/.test(S('eod').note), 'end of day: copies counted, the TEST one left out');
  ok(S('week').d7 === 1 && S('week').fail7 === 1, 'Saturday weekly: one sent, one failed');
  ok(/October 2026/.test(S('profit').note), 'profit email: the month from its marker');
  const dk = X('desk'); ok(dk.today === 5 && dk.d30 === 30 && dk.bounce30 === 2 && dk.click30 === 3 && dk.unsub30 === 1, 'desk: sent today and 30 days, bounces, clicks (scans left out), unsubscribes');
  ok(/plain: 1 company clicked of 4 sent \(25%\)/.test(dk.clicks) && /before 18 Nov \(only picture links tracked\): 1 company clicked of 26 sent/.test(dk.clicks) && /2 mail-scanner hits left out/.test(dk.clicks) && dk.scan30 === 2, 'desk: clicks split by style, scanners counted apart (' + dk.clicks + ')');
  ok(dk.waiting === 2 && /2 waiting, 1 due now/.test(dk.state) && dk.on === true, 'desk: queue and due count, hold in the past = sending');
  ok(dk.failToday === 1 && /address was refused/.test(dk.fails[0].why), 'desk: send failure shown');
  ok(dk.opens.startsWith('not tracked'), 'desk: opens are not tracked');
  ok(X('demo-confirm').d30 === 1 && X('demo-notify').d30 === 2, 'demo emails split: visitor vs you');
  ok(X('signup').d30 === 1 && X('notes').d30 === 1 && X('signup').on === true, 'sign-up mail split: customer vs note to you');
  ok(X('client-eod').on === false && X('client-care').on === false, 'client apps: off when nothing is switched on');
  ok(X('posts').d7 === 1, 'post calendar alert counted');

  /* 3. the summary */
  const s = V.summary; ok(s.sent.sixfold === 3 && s.sent.traverse === 5 && s.sent.peak === 0, 'sent today per business (Sixfold: aftercare + morning + ... )');
  ok(s.failed.sixfold === 1 && s.failed.traverse === 1, 'failed today per business');
  ok(s.waiting.traverse === 2, 'waiting: the desk queue');
  const att = s.attention.map(a => a.text).join('\n');
  ok(/Microsoft is not connected/.test(att), 'attention: Microsoft not connected');
  ok(/Peak email, Peak sponsors list: paused, not started yet; the email is still a DRAFT/.test(att), 'attention: a paused Peak list');
  ok(/Two-day follow-up: 1 failed/.test(att), 'attention: a Sixfold failure');
  ok(!/end-of-day report has not gone out/.test(att), 'no false alarm: at 3 pm the end of day is not due');
  ok(s.attention[0].level === 'bad', 'problems listed before notes');
  ok(V.peak.ready && V.peak.lists.length === 2 && V.peak.lists.every(l => l.status === 'paused'), 'Peak summary read through the Peak sender itself');
  /* 3b. tour confirmations from the Peak desk (2026-11-19): counted, and the ones not sent flagged with where to retry */
  ok(V.peak.tours && V.peak.tours.on === false && V.peak.tours.d30 === 0 && !V.peak.tours.open.length && !/tour confirmation/.test(att), 'tour confirmations: off, none yet, nothing flagged');
  fs.appendFileSync(path.join(R, 'peak-mail-data/events.log'), jl([
    { t: 'tourmail', ref: 'tc-a1-0-r', to: 'pat@example.com', method: 'REQUEST', seq: 0, w: 'sponsor', org: 'x1', company: 'Acme', tid: 'a1', by: 'Cai', ok: true, at: NOW - 600 },
    { t: 'tourmail', ref: 'tc-b2-0-r', to: 'sam@example.com', method: 'REQUEST', seq: 0, w: 'expo', org: 'x2', company: 'Show Co', tid: 'b2', by: 'Lance', ok: false, kind: 'server', why: 'no answer', at: NOW - 300 },
    { t: 'tourmail', ref: 'test-1', to: 'm@example.com', method: 'REQUEST', seq: 0, w: 'sponsor', tid: 't', by: 'Matthew', ok: true, test: 1, at: NOW - 200 }]));
  r = await api('state'); const VT = r.json.peak.tours;
  ok(VT.today === 1 && VT.d30 === 1 && VT.tests === 1 && VT.open.length === 1 && VT.open[0].company === 'Show Co' && r.json.summary.sent.peak === 1, 'tour confirmations: 1 sent today (the test apart), 1 not sent; Peak’s sent today includes it');
  ok(/Peak desk: 1 tour confirmation not sent\. Retry is on the tour in the Peak desk/.test(r.json.summary.attention.map(a => a.text).join('\n')) && /peak-desk-28d38d\/#sponsor\/deals\/tours/.test(VT.desk), 'the one not sent is flagged, with the desk’s Tours as the place to retry');

  /* 3c. desk emails from the Peak desk (2026-11-19): counted with Peak's sent today, the ones not sent flagged with where to retry */
  ok(r.json.peak.deskmails && r.json.peak.deskmails.on === false && r.json.peak.deskmails.book === false && !r.json.peak.deskmails.open.length, 'desk emails: off, booking links off, none yet');
  fs.appendFileSync(path.join(R, 'peak-mail-data/events.log'), jl([
    { t: 'deskmail', ref: 'dm0000000001', to: 'robin@example.com', w: 'sponsor', org: 'x1', company: 'Acme', by: 'Cai', subject: 'Following up', ok: true, at: NOW - 500 },
    { t: 'deskmail', ref: 'dm0000000002', to: 'lee@example.com', w: 'expo', org: 'x2', company: 'Show Co', by: 'Cai', subject: 'Dates', ok: false, kind: 'server', why: 'no answer', at: NOW - 400 },
    { t: 'deskmail', ref: 'dm0000000003', to: 'kim@example.com', w: 'sponsor', org: 'x3', company: 'Kim Co', by: 'Nneka', subject: 'Hi', ok: false, kind: 'server', why: 'no answer', at: NOW - 300 },
    { t: 'deskmail', ref: 'dm0000000003', to: 'kim@example.com', w: 'sponsor', org: 'x3', company: 'Kim Co', by: 'Nneka', subject: 'Hi', ok: true, at: NOW - 200 }]));
  r = await api('state'); const VD = r.json.peak.deskmails;
  ok(VD.today === 2 && VD.d30 === 2 && VD.open.length === 1 && VD.open[0].company === 'Show Co' && VD.open[0].by === 'Cai' && r.json.summary.sent.peak === 3, 'desk emails: 2 sent today (one after a retry), 1 not sent; Peak\u2019s sent today includes them');
  ok(/Peak desk: 1 desk email not sent\. Retry is on the company's card in the Peak desk/.test(r.json.summary.attention.map(a => a.text).join('\n')), 'the one not sent is flagged, with the card as the place to retry');

  /* 4. the bounce limit on the desk */
  fs.appendFileSync(path.join(R, 'traverse-prospects-data/events.log'), jl([1, 2].map(i => ({ t: 'bounce', id: 'p' + (5 + i), to: 'x', by: 'Bounce log', at: NOW - DAY }))));
  r = await api('state'); ok(/Prospect Desk bounces: 4 of 30/.test(r.json.summary.attention.map(a => a.text).join('\n')), 'desk bounces over 5% are flagged');

  /* 5. read only: nothing the sections read was changed, and there is no action that changes them */
  r = await api('followupset', { on: false }); ok(r.status === 404, 'no action changes Sixfold');
  r = await api('sendqueue', {}); ok(r.status === 404, 'no action changes the desk');
  fs.writeFileSync(path.join(R, 'traverse-prospects-data/events.log'), jl(desk));   // put back the line appended for test 4
  ok(snap() === before, 'every Sixfold, Traverse and desk file is byte-for-byte unchanged');

  /* 6. Peak inside Outbox: Outbox's sign-in is the way in */
  r = await req('GET', '/outbox-092b0f/peak/api.php?action=state'); ok(r.status === 401 && r.json.outbox === true, 'Peak controls refused without the Outbox sign-in');
  r = await req('GET', '/outbox-092b0f/peak/api.php?action=state', undefined, { Cookie: COOKIE }); ok(r.status === 200 && r.json.ok && r.json.lists.sponsors, 'Peak controls open with the Outbox sign-in');
  r = await req('POST', '/outbox-092b0f/peak/api.php?action=signin', { code: 'OLDPEAKCODE1' }, { 'X-PM': '1' }); ok(r.status === 403, 'the old Peak code is not accepted inside Outbox');
  r = await req('GET', '/outbox-092b0f/peak/?embed=1', undefined, { Cookie: COOKIE }); ok(r.status === 200 && /embed=1/.test(r.text), 'Peak page loads inside Outbox');
  r = await req('POST', '/outbox-092b0f/peak/api.php?action=pause', { list: 'sponsors' }, { Cookie: COOKIE, 'X-PM': '1' }); ok(r.status === 200 && r.json.ok, 'a Peak control works through Outbox');

  /* 7. Connect Microsoft: the registered redirect, and the cookie that must come back to it */
  r = await req('POST', '/outbox-092b0f/peak/api.php?action=connect', {}, { Cookie: COOKIE, 'X-PM': '1' });
  let au = new URL(r.json.url); ok(au.searchParams.get('redirect_uri') === 'https://traverseplatforms.com/peak-mail-31dc56/oauth.php', 'Microsoft returns to the old registered redirect by default');
  let mc = (r.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms=')); ok(/path=\/peak-mail-31dc56\//i.test(mc), 'the Connect cookie goes to the old address, where Microsoft returns');
  const st = au.searchParams.get('state');
  r = await req('GET', '/peak-mail-31dc56/oauth.php?code=abcdefghij&state=' + encodeURIComponent(st)); ok(r.status === 302 && r.headers.location === '/outbox-092b0f/?tab=peak&ms=browser', 'old redirect still answers and sends Matthew back to Outbox (checks run before any Microsoft call)');
  r = await req('GET', '/peak-mail-31dc56/oauth.php?state=junk'); ok(r.status === 302 && /ms=failed/.test(r.headers.location), 'a junk callback at the old address is refused');
  r = await api('peakreturn', { to: 'outbox' }); ok(r.json.ok && r.json.redirect === 'https://traverseplatforms.com/outbox-092b0f/peak/oauth.php', 'switch to the new redirect');
  r = await req('POST', '/outbox-092b0f/peak/api.php?action=connect', {}, { Cookie: COOKIE, 'X-PM': '1' });
  au = new URL(r.json.url); mc = (r.headers['set-cookie'] || []).find(c => c.startsWith('peakmail_ms='));
  ok(au.searchParams.get('redirect_uri') === 'https://traverseplatforms.com/outbox-092b0f/peak/oauth.php' && /path=\/outbox-092b0f\/peak\//i.test(mc), 'new redirect and its cookie path');
  r = await req('GET', '/outbox-092b0f/peak/oauth.php?state=junk'); ok(r.status === 302 && r.headers.location === '/outbox-092b0f/?tab=peak&ms=failed', 'the new redirect answers too');
  r = await api('peakreturn', { to: 'old' }); ok(r.json.ok && /peak-mail-31dc56/.test(r.json.redirect), 'and back to the old one');
  r = await api('peakreturn', { to: 'elsewhere' }); ok(r.status === 400, 'only old or outbox');

  /* 8. the old address */
  r = await req('GET', '/peak-mail-31dc56/'); ok(r.status === 302 && r.headers.location === '/outbox-092b0f/?tab=peak', 'old page forwards to Outbox');
  r = await req('GET', '/peak-mail-31dc56/index.php'); ok(r.status === 302, 'old index.php forwards too');
  r = await req('GET', '/peak-mail-31dc56/api.php?action=state'); ok(r.status === 410 && /Outbox/.test(r.json.error), 'old API says it moved');
  r = await req('GET', '/peak-mail-31dc56/r.php?r=0000000000&l=00000000&s=x'); ok(r.status === 302 && r.headers.location === 'https://peakpickleball.us/', 'old tracked-link address still answers (forged link -> homepage)');
  r = await req('GET', '/peak-mail-31dc56/u.php?r=0&s=0'); ok(r.status === 200 && /did not work/.test(r.text), 'old unsubscribe address still answers');
  r = await req('GET', '/peak-mail-31dc56/cron.php'); ok(r.status === 404, 'old cron.php is not a web page');
  const cr = spawnSync('php', [path.join(PUB, 'peak-mail-31dc56', 'cron.php'), 'stats'], { env }); ok(cr.status === 0 && /^Peak email: Microsoft not connected/.test(cr.stdout.toString()), 'old cron.php path runs the Outbox copy from the command line (hourly cron, overnight check)');

  /* 9. private files answer 404 */
  for (const p of ['/outbox-092b0f/lib.php', '/outbox-092b0f/cli.php', '/outbox-092b0f/peak/lib.php', '/outbox-092b0f/peak/site.php', '/outbox-092b0f/peak/cron.php']) { r = await req('GET', p); ok(r.status === 404, p + ' answers 404'); }

  /* 9b. the installed Peak sender and the Peak desk together (2026-11-18), against a stand-in for Microsoft: nothing reaches Microsoft */
  {
    const MS = { sent: [] }, MPORT = 8796;
    const mock = http.createServer((q, s) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
      const u = new URL(q.url, 'http://x'), j = (c, o) => { s.writeHead(c, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); };
      if (/\/oauth2\/v2.0\/token$/.test(u.pathname)) return j(200, { access_token: 'AT-9', refresh_token: 'RT-9', expires_in: 3600 });
      if (/^\/graph\/v1.0\/(me|users\/[^/]+)\/sendMail$/.test(u.pathname)) { const raw = Buffer.from(b, 'base64').toString('utf8'); MS.sent.push({ box: u.pathname.split('/')[3] === 'me' ? 'me' : decodeURIComponent(u.pathname.split('/')[4]), from: (raw.match(/^From: (.*)\r$/m) || [])[1] || '', to: (raw.match(/^To: (?:.*<)?([^>\r\n]+)>?\r?$/m) || [])[1], mime: /multipart\/alternative/.test(raw) && /Content-Type: text\/html/.test(raw) && /o\.php\?r=/.test(Buffer.from((raw.split('Content-Type: text/html')[1] || '').split('\r\n\r\n')[1] || '', 'base64').toString('utf8')) }); s.writeHead(202); return s.end(); }
      if (/mailFolders/.test(u.pathname)) return j(200, { value: [] });
      j(404, { error: { code: 'NotFound' } });
    }); });
    await new Promise(r => mock.listen(MPORT, '127.0.0.1', r));
    try {
      const PEAK = path.join(PUB, 'outbox-092b0f', 'peak'), RUN = T(2026, 11, 16, 10);   // a Monday, before Outbox's test "today": the sent-today counts below stay as they are
      const menv = { ...env, PEAK_MAIL_MOCK: 'http://127.0.0.1:' + MPORT, PEAK_MAIL_NOW: String(RUN), PEAK_MAIL_MX: 'skip', PEAK_MAIL_GAP: '0' };
      /* a connected mailbox (sealed the way oauth.php seals it) */
      fs.writeFileSync(path.join(R, 'seal.php'), "<?php require getenv('PEAK') . '/lib.php'; pmW('ms.json', ['email' => 'm.sharpe@peakpickleball.us', 'name' => 'Matthew', 'status' => 'ok', 'tok' => pmSeal(['r' => 'RT-1', 'a' => 'AT-1', 'x' => pmNow() + 3000]), 'at' => pmNow(), 'refreshed' => pmNow()]);");
      ok(spawnSync('php', [path.join(R, 'seal.php')], { env: { ...menv, PEAK } }).status === 0, 'mailbox connected (test seal)');
      /* the desk: Nneka claimed one company, Lance called another 3 days ago */
      const seed = JSON.parse(fs.readFileSync(path.join(DESKSRC, 'desk-seed.json'), 'utf8')).leads.filter(l => l.list !== 'renew' && (l.contacts || []).some(c => c.email));
      const own = seed[0], tch = seed[1];
      fs.writeFileSync(path.join(R, 'peak-desk-data', 'events.log'), jl([{ t: 'owner', id: own.id, owner: 'Nneka', by: 'Nneka', at: RUN - 3600, v: 2 },
        { t: 'touch', id: tch.id, k: 'tk00000009', touch: { m: 'call', out: 'noanswer', note: '', when: RUN - 3 * DAY }, by: 'Lance', at: RUN - 3 * DAY, v: 2 }]));
      const P = (a, b) => req(b === undefined ? 'GET' : 'POST', '/outbox-092b0f/peak/api.php?action=' + a, b, { Cookie: COOKIE, ...(b !== undefined ? { 'X-PM': '1' } : {}) });
      r = await P('import', {}); const dsp = r.json.diff.sponsors;
      ok(r.status === 200 && dsp.queued > 20 && dsp.skips.owned === 1 && dsp.skips.touched === 1, 'Bring the lists in again (inside Outbox): ' + dsp.queued + ' sponsors at ' + dsp.orgs + ' organisations; owned 1, touched 1 skipped');
      const LJ = JSON.parse(fs.readFileSync(path.join(R, 'peak-mail-data', 'lists.json'), 'utf8'));
      ok(!LJ.lists.sponsors.some(p => p.org === own.id || p.org === tch.id), 'the owned and the recently called company are not on the list');
      await P('template', { list: 'sponsors', subject: 'Outbox test for {company}', body: 'Hi {first},\n\nA test.\n\nhttps://peakpickleball.us/' });
      r = await P('start', { list: 'sponsors' }); ok(r.status === 200 && r.json.lists.sponsors.status === 'running', 'sponsors started (test only)');
      /* the hourly cron, through the old address's pointer as on the server, with the desk failing */
      const cron = extra => new Promise(res => { const p = spawn('php', [path.join(PUB, 'peak-mail-31dc56', 'cron.php'), 'run'], { env: { ...menv, ...extra } }); let o = ''; p.stdout.on('data', d => o += d); p.on('close', () => res(o)); });
      let o = await cron({ PEAK_MAIL_DESKFAIL: '1' });
      ok(MS.sent.length === 10 && MS.sent.every(x => x.mime) && /10 desk updates wait/.test(o), 'desk down: 10 sent anyway (multipart, with the open image), the desk waits: ' + o.trim());
      ok(MS.sent.every(x => x.box === 'partnerships@peakpickleball.us' && x.from === '"Peak Partnerships" <partnerships@peakpickleball.us>'), 'inside Outbox too, every email goes out as Peak Partnerships (2026-11-19)');
      r = await api('state'); ok(/10 updates have not reached the Peak desk/.test(r.json.summary.attention.map(a => a.text).join('\n')), 'Outbox flags the desk updates still waiting');
      o = await cron({ PEAK_MAIL_NOW: String(RUN + 1800) });
      fs.writeFileSync(path.join(R, 'desk-read.php'), "<?php require getenv('STORE'); echo json_encode(recs('sponsor'));");
      const D = JSON.parse(spawnSync('php', [path.join(R, 'desk-read.php')], { env: { ...env, STORE: path.join(PUB, 'peak-desk-28d38d', 'api', 'desk-store.php') } }).stdout.toString());
      const sent = fs.readFileSync(path.join(R, 'peak-mail-data', 'events.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(e => e.t === 'sent');
      ok(/desk: 10 caught up/.test(o) && MS.sent.length === 10, 'the next run catches the desk up and sends nothing twice: ' + o.trim());
      ok(sent.length === 10 && sent.every(e => D[e.org] && D[e.org].stage === 'emailed' && D[e.org].touches.filter(t => t.by === 'Peak email').length === 1), 'each company on the live-layout desk: one Emailed touch, stage Emailed');
      r = await api('state'); const PL = r.json.peak.lists.find(l => l.id === 'sponsors');
      ok(PL.sent === 10 && PL.people === dsp.queued && PL.skips.some(x => x[0] === 'owned by someone' && x[1] === 1) && PL.skips.some(x => /touched/.test(x[0]) && x[1] === 1) && 'open' in PL.rates, 'Outbox shows the list size, the rates and the skip counts');
      ok(!/updates have not reached/.test(r.json.summary.attention.map(a => a.text).join('\n')), 'and no desk warning once caught up');
      r = await req('GET', '/outbox-092b0f/peak/o.php?r=0000000000&s=0'); ok(r.status === 200 && /image\/gif/.test(r.headers['content-type']), 'the open image answers inside Outbox');
      r = await req('GET', '/outbox-092b0f/peak/b.php?r=0000000000&s=0'); ok(r.status === 200 && /did not work/.test(r.text), 'the book-a-time page answers inside Outbox (a bad link says so)');
      r = await api('state'); ok(r.json.peak.from && r.json.peak.from.email === 'partnerships@peakpickleball.us' && r.json.peak.from.shared && !r.json.peak.from.warn, 'Outbox says who the Peak emails go out as');
      /* a Send As refusal (2026-11-19) is said plainly in Outbox */
      fs.writeFileSync(path.join(R, 'peak-mail-data', 'from.json'), JSON.stringify({ sendas: { ok: false, why: '403 ErrorSendAsDenied: no right to send', at: RUN } }));
      r = await api('state'); ok(r.json.summary.attention.some(a => a.level === 'bad' && /^Peak email: Microsoft hasn't finished giving Send As yet, or it was removed: 403 ErrorSendAsDenied/.test(a.text)), 'a Send As refusal is flagged in Outbox in plain words');
      fs.unlinkSync(path.join(R, 'peak-mail-data', 'from.json'));
      await P('pause', { list: 'sponsors' });
    } finally { mock.close(); }
  }

  /* 10. the command line, and signing out */
  const sm = spawnSync('php', [path.join(PUB, 'outbox-092b0f', 'cli.php'), 'summary'], { env }); const smo = sm.stdout.toString();
  ok(sm.status === 0 && /^Outbox: sent today 11 \(Peak 3, Sixfold 3, Traverse 5\)/.test(smo) && /1 tour confirmation not sent/.test(smo) && /1 desk email not sent/.test(smo) && !smo.includes('NOT-A-REAL'), 'cli summary line');
  r = await api('signout', {}); ok(r.status === 200, 'sign out');
  r = await api('state'); ok(r.status === 401, 'signed out: refused again');
} finally {
  srv.kill();
}
console.log('\n' + pass + ' passed, ' + failN + ' failed  (throwaway data: ' + R + ')');
process.exit(failN ? 1 : 0);

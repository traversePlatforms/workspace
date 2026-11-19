/* Peak Sponsor Desk tests (2026-11-17 rebuild: two pipelines, touches, owners, follow-ups, the SQLite records, the email link).
   Each run makes a FRESH copy of desk-data-local in Temp, writes old-desk log rows into it (to migrate), starts its own PHP server on
   that copy (DESK_DATA), and deletes the copy at the end: nothing in desk-data-local changes, and a run never sees a previous run's data.
   node tests/desk-test.mjs            the server rules, the migration, the email link, the screens (headless Chrome)
   node tests/desk-test.mjs --page dist/index.html   the same against the minified page
   2026-11-18: plus the facelift (dark default, light mode, contrast measured on every screen) and the Sixfold tools: templates, the tries rule,
   Priority 5, duplicate warnings, Don't contact (with the email sender's own import), the end-of-day email (off) and the calendar feed.
   2026-11-19: tour confirmation emails, sent through the Peak email sender's own code (mail/public/lib.php) to a stand-in for Microsoft on
   127.0.0.1: nothing reaches Microsoft and nobody is emailed. */
import { spawn, execFileSync, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync, cpSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const pageArg = process.argv.indexOf('--page'); const PAGE = pageArg > 0 ? process.argv[pageArg + 1] : 'app/index.html';
/* the fresh copy: the research lists, accounts, scans; logs written below */
const LD = mkdtempSync(join(tmpdir(), 'peakdesk-')).replace(/\\/g, '/');
for (const f of ['seed.json', 'expo-seed.json', 'peak-records.json', 'accounts.json', 'scans.json']) if (existsSync(join(ROOT, 'desk-data-local', f))) copyFileSync(join(ROOT, 'desk-data-local', f), join(LD, f));
/* a web folder: the page under test plus the api */
const WEB = join(LD, 'web'); mkdirSync(WEB); cpSync(join(ROOT, 'app/api'), join(WEB, 'api'), { recursive: true });
copyFileSync(join(ROOT, PAGE), join(WEB, 'index.html')); for (const f of ['manifest.json', 'sw.js', 'icon-192.png']) copyFileSync(join(ROOT, 'app', f), join(WEB, f)); cpSync(join(ROOT, 'app/fonts'), join(WEB, 'fonts'), { recursive: true });
const env = { ...process.env, DESK_DATA: LD };
/* tour confirmations (2026-11-19): the Peak email sender's code from the repo, a throwaway mail-data folder "connected" to a stand-in for
   Microsoft that only records what it is given */
const MAILD = mkdtempSync(join(tmpdir(), 'pmtour-')).replace(/\\/g, '/');
writeFileSync(join(MAILD, 'app.json'), JSON.stringify({ client_id: '11111111-2222-3333-4444-555555555555', tenant: '66666666-7777-8888-9999-000000000000', secret: 'mock-secret-not-real' }));
const GM = { sent: [], calls: 0, fail: null };
const gmock = http.createServer((req, res) => { let bd = ''; req.on('data', (d) => (bd += d)); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && /\/oauth2\/v2.0\/token$/.test(u.pathname)) return j(200, { access_token: 'AT-2', refresh_token: 'RT-2', expires_in: 3600 });
  if (!/^Bearer AT-\d+$/.test(req.headers.authorization || '')) return j(401, { error: { code: 'InvalidAuthenticationToken' } });
  if (req.method === 'POST' && u.pathname === '/graph/v1.0/me/sendMail') { GM.calls++; if (GM.fail) return j(GM.fail.code, { error: { code: GM.fail.err, message: GM.fail.err } }); GM.sent.push(Buffer.from(bd, 'base64').toString('utf8')); res.writeHead(202); return res.end(); }
  j(404, { error: { code: 'NotFound' } }); }); });
await new Promise((r) => gmock.listen(0, '127.0.0.1', r));
Object.assign(env, { DESK_PEAK_MAIL_LIB: join(ROOT, 'mail/public/lib.php'), PEAK_MAIL_DATA: MAILD, PEAK_MAIL_MOCK: 'http://127.0.0.1:' + gmock.address().port });
const msConnect = (status = 'ok') => execFileSync('php', ['-r', 'require getenv("LIB"); pmW("ms.json", ["email" => "matthewsharpe@peakpickleball.us", "name" => "Matthew Sharpe", "status" => getenv("ST"), "tok" => pmSeal(["r" => "RT-1", "a" => "AT-1", "x" => time() + 3600]), "at" => time(), "refreshed" => time()]); echo "ok";'], { encoding: 'utf8', env: { ...env, LIB: env.DESK_PEAK_MAIL_LIB, ST: status } });
msConnect();
/* one MIME email into its parts (nested multiparts walked; base64 bodies decoded) */
const mimeParts = (raw) => { const out = []; const walk = (txt) => { const i = txt.indexOf('\r\n\r\n'), head = txt.slice(0, i), body = txt.slice(i + 4); const ct = (head.match(/Content-Type: ([^\r\n]+)/i) || [])[1] || ''; const bm = ct.match(/boundary="([^"]+)"/);
  if (bm) { for (const p of body.split('--' + bm[1]).slice(1, -1)) walk(p.replace(/^\r\n/, '')); } else out.push({ type: ct.split(';')[0].trim(), ct, head, body: /base64/i.test(head) ? Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8') : body }); };
  walk(raw); const top = raw.slice(0, raw.indexOf('\r\n\r\n')); const h = (k) => (top.match(new RegExp('^' + k + ': (.*)$', 'mi')) || [])[1] || '';
  const dec = (x) => x.replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, y) => Buffer.from(y, 'base64').toString('utf8'));
  const p = (t) => out.find((x) => x.type === t) || { body: '', ct: '', head: '' };
  return { to: h('To'), subject: dec(h('Subject')), top: h('Content-Type'), parts: out, text: p('text/plain').body, html: p('text/html').body, cal: p('text/calendar'), att: p('application/ics') }; };
const icsGet = (ics, k) => ((ics.replace(/\r\n /g, '').replace(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/, '').match(new RegExp('^' + k + '[:;](.*)$', 'm')) || [])[1] || '');
process.on('exit', () => { try { gmock.close(); } catch {} for (const d of cdpDirs.concat([LD, MAILD])) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const code = (f) => readFileSync(join(ROOT, 'desk-data-local', f), 'utf8').match(/(\d{6})/)[1];
const ADMIN = code('test-admin-code.txt'), SELLER = code('test-seller-code.txt');
const php = (args) => execFileSync('php', [join(WEB, 'api/desk.php'), ...args], { encoding: 'utf8', env });
const addAccount = (name, role) => php(['addaccount', name, role]).match(/(\d{6})/)[1];
const json = (f) => JSON.parse(readFileSync(join(LD, f), 'utf8'));
const lines = (f) => existsSync(join(LD, f)) ? readFileSync(join(LD, f), 'utf8').split('\n').filter(Boolean) : [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, failN = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { failN++; console.log('  FAIL ' + m); } };
const PORT = 8790 + Math.floor(Math.random() * 400), ORIGIN = `http://127.0.0.1:${PORT}`, API = ORIGIN + '/api/desk.php';
function client(extra = {}) { let ck = ''; const f = async (action, body, hdr = true) => { const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(body && hdr ? { 'X-Desk': '1' } : {}), ...(ck ? { Cookie: ck } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; const j = await r.json().catch(() => ({})); j._status = r.status; return j; }; return f; }
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => iso(new Date());
const later = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

/* ---- the old desk's rows, as on the live server today: Brandon's two "contacted" (29 Oct), plus the other old stages and a reply note
   the email sender wrote straight into the log ---- */
const seed = json('seed.json'), xseed = json('expo-seed.json'), precs = existsSync(join(LD, 'peak-records.json')) ? json('peak-records.json').leads : [];
const NEW = seed.leads.filter((l) => l.list === 'new'), B1 = NEW[5], B2 = NEW[6], OLDT = NEW[7], OLDNO = NEW[8], OLDNOTE = NEW[9];
const X1 = xseed.orgs[3], X2 = xseed.orgs[4], X3 = xseed.orgs[5];
const old = [
  { t: 'status', id: B1.id, status: 'contacted', by: 'Brandon Long', at: 1793294731 },
  { t: 'status', id: B2.id, status: 'contacted', by: 'Brandon Long', at: 1793295182 },
  { t: 'status', id: OLDT.id, status: 'toured', by: 'Matthew Sharpe', at: 1793300000 },
  { t: 'status', id: OLDNO.id, status: 'no', by: 'Matthew Sharpe', at: 1793300100 },
  { t: 'next', id: OLDT.id, next: { date: '2026-11-01', what: 'old follow-up' }, by: 'Matthew Sharpe', at: 1793300200 },
  { t: 'note', id: OLDNOTE.id, note: 'Pat replied to the Peak email from Matthew on Nov 17. The reply is in Matthew\'s Peak Outlook.', by: 'Peak email', at: 1793300300 }];
writeFileSync(join(LD, 'events.log'), old.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(LD, 'expo-events.log'), [
  { t: 'xstage', id: X1.id, stage: 'talking', by: 'Lance', at: 1793300000 }, { t: 'xstage', id: X2.id, stage: 'visit', by: 'Lance', at: 1793300001 },
  { t: 'xstage', id: X3.id, stage: 'notfit', by: 'Lance', at: 1793300002 }].map((r) => JSON.stringify(r)).join('\n') + '\n');
const log0 = readFileSync(join(LD, 'events.log'), 'utf8');

let server, chrome, ws;
try {
  console.log('Migration (the old desk\u2019s lists and logs into the records)');
  const chk = JSON.parse(php(['check']));
  const peakNew = precs.filter((p) => !seed.leads.some((l) => l.id === p.id)).length;
  ok(chk.sponsor.companies === seed.leads.length + peakNew, `every sponsor company came across: ${chk.sponsor.companies} (${seed.leads.length} researched + ${peakNew} from Peak\u2019s tracker)`);
  /* contacts: the seed's, plus each tracker email the seed lacked, once */
  let wantC = 0; const byId = Object.fromEntries(seed.leads.map((l) => [l.id, l.contacts.map((c) => (c.email || '').toLowerCase())]));
  seed.leads.forEach((l) => { wantC += l.contacts.length; });
  precs.forEach((p) => { const have = byId[p.id] || []; byId[p.id] = have; (p.contacts || []).forEach((c) => { if (c.email && !have.includes(c.email.toLowerCase())) { wantC++; have.push(c.email.toLowerCase()); } }); });
  ok(chk.sponsor.contacts === wantC, `every contact came across: ${chk.sponsor.contacts} of ${wantC}`);
  ok(chk.expo.companies === xseed.orgs.length && chk.expo.contacts === xseed.orgs.reduce((n, o) => n + o.contacts.length, 0), `every expo lead and contact came across: ${chk.expo.companies} organisations, ${chk.expo.contacts} contacts`);
  ok(chk.sponsor.stages.called === 2 && chk.sponsor.stages.meeting === 1 && chk.sponsor.stages.lost === 1 && chk.expo.stages.contacted === 1 && chk.expo.stages.tour === 1 && chk.expo.stages.lost === 1, 'old stages read as new: Contacted \u2192 Called, Toured \u2192 Meeting / tour booked, No \u2192 Lost; Talking \u2192 Contacted, Site visit \u2192 Tour booked, Not a fit \u2192 Lost');
  ok(existsSync(join(LD, 'desk.sqlite')) && readFileSync(join(LD, 'events.log'), 'utf8') === log0, 'the records are in desk.sqlite and the old log is not rewritten');

  console.log('The server');
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', WEB], { env, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/manifest.json'); break; } catch { await sleep(100); } }
  const x = client();
  ok((await x('data'))._status === 401, 'signed out: no data');
  ok((await x('signin', { code: '000000' }))._status === 401, 'a wrong code is refused');
  const a = client(), b = client();
  ok((await a('signin', { code: ADMIN })).role === 'admin', 'the admin signs in');
  ok((await b('signin', { code: SELLER })).role === 'seller', 'the seller signs in');
  const SELLER2 = addAccount('Second Seller', 'seller'), c2 = client(); await c2('signin', { code: SELLER2 });
  let D = await b('data'); const SP = () => D.sponsor, XP = () => D.expo, find = (w, id) => D[w].recs.find((r) => r.id === id);
  ok(D.ok && D.sponsor.recs.length === chk.sponsor.companies && D.expo.recs.length === chk.expo.companies && D.build, `the data: ${D.sponsor.recs.length} sponsor companies, ${D.expo.recs.length} expo leads, build ${D.build}`);
  ok(D.sponsor.stages.map((s) => s[1]).join('|') === 'To contact|Called|Left voicemail|Emailed|Texted|Meeting / tour booked|Proposal sent|Signed|Not now|Lost', 'sponsor stages: To contact \u2192 Called \u2192 Left voicemail \u2192 Emailed \u2192 Texted \u2192 Meeting / tour booked \u2192 Proposal sent \u2192 Signed; Not now; Lost');
  ok(D.expo.stages.map((s) => s[1]).join('|') === 'To contact|Contacted|Tour booked|Quote sent|Booked|Not now|Lost', 'expo stages: To contact \u2192 Contacted \u2192 Tour booked \u2192 Quote sent \u2192 Booked; Not now; Lost');
  let r1 = find('sponsor', B1.id), r2 = find('sponsor', B2.id);
  ok(r1.stage === 'called' && r1.last && r1.last.by === 'Brandon Long' && r1.last.when === 1793294731 && r1.last.m === 'other' && r2.last.when === 1793295182 && r1.hist[0].by === 'Brandon Long', 'Brandon\u2019s two (29 Oct) are intact: Called, a touch by Brandon Long at the same minute, in the history');
  ok(find('sponsor', OLDNO.id).lost.why === 'Said no' && find('expo', X3.id).lost.why === 'Not a fit', 'an old No or Not a fit keeps its reason as Lost');
  ok(find('sponsor', OLDNOTE.id).notes.some((n) => n.by === 'Peak email' && /replied/.test(n.note)), 'the email sender\u2019s reply note (written straight into the log) shows on the card');
  ok(D.sponsor.owners.includes('Test Seller') && D.sponsor.owners.includes('Matthew Sharpe') && !D.sponsor.owners.includes('Claude Check'), 'owners are the sellers and admins');
  const K = NEW.find((l) => l.name === 'Kaiser Permanente') || NEW[0];
  ok((await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'noanswer' }, false))._status === 400, 'a post without the desk header is refused');

  console.log('Touches move a company along, set an owner, follow-ups');
  let t = await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'noanswer' });
  ok(t.ok && t.stage === 'called' && t.owner === 'Test Seller' && t.tries === 1, 'No answer: To contact \u2192 Called; the first person to reach out owns it; 1 try');
  t = await b('touch', { world: 'sponsor', id: K.id, m: 'voicemail', out: 'left', note: 'asked for Cary' });
  ok(t.stage === 'voicemail' && t.tries === 2, 'Left voicemail \u2192 Left voicemail; 2 tries in a row');
  t = await c2('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'noanswer' });
  ok(t.stage === 'voicemail' && t.owner === 'Test Seller' && t.tries === 3, 'a later call never moves it back, and another seller\u2019s touch leaves the owner; 3 tries');
  t = await b('touch', { world: 'sponsor', id: K.id, m: 'email', out: 'sent', fu: later(3), fuWhat: 'call Cary' });
  D = await b('data'); let k1 = find('sponsor', K.id);
  ok(t.stage === 'emailed' && k1.next.date === later(3) && k1.next.what === 'call Cary' && k1.touches.length === 4 && k1.last.m === 'email', 'Emailed \u2192 Emailed, with the follow-up set; four touches kept, the last an email');
  t = await b('touch', { world: 'sponsor', id: K.id, m: 'text', out: 'sent' });
  D = await b('data'); k1 = find('sponsor', K.id);
  ok(t.stage === 'texted' && k1.next.date === later(3), 'Texted \u2192 Texted; a follow-up ahead is kept when no new one is set');
  ok((await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'talked' })).tries === 0, 'Talked resets the tries');
  await b('next', { world: 'sponsor', id: K.id, date: today(), what: 'due today' });
  await b('touch', { world: 'sponsor', id: K.id, m: 'linkedin', out: 'sent' });
  D = await b('data'); k1 = find('sponsor', K.id);
  ok(k1.next === null && k1.stage === 'texted', 'reaching out clears a follow-up that was due (it is done); LinkedIn does not move a company past Texted');
  ok((await b('touch', { world: 'sponsor', id: K.id, m: 'fax', out: 'sent' })).error === 'Pick how you reached them.' && (await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'sent' })).error === 'Pick how it went.' && (await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'talked', fu: '2020-01-01' })).error === 'Pick a follow-up day from today on.' && (await b('touch', { world: 'sponsor', id: K.id, m: 'call', out: 'talked', when: 1000 })).error === 'Pick a time in the last 30 days.', 'a wrong method, outcome, past follow-up or old time is refused');
  /* two days ago, but never this week (the week counts below leave it out): on a Tuesday that is Sunday, on a Wednesday it would be Monday */
  const wk0 = new Date(); wk0.setHours(0, 0, 0, 0); wk0.setDate(wk0.getDate() - ((wk0.getDay() + 6) % 7));
  const earlier = Math.min(Math.floor(Date.now() / 1000) - 2 * 86400, Math.floor(wk0.getTime() / 1000) - 3600);
  ok((await b('touch', { world: 'sponsor', id: K.id, m: 'inperson', out: 'met', when: earlier, note: 'at the chamber lunch' })).ok && (await b('data')).sponsor.recs.find((r) => r.id === K.id).touches.some((x) => x.when === earlier && x.m === 'inperson'), 'a touch can be logged for earlier (met at a lunch two days ago)');
  /* undo */
  const U = NEW[12]; t = await b('touch', { world: 'sponsor', id: U.id, m: 'call', out: 'noanswer' });
  ok(t.stage === 'called' && (await b('touchdel', { world: 'sponsor', id: U.id, k: t.k })).stage === 'new', 'Undo removes the touch and puts the stage back');
  D = await b('data'); ok(find('sponsor', U.id).touches.length === 0 && lines('events.log').some((l) => l.includes('"touchdel"')), 'the card shows no touch; the log keeps it and the undo');
  ok((await b('touchdel', { world: 'sponsor', id: U.id, k: t.k }))._status === 404, 'undoing twice is refused');
  /* owners */
  ok((await b('owner', { world: 'sponsor', id: U.id, owner: 'Nobody Here' })).error === 'Pick someone on the desk.', 'an owner must be someone on the desk');
  ok((await b('owner', { world: 'sponsor', id: U.id, owner: 'Second Seller' })).ok && (await b('data')).sponsor.recs.find((r) => r.id === U.id).owner === 'Second Seller', 'an owner is set');
  ok((await b('owner', { world: 'sponsor', id: U.id, owner: '' })).ok && (await b('data')).sponsor.recs.find((r) => r.id === U.id).owner === '', 'and cleared (Open)');
  /* stages with what they need */
  const NN = NEW[13], LL = NEW[14];
  ok((await b('stage', { world: 'sponsor', id: NN.id, stage: 'notnow' })).error === 'Pick the day to come back to them.', 'Not now needs a day to come back');
  ok((await b('stage', { world: 'sponsor', id: NN.id, stage: 'notnow', back: later(40), why: 'budget set in January' })).ok, 'Not now with a day and a reason');
  ok((await b('stage', { world: 'sponsor', id: LL.id, stage: 'lost' })).error === 'Say why it was lost.' && (await b('stage', { world: 'sponsor', id: LL.id, stage: 'lost', why: 'Went with someone else' })).ok, 'Lost needs a reason');
  D = await b('data');
  ok(find('sponsor', NN.id).stage === 'notnow' && find('sponsor', NN.id).next.date === later(40) && /budget/.test(find('sponsor', NN.id).next.what) && find('sponsor', LL.id).lost.why === 'Went with someone else', 'Not now sets the follow-up to the day to come back; Lost keeps why');
  ok((await b('stage', { world: 'sponsor', id: NN.id, stage: 'wrong' })).error === 'Pick a stage.', 'a stage that does not exist is refused');
  /* tours, proposals, signed */
  const TT = NEW[15];
  const tr = await b('tour', { world: 'sponsor', id: TT.id, lead: TT.id, date: later(2), time: '10:30', who: 'Pat' });
  ok(tr.ok && (await b('data')).sponsor.recs.find((r) => r.id === TT.id).stage === 'meeting', 'a tour booked moves it to Meeting / tour booked');
  ok((await b('tour', { world: 'sponsor', id: TT.id, date: '2020-01-01', time: '10:00' })).error === 'Pick today or a later day.', 'a tour in the past is refused');
  ok((await b('tourmove', { world: 'sponsor', tid: tr.tid, date: later(4), time: '14:00' })).ok && (await b('data')).sponsor.tours.find((x) => x.tid === tr.tid).date === later(4), 'a tour moves');
  ok((await b('tourout', { world: 'sponsor', tid: tr.tid, out: 'toured' })).ok && (await b('data')).sponsor.recs.find((r) => r.id === TT.id).last.out === 'toured', 'They came: logged as an in-person touch (Toured Peak)');
  ok((await b('packages', { packages: [{ name: 'Court sponsor', price: 12000, per: 'year' }, { name: 'Title sponsor', price: 24000, per: 'year' }] })).ok, 'packages save');
  const pr = await b('proposal', { world: 'sponsor', lead: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], to: 'Pat, Marketing', note: 'Two courts' });
  ok(pr.ok && pr.total === 24500 && (await b('data')).sponsor.recs.find((r) => r.id === TT.id).stage === 'proposal', 'a proposal: $24,500, and it moves to Proposal sent');
  ok((await b('signed', { world: 'sponsor', id: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }], start: 'x', months: 12 })).error === 'Pick the start date.', 'Signed needs a start date');
  ok((await b('signed', { world: 'sponsor', id: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], start: today(), months: 12, who: 'Pat' })).ok, 'a sponsor is signed');
  ok((await b('todo', { id: TT.id, text: 'Logo on court 7' })).ok && (await b('pl', { services: [{ name: 'Court sponsor', price: 12000, per: 'year', cost: 1500, costPer: 'year' }], running: [{ name: 'Hosting', amount: 20, per: 'month' }] })).ok, 'to-dos and the P&L save');
  D = await b('data'); ok(find('sponsor', TT.id).stage === 'signed' && find('sponsor', TT.id).signed.total === 24500 && D.sponsor.pl.services[0].cost === 1500, 'Signed: $24,500, P&L kept');
  const spn = await b('sponsor', { name: 'Test Sponsor Co', kind: 'Dentist', cname: 'Sam', cemail: 'sam@example.com', start: today(), months: 6, lines: [] });
  D = await b('data'); ok(spn.ok && find('sponsor', spn.id).stage === 'signed' && find('sponsor', spn.id).list === 'added' && find('sponsor', spn.id).owner === 'Test Seller', 'a new sponsor in one step: Signed, Added on the desk, owned by whoever added it');
  ok((await b('add', { world: 'sponsor', name: K.name })).error === 'That company is already on the list.', 'a company already on the list is not added twice');
  /* remove, bring back */
  ok((await b('del', { world: 'sponsor', id: spn.id })).ok && (await b('touch', { world: 'sponsor', id: spn.id, m: 'call', out: 'talked' }))._status === 409, 'a removed company takes no touch');
  D = await b('data'); ok(!find('sponsor', spn.id) && D.sponsor.removed.some((r) => r.id === spn.id), 'removed: off the lists, under Removed');
  ok((await b('back', { world: 'sponsor', id: spn.id })).ok && (await b('data')).sponsor.recs.find((r) => r.id === spn.id).stage === 'signed', 'brought back, still Signed');
  /* the old action names still work (a page left open from before) */
  const OLDP = NEW[16];
  ok((await b('status', { id: OLDP.id, status: 'contacted' })).ok && (await b('data')).sponsor.recs.find((r) => r.id === OLDP.id).stage === 'called', 'old page: status Contacted \u2192 Called');

  console.log('Expo leads: the same treatment');
  const XA = xseed.orgs[10], XB = xseed.orgs[11];
  t = await b('touch', { world: 'expo', id: XA.id, m: 'call', out: 'noanswer' });
  ok(t.ok && t.stage === 'contacted' && t.owner === 'Test Seller', 'a touch moves an expo lead To contact \u2192 Contacted and sets the owner');
  const xt = await b('tour', { world: 'expo', id: XA.id, date: later(5), time: '11:00', who: 'Show manager' });
  D = await b('data');
  ok(xt.ok && find('expo', XA.id).stage === 'tour' && D.expo.tours.some((x) => x.tid === xt.tid) && !D.sponsor.tours.some((x) => x.tid === xt.tid), 'an expo tour: Tour booked, in the expo tours only');
  ok((await b('stage', { world: 'expo', id: XA.id, stage: 'quote', amount: '$4,500', note: 'two days, main hall' })).ok && (await b('data')).expo.recs.find((r) => r.id === XA.id).quote.amount === 4500, 'Quote sent with the amount');
  ok((await b('stage', { world: 'expo', id: XA.id, stage: 'booked', date: later(60), amount: 4500 })).ok && (await b('data')).expo.recs.find((r) => r.id === XA.id).booked.date === later(60), 'Booked with the event date');
  ok((await b('stage', { world: 'expo', id: XB.id, stage: 'notnow', back: later(20) })).ok && (await b('xnote', { id: XB.id, note: 'old page note' })).ok, 'expo Not now; the old xnote action still works');
  ok((await b('stage', { world: 'expo', id: XB.id, stage: 'meeting' })).error === 'Pick a stage.', 'a sponsor stage is not an expo stage');
  ok(lines('events.log').every((l) => !l.includes(XA.id)) && lines('expo-events.log').every((l) => !l.includes(K.id)), 'expo rows only in expo-events.log, sponsor rows only in events.log');
  /* kept from the 13 Nov expo build */
  D = await b('data');
  ok(D.expo.questions.length === 10 && D.expo.venues.length >= 8, `the questions for Peak (${D.expo.questions.length}) and competing venues (${D.expo.venues.length}) still come with the expo data`);
  const TRI = D.expo.recs.find((o) => o.name === 'Tri-Lakes Chamber of Commerce');
  ok(TRI && TRI.pri === 1 && TRI.people.some((p) => p.name === 'Terri Hayes' && p.estat === 'published' && p.conf === 'high' && p.best && /Venue research/.test(p.src)), 'an expo contact keeps its email status, confidence, best route and where it came from');
  ok(K && find('sponsor', K.id).people.every((p) => p.src) && D.sponsor.recs.some((r) => r.people.some((p) => /^\d+%$/.test(p.conf))), 'every sponsor contact says where it came from, Hunter ones with their confidence');
  ok((await b('add', { world: 'expo', name: 'tri-lakes chamber of commerce' })).error === 'That organisation is already in the Expo leads.', 'an expo lead already there is not added twice');
  const xn = await b('add', { world: 'expo', name: 'Test Expo Promoter', cat: 'Home & garden shows', pri: 1, site: 'example.com', cname: 'Sam Show', email: 'sam@example.com' });
  D = await b('data'); const xadd = find('expo', xn.id);
  ok(xn.ok && /^x[0-9a-f]{9}$/.test(xn.id) && xadd.site === 'https://example.com' && xadd.people.some((p) => p.email === 'sam@example.com' && p.added) && xadd.owner === 'Test Seller', 'an expo lead added by hand: its contact, its website, owned by whoever added it');
  ok((await b('xdel', { id: xn.id })).ok && (await b('touch', { world: 'expo', id: xn.id, m: 'call', out: 'talked' })).error === 'That lead was removed. Bring it back first.' && (await b('xback', { id: xn.id })).ok, 'old expo Remove and Bring back still work; a removed lead takes no touch');
  ok((await b('xstage', { id: XB.id, stage: 'visit' })).ok && (await b('data')).expo.recs.find((r) => r.id === XB.id).stage === 'tour', 'old page: Site visit booked → Tour booked');
  ok((await b('del', { world: 'expo', id: xn.id })).ok, 'removed again (for the screens)');
  await b('contact', { world: 'sponsor', id: K.id, name: 'Pat Test', role: 'Marketing', email: 'pat@example.com' });
  ok((await b('contact', { world: 'sponsor', id: K.id, name: 'Pat Test', email: 'not-an-email' })).error === 'That email does not look right.', 'a bad email is refused');
  await b('note', { world: 'sponsor', id: K.id, note: '<img src=x onerror=alert(1)> called the front desk' });
  ok((await b('site', { id: K.id, site: 'http://127.0.0.1/' })).error === 'That website does not look right.', 'a bad website is refused');

  console.log('Counts per person this week');
  D = await b('data'); const wk = D.sponsor.week['Test Seller'] || {}, wk2 = D.sponsor.week['Second Seller'] || {};
  ok(wk.calls === 3 && wk.vms === 1 && wk.emails === 1 && wk.texts === 1 && wk.other === 2 && wk2.calls === 1, `this week: Test Seller ${wk.calls} calls (a voicemail counts as a call), ${wk.emails} email, ${wk.texts} text, ${wk.other} other (LinkedIn, in person); Second Seller ${wk2.calls} call; the undone call is not counted`);
  ok(wk.tours === 1 && wk.proposals === 1 && wk.signed === 2 && (D.expo.week['Test Seller'] || {}).tours === 2, 'tours, proposals and signed count companies; expo counts are their own');
  ok(D.sponsor.team['Brandon Long'] && D.sponsor.team['Brandon Long'].other === 2 && !D.sponsor.week['Brandon Long'], 'Brandon\u2019s two count in his all-time numbers, not this week');

  console.log('Roles');
  const EXPO = addAccount('Test Expo', 'expo'), CHECK = addAccount('Claude Check', 'admin');
  const ex = client(); ok((await ex('signin', { code: EXPO })).role === 'expo', 'the expo-only account signs in');
  const XJ = await ex('data');
  ok(XJ.ok && !XJ.sponsor && XJ.expo.recs.length === D.expo.recs.length && !JSON.stringify(XJ).includes(K.name), 'it gets the Expo leads and nothing of the sponsors\u2019');
  ok(XJ.expo.owners.includes('Test Expo') && !(await b('data')).sponsor.owners.includes('Test Expo'), 'it can own expo leads, never sponsors');
  const deny = [['touch', { world: 'sponsor', id: K.id, m: 'call', out: 'talked' }], ['stage', { world: 'sponsor', id: K.id, stage: 'new' }], ['owner', { id: K.id, owner: '' }], ['note', { id: K.id, note: 'x' }], ['packages', { packages: [] }], ['pl', { services: [] }], ['scan', { id: K.id, world: 'expo' }], ['proposal', { lead: K.id, world: 'expo', lines: [] }], ['status', { id: K.id, status: 'new' }], ['tour', { id: K.id, date: today(), time: '10:00' }], ['del', { id: K.id }]];
  let denied = 0; for (const [act, body] of deny) if ((await ex(act, body))._status === 403) denied++;
  ok(denied === deny.length, `every sponsor action is refused to it (403 on ${denied} of ${deny.length})`);
  ok((await ex('touch', { world: 'expo', id: XB.id, m: 'email', out: 'sent' })).ok, 'it logs touches on expo leads');
  const cc = client(); await cc('signin', { code: CHECK }); const CJ = await cc('data');
  ok(CJ.ok && CJ.sponsor.recs.length > 0 && CJ.expo.recs.length > 0, 'Claude Check reads both lists');
  const ccw = [['touch', { world: 'sponsor', id: K.id, m: 'call', out: 'talked' }], ['touch', { world: 'expo', id: XB.id, m: 'call', out: 'talked' }], ['owner', { world: 'sponsor', id: K.id, owner: '' }], ['stage', { world: 'expo', id: XB.id, stage: 'lost', why: 'x' }], ['emailed', { world: 'sponsor', id: K.id, to: 'a@b.co' }]];
  let ccd = 0; for (const [act, body] of ccw) if ((await cc(act, body))._status === 403) ccd++;
  ok(ccd === ccw.length, `Claude Check saves nothing (403 on ${ccd} of ${ccw.length})`);
  ok((await a('touch', { world: 'sponsor', id: NEW[20].id, m: 'call', out: 'talked' })).owner === 'Test Admin', 'the admin works the desk like a seller');

  console.log('The email link (for the Peak email sender)');
  const KEY = php(['servicekey', 'Peak email']).match(/: ([0-9a-f]{48})/)[1];
  const sv = client({ 'X-Desk-Key': KEY }), bad = client({ 'X-Desk-Key': 'nope' });
  const EM = NEW[21], EX = xseed.orgs[20];
  ok((await bad('emailed', { world: 'sponsor', id: EM.id, to: 'a@example.com' }))._status === 401 && (await x('emailed', { world: 'sponsor', id: EM.id, to: 'a@example.com' }))._status === 401, 'a wrong key, or no key and no sign-in, is refused');
  let e1 = await sv('emailed', { world: 'sponsor', id: EM.id, to: 'pat@example.com', subject: 'Court sponsorship at Peak', ref: 'msg-1' });
  D = await b('data'); let em = find('sponsor', EM.id);
  ok(e1.ok && e1.stage === 'emailed' && em.last.m === 'email' && em.last.by === 'Peak email' && em.last.auto && em.owner === '' && /pat@example.com/.test(em.last.note), 'emailed: To contact \u2192 Emailed, a touch by "Peak email" (automatic) with who it went to; nobody becomes owner');
  ok((await sv('emailed', { world: 'sponsor', id: EM.id, to: 'pat@example.com', ref: 'msg-1' })).dup === true && (await b('data')).sponsor.recs.find((r) => r.id === EM.id).touches.length === 1, 'the same message again (same ref) is not logged twice');
  ok((await sv('emailed', { world: 'expo', id: EX.id, to: 'show@example.com', ref: 'msg-2' })).stage === 'contacted', 'an expo lead: To contact \u2192 Contacted');
  ok((await sv('emailed', { world: 'sponsor', id: 'zzzzzzzzzz', to: 'a@example.com' }))._status === 404 && (await sv('emailed', { world: 'sponsor', id: EM.id, to: 'not-an-email' }))._status === 400, 'a wrong company or address is refused');
  ok((await sv('emailreply', { world: 'sponsor', id: EM.id, from: 'Pat', note: 'Interested, call me', ref: 'r-1' })).ok, 'emailreply logs the reply');
  D = await b('data'); em = find('sponsor', EM.id);
  ok(em.last.out === 'replied' && em.next.date === today() && /replied/.test(em.next.what), 'a reply: a touch (replied) and a follow-up today, so it shows on Today');
  ok((await sv('touch', { world: 'sponsor', id: EM.id, m: 'call', out: 'talked' }))._status === 401, 'the key only opens the two email actions');
  const cli = JSON.parse(php(['emailed', 'sponsor', NEW[22].id, 'x@example.com', 'Hello']));
  ok(cli.ok && cli.stage === 'emailed', 'the same from the command line (php desk.php emailed sponsor <id> <to> [subject])');
  /* STOP and bounces (2026-11-18) */
  D = await b('data');
  const ST = NEW.find((l) => { const r = find('sponsor', l.id); return r && r.stage === 'new' && !r.owner && !r.next; }), OWN = NEW[20];   /* one nobody has touched or taken */
  let so = await sv('emailreply', { world: 'sponsor', id: ST.id, from: 'Sam', note: 'STOP', ref: 'stop-1', stop: true });
  D = await b('data'); let stc = find('sponsor', ST.id);
  const cST = so.ok && so.stage === 'notnow' && stc.notnow && stc.notnow.back === later(90) && /not to be emailed/i.test(stc.notnow.why) && stc.next.date === later(90) && stc.last.out === 'replied';
  ok(cST, 'a STOP from a company nobody has taken: Not now, back in 90 days, with the reason; the touch is kept' + (cST ? '' : ' GOT ' + JSON.stringify({ so, stage: stc.stage, owner: stc.owner, notnow: stc.notnow, next: stc.next, last: stc.last })));
  ok((await sv('emailreply', { world: 'sponsor', id: ST.id, from: 'Sam', ref: 'stop-1', stop: true })).dup === true, 'the same STOP again (same ref) is not logged twice');
  so = await sv('emailreply', { world: 'sponsor', id: OWN.id, from: 'Lee', ref: 'stop-2', stop: true });
  D = await b('data'); stc = find('sponsor', OWN.id);
  ok(so.ok && stc.stage === 'called' && stc.owner === 'Test Admin' && stc.next && stc.next.date <= today() && /not to be emailed/.test(stc.next.what), 'a STOP on a company a person owns: the stage stays, the owner gets a follow-up today');
  so = await sv('emailreply', { world: 'expo', id: xseed.orgs[21].id, from: 'Kim', ref: 'stop-3', stop: true });
  ok(so.ok && so.stage === 'notnow', 'a STOP on an expo lead: Not now too');
  const BO = NEW[22];
  let bo = await sv('emailbounce', { world: 'sponsor', id: BO.id, to: 'x@example.com', ref: 'bounce-1' });
  D = await b('data'); let boc = find('sponsor', BO.id);
  ok(bo.ok && boc.stage === 'emailed' && boc.last.m === 'email' && boc.last.out === 'bounced' && boc.last.auto && /x@example.com/.test(boc.last.note), 'emailbounce: a Bounced touch (automatic), the stage stays');
  ok((await sv('emailbounce', { world: 'sponsor', id: BO.id, to: 'x@example.com', ref: 'bounce-1' })).dup === true && (D = await b('data')) && find('sponsor', BO.id).touches.filter((t) => t.out === 'bounced').length === 1, 'the same bounce again (same ref) is not logged twice');
  const cb = JSON.parse(php(['bounced', 'expo', EX.id, 'show@example.com']));
  ok(cb.ok && cb.stage === 'contacted', 'the same from the command line (php desk.php bounced expo <id> <to>)');
  /* the sender reads the log itself: what it sees must match the desk */
  const replay = {}; for (const l of lines('events.log')) { const r = JSON.parse(l); if (r.t === 'status') replay[r.id] = r.status; }
  ok(replay[EM.id] === 'emailed' && replay[K.id] && replay[K.id] !== 'new' && !replay[NEW[30].id], 'the sender\u2019s own reading of events.log sees the stage (Emailed, Texted ...) and skips them; untouched companies stay new to it');
  ok(lines('events.log').every((l) => { try { JSON.parse(l); return true; } catch { return false; } }), 'every log line is whole JSON');

  /* ---- 2026-11-18: the Sixfold tools ---- */
  console.log('Message templates (Sixfold’s)');
  D = await b('data');
  const ST6 = D.sponsor.templates, XT6 = D.expo.templates;
  ok(ST6.length === 6 && ST6.every((t) => t.starter) && ST6.map((t) => t.k).join(',') === 'first,vm,tour,proposal,thanks,last', 'six starter templates for sponsors, marked as starters: first outreach, after a voicemail, tour confirmation, proposal follow-up, thank-you after a tour, last try');
  ok(XT6.length === 6 && /event/i.test(XT6[0].body) && /80,000 square feet/.test(XT6[0].body) && !/sponsor/i.test(XT6.map((t) => t.text + t.body).join(' ')), 'the expo starters talk about holding an event, not sponsoring');
  const allTxt = ST6.concat(XT6).map((t) => t.text + ' ' + t.subject + ' ' + t.body).join(' ');
  ok(!/\$\s?\d|\bprice|\bcost|\bfree\b|largest|only indoor|first group/i.test(allTxt) && (allTxt.match(/\{(\w+)\}/g) || []).every((f) => ['{first}', '{company}', '{tour}', '{me}'].includes(f)), 'no prices, no "largest"/"first group" claims; only the four merge fields');
  ok(/24 courts on two levels/.test(ST6[0].body) && /Chapel Hills Mall/.test(ST6[0].text) && /\{tour\}/.test(ST6[2].text), 'the starters use the checked facts (24 courts on two levels, Chapel Hills Mall); the tour one carries {tour}');
  ok((await b('templates', { world: 'sponsor', templates: ST6 }))._status === 403, 'a seller cannot change the templates');
  const edited = ST6.map((t) => t.k === 'vm' ? { ...t, text: t.text + ' Thanks!' } : t);
  let tsv = await a('templates', { world: 'sponsor', templates: edited });
  D = await b('data');
  ok(tsv.ok && D.sponsor.templates.find((t) => t.k === 'vm').text.endsWith('Thanks!') && !D.sponsor.templates.find((t) => t.k === 'vm').starter && D.sponsor.templates.find((t) => t.k === 'first').starter && D.expo.templates.every((t) => t.starter), 'the admin edits one: it is no longer marked a starter, the others still are, the expo ones untouched');
  ok((await a('templates', { world: 'sponsor', templates: [{ name: 'Bad', text: 'Hi {first}, it costs {price}' }] })).error === '“Bad” has {price} in it. The fields are {first}, {company}, {tour} and {me}.', 'an unknown merge field is refused');
  ok((await a('templates', { world: 'sponsor', reset: 1 })).ok && (await b('data')).sponsor.templates.every((t) => t.starter), 'Go back to the starters');
  const LOC = seed.leads.filter((l) => l.list === 'local'), TP = LOC[12];
  t = await b('touch', { world: 'sponsor', id: TP.id, m: 'text', out: 'sent', tpl: 'first', note: 'From the template “First outreach”' });
  D = await b('data');
  ok(t.ok && find('sponsor', TP.id).last.tpl === 'first' && find('sponsor', TP.id).last.m === 'text' && find('sponsor', TP.id).last.by === 'Test Seller' && (await b('touch', { world: 'sponsor', id: TP.id, m: 'text', out: 'sent', tpl: 'NOT ok!' })).error === 'No such template.', 'a template sent is logged as Texted, from the template, by that person; a bad template key is refused');

  console.log('The call-tries rule (Sixfold’s: 4 tries, then a last message and Not now for 60 days)');
  ok(D.tries.max === 4 && D.tries.back === 60 && /^\d{4}-\d{2}-\d{2}$/.test(D.nextBiz) && D.nextBiz > today() && ![0, 6].includes(new Date(D.nextBiz + 'T12:00').getDay()), `the desk says 4 tries, 60 days, and the next working day (${D.nextBiz})`);
  const LOCP = LOC.filter((l) => l.phone), T4 = LOCP[20];
  for (let i = 0; i < 4; i++) t = await b('touch', { world: 'sponsor', id: T4.id, m: i === 1 ? 'voicemail' : 'call', out: i === 1 ? 'left' : 'noanswer', fu: D.nextBiz });
  D = await b('data');
  ok(t.tries === 4 && find('sponsor', T4.id).stage === 'voicemail' && find('sponsor', T4.id).next.date === D.nextBiz, '4 misses in a row (a voicemail counts): 4 tries, and nothing moved it to Not now by itself');

  console.log('Duplicate warnings (Sixfold’s lead doubles)');
  const DUP = LOC[10];
  let du = await b('add', { world: 'sponsor', name: DUP.name.toUpperCase() + ', LLC', kind: 'Test' });
  ok(du._status === 409 && du.dupes.some((x) => x.id === DUP.id && /the same name/.test(x.why)), 'the same name with LLC and other capitals: a warning, nothing added');
  du = await b('add', { world: 'sponsor', name: 'Totally Different Clinic', phone: '(' + DUP.phone.replace(/\D/g, '').slice(-10, -7) + ') ' + DUP.phone.replace(/\D/g, '').slice(-7, -4) + '-' + DUP.phone.replace(/\D/g, '').slice(-4) });
  ok(du._status === 409 && du.dupes.some((x) => x.id === DUP.id && /the same phone/.test(x.why)), 'the same phone written another way: a warning');
  du = await b('add', { world: 'sponsor', name: 'Another Name Again', site: 'http://www.' + DUP.site.replace(/^https?:\/\/(www\.)?/, '') });
  ok(du._status === 409 && du.dupes.some((x) => x.id === DUP.id && /the same website/.test(x.why)), 'the same website: a warning');
  const fbp = await b('add', { world: 'sponsor', name: 'Fb Page Co', site: 'https://www.facebook.com/somepage' }); ok(fbp.ok, 'a Facebook page is not counted as the same website');
  const kb = await b('add', { world: 'sponsor', name: 'Totally Different Clinic', phone: DUP.phone, keep: 1 });
  D = await b('data');
  ok(kb.ok && find('sponsor', kb.id) && find('sponsor', kb.id).name === 'Totally Different Clinic', 'Keep both: added anyway');
  await b('del', { world: 'sponsor', id: kb.id }); await b('del', { world: 'sponsor', id: fbp.id });   /* off the desk again, so the screens below see the same lists */
  const mg = await b('add', { world: 'sponsor', name: DUP.name + ' Inc', phone: '719-555-0142', site: 'example.org', why: 'met them at the expo', merge: DUP.id });
  D = await b('data'); const dupR = find('sponsor', DUP.id);
  ok(mg.ok && mg.merged && mg.id === DUP.id && dupR.people.some((p) => p.phone === '719-555-0142') && dupR.notes.some((n) => /merged into this one: met them at the expo/.test(n.note)) && !D.sponsor.recs.some((r) => r.name === DUP.name + ' Inc'), 'Merge: the new phone and the note go onto the one already there; nothing new is made');
  ok((await b('add', { world: 'sponsor', name: DUP.name }))._status === 400, 'the very same name is still refused outright');
  const TRIX = (await b('data')).expo.recs.find((o) => o.name === 'Tri-Lakes Chamber of Commerce');
  du = await b('add', { world: 'expo', name: 'Some New Expo Org', email: 'TERRI@trilakeschamber.com' });
  ok(du._status === 409 && du.dupes.some((x) => x.id === TRIX.id && /the same email/.test(x.why)), 'an expo lead with an email already on the desk: a warning');
  const USA = NEW[31]; D = await b('data');
  const usP = find('sponsor', USA.id).people.find((p) => p.email && p.phone);
  du = await b('contact', { world: 'sponsor', id: USA.id, name: 'Someone New', email: usP.email.toUpperCase(), phone: '' });
  ok(du._status === 409 && du.dupes[0].same && du.dupes[0].key === 'e:' + usP.email.toLowerCase(), 'adding a contact whose email is already on the card: a warning naming them');
  ok((await b('contact', { world: 'sponsor', id: USA.id, name: '', email: usP.email, phone: '', role: 'Head of Community', of: du.dupes[0].key })).ok, 'Add the new details to them');
  D = await b('data'); const usP2 = find('sponsor', USA.id).people.find((p) => p.key === 'e:' + usP.email.toLowerCase());
  ok(find('sponsor', USA.id).people.filter((p) => p.key === usP2.key).length === 1 && /Details added on the desk by Test Seller/.test(usP2.more), 'still one person, the details noted as added on the desk');
  du = await b('contact', { world: 'sponsor', id: TP.id, name: 'Same Person', email: usP.email });
  ok(du._status === 409 && du.dupes.some((x) => !x.same && x.id === USA.id), 'the same email at another company: a warning naming that company');
  ok((await b('contact', { world: 'sponsor', id: TP.id, name: 'Same Person', email: usP.email, keep: 1 })).ok, 'Keep both adds them anyway');

  console.log('Don’t contact (per person; the email sender skips them)');
  D = await b('data'); const dk = 'e:' + usP.email.toLowerCase();
  ok((await b('dnc', { world: 'sponsor', id: USA.id, key: 'e:nobody@nowhere.com', on: true }))._status === 404 && (await cc('dnc', { world: 'sponsor', id: USA.id, key: dk, on: true }))._status === 403, 'an unknown person is refused; Claude Check cannot set it');
  ok((await b('dnc', { world: 'sponsor', id: USA.id, key: dk, on: true, why: 'Asked us not to call' })).ok, 'marked Don’t contact with a reason');
  D = await b('data'); let dp = find('sponsor', USA.id).people.find((p) => p.key === dk);
  ok(dp.dnc && dp.dnc.why === 'Asked us not to call' && dp.dnc.by === 'Test Seller' && dp.email === '' && dp.phone === '', 'the card shows the reason and who marked it; their email and phone are not given out');
  const rawRec = JSON.parse(execFileSync('php', ['-r', 'define("DATA_DIR", getenv("DESK_DATA")); require getenv("STORE"); $R = recs("sponsor")[getenv("ID")]; echo json_encode(["c" => array_values(array_filter(array_merge($R["contacts"], $R["added"]), fn($c) => !empty($c["dnc"]))), "no" => deskNoContact()]);'], { encoding: 'utf8', env: { ...env, STORE: join(WEB, 'api/desk-store.php'), ID: USA.id } }));
  ok(rawRec.c.length >= 1 && rawRec.c.every((c) => c.email === '' && c.dncEmail) && rawRec.no.includes(usP.email.toLowerCase()), 'in the records their entries carry no email (dncEmail keeps it), and deskNoContact() lists the address for the sender');
  /* the Peak email sender's own import (mail/public/lib.php), read-only against this copy: the address is not on its lists */
  const MD = mkdtempSync(join(tmpdir(), 'pmdata-')); cdpDirs.push(MD);
  const imp = () => JSON.parse(execFileSync('php', ['-r', 'require getenv("LIB"); $r = pmImport(["perOrg" => 3, "deskSkip" => false]); $o = []; foreach ($r["lists"] as $k => $ps) foreach ($ps as $p) $o[] = $p["to"]; echo json_encode(["to" => $o, "err" => $r["error"]]);'],
    { encoding: 'utf8', env: { ...env, LIB: join(ROOT, 'mail/public/lib.php'), PEAK_MAIL_DATA: MD, PEAK_DESK_DATA: LD, PEAK_DESK_STORE: join(WEB, 'api/desk-store.php'), PEAK_MAIL_MX: 'skip' } }));
  let im = imp();
  ok(im.err === '' && !im.to.includes(usP.email.toLowerCase()), 'the email sender’s own import (no change to it) leaves them out');
  ok((await b('dnc', { world: 'sponsor', id: USA.id, key: dk, on: false })).ok, 'Allow contact again');
  D = await b('data'); dp = find('sponsor', USA.id).people.find((p) => p.key === dk);
  ok(!dp.dnc && dp.email.toLowerCase() === usP.email.toLowerCase(), 'their email is back on the card');
  im = imp(); ok(im.to.includes(usP.email.toLowerCase()), 'and back on the email sender’s list (so the skip above was the flag)');
  ok((await b('dnc', { world: 'sponsor', id: USA.id, key: dk, on: true, why: 'Asked not to be contacted' })).ok, 'marked again (for the screens)');

  console.log('Edit and remove a contact (2026-11-18: both lists, every desk user)');
  const E1 = NEW[33], E2 = NEW[34];
  const pOf = (w, id, f) => find(w, id).people.find(f);
  const rawOf = (w, id) => JSON.parse(execFileSync('php', ['-r', 'define("DATA_DIR", getenv("DESK_DATA")); require getenv("STORE"); $R = recs(getenv("W"))[getenv("ID")]; echo json_encode(["R" => $R, "no" => deskNoContact()]);'], { encoding: 'utf8', env: { ...env, STORE: join(WEB, 'api/desk-store.php'), ID: id, W: w } }));
  const cBody = (key, v) => ({ world: 'sponsor', id: E1.id, key, n: 0, ...v });
  ok((await b('contact', { world: 'sponsor', id: E1.id, name: 'Casey Typo', role: 'Owner', email: 'casey@exmaple.com', phone: '719-555-0101' })).ok, 'a seller adds a contact with the email spelt wrong');
  D = await b('data'); let ce = pOf('sponsor', E1.id, (p) => p.name === 'Casey Typo');
  ok(ce && ce.ed && ce.added && ce.key === 'e:casey@exmaple.com' && ce.kn === 0, 'the card offers Edit on them (their key comes with them)');
  const logBefore = readFileSync(join(LD, 'events.log'), 'utf8');
  let ed = await c2('contactedit', cBody(ce.key, { name: 'Casey Typo', role: 'Owner', email: 'casey@example.com', phone: '719-555-0101' }));
  D = await b('data'); ce = pOf('sponsor', E1.id, (p) => p.name === 'Casey Typo');
  ok(ed.ok && ed.key === 'e:casey@example.com' && ce.email === 'casey@example.com' && ce.key === 'e:casey@example.com' && /edited by Second Seller/.test(ce.src) && !find('sponsor', E1.id).people.some((p) => p.email === 'casey@exmaple.com'), 'another seller corrects the email: the card shows the new one and says who edited it');
  const lr = lines('events.log').map((l) => JSON.parse(l)).filter((r) => r.t === 'contactedit').pop();
  ok(readFileSync(join(LD, 'events.log'), 'utf8').startsWith(logBefore) && lr.by === 'Second Seller' && lr.was.email === 'casey@exmaple.com' && lr.now.email === 'casey@example.com' && lr.at > 0, 'one new log row: who, when, the old email and the new; nothing before it rewritten');
  let chg = find('sponsor', E1.id).cedits.slice(-1)[0];
  ok(chg.do === 'edit' && chg.by === 'Second Seller' && chg.chg.length === 1 && chg.chg[0].join('|') === 'email|casey@exmaple.com|casey@example.com', 'the card’s Activity has the change: email, old → new');
  ed = await b('contactedit', cBody('e:casey@example.com', { name: 'Casey Typo', role: '', email: 'casey@example.com', phone: '' }));
  D = await b('data'); ce = pOf('sponsor', E1.id, (p) => p.name === 'Casey Typo');
  ok(ed.ok && ce.role === '' && ce.phone === '' && ce.email === 'casey@example.com', 'a field can be cleared (role and phone taken off)');
  ok((await b('contactedit', cBody('e:casey@example.com', { email: 'not-an-email' }))).error === 'That email does not look right.' && (await b('contactedit', cBody('e:casey@example.com', { name: '', email: '', phone: '' }))).error === 'Give a name, email or phone.', 'checked as when adding: a bad email, or nothing left, is refused');
  const nl = lines('events.log').length;
  ok((await b('contactedit', cBody('e:casey@example.com', { name: 'Casey Typo', role: '', email: 'casey@example.com', phone: '' }))).same && lines('events.log').length === nl, 'saving with nothing changed writes nothing');
  ok((await b('contactedit', cBody('e:nobody@nowhere.com', { name: 'X' })))._status === 404, 'someone not on the card: refused');
  ok((await cc('contactedit', cBody('e:casey@example.com', { name: 'X' })))._status === 403 && (await ex('contactedit', cBody('e:casey@example.com', { name: 'X' })))._status === 403 && (await ex('contactdel', cBody('e:casey@example.com', {})))._status === 403, 'Claude Check, and the expo-only account on a sponsor, cannot edit or remove');
  /* the same duplicate warning as adding */
  await b('contact', { world: 'sponsor', id: E1.id, name: 'Dana Two', email: 'dana@example.com' });
  let dw = await b('contactedit', cBody('e:casey@example.com', { name: 'Casey Typo', email: 'DANA@example.com' }));
  ok(dw._status === 409 && dw.dupes[0].same && /the same email/.test(dw.dupes[0].why) && dw.dupes[0].key === 'e:dana@example.com' && pOf('sponsor', E1.id, (p) => p.name === 'Casey Typo').email === 'casey@example.com', 'a new email already on this card: the duplicate warning, nothing saved');
  D = await b('data');
  const OTH = D.sponsor.recs.find((r) => r.id !== E1.id && r.id !== USA.id && r.people.some((p) => p.email && !p.dnc)), oe = OTH.people.find((p) => p.email && !p.dnc).email;
  dw = await b('contactedit', cBody('e:dana@example.com', { name: 'Dana Two', email: oe }));
  ok(dw._status === 409 && dw.dupes.some((x) => !x.same && x.id === OTH.id), 'an email at another company: a warning naming that company');
  ok((await b('contactedit', cBody('e:dana@example.com', { name: 'Dana Two', email: oe, keep: 1 }))).ok, 'Save anyway saves it');
  ok((await b('contactedit', cBody('e:' + oe.toLowerCase(), { role: 'Office' }))).ok, 'an edit that leaves the email alone does not warn about it again');
  /* the email sender's marks (they are the company's) and Don't contact survive an edit */
  php(['emailed', 'sponsor', E1.id, 'casey@example.com', 'Hello from Peak']); php(['replied', 'sponsor', E1.id, 'casey@example.com']); php(['bounced', 'sponsor', E1.id, 'casey@example.com']);
  D = await b('data'); const t0 = find('sponsor', E1.id).touches.length, st0 = find('sponsor', E1.id).stage;
  ed = await c2('contactedit', cBody('e:casey@example.com', { name: 'Casey Correct', email: 'casey.c@example.com', role: 'Owner' }));
  D = await b('data'); const E1r = find('sponsor', E1.id);
  ok(ed.ok && E1r.touches.length === t0 && E1r.stage === st0 && st0 === 'emailed' && ['sent', 'replied', 'bounced'].every((o) => E1r.touches.some((t) => t.m === 'email' && t.out === o && t.auto)), 'the email sender’s marks (sent, replied, bounced) and the stage stay on the card after the edit');
  im = imp(); ok(im.err === '' && im.to.includes('casey.c@example.com') && !im.to.includes('casey@exmaple.com') && !im.to.includes('casey@example.com'), 'the email sender’s own import (read only) has the corrected address and neither old one');
  const ck = 'e:casey.c@example.com';
  ok((await b('dnc', { world: 'sponsor', id: E1.id, key: ck, on: true, why: 'Asked not to be contacted' })).ok, 'then marked Don’t contact');
  ed = await c2('contactedit', cBody(ck, { name: 'Casey Correct-Name', role: 'Co-owner', email: 'other@example.com', phone: '719-555-0199' }));
  D = await b('data'); let cd = pOf('sponsor', E1.id, (p) => p.name === 'Casey Correct-Name'); let rw = rawOf('sponsor', E1.id);
  ok(ed.ok && cd && cd.dnc && cd.key === ck && cd.email === '' && cd.phone === '' && cd.role === 'Co-owner' && rw.no.includes('casey.c@example.com') && !JSON.stringify(rw.R).includes('other@example.com') && !JSON.stringify(rw.R).includes('719-555-0199'), 'edited while marked Don’t contact: still marked, name and role changed, the hidden email and phone untouched (the typed ones ignored), still on the sender’s no-contact list');
  im = imp(); ok(!im.to.includes('casey.c@example.com'), 'and still off the email sender’s lists');
  await b('contact', { world: 'sponsor', id: E1.id, name: 'Pat Nameonly' });
  ok((await b('dnc', { world: 'sponsor', id: E1.id, key: 'n:pat nameonly', on: true })).ok, 'a person with only a name, marked Don’t contact');
  ed = await b('contactedit', cBody('n:pat nameonly', { name: 'Pat Nameonly-Fixed' }));
  D = await b('data'); cd = pOf('sponsor', E1.id, (p) => p.name === 'Pat Nameonly-Fixed'); rw = rawOf('sponsor', E1.id);
  ok(ed.ok && ed.key === 'n:pat nameonly-fixed' && cd.key === 'n:pat nameonly-fixed' && cd.dnc && rw.R.dnc['n:pat nameonly-fixed'] && !rw.R.dnc['n:pat nameonly'], 'when an edit changes their key, the Don’t contact mark moves with them');
  /* a researched contact (not added by a person) can be edited too */
  D = await b('data'); const E3 = [17, 18, 19, 24, 25, 26, 27, 28, 29, 32].map((i) => NEW[i]).map((l) => find('sponsor', l.id)).find((r) => r.people.some((p) => p.ed && !p.added && !p.dnc)) || find('sponsor', E2.id); const rp = E3.people.find((p) => p.ed && !p.added && !p.dnc);
  if (rp) {
    ok((await b('contactedit', { world: 'sponsor', id: E3.id, key: rp.key, n: rp.kn, name: rp.name + ' Jr', role: rp.role, email: rp.email, phone: rp.phone })).ok && (await b('data')).sponsor.recs.find((r) => r.id === E3.id).people.some((p) => p.name === rp.name + ' Jr' && /edited by Test Seller/.test(p.src) && !/edited/.test(rp.src)), 'a researched contact can be corrected too, and keeps where it came from');
    const rk = (await b('data')).sponsor.recs.find((r) => r.id === E3.id).people.find((p) => p.name === rp.name + ' Jr'); await b('contactedit', { world: 'sponsor', id: E3.id, key: rk.key, n: rk.kn, name: rp.name });
  } else ok(false, 'a researched contact to edit');
  /* Remove */
  await b('contact', { world: 'sponsor', id: E1.id, name: 'Remy Remove', email: 'rm@example.com' });
  const chk0 = JSON.parse(php(['check'])).sponsor.contacts;
  let rm = await b('contactdel', { world: 'sponsor', id: E1.id, key: 'e:rm@example.com', n: 0 });
  D = await b('data');
  ok(rm.ok && !find('sponsor', E1.id).people.some((p) => p.email === 'rm@example.com') && JSON.parse(php(['check'])).sponsor.contacts === chk0 - 1, 'Remove: off the card and out of the counts');
  ok(find('sponsor', E1.id).cedits.some((c) => c.do === 'del' && c.name === 'Remy Remove' && c.by === 'Test Seller') && lines('events.log').some((l) => l.includes('"t":"contactdel"') && l.includes('Remy Remove')), 'the Activity says who removed whom; the log keeps them');
  im = imp(); ok(!im.to.includes('rm@example.com'), 'off the email sender’s lists');
  ok((await b('contact', { world: 'sponsor', id: E2.id, name: 'Remy Elsewhere', email: 'rm@example.com' })).ok, 'and out of the duplicate check (the address can be added elsewhere with no warning)');
  ok((await b('contactdel', { world: 'sponsor', id: E1.id, key: 'e:rm@example.com', n: 0 }))._status === 404 && (await cc('contactdel', { world: 'sponsor', id: E2.id, key: 'e:rm@example.com', n: 0 }))._status === 403, 'removing someone not there: refused; Claude Check: refused');
  ok((await b('contactdel', { world: 'sponsor', id: E1.id, key: 'n:pat nameonly-fixed', n: 0 })).ok && rawOf('sponsor', E1.id).R.dnc['n:pat nameonly-fixed'], 'removing someone marked Don’t contact keeps the mark on the record (safer for the email sender)');
  /* expo: the same */
  D = await b('data');
  const usedX = [3, 4, 5, 10, 11, 20, 21].map((i) => xseed.orgs[i].id);
  const XO = D.expo.recs.find((r) => !usedX.includes(r.id) && r.name !== 'Tri-Lakes Chamber of Commerce' && r.people.some((p) => p.ed && p.email && p.estat && !p.dnc));
  const xp = XO.people.find((p) => p.ed && p.email && p.estat && !p.dnc);
  ed = await b('contactedit', { world: 'expo', id: XO.id, key: xp.key, n: xp.kn, name: xp.name, role: 'Events director', email: 'events.fixed@example.org', phone: xp.phone, notes: 'Corrected from their site' });
  D = await b('data'); const xq = find('expo', XO.id).people.find((p) => p.email === 'events.fixed@example.org');
  ok(ed.ok && xq && xq.role === 'Events director' && xq.notes === 'Corrected from their site' && !xq.estat && /Venue research/.test(xq.src) && /edited by Test Seller/.test(xq.src), 'expo: a researched contact corrected (email, role, note); the old email status no longer shows');
  ok(lines('expo-events.log').some((l) => l.includes('"t":"xcontactedit"')) && !lines('events.log').some((l) => l.includes(XO.id)), 'expo edits go in the expo log only');
  ok((await ex('contactedit', { world: 'expo', id: XO.id, key: xq.key, n: xq.kn, role: 'Events lead' })).ok, 'the expo-only account edits expo contacts');
  await b('contact', { world: 'expo', id: XO.id, name: 'Expo Remove', email: 'xr@example.org' });
  rm = await b('contactdel', { world: 'expo', id: XO.id, key: 'e:xr@example.org', n: 0 });
  D = await b('data');
  ok(rm.ok && !find('expo', XO.id).people.some((p) => p.email === 'xr@example.org') && lines('expo-events.log').some((l) => l.includes('"t":"xcontactdel"')) && find('expo', XO.id).cedits.some((c) => c.do === 'del'), 'expo: Remove works the same');
  im = imp(); ok(im.to.includes('events.fixed@example.org') && !im.to.includes(xp.email.toLowerCase()) && !im.to.includes('xr@example.org'), 'the email sender’s expo list has the corrected address, not the old or the removed one');
  /* from the server: a test contact and the Don't contact it set, taken off in one go */
  await b('contact', { world: 'sponsor', id: E2.id, name: 'Test,', email: 'Test@test.com', phone: '8032607859', role: 'testghuy' });
  ok((await b('dnc', { world: 'sponsor', id: E2.id, key: 'e:test@test.com', on: true, why: 'Not the right person' })).ok && rawOf('sponsor', E2.id).no.includes('test@test.com'), 'a test contact marked Don’t contact (as on the live desk)');
  const n0 = lines('events.log').length;
  const cdry = JSON.parse(php(['contactdel', 'sponsor', E2.id, 'e:test@test.com', '--dnc-off', '--dry-run', '--by', 'Test Admin']));
  ok(cdry.ok && cdry.dry && cdry.rows.length === 2 && cdry.rows[0].t === 'dnc' && cdry.rows[0].on === false && cdry.rows[1].t === 'contactdel' && !('email' in cdry.rows[1].was) && lines('events.log').length === n0, 'php desk.php contactdel --dry-run: shows the two rows, writes nothing');
  const creal = JSON.parse(php(['contactdel', 'sponsor', E2.id, 'e:test@test.com', '--dnc-off', '--by', 'Test Admin']));
  D = await b('data'); rw = rawOf('sponsor', E2.id);
  ok(creal.ok && lines('events.log').length === n0 + 2 && !find('sponsor', E2.id).people.some((p) => p.name === 'Test,') && !rw.no.includes('test@test.com') && !(rw.R.dnc || {})['e:test@test.com'] && !JSON.stringify(rw.R.added).includes('test.com'), 'and for real: the test contact and its Don’t contact mark are gone from the card, the record and the sender’s no-contact list');
  /* the records rebuilt from the logs come out the same */
  const snap = () => JSON.stringify([find('sponsor', E1.id).people, find('sponsor', E1.id).cedits, find('sponsor', E1.id).dnc, find('sponsor', E2.id).people, find('expo', XO.id).people, find('expo', XO.id).cedits]);
  D = await b('data'); const s1 = snap(); php(['rebuild']); D = await b('data');
  ok(snap() === s1, 'php desk.php rebuild gives the same people, changes and Don’t contact marks');

  console.log('The end-of-day email (OFF until an admin turns it on)');
  const MAILF = join(LD, 'mail-out.jsonl'), envM = { ...env, DESK_MAIL_FILE: MAILF };
  const eod = (args, now) => execFileSync('php', [join(WEB, 'api/desk.php'), 'eod', ...args], { encoding: 'utf8', env: now ? { ...envM, DESK_NOW: String(now) } : envM });
  php(['bounced', 'sponsor', NEW[22].id, 'y@example.com']);
  const bk = JSON.parse(execFileSync('php', ['-r', 'define("DATA_DIR", getenv("DESK_DATA")); require getenv("STORE"); echo json_encode(deskBooked("sponsor", getenv("ID"), getenv("DAY"), "10:00", "Jordan", "", "Peak email", "book-1"));'], { encoding: 'utf8', env: { ...env, STORE: join(WEB, 'api/desk-store.php'), ID: NEW[23].id, DAY: later(3) } }));
  await b('owner', { world: 'sponsor', id: LOC[11].id, owner: 'Test Seller' }); await b('next', { world: 'sponsor', id: LOC[11].id, date: D.nextBiz, what: 'call about spring' });
  ok(/not sent: it is off/.test(eod([])) && !existsSync(MAILF), 'off by default: the hourly run sends nothing');
  const dry = eod(['--dry-run']);
  ok(/WHO DID WHAT TODAY/.test(dry) && /Test Seller: \d+ calls? \(\d+ voicemails?\), \d+ emails?/.test(dry) && /FOLLOW-UPS DUE/.test(dry) && new RegExp(LOC[11].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(call about spring\\)').test(dry), 'what it says: who did what today, the follow-ups due next working day');
  ok(/FROM THE PEAK EMAIL SENDER TODAY/.test(dry) && /Replies: [1-9]/.test(dry) && /Times booked: 1/.test(dry) && /Bounced: [1-9]/.test(dry) && bk.ok, 'and the replies, bookings and bounces from the email sender');
  ok((await b('settings', { on: true, to: ['x@example.com'] }))._status === 403 && (await a('settings', { on: true, to: [] })).error === 'Add at least one email before turning it on.' && (await a('settings', { on: false, to: ['not an email'] })).error === '“not an email” does not look like an email.', 'only an admin turns it on, with real emails');
  ok((await a('eodpreview'))?.text && (await b('eodpreview'))._status === 403 && (await cc('eodpreview')).ok && (await cc('settings', { on: false, to: [] }))._status === 403, 'the preview: admins (Claude Check may look, never save)');
  ok((await a('settings', { on: true, to: ['team@example.com', 'brandon@example.com'] })).ok && (await a('data')).eod.on && !(await b('data')).eod, 'the admin turns it on for two people; sellers never see the setting');
  const wd = (h, dow) => { const x = new Date(); x.setHours(h, 5, 0, 0); while (x.getDay() !== dow) x.setDate(x.getDate() + 1); return Math.floor(x.getTime() / 1000); };
  ok(/not sent: it goes at 6 pm/.test(eod([], wd(17, 3))) && /not sent: it is the weekend/.test(eod([], wd(18, 6))) && !existsSync(MAILF), 'Wednesday 5 pm: not yet; Saturday 6 pm: never');
  ok(/sent to 2 of 2/.test(eod([], wd(18, 3))) && lines('mail-out.jsonl').length === 2 && /already went/.test(eod([], wd(19, 3))) && lines('mail-out.jsonl').length === 2, 'Wednesday after 6 pm: one email to each, once that day');
  ok(JSON.parse(lines('mail-out.jsonl')[0]).subject.startsWith('Peak desk, end of day') && /Open the desk: https:\/\/traverseplatforms.com\/peak-desk-28d38d\//.test(JSON.parse(lines('mail-out.jsonl')[0]).body), 'the email itself: subject and a link to the desk');
  ok((await a('settings', { on: false, to: ['team@example.com'] })).ok && !(await a('data')).eod.on, 'turned off again: it stays off until Matthew turns it on');

  console.log('A calendar feed per person (Sixfold’s)');
  await b('next', { world: 'sponsor', id: LOC[11].id, date: later(5), what: 'call about spring' });
  const cl = await b('callink', {}); const feed = async (p, tk) => { const r = await fetch(`${API}?action=calfeed&p=${p}&t=${tk}`); return { s: r.status, ct: r.headers.get('content-type') || '', t: await r.text() }; };
  let fd = await feed(cl.p, cl.t); D = await b('data');
  const TTn = find('sponsor', TT.id).name;
  ok(cl.ok && fd.s === 200 && /text\/calendar/.test(fd.ct) && /^BEGIN:VCALENDAR\r\n/.test(fd.t) && fd.t.includes('\r\nEND:VCALENDAR\r\n'), 'a private link: an iCalendar feed with no sign-in');
  const unfold = fd.t.replace(/\r\n /g, '');
  ok(unfold.includes('SUMMARY:Peak tour: ' + TTn.replace(/,/g, '\\,')) && unfold.includes('SUMMARY:Follow up: ' + LOC[11].name.replace(/,/g, '\\,') + ' (call about spring)') && !/@example\.com|\d{3}-\d{4}/.test(unfold.replace(/UID:[^\r]+/g, '')), 'it has my tours and my follow-ups, and no emails or phone numbers');
  ok((await feed(cl.p, '0'.repeat(32))).s === 404 && (await feed('0'.repeat(12), cl.t)).s === 404, 'a wrong token or person: Not found');
  const cl2 = await b('callink', { new: 1 });
  ok(cl2.t !== cl.t && (await feed(cl.p, cl.t)).s === 404 && (await feed(cl2.p, cl2.t)).s === 200, 'a new link: the old one stops working');
  ok((await cc('callink', {}))._status === 403, 'Claude Check makes no link');
  const xl = await ex('callink', {}), xf = await feed(xl.p, xl.t);
  ok(xl.ok && xf.s === 200 && /Follow up \(expo\): /.test(xf.t) && !xf.t.includes(TTn) && !/Peak tour: /.test(xf.t.replace(/Peak tour \(expo\)/g, '')), 'the expo-only account’s feed: expo leads only');
  await b('owner', { world: 'sponsor', id: LOC[11].id, owner: '' }); await b('next', { world: 'sponsor', id: LOC[11].id, date: '', what: '' });   /* put back for the screens */

  console.log('Tour confirmation emails (OFF until Matthew approves the wording; a stand-in for Microsoft, nothing reaches anyone)');
  {
    const TA = LOC[100], TB = LOC[101], TC = LOC[102], TD = LOC[104], XT = xseed.orgs[26];
    ok((await b('contact', { world: 'sponsor', id: TD.id, name: 'Dee Enn', email: 'dee@example.com' })).ok && (await b('dnc', { world: 'sponsor', id: TD.id, key: 'e:dee@example.com', on: true, why: 'Asked not to be contacted' })).ok, 'a contact marked Don’t contact (for below)');
    D = await b('data'); const wk0 = (D.sponsor.week['Test Seller'] || {}).emails || 0;
    ok(D.tourmail && D.tourmail.on === false && !('words' in D.tourmail) && (await a('data')).tourmail.words.body.includes('{address}'), 'off by default; sellers see the switch only, admins the wording too');
    let r = await b('tour', { world: 'sponsor', id: TA.id, date: later(3), time: '10:30', who: 'Pat Jones', email: 'pat@example.com', mail: true });
    ok(r.ok && r.mail.state === 'off' && GM.calls === 0, 'while it is off a booking with the tick sends nothing (and says so)');
    D = await b('data'); let tA = D.sponsor.tours.find((x) => x.tid === r.tid);
    ok(tA.email === 'pat@example.com' && tA.mins === 30 && tA.mail === false && tA.tms.s === 'none', 'the tour keeps the email and the length (30 minutes by default); no confirmation asked for while off');
    /* the switch and the wording: admins only, the placeholders kept */
    ok((await b('tourmailset', { on: true }))._status === 403 && (await cc('tourmailset', { on: true }))._status === 403, 'only an admin turns it on (not a seller, not Claude Check)');
    const W0 = (await a('data')).tourmail.words;
    ok((await a('tourmailset', { words: { ...W0, body: W0.body.replace('{date}', 'soon') } })).error === 'The confirmation email must keep {date}: it is the date of the visit.', 'the wording cannot lose {date}');
    ok(/must keep \{address\}/.test((await a('tourmailset', { words: { ...W0, body: W0.body.replace('{address}', 'here') } })).error) && /must keep \{time\}/.test((await a('tourmailset', { words: { ...W0, cbody: W0.cbody.replace('{time}', '') } })).error), 'nor {address} or {time} (the cancellation keeps {date} and {time})');
    ok(/has \{price\} in it/.test((await a('tourmailset', { words: { ...W0, subject: 'Your visit {price}' } })).error), 'an unknown field is refused');
    msConnect('reconnect');
    ok(/can.t go on yet: Matthew.s Peak Outlook needs to be connected again/.test((await a('tourmailset', { on: true })).error), 'it will not go on while Matthew\u2019s Peak Outlook is not connected');
    msConnect();
    ok((await a('tourmailset', { on: true })).tourmail.on === true && (await b('data')).tourmail.on && (await b('data')).tourmail.ready, 'the admin turns it on (the test does it here; live it stays off for Matthew)');
    /* a booking with the tick: one email, multipart, with the invite */
    r = await b('tour', { world: 'sponsor', id: TB.id, date: later(4), time: '14:30', who: 'Jamie Polson', email: 'Jamie@Example.com', mail: true });
    ok(r.ok && r.mail.state === 'sent' && r.mail.to === 'jamie@example.com' && GM.sent.length === 1, 'booked with the tick: sent once, to the address given');
    let m = mimeParts(GM.sent[0]); const tidB = r.tid, dB = later(4);
    const longDay = new Date(dB + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    ok(/^Jamie Polson <jamie@example.com>$/.test(m.to) && m.subject === 'Confirmed: your visit to Peak Pickleball, ' + longDay + ' at 2:30 pm' && /multipart\/mixed/.test(m.top), 'To the person, subject "Confirmed: your visit to Peak Pickleball, ' + longDay + ' at 2:30 pm"');
    ok(m.text.startsWith('Hi Jamie,') && m.text.includes('When: ' + longDay + ', 2:30 pm Mountain time (30 minutes)') && m.text.includes('Where: Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920') && /parking lot off Jamboree Drive/.test(m.text) && m.text.includes("You'll meet: Test Seller") && m.text.includes('(719) 377-4725') && /reply to this email/.test(m.text) && m.text.trim().endsWith('Thanks,\r\nTest Seller\r\nPeak Pickleball'), 'the words: date, time (Mountain), length, address, entrance, who they meet, Peak\u2019s phone, reply to change it, signed by the booker');
    ok(m.html.includes('2:30 pm Mountain time') && !/<img|<a |r\.php|o\.php/i.test(m.html) && !/https?:\/\//.test(m.text), 'the HTML part is the same words: no open image, no tracked links');
    const ics = m.cal.body;
    ok(/method=REQUEST/i.test(m.cal.ct) && /attachment; filename="invite.ics"/.test(m.att.head) && m.att.body === ics, 'a text/calendar part (method=REQUEST) for "Add to calendar", and the same invite attached as invite.ics');
    ok(icsGet(ics, 'METHOD') === 'REQUEST' && icsGet(ics, 'UID') === 'peak-tour-' + tidB + '@traverseplatforms.com' && icsGet(ics, 'SEQUENCE') === '0' && icsGet(ics, 'DTSTART') === 'TZID=America/Denver:' + dB.replace(/-/g, '') + 'T143000' && icsGet(ics, 'DTEND') === 'TZID=America/Denver:' + dB.replace(/-/g, '') + 'T150000', 'the invite: METHOD:REQUEST, one UID for the tour, SEQUENCE 0, 2:30 to 3:00 pm America/Denver');
    ok(/BEGIN:VTIMEZONE\r\nTZID:America\/Denver/.test(ics) && /ORGANIZER;CN="Peak Pickleball":mailto:matthewsharpe@peakpickleball.us/.test(ics.replace(/\r\n /g, '')) && /ATTENDEE;CN="Jamie Polson";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:jamie@example.com/.test(ics.replace(/\r\n /g, '')) && icsGet(ics, 'LOCATION') === 'Peak Pickleball\\, 1730 Briargate Blvd\\, Colorado Springs\\, CO 80920', 'with its time zone, Matthew\u2019s Peak address as organizer, the contact as attendee, the address as location');
    D = await b('data'); let RB = find('sponsor', TB.id), tB = D.sponsor.tours.find((x) => x.tid === tidB), tch = RB.touches.find((x) => x.tc);
    ok(tch && tch.m === 'email' && tch.out === 'sent' && tch.by === 'Test Seller (via Peak email)' && /^Emailed: tour confirmation \(/.test(tch.note) && RB.stage === 'meeting', 'on the Activity: "Emailed: tour confirmation" by "Test Seller (via Peak email)"; the stage stays Meeting / tour booked');
    ok(((D.sponsor.week['Test Seller'] || {}).emails || 0) === wk0 && tB.tms.s === 'sent' && /^Confirmation sent to jamie@example.com/.test(tB.tms.text), 'not counted as the seller\u2019s own email; the tour says it went');
    /* twice never sends twice */
    r = await b('tourmail', { world: 'sponsor', tid: tidB });
    const dupLib = execFileSync('php', ['-r', 'require getenv("LIB"); echo json_encode(pmTourSend(["ref" => getenv("REF"), "to" => "jamie@example.com", "subject" => "x", "text" => "x", "html" => "x", "ics" => "BEGIN:VCALENDAR", "method" => "REQUEST"]));'], { encoding: 'utf8', env: { ...env, LIB: env.DESK_PEAK_MAIL_LIB, REF: 'tc-' + tidB + '-0-r' } });
    ok(r.ok && r.mail.state === 'dup' && JSON.parse(dupLib).dup === true && GM.calls === 1, 'a second try is refused by the desk and by the sender\u2019s own log (same booking version): still one email');
    /* moved: the same UID, SEQUENCE 1 */
    r = await b('tourmove', { world: 'sponsor', tid: tidB, date: later(5), time: '09:00', mail: true });
    m = mimeParts(GM.sent[1]);
    ok(r.mail.state === 'sent' && /^Updated: your visit to Peak Pickleball, /.test(m.subject) && /The time has changed/.test(m.text) && icsGet(m.cal.body, 'UID') === 'peak-tour-' + tidB + '@traverseplatforms.com' && icsGet(m.cal.body, 'SEQUENCE') === '1' && /T090000$/.test(icsGet(m.cal.body, 'DTSTART')), 'moving it sends the new time: "Updated:", same UID, SEQUENCE 1');
    /* a failure shows on the tour and in the counts; Retry sends it once */
    GM.fail = { code: 503, err: 'ServiceUnavailable' };
    r = await b('tourmove', { world: 'sponsor', tid: tidB, date: later(6), time: '11:00', mail: true });
    D = await b('data'); tB = D.sponsor.tours.find((x) => x.tid === tidB);
    ok(r.ok && r.mail.state === 'failed' && /Microsoft did not answer/.test(r.mail.why) && tB.tms.s === 'failed' && /^Confirmation not sent: Microsoft did not answer/.test(tB.tms.text) && D.sponsor.tmFailed.some((x) => x.tid === tidB), 'Microsoft down: the move is saved, the tour says "Confirmation not sent: ..." and is listed for Retry');
    const stats = JSON.parse(execFileSync('php', ['-r', 'require getenv("LIB"); echo json_encode(pmTourStats());'], { encoding: 'utf8', env: { ...env, LIB: env.DESK_PEAK_MAIL_LIB } }));
    ok(stats.sent.length === 2 && stats.open.length === 1 && stats.open[0].to === 'jamie@example.com', 'the sender\u2019s log: 2 sent, 1 not sent (Outbox counts these)');
    GM.fail = null; const c0 = GM.calls;
    const rr = await Promise.all([b('tourmail', { world: 'sponsor', tid: tidB }), c2('tourmail', { world: 'sponsor', tid: tidB })]);
    m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(rr.every((x) => x.ok) && rr.filter((x) => x.mail.state === 'sent').length === 1 && GM.calls === c0 + 1 && icsGet(m.cal.body, 'SEQUENCE') === '2', 'two people press Retry at once: one email (SEQUENCE 2)');
    D = await b('data'); ok(D.sponsor.tours.find((x) => x.tid === tidB).tms.s === 'sent' && !D.sponsor.tmFailed.length, 'after the retry: sent, nothing left to retry');
    /* cancelled: METHOD:CANCEL */
    r = await b('tourdel', { world: 'sponsor', tid: tidB }); m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(r.mail.state === 'sent' && /^Cancelled: your visit/.test(m.subject) && /is cancelled/.test(m.text) && /method=CANCEL/i.test(m.cal.ct) && icsGet(m.cal.body, 'METHOD') === 'CANCEL' && icsGet(m.cal.body, 'STATUS') === 'CANCELLED' && icsGet(m.cal.body, 'SEQUENCE') === '3' && icsGet(m.cal.body, 'UID') === 'peak-tour-' + tidB + '@traverseplatforms.com', 'cancelling it sends METHOD:CANCEL with the same UID, SEQUENCE 3');
    D = await b('data'); RB = find('sponsor', TB.id);
    ok(RB.touches.filter((x) => x.tc).length === 4 && RB.touches.filter((x) => x.tc).map((x) => x.note.split(' (')[0]).join('|') === 'Emailed: tour confirmation|Emailed: tour moved, updated invite|Emailed: tour moved, updated invite|Emailed: tour cancellation', 'four on the Activity: confirmation, two updates, the cancellation');
    /* not ticked, no email, Don't contact */
    let n0 = GM.calls;
    r = await b('tour', { world: 'sponsor', id: TC.id, date: later(3), time: '13:00', who: 'Sam', email: 'sam@example.com', mail: false });
    const r2 = await b('tour', { world: 'sponsor', id: TC.id, date: later(4), time: '13:00', who: 'Sam', email: '', mail: true });
    const r3 = await b('tour', { world: 'sponsor', id: TD.id, date: later(3), time: '15:00', who: 'Dee Enn', email: 'dee@example.com', mail: true });
    D = await b('data'); const t3 = D.sponsor.tours.find((x) => x.tid === r3.tid);
    ok(r.mail.state === 'none' && r2.mail.state === 'blocked' && r2.mail.why === 'no email was given' && GM.calls === n0, 'unticked: nothing sent; no email: nothing sent, and it says so');
    ok(r3.mail.state === 'blocked' && /is marked Don't contact/.test(r3.mail.why) && GM.calls === n0 && t3.tms.s === 'blocked' && /^Confirmation not sent: .* is marked Don't contact/.test(t3.tms.text), 'a person marked Don\u2019t contact is never sent one, and the card says why');
    ok((await b('tourmail', { world: 'sponsor', tid: r.tid })).mail.state === 'sent' && GM.calls === n0 + 1, 'Send the confirmation now (a tour booked without the tick)');
    /* expo */
    r = await b('tour', { world: 'expo', id: XT.id, date: later(6), time: '10:00', who: 'Show manager', email: 'shows@example.com', mail: true, mins: 60 });
    m = mimeParts(GM.sent[GM.sent.length - 1]); D = await b('data');
    ok(r.mail.state === 'sent' && /\(1 hour\)/.test(m.text) && /T110000$/.test(icsGet(m.cal.body, 'DTEND')) && find('expo', XT.id).stage === 'tour' && find('expo', XT.id).touches.some((x) => x.tc), 'expo leads too (Tour booked), with the length chosen (1 hour)');
    /* the preview sends nothing; the test goes only to the address typed; the wording can change */
    n0 = GM.calls;
    const pv = await cc('tourpreview', { world: 'sponsor', id: TA.id, date: later(3), time: '10:30', who: 'Pat Jones', email: 'pat@example.com' });
    ok(pv.ok && pv.subject.startsWith('Confirmed: your visit') && /Hi Pat,/.test(pv.text) && /METHOD:REQUEST/.test(pv.ics) && pv.can === '' && GM.calls === n0, 'Preview (Claude Check may look): the words and the invite, nothing sent');
    ok((await b('tourpreview', { world: 'sponsor', id: TD.id, date: later(3), time: '10:30', who: 'x', email: 'dee@example.com' })).can.includes("Don't contact"), 'the preview says when it would not go');
    ok((await b('tourmailtest', { email: 'me@example.com' }))._status === 403 && GM.calls === n0, 'a seller cannot send a test');
    const tt = await a('tourmailtest', { email: 'matthew-test@example.com' }); m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(tt.ok && GM.calls === n0 + 1 && /^\[Test\] Confirmed: your visit/.test(m.subject) && /matthew-test@example.com/.test(m.to) && /Sample Company|Pat/.test(m.text), 'an admin\u2019s test goes to the address typed only, marked [Test]');
    const W1 = { ...W0, subject: 'See you at Peak: {date} at {time}' };
    ok((await a('tourmailset', { words: W1 })).tourmail.custom && (await a('tourpreview', { world: 'sponsor', sample: 1 })).subject.startsWith('See you at Peak: ') && (await a('tourmailset', { reset: 1 })).tourmail.custom === false, 'the wording saves, the preview follows it, and the first wording comes back');
    /* the log is the record */
    php(['rebuild']); D = await b('data');
    ok(D.sponsor.tours.find((x) => x.tid === r3.tid).tms.s === 'blocked' && find('sponsor', TB.id).touches.filter((x) => x.tc).length === 4 && !D.sponsor.tours.some((x) => x.tid === tidB), 'php desk.php rebuild: the same email states and touches');
    ok(lines('tourmail-settings.log').length >= 3, 'each change of the switch or the wording is logged (tourmail-settings.log)');
    /* leave it on for the screens; turned off at the end */
  }

  console.log('Several people at once');
  D = await b('data'); const ids = NEW.filter((l) => find('sponsor', l.id).stage === 'new').slice(0, 12).map((l) => l.id);   /* companies nobody has touched yet */
  const conc = await Promise.all(ids.map((id, i) => new Promise((res) => execFile('php', [join(WEB, 'api/desk.php'), 'emailed', 'sponsor', id, `p${i}@example.com`], { env }, (e, so, se) => res(e ? 'cli err ' + (se || so || e.message).slice(0, 200) : 'ok')))).concat(
    seed.leads.filter((l) => l.list === 'local').slice(0, 10).map((l, i) => (i % 2 ? b : c2)('touch', { world: 'sponsor', id: l.id, m: 'call', out: 'noanswer' }).then((j) => j.ok ? 'ok' : 'web ' + j._status + ' ' + j.error))));
  const concBad = conc.filter((x) => x !== 'ok');
  writeFileSync(join(LD, 'events.log'), JSON.stringify({ t: 'note', id: ids[0], note: 'written by another program meanwhile', by: 'Peak email', at: Math.floor(Date.now() / 1000) }) + '\n', { flag: 'a' });
  D = await b('data');
  const missE = ids.filter((id) => find('sponsor', id).stage !== 'emailed'), missC = seed.leads.filter((l) => l.list === 'local').slice(0, 10).filter((l) => find('sponsor', l.id).stage !== 'called').map((l) => l.id + ':' + find('sponsor', l.id).stage);
  ok(!missE.length && !missC.length, '12 emails from the command line and 10 calls over the web at the same moment: all 22 kept' + (missE.length || missC.length ? ' MISSING ' + JSON.stringify({ missE, missC, concBad }) : ''));
  ok(find('sponsor', ids[0]).notes.some((n) => /another program/.test(n.note)), 'a row another program appends is read in on the next request');
  const before = JSON.stringify(D.sponsor.recs.map((r) => [r.id, r.stage, r.owner, r.touches.length, r.notes.length, r.next])) + JSON.stringify(D.expo.recs.map((r) => [r.id, r.stage, r.owner, r.touches.length]));
  php(['rebuild']); const D2 = await b('data');
  ok(JSON.stringify(D2.sponsor.recs.map((r) => [r.id, r.stage, r.owner, r.touches.length, r.notes.length, r.next])) + JSON.stringify(D2.expo.recs.map((r) => [r.id, r.stage, r.owner, r.touches.length])) === before, 'php desk.php rebuild (from the lists and the logs) gives exactly the same records');
  ok(JSON.stringify(D2.sponsor.week) === JSON.stringify(D.sponsor.week), 'and the same counts');

  console.log('Look-ups (reads ABC Family\u2019s own website)');
  const ABC = D2.sponsor.recs.find((l) => l.name === 'ABC Family Chiropractic');
  const sc = ABC ? await b('scan', { id: ABC.id }) : {};
  ok(sc.ok && sc.scan && (sc.scan.ok ? sc.scan.phones.length > 0 : true), 'looking up still works' + (sc.scan && !sc.scan.ok ? ' (site unreadable today: ' + sc.scan.err + ')' : ''));
  ok((await b('scan', { id: K.id, hunter: true })).error === 'Hunter is not set up here.', 'Hunter is off without its key');

  /* ---- the screens ---- */
  console.log('The screens');
  const CPORT = 9300 + Math.floor(Math.random() * 300);
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CPORT}`, `--user-data-dir=${cdpDir()}`, 'about:blank'], { stdio: 'ignore' });
  let k = 0; const pend = new Map(), errors = [];
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++k; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  const waitFor = async (e, l, ms = 15000) => { for (let i = 0; i < ms; i += 150) { if (await js(e)) return true; await sleep(150); } throw new Error('timeout: ' + l); };
  const shot = async (n) => writeFileSync(join(ROOT, 'tests', n), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const click = async (sel, wait = 400) => { const r = await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`); await sleep(wait); return r; };
  const clickText = async (sel, re, wait = 500) => { const r = await js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>${re}.test(b.textContent));if(!e)return false;e.click();return true})()`); await sleep(wait); return r; };
  const tab = (t) => click(`.tabs [data-tab="${t}"]`); const sub = (s) => click(`.subchips [data-sub="${s}"]`);
  const world = (w) => click(`.world [data-world="${w}"]`);
  const rowIds = () => js(`[...document.querySelectorAll('.list .row')].map(r=>r.getAttribute('data-id'))`);
  const text = () => js(`document.querySelector('main').textContent`);
  const fits = `document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`;
  let tg; for (let i = 0; i < 60 && !tg; i++) { try { tg = (await (await fetch(`http://127.0.0.1:${CPORT}/json/list`)).json()).find((y) => y.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.rej(new Error(m.error.message)) : q.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: ORIGIN + '/' });
  await waitFor(`!!document.querySelector('.signin input')`, 'sign-in');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${SELLER}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.kpis')`, 'Today');

  const bgS = `(function(){var c=getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number);return c[0]+c[1]+c[2]})()`;
  ok(await js(`document.documentElement.dataset.theme==='dark'&&!localStorage.getItem('peakdesk.theme')`) && (await js(bgS)) < 120, 'the facelift: dark is the default (nothing chosen on this device, the device itself set to light)');
  ok(await js(`(async()=>{await document.fonts.ready;return getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()==='#17a9cd'&&document.fonts.check('800 20px "Golos Text"')})()`), 'Sponsors glow Peak cyan; the Golos Text and Inter fonts load from the desk itself');
  ok(await js(`[...document.querySelectorAll('.world button')].map(b=>b.textContent).join(',')==='Sponsors,Expo leads'&&[...document.querySelectorAll('.tabs .tl')].map(b=>b.textContent).join(',')==='Today,Pipeline,Companies,Tours & deals,More'`), 'the bar: Sponsors | Expo leads, then Today, Pipeline, Companies, Tours & deals, More');
  ok(await js(`document.querySelector('main').dataset.section==='today'&&location.hash==='#sponsor/today'`), 'it opens on Today (#sponsor/today)');
  D = await b('data'); const dueN = D.sponsor.recs.filter((r) => r.next && r.next.date && r.next.date <= today() && !['signed', 'lost'].includes(r.stage)).length;
  ok(await js(`+document.querySelector('.kpi[data-k="due"] b').textContent`) === dueN && dueN >= 1 && await js(`document.querySelectorAll('[data-blk="due"] .row').length`) === dueN, `Today: follow-ups due (${dueN}), each listed`);
  ok(await js(`['due','fresh','wait','tours','week'].every(k=>!!document.querySelector('[data-blk="'+k+'"]'))&&/Proposals waiting/.test(document.querySelector('[data-blk="wait"]').textContent)`), 'Today has follow-ups due, to contact next, proposals waiting, tours coming up, this week');
  ok(await js(`(()=>{const r=[...document.querySelectorAll('[data-blk="week"] tr')].find(r=>/Test Seller/.test(r.textContent));return !!r&&r.children[1].textContent===String(${(D.sponsor.week['Test Seller'] || {}).calls || 0})})()`) && (D.sponsor.week['Test Seller'] || {}).calls >= 3, 'This week shows the seller\u2019s calls');
  await shot('desk-today.png');

  console.log('Priority 5 (Sixfold’s)');
  D = await b('data');
  const p5 = await js(`[...document.querySelectorAll('.p5 .p5b')].map(b=>({id:b.dataset.id,cat:b.dataset.cat,name:b.querySelector('b').textContent}))`);
  const lateIds = D.sponsor.recs.filter((r) => r.next && r.next.date && r.next.date < today() && !['signed', 'lost'].includes(r.stage)).map((r) => r.id);
  const CAT = ['late', 'today', 'new', 'wait'];
  ok(p5.length === 5 && p5.every((x, i) => !i || CAT.indexOf(x.cat) >= CAT.indexOf(p5[i - 1].cat)) && p5.filter((x) => x.cat === 'late').length === Math.min(5, lateIds.length) && p5.filter((x) => x.cat === 'late').every((x) => lateIds.includes(x.id)) && lateIds.length >= 1, `Priority 5 at the top of Today: ${p5.map((x) => x.cat).join(', ')} (late follow-ups first, then due today, then new ones, then waiting longest)`);
  ok(p5.filter((x) => x.cat === 'new').every((x) => { const r = D.sponsor.recs.find((y) => y.id === x.id); return r.stage === 'new' && !r.last && r.list !== 'renew'; }) && p5.filter((x) => x.cat === 'today').every((x) => D.sponsor.recs.find((y) => y.id === x.id).next.date === today()), 'the due-today ones are due today and the new ones were never reached');
  let rightCard = 0;
  for (const x of p5) { await click(`.p5 .p5b[data-id="${x.id}"]`, 450); if (await js(`document.querySelector('.detail').dataset.id===${JSON.stringify(x.id)}&&document.querySelector('.detail h2').textContent===${JSON.stringify(x.name)}`)) rightCard++; await click('.detail .close', 250); }
  ok(rightCard === 5, `tapping each of the five opens that company’s own card (${rightCard} of 5)`);
  await click('.p5 .p5b[data-rank="2"]', 450); const p2id = await js(`document.querySelector('.detail').dataset.id`);
  await click('.detail .qb [data-m="call/talked"]', 1000); await click('.detail .close', 300);
  const p5n = await js(`[...document.querySelectorAll('.p5 .p5b')].map(b=>b.dataset.id)`); let ok2 = 0;
  for (const id of p5n) { await click(`.p5 .p5b[data-id="${id}"]`, 400); if (await js(`document.querySelector('.detail').dataset.id===${JSON.stringify(id)}`)) ok2++; await click('.detail .close', 250); }
  ok(p2id === p5[1].id && ok2 === p5n.length && p5n.length === 5 && !p5n.includes(p2id) === (p5[1].cat !== 'late'), 'after a touch reloads the desk the strip moves on, and every tap still opens the right card (Sixfold’s 16 Nov bug)');
  /* whose: Mine */
  await click('.ownbar [data-owner="mine"]');
  const mineN = D.sponsor.recs.filter((r) => r.owner === 'Test Seller').length;
  ok(await js(`localStorage.getItem('peakdesk.owner')==='mine'&&/Mine/.test(document.querySelector('.ownbar [aria-pressed="true"]').textContent)&&+document.querySelector('.ownbar [data-owner="mine"] b').textContent===${mineN}`), `Whose: Mine (${mineN}) is kept on this device`);
  await click('.ownbar [data-owner="all"]');
  /* Pipeline */
  await tab('pipe');
  ok(await js(`document.querySelectorAll('.funnel .fr').length===10&&!document.querySelector('.list')`), 'Pipeline opens on the stages (10, with counts), no list until one is picked');
  await click('.funnel .fr[data-st="emailed"]');
  const emailedIds = D.sponsor.recs.filter((r) => r.stage === 'emailed').map((r) => r.id);
  ok((await rowIds()).length === emailedIds.length && (await rowIds()).every((i) => emailedIds.includes(i)), `the Emailed stage lists its ${emailedIds.length}`);
  ok(await js(`[...document.querySelectorAll('.list .row .lc')].every(e=>/email/i.test(e.textContent))`), 'each row says how it was last contacted (an email, or their reply)');
  await click('.stagechips [data-st="new"]');
  /* a card: log a call */
  const fresh = await js(`document.querySelector('.list .row').getAttribute('data-id')`);
  await click('.list .row');
  ok(await js(`!!document.querySelector('.detail .strip')&&/Not contacted yet/.test(document.querySelector('.detail .strip').textContent)&&/Open/.test(document.querySelector('.detail .ownerpick').selectedOptions[0].textContent)`), 'a card shows its stage, owner (Open), last contact (not yet) and next follow-up');
  ok(await js(`[...document.querySelectorAll('.detail .qb button')].map(b=>b.textContent).join(',')==='No answer,Left voicemail,Talked,Emailed,Texted,More…'`), 'one-tap buttons: No answer, Left voicemail, Talked, Emailed, Texted, More…');
  ok(await js(`document.querySelector('.detail .fu [aria-pressed="true"]').dataset.fu==='3'`), 'the follow-up starts at In 3 days (working days)');
  await js(`(()=>{const n=document.querySelector('.detail .tnote');n.value='front desk took a message';return 1})()`);
  await click('.detail .qb [data-m="call/noanswer"]', 900);
  D = await b('data'); let fr0 = find('sponsor', fresh);
  ok(fr0.stage === 'called' && fr0.owner === 'Test Seller' && fr0.last.note === 'front desk took a message' && fr0.next && fr0.next.date === D.nextBiz, 'No answer: logged with the note, Called, mine, the follow-up the next working day (Sixfold\u2019s rule)');
  ok(await js(`/Logged: Called, no answer/.test(document.getElementById('toast').textContent)&&!!document.querySelector('#toast button')`), 'the toast says what was logged and offers Undo');
  await shot('desk-card-logged.png');
  await click('#toast button', 900);
  D = await b('data'); ok(find('sponsor', fresh).stage === 'new' && find('sponsor', fresh).touches.length === 0, 'Undo takes it back to To contact' + (find('sponsor', fresh).stage === 'new' ? '' : ' (now ' + find('sponsor', fresh).stage + ', ' + find('sponsor', fresh).touches.length + ' touches, hist ' + JSON.stringify(find('sponsor', fresh).hist.slice(-1)) + ')'));
  /* More… */
  await click('.detail .qb .more');
  await js(`(()=>{const f=document.querySelector('.detail .inl');const s=f.querySelector('select');s.value='linkedin';s.dispatchEvent(new Event('change'));f.querySelector('textarea').value='connected with the marketing lead';return 1})()`);
  await clickText('.detail .inl button', '/Log it/', 900);
  D = await b('data'); ok(find('sponsor', fresh).last.m === 'linkedin' && find('sponsor', fresh).stage === 'emailed', 'More…: LinkedIn, with a note (moves it to Emailed, the written-message stage)');
  /* contact link prompt */
  const telOk = await js(`(()=>{const a=document.querySelector('.detail .ct a[href^="tel:"],.detail .callhow a[href^="tel:"]');if(!a)return 'none';a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click();return !document.querySelector('.detail .tprompt').hidden&&/Calling/.test(document.querySelector('.detail .tprompt').textContent)})()`);
  ok(telOk === true || telOk === 'none', 'tapping a phone number asks how the call went' + (telOk === 'none' ? ' (this company has no phone)' : ''));
  /* stage: Not now and Lost forms */
  await click('.detail .stagesec [data-st="notnow"]');
  ok(await js(`/come back/.test(document.querySelector('.detail .stagesec .inl').textContent)&&document.querySelector('.detail .stagesec .inl input[type=date]').value.length===10`), 'Not now asks for the day to come back');
  await click('.detail .stagesec [data-st="lost"]');
  ok(await js(`/Lost: why/.test(document.querySelector('.detail .stagesec .inl').textContent)&&document.querySelectorAll('.detail .stagesec .inl .seg button').length===5`), 'Lost offers five reasons or a typed one');
  await clickText('.detail .stagesec .inl .seg button', '/Not a fit/', 100); await clickText('.detail .stagesec .inl button', '/Mark Lost/', 900);
  D = await b('data'); ok(find('sponsor', fresh).stage === 'lost' && find('sponsor', fresh).lost.why === 'Not a fit', 'marked Lost: Not a fit');
  ok(await js(`/Moved to Lost: Not a fit/.test(document.querySelector('.detail').textContent)&&/connected with the marketing lead/.test(document.querySelector('.detail').textContent)`), 'Activity lists the touches, notes and stage changes');
  ok(await js(`!document.querySelector('.detail img')`), 'nothing in a card is read as HTML');
  /* owner: Take it */
  await click('.detail .close'); await js(`(()=>{const b=document.querySelector('.stagechips [data-st="new"]');if(b&&b.getAttribute('aria-pressed')!=='true')b.click();return 1})()`); await sleep(400); await click('.list .row');
  const takeId = await js(`document.querySelector('.detail').dataset.id`);
  await clickText('.detail .strip button', '/Take it/', 900);
  ok((await b('data')).sponsor.recs.find((r) => r.id === takeId).owner === 'Test Seller', 'Take it makes a company mine');
  await click('.detail .close');
  /* board */
  await click('.controls [data-view="board"]');
  ok(await js(`[...document.querySelectorAll('.bhead b')].map(b=>b.textContent).join('|')==='Called|Left voicemail|Emailed|Texted|Meeting / tour booked|Proposal sent|Signed|Not now'`), 'Board: a column per stage past To contact');
  await shot('desk-board.png');
  await click('.controls [data-view="stages"]');
  /* Companies */
  await tab('list');
  const secOf = (l) => l.list === 'renew' ? 'peak' : l.list;
  for (const s of ['new', 'peak', 'local']) { await sub(s); const want = D.sponsor.recs.filter((r) => secOf(r) === s).length; ok((await rowIds()).length === want && await js(`+document.querySelector('.subchips [data-sub="${s}"] b').textContent`) === want, `Companies \u203a ${s}: ${want}`); }
  await sub('all');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value=${JSON.stringify(K.name.toLowerCase())};q.dispatchEvent(new Event('input'));return 1})()`); await sleep(200);
  ok((await rowIds()).includes(K.id), 'search finds a company');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  await sub('removed'); ok(/Removed/.test(await text()) || (await js(`location.hash`)) === '#sponsor/list/all', 'Removed (or back to all when empty)');
  /* tours & deals */
  await tab('deals'); await sub('signed');
  ok(/Test Sponsor Co/.test(await text()) && /\$24,500 a year/.test(await text()), 'Tours & deals \u203a Signed: the signed sponsors and what they are worth');
  await sub('props'); ok(/\$24,500/.test(await text()), 'Proposals');
  await clickText('main .card button', '/Open · save as PDF/', 500);
  ok(await js(`!!document.querySelector('.paper')&&/sponsorship proposal/.test(document.querySelector('.paper').textContent)`), 'a proposal opens as a page to save as PDF');
  writeFileSync(join(ROOT, 'tests', 'desk-proposal.pdf'), Buffer.from((await send('Page.printToPDF', { printBackground: true })).data, 'base64'));
  await clickText('.printbar button', '/Back/', 300);
  /* more: report */
  await tab('more'); await sub('report');
  ok(/Who is on the desk/.test(await text()), 'More \u203a Report with who has done what');
  await clickText('main .btn', '/Open the report/', 400);
  ok(await js(`/Sponsor pipeline/.test(document.querySelector('.paper h1').textContent)&&/This week by person/.test(document.querySelector('.paper').textContent)&&/Proposals out/.test(document.querySelector('.paper').textContent)`), 'the report page: stages, the week by person, proposals out');
  writeFileSync(join(ROOT, 'tests', 'desk-report.pdf'), Buffer.from((await send('Page.printToPDF', { printBackground: true })).data, 'base64'));
  await clickText('.printbar button', '/Back/', 300);
  for (const s of ['pl', 'pk', 'offer', 'better']) { await sub(s); }
  ok(await js(`/What we could offer/.test(document.querySelector('main').textContent)`), 'P&L, Packages, What Peak offers, What we could offer still open');
  await sub('look'); await click('[data-look="light"]');
  const bgSum = bgS;
  ok((await js(bgSum)) > 600 && await js(`localStorage.getItem('peakdesk.theme')==='light'`), 'Look: Light');
  await tab('today'); await shot('desk-today-light.png'); await tab('more'); await sub('look'); await click('[data-look="dark"]');
  ok((await js(bgSum)) < 120, 'Look: Dark again'); await js(`localStorage.removeItem('peakdesk.theme')`);
  /* expo */
  await world('expo'); await tab('today');
  ok(await js(`location.hash==='#expo/today'&&/Expo leads/.test(document.querySelector('.shead h1').textContent)&&[...document.querySelectorAll('.tabs .tl')].map(b=>b.textContent).join(',')==='Today,Pipeline,Organisations,Tours & quotes,More'`), 'Expo leads: the same tabs (Today, Pipeline, Organisations, Tours & quotes, More)');
  ok(/Quotes waiting/.test(await text()), 'expo Today: quotes waiting on an answer');
  await tab('pipe');
  ok(await js(`document.querySelectorAll('.funnel .fr').length===7`), 'expo Pipeline: its 7 stages');
  await click('.funnel .fr[data-st="new"]'); await click('.list .row');
  ok(await js(`/Their events/.test(document.querySelector('.detail').textContent)&&document.querySelectorAll('.detail .qb button').length===6`), 'an expo card: their events and the same one-tap buttons');
  const xid = await js(`document.querySelector('.detail').dataset.id`);
  await click('.detail .qb [data-m="email/sent"]', 900);
  ok((await b('data')).expo.recs.find((r) => r.id === xid).stage === 'contacted', 'Emailed on an expo lead: Contacted');
  await shot('expo-card.png');
  await click('.detail .close');
  await tab('list'); ok(await js(`!!document.querySelector('.xprichips')&&!!document.querySelector('select.xcat')`), 'Organisations keeps priority and category filters');
  await tab('deals'); await sub('quotes'); ok(/Booked/.test(await text()) && new RegExp(XA.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(await text()), 'Tours & quotes \u203a Quotes and bookings');
  await tab('more'); await sub('ref'); ok(await js(`document.querySelectorAll('main .xq li').length===10`), 'Questions and venues kept');
  /* kept from the earlier desk: the lists, Peak's tracker, the reading pages, P&L, add / remove / bring back, the expo details */
  console.log('What the desk already did');
  await world('sponsor'); await tab('list'); await sub('new');
  await js(`(()=>{const s=document.querySelector('.sortsel');s.value='name';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(200);
  const nn = await js(`[...document.querySelectorAll('.list .row .nm b')].map(b=>b.textContent)`); ok(nn.length > 5 && nn.join('|') === [...nn].sort((p, q) => p.localeCompare(q)).join('|'), 'Companies › New leads sort by name on a tap');
  await click('.xstagechips [data-x="called"]');
  await sub('local'); ok(await js(`document.querySelector('.xstagechips [data-x="all"]').getAttribute('aria-pressed')==='true'`), 'a stage picked under New leads does not carry into Local businesses');
  await sub('new'); ok(await js(`document.querySelector('.xstagechips [data-x="called"]').getAttribute('aria-pressed')==='true'`), 'and New leads keeps its own when you come back'); await click('.xstagechips [data-x="all"]');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value=${JSON.stringify(K.name.toLowerCase())};q.dispatchEvent(new Event('input'));return 1})()`); await sleep(200); await click('.list .row');
  ok(await js(`/<img src=x/.test(document.querySelector('.detail').textContent)&&!document.querySelector('.detail img')&&[...document.querySelectorAll('.detail .ct a')].some(a=>a.href==='mailto:pat@example.com')&&/From: Added on the desk by Test Seller/.test(document.querySelector('.detail').textContent)`), 'a card: a note with HTML shows as text; an added contact is tap-to-email and says who added it');
  ok(await js(`/Looked up/.test(document.querySelector('.detail').textContent)&&/Tour and proposal/.test(document.querySelector('.detail').textContent)`), 'the card keeps Looked up and Tour and proposal');
  await click('.detail .close');
  if (precs.length) {
    await sub('peak');
    ok((await rowIds()).length === D.sponsor.recs.filter((r) => r.list === 'renew').length && await js(`/Active/.test(document.querySelector('.list .row .pill').textContent)&&document.querySelector('.sortsel').value==='peak'`), `Companies › Peak sponsors: every sponsor on Peak’s tracker, active first`);
    await clickText('.list .row', '/Petrali/', 400);
    ok(await js(`/On Peak’s tracker/.test(document.querySelector('.detail').textContent)&&!!document.querySelector('.detail .chk')`), 'a sponsor shows its Peak record and what to check'); await shot('desk-peak-sponsor.png');
    await click('.detail .close'); await clickText('.list .row', '/Rally Back/', 400);
    ok((await js(`document.querySelectorAll('.detail .kv').length`)) === 2, 'a sponsor with two agreements shows both (Rally Back)'); await click('.detail .close');
  }
  await tab('more'); await sub('offer');
  ok(await js(`/Court sponsor: .12,000 a year/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .info').length===5`), 'More › What Peak offers: five sections');
  await sub('better'); ok(await js(`/Springs Pickleball/.test(document.querySelector('main table').textContent)&&[...document.querySelectorAll('main .src a')].every(a=>/^https:/.test(a.href))`), 'More › What we could offer: the price table, sources are links');
  await sub('pl'); ok(await js(`/\\$10,500 a year \\(88%\\)/.test(document.querySelector('main').textContent)&&/\\$21,260/.test(document.querySelector('.numbers').textContent)&&/No cost entered for: Banner/.test(document.querySelector('.numbers').textContent)`), 'More › P&L: $24,500 in, $3,000 to deliver, $240 running = $21,260; flags the banner has no cost');
  await sub('pk'); ok((await js(`document.querySelectorAll('main .pkrow').length`)) === 2, 'More › Packages lists the packages');
  await tab('deals'); await sub('tours');
  ok(await js(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Add to my calendar')&&/Tours coming up/.test(document.querySelector('main').textContent)`), 'Tours: the tours ahead with Add to my calendar'); await shot('desk-tours.png');
  await sub('signed'); await clickText('main button', '/\\+ Add a sponsor/', 300);
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value=${JSON.stringify(K.name.toLowerCase())};i.dispatchEvent(new Event('input'));return 1})()`); await sleep(100);
  ok(await js(`/already on the desk/.test(document.querySelector('.sheet').textContent)`), '+ Add a sponsor: a company already on the desk is offered instead');
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value='Sheet Sponsor LLC';i.dispatchEvent(new Event('input'));[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='Add the sponsor').click();return 1})()`); await sleep(900);
  ok(await js(`!document.querySelector('.sheet')&&/Sheet Sponsor LLC/.test(document.querySelector('main').textContent)`), 'the new sponsor is listed under Signed'); await shot('desk-signed.png');
  await js(`(()=>{const c=[...document.querySelectorAll('main .card')].find(c=>/Sheet Sponsor LLC/.test(c.textContent));[...c.querySelectorAll('button')].find(b=>b.textContent==='Remove').click();return 1})()`); await sleep(900);
  ok(!/Sheet Sponsor LLC/.test(await text()), 'Remove takes it off Signed');
  await tab('list'); await sub('removed');
  ok(/Sheet Sponsor LLC/.test(await text()), 'Companies › Removed lists it');
  await js(`(()=>{const r=[...document.querySelectorAll('main .row')].find(r=>/Sheet Sponsor LLC/.test(r.textContent));r.querySelector('button').click();return 1})()`); await sleep(900);
  ok((await b('data')).sponsor.recs.some((r) => r.name === 'Sheet Sponsor LLC'), 'Bring back puts it on the desk again');
  const NEWCO = 'Rebuild Check ' + Math.random().toString(36).slice(2, 8);
  await clickText('.shead button', '/Add a company/', 200);
  await js(`(()=>{const i=document.querySelectorAll('.addcard input');i[0].value='${NEWCO}';i[1].value='Test';[...document.querySelectorAll('.addcard button')].find(b=>b.textContent==='Add').click();return 1})()`); await sleep(1000);
  ok(await js(`location.hash==='#sponsor/list/added'&&new RegExp('${NEWCO}').test(document.querySelector('.detail h2').textContent)`) && (await b('data')).sponsor.recs.find((r) => r.name === NEWCO).owner === 'Test Seller','+ Add a company: it opens under Added on the desk, owned by whoever added it');
  await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await js(`location.hash==='#sponsor/list/added'&&document.querySelector('main').dataset.section==='list'`), 'a reload comes back to the same place');

  console.log('The Sixfold tools on the screen');
  const openCo = async (id, name) => { await tab('list'); await sub('all'); await js(`(()=>{const q=document.querySelector('.controls .search');q.value=${JSON.stringify(name.toLowerCase())};q.dispatchEvent(new Event('input'));return 1})()`); await sleep(250); await click(`.list .row[data-id="${id}"]`, 500); return js(`document.querySelector('.detail')&&document.querySelector('.detail').dataset.id===${JSON.stringify(id)}`); };
  D = await b('data'); const usR = find('sponsor', USA.id), usOk = usR.people.find((p) => !p.dnc && p.email && p.phone);
  ok(await openCo(USA.id, USA.name), 'a card opens from the list');
  ok(await js(`(()=>{const c=document.querySelector('.detail .ct.dnc[data-key=${JSON.stringify(JSON.stringify(dk)).slice(1, -1)}]');return !!c&&/Do not contact/.test(c.textContent)&&/Asked not to be contacted/.test(c.textContent)&&!c.querySelector('a[href^="tel:"],a[href^="sms:"],a[href^="mailto:"]')&&!!c.querySelector('[data-dnc="off"]')})()`), 'Don’t contact: the person shows the tag and the reason, with no call, text or email links');
  await click('.detail .tplpick [data-tpl="first"]', 300);
  ok(await js(`![...document.querySelectorAll('.detail .tplwho option')].some(o=>o.textContent.indexOf(${JSON.stringify(usP.name)})===0)&&document.querySelectorAll('.detail .tplwho option').length>0`), 'and is not offered in Send a message');
  await js(`(()=>{const s=document.querySelector('.detail .tplwho');const o=[...s.options].find(o=>o.textContent.indexOf(${JSON.stringify(usOk.name)})===0);s.value=o.value;s.dispatchEvent(new Event('change'));return 1})()`); await sleep(150);
  const tv = await js(`({t:document.querySelector('.detail .tpltext').value,b:document.querySelector('.detail .tplbody').value,s:document.querySelector('.detail .tplsub').value,sms:document.querySelector('.detail [data-send="text"]').getAttribute('href'),mail:document.querySelector('.detail [data-send="email"]').getAttribute('href')})`);
  const fn = usOk.name.split(' ')[0];
  ok(tv.t.startsWith('Hi ' + fn + ', this is Test with Peak Pickleball') && tv.b.includes(USA.name) && tv.s === 'Peak Pickleball and ' + USA.name && !/\{/.test(tv.t + tv.b + tv.s), `First outreach, filled in: "${tv.t.slice(0, 60)}…"`);
  ok(/^sms:\+?\d{7,15}[?&]body=/.test(tv.sms) && decodeURIComponent(tv.sms.split('body=')[1]) === tv.t && tv.mail.startsWith('mailto:' + usOk.email + '?subject=') && decodeURIComponent(tv.mail.split('subject=')[1].split('&')[0]) === tv.s, 'Text opens the phone’s messages with it filled in; Email opens mail with the subject and body');
  await js(`(()=>{const a=document.querySelector('.detail [data-send="text"]');a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click();return 1})()`); await sleep(1300);
  D = await b('data'); let ul = find('sponsor', USA.id).last;
  ok(ul.m === 'text' && ul.out === 'sent' && ul.tpl === 'first' && ul.by === 'Test Seller' && /From the template “First outreach” to /.test(ul.note) && await js(`/Texted from “First outreach”/.test(document.getElementById('toast').textContent)`), 'tapping Text logs it: Texted, from the template, by that person (with Undo)');
  await click('.detail .tplpick [data-tpl="tour"]', 300);
  ok(await js(`/needs the tour time/.test(document.querySelector('.detail .tplbox').textContent)&&document.querySelector('.detail [data-send="text"]').classList.contains('off')`), 'Tour confirmation waits for a tour to be booked');
  await click('.detail .close', 300);
  /* the tries rule on the card */
  ok(await openCo(T4.id, T4.name) && await js(`!!document.querySelector('.detail .tries4')&&/4 of 4 tries/.test(document.querySelector('.detail .strip').textContent)`), 'after 4 misses: the card says so, with Send a last text or email and Move to Not now (60 days)');
  await click('.detail [data-act="lasttry"]', 400);
  ok(await js(`document.querySelector('.detail .tplpick [data-tpl="last"]').getAttribute('aria-pressed')==='true'&&/tried to reach you a few times|tried you a few times/.test(document.querySelector('.detail .tplbox').textContent+document.querySelector('.detail .tpltext').value)`), 'Send a last text or email opens the Last try template');
  ok((await b('data')).sponsor.recs.find((r) => r.id === T4.id).stage !== 'notnow', 'nothing moved by itself');
  await click('.detail [data-act="notnow60"]', 1000);
  D = await b('data'); const t4r = find('sponsor', T4.id);
  ok(t4r.stage === 'notnow' && t4r.notnow.back === later(60) && t4r.notnow.why === 'No answer after 4 tries' && t4r.next.date === later(60), 'one tap: Not now, back in 60 days, "No answer after 4 tries"');
  await click('.detail .close', 300);
  const T1 = LOCP[21]; await b('touch', { world: 'sponsor', id: T1.id, m: 'call', out: 'noanswer' }); await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await openCo(T1.id, T1.name) && await js(`/Try 2 of 4: 1 call with no answer/.test(document.querySelector('.detail .touchp').textContent)&&/Try 2 of 4/.test(document.querySelector('.detail .strip').textContent)&&!document.querySelector('.detail .fuhint').hidden`), 'one miss: "Try 2 of 4" on the card');
  await click('.detail .qb [data-m="call/noanswer"]', 1000);
  D = await b('data');
  ok(find('sponsor', T1.id).next.date === D.nextBiz && find('sponsor', T1.id).tries === 2 && await js(`/Try 3 of 4/.test(document.querySelector('.detail .touchp').textContent)`), 'No answer: the follow-up goes to the next working day by itself; now Try 3 of 4');
  /* duplicates on the screen */
  const usOther = find('sponsor', USA.id).people.find((p) => !p.dnc && p.email && p.key !== usOk.key) || usOk;
  ok(await openCo(USA.id, USA.name), 'back on a card');
  await js(`(()=>{const a=[...document.querySelectorAll('.detail .lnk')].find(b=>b.textContent==='+ Add a contact');a.click();const f=a.nextElementSibling;const i=f.querySelectorAll('input');i[0].value='New Person';i[2].value=${JSON.stringify(usOther.email)};[...f.querySelectorAll('button')].find(b=>b.textContent==='Save contact').click();return 1})()`); await sleep(500);
  ok(await js(`(()=>{const d=document.querySelector('.detail .dupbox');return !d.hidden&&/already on this card/.test(d.textContent)&&!!d.querySelector('[data-act="mergec"]')&&!!d.querySelector('[data-act="keepc"]')})()`), 'adding a contact already on the card: "already on this card", with Add the new details or Keep both');
  await click('.detail .dupbox [data-act="mergec"]', 1000);
  D = await b('data'); ok(find('sponsor', USA.id).people.filter((p) => p.key === usOther.key).length === 1, 'Add the new details: still one person');
  await click('.detail .close', 300);
  await clickText('.shead button', '/Add a company/', 250);
  await js(`(()=>{const i=document.querySelector('.addcard input');i.value=${JSON.stringify(DUP.name.toLowerCase() + ' llc')};i.dispatchEvent(new Event('input'));return 1})()`); await sleep(200);
  ok(await js(`(()=>{const d=document.querySelector('.addcard .dupbox');return !d.hidden&&/may already be on the desk/.test(d.textContent)&&!!d.querySelector('[data-act="merge"][data-id="${DUP.id}"]')&&!!d.querySelector('[data-act="keep"]')})()`), '+ Add a company: a warning as the name is typed, with Merge or Keep both');
  await shot('facelift-duplicate-warning.png');
  await click(`.addcard .dupbox [data-act="merge"][data-id="${DUP.id}"]`, 1200);
  ok(await js(`document.querySelector('.detail').dataset.id===${JSON.stringify(DUP.id)}`) && !(await b('data')).sponsor.recs.some((r) => r.name === DUP.name.toLowerCase() + ' llc'), 'Merge opens the one already there; nothing new is made');
  await click('.detail .close', 300);
  /* expo details */
  await world('expo'); await tab('list');
  ok(await js(`document.querySelector('.sortsel').value==='pri'&&(()=>{const p=[...document.querySelectorAll('.list .row .sc')].map(s=>parseInt(s.textContent));return p.length>10&&p.every((v,i)=>!i||v>=p[i-1])})()`), 'Organisations: priority 1 first');
  await click('.xprichips [data-x="1"]'); D = await b('data');
  ok((await rowIds()).length === D.expo.recs.filter((o) => o.pri === 1).length, 'the Priority 1 chip shows the priority-1 leads'); await click('.xprichips [data-x="all"]');
  await js(`(()=>{const s=document.querySelector('select.xcat');s.value='Bridal & family expos';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(300);
  ok((await rowIds()).length === D.expo.recs.filter((o) => o.cat === 'Bridal & family expos').length && (await rowIds()).length > 0, 'the category filter shows that category only');
  await js(`(()=>{const s=document.querySelector('select.xcat');s.value='all';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(300);
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='terri hayes';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(200);
  ok(JSON.stringify(await rowIds()) === JSON.stringify([TRI.id]), 'search finds a lead by its contact’s name');
  await click('.list .row');
  ok(await js(`(()=>{const d=document.querySelector('.detail');return [...d.querySelectorAll('a')].some(a=>a.href.toLowerCase()==='mailto:terri@trilakeschamber.com')&&/published/.test(d.textContent)&&/confidence high/.test(d.textContent)&&/best route/.test(d.textContent)&&[...d.querySelectorAll('a')].some(a=>/^tel:/.test(a.href))})()`), 'an expo card: tap-to-email, tap-to-call, published, confidence high, best route');
  await click('.detail .close');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='American Consumer';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(200); await click('.list .row');
  ok(await js(`[...document.querySelectorAll('.detail .xn.chk')].some(n=>/CORRECTION/.test(n.textContent))`), 'a contact note that warns (a correction) shows in the amber box');
  await click('.detail .close'); await js(`(()=>{const q=document.querySelector('.controls .search');q.value='';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  await sub('removed'); ok(/Test Expo Promoter/.test(await text()), 'Organisations › Removed lists the removed lead');
  await js(`(()=>{const r=[...document.querySelectorAll('main .row')].find(r=>/Test Expo Promoter/.test(r.textContent));r.querySelector('button').click();return 1})()`); await sleep(900);
  ok((await b('data')).expo.recs.some((o) => o.name === 'Test Expo Promoter'), 'Bring back puts it in the Expo leads again');
  await sub('all'); await clickText('.shead button', '/Add an expo lead/', 200);
  await js(`(()=>{const i=document.querySelectorAll('.addcard input');i[0].value='Screen Expo Co';i[1].value='Senior expos';[...document.querySelectorAll('.addcard button')].find(b=>b.textContent==='Add').click();return 1})()`); await sleep(1000);
  ok(await js(`/Screen Expo Co/.test(document.querySelector('.detail h2').textContent)`) && !(await b('data')).sponsor.recs.some((r) => r.name === 'Screen Expo Co'), '+ Add an expo lead opens it, and it never reaches the sponsors');
  await clickText('.detail button', '/Remove this lead/', 900);
  ok((await b('data')).expo.removed.some((r) => r.name === 'Screen Expo Co'), 'Remove this lead takes it out (to Removed)');
  await tab('more'); await sub('ref'); ok(await js(`/Douglas County Fairgrounds/.test(document.querySelector('.xvenues').textContent)`), 'the competing venues table');
  await js(`(()=>{localStorage.removeItem('peakdesk.theme');window.__lookApply();return 1})()`); await sleep(300); await tab('pipe');
  ok((await js(bgSum)) < 120 && await js(`getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()==='#e6781d'`), 'Expo leads in dark mode, glowing Peak orange'); await shot('expo-pipeline-dark.png');
  /* Edit and Remove on a contact (2026-11-18) */
  await b('contact', { world: 'sponsor', id: E1.id, name: 'Screen Person', email: 'screen@exmaple.com', phone: '719-555-0177' });
  await world('sponsor'); await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await openCo(E1.id, E1.name), 'Edit and Remove on the screen: the card opens');
  const scSel = (k) => `.detail .ct[data-key="${k}"]`;
  ok(await js(`(()=>{const c=document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com'))});return !!c&&!!c.querySelector('[data-act="cedit"]')&&!!c.querySelector('[data-act="cdel"]')&&!!c.querySelector('[data-dnc]')})()`), 'each contact has Edit and Remove beside Don’t contact');
  await click(scSel('e:screen@exmaple.com') + ' [data-act="cedit"]', 300);
  ok(await js(`(()=>{const f=document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com') + ' .cform')});return !!f&&f.querySelector('[data-f="email"]').value==='screen@exmaple.com'&&f.querySelector('[data-f="phone"]').value==='719-555-0177'&&f.querySelector('[data-f="name"]').value==='Screen Person'})()`), 'Edit opens a form with what the card shows');
  await shot('contact-edit-desktop.png');
  await js(`(()=>{const f=document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com') + ' .cform')});f.querySelector('[data-f="email"]').value=${JSON.stringify(oe)};return 1})()`);
  await click(scSel('e:screen@exmaple.com') + ' [data-act="csave"]', 1000);
  ok(await js(`(()=>{const d=document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com') + ' .cform .dupbox')});return !!d&&!d.hidden&&/Already on the desk/.test(d.textContent)&&!!d.querySelector('[data-act="ckeep"]')})()`), 'an email already at another company: the duplicate warning, with Save anyway');
  await js(`(()=>{const f=document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com') + ' .cform')});f.querySelector('[data-f="email"]').value='screen@example.com';f.querySelector('[data-f="phone"]').value='';return 1})()`);
  await click(scSel('e:screen@exmaple.com') + ' [data-act="csave"]', 1500);
  ok(await js(`(()=>{const c=document.querySelector(${JSON.stringify(scSel('e:screen@example.com'))});return !!c&&/screen@example\\.com/.test(c.textContent)&&!c.querySelector('a[href^="tel:"]')&&/edited by Test/.test(c.textContent)&&!document.querySelector(${JSON.stringify(scSel('e:screen@exmaple.com'))})})()`), 'saved: the corrected email shows, the cleared phone is gone, and it says who edited it');
  ok(await js(`/Contact edited: Screen Person/.test(document.querySelector('.detail .tl').textContent)&&/Email: screen@exmaple\\.com → screen@example\\.com/.test(document.querySelector('.detail .tl').textContent)&&/Phone: 719-555-0177 → \\(cleared\\)/.test(document.querySelector('.detail .tl').textContent)`), 'the card’s Activity shows each change, old → new');
  await shot('contact-edited-desktop.png');
  /* on a phone */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await sleep(300);
  await click(scSel('e:screen@example.com') + ' [data-act="cedit"]', 300);
  const pf = await js(`(()=>{const d=document.querySelector('.detail'),f=d.querySelector('.cform'),r=f.getBoundingClientRect(),W=document.documentElement.clientWidth;const sm=[...f.querySelectorAll('.btn'),...d.querySelectorAll('.cacts .lnk')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<36).map(b=>b.textContent);return {wide:d.scrollWidth-d.clientWidth,fits:r.left>=0&&r.right<=W+1,sm}})()`);
  ok(pf.wide <= 1 && pf.fits && !pf.sm.length, 'on a phone the Edit form fits and Edit, Remove and Save are finger-sized' + (pf.wide <= 1 && pf.fits && !pf.sm.length ? '' : ': ' + JSON.stringify(pf)));
  await js(`document.querySelector(${JSON.stringify(scSel('e:screen@example.com'))}).scrollIntoView({block:'center'})`); await sleep(150); await shot('contact-edit-phone.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200);
  await js(`window.__cf=window.confirm;window.confirm=()=>true`);
  await click(scSel('e:screen@example.com') + ' [data-act="cdel"]', 1500);
  await js(`window.confirm=window.__cf`);
  ok(await js(`!document.querySelector(${JSON.stringify(scSel('e:screen@example.com'))})&&/Contact removed: Screen Person/.test(document.querySelector('.detail .tl').textContent)`), 'Remove (after a confirm): off the card, and the Activity says so');
  /* phone */
  await world('sponsor'); await tab('today');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await sleep(300);
  ok(await js(`[...document.querySelectorAll('.tabs button,.world button')].every(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=document.documentElement.clientWidth+1})`), 'on a phone the list switch and all five tabs are in view');
  const wide = [];
  for (const w of ['sponsor', 'expo']) { await world(w); for (const tb of ['today', 'pipe', 'list', 'deals', 'more']) { await tab(tb); if (!(await js(fits))) wide.push(w + '/' + tb); await shot(`phone-${w}-${tb}.png`); } }
  ok(!wide.length, 'on a phone nothing scrolls sideways' + (wide.length ? ': ' + wide.join(', ') : ''));
  await world('sponsor'); await tab('pipe'); await click('.funnel .fr[data-st="new"]'); await click('.list .row');
  const ph = await js(`(()=>{const d=document.querySelector('.detail');const small=[...d.querySelectorAll('.qb button,.seg button,.btn')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<40).map(b=>b.textContent);return {fixed:getComputedStyle(d).position==='fixed',wide:d.scrollWidth-d.clientWidth,small}})()`);
  ok(ph.fixed && ph.wide <= 1 && !ph.small.length, 'on a phone a card opens full screen, fits, buttons finger-sized' + (ph.fixed && ph.wide <= 1 && !ph.small.length ? '' : ': ' + JSON.stringify(ph)));
  await shot('phone-card.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200);

  console.log('Tour confirmations on the screen');
  {
    const TS = LOC[103]; await world('sponsor');
    ok(await openCo(TS.id, find('sponsor', TS.id).name), 'a card opens');
    await clickText('.detail button', '/^Book a tour$/', 300);
    const f = '.detail .tourf';
    await js(`(()=>{const f=document.querySelector('${f}');const s=f.querySelectorAll('input');s[0].value='${later(5)}';s[1].value='11:00';const e=f.querySelector('[data-tm="email"]');e.value='casey@example.com';e.dispatchEvent(new Event('input'));const w=[...f.querySelectorAll('input')].find(i=>i.placeholder==='Who is coming');w.value='Casey Lee';return 1})()`); await sleep(150);
    ok(await js(`(()=>{const f=document.querySelector('${f}');const c=f.querySelector('[data-tm="tick"]');return c.checked&&!c.disabled&&/Send a confirmation email to casey@example.com/.test(f.querySelector('.tmtick').textContent)})()`), 'the booking form: "Send a confirmation email to casey@example.com", ticked');
    await click(`${f} [data-tm="preview"]`, 700);
    ok(await js(`(()=>{const p=document.querySelector('${f} pre.eodpre');return !!p&&!p.hidden&&/Subject: Confirmed: your visit to Peak Pickleball/.test(p.textContent)&&/Hi Casey,/.test(p.textContent)&&/calendar invite/.test(p.textContent)})()`), 'Preview shows the email before Save');
    await js(`document.querySelector('${f}').scrollIntoView({block:'center'})`); await sleep(250); await shot('tour-mail-form.png');
    const n0 = GM.calls; await clickText(`${f} button`, '/^Book the tour$/', 1500);
    ok(GM.calls === n0 + 1 && await js(`/Tour booked\\. Email sent to casey@example.com/.test(document.getElementById('toast').textContent)`), 'Book the tour: booked, and the toast says the email went');
    ok(await js(`[...document.querySelectorAll('.detail .tmline')].some(l=>/Confirmation sent to casey@example.com/.test(l.textContent))`), 'the card shows it went');
    await tab('deals'); await sub('tours');
    ok(await js(`[...document.querySelectorAll('main .card .tmline')].some(l=>/Confirmation sent to casey@example.com/.test(l.textContent))`), 'and so does the tour on Tours');
    ok((await a('tourmailset', { on: false })).tourmail.on === false, 'switched off again');
    await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
    ok(await openCo(TS.id, find('sponsor', TS.id).name), 'the card again');
    await clickText('.detail button', '/^Book a tour$/', 300);
    ok(await js(`(()=>{const f=document.querySelector('${f}');const c=f.querySelector('[data-tm="tick"]');return c.disabled&&!c.checked&&/Turns on once Matthew approves the wording/.test(f.querySelector('.tmtick').textContent)})()`), 'while it is off: the tick is disabled, "Turns on once Matthew approves the wording"');
    await js(`document.querySelector('${f}').scrollIntoView({block:'center'})`); await sleep(250); await shot('tour-mail-form-off.png');
    await click('.detail .close', 300);
  }
  console.log('Settings, My calendar, the look and contrast');
  await world('sponsor'); await tab('more');
  ok(await js(`!document.querySelector('.subchips [data-sub="settings"]')&&!!document.querySelector('.subchips [data-sub="cal"]')`), 'a seller sees My calendar but not Settings');
  await sub('cal'); await click('[data-act="callink"]', 700);
  ok(await js(`/api\\/desk\\.php\\?action=calfeed&p=[0-9a-f]{12}&t=[0-9a-f]{32}$/.test(document.querySelector('.calurl').value)&&[...document.querySelectorAll('main a')].some(a=>a.href.startsWith('webcal:'))`), 'My calendar: the private link, a Subscribe link for the iPhone, and one for Google');
  await shot('facelift-my-calendar.png');
  /* the look: one tap in the bar, kept on this device */
  await tab('today'); await click('#lookbtn', 300);
  ok(await js(`document.documentElement.dataset.theme==='light'&&localStorage.getItem('peakdesk.theme')==='light'`) && (await js(bgS)) > 600, 'the sun button: light mode, kept on this device');
  await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await js(`document.documentElement.dataset.theme==='light'`), 'still light after a reload');
  await tab('more'); await sub('look');
  ok(await js(`[...document.querySelectorAll('[data-look]')].map(b=>b.dataset.look).join(',')==='dark,light,auto'&&document.querySelector('[data-look="light"]').getAttribute('aria-pressed')==='true'`), 'More › Look: Dark (the default), Light, Match this device');
  await click('[data-look="dark"]', 300);
  ok(await js(`document.documentElement.dataset.theme==='dark'`) && (await js(bgS)) < 120, 'back to dark');
  /* contrast: every piece of text on the screen against what is behind it, 4.5:1 or better */
  const CONTRAST = `(()=>{const P=s=>{if(!s)return null;let m=s.match(/rgba?\\(([^)]+)\\)/);if(m){const v=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return [v[0],v[1],v[2],v[3]==null?1:v[3]]}m=s.match(/color\\(srgb ([^)]+)\\)/);if(m){const v=m[1].split(/[\\s\\/]+/).filter(Boolean).map(Number);return [v[0]*255,v[1]*255,v[2]*255,v[3]==null?1:v[3]]}return null};
    const L=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};const over=(t,b)=>{const a=t[3];return [t[0]*a+b[0]*(1-a),t[1]*a+b[1]*(1-a),t[2]*a+b[2]*(1-a),1]};
    const bgOf=e=>{const ls=[];for(let x=e;x;x=x.parentElement){const c=P(getComputedStyle(x).backgroundColor);if(c&&c[3]>0){ls.push(c);if(c[3]>=1)break}}let b=P(getComputedStyle(document.documentElement).backgroundColor);if(!b||b[3]<1)b=[255,255,255,1];for(let i=ls.length-1;i>=0;i--)b=over(ls[i],b);return b};
    const bad=[];let n=0;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(w.nextNode()){const t=w.currentNode;if(!t.nodeValue.trim())continue;const e=t.parentElement;if(!e||e.closest('[hidden],.toast,option,select,.paper,a.btn.off,button:disabled'))continue;const r=e.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.top>innerHeight*3)continue;
      const cs=getComputedStyle(e);if(cs.visibility==='hidden')continue;let op=1;for(let x=e;x;x=x.parentElement)op*=+getComputedStyle(x).opacity;let fg=P(cs.color);fg=[fg[0],fg[1],fg[2],fg[3]*op];const bg=bgOf(e);if(fg[3]<1)fg=over(fg,bg);
      const A=L(fg),B=L(bg),cr=(Math.max(A,B)+.05)/(Math.min(A,B)+.05);n++;if(cr<4.5)bad.push(t.nodeValue.trim().slice(0,28)+' '+cr.toFixed(2))}
    return {n,bad:bad.slice(0,6),nb:bad.length}})()`;
  const looks = {}; const shotsMade = [];
  for (const [dev, wdt, hgt, mob] of [['desktop', 1440, 900, false], ['phone', 390, 844, true]]) {
    await send('Emulation.setDeviceMetricsOverride', { width: wdt, height: hgt, deviceScaleFactor: mob ? 2 : 1, mobile: mob }); await sleep(300);
    for (const mode of ['dark', 'light']) {
      await js(`(()=>{localStorage.setItem('peakdesk.theme','${mode}');window.__lookApply();return 1})()`); await sleep(250);
      await world('sponsor'); await tab('today'); await js(`window.scrollTo(0,0)`); await sleep(300);
      let c = await js(CONTRAST); looks[`${dev}/${mode}/today`] = c; await shot(`facelift-${dev}-${mode}-today.png`); shotsMade.push(`facelift-${dev}-${mode}-today.png`);
      await tab('pipe'); await sleep(200); c = await js(CONTRAST); looks[`${dev}/${mode}/pipeline`] = c; await shot(`facelift-${dev}-${mode}-pipeline.png`);
      await click('.controls [data-view="board"]', 400); c = await js(CONTRAST); looks[`${dev}/${mode}/board`] = c; await shot(`facelift-${dev}-${mode}-board.png`); await click('.controls [data-view="stages"]', 300);
      await tab('today'); await click('.p5 .p5b[data-rank="1"]', 600); c = await js(CONTRAST); looks[`${dev}/${mode}/card`] = c; await shot(`facelift-${dev}-${mode}-card.png`);
      await js(`(()=>{const b=document.querySelector('.detail .tplpick button');if(b)b.click();const s=document.querySelector('.detail .tplsec');if(s)s.scrollIntoView();return 1})()`); await sleep(300); c = await js(CONTRAST); looks[`${dev}/${mode}/message`] = c; await shot(`facelift-${dev}-${mode}-message.png`);
      await click('.detail .close', 300);
      await world('expo'); await tab('today'); await js(`window.scrollTo(0,0)`); await sleep(300); c = await js(CONTRAST); looks[`${dev}/${mode}/expo`] = c; await shot(`facelift-${dev}-${mode}-expo.png`); await world('sponsor');
    }
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await js(`(()=>{localStorage.removeItem('peakdesk.theme');window.__lookApply();return 1})()`); await sleep(200);
  const lowC = Object.entries(looks).filter(([, v]) => v.nb); const nTxt = Object.values(looks).reduce((n, v) => n + v.n, 0);
  ok(!lowC.length && nTxt > 2000, `contrast 4.5:1 or better on every piece of text measured (${nTxt} across Today, Pipeline, Board, a card, Send a message and Expo; dark and light; desktop and phone)` + (lowC.length ? ': ' + JSON.stringify(lowC.map(([k, v]) => [k, v.nb, v.bad]).slice(0, 4)) : ''));
  ok(shotsMade.length === 4, 'screenshots for Matthew: tests/facelift-{desktop,phone}-{dark,light}-{today,pipeline,board,card,message,expo}.png');
  /* an admin: Settings (the end-of-day email, OFF; the templates) */
  await js(`document.getElementById('signout').click()`); await waitFor(`!!document.querySelector('.signin input')`, 'signed out');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${ADMIN}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.shead')`, 'the admin’s page'); await world('sponsor'); await tab('more'); await sub('settings');
  ok(await js(`document.querySelector('[data-set="eod"] [data-eod="off"]').getAttribute('aria-pressed')==='true'&&/6 pm Colorado time, Monday to Friday/.test(document.querySelector('[data-set="eod"]').textContent)`), 'More › Settings (admin): the end-of-day email, Off');
  ok(await js(`document.querySelectorAll('[data-set="templates"] .tpled').length===6&&[...document.querySelectorAll('[data-set="templates"] .tpled .tag')].filter(t=>t.textContent==='starter').length===6`), 'and the six templates to edit, each marked starter');
  await click('[data-act="eodpreview"]', 700);
  ok(await js(`/WHO DID WHAT TODAY/.test(document.querySelector('pre.eodpre').textContent)&&/Not going now: it is off/.test(document.querySelector('pre.eodpre').textContent)`), 'Preview shows today’s email and says it is not going (it is off)');
  await shot('facelift-settings.png');
  ok(await js(`(()=>{const c=document.querySelector('[data-set="tourmail"]');return !!c&&c.querySelector('[data-tmset="off"]').getAttribute('aria-pressed')==='true'&&/Nothing goes out while it is Off/.test(c.textContent)&&c.querySelector('[data-tmw="body"]').value.includes('{address}')})()`), 'More › Settings: Tour confirmation emails, Off, with the wording to edit');
  await click('[data-act="tmpreview"]', 700);
  ok(await js(`/the cancellation/.test(document.querySelector('[data-set="tourmail"] pre.eodpre').textContent)&&/BEGIN:VCALENDAR/.test(document.querySelector('[data-set="tourmail"] pre.eodpre').textContent)`), 'its Preview: the confirmation, the cancellation and the invite (nothing sent)');
  await js(`document.querySelector('[data-set="tourmail"]').scrollIntoView()`); await sleep(200); await shot('tour-mail-settings.png');
  ok((await a('data')).tourmail.on === false, 'the switch is left Off for Matthew');
  /* the expo-only account in the browser */
  await js(`document.getElementById('signout').click()`); await waitFor(`!!document.querySelector('.signin input')`, 'signed out');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${EXPO}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.shead')`, 'the expo account\u2019s page');
  const xo = await js(`({hidden:document.getElementById('world').hidden,world:document.querySelector('main').dataset.world,leak:((document.querySelector('main').innerText+' '+document.getElementById('bar').innerText).match(/Kaiser Permanente|Sponsors:[^.]{0,30}|Peak sponsors/)||[''])[0]})`);
  ok(xo.hidden && xo.world === 'expo' && !xo.leak, 'the expo-only account: no Sponsors switch, the Expo leads only' + (xo.hidden && xo.world === 'expo' && !xo.leak ? '' : ' ' + JSON.stringify(xo)));
  await js(`location.hash='#sponsor/pipe'`); await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await js(`document.querySelector('main').dataset.world==='expo'`), 'a sponsor address still lands on the Expo leads');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failN++; console.log('  FAIL threw: ' + e.stack); }
finally {
  try { ws && ws.close(); } catch {} try { chrome && chrome.kill(); } catch {} try { server && server.kill(); } catch {}
}
console.log(`desk ${pass}/${pass + failN}`); setTimeout(() => process.exit(failN ? 1 : 0), 300);

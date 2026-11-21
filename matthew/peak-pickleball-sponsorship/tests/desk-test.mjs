/* Peak Sponsor Desk tests (2026-11-17 rebuild: two pipelines, touches, owners, follow-ups, the SQLite records, the email link).
   Each run makes a FRESH copy of desk-data-local in Temp, writes old-desk log rows into it (to migrate), starts its own PHP server on
   that copy (DESK_DATA), and deletes the copy at the end: nothing in desk-data-local changes, and a run never sees a previous run's data.
   node tests/desk-test.mjs            the server rules, the migration, the email link, the screens (headless Chrome)
   node tests/desk-test.mjs --page dist/index.html   the same against the minified page
   2026-11-18: plus the facelift (dark default, light mode, contrast measured on every screen) and the Sixfold tools: templates, the tries rule,
   Priority 5, duplicate warnings, Don't contact (with the email sender's own import), the end-of-day email (off) and the calendar feed.
   2026-11-19: tour confirmation emails, sent through the Peak email sender's own code (mail/public/lib.php) to a stand-in for Microsoft on
   127.0.0.1: nothing reaches Microsoft and nobody is emailed.
   2026-11-19: Write an email on every card and booking links on one shared schedule (the booking page on the same test server).
   2026-11-20: Who meets visitors: the visitor is never told the seller's name (they book tours, they don't give them).
   2026-11-20: More for sellers is My email & booking link, My calendar, Look (and Questions and venues on the Expo leads); the Report,
   Profit & loss, Packages, What Peak offers and What we could offer are the admin's, and a seller's data has none of their figures. */
import { spawn, execFileSync, execFile } from 'node:child_process';
import crypto from 'node:crypto';
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
const GM = { sent: [], calls: 0, fail: null, boxes: [], drafts: {}, replies: [] };
const gmock = http.createServer((req, res) => { let bd = ''; req.on('data', (d) => (bd += d)); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'POST' && /\/oauth2\/v2.0\/token$/.test(u.pathname)) return j(200, { access_token: 'AT-2', refresh_token: 'RT-2', expires_in: 3600 });
  if (!/^Bearer AT-\d+$/.test(req.headers.authorization || '')) return j(401, { error: { code: 'InvalidAuthenticationToken' } });
  /* since 2026-11-19 every Peak email goes out as Peak Partnerships: /users/partnerships@peakpickleball.us/... (or /me with the fallback setting) */
  const bm = u.pathname.match(/^\/graph\/v1.0\/(me|users\/([^/]+))(\/.*)$/), box = bm ? (bm[2] ? decodeURIComponent(bm[2]).toLowerCase() : 'me') : '', rest = bm ? bm[3] : '';
  if (req.method === 'POST' && rest === '/sendMail') { GM.calls++; if (GM.fail) return j(GM.fail.code, { error: { code: GM.fail.err, message: GM.fail.err } }); GM.sent.push(Buffer.from(bd, 'base64').toString('utf8')); GM.boxes.push(box); res.writeHead(202); return res.end(); }
  if (req.method === 'GET' && rest === '/mailFolders/inbox') return j(200, { id: 'inbox' });
  if (req.method === 'GET' && rest === '/mailFolders/sentitems/messages') return j(200, { value: [{ from: { emailAddress: { name: 'Peak Partnerships', address: 'partnerships@peakpickleball.us' } } }] });
  if (req.method === 'POST' && /^\/messages\/[^/]+\/createReply$/.test(rest)) { const id = decodeURIComponent(rest.split('/')[2]), did = 'draft' + (Object.keys(GM.drafts).length + 1); GM.drafts[did] = { of: id, box, create: JSON.parse(bd || '{}') }; return j(201, { id: did, body: { contentType: 'html', content: '<html><body><div>Their email, quoted</div></body></html>' } }); }
  if (req.method === 'PATCH' && /^\/messages\/[^/]+$/.test(rest)) { const id = decodeURIComponent(rest.split('/')[2]); if (GM.drafts[id]) Object.assign(GM.drafts[id], JSON.parse(bd || '{}')); else (GM.patched ||= []).push([box, id, JSON.parse(bd || '{}')]); return j(200, { id }); }
  /* an attachment, as the Inbox downloads one (2026-11-20) */
  if (req.method === 'GET' && /^\/messages\/[^/]+\/attachments\/[^/]+$/.test(rest)) { const aid = decodeURIComponent(rest.split('/')[4]); return j(200, { '@odata.type': '#microsoft.graph.fileAttachment', name: 'x', contentBytes: Buffer.from('PNG-BYTES-' + aid).toString('base64') }); }
  if (req.method === 'POST' && /^\/messages\/[^/]+\/send$/.test(rest)) { const id = decodeURIComponent(rest.split('/')[2]); if (!GM.drafts[id]) return j(404, { error: { code: 'ErrorItemNotFound' } }); GM.calls++; GM.replies.push(GM.drafts[id]); res.writeHead(202); return res.end(); }
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
env.DESK_BOOK_BASE = ORIGIN + '/api/book.php';   /* the booking page (2026-11-19) on the test's own server */
env.DESK_UID_SINCE = '0';
env.DESK_PUSH_ALLOW_HTTP = '1';   /* the Inbox alerts (2026-11-20): the test push service is a plain listener on 127.0.0.1 */   /* X-16: every tour made in the test carries the new @peakpickleball.us invite UID (the line itself is tested below) */
function client(extra = {}) { let ck = ''; const f = async (action, body, hdr = true) => { const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(body && hdr ? { 'X-Desk': '1' } : {}), ...(ck ? { Cookie: ck } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; const j = await r.json().catch(() => ({})); j._status = r.status; return j; }; f.cookie = () => ck; return f; }
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
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', WEB], { env: { ...env, DESK_MAIL_FILE: join(LD, 'notify-out.jsonl') }, stdio: 'ignore' });   /* the booking heads-ups to Matthew land in a file */
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
  ok((await b('packages', { packages: [{ name: 'Court sponsor', price: 12000, per: 'year' }] }))._status === 403 && (await c2('pl', { services: [], running: [] }))._status === 403, 'a seller cannot change the packages or the P&L (admins only, 2026-11-20)');
  ok((await a('packages', { packages: [{ name: 'Court sponsor', price: 12000, per: 'year' }, { name: 'Title sponsor', price: 24000, per: 'year' }] })).ok, 'packages save (the admin)');
  const pr = await b('proposal', { world: 'sponsor', lead: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], to: 'Pat, Marketing', note: 'Two courts' });
  ok(pr.ok && pr.total === 24500 && (await b('data')).sponsor.recs.find((r) => r.id === TT.id).stage === 'proposal', 'a proposal: $24,500, and it moves to Proposal sent');
  ok((await b('signed', { world: 'sponsor', id: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }], start: 'x', months: 12 })).error === 'Pick the start date.', 'Signed needs a start date');
  ok((await b('signed', { world: 'sponsor', id: TT.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], start: today(), months: 12, who: 'Pat' })).ok, 'a sponsor is signed');
  ok((await b('todo', { id: TT.id, text: 'Logo on court 7' })).ok && (await a('pl', { services: [{ name: 'Court sponsor', price: 12000, per: 'year', cost: 1500, costPer: 'year' }], running: [{ name: 'Hosting', amount: 20, per: 'month' }] })).ok, 'to-dos and the P&L save (the P&L by the admin)');
  D = await b('data'); const DA = await a('data'); ok(find('sponsor', TT.id).stage === 'signed' && find('sponsor', TT.id).signed.total === 24500 && DA.sponsor.pl.services[0].cost === 1500, 'Signed: $24,500, P&L kept');
  ok(!('pl' in D.sponsor) && !('offer' in D.sponsor) && !('better' in D.sponsor) && !('pl' in (await c2('data')).sponsor) && D.sponsor.packages.length === 2 && DA.sponsor.offer.length > 0 && DA.sponsor.better.length > 0 && 'pl' in DA.sponsor, 'a seller’s data has no Profit & loss, What Peak offers or What we could offer (the packages stay: Make a proposal and Mark signed pick from them); the admin’s has them all');
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
    ok(/can.t go on yet: the Microsoft sign-in for Peak email needs connecting again/.test((await a('tourmailset', { on: true })).error), 'it will not go on while Matthew\u2019s Peak Outlook is not connected');
    msConnect();
    ok((await a('tourmailset', { on: true })).tourmail.on === true && (await b('data')).tourmail.on && (await b('data')).tourmail.ready, 'the admin turns it on (the test does it here; live it stays off for Matthew)');
    /* a booking with the tick: one email, multipart, with the invite */
    r = await b('tour', { world: 'sponsor', id: TB.id, date: later(4), time: '14:30', who: 'Jamie Polson', email: 'Jamie@Example.com', mail: true });
    ok(r.ok && r.mail.state === 'sent' && r.mail.to === 'jamie@example.com' && GM.sent.length === 1, 'booked with the tick: sent once, to the address given');
    let m = mimeParts(GM.sent[0]); const tidB = r.tid, dB = later(4);
    const longDay = new Date(dB + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    ok(/^Jamie Polson <jamie@example.com>$/.test(m.to) && m.subject === 'Confirmed: your visit to Peak Pickleball, ' + longDay + ' at 2:30 pm' && /multipart\/mixed/.test(m.top), 'To the person, subject "Confirmed: your visit to Peak Pickleball, ' + longDay + ' at 2:30 pm"');
    ok(m.text.startsWith('Hi Jamie,') && m.text.includes('When: ' + longDay + ', 2:30 pm Mountain time (30 minutes)') && m.text.includes('Where: Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920') && /parking lot off Jamboree Drive/.test(m.text) && !/You.ll meet/.test(m.text) && m.text.includes('inside the mall.\r\n\r\nA calendar invite') && m.text.includes('(719) 377-4725') && /reply to this email/.test(m.text) && m.text.trim().endsWith('Thanks,\r\nTest Seller\r\nPeak Pickleball'), 'the words: date, time (Mountain), length, address, entrance, Peak’s phone, reply to change it, signed by the booker; nobody set to meet visitors, so no "You’ll meet" line (never the seller)');
    ok(icsGet(m.cal.body, 'SUMMARY') === 'Visit to Peak Pickleball' && !/Test Seller|meet/i.test(m.cal.body), 'the invite: "Visit to Peak Pickleball", no seller named in it');
    ok(m.html.includes('2:30 pm Mountain time') && !/<img|<a |r\.php|o\.php/i.test(m.html) && !/https?:\/\//.test(m.text), 'the HTML part is the same words: no open image, no tracked links');
    const ics = m.cal.body;
    ok(/method=REQUEST/i.test(m.cal.ct) && /attachment; filename="invite.ics"/.test(m.att.head) && m.att.body === ics, 'a text/calendar part (method=REQUEST) for "Add to calendar", and the same invite attached as invite.ics');
    ok(icsGet(ics, 'METHOD') === 'REQUEST' && icsGet(ics, 'UID') === 'peak-tour-' + tidB + '@peakpickleball.us' && icsGet(ics, 'SEQUENCE') === '0' && icsGet(ics, 'DTSTART') === 'TZID=America/Denver:' + dB.replace(/-/g, '') + 'T143000' && icsGet(ics, 'DTEND') === 'TZID=America/Denver:' + dB.replace(/-/g, '') + 'T150000', 'the invite: METHOD:REQUEST, one UID for the tour, SEQUENCE 0, 2:30 to 3:00 pm America/Denver');
    ok(/BEGIN:VTIMEZONE\r\nTZID:America\/Denver/.test(ics) && /ORGANIZER;CN="Peak Pickleball":mailto:partnerships@peakpickleball.us/.test(ics.replace(/\r\n /g, '')) && /^From: "Peak Partnerships" <partnerships@peakpickleball.us>\r$/m.test(GM.sent[0]) && GM.boxes[0] === 'partnerships@peakpickleball.us' && /ATTENDEE;CN="Jamie Polson";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:jamie@example.com/.test(ics.replace(/\r\n /g, '')) && icsGet(ics, 'LOCATION') === 'Peak Pickleball\\, 1730 Briargate Blvd\\, Colorado Springs\\, CO 80920', 'with its time zone, Matthew\u2019s Peak address as organizer, the contact as attendee, the address as location');
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
    ok(r.mail.state === 'sent' && /^Updated: your visit to Peak Pickleball, /.test(m.subject) && /The time has changed/.test(m.text) && icsGet(m.cal.body, 'UID') === 'peak-tour-' + tidB + '@peakpickleball.us' && icsGet(m.cal.body, 'SEQUENCE') === '1' && /T090000$/.test(icsGet(m.cal.body, 'DTSTART')), 'moving it sends the new time: "Updated:", same UID, SEQUENCE 1');
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
    ok(r.mail.state === 'sent' && /^Cancelled: your visit/.test(m.subject) && /is cancelled/.test(m.text) && /method=CANCEL/i.test(m.cal.ct) && icsGet(m.cal.body, 'METHOD') === 'CANCEL' && icsGet(m.cal.body, 'STATUS') === 'CANCELLED' && icsGet(m.cal.body, 'SEQUENCE') === '3' && icsGet(m.cal.body, 'UID') === 'peak-tour-' + tidB + '@peakpickleball.us', 'cancelling it sends METHOD:CANCEL with the same UID, SEQUENCE 3');
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

  console.log('Desk emails and booking links (both OFF until Matthew says go; the stand-in for Microsoft, nothing reaches anyone)');
  {
    const E1 = LOC[120], E2 = LOC[121], E3 = LOC[122], E4 = LOC[123], XE = xseed.orgs[30], TD = LOC[104];
    const BKP = ORIGIN + '/api/book.php';
    const page = async (q, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130') => { const r = await fetch(BKP + q, { headers: { 'User-Agent': ua } }); return { status: r.status, text: await r.text(), ct: r.headers.get('content-type') || '' }; };
    const slotsOf = (html) => [...html.matchAll(/name="slot" value="([^"]+)"/g)].map((m) => m[1]);
    const ftOf = (html) => (html.match(/name="ft" value="([0-9a-f]+)"/) || [])[1] || '';
    const book = async (q, form) => { const p = await page(q); const r = await fetch(BKP + q, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams({ ft: ftOf(p.text), ...form }).toString() }); return r.text(); };
    const heads = () => lines('notify-out.jsonl').map((l) => JSON.parse(l)).filter((m) => m.to === '@notify');
    D = await b('data');
    ok(D.deskmail && D.deskmail.on === false && D.book && D.book.on === false && D.book.hours === 'Mon, Wed, Fri 2:00-4:00 pm · Tue, Thu 8:00 am-4:00 pm' && D.book.mins === 30 && D.book.notice === 24 && D.book.ahead === 14 && !D.book.blocked.length, 'both off by default; one shared schedule: Mon, Wed, Fri 2:00-4:00 pm · Tue, Thu 8:00 am-4:00 pm, 30 minutes, 24 hours notice, 14 days');
    ok(!('pixel' in D.deskmail) && D.deskmail.mine.sig === 'Test Seller\nPeak Pickleball' && (await a('data')).book.week === 'Mon 14:00-16:00\nTue 08:00-16:00\nWed 14:00-16:00\nThu 08:00-16:00\nFri 14:00-16:00', 'a seller’s signature starts as their desk name and Peak Pickleball; admins see the hours to edit');
    ok((await b('contact', { world: 'sponsor', id: E1.id, name: 'Robin Field', email: 'robin@example.com' })).ok && (await b('contact', { world: 'sponsor', id: E2.id, name: 'Avery Stone', email: 'avery@example.com' })).ok && (await b('contact', { world: 'expo', id: XE.id, name: 'Lee Show', email: 'lee@example.com' })).ok, 'contacts with emails (for below)');
    const msg = { world: 'sponsor', id: E1.id, to: 'robin@example.com', name: 'Robin Field', subject: 'Following up from today', text: 'Hi Robin,\n\nGood to talk today. Pick a time that suits you: {book}\n\nThanks,' };
    let n0 = GM.calls;
    let pv = await cc('dmpreview', msg);
    ok(pv.ok && pv.on === false && pv.book === 'off' && pv.text.startsWith('Hi Robin,') && /Thanks,\nClaude Check\nPeak Pickleball\n\nPeak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920\nIf you'd rather not get emails from Peak, reply and let me know\.$/.test(pv.text) && /book\.php\?m=dm0000000000-/.test(pv.text) && GM.calls === n0, 'Preview (while off; Claude Check may look): the words, the booking link, "Thanks," right above the signature, Peak’s address and an opt-out line; nothing sent');
    let r = await b('dmsend', msg);
    ok(r._status === 400 && /Desk emails are off/.test(r.error) && GM.calls === n0, 'while off, Send is refused and nothing goes');
    ok((await b('dmset', { on: true }))._status === 403 && (await cc('dmset', { on: true }))._status === 403 && (await b('bookset', { on: true }))._status === 403 && (await cc('bookset', { on: true }))._status === 403, 'only an admin turns either on (not a seller, not Claude Check)');
    const G = await a('bookgeneric', {}), gq = new URL(G.url).search, PL = await b('booklink', {}), pq = new URL(PL.url).search;
    ok(/\/api\/book\.php\?g=[0-9a-f]{16}$/.test(G.url) && /\/api\/book\.php\?p=[0-9a-f]{12}-[0-9a-f]{16}$/.test(PL.url) && (await b('bookgeneric', {}))._status === 403 && (await cc('booklink', {}))._status === 403, 'a personal link for each desk person, one general link (admins); unguessable');
    let pg = await page(pq);
    ok(pg.status === 200 && /Not taking bookings right now/.test(pg.text) && !slotsOf(pg.text).length && /\(719\) 377-4725/.test(pg.text), 'while off, every link answers "Not taking bookings right now"');
    ok(/That link did not work/.test((await page('?g=0000000000000000')).text) && /That link did not work/.test((await page(pq.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).text) && /That link did not work/.test((await page('')).text), 'a made-up or changed link does not work, and the bare page shows nothing');
    ok(/do not read right/.test((await a('bookset', { week: 'Tue 8-4' })).error) && /shorter than one meeting/.test((await a('bookset', { week: 'Mon 14:00-14:15' })).error) && /is not a date/.test((await a('bookset', { blocked: 'tomorrow' })).error) && /meeting length/.test((await a('bookset', { mins: 7 })).error), 'hours that don’t read right, a range shorter than a meeting, a bad date or length are refused');
    msConnect('reconnect'); ok(/can.t go on yet: the Microsoft sign-in for Peak email needs connecting again/.test((await a('dmset', { on: true })).error), 'desk emails will not go on while the Microsoft sign-in needs connecting again'); msConnect();
    r = await a('dmset', { on: true }); ok(r.ok && r.deskmail.on && (await b('data')).deskmail.on, 'the admin turns desk emails on (the test does it here; live it stays off for Matthew)');
    r = await b('dmsend', msg); ok(r._status === 400 && /Booking links are off/.test(r.error) && GM.calls === n0, 'an email with {book} is refused while booking links are off');
    r = await a('bookset', { on: true }); ok(r.ok && r.book.on && r.book.open > 20, 'the admin turns booking links on: ' + r.book.open + ' times open');
    /* the page: only the shared hours, Mountain time, nothing of the desk */
    pg = await page(pq); let SL = slotsOf(pg.text);
    const inHours = (v) => { const [d, t] = v.split(' '), dow = new Date(d + 'T12:00:00').getDay(), hm = +t.slice(0, 2) * 60 + +t.slice(3); return (t.endsWith(':00') || t.endsWith(':30')) && ([1, 3, 5].includes(dow) ? hm >= 840 && hm <= 930 : [2, 4].includes(dow) ? hm >= 480 && hm <= 930 : false); };
    const minAhead = (v) => (new Date(v.replace(' ', 'T') + ':00').getTime() - Date.now()) / 3600000;
    D = await b('data'); const busy = D.sponsor.tours.concat(D.expo.tours).map((t) => t.date + ' ' + t.time);
    ok(pg.status === 200 && SL.length > 20 && SL.every(inHours) && SL.every((v) => minAhead(v) >= 23.9) && SL.every((v) => minAhead(v) <= 15 * 24) && !SL.some((v) => busy.includes(v)), `the page shows only open times in the shared hours, 24 hours ahead or more, within 14 days, none already toured (${SL.length}; first ${SL[0]})`);
    ok(pg.text.includes('A 30-minute visit to Peak Pickleball. Pick a time below. Times are Mountain time.') && !/Test Seller/.test(pg.text) && /Mountain time/.test(pg.text) && /1730 Briargate Blvd/.test(pg.text) && /Jamboree Drive/.test(pg.text) && /Company or organisation/.test(pg.text) && /Sponsoring at Peak/.test(pg.text) && !/Kaiser|Robin|Test Seller|peak-desk|desk\.php/.test(pg.text) && /noindex/.test(pg.text), 'Peak-branded: "A 30-minute visit to Peak Pickleball. Pick a time below." (a personal link, nobody set to meet visitors: no name, never the seller), Mountain time, the address and entrance; no desk data');
    /* a booking from a personal link: someone new */
    const S1 = SL[0]; n0 = GM.calls; const h0 = heads().length;
    let out = await book(pq, { slot: S1, name: 'Jordan New', email: 'Jordan@NewCo.example', company: 'Brand New Co', topic: 'sponsor', note: 'Bring the sponsor sheet' });
    D = await b('data'); let NR = D.sponsor.recs.find((x) => x.name === 'Brand New Co'), TN = NR && D.sponsor.tours.find((t) => t.lead === NR.id);
    ok(/You are booked/.test(out) && /\(Mountain time\), 30 minutes\.<\/p>/.test(out) && !/Test Seller/.test(out) && /on its way to jordan@newco\.example/.test(out) && /Add it to my calendar/.test(out), 'booked: "<when> (Mountain time), 30 minutes." (no seller named), where, and that the confirmation is on its way');
    ok(NR && NR.why === 'Booked from link' && NR.list === 'added' && NR.stage === 'meeting' && NR.owner === 'Test Seller' && NR.people.some((p) => p.email === 'jordan@newco.example'), 'someone new: a new lead "Booked from link" at Meeting / tour booked, the link’s owner its owner, the person on it');
    ok(TN && TN.date + ' ' + TN.time === S1 && TN.src === 'link' && TN.host === 'Test Seller' && TN.by === 'Test Seller' && TN.mins === 30 && TN.email === 'jordan@newco.example' && /Bring the sponsor sheet/.test(TN.note), 'the tour: that slot, 30 minutes, from a link, Test Seller its host');
    let m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(GM.calls === n0 + 1 && /jordan@newco\.example/.test(m.to) && /^Confirmed: your visit/.test(m.subject) && !/You.ll meet/.test(m.text) && /Thanks,\r\nTest Seller\r\nPeak Pickleball/.test(m.text) && !/Test Seller/.test(m.text.replace('Thanks,\r\nTest Seller', '')) && icsGet(m.cal.body, 'METHOD') === 'REQUEST' && icsGet(m.cal.body, 'SUMMARY') === 'Visit to Peak Pickleball' && !/Test Seller/.test(m.cal.body), 'the tour confirmation and its invite go to them (that switch is on in the test): no "You’ll meet" and no seller in the invite; only signed by the seller whose link it was');
    let hd = heads().slice(h0);
    ok(hd.length === 1 && /^Peak: Brand New Co booked a visit, .* \(with Test Seller\)$/.test(hd[0].subject) && /Jordan New \(jordan@newco\.example\)/.test(hd[0].body) && /Test Seller’s booking link/.test(hd[0].body) && /a new lead, marked Booked from link/.test(hd[0].body) && /They wrote: Bring the sponsor sheet/.test(hd[0].body), 'Matthew gets a heads-up email (who, when, whose link, new lead, their note)');
    pg = await page(pq); ok(!slotsOf(pg.text).includes(S1) && slotsOf((await page(gq)).text).indexOf(S1) < 0, 'that time is gone for everyone, from every link');
    const ics = await page('?ics=' + TN.tid + '-' + (out.match(/\?ics=[0-9a-f]{10}-([0-9a-f]{12})/) || [])[1]);
    ok(/text\/calendar/.test(ics.ct) && /METHOD:PUBLISH/.test(ics.text) && /DTSTART;TZID=America\/Denver:/.test(ics.text) && icsGet(ics.text, 'SUMMARY') === 'Visit to Peak Pickleball' && !/Test Seller|meet/i.test(ics.text) && (await page('?ics=' + TN.tid + '-000000000000')).status === 404, '"Add it to my calendar" gives the visit as a calendar file, "Visit to Peak Pickleball", no seller (a forged one gives nothing)');
    out = await book(pq, { slot: slotsOf(pg.text)[0], name: 'Jordan New', email: 'jordan@newco.example', company: 'Brand New Co', topic: 'sponsor' });
    ok(/You already have a time/.test(out) && /\(Mountain time\)\.<\/p>/.test(out) && !/Test Seller/.test(out) && D.sponsor.tours.filter((t) => t.email === 'jordan@newco.example').length === 1, 'the same person again: "You already have a time" (no seller named), nothing new booked');
    /* Who meets visitors (2026-11-20): one desk-wide setting; the visitor sees it, never the seller; the seller still owns the tour */
    ok((await b('bookset', { meet: 'Tyler' }))._status === 403 && /under 60 characters/.test((await a('bookset', { meet: 'x'.repeat(61) })).error) && /plain words/.test((await a('bookset', { meet: 'Tyler {me}' })).error) && (await a('data')).book.meet === '' && (await b('data')).book.meet === '', 'Who meets visitors: admins only, up to 60 characters, plain words; empty to start');
    r = await a('bookset', { meet: '  Tyler at Peak ' });
    ok(r.ok && r.book.meet === 'Tyler at Peak' && r.book.on === true && r.book.hours === 'Mon, Wed, Fri 2:00-4:00 pm · Tue, Thu 8:00 am-4:00 pm' && (await b('data')).book.meet === 'Tyler at Peak' && JSON.parse(lines('book-settings.log').slice(-1)[0]).meet === 'Tyler at Peak', 'set through the booking settings (trimmed, logged); booking links stay on and the hours unchanged');
    pg = await page(pq);
    ok(pg.text.includes('A 30-minute visit to Peak Pickleball with Tyler at Peak. Pick a time below. Times are Mountain time.') && !/Test Seller/.test(pg.text), 'the page: "A 30-minute visit to Peak Pickleball with Tyler at Peak." (the seller’s own link, still not the seller)');
    n0 = GM.calls; const h1 = heads().length, S4 = slotsOf(pg.text)[0];
    out = await book(pq, { slot: S4, name: 'Casey Meet', email: 'casey@meetco.example', company: 'Meet Co', topic: 'sponsor' });
    D = await b('data'); const MR = D.sponsor.recs.find((x) => x.name === 'Meet Co'), TM4 = MR && D.sponsor.tours.find((t) => t.lead === MR.id);
    m = mimeParts(GM.sent[GM.sent.length - 1]); const cal4 = m.cal.body.replace(/\r\n /g, '');
    ok(/\(Mountain time\), 30 minutes, with Tyler at Peak\.<\/p>/.test(out) && !/Test Seller/.test(out), 'booked: "<when> (Mountain time), 30 minutes, with Tyler at Peak."');
    ok(GM.calls === n0 + 1 && m.text.includes("You'll meet: Tyler at Peak\r\n") && m.text.trim().endsWith('Thanks,\r\nTest Seller\r\nPeak Pickleball') && icsGet(m.cal.body, 'SUMMARY') === 'Visit to Peak Pickleball (meeting Tyler at Peak)' && cal4.includes("DESCRIPTION:You'll meet Tyler at Peak.") && !/Test Seller/.test(cal4), 'the confirmation: "You’ll meet: Tyler at Peak", still signed by the seller; the invite "Visit to Peak Pickleball (meeting Tyler at Peak)", no seller in it');
    const ics4 = await page('?ics=' + TM4.tid + '-' + (out.match(/\?ics=[0-9a-f]{10}-([0-9a-f]{12})/) || [])[1]);
    ok(ics4.text.replace(/\r\n /g, '').includes('SUMMARY:Visit to Peak Pickleball (meeting Tyler at Peak)') && !/Test Seller/.test(ics4.text), 'the page’s calendar file names Tyler at Peak too');
    let hd4 = heads().slice(h1);
    ok(TM4 && TM4.host === 'Test Seller' && TM4.by === 'Test Seller' && MR.owner === 'Test Seller' && hd4.length === 1 && /\(with Test Seller\)$/.test(hd4[0].subject) && /Test Seller’s booking link/.test(hd4[0].body) && /Host: Test Seller/.test(hd4[0].body), 'inside the desk nothing changes: the seller is the tour’s host and the owner, and Matthew’s heads-up says whose link it came from');
    /* older saved wording with "You'll meet: {me}" reads as who meets visitors */
    const WL = { ...(await a('data')).tourmail.words }; ok(WL.body.includes("You'll meet: {meet}\n"), 'the first wording says "You’ll meet: {meet}"');
    WL.body = WL.body.replace("You'll meet: {meet}", "You'll meet: {me}");
    ok((await a('tourmailset', { words: WL })).ok && (await a('data')).tourmail.words.body.includes("You'll meet: {meet}\n") && (await a('tourpreview', { world: 'sponsor', sample: 1 })).text.includes("You'll meet: Tyler at Peak\n"), 'wording saved with "You’ll meet: {me}" (the seller) is read as {meet}');
    r = await a('bookset', { meet: '' }); let pv0 = await a('tourpreview', { world: 'sponsor', sample: 1 });
    ok(r.ok && r.book.meet === '' && !/You.ll meet/.test(pv0.text) && pv0.text.includes('inside the mall.\n\nA calendar invite') && /Thanks,\n(Matthew|Test Admin|[A-Z][a-z]+)/.test(pv0.text) && icsGet(pv0.ics, 'SUMMARY') === 'Visit to Peak Pickleball' && !/meet/i.test(pv0.ics) && (await a('tourmailset', { reset: 1 })).tourmail.custom === false, 'cleared again: the line and the name are left out cleanly; the first wording back');
    /* two people, one slot, the same moment */
    SL = slotsOf((await page(gq)).text); const S2 = SL[0], ft = ftOf((await page(gq)).text);
    const two = await Promise.all(['a', 'b'].map((k) => fetch(BKP + gq, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ft, slot: S2, name: 'Racer ' + k, email: 'racer-' + k + '@example.com', company: 'Racer ' + k.toUpperCase() + ' Inc', topic: 'sponsor' }).toString() }).then((x) => x.text())));
    D = await b('data');
    ok(two.filter((x) => /You are booked/.test(x)).length === 1 && two.filter((x) => /That time was just taken/.test(x)).length === 1 && D.sponsor.tours.concat(D.expo.tours).filter((t) => t.date + ' ' + t.time === S2).length === 1, 'two people take the same slot at once: one is booked, the other is told it was just taken');
    const RG = D.sponsor.tours.find((t) => t.date + ' ' + t.time === S2);
    ok(RG && RG.host === '' && RG.by === 'Booking link' && D.sponsor.recs.find((x) => x.id === RG.lead).owner === '' && /nobody yet/.test(heads().slice(-1)[0].body), 'from the general link: no host, nobody made owner, Matthew’s heads-up says to pick one');
    /* a tour typed on the desk takes its slot away too; a blocked date has none */
    const S3 = SL[3]; ok((await b('tour', { world: 'expo', id: XE.id, date: S3.split(' ')[0], time: S3.split(' ')[1], who: 'Lee Show' })).ok && !slotsOf((await page(gq)).text).includes(S3), 'a tour typed on the desk (even on the Expo leads) takes that time away from every link');
    const dB = SL[SL.length - 1].split(' ')[0];
    ok((await a('bookset', { blocked: dB })).book.blocked.join() === dB && !slotsOf((await page(gq)).text).some((v) => v.startsWith(dB)) && (await a('bookset', { blocked: '' })).book.blocked.length === 0, 'a blocked date has no times (and comes back when unblocked)');
    ok((await a('bookset', { week: 'Tue 08:00-09:00', mins: 60 })).book.hours === 'Tue 8:00-9:00 am' && slotsOf((await page(gq)).text).every((v) => new Date(v.split(' ')[0] + 'T12:00:00').getDay() === 2 && v.endsWith('08:00')) && (await a('bookset', { week: D.book.week || 'Mon 14:00-16:00\nTue 08:00-16:00\nWed 14:00-16:00\nThu 08:00-16:00\nFri 14:00-16:00', mins: 30 })).book.hours === 'Mon, Wed, Fri 2:00-4:00 pm · Tue, Thu 8:00 am-4:00 pm', 'the admin changes the hours and the length; the page follows; and back');
    /* an expo organiser from the general link who is already on the Expo leads lands on that card */
    SL = slotsOf((await page(gq)).text); out = await book(gq, { slot: SL[0], name: 'Pat Organiser', email: 'pat-org@example.com', company: XE.name, topic: 'expo' });
    D = await b('data'); const XR = find('expo', XE.id);
    ok(/You are booked/.test(out) && D.expo.tours.some((t) => t.lead === XE.id && t.src === 'link' && t.email === 'pat-org@example.com') && XR.stage === 'tour' && !D.expo.recs.some((x) => x.id !== XE.id && x.name === XE.name), 'someone already on the Expo leads (same name) lands on that card at Tour booked, no double made');

    /* Write an email: sent from Matthew's Peak Outlook, signed by the seller, logged on the card */
    D = await b('data'); const wk0 = (D.sponsor.week['Test Seller'] || {}).emails || 0; n0 = GM.calls;
    r = await b('dmsend', { ...msg, fu: later(3), fuWhat: 'see if Robin booked' });
    m = mimeParts(GM.sent[GM.sent.length - 1]); const ref1 = r.ref;
    ok(r.ok && r.state === 'sent' && r.to === 'robin@example.com' && GM.calls === n0 + 1 && /^dm[0-9a-f]{10}$/.test(ref1), 'Send: it goes, once');
    const link1 = (m.text.match(/(http:\/\/127\.0\.0\.1:\d+\/api\/book\.php\?m=dm[0-9a-f]{10}-[0-9a-f]{12})/) || [])[1] || '';
    ok(/^Robin Field <robin@example.com>$/.test(m.to) && m.subject === 'Following up from today' && /multipart\/alternative/.test(m.top) && m.text.startsWith('Hi Robin,\r\n\r\nGood to talk today. Pick a time that suits you: http') && /Thanks,\r\nTest Seller\r\nPeak Pickleball\r\n\r\nPeak Pickleball, 1730 Briargate Blvd/.test(m.text) && link1, 'to Robin, the subject as typed, the words as typed with the booking link for this email, signed by the seller, Peak’s address under it');
    ok(m.html.includes('<a href="' + link1 + '">') && !/<img/i.test(m.html) && !/^Reply-To:/m.test(GM.sent[GM.sent.length - 1]) && !m.parts.some((p) => p.type === 'text/calendar'), 'the HTML part is the same words with the link clickable; no open image (off), no Reply-To (replies come to Matthew), no invite');
    ok(m.html.includes('<a href="' + link1 + '">Pick a time that suits you</a>') && !/>https?:\/\/[^<]*book\.php/.test(m.html), 'HTML link text (20 Nov): "Pick a time that suits you" is the link; the long booking address never shows in the HTML');
    D = await b('data'); let R1 = find('sponsor', E1.id), t1 = R1.touches.find((x) => x.dm === ref1);
    ok(t1 && t1.m === 'email' && t1.out === 'sent' && t1.by === 'Test Seller' && t1.note === 'Emailed “Following up from today” to Robin Field (robin@example.com) from the desk' && R1.stage === 'emailed' && R1.owner === 'Test Seller' && R1.next.date === later(3) && R1.next.what === 'see if Robin booked', 'on the Activity: Emailed, by the seller; To contact → Emailed; the seller owns it; the follow-up set');
    ok(((D.sponsor.week['Test Seller'] || {}).emails || 0) === wk0 + 1 && R1.dmails[0].ref === ref1 && R1.dmails[0].state === 'sent' && R1.dmails[0].text === msg.text && R1.dmails[0].book === true, 'counted as the seller’s email this week; the whole email kept on the card');
    r = await b('dmretry', { world: 'sponsor', id: E1.id, ref: ref1 }); ok(r.ok && r.state === 'dup' && GM.calls === n0 + 1, 'Retry on one that went: nothing sent again');
    /* the link in that email: filled in for Robin, books onto this card with the seller as host */
    const mq = new URL(link1).search; pg = await page(mq);
    ok(/for /.test(pg.text) && pg.text.includes(E1.name.replace(/&/g, '&amp;').replace(/'/g, '&#039;')) && /value="Robin Field"/.test(pg.text) && /value="robin@example.com"/.test(pg.text) && !/Company or organisation/.test(pg.text) && pg.text.includes('A 30-minute visit to Peak Pickleball, for ') && !/Test Seller/.test(pg.text), 'the email’s link: "A 30-minute visit to Peak Pickleball, for <company>." (no seller named), Robin’s name and email filled in');
    const ev = lines('book-events.log').map((l) => JSON.parse(l)).filter((x) => x.ref === ref1);
    ok(ev.length === 1 && ev[0].t === 'view' && ev[0].bot === 1, 'its views are counted (one this soon after sending is taken for a mail scanner, as the Peak email does)');
    writeFileSync(join(LD, 'book-events.log'), JSON.stringify({ t: 'view', src: 'm', host: 'Test Seller', ref: ref1, bot: 0, at: Math.floor(Date.now() / 1000) }) + '\n', { flag: 'a' });
    out = await book(mq, { slot: slotsOf(pg.text)[1], name: 'Robin Field', email: 'robin@example.com', note: '' });
    D = await b('data'); R1 = find('sponsor', E1.id);
    ok(/You are booked/.test(out) && D.sponsor.tours.some((t) => t.lead === E1.id && t.src === 'link' && t.host === 'Test Seller' && t.from === 'm') && R1.stage === 'meeting' && R1.dmails[0].views === 1 && R1.dmails[0].booked === 1, 'Robin books from it: on this card (Meeting / tour booked), the seller the host; the card shows the link opened once and booked');
    D = await b('data'); ok(D.book.views >= 1 && D.book.booked >= 2, 'My booking link counts the seller’s visits and bookings: ' + D.book.views + ' and ' + D.book.booked);
    /* refusals */
    n0 = GM.calls;
    ok(/Don't contact/.test((await b('dmsend', { world: 'sponsor', id: TD.id, to: 'dee@example.com', subject: 'Hi', text: 'Hello' })).error) && GM.calls === n0, 'never to someone marked Don’t contact');
    writeFileSync(join(MAILD, 'events.log'), JSON.stringify({ t: 'unsub', to: 'gone@example.com', at: Math.floor(Date.now() / 1000) }) + '\n', { flag: 'a' });
    ok(/do-not-email list \(unsubscribed\)/.test((await b('dmsend', { world: 'sponsor', id: E2.id, to: 'gone@example.com', subject: 'Hi', text: 'Hello' })).error) && GM.calls === n0, 'nor to an address on the Peak email do-not-email list (unsubscribed)');
    ok(/still has \{first\}/.test((await b('dmsend', { world: 'sponsor', id: E2.id, to: 'avery@example.com', subject: 'Hi', text: 'Hi {first},' })).error) && /Write the message/.test((await b('dmsend', { world: 'sponsor', id: E2.id, to: 'avery@example.com', subject: 'Hi', text: ' ' })).error) && /Pick who it goes to/.test((await b('dmsend', { world: 'sponsor', id: E2.id, to: 'nope', subject: 'Hi', text: 'x' })).error), 'an unfilled {field}, an empty message or a bad address is refused');
    ok((await cc('dmsend', { world: 'sponsor', id: E2.id, to: 'avery@example.com', subject: 'Hi', text: 'Hello' }))._status === 403 && GM.calls === n0, 'Claude Check cannot send');
    /* my signature and reply address */
    ok(/does not look right/.test((await b('myset', { sig: 'x', replyto: 'nope' })).error), 'a reply address that is not an email is refused');
    r = await b('myset', { sig: 'Test Seller\nPeak Pickleball\n(719) 555-0100', replyto: 'Seller@Example.com' });
    ok(r.ok && r.mine.replyto === 'seller@example.com' && (await b('data')).deskmail.mine.sig.endsWith('(719) 555-0100') && (await c2('data')).deskmail.mine.sig === 'Second Seller\nPeak Pickleball', 'each person’s own signature and reply address (one person’s does not change another’s)');
    /* a failure stays on the card with Retry; two Retries at once send it once */
    GM.fail = { code: 503, err: 'ServiceUnavailable' };
    r = await b('dmsend', { world: 'sponsor', id: E2.id, to: 'avery@example.com', name: 'Avery Stone', subject: 'Dates for a visit', text: 'Hi Avery,\n\nWould next week work?' });
    D = await b('data'); let R2 = find('sponsor', E2.id);
    ok(r.ok && r.state === 'failed' && /Microsoft did not answer/.test(r.why) && R2.dmails[0].state === 'failed' && /Microsoft did not answer/.test(R2.dmails[0].why) && !R2.touches.some((x) => x.dm) && R2.stage === 'new', 'Microsoft down: kept on the card as not sent, with why; no touch, the stage stays');
    const st1 = JSON.parse(execFileSync('php', ['-r', 'require getenv("LIB"); echo json_encode(pmDeskMailStats());'], { encoding: 'utf8', env: { ...env, LIB: env.DESK_PEAK_MAIL_LIB } }));
    ok(st1.open.length === 1 && st1.open[0].to === 'avery@example.com' && st1.open[0].by === 'Test Seller', 'the sender’s log has it as not sent (Outbox flags it)');
    GM.fail = null; n0 = GM.calls;
    const rr2 = await Promise.all([b('dmretry', { world: 'sponsor', id: E2.id, ref: r.ref }), c2('dmretry', { world: 'sponsor', id: E2.id, ref: r.ref })]);
    D = await b('data'); R2 = find('sponsor', E2.id); m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(rr2.every((x) => x.ok) && GM.calls === n0 + 1 && R2.dmails[0].state === 'sent' && R2.touches.filter((x) => x.dm === r.ref).length === 1 && R2.touches.find((x) => x.dm === r.ref).by === 'Test Seller' && R2.stage === 'emailed', 'two Retries at once: sent once, one touch, by the person who wrote it');
    ok(/^Reply-To: Test Seller <seller@example.com>\r$/m.test(GM.sent[GM.sent.length - 1]) && m.text.includes('Test Seller\r\nPeak Pickleball\r\n(719) 555-0100'), 'with the reply address set, replies go to the seller; the signature has their phone');
    /* the expo leads too; the open image only when the admin setting is on */
    r = await a('dmset', { pixel: true }); ok(r.ok && r.deskmail.pixel === true, 'the admin turns the open image on');
    r = await c2('dmsend', { world: 'expo', id: XE.id, to: 'lee@example.com', subject: 'Your show at Peak', text: 'Hi Lee,\n\nA few dates for you.' });
    m = mimeParts(GM.sent[GM.sent.length - 1]); const px = (m.html.match(/<img src="([^"]+)"/) || [])[1] || '';
    ok(r.state === 'sent' && /book\.php\?px=dm[0-9a-f]{10}-[0-9a-f]{12}$/.test(px.replace(/&amp;/g, '&')), 'expo leads too; with the setting on, the HTML ends in a 1x1 image');
    const gif = await fetch(px.replace(/&amp;/g, '&')); ok(/image\/gif/.test(gif.headers.get('content-type') || ''), 'the image answers a GIF');
    D = await b('data'); ok(find('expo', XE.id).dmails[0].opens === 1 && find('expo', XE.id).touches.some((x) => x.dm === r.ref && x.by === 'Second Seller'), 'and the card shows the email opened once');
    /* 2026-11-20: a tour confirmation gets the same open image while that setting is on; the tour shows "opened"; Outbox counts it from book-events.log */
    r = await c2('tour', { world: 'expo', id: XE.id, date: later(9), time: '11:30', who: 'Lee Expo', email: 'lee@example.com', mail: true });
    m = mimeParts(GM.sent[GM.sent.length - 1]); const tpx = ((m.html.match(/<img src="([^"]+)"/) || [])[1] || '').replace(/&amp;/g, '&');
    const tref = 'tc-' + String(r.tid).replace(/[^a-z0-9]/g, '') + '-0-r';
    ok(r.mail && r.mail.state === 'sent' && tpx.endsWith('book.php?px=' + tref + '-' + (tpx.split('-').pop())) && /-[0-9a-f]{12}$/.test(tpx) && lines('book-events.log').some((l) => { const j = JSON.parse(l); return j.t === 'pxsent' && j.ref === tref; }), 'a tour confirmation (setting on): the desk’s 1x1 image on the email, and a "sent with the image" row for Outbox');
    D = await b('data'); let TT = D.expo.tours.find((x) => x.tid === r.tid);
    ok(TT.tms.s === 'sent' && TT.tms.opened === false && !/opened/.test(TT.tms.text), 'not opened yet: the tour says only that it went');
    ok(/image\/gif/.test((await fetch(tpx)).headers.get('content-type') || '') && (await fetch(tpx.replace(/-[0-9a-f]{12}$/, '-000000000000'))).status === 200, 'its image answers a GIF (a forged one too, but only the signed one counts)');
    D = await b('data'); TT = D.expo.tours.find((x) => x.tid === r.tid);
    ok(TT.tms.opened === true && /; opened$/.test(TT.tms.text) && lines('book-events.log').filter((l) => { const j = JSON.parse(l); return j.t === 'open' && j.ref === tref; }).length === 1, 'opened: the tour says so; the forged image was not counted');
    const tst = await a('tourmailtest', { email: 'matthew-test@example.com' }); m = mimeParts(GM.sent[GM.sent.length - 1]);
    ok(tst.ok && !/<img /.test(m.html), 'the Settings test never carries the image');
    ok((await a('dmset', { pixel: false })).deskmail.pixel === false, 'the open image off again (its default)');
    /* Peak Partnerships (2026-11-19): who it goes out as, read only; their replies on the card for everyone, with Reply in the same thread */
    D = await b('data');
    ok(D.sendFrom && D.sendFrom.email === 'partnerships@peakpickleball.us' && D.sendFrom.name === 'Peak Partnerships' && D.deskmail.from === 'partnerships@peakpickleball.us' && D.tourmail.from === 'partnerships@peakpickleball.us' && GM.boxes.every((x) => x === 'partnerships@peakpickleball.us'), 'every desk email and confirmation went out as Peak Partnerships; the page shows it');
    const inject = (code, extra) => execFileSync('php', ['-r', 'require getenv("STORE"); ' + code], { encoding: 'utf8', env: { ...env, STORE: join(WEB, 'api/desk-store.php'), ID: E4.id, ...extra } });
    const KM = { from: 'kim@replytest.com', name: 'Kim Reyes', subject: 'RE: Hi', at: Math.floor(Date.now() / 1000) - 60, text: 'Yes, Thursday works.\n\nKim', files: ['Sponsor terms.pdf'], mid: 'AAMkReplyId1', mb: 'partnerships@peakpickleball.us', imid: '<k1@replytest.com>' };
    inject('echo json_encode(deskReplied("sponsor", getenv("ID"), "Kim Reyes", "“RE: Hi”", "Peak email", "reply:t1", false, json_decode(getenv("MAIL"), true)));', { MAIL: JSON.stringify(KM) });
    inject('echo json_encode(deskAutoReplied("sponsor", getenv("ID"), "Lee Park", json_decode(getenv("MAIL"), true), "Peak email", "auto:t2"));', { MAIL: JSON.stringify({ from: 'lee@replytest.com', name: 'Lee Park', subject: 'Automatic reply: Hi', text: 'Out until Monday.', mid: 'AAMkReplyId2', mb: 'partnerships@peakpickleball.us' }) });
    D = await b('data'); const KT = find('sponsor', E4.id).touches.find((x) => x.mail && x.mail.from === 'kim@replytest.com'), LT = find('sponsor', E4.id).touches.find((x) => x.out === 'auto');
    ok(KT && KT.out === 'replied' && KT.mail.text === 'Yes, Thursday works.\n\nKim' && KT.mail.rp === 1 && !('mid' in KT.mail) && !('mb' in KT.mail) && !JSON.stringify(D).includes('AAMkReplyId') && find('sponsor', E4.id).next.date === D.today, 'their reply on the card for every desk sign-in (the page never gets where the message is), with a follow-up today');
    ok(LT && LT.mail.auto === 1 && !LT.mail.rp && find('sponsor', E4.id).touches.filter((x) => x.out === 'replied').length === 1, 'an out-of-office shows as one, cannot be replied to, and is not a reply');
    ok(/no longer on the card/.test((await b('dmsend', { world: 'sponsor', id: E4.id, to: 'kim@replytest.com', subject: 'RE: Hi', text: 'Hello', re: 'nosuchkey1' })).error), 'a Reply to an email not on the card is refused');
    n0 = GM.calls; r = await b('dmsend', { world: 'sponsor', id: E4.id, to: 'kim@replytest.com', name: 'Kim Reyes', subject: 'RE: Hi', text: 'Great, see you Thursday.', re: KT.k });
    const RP = GM.replies[GM.replies.length - 1] || {}; D = await b('data');
    ok(r.ok && r.state === 'sent' && GM.calls === n0 + 1 && RP.of === 'AAMkReplyId1' && RP.box === 'partnerships@peakpickleball.us' && RP.create.message.toRecipients[0].emailAddress.address === 'kim@replytest.com' && RP.subject === 'RE: Hi'
      && /Great, see you Thursday\.[\s\S]*Test Seller[\s\S]*Their email, quoted/.test(RP.body.content) && find('sponsor', E4.id).touches.some((x) => x.dm === r.ref && /^Replied “RE: Hi” to Kim Reyes/.test(x.note)), 'Reply: Microsoft’s own reply on her message in Peak Partnerships (same thread), signed by the seller, logged as Replied');
    /* the Peak email sender's {book}: its own link, signed by the desk, lands on that company's card; the sender hears of it */
    const ou = execFileSync('php', ['-r', 'require getenv("LIB"); echo pmBookDesk(["kind" => "org", "org" => getenv("ORG"), "to" => "casey3@example.com", "person" => "Casey Three", "company" => getenv("CO"), "list" => "sponsors", "rid" => "0123456789"]);'],
      { encoding: 'utf8', env: { ...env, LIB: env.DESK_PEAK_MAIL_LIB, PEAK_DESK_STORE: join(WEB, 'api/desk-store.php'), PEAK_DESK_DATA: LD, ORG: E3.id, CO: E3.name } }).trim();
    pg = await page(new URL(ou).search);
    ok(/\?o=[A-Za-z0-9_-]+\.[0-9a-f]{16}$/.test(ou) && /value="Casey Three"/.test(pg.text) && /value="casey3@example.com"/.test(pg.text) && !/Company or organisation/.test(pg.text), 'the Peak email’s {book}: the desk’s page, filled in for that person');
    out = await book(new URL(ou).search, { slot: slotsOf(pg.text)[2], name: 'Casey Three', email: 'casey3@example.com' });
    D = await b('data'); const mev = readFileSync(join(MAILD, 'events.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    ok(/You are booked/.test(out) && D.sponsor.tours.some((t) => t.lead === E3.id && t.from === 'o' && t.host === '') && find('sponsor', E3.id).stage === 'meeting' && mev.some((x) => x.t === 'booked' && x.to === 'casey3@example.com' && x.desk === 1 && x.org === E3.id) && mev.some((x) => x.t === 'desk' && x.op === 'booked' && x.ok), 'booked: on that company’s card; the sender logs it as booked (its rates stay right) and does not push it to the desk again');
    ok(/the Peak email \(\{book\}\)/.test(heads().slice(-1)[0].body), 'Matthew’s heads-up says it came from the Peak email');
    /* at most 10 tries an hour from one address (this test has used 8: one more since the Who meets visitors booking, 2026-11-20) */
    { const tq = new URL(PL.url).search, f0 = ftOf((await page(tq)).text); const outs = []; for (let i = 0; i < 3; i++) outs.push(await (await fetch(BKP + tq, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ft: f0, slot: '2020-01-01 10:00', name: 'x', email: 'x@example.com', company: 'x' }).toString() })).text());
      ok(outs.slice(0, 2).every((x) => /That time was just taken/.test(x)) && /Too many tries/.test(outs[2]), 'the page takes at most 10 tries an hour from one address'); }
    /* the log is the record */
    const before = JSON.stringify([find('sponsor', E1.id).dmails, find('sponsor', E2.id).touches.length, D.sponsor.tours.filter((t) => t.src === 'link').length]);
    php(['rebuild']); D = await b('data');
    ok(JSON.stringify([find('sponsor', E1.id).dmails, find('sponsor', E2.id).touches.length, D.sponsor.tours.filter((t) => t.src === 'link').length]) === before, 'php desk.php rebuild: the same emails, touches and link bookings');
    ok(lines('deskmail-settings.log').length >= 3 && lines('book-settings.log').length >= 3, 'each change of either switch or the hours is logged');
    ok(!/RT-|AT-\d|mock-secret/.test(readFileSync(join(LD, 'book-events.log'), 'utf8') + lines('notify-out.jsonl').join('')), 'no token or secret in the booking log or the heads-ups');
    /* Peak's own link address (X-16, 2026-11-20): with peak-desk-data/peak-links.json on, every booking link the desk hands out and its
       open image are on https://links.peakpickleball.us/book/ (same signatures, same page); without it, as before */
    {
      const LF = join(LD, 'peak-links.json'), PB = 'https://links.peakpickleball.us/book/';
      const viaLib = (code, extra = {}) => execFileSync('php', ['-r', 'define("DATA_DIR", getenv("DESK_DATA")); require getenv("STORE"); require getenv("TM"); require getenv("BL"); ' + code],
        { encoding: 'utf8', env: { ...env, STORE: join(WEB, 'api/desk-store.php'), TM: join(WEB, 'api/tour-mail.php'), BL: join(WEB, 'api/book-lib.php'), ...extra } });
      writeFileSync(LF, JSON.stringify({ base: 'https://links.peakpickleball.us', by: 'test' }));
      const G2 = await a('bookgeneric', {}), P2 = await b('booklink', {});
      ok(G2.url === PB + gq && P2.url === PB + pq, 'on: the general and personal links are links.peakpickleball.us/book/ with the same codes: ' + G2.url.slice(0, 50));
      pg = await page(new URL(G2.url).search);
      ok(pg.status === 200 && /Book a time with Peak Pickleball/.test(pg.text) && !/traverseplatforms/i.test(pg.text), 'the page answers those codes, and says nothing of Traverse');
      pv = await cc('dmpreview', msg);
      ok(pv.ok && pv.text.includes(PB + '?m=dm0000000000-') && !/traverseplatforms/i.test(pv.text), 'a desk email’s {book} is on links.peakpickleball.us; not one traverseplatforms.com in it');
      const px = viaLib('echo bkPixelUrl("dm0000000001"), "\\n", bkMsgUrl("dm0000000001"), "\\n", bkOutreachUrl(["w" => "sponsor", "org" => "x", "to" => "a@b.c"]);').trim().split('\n');
      ok(px[0].startsWith(PB + '?px=dm0000000001-') && px[1].startsWith(PB + '?m=dm0000000001-') && px[2].startsWith(PB + '?o='), 'the open image and the sender’s {book} link too');
      for (const bad of ['http://links.peakpickleball.us', 'https://links.example.com', 'https://links.peakpickleball.us/x']) {
        writeFileSync(LF, JSON.stringify({ base: bad })); ok((await a('bookgeneric', {})).url === G.url, 'a setting that is not https on a peakpickleball.us name is ignored: ' + bad);
      }
      rmSync(LF);
      ok((await a('bookgeneric', {})).url === G.url && (await b('booklink', {})).url === PL.url, 'off again: the links are exactly what they were');
      /* the invite's UID: a tour keeps the UID of its first invite; tours made from 2026-11-21 are @peakpickleball.us */
      const u = JSON.parse(viaLib('echo json_encode([tmUid(["tid" => "ab12", "at" => 1795244399]), tmUid(["tid" => "ab12", "at" => 1795244400]), tmUid(["tid" => "ab12"])]);', { DESK_UID_SINCE: '' }));
      ok(u[0] === 'peak-tour-ab12@traverseplatforms.com' && u[1] === 'peak-tour-ab12@peakpickleball.us' && u[2] === 'peak-tour-ab12@traverseplatforms.com', 'invite UID: tours made before 21 Nov keep @traverseplatforms.com (so a move or cancel still matches), later ones are @peakpickleball.us');
    }
    /* ---- the Inbox and alerts (2026-11-20, Matthew: "I think the inbox tab is better but i dont think we currently have any notification
       that an email reply has happened"). Emails are put in as the Peak email sender does (deskInboxIn); pushes go to a listener on
       127.0.0.1 (DESK_PUSH_ALLOW_HTTP) and are decrypted here; email alerts land in a file. Nothing reaches Microsoft, a push service or a
       mailbox. ---- */
    {
      console.log('The Inbox and alerts');
      const now = Math.floor(Date.now() / 1000), MB = 'partnerships@peakpickleball.us';
      const inIn = (m) => inject('echo deskInboxIn(json_decode(getenv("M"), true));', { M: JSON.stringify(m) }).trim();
      const EO = LOC[125], EB = LOC[126], EA = LOC[127];   /* a card a seller owns, a card nobody owns (a blast), a card to attach to */
      ok((await b('owner', { world: 'sponsor', id: EO.id, owner: 'Test Seller' })).ok, 'a card Test Seller owns');
      const KI = inIn({ from: 'jo@inboxtest.com', name: 'Jo Inbox', subject: 'RE: Sponsoring', at: now - 300, text: 'Can we do Friday instead?\n\nJo', mid: 'AAMkInbox1', mb: MB, imid: '<in1@inboxtest.com>', w: 'sponsor', id: EO.id });
      const ST = inIn({ from: 'pat@acmeplumbing.com', name: 'Pat Acme', subject: 'Sponsorship question', at: now - 200, text: '<b>Hi</b> we would like to sponsor.\nWhat does it cost?', mid: 'AAMkInbox2', mb: MB, imid: '<in2@acmeplumbing.com>',
        att: [{ name: 'logo.png', id: 'ATTID1', size: 2048, type: 'image/png', kind: '#microsoft.graph.fileAttachment' }, { name: 'big.zip', id: 'ATTID2', size: 20 * 1048576, kind: '#microsoft.graph.fileAttachment' }, { name: 'Forwarded.msg', id: 'ATTID3', size: 900, kind: '#microsoft.graph.itemAttachment' }] });
      inIn({ from: 'no-reply@microsoft.com', subject: 'Your subscription', at: now - 150, mid: 'AAMkInbox3', imid: '<in3@microsoft.com>', cat: 'other', why: 'Microsoft or system notice' });
      inIn({ from: 'lee@inboxtest.com', subject: 'Automatic reply: Hi', at: now - 140, mid: 'AAMkInbox4', imid: '<in4@inboxtest.com>', cat: 'other', why: 'auto-reply', auto: true });
      inIn({ from: 'notify@courtreserve.com', subject: 'Court booked', at: now - 130, mid: 'AAMkInbox5', imid: '<in5@courtreserve.com>', cat: 'other', why: 'CourtReserve' });
      ok(/^[0-9a-f]{12}$/.test(KI) && /^[0-9a-f]{12}$/.test(ST) && inIn({ from: 'pat@acmeplumbing.com', subject: 'Sponsorship question', mid: 'AAMkInbox2', imid: '<in2@acmeplumbing.com>' }) === ST, 'the sender puts emails in (one id per email, the same email twice is one)');
      let IB = await b('inbox'), J = JSON.stringify(IB);
      const its = IB.items, iST = its.find((x) => x.iid === ST), iKI = its.find((x) => x.iid === KI);
      ok(IB.ok && its.length === 2 && its[0].iid === ST && its[1].iid === KI && IB.counts.open === 2 && IB.counts.other === 3 && IB.counts.done === 0, 'Inbox (a seller): the two to answer, newest first; the notice, the auto-reply and CourtReserve are not on it');
      ok(iKI.card && iKI.card.id === EO.id && iKI.card.name === EO.name && !iST.card, 'the matched one says which card it is on; the stranger’s is on none');
      ok(!/AAMkInbox|ATTID|<in\d@/.test(J), 'the page never gets where an email is in the mailbox, nor an attachment’s id');
      ok(iST.preview === '<b>Hi</b> we would like to sponsor.\nWhat does it cost?' && iST.files.map((f) => f.n + ':' + f.dl).join() === 'logo.png:true,big.zip:false,Forwarded.msg:false', 'their words as text (the page shows them as text, never HTML); a plain file under 15 MB can be downloaded, the rest open in Outlook');
      const IO = await b('inbox&f=other');
      ok(IO && IO.items.length === 3 && IO.items.map((x) => x.why).sort().join('|') === 'CourtReserve|Microsoft or system notice|auto-reply', 'Other: the Microsoft notice, the auto-reply and the CourtReserve one');
      ok((await b('data')).inbox.open === 2 && !('inbox' in (await ex('data'))) && (await ex('inbox'))._status === 403, 'the tab’s count is in the data; the Expo-only account has no Inbox');
      const CI = await cc('inbox'); ok(CI.ok && CI.items.length === 2, 'Claude Check may look');
      ok((await cc('inboxclaim', { iid: ST, on: true }))._status === 403 && (await cc('inboxdone', { iid: ST, on: true }))._status === 403 && (await cc('inboxattach', { iid: ST, w: 'sponsor', id: EA.id }))._status === 403 && (await cc('inboxreply', { iid: ST, subject: 'x', text: 'y' }))._status === 403, 'and never acts (claim, done, attach, reply: 403)');
      GM.patched = [];
      let one = await cc('inboxone' + '&iid=' + ST);
      ok(one.ok && one.item.text.startsWith('<b>Hi</b>') && !GM.patched.length, 'Claude Check opening one does not mark it read in Outlook');
      one = await b('inboxone' + '&iid=' + ST); await b('inboxone' + '&iid=' + ST);
      ok(one.ok && GM.patched.length === 1 && GM.patched[0][0] === MB && GM.patched[0][1] === 'AAMkInbox2' && JSON.stringify(GM.patched[0][2]) === '{"isRead":true}', 'a seller opening it marks it read in Peak Partnerships, once; nothing moved or deleted');
      ok((await b('inbox')).items.find((x) => x.iid === ST).read === true, 'and it shows as read');
      /* attachments through the server, as a download */
      const fr = await fetch(`${API}?action=inboxfile&iid=${ST}&n=0`, { headers: { Cookie: b.cookie() } }), fb = Buffer.from(await fr.arrayBuffer()).toString('utf8');
      ok(fr.status === 200 && /application\/octet-stream/.test(fr.headers.get('content-type')) && /^attachment; filename="logo\.png"/.test(fr.headers.get('content-disposition') || '') && /nosniff/.test(fr.headers.get('x-content-type-options') || '') && fb === 'PNG-BYTES-ATTID1', 'a plain file downloads through the desk (as a download, never shown in the page)');
      ok((await fetch(`${API}?action=inboxfile&iid=${ST}&n=1`, { headers: { Cookie: b.cookie() } })).status === 409 && (await fetch(`${API}?action=inboxfile&iid=${ST}&n=2`, { headers: { Cookie: b.cookie() } })).status === 409 && (await fetch(`${API}?action=inboxfile&iid=${ST}&n=0`, { headers: { Cookie: ex.cookie() } })).status === 403, 'too big, or not a plain file: Outlook only; the Expo account gets none');
      /* Claim */
      ok((await b('inboxclaim', { iid: ST, on: true })).ok, 'Test Seller claims the stranger’s email');
      let cl = await c2('inboxclaim', { iid: ST, on: true });
      ok(cl._status === 409 && /Test Seller is answering this/.test(cl.error) && (await c2('inbox')).items.find((x) => x.iid === ST).claim.by === 'Test Seller', 'the second seller sees “Test Seller is answering this” and cannot claim it too');
      cl = await c2('inboxreply', { iid: ST, subject: 'RE: Sponsorship question', text: 'Hello Pat' });
      ok(cl._status === 409 && cl.claim && cl.claim.by === 'Test Seller', 'nor answer it without saying so (take)');
      /* Reply on an email that is on a card: the thread kept, logged on the card */
      let n0 = GM.calls; let rr = await b('inboxreply', { iid: KI, subject: 'RE: Sponsoring', text: 'Friday is fine.' });
      let RP = GM.replies[GM.replies.length - 1] || {}; D = await b('data');
      ok(rr.ok && rr.state === 'sent' && GM.calls === n0 + 1 && RP.of === 'AAMkInbox1' && RP.box === MB && RP.create.message.toRecipients[0].emailAddress.address === 'jo@inboxtest.com' && RP.subject === 'RE: Sponsoring'
        && /Friday is fine\.[\s\S]*Test Seller[\s\S]*Their email, quoted/.test(RP.body.content) && find('sponsor', EO.id).touches.some((x) => x.dm === rr.ref && /^Replied “RE: Sponsoring” to jo@inboxtest\.com from the desk, answering their email/.test(x.note) && x.by === 'Test Seller'), 'Reply from the Inbox: Microsoft’s own reply on her message in Peak Partnerships, signed by the seller, logged on the card');
      IB = await c2('inbox'); const iKI2 = IB.items.find((x) => x.iid === KI);
      ok(iKI2.replies.length === 1 && iKI2.replies[0].ok && iKI2.replies[0].by === 'Test Seller' && iKI2.claim && iKI2.claim.by === 'Test Seller', 'the Inbox shows who replied, and the one who replied has it claimed');
      /* Reply on an email on no card: same thread, on the Inbox only; {book} needs a card */
      ok(/needs a company/.test((await c2('inboxreply', { iid: ST, subject: 'RE: x', text: 'Pick a time that suits you: {book}', take: true })).error || ''), 'a booking link needs a company first');
      const tc0 = JSON.stringify(D.sponsor.recs.map((r) => r.touches.length));
      n0 = GM.calls; rr = await c2('inboxreply', { iid: ST, subject: 'RE: Sponsorship question', text: 'Hello Pat, happy to help.', take: true }); RP = GM.replies[GM.replies.length - 1] || {}; D = await b('data');
      ok(rr.ok && rr.state === 'sent' && GM.calls === n0 + 1 && RP.of === 'AAMkInbox2' && /Hello Pat, happy to help\.[\s\S]*Second Seller/.test(RP.body.content) && JSON.stringify(D.sponsor.recs.map((r) => r.touches.length)) === tc0 && (await b('inbox')).items.find((x) => x.iid === ST).replies[0].by === 'Second Seller', 'on no card: the same thread, logged on the Inbox only (no card touched); take: true lets the second seller answer');
      /* Attach to a company */
      let at = await b('inboxattach', { iid: ST, w: 'sponsor', id: EA.id }); D = await b('data'); const ea = find('sponsor', EA.id), eat = ea.touches.filter((x) => x.mail && x.mail.from === 'pat@acmeplumbing.com');
      ok(at.ok && at.name === EA.name && eat.length === 1 && eat[0].out === 'replied' && eat[0].by === 'Peak email' && /put on this card from the Inbox by Test Seller/.test(eat[0].note) && eat[0].mail.text.startsWith('<b>Hi</b>') && eat[0].mail.files.join() === 'logo.png,big.zip,Forwarded.msg' && ea.next.date === D.today && eat[0].mail.rp === 1, 'Attach to a company: their email on that card (words, files by name, Reply), with a follow-up today');
      at = await b('inboxattach', { iid: ST, w: 'sponsor', id: EA.id }); D = await b('data');
      ok(at.ok && at.dup && find('sponsor', EA.id).touches.filter((x) => x.mail && x.mail.from === 'pat@acmeplumbing.com').length === 1 && (await b('inbox')).items.find((x) => x.iid === ST).card.id === EA.id, 'attached twice: once; the Inbox shows the card');
      ok((await b('inboxattach', { iid: ST, w: 'sponsor', id: 'nosuchid1' }))._status === 404, 'a company not on the desk is refused');
      /* Done */
      ok((await b('inboxdone', { iid: ST, on: true })).ok && !(await b('inbox')).items.some((x) => x.iid === ST), 'Done: off the open list');
      const DN = await b('inbox&f=done');
      ok(DN.items.length === 1 && DN.items[0].iid === ST && DN.items[0].done.by === 'Test Seller' && DN.counts.open === 1 && DN.counts.done === 1, 'the Done view keeps it');
      ok((await c2('inboxdone', { iid: ST, on: false })).ok && (await b('inbox')).items.some((x) => x.iid === ST), 'Not done brings it back');
      await b('inboxdone', { iid: ST, on: true });
      ok(!readFileSync(join(LD, 'inbox.log'), 'utf8').includes('AT-') && php(['inboxcount']).includes('"open"'), 'php desk.php inboxcount (counts only); no token in the Inbox log');

      /* ---- alerts ---- */
      const PUSHES = []; const psrv = http.createServer((req, res) => { const ch = []; req.on('data', (d) => ch.push(d)); req.on('end', () => { PUSHES.push({ path: req.url, h: req.headers, body: Buffer.concat(ch) }); res.writeHead(/gone/.test(req.url) ? 410 : 201); res.end(); }); });
      await new Promise((r) => psrv.listen(0, '127.0.0.1', r)); const PP = 'http://127.0.0.1:' + psrv.address().port;
      const dev = (name) => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); const auth = crypto.randomBytes(16); return { e, auth, sub: { endpoint: PP + '/sub/' + name, keys: { p256dh: e.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } }; };
      const open = (p, d) => { const body = p.body, salt = body.subarray(0, 16), idl = body[20], asPub = body.subarray(21, 21 + idl), ct = body.subarray(21 + idl);
        const hk = (s, k, info, n) => Buffer.from(crypto.hkdfSync('sha256', k, s, info, n));
        const ikm = hk(d.auth, d.e.computeSecret(asPub), Buffer.concat([Buffer.from('WebPush: info\0'), d.e.getPublicKey(), asPub]), 32);
        const dc = crypto.createDecipheriv('aes-128-gcm', hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)); dc.setAuthTag(ct.subarray(ct.length - 16));
        const pt = Buffer.concat([dc.update(ct.subarray(0, ct.length - 16)), dc.final()]); let i = pt.length - 1; while (i >= 0 && pt[i] === 0) i--; return JSON.parse(pt.subarray(0, i).toString('utf8')); };
      const AMAIL = join(LD, 'alert-mail.jsonl'), amails = () => lines('alert-mail.jsonl').map((l) => JSON.parse(l));
      /* async: the push listener lives in this process, so a blocking run would leave it unable to answer */
      const flush = (at) => new Promise((res, rej) => execFile('php', [join(WEB, 'api/desk.php'), 'alerts'], { encoding: 'utf8', env: { ...env, DESK_MAIL_FILE: AMAIL, ...(at ? { DESK_NOW: String(at) } : {}) } }, (e, so) => e ? rej(e) : res(JSON.parse(so))));
      const queue = () => existsSync(join(LD, 'alerts.json')) ? (json('alerts.json').q || []) : [];
      let A = (await b('data')).alerts;
      ok(A && A.mine === true && A.inbox === true && A.email === false && A.quiet === true && A.devices.length === 0 && A.addr === 'seller@example.com', 'alerts start: replies on my companies on, new Inbox mail on, email off, quiet hours on, no device');
      ok(!queue().length, 'nobody has turned alerts on, so nothing was queued for the emails so far');
      ok((await cc('pushkey'))._status === 503, 'Claude Check never makes the alert key');
      const K1 = await b('pushkey'), K2 = await c2('pushkey');
      ok(K1.ok && /^[A-Za-z0-9_-]{86,88}$/.test(K1.publicKey) && K2.publicKey === K1.publicKey && !/PRIVATE/.test(JSON.stringify(K1)) && existsSync(join(LD, 'push-vapid.json')), 'the desk’s own Web Push key: made once, kept outside the web folder; only its public half is given out');
      const DB = dev('b1'), DC = dev('c1'), DG = dev('gone'), DA = dev('a1');
      ok(/not usable/.test((await b('pushsub', { subscription: { endpoint: 'https://push.example.com/x', keys: { p256dh: 'abc', auth: 'abc' } }, device: 'Windows browser' })).error || ''), 'a broken sign-up is refused');
      ok((await cc('pushsub', { subscription: DB.sub, device: 'x' }))._status === 403, 'Claude Check turns nothing on');
      let ps = await b('pushsub', { subscription: DB.sub, device: 'iPhone app', phone: true });
      ok(ps.ok && ps.alerts.devices.length === 1 && ps.alerts.devices[0].device === 'iPhone app' && !JSON.stringify(ps).includes(DB.sub.keys.auth), 'Turn on alerts: this device is on (the page sees its name, never its keys)');
      await c2('pushsub', { subscription: DC.sub, device: 'Windows browser' }); await c2('pushsub', { subscription: DG.sub, device: 'Old phone' }); await a('pushsub', { subscription: DA.sub, device: 'Mac app' });
      ok(/Replies to my emails go to/.test((await c2('alertset', { email: true })).error || ''), 'the email heads-up needs the person’s own reply address');
      ok((await b('alertset', { email: true, quiet: false })).alerts.email === true && (await c2('alertset', { quiet: false })).ok && (await a('alertset', { quiet: false })).ok, 'Test Seller: email on; quiet hours off for the three of them (tested below)');
      ok((await b('myset', { sig: 'Test Seller\nPeak Pickleball\n(719) 555-0100', replyto: 'seller@example.com' })).ok && (await b('data')).alerts.email === true, 'saving the signature keeps the alert settings');
      ok((await cc('alertset', { inbox: false }))._status === 403 && (await cc('alerttest', {}))._status === 403, 'Claude Check changes no alert setting');
      /* who gets what */
      const dReply = (id, ref, extra = '') => inject('echo json_encode(deskReplied("sponsor", getenv("CID"), "Jo", "x", "Peak email", getenv("REF"), ' + (extra || 'false') + ', []));', { CID: id, REF: ref });
      dReply(EO.id, 'reply:al-owned');
      let Q = queue(); ok(Q.length === 1 && Q[0].who === 'Test Seller' && Q[0].text === EO.name + ' replied' && Q[0].url === './#card/sponsor/' + EO.id, 'a reply on a card Test Seller owns: only Test Seller is alerted, and the tap opens that card');
      dReply(EB.id, 'reply:al-blast');
      Q = queue(); const qb = Q.filter((x) => x.k === 'rp:reply:al-blast').map((x) => x.who).sort();
      const ADM = (await a('data')).me.name;
      ok(qb.join('|') === [ADM, 'Second Seller', 'Test Seller'].sort().join('|'), 'a reply to a blast (nobody owns the card): everyone with New Inbox mail on (' + qb.join(', ') + ')');
      dReply(EB.id, 'reply:al-blast'); ok(queue().length === Q.length, 'the same reply again: no second alert');
      dReply(EB.id, 'reply:al-stop', 'true');
      inject('echo json_encode(deskBounced("sponsor", getenv("CID"), "gone@x.com", "", "Peak email", "bounce:al"));', { CID: EB.id });
      inject('echo json_encode(deskAutoReplied("sponsor", getenv("CID"), "Lee", ["from" => "lee@x.com", "text" => "Out"], "Peak email", "auto:al"));', { CID: EB.id });
      inIn({ from: 'x@microsoft.com', subject: 'Notice', mid: 'AAMkInbox6', imid: '<in6@ms>', cat: 'other', why: 'Microsoft or system notice' });
      ok(queue().length === Q.length, 'STOP, a bounce, an auto-reply and a Microsoft notice: no alert');
      const NI = inIn({ from: 'sam@newco.com', name: 'Sam', subject: 'Hello there', text: 'Secret words about prices', mid: 'AAMkInbox7', mb: MB, imid: '<in7@newco.com>' });
      Q = queue(); ok(Q.filter((x) => x.k === 'in:' + NI).length === 3 && Q.find((x) => x.k === 'in:' + NI).url === './#inbox/' + NI, 'a new email in the Inbox: the same three, and the tap opens that email');
      /* delivery */
      const t0 = now + 30; let F = await flush(t0);
      const pB = PUSHES.filter((p) => p.path === '/sub/b1'), pC = PUSHES.filter((p) => p.path === '/sub/c1');
      ok(F.push === 3 && pB.length === 1 && pC.length === 1 && PUSHES.filter((p) => p.path === '/sub/a1').length === 1 && PUSHES.some((p) => p.path === '/sub/gone'), 'one push per person per run (a batch), to every device they turned on');
      const P1 = open(pB[0], DB), P2 = open(pC[0], DC);
      ok(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(pB[0].h.authorization || '') && pB[0].h['content-encoding'] === 'aes128gcm' && P1.title === 'Peak desk' && /^3 new: /.test(P1.body) && P1.body.includes(EO.name + ' replied') && P1.body.includes('New email in the Inbox') && P1.url === './#inbox', 'the push is signed with the desk’s key and encrypted for the device: “3 new: …”, opening the Inbox');
      ok(P2.body.startsWith('2 new: ') && !P2.body.includes(EO.name), 'the second seller’s has the blast reply and the new email, not Test Seller’s own card');
      ok(![P1, P2].some((p) => /jo@|sam@|Secret|Friday|prices/i.test(JSON.stringify(p))), 'no push carries an email’s words or a sender’s address');
      ok((await c2('data')).alerts.devices.length === 1, 'a device the push service says is gone (410) is taken off');
      let M1 = amails(); ok(F.mail === 1 && M1.length === 1 && M1[0].to === 'seller@example.com' && /^Peak desk: 3 new emails$/.test(M1[0].subject) && M1[0].body.includes(EO.name + ' replied.') && M1[0].body.includes('A new email came to the Peak Partnerships inbox.') && /Open the desk/.test(M1[0].body), 'the email heads-up: to the seller’s own address, what happened and “open the desk”');
      ok(!/jo@|sam@|pat@|Secret|prices|Friday|Hello there|inboxtest|newco/i.test(JSON.stringify(M1)), 'and never the email’s words, subject or the sender’s address');
      ok(!queue().length && (await flush(t0 + 5)).push === 0, 'delivered: the queue is empty, nothing goes twice');
      /* the 10-minute gap for email; pushes go each time */
      const N2 = inIn({ from: 'kai@two.com', subject: 'Two', mid: 'AAMkInbox8', mb: MB, imid: '<in8@two.com>' });
      F = await flush(t0 + 120); ok(F.push === 3 && F.mail === 0 && amails().length === 1 && queue().some((x) => x.k === 'in:' + N2 && x.who === 'Test Seller' && x.push && !x.mail), 'two minutes later: pushed at once, the email waits (one every 10 minutes)');
      F = await flush(t0 + 660); M1 = amails(); ok(F.mail === 1 && M1.length === 2 && /a new email in the Inbox/.test(M1[1].subject), '10 minutes after the last, the waiting one goes');
      /* quiet hours: held, delivered at 7 */
      const [late, seven] = execFileSync('php', ['-r', 'date_default_timezone_set("America/Denver"); echo strtotime("tomorrow 22:30"), " ", strtotime("+2 days 07:02", strtotime("today"));'], { encoding: 'utf8' }).trim().split(' ').map(Number);
      await b('alertset', { quiet: true }); const pb0 = PUSHES.filter((p) => p.path === '/sub/b1').length, pc0 = PUSHES.filter((p) => p.path === '/sub/c1').length;
      const N3 = inIn({ from: 'night@owl.com', subject: 'Late', mid: 'AAMkInbox9', mb: MB, imid: '<in9@owl.com>' });
      F = await flush(late);
      ok(PUSHES.filter((p) => p.path === '/sub/b1').length === pb0 && PUSHES.filter((p) => p.path === '/sub/c1').length === pc0 + 1 && queue().some((x) => x.k === 'in:' + N3 && x.who === 'Test Seller' && !x.push), 'quiet hours (10:30 pm): held for Test Seller; the second seller (quiet hours off) gets it');
      F = await flush(seven); ok(PUSHES.filter((p) => p.path === '/sub/b1').length === pb0 + 1 && !queue().length && amails().length === 3, 'at 7 am it goes (push and the email heads-up)');
      /* my devices, the test alert */
      const tt = await b('alerttest', {}); ok(tt.ok && tt.sent === 1 && open(PUSHES[PUSHES.length - 1], DB).body === 'Test alert: alerts are on for this device', 'Send me a test alert: to my own devices only');
      const cdev = (await c2('data')).alerts.devices[0].id;
      await b('pushunsub', { id: cdev }); ok((await c2('data')).alerts.devices.length === 1, 'nobody can take off another person’s device');
      ok((await b('pushunsub', { endpoint: DB.sub.endpoint })).alerts.devices.length === 0, 'Turn off on this device takes it off');
      ok(!/PRIVATE KEY/.test(JSON.stringify(await b('data'))) && !lines('alerts.log').join('').match(/@|Secret/), 'no key in the data; the alerts log has counts only');
      psrv.close();
    }
    /* left on for the screens; turned off at the end */
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
  ok(await js(`[...document.querySelectorAll('.world button')].map(b=>b.textContent).join(',')==='Sponsors,Expo leads'&&[...document.querySelectorAll('.tabs .tl')].map(b=>b.textContent).join(',')==='Today,Inbox,Pipeline,Companies,Tours & deals,More'`), 'the bar: Sponsors | Expo leads, then Today, Inbox, Pipeline, Companies, Tours & deals, More');
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
  /* more (2026-11-20): a seller sees My email & booking link, My calendar and Look only; the report and the money pages are the admin's */
  const signAs = async (cd, what) => { await js(`document.getElementById('signout').click()`); await waitFor(`!!document.querySelector('.signin input')`, 'signed out');
    await js(`(()=>{const i=document.querySelector('.signin input');i.value='${cd}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`); await waitFor(`!!document.querySelector('.shead')`, what); };
  const chipsNow = () => js(`[...document.querySelectorAll('.subchips [data-sub]')].map(b=>b.dataset.sub).join()`);
  await tab('more');
  ok((await chipsNow()) === 'mine,cal,look' && await js(`document.querySelector('.sdesc').textContent==='Your email and booking link, your alerts (a notice on your phone or computer when an email comes in), your calendar link and the look.'`), 'More (a seller): only My email & booking link, My calendar and Look, and the description says so (with the alerts)');
  let byUrl = 0;
  for (const s of ['report', 'pl', 'pk', 'offer', 'better']) {
    await send('Page.navigate', { url: ORIGIN + '/?u=' + s + '#sponsor/more/' + s }); await waitFor(`!!document.querySelector('.shead')`, 'opened by address');
    if (await js(`document.querySelector('.subchips [data-sub="mine"]').getAttribute('aria-pressed')==='true'&&!document.querySelector('.subchips [data-sub="${s}"]')&&!/Who is on the desk|Open the report|Save packages|What Peak offers sponsors now|What we could offer or do better|No cost entered/.test(document.querySelector('main').textContent)`)) byUrl++;
  }
  ok(byUrl === 5, 'a seller opening #sponsor/more/report, /pl, /pk, /offer or /better by address gets My email & booking link and nothing of them (' + byUrl + ' of 5)');
  await signAs(ADMIN, 'the admin, for the report'); await world('sponsor');
  await tab('more'); ok((await chipsNow()) === 'report,pl,pk,offer,better,mine,cal,look,settings', 'More (the admin): unchanged, all nine');
  await sub('report');
  ok(/Who is on the desk/.test(await text()), 'More \u203a Report with who has done what');
  await clickText('main .btn', '/Open the report/', 400);
  ok(await js(`/Sponsor pipeline/.test(document.querySelector('.paper h1').textContent)&&/This week by person/.test(document.querySelector('.paper').textContent)&&/Proposals out/.test(document.querySelector('.paper').textContent)`), 'the report page: stages, the week by person, proposals out');
  writeFileSync(join(ROOT, 'tests', 'desk-report.pdf'), Buffer.from((await send('Page.printToPDF', { printBackground: true })).data, 'base64'));
  await clickText('.printbar button', '/Back/', 300);
  for (const s of ['pl', 'pk', 'offer', 'better']) { await sub(s); }
  ok(await js(`/What we could offer/.test(document.querySelector('main').textContent)`), 'P&L, Packages, What Peak offers, What we could offer still open (the admin)');
  await signAs(SELLER, 'the seller again'); await world('sponsor'); await tab('more');
  await sub('look'); await click('[data-look="light"]');
  const bgSum = bgS;
  ok((await js(bgSum)) > 600 && await js(`localStorage.getItem('peakdesk.theme')==='light'`), 'Look: Light');
  await tab('today'); await shot('desk-today-light.png'); await tab('more'); await sub('look'); await click('[data-look="dark"]');
  ok((await js(bgSum)) < 120, 'Look: Dark again'); await js(`localStorage.removeItem('peakdesk.theme')`);
  /* expo */
  await world('expo'); await tab('today');
  ok(await js(`location.hash==='#expo/today'&&/Expo leads/.test(document.querySelector('.shead h1').textContent)&&[...document.querySelectorAll('.tabs .tl')].map(b=>b.textContent).join(',')==='Today,Inbox,Pipeline,Organisations,Tours & quotes,More'`), 'Expo leads: the same tabs (Today, Inbox, Pipeline, Organisations, Tours & quotes, More)');
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
  ok((await chipsNow()) === 'ref,mine,cal,look' && await js(`/^The questions for Peak and the competing venues, your email and booking link/.test(document.querySelector('.sdesc').textContent)`), 'More on the Expo leads (a seller): Questions and venues, My email & booking link, My calendar, Look; no Report');
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
  await signAs(ADMIN, 'the admin, for the reading pages and P&L'); await world('sponsor');
  await tab('more'); await sub('offer');
  ok(await js(`/Court sponsor: .12,000 a year/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .info').length===5`), 'More › What Peak offers: five sections');
  await sub('better'); ok(await js(`/Springs Pickleball/.test(document.querySelector('main table').textContent)&&[...document.querySelectorAll('main .src a')].every(a=>/^https:/.test(a.href))`), 'More › What we could offer: the price table, sources are links');
  await sub('pl'); ok(await js(`/\\$10,500 a year \\(88%\\)/.test(document.querySelector('main').textContent)&&/\\$21,260/.test(document.querySelector('.numbers').textContent)&&/No cost entered for: Banner/.test(document.querySelector('.numbers').textContent)`), 'More › P&L: $24,500 in, $3,000 to deliver, $240 running = $21,260; flags the banner has no cost');
  await sub('pk'); ok((await js(`document.querySelectorAll('main .pkrow').length`)) === 2, 'More › Packages lists the packages');
  await signAs(SELLER, 'the seller again'); await world('sponsor');
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
  console.log('Desk emails and booking links on the screen');
  {
    const ES = LOC[124]; await world('sponsor');
    await b('contact', { world: 'sponsor', id: ES.id, name: 'Morgan Lane', email: 'morgan@example.com' }); D = await b('data');
    await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
    ok(await openCo(ES.id, find('sponsor', ES.id).name), 'a card opens');
    ok(await js(`!!document.querySelector('.detail .dmsec [data-act="dmopen"]')&&/Write an email/.test(document.querySelector('.detail .dmsec h3').textContent)`), 'every card has Write an email');
    await click('.detail [data-act="dmopen"]', 300);
    await js(`(()=>{const s=document.querySelector('.detail .dmto');s.value=[...s.options].find(o=>/morgan@example.com/.test(o.textContent)).value;s.dispatchEvent(new Event('change'));return 1})()`); await sleep(100);
    ok(await js(`(()=>{const b=document.querySelector('.detail .dmbox');return !b.hidden&&!!b.querySelector('.dmtpl option[value="first"]')&&!!b.querySelector('.dmsub')&&!!b.querySelector('.dmbody')&&!b.querySelector('[data-act="dmsend"]').disabled&&!b.querySelector('[data-act="dmbook"]').disabled&&!!b.querySelector('[data-act="dmpreview"]')&&!!b.querySelector('[data-act="dmcopy"]')&&!!b.querySelector('[data-act="dmmailto"]')})()`), 'the box: To (a contact, or typed), Start from a template, Subject, Message, Insert my booking link, Preview, Send, Copy, Open in my mail app');
    await js(`(()=>{const s=document.querySelector('.detail .dmtpl');s.value='first';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(150);
    ok(await js(`(()=>{const b=document.querySelector('.detail .dmbox'),v=b.querySelector('.dmbody').value;return /^Hi Morgan,/.test(v)&&b.querySelector('.dmsub').value.length>3&&/Thanks,$/.test(v.trim())&&!/Peak Pickleball\\s*$/.test(v)})()`), 'a saved template fills it in for Morgan, to change as wanted (its sign-off name left for the signature)');
    await js(`(()=>{const t=document.querySelector('.detail .dmbody');t.value='Hi Morgan,\\n\\nThanks for the chat today. ';t.selectionStart=t.selectionEnd=t.value.length;t.dispatchEvent(new Event('input'));return 1})()`);
    await click('.detail [data-act="dmbook"]', 150);
    ok(await js(`/Thanks for the chat today\\. Pick a time that suits you: \\{book\\}/.test(document.querySelector('.detail .dmbody').value)`), 'Insert my booking link puts it where the cursor is');
    await click('.detail [data-act="dmpreview"]', 900);
    ok(await js(`(()=>{const p=document.querySelector('.detail .dmbox pre');return !p.hidden&&/^To: Morgan Lane <morgan@example.com>/.test(p.textContent)&&/Reply-To: seller@example.com/.test(p.textContent)&&/\\[your booking link for this email\\]/.test(p.textContent)&&/Test Seller\\nPeak Pickleball\\n\\(719\\) 555-0100/.test(p.textContent)})()`), 'Preview: to Morgan, Reply-To the seller, the booking link marked, the seller’s signature');
    await js(`document.querySelector('.detail .dmbox').scrollIntoView({block:'center'})`); await sleep(200); await shot('desk-email-box.png');
    let n0 = GM.calls; await click('.detail [data-act="dmsend"]', 2000);
    ok(GM.calls === n0 + 1 && await js(`/Email sent to morgan@example.com/.test(document.getElementById('toast').textContent)`), 'Send (after the confirm): it went, and the toast says so');
    ok(/Pick a time that suits you: http:\/\/127\.0\.0\.1:\d+\/api\/book\.php\?m=dm/.test(mimeParts(GM.sent[GM.sent.length - 1]).text), 'the email carries the booking link for it');
    ok(await js(`[...document.querySelectorAll('.detail .tli')].some(i=>/Emailed “/.test(i.textContent)&&!!i.querySelector('.dmline'))`), 'the Activity shows it, with Show the email');
    await clickText('.detail .dmline button', '/Show the email/', 200);
    ok(await js(`[...document.querySelectorAll('.detail pre.dmtext')].some(p=>!p.hidden&&/Thanks for the chat today/.test(p.textContent))`), 'Show the email opens the whole email');
    await js(`[...document.querySelectorAll('.detail .tli')].find(i=>!!i.querySelector('.dmline')).scrollIntoView({block:'center'})`); await sleep(200); await shot('desk-email-activity.png');
    await click('.detail .close', 300);
    /* their reply on the Activity, and Reply (2026-11-19) */
    ok(await openCo(LOC[123].id, find('sponsor', LOC[123].id).name), 'the card with Kim’s reply');
    ok(await js(`(()=>{const m=[...document.querySelectorAll('.detail .mailin')].find(x=>/kim@replytest.com/.test(x.textContent));const a=[...document.querySelectorAll('.detail .mailin')].find(x=>/Automatic reply from/.test(x.textContent));return !!m&&/Yes, Thursday works\./.test(m.textContent)&&/Sponsor terms\.pdf/.test(m.textContent)&&!!m.querySelector('[data-act="mailreply"]')&&!!a&&!a.querySelector('[data-act="mailreply"]')&&[...document.querySelectorAll('.detail .tli')].some(i=>/Auto-reply \\(out of office\\)/.test(i.textContent))})()`), 'the Activity shows her email (words, attachment by name, Reply) and the out-of-office as one (no Reply)');
    await js(`[...document.querySelectorAll('.detail .mailin')].find(x=>/kim@replytest.com/.test(x.textContent)).scrollIntoView({block:'center'})`); await sleep(200); await shot('desk-reply-activity.png');
    await js(`[...document.querySelectorAll('.detail .mailin')].find(x=>/kim@replytest.com/.test(x.textContent)).querySelector('[data-act="mailreply"]').click()`); await sleep(300);
    ok(await js(`(()=>{const b=document.querySelector('.detail .dmbox');return !b.hidden&&b.querySelector('.dmsub').value==='RE: Hi'&&/Replying to Kim Reyes/.test(b.querySelector('.dmre').textContent)&&/same thread/.test(b.querySelector('.dmre').textContent)&&(b.querySelector('.dmemail').value==='kim@replytest.com'||/kim@replytest.com/.test(b.querySelector('.dmto').selectedOptions[0].textContent))&&/Peak Partnerships \\(partnerships@peakpickleball.us\\)/.test(b.querySelector('.dmstate').textContent)})()`), 'Reply opens Write an email as a reply: to her, RE: subject, same thread, sent as Peak Partnerships');
    await click('.detail [data-act="dmnotre"]', 200);
    ok(await js(`!document.querySelector('.detail .dmre')&&document.querySelector('.detail .dmsub').value===''`), 'Write a new email instead takes the reply off');
    await click('.detail .close', 300);
    /* the Inbox tab and the Alerts card (2026-11-20) */
    await tab('inbox'); await waitFor(`!!document.querySelector('.inrow')`, 'the Inbox');
    ok(await js(`(()=>{const r=[...document.querySelectorAll('.inrow')];return r.length>=1&&r.every(x=>!x.classList.contains('other'))&&/partnerships@peakpickleball\\.us/.test(document.querySelector('.shead .sdesc').textContent)&&/To answer/.test(document.querySelector('.shead .subchips').textContent)})()`), 'the Inbox tab: the emails to answer, newest first');
    await js(`document.querySelector('.inrow .inhd').click()`); await waitFor(`!!document.querySelector('.inrow .intext')`, 'an email opened');
    ok(await js(`(()=>{const t=document.querySelector('.inrow .intext');return !t.querySelector('*')&&['inreply','inattach','inclaim','indone'].every(a=>!!document.querySelector('.inrow [data-act="'+a+'"]'))})()`), 'opened: their words as plain text (nothing from the email is HTML), with Reply, Attach to a company, Claim and Done');
    await click('.inrow [data-act="inattach"]', 200);
    ok(await js(`!!document.querySelector('.inrow .inq')`), 'Attach to a company asks which company');
    await shot('desk-inbox.png');
    await sub('other'); await waitFor(`document.querySelectorAll('.inrow.other').length>=3`, 'Other');
    ok(await js(`[...document.querySelectorAll('.inrow')].every(r=>r.classList.contains('other'))`), 'Other: the notices, the auto-replies and CourtReserve');
    await sub('open'); await tab('more'); await sub('mine');
    ok(await js(`(()=>{const c=document.querySelector('[data-set="alerts"]');return !!c&&!!c.querySelector('[data-act="pushon"]')&&/Home Screen/.test(c.textContent)&&/iOS 16\\.4/.test(c.textContent)&&!!c.querySelector('[data-al="quiet"]')&&!!c.querySelector('[data-al="inbox"]')&&!!c.querySelector('[data-al="mine"]')&&!!c.querySelector('[data-al="email"]')})()`), 'More › My email & booking link: Alerts (turn on per device, the iPhone Home Screen note, who gets what, quiet hours)');
    await js(`document.querySelector('[data-set="alerts"]').scrollIntoView()`); await sleep(200); await shot('desk-alerts.png');
    await tab('today');
    ok(await js(`(()=>{const b=document.querySelector('[data-blk="linkbooked"]');return !!b&&/Booked from your booking link/.test(b.textContent)&&/Brand New Co/.test(b.textContent)})()`), 'Today: "Booked from your booking link", for the host');
    await js(`document.querySelector('[data-blk="linkbooked"]').scrollIntoView({block:'center'})`); await sleep(200); await shot('desk-booked-today.png');
    await tab('deals'); await sub('tours');
    ok(await js(`[...document.querySelectorAll('main .card')].some(c=>/Brand New Co/.test(c.textContent)&&/Booked from Test Seller’s link/.test(c.textContent))`), 'Tours: the tour says it was booked from the seller’s link');
    await tab('more'); await sub('mine'); await click('[data-act="booklink"]', 800);
    ok(await js(`/Your emails go out as Peak Partnerships \\(partnerships@peakpickleball.us\\)/.test(document.querySelector('[data-set="mysig"]').textContent)&&/replies come to Peak Partnerships \\(partnerships@peakpickleball.us\\)/.test(document.querySelector('[data-set="mysig"]').textContent)`), 'My email: who it goes out as (read only) and where replies come');
    ok(await js(`/book\\.php\\?p=[0-9a-f]{12}-[0-9a-f]{16}$/.test(document.querySelector('.bookurl').value)&&document.querySelector('.mysig').value.endsWith('(719) 555-0100')&&document.querySelector('.myreply').value==='seller@example.com'&&/Mon, Wed, Fri 2:00-4:00 pm/.test(document.querySelector('main').textContent)`), 'More › My email & booking link: the link, the shared hours, my signature and reply address');
    await shot('desk-my-email-booking.png');
    const BL = await js(`document.querySelector('.bookurl').value`);
    await send('Page.navigate', { url: BL }); await waitFor(`!!document.querySelector('form [name="slot"]')`, 'booking page'); await sleep(200);
    ok(await js(`/Book a time with Peak Pickleball/.test(document.body.textContent)&&!/Test Seller/.test(document.body.textContent)`), 'the booking page, as a visitor sees it');
    await shot('booking-page.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await sleep(300);
    ok(await js(fits), 'the booking page fits a phone'); await shot('booking-page-phone.png');
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: ORIGIN + '/' }); await waitFor(`!!document.querySelector('.shead')`, 'back to the desk');
    ok((await a('dmset', { on: false })).deskmail.on === false && (await a('bookset', { on: false })).book.on === false, 'both switched off again');
    await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
    ok(await openCo(ES.id, find('sponsor', ES.id).name), 'the card again'); await click('.detail [data-act="dmopen"]', 300);
    ok(await js(`(()=>{const b=document.querySelector('.detail .dmbox');return b.querySelector('[data-act="dmsend"]').disabled&&/Send turns on once Matthew says go/.test(b.textContent)&&b.querySelector('[data-act="dmbook"]').disabled&&/Booking links turn on once Matthew says go/.test(b.textContent)&&!b.querySelector('[data-act="dmpreview"]').disabled&&!b.querySelector('[data-act="dmcopy"]').disabled})()`), 'while off: Send greyed, "Send turns on once Matthew says go"; Preview, Copy and Open in my mail app still work');
    await js(`document.querySelector('.detail .dmbox').scrollIntoView({block:'center'})`); await sleep(200); await shot('desk-email-off.png'); await click('.detail .close', 300);
    ok(/Not taking bookings right now/.test(await (await fetch(BL)).text()), 'and every booking link says "Not taking bookings right now"');
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
  ok(await js(`(()=>{const d=document.querySelector('[data-set="deskmail"]'),k=document.querySelector('[data-set="booking"]');return !!d&&!!k&&d.querySelector('[data-dmset="off"]').getAttribute('aria-pressed')==='true'&&k.querySelector('[data-bkset="off"]').getAttribute('aria-pressed')==='true'&&k.querySelector('.bkweek').value==='Mon 14:00-16:00\\nTue 08:00-16:00\\nWed 14:00-16:00\\nThu 08:00-16:00\\nFri 14:00-16:00'&&k.querySelector('.bkmins').value==='30'&&k.querySelector('.bkmeet').value===''&&/Who meets visitors/.test(k.textContent)&&/Nothing|Off/.test(d.textContent)})()`), 'More › Settings: Desk emails Off and Booking links Off, with the shared hours (Mon, Wed, Fri 2-4 pm; Tue, Thu 8 am-4 pm) to edit');
  await js(`document.querySelector('[data-set="deskmail"]').scrollIntoView()`); await sleep(200); await shot('desk-email-settings.png');
  await clickText('[data-set="booking"] button', '/Show the general link/', 700); ok(await js(`/book\\.php\\?g=[0-9a-f]{16}$/.test(document.querySelector('.bkgen').value)`), 'and the general link (no host)');
  { const DA = await a('data'); ok(!DA.deskmail.on && !DA.book.on && !DA.tourmail.on, 'desk emails, booking links and tour confirmations are all left Off for Matthew'); }
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

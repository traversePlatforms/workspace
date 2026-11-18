/* Peak Sponsor Desk tests (2026-11-17 rebuild: two pipelines, touches, owners, follow-ups, the SQLite records, the email link).
   Each run makes a FRESH copy of desk-data-local in Temp, writes old-desk log rows into it (to migrate), starts its own PHP server on
   that copy (DESK_DATA), and deletes the copy at the end: nothing in desk-data-local changes, and a run never sees a previous run's data.
   node tests/desk-test.mjs            the server rules, the migration, the email link, the screens (headless Chrome)
   node tests/desk-test.mjs --page dist/index.html   the same against the minified page */
import { spawn, execFileSync, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync, cpSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
copyFileSync(join(ROOT, PAGE), join(WEB, 'index.html')); for (const f of ['manifest.json', 'sw.js', 'icon-192.png']) copyFileSync(join(ROOT, 'app', f), join(WEB, f));
const env = { ...process.env, DESK_DATA: LD };
process.on('exit', () => { for (const d of cdpDirs.concat([LD])) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
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
  const earlier = Math.floor(Date.now() / 1000) - 2 * 86400;
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
  /* the sender reads the log itself: what it sees must match the desk */
  const replay = {}; for (const l of lines('events.log')) { const r = JSON.parse(l); if (r.t === 'status') replay[r.id] = r.status; }
  ok(replay[EM.id] === 'emailed' && replay[K.id] && replay[K.id] !== 'new' && !replay[NEW[30].id], 'the sender\u2019s own reading of events.log sees the stage (Emailed, Texted ...) and skips them; untouched companies stay new to it');
  ok(lines('events.log').every((l) => { try { JSON.parse(l); return true; } catch { return false; } }), 'every log line is whole JSON');

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
  ok(await js(`[...document.querySelectorAll('.world button')].map(b=>b.textContent).join(',')==='Sponsors,Expo leads'&&[...document.querySelectorAll('.tabs .tl')].map(b=>b.textContent).join(',')==='Today,Pipeline,Companies,Tours & deals,More'`), 'the bar: Sponsors | Expo leads, then Today, Pipeline, Companies, Tours & deals, More');
  ok(await js(`document.querySelector('main').dataset.section==='today'&&location.hash==='#sponsor/today'`), 'it opens on Today (#sponsor/today)');
  D = await b('data'); const dueN = D.sponsor.recs.filter((r) => r.next && r.next.date && r.next.date <= today() && !['signed', 'lost'].includes(r.stage)).length;
  ok(await js(`+document.querySelector('.kpi[data-k="due"] b').textContent`) === dueN && dueN >= 1 && await js(`document.querySelectorAll('[data-blk="due"] .row').length`) === dueN, `Today: follow-ups due (${dueN}), each listed`);
  ok(await js(`['due','fresh','wait','tours','week'].every(k=>!!document.querySelector('[data-blk="'+k+'"]'))&&/Proposals waiting/.test(document.querySelector('[data-blk="wait"]').textContent)`), 'Today has follow-ups due, to contact next, proposals waiting, tours coming up, this week');
  ok(await js(`(()=>{const r=[...document.querySelectorAll('[data-blk="week"] tr')].find(r=>/Test Seller/.test(r.textContent));return !!r&&r.children[1].textContent===String(${(D.sponsor.week['Test Seller'] || {}).calls || 0})})()`) && (D.sponsor.week['Test Seller'] || {}).calls >= 3, 'This week shows the seller\u2019s calls');
  await shot('desk-today.png');
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
  ok(fr0.stage === 'called' && fr0.owner === 'Test Seller' && fr0.last.note === 'front desk took a message' && fr0.next && fr0.next.date > today(), 'No answer: logged with the note, Called, mine, a follow-up 3 working days out');
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
  await sub('look'); await click('[data-look="dark"]');
  const bgSum = `(function(){var c=getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number);return c[0]+c[1]+c[2]})()`;
  ok((await js(bgSum)) < 120 && await js(`localStorage.getItem('peakdesk.theme')==='dark'`), 'Look: Dark');
  await tab('today'); await shot('desk-today-dark.png'); await tab('more'); await sub('look'); await click('[data-look="auto"]');
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
  await js(`(()=>{localStorage.setItem('peakdesk.theme','dark');window.__lookApply();return 1})()`); await sleep(300); await tab('pipe');
  ok((await js(bgSum)) < 120, 'Expo leads in dark mode'); await shot('expo-pipeline-dark.png');
  await js(`(()=>{localStorage.removeItem('peakdesk.theme');window.__lookApply();return 1})()`); await sleep(200);
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

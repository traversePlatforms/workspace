/* Peak Sponsor Desk: the server rules and the screens, against the local server (php -S 127.0.0.1:8790 -t app).
   Uses the test codes in desk-data-local/; restores the event log at the end.
   The screens follow the 2026-10-25 sections: Lists, Board, New leads, Peak sponsors, Local businesses, More. */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
/* throwaway Chrome profiles are removed when the script ends (2026-10-25: 10,717 were left in Temp, about 170 GB) */
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');   /* the folder this test sits in (the laptop move changed the user folder, 2026-11) */
const LD = ROOT + '/desk-data-local', ORIGIN = 'http://127.0.0.1:8790', API = ORIGIN + '/api/desk.php';
const code = (f) => readFileSync(join(LD, f), 'utf8').match(/(\d{6})/)[1];
const ADMIN = code('test-admin-code.txt'), SELLER = code('test-seller-code.txt');
const LOG = join(LD, 'events.log'), log0 = existsSync(LOG) ? readFileSync(LOG, 'utf8') : null;
/* Expo leads (2026-11-13): their own log, and two accounts made for the test (an expo-only one and the read-only Claude Check), both put back after */
const XLOG = join(LD, 'expo-events.log'), xlog0 = existsSync(XLOG) ? readFileSync(XLOG, 'utf8') : null;
const ACC = join(LD, 'accounts.json'), acc0 = readFileSync(ACC, 'utf8');
const addAccount = (name, role) => execFileSync('php', [join(ROOT, 'app/api/desk.php'), 'addaccount', name, role], { encoding: 'utf8' }).match(/(\d{6})/)[1];
const SCANS = join(LD, 'scans.json'), scans0 = existsSync(SCANS) ? readFileSync(SCANS, 'utf8') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, failN = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { failN++; console.log('  FAIL ' + m); } };
function client() { let ck = ''; const f = async (action, body, hdr = true) => { const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(body && hdr ? { 'X-Desk': '1' } : {}), ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; const j = await r.json().catch(() => ({})); j._status = r.status; return j; }; f.ck = () => ck; return f; }
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const later = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let chrome, ws;
try {
  console.log('The server');
  const x = client();
  ok((await x('data'))._status === 401, 'signed out: no data');
  ok((await x('signin', { code: '000000' }))._status === 401, 'a wrong code is refused');
  const a = client(), b = client();
  ok((await a('signin', { code: ADMIN })).role === 'admin', 'the admin signs in');
  ok((await b('signin', { code: SELLER })).role === 'seller', 'the seller signs in');
  const D = await b('data');
  const L = D.leads.find((l) => l.list === 'new' && l.name === 'Kaiser Permanente');   /* by name: the order changes as contacts are found */
  ok(D.ok && D.leads.length >= 200 && L && D.leads.find((l) => l.list === 'new' && l.rank === 1) && D.leads.some((l) => l.list === 'renew') && D.leads.some((l) => l.list === 'local'), `the seed loads: ${D.leads.length} leads, #1 ${(D.leads.find((l) => l.list === 'new' && l.rank === 1) || {}).name}, renewals and local businesses`);
  ok((await b('status', { id: L.id, status: 'contacted' }, false))._status === 400, 'a post without the desk header is refused (a form on another site cannot post)');
  ok((await b('status', { id: L.id, status: 'contacted' })).ok, 'the seller marks it Contacted');
  ok((await b('note', { id: L.id, note: '<img src=x onerror=alert(1)> called the front desk' })).ok, 'a note saves');
  ok((await b('next', { id: L.id, date: later(3), what: 'call back' })).ok, 'a next step saves');
  ok((await b('contact', { id: L.id, name: 'Pat Test', pos: 'Marketing', email: 'not-an-email' })).error === 'That email does not look right.', 'a bad email is refused');
  ok((await b('contact', { id: L.id, name: 'Pat Test', pos: 'Marketing', email: 'pat@example.com' })).ok, 'a contact saves');
  ok((await b('tour', { lead: L.id, date: '2020-01-01', time: '10:00' })).error === 'Pick today or a later day.', 'a tour in the past is refused');
  const t = await b('tour', { lead: L.id, date: later(2), time: '10:30', who: 'Pat Test' });
  ok(t.ok, 'a tour books');
  let D2 = await b('data'); let L2 = D2.leads.find((l) => l.id === L.id);
  ok(L2.status === 'tour' && L2.notes.length === 1 && L2.next.what === 'call back' && L2.added[0].email === 'pat@example.com' && D2.tours.some((x) => x.tid === t.tid), 'booking the tour moved it to Tour booked; the note, next step and contact are kept');
  ok((await b('packages', { packages: [{ name: 'Court sponsor', price: 12000, per: 'year' }, { name: 'Title sponsor', price: 24000, per: 'year' }] })).ok, 'the seller can change the packages too (same powers as the admin, 2026-10-21)');
  const p = await b('proposal', { lead: L.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], to: 'Pat Test, Marketing', note: 'Two courts, one year' });
  ok(p.ok && p.total === 24500, 'a proposal: 2 courts + a banner = $24,500');
  D2 = await b('data'); L2 = D2.leads.find((l) => l.id === L.id);
  ok(L2.status === 'proposal', 'making it moved the lead to Proposal sent');
  ok((await a('packages', { packages: [{ name: 'Court sponsor', price: 12000, per: 'year' }, { name: 'Title sponsor', price: 24000, per: 'year' }, { name: 'League night', price: 1500, per: 'season' }] })).ok, 'the admin adds a package');
  ok((await a('lead', { name: 'Kaiser Permanente' })).error === 'That company is already on the list.', 'a company already on the list is not added twice');
  const nl = await a('lead', { name: 'Test Roofing Co', kind: 'Home services', why: 'test' });
  ok(nl.ok, 'the admin adds a company');
  console.log('The 2026-10-24 list');
  ok((await b('tourmove', { tid: t.tid, date: later(4), time: '14:00' })).ok && (await b('data')).tours.find((x) => x.tid === t.tid).date === later(4), 'a tour moves to another day');
  ok((await b('tourout', { tid: t.tid, out: 'maybe' })).error === 'Pick how it went.', 'a tour outcome must be Toured or Did not show');
  let D3 = await b('data'); let nk = D3.leads.find((l) => l.id === L.id).notes[0].k;
  ok((await b('notedel', { id: L.id, nk })).ok && (await b('data')).leads.find((l) => l.id === L.id).notes.length === 0, 'a note is removed (the log keeps it)');
  ok((await b('notedel', { id: L.id, nk })).error === 'No such note.', 'removing it twice is refused');
  await b('note', { id: L.id, note: '<img src=x onerror=alert(1)> called the front desk' });
  ok((await b('signed', { id: L.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }], start: 'x', months: 12 })).error === 'Pick the start date.', 'signed needs a start date');
  ok((await b('signed', { id: L.id, lines: [{ name: 'Court sponsor', price: 12000, qty: 2, per: 'year' }, { name: 'Banner', price: 500, qty: 1 }], start: today(), months: 12, who: 'Pat Test' })).ok, 'a sponsor is marked signed with what they bought');
  D3 = await b('data'); let L3 = D3.leads.find((l) => l.id === L.id);
  ok(L3.status === 'signed' && L3.signed.total === 24500 && L3.signed.months === 12, 'signing moved it to Signed: 2 courts + a banner, 12 months');
  ok((await b('todo', { id: L.id, text: 'Logo on court 7' })).ok, 'a to-do for a signed sponsor');
  let tk = (await b('data')).leads.find((l) => l.id === L.id).todos[0].k;
  ok((await b('tododone', { id: L.id, k: tk, done: true })).ok && (await b('data')).leads.find((l) => l.id === L.id).todos[0].done === true, 'the to-do ticks off');
  ok((await b('todo', { id: L.id, text: 'Monthly report' })).ok, 'a second to-do');
  ok((await b('pl', { services: [{ name: 'Court sponsor', price: 12000, per: 'year', cost: 1500, costPer: 'year' }, { name: '', price: 5 }], running: [{ name: 'Hosting', amount: 20, per: 'month' }] })).ok, 'profit and loss saves');
  D3 = await b('data');
  ok(D3.pl.services.length === 1 && D3.pl.services[0].cost === 1500 && D3.pl.running[0].amount === 20, 'a service without a name is dropped; costs kept');
  ok(D3.team && Object.keys(D3.team).length >= 2 && !('Claude Check' in D3.team), 'the team list: who can sign in, with what each did');
  const ABC = D3.leads.find((l) => l.name === 'ABC Family Chiropractic');
  ok((await b('site', { id: ABC.id, site: 'not a site' })).error === 'That website does not look right.', 'a bad website is refused');
  const sc = await b('scan', { id: ABC.id });
  ok(sc.ok && sc.scan.ok && sc.scan.phones.some((p) => p.phone === '(719) 266-6661'), 'looking up ABC Family reads its website: the phone' + (sc.scan && !sc.scan.ok ? ' (' + sc.scan.err + ')' : ''));
  ok(sc.scan && sc.scan.reg && sc.scan.reg.at > 0 && sc.scan.reg.none === true, 'the state filing is checked too: ABC Family has none under that exact name');
  const ren = D3.leads.find((l) => l.list === 'renew');
  ok((await b('scan', { id: ren.id })).error === 'Add their website first.', 'a company with no website asks for one');
  ok((await b('site', { id: ren.id, site: 'http://127.0.0.1/' })).error === 'That website does not look right.' && (await b('site', { id: ren.id, site: 'localtest.me' })).ok && (await b('scan', { id: ren.id })).scan.err === 'not a public site', 'the server will not read its own or a private address');
  ok((await b('scan', { id: ABC.id, hunter: true })).error === 'Hunter is not set up here.', 'Hunter is off without its key');
  ok((await b('tourdel', { tid: t.tid })).ok && !(await b('data')).tours.some((x) => x.tid === t.tid), 'a tour cancels');
  console.log('Add and remove (2026-10-24)');
  ok((await b('sponsor', { name: 'Kaiser Permanente', start: today(), months: 12 })).error === 'That company is already on the list.', 'adding a sponsor already on the desk is refused');
  const sp = await b('sponsor', { name: 'Test Sponsor Co', kind: 'Dentist', cname: 'Sam Test', cpos: 'Owner', cemail: 'sam@example.com', start: today(), months: 6, lines: [] });
  ok(sp.ok, 'a new sponsor is added in one step');
  let D4 = await b('data'); let SP = D4.leads.find((l) => l.id === sp.id);
  ok(SP && SP.status === 'signed' && SP.signed.months === 6 && SP.added[0].email === 'sam@example.com' && SP.list === 'added', 'it is Signed, with its contact and its 6 months');
  ok((await b('leaddel', { id: sp.id })).ok, 'a sponsor is removed');
  D4 = await b('data');
  ok(!D4.leads.some((l) => l.id === sp.id) && D4.removed.some((x) => x.id === sp.id && x.name === 'Test Sponsor Co'), 'it leaves the desk and shows under Removed');
  ok((await b('note', { id: sp.id, note: 'x' })).error === 'That company was removed. Bring it back first.', 'a removed company takes no changes');
  ok((await b('lead', { name: 'test sponsor co' })).error === 'That company was removed. Bring it back from Removed companies.', 'adding it again points to Removed companies');
  ok((await b('leadback', { id: sp.id })).ok && (await b('data')).leads.find((l) => l.id === sp.id).status === 'signed', 'brought back, still Signed');
  ok((await b('leaddel', { id: sp.id })).ok, 'removed again (for the screens)');
  const t2 = await b('tour', { lead: ABC.id, date: today(), time: '00:00', who: 'Dr Test' });
  ok(t2.ok, 'a tour for ABC today');
  writeFileSync(LOG, readFileSync(LOG, 'utf8') + JSON.stringify({ t: 'tour', tid: 'pasttest01', id: ABC.id, lead: ABC.id, date: later(-2), time: '10:00', who: '', note: '', by: 'Test', at: 1 }) + '\n');   /* a tour two days ago, written straight in: the desk refuses past dates */
  /* two follow-ups due (yesterday and today) on new leads, for Lists › Follow-ups due */
  const FU = D.leads.filter((l) => l.list === 'new' && l.id !== L.id && l.status === 'new').slice(0, 2);
  ok((await b('next', { id: FU[0].id, date: today(), what: 'ring back' })).ok && (await b('next', { id: FU[1].id, date: later(-1), what: 'ring back' })).ok, 'two follow-ups due: one today, one late');
  /* Expo leads (2026-11-13): their own seed, log, stages and an expo-only account */
  console.log('Expo leads (2026-11-13)');
  const EXPO = addAccount('Test Expo', 'expo'), CHECK = addAccount('Claude Check', 'admin');
  const sponsorPart = (j) => { const { expo, _status, ...rest } = j; return JSON.stringify(rest); };
  const sp0 = sponsorPart(await b('data')), slog0 = readFileSync(LOG, 'utf8');
  let XD = (await b('data')).expo;
  ok(XD && XD.orgs.length === 64 && XD.orgs.reduce((n, o) => n + o.contacts.length, 0) === 80 && XD.questions.length === 10 && XD.venues.length >= 8 && XD.removed.length === 0, `the expo seed loads: ${XD && XD.orgs.length} organisations, ${XD && XD.orgs.reduce((n, o) => n + o.contacts.length, 0)} contacts, ${XD && XD.questions.length} questions for Peak, ${XD && XD.venues.length} venues`);
  ok(Object.keys(XD.stages).join() === 'new,contacted,talking,visit,proposal,booked,notfit' && XD.orgs.every((o) => o.stage === 'new' && /^x[0-9a-f]{9}$/.test(o.id)), 'seven expo stages, every lead starts at New');
  const XO = XD.orgs.find((o) => o.name === 'Tri-Lakes Chamber of Commerce'), XO2 = XD.orgs.find((o) => o.name === 'The Expo Pros');
  ok(XO && XO.pri === 1 && XO.contacts.some((c) => c.name === 'Terri Hayes' && c.estat === 'published' && c.conf === 'high' && c.best) && XO.srcs.length > 0, 'a lead carries its priority, contacts (email status, confidence, best route) and sources');
  ok((await b('xstage', { id: XO.id, stage: 'nope' })).error === 'Pick a stage.' && (await b('xstage', { id: 'x000000000', stage: 'contacted' }))._status === 404, 'a wrong stage or lead is refused');
  ok((await b('xstage', { id: XO.id, stage: 'talking' })).ok && (await b('xnote', { id: XO.id, note: '<b>Terri</b> asked for dates' })).ok && (await b('xnext', { id: XO.id, date: today(), what: 'send dates' })).ok, 'stage, note and follow-up save');
  ok((await b('xcontact', { id: XO.id, name: 'Pat Expo', email: 'nope' })).error === 'That email does not look right.' && (await b('xcontact', { id: XO.id, name: 'Pat Expo', role: 'Events', email: 'pat@example.com' })).ok, 'a contact saves; a bad email is refused');
  XD = (await b('data')).expo; let xo = XD.orgs.find((o) => o.id === XO.id);
  ok(xo.stage === 'talking' && xo.notes.length === 1 && xo.next.date === today() && xo.added[0].email === 'pat@example.com' && xo.log.length === 1, 'they come back: Talking, the note, the follow-up, the contact, the history');
  ok((await b('xnotedel', { id: XO.id, nk: xo.notes[0].k })).ok && (await b('data')).expo.orgs.find((o) => o.id === XO.id).notes.length === 0, 'a note is removed (the log keeps it)');
  await b('xnote', { id: XO.id, note: '<img src=x onerror=alert(1)> asked for dates' });
  ok((await b('xlead', { name: 'tri-lakes chamber of commerce' })).error === 'That organisation is already in the Expo leads.', 'an organisation already there is not added twice');
  const xn = await b('xlead', { name: 'Test Expo Promoter', cat: 'Home & garden shows', pri: 1, events: 'Spring home show', site: 'example.com', cname: 'Sam Show', email: 'sam@example.com' });
  ok(xn.ok && /^x[0-9a-f]{9}$/.test(xn.id), 'an expo lead is added by hand');
  XD = (await b('data')).expo; xo = XD.orgs.find((o) => o.id === xn.id);
  ok(XD.orgs.length === 65 && xo && xo.pri === 1 && xo.stage === 'new' && xo.added[0].name === 'Sam Show' && xo.site === 'https://example.com', 'it is in the Expo leads with its contact');
  ok((await b('xdel', { id: XO2.id })).ok && (XD = (await b('data')).expo) && !XD.orgs.some((o) => o.id === XO2.id) && XD.removed.some((r) => r.id === XO2.id), 'Remove takes a lead out and lists it under Removed');
  ok((await b('xnote', { id: XO2.id, note: 'x' })).error === 'That lead was removed. Bring it back first.', 'a removed lead takes no changes');
  ok((await b('xback', { id: XO2.id })).ok && (await b('data')).expo.orgs.some((o) => o.id === XO2.id), 'Bring back restores it');
  ok((await b('xdel', { id: xn.id })).ok, 'the hand-added one removed again (for the screens)');
  /* the sponsor side never sees any of it */
  ok(sponsorPart(await b('data')) === sp0 && readFileSync(LOG, 'utf8') === slog0, 'the sponsor data and the sponsor log are byte-for-byte the same after all of that');
  const ids = new Set(XD.orgs.map((o) => o.id)), DS0 = await b('data');
  ok(!DS0.leads.some((l) => ids.has(l.id)) && !DS0.removed.some((r) => ids.has(r.id)) && DS0.leads.length === JSON.parse(sp0).leads.length, 'no expo lead is among the sponsor leads');
  /* the expo-only account */
  const ex = client(), si = await ex('signin', { code: EXPO });
  ok(si.ok && si.role === 'expo', 'the expo-only account signs in');
  const XJ = await ex('data');
  ok(XJ.ok && XJ.expo.orgs.length === 65 - 1 && Object.keys(XJ).filter((k) => k !== '_status').sort().join() === 'expo,me,ok', 'its data is the Expo leads and nothing else: no leads, tours, proposals, packages, P&L, team, Peak records');
  ok(!JSON.stringify(XJ).includes('Kaiser Permanente') && !JSON.stringify(XJ).includes('"peak":'), 'no sponsor or Peak record anywhere in it');
  const deny = [['status', { id: L.id, status: 'new' }], ['note', { id: L.id, note: 'x' }], ['packages', { packages: [] }], ['pl', { services: [] }], ['scan', { id: ABC.id }], ['lead', { name: 'X' }], ['proposal', { lead: L.id, lines: [] }], ['tour', { lead: L.id, date: today(), time: '10:00' }], ['leaddel', { id: L.id }]];
  let denied = 0; for (const [act, body] of deny) if ((await ex(act, body))._status === 403) denied++;
  ok(denied === deny.length, `every sponsor action is refused to it (403 on ${denied} of ${deny.length})`);
  ok((await ex('xnote', { id: XO.id, note: 'expo account note' })).ok && (await ex('me')).role === 'expo', 'it can work the Expo leads');
  ok(!('Test Expo' in (await b('data')).team), 'and it is not listed in the sponsor desk’s team');
  /* Claude Check: reads the Expo leads, saves nothing */
  const cc = client(); await cc('signin', { code: CHECK }); const CJ = await cc('data');
  ok(CJ.ok && CJ.expo.orgs.length === 64 && CJ.leads.length > 0, 'Claude Check reads the Expo leads beside the sponsor desk');
  ok((await cc('xnote', { id: XO.id, note: 'x' }))._status === 403 && (await cc('xstage', { id: XO.id, stage: 'booked' }))._status === 403 && (await cc('xlead', { name: 'CC Test' }))._status === 403, 'but cannot write to them (403)');
  await cc('signout', {});
  /* the screens */
  console.log('The screens');
  const PORT = 9397;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${cdpDir()}`, 'about:blank'], { stdio: 'ignore' });
  let k = 0; const pend = new Map(), errors = [];
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++k; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  const waitFor = async (e, l, ms = 15000) => { for (let i = 0; i < ms; i += 150) { if (await js(e)) return true; await sleep(150); } throw new Error('timeout: ' + l); };
  const shot = async (n) => writeFileSync(join(ROOT, 'tests', n), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  /* the sections (2026-10-25): open one by its tab, a chip under its header, read the rows it lists */
  const tab = async (t) => { await js(`document.querySelector('.tabs [data-tab="${t}"]').click()`); await sleep(300); };
  const sub = async (s) => { await js(`document.querySelector('.subchips [data-sub="${s}"]').click()`); await sleep(300); };
  const rowIds = () => js(`[...document.querySelectorAll('.list .row')].map(r=>r.getAttribute('data-id'))`);
  const rowNames = () => js(`[...document.querySelectorAll('.list .row .nm b')].map(b=>b.textContent)`);
  const tabN = (t) => js(`+document.querySelector('.tabs [data-tab="${t}"] .tn').textContent`);
  const subN = (s) => js(`+document.querySelector('.subchips [data-sub="${s}"] b').textContent`);
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const SECOF = (l) => l.list === 'renew' ? 'peak' : l.list === 'new' ? 'new' : 'local';
  const BOARD = ['contacted', 'tour', 'toured', 'proposal', 'signed'];
  let tg; for (let i = 0; i < 60 && !tg; i++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((y) => y.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.rej(new Error(m.error.message)) : q.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });   /* a light device, whatever this computer's own setting (the new laptop runs dark, 2026-11) */
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: ORIGIN + '/' });
  await waitFor(`!!document.querySelector('.signin input')`, 'sign-in');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${SELLER}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.row')`, 'the first list');
  ok(await js(`[...document.querySelectorAll('.tabs button .tl')].map(b=>b.textContent).join(',')==='Lists,Board,New leads,Peak sponsors,Local businesses,Expo leads,More'`), 'the tabs: Lists, Board, New leads, Peak sponsors, Local businesses (Matthew\u2019s order), Expo leads (2026-11-13), then More');
  ok(await js(`document.querySelector('main').dataset.section==='lists'&&document.querySelector('.shead h1').textContent==='Lists'&&document.querySelector('.sdesc').textContent.length>20`), 'it opens on Lists, with a line saying what is in it');
  /* every section: its header, its line, its count, the companies it should list */
  let DS = await b('data');
  const want = { lists: DS.leads.map((l) => l.id), 'new': DS.leads.filter((l) => SECOF(l) === 'new').map((l) => l.id), peak: DS.leads.filter((l) => SECOF(l) === 'peak').map((l) => l.id), local: DS.leads.filter((l) => SECOF(l) === 'local').map((l) => l.id) };
  const NAMES = { lists: 'Lists', 'new': 'New leads', peak: 'Peak sponsors', local: 'Local businesses' }, got = {};
  for (const t of ['lists', 'new', 'peak', 'local']) {
    await tab(t); got[t] = await rowIds();
    ok(await js(`document.querySelector('main').dataset.section==='${t}'&&document.querySelector('.shead h1').textContent==='${NAMES[t]}'&&!!document.querySelector('.sdesc').textContent&&document.querySelector('.tabs [data-tab="${t}"]').getAttribute('aria-current')==='page'`), `${NAMES[t]} opens with its header and line`);
    ok(same(got[t], want[t]) && (await tabN(t)) === want[t].length, `${NAMES[t]} lists its ${want[t].length} companies, and its tab says ${want[t].length}`);
  }
  ok(DS.leads.every((l) => [got.new, got.peak, got.local].filter((g) => g.includes(l.id)).length === 1) && got.new.length + got.peak.length + got.local.length === got.lists.length, 'no company shows in two of New leads, Peak sponsors and Local businesses; together they are Lists');
  ok(got.new.includes(L.id) && !got.peak.includes(L.id) && !got.local.includes(L.id), 'Kaiser is under New leads only');
  await tab('board');
  ok((await tabN('board')) === DS.leads.filter((l) => BOARD.includes(l.status)).length && await js(`document.querySelector('.shead h1').textContent==='Board'&&document.querySelector('.subchips [data-sub="stages"]').getAttribute('aria-pressed')==='true'`), 'Board opens on its stages; its tab counts the companies past Not contacted');
  ok((await subN('tours')) === DS.tours.filter((x) => x.date >= today()).length && (await subN('props')) === DS.proposals.length && (await subN('signed')) === DS.leads.filter((l) => l.status === 'signed').length, 'Board\u2019s chips count the tours coming up, the proposals and the signed sponsors');
  await tab('more');
  ok(await js(`[...document.querySelectorAll('.subchips button')].map(b=>b.textContent).join(',')==='Report,Profit & loss,Packages,What Peak offers,What we could offer,Look'&&!document.querySelector('.tabs [data-tab="more"] .tn')`), 'More holds the report, profit and loss, packages the two reading pages and the look');
  /* the look (2026-10-26): More, Look sets Auto / Light / Dark, the Traverse field app's shared key */
  await js(`[...document.querySelectorAll('.subchips button')].find(b=>b.textContent==='Look').click()`); await sleep(400);
  const bgSum = `(function(){var c=getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number);return c[0]+c[1]+c[2]})()`;
  await js(`document.querySelector('[data-look="dark"]').click()`); await sleep(300);
  ok(await js(`document.documentElement.getAttribute('data-theme')==='dark'&&localStorage.getItem('peakdesk.theme')==='dark'&&localStorage.getItem('sixfold.theme')===null`) && (await js(bgSum)) < 120, 'More, Look: Dark turns the desk dark and saves the desk’s own setting (not the field app’s)');
  await tab('board'); await sleep(400); await shot('desk-dark-board.png'); await tab('more');
  await js(`[...document.querySelectorAll('.subchips button')].find(b=>b.textContent==='Look').click()`); await sleep(400);
  await js(`document.querySelector('[data-look="auto"]').click()`); await sleep(300);
  ok(await js(`!document.documentElement.hasAttribute('data-theme')&&localStorage.getItem('peakdesk.theme')===null`) && (await js(bgSum)) > 600, 'Look: Auto follows the device again (light here)');
  /* chips belong to their own section */
  await tab('new');
  ok(await js(`!document.querySelector('.subchips')&&!!document.querySelector('.stagechips')&&![...document.querySelectorAll('main button')].some(b=>/^(Board|Removed|Follow-ups due|Active)/.test(b.textContent))`), 'New leads shows its stage chips and none of another section\u2019s');
  ok(await js(`document.querySelector('.sortby select').value==='reach'`), 'New leads sort the best contact first');
  await js(`(()=>{const s=document.querySelector('.sortby select');s.value='name';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(150);
  const nn = await rowNames(); ok(nn.join('|') === [...nn].sort((a, b) => a.localeCompare(b)).join('|'), 'sorted by name on a tap');
  await js(`(()=>{const s=document.querySelector('.sortby select');s.value='reach';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(150);
  await js(`[...document.querySelectorAll('.stagechips button')].find(b=>b.dataset.st==='signed').click()`); await sleep(250);
  ok(same(await rowIds(), [L.id]), 'the Signed stage chip under New leads shows only Kaiser');
  await tab('peak');
  ok(await js(`document.querySelector('.stagechips [data-st="all"]').getAttribute('aria-pressed')==='true'`), 'the stage picked under New leads does not carry into Peak sponsors');
  await tab('new');
  ok(await js(`document.querySelector('.stagechips [data-st="signed"]').getAttribute('aria-pressed')==='true'`), 'and New leads keeps its own when you come back');
  await js(`document.querySelector('.stagechips [data-st="all"]').click()`); await sleep(250);
  /* Lists: search all, follow-ups due, removed */
  await tab('lists');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='kaiser';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  ok(same(await rowIds(), [L.id]) && await js(`/New lead/.test(document.querySelector('.list .row .nm small').textContent)`), 'Lists searches every company and says which list each is on');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  await sub('due');
  const dueWant = DS.leads.filter((l) => l.next && l.next.date && l.next.date <= today() && !['signed', 'no'].includes(l.status));
  ok(same(await rowIds(), dueWant.map((l) => l.id)) && (await subN('due')) === dueWant.length && dueWant.length >= 2, `Follow-ups due lists the ${dueWant.length} due today or late`);
  ok((await rowIds())[0] === FU[1].id, 'the late one first');
  await sub('all');
  /* the company page (opened from New leads) */
  await tab('new');
  await js(`[...document.querySelectorAll('.row')].find(r=>/Kaiser/.test(r.textContent)).click()`); await sleep(300);
  ok(await js(`!!document.querySelector('.detail')&&/Signed/.test(document.querySelector('.detail .seg button[aria-pressed="true"]').textContent)&&/renews/.test(document.querySelector('.detail').textContent)`), 'the company opens beside the list, at Signed, with its renewal date');
  ok(await js(`[...document.querySelectorAll('.detail .note .lnk')].some(b=>b.textContent==='Remove')&&/History/.test(document.querySelector('.detail').textContent)`), 'notes have a Remove link; status changes sit under History');
  ok(await js(`/<img src=x/.test(document.querySelector('.detail').textContent)&&!document.querySelector('.detail img')`), 'a note with HTML in it shows as text, never as a picture or code');
  ok(await js(`[...document.querySelectorAll('.detail .ct a')].some(a=>a.href==='mailto:pat@example.com')`), 'the contact\u2019s email is a tap-to-email link');
  await shot('desk-pipeline.png');
  /* proposal print view */
  await js(`[...document.querySelectorAll('.detail button')].find(b=>/Proposal \\$24,500/.test(b.textContent)).click()`); await sleep(300);
  ok(await js(`!!document.querySelector('.paper')&&/Kaiser Permanente/.test(document.querySelector('.paper h1').textContent)&&/\\$24,500/.test(document.querySelector('.paper').textContent)&&/Prepared for Pat Test/.test(document.querySelector('.paper').textContent)`), 'the proposal opens as a clean page: company, Prepared for, $24,500');
  ok(await js(`[...document.querySelectorAll('.printbar button')].some(b=>/Save as PDF/.test(b.textContent))`), 'with a Save as PDF button');
  const pdf = await send('Page.printToPDF', { printBackground: true });
  writeFileSync(join(ROOT, 'tests', 'desk-proposal.pdf'), Buffer.from(pdf.data, 'base64'));
  ok(pdf.data.length > 5000, 'and it prints to PDF');
  await js(`[...document.querySelectorAll('.printbar button')].find(b=>/Back/.test(b.textContent)).click()`); await sleep(250);
  ok(await js(`document.querySelector('main').dataset.section==='new'&&!!document.querySelector('.detail')`), '\u2039 Back returns to the company under New leads');
  /* the two reading pages, under More */
  await tab('more'); await sub('offer');
  ok(await js(`/Court sponsor: .12,000 a year/.test(document.querySelector('main').textContent)&&/Phil Long Ford/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .info').length===5`), 'More \u203a What Peak offers: packages, sponsors, five sections');
  await sub('better');
  ok(await js(`/Springs Pickleball/.test(document.querySelector('main table').textContent)&&/Category exclusivity/.test(document.querySelector('main').textContent)&&[...document.querySelectorAll('main .src a')].every(a=>/^https:/.test(a.href))`), 'More \u203a What we could offer: price table, ideas, sources are links');
  /* report */
  await sub('report');
  ok(await js(`/proposals out/.test(document.querySelector('main').textContent)`), 'More \u203a Report shows the numbers');
  await js(`[...document.querySelectorAll('main .btn')].find(b=>/Open the report/.test(b.textContent)).click()`); await sleep(300);
  ok(await js(`/Sponsor pipeline/.test(document.querySelector('.paper h1').textContent)&&/Proposals out/.test(document.querySelector('.paper').textContent)&&/Best new leads not contacted yet/.test(document.querySelector('.paper').textContent)`), 'the report page: stages, proposals out, best new leads');
  const pdf2 = await send('Page.printToPDF', { printBackground: true }); writeFileSync(join(ROOT, 'tests', 'desk-report.pdf'), Buffer.from(pdf2.data, 'base64'));
  /* the board */
  await tab('board');
  ok(await js(`[...document.querySelectorAll('.bhead b')].map(b=>b.textContent).join(',')==='Contacted,Tour booked,Toured,Proposal sent,Signed'`), 'the board: a column for each stage');
  ok(await js(`(()=>{const c=[...document.querySelectorAll('.bcol')].pop();return /Kaiser Permanente/.test(c.textContent)&&/\\$24,500 a yr/.test(c.querySelector('.bhead').textContent)})()`), 'Kaiser sits under Signed; the column adds up $24,500 a year');
  ok(await js(`document.querySelectorAll('.bcard').length`) === DS.leads.filter((l) => BOARD.includes(l.status)).length, 'every company past Not contacted is on the board once');
  await shot('desk-board.png');
  /* looked up */
  await js(`[...document.querySelectorAll('.bcard')].find(c=>/ABC Family/.test(c.textContent)).click()`); await sleep(300);
  ok(await js(`(()=>{const f=document.querySelector('.detail .found');return !!f&&/\\(719\\) 266-6661/.test(f.textContent)&&/Contact page/.test(f.textContent)&&/Look up again/.test(f.textContent)})()`), 'a company shows what its website gave: phone, contact page, Look up again');
  await shot('desk-lookup.png');
  /* tours */
  await sub('tours');
  ok(await js(`/Today/.test(document.querySelector('main').textContent)&&[...document.querySelectorAll('main button')].some(b=>b.textContent==='Add to my calendar')&&/How did it go\?/.test(document.querySelector('main').textContent)`), 'Board \u203a Tours: today\u2019s tour with Add to my calendar; the past one asks how it went');
  ok(await js(`location.hash`) === '#board/tours', 'the address keeps the place: #board/tours');
  await shot('desk-tours.png');
  await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='They came: mark Toured').click()`); await sleep(500);
  ok(await js(`/Past tours/.test(document.querySelector('main').textContent)&&!!document.querySelector('.pill.o-toured')`), 'marking it Toured files it under Past tours');
  ok((await b('data')).leads.find((l) => l.name === 'ABC Family Chiropractic').status === 'toured', 'and moves ABC to Toured');
  await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Open the company').click()`); await sleep(350);
  ok(await js(`document.querySelector('main').dataset.section==='local'&&/ABC Family/.test(document.querySelector('.detail h2').textContent)&&!!document.querySelector('.list .row.on')`), 'Open the company goes to the section it lives in (Local businesses) with it open');
  await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await js(`document.querySelector('main').dataset.section==='local'`), 'a reload comes back to the same section');
  /* signed */
  await tab('board'); await sub('signed');
  ok(await js(`/Kaiser Permanente · \\$24,500 a year/.test(document.querySelector('main').textContent)&&/renews/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .todo').length===2&&document.querySelectorAll('main .todo.done').length===1`), 'Board \u203a Signed: Kaiser, $24,500 a year, renewal date, two to-dos with one ticked');
  await shot('desk-signed.png');
  /* profit and loss */
  await tab('more'); await sub('pl');
  ok(await js(`/\\$10,500 a year \\(88%\\)/.test(document.querySelector('main').textContent)`), 'More \u203a P&L: a court at $12,000 costing $1,500 leaves $10,500 a year (88%)');
  ok(await js(`/\\$21,260/.test(document.querySelector('.numbers').textContent)&&/No cost entered for: Banner/.test(document.querySelector('.numbers').textContent)`), 'the numbers: $24,500 in, $3,000 to deliver, $240 running = $21,260 profit; flags the banner has no cost');
  await shot('desk-pl.png');
  await sub('report');
  ok(await js(`/Who is on the desk/.test(document.querySelector('main').textContent)`), 'the Report shows who is on the desk and what each did');
  await sub('pk');
  ok(await js(`document.querySelectorAll('main .pkrow').length`) === 3, 'More \u203a Packages lists the three packages');
  /* add a sponsor, remove, bring back */
  await tab('board'); await sub('signed');
  await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='+ Add a sponsor').click()`); await sleep(250);
  ok(await js(`!!document.querySelector('.sheet')&&/Add a sponsor/.test(document.querySelector('.sheet h2').textContent)`), 'Signed: + Add a sponsor opens the form');
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value='kaiser permanente';i.dispatchEvent(new Event('input'));return 1})()`); await sleep(100);
  ok(await js(`/already on the desk/.test(document.querySelector('.sheet').textContent)`), 'typing a company already on the desk offers to mark that one signed');
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value='Sheet Sponsor LLC';i.dispatchEvent(new Event('input'));[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='Add the sponsor').click();return 1})()`); await sleep(700);
  ok(await js(`!document.querySelector('.sheet')&&/Sheet Sponsor LLC/.test(document.querySelector('main').textContent)`), 'the new sponsor is added and listed under Signed');
  await shot('desk-add-sponsor.png');
  await js(`(()=>{const c=[...document.querySelectorAll('main .card')].find(c=>/Sheet Sponsor LLC/.test(c.textContent));[...c.querySelectorAll('button')].find(b=>b.textContent==='Remove').click();return 1})()`); await sleep(700);
  ok(await js(`!/Sheet Sponsor LLC/.test(document.querySelector('main').textContent)`), 'Remove takes it off the Signed list');
  await tab('lists'); await sub('removed');
  ok(await js(`/Sheet Sponsor LLC/.test(document.querySelector('main .list').textContent)&&/Test Sponsor Co/.test(document.querySelector('main .list').textContent)`), 'Lists \u203a Removed lists the removed companies');
  await js(`(()=>{const r=[...document.querySelectorAll('main .row')].find(r=>/Sheet Sponsor LLC/.test(r.textContent));r.querySelector('button').click();return 1})()`); await sleep(700);
  ok((await b('data')).leads.some((l) => l.name === 'Sheet Sponsor LLC'), 'Bring back puts it on the desk again');
  await tab('local'); await sub('added');
  ok((await rowNames()).includes('Sheet Sponsor LLC') && await js(`document.querySelector('.subchips [data-sub="added"]').getAttribute('aria-pressed')==='true'`), 'a sponsor we added shows under Local businesses \u203a Added on the desk');
  DS = await b('data');
  ok((await subN('added')) === DS.leads.filter((l) => l.list === 'added').length && (await subN('local')) === DS.leads.filter((l) => l.list === 'local').length && (await subN('all')) === DS.leads.filter((l) => SECOF(l) === 'local').length, 'Local businesses\u2019 chips: all, from our research, added on the desk, each counted');
  /* + Add a company, from Local businesses */
  const NEWCO = 'Reorg Check ' + Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  await sub('all'); await js(`[...document.querySelectorAll('.shead button')].find(b=>b.textContent==='+ Add a company').click()`); await sleep(200);
  ok(await js(`!!document.querySelector('.addcard')`), 'Local businesses has + Add a company');
  await js(`(()=>{const i=document.querySelectorAll('.addcard input');i[0].value='${NEWCO}';i[1].value='Test';[...document.querySelectorAll('.addcard button')].find(b=>b.textContent==='Add').click();return 1})()`); await sleep(800);
  ok(await js(`document.querySelector('main').dataset.section==='local'&&document.querySelector('.subchips [data-sub="added"]').getAttribute('aria-pressed')==='true'&&/${NEWCO}/.test(document.querySelector('.detail h2').textContent)`), 'the new company opens under Local businesses \u203a Added on the desk');
  await tab('new'); ok(!(await rowNames()).includes(NEWCO), 'and is not under New leads');
  /* Peak's own sponsor records (2026-10-25, Nneka's tracker); only when the local records file is there (it is not in git) */
  if (existsSync(LD + '/peak-records.json')) {
    const PR = JSON.parse(readFileSync(LD + '/peak-records.json', 'utf8')).leads;
    await tab('peak');
    ok((await js(`document.querySelectorAll('.list .row').length`)) === PR.length && (await tabN('peak')) === PR.length, `Peak sponsors lists every sponsor on Peak's tracker (${PR.length}), and its tab says so`);
    const nAct = PR.filter((e) => /^active/i.test(e.peak[0].status)).length;
    await sub('Active');
    ok((await js(`document.querySelectorAll('.list .row').length`)) === nAct && await js(`[...document.querySelectorAll('.list .row')].every(r=>/Active/.test(r.querySelector('.pill').textContent))`) && (await subN('Active')) === nAct, `the Active chip shows the ${nAct} active sponsors`);
    await sub('all');
    ok(await js(`/Active/.test(document.querySelector('.list .row .pill').textContent)&&document.querySelector('.sortby select').value==='peak'`), 'active sponsors sort first');
    await js(`[...document.querySelectorAll('.list .row')].find(r=>/Petrali/.test(r.textContent)).click()`); await sleep(300);
    ok(await js(`/On Peak’s tracker/.test(document.querySelector('.detail').textContent) && !!document.querySelector('.detail .chk')`), 'a sponsor shows its Peak record and what to check');
    await shot('desk-peak-sponsor.png');
    await js(`[...document.querySelectorAll('.detail button')].find(b=>/Close/.test(b.textContent)).click()`); await sleep(200);
    await js(`[...document.querySelectorAll('.list .row')].find(r=>/Rally Back/.test(r.textContent)).click()`); await sleep(300);
    ok((await js(`document.querySelectorAll('.detail .kv').length`)) === 2, 'a sponsor with two agreements shows both (Rally Back: tenant and sponsor)');
    await js(`[...document.querySelectorAll('.detail button')].find(b=>/Close/.test(b.textContent)).click()`); await sleep(200);
  }
  /* Expo leads on the screen (2026-11-13) */
  await tab('expo');
  const XS = (await b('data')).expo, DSn = await b('data');
  ok(await js(`document.querySelector('.shead h1').textContent==='Expo leads'&&location.hash==='#expo/all'`) && (await tabN('expo')) === XS.orgs.length, `Expo leads opens (#expo/all); its tab says ${XS.orgs.length}`);
  ok(same(await rowIds(), XS.orgs.map((o) => o.id)), 'it lists exactly the expo organisations, none of the sponsor companies');
  ok(await js(`document.querySelector('.sortby select').value==='pri'&&(()=>{const p=[...document.querySelectorAll('.list .row .sc')].map(s=>parseInt(s.textContent));return p.every((v,i)=>!i||v>=p[i-1])})()`), 'priority 1 first by default');
  ok((await tabN('lists')) === DSn.leads.length && (await tabN('board')) === DSn.leads.filter((l) => BOARD.includes(l.status)).length && (await tabN('local')) === DSn.leads.filter((l) => SECOF(l) === 'local').length, 'the sponsor tabs keep their own counts (no expo lead in them)');
  await js(`document.querySelector('.xprichips [data-x="1"]').click()`); await sleep(250);
  ok(same(await rowIds(), XS.orgs.filter((o) => o.pri === 1).map((o) => o.id)), `the Priority 1 chip shows the ${XS.orgs.filter((o) => o.pri === 1).length} priority-1 leads`);
  await js(`document.querySelector('.xprichips [data-x="all"]').click()`); await sleep(250);
  await js(`document.querySelector('.xstagechips [data-x="talking"]').click()`); await sleep(250);
  ok(same(await rowIds(), [XO.id]), 'the Talking stage chip shows the Tri-Lakes Chamber only');
  await js(`document.querySelector('.xstagechips [data-x="all"]').click()`); await sleep(250);
  await js(`(()=>{const s=document.querySelector('select.xcat');s.value='Bridal & family expos';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(250);
  ok(same(await rowIds(), XS.orgs.filter((o) => o.cat === 'Bridal & family expos').map((o) => o.id)), 'the category filter shows that category only');
  await js(`(()=>{const s=document.querySelector('select.xcat');s.value='all';s.dispatchEvent(new Event('change'));return 1})()`); await sleep(250);
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='terri hayes';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  ok(same(await rowIds(), [XO.id]), 'search finds a lead by its contact’s name');
  await js(`(()=>{const q=document.querySelector('.controls .search');q.value='';q.dispatchEvent(new Event('input'));return 1})()`); await sleep(150);
  await sub('due');
  ok(same(await rowIds(), XS.orgs.filter((o) => o.next && o.next.date && o.next.date <= today() && !['booked', 'notfit'].includes(o.stage)).map((o) => o.id)) && (await rowIds()).includes(XO.id), 'Follow-ups due lists the Tri-Lakes Chamber (due today)');
  await sub('all');
  await js(`[...document.querySelectorAll('.list .row')].find(r=>r.dataset.id==='${XO.id}').click()`); await sleep(300);
  ok(await js(`(()=>{const d=document.querySelector('.detail');return !!d&&/Tri-Lakes/.test(d.querySelector('h2').textContent)&&[...d.querySelectorAll('a')].some(a=>a.href.toLowerCase()==='mailto:terri@trilakeschamber.com')&&/published/.test(d.textContent)&&/confidence high/.test(d.textContent)&&/best route/.test(d.textContent)&&[...d.querySelectorAll('a')].some(a=>/^tel:/.test(a.href))})()`), 'a lead opens with its contacts: tap-to-email, tap-to-call, email published, confidence, best route');
  ok(await js(`/<img src=x/.test(document.querySelector('.detail').textContent)&&!document.querySelector('.detail img')&&/Their events/.test(document.querySelector('.detail').textContent)&&/Talking/.test(document.querySelector('.detail .seg button[aria-pressed="true"]').textContent)`), 'its events, its stage (Talking), and a note with HTML shown as text');
  await js(`[...document.querySelectorAll('.detail .seg button')].find(b=>b.dataset.x==='visit').click()`); await sleep(700);
  ok((await b('data')).expo.orgs.find((o) => o.id === XO.id).stage === 'visit' && await js(`/Site visit booked/.test(document.querySelector('.detail .seg button[aria-pressed="true"]').textContent)`), 'tapping Site visit booked saves it and the page stays on the lead');
  await shot('expo-desktop-light.png');
  await js(`(()=>{localStorage.setItem('peakdesk.theme','dark');window.__lookApply();return 1})()`); await sleep(300);
  ok((await js(bgSum)) < 120, 'Expo leads in dark mode'); await shot('expo-desktop-dark.png');
  await js(`(()=>{localStorage.removeItem('peakdesk.theme');window.__lookApply();return 1})()`); await sleep(200);
  await js(`[...document.querySelectorAll('.detail button')].find(b=>/Close/.test(b.textContent)).click()`); await sleep(200);
  await js(`[...document.querySelectorAll('.list .row')].find(r=>/American Consumer Shows/.test(r.textContent)).click()`); await sleep(300);
  ok(await js(`[...document.querySelectorAll('.detail .xn.chk')].some(n=>/CORRECTION/.test(n.textContent))`), 'a contact note that warns (a correction) shows in the amber box');
  await js(`[...document.querySelectorAll('.detail button')].find(b=>/Close/.test(b.textContent)).click()`); await sleep(200);
  await sub('ref');
  ok(await js(`location.hash==='#expo/ref'&&document.querySelectorAll('main .xq li').length===10&&document.querySelectorAll('main .xvenues tr').length>=9&&/Douglas County Fairgrounds/.test(document.querySelector('.xvenues').textContent)&&/\\$40\\/court\\/hour/.test(document.querySelector('.xvenues').textContent)`), 'Questions and venues: the 10 questions for Peak and the competing venues with rates (#expo/ref)');
  await shot('expo-ref-desktop.png');
  await sub('removed');
  ok(await js(`/Test Expo Promoter/.test(document.querySelector('main .list').textContent)`), 'Expo leads › Removed lists the removed lead');
  await js(`(()=>{const r=[...document.querySelectorAll('main .row')].find(r=>/Test Expo Promoter/.test(r.textContent));r.querySelector('button').click();return 1})()`); await sleep(700);
  ok((await b('data')).expo.orgs.some((o) => o.id === xn.id), 'Bring back puts it in the Expo leads again');
  await sub('all');
  await js(`[...document.querySelectorAll('.shead button')].find(b=>b.textContent==='+ Add an expo lead').click()`); await sleep(200);
  await js(`(()=>{const i=document.querySelectorAll('.addcard input');i[0].value='Screen Expo Co';i[1].value='Senior expos';[...document.querySelectorAll('.addcard button')].find(b=>b.textContent==='Add').click();return 1})()`); await sleep(800);
  ok(await js(`document.querySelector('main').dataset.section==='expo'&&/Screen Expo Co/.test(document.querySelector('.detail h2').textContent)`), '+ Add an expo lead adds it and opens it');
  ok(!(await b('data')).leads.some((l) => l.name === 'Screen Expo Co' || l.name === 'Test Expo Promoter'), 'and it never reaches the sponsor leads');
  await js(`[...document.querySelectorAll('.detail button')].find(b=>/Remove this lead/.test(b.textContent)).click()`); await sleep(700);
  ok((await b('data')).expo.removed.some((r) => r.name === 'Screen Expo Co') && !(await js(`!!document.querySelector('.detail')`)), 'Remove this lead takes it out (to Removed)');
  /* a picture of every section, desktop then phone, for a look at the layout */
  const SECTIONS = ['lists', 'board', 'new', 'peak', 'local', 'expo', 'more'];
  const firstChip = async () => { await js(`(()=>{const b=document.querySelector('.subchips button');if(b&&b.getAttribute('aria-pressed')!=='true')b.click();return 1})()`); await sleep(250); };   /* each section as it first opens */
  for (const t of SECTIONS) { await tab(t); await firstChip(); await js('window.scrollTo(0,0)'); await shot(`reorg-${t}-desktop.png`); }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await tab('lists'); await sleep(200);
  ok(await js(`[...document.querySelectorAll('.tabs button')].every(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=document.documentElement.clientWidth+1})`), 'on a phone all seven tabs are in view, no swiping');
  let wide = [];
  for (const t of SECTIONS) {
    await tab(t);
    for (const s of (await js(`[...document.querySelectorAll('.subchips button')].map(b=>b.dataset.sub)`)) || ['']) { if (s) await sub(s); if (!(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`))) wide.push(t + (s ? '/' + s : '')); }
    await firstChip(); await js('window.scrollTo(0,0)'); await shot(`reorg-${t}-phone.png`);
  }
  ok(!wide.length, 'on a phone no section or chip scrolls sideways' + (wide.length ? ': ' + wide.join(', ') : ''));
  await tab('board'); await sub('tours'); await shot('reorg-board-tours-phone.png');
  ok(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'Board \u203a Tours fits a phone');
  await sub('stages');
  ok(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'the board on a phone: its columns swipe inside, the page does not');
  await shot('desk-board-phone.png');
  await tab('new');
  await js(`document.querySelector('.row').click()`); await sleep(300);
  ok(await js(`getComputedStyle(document.querySelector('.detail')).position==='fixed'`), 'on a phone a company opens full screen');
  await shot('desk-phone.png');
  /* Expo leads on a phone, light and dark */
  const fits = `document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`;
  await tab('expo'); await sub('all'); await js('window.scrollTo(0,0)'); await shot('expo-phone-light.png');
  await js(`[...document.querySelectorAll('.list .row')].find(r=>r.dataset.id==='${XO.id}').click()`); await sleep(300);
  const xph = await js(`(()=>{const d=document.querySelector('.detail');const small=[...d.querySelectorAll('.seg button,.btn')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<40).map(b=>b.textContent);return {fixed:getComputedStyle(d).position==='fixed',wide:d.scrollWidth-d.clientWidth,small}})()`);
  ok(xph.fixed && xph.wide <= 1 && !xph.small.length, 'on a phone an expo lead opens full screen, nothing wider than the screen, buttons finger-sized' + (xph.fixed && xph.wide <= 1 && !xph.small.length ? '' : ': ' + JSON.stringify(xph)));
  await shot('expo-phone-detail.png');
  await js(`(()=>{localStorage.setItem('peakdesk.theme','dark');window.__lookApply();return 1})()`); await sleep(300); await shot('expo-phone-detail-dark.png');
  await js(`[...document.querySelectorAll('.detail button')].find(b=>/Close/.test(b.textContent)).click()`); await sleep(200); await js('window.scrollTo(0,0)'); await shot('expo-phone-dark.png');
  await sub('ref'); ok(await js(fits), 'Questions and venues fits a phone (the table swipes inside)'); await shot('expo-ref-phone-dark.png');
  await js(`(()=>{localStorage.removeItem('peakdesk.theme');window.__lookApply();return 1})()`); await sleep(200);
  /* the expo-only account in the browser: one tab, the look, nothing of the sponsors' */
  await js(`document.getElementById('signout').click()`); await waitFor(`!!document.querySelector('.signin input')`, 'signed out');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${EXPO}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.shead')`, 'the expo account’s page'); await sub('all'); await waitFor(`!!document.querySelector('.row')`, 'the expo account’s list');
  ok(await js(`[...document.querySelectorAll('.tabs button .tl')].map(b=>b.textContent).join(',')==='Expo leads'&&document.querySelector('main').dataset.section==='expo'&&/expo leads/.test(document.getElementById('brandSub').textContent)`), 'the expo account sees one tab, Expo leads');
  ok(await js(`[...document.querySelectorAll('.subchips button')].map(b=>b.dataset.sub).join(',')`) === 'all,due,removed,ref,look', 'with its chips and the Look');
  const nX = (await ex('data')).expo.orgs.length; ok((await rowIds()).length === nX && nX >= 64, `and the ${nX} expo organisations (the 64 researched, one added in the test)`);
  await js(`location.hash='#more/report'`); await send('Page.reload'); await waitFor(`!!document.querySelector('.shead')`, 'reload');
  ok(await js(`document.querySelector('main').dataset.section==='expo'&&!document.querySelector('.tabs [data-tab="more"]')&&!/Kaiser/.test(document.body.textContent)`), 'an address for a sponsor page still lands on Expo leads');
  await sub('look'); ok(await js(`!!document.querySelector('[data-look="dark"]')`), 'Look is there for it');
  await sub('all'); await js('window.scrollTo(0,0)'); await shot('expo-account-phone.png');
  ok(await js(fits), 'the expo account’s page fits a phone');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(200);
  await shot('expo-account-desktop.png');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failN++; console.log('  FAIL threw: ' + e.stack); }
finally {
  try { ws && ws.close(); } catch {} try { chrome && chrome.kill(); } catch {}
  if (log0 === null) { try { rmSync(LOG); } catch {} } else writeFileSync(LOG, log0);
  if (scans0 === null) { try { rmSync(SCANS); } catch {} } else writeFileSync(SCANS, scans0);
  if (xlog0 === null) { try { rmSync(XLOG); } catch {} } else writeFileSync(XLOG, xlog0);
  writeFileSync(ACC, acc0);
  try { rmSync(join(LD, 'tries.json')); } catch {}
}
console.log(`desk ${pass}/${pass + failN}`); process.exit(failN ? 1 : 0);

/* Peak Sponsor Desk: the server rules and the screens, against the local server (php -S 127.0.0.1:8790 -t app).
   Uses the test codes in desk-data-local/; restores the event log at the end. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ROOT = 'C:/Users/Surge Inc/Desktop/claude test 2/matthew/peak-pickleball-sponsorship';
const LD = ROOT + '/desk-data-local', ORIGIN = 'http://127.0.0.1:8790', API = ORIGIN + '/api/desk.php';
const code = (f) => readFileSync(join(LD, f), 'utf8').match(/(\d{6})/)[1];
const ADMIN = code('test-admin-code.txt'), SELLER = code('test-seller-code.txt');
const LOG = join(LD, 'events.log'), log0 = existsSync(LOG) ? readFileSync(LOG, 'utf8') : null;
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
  /* the screens */
  console.log('The screens');
  const PORT = 9397;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
  let k = 0; const pend = new Map(), errors = [];
  const send = (m, pr = {}) => new Promise((res, rej) => { const i = ++k; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: pr })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  const waitFor = async (e, l, ms = 15000) => { for (let i = 0; i < ms; i += 150) { if (await js(e)) return true; await sleep(150); } throw new Error('timeout: ' + l); };
  const shot = async (n) => writeFileSync(join(ROOT, 'tests', n), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  let tg; for (let i = 0; i < 60 && !tg; i++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((y) => y.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.rej(new Error(m.error.message)) : q.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: ORIGIN + '/' });
  await waitFor(`!!document.querySelector('.signin input')`, 'sign-in');
  await js(`(()=>{const i=document.querySelector('.signin input');i.value='${SELLER}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
  await waitFor(`!!document.querySelector('.row')`, 'pipeline');
  ok(await js(`document.querySelector('.row .nm b').textContent==='Kaiser Permanente'||[...document.querySelectorAll('.row .nm b')].some(b=>b.textContent==='Kaiser Permanente')`), 'the pipeline lists the ranked leads');
  ok(await js(`[...document.querySelectorAll('.tabs button')].map(b=>b.textContent).join(',')==='Pipeline,Tours,Proposals,Signed,Profit & loss,Report,Packages,What Peak offers,What we could offer'`), 'the seller sees every tab, Signed and Profit & loss included');
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
  /* the two reading tabs */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='What Peak offers').click()`); await sleep(200);
  ok(await js(`/Court sponsor: .12,000 a year/.test(document.querySelector('main').textContent)&&/Phil Long Ford/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .info').length===5`), 'What Peak offers: packages, sponsors, five sections');
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='What we could offer').click()`); await sleep(200);
  ok(await js(`/Springs Pickleball/.test(document.querySelector('main table').textContent)&&/Category exclusivity/.test(document.querySelector('main').textContent)&&[...document.querySelectorAll('main .src a')].every(a=>/^https:/.test(a.href))`), 'What we could offer: price table, ideas, sources are links');
  /* report */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Report').click()`); await sleep(200);
  ok(await js(`/proposals out/.test(document.querySelector('main').textContent)`), 'the Report tab shows the numbers');
  await js(`[...document.querySelectorAll('main .btn')].find(b=>/Open the report/.test(b.textContent)).click()`); await sleep(300);
  ok(await js(`/Sponsor pipeline/.test(document.querySelector('.paper h1').textContent)&&/Proposals out/.test(document.querySelector('.paper').textContent)&&/Best new leads not contacted yet/.test(document.querySelector('.paper').textContent)`), 'the report page: stages, proposals out, best new leads');
  const pdf2 = await send('Page.printToPDF', { printBackground: true }); writeFileSync(join(ROOT, 'tests', 'desk-report.pdf'), Buffer.from(pdf2.data, 'base64'));
  /* the board */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Pipeline').click()`); await sleep(250);
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>b.textContent==='Board').click()`); await sleep(300);
  ok(await js(`[...document.querySelectorAll('.bhead b')].map(b=>b.textContent).join(',')==='Contacted,Tour booked,Toured,Proposal sent,Signed'`), 'the board: a column for each stage');
  ok(await js(`(()=>{const c=[...document.querySelectorAll('.bcol')].pop();return /Kaiser Permanente/.test(c.textContent)&&/\\$24,500 a yr/.test(c.querySelector('.bhead').textContent)})()`), 'Kaiser sits under Signed; the column adds up $24,500 a year');
  await shot('desk-board.png');
  /* looked up */
  await js(`[...document.querySelectorAll('.bcard')].find(c=>/ABC Family/.test(c.textContent)).click()`); await sleep(300);
  ok(await js(`(()=>{const f=document.querySelector('.detail .found');return !!f&&/\\(719\\) 266-6661/.test(f.textContent)&&/Contact page/.test(f.textContent)&&/Look up again/.test(f.textContent)})()`), 'a company shows what its website gave: phone, contact page, Look up again');
  await shot('desk-lookup.png');
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>b.textContent==='List').click()`); await sleep(200);
  /* tours */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Tours').click()`); await sleep(250);
  ok(await js(`/Today/.test(document.querySelector('main').textContent)&&[...document.querySelectorAll('main button')].some(b=>b.textContent==='Add to my calendar')&&/How did it go\?/.test(document.querySelector('main').textContent)`), 'Tours: today’s tour with Add to my calendar; the past one asks how it went');
  await shot('desk-tours.png');
  await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='They came: mark Toured').click()`); await sleep(500);
  ok(await js(`/Past tours/.test(document.querySelector('main').textContent)&&!!document.querySelector('.pill.o-toured')`), 'marking it Toured files it under Past tours');
  ok((await b('data')).leads.find((l) => l.name === 'ABC Family Chiropractic').status === 'toured', 'and moves ABC to Toured');
  /* signed */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Signed').click()`); await sleep(250);
  ok(await js(`/Kaiser Permanente · \\$24,500 a year/.test(document.querySelector('main').textContent)&&/renews/.test(document.querySelector('main').textContent)&&document.querySelectorAll('main .todo').length===2&&document.querySelectorAll('main .todo.done').length===1`), 'Signed: Kaiser, $24,500 a year, renewal date, two to-dos with one ticked');
  await shot('desk-signed.png');
  /* profit and loss */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Profit & loss').click()`); await sleep(250);
  ok(await js(`/\\$10,500 a year \\(88%\\)/.test(document.querySelector('main').textContent)`), 'P&L: a court at $12,000 costing $1,500 leaves $10,500 a year (88%)');
  ok(await js(`/\\$21,260/.test(document.querySelector('.numbers').textContent)&&/No cost entered for: Banner/.test(document.querySelector('.numbers').textContent)`), 'the numbers: $24,500 in, $3,000 to deliver, $240 running = $21,260 profit; flags the banner has no cost');
  await shot('desk-pl.png');
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Report').click()`); await sleep(200);
  ok(await js(`/Who is on the desk/.test(document.querySelector('main').textContent)`), 'the Report shows who is on the desk and what each did');
  /* add a sponsor, remove, bring back */
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Signed').click()`); await sleep(250);
  await js(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='+ Add a sponsor').click()`); await sleep(250);
  ok(await js(`!!document.querySelector('.sheet')&&/Add a sponsor/.test(document.querySelector('.sheet h2').textContent)`), 'Signed: + Add a sponsor opens the form');
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value='kaiser permanente';i.dispatchEvent(new Event('input'));return 1})()`); await sleep(100);
  ok(await js(`/already on the desk/.test(document.querySelector('.sheet').textContent)`), 'typing a company already on the desk offers to mark that one signed');
  await js(`(()=>{const i=document.querySelector('.sheet input');i.value='Sheet Sponsor LLC';i.dispatchEvent(new Event('input'));[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='Add the sponsor').click();return 1})()`); await sleep(700);
  ok(await js(`!document.querySelector('.sheet')&&/Sheet Sponsor LLC/.test(document.querySelector('main').textContent)`), 'the new sponsor is added and listed under Signed');
  await shot('desk-add-sponsor.png');
  await js(`(()=>{const c=[...document.querySelectorAll('main .card')].find(c=>/Sheet Sponsor LLC/.test(c.textContent));[...c.querySelectorAll('button')].find(b=>b.textContent==='Remove').click();return 1})()`); await sleep(700);
  ok(await js(`!/Sheet Sponsor LLC/.test(document.querySelector('main').textContent)`), 'Remove takes it off the Signed list');
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Pipeline').click()`); await sleep(250);
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>/^Removed/.test(b.textContent)).click()`); await sleep(250);
  ok(await js(`/Sheet Sponsor LLC/.test(document.querySelector('main .list').textContent)&&/Test Sponsor Co/.test(document.querySelector('main .list').textContent)`), 'the Pipeline lists Removed companies');
  await js(`(()=>{const r=[...document.querySelectorAll('main .row')].find(r=>/Sheet Sponsor LLC/.test(r.textContent));r.querySelector('button').click();return 1})()`); await sleep(700);
  ok((await b('data')).leads.some((l) => l.name === 'Sheet Sponsor LLC'), 'Bring back puts it on the desk again');
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>/^New leads/.test(b.textContent)).click()`); await sleep(250);
  /* phone */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Pipeline').click()`); await sleep(300);
  ok(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'on a phone: no sideways scrolling');
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>b.textContent==='Board').click()`); await sleep(250);
  ok(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'the board on a phone: its columns swipe inside, the page does not');
  await shot('desk-board-phone.png');
  await js(`[...document.querySelectorAll('.controls .chips button')].find(b=>b.textContent==='List').click()`); await sleep(250);
  await js(`document.querySelector('.row').click()`); await sleep(300);
  ok(await js(`getComputedStyle(document.querySelector('.detail')).position==='fixed'`), 'on a phone a company opens full screen');
  await shot('desk-phone.png');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failN++; console.log('  FAIL threw: ' + e.stack); }
finally {
  try { ws && ws.close(); } catch {} try { chrome && chrome.kill(); } catch {}
  if (log0 === null) { try { rmSync(LOG); } catch {} } else writeFileSync(LOG, log0);
  if (scans0 === null) { try { rmSync(SCANS); } catch {} } else writeFileSync(SCANS, scans0);
  try { rmSync(join(LD, 'tries.json')); } catch {}
}
console.log(`desk ${pass}/${pass + failN}`); process.exit(failN ? 1 : 0);

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
  ok((await b('tourdel', { tid: t.tid })).ok && !(await b('data')).tours.some((x) => x.tid === t.tid), 'a tour cancels');
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
  ok(await js(`[...document.querySelectorAll('.tabs button')].map(b=>b.textContent).join(',')==='Pipeline,Tours,Proposals,Report,Packages,What Peak offers,What we could offer'`), 'the seller sees every tab, Packages and the two reading tabs included');
  await js(`[...document.querySelectorAll('.row')].find(r=>/Kaiser/.test(r.textContent)).click()`); await sleep(300);
  ok(await js(`!!document.querySelector('.detail')&&/Proposal sent/.test(document.querySelector('.detail .seg button[aria-pressed="true"]').textContent)`), 'the company opens beside the list, at Proposal sent');
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
  /* phone */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js(`[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Pipeline').click()`); await sleep(300);
  ok(await js(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`), 'on a phone: no sideways scrolling');
  await js(`document.querySelector('.row').click()`); await sleep(300);
  ok(await js(`getComputedStyle(document.querySelector('.detail')).position==='fixed'`), 'on a phone a company opens full screen');
  await shot('desk-phone.png');
  ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
} catch (e) { failN++; console.log('  FAIL threw: ' + e.stack); }
finally {
  try { ws && ws.close(); } catch {} try { chrome && chrome.kill(); } catch {}
  if (log0 === null) { try { rmSync(LOG); } catch {} } else writeFileSync(LOG, log0);
  try { rmSync(join(LD, 'tries.json')); } catch {}
}
console.log(`desk ${pass}/${pass + failN}`); process.exit(failN ? 1 : 0);

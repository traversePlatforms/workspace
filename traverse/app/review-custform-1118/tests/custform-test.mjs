/* Send a form from the customer page (18 Nov 2026, Jen via Matthew: "the Another Service option is available on the booking page if you add
   them as a customer first, which I just did with Daniel. But I tried to get him a form because booking that way doesn't send them anything,
   and it doesn't show the Another Service button as an option"). Two throwaway installs from the source (traverse/app), each on PHP's test
   server in a fresh temp folder, throwaway codes, headless Chrome:
     six   Sixfold 365 (company a365): a customer first, then Send a form with Another service, both before and after "+ Book a job"
     kit   an edition: the customer page's Send a form opens the edition's own quote, nothing else changes
   Nothing real is called (no Square, no mail). Run once per run (fresh data every time):
     node traverse/app/review-custform-1118/tests/custform-test.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const TMP = mkdtempSync(join(tmpdir(), 'custform-'));
const CODES = { admin: '584121', office: '584122', crew: '584123' };
const procs = [];
function install(name, port, kind) {
  const T = join(TMP, name), WWW = join(T, 'www'), DATA = join(T, 'sixfold-data', 'rounds'), PRIV = join(T, 'sixfold-private');
  mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
  for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php')) cpSync(join(APP, 'api', f), join(WWW, 'api', f));
  cpSync(join(APP, 'summit-de59ae83'), join(WWW, 'summit-de59ae83'), { recursive: true });
  /* a test door into the page's closure: the customer page opened straight from the test (this copy only; the shipped page is untouched) */
  const pg = join(WWW, 'summit-de59ae83', 'index.html');
  writeFileSync(pg, readFileSync(pg, 'utf8').replace('  function customerView(id, back, backLabel) {', '  window.__cv = function (id) { return customerView(id); };\n  function customerView(id, back, backLabel) {'));
  const co = { name: 'Test ' + name, short: 'Test', phone: '(555) 010-0100', email: 'office@example.com', features: { walkdesk: true, crew: true, company: kind !== 'six' }, best: kind === 'six' ? null : 'yards' };
  if (kind === 'six') co.a365 = { name: '365 Test Aeration', phone: '(555) 010-0199', base: [39.6537, -104.9919], radius: 45 };
  writeFileSync(join(DATA, 'company.json'), JSON.stringify(co, null, 2));
  writeFileSync(join(DATA, 'index.json'), '{"regions":[]}');
  const people = { [CODES.admin]: ['Pat Admin', 'admin'], [CODES.office]: ['Jen Office', 'office'], [CODES.crew]: ['Brad Crew', kind === 'six' ? 'crew' : 'tech'] };
  writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => " + JSON.stringify(people).replace(/\{/g, '[').replace(/\}/g, ']').replace(/":/g, '" =>') + "];\n");
  procs.push(spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + port, '-t', WWW], { stdio: 'ignore' }));
  return { ORIGIN: 'http://127.0.0.1:' + port, API: 'http://127.0.0.1:' + port + '/api/rounds.php', DATA };
}
function req(url, { method = 'GET', body = null, cookie = '' } = {}) {
  return new Promise((res) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request(url, { method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (x) => {
      let s = ''; x.setEncoding('utf8'); x.on('data', (d) => (s += d)); x.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch { j = { raw: s.slice(0, 300) }; } j._status = x.statusCode; j._cookies = x.headers['set-cookie'] || []; res(j); });
    });
    r.on('error', (e) => res({ _status: 0, error: String(e) })); if (data) r.write(data); r.end();
  });
}
function client(I) {
  const jars = {};
  const call = async (who, action, body, q = '') => {
    const j = await req(I.API + '?action=' + action + q, { method: body ? 'POST' : 'GET', body, cookie: jars[who] || '' });
    if (j._cookies.length) { const jar = Object.fromEntries((jars[who] || '').split('; ').filter(Boolean).map((c) => c.split('='))); for (const c of j._cookies) { const [k, v] = c.split(';')[0].split('='); jar[k] = v; } jars[who] = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }
    return j;
  };
  const signin = async (who) => { const s = await call(who, 'signin', { code: CODES[who], dev: 'c' }); if (s.terms && s.terms.due) await call(who, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' }); return s; };
  return { call, signin };
}
/* a day the board takes: a few days on, never a Sunday (local calendar; the server is on Denver's) */
const dayAhead = (n) => { const d = new Date(Date.now() + n * 86400000); if (d.getDay() === 0) d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let n = 0; const phone = () => '30355501' + String(10 + (n++ % 89));
const signKey = (link) => (/[?&]s=([^&#]+)/.exec(link || '') || [])[1] || '';

let chrome, prof;
try {
  const SIX = install('six', 8891, 'six'), KIT = install('kit', 8892, 'kit');
  for (const I of [SIX, KIT]) for (let i = 0; i < 60; i++) { if ((await req(I.API + '?action=kitbrand'))._status) break; await sleep(150); }
  const S6 = client(SIX), K6 = client(KIT);
  for (const w of ['admin', 'office']) t((await S6.signin(w)).ok, 'Sixfold: ' + w + ' signs in');
  t((await K6.signin('admin')).ok, 'edition: admin signs in');
  const leadOf = async (C, id) => ((await C.call('admin', 'leads')).leads || []).find((l) => l.id === id);
  const jobsOf = async (C, lead) => { const j = await C.call('admin', 'jobs', null, '&from=' + dayAhead(0) + '&to=' + dayAhead(30)); return ((j && j.jobs) || []).filter((x) => x.lead === lead); };
  const custFirst = async (C, name) => {
    const la = await C.call('admin', 'leadadd', { src: 'phone', name, phone: phone(), email: name.split(' ')[0].toLowerCase() + n + '@example.com', town: '12 Test St, Englewood', need: 'Fall cleanup' });
    const cf = await C.call('admin', 'customerfrom', { lead: la.id });
    return { lead: la.id, cust: cf.id, ok: la.ok && cf.ok };
  };

  console.log('\nThe server: a customer, then the form (Sixfold)');
  const A = await custFirst(S6, 'Daniel Formfirst'); t(A.ok, 'a lead made a customer first');
  let cj = await S6.call('office', 'custjob', { id: A.cust }); t(cj.ok && cj.lead && cj.lead.id === A.lead && cj.job === null, 'custjob gives their lead, and no job yet');
  const D1 = dayAhead(3);
  let ss = await S6.call('office', 'signsend', { id: A.lead, price: 180, pkg: 'other', svc: 'Fall cleanup', how: 'none', nosign: 0, taken: 1, crew: 'Brad Crew', date: D1, slot: 's2', note: '' });
  t(ss.ok && /sign/.test(ss.link || ''), 'the form goes out with Another service (' + (ss.error || 'ok') + ')');
  let L = await leadOf(S6, A.lead); t(L.quote.pkg === 'other' && L.quote.svc === 'Fall cleanup', 'the lead\u2019s form says Fall cleanup');
  let sg = await S6.call('office', 'a365signed', { s: signKey(ss.link), name: 'Daniel Formfirst', agree: true, read: true });
  t(sg.ok, 'the customer signs (' + (sg.error || 'ok') + ')');
  let J = await jobsOf(S6, A.lead); t(J.length === 1 && J[0].pkg === 'other' && J[0].svc === 'Fall cleanup' && J[0].price === 180 && J[0].date === D1, 'signing books one job: Fall cleanup, $180, the day on the form');

  console.log('\nThe server: booked from the customer page first, then the form (Sixfold)');
  const B = await custFirst(S6, 'Dana Bookfirst'); t(B.ok, 'a lead made a customer first');
  const D2 = dayAhead(4);
  let bk = await S6.call('office', 'jobsave', { lead: B.lead, crew: 'Brad Crew', date: D2, slot: 's3', price: 150, pkg: 'other', svc: 'Fall cleanup', scope: 'all', pay: { s: 'unpaid' }, card: 0, note: '', addr: '12 Test St, Englewood' });
  t(bk.ok, '"+ Book a job" books it (' + (bk.error || 'ok') + ')');
  t((await leadOf(S6, B.lead)).status === 'won', 'the lead is Won (so its Pipeline card has no form button)');
  cj = await S6.call('office', 'custjob', { id: B.cust });
  t(cj.ok && cj.job && cj.job.date === D2 && cj.job.slot === 's3' && cj.job.svc === 'Fall cleanup' && cj.job.price === 150, 'custjob gives the booked job too (day, time, service, price)');
  ss = await S6.call('office', 'signsend', { id: B.lead, price: 160, pkg: 'other', svc: 'Fall cleanup', how: 'none', nosign: 0, taken: 1, crew: 'Brad Crew', date: dayAhead(5), slot: 's1', note: '' });
  t(!ss.ok && ss._status === 409 && /booked already/.test(ss.error || ''), 'another day is refused while the job is on the board: ' + ss.error);
  ss = await S6.call('office', 'signsend', { id: B.lead, price: 160, pkg: 'other', svc: 'Fall cleanup and gutters', how: 'none', nosign: 0, taken: 1, crew: 'Brad Crew', date: D2, slot: 's3', note: '' });
  t(ss.ok, 'the form goes out for the booked day, not refused as "Brad already has a job then" (' + (ss.error || 'ok') + ')');
  J = await jobsOf(S6, B.lead); t(J.length === 1 && J[0].price === 160 && J[0].svc === 'Fall cleanup and gutters', 'still one job, and it says what the form says ($160, Fall cleanup and gutters)');
  sg = await S6.call('office', 'a365signed', { s: signKey(ss.link), name: 'Dana Bookfirst', agree: true, read: true });
  t(sg.ok, 'the customer signs (' + (sg.error || 'ok') + ')');
  J = await jobsOf(S6, B.lead); t(J.length === 1 && J[0].date === D2 && J[0].slot === 's3', 'signing keeps the one job on its day (no second job)');
  L = await leadOf(S6, B.lead); t(!!L.signed && L.status === 'won', 'the lead is signed and Won');

  console.log('\nThe server: money recorded on the booked job stays when the form has no deposit');
  const C = await custFirst(S6, 'Cal Paidfirst');
  const D3 = dayAhead(6);
  bk = await S6.call('office', 'jobsave', { lead: C.lead, crew: 'Brad Crew', date: D3, slot: 's2', price: 120, pkg: 'other', svc: 'Fall cleanup', scope: 'all', pay: { s: 'deposit', amt: 60, how: 'cash' }, card: 0, note: '', addr: '12 Test St, Englewood' });
  t(bk.ok, 'booked with a $60 cash deposit recorded');
  ss = await S6.call('office', 'signsend', { id: C.lead, price: 120, pkg: 'other', svc: 'Fall cleanup', how: 'none', nosign: 1, taken: 1, crew: 'Brad Crew', date: D3, slot: 's2', note: '' });
  t(ss.ok && ss.booked, 'a no-signature form: booked at once (' + (ss.error || 'ok') + ')');
  J = await jobsOf(S6, C.lead); t(J.length === 1 && J[0].pay && J[0].pay.s === 'deposit' && J[0].pay.amt === 60, 'the $60 deposit on the job is kept (' + JSON.stringify(J[0] && J[0].pay) + ')');

  console.log('\nThe lead path is unchanged: Pipeline card, then the form');
  const E = await S6.call('office', 'leadadd', { src: 'phone', name: 'Lena Leadonly', phone: phone(), email: 'lena@example.com', town: '14 Test St, Englewood', need: 'Aeration' });
  ss = await S6.call('office', 'signsend', { id: E.id, price: 90, pkg: 'aerate', how: 'none', nosign: 0, taken: 1, crew: 'Brad Crew', date: D1, slot: 's4', note: '' });
  t(ss.ok, 'a plain lead\u2019s form goes out as before (' + (ss.error || 'ok') + ')');
  sg = await S6.call('office', 'a365signed', { s: signKey(ss.link), name: 'Lena Leadonly', agree: true, read: true });
  J = await jobsOf(S6, E.id); t(sg.ok && J.length === 1 && J[0].pkg === 'aerate' && J[0].date === D1 && J[0].slot === 's4', 'and signing books its job on the form\u2019s day');

  /* ---------------- the browser ---------------- */
  const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', CP = 9531; prof = mkdtempSync(join(tmpdir(), 'cdp-custform-'));
  chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((x) => (ws.onopen = x));
  let cid = 0; const pend = new Map(), errs = [];
  const send = (m, p = {}) => new Promise((x) => { const i = ++cid; pend.set(i, x); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); };
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.value;
  const until = async (e, ms = 20000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return true; await sleep(150); } return false; };
  const shot = async (nm) => writeFileSync(join(TMP, nm), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const btn = (re) => `[...document.querySelectorAll('button,a')].find(b=>${re}.test((b.textContent||'').trim()) && b.offsetParent)`;
  const click = async (sel) => {
    const r = await js(`(function(){var e=${sel};if(!e)return null;e.scrollIntoView({block:'center'});var b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
    if (!r) return false; await sleep(120);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] }); await sleep(60);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(40);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
    return true;
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  const signBrowser = async (I, code) => {
    await send('Network.clearBrowserCookies');
    await send('Page.navigate', { url: I.ORIGIN + '/summit-de59ae83/' }); await sleep(900);
    await js(`fetch('../api/rounds.php?action=signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'${code}',dev:'p'})}).then(r=>r.json()).then(j=>j.terms&&j.terms.due?fetch('../api/rounds.php?action=termsaccept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({terms:j.terms.terms,agreement:j.terms.agreement||''})}):null)`);
    await send('Page.navigate', { url: I.ORIGIN + '/summit-de59ae83/' }); await sleep(1800);
  };

  console.log('\nThe page: Jen\u2019s path (Sixfold, office)');
  const P1 = await custFirst(S6, 'Daniel Pagecheck');
  await signBrowser(SIX, CODES.office);
  await js(`window.__cv('${P1.cust}')`);
  t(await until(btn('/^\\+ Book a job$/')), 'the customer page shows + Book a job');
  t(await until(btn('/^Send a form$/')), 'and now Send a form');
  await shot('six-customer.png');
  await click(btn('/^Send a form$/'));
  t(await until(btn('/^Send the form/')), 'Send a form opens "Deposit and form"');
  t(!!(await js(btn('/^Another service$/'))), 'Another service is on it');
  t(await until(`!!document.querySelector('.jcrewsel')`), 'the crew list is there');
  await click(btn('/^Another service$/'));
  t(await until(`!!document.querySelector('.jsvc') && !document.querySelector('.jsvc').hidden`), 'tapping Another service asks "What service?"');
  await js(`(function(){var i=document.querySelector('.jsvc input');i.value='Fall cleanup';i.dispatchEvent(new Event('input',{bubbles:true}));var p=document.querySelector('.jdep input');p.value='175';p.dispatchEvent(new Event('input',{bubbles:true}));var s=document.querySelector('.jcrewsel');s.value='Brad Crew';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(500);
  const D4 = dayAhead(2);
  await click(`[...document.querySelectorAll('.jstrip button')].find(b=>!b.disabled && b !== document.querySelector('.jstrip .sel')) || document.querySelector('.jstrip .sel')`); await sleep(300);
  await click(`[...document.querySelectorAll('.jslots button')].find(b=>!b.disabled)`); await sleep(200);
  await click(btn('/^No deposit$/')); await sleep(200);
  await shot('six-sign.png');
  await click(btn('/^Send the form/'));
  t(await until(btn('/^Copy the link$/')), 'the form is ready to text or email' + ((await js(`(document.querySelector('.err')||{}).textContent||''`)) || ''));
  await shot('six-sent.png');
  L = await leadOf(S6, P1.lead); t(L.quote && L.quote.pkg === 'other' && L.quote.svc === 'Fall cleanup' && L.quote.price === 175, 'the form carries Another service: Fall cleanup, $175');
  await click(btn('/^Done$/'));
  t(await until(btn('/^Send a form$/')), 'Done goes back to the customer page');

  console.log('\nThe page: booked from the customer page first, then Send a form (Sixfold, office)');
  const P2 = await custFirst(S6, 'Dora Pagebooked');
  const D5 = dayAhead(4);
  bk = await S6.call('admin', 'jobsave', { lead: P2.lead, crew: 'Brad Crew', date: D5, slot: 's2', price: 210, pkg: 'other', svc: 'Fall cleanup', scope: 'all', pay: { s: 'unpaid' }, card: 0, note: '', addr: '12 Test St, Englewood' });
  t(bk.ok, 'booked by hand first');
  await js(`window.__cv('${P2.cust}')`); await until(btn('/^Send a form$/'));
  await click(btn('/^Send a form$/'));
  t(await until(btn('/^Send the form/')), 'Send a form opens "Deposit and form"');
  t(await until(`(function(){var b=${btn('/^Another service$/')};return b&&b.getAttribute('aria-pressed')==='true';})()`), 'Another service is picked, from the job');
  t((await js(`document.querySelector('.jsvc input').value`)) === 'Fall cleanup', 'the service name comes from the job');
  t(String(await js(`document.querySelector('.jdep input').value`)) === '210', 'the price comes from the job');
  t(await until(`/Booked already/.test(document.querySelector('.jform').textContent)`), 'it says the job is booked already and the form is for that day');
  t(await until(`(function(){var b=[...document.querySelectorAll('.jslots button')].find(x=>x.getAttribute('aria-pressed')==='true');return !!b && !b.disabled;})()`), 'the job\u2019s own time is picked, not shown as taken');
  await click(btn('/^No deposit$/')); await sleep(200);
  await shot('six-sign-booked.png');
  await click(btn('/^Send the form/'));
  t(await until(btn('/^Copy the link$/')), 'the form goes out for that booking' + ((await js(`(document.querySelector('.err')||{}).textContent||''`)) || ''));
  J = await jobsOf(S6, P2.lead); t(J.length === 1 && J[0].date === D5 && J[0].slot === 's2', 'still one job on the board');

  console.log('\nThe page: an edition');
  const K1 = await custFirst(K6, 'Kit Customer');
  await signBrowser(KIT, CODES.admin);
  await js(`window.__cv('${K1.cust}')`);
  t(await until(btn('/^Send a form$/')), 'the edition\u2019s customer page has Send a form');
  await click(btn('/^Send a form$/'));
  t(await until(`/Build a quote|Change the quote/.test(document.body.textContent) && document.querySelector('.kitq')`), 'it opens the edition\u2019s own quote (its form comes from there)');
  await shot('kit-quote.png');
  t(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
} catch (e) { t(false, 'test crashed: ' + (e.stack || e)); }
finally {
  for (const p of procs) try { p.kill(); } catch {}
  if (chrome) try { chrome.kill(); } catch {}
  await sleep(500); if (prof) for (let i = 0; i < 50; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(100); } }
  console.log(`\n${pass} passed, ${fail} failed  (screens and data in ${TMP})`);
  process.exit(fail ? 1 : 0);
}

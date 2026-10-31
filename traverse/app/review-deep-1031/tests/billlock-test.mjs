/* Setup mode and the past-due lock (2026-10-29, Matthew): before payment and until Release to client the client's admin reaches only
   Billing, Company, Setup and Accounts, and team members see "being set up"; past due for 3 days or cancelled locks it back; Give more time;
   paid again opens it; the super admin is never locked; an exempt install (features.billexempt) is never locked; a role preview sees the
   install's current state; Sixfold is untouched. Server refusals first, then the screens in headless Chrome. Throwaway harness codes only. */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-deep';
const DATA = DIR + '/sixfold-data/rounds', BFILE = DATA + '/billing.json', MAIL = DIR + '/mail-mock.log';
const ORIGIN = 'http://127.0.0.1:8815', BASE = ORIGIN + '/api/rounds.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
const jars = {};
async function call(who, action, params, body, headers = {}) {
  let u = `${BASE}?action=${action}`; for (const [k, v] of Object.entries(params || {})) u += `&${k}=${encodeURIComponent(v)}`;
  const r = await fetch(u, { method: body ? 'POST' : 'GET', headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jars[who] ? { Cookie: jars[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) jars[who] = sc.split(';')[0];
  const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch {} j._status = r.status; return j;
}
const signin = (who, code) => call(who, 'signin', null, { code, dev: 'c' });
const agree = async (who, s) => { if (s.terms && s.terms.due) await call(who, 'termsaccept', null, { terms: s.terms.terms, agreement: s.terms.agreement || '' }); };
const mode = (m, exempt) => execFileSync('node', [DIR + '/mode.cjs', m], { encoding: 'utf8', env: { ...process.env, BL_NOEXEMPT: exempt ? '0' : '1' } });
const bill = (o) => writeFileSync(BFILE, JSON.stringify(o));
const bj = () => JSON.parse(readFileSync(BFILE, 'utf8'));
const locked = (j) => j._status === 403 && j.why === 'locked';
const mailLines = () => existsSync(MAIL) ? readFileSync(MAIL, 'utf8').split('\n').filter((l) => /is locked/.test(l)).length : 0;
let evn = 0;
async function hook(type, object, created) {
  const ev = JSON.stringify({ id: 'evt_bl_' + (++evn) + '_' + Date.now(), type, created: created || now(), data: { object } }), ts = now();
  const r = await fetch(BASE + '?action=billinghook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${createHmac('sha256', 'whsec_mock').update(ts + '.' + ev).digest('hex')}` }, body: ev });
  return r.status;
}
const sub = (o) => ({ id: 'sub_bl1', object: 'subscription', customer: 'cus_bl', status: 'active', cancel_at_period_end: false, metadata: { install: 'sixfold-data' }, items: { data: [{ price: { id: 'price_mock_crew_month' }, quantity: 1, current_period_end: now() + 30 * 86400 }] }, ...o });
const PAIDBASE = () => ({ status: 'active', plan: 'crew', interval: 'month', seats: 5, subscription: 'sub_bl1', customer: 'cus_bl', paid_sub: 'sub_bl1', paid_at: now() - 3600 });
const VA = (r) => ({ 'X-View-As': 'role:' + r });

/* what a client admin may still do, and what stays shut, while locked */
const ADMIN_OK = ['billing', 'accounts', 'kit', 'mail', 'imports', 'payways'];
const SHUT = ['regions', 'area', 'streets', 'search', 'leads', 'customers', 'jobs', 'stats', 'statspage', 'territories', 'stormdays', 'mydoors', 'board', 'houseposs', 'calendar'];

const codes = {};
try {
  mode('edition', false); bill({});
  console.log('Before payment (unpaid)');
  const a = await signin('admin', '222222'); await agree('admin', a);
  t(a.ok && a.lock && a.lock.kind === 'setup' && a.lock.phase === 'unpaid' && a.lock.paid === false && a.lock.admin === true, 'the admin signs in; the answer says setup mode, not paid yet');
  const s0 = await signin('super', '777777');
  t(s0.ok && s0.super && s0.lock === null, 'the super admin signs in with no lock');
  for (const x of ADMIN_OK) { const r = await call('admin', x); t(!locked(r) && r._status !== 403, `admin may open ${x} (${r._status})`); }
  let shutOk = 0; for (const x of SHUT) { const r = await call('admin', x, { region: 'englewood', q: '100 main' }); if (locked(r)) shutOk++; else console.log('     open: ' + x + ' ' + r._status); }
  t(shutOk === SHUT.length, `admin is refused every door screen (${shutOk}/${SHUT.length}: doors, maps, Plan, house lookup, storm lists, search, pipeline, stats)`);
  const mk = await call('admin', 'mark', null, { region: 'englewood', id: 'x', outcome: 'miss' });
  t(locked(mk) && /up to 2 business days, often sooner/.test(mk.error), 'a door mark is refused too, with the setup words');
  for (const [n, r] of [['Bl Rep', 'crew'], ['Bl Setter', 'setter'], ['Bl Manager', 'manager'], ['Bl Office', 'office']]) {
    const j = await call('admin', 'accountadd', null, { name: n, role: r }); codes[r] = j.code; t(j.ok && /^\d{6}$/.test(j.code || ''), `the admin adds a ${r} in setup mode`);
  }
  const rep = await signin('rep', codes.crew); await agree('rep', rep);
  t(rep.ok && rep.lock && rep.lock.kind === 'setup' && rep.lock.admin === false && !('phase' in rep.lock), 'a sales rep signs in; told it is being set up (no billing details)');
  let r = await call('rep', 'myleads'); t(locked(r) && /being set up/.test(r.error), 'the rep is refused their leads: "being set up"');
  r = await call('rep', 'me'); t(r.ok && r.lock && r.lock.kind === 'setup', "the rep's me carries the lock");
  const mg = await signin('mgr', codes.manager); await agree('mgr', mg);
  r = await call('mgr', 'accounts'); t(locked(r), 'a manager cannot open team sign-ins while locked');
  const st = await signin('setter', codes.setter); await agree('setter', st);
  r = await call('setter', 'area', { region: 'englewood' }); t(locked(r), 'a setter cannot load doors while locked');
  r = await call('super', 'leads'); t(r.ok, 'the super admin opens the pipeline in setup mode');
  r = await call('super', 'me'); t(r.ok && r.lock === null, "the super admin's me has no lock");
  console.log('Role preview in setup mode');
  r = await call('super', 'me', null, null, VA('crew')); t(r.ok && r.viewing && r.lock && r.lock.kind === 'setup' && r.lock.admin === false, 'previewing a sales rep: their lock');
  r = await call('super', 'myleads', null, null, VA('crew')); t(locked(r), 'previewing a sales rep: their leads are refused, as for them');
  r = await call('super', 'me', null, null, VA('admin')); t(r.ok && r.lock && r.lock.admin === true && r.lock.phase === 'unpaid', 'previewing an admin: the setup checklist state');
  r = await call('super', 'leads', null, null, VA('admin')); t(locked(r), 'previewing an admin: the pipeline is refused');
  r = await call('super', 'billing', null, null, VA('admin')); t(r.ok, 'previewing an admin: Billing opens');

  console.log('Paid, not released');
  bill(PAIDBASE());
  r = await call('admin', 'me'); t(r.lock && r.lock.kind === 'setup' && r.lock.phase === 'setup' && r.lock.paid === true, 'admin: setup mode, paid');
  t(locked(await call('admin', 'leads')) && locked(await call('rep', 'myleads')), 'the pipeline and the rep stay shut');
  r = await call('admin', 'billinglive', null, {}); t(r._status === 403, 'the client admin cannot release it');

  console.log('Released (Release to client = billinglive)');
  r = await call('super', 'billinglive', null, {}); t(r.ok && r.liveAt && r.lock && r.lock.phase === 'live', 'the super admin releases it; the answer says live');
  r = await call('admin', 'me'); t(r.ok && r.lock === null, 'admin: no lock');
  t((await call('rep', 'myleads')).ok && (await call('admin', 'leads')).ok, 'the rep and the pipeline are open at once');
  t(!!bj().released_at, 'released_at is kept');

  console.log('Past due, under 3 days');
  const pdAt = now() - 86400;
  t(await hook('customer.subscription.updated', sub({ status: 'past_due' }), pdAt) === 200, 'Stripe says past_due (the event made a day ago)');
  t(bj().past_due_at === pdAt, "past_due_at is Stripe's event time");
  t((await call('rep', 'myleads')).ok, 'the rep still works');
  r = await call('admin', 'billing'); t(r.lock && r.lock.phase === 'due' && /keeps working until/.test(r.warn || ''), 'Billing warns when the team pauses: ' + (r.warn || ''));
  t(await hook('customer.subscription.updated', sub({ status: 'past_due' }), now()) === 200 && bj().past_due_at === pdAt, 'a later past_due event keeps the first time');

  console.log('Past due, 3 days or more');
  const m0 = mailLines();
  bill({ ...bj(), past_due_at: now() - 3 * 86400 - 60 });
  /* narrowed (2026-10-29, Matthew: "The lock if they dont pay should only pertain to stuff we add"): Traverse's data shuts, the company's own work stays open */
  r = await call('rep', 'area', { region: 'englewood' }); t(locked(r) && /^Door data is paused: your company.s account needs attention\.$/.test(r.error) && r.lock.kind === 'billing', 'the rep\'s doors are paused: "Door data is paused: your company\'s account needs attention."');
  r = await call('rep', 'myleads'); t(r.ok && r._status === 200, 'the rep keeps their own leads');
  r = await call('rep', 'me'); t(r.ok && r.lock && r.lock.kind === 'billing', "the rep's me says why the doors are paused");
  r = await call('admin', 'me'); t(r.lock && r.lock.kind === 'billing' && r.lock.phase === 'locked', 'admin: locked for payment');
  const KEEP = ['leads', 'myleads', 'customers', 'jobs', 'schedview', 'statspage', 'mystats', 'accounts', 'company', 'kit', 'mail', 'payways', 'imports', 'payments', 'calendar', 'teams', 'goals', 'alertlist', 'billing', 'plantemplates', 'customersexport', 'hoursall'];
  let keepOk = 0; for (const x of KEEP) { const rr = await call('admin', x, { from: '2026-10-01', to: '2026-10-31' }); if (!locked(rr)) keepOk++; else console.log('     shut: ' + x); }
  t(keepOk === KEEP.length, `admin keeps the company's own screens (${keepOk}/${KEEP.length}: pipeline, customers, jobs, schedule, stats on leads and jobs, accounts, settings, setup, imports, downloads)`);
  const DATA_SHUT = ['regions', 'area', 'streets', 'search', 'territories', 'stormdays', 'mydoors', 'board', 'stats', 'houseposs', 'aroundjobs', 'alerts', 'sample'];
  let dShut = 0; for (const x of DATA_SHUT) { const rr = await call('admin', x, { region: 'englewood', q: '100 main' }); if (locked(rr)) dShut++; else console.log('     open: ' + x + ' ' + rr._status); }
  t(dShut === DATA_SHUT.length, `admin: Traverse's data is paused (${dShut}/${DATA_SHUT.length}: towns, doors, streets, search, territories, storm lists, alerts, door stats, leaderboard, the Sample door)`);
  r = await call('admin', 'mark', null, { region: 'englewood', id: 'x', outcome: 'miss' }); t(locked(r) && /Door data is paused until the plan is paid/.test(r.error), 'a door mark is refused, with the admin\'s words');
  r = await call('admin', 'leadadd', null, { name: 'Bl Lock Lead', phone: '3035550142', src: 'phone', need: 'A quote', addr: '100 Main St', town: 'Englewood' });
  t(!locked(r) && r._status !== 403, 'admin: a new lead still saves (' + r._status + ')');
  r = await call('admin', 'billingportal', null, { back: ORIGIN + '/summit-de59ae83/' }); t(r.ok && r.url, 'admin: Manage billing still opens (to fix the card)');
  t((await call('admin', 'accounts')).ok, 'admin: Accounts still opens');
  r = await call('mgr', 'accounts'); t(!locked(r), 'a manager keeps team sign-ins (not locked: ' + (r.error || 'ok') + ')');
  r = await call('setter', 'area', { region: 'englewood' }); t(locked(r), 'a setter\'s doors are paused');
  r = await call('setter', 'myleads'); t(r.ok, 'a setter keeps their leads');
  t(mailLines() === m0 + 1, 'Traverse gets one email that it locked');
  await call('rep', 'myleads'); await call('admin', 'me');
  t(mailLines() === m0 + 1, '...and only one');
  r = await call('admin', 'alertlist'); t(r.ok && (r.items || []).some((x) => /Door data is paused/.test(x.t)), "the admin's alerts say so (Door data is paused)");
  t((await call('super', 'leads')).ok && (await call('super', 'area', { region: 'englewood' }))._status !== 403, 'the super admin is still open, doors too');
  r = await call('super', 'area', { region: 'englewood' }, null, VA('crew')); t(locked(r) && r.lock.kind === 'billing', 'previewing a rep: doors paused, as for them');
  r = await call('super', 'myleads', null, null, VA('crew')); t(r.ok, 'previewing a rep: their leads open, as for them');

  console.log('Give more time');
  r = await call('admin', 'billingmore', null, { days: 2 }); t(r._status === 403, 'the client admin cannot give more time');
  r = await call('super', 'billingmore', null, { days: 0 }); t(!r.ok && /1 to 60/.test(r.error || ''), 'zero days is refused');
  r = await call('super', 'billingmore', null, { days: 2 });
  t(r.ok && r.lock && r.lock.phase === 'due' && Math.abs(r.lock.moreUntil - (now() + 2 * 86400)) < 120, 'two more days from now (it had already locked)');
  t((await call('rep', 'area', { region: 'englewood' }))._status !== 403, 'the rep\'s doors work again');
  t(bj().more.length === 1 && bj().more[0].days === 2 && bj().more[0].by, 'it is listed with who gave it');
  t(/"what":"more time"/.test(readFileSync(DATA + '/billing.log', 'utf8')), 'and in billing.log');
  t((r.more || []).length === 1, 'the super admin sees it on Billing');
  r = await call('admin', 'billing'); t((r.more || []).length === 0 && r.lock.moreUntil, 'the client admin sees the date, not the log');

  console.log('Paid again');
  t(await hook('customer.subscription.updated', sub({ status: 'active' })) === 200, 'Stripe says active');
  let b = bj(); t(!b.past_due_at && !b.more_until && b.live_at, 'past_due_at and more time cleared, still live');
  t((await call('rep', 'myleads')).ok && (await call('admin', 'me')).lock === null, 'open for everyone');

  console.log('Cancelled');
  t(await hook('customer.subscription.deleted', sub({ status: 'canceled', ended_at: now() })) === 200, 'Stripe says the subscription ended');
  r = await call('rep', 'area', { region: 'englewood' }); t(locked(r) && r.lock.kind === 'billing', 'the rep\'s doors pause at once');
  t((await call('rep', 'myleads')).ok, '...their leads stay open');
  r = await call('admin', 'billing'); t(r.ok && r.lock.phase === 'locked' && /paused for your team/.test(r.warn || ''), 'admin: Billing says pick a plan; door data is paused: ' + (r.warn || ''));
  r = await call('admin', 'billingcheckout', null, { plan: 'crew', interval: 'month', seats: 5, back: ORIGIN + '/summit-de59ae83/' }); t(r.ok && r.url, 'admin: a new plan can be picked (checkout opens)');
  r = await call('super', 'billingmore', null, { days: 1 }); t(r.ok && (await call('rep', 'area', { region: 'englewood' }))._status !== 403, 'more time opens a cancelled install too');
  bill({ ...bj(), more_until: now() - 10 }); t(locked(await call('rep', 'area', { region: 'englewood' })), 'when it runs out, doors pause again');

  console.log('A new subscription after the plan ended');
  t(await hook('customer.subscription.created', sub({ id: 'sub_bl2', status: 'active' })) === 200, 'Stripe says a new subscription is active');
  b = bj(); t(b.subscription === 'sub_bl2' && b.live_at && b.live_by === 'Paid again' && !b.more_until, 'live at once (it was released before)');
  t((await call('rep', 'myleads')).ok && (await call('admin', 'me')).lock === null, 'open for everyone, no Release needed');

  console.log('A failed first payment');
  bill({ status: 'incomplete', subscription: 'sub_x', customer: 'cus_bl' });
  r = await call('admin', 'me'); t(r.lock && r.lock.phase === 'unpaid', 'never paid: still before payment');

  console.log('An exempt install (Traverse\'s own editions)');
  mode('edition', true); bill({});
  r = await call('admin', 'me'); t(r.ok && r.lock === null, 'features.billexempt: no lock with nothing paid');
  t((await call('rep', 'myleads')).ok && (await call('admin', 'leads')).ok, 'team and pipeline open');
  r = await call('super', 'billing'); t(r.ok && r.exempt === true, 'Billing tells the super admin it is exempt');
  bill({ ...PAIDBASE(), status: 'past_due', past_due_at: now() - 10 * 86400, live_at: now() - 20 * 86400 });
  t((await call('rep', 'myleads')).ok, 'exempt and long past due: still open');

  console.log('Sixfold: nothing changes');
  mode('sixfold'); bill({});
  r = await call('admin', 'me'); t(r.ok && !('lock' in r), "Sixfold's me has no lock field");
  t((await call('admin', 'leads')).ok, 'the pipeline opens');
  r = await signin('rep6', codes.crew); t(r.ok && !('lock' in r), 'a crew sign-in has no lock field');
  t((await call('rep6', 'myleads'))._status === 200, 'and works');
} catch (e) { console.log('FAILED: ' + (e.stack || e)); fail++; }

/* ---- the screens ---- */
mode('edition', false); bill({});
const PORT = 8987;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map(), errors = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
const waitFor = async (e, l, ms = 15000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return; await sleep(150); } throw new Error('timeout: ' + l); };
const CLICK = (sel, txt) => `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.includes(${JSON.stringify(txt)}));if(e){e.click();return true}return false})()`;
const shot = async (n) => writeFileSync(`${DIR}/${n}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
const text = () => js(`document.getElementById('view').innerText`);
async function openAs(who, w = 390, va) {
  await send('Network.clearBrowserCookies');
  await send('Network.setCookie', { name: jars[who].split('=')[0], value: jars[who].slice(jars[who].indexOf('=') + 1), url: ORIGIN });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
  await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); await sleep(300);
  await js(`(()=>{try{sessionStorage.clear(); ${va ? `sessionStorage.setItem('viewas:'+location.pathname, ${JSON.stringify(va)});` : ''}}catch(e){}return true})()`);
  if (va) { await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); await sleep(300); }
}
try {
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((res) => (ws.onopen = res));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  for (const w of ['admin', 'rep', 'super']) { const s = await signin(w, w === 'admin' ? '222222' : w === 'super' ? '777777' : codes.crew); await agree(w, s); }

  console.log('Screens: before payment');
  await openAs('admin');
  await waitFor(`!!document.querySelector('.setuph')`, 'the setup home');
  let tx = await text();
  t(/Welcome to Traverse/.test(tx) && /Pay to start setup/.test(tx) && /Add your team/.test(tx) && /Connect email and payments/.test(tx) && /Import your customers/.test(tx), 'the checklist: pay, team, email and payments, import');
  t(/up to 2 business days, often sooner/.test(tx), '"up to 2 business days, often sooner"');
  t(!(await js(`!!document.querySelector('#tabnav:not([hidden])')`)), 'no menu bar to the locked screens');
  await waitFor(`!!document.querySelector('.kitstep.done[data-step=team]')`, 'team ticked');
  t(!(await js(`!!document.querySelector('.kitstep.done[data-step=pay]')`)), 'Add your team is ticked (people were added), Pay is not');
  await shot('billlock-1-setup-phone');
  await js(CLICK('.setuph .kitstep', 'Add your team'));
  await waitFor(`document.querySelectorAll('.door.acct').length>=1`, 'accounts from the checklist');
  await js(CLICK('.addlead', 'Add a person'));
  await waitFor(`!!document.querySelector('.acf .rolesall')`, 'the role lines');
  const lines = await js(`[...document.querySelectorAll('.acf .rolesall li')].map(l=>l.textContent)`);
  t(lines.length === 6 && lines.some((l) => /^Setter: knocks doors and books appointments/.test(l)) && lines.some((l) => /^Production crew: does the work/.test(l)) && lines.some((l) => /^Sales rep: .*sends the agreement and takes the deposit/.test(l)), 'Accounts: one line per role, in Roofing\'s words');
  await shot('billlock-2-roles');
  await js(CLICK('.acf .aseg-ed button', 'Setter'));
  t(await js(`document.querySelector('.acf .rolesall li.on').getAttribute('data-role')==='setter'`), 'the picked role stands out');
  await openAs('admin', 1280);
  await waitFor(`!!document.querySelector('.setuph')`, 'the setup home on a computer');
  t(await js(`document.getElementById('dnav').hidden`), 'on a computer: no top menu while locked');
  await shot('billlock-3-setup-desk');
  await openAs('rep');
  await waitFor(`!!document.querySelector('.lockv')`, 'the team screen');
  t(/being set up/.test(await text()) && /admin will let you know/.test(await text()), 'a team member: "Your company\'s Traverse is being set up"');
  await shot('billlock-4-team-setup');

  console.log('Screens: paid, then released from Billing');
  bill(PAIDBASE());
  await openAs('admin');
  await waitFor(`!!document.querySelector('.setuph')`, 'the setup home, paid');
  tx = await text();
  t(/Paid: we’re setting up your towns and data; ready in up to 2 business days, often sooner/.test(tx) && await js(`!!document.querySelector('.kitstep.done[data-step=pay]')`), 'paid: the message, and Pay is ticked');
  await shot('billlock-5-paid');
  await openAs('super');
  await waitFor(`!!document.querySelector('.choose') && !document.querySelector('.setuph')`, 'the super admin\'s normal home');
  await js(`(()=>{const e=[...document.querySelectorAll("button.tile")].find(x=>/^Billing/.test(x.textContent));if(e){e.click();return true}return false})()`);
  await waitFor(`[...document.querySelectorAll('.billgo')].some(b=>b.textContent==='Release to client')`, 'Release to client');
  t(!(await js(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Mark live')`)), 'no Mark live label left');
  t(/ready in up to 2 business days, often sooner/.test(await text()), 'Billing: "ready in up to 2 business days, often sooner"');
  await js(CLICK('.billgo', 'Release to client'));
  await waitFor(`/Live since/.test(document.getElementById('view').innerText)`, 'live after release');
  t(!!bj().live_at, 'released: live_at saved');
  await openAs('rep');
  await waitFor(`!!document.querySelector('.choose') || !!document.querySelector('.crewh')`, 'the rep\'s home');
  t(!(await js(`!!document.querySelector('.lockv')`)), 'the rep gets the app');

  console.log('Screens: past due 3 days, more time');
  bill({ ...bj(), status: 'past_due', past_due_at: now() - 4 * 86400 });
  /* narrowed (2026-10-29): the team keeps the app; the homes say door data is paused, and the door screens show it */
  await openAs('rep');
  await waitFor(`!!document.querySelector('.paylock')`, 'the rep\'s home, with the paused bar');
  t(/Door data is paused: your company’s account needs attention\./.test(await text()) && /admin has been told/.test(await text()) && !(await js(`!!document.querySelector('.lockv')`)), 'a team member keeps the app; the bar: "Door data is paused: your company\'s account needs attention."');
  await shot('billlock-6-team-billing');
  await js(CLICK('button.tile', 'Routes'));
  await waitFor(`!!document.querySelector('.pausedv')`, 'the door screen, paused');
  t(/Door data is paused/.test(await text()) && !(await js(`!!document.querySelector('.paylock .save')`)), 'Routes: "Door data is paused" (no Billing button for a rep)');
  await shot('billlock-6b-team-doors-paused');
  await openAs('admin');
  await waitFor(`!!document.querySelector('.paylock .save')`, 'the admin\'s home, with the paused bar');
  t(!(await js(`!!document.querySelector('.setuph')`)) && /Update|paid/.test(await text()) && /Open Billing/.test(await text()), 'the admin keeps the app: the bar, with Open Billing');
  await shot('billlock-7-admin-billing');
  await js(CLICK('button.tile', 'Pipeline'));
  await sleep(2500);
  t(/Pipeline/.test(await js(`document.body.innerText`)) && !(await js(`!!document.querySelector('.pausedv')`)) && !/Door data is paused/.test(await text()), 'the admin\'s Pipeline opens while door data is paused');
  await shot('billlock-7b-admin-pipeline');
  await openAs('admin', 1280);
  await waitFor(`!!document.querySelector('.dhome .paylock') || !!document.querySelector('.paylock')`, 'the admin\'s computer home, with the bar');
  t(!(await js(`document.getElementById('dnav').hidden`)), 'on a computer: the top menu stays');
  await js(`(()=>{const b=[...document.querySelectorAll('#dnav button')].find(x=>x.getAttribute('data-k')==='doors');if(b){b.click();return true}return false})()`);
  await waitFor(`!!document.querySelector('.pausedv')`, 'Doors from the top menu: paused');
  t(true, 'Doors in the top menu shows the paused screen');
  await openAs('super');
  await waitFor(`!!document.querySelector('.choose')`, 'super home');
  await js(`(()=>{const e=[...document.querySelectorAll("button.tile")].find(x=>/^Billing/.test(x.textContent));if(e){e.click();return true}return false})()`);
  await waitFor(`[...document.querySelectorAll('.billgo')].some(b=>b.textContent==='Give more time')`, 'Give more time');
  t(/Door data paused for their team now/.test(await text()), 'Billing tells Traverse door data is paused for them');
  await js(`(()=>{const i=document.querySelector('.billmore input');i.value='3';return true})()`);
  await js(CLICK('.billgo', 'Give more time'));
  await waitFor(`/More time given: door data pauses on/.test(document.getElementById('view').innerText)`, 'more time shown');
  t(bj().more_until > now() + 2 * 86400, 'more time saved (3 days)');
  await shot('billlock-8-more-time');

  console.log('Screens: a role preview in setup mode');
  bill({});
  await openAs('super', 390, 'role:crew');
  await waitFor(`!!document.querySelector('.lockv') && !!document.getElementById('vabar')`, 'the preview of a rep, locked');
  t(/being set up/.test(await text()), 'previewing a rep before payment: the waiting screen, with the blue bar');
  await shot('billlock-9-preview');
  await openAs('super', 390, 'role:admin');
  await waitFor(`!!document.querySelector('.setuph') && !!document.getElementById('vabar')`, 'the preview of an admin');
  t(/Pay to start setup/.test(await text()), 'previewing an admin before payment: the checklist');
  t(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
} catch (e) { console.log('FAILED: ' + (e.stack || e)); fail++; try { await shot('billlock-fail'); } catch {} }
try { chrome.kill(); } catch {}
mode('edition', true); bill({});
console.log(`billlock-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

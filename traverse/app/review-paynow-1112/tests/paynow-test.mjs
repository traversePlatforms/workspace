/* "Pay now (optional)" on the customer's form (Matthew 2026-11-12: "I want people to be able to pay ahead of time even if they dont have a
   deposit"). Three throwaway installs from the source (traverse/app), each on PHP's test server in a fresh temp folder:
     six    Sixfold 365 (company a365), Square            -> the 365 site's form page (sixfold/aeration365-site/sign) at /a365/sign/
     kitsq  an edition (kit), Square                      -> the install's own sign.html
     kitst  an edition (kit), Stripe only                 -> the install's own sign.html
   Square and Stripe are paymock.php (nothing real is called). Throwaway codes made here. Run once per run (fresh data every time):
     node traverse/app/review-paynow-1112/tests/paynow-test.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..'), REPO = join(APP, '..', '..');
const SITE365 = join(REPO, 'sixfold', 'aeration365-site', 'sign', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const TMP = mkdtempSync(join(tmpdir(), 'paynow-')), MOCKPORT = 8871, MOCK = 'http://127.0.0.1:' + MOCKPORT, STATE = join(TMP, 'paymock-state.json');
const procs = [];
const mock = spawn('php', ['-S', '127.0.0.1:' + MOCKPORT, join(HERE, 'paymock.php')], { env: { ...process.env, PAYMOCK_STATE: STATE }, stdio: 'ignore' }); procs.push(mock);
const CODES = { admin: '583921', crew: '583922', browser: '583923', tech: '583924' };
function install(name, port, kind) {
  const T = join(TMP, name), WWW = join(T, 'www'), DATA = join(T, 'sixfold-data', 'rounds'), PRIV = join(T, 'sixfold-private');
  mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
  for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php')) cpSync(join(APP, 'api', f), join(WWW, 'api', f));
  cpSync(join(APP, 'summit-de59ae83'), join(WWW, 'summit-de59ae83'), { recursive: true });
  /* a test door into the page's closure: the send-form screen opened straight from the test (this copy only; the shipped page is untouched) */
  const pg = join(WWW, 'summit-de59ae83', 'index.html'); let s = readFileSync(pg, 'utf8');
  s = s.replace('  function signSendView(l, pre) {', '  window.__sv = function (l, p) { return signSendView(l, p); };\n  function signSendView(l, pre) {'); writeFileSync(pg, s);
  if (kind === 'six') { mkdirSync(join(WWW, 'a365', 'sign'), { recursive: true }); cpSync(SITE365, join(WWW, 'a365', 'sign', 'index.html')); }
  const co = { name: 'Test ' + name, short: 'Test', phone: '(555) 010-0100', email: 'office@example.com', features: { walkdesk: true, crew: true, company: kind !== 'six' }, best: kind === 'six' ? null : 'yards' };
  if (kind === 'six') co.a365 = { name: '365 Test Aeration', phone: '(555) 010-0199', base: [39.6537, -104.9919], radius: 45 };
  writeFileSync(join(DATA, 'company.json'), JSON.stringify(co, null, 2));
  writeFileSync(join(DATA, 'index.json'), '{"regions":[]}');
  const people = { [CODES.admin]: ['Pat Admin', 'admin'], [CODES.browser]: ['Bea Browser', 'admin'], [CODES.crew]: ['Brad Crew', kind === 'six' ? 'crew' : 'tech'] };
  writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => " + JSON.stringify(people).replace(/\{/g, '[').replace(/\}/g, ']').replace(/":/g, '" =>') + "];\n");
  if (kind !== 'kitst') writeFileSync(join(PRIV, 'square.json'), JSON.stringify({ token: 'mock', location: 'LTEST', env: 'sandbox', api: MOCK, sigKey: 'hooksecret', hookUrl: 'https://example.test/hook' }));
  else writeFileSync(join(PRIV, 'stripe-pay.json'), JSON.stringify({ secret: 'sk_test_paynowmock12345' }));
  const srv = spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + port, '-t', WWW], { env: { ...process.env, TRAVERSE_STRIPEPAY_BASE: MOCK }, stdio: 'ignore' }); procs.push(srv);
  return { name, kind, port, origin: 'http://127.0.0.1:' + port, api: 'http://127.0.0.1:' + port + '/api/rounds.php', DATA, PRIV, jars: {} };
}
function req(url, { method = 'GET', body = null, cookie = '', headers = {} } = {}) {
  return new Promise((res) => {
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request(url, { method, headers: { ...headers, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (x) => {
      let s = ''; x.setEncoding('utf8'); x.on('data', (d) => (s += d)); x.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch { j = { raw: s.slice(0, 300) }; } j._status = x.statusCode; j._cookies = x.headers['set-cookie'] || []; res(j); });
    });
    r.on('error', (e) => res({ _status: 0, error: String(e) })); if (data) r.write(data); r.end();
  });
}
async function call(I, who, action, body, q = '') {
  const j = await req(I.api + '?action=' + action + q, { method: body ? 'POST' : 'GET', body, cookie: I.jars[who] || '' });
  if (j._cookies.length) { const jar = Object.fromEntries((I.jars[who] || '').split('; ').filter(Boolean).map((c) => c.split('='))); for (const c of j._cookies) { const [kv] = c.split(';'); const [k, v] = kv.split('='); jar[k] = v; } I.jars[who] = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }
  return j;
}
async function signin(I, who) {
  const s = await call(I, who, 'signin', { code: CODES[who], dev: 'c' });
  if (s.terms && s.terms.due) await call(I, who, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' });
  return s;
}
const keyOf = (link) => (/[?&]s=([A-Za-z0-9-]+)/.exec(link || '') || [])[1] || '';
const form = (I, link) => req(I.api + '?action=a365sign&s=' + encodeURIComponent(keyOf(link)));
const formSign = (I, link, name) => req(I.api + '?action=a365signed', { method: 'POST', body: { s: keyOf(link), name, agree: true, read: true } });
const mockState = async () => (await req(MOCK + '/_state'));
const mockPay = (order) => req(MOCK + '/_pay?order=' + encodeURIComponent(order));
const iso = (d) => d.toISOString().slice(0, 10);
const days = []; { const d = new Date(); d.setHours(12); for (let i = 1; days.length < 40; i++) { const x = new Date(d.getTime() + i * 86400000); if (x.getDay() !== 0) days.push(iso(x)); } }
let slotN = 0; const nextSlot = () => { const i = slotN++; return { date: days[Math.floor(i / 4)], slot: ['s1', 's2', 's3', 's4'][i % 4] }; };
async function newLead(I, name) { const r = await call(I, 'admin', 'leadadd', { name, phone: '555010' + String(1000 + Math.floor(Math.random() * 8999)).slice(0, 4), email: name.split(' ')[0].toLowerCase() + '@example.com', town: 'Testville', need: 'A quote', src: 'phone' }); return r.id; }
async function sendForm(I, id, how, price, extra = {}) { const ds = nextSlot(); return call(I, 'admin', 'signsend', { id, price, deposit: extra.deposit != null ? extra.deposit : Math.ceil(price / 2), nosign: extra.nosign === false ? 0 : 1, pkg: I.kind === 'six' ? 'full' : 'job', how, taken: 1, crew: 'Brad Crew', date: ds.date, slot: ds.slot, note: '' }); }
async function jobOf(I, lead) { const r = await call(I, 'admin', 'jobs', null, '&from=' + days[0] + '&to=' + days[39]); return (r.jobs || []).find((j) => j.lead === lead) || null; }
async function leadOf(I, id) { const r = await call(I, 'admin', 'leads'); return (r.leads || []).find((l) => l.id === id) || null; }
const DEP_LINES = /not confirmed until the deposit|non-refundable|confirmed once the deposit/i;

let chrome, prof;
try {
  const six = install('six', 8872, 'six'), kitsq = install('kitsq', 8873, 'kitsq'), kitst = install('kitst', 8874, 'kitst');
  for (const I of [six, kitsq, kitst]) for (let i = 0; i < 60; i++) { const r = await req(I.api + '?action=kitbrand'); if (r._status) break; await sleep(150); }
  for (let i = 0; i < 60; i++) { if ((await req(MOCK + '/_state'))._status) break; await sleep(150); }
  for (const I of [six, kitsq, kitst]) { const s = await signin(I, 'admin'); t(s.ok, I.name + ': admin signs in' + (s.ok ? '' : ' ' + JSON.stringify(s).slice(0, 200))); }

  /* ---------------- Sixfold 365, no signature ---------------- */
  console.log('\nSixfold 365: Pay now (optional), no signature');
  const L1 = await newLead(six, 'Olive Optional'); t(!!L1, 'a lead to quote');
  let st0 = await mockState(); const links0 = Object.keys(st0.links || {}).length;
  let r = await sendForm(six, L1, 'optional', 385);
  t(r.ok && r.optional === true && r.deposit === 0 && r.balance === 385 && r.booked === true && r.byLink === false, 'sent: no deposit, booked at once (like No deposit) ' + JSON.stringify({ ok: r.ok, e: r.error, d: r.deposit, b: r.booked }));
  t(r.payNow && r.payNow.ready === true && r.payNow.amount === 385 && r.payNow.paid === false, 'the form\u2019s pay link is made when it is sent');
  let st = await mockState(); let mine = Object.values(st.links).slice(links0);
  t(mine.length === 1 && mine[0].amount === 38500 && /^Payment: 365 Test Aeration$/.test(mine[0].name) && /365aeration\.com\/sign\/\?s=/.test(mine[0].redirect), 'one Square link for the whole $385, back to their form: ' + JSON.stringify(mine.map((x) => [x.amount, x.name])));
  let J1 = await jobOf(six, L1);
  t(J1 && J1.price === 385 && J1.pay && J1.pay.s === 'unpaid' && J1.sqlink && J1.sqlink.form === 1 && J1.sqlink.amt === 385, 'the job is booked, unpaid, deposit $0, with the link on it (marked as the form\u2019s)');
  let ld = await leadOf(six, L1);
  t(ld && ld.sign && ld.sign.how === 'optional' && ld.sign.deposit === 0 && ld.confirmed && ld.status === 'won', 'the lead: how optional, deposit 0, booked (won)');
  t(ld && (ld.notes || []).some((n) => /no deposit; they can pay it in full on the form/.test(n.note)), 'the lead note says no deposit, pay on the form if they like');
  let F = await form(six, r.link);
  t(F.ok && F.nosign && F.confirmed && F.full && F.full.booked && !F.full.paid && F.full.amount === 385 && F.full.url === J1.sqlink.url && F.full.via === 'Square', 'their form: booked, and a button for the $385 (the job\u2019s own link)');
  t(F.pay === null, 'no deposit card on their form');
  t(F.terms.length > 0 && !F.terms.some((x) => DEP_LINES.test(x)), 'terms: no "not confirmed until the deposit is paid", no "non-refundable": ' + F.terms.length + ' lines');
  t(F.facts.some((f) => f[0] === 'Deposit' && f[1] === 'None') && F.facts.some((f) => /^Balance due/.test(f[0]) && f[1] === '$385'), 'facts: Deposit None, balance $385 due when the work is done');
  await form(six, r.link); st = await mockState();
  t(Object.keys(st.links).length === links0 + 1, 'opening the form again makes no second link');
  /* the job card's Make a pay link: the same link */
  let pl = await call(six, 'admin', 'jobpaylink', { id: J1.id });
  t(pl.ok && pl.again === true && pl.url === J1.sqlink.url && pl.amt === 385 && pl.form === true, 'Make a pay link on the job card gives the form\u2019s link back (no second link)');
  st = await mockState(); t(Object.keys(st.links).length === links0 + 1, 'still one link in Square');
  let sp = await call(six, 'admin', 'squarepage');
  t(sp.ok && (sp.links || []).some((x) => x.owed === 385 && /Olive/.test(x.name)), '"Pay links sent, not paid yet" lists it ($385 owed)');
  /* they pay on the form */
  await mockPay(J1.sqlink.order);
  F = await form(six, r.link);
  t(F.full && F.full.paid === true && !F.full.url, 'paid on Square: their form says paid in full, no button');
  J1 = await jobOf(six, L1);
  t(J1.pay.s === 'paid' && J1.pay.how === 'square', 'the job shows paid in full (Square), as a job pay link does');
  ld = await leadOf(six, L1);
  t((ld.notes || []).some((n) => /Paid \$385 in full on their form \(Square link\)/.test(n.note)), 'a note on the lead: paid in full on their form');
  sp = await call(six, 'admin', 'squarepage');
  t(!(sp.links || []).some((x) => /Olive/.test(x.name)), 'it is off the "not paid yet" list');
  pl = await call(six, 'admin', 'jobpaylink', { id: J1.id });
  t(!pl.ok && /already paid/.test(pl.error || ''), 'Make a pay link now refuses: already paid');

  /* paid on the link without opening the form: Make a pay link finds it first */
  console.log('\nSixfold 365: paid on the link before the office makes another');
  const L2 = await newLead(six, 'Owen Optional');
  r = await sendForm(six, L2, 'optional', 300); let J2 = await jobOf(six, L2);
  await mockPay(J2.sqlink.order);
  pl = await call(six, 'admin', 'jobpaylink', { id: J2.id, amount: 100 });
  t(!pl.ok && pl._status === 409 && /already paid the \$300 on the pay link on their form/.test(pl.error || ''), 'a $100 link is refused: the form\u2019s link was paid (' + (pl.error || '').slice(0, 70) + ')');
  J2 = await jobOf(six, L2); t(J2.pay.s === 'paid', 'and the job now shows paid');

  /* the office makes a link for another amount: the form's link is turned off and the form offers no button */
  console.log('\nSixfold 365: a pay link for another amount');
  const L3 = await newLead(six, 'Iris Optional');
  r = await sendForm(six, L3, 'optional', 400); let J3 = await jobOf(six, L3); const oldL = J3.sqlink;
  pl = await call(six, 'admin', 'jobpaylink', { id: J3.id, amount: 150 });
  st = await mockState();
  t(pl.ok && pl.amt === 150 && pl.url !== oldL.url && st.links[oldL.id] && st.links[oldL.id].deleted === true, 'a $150 link is made and the form\u2019s $400 link is deleted in Square');
  F = await form(six, r.link);
  t(F.full && F.full.booked && !F.full.paid && !F.full.url && F.full.amount === 400, 'their form shows no button now (no second link to pay)');
  /* the price changes on the Jobs board: the form's link follows */
  console.log('\nSixfold 365: the price changes');
  const L4 = await newLead(six, 'Ezra Optional');
  r = await sendForm(six, L4, 'optional', 250); let J4 = await jobOf(six, L4); const old4 = J4.sqlink;
  const jsv = await call(six, 'admin', 'jobsave', { id: J4.id, crew: J4.crew, date: J4.date, slot: J4.slot, price: 275, pkg: J4.pkg, scope: J4.scope || 'all', pay: { s: 'unpaid' }, card: 0, note: '', addr: J4.addr || 'Testville' });
  t(jsv.ok, 'the price changed to $275 on the Jobs board ' + (jsv.ok ? '' : jsv.error));
  F = await form(six, r.link); st = await mockState(); J4 = await jobOf(six, L4);
  t(F.full && F.full.amount === 275 && F.full.url && F.full.url !== old4.url && J4.sqlink.amt === 275 && st.links[old4.id].deleted === true, 'their form now offers $275 on a new link; the $250 one is deleted');
  /* canceled: the link is turned off */
  const jc = await call(six, 'admin', 'jobsave', { id: J4.id, del: 1 }); st = await mockState();
  t(jc.ok && st.links[J4.sqlink.id].deleted === true, 'job canceled: the form\u2019s link is deleted in Square');

  /* the Square webhook marks it paid */
  console.log('\nSixfold 365: the Square webhook');
  const L5 = await newLead(six, 'Wade Optional');
  r = await sendForm(six, L5, 'optional', 220); let J5 = await jobOf(six, L5);
  await mockPay(J5.sqlink.order);
  const ev = JSON.stringify({ type: 'payment.updated', event_id: 'ev' + Date.now(), data: { object: { payment: { id: 'PAYHOOK1', status: 'COMPLETED', order_id: J5.sqlink.order } } } });
  const sig = createHmac('sha256', 'hooksecret').update('https://example.test/hook' + ev).digest('base64');
  const hk = await req(six.api + '?action=squarehook', { method: 'POST', body: ev, headers: { 'X-Square-HmacSha256-Signature': sig } });
  J5 = await jobOf(six, L5); ld = await leadOf(six, L5);
  t(hk._status === 200 && J5.pay.s === 'paid' && (ld.notes || []).some((n) => /in full on their form/.test(n.note) && /webhook/.test(n.note)), 'the webhook marks the job paid and notes it on the lead');

  /* a signature form: the button comes once signed */
  console.log('\nSixfold 365: Pay now (optional) with a signature');
  const L6 = await newLead(six, 'Sage Optional');
  st0 = await mockState(); const n6 = Object.keys(st0.links).length;
  r = await sendForm(six, L6, 'optional', 500, { nosign: false });
  t(r.ok && r.booked === false && r.nosign === false && r.payNow && r.payNow.ready === false, 'sent for signing: nothing booked, no link yet');
  F = await form(six, r.link);
  t(F.ok && !F.signed && F.full && F.full.booked === false && !F.full.url && F.full.amount === 500 && F.pay === null, 'before signing: no button, just the amount');
  t(!F.terms.some((x) => DEP_LINES.test(x)), 'signature form terms: no deposit lines either');
  const sg = await formSign(six, r.link, 'Sage Optional');
  t(sg.ok && sg.booked && sg.full && sg.full.booked && sg.full.url && sg.full.amount === 500, 'signed: booked, and the pay button comes back with the signature');
  st = await mockState(); t(Object.keys(st.links).length === n6 + 1, 'one link made, at signing');

  /* the other choices unchanged */
  console.log('\nSixfold 365: No deposit and the Square deposit link unchanged');
  const L7 = await newLead(six, 'Nora Nodeposit'); st0 = await mockState(); const n7 = Object.keys(st0.links).length;
  r = await sendForm(six, L7, 'none', 300);
  F = await form(six, r.link); st = await mockState();
  t(r.ok && r.booked && r.optional === false && r.payNow === null && F.full === null && Object.keys(st.links).length === n7, 'No deposit: booked, no link, no button (as before)');
  t(!F.terms.some((x) => DEP_LINES.test(x)) && F.facts.some((f) => f[0] === 'Deposit' && f[1] === 'None'), 'No deposit: same terms and facts as before');
  const L8 = await newLead(six, 'Liam Link');
  r = await sendForm(six, L8, 'link', 300); F = await form(six, r.link); st = await mockState();
  const dl = Object.values(st.links).pop();
  t(r.ok && r.byLink && r.deposit === 150 && !r.booked && F.pay && F.pay.amount === 150 && F.pay.url && F.full === null && dl.amount === 15000 && /^Deposit: /.test(dl.name), 'Square deposit link: $150 deposit to pay on the form, not booked until paid (as before)');
  t(F.terms.some((x) => /not confirmed until the deposit is paid/.test(x)) && F.terms.some((x) => /non-refundable/.test(x)), 'deposit link: the deposit lines are still in its terms');
  const L9 = await newLead(six, 'Cara Cash');
  r = await sendForm(six, L9, 'cash', 300); F = await form(six, r.link);
  t(r.ok && r.booked && r.deposit === 150 && F.full === null && F.terms.some((x) => /non-refundable/.test(x)), 'deposit taken in cash: booked with $150 in, deposit terms (as before)');

  /* ---------------- an edition, Square ---------------- */
  console.log('\nEdition (kit), Square');
  const K1 = await newLead(kitsq, 'Kim Kitsquare');
  r = await sendForm(kitsq, K1, 'optional', 1200);
  let KJ = await jobOf(kitsq, K1);
  t(r.ok && r.booked && r.payNow && r.payNow.ready && KJ && KJ.sqlink && KJ.sqlink.kind === 'square' && KJ.sqlink.amt === 1200, 'sent and booked; the $1,200 Square link is on the job ' + (r.ok ? '' : r.error));
  F = await form(kitsq, r.link);
  t(F.full && F.full.url === KJ.sqlink.url && /\/summit-de59ae83\/sign\.html\?s=/.test(Object.values((await mockState()).links).pop().redirect), 'their form (the install\u2019s own sign.html) offers it, and Square sends them back there');
  t(!F.terms.some((x) => DEP_LINES.test(x)) && F.facts.some((f) => f[0] === 'Deposit' && f[1] === 'None'), 'edition terms: no deposit line; Deposit None');
  await mockPay(KJ.sqlink.order); F = await form(kitsq, r.link); KJ = await jobOf(kitsq, K1);
  t(F.full.paid && KJ.pay.s === 'paid', 'paid: form and job agree');
  /* ways still needs a deposit */
  await call(kitsq, 'admin', 'paywaysset', { venmo: 'TestCo-Pay' });
  const K2 = await newLead(kitsq, 'Will Ways');
  r = await sendForm(kitsq, K2, 'ways', 600, { deposit: 0 });
  t(!r.ok && /at least \$1/.test(r.error || ''), 'other ways on the form still needs a deposit of at least $1 (as before): ' + (r.error || '').slice(0, 60));
  r = await sendForm(kitsq, K2, 'ways', 600);
  t(r.ok && r.byWays && r.deposit === 300, 'other ways with a $300 deposit sends (as before)');

  /* ---------------- an edition, Stripe only ---------------- */
  console.log('\nEdition (kit), Stripe only');
  const S1 = await newLead(kitst, 'Stella Stripe');
  r = await sendForm(kitst, S1, 'optional', 640);
  let SJ = await jobOf(kitst, S1); st = await mockState();
  const ses = SJ && SJ.sqlink ? st.sessions[SJ.sqlink.order] : null;
  t(r.ok && SJ && SJ.sqlink && SJ.sqlink.kind === 'stripe' && ses && ses.amount === 64000 && /sign\.html\?s=.*&paid=1$/.test(ses.success), 'a Stripe Checkout for $640, back to their form ' + (r.ok ? '' : r.error));
  F = await form(kitst, r.link);
  t(F.full && F.full.url === SJ.sqlink.url && F.full.via === 'Stripe', 'their form offers it by Stripe');
  const ck0 = await call(kitst, 'admin', 'squarecheck', { job: SJ.id });
  t(ck0.ok && ck0.paid === false, 'the office Check works on a Stripe link (not paid yet)');
  await mockPay(SJ.sqlink.order);
  F = await form(kitst, r.link); SJ = await jobOf(kitst, S1);
  t(F.full.paid && SJ.pay.s === 'paid' && SJ.pay.how === 'card', 'paid by Stripe: form paid in full, job paid (card)');
  const S2 = await newLead(kitst, 'Noel Nostripe');
  const cs = await signin(kitst, 'crew');
  r = await call(kitst, 'crew', 'signsend', { id: S2, price: 100, how: 'optional' });
  t(cs.ok && !r.ok && r._status === 403, 'a crew account cannot send it (403)');

  /* ---------------- the pages in a browser ---------------- */
  console.log('\nThe pages');
  const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', CP = 9483; prof = mkdtempSync(join(tmpdir(), 'cdp-paynow-'));
  chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((x) => (ws.onopen = x));
  let cid = 0; const pend = new Map(), errs = [];
  ws.onmessage = (ev2) => { const m = JSON.parse(ev2.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); };
  const send = (m, p = {}) => new Promise((x) => { const i = ++cid; pend.set(i, x); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.value;
  const until = async (e, ms = 15000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return true; await sleep(150); } return false; };
  const shot = async (n) => writeFileSync(join(TMP, n), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true });
  const go = async (url) => { await send('Page.navigate', { url }); await sleep(400); };
  /* an edition's sign.html, booked with no signature */
  const K3 = await newLead(kitsq, 'Paula Page'); r = await sendForm(kitsq, K3, 'optional', 385); KJ = await jobOf(kitsq, K3);
  await go(kitsq.origin + '/summit-de59ae83/sign.html?s=' + keyOf(r.link));
  t(await until(`!!document.querySelector('.fullpay a.btn')`), 'edition form: the Pay now card shows');
  const txt = await js(`document.querySelector('.fullpay').innerText`);
  t(/You\u2019re booked\. Pay \$385 now if you\u2019d like, or when the work is done\./.test(txt) && /Pay \$385 now/.test(txt), 'its words: "You\u2019re booked. Pay $385 now if you\u2019d like, or when the work is done."');
  t(await js(`document.querySelector('.fullpay a.btn').href`) === KJ.sqlink.url, 'its button opens the job\u2019s pay link');
  t(await js(`!document.querySelector('.fullpay').closest('main').innerText.match(/Pay your deposit/)`), 'no deposit card');
  await shot('edition-form.png');
  await mockPay(KJ.sqlink.order); await go(kitsq.origin + '/summit-de59ae83/sign.html?s=' + keyOf(r.link));
  t(await until(`!!document.querySelector('.fullpay.ok') && /Paid in full/.test(document.querySelector('.fullpay').innerText)`), 'after paying: "Paid in full" and no button');
  /* the 365 site's form page, a signature form: hint, sign, then the button */
  const L10 = await newLead(six, 'Hana Hint'); r = await sendForm(six, L10, 'optional', 410, { nosign: false });
  await go(six.origin + '/a365/sign/?s=' + keyOf(r.link));
  t(await until(`!!document.querySelector('.fullpay')`), '365 form: the card shows before signing');
  t(await js(`/Once you have signed, you can pay the \\$410 now if you like/.test(document.querySelector('.fullpay').innerText) && !document.querySelector('.fullpay a')`), '365 form before signing: a line saying they can pay after signing, no button');
  await js(`(function(){var c=document.querySelectorAll('main .card');var box=[...c].find(x=>/Sign/.test(x.querySelector('h2')?.textContent||''));var i=box.querySelector('input:not([type=checkbox])');i.value='Hana Hint';box.querySelectorAll('input[type=checkbox]').forEach(b=>b.checked=true);[...box.querySelectorAll('button')].find(b=>b.textContent==='Sign').click();})()`);
  t(await until(`!!document.querySelector('.fullpay a.btn')`), '365 form after signing: the Pay now button appears');
  t(await js(`/You\u2019re booked\\. Pay \\$410 now/.test(document.querySelector('.fullpay').innerText) && document.querySelectorAll('.fullpay').length === 1`), 'one card, with the booked words');
  await shot('365-form-signed.png');
  /* the office's send-form screen: the new choice, added after No deposit */
  await go(six.origin + '/summit-de59ae83/');
  await js(`fetch('../api/rounds.php?action=signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'${CODES.browser}',dev:'p'})}).then(r=>r.json()).then(j=>j.terms&&j.terms.due?fetch('../api/rounds.php?action=termsaccept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({terms:j.terms.terms,agreement:j.terms.agreement||''})}):null)`);
  await go(six.origin + '/summit-de59ae83/'); await sleep(1500);
  const L11 = await newLead(six, 'Owen Office');
  await js(`fetch('../api/rounds.php?action=leads').then(r=>r.json()).then(j=>{window.__lead=j.leads.find(l=>l.id==='${L11}');window.__sv(window.__lead,{price:385})})`);
  t(await until(`[...document.querySelectorAll('.jdep .dwlen button')].some(b=>b.textContent==='Pay now (optional)')`, 20000), 'send-form screen: "Pay now (optional)" is offered');
  const labels = await js(`[...document.querySelectorAll('.jdep .dwlen')][0] ? [...[...document.querySelectorAll('.jdep .dwlen')][0].querySelectorAll('button')].map(b=>b.textContent) : []`);
  t(labels[0] === 'Square link on the form (test)' && labels[labels.length - 2] === 'No deposit' && labels[labels.length - 1] === 'Pay now (optional)', 'the old choices keep their order; the new one is added at the end: ' + labels.join(' | '));
  await js(`[...document.querySelectorAll('.jdep .dwlen button')].find(b=>b.textContent==='Pay now (optional)').click()`); await sleep(200);
  const dt = await js(`document.querySelector('.jdeptxt').textContent`);
  t(/No deposit · they can pay \$385 now on the form, or when the work is done/.test(dt), 'its line: "' + dt + '"');
  t(await js(`document.querySelector('.jtaken').hidden && [...document.querySelectorAll('.jdep label')].find(l=>/Deposit/.test(l.textContent)).hidden`), 'no deposit box and no "I took the deposit" button for it');
  await shot('office-send-form.png');
  await js(`(function(){var s=document.querySelector('.jcrewsel');if(s){s.value='Brad Crew';s.dispatchEvent(new Event('change'));}})()`); await sleep(300);
  for (let w = 0; w < 4; w++) { const ok = await js(`(function(){var b=[...document.querySelectorAll('.jstrip button')].find(x=>!x.disabled&&/4 of 4 open/.test(x.textContent));if(b){b.click();return true;}return false;})()`); if (ok) break; await js(`document.querySelector('.jwnav button:last-child').click()`); await sleep(1200); }
  await sleep(300);
  t(await until(`[...document.querySelectorAll('.jslots button')].some(b=>!b.disabled)`), 'a free day and time picked for Brad');
  await js(`[...document.querySelectorAll('.jslots button')].find(b=>!b.disabled).click()`); await sleep(200);
  await js(`[...document.querySelectorAll('button.save')].find(b=>/Send the form/.test(b.textContent)).click()`);
  t(await until(`/The form is ready/i.test(document.body.innerText)`), 'sent from the screen: "The form is ready"' + ' ' + (await js(`(document.querySelector('.err')||{}).textContent||''`)));
  const body = await js(`document.body.innerText`), smsHref = await js(`(document.querySelector('a.sendtxt')||{}).href||''`);
  t(/no deposit; they can pay it all now on the form, or when the work is done/.test(body) && /Booked on the Jobs board now/.test(body), 'summary: no deposit, they can pay it all now on the form; booked now');
  t(/there%20is%20a%20button%20to%20pay%20by%20card%20on%20the%20page/.test(smsHref), 'the text to them mentions the pay button');
  await shot('office-form-ready.png');
  t(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
} catch (e) { t(false, 'test crashed: ' + (e.stack || e)); }
finally {
  for (const p of procs) try { p.kill(); } catch {}
  if (chrome) try { chrome.kill(); } catch {}
  await sleep(500); if (prof) for (let i = 0; i < 50; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(100); } }
  console.log(`\n${pass} passed, ${fail} failed  (screens and data in ${TMP})`);
  process.exit(fail ? 1 : 0);
}

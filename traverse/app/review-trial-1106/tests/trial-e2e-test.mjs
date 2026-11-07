/* The free trial end to end (Matthew 2026-11-06) through the BUILT Roofing edition (traverse/editions/dist, TRAVERSE_CODE_ONLY build) on PHP's
   test server, mock Stripe (TRAVERSE_BILLING_MOCK, the editions' name for SIXFOLD_BILLING_MOCK), mock mail. A fresh temp folder every run: the edition's page and API copied in, its
   company.json with billing on and not exempt, an empty town list, throwaway sign-in codes made here. Nothing touches the live server or Stripe.
   Run (after the editions build):  node traverse/app/review-trial-1106/tests/trial-e2e-test.mjs */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DIST = join(REPO, 'traverse', 'editions', 'dist'), FOLDER = 'tr-cb2e8587', PORT = 8861, ORIGIN = 'http://127.0.0.1:' + PORT, BASE = ORIGIN + '/api/traverse-rounds.php';
const T = mkdtempSync(join(tmpdir(), 'trial-e2e-')), WWW = join(T, 'www'), DATA = join(T, 'traverse-data', 'rounds'), PRIV = join(T, 'traverse-private');
const MOCK = join(T, 'stripe-mock.json'), BFILE = join(DATA, 'billing.json');
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
const now = () => Math.floor(Date.now() / 1000), DAY = 86400, sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the install */
mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
cpSync(join(DIST, 'public_html', FOLDER), join(WWW, FOLDER), { recursive: true });
for (const f of readdirSync(join(DIST, 'public_html', 'api'))) if (/^traverse-(rounds|billing|sms|webpush|skiptrace)\.php$/.test(f)) cpSync(join(DIST, 'public_html', 'api', f), join(WWW, 'api', f));
/* the Roofing company.json the full build writes (this build was code only): this tree's dist, else the main checkout's (read only) */
const coFile = [join(DIST, 'traverse-data', 'rounds', 'company.json'), join(REPO, '..', '..', '..', 'traverse', 'editions', 'dist', 'traverse-data', 'rounds', 'company.json')].find((f) => existsSync(f));
if (!coFile) throw new Error('no Roofing company.json: run the full editions build once');
const company = JSON.parse(readFileSync(coFile, 'utf8'));
company.name = 'Test Roofing Co'; company.short = 'Test Roofing'; company.features = Object.assign({}, company.features || {}, { billing: true, crew: true, company: true, hail: true, roof: true }); delete company.features.billexempt;
writeFileSync(join(DATA, 'company.json'), JSON.stringify(company, null, 2));
writeFileSync(join(DATA, 'index.json'), '{"regions":[]}');
const CODES = { admin: '583920', super: '741852' };
writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => ['" + CODES.admin + "' => ['Pat Tester', 'admin'], '" + CODES.super + "' => ['Matthew Sharpe', 'super']]];\n");
writeFileSync(MOCK, '{}');
const reqs = () => existsSync(MOCK + '.requests.log') ? readFileSync(MOCK + '.requests.log', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const find = (m, p) => reqs().filter((r) => r.method === m && r.path === p);
const bj = () => JSON.parse(readFileSync(BFILE, 'utf8'));
/* the daily setup sweep (sixfold-tools/setup-trial-sweep.php) on this install, as the 4 am run starts it */
const SWEEP = join(REPO, 'traverse', 'app', 'tools', 'setup-trial-sweep.php'), MAIL = join(T, 'mail.log');
const sweep = () => { const o = execFileSync('php', [SWEEP, join(WWW, 'api', 'traverse-rounds.php')], { encoding: 'utf8', env: { ...process.env, TRAVERSE_BILLING_MOCK: MOCK, SIXFOLD_BILLING_MOCK: MOCK, TRAV_MAIL_MOCK: MAIL } }); try { return JSON.parse(o); } catch { return { raw: o.slice(0, 300) }; } };
const near = (a, b) => Math.abs(Number(a) - b) <= 10;

const srv = spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + PORT, '-t', WWW], { env: { ...process.env, TRAVERSE_BILLING_MOCK: MOCK, SIXFOLD_BILLING_MOCK: MOCK, TRAV_MAIL_MOCK: join(T, 'mail.log') }, stdio: 'ignore' });
const jars = {};
async function call(who, action, body, headers = {}) {
  const r = await fetch(BASE + '?action=' + action, { method: body ? 'POST' : 'GET', headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jars[who] ? { Cookie: jars[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) jars[who] = sc.split(';')[0];
  const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt.slice(0, 300) }; } j._status = r.status; return j;
}
let evn = 0;
async function hook(type, object) {
  const ev = JSON.stringify({ id: 'evt_e2e_' + (++evn) + '_' + Date.now(), type, created: now(), data: { object } }), ts = now();
  const r = await fetch(BASE + '?action=billinghook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${createHmac('sha256', 'whsec_mock').update(ts + '.' + ev).digest('hex')}` }, body: ev });
  return r.status;
}
try {
  for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/'); break; } catch { await sleep(100); } }
  console.log('Sign in');
  for (const who of ['admin', 'super']) {
    const s = await call(who, 'signin', { code: CODES[who], dev: who === 'admin' ? 'c' : 'p' });
    if (s.terms && s.terms.due) await call(who, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' });
    t(s.ok, who + ' signs in' + (s.ok ? '' : ': ' + (s.error || s.raw)));
    if (who === 'admin') t(s.terms && s.terms.agreement === '2026-11-06', 'the admin is asked to accept Subscription Agreement version 2026-11-06');
  }
  console.log('Before a plan');
  let b = await call('admin', 'billing');
  t(b.ok && !b.status && b.trialOffer === true && b.freeDays === 7 && b.setupDays === 2 && !('guaranteeDays' in b), 'Billing: no plan; the trial is on offer, 7 free days, setup 2 business days, no guaranteeDays');
  let me = await call('admin', 'me');
  t(me.lock && me.lock.kind === 'setup' && me.lock.phase === 'unpaid', 'setup mode, nothing picked yet' + (me.lock ? '' : ' ' + JSON.stringify(me).slice(0, 300)));
  console.log('Checkout');
  const co1 = await call('admin', 'billingcheckout', { plan: 'crew', interval: 'month', seats: 5, addon: false, back: ORIGIN + '/' + FOLDER + '/' });
  const cs = find('POST', '/v1/checkout/sessions').pop();
  t(co1.ok && /checkout\.stripe\.test/.test(co1.url || ''), 'the admin gets a Stripe Checkout address');
  t(cs && cs.fields.subscription_data.trial_period_days === 7 && cs.fields.payment_method_collection === 'always' && cs.fields.mode === 'subscription', 'Stripe got subscription_data.trial_period_days 7 and payment_method_collection always');
  t(cs && /Free for 7 days from the day your app is live/.test(cs.fields.custom_text.submit.message) && /It never comes earlier/.test(cs.fields.custom_text.submit.message) && !/14/.test(cs.fields.custom_text.submit.message), "Stripe's page carries the trial note (the charge only moves later; no 14 days)");
  t(cs && cs.fields.discounts && cs.fields.discounts[0] && find('POST', '/v1/coupons').length === 1, 'the founding coupon rides on the same checkout');
  console.log('Stripe says: trialing');
  const ceil = now() - 3600 + 7 * DAY;   /* Stripe's 7 days from checkout, an hour ago */
  const sub = { id: 'sub_e2e', object: 'subscription', customer: 'cus_e2e', status: 'trialing', trial_end: ceil, start_date: now() - 3600, cancel_at_period_end: false, metadata: { install: 'traverse-data' }, items: { data: [{ price: { id: 'price_mock_crew_month' }, quantity: 1, current_period_end: ceil }] } };
  t(await hook('checkout.session.completed', { client_reference_id: 'traverse-data', customer: 'cus_e2e', subscription: 'sub_e2e', payment_status: 'no_payment_required', metadata: { install: 'traverse-data' } }) === 200, 'checkout.session.completed taken (payment_status no_payment_required)');
  t(await hook('customer.subscription.created', sub) === 200, 'customer.subscription.created (trialing) taken');
  let B = bj();
  t(B.status === 'trialing' && B.paid_at > 0 && B.had_trial === true && B.trial_end === ceil, 'billing.json: trialing, paid_at set (setup starts), had_trial');
  me = await call('admin', 'me');
  t(me.lock && me.lock.kind === 'setup' && me.lock.phase === 'setup' && me.lock.paid === true, 'the admin: setup mode, plan started (the app is still being set up)');
  b = await call('admin', 'billing');
  t(b.status === 'trialing' && b.paidAt > 0 && !b.liveAt && b.trialUntil === null && b.nextCharge === null && b.trialErr === null, 'Billing in setup: no trial date and no next charge yet; no Traverse note for the admin');
  t(b.trialOffer === false, 'no second trial on offer');
  const den = await call('admin', 'billinglive', {});
  t(den._status === 403, "the client's admin cannot release the app (" + den._status + ')');
  console.log('The daily sweep while it is still being set up');
  writeFileSync(BFILE, JSON.stringify({ ...bj(), paid_at: now() - 5 * DAY, trial_end: now() + DAY }));
  writeFileSync(MOCK, JSON.stringify({ get: { '/v1/subscriptions/sub_e2e': { ...sub, trial_end: now() + DAY } } }));
  let sw = sweep(), pu = find('POST', '/v1/subscriptions/sub_e2e');
  t(sw.ok && sw.did === 'push' && pu.length === 1 && near(pu[0].fields.trial_end, now() + 3 * DAY) && pu[0].fields.proration_behavior === 'none', 'not live, 1 day left: the sweep pushed the trial to 3 days ahead' + (sw.ok ? '' : ' ' + JSON.stringify(sw)));
  B = bj(); t(near(B.trial_end, now() + 3 * DAY) && !B.live_at && B.status === 'trialing', 'billing.json: the pushed date, still not live');
  t(/"setup push"/.test(readFileSync(join(DATA, 'billing.log'), 'utf8')), 'the push is in billing.log');
  console.log('Release to client');
  writeFileSync(MOCK, JSON.stringify({ get: { '/v1/subscriptions/sub_e2e': { ...sub, trial_end: B.trial_end } } }));
  const rel = await call('super', 'billinglive', {});
  B = bj(); const want = B.live_at + 7 * DAY, up = find('POST', '/v1/subscriptions/sub_e2e');
  t(rel.ok && rel.liveAt === B.live_at && rel.trialUntil === want && !rel.trialErr, 'Traverse releases it: live now, free trial until live + 7 days');
  t(up.length === 2 && Number(up[1].fields.trial_end) === want && up[1].fields.proration_behavior === 'none' && want > Number(up[0].fields.trial_end), 'Release: one more POST /v1/subscriptions/sub_e2e, trial_end = live + 7 days (later than the pushed date), proration_behavior none');
  me = await call('admin', 'me');
  t(me.ok && !me.lock, 'the whole app opens for the client');
  b = await call('admin', 'billing');
  t(b.trialUntil === want && b.nextCharge === want && b.refundable === true, 'Billing: free trial until ' + new Date(want * 1000).toDateString() + ', the next charge that day');
  let n0 = reqs().length; sw = sweep();
  t(sw.ok && sw.did === '' && reqs().length === n0, 'the sweep leaves a live company alone (no Stripe call)');
  console.log('Release when Stripe says no');
  writeFileSync(BFILE, JSON.stringify({ ...B, live_at: null, live_by: null, trial_end: ceil, trial_err: null }));
  writeFileSync(MOCK, JSON.stringify({ fail: 'Stripe is down (test)' }));
  const rel2 = await call('super', 'billinglive', {});
  t(rel2.ok && rel2.liveAt > 0 && /set the trial on sub_e2e to end/.test(rel2.trialErr || ''), 'still released; the super admin sees what to set by hand in Stripe');
  b = await call('admin', 'billing');
  t(b.trialErr === null, "the client's admin is not shown Traverse's note");
  writeFileSync(MOCK, '{}');
  console.log('14 days after sign-up, still not live');
  writeFileSync(BFILE, JSON.stringify({ ...bj(), live_at: null, live_by: null, status: 'trialing', paid_at: now() - 14 * DAY - 120, trial_end: now() + 2 * DAY, trial_err: null }));
  writeFileSync(MOCK, JSON.stringify({ get: { '/v1/subscriptions/sub_e2e': { ...sub, trial_end: now() + 2 * DAY } } }));
  const d0 = find('DELETE', '/v1/subscriptions/sub_e2e').length; sw = sweep(); B = bj();
  t(sw.ok && sw.did === 'cancel' && find('DELETE', '/v1/subscriptions/sub_e2e').length === d0 + 1 && find('POST', '/v1/refunds').length === 0, 'the sweep cancels it in Stripe (DELETE), no refund: nothing was charged');
  t(B.status === 'canceled' && B.setup_canceled && /"setup cancel"/.test(readFileSync(join(DATA, 'billing.log'), 'utf8')), 'billing.json: canceled with why; in billing.log');
  const ml = existsSync(MAIL) ? readFileSync(MAIL, 'utf8') : '';
  t(/"to":"m\.sharpe@traverseplatforms\.com"/.test(ml) && ml.includes('sign-up cancelled, no app after 14 days: ' + company.name) && ml.includes('nothing was charged'), 'Matthew is emailed: the company and why' + (sw.mailed ? '' : ' (mailed false)'));
  n0 = reqs().length; sw = sweep();
  t(sw.ok && sw.did === '' && reqs().length === n0, 'a cancelled (not trialing) subscription: the sweep does nothing');
  console.log("Traverse's cancel during the trial");
  writeFileSync(BFILE, JSON.stringify({ ...bj(), status: 'trialing', live_at: now() - 3600, ended: undefined, setup_canceled: undefined, trial_err: null, trial_end: want }));
  const del0 = find('DELETE', '/v1/subscriptions/sub_e2e').length;
  const rf = await call('super', 'billingrefund', { confirm: true });
  t(rf.ok && rf.trial === true && rf.amount === 0 && rf.refundedInTrial === true && rf.status === 'canceled', 'Cancel in the trial: ended, nothing charged');
  t(find('DELETE', '/v1/subscriptions/sub_e2e').length === del0 + 1 && find('POST', '/v1/refunds').length === 0 && find('GET', '/v1/charges').length === 0, 'Stripe: one DELETE, no refund, no charge lookup');
  console.log('Coming back');
  const co2 = await call('admin', 'billingcheckout', { plan: 'crew', interval: 'month', seats: 5, addon: false, back: ORIGIN + '/' + FOLDER + '/' });
  const cs2 = find('POST', '/v1/checkout/sessions').pop();
  t(co2.ok && cs2 && !cs2.fields.subscription_data.trial_period_days && !cs2.fields.payment_method_collection, 'a second checkout for the same company: no trial (charged at checkout)');
  console.log('The built page');
  const page = readFileSync(join(WWW, FOLDER, 'index.html'), 'utf8'), es = readFileSync(join(WWW, FOLDER, 'es.json'), 'utf8');
  t(!/money-back|money back|guarantee until/i.test(page), 'the Roofing page has no money-back wording');
  t([' free days start when it’s live', ' · free trial until ', 'Your card is charged on ', ' unless you cancel. Cancel before then and you pay nothing.', 'Nothing is charged today. We set your app up in up to ', 'Release to client'].every((s) => page.includes(s)), 'it has the trial lines (setup, live, the picker, Release)');
  t(!/money-back|garantía de devolución/i.test(es) && es.includes('prueba gratis hasta'), 'its Spanish: the trial words, no money-back');
} catch (e) { console.log('  FAIL  ' + (e && e.stack || e)); fail++; }
finally { srv.kill(); await sleep(300); try { rmSync(T, { recursive: true, force: true }); } catch {} }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

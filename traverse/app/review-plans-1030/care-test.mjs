/* Plans and customer emails for the editions (2026-10-30, api/care-lib.php): the plan builder, putting customers on plans (customer and
   quote), next visits and Plan visits to book, payment links refused without Square/Stripe, the follow-up / aftercare / newsletter sweeps
   (command line, mail written to a mock file), opt-in and unsubscribe, approval rules (address, mailbox, template marks), permissions,
   Claude Check, Sixfold refused. Then screenshots, desktop and phone. Throwaway harness data only. Run through run-ed.sh (edition, terms
   pre-accepted, fresh logs). */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { DIR, ORIGIN, SHOTS, sleep, R, t, call, signin, mode, browser, jars } from './lib1030.mjs';
const DATA = DIR + '/sixfold-data/rounds', PRIV = DIR + '/sixfold-private', MOCK = DIR + '/care-mock.log', SLOG = DIR + '/smtp-mock-care.log', MP = 16803;
const U = Date.now().toString(36).slice(-5).replace(/[0-9]/g, (d) => 'abcdefghij'[d]);   /* letters only: account names refuse digits */
for (const f of ['care-plans.json', 'care-cfg.json', 'care-news.json', 'care-optin.json', 'care-qplans.json', 'newsletter-unsub.json']) rmSync(DATA + '/' + f, { force: true });
rmSync(MOCK, { force: true }); rmSync(SLOG, { force: true });
const iso = (d) => d.toISOString().slice(0, 10);
const tz = 'America/Denver';
const localDay = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts * 1000));
const localHour = (ts) => +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ts * 1000));
const daytime = (ts) => { while (localHour(ts) < 9 || localHour(ts) > 16) ts += 3600; return ts; };
const today = localDay(Math.floor(Date.now() / 1000));
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
const addMonths = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const t0 = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + 1, 0)).getUTCDate(); t0.setUTCDate(Math.min(dd, last)); return iso(t0); };
const mails = () => existsSync(MOCK) ? readFileSync(MOCK, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const sweep = (now) => { const o = execFileSync('php', ['-d', 'memory_limit=1024M', DIR + '/sixfold-tools/care-sweep.php', DIR + '/www/api/rounds.php', String(now)], { encoding: 'utf8', env: { ...process.env, CARE_MAIL_MOCK: MOCK, CARE_FAST: '1' } }); try { return JSON.parse(o.slice(o.indexOf('{'))); } catch { return { raw: o.slice(0, 300) }; } };
let smtp = null;

try {
  /* ---- Sixfold: none of it ---- */
  mode('sixfold');
  await signin('six', '222222');
  t((await call('six', 'careplans'))._status === 404, 'Sixfold: careplans answers 404 (not part of this app)');
  t((await call('six', 'carecfg'))._status === 404, 'Sixfold: carecfg answers 404');
  t((await call('six', 'careenrol', null, { cid: 'x', plan: 'y' }))._status === 404, 'Sixfold: careenrol answers 404');
  t(sweep(Math.floor(Date.now() / 1000)).skipped === 'not here', 'Sixfold: the hourly sweep does nothing (not here)');
  mode('edition');

  /* ---- the plan builder ---- */
  const si = await signin('admin', '222222'); t(si.ok, 'edition admin signs in');
  let P = await call('admin', 'careplans');
  t(P.ok && P.saved === false && P.plans.length === 1 && P.plans[0].starter && P.plans[0].id === 'cs-roof', 'starters: one for the trade (roofing), marked starter: ' + (P.plans || []).map((p) => p.name).join(', '));
  t(P.plans[0].often === 'Once a year' && /\$249 a visit/.test(P.plans[0].priceText), 'starter reads "Once a year", $249 a visit');
  t(!existsSync(DATA + '/care-plans.json'), 'nothing written until the admin saves');
  const c0 = await call('admin', 'customersave', null, { name: 'Casey Plan ' + U, email: 'casey' + U + '@example.com', phone: '3035550101', address: '10 Plan St', town: 'Denver' });
  t(c0.ok, 'a customer to work with');
  const st0 = await call('admin', 'careenrol', null, { cid: c0.id, plan: 'cs-roof' });
  t(!st0.ok && /starter/i.test(st0.error || ''), 'a starter plan cannot be given to a customer: ' + st0.error);
  const bad = async (plan, re, label) => { const r = await call('admin', 'careplanset', null, { plan }); t(!r.ok && re.test(r.error || ''), 'refused: ' + label + ' (' + r.error + ')'); };
  await bad({ name: 'X', freq: { k: 'month' }, price: 10, per: 'visit' }, /Name/, 'one-letter name');
  await bad({ name: 'Weekly', freq: { k: 'weeks', n: 1 }, price: 10, per: 'visit' }, /2 to 52/, 'every 1 week as "every few weeks"');
  await bad({ name: 'Dates', freq: { k: 'dates', dates: ['13-01'] }, price: 10, per: 'visit' }, /not right/, 'a month 13');
  await bad({ name: 'Season', freq: { k: 'month' }, season: { from: '04-01', to: '04-01' }, price: 10, per: 'visit' }, /season/i, 'a season of one day');
  await bad({ name: 'Free', freq: { k: 'month' }, price: 0, per: 'visit' }, /price/i, 'no price');
  await bad({ name: 'Per what', freq: { k: 'month' }, price: 10, per: 'fortnight' }, /visit, a month/, 'a made-up price period');
  const q1 = await call('admin', 'careplanset', null, { plan: { name: 'Quarterly gutter care', services: 'Clear gutters\nCheck downspouts\n', freq: { k: 'quarter' }, price: 150, per: 'visit', notes: 'Our most asked-for plan.' } });
  t(q1.ok && /^cp[0-9a-f]{10}$/.test(q1.id), 'plan saved: Quarterly gutter care');
  const pq = q1.plans.find((p) => p.id === q1.id);
  t(pq && pq.services.length === 2 && pq.often === 'Every 3 months' && pq.priceText === '$150 a visit' && !pq.starter, 'its services, how often and price read back');
  t(q1.plans.some((p) => p.id === 'cs-roof'), 'the starter stays in the list beside it (saved with the first save)');
  const q2 = await call('admin', 'careplanset', null, { plan: { name: 'Lawn every 2 weeks', services: ['Mow and edge'], freq: { k: 'weeks', n: 2 }, season: { from: '04-01', to: '10-31' }, visits: 10, price: 45, per: 'visit' } });
  t(q2.ok && q2.plans.find((p) => p.id === q2.id).often === 'Every 2 weeks, Apr 1 to Oct 31, up to 10 visits a year', 'season plan reads "Every 2 weeks, Apr 1 to Oct 31, up to 10 visits a year"');
  const q3 = await call('admin', 'careplanset', null, { plan: { name: 'Three set dates', services: ['Inspect'], freq: { k: 'dates', dates: ['10-15', '04-15', '07-15'] }, price: 300, per: 'year' } });
  t(q3.ok && q3.plans.find((p) => p.id === q3.id).often === 'Each year on Apr 15, Jul 15, Oct 15' && q3.plans.find((p) => p.id === q3.id).priceText === '$300 a year', 'set dates sorted, $300 a year');
  const q4 = await call('admin', 'careplanset', null, { id: 'cs-roof', plan: { name: 'Yearly roof maintenance', services: ['Inspect', 'Clear valleys'], freq: { k: 'year' }, price: 275, per: 'visit' } });
  t(q4.ok && q4.plans.find((p) => p.id === 'cs-roof').starter === false, 'the starter, edited and saved, is the company\'s own (no longer Edit me)');
  const q5 = await call('admin', 'careplanset', null, { plan: { name: 'Hidden plan', freq: { k: 'month' }, price: 20, per: 'month', off: true } });
  P = await call('admin', 'careplans'); t(P.saved === true && P.plans.length === 5, 'five plans saved');

  /* ---- a customer on a plan, next visits ---- */
  const e1 = await call('admin', 'careenrol', null, { cid: c0.id, plan: q1.id, start: today });
  t(e1.ok && e1.next === today, 'Casey on Quarterly gutter care from today: first visit today');
  let cc = await call('admin', 'carecust', { id: c0.id });
  t(cc.ok && cc.sub && cc.sub.name === 'Quarterly gutter care' && cc.sub.priceText === '$150 a visit', 'their customer page shows the plan');
  t(JSON.stringify(cc.list.slice(0, 3)) === JSON.stringify([today, addMonths(today, 3), addMonths(today, 6)]), 'next visits every 3 months: ' + cc.list.slice(0, 3).join(', '));
  const custRow = ((await call('admin', 'customers')).customers || []).find((c) => c.id === c0.id) || {};
  t((custRow.planName === 'Quarterly gutter care' && custRow.next === today && custRow.plan === 'custom'), 'the customer list shows the plan name and next visit (plan box fields kept in step)');
  const off1 = await call('admin', 'careenrol', null, { cid: c0.id, plan: q5.id }); t(!off1.ok && /switched off/.test(off1.error || ''), 'a plan switched off cannot be given');
  const v1 = await call('admin', 'visitsave', null, { cid: c0.id, date: today, status: 'done' });
  t(v1.ok, 'a visit logged as done today');
  cc = await call('admin', 'carecust', { id: c0.id });
  t(cc.next === addMonths(today, 3) && cc.last === today, 'the next visit moves on 3 months: ' + cc.next);
  /* the season plan started in November: the first visit waits for April */
  const c1 = await call('admin', 'customersave', null, { name: 'Lee Lawn ' + U, email: 'lee' + U + '@example.com', phone: '3035550102' });
  const e2 = await call('admin', 'careenrol', null, { cid: c1.id, plan: q2.id, start: '2026-11-02' });
  cc = await call('admin', 'carecust', { id: c1.id });
  const gaps = cc.list.slice(1).map((d, i) => (Date.parse(d) - Date.parse(cc.list[i])) / 86400000);
  t(e2.ok && cc.next >= '2027-04-01' && cc.next <= '2027-04-14' && gaps.every((g) => g === 14), 'in-season only: first visit ' + cc.next + ', then every 14 days');
  const c2 = await call('admin', 'customersave', null, { name: 'Dee Dates ' + U, phone: '3035550103' });
  await call('admin', 'careenrol', null, { cid: c2.id, plan: q3.id, start: '2026-10-30', price: 280 });
  cc = await call('admin', 'carecust', { id: c2.id });
  t(cc.list[0] === '2027-04-15' && cc.list[1] === '2027-07-15' && cc.list[2] === '2027-10-15' && cc.list[3] === '2028-04-15', 'set dates: ' + cc.list.slice(0, 4).join(', '));
  t(cc.sub.price === 280 && cc.sub.priceText === '$280 a year', 'their own price kept on their copy of the plan ($280 a year)');
  await call('admin', 'careplanset', null, { id: q3.id, plan: { name: 'Three set dates', services: ['Inspect'], freq: { k: 'dates', dates: ['04-15', '07-15', '10-15'] }, price: 350, per: 'year' } });
  t((await call('admin', 'carecust', { id: c2.id })).sub.price === 280, 'changing the plan later does not change a customer\'s price');

  /* ---- Plan visits to book, and booking one ---- */
  const c3 = await call('admin', 'customersave', null, { name: 'Bo Book ' + U, email: 'bo' + U + '@example.com', phone: '3035550104', address: '12 Plan St', town: 'Denver' });
  await call('admin', 'careenrol', null, { cid: c3.id, plan: q1.id, start: today });
  let due = await call('admin', 'caredue');
  t(due.ok && due.due.some((d) => d.cid === c3.id && d.next === today) && !due.due.some((d) => d.cid === c0.id), 'Plan visits to book: Bo (due today), not Casey (next in 3 months)');
  const cj = await call('admin', 'custjob', null, { id: c3.id }); t(cj.ok && cj.lead && cj.lead.id, 'Book: a lead for the customer, as + Book a job does');
  const wk = await call('admin', 'accountadd', null, { name: 'Wes Walker ' + U, role: 'crew' }); await call('admin', 'walkerset', null, { id: wk.id, on: 1 });
  const sv = await call('admin', 'schedview', { from: today, to: addDays(today, 7) });
  let jd = addDays(today, 1); if (new Date(jd + 'T12:00:00Z').getUTCDay() === 0) jd = addDays(jd, 1);
  const crew = (sv.pick || [])[0];
  const js1 = await call('admin', 'jobsave', null, { lead: cj.lead.id, crew, date: jd, slot: sv.slots[1].k, price: 150, pkg: 'other', svc: 'Quarterly gutter care visit', pay: { s: 'unpaid' }, note: '', addr: '12 Plan St, Denver' });
  t(js1.ok, 'the visit booked on the Jobs board (' + (js1.error || jd) + ')');
  due = await call('admin', 'caredue'); t(!due.due.some((d) => d.cid === c3.id), 'booked: Bo leaves Plan visits to book');
  cc = await call('admin', 'carecust', { id: c3.id }); t(cc.booked === jd, 'their plan says the next visit is booked: ' + cc.booked);
  const jdn = await call('admin', 'jobdone', null, { id: js1.id, outcome: 'done', mins: 60 });
  t(jdn.ok, 'the job marked done');
  cc = await call('admin', 'carecust', { id: c3.id }); t(cc.last === jd && cc.next === addMonths(today, 3), 'a job marked Done counts as the visit: next ' + cc.next);
  /* payment links: never charged; needs Square or Stripe */
  const pl = await call('admin', 'carepaylink', null, { cid: c3.id });
  t(pl.ok ? /^https?:\/\//.test(pl.url) : /Square|Stripe/.test(pl.error || ''), 'payment link: made (' + (pl.url ? 'url' : '') + ') or refused for want of Square/Stripe: ' + (pl.error || pl.label));

  /* ---- roles ---- */
  const off = await call('admin', 'accountadd', null, { name: 'Olive Office ' + U, role: 'office' });
  const rep = await call('admin', 'accountadd', null, { name: 'Rhea Rep ' + U, role: 'crew' });
  const setr = await call('admin', 'accountadd', null, { name: 'Sid Setter ' + U, role: 'setter' });
  await signin('office', off.code); await signin('rep', rep.code); await signin('setter', setr.code);
  for (const w of ['office', 'rep', 'setter']) { const r = await call(w, 'termsaccept', null, { terms: 1, agreement: 1 }); }
  const oP = await call('office', 'careplans');
  t(oP.ok && !oP.plans.some((p) => p.starter || p.off), 'office: reads the plans (no starters, nothing switched off)');
  t((await call('office', 'careplanset', null, { plan: { name: 'Office plan', freq: { k: 'month' }, price: 9, per: 'visit' } }))._status === 403, 'office: cannot build plans (403)');
  t((await call('office', 'carecfg'))._status === 403, 'office: cannot open Customer emails (403)');
  t((await call('office', 'caredue')).ok, 'office: sees Plan visits to book');
  const oe = await call('office', 'careenrol', null, { cid: c2.id, plan: q1.id }); t(oe.ok, 'office: puts a customer on a plan');
  t((await call('rep', 'careplans')).ok, 'sales rep: reads the plans (to offer one with a quote)');
  t((await call('rep', 'careenrol', null, { cid: c2.id, plan: q1.id }))._status === 403, 'sales rep: cannot put a customer on a plan (403)');
  t((await call('rep', 'carecfg'))._status === 403, 'sales rep: no Customer emails (403)');
  t((await call('setter', 'careplans'))._status === 403, 'setter: no plans (403)');
  /* Roles and permissions: office's "Put customers on plans" off, then the sales rep given Customer emails */
  const ps = await call('admin', 'permset', null, { role: 'office', perms: { 'cust.plans': false } }); t(ps.ok, 'Accounts: office loses Put customers on plans');
  const oe2 = await call('office', 'careenrol', null, { cid: c2.id, plan: q1.id }); t(oe2._status === 403 && oe2.why === 'perm', 'office with it off: refused (why perm)');
  await call('admin', 'permset', null, { role: 'office', reset: 1 });
  t((await call('office', 'careenrol', null, { cid: c2.id, plan: q1.id })).ok, 'reset: office can again');
  await call('admin', 'permset', null, { role: 'crew', perms: { 'set.care': true } });
  t((await call('rep', 'carecfg')).ok, 'sales rep given Customer emails: opens it');
  await call('admin', 'permset', null, { role: 'crew', reset: 1 });
  const pr = await call('admin', 'perms');
  t(['set.plans', 'set.care', 'cust.plans'].every((k) => (pr.list || []).some((p) => p.k === k)), 'the three new permissions are in Roles and permissions');

  /* ---- Claude Check reads, never saves ---- */
  const cck = await signin('cc', '444444');
  if (cck.ok) {
    t((await call('cc', 'careplans')).ok && (await call('cc', 'carecfg')).ok && (await call('cc', 'carenews')).ok && (await call('cc', 'caredue')).ok, 'Claude Check: reads plans, emails, newsletter, visits to book');
    t((await call('cc', 'careplanset', null, { plan: { name: 'CC plan', freq: { k: 'month' }, price: 5, per: 'visit' } }))._status === 403, 'Claude Check: saving a plan refused');
  } else t(true, 'Claude Check sign-in not in this harness (skipped)');

  /* ---- the quote can offer a plan ---- */
  const L1 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Quinn Quote ' + U, phone: '3035550105', email: 'quinn' + U + '@example.com' });
  const K1 = await call('admin', 'kitquote', null, { id: L1.id, price: 900, measures: {}, picks: {} });
  t(K1.ok && K1.link, 'a quote saved (' + (K1.error || '$' + K1.price) + ')');
  const key = (K1.link || '').split('q=')[1] || '';
  t((await call('anon', 'careqplan', { q: key })).plan === null, 'their quote page: no plan offered yet');
  t(!(await call('admin', 'careqset', null, { lead: L1.id, plan: 'cs-nope' })).ok, 'offering a plan that is not saved: refused');
  const qs = await call('admin', 'careqset', null, { lead: L1.id, plan: q1.id }); t(qs.ok && qs.offer.plan.name === 'Quarterly gutter care', 'the quote offers Quarterly gutter care');
  const qq = await call('anon', 'careqplan', { q: key });
  t(qq.ok && qq.plan && qq.plan.priceText === '$150 a visit' && qq.plan.services.length === 2 && !qq.picked, 'their quote page shows the plan, its visits and price');
  t((await call('anon', 'careqplan', { q: L1.id + '-0000000000000000' }))._status === 404, 'a wrong quote key: 404');
  const pk = await call('anon', 'careqpick', null, { q: key }); t(pk.ok && pk.picked, '"I\'d like the plan" saved');
  t(((await call('admin', 'leads')).leads || []).find((l) => l.id === L1.id)?.notes?.some((n) => /Picked the plan/.test(n.note)), 'the lead notes they picked the plan');
  const ql = await call('admin', 'careplans', { lead: L1.id }); t(ql.offer && ql.offer.picked, 'the quote builder sees they picked it');
  const ef = await call('admin', 'careenrol', null, { lead: L1.id, plan: q1.id }); t(ef.ok && ef.cid, 'started from the quote: a customer made from the lead, on the plan');
  cc = await call('admin', 'carecust', { id: ef.cid }); t(cc.sub && cc.sub.src === 'quote' && cc.offer && cc.offer.picked, 'their customer page: the plan, from the quote');

  /* ---- emails: mailbox, newsletter rules ---- */
  smtp = spawn('node', [DIR + '/../ptest-email/smtp-mock.mjs', String(MP), SLOG], { stdio: 'ignore' }); await sleep(600);
  let cf = await call('admin', 'carecfg'); t(cf.ok && !cf.cfg.fu.on && !cf.cfg.ac.on && cf.mail.on === false, 'Customer emails: every one off, no mailbox yet');
  t((await call('admin', 'careoptin', null, { cid: c2.id, on: true })).error === 'Add their email first.', 'newsletter yes refused without an email');
  t((await call('admin', 'careoptin', null, { cid: c0.id, on: true })).ok, 'Casey said yes to the newsletter');
  const c4 = await call('admin', 'customersave', null, { name: 'Una Unsub ' + U, email: 'una' + U + '@example.com', phone: '3035550106' });
  t((await call('admin', 'careoptin', null, { cid: c4.id, on: true })).ok, 'Una said yes too');
  let N = await call('admin', 'carenews'); t(N.ok && N.recipients === 2 && N.templates.length === 3, 'newsletter: 2 said yes, 3 templates');
  const tpl = N.templates[0];
  const pastSend = (() => { const d = new Date(Date.now() - 3600 * 1000); return localDay(Math.floor(d / 1000)) + ' ' + String(localHour(Math.floor(d / 1000))).padStart(2, '0') + ':00'; })();
  const is1 = await call('admin', 'carenewsset', null, { subject: tpl.subject, pre: tpl.pre, body: tpl.body, send: pastSend });
  t(is1.ok && is1.issue.state === 'draft' && is1.issue.marks, 'an issue from the template: a draft, template marks still in it');
  let ap = await call('admin', 'carenewsapprove', null, { id: is1.issue.id, on: 1 }); t(!ap.ok && /CAN-SPAM/.test(ap.error || ''), 'approve refused without a postal address (CAN-SPAM)');
  t(!(await call('admin', 'carecfgset', null, { part: 'nl', address: 'Denver' })).ok, 'a too-short address refused');
  t((await call('admin', 'carecfgset', null, { part: 'nl', address: 'PO Box 123, Denver, CO 80202' })).ok, 'the mailing address saved');
  ap = await call('admin', 'carenewsapprove', null, { id: is1.issue.id, on: 1 }); t(!ap.ok && /Connect your email/.test(ap.error || ''), 'approve refused with no mailbox');
  const ms = await call('admin', 'mailset', null, { kind: 'other', host: '127.0.0.1', port: MP, user: 'owner@acme-care-test.com', name: 'Acme', pass: 'goodapppassword1' });
  t(ms.ok, 'Setup, Email connected (the test sink)');
  ap = await call('admin', 'carenewsapprove', null, { id: is1.issue.id, on: 1 }); t(!ap.ok && /\[Write/.test(ap.error || ''), 'approve refused while "[Write ...]" is still in it');
  const body2 = '# Fall news from {company}\n\nHi {first_name},\n\nGutters fill fast in the fall. **Clear them before the first freeze.**\n\n- Book your visit: call {phone}\n- [Our website](https://example.com)';
  let is2 = await call('admin', 'carenewsset', null, { id: is1.issue.id, subject: 'Fall news from {company}', pre: 'Gutters and the first freeze', body: body2, send: pastSend });
  t(is2.ok && !is2.issue.marks, 'the issue in our own words');
  const pv = await call('admin', 'carepreview', null, { part: 'nl', subject: 'Fall news from {company}', pre: 'x', body: body2 });
  t(pv.ok && /PO Box 123/.test(pv.html) && /Unsubscribe/.test(pv.html) && /<b>Clear them/.test(pv.html) && /Hi Alex/.test(pv.html), 'preview: address, unsubscribe link, bold, first name filled');
  const tt = await call('admin', 'carenewstest', null, { id: is1.issue.id }); t(tt.ok && tt.to === 'owner@acme-care-test.com', 'a test to the connected address');
  ap = await call('admin', 'carenewsapprove', null, { id: is1.issue.id, on: 1 }); t(ap.ok && ap.issue.state === 'approved', 'approved');
  is2 = await call('admin', 'carenewsset', null, { id: is1.issue.id, subject: 'Fall news from {company}!', pre: 'Gutters and the first freeze', body: body2, send: pastSend });
  t(is2.ok && is2.issue.state === 'draft' && !is2.issue.approved, 'a change after approving takes the approval back');
  ap = await call('admin', 'carenewsapprove', null, { id: is1.issue.id, on: 1 }); t(ap.ok, 'approved again');
  /* Una unsubscribes (the link in the test email works on an edition too) */
  const unUrl = (() => { const l = readFileSync(SLOG, 'utf8').trim().split('\n').filter(Boolean).map((x) => JSON.parse(x)).pop(); const m = /List-Unsubscribe: <([^>]+)>/.exec(l.data); return m ? m[1] : ''; })();
  t(/action=nlunsub&t=/.test(unUrl), 'the test email carries a List-Unsubscribe link');
  const unPage = await (await fetch(unUrl.replace(/^https?:\/\/[^/]+/, ORIGIN))).text();
  t(/You are unsubscribed/.test(unPage) && /owner@acme-care-test\.com/.test(readFileSync(DATA + '/newsletter-unsub.json', 'utf8')), 'the link works on an edition: that address goes on the unsubscribe list');
  writeFileSync(DATA + '/newsletter-unsub.json', JSON.stringify({ ['una' + U + '@example.com']: { at: Math.floor(Date.now() / 1000), how: 'link' } }));
  t((await call('admin', 'carenews')).recipients === 1, 'Una unsubscribed: 1 left on the newsletter');
  t(/unsubscribed/i.test((await call('admin', 'careoptin', null, { cid: c4.id, on: true })).error || ''), 'an unsubscribed customer cannot be ticked back on');

  /* ---- the sweep: follow-ups ---- */
  const now0 = Math.floor(Date.now() / 1000);
  let sw = sweep(daytime(now0 + 5 * 86400)); t(sw.fu === 0 && sw.ac === 0, 'follow-ups and aftercare off: none sent, whatever the day (' + JSON.stringify(sw) + ')');
  const before = mails().length;
  const nlSent = mails().filter((m) => /Fall news/.test(m.subject));
  t(sw.nl === 1 && nlSent.length === 1 && nlSent[0].to === 'casey' + U + '@example.com', 'the approved newsletter went to Casey only (Una unsubscribed, others never said yes)');
  t(/PO Box 123/.test(nlSent[0].text) && nlSent[0].headers.some((h) => /^List-Unsubscribe-Post/.test(h)), 'with the postal address and one-click unsubscribe headers');
  t((await call('admin', 'carenews')).issues[0].state === 'sent', 'the issue reads Sent');
  t(sweep(daytime(now0 + 5 * 86400)).nl === 0, 'never sent twice');
  await call('admin', 'carecfgset', null, { part: 'fu', on: true, days: 2, gap: 3, max: 2 });
  const L2 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Fran Follow ' + U, phone: '3035550107', email: 'fran' + U + '@example.com' });
  const K2 = await call('admin', 'kitquote', null, { id: L2.id, price: 1200, measures: {}, picks: {} });
  const L3 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Will Won ' + U, phone: '3035550108', email: 'will' + U + '@example.com' });
  await call('admin', 'kitquote', null, { id: L3.id, price: 800, measures: {}, picks: {} });
  await call('admin', 'leadstatus', null, { id: L3.id, status: 'won' });
  const L4 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Una Lead ' + U, phone: '3035550109', email: 'una' + U + '@example.com' });
  await call('admin', 'kitquote', null, { id: L4.id, price: 700, measures: {}, picks: {} });
  const qat = Math.floor(Date.now() / 1000);
  sw = sweep(daytime(qat + 3600)); t(sw.fu === 0, 'an hour after the quote: no follow-up yet');
  const n1 = mails().length; sw = sweep(daytime(qat + 2 * 86400 + 600));
  const f1 = mails().slice(n1);
  t(sw.fu === 1 && f1.length === 1 && f1[0].to === 'fran' + U + '@example.com' && /Your quote from/.test(f1[0].subject), 'two days on: follow-up 1 to Fran only (not the won lead, not the unsubscribed address, not Quinn who picked a plan)');
  t(/\$1,200/.test(f1[0].text) && /q\.html\?q=/.test(f1[0].text) && /Unsubscribe/.test(f1[0].text), 'it carries the price, the quote link and an unsubscribe line');
  t(sweep(daytime(qat + 2 * 86400 + 4000)).fu === 0, 'not again the same day');
  const n2 = mails().length; sw = sweep(daytime(qat + 5 * 86400 + 1200)); t(sw.fu === 1 && /Still thinking/.test(mails().slice(n2)[0]?.subject || ''), 'three days later: follow-up 2, its own words');
  t(sweep(daytime(qat + 9 * 86400)).fu === 0, 'up to 2: no third');
  t(((await call('admin', 'leads')).leads || []).find((l) => l.id === L2.id)?.notes?.filter((n) => /Follow-up \d emailed/.test(n.note)).length === 2, 'each follow-up noted on the lead');
  const L5 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Tess Talked ' + U, phone: '3035550110', email: 'tess' + U + '@example.com' });
  await call('admin', 'kitquote', null, { id: L5.id, price: 500, measures: {}, picks: {} });
  await call('admin', 'leadtry', null, { id: L5.id, o: 'talk' });
  const n3 = mails().length; sweep(daytime(Math.floor(Date.now() / 1000) + 2 * 86400 + 600)); t(!mails().slice(n3).some((m) => m.to === 'tess' + U + '@example.com'), 'a call where they talked stops the follow-ups');
  const night = (() => { let x = Math.floor(Date.now() / 1000) + 3 * 86400; while (localHour(x) !== 2) x += 3600; return x; })();
  const L6 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Nia Night ' + U, phone: '3035550111', email: 'nia' + U + '@example.com' });
  await call('admin', 'kitquote', null, { id: L6.id, price: 400, measures: {}, picks: {} });
  t(sweep(night).fu === 0, 'not at 2 am');

  /* ---- aftercare ---- */
  const acs = await call('admin', 'carecfgset', null, { part: 'ac', on: true, hours: 2, review: { on: true, link: 'https://g.page/r/acme-test/review', line: 'A short review helps: {review_link}' },
    tpls: [{ name: 'Gutters', match: 'gutter, gutters', subject: 'Gutter tips from {company}', body: 'Hi {first_name}, thanks for {service} on {job_date}.' }, { name: 'Every job', match: '', subject: 'Thanks from {company}', body: 'Hi {first_name}, thanks!' }] });
  t(acs.ok, 'aftercare on: words for gutters and a general one, a review line');
  t(!(await call('admin', 'carecfgset', null, { part: 'ac', tpls: [{ name: 'Only gutters', match: 'gutter', subject: 'x', body: 'y' }] })).ok, 'refused: no general aftercare email left');
  t(!(await call('admin', 'carecfgset', null, { part: 'ac', tpls: [{ name: 'G', match: '', subject: 'x {coupon}', body: 'y' }] })).ok, 'refused: a placeholder it cannot fill');
  const L7 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Gus Gutter ' + U, phone: '3035550112', email: 'gus' + U + '@example.com' });
  const js2 = await call('admin', 'jobsave', null, { lead: L7.id, crew, date: jd, slot: sv.slots[2].k, price: 300, pkg: 'other', svc: 'Gutter cleaning', pay: { s: 'unpaid' }, note: '', addr: '1 Gus St, Denver' });
  await call('admin', 'jobdone', null, { id: js2.id, outcome: 'done', mins: 45 });
  const L8 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Pam Paint ' + U, phone: '3035550113', email: 'pam' + U + '@example.com' });
  const js3 = await call('admin', 'jobsave', null, { lead: L8.id, crew, date: jd, slot: sv.slots[3].k, price: 300, pkg: 'other', svc: 'Window wash', pay: { s: 'unpaid' }, note: '', addr: '2 Pam St, Denver' });
  await call('admin', 'jobdone', null, { id: js3.id, outcome: 'done', mins: 45 });
  const dAt = Math.floor(Date.now() / 1000);
  t(sweep(daytime(dAt) === dAt ? dAt + 1800 : daytime(dAt)).ac === (daytime(dAt) === dAt ? 0 : 2), 'not before the hours after Done have passed (or, after hours, the next morning)');
  const n4 = mails().length; sw = sweep(daytime(dAt + 3 * 3600)); const a1 = mails().slice(n4);
  const gm = a1.find((m) => m.to === 'gus' + U + '@example.com'), pm = a1.find((m) => m.to === 'pam' + U + '@example.com');
  t(gm && /Gutter tips/.test(gm.subject) && /Gutter cleaning/.test(gm.text) && /g\.page\/r\/acme-test/.test(gm.text), 'Gus (gutter job): the gutter words, the service filled, the review line');
  t(pm && /^Thanks from/.test(pm.subject), 'Pam (window wash): the general words');
  t(sweep(daytime(dAt + 5 * 3600)).ac === 0, 'aftercare never twice');
  /* mailbox off: nothing goes */
  await call('admin', 'mailoff', null, {});
  const L9 = await call('admin', 'leadadd', null, { src: 'phone', name: 'Mo Mailbox ' + U, phone: '3035550114', email: 'mo' + U + '@example.com' });
  await call('admin', 'kitquote', null, { id: L9.id, price: 450, measures: {}, picks: {} });
  t(sweep(daytime(Math.floor(Date.now() / 1000) + 2 * 86400 + 600)).fu === 0, 'mailbox disconnected: nothing sent');
  const lg = await call('admin', 'carelog'); t(lg.ok && lg.log.some((r) => r.kind === 'fu') && lg.log.some((r) => r.kind === 'ac') && lg.log.some((r) => r.kind === 'nl'), 'Sent lately lists follow-ups, aftercare and the newsletter');
  const bk = await call('admin', 'backup'); const bks = JSON.stringify(bk);
  t(/care-plans\.json/.test(bks) && /care-cfg\.json/.test(bks) && /care-mail\.log/.test(bks), 'the app backup carries care-plans.json, care-cfg.json and care-mail.log');
  console.log('API part done: ' + R.pass + ' passed, ' + R.fail + ' failed');

  /* ---- screenshots, desktop and phone ---- */
  mkdirSync(SHOTS, { recursive: true });
  await call('admin', 'mailset', null, { kind: 'other', host: '127.0.0.1', port: MP, user: 'owner@acme-care-test.com', name: 'Acme', pass: 'goodapppassword1' });
  await call('admin', 'careqset', null, { lead: L2.id, plan: q1.id });
  const B = await browser(6890);
  const wide = (w) => B.js(`document.documentElement.scrollWidth <= ${w} + 1`);
  const title = `((document.querySelector('#barin .bt b')||document.querySelector('#barin b')||{}).textContent||'')`;
  try {
    for (const [w, h, tag] of [[1280, 900, 'desk'], [390, 844, 'phone']]) {
      await B.openAs('admin', w, h); await B.waitFor(`!!document.querySelector('.choose, .omenu, .dnav')`, 'home', 20000); await sleep(800);
      await B.js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Office$/.test(x.textContent.trim()));if(b)b.click()})()`); await sleep(900);
      const op = await B.js(`(()=>{const b=[...document.querySelectorAll('.tile, .omenu button, .dnav button')].find(x=>x.textContent.trim().indexOf('Plans')===0);if(!b)return false;b.click();return true})()`);
      t(op, tag + ': the Office menu has Plans');
      await B.waitFor(`document.querySelectorAll('.careprow').length >= 5`, 'plans list'); await sleep(400);
      t(await wide(w), tag + ': Plans fits the width'); await B.shot('care-01-plans-' + tag, true);
      await B.js(`document.querySelector('.careprow[data-id="cs-roof"]').click()`); await B.waitFor(`!!document.querySelector('.careform')`, 'plan form'); await sleep(300);
      t(await wide(w), tag + ': the plan form fits'); await B.shot('care-02-plan-form-' + tag, true);
      await B.js(`(()=>{const s=document.querySelector('.careform select');s.value='weeks';s.dispatchEvent(new Event('change'));const c=document.querySelector('.careform .cpck input');c.checked=true;c.dispatchEvent(new Event('change'))})()`); await sleep(200);
      t(await B.js(`!document.querySelector('.careseason').hidden`), tag + ': season fields open with the box');
      await B.shot('care-03-plan-form-season-' + tag, true);
      /* Customer emails */
      await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); await B.waitFor(`!!document.querySelector('.choose, .omenu, .dnav')`, 'home2', 20000); await sleep(600);
      await B.js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Office$/.test(x.textContent.trim()));if(b)b.click()})()`); await sleep(900);
      await B.js(`(()=>{const b=[...document.querySelectorAll('.tile, .omenu button, .dnav button')].find(x=>x.textContent.trim().indexOf('Customer emails')===0);if(!b)return false;b.click();return true})()`);
      await B.waitFor(`!!document.querySelector('.carefu')`, 'customer emails'); await sleep(400);
      t(await wide(w), tag + ': Customer emails fits'); await B.shot('care-04-emails-' + tag, true);
      await B.js(`[...document.querySelectorAll('.carefu .mailbtns button')].find(b=>b.textContent==='Preview').click()`); await B.waitFor(`!!document.querySelector('.carefu iframe.fuframe')`, 'fu preview'); await sleep(300);
      await B.js(`document.querySelector('.carefu iframe.fuframe').scrollIntoView()`); await B.shot('care-05-followup-preview-' + tag);
      await B.js(`[...document.querySelectorAll('.kitstep')].find(b=>/Newsletter/.test(b.textContent)).click()`); await B.waitFor(`!!document.querySelector('.careissue') || /New issue/.test(document.body.textContent)`, 'newsletter'); await sleep(400);
      t(await wide(w), tag + ': Newsletter fits'); await B.shot('care-06-newsletter-' + tag, true);
      await B.js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='+ New issue').click()`); await B.waitFor(`!!document.querySelector('.carenews textarea')`, 'issue editor'); await sleep(300);
      await B.js(`(()=>{const s=document.querySelector('.carenews select');s.value='monthly';s.dispatchEvent(new Event('change'))})()`); await sleep(200);
      t(await wide(w), tag + ': the issue editor fits'); await B.shot('care-07-issue-' + tag, true);
      /* the customer's plan box */
      await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); await B.waitFor(`!!document.querySelector('.choose, .omenu, .dnav')`, 'home3', 20000); await sleep(600);
      await B.js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Office$/.test(x.textContent.trim()));if(b)b.click()})()`); await sleep(900);
      await B.js(`(()=>{const b=[...document.querySelectorAll('.tile, .omenu button, .dnav button')].find(x=>x.textContent.trim().indexOf('Customers')===0);if(!b)return false;b.click();return true})()`); await B.waitFor(`!!document.querySelector('#custfind')`, 'customer list', 15000).catch(() => {}); await B.js(`(()=>{const i=document.querySelector('#custfind');i.value='Bo Book ${U}';i.dispatchEvent(new Event('input'))})()`); await sleep(800);
      const opened = await B.js(`(()=>{const e=[...document.querySelectorAll('button.crow')].find(x=>x.textContent.includes('Bo Book ${U}'));if(!e)return false;e.click();return true})()`);
      if (opened) { await B.waitFor(`!!document.querySelector('.careplan .cpl') || !!document.querySelector('.careplan .addlead')`, 'plan box', 15000); await sleep(400); t(await wide(w), tag + ': the customer page with its plan fits'); await B.js(`document.querySelector('.careplan').scrollIntoView()`); await B.shot('care-08-customer-plan-' + tag); }
      else t(false, tag + ': Bo Book not found in Customers');
      if (opened) { await B.js(`[...document.querySelectorAll('.careplan button')].find(b=>b.textContent==='Payment link')?.click()`); await sleep(400); await B.js(`document.querySelector('.careplan').scrollIntoView()`); await B.shot('care-09-customer-paylink-' + tag); }
      /* the Jobs board: Plan visits to book (Casey is due later; Lee in April; a new one due today) */
      if (tag === 'desk') { const c5 = await call('admin', 'customersave', null, { name: 'Dot Due ' + U, email: 'dot' + U + '@example.com', phone: '3035550115', address: '5 Due St', town: 'Denver' }); await call('admin', 'careenrol', null, { cid: c5.id, plan: q1.id, start: today }); }
      await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); await B.waitFor(`!!document.querySelector('.choose, .omenu, .dnav')`, 'home4', 20000); await sleep(600);
      await B.js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Office$/.test(x.textContent.trim()));if(b)b.click()})()`); await sleep(900);
      await B.js(`(()=>{const b=[...document.querySelectorAll('.tile, .omenu button, .dnav button')].find(x=>x.textContent.trim().indexOf('Jobs')===0);if(!b)return false;b.click();return true})()`);
      await B.waitFor(`!!document.querySelector('.caredue:not([hidden])')`, 'plan visits to book', 15000); await sleep(300);
      t(await B.js(`document.querySelector('.caredue').textContent.includes('Dot Due ${U}')`), tag + ': Plan visits to book lists Dot (due today)');
      t(await wide(w), tag + ': the Jobs board fits'); await B.shot('care-10-jobs-due-' + tag);
      await B.js(`[...document.querySelectorAll('.caredue button')].find(b=>b.textContent==='Book').click()`); await B.waitFor(`/Book the job/.test(document.querySelector('#barin').textContent)`, 'booking form', 15000); await sleep(400);
      t(await B.js(`[...document.querySelectorAll('input')].some(i=>i.value==='Quarterly gutter care visit')`), tag + ': Book opens the booking form filled in (the plan visit)');
      await B.shot('care-11-book-visit-' + tag);
    }
    /* the quote builder and the customer's quote page */
    await B.openAs('admin', 1280, 900); await sleep(1500);
    await B.js(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^Office$/.test(x.textContent.trim()));if(b)b.click()})()`); await sleep(900);
    for (const [w, h, tag] of [[1280, 900, 'desk'], [390, 844, 'phone']]) {
      const K2b = await call('admin', 'kitquote', null, { id: L2.id, price: 1200, measures: {}, picks: {} });
      await B.size(w, h); await B.send('Page.navigate', { url: (K2b.link || '').replace(/^https?:\/\/[^/]+/, ORIGIN) });
      await B.waitFor(`document.body.textContent.includes('Or go on a plan')`, 'quote page plan card', 15000); await sleep(400);
      t(await wide(w), tag + ': the quote page with the plan fits'); await B.shot('care-12-quote-page-plan-' + tag, true);
    }
    t(B.errors.length === 0, 'no page errors' + (B.errors.length ? ': ' + B.errors.slice(0, 3).join(' | ') : ''));
  } finally { B.close(); }
} catch (e) { t(false, 'stopped: ' + (e && e.stack || e)); }
finally {
  try { await call('admin', 'mailoff', null, {}); } catch {}
  for (const f of ['care-plans.json', 'care-cfg.json', 'care-news.json', 'care-optin.json', 'care-qplans.json', 'newsletter-unsub.json']) rmSync(DATA + '/' + f, { force: true });
  if (smtp) smtp.kill();
  mode('edition');
}
console.log(`care-test: ${R.pass} passed, ${R.fail} failed`);
process.exit(R.fail ? 1 : 0);

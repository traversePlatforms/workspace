// Instant Form vs Messenger, 7 Nov 2026 (Matthew: "this is our current adspend can you update it and launch that pdf for me so i can determine
// conversion rates"). Same one-page sheet and the same rules as 19 Oct - 1 Nov: Russ K. and Carlos P. (referred by Eric) count to the form; Peggy S.
// counts to Messenger (Jen logs her as a phone call); Marc S., Zane H., Daniel C., Michele E. stay Messenger; Brian S. (in person) and Kara R.
// (referral) left out. New on this one: a conversion row per step (seen -> lead -> quoted -> booked) and every job a lead has, so a $0 return
// visit (Daniel C., 6 Nov) does not hide the paid one. Spend and results: Matthew's Ads Manager screenshot, 7 Nov morning (+ the first form ad's
// 19 Oct total). Jobs, leads, quotes and payments: the live app, read-only, 7 Nov.   node build.cjs <adpull.json>  ->  sheet.html (+ PDF via Chrome)
// adpull.json = { ad: adreport, leads: leads, jobs: jobs&from=2026-10-10&to=2026-12-07 } from the Claude Check account (holds customer details:
// keep it out of the repo).
const f = require('fs');
const P = JSON.parse(f.readFileSync(process.argv[2], 'utf8'));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US'), money2 = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1).replace(/\.0$/, '') : '0') + '%';
const day = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const short = (n) => { const p = String(n || '').trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); };
const real = (l) => !/\btest\b|claude/i.test(l.name || '');
const leads = P.leads.leads.filter(real), L = Object.fromEntries(leads.map((l) => [l.id, l]));
const TODAY = P.ad.today;
/* paid so far per job: the ad report's figure where it has the job (it keeps one job per lead), else the job's own pay record */
const adPaid = {};
for (const s of Object.values(P.ad.src)) for (const j of s.jobs) adPaid[j.name + '|' + j.date + '|' + j.price] = j;
for (const w of P.ad.web) if (w.job) adPaid[w.name + '|' + w.job.date + '|' + w.job.price] = { ...w.job, owed: w.job.price - w.job.paid };
const jobRow = (j) => {
  const l = L[j.lead] || {}, who = short(l.name || j.title), a = adPaid[who + '|' + j.date + '|' + j.price];
  const paidAmt = a ? a.paid : j.pay?.s === 'paid' ? j.price : j.pay?.amt || 0;
  return { lead: j.lead, src: l.src, who, price: j.price, date: j.date, done: j.done?.o === 'done', paid: paidAmt >= j.price, paidAmt, deposit: paidAmt > 0 && paidAmt < j.price };
};
const all = P.jobs.jobs.filter((j) => j.price > 0 && L[j.lead]).map(jobRow);
const zero = P.jobs.jobs.filter((j) => !(j.price > 0) && L[j.lead]).map((j) => short(L[j.lead].name) + ' (' + day(j.date) + ')');
const bySrc = (s) => all.filter((j) => j.src === s);
const form = [...bySrc('meta'), ...bySrc('referral').filter((j) => /^(Russ|Carlos)/.test(j.who)).map((j) => ({ ...j, ref: 'referred by Eric' }))].sort((a, b) => a.date.localeCompare(b.date));
const msgr = [...bySrc('messenger').map((j) => (/^(Marc S|Zane H|Daniel C|Michele E)/.test(j.who) ? { ...j, ref: 'logged as a phone call' } : j)),
  ...bySrc('phone').filter((j) => /^Peggy/.test(j.who)).map((j) => ({ ...j, ref: 'logged as a phone call' }))].sort((a, b) => a.date.localeCompare(b.date));
const web = bySrc('a365web').sort((a, b) => a.date.localeCompare(b.date));
const webForms = P.ad.web.length;
const ads = Object.fromEntries(P.ad.ads.map((a) => [a.key, a]));
const S = { form: ads.form1.spend + ads.form2.spend, msgr: ads.msgr.spend }, R = { form: ads.form1.results + ads.form2.results, msgr: ads.msgr.results };
const V = { form: ads.form2.meta.views, msgr: ads.msgr.meta.views }, W = { form: ads.form2.meta.viewers, msgr: ads.msgr.meta.viewers };
/* leads in the app and how far they got (Peggy counted to Messenger, as the jobs are) */
const inApp = { form: leads.filter((l) => l.src === 'meta'), msgr: [...leads.filter((l) => l.src === 'messenger'), ...leads.filter((l) => l.src === 'phone' && /^Peggy/.test(l.name || ''))] };
const booked = new Set(all.map((j) => j.lead));
const quoted = (arr) => arr.filter((l) => booked.has(l.id) || +(l.quote?.price || 0) > 0 || ['quoted', 'won'].includes(l.status));
const openQ = (arr) => arr.filter((l) => !booked.has(l.id) && l.status !== 'lost' && +(l.quote?.price || 0) > 0);
const lost = (arr) => arr.filter((l) => l.status === 'lost' && !booked.has(l.id)).length;
const Q = { form: quoted(inApp.form).length, msgr: quoted(inApp.msgr).length }, OQ = { form: openQ(inApp.form), msgr: openQ(inApp.msgr) };
const direct = form.filter((j) => !j.ref).length, fJ = form.length, mJ = msgr.length;
const sum = (a, k = 'price') => a.reduce((x, j) => x + (+(k === 'q' ? j.quote?.price : j[k]) || 0), 0);
const fV = sum(form), mV = sum(msgr);
const status = (j) => (j.done ? 'done' : day(j.date)) + (j.paid ? ', paid' : j.deposit ? ', deposit in' : j.done ? ', balance owed' : '');
const rows = (a) => a.map((j) => `<tr><td>${j.who}${j.ref ? ` <span class="ref">${j.ref}</span>` : ''}</td><td>${money(j.price)}</td><td>${status(j)}</td></tr>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Instant Form vs Messenger, 7 Nov 2026</title><style>
@page{size:Letter;margin:0.32in}
:root{--forest:#2F5D2C;--moss:#4C7A3F;--ember:#E4703A;--ink:#1D2A1C;--soft:#5a6858;--line:#d9d1c2;--cream:#FFF8EC}
*{box-sizing:border-box}body{margin:0;font:8.2pt/1.2 'Segoe UI',Arial,sans-serif;color:var(--ink)}
h1{font:800 19pt/1.1 'Segoe UI',Arial,sans-serif;color:var(--forest);margin:0 0 2px}.sub{color:var(--soft);margin:0 0 6px}
h2{font:700 10pt 'Segoe UI',Arial,sans-serif;color:var(--forest);margin:7px 0 3px;padding-bottom:2px;border-bottom:2px solid var(--ember)}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:0 0 4px}.k{border:1px solid var(--line);border-radius:10px;padding:5px 11px}
.k.f{border-left:6px solid var(--moss)}.k.m{border-left:6px solid var(--ember)}.k.w{border-left:6px solid var(--forest)}
.k .t{font-weight:700;color:var(--soft);font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}.k .n{font:800 18pt/1.1 'Segoe UI',Arial,sans-serif;color:var(--forest)}.k.m .n{color:var(--ember)}.k .l{font-size:8.5pt;color:var(--soft)}
table{width:100%;border-collapse:collapse;font-size:8.2pt}th,td{padding:2px 6px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}
th{color:var(--soft);font-weight:700}.lists{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.ref{color:var(--soft);font-size:7.4pt}.tot td{font-weight:700;border-top:2px solid var(--forest)}
tr.sec td{font-weight:700;color:var(--forest);background:#f4f1ea}
.note{background:#fff6e0;border:1px solid #f0d9a8;border-radius:8px;padding:5px 9px;margin:6px 0}.foot{color:var(--soft);font-size:7.4pt;margin-top:6px}
</style></head><body>
<h1>Instant Form vs Messenger</h1>
<p class="sub">365 Aeration &amp; Seeding · Meta ads · as of Saturday 7 November 2026, morning · internal</p>
<div class="kpis">
 <div class="k f"><div class="t">Instant Form · cost per job</div><div class="n">${money2(S.form / fJ)}</div><div class="l">${money2(S.form)} (both form ads) ÷ ${fJ} jobs</div></div>
 <div class="k m"><div class="t">Messenger · cost per job</div><div class="n">${money2(S.msgr / mJ)}</div><div class="l">${money2(S.msgr)} ÷ ${mJ} jobs</div></div>
 <div class="k w"><div class="t">365 website · cost per job</div><div class="n">$0</div><div class="l">${web.length} jobs from ${webForms} forms, ${money(sum(web))}</div></div>
</div>
<h2>Conversion, step by step</h2>
<table><thead><tr><th></th><th>Instant Form (two ads)</th><th>Messenger</th></tr></thead><tbody>
<tr><td>Ran</td><td>13–14 Oct (paused) and since 19 Oct, $100/day now</td><td>since 15 Oct, $100/day now</td></tr>
<tr><td>Spent</td><td>${money2(S.form)} ($169.28 + ${money2(ads.form2.spend)})</td><td>${money2(S.msgr)}</td></tr>
<tr><td>People who saw it (current ad)</td><td>${W.form.toLocaleString('en-US')} (${V.form.toLocaleString('en-US')} views)</td><td>${W.msgr.toLocaleString('en-US')} (${V.msgr.toLocaleString('en-US')} views)</td></tr>
<tr class="sec"><td>Seen → lead / conversation</td><td>${pct(ads.form2.results, W.form)} (${ads.form2.results} of ${W.form.toLocaleString('en-US')} viewers, current ad)</td><td>${pct(R.msgr, W.msgr)} (${R.msgr} of ${W.msgr.toLocaleString('en-US')} viewers)</td></tr>
<tr><td>Leads / conversations (Meta)</td><td>${R.form} leads (21 + ${ads.form2.results}); ${inApp.form.length} in the app</td><td>${R.msgr} conversations; ${inApp.msgr.length} became leads in the app</td></tr>
<tr><td>Cost per lead / conversation</td><td>${money2(S.form / R.form)}</td><td>${money2(S.msgr / R.msgr)}</td></tr>
<tr class="sec"><td>Conversation → lead in the app</td><td>every form is a lead</td><td>${pct(inApp.msgr.length, R.msgr)} (${inApp.msgr.length} of ${R.msgr})</td></tr>
<tr class="sec"><td>Lead in the app → quoted</td><td>${pct(Q.form, inApp.form.length)} (${Q.form} of ${inApp.form.length})</td><td>${pct(Q.msgr, inApp.msgr.length)} (${Q.msgr} of ${inApp.msgr.length})</td></tr>
<tr class="sec"><td>Quoted → booked</td><td>${pct(direct, Q.form)} (${direct} of ${Q.form})</td><td>${pct(mJ, Q.msgr)} (${mJ} of ${Q.msgr})</td></tr>
<tr class="sec"><td>Meta lead → job (end to end)</td><td>${pct(direct, R.form)} direct (${direct} of ${R.form}); ${fJ} with Eric's 2 referrals</td><td>${pct(mJ, R.msgr)} (${mJ} of ${R.msgr} conversations)</td></tr>
<tr><td>Jobs booked</td><td>${fJ} (${direct} + 2 referred by Eric)</td><td>${mJ}</td></tr>
<tr><td>Value of jobs booked</td><td>${money(fV)}</td><td>${money(mV)}</td></tr>
<tr><td>Booked value per $1 spent</td><td>${money2(fV / S.form)}</td><td>${money2(mV / S.msgr)}</td></tr>
<tr><td>Collected so far</td><td>${money(sum(form, 'paidAmt'))}</td><td>${money(sum(msgr, 'paidAmt'))}</td></tr>
<tr><td>Quoted, not booked, not lost</td><td>${OQ.form.length} quotes, ${money(sum(OQ.form, 'q'))}</td><td>${OQ.msgr.length} quotes, ${money(sum(OQ.msgr, 'q'))}</td></tr>
<tr><td>Marked lost</td><td>${lost(inApp.form)}</td><td>${lost(inApp.msgr)}</td></tr>
<tr class="tot"><td>Cost per job</td><td>${money2(S.form / fJ)}</td><td>${money2(S.msgr / mJ)}</td></tr>
</tbody></table>
<h2>The customers each source brought in</h2>
<div class="lists">
 <table><thead><tr><th>Instant Form</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(form)}<tr class="tot"><td>${fJ} jobs</td><td>${money(fV)}</td><td>${money(sum(form, 'paidAmt'))} in</td></tr></tbody></table>
 <table><thead><tr><th>Messenger</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(msgr)}<tr class="tot"><td>${mJ} jobs</td><td>${money(mV)}</td><td>${money(sum(msgr, 'paidAmt'))} in</td></tr></tbody></table>
 <table><thead><tr><th>365 website</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(web)}<tr class="tot"><td>${web.length} jobs</td><td>${money(sum(web))}</td><td>${money(sum(web, 'paidAmt'))} in</td></tr></tbody></table>
</div>
<p class="foot">Spend, views and results: Meta Ads Manager, 7 Nov morning (lifetime), plus the first form ad's run (19 Oct screenshot; its views are not on the new screenshot, so "seen → lead" uses the current form ad only). Jobs, leads, quotes and payments: the live app, 7 Nov. "Quoted" = an app quote, or the lead is at Quoted or Won, or it has a job. A Messenger conversation is not a lead: only the ones Jen adds reach the app, so Messenger's lead → quoted → booked steps run on far fewer people. Not counted as jobs: $0 return visits (${zero.join(', ') || 'none'}). Left out as before: Brian S. (in person) and Kara R. (referral). "Paid" means nothing is owed on the job.</p>
</body></html>`;
f.writeFileSync(__dirname + '/sheet.html', html);
console.log('form', fJ, 'jobs', money(fV), 'cpj', money2(S.form / fJ), '| messenger', mJ, 'jobs', money(mV), 'cpj', money2(S.msgr / mJ), '| website', web.length, money(sum(web)));
console.log('form: viewers', W.form, 'leads', R.form, 'app', inApp.form.length, 'quoted', Q.form, 'direct', direct, 'open', OQ.form.length, money(sum(OQ.form, 'q')));
console.log('msgr: viewers', W.msgr, 'convs', R.msgr, 'app', inApp.msgr.length, 'quoted', Q.msgr, 'jobs', mJ, 'open', OQ.msgr.length, money(sum(OQ.msgr, 'q')));
console.log('zero', zero.join(', '));

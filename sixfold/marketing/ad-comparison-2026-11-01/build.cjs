// Instant Form vs Messenger, 1 Nov 2026 (Matthew: "can you update the stats page to reflect that, at least the pdf form"): the same one-page
// sheet as 19-23 Oct, with Marc S., Zane H., Daniel C. and Michele E. counted as Messenger (Jen had logged them as phone calls; their leads'
// source was fixed in the app on 1 Nov) and the same rules as before (Russ K. and Carlos P., referred by Eric, count to the form; Brian in
// person and Kara left out). Spend and results: Matthew's Ads Manager screenshot, 1 Nov evening (+ the first form ad's 19 Oct total).
// Jobs, quotes and payments: the live app, 1 Nov. Internal.   node build.cjs <adsheet.json>  ->  sheet.html (+ PDF via Chrome)
const f = require('fs');
const D = JSON.parse(f.readFileSync(process.argv[2], 'utf8'));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US'), money2 = (n) => '$' + n.toFixed(2);
const day = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const form = [...(D.jobs.meta || []), ...(D.jobs.referral || []).filter((j) => /^Carlos/.test(j.who)).map((j) => ({ ...j, ref: 'referred by Eric' }))]
  .map((j) => (/^Russ/.test(j.who) ? { ...j, ref: 'referred by Eric' } : j)).sort((a, b) => a.date.localeCompare(b.date));
const msgr = (D.jobs.messenger || []).map((j) => (/^(Marc S|Zane H|Daniel C|Michele E)/.test(j.who) ? { ...j, ref: 'was logged as a phone call' } : j)).sort((a, b) => a.date.localeCompare(b.date));
const web = (D.jobs.a365web || []).sort((a, b) => a.date.localeCompare(b.date));
const S = { form: 169.28 + 1187.48, msgr: 1478.37 }, R = { form: 21 + 69, msgr: 114 };
const sum = (a, k = 'price') => a.reduce((x, j) => x + (j[k] || 0), 0);
const paid = (a) => sum(a.filter((j) => j.paid));
const held = (k) => (D.held[k] || []).filter((h) => h.price > 0);
const status = (j) => (j.done ? 'done' : day(j.date)) + (j.paid ? ', paid' : j.done ? ', balance owed' : '');
const rows = (a) => a.map((j) => `<tr><td>${j.who}${j.ref ? ` <span class="ref">${j.ref}</span>` : ''}</td><td>${money(j.price)}</td><td>${status(j)}</td></tr>`).join('');
const fJ = form.length, mJ = msgr.length, fV = sum(form), mV = sum(msgr);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Instant Form vs Messenger, 1 Nov 2026</title><style>
@page{size:Letter;margin:0.32in}
:root{--forest:#2F5D2C;--moss:#4C7A3F;--ember:#E4703A;--ink:#1D2A1C;--soft:#5a6858;--line:#d9d1c2;--cream:#FFF8EC}
*{box-sizing:border-box}body{margin:0;font:8.4pt/1.2 'Segoe UI',Arial,sans-serif;color:var(--ink)}
h1{font:800 19pt/1.1 'Segoe UI',Arial,sans-serif;color:var(--forest);margin:0 0 2px}.sub{color:var(--soft);margin:0 0 6px}
h2{font:700 10pt 'Segoe UI',Arial,sans-serif;color:var(--forest);margin:7px 0 3px;padding-bottom:2px;border-bottom:2px solid var(--ember)}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:0 0 4px}.k{border:1px solid var(--line);border-radius:10px;padding:5px 11px}
.k.f{border-left:6px solid var(--moss)}.k.m{border-left:6px solid var(--ember)}.k.w{border-left:6px solid var(--forest)}
.k .t{font-weight:700;color:var(--soft);font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em}.k .n{font:800 18pt/1.1 'Segoe UI',Arial,sans-serif;color:var(--forest)}.k.m .n{color:var(--ember)}.k .l{font-size:8.5pt;color:var(--soft)}
table{width:100%;border-collapse:collapse;font-size:8.4pt}th,td{padding:2px 6px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}
th{color:var(--soft);font-weight:700}.lists{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.ref{color:var(--soft);font-size:7.6pt}.tot td{font-weight:700;border-top:2px solid var(--forest)}
.note{background:#fff6e0;border:1px solid #f0d9a8;border-radius:8px;padding:5px 9px;margin:6px 0}.foot{color:var(--soft);font-size:7.6pt;margin-top:6px}
</style></head><body>
<h1>Instant Form vs Messenger</h1>
<p class="sub">365 Aeration &amp; Seeding · Meta ads · as of Sunday 1 November 2026, evening · internal</p>
<div class="kpis">
 <div class="k f"><div class="t">Instant Form · cost per job</div><div class="n">${money2(S.form / fJ)}</div><div class="l">${money2(S.form)} (both form ads) ÷ ${fJ} jobs</div></div>
 <div class="k m"><div class="t">Messenger · cost per job</div><div class="n">${money2(S.msgr / mJ)}</div><div class="l">${money2(S.msgr)} ÷ ${mJ} jobs</div></div>
 <div class="k w"><div class="t">365 website · cost per job</div><div class="n">$0</div><div class="l">${web.length} jobs from 9 forms (one person sent two), ${money(sum(web))}</div></div>
</div>
<div class="note"><b>Corrected 1 Nov:</b> Marc S., Zane H., Daniel C. and Michele E. came from Messenger; Jen had added them by hand as phone calls. Their leads now say Messenger in the app, and they count to Messenger here. Messenger goes from 4 jobs to ${mJ}.</div>
<h2>The numbers</h2>
<table><thead><tr><th></th><th>Instant Form (two ads)</th><th>Messenger</th></tr></thead><tbody>
<tr><td>Ran</td><td>13–14 Oct (paused) and since 19 Oct</td><td>since 15 Oct</td></tr>
<tr><td>Spent</td><td>${money2(S.form)} ($169.28 + $1,187.48)</td><td>${money2(S.msgr)}</td></tr>
<tr><td>Daily limit now</td><td>$81</td><td>$81</td></tr>
<tr><td>Leads / conversations (Meta)</td><td>${R.form} leads (21 + 69); ${D.leads.meta} in the app</td><td>${R.msgr} conversations; ${D.leads.messenger} became leads in the app</td></tr>
<tr><td>Cost per lead / conversation</td><td>${money2(S.form / R.form)}</td><td>${money2(S.msgr / R.msgr)}</td></tr>
<tr><td>Jobs booked</td><td>${fJ} (${fJ - 2} + 2 referred by Eric)</td><td>${mJ}</td></tr>
<tr><td>Lead → job</td><td>${Math.round(((fJ - 2) / R.form) * 100)}% direct (${fJ - 2} of ${R.form})</td><td>${Math.round((mJ / R.msgr) * 100)}% (${mJ} of ${R.msgr})</td></tr>
<tr><td>Value of jobs booked</td><td>${money(fV)}</td><td>${money(mV)}</td></tr>
<tr><td>Booked value per $1 spent</td><td>${money2(fV / S.form)}</td><td>${money2(mV / S.msgr)}</td></tr>
<tr><td>Collected so far</td><td>${money(paid(form))}</td><td>${money(paid(msgr))}</td></tr>
<tr><td>Quoted, not booked yet</td><td>${held('meta').length} quotes, ${money(sum(held('meta')))}</td><td>${held('messenger').length} quotes, ${money(sum(held('messenger')))}</td></tr>
<tr class="tot"><td>Cost per job</td><td>${money2(S.form / fJ)}</td><td>${money2(S.msgr / mJ)}</td></tr>
</tbody></table>
<h2>The customers each source brought in</h2>
<div class="lists">
 <table><thead><tr><th>Instant Form</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(form)}<tr class="tot"><td>${fJ} jobs</td><td>${money(fV)}</td><td>${money(paid(form))} in</td></tr></tbody></table>
 <table><thead><tr><th>Messenger</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(msgr)}<tr class="tot"><td>${mJ} jobs</td><td>${money(mV)}</td><td>${money(paid(msgr))} in</td></tr></tbody></table>
 <table><thead><tr><th>365 website</th><th>Price</th><th>Status</th></tr></thead><tbody>${rows(web)}<tr class="tot"><td>${web.length} jobs</td><td>${money(sum(web))}</td><td>${money(paid(web))} in</td></tr></tbody></table>
</div>
<p class="foot">Spend and results: Meta Ads Manager, 1 Nov evening (lifetime), plus the first form ad's run (19 Oct screenshot). Jobs, quotes and payments: the live app, 1 Nov. Left out as before: Brian S. (in person) and Kara R. (referral). Website people mostly heard of us on Facebook (4 of 9 said so), so the ads help the website too. "Paid" means nothing is owed on the job.</p>
</body></html>`;
f.writeFileSync(__dirname + '/sheet.html', html);
console.log('form', fJ, 'jobs', money(fV), '| messenger', mJ, 'jobs', money(mV), '| website', web.length, money(sum(web)));

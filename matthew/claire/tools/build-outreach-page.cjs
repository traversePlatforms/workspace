/* Claire's first Traverse outreach lists as one printable page (2026-11-21), from outreach-lists-<date>.json (names, towns, trade, why;
   no contact details: she opens each company on the prospect desk to reach it).
     node build-outreach-page.cjs <lists.json> <out.html> */
const fs = require('fs');
const [, , IN, OUT] = process.argv;
const J = JSON.parse(fs.readFileSync(IN, 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = { nextdoor: ['Nextdoor messages', 'Companies with a Nextdoor business page that nobody has messaged. About 15 to 20 a day.'],
  facebook: ['Facebook messages', 'Companies whose website links a Facebook page. About 15 to 20 a day.'],
  calls: ['Calls', 'Emailed by the desk with no reply yet: a follow-up call. Weekdays, business hours.'],
  email: ['Emails from your Traverse address', 'Small roofing and lawn companies with a working email: not emailed by the desk yet, or emailed with no reply. One at a time.'] };
const sec = Object.entries(J.lists).map(([k, rows]) => `<h2>${esc(T[k][0])} <small>(first ${rows.length})</small></h2><p class="sub">${esc(T[k][1])}</p>
<table><thead><tr><th>#</th><th>Company</th><th>Town</th><th>Trade</th><th>Why it's on the list</th><th>Done</th><th>How it went</th></tr></thead><tbody>
${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.city)}</td><td>${esc(r.trade)}</td><td><small>${esc(r.why)}</small></td><td class="b"></td><td class="w"></td></tr>`).join('\n')}
</tbody></table>`).join('\n');
fs.writeFileSync(OUT, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>First Traverse outreach lists</title><style>
@page { size: letter landscape; margin: 0.4in 0.45in; }
body { font: 9.4pt/1.28 "Segoe UI", Arial, sans-serif; color: #1b2430; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 2px; color: #0f1b2d; } h2 { font-size: 11.5pt; margin: 12px 0 1px; color: #0f1b2d; page-break-after: avoid; } h2 small { color: #566476; font-weight: 400; }
.sub { color: #566476; margin: 0 0 5px; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #cdd6e2; padding: 2px 5px; vertical-align: top; text-align: left; }
th { background: #eef2f7; font-size: 8.6pt; } td.n { width: 16px; text-align: right; } td.b { width: 5%; } td.w { width: 22%; } tr { page-break-inside: avoid; } small { color: #566476; }
</style></head><body>
<h1>First Traverse outreach lists</h1>
<p class="sub">For Claire, built ${esc(J.built.slice(0, 10))} from the prospect desk. Best fit first: roofing and lawn, young companies first. Each company is on one list only. Already left out: anyone who asked not to be emailed, a dead email, Not interested or further along, anyone contacted in the last 14 days, a broken Nextdoor page, the companies Matthew messaged on Nextdoor on 31 Oct, and anyone who clicked an email (Matthew follows those up). Find each one by name on the desk; the phone and links are there. Use approved scripts only, and log every touch on the desk.</p>
${sec}
</body></html>
`);
console.log('written');

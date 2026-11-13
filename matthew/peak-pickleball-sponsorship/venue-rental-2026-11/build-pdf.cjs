// Builds venue-prospects.html (landscape, readable) from prospects.csv + contacts.csv; print with Chrome to PDF.
// 2026-11-13: each prospect shows its best contact (the contacts.csv row marked "best contact" = yes).
const fs = require('fs');
function parseCsv(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return { rows: rows.filter(r => r.length > 3), H: Object.fromEntries(head.map((h, i) => [h, i])) };
}
const { rows, H } = parseCsv('prospects.csv');
const C = parseCsv('contacts.csv');
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const best = {};
for (const c of C.rows) if (c[C.H['best contact']] === 'yes') best[c[C.H.organisation]] = Object.fromEntries(Object.entries(C.H).map(([k, i]) => [k, c[i]]));
const phone = s => String(s || '').split(';')[0].replace(/\s*\([^)]*[a-z][^)]*\)/gi, '').trim();
const short = s => { const t = String(s || '').split(/;| \(| - /)[0].trim(); return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '...' : t; };
const shortUrl = s => String(s || '').split(/ ; | \(/)[0].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
function contactCell(org) {
  const c = best[org];
  if (!c) throw new Error('no best contact for ' + org);
  const lines = [];
  if (c['contact name']) lines.push(`<b>${esc(c['contact name'])}</b>`, `<span class="role">${esc(short(c.role))}</span>`);
  else lines.push('<span class="role">No named person found</span>');
  const routeMail = (String(c['other route']).match(/[\w.+'-]+@[\w-]+(\.[\w-]+)+/) || [])[0];
  if (c['business email']) lines.push(esc(c['business email']) + (c['email status'].startsWith('pattern') ? ' <i>(pattern, unverified)</i>' : ''));
  else if (routeMail) lines.push(esc(routeMail));
  if (c['business phone']) lines.push(esc(phone(c['business phone'])));
  if (!c['business email'] && !routeMail && !c['business phone'] && c['other route']) lines.push(esc(shortUrl(c['other route'])));
  if (c.confidence !== 'high') lines.push(`<span class="conf">${esc(c.confidence)} confidence</span>`);
  return lines.join('<br>');
}
const TOP = ["Pikes Peak Senior News","Fitness Expo","Gazette","Nationwide Expos","American Consumer Shows","Body Mind Spirit","Cosmic Con","Marketplace Events","Springtime Productions","Vintage Market Days","L&L","Workforce","Parents Challenge","Tri-Lakes","Expo Pros"];
const rank = r => { const t = (r[H.organisation] + " " + r[H.events]); const i = TOP.findIndex(k => t.includes(k)); return i < 0 ? 99 : i; };
const data = rows.sort((a, b) => (+a[H.priority] - +b[H.priority]) || (rank(a) - rank(b)) || a[H.category].localeCompare(b[H.category]));
const label = { 1: 'Priority 1: best fit', 2: 'Priority 2', 3: 'Priority 3' };
let body = '', cur = null;
for (const r of data) { const p = r[H.priority];
  if (p !== cur) { if (cur) body += '</tbody></table>'; cur = p;
    body += `<h2>${label[p] || 'Priority ' + p} <span>(${data.filter(x => x[H.priority] === p).length})</span></h2><table><thead><tr><th>Organization</th><th>Type</th><th>What they run</th><th>Where now</th><th>Size</th><th>Last held</th><th>Why Peak</th><th>Best contact (13 Nov)</th><th>General route (12 Nov list)</th></tr></thead><tbody>`; }
  const site = r[H.website] ? `<div class="site">${esc(r[H.website].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</div>` : '';
  body += `<tr><td class="org">${esc(r[H.organisation])}${site}</td><td>${esc(r[H.category])}</td><td>${esc(r[H.events])}</td><td>${esc(r[H['current venue']])}</td><td>${esc(r[H['typical size']])}</td><td>${esc(r[H['last held']])}</td><td>${esc(r[H['why Peak']])}</td><td class="best">${contactCell(r[H.organisation])}</td><td>${esc(r[H['public contact route']])}</td></tr>`; }
body += '</tbody></table>';
fs.writeFileSync('venue-prospects.html', `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Peak Pickleball: expo and event rental prospects</title><style>
@page{size:Letter landscape;margin:.4in}body{font-family:"Segoe UI",Arial,sans-serif;color:#1d2733;font-size:8.2pt;margin:0}
h1{font-size:16pt;color:#0d366b;margin:0 0 2px}.sub{color:#5b6878;font-size:9pt;margin:0 0 8px}
h2{font-size:11pt;color:#256abf;margin:12px 0 4px}h2 span{color:#5b6878;font-weight:400}
table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0d366b;color:#fff;text-align:left;padding:4px 4px;font-size:7.8pt}
td{padding:4px 4px;border-bottom:1px solid #e3e8ef;vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word}tr:nth-child(even) td{background:#f5f8fc}
tr{break-inside:avoid}.org{font-weight:600;color:#0d366b}.site{font-weight:400;color:#5b6878;font-size:7.4pt}
td.best{background:#eef5ee!important;border-left:2px solid #3b7d4a}.best b{color:#0d366b}.role{color:#5b6878}.conf{color:#8a5a00;font-size:7.4pt}
th:nth-child(1){width:11%}th:nth-child(2){width:7%}th:nth-child(3){width:14%}th:nth-child(4){width:9%}th:nth-child(5){width:6%}th:nth-child(6){width:6%}th:nth-child(7){width:18%}th:nth-child(8){width:16%}th:nth-child(9){width:13%}
</style></head><body><h1>Peak Pickleball: who might rent the building for expos and events</h1>
<p class="sub">${data.length} organizations that run expos, shows, fairs and large indoor events around Colorado Springs and the Front Range. Public business contacts only. Researched 12 Nov 2026; named contacts added 13 Nov 2026 from each organizer's own pages and named outlets (full sources and notes in contacts.csv). Dates and venues as published by each organizer. Building: 80,380 sq ft on two levels (El Paso County Assessor, via the Gazette). Peak hosted the Senior Lifestyle Expo here on 18 Apr 2026.</p>${body}</body></html>`);
console.log('rows', data.length, 'with best contact', data.filter(r => best[r[H.organisation]]).length);

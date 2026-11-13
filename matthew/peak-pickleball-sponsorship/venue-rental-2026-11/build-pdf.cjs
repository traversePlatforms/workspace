// Builds venue-prospects.html (landscape, readable) from prospects.csv; print with Chrome to PDF.
const fs = require('fs');
const txt = fs.readFileSync('prospects.csv', 'utf8').replace(/^﻿/, '');
const rows = []; let row = [], f = '', q = false;
for (let i = 0; i < txt.length; i++) { const c = txt[i];
  if (q) { if (c === '"' && txt[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
  else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c; }
if (f || row.length) { row.push(f); rows.push(row); }
const head = rows.shift(); const H = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const TOP = ["Pikes Peak Senior News","Fitness Expo","Gazette","Nationwide Expos","American Consumer Shows","Body Mind Spirit","Cosmic Con","Marketplace Events","Springtime Productions","Vintage Market Days","L&L","Workforce","Parents Challenge","Tri-Lakes","Expo Pros"];
const rank = r => { const t = (r[H.organisation] + " " + r[H.events]); const i = TOP.findIndex(k => t.includes(k)); return i < 0 ? 99 : i; };
const data = rows.filter(r => r.length > 3).sort((a, b) => (+a[H.priority] - +b[H.priority]) || (rank(a) - rank(b)) || a[H.category].localeCompare(b[H.category]));
const label = { 1: 'Priority 1: best fit', 2: 'Priority 2', 3: 'Priority 3' };
let body = '', cur = null;
for (const r of data) { const p = r[H.priority];
  if (p !== cur) { if (cur) body += '</tbody></table>'; cur = p;
    body += `<h2>${label[p] || 'Priority ' + p} <span>(${data.filter(x => x[H.priority] === p).length})</span></h2><table><thead><tr><th>Organization</th><th>Type</th><th>What they run</th><th>Where now</th><th>Size</th><th>Last held</th><th>Why Peak</th><th>Contact (public)</th></tr></thead><tbody>`; }
  const site = r[H.website] ? `<div class="site">${esc(r[H.website].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</div>` : '';
  body += `<tr><td class="org">${esc(r[H.organisation])}${site}</td><td>${esc(r[H.category])}</td><td>${esc(r[H.events])}</td><td>${esc(r[H['current venue']])}</td><td>${esc(r[H['typical size']])}</td><td>${esc(r[H['last held']])}</td><td>${esc(r[H['why Peak']])}</td><td>${esc(r[H['public contact route']])}</td></tr>`; }
body += '</tbody></table>';
fs.writeFileSync('venue-prospects.html', `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Peak Pickleball: expo and event rental prospects</title><style>
@page{size:Letter landscape;margin:.4in}body{font-family:"Segoe UI",Arial,sans-serif;color:#1d2733;font-size:8.6pt;margin:0}
h1{font-size:16pt;color:#0d366b;margin:0 0 2px}.sub{color:#5b6878;font-size:9pt;margin:0 0 8px}
h2{font-size:11pt;color:#256abf;margin:12px 0 4px}h2 span{color:#5b6878;font-weight:400}
table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0d366b;color:#fff;text-align:left;padding:4px 5px;font-size:8pt}
td{padding:4px 5px;border-bottom:1px solid #e3e8ef;vertical-align:top;word-wrap:break-word}tr:nth-child(even) td{background:#f5f8fc}
tr{break-inside:avoid}.org{font-weight:600;color:#0d366b}.site{font-weight:400;color:#5b6878;font-size:7.6pt}
th:nth-child(1){width:13%}th:nth-child(2){width:9%}th:nth-child(3){width:16%}th:nth-child(4){width:10%}th:nth-child(5){width:7%}th:nth-child(6){width:7%}th:nth-child(7){width:22%}th:nth-child(8){width:16%}
</style></head><body><h1>Peak Pickleball: who might rent the building for expos and events</h1>
<p class="sub">${data.length} organizations that run expos, shows, fairs and large indoor events around Colorado Springs and the Front Range. Public business contacts only. Researched 12 Nov 2026; dates and venues as published by each organizer. Building: 80,380 sq ft on two levels (El Paso County Assessor, via the Gazette). Peak hosted the Senior Lifestyle Expo here on 18 Apr 2026.</p>${body}</body></html>`);
console.log('rows', data.length);

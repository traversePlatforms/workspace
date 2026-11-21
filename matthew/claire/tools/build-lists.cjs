/* Claire's two work lists as printable pages (2026-11-21).
     node build-lists.cjs <lawn-lots.json> <peak-picks.json> <out dir>
   Lawns: number, address, town, the kind of lot and why it teaches the model, the lot size, and blank columns for her measure. The app's own
   lawn figure is left off on purpose, so it can't steer her tracing. Peak: the company, which list, what is missing, and a link to its card. */
const fs = require('fs'), path = require('path');
const [, , LAWN, PEAK, OUT] = process.argv;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const title = (s) => String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());
const CSS = `@page { size: letter landscape; margin: 0.4in 0.45in; }
body { font: 9.6pt/1.3 "Segoe UI", Arial, sans-serif; color: #1b2430; margin: 0; }
h1 { font-size: 15pt; margin: 0 0 2px; color: #1d4a26; } .sub { color: #566476; margin: 0 0 7px; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #c9d3c9; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #eaf2ea; font-size: 8.8pt; } td.n { text-align: right; width: 18px; } td.w { width: 15%; } td.blank { width: 13%; }
tr { page-break-inside: avoid; } small { color: #566476; } a { color: #1d4a26; }`;
const KIND = { shade: 'Shaded suburban lot', wood: 'Wooded acreage', newer: 'Newer street', fair: 'Larger lot under trees' };
const TEACH = { shade: 'Shade and tree edges: the estimate tends to read these low.', wood: 'Big lot with trees: hard to tell lawn from field and canopy.',
  newer: 'Built after our 2023 photo: the app has no real size for it yet.', fair: 'The app says "Fair: ask them": unsure under the trees.' };

const lots = JSON.parse(fs.readFileSync(LAWN, 'utf8'));
const rows = lots.map((x, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(title(x.address))}</b><br><small>${esc(x.town)}, Colorado</small></td>
<td>${esc(KIND[x.kind])}<br><small>${esc(TEACH[x.kind])}</small></td><td>${x.acres ? x.acres.toFixed(2) + ' ac' : ''}</td>
<td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="w"></td></tr>`).join('\n');
fs.writeFileSync(path.join(OUT, 'lawn-first-25-lots.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>First 25 lawns to measure</title><style>${CSS}</style></head><body>
<h1>First 25 lawns to measure</h1>
<p class="sub">For Claire, 21 Nov 2026. Each one is in "Lawns to measure.kml" with the same number. All are in Colorado, within 45 miles of Englewood. The how-to says how to trace and what to leave out. Home addresses: keep this list private.</p>
<table><thead><tr><th>#</th><th>House</th><th>Kind of lot</th><th>Lot</th><th>Pieces (sq ft)</th><th>Total sq ft</th><th>Includes (grass only / under trees too)</th><th>Notes: trees, beds, picture date, or why skipped</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>
`);

const picks = JSON.parse(fs.readFileSync(PEAK, 'utf8'));
const DESK = 'https://traverseplatforms.com/peak-desk-28d38d/';
const prow = picks.map((x, i) => `<tr><td class="n">${i + 1}</td><td><b>${esc(x.name)}</b><br><small>${esc(x.kind)}</small></td>
<td>${x.w === 'expo' ? 'Expo leads, priority ' + esc(x.pri) : 'Sponsors, score ' + esc(x.score) + ' of 9'}</td><td>${esc(x.missing.join(', '))}</td>
<td><a href="${DESK}#card/${x.w}/${esc(x.id)}">Open the card</a></td><td class="blank"></td><td class="w"></td></tr>`).join('\n');
fs.writeFileSync(path.join(OUT, 'peak-first-20-lookups.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>First 20 Peak look-ups</title><style>${CSS} td.blank{width:10%}</style></head><body>
<h1>First 20 Peak look-ups</h1>
<p class="sub">For Claire, 21 Nov 2026. Companies and organisations on the Peak desk that are missing a website, a main phone or a general email, the strongest leads first. Nobody is working these yet. Sign in to the desk first; then "Open the card" goes straight to it. Public sources only, never a people-search site, and a note on the card for where each detail came from.</p>
<table><thead><tr><th>#</th><th>Company</th><th>List</th><th>Missing</th><th>Desk</th><th>Done</th><th>What you found, and where</th></tr></thead>
<tbody>${prow}</tbody></table></body></html>
`);
console.log('lists written: ' + lots.length + ' lawns, ' + picks.length + ' look-ups');

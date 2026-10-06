/* County wildfire protection plan ratings for our neighbourhoods (SX-47, 2026-10-03).

   SOURCE: Teller County Community Wildfire Protection Plan 2025, hosted by the Colorado State
   Forest Service: https://csfs.colostate.edu/wp-content/uploads/2026/05/Teller-County-CWPP_2025.pdf
   Tables 7-11 ("CWPP Community Assessments", pp. 113-117): every community the fire districts
   assessed, rated Extreme, Severe, High (Moderate and Low are counted, not listed), with
   structures and acres. 200 Teller assessments: 28 Extreme, 50 Severe, 75 High.

   The PDF is 17 MB, so it is not kept here. Download it, extract its text (any PDF-to-text tool;
   pdf-parse was used), and run:
     node build-cwpp.mjs <path-to-teller-2025.txt>
   Writes cwpp-teller-2025.json (the tables) and ../../../app/data/rounds/cwpp.json (our
   neighbourhood place names -> rating), matched by name against the subdivision names on our
   Teller doors. A match needs the plan's name (minus "AREA", "ZONE n" and the like) to equal
   our place name or, if it has at least two words, to be contained in it word for word. A one-word name must match exactly.

   El Paso and Douglas are not in yet: Douglas's county-wide CWPP dates from 2011 and El Paso's
   current plan was not found in a first search. Add them as their own sources when found. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const src = process.argv[2];
if (!src || !existsSync(src)) { console.log('Usage: node build-cwpp.mjs <teller-2025.txt>'); process.exit(1); }
const lines = readFileSync(src, 'utf8').split(/\r?\n/).map((l) => l.trim());

/* the five tables: "NAME 12 524.838 Extreme", with long names wrapped onto the line above */
const rows = []; let district = null, carry = '';
for (const l of lines) {
  const t = /^Table \d+:\s*(.+?)\s*(Areas Assessed|Community Assessments)$/i.exec(l);
  if (t) { district = t[1].replace(/\s+/g, ' '); carry = ''; continue; }
  if (!district) continue;
  if (/Results\b/.test(l) || /assessments completed/i.test(l)) { if (/Results/.test(l)) district = null; carry = ''; continue; }
  const m = /^(.*?)\s*(\d+)\s+([\d.]+)\s+(Extreme|Severe|High)\s*$/.exec(l);
  if (m) {
    const name = (carry + ' ' + m[1]).replace(/\s+/g, ' ').trim();
    rows.push({ name, structures: +m[2], acres: Math.round(+m[3]), rating: m[4], district });
    carry = '';
  } else if (/^[A-Z0-9][A-Z0-9 '\-&.]+$/.test(l) && l !== 'TELLER COUNTY' && l !== 'COLORADO' && !/^Community Structures/.test(l)) carry = (carry + ' ' + l).trim();
  else carry = '';
}
writeFileSync(join(HERE, 'cwpp-teller-2025.json'), JSON.stringify({ source: 'Teller County CWPP 2025 (Colorado State Forest Service), Tables 7-11', url: 'https://csfs.colostate.edu/wp-content/uploads/2026/05/Teller-County-CWPP_2025.pdf', rows }, null, 1));
const count = rows.reduce((o, r) => ((o[r.rating] = (o[r.rating] || 0) + 1), o), {});
console.log(`${rows.length} rated communities read`, count);

/* our Teller place names */
const norm = (s) => String(s).toUpperCase().replace(/['.]/g, '').replace(/\b(AREA|ZONE \d+|FILING \d+|FLG \d+|SUBDIVISION|SUB|UNIT \d+|ESTATES?)\b/g, ' ').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const places = new Set();
for (const town of ['woodland-park', 'divide', 'florissant', 'cripple-creek']) {
  const f = join(SITE, `${town}.json`); if (!existsSync(f)) continue;
  for (const a of JSON.parse(readFileSync(f, 'utf8')).areas) if (a.place && a.place.n) places.add(a.place.n);
}
const rank = { Extreme: 3, Severe: 2, High: 1 };
const out = {};
for (const p of places) {
  const np = norm(p); if (!np) continue;
  const hits = rows.filter((r) => { const nr = norm(r.name.replace(/ - /g, ' ')); return nr && (nr === np || (nr.split(' ').length >= 2 && ` ${np} `.includes(` ${nr} `))); });   /* a partial match needs two words: EVERGREEN alone is not EVERGREEN HEIGHTS */
  if (!hits.length) continue;
  const best = hits.sort((a, b) => rank[b.rating] - rank[a.rating] || b.structures - a.structures)[0];
  out[p.toLowerCase()] = { rating: best.rating, plan: 'Teller County CWPP 2025', community: best.name, district: best.district };
}
writeFileSync(join(SITE, 'cwpp.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), sources: ['Teller County CWPP 2025, Colorado State Forest Service, Tables 7-11'], places: out }));
console.log(`${Object.keys(out).length} of ${places.size} Teller neighbourhood names matched a rated community`);
for (const [k, v] of Object.entries(out)) console.log(`  ${k}  ->  ${v.community} (${v.rating})`);

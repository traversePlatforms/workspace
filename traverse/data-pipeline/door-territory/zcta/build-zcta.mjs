/* ZIP search in the town list (TR-47, 2026-10-31): the middle and rough size of every ZIP Code Tabulation Area in the install's state, from the
   U.S. Census Bureau's Gazetteer file, written into the app page between the zcta:start and zcta:end markers as TR_ZIP.
   Usage: node build-zcta.mjs <path to YYYY_Gaz_zcta_national.txt>
   One entry per ZCTA: "ZIP:lat,lon,r" where r is the radius in miles of a circle with the ZCTA's land and water area. The page lists the
   neighbourhoods whose centre lies within r (plus a little) of the ZIP's internal point; it never says a house is in a ZIP. See README.md. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, '../../../app/summit-de59ae83/index.html');
/* the ZIP ranges by state (USPS: Colorado 800-816). A second state's market adds its line here. */
const STATES = { CO: [80000, 81699] };
const src = process.argv[2];
if (!src) { console.error('usage: node build-zcta.mjs <YYYY_Gaz_zcta_national.txt>'); process.exit(1); }
const lines = readFileSync(src, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const sep = lines[0].includes('|') ? '|' : '\t';
const head = lines[0].split(sep).map((h) => h.trim());
const col = (n) => { const i = head.indexOf(n); if (i < 0) throw new Error('no column ' + n); return i; };
const [G, AL, AW, LA, LO] = ['GEOID', 'ALAND_SQMI', 'AWATER_SQMI', 'INTPTLAT', 'INTPTLONG'].map(col);
const out = {};
for (const st of Object.keys(STATES)) out[st] = [];
for (const l of lines.slice(1)) {
  const c = l.split(sep).map((x) => x.trim()); const z = +c[G];
  for (const [st, [lo, hi]] of Object.entries(STATES)) {
    if (z < lo || z > hi) continue;
    const r = Math.max(0.3, Math.sqrt((+c[AL] + +c[AW]) / Math.PI));
    out[st].push(`${c[G]}:${(+c[LA]).toFixed(3)},${(+c[LO]).toFixed(3)},${r.toFixed(1)}`);
  }
}
const line = 'var TR_ZIP = { ' + Object.entries(out).map(([st, a]) => `${st}: '${a.join(';')}'`).join(', ') + ' };';
let page = readFileSync(PAGE, 'utf8');
const A = '/* zcta:start */', B = '/* zcta:end */', i = page.indexOf(A), j = page.indexOf(B);
if (i < 0 || j < i) throw new Error('no zcta markers in the page');
page = page.slice(0, i + A.length) + '\n  ' + line + '\n  ' + page.slice(j);
writeFileSync(PAGE, page);
console.log(Object.entries(out).map(([st, a]) => `${st}: ${a.length} ZIPs`).join(', ') + ', ' + line.length + ' characters, into ' + PAGE);

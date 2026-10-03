/* Sixfold — builds the server-side door data for sixfoldcolorado.com/rounds/.
   2026-09-29 (TASKS.md SX-9c, phase 1).

   Reads the SAME neighbourhood sidecars the printed sheets and the Claude
   artifact use, so all three name the same pockets and use the same door ids.
   One clustering implementation, three consumers.

   Writes into sixfold/site/data/rounds/, which the server reads and NEVER
   serves directly — see the .htaccess written beside it.

   Run:  node build-walklist-pdf.mjs <each csv>   # the sidecars
         node build-rounds-data.mjs                                            */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'site', 'data', 'rounds');
const SOURCES = [
  ['monument', 'Monument', 'monument-areas.json'],
  ['palmer-lake', 'Palmer Lake', 'palmer-lake-areas.json'],
  ['black-forest', 'Black Forest', 'black-forest-areas.json'],
  ['castle-rock', 'Castle Rock', 'castle-rock-areas.json'],
  ['larkspur', 'Larkspur', 'larkspur-areas.json'],
  ['sedalia', 'Sedalia', 'sedalia-areas.json'],
  ['franktown', 'Franktown', 'franktown-areas.json'],
  ['woodland-park', 'Woodland Park', 'woodland-park-areas.json'],
  ['divide', 'Divide', 'divide-areas.json'],
  ['florissant', 'Florissant', 'florissant-areas.json'],
  ['cripple-creek', 'Cripple Creek', 'cripple-creek-areas.json'],
];

/* same slug rule as build-walk-tool.mjs, so a door has one id everywhere */
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

mkdirSync(OUT, { recursive: true });

/* Wildfire hazard class per door, from sample-wildfire.mjs (USFS WHP 2023).
   Keyed by coordinate. Missing cache = no badges; nothing else changes. */
const FIRE_CACHE = join(HERE, 'wildfire-cache.json');
const fireByCoord = existsSync(FIRE_CACHE) ? JSON.parse(readFileSync(FIRE_CACHE, 'utf8')) : {};
const fireOf = (d) => (typeof d.la === 'number' && typeof d.lo === 'number') ? (fireByCoord[`${d.la},${d.lo}`] ?? null) : null;

/* Lawn per door, from lawn-trial/sample-lawn.mjs (2023 NAIP + canopy height; SX-19).
   Shown as a LEVEL, never square feet: the method reads open lots ~8% high and lawn
   under mature trees 20-45% low (LAWN-SIZE.md). Cut-offs set against four
   hand-measured lots; crews correct them in the app, and those corrections are the
   calibration data.
     T mostly trees : more than 60% of the lot under trees and under 1,500 sq ft seen
     N little lawn  : under 300 sq ft     S small : 300-1,199
     M medium       : 1,200-2,999         L large : 3,000 and up
   sq is kept (rounded to 100) for the export and calibration; the app never shows it. */
const LAWN_CACHE = join(HERE, 'lawn-cache.json');
const lawnByCoord = existsSync(LAWN_CACHE) ? JSON.parse(readFileSync(LAWN_CACHE, 'utf8')) : {};
function lawnOf(d) {
  const c = typeof d.la === 'number' ? lawnByCoord[`${d.la},${d.lo}`] : null;
  if (!c || c.err) return null;
  const lv = c.t > 0.6 && c.s < 1500 ? 'T' : c.s < 300 ? 'N' : c.s < 1200 ? 'S' : c.s < 3000 ? 'M' : 'L';
  return { lv, sq: Math.round(c.s / 100) * 100, yr: +String(c.d).slice(0, 4) };
}

/* Trees near the house, from tree-zones/sample-trees.mjs (2026-10-02). Tree-cover share of
   the lot in the state defensible-space zones: z1 0-5 ft, z2 5-30 ft, z3 30-100 ft; h =
   tallest tree within 30 ft (m). src 'lidar' (USGS 3DEP, El Paso 2018 / Douglas 2020) or
   'canopy' (Meta canopy map, Teller — undercounts). */
const TREE_CACHE = join(HERE, 'tree-cache.json');
const treeByCoord = existsSync(TREE_CACHE) ? JSON.parse(readFileSync(TREE_CACHE, 'utf8')) : {};
function treesOf(d) {
  const c = typeof d.la === 'number' ? treeByCoord[`${d.la},${d.lo}`] : null;
  if (!c || c.err || c.z2 == null) return null;
  return { z1: c.z1 ?? 0, z2: c.z2, z3: c.z3 ?? null, h: c.h ?? 0, src: c.src === 'lidar' ? 'lidar' : 'canopy', yr: c.yr ?? null };
}

/* Neighbourhood place name and nearby Firewise communities, from sample-hoa.mjs (2026-10-02).
   place: the most common subdivision (Teller, Douglas) or metro district (El Paso) among the
   neighbourhood's doors, when at least 40% share it. Filing and phase suffixes are dropped,
   so "CASTLE OAKS FLG 3" and "CASTLE OAKS FLG 4" count as one.
   fw: Firewise sites within 600 m of at least 3 doors, or of a fifth of them. */
const HOA_CACHE = join(HERE, 'hoa-cache.json');
const hoaByCoord = existsSync(HOA_CACHE) ? JSON.parse(readFileSync(HOA_CACHE, 'utf8')) : {};
function cleanPlace(s) {
  let t = String(s || '').toUpperCase()
    .replace(/\s+(MD|METRO(POLITAN)? DIST(RICT)?)(\s*(NO\.?|#)?\s*\d+)?(\s*--.*)?$/, '')
    .replace(/\s+(FLG|FIL|FILING|PH|PHASE|UNIT|TRACT|SEC|SECTION|AMD|AMENDED|REPLAT|REPLT|RESUB|SUB|SUBDIVISION)\b.*$/, '')
    .replace(/\s+(NO\.?|#)\s*\d+.*$/, '').replace(/\s+\d+$/, '').trim();
  t = t.replace(/^(.*?),?\s+THE$/, 'THE $1');                       /* assessor style: "MEADOWS THE" */
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
function placeOf(doors) {
  const c = new Map(); let kind = 'sub';
  for (const d of doors) {
    const h = typeof d.la === 'number' ? hoaByCoord[`${d.la},${d.lo}`] : null;
    const raw = h && (h.sub || h.metro); if (!raw) continue;
    if (!h.sub) kind = 'metro';
    const n = cleanPlace(raw); if (n) c.set(n, (c.get(n) || 0) + 1);
  }
  let best = null, bn = 0; for (const [n, k] of c) if (k > bn) { bn = k; best = n; }
  return best && bn / doors.length >= 0.4 ? { n: best, k: kind, s: +(bn / doors.length).toFixed(2) } : null;
}
function firewiseOf(doors) {
  const c = new Map();
  const short = (n) => n.replace(/\bHome\s?owners'?\s+Association\b/i, 'HOA').replace(/\bProperty\s+Owners'?\s+Association\b/i, 'POA');
  for (const d of doors) { const h = typeof d.la === 'number' ? hoaByCoord[`${d.la},${d.lo}`] : null; if (h && h.fw) { const n = short(h.fw); c.set(n, (c.get(n) || 0) + 1); } }
  const out = [...c].filter(([, k]) => k >= 3 || k / doors.length >= 0.2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, k]) => ({ n, d: k }));
  return out.length ? out : null;
}

const index = [];
for (const [key, label, fileName] of SOURCES) {
  const p = join(HERE, fileName);
  if (!existsSync(p)) { console.log(`skipping ${label} — no ${fileName}`); continue; }
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const seen = new Set();
  const areas = j.areas.map((a) => ({
    name: a.name,
    avg: a.avg ? +a.avg.toFixed(2) : null,
    place: placeOf(a.doors),
    fw: firewiseOf(a.doors),
    doors: a.doors.map((d) => {
      let id = slug(d.a);
      while (seen.has(id)) id += 'x';
      seen.add(id);
      return { id, address: d.a, acres: d.ac, owner: d.o, lat: d.la ?? null, lon: d.lo ?? null, fire: fireOf(d), lawn: lawnOf(d), trees: treesOf(d) };
    }),
  }));
  writeFileSync(join(OUT, `${key}.json`), JSON.stringify({ key, label, built: j.built, areas }), 'utf8');
  index.push({ key, label, areas: areas.length, doors: areas.reduce((s, a) => s + a.doors.length, 0) });
  console.log(`${key}.json  ${areas.length} areas, ${index[index.length - 1].doors} doors`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ regions: index, built: new Date().toISOString().slice(0, 10) }), 'utf8');

/* Kept only as a second line of defence. ⚑ On 2026-09-29 SiteGround did NOT honour
   this deny — the JSON was served at 200 while the .htaccess itself returned 403.
   The real protection is that these files now live outside the document root. */
writeFileSync(join(OUT, '.htaccess'), `# Door lists and the marks log. Read by api/rounds.php ONLY — never served.
# Each file holds names and home addresses; a directory listing would be worse
# than any single file.
Require all denied
<FilesMatch ".*">
  Require all denied
</FilesMatch>
`, 'utf8');

console.log(`\nwrote ${index.length} region files + index.json + .htaccess into site/data/rounds/`);
console.log('⚑ These go OUTSIDE public_html on the host — see site/rounds/DEPLOY-ROUNDS.md.');

/* Sixfold — builds the server-side door data for sixfoldcolorado.com/rounds/.
   2026-09-29 (TASKS.md SX-9c, phase 1).

   Reads the SAME neighbourhood sidecars the printed sheets and the Claude
   artifact use, so all three name the same pockets and use the same door ids.
   One clustering implementation, three consumers.

   Writes into door-app/site/data/rounds/, which the server reads and NEVER
   serves directly — see the .htaccess written beside it.

   Run:  node build-walklist-pdf.mjs <each csv>   # the sidecars
         node build-rounds-data.mjs                                            */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSale } from './owner-names.mjs';

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
  /* c.c (2026-10-03): the COMPACT lawn, only patches of 400+ sq ft within 30 m of the house
     (lawn-trial/sample-lawn-compact.mjs). A blind visual check found the raw figure counting
     specks between trees and shrubs on big lots as a "Large" lawn where there was none.
     Measured for Medium and Large doors only, since the rule can only shrink a lawn. */
  const s = c.c ?? c.s;
  const lv = c.t > 0.6 && s < 1500 ? 'T' : s < 300 ? 'N' : s < 1200 ? 'S' : s < 3000 ? 'M' : 'L';
  return { lv, sq: Math.round(s / 100) * 100, yr: +String(c.d).slice(0, 4) };
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

/* County appraised value (sample-value.mjs, 2026-10-03): the assessor's total value for the
   parcel, Douglas and Teller only — El Paso's layer carries none. A rough qualifier for whether
   a bigger job is plausible, nothing more. */
const VALUE_CACHE = join(HERE, 'value-cache.json');
const valueByCoord = existsSync(VALUE_CACHE) ? JSON.parse(readFileSync(VALUE_CACHE, 'utf8')) : {};
function valueOf(d) {
  const c = typeof d.la === 'number' ? valueByCoord[`${d.la},${d.lo}`] : null;
  return c && c.v > 0 ? c.v : null;
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

/* ---- one town per door (2026-10-03) ----------------------------------------
 * The town search circles overlap: every Palmer Lake door was ALSO in Monument, and Castle
 * Rock shared doors with Franktown and Sedalia (958 in all). Each copy kept its own marks,
 * so a door marked under one town still showed open under the other. Now a door listed by
 * two towns goes to the town whose centre is nearest, and is dropped from the other.
 * Ids are made exactly as before (per town, in order) and only then filtered, so no door's
 * id changes. The pairs go into index.json "shared": the server reads a town's logs together
 * with its partners', so what was recorded under the other town follows the door. The pairs
 * are kept in shared-towns.json and only ever added to: old rows stay in the old file. */
const CENTRE = {
  monument: [39.0917, -104.8722], 'palmer-lake': [39.1222, -104.9169], 'black-forest': [39.0138, -104.7025],
  'castle-rock': [39.3722, -104.8561], larkspur: [39.2311, -104.8747], sedalia: [39.4386, -104.9614],
  franktown: [39.3894, -104.7519], 'woodland-park': [39.0000, -105.0569], divide: [38.9469, -105.1636],
  florissant: [38.9469, -105.2911], 'cripple-creek': [38.7466, -105.1783],
};
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111, (lo1 - lo2) * 111 * Math.cos((la1 * Math.PI) / 180));
const built = [];
for (const [key, label, fileName] of SOURCES) {
  const p = join(HERE, fileName);
  if (!existsSync(p)) { console.log(`skipping ${label} — no ${fileName}`); continue; }
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const seen = new Set();
  const areas = j.areas.map((a) => ({
    name: a.name,
    avg: a.avg ? +a.avg.toFixed(2) : null,
    src: a.doors,
    doors: a.doors.map((d) => {
      let id = slug(d.a);
      while (seen.has(id)) id += 'x';
      seen.add(id);
      return { id, address: d.a, acres: d.ac, owner: d.o, lat: d.la ?? null, lon: d.lo ?? null, fire: fireOf(d), lawn: lawnOf(d), trees: treesOf(d), val: valueOf(d) };
    }),
  }));
  built.push({ key, label, j, areas });
}
const towns = new Map();   /* id -> towns listing it */
for (const b of built) for (const a of b.areas) for (const d of a.doors) { if (!towns.has(d.id)) towns.set(d.id, []); towns.get(d.id).push(b.key); }
const SHARED_FILE = join(HERE, 'shared-towns.json');
const shared = existsSync(SHARED_FILE) ? JSON.parse(readFileSync(SHARED_FILE, 'utf8')) : {};
const addPair = (x, y) => { (shared[x] ||= []); if (!shared[x].includes(y)) shared[x].push(y); };
let moved = 0;
const owner = new Map();
for (const b of built) for (const a of b.areas) for (const d of a.doors) {
  const list = towns.get(d.id);
  if (list.length < 2 || owner.has(d.id)) continue;
  const near = list.filter((t) => CENTRE[t] && d.lat != null).sort((x, y) => km(d.lat, d.lon, ...CENTRE[x]) - km(d.lat, d.lon, ...CENTRE[y]))[0] || list[0];
  owner.set(d.id, near);
  for (const t of list) for (const u of list) if (t !== u) addPair(t, u);
}
for (const b of built) for (const a of b.areas) {
  const keep = a.doors.map((d, i) => ({ d, src: a.src[i] })).filter(({ d }) => !owner.has(d.id) || owner.get(d.id) === b.key);
  moved += a.doors.length - keep.length;
  a.doors = keep.map((x) => x.d); a.src = keep.map((x) => x.src);
}
for (const k of Object.keys(shared)) shared[k].sort();
writeFileSync(SHARED_FILE, JSON.stringify(shared, null, 2) + '\n', 'utf8');
if (owner.size) console.log(`${owner.size} doors were listed by two towns: each kept by the nearest town (${moved} copies dropped)`);

/* ---- when a house sells (2026-10-03) ---------------------------------------
 * owner-history.json remembers each door's owner across rebuilds. When the county record names
 * a different owner, the door gets 'os' (the date this build first saw them). County records
 * carry no sale date (measured 2026-10-01), so the sale happened somewhere before 'os': the
 * door also gets 'oa', the day before which records are surely the previous owner's — 45 days
 * (the county's recording lag) before the last build that still showed the old owner, or 150
 * days before 'os' when that is unknown. The server sets aside what is older than 'oa' and
 * shows what falls between 'oa' and 'os' with "check it's the new owner's" (review 2026-10-03:
 * treating everything before the build date as the old owner's set aside the new owner's own
 * Quote booked whenever we had knocked between the sale and the re-pull). A change only counts
 * when the old and new names share NO name at all, so a spouse added, a move into a family
 * trust, or a record written differently is not a sale. The first build only records owners. */
/* ⚑ gitignored, like every list of named people here — and unlike them it CANNOT be rebuilt:
   lose it and sale detection starts over. The OneDrive mirror is its backup. */
const OWNERS = join(HERE, 'owner-history.json');
const hist = existsSync(OWNERS) ? JSON.parse(readFileSync(OWNERS, 'utf8')) : {};
const firstOwnerBuild = !existsSync(OWNERS);
const buildDay = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
const dayShift = (day, n) => { const t = new Date(day + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
let newOwners = 0;
for (const b of built) for (const ar of b.areas) for (const d of ar.doors) {
  const h = hist[d.id];
  if (!h) { hist[d.id] = { o: d.owner, since: null, seen: buildDay }; continue; }
  if (isSale(h.o, d.owner)) {   /* owner-names.mjs */
    const known = h.seen && h.seen < buildDay;
    (h.prev ||= []).push({ o: h.o, until: buildDay });
    h.since = buildDay;
    h.oa = known ? dayShift(h.seen, -45) : dayShift(buildDay, -150);
    newOwners++;
  }
  h.o = d.owner; h.seen = buildDay;
  if (h.since) { d.os = h.since; d.oa = h.oa || dayShift(h.since, -150); }
}
writeFileSync(OWNERS, JSON.stringify(hist), 'utf8');
console.log(firstOwnerBuild ? `owner history started: ${Object.keys(hist).length} doors recorded (changes are detected from the next rebuild)` : `${newOwners} doors have a new owner since the last rebuild`);

const index = [];
for (const { key, label, j, areas: raw } of built) {
  const areas = raw.filter((a) => a.doors.length).map((a) => ({ name: a.name, avg: a.avg, place: placeOf(a.src), fw: firewiseOf(a.src), doors: a.doors }));
  writeFileSync(join(OUT, `${key}.json`), JSON.stringify({ key, label, built: j.built, areas }), 'utf8');
  index.push({ key, label, areas: areas.length, doors: areas.reduce((s, a) => s + a.doors.length, 0) });
  console.log(`${key}.json  ${areas.length} areas, ${index[index.length - 1].doors} doors`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ regions: index, shared, built: new Date().toISOString().slice(0, 10) }), 'utf8');

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

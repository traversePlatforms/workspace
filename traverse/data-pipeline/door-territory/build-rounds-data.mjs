/* Sixfold — builds the server-side door data for sixfoldcolorado.com/rounds/.
   2026-09-29 (TASKS.md SX-9c, phase 1).

   Reads the SAME neighbourhood sidecars the printed sheets and the Claude
   artifact use, so all three name the same pockets and use the same door ids.
   One clustering implementation, three consumers.

   Writes into traverse/app/data/rounds/, which the server reads and NEVER
   serves directly — see the .htaccess written beside it.

   Run:  node build-walklist-pdf.mjs <each csv>   # the sidecars
         node build-rounds-data.mjs                                            */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSale } from './owner-names.mjs';
import { metroTowns } from './metros/registry.mjs';   /* towns outside Colorado from metros/<metro>.json (2026-10-11) */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'app', 'data', 'rounds');
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
  /* north Douglas (2026-10-07, Matthew: three more high-lawn places). The group keeps them out of any company that does not
     list it in company.json "townGroups" (Sixfold does not: they are outside its area, Brandon's call); the editions do. */
  ['highlands-ranch', 'Highlands Ranch', 'highlands-ranch-areas.json', 'north-douglas'],
  ['parker', 'Parker', 'parker-areas.json', 'north-douglas'],
  ['castle-pines', 'Castle Pines', 'castle-pines-areas.json', 'north-douglas'],
  /* each edition's own best towns (2026-10-07, traverse/research/edition-towns-2026-10.md): the group is the town itself, and each
     edition's company.json townGroups names the ones it carries (Roofing: the hail towns; Solar; Pest; Security: police data) */
  /* Colorado Springs as four towns of 24,000-31,000 doors (east and west split at -104.76, then north and south at each half's middle) */
  ['cs-northeast', 'Colorado Springs Northeast', 'cs-northeast-areas.json', 'cs-northeast'],
  ['cs-southeast', 'Colorado Springs Southeast', 'cs-southeast-areas.json', 'cs-southeast'],
  ['security-widefield', 'Security-Widefield', 'security-widefield-areas.json', 'security-widefield'],
  ['fountain', 'Fountain', 'fountain-areas.json', 'fountain'],
  ['arvada', 'Arvada', 'arvada-areas.json', 'arvada'],
  ['centennial', 'Centennial', 'centennial-areas.json', 'centennial'],
  ['thornton', 'Thornton', 'thornton-areas.json', 'thornton'],
  ['windsor', 'Windsor', 'windsor-areas.json', 'windsor'],
  ['erie', 'Erie', 'erie-areas.json', 'erie'],
  ['commerce-city', 'Commerce City', 'commerce-city-areas.json', 'commerce-city'],
  ['denver', 'Denver', 'denver-areas.json', 'denver'],
  ['cs-northwest', 'Colorado Springs Northwest', 'cs-northwest-areas.json', 'cs-northwest'],
  ['cs-southwest', 'Colorado Springs Southwest', 'cs-southwest-areas.json', 'cs-southwest'],
  ['boulder', 'Boulder', 'boulder-areas.json', 'boulder'],
  ['aurora', 'Aurora', 'aurora-areas.json', 'aurora'],
  ['south-denver', 'South Denver', 'south-denver-areas.json', 'south-denver'],   /* 2026-10-12: 2.5 mi around S Pearl St & Iliff, Denver addresses (a Sixfold rep working there) */
  ['englewood', 'Englewood', 'englewood-areas.json', 'englewood'],
  /* 2026-10-15: the 365 Aeration 45-mile area (Matthew: every town within 45 miles of Englewood); door lists by legal boundary, run-overnight-2026-10-14.sh */
  ['littleton', 'Littleton', 'littleton-areas.json', 'littleton'],
  ['lakewood', 'Lakewood', 'lakewood-areas.json', 'lakewood'],
  ['greenwood-village', 'Greenwood Village', 'greenwood-village-areas.json', 'greenwood-village'],
  ['cherry-hills-village', 'Cherry Hills Village', 'cherry-hills-village-areas.json', 'cherry-hills-village'],
  ['sheridan', 'Sheridan', 'sheridan-areas.json', 'sheridan'],
  ['lone-tree', 'Lone Tree', 'lone-tree-areas.json', 'lone-tree'],
  ['wheat-ridge', 'Wheat Ridge', 'wheat-ridge-areas.json', 'wheat-ridge'],
  ['edgewater', 'Edgewater', 'edgewater-areas.json', 'edgewater'],
  ['golden', 'Golden', 'golden-areas.json', 'golden'],
  ['westminster', 'Westminster', 'westminster-areas.json', 'westminster'],
  ['broomfield', 'Broomfield', 'broomfield-areas.json', 'broomfield'],
  ['northglenn', 'Northglenn', 'northglenn-areas.json', 'northglenn'],
  ['federal-heights', 'Federal Heights', 'federal-heights-areas.json', 'federal-heights'],
  ['brighton', 'Brighton', 'brighton-areas.json', 'brighton'],
  ['louisville', 'Louisville', 'louisville-areas.json', 'louisville'],
  ['lafayette', 'Lafayette', 'lafayette-areas.json', 'lafayette'],
  ['superior', 'Superior', 'superior-areas.json', 'superior'],
  ['longmont', 'Longmont', 'longmont-areas.json', 'longmont'],
  ['walden', 'Walden', 'walden-areas.json', 'walden'],   /* 2026-10-12: 0.75 mi around Deboodt Ct (Walden, Black Forest), a Sixfold job's neighbourhood; El Paso */   /* 2026-10-12: the city by its legal boundary, Arapahoe */   /* 2026-10-12: the largest untapped market (research/markets/yards-markets-2026-10.md); Arapahoe + Adams */
];
for (const t of metroTowns()) SOURCES.push([t.key, t.label, t.areas, t.group]);   /* the metro builder: each metro is its own group */

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
/* Common ground (2026-10-13, Matthew: "when the lawn doesn't belong to the owner and it belongs to the HOA ... how is that displayed"):
   a townhome or patio-home lot, where the property line hugs the building and the grass around it is the HOA's. Read from the lot's
   size (lawn-cache) and the house outline's area (tree-cache hs, sq ft): the outline is as big as the lot or bigger (a townhome row's
   outline spans several owners' lots), or under 400 sq ft of the lot is left open. Checked against the photos 2026-10-13: a first rule
   (coverage over 55% of a lot under 4,500 sq ft) caught Denver's narrow city lots, which have their own back yards; open ground does
   not. Under 1% of doors in most towns, 1.5-2% in the Springs. The crew can correct the lawn on the card. */
/* El Paso County only (checked 2026-10-13): in the Denver-metro towns the building outlines often merge a house with its garage or the
   house next door, so narrow city lots with their own yards read as townhomes. The Springs photos matched the rule; Denver's did not. */
const CG_TOWNS = new Set(Object.entries(JSON.parse(readFileSync(join(HERE, '..', '..', 'app', 'data', 'rounds', 'docs', 'money.json'), 'utf8')).counties || {}).filter(([, c]) => c === 'elpaso').map(([t]) => t));
function commonGround(d, key) {
  if (typeof d.la !== 'number' || !CG_TOWNS.has(key)) return false;
  const L = lawnByCoord[`${d.la},${d.lo}`], T = treeByCoord[`${d.la},${d.lo}`];
  if (!L || !L.lot || !T || T.err || !T.hs) return false;
  const cov = T.hs / L.lot;
  return cov >= 1.0 || L.lot - T.hs < 400;
}
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
  'highlands-ranch': [39.540, -104.985], parker: [39.515, -104.765], 'castle-pines': [39.455, -104.895],
  'aurora': [39.69, -104.78],   'broomfield': [39.92, -105.07],   'northglenn': [39.9, -104.98],   'federal-heights': [39.865, -105.015],   'brighton': [39.98, -104.8],   'louisville': [39.975, -105.14],   'lafayette': [39.995, -105.1],   'superior': [39.93, -105.16],   'longmont': [40.17, -105.1],   'littleton': [39.605, -105.01],   'lakewood': [39.705, -105.1],   'greenwood-village': [39.615, -104.92],   'cherry-hills-village': [39.64, -104.955],   'sheridan': [39.647, -105.025],   'lone-tree': [39.54, -104.885],   'wheat-ridge': [39.77, -105.1],   'edgewater': [39.753, -105.064],   'golden': [39.745, -105.21],   'westminster': [39.865, -105.05],   'south-denver': [39.676, -104.98],   'englewood': [39.648, -104.988],   'walden': [39.0858, -104.7567],   'cs-northeast': [38.95, -104.70],   'cs-southeast': [38.86, -104.71],   'security-widefield': [38.75, -104.73],   'fountain': [38.69, -104.7],   'arvada': [39.83, -105.1],   'centennial': [39.59, -104.85],   'thornton': [39.9, -104.96],   'windsor': [40.48, -104.9],   'erie': [40.04, -105.05],   'commerce-city': [39.86, -104.85],   'denver': [39.72, -104.92],   'cs-northwest': [38.92, -104.82],   'cs-southwest': [38.81, -104.81],   'boulder': [40.015, -105.255],
};
for (const t of metroTowns()) if (t.center) CENTRE[t.key] = t.center;
const METRO_TOWN = Object.fromEntries(metroTowns().map((t) => [t.key, t]));
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111, (lo1 - lo2) * 111 * Math.cos((la1 * Math.PI) / 180));
const built = [];
for (const [key, label, fileName, group] of SOURCES) {
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
      return { id, address: d.a, acres: d.ac, owner: d.o, lat: d.la ?? null, lon: d.lo ?? null, fire: fireOf(d), lawn: lawnOf(d), trees: treesOf(d), val: valueOf(d), ...(commonGround(d, key) ? { cg: 1 } : {}) };
    }),
  }));
  built.push({ key, label, group, j, areas });
}
const groupOf = Object.fromEntries(built.map((b) => [b.key, b.group || null]));
/* id -> towns listing it AS THE SAME HOUSE (2026-10-10). Ids come from the street address alone, so "100 Main St" in Denver and
   in Fountain made the same id: 58 different houses were each dropped from one town, and 20 town pairs that share no house were
   linked, so their logs could read into each other. A listing counts as the same door only within 150 m of the first. */
const SAME_KM = 0.15;
const towns = new Map(), firstAt = new Map();
for (const b of built) for (const a of b.areas) for (const d of a.doors) {
  const p = firstAt.get(d.id);
  if (!p) { firstAt.set(d.id, d); towns.set(d.id, [b.key]); continue; }
  const same = p.lat != null && d.lat != null ? km(p.lat, p.lon, d.lat, d.lon) < SAME_KM : false;
  if (same && !towns.get(d.id).includes(b.key)) towns.get(d.id).push(b.key);
}
const SHARED_FILE = join(HERE, 'shared-towns.json');
const shared = existsSync(SHARED_FILE) ? JSON.parse(readFileSync(SHARED_FILE, 'utf8')) : {};
const addPair = (x, y) => { (shared[x] ||= []); if (!shared[x].includes(y)) shared[x].push(y); };
/* a pair stays only where the two towns really share houses; the false pairs the address-only ids made go (no history can depend
   on a pair with no shared house: a door's rows only ever moved between two listings of that same house) */
const realPair = new Set();
for (const list of towns.values()) if (list.length > 1) for (const t of list) for (const u of list) if (t !== u) realPair.add(t + '|' + u);
let pruned = 0;
for (const k of Object.keys(shared)) { const keep = shared[k].filter((u) => realPair.has(k + '|' + u)); pruned += shared[k].length - keep.length; if (keep.length) shared[k] = keep; else delete shared[k]; }
if (pruned) console.log(`${pruned / 2} town pairs unlinked: they share no house, only street addresses`);
let moved = 0;
const owner = new Map();
for (const b of built) for (const a of b.areas) for (const d of a.doors) {
  const list = towns.get(d.id);
  if (list.length < 2 || owner.has(d.id) || !list.includes(b.key)) continue;
  /* a town in a group (editions only) never takes a door from a town without one: Sixfold would lose it (2026-10-07) */
  const ungrouped = list.filter((t) => !groupOf[t]), pool = ungrouped.length ? ungrouped : list;
  const near = pool.filter((t) => CENTRE[t] && d.lat != null).sort((x, y) => km(d.lat, d.lon, ...CENTRE[x]) - km(d.lat, d.lon, ...CENTRE[y]))[0] || pool[0];
  owner.set(d.id, near);
  for (const t of list) for (const u of list) if (t !== u) addPair(t, u);
}
for (const b of built) for (const a of b.areas) {
  /* a door whose town is not among its id's same-house listings is a different house with the same address: it stays */
  const keep = a.doors.map((d, i) => ({ d, src: a.src[i] })).filter(({ d }) => !owner.has(d.id) || owner.get(d.id) === b.key || !towns.get(d.id).includes(b.key));
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
for (const { key, label, group, j, areas: raw } of built) {
  const areas = raw.filter((a) => a.doors.length).map((a) => ({ name: a.name, avg: a.avg, place: placeOf(a.src), fw: firewiseOf(a.src), doors: a.doors }));
  writeFileSync(join(OUT, `${key}.json`), JSON.stringify({ key, label, built: j.built, areas }), 'utf8');
  /* c: the town's centre, where the server asks the weather service for alerts (2026-10-07) */
  const mt = METRO_TOWN[key];   /* a metro town carries its metro and county (2026-10-11): the editions need the county */
  index.push({ key, label, ...(group ? { group } : {}), ...(mt ? { metro: mt.metro, county: mt.county } : {}), ...(CENTRE[key] ? { c: CENTRE[key] } : {}), areas: areas.length, doors: areas.reduce((s, a) => s + a.doors.length, 0) });
  console.log(`${key}.json  ${areas.length} areas, ${index[index.length - 1].doors} doors`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ regions: index, shared, built: new Date().toISOString().slice(0, 10) }), 'utf8');

/* ---- the office lookup's extra homes (2026-10-14, build-lookup.mjs) ----
 * Homes on a town's CSV but not its door list: rented ones, mostly. Written as <town>-lookup.json, a flat list the server reads
 * only for the office's House lookup; door lists, the crew's search and every count above never see them. A home that is a door
 * in any town (within 150 m) is left out, so nothing is listed twice. */
const doorAt = new Map(); for (const b of built) for (const a of b.areas) for (const d of a.doors) (doorAt.get(d.id) || doorAt.set(d.id, []).get(d.id)).push(d);
let lookTotal = 0;
for (const { key } of built) {
  const p = join(HERE, `${key}-lookup-areas.json`); if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8')), seen = new Set(), doors = [];
  for (const d of j.areas.flatMap((a) => a.doors)) {
    const id = slug(d.a); if (seen.has(id)) continue;
    if ((doorAt.get(id) || []).some((x) => x.lat == null || d.la == null || km(x.lat, x.lon, d.la, d.lo) < SAME_KM)) continue;
    seen.add(id);
    doors.push({ id, address: d.a, acres: d.ac, owner: d.o, lat: d.la ?? null, lon: d.lo ?? null, fire: fireOf(d), lawn: lawnOf(d), trees: treesOf(d), val: valueOf(d), ...(d.rent ? { rent: 1 } : {}) });
  }
  writeFileSync(join(OUT, `${key}-lookup.json`), JSON.stringify({ key, built: j.built, doors }), 'utf8');
  lookTotal += doors.length;
}
if (lookTotal) console.log(`office lookup: ${lookTotal} homes not on the door lists (<town>-lookup.json)`);

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

console.log(`\nwrote ${index.length} region files + index.json + .htaccess into app/data/rounds/`);
console.log('⚑ These go OUTSIDE public_html on the host — see site/rounds/DEPLOY-ROUNDS.md.');

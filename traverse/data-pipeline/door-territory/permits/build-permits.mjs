/* permit-<town>.json for the app (2026-10-07): each door's latest re-roof permit and whether it has a solar permit, from
 * pprbd-permits.json (Pikes Peak Regional Building: El Paso towns, matched on the parcel number through the town lists) and
 * douglas-permits.json (Douglas County's own permits: Highlands Ranch, Sedalia, Franktown, Larkspur, matched on the street
 * address). Castle Rock, Parker, Castle Pines and the Teller and metro towns are not covered yet: they permit for themselves.
 *   doors: { id: { r: 'YYYY-MM' latest re-roof, m: roof material on that permit (Douglas), s: 'YYYY-MM' solar permit,
 *                  so: 'YYYY-MM' solar removed after that } }
 * A solar "remove and replace" counts as both: panels came off for a re-roof and went back on.
 *
 * 2026-10-29 (Matthew: permits per trade in the editions): the other kinds the departments record (kinds.mjs), each door keeping the
 * latest month of each: n new building, a addition, pl pool, f fence, d deck or patio cover, ir irrigation, ld landscaping. And the
 * cities that publish permits as open data (fetch-open.mjs): Denver (new building and addition only), Aurora, Boulder, Longmont.
 * permit-index.json gains kinds: what the town's source records at all, so the card only says "no re-roof permit since ..." where
 * re-roofs are recorded (Denver publishes none). Each edition gets only the keys it shows (build-editions.cjs, permitKeys).
 * Street addresses match exactly first, then without the N/S/E/W after the number when only one door in the town has that street.
 * TRAVERSE_MAIN=<repo root> reads and writes that tree's data (from a worktree).
 *   node build-permits.mjs */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normAddr } from './fetch-douglas.mjs';
import { DOOR_KEY } from './kinds.mjs';

const CODE = dirname(fileURLToPath(import.meta.url));
const HERE = process.env.TRAVERSE_MAIN ? join(process.env.TRAVERSE_MAIN, 'traverse', 'data-pipeline', 'door-territory', 'permits') : CODE, DT = join(HERE, '..');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
/* what each source records, so the app never reads a missing permit as "none" for a kind the source does not publish */
const ALL = ['roof', 'solar', 'new', 'add', 'pool', 'fence', 'deck', 'irr', 'land'];
/* Pikes Peak permits for all of El Paso County, and for the City of Woodland Park (2026-10-07) */
const EL_PASO = ['monument', 'palmer-lake', 'black-forest', 'cs-northeast', 'cs-southeast', 'cs-northwest', 'cs-southwest', 'security-widefield', 'fountain', 'woodland-park'];
const DOUGLAS = ['highlands-ranch', 'sedalia', 'franktown', 'larkspur'];
/* towns that sent their own permit report (2026-10-10, Matthew's records requests), matched on the street address like Douglas.
   Thornton labels re-roofs only from 2025 and solar from 2023, so a missing re-roof proves nothing there (PARTIAL). */
const CITY = { thornton: { file: 'thornton-permits.json', src: 'City of Thornton building division', kinds: ['roof', 'solar', 'new', 'add', 'deck'] },
  /* Parker's monthly reports (2023 on) carry the county parcel number, so Parker matches on it through parker.csv, like El Paso */
  parker: { file: 'parker-permits.json', src: 'Town of Parker building division', parcel: true, kinds: ['roof', 'solar'] },
  /* Centennial's public permit search (fetch-centennial.mjs), 2018 on, matched on the street address */
  centennial: { file: 'centennial-permits.json', src: 'City of Centennial building division', kinds: ['roof', 'solar'] },
  /* the open-data cities (2026-10-29, fetch-open.mjs). Denver's town list is the city and county, so its parcels cover every door
     (south-denver is Denver too); its feed has no re-roof or solar. */
  denver: { file: 'denver-permits.json', src: 'City and County of Denver (Denver Open Data Catalog, CC BY 3.0)', parcel: true, kinds: ['new', 'add'] },
  'south-denver': { file: 'denver-permits.json', src: 'City and County of Denver (Denver Open Data Catalog, CC BY 3.0)', parcel: true, kinds: ['new', 'add'] },
  aurora: { file: 'aurora-permits.json', src: 'City of Aurora (Aurora open data)', kinds: ['roof', 'solar', 'new', 'add', 'pool', 'fence', 'deck'] },
  boulder: { file: 'boulder-permits.json', src: 'City of Boulder (Boulder open data, CC0)', parcel: true, kinds: ['roof', 'solar', 'new', 'add', 'pool', 'fence', 'deck'] },
  longmont: { file: 'longmont-permits.json', src: 'City of Longmont, published by Boulder County (CC BY 4.0)', parcel: true, kinds: ['roof', 'solar', 'new', 'add', 'fence', 'deck'] } };
/* towns whose list reaches past the department's area: Woodland Park's runs into unincorporated Teller County (its own building
   department), and Larkspur is its own town. There a missing permit proves nothing, so the card never says "no permit" (full: false).
   Parker's list also takes in unincorporated Douglas County around the town, which the town's reports don't cover, and
   Centennial's was drawn by the address city, which in Arapahoe County takes in unincorporated land too. 2026-10-29: Aurora's and
   Boulder's lists are drawn by the address city as well (unincorporated land with a city address), and Longmont's feed is a rolling
   window of the last two years or so. */
const PARTIAL = new Set(['woodland-park', 'larkspur', 'thornton', 'parker', 'centennial', 'aurora', 'boulder', 'longmont']);
const SRC = { pprbd: 'Pikes Peak Regional Building Department', douglas: 'Douglas County building division' };
const KINDS = { pprbd: ALL, douglas: ['roof', 'solar', 'new', 'add', 'pool', 'fence', 'deck'] };

function parseCSV(s) {
  const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
/* key -> the permits for it, oldest first */
function index(file, keyOf) {
  const m = new Map(); if (!existsSync(join(HERE, file))) return { m, meta: null };
  const j = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  for (const p of Object.values(j.permits)) { const k = keyOf(p[0]); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  for (const v of m.values()) v.sort((a, b) => a[1].localeCompare(b[1]));
  return { m, meta: { through: j.through, since: j.since } };
}
function summary(list) {
  const o = {};
  for (const [, day, k, mat] of list) {
    const ym = day.slice(0, 7);
    if (k === 'roof' || k === 'rr') { o.r = ym; if (mat) o.m = mat; else if (k === 'rr') delete o.m; }
    if (k === 'solar' || k === 'rr') { if (!o.s) o.s = ym; delete o.so; }
    if (k === 'off' && o.s) o.so = ym;
    if (DOOR_KEY[k]) o[DOOR_KEY[k]] = ym;   /* the latest of each other kind (the list runs oldest first) */
  }
  return Object.keys(o).length ? o : null;
}
/* the street without the direction after the number ("10355 E 23RD AVE" -> "10355 23RD AVE"): a second try for address sources */
const noDir = (s) => s.replace(/^(\d+[A-Z]?)\s+(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST)\s+/, '$1 ');

const pp = index('pprbd-permits.json', (p) => p), dg = index('douglas-permits.json', (p) => p);
let tot = 0, hit = 0; const cover = {};   /* permit-index.json: which towns are covered, by whom, since and through when */
const cityIdx = {}; for (const [t, c] of Object.entries(CITY)) if (existsSync(join(HERE, c.file))) cityIdx[t] = index(c.file, (p) => p);
const byKind = {};   /* doors with each kind, all towns, for the log */
for (const town of [...EL_PASO, ...DOUGLAS, ...Object.keys(CITY)]) {
  const doorF = join(DATA, `${town}.json`), csvF = join(DT, `${town}.csv`);
  if (!existsSync(doorF)) { console.log(`  ${town}: no door file`); continue; }
  const isEP = EL_PASO.includes(town), byParcel = isEP || !!(CITY[town] && CITY[town].parcel), idx = CITY[town] ? (cityIdx[town] || {}) : isEP ? pp : dg;
  if (!idx.meta) { console.log(`  ${town}: no permits pulled`); continue; }
  let parcelOf = null;
  if (byParcel) {
    if (!existsSync(csvF)) { console.log(`  ${town}: no list`); continue; }
    const rows = parseCSV(readFileSync(csvF, 'utf8')), h = rows[0], iA = h.indexOf('address'), iP = h.indexOf('parcel');
    parcelOf = new Map(); for (const r of rows.slice(1)) if (r[iA] && r[iP]) parcelOf.set(r[iA].trim().toUpperCase(), r[iP].trim());
  }
  const d = JSON.parse(readFileSync(doorF, 'utf8')), doors = {}; let n = 0, k = 0, nr = 0, ns = 0, nx = 0;
  /* address sources: the permits' streets without a direction, where only one permit street gives that form */
  let loose = null;
  if (!byParcel) {
    const seen = new Map(); for (const key of idx.m.keys()) { const s = noDir(key); seen.set(s, seen.has(s) && seen.get(s) !== key ? null : key); }
    loose = seen;
  }
  /* and only for a door whose street-without-direction is its own in the town */
  const doorForms = new Map();
  if (!byParcel) for (const a of d.areas) for (const x of a.doors) { const s = noDir(normAddr(x.address)); doorForms.set(s, (doorForms.get(s) || 0) + 1); }
  for (const a of d.areas) for (const x of a.doors) {
    n++;
    let key = byParcel ? parcelOf.get(String(x.address).trim().toUpperCase()) : normAddr(x.address);
    if (!byParcel && key && !idx.m.has(key) && doorForms.get(noDir(key)) === 1) { const alt = loose.get(noDir(key)); if (alt) key = alt; }
    const list = key && idx.m.get(key); if (!list) continue;
    const s = summary(list); if (!s) continue;
    doors[x.id] = s; k++; if (s.r) nr++; if (s.s && !s.so) ns++;
    if (s.n || s.a || s.pl || s.f || s.d || s.ir || s.ld) nx++;
    for (const kk of Object.keys(s)) byKind[kk] = (byKind[kk] || 0) + 1;
  }
  const src = CITY[town] ? CITY[town].src : isEP ? SRC.pprbd : SRC.douglas, kinds = CITY[town] ? CITY[town].kinds : isEP ? KINDS.pprbd : KINDS.douglas;
  writeFileSync(join(DATA, `permit-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: src, since: idx.meta.since, through: idx.meta.through, kinds, doors }));
  console.log(`  permit-${town}.json: ${k} of ${n} doors have a permit (${nr} re-roofed since ${idx.meta.since.slice(0, 4)}, ${ns} with solar, ${nx} with another kind)`);
  cover[town] = { src, since: idx.meta.since, through: idx.meta.through, full: !PARTIAL.has(town), kinds };
  tot += n; hit += k;
}
writeFileSync(join(DATA, 'permit-index.json'), JSON.stringify(cover));
console.log(`${hit} of ${tot} doors in the covered towns have a permit`);
console.log('doors by kind: ' + Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', '));

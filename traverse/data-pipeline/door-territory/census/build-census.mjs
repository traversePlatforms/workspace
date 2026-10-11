/* census-<town>.json for the app (2026-10-07): the U.S. Census Bureau's American Community Survey for the block group each
 * door is in (a few hundred homes). Area facts, estimates with margins of error, said as such on the card; never the house.
 *   Data: ACS 5-year 2020-2024 (api.census.gov, the free Census key in ../census-key.txt), every block group in our counties.
 *   Shapes: TIGERweb, Census 2020 block groups (tigerweb.geo.census.gov, Tracts_Blocks layer 11; ACS 2024 uses 2020 geography).
 * Per block group:
 *   o  owner-occupied share of occupied homes (B25003)         i  median household income (B19013)
 *   y  median year built (B25035)                               v  median value of owner-occupied homes (B25077)
 *   m  median year owners moved in (B25039)                     vc vacant share of all homes (B25002)
 *   sf detached single-family share of all homes (B25024)       h  occupied homes (the base for o)
 *   node build-census.mjs [--fetch]   writes census-cache.json and app/data/rounds/census-<town>.json { ver, bgs, doors: { id: geoid } } */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metros } from '../metros/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const KEYF = join(HERE, '..', 'census-key.txt');
const KEY = process.env.CENSUS_KEY || (existsSync(KEYF) ? readFileSync(KEYF, 'utf8').trim() : '');
const YEAR = 2024, VER = 'ACS 5-year 2020–2024';
/* Adams, Arapahoe, Boulder, Broomfield, Denver, Douglas, El Paso, Jefferson, Larimer, Teller, Weld */
const COUNTIES = ['001', '005', '013', '014', '031', '035', '041', '059', '069', '119', '123'];
const VARS = ['B25003_001E', 'B25003_002E', 'B19013_001E', 'B25035_001E', 'B25077_001E', 'B25039_002E', 'B25002_001E', 'B25002_003E', 'B25024_001E', 'B25024_002E'];
const TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/11/query';

/* the metro builder (2026-10-11): METRO=<metro> fetches that metro's counties into its own cache and writes only its towns */
const METRO = process.env.METRO || '';
const MDEF = METRO ? metros().find((m) => m.key === METRO) : null;
if (METRO && !MDEF) throw new Error('no metro ' + METRO);
const METRO_GROUPS = new Set(metros().map((m) => m.group || m.key));
const mineTown = (reg) => (METRO ? reg.group === METRO : !METRO_GROUPS.has(reg.group));
const MCOUNTIES = MDEF ? Object.values(MDEF.sources) : [];
const CACHE = join(HERE, METRO ? `census-cache-${METRO}.json` : 'census-cache.json');
const STATE_FIPS = MDEF ? MDEF.stateFips : '08';
if (MDEF) COUNTIES.splice(0, COUNTIES.length, ...MCOUNTIES.map((c) => c.countyFips));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const val = (x) => { const n = +x; return Number.isFinite(n) && n >= 0 ? n : null; };   /* the API's -666666666 etc. = not available */

if (!existsSync(CACHE) || process.argv.includes('--fetch')) {
  if (!KEY) throw new Error('no Census key: census-key.txt');
  const bgs = {};
  for (const c of COUNTIES) {
    const u = `https://api.census.gov/data/${YEAR}/acs/acs5?get=${VARS.join(',')}&for=block%20group:*&in=state:${STATE_FIPS}&in=county:${c}&key=${KEY}`;
    const j = await (await fetch(u)).json(), h = j[0];
    for (const r of j.slice(1)) {
      const g = (k) => val(r[h.indexOf(k)]), id = r[h.indexOf('state')] + r[h.indexOf('county')] + r[h.indexOf('tract')] + r[h.indexOf('block group')];
      const occ = g('B25003_001E'), tot = g('B25002_001E'), units = g('B25024_001E'), rec = {};
      if (occ) { rec.h = occ; rec.o = Math.round(100 * g('B25003_002E') / occ); }
      if (g('B19013_001E')) rec.i = g('B19013_001E');
      if (g('B25035_001E') > 1800) rec.y = g('B25035_001E');
      if (g('B25077_001E')) rec.v = g('B25077_001E');
      if (g('B25039_002E') > 1900) rec.m = g('B25039_002E');
      if (tot) rec.vc = Math.round(100 * g('B25002_003E') / tot);
      if (units) rec.sf = Math.round(100 * g('B25024_002E') / units);
      bgs[id] = rec;
    }
    console.log(`  county ${c}: ${j.length - 1} block groups`); await sleep(300);
  }
  const shapes = [];
  for (const c of COUNTIES) {
    for (let off = 0; ; off += 1000) {
      const q = new URLSearchParams({ where: `STATE='${STATE_FIPS}' AND COUNTY='${c}'`, outFields: 'GEOID', outSR: '4326', maxAllowableOffset: '0.0002', resultOffset: String(off), resultRecordCount: '1000', f: 'geojson' });
      const j = await (await fetch(TIGER, { method: 'POST', body: q })).json();
      if (!j.features) throw new Error('TIGERweb: ' + JSON.stringify(j).slice(0, 200));
      shapes.push(...j.features);
      if (j.features.length < 1000) break;
    }
    await sleep(300);
  }
  writeFileSync(CACHE, JSON.stringify({ ver: VER, bgs, shapes }));
  console.log(`fetched ${Object.keys(bgs).length} block groups' figures and ${shapes.length} shapes`);
}

const C = JSON.parse(readFileSync(CACHE, 'utf8'));
const shapes = C.shapes.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const xs = polys.flatMap((p) => p[0].map((c) => c[0])), ys = polys.flatMap((p) => p[0].map((c) => c[1]));
  return { id: f.properties.GEOID, polys, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const inPoly = (x, y, rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((r) => inRing(x, y, r));
/* a coarse grid so 300,000 doors don't each scan 3,000 shapes */
const G = 0.05, grid = new Map();
for (const s of shapes) for (let gx = Math.floor(s.bb[0] / G); gx <= Math.floor(s.bb[2] / G); gx++) for (let gy = Math.floor(s.bb[1] / G); gy <= Math.floor(s.bb[3] / G); gy++) { const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
const bgAt = (lon, lat) => { for (const s of grid.get(Math.floor(lon / G) + ',' + Math.floor(lat / G)) || []) if (lon >= s.bb[0] && lon <= s.bb[2] && lat >= s.bb[1] && lat <= s.bb[3] && s.polys.some((p) => inPoly(lon, lat, p))) return s.id; return null; };

const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
let tot = 0, hit = 0;
for (const reg of idx.regions) {
  if (String(reg.key).startsWith('com-') || !mineTown(reg)) continue;
  const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, 'utf8')), doors = {}, used = {};
  let n = 0, k = 0;
  for (const a of d.areas) for (const x of a.doors) {
    n++; if (x.lat == null) continue;
    const id = bgAt(x.lon, x.lat); if (!id || !C.bgs[id]) continue;
    doors[x.id] = id; used[id] = C.bgs[id]; k++;
  }
  writeFileSync(join(DATA, `census-${reg.key}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'U.S. Census Bureau, American Community Survey', ver: C.ver, bgs: used, doors }));
  console.log(`  census-${reg.key}.json: ${k} of ${n} doors in ${Object.keys(used).length} block groups`);
  tot += n; hit += k;
}
console.log(`${hit} of ${tot} doors placed in a block group (${C.ver})`);

/* Trees near the house, every door (2026-10-02). Built like sample-lawn.mjs: incremental
   and keyed by coordinate, so a rebuild of the door lists only measures new doors.

   Source by county (checked 2026-10-02):
     El Paso  -> USGS 3DEP LiDAR, CO_Eastern_ElPaso_2018
     Douglas  -> USGS 3DEP LiDAR, CO_DRCOG_2_2020
     Teller   -> no 3DEP coverage; the Meta canopy-height map, which UNDERCOUNTS (it missed
                 whole evergreen clumps on test lots) — the card says which source it is.
   See zones.mjs and lidar.mjs for the zones, the house, and the eave rule.

   Writes ../tree-cache.json: { "lat,lon": { z1, z2, z3, h, hs, src, yr } | { err } }.
   Then: node ../build-rounds-data.mjs

   Run:  node fetch-buildings.mjs      (once)
         node sample-trees.mjs [--town=monument] [--conc=4] [--limit=N]                 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRing, inRings, merc, loadBuildings, pickHouse, measure, townParcels } from './zones.mjs';
import { measureLidar, PROJECT, setMemoMax } from './lidar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..');
const CACHE = join(DT, 'tree-cache.json');
const TOWNS = { walden: 'elpaso', monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas',
  'woodland-park': 'teller', divide: 'teller', florissant: 'teller', 'cripple-creek': 'teller', 'highlands-ranch': 'douglas', parker: 'douglas', 'castle-pines': 'douglas', 'windsor': 'eastern-b1', 'erie': 'drcog2', 'commerce-city': 'drcog2',
  thornton: 'drcog2', centennial: 'drcog2', aurora: 'drcog2', 'south-denver': 'drcog2', englewood: 'drcog2',
  denver: 'drcog2', arvada: 'drcog2', boulder: 'drcog1',
  littleton: 'drcog2', lakewood: 'drcog2', 'greenwood-village': 'drcog2', 'cherry-hills-village': 'drcog2', sheridan: 'drcog2', 'lone-tree': 'drcog2', 'wheat-ridge': 'drcog2', edgewater: 'drcog2', golden: 'drcog2', westminster: 'drcog2',
  broomfield: 'drcog2', 'ken-caryl': 'drcog2', columbine: 'drcog2', northglenn: 'drcog2', 'federal-heights': 'drcog2', brighton: 'drcog2', louisville: 'drcog1', lafayette: 'drcog1', superior: 'drcog1', longmont: 'drcog1',   /* the 365 area towns, 2026-10-15 */
  'holly-hills': 'drcog2', 'four-square-mile': 'drcog2', 'cherry-creek': 'drcog2', 'dakota-ridge': 'drcog2', 'acres-green': 'douglas', 'inverness': 'drcog2', 'meridian': 'douglas', 'berkley': 'drcog2', 'sterling-ranch': 'douglas', 'derby': 'drcog2',   /* batch 6, 2026-10-18 */
  'bow-mar': 'drcog2', 'columbine-valley': 'drcog2', 'glendale': 'drcog2', 'dove-valley': 'drcog2', 'morrison': 'drcog2', 'twin-lakes': 'drcog2', 'foxfield': 'drcog2', 'stonegate': 'douglas', 'sherrelwood': 'drcog2', 'welby': 'drcog2', 'roxborough-park': 'douglas', 'evergreen': 'drcog2', 'the-pinery': 'douglas', 'watkins': 'drcog2', 'perry-park': 'douglas', 'idaho-springs': 'drcog2', 'lochbuie': 'drcog2', 'black-hawk': 'drcog2', 'elizabeth': 'elbert', 'central-city': 'drcog2', 'dacono': 'drcog2', 'gunbarrel': 'drcog1', 'frederick': 'drcog2', 'bennett': 'drcog2', 'fort-lupton': 'drcog2', 'niwot': 'drcog1', 'firestone': 'drcog2', 'hudson': 'drcog2', 'nederland': 'drcog1', 'kiowa': 'elbert', 'strasburg': 'drcog2', 'platteville': 'drcog2', 'mead': 'drcog1', 'keenesburg': 'drcog2', 'byers': 'drcog2', 'lyons': 'drcog1',   /* batch 4, 2026-10-16 */   /* 2026-10-14: the 365 area; lidar.mjs already notes drcog2 covers Denver and Arvada, drcog1 Boulder */
  'cs-northeast': 'elpaso', 'cs-northwest': 'elpaso', 'cs-southeast': 'elpaso', 'cs-southwest': 'elpaso', 'security-widefield': 'elpaso', fountain: 'elpaso' };   /* Springs (2026-10-12): El Paso county scan, as Monument; 8-door check before the overnight run */   /* Yards' new towns (2026-10-11): both read 8 of 8 sample doors in CO_DRCOG_2_2020 */
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 4), LIMIT = +arg('limit', 1e9), BLD = arg('buildings', 'buildings');
/* --mail: measure the mailing-list properties (../mail/mail-properties.csv, owners who live
   elsewhere) instead of the doors. Same cache, same key: the two sets never share a parcel. */
const MAIL = process.argv.includes('--mail');
function mailDoors(p, town) {
  const [h, ...lines] = readFileSync(p, 'utf8').trim().split('\n');
  const head = h.split(','), rows = lines.map((l) => l.slice(1, -1).split('","'));   /* header unquoted, rows fully quoted */
  const ix = (k) => head.indexOf(k);
  return rows.filter((r) => r[ix('town')] === town)
    .map((r) => ({ a: r[ix('property_address')] || `parcel ${r[ix('parcel')]}`, la: Number(r[ix('lat')]), lo: Number(r[ix('lon')]) }))
    .filter((d) => Number.isFinite(d.la))
    .sort((x, y) => Math.round(x.la * 200) - Math.round(y.la * 200) || x.lo - y.lo);   /* rough grid order = tile reuse */
}
setMemoMax(500);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
/* 2026-10-11: on Windows the replace can meet the file held open for a moment (a virus scan of the big cache); it stopped the
   overnight tree run twice. Try again for up to 5 s before giving up. */
function save() {
  writeFileSync(CACHE + '.tmp', JSON.stringify(cache));
  for (let i = 0; ; i++) {
    try { renameSync(CACHE + '.tmp', CACHE); return; }
    catch (e) { if (i >= 20 || !/EPERM|EBUSY|EACCES/.test(String(e.code))) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); }
  }
}

const started = Date.now(); let done = 0;
const BASE = (t) => t.replace(/-lookup$/, '');   /* a town's office-lookup list uses the town's own scan (2026-10-14) */
for (const [town, county] of (ONLY && !TOWNS[ONLY] && TOWNS[BASE(ONLY)] ? [[ONLY, TOWNS[BASE(ONLY)]]] : Object.entries(TOWNS))) {
  if (ONLY && town !== ONLY) continue;
  const p = MAIL ? join(DT, 'mail', 'mail-properties.csv') : join(DT, `${town}-areas.json`);
  if (!existsSync(p)) continue;
  const all = MAIL ? mailDoors(p, town)
    : JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number');   /* neighbourhood order = good tile reuse */
  /* --redo-canopy (2026-10-09): measure again the doors whose figures came from the canopy map, now that Teller has laser scans */
  const REDO_CANOPY = process.argv.includes('--redo-canopy');
  /* --redo-outline (2026-10-26, Matthew: "go ahead with 1 on the cloud machine"): measure again the doors the Microsoft outline set missed
     (103,514), with --buildings=buildings-ovt, the Overture 2026-10-21.0 outlines (OpenStreetMap, Esri, Microsoft) cut to the same tiles */
  const REDO_OUTLINE = process.argv.includes('--redo-outline');
  const todo = all.filter((d) => { const c = cache[`${d.la},${d.lo}`]; return !c || (REDO_CANOPY && c.src === 'canopy') || (REDO_OUTLINE && c.err === 'no house outline'); }).slice(0, LIMIT);
  if (!todo.length) { console.log(`${town}: all ${all.length} measured`); continue; }
  const lats = todo.map((d) => d.la), lons = todo.map((d) => d.lo);
  const bbox = [Math.min(...lons) - 0.003, Math.min(...lats) - 0.003, Math.max(...lons) + 0.003, Math.max(...lats) + 0.003];
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(join(HERE, BLD), bbox);
  const cell = 0.004, key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const pgrid = new Map(), bgrid = new Map();
  for (const pc of parcels) for (let gx = Math.floor(pc.bb[0] / cell); gx <= Math.floor(pc.bb[2] / cell); gx++) for (let gy = Math.floor(pc.bb[1] / cell); gy <= Math.floor(pc.bb[3] / cell); gy++) {
    const k = `${gx},${gy}`; if (!pgrid.has(k)) pgrid.set(k, []); pgrid.get(k).push(pc);
  }
  for (const b of blds) { const k = key(b.c[0], b.c[1]); if (!bgrid.has(k)) bgrid.set(k, []); bgrid.get(k).push(b); }
  const near = (x, y) => { const out = []; const gx = Math.floor(x / cell), gy = Math.floor(y / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...(bgrid.get(`${gx + a},${gy + b}`) || [])); return out; };
  console.log(`${town}: ${todo.length} doors to measure, ${parcels.length} lots, ${blds.length} building outlines, ${PROJECT[county] || 'canopy map'}`);
  let i = 0, errs = 0;
  async function worker() {
    for (;;) {
      const d = todo[i++]; if (!d) return;
      const k = `${d.la},${d.lo}`;
      try {
        const pc = (pgrid.get(key(d.lo, d.la)) || []).find((c) => d.lo >= c.bb[0] && d.lo <= c.bb[2] && d.la >= c.bb[1] && d.la <= c.bb[3] && inRings(d.lo, d.la, c.rings));
        if (!pc) { cache[k] = { err: 'no parcel at the point' }; }
        else {
          const cand = near(d.lo, d.la);
          const house = pickHouse(pc.rings, cand);
          if (!house) cache[k] = { err: 'no house outline' };
          else if (PROJECT[county]) {
            const others = cand.filter((b) => b.ring !== house.ring && inRings(b.c[0], b.c[1], pc.rings)).map((b) => ({ m: b.ring.map(([lo, la]) => merc(lo, la)) }));
            const m = await measureLidar(d.la, d.lo, pc.rings, house, others, PROJECT[county], join(HERE, 'lidar-cache'));   /* tiles kept on disk: later tuning re-measures without re-downloading */
            /* a house newer than the survey gets no reading: the canopy map is just as old */
            cache[k] = m.err === 'house newer than the LiDAR' ? { err: m.err } : m.err ? { ...(await measure(d.la, d.lo, pc.rings, house)), src: 'canopy' } : m;
          } else {
            cache[k] = { ...(await measure(d.la, d.lo, pc.rings, house)), src: 'canopy' };
          }
          delete cache[k].px; delete cache[k].n; delete cache[k].shift; delete cache[k].roof;
          if (BLD !== 'buildings') cache[k].ol = BLD;   /* which outline set found the house */
        }
      } catch (e) { errs++; if (errs <= 5) console.log('   ', d.a, e.message.slice(0, 120)); continue; }   /* not cached: retried next run */
      done++;
      if (done % 100 === 0) { save(); const rate = done / ((Date.now() - started) / 1000); console.log(`   ${done} measured · ${rate.toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save();
  console.log(`${town}: done (${errs} failed, will retry on the next run)`);
}
console.log(`measured ${done} doors in ${((Date.now() - started) / 60000).toFixed(1)} min -> tree-cache.json`);

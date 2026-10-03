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
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas',
  'woodland-park': 'teller', divide: 'teller', florissant: 'teller', 'cripple-creek': 'teller' };
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 4), LIMIT = +arg('limit', 1e9);
setMemoMax(500);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
function save() { writeFileSync(CACHE + '.tmp', JSON.stringify(cache)); renameSync(CACHE + '.tmp', CACHE); }

const started = Date.now(); let done = 0;
for (const [town, county] of Object.entries(TOWNS)) {
  if (ONLY && town !== ONLY) continue;
  const p = join(DT, `${town}-areas.json`);
  if (!existsSync(p)) continue;
  const all = JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number');   /* neighbourhood order = good tile reuse */
  const todo = all.filter((d) => !cache[`${d.la},${d.lo}`]).slice(0, LIMIT);
  if (!todo.length) { console.log(`${town}: all ${all.length} measured`); continue; }
  const lats = todo.map((d) => d.la), lons = todo.map((d) => d.lo);
  const bbox = [Math.min(...lons) - 0.003, Math.min(...lats) - 0.003, Math.max(...lons) + 0.003, Math.max(...lats) + 0.003];
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(join(HERE, 'buildings'), bbox);
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

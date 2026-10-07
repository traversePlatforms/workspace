/* Compact lawn per door (2026-10-03). Adds `c` (compact lawn, sq ft) to lawn-cache.json for
   every door whose lawn reads Medium or Large (1,200 sq ft or more): only lawn patches of 400
   sq ft or more, within 30 m of the house, count (lawn-mask.mjs COMPACT, calibrated against a
   blind visual check). The rule can only shrink a lawn, so Small and None doors are left alone.
   build-rounds-data.mjs uses `c` for the level when it is there.
   Incremental: doors that already have `c` are skipped. Saved every 50 doors.
   Run:  node sample-lawn-compact.mjs [--town=black-forest] [--conc=6]                       */
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json, patches, compactSqFt } from './lawn-mask.mjs';
import { inRings, loadBuildings, pickHouse, townParcels } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..');
const CACHE = join(DT, 'lawn-cache.json');
const TOWNS = ['monument', 'palmer-lake', 'black-forest', 'castle-rock', 'larkspur', 'sedalia', 'franktown', 'woodland-park', 'divide', 'florissant', 'cripple-creek', 'highlands-ranch', 'parker', 'castle-pines'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 6);
process.on('unhandledRejection', (e) => { console.log('  (a download failed and was skipped: ' + String(e && e.message || e).slice(0, 80) + ')'); });

const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
const save = () => { writeFileSync(CACHE + '.tmp', JSON.stringify(cache)); renameSync(CACHE + '.tmp', CACHE); };
const started = Date.now(); let done = 0;

for (const town of TOWNS) {
  if (ONLY && town !== ONLY) continue;
  const p = join(DT, `${town}-areas.json`);
  if (!existsSync(p)) continue;
  const todo = JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors)
    .filter((d) => typeof d.la === 'number').filter((d) => { const c = cache[`${d.la},${d.lo}`]; return c && !c.err && c.s >= 1200 && c.c === undefined; });
  if (!todo.length) { console.log(`${town}: nothing to do`); continue; }
  const bbox = [Math.min(...todo.map((d) => d.lo)) - 0.003, Math.min(...todo.map((d) => d.la)) - 0.003, Math.max(...todo.map((d) => d.lo)) + 0.003, Math.max(...todo.map((d) => d.la)) + 0.003];
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(join(DT, 'tree-zones', 'buildings'), bbox);
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2023' } }, limit: 250 }) });
  const photos = (st.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }));
  console.log(`${town}: ${todo.length} Medium/Large lawns to re-measure`);
  let i = 0, errs = 0;
  async function worker() {
    for (;;) {
      const d = todo[i++]; if (!d) return;
      const k = `${d.la},${d.lo}`;
      try {
        const pc = parcels.find((c) => d.lo >= c.bb[0] && d.lo <= c.bb[2] && d.la >= c.bb[1] && d.la <= c.bb[3] && inRings(d.lo, d.la, c.rings));
        const ph = photos.filter((it) => d.lo >= it.bb[0] && d.lo <= it.bb[2] && d.la >= it.bb[1] && d.la <= it.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
        if (!pc || !ph) continue;                      /* keeps its old level */
        const m = await measure({ la: d.la, lo: d.lo, detail: true }, pc.rings, ph);
        if (m.err) continue;
        const D = m.detail;
        const cand = blds.filter((b) => b.c[0] >= pc.bb[0] - 0.001 && b.c[0] <= pc.bb[2] + 0.001 && b.c[1] >= pc.bb[1] - 0.001 && b.c[1] <= pc.bb[3] + 0.001);
        const house = pickHouse(pc.rings, cand);
        const houseLocal = house ? house.ring.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', D.epsg, [lo, la]); return [(X - D.origin[0]) / D.res[0] - D.x0, (Y - D.origin[1]) / D.res[1] - D.y0]; }) : null;
        cache[k].c = compactSqFt(patches(D, houseLocal), !!houseLocal);
        if (!houseLocal) cache[k].ch = 0;              /* no house outline: size rule only */
      } catch (e) { errs++; if (errs <= 3) console.log('   ', d.a, String(e.message).slice(0, 90)); continue; }
      if (++done % 50 === 0) { save(); console.log(`   ${done} re-measured · ${(done / ((Date.now() - started) / 1000)).toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save();
  console.log(`${town}: done (${errs} failed, retried next run)`);
}
save();
console.log(`re-measured ${done} doors in ${((Date.now() - started) / 60000).toFixed(1)} min`);

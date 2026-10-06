/* Lawn outlines for the door app (SX-38, 2026-10-03). For every Medium and Large lawn, the
   pixels behind its size: which grass was COUNTED (patches of 400 sq ft or more within 30 m of
   the house — the compact rule) and which was LEFT OUT. The app shades them on the 2023 aerial
   when the crew taps the lawn chip, so a "Medium" on a big green lot explains itself.

   Same lot boundary, house outline, photo and classifier as sample-lawn-compact.mjs, so the
   shading is exactly what the size was measured from. Large lawns also carry their summer
   greenness from the NDVI trial (ndvi-results.csv), with the image dates.

   Output: one pack per town, app/data/rounds/lawnmask-<town>.json, served behind sign-in by
   api/rounds.php action=lawnmask. Each entry: b (south, west, north, east), w, h, r (run-length
   mask, row-major: 0 none, 1 counted, 2 left out), d (photo date), g (greenness, Large only).
   Incremental: doors already in a pack are skipped. Saved every 50.
   Run:  node build-lawn-outlines.mjs [--town=castle-rock] [--conc=6]                         */
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json, COMPACT } from './lawn-mask.mjs';
import { inRings, loadBuildings, pickHouse, townParcels } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..');
const SITE = join(DT, '..', '..', 'app', 'data', 'rounds');
const TOWNS = ['monument', 'palmer-lake', 'black-forest', 'castle-rock', 'larkspur', 'sedalia', 'franktown', 'woodland-park', 'divide', 'florissant', 'cripple-creek'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 6);
process.on('unhandledRejection', (e) => { console.log('  (a download failed and was skipped: ' + String(e && e.message || e).slice(0, 80) + ')'); });

/* greenness per door from the NEWEST lawn-health comparison (ndvi-results-YYYY-MM.csv from a
   monthly run, else the first trial's ndvi-results.csv), with its years, months and image dates */
const green = new Map();
const newest = readdirSync(HERE).filter((f) => /^ndvi-results-\d{4}-\d{2}\.csv$/.test(f)).sort().pop() || 'ndvi-results.csv';
const ndviCsv = join(HERE, newest);
const sumFile = join(HERE, newest.replace('results', 'summary').replace('.csv', '.json'));
const greenMeta = existsSync(sumFile) ? JSON.parse(readFileSync(sumFile, 'utf8')) : {};
if (existsSync(ndviCsv)) {
  const rows = readFileSync(ndviCsv, 'utf8').trim().split(/\r?\n/);
  const head = rows.shift().split(',');
  const col = (n) => head.indexOf(n);
  const peaks = head.filter((h) => /^peak_\d{4}$/.test(h));
  const [ya, yb] = peaks.map((h) => +h.slice(5));
  const [ci, ca, cb, crel] = [col('id'), col(peaks[0]), col(peaks[1]), col('relative_change')];
  for (const line of rows) {
    const cells = line.match(/"([^"]*)"/g)?.map((c) => c.slice(1, -1)) || [];
    const a = parseFloat(cells[ca]), b = parseFloat(cells[cb]), rel = parseFloat(cells[crel]);
    if (cells[ci] && Number.isFinite(a) && Number.isFinite(b)) green.set(cells[ci], { ya, yb, a, b, rel: Number.isFinite(rel) ? rel : null, m: greenMeta.months || [7, 8] });
  }
}
const GREEN_ONLY = process.argv.includes('--green-only');
const ndviDates = { 2025: [], 2026: [] };
const ndviLog = join(HERE, 'ndvi-full.log');
if (existsSync(ndviLog)) for (const m of readFileSync(ndviLog, 'utf8').matchAll(/^\s+(20(25|26)-\d\d-\d\d)\s+\d+\/\d+ clear/gm)) ndviDates[m[1].slice(0, 4)].push(m[1]);
/* only July and August feed the comparison; each date once */
for (const y of [2025, 2026]) ndviDates[y] = [...new Set(ndviDates[y])].filter((x) => /-0[78]-/.test(x)).sort();
/* a monthly run's summary lists its own image dates */
if (Array.isArray(greenMeta.images) && Array.isArray(greenMeta.years)) {
  for (const k of Object.keys(ndviDates)) delete ndviDates[k];
  for (const y of greenMeta.years) ndviDates[y] = greenMeta.images.filter((x) => x.startsWith(y + '-'));
}

/* the patch rule, as lawn-mask.mjs patches(), but keeping each patch's pixels so they can be drawn */
function labelPatches(D, houseLocal) {
  const { w, h, cls } = D, seen = new Uint8Array(w * h), out = new Uint8Array(w * h);
  const m2 = D.res[0] * -D.res[1];
  const segDist = (x, y, r) => { let best = Infinity; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x1, y1] = r[j], [x2, y2] = r[i], dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(x - x1 - t * dx, y - y1 - t * dy)); } return best; };
  let counted = 0;
  for (let s = 0; s < w * h; s++) {
    if (cls[s] !== 2 || seen[s]) continue;
    const stack = [s], comp = []; seen[s] = 1; let n = 0, near = Infinity;
    while (stack.length) {
      const p = stack.pop(); n++; comp.push(p);
      const x = p % w, y = (p - x) / w;
      if (houseLocal && (n % 7 === 1)) near = Math.min(near, segDist(x, y, houseLocal));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = x + dx, qy = y + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy * w + qx; if (!seen[q] && cls[q] === 2) { seen[q] = 1; stack.push(q); } }
    }
    const sqft = n * m2 * 10.7639, distM = houseLocal ? near * D.res[0] : null;
    const keep = sqft >= COMPACT.minSqFt && (!houseLocal || (distM ?? Infinity) <= COMPACT.nearM);
    for (const p of comp) out[p] = keep ? 1 : 2;
    if (keep) counted += sqft;
  }
  return { mask: out, counted: Math.round(counted) };
}
/* run-length: "v:n,v:n,..." over the row-major mask */
function rle(mask) {
  const parts = []; let v = mask[0], n = 0;
  for (let i = 0; i < mask.length; i++) { if (mask[i] === v) n++; else { parts.push(v + ':' + n); v = mask[i]; n = 1; } }
  parts.push(v + ':' + n);
  return parts.join(',');
}

const started = Date.now(); let done = 0;
for (const town of TOWNS) {
  if (ONLY && town !== ONLY) continue;
  const src = join(SITE, `${town}.json`);
  if (!existsSync(src)) continue;
  const OUT = join(SITE, `lawnmask-${town}.json`);
  const pack = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { built: null, ndvi: ndviDates, doors: {} };
  pack.ndvi = ndviDates;
  /* Windows: OneDrive or the virus scanner can hold the file for a moment, and the rename then
     fails with EPERM (it stopped a run on 2026-10-03). Retry, then write in place; never die. */
  const save = () => {
    pack.built = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(pack);
    writeFileSync(OUT + '.tmp', body);
    for (let k = 0; k < 8; k++) {
      try { renameSync(OUT + '.tmp', OUT); return; } catch (e) { if (e.code !== 'EPERM' && e.code !== 'EBUSY' && e.code !== 'EACCES') throw e; const t = Date.now() + 250 * (k + 1); while (Date.now() < t) { /* wait */ } }
    }
    try { writeFileSync(OUT, body); } catch (e) { console.log('   (could not save ' + town + ' this time: ' + e.code + '; the .tmp file holds it)'); }
  };
  if (GREEN_ONLY) {   /* refresh greenness on the outlines already built; measure nothing */
    let n = 0;
    for (const [id, e] of Object.entries(pack.doors)) { if (green.has(id)) { e.g = green.get(id); n++; } }
    save(); console.log(`${town}: greenness refreshed on ${n} lawns from ${newest}`); continue;
  }
  const todo = JSON.parse(readFileSync(src, 'utf8')).areas.flatMap((a) => a.doors)
    .filter((d) => typeof d.lat === 'number' && d.lawn && (d.lawn.lv === 'L' || d.lawn.lv === 'M') && !pack.doors[d.id]);
  if (!todo.length) { console.log(`${town}: nothing to do`); save(); continue; }
  const bbox = [Math.min(...todo.map((d) => d.lon)) - 0.003, Math.min(...todo.map((d) => d.lat)) - 0.003, Math.max(...todo.map((d) => d.lon)) + 0.003, Math.max(...todo.map((d) => d.lat)) + 0.003];
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(join(DT, 'tree-zones', 'buildings'), bbox);
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2023' } }, limit: 250 }) });
  const photos = (st.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }));
  console.log(`${town}: ${todo.length} Medium/Large lawns to outline`);
  let i = 0, errs = 0;
  async function worker() {
    for (;;) {
      const d = todo[i++]; if (!d) return;
      try {
        const pc = parcels.find((c) => d.lon >= c.bb[0] && d.lon <= c.bb[2] && d.lat >= c.bb[1] && d.lat <= c.bb[3] && inRings(d.lon, d.lat, c.rings));
        const ph = photos.filter((it) => d.lon >= it.bb[0] && d.lon <= it.bb[2] && d.lat >= it.bb[1] && d.lat <= it.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
        if (!pc || !ph) continue;
        const m = await measure({ la: d.lat, lo: d.lon, detail: true }, pc.rings, ph);
        if (m.err) continue;
        const D = m.detail;
        const cand = blds.filter((b) => b.c[0] >= pc.bb[0] - 0.001 && b.c[0] <= pc.bb[2] + 0.001 && b.c[1] >= pc.bb[1] - 0.001 && b.c[1] <= pc.bb[3] + 0.001);
        const house = pickHouse(pc.rings, cand);
        const houseLocal = house ? house.ring.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', D.epsg, [lo, la]); return [(X - D.origin[0]) / D.res[0] - D.x0, (Y - D.origin[1]) / D.res[1] - D.y0]; }) : null;
        const { mask, counted } = labelPatches(D, houseLocal);
        /* window corners to lat/lon (the photo grid is UTM; over one lot the turn is a few cm) */
        const corner = (a, b) => proj4(D.epsg, 'EPSG:4326', [D.origin[0] + (D.x0 + a) * D.res[0], D.origin[1] + (D.y0 + b) * D.res[1]]);
        const [w0, n0] = corner(0, 0), [e0, s0] = corner(D.w, D.h);
        const entry = { b: [+s0.toFixed(7), +w0.toFixed(7), +n0.toFixed(7), +e0.toFixed(7)], w: D.w, h: D.h, r: rle(mask), d: ph.date, sq: counted, hs: !!houseLocal };
        if (green.has(d.id)) entry.g = green.get(d.id);
        pack.doors[d.id] = entry;
      } catch (e) { errs++; if (errs <= 3) console.log('   ', d.address, String(e.message).slice(0, 90)); continue; }
      if (++done % 50 === 0) { save(); console.log(`   ${done} outlined · ${(done / ((Date.now() - started) / 1000)).toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save();
  console.log(`${town}: done (${errs} failed, retried next run) · ${Object.keys(pack.doors).length} in the pack`);
}
console.log(`outlined ${done} lawns in ${((Date.now() - started) / 60000).toFixed(1)} min`);

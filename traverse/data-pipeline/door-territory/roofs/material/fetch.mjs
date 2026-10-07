/* Step 2: one NAIP 2023 crop per house, from Microsoft Planetary Computer's data API (USDA NAIP, public domain).
 *
 * Colorado's 2023 NAIP is 0.3 m, four bands (red, green, blue, near-infrared), flown 22 Sep - 20 Oct 2023.
 * Per door: a square window on the house centre (cache/houses-<town>.json), the house's longest side plus 4 m each
 * way, between 20 and 60 m across, at the native 0.3 m, requested as a raw numpy array (4 bands + mask) so no
 * compression or colour mapping gets in the way:
 *   https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{minx},{miny},{maxx},{maxy}/{w}x{h}.npy
 *       ?collection=naip&item=<id>&assets=image&asset_bidx=image|1,2,3,4
 * Saved gzipped under cache/crops/<town>/<id>.npy.gz, with cache/crops-<town>.json recording the window each crop
 * covers (so the outline can be drawn onto it). Already-saved crops are skipped: re-runs only fetch what is missing.
 * Six requests at a time, three tries with backoff. About 50 KB a crop before gzip; ~31,000 crops.
 *   node fetch.mjs [--town=castle-rock] [--conc=6] [--limit=N]                                                 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'cache');
const API = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox';
const RES = 0.3;   /* m per pixel, native */
const TOWNS = ['castle-rock', 'franktown', 'sedalia', 'larkspur', 'black-forest', 'monument', 'palmer-lake', 'woodland-park', 'divide', 'florissant', 'cripple-creek', 'highlands-ranch', 'parker', 'castle-pines', 'cs-northeast', 'cs-southeast', 'security-widefield', 'fountain'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 6), LIMIT = +arg('limit', 1e9);
/* --index-only (2026-10-07): the window and its NAIP item per house, for the close-ups (build-naip-photos.mjs), without the
   crop itself. For towns whose roof material comes from the county record (Douglas), where the classifier is not run. */
const INDEX_ONLY = process.argv.includes('--index-only');
const ITEMS_F = join(CACHE, 'naip-items.json');
const items = JSON.parse(readFileSync(ITEMS_F, 'utf8'));
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
/* a town with no NAIP item list yet: the 2023 photos over its houses, from the STAC search (as lawn-trial/sample-lawn.mjs) */
async function itemsFor(town, houses) {
  if (items[town]) return;
  const pts = Object.values(houses).map((h) => h.c), lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
  const bbox = [Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01];
  const r = await fetch(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2023' } }, limit: 250 }) });
  const j = await r.json();
  items[town] = (j.features || []).map((f) => ({ id: f.id, bbox: f.bbox, date: f.properties.datetime.slice(0, 10), gsd: f.properties.gsd, epsg: f.properties['proj:epsg'] }));
  writeFileSync(ITEMS_F, JSON.stringify(items));
  console.log(' + ' + town + ': ' + items[town].length + ' NAIP 2023 items');
}
const safe = (id) => String(id).replace(/[^a-z0-9_-]/gi, '_');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the window: half-size in metres -> bbox in degrees (square in metres) and a pixel size at 0.3 m */
export function windowFor(h) {
  const half = Math.min(30, Math.max(10, h.ext / 2 + 4));
  const [lat, lon] = h.c, dLat = half / 111320, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  const px = Math.round(2 * half / RES);
  return { bbox: [+(lon - dLon).toFixed(7), +(lat - dLat).toFixed(7), +(lon + dLon).toFixed(7), +(lat + dLat).toFixed(7)], px };
}
/* the NAIP item: whole window inside it, furthest from its edge; else the one holding the centre */
function itemFor(town, bbox) {
  let best = null, bestM = -Infinity;
  for (const it of items[town]) {
    const b = it.bbox, m = Math.min(bbox[0] - b[0], b[2] - bbox[2], bbox[1] - b[1], b[3] - bbox[3]);
    if (m > bestM) { bestM = m; best = it; }
  }
  return best ? best.id : null;
}

const started = Date.now(); let done = 0, bytes = 0;
for (const town of TOWNS) {
  if (ONLY && town !== ONLY) continue;
  const hf = join(CACHE, `houses-${town}.json`);
  if (!existsSync(hf)) { console.log(`${town}: no houses file yet (run houses.mjs)`); continue; }
  const houses = JSON.parse(readFileSync(hf, 'utf8'));
  await itemsFor(town, houses);
  const dir = join(CACHE, 'crops', town); mkdirSync(dir, { recursive: true });
  const idxF = join(CACHE, `crops-${town}.json`);
  const idx = existsSync(idxF) ? JSON.parse(readFileSync(idxF, 'utf8')) : {};
  const save = () => { writeFileSync(idxF + '.tmp', JSON.stringify(idx)); renameSync(idxF + '.tmp', idxF); };
  if (INDEX_ONLY) {
    let n = 0;
    for (const [id, h] of Object.entries(houses)) {
      if (idx[id] && !idx[id].err) continue;
      const { bbox, px } = windowFor(h), item = itemFor(town, bbox);
      idx[id] = item ? { bbox, px, item: item.replace(/^co_m_/, '') } : { err: 'no NAIP item' }; n++;
    }
    save(); console.log(town + ': ' + n + ' windows indexed (no crops fetched)'); continue;
  }
  const todo = Object.entries(houses).filter(([id]) => !(idx[id] && !idx[id].err && existsSync(join(dir, safe(id) + '.npy.gz')))).slice(0, LIMIT);
  console.log(`${town}: ${todo.length} crops to fetch`);
  let i = 0, fails = 0;
  async function worker() {
    for (;;) {
      const e = todo[i++]; if (!e) return;
      const [id, h] = e, { bbox, px } = windowFor(h), item = itemFor(town, bbox);
      if (!item) { idx[id] = { err: 'no NAIP item' }; continue; }
      const url = `${API}/${bbox.join(',')}/${px}x${px}.npy?collection=naip&item=${item}&assets=image&asset_bidx=image|1,2,3,4`;
      let ok = false;
      for (let t = 0; t < 4 && !ok; t++) {
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
          if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
          if (!r.ok) { idx[id] = { err: `HTTP ${r.status}` }; fails++; break; }
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 200 || buf.toString('latin1', 1, 6) !== 'NUMPY') throw new Error('not a numpy file');
          writeFileSync(join(dir, safe(id) + '.npy.gz'), gzipSync(buf));
          idx[id] = { bbox, px, item: item.replace(/^co_m_/, '') };
          bytes += buf.length; ok = true;
        } catch (err) {
          if (t === 3) { idx[id] = { err: err.message.slice(0, 60) }; fails++; if (fails <= 10) console.log('   ', id, err.message.slice(0, 80)); }
          else await sleep(1000 * 3 ** t + Math.random() * 500);
        }
      }
      done++;
      if (done % 200 === 0) { save(); const s = (Date.now() - started) / 1000; console.log(`   ${done} fetched · ${(done / s).toFixed(1)}/s · ${(bytes / 1048576).toFixed(0)} MB · ${town} ${i}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save();
  console.log(`${town}: done, ${fails} failed`);
}
console.log(`fetched ${done} crops in ${((Date.now() - started) / 60000).toFixed(1)} min`);

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
import { fromUrl } from '../../tree-zones/node_modules/geotiff/dist-node/geotiff.js';
import proj4 from '../../tree-zones/node_modules/proj4/dist/proj4-src.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'cache');
const API = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox';
const RES = 0.3;   /* m per pixel, native */
const TOWNS = ['castle-rock', 'franktown', 'sedalia', 'larkspur', 'black-forest', 'monument', 'palmer-lake', 'woodland-park', 'divide', 'florissant', 'cripple-creek', 'highlands-ranch', 'parker', 'castle-pines', 'cs-northeast', 'cs-southeast', 'security-widefield', 'fountain', 'thornton', 'centennial', 'erie', 'commerce-city', 'denver'];   /* + the Front Range Roofing towns (2026-10-10) */
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 6), LIMIT = +arg('limit', 1e9);
if (ONLY && !TOWNS.includes(ONLY)) TOWNS.push(ONLY);   /* a town not on the list above (2026-10-26, the editions' new towns) */
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
/* the crop straight from the NAIP photo file (2026-10-26: Planetary Computer's data API stopped answering .npy, HTTP 501): the signed
   cloud-optimised GeoTIFF, the window in the photo's own UTM grid resampled to px x px, written as the same .npy the API gave (uint8,
   shape 5 x px x px: red, green, blue, near-infrared, valid mask), so features.py reads it unchanged */
let sas = null, sasAt = 0; const cogs = new Map(), hrefs = new Map();
async function token() { if (!sas || Date.now() - sasAt > 20 * 60e3) { sas = (await (await fetch('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).json()).token; sasAt = Date.now(); } return sas; }
async function cogCrop(item, bbox, px) {
  if (!hrefs.has(item)) { const j = await (await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/collections/naip/items/' + item, { signal: AbortSignal.timeout(30000) })).json(); hrefs.set(item, { href: j.assets.image.href, epsg: j.properties['proj:epsg'] }); }
  const { href, epsg } = hrefs.get(item);
  if (!cogs.has(item) || Date.now() - cogs.get(item).at > 20 * 60e3) cogs.set(item, { at: Date.now(), img: (await fromUrl(href + '?' + await token(), { cacheSize: 200 })).getImage() });
  const im = await cogs.get(item).img;
  if (!proj4.defs('EPSG:' + epsg)) proj4.defs('EPSG:' + epsg, `+proj=utm +zone=${epsg % 100} +datum=NAD83 +units=m +no_defs`);
  const P = (lo, la) => proj4('EPSG:4326', 'EPSG:' + epsg, [lo, la]);
  const [x0, y0] = P(bbox[0], bbox[3]), [x1, y1] = P(bbox[2], bbox[1]);
  const [ox, oy] = im.getOrigin(), [rx, ry] = im.getResolution();
  const c0 = Math.floor((Math.min(x0, x1) - ox) / rx), c1 = Math.ceil((Math.max(x0, x1) - ox) / rx), r0 = Math.floor((Math.max(y0, y1) - oy) / ry), r1 = Math.ceil((Math.min(y0, y1) - oy) / ry);
  const W = im.getWidth(), H = im.getHeight(), cw = Math.max(0, c0), rw = Math.max(0, r0), cx = Math.min(W, c1), rx2 = Math.min(H, r1);
  if (cx <= cw || rx2 <= rw) throw new Error('window outside the photo');
  const ras = await im.readRasters({ window: [cw, rw, cx, rx2], width: px, height: px, resampleMethod: 'nearest', samples: [0, 1, 2, 3] });
  const n = px * px, data = Buffer.alloc(5 * n);
  for (let b = 0; b < 4; b++) data.set(ras[b], b * n);
  for (let i = 0; i < n; i++) data[4 * n + i] = (ras[0][i] || ras[1][i] || ras[2][i] || ras[3][i]) ? 255 : 0;
  let hdr = "{'descr': '|u1', 'fortran_order': False, 'shape': (5, " + px + ', ' + px + '), }';
  hdr = hdr + ' '.repeat((64 - ((10 + hdr.length + 1) % 64)) % 64) + String.fromCharCode(10);
  const pre = Buffer.alloc(10); pre[0] = 0x93; pre.write('NUMPY', 1, 'latin1'); pre[6] = 1; pre[7] = 0; pre.writeUInt16LE(hdr.length, 8);
  return Buffer.concat([pre, Buffer.from(hdr, 'latin1'), data]);
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
      const url = null;   /* the data API's .npy answer is gone (HTTP 501, 2026-10-26): the window is read from the photo file itself */
      let ok = false;
      for (let t = 0; t < 4 && !ok; t++) {
        try {
          const buf = await cogCrop(item, bbox, px);
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

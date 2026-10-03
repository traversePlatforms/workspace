/* Spot-check a random sample of measured doors at one level: the 2023 photo with the LiDAR
   tree cells tinted by zone (red 0-5 ft, orange 5-30 ft, yellow 30-100 ft), the house outline
   as aligned to the roof (white) and the lot line (yellow), tiled 3 x 3 into one sheet.
   Usage: node spot-check.mjs --level=against [--n=9] [--seed=1]  -> spot-<level>.png (gitignored) */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARCELS, ZONES, json, inRing, merc, loadBuildings, pickHouse } from './zones.mjs';
import { measureLidar, PROJECT } from './lidar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..');
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const LEVEL = arg('level', 'against'), N = +arg('n', 9); let seed = +arg('seed', 1);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const COUNTY = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas' };
const lv = (t) => (t.err || t.z2 == null ? null : (t.z1 || 0) >= 0.15 ? 'against' : t.z2 >= 0.35 ? 'heavy' : t.z2 >= 0.10 ? 'some' : 'clear');
const cache = JSON.parse(readFileSync(join(DT, 'tree-cache.json'), 'utf8'));
const pool = [];
for (const town of Object.keys(COUNTY)) {
  let a; try { a = JSON.parse(readFileSync(join(DT, `${town}-areas.json`), 'utf8')).areas; } catch { continue; }
  for (const ar of a) for (const d of ar.doors) { const c = cache[`${d.la},${d.lo}`]; if (c && c.src === 'lidar' && lv(c) === LEVEL) pool.push({ town, d, c }); }
}
const pick = []; while (pick.length < Math.min(N, pool.length)) { const p = pool[Math.floor(rnd() * pool.length)]; if (!pick.includes(p)) pick.push(p); }
console.log(`${pool.length} doors at "${LEVEL}"; sampling ${pick.length}`);

const token = (await json('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const T = 300, sheet = new PNG({ width: T * 3, height: T * Math.ceil(pick.length / 3) });
const tint = { 1: [230, 30, 30], 2: [255, 140, 0], 3: [255, 230, 80] };
for (let idx = 0; idx < pick.length; idx++) {
  const { town, d, c } = pick[idx];
  const pq = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lo},${d.la}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const lot = pq.features[0].geometry.rings;
  const blds = await loadBuildings(join(HERE, 'buildings'), [d.lo - 0.003, d.la - 0.003, d.lo + 0.003, d.la + 0.003]);
  const house = pickHouse(lot, blds);
  const others = blds.filter((b) => b.ring !== house.ring && lot.some((r) => inRing(b.c[0], b.c[1], r))).map((b) => ({ m: b.ring.map(([lo, la]) => merc(lo, la)) }));
  const L = await measureLidar(d.la, d.lo, lot, house, others, PROJECT[COUNTY[town]], join(HERE, "lidar-cache"), true);
  if (L.err) { console.log(`${idx + 1}. ${town} ${d.a}  -> ${L.err} (no reading; tile left blank)`); continue; }
  console.log(`${idx + 1}. ${town} ${d.a}  z1 ${L.z1} z2 ${L.z2} z3 ${L.z3}  roof ${L.roof} m  shift ${L.shift}`);
  const stac = await json('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lo, d.la] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
  const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
  const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
  const toPx = ([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; };
  const Hll = L.H.map(([x, y]) => proj4('EPSG:3857', 'EPSG:4326', [x, y])), Hpx = Hll.map(toPx), lotPx = lot.map((r) => r.map(toPx));
  const cx = Hpx.reduce((s, p) => s + p[0], 0) / Hpx.length, cy = Hpx.reduce((s, p) => s + p[1], 0) / Hpx.length, half = Math.ceil(ZONES.z2 / res[0]) + 22;
  const x0 = Math.floor(cx - half), y0 = Math.floor(cy - half), w = 2 * half, h = 2 * half;
  const [R, G, B] = await im.readRasters({ window: [x0, y0, x0 + w, y0 + h], interleave: false });
  const { G: grid, zoneOf, treeOf } = L, cell = grid.cell;
  const tile = new Uint8Array(T * T * 3);
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    const px = Math.floor(tx * w / T), py = Math.floor(ty * h / T), i = py * w + px;
    let rgb = [R[i], G[i], B[i]];
    const [lon, lat] = proj4(epsg, 'EPSG:4326', [origin[0] + (x0 + px + 0.5) * res[0], origin[1] + (y0 + py + 0.5) * res[1]]);
    const [X, Y] = merc(lon, lat), c2 = Math.floor((X - grid.x0) / cell), r2 = Math.floor((grid.y1 - Y) / cell);
    if (c2 >= 0 && r2 >= 0 && c2 < grid.w && r2 < grid.h) { const o = r2 * grid.w + c2; if (treeOf[o]) rgb = rgb.map((v, j) => Math.round(v * 0.4 + tint[zoneOf[o]][j] * 0.6)); }
    tile.set(rgb, (ty * T + tx) * 3);
  }
  const plot = (pts, col) => { for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], n = 60; for (let s = 0; s <= n; s++) { const x = Math.round(((a[0] + (b[0] - a[0]) * s / n) - x0) * T / w), y = Math.round(((a[1] + (b[1] - a[1]) * s / n) - y0) * T / h); if (x >= 0 && y >= 0 && x < T && y < T) tile.set(col, (y * T + x) * 3); } } };
  for (const r of lotPx) plot(r, [255, 230, 0]);
  plot(Hpx, [255, 255, 255]);
  const ox = (idx % 3) * T, oy = Math.floor(idx / 3) * T;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const s = (y * T + x) * 3, o = ((oy + y) * sheet.width + ox + x) * 4; sheet.data[o] = tile[s]; sheet.data[o + 1] = tile[s + 1]; sheet.data[o + 2] = tile[s + 2]; sheet.data[o + 3] = 255; }
}
writeFileSync(join(HERE, `spot-${LEVEL}.png`), PNG.sync.write(sheet));
console.log(`wrote spot-${LEVEL}.png (tiles left-to-right, top-to-bottom; each shows the 30 ft zone and a little more)`);

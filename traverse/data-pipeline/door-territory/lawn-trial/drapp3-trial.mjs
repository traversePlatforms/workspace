/* The 3-inch photo trial (2026-10-22, Matthew: "add the 3-inch trial to the que"). Douglas County serves DRAPP 2022 at 3 inches (0.25 ft) with
   the infrared band, twice as sharp as the 6-inch copy the first trial used (drapp-trial.mjs, Jefferson County only). For each lot: the
   lawn the app shows, NAIP 2023 green (30 cm, what the app is built on), DRAPP 3-inch green at the leaf-off threshold (0.20) and the summer
   one (0.36), and DRCOG's 2020 turf where the Highlands Ranch run has it. Lots: the ones measured by hand first, then a spread of tree lots
   and open lots in every Douglas County town on the door lists. Resumes: lots already in results.json are skipped, and it stops after
   --mins (exit 3 = more left).
   Run:  node drapp3-trial.mjs <outdir> [--mins=40] [--per=6]
   Credit: imagery DRCOG DRAPP 2022, CC BY 3.0, via Douglas County GIS. No Google imagery. */
import { fromUrl, fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2), outDir = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const MINS = opt('mins', 40), PER = opt('per', 6), T0 = Date.now();
if (!outDir) { console.log('usage: node drapp3-trial.mjs <outdir> [--mins=40] [--per=6]'); process.exit(1); }
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const DRAPP = 'https://apps.douglas.co.us/gisis/rest/services/Drapp_2022/ImageServer/exportImage';
const CELL = 0.0762;   /* 3 inches in metres */
const TOWNS = ['highlands-ranch', 'parker', 'castle-rock', 'castle-pines', 'lone-tree', 'sterling-ranch', 'the-pinery', 'acres-green', 'roxborough-park', 'larkspur', 'franktown', 'sedalia'];
/* measured by hand: Jen in Google Earth (Settlers 10,473 sq ft, 2026-10-21); the Highlands Ranch three Matthew is measuring (2026-10-21) */
const HAND = [['11663 N Settlers Dr', 'Parker', 'parker', 10473], ['600 Hiddenbrook Ct', 'Highlands Ranch', 'highlands-ranch', null], ['9267 Canyon Wren Ct', 'Highlands Ranch', 'highlands-ranch', null],
  ['852 Hughes Ln', 'Highlands Ranch', 'highlands-ranch', null], ['9416 Desert Willow Trl', 'Highlands Ranch', 'highlands-ranch', null]];
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
mkdirSync(outDir, { recursive: true });
const get = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u.slice(0, 80)); return r.json(); };
const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const loadDoors = (t) => { const out = []; for (const f of [t, t + '-lookup']) { const p = `${DATA}/${f}.json`; if (!existsSync(p)) continue; const d = JSON.parse(readFileSync(p, 'utf8')); for (const x of (d.areas || []).flatMap((a) => a.doors || []).concat(d.doors || [])) out.push({ ...x, town: t }); } return out; };
const turfHR = (() => { try { return JSON.parse(readFileSync('drcog-turf/turf-highlands-ranch.json', 'utf8')).doors || {}; } catch { return {}; } })();
const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
/* the lots: hand-measured first, then per town PER tree lots (trees within 30 ft >= 35%) and PER open lots (< 15%), 0.12-0.45 acres, spread */
const lots = [];
for (const [addr, city, town, hand] of HAND) {
  const d = loadDoors(town).find((x) => norm(x.address) === norm(addr));
  if (d) { lots.push({ ...d, hand, kind: 'hand' }); continue; }
  try {
    const g = await get('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + new URLSearchParams({ address: addr + ', ' + city + ', CO', benchmark: 'Public_AR_Current', format: 'json' }));
    const m = g.result.addressMatches[0]; if (m) lots.push({ id: town + '-' + addr.toLowerCase().replace(/\W+/g, '-'), address: addr.toUpperCase(), lat: m.coordinates.y, lon: m.coordinates.x, town, hand, kind: 'hand', lawn: null, trees: null });
  } catch (e) { console.log('could not place ' + addr + ': ' + e.message); }
}
for (const t of TOWNS) {
  const all = loadDoors(t).filter((d) => d.lat && d.acres >= 0.12 && d.acres <= 0.45 && d.lawn && d.trees);
  for (const [kind, f] of [['trees', (d) => d.trees.z2 >= 0.35], ['open', (d) => d.trees.z2 < 0.15]]) {
    const pool = all.filter(f); for (let i = 0; i < Math.min(PER, pool.length); i++) lots.push({ ...pool[Math.floor((i + 0.5) * pool.length / Math.min(PER, pool.length))], kind });
  }
}
const resFile = join(outDir, 'results.json');
const rows = existsSync(resFile) ? JSON.parse(readFileSync(resFile, 'utf8')) : [];
const seen = new Set(rows.map((r) => r.id));
const token = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const read = (R, G, B, N, w, h, local, m2, ndviT) => {
  let inside = 0, green = 0; const cls = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; inside++; cls[i] = 1;
    const nd = (N[i] - R[i]) / (N[i] + R[i] + 1e-6);
    if (nd > ndviT) { green++; cls[i] = 2; }
  }
  const sf = (c) => Math.round(c * m2 * 10.7639);
  return { lot: sf(inside), green: sf(green), cls };
};
let pics = 0, done = 0;
for (const d of lots) {
  if (seen.has(d.id)) continue;
  if ((Date.now() - T0) / 60000 > MINS) { writeFileSync(resFile, JSON.stringify(rows, null, 1)); console.log('more left: ' + rows.length + ' of ' + lots.length + ' lots'); process.exit(3); }
  try {
    const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
    if (!pq.features || !pq.features.length) { rows.push({ id: d.id, address: d.address, town: d.town, kind: d.kind, error: 'no parcel at the point' }); seen.add(d.id); continue; }
    const rings = pq.features[0].geometry.rings;
    /* NAIP 2023, as the app reads it */
    const stac = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
    const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
    const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
    const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
    const pxN = rings.map((r) => r.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
    const xs = pxN.flat().map((p) => p[0]), ys = pxN.flat().map((p) => p[1]), pad = 4;
    const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, x1 = Math.ceil(Math.max(...xs)) + pad, y1 = Math.ceil(Math.max(...ys)) + pad;
    const [Rn, Gn, Bn, Nn] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
    const wn = x1 - x0, hn = y1 - y0, localN = pxN.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
    const naip = read(Rn, Gn, Bn, Nn, wn, hn, localN, res[0] * -res[1], 0.36);
    /* DRAPP 2022 at 3 inches, the same box in web mercator (mercator metres stretch by 1/cos(lat): ask for that many pixels) */
    const merc = rings.map((r) => r.map(([lo, la]) => proj4('EPSG:4326', 'EPSG:3857', [lo, la])));
    const mx = merc.flat().map((p) => p[0]), my = merc.flat().map((p) => p[1]), mp = 3;
    const bx0 = Math.min(...mx) - mp, by0 = Math.min(...my) - mp, bx1 = Math.max(...mx) + mp, by1 = Math.max(...my) + mp;
    const cell = CELL / Math.cos(d.lat * Math.PI / 180);
    const wd = Math.round((bx1 - bx0) / cell), hd = Math.round((by1 - by0) / cell);
    if (wd > 4000 || hd > 4000) { rows.push({ id: d.id, address: d.address, town: d.town, kind: d.kind, error: 'lot too big for one picture' }); seen.add(d.id); continue; }
    const buf = await (await fetch(DRAPP + '?' + new URLSearchParams({ f: 'image', format: 'tiff', bbox: [bx0, by0, bx1, by1].join(','), bboxSR: '3857', imageSR: '3857', size: wd + ',' + hd, interpolation: 'RSP_NearestNeighbor', pixelType: 'U8' }))).arrayBuffer();
    const dim = await (await fromArrayBuffer(buf)).getImage();
    const [Rd, Gd, Bd, Nd] = await dim.readRasters({ interleave: false });
    const W = dim.getWidth(), H = dim.getHeight();
    const localD = merc.map((r) => r.map(([X, Y]) => [(X - bx0) / (bx1 - bx0) * W, (by1 - Y) / (by1 - by0) * H]));
    const t20 = read(Rd, Gd, Bd, Nd, W, H, localD, CELL * CELL, 0.20), t36 = read(Rd, Gd, Bd, Nd, W, H, localD, CELL * CELL, 0.36);
    const tf = d.town === 'highlands-ranch' ? turfHR[d.id] : null;
    const row = { id: d.id, address: d.address, town: d.town, kind: d.kind, acres: d.acres || null, trees30ft: d.trees ? Math.round(d.trees.z2 * 100) + '%' : null, hand: d.hand || null,
      appLawn: d.lawn ? d.lawn.sq : null, naipGreen: naip.green, drapp3: { lot: t20.lot, green20: t20.green, green36: t36.green }, drcogTurf: tf ? tf.turf : null };
    rows.push(row); seen.add(d.id); done++; console.log(JSON.stringify(row));
    if (d.kind === 'hand' || pics < 24) {   /* a picture: NAIP scaled up 4x | DRAPP 3-inch, green tinted (leaf-off threshold) */
      pics++;
      const S = 4, Wn = wn * S, Hn = hn * S, Wt = Wn + 12 + W, Ht = Math.max(Hn, H);
      const png = new PNG({ width: Wt, height: Ht }); png.data.fill(255);
      const put = (x, y, r, g, b) => { const o = (y * Wt + x) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255; };
      const tint = (r, g, b, c) => c === 0 ? [r >> 1, g >> 1, b >> 1] : c === 2 ? [(r * 0.4 + 24) | 0, (g * 0.4 + 132) | 0, (b * 0.4 + 36) | 0] : [r, g, b];
      for (let y = 0; y < Hn; y++) for (let x = 0; x < Wn; x++) { const i = Math.floor(y / S) * wn + Math.floor(x / S); put(x, y, ...tint(Rn[i], Gn[i], Bn[i], naip.cls[i])); }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; put(Wn + 12 + x, y, ...tint(Rd[i], Gd[i], Bd[i], t20.cls[i])); }
      writeFileSync(join(outDir, d.id + '.png'), PNG.sync.write(png));
    }
    if (done % 10 === 0) writeFileSync(resFile, JSON.stringify(rows, null, 1));
  } catch (e) { rows.push({ id: d.id, address: d.address, town: d.town, kind: d.kind, error: String(e.message).slice(0, 120) }); seen.add(d.id); }
}
writeFileSync(resFile, JSON.stringify(rows, null, 1));
/* the summary: per kind, the median of DRAPP 3-inch green over NAIP green and over the app's lawn; and every hand-measured lot */
const ok = rows.filter((r) => !r.error && r.drapp3);
const med = (a) => { const s = a.filter((v) => isFinite(v)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const lines = ['DRAPP 2022 3-inch trial (Douglas County), ' + new Date().toISOString().slice(0, 10) + ': ' + ok.length + ' lots read, ' + (rows.length - ok.length) + ' could not be read', ''];
for (const k of ['trees', 'open']) {
  const g = ok.filter((r) => r.kind === k);
  lines.push(k + ' lots (' + g.length + '): DRAPP leaf-off green / NAIP green, median x' + (med(g.map((r) => r.drapp3.green20 / Math.max(1, r.naipGreen))) || 0).toFixed(2)
    + '; / app lawn x' + (med(g.map((r) => r.appLawn ? r.drapp3.green20 / r.appLawn : NaN)) || 0).toFixed(2));
}
lines.push('', 'Measured by hand:');
for (const r of rows.filter((x) => x.kind === 'hand')) lines.push('  ' + r.address + ': hand ' + (r.hand ?? '(waiting)') + ', app ' + (r.appLawn ?? '-') + ', NAIP ' + (r.naipGreen ?? '-') + ', DRAPP 3-inch ' + (r.drapp3 ? r.drapp3.green20 + ' (summer threshold ' + r.drapp3.green36 + ')' : r.error) + (r.drcogTurf != null ? ', DRCOG turf ' + r.drcogTurf : ''));
writeFileSync(join(outDir, 'summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log('done: ' + rows.length + ' lots; pictures, results.json and summary.txt in ' + outDir);

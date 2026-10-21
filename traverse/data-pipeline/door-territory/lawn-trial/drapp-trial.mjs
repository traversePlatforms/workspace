/* Does the sharper regional photo see more lawn under trees? (2026-10-21, Matthew: "I want all 3", part 3.)
   For each lot: USDA NAIP 2023 (30 cm, what the app uses) against DRAPP 2022 (DRCOG's regional photo, 6-inch / 15 cm, red-green-blue-
   infrared, CC BY 3.0; Jefferson County's copy, so Jefferson County lots only). Both read the same way: green = NDVI over a threshold;
   open ground = the lot less what is not green and bright (roofs, drives). DRAPP's infrared is calibrated differently from NAIP's, so it
   is read at two thresholds. A picture per lot: NAIP left, DRAPP right, green lawn tinted.
   Run:  node drapp-trial.mjs <town> <outdir> [count]      (lots under trees, 0.12-0.45 acres)
   Credit: imagery DRCOG DRAPP 2022, CC BY 3.0, via Jefferson County GIS. No Google imagery. */
import { fromUrl, fromArrayBuffer } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const [town, outDir, cnt] = process.argv.slice(2); const COUNT = +(cnt || 4);
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const DRAPP = 'https://gisportal.jeffco.us/image/rest/services/DRAPP/DRAPP2022/ImageServer/exportImage';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
mkdirSync(outDir, { recursive: true });
const get = async (u, o) => (await fetch(u, o)).json();
const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const doors = JSON.parse(readFileSync(`${DATA}/${town}.json`, 'utf8')).areas.flatMap((a) => a.doors)
  .filter((d) => d.trees && d.trees.z2 >= 0.35 && d.acres >= 0.12 && d.acres <= 0.45 && d.lat && d.lawn);
/* spread across the town: every n-th */
const pick = []; for (let i = 0; i < COUNT; i++) pick.push(doors[Math.floor((i + 0.5) * doors.length / COUNT)]);
const token = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const read = (R, G, B, N, w, h, local, m2, ndviT) => {
  let inside = 0, green = 0, hard = 0; const cls = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; inside++; cls[i] = 1;
    const nd = (N[i] - R[i]) / (N[i] + R[i] + 1e-6), br = (R[i] + G[i] + B[i]) / 3;
    if (nd > ndviT) { green++; cls[i] = 2; } else if (nd <= ndviT - 0.16 && br > 75) hard++;
  }
  const sf = (c) => Math.round(c * m2 * 10.7639);
  return { lot: sf(inside), green: sf(green), open: sf(inside - hard), cls };
};
const rows = [];
for (const d of pick) {
  const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  if (!pq.features || !pq.features.length) continue;
  const rings = pq.features[0].geometry.rings;
  /* NAIP 2023 */
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
  /* DRAPP 2022: the same box, web mercator, at its own 15 cm (mercator metres are stretched by 1/cos(lat): ask for that size) */
  const merc = rings.map((r) => r.map(([lo, la]) => proj4('EPSG:4326', 'EPSG:3857', [lo, la])));
  const mx = merc.flat().map((p) => p[0]), my = merc.flat().map((p) => p[1]), mp = 3;
  const bx0 = Math.min(...mx) - mp, by0 = Math.min(...my) - mp, bx1 = Math.max(...mx) + mp, by1 = Math.max(...my) + mp;
  const k = 1 / Math.cos(d.lat * Math.PI / 180), cell = 0.1524 * k;
  const wd = Math.round((bx1 - bx0) / cell), hd = Math.round((by1 - by0) / cell);
  const u = DRAPP + '?' + new URLSearchParams({ f: 'image', format: 'tiff', bbox: [bx0, by0, bx1, by1].join(','), bboxSR: '3857', imageSR: '3857', size: wd + ',' + hd, interpolation: 'RSP_NearestNeighbor', pixelType: 'U8' });
  const buf = await (await fetch(u)).arrayBuffer();
  let drapp = null, ddata = null;
  try {
    const dim = await (await fromArrayBuffer(buf)).getImage();
    const [Rd, Gd, Bd, Nd] = await dim.readRasters({ interleave: false });
    const W = dim.getWidth(), H = dim.getHeight();
    const localD = merc.map((r) => r.map(([X, Y]) => [(X - bx0) / (bx1 - bx0) * W, (by1 - Y) / (by1 - by0) * H]));
    const m2d = 0.1524 * 0.1524;
    drapp = { t36: read(Rd, Gd, Bd, Nd, W, H, localD, m2d, 0.36), t20: read(Rd, Gd, Bd, Nd, W, H, localD, m2d, 0.20) };
    ddata = { Rd, Gd, Bd, W, H };
  } catch (e) { drapp = { error: 'DRAPP read: ' + String(e.message).slice(0, 80) + ' (' + buf.byteLength + ' bytes)' }; }
  const row = { address: d.address, acres: d.acres, trees30ft: Math.round(d.trees.z2 * 100) + '%', appLawn: d.lawn.sq, naip: { lot: naip.lot, green: naip.green, open: naip.open },
    drapp: drapp && drapp.t36 ? { lot: drapp.t36.lot, green36: drapp.t36.green, green20: drapp.t20.green, open: drapp.t20.open } : drapp };
  rows.push(row); console.log(JSON.stringify(row));
  /* picture: NAIP (scaled up 2x to match 15 cm) | DRAPP, green tinted */
  if (ddata) {
    const S = 2, Wn = wn * S, Hn = hn * S, W = Math.max(Wn, ddata.W), Wt = Wn + 12 + ddata.W, Ht = Math.max(Hn, ddata.H);
    const png = new PNG({ width: Wt, height: Ht }); png.data.fill(255);
    const put = (x, y, r, g, b) => { const o = (y * Wt + x) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255; };
    for (let y = 0; y < Hn; y++) for (let x = 0; x < Wn; x++) { const i = Math.floor(y / S) * wn + Math.floor(x / S), c = naip.cls[i]; let r = Rn[i], g = Gn[i], b = Bn[i]; if (c === 0) { r >>= 1; g >>= 1; b >>= 1; } else if (c === 2) { r = (r * 0.4 + 40 * 0.6) | 0; g = (g * 0.4 + 220 * 0.6) | 0; b = (b * 0.4 + 60 * 0.6) | 0; } put(x, y, r, g, b); }
    const dc = drapp.t20.cls;
    for (let y = 0; y < ddata.H; y++) for (let x = 0; x < ddata.W; x++) { const i = y * ddata.W + x, c = dc[i]; let r = ddata.Rd[i], g = ddata.Gd[i], b = ddata.Bd[i]; if (c === 0) { r >>= 1; g >>= 1; b >>= 1; } else if (c === 2) { r = (r * 0.4 + 40 * 0.6) | 0; g = (g * 0.4 + 220 * 0.6) | 0; b = (b * 0.4 + 60 * 0.6) | 0; } put(Wn + 12 + x, y, r, g, b); }
    writeFileSync(join(outDir, d.id + '.png'), PNG.sync.write(png));
  }
}
writeFileSync(join(outDir, 'results.json'), JSON.stringify(rows, null, 1));
console.log('done: ' + rows.length + ' lots; pictures and results.json in ' + outDir);

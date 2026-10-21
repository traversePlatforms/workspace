// The lawn range for a tree-heavy lot (2026-10-21, Matthew: "we absolutely need to get this as accurate as we can"). Run by the app on
// the server (api/rounds.php, action lawnrange) when a lot under trees opens in the Quote builder; prints one JSON line.
//   node lawn-range.mjs --lat 39.5319 --lon -104.7633
// low  = ground that is green and under 1 m on the height map, before the solid-patch filter (the filter drops lawn broken up by tree
//        shadows; checked against hand measures: Marsh Hawk 2,194 vs 2,344, Settlers 4,007 vs 10,473)
// high = open ground: the lot minus what is not green and bright (roofs, drives, patios); shaded and tree-covered ground counts, as
//        grass may be under it (Settlers 10,456 vs Jen's Google Earth 10,473; at or above every hand measure we hold)
// Sources as the towns: the state parcel layer, USDA NAIP 2023 (Planetary Computer), the Meta/WRI canopy-height map. Never Google imagery.
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const lat = +arg('lat'), lon = +arg('lon');
const done = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); process.exit(0); };
if (!(lat > 30 && lat < 45 && lon < -100 && lon > -110)) done({ ok: false, error: 'bad point' });
const T = { ndvi: 0.36, short: 1, hardNdvi: 0.2, hardBright: 75 };
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const get = async (u, o) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, o); if (r.ok) return await r.json(); } catch {} await new Promise((r) => setTimeout(r, 800 * (i + 1))); } throw new Error('fetch ' + u.slice(0, 60)); };
try {
  const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  if (!pq.features || !pq.features.length) done({ ok: false, error: 'no lot at that point' });
  const rings = pq.features[0].geometry.rings;
  const stac = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
  const item = (stac.features || []).sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
  if (!item) done({ ok: false, error: 'no 2023 photo here' });
  const token = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
  const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
  const px = rings.map((r) => r.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]), pad = 4;
  const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, x1 = Math.ceil(Math.max(...xs)) + pad, y1 = Math.ceil(Math.max(...ys)) + pad;
  if (x1 - x0 > 2200 || y1 - y0 > 2200) done({ ok: false, error: 'lot too big to measure' });
  const [R, G, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  const w = x1 - x0, h = y1 - y0;
  const quadkey = (lo, la, z) => { const s = Math.sin(la * Math.PI / 180); const x = Math.floor((lo + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); let q = ''; for (let i = z; i > 0; i--) { let dg = 0; const m = 1 << (i - 1); if (x & m) dg++; if (y & m) dg += 2; q += dg; } return q; };
  const chIm = await (await fromUrl(CHM + quadkey(lon, lat, 9) + '.tif')).getImage(), chO = chIm.getOrigin(), chR = chIm.getResolution();
  const toM = (a, b) => proj4(epsg, 'EPSG:3857', [origin[0] + (x0 + a) * res[0], origin[1] + (y0 + b) * res[1]]);
  const cp = ([X, Y]) => [(X - chO[0]) / chR[0], (Y - chO[1]) / chR[1]];
  const p00 = cp(toM(0, 0)), p10 = cp(toM(w, 0)), p01 = cp(toM(0, h)), p11 = cp(toM(w, h));
  const hx0 = Math.max(0, Math.floor(Math.min(p00[0], p10[0], p01[0], p11[0])) - 1), hy0 = Math.max(0, Math.floor(Math.min(p00[1], p10[1], p01[1], p11[1])) - 1);
  const hx1 = Math.min(chIm.getWidth(), Math.ceil(Math.max(p00[0], p10[0], p01[0], p11[0])) + 1), hy1 = Math.min(chIm.getHeight(), Math.ceil(Math.max(p00[1], p10[1], p01[1], p11[1])) + 1);
  const HT = (await chIm.readRasters({ window: [hx0, hy0, hx1, hy1] }))[0], hw = hx1 - hx0;
  const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const local = px.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
  let inside = 0, low = 0, hard = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; inside++;
    const ndvi = (N[i] - R[i]) / (N[i] + R[i] + 1e-6), br = (R[i] + G[i] + B[i]) / 3;
    const fx = (x + 0.5) / w, fy = (y + 0.5) / h;
    const X = p00[0] + (p10[0] - p00[0]) * fx + (p01[0] - p00[0]) * fy, Y = p00[1] + (p10[1] - p00[1]) * fx + (p01[1] - p00[1]) * fy;
    const ht = HT[Math.floor(Y - hy0) * hw + Math.floor(X - hx0)] || 0;
    if (ndvi > T.ndvi && ht <= T.short) low++;
    if (ndvi <= T.hardNdvi && br > T.hardBright) hard++;
  }
  const m2 = res[0] * -res[1], sf = (c) => Math.round(c * m2 * 10.7639 / 100) * 100;
  done({ ok: true, low: sf(low), high: sf(inside - hard), lot: sf(inside), d: (item.properties.datetime || '').slice(0, 10) });
} catch (e) { done({ ok: false, error: String(e && e.message || e).slice(0, 120) }); }

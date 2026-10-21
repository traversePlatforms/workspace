/* Why did the lawn scan give this lot the number it gave? (2026-10-21, 11663 N Settlers Dr: 226 sq ft against Jen's 10,473 hand-measured
   in Google Earth.) The same rule as lawn-mask.mjs / sample-lawn.mjs, step by step, with a picture:
     green  = NDVI > 0.36 on the 2023 NAIP photo
     short  = the Meta/WRI canopy-height map says under 1 m there
     lawn   = green and short, in a solid patch (150 px or more, not ragged)
   Output: the counts at each step in sq ft, and a PNG: kept lawn green, green-but-"tall" yellow, green-but-dropped patch orange,
   not green grey. No Google imagery (their terms forbid it).
   Run:  ADDR="11663 SETTLERS DR" TOWN=parker node diag-lot.mjs out.png */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
const T = { ndvi: 0.36, short: 1, tall: 2, minpx: 150, rag: 10.5 };   /* as lawn-mask.mjs */
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const get = async (u, o) => (await fetch(u, o)).json();
const j = JSON.parse(readFileSync(`${DATA}/${process.env.TOWN}.json`, 'utf8'));
const d = j.areas.flatMap((a) => a.doors).find((x) => x.address === process.env.ADDR);
if (!d) throw new Error('door not found');
const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
const rings = pq.features[0].geometry.rings;
const stac = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
const token = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
const px = rings.map((r) => r.map(([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]), pad = 4;
const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, x1 = Math.ceil(Math.max(...xs)) + pad, y1 = Math.ceil(Math.max(...ys)) + pad;
const [R, G, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
const w = x1 - x0, h = y1 - y0, n = w * h;
/* the height map (as lawn-mask.mjs) */
const quadkey = (lon, lat, z) => { const s = Math.sin(lat * Math.PI / 180); const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); let q = ''; for (let i = z; i > 0; i--) { let dg = 0; const m = 1 << (i - 1); if (x & m) dg++; if (y & m) dg += 2; q += dg; } return q; };
const chIm = await (await fromUrl(CHM + quadkey(d.lon, d.lat, 9) + '.tif')).getImage(), chO = chIm.getOrigin(), chR = chIm.getResolution();
const toM = (a, b) => proj4(epsg, 'EPSG:3857', [origin[0] + (x0 + a) * res[0], origin[1] + (y0 + b) * res[1]]);
const cp = ([X, Y]) => [(X - chO[0]) / chR[0], (Y - chO[1]) / chR[1]];
const p00 = cp(toM(0, 0)), p10 = cp(toM(w, 0)), p01 = cp(toM(0, h)), p11 = cp(toM(w, h));
const hx0 = Math.max(0, Math.floor(Math.min(p00[0], p10[0], p01[0], p11[0])) - 1), hy0 = Math.max(0, Math.floor(Math.min(p00[1], p10[1], p01[1], p11[1])) - 1);
const hx1 = Math.ceil(Math.max(p00[0], p10[0], p01[0], p11[0])) + 1, hy1 = Math.ceil(Math.max(p00[1], p10[1], p01[1], p11[1])) + 1;
const HT = (await chIm.readRasters({ window: [hx0, hy0, hx1, hy1] }))[0], hw = hx1 - hx0;
const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const local = px.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
/* 0 outside, 1 not green, 2 green+short (candidate lawn), 4 green but tall per height map, 5 tall not green */
const cls = new Uint8Array(n), hts = new Float32Array(n); let inside = 0, green = 0, gShort = 0, gTall = 0; const hard = { 60: 0, 75: 0, 90: 0 }, dark = { 60: 0, 75: 0, 90: 0 };   /* not green: bright = roof or paving; dark = shadow (may be grass) */
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (!inRings(x + 0.5, y + 0.5, local)) continue;
  const i = y * w + x; inside++;
  const ndvi = (N[i] - R[i]) / (N[i] + R[i] + 1e-6);
  const fx = (x + 0.5) / w, fy = (y + 0.5) / h;
  const X = p00[0] + (p10[0] - p00[0]) * fx + (p01[0] - p00[0]) * fy, Y = p00[1] + (p10[1] - p00[1]) * fx + (p01[1] - p00[1]) * fy;
  const ht = HT[Math.floor(Y - hy0) * hw + Math.floor(X - hx0)] || 0; hts[i] = ht;
  const br = (R[i] + G[i] + B[i]) / 3; if (ndvi <= 0.2) for (const L of [60, 75, 90]) { if (br > L) hard[L]++; else dark[L]++; }
  if (ndvi > T.ndvi) { green++; if (ht <= T.short) { cls[i] = 2; gShort++; } else { cls[i] = 4; gTall++; } } else cls[i] = ht >= T.tall ? 5 : 1;
}
/* patches: small or ragged ones dropped (cls 6) */
const seen = new Uint8Array(n); let dropSmall = 0, dropRag = 0, kept = 0, nPatch = 0, nKept = 0; const spare = { 500: 0, 1000: 0, 2000: 0 };   /* ragged but at least this many px: what sparing them would add */
for (let s0 = 0; s0 < n; s0++) {
  if (cls[s0] !== 2 || seen[s0]) continue;
  const comp = [], st = [s0]; seen[s0] = 1;
  while (st.length) { const p = st.pop(); comp.push(p); const a = p % w, b = (p - a) / w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = a + dx, qy = b + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy * w + qx; if (!seen[q] && cls[q] === 2) { seen[q] = 1; st.push(q); } } }
  nPatch++;
  const inC = new Set(comp); let edge = 0;
  for (const p of comp) { const a = p % w, b = (p - a) / w; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inC.has((b + dy) * w + a + dx))) edge++; }
  const small = comp.length < T.minpx, rag = edge / Math.sqrt(comp.length) > T.rag;
  if (small || rag) { for (const p of comp) cls[p] = 6; if (small) dropSmall += comp.length; else { dropRag += comp.length; for (const L of [500, 1000, 2000]) if (comp.length >= L) spare[L] += comp.length; } } else { kept += comp.length; nKept++; }
}
const m2 = res[0] * -res[1], sf = (c) => Math.round(c * m2 * 10.7639);
/* the height map under the green pixels: what it thinks they are */
const gh = []; for (let i = 0; i < n; i++) if (cls[i] === 4) gh.push(hts[i]); gh.sort((a, b) => a - b);
const q = (p) => gh.length ? gh[Math.floor(p * (gh.length - 1))].toFixed(1) : '-';
console.log(JSON.stringify({
  address: d.address, photo: item.properties.datetime?.slice(0, 10), pixel_m: +res[0].toFixed(2), heightMapPixel_m: +chR[0].toFixed(2),
  lot_sqft: sf(inside), green_sqft: sf(green), green_short_sqft: sf(gShort), green_but_tall_per_heightmap_sqft: sf(gTall),
  dropped_small_patch_sqft: sf(dropSmall), dropped_ragged_patch_sqft: sf(dropRag), kept_lawn_sqft: sf(kept), open_if_bright_over_60: sf(inside - hard[60]), open_75: sf(inside - hard[75]), open_90: sf(inside - hard[90]), if_ragged_patches_spared_over_500px: sf(kept + spare[500]), over_1000px: sf(kept + spare[1000]), over_2000px: sf(kept + spare[2000]), patches: nPatch, patches_kept: nKept,
  heightmap_m_under_green_tall: { p10: q(0.1), median: q(0.5), p90: q(0.9) }
}, null, 1));
/* picture */
const S = 4, png = new PNG({ width: w * S, height: h * S });
const col = { 0: null, 1: [150, 150, 150], 2: [40, 170, 60], 4: [240, 200, 30], 5: [90, 90, 90], 6: [240, 120, 40] };
for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) {
  const i = Math.floor(y / S) * w + Math.floor(x / S), o = (y * png.width + x) * 4, c = col[cls[i]];
  const base = [R[i], G[i], B[i]];
  const mixc = c ? base.map((v, k) => Math.round(v * 0.35 + c[k] * 0.65)) : base.map((v) => Math.round(v * 0.5));
  png.data[o] = mixc[0]; png.data[o + 1] = mixc[1]; png.data[o + 2] = mixc[2]; png.data[o + 3] = 255;
}
writeFileSync(process.argv[2] || 'diag.png', PNG.sync.write(png));
console.log('picture: kept lawn green · green but "tall" on the height map yellow · green patch dropped as small or ragged orange · not green grey');

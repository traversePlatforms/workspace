/* Green but "tall" (2026-10-21, Matthew: "go ahead and do 1 and 2"). The lawn scan drops green ground wherever the Meta/WRI canopy-height
   map (about 1.2 m pixels) says it is over 1 m tall. At 9416 Desert Willow Trl that threw out a 1,126 sq ft back yard; at 11663 Settlers Dr
   most of a 10,473 sq ft lawn. This tries rules for taking some of that ground back, against the lots measured by hand:
     now      green and short, in solid patches (the app today)
     ignoreH  green, height ignored, same patch filter
     bright   green-but-tall counted when it looks like grass on the photo: brighter than a tree crown and smooth (low texture)
     drcog    green-but-tall counted where DRCOG's 2020 land cover calls it turf (class 6); Douglas County is covered, El Paso is not
     both     bright OR drcog
   Sources: the state parcel layer, USDA NAIP 2023 (Planetary Computer), the Meta/WRI canopy-height map, DRCOG 2020 land cover
   (Planetary Computer drcog-lulc). Never Google imagery.
   Run:  node tall-trial.mjs  (writes tall-trial-2026-10-21/results.json and one picture per lot) */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const LOTS = [
  { addr: '2787 RUSSET SKY CT', town: 'castle-rock', hand: 3898, note: 'Matthew, Google Maps, grass only' },
  { addr: '1648 MARSH HAWK CIR', town: 'castle-rock', hand: 2344, note: 'Matthew, Google Maps; back yard under 3 trees' },
  { addr: '7378 UPTON CT', town: 'franktown', hand: 2595, note: 'Matthew, Google Maps, watered lawn only' },
  { addr: '11663 SETTLERS DR', town: 'parker', hand: 10473, note: 'Jen, Google Earth, grass under the trees too' },
  { addr: '9554 PENSTEMON CT', town: 'black-forest', hand: 5746, upper: true, note: 'upper bound only; El Paso, no DRCOG' },
  { addr: '9416 DESERT WILLOW TRL', town: 'highlands-ranch', hand: null, note: 'quoted 2026-10-21; no hand measure yet' },
];
const T = { ndvi: 0.36, short: 1, minpx: 150, rag: 10.5 };
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds', OUT = new URL('./tall-trial-2026-10-21/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
proj4.defs('EPSG:6428', '+proj=lcc +lat_0=37.8333333333333 +lon_0=-105.5 +lat_1=39.75 +lat_2=38.45 +x_0=914401.828803658 +y_0=304800.609601219 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs');
const get = async (u, o) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, o); if (r.ok) return await r.json(); } catch {} await new Promise((r) => setTimeout(r, 800 * (i + 1))); } throw new Error('fetch ' + u.slice(0, 60)); };
const quadkey = (lon, lat, z) => { const s = Math.sin(lat * Math.PI / 180); const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); let q = ''; for (let i = z; i > 0; i--) { let dg = 0; const m = 1 << (i - 1); if (x & m) dg++; if (y & m) dg += 2; q += dg; } return q; };
const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const naipTok = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const lulcTok = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/drcog-lulc')).token;
const results = [];
for (const L of LOTS) {
  const j = JSON.parse(readFileSync(`${DATA}/${L.town}.json`, 'utf8'));
  const d = j.areas.flatMap((a) => a.doors).find((x) => x.address === L.addr);
  if (!d) { results.push({ ...L, error: 'door not found' }); continue; }
  const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const rings = pq.features[0].geometry.rings;
  const stac = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
  const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
  const im = await (await fromUrl(item.assets.image.href + '?' + naipTok)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
  const px = rings.map((r) => r.map(([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]), pad = 4;
  const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, x1 = Math.ceil(Math.max(...xs)) + pad, y1 = Math.ceil(Math.max(...ys)) + pad;
  if (x1 - x0 > 2200 || y1 - y0 > 2200) { results.push({ ...L, error: 'lot too big' }); continue; }
  const [R, G, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  const w = x1 - x0, h = y1 - y0, n = w * h;
  /* height map */
  const chIm = await (await fromUrl(CHM + quadkey(d.lon, d.lat, 9) + '.tif')).getImage(), chO = chIm.getOrigin(), chR = chIm.getResolution();
  const toM = (a, b) => proj4(epsg, 'EPSG:3857', [origin[0] + (x0 + a) * res[0], origin[1] + (y0 + b) * res[1]]);
  const cp = ([X, Y]) => [(X - chO[0]) / chR[0], (Y - chO[1]) / chR[1]];
  const p00 = cp(toM(0, 0)), p10 = cp(toM(w, 0)), p01 = cp(toM(0, h)), p11 = cp(toM(w, h));
  const hx0 = Math.max(0, Math.floor(Math.min(p00[0], p10[0], p01[0], p11[0])) - 1), hy0 = Math.max(0, Math.floor(Math.min(p00[1], p10[1], p01[1], p11[1])) - 1);
  const hx1 = Math.ceil(Math.max(p00[0], p10[0], p01[0], p11[0])) + 1, hy1 = Math.ceil(Math.max(p00[1], p10[1], p01[1], p11[1])) + 1;
  const HT = (await chIm.readRasters({ window: [hx0, hy0, hx1, hy1] }))[0], hw = hx1 - hx0;
  /* DRCOG land cover, where it covers */
  let LC = null, lcAt = null;
  try {
    const ls = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['drcog-lulc'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, limit: 10 }) });
    const li = (ls.features || []).filter((f) => /2020/.test(f.id))[0];
    if (li) {
      const la = Object.values(li.assets).find((a) => /tif/.test(a.type || '') || /\.tif/.test(a.href));
      const lim = await (await fromUrl(la.href + '?' + lulcTok)).getImage(), lo0 = lim.getOrigin(), lr = lim.getResolution();
      const toL = (a, b) => { const [X, Y] = proj4(epsg, 'EPSG:6428', [origin[0] + (x0 + a) * res[0], origin[1] + (y0 + b) * res[1]]); return [(X - lo0[0]) / lr[0], (Y - lo0[1]) / lr[1]]; };
      const c = [toL(0, 0), toL(w, 0), toL(0, h), toL(w, h)];
      const a0 = Math.max(0, Math.floor(Math.min(...c.map((p) => p[0]))) - 2), b0 = Math.max(0, Math.floor(Math.min(...c.map((p) => p[1]))) - 2);
      const a1 = Math.min(lim.getWidth(), Math.ceil(Math.max(...c.map((p) => p[0]))) + 2), b1 = Math.min(lim.getHeight(), Math.ceil(Math.max(...c.map((p) => p[1]))) + 2);
      if (a1 > a0 && b1 > b0) { const [Cl] = await lim.readRasters({ window: [a0, b0, a1, b1] }); const lw = a1 - a0; LC = Cl; lcAt = (a, b) => { const [u, v] = toL(a, b); const ix = Math.floor(u) - a0, iy = Math.floor(v) - b0; return ix >= 0 && iy >= 0 && ix < lw && iy < b1 - b0 ? Cl[iy * lw + ix] : 0; }; }
    }
  } catch (e) { /* no land cover */ }
  /* per pixel */
  const local = px.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
  const ins = new Uint8Array(n), green = new Uint8Array(n), tall = new Uint8Array(n), turf = new Uint8Array(n), br = new Float32Array(n);
  let inside = 0, gTall = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; ins[i] = 1; inside++;
    const ndvi = (N[i] - R[i]) / (N[i] + R[i] + 1e-6); br[i] = (R[i] + G[i] + B[i]) / 3;
    const fx = (x + 0.5) / w, fy = (y + 0.5) / h;
    const X = p00[0] + (p10[0] - p00[0]) * fx + (p01[0] - p00[0]) * fy, Y = p00[1] + (p10[1] - p00[1]) * fx + (p01[1] - p00[1]) * fy;
    const ht = HT[Math.floor(Y - hy0) * hw + Math.floor(X - hx0)] || 0;
    if (ndvi > T.ndvi) { green[i] = 1; if (ht > T.short) { tall[i] = 1; gTall++; } }
    if (lcAt && lcAt(x + 0.5, y + 0.5) === 6) turf[i] = 1;
  }
  /* texture: brightness spread in a 5x5 window (tree crowns are lumpy, grass is even) */
  const tex = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!green[i]) continue; let s = 0, s2 = 0, c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const v = br[yy * w + xx]; s += v; s2 += v * v; c++; } tex[i] = Math.sqrt(Math.max(0, s2 / c - (s / c) ** 2)); }
  /* the short green ground's look on this photo: what grass looks like here */
  const sb = [], st = []; for (let i = 0; i < n; i++) if (green[i] && !tall[i]) { sb.push(br[i]); st.push(tex[i]); }
  sb.sort((a, b) => a - b); st.sort((a, b) => a - b);
  const pct = (a, p) => a.length ? a[Math.floor(p * (a.length - 1))] : 0;
  const brMin = sb.length > 200 ? pct(sb, 0.25) : 70, texMax = st.length > 200 ? pct(st, 0.75) : 8;
  const patchSum = (cand) => {   /* the app's patch filter: 150 px or more, not ragged */
    const seen = new Uint8Array(n); let kept = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (!cand[s0] || seen[s0]) continue;
      const comp = [], stk = [s0]; seen[s0] = 1;
      while (stk.length) { const p = stk.pop(); comp.push(p); const a = p % w, b = (p - a) / w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = a + dx, qy = b + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy * w + qx; if (cand[q] && !seen[q]) { seen[q] = 1; stk.push(q); } } }
      if (comp.length < T.minpx) continue;
      const inC = new Set(comp); let edge = 0;
      for (const p of comp) { const a = p % w, b = (p - a) / w; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inC.has((b + dy) * w + a + dx))) edge++; }
      if (edge / Math.sqrt(comp.length) > T.rag) continue;
      kept += comp.length;
    }
    return kept;
  };
  const mk = (f) => { const c = new Uint8Array(n); for (let i = 0; i < n; i++) if (ins[i] && green[i] && f(i)) c[i] = 1; return c; };
  const looksGrass = (i) => br[i] >= brMin && tex[i] <= texMax;
  const C = {
    now: mk((i) => !tall[i]),
    ignoreH: mk(() => true),
    bright: mk((i) => !tall[i] || looksGrass(i)),
    drcog: LC ? mk((i) => !tall[i] || turf[i]) : null,
    both: LC ? mk((i) => !tall[i] || looksGrass(i) || turf[i]) : null,
  };
  const m2 = res[0] * -res[1], sf = (c) => Math.round(c * m2 * 10.7639 / 10) * 10;
  const r = { addr: L.addr, town: L.town, hand: L.hand, upper: !!L.upper, note: L.note, lot: sf(inside), greenTall: sf(gTall), grassLook: { brMin: Math.round(brMin), texMax: +texMax.toFixed(1) }, drcog: !!LC };
  for (const k of Object.keys(C)) r[k] = C[k] ? sf(patchSum(C[k])) : null;
  results.push(r);
  console.log(JSON.stringify(r));
  /* picture: now (green), taken back by "both" (cyan), green-tall still dropped (yellow) */
  const S = 3, png = new PNG({ width: w * S, height: h * S }), nowC = C.now, bothC = C.both || C.bright;
  for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) {
    const i = Math.floor(y / S) * w + Math.floor(x / S), o = (y * png.width + x) * 4, base = [R[i], G[i], B[i]];
    const c = !ins[i] ? null : nowC[i] ? [40, 170, 60] : bothC[i] ? [40, 200, 220] : (green[i] && tall[i]) ? [240, 200, 30] : null;
    const m = c ? base.map((v, k) => Math.round(v * 0.35 + c[k] * 0.65)) : base.map((v) => Math.round(v * (ins[i] ? 0.8 : 0.45)));
    png.data[o] = m[0]; png.data[o + 1] = m[1]; png.data[o + 2] = m[2]; png.data[o + 3] = 255;
  }
  writeFileSync(new URL(L.addr.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png', OUT), PNG.sync.write(png));
}
writeFileSync(new URL('results.json', OUT), JSON.stringify(results, null, 1));
console.log('\nlot | hand | now | ignoreH | bright | drcog | both');
for (const r of results) if (!r.error) console.log([r.addr, (r.upper ? '<=' : '') + (r.hand ?? '-'), r.now, r.ignoreH, r.bright, r.drcog ?? '-', r.both ?? '-'].join(' | '));

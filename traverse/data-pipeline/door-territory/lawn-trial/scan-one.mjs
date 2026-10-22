/* Every source we have, on one lot (2026-10-22, Matthew: "run a quick scan ... 3855 S Valentia Ct 80237 ... make it as accurate as you
   can with the scan use whatever satelites lasers etc that we have"). The app's own pull (pull-property.mjs) read this lot as no lawn, so
   this reads it every way we can and draws it:
     lot     the state parcel layer, found by its address text (Denver sends no acreage, so the area comes from the outline)
     photo   NAIP 2023 and 2021 (30/60 cm, infrared), green = NDVI > 0.36, as the app
     laser   USGS 3DEP LiDAR (DRCOG 2020), 1 m height above ground: under 0.5 m = ground level; 2 m+ with split returns = tree;
             2.5 m+ with single returns = roof
     lawn    green on the photo AND ground level on the laser: the photo says it is growing, the laser says it is not a tree or a roof
     turf    DRCOG 2020 regional land cover, class 6 turf/irrigated and class 5 tree canopy (a trial layer: commercial terms not stated)
   Prints one JSON line and writes <out>.png: the 2023 photo with lawn green, trees yellow, roofs grey, the lot line white.
   No Google imagery (their terms forbid automated analysis). No owner fields are read.
     node scan-one.mjs --address "3855 S Valentia Ct" --out scan.png */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { heightGrid } from '../tree-zones/lidar.mjs';
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const PC = 'https://planetarycomputer.microsoft.com/api';
const LIDAR = 'CO_DRCOG_2_2020', CACHE = fileURLToPath(new URL('../tree-zones/lidar-cache/', import.meta.url));
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
proj4.defs('EPSG:6428', '+proj=lcc +lat_0=37.8333333333333 +lon_0=-105.5 +lat_1=39.75 +lat_2=38.45 +x_0=914401.828803658 +y_0=304800.609601219 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs');
const get = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u.slice(0, 80)); return r.json(); };
const SQFT = 10.7639;
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const inRings = (x, y, rr) => rr.reduce((n, r) => n + (inRing(x, y, r) ? 1 : 0), 0) % 2 === 1;

/* 1. the lot, by its address text */
const street = String(A.address || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const pj = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', where: `UPPER(situsAdd) = '${street.replace(/'/g, "''")}'`, outFields: 'situsAdd,sitAddCty,legalDesc,landUseDsc,apprValTot', returnGeometry: 'true', outSR: '4326' }));
const pf = (pj.features || [])[0]; if (!pf) { console.log(JSON.stringify({ ok: false, error: 'no lot with that address' })); process.exit(1); }
const rings = pf.geometry.rings;
const pts = rings[0], lon = pts.reduce((s, p) => s + p[0], 0) / pts.length, lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
const k = Math.cos(lat * Math.PI / 180);
const merc = (lo, la) => proj4('EPSG:4326', 'EPSG:3857', [lo, la]);
const M = rings.map((r) => r.map(([lo, la]) => merc(lo, la)));
let a2 = 0; for (const r of M) for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; a2 += x1 * y2 - x2 * y1; }
const lotSqft = Math.round(Math.abs(a2 / 2) * k * k * SQFT);

/* 2. the laser: a 1 m grid over the lot and a little around it */
const mx = M.flat().map((p) => p[0]), my = M.flat().map((p) => p[1]), pad = 6 / k;
const box = [Math.min(...mx) - pad, Math.min(...my) - pad, Math.max(...mx) + pad, Math.max(...my) + pad];
const G = await heightGrid(LIDAR, box, 1 / k, CACHE);
const lidarAt = (X, Y) => { const c = Math.floor((X - G.x0) / G.cell), r = Math.floor((G.y1 - Y) / G.cell); if (c < 0 || r < 0 || c >= G.w || r >= G.h) return null; const o = r * G.w + c; return Number.isNaN(G.hgt[o]) ? null : { h: G.hgt[o], multi: G.multi[o] }; };
const kind = (L) => !L ? 'none' : L.h < 0.5 ? 'ground' : (L.h >= 2 && L.multi) ? 'tree' : (L.h >= 2.5 && !L.multi) ? 'roof' : 'low';   /* low = shrubs, fences, cars */
let lzTree = 0, lzRoof = 0, lzGround = 0, lzLow = 0, lzN = 0; const tops = [];
for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) {
  const X = G.x0 + (c + 0.5) * G.cell, Y = G.y1 - (r + 0.5) * G.cell; if (!inRings(X, Y, M)) continue;
  const o = r * G.w + c, L = Number.isNaN(G.hgt[o]) ? null : { h: G.hgt[o], multi: G.multi[o] }; lzN++;
  const kd = kind(L); if (kd === 'tree') { lzTree++; if (L.h >= 6) { let top = true; for (let dr = -2; dr <= 2 && top; dr++) for (let dc = -2; dc <= 2; dc++) { const v = G.hgt[(r + dr) * G.w + c + dc]; if ((dr || dc) && v > L.h) { top = false; break; } } if (top) tops.push(Math.round(L.h * 3.281)); } }
  else if (kd === 'roof') lzRoof++; else if (kd === 'ground') lzGround++; else if (kd === 'low') lzLow++;
}
const cellSqft = 1 * SQFT;   /* each laser cell is 1 m square on the ground */

/* 3. the photos: NAIP 2023 and 2021, the lot window */
async function naip(year) {
  const tok = (await get(PC + '/sas/v1/token/naip')).token;
  const st = await get(PC + '/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, query: { 'naip:year': { eq: String(year) } }, limit: 3 }) });
  const item = (st.features || []).sort((a, b) => a.properties.gsd - b.properties.gsd)[0]; if (!item) return null;
  const im = await (await fromUrl(item.assets.image.href + '?' + tok)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
  const P = rings.map((r) => r.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = P.flat().map((p) => p[0]), ys = P.flat().map((p) => p[1]), pd = 6;
  const x0 = Math.floor(Math.min(...xs)) - pd, y0 = Math.floor(Math.min(...ys)) - pd, x1 = Math.ceil(Math.max(...xs)) + pd, y1 = Math.ceil(Math.max(...ys)) + pd;
  const [R, Gg, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  const w = x1 - x0, h = y1 - y0, px2 = res[0] * -res[1] * SQFT;
  const cls = new Uint8Array(w * h);   /* 0 outside, 1 inside, 2 green, 3 lawn (green + ground level), 4 tree, 5 roof */
  let green = 0, lawn = 0, greenTall = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, gx = origin[0] + (x0 + x + 0.5) * res[0], gy = origin[1] + (y0 + y + 0.5) * res[1];
    const [lo, la] = proj4(epsg, 'EPSG:4326', [gx, gy]); const [X, Y] = merc(lo, la);
    const L = lidarAt(X, Y), kd = kind(L);
    if (!inRings(X, Y, M)) { cls[i] = kd === 'tree' ? 14 : kd === 'roof' ? 15 : 0; continue; }
    cls[i] = kd === 'roof' ? 5 : kd === 'tree' ? 4 : 1;
    const nd = (N[i] - R[i]) / (N[i] + R[i] + 1e-6);
    if (nd > 0.36) { green++; if (kd === 'ground' || kd === 'none') { lawn++; cls[i] = 3; } else greenTall++; }
  }
  return { year, date: item.properties.datetime ? item.properties.datetime.slice(0, 10) : null, gsd: item.properties.gsd, green: Math.round(green * px2), lawn: Math.round(lawn * px2), greenNotGround: Math.round(greenTall * px2), R, Gg, B, w, h, cls };
}
const n23 = await naip(2023), n21 = await naip(2021);

/* 4. DRCOG 2020 land cover */
let turf = null;
try {
  const tok = (await get(PC + '/sas/v1/token/drcog-lulc')).token;
  const ls = await get(PC + '/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['drcog-lulc'], intersects: { type: 'Point', coordinates: [lon, lat] }, limit: 10 }) });
  const li = (ls.features || []).filter((f) => /2020/.test(f.id))[0];
  if (li) {
    const as = Object.values(li.assets).find((x) => /tif/.test(x.type || '') || /\.tif/.test(x.href));
    const im = await (await fromUrl(as.href + '?' + tok)).getImage();
    const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, o = im.getOrigin(), rs = im.getResolution();
    const P = rings.map((r) => r.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - o[0]) / rs[0], (Y - o[1]) / rs[1]]; }));
    const xs = P.flat().map((p) => p[0]), ys = P.flat().map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)) - 1, y0 = Math.floor(Math.min(...ys)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1, y1 = Math.ceil(Math.max(...ys)) + 1;
    const [C] = await im.readRasters({ window: [x0, y0, x1, y1] }); const w = x1 - x0;
    const unit = epsg === 'EPSG:6428' ? 1 : SQFT, a = Math.abs(rs[0] * rs[1]) * unit;   /* 6428 is in US feet already */
    let t6 = 0, t5 = 0;
    for (let y = 0; y < y1 - y0; y++) for (let x = 0; x < w; x++) { if (!inRings(x + x0 + 0.5, y + y0 + 0.5, P)) continue; const v = C[y * w + x]; if (v === 6) t6++; if (v === 5) t5++; }
    turf = { turf: Math.round(t6 * a), canopy: Math.round(t5 * a), year: 2020 };
  }
} catch (e) { turf = { error: String(e.message).slice(0, 100) }; }

/* 5. the picture: the 2023 photo, 6x, lawn green, trees yellow, roofs grey, the lot line white */
if (A.out && n23) {
  const S = 6, W = n23.w * S, H = n23.h * S, png = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.floor(y / S) * n23.w + Math.floor(x / S), c = n23.cls[i]; let r = n23.R[i], g = n23.Gg[i], b = n23.B[i];
    if (c === 0) { r >>= 1; g >>= 1; b >>= 1; }
    else if (c === 3) { r = r * 0.35 + 20 | 0; g = g * 0.35 + 150 | 0; b = b * 0.35 + 40 | 0; }
    else if (c === 4) { r = r * 0.5 + 120 | 0; g = g * 0.5 + 110 | 0; b = b * 0.5 | 0; }
    else if (c === 5) { r = g = b = (r + g + b) / 3 * 0.5 + 90 | 0; }
    const o = (y * W + x) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255;
  }
  writeFileSync(A.out, PNG.sync.write(png));
}
const strip = (n) => n && { year: n.year, date: n.date, gsd: n.gsd, green: n.green, lawn: n.lawn, greenOnTreesOrRoof: n.greenNotGround };
console.log(JSON.stringify({ ok: true, address: pf.attributes.situsAdd, city: pf.attributes.sitAddCty, legal: pf.attributes.legalDesc, use: pf.attributes.landUseDsc, value: +pf.attributes.apprValTot || null,
  lat: +lat.toFixed(6), lon: +lon.toFixed(6), lotSqft, lotAcres: +(lotSqft / 43560).toFixed(3),
  laser: { survey: LIDAR, cells: lzN, treeSqft: Math.round(lzTree * cellSqft), roofSqft: Math.round(lzRoof * cellSqft), groundSqft: Math.round(lzGround * cellSqft), lowSqft: Math.round(lzLow * cellSqft), treeTopsFt: tops.sort((a, b) => b - a).slice(0, 10) },
  naip2023: strip(n23), naip2021: strip(n21), drcog: turf }));

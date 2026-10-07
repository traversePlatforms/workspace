/* Lawn per door, for the rounds app (2026-10-02, SX-19). The aeration counterpart to
   sample-wildfire.mjs, and built the same way: incremental, keyed by coordinate, so a
   rebuild of the door lists only measures doors it has not seen.

   Per door: the real lot boundary (Colorado statewide parcels) -> the 2023 NAIP photo
   (Microsoft Planetary Computer copy; public domain; 30 cm; R/G/B/near-infrared) -> the
   Meta + WRI canopy-height map -> every pixel inside the lot classified:
     lawn  = green (NDVI > 0.36) AND under 1 m tall, in solid patches (>= ~150 sq ft,
             outline raggedness <= 10.5 — shrubs, tree edges and scrub oak are lacy)
     trees = green but taller, or 2 m and up
   Settings are the ones checked against four hand-measured lots — see LAWN-SIZE.md.
   ⚑ Reads open lots ~8% high and lawn under mature trees 20-45% low. That is why the app
   shows a LEVEL, not square feet.

   Writes ../lawn-cache.json: { "lat,lon": { s: lawn sq ft, t: tree share of lot, lot: lot sq ft,
   d: photo date } | { err } }.  Then: node ../build-rounds-data.mjs

   Run:  npm install   (once, in this folder)
         node sample-lawn.mjs                 all towns
         node sample-lawn.mjs --town=palmer-lake --conc=4                          */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..');
const CACHE = join(DT, 'lawn-cache.json');
const TOWNS = ['monument', 'palmer-lake', 'black-forest', 'castle-rock', 'larkspur', 'sedalia', 'franktown', 'woodland-park', 'divide', 'florissant', 'cripple-creek', 'highlands-ranch', 'parker', 'castle-pines'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 4), LIMIT = +arg('limit', 1e9);
const T = { ndvi: 0.36, short: 1, tall: 2, minpx: 150, rag: 10.5 };
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
function save() { writeFileSync(CACHE + '.tmp', JSON.stringify(cache)); renameSync(CACHE + '.tmp', CACHE); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(url, opts) {
  for (let i = 0; i < 4; i++) { try { const r = await fetch(url, opts); if (r.ok) return await r.json(); } catch {} await sleep(1000 * (i + 1)); }
  throw new Error('fetch failed: ' + url.slice(0, 80));
}

/* ---- the photo access token lasts about an hour; refresh it and reopen the photos ---- */
let token = null, tokenAt = 0;
const naipOpen = new Map();
async function signed(href) {
  if (!token || Date.now() - tokenAt > 35 * 60 * 1000) {
    token = (await json('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token; tokenAt = Date.now(); naipOpen.clear();
  }
  return href + '?' + token;
}
async function naip(item) {
  await signed(item.href);                       /* may clear naipOpen on refresh */
  if (!naipOpen.has(item.id)) {
    if (naipOpen.size >= 3) naipOpen.delete(naipOpen.keys().next().value);
    const im = await (await fromUrl(item.href + '?' + token, { cacheSize: 1500 })).getImage();
    naipOpen.set(item.id, { im, epsg: 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin: im.getOrigin(), res: im.getResolution() });
  }
  return naipOpen.get(item.id);
}
function quadkey(lon, lat, z) { const s = Math.sin(lat * Math.PI / 180); const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); let q = ''; for (let i = z; i > 0; i--) { let dd = 0; const m = 1 << (i - 1); if (x & m) dd++; if (y & m) dd += 2; q += dd; } return q; }
const chmOpen = new Map();
async function chm(lon, lat) {
  const k = quadkey(lon, lat, 9);
  if (!chmOpen.has(k)) { const im = await (await fromUrl(CHM + k + '.tif', { cacheSize: 3000 })).getImage(); chmOpen.set(k, { im, origin: im.getOrigin(), res: im.getResolution() }); }
  return chmOpen.get(k);
}
function inRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

async function measure(d, rings, item) {
  const { im, epsg, origin, res } = await naip(item);
  const px = rings.map((r) => r.map(([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]);
  const W = im.getWidth(), H = im.getHeight(), pad = 4;
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad), y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad);
  const x1 = Math.min(W, Math.ceil(Math.max(...xs)) + pad), y1 = Math.min(H, Math.ceil(Math.max(...ys)) + pad);
  if (x1 <= x0 || y1 <= y0) return { err: 'lot off the photo tile' };
  if (x1 - x0 > 2200 || y1 - y0 > 2200) return { err: 'lot too big to measure' };
  const [R, , , N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false }).catch((e) => { throw new Error('photo read ' + [x0, y0, x1, y1, W, H].join(',') + ': ' + e.message); });
  const w = x1 - x0, h = y1 - y0, n = w * h;
  /* heights, affine from the window corners into the height map */
  const ch = await chm(d.lo, d.la);
  const toM = (a, b) => proj4(epsg, 'EPSG:3857', [origin[0] + (x0 + a) * res[0], origin[1] + (y0 + b) * res[1]]);
  const cp = ([X, Y]) => [(X - ch.origin[0]) / ch.res[0], (Y - ch.origin[1]) / ch.res[1]];
  const p00 = cp(toM(0, 0)), p10 = cp(toM(w, 0)), p01 = cp(toM(0, h)), p11 = cp(toM(w, h));
  const hx0 = Math.max(0, Math.floor(Math.min(p00[0], p10[0], p01[0], p11[0])) - 1), hy0 = Math.max(0, Math.floor(Math.min(p00[1], p10[1], p01[1], p11[1])) - 1);
  /* stop at the tile's edge: a lot on a height-map tile boundary otherwise reads past it and fails */
  const hx1 = Math.min(ch.im.getWidth(), Math.ceil(Math.max(p00[0], p10[0], p01[0], p11[0])) + 1), hy1 = Math.min(ch.im.getHeight(), Math.ceil(Math.max(p00[1], p10[1], p01[1], p11[1])) + 1);
  if (hx1 <= hx0 || hy1 <= hy0) return { err: 'lot off the height-map tile' };
  const HT = (await ch.im.readRasters({ window: [hx0, hy0, hx1, hy1] }).catch((e) => { throw new Error('height read ' + [hx0, hy0, hx1, hy1, ch.im.getWidth(), ch.im.getHeight()].join(',') + ': ' + e.message); }))[0], hw = hx1 - hx0;
  const local = px.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
  const cls = new Uint8Array(n); let inside = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; inside++;
    const r = R[i], nir = N[i], ndvi = (nir - r) / (nir + r + 1e-6);
    const fx = (x + 0.5) / w, fy = (y + 0.5) / h;
    const X = p00[0] + (p10[0] - p00[0]) * fx + (p01[0] - p00[0]) * fy, Y = p00[1] + (p10[1] - p00[1]) * fx + (p01[1] - p00[1]) * fy;
    const ht = HT[Math.floor(Y - hy0) * hw + Math.floor(X - hx0)] || 0;
    if (ndvi > T.ndvi && ht <= T.short) cls[i] = 2; else if (ndvi > T.ndvi || ht >= T.tall) cls[i] = 3; else cls[i] = 1;
  }
  /* solid patches only */
  const seen = new Uint8Array(n), stack = []; let lawn = 0, tree = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (cls[s0] !== 2 || seen[s0]) continue;
    const comp = []; stack.push(s0); seen[s0] = 1;
    while (stack.length) { const p = stack.pop(); comp.push(p); const a = p % w, b = (p - a) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = a + dx, qy = b + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy * w + qx; if (!seen[q] && cls[q] === 2) { seen[q] = 1; stack.push(q); } } }
    const inC = new Set(comp); let edge = 0;
    for (const p of comp) { const a = p % w, b = (p - a) / w; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inC.has((b + dy) * w + a + dx))) edge++; }
    if (comp.length < T.minpx || edge / Math.sqrt(comp.length) > T.rag) for (const p of comp) cls[p] = 3;
  }
  for (let k = 0; k < n; k++) { if (cls[k] === 2) lawn++; else if (cls[k] === 3) tree++; }
  const m2 = res[0] * -res[1], sqft = (c) => Math.round(c * m2 * 10.7639);
  return { s: sqft(lawn), t: inside ? +(tree / inside).toFixed(2) : 0, lot: sqft(inside), d: item.date };
}

async function townParcels(bbox) {
  const out = []; let offset = 0;
  for (;;) {
    const j = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID', geometryPrecision: '6', resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'OBJECTID' }));
    const fs = j.features || [];
    for (const f of fs) if (f.geometry && f.geometry.rings) {
      const all = f.geometry.rings.flat();
      out.push({ rings: f.geometry.rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] });
    }
    if (fs.length < 2000 && !j.exceededTransferLimit) break;
    offset += fs.length;
    if (!fs.length) break;
  }
  return out;
}

const started = Date.now(); let done = 0;
for (const town of TOWNS) {
  if (ONLY && town !== ONLY) continue;
  const p = join(DT, `${town}-areas.json`);
  if (!existsSync(p)) continue;
  const all = JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number');
  const todo = all.filter((d) => !cache[`${d.la},${d.lo}`]).slice(0, LIMIT);
  if (!todo.length) { console.log(`${town}: all ${all.length} measured`); continue; }
  const lats = todo.map((d) => d.la), lons = todo.map((d) => d.lo);
  const bbox = [Math.min(...lons) - 0.003, Math.min(...lats) - 0.003, Math.max(...lons) + 0.003, Math.max(...lats) + 0.003];
  const parcels = await townParcels(bbox);
  const grid = new Map(), cell = 0.004, key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const pc of parcels) for (let gx = Math.floor(pc.bb[0] / cell); gx <= Math.floor(pc.bb[2] / cell); gx++) for (let gy = Math.floor(pc.bb[1] / cell); gy <= Math.floor(pc.bb[3] / cell); gy++) {
    const k = `${gx},${gy}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(pc);
  }
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2023' } }, limit: 250 }) });
  const items = (st.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }));
  const pick = (d) => items.filter((it) => d.lo >= it.bb[0] && d.lo <= it.bb[2] && d.la >= it.bb[1] && d.la <= it.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
  for (const d of todo) d.item = pick(d);
  todo.sort((a, b) => ((a.item && a.item.id) || '').localeCompare((b.item && b.item.id) || '') || b.la - a.la);
  console.log(`${town}: ${todo.length} doors to measure, ${parcels.length} parcels, ${items.length} photo tiles`);
  let i = 0, errs = 0, items21 = null;
  async function worker() {
    for (;;) {
      const d = todo[i++]; if (!d) return;
      const k = `${d.la},${d.lo}`;
      try {
        const pc = (grid.get(key(d.lo, d.la)) || []).find((c) => d.lo >= c.bb[0] && d.lo <= c.bb[2] && d.la >= c.bb[1] && d.la <= c.bb[3] && inRings(d.lo, d.la, c.rings));
        if (!pc) cache[k] = { err: 'no parcel at the point' };
        else if (!d.item) cache[k] = { err: 'no 2023 photo' };
        else {
          try { cache[k] = await measure(d, pc.rings, d.item); }
          catch (e) {
            /* 2026-10-02: a few lots sit on an unreadable patch of their 2023 photo (Black Forest,
               Prima Ln / Old River Dr). Fall back to the 2021 photo; the card shows the year. */
            if (!/^photo read/.test(e.message)) throw e;
            if (!items21) {
              const s21 = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2021' } }, limit: 250 }) });
              items21 = (s21.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }));
            }
            const it = items21.filter((x) => d.lo >= x.bb[0] && d.lo <= x.bb[2] && d.la >= x.bb[1] && d.la <= x.bb[3]).sort((p, q2) => p.gsd - q2.gsd)[0];
            if (!it) throw e;
            cache[k] = await measure(d, pc.rings, it);
          }
        }
      } catch (e) { errs++; if (errs <= 5) console.log('   ', d.a, process.env.LAWN_DEBUG ? e.stack : e.message.slice(0, 100)); continue; }   /* not cached: retried next run */
      done++;
      if (done % 100 === 0) { save(); const rate = done / ((Date.now() - started) / 1000); console.log(`   ${done} measured · ${rate.toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save();
  console.log(`${town}: done (${errs} failed, will retry on the next run)`);
}
save();
console.log(`measured ${done} doors in ${((Date.now() - started) / 60000).toFixed(1)} min -> lawn-cache.json`);

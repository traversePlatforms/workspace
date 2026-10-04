/* The lawn classifier from sample-lawn.mjs (2026-10-02), lifted out UNCHANGED so the NDVI trial
   uses the same lawn as the door app: green (NDVI > 0.36) and under 1 m, in solid patches.
   One addition: measure() also returns px10, the lawn share of each Sentinel-2 10 m pixel.
   ⚑ If the settings in T change in sample-lawn.mjs, change them here too.            */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
proj4.defs('EPSG:32613', '+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs');
const T = { ndvi: 0.36, short: 1, tall: 2, minpx: 150, rag: 10.5 };
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);

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
  const [R, G, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false }).catch((e) => { throw new Error('photo read ' + [x0, y0, x1, y1, W, H].join(',') + ': ' + e.message); });
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
  /* lawn share of each Sentinel-2 10 m pixel (UTM 13N / WGS84 grid), for the NDVI trial */
  const cell = new Map();
  for (let k = 0; k < n; k++) if (cls[k] === 2) {
    const a = k % w, b = (k - a) / w;
    const [X, Y] = proj4(epsg, 'EPSG:32613', [origin[0] + (x0 + a + 0.5) * res[0], origin[1] + (y0 + b + 0.5) * res[1]]);
    const key = `${Math.floor(X / 10)},${Math.floor(Y / 10)}`; cell.set(key, (cell.get(key) || 0) + 1);
  }
  const px10 = [...cell].map(([key, c]) => { const [gx, gy] = key.split(',').map(Number); return [gx, gy, +(c * m2 / 100).toFixed(3)]; });
  const out = { s: sqft(lawn), t: inside ? +(tree / inside).toFixed(2) : 0, lot: sqft(inside), d: item.date, px10 };
  /* d.detail: the pixels too, for drawing a check picture (render-check.mjs). Off by default. */
  if (d.detail) Object.assign(out, { detail: { w, h, R, G, B, cls, local, x0, y0, origin, res, epsg } });
  return out;
}


/* Every lawn patch (connected lawn pixels) with its size and its distance from the house
   (houseLocal: the house outline in window pixels). For the compact-lawn rule. */
export function patches(D, houseLocal) {
  const { w, h, cls } = D, seen = new Uint8Array(w * h), out = [];
  const m2 = D.res[0] * -D.res[1];
  const segDist = (x, y, r) => { let best = Infinity; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x1, y1] = r[j], [x2, y2] = r[i], dx = x2 - x1, dy = y2 - y1; const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(x - x1 - t * dx, y - y1 - t * dy)); } return best; };
  for (let s = 0; s < w * h; s++) {
    if (cls[s] !== 2 || seen[s]) continue;
    const stack = [s]; seen[s] = 1; let n = 0, near = Infinity;
    while (stack.length) {
      const p = stack.pop(); n++;
      const x = p % w, y = (p - x) / w;
      if (houseLocal && (n % 7 === 1)) near = Math.min(near, segDist(x, y, houseLocal));   /* sample every 7th pixel: plenty for a distance */
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = x + dx, qy = y + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; const q = qy * w + qx; if (!seen[q] && cls[q] === 2) { seen[q] = 1; stack.push(q); } }
    }
    out.push({ sqft: n * m2 * 10.7639, distM: houseLocal ? near * D.res[0] : null });
  }
  return out;
}

/* The compact-lawn rule, calibrated 2026-10-03 against a blind visual check of 12 lots: only
   patches of 400 sq ft or more, within 30 m of the house, count. On big wooded or meadow lots
   the classifier finds specks between trees and shrubs that added up to a "Large" lawn where
   there is none; real lawns are solid and sit by the house. With no house outline, size only. */
export const COMPACT = { minSqFt: 400, nearM: 30 };
export function compactSqFt(ps, haveHouse) {
  return Math.round(ps.filter((p) => p.sqft >= COMPACT.minSqFt && (!haveHouse || (p.distM ?? Infinity) <= COMPACT.nearM)).reduce((s, p) => s + p.sqft, 0));
}

export { measure, STAC, json };

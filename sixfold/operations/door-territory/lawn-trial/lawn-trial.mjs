/* Lawn-size trial (2026-10-02). For a spread of sample doors:
     parcel boundary (Colorado statewide parcels) -> 2023 NAIP tile (Microsoft Planetary
     Computer copy, public domain, 30 cm, R/G/B/near-infrared) -> classify every pixel
     inside the property line -> lawn square footage + a picture to check it by eye.
   Lawn = green (NDVI high) AND smooth (low local texture: trees are clumpy and shadowed)
   AND not dark. Buildings and paving fall out on their own: they are not green. */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
const DATA = fileURLToPath(new URL('../../../site/data/rounds', import.meta.url));
import { fileURLToPath } from 'node:url';
const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const T = { rag: +(process.env.T_RAG || 10.5), ctex: +(process.env.T_CTEX || 99), ndvi: +(process.env.T_NDVI || 0.36), tall: +(process.env.T_TALL || 2), short: +(process.env.T_SHORT || 1), minpx: +(process.env.T_MINPX || 150) };
/* tree height: Meta + World Resources Institute, High Resolution Canopy Height Maps (1.2 m, metres, EPSG:3857) */
const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
function quadkey(lon, lat, z) { const s = Math.sin(lat * Math.PI / 180); const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); let q = ''; for (let i = z; i > 0; i--) { let dd = 0; const m = 1 << (i - 1); if (x & m) dd++; if (y & m) dd += 2; q += dd; } return q; }
const chmCache = new Map();
async function chmImage(lon, lat) { const k = quadkey(lon, lat, 9); if (!chmCache.has(k)) { const im = await (await fromUrl(CHM + k + '.tif')).getImage(); chmCache.set(k, { im, origin: im.getOrigin(), res: im.getResolution() }); } return chmCache.get(k); }
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);

/* ---- a deterministic spread of doors: towns x lot-size bands ---- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const PLAN = { 'monument': 8, 'castle-rock': 8, 'black-forest': 6, 'woodland-park': 6, 'palmer-lake': 4, 'larkspur': 4, 'franktown': 4 };
const BANDS = [[0, 0.3], [0.3, 1], [1, 3], [3, 1e9]];
function pick() {
  const out = [], r = rng(20261002);
  for (const [town, n] of Object.entries(PLAN)) {
    const j = JSON.parse(readFileSync(`${DATA}/${town}.json`, 'utf8'));
    const doors = j.areas.flatMap((a) => a.doors.map((d) => ({ ...d, town, area: a.name }))).filter((d) => typeof d.lat === 'number');
    for (let k = 0; k < n; k++) {
      const [lo, hi] = BANDS[k % BANDS.length];
      const pool = doors.filter((d) => d.acres >= lo && d.acres < hi && !out.includes(d));
      if (pool.length) out.push(pool[Math.floor(r() * pool.length)]);
    }
  }
  return out;
}

async function json(url, opts) { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, opts); if (r.ok) return await r.json(); } catch {} await new Promise((s) => setTimeout(s, 800)); } throw new Error('fetch failed ' + url.slice(0, 90)); }
async function parcel(d) {
  const u = PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd,landAcres' });
  const j = await json(u);
  return j.features && j.features[0] ? j.features[0].geometry.rings : null;
}
let token = null;
async function signed(href) {
  if (!token) token = (await json('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
  return href + '?' + token;
}
const itemCache = new Map();
async function naipItem(d) {
  const j = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 5 }) });
  const f = (j.features || []).sort((a, b) => (b.properties.gsd < a.properties.gsd ? 1 : -1))[0];
  return f ? { id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10) } : null;
}
const tiffCache = new Map();
async function image(item) {
  if (!tiffCache.has(item.id)) {
    const t = await fromUrl(await signed(item.href));
    const im = await t.getImage();
    const epsg = im.geoKeys.ProjectedCSTypeGeoKey;
    tiffCache.set(item.id, { im, epsg: 'EPSG:' + epsg, origin: im.getOrigin(), res: im.getResolution() });
  }
  return tiffCache.get(item.id);
}
function inRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

async function measure(d) {
  const rings = await parcel(d);
  if (!rings) return { d, err: 'no parcel at that point' };
  const item = await naipItem(d);
  if (!item) return { d, err: 'no 2023 photo' };
  const { im, epsg, origin, res } = await image(item);
  const px = rings.map((ring) => ring.map(([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]);
  const pad = 12, W = im.getWidth(), H = im.getHeight();
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad), y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad);
  const x1 = Math.min(W, Math.ceil(Math.max(...xs)) + pad), y1 = Math.min(H, Math.ceil(Math.max(...ys)) + pad);
  if (x1 - x0 > 1400 || y1 - y0 > 1400) return { d, err: 'lot too big for the trial window' };
  const [R, G, B, N] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  const w = x1 - x0, h = y1 - y0, n = w * h;
  /* heights: map NAIP pixel -> 3857 metres -> height-map pixel, affine from three corners */
  const toM = (px_, py_) => proj4(epsg, 'EPSG:3857', [origin[0] + (x0 + px_) * res[0], origin[1] + (y0 + py_) * res[1]]);
  const chm = await chmImage(d.lon, d.lat);
  const c00 = toM(0, 0), c10 = toM(w, 0), c01 = toM(0, h);
  const cpx = ([X, Y]) => [(X - chm.origin[0]) / chm.res[0], (Y - chm.origin[1]) / chm.res[1]];
  const p00 = cpx(c00), p10 = cpx(c10), p01 = cpx(c01), p11 = cpx(toM(w, h));
  const hx0 = Math.max(0, Math.floor(Math.min(p00[0], p10[0], p01[0], p11[0])) - 2), hy0 = Math.max(0, Math.floor(Math.min(p00[1], p10[1], p01[1], p11[1])) - 2);
  const hx1 = Math.ceil(Math.max(p00[0], p10[0], p01[0], p11[0])) + 2, hy1 = Math.ceil(Math.max(p00[1], p10[1], p01[1], p11[1])) + 2;
  const HT = (await chm.im.readRasters({ window: [hx0, hy0, hx1, hy1] }))[0], hw = hx1 - hx0;
  const heightAt = (px_, py_) => { const fx = px_ / w, fy = py_ / h;
    const X = p00[0] + (p10[0] - p00[0]) * fx + (p01[0] - p00[0]) * fy, Y = p00[1] + (p10[1] - p00[1]) * fx + (p01[1] - p00[1]) * fy;
    return HT[Math.floor(Y - hy0) * hw + Math.floor(X - hx0)] || 0; };
  /* local texture: std of NIR in a 5x5 box, via integral images */
  const I = new Float64Array((w + 1) * (h + 1)), I2 = new Float64Array((w + 1) * (h + 1)), IV = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0, s = 0, s2 = 0, sv = 0; x < w; x++) {
    const i0 = y * w + x, v = N[i0]; s += v; s2 += v * v; sv += (R[i0] + G[i0] + B[i0]) / 3;
    const k = (y + 1) * (w + 1) + x + 1, k0 = y * (w + 1) + x + 1;
    I[k] = I[k0] + s; I2[k] = I2[k0] + s2; IV[k] = IV[k0] + sv;
  }
  const box = (A, xa, ya, xb, yb) => A[yb * (w + 1) + xb] - A[ya * (w + 1) + xb] - A[yb * (w + 1) + xa] + A[ya * (w + 1) + xa];
  const DIAG = process.env.DIAG && d.address.includes(process.env.DIAG) ? [] : null;
  const cls = new Uint8Array(n);   // 0 outside, 1 other, 2 lawn, 3 trees/shrubs
  const TEX = new Float32Array(n);
  let inside = 0, lawn = 0, tree = 0;
  const local = px.map((ring) => ring.map(([x, y]) => [x - x0, y - y0]));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inRings(x + 0.5, y + 0.5, local)) continue;
    const i = y * w + x; inside++;
    const r = R[i], g = G[i], b = B[i], nir = N[i];
    const ndvi = (nir - r) / (nir + r + 1e-6);
    const xa = Math.max(0, x - 2), ya = Math.max(0, y - 2), xb = Math.min(w, x + 3), yb = Math.min(h, y + 3), c = (xb - xa) * (yb - ya);
    const m = box(I, xa, ya, xb, yb) / c, sd = Math.sqrt(Math.max(0, box(I2, xa, ya, xb, yb) / c - m * m));
    const vis = box(IV, xa, ya, xb, yb) / c; TEX[i] = sd;               /* neighbourhood brightness: tree crowns are dark and shadowed */
    const ht = heightAt(x + 0.5, y + 0.5);
    if (DIAG && ndvi > 0.15) DIAG.push([ndvi, sd, vis, ht, nir]);
    /* trees by HEIGHT, not by colour: green and under a metre is lawn */
    if (ndvi > T.ndvi && ht <= T.short) cls[i] = 2;
    else if (ndvi > T.ndvi || ht >= T.tall) cls[i] = 3;
    else cls[i] = 1;
  }
  /* drop specks: lawn patches smaller than T.minpx pixels become trees/other */
  const seen = new Uint8Array(n), stack = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (cls[s0] !== 2 || seen[s0]) continue;
    const comp = []; stack.push(s0); seen[s0] = 1;
    while (stack.length) { const p = stack.pop(); comp.push(p); const px0 = p % w, py0 = (p - px0) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qx = px0 + dx, qy = py0 + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const qi = qy * w + qx; if (!seen[qi] && cls[qi] === 2) { seen[qi] = 1; stack.push(qi); } } }
    /* a lawn is one smooth patch; scrub oak is green and short too, but rough and broken up */
    let ct = 0; for (const p of comp) ct += TEX[p]; ct /= comp.length;
    /* raggedness: edge pixels / sqrt(area). A square scores ~4, a disc ~3.5; lacy flecks score high */
    const inC = new Set(comp); let edge = 0;
    for (const p of comp) { const px0 = p % w, py0 = (p - px0) / w; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inC.has((py0 + dy) * w + px0 + dx))) edge++; }
    const rag = edge / Math.sqrt(comp.length);
    if (process.env.CDIAG && comp.length >= T.minpx) console.log('   comp', comp.length, 'px, mean texture', ct.toFixed(1), 'ragged', rag.toFixed(1));
    /* a lawn is a solid patch; shrubs, tree edges and scrub oak make lacy, ragged ones */
    if (comp.length < T.minpx || ct > T.ctex || rag > T.rag) for (const p of comp) cls[p] = 3;
  }
  for (let k = 0; k < n; k++) { if (cls[k] === 2) lawn++; else if (cls[k] === 3) tree++; }
  const m2 = res[0] * -res[1];
  if (DIAG) {
    const pct = (k, p) => { const a = DIAG.map((v) => v[k]).sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
    const names = ['ndvi', 'tex', 'vis', 'g-r', 'nir'];
    console.log('DIAG', d.address, DIAG.length, 'green px');
    names.forEach((nm, k) => console.log('   ', nm.padEnd(5), [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => (+pct(k, p)).toFixed(2)).join('  ')));
  }
  /* picture: photo on the left, classification on the right */
  const png = new PNG({ width: w * 2 + 6, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = (y * png.width + x) * 4, o2 = (y * png.width + x + w + 6) * 4;
    png.data[o] = R[i]; png.data[o + 1] = G[i]; png.data[o + 2] = B[i]; png.data[o + 3] = 255;
    let c = [R[i] * 0.35, G[i] * 0.35, B[i] * 0.35];
    if (cls[i] === 2) c = [255, 0, 200]; else if (cls[i] === 3) c = [20, 110, 40]; else if (cls[i] === 1) c = [R[i] * 0.8, G[i] * 0.8, B[i] * 0.8];
    png.data[o2] = c[0]; png.data[o2 + 1] = c[1]; png.data[o2 + 2] = c[2]; png.data[o2 + 3] = 255;
  }
  const file = `${d.town}-${d.id}.png`;
  writeFileSync(OUT + file, PNG.sync.write(png));
  return { d, file, photo: item.date, lotSqft: Math.round(inside * m2 * 10.7639), lawnSqft: Math.round(lawn * m2 * 10.7639), treeSqft: Math.round(tree * m2 * 10.7639) };
}

let sample = pick();
if (process.env.LATLON) {   /* measure a lot by map point, e.g. a customer outside the door lists */
  const [la, lo] = process.env.LATLON.split(',').map(Number);
  sample = [{ id: process.env.ID || 'point', address: process.env.LABEL || 'point', town: 'ref', area: '', lat: la, lon: lo, acres: +(process.env.ACRES || 0) }];
} else if (process.env.ADDR) {   /* measure one named door from the door lists */
  sample = [];
  for (const town of Object.keys(JSON.parse(readFileSync(`${DATA}/index.json`, 'utf8')).regions.map ? {} : {})) {}
  for (const f of ['monument', 'castle-rock', 'black-forest', 'woodland-park', 'palmer-lake', 'larkspur', 'franktown', 'divide', 'florissant', 'sedalia', 'cripple-creek']) {
    const j = JSON.parse(readFileSync(`${DATA}/${f}.json`, 'utf8'));
    for (const a of j.areas) for (const d of a.doors) if (d.address === process.env.ADDR) sample.push({ ...d, town: f, area: a.name });
  }
}
if (process.env.ONLY) sample = sample.filter((d) => process.env.ONLY.split('|').some((a) => d.address.includes(a)));
console.log(`${sample.length} doors, thresholds ${JSON.stringify(T)}`);
const results = [];
for (const d of sample) {
  try { const r = await measure(d); results.push(r); console.log(r.err ? `  ${d.town.padEnd(13)} ${d.address.padEnd(28)} ERR ${r.err}` : `  ${d.town.padEnd(13)} ${d.address.padEnd(28)} ${String(d.acres.toFixed(2)).padStart(6)} ac  lot ${String(r.lotSqft).padStart(7)}  lawn ${String(r.lawnSqft).padStart(6)} sqft  trees ${String(r.treeSqft).padStart(6)}  (${r.photo})`); }
  catch (e) { console.log(`  ${d.town} ${d.address} FAILED ${e.message}`); results.push({ d, err: e.message }); }
}
writeFileSync(OUT + 'results.json', JSON.stringify(results.map((r) => ({ town: r.d.town, address: r.d.address, acres: r.d.acres, fire: r.d.fire, ...r, d: undefined })), null, 1));
/* contact sheet */
const cards = results.filter((r) => r.file).map((r) => `<figure><img src="${r.file}"><figcaption><b>${r.d.address}</b> · ${r.d.town} · ${r.d.acres.toFixed(2)} ac<br>lawn <b>${r.lawnSqft.toLocaleString()}</b> sq ft · trees ${r.treeSqft.toLocaleString()} · lot ${r.lotSqft.toLocaleString()}</figcaption></figure>`).join('');
writeFileSync(OUT + 'sheet.html', `<!doctype html><meta charset="utf-8"><style>body{font:13px system-ui;margin:10px;background:#eee}figure{display:inline-block;vertical-align:top;margin:6px;background:#fff;padding:6px;width:440px}img{width:100%;image-rendering:pixelated}figcaption{margin-top:4px}</style>
<p>Left: 2023 photo. Right: <span style="background:#ff00c8;color:#fff">&nbsp;lawn&nbsp;</span> <span style="background:#146e28;color:#fff">&nbsp;trees/shrubs&nbsp;</span> grey = other (roof, paving, bare/dry ground); dark = outside the property line.</p>${cards}`);
console.log('wrote', OUT + 'sheet.html');

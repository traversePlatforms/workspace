/* The yard method, v2 (2026-10-23). v1 (yard-scan.mjs, kept as it was) over-read open and acreage lots (7378 Upton Ct +486%) because
   the July 2021 photo and DRCOG class 4 (natural grass) count native grass as lawn, and its under-tree reach flooded along roof edges and
   under evergreens (3247 Oak Leaf Pl: +95% at 4 m). v2 changes three things, each switchable so yard-eval-v2.mjs can score them alone:
     green    which cells count as seen lawn. 'v1' = the old rule. 'g23d6' = green in the 2023 photo (NDVI > 0.36) or DRCOG turf (class 6),
              no 2021 photo, no class 4. 'd6' = DRCOG turf only. 'g23' = the 2023 photo only. 'g23d6g' = the 2023 photo, or DRCOG turf
              that is at least a little green in the 2023 photo (NDVI > `gate`): turf DRCOG drew over dry native grass drops out.
              'lated6g' = the same with the late-summer photo(s) in place of 2023 (see late() below; differs only where 2023 was October).
     roofBuf  metres: tree-crown cells this close to a roof (laser roof or DRCOG structure) are never filled. Roof edges split the laser
              pulse and read as "tree", which is how v1's fill ran along the eaves.
     ever     'off' | 'lidar': crowns that look evergreen are never filled. Evergreen = the laser's returns go all the way down: in the
              3x3 cells around, a large share of the above-ground returns sit 0.3-2.5 m up (`everLow`) and few pulses reach the ground
              (`everGnd`). A shade tree with grass under it has a gap below the crown and many ground returns.
     fill     metres of tree crown reached from seen lawn (as v1), through fillable crowns only.
   Added after the first scoring run, because (a) alone still left Upton at +137% or worse:
     struct   DRCOG's building outline is roof even where the laser pulse split (v1 called split roof cells "tree"). Made no difference
              to the scores once roofBuf is on (the buffer already blocked those cells); kept because the pictures read right.
     speck    a seen-lawn cell stays only with at least this many of its 8 neighbours seen too: dry native grass greens in specks.
     house    seen lawn only within this many metres of a roof: watered lawn sits round the house, the acreage beyond is field.
   Laser roofs count for roofBuf and house only as solid blobs (dense crown tops also return single pulses here and there).
   The winning settings are V2 below; yard-v2-results-2026-10-23.md has the scores of every variant tried.
   Sources as v1: USGS 3DEP LiDAR (Entwine copy on AWS), NAIP via Microsoft Planetary Computer, DRCOG 2020 Regional Land Use Land Cover
   (Denver Regional Council of Governments; consent to use, 2026-10-22). No Google imagery.
   The photo, land-cover and laser windows for a lot are read once and kept in yard-v2-cache/ (sources), so variants cost nothing.
     import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
     node yard-scan-v2.mjs --address "3855 S Valentia Ct" [--town denver] [--out pic.png]                                       */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const L = await import('../tree-zones/lidar.mjs');
const PC = 'https://planetarycomputer.microsoft.com/api', SQFT = 10.7639;
const SURVEYS = ['CO_DRCOG_2_2020', 'CO_DRCOG_1_2020', 'CO_DRCOG_3_2020', 'CO_Eastern_ElPaso_2018', 'CO_Eastern_B1_2018'];
const BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/';
const PROJECT_DEPTH = { CO_Eastern_ElPaso_2018: 9, CO_DRCOG_2_2020: 10, CO_DRCOG_1_2020: 10, CO_Eastern_B1_2018: 9 };
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
proj4.defs('EPSG:6428', '+proj=lcc +lat_0=37.8333333333333 +lon_0=-105.5 +lat_1=39.75 +lat_2=38.45 +x_0=914401.828803658 +y_0=304800.609601219 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs');
const get = async (u, o) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, o); if (r.ok) return await r.json(); } catch {} await new Promise((ok) => setTimeout(ok, 1200 * (i + 1))); } throw new Error('fetch failed ' + u.slice(0, 70)); };
const merc = (lo, la) => proj4('EPSG:4326', 'EPSG:3857', [lo, la]);
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const inRings = (x, y, rr) => rr.reduce((n, r) => n + (inRing(x, y, r) ? 1 : 0), 0) % 2 === 1;
const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
const unb64 = (s, T) => { const b = Buffer.from(s, 'base64'); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return new T(ab); };

/* the winning settings (see yard-v2-results-2026-10-23.md); yard-eval-v2.mjs scores the others */
export const V2 = { green: 'lated6g', gate: 0.2, struct: true, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 5, house: 25, fill: 12 };

const tokens = {};
async function token(c) { if (!tokens[c]) tokens[c] = (await get(PC + '/sas/v1/token/' + c)).token; return tokens[c]; }
/* a raster window around the lot, kept as plain numbers: { epsg, o, rs, x0, y0, w, h, bands: [Uint8/16Array...] } */
async function windowOf(href, rings, pad) {
  const im = await (await fromUrl(href)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, o = im.getOrigin(), rs = im.getResolution();
  const P = rings.flat().map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - o[0]) / rs[0], (Y - o[1]) / rs[1]]; });
  const x0 = Math.floor(Math.min(...P.map((p) => p[0]))) - pad, y0 = Math.floor(Math.min(...P.map((p) => p[1]))) - pad, x1 = Math.ceil(Math.max(...P.map((p) => p[0]))) + pad, y1 = Math.ceil(Math.max(...P.map((p) => p[1]))) + pad;
  const bands = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  return { epsg, o, rs, x0, y0, w: x1 - x0, h: y1 - y0, bands: Array.from(bands, (b) => Uint8Array.from(b)) };
}
async function naipWin(year, lon, lat, rings) {
  const st = await get(PC + '/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, query: { 'naip:year': { eq: String(year) } }, limit: 3 }) });
  const item = (st.features || []).sort((a, b) => a.properties.gsd - b.properties.gsd)[0]; if (!item) return null;
  try { const w = await windowOf(item.assets.image.href + '?' + await token('naip'), rings, 8); w.date = item.properties.datetime ? item.properties.datetime.slice(0, 10) : String(year); return w; }
  catch (e) { return { err: String(e.message).slice(0, 80) }; }
}
async function drcogWin(lon, lat, rings) {
  try {
    const ls = await get(PC + '/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['drcog-lulc'], intersects: { type: 'Point', coordinates: [lon, lat] }, limit: 10 }) });
    const li = (ls.features || []).filter((f) => /2020/.test(f.id))[0]; if (!li) return null;
    const as = Object.values(li.assets).find((x) => /tif/.test(x.type || '') || /\.tif/.test(x.href));
    return await windowOf(as.href + '?' + await token('drcog-lulc'), rings, 6);
  } catch { return null; }
}
/* the laser, per 1 m cell: height and split-pulse from lidar.mjs, plus where the returns sit (ground / 0.3-2.5 m / above 2.5 m) */
const eptInfo = new Map(), hier = new Map();
async function nodesFor(p, box) {
  if (!eptInfo.has(p)) eptInfo.set(p, await get(`${BASE}${p}/ept.json`));
  const root = eptInfo.get(p).bounds, out = [];
  const hget = async (key) => { const k = p + '/' + key; if (!hier.has(k)) hier.set(k, await get(`${BASE}${p}/ept-hierarchy/${key}.json`)); return hier.get(k); };
  const nodeBox = (key) => { const [d, x, y, z] = key.split('-').map(Number), w = (root[3] - root[0]) / 2 ** d; return [root[0] + x * w, root[1] + y * w, root[2] + z * w, root[0] + (x + 1) * w, root[1] + (y + 1) * w, root[2] + (z + 1) * w]; };
  const hits = (a, b) => a[0] < b[2] && a[3] > b[0] && a[1] < b[3] && a[4] > b[1];
  async function walk(key, h) {
    if (!(key in h)) return; let cnt = h[key];
    if (cnt === -1) { h = await hget(key); cnt = h[key]; }
    if (!cnt || !hits(nodeBox(key), box)) return;
    out.push(key); const [d, x, y, z] = key.split('-').map(Number); if (d >= (PROJECT_DEPTH[p] || 10)) return;
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) await walk(`${d + 1}-${2 * x + dx}-${2 * y + dy}-${2 * z + dz}`, h);
  }
  await walk('0-0-0-0', await hget('0-0-0-0'));
  return out;
}
async function laserWin(lon, lat, box, cell, cacheDir) {
  const bounds = new Map();
  for (const p of SURVEYS) {
    let b = null; try { const e = await get(BASE + p + '/ept.json'); b = e.boundsConforming || e.bounds; } catch {}
    const [X, Y] = merc(lon, lat); if (!b || X < b[0] || X > b[3] || Y < b[1] || Y > b[4]) continue;
    const G = await L.heightGrid(p, box, cell, cacheDir); if (!G.hgt.some((v) => !Number.isNaN(v))) continue;
    /* heightGrid has cached every tile it read; read them again for where the returns sit */
    const n = G.w * G.h, gndZ = new Float32Array(n), nG = new Uint16Array(n), nLo = new Uint16Array(n), nHi = new Uint16Array(n);
    for (let o = 0; o < n; o++) gndZ[o] = G.top[o] === -Infinity || Number.isNaN(G.hgt[o]) ? NaN : G.top[o] - G.hgt[o];
    for (const key of await nodesFor(p, box)) {
      const f = join(cacheDir, p, key + '.bin'); if (!existsSync(f)) continue;
      const bb = readFileSync(f), np = bb.readUInt32LE(0), xyz = new Float64Array(bb.buffer.slice(bb.byteOffset + 4, bb.byteOffset + 4 + np * 24)), cls = bb.subarray(4 + np * 24, 4 + np * 25);
      for (let i = 0; i < np; i++) {
        const x = xyz[i * 3], y = xyz[i * 3 + 1]; if (x < box[0] || x >= box[2] || y < box[1] || y >= box[3]) continue;
        const k = cls[i]; if (k === 6 || k === 7 || k === 9 || k === 18) continue;
        const o = Math.floor((box[3] - y) / cell) * G.w + Math.floor((x - box[0]) / cell);
        if (k === 2) { nG[o]++; continue; }
        const z = xyz[i * 3 + 2] - gndZ[o]; if (!(z >= 0.3)) continue;
        if (z < 2.5) nLo[o]++; else nHi[o]++;
      }
    }
    return { survey: p, w: G.w, h: G.h, hgt: G.hgt, multi: G.multi, nG, nLo, nHi };
  }
  return null;
}
/** everything v2 reads for a lot, once; cached on disk by `key` */
export async function yardSources(rings, opt = {}) {
  const cdir = opt.cache || fileURLToPath(new URL('./yard-v2-cache/', import.meta.url)); mkdirSync(cdir, { recursive: true });
  const cf = opt.key ? join(cdir, opt.key + '.json') : null;
  if (cf && existsSync(cf)) return thaw(JSON.parse(readFileSync(cf, 'utf8')));
  const lidarCache = opt.lidarCache || fileURLToPath(new URL('../tree-zones/lidar-cache/', import.meta.url));
  const pts = rings[0], lon = pts.reduce((s, p) => s + p[0], 0) / pts.length, lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;
  const M = rings.map((r) => r.map(([lo, la]) => merc(lo, la))), xs = M.flat().map((p) => p[0]), ys = M.flat().map((p) => p[1]), pad = 8 / k;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const [n23, n21, dc] = await Promise.all([naipWin(2023, lon, lat, rings), naipWin(2021, lon, lat, rings), drcogWin(lon, lat, rings)]);
  const lz = await laserWin(lon, lat, box, cell, lidarCache);
  const S = { rings, box, cell, n23, n21, dc, lz };
  if (cf) writeFileSync(cf, JSON.stringify(freeze(S)));
  return S;
}
const freeze = (S) => JSON.parse(JSON.stringify(S, (k, v) => (ArrayBuffer.isView(v) ? { $t: v.constructor.name, $b: b64(v) } : v)));
function thaw(S) { const T = { Uint8Array, Uint16Array, Float32Array, Int16Array }; return JSON.parse(JSON.stringify(S), (k, v) => (v && v.$t ? unb64(v.$b, T[v.$t]) : v)); }
const sampler = (W) => (lo, la) => { if (!W || W.err) return null; const [X, Y] = proj4('EPSG:4326', W.epsg, [lo, la]); const c = Math.floor((X - W.o[0]) / W.rs[0]) - W.x0, r = Math.floor((Y - W.o[1]) / W.rs[1]) - W.y0; if (c < 0 || r < 0 || c >= W.w || r >= W.h) return null; return r * W.w + c; };

/** classify one lot's sources with one set of settings */
export function yardClassify(S, opt = {}) {
  const v = { ...V2, ...opt }, { box, cell, rings, lz } = S;
  const M = rings.map((r) => r.map(([lo, la]) => merc(lo, la)));
  const W = lz ? lz.w : Math.ceil((box[2] - box[0]) / cell), H = lz ? lz.h : Math.ceil((box[3] - box[1]) / cell), N = W * H;
  const s23 = sampler(S.n23), s21 = sampler(S.n21), sdc = sampler(S.dc);
  /* late summer: a photo flown 20 Aug - 30 Sep. 'late' rules use the green of whichever photos are late summer (the 2023 photo when none
     is): the metro's 2023 photo is 25 Sep and its 2021 photo July or mid-August (left out); El Paso's 2023 photo is 8 Oct and its 2021
     photo 15 Sep (used) */
  const late = (W) => !!(W && !W.err && W.date && /-(08-(2\d|3[01])|09-\d\d)$/.test(W.date));
  const use23 = late(S.n23) || !late(S.n21), use21 = late(S.n21);
  const nd = (Wn, i) => { if (i == null) return -1; const [R, , , NIR] = Wn.bands; return (NIR[i] - R[i]) / (NIR[i] + R[i] + 1e-6); };
  /* per cell: 0 outside, 1 other, 2 roof, 3 tree high, 4 tree low/shrub, 5 seen lawn, 6 under-tree lawn, 7 paving/water/structure */
  const cls = new Uint8Array(N), roofish = new Uint8Array(N), dcl = new Uint8Array(N);
  let lot = 0, turf = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const X = box[0] + (c + 0.5) * cell, Y = box[3] - (r + 0.5) * cell, o = r * W + c, [lo, la] = proj4('EPSG:3857', 'EPSG:4326', [X, Y]);
    const h = lz ? lz.hgt[o] : NaN, multi = lz ? lz.multi[o] : 0, di = sdc(lo, la), d = di == null ? null : S.dc.bands[0][di] || null;
    dcl[o] = d || 0;
    if (d === 1) roofish[o] = 1; else if (h >= 2.5 && !multi) roofish[o] = 2;   /* roofs, inside the lot or not: the buffer looks over the line too */
    if (!inRings(X, Y, M)) continue;
    lot++; if (d === 6) turf++;
    const ia = s23(lo, la), ib = s21(lo, la), g23 = S.n23 && !S.n23.err ? nd(S.n23, ia) : -1, g21 = S.n21 && !S.n21.err ? nd(S.n21, ib) : -1, gmax = Math.max(g23, g21);
    if (d === 1 && v.struct) { cls[o] = 2; continue; }   /* v2: DRCOG's building outline is roof, split pulses or not (roof edges and ridges split) */
    if (d === 1 || d === 2 || d === 3) { cls[o] = h >= 2 && multi ? (h >= 3 ? 3 : 4) : 7; continue; }
    if (h >= 2.5 && !multi) { cls[o] = 2; continue; }
    if (h >= 2 && multi) { cls[o] = h >= 3 ? 3 : 4; continue; }
    if (h >= 0.5) { cls[o] = 4; continue; }
    const gl = Math.max(use23 ? g23 : -1, use21 ? g21 : -1);
    const g = v.green === 'v1' ? gmax : /^late/.test(v.green) ? gl : g23, hasDc = !!S.dc;
    const grassy = v.green === 'v1' ? (gmax > 0.36 || d === 6 || (d === 4 && gmax > 0.25))
      : v.green === 'g23d6' ? (g23 > 0.36 || d === 6)
      : v.green === 'd6' ? (hasDc ? d === 6 : g23 > 0.36)
      : v.green === 'g23' ? g23 > 0.36
      : v.green === 'lated6g' ? (gl > 0.36 || (d === 6 && gl > v.gate))
      : /* g23d6g */ (g23 > 0.36 || (d === 6 && g23 > v.gate));
    const A = S.n23 && !S.n23.err && ia != null ? S.n23.bands : null;
    cls[o] = grassy ? 5 : (g < 0.12 && A && Math.max(A[0][ia], A[1][ia], A[2][ia]) - Math.min(A[0][ia], A[1][ia], A[2][ia]) < 28 ? 7 : 1);
  }
  /* laser roofs count for the buffer only as solid blobs (12+ single-return high cells in the 5x5 around): dense crown tops also give
     single returns, one cell here and there */
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const o = r * W + c; if (roofish[o] !== 2) continue; let n = 0; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < H && cc < W && roofish[rr * W + cc]) n++; } roofish[o] = n >= 12 ? 1 : 0; }
  /* despeckle: a seen-lawn cell stays only with at least `speck` of its 8 neighbours seen too (dry native grass greens in specks) */
  if (v.speck) { const keep = new Uint8Array(N); for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const o = r * W + c; if (cls[o] !== 5) continue; let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < H && cc < W && cls[rr * W + cc] === 5) n++; } keep[o] = n >= v.speck ? 1 : 0; } for (let o = 0; o < N; o++) if (cls[o] === 5 && !keep[o]) cls[o] = 1; }
  /* near the house: seen lawn only within `house` metres of a roof (the watered lawn is round the house; acreage beyond is field) */
  if (v.house) { const dd = new Int16Array(N).fill(-1), qq = []; for (let o = 0; o < N; o++) if (roofish[o] === 1) { dd[o] = 0; qq.push(o); }
    if (qq.length) { for (let qi = 0; qi < qq.length; qi++) { const o = qq[qi], r = Math.floor(o / W), c = o % W; if (dd[o] >= v.house) continue; for (const [dr, dcol] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const rr = r + dr, cc = c + dcol; if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue; const p = rr * W + cc; if (dd[p] !== -1) continue; dd[p] = dd[o] + 1; qq.push(p); } }
      for (let o = 0; o < N; o++) if (cls[o] === 5 && dd[o] === -1) cls[o] = 1; } }
  /* which crowns may be filled */
  const fillable = new Uint8Array(N);
  const rb = Math.round(v.roofBuf || 0);
  let blockedRoof = 0, blockedEver = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const o = r * W + c; if (cls[o] !== 3) continue;
    let ok = true;
    if (rb) for (let dr = -rb; dr <= rb && ok; dr++) for (let dc = -rb; dc <= rb; dc++) { if (dr * dr + dc * dc > rb * rb + 0.5) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue; if (roofish[rr * W + cc]) { ok = false; break; } }
    if (!ok) { blockedRoof++; continue; }
    if (v.ever === 'lidar' && lz) {
      let g = 0, lo = 0, hi = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue; const p = rr * W + cc; g += lz.nG[p]; lo += lz.nLo[p]; hi += lz.nHi[p]; }
      const lowShare = lo / Math.max(1, lo + hi), gndShare = g / Math.max(1, g + lo + hi);
      if (lowShare > v.everLow && gndShare < v.everGnd) { blockedEver++; continue; }
    } else if (v.ever === 'gnd' && lz) {   /* only crowns the laser saw the ground through (leaf-off survey: bare shade trees) */
      let g = 0, a = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue; const p = rr * W + cc; g += lz.nG[p]; a += lz.nG[p] + lz.nLo[p] + lz.nHi[p]; }
      if (g / Math.max(1, a) < v.everGnd) { blockedEver++; continue; }
    }
    fillable[o] = 1;
  }
  const dist = new Int16Array(N).fill(-1), q = [];
  for (let o = 0; o < N; o++) if (cls[o] === 5) { dist[o] = 0; q.push(o); }
  const steps = Math.round(v.fill);
  for (let qi = 0; qi < q.length; qi++) {
    const o = q[qi], r = Math.floor(o / W), c = o % W; if (dist[o] >= steps) continue;
    for (const [dr, dcol] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dcol; if (rr < 0 || cc < 0 || rr >= H || cc >= W) continue; const p = rr * W + cc; if (dist[p] !== -1 || !fillable[p]) continue; dist[p] = dist[o] + 1; cls[p] = 6; q.push(p); }
  }
  const count = (x) => { let n = 0; for (let o = 0; o < N; o++) if (cls[o] === x) n++; return n; };
  const sf = (n) => Math.round(n * SQFT);
  const seen = count(5), under = count(6), roof = count(2), hard = count(7);
  return { lot: sf(lot), lawn: sf(seen + under), seen: sf(seen), under: sf(under), open: sf(lot - roof - hard), trees: sf(count(3) + under), shrubs: sf(count(4)),
    drcogTurf: S.dc ? sf(turf) : null, survey: lz ? lz.survey : null, photo23: S.n23 && S.n23.date, photo21: S.n21 && S.n21.date,
    blockedRoof: sf(blockedRoof), blockedEver: sf(blockedEver), cls, W, H, settings: v };
}
/** the cells over the 2023 photo, 8 px a cell: lawn green, under-tree lawn teal, roof grey, crowns yellow (blocked crowns orange), paving dark */
export function yardPic(S, R, path) {
  const { box, cell } = S, { W, H, cls } = R, s23 = sampler(S.n23); if (!s23) return;
  const Sx = 8, png = new PNG({ width: W * Sx, height: H * Sx });
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const o = r * W + c, v = cls[o], tint = { 2: [150, 150, 150], 3: [210, 190, 40], 4: [170, 120, 60], 5: [40, 190, 70], 6: [30, 170, 170], 7: [60, 60, 70] }[v];
    for (let y = 0; y < Sx; y++) for (let x = 0; x < Sx; x++) {
      const X = box[0] + (c + (x + 0.5) / Sx) * cell, Y = box[3] - (r + (y + 0.5) / Sx) * cell, [lo, la] = proj4('EPSG:3857', 'EPSG:4326', [X, Y]), i = s23(lo, la);
      let rgb = i == null ? [0, 0, 0] : [S.n23.bands[0][i], S.n23.bands[1][i], S.n23.bands[2][i]];
      if (!v) rgb = rgb.map((u) => u >> 1); else if (tint) rgb = rgb.map((u, k) => (u * 0.4 + tint[k] * 0.6) | 0);
      const j = ((r * Sx + y) * W * Sx + c * Sx + x) * 4; png.data[j] = rgb[0]; png.data[j + 1] = rgb[1]; png.data[j + 2] = rgb[2]; png.data[j + 3] = 255;
    }
  }
  writeFileSync(path, PNG.sync.write(png));
}
/* the lot for an address: the door point from the app's door file when there is one (El Paso sends some lots with no address text,
   9554 Penstemon Ct among them, so the address match finds nothing), else the address text, exact then starting-with */
export async function lotFor(address, town) {
  const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
  const street = String(address || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const DATA = fileURLToPath(new URL('../../../app/data/rounds/', import.meta.url));
  let door = null;
  if (town && existsSync(join(DATA, town + '.json'))) door = JSON.parse(readFileSync(join(DATA, town + '.json'), 'utf8')).areas.flatMap((a) => a.doors).find((d) => d.address === street) || null;
  const q = (p) => get(PARCELS + '?' + new URLSearchParams({ f: 'json', ...p, outFields: 'situsAdd', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7' }));
  let f = null;
  if (door && door.lat) f = ((await q({ geometry: `${door.lon},${door.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' })).features || [])[0];
  if (!f) f = ((await q({ where: `UPPER(situsAdd) = '${street.replace(/'/g, "''")}' OR UPPER(situsAdd) = 'N ${street.replace(/'/g, "''")}'` })).features || [])[0];
  if (!f) { const [num, ...rest] = street.split(' '), name = rest.find((w) => !/^(N|S|E|W)$/.test(w)) || ''; if (/^\d+$/.test(num) && /^[A-Z0-9]+$/.test(name)) f = ((await q({ where: `UPPER(situsAdd) LIKE '${num} %${name}%'` })).features || [])[0]; }
  return f ? f.geometry.rings : null;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const rings = await lotFor(A.address, A.town); if (!rings) { console.log(JSON.stringify({ ok: false, error: 'no lot with that address' })); process.exit(1); }
  const S = await yardSources(rings), R = yardClassify(S, A.fill != null ? { fill: +A.fill } : {});
  if (A.out) yardPic(S, R, A.out);
  const { cls, W, H, ...out } = R; console.log(JSON.stringify({ ok: true, address: A.address, ...out }));
}

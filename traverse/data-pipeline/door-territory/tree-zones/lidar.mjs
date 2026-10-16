/* USGS 3DEP LiDAR point clouds (public, on AWS as Entwine Point Tiles, Web Mercator),
   turned into a 1 m height-above-ground grid for a small box. 2026-10-02.

   Why: the Meta canopy-height map missed whole clumps of evergreens on test lots, and a
   house wrongly read as "clear" is the error that costs a fire-mitigation lead. LiDAR
   measures height directly.

   Coverage (checked 2026-10-02): El Paso = CO_Eastern_ElPaso_2018; Douglas =
   CO_DRCOG_2_2020. Teller has none in the 3DEP index, so Teller doors keep the canopy map.

   Height: per 1 m cell, top = highest return that is not noise, water or a building
   (classes 7, 9, 18, 6); ground = lowest class-2 return in the cell, gaps filled from the
   nearest cell that has one. Height = top - ground.
   Vegetation: the cell also records whether any above-ground return came from a pulse
   that split into several returns. Canopy does that; a solid roof does not. These surveys
   leave roofs unclassified, so this is what keeps a roof edge from counting as a tree. */
import { Las } from 'copc';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/';
const SKIP = new Set([6, 7, 9, 18]);
const info = new Map(), hier = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, type) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (r.ok) return type === 'json' ? await r.json() : new Uint8Array(await r.arrayBuffer()); if (r.status === 404) return null; } catch {}
    await sleep(800 * (i + 1));
  }
  throw new Error('fetch failed: ' + url);
}
async function eptInfo(p) { if (!info.has(p)) info.set(p, await get(`${BASE}${p}/ept.json`, 'json')); return info.get(p); }
async function hierarchy(p, key) {
  const k = p + '/' + key;
  if (!hier.has(k)) hier.set(k, await get(`${BASE}${p}/ept-hierarchy/${key}.json`, 'json'));
  return hier.get(k);
}
function nodeBox(root, key) {
  const [d, x, y, z] = key.split('-').map(Number), w = (root[3] - root[0]) / 2 ** d;
  return [root[0] + x * w, root[1] + y * w, root[2] + z * w, root[0] + (x + 1) * w, root[1] + (y + 1) * w, root[2] + (z + 1) * w];
}
const hits = (a, b) => a[0] < b[2] && a[3] > b[0] && a[1] < b[3] && a[4] > b[1];   /* xy only; b = [xmin,ymin,xmax,ymax] */

/* MAX_DEPTH: deeper tiles only add density beyond what a 1 m grid uses. Depth 9 alone
   carries ~2 returns per square metre on these surveys; set from the comparison of
   2026-10-02 (see TREES.md). */
export let MAX_DEPTH = +(process.env.LIDAR_MAX_DEPTH || 0);
/* per survey: the depth whose tiles give ~1 m spacing (El Paso depth 9 ~ 175 m tiles; Douglas
   depth 10 ~ 120 m). Checked 2026-10-02: same answers as full depth on the test lots, ~10x less download. */
const PROJECT_DEPTH = { CO_Eastern_ElPaso_2018: 9, CO_DRCOG_2_2020: 10, CO_DRCOG_1_2020: 10, CO_Eastern_B1_2018: 9 };
export function setMaxDepth(n) { MAX_DEPTH = n; }
async function nodesFor(p, box) {
  const e = await eptInfo(p), root = e.bounds, out = [];
  async function walk(key, h) {
    if (!(key in h)) return;
    let cnt = h[key];
    if (cnt === -1) { h = await hierarchy(p, key); cnt = h[key]; }
    if (!cnt || !hits(nodeBox(root, key), box)) return;
    out.push(key);
    const [d, x, y, z] = key.split('-').map(Number);
    if (d >= (MAX_DEPTH || PROJECT_DEPTH[p] || 99)) return;
    for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) await walk(`${d + 1}-${2 * x + dx}-${2 * y + dy}-${2 * z + dz}`, h);
  }
  await walk('0-0-0-0', await hierarchy(p, '0-0-0-0'));
  return out;
}

/* decoded tiles are cached on disk as compact Float64 triples + class bytes, per project */
const memo = new Map();
/* one decode per tile, shared by every worker that wants it at the same moment */
function tilePoints(p, key, cacheDir) {
  const mk = p + '/' + key;
  if (memo.has(mk)) { const v = memo.get(mk); memo.delete(mk); memo.set(mk, v); return v; }
  const pr = loadTile(p, key, cacheDir);
  memo.set(mk, pr);
  if (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
  pr.catch(() => memo.delete(mk));
  return pr;
}
export let MEMO_MAX = 400;
export function setMemoMax(n) { MEMO_MAX = n; }
async function loadTile(p, key, cacheDir) {
  let pts;
  const f = cacheDir && join(cacheDir, p, key + '.bin');
  if (f && existsSync(f)) {
    const b = readFileSync(f), n = b.readUInt32LE(0);
    pts = { n, xyz: new Float64Array(b.buffer.slice(b.byteOffset + 4, b.byteOffset + 4 + n * 24)), cls: new Uint8Array(b.buffer.slice(b.byteOffset + 4 + n * 24, b.byteOffset + 4 + n * 25)), nr: new Uint8Array(b.buffer.slice(b.byteOffset + 4 + n * 25, b.byteOffset + 4 + n * 26)) };
  } else {
    const buf = await get(`${BASE}${p}/ept-data/${key}.laz`, 'bin');
    if (!buf) pts = { n: 0, xyz: new Float64Array(0), cls: new Uint8Array(0), nr: new Uint8Array(0) };
    else {
      const header = Las.Header.parse(buf);
      const data = await Las.PointData.decompressFile(buf);
      const view = Las.View.create(data, header);
      const gx = view.getter('X'), gy = view.getter('Y'), gz = view.getter('Z'), gc = view.getter('Classification'), gn = view.getter('NumberOfReturns');
      const n = view.pointCount, xyz = new Float64Array(n * 3), cls = new Uint8Array(n), nr = new Uint8Array(n);
      for (let i = 0; i < n; i++) { xyz[i * 3] = gx(i); xyz[i * 3 + 1] = gy(i); xyz[i * 3 + 2] = gz(i); cls[i] = gc(i); nr[i] = gn(i); }
      pts = { n, xyz, cls, nr };
    }
    if (f) {
      mkdirSync(join(cacheDir, p), { recursive: true });
      const out = Buffer.alloc(4 + pts.n * 26); out.writeUInt32LE(pts.n, 0);
      Buffer.from(pts.xyz.buffer).copy(out, 4); Buffer.from(pts.cls.buffer).copy(out, 4 + pts.n * 24); Buffer.from(pts.nr.buffer).copy(out, 4 + pts.n * 25);
      /* tmp + rename (2026-10-16): prefetch-lidar.mjs fills the same folder while a measuring run reads it; never a half-written tile */
      const tmp = f + '.' + process.pid + '.tmp';
      try { writeFileSync(tmp, out); renameSync(tmp, f); } catch { try { unlinkSync(tmp); } catch {} }
    }
  }
  return pts;
}

/* Height grid over box [xmin,ymin,xmax,ymax] in EPSG:3857, cell = `cell` 3857 units.
   Returns { x0, y1, cell, w, h, hgt: Float32Array (NaN = no data), multi: Uint8Array (1 =
   split-pulse returns, i.e. vegetation), top: Float32Array elevations } — row 0 is the north edge. */
export async function heightGrid(p, box, cell, cacheDir) {
  const w = Math.ceil((box[2] - box[0]) / cell), h = Math.ceil((box[3] - box[1]) / cell);
  const top = new Float32Array(w * h).fill(-Infinity), gnd = new Float32Array(w * h).fill(Infinity), multi = new Uint8Array(w * h);
  let yr = null;
  if (p === TELLER) yr = tellerCells(box, cell, w, h, top, gnd, multi, cacheDir);
  else for (const key of await nodesFor(p, box)) {
    const t = await tilePoints(p, key, cacheDir);
    for (let i = 0; i < t.n; i++) {
      const x = t.xyz[i * 3], y = t.xyz[i * 3 + 1];
      if (x < box[0] || x >= box[2] || y < box[1] || y >= box[3]) continue;
      const c = Math.floor((x - box[0]) / cell), r = Math.floor((box[3] - y) / cell), o = r * w + c, z = t.xyz[i * 3 + 2], k = t.cls[i];
      if (k === 2) { if (z < gnd[o]) gnd[o] = z; }
      if (!SKIP.has(k)) { if (z > top[o]) top[o] = z; if (k !== 2 && t.nr[i] > 1) multi[o] = 1; }
    }
  }
  /* fill ground gaps (under trees and houses) from the nearest cell with ground, by rings */
  const g = Float32Array.from(gnd);
  for (let pass = 0; pass < 12; pass++) {
    let missing = 0;
    const next = Float32Array.from(g);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const o = r * w + c; if (g[o] !== Infinity) continue;
      let s = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue; const v = g[rr * w + cc]; if (v !== Infinity) { s += v; n++; } }
      if (n) next[o] = s / n; else missing++;
    }
    g.set(next);
    if (!missing) break;
  }
  const hgt = new Float32Array(w * h);
  for (let o = 0; o < w * h; o++) hgt[o] = top[o] === -Infinity || g[o] === Infinity ? NaN : Math.max(0, top[o] - g[o]);
  /* top: the highest return per cell as an elevation (-Infinity = none). Added 2026-10-06 for solar facing: a roof plane fitted
     to height above ground takes on the slope of the ground under the house, so on a hillside a low roof reads as facing downhill. */
  return { x0: box[0], y1: box[3], cell, w, h, hgt, multi, top, yr };
}

/* ---- Teller County (2026-10-08) ----------------------------------------------------
   Not in the cloud copy above. teller-grids.mjs turns the downloaded USGS LAZ files into 0.6 m Web Mercator grids
   (top, ground, split-pulse), lidar-cache/teller-grid/. Each grid cell inside the box counts as one return at the cell's
   centre, top and ground both, so the same gap fill and height follow. The year is the survey year of the grids used
   (2023 or 2024; the most cells wins). */
export const TELLER = 'CO_Teller_LAZ';
let tIndex = null;
const tMemo = new Map();
function tellerGrid(dir, name) {
  if (tMemo.has(name)) { const v = tMemo.get(name); tMemo.delete(name); tMemo.set(name, v); return v; }
  const b = readFileSync(join(dir, name + '.grid')), nl = b.indexOf(10), H = JSON.parse(b.subarray(0, nl).toString()), n = H.w * H.h, o = nl + 1;
  const g = { ...H, top: new Uint16Array(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + n * 2)), gnd: new Uint16Array(b.buffer.slice(b.byteOffset + o + n * 2, b.byteOffset + o + n * 4)), multi: new Uint8Array(b.buffer.slice(b.byteOffset + o + n * 4, b.byteOffset + o + n * 5)) };
  tMemo.set(name, g); if (tMemo.size > 12) tMemo.delete(tMemo.keys().next().value);
  return g;
}
function tellerCells(box, cell, w, h, top, gnd, multi, cacheDir) {
  const dir = join(cacheDir, 'teller-grid');
  if (!tIndex) tIndex = existsSync(join(dir, 'index.json')) ? JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) : {};
  const years = {};
  for (const [name, t] of Object.entries(tIndex)) {
    if (!(t.box[0] < box[2] && t.box[2] > box[0] && t.box[1] < box[3] && t.box[3] > box[1])) continue;
    const g = tellerGrid(dir, name);
    const c0 = Math.max(0, Math.floor((box[0] - g.x0) / g.R)), c1 = Math.min(g.w - 1, Math.floor((box[2] - g.x0) / g.R));
    const r0 = Math.max(0, Math.floor((g.y1 - box[3]) / g.R)), r1 = Math.min(g.h - 1, Math.floor((g.y1 - box[1]) / g.R));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * g.w + c, tz = g.top[i], gz = g.gnd[i];
      if (tz === 0xffff && gz === 0xffff) continue;
      const x = g.x0 + (c + 0.5) * g.R, y = g.y1 - (r + 0.5) * g.R;
      if (x < box[0] || x >= box[2] || y < box[1] || y >= box[3]) continue;
      const o = Math.floor((box[3] - y) / cell) * w + Math.floor((x - box[0]) / cell);
      if (gz !== 0xffff) { const z = g.zb + gz / 100; if (z < gnd[o]) gnd[o] = z; }
      if (tz !== 0xffff) { const z = g.zb + tz / 100; if (z > top[o]) top[o] = z; if (g.multi[i]) multi[o] = 1; }
      years[g.yr] = (years[g.yr] || 0) + 1;
    }
  }
  const best = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
  return best ? +best[0] : null;
}

/* keyed by the label the town lists use: the county where that was all (elpaso, douglas), else the survey block itself
   (2026-10-07, the editions' towns: drcog2 covers Arvada, Centennial, Thornton, Erie, Denver and Commerce City; drcog1 Boulder;
   eastern-b1 Windsor; 2026-10-08 teller: Woodland Park, Divide, Florissant, Cripple Creek from the downloaded files) */
export const PROJECT = { elpaso: 'CO_Eastern_ElPaso_2018', douglas: 'CO_DRCOG_2_2020', drcog2: 'CO_DRCOG_2_2020', drcog1: 'CO_DRCOG_1_2020', 'eastern-b1': 'CO_Eastern_B1_2018', teller: TELLER };
export const PROJECT_YEAR = { CO_Eastern_ElPaso_2018: 2018, CO_DRCOG_2_2020: 2020, CO_DRCOG_1_2020: 2020, CO_Eastern_B1_2018: 2018 };

/* ---- the measurement on LiDAR -------------------------------------------------------
   Same zones as zones.mjs. The building outline is first slid (up to 4 m each way) to
   where it sits on the most roof — outlines traced from photos are often a metre or two
   off the LiDAR — and every other outline on the lot (garage, shed) is masked with it.
   A cell counts as tree when it stands 2 m or taller AND shows split-pulse returns, and
   within 1 m of the wall only when it also rises 1.5 m above the roof (eaves). */
import { ZONES, TALL, inRing, inRings, ringDist, merc } from './zones.mjs';
export async function measureLidar(lat, lon, lotRings, house, others, project, cacheDir, debug) {
  const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;
  const P = lotRings.map((r) => r.map(([lo, la]) => merc(lo, la)));
  const xs = house.m.map((p) => p[0]), ys = house.m.map((p) => p[1]);
  const pad = ZONES.z3 / k + 6, box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const G = await heightGrid(project, box, cell, cacheDir);
  if (!G.hgt.some((v) => !Number.isNaN(v))) return { err: 'no LiDAR here' };
  const at = (X, Y) => { const c = Math.floor((X - G.x0) / cell), r = Math.floor((G.y1 - Y) / cell); return c < 0 || r < 0 || c >= G.w || r >= G.h ? -1 : r * G.w + c; };
  /* slide the outline onto the roof (2026-10-02, revised after the spot-check): a cell is
     roof-like when it stands 2.5 m+ with single returns, canopy when its returns split. Score
     = roof-like share minus canopy share, within 3 m. Scoring plain height slid outlines onto
     tree crowns on wooded lots, so yard trees then read as "against the house". */
  const hb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const stats = (ox, oy) => {
    const ring = house.m.map(([x, y]) => [x + ox, y + oy]); let n = 0, roof = 0, can = 0, sum = 0; const rv = [];
    for (let X = hb[0] + ox + cell / 2; X < hb[2] + ox; X += cell) for (let Y = hb[1] + oy + cell / 2; Y < hb[3] + oy; Y += cell) {
      if (!inRing(X, Y, ring)) continue; const o = at(X, Y); if (o < 0) continue; const v = G.hgt[o]; if (Number.isNaN(v)) continue;
      n++; sum += v;
      if (G.multi[o] === 1 && v >= TALL) can++; else if (v >= 2.5) { roof++; rv.push(v); }
    }
    return { n, roof: n ? roof / n : 0, can: n ? can / n : 0, mean: n ? sum / n : 0, rv };
  };
  let best = [0, 0], bestS = -Infinity, bestSt = stats(0, 0);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
    const st = stats(dx * cell, dy * cell); if (!st.n) continue;
    const sc = st.roof - st.can - Math.hypot(dx, dy) * 0.02;
    if (sc > bestS) { bestS = sc; best = [dx * cell, dy * cell]; bestSt = st; }
  }
  /* no roof at all where the outline is: the house is newer than the survey */
  const at0 = stats(0, 0);
  if (at0.mean < 1.5 && bestSt.roof < 0.3) return { err: 'house newer than the LiDAR' };
  /* roof hidden under canopy: keep the outline as drawn rather than chase the trees */
  if (bestSt.roof < 0.3) { best = [0, 0]; bestSt = at0; }
  const H = house.m.map(([x, y]) => [x + best[0], y + best[1]]);
  /* the roof height, for the eave rule below: from roof-like cells only (5 m if none) */
  const roofV = bestSt.rv.sort((a, b) => a - b);
  const roofH = roofV.length ? roofV[Math.floor(roofV.length / 2)] : 5;
  const O = others.map((b) => b.m.map(([x, y]) => [x + best[0], y + best[1]]));
  /* despeckle (2026-10-03, after the Castle Rock spot-check): a tree-like cell only counts when
     at least 3 of its 8 neighbours are tree-like too. Trees and shrubs are blobs; the lines of
     single cells along walls and fences, where a cell is half roof or fence and half ground and
     its pulse splits, are not. */
  const cand = new Uint8Array(G.w * G.h);
  for (let o = 0; o < G.w * G.h; o++) { const v = G.hgt[o]; cand[o] = !Number.isNaN(v) && v >= TALL && G.multi[o] === 1 ? 1 : 0; }
  const blob = (r, c) => { let k2 = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < G.h && cc < G.w && cand[rr * G.w + cc]) k2++; } return k2 >= 3; };
  const n = { z1: 0, z2: 0, z3: 0 }, t = { z1: 0, z2: 0, z3: 0 }; let tallest = 0;
  const zoneOf = debug ? new Uint8Array(G.w * G.h) : null, treeOf = debug ? new Uint8Array(G.w * G.h) : null;
  for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) {
    const X = G.x0 + (c + 0.5) * cell, Y = G.y1 - (r + 0.5) * cell, o = r * G.w + c;
    if (inRing(X, Y, H) || O.some((ring) => inRing(X, Y, ring)) || !inRings(X, Y, P)) continue;
    const v = G.hgt[o]; if (Number.isNaN(v)) continue;
    const dm = ringDist(X, Y, H) * k, z = dm <= ZONES.z1 ? 'z1' : dm <= ZONES.z2 ? 'z2' : dm <= ZONES.z3 ? 'z3' : null;
    if (!z) continue;
    n[z]++;
    /* roof edges: within 2 m of the wall, a cell straddling the roof edge reads as split-pulse
       "canopy" at about eave-to-roof height. There a cell counts only when it is clearly a
       crown over the roof (> roof + 1.5 m) or a shrub well below the eaves (< roof - 3 m). */
    const nearWall = dm <= 2.0, edgeLike = nearWall && v >= roofH - 3 && v <= roofH + 1.5;
    const tree = cand[o] === 1 && blob(r, c) && !edgeLike;
    if (tree) { t[z]++; if (z !== 'z3' && v > tallest) tallest = v; }
    if (debug) { zoneOf[o] = z === 'z1' ? 1 : z === 'z2' ? 2 : 3; treeOf[o] = tree ? 1 : 0; }
  }
  const share = (z) => (n[z] ? +(t[z] / n[z]).toFixed(2) : null);
  const ringArea = (rr) => { let a = 0; for (let i = 0, j = rr.length - 1; i < rr.length; j = i++) a += (rr[j][0] + rr[i][0]) * (rr[j][1] - rr[i][1]); return Math.abs(a / 2); };
  const res = { z1: share('z1'), z2: share('z2'), z3: share('z3'), n: [n.z1, n.z2, n.z3], h: Math.round(tallest), hs: Math.round(ringArea(H) * k * k * 10.7639),
    src: 'lidar', yr: PROJECT_YEAR[project] || null, roof: +roofH.toFixed(1), shift: [+(best[0] * k).toFixed(1), +(best[1] * k).toFixed(1)] };
  if (debug) Object.assign(res, { G, H, zoneOf, treeOf });
  return res;
}

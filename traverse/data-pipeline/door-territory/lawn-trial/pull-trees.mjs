/* Trees on a pulled-in house, from the USGS laser survey (2026-10-22, Matthew: "yes do 1 and 2" after 3855 S Valentia Ct read "Good to quote"
   at 3,000 sq ft and measured 8,111 by hand). "Pull this property" had no tree reading, so the house card took every pulled-in house for an
   open lot. This gives it the same reading the towns have: the share of the 0-5, 5-30 and 30-100 ft rings around the house under tree crowns,
   the tallest tree, the survey and its year ({ z1, z2, z3, h, src: 'lidar', yr }), measured by tree-zones/lidar.mjs's measureLidar.
   A pulled-in house has no building outline, so the outline comes from the laser itself: the biggest patch of roof (2.5 m or taller, single
   returns) on the lot, as the hull of its cells. The survey is the first USGS one (Entwine copy on AWS) whose extent holds the house.
   Teller County's survey is not in that copy, so a Teller house gets no reading (null), as does a house built after its survey.
     import { treesFor, lotAcres } from './pull-trees.mjs';  await treesFor(lat, lon, rings, cacheDir, 45000) */
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const L = await import(existsSync(new URL('./lidar.mjs', import.meta.url)) ? './lidar.mjs' : '../tree-zones/lidar.mjs');   /* flat on the server, beside it in the repo */
const Z = await import(existsSync(new URL('./zones.mjs', import.meta.url)) ? './zones.mjs' : '../tree-zones/zones.mjs');
const SURVEYS = ['CO_DRCOG_2_2020', 'CO_DRCOG_1_2020', 'CO_DRCOG_3_2020', 'CO_Eastern_ElPaso_2018', 'CO_Eastern_B1_2018'];
const BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/';
const bounds = new Map();
async function surveysFor(X, Y) {   /* every survey whose box holds the point: boxes overlap, and a box can hold the point with no data there */
  const out = [];
  for (const p of SURVEYS) {
    if (!bounds.has(p)) { try { const e = await (await fetch(BASE + p + '/ept.json')).json(); bounds.set(p, e.boundsConforming || e.bounds); } catch { bounds.set(p, null); } }
    const b = bounds.get(p); if (b && X >= b[0] && X <= b[3] && Y >= b[1] && Y <= b[4]) out.push(p);
  }
  return out;
}
/** the lot's area in acres, from its outline (Denver sends the state layer no acreage) */
export function lotAcres(rings) {
  const lat = rings[0].reduce((s, p) => s + p[1], 0) / rings[0].length, k = Math.cos(lat * Math.PI / 180);
  let a = 0; for (const r of rings) { const m = r.map(([lo, la]) => Z.merc(lo, la)); for (let i = 0; i < m.length; i++) { const [x1, y1] = m[i], [x2, y2] = m[(i + 1) % m.length]; a += x1 * y2 - x2 * y1; } }
  return +(Math.abs(a / 2) * k * k / 4046.86).toFixed(2);
}
/* the convex hull of points (monotone chain) */
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
async function measure(lat, lon, rings, cacheDir) {
  const [X, Y] = Z.merc(lon, lat), projects = await surveysFor(X, Y);
  if (!projects.length) return { err: 'no laser survey here' };
  let last = { err: 'no laser data on this lot' };
  for (const project of projects) { const r = await measureOn(project, lat, lon, rings, cacheDir); if (!r.err) return r; last = r; }
  return last;
}
async function measureOn(project, lat, lon, rings, cacheDir) {
  const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;
  const M = rings.map((r) => r.map(([lo, la]) => Z.merc(lo, la))), xs = M.flat().map((p) => p[0]), ys = M.flat().map((p) => p[1]), pad = 3 / k;
  const G = await L.heightGrid(project, [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad], cell, cacheDir);
  if (!G.hgt.some((v) => !Number.isNaN(v))) return { err: 'no laser data on this lot' };
  /* the roof: cells 2.5 m+ with single returns, on the lot; the biggest connected patch */
  const roof = new Uint8Array(G.w * G.h);
  for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) { const o = r * G.w + c, v = G.hgt[o]; if (v >= 2.5 && !G.multi[o] && Z.inRings(G.x0 + (c + 0.5) * cell, G.y1 - (r + 0.5) * cell, M)) roof[o] = 1; }
  const seen = new Uint8Array(G.w * G.h); let best = [];
  for (let o0 = 0; o0 < roof.length; o0++) {
    if (!roof[o0] || seen[o0]) continue;
    const st = [o0], comp = []; seen[o0] = 1;
    while (st.length) { const o = st.pop(); comp.push(o); const r = Math.floor(o / G.w), c = o % G.w; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= G.h || cc >= G.w) continue; const q = rr * G.w + cc; if (roof[q] && !seen[q]) { seen[q] = 1; st.push(q); } } }
    if (comp.length > best.length) best = comp;
  }
  if (best.length < 40) return { err: 'no house on the laser survey (newer than it?)' };   /* under ~430 sq ft of roof */
  const corners = []; for (const o of best) { const r = Math.floor(o / G.w), c = o % G.w, x = G.x0 + c * cell, y = G.y1 - r * cell; corners.push([x, y], [x + cell, y], [x, y - cell], [x + cell, y - cell]); }
  const res = await L.measureLidar(lat, lon, rings, { m: hull(corners) }, [], project, cacheDir);
  if (res.err) return { err: res.err };
  return { z1: res.z1, z2: res.z2, z3: res.z3, h: res.h, src: 'lidar', yr: res.yr, house: 'laser' };   /* house: the outline came from the laser, not a building map */
}
/** the tree reading, or null when there is no survey, no house on it, or it takes longer than ms */
export async function treesFor(lat, lon, rings, cacheDir, ms = 45000) {
  try {
    mkdirSync(cacheDir, { recursive: true });
    const old = Date.now() - 30 * 86400000;   /* tiles kept a month, so a second look at the same street is quick, then cleared */
    for (const f of readdirSync(cacheDir, { recursive: true })) { const p = join(cacheDir, String(f)); try { const s = statSync(p); if (s.isFile() && s.mtimeMs < old) unlinkSync(p); } catch {} }
    const r = await Promise.race([measure(lat, lon, rings, cacheDir), new Promise((ok) => setTimeout(() => ok({ err: 'took too long' }), ms))]);
    return r && !r.err ? r : null;
  } catch { return null; }
}

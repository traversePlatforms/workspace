/* Checks build-lot.mjs's corner lots against real lot lines (2026-10-29). "Backs onto a road" (bk) has its own check since it was
 * rebuilt the same night: check-back.mjs.
 *   node check-lot.mjs <town> [parcels.json]
 * The lot lines: the state parcel layer as already cached on disk for the lawn work (lawn-trial/drcog-turf/parcels-<town>.json,
 * { cells: { key: [rings, ...] } }); nothing is fetched. For each door, the parcel that holds its point; then, along the lot line
 * every 2 m, which named streets (TIGER 2026) run within 13 m of it. The truth for a door:
 *   corner   its own street and another named street each run along 6 m or more of the lot line, on sides roughly square to each other
 * Prints the agreement and a few disagreements of each kind (address and the numbers) to look at on a map. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countyFiles, readRoads } from './tiger-roads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.ROUNDS_DATA || join(HERE, '..', '..', '..', 'app', 'data', 'rounds'), CACHE = process.env.LOT_CACHE || join(HERE, 'cache');
const town = process.argv[2], pf = process.argv[3] || join(HERE, '..', 'lawn-trial', 'drcog-turf', `parcels-${town}.json`);
const MAIN_DT = process.env.DT_DIR; const pfile = existsSync(pf) ? pf : join(MAIN_DT || '', 'lawn-trial', 'drcog-turf', `parcels-${town}.json`);
const parcels = Object.values(JSON.parse(readFileSync(pfile, 'utf8')).cells).flat();
const lot = JSON.parse(readFileSync(join(process.env.LOT_OUT || DATA, `security-lot-${town}.json`), 'utf8')).doors;
const doors = JSON.parse(readFileSync(join(DATA, `${town}.json`), 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat != null);
const lat0 = doors[0].lat, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540, P = (lon, lat) => [lon * kx, lat * ky];
const ABBR = { STREET: 'ST', AVENUE: 'AVE', DRIVE: 'DR', ROAD: 'RD', COURT: 'CT', CIRCLE: 'CIR', LANE: 'LN', PLACE: 'PL', TRAIL: 'TRL', PARKWAY: 'PKWY', BOULEVARD: 'BLVD', LOOP: 'LP', VISTA: 'VIS', TERRACE: 'TER', POINT: 'PT', NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W' };
const core = (s) => { const t = String(s || '').toUpperCase().replace(/[.,'#-]/g, ' ').split(/\s+/).filter(Boolean).map((x) => ABBR[x] || x); while (t.length > 1 && /^(N|S|E|W)$/.test(t[0])) t.shift(); if (t.length > 1) t.pop(); return t.join(' '); };
const streetOf = (a) => String(a || '').toUpperCase().replace(/\s+(UNIT|APT|STE|#)\b.*$/, '').replace(/^\s*\d+[A-Z]?(\s+\d\/\d)?\s+/, '').trim();

/* the doors' box, its parcels and roads */
const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon), box = [Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01];
const roads = [];
for (const f of countyFiles(join(CACHE, 'tiger'))) { if (f.box[2] < box[0] || f.box[0] > box[2] || f.box[3] < box[1] || f.box[1] > box[3]) continue;
  for (const r of readRoads(f)) if (r.n && /^S1(200|400|640|100|630)$/.test(r.c)) for (const l of r.lines) if (l.some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])) roads.push({ n: r.n, core: core(r.n), l: l.map(([x, y]) => P(x, y)) }); }
const G = 60, grid = new Map();
roads.forEach((r, i) => { for (let k = 1; k < r.l.length; k++) { const a = r.l[k - 1], b = r.l[k]; for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) { const key = gx + ',' + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push([i, a, b]); } } });
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const pr = parcels.map((rings) => { const r = rings[0].map(([x, y]) => P(x, y)); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return { r, bb: [a, b, c, d] }; });
const PG = 100, pgrid = new Map(); pr.forEach((p, i) => { for (let gx = Math.floor(p.bb[0] / PG); gx <= Math.floor(p.bb[2] / PG); gx++) for (let gy = Math.floor(p.bb[1] / PG); gy <= Math.floor(p.bb[3] / PG); gy++) { const k = gx + ',' + gy; if (!pgrid.has(k)) pgrid.set(k, []); pgrid.get(k).push(i); } });
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))) * 180 / Math.PI;

/* the point nearest p where a road of core c1 meets one of core c2 (crossing, or ending within 3 m of it), within R */
const byCore = new Map(); roads.forEach((r) => { if (!byCore.has(r.core)) byCore.set(r.core, []); byCore.get(r.core).push(r.l); });
function meet(c1, c2, p, R) {
  const segs = (c) => { const o = []; for (const l of byCore.get(c) || []) for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; if (Math.min(a[0], b[0]) > p[0] + R || Math.max(a[0], b[0]) < p[0] - R || Math.min(a[1], b[1]) > p[1] + R || Math.max(a[1], b[1]) < p[1] - R) continue; o.push([a, b]); } return o; };
  let best = null, bd = Infinity; const take = (X) => { const d = Math.hypot(X[0] - p[0], X[1] - p[1]); if (d < bd) { bd = d; best = X; } };
  const near = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return [a[0] + t * dx, a[1] + t * dy]; };
  for (const [a, b] of segs(c1)) for (const [c, e] of segs(c2)) {
    const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [e[0] - c[0], e[1] - c[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    if (den) { const t = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den, s = ((c[0] - a[0]) * d1[1] - (c[1] - a[1]) * d1[0]) / den; if (t >= 0 && t <= 1 && s >= 0 && s <= 1) take([a[0] + t * d1[0], a[1] + t * d1[1]]); }
    for (const q of [c, e]) { const z = near(q, a, b); if (Math.hypot(z[0] - q[0], z[1] - q[1]) <= 3) take(z); }
    for (const q of [a, b]) { const z = near(q, c, e); if (Math.hypot(z[0] - q[0], z[1] - q[1]) <= 3) take(z); }
  }
  return best;
}
const m = { tp: 0, fp: 0, fn: 0, tn: 0, nolot: 0, noown: 0 }, ex = { fp: [], fn: [] };
for (const d of doors) {
  const p = P(d.lon, d.lat), cands = pgrid.get(Math.floor(p[0] / PG) + ',' + Math.floor(p[1] / PG)) || [];
  const hit = cands.map((i) => pr[i]).filter((q) => p[0] >= q.bb[0] && p[0] <= q.bb[2] && p[1] >= q.bb[1] && p[1] <= q.bb[3] && inRing(p[0], p[1], q.r));
  if (hit.length !== 1) { m.nolot++; continue; }
  const r = hit[0].r, cx = r.reduce((s, q) => s + q[0], 0) / r.length, cy = r.reduce((s, q) => s + q[1], 0) / r.length;
  const front = new Map();   /* road core -> [samples, sum x, sum y, name] */
  for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let k = 0; k < n; k++) { const s = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]; const seg = grid.get(Math.floor(s[0] / G) + ',' + Math.floor(s[1] / G)) || [];
      const seen = new Set(); for (const [ri, x, y] of seg) { const c = roads[ri].core; if (seen.has(c)) continue; if (segD(s, x, y) <= 13) { seen.add(c); const f = front.get(c) || [0, 0, 0, roads[ri].n]; f[0]++; f[1] += s[0]; f[2] += s[1]; front.set(c, f); } } } }
  const own = core(streetOf(d.address)), fo = front.get(own);
  const v = lot[d.id] ? JSON.parse(lot[d.id]) : {};
  if (!fo || fo[0] < 3) { m.noown++; continue; }
  let tc = null;
  for (const [c, f] of front) {
    if (c === own || f[0] < 3) continue;
    /* where the two streets meet, measured to the lot line: at the lot (a corner) or nowhere near it (a street behind) */
    const X = meet(own, c, [cx, cy], 150), dl = X ? Math.min(...r.map((q, i) => i ? segD(X, r[i - 1], q) : Infinity)) : Infinity;
    if (dl <= 22 || (X && inRing(X[0], X[1], r))) tc = tc || f[3];
  }
  const row = { address: d.address, acres: d.acres, lat: d.lat, lon: d.lon, said: v.c || null, truth: tc };
  if (tc && v.c) m.tp++; else if (tc) { m.fn++; ex.fn.push(row); } else if (v.c) { m.fp++; ex.fp.push(row); } else m.tn++;
}
console.log(town, m);
console.log(`corner: precision ${(m.tp / (m.tp + m.fp) * 100).toFixed(1)}%, recall ${(m.tp / (m.tp + m.fn) * 100).toFixed(1)}%`);
const pick = (a, n) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / n)) === 0).slice(0, n);
for (const k of ['fp', 'fn']) { console.log(k); for (const x of pick(ex[k], 6)) console.log('  ', JSON.stringify(x)); }

/* Checks "backs onto a road" (build-lot.mjs bk, from back-road.mjs) against the lot lines, by a different route (2026-10-29).
 *   node check-back.mjs <town> [--show=N]
 * The build casts rays from the lot's middle along the front-to-back line and stops at the first road or home lot. This check does
 * not cast rays and does not use the build's street matching or lot middle. For every door whose point sits in exactly one lot (with
 * no other home in it):
 *   front     the stretch of lot line (sampled every metre) within 8 m of its closest approach to the house's own street, matched here
 *             by the street's core name only; back = from the front's middle to the middle of the lot line
 *   rear      the lot line samples in the back 15% of the lot along that line
 *   a road    (TIGER 2026, named, S1100 / S1200 / S1400 / S1640, not the own street) counts when its nearest point to the rear is
 *             60 m or less away, lies within 45 degrees of straight back from the lot's middle, and the road runs across the back
 *             there (40 degrees or more off the front-to-back line), not along the side;
 *   clear     the strip between the rear and that road (the four-sided area from the rear's two outer points to their nearest points
 *             on the road) is sampled every 2 m: no sample may fall in another lot with a home's point in it or shaped like a
 *             building lot (compact, under 2.5 ha: an apartment block, a shop, a house we have no list for), and no home's point
 *             may fall in the strip, and no other road may cross it (the road must be the first one behind).
 * Truth = some road passes all of that. The build's fact is right when the truth holds for the same road (by core name).
 * Prints precision and recall, both by distance and road class, and a few disagreements (address, numbers) to look at.
 * Lot lines: lawn-trial/drcog-turf/parcels-<town>.json (state layer) or security/cache/parcels-<town>.json (Denver's own). */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countyFiles, readRoads } from './tiger-roads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.ROUNDS_DATA || join(HERE, '..', '..', '..', 'app', 'data', 'rounds'), CACHE = process.env.LOT_CACHE || join(HERE, 'cache');
const DT = process.env.DT_DIR || join(HERE, '..'), OUTD = process.env.LOT_OUT || DATA;
const town = process.argv[2], SHOW = +((process.argv.find((a) => a.startsWith('--show=')) || '--show=6').slice(7));
const pf = [join(DT, 'lawn-trial', 'drcog-turf', `parcels-${town}.json`), join(CACHE, `parcels-${town}.json`)].find((f) => existsSync(f));
if (!pf) throw new Error('no cached lot lines for ' + town);
const lot = JSON.parse(readFileSync(join(OUTD, `security-lot-${town}.json`), 'utf8')).doors;
const doors = JSON.parse(readFileSync(join(DATA, `${town}.json`), 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat != null);
const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon), box = [Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01];
const lat0 = (box[1] + box[3]) / 2, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540, P = (lon, lat) => [lon * kx, lat * ky];
const inBox = (x, y) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];

/* every home's point in the box: every town's door list and grey dots (a neighbour across a town line still counts) */
const homes = [];
for (const f of readdirSync(DATA)) if (/^others-.+\.json$/.test(f)) for (const o of JSON.parse(readFileSync(join(DATA, f), 'utf8')).doors || []) if (Number.isFinite(o[0]) && inBox(o[1], o[0])) homes.push(P(o[1], o[0]));
for (const r of JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8')).regions) {
  const f = join(DATA, `${r.key}.json`); if (String(r.key).startsWith('com-') || r.metro || !existsSync(f)) continue;
  for (const a of JSON.parse(readFileSync(f, 'utf8')).areas || []) for (const x of a.doors || []) if (x.lat != null && inBox(x.lon, x.lat)) homes.push(P(x.lon, x.lat));
}
const HG = 40, hg = new Map(); for (const h of homes) { const k = Math.floor(h[0] / HG) + ',' + Math.floor(h[1] / HG); if (!hg.has(k)) hg.set(k, []); hg.get(k).push(h); }
const homesIn = (a, b, c, d) => { const o = []; for (let gx = Math.floor(a / HG); gx <= Math.floor(c / HG); gx++) for (let gy = Math.floor(b / HG); gy <= Math.floor(d / HG); gy++) for (const h of hg.get(gx + ',' + gy) || []) if (h[0] >= a && h[0] <= c && h[1] >= b && h[1] <= d) o.push(h); return o; };

/* lots, once each */
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const seen = new Set(), lots = [];
for (const cell of Object.values(JSON.parse(readFileSync(pf, 'utf8')).cells)) for (const rr of cell) {
  const r0 = rr[0]; if (!r0 || r0.length < 4) continue; const k = JSON.stringify(r0.slice(0, 3)) + r0.length; if (seen.has(k)) continue; seen.add(k);
  if (!r0.some(([x, y]) => inBox(x, y))) continue;
  const r = r0.map(([x, y]) => P(x, y)); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of r) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  const L = { r, bb: [a, b, c, d] }; L.homes = homesIn(a, b, c, d).filter((h) => inRing(h[0], h[1], r)).length;
  /* a lot with no home on our lists but shaped like a building lot (compact: perimeter squared over area under 30, under 2.5 ha) is
     taken as built on (an apartment block, a shop, a house in a town we have no list for) */
  let A2 = 0, P2 = 0; for (let i = 1; i < r.length; i++) { A2 += (r[i - 1][0] - r[0][0]) * (r[i][1] - r[0][1]) - (r[i][0] - r[0][0]) * (r[i - 1][1] - r[0][1]); P2 += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); } A2 = Math.abs(A2) / 2;
  L.built = L.homes > 0 || (A2 > 0 && A2 < 25000 && P2 * P2 / A2 < 30); lots.push(L);
}
const LG = 100, lg = new Map(); lots.forEach((L, i) => { for (let gx = Math.floor(L.bb[0] / LG); gx <= Math.floor(L.bb[2] / LG); gx++) for (let gy = Math.floor(L.bb[1] / LG); gy <= Math.floor(L.bb[3] / LG); gy++) { const k = gx + ',' + gy; if (!lg.has(k)) lg.set(k, []); lg.get(k).push(i); } });
const lotsAt = (x, y) => (lg.get(Math.floor(x / LG) + ',' + Math.floor(y / LG)) || []).map((i) => lots[i]).filter((L) => x >= L.bb[0] && x <= L.bb[2] && y >= L.bb[1] && y <= L.bb[3] && inRing(x, y, L.r));

/* roads: a simple core name of its own (no shared code with the build's matcher) */
const ABBR = { STREET: 'ST', AVENUE: 'AVE', DRIVE: 'DR', ROAD: 'RD', COURT: 'CT', CIRCLE: 'CIR', LANE: 'LN', PLACE: 'PL', TRAIL: 'TRL', PARKWAY: 'PKWY', BOULEVARD: 'BLVD', LOOP: 'LP', TERRACE: 'TER', POINT: 'PT', NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W' };
const TYPEW = /^(ST|AVE|DR|RD|CT|CIR|LN|PL|TRL|PKWY|BLVD|LP|TER|PT|WAY|HWY|VW|VIS|RDG|XING|SQ|PATH|PASS|RUN|ROW|WALK|CV|GLN|HTS|AV|PKY)$/;
const core = (s) => { const t = String(s || '').toUpperCase().replace(/[.,'#-]/g, ' ').split(/\s+/).filter(Boolean).map((x) => ABBR[x] || x); while (t.length > 1 && /^(N|S|E|W)$/.test(t[0])) t.shift(); while (t.length > 1 && /^(N|S|E|W)$/.test(t[t.length - 1])) t.pop(); if (t.length > 1 && TYPEW.test(t[t.length - 1])) t.pop(); return t.join(' '); };
const streetOf = (a) => String(a || '').toUpperCase().replace(/\s+(UNIT|APT|STE|#)\b.*$/, '').replace(/^\s*\d+[A-Z]?(\s+\d\/\d)?\s+/, '').trim();
const roads = [];
for (const f of countyFiles(join(CACHE, 'tiger'))) { if (f.box[2] < box[0] || f.box[0] > box[2] || f.box[3] < box[1] || f.box[1] > box[3]) continue;
  for (const r of readRoads(f)) if (r.n && /^S1(100|200|400|640)$/.test(r.c)) for (const l of r.lines) if (l.some(([x, y]) => inBox(x, y))) roads.push({ n: r.n, c: r.c, core: core(r.n), l: l.map(([x, y]) => P(x, y)) }); }
const G = 60, grid = new Map();
roads.forEach((r, i) => { for (let k = 1; k < r.l.length; k++) { const a = r.l[k - 1], b = r.l[k]; for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) { const key = gx + ',' + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push([i, a, b]); } } });
const nearPt = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return [a[0] + t * dx, a[1] + t * dy]; };
const segsNear = (bb) => { const o = new Map(); for (let gx = Math.floor(bb[0] / G); gx <= Math.floor(bb[2] / G); gx++) for (let gy = Math.floor(bb[1] / G); gy <= Math.floor(bb[3] / G); gy++) for (const s of grid.get(gx + ',' + gy) || []) o.set(s[1], s); return [...o.values()]; };
const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))) * 180 / Math.PI;
const inQuad = (x, y, q) => inRing(x, y, q);

function truthOf(d) {
  const p = P(d.lon, d.lat), here = lotsAt(p[0], p[1]);
  if (here.length !== 1 || here[0].homes > 1) return { skip: 'lot' };
  const L = here[0], r = L.r, own = core(streetOf(d.address));
  /* the lot line every metre */
  const pts = []; for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  const pad = 140, segs = segsNear([L.bb[0] - pad, L.bb[1] - pad, L.bb[2] + pad, L.bb[3] + pad]);
  const ownSegs = segs.filter((s) => roads[s[0]].core === own);
  if (!ownSegs.length) return { skip: 'own' };
  const dOwn = pts.map((q) => Math.min(...ownSegs.map(([, a, b]) => { const z = nearPt(q, a, b); return Math.hypot(z[0] - q[0], z[1] - q[1]); })));
  const dmin = Math.min(...dOwn); if (dmin > 40) return { skip: 'own' };
  const fr = pts.filter((_, i) => dOwn[i] <= dmin + 8), f = [fr.reduce((s, q) => s + q[0], 0) / fr.length, fr.reduce((s, q) => s + q[1], 0) / fr.length];
  const c = [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
  const ul = Math.hypot(c[0] - f[0], c[1] - f[1]); if (ul < 2) return { skip: 'shape' };
  const u = [(c[0] - f[0]) / ul, (c[1] - f[1]) / ul], w = [-u[1], u[0]];
  const pr = pts.map((q) => (q[0] - f[0]) * u[0] + (q[1] - f[1]) * u[1]), tmax = Math.max(...pr);
  const rear = pts.filter((q, i) => pr[i] >= 0.85 * tmax && dOwn[i] > dmin + 8);
  if (rear.length < 3) return { skip: 'shape' };
  const best = new Map();
  for (const s of segs) {
    const R = roads[s[0]]; if (R.core === own) continue;
    for (const q of rear) { const z = nearPt(q, s[1], s[2]), dd = Math.hypot(z[0] - q[0], z[1] - q[1]); const o = best.get(R.core); if (!o || dd < o.d) best.set(R.core, { d: dd, q, z, seg: s, R }); }
  }
  let found = null;
  const DBG = process.env.CHECK_ID === d.id ? [] : null;
  for (const [k, b] of [...best].sort((a, z) => a[1].d - z[1].d)) {
    if (DBG) DBG.push(['road', b.R.n, Math.round(b.d), 'behind', Math.round(ang([b.z[0] - c[0], b.z[1] - c[1]], u))]);
    if (b.d > 60) break;
    if (ang([b.z[0] - c[0], b.z[1] - c[1]], u) > 45) continue;                                 /* behind, not beside */
    const tg = [b.seg[2][0] - b.seg[1][0], b.seg[2][1] - b.seg[1][1]], ta = ang(tg, u);
    if (DBG) DBG.push(['across', Math.round(Math.min(ta, 180 - ta))]);
    if (Math.min(ta, 180 - ta) < 40) continue;                                                  /* runs across the back */
    /* the strip from the rear's outer points to the road */
    const lat = rear.map((q) => (q[0] - c[0]) * w[0] + (q[1] - c[1]) * w[1]);
    const onR = (q) => { let z0 = null, dd = Infinity; for (const s of segs) if (roads[s[0]].core === k) { const z = nearPt(q, s[1], s[2]), e = Math.hypot(z[0] - q[0], z[1] - q[1]); if (e < dd) { dd = e; z0 = z; } } return z0; };
    /* the rear's outer points, pulled 1.5 m in from each side so the neighbours' shared side lines are not sampled */
    let A = rear[lat.indexOf(Math.min(...lat))], B = rear[lat.indexOf(Math.max(...lat))];
    const ab = Math.hypot(B[0] - A[0], B[1] - A[1]), inset = Math.max(0, Math.min(1.5, ab / 2 - 0.25));
    if (ab > 0) { const e = [(B[0] - A[0]) / ab, (B[1] - A[1]) / ab]; A = [A[0] + e[0] * inset, A[1] + e[1] * inset]; B = [B[0] - e[0] * inset, B[1] - e[1] * inset]; }
    const A2 = onR(A), B2 = onR(B), quad = [A, B, B2, A2, A];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of quad) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let blocked = false;
    const test = (x, y) => { if (inRing(x, y, r)) return; const zr = onR([x, y]); if (Math.hypot(zr[0] - x, zr[1] - y) < 3) return;   /* the road itself */
      for (const M of lotsAt(x, y)) if (M !== L && M.built) { blocked = true; if (DBG) DBG.push(['lot', Math.round(x - A[0]), Math.round(y - A[1])]); return; } };
    for (let x = x0 + 1; x <= x1 && !blocked; x += 2) for (let y = y0 + 1; y <= y1 && !blocked; y += 2) if (inQuad(x, y, quad)) test(x, y);
    /* and the strip's middle line every metre (a narrow or pointed rear has no 2 m grid inside it) */
    const M0 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], M1 = [(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2], ml = Math.hypot(M1[0] - M0[0], M1[1] - M0[1]);
    for (let s2 = 1; s2 < ml && !blocked; s2 += 1) test(M0[0] + (M1[0] - M0[0]) * s2 / ml, M0[1] + (M1[1] - M0[1]) * s2 / ml);
    if (!blocked) for (const h of homesIn(x0, y0, x1, y1)) if (inQuad(h[0], h[1], quad) && !inRing(h[0], h[1], r)) { blocked = true; if (DBG) DBG.push(['home']); break; }
    /* the first road behind: no other road crosses the strip */
    if (!blocked) {
      const X = (a, b, c, d) => { const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0; if (!den) return false; const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u2 = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den; return t >= 0 && t <= 1 && u2 >= 0 && u2 <= 1; };
      /* TIGER draws some roads twice under two names (McArthur Ranch Rd and Fairview Pkwy): a line within 4 m of the road is the road */
      const onK = (q) => { const z = onR(q); return Math.hypot(z[0] - q[0], z[1] - q[1]) < 4; };
      for (const sg of segs) { if (roads[sg[0]].core === k || (onK(sg[1]) && onK(sg[2]))) continue;
        if (inQuad(sg[1][0], sg[1][1], quad) || inQuad(sg[2][0], sg[2][1], quad) || [0, 1, 2, 3].some((i) => X(quad[i], quad[i + 1], sg[1], sg[2]))) { blocked = true; if (DBG) DBG.push(['crossed by', roads[sg[0]].n]); break; } }
    }
    if (blocked) continue;
    /* the same road under another TIGER name: a line within 4 m of where this one is nearest */
    const al = new Set([k]); for (const s of segs) { const z = nearPt(b.z, s[1], s[2]); if (Math.hypot(z[0] - b.z[0], z[1] - b.z[1]) < 4) al.add(roads[s[0]].core); }
    found = { core: k, al, n: b.R.n, c: b.R.c, d: b.d }; break;
  }
  if (DBG) console.log('DEBUG', d.id, 'own', own, 'u', u.map((x) => x.toFixed(2)), 'rear pts', rear.length, JSON.stringify(DBG));
  return { truth: found };
}

const m = { tp: 0, fp: 0, fn: 0, tn: 0, wrong: 0, skip: {} }, ex = { fp: [], fn: [] }, bins = {}, cls = {}, dd = [];
const bin = (x) => x < 20 ? '0-20' : x < 40 ? '20-40' : '40-60';
for (const d of doors) {
  const v = lot[d.id] ? JSON.parse(lot[d.id]) : {}, said = v.bk || null;
  const t = truthOf(d);
  if (t.skip) { m.skip[t.skip] = (m.skip[t.skip] || 0) + 1; if (said) { m.skip['said:' + t.skip] = (m.skip['said:' + t.skip] || 0) + 1; } continue; }
  const T = t.truth, row = { id: d.id, address: d.address, lat: d.lat, lon: d.lon, said, truth: T && [T.n, Math.round(T.d)] };
  if (said) {
    const b = bin(said[1]), k = said[2] || 'local'; bins[b] = bins[b] || [0, 0]; cls[k] = cls[k] || [0, 0];
    const ok = T && T.al.has(core(said[0]));
    if (ok) { m.tp++; bins[b][0]++; cls[k][0]++; dd.push(Math.abs(said[1] - T.d)); } else { m.fp++; if (T) m.wrong++; bins[b][1]++; cls[k][1]++; ex.fp.push(row); }
  } else if (T) { m.fn++; ex.fn.push(row); } else m.tn++;
}
const pc = (a, b) => (a + b ? (100 * a / (a + b)).toFixed(1) + '%' : '-');
dd.sort((a, b) => a - b);
console.log(town, JSON.stringify(m));
console.log(`backs onto a road: precision ${pc(m.tp, m.fp)} (${m.tp} of ${m.tp + m.fp}), recall ${pc(m.tp, m.fn)} (${m.tp} of ${m.tp + m.fn}); distance off by median ${dd[Math.floor(dd.length / 2)]?.toFixed(1)} m, 90th ${dd[Math.floor(dd.length * 0.9)]?.toFixed(1)} m`);
console.log('  by distance:', Object.entries(bins).map(([k, v]) => `${k} m ${pc(v[0], v[1])} of ${v[0] + v[1]}`).join(' · '));
console.log('  by class:', Object.entries(cls).map(([k, v]) => `${k} ${pc(v[0], v[1])} of ${v[0] + v[1]}`).join(' · '));
const pick = (a, n) => a.filter((_, i) => i % Math.max(1, Math.floor(a.length / n)) === 0).slice(0, n);
for (const k of ['fp', 'fn']) { console.log(k); for (const x of pick(ex[k], SHOW)) console.log('  ', JSON.stringify(x)); }
if (process.env.CHECK_DUMP) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.CHECK_DUMP, JSON.stringify(ex)); }

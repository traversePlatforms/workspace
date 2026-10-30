/* "Backs onto a road" for the Security lot facts (2026-10-29, Matthew: "Is there a better way to detect road behind the lot? seems
 * like a high security risk for homes"). The first try (a named road within half the estimated lot depth, across from the house's
 * street) was right only about half the time against real lot lines: most parkways sit behind a strip of HOA land, and the guess
 * at the lot's shape put the back in the wrong place. This one reads the lot line itself.
 *
 * The fact: a road of a class that carries traffic (TIGER S1100 primary, S1200 secondary, S1400 local, S1640 service drive; named)
 * runs within MAX_M behind the back lot line, it is not the house's own street, and between the back lot line and the road there
 * is no other home's lot and no other home's point (open land, an HOA strip, a ditch or a wall is fine).
 *
 * How, per door that has a lot line (the parcel holding the house point, and only one home in it):
 *   - the back direction: from the nearest point of the house's own street to the middle of the lot;
 *   - RAYS rays run that way, spread across the lot's width (20% to 80%); each leaves the lot through its back line (a ray that
 *     leaves through a side line is dropped) and goes on up to MAX_M + 20 m; the first road of those classes it crosses is its road
 *     if the road runs across the ray (40 degrees or more), unless the ray crosses another home's lot, a parcel shaped like a
 *     building lot (lotLike), passes within 6 m of a home's point, or reaches land with no lot line on file (more than 30 m short
 *     of the road) first, or the first road is the house's own street;
 *   - the fact holds when at least NEED rays reach the same road, at most one is stopped, and the middle distance from the back
 *     lot line to the road's centre line is MAX_M or less. (build-lot.mjs then drops a road that meets the own street within 45 m
 *     of the house point: a corner lot's side street.)
 * Checked by check-back.mjs (a different route through the same lot lines) and on the aerial photo: README.
 * Without a lot line no fact is made (the house point and street alone were checked and are not good enough: see README).
 *
 * The lot lines: whatever parcel polygons are cached on disk (no fetch here): the state parcel layer as the lawn work cached it
 * (lawn-trial/drcog-turf/parcels-<town>.json: Highlands Ranch, Thornton, Westminster) and Denver's own parcels
 * (cache/parcels-denver.json, fetch-denver-parcels.mjs). Both are { cells: { key: [ [ring, ...], ... ] } }, lon/lat. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const BACK_CLASSES = new Set(['S1100', 'S1200', 'S1400', 'S1640']);
export const MAX_M = 60, RAYS = 5, NEED = 3;

/* every cached parcel file: [{ file, box }], the box read from the file once it is loaded */
export function parcelFiles(dtDir, cacheDir) {
  const out = [];
  const lawn = join(dtDir, 'lawn-trial', 'drcog-turf');
  if (existsSync(lawn)) for (const f of readdirSync(lawn)) if (/^parcels-.+\.json$/.test(f)) out.push(join(lawn, f));
  if (existsSync(cacheDir)) for (const f of readdirSync(cacheDir)) if (/^parcels-.+\.json$/.test(f)) out.push(join(cacheDir, f));
  return out;
}
const loaded = new Map();
/* the outer rings of every parcel in the files that touch box [w, s, e, n], once each (the lawn cache repeats a lot in each cell
   it touches) */
export function parcelsIn(files, box) {
  const seen = new Set(), out = [];
  for (const f of files) {
    if (!loaded.has(f)) {
      const rings = []; let bb = [Infinity, Infinity, -Infinity, -Infinity], src = /parcels-denver\.json$/.test(f) ? 'd' : '';
      for (const cell of Object.values(JSON.parse(readFileSync(f, 'utf8')).cells)) for (const rr of cell) {
        const r = rr[0]; if (!r || r.length < 4) continue; r.src = src;   /* 'd': Denver's own lot lines (credited on the card) */
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
        rings.push({ r, bb: [a, b, c, d], k: r.length + ':' + r[0][0] + ',' + r[0][1] + ':' + r[1][0] });
        bb = [Math.min(bb[0], a), Math.min(bb[1], b), Math.max(bb[2], c), Math.max(bb[3], d)];
      }
      loaded.set(f, { rings, bb });
    }
    const L = loaded.get(f);
    if (L.bb[2] < box[0] || L.bb[0] > box[2] || L.bb[3] < box[1] || L.bb[1] > box[3]) continue;
    for (const p of L.rings) {
      if (p.bb[2] < box[0] || p.bb[0] > box[2] || p.bb[3] < box[1] || p.bb[1] > box[3] || seen.has(p.k)) continue;
      seen.add(p.k); out.push(p.r);
    }
  }
  return out;
}

const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
/* where segment a-b crosses segment c-d: the fraction along a-b, or null */
function cross(a, b, c, d) {
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0;
  if (!den) return null;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/* the town's lot lines in metres (P: lon/lat -> metres), with a grid to find them; home(x, y) says whether a point is a home's
   position (door list or the grey dots), and homesNear(bb) lists those positions in a box, so a lot can be told apart from an HOA
   strip: a lot has a home's point in it */
/* a parcel shaped like a building lot: compact (perimeter squared over area under 30: a square is 16, 1 by 4 is 25; an HOA strip
   or a ditch along a road is far longer) and under 2.5 ha. Between a house and the road it stands for a home or a building our
   lists do not have (an apartment block, a shop, a house in a town we have no list for), so it stops the ray like a home's lot. */
export function lotLike(r) {
  let A = 0, P = 0;
  const [ox, oy] = r[0];
  for (let i = 1; i < r.length; i++) { A += (r[i - 1][0] - ox) * (r[i][1] - oy) - (r[i][0] - ox) * (r[i - 1][1] - oy); P += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); }
  A = Math.abs(A) / 2;
  return A > 0 && A < 25000 && P * P / A < 30;
}
export function lotIndex(rings, P, homesNear) {
  const G = 80, grid = new Map();
  const lots = rings.map((r0) => {
    const r = r0.map(([x, y]) => P(x, y));
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
    return { r, bb: [a, b, c, d], homes: 0, src: r0.src || '' };
  });
  lots.forEach((L, i) => { for (let gx = Math.floor(L.bb[0] / G); gx <= Math.floor(L.bb[2] / G); gx++) for (let gy = Math.floor(L.bb[1] / G); gy <= Math.floor(L.bb[3] / G); gy++) { const k = gx + ',' + gy; let s = grid.get(k); if (!s) grid.set(k, (s = [])); s.push(i); } });
  for (const L of lots) { for (const h of homesNear(L.bb)) if (inRing(h[0], h[1], L.r)) L.homes++; L.blocks = L.homes > 0 || lotLike(L.r); }
  const at = (x, y) => (grid.get(Math.floor(x / G) + ',' + Math.floor(y / G)) || []).map((i) => lots[i]).filter((L) => x >= L.bb[0] && x <= L.bb[2] && y >= L.bb[1] && y <= L.bb[3] && inRing(x, y, L.r));
  /* whether lot lines are on file around a point: within 20 m of some lot's box. The lawn cache holds only the areas its doors were
     in, so past the edge of it a home's lot behind would simply be missing */
  const known = (x, y) => {
    for (let gx = Math.floor((x - 20) / G); gx <= Math.floor((x + 20) / G); gx++) for (let gy = Math.floor((y - 20) / G); gy <= Math.floor((y + 20) / G); gy++)
      for (const i of grid.get(gx + ',' + gy) || []) { const b = lots[i].bb; if (x >= b[0] - 20 && x <= b[2] + 20 && y >= b[1] - 20 && y <= b[3] + 20) return true; }
    return false;
  };
  return { lots, at, known };
}

/* the fact for one house. p: its point (metres); ownLines: the house's own street (lines in metres); roadsAlong(a, b): every road
   segment near the line a-b as [road, c, d]; idx: lotIndex; homesNear(bb): home positions in a box. Returns null, or
   { road, m, rays, lot } (m: metres from the back lot line to the road's centre line, the middle of the rays that reach it) */
export function backRoad(p, own, ownLines, roadsAlong, idx, homesNear) {
  const here = idx.at(p[0], p[1]);
  if (here.length !== 1) return null;                    /* no lot line, or stacked lots (condos) */
  const L = here[0];
  if (L.homes > 1) return null;                          /* a complex: town homes on one parcel have no back lot line of their own */
  const r = L.r;
  /* the lot's middle (area-weighted) and the nearest point of its own street */
  /* from the first corner, not the map origin: with metres in the millions the products lose the centre by tens of metres */
  let A = 0, cx = 0, cy = 0; const [ox, oy] = r[0];
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xj = r[j][0] - ox, yj = r[j][1] - oy, xi = r[i][0] - ox, yi = r[i][1] - oy, f = xj * yi - xi * yj;
    A += f; cx += (xj + xi) * f; cy += (yj + yi) * f;
  }
  if (Math.abs(A) < 1) return null;
  const c = [ox + cx / (3 * A), oy + cy / (3 * A)];
  let q = null, qd = Infinity;
  for (const l of ownLines) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], dx = b[0] - a[0], dy = b[1] - a[1], LL = dx * dx + dy * dy;
    let t = LL ? ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / LL : 0; t = Math.max(0, Math.min(1, t));
    const z = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(z[0] - c[0], z[1] - c[1]); if (d < qd) { qd = d; q = z; }
  }
  if (!q || qd < 3 || qd > 120) return null;
  const v = [(c[0] - q[0]) / qd, (c[1] - q[1]) / qd], w = [-v[1], v[0]];
  let wmin = Infinity, wmax = -Infinity, vmax = -Infinity;
  for (const [x, y] of r) { const s = (x - c[0]) * w[0] + (y - c[1]) * w[1], t = (x - c[0]) * v[0] + (y - c[1]) * v[1]; if (s < wmin) wmin = s; if (s > wmax) wmax = s; if (t > vmax) vmax = t; }
  const reach = vmax + MAX_M + 25;
  const hits = []; let blocked = 0, side = 0;
  for (let k = 0; k < RAYS; k++) {
    const s = wmin + (wmax - wmin) * (0.2 + 0.6 * k / (RAYS - 1));
    const o = [c[0] + w[0] * s, c[1] + w[1] * s], far = [o[0] + v[0] * reach, o[1] + v[1] * reach];
    /* where the ray leaves the lot: the last crossing of the lot line. It counts only through the back of the lot: the piece of lot
       line it crosses faces back (within 60 degrees); a ray that leaves through a side line says nothing about what is behind */
    let te = null, ei = -1;
    for (let i = 1; i < r.length; i++) { const t = cross(o, far, r[i - 1], r[i]); if (t !== null && (te === null || t > te)) { te = t; ei = i; } }
    const dbg = globalThis.BACK_DEBUG;
    if (te === null) { if (dbg) dbg.push([k, 'no exit']); continue; }
    const ex = r[ei][0] - r[ei - 1][0], ey = r[ei][1] - r[ei - 1][1], el = Math.hypot(ex, ey) || 1;
    if (Math.abs(ex * w[0] + ey * w[1]) / el < 0.5) { side++; if (dbg) dbg.push([k, 'side exit']); continue; }   /* |cos| of the line against across-the-lot under 0.5: faces sideways */
    const e = [o[0] + v[0] * te * reach, o[1] + v[1] * te * reach], end = [e[0] + v[0] * (MAX_M + 20), e[1] + v[1] * (MAX_M + 20)];
    /* the first road of the classes (or its own street) the ray crosses beyond the lot line */
    let best = null; const xs = [];
    for (const [rd, a, b] of roadsAlong(e, end)) {
      if (!(rd === own || (rd.n && BACK_CLASSES.has(rd.c)))) continue;
      const t = cross(e, end, a, b); if (t !== null) { xs.push([rd, t]); if (!best || t < best.t) best = { rd, t, a, b }; }
    }
    if (!best) { if (dbg) dbg.push([k, 'no road']); continue; }
    /* TIGER draws some roads twice under two names (McArthur Ranch Rd and Fairview Pkwy): every name crossed within 3 m of the first */
    const names = new Set(xs.filter(([, t]) => (t - best.t) * (MAX_M + 20) <= 3).map(([rd]) => rd.core || rd.n));
    /* the road must run across the back there (40 degrees or more off the front-to-back line), not along the side of the lot */
    const sx = best.b[0] - best.a[0], sy = best.b[1] - best.a[1];
    if (Math.abs(sx * v[0] + sy * v[1]) / (Math.hypot(sx, sy) || 1) > 0.766) { if (dbg) dbg.push([k, 'road along', best.rd.n]); continue; }
    const dist = best.t * (MAX_M + 20);
    /* anything in between: another home's lot, sampled every 1.5 m, or a home's point within 6 m of the ray */
    let stop = false;
    for (let s2 = 0.75; s2 < dist - 0.5 && !stop; s2 += 1.5) {
      const x = e[0] + v[0] * s2, y = e[1] + v[1] * s2;
      for (const M of idx.at(x, y)) if (M !== L && M.blocks) { stop = true; break; }
      /* past the edge of the lot lines on file: cannot tell. Not within 30 m of the road's middle: a highway's or a parkway's own land
         carries no parcel at all */
      if (!stop && idx.known && dist - s2 > 30 && !idx.known(x, y)) stop = true;
    }
    if (!stop) {
      const bb = [Math.min(e[0], e[0] + v[0] * dist) - 6, Math.min(e[1], e[1] + v[1] * dist) - 6, Math.max(e[0], e[0] + v[0] * dist) + 6, Math.max(e[1], e[1] + v[1] * dist) + 6];
      for (const h of homesNear(bb)) {
        const t = (h[0] - e[0]) * v[0] + (h[1] - e[1]) * v[1], u = Math.abs((h[0] - e[0]) * w[0] + (h[1] - e[1]) * w[1]);
        if (t > 0 && t < dist - 2 && u < 6 && !inRing(h[0], h[1], r)) { stop = true; break; }
      }
    }
    if (stop) { blocked++; if (dbg) dbg.push([k, 'blocked', Math.round(dist), best.rd.n]); continue; }
    if (dbg) dbg.push([k, 'hit', best.rd.n, Math.round(dist)]);
    if (best.rd === own || (best.rd.core && best.rd.core === own.core) || names.has(own.core)) continue;
    hits.push({ rd: best.rd, m: dist, names });
  }
  if (blocked > 1) return null;                          /* one ray may clip a neighbour's back corner; two is a home behind */
  /* the road most rays reach */
  const by = new Map(); for (const h of hits) for (const k of h.names) { if (!by.has(k)) by.set(k, []); by.get(k).push(h); }
  let top = null, tk = null; for (const [k, a] of by) if (!top || a.length > top.length) { top = a; tk = k; }
  if (!top || top.length < NEED) return null;
  /* name it by the road (of that name) the rays crossed */
  for (const h of top) if ((h.rd.core || h.rd.n) !== tk) { const o = hits.find((x) => (x.rd.core || x.rd.n) === tk); if (o) h.rd = o.rd; }
  const ms = top.map((h) => h.m).sort((a, b) => a - b), m = ms[Math.floor(ms.length / 2)];
  if (m > MAX_M) return null;
  return { road: top[0].rd, m, rays: top.length, depth: vmax, src: L.src };
}

/* the same test without a lot line: a W x D rectangle around the house point, its front square to the own street, and only the
   homes' points to stop a ray. Kept for the check (BACK_NOLOT=1 in build-lot.mjs): it was not good enough to show (README). */
export function backRoadNoLot(p, own, ownLines, roadsAlong, homesNear, W, D) {
  let q = null, qd = Infinity;
  for (const l of ownLines) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], dx = b[0] - a[0], dy = b[1] - a[1], LL = dx * dx + dy * dy;
    let t = LL ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / LL : 0; t = Math.max(0, Math.min(1, t));
    const z = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(z[0] - p[0], z[1] - p[1]); if (d < qd) { qd = d; q = z; }
  }
  if (!q || qd < 3) return null;
  const v = [(p[0] - q[0]) / qd, (p[1] - q[1]) / qd], w = [-v[1], v[0]], hw = W / 2, hd = D / 2;
  const at = (s, t) => [p[0] + w[0] * s + v[0] * t, p[1] + w[1] * s + v[1] * t];
  const r = [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd), at(-hw, -hd)];
  const L = { r, homes: 1, blocks: false };
  return backRoad(p, own, ownLines, roadsAlong, { at: (x, y) => (inRing(x, y, r) ? [L] : []) }, homesNear);
}

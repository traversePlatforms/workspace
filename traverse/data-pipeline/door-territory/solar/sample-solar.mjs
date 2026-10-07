/* Solar facts for every door, from the USGS 3DEP LiDAR already on this computer (2026-10-06, TraverseSolar).
 *
 * Built on roofs/sample-roofs.mjs (same lot, house outline, height grid and outline slide). For each house:
 *   1. per roof cell, a 3 x 3 least-squares plane through the ELEVATIONS (not height above ground, which carries the
 *      slope of the ground under the house), giving its slope and the way it FACES (downhill, as a compass bearing);
 *   2. the roof split by facing: S, SE, SW, E, W, the north half, and flat or low slope (under 8 degrees). Each part's
 *      area is its share of the measured cells times the footprint, over the cosine of that part's median slope;
 *   3. shade: tree cells (the scan splits its pulses in canopy) at least as tall as the roof, within 20 m of the house
 *      on its sunny side (bearing 110-250 degrees from the house centre). Counted in 1 m cells;
 *   4. the roof's median height above ground and the survey year.
 * An ESTIMATE from a 2018 (El Paso) or 2020 (Douglas) survey. Teller has no LiDAR, so Teller towns get nothing.
 *
 * Writes solar-cache.json here: { "lat,lon": { a: {S,SE,SW,E,W,N,F}, sd, h, shade, yr } | { err } }.
 * Incremental: re-running measures only doors not in the cache.
 *   node sample-solar.mjs [--town=monument] [--conc=4] [--limit=N]
 *   node sample-solar.mjs --build      writes app/data/rounds/solar-<town>.json (with the yield table and utilities) */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRing, inRings, loadBuildings, pickHouse, townParcels } from '../tree-zones/zones.mjs';
import { heightGrid, PROJECT, PROJECT_YEAR, setMemoMax } from '../tree-zones/lidar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..'), TZ = join(DT, 'tree-zones');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const CACHE = join(HERE, 'solar-cache.json');
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas', 'highlands-ranch': 'douglas', parker: 'douglas', 'castle-pines': 'douglas' };
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 4), LIMIT = +arg('limit', 1e9);
const SQFT = 10.7639;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
/* compass bearing (0 = north, clockwise) to a facing part */
const part = (az) => az >= 157.5 && az < 202.5 ? 'S' : az >= 112.5 && az < 157.5 ? 'SE' : az >= 202.5 && az < 247.5 ? 'SW' : az >= 67.5 && az < 112.5 ? 'E' : az >= 247.5 && az < 292.5 ? 'W' : 'N';

export async function measureSolar(lat, lon, house, project) {
  const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;   /* 1 m in Web Mercator units at this latitude */
  const xs = house.m.map((p) => p[0]), ys = house.m.map((p) => p[1]);
  const pad = 6 / k, south = 24 / k;
  const box = [Math.min(...xs) - south, Math.min(...ys) - south, Math.max(...xs) + south, Math.max(...ys) + pad];
  const G = await heightGrid(project, box, cell, join(TZ, 'lidar-cache'));
  if (!G.hgt.some((v) => !Number.isNaN(v))) return { err: 'no LiDAR here' };
  const at = (X, Y) => { const c = Math.floor((X - G.x0) / cell), r = Math.floor((G.y1 - Y) / cell); return c < 0 || r < 0 || c >= G.w || r >= G.h ? -1 : r * G.w + c; };
  const roofLike = (o) => o >= 0 && !Number.isNaN(G.hgt[o]) && G.hgt[o] >= 2.5 && G.multi[o] !== 1;
  const hb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const cellsIn = (ox, oy) => {
    const ring = house.m.map(([x, y]) => [x + ox, y + oy]), out = [];
    for (let X = hb[0] + ox + cell / 2; X < hb[2] + ox; X += cell) for (let Y = hb[1] + oy + cell / 2; Y < hb[3] + oy; Y += cell) if (inRing(X, Y, ring)) out.push(at(X, Y));
    return out;
  };
  /* slide the outline onto the roof, exactly as sample-roofs does */
  let best = [0, 0], bestScore = -Infinity, bestCells = cellsIn(0, 0);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
    const cs = cellsIn(dx * cell, dy * cell); if (!cs.length) continue;
    const sc = cs.filter(roofLike).length / cs.length - Math.hypot(dx, dy) * 0.02;
    if (sc > bestScore) { bestScore = sc; best = [dx, dy]; bestCells = cs; }
  }
  const roofCells = bestCells.filter(roofLike);
  const dataCells = bestCells.filter((o) => o >= 0 && !Number.isNaN(G.hgt[o]));
  if (dataCells.length < Math.max(8, bestCells.length * 0.35)) return { err: 'scan too sparse here' };
  if (roofCells.length / dataCells.length < 0.4) return { err: roofCells.length >= 4 ? 'roof mostly hidden (trees) or outline off' : 'no roof in the scan (house newer than the survey?)' };

  /* per interior roof cell: the plane z = a*x + b*y + c (x east, y south, 1 m), its slope and the way it faces */
  const cnt = { S: 0, SE: 0, SW: 0, E: 0, W: 0, N: 0, F: 0 }, slopesOf = { S: [], SE: [], SW: [], E: [], W: [], N: [], F: [] };
  let measured = 0;
  for (const o of roofCells) {
    const r = Math.floor(o / G.w), c = o % G.w;
    if (r < 1 || c < 1 || r >= G.h - 1 || c >= G.w - 1) continue;
    let N = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const o2 = (r + dr) * G.w + (c + dc); if (!roofLike(o2)) continue;
      const z = G.top[o2]; N++; sx += dc; sy += dr; sz += z; sxx += dc * dc; syy += dr * dr; sxy += dc * dr; sxz += dc * z; syz += dr * z;
    }
    if (N < 7) continue;
    const A = sxx - sx * sx / N, B = sxy - sx * sy / N, C = syy - sy * sy / N, P = sxz - sx * sz / N, Q = syz - sy * sz / N, det = A * C - B * B;
    if (Math.abs(det) < 1e-9) continue;
    const a = (P * C - Q * B) / det, b = (A * Q - B * P) / det;   /* dz/d(east), dz/d(south), metres per metre */
    const deg = Math.atan(Math.hypot(a, b)) * 180 / Math.PI;
    if (deg > 60) continue;                                       /* a wall edge or a chimney, not a roof plane */
    measured++;
    let p;
    if (deg < 8) p = 'F';
    else { const az = (Math.atan2(-a, b) * 180 / Math.PI + 360) % 360; p = part(az); }   /* downhill: east = -a, north = +b */
    cnt[p]++; slopesOf[p].push(deg);
  }
  if (measured < 6) return { err: 'too few roof points' };
  const fpM2 = ringArea(house.m) * k * k;
  const area = {};
  for (const p of Object.keys(cnt)) {
    const m = slopesOf[p].length ? median(slopesOf[p]) : 0;
    area[p] = Math.round(cnt[p] / measured * fpM2 / Math.cos(Math.min(m, 60) * Math.PI / 180) * SQFT / 10) * 10;   /* sq ft, nearest 10 */
  }
  const sun = ['S', 'SE', 'SW', 'E', 'W'].flatMap((p) => slopesOf[p]);
  const roofH = median(roofCells.map((o) => G.hgt[o]));

  /* shade: canopy at least as tall as the roof, within 20 m of the house on its sunny side */
  const cx = (hb[0] + hb[2]) / 2 + best[0] * cell, cy = (hb[1] + hb[3]) / 2 + best[1] * cell;
  const half = Math.max(hb[2] - hb[0], hb[3] - hb[1]) / 2;
  let shade = 0;
  for (let o = 0; o < G.w * G.h; o++) {
    if (G.multi[o] !== 1 || Number.isNaN(G.hgt[o]) || G.hgt[o] < roofH) continue;
    const X = G.x0 + (o % G.w + 0.5) * cell, Y = G.y1 - (Math.floor(o / G.w) + 0.5) * cell;
    const dx = X - cx, dy = Y - cy, dist = Math.hypot(dx, dy) * k;
    if (dist > half * k + 20) continue;
    const brg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    if (brg >= 110 && brg <= 250) shade++;
  }
  return { a: area, sd: sun.length ? Math.round(median(sun)) : null, h: Math.round(roofH * 10) / 10, shade, yr: PROJECT_YEAR[project] || null };
}

async function sample() {
  setMemoMax(500);
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const save = () => { writeFileSync(CACHE + '.tmp', JSON.stringify(cache)); renameSync(CACHE + '.tmp', CACHE); };
  const started = Date.now(); let done = 0;
  for (const [town, county] of Object.entries(TOWNS)) {
    if (ONLY && town !== ONLY) continue;
    const p = join(DT, `${town}-areas.json`);
    if (!existsSync(p)) continue;
    const all = JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number');
    const todo = all.filter((d) => !cache[`${d.la},${d.lo}`]).slice(0, LIMIT);
    if (!todo.length) { console.log(`${town}: all ${all.length} measured`); continue; }
    const lats = todo.map((d) => d.la), lons = todo.map((d) => d.lo);
    const bbox = [Math.min(...lons) - 0.003, Math.min(...lats) - 0.003, Math.max(...lons) + 0.003, Math.max(...lats) + 0.003];
    const parcels = await townParcels(bbox);
    const blds = await loadBuildings(join(TZ, 'buildings'), bbox);
    const cell = 0.004, key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    const pgrid = new Map(), bgrid = new Map();
    for (const pc of parcels) for (let gx = Math.floor(pc.bb[0] / cell); gx <= Math.floor(pc.bb[2] / cell); gx++) for (let gy = Math.floor(pc.bb[1] / cell); gy <= Math.floor(pc.bb[3] / cell); gy++) {
      const kk = `${gx},${gy}`; if (!pgrid.has(kk)) pgrid.set(kk, []); pgrid.get(kk).push(pc);
    }
    for (const b of blds) { const kk = key(b.c[0], b.c[1]); if (!bgrid.has(kk)) bgrid.set(kk, []); bgrid.get(kk).push(b); }
    const near = (x, y) => { const out = []; const gx = Math.floor(x / cell), gy = Math.floor(y / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...(bgrid.get(`${gx + a},${gy + b}`) || [])); return out; };
    console.log(`${town}: ${todo.length} doors to measure, ${parcels.length} lots, ${blds.length} building outlines, ${PROJECT[county]}`);
    let i = 0, errs = 0;
    async function worker() {
      for (;;) {
        const d = todo[i++]; if (!d) return;
        const kk = `${d.la},${d.lo}`;
        try {
          const pc = (pgrid.get(key(d.lo, d.la)) || []).find((c) => d.lo >= c.bb[0] && d.lo <= c.bb[2] && d.la >= c.bb[1] && d.la <= c.bb[3] && inRings(d.lo, d.la, c.rings));
          if (!pc) cache[kk] = { err: 'no parcel at the point' };
          else {
            const house = pickHouse(pc.rings, near(d.lo, d.la));
            cache[kk] = house ? await measureSolar(d.la, d.lo, house, PROJECT[county]) : { err: 'no house outline' };
          }
        } catch (e) { errs++; if (errs <= 5) console.log('   ', d.a, e.message.slice(0, 120)); continue; }
        done++;
        if (done % 200 === 0) { save(); const rate = done / ((Date.now() - started) / 1000); console.log(`   ${done} measured · ${rate.toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    save();
    console.log(`${town}: done (${errs} failed, will retry on the next run)`);
  }
  console.log(`measured ${done} doors in ${((Date.now() - started) / 60000).toFixed(1)} min -> solar-cache.json`);
}

if (process.argv.includes('--build')) { const { build } = await import('./build-solar.mjs'); await build(CACHE, TOWNS, DATA); }
else await sample();

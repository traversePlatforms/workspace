/* Roof size and pitch for every door, from the USGS 3DEP LiDAR already used for trees (2026-10-04, overnight job).
 *
 * Matthew is weighing a roofing version. For each door in El Paso (2018 survey) and Douglas (2020 survey):
 *   1. the lot (state parcel layer) and the house (largest Microsoft building outline on it), as sample-trees does;
 *   2. a 1 m height-above-ground grid around it (tree-zones/lidar.mjs heightGrid, from the tiles already on disk);
 *   3. the outline slid up to 3 m onto where the roof really is (outlines traced from photos are often off);
 *   4. roof cells: 2.5 m or more above ground with single returns (canopy splits pulses, a roof does not);
 *   5. pitch: per roof cell, a plane fitted to it and the roof cells around it (at least 7 of the 9; the El Paso
 *      2018 scan leaves holes, so all 8 neighbours were too strict: 2026-10-04 overnight). Ridges and valleys read
 *      near zero, so the median is over cells sloped 3-60 degrees. Under 10 degrees, or mostly under 5, is "flat or
 *      low slope": against Douglas County's roof shapes, that cut calls 0.3% of gable and hip roofs flat;
 *   6. roof area = footprint / cos(pitch). Squares = area / 100 (how roofers order).
 * The footprint is the outline, so eaves beyond the walls are only counted where the outline includes them.
 * An ESTIMATE from a 2018/2020 survey: a house built or re-roofed since may differ.
 *
 * Writes roof-cache.json here: { "lat,lon": { fp, sq, sqs, deg, pitch, flat, h, cells, yr } | { err } }.
 * Incremental: re-running measures only doors not in the cache.
 *   node sample-roofs.mjs [--town=monument] [--conc=4] [--limit=N]
 *   node sample-roofs.mjs --build      writes app/data/rounds/roof-<town>.json { doors: { id: {...} } }   */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRing, inRings, merc, loadBuildings, pickHouse, townParcels } from '../tree-zones/zones.mjs';
import { heightGrid, PROJECT, PROJECT_YEAR, setMemoMax } from '../tree-zones/lidar.mjs';
import proj4 from '../tree-zones/node_modules/proj4/dist/proj4-src.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..'), TZ = join(DT, 'tree-zones');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const CACHE = join(HERE, 'roof-cache.json');
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas', 'highlands-ranch': 'douglas', parker: 'douglas', 'castle-pines': 'douglas', 'cs-northeast': 'elpaso', 'cs-southeast': 'elpaso', 'security-widefield': 'elpaso', 'fountain': 'elpaso' };
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null), CONC = +arg('conc', 4), LIMIT = +arg('limit', 1e9);
const SQFT = 10.7639;

function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
/* rise per 12 in run, to the nearest whole number, the way roofers say it */
const pitchOf = (deg) => Math.round(Math.tan(deg * Math.PI / 180) * 12);

export async function measureRoof(lat, lon, house, project) {
  const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;   /* 1 m in Web Mercator units at this latitude */
  const xs = house.m.map((p) => p[0]), ys = house.m.map((p) => p[1]);
  const pad = 6 / k, box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
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
  /* slide the outline onto the roof: most roof-like cells, small penalty for distance */
  let best = [0, 0], bestScore = -Infinity, bestCells = cellsIn(0, 0);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
    const cs = cellsIn(dx * cell, dy * cell); if (!cs.length) continue;
    const sc = cs.filter(roofLike).length / cs.length - Math.hypot(dx, dy) * 0.02;
    if (sc > bestScore) { bestScore = sc; best = [dx, dy]; bestCells = cs; }
  }
  const roofCells = bestCells.filter(roofLike);
  /* judge on the cells the scan reached: a sparse survey leaves empty cells that are neither roof nor ground */
  const dataCells = bestCells.filter((o) => o >= 0 && !Number.isNaN(G.hgt[o]));
  if (dataCells.length < Math.max(8, bestCells.length * 0.35)) return { err: 'scan too sparse here' };
  if (roofCells.length / dataCells.length < 0.4) return { err: roofCells.length >= 4 ? 'roof mostly hidden (trees) or outline off' : 'no roof in the scan (house newer than the survey?)' };
  /* slope per interior roof cell: all 8 neighbours roof-like; Sobel-style gradient over 1 m spacing */
  const slopes = [];
  for (const o of roofCells) {
    const r = Math.floor(o / G.w), c = o % G.w;
    if (r < 1 || c < 1 || r >= G.h - 1 || c >= G.w - 1) continue;
    const n = (dr, dc) => (r + dr) * G.w + (c + dc);
    /* least-squares plane z = a*x + b*y + c through the roof cells of the 3 x 3 window (x east, y south, 1 m) */
    let N = 0, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const o2 = n(dr, dc); if (!roofLike(o2)) continue;
      const z = G.hgt[o2]; N++; sx += dc; sy += dr; sz += z; sxx += dc * dc; syy += dr * dr; sxy += dc * dr; sxz += dc * z; syz += dr * z;
    }
    if (N < 7) continue;
    const A = sxx - sx * sx / N, B = sxy - sx * sy / N, C = syy - sy * sy / N, P = sxz - sx * sz / N, Q = syz - sy * sz / N, det = A * C - B * B;
    if (Math.abs(det) < 1e-9) continue;
    const a = (P * C - Q * B) / det, b = (A * Q - B * P) / det;   /* metres per metre */
    slopes.push(Math.atan(Math.hypot(a, b)) * 180 / Math.PI);
  }
  if (slopes.length < 6) return { err: 'too few roof points for a pitch' };
  const lowShare = slopes.filter((s) => s < 5).length / slopes.length;
  const sloped0 = slopes.filter((s) => s >= 3 && s <= 60), deg0 = median(sloped0.length >= 4 ? sloped0 : slopes);
  const flat = lowShare >= 0.6 || deg0 < 10;
  /* ridges and valleys read near zero; on a sloped roof, take the median of the sloped cells.
     Over 60 degrees is a wall edge or a chimney, not a roof plane. */
  const sloped = slopes.filter((s) => s >= 3 && s <= 60);
  const deg = flat ? Math.max(0, median(slopes)) : median(sloped.length >= 4 ? sloped : slopes);
  const fpM2 = ringArea(house.m) * k * k;
  const roofM2 = fpM2 / Math.cos(Math.min(deg, 60) * Math.PI / 180);
  return {
    fp: Math.round(fpM2 * SQFT),                    /* footprint, sq ft */
    sq: Math.round(roofM2 * SQFT / 10) * 10,        /* roof surface, sq ft, to the nearest 10 */
    sqs: Math.round(roofM2 * SQFT / 100 * 10) / 10, /* roofing squares (100 sq ft) */
    deg: Math.round(deg * 10) / 10, pitch: flat ? 0 : pitchOf(deg), flat,
    h: Math.round(median(roofCells.map((o) => G.hgt[o])) * 10) / 10,   /* roof height above ground, m (median) */
    cells: slopes.length, yr: PROJECT_YEAR[project] || null,
    /* the house's centre (outline slid onto the roof) and its longest side, so the roof photo is framed on the house, not the lot */
    c: (() => { const hx = (hb[0] + hb[2]) / 2 + best[0] * cell, hy = (hb[1] + hb[3]) / 2 + best[1] * cell; const [lo, la] = proj4('EPSG:3857', 'EPSG:4326', [hx, hy]); return [+la.toFixed(6), +lo.toFixed(6)]; })(),
    ext: Math.round(Math.max(hb[2] - hb[0], hb[3] - hb[1]) * k),
  };
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
    const REDO = process.argv.includes('--redo');   /* measure again even if cached (e.g. after adding a field) */
    const todo = all.filter((d) => REDO || !cache[`${d.la},${d.lo}`]).slice(0, LIMIT);
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
            cache[kk] = house ? await measureRoof(d.la, d.lo, house, PROJECT[county]) : { err: 'no house outline' };
          }
        } catch (e) { errs++; if (errs <= 5) console.log('   ', d.a, e.message.slice(0, 120)); continue; }   /* not cached: retried next run */
        done++;
        if (done % 200 === 0) { save(); const rate = done / ((Date.now() - started) / 1000); console.log(`   ${done} measured · ${rate.toFixed(2)}/s · ${town} ${i}/${todo.length}`); }
      }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    save();
    console.log(`${town}: done (${errs} failed, will retry on the next run)`);
  }
  console.log(`measured ${done} doors in ${((Date.now() - started) / 60000).toFixed(1)} min -> roof-cache.json`);
}

/* the per-town files the app reads, keyed by door id (admins only, like hail) */
function build() {
  const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
  const slug = (a) => String(a).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let tot = 0, ok = 0;
  for (const town of Object.keys(TOWNS)) {
    const f = join(DATA, `${town}.json`); if (!existsSync(f)) continue;
    const d = JSON.parse(readFileSync(f, 'utf8')), doors = {}, houses = {};
    for (const a of d.areas) for (const x of a.doors) {
      tot++;
      const r = cache[`${x.lat},${x.lon}`];
      if (r && !r.err) { doors[x.id] = { sq: r.sq, sqs: r.sqs, pitch: r.pitch, deg: r.deg, flat: r.flat, fp: r.fp, h: r.h, yr: r.yr }; ok++; }
      if (r && r.c) houses[x.id] = { c: r.c, ext: r.ext };
    }
    writeFileSync(join(DATA, `roof-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), doors }));
    writeFileSync(join(HERE, `houses-${town}.json`), JSON.stringify(houses));   /* for photo-index.mjs build: frame the photo on the house */
    console.log(`  roof-${town}.json: ${Object.keys(doors).length} doors`);
  }
  console.log(`${ok} of ${tot} doors have a roof measurement`);
}

if (process.argv.includes('--build')) build(); else await sample();

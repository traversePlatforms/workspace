/* Step 1 of the roof-material classifier: where the house is, for every door in all eleven towns.
 *
 * The door's lat/lon is the parcel's point, which on a big rural lot can sit out in a field. The roof photo has
 * to be framed on the house, so per door:
 *   1. the lot: Colorado statewide public parcels (the same layer tree-zones uses), fetched per town;
 *   2. the house: the largest Microsoft building outline whose centre is inside the lot (tree-zones/buildings,
 *      already on disk), or, with no lot or nothing on it, the largest outline within 40 m of the point;
 *   3. for the Douglas and El Paso towns that sample-roofs.mjs measured, the LiDAR-slid centre from
 *      roofs/houses-<town>.json is preferred (the outline is moved onto it: outlines traced from photos sit
 *      a metre or three off the roof).
 * Writes cache/houses-<town>.json: { id: { c: [lat, lon], ext: m, ring: [[lat, lon], ...], how } }
 *   how: 'lot' (outline inside the lot), 'near' (nearest large outline), 'none' (no outline; parcel point used)
 * Only id, lat and lon are read from the door files. Nothing else from them is copied anywhere.
 *   node houses.mjs [--town=castle-rock]                                                                  */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRings, loadBuildings, pickHouse, townParcels, merc } from '../../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..', '..'), TZ = join(DT, 'tree-zones');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const CACHE = join(HERE, 'cache');
mkdirSync(CACHE, { recursive: true });
const TOWNS = ['castle-rock', 'franktown', 'sedalia', 'larkspur', 'black-forest', 'monument', 'palmer-lake', 'woodland-park', 'divide', 'florissant', 'cripple-creek'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const ONLY = arg('town', null);

function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
const bboxOf = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];

for (const town of TOWNS) {
  if (ONLY && town !== ONLY) continue;
  const out = join(CACHE, `houses-${town}.json`);
  if (existsSync(out)) { console.log(`${town}: have it`); continue; }
  const doors = JSON.parse(readFileSync(join(DATA, `${town}.json`), 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.lat === 'number').map((d) => ({ id: d.id, lat: d.lat, lon: d.lon }));
  const lidar = existsSync(join(HERE, '..', `houses-${town}.json`)) ? JSON.parse(readFileSync(join(HERE, '..', `houses-${town}.json`), 'utf8')) : {};
  const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon);
  const bbox = [Math.min(...lons) - 0.003, Math.min(...lats) - 0.003, Math.max(...lons) + 0.003, Math.max(...lats) + 0.003];
  const t0 = Date.now();
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(join(TZ, 'buildings'), bbox);
  console.log(`${town}: ${doors.length} doors, ${parcels.length} lots, ${blds.length} outlines, ${Object.keys(lidar).length} LiDAR centres (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const cell = 0.004, key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const pgrid = new Map(), bgrid = new Map();
  for (const pc of parcels) for (let gx = Math.floor(pc.bb[0] / cell); gx <= Math.floor(pc.bb[2] / cell); gx++) for (let gy = Math.floor(pc.bb[1] / cell); gy <= Math.floor(pc.bb[3] / cell); gy++) {
    const kk = `${gx},${gy}`; if (!pgrid.has(kk)) pgrid.set(kk, []); pgrid.get(kk).push(pc);
  }
  for (const b of blds) { const kk = key(b.c[0], b.c[1]); if (!bgrid.has(kk)) bgrid.set(kk, []); bgrid.get(kk).push(b); }
  const near = (x, y) => { const o = []; const gx = Math.floor(x / cell), gy = Math.floor(y / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) o.push(...(bgrid.get(`${gx + a},${gy + b}`) || [])); return o; };
  const res = {}, n = { lot: 0, near: 0, none: 0, slid: 0 };
  for (const d of doors) {
    const k = Math.cos(d.lat * Math.PI / 180);
    const pc = (pgrid.get(key(d.lon, d.lat)) || []).find((c) => d.lon >= c.bb[0] && d.lon <= c.bb[2] && d.lat >= c.bb[1] && d.lat <= c.bb[3] && inRings(d.lon, d.lat, c.rings));
    const cands = near(d.lon, d.lat);
    let house = pc ? pickHouse(pc.rings, cands) : null, how = house ? 'lot' : 'none';
    if (!house) {
      /* nothing on the lot (or no lot): the largest outline within 40 m, at least 60 m2 */
      const [px, py] = merc(d.lon, d.lat); let bestA = 60;
      for (const b of cands) {
        const [bx, by] = merc(b.c[0], b.c[1]);
        if (Math.hypot(bx - px, by - py) * k > 40) continue;
        const m = b.ring.map(([lo, la]) => merc(lo, la)), a = ringArea(m) * k * k;
        if (a > bestA) { bestA = a; house = { ...b, m }; how = 'near'; }
      }
    }
    if (!house) { res[d.id] = { c: [d.lat, d.lon], ext: 20, ring: null, how: 'none' }; n.none++; continue; }
    const bb = bboxOf(house.ring);
    let c = [(bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2], ring = house.ring;
    const L = lidar[d.id];
    if (L && L.c) {   /* slide the outline onto the LiDAR roof centre */
      const dLat = L.c[0] - c[0], dLon = L.c[1] - c[1];
      ring = ring.map(([lo, la]) => [lo + dLon, la + dLat]); c = L.c; n.slid++;
    }
    const mb = bboxOf(house.m);
    res[d.id] = { c: [+c[0].toFixed(6), +c[1].toFixed(6)], ext: Math.round(Math.max(mb[2] - mb[0], mb[3] - mb[1]) * k), ring: ring.map(([lo, la]) => [+la.toFixed(6), +lo.toFixed(6)]), how };
    n[how]++;
  }
  writeFileSync(out, JSON.stringify(res));
  console.log(`  ${town}: lot ${n.lot}, near ${n.near}, none ${n.none}, slid onto LiDAR ${n.slid}`);
}

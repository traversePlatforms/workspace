/* The building's outline on the roof photo (Matthew 2026-10-06: "some of the images have multiple roofs in a picture, mostly
 * commercial"). For every door with a roof photo, the building it belongs to, as a line to draw over the picture.
 *
 *   node outline-photos.mjs        -> app/data/rounds/outline-<town>.json  { doors: { id: { p: [[u, v], ...], n: [[u, v], ...] } } }
 *
 * p is drawn on the 3-inch state photo (photo-<town>.json: file, pixel x, pixel y, half-window), n on the 2023 USDA close-up
 * (naip-<town>.json: item and its lon/lat box). u, v run 0 to 1000 across and down the picture as the page draws it.
 * The building: Microsoft's outlines (the same set the tree and roof builds use; ../tree-zones/buildings, run
 * fetch-buildings.mjs once). The one under the house's centre (houses-<town>.json, the outline slid onto the laser-scan roof)
 * or the door's point, else the nearest within 25 m. Outlines traced from photos can be off by a few feet; the page says so. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from '../tree-zones/node_modules/proj4/dist/proj4-src.js';
import { loadBuildings, inRing } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const BLD = join(HERE, '..', 'tree-zones', 'buildings');
proj4.defs('EPSG:6342', '+proj=utm +zone=13 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
const toUtm = proj4('EPSG:4326', 'EPSG:6342');
const files = JSON.parse(readFileSync(join(HERE, 'photo-index.json'), 'utf8'));   /* file -> [xmin, ymin, xmax, ymax, res, w, h, block] */
const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
const sideDoors = (j) => (j ? j.doors || j : {});
const M_LAT = 111320;

const idx = read(join(DATA, 'index.json'));
/* and Roofing's commercial test towns, which are not in the shared index (build-editions.cjs adds them to Roofing only) */
const com = read(join(HERE, '..', '..', '..', 'editions', 'roofing-commercial-towns.json'));
const regions = (idx.regions || idx).concat(com ? com.regions : []);
let total = 0, drawn = 0;
for (const r of regions) {
  const key = r.key || r, town = read(join(DATA, key + '.json'));
  if (!town) continue;
  const photo = sideDoors(read(join(DATA, `photo-${key}.json`))), naip = sideDoors(read(join(DATA, `naip-${key}.json`)));
  const houses = read(join(HERE, `houses-${key}.json`)) || {};
  const doors = []; let s = 90, n = -90, w = 180, e = -180;
  for (const a of town.areas) for (const d of a.doors) {
    if (!d.lat || !(photo[d.id] || naip[d.id])) continue;
    doors.push(d); s = Math.min(s, d.lat); n = Math.max(n, d.lat); w = Math.min(w, d.lon); e = Math.max(e, d.lon);
  }
  if (!doors.length) continue;
  const blds = await loadBuildings(BLD, [w - 0.002, s - 0.002, e + 0.002, n + 0.002]);
  /* a ~110 m grid of building centres for the lookups */
  const G = 0.001, grid = new Map(), cell = (lo, la) => Math.floor(lo / G) + ',' + Math.floor(la / G);
  for (const b of blds) { const k = cell(b.c[0], b.c[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); }
  const near = (lo, la) => { const out = [], cx = Math.floor(lo / G), cy = Math.floor(la / G); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get((cx + i) + ',' + (cy + j)) || [])); return out; };
  const out = {};
  for (const d of doors) {
    total++;
    const h = houses[d.id], la = h && h.c ? h.c[0] : d.lat, lo = h && h.c ? h.c[1] : d.lon;
    const cand = near(lo, la);
    let b = cand.find((x) => lo >= x.bb[0] && lo <= x.bb[2] && la >= x.bb[1] && la <= x.bb[3] && inRing(lo, la, x.ring));
    const dist = (x) => Math.hypot((x.c[1] - la) * M_LAT, (x.c[0] - lo) * M_LAT * Math.cos(la * Math.PI / 180));
    if (!b) { let best = 25; for (const x of cand) { const dm = dist(x); if (dm < best) { best = dm; b = x; } } }
    /* a big lot: its centre point can be far from the house. The largest building within reach of the lot's size (as the
       tree build picks the house: the largest outline on the lot), only when nothing sits at the point itself */
    if (!b && d.acres > 0.5) {
      const reach = Math.min(120, Math.sqrt(d.acres * 4046.86) * 0.6); let bestA = 0;
      for (const x of cand) { if (dist(x) > reach) continue; const a = (x.bb[2] - x.bb[0]) * (x.bb[3] - x.bb[1]); if (a > bestA) { bestA = a; b = x; } }
    }
    if (!b) continue;
    const o = {}, ring = b.ring.slice(0, b.ring.length > 1 && b.ring[0][0] === b.ring[b.ring.length - 1][0] && b.ring[0][1] === b.ring[b.ring.length - 1][1] ? -1 : undefined);
    const tidy = (pts) => { const q = []; for (const p of pts) { const last = q[q.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) q.push(p); } return q.length >= 3 && q.some((p) => p[0] >= 0 && p[0] <= 1000 && p[1] >= 0 && p[1] <= 1000) && q.every((p) => Math.abs(p[0]) < 5000 && Math.abs(p[1]) < 5000) ? q : null; };   /* at least one corner in the picture; a big roof may run off its edge (the picture crops the line) */
    const ph = photo[d.id];
    if (ph && files[ph[0]]) {
      const fb = files[ph[0]], half = ph[3] || 200;
      o.p = tidy(ring.map(([x, y]) => { const [E, N] = toUtm.forward([x, y]); const X = (E - fb[0]) / fb[4], Y = (fb[3] - N) / fb[4]; return [Math.round((X - (ph[1] - half)) / (2 * half) * 1000), Math.round((Y - (ph[2] - half)) / (2 * half) * 1000)]; }));
    }
    const nb = naip[d.id];
    if (nb) o.n = tidy(ring.map(([x, y]) => [Math.round((x - nb[1]) / (nb[3] - nb[1]) * 1000), Math.round((nb[4] - y) / (nb[4] - nb[2]) * 1000)]));
    if (!o.p) delete o.p; if (!o.n) delete o.n;
    if (o.p || o.n) { out[d.id] = o; drawn++; }
  }
  writeFileSync(join(DATA, `outline-${key}.json`), JSON.stringify({ source: 'Microsoft Global ML Building Footprints (ODbL)', doors: out }));
  console.log(`  outline-${key}.json: ${Object.keys(out).length} of ${doors.length} doors with a photo`);
}
console.log(`${drawn} of ${total} doors with a photo have an outline`);

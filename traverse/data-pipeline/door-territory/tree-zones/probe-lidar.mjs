/* Probe: LiDAR vs the canopy map on chosen lots, with a picture of the LiDAR reading.
   Usage:  node probe-lidar.mjs palmer-lake:"3840 SIERRA VISTA RD" monument:"17890 SIERRA WAY" ...
   Project is chosen by county: El Paso towns -> CO_Eastern_ElPaso_2018, Douglas -> CO_DRCOG_2_2020. */
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARCELS, json, inRing, merc, loadBuildings, pickHouse, measure } from './zones.mjs';
import { measureLidar, PROJECT } from './lidar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const COUNTY = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas' };
for (const spec of process.argv.slice(2)) {
  const [town, addr] = spec.split(':');
  const r = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'site', 'data', 'rounds', `${town}.json`), 'utf8'));
  const d = r.areas.flatMap((a) => a.doors).find((x) => x.address === addr);
  if (!d) { console.log('not found', spec); continue; }
  const pq = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const lot = pq.features[0].geometry.rings;
  const blds = await loadBuildings(join(HERE, 'buildings'), [d.lon - 0.003, d.lat - 0.003, d.lon + 0.003, d.lat + 0.003]);
  const house = pickHouse(lot, blds);
  if (!house) { console.log(addr, 'no house outline'); continue; }
  const others = blds.filter((b) => b !== house && b.ring !== house.ring && b.c && lot.some((ring) => inRing(b.c[0], b.c[1], ring))).map((b) => ({ m: b.ring.map(([lo, la]) => merc(lo, la)) }));
  const cm = await measure(d.lat, d.lon, lot, house);
  const t0 = Date.now();
  const L = await measureLidar(d.lat, d.lon, lot, house, others, PROJECT[COUNTY[town]], join(HERE, 'lidar-cache'), true);
  console.log(`${addr.padEnd(24)} canopy map z1 ${cm.z1} z2 ${cm.z2} z3 ${cm.z3} | LiDAR z1 ${L.z1} z2 ${L.z2} z3 ${L.z3}  tallest ${L.h} m  shift ${L.shift} m  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  const { G, H, zoneOf, treeOf } = L, S = 6, png = new PNG({ width: G.w * S, height: G.h * S });
  for (let rr = 0; rr < G.h; rr++) for (let c = 0; c < G.w; c++) {
    const o = rr * G.w + c, X = G.x0 + (c + 0.5) * G.cell, Y = G.y1 - (rr + 0.5) * G.cell, v = G.hgt[o];
    let rgb = Number.isNaN(v) ? [30, 30, 30] : [Math.min(255, 50 + v * 9), Math.min(255, 70 + v * 9), Math.min(255, 50 + v * 6)];
    if (!zoneOf[o]) rgb = rgb.map((x) => Math.round(x * 0.55));
    if (treeOf[o]) rgb = zoneOf[o] === 1 ? [230, 30, 30] : zoneOf[o] === 2 ? [255, 140, 0] : [240, 220, 60];
    if (inRing(X, Y, H)) rgb = [235, 235, 235];
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const p = ((rr * S + a) * png.width + c * S + b) * 4; png.data[p] = rgb[0]; png.data[p + 1] = rgb[1]; png.data[p + 2] = rgb[2]; png.data[p + 3] = 255; }
  }
  writeFileSync(join(HERE, `lidar-${town}-${addr.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`), PNG.sync.write(png));
}

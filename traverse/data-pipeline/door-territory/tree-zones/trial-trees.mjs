/* Trial: measure trees-near-the-house on a known set of doors and draw each one, so the
   numbers can be checked against the photo before the full run. Usage:
     node trial-trees.mjs            the 40 lawn-trial doors + Brandon's lot
   Writes <town>-<address>.png here (gitignored) and trial.json. */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARCELS, ZONES, TALL, json, inRing, inRings, ringDist, merc, chm, loadBuildings, pickHouse, measure } from './zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);

const trial = JSON.parse(readFileSync(join(HERE, '..', 'lawn-trial', 'results.json'), 'utf8'));
const want = trial.map((t) => ({ town: t.town, address: t.address }));
want.push({ town: 'monument', address: '17890 SIERRA WAY' });
const doors = [];
for (const w of want) {
  const r = JSON.parse(readFileSync(join(DATA, `${w.town}.json`), 'utf8'));
  const d = r.areas.flatMap((a) => a.doors).find((x) => x.address === w.address);
  if (d) doors.push({ ...w, d }); else console.log('not found', w.town, w.address);
}
const bb = [Math.min(...doors.map((x) => x.d.lon)), Math.min(...doors.map((x) => x.d.lat)), Math.max(...doors.map((x) => x.d.lon)), Math.max(...doors.map((x) => x.d.lat))];
console.log('loading building outlines…');
const buildings = await loadBuildings(join(HERE, 'buildings'), bb);
console.log(buildings.length, 'outlines in the trial box');

export function level(m) {
  if (m.err) return null;
  if ((m.z1 ?? 0) >= 0.15) return 'against';
  if ((m.z2 ?? 0) >= 0.35) return 'heavy';
  if ((m.z2 ?? 0) >= 0.10) return 'some';
  return 'clear';
}

const token = (await json('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const out = [];
for (const { town, address, d } of doors) {
  const pq = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const lot = pq.features && pq.features[0] && pq.features[0].geometry.rings;
  if (!lot) { console.log(address, 'no parcel'); continue; }
  const near = buildings.filter((b) => b.c[0] > d.lon - 0.01 && b.c[0] < d.lon + 0.01 && b.c[1] > d.lat - 0.01 && b.c[1] < d.lat + 0.01);
  const house = pickHouse(lot, near);
  if (!house) { console.log(address, 'no house outline'); out.push({ town, address, err: 'no house outline' }); continue; }
  const m = await measure(d.lat, d.lon, lot, house);
  const lv = level(m);
  out.push({ town, address, acres: d.acres, fire: d.fire, ...m, level: lv });
  console.log(`${address.padEnd(26)} z1 ${m.z1} z2 ${m.z2} z3 ${m.z3}  house ${m.hs} sq ft  tallest ${m.h} m  -> ${lv}`);

  /* the picture: 2023 photo, lot line, house, zone rings, counted trees tinted by zone */
  const stac = await json('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
  const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
  const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
  const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
  const toPx = ([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; };
  const lotPx = lot.map((r) => r.map(toPx)), housePx = house.ring.map(toPx);
  const hx = housePx.map((p) => p[0]), hy = housePx.map((p) => p[1]), padPx = Math.ceil(ZONES.z3 / res[0]) + 12;
  const x0 = Math.floor(Math.min(...hx)) - padPx, y0 = Math.floor(Math.min(...hy)) - padPx, x1 = Math.ceil(Math.max(...hx)) + padPx, y1 = Math.ceil(Math.max(...hy)) + padPx;
  const [R, G, B] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
  const w = x1 - x0, h = y1 - y0, S = 3, png = new PNG({ width: w * S, height: h * S + 64 });
  const k = Math.cos(d.lat * Math.PI / 180), lotM = lot.map((r) => r.map(([lo, la]) => merc(lo, la)));
  const ch = await chm(d.lon, d.lat);
  const hb = [Math.min(...house.m.map((p) => p[0])), Math.min(...house.m.map((p) => p[1])), Math.max(...house.m.map((p) => p[0])), Math.max(...house.m.map((p) => p[1]))];
  const pad = ZONES.z3 / k + 5;
  const cc0 = Math.max(0, Math.floor((hb[0] - pad - ch.origin[0]) / ch.res[0])), cc1 = Math.ceil((hb[2] + pad - ch.origin[0]) / ch.res[0]);
  const cr0 = Math.max(0, Math.floor((hb[3] + pad - ch.origin[1]) / ch.res[1])), cr1 = Math.ceil((hb[1] - pad - ch.origin[1]) / ch.res[1]);
  const HT = (await ch.im.readRasters({ window: [cc0, cr0, cc1, cr1] }))[0], cw = cc1 - cc0;
  const tint = { z1: [230, 30, 30], z2: [255, 140, 0], z3: [255, 230, 80] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let rgb = [R[i], G[i], B[i]];
    const [lon, lat] = proj4(epsg, 'EPSG:4326', [origin[0] + (x0 + x + 0.5) * res[0], origin[1] + (y0 + y + 0.5) * res[1]]);
    const [X, Y] = merc(lon, lat);
    if (!inRing(X, Y, house.m) && inRings(X, Y, lotM)) {
      const dm = ringDist(X, Y, house.m) * k;
      const z = dm <= ZONES.z1 ? 'z1' : dm <= ZONES.z2 ? 'z2' : dm <= ZONES.z3 ? 'z3' : null;
      if (z) {
        const c = Math.floor((X - ch.origin[0]) / ch.res[0]) - cc0, r = Math.floor((Y - ch.origin[1]) / ch.res[1]) - cr0;
        const ht = c >= 0 && r >= 0 && c < cw ? HT[r * cw + c] : 0;
        if (ht >= TALL) rgb = rgb.map((v, j) => Math.round(v * 0.45 + tint[z][j] * 0.55));
      }
    }
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const o = ((y * S + a) * png.width + (x * S + b)) * 4; png.data[o] = rgb[0]; png.data[o + 1] = rgb[1]; png.data[o + 2] = rgb[2]; png.data[o + 3] = 255; }
  }
  for (let o = w * S * h * S * 4; o < png.data.length; o += 4) { png.data[o] = png.data[o + 1] = png.data[o + 2] = 255; png.data[o + 3] = 255; }
  const dot = (x, y, c, r) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const X = Math.round(x) + a, Y = Math.round(y) + b; if (X < 0 || Y < 0 || X >= png.width || Y >= h * S) continue; const o = (Y * png.width + X) * 4; png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; } };
  const line = (p, q, c, r) => { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1])); for (let t = 0; t <= n; t++) dot(p[0] + (q[0] - p[0]) * t / n, p[1] + (q[1] - p[1]) * t / n, c, r); };
  const draw = (ring, c, r) => { for (let i = 0; i < ring.length - 1; i++) line([(ring[i][0] - x0) * S, (ring[i][1] - y0) * S], [(ring[i + 1][0] - x0) * S, (ring[i + 1][1] - y0) * S], c, r); };
  for (const r of lotPx) { draw(r, [0, 0, 0], 3); draw(r, [255, 230, 0], 1); }
  draw(housePx, [0, 0, 0], 3); draw(housePx, [255, 255, 255], 1);
  writeFileSync(join(HERE, `${town}-${address.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`), PNG.sync.write(png));
}
writeFileSync(join(HERE, 'trial.json'), JSON.stringify(out, null, 1));
const tally = {}; for (const o of out) tally[o.level || o.err] = (tally[o.level || o.err] || 0) + 1;
console.log(tally);

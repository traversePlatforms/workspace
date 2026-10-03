/* Side by side for one spot: the 2023 aerial photo (left) and the LiDAR heights (right), same
   square, with the lot line (yellow) and the building outline (white) on both.
   Usage: node view-compare.mjs <lat> <lon> [project] [metres]  -> view-compare.png (gitignored) */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARCELS, json, merc, loadBuildings, pickHouse } from './zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const [lat, lon] = [+process.argv[2], +process.argv[3]], P = process.argv[4] || 'CO_Eastern_ElPaso_2018', SIZE = +(process.argv[5] || 120);
const k = Math.cos(lat * Math.PI / 180), [CX, CY] = merc(lon, lat), half = SIZE / 2 / k;
const box = [CX - half, CY - half, CX + half, CY + half];
const T = 600, px = (X, Y) => [(X - box[0]) / (box[2] - box[0]) * T, (box[3] - Y) / (box[3] - box[1]) * T];
const toLL = (X, Y) => proj4('EPSG:3857', 'EPSG:4326', [X, Y]);

/* lot + house */
const pq = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
const lot = pq.features[0].geometry.rings;
const house = pickHouse(lot, await loadBuildings(join(HERE, 'buildings'), [lon - 0.003, lat - 0.003, lon + 0.003, lat + 0.003]));
const lotPx = lot.map((r) => r.map(([lo, la]) => px(...merc(lo, la)))), housePx = house ? house.ring.map(([lo, la]) => px(...merc(lo, la))) : null;

/* left: photo */
const token = (await json('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const stac = await json('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
const corners = [[box[0], box[1]], [box[2], box[3]], [box[0], box[3]], [box[2], box[1]]].map(([X, Y]) => { const [x, y] = proj4('EPSG:4326', epsg, toLL(X, Y)); return [(x - origin[0]) / res[0], (y - origin[1]) / res[1]]; });
const x0 = Math.floor(Math.min(...corners.map((c) => c[0]))) - 2, y0 = Math.floor(Math.min(...corners.map((c) => c[1]))) - 2;
const x1 = Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2, y1 = Math.ceil(Math.max(...corners.map((c) => c[1]))) + 2;
const [R, G, B] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false }), w = x1 - x0;
const out = new PNG({ width: T * 2 + 10, height: T });
for (let o = 0; o < out.data.length; o += 4) { out.data[o] = out.data[o + 1] = out.data[o + 2] = 255; out.data[o + 3] = 255; }
for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
  const X = box[0] + (tx + 0.5) / T * (box[2] - box[0]), Y = box[3] - (ty + 0.5) / T * (box[3] - box[1]);
  const [x, y] = proj4('EPSG:4326', epsg, toLL(X, Y)); const ix = Math.floor((x - origin[0]) / res[0]) - x0, iy = Math.floor((y - origin[1]) / res[1]) - y0, i = iy * w + ix;
  const o = (ty * out.width + tx) * 4; out.data[o] = R[i]; out.data[o + 1] = G[i]; out.data[o + 2] = B[i];
}

/* right: LiDAR heights, 1 m cells */
const dir = join(HERE, 'lidar-cache', P), cell = 1 / k, W = Math.ceil((box[2] - box[0]) / cell);
const top = new Float32Array(W * W).fill(-Infinity), g3 = new Map();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.bin'))) {
  const b = readFileSync(join(dir, f)), n = b.readUInt32LE(0), xyz = new Float64Array(b.buffer.slice(b.byteOffset + 4, b.byteOffset + 4 + n * 24)), cls = b.subarray(4 + n * 24, 4 + n * 25);
  for (let i = 0; i < n; i++) {
    const X = xyz[i * 3], Y = xyz[i * 3 + 1]; if (X < box[0] || X >= box[2] || Y < box[1] || Y >= box[3]) continue;
    const c = Math.floor((X - box[0]) / cell), r = Math.floor((box[3] - Y) / cell), z = xyz[i * 3 + 2];
    if (z > top[r * W + c]) top[r * W + c] = z;
    if (cls[i] === 2) { const key = Math.floor(c / 4) + ',' + Math.floor(r / 4); if (!g3.has(key) || z < g3.get(key)) g3.set(key, z); }
  }
}
const gAt = (c, r) => { for (let d = 0; d < 6; d++) for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) { const v = g3.get((Math.floor(c / 4) + a) + ',' + (Math.floor(r / 4) + b)); if (v !== undefined) return v; } return null; };
const ramp = (h) => h < 0.5 ? [120, 95, 70] : h < 2 ? [170, 165, 100] : h < 6 ? [70, 150, 60] : h < 12 ? [30, 100, 40] : h < 20 ? [160, 210, 160] : [255, 255, 255];
for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
  const c = Math.floor(tx / T * W), r = Math.floor(ty / T * W), t = top[r * W + c]; let rgb = [20, 20, 20];
  if (t > -Infinity) { const g = gAt(c, r); if (g !== null) rgb = ramp(t - g); }
  const o = (ty * out.width + T + 10 + tx) * 4; out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2];
}

/* lines on both panels */
const dot = (x, y, col, rad, off) => { for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) { const X = Math.round(x) + a + off, Y = Math.round(y) + b; if (X < off || X >= off + T || Y < 0 || Y >= T) continue; const o = (Y * out.width + X) * 4; out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; } };
const poly = (pts, col, rad) => { for (const off of [0, T + 10]) for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay)); for (let s = 0; s <= n; s++) dot(ax + (bx - ax) * s / n, ay + (by - ay) * s / n, col, rad, off); } };
for (const r of lotPx) { poly(r, [0, 0, 0], 2); poly(r, [255, 225, 0], 1); }
if (housePx) { poly(housePx, [0, 0, 0], 2); poly(housePx, [255, 255, 255], 1); }
for (const off of [0, T + 10]) { for (let a = -6; a <= 6; a++) { dot(T / 2 + a, T / 2, [255, 40, 40], 1, off); dot(T / 2, T / 2 + a, [255, 40, 40], 1, off); } }
writeFileSync(join(HERE, 'view-compare.png'), PNG.sync.write(out));
console.log(`wrote view-compare.png — left: ${item.properties.datetime.slice(0, 10)} photo; right: LiDAR (${P}); ${SIZE} m square; red cross = the address point`);

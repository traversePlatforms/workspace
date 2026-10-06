/* Look inside the cached LiDAR tiles around a point: prints what a tile file holds and draws
   the points from above, coloured by height above the ground (brown = ground, through green to
   white = tallest). Usage: node view-tile.mjs <lat> <lon> [project] [metres] -> view-tile.png */
import { PNG } from 'pngjs';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merc } from './zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const [lat, lon] = [+process.argv[2], +process.argv[3]], P = process.argv[4] || 'CO_Eastern_ElPaso_2018', SIZE = +(process.argv[5] || 120);
const [X, Y] = merc(lon, lat), k = Math.cos(lat * Math.PI / 180), half = SIZE / 2 / k;
const box = [X - half, Y - half, X + half, Y + half];
const dir = join(HERE, 'lidar-cache', P);
const files = readdirSync(dir).filter((f) => f.endsWith('.bin'));
const pts = []; const used = [];
for (const f of files) {
  const b = readFileSync(join(dir, f)), n = b.readUInt32LE(0);
  const xyz = new Float64Array(b.buffer.slice(b.byteOffset + 4, b.byteOffset + 4 + n * 24)), cls = b.subarray(4 + n * 24, 4 + n * 25), nr = b.subarray(4 + n * 25, 4 + n * 26);
  let hit = 0;
  for (let i = 0; i < n; i++) { const x = xyz[i * 3], y = xyz[i * 3 + 1]; if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue; pts.push([x, y, xyz[i * 3 + 2], cls[i], nr[i]]); hit++; }
  if (hit) used.push({ f, n, hit, kb: Math.round(statSync(join(dir, f)).size / 1024) });
}
used.sort((a, b) => +a.f.split('-')[0] - +b.f.split('-')[0]);
console.log(`${used.length} tile files touch this ${SIZE} m square:`);
for (const u of used) console.log(`  ${u.f.padEnd(26)} ${String(u.kb).padStart(6)} KB  ${String(u.n).padStart(7)} points in the file, ${u.hit} inside the square`);
console.log(`\nFirst 6 points (web-map metres, height above sea level, class: 1 = unclassified, 2 = ground; returns per pulse):`);
for (const p of pts.slice(0, 6)) console.log(`  x ${p[0].toFixed(2)}  y ${p[1].toFixed(2)}  z ${p[2].toFixed(2)} m  class ${p[3]}  returns ${p[4]}`);
const cls = {}; for (const p of pts) cls[p[3]] = (cls[p[3]] || 0) + 1;
console.log(`\n${pts.length} points in the square (${(pts.length / (SIZE * SIZE)).toFixed(1)} per m²); by class ${JSON.stringify(cls)}`);

/* draw: 0.5 m pixels; ground = lowest class-2 point per 3 m block; height = top - ground */
const R = (+process.env.PX || 0.5) / k, W = Math.ceil((box[2] - box[0]) / R), S = Math.round(3 * (+process.env.PX || 0.5) / 0.5);
const top = new Float32Array(W * W).fill(-Infinity), g3 = new Map();
for (const [x, y, z, c] of pts) {
  const i = Math.floor((x - box[0]) / R), j = Math.floor((box[3] - y) / R); if (i < 0 || j < 0 || i >= W || j >= W) continue;
  if (z > top[j * W + i]) top[j * W + i] = z;
  if (c === 2) { const key = Math.floor(i / 6) + ',' + Math.floor(j / 6); if (!g3.has(key) || z < g3.get(key)) g3.set(key, z); }
}
const gAt = (i, j) => { for (let r = 0; r < 6; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const v = g3.get((Math.floor(i / 6) + a) + ',' + (Math.floor(j / 6) + b)); if (v !== undefined) return v; } return null; };
const png = new PNG({ width: W * S, height: W * S });
const ramp = (h) => h < 0.5 ? [120, 95, 70] : h < 2 ? [150, 160, 90] : h < 6 ? [60, 140, 60] : h < 12 ? [30, 100, 40] : h < 20 ? [160, 210, 160] : [255, 255, 255];
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
  const t = top[j * W + i]; let rgb = [20, 20, 20];
  if (t > -Infinity) { const g = gAt(i, j); if (g !== null) rgb = ramp(t - g); }
  for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const o = ((j * S + a) * png.width + i * S + b) * 4; png.data[o] = rgb[0]; png.data[o + 1] = rgb[1]; png.data[o + 2] = rgb[2]; png.data[o + 3] = 255; }
}
writeFileSync(join(HERE, 'view-tile.png'), PNG.sync.write(png));
console.log('\nwrote view-tile.png — brown ground, khaki 0.5–2 m, greens 2–20 m, white over 20 m, black = no points');

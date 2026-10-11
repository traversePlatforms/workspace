// Which USGS laser-scan survey really covers a metro town (the metro builder, 2026-10-11): reads a 60 m box at sample doors
// from each candidate survey and counts how many get ground and roof heights. Prints counts only.
//   node metros/probe-lidar.mjs <town> <project> [<project> ...]
import { readFileSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { heightGrid } from '../tree-zones/lidar.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const [town, ...projects] = process.argv.slice(2);
const A = JSON.parse(readFileSync(join(ROOT, `${town}-areas.json`), 'utf8'));
const all = A.areas.flatMap((a) => a.doors); const step = Math.max(1, Math.floor(all.length / 8)); const sample = all.filter((_, i) => i % step === 0).slice(0, 8);
const R = 6378137, m = (lon, lat) => [lon * Math.PI / 180 * R, Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * R];
const cache = join(ROOT, 'tree-zones', 'lidar-cache'); mkdirSync(cache, { recursive: true });
for (const p of projects) {
  let ok = 0, cells = 0;
  for (const d of sample) {
    const [x, y] = m(d.lo, d.la); const box = [x - 30, y - 30, x + 30, y + 30];
    try { const g = await heightGrid(p, box, 1, cache); const n = [...g.hgt].filter((v) => Number.isFinite(v)).length; cells += n; if (n > 1000) ok++; } catch (e) { if (!globalThis.__e) { globalThis.__e = 1; console.log("  error:", e.message.slice(0, 200)); } }
  }
  console.log(`${p}: ${ok} of ${sample.length} sample doors read (${cells} height cells)`);
}

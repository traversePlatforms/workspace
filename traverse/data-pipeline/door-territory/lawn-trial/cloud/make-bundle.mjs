// The cloud run's bundle (2026-10-24, Matthew: yard v2 for every house on an Azure machine instead of the laptop).
// Writes cloud/out/bundle.tgz: the scripts yard v2 needs, their package lists, order.txt, and slim door files (id, lat, lon only:
// the cloud machine needs nothing else, and no owner names or addresses leave the laptop). Every town starts fresh there: the
// laptop's first three towns were measured with the land-cover fault fixed on 2026-10-24.
//   node cloud/make-bundle.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('../', import.meta.url));            /* lawn-trial/ */
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const OUT = fileURLToPath(new URL('./out/', import.meta.url)), B = OUT + 'bundle/';
rmSync(OUT, { recursive: true, force: true });
for (const d of ['lawn-trial/yard-v2', 'lawn-trial/data', 'tree-zones']) mkdirSync(B + d, { recursive: true });
for (const f of ['yard-scan-v2.mjs', 'yard-v2-town.mjs', 'package.json']) copyFileSync(HERE + f, B + 'lawn-trial/' + f);
for (const f of ['lidar.mjs', 'zones.mjs', 'package.json']) copyFileSync(HERE + '../tree-zones/' + f, B + 'tree-zones/' + f);
const order = readFileSync(HERE + 'yard-v2/order.txt', 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const todo = [];
let doors = 0;
for (const t of order) {
  const j = JSON.parse(readFileSync(`${DATA}/${t}.json`, 'utf8'));
  const slim = { areas: j.areas.map((a) => ({ doors: a.doors.filter((d) => d.lat && d.lon).map((d) => ({ id: d.id, lat: d.lat, lon: d.lon })) })) };
  doors += slim.areas.reduce((n, a) => n + a.doors.length, 0);
  writeFileSync(B + `lawn-trial/data/${t}.json`, JSON.stringify(slim));
  todo.push(t);
}
writeFileSync(B + 'lawn-trial/yard-v2/order.txt', todo.join('\n') + '\n');
execFileSync('tar', ['-czf', 'bundle.tgz', '-C', 'bundle', '.'], { cwd: OUT });
console.log(`${todo.length} towns, ${doors} houses; first ${todo.slice(0, 3).join(', ')}`);

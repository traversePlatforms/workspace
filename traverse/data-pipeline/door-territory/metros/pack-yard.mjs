// What the cloud machine's lawn stage for a metro needs (16 Nov 2026, Houston; stage overnight/fill1031/houyard.sh), into one folder to copy
// to ~/run/fill1031/<metro>/: slim door files (id, lat, lon only: no owner names leave the laptop), each town's lot lines, the town order
// (biggest first, so the three workers end together), the measuring code and the metro config.
//   node metros/pack-yard.mjs <metro> <outdir>     then: tar czf <outdir>/<metro>-data.tgz -C <outdir> data lots
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..'), DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const [metro, outdir] = process.argv.slice(2);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
mkdirSync(join(outdir, 'data'), { recursive: true }); mkdirSync(join(outdir, 'lots'), { recursive: true });
const order = []; let doors = 0;
for (const t of M.towns) {
  const f = join(DATA, `${t.key}.json`); if (!existsSync(f)) { console.log(`  ${t.key}: no door file yet, left out`); continue; }
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const slim = { key: t.key, areas: j.areas.map((a) => ({ doors: a.doors.map((d) => ({ id: d.id, lat: d.lat, lon: d.lon })) })) };
  const n = slim.areas.reduce((s, a) => s + a.doors.length, 0); doors += n;
  writeFileSync(join(outdir, 'data', `${t.key}.json`), JSON.stringify(slim));
  copyFileSync(join(HERE, 'out', `${t.key}-lots.json`), join(outdir, 'lots', `${t.key}-lots.json`));
  order.push([t.key, n]);
}
order.sort((a, b) => b[1] - a[1]);
writeFileSync(join(outdir, 'towns.txt'), order.map(([k]) => k).join('\n') + '\n');
for (const [src, as] of [['lawn-trial/yard-scan-v2.mjs', 'yard-scan-v2.mjs'], ['lawn-trial/build-yard-v2.mjs', 'build-yard-v2.mjs'], ['tree-zones/lidar.mjs', 'lidar.mjs'], ['tree-zones/zones.mjs', 'zones.mjs'],['metros/yard-metro.mjs', 'yard-metro.mjs'], [`metros/${metro}.json`, `${metro}.json`]]) copyFileSync(join(DT, src), join(outdir, as));
console.log(`${order.length} towns, ${doors} doors -> ${outdir}`);

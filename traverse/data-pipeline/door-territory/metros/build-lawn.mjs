// A metro's yard v2 readings into the lawn objects the door files carry (16 Nov 2026, Houston).
// Reads lawn-trial/yard-metro/<town>.json for every town of metros/<metro>.json (metros/yard-metro.mjs: per door l, s, u, o, t, lot,
// py ...; or big / shared / null) and writes lawn-trial/yard-metro/<metro>-lawn.json, keyed "<town>/<door id>": { lv, sq, yr[, rng] }
// (build-yard-v2.mjs yardLawn, the same rules as Colorado; yr = the photo's own year). build-rounds-data.mjs lays this file over the
// door files with y: 1, like Colorado's yard-v2-lawn.json, which this never touches.
//   node metros/build-lawn.mjs <metro>
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { yardLawn, markShared } from '../lawn-trial/build-yard-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), D = join(HERE, '..', 'lawn-trial', 'yard-metro');
const metro = process.argv[2], M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
mkdirSync(D, { recursive: true });
const out = {}, lv = {}; let n = 0, read = 0, towns = 0;
for (const t of M.towns) {
  const f = join(D, `${t.key}.json`); if (!existsSync(f)) continue; towns++;
  const doors = markShared(JSON.parse(readFileSync(f, 'utf8')).doors || {});
  for (const [id, v] of Object.entries(doors)) { read++; const L = yardLawn(v); if (L) { out[`${t.key}/${id}`] = L; n++; lv[L.lv] = (lv[L.lv] || 0) + 1; } }
}
writeFileSync(join(D, `${metro}-lawn.json`), JSON.stringify(out));
console.log(`${metro}-lawn.json: ${n} doors with a lawn size of ${read} read, ${towns} of ${M.towns.length} towns measured (L/M/S/N/T ${['L', 'M', 'S', 'N', 'T'].map((k) => lv[k] || 0).join(' / ')})`);

/* Prefetch LiDAR tiles into lidar-cache/ ahead of a measuring run (2026-10-16). sample-trees.mjs fetches tiles 6 doors at a
   time and waits on the network (9% of one core, ~1 door/s on Boulder County's CO_DRCOG_1_2020, whose tiles were not on disk).
   This only downloads and decodes tiles, many at once; the measuring run then reads them from disk. It never writes
   tree-cache.json (reads it only, to skip doors already measured), so it is safe beside a measuring run.
   Usage: node prefetch-lidar.mjs --towns=superior,louisville --conc=24 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merc } from './zones.mjs';
import { heightGrid, PROJECT, setMemoMax } from './lidar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const towns = arg('towns', '').split(',').filter(Boolean), CONC = +arg('conc', 24);
setMemoMax(80);
/* the town -> survey map, read from sample-trees.mjs as text (importing it would START a measuring run) */
const src = readFileSync(join(HERE, 'sample-trees.mjs'), 'utf8');
const map = src.slice(src.indexOf('const TOWNS'), src.indexOf('};', src.indexOf('const TOWNS')));
const survey = (t) => { const m = map.match(new RegExp(`['"]?${t}['"]?\\s*:\\s*'([^']+)'`)); return m && PROJECT[m[1]]; };
const cache = existsSync(join(DT, 'tree-cache.json')) ? JSON.parse(readFileSync(join(DT, 'tree-cache.json'), 'utf8')) : {};
const CD = join(HERE, 'lidar-cache');
for (const town of towns) {
  const p = survey(town), f = join(DT, `${town}-areas.json`);
  if (!p || !existsSync(f)) { console.log(`${town}: skipped (${!p ? 'no LiDAR survey' : 'no door list'})`); continue; }
  const todo = JSON.parse(readFileSync(f, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number' && !cache[`${d.la},${d.lo}`]);
  const t0 = Date.now(); let i = 0, n = 0, errs = 0;
  console.log(`${town}: ${todo.length} doors, ${p}`);
  async function worker() {
    for (;;) {
      const d = todo[i++]; if (!d) return;
      const k = Math.cos(d.la * Math.PI / 180), pad = 50 / k + 6, [x, y] = merc(d.lo, d.la);
      try { await heightGrid(p, [x - pad, y - pad, x + pad, y + pad], 4 / k, CD); } catch { errs++; }
      if (++n % 500 === 0) console.log(`  ${town} ${n}/${todo.length} · ${(n / ((Date.now() - t0) / 1000)).toFixed(1)}/s`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  console.log(`${town}: done ${n} in ${((Date.now() - t0) / 60000).toFixed(1)} min${errs ? `, ${errs} errors` : ''}`);
}

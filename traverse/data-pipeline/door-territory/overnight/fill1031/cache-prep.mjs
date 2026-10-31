/* Take readings out of a coordinate-keyed cache (roof-cache.json, solar-cache.json, tree-cache.json) for the doors of the listed towns, so
   the measuring script measures those doors again (each one skips any door it already has). fill1031, 2026-10-31.
     --err=<regex>   drop entries whose err matches (e.g. "^no parcel at the point$" after a broken lot download, "^no LiDAR here$" once
                     a town has a survey)
     --canopy        drop tree readings taken from the canopy map (src not 'lidar'), for towns that now have a laser survey
   Usage: node cache-prep.mjs --cache=<file> --areas=<dir with <town>-areas.json> --towns=<file> [--err=<regex>] [--canopy]       */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const arg = (k) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const CACHE = arg('cache'), AREAS = arg('areas'), ERR = arg('err') ? new RegExp(arg('err')) : null, CANOPY = process.argv.includes('--canopy');
const c = JSON.parse(readFileSync(CACHE, 'utf8'));
let all = 0;
for (const town of readFileSync(arg('towns'), 'utf8').split(/\s+/).filter(Boolean)) {
  const f = join(AREAS, `${town}-areas.json`); if (!existsSync(f)) { console.log(`${town}: no door list`); continue; }
  let n = 0;
  for (const d of JSON.parse(readFileSync(f, 'utf8')).areas.flatMap((a) => a.doors)) {
    if (typeof d.la !== 'number') continue;
    const k = `${d.la},${d.lo}`, v = c[k]; if (!v) continue;
    if ((ERR && v.err && ERR.test(v.err)) || (CANOPY && !v.err && v.src !== 'lidar')) { delete c[k]; n++; }
  }
  all += n; console.log(`${town}: ${n} readings taken out`);
}
writeFileSync(CACHE + '.tmp', JSON.stringify(c)); renameSync(CACHE + '.tmp', CACHE);
console.log(`${CACHE}: ${all} readings taken out`);

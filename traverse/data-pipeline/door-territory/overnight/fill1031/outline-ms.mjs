/* Whole Microsoft building-outline tiles for the outlinefix stage (2026-10-31). The cloud machine's outline folder (buildings ->
   buildings-ovt) holds Overture tiles cut on 26 Oct to the towns that existed then; Groups 1-3 came later and fetch-buildings.mjs
   skipped those tiles as "on disk", so towns such as Pueblo West, Wellington, Breckenridge and Frisco have no outline at all in them.
   This fetches the full Microsoft Global ML Building Footprints tiles (ODbL; the source the pipeline started with, same file format)
   for the z9 tiles at the corners of each town's door box into a separate folder, used with --buildings=buildings-ms.
   Usage: node outline-ms.mjs <tree-zones dir> <out dir> <door file>...                                                         */
import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [, , TZ, OUT, ...files] = process.argv;
const { quadkey } = await import(pathToFileURL(join(TZ, 'zones.mjs')).href);
mkdirSync(OUT, { recursive: true });
const need = new Set();
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf8')).areas.flatMap((a) => a.doors).filter((x) => typeof x.lat === 'number'); if (!d.length) continue;
  const la = d.map((x) => x.lat), lo = d.map((x) => x.lon), b = [Math.min(...lo) - 0.003, Math.min(...la) - 0.003, Math.max(...lo) + 0.003, Math.max(...la) + 0.003];
  for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) need.add(quadkey(x, y, 9));
}
const rows = (await (await fetch('https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv')).text()).split('\n').filter((l) => l.startsWith('UnitedStates,'));
for (const qk of need) {
  const out = join(OUT, `${qk}.geojsonl.gz`);
  if (existsSync(out)) { console.log(`${qk}: have it`); continue; }
  const row = rows.find((l) => l.split(',')[1] === qk); if (!row) { console.log(`${qk}: not in the index`); continue; }
  const url = row.split(',')[2];
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); writeFileSync(out + '.tmp', Buffer.from(await r.arrayBuffer())); renameSync(out + '.tmp', out); console.log(`${qk}: fetched`); break; }
    catch (e) { console.log(`${qk}: ${e.message} (try ${i + 1})`); if (i === 3) process.exit(1); await new Promise((ok) => setTimeout(ok, 5000)); }
  }
}
console.log(`outline-ms: ${need.size} tiles`);

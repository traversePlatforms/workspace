/* The building-outline tiles (z9 quadkeys) at the corners of each town's door box, padded as sample-trees.mjs and houses.mjs pad it
   (0.003 deg). loadBuildings() opens the tiles at those corners and stops if one is missing, and fetch-buildings.mjs on its own only
   fetches the tiles that hold a door. Prints the quadkeys, one line, for fetch-buildings.mjs's extra-tile arguments (2026-10-28).
   Usage: node corner-tiles.mjs <tree-zones dir> <door file>...                                                                    */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [, , TZ, ...files] = process.argv;
const { quadkey } = await import(pathToFileURL(join(TZ, 'zones.mjs')).href);
const out = new Set();
for (const f of files) {
  const doors = JSON.parse(readFileSync(f, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.lat === 'number');
  if (!doors.length) continue;
  const la = doors.map((d) => d.lat), lo = doors.map((d) => d.lon);
  const b = [Math.min(...lo) - 0.003, Math.min(...la) - 0.003, Math.max(...lo) + 0.003, Math.max(...la) + 0.003];
  for (const x of [b[0], b[2]]) for (const y of [b[1], b[3]]) out.add(quadkey(x, y, 9));
}
console.log([...out].join(' '));

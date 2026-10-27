/* Group 1 (2026-10-26): a slim door file from a town's <key>-areas.json, with the ids build-rounds-data.mjs will give the same doors
   (slug of the address, 'x' added on a repeat), so every measurement keyed by door id lines up later.
     node mkdoors.mjs <key>-areas.json <out key>.json                                                                              */
import { readFileSync, writeFileSync } from 'node:fs';
const [, , IN, OUT] = process.argv;
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const seen = new Set(), doors = [];
for (const a of JSON.parse(readFileSync(IN, 'utf8')).areas) for (const d of a.doors) {
  let id = slug(d.a); while (seen.has(id)) id += 'x'; seen.add(id);
  if (typeof d.la === 'number') doors.push({ id, lat: d.la, lon: d.lo });
}
writeFileSync(OUT, JSON.stringify({ areas: [{ doors }] }));
console.log(`${OUT}: ${doors.length} doors`);

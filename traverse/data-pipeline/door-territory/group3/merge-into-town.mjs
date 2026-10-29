/* Group 3 stage B (2026-10-29): add new doors to one of our towns without touching the doors already there. Cripple Creek and Idaho
   Springs get the doors Group 3 found inside them, and Woodland Park, Florissant and Divide the Teller sweep's doors inside them
   (prep-stageb.mjs rule 5: "merge, not a second town").
   The new doors' neighbourhoods (merge-<town>-areas.json, build-walklist-pdf.mjs on b/merge-<town>.csv) are APPENDED to <town>-areas.json
   after the town's own: the existing neighbourhoods, their order and their doors stay exactly as they are, so every door keeps its id
   (build-rounds-data gives ids in file order, 'x' added on a repeat) and its marks. A new door whose address id is already in the town
   within 150 m is skipped (build-rounds-data's same-house rule); a neighbourhood whose name the town already uses is renamed "<name> (2)".
   A backup goes to <town>-areas.json.bak-g3-<date> first.
     node merge-into-town.mjs <town> <merge-town-areas.json> [--dry]       (in door-territory)                                  */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DT = join(dirname(fileURLToPath(import.meta.url)), '..'), [, , TOWN, ADD] = process.argv, DRY = process.argv.includes('--dry');
const f = join(DT, `${TOWN}-areas.json`);
if (!TOWN || !ADD || !existsSync(f) || !existsSync(ADD)) throw new Error('usage: node merge-into-town.mjs <town> <merge-town-areas.json> [--dry]');
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111, (lo1 - lo2) * 111 * Math.cos((la1 * Math.PI) / 180));
const town = JSON.parse(readFileSync(f, 'utf8')), add = JSON.parse(readFileSync(ADD, 'utf8'));
const have = new Map(); for (const a of town.areas) for (const d of a.doors) (have.get(slug(d.a)) || have.set(slug(d.a), []).get(slug(d.a))).push(d);
const names = new Set(town.areas.map((a) => a.name));
let added = 0, skipped = 0;
for (const a of add.areas) {
  const doors = a.doors.filter((d) => { const same = (have.get(slug(d.a)) || []).some((x) => x.la != null && d.la != null && km(x.la, x.lo, d.la, d.lo) < 0.15); if (same) skipped++; return !same; });
  if (!doors.length) continue;
  let name = a.name, n = 2; while (names.has(name)) name = `${a.name} (${n++})`; names.add(name);
  town.areas.push({ ...a, name, doors }); added += doors.length;
}
console.log(`${TOWN}: ${added} doors added in new neighbourhoods, ${skipped} already in the town; ${town.areas.reduce((s, a) => s + a.doors.length, 0)} doors now`);
if (!DRY && added) {
  copyFileSync(f, `${f}.bak-g3-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  writeFileSync(f, JSON.stringify(town));
}

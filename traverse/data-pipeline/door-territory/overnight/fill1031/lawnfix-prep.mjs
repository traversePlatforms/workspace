/* lawnfix prep (2026-10-31, fill1031 stage lawnfix): before yard v2 measures again, per town in the list
     - doors that read "no lot" (null) are taken out of yard-v2/<town>.json, so yard-v2-town.mjs measures them again;
     - the lot-line cells those doors sit in are taken out of drcog-turf/parcels-<town>.json, so they are asked for again (a cell saved
       while the state service was throttling comes back empty, not as an error, and would answer "no lot" again).
   Doors in the house list that the yard v2 file never had need nothing: yard-v2-town.mjs measures every door it has no answer for.
   The grid origin is worked out exactly as yard-v2-town.mjs does (fixed 0.008 deg grid from the list's lowest house).
   Usage: node lawnfix-prep.mjs <lawn-trial dir> <towns file>                                                                    */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const [, , LT, list] = process.argv;
const S = 0.008;
const write = (f, s) => { writeFileSync(f + '.tmp', s); renameSync(f + '.tmp', f); };
let tn = 0, tc = 0, tu = 0;
for (const town of readFileSync(list, 'utf8').split(/\s+/).filter(Boolean)) {
  const doors = JSON.parse(readFileSync(join(LT, 'data', `${town}.json`), 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon);
  const yf = join(LT, 'yard-v2', `${town}.json`);
  const y = existsSync(yf) ? JSON.parse(readFileSync(yf, 'utf8')) : null;
  if (!y) { console.log(`${town}: no yard v2 file (all ${doors.length} doors will be measured)`); continue; }
  const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon);
  const la0 = Math.floor((Math.min(...lats) - 0.002) / S) * S, lo0 = Math.floor((Math.min(...lons) - 0.002) / S) * S;
  const cellOf = (lat, lon) => Math.floor((lat - la0) / S) + ':' + Math.floor((lon - lo0) / S);
  const byId = new Map(doors.map((d) => [d.id, d]));
  const cells = new Set(); let n = 0;
  for (const [id, v] of Object.entries(y.doors)) if (v === null) { delete y.doors[id]; n++; const d = byId.get(id); if (d) cells.add(cellOf(d.lat, d.lon)); }
  const unmeasured = doors.filter((d) => !(d.id in y.doors)).length - n;
  if (n) write(yf, JSON.stringify(y));
  const pf = join(LT, 'drcog-turf', `parcels-${town}.json`); let c = 0;
  if (cells.size && existsSync(pf)) {
    const pc = JSON.parse(readFileSync(pf, 'utf8'));
    if (pc.o && pc.o[0] === la0 && pc.o[1] === lo0) { for (const k of cells) if (k in pc.cells) { delete pc.cells[k]; c++; } if (c) write(pf, JSON.stringify(pc)); }
    else console.log(`  ${town}: lot cells saved on another grid origin: yard-v2-town.mjs starts them again`);
  }
  tn += n; tc += c; tu += Math.max(0, unmeasured);
  console.log(`${town}: ${doors.length} doors, ${n} no-lot doors cleared, ${c} lot cells cleared, ${Math.max(0, unmeasured)} never measured`);
}
console.log(`lawnfix prep: ${tn} no-lot doors cleared, ${tc} lot cells cleared, ${tu} doors never measured`);

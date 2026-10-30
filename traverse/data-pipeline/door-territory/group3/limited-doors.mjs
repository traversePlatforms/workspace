/* The "Limited data" doors of Group 3 (2026-10-29; GROUP3-PLAN-2026-10-29.md "For the app"; Matthew: "just make that note in the app").
   prep-stageb.mjs writes b/limited-<town>.json ({ address: reason }) for every door with a gap; build-rounds-data.mjs gives each such
   door a field `lim` in the slim door file, which the editions copy unchanged:
     noowner  address point only, no owner on record (Group 3b: Montrose, Delta, Las Animas, Alamosa, Conejos, Costilla, Bent,
              Mineral, Washington ...)                            prep's "no-owner"
     noocc    owner on record, no mailing address, so occupancy unknown (Sedgwick)               prep's "no-occupancy"
     noname   owner name withheld or blank (Eagle, Summit)                                         prep's "no-owner-name"
   Matched by the address as the door list has it (upper case, spaces collapsed: build-walklist-pdf's own duplicate key). A town with no
   file gets no lim; a merged town's file lists only the doors that joined it.
     import { limitedFor } from './group3/limited-doors.mjs'     limitedFor(key) -> (address) => code | null
     node group3/limited-doors.mjs check <town-areas.json> <limited-town.json>    how many of the file's doors the door list matches
     node group3/limited-doors.mjs built <rounds dir> [min share] <town...>       lim doors in the built door files against the
                                                                                    limited files; exit 1 if under min share (0.9)
   Prints counts only: no addresses, no names. */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LIM_DIR = process.env.LIM_DIR || join(HERE, 'b');   /* LIM_DIR=<dir> for a test copy */
export const LIM_CODE = { 'no-owner': 'noowner', 'no-occupancy': 'noocc', 'no-owner-name': 'noname' };
const norm = (a) => String(a || '').toUpperCase().replace(/\s+/g, ' ').trim();

function readLimited(file) {
  const m = new Map();
  for (const [addr, why] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) { const c = LIM_CODE[why]; if (c) m.set(norm(addr), c); }
  return m;
}
export function limitedFor(key, dir = LIM_DIR) {
  const f = join(dir, `limited-${key}.json`);
  if (!existsSync(f)) return null;
  const m = readLimited(f);
  return m.size ? (addr) => m.get(norm(addr)) || null : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'check') {
    const [areas, lim] = rest; const m = readLimited(lim), seen = new Set(), by = {};
    for (const a of JSON.parse(readFileSync(areas, 'utf8')).areas) for (const d of a.doors) {
      const c = m.get(norm(d.a)); if (c) { seen.add(norm(d.a)); by[c] = (by[c] || 0) + 1; }
    }
    console.log(`limited file ${m.size} doors; matched on the door list ${seen.size} (${JSON.stringify(by)}); not on the door list ${m.size - seen.size}`);
  } else if (cmd === 'built') {
    const RD = rest.shift(); const min = /^0?\.\d+$|^1$/.test(rest[0] || '') ? +rest.shift() : 0.9;
    let want = 0, got = 0; const by = {}, low = [];
    for (const key of rest) {
      const f = join(LIM_DIR, `limited-${key}.json`); if (!existsSync(f)) continue;
      const w = readLimited(f).size; let g = 0;
      const p = join(RD, `${key}.json`);
      if (existsSync(p)) for (const a of JSON.parse(readFileSync(p, 'utf8')).areas || []) for (const d of a.doors || []) if (d.lim) { g++; by[d.lim] = (by[d.lim] || 0) + 1; }
      want += w; got += g; if (g < w * min) low.push(`${key} ${g}/${w}`);
    }
    console.log(`limited data: ${got} doors carry lim of ${want} in the limited files (${JSON.stringify(by)})${low.length ? ' | under ' + min * 100 + '%: ' + low.join(', ') : ''}`);
    if (want && got < want * min) process.exit(1);
  } else console.log('node limited-doors.mjs check <town-areas.json> <limited-town.json> | built <rounds dir> [min share] <town...>');
}

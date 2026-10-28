/* Group 2, after each pull (2026-10-28; from group1/clip-group1.mjs, with one fix): keep the rows inside the target's Census
   boundary (pieces-<key>.json) that are not already a door in a town of ours nor in a Group 2 target pulled before this one.
   Writes out/<key>.csv in the walk-list layout.

   ⚑ THE FIX. clip-group1.mjs called two rows the same house when their parcel centres were under 20 m apart. Tested on Blende
   (Pueblo) that dropped 74 real neighbours: 0.15-acre lots are about 18 m wide, so every other house on a street of small lots
   went. Here:
     - the same house in an earlier Group 2 target, or twice in one pull, is the same PARCEL NUMBER (the address when a row has
       no parcel number), an exact match;
     - a door of ours (door-points.json from group2-gaps.mjs, no parcel numbers) still goes by distance, but within 5 m: our doors
       come from the same statewide parcel layer and the same centroid sum, so the same parcel lands on the same point.
     node clip-group2.mjs <key> <raw csv>                                                                                         */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), [, , KEY, RAW] = process.argv;
const NEAR_M = 5;
const pieces = JSON.parse(readFileSync(join(HERE, `pieces-${KEY}.json`), 'utf8'));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inside = (x, y) => pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && p.rings.filter((r) => inRing(x, y, r)).length % 2 === 1);
/* our doors, by distance */
const cell = (la, lo) => `${Math.round(la * 4000)},${Math.round(lo * 4000)}`;   /* ~28 m cells; neighbours checked */
const ours = new Map();
for (const [la, lo] of JSON.parse(readFileSync(join(HERE, 'door-points.json'), 'utf8'))) { const k = cell(la, lo); (ours.get(k) || ours.set(k, []).get(k)).push([la, lo]); }
const isOurs = (la, lo) => { const [a, b] = cell(la, lo).split(',').map(Number); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [x, y] of ours.get(`${a + i},${b + j}`) || []) if (Math.hypot((x - la) * 111000, (y - lo) * 111000 * Math.cos(la * Math.PI / 180)) < NEAR_M) return true; return false; };
/* Group 2 rows already pulled, by parcel number */
const parseRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const h = l[i]; if (q) { if (h === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (h === '"') q = false; else c += h; } else if (h === '"') q = true; else if (h === ',') { o.push(c); c = ''; } else c += h; } o.push(c); return o; };
const idOf = (r, h) => { const p = (r[h.indexOf('parcel')] || '').trim(); return p ? 'p:' + p : 'a:' + (r[h.indexOf('address')] || '').trim().toUpperCase() + '|' + (r[h.indexOf('city')] || '').trim().toUpperCase(); };
const taken = new Set();
const OUT = join(HERE, 'out'); mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT).filter((f) => f.endsWith('.csv') && f !== KEY + '.csv')) {
  const ls = readFileSync(join(OUT, f), 'utf8').split(/\r?\n/).filter(Boolean); const h = parseRow(ls[0]);
  for (const l of ls.slice(1)) taken.add(idOf(parseRow(l), h));
}
const lines = readFileSync(RAW, 'utf8').split(/\r?\n/).filter(Boolean); const head = parseRow(lines[0]), LA = head.indexOf('lat'), LO = head.indexOf('lon');
const keep = [lines[0]]; let outside = 0, dupOurs = 0, dupG2 = 0;
for (const l of lines.slice(1)) {
  const r = parseRow(l), la = +r[LA], lo = +r[LO], id = idOf(r, head);
  if (!inside(lo, la)) { outside++; continue; }
  if (taken.has(id)) { dupG2++; continue; }
  if (isOurs(la, lo)) { dupOurs++; continue; }
  keep.push(l); taken.add(id);
}
writeFileSync(join(OUT, `${KEY}.csv`), keep.join('\n') + '\n');
const yes = keep.slice(1).filter((l) => l.startsWith('"YES"')).length;
console.log(`${KEY}: ${keep.length - 1} new doors, ${yes} owner lives here (pulled ${lines.length - 1}, outside the boundary ${outside}, already doors of ours ${dupOurs}, in an earlier Group 2 target ${dupG2})`);

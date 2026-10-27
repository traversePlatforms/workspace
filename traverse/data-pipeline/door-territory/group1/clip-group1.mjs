/* Group 1, after each pull (2026-10-26): keep the rows inside the target's Census boundary (pieces-<key>.json) that are not already a
   door in any town of ours (door-points.json: [lat, lon] of every door, within 20 m) nor in a Group 1 target pulled before this one
   (out/*.csv), so a rural sweep never repeats a place. Writes out/<key>.csv in the walk-list layout.
     node clip-group1.mjs <key> <raw csv>                                                                                         */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), [, , KEY, RAW] = process.argv;
const pieces = JSON.parse(readFileSync(join(HERE, `pieces-${KEY}.json`), 'utf8'));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inside = (x, y) => pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && p.rings.filter((r) => inRing(x, y, r)).length % 2 === 1);
const cell = (la, lo) => `${Math.round(la * 2000)},${Math.round(lo * 2000)}`;   /* ~55 m cells; neighbours checked */
const seen = new Map(); const add = (la, lo) => { const k = cell(la, lo); (seen.get(k) || seen.set(k, []).get(k)).push([la, lo]); };
for (const [la, lo] of JSON.parse(readFileSync(join(HERE, 'door-points.json'), 'utf8'))) add(la, lo);
const parseRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const h = l[i]; if (q) { if (h === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (h === '"') q = false; else c += h; } else if (h === '"') q = true; else if (h === ',') { o.push(c); c = ''; } else c += h; } o.push(c); return o; };
const OUT = join(HERE, 'out');
for (const f of existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.csv') && f !== KEY + '.csv') : []) {
  const ls = readFileSync(join(OUT, f), 'utf8').split(/\r?\n/).filter(Boolean); const h = parseRow(ls[0]);
  for (const l of ls.slice(1)) { const r = parseRow(l); add(+r[h.indexOf('lat')], +r[h.indexOf('lon')]); }
}
const near = (la, lo) => { const [a, b] = cell(la, lo).split(',').map(Number); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [x, y] of seen.get(`${a + i},${b + j}`) || []) if (Math.abs(x - la) * 111000 < 20 && Math.abs(y - lo) * 85000 < 20) return true; return false; };
const lines = readFileSync(RAW, 'utf8').split(/\r?\n/).filter(Boolean); const head = parseRow(lines[0]), LA = head.indexOf('lat'), LO = head.indexOf('lon');
const keep = [lines[0]]; let outside = 0, dup = 0;
for (const l of lines.slice(1)) { const r = parseRow(l), la = +r[LA], lo = +r[LO]; if (!inside(lo, la)) { outside++; continue; } if (near(la, lo)) { dup++; continue; } keep.push(l); add(la, lo); }
writeFileSync(join(OUT, `${KEY}.csv`), keep.join('\n') + '\n');
console.log(`${KEY}: ${keep.length - 1} new doors (pulled ${lines.length - 1}, outside the boundary ${outside}, already doors ${dup})`);

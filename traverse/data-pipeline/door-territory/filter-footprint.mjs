/* Keep a re-pulled town inside its old footprint (2026-10-16, the all-lot-sizes rebuild): a town whose original pull command was not
   recorded is pulled again by county + centre + radius + its situs cities, which can reach further than the original did. This keeps
   only rows within <mi> miles of some door the town already had, so a town gains its small lots without spreading into its
   neighbours.   node filter-footprint.mjs <new.csv> <old.csv> [mi=0.5]   (rewrites new.csv in place) */
import { readFileSync, writeFileSync } from 'node:fs';
const [newF, oldF, miArg] = process.argv.slice(2);
const MI = Number(miArg || 0.5);
/* the walk-list CSV: quoted fields, lat and lon the last two columns */
const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
const read = (f) => readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
const oldL = read(oldF), head = parse(oldL[0]), la = head.indexOf('lat'), lo = head.indexOf('lon');
if (la < 0 || lo < 0) { console.error('no lat/lon columns'); process.exit(1); }
const cell = 0.01, grid = new Map(), key = (y, x) => Math.floor(y / cell) + ',' + Math.floor(x / cell);
for (const l of oldL.slice(1)) { const p = parse(l), y = +p[la], x = +p[lo]; if (!isFinite(y) || !isFinite(x)) continue; const k = key(y, x); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([y, x]); }
const near = (y, x) => {
  const gy = Math.floor(y / cell), gx = Math.floor(x / cell), r = Math.ceil(MI / 0.55) + 1;
  for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (const [py, px] of grid.get((gy + a) + ',' + (gx + b)) || []) if (Math.hypot((py - y) * 69, (px - x) * 53.3) <= MI) return true;
  return false;
};
const newL = read(newF), nh = parse(newL[0]), nla = nh.indexOf('lat'), nlo = nh.indexOf('lon');
const kept = [newL[0]]; let out = 0, bad = 0;
for (const l of newL.slice(1)) { const p = parse(l), y = +p[nla], x = +p[nlo]; if (!isFinite(y) || !isFinite(x)) { bad++; continue; } if (near(y, x)) kept.push(l); else out++; }
writeFileSync(newF, kept.join('\n') + '\n');
console.log(`footprint: kept ${kept.length - 1}, dropped ${out} outside ${MI} mi of the old doors, ${bad} with no position (old had ${oldL.length - 1})`);

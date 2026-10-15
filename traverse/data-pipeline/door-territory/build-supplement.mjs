/* Top up a town's lists from a fuller parcel pull (2026-10-14, Matthew found 7110 S Franklin Way, Centennial, missing: the town's first pull
   only reached part of it). Reads <town>-full.csv (build-walklist-co.mjs over the whole legal boundary, a low --min-acres), and adds:
     - homes where the owner lives, on lots of at least --min-acres (the door lists' own rule, 0.12), not yet on the door list:
       new neighbourhoods appended to <town>-areas.json, one per street (split at 60 doors), named like the others ("S FRANKLIN WAY 7010-7190");
     - every other home not yet on either list (rented, or a smaller lot) to <town>-lookup-areas.json, for the office's House lookup only.
   Existing neighbourhoods, their names and their doors are not touched, so marks, territories and history keep working. Originals are kept
   as .bak-<date>. Run from this folder:  node build-supplement.mjs centennial [--min-acres=0.12]                                         */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const town = process.argv[2]; if (!town) { console.error('town?'); process.exit(1); }
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const MIN = Number(arg('min-acres', '0.12'));
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);   /* build-rounds-data.mjs's */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const AP = join(HERE, `${town}-areas.json`), LP = join(HERE, `${town}-lookup-areas.json`), FP = join(HERE, `${town}-full.csv`);
if (!existsSync(AP) || !existsSync(FP)) { console.error('need ' + AP + ' and ' + FP); process.exit(1); }
const day = new Date().toISOString().slice(0, 10);
const A = JSON.parse(readFileSync(AP, 'utf8'));
const Lk = existsSync(LP) ? JSON.parse(readFileSync(LP, 'utf8')) : { built: day, areas: [{ name: 'Not on the door lists', doors: [] }] };
const onDoors = new Set(A.areas.flatMap((a) => a.doors.map((d) => slug(d.a))));
const onLook = new Set(Lk.areas.flatMap((a) => a.doors.map((d) => slug(d.a))));
const rows = parseCsv(readFileSync(FP, 'utf8')); const h = rows[0]; const ix = (k) => h.indexOf(k);
const [K, AD, AC, O, W, LA, LO] = ['knock', 'address', 'acres', 'owner', 'why', 'lat', 'lon'].map(ix);
const newDoors = [], newLook = [], seen = new Set();
for (const r of rows.slice(1)) {
  const a = (r[AD] || '').trim(); if (!a) continue;
  const id = slug(a); if (seen.has(id) || onDoors.has(id)) continue; seen.add(id);
  const la = Number(r[LA]), lo = Number(r[LO]); if (!(Math.abs(la) > 0 && Math.abs(lo) > 0)) continue;
  const ac = Number(r[AC]) || null, owner = (r[O] || '').trim() || null, knock = /^YES/i.test(r[K] || '');
  const d = { a, ac, o: owner, la, lo };
  if (knock && ac != null && ac >= MIN) newDoors.push(d);
  else if (!onLook.has(id)) newLook.push({ ...d, why: (r[W] || '').trim() || null, rent: knock ? 0 : 1 });
}
/* new neighbourhoods: one per street, in house-number order, split at 60 */
const streetOf = (a) => a.replace(/^\d+[A-Z]?\s+/, '').trim();
const numOf = (a) => parseInt(a, 10) || 0;
const byStreet = new Map(); for (const d of newDoors) { const s = streetOf(d.a); (byStreet.get(s) || byStreet.set(s, []).get(s)).push(d); }
const names = new Set(A.areas.map((a) => a.name)); let added = 0;
for (const [st, ds] of [...byStreet.entries()].sort()) {
  ds.sort((x, y) => numOf(x.a) - numOf(y.a));
  for (let i = 0; i < ds.length; i += 60) {
    const part = ds.slice(i, i + 60);
    let name = part.length > 1 ? `${st} ${numOf(part[0].a)}–${numOf(part[part.length - 1].a)}` : st;
    while (names.has(name)) name += ' (more)';
    names.add(name);
    const acs = part.map((d) => d.ac).filter((x) => x);
    A.areas.push({ name, region: A.areas[0]?.region ?? town, avg: acs.length ? acs.reduce((s, x) => s + x, 0) / acs.length : null, doors: part, added: day });
    added += part.length;
  }
}
copyFileSync(AP, AP + '.bak-' + day);
if (existsSync(LP)) copyFileSync(LP, LP + '.bak-' + day);
writeFileSync(AP, JSON.stringify(A), 'utf8');
Lk.areas[0].doors.push(...newLook); Lk.built = day;
writeFileSync(LP, JSON.stringify(Lk), 'utf8');
console.log(`${town}: ${added} homes added to the door lists in ${byStreet.size ? [...byStreet.keys()].length : 0} streets; ${newLook.length} added to the office lookup (rented or small lots)`);

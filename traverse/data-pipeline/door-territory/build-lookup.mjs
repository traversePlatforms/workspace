/* The office lookup's extra homes (2026-10-14, Matthew: "lets add the rented houses to jens search list but not the knocking").
   The door lists keep only homes where the owner lives (that is who a door knock is for). Jen, answering people who asked
   for a quote, needs the rest too: a renter wants aeration as much as an owner. This writes, per town, the homes the town's
   CSV has but its door list does not, as <town>-lookup-areas.json (one area, "Not on the door lists"), in the same door
   format as <town>-areas.json, so the lawn, compact and tree samplers can measure them with --town=<town>-lookup and
   build-rounds-data.mjs can turn them into <town>-lookup.json beside the door lists. The app shows them to the office's
   House lookup only, never on a door list or in the crew's search.
   Condos, apartments and mobile homes are not in the CSVs at all (build-walklist*.mjs drop them by land use); nor are lots
   under the town's minimum size. Those need a fresh parcel pull (--min-acres) and are a separate step.
   Run from this folder:  node build-lookup.mjs [town ...]      (no towns = every town with a CSV and a door list) */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
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
const asked = process.argv.slice(2);
const towns = asked.length ? asked : [...readFileSync(join(HERE, 'build-rounds-data.mjs'), 'utf8').matchAll(/\['([a-z-]+)', '[^']+', '([a-z-]+)-areas\.json'/g)].map((m) => m[1]);
let total = 0;
for (const t of towns) {
  const csv = join(HERE, `${t}.csv`), areas = join(HERE, `${t}-areas.json`);
  if (!existsSync(csv) || !existsSync(areas)) { console.log(`${t}: skipped (no CSV or no door list)`); continue; }
  const listed = new Set(JSON.parse(readFileSync(areas, 'utf8')).areas.flatMap((a) => a.doors.map((d) => slug(d.a))));
  const rows = parseCsv(readFileSync(csv, 'utf8')); const h = rows[0]; const ix = (k) => h.indexOf(k);
  const [K, A, C, Z, AC, O, W, LA, LO] = ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'why', 'lat', 'lon'].map(ix);
  if (A < 0 || LA < 0 || LO < 0) { console.log(`${t}: skipped (CSV has no address or coordinates)`); continue; }
  const seen = new Set(), doors = [];
  for (const r of rows.slice(1)) {
    const a = (r[A] || '').trim(); if (!a) continue;
    const id = slug(a); if (listed.has(id) || seen.has(id)) continue;   /* on the door list already, or a second parcel at one address */
    const la = Number(r[LA]), lo = Number(r[LO]); if (!(Math.abs(la) > 0 && Math.abs(lo) > 0)) continue;
    seen.add(id);
    doors.push({ a, ac: Number(r[AC]) || null, o: (r[O] || '').trim() || null, la, lo, why: (r[W] || '').trim() || null, rent: K >= 0 && !/^YES/i.test(r[K] || '') ? 1 : 0 });
  }
  writeFileSync(join(HERE, `${t}-lookup-areas.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), areas: [{ name: 'Not on the door lists', doors }] }), 'utf8');
  total += doors.length;
  console.log(`${t}: ${doors.length} homes for the office lookup (${doors.filter((d) => d.rent).length} where the owner lives elsewhere)`);
}
console.log(`total ${total}`);

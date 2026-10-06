/* Sixfold — the mailing-address sidecar for skip tracing. 2026-10-04.

   The door files the app serves (door-app/site/data/rounds/<town>.json) carry the owner's NAME and the
   property address, but not the owner's MAILING address or the property's city and ZIP: those stayed
   in the county walk-list CSVs (<town>.csv here, column owner_mailing / city / zip, gitignored).
   Skip tracing wants all three, so this writes one small file per town beside the door file:

       door-app/site/data/rounds/mail-<town>.json      { "<door id>": { "m": "mailing address", "c": "city", "z": "zip" } }

   read by api/skiptrace.php on the server (skipMail) and never sent to the page. A door id is the
   slug of its address (build-rounds-data.mjs); two CSV rows with the same slug (duplex units written
   the same way) are left out rather than guessed. Upload the files to sixfold-data/rounds/ with the
   door files; they are gitignored like the CSVs they come from.

       node sixfold/operations/door-territory/build-mail-sidecar.mjs            all towns
       node .../build-mail-sidecar.mjs monument castle-rock                      some towns
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'site', 'data', 'rounds');
const TOWNS = ['monument', 'palmer-lake', 'black-forest', 'castle-rock', 'larkspur', 'sedalia', 'franktown', 'woodland-park', 'divide', 'florissant', 'cripple-creek'];
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

function csv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows;
  return body.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : TOWNS;
for (const town of want) {
  const src = join(HERE, `${town}.csv`), doorsFile = join(OUT, `${town}.json`);
  if (!existsSync(src)) { console.log(`${town}: no ${town}.csv here, skipped`); continue; }
  if (!existsSync(doorsFile)) { console.log(`${town}: no door file at ${doorsFile}, skipped`); continue; }
  const bySlug = new Map();
  for (const r of csv(readFileSync(src, 'utf8'))) {
    const k = slug(r.address || '');
    if (!k) continue;
    if (bySlug.has(k)) bySlug.set(k, null); else bySlug.set(k, r);   /* a repeat is ambiguous: left out */
  }
  const doors = JSON.parse(readFileSync(doorsFile, 'utf8'));
  const out = {}; let n = 0, hit = 0, amb = 0;
  for (const a of doors.areas) for (const d of a.doors) {
    n++;
    const r = bySlug.get(d.id);
    if (r === null) { amb++; continue; }
    if (!r) continue;
    const e = {};
    if ((r.owner_mailing || '').trim()) e.m = r.owner_mailing.trim();
    if ((r.city || '').trim()) e.c = r.city.trim().replace(/\b([A-Z])([A-Z]+)/g, (m, a, b) => a + b.toLowerCase());
    if (/^\d{5}/.test(r.zip || '')) e.z = r.zip.slice(0, 5);
    if (Object.keys(e).length) { out[d.id] = e; hit++; }
  }
  writeFileSync(join(OUT, `mail-${town}.json`), JSON.stringify(out));
  console.log(`${town}: ${hit} of ${n} doors have a mailing address${amb ? ` (${amb} left out: two county rows share the address)` : ''}`);
}

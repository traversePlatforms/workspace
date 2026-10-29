/* Group 3 stage A counts (2026-10-29), written by run-group3.sh at the end to out/summary.tsv. Counts only, no names.
   Columns: key, county, method, Census houses, Census owner-occupied, rows, owner lives here ("YES"), local PO box.
   "local_po_box" = rows marked "owner mails to a PO box" whose box is in the house's own ZIP or town. The 29 Oct smoke test found
   that in small mountain and rural towns most owners use a PO box (no home delivery): Ignacio 199 of 304 rows. Those rows are not
   "YES" in stage A (the same rule as every earlier group). Matthew, 29 Oct: they count as "lives here" (stage B, prep-stageb.mjs,
   applies it with the same test, localPoBox() below).
   Group 3b (2026-10-29): node summary-g3.mjs targets-3b.json summary-3b.tsv adds two columns, no_owner and no_occupancy (rows with
   no owner on record / an owner but no mailing address: the app's "Limited data" doors; they are "YES" rows).
     node summary-g3.mjs [targets file] [summary name]     (in ~/run/group3; default targets.json -> out/summary.tsv)            */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
export const parseRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const h = l[i]; if (q) { if (h === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (h === '"') q = false; else c += h; } else if (h === '"') q = true; else if (h === ',') { o.push(c); c = ''; } else c += h; } o.push(c); return o; };
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
/** a "PO box" row whose box is in the house's own ZIP or town ("PO BOX 12, IGNACIO, CO, 81137": city third from the end, ZIP last) */
export function localPoBox(get) {
  if (get('why') !== 'owner mails to a PO box') return false;
  const parts = String(get('owner_mailing') || '').split(',').map((s) => s.trim());
  const mzip = (parts[parts.length - 1] || '').replace(/\D/g, '').slice(0, 5), mcity = norm(parts[parts.length - 3]);
  return Boolean((mzip && mzip === get('zip')) || (mcity && mcity === norm(get('city'))));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [TF = 'targets.json', SF = 'summary.tsv'] = process.argv.slice(2), B = TF !== 'targets.json';
  const out = ['key\tcounty\tmethod\tcensus\towner_occupied\trows\towner_lives_here\tlocal_po_box' + (B ? '\tno_owner\tno_occupancy' : '')];
  let missing = 0;
  for (const t of JSON.parse(readFileSync(join(HERE, TF), 'utf8'))) {
    const f = join(HERE, 'out', t.key + '.csv');
    if (!existsSync(f)) { missing++; out.push([t.key, t.county, t.method, t.census, t.ownerOccupied, 'MISSING', '', ''].join('\t')); continue; }
    const ls = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); const h = parseRow(ls[0]);
    const I = (k) => h.indexOf(k);
    let yes = 0, po = 0, nown = 0, nocc = 0;
    for (const l of ls.slice(1)) {
      const r = parseRow(l), get = (k) => r[I(k)];
      if (get('limited') === 'no-owner') nown++; else if (get('limited') === 'no-occupancy') nocc++;
      if (get('knock') === 'YES') { yes++; continue; }
      if (localPoBox(get)) po++;
    }
    out.push([t.key, t.county, t.method, t.census, t.ownerOccupied, ls.length - 1, yes, po, ...(B ? [nown, nocc] : [])].join('\t'));
  }
  writeFileSync(join(HERE, 'out', SF), out.join('\n') + '\n');
  console.log(`${SF}: ${out.length - 1} targets, ${missing} missing`);
  process.exit(missing ? 1 : 0);
}

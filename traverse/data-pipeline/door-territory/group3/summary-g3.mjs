/* Group 3 stage A counts (2026-10-29), written by run-group3.sh at the end to out/summary.tsv. Counts only, no names.
   Columns: key, county, method, Census houses, Census owner-occupied, rows, owner lives here ("YES"), local PO box.
   "local_po_box" = rows marked "owner mails to a PO box" whose box is in the house's own ZIP or town. The 29 Oct smoke test found
   that in small mountain and rural towns most owners use a PO box (no home delivery): Ignacio 199 of 304 rows. Those rows are not
   "YES" today (the same rule as every earlier group); whether a local PO box should count as "lives here" is Matthew's call at
   stage B, and the CSVs carry everything needed to apply it without pulling again.
     node summary-g3.mjs     (in ~/run/group3)                                                                                    */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const parseRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const h = l[i]; if (q) { if (h === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (h === '"') q = false; else c += h; } else if (h === '"') q = true; else if (h === ',') { o.push(c); c = ''; } else c += h; } o.push(c); return o; };
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const out = ['key\tcounty\tmethod\tcensus\towner_occupied\trows\towner_lives_here\tlocal_po_box'];
let missing = 0;
for (const t of JSON.parse(readFileSync(join(HERE, 'targets.json'), 'utf8'))) {
  const f = join(HERE, 'out', t.key + '.csv');
  if (!existsSync(f)) { missing++; out.push([t.key, t.county, t.method, t.census, t.ownerOccupied, 'MISSING', '', ''].join('\t')); continue; }
  const ls = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean); const h = parseRow(ls[0]);
  const I = (k) => h.indexOf(k);
  let yes = 0, po = 0;
  for (const l of ls.slice(1)) {
    const r = parseRow(l);
    if (r[I('knock')] === 'YES') { yes++; continue; }
    if (r[I('why')] !== 'owner mails to a PO box') continue;
    const parts = r[I('owner_mailing')].split(',').map((s) => s.trim());
    const mzip = (parts[parts.length - 1] || '').replace(/\D/g, '').slice(0, 5), mcity = norm(parts[parts.length - 3]);
    if ((mzip && mzip === r[I('zip')]) || (mcity && mcity === norm(r[I('city')]))) po++;
  }
  out.push([t.key, t.county, t.method, t.census, t.ownerOccupied, ls.length - 1, yes, po].join('\t'));
}
writeFileSync(join(HERE, 'out', 'summary.tsv'), out.join('\n') + '\n');
console.log(`summary.tsv: ${out.length - 1} targets, ${missing} missing`);
process.exit(missing ? 1 : 0);

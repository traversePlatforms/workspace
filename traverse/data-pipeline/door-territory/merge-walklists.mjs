/* Merge door lists from several county pulls of one town (2026-10-07):  node merge-walklists.mjs out.csv a.csv b.csv ...
   Every field is quoted (build-walklist-co.mjs), so a row splits on "," ; the parcel id decides a duplicate. */
import { readFileSync, writeFileSync } from 'node:fs';
const [out, ...parts] = process.argv.slice(2);
if (!out || !parts.length) { console.error('usage: node merge-walklists.mjs out.csv a.csv [b.csv ...]'); process.exit(1); }
let head = null; const seen = new Set(), rows = [];
for (const p of parts) {
  const lines = readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean), h = lines.shift();
  head = head || h;
  const ip = h.split(',').indexOf('parcel');
  for (const l of lines) {
    const key = l.replace(/^"|"$/g, '').split('","')[ip];
    if (seen.has(key)) continue;
    seen.add(key); rows.push(l);
  }
}
writeFileSync(out, [head, ...rows].join('\n') + '\n');
console.log(`  merged ${out}: ${rows.length} rows from ${parts.length} county pulls`);

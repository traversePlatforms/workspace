/* Split one door list into a north and a south town at a latitude (2026-10-07): Colorado Springs' halves were 48,000-57,000 doors,
   about twice Parker, the largest town the server reads whole per request (30 MB of PHP).
     node split-walklist.mjs <in.csv> <latitude> <north-out.csv> <south-out.csv>
   Every field is quoted (the builders), so a row splits on "," ; lat is the 10th column. */
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, at, northOut, southOut] = process.argv.slice(2);
const cut = +at;
if (!inp || !Number.isFinite(cut) || !northOut || !southOut) { console.error('usage: node split-walklist.mjs in.csv latitude north.csv south.csv'); process.exit(1); }
const lines = readFileSync(inp, 'utf8').split(/\r?\n/).filter(Boolean), head = lines.shift();
const il = head.split(',').indexOf('lat');
const n = [], s = [];
for (const l of lines) (+l.replace(/^"|"$/g, '').split('","')[il] >= cut ? n : s).push(l);
writeFileSync(northOut, [head, ...n].join('\n') + '\n'); writeFileSync(southOut, [head, ...s].join('\n') + '\n');
const k = (a) => a.filter((l) => l.startsWith('"YES"')).length;
console.log(`${inp} at ${cut}: ${northOut} ${k(n)} doors to knock (${n.length} rows) · ${southOut} ${k(s)} (${s.length} rows)`);

import { readFileSync, writeFileSync } from 'node:fs';
const parse = (line) => { const o = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const trade = new Map(readFileSync('in.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(parse).map((r) => [r[0], r[2]]));
const out = ['id,trade,formed,site'];
for (const l of readFileSync('found-sites.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) { const [rec, , , site] = parse(l); out.push([rec, trade.get(rec) || '', '', site].map(q).join(',')); }
writeFileSync('sites.csv', out.join('\n') + '\n'); console.log(out.length - 1, 'sites');

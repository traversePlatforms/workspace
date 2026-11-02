import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2], out = process.argv[3];
const t = readFileSync(src, 'utf8'); const rows = []; let row = [], c = '', q = false;
for (let i = 0; i < t.length; i++) { const ch = t[i];
  if (q) { if (ch === '"' && t[i+1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
  else if (ch === '"') q = true; else if (ch === ',') { row.push(c); c = ''; }
  else if (ch === '\n') { row.push(c.replace(/\r$/, '')); rows.push(row); row = []; c = ''; } else c += ch; }
if (c || row.length) { row.push(c); rows.push(row); }
const h = rows[0], ix = Object.fromEntries(h.map((n, i) => [n, i]));
const g = (r, n) => (r[ix[n]] || '').trim();
const qq = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const res = ['record,company,trade,city'];
let tot = 0;
for (const r of rows.slice(1)) { if (r.length < 5) continue; tot++;
  if (g(r,'website') || g(r,'found_site') || g(r,'email') || g(r,'site_email') || g(r,'found_email')) continue;
  res.push([g(r,'record'), g(r,'company'), g(r,'trade'), g(r,'city')].map(qq).join(',')); }
writeFileSync(out, res.join('\n') + '\n');
console.log('total', tot, 'input', res.length - 1);

import { readFileSync, writeFileSync } from 'node:fs';
const parse = (line) => { const o = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const s = new Map(readFileSync('found-sites.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(parse).map((r) => [r[0], r]));
const out = ['record,company,site,email,email_page'];
for (const l of readFileSync('email-raw.csv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) { const [id, email, , page] = parse(l); if (!email) continue; const r = s.get(id); out.push([id, r?.[1], r?.[3], email, page].map(q).join(',')); }
writeFileSync('found-emails.csv', out.join('\n') + '\n'); console.log(out.length - 1, 'emails');

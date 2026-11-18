// Builds what goes up to public_html for Outbox, from the two sources (2026-11-17):
//   <out>/outbox-092b0f/        assistant/outbox/public/* (peak-site.php becomes peak/site.php)
//   <out>/outbox-092b0f/peak/   matthew/peak-pickleball-sponsorship/mail/public/* (the Peak sender) + site.php
//   <out>/peak-mail-31dc56/     assistant/outbox/old-address/* (the forward and the pointers Microsoft and the cron still use)
//   node assistant/outbox/tools/assemble.mjs <out folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OB = path.resolve(HERE, '..');
const PEAK = path.resolve(OB, '..', '..', 'matthew', 'peak-pickleball-sponsorship', 'mail', 'public');
const out = process.argv[2];
if (!out) { console.error('usage: node assemble.mjs <out folder>'); process.exit(2); }
const A = path.join(out, 'outbox-092b0f'), P = path.join(A, 'peak'), O = path.join(out, 'peak-mail-31dc56');
for (const d of [A, P, O]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
const php = d => fs.readdirSync(d).filter(f => f.endsWith('.php'));
for (const f of php(path.join(OB, 'public'))) fs.copyFileSync(path.join(OB, 'public', f), f === 'peak-site.php' ? path.join(P, 'site.php') : path.join(A, f));
for (const f of php(PEAK)) { if (f === 'site.php') throw new Error('the Peak source must not carry a site.php'); fs.copyFileSync(path.join(PEAK, f), path.join(P, f)); }
for (const f of php(path.join(OB, 'old-address'))) fs.copyFileSync(path.join(OB, 'old-address', f), path.join(O, f));
const list = d => fs.readdirSync(d, { recursive: true }).filter(f => fs.statSync(path.join(d, f)).isFile()).sort();
console.log('outbox-092b0f:', list(A).join(' '));
console.log('peak-mail-31dc56:', list(O).join(' '));

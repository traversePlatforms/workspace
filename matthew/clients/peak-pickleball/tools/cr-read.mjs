// Peak Pickleball: read-only CourtReserve API reader (4 Nov 2026; Tyler, Peak's GM, consented to viewing the data with nothing changed).
// GET requests only, by construction: there is no other method in this file. Credentials come from ~/.ssh/peak-courtreserve.json and
// are never printed. Results are saved under matthew/clients/peak-pickleball/data/ (gitignored, laptop only).
// Usage: node cr-read.mjs <endpoint path> [key=value ...] [--out=name]     e.g.  node cr-read.mjs /api/v1/membershiptype/get
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const cred = JSON.parse(readFileSync(join(homedir(), '.ssh', 'peak-courtreserve.json'), 'utf8'));
if (!cred.username || /PASTE/.test(cred.username + cred.password)) { console.error('No credentials in ~/.ssh/peak-courtreserve.json yet.'); process.exit(2); }
const [path, ...rest] = process.argv.slice(2);
if (!path || !/^\/api\/v1\/[a-z]+\/[A-Za-z]+$/.test(path)) { console.error('Give an endpoint like /api/v1/membershiptype/get'); process.exit(2); }
const out = (rest.find((a) => a.startsWith('--out=')) || '').slice(6) || path.split('/').slice(3).join('-');
const qs = new URLSearchParams(rest.filter((a) => !a.startsWith('--') && a.includes('=')).map((a) => a.split(/=(.*)/s).slice(0, 2)));
const url = 'https://api.courtreserve.com' + path + (qs.toString() ? '?' + qs : '');
const auth = 'Basic ' + Buffer.from(cred.username + ':' + cred.password).toString('base64');
let res;
for (let i = 0; i < 4; i++) {
  res = await fetch(url, { method: 'GET', headers: { Authorization: auth, Accept: 'application/json' } });
  if (res.status !== 429) break;
  await new Promise((r) => setTimeout(r, 1000 * (Number(res.headers.get('retry-after')) || 5)));
}
const text = await res.text();
const dir = join(here, '..', 'data', 'courtreserve-api', new Date().toISOString().slice(0, 10)); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, out + '.json'), text);
let n = ''; try { const j = JSON.parse(text); const d = j.Data ?? j.data ?? j; n = Array.isArray(d) ? d.length + ' rows' : typeof d; } catch { n = 'not JSON'; }
console.log(res.status, path, '->', n, '| saved', out + '.json');

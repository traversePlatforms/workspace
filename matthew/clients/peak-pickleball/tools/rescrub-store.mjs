// Peak Pickleball: re-applies the current personal-data scrub (pull-lib.mjs strip) to every CourtReserve file already in the store
// and in dated snapshots. Safe to re-run (the scrub is idempotent). Usage: node rescrub-store.mjs
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PULLS, strip, readGz, writeGz } from './pull-lib.mjs';
let n = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.json.gz') && p.includes('courtreserve')) { writeGz(p, strip(readGz(p))); n++; } } };
walk(PULLS); console.log('rescrubbed', n, 'files');

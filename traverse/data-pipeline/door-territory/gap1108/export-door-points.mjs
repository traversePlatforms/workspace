#!/usr/bin/env node
/* Gap plan 2026-11-08 (Matthew: "I'd like to have every property in Colorado on the list"). Writes every door we have, as
   county \t town \t address \t lat \t lon (no owner names), so the cloud machine can tell which parcels are doors already.
   Reads the Roofing build's door files (traverse-data: every town, 407 on 8 Nov) plus each town's office-lookup file where one
   exists (kind "lookup": homes on file but not on a door list).
   Usage: node export-door-points.mjs <out.tsv> [--root=<traverse folder>]
   ⚑ The output holds home addresses: keep it out of git (scratchpad or the VM). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const ROOT = arg('root', join(HERE, '..', '..', '..'));
const OUT = process.argv[2];
if (!OUT || OUT.startsWith('--')) { console.error('usage: node export-door-points.mjs <out.tsv>'); process.exit(1); }
const R = join(ROOT, 'editions', 'dist', 'traverse-data', 'rounds');
const index = JSON.parse(readFileSync(join(R, 'index.json'), 'utf8')).regions;
const lines = ['kind\tcounty\ttown\taddress\tlat\tlon'];
let doors = 0, lookups = 0;
for (const r of index) {
  if (/^com-/.test(r.key) || r.county === 'comtest') continue;   /* the commercial test towns are not homes */
  for (const [kind, file] of [['door', `${r.key}.json`], ['lookup', `${r.key}-lookup.json`]]) {
    const f = join(R, file); if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, 'utf8'));
    const list = j.areas ? j.areas.flatMap((a) => a.doors || []) : (j.doors || []);   /* lookup files hold one flat doors list */
    for (const d of list) {
      if (!(Math.abs(d.lat) > 0)) continue;
      lines.push([kind, r.county || '', r.key, String(d.address || '').replace(/\t/g, ' '), d.lat, d.lon].join('\t'));
      if (kind === 'door') doors++; else lookups++;
    }
  }
}
writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(`${doors} doors, ${lookups} office-lookup homes -> ${OUT}`);

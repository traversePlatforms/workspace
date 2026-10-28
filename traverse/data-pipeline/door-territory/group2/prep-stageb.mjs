/* Group 2 stage B, step 1 on the cloud machine (2026-10-28, Matthew: "we are almost at a million properties so i wanna hit it").
   From targets.json and the stage A door lists in out/:
     registered.json  { key, label, lat, lon, county } for every target whose list has an owner-lives-here row, EXCEPT g2-berthoud
                      (its Larimer doors were merged into g1-berthoud on 28 Oct and are live there; registering it would list them twice);
     b-towns.txt      the same keys, one per line, in run order;
     <DT>/tree-zones/town-surveys-extra.json   each town's laser key ADDED to the Group 1 entries already there (never replaced):
                      larimer / pueblo (tree-zones/lidar.mjs PROJECT, several surveys for Larimer) and mesa (no survey: canopy map);
     <DT>/group2/registered.json               a copy, for sample-value.mjs and build-rounds-data.mjs.
   Usage: node prep-stageb.mjs <door-territory dir>                                                                                 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = process.argv[2];
if (!DT || !existsSync(join(DT, 'build-rounds-data.mjs'))) throw new Error('usage: node prep-stageb.mjs <door-territory dir>');
const SKIP = new Set(['g2-berthoud']);
const LASER = { Larimer: 'larimer', Pueblo: 'pueblo', Mesa: 'mesa' };
const T = JSON.parse(readFileSync(join(HERE, 'targets.json'), 'utf8'));
const ok = T.filter((t) => {
  if (SKIP.has(t.key)) return false;
  const f = join(HERE, 'out', t.key + '.csv'); if (!existsSync(f)) { console.log('no door list:', t.key); return false; }
  return readFileSync(f, 'utf8').split('\n').some((l) => l.startsWith('"YES"'));
});
const reg = ok.map((t) => ({ key: t.key, label: t.label, lat: t.lat, lon: t.lon, county: t.county }));
writeFileSync(join(HERE, 'registered.json'), JSON.stringify(reg, null, 1));
writeFileSync(join(HERE, 'b-towns.txt'), ok.map((t) => t.key).join('\n') + '\n');
mkdirSync(join(DT, 'group2'), { recursive: true });
writeFileSync(join(DT, 'group2', 'registered.json'), JSON.stringify(reg, null, 1));
const ex = join(DT, 'tree-zones', 'town-surveys-extra.json'), S = existsSync(ex) ? JSON.parse(readFileSync(ex, 'utf8')) : {};
const before = Object.keys(S).length;
for (const t of ok) if (!(t.key in S)) S[t.key] = LASER[t.county];
writeFileSync(ex, JSON.stringify(S));
console.log(`${ok.length} towns registered (g2-berthoud left out); laser keys: ${before} kept + ${Object.keys(S).length - before} added`);

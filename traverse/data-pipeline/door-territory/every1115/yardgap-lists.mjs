#!/usr/bin/env node
/* Stage yardgap's lists (15 Nov 2026): every Colorado door that has NO yard reading at all, per town, as slim door files for
   lawn-trial/yard-v2-town.mjs ({ areas: [{ doors: [{ id, lat, lon }] }] }, the door ids build-rounds-data gives them).
   A door counts as measured when its town's lawn-trial/yard-v2/<town>.json has any entry for its id (a reading, or the "big lot" /
   "shared lot" / no-lot answer: those are not run again), or its built lawn carries y (a promoted rented home measured under
   <town>-lookup/<id>). Exception: a "no lot found" answer (null) is tried again outside the eight address-point counties (their parcels are not
   on the state layer, so no lot line can ever be found there: Montrose, Delta, Las Animas, Alamosa, Conejos, Costilla, Bent, Mineral).
   Left out: Texas metro towns, the commercial test towns, and buildings (hk 'b': no lawn is measured for them).
   Writes <out>/<town>.json, <out>/keys.txt (most owner-lived doors first) and <out>/counts.json (no names).
   Usage (door-territory): node every1115/yardgap-lists.mjs <out dir>                                                                */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const RD = join(HERE, '..', '..', 'app', 'data', 'rounds'), YV = join(HERE, 'lawn-trial', 'yard-v2');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node yardgap-lists.mjs <out dir>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const NOLOTS = /^(Montrose|Delta|Las Animas|Alamosa|Conejos|Costilla|Bent|Mineral|Washington)$/;
const TC = JSON.parse(readFileSync(join(HERE, 'assessor', 'town-county.json'), 'utf8'));
const idx = JSON.parse(readFileSync(join(RD, 'index.json'), 'utf8')).regions;
const keys = []; const tot = { towns: 0, doors: 0, here: 0, away: 0, unk: 0, measured: 0 };
for (const r of idx) {
  if (r.metro || /^com-/.test(r.key) || r.county === 'comtest') continue;
  const f = join(RD, `${r.key}.json`); if (!existsSync(f)) continue;
  const yv = existsSync(join(YV, `${r.key}.json`)) ? (JSON.parse(readFileSync(join(YV, `${r.key}.json`), 'utf8')).doors || {}) : {};
  const doors = []; const c = { here: 0, away: 0, unk: 0 }; const retryNull = !NOLOTS.test(String((TC[r.key] || [''])[0]));
  for (const a of JSON.parse(readFileSync(f, 'utf8')).areas) for (const d of a.doors) {
    if (d.hk === 'b') continue;
    if ((d.id in yv && !(retryNull && yv[d.id] === null)) || (d.lawn && d.lawn.y)) { tot.measured++; continue; }
    if (typeof d.lat !== 'number') continue;
    doors.push({ id: d.id, lat: d.lat, lon: d.lon }); c[d.occ === 'away' || d.occ === 'unk' ? d.occ : 'here']++;
  }
  if (!doors.length) continue;
  writeFileSync(join(OUT, `${r.key}.json`), JSON.stringify({ areas: [{ doors }] }));
  keys.push({ key: r.key, n: doors.length, ...c }); tot.towns++; tot.doors += doors.length; for (const k in c) tot[k] += c[k];
}
keys.sort((a, b) => b.here - a.here || b.n - a.n);
writeFileSync(join(OUT, 'keys.txt'), keys.map((k) => k.key).join('\n') + '\n');
writeFileSync(join(OUT, 'counts.json'), JSON.stringify({ built: new Date().toISOString(), total: tot, towns: keys }, null, 1));
console.log(`never measured: ${tot.doors} doors in ${tot.towns} towns (here ${tot.here}, away ${tot.away}, unk ${tot.unk}); measured already ${tot.measured}`);
console.log('first:', keys.slice(0, 8).map((k) => `${k.key} ${k.n}`).join(', '));

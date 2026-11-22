/* The doors the 22 Nov low-green retune can change (2026-11-22, Matthew: "go ahead and run 1"; CLOUD-JOBS-2026-11-22.md).
   The 'low' knob (yard-scan-v2.mjs V2_1122) only touches lots whose lawn reads under lowMin sq ft with the live setting, so only those
   doors are measured again and every door still ends up read by one method. Read-only on yard-v2/, the door files and the areas lists;
   writes the door lists for the cloud machine in four tiers, so a cut-off still leaves the useful part done:
     t1  owner-lived, within 45 mi of Englewood, card says Check for its lawn (no green, or a range under trees)
     t2  the other Check doors within 45 mi            t3  the other low readings within 45 mi            t4  farther out
     node yard-low-targets.mjs [--lowmin=1200] [--out=yard-low-targets]
   -> <out>/t1..t4/<key>.json  { areas: [{ doors: [{ id, lat, lon }] }] }  (the shape yard-v2-town.mjs reads)  and <out>/summary.json
   Keys are yard-v2's: a town (door ids from app/data/rounds/<town>.json) or <town>-lookup|lookup2|add1115|bld1115 (ids as
   build-rounds-data.mjs gives them: the address slug, 'x' added on a repeat, from door-territory/<key>-areas.json). */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yardLawn, markShared } from './build-yard-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..'), APP = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const LOWMIN = +arg('lowmin', 1200), OUT = join(HERE, arg('out', 'yard-low-targets'));
const ENG = [39.6478, -104.9878];
const miles = (la, lo) => { const R = 3958.8, r = Math.PI / 180, dla = (la - ENG[0]) * r, dlo = (lo - ENG[1]) * r, a = Math.sin(dla / 2) ** 2 + Math.cos(ENG[0] * r) * Math.cos(la * r) * Math.sin(dlo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);   /* build-rounds-data.mjs */
const TIERS = ['t1', 't2', 't3', 't4'];
for (const p of TIERS) mkdirSync(join(OUT, p), { recursive: true });
function doorsOf(key) {   /* id -> { lat, lon, own } */
  const m = new Map(), x = key.match(/^(.*)-(lookup2|lookup|add1115|bld1115)$/);
  if (!x) {
    const df = join(APP, key + '.json'); if (!existsSync(df)) return null;
    for (const a of JSON.parse(readFileSync(df, 'utf8')).areas || []) for (const d of a.doors) m.set(d.id, { lat: d.lat, lon: d.lon, own: d.occ === 'here' });
    return m;
  }
  const af = join(DT, key + '-areas.json'); if (!existsSync(af)) return null;
  const seen = new Set();
  for (const d of JSON.parse(readFileSync(af, 'utf8')).areas.flatMap((a) => a.doors)) {
    let lid = slug(d.a || ''); while (seen.has(lid)) lid += 'x'; seen.add(lid);
    const occ = ['here', 'away', 'unk'].includes(d.occ) ? d.occ : d.rent ? 'away' : 'here';
    m.set(lid, { lat: d.la, lon: d.lo, own: occ === 'here' });
  }
  return m;
}
const sum = { made: new Date().toISOString(), lowMin: LOWMIN, towns: {}, noList: [], total: { target: 0, t1: 0, t2: 0, t3: 0, t4: 0, zero: 0, under300: 0, rng: 0, check: 0, owner: 0, noDoor: 0 } };
for (const f of readdirSync(join(HERE, 'yard-v2')).filter((f) => f.endsWith('.json'))) {
  const key = f.slice(0, -5), doors = markShared(JSON.parse(readFileSync(join(HERE, 'yard-v2', f), 'utf8')).doors || {});
  const byId = doorsOf(key); if (!byId) { sum.noList.push(key); continue; }
  const P = { t1: [], t2: [], t3: [], t4: [] }, T = { target: 0, zero: 0, under300: 0, rng: 0, check: 0, owner: 0, noDoor: 0 };
  for (const [id, v] of Object.entries(doors)) {
    const L = yardLawn(v); if (!L || !(v.l < LOWMIN)) continue;
    const d = byId.get(id); if (!d || typeof d.lat !== 'number') { T.noDoor++; continue; }
    T.target++; if (v.l === 0) T.zero++; if (v.l < 300) T.under300++;
    const rng = !!(L.rng && L.rng[1] > L.rng[0]); if (rng) T.rng++;
    const check = rng || L.lv === 'N' || !L.sq; if (check) T.check++;   /* the card's lawn reasons for Check (lawnEstimate) */
    if (d.own) T.owner++;
    const near = miles(d.lat, d.lon) <= 45;
    P[!near ? 't4' : check && d.own ? 't1' : check ? 't2' : 't3'].push({ id, lat: d.lat, lon: d.lon });
  }
  for (const p of TIERS) if (P[p].length) writeFileSync(join(OUT, p, key + '.json'), JSON.stringify({ areas: [{ doors: P[p] }] }));
  sum.towns[key] = { ...T, t1: P.t1.length, t2: P.t2.length, t3: P.t3.length, t4: P.t4.length };
  for (const k of Object.keys(T)) sum.total[k] += T[k]; for (const p of TIERS) sum.total[p] += P[p].length;
}
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
console.log(JSON.stringify(sum.total), sum.noList.length + ' keys without a door list: ' + sum.noList.slice(0, 10).join(' '));

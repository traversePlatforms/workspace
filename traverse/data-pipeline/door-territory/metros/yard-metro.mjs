// Yard v2 lawn measuring for a metro town outside Colorado (16 Nov 2026, Houston; Matthew: Houston lawn care and aeration).
// The same measurement Colorado's doors get (lawn-trial/yard-scan-v2.mjs yardSources + yardClassify with the V2 settings: the photo's
// green, the laser's tree crowns and roofs, lawn under crowns filled), with three differences:
//   - the lot line comes from the county's own parcel file (metros/out/<town>-lots.json, written by metros/build-doors.mjs), not
//     gis.colorado.gov, so this asks no parcel service at all
//   - the photo years and laser surveys come from metros/<metro>.json "lawn" ({ years, surveys, depth }); no DRCOG land cover
//   - each reading carries py, the year of the photo its green came from, which build-yard-v2.mjs yardLawn uses as yr
// Output lawn-trial/yard-metro/<town>.json, the same shape as lawn-trial/yard-v2/<town>.json; metros/build-lawn.mjs turns a metro's
// readings into lawn-trial/yard-metro/<metro>-lawn.json, which build-rounds-data.mjs lays over the door files.
//   node metros/yard-metro.mjs --metro=hou --town=hou-katy [--mins=60] [--conc=8] [--ids=a,b] [--sample=20] [--pics=<dir>] [--out=<dir>]
//   exit 0 = town finished, 3 = more left. --sample/--ids measure only those doors (a check run: write to --out, not the real folder).
// Env: YV2_DATA (door files, default app/data/rounds), METRO_LOTS (lots folder, default metros/out), LIDAR_CACHE.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yardSources, yardClassify, yardPic, V2 } from '../lawn-trial/yard-scan-v2.mjs';
import { markShared } from '../lawn-trial/build-yard-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const METRO = arg('metro'), TOWN = arg('town'), MINS = +arg('mins', 60), CONC = +arg('conc', 8);
if (!METRO || !TOWN) { console.error('--metro= and --town= needed'); process.exit(1); }
const M = JSON.parse(readFileSync(join(HERE, METRO + '.json'), 'utf8')), LZ = M.lawn || {};
if (!M.towns.some((t) => t.key === TOWN)) { console.error(`no town ${TOWN} in metros/${METRO}.json`); process.exit(1); }
const OPT = { years: LZ.years, surveys: LZ.surveys, depth: LZ.depth, drcog: false, ...(process.env.LIDAR_CACHE ? { lidarCache: process.env.LIDAR_CACHE } : {}) };
const SET = { ...V2, ...(LZ.settings || {}) };
const DATA = process.env.YV2_DATA || join(ROOT, '..', '..', 'app', 'data', 'rounds');
const LOTS = process.env.METRO_LOTS || join(HERE, 'out');
const OUTD = arg('out', join(ROOT, 'lawn-trial', 'yard-metro')); mkdirSync(OUTD, { recursive: true });
const OUT = join(OUTD, `${TOWN}.json`), PICS = arg('pics', '');
if (PICS) mkdirSync(PICS, { recursive: true });
const writeSafe = (f, s) => { writeFileSync(f + '.tmp', s); renameSync(f + '.tmp', f); };
const acres = (ring) => { const k = Math.cos(ring[0][1] * Math.PI / 180) * 111320, m = 110540; let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * k) * (ring[i][1] * m) - (ring[i][0] * k) * (ring[j][1] * m); return Math.abs(a / 2) / 4046.86; };
/* the photo the green came from, by the classifier's own rule (yardClassify late()): a late-summer photo (20 Aug - 30 Sep) wins; if none
   is late, the newer slot (years[0]) is used */
const LATE = /-(08-(2\d|3[01])|09-\d\d)$/;
const photoYear = (R) => { const a = R.photo23, b = R.photo21; const la = a && LATE.test(a), lb = b && LATE.test(b); const d = la || !lb ? a || b : b; return d ? +String(d).slice(0, 4) : null; };

const doors0 = JSON.parse(readFileSync(join(DATA, `${TOWN}.json`), 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon);
const lots = JSON.parse(readFileSync(join(LOTS, `${TOWN}-lots.json`), 'utf8')).lots;
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { built: '', metro: METRO, settings: SET, sources: OPT, doors: {} };
let doors = doors0;
const ids = arg('ids', ''), sample = +arg('sample', 0);
if (ids) doors = doors0.filter((d) => ids.split(',').includes(d.id));
else if (sample) { const st = Math.max(1, Math.floor(doors0.length / sample)); doors = doors0.filter((_, i) => i % st === 0).slice(0, sample); }
const todo = doors.filter((d) => !(d.id in out.doors));
console.log(`${TOWN}: ${doors.length} doors, ${todo.length} to do, ${CONC} at a time (photos ${(OPT.years || []).join('/')}, surveys ${(OPT.surveys || []).join(' ')})`);
if (!todo.length) process.exit(0);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);
async function one(d) {
  const rings = lots[`${d.lat},${d.lon}`];
  if (!rings || !rings.length) { out.doors[d.id] = null; return 'nolot'; }
  const pk = rings[0][0].map((v) => v.toFixed(6)).join(','), lk = createHash('md5').update(JSON.stringify(rings)).digest('hex').slice(0, 16);
  if (acres(rings[0]) > 5) { out.doors[d.id] = { big: 1 }; return 'big'; }
  const S0 = await withTimeout(yardSources(rings, OPT), 180000), R = yardClassify(S0, SET);
  out.doors[d.id] = { l: R.lawn, s: R.seen, u: R.under, o: R.open, t: R.trees, lot: R.lot, sv: R.survey || null, ph: R.photo23 || null, ph2: R.photo21 || null, py: photoYear(R), pk, lk };
  if (PICS) try { yardPic(S0, R, join(PICS, `${d.id}.png`)); } catch {}
  return 'ok';
}
let done = 0, err = 0, nolot = 0; const t0 = Date.now(), q = todo.slice();
const save = () => { out.built = new Date().toISOString().slice(0, 10); writeSafe(OUT, JSON.stringify(out)); };
let last = Date.now();
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let d; (d = q.shift());) {
    if (Date.now() - t0 > MINS * 60000) break;
    try { const r = await one(d); if (r === 'nolot') nolot++; done++; }
    catch (e) { err++; if (err < 20) console.log('  ' + d.id + ': ' + String(e.message).slice(0, 90)); }
    if (Date.now() - last > 60000) { last = Date.now(); save(); console.log(`  ${done} this run · ${(done / ((Date.now() - t0) / 1000)).toFixed(2)} a second · ${err} errors`); }
  }
}));
markShared(out.doors);   /* homes sharing one lot line: the yard is the complex's (build-yard-v2.mjs) */
save();
const left = doors.filter((d) => !(d.id in out.doors)).length;
console.log(`slice done: ${done} (no lot ${nolot}, errors ${err}) in ${((Date.now() - t0) / 60000).toFixed(1)} min; ${left} left`);
process.exit(left ? 3 : 0);

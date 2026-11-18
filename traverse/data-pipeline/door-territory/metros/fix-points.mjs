// Move a built metro's door points to the middle of their own lot (18 Nov 2026, Houston). See metros/lot-centre.mjs for why: the old
// sum in build-doors.mjs put a quarter of the Houston dots outside their lot (median 6.4 m off). build-doors.mjs now uses the fixed sum,
// so a fresh build gives these same points; this moves the towns already built without rebuilding them.
//   node metros/fix-points.mjs <metro> [town ...] [--dry] [--backup=<folder>]
// Per town it rewrites, from the same old point -> new point table, the four places that carry the point:
//   door-territory/<town>.csv (lat, lon), door-territory/<town>-areas.json (la, lo), app/data/rounds/<town>.json (lat, lon), and the keys of
//   metros/out/<town>-lots.json and -parcels.json. Door ids, neighbourhoods, lawn sizes (keyed by door id) and every side file are untouched.
// A town already moved carries "points": "lot-centre" in its lots file and is skipped. --backup copies the five files first.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { areaCentre, insideLot } from './lot-centre.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..'), ROUNDS = join(DT, '..', '..', 'app', 'data', 'rounds');
const args = process.argv.slice(2), DRY = args.includes('--dry'), BK = (args.find((a) => a.startsWith('--backup=')) || '').slice(9);
const [metro, ...only] = args.filter((a) => !a.startsWith('--'));
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
const towns = M.towns.filter((t) => !only.length || only.includes(t.key));
const tot = { towns: 0, doors: 0, moved: 0, inBefore: 0, inAfter: 0, kept: 0 };
for (const T of towns) {
  const fl = join(HERE, 'out', `${T.key}-lots.json`), fp = join(HERE, 'out', `${T.key}-parcels.json`), fc = join(DT, `${T.key}.csv`), fa = join(DT, `${T.key}-areas.json`), fd = join(ROUNDS, `${T.key}.json`);
  if (![fl, fp, fc, fa, fd].every(existsSync)) { console.log(`${T.key}: not built, skipped`); continue; }
  const L = JSON.parse(readFileSync(fl, 'utf8'));
  if (L.points === 'lot-centre') { console.log(`${T.key}: already moved`); continue; }
  /* the table: old key -> new point, never two lots on one point (a clash keeps the old point) */
  const to = new Map(), used = new Set();
  for (const [k, rings] of Object.entries(L.lots)) {
    const c = areaCentre(rings, T.center[0]);
    let nk = k, p = null;
    if (c) { const lat = +c.lat.toFixed(6), lon = +c.lon.toFixed(6); nk = `${lat},${lon}`; p = [lat, lon]; }
    if (used.has(nk) || !p) { nk = k; p = k.split(',').map(Number); tot.kept++; }
    used.add(nk); to.set(k, { k: nk, lat: p[0], lon: p[1] });
  }
  const mv = (k) => to.get(k);
  /* lots and parcels: same values, new keys */
  const lots = {}; for (const [k, v] of Object.entries(L.lots)) lots[mv(k).k] = v;
  const P = JSON.parse(readFileSync(fp, 'utf8')); const pd = {}; let pMiss = 0;
  for (const [k, v] of Object.entries(P.doors)) { const n = mv(k); if (!n) pMiss++; pd[n ? n.k : k] = v; }
  /* the CSV: the last two columns */
  const lines = readFileSync(fc, 'utf8').split('\n'); let cMiss = 0;
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const m = lines[i].match(/^(.*),"(-?[\d.]+)","(-?[\d.]+)"$/); if (!m) { cMiss++; continue; }
    const n = mv(`${+m[2]},${+m[3]}`); if (!n) { cMiss++; continue; }
    lines[i] = `${m[1]},"${n.lat.toFixed(6)}","${n.lon.toFixed(6)}"`;
  }
  /* the areas file and the door file */
  const A = JSON.parse(readFileSync(fa, 'utf8')); let aMiss = 0;
  for (const a of A.areas) for (const d of a.doors) { const n = mv(`${d.la},${d.lo}`); if (!n) { aMiss++; continue; } d.la = n.lat; d.lo = n.lon; }
  const D = JSON.parse(readFileSync(fd, 'utf8')); let dMiss = 0, n0 = 0, moved = 0, inB = 0, inA = 0;
  for (const a of D.areas) for (const d of a.doors) {
    n0++; const k = `${d.lat},${d.lon}`, n = mv(k); if (!n) { dMiss++; continue; }
    const rings = L.lots[k]; if (insideLot(d.lon, d.lat, rings)) inB++; if (insideLot(n.lon, n.lat, rings)) inA++;
    if (n.k !== k) moved++; d.lat = n.lat; d.lon = n.lon;
  }
  const miss = pMiss + cMiss + aMiss + dMiss;
  console.log(`${T.key}: ${n0} doors, ${moved} moved, inside their lot ${inB} -> ${inA}` + (miss ? `  MISSING csv ${cMiss} areas ${aMiss} doors ${dMiss} parcels ${pMiss}` : ''));
  if (miss) { console.log(`${T.key}: not written (a point had no lot)`); continue; }
  tot.towns++; tot.doors += n0; tot.moved += moved; tot.inBefore += inB; tot.inAfter += inA;
  if (DRY) continue;
  if (BK) { const b = join(BK, T.key); mkdirSync(b, { recursive: true }); for (const f of [fl, fp, fc, fa, fd]) copyFileSync(f, join(b, f.split(/[\\/]/).pop())); }
  L.lots = lots; L.points = 'lot-centre'; P.doors = pd; P.points = 'lot-centre';
  writeFileSync(fl, JSON.stringify(L)); writeFileSync(fp, JSON.stringify(P)); writeFileSync(fc, lines.join('\n'));
  writeFileSync(fa, JSON.stringify(A)); writeFileSync(fd, JSON.stringify(D));
}
console.log(JSON.stringify(tot));

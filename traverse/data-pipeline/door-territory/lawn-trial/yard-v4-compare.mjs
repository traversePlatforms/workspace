/* Before/after for the 22 Nov low-green re-measure (CLOUD-JOBS-2026-11-22.md). Read-only: yard-v2/ (live readings, before) against
   yard-v4/ (the cloud machine's re-measure, copied back by overnight/lawn1122/pull-lawn1122.sh), for the doors in yard-low-targets/.
   The card's lawn reasons for "Check before quoting" are worked out the way the page does (lawnEstimate): no green (N, or no size) or a
   range under trees. Other Check reasons (built after the photo, no tree reading on old figures) are not lawn readings and do not change.
     node yard-v4-compare.mjs   -> yard-v4/compare.json (per town; the biggest jumps with door ids: never in a public file) + tables  */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yardLawn, markShared } from './build-yard-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(join(HERE, 'yard-low-targets', 'summary.json'), 'utf8'));
const tierOf = {};
for (const t of ['t1', 't2', 't3', 't4']) for (const f of readdirSync(join(HERE, 'yard-low-targets', t))) {
  const k = f.slice(0, -5); for (const d of JSON.parse(readFileSync(join(HERE, 'yard-low-targets', t, f), 'utf8')).areas[0].doors) (tierOf[k] ||= {})[d.id] = t;
}
const isCheck = (L) => !L || L.lv === 'N' || !L.sq || !!(L.rng && L.rng[1] > L.rng[0]);
const card = (L) => (L ? (L.rng ? (L.rng[0] + L.rng[1]) / 2 : L.sq) : 0);
const S = { keys: 0, doors: 0, lowUsed: 0, checkBefore: 0, checkAfter: 0, t1: { doors: 0, checkBefore: 0, checkAfter: 0 }, near: { doors: 0, checkBefore: 0, checkAfter: 0 },
  lv: { before: {}, after: {} }, gain: [], zeroBefore: 0, zeroAfter: 0, notYet: 0 };
const jumps = [], per = {};
for (const f of existsSync(join(HERE, 'yard-v4')) ? readdirSync(join(HERE, 'yard-v4')).filter((f) => f.endsWith('.json') && f !== 'compare.json') : []) {
  const key = f.slice(0, -5), nw = JSON.parse(readFileSync(join(HERE, 'yard-v4', f), 'utf8')).doors || {};
  const old = markShared(JSON.parse(readFileSync(join(HERE, 'yard-v2', f), 'utf8')).doors || {});
  const P = { doors: 0, checkBefore: 0, checkAfter: 0 }; S.keys++;
  for (const [id, v] of Object.entries(nw)) {
    const o = old[id]; if (!o || !v || typeof v.l !== 'number') continue;
    const t = (tierOf[key] || {})[id]; if (!t) continue;
    if (v.lw && v.lot >= 43560) { S.acreKept = (S.acreKept || 0) + 1; continue; }   /* lowMaxLot: acreage keeps its live reading (merge-yard-v4.mjs) */
    const v1 = { ...v }; delete v1.shared;   /* the subset run's own shared marks are redone at build time over the whole town */
    const Lo = yardLawn(o), Ln = yardLawn(o.shared ? { ...v1, shared: o.shared } : v1); if (!Lo) continue;
    S.doors++; P.doors++; if (v.lw) S.lowUsed++;
    const cb = isCheck(Lo), ca = isCheck(Ln);
    if (cb) { S.checkBefore++; P.checkBefore++; } if (ca) { S.checkAfter++; P.checkAfter++; }
    if (t === 't1') { S.t1.doors++; if (cb) S.t1.checkBefore++; if (ca) S.t1.checkAfter++; }
    if (t !== 't4') { S.near.doors++; if (cb) S.near.checkBefore++; if (ca) S.near.checkAfter++; }
    S.lv.before[Lo.lv] = (S.lv.before[Lo.lv] || 0) + 1; if (Ln) S.lv.after[Ln.lv] = (S.lv.after[Ln.lv] || 0) + 1;
    if (!Lo.sq) S.zeroBefore++; if (Ln && !Ln.sq) S.zeroAfter++;
    const g = card(Ln) - card(Lo); S.gain.push(g);
    jumps.push({ key, id, before: card(Lo), after: card(Ln), lot: v.lot, open: v.o, lvB: Lo.lv, lvA: Ln && Ln.lv, gain: g });
  }
  per[key] = P;
}
for (const k of Object.keys(T.towns)) if (!per[k]) S.notYet += (T.towns[k].target || 0);
S.gain.sort((a, b) => a - b);
const q = (p) => (S.gain.length ? S.gain[Math.floor((S.gain.length - 1) * p)] : null);
const gainQ = { p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), max: q(1) };
jumps.sort((a, b) => b.gain - a.gain);
const overOpen = jumps.filter((j) => j.after > j.open).length;
delete S.gain;
writeFileSync(join(HERE, 'yard-v4', 'compare.json'), JSON.stringify({ made: new Date().toISOString(), S, gainQ, overOpen, per, top: jumps.slice(0, 40) }, null, 1));
console.log(JSON.stringify({ ...S, gainQ, overOpen }, null, 1));
console.log('biggest jumps (town, card before -> after, lot sq ft):');
for (const j of jumps.slice(0, 12)) console.log(`  ${j.key.padEnd(24)} ${String(j.before).padStart(6)} -> ${String(j.after).padStart(6)}  lot ${j.lot}  open ${j.open}  ${j.lvB}->${j.lvA}`);

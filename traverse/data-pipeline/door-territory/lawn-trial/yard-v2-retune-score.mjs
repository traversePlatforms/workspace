/* Scores the yard v2 retune grid (yard-v2-retune.mjs) against the hand measures (2026-11-11). Read-only.
   Rule fixed before looking at HOLD: the variant (settings x a flat multiplier 1.0-1.3 on the card figure) is picked on the 19 TUNE lots
   by the mean absolute log miss of the card figure (a zero card counts as 100 sq ft); HOLD (the 7 lots measured since 30 Oct) is only
   read afterwards. The change is worth making only if the pick also beats V2 on HOLD. A leave-one-out pass over all 26 lots (pick on 25,
   score the one left out) is the second check.
     node yard-v2-retune-score.mjs   -> yard-v2-retune-score-2026-11-11.json + tables on stdout                                     */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const J = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const parts = ['./yard-v2-retune-2026-11-11.json', './yard-v2-retune-2026-11-11.part0.json', './yard-v2-retune-2026-11-11.part1.json'].filter((f) => existsSync(new URL(f, import.meta.url))).map(J);
const KEY = parts[0].key, V2N = parts[0].v2, res = parts.flatMap((p) => p.res);
const MULTS = [1, 1.1, 1.2, 1.3];
const r100 = (x) => Math.round(x / 100) * 100;
const variants = [];
for (const r of res) for (const m of MULTS) variants.push({ name: r.name + (m === 1 ? '' : ` x${m}`), base: r.name, m, v: r.v, lots: r.lots });
const lots = KEY.map(([a, hand, set, note]) => ({ a, hand, set, note }));
const cardOf = (V, a) => { const x = V.lots[a]; return x && x.card != null ? r100(x.card * V.m) : null; };
const lerr = (c, h) => Math.abs(Math.log(Math.max(c, 100) / h));
const med = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function score(V, set) {
  const e = [], s = [], le = [];
  for (const L of set) { const c = cardOf(V, L.a); if (c == null) continue; const m = (c - L.hand) / L.hand; e.push(Math.abs(m)); s.push(m); le.push(lerr(c, L.hand)); }
  return { n: e.length, medAbs: med(e), lean: med(s), within25: e.filter((x) => x <= 0.25).length, meanLog: le.reduce((a, b) => a + b, 0) / le.length, worst: s.reduce((w, x) => (Math.abs(x) > Math.abs(w) ? x : w), 0) };
}
const TUNE = lots.filter((l) => l.set === 'tune'), HOLD = lots.filter((l) => l.set === 'hold');
const v2 = variants.find((V) => V.name === V2N);
if (!v2) throw new Error('V2 not in the grid: ' + V2N);
const ranked = variants.map((V) => ({ V, t: score(V, TUNE) })).sort((a, b) => a.t.meanLog - b.t.meanLog);
const pick = ranked[0].V;
const pc = (x) => (x == null ? '-' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%');
const line = (lab, s) => `${lab.padEnd(44)} n=${s.n}  median miss ${pc(s.medAbs).replace('+', '')}  lean ${pc(s.lean)}  within 25%: ${s.within25}/${s.n}  mean log ${s.meanLog.toFixed(3)}  worst ${pc(s.worst)}`;
console.log('variants scored:', variants.length, '\nV2 =', V2N, '\npick (on TUNE) =', pick.name, '\n');
for (const [lab, set] of [['TUNE (19, picked on)', TUNE], ['HOLD (7, measured since 30 Oct)', HOLD], ['ALL (26)', lots]]) {
  console.log(lab); console.log(line('  V2 (live)', score(v2, set))); console.log(line('  pick', score(pick, set)));
}
console.log('\ntop 10 on TUNE, with HOLD:');
for (const { V, t } of ranked.slice(0, 10)) { const h = score(V, HOLD); console.log(`  ${V.name.padEnd(40)} tune ${pc(t.medAbs).replace('+', '')} (${t.meanLog.toFixed(3)})  hold ${pc(h.medAbs).replace('+', '')} (${h.meanLog.toFixed(3)}) w25 ${h.within25}/${h.n}`); }
/* the best possible on HOLD, for scale only (not a fair pick) */
const bestHold = variants.map((V) => ({ V, h: score(V, HOLD) })).sort((a, b) => a.h.meanLog - b.h.meanLog)[0];
console.log('\n(for scale only, best on HOLD itself:', bestHold.V.name, pc(bestHold.h.medAbs), bestHold.h.meanLog.toFixed(3) + ')');
/* leave-one-out over all 26 */
const loo = [];
for (const L of lots) {
  const rest = lots.filter((x) => x !== L), best = variants.map((V) => ({ V, s: score(V, rest).meanLog })).sort((a, b) => a.s - b.s)[0].V;
  const c = cardOf(best, L.a), c2 = cardOf(v2, L.a);
  loo.push({ a: L.a, set: L.set, hand: L.hand, pick: best.name, card: c, v2: c2, miss: (c - L.hand) / L.hand, missV2: (c2 - L.hand) / L.hand });
}
const looS = { n: loo.length, medAbs: med(loo.map((x) => Math.abs(x.miss))), medAbsV2: med(loo.map((x) => Math.abs(x.missV2))), w25: loo.filter((x) => Math.abs(x.miss) <= 0.25).length, w25V2: loo.filter((x) => Math.abs(x.missV2) <= 0.25).length,
  meanLog: loo.reduce((a, x) => a + lerr(x.card, x.hand), 0) / loo.length, meanLogV2: loo.reduce((a, x) => a + lerr(x.v2, x.hand), 0) / loo.length,
  closer: loo.filter((x) => Math.abs(x.miss) < Math.abs(x.missV2)).length, worse: loo.filter((x) => Math.abs(x.miss) > Math.abs(x.missV2)).length };
console.log(`\nleave-one-out (26): median miss ${pc(looS.medAbs)} vs V2 ${pc(looS.medAbsV2)}; within 25% ${looS.w25} vs ${looS.w25V2}; mean log ${looS.meanLog.toFixed(3)} vs ${looS.meanLogV2.toFixed(3)}; closer on ${looS.closer}, further on ${looS.worse}`);
const picks = {}; for (const x of loo) picks[x.pick] = (picks[x.pick] || 0) + 1; console.log('LOO picks:', JSON.stringify(picks));
console.log('\nper lot (card figure): hand | V2 | pick');
for (const L of lots) { const a = cardOf(v2, L.a), b = cardOf(pick, L.a); console.log(`  ${L.set} ${L.a.padEnd(24)} ${String(L.hand).padStart(6)} ${String(a).padStart(6)} ${pc((a - L.hand) / L.hand).padStart(5)} ${String(b).padStart(6)} ${pc((b - L.hand) / L.hand).padStart(5)}  ${L.note}`); }
writeFileSync(new URL('./yard-v2-retune-score-2026-11-11.json', import.meta.url), JSON.stringify({ made: '2026-11-11', v2: V2N, pick: pick.name, pickSettings: pick.v, pickMult: pick.m,
  tune: { v2: score(v2, TUNE), pick: score(pick, TUNE) }, hold: { v2: score(v2, HOLD), pick: score(pick, HOLD) }, all: { v2: score(v2, lots), pick: score(pick, lots) },
  top10: ranked.slice(0, 10).map(({ V, t }) => ({ name: V.name, tune: t, hold: score(V, HOLD) })), loo, looS,
  perLot: lots.map((L) => ({ ...L, v2: cardOf(v2, L.a), pick: cardOf(pick, L.a), v2raw: v2.lots[L.a], pickRaw: pick.lots[L.a] })) }, null, 1));

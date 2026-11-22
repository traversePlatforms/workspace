/* Yard v2 retune against every hand measure (2026-11-11, Matthew: "better lawn sizes"). Read-only: writes only its own result files.
   Lots: the 19 whole-property hand measures of the 29 Oct re-score (TUNE: settings are picked on these) and the 7 measured since
   (HOLD: 567 E 77th Pl 30 Oct, 651 Potomac St (Jen), 9819 Meade Cir, 449 S Stuart St, 9635 Newcastle Dr, 3184 S Nepal Way,
   1730 S Rooney Rd; never used to pick anything). A variant only counts as better if it also beats V2 on HOLD.
   Every variant is scored on the card figure (build-yard-v2.mjs yardLawn: rounded to 100, the middle of the range on T lots).
     node yard-v2-retune.mjs            -> yard-v2-retune-2026-11-11.json (every variant x lot) and the summary on stdout
   22 Nov 2026 (Matthew: "go ahead and run 1", the lawn accuracy pass before the cloud credit ends): the 26 lots above are all TUNE now
   (the 7 were read once on 11 Nov to decide that change, so they are no longer unseen) and HOLD is Jen's 11 hand measures of 13-20 Nov
   (hand-logs.mjs; 11321 Dransfeldt Rd, 13 ac, is over the 5-acre limit and has no reading). New knob 'low' (yard-scan-v2.mjs): a second,
   lower green line for lots that read under lowMin sq ft. The 'edge' knob (never helped on 11 Nov) is dropped from the grid.
     node yard-v2-retune.mjs [--shard=i/n]   -> yard-v2-retune-2026-11-22[.part<i>].json                                            */
import { readFileSync, writeFileSync } from 'node:fs';
import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
import { yardLawn } from './build-yard-v2.mjs';
const J = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const LOTS = { ...J('./yard-key-parcels.json'), ...J('./yard-rescore-parcels.json'), ...J('./yard-retune-parcels.json') };
/* [address, hand sq ft, set, note] */
const KEY = [
  ['3855 S VALENTIA CT', 8111, 'tune', 'whole incl. beds'], ['11663 SETTLERS DR', 10473, 'tune', 'Jen'], ['2787 RUSSET SKY CT', 3898, 'tune', ''],
  ['1648 MARSH HAWK CIR', 2344, 'tune', ''], ['7378 UPTON CT', 2595, 'tune', 'acreage, watered only'], ['6595 ZINNIA ST', 3225, 'tune', ''],
  ['3247 OAK LEAF PL', 2556, 'tune', 'grass only'], ['7006 E 131ST WAY', 2137, 'tune', ''], ['7614 E 121ST PL', 2961, 'tune', ''],
  ['579 E 76TH AVE', 3613, 'tune', 'open, maybe newer lawn'], ['3852 PRIMROSE LN', 3461, 'tune', ''], ['6049 W ROXBURY PL', 3131, 'tune', 'heavy trees'],
  ['6916 S ELATI ST', 2554, 'tune', 'heavy canopy'], ['600 HIDDENBROOK CT', 2231, 'tune', ''], ['9267 CANYON WREN CT', 4637, 'tune', ''],
  ['852 HUGHES LN', 1385, 'tune', 'rough'], ['9416 DESERT WILLOW TRL', 1473, 'tune', ''], ['2195 E NICHOLS DR', 3035, 'tune', 'one big tree'],
  ['9353 PIKE WAY', 1880, 'tune', ''],
  ['567 E 77TH PL', 2229, 'hold', '30 Oct, incl. dark side strip'], ['651 POTOMAC ST', 7100, 'hold', 'Jen, 3.1 ac'],
  ['9819 MEADE CIR', 4330, 'hold', 'incl. evergreen piece'], ['449 S STUART ST', 1942, 'hold', 'front all under one crown'],
  ['9635 NEWCASTLE DR', 2594, 'hold', ''], ['3184 S NEPAL WAY', 2022, 'hold', 'newer street'], ['1730 S ROONEY RD', 11233, 'hold', '2.86 ac, main block'],
  /* 22 Nov: Jen's (Google Earth, grass under trees too), 13-20 Nov; HOLD for this run */
  ['6359 REED ST', 3500, 'hold2', 'Jen'], ['18753 W 94TH LN', 950, 'hold2', 'Jen; live reads 0'], ['8218 BALSAM WAY', 3400, 'hold2', 'Jen'],
  ['12847 W 78TH CIR', 2265, 'hold2', 'Jen'], ['5833 S PARIS CT', 6200, 'hold2', 'Jen'], ['5042 N SCRANTON ST', 2000, 'hold2', 'Jen'],
  ['10743 ROUTT CT', 4925, 'hold2', 'Jen'], ['2006 S IRONTON CT', 1500, 'hold2', 'Jen'], ['1658 CHELMSFORD CT WINDSOR', 5000, 'hold2', 'Jen'],
  ['1388 NORTH VIEW DR ERIE', 3000, 'hold2', 'Jen'], ['1533 S GRAND BAKER ST', 2300, 'hold2', 'Jen'],
  ['11321 DRANSFELDT RD', 32500, 'none', 'Jen; 13 ac, over the 5-acre limit: no yard v2 reading'],
];
/* the run's sets: 22 Nov tunes on everything up to 11 Nov ('tune' + 'hold') and holds out 'hold2' */
const RUN = '2026-11-22';
for (const k of KEY) k[2] = k[2] === 'hold2' ? 'hold' : k[2] === 'none' ? 'none' : 'tune';
const keyOf = (a) => (LOTS[a] && LOTS[a].cacheKey) || a.toLowerCase().replace(/\W+/g, '-');
const SRC = {};
for (const [a, , set] of KEY) { if (set === 'none') continue; if (!LOTS[a]) { console.error(a + ': no lot line'); continue; } SRC[a] = await yardSources(LOTS[a].rings, { key: keyOf(a) }); }
if (process.argv.includes('--sources')) { console.error('sources ready for', Object.keys(SRC).length, 'lots'); process.exit(0); }

/* the grid: one knob at a time round V2, then the pairs that look useful (kept small: 26 lots cannot carry many free settings) */
const grid = [];
const LOWS = [{ low: null }]; for (const low of [0.28, 0.25, 0.22, 0.18]) for (const lowMin of [300, 1200]) for (const lowSpeck of [null, 2]) LOWS.push({ low, lowMin, lowSpeck });
for (const ndvi of [0.30, 0.33, 0.36]) for (const speck of [3, 4, 5]) for (const fill of [12, 16, 20]) for (const house of [25, 35]) for (const roofBuf of [1, 2])
  for (const L of LOWS) grid.push({ ...V2, ndvi, speck, fill, house, roofBuf, ...L });
const name = (v) => `n${v.ndvi ?? 0.36} s${v.speck} f${v.fill} h${v.house} rb${v.roofBuf}` + (v.edge == null ? '' : ` e${v.edge}x${v.edgeIter}`) + (v.low == null ? '' : ` low${v.low}<${v.lowMin}${v.lowSpeck == null ? '' : 'sp' + v.lowSpeck}`);
const cardNum = (L) => (L ? (L.rng ? (L.rng[0] + L.rng[1]) / 2 : L.sq) : null);
const SH = (process.argv.find((a) => a.startsWith('--shard=')) || '--shard=0/1').slice(8).split('/').map(Number);   /* --shard=i/n: every n-th variant, for parallel runs */
const t0 = Date.now(), res = [];
for (let gi = 0; gi < grid.length; gi++) {
  if (gi % SH[1] !== SH[0]) continue;
  const v = grid[gi], row = { name: name(v), v, lots: {} };
  for (const [a] of KEY) {
    if (!SRC[a]) continue;
    const W = yardClassify(SRC[a], v);
    const L = yardLawn({ l: W.lawn, s: W.seen, u: W.under, o: W.open, t: W.trees, lot: W.lot, ph: W.photo23 });
    row.lots[a] = { l: W.lawn, s: W.seen, u: W.under, o: W.open, t: W.trees, lot: W.lot, card: cardNum(L), lv: L && L.lv, rng: L && L.rng, lowUsed: W.lowUsed || 0 };
  }
  res.push(row);
  if (gi % 50 === 0) console.error(gi + '/' + grid.length, Math.round((Date.now() - t0) / 1000) + ' s');
}
writeFileSync(new URL(SH[1] > 1 ? `./yard-v2-retune-${RUN}.part${SH[0]}.json` : `./yard-v2-retune-${RUN}.json`, import.meta.url), JSON.stringify({ made: RUN, key: KEY, v2: name(V2), res }));
console.error('done', Math.round((Date.now() - t0) / 1000) + ' s');

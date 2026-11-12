/* Yard v2 retune against every hand measure (2026-11-11, Matthew: "better lawn sizes"). Read-only: writes only its own result files.
   Lots: the 19 whole-property hand measures of the 29 Oct re-score (TUNE: settings are picked on these) and the 7 measured since
   (HOLD: 567 E 77th Pl 30 Oct, 651 Potomac St (Jen), 9819 Meade Cir, 449 S Stuart St, 9635 Newcastle Dr, 3184 S Nepal Way,
   1730 S Rooney Rd; never used to pick anything). A variant only counts as better if it also beats V2 on HOLD.
   Every variant is scored on the card figure (build-yard-v2.mjs yardLawn: rounded to 100, the middle of the range on T lots).
     node yard-v2-retune.mjs            -> yard-v2-retune-2026-11-11.json (every variant x lot) and the summary on stdout          */
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
];
const keyOf = (a) => (LOTS[a] && LOTS[a].cacheKey) || a.toLowerCase().replace(/\W+/g, '-');
const SRC = {};
for (const [a] of KEY) { if (!LOTS[a]) { console.error(a + ': no lot line'); continue; } SRC[a] = await yardSources(LOTS[a].rings, { key: keyOf(a) }); }

/* the grid: one knob at a time round V2, then the pairs that look useful (kept small: 26 lots cannot carry many free settings) */
const grid = [];
for (const ndvi of [0.30, 0.33, 0.36]) for (const speck of [3, 4, 5]) for (const fill of [12, 16, 20]) for (const house of [25, 35])
  for (const edge of [null, 0.2, 0.25, 0.3]) for (const edgeIter of edge == null ? [1] : [1, 2, 4]) for (const roofBuf of [1, 2])
    grid.push({ ...V2, ndvi, speck, fill, house, edge, edgeIter, roofBuf });
const name = (v) => `n${v.ndvi ?? 0.36} s${v.speck} f${v.fill} h${v.house} rb${v.roofBuf}` + (v.edge == null ? '' : ` e${v.edge}x${v.edgeIter}`);
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
    row.lots[a] = { l: W.lawn, s: W.seen, u: W.under, o: W.open, t: W.trees, lot: W.lot, card: cardNum(L) };
  }
  res.push(row);
  if (gi % 50 === 0) console.error(gi + '/' + grid.length, Math.round((Date.now() - t0) / 1000) + ' s');
}
writeFileSync(new URL(SH[1] > 1 ? `./yard-v2-retune-2026-11-11.part${SH[0]}.json` : './yard-v2-retune-2026-11-11.json', import.meta.url), JSON.stringify({ made: '2026-11-11', key: KEY, v2: name(V2), res }));
console.error('done', Math.round((Date.now() - t0) / 1000) + ' s');

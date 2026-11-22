/* Lot lines for the hand measures made since the 29 Oct re-score (2026-11-11), so yard-v2-retune.mjs can score them.
   One point query per lot on the state parcel layer at the door's map point (lotFor in yard-scan-v2.mjs), six lots on 11 Nov, eleven more on
   22 Nov (Jen's, 13-20 Nov);
   1730 S Rooney Rd's lot line is already inside its cached sources (yard-v2-cache/rooney-1730.json).
     node yard-retune-parcels.mjs   -> yard-retune-parcels.json { ADDRESS: { rings } }                                        */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { lotFor } from './yard-scan-v2.mjs';
const OUT = new URL('./yard-retune-parcels.json', import.meta.url);
const LOTS = [['567 E 77TH PL', 'welby'], ['9819 MEADE CIR', 'westminster'], ['449 S STUART ST', 'denver'], ['3184 S NEPAL WAY', 'aurora'],
  ['651 POTOMAC ST', 'aurora'], ['9635 NEWCASTLE DR', 'highlands-ranch'],
  /* 22 Nov 2026: Jen's hand measures of 13-20 Nov (hand-logs.mjs: not in the KEY yet); 11321 Dransfeldt Rd (13 ac) is over yard v2's 5-acre
     limit, so it has no reading to score and is left out */
  ['6359 REED ST', 'arvada'], ['18753 W 94TH LN', 'arvada'], ['8218 BALSAM WAY', 'arvada'], ['12847 W 78TH CIR', 'arvada'],
  ['5833 S PARIS CT', 'cherry-creek'], ['5042 N SCRANTON ST', 'denver'], ['10743 ROUTT CT', 'westminster'], ['2006 S IRONTON CT', 'aurora'],
  ['1658 CHELMSFORD CT WINDSOR', 'windsor'], ['1388 NORTH VIEW DR ERIE', 'erie'], ['1533 S GRAND BAKER ST', 'aurora']];
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
for (const [a, t] of LOTS) {
  if (out[a]) continue;
  const rings = await lotFor(a, t);
  console.log(a, t, rings ? rings.length + ' ring(s), ' + rings[0].length + ' points' : 'NO LOT');
  if (rings) out[a] = { town: t, rings };
  await new Promise((ok) => setTimeout(ok, 1500));
}
const R = JSON.parse(readFileSync(new URL('./yard-v2-cache/rooney-1730.json', import.meta.url), 'utf8'));
out['1730 S ROONEY RD'] = { town: 'looked-up', rings: R.rings, cacheKey: 'rooney-1730' };
writeFileSync(OUT, JSON.stringify(out));

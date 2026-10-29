/* Checks the owner history the build runs (owner-names.mjs recordOwner), 2026-10-29. No real names: made-up owners only.
   Run: node owner-history-test.mjs                                                                                       */
import { recordOwner, historyKey, isSale } from './owner-names.mjs';

let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

/* 1. the same street address in two towns: never a sale, however many rebuilds */
{
  const h = {};
  for (const day of ['2026-10-01', '2026-10-02', '2026-10-03']) {
    const a = recordOwner(h, 'plano', '100-main-st', 'ALPHA ANN', day);
    const b = recordOwner(h, 'longmont', '100-main-st', 'BRAVO BOB', day);
    ok(!a.sale && !b.sale && !a.os && !b.os, `same address, two towns, build ${day}: no flag`);
  }
  ok(Object.keys(h).length === 2 && h[historyKey('plano', '100-main-st')] && h[historyKey('longmont', '100-main-st')], 'two entries, one per town');
}

/* 2. a real sale in one town still flags, and keeps its dates on later builds */
{
  const h = {};
  recordOwner(h, 'longmont', '7-elm-ct', 'CHARLIE CAROL', '2026-07-01');
  const s = recordOwner(h, 'longmont', '7-elm-ct', 'DELTA DAN', '2026-10-01');
  ok(s.sale && s.os === '2026-10-01' && s.oa === '2026-05-17', 'real sale flags: os = build day, oa = last sighting - 45 days');
  const again = recordOwner(h, 'longmont', '7-elm-ct', 'DELTA DAN', '2027-01-05');
  ok(!again.sale && again.os === '2026-10-01', 'next rebuild: not a second sale, flag kept');
  const other = recordOwner(h, 'plano', '7-elm-ct', 'ECHO EVE', '2027-01-05');
  ok(!other.sale && !other.os, 'same address in another town is not touched by it');
}

/* 3. not a sale: a spouse added, a move into a trust */
{
  const h = {};
  recordOwner(h, 'erie', '9-oak-dr', 'FOXTROT FRED', '2026-09-01');
  ok(!recordOwner(h, 'erie', '9-oak-dr', 'FOXTROT FRED & GOLF GINA', '2026-10-01').sale, 'spouse added: no flag');
  ok(!recordOwner(h, 'erie', '9-oak-dr', 'FOXTROT FAMILY TRUST', '2026-11-01').sale, 'family trust: no flag');
}

/* 4. the name rule itself */
ok(isSale('HOTEL HAL', 'INDIA IVY') && !isSale('HOTEL HAL', 'HAL HOTEL REVOCABLE TRUST'), 'isSale: different names yes, same names reworded no');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

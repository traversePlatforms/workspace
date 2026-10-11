// The county's own per-door facts for a metro town (the metro builder, 2026-10-11), from metros/out/<town>-parcels.json:
//   --values   before the town files are built: market value into value-cache.json (build-rounds-data puts it on the door)
//   --years    after: year-<town>.json in app/data/rounds ({yb, bsf} per door id, the shape assessor/build-year.mjs writes)
//   node metros/county-data.mjs <town> --values | --years
import { readFileSync, writeFileSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { metroOf } from './registry.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..'), DATA = join(ROOT, '..', '..', 'app', 'data', 'rounds');
const town = process.argv[2]; const M = metroOf(town); if (!M) throw new Error('no metro lists ' + town);
const P = JSON.parse(readFileSync(join(HERE, 'out', `${town}-parcels.json`), 'utf8')).doors;
if (process.argv.includes('--values')) {
  const f = join(ROOT, 'value-cache.json'); const cache = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  const A = JSON.parse(readFileSync(join(ROOT, `${town}-areas.json`), 'utf8'));
  let n = 0;
  for (const a of A.areas) for (const d of a.doors) { const p = P[`${d.la},${d.lo}`]; if (p && p.value > 0) { cache[`${d.la},${d.lo}`] = { v: p.value, d: `${p.valueYear || new Date().getFullYear()}-01-01` }; n++; } }
  writeFileSync(f, JSON.stringify(cache)); console.log(`${town}: ${n} values into value-cache.json`);
}
if (process.argv.includes('--years')) {
  const R = JSON.parse(readFileSync(join(DATA, `${town}.json`), 'utf8')); const doors = {}; let n = 0;
  for (const a of R.areas) for (const d of a.doors) { const p = P[`${d.lat},${d.lon}`]; if (p && (p.yb || p.sqft)) { doors[d.id] = { ...(p.yb ? { yb: p.yb } : {}), ...(p.sqft ? { bsf: p.sqft } : {}) }; n++; } }
  writeFileSync(join(DATA, `year-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), county: M.sources[M.towns.find((t) => t.key === town).county].label, doors }));
  console.log(`${town}: year built / house size on ${n} doors -> year-${town}.json`);
}

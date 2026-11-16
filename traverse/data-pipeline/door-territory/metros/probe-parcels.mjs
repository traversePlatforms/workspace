// Before trusting a parcel source for a new market: how many parcels a town has, how many look residential, and how often
// each field the builder needs is filled in. Prints counts and shares only (no names or addresses).
//   node probe-parcels.mjs <metro> <town>          a feature-service source (DFW): the town's where clause
//   node probe-parcels.mjs <metro> --county=<c>    a file source (Houston, 16 Nov 2026): the county's reader output (its "norm"
//                                                  file: single-family parcels only), whole county
// 16 Nov 2026: reads the per-county sources (M.sources[town.county]); it still read the old single M.parcels and failed on DFW.
import { readFileSync, createReadStream } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const [metro, town] = process.argv.slice(2), county = (process.argv.find((a) => a.startsWith('--county=')) || '').slice(9);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
if (county) {
  const S = M.sources[county]; if (!S || S.type !== 'file') throw new Error('no file source ' + county);
  const rl = createInterface({ input: createReadStream(join(ROOT, S.norm), { encoding: 'utf8' }) });
  const K = ['own', 'mail', 'situs', 'city', 'zip', 'hs', 'yb', 'sqft', 'val', 'rings']; const has = Object.fromEntries(K.map((k) => [k, 0])); let n = 0; const yb = [], cities = {};
  for await (const line of rl) {
    if (!line) continue; const r = JSON.parse(line); n++;
    for (const k of K) { const v = r[k]; if (v != null && v !== '' && v !== 0 && v !== false && !(Array.isArray(v) && !v.length)) has[k]++; }
    if (r.yb > 1800 && n % 20 === 0) yb.push(r.yb); cities[r.city || ''] = (cities[r.city || ''] || 0) + 1;
  }
  console.log(`${S.label}: ${n.toLocaleString()} single-family parcels (${S.residential}); owner-occupied (${S.ownerOccupied}): ${has.hs.toLocaleString()} (${Math.round(100 * has.hs / n)}%)`);
  for (const k of K) console.log(`  ${k.padEnd(6)} ${Math.round(100 * has[k] / n)}%`);
  yb.sort((a, b) => a - b); if (yb.length) console.log(`  year built: median ${yb[yb.length >> 1]}, ${yb[0]}–${yb[yb.length - 1]}`);
  console.log(`  situs cities: ${Object.keys(cities).length} (top: ${Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, x]) => `${c || '(none)'} ${x}`).join(', ')})`);
  process.exit(0);
}
const T = M.towns.find((t) => t.key === town); if (!T) throw new Error('no town ' + town);
const S = M.sources[T.county], F = S.fields;
const q = async (params) => { const r = await fetch(S.url + '/query?' + new URLSearchParams({ f: 'json', ...params })); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j; };
const where = T.where;
const all = (await q({ where, returnCountOnly: 'true' })).count;
const res = (await q({ where: `(${where}) AND (${S.residential})`, returnCountOnly: 'true' })).count;
const sample = (await q({ where: `(${where}) AND (${S.residential})`, outFields: Object.values(F).join(','), returnGeometry: 'false', resultRecordCount: '1000' })).features.map((f) => f.attributes);
const pct = (fn) => Math.round(100 * sample.filter(fn).length / sample.length) + '%';
const has = (k) => (a) => a[F[k]] !== null && a[F[k]] !== undefined && String(a[F[k]]).trim() !== '' && String(a[F[k]]).trim() !== '0';
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
console.log(`${T.label}: ${all.toLocaleString()} parcels, ${res.toLocaleString()} residential (${S.residential}); sample ${sample.length}`);
for (const k of Object.keys(F)) console.log(`  ${k.padEnd(10)} ${F[k].padEnd(12)} ${pct(has(k))}`);
const occ = sample.filter((a) => has('situs')(a) && has('mail1')(a));
console.log(`  owner lives there (situs = mailing, first 12 chars): ${Math.round(100 * occ.filter((a) => norm(a[F.situs]).slice(0, 12) === norm(a[F.mail1]).slice(0, 12)).length / Math.max(1, occ.length))}% of ${occ.length}`);
const yb = sample.map((a) => +a[F.yearBuilt]).filter((y) => y > 1800).sort((a, b) => a - b);
if (yb.length) console.log(`  year built: median ${yb[yb.length >> 1]}, ${yb[0]}–${yb[yb.length - 1]}`);

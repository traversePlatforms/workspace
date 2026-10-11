// Before trusting a parcel source for a new market: how many parcels a town has, how many look residential, and how often
// each field the builder needs is filled in. Prints counts and shares only (no names or addresses).
//   node probe-parcels.mjs <metro> <town>
import { readFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const [metro, town] = process.argv.slice(2);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8')); const T = M.towns.find((t) => t.key === town);
const S = M.parcels, F = S.fields;
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
const occ = sample.filter((a) => has('situs')(a) && has('mail')(a));
console.log(`  owner lives there (situs = mailing, first 12 chars): ${Math.round(100 * occ.filter((a) => norm(a[F.situs]).slice(0, 12) === norm(a[F.mail]).slice(0, 12)).length / Math.max(1, occ.length))}% of ${occ.length}`);
const yb = sample.map((a) => +a[F.yearBuilt]).filter((y) => y > 1800).sort((a, b) => a - b);
if (yb.length) console.log(`  year built: median ${yb[yb.length >> 1]}, ${yb[0]}–${yb[yb.length - 1]}`);

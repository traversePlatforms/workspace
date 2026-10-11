// The door list for a town outside Colorado (the metro builder, 2026-10-11): owner-occupied single-family homes from the
// county's parcel service named in metros/<metro>.json, written as <town>.csv in door-territory/ (the same columns
// build-walklist-co.mjs writes, so build-walklist-pdf.mjs groups it into neighbourhoods unchanged) plus
// metros/out/<town>-parcels.json: per door (keyed "lat,lon" as written) the county's year built, house size, pool,
// market value and last deed date, for the steps after. Owner names stay in the CSV (gitignored), as for every town.
//   node metros/build-doors.mjs <metro> <town>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const [metro, townKey] = process.argv.slice(2);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
const T = M.towns.find((t) => t.key === townKey); if (!T) throw new Error('no town ' + townKey + ' in ' + metro);
const S = M.sources[T.county]; if (!S) throw new Error('no parcel source for ' + T.county); const F = S.fields;
const get = async (url) => { for (let i = 0; i < 6; i++) { try { const r = await fetch(url); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200)); return j; } catch (e) { if (i === 5) throw e; await new Promise((s) => setTimeout(s, [1, 3, 8, 15, 30][i] * 1000)); } } };
const where = `(${T.where}) AND (${S.residential})` + (S.ownerOccupied ? ` AND (${S.ownerOccupied})` : '');
const fields = [...new Set(Object.values(F))].join(',');
const total = (await get(S.url + '/query?' + new URLSearchParams({ f: 'json', where, returnCountOnly: 'true' }))).count;
console.log(`${T.label}: ${total} owner-occupied single-family parcels (${S.label})`);
const rows = [];
for (let off = 0; off < total; off += S.pageSize) {
  const j = await get(S.url + '/query?' + new URLSearchParams({ f: 'json', where, outFields: fields, returnGeometry: 'true', outSR: '4326', geometryPrecision: '6',
    orderByFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: String(S.pageSize) }));
  for (const f of j.features || []) rows.push(f);
  process.stdout.write(`\r  ${rows.length} / ${total}`);
}
console.log('');
/* lot size from the outline (equal-area on a local plane: fine for lots), centre = the outline's area-weighted middle */
const ring = (g) => (g && g.rings) ? g.rings : [];
function areaCentre(rings, lat0) {
  const k = Math.cos(lat0 * Math.PI / 180) * 111320, m = 110540; let A = 0, cx = 0, cy = 0;
  for (const r of rings) for (let i = 0, n = r.length; i < n - 1; i++) {
    const x1 = r[i][0] * k, y1 = r[i][1] * m, x2 = r[i + 1][0] * k, y2 = r[i + 1][1] * m, c = x1 * y2 - x2 * y1;
    A += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  if (!A) return null; return { sqm: Math.abs(A / 2), lon: cx / (3 * A) / k, lat: cy / (3 * A) / m };
}
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const csvq = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const out = ['knock,address,city,zip,acres,owner,owner_mailing,why,parcel,lat,lon'];
const extra = {}; let skipped = 0;
for (const f of rows) {
  const a = f.attributes, rs = ring(f.geometry); if (!rs.length) { skipped++; continue; }
  const c = areaCentre(rs, T.center[0]); if (!c) { skipped++; continue; }
  const address = clean(a[F.situs]).toUpperCase(); if (!/^\d/.test(address)) { skipped++; continue; }
  const lat = +c.lat.toFixed(6), lon = +c.lon.toFixed(6), acres = +(c.sqm / 4046.86).toFixed(2);
  const mail = [clean(a[F.mail1]), clean(a[F.mail2]), clean(a[F.mailCity]), clean(a[F.mailState]), clean(a[F.mailZip])].filter(Boolean).join(', ');
  out.push(['"YES"', csvq(address), csvq(clean(a[F.city]).toUpperCase()), csvq(clean(a[F.zip]).slice(0, 5)), csvq(acres.toFixed(2)), csvq(clean(a[F.owner])), csvq(mail), '"homestead: owner lives here"', csvq(a[F.id]), csvq(lat.toFixed(6)), csvq(lon.toFixed(6))].join(','));
  const yb = +a[F.yearBuilt] || null, sold = a[F.sold] ? new Date(a[F.sold]).toISOString().slice(0, 10) : null;
  extra[`${lat},${lon}`] = { yb: yb > 1800 ? yb : null, sqft: +a[F.sqft] || null, pool: a[F.pool] === 'T', value: +a[F.value] || null, valueYear: +a[F.valueYear] || null, sold };
}
writeFileSync(join(ROOT, `${T.key}.csv`), out.join('\n') + '\n');
mkdirSync(join(HERE, 'out'), { recursive: true });
writeFileSync(join(HERE, 'out', `${T.key}-parcels.json`), JSON.stringify({ source: S.label, built: new Date().toISOString().slice(0, 10), doors: extra }));
console.log(`${T.key}.csv: ${out.length - 1} doors (${skipped} skipped: no outline or no street number)`);

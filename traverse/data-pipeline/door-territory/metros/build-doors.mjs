// The door list for a town outside Colorado (the metro builder, 2026-10-11): single-family homes from the county's parcel data named in
// metros/<metro>.json, written as <town>.csv in door-territory/ (the same columns build-walklist-co.mjs writes, so build-walklist-pdf.mjs
// groups it into neighbourhoods unchanged) plus metros/out/<town>-parcels.json: per door (keyed "lat,lon" as written) the county's year
// built, house size, pool, market value, last deed date and (file sources) the homestead flag hs, for the steps after. Owner names stay
// in the CSV (gitignored), as for every town.
//   node metros/build-doors.mjs <metro> <town>
// Two kinds of source:
//   a feature service (DFW, Collin CAD): queried by the town's where clause plus the source's residential and owner-occupied clauses;
//     only homesteads are pulled, so every door is owner-lived
//   type "file" (Houston, 16 Nov 2026: the appraisal districts publish bulk files, not query services): the county's reader
//     (metros/readers/prep-<county>.mjs) has already kept the single-family parcels and metros/split-doors.mjs has put the town's
//     rows in metros/out/<metro>/<town>.ndjson. EVERY single-family home is a door (Matthew 8 Nov: rented homes on the lists, marked);
//     hs (homestead exemption = the owner lives there) goes into the parcels file, and build-rounds-data.mjs makes it occ here/away.
//     The lot lines go to metros/out/<town>-lots.json for the lawn measuring (metros/yard-metro.mjs).
import { readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const [metro, townKey] = process.argv.slice(2);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
const T = M.towns.find((t) => t.key === townKey); if (!T) throw new Error('no town ' + townKey + ' in ' + metro);
const S = M.sources[T.county]; if (!S) throw new Error('no parcel source for ' + T.county);
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const csvq = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const out = ['knock,address,city,zip,acres,owner,owner_mailing,why,parcel,lat,lon'];
const extra = {}; let skipped = 0;
/* lot size from the outline (equal-area on a local plane: fine for lots), centre = the outline's area-weighted middle */
function areaCentre(rings, lat0) {
  const k = Math.cos(lat0 * Math.PI / 180) * 111320, m = 110540; let A = 0, cx = 0, cy = 0;
  for (const r of rings) for (let i = 0, n = r.length; i < n - 1; i++) {
    const x1 = r[i][0] * k, y1 = r[i][1] * m, x2 = r[i + 1][0] * k, y2 = r[i + 1][1] * m, c = x1 * y2 - x2 * y1;
    A += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  if (!A) return null; return { sqm: Math.abs(A / 2), lon: cx / (3 * A) / k, lat: cy / (3 * A) / m };
}
mkdirSync(join(HERE, 'out'), { recursive: true });

if (S.type === 'file') {
  const lots = {}; const rl = createInterface({ input: createReadStream(join(HERE, 'out', metro, `${T.key}.ndjson`), { encoding: 'utf8' }) });
  let n = 0, hs = 0;
  for await (const line of rl) {
    if (!line) continue; const r = JSON.parse(line); n++;
    const c = r.rings && r.rings.length ? areaCentre(r.rings, T.center[0]) : null; if (!c) { skipped++; continue; }
    const address = clean(r.situs).toUpperCase(); if (!/^\d/.test(address)) { skipped++; continue; }
    const lat = +c.lat.toFixed(6), lon = +c.lon.toFixed(6), acres = +(c.sqm / 4046.86).toFixed(2);
    out.push(['"YES"', csvq(address), csvq(clean(r.city).toUpperCase()), csvq(clean(r.zip).slice(0, 5)), csvq(acres.toFixed(2)), csvq(clean(r.own)), csvq((r.mail || []).map(clean).filter(Boolean).join(', ')),
      csvq(r.hs ? 'homestead: owner lives here' : 'no homestead: owner lives elsewhere'), csvq(r.id), csvq(lat.toFixed(6)), csvq(lon.toFixed(6))].join(','));
    const k = `${lat},${lon}`;
    extra[k] = { yb: r.yb > 1800 ? r.yb : null, sqft: r.sqft || null, pool: !!r.pool, value: r.val || null, valueYear: r.valYr || null, sold: r.sold || null, hs: !!r.hs };
    lots[k] = r.rings.map((ring) => ring.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]));
    if (r.hs) hs++;
  }
  writeFileSync(join(HERE, 'out', `${T.key}-lots.json`), JSON.stringify({ town: T.key, source: S.label, built: new Date().toISOString().slice(0, 10), lots }));
  console.log(`${T.label}: ${n} single-family parcels (${S.label} and the other counties listed for the town), ${hs} homesteads`);
} else {
  const F = S.fields;
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
  for (const f of rows) {
    const a = f.attributes, rs = (f.geometry && f.geometry.rings) ? f.geometry.rings : []; if (!rs.length) { skipped++; continue; }
    const c = areaCentre(rs, T.center[0]); if (!c) { skipped++; continue; }
    const address = clean(a[F.situs]).toUpperCase(); if (!/^\d/.test(address)) { skipped++; continue; }
    const lat = +c.lat.toFixed(6), lon = +c.lon.toFixed(6), acres = +(c.sqm / 4046.86).toFixed(2);
    const mail = [clean(a[F.mail1]), clean(a[F.mail2]), clean(a[F.mailCity]), clean(a[F.mailState]), clean(a[F.mailZip])].filter(Boolean).join(', ');
    out.push(['"YES"', csvq(address), csvq(clean(a[F.city]).toUpperCase()), csvq(clean(a[F.zip]).slice(0, 5)), csvq(acres.toFixed(2)), csvq(clean(a[F.owner])), csvq(mail), '"homestead: owner lives here"', csvq(a[F.id]), csvq(lat.toFixed(6)), csvq(lon.toFixed(6))].join(','));
    const yb = +a[F.yearBuilt] || null, sold = a[F.sold] ? new Date(a[F.sold]).toISOString().slice(0, 10) : null;
    extra[`${lat},${lon}`] = { yb: yb > 1800 ? yb : null, sqft: +a[F.sqft] || null, pool: a[F.pool] === 'T', value: +a[F.value] || null, valueYear: +a[F.valueYear] || null, sold };
  }
}
writeFileSync(join(ROOT, `${T.key}.csv`), out.join('\n') + '\n');
writeFileSync(join(HERE, 'out', `${T.key}-parcels.json`), JSON.stringify({ source: S.label, built: new Date().toISOString().slice(0, 10), doors: extra }));
console.log(`${T.key}.csv: ${out.length - 1} doors (${skipped} skipped: no outline or no street number)`);

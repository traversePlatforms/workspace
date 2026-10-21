/* A second look at lawns that read NO GREEN in the 2023 photo (2026-10-20). 323,071 doors (41%) measured, but found no green lawn: that
   photo was flown on 25 September 2023, when many metro lawns were brown. The card could only say "no size to give". This looks again at
   each such door in another year's USDA photo (2021 by default) with the same lot lookup and the same classifier (lawn-mask.mjs). A door
   that shows lawn gets that measurement (its photo year is kept, so the card says which photo); one that still shows none is marked as
   tried (sl) and is not asked again. One parcel request per door: a parcel-heavy job, one at a time on gis.colorado.gov.
   Run:  node lawn-second-look.mjs --town=aurora [--conc=3] [--limit=40] [--year=2021] [--ids=<file of door ids, done first>] [--out=<file>]
   --out: write to that file instead of lawn-cache.json (a trial while another job holds the cache).                                    */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json, patches, compactSqFt } from './lawn-mask.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..'), CACHE = join(DT, 'lawn-cache.json'), ROUNDS = join(DT, '..', '..', 'app', 'data', 'rounds');
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const TOWN = arg('town', null), CONC = +arg('conc', 3), LIMIT = +arg('limit', 0), YEAR = arg('year', '2021'), OUT = arg('out', null), IDS = arg('ids', null);
if (!TOWN || !/^[a-z0-9-]+$/.test(TOWN) || !/^20\d\d$/.test(YEAR)) { console.log('give --town=<key> (and --year=20xx)'); process.exit(1); }
process.on('unhandledRejection', (e) => { console.log('  (a download failed and was skipped: ' + String(e && e.message || e).slice(0, 80) + ')'); });
const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
const out = OUT ? (existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}) : cache;
const save = () => {
  const F = OUT || CACHE; writeFileSync(F + '.tmp', JSON.stringify(out));
  for (let i = 0; ; i++) { try { renameSync(F + '.tmp', F); return; } catch (e) { if (i >= 20 || !/EPERM|EBUSY|EACCES/.test(String(e.code))) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } }
};
/* the town's doors that measured no green and have not had a second look */
const doors = [];
for (const f of [`${TOWN}.json`, `${TOWN}-lookup.json`]) {
  const p = join(ROUNDS, f); if (!existsSync(p)) continue; const j = JSON.parse(readFileSync(p, 'utf8'));
  for (const d of (j.areas ? j.areas.flatMap((a) => a.doors) : j.doors || [])) if (typeof d.lat === 'number') doors.push(d);
}
const noGreen = (d) => { const c = cache[`${d.lat},${d.lon}`]; return c && !c.err && !(+c.s > 0) && !c.sl && !(out[`${d.lat},${d.lon}`] || {}).sl; };
let todo = doors.filter(noGreen);
if (IDS && existsSync(IDS)) { const first = new Set(JSON.parse(readFileSync(IDS, 'utf8'))); todo.sort((a, b) => (first.has(b.id) ? 1 : 0) - (first.has(a.id) ? 1 : 0)); }
if (LIMIT > 0) todo = todo.slice(0, LIMIT);
console.log(`${TOWN}: ${doors.length} doors, ${todo.length} to look at again in the ${YEAR} photo`);
if (!todo.length) { console.log(`${TOWN}: nothing to look at`); process.exit(0); }
const la = todo.map((d) => d.lat), lo = todo.map((d) => d.lon);
const bbox = [Math.min(...lo) - 0.01, Math.min(...la) - 0.01, Math.max(...lo) + 0.01, Math.max(...la) + 0.01];
const photos = [];
const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: YEAR } }, limit: 250 }) });
for (const f of st.features || []) photos.push({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd, yr: YEAR });
if (!photos.length) { console.log(`no ${YEAR} photo over ${TOWN}`); process.exit(1); }
console.log(`${photos.length} photo tiles from ${YEAR} (flown ${[...new Set(photos.map((p) => p.date))].sort().join(', ').slice(0, 120)})`);
const norm = (s) => String(s || '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (geom, type) => json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: geom, geometryType: type, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd', geometryPrecision: '7' }));
const started = Date.now(); let done = 0, green = 0, still = 0, i = 0;
async function worker() {
  while (i < todo.length) {
    const d = todo[i++], k = `${d.lat},${d.lon}`;
    try {
      const num = (String(d.address).match(/^\d+/) || [''])[0];
      let P = ((await q(`${d.lon},${d.lat}`, 'esriGeometryPoint')).features || [])[0];
      if (!P || (num && !norm(P.attributes.situsAdd).startsWith(num + ' '))) {
        const near = ((await q([d.lon - 0.0004, d.lat - 0.0003, d.lon + 0.0004, d.lat + 0.0003].join(','), 'esriGeometryEnvelope')).features || []).filter((f) => num && norm(f.attributes.situsAdd).startsWith(num + ' '));
        if (near.length) P = near[0];
      }
      const it = photos.filter((p) => d.lon >= p.bb[0] && d.lon <= p.bb[2] && d.lat >= p.bb[1] && d.lat <= p.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
      if (P && P.geometry && P.geometry.rings && it) {
        const m = await measure({ la: d.lat, lo: d.lon, detail: true }, P.geometry.rings, it);
        if (!m.err && m.s > 0) {
          const e = { s: m.s, t: m.t, lot: m.lot, d: m.d, fill: 1, sl: YEAR };
          if (m.s >= 1200) { e.c = compactSqFt(patches(m.detail, null), false); e.ch = 0; }
          out[k] = e; green++;
        } else { out[k] = Object.assign({}, cache[k], { sl: YEAR }); still++; }
      } else { out[k] = Object.assign({}, cache[k], { sl: YEAR }); still++; }
    } catch (e) { /* left for the next run */ }
    if (++done % 25 === 0) { save(); process.stdout.write(`\r  ${done} looked at · ${green} show lawn in ${YEAR} · ${(done / ((Date.now() - started) / 1000)).toFixed(1)}/s   `); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log(`\n${TOWN}: ${green} of ${todo.length} show lawn in the ${YEAR} photo, ${still} still none, in ${((Date.now() - started) / 60000).toFixed(1)} min -> ${OUT || 'lawn-cache.json'}`);

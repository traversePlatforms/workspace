/* The lawns sample-lawn.mjs could not read (2026-10-17, Matthew: "all those properties are ... measured to give the most accurate
   information?"). In Denver and Arvada ~12,900 real houses read "no parcel at the point": the town's parcel download came back short
   (the parcel services' paging is unreliable), so the house had no lot to measure. Here each such door, and each door never measured,
   asks the state parcel layer for the lot AT its point (else the nearest lot with the same house number), then the same classifier
   (lawn-mask.mjs, unchanged) on the 2023 photo. Medium/Large get the compact rule by size only (no house outline; ch: 0), as
   sample-lawn-compact.mjs does when it has no outline, so that pass skips them. Into lawn-cache.json, saved every 50 doors.
   One parcel request per door: run it alone on gis.colorado.gov (one parcel-heavy job at a time).
   Run:  node lawn-fill.mjs --town=denver [--conc=6]                                                                              */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json, patches, compactSqFt } from './lawn-mask.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..'), CACHE = join(DT, 'lawn-cache.json'), ROUNDS = join(DT, '..', '..', 'app', 'data', 'rounds');
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const TOWN = arg('town', null), CONC = +arg('conc', 6), LIMIT = +arg('limit', 0);   /* limit: a trial on the first N */
if (!TOWN || !/^[a-z0-9-]+$/.test(TOWN)) { console.log('give --town=<key>'); process.exit(1); }
process.on('unhandledRejection', (e) => { console.log('  (a download failed and was skipped: ' + String(e && e.message || e).slice(0, 80) + ')'); });
const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
const save = () => {
  writeFileSync(CACHE + '.tmp', JSON.stringify(cache));
  for (let i = 0; ; i++) { try { renameSync(CACHE + '.tmp', CACHE); return; } catch (e) { if (i >= 20 || !/EPERM|EBUSY|EACCES/.test(String(e.code))) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250); } }
};
/* the town's doors, the walk lists and the office lookup both */
const doors = [];
for (const f of [`${TOWN}.json`, `${TOWN}-lookup.json`]) {
  const p = join(ROUNDS, f); if (!existsSync(p)) continue; const j = JSON.parse(readFileSync(p, 'utf8'));
  for (const d of (j.areas ? j.areas.flatMap((a) => a.doors) : j.doors || [])) if (typeof d.lat === 'number') doors.push(d);
}
let todo = doors.filter((d) => { const c = cache[`${d.lat},${d.lon}`]; return !c || c.err === 'no parcel at the point'; });
if (LIMIT > 0) todo = todo.slice(0, LIMIT);
console.log(`${TOWN}: ${doors.length} doors, ${todo.length} to fill`);
if (!todo.length) { console.log(`${TOWN}: nothing to fill`); process.exit(0); }
/* the 2023 photos over the town (2021 where 2023 does not cover) */
const la = todo.map((d) => d.lat), lo = todo.map((d) => d.lon);
const bbox = [Math.min(...lo) - 0.01, Math.min(...la) - 0.01, Math.max(...lo) + 0.01, Math.max(...la) + 0.01];
const photos = [];
for (const yr of ['2023', '2021']) {
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: yr } }, limit: 250 }) });
  for (const f of st.features || []) photos.push({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd, yr });
}
const norm = (s) => String(s || '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
const q = (geom, type) => json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: geom, geometryType: type, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd', geometryPrecision: '7', resultRecordCount: '40' }));
const started = Date.now(); let done = 0, filled = 0, none = 0, i = 0;
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
      if (!P || !P.geometry || !P.geometry.rings) { cache[k] = { err: 'no parcel found' }; none++; }
      else {
        const it = photos.filter((p) => d.lon >= p.bb[0] && d.lon <= p.bb[2] && d.lat >= p.bb[1] && d.lat <= p.bb[3]).sort((a, b) => (a.yr === b.yr ? a.gsd - b.gsd : a.yr < b.yr ? 1 : -1))[0];
        if (!it) cache[k] = { err: 'lot off the photo tile' };
        else {
          const m = await measure({ la: d.lat, lo: d.lon, detail: true }, P.geometry.rings, it);
          if (m.err) cache[k] = { err: m.err };
          else {
            const e = { s: m.s, t: m.t, lot: m.lot, d: m.d, fill: 1 };
            if (m.s >= 1200) { e.c = compactSqFt(patches(m.detail, null), false); e.ch = 0; }
            cache[k] = e; filled++;
          }
        }
      }
    } catch (e) { /* left for the next run */ }
    if (++done % 50 === 0) { save(); process.stdout.write(`\r  ${done} done · ${filled} lawns · ${(done / ((Date.now() - started) / 1000)).toFixed(1)}/s · ${TOWN} ${done}/${todo.length}   `); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log(`\n${TOWN}: filled ${filled} of ${todo.length} (${none} with no lot at all) in ${((Date.now() - started) / 60000).toFixed(1)} min -> lawn-cache.json`);

/* The lot lines for the hand-measured lots, kept on disk (2026-10-23) so the yard v2 runs never ask gis.colorado.gov again.
   Each lot is found by the point the app already has for that door (the door files), not by its address text: the El Paso record for
   9554 Penstemon Ct does not match '9554 PENSTEMON CT' exactly, which is why v1 found no lot there. Valentia is not in a door file,
   so it goes by address. Lots already cached (the server's parcelat cache, copied read-only) are passed in with --seed.
   One request at a time, 3 s apart, only for lots not yet in yard-key-parcels.json.
     node yard-key-parcels.mjs [--seed seed.json]                                                                             */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const OUT = new URL('./yard-key-parcels.json', import.meta.url);
const LOTS = [
  { addr: '3855 S VALENTIA CT' },
  { addr: '11663 SETTLERS DR', lat: 39.531915, lon: -104.763278 },
  { addr: '2787 RUSSET SKY CT', lat: 39.392054, lon: -104.829359 },
  { addr: '1648 MARSH HAWK CIR', lat: 39.383258, lon: -104.87384 },
  { addr: '7378 UPTON CT', lat: 39.363014, lon: -104.783759 },
  { addr: '9554 PENSTEMON CT', lat: 38.968517, lon: -104.763172 },
  { addr: '6595 ZINNIA ST', lat: 39.816582, lon: -105.147116 },
  { addr: '3247 OAK LEAF PL', lat: 39.531099, lon: -105.026502 },
];
const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const si = process.argv.indexOf('--seed');
if (si > 0) for (const [a, v] of Object.entries(JSON.parse(readFileSync(process.argv[si + 1], 'utf8')))) if (!cache[a]) cache[a] = v;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let asked = 0;
for (const L of LOTS) {
  if (cache[L.addr] && cache[L.addr].rings) continue;
  if (asked) await sleep(3000);
  asked++;
  const p = L.lat ? { geometry: `${L.lon},${L.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }
    : { where: `UPPER(situsAdd) = '${L.addr}' OR UPPER(situsAdd) = 'N ${L.addr}'` };
  const r = await fetch(PARCELS + '?' + new URLSearchParams({ f: 'json', ...p, outFields: 'situsAdd,sitAddCty', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7' }));
  const j = await r.json(); const f = (j.features || [])[0];
  if (!f) { console.log(L.addr + ': no lot'); continue; }
  cache[L.addr] = { rings: f.geometry.rings, county: f.attributes.situsAdd, city: f.attributes.sitAddCty, via: L.lat ? 'door point' : 'address', at: new Date().toISOString().slice(0, 10) };
  console.log(L.addr + ': county writes "' + f.attributes.situsAdd + '" (' + (f.attributes.sitAddCty || '') + ')');
  writeFileSync(OUT, JSON.stringify(cache));
}
writeFileSync(OUT, JSON.stringify(cache));
console.log(asked + ' parcel requests; ' + Object.keys(cache).length + ' lots on disk');

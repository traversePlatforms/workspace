/* Inputs for the solar build (2026-10-06):
 *  1. pvwatts.json: a year's output per installed kW, by roof facing and slope, from NREL's PVWatts v8 (the laboratory is now
 *     the National Laboratory of the Rockies; the API moved from developer.nrel.gov to developer.nlr.gov, and the old host no
 *     longer resolves). One Front Range point (Larkspur, between the El Paso and Douglas towns): the sun varies by a few
 *     percent across them. Defaults: standard modules, 14% system losses, fixed roof mount. DEMO_KEY allows 30 calls an hour.
 *  2. utilities.geojson: Colorado's Electric Utility Service Territories (Governor's Office of Information Technology,
 *     geodata.colorado.gov, updated 2026-08-24), simplified, in WGS84.
 *   node fetch-inputs.mjs        (skips a file that already exists; delete it to fetch again) */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY = process.env.NLR_API_KEY || 'DEMO_KEY';
const AT = { lat: 39.23, lon: -104.88 };
const AZ = [90, 135, 180, 225, 270], TILT = [10, 25, 40];
const UTIL = 'https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/Electric_Utility_Service_Territories/FeatureServer/0/query';

const pv = join(HERE, 'pvwatts.json');
{
  /* resumable: the demo key stops after a handful of calls an hour, so keep what came back and fetch the rest next run */
  const out = existsSync(pv) ? JSON.parse(readFileSync(pv, 'utf8')) : { source: 'NREL/NLR PVWatts v8 (developer.nlr.gov), standard module, 14% losses, fixed roof mount', at: AT, fetched: new Date().toISOString().slice(0, 10), kwhPerKw: {} };
  for (const tilt of TILT) for (const az of AZ) {
    if (out.kwhPerKw[`${tilt}/${az}`]) continue;
    const u = `https://developer.nlr.gov/api/pvwatts/v8.json?api_key=${KEY}&lat=${AT.lat}&lon=${AT.lon}&system_capacity=1&module_type=0&losses=14&array_type=1&tilt=${tilt}&azimuth=${az}`;
    const j = await (await fetch(u)).json();
    if (!j.outputs) { writeFileSync(pv, JSON.stringify(out, null, 1)); console.log('PVWatts stopped (kept ' + Object.keys(out.kwhPerKw).length + ' of 15): ' + JSON.stringify(j.error || j.errors || j).slice(0, 160)); break; }
    out.kwhPerKw[`${tilt}/${az}`] = Math.round(j.outputs.ac_annual);
    console.log(`tilt ${tilt}, facing ${az}: ${out.kwhPerKw[`${tilt}/${az}`]} kWh per kW a year`);
  }
  writeFileSync(pv, JSON.stringify(out, null, 1));
}

const ut = join(HERE, 'utilities.geojson');
if (!existsSync(ut)) {
  const q = new URLSearchParams({ where: '1=1', outFields: '*', outSR: '4326', f: 'geojson', maxAllowableOffset: '0.0005', resultRecordCount: '2000' });
  const r = await fetch(`${UTIL}?${q}`);
  const j = await r.json();
  if (!j.features) throw new Error('utilities: ' + JSON.stringify(j).slice(0, 200));
  writeFileSync(ut, JSON.stringify(j));
  console.log(`utilities: ${j.features.length} service territories; fields: ${Object.keys(j.features[0].properties).join(', ')}`);
}

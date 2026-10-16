/* County appraised value per door, for Douglas and Teller (SX-15, 2026-10-03).

   The statewide parcel composite carries "Parcel Total Value" (apprValTot) — the county
   assessor's total value for the parcel, land plus buildings. Measured 2026-10-01: filled on
   every Douglas and Teller parcel, and the composite's sale date, price and zoning are empty
   everywhere. El Paso's own layer (build-walklist.mjs) carries no value at all, so El Paso doors
   get none. A rough qualifier only: whether a $2,000+ job is plausible at a door, never a
   statement about the people in it.

   Keyed like the other caches, by "lat,lon", so a rebuild attaches it without touching which
   doors exist. Reads the walk-list CSVs (they hold the parcel number), asks the state in
   batches, and writes value-cache.json.

   Run:  node sample-value.mjs            (re-run after a county re-pull, SX-33) */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAYER = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
/* 2026-10-07: the editions' counties too (the state layer fills apprValTot on 95-100% of parcels in each; Larimer on none, so
   Windsor's Larimer side has no value). A town in two counties is listed under both: a parcel the other county answers for is
   left as it is (below). */
const TOWNS = { douglas: ['castle-rock', 'larkspur', 'sedalia', 'franktown', 'highlands-ranch', 'parker', 'castle-pines', 'aurora'], teller: ['woodland-park', 'divide', 'florissant', 'cripple-creek'],
  jefferson: ['ken-caryl', 'columbine', 'arvada', 'lakewood', 'wheat-ridge', 'edgewater', 'golden', 'littleton', 'westminster', 'superior'], adams: ['arvada', 'thornton', 'commerce-city', 'aurora', 'westminster', 'northglenn', 'federal-heights', 'brighton'],
  arapahoe: ['centennial', 'englewood', 'aurora', 'littleton', 'greenwood-village', 'cherry-hills-village', 'sheridan'], weld: ['windsor', 'erie', 'thornton', 'brighton', 'longmont', 'northglenn'],
  boulder: ['erie', 'boulder', 'louisville', 'lafayette', 'superior', 'longmont'], denver: ['denver', 'south-denver'] };   /* + the 365 area towns 2026-10-15 */
TOWNS.douglas.push('littleton', 'lone-tree');
TOWNS.arapahoe.push('bow-mar', 'columbine-valley', 'glendale', 'dove-valley', 'foxfield', 'watkins', 'bennett', 'strasburg', 'byers'); TOWNS.jefferson.push('bow-mar', 'morrison', 'evergreen'); TOWNS.adams.push('twin-lakes', 'sherrelwood', 'welby', 'watkins', 'lochbuie', 'bennett', 'strasburg'); TOWNS.douglas.push('stonegate', 'roxborough-park', 'the-pinery', 'perry-park'); TOWNS.weld.push('lochbuie', 'dacono', 'frederick', 'fort-lupton', 'firestone', 'hudson', 'platteville', 'mead', 'keenesburg'); TOWNS.boulder.push('gunbarrel', 'niwot', 'nederland', 'lyons');   /* batch 4, 2026-10-16 */   /* +South Denver, Englewood, Aurora 2026-10-12 (left out when they were built) */
/* --only=a,b asks for just those towns; everything already in the cache stays */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const COUNTY = { douglas: 'Douglas', teller: 'Teller', jefferson: 'JEFFERSON', adams: 'ADAMS', arapahoe: 'ARAPAHOE', weld: 'WELD', boulder: 'BOULDER', denver: 'DENVER' };
/* El Paso: the state layer carries no value there, but the county assessor's own parcel file does (MARKETVALUE, the assessor's
   market value; assessor/raw/EPC Parcel Data.txt, refreshed weekly). Matched on the parcel number the walk lists carry. */
const EL_PASO = ['monument', 'palmer-lake', 'black-forest', 'cs-northeast', 'cs-southeast', 'cs-northwest', 'cs-southwest', 'security-widefield', 'fountain', 'walden'];
const OUT = join(HERE, 'value-cache.json');

function csvRows(file) {
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  return lines.map((l) => {
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"' && cur === '') q = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ask(county, ids) {
  const body = new URLSearchParams({
    f: 'json', returnGeometry: 'false', outFields: 'parcel_id,apprValTot,dateReceived',
    where: `countyName='${county}' AND parcel_id IN (${ids.map((x) => `'${x.replace(/'/g, "''")}'`).join(',')})`,
  });
  for (let k = 0; k < 4; k++) {
    try {
      const r = await fetch(LAYER, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.features || [];
    } catch (e) { if (k === 3) throw e; await sleep(1500 * (k + 1)); }
  }
}

const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let asked = 0, got = 0, empty = 0;
for (const [cty, towns] of Object.entries(TOWNS)) {
  const byParcel = new Map();
  for (const t of towns) { if (ONLY.length && !ONLY.includes(t)) continue; if (!existsSync(join(HERE, `${t}.csv`))) continue; for (const r of csvRows(join(HERE, `${t}.csv`))) {
    if (!r.parcel || !r.lat || !r.lon) continue;
    const key = `${parseFloat(r.lat)},${parseFloat(r.lon)}`;
    (byParcel.get(r.parcel) || byParcel.set(r.parcel, []).get(r.parcel)).push(key);
  } }
  const ids = [...byParcel.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const feats = await ask(COUNTY[cty], batch);
    asked += batch.length;
    const seen = new Set();
    for (const f of feats) {
      const a = f.attributes || {}, v = parseInt(a.apprValTot, 10);
      const m = String(a.dateReceived || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const d = m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
      seen.add(a.parcel_id);
      for (const key of byParcel.get(a.parcel_id) || []) cache[key] = Number.isFinite(v) && v > 0 ? { v, d } : { v: null, d };
      if (Number.isFinite(v) && v > 0) got++; else empty++;
    }
    /* not found in this county: blank, unless another county already gave it a value (a town in two counties) */
    for (const p of batch) if (!seen.has(p)) for (const key of byParcel.get(p)) if (!(cache[key] && cache[key].v > 0)) cache[key] = { v: null, d: null };
    process.stdout.write(`\r  ${COUNTY[cty]}: ${Math.min(i + 100, ids.length)}/${ids.length} parcels`);
  }
  console.log('');
}
{
  const f = join(HERE, 'assessor', 'raw', 'EPC Parcel Data.txt');
  if (existsSync(f)) {
    const lines = readFileSync(f, 'latin1').split(/\r?\n/), cols = lines.shift().split('\t'), iP = cols.indexOf('PARCEL'), iV = cols.indexOf('MARKETVALUE'), iD = cols.indexOf('LastUpdate');
    const mv = new Map();
    for (const l of lines) { const r = l.split('\t'); if (r.length !== cols.length) continue; const v = parseInt(String(r[iV]).replace(/[^0-9]/g, ''), 10); if (v > 0) mv.set(r[iP].trim(), v); }
    let n = 0, hit = 0;
    for (const t of EL_PASO) {
      if (!existsSync(join(HERE, `${t}.csv`))) continue;
      for (const r of csvRows(join(HERE, `${t}.csv`))) {
        if (!r.parcel || !r.lat || !r.lon) continue; n++;
        const v = mv.get(String(r.parcel).trim());
        cache[`${parseFloat(r.lat)},${parseFloat(r.lon)}`] = v ? { v, d: null, src: 'El Paso assessor' } : { v: null, d: null };
        if (v) hit++;
      }
    }
    console.log(`El Paso (assessor file): ${hit} of ${n} doors with a market value`);
  }
}
writeFileSync(OUT, JSON.stringify(cache), 'utf8');
console.log(`${asked} parcels asked · ${got} with a value · ${empty} blank · ${asked - got - empty} not found -> value-cache.json`);

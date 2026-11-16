// A county's single-family homes from a PACS certified-roll export + the county's parcel shapefile (16 Nov 2026, Houston: Galveston and
// Brazoria CADs publish both). Writes the county's norm file for the metro builder (metros/split-doors.mjs), one JSON line per home:
//   { id, own, mail: [line1, line2, line3, city, state, zip], situs, city, zip, hs, yb, sqft, val, valYr, sold, rings }
// Rules:
//   - a home = a real property whose improvement state code is A1 (single-family)
//   - hs = the roll's homestead flag (hs_exempt T): the owner lives there
//   - yb / sqft = the main living area (improvement detail codes starting MA: MA, MA2, MA1.5, MAA ...): earliest year, summed area
//   - a confidential owner (py_confidential_flag T, Tax Code 25.025) keeps no name and no mailing address
//   - rings: the parcel outline(s) for the property id from the shapefile, state plane (EPSG:2278, US feet) to WGS84
//   node --max-old-space-size=12000 metros/readers/prep-pacs.mjs <county>      (reads metros/hou.json sources.<county>.pacs)
import { readFileSync, createReadStream, createWriteStream, readdirSync } from 'node:fs'; import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { open } = require('shapefile'); const proj4 = require('proj4');
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..', '..');
const county = process.argv[2], metro = process.argv[3] || 'hou';
const S = JSON.parse(readFileSync(join(HERE, '..', metro + '.json'), 'utf8')).sources[county], C = S.pacs;
proj4.defs('EPSG:2278', '+proj=lcc +lat_1=30.28333333333333 +lat_2=28.38333333333333 +lat_0=27.83333333333333 +lon_0=-99 +x_0=600000 +y_0=3999999.9998984 +ellps=GRS80 +datum=NAD83 +units=us-ft +no_defs');
const L = JSON.parse(readFileSync(join(HERE, C.layout), 'utf8'));
const rollDir = join(DT, C.roll), file = (k) => join(rollDir, readdirSync(rollDir).find((f) => f.toUpperCase().endsWith('_' + k + '.TXT') || f.toUpperCase() === k + '.TXT'));
const cut = (line, F, k) => { const p = F[k]; return p ? line.slice(p[0] - 1, p[1]).trim() : ''; };
const lines = (f) => createInterface({ input: createReadStream(f, { encoding: 'latin1' }), crlfDelay: Infinity });
const t0 = Date.now(), log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s  ${s}`);

/* 1. the roll: single-family homes */
const I = L.APPRAISAL_INFO, homes = new Map(), byGeo = new Map(); let nAll = 0, nA1 = 0, nConf = 0;
for await (const ln of lines(file('APPRAISAL_INFO'))) {
  nAll++; if (cut(ln, I, 'prop_type_cd') !== 'R' || !/^A1\b/.test(cut(ln, I, 'imprv_state_cd'))) continue;
  nA1++; const id = String(+cut(ln, I, 'prop_id')), conf = cut(ln, I, 'py_confidential_flag') === 'T'; if (conf) nConf++;
  const situs = [cut(ln, I, 'situs_num'), cut(ln, I, 'situs_street_prefx'), cut(ln, I, 'situs_street'), cut(ln, I, 'situs_street_suffix')].filter(Boolean).join(' ');
  const deed = cut(ln, I, 'deed_dt'), sold = /^\d{4}-\d\d-\d\d/.test(deed) ? deed.slice(0, 10) : (/^(\d\d)\/(\d\d)\/(\d{4})/.exec(deed) || []).slice(1).reverse().join('-').replace(/^(\d{4})-(\d\d)-(\d\d)$/, '$1-$3-$2') || null;
  const h = { id, own: conf ? '' : cut(ln, I, 'py_owner_name'), mail: conf ? [] : ['py_addr_line1', 'py_addr_line2', 'py_addr_line3', 'py_addr_city', 'py_addr_state', 'py_addr_zip'].map((k) => cut(ln, I, k)),
    situs, city: cut(ln, I, 'situs_city'), zip: cut(ln, I, 'situs_zip').slice(0, 5), hs: cut(ln, I, 'hs_exempt') === 'T', yb: null, sqft: 0,
    val: +cut(ln, I, 'market_value') || null, valYr: +cut(ln, I, 'prop_val_yr') || null, sold: sold || null, rings: [] };
  homes.set(id, h); const g = cut(ln, I, 'geo_id'); if (g) byGeo.set(g, h);
}
log(`roll: ${nAll} properties, ${nA1} single-family (A1), ${nConf} confidential owners (no name or mailing address kept)`);

/* 2. improvement detail: main living area year and size */
const D = L.APPRAISAL_IMPROVEMENT_DETAIL; let nDet = 0;
for await (const ln of lines(file('APPRAISAL_IMPROVEMENT_DETAIL'))) {
  const h = homes.get(String(+cut(ln, D, 'prop_id'))); if (!h) continue;
  if (!/^MA/i.test(cut(ln, D, 'Imprv_det_type_cd'))) continue;
  nDet++; const y = +cut(ln, D, 'yr_built'); if (y > 1800 && (!h.yb || y < h.yb)) h.yb = y; h.sqft += +cut(ln, D, 'imprv_det_area') || 0;
}
log(`improvement detail: ${nDet} main-area rows`);

/* 3. the outlines */
const src = await open(join(DT, C.shp), join(DT, C.shp).replace(/\.shp$/i, '.dbf'), { encoding: 'latin1' }); let nShp = 0, nHit = 0;
const tf = (p) => proj4('EPSG:2278', 'EPSG:4326', p);
for (let r; !(r = await src.read()).done;) {
  nShp++; const f = r.value, g = f.geometry; if (!g) continue;
  const pid = String(f.properties[C.shpId] ?? '').trim(), h = homes.get(String(+pid)) || (C.shpGeo ? byGeo.get(String(f.properties[C.shpGeo] ?? '').trim()) : null); if (!h) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) for (const ring of poly) h.rings.push(ring.map(tf));
  nHit++;
}
log(`shapefile: ${nShp} outlines, ${nHit} matched a single-family home`);

/* 4. a home with no situs city (Brazoria leaves it blank outside the cities: 40%) takes the commonest city among the county's homes in
   its zip, the postal-city rule the towns follow everywhere else; with no zip, or a zip no named home shares, it stays blank */
const zc = {}; for (const h of homes.values()) if (h.city && h.zip) { const m = (zc[h.zip] = zc[h.zip] || {}); m[h.city] = (m[h.city] || 0) + 1; }
let nFill = 0; for (const h of homes.values()) if (!h.city && zc[h.zip]) { h.city = Object.entries(zc[h.zip]).sort((a, b) => b[1] - a[1])[0][0]; nFill++; }
log(`situs city filled from the zip on ${nFill} homes`);

/* 5. out */
const out = createWriteStream(join(DT, S.norm)); let n = 0, nRing = 0, nHs = 0;
for (const h of homes.values()) { if (h.rings.length) nRing++; else continue; if (h.hs) nHs++; if (!h.sqft) h.sqft = null; out.write(JSON.stringify(h) + '\n'); n++; }
await new Promise((ok) => out.end(ok));
log(`${S.norm}: ${n} single-family homes with an outline (${homes.size - nRing} without one left out), ${nHs} homesteads`);

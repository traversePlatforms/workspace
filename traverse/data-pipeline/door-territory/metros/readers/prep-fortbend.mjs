// Fort Bend County's single-family homes for the metro builder (16 Nov 2026, Houston), from FBCAD's 2026 certified GIS data
// (FBCAD2026CertifiedGISData-ParcelsShapefiles.zip): CamaSummary.gdb holds each parcel's outline with its roll attributes. It is converted
// once to GeoJSON lines in WGS84 (metros/readers/gdb-to-ndjson.mjs, gdal3.js: the tables are the older v3 format it reads) as
// assessor/raw/hou/fortbend/cama.ndjson. Writes assessor/raw/hou/fortbend/norm.ndjson, one JSON line per home:
//   { id, own, mail: [addr1, addr2, addr3, city, state, zip], situs, city, zip, hs, yb, sqft, val, valYr, sold, rings }
// Rules: a home = Building_SPTB_Code A1 (single-family); hs = HS among the Exemptions; situs "123 MAIN ST, City, TX  77479" split into
// street, city and zip. One property id listed on several outlines keeps all its rings.
//   node --max-old-space-size=12000 metros/readers/prep-fortbend.mjs
import { existsSync, createReadStream, createWriteStream } from 'node:fs'; import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..', '..'), RAW = join(DT, 'assessor', 'raw', 'hou', 'fortbend');
const t0 = Date.now(), log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s  ${s}`);
const SRC = join(RAW, 'cama.ndjson');
if (!existsSync(SRC)) {
  const r = spawnSync(process.execPath, ['--max-old-space-size=12000', join(HERE, 'gdb-to-ndjson.mjs'), 'assessor/raw/hou/fortbend/g/CamaSummary.gdb', 'assessor/raw/hou/fortbend/cama.ndjson'], { cwd: DT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('gdb conversion failed');
}
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const date = (s) => { s = clean(s); let m; if ((m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s))) return m.slice(1).join('-'); if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; return null; };
const homes = new Map(); let n = 0, nA1 = 0;
for await (const ln of createInterface({ input: createReadStream(SRC, { encoding: 'utf8' }), crlfDelay: Infinity })) {
  if (!ln) continue; n++; const f = JSON.parse(ln), p = f.properties, g = f.geometry;
  if (!/^A1\b/.test(clean(p.Building_SPTB_Code)) || !g) continue; nA1++;
  const id = clean(p.Property_Number || p.CAD_Reference_Number);
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let h = homes.get(id);
  if (!h) {
    const parts = clean(p.Situs).split(','), street = clean(parts[0]), city = clean(parts[1]), zip = (/(\d{5})\s*$/.exec(clean(p.Situs)) || [])[1] || '';
    const ex = clean(p.Exemptions).toUpperCase().split(/[,;\s]+/);
    h = { id, own: clean(p.Owner_Name), mail: [p.Owner_Address_1, p.Owner_Address_2, p.Owner_Address_3, p.Owner_City, p.Owner_State, p.Owner_Zip].map(clean), situs: street, city: city.toUpperCase(), zip,
      hs: ex.includes('HS'), yb: +p.Year_Built || null, sqft: +p.Total_Living_Area_SqFT || null, val: +p.Total_Value || null, valYr: 2026, sold: date(p.Deed_Date), rings: [] };
    homes.set(id, h);
  }
  for (const poly of polys) for (const ring of poly) h.rings.push(ring);
}
log(`CamaSummary: ${n} parcels, ${nA1} single-family (A1) outlines, ${homes.size} properties`);
const out = createWriteStream(join(RAW, 'norm.ndjson')); let w = 0, hs = 0;
for (const h of homes.values()) { if (!h.rings.length || !h.situs) continue; if (h.hs) hs++; out.write(JSON.stringify(h) + '\n'); w++; }
await new Promise((ok) => out.end(ok));
log(`norm.ndjson: ${w} single-family homes, ${hs} homesteads`);

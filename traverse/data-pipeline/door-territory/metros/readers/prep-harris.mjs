// Harris County's single-family homes for the metro builder (16 Nov 2026, Houston), from HCAD's public 2026 files:
//   Real_acct_owner.zip  real_acct.txt (account, mailing address, situs, state class, year improved, building area, market value,
//                        new-owner date) + owners.txt (owner names, line 1 first)
//   Real_jur_exempt.zip  the exemptions per account: a residence homestead exemption = the owner lives there (hs)
//   Parcels.zip          the parcel outlines, a File Geodatabase (ArcGIS Pro 3.2+ format): converted to GeoJSON lines in WGS84 by
//                        GDAL 3.10+ (ogr2ogr from the micromamba "gdal" environment; gdal3.js's older GDAL reads the table as empty)
// Writes assessor/raw/hou/harris/norm.ndjson, one JSON line per home:
//   { id, own, mail: [addr1, addr2, city, state, zip], situs, city, zip, hs, yb, sqft, val, valYr, sold, rings }
//   node --max-old-space-size=12000 metros/readers/prep-harris.mjs
import { existsSync, statSync, unlinkSync, readdirSync, createReadStream, createWriteStream } from 'node:fs'; import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..', '..'), RAW = join(DT, 'assessor', 'raw', 'hou', 'harris');
const t0 = Date.now(), log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s  ${s}`);
const tsv = async function* (f) {
  let head = null;
  for await (const ln of createInterface({ input: createReadStream(f, { encoding: 'latin1' }), crlfDelay: Infinity })) {
    const c = ln.split('\t'); if (!head) { head = c.map((h) => h.trim()); continue; }
    const o = {}; for (let i = 0; i < head.length; i++) o[head[i]] = (c[i] || '').trim(); yield o;
  }
};
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* 1. accounts: single-family (state class A1) */
const homes = new Map(); let nAll = 0;
for await (const a of tsv(join(RAW, 'cama', 'real_acct.txt'))) {
  nAll++; if (a.state_class !== 'A1') continue;
  const sold = /^\d\d\/\d\d\/\d{4}/.test(a.new_own_dt) ? `${a.new_own_dt.slice(6, 10)}-${a.new_own_dt.slice(0, 2)}-${a.new_own_dt.slice(3, 5)}` : (/^\d{4}-\d\d-\d\d/.test(a.new_own_dt) ? a.new_own_dt.slice(0, 10) : null);
  homes.set(a.acct, { id: a.acct, own: clean(a.mailto), mail: [a.mail_addr_1, a.mail_addr_2, a.mail_city, a.mail_state, a.mail_zip].map(clean), situs: clean(a.site_addr_1),
    city: clean(a.site_addr_2), zip: clean(a.site_addr_3).slice(0, 5), hs: false, yb: +a.yr_impr || null, sqft: +a.bld_ar || null,
    val: +a.tot_mkt_val || null, valYr: +a.yr || null, sold, rings: [] });
}
log(`real_acct: ${nAll} accounts, ${homes.size} single-family (A1)`);
/* the owner's name: owners.txt line 1 (mailto can be a care-of line) */
let nOwn = 0;
for await (const o of tsv(join(RAW, 'cama', 'owners.txt'))) { const h = homes.get(o.acct); if (h && (o.ln_num === '1' || !h._o)) { h.own = clean(o.name); h._o = 1; nOwn++; } }
log(`owners: ${nOwn} names`);

/* 2. homestead: the exemptions file (its layout is read from the header; the homestead code is RES, HCAD's residence homestead) */
const exDir = join(RAW, 'exempt'), exFile = existsSync(exDir) ? readdirSync(exDir).find((f) => /jur_exempt\.txt$/i.test(f)) : null;
if (!exFile) throw new Error('no exemptions file in ' + exDir + ' (unzip Real_jur_exempt.zip there)');
let nHs = 0, codeCol = null; const codes = {};
const HS_CODES = /^(RES|PAR|APR|OVR|POV|APO|SUR|DIS|PDS|APD|VTX|SSA|SSD|SSP|SST|STT|STX)$/i;
for await (const e of tsv(join(exDir, exFile))) {
  codeCol ??= ['exempt_cat', 'exempt_cd', 'exmpt_cd', 'exemption_cd', 'exempt_code'].find((k) => k in e);
  const c = e[codeCol]; codes[c] = (codes[c] || 0) + 1;
  /* every exemption that only a residence homestead gets (jur_exemption_dscr.txt): residential homestead (RES, partial PAR, APR),
     over-65 (OVR, POV, APO, SUR), disability (DIS, PDS, APD), 100% disabled veteran (VTX) and surviving spouses (SSA, SSD, SSP, SST,
     STT, STX). Not TOT (any total exemption: charities, governments) nor V11-V24 (a veteran's disability, any property). */
  const h = homes.get(e.acct); if (h && !h.hs && HS_CODES.test(c)) { h.hs = true; nHs++; }
}
log(`exemptions (${exFile}, code column ${codeCol}): ${nHs} homesteads; codes ${Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + v).join(', ')}`);

/* 3. outlines: the geodatabase to GeoJSON lines (once), then joined on LOWPARCELID (the account number) */
const GJ = join(RAW, 'parcels.ndjson');
if (!existsSync(GJ) || statSync(GJ).size === 0) {
  if (existsSync(GJ)) unlinkSync(GJ);
  /* GDAL 3.13 from conda-forge (micromamba env "gdal" under %LOCALAPPDATA%\micromamba; x64, runs under emulation on this laptop).
     The account number is LOWPARCELID (the 2026 layer has no HCAD_NUM); the outlines are 3D, flattened with -dim XY */
  const LIB = join(process.env.LOCALAPPDATA || '', 'micromamba', 'envs', 'gdal', 'Library'), OGR = process.env.OGR2OGR || join(LIB, 'bin', 'ogr2ogr.exe');
  const r = spawnSync(OGR, ['-f', 'GeoJSONSeq', '-t_srs', 'EPSG:4326', '-dim', 'XY', '-lco', 'COORDINATE_PRECISION=7', '-select', 'LOWPARCELID', GJ, join(RAW, 'g', 'Parcels.gdb')],
    { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, PROJ_DATA: join(LIB, 'share', 'proj'), GDAL_DATA: join(LIB, 'share', 'gdal') } });
  if (r.status !== 0) throw new Error('ogr2ogr failed: ' + (r.stderr || r.error));
  log('parcels.ndjson written by ogr2ogr');
}
let nShp = 0, nHit = 0;
for await (const ln of createInterface({ input: createReadStream(GJ, { encoding: 'utf8' }), crlfDelay: Infinity })) {
  if (!ln) continue; nShp++; const f = JSON.parse(ln), g = f.geometry; if (!g) continue;
  const h = homes.get(String(f.properties.LOWPARCELID || '').trim()); if (!h) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const poly of polys) for (const ring of poly) h.rings.push(ring);
  nHit++;
}
log(`outlines: ${nShp} parcels, ${nHit} matched a single-family account`);

const out = createWriteStream(join(RAW, 'norm.ndjson')); let n = 0, nHsOut = 0;
for (const h of homes.values()) { if (!h.rings.length) continue; delete h._o; if (h.hs) nHsOut++; out.write(JSON.stringify(h) + '\n'); n++; }
await new Promise((ok) => out.end(ok));
log(`norm.ndjson: ${n} single-family homes with an outline (${homes.size - n} without one left out), ${nHsOut} homesteads`);

/* Year built (and, for Douglas, year remodeled, roof shape and roof material) per door, from the free county
   assessor files (2026-10-04, overnight job). Admins only in the app, like hail and roofs.
 *
 * Sources (downloaded into raw/, gitignored: they carry owners' names):
 *   El Paso  https://assessor.elpasoco.com/assessordata/  EPC Parcel Data.txt (tab-delimited, header row; weekly)
 *            PARCEL, YearBlt, IMPSQFT (building sq ft), RESSTYLE
 *   Douglas  https://www.douglasco.gov/?p=127732  (no header rows; monthly)
 *            Property_Location.txt     col 0 account, col 2 state parcel number
 *            Property_Improvements.txt col 0 account, 1 building no., 2 type, 5 style, 8 sq ft, 17 roof shape,
 *                                      22 roof material, 26 year built, 27 year remodeled (0 = none)
 *            Columns read from the rows themselves (no layout file is published); checked on sample houses.
 * Doors are matched through the town CSVs (address -> parcel), the same lists the door files are built from.
 *   Adams    https://adamscountyco.gov/our-county/elected-officials/assessor/maps-data/  Appraisal_<year>_<n>.zip, Built_As.TXT
 *            (fixed width, layout in Appraisal_FileLayout.doc): PARCELNB 11+13, BLTASSF 37+12, ROOFTYPE 184+20, ROOFCOVER 204+20,
 *            YRBLT 362+5, YRREM 367+5. The largest building on the parcel is the house.
 *   Boulder  https://bouldercounty.gov/property-and-land/assessor/data-download/  Buildings.csv + Account_Parcels.csv (by strap)
 *   Denver   open data "Real Property Residential Characteristics" via fetch-denver.mjs -> raw/denver/residential.json
 *   node build-year.mjs     writes app/data/rounds/year-<town>.json { doors: { id: { yb, rm?, shape?, mat?, bsf? } } } */
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* TRAVERSE_ROOT (2026-10-31, optional): the traverse/ folder holding the data (raw/, the town CSVs, app/data/rounds), i.e. the main
   checkout when this runs from a worktree; town-county.json is still read beside this file. */
const HERE = dirname(fileURLToPath(import.meta.url));
const DT = process.env.TRAVERSE_ROOT ? join(process.env.TRAVERSE_ROOT, 'data-pipeline', 'door-territory') : join(HERE, '..'), RAW = join(DT, 'assessor', 'raw');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas', 'highlands-ranch': 'douglas', parker: 'douglas', 'castle-pines': 'douglas', 'cs-northeast': 'elpaso', 'cs-southeast': 'elpaso', 'security-widefield': 'elpaso', 'fountain': 'elpaso', 'cs-northwest': 'elpaso', 'cs-southwest': 'elpaso',
  /* 2026-10-10: the Front Range Roofing towns. Adams and Boulder record roof cover; Denver gives year built and remodel; Arapahoe
     (Centennial) publishes nothing in bulk. Thornton and Erie straddle Weld: both counties are read for them. */
  thornton: ['adams', 'weld'], 'commerce-city': 'adams', erie: ['boulder', 'weld'], denver: 'denver' };
/* every other town in a county whose files we hold (2026-10-20, Matthew: year built for the metro towns, so the lot preview can say a house
   was built after the aerial photo). town-county.json: each town's counties from sample doors; the towns listed above keep their entries. */
const COUNTY_KEY = { 'El Paso': 'elpaso', Douglas: 'douglas', Adams: 'adams', Boulder: 'boulder', Denver: 'denver', Weld: 'weld', Larimer: 'larimer', Mesa: 'mesa' };
const TC = existsSync(join(HERE, 'town-county.json')) ? JSON.parse(readFileSync(join(HERE, 'town-county.json'), 'utf8')) : {};
for (const [town, cs] of Object.entries(TC)) {
  if (town.startsWith('_') || TOWNS[town] || !Array.isArray(cs)) continue;
  const ks = cs.map((c) => COUNTY_KEY[c]).filter(Boolean);
  if (ks.length) TOWNS[town] = ks.length === 1 ? ks[0] : ks;
}
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
if (ONLY.length) for (const t of Object.keys(TOWNS)) if (!ONLY.includes(t)) delete TOWNS[t];
const q = (line) => line.replace(/^"|"\s*$/g, '').split('","');
const lines = async (f, fn) => { const rl = createInterface({ input: createReadStream(f), crlfDelay: Infinity }); for await (const l of rl) if (l) fn(l); };

/* El Paso: parcel -> { yb, bsf } */
async function elPaso() {
  const m = new Map(); let head = null;
  await lines(join(RAW, 'EPC Parcel Data.txt'), (l) => {
    const c = l.split('\t'); if (!head) { head = c.map((s) => s.trim()); return; }
    const p = (c[head.indexOf('PARCEL')] || '').trim(), yb = +(c[head.indexOf('YearBlt')] || '').trim(), sf = +(c[head.indexOf('IMPSQFT')] || '').trim();
    if (p && yb > 1800) m.set(p, { yb, bsf: sf > 0 ? Math.round(sf) : undefined });
  });
  return m;
}
/* Douglas: parcel -> the main residential building's facts */
async function douglas() {
  const acct = new Map();   /* state parcel number -> account */
  await lines(join(RAW, 'Property_Location.txt'), (l) => { const c = q(l); if (c[2]) acct.set(c[0], c[2]); });
  const best = new Map();   /* account -> building 1 (or the first residential one) */
  await lines(join(RAW, 'Property_Improvements.txt'), (l) => {
    const c = q(l); if (!/^R/.test(c[0]) || !/Residential/i.test(c[2] || '') && !/Residential/i.test(c[7] || '')) return;
    const yb = +c[26]; if (!(yb > 1800)) return;
    const cur = best.get(c[0]);
    if (cur && cur.no <= +c[1]) return;
    best.set(c[0], { no: +c[1], yb, rm: +c[27] > yb ? +c[27] : undefined, shape: c[17] || undefined, mat: c[22] || undefined, bsf: +c[8] > 0 ? Math.round(+c[8]) : undefined });
  });
  const m = new Map();
  for (const [a, b] of best) { const p = acct.get(a); if (p) { const { no, ...rest } = b; m.set(p, rest); } }
  return m;
}
/* Adams: parcel -> the largest building's facts */
async function adams() {
  const m = new Map(), cut = (l, a, n) => l.substr(a, n).trim();
  await lines(join(RAW, 'adams', 'Built_As.TXT'), (l) => {
    const p = cut(l, 11, 13), yb = +cut(l, 362, 5), sf = +cut(l, 37, 12); if (!p || !(yb > 1800)) return;
    const cur = m.get(p); if (cur && (cur.bsf || 0) >= sf) return;
    const rm = +cut(l, 367, 5);
    m.set(p, { yb, rm: rm > yb ? rm : undefined, shape: cut(l, 184, 20) || undefined, mat: cut(l, 204, 20) || undefined, bsf: sf > 0 ? Math.round(sf) : undefined });
  });
  return m;
}
/* Boulder: parcel -> the largest building's facts. Buildings.csv is by account (strap); Account_Parcels.csv joins strap to the
   12-digit parcel number. EffectiveYear is an appraisal age, not a remodel date, so it is not used as one. */
/* one CSV line: quoted and bare fields both occur (empty ones are bare: ,,,) */
const csvRow = (l) => { const o = []; let f = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i];
  if (q) { if (ch === '"') { if (l[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
  else if (ch === '"') q = true; else if (ch === ',') { o.push(f); f = ''; } else if (ch !== '\r') f += ch; }
  o.push(f); return o; };
async function boulder() {

  const best = new Map(); let h = null;
  await lines(join(RAW, 'boulder', 'Buildings.csv'), (l) => {
    const c = csvRow(l); if (!h) { h = c; return; }
    const g = (k) => (c[h.indexOf(k)] || '').trim();
    const yb = +g('builtYear'), sf = +g('TotalFinishedSF') || +g('mainfloorSF') || 0; if (!(yb > 1800)) return;
    const cur = best.get(g('strap')); if (cur && (cur.bsf || 0) >= sf) return;
    best.set(g('strap'), { yb, mat: g('Roof_CoverDscr') || undefined, bsf: sf > 0 ? Math.round(sf) : undefined });
  });
  const m = new Map(); let h2 = null;
  const apF = join(RAW, 'boulder', 'Account_Parcels.csv'); if (!existsSync(apF)) return m;
  await lines(apF, (l) => {
    const c = csvRow(l); if (!h2) { h2 = c.map((x) => x.toLowerCase()); return; }
    const st = (c[h2.indexOf('strap')] || '').trim(), p = (c[h2.indexOf('parcelno')] || '').trim();
    if (st && p && best.has(st) && !m.has(p)) m.set(p, best.get(st));
  });
  return m;
}
/* Weld: parcel -> the largest building's facts. ImpsCurrentInvntry.csv by account, AcctCurrentInvntry.csv joins account to
   parcel. Headers carry stray spaces (" ACCOUNTNO"). */
async function weld() {
  const best = new Map(); let h = null;
  await lines(join(RAW, 'weld', 'ImpsCurrentInvntry.csv'), (l) => {
    const c = csvRow(l); if (!h) { h = c.map((x) => x.trim().toUpperCase()); return; }
    const g = (k) => (c[h.indexOf(k)] || '').trim();
    const yb = +g('YRBLT'), sf = +g('BLTASSF') || +g('SF') || 0; if (!(yb > 1800)) return;
    const a = g('ACCOUNTNO'), cur = best.get(a); if (cur && (cur.bsf || 0) >= sf) return;
    const rm = +g('YRREMODELED');
    best.set(a, { yb, rm: rm > yb ? rm : undefined, shape: g('ROOFTYPE') || undefined, mat: g('ROOFCOVER') || undefined, bsf: sf > 0 ? Math.round(sf) : undefined });
  });
  const m = new Map(); let h2 = null;
  await lines(join(RAW, 'weld', 'AcctCurrentInvntry.csv'), (l) => {
    const c = csvRow(l); if (!h2) { h2 = c.map((x) => x.trim().toUpperCase()); return; }
    const a = (c[h2.indexOf('ACCOUNTNO')] || '').trim(), p = (c[h2.indexOf('PARCELNB')] || '').trim();
    if (a && p && best.has(a) && !m.has(p)) m.set(p, best.get(a));
  });
  return m;
}
/* Denver: parcel -> year built, remodel (fetch-denver.mjs) */
function denver() {
  const m = new Map(), f = join(RAW, 'denver', 'residential.json');
  if (!existsSync(f)) return m;
  for (const [p, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')))) m.set(p, v[1] ? { yb: v[0], rm: v[1] } : { yb: v[0] });
  return m;
}
function parseCSV(s) {
  const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/* digits only, no leading zeros (Mesa's door lists write 2945-074-22-020, its parcel layer 294507422020) */
const pkey = (p) => String(p ?? '').replace(/\D/g, '').replace(/^0+/, '');
/* Larimer (2026-10-31): the assessor's Public Data Center improvement table, larimer.gov/assessor/publicdata ->
   storage.googleapis.com/lc-public/asr/assessor-public-improvement.csv (no owner fields in it; the page: "available 24/7 and free to
   the public", disclaimer only, "The data shall be used and relied upon only at the risk of the user"). One row per building: the
   largest residential building on the parcel is the house. ROOFCOVER, ROOFTYPE, BLTASYEARBUILT, YEARREMODELED, SF. A few hand-typed
   spellings of composition shingle are folded into the county's usual one so features.py's CLASS_OF knows them. */
async function larimer() {
  const best = new Map(); let h = null;
  const COMP = /^comp(osition)? shingle$/i, HEAVY = /^comp shingle heavy$/i;
  await lines(join(RAW, 'larimer', 'improvement.csv'), (l) => {
    const c = csvRow(l); if (!h) { h = c.map((x) => x.trim().toUpperCase()); return; }
    const g = (k) => (c[h.indexOf(k)] || '').trim();
    if (!/resid|town|duplex|triplex|manufact|mobile/i.test(g('PROPERTYTYPE') + ' ' + g('OCCDESCRIPTION'))) return;
    const yb = +g('BLTASYEARBUILT'), sf = +g('SF') || 0; if (!(yb > 1800)) return;
    const p = pkey(g('PARCELNO')), cur = best.get(p); if (!p || (cur && (cur.bsf || 0) >= sf)) return;
    let mat = g('ROOFCOVER'); if (COMP.test(mat)) mat = 'Composition Shingle'; else if (HEAVY.test(mat)) mat = 'Comp Shingle Heavy';
    const rm = +g('YEARREMODELED');
    best.set(p, { yb, rm: rm > yb ? rm : undefined, shape: g('ROOFTYPE') || undefined, mat: mat || undefined, bsf: sf > 0 ? Math.round(sf) : undefined });
  });
  return best;
}
/* Mesa (2026-10-31): year built only (AYB1ST, the first building's actual year built) from the county's Open_Data Tax Parcels layer
   (mcgis.mesacounty.us .../maps/Open_Data/MapServer/55), already fetched by moved/fetch-arcgis.mjs without owner fields. Mesa
   publishes no roof cover, so it adds no county roof records: the year is for the card and the lawn "built after our photo" note. */
function mesa() {
  const m = new Map(), f = join(RAW, 'mesa', 'mesa-parcels.json'); if (!existsSync(f)) return m;
  const j = JSON.parse(readFileSync(f, 'utf8')), iP = j.fields.indexOf('PARCELNUM'), iY = j.fields.indexOf('AYB1ST');
  for (const r of j.rows) { const p = pkey(r[iP]), yb = +r[iY]; if (p && yb > 1800 && !m.has(p)) m.set(p, { yb }); }
  return m;
}
/* only the counties the (--only) towns need are read (2026-10-31) */
const NEED = new Set(Object.values(TOWNS).flat());
const ep = NEED.has('elpaso') && existsSync(join(RAW, 'EPC Parcel Data.txt')) ? await elPaso() : new Map();
const dg = NEED.has('douglas') && existsSync(join(RAW, 'Property_Improvements.txt')) ? await douglas() : new Map();
const ad = NEED.has('adams') && existsSync(join(RAW, 'adams', 'Built_As.TXT')) ? await adams() : new Map();
const bo = NEED.has('boulder') && existsSync(join(RAW, 'boulder', 'Buildings.csv')) ? await boulder() : new Map();
const dn = NEED.has('denver') ? denver() : new Map();
const wd = NEED.has('weld') && existsSync(join(RAW, 'weld', 'ImpsCurrentInvntry.csv')) ? await weld() : new Map();
const lr = NEED.has('larimer') && existsSync(join(RAW, 'larimer', 'improvement.csv')) ? await larimer() : new Map();
const ms = NEED.has('mesa') ? mesa() : new Map();
console.log(`El Paso parcels with a year built: ${ep.size}; Douglas residential parcels: ${dg.size}; Adams ${ad.size}; Boulder ${bo.size}; Denver ${dn.size}; Weld ${wd.size}; Larimer ${lr.size}; Mesa ${ms.size}`);
const SRC = { elpaso: ep, douglas: dg, adams: ad, boulder: bo, denver: dn, weld: wd, larimer: lr, mesa: ms };
let tot = 0, hit = 0;
for (const [town, county] of Object.entries(TOWNS)) {
  const csvF = join(DT, `${town}.csv`), doorF = join(DATA, `${town}.json`);
  if (!existsSync(csvF) || !existsSync(doorF)) { console.log(`  ${town}: no list`); continue; }
  const rows = parseCSV(readFileSync(csvF, 'utf8')), h = rows[0];
  const iA = h.indexOf('address'), iP = h.indexOf('parcel');
  const parcelOf = new Map(); for (const r of rows.slice(1)) if (r[iA] && r[iP]) parcelOf.set(r[iA].trim().toUpperCase(), r[iP].trim());
  const srcs = (Array.isArray(county) ? county : [county]).map((k) => SRC[k] || new Map()), doors = {};
  const src = { get: (p) => { for (const m of srcs) { const v = m.get(p); if (v) return v; } return undefined; } };
  const d = JSON.parse(readFileSync(doorF, 'utf8'));
  let n = 0, k = 0;
  for (const a of d.areas) for (const x of a.doors) {
    n++; const p = parcelOf.get(String(x.address).trim().toUpperCase()); const f = p && (src.get(p) || src.get(p.replace(/^0+/, '')) || src.get(pkey(p)));
    if (f) { doors[x.id] = f; k++; }
  }
  writeFileSync(join(DATA, `year-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), county, doors }));
  console.log(`  year-${town}.json: ${k} of ${n} doors`);
  tot += n; hit += k;
}
console.log(`${hit} of ${tot} doors matched (${(100 * hit / Math.max(1, tot)).toFixed(1)}%)`);

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
 *   node build-year.mjs     writes app/data/rounds/year-<town>.json { doors: { id: { yb, rm?, shape?, mat?, bsf? } } } */
import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), RAW = join(HERE, 'raw'), DT = join(HERE, '..');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas' };
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
function parseCSV(s) {
  const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const ep = existsSync(join(RAW, 'EPC Parcel Data.txt')) ? await elPaso() : new Map();
const dg = existsSync(join(RAW, 'Property_Improvements.txt')) ? await douglas() : new Map();
console.log(`El Paso parcels with a year built: ${ep.size}; Douglas residential parcels: ${dg.size}`);
let tot = 0, hit = 0;
for (const [town, county] of Object.entries(TOWNS)) {
  const csvF = join(DT, `${town}.csv`), doorF = join(DATA, `${town}.json`);
  if (!existsSync(csvF) || !existsSync(doorF)) { console.log(`  ${town}: no list`); continue; }
  const rows = parseCSV(readFileSync(csvF, 'utf8')), h = rows[0];
  const iA = h.indexOf('address'), iP = h.indexOf('parcel');
  const parcelOf = new Map(); for (const r of rows.slice(1)) if (r[iA] && r[iP]) parcelOf.set(r[iA].trim().toUpperCase(), r[iP].trim());
  const src = county === 'elpaso' ? ep : dg, doors = {};
  const d = JSON.parse(readFileSync(doorF, 'utf8'));
  let n = 0, k = 0;
  for (const a of d.areas) for (const x of a.doors) {
    n++; const p = parcelOf.get(String(x.address).trim().toUpperCase()); const f = p && (src.get(p) || src.get(p.replace(/^0+/, '')));
    if (f) { doors[x.id] = f; k++; }
  }
  writeFileSync(join(DATA, `year-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), county, doors }));
  console.log(`  year-${town}.json: ${k} of ${n} doors`);
  tot += n; hit += k;
}
console.log(`${hit} of ${tot} doors matched (${(100 * hit / Math.max(1, tot)).toFixed(1)}%)`);

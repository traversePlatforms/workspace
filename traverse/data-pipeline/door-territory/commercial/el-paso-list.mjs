/* El Paso's part of the commercial building list (2026-10-31; the state parcel layer carries no attributes for El Paso).
 * INTERNAL ONLY, like pull-statewide.mjs: writes <outdir>/el-paso.json (commercial/out/ is gitignored), never uploaded.
 *   node el-paso-list.mjs <outdir>
 * Reads the assessor's weekly EPC Parcel Data.txt (assessor/raw/, already used for year built). Only these columns: PARCEL,
 * LOCATION, LOCATIONZIP, ZONING, MARKETVALUE, Acreage, IMPSTATEDESCR, YearBlt, IMPSQFT, UNITS, LastUpdate. Never the owner or
 * mailing columns. No map point in this file: the parcel number joins to the county's parcel map later if wanted.
 * TRAVERSE_ROOT (optional): the traverse/ folder holding assessor/raw (the main checkout when run from a worktree). */
import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = process.env.TRAVERSE_ROOT ? join(process.env.TRAVERSE_ROOT, 'data-pipeline', 'door-territory') : join(HERE, '..');
const OUT = process.argv[2]; if (!OUT) { console.error('outdir needed'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const EP_USE = new Set(['WAREHOUSE/STORAGE', 'SPECIAL PURPOSE', 'MULTI-UNITS (4-8)', 'MULTI-UNITS (9 & UP)', 'MERCHANDISING', 'OFFICES',
  'MANUFACTURING/PROCESSING', 'LODGING', 'RECREATION', 'NEIGHBORHOOD SHOPPING CENTER', 'BAR/TAVERN', 'MODULAR OFFICE']);
const kind = (u) => /MULTI/.test(u) ? 'apartments' : /WAREHOUSE|MANUFACTUR/.test(u) ? 'industrial' : 'commercial';
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const best = new Map(); let head = null, asof = '';
const rl = createInterface({ input: createReadStream(join(DT, 'assessor', 'raw', 'EPC Parcel Data.txt')), crlfDelay: Infinity });
for await (const l of rl) {
  if (!l) continue; const c = l.split('\t');
  if (!head) { head = c.map((x) => x.trim()); continue; }
  const g = (k) => clean(c[head.indexOf(k)]);
  const use = g('IMPSTATEDESCR'); if (!EP_USE.has(use)) continue;
  if (!asof) asof = g('LastUpdate');
  const p = g('PARCEL'), sf = +g('IMPSQFT') || 0, cur = best.get(p);
  if (cur && (cur.sqft || 0) >= sf) continue;   /* one row per building: keep the largest */
  const yb = +g('YearBlt');
  best.set(p, { county: 'El Paso', parcel: p, address: g('LOCATION'), zip: g('LOCATIONZIP'), use, kind: kind(use), zoning: g('ZONING') || undefined,
    acres: +g('Acreage') || undefined, value: +g('MARKETVALUE') || undefined, yb: yb > 1800 ? yb : undefined, sqft: sf || undefined, units: +g('UNITS') || undefined });
}
const rows = [...best.values()], by = {}; for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
writeFileSync(join(OUT, 'el-paso.json'), JSON.stringify({ source: 'El Paso County Assessor, EPC Parcel Data.txt', asof, built: new Date().toISOString().slice(0, 10), county: 'El Paso', rows }));
console.log(`El Paso: ${rows.length} commercial parcels ${JSON.stringify(by)}`);

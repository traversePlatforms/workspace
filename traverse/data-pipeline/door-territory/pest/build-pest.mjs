/* Pest facts per door for TraversePest (2026-10-06): the reasons a door is worth knocking that need no customers yet.
 *
 *   node build-pest.mjs            fetches what is missing into cache/, then writes app/data/rounds/pest-<town>.json
 *                                  and copies pest-season.json beside them
 * Per door { os?, wa?, yb?, sold? }:
 *   os    open space the house backs onto or sits next to (within 90 m of the house point): { n: name, k: kind, d: metres }
 *         from COMaP, Colorado's map of protected and public land (the state's copy: Governor's Office of IT, 2026-07-17);
 *   wa    the nearest creek, river or ditch (within 100 m) or pond or lake (within 150 m): { n, k, d }
 *         from the USGS National Hydrography Dataset, large scale (hydro.nationalmap.gov nhd MapServer 6 and 12);
 *   yb    year built (the county files, already matched in year-<town>.json; El Paso and Douglas);
 *   sold  the last sale, 'YYYY-MM', from El Paso's assessor file (SALEDATE). Douglas's free files carry no sale date.
 * Only the sale MONTH leaves this script; the assessor file's owner columns are never read. Facts only: the card states
 * what is near the house, it does not score pest risk. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream, copyFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds'), CACHE = join(HERE, 'cache');
const COMAP = 'https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/CoMAP/FeatureServer/0/query';
const NHD = 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer';
const ELPASO = new Set(['monument', 'palmer-lake', 'black-forest']);
const OS_M = 90, CREEK_M = 100, POND_M = 150;
mkdirSync(CACHE, { recursive: true });

/* ---- geometry in metres around a town (equirectangular is plenty at this size) ---- */
const proj = (lat0) => { const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540; return ([lon, lat]) => [lon * kx, lat * ky]; };
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); }
function lineDist(p, pts) { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, segDist(p, pts[i - 1], pts[i])); return m; }
function inRing(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
const bbOf = (lines) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const l of lines) for (const [x, y] of l) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
const near = (p, bb, m) => p[0] >= bb[0] - m && p[0] <= bb[2] + m && p[1] >= bb[1] - m && p[1] <= bb[3] + m;
function polyDist(p, rings) { if (inRing(p, rings[0]) && !rings.slice(1).some((h) => inRing(p, h))) return 0; let m = Infinity; for (const r of rings) m = Math.min(m, lineDist(p, r)); return m; }

async function getJSON(url, tries = 4) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) { if (i >= tries) throw e; await new Promise((res) => setTimeout(res, 1500 * (i + 1))); }
  }
}
/* every feature in a box, paged (ArcGIS caps a page) */
async function features(base, box, fields, cacheName) {
  const f = join(CACHE, cacheName);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const q = new URLSearchParams({ where: '1=1', geometry: box.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: fields, outSR: '4326', returnGeometry: 'true', f: 'json', resultOffset: String(offset), resultRecordCount: '1000' });
    const j = await getJSON(`${base}/query?${q}`);
    if (j.error) throw new Error(cacheName + ': ' + JSON.stringify(j.error).slice(0, 200));
    for (const x of j.features || []) out.push({ a: x.attributes, g: x.geometry });
    if (!j.exceededTransferLimit && (j.features || []).length < 1000) break;
  }
  writeFileSync(f, JSON.stringify(out));
  return out;
}

/* ---- the kind of open space, in words a rep would say ---- */
function osKind(a) {
  const d = String(a.MGMT_DESCR || ''), o = String(a.OWNER_DETA || a.OWNER || '');
  if (/park/i.test(d)) return 'park';
  if (/private/i.test(d) || /PRIVATE/i.test(a.OWNER || '')) return 'protected land';
  if (/golf/i.test(String(a.NAME || ''))) return 'golf course';
  if (/state|federal|national|forest|BLM|wildlife/i.test(d + ' ' + o)) return 'public land';
  return 'open space';
}
const waterKind = (ftype, isBody) => isBody ? (ftype === 436 ? 'reservoir' : ftype === 466 ? 'wetland' : 'pond or lake') : (ftype === 336 ? 'ditch or canal' : ftype === 558 ? 'creek' : 'creek');

/* ---- El Paso: parcel -> last sale month (only PARCEL and SALEDATE are read) ---- */
async function elPasoSales() {
  const f = join(DT, 'assessor', 'raw', 'EPC Parcel Data.txt'), m = new Map();
  if (!existsSync(f)) return m;
  let head = null, iP = -1, iS = -1;
  const rl = createInterface({ input: createReadStream(f), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l) continue;
    const c = l.split('\t');
    if (!head) { head = c.map((s) => s.trim()); iP = head.indexOf('PARCEL'); iS = head.indexOf('SALEDATE'); continue; }
    const p = (c[iP] || '').trim(), s = (c[iS] || '').trim(); if (!p || !s) continue;
    let y, mo; const ymd = s.match(/^(\d{4})(\d{2})(\d{2})$/), iso = s.match(/^(\d{4})-(\d{2})/), us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ymd) { y = +ymd[1]; mo = +ymd[2]; } else if (iso) { y = +iso[1]; mo = +iso[2]; } else if (us) { y = +us[3]; mo = +us[1]; } else continue;   /* El Paso writes YYYYMMDD */
    if (y < 1900 || y > 2100 || mo < 1 || mo > 12) continue;
    m.set(p, `${y}-${String(mo).padStart(2, '0')}`);
  }
  return m;
}
function parseCSV(t) { const rows = []; let r = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; } else if (ch === '"') q = true; else if (ch === ',') { r.push(f); f = ''; } else if (ch === '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (ch !== '\r') f += ch; } if (f || r.length) { r.push(f); rows.push(r); } return rows; }

const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const sales = await elPasoSales();
console.log(`El Paso parcels with a sale date: ${sales.size}`);
let tot = 0; const hit = { os: 0, wa: 0, yb: 0, sold: 0 };
for (const reg of idx.regions) {
  const town = reg.key; if (town.startsWith('com-')) continue;
  const f = join(DATA, `${town}.json`); if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const pts = d.areas.flatMap((a) => a.doors).filter((x) => x.lat != null);
  if (!pts.length) continue;
  const lats = pts.map((x) => x.lat), lons = pts.map((x) => x.lon), pad = 0.004;
  const box = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad];
  const P = proj((box[1] + box[3]) / 2);
  /* COMaP also carries unnamed private shapes that cover whole subdivisions (2026-10-06: every Monument and Castle Rock house
     sat inside one). Those are not open land a house backs onto: drop them, and never count a house inside a shape (below). */
  const os = (await features(COMAP, box, 'NAME,OWNER,OWNER_DETA,MGMT_DESCR', `comap-${town}.json`)).filter((x) => x.g && x.g.rings)
    .filter((x) => String(x.a.NAME || '').trim() || osKind(x.a) !== 'protected land')
    .map((x) => ({ n: String(x.a.NAME || '').trim(), k: osKind(x.a), rings: x.g.rings.map((r) => r.map(P)) })).map((x) => Object.assign(x, { bb: bbOf(x.rings) }));
  /* named creeks only: the large-scale lines also draw every unnamed dry gully (a third of houses were "near water") */
  const creeks = (await features(`${NHD}/6`, box, 'gnis_name,ftype', `creeks-${town}.json`)).filter((x) => x.g && x.g.paths && String(x.a.gnis_name || x.a.GNIS_NAME || '').trim())
    .map((x) => ({ n: String(x.a.gnis_name || x.a.GNIS_NAME || '').trim(), k: waterKind(+(x.a.ftype ?? x.a.FTYPE), false), paths: x.g.paths.map((p) => p.map(P)) })).map((x) => Object.assign(x, { bb: bbOf(x.paths) }));
  const ponds = (await features(`${NHD}/12`, box, 'gnis_name,ftype', `ponds-${town}.json`)).filter((x) => x.g && x.g.rings)
    .map((x) => ({ n: String(x.a.gnis_name || x.a.GNIS_NAME || '').trim(), k: waterKind(+(x.a.ftype ?? x.a.FTYPE), true), rings: x.g.rings.map((r) => r.map(P)) })).map((x) => Object.assign(x, { bb: bbOf(x.rings) }));
  const yearF = join(DATA, `year-${town}.json`), years = existsSync(yearF) ? JSON.parse(readFileSync(yearF, 'utf8')).doors : {};
  /* address -> parcel from the town list (only those two columns are read) */
  const parcelOf = new Map();
  if (ELPASO.has(town) && existsSync(join(DT, `${town}.csv`))) {
    const rows = parseCSV(readFileSync(join(DT, `${town}.csv`), 'utf8')), h = rows[0], iA = h.indexOf('address'), iP = h.indexOf('parcel');
    for (const r of rows.slice(1)) if (r[iA] && r[iP]) parcelOf.set(r[iA].trim().toUpperCase(), r[iP].trim());
  }
  const doors = {};
  for (const x of pts) {
    tot++;
    const p = P([x.lon, x.lat]), o = {};
    /* a house inside a shape is not "next to" it: only land outside the house point, within OS_M */
    let bo = null; for (const s of os) { if (!near(p, s.bb, OS_M)) continue; const dd = polyDist(p, s.rings); if (dd > 0 && dd <= OS_M && (!bo || dd < bo.d)) bo = { n: s.n, k: s.k, d: Math.round(dd) }; }
    if (bo) { o.os = bo; hit.os++; }
    let bw = null;
    for (const c of creeks) { if (!near(p, c.bb, CREEK_M)) continue; const dd = Math.min(...c.paths.map((pp) => lineDist(p, pp))); if (dd <= CREEK_M && (!bw || dd < bw.d)) bw = { n: c.n, k: c.k, d: Math.round(dd) }; }
    for (const w of ponds) { if (!near(p, w.bb, POND_M)) continue; const dd = polyDist(p, w.rings); if (dd > 0 && dd <= POND_M && (!bw || dd < bw.d)) bw = { n: w.n, k: w.k, d: Math.round(dd) }; }
    if (bw) { o.wa = bw; hit.wa++; }
    if (years[x.id] && years[x.id].yb) { o.yb = years[x.id].yb; hit.yb++; }
    if (parcelOf.size) { const pc = parcelOf.get(String(x.address).trim().toUpperCase()); const s = pc && (sales.get(pc) || sales.get(pc.replace(/^0+/, ''))); if (s) { o.sold = s; hit.sold++; } }
    if (Object.keys(o).length) doors[x.id] = o;
  }
  writeFileSync(join(DATA, `pest-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), doors }));
  console.log(`  pest-${town}.json: ${Object.keys(doors).length} doors (${os.length} open-space areas, ${creeks.length} creek lines, ${ponds.length} ponds)`);
}
copyFileSync(join(HERE, 'pest-season.json'), join(DATA, 'pest-season.json'));
console.log(`${tot} doors: open space ${hit.os}, water ${hit.wa}, year built ${hit.yb}, sale month ${hit.sold}`);

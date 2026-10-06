/* Commercial test (2026-10-05): apartment, commercial and industrial parcels in three storm-heavy spots.
 *
 *   node pull-parcels.mjs            writes out/parcels-<spot>.json (gitignored: owner names)
 *
 * Springs (El Paso): the statewide composite carries no attributes for El Paso, so geometry comes from the county's
 *   MailingLabelParcels service and everything else from the county's weekly assessor file (../assessor/raw/EPC Parcel
 *   Data.txt), joined on PARCEL. Use = IMPSTATEDESCR.
 * South (Arapahoe + a little Douglas) and West (Denver + Jefferson): the statewide composite, use = landUseDsc.
 *
 * Condominium units are left out on purpose: a condo's roof belongs to its association, not to the unit owner, so the
 * owner of record is the wrong person to reach. Churches, schools, government and other exempt owners are left out too.
 */
import { readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const EPC = join(HERE, '..', 'assessor', 'raw', 'EPC Parcel Data.txt');
const COMPOSITE = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const EPSVC = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/MailingLabelParcels/MapServer/0/query';
export const SPOTS = {
  springs: { label: 'Colorado Springs east', lat: 38.850, lon: -104.725, r: 4000, src: 'elpaso' },
  south: { label: 'South metro (Centennial / Englewood)', lat: 39.585, lon: -104.905, r: 4000, src: 'composite' },
  west: { label: 'West Denver / Lakewood', lat: 39.720, lon: -105.040, r: 4000, src: 'composite' },
};

const EP_USE = new Set(['WAREHOUSE/STORAGE', 'SPECIAL PURPOSE', 'MULTI-UNITS (4-8)', 'MULTI-UNITS (9 & UP)', 'MERCHANDISING', 'OFFICES',
  'MANUFACTURING/PROCESSING', 'LODGING', 'RECREATION', 'NEIGHBORHOOD SHOPPING CENTER', 'BAR/TAVERN', 'MODULAR OFFICE']);
const CO_IN = /commercial|office|merchandis|warehouse|industrial|special purpose|lodging|multi-unit|multi unit|apartment|4 to 8 units|retail|r&d|flex|auto service|auto dealer|restaurant|mixed use|factory|conv store|hotel|motel|shopping|bank|medical|nursing|recreation|mixed assessment|market|store|car wash|elderly|hall|big box|supermarket|converted res/i;
const CO_OUT = /condo|church|school|religious|charitable|political|park|vacant|common element|^exempt|non taxable|state non|county non/i;

export function kind(use) {
  const u = String(use || '').toUpperCase();
  if (/MULTI|APART|4 TO 8|UNITS/.test(u)) return 'apartments';
  if (/WAREHOUSE|INDUSTRIAL|MANUFACTUR|FACTORY|FLEX|R&D/.test(u)) return 'industrial';
  return 'commercial';
}

async function getJSON(url, body) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DoorApp-commercial-test/1.0' } });
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j;
    } catch (e) { if (t === 3) throw e; await new Promise((z) => setTimeout(z, 1500 * (t + 1))); }
  }
}
async function pageAll(url, params) {
  const { returnGeometry, outSR, outFields, ...base } = params;
  const total = (await getJSON(url, new URLSearchParams({ ...base, returnCountOnly: 'true', f: 'json' }))).count;
  const byId = new Map(); let off = 0, pages = 0;
  const fields = outFields === '*' ? '*' : outFields + ',OBJECTID';
  while (byId.size < total && pages++ < 200) {
    const j = await getJSON(url, new URLSearchParams({ ...params, outFields: fields, orderByFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '1000', f: 'json' }));
    if (!j.features.length) break; for (const f of j.features) byId.set(f.attributes.OBJECTID, f); off += j.features.length;
  }
  if (byId.size !== total) throw new Error('paging got ' + byId.size + ' unique of ' + total);
  return [...byId.values()];
}
const circle = (s) => ({ geometry: `${s.lon},${s.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', distance: String(s.r), units: 'esriSRUnit_Meter', outSR: '4326', returnGeometry: 'true' });

function ringCentroid(ring) {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += f; x += (ring[j][0] + ring[i][0]) * f; y += (ring[j][1] + ring[i][1]) * f; }
  if (!a) return ring[0]; return [x / (3 * a), y / (3 * a)];
}
const shape = (g) => { const rings = (g && g.rings) || []; const outer = rings.slice().sort((p, q) => q.length - p.length)[0] || []; const ring = outer.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]); const [lon, lat] = ring.length ? ringCentroid(ring) : [null, null]; return { ring, lat: lat && +lat.toFixed(6), lon: lon && +lon.toFixed(6) }; };
const day = (v) => { if (v == null || v === '') return null; const d = new Date(typeof v === 'number' ? v : String(v)); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const distM = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };

async function elPaso(s) {
  const want = new Map();
  let head = null;
  const rl = createInterface({ input: createReadStream(EPC), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l) continue; const c = l.split('\t');
    if (!head) { head = c.map((x) => x.trim()); continue; }
    const g = (k) => clean(c[head.indexOf(k)]);
    const use = g('IMPSTATEDESCR'); if (!EP_USE.has(use)) continue;
    want.set(g('PARCEL'), { use, addr: g('LOCATION'), zip: g('LOCATIONZIP'), owner: g('OWNER1'), owner2: [g('OWNER2'), g('OWNER3')].filter(Boolean).join(' / '),
      mail: { adr: g('MAILADR'), city: g('MAILCITY'), st: g('MAILSTATE'), zip: g('MAILZIPCODE') }, acres: +g('Acreage') || null, value: +g('MARKETVALUE') || null,
      yb: +g('YearBlt') || null, sqft: +g('IMPSQFT') || null, units: +g('UNITS') || null, saleDate: g('SALEDATE') || null, salePrice: +g('SALEPRICE') || null, zoning: g('ZONING'), land: g('LANDCODEDESCR') });
  }
  /* El Paso's MapServer does not page reliably (offsets repeat and skip), so ask for the wanted parcels by number,
     200 at a time, and keep the ones whose centroid is inside the circle. */
  const ids = [...want.keys()].filter((p) => /^\d+$/.test(p)), rows = [], seen = new Set();
  const { geometry, geometryType, spatialRel, distance, units, inSR, ...geo } = circle(s);
  let got = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const j = await getJSON(EPSVC, new URLSearchParams({ where: `PARCEL IN ('${ids.slice(i, i + 200).join("','")}')`, outFields: 'PARCEL', ...geo, f: 'json' }));
    for (const f of j.features) {
      got++; const p = clean(f.attributes.PARCEL); if (seen.has(p)) continue;
      const sh = shape(f.geometry); if (!sh.lat || distM(s.lat, s.lon, sh.lat, sh.lon) > s.r) continue;
      seen.add(p); rows.push({ id: 'ep-' + p, county: 'El Paso', parcel: p, city: 'Colorado Springs', ...want.get(p), kind: kind(want.get(p).use), ...sh });
    }
  }
  console.log(`  springs: ${want.size} wanted county-wide, ${got} shapes found, ${rows.length} inside the circle`);
  return rows;
}

/* Offsets on these services repeat and skip on big result sets, so cover the circle with small envelopes that each come
   back in one response (split any that hit the cap), de-duplicate on OBJECTID, keep parcels whose centroid is inside. */
async function tiled(url, s, outFields) {
  const dLat = s.r / 111320, dLon = s.r / (111320 * Math.cos(s.lat * Math.PI / 180));
  const todo = [[s.lon - dLon, s.lat - dLat, s.lon + dLon, s.lat + dLat]], byId = new Map();
  const n = 4; const [x0, y0, x1, y1] = todo.pop();
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) todo.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * k / n, x0 + (x1 - x0) * (i + 1) / n, y0 + (y1 - y0) * (k + 1) / n]);
  while (todo.length) {
    const [a, b, c, d] = todo.pop();
    const j = await getJSON(url, new URLSearchParams({ where: '1=1', outFields: outFields + ',OBJECTID', geometry: `${a},${b},${c},${d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outSR: '4326', returnGeometry: 'true', f: 'json' }));
    if (j.exceededTransferLimit) { const mx = (a + c) / 2, my = (b + d) / 2; todo.push([a, b, mx, my], [mx, b, c, my], [a, my, mx, d], [mx, my, c, d]); continue; }
    for (const f of j.features) byId.set(f.attributes.OBJECTID, f);
  }
  return [...byId.values()].filter((f) => { const sh = shape(f.geometry); return sh.lat && distM(s.lat, s.lon, sh.lat, sh.lon) <= s.r; });
}

async function composite(s) {
  const feats = await tiled(COMPOSITE, s, 'countyName,parcel_id,account,situsAdd,sitAddCty,sitAddZip,owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,landAcres,landSqft,zoningDesc,landUseDsc,saleDate,salePrice,apprValTot');
  const uses = {}, rows = [], seen = new Set();
  for (const f of feats) {
    const a = f.attributes, use = clean(a.landUseDsc);
    uses[a.countyName + ' | ' + use] = (uses[a.countyName + ' | ' + use] || 0) + 1;
    if (!CO_IN.test(use) || CO_OUT.test(use)) continue;
    const key = a.countyName + ':' + (a.parcel_id || a.account); if (seen.has(key)) continue; seen.add(key);
    rows.push({ id: a.countyName.slice(0, 3).toLowerCase() + '-' + clean(a.parcel_id || a.account), county: a.countyName, parcel: clean(a.parcel_id), use, kind: kind(use),
      addr: clean(a.situsAdd), city: clean(a.sitAddCty), zip: clean(a.sitAddZip), owner: clean(a.owner), owner2: clean(a.owner2),
      mail: { adr: clean(a.ownerAdd), city: clean(a.ownAddCty), st: clean(a.ownAddStt), zip: clean(a.ownAddZip) },
      acres: a.landAcres || (a.landSqft ? +(a.landSqft / 43560).toFixed(3) : null), value: a.apprValTot || null,
      saleDate: day(a.saleDate), salePrice: a.salePrice || null, zoning: clean(a.zoningDesc), ...shape(f.geometry) });
  }
  const dropped = Object.entries(uses).filter(([k]) => { const u = k.split(' | ')[1]; return !(CO_IN.test(u) && !CO_OUT.test(u)); }).sort((a, b) => b[1] - a[1]);
  console.log(`  ${feats.length} parcels in the circle, ${rows.length} kept. Kept uses:`);
  for (const [k, n] of Object.entries(uses).filter(([k]) => { const u = k.split(' | ')[1]; return CO_IN.test(u) && !CO_OUT.test(u); }).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(5)}  ${k}`);
  console.log(`  dropped (top 12): ${dropped.slice(0, 12).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  for (const [key, s] of Object.entries(SPOTS)) {
    console.log(`== ${key}: ${s.label}`);
    const rows = s.src === 'elpaso' ? await elPaso(s) : await composite(s);
    const byKind = rows.reduce((m, r) => (m[r.kind] = (m[r.kind] || 0) + 1, m), {});
    console.log(`  by kind: ${JSON.stringify(byKind)}`);
    writeFileSync(join(OUT, `parcels-${key}.json`), JSON.stringify({ spot: key, ...s, built: new Date().toISOString().slice(0, 10), parcels: rows }));
  }
}

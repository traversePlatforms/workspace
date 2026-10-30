/* New movers and house facts (2026-10-29): the counties that publish their sale dates (and, some, basement and walls) through
 * their own ArcGIS services, read field by field. Only parcel number, sale date/price/deed type and building facts are asked
 * for: never an owner, grantor, grantee or mailing field, so nothing here carries a name.
 *
 *   node fetch-arcgis.mjs [county ...]       default: all of them; writes assessor/raw/<county>/<name>.json (gitignored)
 *
 * Each output is { src, fetched, fields, rows: [[...values in fields order]] }. build-moved.mjs reads them.
 * TRAVERSE_ROOT (optional) points at the traverse/ folder that holds the data (the main checkout when run from a worktree). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TRAVERSE_ROOT ? resolve(process.env.TRAVERSE_ROOT) : join(HERE, '..', '..', '..');
const RAW = join(ROOT, 'data-pipeline', 'door-territory', 'assessor', 'raw');

const SOURCES = {
  /* Denver: open data, "Real Property Sales and Transfers" (2010 on, updated weekly) and "Real Property Residential Characteristics" */
  'denver-sales': { dir: 'denver', url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_real_property_sales_and_transfers/FeatureServer/51',
    where: 'SALE_PRICE >= 1000', fields: ['PARID', 'INSTRUMENT', 'SALE_YEAR', 'SALE_MONTHDAY', 'RECEPTION_DATE', 'SALE_PRICE'] },
  'denver-res': { dir: 'denver', url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_real_property_residential_characteristics/FeatureServer/50',
    where: '1=1', fields: ['PARID', 'CCYRBLT', 'BSMT_AREA', 'FBSMT_SQFT', 'STORY', 'STYLE_CN'] },
  /* Jefferson: the county's parcel layer (CC BY 4.0), four most recent sales per parcel and the main structure's facts */
  'jeffco-parcels': { dir: 'jefferson', url: 'https://gisportal.jeffco.us/server2/rest/services/Parcel/MapServer/20',
    where: '1=1', fields: ['PIN', 'STTSTRC', 'STTTYPUSE', 'STTYRBLT', 'STTBSTAREA', 'STTBSTTYP', 'STTNBRFLR', 'STTTYPCNS',
      'SLSDT', 'SLSAMT', 'SLSCD', 'DEDTYP', 'SLSDT2', 'SLSAMT2', 'SLSCD2', 'DEDTYP2', 'SLSDT3', 'SLSAMT3', 'SLSCD3', 'DEDTYP3', 'SLSDT4', 'SLSAMT4', 'SLSCD4', 'DEDTYP4'] },
  /* Arapahoe: the parcel layer the county publishes for its open data site (last sale date and price, no deed type) */
  'arapahoe-parcels': { dir: 'arapahoe', url: 'https://gis.arapahoegov.com/arcgis/rest/services/OpenDataService/MapServer/0',
    where: '1=1', fields: ['PARCEL_ID', 'Sale_Date', 'Price', 'PUC'] },
  /* Broomfield: the city and county's open data parcel layer */
  'broomfield-parcels': { dir: 'broomfield', url: 'https://services1.arcgis.com/vXSRPZbyyOmH9pek/arcgis/rest/services/Parcels/FeatureServer/0',
    where: '1=1', fields: ['PARCELNUMBER', 'SALEDATE', 'SALEPRICE', 'SALEDOCUMENTTYPE', 'ACTUALYEARBUILT', 'STORIES', 'SUBAREA_BSMTFN', 'SUBAREA_BSMTUN', 'ARCHITECTURESTYLE'] },
  /* Mesa: the county GIS open data tax parcels (sale date, price, qualified or not) */
  'mesa-parcels': { dir: 'mesa', url: 'https://mcgis.mesacounty.us/arcgis/rest/services/maps/Open_Data/MapServer/55',
    where: '1=1', fields: ['PARCELNUM', 'SDATE', 'SPRICE', 'SQUAL', 'AYB1ST', 'ARCH1ST'] },
  /* Elbert: the county's tax parcels (sale date and price) */
  'elbert-parcels': { dir: 'elbert', url: 'https://maps.elbertcounty-co.gov/data/rest/services/Tax_Parcels_of_Elbert_County_Colorado/FeatureServer/14',
    where: '1=1', fields: ['parcelid', 'saledate', 'saleprice', 'yearbuilt', 'archstyle'] },
};
const BAD = /OWN|GRANT|MAIL|CAREOF|BUSINESS|NAME/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200)); return j; }
    catch (e) { if (i >= 6) throw e; await sleep([1, 3, 8, 15, 30, 60][i] * 1000); }
  }
}
async function pull(name, s) {
  if (s.fields.some((f) => BAD.test(f))) throw new Error(name + ': an owner field was asked for');
  const meta = await getJSON(s.url + '?f=json');
  const oid = (meta.fields || []).find((f) => f.type === 'esriFieldTypeOID')?.name || 'OBJECTID';
  const page = Math.min(meta.maxRecordCount || 1000, 2000);
  const rows = []; let last = -1;
  for (;;) {   /* by object id, in order: no offsets to drift when the layer is edited mid-read */
    const q = new URLSearchParams({ where: `(${s.where}) AND ${oid} > ${last}`, outFields: [oid, ...s.fields].join(','), returnGeometry: 'false', orderByFields: oid, resultRecordCount: String(page), f: 'json' });
    const j = await getJSON(s.url + '/query?' + q);
    const fs = j.features || [];
    for (const f of fs) { const a = f.attributes; rows.push(s.fields.map((k) => a[k] ?? null)); last = Math.max(last, a[oid]); }
    if (!fs.length) break;
    if (rows.length % 20000 < page) console.log(`  ${name}: ${rows.length}`);
  }
  mkdirSync(join(RAW, s.dir), { recursive: true });
  const lastEdit = meta.editingInfo ? new Date(meta.editingInfo.dataLastEditDate || meta.editingInfo.lastEditDate).toISOString().slice(0, 10) : null;
  writeFileSync(join(RAW, s.dir, name + '.json'), JSON.stringify({ src: s.url, fetched: new Date().toISOString().slice(0, 10), lastEdit, fields: s.fields, rows }));
  console.log(`${name}: ${rows.length} rows (layer last edited ${lastEdit || 'not stated'})`);
}
const want = process.argv.slice(2);
for (const [name, s] of Object.entries(SOURCES)) if (!want.length || want.some((w) => name.startsWith(w))) {
  try { await pull(name, s); } catch (e) { console.log(`${name}: FAILED ${e.message}`); }
}

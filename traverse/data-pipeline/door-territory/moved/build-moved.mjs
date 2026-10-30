/* New movers (all five editions) and house facts (Pest), per door, from each county's own assessor or recorder records (2026-10-29,
 * Matthew: new owners are the best leads for alarm, pest and solar companies; a pest rep wants year built and basement / crawl
 * space / slab). See README.md beside this file for every county's source, licence, date and sale rule.
 *
 *   node build-moved.mjs [--only=town,town] [--counties=denver,jefferson,...]
 *
 * Writes app/data/rounds/moved-<town>.json   { built, counties: { key: [name, sales as of, building facts as of] }, doors: { id: 'YYYY-MM|key' } }
 *        app/data/rounds/house-<town>.json   { built, counties, doors: { id: { c, yb?, bs?, bf?, wo?, cr?, sl?, st?, ex? } } }
 *        moved/coverage.json                 counts only (doors with a sale / total and with basement facts / total, by county)
 *   moved  the month of the most recent MARKET sale on record: a sale deed (warranty, special warranty, bargain and sale,
 *          personal representative's ...) for $1,000 or more. Quit claims, death certificates, foreclosure and tax deeds,
 *          corrections, plats and the like are skipped, and so are sales the county itself codes as between related parties,
 *          a change of ownership form or a part interest. Where the record names both parties, a sale whose buyer shares a
 *          name with the seller (owner-names.mjs isSale: a spouse added, a move into a family trust) is skipped too: the
 *          names are compared in memory and never written anywhere.
 *   house  c county key; yb year built; bs basement sq ft (0 = the county records none); bf finished basement sq ft; wo 1 = walk-out;
 *          cr 1 = crawl space; sl 1 = slab; st stories (1, 1.5, 2, 2.5, 3) or 'split' / 'bi'; ex the exterior walls, in plain words.
 * Doors are matched to parcels through each town's list (<town>.csv: address -> parcel), as year-<town>.json is. Only the month,
 * the county and the building facts leave this script: owner columns are never read into the outputs.
 * TRAVERSE_ROOT (optional) points at the traverse/ folder holding the data (the main checkout when run from a worktree). */
import { readFileSync, writeFileSync, existsSync, createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSale } from '../owner-names.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TRAVERSE_ROOT ? resolve(process.env.TRAVERSE_ROOT) : join(HERE, '..', '..', '..');
const DT = join(ROOT, 'data-pipeline', 'door-territory'), RAW = join(DT, 'assessor', 'raw'), DATA = join(ROOT, 'app', 'data', 'rounds');
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).split(',').filter(Boolean);
const ONLY = arg('only'), WANT = arg('counties');

/* ---------------------------------------------------------------- helpers */
const pkey = (p) => String(p ?? '').replace(/\D/g, '').replace(/^0+/, '');   /* digits only, no leading zeros: one key whatever the dashes */
const csvRow = (l) => { const o = []; let f = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i];
  if (q) { if (ch === '"') { if (l[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
  else if (ch === '"') q = true; else if (ch === ',') { o.push(f); f = ''; } else if (ch !== '\r') f += ch; } o.push(f); return o; };
async function lines(f, fn) { const rl = createInterface({ input: createReadStream(f), crlfDelay: Infinity }); for await (const l of rl) if (l) fn(l); }
/* a CSV with a header row: fn(get) where get('COLUMN') reads a field by its (trimmed, upper-case) header */
async function csvFile(f, fn, split = csvRow) {
  let h = null;
  await lines(f, (l) => { const c = split(l); if (!h) { h = new Map(c.map((x, i) => [x.trim().toUpperCase(), i])); return; } fn((k) => (c[h.get(k)] ?? '').trim()); });
}
const fixed = (l, a, n) => l.substr(a, n).trim();
/* any date the counties write -> 'YYYY-MM' (or null): 2026-08-03, 20260803, 8/3/2026, 08032026 (Jefferson), epoch ms */
function ym(v) {
  if (v == null || v === '') return null;
  let y, m;
  if (typeof v === 'number' && v > 1e11) { const d = new Date(v); y = d.getUTCFullYear(); m = d.getUTCMonth() + 1; }
  else {
    const s = String(v).trim(); let r;
    if ((r = s.match(/^(\d{4})-(\d{1,2})/))) { y = +r[1]; m = +r[2]; }
    else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) { y = +r[3]; m = +r[1]; }
    else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})$/)) && +r[1] > 1800) { y = +r[1]; m = +r[2]; }
    else if ((r = s.match(/^(\d{2})(\d{2})(\d{4})$/))) { y = +r[3]; m = +r[1]; }
    else return null;
  }
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12)) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}
const money = (v) => { const n = +String(v ?? '').replace(/[$,]/g, ''); return isFinite(n) ? n : 0; };
const MIN_PRICE = 1000;
/* keep the newest qualifying sale per parcel */
const NOW_YM = new Date().toISOString().slice(0, 7);   /* a sale dated after this month is a typing slip in the record (Denver had 2026-12, El Paso 2028-08): skipped */
const newer = (map, p, d) => { if (!p || !d || d > NOW_YM) return; const k = pkey(p); if (!k) return; const cur = map.get(k); if (!cur || d > cur) map.set(k, d); };
/* names compared in memory only: true when the record shows the buyer sharing a name with the seller */
const sameParty = (a, b) => !!(a && b) && !isSale(a, b);
const sf = (v) => { const n = Math.round(+v || 0); return n > 0 ? n : 0; };
/* the walls, in plain words (a pest rep cares whether it is wood) */
function exWord(raw) {
  const s = String(raw || '').toLowerCase(); if (!s.trim() || s === '0') return undefined;
  if (/\blog\b/.test(s)) return 'Log';
  const fr = /frame|wood|siding|shake|shingle|plywood|cedar|lap|hardboard|cement|fiber|vinyl/.test(s);
  if (/frame/.test(s) && /brick/.test(s)) return 'Frame with brick veneer';
  if (/frame/.test(s) && /masonry|stone/.test(s)) return 'Frame with masonry veneer';
  if (/frame/.test(s) && /stucco/.test(s)) return 'Frame with stucco';
  if (/combination/.test(s)) return 'Frame and brick';
  if (/brick/.test(s)) return 'Brick';
  if (/stone|moss rock|flagstone/.test(s)) return 'Stone';
  if (/stucco/.test(s)) return 'Stucco';
  if (/block|concrete|masonry/.test(s) && !fr) return 'Masonry';
  if (/vinyl/.test(s)) return 'Vinyl siding';
  if (/metal|alumin|steel/.test(s)) return 'Metal siding';
  if (/hardboard|cement|fiber/.test(s)) return 'Hardboard or fiber-cement siding';
  if (/modular|pre-?fab/.test(s)) return 'Modular';
  if (fr) return 'Wood frame';
  return undefined;
}
/* stories, from the style words or a number */
function stNorm(style, n) {
  const s = String(style || '').toLowerCase();
  if (/split|tri.?level/.test(s)) return 'split';
  if (/bi.?level|bi-split|raised ranch/.test(s)) return 'bi';
  if (/1 ?(1\/2|½)|1\.5|one and/.test(s)) return 1.5;
  if (/2 ?(1\/2|½)|2\.5/.test(s)) return 2.5;
  if (/2-3 stor/.test(s)) return 2;   /* Boulder's "2-3 Story" design */
  if (/\b3 story|three story|3-story/.test(s)) return 3;
  if (/\b2|two/.test(s) && /stor/.test(s)) return 2;
  if (/ranch|\b1 story|one story|1-story|1 sty/.test(s)) return 1;
  const k = +n; if ([1, 1.5, 2, 2.5, 3].includes(k)) return k;
  return undefined;
}
const RES = /resid|single|sfr|family|duplex|townh|condo|ranch|story|level|patio|paired|row/i;
const clean = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null || o[k] === '') delete o[k]; return o; };
const rawJSON = (dir, name) => { const f = join(RAW, dir, name + '.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const fieldsOf = (j) => { const ix = Object.fromEntries(j.fields.map((f, i) => [f, i])); return (r, k) => r[ix[k]]; };
const monthOf = (iso) => (iso || '').slice(0, 7);

/* ---------------------------------------------------------------- the counties
   Each returns { asof: 'YYYY-MM', sales: Map(parcel key -> 'YYYY-MM'), house: Map(parcel key -> facts) }. A county with no files
   returns null and is listed as not done. */
const COUNTIES = {
  /* Denver: Real Property Sales and Transfers (deed instrument, price) + Residential Characteristics (basement, stories) */
  async denver() {
    const s = rawJSON('denver', 'denver-sales'), r = rawJSON('denver', 'denver-res'); if (!s) return null;
    const MARKET = new Set(['WD', 'SW', 'GW', 'PR', 'BS']);   /* warranty, special warranty, general warranty, personal rep's, bargain and sale */
    const sales = new Map(), house = new Map(), g = fieldsOf(s);
    for (const x of s.rows) {
      if (!MARKET.has(String(g(x, 'INSTRUMENT') || '').trim()) || money(g(x, 'SALE_PRICE')) < MIN_PRICE) continue;
      const y = +g(x, 'SALE_YEAR'), md = +g(x, 'SALE_MONTHDAY');
      const d = y && md ? ym(`${y}-${Math.floor(md / 100)}`) : ym(String(g(x, 'RECEPTION_DATE')));
      newer(sales, g(x, 'PARID'), d);
    }
    if (r) { const h = fieldsOf(r); for (const x of r.rows) {
      const k = pkey(h(x, 'PARID')); if (!k || house.has(k)) continue;
      house.set(k, clean({ yb: +h(x, 'CCYRBLT') > 1800 ? +h(x, 'CCYRBLT') : undefined, bs: sf(h(x, 'BSMT_AREA')), bf: sf(h(x, 'FBSMT_SQFT')) || undefined, st: stNorm(h(x, 'STYLE_CN'), h(x, 'STORY')) }));
    } }
    return { asof: monthOf(s.lastEdit || s.fetched), sales, house };
  },
  /* Jefferson: the county parcel layer, four sales per parcel (date MMDDYYYY, price, sale code, deed type) and the main structure */
  async jefferson() {
    const j = rawJSON('jefferson', 'jeffco-parcels'); if (!j) return null;
    const MARKET = /^(SWAR|WD|WJT|FullCov|GWAR|SWJT|BDEED|BargDeed|BSD|BSJT|PRD|PRJT|DEED|CDEED|AdminDee)$/;
    const NOT = /^(DQSaleNonarms|Relatedparties|PartInterest|OwnForm|Transfinaninstit|GovEntity|ReRecord|Trade)$/;
    const sales = new Map(), house = new Map(), g = fieldsOf(j);
    for (const x of j.rows) {
      const p = g(x, 'PIN');
      for (const n of ['', '2', '3', '4']) {
        if (!MARKET.test(String(g(x, 'DEDTYP' + n) || '')) || NOT.test(String(g(x, 'SLSCD' + n) || '')) || money(g(x, 'SLSAMT' + n)) < MIN_PRICE) continue;
        newer(sales, p, ym(g(x, 'SLSDT' + n)));
      }
      const use = String(g(x, 'STTSTRC') || '');
      if (!/single|duplex|condo|town|res/i.test(use)) continue;
      house.set(pkey(p), clean({ yb: +g(x, 'STTYRBLT') > 1800 ? +g(x, 'STTYRBLT') : undefined, bs: sf(g(x, 'STTBSTAREA')), st: stNorm(g(x, 'STTTYPUSE')),
        ex: /^(FR|BR|FB|fb|LG|MD) /.test(String(g(x, 'STTTYPCNS') || '')) ? exWord(String(g(x, 'STTTYPCNS')).split(' - ')[1]) : undefined }));
    }
    return { asof: monthOf(j.fetched), sales, house };
  },
  /* Arapahoe: the open data parcel layer's last sale (date and price only: no deed type) */
  async arapahoe() {
    const j = rawJSON('arapahoe', 'arapahoe-parcels'); if (!j) return null;
    const sales = new Map(), g = fieldsOf(j);
    for (const x of j.rows) if (money(g(x, 'Price')) >= MIN_PRICE) newer(sales, g(x, 'PARCEL_ID'), ym(g(x, 'Sale_Date')));
    return { asof: monthOf(j.fetched), sales, house: new Map() };
  },
  async broomfield() {
    const j = rawJSON('broomfield', 'broomfield-parcels'); if (!j) return null;
    const MARKET = /^(WD|SWD|PRD|BSD|BS|BD|CD|CONSD|TD)$/;
    const sales = new Map(), house = new Map(), g = fieldsOf(j);
    for (const x of j.rows) {
      const p = g(x, 'PARCELNUMBER');
      if (MARKET.test(String(g(x, 'SALEDOCUMENTTYPE') || '')) && money(g(x, 'SALEPRICE')) >= MIN_PRICE) newer(sales, p, ym(g(x, 'SALEDATE')));
      const yb = +g(x, 'ACTUALYEARBUILT'); if (!(yb > 1800)) continue;
      const fn = sf(g(x, 'SUBAREA_BSMTFN')), un = sf(g(x, 'SUBAREA_BSMTUN'));
      house.set(pkey(p), clean({ yb, bs: fn + un, bf: fn || undefined, st: stNorm(g(x, 'ARCHITECTURESTYLE'), g(x, 'STORIES')) }));
    }
    return { asof: monthOf(j.lastEdit || j.fetched), sales, house };
  },
  async mesa() {
    const j = rawJSON('mesa', 'mesa-parcels'); if (!j) return null;
    const sales = new Map(), house = new Map(), g = fieldsOf(j);
    for (const x of j.rows) {
      const p = g(x, 'PARCELNUM');
      if (/^M?Q/.test(String(g(x, 'SQUAL') || '')) && money(g(x, 'SPRICE')) >= MIN_PRICE) newer(sales, p, ym(g(x, 'SDATE')));   /* Q* = the county's qualified sales */
      const yb = +g(x, 'AYB1ST'); if (yb > 1800) house.set(pkey(p), clean({ yb, st: stNorm(g(x, 'ARCH1ST')) }));
    }
    return { asof: monthOf(j.fetched), sales, house };
  },
  async elbert() {
    const j = rawJSON('elbert', 'elbert-parcels'); if (!j) return null;
    const sales = new Map(), house = new Map(), g = fieldsOf(j);
    for (const x of j.rows) {
      const p = g(x, 'parcelid');
      if (money(g(x, 'saleprice')) >= MIN_PRICE) newer(sales, p, ym(g(x, 'saledate')));
      const yb = +g(x, 'yearbuilt'); if (yb > 1800) house.set(pkey(p), clean({ yb, st: stNorm(g(x, 'archstyle')) }));
    }
    return { asof: monthOf(j.fetched), sales, house };
  },
  /* El Paso: the assessor's weekly parcel file (EPC Parcel Data.txt): SALEDATE, SALEPRICE and the assessor's sale comment;
     basement and finished basement, style. Only these columns are read. */
  async elpaso() {
    const f = join(RAW, 'EPC Parcel Data.txt'); if (!existsSync(f)) return null;
    const NOT = /related part|trade or exchange|partial interest|cannot verify|quit ?claim/i;
    const sales = new Map(), house = new Map(); let asof = '';
    await csvFile(f, (g) => {
      const p = g('PARCEL'); if (!asof) asof = ym(g('LASTUPDATE')) || '';
      if (money(g('SALEPRICE')) >= MIN_PRICE && !NOT.test(g('ASRSALECMNT'))) newer(sales, p, ym(g('SALEDATE')));
      if (!/RESIDENTIAL|CONDO|DUPLEX|FARM\/RANCH RESIDENCE|MANUFACTURED HOUSING/.test(g('IMPSTATEDESCR'))) return;
      const yb = +g('YEARBLT');
      house.set(pkey(p), clean({ yb: yb > 1800 ? yb : undefined, bs: sf(g('TOTALBSMT')), bf: sf(g('FINISHEDBSMT')) || undefined, st: stNorm(g('RESSTYLE')) }));
    }, (l) => l.split('\t'));
    return { asof, sales, house };
  },
  /* Douglas: Property_Sales.txt (no header: account, date, price, deed type, seller, buyer, book, page, reception) joined to the
     parcel through Property_Location.txt; Property_Improvements.txt for style (col 5), walls (col 19), year built (col 26). The
     basement columns of that file are not identified (the county publishes no layout), so Douglas gives no basement facts. */
  async douglas() {
    const fs = join(RAW, 'douglas', 'Property_Sales.txt'); if (!existsSync(fs)) return null;
    const q = (l) => l.replace(/^"|"\s*$/g, '').split('","');
    const acct = new Map(); await lines(join(RAW, 'Property_Location.txt'), (l) => { const c = q(l); if (c[2]) acct.set(c[0], c[2]); });
    const MARKET = /^(Warranty Deed|Special Warranty Deed|Bargain & Sale|Personal Representative's|Grant Deed|Deed [JC]$|Conservator's Deed|Administrator's Deed)/;
    const sales = new Map(), house = new Map();
    await lines(fs, (l) => { const c = csvRow(l); if (!MARKET.test(c[3] || '') || money(c[2]) < MIN_PRICE || sameParty(c[4], c[5])) return; newer(sales, acct.get(c[0]), ym(c[1])); });
    const best = new Map();
    await lines(join(RAW, 'Property_Improvements.txt'), (l) => { const c = q(l); if (!/^R/.test(c[0]) || !/Residential|Townhouse|Condo/i.test((c[2] || '') + ' ' + (c[7] || ''))) return;
      const cur = best.get(c[0]); if (cur && cur.no <= +c[1]) return;
      best.set(c[0], { no: +c[1], yb: +c[26] > 1800 ? +c[26] : undefined, st: stNorm(c[5]), ex: exWord(c[19]) }); });
    for (const [a, b] of best) { const p = acct.get(a); if (p) { const { no, ...rest } = b; house.set(pkey(p), clean(rest)); } }
    return { asof: '2026-10', sales, house };   /* the county's files: "Last Updated 10/1/2026" */
  },
  /* Adams: the assessor's Admin dump Sales.TXT (fixed width, Admin_FileLayout.doc) and the Appraisal dump Built_As.TXT (walls,
     stories, foundation) and Detail.TXT (basement rows: Unfinished / Finished / Minimal Finish square feet, Walkout) */
  async adams() {
    const fs = join(RAW, 'adams', 'dl', 'Sales.TXT'); if (!existsSync(fs)) return null;
    const MARKET = new Set(['WD', 'SWD', 'BS', 'PRD', 'D', 'CD', 'GD', 'AD']);
    const sales = new Map(), house = new Map();
    await lines(fs, (l) => {
      if (!MARKET.has(fixed(l, 208, 10)) || money(fixed(l, 229, 17)) < MIN_PRICE || sameParty(fixed(l, 95, 40), fixed(l, 135, 40))) return;
      newer(sales, fixed(l, 11, 13), ym(fixed(l, 200, 8)) || ym(fixed(l, 175, 8)));
    });
    const big = new Map();
    await lines(join(RAW, 'adams', 'Built_As.TXT'), (l) => {
      const p = pkey(fixed(l, 11, 13)), s = +fixed(l, 37, 12), yb = +fixed(l, 362, 5); if (!p || !(yb > 1800)) return;
      const cur = big.get(p); if (cur && cur.s >= s) return;
      const fd = fixed(l, 244, 20);
      big.set(p, { s, yb, st: stNorm('', +fixed(l, 148, 14)), ex: exWord(fixed(l, 98, 30)), cr: /crawl/i.test(fd) ? 1 : undefined, sl: /slab/i.test(fd) ? 1 : undefined });
    });
    const bsm = new Map(), dF = join(RAW, 'adams', 'dl', 'Detail.TXT');
    if (existsSync(dF)) await lines(dF, (l) => {
      if (fixed(l, 30, 30) !== 'Basement') return;
      const p = pkey(fixed(l, 11, 13)), d = fixed(l, 60, 50), u = +fixed(l, 121, 17) || 0, b = bsm.get(p) || { bs: 0, bf: 0, wo: 0 };
      if (d === 'Unfinished') b.bs += u; else if (d === 'Finished' || d === 'Minimal Finish') { b.bs += u; b.bf += u; } else if (d === 'Walkout') b.wo = 1; else return;
      bsm.set(p, b);
    });
    for (const [p, b] of big) { const m = bsm.get(p); house.set(p, clean({ yb: b.yb, st: b.st, ex: b.ex, cr: b.cr, sl: b.sl, bs: m ? sf(m.bs) : (existsSync(dF) ? 0 : undefined), bf: m && m.bf ? sf(m.bf) : undefined, wo: m && m.wo ? 1 : undefined })); }
    return { asof: '2026-05', sales, house };   /* the dump of 4 May 2026 (bi-annual; next after 1 Jan 2027) */
  },
  /* Weld: Sales.csv (account, seller, buyer, price, date, deed type) and the account inventory (parcel, basement square feet, walk-out),
     the improvements (walls, stories, foundation) from the assessor's all.zip */
  async weld() {
    const fs = join(RAW, 'weld', 'Sales.csv'); if (!existsSync(fs)) return null;
    const acct = new Map(), bsm = new Map();
    await csvFile(join(RAW, 'weld', 'AcctCurrentInvntry.csv'), (g) => {
      const a = g('ACCOUNTNO'), p = g('PARCELNB'); if (!a || !p) return; acct.set(a, p);
      const fin = sf(g('BSMNTTOTALFINSF')), un = sf(g('BSMNTUNFINSF'));
      bsm.set(a, { bs: fin + un, bf: fin, wo: +g('WALKOUT') > 0 ? 1 : 0, yb: +g('YRBLT') });
    });
    const MARKET = /^(WD|SWD|SPWD|BSD|PRD)[NE]*$/;
    const sales = new Map();
    await csvFile(fs, (g) => {
      if (!MARKET.test(g('DEEDTYPE')) || money(g('SALEP')) < MIN_PRICE || sameParty(g('GRANTOR'), g('GRANTEE'))) return;
      newer(sales, acct.get(g('ACCOUNTNO')), ym(g('SALEDT')));
    });
    const best = new Map();
    await csvFile(join(RAW, 'weld', 'ImpsCurrentInvntry.csv'), (g) => {
      if (!/Residential|Condo|Townhouse|Duplex|Manufactured/i.test(g('PROPTYPE'))) return;
      const a = g('ACCOUNTNO'), s = sf(g('BLTASSF')) || sf(g('SF')), cur = best.get(a); if (cur && cur.s >= s) return;
      const fd = g('FOUNDATION');
      best.set(a, { s, yb: +g('YRBLT'), st: stNorm('', g('STORIES')), ex: exWord(g('EXTERIOR')), cr: /post and pier|crawl/i.test(fd) ? 1 : undefined, sl: /slab/i.test(fd) ? 1 : undefined });
    });
    const house = new Map();
    for (const [a, b] of best) { const p = acct.get(a); if (!p) continue; const m = bsm.get(a) || {};
      house.set(pkey(p), clean({ yb: b.yb > 1800 ? b.yb : (m.yb > 1800 ? m.yb : undefined), st: b.st, ex: b.ex, cr: b.cr, sl: b.sl, bs: m.bs ?? undefined, bf: m.bf || undefined, wo: m.wo || undefined })); }
    return { asof: '2026-10', sales, house };   /* the assessor's all.zip of 6 Oct 2026 */
  },
  /* Boulder: Sales.csv (strap, date, sale code, deed type, price: no names) joined to the parcel by Account_Parcels.csv;
     Buildings.csv (basement square feet by type, walls, design, year built) */
  async boulder() {
    const fs = join(RAW, 'boulder', 'Sales.csv'); if (!existsSync(fs)) return null;
    const apF = existsSync(join(RAW, 'boulder', 'Account_Parcels-new.csv')) ? join(RAW, 'boulder', 'Account_Parcels-new.csv') : join(RAW, 'boulder', 'Account_Parcels.csv');
    const par = new Map(); await csvFile(apF, (g) => { if (g('STRAP') && g('PARCELNO')) par.set(g('STRAP'), g('PARCELNO')); });
    const MARKET = new Set(['WD', 'WJ', 'SW', 'SJ', 'BD', 'BJ', 'BS', 'PD', 'PJ', 'GD']);
    const sales = new Map();
    await csvFile(fs, (g) => { if (!MARKET.has(g('DEED_TYPE')) || money(g('PRICE')) < MIN_PRICE) return; newer(sales, par.get(g('STRAP')), ym(g('TDATE'))); });
    const bF = existsSync(join(RAW, 'boulder', 'Buildings-new.csv')) ? join(RAW, 'boulder', 'Buildings-new.csv') : join(RAW, 'boulder', 'Buildings.csv');
    const bld = new Map();   /* strap|building -> facts summed over its sections */
    await csvFile(bF, (g) => {
      const k = g('STRAP') + '|' + g('BLD_NUM'), b = bld.get(k) || { strap: g('STRAP'), fin: 0, bs: 0, bf: 0, wo: 0, res: false };
      b.fin += sf(g('TOTALFINISHEDSF')); const t = g('BSMTTYPEDSCR'), s = sf(g('BSMTSF'));
      if (s && t && t !== '0') { b.bs += s; if (/ FINISHED/.test(t) && !/UNFINISHED/.test(t)) b.bf += s; if (/WALK/.test(t)) b.wo = 1; }
      if (!b.yb && +g('BUILTYEAR') > 1800) b.yb = +g('BUILTYEAR');
      if (!b.ex) b.ex = exWord(g('EXTWALLDSCRPRIM'));
      if (!b.st) b.st = stNorm(g('DESIGNCODEDSCR'), g('STORIES'));
      if (RES.test(g('DESIGNCODEDSCR'))) b.res = true;
      bld.set(k, b);
    });
    const best = new Map();
    for (const b of bld.values()) { if (!b.res) continue; const cur = best.get(b.strap); if (!cur || b.fin > cur.fin) best.set(b.strap, b); }
    const house = new Map();
    for (const [st, b] of best) { const p = par.get(st); if (p) house.set(pkey(p), clean({ yb: b.yb, st: b.st, ex: b.ex, bs: b.bs, bf: b.bf || undefined, wo: b.wo || undefined })); }
    return { asof: monthOf(statSync(fs).mtime.toISOString()), sales, house };   /* refreshed by the county daily; dated by our download */
  },
  /* Larimer: the Public Data Center's sales and improvement tables (RUNDATE in each) */
  async larimer() {
    const fs = join(RAW, 'larimer', 'sales.csv'); if (!existsSync(fs)) return null;
    /* warranty, special warranty (and their JT forms), personal representative's, bargain and sale, plain deed, administrator's;
       not quit claims, corrected deeds, mobile home titles, verifications, bills of sale, mineral deeds, contracts, quiet title */
    const MARKET = /^(WD|WDJ|SWD|SWDJ|PRD|PRDJ|BSD|BSDJT|DE|ADD)$/;
    const sales = new Map(); let asof = '', hasof = '';
    await csvFile(fs, (g) => {
      if (!asof) asof = ym(g('RUNDATE')) || '';
      if (!MARKET.test(g('DEEDCODE')) || money(g('SALEPRICE')) < MIN_PRICE || sameParty(g('GRANTOR'), g('GRANTEE'))) return;
      newer(sales, g('PARCELNO'), ym(g('SALEDATE')));
    });
    const best = new Map(), iF = join(RAW, 'larimer', 'improvement.csv');
    if (existsSync(iF)) await csvFile(iF, (g) => {
      if (!hasof) hasof = ym(g('RUNDATE')) || '';
      if (!/resid|condo|town|duplex|manufact/i.test(g('PROPERTYTYPE') + ' ' + g('OCCDESCRIPTION'))) return;
      const p = pkey(g('PARCELNO')), s = sf(g('SF')), cur = best.get(p); if (!p || (cur && cur.s >= s)) return;
      const fd = g('BLTASFOUNDATION'), yb = +g('BLTASYEARBUILT');
      best.set(p, { s, yb: yb > 1800 ? yb : undefined, st: stNorm(g('BLTASDESCRIPTION'), g('BLTASSTORIES')), ex: exWord(g('IMPEXTERIOR')), bs: sf(g('BSMNTSF')), bf: sf(g('BSMNTFINSF')) || undefined,
        cr: /crawl|post and pier/i.test(fd) ? 1 : undefined, sl: /slab/i.test(fd) ? 1 : undefined });
    });
    const house = new Map(); for (const [p, b] of best) { const { s, ...rest } = b; house.set(p, clean(rest)); }
    return { asof, hasof, sales, house };   /* the improvement table runs on its own date (24 Aug 2026 when first read) */
  },
};
const NAME = { denver: 'Denver', jefferson: 'Jefferson County', arapahoe: 'Arapahoe County', broomfield: 'Broomfield', mesa: 'Mesa County', elbert: 'Elbert County',
  elpaso: 'El Paso County', douglas: 'Douglas County', adams: 'Adams County', weld: 'Weld County', boulder: 'Boulder County', larimer: 'Larimer County' };
const KEY = { Denver: 'denver', Jefferson: 'jefferson', Arapahoe: 'arapahoe', Broomfield: 'broomfield', Mesa: 'mesa', Elbert: 'elbert', 'El Paso': 'elpaso',
  Douglas: 'douglas', Adams: 'adams', Weld: 'weld', Boulder: 'boulder', Larimer: 'larimer' };

/* ---------------------------------------------------------------- the towns */
function parseCSV(s) { const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); } return rows; }
const TC = JSON.parse(readFileSync(join(DT, 'assessor', 'town-county.json'), 'utf8'));
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const towns = [];
for (const r of idx.regions) {
  const t = r.key; if (t.startsWith('com-') || (ONLY.length && !ONLY.includes(t))) continue;
  const cs = (TC[t] || []).map((c) => KEY[c]).filter(Boolean); if (!cs.length) continue;
  const csvF = join(DT, `${t}.csv`), doorF = join(DATA, `${t}.json`); if (!existsSync(csvF) || !existsSync(doorF)) continue;
  const rows = parseCSV(readFileSync(csvF, 'utf8')), h = rows[0], iA = h.indexOf('address'), iP = h.indexOf('parcel');   /* only these two columns are read */
  const parcelOf = new Map(); for (const x of rows.slice(1)) if (x[iA] && x[iP]) parcelOf.set(x[iA].trim().toUpperCase(), pkey(x[iP]));
  const doors = []; for (const a of JSON.parse(readFileSync(doorF, 'utf8')).areas) for (const d of a.doors) doors.push([d.id, parcelOf.get(String(d.address).trim().toUpperCase()) || '']);
  towns.push({ t, cs, doors, mv: {}, hs: {}, used: {} });
}
console.log(`${towns.length} towns, ${towns.reduce((n, x) => n + x.doors.length, 0)} doors`);

/* ---------------------------------------------------------------- match, county by county */
const today = new Date().toISOString().slice(0, 10), cov = {}, counties = {};
const need = new Set(towns.flatMap((x) => x.cs));
for (const ck of Object.keys(COUNTIES)) {
  if (!need.has(ck) || (WANT.length && !WANT.includes(ck))) continue;
  const t0 = Date.now(); let src;
  try { src = await COUNTIES[ck](); } catch (e) { console.log(`${ck}: FAILED ${e.message}`); continue; }
  if (!src) { console.log(`${ck}: no files`); continue; }
  counties[ck] = [NAME[ck], src.asof, src.hasof || src.asof];   /* name, sales as of, building facts as of */
  const c = cov[ck] = { name: NAME[ck], asof: src.asof, parcelsWithSale: src.sales.size, parcelsWithHouse: src.house.size, doors: 0, sold: 0, sold12: 0, house: 0, basement: 0, hasBasement: 0 };
  const [y0, m0] = today.split('-').map(Number), cut = (y0 - 1) * 12 + m0;
  for (const T of towns) {
    if (!T.cs.includes(ck)) continue;
    for (const [id, p] of T.doors) {
      if (T.cs[0] === ck) c.doors++;   /* each door counts once, under its town's first county */
      if (!p) continue;
      const s = src.sales.get(p), hv = src.house.get(p);
      if (s && !T.mv[id]) { T.mv[id] = s + '|' + ck; c.sold++; T.used[ck] = 1; const [yy, mm] = s.split('-').map(Number); if (yy * 12 + mm >= cut) c.sold12++; }
      if (hv && Object.keys(hv).length && !T.hs[id]) { T.hs[id] = { c: ck, ...hv }; c.house++; T.used[ck] = 1; if (hv.bs !== undefined || hv.cr || hv.sl) c.basement++; if (hv.bs > 0) c.hasBasement++; }
    }
  }
  console.log(`${ck}: as of ${src.asof}; ${src.sales.size} parcels with a market sale, ${src.house.size} with house facts; doors ${c.sold} sold (${c.sold12} in 12 months), ${c.house} house facts, ${c.basement} basement/crawl/slab (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

/* ---------------------------------------------------------------- write */
let wrote = 0, totD = 0, totS = 0, totB = 0, held = [];
for (const T of towns) {
  /* review 2026-10-30: a county that failed (or was left out with --counties=) used to leave every town on it rewritten without its sales
     and house facts, and the run still said done. A town whose counties did not all answer keeps the files it has. */
  if (!T.cs.every((k) => counties[k])) { held.push(T.t); continue; }
  const used = Object.fromEntries(Object.keys(T.used).map((k) => [k, counties[k]]));
  totD += T.doors.length; totS += Object.keys(T.mv).length; totB += Object.values(T.hs).filter((h) => h.bs !== undefined || h.cr || h.sl).length;
  if (Object.keys(T.mv).length) { writeFileSync(join(DATA, `moved-${T.t}.json`), JSON.stringify({ built: today, counties: used, doors: T.mv })); wrote++; }
  if (Object.keys(T.hs).length) writeFileSync(join(DATA, `house-${T.t}.json`), JSON.stringify({ built: today, counties: used, doors: T.hs }));
}
const byTown = Object.fromEntries(towns.map((T) => [T.t, { doors: T.doors.length, sold: Object.keys(T.mv).length, house: Object.keys(T.hs).length }]));
writeFileSync(join(HERE, 'coverage.json'), JSON.stringify({ built: today, totals: { doors: totD, sold: totS, basement: totB }, counties: cov, towns: byTown }, null, 1));
console.log(`${wrote} moved- files; ${totS} of ${totD} doors with a sale month, ${totB} with basement / crawl / slab facts`);
if (held.length) { console.log(`${held.length} towns NOT written (a county of theirs did not answer or was left out): ${held.join(', ')}`); process.exitCode = 1; }

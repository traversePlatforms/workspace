#!/usr/bin/env node
/* Every home, 15 Nov 2026 (EVERY-HOME-2026-11-15.md; Matthew: "I eventually want to have every residential property in Colorado on this
   list that we possibly can"). Cloud machine only. Reads the fresh state pull (pull-state-vm.mjs) and TODAY's doors (export-door-points.mjs:
   every door on the lists, owner-lived and rented, plus the office-lookup homes left), and writes:
     <out>/counts.json        counts only (no names, no addresses): the recount, per county and bucket
     <out>/cand.tsv           one row per home or building to add, with its kind, its town and how it joins (holds owner names: VM only)
     <out>/marks-existing.tsv doors of ours that the county codes as a mobile home or a townhome condo (town, address, kind)
   A parcel is one of ours when a door or lookup home sits within 6 m of its point (15 m in El Paso) or the same address within 150 m
   (gap1108/gap-classify.mjs's test). For a parcel that is not ours, the first rule that applies:
     nogeom / nonres / nositus        no shape; not a home (commercial, exempt, vacant, farm land, HOA ...); no property address
     public                           owner is a church, district, city, HOA, school ... (never a door)
     stacked                          2+ home parcels on one point (condo flats drawn on one footprint): grouped into ONE building entry
     apt                              apartments / 4+ units / multiple unit (one parcel): one building entry (kind b, bk apt)
     mhp                              mobile home park (land use says park, or a mobile parcel over 3 acres): one building entry (bk mhp)
     mobile                           a mobile home on its own parcel: a door, kind mh
     condo1                           a condo parcel with its own footprint (no other home parcel on its point): a townhome, kind th
     big                              a house on more than 10 acres (the walk lists' cap, Matthew 16 Oct: kept)
     bizhere                          an organisation owner "living" at its own address (a business): never a door
     here / away                      a house we lack: the owner lives here (or a local PO box), or elsewhere (rented / second home)
   Huerfano's property addresses are written street first ("01ST ST W # 00101" = 101 W 1ST ST): rewritten before anything else.
   El Paso's land use, address, owner and units come from the county assessor file, joined by parcel number, as in gap-classify.mjs.
   Town for a door: Huerfano by Group 3's five targets; else the town of the nearest door of ours within 3 km (joins that town, put
   beside its nearest door: build-rounds-data's promotion); else a new town per county + situs city (g4-<city>), or "<County> (other)".
   Buildings: the town of the nearest door within 9 km, else a new town of the same county + city, else left out (counted).
   Usage: node classify-vm.mjs <state dir> <door-points.tsv> <out dir> --epc=<EPC Parcel Data.txt> --g3=<group3 targets.json>        */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, createWriteStream, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const [DIR, DOORS, OUT] = process.argv.slice(2);
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
if (!OUT) { console.error('usage: node classify-vm.mjs <state dir> <door-points.tsv> <out dir> --epc=file --g3=targets.json'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const SKIP = /^(moffat|fremont|chaffee|otero|cheyenne|phillips)$/;   /* TR-36: terms forbid, or permission needed first */

const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const CELL = 0.0004;
const metres = (la1, lo1, la2, lo2) => Math.hypot((lo2 - lo1) * 111320 * Math.cos(la1 * Math.PI / 180), (la2 - la1) * 110540);

/* ---- our doors ---- */
const grid = new Map(); const townPts = new Map();
/* coarse cells (~550 x 430 m) holding each town's mean door point in the cell: the nearest-town search reads these (within ~400 m) */
const COARSE = 0.005, coarse = new Map();   /* town -> { n, county } */
for (const line of readFileSync(DOORS, 'utf8').split('\n').slice(1)) {
  if (!line) continue;
  const [kind, county, town, address, la, lo] = line.split('\t');
  const p = { kind, county, town, a: slug(address), la: +la, lo: +lo };
  if (!(Math.abs(p.la) > 0)) continue;
  const k = `${Math.floor(p.la / CELL)},${Math.floor(p.lo / CELL)}`; (grid.get(k) || grid.set(k, []).get(k)).push(p);
  if (kind === 'door') {
    const t = townPts.get(town) || townPts.set(town, { n: 0, county }).get(town); t.n++;
    const ck = `${Math.floor(p.la / COARSE)},${Math.floor(p.lo / COARSE)}`; const m = coarse.get(ck) || coarse.set(ck, new Map()).get(ck);
    const q = m.get(town) || m.set(town, { n: 0, la: 0, lo: 0 }).get(town); q.n++; q.la += p.la; q.lo += p.lo;
  }
}
for (const m of coarse.values()) for (const q of m.values()) { q.la /= q.n; q.lo /= q.n; }
console.log(`door points: ${[...grid.values()].reduce((s, l) => s + l.length, 0)} in ${townPts.size} towns`);
function ours(la, lo, a, tol) {
  const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL);
  for (let di = -4; di <= 4; di++) for (let dj = -5; dj <= 5; dj++) for (const p of grid.get(`${ci + di},${cj + dj}`) || []) {
    const d = metres(la, lo, p.la, p.lo); if (d <= tol || (a && p.a === a && d <= 150)) return p;
  }
  return null;
}
/* the nearest door (kind door) within maxM: rings of cells outward */
function nearestTown(la, lo, maxM) {
  const ci = Math.floor(la / COARSE), cj = Math.floor(lo / COARSE), R = Math.ceil(maxM / 420) + 1;
  let best = null, bd = maxM;
  for (let r = 0; r <= R; r++) {
    if (best && (r - 1) * 420 > bd) break;
    for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      for (const [town, q] of coarse.get(`${ci + di},${cj + dj}`) || []) { const d = metres(la, lo, q.la, q.lo); if (d < bd) { bd = d; best = town; } }
    }
  }
  return best ? { town: best, m: Math.round(bd) } : null;
}
/* a town of ours by its name (the key without g1-/g3-/g4- and -rural), for a situs city */
const townByName = new Map();
for (const t of townPts.keys()) { const n = t.replace(/^g\d-/, '').replace(/-rural$/, ''); if (!townByName.has(n) || !/-rural$/.test(t)) townByName.set(n, t); }

/* ---- land use ---- */
function cls(use) {
  const u = (use || '').toUpperCase();
  if (!u) return 'house';
  if (/MOBILE HOME PARK|MH PARK|MANUFACTURED HOME PARK|TRAILER PARK|MOBILE PARK/.test(u)) return 'mhp';
  if (/COMMERCIAL|INDUSTRIAL|OFFICE|RETAIL|WAREHOUSE|MERCHANDIS|RESTAURANT|HOTEL|MOTEL|LODGING|STORAGE|MANUFACTURING|FRACTIONAL|GARAGE/.test(u)) return 'nonres';
  if (/MOBILE|MANUF|\bMH\b/.test(u)) return 'mobile';
  if (/CONDO/.test(u)) return 'condo';
  if (/APARTMENT|MULTI|4 TO 8|4-8|9\+|9 -|9 & UP|MULTIPLE UNIT|MULTI-RES/.test(u)) return /TOWNHOME STYLE/.test(u) ? 'attached' : 'multi';
  if (/FARM\/RANCH RES|RANCH RESIDENCE|SF ON AG|RESIDENCE NOT INTEGRAL|MIXED USE-AGRES/.test(u)) return 'farmres';
  if (/TOWN|ROW|ATTACHED|DUPLEX|TRIPLEX|PATIO|LIVE\/WORK/.test(u)) return 'attached';
  if (/EXEMPT|AGRICULT|VACANT|MINING|\bMINE|MINERAL|UTILIT|CHURCH|RELIGIOUS|SCHOOL|GOVERNMENT|POLITICAL|HOA|HOME ?OWNER|COMMON|\bPARK\b|NON TAXABLE|NON PROD|NATURAL|NAT\.? R|STATE ASS|REAL STATE|SPECIAL PURPOSE|RECREATION|GRAZING|FARM LAND|IRRIGATED|DRY FARM|OPEN SPACE|POSSESSORY|PERCENT TAXABLE|SEV MIN|-LAND|RES LAND|\bLAND\b$|^LAND|AC TO L\/T|\d+ AC\b|PUD LOTS|LOTS$|CARETAKER/.test(u)) return u.includes('CARETAKER') ? 'house' : 'nonres';
  return 'house';
}
const band = (use) => { const u = (use || '').toUpperCase(); return /9\s*\+|9 & UP|9 - ?UP|9\+/.test(u) ? '9+' : /4 TO 8|4-8|\(4-8\)/.test(u) ? '4-8' : /1-3|TRIPLEX/.test(u) ? '2-3' : null; };
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const ORG = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION|HOUSING AUTHORITY)\b/i;
const PUBLIC_OWNER = /\b(CHURCH|MINISTR\w*|DISTRICT|METROPOLITAN|CITY OF|TOWN OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CEMETERY|SANITATION|WATER|UTILIT\w*|HOUSING AUTHORITY)\b/i;
const UNIT = /(#|\b(APT|UNIT|STE|SUITE|BLDG|SPC|SPACE)\b)\s*\S/i;
const baseAddr = (s) => String(s || '').replace(/\s*(#|\b(APT|UNIT|STE|SUITE|BLDG|SPC|SPACE)\b).*$/i, '').trim();
const zip5 = (z) => String(z || '').replace(/\D/g, '').slice(0, 5);
function occOf(situs, mailStreet, mailCity, mailZip, sitCity, sitZip) {
  if (!mailStreet) return 'N';
  if (/\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mailStreet)) return (zip5(mailZip) && zip5(mailZip) === zip5(sitZip)) || (norm(mailCity) && norm(mailCity) === norm(sitCity)) ? 'L' : 'P';
  const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mailStreet);
  const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mailStreet).replace(/^\d+\s*/, '');
  return sameNum && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)) ? 'Y' : 'A';
}
/* the owner test again for every row (15 Nov): unit-aware ("406 RIDGES BLVD #23" = "406 RIDGES BLVD UNIT 23"), a mailing line with no
   street is "not known", and a PO box is local when its ZIP is one the county's own owner-lived houses mail from (Group 3's rule,
   Matthew 29 Oct: local PO box = lives here). The pull's own Y stands. */
const normU = (s) => norm(String(s || '').replace(/(#|\b(APT|UNIT|STE|SUITE|BLDG|SPC|SPACE|LOT|NO)\b\.?)\s*/gi, ' '));
function mailParts(mail) {
  const p = String(mail || '').split(',').map((x) => x.trim()).filter(Boolean);
  const zip = /^\d{5}/.test(p[p.length - 1] || '') ? p.pop().slice(0, 5) : '';
  const st = /^[A-Z]{2}$/.test(p[p.length - 1] || '') && p.length > 1 ? p.pop() : '';
  const street = p.shift() || ''; const city = p.join(' ');
  return { street, city, st, zip };
}
function occAgain(x, localZips) {
  if (x.occ === 'Y') return 'Y';
  const m = mailParts(x.mail); if (!m.street) return 'N';
  if (/\bP\s*O\s*BOX\b|\bPOBOX\b|^BOX\s+\d/i.test(m.street)) return (m.zip && (m.zip === x.zip || localZips.has(m.zip))) || (norm(m.city) && norm(m.city) === norm(x.city)) ? 'L' : 'P';
  if (!/\d/.test(m.street)) return 'N';
  const sameNum = houseNo(x.situs) && houseNo(x.situs) === houseNo(m.street);
  const sn = normU(x.situs).replace(/^\d+\s*/, ''), mn = normU(m.street).replace(/^\d+\s*/, '');
  return sameNum && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)) ? 'Y' : 'A';
}
/* Huerfano: "01ST ST W # 00101" -> "101 W 1ST ST"; "MAIN ST # 00512" -> "512 MAIN ST" (a slash or letter after the number is kept) */
function huerfanoAddr(s) {
  const m = String(s || '').match(/^(.*?)\s*#\s*0*(\d+(?:\.\d+)?)([A-Z]?(?:\s*[-&\/]\s*[\d.]+[A-Z]?)*)\s*(?:\(.*\))?\s*$/i); if (!m) return s;
  let street = m[1].trim().replace(/^0+(\d)/, '$1'); const dm = street.match(/^(.*)\s+(N|S|E|W)$/);
  return dm ? `${m[2]}${m[3] || ''} ${dm[2]} ${dm[1]}` : `${m[2]}${m[3] || ''} ${street}`;
}
const HUERFANO_T = arg('g3') && existsSync(arg('g3')) ? JSON.parse(readFileSync(arg('g3'), 'utf8')).filter((t) => t.county === 'Huerfano') : [];
const huerfanoTown = (la, lo) => {
  const inR = (t) => metres(la, lo, t.lat, t.lon) <= t.radius * 1609;
  return (HUERFANO_T.filter((t) => t.kind === 'town').find(inR) || HUERFANO_T.filter((t) => t.kind !== 'town').filter(inR).sort((a, b) => metres(la, lo, a.lat, a.lon) - metres(la, lo, b.lat, b.lon))[0] || {}).key || 'g3-huerfano-other';
};

/* ---- El Paso assessor file ---- */
let epc = null;
if (arg('epc') && existsSync(arg('epc'))) {
  epc = new Map();
  const L = readFileSync(arg('epc'), 'latin1').split(/\r?\n/); const h = L[0].split('\t'); const ix = (k) => h.indexOf(k);
  epc.I = Object.fromEntries(['PARCEL', 'LOCATION', 'LOCATIONZIP', 'IMPSTATEDESCR', 'LANDCODEDESCR', 'Acreage', 'MAILADR', 'MAILCITY', 'MAILSTATE', 'MAILZIPCODE', 'OWNER1', 'OWNER2', 'UNITS', 'YearBlt'].map((k) => [k, ix(k)]));
  for (const l of L.slice(1)) { const r = l.split('\t'); if (r.length < 10) continue; epc.set(r[epc.I.PARCEL].replace(/\D/g, '').replace(/^0+/, ''), r); }
  console.log(`El Paso assessor file: ${epc.size} parcels`);
}

const counts = { built: new Date().toISOString(), note: 'counts only (distinct addresses where it says addrs); every1115/classify-vm.mjs', counties: {} };
const cand = createWriteStream(join(OUT, 'cand.tsv'));
const CH = ['kind', 'county', 'town', 'join', 'oid', 'parcel', 'use', 'acres', 'address', 'city', 'zip', 'occ', 'owner', 'mail', 'lat', 'lon', 'sub', 'units', 'band', 'owners', 'recv', 'yb', 'why'];
cand.write(CH.join('\t') + '\n');
const marks = createWriteStream(join(OUT, 'marks-existing.tsv')); marks.write('town\taddress\tkind\n');
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const newTownKey = (county, city) => {
  const c = slug(city).toLowerCase();
  if (!c || /^(na|none|unknown|unincorporated|unincorp|county|.*-county|.*-area)$/.test(c)) return `g4-${county}-other`;
  return `g4-${c}`;
};

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.tsv.gz')).sort()) {
  const county = f.replace(/\.tsv\.gz$/, ''); if (SKIP.test(county)) continue;
  const isEP = county === 'el-paso', isHU = county === 'huerfano';
  const L = gunzipSync(readFileSync(join(DIR, f))).toString('utf8').split('\n'); const h = L[0].split('\t'); const I = Object.fromEntries(h.map((k, i) => [k, i]));
  const C = { parcels: 0, ours: 0, oursByCls: {}, b: {} };
  const add = (b, n = 1) => { C.b[b] = (C.b[b] || 0) + n; };
  /* pass 1: rows as this classifier reads them */
  const rows = [];
  for (const line of L.slice(1)) {
    if (!line) continue; const r = line.split('\t');
    let use = r[I.use], acres = +r[I.acres], situs = r[I.situs], city = r[I.city], zip = r[I.zip], owner = r[I.owner] || '', mail = r[I.mail] || '';
    let units = null, yb = null;
    let mailStreet = mail.split(',')[0].trim(); const mp = mail.split(',').map((s) => s.trim()); let mailCity = mp.length > 3 ? mp[mp.length - 3] : '', mailZip = mp[mp.length - 1] || '';
    if (isEP && epc) {
      const e = epc.get(String(r[I.parcel]).replace(/\D/g, '').replace(/^0+/, '')); const E = epc.I;
      if (!e) { use = 'NO ASSESSOR ROW'; }
      else {
        use = (e[E.IMPSTATEDESCR] || '').trim() || (e[E.LANDCODEDESCR] || '').trim(); situs = (e[E.LOCATION] || '').replace(/\s+/g, ' ').trim(); zip = zip5(e[E.LOCATIONZIP]); city = '';
        if (+e[E.Acreage] > 0) acres = +e[E.Acreage];
        owner = [e[E.OWNER1], e[E.OWNER2]].map((s) => (s || '').trim()).filter(Boolean).join(' / ');
        mailStreet = (e[E.MAILADR] || '').trim(); mailCity = (e[E.MAILCITY] || '').trim(); mailZip = e[E.MAILZIPCODE];
        mail = [mailStreet, mailCity, (e[E.MAILSTATE] || '').trim(), zip5(mailZip)].filter(Boolean).join(', ');
        units = +e[E.UNITS] > 0 ? +e[E.UNITS] : null; yb = +e[E.YearBlt] > 1800 ? +e[E.YearBlt] : null;
      }
    }
    if (isHU) { situs = huerfanoAddr(situs); city = ''; }
    const occ = (isEP || isHU) ? occOf(situs, mailStreet, mailCity, mailZip, city, zip) : r[I.occ];
    rows.push({ oid: r[I.oid], parcel: r[I.parcel], use, c: cls(use === 'NO ASSESSOR ROW' ? 'EXEMPT' : use), acres, situs: clean(situs), city: clean(city), zip, occ, owner: clean(owner), mail: clean(mail),
      org: ORG.test(owner), la: +r[I.lat], lo: +r[I.lon], sub: r[I.sub] || '', recv: r[I.recv] || '', units, yb });
  }
  { const zc = new Map(); for (const x of rows) if (x.occ === 'Y') { const z = mailParts(x.mail).zip; if (z) zc.set(z, (zc.get(z) || 0) + 1); }
    const localZips = new Set([...zc].filter(([, n]) => n >= 3).map(([z]) => z));
    for (const x of rows) x.occ = occAgain(x, localZips); }
  /* home parcels per point (~1 m): stacked condo flats share one footprint */
  const HOMEC = new Set(['house', 'attached', 'condo', 'multi', 'farmres', 'mobile']);
  const pk = (x) => `${x.la.toFixed(5)},${x.lo.toFixed(5)}`;
  const atPt = new Map(); for (const x of rows) if (HOMEC.has(x.c) && Math.abs(x.la) > 0 && x.situs) { const k = pk(x); (atPt.get(k) || atPt.set(k, []).get(k)).push(x); }
  const out = (kind, x, town, join_, extra = {}) => cand.write([kind, county, town, join_, x.oid, x.parcel, x.use, (+x.acres || 0).toFixed(3), extra.address || x.situs, x.city, x.zip,
    extra.occ || (x.occ === 'Y' || x.occ === 'L' ? 'here' : x.occ === 'N' ? 'unk' : 'away'), extra.owner ?? x.owner, extra.mail ?? x.mail, x.la.toFixed(6), x.lo.toFixed(6), clean(x.sub), extra.units ?? x.units ?? '', extra.band ?? '', extra.owners ?? '', x.recv, x.yb ?? '', extra.why || ''].map(clean).join('\t') + '\n');
  const doorTown = (x) => {
    if (isHU) return { town: huerfanoTown(x.la, x.lo), join: 'new' };
    const n = nearestTown(x.la, x.lo, 3000); if (n) return { town: n.town, join: 'add' };
    /* a situs city that names a town of ours, within 9 km of it: that town's edge (promotion reaches ~9 km) */
    const named = townByName.get(slug(x.city).toLowerCase()); if (named) { const f = nearestTown(x.la, x.lo, 9000); if (f && f.town === named) return { town: named, join: 'add' }; }
    return { town: newTownKey(county, x.city), join: 'new' };
  };
  const bldTown = (x) => {
    if (isHU) return { town: huerfanoTown(x.la, x.lo), join: 'new' };
    const n = nearestTown(x.la, x.lo, 9000); if (n) return { town: n.town, join: 'add' };
    return { town: newTownKey(county, x.city), join: 'new-if' };   /* only if that new town gets doors (make-lists-vm.mjs) */
  };
  const seenAddr = new Set(); const doneStack = new Set();
  for (const x of rows) {
    C.parcels++;
    if (!(Math.abs(x.la) > 0)) { add('nogeom'); continue; }
    if (x.c === 'nonres') { add('nonres'); continue; }
    if (!x.situs || !/\d/.test(x.situs)) { add('nositus'); continue; }
    const m = ours(x.la, x.lo, slug(x.situs), isEP ? 15 : 6);
    if (m) {
      C.ours++; C.oursByCls[x.c] = (C.oursByCls[x.c] || 0) + 1;
      if (m.kind === 'door' && (x.c === 'mobile' || (x.c === 'condo' && (atPt.get(pk(x)) || []).length < 2))) marks.write([m.town, m.a, x.c === 'mobile' ? 'mh' : 'th'].join('\t') + '\n');
      continue;
    }
    if (PUBLIC_OWNER.test(x.owner)) { add('public'); continue; }
    const stack = atPt.get(pk(x)) || [];
    if (stack.length >= 2 && x.c !== 'mhp') {
      /* one building entry per footprint: units = home parcels on it; skipped when half or more of them are doors of ours already */
      const k = pk(x); if (doneStack.has(k)) { add('stacked-unit'); continue; } doneStack.add(k);
      const mine = stack.filter((y) => ours(y.la, y.lo, slug(y.situs), isEP ? 15 : 6)).length;
      if (mine * 2 >= stack.length) { add('stacked-ours'); continue; }
      const own = new Map(); for (const y of stack) own.set(y.owner, (own.get(y.owner) || 0) + 1);
      const top = [...own.entries()].sort((a, b) => b[1] - a[1])[0];
      const bases = new Map(); for (const y of stack) { const b = baseAddr(y.situs); bases.set(b, (bases.get(b) || 0) + 1); }
      const addr = [...bases.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const bk = stack.some((y) => y.c === 'multi') ? 'apt' : 'condo';
      const t = bldTown(x); add(`bld-${bk}`); add(`bld-${bk}-units`, stack.length); add('stacked-unit');
      out('b', x, t.town, t.join, { address: addr, units: stack.length, owner: top[1] * 2 > stack.length ? top[0] : '', mail: top[1] * 2 > stack.length ? stack.find((y) => y.owner === top[0]).mail : '', owners: own.size, occ: 'away', band: bk, why: 'stacked' });
      continue;
    }
    if (x.c === 'multi') { const t = bldTown(x); add('bld-apt'); add('bld-apt-units', x.units || 0); out('b', x, t.town, t.join, { address: baseAddr(x.situs) || x.situs, band: 'apt', units: x.units ?? '', why: band(x.use) || '' }); continue; }
    if (x.c === 'mhp' || (x.c === 'mobile' && x.acres > 3 && x.org)) { const t = bldTown(x); add('bld-mhp'); out('b', x, t.town, t.join, { address: baseAddr(x.situs) || x.situs, band: 'mhp', units: x.units ?? '', why: 'park' }); continue; }
    if (x.acres > 10) { add('big'); if (x.c === 'house' || x.c === 'farmres' || x.c === 'attached') add(`big-${x.occ === 'Y' || x.occ === 'L' ? 'here' : 'away'}`); continue; }
    if (x.org && (x.occ === 'Y' || x.occ === 'L')) { add('bizhere'); continue; }
    const t = doorTown(x); const key = `${t.town}|${slug(x.situs)}`;
    if (seenAddr.has(key)) { add('repeat'); continue; } seenAddr.add(key);
    const here = x.occ === 'Y' || x.occ === 'L';   /* bucket names say here / away; occ 'N' (no mailing address) is written as unk */
    if (x.c === 'mobile') { add(`mh-${here ? 'here' : 'away'}`); out('mh', x, t.town, t.join); continue; }
    if (x.c === 'condo') { add(`th-${here ? 'here' : 'away'}`); out('th', x, t.town, t.join); continue; }
    if (UNIT.test(x.situs)) { add(`th-${here ? 'here' : 'away'}`); out('th', x, t.town, t.join, { why: 'unit, own footprint' }); continue; }
    add(`house-${here ? 'here' : 'away'}`); add(`house-${here ? 'here' : 'away'}-${t.join}`);
    out('house', x, t.town, t.join);
  }
  counts.counties[county] = C;
  console.log(`${county}: ${C.parcels} parcels, ${C.ours} ours; ${Object.entries(C.b).filter(([k]) => !/units|-add|-new/.test(k)).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
await new Promise((r) => cand.end(r)); await new Promise((r) => marks.end(r));
const tot = {}; for (const C of Object.values(counts.counties)) for (const [k, v] of Object.entries(C.b)) tot[k] = (tot[k] || 0) + v;
counts.total = tot;
writeFileSync(join(OUT, 'counts.json'), JSON.stringify(counts, null, 1));
console.log('TOTAL', JSON.stringify(tot));

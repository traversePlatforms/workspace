#!/usr/bin/env node
/* Gap plan 2026-11-08, step 2: sort every parcel on the state layer against our doors, and say why each house that is not a door
   is not one. Counts only in the output (no names, no addresses; city names for the never-pulled houses).
   Usage: node gap-classify.mjs <state dir from gap-pull-vm.mjs> <door-points.tsv> <out.json> [--epc=<EPC Parcel Data.txt>]
   --epc: El Paso's assessor file (assessor.elpasoco.com), joined by parcel number, because El Paso's state rows carry geometry only.

   A parcel is matched to a door (or an office-lookup home) when one sits within 6 m of its point (15 m in El Paso, whose doors were
   drawn from the county's own parcel layer), or the same address sits within 150 m. Then, for a parcel that is NOT a door, the first
   of these that applies is its bucket:
     nogeom   no shape on the layer
     nonres   land use is not a home (commercial, exempt, vacant, farm land, HOA, ...)
     multi    apartments / 4+ units
     condo    land use says condominium (build-walklist-co.mjs drops CONDO)
     mobile   mobile or manufactured home (build-walklist-co.mjs drops MOBILE)
     farmres  a house on farm land (build-walklist-co.mjs drops AGRICULT; El Paso's FARM/RANCH RESIDENCE)
     nositus  no property address on the record
     big      over 10 acres (the walk lists' cap)
     org      the owner is an organisation (LLC, church, city, ...)
     ownerY   the owner lives here and nothing above applies: a door under today's rules that was never pulled (outside our pulls)
     localpo  the owner's PO box is in the house's own town or ZIP (Group 3 stage B counts these as lives-here)
     absent   the owner mails elsewhere (rentals, second homes) or no mailing address
   Every bucket carries parcels and distinct addresses; the land-use class split (house / attached / condo / ...) is kept too. */
import { readFileSync, writeFileSync, readdirSync, createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const [DIR, DOORS, OUT] = process.argv.slice(2);
const EPC = (process.argv.find((a) => a.startsWith('--epc=')) || '').slice(6);
if (!OUT) { console.error('usage: node gap-classify.mjs <state dir> <door-points.tsv> <out.json> [--epc=file]'); process.exit(1); }

const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const CELL = 0.0004;   /* ~44 m by ~34 m at 39-40 deg N */
const cellKey = (la, lo) => `${Math.floor(la / CELL)},${Math.floor(lo / CELL)}`;
const metres = (la1, lo1, la2, lo2) => { const kx = 111320 * Math.cos(la1 * Math.PI / 180); return Math.hypot((lo2 - lo1) * kx, (la2 - la1) * 110540); };

/* our doors and office-lookup homes, by county */
const COUNTY_KEY = (c) => c.toLowerCase().replace(/[^a-z]/g, '');
const grid = new Map(); const doorsInCounty = {}; const lookupsInCounty = {};
let nd = 0;
for (const line of readFileSync(DOORS, 'utf8').split('\n').slice(1)) {
  if (!line) continue;
  const [kind, county, town, address, la, lo] = line.split('\t');
  const p = { kind, county, town, a: slug(address), la: +la, lo: +lo, hit: 0 };
  if (!(Math.abs(p.la) > 0)) continue;
  const k = cellKey(p.la, p.lo); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); nd++;
  const tgt = kind === 'door' ? doorsInCounty : lookupsInCounty; tgt[county] = (tgt[county] || 0) + 1;
}
console.log(`${nd} door points loaded`);
function match(la, lo, a, tol) {
  const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL);
  let best = null, bd = Infinity, addr = null;
  for (let di = -3; di <= 3; di++) for (let dj = -4; dj <= 4; dj++) {
    const list = grid.get(`${ci + di},${cj + dj}`); if (!list) continue;
    for (const p of list) {
      const d = metres(la, lo, p.la, p.lo);
      if (d < bd) { bd = d; best = p; }
      if (a && p.a === a && d <= 150 && (!addr || p.kind === 'door')) addr = p;
    }
  }
  if (best && bd <= tol) return best;
  return addr;
}

/* land-use classes */
function cls(use) {
  const u = (use || '').toUpperCase();
  if (!u) return 'house';
  if (/COMMERCIAL|INDUSTRIAL|OFFICE|RETAIL|WAREHOUSE|MERCHANDIS|RESTAURANT|HOTEL|MOTEL|LODGING|STORAGE|MANUFACTURING|FRACTIONAL/.test(u)) return 'nonres';
  if (/CONDO/.test(u)) return 'condo';
  if (/MOBILE|MANUF|\bMH\b/.test(u)) return 'mobile';
  if (/APARTMENT|MULTI|4 TO 8|4-8|9\+|9 -|9 & UP|MULTIPLE UNIT/.test(u)) return 'multi';
  if (/FARM\/RANCH RES|RANCH RESIDENCE|SF ON AG|RESIDENCE NOT INTEGRAL|MIXED USE-AGRES/.test(u)) return 'farmres';
  if (/TOWN|ROW|ATTACHED|DUPLEX|TRIPLEX|PATIO|LIVE\/WORK/.test(u)) return 'attached';
  if (/EXEMPT|AGRICULT|VACANT|MINING|\bMINE|MINERAL|UTILIT|CHURCH|RELIGIOUS|SCHOOL|GOVERNMENT|POLITICAL|HOA|HOME ?OWNER|COMMON|\bPARK\b|NON TAXABLE|NON PROD|NATURAL|NAT\.? R|STATE ASS|REAL STATE|SPECIAL PURPOSE|RECREATION|GRAZING|FARM LAND|IRRIGATED|DRY FARM|OPEN SPACE|GARAGE|POSSESSORY|PERCENT TAXABLE|SEV MIN|-LAND|RES LAND|\bLAND\b$|^LAND|AC TO L\/T|\d+ AC\b|PUD LOTS|LOTS$|CARETAKER/.test(u)) return u.includes('CARETAKER') ? 'house' : 'nonres';
  return 'house';
}

/* El Paso's assessor file, by parcel number (digits only) */
let epc = null;
if (EPC && existsSync(EPC)) {
  epc = new Map();
  const L = readFileSync(EPC, 'latin1').split(/\r?\n/); const h = L[0].split('\t'); const ix = (k) => h.indexOf(k);
  const I = Object.fromEntries(['PARCEL', 'LOCATION', 'LOCATIONZIP', 'IMPSTATEDESCR', 'LANDCODEDESCR', 'Acreage', 'MAILADR', 'MAILCITY', 'MAILZIPCODE', 'OWNER1'].map((k) => [k, ix(k)]));
  for (const l of L.slice(1)) { const r = l.split('\t'); if (r.length < 10) continue; epc.set(r[I.PARCEL].replace(/\D/g, '').replace(/^0+/, ''), r); }
  epc.I = I;
  console.log(`El Paso assessor file: ${epc.size} parcels`);
}
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const ORG = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION|HOUSING AUTHORITY)\b/i;
function occOf(situs, mail, mailCity, mailZip, sitCity, sitZip) {
  if (!mail) return 'N';
  const z = (x) => String(x || '').replace(/\D/g, '').slice(0, 5);
  if (/\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail)) return (z(mailZip) && z(mailZip) === z(sitZip)) || (norm(mailCity) && norm(mailCity) === norm(sitCity)) ? 'L' : 'P';
  const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mail);
  const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mail).replace(/^\d+\s*/, '');
  return sameNum && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)) ? 'Y' : 'A';
}

const out = { built: new Date().toISOString(), note: 'counts only; see gap-classify.mjs for the buckets', counties: {} };
const files = readdirSync(DIR).filter((f) => f.endsWith('.tsv.gz')).sort();
for (const f of files) {
  const rl = createInterface({ input: createReadStream(join(DIR, f)).pipe(createGunzip()), crlfDelay: Infinity });
  let head = null, county = f.replace(/\.tsv\.gz$/, '');
  const isElPaso = county === 'el-paso';
  const C = { parcels: 0, matchedDoor: 0, matchedLookup: 0, matchedByCls: {}, buckets: {}, ownerYCities: {}, absentCities: {} };
  const seen = {};   /* bucket -> Set of address slugs */
  const add = (b, c, a) => { const B = (C.buckets[b] ||= { parcels: 0, addrs: 0, byCls: {} }); B.parcels++; B.byCls[c] = (B.byCls[c] || 0) + 1; if (a) { const s = (seen[b] ||= new Set()); if (!s.has(a)) { s.add(a); B.addrs++; } } };
  for await (const line of rl) {
    if (!head) { head = line.split('\t'); continue; }
    const r = line.split('\t'); const g = (k) => r[head.indexOf(k)];
    let use = g('use'), acres = +g('acres'), situs = g('situs'), city = g('city'), occ = g('occ'), org = g('org') === '1';
    if (isElPaso && epc) {
      const e = epc.get(String(g('parcel')).replace(/\D/g, '').replace(/^0+/, ''));
      if (e) {
        const I = epc.I; use = (e[I.IMPSTATEDESCR] || '').trim() || (e[I.LANDCODEDESCR] || '').trim();
        situs = (e[I.LOCATION] || '').trim(); city = 'ZIP ' + String(e[I.LOCATIONZIP] || '').replace(/\D/g, '').slice(0, 5);   /* El Paso gives no situs city */
        if (+e[I.Acreage] > 0) acres = +e[I.Acreage];
        occ = occOf(situs, (e[I.MAILADR] || '').trim(), e[I.MAILCITY], e[I.MAILZIPCODE], '', e[I.LOCATIONZIP]);
        org = ORG.test(e[I.OWNER1] || '');
      } else { use = 'NO ASSESSOR ROW'; }
    }
    if (county === 'el-paso' && !epc) continue;
    C.parcels++;
    const la = +g('lat'), lo = +g('lon'); const a = slug(situs);
    const c = cls(use === 'NO ASSESSOR ROW' ? 'EXEMPT' : use);
    if (!(Math.abs(la) > 0)) { add('nogeom', c, a); continue; }
    const m = match(la, lo, a, isElPaso ? 15 : 6);
    if (m) {
      if (m.kind === 'door') C.matchedDoor++; else C.matchedLookup++;
      C.matchedByCls[`${m.kind}:${c}`] = (C.matchedByCls[`${m.kind}:${c}`] || 0) + 1;
      m.hit++; continue;
    }
    let b;
    if (c === 'nonres' || c === 'multi' || c === 'condo' || c === 'mobile' || c === 'farmres') b = c;
    else if (!situs) b = 'nositus';
    else if (acres > 10) b = 'big';
    else if (org) b = 'org';
    else if (occ === 'Y') b = 'ownerY';
    else if (occ === 'L') b = 'localpo';
    else b = 'absent';
    if ((b === 'condo' || b === 'mobile' || b === 'farmres') && situs && !org) add(`${b}:${occ === 'Y' || occ === 'L' ? 'lives' : 'away'}`, c, a);
    add(b, c, a);
    const cityKey = (city || 'NO CITY').toUpperCase();
    if (b === 'ownerY') C.ownerYCities[cityKey] = (C.ownerYCities[cityKey] || 0) + 1;
    if (b === 'absent' || b === 'localpo') C.absentCities[cityKey] = (C.absentCities[cityKey] || 0) + 1;
  }
  const top = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n);
  C.ownerYCities = top(C.ownerYCities, 40); C.absentCities = top(C.absentCities, 25);
  out.counties[county] = C;
  console.log(`${county}: ${C.parcels} parcels, ${C.matchedDoor} on a door, ${C.matchedLookup} on a lookup home; ownerY ${C.buckets.ownerY?.addrs || 0}, absent ${C.buckets.absent?.addrs || 0}, condo ${C.buckets.condo?.addrs || 0}`);
}
/* doors no parcel landed on, per county key (doors built from other sources: address points, El Paso without --epc, ...) */
const unhit = {};
for (const list of grid.values()) for (const p of list) if (!p.hit) { const k = `${p.kind}:${p.county}`; unhit[k] = (unhit[k] || 0) + 1; }
out.doorsInCounty = doorsInCounty; out.lookupsInCounty = lookupsInCounty; out.unmatchedDoorPoints = unhit;
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`written ${OUT}`);

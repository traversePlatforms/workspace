#!/usr/bin/env node
/* Gap plan 2026-11-08: El Paso door lists from the county assessor's own bulk file, no geocoding and no per-parcel calls.
   Why: El Paso is our biggest gap (226,774 Census houses, 130,261 doors). Its rows on the state parcel layer carry geometry only, so
   build-walklist.mjs reverse-geocodes every parcel through the county's locator, and that is why Group 1's 11 El Paso targets never got
   pulled (the service timed out). The assessor file (assessor.elpasoco.com/assessordata, "EPC Parcel Data.txt", already used for values
   and year built) has every parcel's property address (LOCATION, LOCATIONZIP), owner, mailing address, acreage and improvement type.
   The parcel's point comes from the state layer's El Paso shapes (gap-pull-vm.mjs: state/el-paso.tsv.gz, the mean of the first ring's
   points, as every builder does), joined on the parcel number.

   Rules, the same as every walk list since Group 1 plus Group 3's local PO box rule:
     house       improvement SINGLE FAMILY RESIDENTIAL, FARM/RANCH RESIDENCE or RESIDENCE NOT INTEGRAL TO AG OPERATION (condos, duplexes,
                 apartments, mobile homes and everything else out, as elsewhere)
     lot         0 to 10 acres (Acreage, else the shape)
     address     LOCATION not blank; organisation owners (LLC, church, city, ...) out, family trusts kept
     knock YES   the owner's mailing address is the house (same number + street), or a PO box in the house's own ZIP
                 ("owner's PO box is in town", Group 3 stage B rule 1); otherwise "no — post" (kept in the CSV, never a door)
   Then each row is dropped if it is one of ours already: a door or office-lookup home within 15 m, or the same address within 150 m.
   What is left goes to the nearest of our El Paso towns when a door of ours is within 400 m (merge-<town>.csv: added to that town,
   existing doors untouched), else to the first Group 1 El Paso target whose Census shape holds it (group1/pieces-<key>.json), else to
   the nearest of our El Paso towns within 3 km, else to g1-el-paso-other.
   Writes, in <out>: <key>.csv (build-walklist-co.mjs's columns), merge-<town>.csv, b-towns.txt, merge-towns.txt, registered.json,
   summary.tsv (counts only). The CSVs hold owner names: they stay on the VM / gitignored, as every walk list does.
   Usage: node build-walklist-epc.mjs <EPC Parcel Data.txt> <state/el-paso.tsv.gz> <door-points.tsv> <group1 dir> <out dir>          */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const [EPC, STATE, DOORS, G1, OUT] = process.argv.slice(2);
if (!OUT) { console.error('usage: node build-walklist-epc.mjs <EPC> <el-paso.tsv.gz> <door-points.tsv> <group1 dir> <out dir>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const pk = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const metres = (la1, lo1, la2, lo2) => Math.hypot((lo2 - lo1) * 111320 * Math.cos(la1 * Math.PI / 180), (la2 - la1) * 110540);

/* parcel points from the state layer */
const pts = new Map();
{
  const L = gunzipSync(readFileSync(STATE)).toString('utf8').split('\n'); const h = L[0].split('\t');
  const iP = h.indexOf('parcel'), iA = h.indexOf('acres'), iLa = h.indexOf('lat'), iLo = h.indexOf('lon');
  for (const l of L.slice(1)) { const r = l.split('\t'); if (r.length < 5 || !r[iLa]) continue; pts.set(pk(r[iP]), { la: +r[iLa], lo: +r[iLo], ac: +r[iA] }); }
}
console.log(`state layer El Paso points: ${pts.size}`);

/* our doors and lookup homes, gridded */
const CELL = 0.0004, grid = new Map();
const ck = (la, lo) => `${Math.floor(la / CELL)},${Math.floor(lo / CELL)}`;
const epTowns = new Map();   /* El Paso town -> doors (for the nearest-town merge) */
for (const line of readFileSync(DOORS, 'utf8').split('\n').slice(1)) {
  if (!line) continue; const [kind, county, town, address, la, lo] = line.split('\t');
  const p = { kind, town, a: slug(address), la: +la, lo: +lo };
  const k = ck(p.la, p.lo); (grid.get(k) || grid.set(k, []).get(k)).push(p);
  if (county === 'elpaso' && kind === 'door') { const t = epTowns.get(town) || { n: 0, la: 0, lo: 0 }; t.n++; t.la += p.la; t.lo += p.lo; epTowns.set(town, t); }
}
function ours(la, lo, a) {
  const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL);
  for (let di = -4; di <= 4; di++) for (let dj = -5; dj <= 5; dj++) for (const p of grid.get(`${ci + di},${cj + dj}`) || []) {
    const d = metres(la, lo, p.la, p.lo); if (d <= 15 || (a && p.a === a && d <= 150)) return p;
  }
  return null;
}
function nearestTown(la, lo, maxM) {   /* the El Paso town of the nearest door within maxM metres */
  const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL); let best = null, bd = maxM;
  for (let r = 0; r <= Math.ceil(maxM / 40) + 10 && !best; r += 10) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) < r - 10) continue;
    for (const p of grid.get(`${ci + di},${cj + dj}`) || []) if (p.kind === 'door' && epTowns.has(p.town)) { const d = metres(la, lo, p.la, p.lo); if (d < bd) { bd = d; best = p.town; } }
  }
  return best;
}

/* Group 1's El Paso targets and their Census shapes */
const targets = JSON.parse(readFileSync(join(G1, 'targets.json'), 'utf8')).filter((t) => t.county === 'El Paso');
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
for (const t of targets) { const f = join(G1, `pieces-${t.key}.json`); t.pieces = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : []; }
const targetOf = (la, lo) => targets.find((t) => t.pieces.some((p) => lo >= p.bb[0] && lo <= p.bb[2] && la >= p.bb[1] && la <= p.bb[3] && p.rings.filter((r) => inRing(lo, la, r)).length % 2 === 1));

/* the assessor file */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const ORG = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION|HOUSING AUTHORITY)\b/i;
const HOUSE = /^(SINGLE FAMILY RESIDENTIAL|FARM\/RANCH RESIDENCE|RESIDENCE NOT INTEGRAL TO AG OPERATION)$/;
const L = readFileSync(EPC, 'latin1').split(/\r?\n/); const h = L[0].split('\t'); const ix = (k) => h.indexOf(k);
const I = Object.fromEntries(['PARCEL', 'LOCATION', 'LOCATIONZIP', 'IMPSTATEDESCR', 'LANDCODEDESCR', 'Acreage', 'OWNER1', 'OWNER2', 'MAILADR', 'MAILCITY', 'MAILSTATE', 'MAILZIPCODE'].map((k) => [k, ix(k)]));
const zip5 = (z) => String(z || '').replace(/\D/g, '').slice(0, 5);
const raw = []; const zipCity = {};
const drop = { notHouse: 0, noPoint: 0, size: 0, noAddress: 0, org: 0, ours: 0 };
for (const l of L.slice(1)) {
  const r = l.split('\t'); if (r.length < 20) continue;
  const imp = (r[I.IMPSTATEDESCR] || '').trim(), land = (r[I.LANDCODEDESCR] || '').trim();
  if (!HOUSE.test(imp)) { drop.notHouse++; continue; }
  const p = pts.get(pk(r[I.PARCEL])); if (!p) { drop.noPoint++; continue; }
  const acres = +r[I.Acreage] > 0 ? +r[I.Acreage] : p.ac;
  if (!(acres >= 0) || acres > 10) { drop.size++; continue; }
  const situs = (r[I.LOCATION] || '').replace(/\s+/g, ' ').trim(); if (!/^\d+\s+\S/.test(situs)) { drop.noAddress++; continue; }
  const owner = [r[I.OWNER1], r[I.OWNER2]].map((s) => (s || '').trim()).filter(Boolean).join(' / ');
  if (ORG.test(owner)) { drop.org++; continue; }
  const mail = (r[I.MAILADR] || '').trim(), zip = zip5(r[I.LOCATIONZIP]);
  let knock = false, why;
  if (/\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail)) { knock = zip && zip5(r[I.MAILZIPCODE]) === zip; why = knock ? "owner's PO box is in town" : 'owner mails to a PO box'; }
  else {
    const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mail);
    const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mail).replace(/^\d+\s*/, '');
    knock = Boolean(sameNum && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)));
    why = knock ? 'owner lives here' : `owner is in ${(r[I.MAILCITY] || r[I.MAILSTATE] || 'another area').trim()}`;
    if (knock && zip) { const c = (r[I.MAILCITY] || '').trim().toUpperCase(); if (c) { const z = (zipCity[zip] ||= {}); z[c] = (z[c] || 0) + 1; } }
  }
  if (ours(p.la, p.lo, slug(situs))) { drop.ours++; continue; }
  raw.push({ knock, situs, zip, acres, owner, mail: [mail, r[I.MAILCITY], r[I.MAILSTATE], r[I.MAILZIPCODE]].map((s) => (s || '').trim()).filter(Boolean).join(', '), why, parcel: r[I.PARCEL].trim(), la: p.la, lo: p.lo });
}
const cityOf = (zip) => { const z = zipCity[zip]; return z ? Object.entries(z).sort((a, b) => b[1] - a[1])[0][0] : 'EL PASO COUNTY'; };

/* one row per parcel, then per address (two parcels at one address are one door, the walk-list PDF rule) */
const seenP = new Set(), groups = new Map();
for (const x of raw) {
  if (seenP.has(x.parcel)) continue; seenP.add(x.parcel);
  /* inside one of our towns (a door of ours within 400 m: e.g. the small lots Monument, Black Forest and Palmer Lake left out at their
     0.18-acre floor) -> added to that town; else the Group 1 target whose shape holds it; else the nearest town within 3 km */
  const near = nearestTown(x.la, x.lo, 400); const t = near ? null : targetOf(x.la, x.lo);
  let key = near ? `merge:${near}` : t ? t.key : null;
  if (!key) { const n = nearestTown(x.la, x.lo, 3000); key = n ? `merge:${n}` : 'g1-el-paso-other'; }
  (groups.get(key) || groups.set(key, []).get(key)).push(x);
}
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon'].join(',');
const sum = [['key', 'kind', 'census', 'rows', 'owner_lives_here', 'local_po_box', 'post'].join('\t')];
const bTowns = [], mTowns = [], reg = [];
for (const [key, rows] of [...groups.entries()].sort()) {
  rows.sort((a, b) => a.situs.replace(/^\d+\s*/, '').localeCompare(b.situs.replace(/^\d+\s*/, '')) || (+houseNo(a.situs) - +houseNo(b.situs)));
  const csv = [head, ...rows.map((x) => [x.knock ? 'YES' : 'no — post', x.situs, cityOf(x.zip), x.zip, x.acres.toFixed(2), x.owner, x.mail, x.why, x.parcel, x.la.toFixed(6), x.lo.toFixed(6)].map(esc).join(','))].join('\n');
  const merge = key.startsWith('merge:'), name = merge ? `merge-${key.slice(6)}` : key;
  writeFileSync(join(OUT, `${name}.csv`), csv, 'utf8');
  const yes = rows.filter((x) => x.knock).length, po = rows.filter((x) => x.knock && x.why.includes('PO box')).length;
  const t = targets.find((x) => x.key === key);
  sum.push([name, merge ? 'merge' : (t ? t.kind : 'other'), t ? t.census : '', rows.length, yes - po, po, rows.length - yes].join('\t'));
  if (!yes) continue;
  if (merge) mTowns.push(key.slice(6));
  else { bTowns.push(key); const la = rows.reduce((s, x) => s + x.la, 0) / rows.length, lo = rows.reduce((s, x) => s + x.lo, 0) / rows.length; reg.push({ key, label: t ? t.label : 'El Paso County (other)', lat: +(t ? t.lat : la).toFixed(5), lon: +(t ? t.lon : lo).toFixed(5), county: 'El Paso' }); }
}
writeFileSync(join(OUT, 'summary.tsv'), sum.join('\n') + '\n');
writeFileSync(join(OUT, 'b-towns.txt'), bTowns.join('\n') + '\n');
writeFileSync(join(OUT, 'merge-towns.txt'), mTowns.join('\n') + '\n');
writeFileSync(join(OUT, 'registered.json'), JSON.stringify(reg, null, 1));
const yesAll = raw.filter((x) => x.knock).length;
console.log(`dropped: ${JSON.stringify(drop)}`);
console.log(`kept ${raw.length} houses not ours (${yesAll} owner lives here or local PO box, ${raw.length - yesAll} owner elsewhere); new towns ${bTowns.length}, towns to merge into ${mTowns.length}`);
console.log(sum.join('\n'));

#!/usr/bin/env node
/* Every home, 15 Nov 2026 (EVERY-HOME-2026-11-15.md): turns classify-vm.mjs's cand.tsv into the lists the measuring and the laptop
   build read. Cloud machine; the lists hold owner names (VM / gitignored only).
     <out>/add/<town>-add1115-areas.json   homes joining a town of ours (house, townhome th, mobile home mh), lookup format:
                                           { a, ac, o, la, lo, why, occ, rent (1 = owner elsewhere), k }; build-rounds-data.mjs promotes
                                           them beside the nearest door, as the rented homes were
     <out>/add/<town>-bld1115-areas.json   apartment / condo buildings and mobile home parks near a town of ours: one entry each,
                                           k 'b' + bk (apt | condo | mhp), u (units), ub (unit band), bn (complex name), ow (owners)
     <out>/new/<key>.csv                   a new town's walk list (build-walklist-co.mjs columns, every row YES: its doors' occ and kind
                                           come from marks-<key>.json), registered.json, b-towns.txt
     <out>/marks/<town>.json               { ADDRESS: { occ?, k?, bk?, u?, ub?, bn?, ow? } } for new towns, and for doors of ours the
                                           county codes as a mobile home or townhome (marks-existing.tsv)
     <out>/summary.tsv, <out>/kinds.json   counts per town and per county and kind (no names)
   A new town with fewer than 10 homes goes into its county's "(other)" town. Buildings marked 'new-if' join a new town of their
   county + city only when that town exists; else they are left out (counted).
   Usage: node make-lists-vm.mjs <cls dir> <out dir> [--g3=<group3 targets.json>]                                               */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [CLS, OUT] = process.argv.slice(2);
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
if (!OUT) { console.error('usage: node make-lists-vm.mjs <cls dir> <out dir>'); process.exit(1); }
for (const d of ['add', 'new', 'marks']) mkdirSync(join(OUT, d), { recursive: true });
const L = readFileSync(join(CLS, 'cand.tsv'), 'utf8').split('\n'); const H = L[0].split('\t');
const rows = L.slice(1).filter(Boolean).map((l) => { const r = l.split('\t'); return Object.fromEntries(H.map((k, i) => [k, r[i] ?? ''])); });
const G3 = arg('g3') && existsSync(arg('g3')) ? JSON.parse(readFileSync(arg('g3'), 'utf8')) : [];
const title = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const countyName = (slugC) => title(slugC.replace(/-/g, ' '));

/* new towns: size, then the small ones folded into "<County> (other)" */
const isDoor = (r) => r.kind !== 'b';
const newSize = new Map();
for (const r of rows) if (r.join === 'new' && isDoor(r)) newSize.set(r.town, (newSize.get(r.town) || 0) + 1);
const fold = new Map();
for (const [k, n] of newSize) {
  if (n >= 10 || /-other$/.test(k) || k.startsWith('g3-')) continue;
  const c = rows.find((r) => r.town === k).county; fold.set(k, `g4-${c}-other`);
}
for (const r of rows) if (fold.has(r.town) && (r.join === 'new' || r.join === 'new-if')) r.town = fold.get(r.town);
const newTowns = new Set(rows.filter((r) => r.join === 'new' && isDoor(r)).map((r) => r.town));
for (const r of rows) if (r.join === 'new-if') r.join = newTowns.has(r.town) ? 'new' : 'out';

const occOf = (r) => (r.occ === 'here' || r.occ === 'away' || r.occ === 'unk' ? r.occ : 'away');
const num = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);
function door(r) {
  const d = { a: r.address, ac: num(r.acres), o: r.owner || null, la: +r.lat, lo: +r.lon, why: null, occ: occOf(r) };
  if (d.occ === 'away') d.rent = 1;
  if (r.kind === 'mh' || r.kind === 'th') d.k = r.kind;
  if (r.kind === 'b') {
    d.k = 'b'; d.bk = r.band === 'apt' || r.band === 'condo' || r.band === 'mhp' ? r.band : 'apt';
    if (num(r.units)) d.u = num(r.units);
    if (r.why && /^(9\+|4-8|2-3)$/.test(r.why)) d.ub = r.why;
    if (r.sub && r.sub.length < 60 && !/^\d+$/.test(r.sub)) d.bn = title(r.sub);
    if (num(r.owners) > 1) d.ow = num(r.owners);
    delete d.rent; d.occ = 'away';   /* a building's owner of record is a landlord or the units' many owners: never "lives here" */
  }
  d.why = d.k === 'b' ? (d.bk === 'mhp' ? 'mobile home park' : d.bk === 'condo' ? 'condo building' : 'apartment building')
    : d.k === 'mh' ? 'mobile home' : d.k === 'th' ? 'townhome' : d.occ === 'here' ? 'owner lives here' : d.occ === 'unk' ? 'no mailing address on record' : 'owner lives elsewhere';
  return d;
}

const add = new Map(), bld = new Map(), csv = new Map(), marks = new Map();
const sum = new Map();   /* town -> counts */
const kinds = {};        /* county -> kind/occ -> n */
const tick = (town, county, key) => { const s = sum.get(town) || sum.set(town, { county, join: '', house: 0, th: 0, mh: 0, b: 0, here: 0, away: 0, unk: 0, units: 0 }).get(town); s[key]++; return s; };
for (const r of rows) {
  const K = (kinds[r.county] ||= {}); const kk = r.join === 'out' ? `out-${r.kind}` : `${r.kind}-${r.kind === 'b' ? r.band : occOf(r)}`; K[kk] = (K[kk] || 0) + 1;
  if (r.join === 'out') continue;
  const d = door(r); const s = tick(r.town, r.county, r.kind === 'b' ? 'b' : r.kind); s.join = r.join;
  if (r.kind !== 'b') s[d.occ]++; else s.units += d.u || 0;
  if (r.join === 'add') { const M = r.kind === 'b' ? bld : add; (M.get(r.town) || M.set(r.town, []).get(r.town)).push(d); }
  else {
    (csv.get(r.town) || csv.set(r.town, []).get(r.town)).push({ r, d });
    const m = {}; for (const k of ['occ', 'k', 'bk', 'u', 'ub', 'bn', 'ow']) if (d[k] != null && !(k === 'occ' && d[k] === 'here')) m[k] = d[k];
    if (Object.keys(m).length) (marks.get(r.town) || marks.set(r.town, {}).get(r.town))[d.a.toUpperCase().replace(/\s+/g, ' ').trim()] = m;
  }
}
const built = new Date().toISOString().slice(0, 10);
for (const [t, doors] of add) writeFileSync(join(OUT, 'add', `${t}-add1115-areas.json`), JSON.stringify({ built, areas: [{ name: 'Added 15 Nov 2026', doors }] }));
for (const [t, doors] of bld) writeFileSync(join(OUT, 'add', `${t}-bld1115-areas.json`), JSON.stringify({ built, areas: [{ name: 'Buildings', doors }] }));
writeFileSync(join(OUT, 'add-towns.txt'), [...add.keys()].sort().join('\n') + '\n');
writeFileSync(join(OUT, 'bld-towns.txt'), [...bld.keys()].sort().join('\n') + '\n');

/* new towns: CSV + registration */
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const head = ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon'].join(',');
const reg = [];
for (const [key, list] of [...csv.entries()].sort()) {
  const g3 = G3.find((t) => t.key === key);
  const county = list[0].r.county;
  const label = g3 ? g3.label : /-other$/.test(key) ? `${countyName(county)} County (other)` : title(key.replace(/^g4-/, '').replace(/-/g, ' '));
  const city = label.toUpperCase();
  const seen = new Set(); const lines = [head];
  for (const { r, d } of list) {
    const k = d.a.toUpperCase().replace(/\s+/g, ' ').trim(); if (seen.has(k)) continue; seen.add(k);
    lines.push(['YES', d.a, city, r.zip, (d.ac ?? 0).toFixed(2), r.owner, r.mail, d.why, r.parcel, d.la.toFixed(6), d.lo.toFixed(6)].map(esc).join(','));
  }
  writeFileSync(join(OUT, 'new', `${key}.csv`), lines.join('\n'), 'utf8');
  const la = list.reduce((s, x) => s + x.d.la, 0) / list.length, lo = list.reduce((s, x) => s + x.d.lo, 0) / list.length;
  reg.push({ key, label, lat: +(g3 ? g3.lat : la).toFixed(5), lon: +(g3 ? g3.lon : lo).toFixed(5), county: countyName(county) });
}
writeFileSync(join(OUT, 'new', 'registered.json'), JSON.stringify(reg, null, 1));
writeFileSync(join(OUT, 'b-towns.txt'), reg.map((t) => t.key).join('\n') + (reg.length ? '\n' : ''));

/* marks for doors of ours (the county says mobile home or townhome) */
if (existsSync(join(CLS, 'marks-existing.tsv'))) for (const l of readFileSync(join(CLS, 'marks-existing.tsv'), 'utf8').split('\n').slice(1)) {
  const [town, a, k] = l.split('\t'); if (!town || !k) continue;
  (marks.get(town) || marks.set(town, {}).get(town))[`@${a}`] = { k };   /* '@' + address slug: a door of ours, matched by its id */
}
for (const [t, m] of marks) writeFileSync(join(OUT, 'marks', `${t}.json`), JSON.stringify(m));

const S = [['town', 'county', 'join', 'house', 'townhome', 'mobile', 'buildings', 'units', 'here', 'away', 'unk'].join('\t')];
for (const [t, s] of [...sum.entries()].sort()) S.push([t, s.county, s.join, s.house, s.th, s.mh, s.b, s.units, s.here, s.away, s.unk].join('\t'));
writeFileSync(join(OUT, 'summary.tsv'), S.join('\n') + '\n');
writeFileSync(join(OUT, 'kinds.json'), JSON.stringify(kinds, null, 1));
const T = {}; for (const K of Object.values(kinds)) for (const [k, v] of Object.entries(K)) T[k] = (T[k] || 0) + v;
console.log(`towns of ours getting homes: ${add.size}, getting buildings: ${bld.size}; new towns: ${reg.length}; marks files: ${marks.size}`);
console.log('by kind:', JSON.stringify(T));

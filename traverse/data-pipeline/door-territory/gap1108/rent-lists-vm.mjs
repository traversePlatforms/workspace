#!/usr/bin/env node
/* Rented doors, Groups 1-3 and the El Paso batch (2026-11-08, Matthew: "go ahead and the rented doors, just make sure its obvious which
   are owner lived in and which arent"). The core towns already have their rented homes as office-lookup files (<town>-lookup-areas.json,
   build-lookup.mjs). Groups 1-3 never got them. This writes, on the cloud machine, from the stage A walk lists already there (no pulls):
     <out>/<town>-lookup2-areas.json   the same format as build-lookup.mjs's (one area, doors { a, ac, o, la, lo, why, rent: 1 })
   for every town of ours (or town about to be ours: the ep and g3po batches) that has houses whose owner lives elsewhere.
   Rows come from: Group 1/2 towns' own CSVs in door-territory (every row, "no — post" ones are the absentee houses); Group 3 targets'
   stage A lists (~/run/group3/out, with prep-stageb.mjs's merge rules: Cripple Creek, Idaho Springs, the Teller sweep's places); the El
   Paso batch's lists (~/run/gap1108/ep, new towns and the towns they add to).
   Dropped: a door or office-lookup home of ours within 6 m or the same address within 150 m; rows the g3po batch turns into doors; a
   repeat address in the town; public owners (church, district, city, HOA ...: not homes; landlords' LLCs stay); stacked units (an
   address with a unit number, or 3+ parcels on one point: condo flats in counties that give no land use, Summit and Grand above all).
   build-rounds-data.mjs makes them doors (occ 'away') once gap1108/GO-rented exists; yard v2 read under '<town>-lookup2/<id>'.
   Usage (VM): node rent-lists-vm.mjs <door-territory dir> <group3 dir> <gap1108 dir> <door-points.tsv> <out dir>                       */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [DT, G3, GAP, DOORS, OUT] = process.argv.slice(2);
if (!OUT) { console.error('usage: node rent-lists-vm.mjs <door-territory> <group3> <gap1108> <door-points.tsv> <out>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const metres = (la1, lo1, la2, lo2) => Math.hypot((lo2 - lo1) * 111320 * Math.cos(la1 * Math.PI / 180), (la2 - la1) * 110540);
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}
const CELL = 0.0004, grid = new Map(), live = new Map();   /* live: town -> county */
for (const line of readFileSync(DOORS, 'utf8').split('\n').slice(1)) {
  if (!line) continue; const [kind, county, town, address, la, lo] = line.split('\t');
  if (kind === 'door') live.set(town, county);
  const p = { a: slug(address), la: +la, lo: +lo }; const k = `${Math.floor(p.la / CELL)},${Math.floor(p.lo / CELL)}`;
  (grid.get(k) || grid.set(k, []).get(k)).push(p);
}
const ours = (la, lo, a) => { const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL); for (let di = -4; di <= 4; di++) for (let dj = -5; dj <= 5; dj++) for (const p of grid.get(`${ci + di},${cj + dj}`) || []) { const d = metres(la, lo, p.la, p.lo); if (d <= 6 || (a && p.a === a && d <= 150)) return true; } return false; };
/* towns about to be ours, and the addresses those batches already make doors */
const pending = new Map(), batchAddr = new Set();
for (const b of ['ep', 'g3po']) {
  const d = join(GAP, b); if (!existsSync(d)) continue;
  for (const t of JSON.parse(readFileSync(join(d, 'registered.json'), 'utf8'))) pending.set(t.key, t.county.toLowerCase().replace(/[^a-z]/g, ''));
  for (const f of readdirSync(d).filter((x) => x.endsWith('.csv'))) { const R = parseCsv(readFileSync(join(d, f), 'utf8')); const K = R[0].indexOf('knock'), A = R[0].indexOf('address'); for (const r of R.slice(1)) if (/^YES/.test(r[K])) batchAddr.add(slug(r[A])); }
}
const isTown = (k) => live.has(k) || pending.has(k);

const PUBLIC_OWNER = /\b(CHURCH|MINISTR\w*|DISTRICT|METROPOLITAN|CITY OF|TOWN OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CEMETERY|SANITATION|WATER|UTILIT\w*|HOUSING AUTHORITY)\b/i;
const UNIT = /(#|\b(APT|UNIT|STE|SUITE|BLDG|SPC|SPACE|LOT)\b)\s*\S/i;
const byTown = new Map();   /* town -> [{ src, row, h }] */
const add = (town, h, r, src) => { if (!isTown(town)) return; (byTown.get(town) || byTown.set(town, []).get(town)).push({ h, r, src }); };
/* Group 1 and 2 towns: their own CSVs (every row) */
for (const town of live.keys()) if (/^g[12]-/.test(town) && existsSync(join(DT, `${town}.csv`))) { const R = parseCsv(readFileSync(join(DT, `${town}.csv`), 'utf8')); for (const r of R.slice(1)) add(town, R[0], r, 'g12'); }
/* Group 3 targets' stage A lists, with stage B's merge rules */
const MERGE_WHOLE = { 'g3-cripple-creek': 'cripple-creek', 'g3-idaho-springs': 'idaho-springs' };
const PLACES = existsSync(join(G3, 'merge-places.json')) ? JSON.parse(readFileSync(join(G3, 'merge-places.json'), 'utf8')) : {};
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const placeOf = (la, lo) => Object.keys(PLACES).find((k) => (PLACES[k].rings || []).filter((r) => inRing(lo, la, r)).length % 2 === 1);
for (const t of JSON.parse(readFileSync(join(G3, 'targets.json'), 'utf8'))) {
  const f = join(G3, 'out', `${t.key}.csv`); if (!existsSync(f)) continue;
  const R = parseCsv(readFileSync(f, 'utf8')); const LA = R[0].indexOf('lat'), LO = R[0].indexOf('lon');
  for (const r of R.slice(1)) add(MERGE_WHOLE[t.key] || (t.key === 'g3-divide-rural' && placeOf(+r[LA], +r[LO])) || t.key, R[0], r, 'g3');
}
/* the El Paso batch */
if (existsSync(join(GAP, 'ep'))) for (const f of readdirSync(join(GAP, 'ep')).filter((x) => x.endsWith('.csv'))) {
  const R = parseCsv(readFileSync(join(GAP, 'ep', f), 'utf8')); const town = f.replace(/\.csv$/, '').replace(/^merge-/, '');
  for (const r of R.slice(1)) add(town, R[0], r, 'ep');
}

const sum = [['town', 'county', 'rows_owner_elsewhere', 'ours_already', 'public_owner', 'stacked', 'kept'].join('\t')];
let total = 0; const towns = [];
for (const [town, list] of [...byTown.entries()].sort()) {
  /* stacked units: 3+ rows on one point */
  const pt = new Map(); for (const { h, r } of list) { const k = `${(+r[h.indexOf('lat')]).toFixed(5)},${(+r[h.indexOf('lon')]).toFixed(5)}`; pt.set(k, (pt.get(k) || 0) + 1); }
  let n = 0, dup = 0, pub = 0, stack = 0; const seen = new Set(), doors = [];
  for (const { h, r } of list) {
    const ix = (k) => h.indexOf(k);
    if (/^YES/.test(r[ix('knock')])) continue;
    n++;
    const a = (r[ix('address')] || '').trim(), la = +r[ix('lat')], lo = +r[ix('lon')], s = slug(a);
    if (!a || !(Math.abs(la) > 0) || seen.has(s)) { dup++; continue; }
    if (PUBLIC_OWNER.test(r[ix('owner')] || '')) { pub++; continue; }
    if (UNIT.test(a) || (pt.get(`${la.toFixed(5)},${lo.toFixed(5)}`) || 0) >= 3) { stack++; continue; }
    if (batchAddr.has(s) || ours(la, lo, s)) { dup++; continue; }
    seen.add(s);
    doors.push({ a, ac: Number(r[ix('acres')]) || null, o: (r[ix('owner')] || '').trim() || null, la, lo, why: (r[ix('why')] || '').trim() || null, rent: 1 });
  }
  sum.push([town, live.get(town) || pending.get(town) || '', n, dup, pub, stack, doors.length].join('\t'));
  if (!doors.length) continue;
  writeFileSync(join(OUT, `${town}-lookup2-areas.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), areas: [{ name: 'Owner lives elsewhere', doors }] }));
  towns.push(town); total += doors.length;
}
writeFileSync(join(OUT, 'summary.tsv'), sum.join('\n') + '\n');
writeFileSync(join(OUT, 'towns.txt'), towns.join('\n') + '\n');
console.log(`rented homes: ${total} in ${towns.length} towns`);

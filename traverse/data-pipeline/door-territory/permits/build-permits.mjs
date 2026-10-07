/* permit-<town>.json for the app (2026-10-07): each door's latest re-roof permit and whether it has a solar permit, from
 * pprbd-permits.json (Pikes Peak Regional Building: El Paso towns, matched on the parcel number through the town lists) and
 * douglas-permits.json (Douglas County's own permits: Highlands Ranch, Sedalia, Franktown, Larkspur, matched on the street
 * address). Castle Rock, Parker, Castle Pines and the Teller and metro towns are not covered yet: they permit for themselves.
 *   doors: { id: { r: 'YYYY-MM' latest re-roof, m: roof material on that permit (Douglas), s: 'YYYY-MM' solar permit,
 *                  so: 'YYYY-MM' solar removed after that } }
 * A solar "remove and replace" counts as both: panels came off for a re-roof and went back on.
 *   node build-permits.mjs */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normAddr } from './fetch-douglas.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds');
const EL_PASO = ['monument', 'palmer-lake', 'black-forest', 'cs-northeast', 'cs-southeast', 'cs-northwest', 'cs-southwest', 'security-widefield', 'fountain'];
const DOUGLAS = ['highlands-ranch', 'sedalia', 'franktown', 'larkspur'];
const SRC = { pprbd: 'Pikes Peak Regional Building Department', douglas: 'Douglas County building division' };

function parseCSV(s) {
  const rows = []; let row = [], f = '', inq = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (inq) { if (ch === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
/* key -> the permits for it, oldest first */
function index(file, keyOf) {
  const m = new Map(); if (!existsSync(join(HERE, file))) return { m, meta: null };
  const j = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  for (const p of Object.values(j.permits)) { const k = keyOf(p[0]); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  for (const v of m.values()) v.sort((a, b) => a[1].localeCompare(b[1]));
  return { m, meta: { through: j.through, since: j.since } };
}
function summary(list) {
  const o = {};
  for (const [, day, k, mat] of list) {
    const ym = day.slice(0, 7);
    if (k === 'roof' || k === 'rr') { o.r = ym; if (mat) o.m = mat; else if (k === 'rr') delete o.m; }
    if (k === 'solar' || k === 'rr') { if (!o.s) o.s = ym; delete o.so; }
    if (k === 'off' && o.s) o.so = ym;
  }
  return Object.keys(o).length ? o : null;
}

const pp = index('pprbd-permits.json', (p) => p), dg = index('douglas-permits.json', (p) => p);
let tot = 0, hit = 0; const cover = {};   /* permit-index.json: which towns are covered, by whom, since and through when */
for (const town of [...EL_PASO, ...DOUGLAS]) {
  const doorF = join(DATA, `${town}.json`), csvF = join(DT, `${town}.csv`);
  if (!existsSync(doorF)) { console.log(`  ${town}: no door file`); continue; }
  const isEP = EL_PASO.includes(town), idx = isEP ? pp : dg;
  if (!idx.meta) { console.log(`  ${town}: no permits pulled`); continue; }
  let parcelOf = null;
  if (isEP) {
    if (!existsSync(csvF)) { console.log(`  ${town}: no list`); continue; }
    const rows = parseCSV(readFileSync(csvF, 'utf8')), h = rows[0], iA = h.indexOf('address'), iP = h.indexOf('parcel');
    parcelOf = new Map(); for (const r of rows.slice(1)) if (r[iA] && r[iP]) parcelOf.set(r[iA].trim().toUpperCase(), r[iP].trim());
  }
  const d = JSON.parse(readFileSync(doorF, 'utf8')), doors = {}; let n = 0, k = 0, nr = 0, ns = 0;
  for (const a of d.areas) for (const x of a.doors) {
    n++;
    const key = isEP ? parcelOf.get(String(x.address).trim().toUpperCase()) : normAddr(x.address);
    const list = key && idx.m.get(key); if (!list) continue;
    const s = summary(list); if (!s) continue;
    doors[x.id] = s; k++; if (s.r) nr++; if (s.s && !s.so) ns++;
  }
  writeFileSync(join(DATA, `permit-${town}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: isEP ? SRC.pprbd : SRC.douglas, since: idx.meta.since, through: idx.meta.through, doors }));
  console.log(`  permit-${town}.json: ${k} of ${n} doors have a permit (${nr} re-roofed since ${idx.meta.since.slice(0, 4)}, ${ns} with solar)`);
  cover[town] = { src: isEP ? SRC.pprbd : SRC.douglas, since: idx.meta.since, through: idx.meta.through };
  tot += n; hit += k;
}
writeFileSync(join(DATA, 'permit-index.json'), JSON.stringify(cover));
console.log(`${hit} of ${tot} doors in the covered towns have a re-roof or solar permit`);

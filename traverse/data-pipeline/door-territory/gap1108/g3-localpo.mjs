#!/usr/bin/env node
/* Gap plan 2026-11-08: Group 3's "local PO box = lives here" rule (Matthew, 29 Oct) missed most mountain towns. Stage B tested the PO box
   against the house's own town or ZIP, but in many counties the walk lists carry no situs ZIP and a made-up city ("EAGLE AREA", "NA",
   "HUERFANO COUNTY"), so the test failed: Eagle 0 local PO boxes of 6,987 PO-box owners, Gunnison 0 of 4,049, Teller 0 of 2,225.
   This re-reads Group 3's stage A walk lists (no new pulls) with a test that does not need the situs city:
     a "no — post" row whose owner mails to a PO box in Colorado, in a town that is local to the county: one of the county's Group 3
     place names, or a town that the county's own "owner lives here" owners mail from.
   Rows that are doors of ours already (a door within 6 m, or the same address within 150 m) are dropped. What is left is written per
   Group 3 target: merge-<key>.csv when the target is one of our live towns (added to it, existing doors untouched), <key>.csv when it
   is not (a new town; registered.json), plus limited-<key>.json for rows with no owner name (Eagle, Summit: lim "noname").
   Huerfano is skipped and reported: its property addresses are not usable as addresses (e.g. "1ST ST W # 12345"), so it needs the
   address-point adapter (group3/build-walklist-ap.mjs), not this.
   Usage (on the VM): node g3-localpo.mjs <group3 dir> <door-points.tsv> <out dir>                                                      */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [G3, DOORS, OUT] = process.argv.slice(2);
if (!OUT) { console.error('usage: node g3-localpo.mjs <group3 dir> <door-points.tsv> <out dir>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const slug = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
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
const CELL = 0.0004, grid = new Map(), live = new Set();
for (const line of readFileSync(DOORS, 'utf8').split('\n').slice(1)) {
  if (!line) continue; const [kind, , town, address, la, lo] = line.split('\t');
  if (kind !== 'door') continue; live.add(town);
  const p = { a: slug(address), la: +la, lo: +lo }; const k = `${Math.floor(p.la / CELL)},${Math.floor(p.lo / CELL)}`;
  (grid.get(k) || grid.set(k, []).get(k)).push(p);
}
const ours = (la, lo, a) => { const ci = Math.floor(la / CELL), cj = Math.floor(lo / CELL); for (let di = -4; di <= 4; di++) for (let dj = -5; dj <= 5; dj++) for (const p of grid.get(`${ci + di},${cj + dj}`) || []) { const d = metres(la, lo, p.la, p.lo); if (d <= 6 || (a && p.a === a && d <= 150)) return true; } return false; };

/* mailing city and state from "street, city, state, zip" (empty parts were dropped when the CSV was written) */
function cityState(m) { const p = m.split(',').map((s) => s.trim()); const si = p.findIndex((s, i) => i > 0 && /^[A-Z]{2}$/.test(s)); return si > 0 ? [p[si - 1].toUpperCase(), p[si]] : ['', '']; }
const PO = /\bP\s*O\s*BOX\b|\bPOBOX\b/i;
/* Group 3 stage B rule 5 (prep-stageb.mjs): these targets' rows join our towns, never a second town */
const MERGE_WHOLE = { 'g3-cripple-creek': 'cripple-creek', 'g3-idaho-springs': 'idaho-springs' };
const PLACES = existsSync(join(G3, 'merge-places.json')) ? JSON.parse(readFileSync(join(G3, 'merge-places.json'), 'utf8')) : {};
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const placeOf = (la, lo) => Object.keys(PLACES).find((k) => (PLACES[k].rings || []).filter((r) => inRing(lo, la, r)).length % 2 === 1);
const destOf = (key, la, lo) => MERGE_WHOLE[key] || (key === 'g3-divide-rural' && placeOf(la, lo)) || key;

const targets = JSON.parse(readFileSync(join(G3, 'targets.json'), 'utf8'));
const byCounty = {};
for (const t of targets) { const f = join(G3, 'out', `${t.key}.csv`); if (!existsSync(f)) continue; (byCounty[t.county] ||= []).push({ t, rows: parseCsv(readFileSync(f, 'utf8')) }); }
const sum = [['key', 'county', 'live', 'rows', 'yes', 'po_box_rows', 'local_po_new', 'already_ours', 'added'].join('\t')];
const bTowns = [], mTowns = [], reg = []; let total = 0;
for (const [county, list] of Object.entries(byCounty)) {
  if (county === 'Huerfano') { console.log('Huerfano skipped: property addresses unusable (needs the address-point adapter)'); continue; }
  const local = new Set();
  for (const { t, rows } of list) {
    local.add(letters(t.label)); local.add(letters(t.key.replace(/^g3-/, '').replace(/-rural$/, '')));
    const h = rows[0]; const K = h.indexOf('knock'), M = h.indexOf('owner_mailing');
    for (const r of rows.slice(1)) if (/^YES/.test(r[K])) { const [c, s] = cityState(r[M]); if (s === 'CO' && c) local.add(letters(c)); }
  }
  for (const { t, rows } of list) {
    const h = rows[0]; const ix = (k) => h.indexOf(k);
    const [K, A, M, W, LA, LO, O] = ['knock', 'address', 'owner_mailing', 'why', 'lat', 'lon', 'owner'].map(ix);
    let yes = 0, po = 0, lp = 0, dup = 0; const keep = []; const seen = new Set();
    for (const r of rows.slice(1)) {
      if (/^YES/.test(r[K])) { yes++; continue; }
      if (!PO.test(r[M] || '')) continue; po++;
      const [c, s] = cityState(r[M]); if (s !== 'CO' || !local.has(letters(c))) continue; lp++;
      const a = slug(r[A]); if (seen.has(a)) continue; seen.add(a);
      if (ours(+r[LA], +r[LO], a)) { dup++; continue; }
      const out = r.slice(); out[K] = 'YES'; out[W] = "owner's PO box is in town"; out.dest = destOf(t.key, +r[LA], +r[LO]); keep.push(out);
    }
    sum.push([t.key, county, live.has(destOf(t.key, 0, 0)) ? 'live' : 'new', rows.length - 1, yes, po, lp, dup, keep.length].join('\t'));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    for (const dest of [...new Set(keep.map((r) => r.dest))]) {
      const mine = keep.filter((r) => r.dest === dest); const isLive = live.has(dest);
      const name = isLive ? `merge-${dest}` : dest;
      writeFileSync(join(OUT, `${name}.csv`), [h.join(','), ...mine.map((r) => r.map(esc).join(','))].join('\n'), 'utf8');
      const lim = Object.fromEntries(mine.filter((r) => !(r[O] || '').trim()).map((r) => [r[A], 'no-owner-name']));
      if (Object.keys(lim).length) writeFileSync(join(OUT, `limited-${dest}.json`), JSON.stringify(lim));
      if (isLive) mTowns.push(dest); else { bTowns.push(dest); reg.push({ key: dest, label: t.label, lat: t.lat, lon: t.lon, county }); }
      total += mine.length;
    }
  }
}
writeFileSync(join(OUT, 'summary.tsv'), sum.join('\n') + '\n');
writeFileSync(join(OUT, 'b-towns.txt'), bTowns.join('\n') + (bTowns.length ? '\n' : ''));
writeFileSync(join(OUT, 'merge-towns.txt'), mTowns.join('\n') + (mTowns.length ? '\n' : ''));
writeFileSync(join(OUT, 'registered.json'), JSON.stringify(reg, null, 1));
console.log(`local PO box doors to add: ${total} (into ${mTowns.length} live towns, ${bTowns.length} new towns)`);

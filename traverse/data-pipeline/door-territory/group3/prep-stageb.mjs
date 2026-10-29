/* Group 3 stage B, step 1 on the cloud machine (2026-10-29; Matthew's decisions of 29 Oct). Ready to run, NOT started: stage B needs
   Matthew's go after he has seen the counts (out/summary.tsv, out/summary-3b.tsv). Run by stageb-vm.sh, or alone with --dry for counts.
   From targets.json (Group 3, 173 targets with the Teller sweep) and targets-3b.json (Group 3b, address points) and out/<key>.csv:

   The rules (GROUP3-PLAN-2026-10-29.md, "Stage B rules"):
     1. Local PO box = lives here (Matthew: "Go ahead and do your plan for Ignacio"): a "no — post" row whose owner mails to a PO box
        in the house's own ZIP or town (summary-g3.mjs localPoBox, the same test the stage A count used) becomes "YES", why "owner's PO box
        is in town".
     2. No owner name (Eagle puts one placeholder on every row, Summit leaves it blank; Matthew: include them): the row stays, owner blank,
        limited "no-owner-name". The owner-lives-here test used the mailing address, which both counties do give.
     3. Group 3b rows keep their own "limited": "no-owner" (address point only: no owner, no lot size, no occupancy test) or
        "no-occupancy" (Sedgwick: owner on record, no mailing address). They are "YES" rows (Matthew: "even if we don't have enough data
        on the home itself ... by having it in the system people can input data that they have").
     4. Ours already: a row whose address id (build-rounds-data's slug) is a door of ours within 150 m is dropped (build-rounds-data's
        own same-house rule; without it the build could hand a live door, and its marks, to the new town). Our doors: every town file
        in <rounds> (the cloud copy of app/data/rounds).
     5. Merges into our towns, not second towns: g3-cripple-creek -> cripple-creek, g3-idaho-springs -> idaho-springs, and the Teller
        sweep g3-divide-rural: rows inside Woodland Park city -> woodland-park, inside Florissant CDP -> florissant, inside Divide CDP
        -> divide (merge-places.json, the Census shapes); the rest of the sweep is its own town, "Teller (rural)". A merged town's new
        rows go to b/merge-<town>.csv; the laptop's finisher appends them to the town as new neighbourhoods (merge-into-town.mjs),
        never regrouping the doors already there.
     6. A target with no "YES" row left is not registered.
   Writes (in ~/run/group3/b/): <key>.csv per new town, merge-<town>.csv, limited-<key>.json ({ address: reason } for the app's
   "Limited data" label), registered.json ({ key, label, lat, lon, county }), b-towns.txt, merge-towns.txt, counts.tsv. With --dry, only
   counts.tsv and the printout. The town laser keys are added to <DT>/tree-zones/town-surveys-extra.json (county slug: Teller has a
   survey, the rest fall back to the canopy map as Mesa did), and a copy of registered.json goes to <DT>/group3/.
     node prep-stageb.mjs <door-territory dir> <rounds dir> [--dry]                                                               */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRow, localPoBox } from './summary-g3.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), [, , DT, RD] = process.argv, DRY = process.argv.includes('--dry');
if (!DT || !RD || !existsSync(RD)) throw new Error('usage: node prep-stageb.mjs <door-territory dir> <rounds dir> [--dry]');
const B = join(HERE, 'b'); mkdirSync(B, { recursive: true });
const MERGE_WHOLE = { 'g3-cripple-creek': 'cripple-creek', 'g3-idaho-springs': 'idaho-springs' };
const MERGE_PLACES = { 'g3-divide-rural': JSON.parse(readFileSync(join(HERE, 'merge-places.json'), 'utf8')) };
const LABEL = { 'g3-divide-rural': 'Teller (rural)' };
const SAME_KM = 0.15;
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111, (lo1 - lo2) * 111 * Math.cos((la1 * Math.PI) / 180));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inShape = (s, x, y) => x >= s.bb[0] && x <= s.bb[2] && y >= s.bb[1] && y <= s.bb[3] && s.rings.filter((r) => inRing(x, y, r)).length % 2 === 1;

/* our doors by address id: every town in the index, or (the cloud copy has no index, only door files, some slim: id, lat, lon) every
   file that is not a side file; ids are build-rounds-data's (address slug, 'x' added on a repeat) */
const ours = new Map();
const SIDE = /^(hail|hailrep|wind|roof|year|naip|material|outline|photo|solar|permit|census|nri|pest|security|lawnmask|com|best|regions|owner|mail)-|^(index|company|training|shared-towns)\.json$/;
const townFiles = existsSync(join(RD, 'index.json')) ? (JSON.parse(readFileSync(join(RD, 'index.json'), 'utf8')).regions || []).map((r) => r.key + '.json')
  : readdirSync(RD).filter((f) => f.endsWith('.json') && !SIDE.test(f) && !f.startsWith('g3-'));
for (const tf of townFiles) {
  const f = join(RD, tf); if (!existsSync(f)) continue;
  let j; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  if (!Array.isArray(j.areas)) continue;
  for (const a of j.areas) for (const d of a.doors || []) {
    if (typeof d.lat !== 'number' || !d.id) continue; const id = String(d.id).replace(/x+$/, '');
    (ours.get(id) || ours.set(id, []).get(id)).push([d.lat, d.lon]);
  }
}
const isOurs = (addr, la, lo) => (ours.get(slug(addr)) || []).some(([a, b]) => km(a, b, la, lo) < SAME_KM);

const T = [...JSON.parse(readFileSync(join(HERE, 'targets.json'), 'utf8')), ...(existsSync(join(HERE, 'targets-3b.json')) ? JSON.parse(readFileSync(join(HERE, 'targets-3b.json'), 'utf8')) : [])];
const counts = [['key', 'county', 'into', 'rows', 'yes_stage_a', 'po_box_added', 'no_owner_name', 'no_owner', 'no_occupancy', 'ours_150m', 'doors'].join('\t')];
const reg = [], merges = new Map();   /* town -> rows */
const writeCsv = (f, head, rows) => writeFileSync(f, [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n');
let H = null;
for (const t of T) {
  const f = join(HERE, 'out', t.key + '.csv'); if (!existsSync(f)) { console.log('no door list:', t.key); continue; }
  const ls = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean), h = parseRow(ls[0]);
  const I = (k) => h.indexOf(k);
  if (I('limited') < 0) h.push('limited');
  if (!H) H = h.slice();
  const c = { yes: 0, po: 0, noName: 0, noOwner: 0, noOcc: 0, ours: 0 };
  const keep = new Map();   /* town -> rows */
  for (const l of ls.slice(1)) {
    const r = parseRow(l); while (r.length < h.length) r.push('');
    const get = (k) => r[h.indexOf(k)], set = (k, v) => { r[h.indexOf(k)] = v; };
    if (get('knock') === 'YES') c.yes++;
    else if (localPoBox(get)) { set('knock', 'YES'); set('why', "owner's PO box is in town"); c.po++; }
    else continue;
    if (!get('limited') && !String(get('owner') || '').trim()) set('limited', 'no-owner-name');
    const lim = get('limited'); if (lim === 'no-owner-name') c.noName++; else if (lim === 'no-owner') c.noOwner++; else if (lim === 'no-occupancy') c.noOcc++;
    const la = +get('lat'), lo = +get('lon');
    if (isOurs(get('address'), la, lo)) { c.ours++; continue; }
    let into = MERGE_WHOLE[t.key] || t.key;
    if (MERGE_PLACES[t.key]) for (const [town, s] of Object.entries(MERGE_PLACES[t.key])) if (inShape(s, lo, la)) { into = town; break; }
    (keep.get(into) || keep.set(into, []).get(into)).push(H.map((k) => r[h.indexOf(k)]));
  }
  for (const [into, rows] of keep) {
    counts.push([t.key, t.county, into === t.key ? '' : into, ls.length - 1, c.yes, c.po, c.noName, c.noOwner, c.noOcc, c.ours, rows.length].join('\t'));
    if (into !== t.key) { (merges.get(into) || merges.set(into, []).get(into)).push(...rows); continue; }
    reg.push({ key: t.key, label: LABEL[t.key] || t.label, lat: t.lat, lon: t.lon, county: t.county, rows });
  }
  if (!keep.size) counts.push([t.key, t.county, '', ls.length - 1, c.yes, c.po, c.noName, c.noOwner, c.noOcc, c.ours, 0].join('\t'));
}
writeFileSync(join(B, 'counts.tsv'), counts.join('\n') + '\n');
const tot = (i) => counts.slice(1).reduce((s, l) => s + (+l.split('\t')[i] || 0), 0);
console.log(`stage B rules: ${reg.length} new towns (${reg.reduce((s, t) => s + t.rows.length, 0)} doors) + ${[...merges.values()].reduce((s, r) => s + r.length, 0)} doors merged into ${[...merges.keys()].join(', ') || 'none'}`);
console.log(`  owner-lives-here rows in stage A ${tot(4)}; local PO boxes added ${tot(5)}; no owner name ${tot(6)}; no owner (3b) ${tot(7)}; occupancy unknown (3b) ${tot(8)}; dropped as doors of ours (same address within 150 m) ${tot(9)}`);
if (DRY) { console.log('dry run: counts.tsv only'); process.exit(0); }
const lim = (rows) => Object.fromEntries(rows.filter((r) => r[H.indexOf('limited')]).map((r) => [r[H.indexOf('address')], r[H.indexOf('limited')]]));
for (const t of reg) { writeCsv(join(B, t.key + '.csv'), H, t.rows); const L = lim(t.rows); if (Object.keys(L).length) writeFileSync(join(B, `limited-${t.key}.json`), JSON.stringify(L)); }
for (const [town, rows] of merges) { writeCsv(join(B, `merge-${town}.csv`), H, rows); const L = lim(rows); if (Object.keys(L).length) writeFileSync(join(B, `limited-${town}.json`), JSON.stringify(L)); }
const regOut = reg.map(({ rows, ...t }) => t);
writeFileSync(join(B, 'registered.json'), JSON.stringify(regOut, null, 1));
writeFileSync(join(B, 'b-towns.txt'), regOut.map((t) => t.key).join('\n') + '\n');
writeFileSync(join(B, 'merge-towns.txt'), [...merges.keys()].join('\n') + '\n');
mkdirSync(join(DT, 'group3'), { recursive: true });
writeFileSync(join(DT, 'group3', 'registered.json'), JSON.stringify(regOut, null, 1));
const ex = join(DT, 'tree-zones', 'town-surveys-extra.json'), S = existsSync(ex) ? JSON.parse(readFileSync(ex, 'utf8')) : {};
const before = Object.keys(S).length;
for (const t of regOut) if (!(t.key in S)) S[t.key] = t.county.toLowerCase().replace(/[^a-z]/g, '');
writeFileSync(ex, JSON.stringify(S));
console.log(`written to ${B}; laser keys: ${before} kept + ${Object.keys(S).length - before} added`);

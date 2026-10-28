/* Group 1 re-clip (2026-10-28, Matthew: "Go ahead and re-run the group 1 de-dup with the correct method").

   clip-group1.mjs called two rows the same house when their parcel centres were under 20 m apart. On 0.15-acre lots (about 18 m
   wide) that dropped every other house on a street, and inside one pull it dropped condo and townhome units that share a point.
   This re-clips every Group 1 pull from its raw file with the method of group2/clip-group2.mjs:
     - the same house in an earlier Group 1 target, or twice in one pull, is the same PARCEL NUMBER (the address + city when a row has
       no parcel number), an exact match;
     - a door of ours from before Group 1 (door-points.json, no parcel numbers) still goes by distance, but within 5 m: those doors come
       from the same statewide parcel layer and the same centroid sum, so the same parcel lands on the same point;
     - ⚑ added here (found in the first re-clip run): that is not always so. Evergreen's and Golden's doors were pulled earlier and sit
       up to ~20 m from the same parcel in the Group 1 pull (31 Evergreen doors came back as "new" in Central Jefferson). So a row whose
       address is a door of ours from before Group 1 (--ours-doors=<app/data/rounds>, every town file but g1-) within 150 m is ours too:
       build-rounds-data's own same-house rule (same address id within 150 m). Without it, build-rounds-data would hand such a door to
       whichever town's centre is nearer, which can take a live door, and its marks, out of an established town. Also ours: a row
       whose parcel number is an owner-lives-here row in one of our town CSVs (--ours-csv) whose address is a door of ours.
   Targets run in targets.json order, as the first clip did, so a rural sweep never repeats a place.

   Berthoud: the first pull took only its Weld side (66 rows). Its Larimer side was pulled as g2-berthoud in the Group 2 run; with
   --merge=g1-berthoud:<g2-berthoud.csv> those rows are added to g1-berthoud (same parcel-number rule, and 5 m against our doors).

   Checks printed per target (nothing is dropped by them): kept rows that sit within 20 m of a door of ours (what the old rule would
   have called a duplicate of ours), and kept owner-lives-here rows whose parcel number is already an owner-lives-here row in one of our
   own town CSVs (--ours-csv=<dir>: every CSV there except the g1- and g2- ones). The second should be about zero if 5 m is right.

     node reclip-group1.mjs --raw=<dir of g1-*.csv raw pulls> --out=<dir> [--merge=g1-berthoud:<csv>] --ours-doors=<app/data/rounds> [--ours-csv=<dir>]
   Writes <out>/<key>.csv (walk-list layout) and <out>/summary.tsv.                                                                   */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || null;
const RAW = arg('raw'), OUT = arg('out'), MERGE = arg('merge'), OURS_CSV = arg('ours-csv'), OURS_DOORS = arg('ours-doors');
if (!RAW || !OUT) { console.error('usage: --raw=<dir> --out=<dir> [--merge=key:csv] [--ours-csv=dir]'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const NEAR_M = 5, OLD_M = 20;

const parseRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const h = l[i]; if (q) { if (h === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (h === '"') q = false; else c += h; } else if (h === '"') q = true; else if (h === ',') { o.push(c); c = ''; } else c += h; } o.push(c); return o; };
const readCsv = (p) => { const ls = readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean); return { head: ls[0], h: parseRow(ls[0]), rows: ls.slice(1) }; };
const idOf = (r, h) => { const p = (r[h.indexOf('parcel')] || '').trim(); return p ? 'p:' + p : 'a:' + (r[h.indexOf('address')] || '').trim().toUpperCase() + '|' + (r[h.indexOf('city')] || '').trim().toUpperCase(); };
const yes = (l) => l.startsWith('"YES"');

/* our doors from before Group 1, by distance */
const cell = (la, lo) => `${Math.round(la * 4000)},${Math.round(lo * 4000)}`;   /* ~28 m cells; neighbours checked */
const ours = new Map();
for (const [la, lo] of JSON.parse(readFileSync(join(HERE, 'door-points.json'), 'utf8'))) { const k = cell(la, lo); (ours.get(k) || ours.set(k, []).get(k)).push([la, lo]); }
const nearOurs = (la, lo, m) => { const [a, b] = cell(la, lo).split(',').map(Number); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [x, y] of ours.get(`${a + i},${b + j}`) || []) if (Math.hypot((x - la) * 111000, (y - lo) * 111000 * Math.cos(la * Math.PI / 180)) < m) return true; return false; };

/* our doors from before Group 1, by address within 150 m (build-rounds-data's slug and SAME_KM) */
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const doorAt = new Map();
if (OURS_DOORS) for (const r of JSON.parse(readFileSync(join(OURS_DOORS, 'index.json'), 'utf8')).regions) {
  if (r.key.startsWith('g1-') || r.metro || r.group === 'dfw') continue;
  let j; try { j = JSON.parse(readFileSync(join(OURS_DOORS, r.key + '.json'), 'utf8')); } catch { continue; }
  for (const a of j.areas) for (const d of a.doors) if (typeof d.lat === 'number') { const k = slug(String(d.address)); (doorAt.get(k) || doorAt.set(k, []).get(k)).push([d.lat, d.lon]); }
}
/* owner-lives-here parcel numbers in our own town CSVs (check), and those whose row's address is a door of ours (a rule: the same
   parcel number AND a live door at that parcel's address is the same house, however far apart the two pulls put its point; seen at
   335 Lee Hill Dr, Boulder, 210 m apart) */
const ourParcels = new Set(), ourParcelDoor = new Set();
if (OURS_CSV) for (const f of readdirSync(OURS_CSV).filter((f) => f.endsWith('.csv') && !/^g[12]-/.test(f))) {
  const { h, rows } = readCsv(join(OURS_CSV, f)); const P = h.indexOf('parcel'), A = h.indexOf('address'); if (P < 0) continue;
  for (const l of rows) if (yes(l)) { const r = parseRow(l), p = (r[P] || '').trim(); if (!p) continue; ourParcels.add(p); if (doorAt.has(slug(r[A] || ''))) ourParcelDoor.add(p); }
}
const sameAddrOurs = (r, h, la, lo) => ourParcelDoor.has((r[h.indexOf('parcel')] || '').trim())
  || (doorAt.get(slug(r[h.indexOf('address')] || '')) || []).some(([x, y]) => Math.hypot((x - la) * 111, (y - lo) * 111 * Math.cos(la * Math.PI / 180)) < 0.15);

const targets = JSON.parse(readFileSync(join(HERE, 'targets.json'), 'utf8'));
const [mKey, mCsv] = MERGE ? [MERGE.slice(0, MERGE.indexOf(':')), MERGE.slice(MERGE.indexOf(':') + 1)] : [null, null];
const taken = new Set(), summary = [['key', 'census', 'pulled', 'outside', 'dup_ours_5m', 'dup_ours_address', 'dup_g1', 'kept', 'kept_yes', 'merged_rows', 'merged_yes', 'check_yes_within20m_of_ours', 'check_yes_parcel_in_our_csvs'].join('\t')];
for (const t of targets) {
  const rawP = join(RAW, t.key + '.csv'); if (!existsSync(rawP)) continue;
  const pieces = JSON.parse(readFileSync(join(HERE, `pieces-${t.key}.json`), 'utf8'));
  const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const inside = (x, y) => pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && p.rings.filter((r) => inRing(x, y, r)).length % 2 === 1);
  const { head, h, rows } = readCsv(rawP); const LA = h.indexOf('lat'), LO = h.indexOf('lon');
  const keep = [head]; let outside = 0, dupOurs = 0, dupAddr = 0, dupG1 = 0, near20 = 0, inCsv = 0, mRows = 0, mYes = 0;
  const take = (l, r, la, lo, id) => { keep.push(l); taken.add(id); if (yes(l)) { if (nearOurs(la, lo, OLD_M)) near20++; const p = (r[h.indexOf('parcel')] || '').trim(); if (p && ourParcels.has(p)) inCsv++; } };
  for (const l of rows) {
    const r = parseRow(l), la = +r[LA], lo = +r[LO], id = idOf(r, h);
    if (!inside(lo, la)) { outside++; continue; }
    if (taken.has(id)) { dupG1++; continue; }
    if (nearOurs(la, lo, NEAR_M)) { dupOurs++; continue; }
    if (sameAddrOurs(r, h, la, lo)) { dupAddr++; continue; }
    take(l, r, la, lo, id);
  }
  if (t.key === mKey) {   /* the other county's side of the same town, already clipped to its own boundary by the Group 2 run */
    const m = readCsv(mCsv); if (m.head !== head) throw new Error('merge file has a different header');
    for (const l of m.rows) { const r = parseRow(l), la = +r[LA], lo = +r[LO], id = idOf(r, h); if (taken.has(id) || nearOurs(la, lo, NEAR_M) || sameAddrOurs(r, h, la, lo)) continue; take(l, r, la, lo, id); mRows++; if (yes(l)) mYes++; }
  }
  writeFileSync(join(OUT, `${t.key}.csv`), keep.join('\n') + '\n');
  const kYes = keep.slice(1).filter(yes).length;
  summary.push([t.key, t.census, rows.length, outside, dupOurs, dupAddr, dupG1, keep.length - 1, kYes, mRows, mYes, near20, inCsv].join('\t'));
  console.log(`${t.key}: ${keep.length - 1} doors, ${kYes} owner lives here (pulled ${rows.length}, outside ${outside}, ours ${dupOurs} + ${dupAddr} by address, earlier Group 1 ${dupG1}${mRows ? `, merged ${mRows} from ${mCsv.split(/[\\/]/).pop()}` : ''}) | checks: ${near20} within 20 m of ours, ${inCsv} parcel in our CSVs`);
}
writeFileSync(join(OUT, 'summary.tsv'), summary.join('\n') + '\n');

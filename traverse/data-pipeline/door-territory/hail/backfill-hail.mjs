/* Hail history backfill for the towns that have none (2026-10-29, Matthew: hail history for every town that lacks it).
 * See ../BACKFILL-HAIL-2026-10-29.md. The same radar source and rules as build-hail.mjs (MRMS MESH 24-hour maximum, 0.75 in kept
 * per door, the 3 x 3 squares round the house, the keep rule in ../storm-keep.mjs), with two changes for a statewide set:
 *   - the day files cover the whole state (HAIL_BOX), so towns added later (Group 3) need no second download;
 *   - the build looks up doors by grid square instead of testing every door against every day (a million doors x 1,300 days).
 *
 *   node backfill-hail.mjs stage <dir>      (laptop) door points with no owners: <dir>/index.json + <dir>/<town>.json
 *                                           ({ key, label, areas: [{ name, doors: [{ id, lat, lon }] }] }), for every town in
 *                                           Roofing's index (editions/dist/traverse-data/rounds/index.json)
 *   ROUNDS_DATA=<dir> HAIL_DAYS=<days> node backfill-hail.mjs build <out> [through]
 *                                           (cloud machine) hail-<town>.json for every town, in build-hail.mjs's format, and
 *                                           hail-storms-backfill.json (hail-storms.json's shape, every town) into <out>;
 *                                           days after [through] are left out (the live storm job's own "through")
 * Fetch first with build-hail.mjs: ROUNDS_DATA=<dir> HAIL_DAYS=<days> HAIL_BOX=36.95,41.05,-109.1,-102 node build-hail.mjs fetch ...
 * Nothing here touches the live hail-storms.json: merge-storms.py adds the new towns to it on the server, under the storm job's lock. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutoffs, keepHailDay } from '../storm-keep.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const MIN_STORE = 19.05, BIG = 25.4;
const [cmd, a1, a2] = process.argv.slice(2);

if (cmd === 'stage') {
  const out = a1; if (!out) throw new Error('stage <dir>');
  mkdirSync(out, { recursive: true });
  const src = join(REPO, 'traverse', 'app', 'data', 'rounds');
  const idx = JSON.parse(readFileSync(join(REPO, 'traverse', 'editions', 'dist', 'traverse-data', 'rounds', 'index.json'), 'utf8'));
  const regions = [];
  let n = 0;
  for (const r of idx.regions) {
    const f = join(src, r.key + '.json'); if (!existsSync(f)) { console.log('no door file', r.key); continue; }
    const d = JSON.parse(readFileSync(f, 'utf8'));
    /* only where the house is: no owner, address, value or anything else leaves the laptop */
    const areas = (d.areas || []).map((a) => ({ name: a.name, doors: (a.doors || []).filter((x) => typeof x.lat === 'number' && typeof x.lon === 'number').map((x) => ({ id: x.id, lat: x.lat, lon: x.lon })) }));
    writeFileSync(join(out, r.key + '.json'), JSON.stringify({ key: r.key, label: r.label, areas }));
    regions.push({ key: r.key, label: r.label });
    n += areas.reduce((s, a) => s + a.doors.length, 0);
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify({ regions }));
  console.log(`staged ${regions.length} towns, ${n} doors (id, lat, lon only) in ${out}`);
} else if (cmd === 'build') {
  const DATA = process.env.ROUNDS_DATA, DAYS = process.env.HAIL_DAYS, OUT = a1, LAST = a2 || '9999-12-31';
  if (!DATA || !DAYS || !OUT) throw new Error('ROUNDS_DATA=<dir> HAIL_DAYS=<dir> node backfill-hail.mjs build <out> [through]');
  mkdirSync(OUT, { recursive: true });
  const regions = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8')).regions;
  /* every door, once */
  const doors = [];   /* [townIndex, id, lat, lon, area] */
  for (let t = 0; t < regions.length; t++) {
    const d = JSON.parse(readFileSync(join(DATA, regions[t].key + '.json'), 'utf8'));
    for (const a of d.areas) for (const x of a.doors) doors.push([t, x.id, x.lat, x.lon, a.name]);
  }
  const files = readdirSync(DAYS).filter((f) => f.endsWith('.json') && f.slice(0, 10) <= LAST).sort();
  console.log(`${regions.length} towns, ${doors.length} doors, ${files.length} day files`);
  /* the doors by grid square, per grid (MRMS keeps one grid; checked per day all the same) */
  const gridKey = (o) => [o.lat1, o.lon1, o.dx, o.dy].join(',');
  const cellsOf = new Map();   /* gridKey -> Map(row*100000+col -> [door index]) */
  const doorCells = (o) => {
    const k = gridKey(o); if (cellsOf.has(k)) return cellsOf.get(k);
    const m = new Map();
    for (let i = 0; i < doors.length; i++) {
      const r = Math.round((o.lat1 - doors[i][2]) / o.dy), c = Math.round((doors[i][3] + 360 - o.lon1) / o.dx);
      const key = r * 100000 + c; const l = m.get(key); if (l) l.push(i); else m.set(key, [i]);
    }
    cellsOf.set(k, m); return m;
  };
  const perDoor = new Map();   /* door index -> [[date, inches]] */
  const storms = {};
  const paths = {}; let grid0 = null;   /* the hail map's squares, statewide: date -> [[row, col, inches x 100]] on the day file's grid */
  let have = 0, missing = 0, from = '', through = '';
  for (const f of files) {
    const day = JSON.parse(readFileSync(join(DAYS, f), 'utf8'));
    if (day.missing) { missing++; continue; }
    have++; if (!from) from = day.d; through = day.d;
    const hot = day.cells.filter((c) => c[2] / 10 >= MIN_STORE); if (!hot.length) continue;
    if (!grid0) grid0 = { lat1: day.lat1, lon1: day.lon1, dx: day.dx, dy: day.dy };
    if (gridKey(day) === gridKey(grid0)) paths[day.d] = hot.map(([r, c, v]) => [r + day.r0, c + day.c0, Math.round(v / 10 / 25.4 * 100)]);
    const m = doorCells(day);
    const best = new Map();   /* door index -> largest value (mm) in its 3 x 3 squares */
    for (const [r, c, v] of hot) {
      const R = r + day.r0, C = c + day.c0, mm = v / 10;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const l = m.get((R + dr) * 100000 + C + dc); if (!l) continue;
        for (const i of l) if (!(best.get(i) >= mm)) best.set(i, mm);
      }
    }
    for (const [i, mm] of best) {
      const [t, id, , , area] = doors[i], tk = regions[t].key, inch = Math.round(mm / 25.4 * 100) / 100;
      const l = perDoor.get(i); if (l) l.push([day.d, inch]); else perDoor.set(i, [[day.d, inch]]);
      const s = storms[day.d] = storms[day.d] || { date: day.d, max: 0, n1: 0, n34: 0, towns: {} };
      const tw = s.towns[tk] = s.towns[tk] || { label: regions[t].label || tk, n1: 0, n34: 0, max: 0, areas: {} };
      s.max = Math.max(s.max, inch); tw.max = Math.max(tw.max, inch); s.n34++; tw.n34++;
      if (mm >= BIG) { s.n1++; tw.n1++; tw.areas[area] = (tw.areas[area] || 0) + 1; }
    }
  }
  /* the keep rule, by storm day, as build-hail.mjs and the server's storm job */
  const cut = cutoffs(), kept = new Set(Object.values(storms).filter((s) => keepHailDay(s.date, s.max, cut)).map((s) => s.date));
  for (const k of Object.keys(storms)) if (!kept.has(k)) delete storms[k];
  const byTown = regions.map(() => ({}));
  for (const [i, list] of perDoor) {
    const l = list.filter((e) => kept.has(e[0])).sort((a, b) => (a[0] < b[0] ? 1 : -1)); if (!l.length) continue;
    byTown[doors[i][0]][doors[i][1]] = l;
  }
  const doorsIn = regions.map(() => 0); for (const d of doors) doorsIn[d[0]]++;
  const lines = ['key\tdoors\twith_hail'];
  for (let t = 0; t < regions.length; t++) {
    writeFileSync(join(OUT, `hail-${regions[t].key}.json`), JSON.stringify({ through, from, keep: cut, doors: byTown[t] }));
    lines.push([regions[t].key, doorsIn[t], Object.keys(byTown[t]).length].join('\t'));
  }
  const list = Object.values(storms).sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(join(OUT, 'hail-storms-backfill.json'), JSON.stringify({ through, from, days: have, missing, keep: cut, storms: list }));
  writeFileSync(join(OUT, 'coverage.tsv'), lines.join('\n') + '\n');
  /* rows and columns are the whole grid's (not cut to a box): merge-storms.py moves them onto the live hail-paths.json's own r0/c0 */
  const kp = {}; for (const s of list) if (paths[s.date]) kp[s.date] = paths[s.date];
  writeFileSync(join(OUT, 'hail-paths-backfill.json'), JSON.stringify({ ...grid0, r0: 0, c0: 0, paths: kp }));
  console.log(`through ${through}: ${list.length} storm days kept, ${have} days read, ${missing} missing; ${[...perDoor.keys()].length} doors ever at 0.75 in+`);
} else {
  console.log('node backfill-hail.mjs stage <dir> | build <out> [through]');
}

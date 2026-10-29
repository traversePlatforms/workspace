/* Group 3b targets (2026-10-29): the counties Group 3 skipped that the state's address points can still give doors (build-walklist-pts.mjs).
   Same places and rural sweeps as group3-targets.mjs made for every county (candidates.json), in the same order; shapes from shapes.json
   (group3-gaps.mjs). Writes targets-3b.json, pieces-<key>.json for each, and tiles-3b.txt (the z9 building-outline tiles over the
   counties, for fetch-buildings.mjs).
     node targets-3b.mjs                                                                                                            */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
/* parcels: the county has rows on the statewide parcel layer worth joining (owner and/or lot size); see the plan's Group 3b table */
export const COUNTIES_3B = {
  Montrose: { parcels: false }, Delta: { parcels: false }, 'Las Animas': { parcels: false }, Alamosa: { parcels: false },
  Conejos: { parcels: false }, Costilla: { parcels: false }, Bent: { parcels: false }, Mineral: { parcels: false },
  Saguache: { parcels: true },     /* owner + mailing on the parcel rows, no property address, address points with no parcel number */
  Washington: { parcels: true },   /* parcel rows with lot size only (no owner, no mailing) */
  Sedgwick: { parcels: true },     /* owner on the parcel rows, no mailing address */
};
const cands = JSON.parse(readFileSync(join(HERE, 'candidates.json'), 'utf8'));
const G = JSON.parse(readFileSync(join(HERE, '..', 'group3-gaps.json'), 'utf8'));
const shapes = JSON.parse(readFileSync(join(HERE, 'shapes.json'), 'utf8'));
/* candidates.json has no GEOIDs: find each target's shape by name and county (places by name, sweeps by subdivision name) */
const slug = (s) => s.toLowerCase().replace(/ (city|town|cdp|ccd)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const geoidOf = (t) => {   /* group3-targets.mjs's keys: g3-<name>[-rural], with -<county> added on a clash */
  const ok = (base) => [base, base + '-' + slug(t.county)].includes(t.key);
  const r = t.kind === 'rural' ? G.ccd.find((c) => c.county === t.county && ok('g3-' + slug(c.name) + '-rural')) : G.places.find((p) => p.county === t.county && ok('g3-' + slug(p.name)));
  return r && r.geoid;
};
function quadkey(lon, lat, z) {
  const s = Math.sin(lat * Math.PI / 180);
  const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z);
  let q = ''; for (let i = z; i > 0; i--) { let dd = 0; const m = 1 << (i - 1); if (x & m) dd++; if (y & m) dd += 2; q += dd; }
  return q;
}
const out = [], tiles = new Set();
for (const t of cands) {
  if (!COUNTIES_3B[t.county]) continue;
  const g = geoidOf(t), s = g && shapes[g];
  if (!s) throw new Error('no shape for ' + t.key);
  writeFileSync(join(HERE, `pieces-${t.key}.json`), JSON.stringify([{ rings: s.rings, bb: s.bb }]));
  /* every z9 tile under the shape's box (tiles are ~0.7 degrees: a step of 0.1 cannot miss one) */
  for (let x = s.bb[0]; x <= s.bb[2] + 0.1; x += 0.1) for (let y = s.bb[1]; y <= s.bb[3] + 0.1; y += 0.1) tiles.add(quadkey(Math.min(x, s.bb[2]), Math.min(y, s.bb[3]), 9));
  out.push({ ...t, method: COUNTIES_3B[t.county].parcels ? 'pts+parcels' : 'pts' });
}
writeFileSync(join(HERE, 'targets-3b.json'), JSON.stringify(out, null, 1));
writeFileSync(join(HERE, 'tiles-3b.txt'), [...tiles].join(' ') + '\n');
const by = {}; for (const t of out) { by[t.county] = by[t.county] || { n: 0, census: 0, own: 0, method: t.method }; by[t.county].n++; by[t.county].census += t.census; by[t.county].own += t.ownerOccupied; }
for (const [c, v] of Object.entries(by)) console.log(`${c} (${v.method}): ${v.n} targets, ${v.census} Census houses, ${v.own} owner-occupied`);
console.log(`${out.length} targets, ${out.reduce((s, t) => s + t.census, 0)} Census houses; ${tiles.size} building tiles`);

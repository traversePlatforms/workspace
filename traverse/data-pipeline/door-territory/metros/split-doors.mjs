// Towns for a metro built from county files (16 Nov 2026, Houston), and each town's rows.
//   node metros/split-doors.mjs <metro> --plan    count homes by situs city across the counties and write the towns list into
//                                                 metros/<metro>.json (its other keys kept); prints the plan
//   node metros/split-doors.mjs <metro>           put every county row in its town: metros/out/<metro>/<town>.ndjson
// Rows come from each file source's "norm" file (metros/readers/prep-<county>.mjs: single-family parcels only, one JSON line each:
// { id, own, mail, situs, city, zip, hs, yb, sqft, val, valYr, rings }).
// The rule ("plan" in metros/<metro>.json):
//   - a town is a situs (postal) city, across every county it reaches; its county is the one with most of its homes
//   - a city with more than plan.maxDoors homes (Houston) is split around plan.centre: a disc of plan.innerKm, then 8 compass sectors,
//     a sector still over plan.maxDoors cut again at its median distance (near / far). Door files stay under ~Denver's size (135k)
//   - a city with fewer than plan.minDoors homes joins its county's "other towns" town
// Town keys carry the metro's prefix (hou-katy), so no key can meet a Colorado one and editions' files are easy to check.
import { readFileSync, writeFileSync, mkdirSync, createReadStream, createWriteStream } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const metro = process.argv[2], PLAN = process.argv.includes('--plan');
const MF = join(HERE, metro + '.json'), M = JSON.parse(readFileSync(MF, 'utf8')), P = M.plan;
const files = Object.entries(M.sources).filter(([, s]) => s.type === 'file');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const cityKey = (s) => String(s || '').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim() || 'UNKNOWN';
const km = (la1, lo1, la2, lo2) => Math.hypot((la1 - la2) * 111.2, (lo1 - lo2) * 111.2 * Math.cos(la1 * Math.PI / 180));
const bearing = (la, lo) => { const b = Math.atan2((lo - P.centre[1]) * Math.cos(P.centre[0] * Math.PI / 180), la - P.centre[0]) * 180 / Math.PI; return (b + 360) % 360; };
const SECT = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
const sectorOf = (la, lo) => Math.floor(((bearing(la, lo) + 22.5) % 360) / 45);
const mid = (r) => { const p = r.rings[0]; let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [y / p.length, x / p.length]; };
async function* rows() {
  for (const [county, S] of files) {
    const rl = createInterface({ input: createReadStream(join(ROOT, S.norm), { encoding: 'utf8' }) });
    for await (const line of rl) if (line) { const r = JSON.parse(line); if (r.rings && r.rings.length) yield [county, r]; }
  }
}
/* which town a row belongs to, from the towns list (the plan's output) */
function townFinder(towns) {
  const byCity = new Map(), other = new Map();
  for (const t of towns) { if (t.other) other.set(t.county, t); else for (const c of t.cities) (byCity.get(c) || byCity.set(c, []).get(c)).push(t); }
  return (county, r) => {
    const list = byCity.get(cityKey(r.city));
    if (!list) return other.get(county) || null;
    if (list.length === 1 && !list[0].sector) return list[0];
    const [la, lo] = mid(r), d = km(la, lo, ...P.centre), s = sectorOf(la, lo);
    return list.find((t) => t.sector && (t.sector.inner ? d < P.innerKm : d >= P.innerKm && t.sector.s === s && (t.sector.near == null || (t.sector.near ? d < t.sector.cut : d >= t.sector.cut)))) || null;
  };
}
if (PLAN) {
  const C = new Map();   /* city -> { n, byCounty, la, lo, pts (for big cities: [d, s]) } */
  for await (const [county, r] of rows()) {
    const k = cityKey(r.city), c = C.get(k) || C.set(k, { n: 0, byCounty: {}, la: 0, lo: 0, pts: [] }).get(k), [la, lo] = mid(r);
    c.n++; c.byCounty[county] = (c.byCounty[county] || 0) + 1; c.la += la; c.lo += lo; c.pts.push([km(la, lo, ...P.centre), sectorOf(la, lo), la, lo]);
  }
  const towns = [], others = {};
  for (const [k, c] of [...C.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const counties = Object.entries(c.byCounty).sort((a, b) => b[1] - a[1]).map(([x]) => x), county = counties[0];
    if (c.n < P.minDoors || k === 'UNKNOWN') { const o = (others[county] = others[county] || { n: 0, la: 0, lo: 0, cities: [] }); o.n += c.n; o.la += c.la; o.lo += c.lo; o.cities.push(k); continue; }
    if (c.n <= P.maxDoors) { towns.push({ key: `${metro}-${slug(k)}`, label: title(k), county, counties, cities: [k], center: [+(c.la / c.n).toFixed(4), +(c.lo / c.n).toFixed(4)], homes: c.n }); continue; }
    const cen = (pts) => [+(pts.reduce((s, p) => s + p[2], 0) / pts.length).toFixed(4), +(pts.reduce((s, p) => s + p[3], 0) / pts.length).toFixed(4)];
    const inner = c.pts.filter((p) => p[0] < P.innerKm);
    towns.push({ key: `${metro}-${slug(k)}-inner`, label: `${title(k)} Inner`, county, counties, cities: [k], sector: { inner: true }, center: cen(inner), homes: inner.length });
    for (let s = 0; s < 8; s++) {
      const pts = c.pts.filter((p) => p[0] >= P.innerKm && p[1] === s); if (!pts.length) continue;
      const base = { county, counties, cities: [k] }, name = `${title(k)} ${SECT[s]}`;
      if (pts.length <= P.maxDoors) { towns.push({ key: `${metro}-${slug(name)}`, label: name, ...base, sector: { s }, center: cen(pts), homes: pts.length }); continue; }
      const ds = pts.map((p) => p[0]).sort((a, b) => a - b), cut = +ds[ds.length >> 1].toFixed(2);
      const near = pts.filter((p) => p[0] < cut), far = pts.filter((p) => p[0] >= cut);
      towns.push({ key: `${metro}-${slug(name)}-near`, label: `${name} (near)`, ...base, sector: { s, near: true, cut }, center: cen(near), homes: near.length });
      towns.push({ key: `${metro}-${slug(name)}-far`, label: `${name} (far)`, ...base, sector: { s, near: false, cut }, center: cen(far), homes: far.length });
    }
  }
  for (const [county, o] of Object.entries(others)) towns.push({ key: `${metro}-${slug(M.sources[county].countyName)}-county-other`, label: `${M.sources[county].countyName} County, other towns`, county, counties: [county], other: true, cities: o.cities.sort(), center: [+(o.la / o.n).toFixed(4), +(o.lo / o.n).toFixed(4)], homes: o.n });
  M.towns = towns; writeFileSync(MF, JSON.stringify(M, null, 1) + '\n');
  for (const t of towns) console.log(`${t.key.padEnd(34)} ${String(t.homes).padStart(7)}  ${t.county}${t.counties.length > 1 ? ' (+' + t.counties.slice(1).join(',') + ')' : ''}${t.other ? '  ' + t.cities.length + ' small places' : ''}`);
  console.log(`${towns.length} towns, ${towns.reduce((s, t) => s + t.homes, 0)} homes -> metros/${metro}.json`);
} else {
  const find = townFinder(M.towns), dir = join(HERE, 'out', metro); mkdirSync(dir, { recursive: true });
  const ws = new Map(), n = {}; let lost = 0;
  for await (const [county, r] of rows()) {
    const t = find(county, r); if (!t) { lost++; continue; }
    if (!ws.has(t.key)) ws.set(t.key, createWriteStream(join(dir, `${t.key}.ndjson`)));
    ws.get(t.key).write(JSON.stringify(r) + '\n'); n[t.key] = (n[t.key] || 0) + 1;
  }
  await Promise.all([...ws.values()].map((w) => new Promise((ok) => w.end(ok))));
  for (const t of M.towns) console.log(`${t.key.padEnd(34)} ${String(n[t.key] || 0).padStart(7)}`);
  console.log(`${Object.values(n).reduce((s, x) => s + x, 0)} rows into ${ws.size} towns (${lost} matched no town)`);
}

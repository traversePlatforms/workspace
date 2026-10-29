/* Group 3 targets (2026-10-29): the rest of Colorado, as group2-targets.mjs did for Larimer, Mesa and Pueblo. Reads group3-gaps.json
   (group3-gaps.mjs) and group3/county-sources.json (how each county's parcels can be read, from group3/coverage-g3.mjs run on the
   cloud machine: "co" = the statewide parcel layer carries the property address, build-walklist-co.mjs; "ap" = it does not, so the
   address comes from the state's address points joined by parcel number, group3/build-walklist-ap.mjs; "skip" = no doors can be
   made, with the reason).
     1. every place (town or CDP) of 150+ Census houses where under a quarter of the houses are doors of ours already, biggest first;
     2. then every county subdivision under a quarter covered as a rural sweep: the land outside the places, plus whatever a place's
        pull missed (clip-group3.mjs drops houses already pulled by an earlier target, so a sweep never repeats a place's doors).
   Counties in order of their Census gap, biggest first. Each shape is fetched by GEOID from TIGERweb ACS 2024.
     node group3-targets.mjs     -> group3/candidates.json (every county, for the coverage probe), group3/targets.json (the counties
                                    that can be built), group3/skipped.json, group3/pieces-<key>.json                             */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'group3');
mkdirSync(OUT, { recursive: true });
const G = JSON.parse(readFileSync(join(HERE, 'group3-gaps.json'), 'utf8'));
const SRC = existsSync(join(OUT, 'county-sources.json')) ? JSON.parse(readFileSync(join(OUT, 'county-sources.json'), 'utf8')) : {};
const TW = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/';
const get = async (u) => { for (let i = 0; i < 8; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch {} await new Promise((z) => setTimeout(z, 3000 * (i + 1))); } throw new Error('failed ' + u.slice(0, 160)); };
const SKIP = /Fort Carson|Air Force Academy/;
const slug = (s) => s.toLowerCase().replace(/ (city|town|cdp|ccd)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const under = (r) => r.doors < r.census / 4;
const CACHE = existsSync(join(OUT, 'shapes.json')) ? JSON.parse(readFileSync(join(OUT, 'shapes.json'), 'utf8')) : {};   /* group3-gaps.mjs */
async function shape(layer, geoid) {
  if (CACHE[geoid]) return CACHE[geoid];
  const j = await get(TW + layer + '/query?' + new URLSearchParams({ where: `GEOID='${geoid}'`, outFields: 'GEOID,NAME', returnGeometry: 'true', outSR: '4326', f: 'json', geometryPrecision: '5' }));
  const f = (j.features || [])[0]; if (!f) return null;
  const rings = f.geometry.rings, all = rings.flat();
  return { rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] };
}
const ORDER = G.counties.slice().sort((a, b) => b.gap - a.gap).map((c) => c.county);
const all = [], left = [];
for (const county of ORDER) {
  const places = G.places.filter((p) => p.county === county && p.census >= 150 && !SKIP.test(p.name)).sort((a, b) => b.census - a.census);
  for (const p of places) {
    if (!under(p)) { left.push({ county, name: p.name, census: p.census, doors: p.doors, why: 'a quarter or more already doors of ours' }); continue; }
    const s = await shape(p.cdp ? 30 : 28, p.geoid); if (!s) { console.log('no shape', p.name); continue; }
    all.push({ key: 'g3-' + slug(p.name), label: p.name.replace(/ (city|town|CDP)$/, ''), kind: p.cdp ? 'cdp' : 'town', county, census: p.census, ownerOccupied: p.ownerOccupied, doorsAlready: p.doors, s });
  }
  for (const c of G.ccd.filter((r) => r.county === county && r.census > 0).sort((a, b) => b.census - a.census)) {
    if (!under(c)) { left.push({ county, name: c.name, census: c.census, doors: c.doors, why: 'a quarter or more already doors of ours' }); continue; }
    const s = await shape(22, c.geoid); if (!s) { console.log('no shape', c.name); continue; }
    const inside = G.places.filter((p) => p.ccd === c.geoid && places.includes(p) && under(p));
    all.push({ key: 'g3-' + slug(c.name) + '-rural', label: c.name.replace(/ CCD$/, '') + ' (rural)', kind: 'rural', county, census: Math.max(0, c.gap - inside.reduce((n, p) => n + p.census, 0)), ownerOccupied: Math.max(0, c.ownerOccupied - inside.reduce((n, p) => n + p.ownerOccupied, 0)), doorsAlready: c.doors, subdivision: c.gap, placesInside: inside.map((p) => p.name.replace(/ (city|town|CDP)$/, '')), s });
  }
}
const keys = new Set(); for (const t of all) { if (keys.has(t.key)) { t.key += '-' + slug(t.county); } if (keys.has(t.key)) throw new Error('duplicate key ' + t.key); keys.add(t.key); }
for (const t of all) {
  const [x0, y0, x1, y1] = t.s.bb; t.lat = +((y0 + y1) / 2).toFixed(5); t.lon = +((x0 + x1) / 2).toFixed(5);
  /* miles: half the box's longer side, a little over (miles per degree of longitude at the box's own latitude) */
  t.radius = +(Math.max((x1 - x0) * 69 * Math.cos(t.lat * Math.PI / 180), (y1 - y0) * 69) / 2 * 1.05 + 0.2).toFixed(1);
  const src = SRC[t.county] || {}; t.method = src.method || 'tbd'; t.countyUpper = t.county.toUpperCase();
}
const strip = (t) => { const { s, ...rest } = t; return rest; };
writeFileSync(join(OUT, 'candidates.json'), JSON.stringify(all.map(strip), null, 1));
const run = all.filter((t) => t.method === 'co' || t.method === 'ap');
for (const t of run) writeFileSync(join(OUT, `pieces-${t.key}.json`), JSON.stringify([{ rings: t.s.rings, bb: t.s.bb }]));
writeFileSync(join(OUT, 'targets.json'), JSON.stringify(run.map(strip), null, 1));
const skippedCounties = ORDER.filter((c) => !run.some((t) => t.county === c)).map((c) => { const r = G.counties.find((x) => x.county === c); return { county: c, census: r.census, ownerOccupied: r.ownerOccupied, why: (SRC[c] || {}).why || (all.some((t) => t.county === c) ? 'no source checked yet' : 'every place and subdivision a quarter or more covered') }; });
writeFileSync(join(OUT, 'skipped.json'), JSON.stringify({ counties: skippedCounties, coveredAlready: left }, null, 1));
console.log(all.length, 'candidates;', run.length, 'targets to build; Census houses', run.reduce((s, t) => s + t.census, 0), '; owner-occupied', run.reduce((s, t) => s + t.ownerOccupied, 0));
for (const c of ORDER) { const ts = run.filter((t) => t.county === c); if (ts.length) console.log(`${c} (${ts[0].method}): ${ts.length} targets, ${ts.reduce((s, t) => s + t.census, 0)} Census houses, ${ts.reduce((s, t) => s + t.ownerOccupied, 0)} owner-occupied`); }
console.log('\nskipped counties:'); for (const s of skippedCounties) console.log(`${s.county} | ${s.census} | ${s.why}`);
console.log('\nleft out, covered already:'); for (const s of left) console.log(`${s.county} | ${s.name} | census ${s.census} | doors ${s.doors}`);
for (const t of run) console.log(`${t.key} | ${t.label} | ${t.county} | ${t.kind} | census ${t.census} | own ${t.ownerOccupied}${t.kind === 'rural' ? ` (places inside: ${t.placesInside.join(', ') || 'none'})` : ''} | r ${t.radius} mi | ${t.method}`);

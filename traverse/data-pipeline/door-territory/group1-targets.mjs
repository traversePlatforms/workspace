/* Group 1 targets (2026-10-26): the places (towns and CDPs) in our nine counties that have no town of ours, and the rural county
   subdivisions with the biggest gaps, each with its Census boundary saved as a pieces file for build-walklist-co.mjs --pieces (and for
   clipping El Paso pulls, whose county layer has no owner fields statewide). Reads group1-gaps.json (group1-gaps.mjs) for the counts.
   Military housing (Fort Carson, Air Force Academy) is left out: not owner-occupied doors.
     node group1-targets.mjs     -> group1/targets.json + group1/pieces-<key>.json                                                */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'group1');
mkdirSync(OUT, { recursive: true });
const G = JSON.parse(readFileSync(join(HERE, 'group1-gaps.json'), 'utf8'));
const TW = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch {} await new Promise((z) => setTimeout(z, 1500 * (i + 1))); } throw new Error('failed ' + u.slice(0, 100)); };
const COUNTY = { Adams: 'ADAMS', Arapahoe: 'ARAPAHOE', Boulder: 'BOULDER', Broomfield: 'BROOMFIELD', Denver: 'DENVER', Douglas: 'DOUGLAS', 'El Paso': 'EL PASO', Jefferson: 'JEFFERSON', Weld: 'WELD' };
const SKIP = /Fort Carson|Air Force Academy/;
const slug = (s) => s.toLowerCase().replace(/ (city|town|cdp|ccd)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function shape(layer, name) {
  const j = await get(TW + layer + '/query?' + new URLSearchParams({ where: `STATE='08' AND NAME='${name.replace(/'/g, "''")}'`, outFields: 'GEOID,NAME', returnGeometry: 'true', outSR: '4326', f: 'json', geometryPrecision: '5' }));
  const f = (j.features || [])[0]; if (!f) return null;
  const rings = f.geometry.rings, all = rings.flat();
  return { rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] };
}
const targets = [];
/* 1. places with no town of ours, over 150 Census houses */
for (const p of G.places.filter((p) => !Object.keys(p.ourTowns).length && p.census >= 150 && !SKIP.test(p.name)).sort((a, b) => b.census - a.census)) {
  const layer = / CDP$/.test(p.name) ? 30 : 28, s = await shape(layer, p.name); if (!s) { console.log('no shape', p.name); continue; }
  targets.push({ key: 'g1-' + slug(p.name), label: p.name.replace(/ (city|town|CDP)$/, ''), kind: / CDP$/.test(p.name) ? 'cdp' : 'town', county: p.county, census: p.census, s });
}
/* 2. rural subdivisions with the biggest gaps (outside the big cities, whose gaps are mostly renters our lists leave out on purpose) */
const RURAL = ['Black Forest-Peyton CCD', 'South Jefferson CCD', 'Central Jefferson CCD', 'Southeastern El Paso CCD', 'Bald Mountain CCD', 'Monument CCD', 'Golden CCD', 'Ault CCD', 'Elsmere CCD', 'Fountain CCD', 'Johnstown-Milliken CCD', 'Greeley CCD'];
for (const name of RURAL) {
  const c = G.ccd.find((r) => r.name === name); if (!c) { console.log('no ccd', name); continue; }
  const s = await shape(22, name); if (!s) { console.log('no shape', name); continue; }
  targets.push({ key: 'g1-' + slug(name) + '-rural', label: name.replace(/ CCD$/, '') + ' (rural)', kind: 'rural', county: c.county, census: c.gap, s });
}
for (const t of targets) {
  writeFileSync(join(OUT, `pieces-${t.key}.json`), JSON.stringify([{ rings: t.s.rings, bb: t.s.bb }]));
  const [x0, y0, x1, y1] = t.s.bb; t.lat = +((y0 + y1) / 2).toFixed(5); t.lon = +((x0 + x1) / 2).toFixed(5);
  t.radius = +(Math.max((x1 - x0) * 53, (y1 - y0) * 69) / 2 * 1.05 + 0.2).toFixed(1);   /* miles: half the box's longer side, a little over */
  t.method = t.county === 'El Paso' ? 'elpaso' : 'co'; t.countyUpper = COUNTY[t.county]; delete t.s;
}
writeFileSync(join(OUT, 'targets.json'), JSON.stringify(targets, null, 1));
console.log(targets.length, 'targets; Census houses', targets.reduce((s, t) => s + t.census, 0));
for (const t of targets) console.log(`${t.key} | ${t.label} | ${t.county} | ${t.kind} | census ${t.census} | r ${t.radius} mi | ${t.method}`);

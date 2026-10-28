/* Group 2 targets (2026-10-28): Larimer, Mesa and Pueblo, as group1-targets.mjs did for Group 1. Reads group2-gaps.json
   (group2-gaps.mjs). We have no towns in these counties, so:
     1. every place (town or CDP) of 150+ Census houses with no town of ours, biggest first;
     2. then every county subdivision as a rural sweep: the land outside the places, plus whatever a place's pull missed
        (clip-group2.mjs drops houses already pulled by an earlier target, so a sweep never repeats a place's doors).
   Order: Larimer, then Mesa, then Pueblo (Pueblo needs its own adapter, build-walklist-pueblo.mjs, because the statewide parcel
   layer carries no property address there). Each shape is fetched by GEOID from TIGERweb ACS 2024 and saved as a pieces file.
   No military housing in these counties (the Fort Carson / Air Force Academy rule is kept anyway).
     node group2-targets.mjs     -> group2/targets.json + group2/pieces-<key>.json                                                */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'group2');
mkdirSync(OUT, { recursive: true });
const G = JSON.parse(readFileSync(join(HERE, 'group2-gaps.json'), 'utf8'));
const TW = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch {} await new Promise((z) => setTimeout(z, 1500 * (i + 1))); } throw new Error('failed ' + u.slice(0, 100)); };
const ORDER = ['Larimer', 'Mesa', 'Pueblo'];
const METHOD = { Larimer: 'co', Mesa: 'co', Pueblo: 'pueblo' };
const SKIP = /Fort Carson|Air Force Academy/;
const slug = (s) => s.toLowerCase().replace(/ (city|town|cdp|ccd)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function shape(layer, geoid) {
  const j = await get(TW + layer + '/query?' + new URLSearchParams({ where: `GEOID='${geoid}'`, outFields: 'GEOID,NAME', returnGeometry: 'true', outSR: '4326', f: 'json', geometryPrecision: '5' }));
  const f = (j.features || [])[0]; if (!f) return null;
  const rings = f.geometry.rings, all = rings.flat();
  return { rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] };
}
const targets = [];
for (const county of ORDER) {
  /* "no town of ours" = under a quarter of its Census houses are doors: Berthoud (g1-berthoud) was pulled from the Weld rows of the
     statewide layer only, so its Larimer side, most of the town, has 53 doors against 4,541 Census houses. Stage B merges it into
     g1-berthoud rather than making a second Berthoud. */
  const places = G.places.filter((p) => p.county === county && p.doors < p.census / 4 && p.census >= 150 && !SKIP.test(p.name)).sort((a, b) => b.census - a.census);
  for (const p of places) {
    const s = await shape(p.cdp ? 30 : 28, p.geoid); if (!s) { console.log('no shape', p.name); continue; }
    targets.push({ key: 'g2-' + slug(p.name), label: p.name.replace(/ (city|town|CDP)$/, ''), kind: p.cdp ? 'cdp' : 'town', county, census: p.census, s });
  }
  for (const c of G.ccd.filter((r) => r.county === county).sort((a, b) => b.census - a.census)) {
    const s = await shape(22, c.geoid); if (!s) { console.log('no shape', c.name); continue; }
    const inside = G.places.filter((p) => p.ccd === c.geoid && places.includes(p));
    targets.push({ key: 'g2-' + slug(c.name) + '-rural', label: c.name.replace(/ CCD$/, '') + ' (rural)', kind: 'rural', county, census: Math.max(0, c.gap - inside.reduce((n, p) => n + p.census, 0)), subdivision: c.gap, placesInside: inside.map((p) => p.name.replace(/ (city|town|CDP)$/, '')), s });
  }
}
const keys = new Set(); for (const t of targets) { if (keys.has(t.key)) throw new Error('duplicate key ' + t.key); keys.add(t.key); }
for (const t of targets) {
  writeFileSync(join(OUT, `pieces-${t.key}.json`), JSON.stringify([{ rings: t.s.rings, bb: t.s.bb }]));
  const [x0, y0, x1, y1] = t.s.bb; t.lat = +((y0 + y1) / 2).toFixed(5); t.lon = +((x0 + x1) / 2).toFixed(5);
  /* miles: half the box's longer side, a little over (miles per degree of longitude at the box's own latitude) */
  t.radius = +(Math.max((x1 - x0) * 69 * Math.cos(t.lat * Math.PI / 180), (y1 - y0) * 69) / 2 * 1.05 + 0.2).toFixed(1);
  t.method = METHOD[t.county]; t.countyUpper = t.county.toUpperCase(); delete t.s;
}
writeFileSync(join(OUT, 'targets.json'), JSON.stringify(targets, null, 1));
console.log(targets.length, 'targets; Census houses', targets.reduce((s, t) => s + t.census, 0));
for (const c of ORDER) { const ts = targets.filter((t) => t.county === c); console.log(`${c}: ${ts.length} targets, ${ts.reduce((s, t) => s + t.census, 0)} Census houses`); }
for (const t of targets) console.log(`${t.key} | ${t.label} | ${t.county} | ${t.kind} | census ${t.census}${t.kind === 'rural' ? ` (subdivision ${t.subdivision}; places inside: ${t.placesInside.join(', ') || 'none'})` : ''} | r ${t.radius} mi | ${t.method}`);

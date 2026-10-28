/* Group 2 (2026-10-28, Matthew's go): Larimer, Mesa and Pueblo, three counties with no towns of ours (Windsor and Group 1's Berthoud
   and Johnstown reach into Larimer). The same count as group1-gaps.mjs: Census ACS 5-year 2020-2024 B25024 (002 detached + 003
   attached, all occupancy) per county subdivision and per place (towns and CDPs), against our door points counted inside each shape
   (Census TIGERweb ACS 2024 boundaries). Keeps the GEOIDs so group2-targets.mjs fetches each shape by id, and records which places sit
   in which subdivision (by the place's middle) for the rural-only estimate.
   Also writes group2/door-points.json: [lat, lon] of every door of ours inside the three counties' boxes, for clip-group2.mjs.
   An ESTIMATE: Census counts units, our doors are owner-occupied homes from the walk lists, so a built town still shows a gap.
     node group2-gaps.mjs     writes group2-gaps.json + group2/door-points.json and prints the tables GROUP2-PLAN is written from   */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), DATA = join(HERE, '..', '..', 'app', 'data', 'rounds');
mkdirSync(join(HERE, 'group2'), { recursive: true });
const KEY = readFileSync(join(HERE, 'census-key.txt'), 'utf8').trim();
const COUNTIES = { '069': 'Larimer', '077': 'Mesa', '101': 'Pueblo' };
const TW = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/';
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch {} await new Promise((z) => setTimeout(z, 1500 * (i + 1))); } throw new Error('failed ' + u.slice(0, 120)); };
async function shapes(layer, where, fields = 'GEOID,NAME,COUNTY,STATE') {
  const out = []; let off = 0;
  for (;;) {
    const j = await get(TW + layer + '/query?' + new URLSearchParams({ where, outFields: fields, returnGeometry: 'true', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '200', geometryPrecision: '5' }));
    for (const f of j.features || []) out.push({ geoid: f.attributes.GEOID, name: f.attributes.NAME, county: f.attributes.COUNTY, rings: f.geometry.rings });
    if (!(j.features || []).length || !j.exceededTransferLimit) break; off += j.features.length;
  }
  for (const s of out) { const all = s.rings.flat(); s.bb = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))]; }
  return out;
}
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inShape = (x, y, s) => x >= s.bb[0] && x <= s.bb[2] && y >= s.bb[1] && y <= s.bb[3] && s.rings.filter((r) => inRing(x, y, r)).length % 2 === 1;
/* census counts */
const acs = async (forg, inn) => { const j = await get(`https://api.census.gov/data/2024/acs/acs5?get=NAME,B25024_002E,B25024_003E&for=${encodeURIComponent(forg)}&in=${encodeURIComponent(inn)}&key=${KEY}`); return j.slice(1).map((r) => ({ name: r[0], n: +r[1] + +r[2], geo: r.slice(3).join('') })); };
const ccd = []; for (const c of Object.keys(COUNTIES)) for (const r of await acs('county subdivision:*', 'state:08 county:' + c)) ccd.push({ ...r, county: c });
const plc = await acs('place:*', 'state:08');
/* shapes */
const ccdS = await shapes(22, `STATE='08' AND COUNTY IN (${Object.keys(COUNTIES).map((c) => `'${c}'`).join(',')})`);
const allPl = (await shapes(28, "STATE='08'", 'GEOID,NAME,STATE')).concat(await shapes(30, "STATE='08'", 'GEOID,NAME,STATE'));
const box = Object.keys(COUNTIES).map((c) => { const s = ccdS.filter((q) => q.county === c); return [Math.min(...s.map((q) => q.bb[0])), Math.min(...s.map((q) => q.bb[1])), Math.max(...s.map((q) => q.bb[2])), Math.max(...s.map((q) => q.bb[3]))]; });
const inBox = (x, y) => box.some((b) => x >= b[0] - 0.01 && x <= b[2] + 0.01 && y >= b[1] - 0.01 && y <= b[3] + 0.01);
/* our door points (every town file in the index, metros included: a door is a door) */
const pts = []; const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8')).regions;
for (const r of idx) { let j; try { j = JSON.parse(readFileSync(join(DATA, r.key + '.json'), 'utf8')); } catch { continue; } for (const a of j.areas || []) for (const d of a.doors || []) if (typeof d.lat === 'number' && inBox(d.lon, d.lat)) pts.push([d.lon, d.lat, r.key]); }
writeFileSync(join(HERE, 'group2', 'door-points.json'), JSON.stringify(pts.map(([x, y]) => [+y.toFixed(6), +x.toFixed(6)])));
console.log('our doors inside the three counties\' boxes:', pts.length);
const cnt = new Map(), towns = new Map();
const plNear = allPl.filter((p) => box.some((b) => p.bb[2] >= b[0] && p.bb[0] <= b[2] && p.bb[3] >= b[1] && p.bb[1] <= b[3]));
for (const [x, y, t] of pts) {
  const s = ccdS.find((q) => inShape(x, y, q)); if (s) cnt.set(s.geoid, (cnt.get(s.geoid) || 0) + 1);
  const p = plNear.find((q) => inShape(x, y, q)); if (p) { cnt.set('p' + p.geoid, (cnt.get('p' + p.geoid) || 0) + 1); const m = towns.get(p.geoid) || {}; m[t] = (m[t] || 0) + 1; towns.set(p.geoid, m); }
}
/* places inside the three counties: by the subdivision holding most of the place (a 25 x 25 grid of points over its box, the ones
   inside the place voting). The box's middle alone put Pueblo city in St. Charles Mesa, which broke the rural-only estimate. */
const plIn = plNear.map((p) => {
  const votes = new Map();
  for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
    const x = p.bb[0] + (p.bb[2] - p.bb[0]) * (i + 0.5) / 25, y = p.bb[1] + (p.bb[3] - p.bb[1]) * (j + 0.5) / 25;
    if (!inShape(x, y, p)) continue; const s = ccdS.find((q) => inShape(x, y, q)); const k = s ? s.geoid : 'none'; votes.set(k, (votes.get(k) || 0) + 1);
  }
  const best = [...votes].sort((a, b) => b[1] - a[1])[0]; const s = best && ccdS.find((q) => q.geoid === best[0]);
  return s ? { ...p, county: s.county, ccd: s.geoid } : null;
}).filter(Boolean);
const plN = new Map(plc.map((r) => [r.geo.slice(2), r]));
const rows = {
  ccd: ccd.map((r) => { const geoid = '08' + r.county + r.geo.slice(-5); return { geoid, county: COUNTIES[r.county], name: r.name.split(',')[0], census: r.n, doors: cnt.get(geoid) || 0 }; }),
  places: plIn.map((p) => ({ geoid: p.geoid, ccd: p.ccd, cdp: / CDP$/.test(p.name), county: COUNTIES[p.county], name: p.name, census: (plN.get(p.geoid.slice(2)) || {}).n || 0, doors: cnt.get('p' + p.geoid) || 0, ourTowns: towns.get(p.geoid) || {} })),
};
for (const k of ['ccd', 'places']) for (const r of rows[k]) r.gap = Math.max(0, r.census - r.doors);
writeFileSync(join(HERE, 'group2-gaps.json'), JSON.stringify(rows, null, 1));
const byC = {}; for (const r of rows.ccd) { const c = byC[r.county] ||= { census: 0, doors: 0 }; c.census += r.census; c.doors += r.doors; }
console.log('\ncounty | census | doors | gap'); for (const [c, v] of Object.entries(byC)) console.log(`${c} | ${v.census} | ${v.doors} | ${v.census - v.doors}`);
console.log('\nplaces:'); for (const r of rows.places.sort((a, b) => b.census - a.census)) console.log(`${r.county} | ${r.name} | census ${r.census} | doors ${r.doors} | ours ${JSON.stringify(r.ourTowns)}`);
console.log('\nsubdivisions:'); for (const r of rows.ccd.sort((a, b) => b.census - a.census)) console.log(`${r.county} | ${r.name} | census ${r.census} | doors ${r.doors} | gap ${r.gap}`);

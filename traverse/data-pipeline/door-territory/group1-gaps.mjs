/* Group 1 (2026-10-26, Matthew: "que up group 1"): the single-family and townhome houses inside the nine counties we already cover that
   are not doors yet. Census ACS 5-year 2020-2024 B25024 (002 detached + 003 attached, all occupancy) per county subdivision and per
   place (towns and CDPs), against our door points counted inside each shape (Census TIGERweb ACS 2024 boundaries).
   An ESTIMATE: the Census counts units (a townhome row is several), our doors are owner-occupied homes from the walk lists (rentals and
   PO-box owners are left out on purpose), so even a fully built town shows a gap.
     node group1-gaps.mjs     writes group1-gaps.json and prints the table GROUP1-PLAN is written from                              */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), DATA = join(HERE, '..', '..', 'app', 'data', 'rounds');
const KEY = readFileSync(join(HERE, 'census-key.txt'), 'utf8').trim();
const COUNTIES = { '001': 'Adams', '005': 'Arapahoe', '013': 'Boulder', '014': 'Broomfield', '031': 'Denver', '035': 'Douglas', '041': 'El Paso', '059': 'Jefferson', '123': 'Weld' };
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
const acs = async (forg, inn) => { const j = await get(`https://api.census.gov/data/2024/acs/acs5?get=NAME,B25024_002E,B25024_003E&for=${encodeURIComponent(forg)}&in=${encodeURIComponent(inn)}&key=${KEY}`); const h = j[0]; return j.slice(1).map((r) => ({ name: r[0], n: +r[1] + +r[2], geo: r.slice(3).join('') })); };
const ccd = []; for (const c of Object.keys(COUNTIES)) for (const r of await acs('county subdivision:*', 'state:08 county:' + c)) ccd.push({ ...r, county: c });
const plc = await acs('place:*', 'state:08');
/* shapes */
const cWhere = `STATE='08' AND COUNTY IN (${Object.keys(COUNTIES).map((c) => `'${c}'`).join(',')})`;
const ccdS = await shapes(22, cWhere);
const allPl = (await shapes(28, "STATE='08'", 'GEOID,NAME,STATE')).concat(await shapes(30, "STATE='08'", 'GEOID,NAME,STATE'));
/* our door points */
const pts = []; const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8')).regions.filter((r) => !r.metro && r.group !== 'dfw');
for (const r of idx) { let j; try { j = JSON.parse(readFileSync(join(DATA, r.key + '.json'), 'utf8')); } catch { continue; } for (const a of j.areas) for (const d of a.doors) if (typeof d.lat === 'number') pts.push([d.lon, d.lat, r.key]); }
const inCounty = (x, y) => ccdS.find((s) => inShape(x, y, s));
const cnt = new Map(), towns = new Map();
for (const [x, y, t] of pts) {
  const s = ccdS.find((q) => inShape(x, y, q)); if (s) cnt.set(s.geoid, (cnt.get(s.geoid) || 0) + 1);
  const p = allPl.find((q) => inShape(x, y, q)); if (p) { cnt.set('p' + p.geoid, (cnt.get('p' + p.geoid) || 0) + 1); const m = towns.get(p.geoid) || {}; m[t] = (m[t] || 0) + 1; towns.set(p.geoid, m); }
}
/* places inside the nine counties: by the subdivision holding the place's middle */
const plIn = allPl.map((p) => { const cx = (p.bb[0] + p.bb[2]) / 2, cy = (p.bb[1] + p.bb[3]) / 2; const s = ccdS.find((q) => inShape(cx, cy, q)); return s ? { ...p, county: s.county } : null; }).filter(Boolean);
const plN = new Map(plc.map((r) => [r.geo.slice(2), r]));
const rows = { ccd: ccd.map((r) => ({ county: COUNTIES[r.county], name: r.name.split(',')[0], census: r.n, doors: cnt.get('08' + r.county + r.geo.slice(-5)) || 0 })),
  places: plIn.map((p) => ({ county: COUNTIES[p.county], name: p.name, census: (plN.get(p.geoid.slice(2)) || {}).n || 0, doors: cnt.get('p' + p.geoid) || 0, ourTowns: towns.get(p.geoid) || {} })) };
for (const k of ['ccd', 'places']) for (const r of rows[k]) r.gap = Math.max(0, r.census - r.doors);
writeFileSync(join(HERE, 'group1-gaps.json'), JSON.stringify(rows, null, 1));
const byC = {}; for (const r of rows.ccd) { const c = byC[r.county] ||= { census: 0, doors: 0 }; c.census += r.census; c.doors += r.doors; }
console.log('county census doors gap'); for (const [c, v] of Object.entries(byC)) console.log(c, v.census, v.doors, v.census - v.doors);
console.log('\nplaces with no town of ours, biggest gap:'); for (const r of rows.places.filter((r) => !Object.keys(r.ourTowns).length).sort((a, b) => b.gap - a.gap).slice(0, 40)) console.log(`${r.county} | ${r.name} | census ${r.census} | doors ${r.doors}`);
console.log('\nsubdivisions, biggest gap:'); for (const r of rows.ccd.sort((a, b) => b.gap - a.gap).slice(0, 30)) console.log(`${r.county} | ${r.name} | census ${r.census} | doors ${r.doors} | gap ${r.gap}`);

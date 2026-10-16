/* Census Designated Place boundaries (TIGERweb) saved as <slug>-cdp.json ([{ rings, bb }]) for build-walklist-co.mjs --pieces, plus a
   centre and radius that covers each place. 2026-10-15 (Matthew: "our focus right now should be a 45 mile radius around englewood"):
   the unincorporated places inside it. Census servers only, so it can run beside a job on the state's parcel service.
   Run: node fetch-cdp.mjs "Roxborough Park" "Evergreen" ...   (writes files, prints slug lat lon radius) */
import { writeFileSync } from 'node:fs';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const name of process.argv.slice(2)) {
  const q = new URLSearchParams({ where: `STATE='08' AND BASENAME='${name.replace(/'/g, "''")}'`, outFields: 'NAME', outSR: '4326', f: 'json', returnGeometry: 'true' });
  let j = null;
  for (let k = 0; k < 3 && !j; k++) { try { const r = await fetch(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/5/query?${q}`); j = await r.json(); } catch (e) { await new Promise((z) => setTimeout(z, 1500)); } }
  const pieces = ((j && j.features) || []).filter((f) => f.geometry && f.geometry.rings).map((f) => { const all = f.geometry.rings.flat(); return { rings: f.geometry.rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] }; });
  if (!pieces.length) { console.log(`NONE ${name}`); continue; }
  const bb = [Math.min(...pieces.map((p) => p.bb[0])), Math.min(...pieces.map((p) => p.bb[1])), Math.max(...pieces.map((p) => p.bb[2])), Math.max(...pieces.map((p) => p.bb[3]))];
  const lat = (bb[1] + bb[3]) / 2, lon = (bb[0] + bb[2]) / 2;
  const r = Math.max((bb[3] - bb[1]) * 69, (bb[2] - bb[0]) * 69 * Math.cos(lat * Math.PI / 180)) / 2 * 1.15;   /* half the longer side, with a margin */
  writeFileSync(`${slug(name)}-cdp.json`, JSON.stringify(pieces));
  console.log(`${slug(name)} ${lat.toFixed(4)} ${lon.toFixed(4)} ${Math.max(0.8, r).toFixed(2)}`);
}

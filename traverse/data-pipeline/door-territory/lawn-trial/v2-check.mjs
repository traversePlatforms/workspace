// Yard v2 on a few lots by point, to compare with someone's own measurement (2026-10-25: Jen's four Lakewood quotes).
//   node v2-check.mjs "label|lat|lon" ...   -> one JSON line per lot
import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
const P = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
for (const a of process.argv.slice(2)) {
  const [label, lat, lon] = a.split('|');
  try {
    const j = await (await fetch(P + '?' + new URLSearchParams({ f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd', geometryPrecision: '7' }))).json();
    const f = (j.features || [])[0]; if (!f) { console.log(JSON.stringify({ label, error: 'no lot at the point' })); continue; }
    const R = yardClassify(await yardSources(f.geometry.rings), V2);
    console.log(JSON.stringify({ label, situs: f.attributes.situsAdd, lot: R.lot, lawn: R.lawn, seen: R.seen, under: R.under, open: R.open, trees: R.trees, drcogTurf: R.drcogTurf, photo23: R.photo23 }));
  } catch (e) { console.log(JSON.stringify({ label, error: String(e.message).slice(0, 100) })); }
}

/* Lot lines for Claire's 25 lawns (2026-11-21): one point query each on the state parcel layer (lotFor in yard-scan-v2.mjs, 1.5 s apart),
   written as a Google Earth Pro file: a yellow outline and a pin per house, numbered as in her list. Read-only on the parcel layer. */
import { readFileSync, writeFileSync } from 'node:fs';
const [, , LOTS, OUT, LIB] = process.argv;
const { lotFor } = await import('file:///' + LIB.replace(/\\/g, '/'));
const L = JSON.parse(readFileSync(LOTS, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pm = [];
for (let i = 0; i < L.length; i++) {
  const x = L[i]; let rings = null;
  try { rings = await lotFor(x.address, x.region); } catch (e) { console.error(x.address + ': ' + e.message); }
  x.lotLine = !!rings;
  console.error((i + 1) + ' ' + x.address + ': ' + (rings ? 'lot line' : 'no lot line'));
  const name = (i + 1) + '. ' + x.address;
  pm.push(`<Placemark><name>${esc(name)}</name><styleUrl>#pin</styleUrl><Point><coordinates>${x.lon},${x.lat},0</coordinates></Point></Placemark>`);
  if (rings) pm.push(`<Placemark><name>${esc(name)} (lot line)</name><styleUrl>#lot</styleUrl>${rings.length > 1 ? '<MultiGeometry>' : ''}${rings.map((r) => `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${r.map((p) => p[0] + ',' + p[1] + ',0').join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).join('')}${rings.length > 1 ? '</MultiGeometry>' : ''}</Placemark>`);
  await new Promise((ok) => setTimeout(ok, 1500));
}
writeFileSync(OUT, `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Lawns to measure (Claire, first 25)</name>
<description>Lot lines from Colorado's public parcel map (county records). They can be a few feet out, more on rural lots: trust the fence and the grass, not the line.</description>
<Style id="lot"><LineStyle><color>ff00ffff</color><width>2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
<Style id="pin"><IconStyle><scale>0.9</scale></IconStyle></Style>
${pm.join('\n')}
</Document></kml>
`);
writeFileSync(LOTS, JSON.stringify(L, null, 1));

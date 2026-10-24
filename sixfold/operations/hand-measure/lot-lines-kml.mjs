/* The lot lines of the houses Matthew is measuring by hand, as a KML file for Google Earth (2026-10-22, Matthew: "I am trying to get
   the property lines for the properties i need to measure so i can try and be as accurate as possible"). Each lot is a yellow outline
   with its address, town and lot size; open the file in Google Earth (Projects, then Import KML file) and trace the grass inside the
   line. Lot lines from the Colorado statewide parcel layer (the county records); no imagery is read here.
     node lot-lines-kml.mjs > lot-lines.kml                                                                                       */
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const LOTS = [
  ['6595 ZINNIA ST', 'Arvada', 'lead'], ['3247 OAK LEAF PL', 'Highlands Ranch', 'lead'], ['7006 E 131ST WAY', 'Thornton', 'lead'],
  ['7614 E 121ST PL', 'Thornton', 'lead'], ['579 E 76TH AVE', 'Welby', 'lead'], ['3852 PRIMROSE LN', 'Castle Rock', 'lead'],
  ['375 LEFTHAND CANYON DR', 'Boulder', 'lead'], ['6049 W ROXBURY PL', 'Columbine', 'lead'], ['6431 S CEDAR ST', 'Littleton', 'lead'],
  ['6916 S ELATI ST', 'Littleton', 'lead'],
  ['600 HIDDENBROOK CT', 'Highlands Ranch', 'check'], ['9267 CANYON WREN CT', 'Highlands Ranch', 'check'], ['852 HUGHES LN', 'Highlands Ranch', 'check'], ['9416 DESERT WILLOW TRL', 'Highlands Ranch', 'check'],
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const area = (ring, lat) => { const k = Math.cos(lat * Math.PI / 180), R = 6378137, d = Math.PI / 180; let a = 0; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; a += (x1 * d * R * k) * (y2 * d * R) - (x2 * d * R * k) * (y1 * d * R); } return Math.abs(a / 2) * 10.7639; };
const marks = [], missed = [];
for (const [addr, town, kind] of LOTS) {
  const j = await (await fetch(PARCELS + '?' + new URLSearchParams({ f: 'json', where: `UPPER(situsAdd) = '${addr}'`, outFields: 'situsAdd,sitAddCty', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7' }))).json();
  let f = (j.features || []); if (f.length > 1) f = f.filter((x) => String(x.attributes.sitAddCty || '').toUpperCase().includes(town.toUpperCase().split(' ')[0])).concat(f).slice(0, 1);
  f = f[0]; if (!f) { missed.push(addr + ', ' + town); continue; }
  const rings = f.geometry.rings, lat = rings[0][0][1], sq = Math.round(rings.reduce((s, r) => s + area(r, lat), 0) / 10) * 10;
  const coords = (r) => r.map(([x, y]) => x + ',' + y + ',0').join(' ');
  marks.push(`<Placemark><name>${esc(addr)}</name><description>${esc(town)} · lot ${sq.toLocaleString('en-US')} sq ft (${(sq / 43560).toFixed(2)} acre) · ${kind === 'lead' ? 'Pipeline lead' : 'method check (optional)'}. Trace the grass inside the ${kind === 'lead' ? 'yellow' : 'purple'} line.</description><styleUrl>#${kind}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(rings[0])}</coordinates></LinearRing></outerBoundaryIs>${rings.slice(1).map((r) => `<innerBoundaryIs><LinearRing><coordinates>${coords(r)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon></Placemark>`);
  console.error(addr + ' | ' + (f.attributes.sitAddCty || '') + ' | ' + sq + ' sq ft');
}
if (missed.length) console.error('NOT FOUND: ' + missed.join('; '));
process.stdout.write(`<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Lots to measure (2026-10-22)</name>
<Style id="lead"><LineStyle><color>ff00ffff</color><width>3</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
<Style id="check"><LineStyle><color>ffff00ff</color><width>3</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>
${marks.join('\n')}
</Document></kml>\n`);

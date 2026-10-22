/* Local businesses like Peak's current sponsors, within 5 miles of Chapel Hills Mall, from OpenStreetMap (ODbL). */
const j = require(process.argv[2] || './osm-chapel.json'), fs = require('fs');
const M = [38.9475, -104.7956];
const W = { 'healthcare=physiotherapist': [3, 'Physical therapy'], 'healthcare=rehabilitation': [3, 'Rehab / therapy'], 'healthcare=alternative': [3, 'Chiropractic / alternative care'], 'shop=massage': [3, 'Massage / recovery'],
  'shop=sports': [3, 'Sporting goods'], 'shop=bicycle': [2, 'Bike shop'], 'shop=car': [3, 'Car dealer'], 'craft=roofer': [3, 'Home services'], 'craft=electrician': [3, 'Home services'], 'craft=window_construction': [3, 'Home services'],
  'office=construction_company': [2, 'Home services / construction'], 'shop=flooring': [3, 'Home services'], 'shop=kitchen': [2, 'Home improvement'], 'leisure=fitness_centre': [2, 'Fitness'],
  'amenity=dentist': [2, 'Dentist'], 'amenity=doctors': [2, 'Doctor’s office'], 'amenity=clinic': [2, 'Clinic'], 'healthcare=clinic': [2, 'Clinic'], 'healthcare=optometrist': [2, 'Eye care'], 'shop=optician': [2, 'Eye care'], 'shop=hearing_aids': [2, 'Hearing care'],
  'office=insurance': [2, 'Insurance'], 'office=estate_agent': [2, 'Realtor'], 'office=financial_advisor': [2, 'Financial advisor'], 'office=financial': [2, 'Financial'], 'amenity=bank': [2, 'Bank / credit union'],
  'amenity=restaurant': [2, 'Restaurant'], 'amenity=bar': [1, 'Bar'], 'amenity=pub': [1, 'Pub'], 'craft=brewery': [2, 'Brewery'], 'shop=furniture': [1, 'Furniture'], 'office=company': [1, 'Company office'] };
const SPONS = /phil long|whataburger|joey'?s|red rock pizz|stretch ?lab|prime iv|air o sport|cutting edge realt|choice floors|think smart|sourdough|integrity bank|monarch merch|salus|red oak|denver iconics|together won|whistle ?pig|hotel polaris|medicare mentors|rally back|dr\.? electric|hi-tech pdr|sign shop|orthopedic centers|occ\b/i;
const mi = (a, b) => { const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2; return 3958.8 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
const seen = new Set(), rows = [];
for (const e of j.elements) {
  const t = e.tags || {}, k = t.shop ? 'shop=' + t.shop : t.amenity ? 'amenity=' + t.amenity : t.healthcare ? 'healthcare=' + t.healthcare : t.leisure ? 'leisure=' + t.leisure : t.office ? 'office=' + t.office : t.craft ? 'craft=' + t.craft : '';
  if (!W[k] || !t.name) continue;
  if (SPONS.test(t.name)) continue;
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon; if (lat == null) continue;
  const key = t.name.toLowerCase().replace(/\b(pre-?owned|automotive|colorado springs|certified|llc|inc)\b/g, '').replace(/[^a-z0-9]/g, '') + '|' + W[k][1];   /* one row per business: 'Echopark' = 'EchoPark Automotive Colorado Springs' */
  const d = mi(M, [lat, lon]), chain = !!(t.brand || t['brand:wikidata']);
  const score = W[k][0] * 2 + (d < 2 ? 2 : d < 3.5 ? 1 : 0) + ((t.website || t['contact:website']) ? 1 : 0);
  const addr = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') + (t['addr:city'] ? ', ' + t['addr:city'] : '');
  rows.push({ name: t.name, kind: W[k][1], score, miles: Math.round(d * 10) / 10, chain, addr, phone: t.phone || t['contact:phone'] || '', web: t.website || t['contact:website'] || '', osm: `https://www.openstreetmap.org/${e.type}/${e.id}` });
}
rows.sort((a, b) => b.score - a.score || a.miles - b.miles);
fs.writeFileSync('lookalikes.json', JSON.stringify(rows, null, 1));
const by = {}; rows.forEach((r) => (by[r.kind] = (by[r.kind] || 0) + 1));
console.log(rows.length, 'businesses;', rows.filter((r) => !r.chain).length, 'not chains;', JSON.stringify(by));
rows.slice(0, 12).forEach((r) => console.log(r.score, r.miles + 'mi', r.kind, '|', r.name, r.chain ? '(chain)' : ''));

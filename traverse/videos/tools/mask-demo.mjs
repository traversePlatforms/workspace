// What the demo video may not show, masked in the page before anything is captured (2 Nov 2026), on the LOCAL demo copies only:
//  - homeowners' names -> "name hidden" (every owner in the demo town, kept in this process and the page, never written out)
//  - real street names -> made-up ones, house numbers -> made-up numbers of the same length and odd/even side
//    (2026-10-28, Matthew: "Swap it with a made up address and number")
//  - where the data comes from (the website rule, Matthew 2026-10-06): NOAA, radar estimate, county record, laser scan, Census, permit,
//    the power company's name, etc. are reworded or dropped
// leakCheck() lists anything that still got through, per scene, for the dry-run README.
import { readFileSync } from 'node:fs';

const FAKE_ROOTS = ['Ridge View', 'Pine Hollow', 'Granite', 'Juniper', 'Aspen Bluff', 'Meadowlark', 'Stone Creek', 'Prairie Sky', 'Willow Bend', 'Cedar Point',
  'Bluebird', 'Sage Brush', 'Elk Meadow', 'Fox Run', 'Quail Hollow', 'Red Fern', 'Silver Pine', 'Timber Ridge', 'Copper Leaf', 'Hawk Point', 'Larkspur Hill',
  'Mesa Verde', 'North Star', 'Old Mill', 'Painted Sky', 'Rock Creek', 'Sunset Ridge', 'Twin Peaks', 'Valley View', 'Wild Plum', 'Yarrow', 'Amber Field',
  'Birch Hollow', 'Canyon Wren', 'Dove Creek', 'Echo Ridge', 'Fern Gully', 'Glen Haven', 'High Plains', 'Iron Horse', 'Kestrel', 'Lodgepole', 'Morning Glory',
  'Nighthawk', 'Owl Creek', 'Pinyon', 'Raven Hill', 'Snowberry', 'Thistle Down', 'Upland', 'Vista Grande', 'Whisper Wind', 'Antelope', 'Buckskin', 'Cottonwood Bend'];
const SUFFIX = ['Ct', 'Dr', 'Ln', 'Way', 'Pl', 'Cir', 'Trl', 'Rd', 'Loop', 'St', 'Ave', 'Pkwy'];
/* source words, reworded the way the website's pictures were (shots.mjs), and everything else the app says about where a fact came from */
export const SCRUB = [
  /* whole phrases first */
  [/\(Census, the area not this house\)/g, '(the area, not this house)'], [/Census: the /g, 'The '], [/Area \(Census\)/g, 'Area'], [/ ?\(ACS 5-year[^)]*\)/g, ''],
  [/FEMA National Risk Index, this census tract/g, 'Storm and hazard risk for this area'], [/FEMA\u2019s rating compares this tract with every tract in the US\./g, 'The rating compares this area with the rest of the country.'],
  [/Records: [A-Za-z .]+ County, as of/g, 'As of'], [/Roof \((?:laser scan|measurement) (\d{4}), estimate\)/g, 'Roof ($1 estimate)'],
  [/Estimate: roof facing, slope and shade from the laser scan; sun data from PVWatts \(NREL, now NLR\) for this area,/g, 'Estimate: roof facing, slope and shade at the house, and the sun for this area,'],
  [/Solar \(estimate from the laser scan[^)]*\)/g, 'Solar (estimate)'], [/\(laser scan estimate\)/g, '(estimate)'], [/Measured by LiDAR/g, 'Measured'],
  [/Hail sizes are NOAA radar estimates/g, 'Hail sizes are estimates'], [/A storm day\u2019s hail path \(NOAA radar estimate\)/g, 'A storm day\u2019s hail path'],
  [/Radar estimate of the hail path/g, 'The hail path that day'], [/the weather radar estimated/g, 'was estimated'], [/Radar hail often reads/g, 'Estimated hail often reads'],
  [/NOAA NWS MRMS, about every 2 minutes/g, 'Updated about every 2 minutes'], [/NOAA weather radar/g, 'Weather radar'], [/Radar: NOAA NWS (?:MRMS|NEXRAD)/g, 'Radar'],
  [/Aerial photo, (\d{4}), about 1 ft a pixel \(USDA, public domain\)\./g, 'Aerial photo, $1.'], [/From a satellite canopy map, which misses some trees\./g, 'The tree map misses some trees.'],
  [/Greenness \(satellite, /g, 'Greenness ('], [/Yellow = the property line from county records/g, 'Yellow = the property line'], [/From the county record\./g, ''],
  [/USDA NAIP 2023 aerial photos \(public domain\), Microsoft Planetary Computer/g, ''], [/From the laser scan/g, 'From the house card'],
  /* permits: what was done, not where it was found */
  [/re-roof permits not on record here \(county record\)/g, ''], [/\(no re-roof permit since; county record, /g, '(no re-roof since; '],
  [/Last re-roof permit/g, 'Last re-roof'], [/Re-roof permit /g, 'Re-roofed '], [/No re-roof permit since/g, 'No re-roof since'], [/no re-roof permit on record since/g, 'no re-roof on record since'],
  [/No re-roof permit on record/g, 'No re-roof on record'], [/No re-roof permit/g, 'No re-roof on record'], [/No solar permit since/g, 'No solar since'], [/Solar permit /g, 'Solar since '],
  [/Permit in the last 2 years/g, 'Work in the last 2 years'], [/Building permits/g, 'Work on record'], [/\(permit(?:ted)? ([^)]*)\)/g, '(since $1)'], [/[Pp]ermitted /g, 'since '],
  [/(New building|Addition|Deck or patio cover|Fence|Irrigation|Landscaping|Pool) permit/g, '$1'], [/re-roof permit/gi, 're-roof'],
  /* the Lawn water screen's footer names its sources (and a file path) */
  [/Aeration and water: Colorado State University Extension[^]*$/, ''], [/ ?Sources and the fact-check log: \S+/g, ''],
  /* the Solar bill block cites the rate pages; the water and seed lines cite CSU */
  [/ ?\(Colorado PUC and Xcel[^)]*\)/g, ''], [/Xcel Energy/g, 'the power company'], [/Xcel’s/g, 'the power company’s'], [/\bXcel\b/g, 'the power company'], [/\bColorado PUC\b/g, 'the state'],
  [/ ?· CSU Extension\b/g, ''], [/CSU Extension: /g, ''], [/Colorado State University Extension/g, 'lawn experts'],
  /* a source shown as its own little label (the quote builder's "from the house card" tiles) */
  [/^(\s*)county record(\s*)$/, '$1on record$2'], [/^(\s*)county parcel(\s*)$/, '$1lot line$2'], [/^(\s*)aerial photo(\s*)$/, '$1photo$2'],
  /* single words and short asides */
  [/Lot size · county parcel/g, 'Lot size'], [/ · (?:county parcel|aerial photo|county record|laser scan)\b/g, ''],
  [/ ?\((?:county record|county|from the photo|photo\u2019s guess|NOAA reports|NOAA|radar estimate|NOAA radar estimate|spotter|Census[^)]*)\)/g, ''], [/\(county record, /g, '('],
  [/on the county record/g, 'on record'], [/county assessor public records/g, 'records'], [/county records/g, 'records'], [/County value/g, 'Home value'],
  [/radar estimate/gi, 'estimate'], [/\bNOAA\b ?/g, ''], [/\bNWS\b ?/g, ''], [/\bMRMS\b ?/g, ''], [/\bMESH\b ?/g, ''], [/\bFEMA\b ?/g, ''], [/\bUSDA\b ?/g, ''], [/\bNAIP\b ?/g, ''],
  [/\bPVWatts\b ?/g, ''], [/ ?\(NREL, now NLR\)/g, ''], [/\b(?:NREL|NLR)\b ?/g, ''], [/laser scans?/gi, 'measurement'], [/\bLiDAR\b|\blidar\b/g, 'measured'], [/\bassessor\b/gi, 'records'],
  [/\bcensus tract\b/gi, 'area'], [/\bCensus\b ?/g, ''], [/\bSatellite\b/g, 'Aerial'], [/\bsatellite\b/g, 'aerial'],
];
export const SOURCE_WORDS = /\b(NOAA|NWS|MRMS|radar estimate|county record|assessor|LiDAR|lidar|laser|satellite|FEMA|permits? on record|building permits?|re-roof permit|solar permit|Census|Extension|research\/|USDA|NAIP|NREL|NLR|PVWatts|Xcel|Planetary|Sixfold|Surge|365 Aeration)\b/i;

export function buildMask(townFile, extra = {}) {
  const T = JSON.parse(readFileSync(townFile, 'utf8'));
  const owners = new Set(), streets = new Set();
  for (const a of T.areas) for (const d of a.doors) {
    if (d.owner) owners.add(String(d.owner).trim().toUpperCase());
    const m = String(d.address || '').match(/^\d+[A-Z]?\s+(.+)$/); if (m) streets.add(m[1].trim().toUpperCase());
  }
  for (const a of T.areas) { const m = String(a.name).match(/^(.+?)(?: \d+–\d+)?$/); if (m && /\s(CT|DR|LN|WAY|PL|CIR|TRL|RD|LOOP|ST|AVE|PKWY|BLVD|TER|HTS|PT|XING|LANE|PATH|ROW|SQ|GRV|RUN|CV|VW|BND|PASS)$/.test(m[1])) streets.add(m[1]); }
  const fakes = []; for (const s of SUFFIX) for (const r of FAKE_ROOTS) fakes.push(r + ' ' + s);
  const real = new Set([...streets].map((s) => s.toLowerCase()));
  const pool = fakes.filter((f) => !real.has(f.toLowerCase()));
  const map = {}; let k = 0; for (const s of [...streets].sort()) map[s.toLowerCase()] = pool[(k++ * 7) % pool.length];
  /* the long form too ("Elk Run Drive"), as some screens and the map write it */
  const LONG = { DR: 'DRIVE', LN: 'LANE', CT: 'COURT', PL: 'PLACE', CIR: 'CIRCLE', TRL: 'TRAIL', RD: 'ROAD', ST: 'STREET', AVE: 'AVENUE', PKWY: 'PARKWAY', BLVD: 'BOULEVARD', TER: 'TERRACE' };
  for (const s of streets) { const m = s.match(/^(.+) (\w+)$/); if (m && LONG[m[2]]) map[(m[1] + ' ' + LONG[m[2]]).toLowerCase()] = map[s.toLowerCase()]; }
  const utilities = extra.utilities || [];
  return { owners: [...owners], map, utilities };
}

/* the page side: runs before the app's own code in every frame (Page.addScriptToEvaluateOnNewDocument) */
export function maskScript(M) {
  return `(() => {
  const OWN = new Set(${JSON.stringify(M.owners)}), MAP = new Map(Object.entries(${JSON.stringify(M.map)})), UTIL = ${JSON.stringify(M.utilities)};
  const SCRUB = [${SCRUB.map(([re, to]) => `[${re.toString()}, ${JSON.stringify(to)}]`).join(',')}];
  const NUM = (n) => { const v = parseInt(n, 10), d = String(n).length; if (d < 2) return String(n); const lo = 10 ** (d - 1), span = 9 * lo; let x = ((v - lo + 2468) % span) + lo; if (x % 2 !== v % 2) x = x + 1 >= lo + span ? x - 1 : x + 1; return String(x); };
  const caseLike = (orig, fake) => orig === orig.toUpperCase() && /[A-Z]/.test(orig) ? fake.toUpperCase() : fake;
  const TOK = /[^\\s,\\u00b7()\\[\\]:;"]+/g;
  function streets(s) {
    const t = []; let m; TOK.lastIndex = 0; while ((m = TOK.exec(s))) t.push([m.index, m.index + m[0].length, m[0]]);
    if (!t.length) return s; let out = '', at = 0;
    for (let i = 0; i < t.length; i++) {
      let hit = 0;
      for (let L = Math.min(6, t.length - i); L >= 1; L--) {
        const a = t[i][0], b = t[i + L - 1][1], seg = s.slice(a, b);
        if (/[,\\u00b7()]/.test(seg) || /\\s{2,}/.test(seg)) continue;
        const f = MAP.get(seg.toLowerCase()); if (!f) continue;
        let from = a; const prev = t[i - 1];
        if (prev && /^\\d{1,6}[A-Za-z]?$/.test(prev[2]) && /^\\s+$/.test(s.slice(prev[1], a)) && prev[0] >= at) { out += s.slice(at, prev[0]) + NUM(prev[2].match(/\\d+/)[0]) + s.slice(prev[1], a); from = a; at = a; }
        out += s.slice(at, a) + caseLike(seg, f); at = b;
        const nx = t[i + L]; if (nx && /^\\d+\\u2013\\d+$/.test(nx[2]) && /^\\s+$/.test(s.slice(b, nx[0]))) { out += s.slice(b, nx[0]) + nx[2].split('\\u2013').map(NUM).join('\\u2013'); at = nx[1]; i++; }
        hit = L; break;
      }
      if (hit) i += hit - 1;
    }
    return out + s.slice(at);
  }
  function owners(s) {
    if (s.indexOf('Owner: ') >= 0) s = s.replace(/Owner: (?!name hidden)[^\\u00b7\\n]+/g, 'Owner: name hidden');
    return s.replace(/[A-Z][A-Z0-9 .,&'\\/-]*[A-Z.]/g, (r) => { const x = r.trim(); return OWN.has(x) ? r.replace(x, 'name hidden') : r; });
  }
  function fix(s) {
    if (!s || !/[A-Za-z]/.test(s)) return s;
    let v = owners(s); v = streets(v);
    for (const u of UTIL) if (v.indexOf(u) >= 0) v = v.split(u).join('Local power company');
    for (const [re, to] of SCRUB) v = v.replace(re, to);
    return v;
  }
  window.__demoFix = fix;
  const CODE = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/;
  const fixNode = (n) => { if (n.parentNode && CODE.test(n.parentNode.nodeName)) return; const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
  const fixAttrs = (e) => { for (const a of ['placeholder', 'title', 'aria-label', 'value']) { if (a === 'value' && !(e.tagName === 'INPUT' && /^(text|search|)$/.test(e.type || ''))) continue; const x = e.getAttribute && e.getAttribute(a); if (x) { const v = fix(x); if (v !== x) e.setAttribute(a, v); } } };
  const walk = (root) => { const tw = document.createTreeWalker(root, 5); let n = root.nodeType === 1 ? root : null; if (n) fixAttrs(n); while ((n = tw.nextNode())) n.nodeType === 3 ? fixNode(n) : CODE.test(n.nodeName) ? null : fixAttrs(n); };
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fixNode(m.target); else if (m.type === 'attributes') fixAttrs(m.target); else m.addedNodes.forEach((n) => { if (n.nodeType === 3) fixNode(n); else if (n.nodeType === 1 && !CODE.test(n.nodeName)) walk(n); }); } })
    .observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  document.addEventListener('DOMContentLoaded', () => { walk(document.documentElement);
    const css = document.createElement('style'); css.textContent = '.leaflet-control-attribution a[href*="leafletjs"]{display:none}'; document.head.appendChild(css); });
})();`;
}

/* after a capture: what is on screen that should not be (owner names, real streets, source words). Runs in the page. */
export function leakExpr(M) {
  return `(() => { const docs = [document, ...[...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument; } catch (e) { return null; } }).filter(Boolean)];
    const t = docs.map((d) => d.body ? d.body.innerText : '').join('\\n'); const out = [];
    const up = t.match(/[A-Z][A-Z0-9 .,&'\\/-]*[A-Z.]/g) || []; const own = new Set(${JSON.stringify(M.owners)});
    if (up.some((x) => own.has(x.trim()))) out.push('an owner name');
    const low = t.toLowerCase(); const st = ${JSON.stringify(Object.keys(M.map).filter((s) => s.split(' ').length >= 2 && s.length >= 8))};
    const hit = st.find((s) => new RegExp('\\\\b' + s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b').test(low)); if (hit) out.push('a real street (' + hit + ')');
    const sw = t.match(${SOURCE_WORDS.toString()}); if (sw) out.push('source/client word: ' + sw[0]);
    return out; })()`;
}

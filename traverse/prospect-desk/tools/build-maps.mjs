/* City maps for the Prospect Desk's "With map" emails (2026-10-30, Matthew: "With it just being plain text it reads as a phishing
 * scam ... I am fine with trying out a halfway [version]"). One picture per city and trade family, from our own data:
 *   hail  (Roofing, Roofing and solar, Solar): this year's radar hail paths over the city, and how many homes sit under 1 in or more
 *   moved (Pest, Security): homes sold in the last 12 months, counted in squares of about half a kilometre
 *   lawn  (Lawn and yards): homes with an estimated lawn of 5,000 sq ft or more, counted the same way
 * Nothing on a map picks out a house: hail is drawn on the radar's own ~1 km grid, and the counts are squares of at least ~450 m with
 * 3 homes or more (fewer are left off the picture but still counted in the caption). No names, addresses or door ids leave this script.
 * Basemap: our own drawing of the homes (light squares where homes are) and U.S. Census TIGER/Line roads (public domain), no tiles.
 *
 *   node traverse/prospect-desk/tools/build-maps.mjs [--only=denver,arvada] [--fam=hail,moved,lawn]
 *
 * Reads the door files in the MAIN tree's traverse/app/data/rounds (gitignored; ROUNDS_DATA overrides) and the county road files in
 * data-pipeline/door-territory/security/cache/tiger. Writes app/m/<fam>-<city>-<yyyymmdd>.png (1200 x 840, shown at 560 wide) and
 * app/m/maps.json (the captions and counts desk.php reads). A city with too little data gets no map: its email goes plain. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const TRAV = resolve(HERE, '..', '..');
const MAIN = process.env.TRAVERSE_ROOT || 'C:/Users/Surge Inc/Desktop/claude test 2/traverse';   /* the data lives only in the main tree */
const DATA = process.env.ROUNDS_DATA || join(MAIN, 'app', 'data', 'rounds');
const TIGER = join(MAIN, 'data-pipeline', 'door-territory', 'security', 'cache', 'tiger');
const OUT = join(TRAV, 'prospect-desk', 'app', 'm');
const require = createRequire(join(TRAV, '..', 'package.json'));
const sharp = require('sharp');
const { countyFiles, readRoads } = await import(pathToFileURL(join(TRAV, 'data-pipeline', 'door-territory', 'security', 'tiger-roads.mjs')).href);

const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1] || '';
const ONLY = new Set(arg('only').split(',').filter(Boolean));
const FAMS = arg('fam') ? arg('fam').split(',') : ['hail', 'moved', 'lawn'];
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const W = 1200, MH = 720, BAND = 120, H = MH + BAND;
const OUTW = +(process.env.MAP_OUTW || 840), COLOURS = +(process.env.MAP_COLOURS || 64), LOCAL = process.env.MAP_LOCAL === '1';   /* drawn at 1200, saved at 840 (1.5 x the 560 it shows at) */
const MIN_DOORS = 300, MIN_CELL = 3, BIG_LAWN = 5000, HAIL_MIN = 1.0;
const C = { navy: '#13294B', flag: '#D6400C', ink: '#0F1B2D', muted: '#566476', line: '#DCE2EA', paper: '#F4F6F9', homes: '#CBD3DE' };
const SCALE = {
  hail: { cols: ['#FCD9C4', '#F6A378', '#E3632D', '#A8360B'], cuts: [0.75, 1, 1.5, 2], labels: ['\u00be\u20131 in', '1\u20131\u00bd in', '1\u00bd\u20132 in', '2 in +'] },
  moved: { cols: ['#C9D6EA', '#8AA6D1', '#44689F', '#13294B'] },
  lawn: { cols: ['#D4EAD0', '#9FD09A', '#5BA65A', '#2E6B33'] },
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayName = (iso) => +iso.slice(8, 10) + ' ' + MON[+iso.slice(5, 7) - 1];
const monName = (ym) => MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
const fmt = (n) => n.toLocaleString('en-US');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const jr = (f) => JSON.parse(readFileSync(f, 'utf8'));

/* cities as companies write them: one town file each, except Colorado Springs (four) and Denver (Denver + South Denver) */
function cities() {
  const R = jr(join(DATA, 'index.json')).regions;
  const by = new Map();
  for (const r of R) {
    if (r.group === 'dfw' || /\(rural\)/.test(r.label) || !existsSync(join(DATA, r.key + '.json'))) continue;
    const name = r.key.startsWith('cs-') ? 'Colorado Springs' : r.key === 'south-denver' ? 'Denver' : r.label;
    if (!by.has(name)) by.set(name, []);
    by.get(name).push(r.key);
  }
  return [...by].map(([name, keys]) => ({ name, key: slug(name), keys })).filter((c) => !ONLY.size || ONLY.has(c.key));
}
function doorsOf(keys) {
  const seen = new Set(), out = [];
  for (const k of keys) {
    const d = jr(join(DATA, k + '.json'));
    for (const a of d.areas) for (const x of a.doors) {
      if (!x.lat || !x.lon || seen.has(x.id)) continue;
      seen.add(x.id);
      out.push({ id: x.id, k, lat: x.lat, lon: x.lon, lawn: x.lawn && typeof x.lawn.sq === 'number' ? x.lawn.sq : null });
    }
  }
  return out;
}
/* the frame: the middle 96% of the homes, padded, at 1200 x 720, never tighter than 4 km across */
function frame(doors) {
  const la = doors.map((d) => d.lat).sort((a, b) => a - b), lo = doors.map((d) => d.lon).sort((a, b) => a - b);
  const q = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
  let s = q(la, 0.02), n = q(la, 0.98), w = q(lo, 0.02), e = q(lo, 0.98);
  const lat0 = (s + n) / 2, k = Math.cos(lat0 * Math.PI / 180);
  let spanX = Math.max((e - w) * k, 0.036) * 1.12, spanY = Math.max(n - s, 0.02) * 1.12;   /* degrees of latitude */
  if (spanX / spanY > W / MH) spanY = spanX * MH / W; else spanX = spanY * W / MH;
  const cx = (w + e) / 2, cy = lat0;
  const f = { s: cy - spanY / 2, n: cy + spanY / 2, w: cx - spanX / k / 2, e: cx + spanX / k / 2 };
  f.x = (lon) => ((lon - f.w) / (f.e - f.w)) * W;
  f.y = (lat) => ((f.n - lat) / (f.n - f.s)) * MH;
  f.kmAcross = spanX * 111.32;
  return f;
}
/* the roads in the frame, from every county file whose box touches it */
let COUNTIES = null; const ROADCACHE = new Map();
function roads(f) {
  COUNTIES ||= countyFiles(TIGER);
  const out = { major: [], minor: [], local: [] };
  for (const cf of COUNTIES) {
    const [x0, y0, x1, y1] = cf.box; if (x1 < f.w || x0 > f.e || y1 < f.s || y0 > f.n) continue;
    if (!ROADCACHE.has(cf.name)) ROADCACHE.set(cf.name, readRoads(cf).filter((r) => /^S1(100|200|400|630)$/.test(r.c)).map((r) => ({ c: r.c, lines: r.lines })));
    for (const r of ROADCACHE.get(cf.name)) for (const ln of r.lines) {
      let inb = false; for (const [lon, lat] of ln) if (lon >= f.w && lon <= f.e && lat >= f.s && lat <= f.n) { inb = true; break; }
      if (!inb) continue;
      const d = 'M' + ln.map(([lon, lat]) => f.x(lon).toFixed(1) + ' ' + f.y(lat).toFixed(1)).join('L');
      (r.c === 'S1100' ? out.major : r.c === 'S1400' ? out.local : out.minor).push(d);
    }
  }
  return out;
}
/* squares in the frame: cell size in degrees of latitude; returns Map key -> {r, c, n} */
function grid(f, pts, cellLat) {
  const k = Math.cos(((f.s + f.n) / 2) * Math.PI / 180), cellLon = cellLat / k, m = new Map();
  for (const p of pts) {
    const r = Math.floor((f.n - p.lat) / cellLat), c = Math.floor((p.lon - f.w) / cellLon), key = r * 100000 + c;
    const g = m.get(key); if (g) g.n++; else m.set(key, { r, c, n: 1 });
  }
  return { m, rect: (g) => [f.x(f.w + g.c * cellLon), f.y(f.n - g.r * cellLat), f.x(f.w + (g.c + 1) * cellLon), f.y(f.n - (g.r + 1) * cellLat)] };
}
const rectS = ([x0, y0, x1, y1], fill, extra = '') => `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(x1 - x0 + 0.6).toFixed(1)}" height="${(y1 - y0 + 0.6).toFixed(1)}" fill="${fill}"${extra}/>`;
const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="${C.navy}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
  + [[9, 47], [24, 31], [37, 40]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="5.2" fill="#fff" stroke="${C.navy}" stroke-width="3.6"/>`).join('') + `<circle cx="53" cy="17" r="8" fill="${C.flag}"/></g>`;
/* text that fits: shrink the size until an Arial estimate fits the width */
const fit = (t, size, maxW, bold) => { let s = size; while (s > 14 && t.length * s * (bold ? 0.56 : 0.5) > maxW) s -= 1; return s; };

function svgFor(f, base, layer, legend, cap, sub, townName) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs><clipPath id="m"><rect width="${W}" height="${MH}"/></clipPath></defs>`,
    `<rect width="${W}" height="${H}" fill="#FFFFFF"/><g clip-path="url(#m)"><rect width="${W}" height="${MH}" fill="${C.paper}"/>`,
    `<g fill="${C.homes}">${base.homes}</g>`, `<g opacity="0.8">${layer}</g>`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    (LOCAL ? `<path d="${base.rd.local.join('')}" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="1.1"/>` : ''),
    `<path d="${base.rd.minor.join('')}" stroke="#8B97A8" stroke-width="2.4"/>`,
    `<path d="${base.rd.major.join('')}" stroke="#6F7C8F" stroke-width="5.5"/><path d="${base.rd.major.join('')}" stroke="#FFFFFF" stroke-width="2.6"/>`,
    `</g></g>`];
  /* the town's name and the key, top left, on a white card */
  /* big enough to read at 560 px wide (about half size) */
  const rows = legend.rows, tl = legend.title;
  const lw = Math.max(240, townName.length * 21 + 40, tl.length * 11.5 + 40, ...rows.map(([, l]) => l.length * 13 + 86));
  const lh = 104 + 36 * rows.length;
  parts.push(`<rect x="18" y="18" width="${lw}" height="${lh}" rx="12" fill="#FFFFFF" fill-opacity="0.94" stroke="${C.line}"/>`,
    `<text x="36" y="60" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="${C.navy}">${esc(townName)}</text>`,
    `<text x="36" y="92" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="${C.muted}">${esc(tl)}</text>`);
  rows.forEach(([col, label], i) => parts.push(`<rect x="36" y="${108 + 36 * i}" width="34" height="26" rx="4" fill="${col}" stroke="#00000022"/>`,
    `<text x="82" y="${129 + 36 * i}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${C.ink}">${esc(label)}</text>`));
  /* the band: the fact, its source, our mark */
  const capS = fit(cap, 36, W - 150, true), subS = fit(sub, 21, W - 150, false);
  parts.push(`<rect y="${MH}" width="${W}" height="1.5" fill="${C.line}"/>`,
    `<text x="28" y="${MH + 52}" font-family="Arial, Helvetica, sans-serif" font-size="${capS}" font-weight="700" fill="${C.ink}">${esc(cap)}</text>`,
    `<text x="28" y="${MH + 92}" font-family="Arial, Helvetica, sans-serif" font-size="${subS}" fill="${C.muted}">${esc(sub)}</text>`,
    mark(W - 100, MH + 24, 1.15), `</svg>`);
  return parts.join('');
}

/* class breaks for counts per square: 3 and up, split into four by the squares' own spread */
function breaks(vals) {
  const v = vals.filter((x) => x >= MIN_CELL).sort((a, b) => a - b); if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  const b = [MIN_CELL, Math.max(MIN_CELL + 1, q(0.5)), Math.max(MIN_CELL + 2, q(0.8)), Math.max(MIN_CELL + 3, q(0.95))];
  for (let i = 1; i < 4; i++) if (b[i] <= b[i - 1]) b[i] = b[i - 1] + 1;
  return b;
}

let PATHS = null;
function hailLayer(c, f, doors) {
  PATHS ||= jr(join(DATA, 'hail-paths.json'));
  const P = PATHS, best = new Map(); let first = '', last = '';
  for (const [d, cells] of Object.entries(P.paths)) {
    if (!d.startsWith('2026')) continue;
    let any = false;
    for (const [rr, cc, v] of cells) {
      const row = P.r0 + rr, col = P.c0 + cc, lat = P.lat1 - row * P.dy, lon = P.lon1 + col * P.dx - 360;
      if (lat < f.s - 0.01 || lat > f.n + 0.01 || lon < f.w - 0.01 || lon > f.e + 0.01) continue;
      const key = row * 100000 + col, inch = v / 100; if (inch > (best.get(key) || 0)) best.set(key, inch); any = true;
    }
    if (any) { if (!first || d < first) first = d; if (d > last) last = d; }
  }
  /* the homes under 1 in or more: the radar square the home sits in, on any 2026 day */
  let n = 0; const keys = new Set(c.keys);
  for (const d of doors) { const row = Math.round((P.lat1 - d.lat) / P.dy), col = Math.round((d.lon + 360 - P.lon1) / P.dx); if ((best.get(row * 100000 + col) || 0) >= HAIL_MIN) n++; }
  let through = '';
  for (const k of keys) { try { const h = jr(join(DATA, 'hail-' + k + '.json')); if (!through || h.through < through) through = h.through; } catch { return null; } }
  if (!through || !n) return null;
  const S = SCALE.hail, out = [];
  for (const [key, inch] of best) {
    const row = Math.floor(key / 100000), col = key % 100000, lat = P.lat1 - row * P.dy, lon = P.lon1 + col * P.dx - 360;
    let i = -1; for (let j = 0; j < S.cuts.length; j++) if (inch >= S.cuts[j]) i = j; if (i < 0) continue;
    out.push(rectS([f.x(lon - P.dx / 2), f.y(lat + P.dy / 2), f.x(lon + P.dx / 2), f.y(lat - P.dy / 2)], S.cols[i], ''));
  }
  const throughName = dayName(through) + ' ' + through.slice(0, 4);
  return {
    layer: out.join(''), legend: { title: 'Biggest hail this year (radar)', rows: S.cols.map((col, i) => [col, S.labels[i]]) }, n,
    cap: `${c.name} \u00b7 ${fmt(n)} homes in this year\u2019s hail paths (1 in or larger)`,
    sub: `Radar-estimated hail size, NOAA/NSSL MRMS, 1 Jan to ${throughName}. Streets: U.S. Census Bureau TIGER/Line.`,
    alt: `Map of ${c.name} with this year\u2019s radar hail paths shaded by hail size: ${fmt(n)} homes sat under hail of 1 inch or larger (NOAA radar estimate, 1 Jan to ${throughName}). No single home is shown.`,
    text: `${c.name} this year: ${fmt(n)} homes were under radar-estimated hail of 1 inch or larger (NOAA/NSSL MRMS, 1 Jan to ${throughName}).`,
    first, last, through,
  };
}
function movedLayer(c, f, doors) {
  const sold = new Map(), counties = {}; let asOf = '';
  for (const k of c.keys) {
    const fn = join(DATA, 'moved-' + k + '.json'); if (!existsSync(fn)) return null;
    const m = jr(fn); for (const [ck, v] of Object.entries(m.counties || {})) { counties[ck] = v[0]; if (!asOf || v[1] < asOf) asOf = v[1]; }
    for (const [id, v] of Object.entries(m.doors)) sold.set(id, v.slice(0, 7));
  }
  const inCity = doors.filter((d) => sold.has(d.id));
  if (!asOf || inCity.length < doors.length * 0.3) return null;   /* too few homes with a sale on record: the county does not publish enough */
  /* twelve whole months ending two months before the county's file date: recent deeds reach the county's file late (Arapahoe had 28
     September sales against ~250 a month before) */
  const ymOf = (v) => ((v / 12) | 0) + '-' + String(v % 12 + 1).padStart(2, '0');
  const end = +asOf.slice(0, 4) * 12 + +asOf.slice(5, 7) - 1 - 2, startYm = ymOf(end - 11), endYm = ymOf(end);
  const recent = doors.filter((d) => { const ym = sold.get(d.id); if (!ym) return false; const v = +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1; return v <= end && end - v < 12; });
  const cn = Object.values(counties).map((x) => /County/.test(x) ? x : x + ' County').sort().join(', ');
  return densityOut(c, f, recent, SCALE.moved, {
    cap: (n) => `${c.name} \u00b7 ${fmt(n)} homes sold, ${monName(startYm)} to ${monName(endYm)}`,
    sub: `Market sales on the county\u2019s own record (${cn}, file of ${monName(asOf)}). Streets: U.S. Census TIGER/Line.`,
    alt: (n) => `Map of ${c.name} shaded by how many homes sold in each half-kilometre square: ${fmt(n)} homes sold between ${monName(startYm)} and ${monName(endYm)} (${cn} records). No single home is shown.`,
    text: (n) => `${c.name}: ${fmt(n)} homes sold between ${monName(startYm)} and ${monName(endYm)}, on ${cn}'s own sale records.`,
    unit: 'Homes sold',
  });
}
function lawnLayer(c, f, doors) {
  const have = doors.filter((d) => d.lawn !== null);
  if (have.length < doors.length * 0.6) return null;
  const big = have.filter((d) => d.lawn >= BIG_LAWN);
  return densityOut(c, f, big, SCALE.lawn, {
    cap: (n) => `${c.name} \u00b7 ${fmt(n)} homes with a lawn of 5,000 sq ft or more`,
    sub: `Lawn size estimated from USDA NAIP 2023 aerial photos (our measurement). Streets: U.S. Census TIGER/Line.`,
    alt: (n) => `Map of ${c.name} shaded by how many homes in each half-kilometre square have a large lawn: ${fmt(n)} homes with an estimated lawn of 5,000 square feet or more. No single home is shown.`,
    text: (n) => `${c.name}: ${fmt(n)} homes with an estimated lawn of 5,000 sq ft or more, measured from 2023 aerial photos.`,
    unit: 'Big-lawn homes',
  });
}
function densityOut(c, f, pts, S, words) {
  const n = pts.length; if (n < 20) return null;
  const cellLat = Math.max(0.0042, (f.n - f.s) / 40);   /* at least ~470 m a side */
  const g = grid(f, pts, cellLat), b = breaks([...g.m.values()].map((x) => x.n)); if (!b) return null;
  const out = [];
  for (const x of g.m.values()) { if (x.n < MIN_CELL) continue; let i = 0; for (let j = 0; j < 4; j++) if (x.n >= b[j]) i = j; out.push(rectS(g.rect(x), S.cols[i])); }
  const km = (cellLat * 111.32).toFixed(1);
  const legend = { title: words.unit + ' per ' + km + ' km square', rows: S.cols.map((col, i) => [col, i < 3 ? `${b[i]}–${b[i + 1] - 1}` : `${b[i]} or more`]) };
  return { layer: out.join(''), legend, n, cap: words.cap(n), sub: words.sub, alt: words.alt(n), text: words.text(n) };
}

mkdirSync(OUT, { recursive: true });
const manFile = join(OUT, 'maps.json');
const man = existsSync(manFile) ? jr(manFile) : { cities: {} };
man.note = 'Built by traverse/prospect-desk/tools/build-maps.mjs: one picture per city and trade family (hail, moved, lawn). desk.php reads this.';
const LAYERS = { hail: hailLayer, moved: movedLayer, lawn: lawnLayer };
for (const c of cities()) {
  const t0 = Date.now();
  const doors = doorsOf(c.keys);
  if (doors.length < MIN_DOORS) { console.log(`${c.name}: ${doors.length} homes, too few for a map`); continue; }
  const f = frame(doors), rd = roads(f);
  const hc = Math.max(0.0018, (f.n - f.s) / 130), hg = grid(f, doors, hc);
  const homes = [...hg.m.values()].filter((x) => x.n >= 2).map((x) => rectS(hg.rect(x), '')).join('').replace(/ fill=""/g, '');   /* where the homes are: grey squares under the layer */
  const rec = man.cities[c.key] || { name: c.name };
  rec.name = c.name; rec.keys = c.keys; rec.homes = doors.length;
  for (const fam of FAMS) {
    const L = LAYERS[fam](c, f, doors);
    if (!L) { delete rec[fam]; console.log(`  ${c.name} ${fam}: no map (not enough data)`); continue; }
    const file = `${fam}-${c.key}-${STAMP}.png`;
    const svg = svgFor(f, { homes, rd }, L.layer, L.legend, L.cap, L.sub, c.name);
    const info = await sharp(Buffer.from(svg)).resize(OUTW).png({ palette: true, colours: COLOURS, compressionLevel: 9, effort: 10 }).toFile(join(OUT, file));
    rec[fam] = { f: file, w: OUTW, h: Math.round(H * OUTW / W), n: L.n, cap: L.cap, sub: L.sub, alt: L.alt, text: L.text, kb: Math.round(info.size / 1024), built: STAMP };
    if (fam === 'hail') Object.assign(rec[fam], { first: L.first, last: L.last, through: L.through });
    console.log(`  ${c.name} ${fam}: ${fmt(L.n)} \u00b7 ${rec[fam].kb} KB \u00b7 ${file}`);
  }
  man.cities[c.key] = rec;
  console.log(`${c.name}: ${fmt(doors.length)} homes, ${f.kmAcross.toFixed(1)} km across, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
man.built = new Date().toISOString().slice(0, 10);
writeFileSync(manFile, JSON.stringify(man, null, 1));
console.log('maps.json:', Object.keys(man.cities).length, 'cities');

/* Lot facts per door for TraverseSecurity (2026-10-29, Matthew approved, Security edition only): plain physical facts about the
 * lot that a security rep uses. No score and no label about the people or the risk: what the street map and our own points say.
 *
 *   node build-lot.mjs [town ...]      every Colorado town in index.json when none is named; writes into app/data/rounds/:
 *     security-lot-<town>.json   { built, src, packed: 1, doors: { id: JSON text of { c?, bk?, al?, tr?, de?, nn?, os?, wa? } } }
 *   node build-lot.mjs --sample=<town> prints a few doors of each kind with the numbers behind them (for spot checks)
 *
 * The file is named security-lot-* on purpose: every other edition's keep() already drops security-* (except the town
 * Security-Widefield), so these facts reach the Security edition only and never Sixfold.
 *
 * Per door (the house point is the county parcel's centre, the lot size its acres):
 *   c   corner lot: [its own street, the cross street]. Another named street runs along the side of the lot (within the lot's
 *       half-width plus the street's own width) roughly square to the house's street, and the two streets meet beside the lot.
 *   bk  a named street runs behind the lot (the far side from the house's street): its name.
 *   al  an alley (TIGER S1730, or Denver's own alley lines: then ad = 1) behind ('b') or beside ('s') the lot.
 *   tr  a walkway, trail or bike path (S1710, S1820, S1830) along the side or back of the lot: its name, or '' when unnamed.
 *   de  the house's own street dead-ends (a cul-de-sac or a street that stops) this many metres from the house point.
 *   nn  metres to the nearest other home's point (every home on the county list: door list and the grey dots), centre to centre.
 *   os  open space, park or greenbelt within 90 m (the pest build's COMaP result, copied: pest-<town>.json)
 *   wa  a named creek within 100 m or a pond within 150 m (the pest build's USGS NHD result, copied)
 * Sources:
 *   - U.S. Census Bureau, TIGER/Line Shapefiles 2026, All Roads by county (www2.census.gov/geo/tiger/TIGER2026/ROADS/, published
 *     2026-10-06). Public domain (a U.S. federal government work); road classes from the 2026 MAF/TIGER Feature Class Codes.
 *   - the county parcel points and acres already in the door files (Colorado Public Parcels / the county files, built earlier).
 *   - COMaP (state) and USGS NHD through pest-<town>.json, as the Pest edition shows them.
 * Limits: TIGER draws alleys only where the Census has them (Denver and older grids mostly; most suburbs have none to draw).
 * The house point is the parcel's centre, not the front door, so distances are lot-centre distances. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countyFiles, readRoads } from './tiger-roads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
/* ROUNDS_DATA / LOT_CACHE: run from a git worktree against the main tree's data (the door files and caches are not in git) */
const DATA = process.env.ROUNDS_DATA || join(HERE, '..', '..', '..', 'app', 'data', 'rounds'), CACHE = process.env.LOT_CACHE || join(HERE, 'cache'), TIGER = join(CACHE, 'tiger');
const args = process.argv.slice(2), opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const SAMPLE = opt('sample'), DEBUG = args.includes('--debug'), unmatched = new Map();   /* --debug: writes nothing, lists the address streets no TIGER name matched */
const CO_BOX = [-109.1, 36.9, -102.0, 41.1];
const today = new Date().toISOString().slice(0, 10);

/* ---- street names: the address and TIGER spell the same street differently ("VISTA LODGE LOOP" / "Vis Lodge Lp") ---- */
const ABBR = { AVENUE: 'AVE', AV: 'AVE', BOULEVARD: 'BLVD', CIRCLE: 'CIR', COURT: 'CT', DRIVE: 'DR', LANE: 'LN', PARKWAY: 'PKWY', PKY: 'PKWY',
  PLACE: 'PL', ROAD: 'RD', STREET: 'ST', TERRACE: 'TER', TERR: 'TER', TRAIL: 'TRL', LOOP: 'LP', POINT: 'PT', VISTA: 'VIS', VIEW: 'VW', RIDGE: 'RDG',
  HEIGHTS: 'HTS', HIGHWAY: 'HWY', CROSSING: 'XING', SQUARE: 'SQ', GROVE: 'GRV', MOUNT: 'MT', MOUNTAIN: 'MTN', CANYON: 'CYN', CREEK: 'CRK',
  HILL: 'HL', HILLS: 'HLS', MEADOW: 'MDW', MEADOWS: 'MDWS', LAKE: 'LK', LAKES: 'LKS', VALLEY: 'VLY', GLEN: 'GLN', COVE: 'CV', ALLEY: 'ALY',
  BEND: 'BND', BLUFF: 'BLF', BROOK: 'BRK', CENTER: 'CTR', CLIFF: 'CLF', COMMON: 'CMN', COMMONS: 'CMNS', CORNER: 'COR', CREST: 'CRST',
  ESTATES: 'ESTS', EXTENSION: 'EXN', EXT: 'EXN', FALLS: 'FLS', FIELD: 'FLD', FIELDS: 'FLDS', FOREST: 'FRST', FORK: 'FRK', GARDEN: 'GDN',
  GARDENS: 'GDNS', GATEWAY: 'GTWY', HAVEN: 'HVN', HOLLOW: 'HOLW', JUNCTION: 'JCT', KNOLL: 'KNL', LANDING: 'LNDG', LODGE: 'LDG', MANOR: 'MNR',
  MILL: 'ML', ORCHARD: 'ORCH', PINES: 'PNES', PLAZA: 'PLZ', RANCH: 'RNCH', RIVER: 'RIV', SPRING: 'SPG', SPRINGS: 'SPGS', STATION: 'STA',
  SUMMIT: 'SMT', TRACE: 'TRCE', VILLAGE: 'VLG', ROUTE: 'RTE', COUNTY: 'CO', CNTY: 'CO', STATE: 'ST', NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
  NORTHEAST: 'NE', NORTHWEST: 'NW', SOUTHEAST: 'SE', SOUTHWEST: 'SW', FIRST: '1ST', SECOND: '2ND', THIRD: '3RD', FOURTH: '4TH', FIFTH: '5TH' };
const TYPES = new Set(['AVE', 'BLVD', 'CIR', 'CT', 'DR', 'LN', 'PKWY', 'PL', 'RD', 'ST', 'TER', 'TRL', 'LP', 'PT', 'VIS', 'VW', 'RDG', 'HTS', 'HWY',
  'XING', 'SQ', 'GRV', 'WAY', 'PATH', 'PASS', 'RUN', 'ROW', 'WALK', 'CV', 'GLN', 'HL', 'HLS', 'LK', 'LKS', 'MDW', 'MDWS', 'TRCE', 'BND', 'CRST', 'EXN', 'ALY', 'PLZ', 'MTN']);
const DIRS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
const toks = (s) => String(s || '').toUpperCase().replace(/[.,'#-]/g, ' ').split(/\s+/).filter(Boolean).map((t) => ABBR[t] || t);
const canon = (s) => toks(s).join(' ');
function core(s) {
  const t = toks(s);
  while (t.length > 1 && DIRS.has(t[0])) t.shift();
  while (t.length > 1 && (DIRS.has(t[t.length - 1]) || t[t.length - 1] === 'EXN')) t.pop();
  if (t.length > 1 && TYPES.has(t[t.length - 1])) t.pop();
  return t.join(' ');
}
/* "2755 MOUNT HERMAN RD", "891 14TH ST UNIT 4216", "134 1/2 HIGH ST" -> the street */
const streetOf = (addr) => String(addr || '').toUpperCase().replace(/\s+(UNIT|APT|STE|SUITE|BLDG|LOT|SPC|TRLR|#)\b.*$/, '').replace(/#.*$/, '')
  .replace(/^\s*\d+[A-Z]?(\s*-\s*\d+[A-Z]?)?(\s+\d\/\d)?\s+/, '').trim();

/* the house's own street among the roads near it: the whole name, then its core ("S VALENTIA CT" -> "VALENTIA"); then without the
   last word or two (Weld's lists end the address with the town or "WELD", others with a unit letter); last, the same first word
   within 60 m ("MONACO ST PKWY" is TIGER's "Monaco Pkwy", "MARTIN LUTHER KING JR BLVD" its "Martin Luther King Blvd") */
function ownStreet(cand, st) {
  const w = st.split(/\s+/);
  for (let cut = 0; cut <= 2 && w.length - cut >= 1; cut++) {
    const v = w.slice(0, w.length - cut).join(' '), c = canon(v), k = core(v);
    const f = cand.find((x) => x.r.n && x.r.canon === c) || (k && cand.find((x) => x.r.n && x.r.core === k));
    if (f) return f;
  }
  const first = core(st).split(' ')[0];
  if (first && first.length >= 4 && !/^\d/.test(first)) return cand.find((x) => x.d <= 60 && x.r.n && x.r.core.split(' ')[0] === first) || null;
  return null;
}

/* ---- road classes (2026 MAF/TIGER Feature Class Codes) ---- */
const FRONT = new Set(['S1200', 'S1400', 'S1640']);                 /* streets a house can face or sit at the corner of */
const BEHIND = new Set(['S1100', 'S1200', 'S1400', 'S1630', 'S1640']);   /* any named road behind the lot, freeways and ramps too */
const PATHS = new Set(['S1710', 'S1820', 'S1830']);                 /* walkway, bike path, bridle path */
const ALLEY = 'S1730';
const DRIVEN = (c) => /^S1[1-7]/.test(c) && c !== 'S1710' && c !== 'S1720';   /* counted for dead ends: anything a car can use */

/* ---- geometry in metres around a town ---- */
const proj = (lat0) => { const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540; return (lon, lat) => [lon * kx, lat * ky]; };
function nearestOnSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return [a[0] + t * dx, a[1] + t * dy]; }
const angle = (u, v) => { const c = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1); return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; };

/* ---- the counties' roads, read once each ---- */
const COUNTIES = countyFiles(TIGER);
if (!COUNTIES.length) throw new Error('no TIGER road files in ' + TIGER + ': download tl_2026_08xxx_roads.zip there first (see README)');
const denverAlleys = existsSync(join(CACHE, 'denver-alleys.json')) ? JSON.parse(readFileSync(join(CACHE, 'denver-alleys.json'), 'utf8')) : [];
const roadMemo = new Map();
const roadsOf = (f) => { if (!roadMemo.has(f.name)) roadMemo.set(f.name, readRoads(f)); return roadMemo.get(f.name); };

/* ---- every home's point, for the nearest neighbour (door lists and the grey dots of every town) ---- */
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const allTowns = idx.regions.filter((r) => !String(r.key).startsWith('com-') && !r.metro && existsSync(join(DATA, `${r.key}.json`))).map((r) => r.key);
const want = args.filter((a) => !a.startsWith('--'));
const towns = SAMPLE ? [SAMPLE] : want.length ? allTowns.filter((t) => want.includes(t)) : allTowns;
const HOME_CELL = 0.002;   /* about 200 m */
const homes = new Map();
const homeKey = (lat, lon) => `${Math.floor(lat / HOME_CELL)},${Math.floor(lon / HOME_CELL)}`;
const addHome = (lat, lon) => { const k = homeKey(lat, lon); let a = homes.get(k); if (!a) homes.set(k, (a = [])); a.push(lat, lon); };
const doorsOf = {};
for (const t of allTowns) {
  const d = JSON.parse(readFileSync(join(DATA, `${t}.json`), 'utf8'));
  let inCO = true;
  for (const a of d.areas) for (const x of a.doors) if (x.lat != null) { if (x.lon < CO_BOX[0] || x.lon > CO_BOX[2] || x.lat < CO_BOX[1] || x.lat > CO_BOX[3]) inCO = false; addHome(x.lat, x.lon); }
  if (towns.includes(t) && inCO) doorsOf[t] = d;
  const of = join(DATA, `others-${t}.json`);
  if (existsSync(of)) for (const o of JSON.parse(readFileSync(of, 'utf8')).doors || []) if (Number.isFinite(o[0])) addHome(o[0], o[1]);
}
const kmLat = 110540;
function nearestHome(lat, lon) {
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ci = Math.floor(lat / HOME_CELL), cj = Math.floor(lon / HOME_CELL);
  let best = Infinity;
  for (let r = 1; r <= 8; r++) {   /* rings of cells until the best found is closer than the ring */
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (r > 1 && Math.abs(a) < r && Math.abs(b) < r) continue;
      const arr = homes.get(`${ci + a},${cj + b}`); if (!arr) continue;
      for (let i = 0; i < arr.length; i += 2) { const d = Math.hypot((arr[i] - lat) * kmLat, (arr[i + 1] - lon) * kx); if (d >= 3 && d < best) best = d; }
    }
    if (r === 1) continue;
    if (best <= (r - 1) * HOME_CELL * kmLat * 0.75) break;
  }
  return best === Infinity ? null : best;
}

/* ---- one town ---- */
let tot = 0; const hit = { c: 0, bk: 0, al: 0, tr: 0, de: 0, nn: 0, os: 0, wa: 0, own: 0 };
const samples = { c: [], bk: [], al: [], tr: [], de: [], none: [] };
for (const town of Object.keys(doorsOf)) {
  const pts = doorsOf[town].areas.flatMap((a) => a.doors).filter((x) => x.lat != null);
  if (!pts.length) continue;
  const lats = pts.map((x) => x.lat), lons = pts.map((x) => x.lon), pad = 0.01;
  const box = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad];
  const P = proj((box[1] + box[3]) / 2);
  /* the roads of every county the town's box touches, cut to the box */
  const roads = [];
  for (const f of COUNTIES) {
    if (f.box[2] < box[0] || f.box[0] > box[2] || f.box[3] < box[1] || f.box[1] > box[3]) continue;
    for (const r of roadsOf(f)) {
      const lines = r.lines.filter((l) => l.some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]));
      if (lines.length) roads.push({ n: r.n, c: r.c, canon: canon(r.n), core: core(r.n), lines: lines.map((l) => l.map(([x, y]) => P(x, y))) });
    }
  }
  /* Denver's own alley lines (fetch-denver-alleys.mjs): TIGER has almost none there */
  for (const l of denverAlleys) if (l.some(([x, y]) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])) roads.push({ n: '', c: ALLEY, canon: '', core: '', lines: [l.map(([x, y]) => P(x, y))], extra: 1 });
  /* dead ends: a line end no other drivable road touches (TIGER merges a street's pieces, so a T joins on another's middle) */
  const vk = (q) => `${Math.round(q[0])},${Math.round(q[1])}`;   /* to the metre */
  const seen = new Map();
  for (const r of roads) if (DRIVEN(r.c) && !r.extra) for (const l of r.lines) l.forEach((q, i) => { const k = vk(q); seen.set(k, (seen.get(k) || 0) + (i === 0 || i === l.length - 1 ? 1 : 2)); });
  const deadEnds = [];
  for (const r of roads) if (FRONT.has(r.c) && r.n) for (const l of r.lines) for (const q of [l[0], l[l.length - 1]]) if (seen.get(vk(q)) === 1) deadEnds.push({ q, canon: r.canon, core: r.core });
  /* a grid of segments, 50 m cells */
  const CELL = 50, grid = new Map();
  roads.forEach((r, ri) => r.lines.forEach((l) => { for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++)
      for (let gy = Math.floor(Math.min(a[1], b[1]) / CELL); gy <= Math.floor(Math.max(a[1], b[1]) / CELL); gy++) {
        const k = gx + ',' + gy; let s = grid.get(k); if (!s) grid.set(k, (s = [])); s.push(ri, a, b);
      }
  } }));
  const deGrid = new Map(); for (const e of deadEnds) { const k = Math.floor(e.q[0] / 100) + ',' + Math.floor(e.q[1] / 100); let s = deGrid.get(k); if (!s) deGrid.set(k, (s = [])); s.push(e); }
  /* the nearest point of each road within R of p */
  function near(p, R) {
    const best = new Map();
    for (let gx = Math.floor((p[0] - R) / CELL); gx <= Math.floor((p[0] + R) / CELL); gx++) for (let gy = Math.floor((p[1] - R) / CELL); gy <= Math.floor((p[1] + R) / CELL); gy++) {
      const s = grid.get(gx + ',' + gy); if (!s) continue;
      for (let i = 0; i < s.length; i += 3) { const q = nearestOnSeg(p, s[i + 1], s[i + 2]), d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d <= R) { const o = best.get(s[i]); if (!o || d < o.d) best.set(s[i], { r: roads[s[i]], d, q }); } }
    }
    return [...best.values()].sort((a, b) => a.d - b.d);
  }
  /* where two roads meet (cross, or one ends on or within 3 m of the other) near p: the distance from p to the nearest such
     point within R, or null */
  function crossNear(r1, r2, p, R) {
    const segs = (r) => { const o = []; for (const l of r.lines) for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; if (Math.min(a[0], b[0]) > p[0] + R || Math.max(a[0], b[0]) < p[0] - R || Math.min(a[1], b[1]) > p[1] + R || Math.max(a[1], b[1]) < p[1] - R) continue; o.push([a, b]); } return o; };
    const s1 = segs(r1), s2 = segs(r2); let best = null;
    const take = (X) => { const d = Math.hypot(X[0] - p[0], X[1] - p[1]); if (d <= R && (best === null || d < best)) best = d; };
    for (const [a, b] of s1) for (const [c, e] of s2) {
      const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [e[0] - c[0], e[1] - c[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (den) { const t = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den, s = ((c[0] - a[0]) * d1[1] - (c[1] - a[1]) * d1[0]) / den; if (t >= 0 && t <= 1 && s >= 0 && s <= 1) take([a[0] + t * d1[0], a[1] + t * d1[1]]); }
      for (const q of [c, e]) { const z = nearestOnSeg(q, a, b); if (Math.hypot(z[0] - q[0], z[1] - q[1]) <= 3) take(z); }
      for (const q of [a, b]) { const z = nearestOnSeg(q, c, e); if (Math.hypot(z[0] - q[0], z[1] - q[1]) <= 3) take(z); }
    }
    return best;
  }

  const pestF = join(DATA, `pest-${town}.json`), pest = existsSync(pestF) ? JSON.parse(readFileSync(pestF, 'utf8')).doors || {} : {};
  const out = {}; let tTot = 0; const tHit = { c: 0, al: 0, de: 0, own: 0 };
  for (const x of pts) {
    tot++; tTot++;
    const p = P(x.lon, x.lat), o = {}, why = {};
    /* the side of a square lot that size, metres. A town home or a unit in a complex carries the whole complex's acres (Thornton's
       town homes all read 1 acre, their neighbours 7 m away): when the nearest home is far closer than that lot allows, the lot is
       about the spacing of the homes instead */
    const nn = nearestHome(x.lat, x.lon), L0 = Math.sqrt(Math.max(Number(x.acres) || 0.15, 0.04) * 4046.86);
    const L = nn !== null && L0 > 2.2 * nn ? Math.max(10, 1.6 * nn) : L0;
    const st = streetOf(x.address), stC = canon(st);
    const cand = near(p, Math.max(150, 2 * L));
    const own = ownStreet(cand, st);
    if (!own && DEBUG) { const nm = cand.find((c) => c.r.n); unmatched.set(stC + '  ~  ' + (nm ? nm.r.n : '-'), (unmatched.get(stC + '  ~  ' + (nm ? nm.r.n : '-')) || 0) + 1); }
    if (own) {
      hit.own++; tHit.own++;
      const u0 = [own.q[0] - p[0], own.q[1] - p[1]], d0 = own.d;
      /* the lot's shape from what we know: the centre sits half the depth plus half the street (about 7 m) back from its own
         street, so depth ~ 2 (d0 - 7); the width is the area over the depth. A square guess when d0 says nothing useful. */
      const A = L * L, D = Math.max(12, Math.min(3 * L, 2 * (d0 - 7))), W = A / D;
      const Tside = Math.min(W / 2 + 13, 0.62 * L + 12);     /* lot centre to a street along the side of the lot */
      const Tback = Math.max(D / 2 + 14, 0.62 * L + 12);     /* ... along the back */
      const Rx = Math.hypot(W / 2 + 12, D / 2 + 12) + 6;     /* lot centre to the corner where two bordering streets meet */
      for (const c of cand) {
        if (c === own || c.d > Math.max(Tside, Tback) + 10) continue;
        const u = [c.q[0] - p[0], c.q[1] - p[1]], ang = d0 < 1 ? 90 : angle(u0, u);
        const named = c.r.n && c.r.core !== own.r.core;
        /* corner: the other street borders the side of the lot and meets the house's street at the lot's corner */
        if (!o.c && named && FRONT.has(c.r.c) && c.d <= Tside && ang <= 150) {
          const X = crossNear(own.r, c.r, p, Rx + 30);
          if (X !== null && X <= Rx) { o.c = [own.r.n, c.r.n]; why.c = { d0: Math.round(d0), d: Math.round(c.d), ang: Math.round(ang), X: Math.round(X), Tside: Math.round(Tside), Rx: Math.round(Rx) }; continue; }
        }
        /* a street behind: across the lot from its own street, not one that meets it at the lot (that is a corner) */
        if (!o.bk && named && BEHIND.has(c.r.c) && c.d <= Tback && ang >= 140) {
          const X = crossNear(own.r, c.r, p, Rx + 30);
          if (X === null || X > Rx + 20) { o.bk = c.r.n; why.bk = { d0: Math.round(d0), d: Math.round(c.d), ang: Math.round(ang), Tback: Math.round(Tback) }; }
        }
        if (!o.al && c.r.c === ALLEY && ang >= 50 && c.d <= (ang >= 120 ? Tback - 4 : Tside - 4)) { o.al = ang >= 120 ? 'b' : 's'; if (c.r.extra) o.ad = 1; why.al = { d0: Math.round(d0), d: Math.round(c.d), ang: Math.round(ang) }; }
        if (o.tr === undefined && PATHS.has(c.r.c) && ang >= 50 && c.d <= (ang >= 120 ? Tback : Tside)) { o.tr = c.r.n || ''; why.tr = { d: Math.round(c.d), ang: Math.round(ang) }; }
      }
      /* the own street's dead end near the house */
      const R = 0.5 * L + 45;
      let de = null;
      for (let gx = Math.floor((p[0] - R) / 100); gx <= Math.floor((p[0] + R) / 100); gx++) for (let gy = Math.floor((p[1] - R) / 100); gy <= Math.floor((p[1] + R) / 100); gy++)
        for (const e of deGrid.get(gx + ',' + gy) || []) { if (e.canon !== own.r.canon && e.core !== own.r.core) continue; const d = Math.hypot(e.q[0] - p[0], e.q[1] - p[1]); if (d <= R && (de === null || d < de)) de = d; }
      if (de !== null) { o.de = Math.round(de); why.de = { d: o.de, R: Math.round(R) }; }
    }
    if (nn !== null) o.nn = Math.round(nn);
    const pp = pest[x.id] || {};
    if (pp.os) o.os = pp.os;
    if (pp.wa) o.wa = pp.wa;
    for (const k of Object.keys(hit)) if (k !== 'own' && o[k] !== undefined) hit[k]++;
    if (o.c) tHit.c++; if (o.al) tHit.al++; if (o.de !== undefined) tHit.de++;
    if (SAMPLE) { for (const k of ['c', 'bk', 'al', 'tr', 'de']) if (o[k] !== undefined && samples[k].length < 400) samples[k].push({ id: x.id, address: x.address, acres: x.acres, lat: x.lat, lon: x.lon, o, why: why[k] });
      if (own && !o.c && !o.bk && !o.al && o.de === undefined && samples.none.length < 400) samples.none.push({ id: x.id, address: x.address, acres: x.acres, lat: x.lat, lon: x.lon }); }
    if (Object.keys(o).length) out[x.id] = JSON.stringify(o);
  }
  if (!SAMPLE && !DEBUG) writeFileSync(join(DATA, `security-lot-${town}.json`), JSON.stringify({ built: today, src: 'U.S. Census Bureau TIGER/Line 2026 roads; county parcel points; COMaP and USGS NHD (pest build)', packed: 1, doors: out }));
  console.log(`  security-lot-${town}.json: ${tTot} doors, own street ${tHit.own}, corner ${tHit.c}, alley ${tHit.al}, dead end ${tHit.de} (${roads.length} roads)`);
}
console.log(`${tot} doors: own street found ${hit.own}, corner ${hit.c}, street behind ${hit.bk}, alley ${hit.al}, path ${hit.tr}, dead end ${hit.de}, neighbour distance ${hit.nn}, open space ${hit.os}, water ${hit.wa}`);
if (SAMPLE) writeFileSync(join(CACHE, `lot-sample-${SAMPLE}.json`), JSON.stringify(samples));
if (DEBUG) console.log([...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => v + '  ' + k).join('\n'));

/* Building footprints for the commercial-roofing test (2026-10-05).
 *
 *   node fetch-footprints.mjs [area ...]        default: springs south west
 *
 * Per area: pull the official building-outline layer (county/city ArcGIS REST, paged) for the
 * circle's bounding box, pull Microsoft Global ML Building Footprints for the same box from the
 * zoom-9 quadkey tiles (downloaded into raw/ms/ if missing), normalise both, cross-check them,
 * then write out/footprints-<area>.json with the official outlines plus Microsoft outlines ONLY
 * where the official layer has no coverage at all (the edge strips past a county's buffer).
 * Raw pages are cached in raw/ (gitignored); delete a raw file to refetch it.
 *
 * Output building: [lon, lat, areaM2, ring]   centroid (6 dp), planar m2 (1 dp), outer ring (6 dp).
 * Area and centroid come from a local equirectangular projection centred on each polygon
 * (metres; error well under 0.01% at this size). Holes are subtracted from areaM2 but not kept
 * in the ring; multipart polygons keep their largest part (counted and reported).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const OUT = join(HERE, 'out');
const UA = 'door-app-footprints/0.1 (research; m.sharpe@surgeftw.com)';
const BUILT = '2026-10-05';
const MARGIN = 500;        /* m past the radius */
const MIN_AREA = 20;       /* m2 */
const R = 6371008.8;

const AREAS = {
  springs: {
    lat: 38.850, lon: -104.725, radius: 4500,
    official: {
      name: 'City of Colorado Springs GIS, GeneralUse/BuildingsImpSurfaces layer 0 "Buildings"',
      url: 'https://gis.coloradosprings.gov/arcgis/rest/services/GeneralUse/BuildingsImpSurfaces/MapServer/0/query',
      fields: 'OBJECTID,Shape_Area,BUILDINGTYPE', areaField: 'Shape_Area', page: 1000,
    },
    quadkeys: ['023101210', '023101211', '023101032', '023101033'],
  },
  south: {
    lat: 39.585, lon: -104.905, radius: 4500,
    official: {
      name: 'Arapahoe County GIS, CountyFeatureService layer 34 "Roof Prints"',
      url: 'https://gis.arapahoegov.com/arcgis/rest/services/CountyFeatureService/FeatureServer/34/query',
      fields: 'OBJECTID,Shape__Area,Bldg_Type,CreateDate', areaField: 'Shape__Area', page: 2000,
    },
    quadkeys: ['023101030'],
  },
  west: {
    lat: 39.720, lon: -105.040, radius: 4500,
    official: {
      name: 'City and County of Denver open data, ODC_PROP_BUILDINGOUTLINES_A layer 111 (2022 aerials)',
      url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PROP_BUILDINGOUTLINES_A/FeatureServer/111/query',
      fields: 'OBJECTID,Shape__Area,BLDG_TYPE', areaField: 'Shape__Area', page: 2000,
    },
    /* second official layer: added where it overlaps nothing from the first (Denver's layer stops a few hundred metres past the county line) */
    official2: {
      name: 'Jefferson County GIS, Hosted/Building_Roofprint_Static_2022 layer 7 (2022 aerials)',
      url: 'https://gisportal.jeffco.us/server/rest/services/Hosted/Building_Roofprint_Static_2022/FeatureServer/7/query',
      fields: 'objectid,SHAPE__Area', areaField: 'SHAPE__Area', oid: 'objectid', page: 2000,
    },
    quadkeys: ['023101030'],
  },
};
const MS_INDEX = 'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv';

/* ---------- geometry ---------- */
const rad = Math.PI / 180;
function toLocal(ring, lat0, lon0) {
  const kx = Math.cos(lat0 * rad) * R * rad, ky = R * rad;
  return ring.map(([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky]);
}
function fromLocal(x, y, lat0, lon0) {
  const kx = Math.cos(lat0 * rad) * R * rad, ky = R * rad;
  return [lon0 + x / kx, lat0 + y / ky];
}
function signedArea(xy) { let a = 0; for (let i = 0, n = xy.length; i < n; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % n]; a += x1 * y2 - x2 * y1; } return a / 2; }
function centroidXY(xy) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = xy.length; i < n; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % n]; const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; }
  if (Math.abs(a) < 1e-9) { const n = xy.length; return [xy.reduce((s, p) => s + p[0], 0) / n, xy.reduce((s, p) => s + p[1], 0) / n]; }
  return [cx / (3 * a), cy / (3 * a)];
}
function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Douglas-Peucker on a closed ring in local metres; keeps at least a triangle */
function simplify(xy, tol) {
  const keep = new Uint8Array(xy.length); keep[0] = 1; keep[xy.length - 1] = 1;
  const stack = [[0, xy.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); if (b - a < 2) continue;
    const [ax, ay] = xy[a], [bx, by] = xy[b]; const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) { const [px, py] = xy[i]; const d = L < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dx * (py - ay) - dy * (px - ax)) / L; if (d > best) { best = d; bi = i; } }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  const out = xy.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : xy;
}
function closeRing(r) { const f = r[0], l = r[r.length - 1]; return (f[0] === l[0] && f[1] === l[1]) ? r : [...r, f]; }
function dedupe(r) { const o = []; for (const p of r) { const q = o[o.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) o.push(p); } return o; }

/** rings: array of lon/lat rings (closed), outer[0] + holes, or several outers (multipart) */
function normalise(rings, src, id) {
  const parts = [];      /* { outer: xy, holes: [xy], area } */
  const lat0 = rings[0][0][1], lon0 = rings[0][0][0];
  const local = rings.map((r) => ({ ll: r, xy: toLocal(closeRing(r), lat0, lon0) }));
  for (const r of local) r.a = signedArea(r.xy);
  /* esri: outer clockwise (negative signed area in x-east/y-north); geojson: outer first then holes */
  let outers, holes;
  if (src === 'ms') { outers = [local[0]]; holes = local.slice(1); }
  else { outers = local.filter((r) => r.a < 0); holes = local.filter((r) => r.a >= 0); if (!outers.length) { outers = [local.reduce((m, r) => Math.abs(r.a) > Math.abs(m.a) ? r : m)]; holes = local.filter((r) => r !== outers[0]); } }
  for (const o of outers) parts.push({ ...o, abs: Math.abs(o.a), holeArea: 0 });
  for (const h of holes) {   /* a hole belongs to the outer that contains its first point */
    const p = h.xy[0]; const host = parts.find((o) => pointInRing(p, o.xy)) || parts[0]; host.holeArea += Math.abs(h.a);
  }
  parts.sort((a, b) => b.abs - a.abs);
  const main = parts[0];
  const area = main.abs - main.holeArea;
  const [cx, cy] = centroidXY(main.xy);
  const [lon, lat] = fromLocal(cx, cy, lat0, lon0);
  const ring = dedupe(simplify(main.xy, 0.1).map(([x, y]) => fromLocal(x, y, lat0, lon0).map((v) => +v.toFixed(6))));
  return { id, src, lon: +lon.toFixed(6), lat: +lat.toFixed(6), area: +area.toFixed(1), ring, parts: parts.length, xy: main.xy, lat0, lon0 };
}
function pointInRing([x, y], xy) {
  let inside = false;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const [xi, yi] = xy[i], [xj, yj] = xy[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function containsLonLat(b, lon, lat) { const [x, y] = toLocal([[lon, lat]], b.lat0, b.lon0)[0]; return pointInRing([x, y], b.xy); }

/* ---------- fetch ---------- */
async function get(url, binary) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
      if (!binary && body.startsWith('{"error"')) throw new Error(body.slice(0, 200));
      return body;
    } catch (e) { if (t === 3) throw e; console.log('  retry', t + 1, e.message); await new Promise((z) => setTimeout(z, 3000 * (t + 1))); }
  }
}
function bboxOf(a) {
  const d = a.radius + MARGIN;
  const dLat = d / (R * rad), dLon = d / (R * rad * Math.cos(a.lat * rad));
  return { w: a.lon - dLon, e: a.lon + dLon, s: a.lat - dLat, n: a.lat + dLat };
}
async function fetchOfficial(key, a, o, tag = 'official') {
  const file = join(RAW, `${key}-${tag}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const b = bboxOf(a), feats = [];
  for (let offset = 0; ; offset += o.page) {
    const p = new URLSearchParams({
      where: '1=1', geometry: `${b.w},${b.s},${b.e},${b.n}`, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: o.fields, outSR: '4326', returnGeometry: 'true',
      orderByFields: o.oid || 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(o.page), f: 'json',
    });
    const j = JSON.parse(await get(o.url + '?' + p));
    if (j.error) throw new Error(JSON.stringify(j.error));
    feats.push(...j.features);
    console.log(`  ${key} ${tag} page ${offset / o.page + 1}: ${j.features.length} (total ${feats.length})`);
    if (!j.exceededTransferLimit && j.features.length < o.page) break;
    if (!j.features.length) break;
    await new Promise((z) => setTimeout(z, 400));
  }
  mkdirSync(RAW, { recursive: true });
  writeFileSync(file, JSON.stringify({ fetched: new Date().toISOString(), url: o.url, bbox: b, features: feats }));
  return { features: feats, bbox: b };
}
async function msTile(q) {
  const dir = join(RAW, 'ms'); mkdirSync(dir, { recursive: true });
  const file = join(dir, q + '.csv.gz');
  if (!existsSync(file)) {
    const idx = await get(MS_INDEX);
    const line = idx.split('\n').find((l) => l.startsWith(`UnitedStates,${q},`));
    if (!line) throw new Error('MS tile not in index: ' + q);
    const url = line.split(',')[2];
    console.log('  downloading MS tile', q, line.split(',')[3]);
    writeFileSync(file, await get(url, true));
  }
  return file;
}
async function loadMS(key, a) {
  const file = join(RAW, `${key}-ms.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const b = bboxOf(a), feats = [];
  for (const q of a.quadkeys) {
    const path = await msTile(q);
    const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
    let n = 0;
    for await (const line of rl) {
      if (!line.trim()) continue; n++;
      const f = JSON.parse(line); const c = f.geometry.coordinates;
      const p = f.geometry.type === 'MultiPolygon' ? c[0][0] : c[0];
      let inside = false; for (const [lon, lat] of p) if (lon >= b.w && lon <= b.e && lat >= b.s && lat <= b.n) { inside = true; break; }
      if (inside) feats.push({ rings: f.geometry.type === 'MultiPolygon' ? c[0] : c, h: f.properties.height, conf: f.properties.confidence });
    }
    console.log(`  ${key} MS tile ${q}: ${n} lines, ${feats.length} in box so far`);
  }
  writeFileSync(file, JSON.stringify({ fetched: new Date().toISOString(), tiles: a.quadkeys, bbox: b, features: feats }));
  return { features: feats, bbox: b };
}

/* ---------- index + matching ---------- */
function grid(list) {
  const g = new Map(); const k = (lon, lat) => `${Math.floor(lon * 1000)}:${Math.floor(lat * 1000)}`;
  for (const b of list) g.set(k(b.lon, b.lat), [...(g.get(k(b.lon, b.lat)) || []), b]);
  return { near(lon, lat) { const out = []; const x = Math.floor(lon * 1000), y = Math.floor(lat * 1000); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const v = g.get(`${x + i}:${y + j}`); if (v) out.push(...v); } return out; } };
}
/** b matched by any in idx: one centroid inside the other, or enough of one ring's vertices inside the
 *  other (concave buildings, e.g. a U-shaped school, can have their centroid outside both outlines) */
function overlaps(p, q) {
  if (containsLonLat(q, p.lon, p.lat) || containsLonLat(p, q.lon, q.lat)) return true;
  for (const [x, y] of [[p, q], [q, p]]) {
    let n = 0; const need = Math.max(3, Math.ceil(x.ring.length * 0.25));
    for (const [lon, lat] of x.ring) { if (containsLonLat(y, lon, lat) && ++n >= need) return true; }
  }
  return false;
}
function matched(b, idx) {
  for (const o of idx.near(b.lon, b.lat)) if (overlaps(b, o)) return o;
  return null;
}

/* ---------- per area ---------- */
async function run(key) {
  const a = AREAS[key]; console.log('==', key);
  const off = await fetchOfficial(key, a, a.official);
  const off2 = a.official2 ? await fetchOfficial(key, a, a.official2, 'official2') : null;
  const ms = await loadMS(key, a);
  const limit = a.radius + MARGIN;
  const inCircle = (b) => haversine(a.lat, a.lon, b.lat, b.lon) <= limit;

  let multi = 0, tiny = 0, areaDiff = [];
  const official = [];
  const takeOfficial = (feats, o, src, skip) => {
    let kept = 0, dropped = 0;
    for (const f of feats) {
      if (!f.geometry?.rings?.length) continue;
      const b = normalise(f.geometry.rings, src, f.attributes[o.oid || 'OBJECTID']);
      if (b.parts > 1) multi++;
      if (!inCircle(b)) continue;
      if (b.area < MIN_AREA) { tiny++; continue; }
      if (skip && skip(b)) { dropped++; continue; }
      const sa = f.attributes[o.areaField]; if (sa) areaDiff.push(b.area / (sa * 0.09290304));
      official.push(b); kept++;
    }
    return { kept, dropped };
  };
  const first = takeOfficial(off.features, a.official, 'official');
  let second = null;
  if (off2) {   /* second layer only where it overlaps nothing already taken (both layers buffer past the county line) */
    const idx1 = grid(official);
    second = takeOfficial(off2.features, a.official2, 'official2', (b) => !!matched(b, idx1));
  }
  /* stacked records: the capture spec files each roof level of a multi-level commercial building as its own
     polygon, so one building can be several overlapping outlines. Counted (centroid inside another outline). */
  const oIdx0 = grid(official);
  let stacked = 0;
  for (const b of official) for (const o of oIdx0.near(b.lon, b.lat)) { if (o !== b && containsLonLat(o, b.lon, b.lat)) { stacked++; break; } }
  const msAll = [];
  for (const f of ms.features) { const b = normalise(f.rings, 'ms', null); if (!inCircle(b)) continue; if (b.area < MIN_AREA) continue; msAll.push(b); }

  /* official coverage: where the layer actually has data (its own extent inside the circle) */
  const ext = official.reduce((e, b) => ({ w: Math.min(e.w, b.lon), e: Math.max(e.e, b.lon), s: Math.min(e.s, b.lat), n: Math.max(e.n, b.lat) }), { w: 180, e: -180, s: 90, n: -90 });
  const outside = (b) => b.lon < ext.w || b.lon > ext.e || b.lat < ext.s || b.lat > ext.n;

  const oIdx = grid(official), mIdx = grid(msAll);
  const msUnmatched = msAll.filter((b) => !matched(b, oIdx));
  const offUnmatched = official.filter((b) => !matched(b, mIdx));
  const big = (l, m) => l.filter((b) => b.area >= m).length;
  const fill = msUnmatched.filter(outside);
  const gapInside = msUnmatched.filter((b) => !outside(b));

  const med = (l) => { const s = [...l].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const stats = {
    area: key, centre: [a.lat, a.lon], radius: a.radius, margin: MARGIN,
    official: { name: a.official.name, fetchedInBox: off.features.length, inCircle: official.length, fromFirstLayer: first.kept,
      secondLayer: off2 ? { name: a.official2.name, fetchedInBox: off2.features.length, added: second.kept, droppedAsOverlappingFirst: second.dropped } : null,
      stackedInsideAnother: stacked, droppedUnder20m2: tiny, multipartKeptLargest: multi,
      extentInCircle: { w: +ext.w.toFixed(4), e: +ext.e.toFixed(4), s: +ext.s.toFixed(4), n: +ext.n.toFixed(4) },
      areaRatioVsLayerShapeArea: { median: +med(areaDiff)?.toFixed(4), min: +Math.min(...areaDiff).toFixed(3), max: +Math.max(...areaDiff).toFixed(3) },
      over1000m2: big(official, 1000), over5000m2: big(official, 5000) },
    microsoft: { tiles: a.quadkeys, inBox: ms.features.length, inCircle: msAll.length, over1000m2: big(msAll, 1000), over5000m2: big(msAll, 5000) },
    crossCheck: {
      msNotInOfficial: msUnmatched.length, msNotInOfficial_over200m2: big(msUnmatched, 200), msNotInOfficial_over1000m2: big(msUnmatched, 1000),
      msNotInOfficial_insideOfficialExtent: gapInside.length, msNotInOfficial_insideOfficialExtent_over200m2: big(gapInside, 200), msNotInOfficial_insideOfficialExtent_over1000m2: big(gapInside, 1000),
      officialNotInMs: offUnmatched.length, officialNotInMs_over200m2: big(offUnmatched, 200), officialNotInMs_over1000m2: big(offUnmatched, 1000),
      biggestGapsInsideExtent: gapInside.filter((b) => b.area >= 1000).sort((x, y) => y.area - x.area).slice(0, 10).map((b) => [b.lat, b.lon, b.area]),
    },
    fillFromMsOutsideOfficialExtent: fill.length,
  };

  const row = (b) => [b.lon, b.lat, b.area, b.ring];
  const buildings = [...official, ...fill].map(row);
  const msCandidates = gapInside.filter((b) => b.area >= 200).sort((x, y) => y.area - x.area).map(row);
  stats.msCandidatesOver200m2 = msCandidates.length;
  mkdirSync(OUT, { recursive: true });
  const out = {
    area: key,
    source: a.official.name + (off2 ? ` (${first.kept}) + ${a.official2.name} (${second.kept}, where not overlapping the first)` : '')
      + (fill.length ? ` (+${fill.length} Microsoft Global ML Building Footprints outside the official extent, listed last from index ${official.length})` : ''),
    built: BUILT, centre: [a.lat, a.lon], radiusM: a.radius, marginM: MARGIN, minAreaM2: MIN_AREA,
    counts: { official: official.length, microsoftFill: fill.length, fillStartIndex: fill.length ? official.length : null, total: buildings.length, msCandidates: msCandidates.length },
    buildings,
    /* Microsoft outlines of 200 m2+ inside the official layer's extent that overlap nothing official: unverified,
       could be newer than the layer, or ML false positives (tanks, lots, canopies). Same row shape. Not in `buildings`. */
    msCandidates,
  };
  writeFileSync(join(OUT, `footprints-${key}.json`), JSON.stringify(out));
  writeFileSync(join(RAW, `${key}-stats.json`), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 1));
  return stats;
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(AREAS);
for (const k of keys) { if (!AREAS[k]) throw new Error('unknown area ' + k); await run(k); }

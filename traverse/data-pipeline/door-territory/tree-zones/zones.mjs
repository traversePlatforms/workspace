/* Trees near the house — the shared measuring code (2026-10-02).

   Per door: the lot boundary (Colorado statewide parcels) -> the house (the largest
   Microsoft building outline whose centre is inside the lot) -> the Meta + WRI
   canopy-height map, 1 m -> every map pixel inside the lot and outside the house,
   sorted into the Colorado State Forest Service defensible-space zones by its distance
   from the house wall:
       zone 1   0-5 ft      (1.524 m)
       zone 2   5-30 ft     (9.144 m)
       zone 3   30-100 ft   (30.48 m)
   and counted as tree cover when it stands 2 m or taller (the same "tall" line the lawn
   measure uses).

   Distances are worked in Web Mercator scaled by cos(latitude), which is within a
   fraction of a percent over a 100 ft radius — far finer than the map's own error.

   ⚑ What this cannot see: anything planted or cut after the canopy map's imagery
   (2018-2020), shrubs under 2 m, and a house the outline set has missed or merged.
   The lot line and the outline can each be off by a few feet, so zone 1 (a 5 ft band)
   is the noisiest number — read it as "trees against the house: yes / no". */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

export const ZONES = { z1: 1.524, z2: 9.144, z3: 30.48 };
export const TALL = 2;
export const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
export const CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function json(url, opts) {
  /* 7 tries over ~2.5 min: the state parcel service drops pages under load (Denver's lots, 2026-10-10) */
  for (let i = 0; i < 7; i++) { try { const r = await fetch(url, opts); if (r.ok) return await r.json(); } catch {} await sleep([1, 3, 8, 15, 30, 45, 60][i] * 1000); }
  throw new Error('fetch failed: ' + url.slice(0, 80));
}
export function quadkey(lon, lat, z) {
  const s = Math.sin(lat * Math.PI / 180);
  const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z);
  let q = ''; for (let i = z; i > 0; i--) { let dd = 0; const m = 1 << (i - 1); if (x & m) dd++; if (y & m) dd += 2; q += dd; }
  return q;
}
export function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function inRings(x, y, rings) { let n = 0; for (const r of rings) if (inRing(x, y, r)) n++; return n % 2 === 1; }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function ringDist(x, y, ring) {
  let d = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) d = Math.min(d, segDist(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]));
  return d;
}
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
export const merc = (lon, lat) => proj4('EPSG:4326', 'EPSG:3857', [lon, lat]);
const bboxOf = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];

/* ---- lots ---- */
/* 2026-10-15: a big town is asked for in squares of about 2 miles, each paged on its own, lots that cross squares kept once (by OBJECTID).
   One long paged list for a whole city (Denver, Lakewood, Littleton, Arvada, Boulder) failed partway on the state's service. */
export async function townParcels(bbox) {
  const out = [], seen = new Set(), T = 0.03;
  const nx = Math.max(1, Math.ceil((bbox[2] - bbox[0]) / T)), ny = Math.max(1, Math.ceil((bbox[3] - bbox[1]) / T));
  for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
    const tb = [bbox[0] + ix * T, bbox[1] + iy * T, Math.min(bbox[2], bbox[0] + (ix + 1) * T), Math.min(bbox[3], bbox[1] + (iy + 1) * T)];
    let offset = 0;
    for (;;) {
      const j = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: tb.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
        spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID', geometryPrecision: '6', resultOffset: String(offset), resultRecordCount: '2000', orderByFields: 'OBJECTID' }));
      const fs = j.features || [];
      for (const f of fs) {
        const id = f.attributes && f.attributes.OBJECTID;
        if (id != null) { if (seen.has(id)) continue; seen.add(id); }
        if (f.geometry && f.geometry.rings) out.push({ rings: f.geometry.rings, bb: bboxOf(f.geometry.rings.flat()) });
      }
      if (fs.length < 2000 && !j.exceededTransferLimit) break;
      offset += fs.length;
      if (!fs.length) break;
    }
  }
  return out;
}

/* ---- building outlines: Microsoft Global ML Building Footprints, one gzipped
   GeoJSON-lines file per zoom-9 tile, downloaded once by fetch-buildings.mjs ---- */
export async function loadBuildings(dir, bbox) {
  const out = [];
  const tiles = new Set();
  for (const lon of [bbox[0], bbox[2]]) for (const lat of [bbox[1], bbox[3]]) tiles.add(quadkey(lon, lat, 9));
  for (const qk of tiles) {
    const f = join(dir, `${qk}.geojsonl.gz`);
    if (!existsSync(f)) throw new Error(`building tile ${qk} missing — run fetch-buildings.mjs`);
    const rl = createInterface({ input: createReadStream(f).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      const m = /"coordinates":\s*\[\[\[\s*(-?[\d.]+),\s*(-?[\d.]+)/.exec(line);   /* cheap bbox test before parsing */
      if (!m) continue;
      const lon = +m[1], lat = +m[2];
      if (lon < bbox[0] - 0.002 || lon > bbox[2] + 0.002 || lat < bbox[1] - 0.002 || lat > bbox[3] + 0.002) continue;
      const g = JSON.parse(line).geometry;
      const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!ring) continue;
      const bb = bboxOf(ring);
      out.push({ ring, bb, c: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2] });
    }
  }
  return out;
}

/* ---- canopy height tiles ---- */
const chmOpen = new Map();
export async function chm(lon, lat) {
  const k = quadkey(lon, lat, 9);
  if (!chmOpen.has(k)) { const im = await (await fromUrl(CHM + k + '.tif', { cacheSize: 3000 })).getImage(); chmOpen.set(k, { im, origin: im.getOrigin(), res: im.getResolution() }); }
  return chmOpen.get(k);
}

/* The house: the largest outline whose centre is inside the lot (garages and sheds are
   smaller). Returns null when the outline set has nothing on the lot. */
export function pickHouse(lotRings, buildings) {
  let best = null, bestA = 0;
  for (const b of buildings) {
    if (!inRings(b.c[0], b.c[1], lotRings)) continue;
    const r = b.ring.map(([lo, la]) => merc(lo, la)), a = ringArea(r);
    if (a > bestA) { bestA = a; best = { ...b, m: r }; }
  }
  return best;
}

/* The measurement. Returns { z1, z2, z3 } as tree-cover shares (0-1) of the lot area in
   each zone, the pixel counts behind them, the tallest tree in zones 1-2 (m), and the
   house's footprint in sq ft. */
export async function measure(lat, lon, lotRings, house) {
  const k = Math.cos(lat * Math.PI / 180);
  const H = house.m, P = lotRings.map((r) => r.map(([lo, la]) => merc(lo, la)));
  const hb = bboxOf(H), pad = ZONES.z3 / k;
  const ch = await chm(lon, lat);
  const { im, origin, res } = ch;
  const c0 = Math.max(0, Math.floor((hb[0] - pad - origin[0]) / res[0])), c1 = Math.min(im.getWidth(), Math.ceil((hb[2] + pad - origin[0]) / res[0]));
  const r0 = Math.max(0, Math.floor((hb[3] + pad - origin[1]) / res[1])), r1 = Math.min(im.getHeight(), Math.ceil((hb[1] - pad - origin[1]) / res[1]));
  if (c1 <= c0 || r1 <= r0) return { err: 'house off the height-map tile' };
  const HT = (await im.readRasters({ window: [c0, r0, c1, r1] }))[0], w = c1 - c0;
  const n = { z1: 0, z2: 0, z3: 0 }, t = { z1: 0, z2: 0, z3: 0 }; let tallest = 0;
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const X = origin[0] + (c + 0.5) * res[0], Y = origin[1] + (r + 0.5) * res[1];
    if (X < hb[0] - pad || X > hb[2] + pad || Y < hb[1] - pad || Y > hb[3] + pad) continue;
    if (inRing(X, Y, H) || !inRings(X, Y, P)) continue;
    const dm = ringDist(X, Y, H) * k;
    const z = dm <= ZONES.z1 ? 'z1' : dm <= ZONES.z2 ? 'z2' : dm <= ZONES.z3 ? 'z3' : null;
    if (!z) continue;
    const h = HT[(r - r0) * w + (c - c0)];
    n[z]++;
    if (h >= TALL) { t[z]++; if (z !== 'z3' && h > tallest) tallest = h; }
  }
  const share = (z) => (n[z] ? +(t[z] / n[z]).toFixed(2) : null);
  const px = res[0] * k * -res[1] * k;
  return { z1: share('z1'), z2: share('z2'), z3: share('z3'), n: [n.z1, n.z2, n.z3], h: Math.round(tallest), hs: Math.round(ringArea(H) * k * k * 10.7639), px: +px.toFixed(2) };
}

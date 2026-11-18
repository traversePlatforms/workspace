// The door's point and lot size from the county's lot outline (18 Nov 2026), for metros/build-doors.mjs and metros/fix-points.mjs.
//
// Why this file: build-doors.mjs worked the centre out in whole metres from the equator and Greenwich (x about -9.2 million m in
// Houston). The cross products of numbers that size lose the lot's own detail, so a small lot's centre came out off by a median
// 6.4 m and up to tens of metres: 24% of the Houston dots sat outside their own lot (checked 18 Nov against the outlines). Measured
// from the lot's first corner instead, the same sums are exact to a millimetre: 99.9% of the centres fall inside. For the rest
// (L- and U-shaped lots, whose centre of area can be outside them) the point is moved to the middle of the lot's widest crossing.
// Lot size was never affected (the area sum stays accurate at either origin).

const M_LAT = 110540;

/* point in the lot (even-odd over every ring, so holes and multi-part lots count right) */
export function insideLot(lon, lat, rings) {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* a point inside the lot: the middle of its widest east-west crossing, on the given line of latitude */
function crossing(rings, lat) {
  const xs = [];
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat)) xs.push((xj - xi) * (lat - yi) / (yj - yi) + xi);
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  return best ? { lon: (best[0] + best[1]) / 2, w: best[1] - best[0] } : null;
}
function interiorPoint(rings, lat) {
  let lo = Infinity, hi = -Infinity;
  for (const r of rings) for (const p of r) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  let best = null;
  for (const y of [lat, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.3, lo + (hi - lo) * 0.7]) {
    const c = crossing(rings, y); if (c && (!best || c.w > best.w)) best = { lon: c.lon, lat: y, w: c.w };
  }
  return best;
}

/* { sqm, lon, lat } for the outline's rings ([[lon, lat], ...], closed), or null for an empty or flat one. lat0 = the town's latitude. */
export function areaCentre(rings, lat0) {
  if (!rings || !rings.length || !rings[0].length) return null;
  const k = Math.cos(lat0 * Math.PI / 180) * 111320, ox = rings[0][0][0], oy = rings[0][0][1];
  let A = 0, cx = 0, cy = 0;
  for (const r of rings) for (let i = 0, n = r.length; i < n - 1; i++) {
    const x1 = (r[i][0] - ox) * k, y1 = (r[i][1] - oy) * M_LAT, x2 = (r[i + 1][0] - ox) * k, y2 = (r[i + 1][1] - oy) * M_LAT, c = x1 * y2 - x2 * y1;
    A += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c;
  }
  if (!A) return null;
  let lon = ox + cx / (3 * A) / k, lat = oy + cy / (3 * A) / M_LAT;
  if (!insideLot(lon, lat, rings)) { const p = interiorPoint(rings, lat); if (p) { lon = p.lon; lat = p.lat; } }
  return { sqm: Math.abs(A / 2), lon, lat };
}

/* U.S. Census Bureau TIGER/Line roads, read straight from the county shapefiles (2026-10-29, the Security lot facts).
 * One file per county: tl_<year>_<state><county>_roads.zip from www2.census.gov/geo/tiger/TIGER<year>/ROADS/, kept in
 * security/cache/tiger/ (gitignored). Each zip is unpacked into its own folder; only the .shp (lines) and .dbf (FULLNAME, MTFCC)
 * are read, by the small readers below (no shapefile library needed). Coordinates are NAD83 degrees: within a metre or so of
 * the WGS84 door points, which is far below what the lot facts need. */
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/* the .shp header's box, without reading the lines: [xmin, ymin, xmax, ymax] */
export function shpBox(file) {
  const b = readFileSync(file).subarray(0, 100);
  return [b.readDoubleLE(36), b.readDoubleLE(44), b.readDoubleLE(52), b.readDoubleLE(60)];
}
/* polylines (shape type 3): an array of parts per record, each part an array of [lon, lat] */
function readShp(file) {
  const b = readFileSync(file), out = [];
  let o = 100;
  while (o + 8 <= b.length) {
    const len = b.readInt32BE(o + 4) * 2; const s = o + 8; o = s + len;
    const type = b.readInt32LE(s);
    if (type !== 3) { out.push(null); continue; }
    const np = b.readInt32LE(s + 36), n = b.readInt32LE(s + 40), parts = [];
    for (let i = 0; i < np; i++) parts.push(b.readInt32LE(s + 44 + 4 * i));
    const p0 = s + 44 + 4 * np, lines = [];
    for (let i = 0; i < np; i++) {
      const a = parts[i], z = i + 1 < np ? parts[i + 1] : n, pts = [];
      for (let k = a; k < z; k++) pts.push([b.readDoubleLE(p0 + 16 * k), b.readDoubleLE(p0 + 16 * k + 8)]);
      lines.push(pts);
    }
    out.push(lines);
  }
  return out;
}
/* the .dbf's text columns, as one object per record (only the fields asked for) */
function readDbf(file, want) {
  const b = readFileSync(file), n = b.readUInt32LE(4), hlen = b.readUInt16LE(8), rlen = b.readUInt16LE(10), fields = [];
  for (let o = 32, at = 1; b[o] !== 0x0d && o < hlen; o += 32) {
    const name = b.toString('latin1', o, o + 11).replace(/\0.*$/, ''), len = b[o + 16];
    fields.push({ name, at, len }); at += len;
  }
  const pick = fields.filter((f) => want.includes(f.name)), out = [];
  for (let i = 0; i < n; i++) {
    const r = hlen + i * rlen, row = {};
    for (const f of pick) row[f.name] = b.toString('utf8', r + f.at, r + f.at + f.len).trim();
    out.push(row);
  }
  return out;
}
/* every county zip in dir, unpacked once into dir/<name>/ ; returns [{ name, shp, dbf, box }] */
export function countyFiles(dir) {
  const out = [];
  for (const z of readdirSync(dir).filter((f) => /^tl_\d{4}_\d{5}_roads\.zip$/.test(f)).sort()) {
    const name = z.replace(/\.zip$/, ''), sub = join(dir, name), shp = join(sub, name + '.shp'), dbf = join(sub, name + '.dbf');
    if (!existsSync(shp)) { mkdirSync(sub, { recursive: true }); const r = spawnSync('unzip', ['-o', '-q', join(dir, z), '-d', sub]); if (r.status !== 0 || !existsSync(shp)) { console.log('skipped (not a whole zip yet?):', z); continue; } }
    out.push({ name, shp, dbf, box: shpBox(shp) });
  }
  return out;
}
/* one county's roads: [{ n: FULLNAME, c: MTFCC, lines: [[[lon, lat], ...], ...] }] */
export function readRoads(f) {
  const g = readShp(f.shp), a = readDbf(f.dbf, ['FULLNAME', 'MTFCC']);
  const out = [];
  for (let i = 0; i < g.length; i++) if (g[i] && a[i]) out.push({ n: a[i].FULLNAME || '', c: a[i].MTFCC || '', lines: g[i] });
  return out;
}

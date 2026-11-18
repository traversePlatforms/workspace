// The lot outlines a market install serves from our own server (18 Nov 2026, Houston: "We dont have property lines available?").
// Colorado's door cards ask the state's parcel map for the lot line (rounds.php action parcelat); Texas has no working statewide one, so
// for a metro the line comes from the county files we already hold (metros/out/<town>-lots.json, from the appraisal districts' own
// downloads: terms in metros/<metro>.json). One small file per few thousand doors, looked up by door id, so the server reads ~100 KB a time.
//   node metros/build-lot-files.mjs <metro> [town ...]
// Writes metros/out/lots/<town>-<n>.json.gz (n = crc32(door id) % shards, PHP's crc32 too) and metros/out/lots/index.json
// ({v, q, towns: {<town>: shards}}). build-editions.cjs copies them into a market install's <data>/rounds/lots/.
// Each lot: its rings, simplified to 0.2 m (Douglas-Peucker on a local plane; the county lines are good to a few feet at best), corners
// in millionths of a degree (~0.1 m), each ring [x0, y0, dx1, dy1, ...] with no closing corner.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const HERE = dirname(fileURLToPath(import.meta.url)), ROUNDS = join(HERE, '..', '..', '..', 'app', 'data', 'rounds'), OUT = join(HERE, 'out', 'lots');
const [metro, ...only] = process.argv.slice(2);
const M = JSON.parse(readFileSync(join(HERE, metro + '.json'), 'utf8'));
const PER = 2500, TOL = 0.2, Q = 1e6;
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
export function crc32(s) { const b = Buffer.from(s, 'utf8'); let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function simplify(pts, k) {   /* Douglas-Peucker, pts [[lon, lat]], tolerance TOL metres */
  const n = pts.length; if (n < 4) return pts;
  const X = pts.map((p) => p[0] * k), Y = pts.map((p) => p[1] * 110540), keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let dm = 0, im = -1; const dx = X[b] - X[a], dy = Y[b] - Y[a], L = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) { const d = L ? Math.abs(dy * (X[i] - X[a]) - dx * (Y[i] - Y[a])) / L : Math.hypot(X[i] - X[a], Y[i] - Y[a]); if (d > dm) { dm = d; im = i; } }
    if (dm > TOL) { keep[im] = 1; st.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function encode(rings, k) {
  const out = [];
  for (const r0 of rings) {
    let r = r0.length > 1 && r0[0][0] === r0[r0.length - 1][0] && r0[0][1] === r0[r0.length - 1][1] ? r0 : r0.concat([r0[0]]);
    r = simplify(r, k).slice(0, -1);   /* the closing corner goes: the server puts it back */
    if (r.length < 3) continue;
    const e = []; let px = 0, py = 0;
    r.forEach((p, i) => { const x = Math.round(p[0] * Q), y = Math.round(p[1] * Q); e.push(i ? x - px : x, i ? y - py : y); px = x; py = y; });
    out.push(e);
  }
  return out.length ? out : null;
}
mkdirSync(OUT, { recursive: true });
const ixf = join(OUT, 'index.json'), IX = existsSync(ixf) ? JSON.parse(readFileSync(ixf, 'utf8')) : { towns: {} };
Object.assign(IX, { v: 1, q: Q, built: new Date().toISOString().slice(0, 10), tolerance: TOL + ' m',
  source: Object.values(M.sources).map((s) => s.label).join('; ') + ' (each district\'s own parcel download; terms in metros/' + metro + '.json)' });
let doors = 0, withLot = 0, bytes = 0, files = 0;
for (const T of M.towns.filter((t) => !only.length || only.includes(t.key))) {
  const fd = join(ROUNDS, T.key + '.json'), fl = join(HERE, 'out', T.key + '-lots.json');
  if (!existsSync(fd) || !existsSync(fl)) { console.log(`${T.key}: not built, skipped`); continue; }
  const L = JSON.parse(readFileSync(fl, 'utf8')).lots, D = JSON.parse(readFileSync(fd, 'utf8'));
  const k = Math.cos(T.center[0] * Math.PI / 180) * 111320;
  const ids = []; for (const a of D.areas) for (const d of a.doors) ids.push(d);
  const n = Math.max(1, Math.ceil(ids.length / PER)), shards = Array.from({ length: n }, () => ({}));
  let tw = 0;
  for (const d of ids) {
    doors++; const r = L[`${d.lat},${d.lon}`]; if (!r) continue;
    const e = encode(r, k); if (!e) continue;
    shards[crc32(d.id) % n][d.id] = e; withLot++; tw++;
  }
  for (const f of readdirSync(OUT)) if (f.startsWith(T.key + '-') && /^\d+\.json\.gz$/.test(f.slice(T.key.length + 1))) unlinkSync(join(OUT, f));   /* the town's old shards */
  shards.forEach((s, i) => { const b = gzipSync(JSON.stringify(s), { level: 9 }); writeFileSync(join(OUT, `${T.key}-${i}.json.gz`), b); bytes += b.length; files++; });
  IX.towns[T.key] = n;
  console.log(`${T.key}: ${tw} of ${ids.length} doors, ${n} files`);
}
writeFileSync(ixf, JSON.stringify(IX));
console.log(`${withLot} of ${doors} doors have a lot line; ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);

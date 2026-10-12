/* When the hail fell (2026-10-12, Matthew: "go ahead and add the hourly radar"). The daily radar maximum (build-hail.mjs) says how big
 * and where; this says what hours. For every storm day in hail-storms.json, the radar's instantaneous hail estimate (MRMS MESH,
 * every 2 minutes, archived by Iowa State: /YYYY/MM/DD/mrms/ncep/MESH/) is read every 20 minutes from 11 am to 11 pm Colorado
 * time, and for each town that had the storm, the hours when 0.75 in or more showed anywhere over its doors are kept.
 *   node build-hail-hours.mjs [--conc=4]       resumes: days already done are kept in hail-hours.json
 * Writes app/data/rounds/hail-hours.json { source, built, days: { date: { town: [15, 16, ...] } } }   (local hours, 0-23) */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeMesh } from './mesh.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const ARCHIVE = 'https://mtarchive.geol.iastate.edu', MIN_MM = 19.05, UA = { 'User-Agent': 'Traverse-hail/1.0 (M.Sharpe@TraversePlatforms.com)' };
const CONC = +((process.argv.find((a) => a.startsWith('--conc=')) || '').split('=')[1] || 4);
const OUT = join(DATA, 'hail-hours.json');
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { days: {} };
const storms = JSON.parse(readFileSync(join(DATA, 'hail-storms.json'), 'utf8')).storms;
/* each town's door box */
const box = {};
const townBox = (k) => {
  if (box[k] !== undefined) return box[k];
  let d; try { d = JSON.parse(readFileSync(join(DATA, k + '.json'), 'utf8')); } catch (e) { return (box[k] = null); }
  let n = -90, s = 90, w = 180, e = -180;
  for (const a of (d.areas || d)) for (const x of a.doors) if (typeof x.lat === 'number') { n = Math.max(n, x.lat); s = Math.min(s, x.lat); w = Math.min(w, x.lon); e = Math.max(e, x.lon); }
  return (box[k] = n > s ? { n: n + 0.01, s: s - 0.01, w: w - 0.01, e: e + 0.01 } : null);
};
const listing = new Map();
async function files(utcDay) {           /* the 2-minute file names in one UTC day's folder */
  if (listing.has(utcDay)) return listing.get(utcDay);
  const p = utcDay.replace(/-/g, '/');
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(`${ARCHIVE}/${p}/mrms/ncep/MESH/`, { headers: UA }); if (r.ok) { const t = await r.text(); const set = new Set([...t.matchAll(/href="(MESH_00\.50_\d{8}-\d{6}\.grib2\.gz)"/g)].map((m) => m[1])); listing.set(utcDay, set); return set; } if (r.status === 404) break; } catch (e) {}
    await new Promise((z) => setTimeout(z, 1500 * (i + 1)));
  }
  listing.set(utcDay, new Set()); return listing.get(utcDay);
}
async function sample(utc) {             /* the file nearest this time (within 4 minutes), decoded */
  const day = utc.toISOString().slice(0, 10), set = await files(day);
  for (const dm of [0, 2, -2, 4, -4]) {
    const t = new Date(utc.getTime() + dm * 60000); if (t.toISOString().slice(0, 10) !== day) continue;
    const name = 'MESH_00.50_' + t.toISOString().slice(0, 10).replace(/-/g, '') + '-' + t.toISOString().slice(11, 16).replace(':', '') + '00.grib2.gz';
    if (!set.has(name)) continue;
    for (let i = 0; i < 3; i++) {
      try { const r = await fetch(`${ARCHIVE}/${day.replace(/-/g, '/')}/mrms/ncep/MESH/${name}`, { headers: UA }); if (r.ok) return decodeMesh(gunzipSync(Buffer.from(await r.arrayBuffer()))); } catch (e) {}
      await new Promise((z) => setTimeout(z, 1500 * (i + 1)));
    }
  }
  return null;
}
const offsetH = (date) => { const s = new Date(date + 'T12:00:00Z').toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', hour12: false }); return 12 - +s; };   /* 6 (MDT) or 7 (MST) */
const todo = storms.filter((s) => !out.days[s.date]);
console.log(storms.length, 'storm days,', todo.length, 'to do');
let done = 0;
for (const st of todo) {
  const towns = Object.keys(st.towns || {}).filter((k) => townBox(k));
  const hrs = {}; for (const k of towns) hrs[k] = new Set();
  const off = offsetH(st.date), times = [];
  for (let h = 11; h <= 22; h++) for (let m = 0; m < 60; m += 20) times.push([h, new Date(Date.parse(st.date + 'T00:00:00Z') + ((h + off) * 60 + m) * 60000)]);
  let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < times.length) {
      const [h, utc] = times[i++]; const g = await sample(utc); if (!g) continue;
      for (const k of towns) {
        if (hrs[k].has(h)) continue; const b = box[k];
        const r0 = g.row(b.n), r1 = g.row(b.s), c0 = g.col(b.w), c1 = g.col(b.e); let hit = false;
        for (let r = r0; r <= r1 && !hit; r++) for (let c = c0; c <= c1; c++) if (g.mm(r, c) >= MIN_MM) { hit = true; break; }
        if (hit) hrs[k].add(h);
      }
    }
  }));
  out.days[st.date] = Object.fromEntries(Object.entries(hrs).filter(([, v]) => v.size).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
  out.source = 'NOAA/NSSL MRMS MESH every 2 minutes (sampled each 20), archived by Iowa State University'; out.built = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(out));
  console.log(++done + '/' + todo.length, st.date, JSON.stringify(out.days[st.date]).slice(0, 160));
}

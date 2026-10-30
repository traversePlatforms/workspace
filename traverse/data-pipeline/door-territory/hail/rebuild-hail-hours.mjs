/* When the hail fell, for every hail town and every day (2026-10-29, Matthew: "run it on the cloud computer once it is free").
 * build-hail-hours.mjs timed the storm days of hail-storms.json for the towns that had them when it ran (27 towns, 66 days on 2026-10-12)
 * and only adds days it has not seen, so towns added since (Groups 1-3) never got hours for the old days. This rebuilds the whole file:
 * every date that any door's hail rows name (hail-<town>.json) or hail-storms.json lists, for every town with a hail file or a storm
 * that day. Same method as build-hail-hours.mjs: the radar's instantaneous hail estimate (MRMS MESH, every 2 minutes, archived by Iowa
 * State: mtarchive.geol.iastate.edu/YYYY/MM/DD/mrms/ncep/MESH/) read every 20 minutes from 11 am to 11 pm Colorado time; a town's hour
 * counts when 0.75 in or more showed anywhere over its doors' box. Two steps, so the heavy part runs on the cloud machine:
 *   node rebuild-hail-hours.mjs stage <plan.json>                 laptop: each town's door box and each date's towns (no owners, no ids)
 *   node rebuild-hail-hours.mjs build <plan.json> <out.json> [--conc=4]   anywhere: reads the radar, writes hail-hours.json; resumes
 *                                                                 (<out.json>.progress keeps the dates done, even those with no hours)
 * Output as the app reads it (rounds.php hailWithHours): { source, built, days: { date: { town: [15, 16, ...] } } } (local hours, 0-23). */
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeMesh } from './mesh.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), DATA = process.env.ROUNDS_DATA || join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const ARCHIVE = 'https://mtarchive.geol.iastate.edu', MIN_MM = 19.05, UA = { 'User-Agent': 'Traverse-hail/1.0 (M.Sharpe@TraversePlatforms.com)' };
const [mode, a1, a2] = process.argv.slice(2);
const CONC = +((process.argv.find((a) => a.startsWith('--conc=')) || '').split('=')[1] || 4);
const SOURCE = 'NOAA/NSSL MRMS MESH every 2 minutes (sampled each 20), archived by Iowa State University';
const writeAtomic = (f, s) => { writeFileSync(f + '.tmp', s); renameSync(f + '.tmp', f); };

if (mode === 'stage') {
  if (!a1) throw new Error('usage: stage <plan.json>');
  const side = readdirSync(DATA).filter((f) => /^hail-[a-z0-9-]+\.json$/.test(f) && !/^hail-(storms|hours|reports|paths|lsr)/.test(f));
  const dates = {}, towns = {};
  for (const f of side) {
    const k = f.slice(5, -5);
    let j; try { j = JSON.parse(readFileSync(join(DATA, f), 'utf8')); } catch (e) { console.log('unreadable', f); continue; }
    const seen = new Set();
    for (const rows of Object.values(j.doors || {})) for (const r of (typeof rows === 'string' ? JSON.parse(rows) : rows) || []) if (Array.isArray(r) && /^\d{4}-\d{2}-\d{2}$/.test(r[0])) seen.add(r[0]);
    for (const d of seen) (dates[d] = dates[d] || new Set()).add(k);
    towns[k] = null;
  }
  for (const s of JSON.parse(readFileSync(join(DATA, 'hail-storms.json'), 'utf8')).storms || []) for (const k of Object.keys(s.towns || {})) { (dates[s.date] = dates[s.date] || new Set()).add(k); towns[k] = null; }
  /* each town's door box, from its door file (positions only) */
  let nb = 0;
  for (const k of Object.keys(towns)) {
    let d; try { d = JSON.parse(readFileSync(join(DATA, k + '.json'), 'utf8')); } catch (e) { continue; }
    let n = -90, s = 90, w = 180, e = -180;
    for (const a of (d.areas || d)) for (const x of a.doors || []) if (typeof x.lat === 'number') { n = Math.max(n, x.lat); s = Math.min(s, x.lat); w = Math.min(w, x.lon); e = Math.max(e, x.lon); }
    if (n > s) { towns[k] = [+(n + 0.01).toFixed(4), +(s - 0.01).toFixed(4), +(w - 0.01).toFixed(4), +(e + 0.01).toFixed(4)]; nb++; }
  }
  const plan = { built: new Date().toISOString().slice(0, 10), towns: Object.fromEntries(Object.entries(towns).filter(([, b]) => b)), days: {} };
  for (const d of Object.keys(dates).sort()) { const t = [...dates[d]].filter((k) => plan.towns[k]).sort(); if (t.length) plan.days[d] = t; }
  writeAtomic(a1, JSON.stringify(plan));
  const pairs = Object.values(plan.days).reduce((x, t) => x + t.length, 0);
  console.log(`plan: ${nb} towns with a door box (of ${Object.keys(towns).length} with hail), ${Object.keys(plan.days).length} days, ${pairs} town-days -> ${a1}`);
  process.exit(0);
}
if (mode !== 'build' || !a1 || !a2) { console.error('usage: stage <plan.json> | build <plan.json> <out.json> [--conc=4]'); process.exit(2); }

const plan = JSON.parse(readFileSync(a1, 'utf8'));
const OUT = a2, PROG = a2 + '.progress';
const resume = existsSync(OUT) && existsSync(PROG);   /* both or neither (review 2026-10-30): a stray .progress with no output skipped its dates for good */
const out = resume ? JSON.parse(readFileSync(OUT, 'utf8')) : { days: {} };
const done = new Set(resume ? JSON.parse(readFileSync(PROG, 'utf8')) : []);
const listing = new Map(), unlisted = new Set();   /* unlisted: a day the archive would not list (not a 404): nothing is known about it, so it is not done */
async function files(utcDay) {           /* the 2-minute file names in one UTC day's folder */
  if (listing.has(utcDay)) return listing.get(utcDay);
  const p = utcDay.replace(/-/g, '/');
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(`${ARCHIVE}/${p}/mrms/ncep/MESH/`, { headers: UA }); if (r.ok) { const t = await r.text(); const set = new Set([...t.matchAll(/href="(MESH_00\.50_\d{8}-\d{6}\.grib2\.gz)"/g)].map((m) => m[1])); listing.set(utcDay, set); return set; } if (r.status === 404) { listing.set(utcDay, new Set()); return listing.get(utcDay); } } catch (e) {}
    await new Promise((z) => setTimeout(z, 1500 * (i + 1)));
  }
  unlisted.add(utcDay); return new Set();   /* not cached: tried again on the next date that needs this day, and the date is left for the next run */
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
const todo = Object.keys(plan.days).sort().filter((d) => !done.has(d));
console.log(Object.keys(plan.days).length, 'days in the plan,', todo.length, 'to do,', Object.keys(plan.towns).length, 'towns');
let n = 0, read = 0, missing = 0;
for (const date of todo) {
  const towns = plan.days[date], hrs = {}; for (const k of towns) hrs[k] = new Set();
  const off = offsetH(date), times = [];
  for (let h = 11; h <= 22; h++) for (let m = 0; m < 60; m += 20) times.push([h, new Date(Date.parse(date + 'T00:00:00Z') + ((h + off) * 60 + m) * 60000)]);
  let i = 0, got = 0; const failed = [];
  const look = (h, g) => {
    for (const k of towns) {
      if (hrs[k].has(h)) continue; const [bn, bs, bw, be] = plan.towns[k];
      const r0 = g.row(bn), r1 = g.row(bs), c0 = g.col(bw), c1 = g.col(be); let hit = false;
      for (let r = r0; r <= r1 && !hit; r++) for (let c = c0; c <= c1; c++) if (g.mm(r, c) >= MIN_MM) { hit = true; break; }
      if (hit) hrs[k].add(h);
    }
  };
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < times.length) { const [h, utc] = times[i++]; const g = await sample(utc); if (!g) { failed.push([h, utc]); continue; } got++; look(h, g); }
  }));
  for (const [h, utc] of failed) { await new Promise((z) => setTimeout(z, 3000)); const g = await sample(utc); if (g) { got++; look(h, g); } }   /* one more try for a file that did not come */
  const days = new Set(times.map(([, u]) => u.toISOString().slice(0, 10)));
  if ([...days].some((d) => unlisted.has(d))) { console.log(`${++n}/${todo.length} ${date}: the archive did not answer for its folder; left for the next run`); for (const d of days) unlisted.delete(d); continue; }   /* review 2026-10-30: an outage was being written down as "no hail" and never retried */
  read += got; if (!got) missing++;
  const day = Object.fromEntries(Object.entries(hrs).filter(([, v]) => v.size).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
  out.days[date] = day;   /* a day with no hours stays, empty, as build-hail-hours.mjs keeps it (so its weekly run does not redo it) */
  out.source = SOURCE; out.built = new Date().toISOString().slice(0, 10);
  done.add(date);
  writeAtomic(OUT, JSON.stringify(out)); writeAtomic(PROG, JSON.stringify([...done]));
  console.log(`${++n}/${todo.length} ${date} ${got}/${times.length} radar files, ${Object.keys(day).length}/${towns.length} towns with hours`);
}
const pairs = Object.values(out.days).reduce((x, d) => x + Object.keys(d).length, 0);
console.log(`done: ${Object.values(out.days).filter((d) => Object.keys(d).length).length} days with hours, ${pairs} town-days; ${read} radar files read${missing ? ', ' + missing + ' days with no radar files in the archive' : ''}`);

/* Hail that people measured on the ground, near each door (2026-10-12, Matthew: "add the NOAA storm database to better measure the
 * hail" and "the same day spotter reports"). The radar estimate (build-hail.mjs) says where hail fell; these say how big it was.
 *
 * Sources, merged:
 *   S  NOAA Storm Events Database (NCEI), the quality-checked record, about three months behind:
 *      https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/  StormEvents_details-ftp_v1.0_dYYYY_c*.csv.gz
 *   L  NWS Local Storm Reports (spotters, the public, weather service staff), the same day, via Iowa Environmental Mesonet
 *      (the wind pipeline's yearly cache, ../wind/cache/lsr-co-YYYY.csv; this year is fetched again here).
 *   A Storm Events record and a spotter report of the same hail (same Colorado day, within 2 km, size within 0.25 in) count once, as S.
 *
 *   node build-hail-reports.mjs [fetch] [build]      both when neither is given
 *
 * build writes, beside the door files (app/data/rounds/):
 *   hailrep-<town>.json  { source, built, through, radiusMi, doors: { id: ["YYYY-MM-DD|inches|miles|S or L", ...newest first] } }
 *                        reports of 0.75 in or more within RADIUS_MI of the house, at most CAP per door (largest kept).
 *   hail-reports.json    { source, built, through, pts: [[date, lat, lon, inches, S|L, place], ...] } within reach of any door, from 2020.
 * The server adds the last two weeks' spotter reports by itself each morning (rounds.php, hailRecentReports). */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const SE_CACHE = join(HERE, 'se-cache'), LSR_CACHE = join(HERE, '..', 'wind', 'cache');
const SE_DIR = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/';
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py';
const FROM = 2020, RADIUS_MI = 2, MIN_IN = 0.75, CAP = 8;
const UA = { 'User-Agent': 'Traverse-hail/1.0 (M.Sharpe@TraversePlatforms.com)' };
const args = process.argv.slice(2), doFetch = !args.length || args.includes('fetch'), doBuild = !args.length || args.includes('build');
const csvRow = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const localDay = (utc) => new Date(utc).toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
const miles = (a, b, c, d) => { const r = Math.PI / 180, h = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 7917.6 * Math.asin(Math.min(1, Math.sqrt(h))); };

if (doFetch) {
  mkdirSync(SE_CACHE, { recursive: true });
  const list = await (await fetch(SE_DIR, { headers: UA })).text();
  const year = new Date().getFullYear();
  for (let y = FROM; y <= year; y++) {
    const m = [...list.matchAll(new RegExp('StormEvents_details-ftp_v1\\.0_d' + y + '_c(\\d+)\\.csv\\.gz', 'g'))].map((x) => x[0]).sort().pop();
    if (!m) { console.log(y, 'no Storm Events file yet'); continue; }
    const out = join(SE_CACHE, m); if (existsSync(out)) { console.log(y, 'have', m); continue; }
    for (const f of readdirSync(SE_CACHE)) if (f.includes('_d' + y + '_')) { try { (await import('node:fs')).unlinkSync(join(SE_CACHE, f)); } catch (e) {} }
    const r = await fetch(SE_DIR + m, { headers: UA }); if (!r.ok) { console.log(y, 'download failed', r.status); continue; }
    writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log(y, 'downloaded', m);
  }
  /* this year's spotter reports, again (the wind pipeline refreshes them only when it runs) */
  const r = await fetch(`${IEM}?state=CO&wfo=ALL&sts=${year}-01-01T00:00Z&ets=${year + 1}-01-01T00:00Z&fmt=csv&justcsv=1`, { headers: UA });
  if (r.ok) { writeFileSync(join(LSR_CACHE, `lsr-co-${year}.csv`), await r.text()); console.log(year, 'spotter reports refreshed'); }
}

if (doBuild) {
  const reps = [];
  /* Storm Events */
  for (const f of readdirSync(SE_CACHE).filter((f) => f.endsWith('.csv.gz'))) {
    const lines = gunzipSync(readFileSync(join(SE_CACHE, f))).toString('utf8').split(/\r?\n/).filter(Boolean);
    const h = csvRow(lines.shift()); const ix = (k) => h.indexOf(k);
    const [iT, iS, iM, iLa, iLo, iYm, iD] = ['EVENT_TYPE', 'STATE', 'MAGNITUDE', 'BEGIN_LAT', 'BEGIN_LON', 'BEGIN_YEARMONTH', 'BEGIN_DAY'].map(ix);
    const iLoc = ix('BEGIN_LOCATION');
    for (const l of lines) {
      const v = csvRow(l); if (v[iT] !== 'Hail' || v[iS] !== 'COLORADO') continue;
      const la = +v[iLa], lo = +v[iLo], mag = +v[iM]; if (!la || !lo || !(mag > 0)) continue;
      const ym = v[iYm]; const day = ym.slice(0, 4) + '-' + ym.slice(4, 6) + '-' + String(v[iD]).padStart(2, '0');
      reps.push({ day, la, lo, in: mag, src: 'S', place: (v[iLoc] || '').slice(0, 40) });
    }
  }
  const seN = reps.length;
  /* spotter reports, dropping the ones Storm Events already holds */
  for (const f of readdirSync(LSR_CACHE).filter((f) => /^lsr-co-\d{4}\.csv$/.test(f))) {
    if (+f.slice(7, 11) < FROM) continue;
    const lines = readFileSync(join(LSR_CACHE, f), 'utf8').split(/\r?\n/).filter(Boolean); const h = csvRow(lines.shift());
    const ix = (k) => h.indexOf(k); const [iV, iLa, iLo, iM, iTy, iC] = ['VALID', 'LAT', 'LON', 'MAG', 'TYPECODE', 'CITY'].map(ix);
    for (const l of lines) {
      const v = csvRow(l); if (v[iTy] !== 'H') continue;
      const la = +v[iLa], lo = +v[iLo], mag = +v[iM]; if (!la || !lo || !(mag > 0)) continue;
      const t = v[iV]; const day = localDay(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(8, 10), +t.slice(10, 12)));
      if (reps.some((r) => r.src === 'S' && r.day === day && Math.abs(r.in - mag) <= 0.25 && miles(r.la, r.lo, la, lo) <= 1.25)) continue;
      reps.push({ day, la, lo, in: mag, src: 'L', place: (v[iC] || '').replace(/_/g, ',').slice(0, 40) });
    }
  }
  const through = reps.reduce((m, r) => r.day > m ? r.day : m, '');
  console.log('reports:', seN, 'Storm Events +', reps.length - seN, 'spotter-only, through', through);
  /* the doors, on a grid of 0.05 degrees */
  const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8')).regions.filter((r) => !r.metro);
  const grid = new Map(), cell = (la, lo) => Math.floor(la / 0.05) + ':' + Math.floor(lo / 0.05);
  const byTown = {};
  for (const r of idx) {
    let d; try { d = JSON.parse(readFileSync(join(DATA, r.key + '.json'), 'utf8')); } catch (e) { continue; }
    byTown[r.key] = {};
    for (const a of (d.areas || d)) for (const x of a.doors) {
      if (typeof x.lat !== 'number') continue; const k = cell(x.lat, x.lon);
      if (!grid.has(k)) grid.set(k, []); grid.get(k).push([r.key, x.id, x.lat, x.lon]);
    }
  }
  const pts = [];
  for (const rp of reps) {
    if (rp.in < MIN_IN) continue; let near = false;
    const c0 = Math.floor(rp.la / 0.05), c1 = Math.floor(rp.lo / 0.05);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [tk, id, la, lo] of grid.get((c0 + i) + ':' + (c1 + j)) || []) {
      const mi = miles(la, lo, rp.la, rp.lo); if (mi > RADIUS_MI) continue; near = true;
      (byTown[tk][id] = byTown[tk][id] || []).push([rp.day, rp.in, Math.round(mi * 10) / 10, rp.src]);
    }
    if (near) pts.push([rp.day, +rp.la.toFixed(3), +rp.lo.toFixed(3), rp.in, rp.src, rp.place]);
  }
  let nDoors = 0;
  for (const [tk, doors] of Object.entries(byTown)) {
    const out = {};
    for (const [id, list] of Object.entries(doors)) {
      /* one entry per day (the largest, nearest first on ties), the CAP largest kept, newest first */
      const day = new Map(); for (const e of list) { const p = day.get(e[0]); if (!p || e[1] > p[1] || (e[1] === p[1] && e[2] < p[2])) day.set(e[0], e); }
      const keep = [...day.values()].sort((a, b) => b[1] - a[1]).slice(0, CAP).sort((a, b) => b[0].localeCompare(a[0]));
      out[id] = keep.map((e) => e.join('|')); nDoors++;
    }
    writeFileSync(join(DATA, 'hailrep-' + tk + '.json'), JSON.stringify({ source: 'NOAA Storm Events Database (S) and NWS Local Storm Reports (L)', built: new Date().toISOString().slice(0, 10), through, radiusMi: RADIUS_MI, doors: out }));
  }
  pts.sort((a, b) => b[0].localeCompare(a[0]));
  writeFileSync(join(DATA, 'hail-reports.json'), JSON.stringify({ source: 'NOAA Storm Events Database (S) and NWS Local Storm Reports (L)', built: new Date().toISOString().slice(0, 10), through, pts }));
  console.log(nDoors, 'doors with a ground report of', MIN_IN, 'in or more within', RADIUS_MI, 'mi;', pts.length, 'report points near doors');
}

/* Damaging wind near each door (2026-10-05), admin-only in the app. Mirrors ../hail/build-hail.mjs.
 *
 * Source: NWS Local Storm Reports (LSRs), the archive kept by Iowa State's Iowa Environmental Mesonet:
 * https://mesonet.agron.iastate.edu/request/gis/lsrs.phtml  (CGI: /cgi-bin/request/gis/lsr.py, CSV, all of Colorado)
 * A report is a POINT: a measured gust at an airport / RAWS / mesonet station, a spotter's estimate, or a
 * description of damage (trees down, roof damage). The QUALIFIER column says M = measured, E = estimated,
 * U = unknown. Thunderstorm wind (G gust, D damage) AND non-thunderstorm wind (N gust, O damage, A high
 * sustained) are both kept: the Front Range's worst roof wind is usually a winter downslope event, not a storm.
 *
 * Reports are SPARSE. A house with no entry does not mean no wind there; it means nobody near it reported.
 *
 *   node build-wind.mjs fetch     download each year's Colorado CSV into cache/ (gitignored; current year refreshed daily)
 *   node build-wind.mjs build     door and storm files from the cache
 *   node build-wind.mjs all       both
 *
 * build writes, beside the door files (app/data/rounds/):
 *   wind-<town>.json  { source, radiusMi, minMph, built, from, through, cap, capped, format, doors: { id: ["date|mph|kind|miles", ...newest first] } }
 *                      (each report packed as text since 2026-10-08; mph is empty for a damage report with no number)
 *                      kind: 'measured' | 'estimated' | 'damage'; miles = whole miles from the house to the report.
 *                      One entry per door per local (Colorado) day: the strongest gust of 50 mph or more within RADIUS_MI,
 *                      else the nearest damage report. At most CAP entries per door (the strongest kept, then ordered
 *                      newest first); capped = how many doors had more days than that.
 *   wind-storms.json  { source, radiusMi, minMph, built, from, through, days, storms: [{ date, max, kind, reports, n,
 *                      towns: { key: { label, n, max, kind } }, pts: [[lat, lon, mph|null, kind, place, source], ...] }] }
 *                      one row per local day with at least one door touched; pts = every qualifying report within
 *                      RADIUS_MI of any door that day (for a map), newest day first. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cutoffs, keepWindDay } from '../storm-keep.mjs';
import { metros } from '../metros/registry.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
/* the metro builder (2026-10-11): WIND_METRO=<metro> builds that metro alone: its state's reports, its towns, its own storm file */
const METRO = process.env.WIND_METRO || '';
const MDEF = METRO ? metros().find((m) => m.key === METRO) : null;
if (METRO && !MDEF) throw new Error('no metro ' + METRO);
const METRO_GROUPS = new Set(metros().map((m) => m.group || m.key));
const STATE = MDEF ? MDEF.state : 'CO', st = STATE.toLowerCase();
const SUFFIX = METRO ? '-' + METRO : '';
const CACHE = join(HERE, 'cache');
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py';
const SOURCE = 'NWS Local Storm Reports via Iowa Environmental Mesonet (mesonet.agron.iastate.edu/request/gis/lsrs.phtml)';
const FROM = '2020-01-01';
const RADIUS_MI = 10;      /* a report this far from the house counts; the distance is stored so the app can say how far */
const MIN_MPH = 50;        /* gusts below this are dropped (NWS "severe" is 58; 50 catches the measured station gusts that bracket it) */
const CAP = 10;            /* entries kept per door */
const TYPES = { G: 'tstm gust', D: 'tstm damage', N: 'wind gust', O: 'wind damage', A: 'sustained wind' };
const DAMAGE = new Set(['D', 'O']);
/* reports from a mountain SUMMIT say nothing about a house below it: the Pikes Peak summit station (14,115 ft,
   "1 N Pikes Peak", 38.84 -105.04) is within 10 mi of Cripple Creek and Woodland Park and reads 95 mph on an
   ordinary windy day. Ridge RAWS stations (Rampart, Manchester, Carpenter Peak) are kept: they are exposed, but
   they sit at the same height as the houses around them. Add a pattern here to drop a station; see README. */
const EXCLUDE_PLACE = /PIKES PEAK/i;
const TZ = MDEF && MDEF.timezone ? MDEF.timezone : 'America/Denver';

function towns() {
  const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  return (idx.regions || idx).map((r) => (typeof r === 'string' ? { key: r } : r)).filter((r) => r.key && (METRO ? r.group === METRO : !METRO_GROUPS.has(r.group)));
}
/** only id, lat, lon leave the door file: the file carries owners' names and they stay there */
function doorsOf(key) {
  const d = JSON.parse(readFileSync(join(DATA, key + '.json'), 'utf8'));
  const out = []; for (const a of d.areas) for (const x of a.doors) if (x.lat && x.lon) out.push({ id: x.id, lat: x.lat, lon: x.lon });
  return out;
}
const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
/** UTC "2021/12/15 19:32" -> the Colorado calendar day it fell on */
const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const localDay = (valid2) => localFmt.format(new Date(valid2.replace(' ', 'T').replace(/\//g, '-') + ':00Z'));

const R_MI = 3958.8;
function miles(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180, dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(a));
}

/* ---------- fetch ---------- */
async function get(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'DoorApp-wind/1.0 (research; contact via sixfoldcolorado.com)' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { if (t === 2) throw e; await new Promise((z) => setTimeout(z, 3000 * (t + 1))); }
  }
}
async function fetchAll() {
  mkdirSync(CACHE, { recursive: true });
  const y0 = +FROM.slice(0, 4), y1 = +today().slice(0, 4);
  for (let y = y0; y <= y1; y++) {
    const f = join(CACHE, `lsr-${st}-${y}.csv`);
    if (existsSync(f)) {
      const ageH = (Date.now() - statSync(f).mtimeMs) / 3600000;
      if (y < y1 || ageH < 20) { console.log(`  ${y}: cached`); continue; }   /* past years never change here; this year refreshes daily */
    }
    const url = `${IEM}?state=${STATE}&wfo=ALL&sts=${y}-01-01T00:00Z&ets=${y + 1}-01-01T00:00Z&fmt=csv&justcsv=1`;
    const txt = await get(url);
    if (!/^VALID,VALID2,LAT,LON,MAG/.test(txt)) throw new Error(`${y}: not a LSR CSV (${txt.slice(0, 80)})`);
    writeFileSync(f, txt);
    console.log(`  ${y}: ${txt.split('\n').length - 1} rows`);
  }
}

/* ---------- build ---------- */
/** CSV with a possible quoted field (IEM swaps commas in remarks for underscores, but be safe) */
function csvRows(txt) {
  const rows = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line) continue;
    const c = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { c.push(cur); cur = ''; }
      else cur += ch;
    }
    c.push(cur); rows.push(c);
  }
  return rows;
}
/** every Colorado wind report since FROM: { day, lat, lon, mph, kind, type, place, src } */
function loadReports() {
  const out = [], seen = new Set();
  const files = [];
  for (let y = +FROM.slice(0, 4); y <= +today().slice(0, 4); y++) { const f = join(CACHE, `lsr-${st}-${y}.csv`); if (existsSync(f)) files.push(f); }
  if (!files.length) throw new Error('nothing downloaded: run fetch first');
  let raw = 0, dup = 0, summit = 0;
  for (const f of files) {
    const rows = csvRows(readFileSync(f, 'utf8'));
    const h = rows.shift(), col = Object.fromEntries(h.map((k, i) => [k.trim(), i]));
    for (const r of rows) {
      const type = r[col.TYPECODE];
      if (!TYPES[type]) continue;
      if (r[col.STATE] !== STATE) continue;
      raw++;
      const day = localDay(r[col.VALID2]);
      if (day < FROM) continue;
      const lat = +r[col.LAT], lon = +r[col.LON]; if (!lat || !lon) continue;
      if (EXCLUDE_PLACE.test(r[col.CITY] || '')) { summit++; continue; }
      const mag = parseFloat(r[col.MAG]); const mph = mag > 0 ? Math.round(mag) : null;
      const q = (r[col.QUALIFIER] || '').trim().toUpperCase();
      let kind;
      if (DAMAGE.has(type)) kind = 'damage';
      else if (mph === null) continue;                 /* a gust report with no number says nothing we can rank */
      else if (mph < MIN_MPH) continue;
      else kind = q === 'M' ? 'measured' : 'estimated';   /* E and U both read as estimated: nobody measured it */
      const key = [day, lat.toFixed(2), lon.toFixed(2), type, mph].join('|');   /* IEM carries re-issued duplicates */
      if (seen.has(key)) { dup++; continue; }
      seen.add(key);
      out.push({ day, lat, lon, mph, kind, type, place: (r[col.CITY] || '').trim(), src: (r[col.SOURCE] || '').trim() });
    }
  }
  console.log(`${raw} Colorado wind rows read, ${out.length} kept (${dup} duplicates and ${summit} summit reports dropped; gusts under ${MIN_MPH} mph dropped unless damage)`);
  return out;
}
/* for the cap: a damage report with no number ranks as 58 mph, the NWS severe threshold a damage report implies */
const rank = (e) => e[1] ?? 58;

function build() {
  const reports = loadReports();
  const through = reports.reduce((m, r) => (r.day > m ? r.day : m), FROM);
  const built = today();
  const meta = { source: SOURCE, radiusMi: RADIUS_MI, minMph: MIN_MPH, built, from: FROM, through };
  const storms = {};   /* day -> { date, max, kind, reports:Set(idx), n, towns } */
  /* a bounding box pre-filter around all doors, generous by the radius */
  const degLat = RADIUS_MI / 69, degLon = RADIUS_MI / 54;
  let total = 0;
  const perTown = [];
  for (const t of towns()) {
    let ds; try { ds = doorsOf(t.key); } catch { console.log(`  ${t.key}: no door file`); continue; }
    let s = 90, n = -90, w = 180, e = -180;
    for (const d of ds) { s = Math.min(s, d.lat); n = Math.max(n, d.lat); w = Math.min(w, d.lon); e = Math.max(e, d.lon); }
    const near = reports.map((r, i) => ({ r, i })).filter(({ r }) => r.lat > s - degLat && r.lat < n + degLat && r.lon > w - degLon && r.lon < e + degLon);
    const byDay = new Map();
    for (const x of near) { const k = x.r.day; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(x); }
    const doors = {};
    for (const d of ds) {
      const list = [];
      for (const [day, xs] of byDay) {
        let best = null, bestMi = 0, bestI = -1, dmg = null, dmgMi = 1e9, dmgI = -1;
        for (const { r, i } of xs) {
          if (Math.abs(r.lat - d.lat) > degLat || Math.abs(r.lon - d.lon) > degLon) continue;
          const mi = miles(d.lat, d.lon, r.lat, r.lon); if (mi > RADIUS_MI) continue;
          if (r.kind === 'damage') { if (mi < dmgMi) { dmg = r; dmgMi = mi; dmgI = i; } }
          else if (!best || r.mph > best.mph || (r.mph === best.mph && mi < bestMi)) { best = r; bestMi = mi; bestI = i; }
        }
        let pick = null, mi = 0, idx = -1;
        if (best && (!dmg || best.mph >= (dmg.mph || 0))) { pick = best; mi = bestMi; idx = bestI; }
        else if (dmg) { pick = dmg; mi = dmgMi; idx = dmgI; }
        if (!pick) continue;
        const entry = [day, pick.mph, pick.kind, Math.round(mi)];
        list.push(entry);
        const st = storms[day] = storms[day] || { date: day, max: 0, kind: 'damage', reports: new Set(), n: 0, towns: {} };
        const tw = st.towns[t.key] = st.towns[t.key] || { label: t.label || t.key, n: 0, max: 0, kind: 'damage' };
        st.n++; tw.n++;
        for (const { r, i } of xs) if (miles(d.lat, d.lon, r.lat, r.lon) <= RADIUS_MI) st.reports.add(i);
        if (pick.mph && pick.mph > st.max) { st.max = pick.mph; st.kind = pick.kind; }
        if (pick.mph && pick.mph > tw.max) { tw.max = pick.mph; tw.kind = pick.kind; }
      }
      if (list.length) doors[d.id] = list;
    }
    perTown.push({ t, ds, doors });
  }
  /* the keep rule (Matthew 2026-10-06), by storm day: two years, five for a gust of 75 mph or more; then the cap */
  const cut = cutoffs(), kept = new Set(Object.values(storms).filter((s) => keepWindDay(s.date, s.max, cut)).map((s) => s.date));
  for (const k of Object.keys(storms)) if (!kept.has(k)) delete storms[k];
  for (const { t, ds, doors } of perTown) {
    let capped = 0;
    for (const id of Object.keys(doors)) {
      const list = doors[id].filter((e) => kept.has(e[0]));
      if (!list.length) { delete doors[id]; continue; }
      list.sort((a, b) => rank(b) - rank(a) || (a[0] < b[0] ? 1 : -1));
      if (list.length > CAP) capped++;
      doors[id] = list.slice(0, CAP).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }
    /* each report as "date|mph|kind|miles" (2026-10-08): as small arrays, a big town's file took 78 MB in the server's memory;
       as text, about a fifth. The server turns them back into [date, mph or null, kind, miles] for the doors it sends. */
    const packed = {};
    for (const [id, l] of Object.entries(doors)) packed[id] = l.map((e) => `${e[0]}|${e[1] ?? ''}|${e[2]}|${e[3]}`);
    writeFileSync(join(DATA, `wind-${t.key}.json`), JSON.stringify({ ...meta, keep: cut, cap: CAP, capped, format: 'date|mph|kind|miles', doors: packed }));
    total += Object.keys(doors).length;
    const days = new Set(Object.values(doors).flat().map((e) => e[0]));
    console.log(`  ${t.key}: ${Object.keys(doors).length} of ${ds.length} doors with a report within ${RADIUS_MI} mi; ${days.size} storm days in the lists; ${capped} doors had more than ${CAP} days (strongest kept)`);
  }
  const list = Object.values(storms).sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => ({
    date: s.date, max: s.max || null, kind: s.max ? s.kind : 'damage', reports: s.reports.size, n: s.n, towns: s.towns,
    pts: [...s.reports].map((i) => reports[i]).sort((a, b) => (b.mph || 0) - (a.mph || 0)).map((r) => [r.lat, r.lon, r.mph, r.kind, r.place, r.src]),
  }));
  writeFileSync(join(DATA, `wind-storms${SUFFIX}.json`), JSON.stringify({ ...meta, days: list.length, storms: list }));
  console.log(`wind-storms.json: ${list.length} storm days, ${through} latest report; ${total} doors with at least one entry`);
}

const cmd = process.argv[2];
if (cmd === 'fetch') await fetchAll();
else if (cmd === 'build') build();
else if (cmd === 'all') { await fetchAll(); build(); }
else console.log('node build-wind.mjs fetch | build | all');

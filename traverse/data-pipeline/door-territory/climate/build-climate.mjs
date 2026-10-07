/* climate.json for the app (2026-10-07, TraverseYards): per town, the frost dates and the stations the server reads rainfall from.
 *   Frost: NOAA's 1991-2020 Climate Normals (NCEI Access Data Service, normals-annualseasonal-1991-2020) at the nearest station
 *     that has them: the date with even odds of the last 32 F night in spring and the first in fall, and the same for a 28 F
 *     hard freeze. (The token's older Climate Data Online service carries only the 1981-2010 normals, so it is not used for these.)
 *   Normal rain for any stretch of days: the same station's daily normals (normals-daily-1991-2020, YTD-PRCP-NORMAL).
 *   Rain gauges: the token's station search (Climate Data Online, GHCND) for gauges near the town that reported in the last two
 *     weeks, nearest first (CoCoRaHS volunteers and airports). The server reads their last 30 days itself, fresh.
 *   node build-climate.mjs     writes app/data/rounds/climate.json */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const TOKF = join(HERE, '..', 'noaa-token.txt');
const TOKEN = process.env.NOAA_TOKEN || (existsSync(TOKF) ? readFileSync(TOKF, 'utf8').trim() : '');
const CDO = 'https://www.ncei.noaa.gov/cdo-web/api/v2', ADS = 'https://www.ncei.noaa.gov/access/services/data/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function cdo(path) { for (let t = 0; t < 4; t++) { const r = await fetch(CDO + path, { headers: { token: TOKEN } }); if (r.ok) { await sleep(250); return r.json(); } await sleep(1500 * (t + 1)); } return {}; }
async function ads(q) { for (let t = 0; t < 3; t++) { try { const r = await fetch(`${ADS}?${q}&format=json`); if (r.ok) return r.json(); } catch {} await sleep(1500); } return []; }
const ymd = (d) => d.toISOString().slice(0, 10);
const trim = (v) => String(v ?? '').trim();

if (!TOKEN) throw new Error('no NOAA token: noaa-token.txt');
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const today = new Date(), since = ymd(new Date(today - 14 * 86400000));
const normCache = {}, out = { built: ymd(today), source: 'NOAA National Centers for Environmental Information', towns: {} };
for (const reg of idx.regions) {
  if (String(reg.key).startsWith('com-')) continue;
  const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
  /* the town's centre: the middle of its doors */
  const pts = JSON.parse(readFileSync(f, 'utf8')).areas.flatMap((a) => a.doors).filter((x) => x.lat != null);
  if (!pts.length) continue;
  const lat = pts.reduce((s, x) => s + x.lat, 0) / pts.length, lon = pts.reduce((s, x) => s + x.lon, 0) / pts.length;
  const town = {};
  /* frost and normal rain: the nearest normals station that has the 1991-2020 frost dates and daily rain normals */
  const ns = ((await cdo(`/stations?datasetid=NORMAL_DLY&extent=${lat - 0.4},${lon - 0.4},${lat + 0.4},${lon + 0.4}&limit=100`)).results || [])
    .map((s) => ({ id: s.id.replace('GHCND:', ''), name: s.name, km: km(lat, lon, s.latitude, s.longitude) })).sort((a, b) => a.km - b.km);
  for (const s of ns.slice(0, 6)) {
    const a = normCache[s.id] || (normCache[s.id] = { ann: (await ads(`dataset=normals-annualseasonal-1991-2020&stations=${s.id}`))[0] || {}, dly: await ads(`dataset=normals-daily-1991-2020&stations=${s.id}&dataTypes=YTD-PRCP-NORMAL&startDate=2010-01-01&endDate=2010-12-31`) });
    const first = trim(a.ann['ANN-TMIN-PRBFST-T32FP50']), last = trim(a.ann['ANN-TMIN-PRBLST-T32FP50']);
    const ytd = a.dly.filter((r) => r['YTD-PRCP-NORMAL'] != null && trim(r['YTD-PRCP-NORMAL']) !== '').map((r) => [trim(r.DATE), +trim(r['YTD-PRCP-NORMAL'])]);
    if (!/^\d\d\/\d\d$/.test(first) || !/^\d\d\/\d\d$/.test(last) || ytd.length < 360) continue;
    town.frost = { name: s.name.replace(/, CO US$/, ''), km: Math.round(s.km), last, first, hardLast: trim(a.ann['ANN-TMIN-PRBLST-T28FP50']) || null, hardFirst: trim(a.ann['ANN-TMIN-PRBFST-T28FP50']) || null };
    /* year-to-date normal rain by day of year (MM-DD order), for the normal over any 30 days */
    town.ytd = ytd.sort((x, y) => x[0].localeCompare(y[0])).map((r) => Math.round(r[1] * 100) / 100);
    town.ytdDays = ytd.map((r) => r[0]);
    break;
  }
  /* rain gauges that reported in the last two weeks, nearest first, mostly-complete ones only */
  const gs = ((await cdo(`/stations?datasetid=GHCND&datatypeid=PRCP&extent=${lat - 0.15},${lon - 0.15},${lat + 0.15},${lon + 0.15}&startdate=${since}&enddate=${ymd(today)}&limit=100`)).results || [])
    .filter((s) => (s.datacoverage || 0) >= 0.8)
    .map((s) => [s.id.replace('GHCND:', ''), s.name.replace(/, CO US$/, ''), Math.round(km(lat, lon, s.latitude, s.longitude))]).sort((a, b) => a[2] - b[2]).slice(0, 4);
  if (gs.length) town.gauges = gs;
  out.towns[reg.key] = town;
  console.log(`  ${reg.key}: frost ${town.frost ? `${town.frost.name} (${town.frost.km} km): last ${town.frost.last}, first ${town.frost.first}` : 'none'}; gauges ${gs.map((g) => g[1] + ' ' + g[2] + ' km').join(', ') || 'none'}`);
}
/* the day labels are the same for every station: keep them once */
const anyDays = Object.values(out.towns).find((t) => t.ytdDays);
if (anyDays) { out.ytdDays = anyDays.ytdDays; for (const t of Object.values(out.towns)) delete t.ytdDays; }
writeFileSync(join(DATA, 'climate.json'), JSON.stringify(out));
console.log(`climate.json: ${Object.keys(out.towns).length} towns, ${Object.values(out.towns).filter((t) => t.frost).length} with frost dates, ${Object.values(out.towns).filter((t) => t.gauges).length} with rain gauges`);

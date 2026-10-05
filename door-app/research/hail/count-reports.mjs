/* NOAA Storm Events hail reports in El Paso, Teller and Douglas counties, 2021-2026, and how many of our doors
   had a ground report within 2 km. Read-only measurement for the roofing data check. */
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const HERE = process.env.HAIL_DIR || '.';   /* where the downloaded files are */
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/door-app/site/data/rounds';
function parseCSV(s) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const COUNTIES = new Set(['EL PASO', 'TELLER', 'DOUGLAS']);
const reports = [];
for (const fn of readdirSync(HERE).filter((f) => f.endsWith('.csv.gz')).sort()) {
  const rows = parseCSV(gunzipSync(readFileSync(`${HERE}/${fn}`)).toString('utf8'));
  const h = rows[0], ix = (n) => h.indexOf(n);
  for (const r of rows.slice(1)) {
    if (r[ix('STATE')] !== 'COLORADO' || r[ix('EVENT_TYPE')] !== 'Hail' || !COUNTIES.has(r[ix('CZ_NAME')])) continue;
    reports.push({ y: fn.slice(1, 5), county: r[ix('CZ_NAME')], size: +r[ix('MAGNITUDE')], lat: +r[ix('BEGIN_LAT')], lon: +r[ix('BEGIN_LON')], when: r[ix('BEGIN_DATE_TIME')], dmg: r[ix('DAMAGE_PROPERTY')] });
  }
}
const byYear = {}; for (const r of reports) { const k = r.y + ' ' + r.county; byYear[k] = (byYear[k] || 0) + 1; }
console.log('Hail reports (NOAA Storm Events), by year and county:'); for (const k of Object.keys(byYear).sort()) console.log('  ', k, byYear[k]);
const sizes = { '<1in': 0, '1-1.75in': 0, '>=1.75in': 0 }; for (const r of reports) sizes[r.size < 1 ? '<1in' : r.size < 1.75 ? '1-1.75in' : '>=1.75in']++;
console.log('sizes:', sizes, 'total', reports.length, 'with damage $ recorded:', reports.filter((r) => r.dmg && r.dmg !== '0.00K').length);
/* our doors */
const idx = JSON.parse(readFileSync(`${DATA}/index.json`, 'utf8'));
const keys = (idx.regions || idx).map((r) => r.key || r).filter((k) => typeof k === 'string');
let doors = [];
for (const k of keys) { try { const d = JSON.parse(readFileSync(`${DATA}/${k}.json`, 'utf8')); for (const a of d.areas) for (const x of a.doors) if (x.lat) doors.push([x.lat, x.lon, k]); } catch {} }
const km = (a, b, c, d) => { const R = 6371, dl = (c - a) * Math.PI / 180, dn = (d - b) * Math.PI / 180, s = Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const near = (r, lim) => doors.filter((d) => km(d[0], d[1], r.lat, r.lon) <= lim).length;
const hit = new Set(), hitBig = new Set();
for (const r of reports) for (let i = 0; i < doors.length; i++) if (km(doors[i][0], doors[i][1], r.lat, r.lon) <= 2) { hit.add(i); if (r.size >= 1) hitBig.add(i); }
console.log(`doors: ${doors.length}; within 2 km of any hail report 2021-2026: ${hit.size} (${(100 * hit.size / doors.length).toFixed(1)}%); of a 1 in+ report: ${hitBig.size} (${(100 * hitBig.size / doors.length).toFixed(1)}%)`);
const byTown = {}; for (const i of hit) byTown[doors[i][2]] = (byTown[doors[i][2]] || 0) + 1;
const tot = {}; for (const d of doors) tot[d[2]] = (tot[d[2]] || 0) + 1;
for (const k of Object.keys(tot).sort()) console.log('  ', k.padEnd(15), `${byTown[k] || 0} of ${tot[k]}`);

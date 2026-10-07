/* Security facts per door for TraverseSecurity (2026-10-06). Matthew: Traverse sells information; the client decides how
 * to use it. So: as much verified detail as can be sourced, at AREA level for crime (no incident is ever put on a house).
 *
 *   node build-security.mjs        fetches what is missing into cache/, then writes into app/data/rounds/:
 *     security-<town>.json    per door { cs?, cr?, ab?, sold?, yb?, os? }
 *     security-areas.json     per town and neighbourhood: reported property crime nearby, last 30 and 90 days (for the list)
 *     security-rates.json     per town: its police or sheriff's last 12 reported months (FBI), and when they run to
 * Sources:
 *   - Colorado Springs Police Department, Crime Level Data (policedata.coloradosprings.gov, dataset bc88-hemr): each offence
 *     with its type, report date and hundred-block point. Property crimes only, never domestic, never crimes against people.
 *     Counted only for doors INSIDE Colorado Springs city limits (state Municipal Boundaries, OIT): outside them the data
 *     simply has no reports, which must not read as "no crime".
 *   - FBI Crime Data Explorer, summarized agency figures (api.usa.gov/crime/fbi/cde): burglary, motor vehicle theft and all
 *     property crime, monthly counts and rates per 100,000, for each town's police or sheriff.
 *   - El Paso's sale month, year built and open space come from the pest build (pest-<town>.json); owner lives elsewhere
 *     compares the owner's mailing address with the house (mail-<town>.json), a PO box counting as unknown.
 * cr (Colorado Springs doors): counts of reported offences, [last 30, 90, 365 days], by kind (b burglary, v vehicle: theft of
 * and from vehicles and parts, t other theft, d vandalism): m within 1 mile (the headline, Matthew 2026-10-06), h within
 * 1/2 mile, and the date of the latest of each kind within 1 mile. Dates only; never a location. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..');
const DATA = join(DT, '..', '..', 'app', 'data', 'rounds'), CACHE = join(HERE, 'cache');
const KEY = process.env.DATA_GOV_KEY || 'DEMO_KEY';
mkdirSync(CACHE, { recursive: true });
const today = new Date(), iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(today.getTime() - n * 86400000);

/* the agency that polices each town, and its FBI code */
const AGENCY = {
  monument: ['CO0210700', 'Monument Police Department'], 'palmer-lake': ['CO0210600', 'Palmer Lake Police Department'],
  'black-forest': ['CO0210000', "El Paso County Sheriff's Office"], 'castle-rock': ['CO0180100', 'Castle Rock Police Department'],
  larkspur: ['CO0180000', "Douglas County Sheriff's Office"], sedalia: ['CO0180000', "Douglas County Sheriff's Office"], franktown: ['CO0180000', "Douglas County Sheriff's Office"],
  'woodland-park': ['CO0600100', 'Woodland Park Police Department'], divide: ['CO0600000', "Teller County Sheriff's Office"], florissant: ['CO0600000', "Teller County Sheriff's Office"],
  'cripple-creek': ['CO0600200', 'Cripple Creek Police Department']
};
const CSPD = ['CO0210100', 'Colorado Springs Police Department'];
const KIND = {
  'Burglary/Breaking & Entering': 'b',
  'Motor Vehicle Theft': 'v', 'Theft From Motor Vehicle': 'v', 'Theft Of Motor Vehicle Parts': 'v',
  'All Other Larceny': 't', 'Theft From Building': 't',
  'Destruction/Damage/Vandalism of Property': 'd'
};

async function getJSON(url, tries = 4) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); const j = await r.json(); if (!r.ok && !j) throw new Error('HTTP ' + r.status); return j; }
    catch (e) { if (i >= tries) throw e; await new Promise((res) => setTimeout(res, 1500 * (i + 1))); }
  }
}
const cached = async (name, fn) => { const f = join(CACHE, name); if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8')); const v = await fn(); writeFileSync(f, JSON.stringify(v)); return v; };

/* ---- geometry ---- */
const proj = (lat0) => { const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540; return (lon, lat) => [lon * kx, lat * ky]; };
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const inRings = (x, y, rings) => { let inside = false; for (const r of rings) if (inRing(x, y, r)) inside = !inside; return inside; };
const MI = 1609.34;

/* ---- Colorado Springs city limits ---- */
/* the state layer (DOLA municipalities) holds the city as its original area plus every annexation, as separate pieces that
   can overlap: a house is inside when it is inside ANY piece (an even-odd test over all rings at once would cancel overlaps) */
const city = await cached('cs-boundary.json', async () => {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const q = new URLSearchParams({ where: "cityname = 'Colorado Springs'", outFields: 'OBJECTID', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '1000' });
    const j = await getJSON(`https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?${q}`);
    if (j.error) throw new Error('boundary: ' + JSON.stringify(j.error).slice(0, 200));
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) out.push(f.geometry.rings);
    if (!j.exceededTransferLimit && (j.features || []).length < 1000) break;
  }
  if (!out.length) throw new Error('Colorado Springs boundary not found');
  return out;
});
const pieces = city.map((rings) => ({ rings, bb: rings.flat().reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]) }));
const cityBB = pieces.reduce((b, p) => [Math.min(b[0], p.bb[0]), Math.min(b[1], p.bb[1]), Math.max(b[2], p.bb[2]), Math.max(b[3], p.bb[3])], [Infinity, Infinity, -Infinity, -Infinity]);
console.log(`Colorado Springs boundary: ${pieces.length} pieces`);

/* ---- doors and towns ---- */
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const towns = idx.regions.filter((r) => !String(r.key).startsWith('com-') && existsSync(join(DATA, `${r.key}.json`))).map((r) => r.key);
const doorsOf = {}; for (const t of towns) doorsOf[t] = JSON.parse(readFileSync(join(DATA, `${t}.json`), 'utf8'));
const inCity = (lat, lon) => lon >= cityBB[0] && lon <= cityBB[2] && lat >= cityBB[1] && lat <= cityBB[3]
  && pieces.some((p) => lon >= p.bb[0] && lon <= p.bb[2] && lat >= p.bb[1] && lat <= p.bb[3] && inRings(lon, lat, p.rings));
let cityDoors = [];
for (const t of towns) for (const a of doorsOf[t].areas) for (const d of a.doors) if (d.lat != null && inCity(d.lat, d.lon)) cityDoors.push(d);
console.log(`doors inside Colorado Springs: ${cityDoors.length}`);

/* ---- Colorado Springs reports, last 365 days, around those doors ---- */
let incidents = [];
if (cityDoors.length) {
  const la = cityDoors.map((d) => d.lat), lo = cityDoors.map((d) => d.lon), pad = 0.02;
  const box = [Math.max(...la) + pad, Math.min(...lo) - pad, Math.min(...la) - pad, Math.max(...lo) + pad];   /* N, W, S, E */
  const since = iso(daysAgo(366));
  incidents = await cached(`cspd-${iso(today)}.json`, async () => {
    const kinds = Object.keys(KIND).map((k) => `'${k.replace(/'/g, "''")}'`).join(',');
    const where = `reporteddate > '${since}' AND domestic = 'No' AND crimecodedescription IN (${kinds}) AND within_box(location_point, ${box.join(', ')})`;
    const out = [];
    for (let off = 0; ; off += 50000) {
      const q = new URLSearchParams({ $select: 'casenumber,reporteddate,crimecodedescription,location_point', $where: where, $limit: '50000', $offset: String(off), $order: 'casenumber' });
      const rows = await getJSON(`https://policedata.coloradosprings.gov/resource/bc88-hemr.json?${q}`);
      if (!Array.isArray(rows)) throw new Error('CSPD: ' + JSON.stringify(rows).slice(0, 200));
      for (const r of rows) if (r.location_point && r.location_point.coordinates) out.push({ c: r.casenumber, k: KIND[r.crimecodedescription], t: String(r.reporteddate).slice(0, 10), lon: r.location_point.coordinates[0], lat: r.location_point.coordinates[1] });
      if (rows.length < 50000) break;
    }
    /* one case can hold several offences: count each case once per kind */
    const seen = new Set(); return out.filter((x) => { const k = x.c + '|' + x.k; if (seen.has(k)) return false; seen.add(k); return true; });
  });
  console.log(`Colorado Springs property reports, last year, near our doors: ${incidents.length}`);
}
const P = proj(cityDoors.length ? cityDoors[0].lat : 39);
const inc = incidents.map((x) => ({ ...x, p: P(x.lon, x.lat), age: (today - new Date(x.t + 'T12:00:00')) / 86400000 }));
/* grid index, 1 mile cells */
const grid = new Map(), cellOf = (p) => `${Math.floor(p[0] / MI)},${Math.floor(p[1] / MI)}`;
for (const x of inc) { const k = cellOf(x.p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(x); }
const around = (p) => { const [cx, cy] = cellOf(p).split(',').map(Number), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...(grid.get(`${cx + a},${cy + b}`) || [])); return out; };


/* ---- Denver and Boulder (2026-10-07, the Security edition's towns) ----
   Both police departments publish every report with a map point, as Colorado Springs does:
     Denver: the city's open data, ArcGIS ODC_CRIME_OFFENSES_P layer 324 (OFFENSE_CATEGORY_ID / OFFENSE_TYPE_ID, GEO_LAT/GEO_LON,
       REPORTED_DATE), daily.
     Boulder: Boulder Police Department, ArcGIS BPD_Offenses layer 0 (nibrs_offense, Report_Date; points asked for in WGS84).
   The same four kinds as Colorado Springs (burglary; vehicle theft and break-ins; other theft, not shoplifting; vandalism), the
   last 365 days, counted only for doors inside that city's limits (outside them, no reports does not mean no crime). */
const muniPieces = async (name) => cached(`muni-${name.toLowerCase()}.json`, async () => {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const q = new URLSearchParams({ where: `cityname = '${name}'`, outFields: 'OBJECTID', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '1000' });
    const j = await getJSON(`https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?${q}`);
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) out.push(f.geometry.rings);
    if (!j.exceededTransferLimit && (j.features || []).length < 1000) break;
  }
  return out;
});
const arcgisAll = async (url, params) => {
  const out = [];
  for (let off = 0; ; off += 2000) {
    const j = await getJSON(url + '?' + new URLSearchParams({ ...params, resultOffset: String(off), resultRecordCount: '2000', f: 'json' }));
    if (j.error) throw new Error(url + ': ' + JSON.stringify(j.error).slice(0, 200));
    out.push(...(j.features || []));
    if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
  }
  return out;
};
const sinceSql = `TIMESTAMP '${iso(daysAgo(366))} 00:00:00'`;
const DEN_KIND = (cat, type) => cat === 'burglary' ? 'b' : (cat === 'auto-theft' || cat === 'theft-from-motor-vehicle') ? 'v'
  : (cat === 'larceny' && !/shoplift|services/.test(type)) ? 't' : /^criminal-mischief/.test(type) ? 'd' : null;
const BOU_KIND = { 'Burglary / Breaking and Entering': 'b', 'Motor Vehicle Theft': 'v', 'Theft from a Motor Vehicle': 'v', 'Theft of Motor Vehicle Parts or Accessories': 'v',
  'All Other Larceny': 't', 'Theft from a Building': 't', 'Destruction / Damage / Vandalism of Property': 'd' };
const OTHER = [
  { name: 'Denver', label: 'Denver police', fetch: async () => (await arcgisAll('https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_CRIME_OFFENSES_P/FeatureServer/324/query',
      { where: `REPORTED_DATE > ${sinceSql} AND IS_CRIME = 1 AND OFFENSE_CATEGORY_ID IN ('burglary','auto-theft','theft-from-motor-vehicle','larceny','public-disorder')`, outFields: 'INCIDENT_ID,OFFENSE_CATEGORY_ID,OFFENSE_TYPE_ID,REPORTED_DATE,GEO_LAT,GEO_LON', returnGeometry: 'false' }))
      .map((f) => f.attributes).map((a) => ({ c: 'D' + a.INCIDENT_ID, k: DEN_KIND(a.OFFENSE_CATEGORY_ID, a.OFFENSE_TYPE_ID || ''), t: new Date(a.REPORTED_DATE).toISOString().slice(0, 10), lat: a.GEO_LAT, lon: a.GEO_LON })) },
  { name: 'Boulder', label: 'Boulder police', fetch: async () => (await arcgisAll('https://services.arcgis.com/ePKBjXrBZ2vEEgWd/arcgis/rest/services/BPD_Offenses/FeatureServer/0/query',
      { where: `Report_Date > ${sinceSql}`, outFields: 'Report_Number,nibrs_offense,Report_Date', returnGeometry: 'true', outSR: '4326' }))
      .map((f) => ({ c: 'B' + f.attributes.Report_Number, k: BOU_KIND[f.attributes.nibrs_offense] || null, t: new Date(f.attributes.Report_Date).toISOString().slice(0, 10), lat: f.geometry && f.geometry.y, lon: f.geometry && f.geometry.x })) },
];
for (const c of OTHER) {
  const rings = await muniPieces(c.name);
  c.pieces = rings.map((r) => ({ rings: r, bb: r.flat().reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]) }));
  c.inside = (lat, lon) => c.pieces.some((p) => lon >= p.bb[0] && lon <= p.bb[2] && lat >= p.bb[1] && lat <= p.bb[3] && inRings(lon, lat, p.rings));
  c.doors = []; for (const t of towns) for (const a of doorsOf[t].areas) for (const d of a.doors) if (d.lat != null && c.inside(d.lat, d.lon)) c.doors.push(d);
  if (!c.doors.length) { console.log(`doors inside ${c.name}: 0`); continue; }
  const seen = new Set();
  const rows = (await cached(`${c.name.toLowerCase()}-${iso(today)}.json`, c.fetch)).filter((x) => x.k && Number.isFinite(x.lat) && Number.isFinite(x.lon))
    .filter((x) => { const key = x.c + '|' + x.k; if (seen.has(key)) return false; seen.add(key); return true; });   /* one case, several offences: once per kind */
  c.P = proj(c.doors[0].lat);
  c.grid = new Map();
  for (const x of rows) { const y = { ...x, p: c.P(x.lon, x.lat), age: (today - new Date(x.t + 'T12:00:00')) / 86400000 }; const k = cellOf(y.p); if (!c.grid.has(k)) c.grid.set(k, []); c.grid.get(k).push(y); }
  c.around = (p) => { const [cx, cy] = cellOf(p).split(',').map(Number), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(...(c.grid.get(`${cx + a},${cy + b}`) || [])); return out; };
  c.through = rows.reduce((m, x) => x.t > m ? x.t : m, '');
  c.ready = true;
  console.log(`doors inside ${c.name}: ${c.doors.length}; ${rows.length} property reports in the last year, through ${c.through}`);
}
/* counts around one door: m within 1 mile [30, 90, 365 days] by kind, h within 1/2 mile, the latest of each kind within 1 mile */
function crAround(city, d, areaSeen) {
  const p = city.P(d.lon, d.lat), z3 = () => ({ b: [0, 0, 0], v: [0, 0, 0], t: [0, 0, 0], d: [0, 0, 0] }), half = z3(), mile = z3(), last = {};
  for (const x of city.around(p)) {
    const dist = Math.hypot(x.p[0] - p[0], x.p[1] - p[1]);
    if (dist <= MI) {
      mile[x.k][2]++; if (x.age <= 90) mile[x.k][1]++; if (x.age <= 30) mile[x.k][0]++;
      if (!last[x.k] || x.t > last[x.k]) last[x.k] = x.t;
    }
    if (dist <= MI / 2) { half[x.k][2]++; if (x.age <= 90) half[x.k][1]++; if (x.age <= 30) half[x.k][0]++; }
    if (dist <= MI / 4) { if (x.age <= 90) areaSeen[90].set(x.c + x.k, x.k); if (x.age <= 30) areaSeen[30].set(x.c + x.k, x.k); }
  }
  return { m: mile, h: half, last, src: city.label };   /* src: whose reports (the card names them) */
}
const CS_CITY = { label: 'Colorado Springs police', P, around, ready: true };

/* ---- the town figures (FBI), last 12 reported months per agency ---- */
const OFF = { burglary: 'burglary', mvt: 'motor-vehicle-theft', property: 'property-crime' };
const ratesF = join(CACHE, 'fbi-rates.json'), fbi = existsSync(ratesF) ? JSON.parse(readFileSync(ratesF, 'utf8')) : {};
const agencies = [...new Set(Object.values(AGENCY).map((a) => a[0]).concat(CSPD[0]))];
const fromM = `${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear() - 2}`, toM = `${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
outer: for (const ori of agencies) for (const [k, slug] of Object.entries(OFF)) {
  if (fbi[ori] && fbi[ori][k]) continue;
  const j = await getJSON(`https://api.usa.gov/crime/fbi/cde/summarized/agency/${ori}/${slug}?from=${fromM}&to=${toM}&API_KEY=${KEY}`);
  if (!j.offenses) { console.log('FBI stopped (resume later):', JSON.stringify(j.error || j).slice(0, 160)); break outer; }
  const act = Object.entries(j.offenses.actuals || {}).find(([n]) => / Offenses$/.test(n)), rat = Object.entries(j.offenses.rates || {}).find(([n]) => / Offenses$/.test(n) && !/^(Colorado|United States)/.test(n));
  const months = Object.keys(act ? act[1] : {}).filter((m) => act[1][m] != null).sort((a, b) => (a.slice(3) + a.slice(0, 2)).localeCompare(b.slice(3) + b.slice(0, 2)));
  const last12 = months.slice(-12);
  fbi[ori] = fbi[ori] || {};
  fbi[ori][k] = { n: last12.reduce((s, m) => s + (act[1][m] || 0), 0), per1k: rat ? Math.round(last12.reduce((s, m) => s + (rat[1][m] || 0), 0) / 100 * 100) / 100 : null, from: last12[0] || null, to: last12[last12.length - 1] || null };
  writeFileSync(ratesF, JSON.stringify(fbi, null, 1));
}
const rates = { source: 'FBI Crime Data Explorer (api.usa.gov/crime/fbi/cde), summarized agency figures; the last 12 months each agency has reported', built: iso(today), towns: {}, agencies: {} };
for (const [ori, name] of Object.values(AGENCY).concat([CSPD])) rates.agencies[ori] = { name, ...(fbi[ori] || {}) };
for (const t of towns) if (AGENCY[t]) rates.towns[t] = AGENCY[t][0];
rates.cityAgency = CSPD[0];
writeFileSync(join(DATA, 'security-rates.json'), JSON.stringify(rates, null, 1));

/* ---- per door ---- */
const norm = (s) => String(s || '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
const areasOut = {};
let tot = 0; const hit = { cs: 0, ab: 0, sold: 0, yb: 0, os: 0 };
for (const t of towns) {
  const pestF = join(DATA, `pest-${t}.json`), pest = existsSync(pestF) ? JSON.parse(readFileSync(pestF, 'utf8')).doors : {};
  const mailF = join(DATA, `mail-${t}.json`), mail = existsSync(mailF) ? JSON.parse(readFileSync(mailF, 'utf8')) : {};
  const mailDoors = mail.doors || mail;
  const doors = {}; areasOut[t] = {};
  for (const a of doorsOf[t].areas) {
    const areaSeen = { 30: new Map(), 90: new Map() };
    for (const d of a.doors) {
      tot++;
      const o = {}, pp = pest[d.id] || {};
      if (pp.sold) { o.sold = pp.sold; hit.sold++; }
      if (pp.yb) { o.yb = pp.yb; hit.yb++; }
      if (pp.os) { o.os = pp.os; hit.os++; }
      const m = mailDoors[d.id];
      if (m && m.m) {
        const mailing = norm(String(m.m).split(',')[0]), house = norm(d.address);
        if (!/^(PO|P O|POST OFFICE) ?BOX|^BOX /.test(mailing) && mailing && house && mailing !== house && !(mailing.startsWith(house) || house.startsWith(mailing))) { o.ab = 1; hit.ab++; }
      }
      /* inside a city whose police publish their reports (cs = covered: the area list and the town line read it) */
      const city = d.lat == null ? null : inCity(d.lat, d.lon) ? CS_CITY : OTHER.find((c) => c.ready && c.inside(d.lat, d.lon));
      if (city) { o.cs = 1; hit.cs++; o.cr = crAround(city, d, areaSeen); }
      if (Object.keys(o).length) doors[d.id] = o;
    }
    if (a.doors.some((d) => doors[d.id] && doors[d.id].cs)) {
      const count = (mp) => { const c = { b: 0, v: 0, t: 0, d: 0 }; for (const k of mp.values()) c[k]++; return c; };
      areasOut[t][a.name] = { d30: count(areaSeen[30]), d90: count(areaSeen[90]), doors: a.doors.length };
    }
  }
  if (!Object.keys(areasOut[t]).length) delete areasOut[t];
  writeFileSync(join(DATA, `security-${t}.json`), JSON.stringify({ built: iso(today), doors }));
  console.log(`  security-${t}.json: ${Object.keys(doors).length} doors`);
}
writeFileSync(join(DATA, 'security-areas.json'), JSON.stringify({ built: iso(today), through: inc.reduce((m, x) => x.t > m ? x.t : m, ''), source: 'Colorado Springs, Denver and Boulder police (property crimes reported within 1/4 mile of the neighbourhood\'s doors)', towns: areasOut }));
console.log(`${tot} doors: inside Colorado Springs ${hit.cs}, owner lives elsewhere ${hit.ab}, sale month ${hit.sold}, year built ${hit.yb}, open space ${hit.os}`);
console.log('town figures:', Object.entries(rates.agencies).map(([o, a]) => `${a.name.replace(/ (Police Department|Sheriff's Office)/, '')}: ${a.burglary ? a.burglary.n + ' burglaries to ' + a.burglary.to : 'pending'}`).join(' | '));

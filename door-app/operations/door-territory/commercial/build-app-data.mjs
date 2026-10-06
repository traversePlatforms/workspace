/* Commercial test -> the app (2026-10-05). Admin-only regions, so the crew never see them.
 *
 *   node build-app-data.mjs     reads out/commercial-<spot>.json; writes into ../../../site/data/rounds/:
 *     com-<spot>.json         the door file (areas = building type x compass quarter), each door with a "com" block
 *     hail-com-<spot>.json    { through, from, doors: { id: [[date, inches], ...] } }       same shape as the house files
 *     wind-com-<spot>.json    { ..., doors: { id: [[date, mph|null, kind, miles], ...] } }   same rule as ../wind/build-wind.mjs
 *     naip-com-<spot>.json    { source, built, doors: { id: [item, minLon, minLat, maxLon, maxLat] } }
 *   and adds the three regions to index.json with "admin": true (rounds.php refuses them to anyone else).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const DATA = join(HERE, '..', '..', '..', 'site', 'data', 'rounds');
const LSR = join(HERE, '..', 'wind', 'cache');
const SPOTS = { springs: 'Commercial test · Springs east', south: 'Commercial test · South metro', west: 'Commercial test · West Denver / Lakewood' };
const RADIUS_MI = 10, MIN_MPH = 50, CAP = 10, FROM = '2020-01-01';
const miles = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(x)); };
const safeId = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/* wind reports, the same filter as ../wind/build-wind.mjs */
function csvRows(txt) { const out = []; for (const l of txt.split(/\r?\n/)) { if (!l) continue; const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { c.push(cur); cur = ''; continue; } cur += ch; } c.push(cur); out.push(c); } return out; }
const denverDay = (v2) => { const [d, t] = v2.split(' '); const iso = d.replace(/\//g, '-') + 'T' + (t || '00:00') + ':00Z'; return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date(iso)); };
function reports() {
  const TYPES = new Set(['G', 'N', 'A', 'D', 'O']), DAMAGE = new Set(['D', 'O']), out = [], seen = new Set();
  for (const f of readdirSync(LSR).filter((f) => /^lsr-co-\d{4}\.csv$/.test(f))) {
    const rows = csvRows(readFileSync(join(LSR, f), 'utf8')), h = rows.shift(), col = Object.fromEntries(h.map((k, i) => [k.trim(), i]));
    for (const r of rows) {
      const type = r[col.TYPECODE]; if (!TYPES.has(type) || r[col.STATE] !== 'CO') continue;
      const day = denverDay(r[col.VALID2]); if (day < FROM) continue;
      const lat = +r[col.LAT], lon = +r[col.LON]; if (!lat || !lon) continue;
      if (/summit|pikes peak/i.test(r[col.CITY] || '')) continue;
      const mag = parseFloat(r[col.MAG]), mph = mag > 0 ? Math.round(mag) : null, q = (r[col.QUALIFIER] || '').trim().toUpperCase();
      let kind; if (DAMAGE.has(type)) kind = 'damage'; else if (mph === null || mph < MIN_MPH) continue; else kind = q === 'M' ? 'measured' : 'estimated';
      const key = [day, lat.toFixed(2), lon.toFixed(2), type, mph].join('|'); if (seen.has(key)) continue; seen.add(key);
      out.push({ day, lat, lon, mph, kind });
    }
  }
  return out;
}
function windFor(b, byDay) {
  const list = [];
  for (const [day, xs] of byDay) {
    let best = null, bestMi = 0, dmg = null, dmgMi = 1e9;
    for (const r of xs) { const mi = miles(b.lat, b.lon, r.lat, r.lon); if (mi > RADIUS_MI) continue;
      if (r.kind === 'damage') { if (mi < dmgMi) { dmg = r; dmgMi = mi; } } else if (!best || r.mph > best.mph || (r.mph === best.mph && mi < bestMi)) { best = r; bestMi = mi; } }
    let pick = null, mi = 0;
    if (best && (!dmg || best.mph >= (dmg.mph || 0))) { pick = best; mi = bestMi; } else if (dmg) { pick = dmg; mi = dmgMi; }
    if (pick) list.push([day, pick.mph, pick.kind, Math.round(mi)]);
  }
  const rank = (e) => e[1] ?? 58;
  list.sort((a, c) => rank(c) - rank(a) || (a[0] < c[0] ? 1 : -1));
  return list.slice(0, CAP).sort((a, c) => (a[0] < c[0] ? 1 : -1));
}

const rep = reports(), byDayAll = new Map();
for (const r of rep) (byDayAll.get(r.day) || byDayAll.set(r.day, []).get(r.day)).push(r);
const through = rep.reduce((m, r) => (r.day > m ? r.day : m), FROM);
const idxF = join(DATA, 'index.json'), idx = JSON.parse(readFileSync(idxF, 'utf8'));
idx.regions = idx.regions.filter((r) => !String(r.key).startsWith('com-'));
const quarter = (c, b) => { const dy = b.lat - c[0], dx = (b.lon - c[1]) * Math.cos(c[0] * Math.PI / 180); return Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'north' : 'south') : (dx > 0 ? 'east' : 'west'); };
const KIND = { apartments: 'Apartments', commercial: 'Commercial', industrial: 'Industrial' };

for (const [spot, label] of Object.entries(SPOTS)) {
  const J = JSON.parse(readFileSync(join(OUT, `commercial-${spot}.json`), 'utf8')), key = 'com-' + spot;
  const areas = new Map(), hail = {}, wind = {}, naip = {}, used = new Set();
  const near = new Map(); for (const [d, xs] of byDayAll) { const ys = xs.filter((r) => miles(J.centre[0], J.centre[1], r.lat, r.lon) <= RADIUS_MI + 3); if (ys.length) near.set(d, ys); }
  const rows = J.buildings.slice().sort((a, b) => (b.roofSqft || 0) - (a.roofSqft || 0));
  for (const b of rows) {
    let id = safeId(b.id); while (used.has(id)) id += '-x'; used.add(id);
    const name = `${KIND[b.kind]} · ${quarter(J.centre, b)}`;
    const a = areas.get(name) || areas.set(name, { name, avg: 0, place: null, fw: null, doors: [] }).get(name);
    a.doors.push({
      id, address: b.addr || '(no address on record)', acres: b.acres ?? null, owner: b.owner, lat: b.lat, lon: b.lon, val: b.value || undefined,
      com: {
        k: b.kind, u: b.use, rf: b.roofSqft || null, t: b.tier, why: b.why, lead: b.lead || '', o2: b.owner2 || undefined, ot: b.ownerType,
        ag: b.sos && b.sos.agent ? (b.sos.agent.person || b.sos.agent.org) : undefined, ak: b.agentKind, an: b.agentEntities,
        st: b.sos && b.sos.status, fi: b.sos && b.sos.formedIn, pr: b.sos && b.sos.principal, sid: b.sosEntityId,
        m: b.mail ? [b.mail.adr, b.mail.city, b.mail.st, b.mail.zip].filter(Boolean).join(', ') : undefined,
        co: b.careOf, cok: b.careOfKind, sh: b.sharedMail ? b.sharedMail.owners : undefined, pf: b.portfolio > 1 ? b.portfolio : undefined,
        yb: b.yb, units: b.units, sale: b.saleDate ? [b.saleDate, b.salePrice || null] : undefined,
      },
    });
    if (b.hail && b.hail.length) hail[id] = b.hail;
    const w = windFor(b, near); if (w.length) wind[id] = w;
    if (b.naip) naip[id] = b.naip;
  }
  const list = [...areas.values()].sort((x, y) => x.name.localeCompare(y.name));
  for (const a of list) { const ac = a.doors.map((d) => d.acres).filter((v) => v > 0); a.avg = ac.length ? +(ac.reduce((s, v) => s + v, 0) / ac.length).toFixed(2) : 0; }
  const doorsN = list.reduce((s, a) => s + a.doors.length, 0);
  writeFileSync(join(DATA, `${key}.json`), JSON.stringify({ key, label, built: J.built, admin: true, areas: list }));
  writeFileSync(join(DATA, `hail-${key}.json`), JSON.stringify({ through: J.hailThrough, from: '2020-04-01', doors: hail }));
  writeFileSync(join(DATA, `wind-${key}.json`), JSON.stringify({ source: 'NWS Local Storm Reports via Iowa Environmental Mesonet (mesonet.agron.iastate.edu/request/gis/lsrs.phtml)', radiusMi: RADIUS_MI, minMph: MIN_MPH, built: new Date().toISOString().slice(0, 10), from: FROM, through, cap: CAP, doors: wind }));
  writeFileSync(join(DATA, `naip-${key}.json`), JSON.stringify({ source: 'USDA NAIP 2023, 0.3 m (Colorado), public domain, via Microsoft Planetary Computer; window = the largest roof outline on the parcel', built: new Date().toISOString().slice(0, 10), doors: naip }));
  idx.regions.push({ key, label, areas: list.length, doors: doorsN, admin: true, county: 'comtest' });
  console.log(`${key}: ${doorsN} buildings in ${list.length} areas; hail ${Object.keys(hail).length}, wind ${Object.keys(wind).length}, photo ${Object.keys(naip).length}`);
}
writeFileSync(idxF, JSON.stringify(idx));
console.log('index.json:', idx.regions.map((r) => r.key + (r.admin ? '*' : '')).join(' '));

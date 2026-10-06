/* Commercial test (2026-10-05): the roofing layers for each building, and the best lead for its owner.
 *
 *   node enrich.mjs     reads out/parcels-*.json, out/owners.json, out/footprints-*.json; writes out/commercial-<spot>.json
 *
 * Roof size   official roof outlines (Colorado Springs city, Arapahoe "Roof Prints", Denver, Jefferson; Microsoft fill for a
 *             Douglas strip) whose centre falls inside the parcel. Outlines whose centre sits inside another outline are
 *             stacked roof levels of one building and are not added twice.
 * Hail        NOAA/NSSL MRMS MESH, 24-hour maximum, April-September 2020-2026, largest value in the 3 x 3 grid squares
 *             around the building (about 1 km each way). Springs from ../hail/days, Denver spots from hail-days-denver/.
 * Wind        NWS Local Storm Reports (via Iowa Environmental Mesonet) within 10 miles: gusts of 50 mph or more and
 *             wind-damage reports, 2020-2026. Same rule as ../wind/.
 * Photo       USDA NAIP 2023 (0.3 m) item holding the building, from Microsoft Planetary Computer's STAC search.
 * Year built  El Paso's assessor file only; the statewide layer carries none for Arapahoe, Denver or Jefferson.
 * Roof material is not attempted: the classifier learned houses (asphalt shingle vs tile) and commercial roofs are mostly flat.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownerType } from './resolve-owners.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const HAIL = { springs: join(HERE, '..', 'hail', 'days'), south: join(HERE, 'hail-days-denver'), west: join(HERE, 'hail-days-denver') };
const LSR = join(HERE, '..', 'wind', 'cache');
const WIND_MI = 10, BIG = 25.4, MIN = 19.05;

const norm = (s) => String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/[.,'"’()]/g, ' ').replace(/\bL L C\b/g, 'LLC').replace(/\bL L L P\b/g, 'LLLP').replace(/\bL L P\b/g, 'LLP').replace(/\bL P\b/g, 'LP')
  .replace(/\bLIMITED LIABILITY COMPANY\b/g, 'LLC').replace(/\bINCORPORATED\b/g, 'INC').replace(/\bCORPORATION\b/g, 'CORP').replace(/\bCOMPANY\b/g, 'CO').replace(/\bLIMITED PARTNERSHIP\b/g, 'LP').replace(/\s+/g, ' ').trim();
const miles = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(x)); };
function inRing(x, y, ring) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
const bboxOf = (ring) => ring.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]);

function csvRows(txt) { const out = []; const L = txt.split(/\r?\n/); const H = L[0].split(','); for (let i = 1; i < L.length; i++) { if (!L[i]) continue; const c = []; let cur = '', q = false; for (const ch of L[i]) { if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { c.push(cur); cur = ''; continue; } cur += ch; } c.push(cur); const o = {}; H.forEach((h, k) => (o[h] = c[k])); out.push(o); } return out; }
function windEvents() {
  const ev = [], seen = new Set();
  for (const f of readdirSync(LSR).filter((f) => /^lsr-co-\d{4}\.csv$/.test(f))) for (const r of csvRows(readFileSync(join(LSR, f), 'utf8'))) {
    const t = r.TYPECODE, m = +r.MAG;
    if (!(((t === 'G' || t === 'N' || t === 'A') && m >= 50) || t === 'D' || t === 'O')) continue;
    if (/summit|pikes peak/i.test(r.CITY + r.REMARK)) continue;
    const k = [r.VALID.slice(0, 8), r.LAT, r.LON, t, r.MAG].join('|'); if (seen.has(k)) continue; seen.add(k);
    ev.push({ d: `${r.VALID.slice(0, 4)}-${r.VALID.slice(4, 6)}-${r.VALID.slice(6, 8)}`, lat: +r.LAT, lon: +r.LON, mph: m || null, dmg: t === 'D' || t === 'O' });
  }
  return ev;
}
function hailDays(dir) { return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))).filter((d) => !d.missing && d.cells && d.cells.length).map((d) => { const g = new Map(); for (const [r, c, v] of d.cells) g.set(r * 100000 + c, v / 10); return { ...d, g }; }); }
function hailAt(days, lat, lon) {
  const out = [];
  for (const d of days) {
    const r = Math.round((d.lat1 - lat) / d.dy) - d.r0, c = Math.round((lon + 360 - d.lon1) / d.dx) - d.c0;
    if (r < 0 || c < 0 || r >= d.rows || c >= d.cols) continue;
    let best = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = d.g.get((r + dr) * 100000 + c + dc); if (v > best) best = v; }
    if (best >= MIN) out.push([d.d, Math.round(best / 25.4 * 100) / 100]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
async function naipItems(bb) {
  const r = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox: bb, datetime: '2023-01-01/2023-12-31', limit: 200 }) });
  const j = await r.json(); return (j.features || []).map((f) => ({ id: f.id, bbox: f.bbox }));
}

const owners = JSON.parse(readFileSync(join(OUT, 'owners.json'), 'utf8'));
const wind = windEvents();
console.log(`wind events: ${wind.length}`);
for (const spot of ['springs', 'south', 'west']) {
  const P = JSON.parse(readFileSync(join(OUT, `parcels-${spot}.json`), 'utf8'));
  const F = JSON.parse(readFileSync(join(OUT, `footprints-${spot}.json`), 'utf8')).buildings;
  /* grid index of footprints by centre */
  const cell = (x, y) => `${Math.floor(x * 500)}|${Math.floor(y * 500)}`, grid = new Map();
  F.forEach((b, i) => { const k = cell(b[0], b[1]); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const days = hailDays(HAIL[spot]);
  const lats = P.parcels.map((p) => p.lat).filter(Boolean), lons = P.parcels.map((p) => p.lon).filter(Boolean);
  const items = await naipItems([Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01]);
  const rows = [];
  for (const p of P.parcels) {
    if (!p.lat) continue;
    /* roofs on this parcel */
    const bb = bboxOf(p.ring), mine = [];
    for (let x = Math.floor(bb[0] * 500); x <= Math.floor(bb[2] * 500); x++) for (let y = Math.floor(bb[1] * 500); y <= Math.floor(bb[3] * 500); y++) for (const i of grid.get(`${x}|${y}`) || []) if (inRing(F[i][0], F[i][1], p.ring)) mine.push(i);
    const top = mine.filter((i) => !mine.some((j) => j !== i && F[j][2] > F[i][2] && inRing(F[i][0], F[i][1], F[j][3])));
    const roofM2 = Math.round(top.reduce((s, i) => s + F[i][2], 0)), biggest = top.reduce((m, i) => Math.max(m, F[i][2]), 0);
    const hail = hailAt(days, p.lat, p.lon), big = hail.filter((h) => h[1] >= 1);
    const w = wind.filter((e) => miles(p.lat, p.lon, e.lat, e.lon) <= WIND_MI), wDays = [...new Set(w.map((e) => e.d))].sort().reverse();
    const item = items.find((it) => p.lon >= it.bbox[0] && p.lon <= it.bbox[2] && p.lat >= it.bbox[1] && p.lat <= it.bbox[3]);
    const pb = biggest ? bboxOf(F[top.find((i) => F[i][2] === biggest)][3]) : bb;
    const cx = (pb[0] + pb[2]) / 2, cy = (pb[1] + pb[3]) / 2, hx = Math.max((pb[2] - pb[0]) / 2 * 1.3, 0.0004), hy = Math.max((pb[3] - pb[1]) / 2 * 1.3, 0.0003);
    /* owner lead */
    const o = owners.owners[norm(p.owner)] || { type: ownerType(p.owner) }, s = o.sos;
    const careOf = [p.mail && p.mail.adr, p.owner2].filter(Boolean).join(' ').match(/\b(?:C\/O|CO\/|ATTN:?|ATTENTION)\s+([^,]+)/i);
    /* a c/o line can be a person, a company (manager or parent), or a corporate tax mailbox / tax consultant */
    const co = careOf ? careOf[1].trim() : '';
    const coTax = /\bTAX\b|ASSESS|ACCOUNTING|\bRYAN\b|POER|ALTUS|PARADIGM|DUFF|KROLL|\bLEGAL\b|\bDEPT\b|DEPARTMENT|\bREAL ESTATE\b|PROPERTY ACCOUNTING|\bPO BOX\b|^\d/i.test(co);
    const coCompany = !coTax && ownerType(co) !== 'person';
    let tier, why;
    if (o.type === 'person') { tier = 1; why = 'A person is the owner of record'; }
    else if (co && !coTax && !coCompany) { tier = 2; why = 'The county tax bill goes care of a named person (c/o)'; }
    else if (s && s.found && o.agentKind === 'person') { tier = 2; why = 'Registered agent is a person who acts for few companies: probably the owner or a principal'; }
    else if (co && coCompany) { tier = 3; why = 'The county tax bill goes care of a company (c/o): usually the property manager or the parent'; }
    else if (s && s.found && o.agentKind === 'company') { tier = 3; why = 'Registered agent is a company: often the parent or the property manager'; }
    else if (o.type === 'trust') { tier = 3; why = 'Held in a trust: the trustee is the decision maker'; }
    else if (o.type === 'public') { tier = 5; why = 'Public owner: bid process, not a door'; }
    else if (o.type === 'none') { tier = 4; why = 'No owner name on the county record (often a condo master or common-area parcel)'; }
    else if (s && s.found) { tier = 4; why = o.agentKind === 'service' ? 'Behind a registered-agent service: mailing address only' : 'Agent acts for many companies (attorney or agent business): mailing address only'; }
    else { tier = 4; why = 'Not found in the Colorado register (often an out-of-state company): mailing address only'; }
    const lead = tier === 1 ? p.owner : /\(c\/o\)/.test(why) ? 'c/o ' + co : s && s.found && s.agent && (o.agentKind === 'person' || o.agentKind === 'company') ? (s.agent.person || s.agent.org) : '';
    rows.push({
      lead, careOfKind: co ? (coTax ? 'tax mailbox' : coCompany ? 'company' : 'person') : undefined,
      id: p.id, spot, county: p.county, kind: p.kind, use: p.use, addr: p.addr, city: p.city, zip: p.zip, lat: p.lat, lon: p.lon,
      owner: p.owner, owner2: p.owner2 || undefined, ownerType: o.type, mail: p.mail, careOf: careOf ? careOf[1].trim() : undefined,
      sos: s && s.found ? { name: s.name, status: s.status, type: s.type, formedIn: s.formedIn, formed: s.formed, principal: s.principal, agent: s.agent, agentAddr: s.agentAddr, quality: s.quality } : s && s.quality === 'possible' ? { possible: s.name } : undefined,
      sosEntityId: s && s.found ? s.id : undefined,
      agentKind: o.agentKind || undefined, agentEntities: o.agentEntities ?? undefined, portfolio: o.parcels ? o.parcels.length : 1,
      tier, why,
      acres: p.acres, value: p.value, yb: p.yb || undefined, bldgSqft: p.sqft || undefined, units: p.units || undefined, saleDate: p.saleDate || undefined, salePrice: p.salePrice || undefined,
      roofM2: roofM2 || undefined, roofSqft: roofM2 ? Math.round(roofM2 * 10.7639) : undefined, roofs: top.length,
      hail: hail.slice(0, 30), hailBigDays: big.length, hailMax: hail.reduce((m, h) => Math.max(m, h[1]), 0) || undefined, hailLastBig: big[0] ? big[0][0] : undefined,
      windDays: wDays.length, windMax: w.reduce((m, e) => Math.max(m, e.mph || 0), 0) || undefined, windLast: wDays[0], windDmgDays: new Set(w.filter((e) => e.dmg).map((e) => e.d)).size,
      naip: item ? [item.id.replace(/^co_m_/, ''), +(cx - hx).toFixed(6), +(cy - hy).toFixed(6), +(cx + hx).toFixed(6), +(cy + hy).toFixed(6)] : undefined,
    });
  }
  /* shared mailing address: owners and buildings behind one address */
  const mk = (r) => norm([r.mail && r.mail.adr, r.mail && String(r.mail.zip || '').slice(0, 5)].join(' '));
  const byMail = new Map(); for (const r of rows) { const k = mk(r); if (!k.trim()) continue; const m = byMail.get(k) || { owners: new Set(), n: 0 }; m.owners.add(norm(r.owner)); m.n++; byMail.set(k, m); }
  for (const r of rows) { const m = byMail.get(mk(r)); if (m && m.owners.size > 1) r.sharedMail = { owners: m.owners.size, buildings: m.n }; }
  writeFileSync(join(OUT, `commercial-${spot}.json`), JSON.stringify({ spot, label: P.label, centre: [P.lat, P.lon], radiusM: P.r, built: new Date().toISOString().slice(0, 10), hailThrough: days.length ? days.map((d) => d.d).sort().pop() : null, naipItems: items.length, buildings: rows }));
  const t = (f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(`== ${spot}: ${rows.length} buildings; tiers ${JSON.stringify(t((r) => r.tier))}; with roof size ${rows.filter((r) => r.roofM2).length}; hail>=1in at least once ${rows.filter((r) => r.hailBigDays).length}; naip ${rows.filter((r) => r.naip).length}`);
}

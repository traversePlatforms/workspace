/* Commercial test (2026-10-05): from the owner of record to the closest public name.
 *
 *   node resolve-owners.mjs        reads out/parcels-*.json, writes out/owners.json (gitignored: names)
 *
 * Sources, all public:
 *   - the county record: owner name(s) and mailing address, including any "C/O" / "ATTN" line
 *   - Colorado Secretary of State business register, as open data on data.colorado.gov ("Business Entities in Colorado",
 *     4ykn-tg5h, refreshed daily): status, type, where formed, principal address, registered agent
 * Colorado does not make LLCs list members or managers in that register, so for an entity the closest public name is
 * usually the registered agent. A professional agent (an agent service, or one person acting for dozens of companies)
 * says nothing about who owns the building, so each agent is counted statewide and flagged when it acts for many.
 * No people-search sites, no scraping.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const SOS = 'https://data.colorado.gov/resource/4ykn-tg5h.json';
const CACHE = join(OUT, 'sos-cache.json');
const PRO_AGENT = 25;   /* acting for this many Colorado entities or more = a professional agent */
const SERVICE = /CORPORATION SERVICE|\bCSC\b|C T CORPORATION|CT CORPORATION|REGISTERED AGENT|NORTHWEST REGISTERED|COGENCY|INCORP SERVICES|NATIONAL CORPORATE RESEARCH|UNITED AGENT|LEGALINC|URS AGENTS|BUSINESS FILINGS|VCORP|HARBOR COMPLIANCE|A REGISTERED AGENT|PARACORP|NRAI|CORPORATE CREATIONS|SPIEGEL|INCORPORATING SERVICES|COMMERCIAL REGISTERED|LAW FIRM|\bLAW\b|\bLLP\b|\bP\.?C\.?$|ATTORNEY/i;

const norm = (s) => String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/[.,'"’()]/g, ' ').replace(/\bL L C\b/g, 'LLC').replace(/\bL L L P\b/g, 'LLLP').replace(/\bL L P\b/g, 'LLP').replace(/\bL P\b/g, 'LP')
  .replace(/\bLIMITED LIABILITY COMPANY\b/g, 'LLC').replace(/\bINCORPORATED\b/g, 'INC').replace(/\bCORPORATION\b/g, 'CORP').replace(/\bCOMPANY\b/g, 'CO').replace(/\bLIMITED PARTNERSHIP\b/g, 'LP').replace(/\s+/g, ' ').trim();
const stripStatus = (s) => String(s || '').replace(/,\s*(Delinquent|Dissolved|Voluntarily Dissolved|Administratively Dissolved|Withdrawn|Converted|Merged|Expired|Noncompliant)\b.*$/i, '');

export function ownerType(name) {
  const u = norm(name);
  if (/\b(CITY|COUNTY|STATE OF|DISTRICT|AUTHORITY|SCHOOL|UNITED STATES|HOUSING AUTHORITY|REGENTS|BOARD OF|HIGHER EDUCATION|UNIVERSITY|REGIONAL TRANSPORTATION)\b/.test(u)) return 'public';
  if (/\bLLLP\b|\bLLP\b/.test(u)) return 'lllp';
  if (/\bLLC\b/.test(u) || /\sL{1,2}$/.test(u)) return 'llc';   /* "... L" = LLC cut off by the county roll */
  if (/\b(INC|CORP|LTD|NA)\b/.test(u) || /\bCO$/.test(u) || /\bCO OF\b/.test(u)) return 'corp';
  if (/\bLP\b|\bPARTNERSHIP\b|\bPARTNERS\b/.test(u)) return 'lp';
  if (/\bTRUST\b|\bTRUSTEE|\bREVOCABLE\b|\bLIVING TR\b|\bTR$/.test(u)) return 'trust';
  if (/\b(ASSOCIATION|ASSN|CHURCH|FOUNDATION|MINISTR|HOLDINGS|PROPERTIES|INVESTMENTS|GROUP|ENTERPRISES|VENTURES|FUND|REIT|CENTER|PLAZA|MANAGEMENT|BANK|REAL ESTATE|MOTORS|ASSOCIATES|LEASING|BRANCH|DEVELOPMENT|CTR|PURVEYORS|AUTO|STORAGE|APARTMENTS|HOTEL|REALTY|SALES|SERVICES?|SUPPLY|DENTAL|MEDICAL|RENTALS?|BUILDING|INDUSTRIES|LODGE|POST|CLUB)\b/.test(u) || /\d/.test(u)) return 'org';
  return 'person';
}
const isEntity = (t) => ['llc', 'lllp', 'corp', 'lp', 'org'].includes(t);

async function q(params) {
  const url = SOS + '?' + new URLSearchParams(params);
  for (let t = 0; t < 5; t++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'DoorApp-commercial-test/1.0' } }); if (r.status === 429) throw new Error('429'); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) { if (t === 4) throw e; await new Promise((z) => setTimeout(z, 2000 * (t + 1))); }
  }
}
const esc = (s) => s.replace(/'/g, "''");

/* the county name may be truncated or punctuated differently; search on the first two words, then match normalised */
const TYPE = new Set(['LLC', 'LLLP', 'LLP', 'LP', 'INC', 'CORP', 'CO', 'LTD', 'PC', 'PLLC']);
const STOP = new Set(['THE', 'A', 'AN']);
const split = (n) => { const t = n.split(' ').filter((w) => w && !STOP.has(w)); const base = [], types = []; for (const w of t) (TYPE.has(w) && base.length ? types : base).push(w); return { base: base.filter((w) => !TYPE.has(w)), types }; };
const typeOf = (types) => (types.includes('LLLP') ? 'LLLP' : types.includes('LLP') ? 'LLP' : types.includes('LLC') || types.includes('PLLC') ? 'LLC' : types.includes('LP') ? 'LP' : types.some((t) => ['INC', 'CORP', 'CO', 'LTD', 'PC'].includes(t)) ? 'CORP' : '');

/* match rule: same number of name words, each county word the start of (or equal to) the register's word, so COLO ~
   COLORADO and ASSOC ~ ASSOCIATES; a county roll that cut the name short (30+ characters) may stop early. The company
   type must agree when both carry one; if it differs the match is only 'possible'. */
function compare(county, reg) {
  const A = split(county), B = split(reg);
  if (!A.base.length || !B.base.length || A.base.length > B.base.length) return null;
  for (let i = 0; i < A.base.length; i++) if (!B.base[i].startsWith(A.base[i])) return null;
  const cut = A.base.length < B.base.length;
  if (cut && county.length < 30) return null;
  const ta = typeOf(A.types), tb = typeOf(B.types);
  const sameType = !ta || !tb || ta === tb;
  const exact = !cut && A.base.every((w, i) => w === B.base[i]);
  return { q: !sameType ? 'possible' : cut ? 'truncated' : exact ? 'exact' : 'abbreviated' };
}
async function findEntity(name) {
  const n = norm(name.replace(/\([^)]*\)/g, ' ')); const { base } = split(n);
  if (!base.length) return null;
  const like = base.filter((w) => w !== 'AND').map((w) => esc(w)).join('%');
  const rows = await q({ $where: `upper(entityname) like '${like}%'`, $limit: '100' });
  const order = { exact: 0, abbreviated: 1, truncated: 2, possible: 3 };
  let hits = rows.map((r) => ({ r, c: compare(n, norm(stripStatus(r.entityname))) })).filter((h) => h.c);
  if (!hits.length) return { found: false, candidates: rows.length };
  const best = Math.min(...hits.map((h) => order[h.c.q])); hits = hits.filter((h) => order[h.c.q] === best);
  const quality = hits[0].c.q;
  const rank = (r) => (r.entitystatus === 'Good Standing' ? 0 : r.entitystatus === 'Delinquent' ? 1 : 2);
  hits.sort((a, b) => rank(a.r) - rank(b.r) || String(b.r.entityformdate).localeCompare(String(a.r.entityformdate)));
  const r = hits[0].r;
  const person = [r.agentfirstname, r.agentmiddlename, r.agentlastname, r.agentsuffix].filter(Boolean).join(' ').trim();
  return {
    found: quality !== 'possible', quality, matches: hits.length, id: r.entityid, name: stripStatus(r.entityname), status: r.entitystatus, type: r.entitytype, formedIn: r.jurisdictonofformation,
    formed: r.entityformdate ? r.entityformdate.slice(0, 10) : null,
    principal: [r.principaladdress1, r.principaladdress2, r.principalcity, r.principalstate, r.principalzipcode].filter(Boolean).join(', '),
    agent: person ? { person, first: r.agentfirstname, last: r.agentlastname } : r.agentorganizationname ? { org: r.agentorganizationname } : null,
    agentAddr: [r.agentprincipaladdress1, r.agentprincipaladdress2, r.agentprincipalcity, r.agentprincipalstate, r.agentprincipalzipcode].filter(Boolean).join(', '),
  };
}
async function agentCount(a) {
  if (a.org) return +(await q({ $select: 'count(*) as n', $where: `upper(agentorganizationname)='${esc(a.org.toUpperCase())}'` }))[0].n;
  return +(await q({ $select: 'count(*) as n', $where: `upper(agentfirstname)='${esc(String(a.first || '').toUpperCase())}' AND upper(agentlastname)='${esc(String(a.last || '').toUpperCase())}'` }))[0].n;
}
async function pool(items, n, fn) { let i = 0, done = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k]); if (++done % 250 === 0) console.log(`    ${done} / ${items.length}`); } })); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const parcels = [];
  for (const s of ['springs', 'south', 'west']) for (const p of JSON.parse(readFileSync(join(OUT, `parcels-${s}.json`), 'utf8')).parcels) parcels.push({ ...p, spot: s });
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { entity: {}, agent: {} };
  const owners = new Map();
  for (const p of parcels) { const k = norm(p.owner); if (!k) continue; const o = owners.get(k) || { name: p.owner, type: ownerType(p.owner), parcels: [] }; o.parcels.push(p.id); owners.set(k, o); }
  const ents = [...owners.entries()].filter(([, o]) => isEntity(o.type) && !(o.name in cache.entity));
  console.log(`${owners.size} owners; ${[...owners.values()].filter((o) => isEntity(o.type)).length} entities, ${ents.length} to look up`);
  await pool(ents, 4, async ([, o]) => { try { cache.entity[o.name] = await findEntity(o.name); } catch (e) { cache.entity[o.name] = { error: e.message }; } });
  writeFileSync(CACHE, JSON.stringify(cache));
  const agents = new Map();
  for (const o of owners.values()) { const e = cache.entity[o.name]; if (e && e.agent) { const k = e.agent.org ? 'O:' + e.agent.org.toUpperCase() : 'P:' + `${e.agent.first}|${e.agent.last}`.toUpperCase(); agents.set(k, e.agent); } }
  const todoA = [...agents.entries()].filter(([k]) => !(k in cache.agent));
  console.log(`${agents.size} distinct agents, ${todoA.length} to count statewide`);
  await pool(todoA, 4, async ([k, a]) => { try { cache.agent[k] = await agentCount(a); } catch (e) { cache.agent[k] = null; } });
  writeFileSync(CACHE, JSON.stringify(cache));

  /* who shares a mailing address with whom */
  const mailKey = (p) => norm([p.mail.adr, p.mail.zip && String(p.mail.zip).slice(0, 5)].join(' '));
  const byMail = new Map();
  for (const p of parcels) { if (!p.mail || !p.mail.adr) continue; const k = mailKey(p); const m = byMail.get(k) || { owners: new Set(), parcels: 0 }; m.owners.add(norm(p.owner)); m.parcels++; byMail.set(k, m); }

  const out = {};
  for (const [k, o] of owners) {
    const e = isEntity(o.type) ? cache.entity[o.name] : null;
    let agentKind = null, agentN = null;
    if (e && e.agent) {
      const ak = e.agent.org ? 'O:' + e.agent.org.toUpperCase() : 'P:' + `${e.agent.first}|${e.agent.last}`.toUpperCase();
      agentN = cache.agent[ak];
      agentKind = e.agent.org ? (SERVICE.test(e.agent.org) || agentN >= PRO_AGENT ? 'service' : 'company') : agentN >= PRO_AGENT ? 'professional person' : 'person';
    }
    out[k] = { name: o.name, type: o.type, parcels: o.parcels, sos: e || null, agentKind, agentEntities: agentN };
  }
  const mail = {}; for (const [k, m] of byMail) if (m.owners.size > 1) mail[k] = { owners: m.owners.size, parcels: m.parcels };
  writeFileSync(join(OUT, 'owners.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), owners: out, sharedMail: mail }));
  const vals = Object.values(out), ent = vals.filter((v) => isEntity(v.type));
  const tally = (f) => vals.reduce((m, v) => { const x = f(v); if (x != null) m[x] = (m[x] || 0) + 1; return m; }, {});
  console.log('owner types', tally((v) => v.type));
  console.log(`entities found in the register: ${ent.filter((v) => v.sos && v.sos.found).length} of ${ent.length}`);
  console.log('agent kinds', tally((v) => v.agentKind));
  console.log('status', tally((v) => v.sos && v.sos.found ? v.sos.status : null));
}

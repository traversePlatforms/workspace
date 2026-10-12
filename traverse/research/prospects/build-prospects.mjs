// Colorado companies Traverse could sell to, trade by trade (2026-10-11, Matthew: "creating a list of companies in Colorado we
// could sell to"). Source: the Colorado Secretary of State's register, "Business Entities in Colorado" (data.colorado.gov, dataset
// 4ykn-tg5h, refreshed daily). The register has no industry code, so a company is matched by the trade's words in its name; a
// business with a plain name ("Smith & Sons LLC") is missed, and a few odd matches get in. Active = Good Standing or Exists.
// Kept: name, entity type, city, ZIP, year formed, whether one of our towns covers its city, and a link to its record at the
// Secretary of State. Left out on purpose: registered agents' names and street addresses (small trade businesses are often run
// from a home). Writes prospects.csv and prospects-summary.json here; both are gitignored (some company names are people's names).
//   node traverse/research/prospects/build-prospects.mjs
import { writeFileSync, readFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..', '..', '..');
const API = 'https://data.colorado.gov/resource/4ykn-tg5h.json';
const TRADES = {   // edition: [words searched in the register (SQL LIKE), words that must appear (regex), words that rule a match out]
  /* 2026-10-12: "proof" words (waterproofing, bulletproof, proofreading), photographers, studios, law firms and suppliers were
     getting in; ROOF must not follow a P, and the rule-outs below were found by reading the list */
  roofing: [['%ROOF%'], /(^|[^P])ROOF/, /ROOFTOP|ROOF ?GARDEN|RED ROOF|ROOF ?BAR|PHOTOGRAPH|ROOFNEST|ROOF ?LABS|CONTRACTOR MARKETING/],
  yards: [['%LAWN%', '%LANDSCAP%', '%TURF%', '%SPRINKLER%', '%IRRIGATION%', '%AERAT%', '%TREE SERV%', '%TREE CARE%', '%TREE EXPERT%', '%ARBOR%'], /LAWN|LANDSCAP|TURF|SPRINKLER|IRRIGATION|AERAT|TREE SERV|TREE CARE|TREE EXPERT|ARBOR/, /ARBORETUM|HARBOR|LAWN ?MOWER REPAIR|SPRINKLER ?FITTERS? UNION|FIRE SPRINKLER|ASTRO ?TURF|ARBOREAL|ARBOR VIEW|ARBOR PROPERT|LANDSCAPE SUPPLY|LAWN BOWLING|ARBOR HOMES?\b|ARBOR HOUSE|ARBOR SHOPPE|MUTUAL IRRIGATION|IRRIGATION DISTRICT|GRAND VALLEY IRRIGATION|DITCH|RESERVOIR/],
  pest: [['%PEST%', '%EXTERMINAT%', '%TERMITE%', '%MOSQUITO%', '%WILDLIFE CONTROL%', '%BED BUG%'], /PEST|EXTERMINAT|TERMITE|MOSQUITO|WILDLIFE CONTROL|BED BUG/, /PESTO|TEMPEST|BUCHAREST|PESTILEN|MOSQUITO STUDIO/],
  solar: [['%SOLAR%'], /SOLAR/, /SOLARIUM|SOLAR ?TAN|SOLAR ?FLARE BAR|SOLARI\b|SOLARA\b|SOLAR ?NAIL/],
  security: [['%ALARM%', '%SECURITY SYSTEM%', '%HOME SECURITY%', '%SMART HOME%', '%SURVEILLANCE%'], /ALARM|SECURITY SYSTEM|HOME SECURITY|SMART HOME|SURVEILLANCE/, /FIRE ALARM ?UNION/],
};
/* our towns, by the city names the register uses */
const idx = JSON.parse(readFileSync(join(REPO, 'traverse', 'app', 'data', 'rounds', 'index.json'), 'utf8')).regions.filter((r) => !r.metro && !r.key.startsWith('com-'));
const OURS = new Set(idx.map((r) => r.label.toUpperCase()).concat(['COLORADO SPRINGS', 'PEYTON', 'FALCON', 'LITTLETON', 'LONE TREE', 'CASTLE PINES', 'ELIZABETH', 'WESTMINSTER', 'NORTHGLENN', 'BRIGHTON', 'AURORA', 'GREENWOOD VILLAGE', 'ENGLEWOOD', 'LAFAYETTE', 'LOUISVILLE', 'SUPERIOR', 'FREDERICK', 'FIRESTONE', 'GOLDEN', 'WHEAT RIDGE', 'LAKEWOOD', 'BROOMFIELD', 'SEVERANCE', 'TIMNATH']));
const NEAR = new Set(['LITTLETON', 'LONE TREE', 'WESTMINSTER', 'NORTHGLENN', 'BRIGHTON', 'AURORA', 'GREENWOOD VILLAGE', 'ENGLEWOOD', 'LAFAYETTE', 'LOUISVILLE', 'SUPERIOR', 'FREDERICK', 'FIRESTONE', 'GOLDEN', 'WHEAT RIDGE', 'LAKEWOOD', 'BROOMFIELD', 'SEVERANCE', 'TIMNATH', 'PEYTON', 'FALCON', 'ELIZABETH']);
const get = async (where, offset) => { const u = API + '?' + new URLSearchParams({ $select: 'entityid,entityname,entitystatus,entitytype,principalcity,principalstate,principalzipcode,entityformdate', $where: where, $limit: '50000', $offset: String(offset), $order: 'entityid' }); for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) {} await new Promise((s) => setTimeout(s, 2000 * (i + 1))); } throw new Error('register did not answer'); };
const all = new Map();
for (const [ed, [likes, must, not]] of Object.entries(TRADES)) {
  const where = "entitystatus in ('Good Standing','Exists') AND (" + likes.map((l) => "upper(entityname) like '" + l + "'").join(' OR ') + ')';
  let rows = [], off = 0; for (;;) { const page = await get(where, off); rows = rows.concat(page); if (page.length < 50000) break; off += 50000; }
  let kept = 0;
  for (const r of rows) {
    const nm = String(r.entityname || '').toUpperCase(); if (!must.test(nm) || not.test(nm)) continue;
    if ((r.principalstate || '').toUpperCase() !== 'CO') continue;   /* Colorado-based only */
    const city = String(r.principalcity || '').trim().toUpperCase();
    const x = all.get(r.entityid) || { id: r.entityid, name: r.entityname, type: r.entitytype, city: city.replace(/\b\w/g, (c) => c) , zip: String(r.principalzipcode || '').slice(0, 5), formed: String(r.entityformdate || '').slice(0, 4), trades: new Set() };
    x.trades.add(ed); all.set(r.entityid, x); kept++;
  }
  console.log(ed.padEnd(9), rows.length, 'matched in the register,', kept, 'kept');
}
const tc = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const list = [...all.values()].map((x) => ({ ...x, trades: [...x.trades].join(' '), city: tc(x.city), where: OURS.has(x.city) ? (NEAR.has(x.city) ? 'next to our towns' : 'in our towns') : 'elsewhere in Colorado', link: 'https://www.sos.state.co.us/biz/BusinessEntityDetail.do?masterFileId=' + x.id }))
  .sort((a, b) => a.trades.localeCompare(b.trades) || (a.where === b.where ? 0 : a.where === 'in our towns' ? -1 : b.where === 'in our towns' ? 1 : a.where === 'next to our towns' ? -1 : 1) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
const q = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
writeFileSync(join(HERE, 'prospects.csv'), 'trade,company,type,city,zip,formed,where,record\n' + list.map((x) => [x.trades, x.name, x.type, x.city, x.zip, x.formed, x.where, x.link].map(q).join(',')).join('\n') + '\n');
const sum = {}; for (const x of list) for (const t of x.trades.split(' ')) { const s = sum[t] || (sum[t] = { total: 0, 'in our towns': 0, 'next to our towns': 0, 'elsewhere in Colorado': 0, cities: {} }); s.total++; s[x.where]++; s.cities[x.city] = (s.cities[x.city] || 0) + 1; }
for (const s of Object.values(sum)) s.cities = Object.fromEntries(Object.entries(s.cities).sort((a, b) => b[1] - a[1]).slice(0, 15));
writeFileSync(join(HERE, 'prospects-summary.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'Colorado Secretary of State, Business Entities in Colorado (data.colorado.gov 4ykn-tg5h), Good Standing or Exists, principal address in Colorado', method: 'matched by trade words in the business name', trades: sum }, null, 1));
console.log('companies', list.length); for (const [t, s] of Object.entries(sum)) console.log(t.padEnd(9), s.total, '· in our towns', s['in our towns'], '· next to them', s['next to our towns'], '· elsewhere', s['elsewhere in Colorado']);

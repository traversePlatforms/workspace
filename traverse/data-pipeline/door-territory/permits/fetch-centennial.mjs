/* City of Centennial building permits -> centennial-permits.json (2026-10-10).
 * Centennial answered Matthew's records request with instructions for its public permit search (Tyler EnerGov
 * self-service, cityofcentennialco-energovweb.tylerhost.net). The search page reads a JSON feed; this reads the same
 * feed, one page of 100 at a time with a pause between, for the keywords below, and keeps only re-roofs (work class
 * "Roof/Re-roof") and solar (type "... Renewable Energy") that have an issue date, each as [street address, day, kind]
 * like douglas-permits.json. Holder, company and contact fields are never read into the output.
 * Resumable: pages already read are kept in centennial-pages.json (deleted when done).
 *   node fetch-centennial.mjs                                                                                      */
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normAddr } from './fetch-douglas.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const H = 'https://cityofcentennialco-energovweb.tylerhost.net/apps/selfservice';
const HD = { tenantId: '1', tenantName: 'CentennialCOProd', 'Tyler-TenantUrl': 'CentennialCOProd', 'Tyler-Tenant-Culture': 'en-US', 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' };
/* The search stops at 100 pages (10,000 results) and ignores its date filters, so roofs are read a year at a time by
   the exact permit-number prefix of a residential one-stop permit (RONE-24 = 7,701 permits, every kind, in 2024). */
/* RONE-18 up to this year's prefix (2026-10-11: was fixed at RONE-26, so the monthly refresh would have missed 2027 on) */
const KEYWORDS = ['solar', 'renewable', 'photovoltaic', ...Array.from({ length: new Date().getFullYear() - 2018 + 1 }, (_, i) => 'RONE-' + (18 + i))];
const EXACT = (kw) => kw.startsWith('RONE-');
const SIZE = 100, PAUSE = 1500;
const PROG = join(HERE, 'centennial-pages.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const kindOf = (p) => /roof/i.test(p.CaseWorkclass || '') ? 'roof' : /renewable energy/i.test(p.CaseType || '') ? 'solar' : null;
const street = (a) => a ? [a.AddressLine1, a.PreDirection, a.AddressLine2, a.StreetTypeName, a.PostDirection].filter(Boolean).join(' ') : '';

const template = (await (await fetch(H + '/api/energov/search/criteria', { headers: HD })).json()).Result;
async function page(kw, n) {
  const c = structuredClone(template);
  Object.assign(c, { Keyword: kw, ExactMatch: EXACT(kw), SearchModule: 1, FilterModule: 2, PageNumber: n, PageSize: SIZE, SortBy: 'relevance', SortAscending: false });
  Object.assign(c.PermitCriteria, { PageNumber: n, PageSize: SIZE, SortBy: 'relevance' });
  for (let tries = 1; ; tries++) {
    try {
      const r = await fetch(H + '/api/energov/search/search', { method: 'POST', headers: HD, body: JSON.stringify(c) });
      if (r.status !== 200) throw new Error('HTTP ' + r.status);
      return JSON.parse(await r.text()).Result;
    } catch (e) { if (tries >= 5) throw e; console.log(`   ${kw} p${n}: ${e.message}, retry ${tries}`); await sleep(10000 * tries); }
  }
}

const prog = existsSync(PROG) ? JSON.parse(readFileSync(PROG, 'utf8')) : { done: {}, permits: {} };
const save = () => { writeFileSync(PROG + '.tmp', JSON.stringify(prog)); renameSync(PROG + '.tmp', PROG); };
for (const kw of KEYWORDS) {
  let pages = prog.done[kw]?.pages ?? null, n = (prog.done[kw]?.next) ?? 1;
  while (pages === null || n <= pages) {
    const R = await page(kw, n);
    if (!R) throw new Error(`${kw} page ${n}: no result (past the 100-page cap?)`);
    pages = R.TotalPages;
    if (pages > 100) console.log(`   ⚑ ${kw}: ${R.TotalFound} results, more than the search will page through`);
    for (const p of R.EntityResults || []) {
      const kind = kindOf(p); if (!kind || !p.IssueDate) continue;
      const s = normAddr(street(p.Address)); if (!s) continue;
      prog.permits[p.CaseNumber] = [s, String(p.IssueDate).slice(0, 10), kind];
    }
    prog.done[kw] = { pages, next: ++n };
    if (n % 10 === 0 || n > pages) { save(); console.log(`${kw}: page ${n - 1}/${pages}, ${Object.keys(prog.permits).length} kept`); }
    await sleep(PAUSE);
  }
}
/* the city's current system starts in 2018 (3,202 re-roofs that year); before it the search holds a few dozen legacy records a
   year, so the file starts in 2018 and the app does not claim cover it lacks */
for (const [k, p] of Object.entries(prog.permits)) if (p[1] < '2018') delete prog.permits[k];
const days = Object.values(prog.permits).map((p) => p[1]).sort();
const n = { roof: 0, solar: 0 }; for (const p of Object.values(prog.permits)) n[p[2]]++;
writeFileSync(join(HERE, 'centennial-permits.json'), JSON.stringify({ source: 'City of Centennial public permit search (EnerGov self-service)', since: days[0], through: days.at(-1), fetched: new Date().toISOString().slice(0, 10), permits: prog.permits }));
unlinkSync(PROG);
console.log(`centennial-permits.json: ${n.roof} re-roofs, ${n.solar} solar, ${days[0]} to ${days.at(-1)}`);

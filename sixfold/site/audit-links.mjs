/* Sixfold site — link, chrome and copy-rule auditor.

   The site is hand-authored HTML, one directory per page, the same as the Surge
   site. That keeps every page real, greppable and editable, and it costs one
   thing: the header and footer are duplicated, so they drift. This catches that,
   along with links that point at nothing and copy that breaks a standing rule.

     node sixfold/site/audit-links.mjs

   Exit code 1 if anything failed, so it can gate a commit.

   Three checks:

   1. LINKS. Every internal href resolves to a file on disk, and every "#id"
      exists on the page it points at. Root-absolute links are resolved against
      the site root, the way serve.mjs serves them.

   2. CHROME. The <!-- CHROME:X --> blocks must be byte-identical across pages,
      except for aria-current="page", which is per-page by definition and is
      normalised away before comparing.

   3. COPY RULES. The standing Sixfold constraints, as greps. These are the ones
      that would be expensive to get wrong: a web address before the domain is
      hosted, "licensed and insured" before the insurance exists, a county
      cost-share named before Sixfold is on the list, a price on a site that has
      no rate card, the old phone number, or a mention of Surge.
*/
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const problems = [];
const fail = (file, msg) => problems.push(`${relative(ROOT, file) || '.'}: ${msg}`);

/* ---- collect the pages ------------------------------------------------ */

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = (await htmlFiles(ROOT)).sort();
if (!pages.length) { console.error('No HTML found — wrong directory?'); process.exit(1); }

const src = new Map();
for (const p of pages) src.set(p, await readFile(p, 'utf8'));

/* ids available on each page, so cross-page #anchors can be checked */
const idsOf = new Map();
for (const [p, s] of src) {
  idsOf.set(p, new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
}

/* which file serves a given site path */
const fileForPath = (sitePath) => {
  const rel = sitePath.replace(/^\/+/, '');
  const direct = join(ROOT, rel);
  if (rel && existsSync(direct) && !direct.endsWith('/')) {
    // a real file (e.g. /assets/site.css)
    if (!existsSync(join(direct, 'index.html'))) return direct;
  }
  const idx = join(ROOT, rel, 'index.html');
  return existsSync(idx) ? idx : null;
};

/* ---- 1. links --------------------------------------------------------- */

let linkCount = 0, waivedCount = 0;
for (const [page, s] of src) {
  for (const m of s.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(raw)) continue;
    if (raw.startsWith('#')) {
      // same-page anchor, or a <use href="#symbol">
      const id = raw.slice(1);
      if (!idsOf.get(page).has(id)) fail(page, `dead in-page anchor "${raw}"`);
      linkCount++;
      continue;
    }
    if (!raw.startsWith('/')) { fail(page, `relative link "${raw}" — this site uses root-absolute links`); continue; }

    const [path, hash] = raw.split('#');
    const target = fileForPath(path);
    if (!target) { fail(page, `dead link "${raw}" — nothing serves ${path}`); continue; }
    if (hash) {
      const ids = idsOf.get(target);
      if (!ids) fail(page, `"${raw}" points into a non-HTML file`);
      else if (!ids.has(hash)) fail(page, `dead anchor "${raw}" — ${relative(ROOT, target)} has no id="${hash}"`);
    }
    linkCount++;
  }
}

/* ---- 2. chrome drift -------------------------------------------------- */

const BLOCKS = ['MARKS', 'HEAD', 'FOOT'];
const normalise = (s) => s.replace(/\s*aria-current="page"/g, '');
const chromeOf = (s, name) => {
  const m = s.match(new RegExp(`<!-- CHROME:${name} -->([\\s\\S]*?)<!-- /CHROME:${name} -->`));
  return m ? normalise(m[1]) : null;
};

/* the merch board is generated and carries no CHROME markers — audit it for
   links only, and say so rather than silently skipping it */
const chromePages = pages.filter(p => chromeOf(src.get(p), 'HEAD') !== null);
const noChrome = pages.filter(p => !chromePages.includes(p));

for (const name of BLOCKS) {
  const [first, ...rest] = chromePages;
  const ref = chromeOf(src.get(first), name);
  if (ref === null) { fail(first, `missing CHROME:${name} block`); continue; }
  for (const p of rest) {
    const got = chromeOf(src.get(p), name);
    if (got === null) fail(p, `missing CHROME:${name} block`);
    else if (got !== ref) fail(p, `CHROME:${name} has drifted from ${relative(ROOT, first)}`);
  }
}

/* ---- 3. standing copy rules ------------------------------------------- */

const RULES = [
  ['web-address',
   /https?:\/\/(?:www\.)?sixfoldcolorado\.com|(?<![@/\w.])sixfoldcolorado\.com(?!["'])/i,
   'prints a web address — the domain is owned but NOT hosted'],
  ['credentials',
   /licen[sc]ed and insured|\bbonded\b|\bfirewise\b/i,
   'claims a credential Sixfold does not hold'],
  ['county-cost-share',
   /douglas county cost.?share|county cost.?share program/i,
   'names a county cost-share — barred until Sixfold is on the approved list'],
  ['price',
   /free estimate|\$\d|\bper acre\b.{0,20}\$|% off\b/i,
   'prints a price, a discount or a free-estimate offer'],
  ['old-phone',
   /\(?720\)?[\s.-]?772[\s.-]?6146/,
   'carries the OLD phone number'],
  ['surge',
   /\bsurge\b/i,
   'mentions Surge'],
  ['paperwork-phrase',
   /we handle the paperwork for you/i,
   'uses the banned paperwork phrasing'],
];

/* A page may waive one rule for itself with
 *
 *     <!-- AUDIT-ALLOW: <rule-id> — why, and who decided -->
 *
 * which keeps every exception visible in the file it applies to rather than
 * buried in a config nobody opens. An unknown id is itself a failure, so a
 * typo cannot quietly switch a check off.
 *
 * Two live waivers as of 2026-09-18, both genuine:
 *   - merch board, `credentials` — the line STATES the rule ("nothing claims
 *     licensed and insured..."), it does not make the claim.
 *   - /who-pays/, `price` — $1,000 and $2,000 are the STATUTORY credit caps,
 *     not Sixfold prices. Waived rather than loosening the regex, because
 *     catching the other kind of dollar figure is the rule's whole job.
 */
const KNOWN = new Set(RULES.map(r => r[0]));
const waiversIn = (s, file) => {
  const out = new Set();
  for (const m of s.matchAll(/<!--\s*AUDIT-ALLOW:\s*([a-z-]+)/g)) {
    if (!KNOWN.has(m[1])) fail(file, `AUDIT-ALLOW names an unknown rule "${m[1]}"`);
    out.add(m[1]);
  }
  return out;
};

/* HTML comments are notes to ourselves, not published copy — strip them first,
   otherwise every file's own header comment trips its own rules. */
const visible = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ');

for (const [page, s] of src) {
  const body = visible(s);
  const waived = waiversIn(s, page);
  for (const [id, re, why] of RULES) {
    if (waived.has(id)) { waivedCount++; continue; }
    const hit = body.match(re);
    if (hit) fail(page, `[${id}] ${why} — found "${hit[0].trim()}"`);
  }
}

/* ---- report ----------------------------------------------------------- */

console.log(`Sixfold site audit — ${pages.length} pages, ${linkCount} internal links checked`);
console.log(`  chrome compared across: ${chromePages.map(p => relative(ROOT, p)).join(', ')}`);
if (noChrome.length) console.log(`  links only (no CHROME markers): ${noChrome.map(p => relative(ROOT, p)).join(', ')}`);

if (waivedCount) console.log(`  copy rules waived in-file (AUDIT-ALLOW): ${waivedCount}`);

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log('\nAll clear.');

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
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '_tabled') continue;   // _tabled: off the site, kept buildable
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

    /* Split the hash off first, then the query — a ?need= is for the page's own
       script, not part of the path, and resolving it as one reported the home
       page's three "Book a … walk" links as dead. Order matters: "?a=b#c" puts
       the hash after the query, so splitting on '#' first leaves a clean query. */
    const [beforeHash, hash] = raw.split('#');
    const [path, query] = beforeHash.split('?');
    const target = fileForPath(path);
    if (!target) { fail(page, `dead link "${raw}" — nothing serves ${path}`); continue; }

    /* A ?need= that no radio on the target page offers is a silent dud: the link
       works, the chooser just ignores it. That is exactly the kind of drift the
       land-clearing gap was, so it is checked rather than trusted. */
    if (query) {
      for (const [k, v] of new URLSearchParams(query)) {
        if (k !== 'need') continue;
        const targetSrc = src.get(target) || '';
        if (!targetSrc.includes(`name="need" value="${v}"`))
          fail(page, `"${raw}" — ${relative(ROOT, target)} has no need="${v}" option`);
      }
    }
    if (hash) {
      const ids = idsOf.get(target);
      if (!ids) fail(page, `"${raw}" points into a non-HTML file`);
      else if (!ids.has(hash)) fail(page, `dead anchor "${raw}" — ${relative(ROOT, target)} has no id="${hash}"`);
    }
    linkCount++;
  }
}

/* ---- 2. chrome drift -------------------------------------------------- */

/* META added 2026-09-19. The <head> had been hand-maintained on six pages with
   nothing watching it — CHROME:HEAD is the <header> ELEMENT, not the head — so a
   favicon or an og: tag could go missing on one page and never be noticed. */
const BLOCKS = ['MARKS', 'META', 'HEAD', 'FOOT'];
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

/* ---- 4. sitemap agrees with the pages on disk -------------------------- */
/* A sitemap goes stale silently. Nothing on the rendered site shows that a page
   is missing from it, and Search Console only says so weeks after launch. So it
   is checked here, against the same `pages` list everything else uses.

   The rule: every page is in the sitemap EXCEPT the ones that say noindex, and
   every noindex page must be absent — listing a noindex URL is a contradiction
   Search Console reports as an error. */

let sitemapNote = '';
const sitemapPath = join(ROOT, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  sitemapNote = 'sitemap.xml: not present (LAUNCH.md §4)';
} else {
  const xml = await readFile(sitemapPath, 'utf8');
  const body = xml.replace(/<!--[\s\S]*?-->/g, ' ');           // the file's own notes name URLs
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);

  for (const l of locs) {
    if (!/^https:\/\//.test(l)) fail(sitemapPath, `<loc> must be an absolute https URL — got "${l}"`);
    if (/\/index\.html$/.test(l)) fail(sitemapPath, `<loc> points at index.html, not the directory — "${l}"`);
  }
  const listed = new Set(locs.map(l => l.replace(/^https:\/\/[^/]+/, '') || '/'));

  for (const p of pages) {
    /* the path serve.mjs would answer on: /what-we-do/index.html -> /what-we-do/ */
    const rel = relative(ROOT, p).replace(/\\/g, '/');
    const url = '/' + rel.replace(/(^|\/)index\.html$/, '$1');
    const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(src.get(p));

    if (noindex && listed.has(url)) fail(sitemapPath, `lists ${url}, which is noindex`);
    if (!noindex && !listed.has(url)) fail(sitemapPath, `missing ${url}`);
    listed.delete(url);
  }
  for (const stray of listed) fail(sitemapPath, `lists ${stray}, which is not a page on disk`);

  /* One domain, spelled one way. Two spellings means one of them is wrong. */
  const hosts = new Set(locs.map(l => (l.match(/^https:\/\/([^/]+)/) || [])[1]).filter(Boolean));
  if (hosts.size > 1) fail(sitemapPath, `more than one host: ${[...hosts].join(', ')}`);

  sitemapNote = `sitemap.xml: ${locs.length} URLs, host ${[...hosts][0] || '(none)'}`;
}

/* ---- report ----------------------------------------------------------- */

console.log(`Sixfold site audit — ${pages.length} pages, ${linkCount} internal links checked`);
if (sitemapNote) console.log('  ' + sitemapNote);
console.log(`  chrome compared across: ${chromePages.map(p => relative(ROOT, p)).join(', ')}`);
if (noChrome.length) console.log(`  links only (no CHROME markers): ${noChrome.map(p => relative(ROOT, p)).join(', ')}`);

if (waivedCount) console.log(`  copy rules waived in-file (AUDIT-ALLOW): ${waivedCount}`);

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  process.exit(1);
}
console.log('\nAll clear.');

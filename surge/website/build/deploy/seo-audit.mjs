/* Surge site — SEO audit.

   Reads the shipped HTML rather than driving a browser: everything that
   decides whether a page can rank is in the markup, and a file pass can check
   all 28 pages against each other (uniqueness, the link graph, sitemap
   coverage) which a per-page browser pass cannot.

   What it checks
     - title: present, unique, length, brand pattern
     - meta description: present, unique, length
     - canonical: present, self-referencing, matches the page's own path
     - Open Graph + image, and og:url agreeing with canonical
     - h1: exactly one, not a duplicate of the title
     - heading order, and headings that are empty
     - internal link graph: orphans, dead ends, generic anchor text
     - image alt coverage
     - sitemap: every indexable page listed, nothing listed that is not shipped
     - JSON-LD presence and shape
     - thin content, by visible word count
     - the launch blockers: noindex meta and robots.txt Disallow

   Run:  node deploy/seo-audit.mjs
   Exits 1 on any FAIL. */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN = 'https://surgeftw.com';

/* ---------------------------------------------------------------- collect */
function pages(dir = SITE, base = '', acc = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('_') || n === 'deploy' || n === 'node_modules' || n === 'api' || n === 'assets') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) pages(p, `${base}${n}/`, acc);
    /* A thank-you page reached by a form redirect SHOULD be orphaned and SHOULD
       NOT be in the sitemap; a 404 likewise. The first run failed both, wrongly. */
    else if (n === 'index.html') acc.push({ url: `/${base}`, file: p, utility: base === 'thank-you/' });
    else if (n === '404.html') acc.push({ url: '/404.html', file: p, utility: true });
  }
  return acc.sort((a, b) => a.url.localeCompare(b.url));
}

const P = pages();
for (const p of P) p.src = readFileSync(p.file, 'utf8');

const FAIL = [], WARN = [], NOTE = [];
let chromeHeading = false;   // the footer's h4s, which trip every page identically
const fail = (u, m) => FAIL.push([u, m]);
const warn = (u, m) => WARN.push([u, m]);
const note = (m) => NOTE.push(m);

const attr = (s, re) => { const m = s.match(re); return m ? m[1].trim() : null; };
const title = s => attr(s, /<title>([\s\S]*?)<\/title>/i);
const desc  = s => attr(s, /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
const canon = s => attr(s, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
const ogp   = (s, k) => attr(s, new RegExp(`<meta\\s+property=["']og:${k}["']\\s+content=["']([\\s\\S]*?)["']`, 'i'));
const robots= s => attr(s, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);

/* Strip the header and footer FIRST. They are the same ~120 words on every one
   of the 28 pages, and counting them made every thin page look 120 words
   healthier than it is — the first run put /blog/ at 240 words when its own
   content is about half that. */
const body = s => s
  .replace(/<header[\s\S]*?<\/header>/gi, ' ')
  .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

/* strip script/style/comments, then tags, for a visible word count */
const words = s0 => body(s0)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .split(/\s+/).filter(w => /[a-z]/i.test(w)).length;

/* ------------------------------------------------------------ per page */
const titles = new Map(), descs = new Map();

for (const p of P) {
  const { url, src } = p;
  const t = title(src), d = desc(src), c = canon(src);
  p.t = t; p.d = d; p.c = c; p.words = words(src);

  /* title */
  if (!t) fail(url, 'no <title>');
  else {
    if (t.length > 60) warn(url, `title ${t.length} chars — Google truncates around 60: "${t}"`);
    if (t.length < 15) warn(url, `title only ${t.length} chars: "${t}"`);
    if (!/surge/i.test(t)) warn(url, `title does not contain the brand: "${t}"`);
    const prev = titles.get(t);
    if (prev) fail(url, `duplicate <title> with ${prev}: "${t}"`);
    else titles.set(t, url);
  }

  /* description */
  if (!d) { if (!p.utility) fail(url, 'no meta description'); }
  else {
    if (d.length > 160) warn(url, `meta description ${d.length} chars — truncates around 155-160`);
    if (d.length < 70) warn(url, `meta description only ${d.length} chars — short for a result snippet`);
    const prev = descs.get(d);
    if (prev) fail(url, `duplicate meta description with ${prev}`);
    else descs.set(d, url);
  }

  /* canonical */
  if (!c) { if (!p.utility) fail(url, 'no canonical link'); }
  else {
    const want = ORIGIN + url;
    if (c !== want) fail(url, `canonical points at ${c}, should be ${want}`);
  }

  /* open graph */
  if (!p.utility) {
    for (const k of ['title', 'description', 'type', 'url', 'image']) {
      if (!ogp(src, k)) warn(url, `no og:${k}`);
    }
    const ou = ogp(src, 'url');
    if (ou && c && ou !== c) fail(url, `og:url (${ou}) disagrees with canonical (${c})`);
    const oi = ogp(src, 'image');
    if (oi && !oi.startsWith('http')) fail(url, `og:image is not an absolute URL: ${oi}`);
  }

  /* headings */
  const h1s = [...src.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  if (h1s.length === 0) fail(url, 'no <h1>');
  else if (h1s.length > 1) fail(url, `${h1s.length} <h1> elements`);
  else if (h1s[0] && t && h1s[0].toLowerCase() === t.toLowerCase()) warn(url, 'h1 is identical to the title — two chances to say something, used once');

  let prev = 0;
  for (const m of src.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const lvl = +m[1], txt = m[2].replace(/<[^>]+>/g, '').trim();
    /* An empty heading carrying a data-* slot is a JS template, not a defect —
       /team/'s detail panel starts `.team-detail.is-empty { display:none }` and
       is filled on click. The first run flagged it; it is working code. */
    if (!txt && !/\sdata-[a-z-]+/.test(m[0])) warn(url, `empty <h${lvl}>`);
    if (prev && lvl > prev + 1) {
      /* the footer's three column headings are h4 under an h2 on all 28 pages —
         that is one site-wide finding, not 28 identical ones */
      if (['Contact', 'Pages', 'Follow'].includes(txt)) chromeHeading = true;
      else warn(url, `heading jumps h${prev} → h${lvl} at "${txt.slice(0, 40)}"`);
    }
    prev = lvl;
  }

  /* images */
  const imgs = [...src.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const noAlt = imgs.filter(i => !/\balt\s*=/.test(i));
  if (noAlt.length) fail(url, `${noAlt.length} <img> with no alt attribute`);

  /* thin content */
  if (!p.utility && p.words < 250) warn(url, `only ~${p.words} visible words — thin for a page meant to rank`);

  /* launch state */
  const r = robots(src);
  p.noindex = r && /noindex/i.test(r);
}

if (chromeHeading) warn('(site-wide)',
  "the footer's column headings are <h4> with no <h3> above them, so every page jumps h2 → h4. Cosmetic for SEO, minor for screen readers.");

/* --------------------------------------------------------- link graph */
const inbound = new Map(P.map(p => [p.url, 0]));
const generic = /^(click here|here|read more|more|learn more|this|link)$/i;

for (const p of P) {
  let out = 0;
  for (const m of p.src.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1], text = m[2].replace(/<[^>]+>/g, '').trim();
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.split('#')[0].split('?')[0];
    if (!path) continue;
    out++;
    if (inbound.has(path)) inbound.set(path, inbound.get(path) + 1);
    if (text && generic.test(text)) warn(p.url, `generic anchor text "${text}" → ${path}`);
  }
  p.out = out;
  if (out < 3 && !p.utility) warn(p.url, `only ${out} internal links out — a dead end for crawlers and readers`);
}
for (const p of P) {
  if (p.url === '/' || p.utility) continue;
  const n = inbound.get(p.url);
  if (n === 0) fail(p.url, 'ORPHAN — no internal link anywhere on the site points to it');
  else if (n === 1) note(`only 1 internal link points to ${p.url}`);
}

/* ----------------------------------------------------------- sitemap */
const smPath = join(SITE, 'sitemap.xml');
if (!existsSync(smPath)) fail('/', 'no sitemap.xml');
else {
  const sm = readFileSync(smPath, 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(ORIGIN, ''));
  const shipped = new Set(P.filter(p => !p.utility).map(p => p.url));
  shipped.delete('/404.html');
  for (const u of shipped) if (!locs.includes(u)) fail(u, 'shipped but NOT in sitemap.xml');
  for (const l of locs) if (!shipped.has(l)) fail('/sitemap.xml', `lists ${l}, which is not a shipped page`);
  note(`sitemap lists ${locs.length} URLs; ${shipped.size} indexable pages shipped`);
  if (!/lastmod/.test(sm)) note('sitemap has no <lastmod> — optional, but it is how a crawler prioritises a re-crawl');
}

/* ------------------------------------------------------- robots.txt */
const rPath = join(SITE, 'robots.txt');
if (!existsSync(rPath)) fail('/', 'no robots.txt');
else {
  const r = readFileSync(rPath, 'utf8');
  if (/^\s*Disallow:\s*\/\s*$/mi.test(r)) note('robots.txt still has "Disallow: /" — correct for staging, must come off at launch');
  if (!/Sitemap:/i.test(r)) warn('/robots.txt', 'no Sitemap: line');
}

/* --------------------------------------------------------- JSON-LD */
const withLd = P.filter(p => /application\/ld\+json/.test(p.src));
note(`JSON-LD on ${withLd.length} of ${P.length} pages: ${withLd.map(p => p.url).join(', ') || 'none'}`);
for (const p of withLd) {
  const raw = attr(p.src, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try { const o = JSON.parse(raw); note(`  ${p.url} → @type ${o['@type']}`); }
  catch { fail(p.url, 'JSON-LD does not parse'); }
}

/* ---------------------------------------------------------- report */
const noindexed = P.filter(p => p.noindex).length;
console.log(`Surge SEO audit — ${P.length} pages\n`);

if (FAIL.length) { console.log('---- FAIL ----'); for (const [u, m] of FAIL) console.log(`  ${u.padEnd(30)} ${m}`); console.log(); }
if (WARN.length) { console.log('---- WARN ----'); for (const [u, m] of WARN) console.log(`  ${u.padEnd(30)} ${m}`); console.log(); }
if (NOTE.length) { console.log('---- NOTES ----'); for (const m of NOTE) console.log(`  ${m}`); console.log(); }

console.log('---- titles and descriptions ----');
for (const p of P) {
  console.log(`  ${p.url.padEnd(30)} t=${String(p.t ? p.t.length : 0).padStart(2)} d=${String(p.d ? p.d.length : 0).padStart(3)} words=${String(p.words).padStart(4)} in=${String(inbound.get(p.url) ?? 0).padStart(2)} out=${String(p.out).padStart(2)}`);
}

console.log(`\n${FAIL.length} failures, ${WARN.length} warnings.`);
console.log(`⚑ ${noindexed} of ${P.length} pages carry <meta name="robots" content="noindex">.`);
process.exit(FAIL.length ? 1 : 0);

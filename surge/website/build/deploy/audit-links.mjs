// Pre-launch integrity pass over the built site: every internal link resolves to a
// real page, every asset exists on disk, every #anchor exists on its target page.
// Run against the BUNDLE, not the repo — what ships is what matters.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];

function walk(dir, base = '', acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, `${base}${name}/`, acc);
    else if (name.endsWith('.html')) acc.push(base + name);
  }
  return acc;
}

const pages = walk(root).sort();

if (pages.length === 0) {
  console.error(`NO PAGES FOUND under ${root} — wrong path, or the extract failed.`);
  process.exit(1);
}

// url path -> set of ids/names available on that page
const idsByPage = new Map();
for (const rel of pages) {
  const html = readFileSync(join(root, rel), 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/\sname="([^"]+)"/g)) ids.add(m[1]);
  idsByPage.set('/' + rel.replace(/index\.html$/, ''), ids);
}

// Resolve a site-absolute URL path to the file that would serve it.
function resolvePage(urlPath) {
  const clean = urlPath.replace(/[?#].*$/, '');
  const candidates = [
    clean.replace(/^\//, ''),
    join(clean.replace(/^\//, ''), 'index.html'),
    clean.replace(/^\//, '') + '.html',
  ];
  if (clean === '/' || clean === '') candidates.unshift('index.html');
  for (const c of candidates) {
    const f = join(root, c);
    if (existsSync(f) && statSync(f).isFile()) return c;
  }
  return null;
}

const problems = [];
const externals = new Set();

for (const rel of pages) {
  // Drop <script> bodies first. /team/ builds its detail-panel <img> by string
  // concatenation, so a raw scan reports src="/assets/img/people/' + d.photo + '
  // as a broken asset. It is JS, not markup.
  const html = readFileSync(join(root, rel), 'utf8')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const here = '/' + rel.replace(/index\.html$/, '');

  const urls = [];
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) urls.push(['href', m[1]]);
  for (const m of html.matchAll(/\ssrc="([^"]+)"/g)) urls.push(['src', m[1]]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) urls.push(['srcset', part.trim().split(/\s+/)[0]]);
  }
  for (const m of html.matchAll(/\scontent="(https?:\/\/surgeftw\.com[^"]*)"/g)) urls.push(['meta', m[1]]);

  for (const [kind, raw] of urls) {
    if (!raw) continue;
    let u = raw.trim();
    if (/^(mailto:|tel:|data:|javascript:)/i.test(u)) continue;

    // production absolute -> treat as site-relative
    u = u.replace(/^https?:\/\/surgeftw\.com/, '') || '/';
    if (/^https?:\/\//i.test(u)) { externals.add(u); continue; }

    if (u.startsWith('#')) {
      const ids = idsByPage.get(here) || new Set();
      if (!ids.has(u.slice(1))) problems.push(`${rel}  BAD ANCHOR  ${raw}`);
      continue;
    }
    if (!u.startsWith('/')) { problems.push(`${rel}  RELATIVE URL (${kind})  ${raw}`); continue; }

    const target = resolvePage(u);
    if (!target) { problems.push(`${rel}  BROKEN ${kind.toUpperCase()}  ${raw}`); continue; }

    const hash = raw.match(/#([^"?]+)/);
    if (hash && target.endsWith('.html')) {
      const targetUrl = '/' + target.replace(/index\.html$/, '');
      const ids = idsByPage.get(targetUrl);
      if (ids && !ids.has(hash[1])) problems.push(`${rel}  BAD ANCHOR  ${raw}  (no #${hash[1]} on ${targetUrl})`);
    }
  }
}

console.log(`${pages.length} pages audited`);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log('  ' + p);
} else {
  console.log('No broken internal links, assets or anchors.');
}
console.log(`\n${externals.size} distinct external URLs (not fetched):`);
for (const e of [...externals].sort()) console.log('  ' + e);

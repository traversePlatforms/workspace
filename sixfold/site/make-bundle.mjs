/* Sixfold Colorado — build the upload bundle.
 *
 *   node sixfold/site/make-bundle.mjs
 *
 * Writes dist/sixfold-site-<date>.zip containing ONLY what belongs on a public
 * host. The point is that the do-not-upload list in LAUNCH.md §2 stops being
 * something a person has to remember at 11pm in a file manager.
 *
 * ⚑ It is an ALLOW-LIST, not a deny-list. A new .md or .mjs dropped into the site
 * is excluded by default rather than shipped by accident — the failure mode of a
 * deny-list is silent and public.
 *
 * Dotfiles ARE included: .htaccess and api/.htaccess are load-bearing, and most
 * file managers hide them, which is exactly how they get left behind.
 */
import { readdirSync, statSync, mkdirSync, rmSync, cpSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SITE = dirname(fileURLToPath(import.meta.url));
const DIST = join(SITE, 'dist');
const stamp = new Date().toISOString().slice(0, 10);
const NAME = `sixfold-site-${stamp}`;
const STAGE = join(DIST, NAME);

/* what a visitor may receive */
const ALLOW_EXT = new Set([
  '.html', '.css', '.js', '.php', '.txt', '.xml',
  '.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.woff2', '.pdf',
]);
const ALLOW_DOTFILES = new Set(['.htaccess']);

/* never, whatever the extension says */
const DENY_DIRS = new Set(['_tabled', 'dist', 'node_modules']);
const DENY_FILES = new Set([
  'build-photos.mjs', 'make-bundle.mjs', 'serve.mjs',
  'audit-links.mjs', 'audit-runtime.mjs',
  'submissions.log',
]);
/* held in reserve, referenced by no page — see PHOTOS.md */
const DENY_UNUSED = new Set(['limbing.jpg', 'limbing.webp', 'stand.jpg', 'stand.webp']);

const kept = [], skipped = [];

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    const rel = relative(SITE, abs).split('\\').join('/');
    if (e.isDirectory()) {
      if (DENY_DIRS.has(e.name) || e.name === '.git') { skipped.push(rel + '/  (directory)'); continue; }
      walk(abs);
      continue;
    }
    if (DENY_FILES.has(e.name) || DENY_UNUSED.has(e.name)) { skipped.push(rel); continue; }
    const ext = extname(e.name).toLowerCase();
    const isDotfile = e.name.startsWith('.');
    const ok = isDotfile ? ALLOW_DOTFILES.has(e.name) : ALLOW_EXT.has(ext);
    if (!ok) { skipped.push(rel); continue; }
    const dest = join(STAGE, rel);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(abs, dest);
    kept.push({ rel, bytes: statSync(abs).size });
  }
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
walk(SITE);

/* ---- sanity: refuse to ship a bundle that leaks ------------------------- */
const leaks = kept.filter(f =>
  /\.(md|mjs|log|sh|map)$/i.test(f.rel) || f.rel.startsWith('_tabled/'));
if (leaks.length) {
  console.error('REFUSING TO BUILD — these would have been uploaded:');
  for (const l of leaks) console.error('  ' + l.rel);
  process.exit(1);
}
/* and one that is missing something load-bearing */
const MUST = ['index.html', '.htaccess', 'api/.htaccess', 'api/submit.php',
              'api/config.php', 'robots.txt', 'sitemap.xml', 'assets/site.css'];
const missing = MUST.filter(m => !kept.some(f => f.rel === m));
if (missing.length) {
  console.error('REFUSING TO BUILD — missing from the bundle:');
  for (const m of missing) console.error('  ' + m);
  process.exit(1);
}

const zip = join(DIST, NAME + '.zip');
rmSync(zip, { force: true });
execFileSync('powershell', ['-NoProfile', '-Command',
  `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });

const total = kept.reduce((n, f) => n + f.bytes, 0);
console.log(`\n  ${kept.length} files, ${(total / 1024).toFixed(0)} KB uncompressed`);
console.log(`  zip: ${relative(process.cwd(), zip).split('\\').join('/')} ` +
            `(${(statSync(zip).size / 1024).toFixed(0)} KB)`);
console.log(`\n  excluded ${skipped.length}:`);
for (const s of skipped.sort()) console.log('    - ' + s);
console.log('\n  ⚑ Extract INTO public_html. SiteGround nests a subfolder if you');
console.log('    extract the zip in place — check index.html is at the root after.');

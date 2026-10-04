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
import { readdirSync, statSync, mkdirSync, rmSync, cpSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
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
  /* SX-9e: credentials live in sixfold-private/ above public_html, never in a bundle */
  'secrets.php', 'rounds-codes.php',
  /* review 2026-10-03: the shapes of those files have no business on the live site either */
  'secrets.example.php', 'rounds-codes.example.php', 'build-quote-page.mjs', 'DEPLOY-ROUNDS.md',
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

/* ⚑ NOT PowerShell's Compress-Archive. Windows PowerShell 5.1 writes path
   separators as BACKSLASHES into the zip, which the ZIP spec forbids — it
   requires forward slashes. Checked on the 2026-09-26 bundle: 31 of 35 entries
   came out as `api\config.php`, `assets\site.css` and so on.

   Whether that matters depends entirely on the extractor at the other end. A
   normalising one (SiteGround's evidently is — the 2026-09-21 upload worked)
   silently does the right thing. Info-ZIP's `unzip` on Linux does NOT: it treats
   the whole thing as a FILENAME containing a backslash, so you get flat files
   called `api\config.php` at the document root, no `api/` directory, and a site
   whose stylesheet and form both 404. That failure is silent at upload time and
   public immediately.

   bsdtar ships in System32 on Windows 10+ and writes conformant forward slashes.
   Called by full path deliberately: in Git Bash a bare `tar` resolves to GNU tar,
   which cannot create zips at all. Verified after writing, below.

   The top-level entries are passed by NAME rather than as `.` — bsdtar given `.`
   stores every path with a `./` prefix, which the check below also rejects. */
const BSDTAR = 'C:\\Windows\\System32\\tar.exe';
const TOP = readdirSync(STAGE);          // dotfiles included: .htaccess is load-bearing
execFileSync(BSDTAR, ['-a', '-c', '-f', zip, '-C', STAGE, ...TOP], { stdio: 'inherit' });

/* Verify what was actually stored, rather than trusting the tool. Reads the
   central directory and fails the build on any backslash or any `./` prefix. */
{
  const buf = readFileSync(zip);
  const names = [];
  for (let i = 0; i < buf.length - 4; i++) {
    if (buf.readUInt32LE(i) === 0x02014b50) {
      const n = buf.readUInt16LE(i + 28);
      names.push(buf.subarray(i + 46, i + 46 + n).toString('utf8'));
    }
  }
  const bad = names.filter((n) => n.includes('\\') || n.startsWith('./'));
  if (!names.length || bad.length) {
    console.error(`\n  ✗ BAD ZIP — ${bad.length} of ${names.length} entries are malformed:`);
    for (const n of bad.slice(0, 10)) console.error('      ' + n);
    console.error('    Not shipping this. Fix the zipper before uploading.');
    process.exit(1);
  }
  console.log(`\n  zip entries verified: ${names.length}, all forward-slash, no ./ prefix`);
}

const total = kept.reduce((n, f) => n + f.bytes, 0);
console.log(`\n  ${kept.length} files, ${(total / 1024).toFixed(0)} KB uncompressed`);
console.log(`  zip: ${relative(process.cwd(), zip).split('\\').join('/')} ` +
            `(${(statSync(zip).size / 1024).toFixed(0)} KB)`);
console.log(`\n  excluded ${skipped.length}:`);
for (const s of skipped.sort()) console.log('    - ' + s);
console.log('\n  ⚑ Extract INTO public_html. SiteGround nests a subfolder if you');
console.log('    extract the zip in place — check index.html is at the root after.');

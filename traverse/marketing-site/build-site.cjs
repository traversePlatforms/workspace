// The homepage for traverseplatforms.com (2026-10-09: Matthew bought the domain at Porkbun and a SiteGround GrowBig account).
// Made from the preview build, so run these first:
//   node traverse/marketing-site/build-preview.cjs
//   node traverse/marketing-site/build-editions-page.cjs
//   node traverse/marketing-site/build-site.cjs
// Output: site/public_html/{index.html, editions/index.html, .htaccess} and site/extract-in-traverseplatforms-public_html.zip,
// which goes into the NEW account's traverseplatforms.com/public_html (never Sixfold's).
// The apps live on this same account (moved from Sixfold's hosting 2026-10-09), but nothing here links to them (no public sign-in).
// Still noindex: the pricing is sample and the contact email is a placeholder; Matthew says when it opens to search.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const here = __dirname, PREV = path.join(here, 'preview', 'tp-5ea36a05'), OUT = path.join(here, 'site', 'public_html');
/* the apps live on this account (moved 2026-10-09), but the public pages never point at them: Matthew 2026-10-09, the sign-in
   pages are not for the public. The build refuses a page that names an app folder. */
const APP_FOLDERS = ['summit-de59ae83', 'tr-cb2e8587', 'ty-25604fff', 'ts-016064fc', 'tq-9cf8d9de', 'tg-3b0b89e7'];

const home = fs.readFileSync(path.join(PREV, 'index.html'), 'utf8');
const eds = fs.readFileSync(path.join(PREV, 'editions', 'index.html'), 'utf8');
for (const [name, page] of [['homepage', home], ['editions page', eds]]) {
  const hit = APP_FOLDERS.find((f) => page.includes(f));
  if (hit) throw new Error('the ' + name + ' names an app folder (' + hit + '); the public pages must not lead to a sign-in');
  if (/href="\/[^"]/.test(page)) throw new Error('the ' + name + ' links to a path on this domain');
}

const htaccess = `# traverseplatforms.com (2026-10-09). Out of search until Matthew opens it (sample pricing, placeholder contact).
# Not cached by SiteGround's Dynamic Cache, so an upload shows at once.
# The apps live here too (moved from sixfoldcolorado.com 2026-10-09), so the same guards Sixfold's site had: no logs,
# scripts or source maps served, nothing starting with a dot, and the browser safety headers.
<FilesMatch "\\.(md|mjs|log|sh|map)$">
  Require all denied
</FilesMatch>
RedirectMatch 404 /\\.(?!well-known)
<IfModule mod_headers.c>
Header set X-Robots-Tag "noindex, nofollow"
Header set Cache-Control "private, no-cache"
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
`;
fs.rmSync(path.join(here, 'site'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'editions'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), home);
fs.writeFileSync(path.join(OUT, 'editions', 'index.html'), eds);
fs.writeFileSync(path.join(OUT, '.htaccess'), htaccess);
/* bsdtar (Windows' own tar) writes forward-slash zips; Compress-Archive's backslash paths do not extract on the host */
execFileSync('C:/Windows/System32/tar.exe', ['-a', '-c', '-f', path.join(here, 'site', 'extract-in-traverseplatforms-public_html.zip'), 'index.html', 'editions', '.htaccess'], { cwd: OUT });
console.log('wrote site/public_html and site/extract-in-traverseplatforms-public_html.zip');

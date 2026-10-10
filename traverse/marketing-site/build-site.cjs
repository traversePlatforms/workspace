// The homepage for traverseplatforms.com (2026-10-09: Matthew bought the domain at Porkbun and a SiteGround GrowBig account).
// Made from the preview build, so run these first:
//   node traverse/marketing-site/build-preview.cjs
//   node traverse/marketing-site/build-editions-page.cjs
//   node traverse/marketing-site/build-site.cjs
// Output: site/public_html/{index.html, editions/index.html, .htaccess} and site/extract-in-traverseplatforms-public_html.zip,
// which goes into the NEW account's traverseplatforms.com/public_html (never Sixfold's).
// The apps still live on Sixfold's hosting until they move, so "Open the app" points there by full address.
// Still noindex: the pricing is sample and the contact email is a placeholder; Matthew says when it opens to search.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const here = __dirname, PREV = path.join(here, 'preview', 'tp-5ea36a05'), OUT = path.join(here, 'site', 'public_html');
const APP_BASE = 'https://sixfoldcolorado.com/';   /* where the edition apps live until they move to this account */

const home = fs.readFileSync(path.join(PREV, 'index.html'), 'utf8');
let eds = fs.readFileSync(path.join(PREV, 'editions', 'index.html'), 'utf8');
if (/href="\/[^"]/.test(home)) throw new Error('the homepage links to a path on this domain; nothing lives there yet');
const a = "'/' + D.APPS[k] + '/'";
if (eds.split(a).length !== 2) throw new Error('the editions page app link moved; update build-site.cjs');
eds = eds.replace(a, "'" + APP_BASE + "' + D.APPS[k] + '/'");
if (/href="\/[^"]/.test(eds)) throw new Error('the editions page links to a path on this domain');

const htaccess = `# traverseplatforms.com (2026-10-09). Out of search until Matthew opens it (sample pricing, placeholder contact).
# Not cached by SiteGround's Dynamic Cache, so an upload shows at once.
<IfModule mod_headers.c>
Header set X-Robots-Tag "noindex, nofollow"
Header set Cache-Control "private, no-cache"
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

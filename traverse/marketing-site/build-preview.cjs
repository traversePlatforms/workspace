// Builds the hidden web preview of the traverseplatforms.com homepage from the design canvas.
//
//   node traverse/marketing-site/build-preview.cjs
//
// Source: project/Main.dc.html (the canvas board, published at claude.ai/artifact/7kA7Cu7Pfh7BFyAwqVFQpb).
// Output: preview/tp-5ea36a05/{index.html,.htaccess}. Upload BOTH into
//   sixfoldcolorado.com/public_html/tp-5ea36a05/
// It is a stopgap until Traverse has its own hosting (2026-10-06): unlisted, noindex, never in
// Sixfold's sitemap.xml or robots.txt (listing it in robots.txt would publish the address).
'use strict';
const fs = require('fs');
const path = require('path');

const FOLDER = 'tp-5ea36a05';
const here = __dirname;
const src = fs.readFileSync(path.join(here, 'project', 'Main.dc.html'), 'utf8');

function between(s, a, b) {
  const i = s.indexOf(a);
  const j = s.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + a + ' / ' + b);
  return s.slice(i + a.length, j);
}

const head = between(src, '<helmet>', '</helmet>').trim();
let body = between(src, '</helmet>', '</x-dc>').trim();

// The edition pages and sign-in page don't exist yet, and Sixfold's ErrorDocument sends any missing path to
// Sixfold's own homepage. Roofing and Yards open their apps (build-editions.cjs, on the same hosting); Solar and Pest
// have none, so they stay on this page; Sign in goes to the editions so you pick which app.
const APPS = ['tr-cb2e8587', 'ty-25604fff'];
const links = { '/roofing': '/' + APPS[0] + '/', '/yards': '/' + APPS[1] + '/', '/solar': '#trades', '/pest': '#trades', '/sign-in': '#trades' };
for (const [from, to] of Object.entries(links)) body = body.split('href="' + from + '"').join('href="' + to + '"');
if ((body.match(/href="\/[^"]*"/g) || []).some((h) => !APPS.some((a) => h === 'href="/' + a + '/"'))) throw new Error('a site-absolute link is left; it would land on Sixfold');

// The mark, as the tab icon.
const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#13294b"/>'
  + '<g transform="translate(8.5 8.5) scale(0.734)"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<circle cx="9" cy="47" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/>'
  + '<circle cx="37" cy="40" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="#d6400c"/></g></svg>';

// The board is laid out inline; these only step it down for phones. Stylesheet !important beats
// an inline style that isn't.
const phone = `<style>
html{scroll-behavior:smooth}
@media (max-width:760px){
  header nav a:not(:nth-last-child(-n+2)){display:none}
  h1{font-size:42px !important}
  h2{font-size:30px !important}
  #demo h2{font-size:34px !important}
  section[style*="max-width: 1200px"],
  section > div[style*="max-width: 1200px"]{padding-top:48px !important;padding-bottom:48px !important}
  #top{gap:32px !important}
  /* the whole-day section: the phone first, then the four parts, all reading left to right */
  .dayphone{order:-1}
  .daycol{gap:28px !important}
  .dayitem{align-items:flex-start !important;text-align:left !important}
  .daycol-l .dayitem > div:first-child{flex-direction:row-reverse}
}
@media (max-width:420px){
  h1{font-size:36px !important}
  #top > div:last-child{height:430px !important}
}
</style>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Traverse Platforms</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
${head}
${phone}
</head>
<body>
${body}
</body>
</html>
`;

const htaccess = `# Traverse Platforms homepage preview (2026-10-06). Unlisted stopgap on Sixfold's hosting until
# Traverse has its own account. Keep it out of search, and out of SiteGround's Dynamic Cache so an
# upload shows at once (same reason as summit-de59ae83/.htaccess).
<IfModule mod_headers.c>
Header set X-Robots-Tag "noindex, nofollow"
Header set Cache-Control "private, no-cache"
</IfModule>
`;

const out = path.join(here, 'preview', FOLDER);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, '.htaccess'), htaccess);
console.log('wrote', path.relative(process.cwd(), out), (html.length / 1024).toFixed(1) + ' KB');

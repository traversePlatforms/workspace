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
// Sixfold's own homepage. Every edition opens its app (build-editions.cjs, on the same hosting); Pest has none, so they stay on this page; Sign in goes to the editions so you pick which app.
const APPS = ['tr-cb2e8587', 'ty-25604fff', 'ts-016064fc', 'tq-9cf8d9de', 'tg-3b0b89e7'];
const links = { '/roofing': '/' + APPS[0] + '/', '/yards': '/' + APPS[1] + '/', '/solar': '/' + APPS[2] + '/', '/pest': '/' + APPS[3] + '/', '/security': '/' + APPS[4] + '/', '/sign-in': '#trades' };
for (const [from, to] of Object.entries(links)) body = body.split('href="' + from + '"').join('href="' + to + '"');
// the phone and tablet menu (the canvas has none): a button after the nav that opens the links in a panel
if (body.split('</nav>').length !== 2) throw new Error('expected one nav');
body = body.replace('</nav>', '</nav>\n<button class="navtoggle" type="button" aria-controls="mainnav" aria-expanded="false" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>');
const menuJs = `<script>
(function () {
  var b = document.querySelector('.navtoggle'), n = document.getElementById('mainnav'); if (!b || !n) return;
  function set(open) { n.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); }
  b.addEventListener('click', function () { set(!n.classList.contains('open')); });
  n.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();
</script>`;
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
.navtoggle{display:none}
/* tablets held upright, and phones */
@media (max-width:1000px){
  /* header: logo, Book a demo and a menu button on one row; the links open in a panel */
  header{position:relative}
  header > div{flex-wrap:nowrap !important}
  #mainnav{margin-left:auto;gap:0 !important}
  #mainnav a:not(:last-child){display:none !important}
  .navtoggle{display:inline-grid;place-items:center;flex:none;width:44px;height:44px;margin-left:10px;border:1.5px solid #dce2ea;border-radius:10px;background:#ffffff;color:#13294b;cursor:pointer}
  .navtoggle svg{width:22px;height:22px}
  #mainnav.open{position:absolute;top:100%;left:0;right:0;z-index:30;display:flex !important;flex-direction:column !important;align-items:stretch !important;justify-content:flex-start !important;background:#ffffff;border-bottom:1px solid #dce2ea;padding:6px 24px 18px;box-shadow:0 12px 24px -12px rgba(15,27,45,0.25)}
  #mainnav.open a:not(:last-child){display:block !important;width:100%;text-align:left;padding:14px 2px;border-bottom:1px solid #eef1f5;font-size:17px}
  #mainnav.open a:last-child{display:flex !important;width:100%;box-sizing:border-box;margin-top:14px;justify-content:center;height:48px !important;font-size:16px !important}
  /* the whole-day section: the phone first, the four parts in a two-by-two grid under it */
  .dayrow{flex-direction:column;align-items:center}
  .dayphone{order:-1}
  .daycol{width:100%;flex:none !important;display:grid !important;grid-template-columns:1fr 1fr;gap:32px !important}
  .dayitem{align-items:flex-start !important;text-align:left !important}
  .daycol-l .dayitem > div:first-child{flex-direction:row-reverse}
  .dayitem p{max-width:none !important}
  /* How it works: the drawn traverse needs a wide screen; under it the stations run down one line that stops at the close */
  .trav-line{display:none !important}
  .trav-row{flex-direction:column}
  .trav-st{position:relative;padding:0 0 34px 34px !important;margin-left:14px;border-left:5px solid #ffffff;align-items:flex-start !important;text-align:left !important}
  .trav-st:last-child{border-left-color:transparent;padding-bottom:0 !important}
  .trav-st > span:first-child{margin-left:-51.5px}
  .trav-st:last-child > span:first-child{margin-left:-58.5px}
  .trav-st p{max-width:52ch !important}
  /* the conditions three across, the features two by two with hairline dividers */
  .conds{grid-template-columns:repeat(3,1fr) !important;gap:28px 28px !important}
  .featstrip{grid-template-columns:1fr 1fr !important;gap:1px !important;background:rgba(255,255,255,0.14) !important}
  .featstrip > div{box-shadow:none !important;background:#13294b}
  /* five editions, two across: the last one takes the whole row rather than sitting alone */
  .eds > div:last-child:nth-child(odd){grid-column:1 / -1}
}
/* phones */
@media (max-width:760px){
  h1{font-size:42px !important}
  h2{font-size:32px !important}
  #demo h2{font-size:34px !important}
  section[style*="max-width: 1200px"],
  section > div[style*="max-width: 1200px"]{padding-top:52px !important;padding-bottom:52px !important}
  #top{gap:32px !important}
  .daycol{grid-template-columns:1fr !important;gap:28px !important}
  .conds{grid-template-columns:1fr !important}
  .conds b{font-size:38px !important}
  .featstrip{grid-template-columns:1fr !important}
  .eds{grid-template-columns:1fr !important}
}
/* small phones: the wordmark drops "Platforms" so the header stays on one row */
@media (max-width:480px){
  h1{font-size:36px !important}
  #top > div:last-child{height:430px !important}
  header a[href="#top"] > span > span{display:none}
  #mainnav a:last-child{height:40px !important;padding:0 14px !important;font-size:14px !important}
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
${menuJs}
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

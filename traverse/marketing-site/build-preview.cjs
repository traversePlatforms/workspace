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

let head = between(src, '<helmet>', '</helmet>').trim();
// the font files come from fonts.gstatic.com, so that connection is opened early too
const PRECONNECT = '<link rel="preconnect" href="https://fonts.googleapis.com">';
if (!head.includes(PRECONNECT)) throw new Error('the fonts preconnect moved');
head = head.replace(PRECONNECT, () => PRECONNECT + '\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
let body = between(src, '</helmet>', '</x-dc>').trim();

// The edition pages and sign-in page don't exist yet, and Sixfold's ErrorDocument sends any missing path to
// Sixfold's own homepage. Every edition opens its app (build-editions.cjs, on the same hosting); Pest has none, so they stay on this page; Sign in goes to the editions so you pick which app.
const APPS = ['tr-cb2e8587', 'ty-25604fff', 'ts-016064fc', 'tq-9cf8d9de', 'tg-3b0b89e7'];
const links = { '/roofing': '/' + APPS[0] + '/', '/yards': '/' + APPS[1] + '/', '/solar': '/' + APPS[2] + '/', '/pest': '/' + APPS[3] + '/', '/security': '/' + APPS[4] + '/', '/sign-in': '#trades' };
for (const [from, to] of Object.entries(links)) body = body.split('href="' + from + '"').join('href="' + to + '"');
// the phone and tablet menu (the canvas has none): a button that opens the links in a panel. It sits BEFORE the
// nav in the markup so the keyboard reaches the opened links with Tab (CSS `order` keeps it at the right end of the
// header row); a function replacement so nothing in the markup is read as a $-pattern.
const NAV_OPEN = '<nav id="mainnav"';
if (body.split(NAV_OPEN).length !== 2 || body.split('</nav>').length !== 2) throw new Error('expected one nav');
body = body.replace(NAV_OPEN, () => '<button class="navtoggle" type="button" aria-controls="mainnav" aria-expanded="false" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>\n' + NAV_OPEN);
const menuJs = `<script>
(function () {
  var b = document.querySelector('.navtoggle'), n = document.getElementById('mainnav'); if (!b || !n) return;
  function isOpen() { return n.classList.contains('open'); }
  function set(open) { n.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open)); }
  b.addEventListener('click', function () { set(!isOpen()); });
  n.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) set(false); });
  // Escape closes it and puts the focus back on the button; a tap anywhere outside the header closes it
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { set(false); b.focus(); } });
  document.addEventListener('click', function (e) { if (isOpen() && !(e.target.closest && e.target.closest('header'))) set(false); });
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
/* a section the script has focused after a page link: no ring on a block of content */
[tabindex="-1"]:focus{outline:none}
/* the hero map: the board sets it with the inset shorthand; browsers without it (iOS 14.0 and under) get the longhands */
#top > div:last-child > div:first-child{top:0;right:40px;bottom:50px;left:0}
/* tablets held upright, and phones */
@media (max-width:1000px){
  /* header: logo, Book a demo and a menu button on one row; the links open in a panel */
  header{position:relative}
  header > div{flex-wrap:nowrap !important}
  #mainnav{margin-left:auto;gap:0 !important}
  #mainnav a:not(:last-child){display:none !important}
  .navtoggle{display:inline-grid;place-items:center;flex:none;order:1;width:44px;height:44px;margin-left:10px;border:1.5px solid #dce2ea;border-radius:10px;background:#ffffff;color:#13294b;cursor:pointer}
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
}
/* five editions sit in one row on a desktop; narrower than that they go two across, the mark beside the name,
   and the last one takes the whole row rather than sitting alone */
@media (max-width:1180px){
  .eds{grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:20px !important}
  .eds > div > div:first-child{flex-direction:row !important;align-items:center !important}
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
  #mainnav a:last-child{height:40px !important;padding:0 14px !important;font-size:14px !important;white-space:nowrap}
  /* the hero's door card is 290px on the board; under 338px wide it would hang off the left edge, so it narrows to fit */
  #top > div:last-child > div:last-child{width:auto !important;max-width:290px;left:0;margin-left:auto}
  /* the storm pill on the map may need two lines */
  #top > div:last-child > div:first-child > div{height:auto !important;min-height:32px;padding:5px 12px !important;line-height:1.25}
  /* the plans: one column, whatever the width (the board's 270px minimum would overflow a 300px screen) */
  #pricing [style*="minmax(270px"]{grid-template-columns:1fr !important}
}
/* the smallest phones: the wordmark, Book a demo and the menu button need 378px between them, so under 390px
   Book a demo leaves the header row (it is still the first thing in the hero, and in the open menu) */
@media (max-width:389px){
  #mainnav:not(.open) a:last-child{display:none !important}
}
/* on paper there is no scrolling to reveal anything: everything shows, the menu button goes */
@media print{
  html.anim .rv,html.anim .hero-door,html.anim .hero-stop{opacity:1 !important;transform:none !important;transition:none !important}
  html.anim .hero-route{stroke-dashoffset:0 !important}
  html.anim .hero-ping{display:none}
  html.anim .trav-line{clip-path:none !important}
  .navtoggle{display:none !important}
}
</style>`;

// Motion. The page opens at the top on a reload or a Back, whatever the browser remembers. Things rise into view
// as you reach them, the hero route draws itself and How it works traces its line. All of it hangs off html.anim,
// which the head script sets only when the device hasn't asked for reduced motion, so without the script (or with
// reduced motion) everything simply shows.
const motionHead = `<script>
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) document.documentElement.classList.add('anim');
</script>
<style>
html.anim .rv{opacity:0;transform:translateY(26px);transition:opacity .7s ease var(--d,0s),transform .8s cubic-bezier(.2,.7,.2,1) var(--d,0s)}
/* the app section slides in from its sides only where it has sides; it clips so the slide never widens the page */
#product{overflow-x:hidden;overflow-x:clip}
@media (min-width:1001px){html.anim .rv.rv-l{transform:translateX(-28px)}html.anim .rv.rv-r{transform:translateX(28px)}}
html.anim .rv.rv-pop{transform:scale(.9)}
html.anim .rv.in{opacity:1;transform:none}
/* the hero: the doors appear, the route draws from the first door to the target, the door card slides up */
html.anim .hero-door{opacity:0;transform:scale(0);transform-box:fill-box;transform-origin:center;transition:opacity .35s ease var(--d,0s),transform .45s cubic-bezier(.3,1.6,.5,1) var(--d,0s)}
html.anim .hero-route{transition:stroke-dashoffset 1.5s cubic-bezier(.55,.1,.35,1) .45s}
html.anim .hero-stop{opacity:0;transform:scale(0);transform-box:fill-box;transform-origin:center;transition:opacity .3s ease var(--d,0s),transform .5s cubic-bezier(.3,1.7,.5,1) var(--d,0s)}
html.anim .hero-ping{opacity:0;transform-box:fill-box;transform-origin:center}
html.anim .go .hero-door,html.anim .go .hero-stop{opacity:1;transform:none}
html.anim .go .hero-route{stroke-dashoffset:0 !important}
html.anim .go .hero-ping{animation:ping 2.4s ease-out 2.3s infinite}
@keyframes ping{0%{opacity:.7;transform:scale(1)}80%,100%{opacity:0;transform:scale(2.8)}}
/* How it works: the line wipes in left to right and each station arrives as the line reaches it */
html.anim .trav-line{clip-path:inset(-30px 100% -30px -30px);transition:clip-path 1.7s cubic-bezier(.45,.05,.4,1)}
html.anim .trav.in .trav-line{clip-path:inset(-30px -30px -30px -30px)}
/* hover: the edition and plan cards lift, the buttons nudge */
.eds > div,#pricing .plan{transition:translate .25s ease,box-shadow .25s ease}
.eds > div:hover,#pricing .plan:hover{translate:0 -6px;box-shadow:0 2px 4px rgba(15,27,45,0.08),0 18px 34px -10px rgba(15,27,45,0.28) !important}
html.anim .eds > div.rv,html.anim #pricing .plan.rv{transition:opacity .7s ease var(--d,0s),transform .8s cubic-bezier(.2,.7,.2,1) var(--d,0s),translate .25s ease,box-shadow .25s ease}
/* (the Find your edition button is the a[href="#trades"] with a border; the Sign in text links map to #trades too and stay still) */
a[href="#demo"],a[href="#trades"][style*="border"]{transition:translate .2s ease,filter .2s ease}
a[href="#demo"]:hover,a[href="#trades"][style*="border"]:hover{translate:0 -2px;filter:brightness(1.06)}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
</style>`;
const motionJs = `<script>
(function () {
  // open at the top: a reload or Back lands on the hero, and page links don't leave a #section in the address
  // to jump back to. A link that arrives with one from elsewhere still goes there, once.
  var root = document.documentElement;
  var navType = (function () {
    try { var en = performance.getEntriesByType && performance.getEntriesByType('navigation')[0]; if (en && en.type) return en.type; } catch (e) {}
    try { return ['navigate', 'reload', 'back_forward'][performance.navigation.type] || 'navigate'; } catch (e) { return 'navigate'; }
  })();
  // an instant jump whatever the browser makes of behavior:'instant': the smooth scrolling is switched off around it
  function jump(fn) { var was = root.style.scrollBehavior; root.style.scrollBehavior = 'auto'; try { fn(); } finally { root.style.scrollBehavior = was; } }
  function top() { jump(function () { window.scrollTo(0, 0); }); }
  function untag() { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  if (location.hash && navType === 'navigate') {
    // arrived from elsewhere with a #section: go there once the page has its fonts and sizes, then tidy the address
    window.addEventListener('load', function () { setTimeout(function () {
      var t = document.getElementById(location.hash.slice(1)); if (t) jump(function () { t.scrollIntoView(true); });
      untag();
    }, 0); });
  } else { if (location.hash) untag(); top(); }
  window.addEventListener('pageshow', function (e) { if (e.persisted) top(); });
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1), t = id && document.getElementById(id); if (!t) return;
    e.preventDefault();
    var how = root.classList.contains('anim') ? 'smooth' : 'auto';
    if (id === 'top') window.scrollTo({ top: 0, behavior: how }); else t.scrollIntoView({ behavior: how, block: 'start' });
    // the keyboard carries on from the section, not from the link
    if (id !== 'top') { t.tabIndex = -1; try { t.focus({ preventScroll: true }); } catch (err) { t.focus(); } }
  });

  if (!root.classList.contains('anim')) return;
  var all = [];
  function tag(list, cls, step, start) {
    Array.prototype.forEach.call(list, function (el, i) {
      el.classList.add('rv'); if (cls) el.classList.add(cls);
      el.style.setProperty('--d', ((start || 0) + i * (step || 0)).toFixed(2) + 's'); all.push(el);
    });
  }
  function $(s) { return document.querySelectorAll(s); }
  try {
    // the hero
    tag($('#top > div:first-child > *'), '', 0.09);
    var vis = document.querySelector('#top > div:last-child');
    if (vis) {
      var map = vis.firstElementChild, card = vis.lastElementChild, svg = map && map.querySelector('svg');
      if (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('circle[r="7"]'), function (c, i) { c.classList.add('hero-door'); c.style.setProperty('--d', (0.05 + i * 0.035).toFixed(2) + 's'); });
        var route = svg.querySelector('polyline');
        if (route && route.getTotalLength) { var len = route.getTotalLength(); route.classList.add('hero-route'); route.style.strokeDasharray = len; route.style.strokeDashoffset = len; }
        var stops = svg.querySelectorAll('circle:not([r="7"])');
        Array.prototype.forEach.call(stops, function (c, i) { c.classList.add('hero-stop'); c.style.setProperty('--d', ([0.35, 0.95, 1.35, 1.85][i] || (0.35 + i * 0.5)) + 's'); });
        var last = stops[stops.length - 1];
        if (last) { var p = last.cloneNode(); p.setAttribute('class', 'hero-ping'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#d6400c'); p.setAttribute('stroke-width', '4'); p.removeAttribute('style'); last.parentNode.insertBefore(p, last); }
        map.classList.add('hero-map');
      }
      if (map) tag([map], 'rv-pop', 0, 0.05);
      if (card && card !== map) tag([card], '', 0, 1.9);
    }
    // the rest of the page, as each part comes into view
    Array.prototype.forEach.call($('section h2'), function (h) { if (!h.closest('#top') && h.parentElement.tagName !== 'SECTION') tag([h.parentElement]); });
    tag($('.dayphone'), 'rv-pop', 0, 0.1);
    tag($('.daycol-l .dayitem'), 'rv-l', 0.15, 0.25);
    tag($('.daycol-r .dayitem'), 'rv-r', 0.15, 0.25);
    tag($('.eds > div'), '', 0.08);
    var trav = document.querySelector('.trav'); if (trav) { trav.classList.add('rv-wrap'); all.push(trav); }
    var wide = window.matchMedia('(min-width: 1001px)').matches;
    tag($('.trav-st'), '', wide ? 0.38 : 0.12, wide ? 0.25 : 0);
    tag($('.conds > div'), '', 0.12);
    tag($('.featstrip'), '', 0, 0.1);
    var plans = document.querySelectorAll('#pricing [style*="minmax(270px"] > div');
    Array.prototype.forEach.call(plans, function (d) { d.classList.add('plan'); });
    tag(plans, '', 0.1);
    tag($('#demo > *'), '', 0.08);
  } catch (err) { all.forEach(function (el) { el.classList.add('in'); }); root.classList.remove('anim'); return; }

  function show(el) {
    el.classList.add('in');
    if (el.classList.contains('hero-map')) el.classList.add('go');
  }
  if (!('IntersectionObserver' in window)) { all.forEach(show); return; }
  // a part shows once 12% of it is in view, or once it fills a third of a short screen (a tall part on a phone held
  // sideways might never reach 12%, and would stay hidden)
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var tall = en.intersectionRect && en.intersectionRect.height >= (window.innerHeight || 0) / 3;
      if (en.intersectionRatio >= 0.12 || tall) { show(en.target); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: [0, 0.12] });
  all.forEach(function (el) { io.observe(el); });
})();
</script>`;

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
${motionHead}
</head>
<body>
${body}
${menuJs}
${motionJs}
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

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
/* 2026-10-09: each edition card opens the editions page on that edition (build-editions-page.cjs); the page links on to the app */
const links = { '/roofing': 'editions/?e=roofing', '/yards': 'editions/?e=yards', '/solar': 'editions/?e=solar', '/pest': 'editions/?e=pest', '/security': 'editions/?e=security', '/demo': 'demo/', '/terms': 'terms/', '/terms-of-use': 'terms-of-use/', '/privacy': 'privacy/', '/cancellation': 'cancellation/' };   /* 2026-10-13: Sign in left the page; the booking page and legal pages are folders on this site */
for (const [from, to] of Object.entries(links)) body = body.split('href="' + from + '"').join('href="' + to + '"');
// the phone and tablet menu (the canvas has none): a button that opens the links in a panel. It sits BEFORE the
// nav in the markup so the keyboard reaches the opened links with Tab (CSS `order` keeps it at the right end of the
// header row); a function replacement so nothing in the markup is read as a $-pattern.
const NAV_OPEN = '<nav id="mainnav"';
if (body.split(NAV_OPEN).length !== 2 || body.split('</nav>').length !== 2) throw new Error('expected one nav');
/* the sample property's drawing has height="auto" on its <svg>, which is not a length: Chrome logs an error on every visit (overnight check
   2026-11-07). Without the attribute the viewBox and width="100%" give the same height. */
body = body.replace(/(<svg\b[^>]*?)\sheight="auto"/g, (m, open) => open);
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
  /* header: logo, Book a demo and a menu button on one row; the links open in a panel. It stays at the top while the
     page scrolls (Matthew 2026-10-08), so a page link stops below it rather than under it */
  header{position:sticky;top:0;z-index:40}
  section[id]{scroll-margin-top:76px}
  header > div{flex-wrap:nowrap !important}
  #mainnav{margin-left:auto;gap:0 !important}
  #mainnav a:not(:last-child){display:none !important}
  .navtoggle{display:inline-grid;place-items:center;flex:none;order:1;width:44px;height:44px;margin-left:10px;border:1.5px solid #dce2ea;border-radius:10px;background:#ffffff;color:#13294b;cursor:pointer}
  .navtoggle svg{width:22px;height:22px}
  #mainnav.open{position:absolute;top:100%;left:0;right:0;z-index:30;display:flex !important;flex-direction:column !important;align-items:stretch !important;justify-content:flex-start !important;background:#ffffff;border-bottom:1px solid #dce2ea;padding:6px 24px 18px;box-shadow:0 12px 24px -12px rgba(15,27,45,0.25);max-height:calc(100vh - 76px);overflow-y:auto;box-sizing:border-box}
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
  /* the features two by two with hairline dividers */
  .featstrip{grid-template-columns:1fr 1fr !important;gap:1px !important;background:rgba(255,255,255,0.14) !important}
  .featstrip > div{box-shadow:none !important;background:#13294b}
  /* your app, your brand: the words, then the picture */
  .brandrow{grid-template-columns:minmax(0,1fr) !important}
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
  .featstrip{grid-template-columns:1fr !important}
  .eds{grid-template-columns:1fr !important}
  .seerow{grid-template-columns:minmax(0,1fr) !important}
  .seerow figure:last-child{max-width:300px;margin:0 auto !important}
  #more h2,#faq h2,#contact h2,#brand h2{font-size:32px !important}
  .ctacard{padding:40px 22px !important}
  /* the closing card's screenshot sits under the words on a phone, as a band along the bottom */
  .ctacard{padding-bottom:230px !important}
  .ctacard > .ctashot{right:22px !important;left:22px;top:auto !important;bottom:-10px;width:auto !important;max-width:none !important;height:200px !important;border-radius:12px 12px 0 0 !important;border-right:1px solid rgba(255,255,255,0.18) !important}
  .nowall p{font-size:18px !important}
  .brandart{height:390px !important}
  /* phones (Matthew 2026-10-30): the whole-day topics and the More-than-a-map tiles read too long, so each one closes to its title and opens
     on a tap; the script marks them .fold and adds the button. Desktop unchanged (the class only acts here). */
  .fold .foldbtn{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
  .fold .foldbtn .foldi{flex:none;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#f4f6f9;color:#d6400c;font-size:20px;line-height:1;transition:transform .2s ease}
  .fold[aria-expanded="false"] > p,.fold[aria-expanded="false"] > div:last-child{display:none !important}
  .fold[aria-expanded="true"] .foldi{transform:rotate(45deg)}
  .dayitem.fold{gap:8px !important;padding:12px 0 !important;border-bottom:1px solid #dce2ea}
  .daycol-l .dayitem.fold .foldbtn > div{flex-direction:row-reverse}
  .daycol.fold-list{gap:0 !important}
  .moregrid > div.fold{flex-direction:column !important;gap:8px !important;padding:12px 0 !important;border-bottom:1px solid #dce2ea}
  .moregrid > div.fold .foldbtn{gap:14px}
  .moregrid > div.fold > div:last-child{padding-left:54px}
  .moregrid.fold-list{gap:0 !important}
}
/* contact (2026-10-30): the words over the three cards on narrow screens; the cards lift a little on hover */
@media (max-width:860px){.contactrow{grid-template-columns:minmax(0,1fr) !important;gap:28px !important}}
@media (max-width:480px){.contactlist b{font-size:18px !important}.contactlist > a{padding:16px !important;gap:12px !important}}
.contactlist > a{transition:translate .2s ease,box-shadow .2s ease,border-color .2s ease}
.contactlist > a:hover{translate:0 -2px;border-color:#b8c3d1 !important;box-shadow:0 10px 24px -14px rgba(15,27,45,0.35)}
.contactlist > a:focus-visible{outline:2px solid #d6400c;outline-offset:2px}
/* the questions: two columns of cards, one on narrow screens; the + turns to a cross when open */
@media (max-width:860px){.faqgrid{grid-template-columns:minmax(0,1fr) !important}}
#faq summary::-webkit-details-marker{display:none}
#faq summary::marker{content:""}
#faq .faqi{transition:transform .2s ease}
#faq details[open] .faqi{transform:rotate(45deg)}
#faq summary:hover .faqi{background:#fde6dc !important}
#faq summary:focus-visible{outline:2px solid #d6400c;outline-offset:-2px;border-radius:14px}
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
/* the hero's small doors twinkle like stars (Matthew 2026-10-30): a halo and a brightening, each on its own beat; the halo is the stroke
   (no stroke otherwise), so the doors keep their place. Only with motion allowed (html.anim), after they have appeared. */
#top svg circle[r="7"]{stroke:#ffffff;stroke-opacity:0;stroke-width:7}
html.anim .go .hero-door{animation:twinkle var(--tw,3.2s) ease-in-out var(--twd,2.6s) infinite}
@keyframes twinkle{0%,100%{fill-opacity:1;stroke-opacity:0}40%{fill-opacity:.55;stroke-opacity:0}55%{fill-opacity:1;stroke-opacity:.38}70%{fill-opacity:1;stroke-opacity:0}}
@keyframes ping{0%{opacity:.7;transform:scale(1)}80%,100%{opacity:0;transform:scale(2.8)}}
/* How it works: the line wipes in left to right and each station arrives as the line reaches it */
html.anim .trav-line{clip-path:inset(-30px 100% -30px -30px);transition:clip-path 1.7s cubic-bezier(.45,.05,.4,1)}
html.anim .trav.in .trav-line{clip-path:inset(-30px -30px -30px -30px)}
/* hover: the edition and plan cards lift, the buttons nudge */
.eds > div,#pricing .plan{transition:translate .25s ease,box-shadow .25s ease}
.eds > div:hover,#pricing .plan:hover{translate:0 -6px;box-shadow:0 2px 4px rgba(15,27,45,0.08),0 18px 34px -10px rgba(15,27,45,0.28) !important}
html.anim .eds > div.rv,html.anim #pricing .plan.rv{transition:opacity .7s ease var(--d,0s),transform .8s cubic-bezier(.2,.7,.2,1) var(--d,0s),translate .25s ease,box-shadow .25s ease}
/* (the Find your trade button is the a[href="#trades"] with a border) */
a[href="demo/"],a[href="#trades"][style*="border"]{transition:translate .2s ease,filter .2s ease}
a[href="demo/"]:hover,a[href="#trades"][style*="border"]:hover{translate:0 -2px;filter:brightness(1.06)}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
</style>`;
/* 2026-10-30: the lost-link form left the homepage; it is the Find my app page now (site-src/find/, api/traverse-findapp.php) */
/* the footer's socials row (Matthew 2026-10-30): [label, url] pairs; empty = the row stays out of the page. Fill in when the accounts exist. */
const SOCIALS = [];
const socialsHtml = SOCIALS.length ? SOCIALS.map(([label, url]) => `<a href="${url}" rel="noopener" target="_blank" style="display:inline-flex;align-items:center;height:34px;padding:0 12px;border-radius:999px;border:1px solid #33435a;color:#c9d6ea;text-decoration:none;font-size:13px;font-weight:700;">${label}</a>`).join('') : '';
if (body.split('data-socials').length !== 2) throw new Error('expected one socials row in the footer');
body = body.replace(/<div class="socials" data-socials style="display: none;/, () => '<div class="socials" data-socials style="display: ' + (SOCIALS.length ? 'flex' : 'none') + ';').replace(/(<div class="socials" data-socials[^>]*>)<\/div>/, (m, open) => open + socialsHtml + '</div>');
/* the phone collapsibles (2026-10-30): under 760px the whole-day topics and the More tiles close to their titles */
const foldJs = `<script>
(function () {
  var mq = window.matchMedia('(max-width: 760px)'); if (!mq.matches) return;
  function fold(el, titleEl) {
    if (!el || !titleEl || el.classList.contains('fold')) return;
    el.classList.add('fold'); el.setAttribute('aria-expanded', 'false');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'foldbtn';
    var head = titleEl.parentNode === el ? titleEl : titleEl;
    b.appendChild(head); var i = document.createElement('span'); i.className = 'foldi'; i.setAttribute('aria-hidden', 'true'); i.textContent = '+'; b.appendChild(i);
    el.insertBefore(b, el.firstChild);
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function () { var open = el.getAttribute('aria-expanded') !== 'true'; el.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-expanded', String(open)); });
  }
  /* the whole day: the title row (icon + h3) becomes the button, the paragraph folds */
  Array.prototype.forEach.call(document.querySelectorAll('.dayitem'), function (it) { var row = it.querySelector(':scope > div'); if (row) { fold(it, row); } });
  Array.prototype.forEach.call(document.querySelectorAll('.daycol'), function (c) { c.classList.add('fold-list'); });
  /* more than a map: icon + bold title become the button, the description folds; the title is moved out of its text block */
  Array.prototype.forEach.call(document.querySelectorAll('.moregrid > div'), function (it) {
    var icon = it.children[0], txt = it.children[1], title = txt && txt.querySelector('b'); if (!icon || !txt || !title) return;
    var head = document.createElement('span'); head.style.cssText = 'display:flex;align-items:center;gap:14px;min-width:0;';
    head.appendChild(icon); head.appendChild(title);
    fold(it, head);
  });
  var mg = document.querySelector('.moregrid'); if (mg) mg.classList.add('fold-list');
})();
</script>`;
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
    /* the hero's words are not faded in (2026-10-13): they must be there in the very first frame */
    var vis = document.querySelector('#top > div:last-child');
    if (vis) {
      var map = vis.firstElementChild, card = vis.lastElementChild, svg = map && map.querySelector('svg');
      if (svg) {
        Array.prototype.forEach.call(svg.querySelectorAll('circle[r="7"]'), function (c, i) { c.classList.add('hero-door'); c.style.setProperty('--d', (0.05 + i * 0.035).toFixed(2) + 's');
          /* each star on its own beat: 2.6 to 4.4 s, starting once the route has drawn */
          c.style.setProperty('--tw', (2.6 + (i * 0.7) % 1.8).toFixed(2) + 's'); c.style.setProperty('--twd', (2.6 + (i * 0.53) % 2.2).toFixed(2) + 's'); });
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
    tag($('.brandart > div'), 'rv-pop', 0.15, 0.1);
    tag($('.faqgrid > details'), '', 0.05);
    tag($('.nowall'), '', 0, 0.05);
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
<meta name="description" content="Traverse runs field sales from the first point of contact to the finished job: properties, phone calls, quotes, jobs and the office in one app, set up for your trade.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Traverse Platforms">
<meta property="og:title" content="Traverse: work the real territory">
<meta property="og:description" content="Properties, phone calls, quotes, jobs and the office in one app, set up for your trade.">
<meta property="og:url" content="https://traverseplatforms.com/">
<link rel="canonical" href="https://traverseplatforms.com/">
<meta property="og:image" content="https://traverseplatforms.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">
${head}
${phone}
${motionHead}
</head>
<body>
${body}
${menuJs}
${foldJs}
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

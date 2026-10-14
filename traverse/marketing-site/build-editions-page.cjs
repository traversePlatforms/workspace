// Builds the editions page of the Traverse homepage preview: one page, a dropdown to switch between the five editions,
// opening on whichever edition was clicked (?e=roofing etc.). Matthew 2026-10-09: "the editions section of the homepage
// should lead to a separate page ... build in a drop down bar that switches between editions rather than having all
// editions explained on one page or across several pages".
//
//   node traverse/marketing-site/build-preview.cjs        (the homepage first: this page reuses its head, header and footer)
//   node traverse/marketing-site/build-editions-page.cjs
//
// Output: preview/tp-5ea36a05/editions/index.html. Upload it into sixfoldcolorado.com/public_html/tp-5ea36a05/editions/.
// Everything said about an edition is what the app does today; the sample door on each is labelled as made up.
// Matthew's marketing rules apply: never say where the data comes from (it gives the concept away; the build refuses source
// words), nothing negative ("no answer"), no Do Not Call, and no two neighbouring sections in the same card format.
'use strict';
const fs = require('fs');
const path = require('path');

const here = __dirname, FOLDER = 'tp-5ea36a05';
const home = fs.readFileSync(path.join(here, 'preview', FOLDER, 'index.html'), 'utf8');
const cut = (a, b, from = 0) => { const i = home.indexOf(a, from), j = home.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker not found: ' + a); return [i, j]; };
const [hi] = cut('<header', '</header>'), hj = home.indexOf('</header>') + '</header>'.length;
const [fi] = cut('<footer', '</footer>');
let head = home.slice(0, hi), header = home.slice(hi, hj), tail = home.slice(fi);
/* the homepage's in-page links become links back to it */
const homeLinks = (s) => s.replace(/href="#(top|product|trades|how|pricing|demo|more|faq|contact)"/g, 'href="../#$1"')
  /* 2026-10-13: the homepage's own folder links (booking page, legal pages) and its edition links, seen from /editions/ */
  .replace(/href="(demo|terms|terms-of-use|privacy|cancellation)\/"/g, 'href="../$1/"').replace(/href="editions\/\?e=/g, 'href="?e=');
header = homeLinks(header); tail = homeLinks(tail);
head = head.replace(/<title>[^<]*<\/title>/, '<title>Traverse editions</title>');
if (!/<title>Traverse editions<\/title>/.test(head)) throw new Error('title not set');

/* ---- the editions ---- */
/* colour = the band; ink = text on the band; deep = the accent as text on white (Solar's yellow is too light for that) */
const ED = {
  roofing: {
    name: 'Roofing', colour: '#4e6680', ink: '#ffffff', deep: '#4e6680',
    line: 'Find the roofs the last storm hit, and know the roof before you knock.',
    who: 'roofing and storm-restoration companies that canvass after hail and wind.',
    door: ['Hail at the house, storm by storm since 2020', 'Damaging wind nearby, with the date', 'Roof size and pitch', 'Roof material', 'Year built and remodelled, so you know the roof’s age', 'Past re-roofs, where known', 'A close-up photo of the roof with its outline', 'Owner, home value and the area’s risk ratings'],
    rank: 'The biggest hail on the roof, damaging wind, the roof’s age and size, and no re-roof since the storm, then the owner’s ability to pay.',
    tools: [['Storm list', 'Every door a storm day reached, biggest hail first.'], ['Hail layer', 'A storm’s path drawn over your neighbourhood map.'], ['Storm alerts', 'A phone alert when severe weather reaches your towns.'], ['JobNimbus', 'Booked doors go straight into JobNimbus.']],
    sample: [['Biggest hail', '1.75 in · 14 May'], ['Roof', '3,300 sq ft · 6/12'], ['Material', 'Asphalt'], ['Built', '2004 · no re-roof since']], score: 10,
  },
  yards: {
    name: 'Yards', colour: '#2f7a3a', ink: '#ffffff', deep: '#2f7a3a',
    line: 'See the lawn, the trees and the fire hazard around each house before you pull up.',
    who: 'lawn care, landscaping, tree and wildfire-mitigation companies.',
    door: ['Lawn size, from large to none', 'Trees close to the house', 'Wildfire hazard around the property', 'The wildfire plan and HOA the house belongs to', 'The tax credit, insurance and grants that cover the work', 'The town’s watering and well rules', 'Frost dates and recent rain nearby', 'Owner, home value and the area’s figures'],
    rank: 'Large and medium lawns, fire hazard, trees against the house and lot size, then the owner’s ability to pay.',
    tools: [['Plans', 'Monthly and quarterly plans, with the visits that are due.'], ['Fire check', 'A walk-around check with a printable homeowner report.'], ['Customers', 'Every customer with their visit history.'], ['Weather and fire alerts', 'Phone alerts for storms, freezes, frost, red-flag fire weather and wildfires nearby.']],
    sample: [['Lawn', 'Large · 6,200 sq ft'], ['Trees', 'Against the house'], ['Fire hazard', 'High'], ['Lot', '0.84 acres']], score: 9,
  },
  solar: {
    name: 'Solar', colour: '#f2a900', ink: '#0f1b2d', deep: '#8a5a00',
    line: 'Know how much sun a roof gets, and what it’s worth, before the first conversation.',
    who: 'residential solar installers and their sales teams.',
    door: ['Sun-facing roof area, by direction', 'Shade from tall trees on the sunny side', 'Room for panels, the system size and a year’s output', 'The power company and its average price', 'Houses that already have solar, where it is on record, so you skip them', 'Roof size, pitch and year built', 'Owner, home value and the area’s figures'],
    rank: 'A year’s output and open sun, houses that already have solar moved down, then the owner’s ability to pay.',
    tools: [['Solar columns', 'Output, panels and shade in the planning table.'], ['Territories', 'Draw territories on the map and assign them.'], ['Follow-ups', 'Customers and the follow-ups that are due.'], ['Office dashboard', 'The whole team’s day on one screen.']],
    sample: [['Solar a year', '11,400 kWh'], ['Panels', '26 · 10.4 kW'], ['Shade', 'Open'], ['Power company', 'Xcel Energy']], score: 9,
  },
  pest: {
    name: 'Pest', colour: '#7a3fa3', ink: '#ffffff', deep: '#7a3fa3',
    line: 'Show up with the reason this house needs you, and the neighbours who already use you.',
    who: 'pest control companies selling plans door to door.',
    door: ['New owners, and when they bought', 'Open space, creeks and ponds beside the house', 'Trees close to the house and the year it was built', 'What’s in season this month, pest by pest', 'Neighbours already on your service, from your own customer list', 'Recent bookings and door notes nearby', 'Owner, home value and the area’s figures'],
    rank: 'A new owner, trees against the house, and open space or water beside it, then the owner’s ability to pay.',
    tools: [['Plans', 'Quarterly plans with the visits that are due.'], ['Customer import', 'Bring your customer list and neighbours show on every door.'], ['Customers', 'Every customer with their visit history.'], ['Office dashboard', 'The whole team’s day on one screen.']],
    sample: [['New owner', 'Bought in June'], ['Beside the house', 'Open space · creek'], ['Neighbours on service', '3 within a block'], ['In season', 'Wasps, mice']], score: 8,
  },
  security: {
    name: 'Security', colour: '#1b6f7a', ink: '#ffffff', deep: '#1b6f7a',
    line: 'The facts that make a home security conversation relevant, house by house.',
    who: 'home security and smart-home companies.',
    door: ['Property crime within a mile: the last 30, 90 and 365 days, in cities that report it', 'Town crime figures', 'New owners and newer homes', 'Owners who live somewhere else', 'Big lots and homes backing onto open space', 'Owner, home value and the area’s figures'],
    rank: 'New owners, newer homes, owners who live elsewhere, big lots and open space behind, then the owner’s ability to pay. Crime is shown on the card but kept out of the score.',
    tools: [['Crime by neighbourhood', 'Neighbourhoods ranked by recent crime, with a crime map.'], ['Territories', 'The planning table, and territories drawn on the map.'], ['Follow-ups', 'Customers and the follow-ups that are due.'], ['Office dashboard', 'The whole team’s day on one screen.']],
    sample: [['Crime within 1 mile', '4 in 90 days'], ['New owner', 'Bought in March'], ['Owner lives', 'Out of state'], ['Lot', '1.2 acres']], score: 8,
  },
};
const ALL = ['Every house in the towns you work', 'Neighbourhoods crews can claim', 'A 1 to 10 score on every door', 'The map, in photo or street view', 'Calendars and booked walks', 'Knock to signed job', 'Teams and managers', 'Training built in', 'Works with no signal'];

/* Matthew 2026-10-06: never say where the data comes from. Refuse the build if a source word slips in. */
const SOURCE_WORDS = /\b(NOAA|NWS|MRMS|radar|county|assessor|LiDAR|laser|aerial|satellite|USGS|USDA|NAIP|FEMA|census|PVWatts|EIA|FBI|police|public record|permit|national weather|no answer|do not call)\b/i;
const copy = JSON.stringify({ ED, ALL });
const bad = copy.match(SOURCE_WORDS); if (bad) throw new Error('source or banned word in the editions copy: ' + bad[0]);

/* ---- the hero picture (2026-10-09, Matthew: the space right of the hero was empty): a phone showing the edition's map with
   its own layer, drawn here as plain shapes. Made-up houses and scores, like the sample door. No app link anywhere on this
   page (Matthew: sign-in pages are not for the public). ---- */
const HOUSES = [[40,64,7],[150,56,9],[175,45,6],[236,62,8],[30,130,5],[40,180,8],[125,130,10],[170,140,9],[130,185,7],[180,190,8],[255,130,6],[265,185,9],[35,260,6],[130,265,8],[180,270,5],[265,265,7]];
const pinCol = (sc) => (sc >= 8 ? '#1f8a4c' : sc >= 6 ? '#c98a10' : '#8a96a3');
const FONT = 'font-family="Atkinson Hyperlegible, sans-serif"';
function art(key, e) {
  const road = (w, c) => '<g stroke="' + c + '" stroke-width="' + w + '"><path d="M-10 95 L310 80"/><path d="M-10 215 L310 230"/><path d="M95 -10 L80 310"/><path d="M215 -10 C225 120 200 200 230 310"/></g>';
  const roads = '<g fill="none" stroke-linecap="round">' + road(15, '#d3dbd2') + road(12, '#fff') + '</g>';
  let under = '', over = '', label = '';
  if (key === 'roofing') {
    under = '<ellipse cx="150" cy="150" rx="185" ry="52" transform="rotate(-25 150 150)" fill="rgba(84,96,230,.16)" stroke="rgba(84,96,230,.55)" stroke-width="2" stroke-dasharray="6 5"/>';
    label = 'Storm path';
  } else if (key === 'yards') {
    under = HOUSES.map(([x, y]) => '<rect x="' + (x - 17) + '" y="' + (y - 13) + '" width="34" height="28" rx="7" fill="#a7d18a" opacity=".75"/>').join('') +
      [[52, 58], [150, 108], [200, 118], [60, 160], [150, 210], [240, 170], [60, 282], [205, 285], [285, 70]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#3f7d3a"/>').join('');
    label = 'Lawns and trees';
  } else if (key === 'solar') {
    over = '<g transform="translate(278 25)"><circle r="11" fill="#f2a900"/>' +
      [0, 45, 90, 135, 180, 225, 270, 315].map((a) => '<line x1="0" y1="-16" x2="0" y2="-22" stroke="#f2a900" stroke-width="3" stroke-linecap="round" transform="rotate(' + a + ')"/>').join('') + '</g>';
    label = 'Sun on every roof';
  } else if (key === 'pest') {
    under = '<rect x="228" y="0" width="80" height="74" fill="#b5d9a1"/><path d="M-10 160 C60 120 110 178 160 152 S260 118 310 162" fill="none" stroke="#5aa0d6" stroke-width="7" stroke-linecap="round"/>';
    label = 'Creek and open space';
  } else if (key === 'security') {
    under = '<circle cx="150" cy="158" r="118" fill="rgba(27,111,122,.07)" stroke="#1b6f7a" stroke-width="2" stroke-dasharray="7 6"/>';
    label = 'Within one mile';
  }
  const houses = HOUSES.map(([x, y, sc]) => {
    const roof = key === 'solar' && sc >= 8 ? '#ffd65c' : '#cfd6cf';
    const px = x + 9, py = y - 11;
    const ring = sc === 10 ? '<circle cx="' + px + '" cy="' + py + '" r="12.5" fill="none" stroke="#f2c230" stroke-width="3"/>' : '';
    return '<rect x="' + (x - 9) + '" y="' + (y - 7) + '" width="18" height="14" rx="2" fill="' + roof + '" stroke="#aeb8ae"/>' + ring +
      '<circle cx="' + px + '" cy="' + py + '" r="9" fill="' + pinCol(sc) + '" stroke="#fff" stroke-width="2"/>' +
      '<text x="' + px + '" y="' + (py + 3.5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" ' + FONT + '>' + sc + '</text>';
  }).join('');
  const tag = '<g transform="translate(10 10)"><rect width="' + Math.round(label.length * 6.4 + 30) + '" height="24" rx="12" fill="#fff" stroke="#d3dae4"/>' +
    '<circle cx="12" cy="12" r="4" fill="' + e.deep + '"/><text x="21" y="16" font-size="11" font-weight="700" fill="#0f1b2d" ' + FONT + '>' + label + '</text></g>';
  return '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#e9eee8"/>' + under + roads + houses + over + tag + '</svg>';
}
const ART = {}; for (const k of Object.keys(ED)) ART[k] = art(k, ED[k]);
const json = JSON.stringify({ ED, ART }).replace(/</g, '\\u003c');
const main = `
<main id="editions">
<section class="edh">
<div class="edw edhw">
<div class="edhl">
<span class="ede">Editions</span>
<div class="edrow">
<h1 class="edt"><b>Traverse</b><span id="edname">Roofing</span></h1>
<label class="eds"><span class="vh">Choose an edition</span>
<select id="edsel">
<option value="roofing">TraverseRoofing</option><option value="yards">TraverseYards</option><option value="solar">TraverseSolar</option><option value="pest">TraversePest</option><option value="security">TraverseSecurity</option>
</select></label>
</div>
<p class="edl" id="edline"></p>
<p class="edwho" id="edwho"></p>
<div class="edcta"><a class="edb pri" href="../demo/">Book a demo</a></div>
</div>
<div class="edart" aria-hidden="true"><div class="edphone"><div class="edscreen"><div class="edbar"><b>Traverse<span id="edbarname">Roofing</span></b><small>Monument</small></div><div id="edmap"></div><div class="edchip"><div><small id="edchipk"></small><b id="edchipv"></b></div><span class="eds-sc" id="edchips">10</span></div></div></div></div>
</div>
</section>
<section class="edw edtop">
<div><h2>On every door</h2><ul class="edchk" id="eddoor"></ul></div>
<div class="edsample" aria-label="A sample door card">
<div class="eds-h"><div><small>Sample door</small><b>A house in Monument</b></div><span class="eds-sc" id="edscore">10</span></div>
<div class="eds-t" id="edtiles"></div>
<small class="eds-n">Figures made up for this example.</small>
</div>
</section>
<section class="edrank"><div class="edw"><span class="edk">Best doors first</span><p id="edrank"></p></div></section>
<section class="edw edtools"><h2>What it adds</h2><ol id="edtools"></ol></section>
<section class="edw edall"><h2>Every edition also has</h2><ul id="edall"></ul></section>
</main>
<style>
#editions{--edc:#4e6680;--edi:#fff;--edd:#4e6680;color:#0f1b2d}
#editions .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#editions .edw{max-width:1200px;margin:0 auto;padding-left:24px;padding-right:24px}
#editions h2{margin:0 0 16px;font-family:'Familjen Grotesk',sans-serif;font-size:28px;letter-spacing:-.015em}
#editions p{margin:0}
#editions .edh{background:var(--edc);color:var(--edi);padding:56px 0 44px;transition:background .2s}
#editions .edh p,#editions .edh h1,#editions .edh span{color:var(--edi)}
#editions .ede,#editions .edk{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
#editions .ede{opacity:.8}
#editions .edrow{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:14px 24px;margin-top:8px}
#editions .edt{margin:0;font-family:'Familjen Grotesk',sans-serif;font-size:56px;line-height:1.02;letter-spacing:-.025em;font-weight:500}
#editions .edt b{font-weight:700}
#editions .eds select{min-height:52px;padding:0 44px 0 16px;border-radius:12px;border:0;background:#fff;color:#0f1b2d;font:700 17px 'Atkinson Hyperlegible',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
#editions .edl{margin-top:18px;font-size:22px;line-height:1.35;max-width:46ch;font-family:'Familjen Grotesk',sans-serif;font-weight:500}
#editions .edwho{margin-top:8px;font-size:17px;opacity:.85}
#editions .edcta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
#editions .edb{display:inline-flex;align-items:center;height:48px;padding:0 22px;border-radius:10px;border:1.5px solid currentColor;color:inherit;font-weight:700;font-size:16px;text-decoration:none}
#editions .edb.pri{background:#d6400c;border-color:#d6400c;color:#fff}
/* the hero picture: a phone with the edition's map */
#editions .edhw{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;align-items:center}
#editions .edphone{width:300px;padding:10px;border-radius:38px;background:#0f1b2d;box-shadow:0 24px 60px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.14)}
#editions .edscreen{border-radius:29px;overflow:hidden;background:#fff}
#editions .edh .edbar{display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px 10px;border-bottom:1px solid #e3e8ee}
#editions .edh .edbar b{font:700 15px 'Familjen Grotesk',sans-serif;color:#0f1b2d}
#editions .edh .edbar b span{color:var(--edd)}
#editions .edh .edbar small{font-size:12px;color:#566476}
#editions #edmap svg{display:block;width:100%;height:auto}
#editions .edh .edchip{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px 16px;border-top:1px solid #e3e8ee}
#editions .edh .edchip small{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#566476}
#editions .edh .edchip b{font:700 15px 'JetBrains Mono',monospace;color:#0f1b2d}
#editions .edh .edchip span.eds-sc{color:#fff}
/* on every door: a plain checklist beside the one card on the page */
#editions .edtop{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:40px;align-items:start;padding-top:52px;padding-bottom:52px}
#editions .edchk{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}
#editions .edchk li{position:relative;padding-left:30px;font-size:16px;line-height:23px}
#editions .edchk li::before{content:'';position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:6px;background:var(--edd);opacity:.14}
#editions .edchk li::after{content:'';position:absolute;left:6px;top:5px;width:8px;height:5px;border-left:2.5px solid var(--edd);border-bottom:2.5px solid var(--edd);transform:rotate(-45deg)}
#editions .edsample{border-radius:16px;padding:20px;background:#fff;border:2px solid var(--edc);box-shadow:0 10px 30px rgba(15,27,45,.12)}
#editions .eds-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
#editions .eds-h small{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#566476}
#editions .eds-h b{font-family:'Familjen Grotesk',sans-serif;font-size:21px}
#editions .eds-sc{display:inline-grid;place-items:center;min-width:44px;height:34px;padding:0 8px;border-radius:10px;background:#1f8a4c;color:#fff;font:800 17px 'Atkinson Hyperlegible',sans-serif}
#editions .eds-sc.top{box-shadow:0 0 0 2px #f2c230,0 0 12px rgba(242,194,48,.7)}
#editions .eds-t{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
#editions .eds-t div{padding:9px 11px;border-radius:10px;border:1px solid #dce2ea}
#editions .eds-t small{display:block;font-size:12px;color:#566476}
#editions .eds-t span{font-family:'JetBrains Mono',monospace;font-size:13px}
#editions .eds-n{display:block;margin-top:10px;font-size:12px;color:#566476}
/* best doors first: one sentence on a tinted band */
#editions .edrank{background:#eef1f5;background:color-mix(in srgb,var(--edc) 11%,#fff);padding:44px 0;border-top:1px solid color-mix(in srgb,var(--edc) 25%,#fff);border-bottom:1px solid color-mix(in srgb,var(--edc) 25%,#fff)}
#editions .edk{color:var(--edd)}
#editions .edrank p{margin-top:10px;font-family:'Familjen Grotesk',sans-serif;font-size:27px;line-height:1.3;font-weight:500;max-width:52ch;letter-spacing:-.01em}
/* what it adds: numbered columns, no boxes */
#editions .edtools{padding-top:56px;padding-bottom:20px}
#editions .edtools ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:28px;counter-reset:t}
#editions .edtools li{counter-increment:t;border-top:3px solid var(--edc);padding-top:14px}
#editions .edtools li::before{content:'0' counter(t);display:block;font:500 13px 'JetBrains Mono',monospace;color:var(--edd);margin-bottom:6px}
#editions .edtools b{display:block;font-family:'Familjen Grotesk',sans-serif;font-size:19px;margin-bottom:4px}
#editions .edtools span{font-size:16px;line-height:23px;color:#33435a}
/* every edition also has: chips */
#editions .edall{padding-top:44px;padding-bottom:76px}
#editions .edall h2{font-size:22px}
#editions .edall ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
#editions .edall li{padding:9px 14px;border-radius:999px;background:#fff;border:1px solid #d3dae4;font-size:15px}
@media (max-width:960px){#editions .edtools ol{grid-template-columns:1fr 1fr}}
@media (max-width:860px){#editions .edhw{grid-template-columns:1fr}#editions .edart{display:none}#editions .edtop{grid-template-columns:1fr}#editions .edt{font-size:40px}#editions .edrank p{font-size:22px}}
@media (max-width:560px){#editions .edchk{grid-template-columns:1fr}#editions .edtools ol{grid-template-columns:1fr}}
</style>
<script>
(function () {
  var D = ${json}, keys = Object.keys(D.ED), $ = function (id) { return document.getElementById(id); };
  var el = function (tag, text) { var x = document.createElement(tag); if (text != null) x.textContent = text; return x; };
  var list = function (box, items) { box.textContent = ''; items.forEach(function (t) { box.appendChild(el('li', t)); }); };
  list($('edall'), ${JSON.stringify(ALL)});
  function show(k) {
    var e = D.ED[k]; if (!e) { k = 'roofing'; e = D.ED[k]; }
    var root = $('editions'); root.style.setProperty('--edc', e.colour); root.style.setProperty('--edi', e.ink); root.style.setProperty('--edd', e.deep);
    $('edname').textContent = e.name; $('edsel').value = k; document.title = 'Traverse' + e.name + ' \\u00b7 Traverse editions';
    $('edline').textContent = e.line; $('edwho').textContent = 'Built for ' + e.who;
    $('edmap').innerHTML = D.ART[k]; $('edbarname').textContent = e.name;   /* our own drawing, built with this page */
    $('edchipk').textContent = e.sample[0][0]; $('edchipv').textContent = e.sample[0][1];
    var cs = $('edchips'); cs.textContent = String(e.score); cs.className = 'eds-sc' + (e.score === 10 ? ' top' : '');
    list($('eddoor'), e.door); $('edrank').textContent = e.rank;
    var tl = $('edtools'); tl.textContent = '';
    e.tools.forEach(function (x) { var li = el('li'); li.appendChild(el('b', x[0])); li.appendChild(el('span', x[1])); tl.appendChild(li); });
    var sc = $('edscore'); sc.textContent = String(e.score); sc.className = 'eds-sc' + (e.score === 10 ? ' top' : '');
    var tiles = $('edtiles'); tiles.textContent = '';
    e.sample.forEach(function (x) { var d = el('div'); d.appendChild(el('small', x[0])); d.appendChild(el('span', x[1])); tiles.appendChild(d); });
  }
  var start = new URLSearchParams(location.search).get('e'); if (keys.indexOf(start) < 0) start = 'roofing';
  $('edsel').addEventListener('change', function () { var k = $('edsel').value; show(k); try { history.replaceState(null, '', '?e=' + k); } catch (x) {} });
  show(start);
})();
</script>
`;
const out = head + header + main + tail;
const dir = path.join(here, 'preview', FOLDER, 'editions');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), out);
console.log('wrote preview/' + FOLDER + '/editions/index.html', (out.length / 1024).toFixed(1), 'KB');

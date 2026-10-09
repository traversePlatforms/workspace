// Builds the editions page of the Traverse homepage preview: one page, a dropdown to switch between the five editions,
// opening on whichever edition was clicked (?e=roofing etc.). Matthew 2026-10-09: "the editions section of the homepage
// should lead to a separate page ... build in a drop down bar that switches between editions rather than having all
// editions explained on one page or across several pages".
//
//   node traverse/marketing-site/build-preview.cjs        (the homepage first: this page reuses its head, header and footer)
//   node traverse/marketing-site/build-editions-page.cjs
//
// Output: preview/tp-5ea36a05/editions/index.html. Upload it into sixfoldcolorado.com/public_html/tp-5ea36a05/editions/.
// Everything said about an edition is what the app does today (see the app's own door card and data pipeline); the sample
// door on each is labelled as made up.
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
const homeLinks = (s) => s.replace(/href="#(top|product|trades|how|pricing|demo)"/g, 'href="../#$1"');
header = homeLinks(header); tail = homeLinks(tail);
head = head.replace(/<title>[^<]*<\/title>/, '<title>Traverse editions</title>');
if (!/<title>Traverse editions<\/title>/.test(head)) throw new Error('title not set');

/* ---- the editions ---- */
const APPS = { roofing: 'tr-cb2e8587', yards: 'ty-25604fff', solar: 'ts-016064fc', pest: 'tq-9cf8d9de', security: 'tg-3b0b89e7' };
const ED = {
  roofing: {
    name: 'Roofing', colour: '#4e6680', ink: '#ffffff',
    line: 'Find the roofs the last storm hit, and know the roof before you knock.',
    who: 'Roofing and storm-restoration companies that canvass after hail and wind.',
    door: ['Hail at the house, storm by storm since 2020 (radar estimate)', 'Damaging wind reported nearby, with the date', 'Roof size and pitch, measured from laser scans', 'Roof material from county records or the aerial photo', 'Year built and remodelled, so you know the roof’s age', 'Re-roof permits where the town publishes them', 'A close-up aerial photo of the roof with its outline', 'Owner, county value and FEMA’s risk ratings for the area'],
    rank: 'The biggest hail on the roof, damaging wind, the roof’s age and size, and no re-roof since the storm, then the owner’s ability to pay.',
    tools: ['Storm list: every door a storm day reached, biggest hail first', 'Hail layer: a storm’s path over your neighbourhood map', 'Phone alerts for severe storms in your towns', 'Booked doors sent straight into JobNimbus'],
    data: ['NOAA radar hail estimates (MRMS)', 'National Weather Service storm reports', 'USGS laser scans (3DEP LiDAR)', 'Colorado aerial photos (DRAPP)', 'County assessors and building departments', 'FEMA National Risk Index'],
    sample: [['Biggest hail', '1.75 in · 14 May'], ['Roof', '3,300 sq ft · 6/12'], ['Material', 'Asphalt (county)'], ['Built', '2004 · no re-roof since']], score: 10,
  },
  yards: {
    name: 'Yards', colour: '#2f7a3a', ink: '#ffffff',
    line: 'See the lawn, the trees and the fire risk at every house before you pull up.',
    who: 'Lawn care, landscaping, tree and wildfire-mitigation companies.',
    door: ['Lawn size and health, measured from aerial photos', 'Trees close to the house, in zones from laser scans', 'Wildfire hazard for the property', 'The community wildfire plan and HOA the house belongs to', 'The tax credit, insurance and grants that cover the work', 'The town’s watering rules and well rules', 'Frost dates and recent rain at the nearest gauge', 'Owner, county value and the area’s figures'],
    rank: 'Large and medium lawns, fire hazard, trees against the house and lot size, then the owner’s ability to pay.',
    tools: ['Monthly and quarterly plans, with the visits that are due', 'A fire check with a printable homeowner report', 'Customers with their visit history', 'Phone alerts for fire weather and nearby fires'],
    data: ['USDA aerial photos (NAIP 2023)', 'USGS laser scans (3DEP LiDAR)', 'USFS Wildfire Hazard Potential', 'Colorado HOA registry', 'NOAA climate normals and rain gauges', 'County assessors'],
    sample: [['Lawn', 'Large · 6,200 sq ft'], ['Trees', 'Against the house'], ['Fire hazard', 'High'], ['Lot', '0.84 acres']], score: 9,
  },
  solar: {
    name: 'Solar', colour: '#f2a900', ink: '#0f1b2d',
    line: 'Know how much sun a roof gets, and what it’s worth, before the first conversation.',
    who: 'Residential solar installers and their sales teams.',
    door: ['Sun-facing roof area by direction, from laser scans', 'Shade from tall trees on the sunny side', 'Room for panels, the system size and a year’s output', 'The household’s power company and its average price', 'Existing solar permits, so you skip houses that have it', 'Roof size, pitch and year built', 'Owner, county value and the area’s figures'],
    rank: 'A year’s output and open sun, with houses that already have solar sinking, then the owner’s ability to pay.',
    tools: ['The planning table with solar columns: output, panels, shade', 'Draw territories on the map and assign them', 'Customers and their follow-ups', 'The office dashboard with the team’s day'],
    data: ['USGS laser scans (3DEP LiDAR)', 'PVWatts (National Laboratory of the Rockies)', 'Colorado electric utility territories', 'US EIA-861 power prices', 'County building permits', 'County assessors'],
    sample: [['Solar a year', '11,400 kWh'], ['Panels', '26 · 10.4 kW'], ['Shade', 'Open'], ['Power company', 'Xcel Energy']], score: 9,
  },
  pest: {
    name: 'Pest', colour: '#7a3fa3', ink: '#ffffff',
    line: 'Show up with the reason this house needs you, and the neighbours who already use you.',
    who: 'Pest control companies selling plans door to door.',
    door: ['New owners, and when they bought', 'Open space, creeks and ponds beside the house', 'Trees close to the house and the year it was built', 'What is in season this month, pest by pest', 'Neighbours already on your service, from your own customers', 'Recent bookings and door notes nearby', 'Owner, county value and the area’s figures'],
    rank: 'A new owner, trees against the house, and open space or water beside it, then the owner’s ability to pay.',
    tools: ['Quarterly plans with the visits that are due', 'Import your customer list so neighbours show on every door', 'Customers and their visit history', 'The office dashboard with the team’s day'],
    data: ['County assessors and sale records', 'Colorado protected areas (COMaP)', 'USGS National Hydrography (creeks and ponds)', 'USGS laser scans (3DEP LiDAR)', 'CSU Extension pest calendars', 'Your own customer list'],
    sample: [['New owner', 'Bought in June'], ['Beside the house', 'Open space · creek'], ['Neighbours on service', '3 within a block'], ['In season', 'Wasps, mice']], score: 8,
  },
  security: {
    name: 'Security', colour: '#1b6f7a', ink: '#ffffff',
    line: 'The facts that make a home security conversation relevant, house by house.',
    who: 'Home security and smart-home companies.',
    door: ['Property crime reported within a mile, last 30, 90 and 365 days, where police publish it', 'Town crime figures from the FBI', 'New owners and newer homes', 'Owners who live somewhere else', 'Big lots and homes backing onto open space', 'Owner, county value and the area’s figures'],
    rank: 'New owners, newer homes, owners who live elsewhere, big lots and open space behind, then the owner’s ability to pay. Crime is shown on the card but kept out of the score.',
    tools: ['Neighbourhoods ranked by recent crime, and a crime map', 'The planning table and territories', 'Customers and their follow-ups', 'The office dashboard with the team’s day'],
    data: ['Colorado Springs, Denver and Boulder police open data', 'FBI Crime Data Explorer', 'County assessors and sale records', 'Colorado protected areas (COMaP)'],
    sample: [['Crime within 1 mile', '4 in 90 days'], ['New owner', 'Bought in March'], ['Owner lives', 'Out of state'], ['Lot', '1.2 acres']], score: 8,
    note: 'Crime is always shown as counts around a house or a neighbourhood, never placed on a house.',
  },
};

const json = JSON.stringify({ ED, APPS }).replace(/</g, '\\u003c');
const main = `
<main id="editions">
<section class="edh" style="background: var(--edc, #13294b);">
<div class="edw">
<span class="ede">Editions</span>
<div class="edrow">
<h1 class="edt"><b>Traverse</b><span id="edname">Roofing</span></h1>
<label class="eds"><span class="vh">Choose an edition</span>
<select id="edsel" aria-label="Choose an edition">
<option value="roofing">TraverseRoofing</option><option value="yards">TraverseYards</option><option value="solar">TraverseSolar</option><option value="pest">TraversePest</option><option value="security">TraverseSecurity</option>
</select></label>
</div>
<p class="edl" id="edline"></p>
<p class="edwho" id="edwho"></p>
<div class="edcta"><a class="edb pri" href="../#demo">Book a demo</a><a class="edb" id="edapp" href="#">Open the app</a></div>
</div>
</section>
<section class="edw edbody">
<div class="edg">
<div class="edcard"><h2>On every door</h2><ul id="eddoor"></ul></div>
<div class="edside">
<div class="edsample" aria-label="A sample door card">
<div class="eds-h"><div><small>Sample door</small><b id="edplace">A house in Monument</b></div><span class="eds-sc" id="edscore">10</span></div>
<div class="eds-t" id="edtiles"></div>
<small class="eds-n">Figures made up for this example.</small>
</div>
<div class="edcard"><h2>Best doors first</h2><p id="edrank"></p></div>
</div>
</div>
<div class="edg2">
<div class="edcard"><h2>What it adds</h2><ul id="edtools"></ul></div>
<div class="edcard"><h2>Where the facts come from</h2><ul id="eddata"></ul><p class="ednote" id="ednote"></p></div>
</div>
<div class="edall"><h2>Every edition also has</h2>
<p>Door lists for every house in the towns you work, neighbourhoods your crews can claim, a 1 to 10 score on every door, the map, calendars and booked walks, the pipeline from knock to signed job, teams with managers, training built in, and it works with no signal.</p></div>
</section>
</main>
<style>
#editions{--edc:#4e6680;--edi:#fff}
#editions .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
#editions .edw{max-width:1200px;margin:0 auto;padding:0 24px}
#editions .edh{color:var(--edi);padding:56px 0 44px;transition:background .2s}
#editions .ede{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase;opacity:.8}
#editions .edrow{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-top:8px}
#editions .edt{margin:0;font-family:'Familjen Grotesk',sans-serif;font-size:56px;line-height:1.02;letter-spacing:-.025em;font-weight:500}
#editions .edt b{font-weight:700}
#editions .eds select{min-height:52px;padding:0 44px 0 16px;border-radius:12px;border:0;background:#fff;color:#0f1b2d;font:700 17px 'Atkinson Hyperlegible',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer}
#editions .edh p,#editions .edh h1,#editions .edh span{color:var(--edi)}
#editions .edl{margin:18px 0 0;font-size:22px;line-height:1.35;max-width:46ch;font-family:'Familjen Grotesk',sans-serif;font-weight:500}
#editions .edwho{margin:8px 0 0;font-size:17px;opacity:.85}
#editions .edcta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
#editions .edb{display:inline-flex;align-items:center;height:48px;padding:0 22px;border-radius:10px;border:1.5px solid currentColor;color:inherit;font-weight:700;font-size:16px;text-decoration:none}
#editions .edb.pri{background:#d6400c;border-color:#d6400c;color:#fff}
#editions .edbody{padding-top:40px;padding-bottom:72px;display:grid;gap:20px}
#editions .edg{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:20px;align-items:start}
#editions .edg2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
#editions .edside{display:grid;gap:20px}
#editions .edcard,#editions .edall{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 2px rgba(15,27,45,.08),0 6px 16px rgba(15,27,45,.06)}
#editions h2{margin:0 0 12px;font-family:'Familjen Grotesk',sans-serif;font-size:24px;letter-spacing:-.01em}
#editions ul{margin:0;padding-left:18px;display:grid;gap:8px;font-size:16px;line-height:24px;color:#0f1b2d}
#editions p{margin:0;font-size:16px;line-height:25px;color:#0f1b2d}
#editions .ednote{margin-top:12px;color:#566476;font-size:14px}
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
@media (max-width:860px){#editions .edg,#editions .edg2{grid-template-columns:1fr}#editions .edt{font-size:40px}}
</style>
<script>
(function () {
  var D = ${json}, keys = Object.keys(D.ED), $ = function (id) { return document.getElementById(id); };
  var list = function (el, items) { el.textContent = ''; items.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; el.appendChild(li); }); };
  function show(k) {
    var e = D.ED[k]; if (!e) { k = 'roofing'; e = D.ED[k]; }
    var root = $('editions'); root.style.setProperty('--edc', e.colour); root.style.setProperty('--edi', e.ink);
    $('edname').textContent = e.name; $('edsel').value = k; document.title = 'Traverse' + e.name + ' \\u00b7 Traverse editions';
    $('edline').textContent = e.line; $('edwho').textContent = 'Built for ' + e.who.charAt(0).toLowerCase() + e.who.slice(1);
    $('edapp').href = '/' + D.APPS[k] + '/'; $('edapp').textContent = 'Open Traverse' + e.name;
    list($('eddoor'), e.door); list($('edtools'), e.tools); list($('eddata'), e.data);
    $('edrank').textContent = e.rank; $('ednote').textContent = e.note || ''; $('ednote').hidden = !e.note;
    var sc = $('edscore'); sc.textContent = String(e.score); sc.className = 'eds-sc' + (e.score === 10 ? ' top' : '');
    var tl = $('edtiles'); tl.textContent = '';
    e.sample.forEach(function (x) { var d = document.createElement('div'), s = document.createElement('small'), v = document.createElement('span'); s.textContent = x[0]; v.textContent = x[1]; d.appendChild(s); d.appendChild(v); tl.appendChild(d); });
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

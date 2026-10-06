// Builds the Traverse editions of the door app: TraverseRoofing and TraverseYards, each with a made-up client.
//
//   node traverse/editions/build-editions.cjs            both
//   node traverse/editions/build-editions.cjs yards      one (roofing, yards, solar, pest or security)
//
// Matthew, 2026-10-06: rebrand the app as Traverse but leave Sixfold's app alone; then split Yards from Roofing,
// each standing alone with its own colours ("hail, wind etc. don't play as much of an impact" for yards). So this is
// NOT a hand copy: traverse/app stays the one source (and Sixfold's install), and this script makes each edition from
// it, so every fix to the app lands in all of them. Never edit dist/ by hand.
//
// Each edition is a separate install with its own data (his decision): its own sign-ins, marks, leads and customers;
// the towns and the per-door layers that edition uses are copied in, nothing of Sixfold's customers is. All of them
// live on sixfoldcolorado.com for now, so every place two installs on one domain would collide is renamed per edition:
// the session cookie, the phone's saved settings and offline queue (localStorage, IndexedDB), the offline copies
// (Cache Storage names, and a cleanup that only ever touches its own), the API files, and the data and private folders
// beside public_html. Roofing keeps the names it went live with on 2026-10-06.
//
// Output, dist/ (gitignored: door data and codes files), laid out like the server:
//   public_html/<folder>/              the app (page, offline worker, manifest, icons, .htaccess)
//   public_html/api/<api>-*.php        its API
//   <data>/rounds/                     its door data + company.json
//   <private>/rounds-codes.php         its sign-in codes (made once per edition, never overwritten)
//   upload/<edition>/                  the zips, named for where they go
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'traverse', 'app');
const APP = path.join(SRC, 'summit-de59ae83');
const DATA = path.join(SRC, 'data', 'rounds');
const OUT = path.join(__dirname, 'dist');

/* ---------------------------------------------------------------- the editions */
const COMMON_BG = { '--ink': '#0f1b2d', '--soft': '#566476', '--card': '#ffffff' };
const EDITIONS = {
  roofing: {
    name: 'TraverseRoofing', short: 'Roofing', folder: 'tr-cb2e8587',
    api: 'traverse', data: 'traverse-data', priv: 'traverse-private', cookie: 'trv',
    store: 'traverse.', storeApp: 'traverse.app.', idb: 'traverse-rounds', cache: 'traverse-',
    blurb: 'Doors, phones and appointments for roofing crews.',
    icon: '#4e6680',                                   // the kit's roof edition fill
    // storm slate: the edition colour, deepened for the bar and sign-in
    c: { bar: '#22303f', deep: '#161f2a', key: '#2f4155', keyDown: '#3d546d', barSoft: '#c3cfdc', accent: '#4e6680', moss: '#6b7f99', mossInk: '#2b3a4d',
         bg: '#f3f5f8', line: '#dbe1e8', sunk: '#e7ecf1', card1: '#2f4155', appbar: '#2a394b', tile: '#3a4e66',
         dBg: '#0d131b', dCard: '#161e29', dLine: '#2a3646', dSunk: '#111821', dBar: '#18222e', dAccent: '#a9bbd1' },
    // storm data and roofs; no lawn, trees, fire, funding or water
    keep: (f) => !/^(lawnmask-|solar-|pest-|security-|cwpp\.json$|hoa-communities\.json$)/.test(f),
    money: false, extraRegions: 'roofing-commercial-towns.json',
    company: () => {
      const ex = JSON.parse(fs.readFileSync(path.join(REPO, 'traverse', 'app', 'company.example.json'), 'utf8'));
      delete ex._about; delete ex.colors;
      return Object.assign(ex, {
        email: '', site: 'traverseplatforms.com',
        features: { quote: false, communities: false, firecheck: false, skiptrace: false, hail: true, roof: true },
        card: { lawn: false, trees: false, fire: false, money: false, water: false, fc: false, hail: true, roof: true }
      });
    }
  },
  yards: {
    name: 'TraverseYards', short: 'Yards', folder: 'ty-25604fff',
    api: 'traverse-yards', data: 'traverse-yards-data', priv: 'traverse-yards-private', cookie: 'tvy',
    store: 'tvyards.', storeApp: 'tvyards.app.', idb: 'tvyards-rounds', cache: 'tvyards-',
    blurb: 'Doors, phones and appointments for lawn and yard crews.',
    icon: '#2f7a3a',                                   // the kit's yards edition fill
    // field green
    c: { bar: '#1d4a26', deep: '#12321a', key: '#285c32', keyDown: '#33703f', barSoft: '#c7dcc9', accent: '#2f7a3a', moss: '#5f8f5a', mossInk: '#1d4a26',
         bg: '#f3f6f2', line: '#dbe3d9', sunk: '#e8eee6', card1: '#285c32', appbar: '#24552d', tile: '#2f6b39',
         dBg: '#0b130d', dCard: '#142019', dLine: '#26382b', dSunk: '#0f1a12', dBar: '#11301a', dAccent: '#9fd1a5' },
    // lawn, trees, fire, funding and water; none of the storm or roof layers
    keep: (f) => !/^(hail-|wind-|roof-|year-|material-|photo-|naip-|com-|solar-|pest-|security-)/.test(f),
    money: true, extraRegions: null,
    company: () => ({
      name: 'Example Lawn & Land Co', short: 'Example Lawn', tagline: 'Lawn care and yard work',
      phone: '(555) 010-0000', email: '', site: 'traverseplatforms.com', appUrl: '',
      visit: 'yard walk', visitShort: 'Walk', logo: null,
      services: [['aeration', 'Aeration'], ['overseed', 'Overseeding'], ['mowing', 'Mowing plan'], ['cleanup', 'Yard cleanup'],
                 ['trees', 'Tree and shrub trimming'], ['fuel', 'Wildfire fuel reduction'], ['other', 'Other']],
      leadNeeds: ['Aeration', 'Lawn care plan', 'Yard cleanup', 'Trees or shrubs', 'Wildfire clearing', 'Question'],
      extraWork: [['thin', 'Thin or patchy lawn'], ['weeds', 'Weeds'], ['leaves', 'Leaves or debris'], ['shrubs', 'Overgrown shrubs'],
                  ['branches', 'Branches near the house'], ['fuel', 'Dry brush close to the house']],
      features: { quote: false, communities: true, firecheck: true, skiptrace: false, hail: false, roof: false },
      card: { lawn: true, trees: true, fire: true, money: true, water: true, hail: false, roof: false },
      links: { googleReview: '' }
    })
  },
  solar: {
    name: 'TraverseSolar', short: 'Solar', folder: 'ts-016064fc',
    api: 'traverse-solar', data: 'traverse-solar-data', priv: 'traverse-solar-private', cookie: 'tvs',
    store: 'tvsolar.', storeApp: 'tvsolar.app.', idb: 'tvsolar-rounds', cache: 'tvsolar-',
    blurb: 'Doors, phones and appointments for solar sales teams.',
    icon: '#f2a900', iconInk: '#0f1b2d',              // the kit's solar edition: ink on amber
    // late sun: the edition amber, deepened to brown for the bar and sign-in
    c: { bar: '#3b2a07', deep: '#271c04', key: '#4d380c', keyDown: '#634810', barSoft: '#ecd9a8', accent: '#8f5e00', moss: '#b08a3a', mossInk: '#3b2a07',
         bg: '#f7f5ef', line: '#e6e0d1', sunk: '#efeadf', card1: '#4d380c', appbar: '#45320a', tile: '#5c4410',
         dBg: '#120e05', dCard: '#1d170b', dLine: '#3a2f18', dSunk: '#17120a', dBar: '#211906', dAccent: '#f2c14e' },
    // the roof and the sun; none of the storm, lawn, fire or commercial layers
    keep: (f) => !/^(hail-|wind-|com-|lawnmask-|pest-|security-|cwpp\.json$|hoa-communities\.json$|roof-damage-defaults\.json$)/.test(f),
    money: false, extraRegions: null,
    company: () => ({
      name: 'Example Solar Co', short: 'Example Solar', tagline: 'Solar and battery installs',
      phone: '(555) 010-0000', email: '', site: 'traverseplatforms.com', appUrl: '',
      visit: 'site survey', visitShort: 'Survey', logo: null,
      services: [['solar', 'Solar install'], ['battery', 'Battery backup'], ['ev', 'EV charger'], ['roof', 'Roof work before solar'], ['other', 'Other']],
      leadNeeds: ['Solar quote', 'Lower my bill', 'Battery backup', 'EV charger', 'Question'],
      extraWork: [['south', 'Roof faces south'], ['shade', 'Shade from trees'], ['oldroof', 'Roof looks near the end of its life'],
                  ['hassolar', 'Already has solar'], ['ev', 'Electric car in the driveway'], ['bill', 'Mentioned a high bill']],
      features: { quote: false, communities: false, firecheck: false, skiptrace: false, hail: false, roof: true, solar: true },
      card: { lawn: false, trees: false, fire: false, money: false, water: false, fc: false, hail: false, roof: true, solar: true },
      links: { googleReview: '' }
    })
  },
  pest: {
    name: 'TraversePest', short: 'Pest', folder: 'tq-9cf8d9de',
    api: 'traverse-pest', data: 'traverse-pest-data', priv: 'traverse-pest-private', cookie: 'tvp',
    store: 'tvpest.', storeApp: 'tvpest.app.', idb: 'tvpest-rounds', cache: 'tvpest-',
    blurb: 'Doors, phones and appointments for pest control teams.',
    icon: '#7a3fa3',                                   // the kit's pest edition fill
    // dusk violet: the edition purple, deepened for the bar and sign-in
    c: { bar: '#3a1f52', deep: '#26133a', key: '#4c2a6b', keyDown: '#5f3786', barSoft: '#e2d3f0', accent: '#6a3594', moss: '#9a7ab8', mossInk: '#3a1f52',
         bg: '#f6f4f8', line: '#e2dce8', sunk: '#ede8f2', card1: '#4c2a6b', appbar: '#452664', tile: '#5f3786',
         dBg: '#100b15', dCard: '#1b1424', dLine: '#33283f', dSunk: '#150f1b', dBar: '#1e1229', dAccent: '#c9a6ea' },
    // the pest layers and trees near the house; none of the storm, roof, solar, lawn, fire or commercial layers
    keep: (f) => !/^(hail-|wind-|roof-|year-|material-|photo-|naip-|com-|solar-|lawnmask-|security-|cwpp\.json$|hoa-communities\.json$|roof-damage-defaults\.json$)/.test(f),
    money: false, extraRegions: null,
    company: () => ({
      name: 'Example Pest Co', short: 'Example Pest', tagline: 'Pest control for homes',
      phone: '(555) 010-0000', email: '', site: 'traverseplatforms.com', appUrl: '',
      visit: 'inspection', visitShort: 'Inspection', logo: null,
      services: [['quarterly', 'Quarterly pest plan'], ['onetime', 'One-time treatment'], ['mosquito', 'Mosquito service'], ['rodent', 'Rodent control'], ['termite', 'Termite inspection'], ['other', 'Other']],
      leadNeeds: ['Pest plan', 'Ants or spiders', 'Wasps', 'Mice or rodents', 'Mosquitoes', 'Question'],
      extraWork: [['wasps', 'Wasp nest seen'], ['ants', 'Ant trails'], ['spiders', 'Spiders or webs'], ['mice', 'Signs of mice'],
                  ['firewood', 'Firewood against the house'], ['water', 'Standing water'], ['otherco', 'Already has a pest company']],
      features: { quote: false, communities: false, firecheck: false, skiptrace: false, hail: false, roof: false, solar: false, pest: true },
      card: { lawn: false, trees: true, fire: false, money: false, water: false, fc: false, hail: false, roof: false, solar: false, pest: true },
      links: { googleReview: '' }
    })
  },
  security: {
    name: 'TraverseSecurity', short: 'Security', folder: 'tg-3b0b89e7',
    api: 'traverse-security', data: 'traverse-security-data', priv: 'traverse-security-private', cookie: 'tvg',
    store: 'tvsec.', storeApp: 'tvsec.app.', idb: 'tvsec-rounds', cache: 'tvsec-',
    blurb: 'Doors, phones and appointments for home security teams.',
    icon: '#1b6f7a',                                   // night teal (the brand kit has no security edition yet)
    c: { bar: '#123b44', deep: '#0b2a31', key: '#1a4d58', keyDown: '#22606d', barSoft: '#cfe6ea', accent: '#1b6f7a', moss: '#6a9ea6', mossInk: '#123b44',
         bg: '#f3f7f8', line: '#dbe6e8', sunk: '#e6eff1', card1: '#1a4d58', appbar: '#164550', tile: '#22606d',
         dBg: '#081315', dCard: '#101e21', dLine: '#233a3f', dSunk: '#0c181b', dBar: '#0d262b', dAccent: '#8fd0da' },
    // the security layers; none of the storm, roof, solar, pest, lawn, fire or commercial layers
    keep: (f) => !/^(hail-|wind-|roof-|year-|material-|photo-|naip-|com-|solar-|pest-|lawnmask-|cwpp\.json$|hoa-communities\.json$|roof-damage-defaults\.json$)/.test(f),
    money: false, extraRegions: null,
    company: () => ({
      name: 'Example Security Co', short: 'Example Security', tagline: 'Home security and monitoring',
      phone: '(555) 010-0000', email: '', site: 'traverseplatforms.com', appUrl: '',
      visit: 'home consultation', visitShort: 'Consult', logo: null,
      services: [['monitoring', 'Monitored alarm'], ['cameras', 'Cameras'], ['doorbell', 'Video doorbell'], ['smart', 'Smart locks and lights'], ['other', 'Other']],
      leadNeeds: ['Alarm quote', 'Cameras', 'Video doorbell', 'Smart home', 'Question'],
      extraWork: [['nosystem', 'No visible system'], ['doorbell', 'Has a camera doorbell'], ['sign', 'Provider sign in the yard'],
                  ['otherco', 'Already has a provider'], ['dog', 'Dog at home'], ['newmove', 'Just moved in']],
      features: { quote: false, communities: false, firecheck: false, skiptrace: false, hail: false, roof: false, solar: false, pest: false, security: true },
      card: { lawn: false, trees: false, fire: false, money: false, water: false, fc: false, hail: false, roof: false, solar: false, pest: false, security: true },
      links: { googleReview: '' }
    })
  }
};

/* every swap is counted, so a change in the source fails the build instead of shipping half a rebrand */
function rep(s, from, to, want, what) {
  const n = s.split(from).length - 1;
  if (want !== undefined && n !== want) throw new Error((what || 'swap') + ': expected ' + want + ' of ' + JSON.stringify(from).slice(0, 80) + ', found ' + n);
  if (n === 0) throw new Error((what || 'swap') + ': not found ' + JSON.stringify(from).slice(0, 80));
  return s.split(from).join(to);
}
function write(rel, data) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
}
const mark = (stroke, hole, end) => '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
  + '<polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="' + stroke + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
  + [[9, 47], [24, 31], [37, 40]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="5.2" fill="' + hole + '" stroke="' + stroke + '" stroke-width="3.6"/>').join('')
  + '<circle cx="53" cy="17" r="8" fill="' + end + '"/></svg>';

/* ------------------------------------------------------------------ the page */
function page(E) {
  const c = E.c;
  let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

  // the API and the phone's saved state
  html = rep(html, "'../api/rounds.php'", "'../api/" + E.api + "-rounds.php'", 1, 'api');
  html = html.replace(/'sixfold\.([a-zA-Z.]+)'/g, "'" + E.store + "$1'").replace(/'doorapp\.([a-zA-Z.]+)'/g, "'" + E.storeApp + "$1'");
  html = rep(html, "indexedDB.open('sixfold-rounds'", "indexedDB.open('" + E.idb + "'", 1, 'indexeddb');
  html = rep(html, "'X-Sixfold-Offline'", "'X-Traverse-Offline'", 1, 'offline header');
  // the name sw.js keeps answers under: Cache Storage is shared by every install on the domain, so a sign-out here
  // must wipe this edition's copy, never Sixfold's 'rounds-api' (review 2026-10-06)
  html = rep(html, "var API_CACHE = 'rounds-api';", "var API_CACHE = '" + E.cache + "api';", 1, 'api cache name');
  if (/'(sixfold|doorapp)[.-]/.test(html)) throw new Error('a Sixfold storage key is left in the page');

  // the product's name (the client's name comes from company.json, as for every install)
  html = rep(html, '<title>Door rounds</title>', '<title>' + E.name + '</title>', 1, 'title');
  // the iPhone home-screen label (Safari reads this tag first); short, because the label is cut at about 12 letters
  html = rep(html, '<meta name="apple-mobile-web-app-title" content="Rounds">', '<meta name="apple-mobile-web-app-title" content="' + E.short + '">', 1, 'home-screen label');
  html = rep(html, "document.title = c.name ? 'Door rounds — ' + c.name : 'Door rounds';",
    "document.title = c.name ? '" + E.name + " — ' + c.name : '" + E.name + "';", 1, 'doc title');
  html = rep(html, "tile('button', 'door', 'Door rounds',", "tile('button', 'door', 'Doors',", 1, 'tile');
  // sign-in: the client's mark and name stay on top; the product sits under them as a lockup
  html = rep(html, "inn.appendChild(q('div', 'sub', 'Door rounds'));",
    "var tv = q('div', 'sub tvlock'); tv.innerHTML = TV_MARK; tv.appendChild(q('span', null, '" + E.name + "')); inn.appendChild(tv);", 1, 'signin sub');
  html = rep(html, "  var QKEY = ", "  var TV_MARK = '" + mark('currentColor', 'var(--signin)', 'var(--ember)') + "';\n  var QKEY = ", 1, 'mark const');

  // colours hard-coded outside the tokens
  html = rep(html, '<meta name="theme-color" content="#1F2A25">', '<meta name="theme-color" content="' + c.bar + '">', 1, 'theme-color');
  html = rep(html, 'linear-gradient(160deg,#2E3F37,#16201C);color:#EDE7DC', 'linear-gradient(160deg,' + c.card1 + ',' + c.bar + ');color:#ffffff', 1, 'addinfo');
  html = rep(html, "['#E4703A', '#F2A35E', '#8AA07A', '#EDE7DC', '#B84C15']", "['#d6400c', '#f2a900', '" + c.accent + "', '#ffffff', '" + c.bar + "']", 1, 'confetti');
  html = rep(html, "fillColor: '#E4703A'", "fillColor: '#d6400c'", 1, 'map pin');
  html = rep(html, "color: '#16201C', weight: 3", "color: '#0f1b2d', weight: 3", 1, 'map ring');
  html = rep(html, '.legend i.c{background:transparent;border:2.5px solid #16201C', '.legend i.c{background:transparent;border:2.5px solid #0f1b2d', 1, 'legend');
  // Sixfold's dark greens, hard-coded in the bar, card and tile gradients
  html = rep(html, '#2B3B34', c.card1, 4, 'card gradients');
  html = rep(html, '#26342D', c.appbar, 1, 'appbar gradient');
  html = rep(html, '#33463D', c.tile, 1, 'tile gradient');

  // the sign-in background: Sixfold's contour lines become a survey grid
  html = html.replace(/  :root\{--topo:url\("data:image\/svg\+xml,[^"]*"\)\}/, () => {
    let d = ''; for (let x = 0; x <= 560; x += 40) d += 'M' + x + ' 0V360'; for (let y = 0; y <= 360; y += 40) d += 'M0 ' + y + 'H560';
    const g = "<svg xmlns='http://www.w3.org/2000/svg' width='560' height='360'><path d='" + d + "' fill='none' stroke='%23ffffff' stroke-opacity='.06' stroke-width='1'/></svg>";
    return '  :root{--topo:url("data:image/svg+xml,' + g.replace(/</g, '%3C').replace(/>/g, '%3E') + '")}';
  });
  if (html.indexOf("stroke='%23EDE7DC'") >= 0) throw new Error('the contour background is still in');

  // the edition's tokens, after the app's own (same selectors, later wins); company.json colours still win over these
  const dark = `--bg:${c.dBg}; --card:${c.dCard}; --ink:#e8edf5; --soft:#9aa8bc; --line:${c.dLine}; --sunk:${c.dSunk};
      --bar:${c.dBar};
      --ember:${c.dEmber || '#ff7a45'}; --ember-ink:${c.dEmberInk || '#ff7a45'}; --on-ember:${c.dOnEmber || '#0b1220'}; --moss-ink:${c.dAccent};
      --go:#6fcf9b; --on-go:#06140c; --go-tint:#133324;
      --later:#e8b04f; --later-tint:#3a2c10; --miss:#a7b3c4; --miss-tint:#1c2638; --bad:#f0786a;
      --booked:#6fcf9b; --accent:${c.dAccent};
      --toast:#e8edf5; --toast-ink:#0f1b2d;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 24px -12px rgba(0,0,0,.6);`;
  const tokens = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style id="traverse-tokens">
  /* ${E.name}: Traverse brand kit (claude.ai/artifact/QZ8aUZCLNXXeNc2Ns5KrkV), written by traverse/editions/build-editions.cjs */
  :root{
    --bg:${c.bg}; --card:${COMMON_BG['--card']}; --ink:${COMMON_BG['--ink']}; --soft:${COMMON_BG['--soft']}; --line:${c.line}; --sunk:${c.sunk};
    --bar:${c.bar}; --bar-ink:#ffffff; --bar-soft:${c.barSoft}; --bar-lift:rgba(255,255,255,.09); --bar-edge:rgba(255,255,255,.16);
    --ember:${c.ember || '#d6400c'}; --ember-ink:${c.emberInk || '#b83608'}; --on-ember:${c.onEmber || '#ffffff'}; --moss:${c.moss}; --moss-ink:${c.mossInk};
    --go:#1f7a4d; --on-go:#ffffff; --go-tint:#dcefe5;
    --later:#8a5a00; --later-tint:#f7ead0; --miss:#566476; --miss-tint:#e6eaf0; --bad:#b42318;
    --booked:#1f7a4d; --accent:${c.accent};
    --toast:#0f1b2d; --toast-ink:#ffffff;
    --shadow:0 1px 2px rgba(15,27,45,.06), 0 8px 22px -12px rgba(15,27,45,.24);
    --signin:${c.bar}; --signin-deep:${c.deep}; --signin-ink:#ffffff; --signin-soft:${c.barSoft}; --key:${c.key}; --key-down:${c.keyDown};
    --serif:"Familjen Grotesk","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    --mono:"JetBrains Mono","Cascadia Mono",Consolas,ui-monospace,monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      ${dark}
    }
  }
  :root[data-theme="dark"]{
      ${dark}
  }
  .signin .tvlock{display:inline-flex;align-items:center;gap:8px;font-family:var(--serif);font-weight:600;font-size:15px;letter-spacing:-.005em;text-transform:none;color:var(--signin-soft)}
  .signin .tvlock svg{width:22px;height:22px}
</style>
</head>`;
  html = rep(html, '</head>', tokens, 1, 'head');
  html = rep(html, '<meta name="viewport"', '<meta name="robots" content="noindex, nofollow">\n<meta name="viewport"', 1, 'robots');
  return html;
}

/* ------------------------------------------------------------- offline worker */
function worker(E) {
  let sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
  sw = sw.replace(/const SHELL_V = 'rounds-shell-([^']+)';/, (m, v) => "const SHELL_V = '" + E.cache + 'shell-' + v + "';");
  sw = rep(sw, "const API = 'rounds-api';", "const API = '" + E.cache + "api';", 1, 'sw api cache');
  // every install shares one origin's Cache Storage: only ever clear our own (the prefixes don't overlap)
  sw = rep(sw, "const OURS = 'rounds-';", "const OURS = '" + E.cache + "';", 1, 'sw cleanup');
  sw = rep(sw, '\\/api\\/rounds\\.php', '\\/api\\/' + E.api.replace(/-/g, '\\-') + '-rounds\\.php', 1, 'sw keep');
  sw = rep(sw, '../api/rounds.php', '../api/' + E.api + '-rounds.php', 2, 'sw push');
  sw = sw.split('X-Sixfold-').join('X-Traverse-');
  if (sw.indexOf("'" + E.cache + 'shell-') < 0) throw new Error('sw shell name not swapped');
  return sw;
}

/* ------------------------------------------------------------------- the API */
function api(E, name) {
  let s = fs.readFileSync(path.join(SRC, 'api', name), 'utf8');
  s = s.split('sixfold-data').join(E.data).split('sixfold-private').join(E.priv)
    .split('sixfold-backup').join(E.api + '-backup').split('filename="sixfold-').join('filename="' + E.api + '-')
    .split('SIXFOLD_SKIPTRACE').join(E.api.toUpperCase().replace(/-/g, '_') + '_SKIPTRACE');
  return s;
}

/* ------------------------------------------------------------------ one edition */
async function build(key) {
  const E = EDITIONS[key];
  const app = path.join('public_html', E.folder);
  write(path.join(app, 'index.html'), page(E));
  write(path.join(app, 'sw.js'), worker(E));
  write(path.join(app, 'manifest.json'), JSON.stringify({
    name: E.name, short_name: E.short, description: E.blurb,
    start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
    background_color: E.c.deep, theme_color: E.c.bar,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2) + '\n');
  write(path.join(app, '.htaccess'), fs.readFileSync(path.join(APP, '.htaccess'), 'utf8')
    .replace('<IfModule mod_headers.c>', '<IfModule mod_headers.c>\nHeader set X-Robots-Tag "noindex, nofollow"'));

  let r = api(E, 'rounds.php');
  r = rep(r, "const COOKIE     = 'sfr';", "const COOKIE     = '" + E.cookie + "';", 1, 'cookie');
  // the codes file's fallback beside the API (a local checkout) is named per install: public_html/api/rounds-codes.php is
  // Sixfold's changeover copy, and an edition whose private folder was missing would otherwise sign Sixfold's codes in
  // and share its session key (review 2026-10-06)
  r = rep(r, "__DIR__ . '/rounds-codes.php'", "__DIR__ . '/" + E.api + "-rounds-codes.php'", 1, 'codes fallback');
  r = rep(r, "require_once __DIR__ . '/skiptrace.php';", "require_once __DIR__ . '/" + E.api + "-skiptrace.php';", 1, 'require skiptrace');
  r = rep(r, "require_once __DIR__ . '/webpush.php';", "require_once __DIR__ . '/" + E.api + "-webpush.php';", 1, 'require webpush');
  for (const bad of ['sixfold-data', 'sixfold-private', "'sfr'"]) if (r.indexOf(bad) >= 0) throw new Error('API still names ' + bad);
  write(path.join('public_html', 'api', E.api + '-rounds.php'), r);
  const st = api(E, 'skiptrace.php');
  if (st.indexOf('sixfold-private') >= 0) throw new Error('skiptrace still names sixfold-private');
  write(path.join('public_html', 'api', E.api + '-skiptrace.php'), st);
  write(path.join('public_html', 'api', E.api + '-webpush.php'), api(E, 'webpush.php'));

  // The data: towns and the per-door layers this edition uses. Never Sixfold's own business: its company file and
  // training lessons, or the docs folder (only its funding and water sheets, for Yards, with Sixfold's review link out).
  const rounds = path.join(OUT, E.data, 'rounds');
  fs.rmSync(rounds, { recursive: true, force: true });
  const money = JSON.parse(fs.readFileSync(path.join(DATA, 'docs', 'money.json'), 'utf8'));
  let copied = 0, bytes = 0;
  for (const f of fs.readdirSync(DATA)) {
    const p = path.join(DATA, f);
    if (!fs.statSync(p).isFile() || !f.endsWith('.json') || f === 'company.json' || f === 'training.json' || !E.keep(f)) continue;
    let buf = fs.readFileSync(p);
    if (f === 'index.json') {
      const idx = JSON.parse(buf.toString('utf8'));
      if (E.extraRegions) idx.regions = idx.regions.concat(JSON.parse(fs.readFileSync(path.join(__dirname, E.extraRegions), 'utf8')).regions);
      // the API reads each town's county from docs/money.json; write it into the edition's own index too
      for (const reg of idx.regions) if (!reg.county && money.counties[reg.key]) reg.county = money.counties[reg.key];
      const missing = idx.regions.filter((reg) => !reg.county).map((reg) => reg.key);
      if (missing.length) throw new Error('towns with no county: ' + missing.join(' '));
      buf = Buffer.from(JSON.stringify(idx));
    }
    write(path.join(E.data, 'rounds', f), buf);
    copied++; bytes += buf.length;
  }
  if (E.money) {
    const m = JSON.parse(JSON.stringify(money));
    m.links = { googleReview: '' };
    m.footer = String(m.footer || '').replace(/\s*Sources and the fact-check log:[^"]*$/, '').trim();
    write(path.join(E.data, 'rounds', 'docs', 'money.json'), JSON.stringify(m, null, 1));
  }
  const co = E.company();
  co.appUrl = 'https://sixfoldcolorado.com/' + E.folder + '/';
  write(path.join(E.data, 'rounds', 'company.json'), JSON.stringify(co, null, 2) + '\n');

  // sign-in codes, made once per edition
  const codes = path.join(OUT, E.priv, 'rounds-codes.php');
  if (!fs.existsSync(codes)) {
    const pin = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    write(path.join(E.priv, 'rounds-codes.php'), `<?php
/* Sign-in codes for ${E.name} (made by build-editions.cjs ${new Date().toISOString().slice(0, 10)}).
   Upload to ${E.priv}/ BESIDE public_html, never inside it. Not in git. Add people from the app's
   Accounts screen; this file only needs the first admin. Shape: traverse/app/api/rounds-codes.example.php */
return [
    'session_key' => '${crypto.randomBytes(32).toString('hex')}',
    'session_days' => 45,
    'people' => [
        '${pin}' => ['Matthew Sharpe', 'admin'],
    ],
];
`);
    console.log(key + ': made ' + E.priv + '/rounds-codes.php (open it to read your admin code)');
  }

  // icons: the edition's fill from the brand kit
  const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
  const icon = (bleed) => {
    const inner = bleed ? 'translate(13 13) scale(0.594)' : 'translate(8.5 8.5) scale(0.734)';
    return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
      + '<rect width="64" height="64"' + (bleed ? '' : ' rx="14"') + ' fill="' + E.icon + '"/>'
      + '<g transform="' + inner + '">' + mark(E.iconInk || '#ffffff', E.icon, E.iconInk || '#ffffff').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></svg>');
  };
  const dir = path.join(OUT, app);
  await sharp(icon(false), { density: 1200 }).resize(192, 192).png().toFile(path.join(dir, 'icon-192.png'));
  await sharp(icon(false), { density: 1200 }).resize(512, 512).png().toFile(path.join(dir, 'icon-512.png'));
  await sharp(icon(true), { density: 1200 }).resize(512, 512).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  await sharp(icon(true), { density: 1200 }).resize(180, 180).png().toFile(path.join(dir, 'apple-touch-icon.png'));

  // upload packs, one per destination (bsdtar writes forward-slash zips; Compress-Archive's backslash paths don't extract on the host)
  const up = path.join(OUT, 'upload', key);
  fs.rmSync(up, { recursive: true, force: true }); fs.mkdirSync(up, { recursive: true });
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-a', '-c', '-f', path.join(up, '1-extract-in-HOME-beside-public_html--' + E.data + '.zip'), '-C', OUT, E.data]);
  execFileSync(tar, ['-a', '-c', '-f', path.join(up, '4-extract-in-public_html--app-' + E.folder + '.zip'), '-C', path.join(OUT, 'public_html'), E.folder]);
  console.log(key + ': built ' + E.folder + ' - data files ' + copied + ', ' + (bytes / 1048576).toFixed(1) + ' MB; packs in ' + path.relative(REPO, up));
}

(async () => {
  const only = process.argv[2];
  if (only && !EDITIONS[only]) throw new Error('no edition "' + only + '" (roofing, yards, solar, pest, security)');
  fs.rmSync(path.join(OUT, 'upload', '1-extract-in-HOME-beside-public_html--traverse-data.zip'), { force: true });   // the single-edition packs of the first build
  fs.rmSync(path.join(OUT, 'upload', '4-extract-in-public_html--app-tr-cb2e8587.zip'), { force: true });
  for (const k of only ? [only] : Object.keys(EDITIONS)) await build(k);
})().catch((e) => { console.error(e); process.exit(1); });

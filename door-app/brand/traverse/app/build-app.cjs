// Builds the Traverse-branded copy of the door app (TraverseRoofing, with a made-up client).
//
//   node door-app/brand/traverse/app/build-app.cjs
//
// Matthew, 2026-10-06: rebrand the app as Traverse but leave Sixfold's app alone. So this is NOT a
// hand copy: door-app/site stays the one source (and Sixfold's install), and this script makes the
// Traverse copy from it, so every fix to the app lands in both. Never edit dist/ by hand.
//
// The copy is a separate install with its own data (his decision): its own sign-ins, marks, leads and
// customers; the towns and per-door data are copied in, nothing of Sixfold's customers is. Both copies
// live on sixfoldcolorado.com for now, so every place two installs on one domain would collide is
// renamed: the session cookie, the phone's saved settings and offline queue (localStorage, IndexedDB),
// the offline copies (Cache Storage names, and the cleanup that would delete the other's), the API file,
// and the data and private folders beside public_html.
//
// Output, dist/ (gitignored: 50 MB of door data and a codes file):
//   public_html/tr-cb2e8587/          the app (page, offline worker, manifest, icons, .htaccess)
//   public_html/api/traverse-*.php    its API
//   traverse-data/rounds/             its door data + company.json
//   traverse-private/rounds-codes.php its sign-in codes (made once, never overwritten)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FOLDER = 'tr-cb2e8587';
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SRC = path.join(REPO, 'door-app', 'site');
const APP = path.join(SRC, 'summit-de59ae83');
const OUT = path.join(__dirname, 'dist');
const BRAND = path.join(REPO, 'door-app', 'brand', 'traverse');

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

/* ------------------------------------------------------------------ the page */
let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

// the API and the phone's saved state
html = rep(html, "'../api/rounds.php'", "'../api/traverse-rounds.php'", 1, 'api');
html = html.replace(/'sixfold\.([a-zA-Z.]+)'/g, "'traverse.$1'").replace(/'doorapp\.([a-zA-Z.]+)'/g, "'traverse.app.$1'");
html = rep(html, "indexedDB.open('sixfold-rounds'", "indexedDB.open('traverse-rounds'", 1, 'indexeddb');
html = rep(html, "'X-Sixfold-Offline'", "'X-Traverse-Offline'", 1, 'offline header');
if (/'(sixfold|doorapp)[.-]/.test(html)) throw new Error('a Sixfold storage key is left in the page');

// the product's name (the client's name comes from company.json, as for every install)
html = rep(html, '<title>Door rounds</title>', '<title>TraverseRoofing</title>', 1, 'title');
html = rep(html, "document.title = c.name ? 'Door rounds — ' + c.name : 'Door rounds';",
  "document.title = c.name ? 'TraverseRoofing — ' + c.name : 'TraverseRoofing';", 1, 'doc title');
html = rep(html, "tile('button', 'door', 'Door rounds',", "tile('button', 'door', 'Doors',", 1, 'tile');
// sign-in: the client's mark and name stay on top; the product sits under them as a lockup
html = rep(html, "inn.appendChild(q('div', 'sub', 'Door rounds'));",
  "var tv = q('div', 'sub tvlock'); tv.innerHTML = TV_MARK; tv.appendChild(q('span', null, 'TraverseRoofing')); inn.appendChild(tv);", 1, 'signin sub');
const mark = (stroke, hole, end) => '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
  + '<polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="' + stroke + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
  + [[9, 47], [24, 31], [37, 40]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="5.2" fill="' + hole + '" stroke="' + stroke + '" stroke-width="3.6"/>').join('')
  + '<circle cx="53" cy="17" r="8" fill="' + end + '"/></svg>';
html = rep(html, "  var QKEY = ", "  var TV_MARK = '" + mark('currentColor', 'var(--signin)', 'var(--ember)') + "';\n  var QKEY = ", 1, 'mark const');

// colours hard-coded outside the tokens
html = rep(html, '<meta name="theme-color" content="#1F2A25">', '<meta name="theme-color" content="#13294b">', 1, 'theme-color');
html = rep(html, 'linear-gradient(160deg,#2E3F37,#16201C);color:#EDE7DC', 'linear-gradient(160deg,#1d3760,#13294b);color:#ffffff', 1, 'addinfo');
html = rep(html, "['#E4703A', '#F2A35E', '#8AA07A', '#EDE7DC', '#B84C15']", "['#d6400c', '#f2a900', '#4e6680', '#ffffff', '#13294b']", 1, 'confetti');
html = rep(html, "fillColor: '#E4703A'", "fillColor: '#d6400c'", 1, 'map pin');
html = rep(html, "color: '#16201C', weight: 3", "color: '#0f1b2d', weight: 3", 1, 'map ring');
html = rep(html, '.legend i.c{background:transparent;border:2.5px solid #16201C', '.legend i.c{background:transparent;border:2.5px solid #0f1b2d', 1, 'legend');

// Sixfold's dark greens, hard-coded in the bar, card and tile gradients
html = rep(html, '#2B3B34', '#1d3760', 4, 'card gradients');
html = rep(html, '#26342D', '#1a3359', 1, 'appbar gradient');
html = rep(html, '#33463D', '#24427a', 1, 'tile gradient');

// the sign-in background: Sixfold's contour lines become a survey grid
html = html.replace(/  :root\{--topo:url\("data:image\/svg\+xml,[^"]*"\)\}/, () => {
  let d = ''; for (let x = 0; x <= 560; x += 40) d += 'M' + x + ' 0V360'; for (let y = 0; y <= 360; y += 40) d += 'M0 ' + y + 'H560';
  const g = "<svg xmlns='http://www.w3.org/2000/svg' width='560' height='360'><path d='" + d + "' fill='none' stroke='%23ffffff' stroke-opacity='.06' stroke-width='1'/></svg>";
  return '  :root{--topo:url("data:image/svg+xml,' + g.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/'/g, "'") + '")}';
});
if (html.indexOf("stroke='%23EDE7DC'") >= 0) throw new Error('the contour background is still in');

// Traverse tokens, after the app's own (same selectors, later wins); company.json colours still win over these
const tokens = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style id="traverse-tokens">
  /* Traverse brand kit (claude.ai/artifact/QZ8aUZCLNXXeNc2Ns5KrkV), written by door-app/brand/traverse/app/build-app.cjs */
  :root{
    --bg:#f4f6f9; --card:#ffffff; --ink:#0f1b2d; --soft:#566476; --line:#dce2ea; --sunk:#eaeef3;
    --bar:#13294b; --bar-ink:#ffffff; --bar-soft:#c9d6ea; --bar-lift:rgba(255,255,255,.09); --bar-edge:rgba(255,255,255,.16);
    --ember:#d6400c; --ember-ink:#b83608; --on-ember:#ffffff; --moss:#6b7f99; --moss-ink:#13294b;
    --go:#1f7a4d; --on-go:#ffffff; --go-tint:#dcefe5;
    --later:#8a5a00; --later-tint:#f7ead0; --miss:#566476; --miss-tint:#e6eaf0; --bad:#b42318;
    --booked:#1f7a4d; --accent:#13294b;
    --toast:#0f1b2d; --toast-ink:#ffffff;
    --shadow:0 1px 2px rgba(15,27,45,.06), 0 8px 22px -12px rgba(15,27,45,.24);
    --signin:#13294b; --signin-deep:#0b1a33; --signin-ink:#ffffff; --signin-soft:#c9d6ea; --key:#1d3760; --key-down:#284a7d;
    --serif:"Familjen Grotesk","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    --mono:"JetBrains Mono","Cascadia Mono",Consolas,ui-monospace,monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0b1220; --card:#131c2e; --ink:#e8edf5; --soft:#9aa8bc; --line:#26324a; --sunk:#0f1828;
      --bar:#0f1b33;
      --ember:#ff7a45; --ember-ink:#ff7a45; --on-ember:#0b1220; --moss-ink:#9fb3cf;
      --go:#6fcf9b; --on-go:#06140c; --go-tint:#133324;
      --later:#e8b04f; --later-tint:#3a2c10; --miss:#a7b3c4; --miss-tint:#1c2638; --bad:#f0786a;
      --booked:#6fcf9b; --accent:#dce6f5;
      --toast:#e8edf5; --toast-ink:#0f1b2d;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 24px -12px rgba(0,0,0,.6);
    }
  }
  :root[data-theme="dark"]{
      --bg:#0b1220; --card:#131c2e; --ink:#e8edf5; --soft:#9aa8bc; --line:#26324a; --sunk:#0f1828;
      --bar:#0f1b33;
      --ember:#ff7a45; --ember-ink:#ff7a45; --on-ember:#0b1220; --moss-ink:#9fb3cf;
      --go:#6fcf9b; --on-go:#06140c; --go-tint:#133324;
      --later:#e8b04f; --later-tint:#3a2c10; --miss:#a7b3c4; --miss-tint:#1c2638; --bad:#f0786a;
      --booked:#6fcf9b; --accent:#dce6f5;
      --toast:#e8edf5; --toast-ink:#0f1b2d;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 24px -12px rgba(0,0,0,.6);
  }
  .signin .tvlock{display:inline-flex;align-items:center;gap:8px;font-family:var(--serif);font-weight:600;font-size:15px;letter-spacing:-.005em;text-transform:none;color:var(--signin-soft)}
  .signin .tvlock svg{width:22px;height:22px}
</style>
</head>`;
html = rep(html, '</head>', tokens, 1, 'head');
html = rep(html, '<meta name="viewport"', '<meta name="robots" content="noindex, nofollow">\n<meta name="viewport"', 1, 'robots');
write(path.join('public_html', FOLDER, 'index.html'), html);

/* ------------------------------------------------------------- offline worker */
let sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
sw = sw.replace(/const SHELL_V = 'rounds-shell-([^']+)';/, (m, v) => "const SHELL_V = 'traverse-shell-" + v + "';");
sw = rep(sw, "const API = 'rounds-api';", "const API = 'traverse-api';", 1, 'sw api cache');
// both installs share one origin's Cache Storage: only ever clear our own
sw = rep(sw, 'ks.filter((k) => k !== SHELL_V && k !== API)', "ks.filter((k) => k.indexOf('traverse-') === 0 && k !== SHELL_V && k !== API)", 1, 'sw cleanup');
sw = rep(sw, '\\/api\\/rounds\\.php', '\\/api\\/traverse-rounds\\.php', 1, 'sw keep');
sw = rep(sw, '../api/rounds.php', '../api/traverse-rounds.php', 2, 'sw push');
sw = sw.split('X-Sixfold-').join('X-Traverse-');
if (!/traverse-shell-/.test(sw)) throw new Error('sw shell name not swapped');
write(path.join('public_html', FOLDER, 'sw.js'), sw);

write(path.join('public_html', FOLDER, 'manifest.json'), JSON.stringify({
  name: 'TraverseRoofing', short_name: 'Traverse', description: 'Doors, phones and appointments for roofing crews.',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#0b1a33', theme_color: '#13294b',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2) + '\n');

write(path.join('public_html', FOLDER, '.htaccess'), fs.readFileSync(path.join(APP, '.htaccess'), 'utf8')
  .replace('<IfModule mod_headers.c>', '<IfModule mod_headers.c>\nHeader set X-Robots-Tag "noindex, nofollow"'));

/* ------------------------------------------------------------------- the API */
function api(name) {
  let s = fs.readFileSync(path.join(SRC, 'api', name), 'utf8');
  s = s.split('sixfold-data').join('traverse-data').split('sixfold-private').join('traverse-private')
    .split('sixfold-backup').join('traverse-backup').split("filename=\"sixfold-").join("filename=\"traverse-")
    .split('SIXFOLD_SKIPTRACE').join('TRAVERSE_SKIPTRACE');
  return s;
}
let r = api('rounds.php');
r = rep(r, "const COOKIE     = 'sfr';", "const COOKIE     = 'trv';", 1, 'cookie');
r = rep(r, "require_once __DIR__ . '/skiptrace.php';", "require_once __DIR__ . '/traverse-skiptrace.php';", 1, 'require skiptrace');
r = rep(r, "require_once __DIR__ . '/webpush.php';", "require_once __DIR__ . '/traverse-webpush.php';", 1, 'require webpush');
for (const bad of ['sixfold-data', 'sixfold-private', "'sfr'"]) if (r.indexOf(bad) >= 0) throw new Error('API still names ' + bad);
write(path.join('public_html', 'api', 'traverse-rounds.php'), r);
const st = api('skiptrace.php');
if (st.indexOf('sixfold-private') >= 0) throw new Error('skiptrace still names sixfold-private');
write(path.join('public_html', 'api', 'traverse-skiptrace.php'), st);
write(path.join('public_html', 'api', 'traverse-webpush.php'), api('webpush.php'));

/* ------------------------------------------------------------------ the data */
// Towns and per-door data are public-record work and come across. Sixfold's own business does not:
// its company file, price sheets, training lessons, HOA list, and the lawn-only and fire-only layers.
const DATA = path.join(SRC, 'data', 'rounds');
const skip = (f) => f === 'company.json' || f === 'training.json' || f === 'hoa-communities.json' || f === 'cwpp.json'
  || f.startsWith('lawnmask-') || !f.endsWith('.json');
let copied = 0, bytes = 0;
for (const f of fs.readdirSync(DATA)) {
  const p = path.join(DATA, f);
  if (!fs.statSync(p).isFile() || skip(f)) continue;
  write(path.join('traverse-data', 'rounds', f), fs.readFileSync(p));
  copied++; bytes += fs.statSync(p).size;
}
const ex = JSON.parse(fs.readFileSync(path.join(REPO, 'door-app', 'company.example.json'), 'utf8'));
delete ex._about; delete ex.colors;        // the made-up client wears the product's colours
Object.assign(ex, {
  email: '', site: 'traverseplatforms.com',
  appUrl: 'https://sixfoldcolorado.com/' + FOLDER + '/',
  features: Object.assign({}, ex.features, { skiptrace: false })
});
write(path.join('traverse-data', 'rounds', 'company.json'), JSON.stringify(ex, null, 2) + '\n');

/* ------------------------------------------------- sign-in codes, made once */
const codes = path.join(OUT, 'traverse-private', 'rounds-codes.php');
if (!fs.existsSync(codes)) {
  const pin = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  write(path.join('traverse-private', 'rounds-codes.php'), `<?php
/* Sign-in codes for the Traverse copy of the door app (made by build-app.cjs ${new Date().toISOString().slice(0, 10)}).
   Upload to traverse-private/ BESIDE public_html, never inside it. Not in git. Add people from the app's
   Accounts screen; this file only needs the first admin. Shape: door-app/site/api/rounds-codes.example.php */
return [
    'session_key' => '${crypto.randomBytes(32).toString('hex')}',
    'session_days' => 45,
    'people' => [
        '${pin}' => ['Matthew Sharpe', 'admin'],
    ],
];
`);
  console.log('made traverse-private/rounds-codes.php (open it to read your admin code)');
}

/* -------------------------------------------------------------------- icons */
(async () => {
  const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
  const ROOF = '#4e6680';
  const icon = (bleed) => {
    const inner = bleed ? 'translate(13 13) scale(0.594)' : 'translate(8.5 8.5) scale(0.734)';
    return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
      + (bleed ? '<rect width="64" height="64" fill="' + ROOF + '"/>' : '<rect width="64" height="64" rx="14" fill="' + ROOF + '"/>')
      + '<g transform="' + inner + '">' + mark('#ffffff', ROOF, '#ffffff').replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g></svg>');
  };
  const dir = path.join(OUT, 'public_html', FOLDER);
  await sharp(icon(false), { density: 1200 }).resize(192, 192).png().toFile(path.join(dir, 'icon-192.png'));
  await sharp(icon(false), { density: 1200 }).resize(512, 512).png().toFile(path.join(dir, 'icon-512.png'));
  await sharp(icon(true), { density: 1200 }).resize(512, 512).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  await sharp(icon(true), { density: 1200 }).resize(180, 180).png().toFile(path.join(dir, 'apple-touch-icon.png'));
  console.log('built', FOLDER, '- data files', copied, (bytes / 1048576).toFixed(1) + ' MB');

  /* upload packs, one per destination, named for where they go (bsdtar writes forward-slash zips;
     Compress-Archive's backslash paths do not extract on the host) */
  const { execFileSync } = require('child_process');
  const up = path.join(OUT, 'upload');
  fs.rmSync(up, { recursive: true, force: true }); fs.mkdirSync(up);
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-a', '-c', '-f', path.join(up, '1-extract-in-HOME-beside-public_html--traverse-data.zip'), '-C', OUT, 'traverse-data']);
  execFileSync(tar, ['-a', '-c', '-f', path.join(up, '4-extract-in-public_html--app-' + FOLDER + '.zip'), '-C', path.join(OUT, 'public_html'), FOLDER]);
  console.log('upload packs in', path.relative(REPO, up));
})().catch((e) => { console.error(e); process.exit(1); });

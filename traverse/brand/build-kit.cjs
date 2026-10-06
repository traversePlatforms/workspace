// Traverse brand kit (2026-10-06): writes the Design System artifact's files into ./project/. Run: node door-app/brand/traverse/build-kit.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, 'project');
const w = (p, s) => { const f = path.join(ROOT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

/* ---- the mark: a three-leg survey traverse; the last station is the close ---- */
const ST = [[9, 47], [24, 31], [37, 40], [53, 17]];
const legs = ST.map((p) => p.join(',')).join(' ');
/* stations are open rings (a survey station, a stop on a route map), so the mark reads as a route, not a rising chart;
   `hole` is the ground the ring sits on */
function mark({ line, end, ring, hole = '#FFFFFF' }) {
  return `<polyline points="${legs}" fill="none" stroke="${line}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    ST.slice(0, 3).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.2" fill="${hole}" stroke="${line}" stroke-width="3.6"/>`).join('') +
    `<circle cx="53" cy="17" r="8" fill="${end}"${ring ? ` stroke="${ring}" stroke-width="3"` : ''}/>`;
}
const svg = (inner, vb = '0 0 64 64') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
const C = { navy: '#13294B', flag: '#D6400C', white: '#FFFFFF', ink: '#0F1B2D', solar: '#F2A900', roof: '#4E6680', pest: '#7A3FA3', yards: '#2F7A3A' };
const icon = (bg, line, end, ring) => `<rect width="64" height="64" rx="14" fill="${bg}"/><g transform="translate(8.5 8.5) scale(0.734)">${mark({ line, end, ring, hole: bg })}</g>`;

const ASSETS = {
  'traverse-mark-color.svg': svg(mark({ line: C.navy, end: C.flag })),
  'traverse-mark-reverse.svg': svg(mark({ line: C.white, end: C.flag, hole: C.navy })),
  'traverse-mark-navy.svg': svg(mark({ line: C.navy, end: C.navy })),
  'traverse-icon.svg': svg(icon(C.navy, C.white, C.flag)),
  'traverse-solar-icon.svg': svg(icon(C.solar, C.ink, C.ink)),
  'traverse-roof-icon.svg': svg(icon(C.roof, C.white, C.white)),
  'traverse-pest-icon.svg': svg(icon(C.pest, C.white, C.white)),
  'traverse-yards-icon.svg': svg(icon(C.yards, C.white, C.white)),
};
for (const [n, s] of Object.entries(ASSETS)) w('assets/Logos/' + n, s);
w('assets/Logos/README.md', `# Logos

Single files for placing the Traverse mark where the type's previews cannot. Each SVG carries its own colours (they show through \`<img>\`, which cannot inherit CSS colour).

- \`traverse-mark-color.svg\` — the primary mark: navy legs and stations, flag-orange closing station. On \`surface\` and \`surface-raised\`.
- \`traverse-mark-reverse.svg\` — white legs, flag-orange close. On \`deep\` (navy) and on photography darker than mid-grey.
- \`traverse-mark-navy.svg\` — one ink, navy throughout. For one-colour printing, embossing, stamps.
- \`traverse-icon.svg\` — the parent app icon: navy tile, white traverse, flag-orange close.
- \`traverse-solar-icon.svg\`, \`traverse-roof-icon.svg\`, \`traverse-pest-icon.svg\`, \`traverse-yards-icon.svg\` — edition app icons, each on its edition colour, the mark in that edition's \`on-\` colour (ink on solar, white on the rest).

The wordmark is set live in the display face (Familjen Grotesk 700); it is not yet outlined to a vector file.
`);

/* ---- tokens ---- */
const col = (name, light, dark, usage) => ({ name, value: dark ? { light, dark } : light, usage });
const tokens = {
  name: 'Traverse', version: 1,
  color: {
    themes: [{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }],
    tokens: [
      col('surface', '#f4f6f9', '#0d131c', 'Page background: the map table everything sits on.'),
      col('surface-raised', '#ffffff', '#151d29', 'Cards, door cards, sheets and menus.'),
      col('line', '#dce2ea', '#263243', 'Hairlines, input borders, map grid.'),
      col('ink', '#0f1b2d', '#e8eef6', 'Primary text, on surface and surface-raised (16:1 and up in both themes).'),
      col('ink-muted', '#566476', '#9ba9ba', 'Secondary text, metadata, addresses under owner names; on surface and surface-raised (5.5:1 light, 7:1 dark).'),
      col('deep', '#13294b', '#dce6f5', 'Benchmark navy: brand blocks, the parent app icon, the website header band. Flips to pale in dark so it never sinks into the dark ground.'),
      col('on-deep', '#ffffff', '#0f1b2d', 'Text and the reverse mark on a deep fill.'),
      col('flag', '#d6400c', '#ff7a45', 'Flagging-tape orange: the one action colour (primary buttons, the closing station, focus ring). As text on surface: 5.4:1 light, 8:1 dark.'),
      col('on-flag', '#ffffff', '#1a0d06', 'Labels on a flag fill (4.6:1 light, 7.4:1 dark).'),
      col('flag-soft', '#fde6dc', '#3a1a0c', 'Tinted ground behind flag text: selected rows, the active map pin halo.'),
      col('solar', '#f2a900', null, 'TraverseSolar edition fill: its icon tile, header accent, map pins. Never as text on surface (1.9:1); pair with on-solar.'),
      col('on-solar', '#0f1b2d', null, 'Text and mark on a solar fill (8.6:1).'),
      col('roof', '#4e6680', null, 'TraverseRoof edition fill. White on it: 5.9:1.'),
      col('on-roof', '#ffffff', null, 'Text and mark on a roof fill.'),
      col('pest', '#7a3fa3', null, 'TraversePest edition fill. White on it: 6.9:1. Low against the dark ground (2.7:1): tiles carry a label.'),
      col('on-pest', '#ffffff', null, 'Text and mark on a pest fill.'),
      col('yards', '#2f7a3a', null, 'TraverseYards (landscaping and lawn) edition fill. White on it: 5.3:1.'),
      col('on-yards', '#ffffff', null, 'Text and mark on a yards fill.'),
      col('won', '#1f7a4d', '#5cc98f', 'Pipeline state Won, as chip text and dot; always with the word.'),
      col('won-soft', '#ddf3e7', '#123323', 'Ground behind won text.'),
      col('lost', '#b42318', '#ff8a80', 'Pipeline state Lost and destructive actions; always with the word. Darker than won in light, lighter in dark, so the two differ by more than hue.'),
      col('lost-soft', '#fde4e1', '#3a1512', 'Ground behind lost text.'),
      col('focus', '{flag}', null, 'Keyboard focus ring: a 2px solid flag ring, 2px off the element (4.2:1 on surface).'),
    ],
  },
  type: {
    fonts: [],
    families: {
      display: '"Familjen Grotesk", "Segoe UI", system-ui, sans-serif',
      sans: '"Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
    groups: [
      { name: 'Display', family: 'display', note: 'Familjen Grotesk (Google Fonts). The wordmark, headlines, numbers that matter. Weight 700 for the wordmark, 600 for headings.', styles: [
        { name: 'display-xl', fontSize: '56px', lineHeight: '60px', fontWeight: 700, letterSpacing: '-0.02em', sample: 'Work the territory.', usage: 'Website heroes only.' },
        { name: 'display-l', fontSize: '40px', lineHeight: '44px', fontWeight: 700, letterSpacing: '-0.015em', sample: 'Every door on one map', usage: 'Section openers on the website, empty states in the app.' },
        { name: 'heading', fontSize: '24px', lineHeight: '30px', fontWeight: 600, sample: '1840 Ponderosa Dr', usage: 'Screen titles, the open door card\'s address.' },
      ] },
      { name: 'Text', family: 'sans', note: 'Atkinson Hyperlegible (Google Fonts), drawn for legibility: reps read it in sun, in a truck, with gloves on.', styles: [
        { name: 'body', fontSize: '16px', lineHeight: '24px', fontWeight: 400, sample: 'Mark the door, book the walk, and the office sees it.', usage: 'All running text, in the app and on the site.' },
        { name: 'body-strong', fontSize: '16px', lineHeight: '24px', fontWeight: 700, sample: 'Quote booked', usage: 'Button labels, owner names, the one thing in a row that matters.' },
        { name: 'small', fontSize: '13px', lineHeight: '18px', fontWeight: 400, sample: 'Owner of record · tax bill to Denver, CO', usage: 'Metadata and captions. Never below 13px in the app.' },
      ] },
      { name: 'Data', family: 'mono', note: 'JetBrains Mono for station-style numbers: counts, distances, roof squares, dates in tables.', styles: [
        { name: 'data', fontSize: '13px', lineHeight: '18px', fontWeight: 500, sample: '1.75 in · 12 Oct · 63,033 sq ft', usage: 'Figures in lists and tables, with tabular numerals.' },
      ] },
    ],
  },
  spacing: { tokens: [
    { name: 'space-1', value: '4px', usage: 'Icon-to-label gaps.' },
    { name: 'space-2', value: '8px', usage: 'Inside chips; between a label and its value.' },
    { name: 'space-3', value: '12px', usage: 'Between rows in a list.' },
    { name: 'space-4', value: '16px', usage: 'Card padding; the app\'s side gutter.' },
    { name: 'space-6', value: '24px', usage: 'Between cards and sections.' },
    { name: 'space-8', value: '32px', usage: 'Website section gutters.' },
    { name: 'space-12', value: '48px', usage: 'Website section spacing.' },
  ] },
  radius: { tokens: [
    { name: 'radius-sm', value: '6px', usage: 'Chips, inputs.' },
    { name: 'radius-md', value: '10px', usage: 'Buttons.' },
    { name: 'radius-lg', value: '16px', usage: 'Cards, sheets, blocks.' },
    { name: 'radius-icon', value: '14px', usage: 'App icon tiles at 64px (scale with the tile: 22% of its side).' },
    { name: 'radius-pill', value: '999px', usage: 'Stage chips and map pins.' },
  ] },
  shadow: { tokens: [
    { name: 'shadow-card', value: { light: '0 1px 2px rgba(15,27,45,0.08), 0 6px 16px rgba(15,27,45,0.06)', dark: '0 1px 2px rgba(0,0,0,0.5)' }, usage: 'Door cards and floating sheets; never on chips or buttons.' },
  ] },
};
w('tokens.json', JSON.stringify(tokens, null, 2));

/* ---- shared preview pieces ---- */
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap">';
const page = (marker, title, body, extraCss = '') => `${marker}
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title>${FONTS}<style>${extraCss}</style></head>
<body>
${body}
</body>
</html>
`;
// the mark inline, coloured by tokens
const mk = (size, line = 'var(--deep)', end = 'var(--flag)', hole = 'var(--surface-raised)') => `<svg class="tv-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${mark({ line, end, hole })}</svg>`;
const ic = (size, bg, line, end) => `<svg class="tv-icon" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${icon(bg, line, end)}</svg>`;
const EDITIONS = [
  { key: 'Solar', bg: 'var(--solar)', fg: 'var(--on-solar)', dom: 'traversesolar.app', who: 'Solar sales: homeowners, roof fit, utility bills.' },
  { key: 'Roof', bg: 'var(--roof)', fg: 'var(--on-roof)', dom: 'traverseroof.app', who: 'Roofing: storm days, hail at the house, roof size and material.' },
  { key: 'Pest', bg: 'var(--pest)', fg: 'var(--on-pest)', dom: 'traversepest.app', who: 'Pest control: routes, recurring plans, seasons.' },
  { key: 'Yards', bg: 'var(--yards)', fg: 'var(--on-yards)', dom: 'traverseyards.app', who: 'Landscaping and lawn care: lawn size, water rules, monthly plans.' },
];

/* ---- bundle.css: the shared component styles ---- */
w('components/bundle.css', `body { margin: 0; font-family: var(--font-sans); background: var(--surface); color: var(--ink); -webkit-font-smoothing: antialiased; }
.tv-row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; padding: var(--space-4); }
.tv-stack { display: grid; gap: var(--space-3); padding: var(--space-4); }
.tv-wordmark { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: var(--ink); }
.tv-edition { font-family: var(--font-display); font-weight: 500; letter-spacing: -0.01em; }
.tv-lockup { display: inline-flex; align-items: center; gap: 0.32em; }
.tv-mark, .tv-icon { display: block; flex: none; }
.tv-btn { font: 700 16px/1 var(--font-sans); height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1.5px solid var(--line); background: var(--surface-raised); color: var(--ink); cursor: pointer; display: inline-flex; align-items: center; gap: var(--space-2); }
.tv-btn-primary { background: var(--flag); border-color: var(--flag); color: var(--on-flag); }
.tv-btn-deep { background: transparent; border-color: var(--deep); color: var(--deep); }
.tv-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.tv-chip { display: inline-flex; align-items: center; gap: 6px; font: 700 13px/1 var(--font-sans); height: 28px; padding: 0 var(--space-3); border-radius: var(--radius-pill); background: var(--surface); color: var(--ink); border: 1px solid var(--line); }
.tv-chip::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; opacity: .9; }
.tv-chip-new { color: var(--ink-muted); }
.tv-chip-walk { background: var(--flag-soft); border-color: transparent; color: var(--flag); }
.tv-chip-quoted { background: var(--deep); border-color: transparent; color: var(--on-deep); }
.tv-chip-won { background: var(--won-soft); border-color: transparent; color: var(--won); }
.tv-chip-lost { background: var(--lost-soft); border-color: transparent; color: var(--lost); }
.tv-card { background: var(--surface-raised); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--space-4); }
.tv-muted { color: var(--ink-muted); }
.tv-data { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 13px; }
`);

/* ---- components ---- */
const comp = (name, readme, preview) => { w(`components/${name}/README.md`, readme); w(`components/${name}/preview.html`, preview); };

comp('Logo', `# Logo

The Traverse mark is a surveyor's traverse: three measured legs between stations, ending at a flag-orange closing station. Use \`traverse-mark-color.svg\` on light grounds and \`traverse-mark-reverse.svg\` on \`deep\`.

- **Lockup:** the mark, then the wordmark "Traverse" in \`display\` 700, the mark's height equal to the wordmark's cap height × 1.6, gap 0.32em.
- **Clear space:** one closing-station diameter (a quarter of the mark's width) on every side.
- **Minimum size:** mark 20px; lockup 96px wide. Below that, the mark alone.
- **The close is always flag orange** on the colour and reverse marks. One-colour work uses \`traverse-mark-navy.svg\`, close included.
- **Don't:** recolour the legs outside the three files, rotate or flip the traverse (it rises left to right), add a fourth leg, fill the open stations solid (they are rings, like stops on a route map; a solid line of dots reads as a stock chart), put the colour mark on photography.
`, page('<!-- @dsCard group="Brand" height=280 subtitle="Mark, lockup, reverse, clear space" -->', 'Logo', `
<div class="lg">
  <div class="cell"><span class="tv-lockup" style="font-size:44px">${mk(70)}<span class="tv-wordmark">Traverse</span></span><small>Primary lockup on surface</small></div>
  <div class="cell dk"><span class="tv-lockup" style="font-size:44px">${mk(70, 'var(--on-deep)', 'var(--flag)', 'var(--deep)')}<span class="tv-wordmark" style="color:var(--on-deep)">Traverse</span></span><small style="color:var(--on-deep)">Reverse on deep</small></div>
  <div class="cell"><div class="space">${mk(96)}</div><small>Clear space: one closing station all round</small></div>
  <div class="cell sizes">${mk(20)}${mk(32)}${mk(48)}<small>Mark at 20, 32 and 48px</small></div>
</div>`, `.lg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-3);padding:var(--space-4)}
.cell{background:var(--surface-raised);border-radius:var(--radius-lg);padding:var(--space-6);display:grid;gap:var(--space-3);align-content:center;justify-items:start;min-height:84px}
.cell small{font-size:13px;color:var(--ink-muted)}
.dk{background:var(--deep)}
.space{outline:1.5px dashed var(--line);outline-offset:24px;margin:24px}
.sizes{grid-auto-flow:column;justify-content:start;align-items:end;gap:var(--space-4)}
.sizes small{grid-column:1/-1}`));

comp('Editions', `# Editions

Traverse is one product with an edition per trade. An edition is named "Traverse" plus one trade word, joined and title-cased: TraverseSolar, TraverseRoof, TraversePest, TraverseYards. The same form is the domain: \`traverse<trade>.app\`.

- **The parent** is Traverse Platforms (the company) at traverseplatforms.com: the site that explains the product and sends people to their edition.
- **An edition's colour** (\`solar\`, \`roof\`, \`pest\`, \`yards\`) fills its icon tile and accents its header and map pins. Flag orange stays the action colour in every edition: a primary button is flag in TraverseSolar too.
- **Lockup:** the edition's icon tile, "Traverse" in \`display\` 700, the trade word in \`display\` 500, in \`ink\`. The trade word never takes the edition colour as text (solar fails on a light ground).
- **A new edition** gets one trade word and one colour that differs from the others in lightness as well as hue, with its \`on-\` colour at 4.5:1 or better.
`, page('<!-- @dsCard group="Brand" height=330 subtitle="The parent and the trade editions" -->', 'Editions', `
<div class="ed">
  <div class="parent"><span class="tv-lockup" style="font-size:34px">${ic(52, 'var(--deep)', 'var(--on-deep)', 'var(--flag)')}<span><span class="tv-wordmark">Traverse</span> <span class="tv-edition">Platforms</span></span></span><span class="tv-data tv-muted">traverseplatforms.com</span></div>
  ${EDITIONS.map((e) => `<div class="one"><span class="tv-lockup" style="font-size:26px">${ic(40, e.bg, e.fg, e.fg)}<span><span class="tv-wordmark">Traverse</span><span class="tv-edition">${e.key}</span></span></span><span class="tv-data tv-muted">${e.dom}</span><small>${e.who}</small></div>`).join('')}
</div>`, `.ed{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-3);padding:var(--space-4)}
.parent{grid-column:1/-1;background:var(--surface-raised);border-radius:var(--radius-lg);padding:var(--space-4) var(--space-6);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-3)}
.one{background:var(--surface-raised);border-radius:var(--radius-lg);padding:var(--space-4);display:grid;gap:6px;align-content:start}
.one small{font-size:13px;line-height:18px;color:var(--ink-muted)}`));

comp('AppIcon', `# App icon

The home-screen icon. The parent icon is the reverse mark on \`deep\` with the flag-orange close; each edition's is its mark in its \`on-\` colour on its edition colour. Tile corners are \`radius-icon\` (22% of the side); the mark sits at 73% of the tile, centred. Use the SVGs in Logos; export PNGs from them at 180, 192 and 512px.
`, page('<!-- @dsCard group="Brand" height=170 subtitle="Parent and editions on a home screen" -->', 'App icon', `
<div class="home">
  <figure>${ic(64, 'var(--deep)', 'var(--on-deep)', 'var(--flag)')}<figcaption>Traverse</figcaption></figure>
  ${EDITIONS.map((e) => `<figure>${ic(64, e.bg, e.fg, e.fg)}<figcaption>${e.key}</figcaption></figure>`).join('')}
</div>`, `.home{display:flex;flex-wrap:wrap;gap:var(--space-6);padding:var(--space-6)}
figure{margin:0;display:grid;justify-items:center;gap:var(--space-2)}
figcaption{font-size:13px;color:var(--ink)}`));

comp('Button', `# Button

Flag (\`tv-btn-primary\`) is for the one thing the screen is for, at most once per view: "Quote booked", "Book a demo". Deep outline (\`tv-btn-deep\`) for the second choice; plain (\`tv-btn\`) for the rest. Labels are a verb first, sentence case, \`body-strong\`. Height 44px: a gloved thumb hits it.
`, page('<!-- @dsCard group="Product" height=84 -->', 'Button', `
<div class="tv-row"><button class="tv-btn tv-btn-primary" type="button">Quote booked</button><button class="tv-btn tv-btn-deep" type="button">Not now</button><button class="tv-btn" type="button">No answer</button></div>`));

comp('StageChip', `# Stage chip

Where a lead sits in the pipeline: New, Walk booked, Quoted, Won, Lost. Every chip carries its word: colour never stands alone (won and lost also differ in lightness). Use \`tv-chip\` plus one state class.
`, page('<!-- @dsCard group="Product" height=72 -->', 'Stage chip', `
<div class="tv-row"><span class="tv-chip tv-chip-new">New</span><span class="tv-chip tv-chip-walk">Walk booked</span><span class="tv-chip tv-chip-quoted">Quoted</span><span class="tv-chip tv-chip-won">Won</span><span class="tv-chip tv-chip-lost">Lost</span></div>`));

comp('DoorCard', `# Door card

The card a rep sees at the door: the address in \`heading\`, the owner and what we know, the pipeline chip, the three outcomes as buttons. On \`surface-raised\` with \`shadow-card\`. The example shows TraverseRoof: the edition colour appears only as the thin header rule and the hail figure's icon, never as a fill behind text.
`, page('<!-- @dsCard group="Product" height=420 width=420 subtitle="TraverseRoof, at the door" -->', 'Door card', `
<div class="wrap"><div class="tv-card door">
  <div class="top"><span class="tv-chip tv-chip-walk">Walk booked</span><span class="tv-data tv-muted">0.4 mi</span></div>
  <h1>1840 Ponderosa Dr</h1>
  <p class="tv-muted own">Owner of record · Castle Rock, CO</p>
  <dl>
    <div><dt>Roof</dt><dd class="tv-data">31 sq · asphalt · 2009</dd></div>
    <div><dt>Hail at the house</dt><dd class="tv-data"><span class="dot"></span>1.75 in · 23 Jun 2026</dd></div>
    <div><dt>Wind</dt><dd class="tv-data">72 mph · 3 mi away</dd></div>
  </dl>
  <div class="acts"><button class="tv-btn tv-btn-primary" type="button">Quote booked</button><button class="tv-btn tv-btn-deep" type="button">Not now</button><button class="tv-btn" type="button">No answer</button></div>
</div></div>`, `.wrap{padding:var(--space-4)}
.door{border-top:4px solid var(--roof);display:grid;gap:var(--space-2)}
.top{display:flex;justify-content:space-between;align-items:center}
h1{font:600 24px/30px var(--font-display);margin:var(--space-1) 0 0}
.own{margin:0;font-size:13px}
dl{margin:var(--space-2) 0;display:grid;gap:var(--space-2)}
dl div{display:flex;justify-content:space-between;gap:var(--space-3);border-bottom:1px solid var(--line);padding-bottom:var(--space-2)}
dt{font-size:13px;color:var(--ink-muted)} dd{margin:0;display:flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--roof)}
.acts{display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-2)}`));

comp('WebsiteHero', `# Website hero

The top of traverseplatforms.com: the parent lockup, one plain headline in \`display-xl\`, one sentence that names doors, phones and appointments and the trades, one flag button and one deep outline button, and the editions underneath, each linking to its \`.app\`. The art is the traverse itself drawn across a faint map grid in \`line\`. No invented customer counts or results.
`, page('<!-- @dsCard group="Product" height=560 width=960 subtitle="traverseplatforms.com, top of the page" -->', 'Website hero', `
<div class="site">
  <nav><span class="tv-lockup" style="font-size:22px">${ic(32, 'var(--deep)', 'var(--on-deep)', 'var(--flag)')}<span><span class="tv-wordmark">Traverse</span> <span class="tv-edition">Platforms</span></span></span><span class="links"><span>Product</span><span>Trades</span><span>Pricing</span><span>Sign in</span></span></nav>
  <section class="hero">
    <div class="copy">
      <h1>Work the territory. Close the deal.</h1>
      <p>Traverse runs field sales from the first knock to the signed job: doors, phone calls, appointments and the pipeline in one app, with an edition built for your trade.</p>
      <div class="cta"><button class="tv-btn tv-btn-primary" type="button">Book a demo</button><button class="tv-btn tv-btn-deep" type="button">Find your edition</button></div>
    </div>
    <svg class="art" viewBox="0 0 380 300" aria-hidden="true">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${20 + i * 42}" y1="10" x2="${20 + i * 42}" y2="290" class="g"/>`).join('')}
      ${Array.from({ length: 7 }, (_, i) => `<line x1="10" y1="${20 + i * 44}" x2="370" y2="${20 + i * 44}" class="g"/>`).join('')}
      <polyline points="40,250 140,140 230,190 340,50" class="leg"/>
      <circle cx="40" cy="250" r="11" class="stn"/><circle cx="140" cy="140" r="11" class="stn"/><circle cx="230" cy="190" r="11" class="stn"/>
      <circle cx="340" cy="50" r="16" class="cls"/>
    </svg>
  </section>
  <div class="eds">${EDITIONS.map((e) => `<div class="ed">${ic(36, e.bg, e.fg, e.fg)}<span><b>Traverse${e.key}</b><small class="tv-data">${e.dom}</small></span></div>`).join('')}</div>
</div>`, `.site{background:var(--surface);min-height:560px}
nav{display:flex;justify-content:space-between;align-items:center;padding:var(--space-4) var(--space-8);border-bottom:1px solid var(--line);background:var(--surface-raised)}
.links{display:flex;gap:var(--space-6);font-weight:700;font-size:15px}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:var(--space-8);align-items:center;padding:var(--space-12) var(--space-8) var(--space-6)}
h1{font:700 56px/60px var(--font-display);letter-spacing:-.02em;margin:0;text-wrap:balance}
.copy p{font-size:18px;line-height:28px;color:var(--ink-muted);max-width:46ch;margin:var(--space-4) 0 var(--space-6)}
.cta{display:flex;gap:var(--space-3)}
.art{width:100%;height:auto}
.g{stroke:var(--line);stroke-width:1}
.leg{fill:none;stroke:var(--deep);stroke-width:12;stroke-linecap:round;stroke-linejoin:round}
.stn{fill:var(--surface);stroke:var(--deep);stroke-width:8} .cls{fill:var(--flag)}
.eds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space-3);padding:0 var(--space-8) var(--space-8)}
.ed{display:flex;align-items:center;gap:var(--space-3);background:var(--surface-raised);border-radius:var(--radius-lg);padding:var(--space-3) var(--space-4)}
.ed span{display:grid;gap:2px} .ed b{font:700 16px/1.2 var(--font-display)} .ed small{color:var(--ink-muted)}`));

/* ---- cover ---- */
const dots = [];
for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) dots.push(`<circle class="grid" cx="${215 + i * 30}" cy="${74 + j * 30}" r="1.75"/>`);
w('components/Cover/preview.html', `<!-- @dsCard height=288 -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Traverse</title>
${FONTS}
<style>
  html, body { margin:0; height:100%; }
  body { background:var(--surface); color:var(--ink); font-family:var(--font-sans); overflow:hidden; }
  .cover { position:relative; height:288px; overflow:hidden; }
  .art { position:absolute; top:0; left:480px; width:480px; height:288px; overflow:hidden; }
  .art svg { display:block; width:480px; height:288px; }
  .flag { fill:var(--flag); } .deep { fill:var(--deep); } .solar { fill:var(--solar); } .yards { fill:var(--yards); } .roof { fill:var(--roof); }
  .blk { rx:var(--radius-lg); } .sat { rx:var(--radius-md); }
  .cut { fill:var(--surface); }
  .grid { fill:var(--on-deep); }
  .leg { fill:none; stroke:var(--on-deep); stroke-width:7; stroke-linecap:round; stroke-linejoin:round; }
  .stn { fill:var(--deep); stroke:var(--on-deep); stroke-width:4; }
  .cls { fill:var(--flag); stroke:var(--on-deep); stroke-width:3; }
  .words { position:absolute; left:var(--space-6); right:var(--space-6); bottom:var(--space-6); max-width:440px; }
  .name { margin:0; font-family:var(--font-display); font-size:88px; line-height:.92; font-weight:700; letter-spacing:-.025em; color:var(--ink); }
  .tag { margin:var(--space-2) 0 0 3px; font-size:14px; line-height:20px; color:var(--ink-muted); }
</style>
</head>
<body>
<div class="cover">
<div class="art" aria-hidden="true">
<svg viewBox="0 0 480 288" width="480" height="288">
<!--
  blocks      flag 160×232 slab bled off the top (the action colour people remember) · deep 200×208 (benchmark navy, flips pale in dark) · yards 80×128 bleeding off the right · solar 56×40 and roof 88×40 satellites under the slab — five colours, ≈36% of 960×288
  arrangement one tall flag slab with satellites, deep block beside it carrying the traverse, bottoms on one line space-6 above the edge, space-4 gutters
  pattern     a literal motif, from "a surveyor's traverse: legs between stations": one three-leg traverse in on-deep across the deep block over a 7×7 station grid at a 30px pitch; three surface-coloured stations cut into the flag slab
  scales      sides in space-2 multiples; gutters space-4; corners radius-lg for blocks, radius-md for satellites; station discs at the mark's proportions
-->
<rect class="flag blk" x="24" y="-16" width="160" height="232" rx="16"/>
<circle class="cut" cx="64" cy="168" r="6"/><circle class="cut" cx="104" cy="120" r="6"/><circle class="cut" cx="144" cy="72" r="6"/>
<rect class="solar sat" x="24" y="232" width="56" height="40" rx="10"/>
<rect class="roof sat" x="96" y="232" width="88" height="40" rx="10"/>
<rect class="deep blk" x="200" y="56" width="200" height="216" rx="16"/>
${dots.join('\n')}
<polyline class="leg" points="226,240 278,168 326,198 374,98"/>
<circle class="stn" cx="226" cy="240" r="6"/><circle class="stn" cx="278" cy="168" r="6"/><circle class="stn" cx="326" cy="198" r="6"/>
<circle class="cls" cx="374" cy="98" r="10"/>
<rect class="yards blk" x="416" y="136" width="88" height="136" rx="16"/>
</svg>
</div>
<div class="words">
<h1 class="name">Traverse</h1>
<p class="tag">Field sales, from the first door to the signed job.</p>
</div>
</div>
</body>
</html>
`);

/* ---- README: the brand book ---- */
w('README.md', `Traverse is field sales software: a rep's doors, phone calls, appointments and pipeline in one app, with an edition for each trade. The company is **Traverse Platforms**; traverseplatforms.com explains the product, and each edition lives at its own \`traverse<trade>.app\` (TraverseSolar, TraverseRoof, TraversePest, TraverseYards).

## The idea

A traverse is the surveyor's way across a territory: measured legs from station to station until the line closes. That is a rep's day, door to door, and a deal's path, stage to stage. The mark is that line: three legs, four stations, rising left to right, the last station in flagging-tape orange, the colour surveyors tie on a stake to say *here*.

## Voice

- Plain and field-tested. Short sentences, verbs first: "Mark the door. Book the walk."
- Say what the app does, never what it will do for a business: no invented results, counts or percentages.
- Name trades and real tasks: "hail at the house", "roof squares", "monthly plan", "come back in spring".
- Sentence case for headings and buttons. No exclamation marks, no emoji.
- One sentence per idea; don't add a sentence explaining why the last one mattered.

## Visual foundations

**Colour.** Grounds are \`surface\` (the map table) and \`surface-raised\` (cards). Text is \`ink\`, secondary \`ink-muted\`. \`deep\` (benchmark navy) is the brand's weight: header bands, the parent icon, large blocks; it flips pale in dark so it never sinks into the dark ground, and anything on it is \`on-deep\`. \`flag\` is the only action colour: primary buttons, the closing station, the focus ring; never decoration. Edition colours (\`solar\`, \`roof\`, \`pest\`, \`yards\`) fill tiles, pins and thin header rules in their edition, always with their \`on-\` colour; never as text on a surface. Pipeline states use \`won\` / \`lost\` with their \`-soft\` grounds, always with the word.

**Type.** \`display\` (Familjen Grotesk) for the wordmark, headlines and numbers that matter; \`sans\` (Atkinson Hyperlegible) for everything read, chosen because reps read in sun and in trucks; \`mono\` (JetBrains Mono) for figures in lists: distances, dates, roof squares, hail sizes. Never below 13px in the app.

**Shape.** Cards and blocks \`radius-lg\`, buttons \`radius-md\`, chips and pins \`radius-pill\`. Cards carry \`shadow-card\`; chips and buttons are flat. Spacing steps \`space-1\` to \`space-12\`; the app's gutter is \`space-4\`.

**Layout.** The map comes first; lists and cards sit over it. One primary (flag) button per view. Buttons are 44px tall.

**Focus.** Keyboard focus is a solid 2px \`focus\` (flag) ring, 2px off the element: 4.2:1 on \`surface\`.

**Imagery.** Real work photographed on site, never stock people. Maps and aerials are welcome; the traverse can be drawn over them in \`deep\` with the flag close.

## Logo and editions

Use the files in Logos. The colour mark on light grounds, the reverse on \`deep\`, the navy mark for one-colour work. The close stays flag orange on the colour and reverse marks. Clear space is one closing station; minimum 20px for the mark, 96px for a lockup. Edition lockups pair the edition's icon tile with "Traverse" + the trade word (see the Editions component).

## Iconography

Line icons at 2px stroke with round caps and joins, matching the traverse. Filled only for states (a booked door, a won deal). No emoji.
`);

console.log('written to', ROOT);
console.log(Object.keys(ASSETS).length, 'svg assets');

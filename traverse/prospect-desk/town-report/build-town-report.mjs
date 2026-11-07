// Traverse one-page town report (lawn | roofing) -> HTML -> PDF + PNG preview via headless Chrome.
// Usage: node build-town-report.mjs --town castle-rock --trade lawn
//        node build-town-report.mjs --all --trade roofing
// Read-only on all data. Writes only into ./out and ./_render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRAVERSE = path.resolve(HERE, '../..');
const LAWN_DIR = path.join(TRAVERSE, 'app/data/rounds');
const ROOF_DIR = path.join(TRAVERSE, 'editions/dist/traverse-data/rounds');
const MAP_DIR = path.join(TRAVERSE, 'prospect-desk/app/m');
const OUT = path.join(HERE, 'out');
const RENDER = path.join(HERE, '_render');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const LARGE_SQ = 5000;        // same threshold the prospect emails use
const HAIL_MIN_IN = 1.0;
const HAIL_MONTHS = 24;
const OLD_BUILT_YEARS = 20;

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : (args[i + 1] ?? true); };
const trade = opt('trade');
if (!['lawn', 'roofing'].includes(trade)) { console.error('--trade lawn|roofing required'); process.exit(1); }
const all = args.includes('--all');
const noRender = args.includes('--no-render'); // stats + town-stats.json only, no PDF/PNG
const town = opt('town');
if (!all && !town) { console.error('give --town <key> or --all'); process.exit(1); }

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const exists = (f) => fs.existsSync(f);
const fmt = (n) => Number(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateLong = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const dateMY = (iso) => { const [y, m] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

// ---------- street names: no house numbers ----------
const SUFFIX = new Set('ST AVE RD DR LN CT PL WAY CIR BLVD TRL PKWY LOOP TER PT RUN ROW PATH TRAIL ROAD DRIVE LANE COURT PLACE CIRCLE STREET AVENUE BEND CV CRK GLN HTS PASS RDG VW VIEW XING ALY'.split(' '));
function cleanStreet(name) {
  let s = name.trim().replace(/\s+/g, ' ');
  // "TWIN OAKS RD 189–237" / "DILLON DR 321" -> strip trailing house-number range
  const m = s.match(/^(.*?)\s+\d+(?:\s*[–-]\s*\d+)?$/);
  if (m) {
    const lastTok = m[1].split(' ').pop();
    if (/[–-]/.test(s.slice(m[1].length)) || SUFFIX.has(lastTok)) s = m[1];
  }
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(N|S|E|W|Ne|Nw|Se|Sw)\b/g, (c) => c.toUpperCase()).replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase());
}
const modeOf = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

// ---------- towns our data splits into parts (6 Nov: Colorado Springs is four quarters; prospects name the city) ----------
const COMBOS = { 'colorado-springs': { label: 'Colorado Springs', parts: ['cs-northeast', 'cs-northwest', 'cs-southeast', 'cs-southwest'] } };
function combined(key, dir, prefix) {   // one virtual town file from its parts: areas end to end, the oldest date wins
  const c = COMBOS[key]; const files = c.parts.map((p) => path.join(dir, prefix + p + '.json'));
  if (!files.every(exists)) return null;
  const js = files.map(readJSON);
  if (!prefix) return { label: c.label, built: js.map((j) => j.built).sort()[0], areas: js.flatMap((j) => j.areas || []) };
  return { through: js.map((j) => j.through).filter(Boolean).sort()[0], doors: Object.assign({}, ...js.map((j) => j.doors || {})) };
}

// ---------- lawn ----------
function lawnStats(key) {
  const f = path.join(LAWN_DIR, key + '.json');
  if (!COMBOS[key] && !exists(f)) return null;
  const j = COMBOS[key] ? combined(key, LAWN_DIR, '') : readJSON(f);
  if (!j || !Array.isArray(j.areas)) return null;
  const streets = new Map();
  let homes = 0, withLawn = 0, large = 0;
  for (const a of j.areas) {
    const st = cleanStreet(a.name);
    const nb = a.place && a.place.n ? a.place.n : '';
    for (const d of a.doors) {
      homes++;
      if (!d.lawn || typeof d.lawn.sq !== 'number') continue;
      withLawn++;
      if (d.lawn.sq < LARGE_SQ) continue;
      large++;
      const key2 = st + '|' + nb; // same street name in different neighbourhoods stays separate
      const e = streets.get(key2) ?? { street: st, nb, n: 0, sum: 0 };
      e.n++; e.sum += d.lawn.sq; streets.set(key2, e);
    }
  }
  const rows = [...streets.values()].sort((a, b) => b.n - a.n || a.street.localeCompare(b.street))
    .map((e) => ({ street: e.street, nb: e.nb, n: e.n, avg: Math.round(e.sum / e.n / 100) * 100 }));
  return { label: j.label, built: j.built, homes, withLawn, large, nStreets: rows.length, rows: rows.slice(0, 10), all: rows };
}

// ---------- roofing ----------
function roofStats(key) {
  const f = path.join(ROOF_DIR, key + '.json'), hf = path.join(ROOF_DIR, 'hail-' + key + '.json');
  if (!COMBOS[key] && (!exists(f) || !exists(hf))) return null;
  const j = COMBOS[key] ? combined(key, ROOF_DIR, '') : readJSON(f), h = COMBOS[key] ? combined(key, ROOF_DIR, 'hail-') : readJSON(hf);
  if (!j || !h || !Array.isArray(j.areas) || !h.doors) return null;
  const yf = path.join(ROOF_DIR, 'year-' + key + '.json');
  const years = COMBOS[key] ? (COMBOS[key].parts.every((p) => exists(path.join(ROOF_DIR, 'year-' + p + '.json'))) ? combined(key, ROOF_DIR, 'year-').doors : null)
    : exists(yf) ? readJSON(yf).doors : null;
  const through = h.through;
  const cut = new Date(through + 'T00:00:00Z'); cut.setUTCMonth(cut.getUTCMonth() - HAIL_MONTHS);
  const from = cut.toISOString().slice(0, 10);
  const oldBuiltMax = Number(through.slice(0, 4)) - OLD_BUILT_YEARS;
  const streets = new Map(); const dates = new Map();
  let homes = 0, hit = 0, hitOld = 0, yearKnown = 0;
  for (const a of j.areas) {
    const st = cleanStreet(a.name); const nb = a.place && a.place.n ? a.place.n : '';
    for (const d of a.doors) {
      homes++;
      const ev = h.doors[d.id]; if (!ev) continue;
      const hits = ev.filter(([dt, sz]) => dt > from && dt <= through && sz >= HAIL_MIN_IN);
      if (!hits.length) continue;
      hit++;
      for (const [dt, sz] of hits) { const e = dates.get(dt) ?? { n: 0, max: 0 }; e.n++; e.max = Math.max(e.max, sz); dates.set(dt, e); }
      let yb = null;
      if (years && years[d.id]) { try { const y = typeof years[d.id] === 'string' ? JSON.parse(years[d.id]) : years[d.id]; if (y.yb > 1800) yb = y.yb; } catch {} }
      if (yb) yearKnown++;
      const old = yb && yb <= oldBuiltMax ? 1 : 0; hitOld += old;
      const k2 = st + '|' + nb;
      const e = streets.get(k2) ?? { street: st, nb, n: 0, old: 0, biggest: 0 };
      e.n++; e.old += old; e.biggest = Math.max(e.biggest, ...hits.map((x) => x[1])); streets.set(k2, e);
    }
  }
  const rows = [...streets.values()].sort((a, b) => b.n - a.n || a.street.localeCompare(b.street));
  const storms = [...dates.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([dt, e]) => ({ dt, n: e.n, max: e.max }));
  return { label: j.label, built: j.built, through, from, homes, hit, hitOld, yearKnown, hasYears: !!years, oldBuiltMax,
    nStreets: rows.length, rows: rows.slice(0, 10), all: rows, storms };
}

// ---------- html ----------
const LOGO = `<svg width="40" height="40" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#13294b"/><g transform="translate(8.5 8.5) scale(0.734)"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="47" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/><circle cx="37" cy="40" r="5.2" fill="#13294b" stroke="#fff" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="#d6400c"/></g></svg>`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@500;600;700&display=swap');
@page{size:8.5in 11in;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{width:8.5in;height:11in;overflow:hidden;background:#fff;color:#0f1b2d;font-family:'Atkinson Hyperlegible',system-ui,'Segoe UI',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;padding:.5in .55in .4in;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:10px;font-family:'Familjen Grotesk',sans-serif;font-size:19px;letter-spacing:-.02em;color:#13294b}
.brand b{font-weight:700}.brand span{font-weight:500}
.rule{height:3px;background:#d6400c;width:56px;margin:16px 0 12px;border-radius:2px}
h1{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:29px;line-height:1.1;letter-spacing:-.02em;margin:0;color:#13294b}
.sub{margin:6px 0 0;color:#566476;font-size:13px}
.top{display:flex;gap:16px;margin-top:16px;align-items:stretch}
.map{flex:0 0 4.75in;border:1px solid #dce2ea;border-radius:10px;overflow:hidden;background:#f4f6f9;display:flex;flex-direction:column}
.map .crop{width:100%;aspect-ratio:840/504;overflow:hidden;position:relative}
.map img{width:100%;display:block;position:absolute;top:0;left:0}
.map .cap{flex:1;padding:6px 10px;font-size:11px;color:#566476;border-top:1px solid #dce2ea;background:#fff}
.stats{flex:1;display:flex;flex-direction:column;gap:10px}
.stat{flex:1;background:#f4f6f9;border:1px solid #dce2ea;border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;justify-content:center}
.stat .n{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:30px;line-height:1;color:#13294b;letter-spacing:-.02em}
.stat .n em{font-style:normal;color:#d6400c}
.stat .l{margin-top:4px;font-size:12px;line-height:1.3;color:#566476}
.nomap .stats{flex-direction:row}
h2{font-family:'Familjen Grotesk',sans-serif;font-size:16px;margin:18px 0 7px;color:#13294b;letter-spacing:-.01em}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{background:#13294b;color:#fff;text-align:left;font-weight:700;padding:6px 10px;font-size:11.5px}
th.r,td.r{text-align:right}
td{padding:5.5px 10px;border-bottom:1px solid #dce2ea}
tr:nth-child(even) td{background:#f4f6f9}
td.rk{width:28px;color:#d6400c;font-weight:700}
td.st{font-weight:700}
td.nb{color:#566476}
.note{margin-top:6px;font-size:10.5px;color:#566476}
.foot{margin-top:auto;background:#13294b;color:#fff;border-radius:10px;padding:13px 18px}
.foot .a{font-family:'Familjen Grotesk',sans-serif;font-weight:700;font-size:16px}
.foot .b{margin-top:4px;font-size:12.5px;color:#c9d6ea}
.foot b{color:#fff}
`;

function mapBlock(key, kind, cityMaps, caption) {
  const m = cityMaps?.[key]?.[kind];
  if (!m) return null;
  const src = path.join(MAP_DIR, m.f);
  if (!exists(src)) return null;
  // the picture file carries a source strip along its bottom edge; crop it off (visible area = top 504 of 588 px)
  return `<div class="map"><div class="crop"><img src="${pathToFileURL(src).href}" alt=""></div><div class="cap">${esc(caption)}</div></div>`;
}

function cityMaps() {
  const f = path.join(MAP_DIR, 'maps.json');
  if (!exists(f)) return {};
  const j = readJSON(f);
  const out = {};
  for (const [k, c] of Object.entries(j.cities || {})) out[k] = c;
  for (const [k, c] of Object.entries(j.cities || {})) for (const kk of c.keys || []) out[kk] ??= c;
  return out;
}

function page({ title, sub, mapHtml, stats, tableHead, tableRows, note, tableTitle }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="page">
<div class="brand">${LOGO}<div><b>Traverse</b> <span>Platforms</span></div></div>
<div class="rule"></div>
<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>
<div class="top ${mapHtml ? '' : 'nomap'}">${mapHtml || ''}<div class="stats">${stats.map((s) => `<div class="stat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('')}</div></div>
<h2>${esc(tableTitle)}</h2>
<table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table>
<div class="note">${note}</div>
<div class="foot"><div class="a">See every street and every house in the app.</div><div class="b">15-minute demo: <b>traverseplatforms.com/demo</b> &nbsp;·&nbsp; Matthew Sharpe &nbsp;·&nbsp; (303) 596-9515 &nbsp;·&nbsp; Traverse Platforms</div></div>
</div></body></html>`;
}

function buildLawn(key, maps) {
  const s = lawnStats(key);
  if (!s) return { skip: 'no lawn round file' };
  if (s.withLawn < 50) return { skip: 'fewer than 50 homes with a lawn size' };
  if (s.rows.length < 5) return { skip: `only ${s.rows.length} streets with a large lawn` };
  const pct = Math.round((s.large / s.withLawn) * 100);
  const hasNb = s.rows.some((r) => r.nb);
  const rows = s.rows.map((r, i) => `<tr><td class="rk">${i + 1}</td><td class="st">${esc(r.street)}</td>${hasNb ? `<td class="nb">${esc(r.nb || '')}</td>` : ''}<td class="r">${fmt(r.n)}</td><td class="r">${fmt(r.avg)} sq ft</td></tr>`).join('');
  const html = page({
    title: `${s.label}: your best streets for lawn care`,
    sub: `The ten streets with the most large lawns (5,000 sq ft or more). Data as of ${dateLong(s.built)}.`,
    mapHtml: mapBlock(key, 'lawn', maps, `${s.label}: where the large lawns are. Darker green means more of them.`),
    stats: [
      { n: fmt(s.homes), l: `homes in Traverse's map of ${esc(s.label)}` },
      { n: `<em>${fmt(s.large)}</em>`, l: `homes with a lawn of 5,000 sq ft or more (${pct}% of homes with a measured lawn)` },
      { n: fmt(s.nStreets), l: `streets with at least one large lawn` },
    ],
    tableTitle: 'Top 10 streets by number of large lawns',
    tableHead: `<th></th><th>Street</th>${hasNb ? '<th>Neighbourhood</th>' : ''}<th class="r">Large lawns</th><th class="r">Average large lawn</th>`,
    tableRows: rows,
    note: 'Large lawn = estimated lawn area of 5,000 sq ft or more. Counts and averages are from Traverse\'s map of Colorado homes; no individual home is shown here.',
  });
  return { html, stat: { town: key, label: s.label, trade: 'lawn', homes: s.homes, headline: s.large, headlineMeans: 'homes with a lawn of 5,000 sq ft or more', window: null, topStreet: s.rows[0].street, topStreetCount: s.rows[0].n, dataDate: s.built }, summary: { homes: s.homes, large: s.large, top: s.rows.slice(0, 3), built: s.built, hasMap: !!mapBlock(key, 'lawn', maps, '') } };
}

function buildRoof(key, maps) {
  const s = roofStats(key);
  if (!s) return { skip: 'no hail file' };
  if (s.rows.length < 5) return { skip: `only ${s.rows.length} streets with hail 1 in or larger` };
  const showOld = s.hasYears && s.yearKnown >= s.hit * 0.5;
  const hasNb = s.rows.some((r) => r.nb);
  const rows = s.rows.map((r, i) => `<tr><td class="rk">${i + 1}</td><td class="st">${esc(r.street)}</td>${hasNb ? `<td class="nb">${esc(r.nb || '')}</td>` : ''}<td class="r">${fmt(r.n)}</td><td class="r">${r.biggest.toFixed(2).replace(/0$/, '')} in</td>${showOld ? `<td class="r">${fmt(r.old)}</td>` : ''}</tr>`).join('');
  const st = s.storms;
  const stormTxt = st.length ? st.map((x) => `${dateLong(x.dt)} (${fmt(x.n)} homes)`).join('<br>') : 'None in this window';
  const pct = ((s.hit / s.homes) * 100);
  const html = page({
    title: `${s.label}: your best streets for roofing`,
    sub: `The ten streets with the most homes under hail of 1 inch or larger, ${dateMY(s.from)} to ${dateMY(s.through)}. Data as of ${dateLong(s.built)}.`,
    mapHtml: mapBlock(key, 'hail', maps, `${s.label}: hail paths this year. Darker means bigger hail.`),
    stats: [
      { n: fmt(s.homes), l: `homes in Traverse's map of ${esc(s.label)}` },
      { n: `<em>${fmt(s.hit)}</em>`, l: `homes under hail of 1 inch or larger in the last 24 months, by radar (${pct < 1 ? '<1' : Math.round(pct)}% of homes)` },
      { n: `<span style="font-size:13px;line-height:1.4;font-weight:700;font-family:'Atkinson Hyperlegible',sans-serif">${stormTxt}</span>`, l: 'biggest storm days, by homes under 1-inch hail' },
    ],
    tableTitle: 'Top 10 streets by homes under hail of 1 inch or larger',
    tableHead: `<th></th><th>Street</th>${hasNb ? '<th>Neighbourhood</th>' : ''}<th class="r">Homes under 1&quot; hail</th><th class="r">Biggest hail</th>${showOld ? `<th class="r">Built ${s.oldBuiltMax} or earlier</th>` : ''}`,
    tableRows: rows,
    note: `Hail of 1 inch or larger as estimated by radar at each home, ${dateLong(s.from)} to ${dateLong(s.through)}.${showOld ? ` "Built ${s.oldBuiltMax} or earlier" counts those homes that are 20 or more years old.` : ''} No individual home is shown here.`,
  });
  return { html, stat: { town: key, label: s.label, trade: 'roofing', homes: s.homes, headline: s.hit, headlineMeans: 'homes under radar-estimated hail of 1 inch or larger', window: 'two years', windowFrom: s.from, windowThrough: s.through, topStreet: s.rows[0].street, topStreetCount: s.rows[0].n, dataDate: s.built }, summary: { homes: s.homes, hit: s.hit, storms: st, top: s.rows.slice(0, 3), built: s.built, through: s.through, from: s.from, showOld, hitOld: s.hitOld, hasMap: !!mapBlock(key, 'hail', maps, '') } };
}

// ---------- render ----------
function render(key, html) {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(RENDER, { recursive: true });
  const base = `${key}-${trade}`;
  const htmlPath = path.join(RENDER, base + '.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  const url = pathToFileURL(htmlPath).href;
  const profile = path.join(RENDER, 'chrome-profile');
  const common = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--user-data-dir=${profile}`, '--virtual-time-budget=10000', '--allow-file-access-from-files'];
  const pdf = path.join(OUT, base + '.pdf'), png = path.join(OUT, base + '.png');
  let r = spawnSync(CHROME, [...common, '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, url], { encoding: 'utf8', timeout: 90000 });
  if (!exists(pdf)) throw new Error('pdf failed: ' + (r.stderr || '').slice(-300));
  r = spawnSync(CHROME, [...common, '--window-size=816,1056', '--force-device-scale-factor=2', `--screenshot=${png}`, url], { encoding: 'utf8', timeout: 90000 });
  if (!exists(png)) throw new Error('png failed: ' + (r.stderr || '').slice(-300));
}

// ---------- main ----------
const maps = cityMaps();
const baseDir = trade === 'lawn' ? LAWN_DIR : ROOF_DIR;
const keys = all
  ? fs.readdirSync(baseDir).filter((f) => f.endsWith('.json') && !/^(hail|hailrep|census|mail|material|moved|naip|nri|others|outline|photo|roof|wind|year)-/.test(f) && !f.endsWith('-lookup.json')).map((f) => f.slice(0, -5))
  : [town];
let made = 0; const skipped = []; const stats = [];
for (const key of keys) {
  const res = trade === 'lawn' ? buildLawn(key, maps) : buildRoof(key, maps);
  if (res.skip) { skipped.push(`${key}: ${res.skip}`); if (!all) console.log(`skipped ${key}: ${res.skip}`); continue; }
  if (!noRender) render(key, res.html); made++; stats.push(res.stat);
  if (!all) console.log(`built ${key}-${trade}  ${JSON.stringify(res.summary)}`);
}
if (all) console.log(`\n${made} built, ${skipped.length} skipped`);
if (all && skipped.length) fs.writeFileSync(path.join(RENDER, `skipped-${trade}.txt`), skipped.join('\n'));

if (stats.length) {
  const sf = path.join(OUT, 'town-stats.json');
  let cur = []; try { cur = readJSON(sf); } catch {}
  const m = new Map(cur.map((e) => [e.town + '|' + e.trade, e]));
  for (const e of stats) m.set(e.town + '|' + e.trade, e);
  fs.writeFileSync(sf, JSON.stringify([...m.values()].sort((a, b) => (a.town + a.trade).localeCompare(b.town + b.trade)), null, 1));
}

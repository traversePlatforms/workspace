// Client installs (2026-10-08). A company that signs up gets its own install of its trade's edition: its own folder, API
// file, data folder and private folder (so one client's doors, marks and codes never reach another's), its name and contact
// details, and colours worked out from one brand colour. One small file per client in ./clients/<slug>.json:
//
//   { "trade": "roofing", "name": "Acme Roofing", "short": "Acme", "color": "#1f6feb",
//     "tagline": "", "phone": "", "email": "", "site": "", "towns": null, "host": null }
//
//   trade   the edition it starts from: roofing, yards, solar, pest or security
//   color   the brand colour; the bar, sign-in screen, keys and accents are worked out from it, white text checked at 4.5:1
//   towns   optional: the town groups to show (default: the trade edition's own)
//   host    optional: where it will live (default https://sixfoldcolorado.com, until Traverse has its own hosting)
//   market  optional: a market outside Colorado, named as in data-pipeline/door-territory/metros/<market>.json ("dfw").
//           The install then shows only that market's towns, runs on its clock, and gets its storm lists and nothing
//           statewide from Colorado (2026-10-11, Matthew chose one install per market). Without it: Colorado, as before.
//   folder  written back on the first build (a random name, like the editions'): its address never changes after that
//
// node new-client.cjs makes the file; node build-editions.cjs <slug> builds it (and everything else without a name).
// The client's admin can change the name, contact details and colour later from the app's Company screen; this file is the start.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.TRAVERSE_CLIENTS || path.join(__dirname, 'clients');   /* a test client from elsewhere (the market test, 2026-10-11) */
const METROS = path.join(__dirname, '..', 'data-pipeline', 'door-territory', 'metros');
/* what the app needs to know about a market (company.json "market"): drawn as text, so nothing here is trusted either */
function marketFor(key) {
  if (!/^[a-z0-9-]{1,30}$/.test(key) || !fs.existsSync(path.join(METROS, key + '.json'))) throw new Error('no such market: ' + key + ' (metros/' + key + '.json)');
  const M = JSON.parse(fs.readFileSync(path.join(METROS, key + '.json'), 'utf8'));
  for (const k of ['state', 'stateName', 'timezone', 'stateBox', 'naip']) if (!M[k]) throw new Error('metros/' + key + '.json needs ' + k);
  const counties = {}, parcels = [];
  for (const [ck, src] of Object.entries(M.sources || {})) { counties[ck] = (src.countyName || ck) + ' County'; if (src.url) parcels.push(src.url + '/query'); }
  const cs = M.towns.filter((t) => Array.isArray(t.center)).map((t) => t.center);
  const centre = cs.length ? [+(cs.reduce((a, c) => a + c[0], 0) / cs.length).toFixed(4), +(cs.reduce((a, c) => a + c[1], 0) / cs.length).toFixed(4)] : null;
  return { group: M.group || M.key, co: { key: M.key, label: M.label, state: M.state, stateName: M.stateName, tz: M.timezone, box: M.stateBox,
    counties, parcels, centre, zoom: 10, naip: M.naip } };
}

/* ---- colour: a palette from one brand colour ---- */
const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); if (!m) throw new Error('not a colour: ' + h); const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l]; }
function hslToHex(h, s, l) { const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255); }
const lum = (hex) => { const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function palette(color) {
  const [h, s0] = rgbToHsl(...hexToRgb(color)), s = Math.min(s0, 0.6), at = (l, sat = s) => hslToHex(h, sat, l);
  let accent = color, [, , la] = rgbToHsl(...hexToRgb(color));
  while (contrast(accent, '#ffffff') < 4.5 && la > 0.05) { la -= 0.02; accent = hslToHex(h, s0, la); }   /* white on it at 4.5:1 or better */
  return {
    bar: at(0.2), deep: at(0.13), key: at(0.28), keyDown: at(0.35), barSoft: at(0.85, s * 0.45), accent, moss: at(0.55, s * 0.6), mossInk: at(0.2),
    bg: at(0.965, s * 0.25), line: at(0.88, s * 0.2), sunk: at(0.925, s * 0.2), card1: at(0.28), appbar: at(0.24), tile: at(0.32),
    dBg: at(0.06, s * 0.5), dCard: at(0.1, s * 0.45), dLine: at(0.2, s * 0.35), dSunk: at(0.08, s * 0.45), dBar: at(0.12, s * 0.5), dAccent: at(0.75, s * 0.55),
  };
}

/* ---- the client entries ---- */
const slugOk = (s) => /^[a-z0-9][a-z0-9-]{1,40}$/.test(s);
module.exports = function addClients(EDITIONS) {
  if (!fs.existsSync(DIR)) return [];
  const added = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
    const slug = f.replace(/\.json$/, ''), file = path.join(DIR, f);
    if (!slugOk(slug)) throw new Error('client file name must be lowercase letters, digits and dashes: ' + f);
    const C = JSON.parse(fs.readFileSync(file, 'utf8'));
    const base = EDITIONS[C.trade];
    if (!base) throw new Error(f + ': trade must be one of ' + Object.keys(EDITIONS).join(', '));
    if (!C.name || !C.color) throw new Error(f + ': name and color are required');
    if (!C.folder) {   /* a random folder name, written back so the address never changes */
      const init = C.name.split(/\s+/).map((w) => w[0]).join('').toLowerCase().replace(/[^a-z]/g, '').slice(0, 3) || 'c';
      C.folder = init + '-' + crypto.randomBytes(3).toString('hex');
      fs.writeFileSync(file, JSON.stringify(C, null, 2) + '\n');
    }
    if (!/^[a-z]{1,3}-[0-9a-f]{6}$/.test(C.folder)) throw new Error(f + ': folder must look like ab-1a2b3c');
    const id = 'c-' + slug, pal = palette(C.color), mk = C.market ? marketFor(C.market) : null;
    if (EDITIONS[id] || Object.values(EDITIONS).some((e) => e.folder === C.folder)) throw new Error(f + ': folder or name already used');
    EDITIONS[id] = Object.assign({}, base, {
      name: C.name, short: C.short || C.name.split(/\s+/)[0], folder: C.folder,
      api: id, data: id + '-data', priv: id + '-private', cookie: 'c' + crypto.createHash('sha1').update(slug).digest('hex').slice(0, 4),
      store: id + '.', storeApp: id + '.app.', idb: id + '-rounds', cache: id + '-',
      blurb: C.tagline || base.blurb, icon: pal.accent, iconInk: '#ffffff', c: pal,
      extraRegions: undefined,   /* the demo editions' showcase towns stay out of a client's install */
      host: (C.host || 'https://sixfoldcolorado.com').replace(/\/+$/, ''), client: slug, trade: C.trade,
      market: mk ? mk.co.key : null, marketGroup: mk ? mk.group : null, money: mk ? false : base.money,
      company: () => {
        const co = base.company();
        Object.assign(co, { name: C.name, short: C.short || C.name.split(/\s+/)[0], tagline: C.tagline || '', phone: C.phone || '', email: C.email || '', site: C.site || '' });
        if (Array.isArray(C.towns)) co.townGroups = C.towns;
        if (mk) {   /* a market install: its own towns only, and nothing that reads Colorado-only data */
          co.townGroups = [mk.group]; co.market = mk.co;
          co.features = Object.assign({}, co.features, { communities: false, firecheck: false, quote: false });
          co.card = Object.assign({}, co.card, { fire: false, money: false, water: false, fc: false });
        }
        if (C.logo && C.logo.viewBox && C.logo.path) co.logo = { viewBox: C.logo.viewBox, path: C.logo.path };
        return co;
      },
    });
    added.push(id);
  }
  return added;
};
module.exports.palette = palette;
module.exports.contrast = contrast;

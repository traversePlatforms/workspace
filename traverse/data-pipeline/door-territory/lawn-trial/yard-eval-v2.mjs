/* Yard v2 against every lawn measured by hand (2026-10-23). Lot lines come from yard-key-parcels.json (no parcel requests here); the
   photo, DRCOG and laser windows from yard-v2-cache/ (read once per lot). v1 is re-run through the same classifier with its own rule
   (green 'v1', no roof buffer, no evergreen block), which matches yard-scan.mjs (checked against yard-eval.json).
   Prints, per variant, the miss on each lot, the median miss and the worst miss; writes yard-eval-v2.json.
     node yard-eval-v2.mjs [--pics <dir>]                                                                                       */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { yardSources, yardClassify, yardPic, V2 } from './yard-scan-v2.mjs';
const pics = (() => { const i = process.argv.indexOf('--pics'); return i > 0 ? process.argv[i + 1] : null; })(); if (pics) mkdirSync(pics, { recursive: true });
const LOTS = JSON.parse(readFileSync(new URL('./yard-key-parcels.json', import.meta.url), 'utf8'));
/* [address, hand sq ft, what the hand figure covers, who]; the server's lawnhand logs (read 2026-10-23) hold Zinnia, Oak Leaf and
   Valentia (5,843 back yard only, then 8,111 whole property): nothing beyond this list */
export const KEY = [
  ['3855 S VALENTIA CT', 8111, 'whole property, grass under tree edges and some beds', 'Matthew 2026-10-22'],
  ['11663 SETTLERS DR', 10473, 'whole lawn, Google Earth', 'Jen 2026-10-21'],
  ['2787 RUSSET SKY CT', 3898, 'total lawn, Google Maps', 'Matthew 2026-10-02'],
  ['1648 MARSH HAWK CIR', 2344, 'total lawn, Google Maps', 'Matthew 2026-10-02'],
  ['7378 UPTON CT', 2595, 'watered lawn only', 'Matthew 2026-10-02'],
  ['9554 PENSTEMON CT', 5746, 'UPPER LIMIT only', 'Matthew 2026-10-02'],
  ['6595 ZINNIA ST', 3225, 'whole property incl. under a tree', 'Matthew 2026-10-22'],
  ['3247 OAK LEAF PL', 2556, 'whole property, grass only, evergreen left out', 'Matthew 2026-10-22'],
  ['7006 E 131ST WAY', 2137, 'back 450 + front 763 + 924, under the front trees; UNSEEN by v2 tuning (v2 775, DRCOG 3,208, app 1,100)', 'Matthew 2026-10-23'],
  ['7614 E 121ST PL', 2961, 'back 1,801 + front 854 + 306; UNSEEN by v2 tuning (v2 3,229, DRCOG 4,930, app 700)', 'Matthew 2026-10-23'],
  ['579 E 76TH AVE', 3613, 'whole property 3,402 + 211 strip by the driveway, open lot; UNSEEN by v2 tuning (v2 1,636, DRCOG 280, app 2,100)', 'Matthew 2026-10-23'],
  ['3852 PRIMROSE LN', 3461, 'back 3,061 incl. under the tree edges + front 400 beside the driveway, Castle Rock; UNSEEN by v2 tuning (v2 3,940, DRCOG 3,703, app 1,200)', 'Matthew 2026-10-23'],
  ['375 LEFTHAND CANYON DR', 34123, 'FIELD not a watered lawn: nearly the whole 0.8-acre lot, Boulder; UNSEEN (v2 43, DRCOG turf 0, app 1,500); score apart from lawns', 'Matthew 2026-10-23'],
  ['6049 W ROXBURY PL', 3131, 'back 1,867 + front 1,264 (2D; an 815 3D trace of the front not counted), heavy trees, Columbine; UNSEEN (v2 3,035, DRCOG 1,841, app 300)', 'Matthew 2026-10-23'],
  ['6431 S CEDAR ST', 2614, 'back lawn only (front looks like rock/dry in Google now), 2D, Littleton; UNSEEN (v2 4,263, DRCOG 4,801, app 500)', 'Matthew 2026-10-23'],
  ['6916 S ELATI ST', 2554, 'front 1,323 + side 556 + back strip 675, heavy canopy, ROUGH (he found it hard), Littleton; UNSEEN (v2 2,680, DRCOG 2,573, app 5,800 from 2021)', 'Matthew 2026-10-23'],
];
const OFF = { struct: false, roofBuf: 0, ever: 'off', speck: 0, house: 0 };
const VARIANTS = {
  'v1 0m': { green: 'v1', ...OFF, fill: 0 }, 'v1 2m': { green: 'v1', ...OFF, fill: 2 }, 'v1 4m': { green: 'v1', ...OFF, fill: 4 }, 'v1 6m': { green: 'v1', ...OFF, fill: 6 },
};
/* (a) alone: the green rule, v1's fill */
for (const g of ['g23', 'd6', 'g23d6']) for (const f of [0, 4]) VARIANTS[`a:${g} ${f}m`] = { green: g, ...OFF, fill: f };
for (const gate of [0.2, 0.25, 0.3]) for (const f of [0, 4]) VARIANTS[`a:g23d6g${gate} ${f}m`] = { green: 'g23d6g', gate, ...OFF, fill: f };
/* (b) alone: v1's green, the fill restricted (roof = DRCOG outline + 2 m; ever = evergreen-looking crowns; gnd = only crowns the laser saw ground through) */
for (const f of [2, 4, 6, 8]) for (const ever of ['off', 'lidar', 'gnd']) VARIANTS[`b:roof${ever === 'off' ? '' : '+' + ever} ${f}m`] = { green: 'v1', ...OFF, struct: true, roofBuf: 2, ever, everGnd: ever === 'gnd' ? 0.1 : 0.15, fill: f };
/* (a)+(b), and the two extra filters for open lots: despeckle (speck) and lawn near the house (house) */
for (const g of ['g23', 'd6', 'g23d6', 'g23d6g']) for (const f of [4, 6, 8]) for (const ever of ['lidar', 'gnd']) for (const [sp, ho] of [[0, 0], [4, 0], [0, 30], [4, 30]])
  VARIANTS[`ab:${g} ${ever}${sp ? ' sp' + sp : ''}${ho ? ' h' + ho : ''} ${f}m`] = { green: g, gate: 0.2, struct: true, roofBuf: 2, ever, everGnd: ever === 'gnd' ? 0.1 : 0.15, speck: sp, house: ho, fill: f };
/* around the leader: reach, despeckle strength, house distance */
for (const f of [6, 8, 10, 12]) for (const sp of [3, 4, 5]) for (const ho of [25, 30, 40]) VARIANTS[`near:g23d6g lidar sp${sp} h${ho} ${f}m`] = { green: 'g23d6g', gate: 0.2, struct: true, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: sp, house: ho, fill: f };
for (const gate of [0.15, 0.25]) VARIANTS[`near:g23d6g${gate} lidar sp4 h30 8m`] = { green: 'g23d6g', gate, struct: true, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 4, house: 30, fill: 8 };
for (const rb of [1, 3]) VARIANTS[`near:g23d6g lidar roof${rb} sp4 h30 8m`] = { green: 'g23d6g', gate: 0.2, struct: true, roofBuf: rb, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 4, house: 30, fill: 8 };
VARIANTS['near:lated6g lidar sp5 h25 12m'] = { green: 'lated6g', gate: 0.2, struct: true, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 5, house: 25, fill: 12 };
VARIANTS['near:lated6g lidar sp4 h25 8m'] = { green: 'lated6g', gate: 0.2, struct: true, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 4, house: 25, fill: 8 };
VARIANTS['near:g23d6g noever sp4 h30 8m'] = { green: 'g23d6g', gate: 0.2, struct: true, roofBuf: 2, ever: 'off', speck: 4, house: 30, fill: 8 };
VARIANTS['near:g23d6g lidar noroof sp4 h30 8m'] = { green: 'g23d6g', gate: 0.2, struct: true, roofBuf: 0, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 4, house: 30, fill: 8 };
VARIANTS['near:g23d6g lidar nostruct sp4 h30 8m'] = { green: 'g23d6g', gate: 0.2, struct: false, roofBuf: 2, ever: 'lidar', everLow: 0.2, everGnd: 0.15, speck: 4, house: 30, fill: 8 };
const rows = [];
for (const [addr, hand, covers, who] of KEY) {
  const P = LOTS[addr]; if (!P) { console.error(addr + ': no lot line on disk'); continue; }
  const S = await yardSources(P.rings, { key: addr.toLowerCase().replace(/\W+/g, '-') });
  const row = { addr, hand, covers, who, upper: /UPPER/.test(covers), res: {} };
  for (const [name, v] of Object.entries(VARIANTS)) { const R = yardClassify(S, v); row.res[name] = R.lawn; if (name === 'v1 4m') Object.assign(row, { lot: R.lot, drcog: R.drcogTurf, open: R.open, survey: R.survey, photo23: R.photo23, photo21: R.photo21 }); }
  const W = yardClassify(S, V2); Object.assign(row, { v2: W.lawn, v2seen: W.seen, v2under: W.under, blockedRoof: W.blockedRoof, blockedEver: W.blockedEver });
  if (pics) { const slug = addr.toLowerCase().replace(/\W+/g, '-'); yardPic(S, W, join(pics, slug + '-v2.png')); yardPic(S, yardClassify(S, VARIANTS['v1 4m']), join(pics, slug + '-v1.png')); }
  rows.push(row); console.error(addr, 'lot', row.lot, 'photos', row.photo23, row.photo21, 'survey', row.survey, 'drcog', row.drcog, 'v2', row.v2, 'blocked roof/ever', row.blockedRoof, row.blockedEver);
}
const pct = (v, h) => (v - h) / h * 100;
const solid = rows.filter((r) => !r.upper);
const score = Object.keys(VARIANTS).map((name) => { const e = solid.map((r) => pct(r.res[name], r.hand)), a = e.map(Math.abs).sort((x, y) => x - y); const m = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; return { name, med: m, max: a[a.length - 1], mean: a.reduce((s, x) => s + x, 0) / a.length, e }; });
const f = (x) => (x >= 0 ? '+' : '') + Math.round(x) + '%';
console.log('variant'.padEnd(30), solid.map((r) => r.addr.split(' ').slice(1, 3).join(' ').slice(0, 10).padStart(11)).join(''), '  median   worst');
for (const s of score.sort((a, b) => a.med - b.med)) console.log(s.name.padEnd(30), s.e.map((x) => f(x).padStart(11)).join(''), f(s.med).padStart(8), f(s.max).padStart(7));
const up = rows.find((r) => r.upper); if (up) console.log('\nPenstemon (upper limit ' + up.hand + '):', ['v1 0m', 'v1 4m', 'near:g23d6g lidar sp5 h25 12m', 'near:lated6g lidar sp5 h25 12m', 'near:lated6g lidar sp4 h25 8m'].map((n) => n + ' ' + up.res[n]).join(' | '));
writeFileSync(new URL('./yard-eval-v2.json', import.meta.url), JSON.stringify({ v2: V2, rows, score }, null, 1));

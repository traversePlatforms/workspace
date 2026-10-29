/* Yard v2 re-scored against every lawn measured by hand (2026-10-29). Read-only analysis: nothing here writes to the app's door files.
   For each hand-measured lot it compares
     old    the photo estimate the app showed before 26 Oct (lawn-cache.json, compact rule, rounded to 100 as the card showed it)
     card   what the app's card shows today (the local door file, checked against the live server on 29 Oct): v2 where v2 has a reading,
            the old figure where v2 left the lot out (shared lot, or no lot under the door's point)
     v2     yard v2 with its current settings (V2 in yard-scan-v2.mjs), as build-yard-v2.mjs turns it into a card figure: rounded to 100,
            and on tree lots ("T") the middle of the range the card shows
     A, B   two near-winning v2 variants from the 23 Oct scoring (despeckle 4 instead of 5; fill 8 m or 12 m)
     v1 4m  the old yard method run through the same classifier (for reference)
   Lot lines: yard-key-parcels.json (23-25 Oct) and yard-rescore-parcels.json (29 Oct: the server's parcel-cache answers for the door
   points, read-only, and the local Highlands Ranch parcel cells). No parcel requests. Photo/laser/DRCOG windows: yard-v2-cache/.
     node yard-v2-rescore.mjs            -> prints the tables, writes yard-v2-rescore-2026-10-29.json                                */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
import { yardLawn } from './build-yard-v2.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), DT = join(HERE, '..'), APP = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const LOTS = { ...JSON.parse(readFileSync(join(HERE, 'yard-key-parcels.json'), 'utf8')), ...JSON.parse(readFileSync(join(HERE, 'yard-rescore-parcels.json'), 'utf8')) };
/* set: tuned = one of the 7 lots the 23 Oct settings were picked on; unseen = measured after the settings were fixed.
   use: core = a whole-property hand measure; upper = upper limit only; partial = part of the yard only; quote = a remote quote size */
const KEY = [
  ['3855 S VALENTIA CT', 'denver', 8111, 'tuned', 'core', 'whole property incl. beds and grass under tree edges (log incl=beds); back yard alone 5,843 incl. under trees', 'Matthew 22 Oct'],
  ['11663 SETTLERS DR', 'parker', 10473, 'tuned', 'core', 'whole lawn, Google Earth', 'Jen 21 Oct'],
  ['2787 RUSSET SKY CT', 'castle-rock', 3898, 'tuned', 'core', 'total lawn, Google Maps', 'Matthew 2 Oct'],
  ['1648 MARSH HAWK CIR', 'castle-rock', 2344, 'tuned', 'core', 'total lawn, Google Maps', 'Matthew 2 Oct'],
  ['7378 UPTON CT', 'franktown', 2595, 'tuned', 'core', 'watered lawn only (acreage lot)', 'Matthew 2 Oct'],
  ['6595 ZINNIA ST', 'arvada', 3225, 'tuned', 'core', 'whole property incl. grass under a tree (log incl=trees)', 'Matthew 22 Oct'],
  ['3247 OAK LEAF PL', 'highlands-ranch', 2556, 'tuned', 'core', 'grass only, front evergreen left out (log incl=grass)', 'Matthew 22 Oct'],
  ['9554 PENSTEMON CT', 'black-forest', 5746, 'tuned', 'upper', 'upper limit only', 'Matthew 2 Oct'],
  ['7006 E 131ST WAY', 'thornton', 2137, 'unseen', 'core', 'back 450 + front 763 + 924 under the front trees', 'Matthew 23 Oct'],
  ['7614 E 121ST PL', 'thornton', 2961, 'unseen', 'core', 'back 1,801 + front 854 + 306', 'Matthew 23 Oct'],
  ['579 E 76TH AVE', 'welby', 3613, 'unseen', 'core', 'whole property 3,402 + 211 strip by the drive, open lot', 'Matthew 23 Oct'],
  ['3852 PRIMROSE LN', 'castle-rock', 3461, 'unseen', 'core', 'back 3,061 incl. under tree edges + front 400', 'Matthew 23 Oct'],
  ['6049 W ROXBURY PL', 'columbine', 3131, 'unseen', 'core', 'back 1,867 + front 1,264, heavy trees', 'Matthew 23 Oct'],
  ['6431 S CEDAR ST', 'littleton', 2614, 'unseen', 'partial', 'BACK lawn only (front looked like rock/dry)', 'Matthew 23 Oct'],
  ['6916 S ELATI ST', 'littleton', 2554, 'unseen', 'core', 'front + side + back strip, heavy canopy, rough', 'Matthew 23 Oct'],
  ['600 HIDDENBROOK CT', 'highlands-ranch', 2231, 'unseen', 'core', 'back 1,691 + front 290 + 130 + 120', 'Matthew 23 Oct'],
  ['9267 CANYON WREN CT', 'highlands-ranch', 4637, 'unseen', 'core', 'front 1,169 + back 3,468 incl. under tree shade', 'Matthew 23 Oct'],
  ['852 HUGHES LN', 'highlands-ranch', 1385, 'unseen', 'core', 'side 745 (partly past the lot line) + front 640, rough; back under canopy maybe not traced', 'Matthew 23 Oct'],
  ['9416 DESERT WILLOW TRL', 'highlands-ranch', 1473, 'unseen', 'core', 'front 766 (part past the lot line) + back 707 under trees', 'Matthew 23 Oct'],
  ['2195 E NICHOLS DR', 'centennial', 3035, 'unseen', 'core', 'front-left 848 + back 1,858 almost all under one big tree + side 329 (log incl=trees)', 'Matthew 25 Oct'],
  ['9353 PIKE WAY', 'arvada', 1880, 'unseen', 'core', 'back 1,165 to the grass edge under fence-line trees + front 451 + drive strip 121 + bed-edge grass 81 + 62 (may overlap: true ~1,820-1,880) (log incl=trees)', 'Matthew 29 Oct'],
  ['12405 W 19TH PL', 'lakewood', 4300, 'unseen', 'quote', '"about 4,300", remote quote', 'Jen 25 Oct'],
  ['155 EVERETT ST', 'lakewood', 2000, 'unseen', 'quote', 'remote quote', 'Jen 25 Oct'],
  ['1539 HARLAN ST', 'lakewood', 1500, 'unseen', 'quote', 'back 1,250 + front, "might be turf"', 'Jen 25 Oct'],
  ['2644 S HOYT ST', 'lakewood', 2700, 'unseen', 'quote', '"about 2,700, hard to tell with trees"', 'Jen 25 Oct'],
];
const VAR = {
  v2: V2,
  A: { ...V2, green: 'lated6g', speck: 4, house: 25, fill: 8 },    /* 23 Oct runner-up (23.3% on the 7) */
  B: { ...V2, green: 'lated6g', speck: 4, house: 25, fill: 12 },   /* between the two: less despeckle, full reach */
  'v1 4m': { green: 'v1', struct: false, roofBuf: 0, ever: 'off', speck: 0, house: 0, fill: 4 },
};
const doorFile = {}; const doorOf = (town, addr) => { if (!(town in doorFile)) { const p = join(APP, town + '.json'); doorFile[town] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors) : []; } return doorFile[town].find((d) => d.address === addr) || null; };
const v2town = {}; const v2raw = (town, id) => { if (!(town in v2town)) { const p = join(HERE, 'yard-v2', town + '.json'); v2town[town] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).doors || {} : {}; } return v2town[town][id]; };
console.error('reading lawn-cache.json ...');
const lawnCache = JSON.parse(readFileSync(join(DT, 'lawn-cache.json'), 'utf8'));
const r100 = (x) => Math.round(x / 100) * 100;
const cardNum = (L) => (L ? (L.rng ? (L.rng[0] + L.rng[1]) / 2 : L.sq) : null);
const rows = [];
for (const [addr, town, hand, set, use, incl, who] of KEY) {
  const P = LOTS[addr]; if (!P) { console.error(addr + ': no lot line'); continue; }
  const d = doorOf(town, addr), id = d ? d.id : addr.toLowerCase().replace(/\W+/g, '-');
  let S; try { S = await yardSources(P.rings, { key: addr.toLowerCase().replace(/\W+/g, '-') }); } catch (e) { console.error(addr + ': sources failed, left out (' + String(e.message).slice(0, 80) + ')'); continue; }
  const res = {}; let W;
  for (const [k, v] of Object.entries(VAR)) { const R = yardClassify(S, v); res[k] = R.lawn; if (k === 'v2') W = R; }
  const card2 = yardLawn({ l: W.lawn, s: W.seen, u: W.under, o: W.open, t: W.trees, lot: W.lot, ph: W.photo23 });
  const lc = d ? lawnCache[`${d.lat},${d.lon}`] : null, oldS = lc && !lc.err ? (lc.c ?? lc.s) : null;
  const raw = v2raw(town, id);
  rows.push({ addr, town, id, hand, set, use, incl, who, lot: W.lot, crownShare: W.lot ? +(W.trees / W.lot).toFixed(2) : null,
    old: oldS == null ? null : r100(oldS), oldRaw: oldS, card: d && d.lawn ? d.lawn : null, cardNum: cardNum(d && d.lawn),
    v2lawn: W.lawn, v2seen: W.seen, v2under: W.under, v2card: card2, v2cardNum: cardNum(card2), A: res.A, B: res.B, v1_4m: res['v1 4m'],
    territoryRaw: raw === undefined ? 'not in yard-v2/' + town : raw, survey: W.survey, photo: W.photo23 });
  console.error(addr.padEnd(24), 'lot', W.lot, 'crowns', rows.at(-1).crownShare, 'old', rows.at(-1).old, 'card', JSON.stringify(rows.at(-1).card), 'v2', W.lawn, JSON.stringify(card2), 'A', res.A, 'B', res.B, 'raw', raw && raw.l, raw && raw.shared ? 'shared' : '');
}
writeFileSync(join(HERE, 'yard-v2-rescore-2026-10-29.json'), JSON.stringify({ made: '2026-10-29', settings: VAR, rows }, null, 1));

/* ---- scoring ---- */
const miss = (v, h) => (v == null ? null : (v - h) / h);
const med = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const COLS = { old: (r) => r.old, card: (r) => r.cardNum, v2: (r) => r.v2cardNum, 'v2 raw': (r) => r.v2lawn, A: (r) => r.A, B: (r) => r.B, 'v1 4m': (r) => r.v1_4m };
const pc = (x) => (x == null ? '—' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%');
const tree = (r) => r.crownShare >= 0.25;
const groups = { 'all core': (r) => r.use === 'core', 'tuned (in-sample)': (r) => r.use === 'core' && r.set === 'tuned', 'unseen (out-of-sample)': (r) => r.use === 'core' && r.set === 'unseen',
  'tree-heavy (crowns >= 25% of lot)': (r) => r.use === 'core' && tree(r), 'open (crowns < 25%)': (r) => r.use === 'core' && !tree(r),
  'unseen tree-heavy': (r) => r.use === 'core' && r.set === 'unseen' && tree(r), 'unseen open': (r) => r.use === 'core' && r.set === 'unseen' && !tree(r), 'Jen quotes (check only)': (r) => r.use === 'quote' };
console.log('\nlot'.padEnd(26) + 'hand'.padStart(7) + Object.keys(COLS).map((c) => c.padStart(9)).join('') + '  crowns set/use');
for (const r of rows) console.log(r.addr.padEnd(25) + String(r.hand).padStart(7) + Object.values(COLS).map((f) => pc(miss(f(r), r.hand)).padStart(9)).join('') + '  ' + r.crownShare + ' ' + r.set + '/' + r.use);
console.log('\ngroup'.padEnd(38) + 'n'.padStart(4) + Object.keys(COLS).map((c) => c.padStart(18)).join(''));
const summary = {};
for (const [g, f] of Object.entries(groups)) {
  const rr = rows.filter(f); summary[g] = { n: rr.length };
  const cells = Object.entries(COLS).map(([c, get]) => {
    const e = rr.map((r) => miss(get(r), r.hand)).filter((x) => x != null), a = e.map(Math.abs);
    const worst = e.reduce((w, x) => (Math.abs(x) > Math.abs(w) ? x : w), 0), w25 = a.filter((x) => x <= 0.25).length;
    summary[g][c] = { n: e.length, medAbs: med(a), medSigned: med(e), worst, within25: w25 };
    return (`${pc(med(a)).replace('+', '')} ${pc(med(e))} ${pc(worst)}`).padStart(18);
  });
  console.log(g.padEnd(37) + String(rr.length).padStart(4) + cells.join(''));
}
console.log('(each cell: median miss, median lean, worst)');
writeFileSync(join(HERE, 'yard-v2-rescore-2026-10-29.json'), JSON.stringify({ made: '2026-10-29', settings: VAR, rows, summary }, null, 1));

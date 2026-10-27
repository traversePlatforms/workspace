/* Yard v2 into the door files (2026-10-26, Matthew: "go ahead with everything that you've listed"; the run: cloud, 24-26 Oct).
   Reads yard-v2/<town>.json (yard-v2-town.mjs: per door l = lawn seen + lawn under trees, s = seen, u = under trees, o = open ground,
   t = tree crowns, lot, ph = the 2023 photo's date; or big / shared / null) and writes yard-v2-lawn.json, keyed "<town>/<door id>":
     { lv, sq, yr[, rng] }  the same lawn object build-rounds-data.mjs writes from lawn-cache.json, so the app reads it unchanged:
       lv  T when the lot is mostly under trees (crowns over 25% of the lot) and under 1,200 sq ft of lawn was found; otherwise
           N under 300 · S 300-1,199 · M 1,200-2,999 · L 3,000 and up (the old cut-offs)
       sq  l, rounded to 100      yr  the photo the green came from: 2023 when it was late summer (20 Aug - 30 Sep, the metro),
           else 2021 (El Paso's 2023 photo is October; yard-scan-v2 used its September 2021 photo)
       rng on T lots: [l, l + 60% of the crowns the fill did not reach], capped at the open ground: lawn under trees the photo cannot see
   Doors with no v2 reading (big, shared, not measured) are left out: build-rounds-data keeps the old figure for them.
   Hand measures stay on top: the server lays lawnhand-<town>.log over every card (loadLawnHand), whatever the photo says.
   Also writes yard-v2-switch-check-2026-10-26.md: old app figure vs v2 on five towns and on every hand-measured lawn.
     node build-yard-v2.mjs                                                                                                       */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const LATE = /-(08-(2\d|3[01])|09-\d\d)$/;
const r100 = (x) => Math.round(x / 100) * 100;
export function yardLawn(v) {
  if (!v || v.big || v.shared || typeof v.l !== 'number' || typeof v.lot !== 'number') return null;
  const yr = !v.ph || LATE.test(v.ph) ? 2023 : 2021;
  const tree = v.lot > 0 && v.t > 0.25 * v.lot && v.l < 1200;
  const lv = tree ? 'T' : v.l < 300 ? 'N' : v.l < 1200 ? 'S' : v.l < 3000 ? 'M' : 'L';
  const out = { lv, sq: r100(v.l), yr };
  if (tree) out.rng = [r100(v.l), r100(Math.min(Math.max(v.o || 0, v.l), v.l + 0.6 * Math.max(0, (v.t || 0) - (v.u || 0))))];
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = {}, per = {}; let n = 0;
  for (const f of readdirSync(join(HERE, 'yard-v2')).filter((f) => f.endsWith('.json'))) {
    const town = f.slice(0, -5), doors = JSON.parse(readFileSync(join(HERE, 'yard-v2', f), 'utf8')).doors || {};
    for (const [id, v] of Object.entries(doors)) { const L = yardLawn(v); if (L) { out[town + '/' + id] = L; n++; per[town] = (per[town] || 0) + 1; } }
  }
  writeFileSync(join(HERE, 'yard-v2-lawn.json'), JSON.stringify(out));
  console.log(`yard-v2-lawn.json: ${n} doors in ${Object.keys(per).length} towns`);

  /* ---- the check: the app's current figure (door files) against v2 ---- */
  const old = (town) => { const p = join(APP, town + '.json'); if (!existsSync(p)) return {}; const m = {}; for (const a of JSON.parse(readFileSync(p, 'utf8')).areas || []) for (const d of a.doors) m[d.id] = d.lawn; return m; };
  const LV = ['L', 'M', 'S', 'N', 'T'];
  const lines = ['# Yard v2 switch check, 26 Oct 2026', '', 'Old = the lawn figure the app shows today (lawn-cache, 2023 photo + canopy, compact rule). New = yard v2 (build-yard-v2.mjs). Hand measures win over both on the cards.', ''];
  lines.push('## Five towns', '', '| Town | Doors with both | Old L/M/S/N/T | New L/M/S/N/T | Median old sq ft | Median new sq ft |', '|---|---|---|---|---|---|');
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  for (const town of ['denver', 'highlands-ranch', 'castle-rock', 'thornton', 'cs-southeast']) {
    const O = old(town), co = {}, cn = {}, so = [], sn = []; let both = 0;
    for (const [k, L] of Object.entries(out)) { if (!k.startsWith(town + '/')) continue; const o = O[k.slice(town.length + 1)]; if (!o) continue; both++; co[o.lv] = (co[o.lv] || 0) + 1; cn[L.lv] = (cn[L.lv] || 0) + 1; so.push(o.sq || 0); sn.push(L.sq); }
    lines.push(`| ${town} | ${both.toLocaleString('en-US')} | ${LV.map((x) => co[x] || 0).join(' / ')} | ${LV.map((x) => cn[x] || 0).join(' / ')} | ${med(so).toLocaleString('en-US')} | ${med(sn).toLocaleString('en-US')} |`);
  }
  /* the hand-measured lawns: Matthew's and Jen's (server lawnhand logs, 22-25 Oct), the first checks (2 Oct) and the 11 unseen Thornton/HR traces (23 Oct) */
  const HAND = [['arvada', '6595-zinnia-st', 3225, 'hand 22 Oct'], ['highlands-ranch', '3247-oak-leaf-pl', 2556, 'hand 22 Oct (tuned on)'], ['denver', '3855-s-valentia-ct', 8111, 'hand 22 Oct'],
    ['centennial', '2195-e-nichols-dr', 3035, 'hand 25 Oct'], ['castle-rock', '2787-russet-sky-ct', 3898, 'first check (tuned on)'], ['franktown', '7378-upton-ct', 2595, 'first check (tuned on)'],
    ['thornton', '7006-e-131st-way', 2137, 'unseen'], ['thornton', '7614-e-121st-pl', 2961, 'unseen'], ['welby', '579-e-76th-ave', 3613, 'unseen'], ['castle-rock', '3852-primrose-ln', 3461, 'unseen'],
    ['columbine', '6049-w-roxbury-pl', 3131, 'unseen'], ['littleton', '6431-s-cedar-st', 2614, 'unseen (back only)'], ['littleton', '6916-s-elati-st', 2554, 'unseen'],
    ['highlands-ranch', '600-hiddenbrook-ct', 2231, 'unseen'], ['highlands-ranch', '9267-canyon-wren-ct', 4637, 'unseen'], ['highlands-ranch', '852-hughes-ln', 1385, 'unseen'], ['highlands-ranch', '9416-desert-willow-trl', 1473, 'unseen']];
  lines.push('', '## Hand-measured lawns', '', '| House | Hand | Old app | New v2 | Old miss | New miss | Note |', '|---|---|---|---|---|---|---|');
  const missO = [], missN = [], missOu = [], missNu = [];
  const findTown = (id, town) => { for (const t of [town, ...Object.keys(per)]) { if (out[t + '/' + id]) return t; } return town; };
  for (const [town0, id, hand, note] of HAND) {
    const town = findTown(id, town0), N = out[town + '/' + id], O = old(town)[id];
    const pc = (x) => x == null ? '—' : (x > 0 ? '+' : '') + Math.round(x * 100) + '%';
    const mo = O && O.sq != null ? O.sq / hand - 1 : null, mn = N ? (N.rng ? (N.rng[0] + N.rng[1]) / 2 : N.sq) / hand - 1 : null;
    if (mo != null) { missO.push(Math.abs(mo)); if (/unseen/.test(note)) missOu.push(Math.abs(mo)); }
    if (mn != null) { missN.push(Math.abs(mn)); if (/unseen/.test(note)) missNu.push(Math.abs(mn)); }
    lines.push(`| ${id} (${town}) | ${hand.toLocaleString('en-US')} | ${O ? (O.sq || 0).toLocaleString('en-US') + ' ' + O.lv : 'none'} | ${N ? (N.rng ? N.rng.join('–') : N.sq.toLocaleString('en-US')) + ' ' + N.lv : 'none'} | ${pc(mo)} | ${pc(mn)} | ${note} |`);
  }
  const mm = (a) => a.length ? Math.round(med(a) * 100) + '%' : '—';
  lines.push('', `Median miss, all: old ${mm(missO)} (${missO.length}) · new ${mm(missN)} (${missN.length}). Unseen only (not used to tune v2): old ${mm(missOu)} (${missOu.length}) · new ${mm(missNu)} (${missNu.length}). On T lots the new figure is the middle of the range.`);
  writeFileSync(join(HERE, 'yard-v2-switch-check-2026-10-26.md'), lines.join('\n') + '\n');
  console.log(lines.slice(-30).join('\n'));
}

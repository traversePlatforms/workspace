/* Claire's first 25 lawns to measure by hand (2026-11-21). Read-only over the local door files (traverse/app/data/rounds).
   Kinds that teach the yard model most: shaded suburban lots (Fair), wooded acreage, newer streets (built after the photo), and other
   Fair lots under trees. Colorado, within 45 miles of Englewood. Skips lots already hand-measured. Prints JSON (no owner names). */
const fs = require('fs'), path = require('path');
const R = process.argv[2], OUT = process.argv[3];
const EN = [39.6478, -104.9878];
const mi = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 3958.8 * 2 * Math.asin(Math.sqrt(x)); };
const DONE = new Set(['3855 S VALENTIA CT', '11663 N SETTLERS DR', '11663 SETTLERS DR', '2787 RUSSET SKY CT', '1648 MARSH HAWK CIR', '7378 UPTON CT', '6595 ZINNIA ST', '3247 OAK LEAF PL', '7006 E 131ST WAY', '7614 E 121ST PL',
  '579 E 76TH AVE', '3852 PRIMROSE LN', '6049 W ROXBURY PL', '6916 S ELATI ST', '600 HIDDENBROOK CT', '9267 CANYON WREN CT', '852 HUGHES LN', '9416 DESERT WILLOW TRL', '2195 E NICHOLS DR', '9353 PIKE WAY',
  '567 E 77TH PL', '651 POTOMAC ST', '9819 MEADE CIR', '449 S STUART ST', '9635 NEWCASTLE DR', '3184 S NEPAL WAY', '1730 S ROONEY RD', '9554 PENSTEMON CT', '17890 SIERRA WAY', '6431 S CEDAR ST', '375 LEFTHAND CANYON DR', '12405 W 19TH PL', '2644 S HOYT ST']);
const idx = JSON.parse(fs.readFileSync(path.join(R, 'index.json'), 'utf8'));
const towns = idx.regions.filter((r) => r.c && !r.metro && !/-lookup$/.test(r.key) && mi(EN[0], EN[1], r.c[0], r.c[1]) <= 50);
let seed = 20261121; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const C = { shade: [], wood: [], newer: [], fair: [] };
for (const t of towns) {
  const f = path.join(R, t.key + '.json'); if (!fs.existsSync(f)) continue;
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  for (const a of d.areas || []) for (const h of a.doors || []) {
    if (!h.lawn || h.lat == null || h.cg || DONE.has(String(h.address || '').toUpperCase())) continue;
    const m = mi(EN[0], EN[1], h.lat, h.lon); if (m > 45) continue;
    const L = h.lawn, T = h.trees || {}, tc = +T.z2 || 0, ac = +h.acres || 0;
    if (!/^\d+\s/.test(h.address || '')) continue;
    const base = { town: t.label, region: t.key, county: t.county || '', address: h.address, id: h.id, lat: h.lat, lon: h.lon, acres: ac, miles: Math.round(m), lawn: L.sq || 0, lv: L.lv || '', trees: Math.round(tc * 100), area: a.name, occ: h.occ || '' };
    if (L.nb && L.nb >= 2023 && ac >= 0.1 && ac <= 0.3) { C.newer.push({ ...base, kind: 'newer', why: 'Built ' + L.nb + ', after the ' + (L.yr || 2023) + ' photo: the card has no size', nb: L.nb }); continue; }
    if (!L.y || L.nb) continue;
    const fair = tc >= 0.35 || (L.lv === 'T' && tc >= 0.2);
    if (ac >= 1 && ac <= 5 && fair) C.wood.push({ ...base, kind: 'wood', why: 'Wooded acreage: ' + ac.toFixed(2) + ' acres, ' + Math.round(tc * 100) + '% tree cover near the house' });
    else if (ac >= 0.12 && ac <= 0.3 && tc >= 0.45 && /^[SML]$/.test(L.lv)) C.shade.push({ ...base, kind: 'shade', why: 'Shaded suburban lot: ' + Math.round(tc * 100) + '% tree cover near the house' });
    else if (ac > 0.3 && ac < 1 && fair && /^[SMLT]$/.test(L.lv)) C.fair.push({ ...base, kind: 'fair', why: 'Larger lot under trees: the card says Fair, ask them' });
  }
}
/* spread: one per town per kind, picked at random (seeded), owner-lived first */
const used = new Set();
const pick = (list, n) => { const byTown = {}; list.forEach((x) => (byTown[x.region] ||= []).push(x)); const ts = Object.keys(byTown).sort(() => rnd() - 0.5); const out = [];
  for (const t of ts) { if (out.length >= n) break; if (used.has(t)) continue; used.add(t); const L = byTown[t].filter((x) => x.occ === 'here'); const P = L.length ? L : byTown[t]; out.push(P[Math.floor(rnd() * P.length)]); }
  return out; };
const sel = [...pick(C.shade, 8), ...pick(C.wood, 6), ...pick(C.newer, 6), ...pick(C.fair, 5)];
console.error('pools: shade ' + C.shade.length + ', wood ' + C.wood.length + ', newer ' + C.newer.length + ', fair ' + C.fair.length + '; picked ' + sel.length);
fs.writeFileSync(OUT, JSON.stringify(sel.map(({ occ, ...x }) => x), null, 1));

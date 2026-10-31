#!/usr/bin/env node
/* Coverage audit (2026-10-31, Matthew: "find more work for the cloud machine"): for every town in the editions, per data layer, the share of
   homes that carry it. Read only: it reads the built files in editions/dist and app/data/rounds plus the local yard v2 results, and writes
     coverage-audit-<date>.json  every town, every layer (counts and shares)
     coverage-audit-<date>.md    the summary tables: layers by group, the lawn faults, the gaps the cloud machine can fill
   Usage (from anywhere): node coverage-audit.mjs [--root=<traverse folder>] [--out=<folder>] [--date=YYYY-MM-DD]
   --root defaults to the main checkout (the door files are not in git, so a worktree has none).
   No owner names are read into the output: only counts. */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = arg('root', 'C:/Users/Surge Inc/Desktop/claude test 2/traverse');
const OUT = arg('out', HERE);
const DATE = arg('date', new Date().toISOString().slice(0, 10));
const DT = join(ROOT, 'data-pipeline', 'door-territory');
const RD = join(ROOT, 'app', 'data', 'rounds');
const ED = join(ROOT, 'editions', 'dist');
const R = (d) => join(ED, d, 'rounds');

const J = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const index = J(join(R('traverse-data'), 'index.json')).regions;
const inEd = {}; for (const d of ['traverse-yards-data', 'traverse-solar-data', 'traverse-pest-data', 'traverse-security-data']) inEd[d] = new Set((J(join(R(d), 'index.json'))?.regions || []).map((r) => r.key));
const sixfold = new Set((J(join(RD, 'index.json'))?.regions || []).map((r) => r.key));
const yardV2Lawn = J(join(DT, 'lawn-trial', 'yard-v2-lawn.json')) || {};
const v2ByTown = {}; for (const k of Object.keys(yardV2Lawn)) { const t = k.slice(0, k.indexOf('/')); v2ByTown[t] = (v2ByTown[t] || 0) + 1; }
const hh = J(join(R('traverse-data'), 'hail-hours.json')) || { days: {} };
const hhDays = Object.keys(hh.days).sort(); const hhFrom = hhDays[0] || '9999';
const hhByTown = {}; for (const [day, towns] of Object.entries(hh.days)) for (const t of Object.keys(towns)) (hhByTown[t] ||= new Set()).add(day);

const group = (k) => (/^g1-/.test(k) ? 'G1' : /^g2-/.test(k) ? 'G2' : /^g3-/.test(k) ? 'G3' : /^com-/.test(k) ? 'commercial' : 'core');
/* side-file door count; filt(v) decides whether an entry counts (packed files hold JSON strings) */
function side(dir, prefix, key, filt) {
  const j = J(join(dir, `${prefix}-${key}.json`)); if (!j) return null;
  const d = j.doors || {}; if (!filt) return Object.keys(d).length;
  let n = 0; for (const v of Object.values(d)) { let x = v; if (typeof x === 'string' && (x[0] === '{' || x[0] === '[')) { try { x = JSON.parse(x); } catch {} } if (filt(x)) n++; }
  return n;
}

const towns = [];
for (const r of index) {
  const k = r.key, doors = r.doors;
  const t = { key: k, label: r.label, county: r.county, group: group(k), doors, sixfold: sixfold.has(k) };
  const df = J(join(R('traverse-data'), `${k}.json`));
  let n = 0, lawn = 0, trees = 0, lidar = 0, val = 0, acres = 0, v2door = 0; const ids = new Set();
  if (df) for (const a of df.areas) for (const d of a.doors) {
    n++; ids.add(d.id);
    if (d.lawn) lawn++; if (d.trees) { trees++; if (d.trees.src === 'lidar') lidar++; }
    if (d.val) val++; if (d.acres != null) acres++;
    if (yardV2Lawn[`${k}/${d.id}`]) v2door++;
  }
  t.doorFile = n;
  /* lot line: the yard v2 run's own lot lookup (null = no parcel found at the door) */
  const y = J(join(DT, 'lawn-trial', 'yard-v2', `${k}.json`));
  if (y) {
    const yd = y.doors || {}; let lot = 0, nul = 0, big = 0, shared = 0, tiny = 0, lots = [], lawns = [];
    for (const [id, v] of Object.entries(yd)) {
      if (!ids.has(id)) continue;
      if (v === null) { nul++; continue; }
      if (v.big) { big++; continue; }
      lot++; if (v.shared) shared++;
      if (v.lot) { lots.push(v.lot); lawns.push(v.l || 0); if ((v.l || 0) < 300) tiny++; }
    }
    const med = (a) => { if (!a.length) return null; a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const unmeasured = [...ids].filter((id) => !(id in yd)).length;
    t.yard = { built: y.built, lot: lot + big, noLot: nul, big, shared, unmeasured, tinyShare: lots.length ? +(tiny / lots.length).toFixed(3) : null, medLawn: med(lawns), medLot: med(lots) };
  } else t.yard = null;
  t.layers = {
    lot: t.yard ? t.yard.lot : null,
    acres,
    lawnV2: v2door,
    lawnAny: lawn,
    trees, treesLidar: lidar,
    roofOutline: side(R('traverse-data'), 'outline', k),
    roofSize: side(R('traverse-data'), 'roof', k),
    roofPhoto: (() => { const a = J(join(R('traverse-data'), `photo-${k}.json`)), b = J(join(R('traverse-data'), `naip-${k}.json`)); if (!a && !b) return null; return new Set([...Object.keys(a?.doors || {}), ...Object.keys(b?.doors || {})]).size; })(),
    roofPhotoDrapp: side(R('traverse-data'), 'photo', k),
    material: side(R('traverse-data'), 'material', k),
    yearBuilt: side(RD, 'year', k) ?? side(R('traverse-data'), 'year', k),
    homeValue: val,
    solar: inEd['traverse-solar-data'].has(k) ? side(R('traverse-solar-data'), 'solar', k, (x) => x && x.kw > 0) : null,
    solarUtilityOnly: inEd['traverse-solar-data'].has(k) ? side(R('traverse-solar-data'), 'solar', k, (x) => x && !(x.kw > 0)) : null,
    hail: side(R('traverse-data'), 'hail', k),
    hailReports: side(R('traverse-data'), 'hailrep', k),
    newMovers: side(R('traverse-data'), 'moved', k),
    permits: side(R('traverse-data'), 'permit', k),
    houseFacts: inEd['traverse-pest-data'].has(k) ? side(R('traverse-pest-data'), 'house', k) : null,
    pestFacts: inEd['traverse-pest-data'].has(k) ? side(R('traverse-pest-data'), 'pest', k) : null,
    lotFacts: inEd['traverse-security-data'].has(k) ? side(R('traverse-security-data'), 'security', k) : null,
  };
  /* hail hours: the town's hail days inside the hours file's period, and how many of them have hours */
  const hj = J(join(R('traverse-data'), `hail-${k}.json`));
  if (hj) {
    const days = new Set(); for (const v of Object.values(hj.doors || {})) for (const e of (Array.isArray(v) ? v : [])) if (Array.isArray(e) && e[0] >= hhFrom) days.add(e[0]);
    const have = hhByTown[k] || new Set();
    t.hailHours = { hailDays: days.size, withHours: [...days].filter((d) => have.has(d)).length, townDays: have.size };
  } else t.hailHours = null;
  towns.push(t);
}

const L = ['lot', 'lawnV2', 'trees', 'roofOutline', 'roofSize', 'roofPhoto', 'material', 'yearBuilt', 'homeValue', 'solar', 'hail', 'newMovers', 'permits', 'houseFacts', 'lotFacts'];
const label = { lot: 'Lot line', lawnV2: 'Lawn (yard v2)', trees: 'Trees', roofOutline: 'Roof outline', roofSize: 'Roof size/pitch', roofPhoto: 'Roof photo', material: 'Roof material', yearBuilt: 'Year built', homeValue: 'Home value', solar: 'Sun estimate', hail: 'Hail on record (0.75 in+)', newMovers: 'New movers', permits: 'Permits', houseFacts: 'House facts (Pest)', lotFacts: 'Lot facts (Security)' };
const sum = (arr, f) => arr.reduce((s, t) => s + (f(t) || 0), 0);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const fmt = (n) => n.toLocaleString('en-US');

/* the md file */
const totalDoors = sum(towns, (t) => t.doors);
const groups = ['core', 'G1', 'G2', 'G3', 'commercial'];
let md = `# Coverage audit, ${DATE}\n\nWhat share of homes carries each data layer, for every town in the editions (${towns.length} towns, ${fmt(totalDoors)} homes, from the Roofing index). Read only; built by \`coverage-audit.mjs\` from the local builds in \`editions/dist\`, \`app/data/rounds\` and \`lawn-trial/yard-v2\`. Every town and layer is in \`coverage-audit-${DATE}.json\`.\n\n`;
md += `How to read it:\n\n- **Lot line** = the yard v2 run found the house's parcel (lots over 5 acres count, as "big"). **Lawn (yard v2)** = the card's lawn figure comes from yard v2, not the older photo estimate.\n- **Roof photo, sun estimate, trees, roof layers** are measured for every home a source covers, so a low share is a gap. Roof photo counts the DRAPP close-up or the NAIP crop.\n- **Hail on record** lists only homes that had a 0.75 in+ storm on a kept day. Every town has been through the storm history (all 407 have a file), so a low share is weather, not a gap. **Hail hours** = the share of a town's storm days (since the hours file starts) that carry the hours.\n- **New movers, permits, house facts, lot facts** only exist where something happened or is nearby (a sale, a permit, a park within 90 m), so their shares are naturally partial; a dash means the town has no file at all.\n- Shares are of the town's homes in the Roofing index; Sixfold, Yards, Solar, Pest and Security carry the same doors (403 of the 407 towns: the 4 commercial towns are Roofing only).\n\n`;
md += `## By group\n\n| Layer | ${groups.map((g) => `${g} (${towns.filter((t) => t.group === g).length} towns, ${fmt(sum(towns.filter((t) => t.group === g), (t) => t.doors))} homes)`).join(' | ')} | All |\n|---|${groups.map(() => '---:').join('|')}|---:|\n`;
for (const l of L) {
  md += `| ${label[l]} | ${groups.map((g) => { const ts = towns.filter((t) => t.group === g); return pct(sum(ts, (t) => t.layers[l]), sum(ts, (t) => t.doors)); }).join(' | ')} | ${pct(sum(towns, (t) => t.layers[l]), totalDoors)} |\n`;
}
const hhT = towns.filter((t) => t.hailHours); const hd = sum(hhT, (t) => t.hailHours.hailDays), hw = sum(hhT, (t) => t.hailHours.withHours);
md += `| Hail hours (town hail days with hours) | ${groups.map((g) => { const ts = hhT.filter((t) => t.group === g); return pct(sum(ts, (t) => t.hailHours.withHours), sum(ts, (t) => t.hailHours.hailDays)); }).join(' | ')} | ${pct(hw, hd)} |\n\n`;
md += `Towns with no file for a layer (count of towns): ${L.filter((l) => !['lot', 'lawnV2', 'trees', 'homeValue'].includes(l)).map((l) => `${label[l]} ${towns.filter((t) => t.layers[l] == null).length}`).join(', ')}.\n\n`;

/* lawn faults */
const noLot = towns.filter((t) => t.yard && t.yard.noLot / t.doors >= 0.03).sort((a, b) => b.yard.noLot - a.yard.noLot);
md += `## Lawn and lot faults\n\nTowns where 3% or more of homes read "no lot" in yard v2, or where homes in the door file were never measured.\n\n| Town | County | Group | Homes | No lot | Never measured | Lawn under 300 sq ft (of lots) | Median lawn | yard v2 run |\n|---|---|---|---:|---:|---:|---:|---:|---|\n`;
const unm = towns.filter((t) => t.yard && t.yard.unmeasured > 0);
const faultSet = new Set([...noLot, ...unm.filter((t) => t.yard.unmeasured >= 20)]);
for (const t of [...faultSet].sort((a, b) => (b.yard.noLot + b.yard.unmeasured) - (a.yard.noLot + a.yard.unmeasured))) md += `| ${t.label} | ${t.county} | ${t.group} | ${fmt(t.doors)} | ${fmt(t.yard.noLot)} (${pct(t.yard.noLot, t.doors)}) | ${fmt(t.yard.unmeasured)} | ${t.yard.tinyShare == null ? '—' : Math.round(t.yard.tinyShare * 100) + '%'} | ${t.yard.medLawn ?? '—'} | ${t.yard.built} |\n`;
md += `\nTowns with no yard v2 file: ${towns.filter((t) => !t.yard).map((t) => `${t.label} (${t.doors})`).join(', ') || 'none'}.\n\n`;

/* per-town table */
md += `## Every town\n\nShares of the town's homes. "—" = no file for that town.\n\n| Town | Grp | County | Homes | ${L.map((l) => label[l].replace(/ \(.*\)/, '')).join(' | ')} | Hail hrs |\n|---|---|---|---:|${L.map(() => '---:').join('|')}|---:|\n`;
for (const t of [...towns].sort((a, b) => b.doors - a.doors)) {
  md += `| ${t.label} | ${t.group} | ${t.county} | ${fmt(t.doors)} | ${L.map((l) => (t.layers[l] == null ? '—' : pct(t.layers[l], t.doors))).join(' | ')} | ${t.hailHours ? pct(t.hailHours.withHours, t.hailHours.hailDays) : '—'} |\n`;
}
writeFileSync(join(OUT, `coverage-audit-${DATE}.json`), JSON.stringify({ built: DATE, towns: towns.length, homes: totalDoors, hailHoursFrom: hhFrom, layers: label, rows: towns }, null, 1));
/* a hand-written findings block (between <!-- findings --> and <!-- /findings -->) is kept when the file is written again */
const MDF = join(OUT, `coverage-audit-${DATE}.md`);
const old = existsSync(MDF) ? readFileSync(MDF, 'utf8') : '', fb = old.match(/<!-- findings -->[\s\S]*?<!-- \/findings -->\n*/);
if (fb) md = md.replace('## By group', fb[0] + '## By group');
writeFileSync(MDF, md);
console.log(`wrote coverage-audit-${DATE}.md/.json: ${towns.length} towns, ${totalDoors} homes`);

/* Batch 4 (2026-10-15, Matthew: "our focus right now should be a 45 mile radius around englewood"): every town and Census place inside
   45 miles of the 365 base (Englewood, 39.6533 -104.9916) that is not built or queued yet, closest first. Wires them into
   build-rounds-data.mjs, tree-zones/sample-trees.mjs and sample-value.mjs, and writes run-batch4-2026-10-16.sh, which waits for batch 3. */
const fs = require('fs');
const E = [39.6533, -104.9916];
const mi = (a, b) => { const R = 3958.8, t = (x) => x * Math.PI / 180, dl = t(b[0] - a[0]), dn = t(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
/* [slug, label, counties, lat, lon, radius mi, tree scan, kind] : kind 'm' = town by its legal boundary, 'c' = Census place (<slug>-cdp.json) */
const P = [
  ['bow-mar', 'Bow Mar', ['ARAPAHOE', 'JEFFERSON'], 39.626, -105.051, 1.0, 'drcog2', 'm'],
  ['columbine-valley', 'Columbine Valley', ['ARAPAHOE'], 39.601, -105.033, 1.2, 'drcog2', 'm'],
  ['glendale', 'Glendale', ['ARAPAHOE'], 39.705, -104.934, 0.9, 'drcog2', 'm'],
  ['morrison', 'Morrison', ['JEFFERSON'], 39.654, -105.191, 1.5, 'drcog2', 'm'],
  ['dove-valley', 'Dove Valley', ['ARAPAHOE'], 39.5804, -104.8214, 2.2, 'drcog2', 'c'],
  ['foxfield', 'Foxfield', ['ARAPAHOE'], 39.588, -104.786, 1.2, 'drcog2', 'm'],
  ['welby', 'Welby', ['ADAMS'], 39.8386, -104.9634, 1.4, 'drcog2', 'c'],
  ['sherrelwood', 'Sherrelwood', ['ADAMS'], 39.8393, -105.004, 1.27, 'drcog2', 'c'],
  ['twin-lakes', 'Twin Lakes', ['ADAMS'], 39.8232, -105.0041, 1.28, 'drcog2', 'c'],
  ['stonegate', 'Stonegate', ['DOUGLAS'], 39.5369, -104.8034, 1.17, 'douglas', 'c'],
  ['roxborough-park', 'Roxborough Park', ['DOUGLAS'], 39.4502, -105.0728, 2.97, 'douglas', 'c'],
  ['evergreen', 'Evergreen', ['JEFFERSON', 'CLEAR CREEK'], 39.6363, -105.3289, 3.76, 'drcog2', 'c'],
  ['the-pinery', 'The Pinery', ['DOUGLAS'], 39.4491, -104.7576, 3.81, 'douglas', 'c'],
  ['watkins', 'Watkins', ['ADAMS', 'ARAPAHOE'], 39.6958, -104.5745, 4.62, 'drcog2', 'c'],
  ['perry-park', 'Perry Park', ['DOUGLAS'], 39.2592, -104.9855, 2.5, 'douglas', 'c'],
  ['idaho-springs', 'Idaho Springs', ['CLEAR CREEK'], 39.743, -105.514, 1.8, 'drcog2', 'm'],
  ['lochbuie', 'Lochbuie', ['WELD', 'ADAMS'], 40.007, -104.716, 2.0, 'drcog2', 'm'],
  ['black-hawk', 'Black Hawk', ['GILPIN'], 39.797, -105.494, 1.5, 'drcog2', 'm'],
  ['elizabeth', 'Elizabeth', ['ELBERT'], 39.36, -104.597, 2.0, 'elbert', 'm'],
  ['central-city', 'Central City', ['GILPIN'], 39.802, -105.514, 2.0, 'drcog2', 'm'],
  ['gunbarrel', 'Gunbarrel', ['BOULDER'], 40.069, -105.1784, 2.86, 'drcog1', 'c'],
  ['dacono', 'Dacono', ['WELD'], 40.085, -104.94, 2.5, 'drcog2', 'm'],
  ['bennett', 'Bennett', ['ADAMS', 'ARAPAHOE'], 39.759, -104.427, 2.5, 'drcog2', 'm'],
  ['frederick', 'Frederick', ['WELD'], 40.099, -104.95, 3.0, 'drcog2', 'm'],
  ['fort-lupton', 'Fort Lupton', ['WELD'], 40.085, -104.813, 3.0, 'drcog2', 'm'],
  ['firestone', 'Firestone', ['WELD'], 40.13, -104.94, 3.5, 'drcog2', 'm'],
  ['niwot', 'Niwot', ['BOULDER'], 40.1017, -105.1595, 1.73, 'drcog1', 'c'],
  ['hudson', 'Hudson', ['WELD'], 40.074, -104.643, 2.0, 'drcog2', 'm'],
  ['nederland', 'Nederland', ['BOULDER'], 39.961, -105.511, 1.5, 'drcog1', 'm'],
  ['kiowa', 'Kiowa', ['ELBERT'], 39.347, -104.464, 1.2, 'elbert', 'm'],
  ['strasburg', 'Strasburg', ['ADAMS', 'ARAPAHOE'], 39.7168, -104.3121, 3.98, 'drcog2', 'c'],
  ['platteville', 'Platteville', ['WELD'], 40.215, -104.823, 1.8, 'drcog2', 'm'],
  ['mead', 'Mead', ['WELD'], 40.233, -104.999, 3.0, 'drcog1', 'm'],
  ['keenesburg', 'Keenesburg', ['WELD'], 40.108, -104.52, 1.8, 'drcog2', 'm'],
  ['byers', 'Byers', ['ARAPAHOE'], 39.7101, -104.219, 2.31, 'drcog2', 'c'],
  ['lyons', 'Lyons', ['BOULDER'], 40.225, -105.271, 1.5, 'drcog1', 'm'],
].map((x) => x.concat([mi(E, [x[3], x[4]])])).filter((x) => x[8] <= 45).sort((a, b) => a[8] - b[8]);

const edit = (f, a, b, mark) => { let s = fs.readFileSync(f, 'utf8'); if (s.includes(mark)) { console.log('already ' + f); return; } const c = s.split(a).length - 1; if (c !== 1) { console.error('COUNT ' + c + ' ' + f + ': ' + a.slice(0, 80)); process.exit(1); } fs.writeFileSync(f, s.replace(a, () => b)); console.log('ok ' + f); };
/* build-rounds-data.mjs: the towns and their centres */
edit('build-rounds-data.mjs', "  ['columbine', 'Columbine', 'columbine-areas.json', 'columbine'],",
  "  ['columbine', 'Columbine', 'columbine-areas.json', 'columbine'],\n  /* 2026-10-16 batch 4 (Matthew: the 45 miles around Englewood): towns and Census places not built before, closest first */\n" +
  P.map((x) => `  ['${x[0]}', '${x[1]}', '${x[0]}-areas.json', '${x[0]}'],`).join('\n'), "['bow-mar', 'Bow Mar'");
edit('build-rounds-data.mjs', "'columbine': [39.582, -105.0646],", "'columbine': [39.582, -105.0646],   " + P.map((x) => `'${x[0]}': [${x[3]}, ${x[4]}],`).join(' '), "'bow-mar': [");
/* sample-trees.mjs: which laser scan each uses (Elbert has none we know of: the canopy map) */
edit('tree-zones/sample-trees.mjs', "longmont: 'drcog1',   /* the 365 area towns, 2026-10-15 */",
  "longmont: 'drcog1',   /* the 365 area towns, 2026-10-15 */\n  " + P.map((x) => `'${x[0]}': '${x[6]}',`).join(' ') + "   /* batch 4, 2026-10-16 */", "'bow-mar': 'drcog2'");
/* sample-value.mjs: the counties whose values the state layer carries (Elbert, Gilpin and Clear Creek are not wired) */
const byC = {}; P.forEach((x) => x[2].forEach((c) => { const k = c.toLowerCase(); if (['douglas', 'jefferson', 'adams', 'arapahoe', 'weld', 'boulder'].includes(k)) (byC[k] = byC[k] || []).push(x[0]); }));
edit('sample-value.mjs', "TOWNS.douglas.push('littleton', 'lone-tree');",
  "TOWNS.douglas.push('littleton', 'lone-tree');\n" + Object.entries(byC).map(([k, v]) => `TOWNS.${k}.push(${v.map((t) => `'${t}'`).join(', ')});`).join(' ') + "   /* batch 4, 2026-10-16 */", 'batch 4, 2026-10-16');

/* the run script */
const q = (s) => `'${s.replace(/'/g, "'\\''")}'`;
let sh = `#!/bin/bash
# Batch 4 (2026-10-16, Matthew: "our focus right now should be a 45 mile radius around englewood"), after batch 3 (logs-batch3/done.flag):
# ${P.length} towns and Census places inside 45 miles of Englewood not built before, closest first. One job at a time against the state's
# parcel service. Door lists by legal boundary (towns) or Census boundary (<slug>-cdp.json), neighbourhoods, lawns, office-lookup lists,
# trees, county values (Elbert, Gilpin, Clear Creek have none wired), then the rebuild. Uploading is by hand. Made by make-batch4.cjs.
set -u
cd "$(dirname "$0")"
L=logs-batch4; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\\r' '\\n' | tail -1 | cut -c1-150)"; }
until [ -f logs-batch3/done.flag ]; do sleep 60; done
rest() { local t=$1; [ -s "$t.csv" ] || { echo "$(date +%H:%M:%S) skip  $t (no doors)"; return; }
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "lookup-$t" node build-lookup.mjs "$t"
  step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; }
`;
for (const x of P) {
  const [slug, label, cs, lat, lon, r, , kind, d] = x;
  sh += `# ${label}, ${d.toFixed(1)} mi\n`;
  const outs = [];
  cs.forEach((c, i) => {
    const out = cs.length > 1 ? `${slug}-${c.toLowerCase().replace(/ /g, '-')}.csv` : `${slug}.csv`; outs.push(out);
    const flt = kind === 'm' ? `--municipality=${q(label)}` : `--pieces=${slug}-cdp.json`;
    sh += `step pull-${slug}${cs.length > 1 ? '-' + (i + 1) : ''} node build-walklist-co.mjs --county=${q(c)} --lat=${lat} --lon=${lon} --radius=${r} --min-acres=0.12 ${flt} --out=${out}\n`;
  });
  if (outs.length > 1) sh += `node merge-walklists.mjs ${slug}.csv $(ls ${outs.join(' ')} 2>/dev/null) > "$L/merge-${slug}.log" 2>&1\n`;
  sh += `rest ${slug}\n`;
}
const vals = P.filter((x) => x[2].some((c) => ['DOUGLAS', 'JEFFERSON', 'ADAMS', 'ARAPAHOE', 'WELD', 'BOULDER'].includes(c))).map((x) => x[0]);
sh += `step values node sample-value.mjs --only=${vals.join(',')}\nstep rounds node build-rounds-data.mjs\necho "$(date +%H:%M:%S) all done"; touch "$L/done.flag"\n`;
fs.writeFileSync('run-batch4-2026-10-16.sh', sh);
console.log('wrote run-batch4-2026-10-16.sh:', P.length, 'places,', P[0][0], P[0][8].toFixed(1) + ' mi to', P[P.length - 1][0], P[P.length - 1][8].toFixed(1) + ' mi');

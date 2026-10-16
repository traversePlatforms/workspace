/* Batch 5 (2026-10-15 night, Matthew: "our focus right now should be a 45 mile radius around englewood"): everything left inside 45 miles
   of Englewood in one run, closest first and in passes, so the new towns are usable as early as possible:
     1. door lists, neighbourhoods, lawns, office-lookup lists for every new place (fast)
     2. county values for them, then the rebuild  -> logs-batch5/ready.flag (the towns can go up)
     3. trees for the new places, closest first, then the rest of Boulder (its laser tiles were not on disk: slow)
     4. the rebuild again -> logs-batch5/done.flag
   Replaces run-batch2b (from Broomfield on), run-batch3 and run-batch4. The places are already wired into build-rounds-data.mjs,
   tree-zones/sample-trees.mjs and sample-value.mjs (make-batch4.cjs for the new ones). */
const fs = require('fs');
const E = [39.6533, -104.9916];
const mi = (a, b) => { const R = 3958.8, t = (x) => x * Math.PI / 180, dl = t(b[0] - a[0]), dn = t(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
/* [slug, label, [[county, lat, lon, radius], ...], kind 'm' town boundary | 'c' Census place] */
const P = [
  ['federal-heights', 'Federal Heights', [['ADAMS', 39.865, -105.015, 2]], 'm'],
  ['northglenn', 'Northglenn', [['ADAMS', 39.90, -104.98, 3]], 'm'],
  ['broomfield', 'Broomfield', [['BROOMFIELD', 39.94, -105.06, 6]], 'm'],
  ['superior', 'Superior', [['BOULDER', 39.93, -105.16, 2]], 'm'],
  ['louisville', 'Louisville', [['BOULDER', 39.975, -105.14, 3]], 'm'],
  ['lafayette', 'Lafayette', [['BOULDER', 39.995, -105.10, 3]], 'm'],
  ['brighton', 'Brighton', [['ADAMS', 39.97, -104.80, 5], ['WELD', 40.02, -104.80, 3]], 'm'],
  ['longmont', 'Longmont', [['BOULDER', 40.17, -105.11, 6], ['WELD', 40.17, -105.03, 3]], 'm'],
  ['ken-caryl', 'Ken Caryl', [['JEFFERSON', 39.5796, -105.1201, 3]], 'c'],
  ['columbine', 'Columbine', [['JEFFERSON', 39.582, -105.0646, 2.5]], 'c'],
  ['bow-mar', 'Bow Mar', [['ARAPAHOE', 39.626, -105.051, 1.0], ['JEFFERSON', 39.626, -105.051, 1.0]], 'm'],
  ['columbine-valley', 'Columbine Valley', [['ARAPAHOE', 39.601, -105.033, 1.2]], 'm'],
  ['glendale', 'Glendale', [['ARAPAHOE', 39.705, -104.934, 0.9]], 'm'],
  ['morrison', 'Morrison', [['JEFFERSON', 39.654, -105.191, 1.5]], 'm'],
  ['dove-valley', 'Dove Valley', [['ARAPAHOE', 39.5804, -104.8214, 2.2]], 'c'],
  ['foxfield', 'Foxfield', [['ARAPAHOE', 39.588, -104.786, 1.2]], 'm'],
  ['welby', 'Welby', [['ADAMS', 39.8386, -104.9634, 1.4]], 'c'],
  ['sherrelwood', 'Sherrelwood', [['ADAMS', 39.8393, -105.004, 1.27]], 'c'],
  ['twin-lakes', 'Twin Lakes', [['ADAMS', 39.8232, -105.0041, 1.28]], 'c'],
  ['stonegate', 'Stonegate', [['DOUGLAS', 39.5369, -104.8034, 1.17]], 'c'],
  ['roxborough-park', 'Roxborough Park', [['DOUGLAS', 39.4502, -105.0728, 2.97]], 'c'],
  ['evergreen', 'Evergreen', [['JEFFERSON', 39.6363, -105.3289, 3.76], ['CLEAR CREEK', 39.6363, -105.3289, 3.76]], 'c'],
  ['the-pinery', 'The Pinery', [['DOUGLAS', 39.4491, -104.7576, 3.81]], 'c'],
  ['watkins', 'Watkins', [['ADAMS', 39.6958, -104.5745, 4.62], ['ARAPAHOE', 39.6958, -104.5745, 4.62]], 'c'],
  ['perry-park', 'Perry Park', [['DOUGLAS', 39.2592, -104.9855, 2.5]], 'c'],
  ['idaho-springs', 'Idaho Springs', [['CLEAR CREEK', 39.743, -105.514, 1.8]], 'm'],
  ['lochbuie', 'Lochbuie', [['WELD', 40.007, -104.716, 2.0], ['ADAMS', 40.007, -104.716, 2.0]], 'm'],
  ['black-hawk', 'Black Hawk', [['GILPIN', 39.797, -105.494, 1.5]], 'm'],
  ['elizabeth', 'Elizabeth', [['ELBERT', 39.36, -104.597, 2.0]], 'm'],
  ['central-city', 'Central City', [['GILPIN', 39.802, -105.514, 2.0]], 'm'],
  ['gunbarrel', 'Gunbarrel', [['BOULDER', 40.069, -105.1784, 2.86]], 'c'],
  ['dacono', 'Dacono', [['WELD', 40.085, -104.94, 2.5]], 'm'],
  ['bennett', 'Bennett', [['ADAMS', 39.759, -104.427, 2.5], ['ARAPAHOE', 39.759, -104.427, 2.5]], 'm'],
  ['frederick', 'Frederick', [['WELD', 40.099, -104.95, 3.0]], 'm'],
  ['fort-lupton', 'Fort Lupton', [['WELD', 40.085, -104.813, 3.0]], 'm'],
  ['firestone', 'Firestone', [['WELD', 40.13, -104.94, 3.5]], 'm'],
  ['niwot', 'Niwot', [['BOULDER', 40.1017, -105.1595, 1.73]], 'c'],
  ['hudson', 'Hudson', [['WELD', 40.074, -104.643, 2.0]], 'm'],
  ['nederland', 'Nederland', [['BOULDER', 39.961, -105.511, 1.5]], 'm'],
  ['kiowa', 'Kiowa', [['ELBERT', 39.347, -104.464, 1.2]], 'm'],
  ['strasburg', 'Strasburg', [['ADAMS', 39.7168, -104.3121, 3.98], ['ARAPAHOE', 39.7168, -104.3121, 3.98]], 'c'],
  ['platteville', 'Platteville', [['WELD', 40.215, -104.823, 1.8]], 'm'],
  ['mead', 'Mead', [['WELD', 40.233, -104.999, 3.0]], 'm'],
  ['keenesburg', 'Keenesburg', [['WELD', 40.108, -104.52, 1.8]], 'm'],
  ['byers', 'Byers', [['ARAPAHOE', 39.7101, -104.219, 2.31]], 'c'],
  ['lyons', 'Lyons', [['BOULDER', 40.225, -105.271, 1.5]], 'm'],
].map((x) => x.concat([mi(E, [x[2][0][1], x[2][0][2]])])).sort((a, b) => a[4] - b[4]);
const VALUE_COUNTIES = ['DOUGLAS', 'JEFFERSON', 'ADAMS', 'ARAPAHOE', 'WELD', 'BOULDER'];
const q = (s) => `'${s.replace(/'/g, "'\\''")}'`;
let sh = `#!/bin/bash
# Batch 5 (2026-10-15 night, Matthew: "our focus right now should be a 45 mile radius around englewood"). Made by make-batch5.cjs.
# ${P.length} places, closest to Englewood first, in passes: 1 door lists/lawns/lookups, 2 values + rebuild (ready.flag), 3 trees, 4 rebuild (done.flag).
# One job at a time against the state's parcel service. Uploading is by hand.
set -u
cd "$(dirname "$0")"
L=logs-batch5; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\\r' '\\n' | tail -1 | cut -c1-150)"; }
echo "== pass 1: door lists, neighbourhoods, lawns, office lookup"
`;
for (const [slug, label, cs, kind, d] of P) {
  sh += `# ${label}, ${d.toFixed(1)} mi\nif [ -s ${slug}-areas.json ] && [ -s ${slug}.csv ]; then echo "$(date +%H:%M:%S) have  ${slug}"; else\n`;
  const outs = [];
  cs.forEach(([c, lat, lon, r], i) => {
    const out = cs.length > 1 ? `${slug}-${c.toLowerCase().replace(/ /g, '-')}.csv` : `${slug}.csv`; outs.push(out);
    const flt = kind === 'm' ? `--municipality=${q(label)}` : `--pieces=${slug}-cdp.json`;
    sh += `  step pull-${slug}${cs.length > 1 ? '-' + (i + 1) : ''} node build-walklist-co.mjs --county=${q(c)} --lat=${lat} --lon=${lon} --radius=${r} --min-acres=0.12 ${flt} --out=${out}\n`;
  });
  if (outs.length > 1) sh += `  node merge-walklists.mjs ${slug}.csv $(ls ${outs.join(' ')} 2>/dev/null) > "$L/merge-${slug}.log" 2>&1\n`;
  sh += `  if [ -s ${slug}.csv ]; then step areas-${slug} node build-walklist-pdf.mjs ${slug}.csv --no-pdf; step lawn-${slug} bash -c "cd lawn-trial && node sample-lawn.mjs --town=${slug} --conc=16"; step lookup-${slug} node build-lookup.mjs ${slug}; else echo "$(date +%H:%M:%S) skip  ${slug} (no doors)"; fi\nfi\n`;
}
const vals = P.filter((x) => x[2].some((c) => VALUE_COUNTIES.includes(c[0]))).map((x) => x[0]);
sh += `echo "== pass 2: county values, rebuild"\nstep values node sample-value.mjs --only=${vals.join(',')}\nstep rounds1 node build-rounds-data.mjs\ntouch "$L/ready.flag"\n`;
sh += `echo "== pass 3: trees, closest first, then the rest of Boulder"\n`;
for (const [slug] of P) sh += `[ -s ${slug}-areas.json ] && step trees-${slug} bash -c "cd tree-zones && node sample-trees.mjs --town=${slug} --conc=6"\n`;
sh += `step trees-boulder bash -c "cd tree-zones && node sample-trees.mjs --town=boulder --conc=6"\nstep rounds2 node build-rounds-data.mjs\necho "$(date +%H:%M:%S) all done"; touch "$L/done.flag"\n`;
fs.writeFileSync('run-batch5-2026-10-15.sh', sh);
console.log('wrote run-batch5-2026-10-15.sh:', P.length, 'places:', P.map((x) => x[0] + ' ' + x[4].toFixed(0)).join(', '));

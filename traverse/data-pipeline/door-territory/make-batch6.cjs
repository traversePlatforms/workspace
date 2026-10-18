/* Batch 6 (2026-10-18, Matthew: "go ahead and pull the 10 close-in gaps places first"): the unincorporated Census places inside 45 miles of
   Englewood that the town pulls missed (a town pull keeps its own legal boundary or city name, so these fell between towns). Found by a
   check of every Census place in the circle against our doors (scratchpad gaz/cover.cjs): Dakota Ridge 13,488 homes with ~100 doors, Four
   Square Mile 10,634 with ~350, and so on. All lot sizes (min 0, the 10-acre cap kept), as run-allsizes.
   Wires them into build-rounds-data.mjs, tree-zones/sample-trees.mjs and sample-value.mjs, and writes run-batch6-2026-10-18.sh:
     1 door lists by Census boundary (<slug>-cdp.json from fetch-cdp.mjs), neighbourhoods, lawns, lawn fill, office lookup
     2 county values, rebuild, upload the new places AND any town that handed doors to them (the rebuild gives a door listed twice to
       the nearest centre; the town that lost it has to go up too, or the live copy keeps it)
     3 compact lawn pass and trees, rebuild, upload again
     4 then the refine pass resumes (run-refine-2026-10-16.sh, paused for this at 08:20)
   One job at a time against the state's parcel service. */
const fs = require('fs');
const E = [39.6533, -104.9916];
const mi = (a, b) => { const R = 3958.8, t = (x) => x * Math.PI / 180, dl = t(b[0] - a[0]), dn = t(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(t(a[0])) * Math.cos(t(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
/* [slug, label, counties, lat, lon, radius mi (fetch-cdp.mjs), tree scan] */
const P = [
  ['holly-hills', 'Holly Hills', ['ARAPAHOE'], 39.6663, -104.9234, 0.82, 'drcog2'],
  ['four-square-mile', 'Four Square Mile', ['ARAPAHOE'], 39.6812, -104.8910, 1.37, 'drcog2'],
  ['cherry-creek', 'Cherry Creek', ['ARAPAHOE'], 39.6106, -104.8656, 1.07, 'drcog2'],
  ['dakota-ridge', 'Dakota Ridge', ['JEFFERSON'], 39.6212, -105.1410, 2.54, 'drcog2'],
  ['acres-green', 'Acres Green', ['DOUGLAS'], 39.5565, -104.8952, 0.80, 'douglas'],
  ['inverness', 'Inverness', ['ARAPAHOE', 'DOUGLAS'], 39.5768, -104.8671, 0.86, 'drcog2'],
  ['meridian', 'Meridian', ['DOUGLAS'], 39.5449, -104.8543, 1.41, 'douglas'],
  ['berkley', 'Berkley', ['ADAMS'], 39.8069, -105.0297, 1.44, 'drcog2'],
  ['sterling-ranch', 'Sterling Ranch', ['DOUGLAS'], 39.4944, -105.0499, 2.17, 'douglas'],
  ['derby', 'Derby', ['ADAMS'], 39.8396, -104.9150, 1.54, 'drcog2'],
].map((x) => x.concat([mi(E, [x[3], x[4]])])).sort((a, b) => a[7] - b[7]);
for (const [s] of P) if (!fs.existsSync(s + '-cdp.json')) { console.error('no ' + s + '-cdp.json: run fetch-cdp.mjs first'); process.exit(1); }

const edit = (f, a, b, mark) => { let s = fs.readFileSync(f, 'utf8'); if (s.includes(mark)) { console.log('already ' + f); return; } const c = s.split(a).length - 1; if (c !== 1) { console.error('COUNT ' + c + ' ' + f + ': ' + a.slice(0, 80)); process.exit(1); } fs.writeFileSync(f, s.replace(a, () => b)); console.log('wired ' + f); };
edit('build-rounds-data.mjs', "  ['columbine', 'Columbine', 'columbine-areas.json', 'columbine'],",
  "  ['columbine', 'Columbine', 'columbine-areas.json', 'columbine'],\n  /* 2026-10-18 batch 6 (Matthew: the close-in places between towns, inside the 45 miles) */\n" +
  P.map((x) => `  ['${x[0]}', '${x[1]}', '${x[0]}-areas.json', '${x[0]}'],`).join('\n'), "['dakota-ridge', 'Dakota Ridge'");
edit('build-rounds-data.mjs', "'columbine': [39.582, -105.0646],", "'columbine': [39.582, -105.0646],   " + P.map((x) => `'${x[0]}': [${x[3]}, ${x[4]}],`).join(' '), "'dakota-ridge': [");
edit('tree-zones/sample-trees.mjs', "longmont: 'drcog1',   /* the 365 area towns, 2026-10-15 */",
  "longmont: 'drcog1',   /* the 365 area towns, 2026-10-15 */\n  " + P.map((x) => `'${x[0]}': '${x[6]}',`).join(' ') + "   /* batch 6, 2026-10-18 */", "'dakota-ridge': '");
const byC = {}; P.forEach((x) => x[2].forEach((c) => { const k = c.toLowerCase(); if (['douglas', 'jefferson', 'adams', 'arapahoe', 'weld', 'boulder'].includes(k)) (byC[k] = byC[k] || []).push(x[0]); }));
edit('sample-value.mjs', "TOWNS.douglas.push('littleton', 'lone-tree');",
  "TOWNS.douglas.push('littleton', 'lone-tree');\n" + Object.entries(byC).map(([k, v]) => `TOWNS.${k}.push(${v.map((t) => `'${t}'`).join(', ')});`).join(' ') + "   /* batch 6, 2026-10-18 */", 'batch 6, 2026-10-18');

const q = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const ALL = P.map((x) => x[0]).join(' ');
let sh = `#!/bin/bash
# Batch 6 (2026-10-18, Matthew: "go ahead and pull the 10 close-in gaps places first"). Made by make-batch6.cjs. ${P.length} unincorporated
# Census places inside 45 miles of Englewood, closest first, all lot sizes; then the refine pass resumes.
set -u
cd "$(dirname "$0")"
L=logs-batch6; mkdir -p "$L"
step() { local name=$1; shift; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\\r' '\\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: \${SSID:-wired}"
bash hotspot-watchdog2.sh run-batch6 > "$L/watchdog.log" 2>&1 &
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
cp shared-towns.json "$L/shared-towns.before.json"
echo "== 1: door lists, neighbourhoods, lawns, lookup"
`;
for (const [slug, label, cs, lat, lon, r, , d] of P) {
  sh += `# ${label}, ${d.toFixed(1)} mi\necho "$(date +%T) == ${slug}"\n`;
  const outs = [];
  cs.forEach((c, i) => {
    const out = cs.length > 1 ? `${slug}-${c.toLowerCase().replace(/ /g, '-')}.csv` : `${slug}.csv`; outs.push(out);
    sh += `step pull-${slug}${cs.length > 1 ? '-' + (i + 1) : ''} node build-walklist-co.mjs --county=${q(c)} --lat=${lat} --lon=${lon} --radius=${r} --min-acres=0 --pieces=${slug}-cdp.json --out=${out}\n`;
  });
  if (outs.length > 1) sh += `node merge-walklists.mjs ${slug}.csv $(ls ${outs.join(' ')} 2>/dev/null) > "$L/merge-${slug}.log" 2>&1\n`;
  sh += `echo "$(date +%T) ${slug}: $(rows ${slug}.csv) doors"\n`;
  sh += `if [ "$(rows ${slug}.csv)" -gt 0 ]; then step areas-${slug} node build-walklist-pdf.mjs ${slug}.csv --no-pdf; step lawn-${slug} bash -c "cd lawn-trial && node sample-lawn.mjs --town=${slug} --conc=16"; step lawnfill-${slug} bash -c "cd lawn-trial && node lawn-fill.mjs --town=${slug} --conc=6"; step lookup-${slug} node build-lookup.mjs ${slug}; else echo "$(date +%T) skip  ${slug} (no doors)"; fi\n`;
}
const vals = P.map((x) => x[0]).join(',');
sh += `echo "== 2: values, rebuild, upload"
step values node sample-value.mjs --only=${vals}
step rounds1 node build-rounds-data.mjs
NEW=""; for t in ${ALL}; do [ -s "../../app/data/rounds/$t.json" ] && NEW="$NEW $t"; done
PARTNERS=$(node -e "const a=require('./$L/shared-towns.before.json'),b=require('./shared-towns.json'),n=new Set(process.argv.slice(1)),o=new Set();for(const k of n)for(const p of (b[k]||[]))if(!n.has(p))o.add(p);for(const [k,v] of Object.entries(b))if(!n.has(k))for(const p of v)if(n.has(p)&&!(a[k]||[]).includes(p))o.add(k);console.log([...o].join(' '))" $NEW)
echo "$(date +%T) new: $NEW | towns that gave doors to them: $PARTNERS"
up() { for k in 1 2 3; do bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$1.done" ] && return 0; echo "$(date +%T) upload $1 failed, try $k"; sleep 120; done; return 1; }
up batch6-doors $NEW $PARTNERS
echo "== 3: compact lawn pass, trees, rebuild, upload"
for t in $NEW; do step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=6"; step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step rounds2 node build-rounds-data.mjs
up batch6-trees $NEW $PARTNERS
echo "$(date +%T) batch 6 done"
echo "== 4: the refine pass resumes"
bash run-refine-2026-10-16.sh > logs-refine-runner2.log 2>&1
echo "$(date +%T) refine finished"
`;
fs.writeFileSync('run-batch6-2026-10-18.sh', sh);
console.log('wrote run-batch6-2026-10-18.sh:', P.map((x) => x[0] + ' ' + x[7].toFixed(1)).join(', '));

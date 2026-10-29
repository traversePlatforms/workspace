#!/bin/bash
# Finish Group 3 stage B on the laptop (2026-10-29). Stage g3b in traverse/ops/run-cloud-finishers.sh since Matthew's go (29 Oct: "add the group 3"); before that: Matthew sees the counts
# first, then gives the go for group3/stageb-vm.sh on the cloud machine; this runs after it leaves ~/run/group3/g3stageb.vmdone.
# Modelled on finish-g2b-2026-10-28.sh.   bash finish-g3b-2026-10-29.sh > logs-finish-g3b.log 2>&1
#   1. copies back b/ (the stage B door lists, registered.json, merge lists, limited-<key>.json), the neighbourhood files, yard v2, material
#      and close-up photo files and house centres for the new towns, and merges the tree / roof / solar / value caches (a cloud reading
#      fills a gap or replaces an error; a local reading is never overwritten; backups first);
#   2. merges the new doors into our own towns (group3/merge-into-town.mjs: cripple-creek, idaho-springs, woodland-park, florissant,
#      divide; appended neighbourhoods, existing doors untouched, backups);
#   3. registers the new towns (group3/registered.json, read by build-rounds-data.mjs; county in assessor/town-county.json; laser keys);
#   4. builds the door files and layers, checks every town is in the index with doors;
#   5. uploads to Sixfold (upload-towns-sixfold.sh, batches of 8; the merged towns too) and each edition (push-edition.sh with the g3- towns
#      and the merged towns only);
#   6. live-checks one door list per method (co, ap, address points).
# Not done here: storm history for the new towns (hail/BACKFILL-HAIL: stage their door points, re-run backfill-hail.mjs build on the cloud
# machine from the statewide day files already there, merge-storms.py, push); the app's COUNTY_NAME for the new counties; the app's
# "Limited data" label (limited-<key>.json lists which doors, GROUP3-PLAN "For the app").
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
$VM 'test -f ~/run/group3/g3stageb.vmdone' < /dev/null || { step "stage B is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
mkdir -p "$S"
step "copy back"
$VM 'cd ~/run && T=tv/traverse; D=$T/data-pipeline/door-territory; L=$(cat group3/b/b-towns.txt); M=$(cat group3/b/merge-towns.txt); tar czf - group3/b $(for k in $L; do for f in $D/$k-areas.json lawn-trial/yard-v2/$k.json $T/app/data/rounds/material-$k.json $T/app/data/rounds/naip-$k.json $D/roofs/houses-$k.json; do [ -f $f ] && echo $f; done; done) $(for m in $M; do [ -f $D/merge-$m-areas.json ] && echo $D/merge-$m-areas.json; done) $(for f in $D/tree-cache.json $D/tree-zones/town-surveys-extra.json $D/roofs/roof-cache.json $D/solar/solar-cache.json $D/value-cache.json; do [ -f $f ] && echo $f; done)' < /dev/null > "$S/g3back.tgz" || exit 1
rm -rf "$S/g3back" && mkdir -p "$S/g3back" && tar xzf "$S/g3back.tgz" -C "$S/g3back" || exit 1
B="$S/g3back"; T="$B/tv/traverse/data-pipeline/door-territory"
mkdir -p group3/b && cp -r "$B/group3/b/." group3/b/ && cp group3/b/registered.json group3/registered.json
KEYS=$(cat group3/b/b-towns.txt); MERGE=$(cat group3/b/merge-towns.txt); step "new towns: $(echo $KEYS | wc -w); merged into: $(echo $MERGE)"
n=0; for k in $KEYS; do
  cp "group3/b/$k.csv" "$k.csv" && cp "$T/$k-areas.json" "$k-areas.json" || { step "missing door list or neighbourhoods for $k"; exit 1; }
  [ -f "$B/lawn-trial/yard-v2/$k.json" ] && cp "$B/lawn-trial/yard-v2/$k.json" "lawn-trial/yard-v2/$k.json" && n=$((n+1))
  for f in material naip; do [ -f "$B/tv/traverse/app/data/rounds/$f-$k.json" ] && cp "$B/tv/traverse/app/data/rounds/$f-$k.json" "$RD/$f-$k.json"; done
  [ -f "$T/roofs/houses-$k.json" ] && cp "$T/roofs/houses-$k.json" "roofs/houses-$k.json"
done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json" "value-cache.json:$T/value-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$cl" ] || { step "no cloud $loc"; continue; }; [ -f "$loc" ] && cp "$loc" "$loc.before-g3b-$(date +%Y%m%d)"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
node -e "const fs=require('fs');const a='tree-zones/town-surveys-extra.json';const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(C))if(!(k in L)){L[k]=v;n++}fs.writeFileSync(a,JSON.stringify(L));console.log(a,'+',n)" "$T/tree-zones/town-surveys-extra.json" || exit 1
step "merge into our towns"
for m in $MERGE; do [ -f "$T/merge-$m-areas.json" ] && node group3/merge-into-town.mjs "$m" "$T/merge-$m-areas.json" || step "no new neighbourhoods for $m"; done
node -e "const fs=require('fs');const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));let n=0;for(const t of JSON.parse(fs.readFileSync('group3/registered.json')))if(!tc[t.key]){tc[t.key]=[t.county];n++}fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1)+'\n');console.log('counties registered:',n)"
step "build"; (cd lawn-trial && node build-yard-v2.mjs | head -1)
node --max-old-space-size=8192 assessor/build-year.mjs | tail -1
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two" || exit 1
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
node --max-old-space-size=8192 pest/build-pest.mjs | tail -1; node --max-old-space-size=8192 build-others.mjs $KEYS | tail -3
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 photo-index.mjs build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)
step "index check"
node -e "
const fs=require('fs');const idx=JSON.parse(fs.readFileSync('$RD/index.json'));const keys=process.argv.slice(1);const by=Object.fromEntries(idx.regions.map((r)=>[r.key,r]));
const bad=keys.filter((k)=>!by[k]||!(by[k].doors>0));const cty={};for(const t of JSON.parse(fs.readFileSync('group3/registered.json')))cty[t.key]=t.county;
const per={};let tot=0;for(const k of keys)if(by[k]&&cty[k]){per[cty[k]]=(per[cty[k]]||0)+by[k].doors;tot+=by[k].doors}
fs.writeFileSync('group3/built-counts.json',JSON.stringify(Object.fromEntries(keys.map((k)=>[k,by[k]?by[k].doors:0])),null,1));
console.log('new-town doors by county',JSON.stringify(per),'total',tot,'| towns missing or empty:',bad.join(' ')||'none');if(bad.length)process.exit(1)" $KEYS $MERGE || { step "STOP: towns missing from the index"; exit 1; }
step "upload to Sixfold"
set -- $KEYS $MERGE; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "group3-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
# the new towns and the merged towns with their side files, but NEVER hail-<town>.json: the server's storm job owns those
RX="^((census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-)?(g3-[a-z0-9-]+|$(echo $MERGE | tr ' ' '|'))\.json\$"
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" "$RX" || { step "push $d failed"; exit 1; }; done
step "live check"
for t in $(node -e "const r=require('./group3/registered.json');const T=[...require('./group3/targets.json'),...require('./group3/targets-3b.json')];const seen=new Set();for(const x of r){const m=(T.find(t=>t.key===x.key)||{}).method;if(m&&!seen.has(m)){seen.add(m);console.log(x.key)}}"); do awk -v t="$t" '$1~/^traverse/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"; done
step "done: commit group3/registered.json, town-county.json, town-surveys-extra.json, the merged towns' areas files; note in TASKS.md TR-34"

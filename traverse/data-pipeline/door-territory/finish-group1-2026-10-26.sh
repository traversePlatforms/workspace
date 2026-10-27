#!/bin/bash
# Finish Group 1 once the cloud machine says "group1 B: measuring done" (2026-10-26, Matthew: "go ahead and start stage b once the
# others finish"). Run from this folder:  bash finish-group1-2026-10-26.sh > logs-finish-group1.log 2>&1
#   1. copies back the door lists, neighbourhood files, yard v2, tree, roof and solar results for the Group 1 towns and merges the caches
#      (a cloud reading fills a gap or replaces an error; a local reading is never overwritten; backups first);
#   2. registers the towns (group1/registered.json; county in assessor/town-county.json; survey in tree-zones/town-surveys-extra.json);
#   3. builds: yard v2 lawn file, year built (where the county files allow), the door files (build-rounds-data), census, FEMA, pest,
#      other homes, roof/houses/solar/photo files and photo outlines;
#   4. uploads the new towns to Sixfold (upload-towns-sixfold.sh: backup, index.json merged, groups added) and to every edition
#      (push-edition.sh: backup, md5, index.json/company.json merged), in batches;
#   5. live-checks one new town on Sixfold and every edition.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
K="-i /c/Users/SURGEI~1/.ssh/azure_yard"; VM="ssh -o ConnectTimeout=20 $K yard@20.91.198.101"; H=yard@20.91.198.101
step() { echo "$(date +%T) $*"; }
$VM 'grep -q "measuring done\|material" ~/run-status.txt' < /dev/null || { step "stage B is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
mkdir -p "$S/g1back"
step "copy back"
$VM 'cd ~ && T=run/tv/traverse/data-pipeline/door-territory; L=$(cat run/group1/b-towns.txt); tar czf - run/group1/registered.json run/group1/b-towns.txt $(for k in $L; do echo run/group1/out/$k.csv $T/$k-areas.json run/lawn-trial/yard-v2/$k.json; done) $T/tree-cache.json $T/tree-zones/town-surveys-extra.json $T/roofs/roof-cache.json $T/solar/solar-cache.json 2>/dev/null' < /dev/null > "$S/g1back.tgz" || exit 1
rm -rf "$S/g1back" && mkdir -p "$S/g1back" && tar xzf "$S/g1back.tgz" -C "$S/g1back" || exit 1
B="$S/g1back/run"; T="$B/tv/traverse/data-pipeline/door-territory"
cp "$B/group1/registered.json" group1/registered.json; cp "$T/tree-zones/town-surveys-extra.json" tree-zones/town-surveys-extra.json
KEYS=$(cat "$B/group1/b-towns.txt"); step "towns: $(echo $KEYS | wc -w)"
for k in $KEYS; do cp "$B/group1/out/$k.csv" "$k.csv"; cp "$T/$k-areas.json" "$k-areas.json"; [ -f "$B/lawn-trial/yard-v2/$k.json" ] && cp "$B/lawn-trial/yard-v2/$k.json" "lawn-trial/yard-v2/$k.json"; done
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$loc" ] && cp "$loc" "$loc.before-group1-20261026"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
node -e "const fs=require('fs');const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));for(const t of JSON.parse(fs.readFileSync('group1/registered.json')))tc[t.key]=tc[t.key]||[t.county];fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1)+'\n');console.log('counties registered')"
step "build";  (cd lawn-trial && node build-yard-v2.mjs | head -2)
node --max-old-space-size=8192 assessor/build-year.mjs | tail -1
node --max-old-space-size=8192 build-rounds-data.mjs | tail -3 || exit 1
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
node --max-old-space-size=8192 pest/build-pest.mjs | tail -1; node --max-old-space-size=8192 build-others.mjs $KEYS | tail -1
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 photo-index.mjs build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)
step "upload to Sixfold"
set -- $KEYS; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "group1-$(echo $batch | cut -d' ' -f1)-20261026" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions";  (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" || { step "push $d failed"; exit 1; }; done
step "live check"; FIRST=$(echo $KEYS | cut -d' ' -f1)
awk -v t="$FIRST" '$1~/^traverse/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"
step "done: commit the registered towns and caches"

#!/bin/bash
# Finish the Group 1 re-clip once the cloud machine has measured the added doors (2026-10-28, Matthew: "Go ahead and re-run the group 1
# de-dup with the correct method"). The corrected door lists are already live; this fills in what the cloud measures for the doors the old
# 20 m rule had dropped. The overnight check runs it (traverse/ops/run-cloud-finishers.sh, stage g1fix) when the VM says
# "group1 fix: measuring done" or leaves ~/run/group1/g1fix.vmdone. By hand: bash finish-g1fix-2026-10-28.sh > logs-finish-g1fix.log 2>&1
#   1. copies back yard v2 per town, the tree / roof / solar caches (merged: a cloud reading fills a gap or replaces an error, a local
#      reading is never overwritten; backups first), the close-up photo index, material calls and house centres for the towns in
#      group1/fix-towns.txt;
#   2. builds the yard v2 lawn file, the door files, roof / solar / photo outline files (the door lists themselves do not change);
#   3. uploads those towns to Sixfold (upload-towns-sixfold.sh) and their Group 1 files only to every edition (push-edition.sh <d> 'g1-'):
#      other towns' files differ from live only by owner-history flags and are left alone;
#   4. live-checks Berthoud on every edition.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
$VM 'grep -q "group1 fix: measuring done" ~/run-status.txt || test -f ~/run/group1/g1fix.vmdone' < /dev/null || { step "the fix measuring is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
KEYS=$(cat group1/fix-towns.txt); step "towns: $(echo $KEYS | wc -w)"
step "copy back"
$VM "cd ~/run && T=tv/traverse; tar czf - \$(for k in $(echo $KEYS); do for f in lawn-trial/yard-v2/\$k.json \$T/app/data/rounds/material-\$k.json \$T/app/data/rounds/naip-\$k.json \$T/data-pipeline/door-territory/roofs/houses-\$k.json; do [ -f \$f ] && echo \$f; done; done) \$T/data-pipeline/door-territory/tree-cache.json \$T/data-pipeline/door-territory/roofs/roof-cache.json \$T/data-pipeline/door-territory/solar/solar-cache.json" < /dev/null > "$S/g1fixback.tgz" || exit 1
rm -rf "$S/g1fixback" && mkdir -p "$S/g1fixback" && tar xzf "$S/g1fixback.tgz" -C "$S/g1fixback" || exit 1
B="$S/g1fixback"; T="$B/tv/traverse/data-pipeline/door-territory"
n=0; for k in $KEYS; do
  [ -f "$B/lawn-trial/yard-v2/$k.json" ] && cp "$B/lawn-trial/yard-v2/$k.json" "lawn-trial/yard-v2/$k.json" && n=$((n+1))
  for f in material naip; do [ -f "$B/tv/traverse/app/data/rounds/$f-$k.json" ] && cp "$B/tv/traverse/app/data/rounds/$f-$k.json" "$RD/$f-$k.json"; done
  [ -f "$T/roofs/houses-$k.json" ] && cp "$T/roofs/houses-$k.json" "roofs/houses-$k.json"
done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$loc" ] && cp "$loc" "$loc.before-g1fix-20261028"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
step "build"; (cd lawn-trial && node build-yard-v2.mjs | head -1)
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two" || exit 1
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)
step "upload to Sixfold"
set -- $KEYS; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "g1fix2-$(echo $batch | cut -d' ' -f1)-20261028" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" 'g1-' || { step "push $d failed"; exit 1; }; done
step "live check"
awk '$1~/^traverse/{print $1,$2,"g1-berthoud"}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"
step "done: commit the caches note in TASKS.md TR-34"

#!/bin/bash
# Finish Group 2 stage B once the cloud machine says "group2 B: measuring done" or leaves ~/run/group2/g2b.vmdone (2026-10-28, Matthew
# after seeing the counts: "we are almost at a million properties so i wanna hit it"). The overnight check runs it
# (traverse/ops/run-cloud-finishers.sh, stage g2b). By hand: bash finish-g2b-2026-10-28.sh > logs-finish-g2b.log 2>&1
#   1. copies back the door lists, neighbourhood files, yard v2, material and close-up photo files and house centres for the Group 2 towns,
#      and merges the tree / roof / solar / value caches (a cloud reading fills a gap or replaces an error; a local reading is never
#      overwritten; backups first);
#   2. registers the towns (group2/registered.json, read by build-rounds-data.mjs; county in assessor/town-county.json; laser key in
#      tree-zones/town-surveys-extra.json, added, never replacing a Group 1 entry). g2-berthoud is not among them: its doors are in
#      g1-berthoud, live since 28 Oct;
#   3. builds: yard v2 lawn file, year built (no county files for Larimer, Mesa or Pueblo: none for these), the door files, census (Mesa
#      and Pueblo block groups added), FEMA, pest, other homes, roof/houses/solar/photo files and photo outlines;
#   4. checks every Group 2 town is in the index with doors, then uploads them to Sixfold (upload-towns-sixfold.sh: backup, index.json
#      merged, groups added) in batches of 8 and their files only to every edition (push-edition.sh <d> 'g2-': backup, md5, index.json /
#      company.json merged; the other towns' files differ from live only by owner-history flags and are left alone);
#   5. verifies the live index on Sixfold and every edition (door counts per Group 2 town = the build) and live-checks one door list per
#      county on every edition.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
$VM 'grep -q "group2 B: measuring done" ~/run-status.txt || test -f ~/run/group2/g2b.vmdone' < /dev/null || { step "stage B is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
mkdir -p "$S"
step "copy back"
$VM 'cd ~/run && T=tv/traverse; D=$T/data-pipeline/door-territory; L=$(cat group2/b-towns.txt); tar czf - group2/registered.json group2/b-towns.txt $(for k in $L; do for f in group2/out/$k.csv $D/$k-areas.json lawn-trial/yard-v2/$k.json $T/app/data/rounds/material-$k.json $T/app/data/rounds/naip-$k.json $D/roofs/houses-$k.json; do [ -f $f ] && echo $f; done; done) $(for f in $D/tree-cache.json $D/tree-zones/town-surveys-extra.json $D/roofs/roof-cache.json $D/solar/solar-cache.json $D/value-cache.json; do [ -f $f ] && echo $f; done)' < /dev/null > "$S/g2back.tgz" || exit 1
rm -rf "$S/g2back" && mkdir -p "$S/g2back" && tar xzf "$S/g2back.tgz" -C "$S/g2back" || exit 1
B="$S/g2back"; T="$B/tv/traverse/data-pipeline/door-territory"
cp "$B/group2/registered.json" group2/registered.json; cp "$B/group2/b-towns.txt" group2/b-towns.txt
KEYS=$(cat group2/b-towns.txt); step "towns: $(echo $KEYS | wc -w)"
case " $KEYS " in *" g2-berthoud "*) step "STOP: g2-berthoud is in the town list (its doors are live in g1-berthoud)"; exit 1;; esac
n=0; for k in $KEYS; do
  cp "$B/group2/out/$k.csv" "$k.csv" && cp "$T/$k-areas.json" "$k-areas.json" || { step "missing door list or neighbourhoods for $k"; exit 1; }
  [ -f "$B/lawn-trial/yard-v2/$k.json" ] && cp "$B/lawn-trial/yard-v2/$k.json" "lawn-trial/yard-v2/$k.json" && n=$((n+1))
  for f in material naip; do [ -f "$B/tv/traverse/app/data/rounds/$f-$k.json" ] && cp "$B/tv/traverse/app/data/rounds/$f-$k.json" "$RD/$f-$k.json"; done
  [ -f "$T/roofs/houses-$k.json" ] && cp "$T/roofs/houses-$k.json" "roofs/houses-$k.json"
done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json" "value-cache.json:$T/value-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$cl" ] || { step "no cloud $loc"; continue; }; [ -f "$loc" ] && cp "$loc" "$loc.before-g2b-20261028"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
node -e "const fs=require('fs');const a='tree-zones/town-surveys-extra.json';const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(C))if(!(k in L)){L[k]=v;n++}fs.writeFileSync(a,JSON.stringify(L));console.log(a,'+',n)" "$T/tree-zones/town-surveys-extra.json" || exit 1
node -e "const fs=require('fs');const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));let n=0;for(const t of JSON.parse(fs.readFileSync('group2/registered.json')))if(!tc[t.key]){tc[t.key]=[t.county];n++}fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1)+'\n');console.log('counties registered:',n)"
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
const bad=keys.filter((k)=>!by[k]||!(by[k].doors>0));const cty={};for(const t of JSON.parse(fs.readFileSync('group2/registered.json')))cty[t.key]=t.county;
const per={};let tot=0;for(const k of keys)if(by[k]){per[cty[k]]=(per[cty[k]]||0)+by[k].doors;tot+=by[k].doors}
fs.writeFileSync('group2/built-counts.json',JSON.stringify(Object.fromEntries(keys.map((k)=>[k,by[k]?by[k].doors:0])),null,1));
console.log('doors by county',JSON.stringify(per),'total',tot,'| towns missing or empty:',bad.join(' ')||'none');if(bad.length)process.exit(1)" $KEYS || { step "STOP: towns missing from the index"; exit 1; }
step "upload to Sixfold"
set -- $KEYS; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "group2-$(echo $batch | cut -d' ' -f1)-20261028" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" 'g2-' || { step "push $d failed"; exit 1; }; done
step "live index check"; bash group2/verify-live-g2.sh || { step "live index check FAILED"; exit 1; }
step "live check"
for t in g2-loveland g2-grand-junction g2-pueblo; do awk -v t="$t" '$1~/^traverse/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"; done
step "done: commit group2/registered.json, town-county.json, town-surveys-extra.json; note in TASKS.md TR-34"

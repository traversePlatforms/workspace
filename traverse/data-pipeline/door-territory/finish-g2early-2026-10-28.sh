#!/bin/bash
# Group 2's door lists live before they are measured (2026-10-28, Matthew: "yeah i just want a million properties"). The same way the Group 1
# re-clip went live: the doors with every layer this laptop can build, lawn / trees / roof / sun blank until stage B's measuring is done;
# finish-g2b-2026-10-28.sh then copies those back and uploads the towns again (its upload labels are group2-*, these are g2early-*, so it
# is not skipped). Larimer, Mesa and Pueblo are outside Sixfold's service area: nobody quotes these doors this week.
#   bash finish-g2early-2026-10-28.sh > logs-finish-g2early.log 2>&1
#   0. waits for any cloud finisher still running (one build at a time: build-rounds-data rewrites every town file);
#   1. copies back the door lists, neighbourhood files, registered.json, b-towns.txt and the laser keys from the cloud machine;
#   2. registers the towns (county in assessor/town-county.json, laser keys added, never replacing);
#   3. builds the door files, census, FEMA, pest, other homes;
#   4. checks every town is in the index with doors, uploads them to Sixfold (upload-towns-sixfold.sh, batches of 8) and their files to
#      every edition (push-edition.sh <d> 'g2-');
#   5. verifies the live index (group2/verify-live-g2.sh) and live-checks one door list per county.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
LK="$LOCALAPPDATA/ProjectBackup/cloud-finish/running.lock"
step() { echo "$(date +%T) $*"; }
while [ -f "$LK" ] && kill -0 "$(cat "$LK" 2>/dev/null)" 2>/dev/null; do step "waiting for the $(cat "${LK%.lock}.name" 2>/dev/null) finisher"; sleep 120; done
mkdir -p "$S"
step "copy back"
$VM 'cd ~/run && T=tv/traverse; D=$T/data-pipeline/door-territory; L=$(cat group2/b-towns.txt); tar czf - group2/registered.json group2/b-towns.txt $(for k in $L; do for f in group2/out/$k.csv $D/$k-areas.json; do [ -f $f ] && echo $f; done; done) $(for f in $D/tree-zones/town-surveys-extra.json; do [ -f $f ] && echo $f; done)' < /dev/null > "$S/g2early.tgz" || exit 1
rm -rf "$S/g2early" && mkdir -p "$S/g2early" && tar xzf "$S/g2early.tgz" -C "$S/g2early" || exit 1
B="$S/g2early"; T="$B/tv/traverse/data-pipeline/door-territory"
cp "$B/group2/registered.json" group2/registered.json; cp "$B/group2/b-towns.txt" group2/b-towns.txt
KEYS=$(cat group2/b-towns.txt); step "towns: $(echo $KEYS | wc -w)"
case " $KEYS " in *" g2-berthoud "*) step "STOP: g2-berthoud is in the town list (its doors are live in g1-berthoud)"; exit 1;; esac
for k in $KEYS; do cp "$B/group2/out/$k.csv" "$k.csv" && cp "$T/$k-areas.json" "$k-areas.json" || { step "missing door list or neighbourhoods for $k"; exit 1; }; done
[ -f "$T/tree-zones/town-surveys-extra.json" ] && node -e "const fs=require('fs');const a='tree-zones/town-surveys-extra.json';const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(C))if(!(k in L)){L[k]=v;n++}fs.writeFileSync(a,JSON.stringify(L,null,1));console.log('laser keys +',n)" "$T/tree-zones/town-surveys-extra.json"
node -e "const fs=require('fs');const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));let n=0;for(const t of JSON.parse(fs.readFileSync('group2/registered.json')))if(!tc[t.key]){tc[t.key]=[t.county];n++}fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1));console.log('town-county +',n)"
step "build"
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two" || exit 1
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
node --max-old-space-size=8192 pest/build-pest.mjs | tail -1; node --max-old-space-size=8192 build-others.mjs $KEYS | tail -3
step "index check"
node -e "
const fs=require('fs');const idx=JSON.parse(fs.readFileSync('$RD/index.json'));const keys=process.argv.slice(1);const by=Object.fromEntries(idx.regions.map((r)=>[r.key,r]));
const bad=keys.filter((k)=>!by[k]||!(by[k].doors>0));const cty={};for(const t of JSON.parse(fs.readFileSync('group2/registered.json')))cty[t.key]=t.county;
const per={};let tot=0;for(const k of keys)if(by[k]){per[cty[k]]=(per[cty[k]]||0)+by[k].doors;tot+=by[k].doors}
fs.writeFileSync('group2/built-counts.json',JSON.stringify(Object.fromEntries(keys.map((k)=>[k,by[k]?by[k].doors:0])),null,1));
console.log('doors by county',JSON.stringify(per),'total',tot,'| towns missing or empty:',bad.join(' ')||'none');if(bad.length)process.exit(1)" $KEYS || { step "STOP: towns missing from the index"; exit 1; }
step "upload to Sixfold"
set -- $KEYS; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "g2early-$(echo $batch | cut -d' ' -f1)-20261028" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" 'g2-' || { step "push $d failed"; exit 1; }; done
step "live index check"; bash group2/verify-live-g2.sh || { step "live index check FAILED"; exit 1; }
step "live check"
for t in g2-loveland g2-grand-junction g2-pueblo; do awk -v t="$t" '$1~/^traverse/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"; done
step "done"

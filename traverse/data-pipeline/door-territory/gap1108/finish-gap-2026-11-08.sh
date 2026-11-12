#!/bin/bash
# Finish one gap batch on the laptop (gap plan 2026-11-08, GAP-PLAN-2026-11-08.md). Modelled on finish-g3b-2026-10-29.sh.
#   bash gap1108/finish-gap-2026-11-08.sh <batch> > logs-finish-gap-<batch>.log 2>&1        batch: ep (El Paso) | g3po (local PO boxes)
# ⚑ HELD: this pushes to the live server and every edition. It is NOT in traverse/ops/run-cloud-finishers.sh, and it refuses to run
#   unless gap1108/GO-<batch> exists. Create that file only after Matthew (or the main session, on his go) has read the batch's counts
#   (VM: ~/run/gap1108/<batch>/summary.tsv) and the plan.
#   1. copies back the batch (door lists, registered.json, merge lists, limited marks), new towns' neighbourhoods, yard v2, material and
#      close-up photo files and house centres, and merges the tree / roof / solar caches (a cloud reading fills a gap or replaces an
#      error; a local reading is never overwritten; backups first);
#   2. appends the added doors to our towns (group3/merge-into-town.mjs: new neighbourhoods after the town's own, existing doors untouched);
#   3. registers the new towns (g1-* keys into group1/registered.json, g3-* into group3/registered.json; county in assessor/town-county.json)
#      and adds the limited marks (no owner name) to group3/b/limited-<town>.json;
#   4. values (sample-value.mjs --only: El Paso from the assessor file), builds the door files and layers, checks the index;
#   5. uploads to Sixfold (upload-towns-sixfold.sh, batches of 8) and each edition (push-edition.sh, these towns only, never hail-*).
set -u
cd "$(dirname "$0")/.." || exit 1
NAME=${1:?batch: ep or g3po}
[ -f "gap1108/GO-$NAME" ] || { echo "HELD: gap1108/GO-$NAME does not exist (needs Matthew's go after the counts)"; exit 1; }
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/gap-$NAME"; mkdir -p "$S"   # short path ("Matthew sharpe" has a space)
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not copying back"; exit 1;; esac
$VM "test -f ~/run/gap1108/$NAME/gapb.vmdone" < /dev/null || { step "batch $NAME is not measured yet: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
step "copy back"
$VM "cd ~/run && T=tv/traverse; D=\$T/data-pipeline/door-territory; B=gap1108/$NAME; L=\$(cat \$B/b-towns.txt); M=\$(cat \$B/merge-towns.txt); tar czf - \$B \$(for k in \$L; do for f in \$D/\$k-areas.json lawn-trial/yard-v2/\$k.json \$T/app/data/rounds/material-\$k.json \$T/app/data/rounds/naip-\$k.json \$D/roofs/houses-\$k.json; do [ -f \$f ] && echo \$f; done; done) \$(for m in \$M; do [ -f \$D/gapadd-$NAME-\$m-areas.json ] && echo \$D/gapadd-$NAME-\$m-areas.json; done) \$(for f in \$D/tree-cache.json \$D/tree-zones/town-surveys-extra.json \$D/roofs/roof-cache.json \$D/solar/solar-cache.json \$D/value-cache.json; do [ -f \$f ] && echo \$f; done)" < /dev/null > "$S/back.tgz" || exit 1
rm -rf "$S/back" && mkdir -p "$S/back" && tar xzf "$S/back.tgz" -C "$S/back" || exit 1
B="$S/back"; BB="$B/gap1108/$NAME"; T="$B/tv/traverse/data-pipeline/door-territory"
KEYS=$(cat "$BB/b-towns.txt"); MERGE=$(cat "$BB/merge-towns.txt"); step "new towns: $(echo $KEYS | wc -w); towns getting doors: $(echo $MERGE | wc -w)"
mkdir -p "gap1108/b-$NAME" && cp "$BB/summary.tsv" "$BB/registered.json" "gap1108/b-$NAME/"
n=0; for k in $KEYS; do
  cp "$BB/$k.csv" "$k.csv" && cp "$T/$k-areas.json" "$k-areas.json" || { step "missing door list or neighbourhoods for $k"; exit 1; }
  [ -f "$B/lawn-trial/yard-v2/$k.json" ] && cp "$B/lawn-trial/yard-v2/$k.json" "lawn-trial/yard-v2/$k.json" && n=$((n+1))
  for f in material naip; do [ -f "$B/tv/traverse/app/data/rounds/$f-$k.json" ] && cp "$B/tv/traverse/app/data/rounds/$f-$k.json" "$RD/$f-$k.json"; done
  [ -f "$T/roofs/houses-$k.json" ] && cp "$T/roofs/houses-$k.json" "roofs/houses-$k.json"
done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json" "value-cache.json:$T/value-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$cl" ] || { step "no cloud $loc"; continue; }; [ -f "$loc" ] && cp "$loc" "$loc.before-gap-$NAME-$(date +%Y%m%d)"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
node -e "const fs=require('fs');const a='tree-zones/town-surveys-extra.json';const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(C))if(!(k in L)){L[k]=v;n++}fs.writeFileSync(a,JSON.stringify(L));console.log(a,'+',n)" "$T/tree-zones/town-surveys-extra.json" || exit 1
step "add doors to our towns"
for m in $MERGE; do f="$T/gapadd-$NAME-$m-areas.json"; [ -f "$f" ] && node group3/merge-into-town.mjs "$m" "$f" || step "no new neighbourhoods for $m"; done
step "register"
node -e "
const fs=require('fs');const reg=JSON.parse(fs.readFileSync(process.argv[1]));const add=(file,keys)=>{const L=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];let n=0;for(const t of keys)if(!L.some(u=>u.key===t.key)){L.push(t);n++}fs.writeFileSync(file,JSON.stringify(L,null,1));console.log(file,'+',n)};
add('group1/registered.json',reg.filter(t=>t.key.startsWith('g1-')));add('group3/registered.json',reg.filter(t=>t.key.startsWith('g3-')));
const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));let n=0;for(const t of reg)if(!tc[t.key]){tc[t.key]=[t.county];n++}fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1)+'\n');console.log('counties registered:',n)" "$BB/registered.json" || exit 1
mkdir -p group3/b; for f in "$BB"/limited-*.json; do [ -f "$f" ] || continue; node -e "const fs=require('fs');const [src,dst]=process.argv.slice(1);const L=fs.existsSync(dst)?JSON.parse(fs.readFileSync(dst)):{};Object.assign(L,JSON.parse(fs.readFileSync(src)));fs.writeFileSync(dst,JSON.stringify(L))" "$f" "group3/b/$(basename "$f")"; done
step "values"; ONLY=$(echo $KEYS $MERGE | tr ' ' ','); [ -n "$ONLY" ] && node --max-old-space-size=8192 sample-value.mjs --only="$ONLY" | tail -2
step "build"; (cd lawn-trial && node build-yard-v2.mjs | head -1)
node --max-old-space-size=8192 assessor/build-year.mjs | tail -1
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two|limited data" || exit 1
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
# 12 Nov: pipefail, so a crashed pest build stops the run (11 Nov: build-pest overflowed at Denver and | tail -1 hid it; pest files from
# Denver on stayed old)
(set -o pipefail; node --max-old-space-size=8192 pest/build-pest.mjs | tail -n 2) || { step "build-pest failed"; exit 1; }
node --max-old-space-size=8192 build-others.mjs $KEYS $MERGE | tail -3
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 photo-index.mjs build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)
step "index check"
node -e "
const fs=require('fs');const idx=JSON.parse(fs.readFileSync('$RD/index.json'));const keys=process.argv.slice(1);const by=Object.fromEntries(idx.regions.map((r)=>[r.key,r]));
const bad=keys.filter((k)=>!by[k]||!(by[k].doors>0));fs.writeFileSync('gap1108/b-$NAME/built-counts.json',JSON.stringify(Object.fromEntries(keys.map((k)=>[k,by[k]?by[k].doors:0])),null,1));
console.log('doors in these towns now',keys.reduce((s,k)=>s+(by[k]?by[k].doors:0),0),'| missing or empty:',bad.join(' ')||'none');if(bad.length)process.exit(1)" $KEYS $MERGE || { step "STOP: towns missing from the index"; exit 1; }
step "upload to Sixfold"
set -- $KEYS $MERGE; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "gap-$NAME-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
RX="^((census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-)?($(echo $KEYS $MERGE | tr ' ' '|'))\.json\$"
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" "$RX" || { step "push $d failed"; exit 1; }; done
step "done: commit group1/ group3/ registered.json, town-county.json, town-surveys-extra.json; storm history for new towns = the g3hail method; note in TASKS.md"

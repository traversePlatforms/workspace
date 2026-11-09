#!/bin/bash
# Rented doors onto the lists (Matthew 8 Nov: "go ahead and the rented doors, just make sure its obvious which are owner lived in and
# which arent"; OWNER-FIELD-SPEC.md). Laptop finisher for VM stage rentb.   bash gap1108/finish-rent-2026-11-08.sh > logs-finish-rent.log 2>&1
# ⚑ HELD TWICE, and NOT in traverse/ops/run-cloud-finishers.sh:
#   gap1108/GO-rented   Matthew has seen the counts (it is also the switch that makes build-rounds-data.mjs promote the homes);
#   gap1108/APP-READY   the app's owner label + filter (and the server's per-install default: Sixfold shows occ 'here' only) are live
#                       on every install. Without it this stops after the local build, before any upload.
#   1. copies back ~/run/gap1108/rent/*-lookup2-areas.json, yard v2 for every <town>-lookup / <town>-lookup2 key, and merges the tree,
#      roof, solar and value caches (a cloud reading fills a gap or replaces an error; backups first);
#   2. builds: yard v2, year, build-rounds-data (promotes: occ on every door), the layers, the editions;
#   3. prints the occ counts per install; with APP-READY: uploads every town to Sixfold and each edition (never hail-*).
set -u
cd "$(dirname "$0")/.." || exit 1
[ -f gap1108/GO-rented ] || { echo "HELD: gap1108/GO-rented does not exist (needs Matthew's go after the counts)"; exit 1; }
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/gap-rent"; mkdir -p "$S"   # short path ("Matthew sharpe" has a space)
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not copying back"; exit 1;; esac
$VM 'test -f ~/run/gap1108/rentb.vmdone' < /dev/null || { step "rentb is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
step "copy back"
$VM 'cd ~/run && D=tv/traverse/data-pipeline/door-territory; tar czf - gap1108/rent $(cut -f1 gap1108/rentb/keys.tsv | while read -r k; do [ -f lawn-trial/yard-v2/$k.json ] && echo lawn-trial/yard-v2/$k.json; done) $(for f in $D/tree-cache.json $D/roofs/roof-cache.json $D/solar/solar-cache.json $D/value-cache.json; do [ -f $f ] && echo $f; done)' < /dev/null > "$S/back.tgz" || exit 1
rm -rf "$S/back" && mkdir -p "$S/back" && tar xzf "$S/back.tgz" -C "$S/back" || exit 1
B="$S/back"; T="$B/tv/traverse/data-pipeline/door-territory"
n=0; for f in "$B"/gap1108/rent/*-lookup2-areas.json; do cp "$f" . && n=$((n+1)); done; step "rented-home lists: $n towns"
n=0; for f in "$B"/lawn-trial/yard-v2/*.json; do [ -f "$f" ] && cp "$f" lawn-trial/yard-v2/ && n=$((n+1)); done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json" "value-cache.json:$T/value-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$cl" ] || { step "no cloud $loc"; continue; }; [ -f "$loc" ] && cp "$loc" "$loc.before-rent-$(date +%Y%m%d)"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || exit 1
done
step "values (El Paso from the assessor file)"; node --max-old-space-size=8192 sample-value.mjs --only="$(node -e "const t=require('./assessor/town-county.json');console.log(Object.keys(t).filter(k=>(t[k]||[])[0]==='El Paso'||(t[k]||[])[0]==='elpaso').join(','))")" | tail -2
step "build"; (cd lawn-trial && node build-yard-v2.mjs | head -1)
node --max-old-space-size=8192 assessor/build-year.mjs | tail -1
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "rented doors|wrote|listed by two|limited data" || exit 1
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
node --max-old-space-size=8192 pest/build-pest.mjs | tail -1; node --max-old-space-size=8192 build-others.mjs | tail -3
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 photo-index.mjs build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)
(cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
step "occ counts"
node -e "const fs=require('fs');for(const f of ['$RD/index.json',...['traverse-data','traverse-yards-data','traverse-solar-data','traverse-pest-data','traverse-security-data'].map(d=>'../../editions/dist/'+d+'/rounds/index.json')]){const r=JSON.parse(fs.readFileSync(f)).regions;const o={here:0,away:0,unk:0,none:0};for(const x of r){if(!x.occ){o.none+=x.doors||0;continue}for(const k in x.occ)o[k]+=x.occ[k]}console.log(f.split('/').slice(-3,-2)[0]||f,JSON.stringify(o))}"
[ -f gap1108/APP-READY ] || { step "built locally; NOT uploaded: gap1108/APP-READY does not exist (the app's owner label and filter must be live first)"; exit 0; }
step "upload to Sixfold (every town)"
set -- $(node -e "console.log(JSON.parse(require('fs').readFileSync('$RD/index.json')).regions.map(r=>r.key).join(' '))")
while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "rent-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
# the towns' door files and side files by name, but NEVER hail-<town>.json: the server's storm job owns those
KEYS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('../../editions/dist/traverse-data/rounds/index.json')).regions.map(r=>r.key).filter(k=>!/^com-/.test(k)).join('|'))")
RX="^((census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-)?($KEYS)\.json\$"
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" "$RX" || { step "push $d failed"; exit 1; }; done
step "done: commit; then a roof-material pass for the towns (material is keyed by door id)"

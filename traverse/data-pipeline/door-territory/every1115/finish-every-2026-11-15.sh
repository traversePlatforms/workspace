#!/bin/bash
# Every home (15 Nov 2026, EVERY-HOME-2026-11-15.md): the laptop finisher for VM stage ehb.
#   bash every1115/finish-every-2026-11-15.sh > logs-finish-every.log 2>&1        (from door-territory; also a Wi-Fi queue job)
# Matthew 15 Nov: "I eventually want to have every residential property in Colorado on this list that we possibly can" (his go on the
# sweep, Huerfano, townhomes, mobile homes, buildings). Uploads are under his standing permission for app data (backups + md5 kept).
#   1. waits: not on the iPhone hotspot; ehb.vmdone on the VM; no other build or upload running (finish-yardv3 included);
#   2. copies back the lists, the new towns' neighbourhoods, yard v2 for every list key, new towns' material / photo / house files, and
#      merges the tree / roof / solar / value caches (a cloud reading fills a gap or replaces an error; backups first);
#   3. places them: <town>-add1115-areas.json / <town>-bld1115-areas.json beside the towns, the new towns' CSV + neighbourhoods,
#      every1115/marks/, the new towns registered (g3-* group3/registered.json, g4-* group1/registered.json, town-county.json);
#   4. builds (build-rounds-data promotes; mobile homes and buildings only once every1115/KINDS-READY exists), the layers, the editions;
#   5. STOPS before any upload if a town of ours has fewer doors than before, or an existing door id went missing;
#   6. uploads the towns whose door files changed to Sixfold (batches of 8) and each edition (never hail-*).
set -u
# EH_RUN: the run folder under ~/run on the VM (every1115 for the 15 Nov batch; every-<yyyymmdd> for a quarterly refresh, refresh-quarterly.sh)
RUN=${EH_RUN:-every1115}
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/$RUN"; mkdir -p "$S"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
stop() { step "STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting"; sleep 120; done; }
up6() { local label=$1 i; for i in 1 2 3; do offhot; bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$label.done" ] && return 0; step "batch $label not confirmed (try $i)"; sleep $((i * 120)); done; return 1; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold' }).Count" 2>/dev/null | tr -d '\r'; }
offhot
$VM "test -f ~/run/$RUN/ehb.vmdone" < /dev/null || stop "ehb is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 72 ] && stop "another upload or build has run for 6 hours"; step "another upload/build is running: waiting"; sleep 300; done

step "copy back"
$VM "RUN=$RUN; "'cd ~/run && T=tv/traverse; D=$T/data-pipeline/door-territory; W=$RUN/lists; N=$(awk -F"\t" "\$2==\"new\"{print \$1}" $W/keys.tsv); tar czf - $W $(cut -f1 $W/keys.tsv | while read -r k; do [ -f lawn-trial/yard-v2/$k.json ] && echo lawn-trial/yard-v2/$k.json; done) $(for k in $N; do for f in $D/$k-areas.json $T/app/data/rounds/material-$k.json $T/app/data/rounds/naip-$k.json $D/roofs/houses-$k.json; do [ -f $f ] && echo $f; done; done) $(for f in $D/tree-cache.json $D/tree-zones/town-surveys-extra.json $D/roofs/roof-cache.json $D/solar/solar-cache.json $D/value-cache.json; do [ -f $f ] && echo $f; done)' < /dev/null > "$S/back.tgz.part" || stop "copy back failed"
mv -f "$S/back.tgz.part" "$S/back.tgz"
rm -rf "$S/back" && mkdir -p "$S/back" && tar xzf "$S/back.tgz" -C "$S/back" || stop "unpack failed"
B="$S/back"; W="$B/$RUN/lists"; T="$B/tv/traverse/data-pipeline/door-territory"
mkdir -p every1115/b every1115/marks && cp "$W/summary.tsv" "$W/kinds.json" "$W/new/registered.json" every1115/b/

step "door counts and ids before"
node -e "const fs=require('fs');const R='$RD';const idx=JSON.parse(fs.readFileSync(R+'/index.json')).regions;const o={};for(const r of idx){const f=R+'/'+r.key+'.json';if(!fs.existsSync(f))continue;const j=JSON.parse(fs.readFileSync(f));o[r.key]=j.areas.flatMap(a=>a.doors.map(d=>d.id))}fs.writeFileSync('$S/ids-before.json',JSON.stringify(o));console.log('towns',Object.keys(o).length,'doors',Object.values(o).reduce((s,l)=>s+l.length,0))" || stop "could not read the door files"
(cd "$RD" && md5sum *.json | LC_ALL=C sort -k2) > "$S/md5-before.txt"

step "place the lists"
n=0; for f in "$W"/add/*-add1115-areas.json "$W"/add/*-bld1115-areas.json; do [ -f "$f" ] && cp "$f" . && n=$((n+1)); done; step "add lists: $n"
NEWK=$(node -e "console.log(require('$W/new/registered.json').map(t=>t.key).join(' '))")
for k in $NEWK; do cp "$W/new/$k.csv" "$k.csv" && cp "$T/$k-areas.json" "$k-areas.json" || stop "missing door list or neighbourhoods for $k"
  for f in material naip; do [ -f "$B/tv/traverse/app/data/rounds/$f-$k.json" ] && cp "$B/tv/traverse/app/data/rounds/$f-$k.json" "$RD/$f-$k.json"; done
  [ -f "$T/roofs/houses-$k.json" ] && cp "$T/roofs/houses-$k.json" "roofs/houses-$k.json"; done
step "new towns: $(echo $NEWK | wc -w)"
rm -f every1115/marks/*.json; for f in "$W"/marks/*.json; do [ -f "$f" ] && cp "$f" every1115/marks/; done
n=0; for f in "$B"/lawn-trial/yard-v2/*.json; do [ -f "$f" ] && cp "$f" lawn-trial/yard-v2/ && n=$((n+1)); done; step "yard v2 files: $n"
for pair in "tree-cache.json:$T/tree-cache.json" "roofs/roof-cache.json:$T/roofs/roof-cache.json" "solar/solar-cache.json:$T/solar/solar-cache.json" "value-cache.json:$T/value-cache.json"; do
  loc=${pair%%:*}; cl=${pair#*:}; [ -f "$cl" ] || { step "no cloud $loc"; continue; }; [ -f "$loc" ] && cp "$loc" "$loc.before-every-$(date +%Y%m%d)"
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1);const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(b));let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(a+'.tmp',JSON.stringify(L));fs.renameSync(a+'.tmp',a);console.log(a,'+',n)" "$loc" "$cl" || stop "cache merge $loc"
done
node -e "const fs=require('fs');const a='tree-zones/town-surveys-extra.json';const L=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};const C=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(C))if(!(k in L)){L[k]=v;n++}fs.writeFileSync(a,JSON.stringify(L));console.log(a,'+',n)" "$T/tree-zones/town-surveys-extra.json" || stop "laser keys"
step "register"
node -e "
const fs=require('fs');const reg=JSON.parse(fs.readFileSync(process.argv[1]));const add=(file,keys)=>{const L=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];let n=0;for(const t of keys)if(!L.some(u=>u.key===t.key)){L.push(t);n++}fs.writeFileSync(file,JSON.stringify(L,null,1));console.log(file,'+',n)};
add('group1/registered.json',reg.filter(t=>t.key.startsWith('g4-')));add('group3/registered.json',reg.filter(t=>t.key.startsWith('g3-')));
const tc=JSON.parse(fs.readFileSync('assessor/town-county.json'));let n=0;for(const t of reg)if(!tc[t.key]){tc[t.key]=[t.county];n++}fs.writeFileSync('assessor/town-county.json',JSON.stringify(tc,null,1)+'\n');console.log('counties registered:',n)" "$W/new/registered.json" || stop "register"

step "values (El Paso from the assessor file)"
node --max-old-space-size=8192 sample-value.mjs --only="$(node -e "const t=require('./assessor/town-county.json');console.log(Object.keys(t).filter(k=>(t[k]||[])[0]==='El Paso'||(t[k]||[])[0]==='elpaso').join(','))")" | tail -2
step "build"; (cd lawn-trial && node build-yard-v2.mjs | head -1)
node --max-old-space-size=8192 assessor/build-year.mjs | tail -1
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "rented doors|every1115|wrote|listed by two|limited data" || stop "build-rounds-data"
node --max-old-space-size=8192 census/build-census.mjs | tail -1; node --max-old-space-size=8192 nri/build-nri.mjs | tail -1
(set -o pipefail; node --max-old-space-size=8192 pest/build-pest.mjs | tail -n 2) || stop "build-pest failed"
node --max-old-space-size=8192 build-others.mjs | tail -3
(cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns | tail -1 && node --max-old-space-size=8192 photo-index.mjs build --all-towns | tail -1 && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns | tail -1)

step "check: no town of ours lost a door, no door id went missing"
node -e "
const fs=require('fs');const R='$RD';const before=JSON.parse(fs.readFileSync('$S/ids-before.json'));let bad=[];let gained=0;
for(const [k,ids] of Object.entries(before)){const f=R+'/'+k+'.json';if(!fs.existsSync(f)){bad.push(k+' gone');continue}const now=new Set(JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors.map(d=>d.id)));const miss=ids.filter(i=>!now.has(i));if(miss.length)bad.push(k+' -'+miss.length+' ('+miss.slice(0,3).join(' ')+')');gained+=now.size-ids.length}
const idx=JSON.parse(fs.readFileSync(R+'/index.json')).regions;const hk={th:0,mh:0,b:0};let all=0;for(const r of idx){const f=R+'/'+r.key+'.json';if(!fs.existsSync(f))continue;for(const a of JSON.parse(fs.readFileSync(f)).areas)for(const d of a.doors){all++;if(d.hk)hk[d.hk]++}}
console.log('doors gained in towns of ours',gained,'| doors now',all,'| kinds',JSON.stringify(hk));if(bad.length){console.log('LOST:',bad.slice(0,20).join('; '));process.exit(1)}" || stop "a town of ours lost doors: nothing uploaded"
(cd "$RD" && md5sum *.json | LC_ALL=C sort -k2) > "$S/md5-after.txt"
CH=$(LC_ALL=C join -1 2 -2 2 -a 2 -e none -o '2.2,1.1,2.1' "$S/md5-before.txt" "$S/md5-after.txt" | awk '$2!=$3{print $1}' | sed 's/\.json$//' | grep -vE '^(index|company|shared-towns|hail-.*|.*-lookup)$' | grep -vE '^(census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-' | sort -u)
KEYS=$(for k in $CH; do node -e "process.exit(JSON.parse(require('fs').readFileSync('$RD/index.json')).regions.some(r=>r.key===process.argv[1])?0:1)" "$k" && echo "$k"; done | sort -u)
step "towns whose door files changed: $(echo $KEYS | wc -w)"
[ -n "$KEYS" ] || stop "no town changed"
(cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
step "upload to Sixfold"
set -- $KEYS; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; up6 "$RUN-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || stop "Sixfold upload failed at $batch"; done
RX="^((census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-)?($(echo $KEYS | tr ' ' '|'))\.json\$"
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do offhot; retry bash ./push-edition.sh "$d" "$RX" || stop "push $d failed"; done
step "done: commit group1/ group3/ registered.json, town-county.json, town-surveys-extra.json, every1115/b; storm history for the new towns = the g3hail method; roof material pass for the added doors"

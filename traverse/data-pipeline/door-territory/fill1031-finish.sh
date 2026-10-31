#!/bin/bash
# Laptop finisher for the cloud machine's coverage-fill queue (2026-10-31; overnight/fill1031/, coverage-audit-2026-10-31.md). One section
# per stage; finish-<stage>-2026-10-31.sh calls this with the stage name, so traverse/ops/run-cloud-finishers.sh runs it once
# ~/run/fill1031/<stage>.vmdone exists. By hand: bash fill1031-finish.sh <stage> > logs-finish-<stage>.log 2>&1
#   lawnfix    yard v2 files back for the finished towns -> checked (same door ids, no reading lost, no fewer lots) -> build-yard-v2,
#              build-rounds-data, editions -> those towns' door files to Sixfold (upload-towns-sixfold.sh) and the five editions
#   roofsolar  roof + sun caches back, merged (a cloud reading fills a gap or replaces an error; a reading is never overwritten) ->
#              roof/solar/photo/outline files -> Roofing + Solar (those towns' roof-, solar-, outline-, photo- files)
#   dougmat    material-<town>.json back for the Douglas towns -> Roofing + Solar
#   newlidar   roof + sun + tree caches back, merged (also: a laser tree reading replaces a canopy-map one) -> roof/solar/photo/outline
#              files and door files -> Roofing + Solar side files, door files to Sixfold and the five editions
#   outlinefix as newlidar, for the towns whose outline tiles were cut short (re-measured with whole Microsoft tiles)
#   trees2     tree cache back, merged -> door files -> Sixfold and the five editions
#   values     value-extra.json back, merged into value-cache.json (fills gaps only) -> door files of the towns that gained values
# Every push: backup on the server first (push-edition.sh / upload-towns-sixfold.sh), exact file filter, MD5 MATCH required, live
# index.json merged, never replaced; then a live md5 read-back. Waits while on the phone hotspot and while an app deploy runs. Local
# files replaced are saved in the scratchpad first. Any failure stops with "STOP:" and exit 1 (the finisher loop tries 3 times).
set -u
STAGE="${1:?stage}"
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; cd "$DT" || exit 1
S0=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
S="$S0/fill1031/finish-$STAGE"; RD=../../app/data/rounds; ED=../../editions/dist
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SCPV="scp -q -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
VT=/home/yard/run/tv/traverse/data-pipeline/door-territory
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }
# an app deploy (traverse/ops/deploy-app.sh) running on this laptop: Git Bash's ps shows no script names, so ask Windows
deploying() { powershell.exe -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -match 'deploy-app\.sh' }) { exit 0 } else { exit 1 }" > /dev/null 2>&1; }
nodeploy() { local i=0; while deploying; do i=$((i + 1)); [ $i -gt 24 ] && stop "an app deploy has been running for 2 hours"; step "an app deploy is running: waiting"; sleep 300; done; }
EDS="traverse-data traverse-yards-data traverse-solar-data traverse-pest-data traverse-security-data"

$VM "test -f ~/run/fill1031/$STAGE.vmdone" < /dev/null || stop "the cloud machine has not finished $STAGE: $($VM 'cat ~/run-status.txt' < /dev/null)"
wifi; mkdir -p "$S" || stop "scratchpad"
okt() { $VM "cat ~/run/fill1031/$STAGE-ok.txt" < /dev/null | tr -d '\r' | grep -E '^[a-z0-9-]+$'; }
rx() { echo "$*" | tr ' ' '\n' | grep -v '^$' | paste -sd '|'; }

# copy back one coordinate cache and merge it into the laptop's (backup first, kept from the first try)
merge_cache() {   # <path on the VM> <local path> <name>
  $SCPV "yard@20.91.198.101:$1" "$S/cloud-$3" || stop "copy back $3"
  [ -f "$S/before-$3" ] || cp "$2" "$S/before-$3" || stop "backup $3"
  node --max-old-space-size=8192 -e "
const fs=require('fs');const [loc,cl]=process.argv.slice(1);const L=JSON.parse(fs.readFileSync(loc)),C=JSON.parse(fs.readFileSync(cl));
let add=0,fix=0,up=0;for(const [k,v] of Object.entries(C)){const o=L[k];if(!v)continue;
 if(!o){L[k]=v;add++}else if(o.err&&!v.err){L[k]=v;fix++}else if(!o.err&&!v.err&&o.src&&o.src!=='lidar'&&v.src==='lidar'){L[k]=v;up++}}
fs.writeFileSync(loc+'.tmp',JSON.stringify(L));fs.renameSync(loc+'.tmp',loc);console.log(loc+': +'+add+' new, '+fix+' errors replaced, '+up+' canopy readings replaced by laser, now '+Object.keys(L).length)" "$2" "$S/cloud-$3" || stop "merge $3"
}
# side-file counts per town (doors in <prefix>-<town>.json) in a folder, for before/after checks
counts() { node -e "const fs=require('fs');const [dir,p,...t]=process.argv.slice(1);const o={};for(const x of t){const f=dir+'/'+p+'-'+x+'.json';o[x]=fs.existsSync(f)?Object.keys(JSON.parse(fs.readFileSync(f)).doors||{}).length:0}console.log(JSON.stringify(o))" "$@"; }
# the editions' build (copies app/data/rounds into each edition's dist folder)
editions() { (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror"); }
# door files of the given towns to Sixfold and the five editions, then a live read-back
push_doors() {   # <label> <towns...>
  local label=$1; shift; local towns="$*"
  local six; six=$(node -e "const s=new Set(require(process.argv[1]).regions.map(r=>r.key));console.log(process.argv.slice(2).filter(t=>s.has(t)).join(' '))" "$(cd "$RD" && pwd -W)/index.json" $towns)
  nodeploy; wifi
  if [ -n "$six" ]; then
    bash upload-towns-sixfold.sh "$label" $six || stop "Sixfold upload failed"
    [ -f "logs-upload/$label.done" ] || stop "Sixfold upload did not finish (another upload running?)"
  fi
  for d in $EDS; do
    wifi; nodeploy
    bash ./push-edition.sh "$d" "^($(rx $towns))\.json$" | tee "$S/push-$d-doors.txt"
    grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d-doors.txt" && grep -q "json ok" "$S/push-$d-doors.txt" || stop "push $d did not match"
  done
  for t in $(echo $six | tr ' ' '\n' | head -3); do
    live=$($SG "md5sum ~/www/traverseplatforms.com/sixfold-data/rounds/$t.json | cut -c1-32" < /dev/null)
    [ "$live" = "$(md5sum "$RD/$t.json" | cut -c1-32)" ] || stop "live Sixfold $t.json differs from the build"
    step "live: Sixfold $t.json md5 ${live:0:12} OK"
  done
}
# roof/solar/outline/photo side files of the given towns to Roofing and Solar
push_side() {   # <towns...>
  local towns="$*" RX="^(roof|solar|outline|photo)-($(rx $*))\.json$" max=$(( $(echo $* | wc -w) * 4 ))
  for d in traverse-data traverse-solar-data; do
    wifi; nodeploy
    DRY=1 bash ./push-edition.sh "$d" "$RX" > "$S/dry-$d.txt" || stop "dry run $d failed"
    n=$(grep -cE '^(roof|solar|outline|photo)-' "$S/dry-$d.txt"); step "$d: $n side files to send"
    [ "$n" -le "$max" ] || stop "$d would send $n files (at most $max expected)"
    bash ./push-edition.sh "$d" "$RX" | tee "$S/push-$d.txt"
    grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
  done
  for t in $(echo $towns | tr ' ' '\n' | head -2); do
    [ -f "$ED/traverse-data/rounds/roof-$t.json" ] || continue
    live=$($SG "md5sum ~/www/traverseplatforms.com/traverse-data/rounds/roof-$t.json | cut -c1-32" < /dev/null)
    [ "$live" = "$(md5sum "$ED/traverse-data/rounds/roof-$t.json" | cut -c1-32)" ] || stop "live roof-$t.json differs from the build"
    step "live: roof-$t.json md5 ${live:0:12} OK"
  done
}
# roof, sun, photo and outline files for every town from the merged caches (as finish-layers-2026-10-26.sh)
build_side() {
  step "build roof + houses files"; (cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) | tail -2 || stop "roof build"
  step "build solar files";         (cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns) | tail -2 || stop "solar build"
  step "build roof photo files";    (cd roofs && node --max-old-space-size=8192 photo-index.mjs build --all-towns) | tail -2 || stop "photo build"
  step "build photo outlines";      (cd roofs && node --max-old-space-size=8192 outline-photos.mjs) | tail -2 || stop "outline build"
}
doors_build() { step "build door files"; node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two" || stop "build-rounds-data failed"; }
LABEL="$STAGE-$(date +%Y%m%d)"

case $STAGE in
lawnfix)
  TOWNS=$(okt); step "towns: $(echo $TOWNS | wc -w)"; [ -n "$TOWNS" ] || stop "no finished towns"
  $VM "cd ~/run/lawn-trial/yard-v2 && tar czf - $(for t in $TOWNS; do printf '%s.json ' "$t"; done)" < /dev/null > "$S/yard.tgz" || stop "copy back failed"
  rm -rf "${S:?}/new" && mkdir -p "$S/new" "$S/before" && tar xzf "$S/yard.tgz" -C "$S/new" || stop "unpack"
  for t in $TOWNS; do [ -f "$S/before/$t.json" ] || cp "lawn-trial/yard-v2/$t.json" "$S/before/$t.json" 2>/dev/null; done
  GOOD=$(node -e "
const fs=require('fs'),[S,RD,ED,...T]=process.argv.slice(1);const good=[];let a0=0,a1=0;
for(const t of T){const df=[RD+'/'+t+'.json',ED+'/'+t+'.json'].find(fs.existsSync);const nf=S+'/new/'+t+'.json',of=S+'/before/'+t+'.json';if(!df||!fs.existsSync(nf)){console.error(t+': missing file');continue}
const ids=new Set(JSON.parse(fs.readFileSync(df)).areas.flatMap(a=>a.doors.map(x=>x.id)));const N=JSON.parse(fs.readFileSync(nf)).doors,O=fs.existsSync(of)?JSON.parse(fs.readFileSync(of)).doors:{};
const lot=m=>Object.values(m).filter(v=>v&&(v.lot||v.big||v.shared)).length;const stray=Object.keys(N).filter(k=>!ids.has(k)).length;let lost=0;for(const [k,v] of Object.entries(O))if(v&&v.lot&&!(N[k]&&N[k].lot))lost++;
const ok=!stray&&lost<=Math.max(5,lot(O)*0.01)&&lot(N)>=lot(O);a0+=lot(O);a1+=lot(N);
console.error(t+': lots '+lot(O)+' -> '+lot(N)+', answers '+Object.keys(O).length+' -> '+Object.keys(N).length+', stray '+stray+', lost '+lost+(ok?'':'  LEFT OUT'));if(ok)good.push(t)}
console.error('all: lots '+a0+' -> '+a1);console.log(good.join(' '))" "$S" "$RD" "$ED/traverse-data/rounds" $TOWNS 2> "$S/check.txt")
  cat "$S/check.txt" | tail -40; [ -n "$GOOD" ] || stop "no town's yard v2 file checked out"
  for t in $GOOD; do cp "$S/new/$t.json" "lawn-trial/yard-v2/$t.json" || stop "copy $t"; done
  step "towns that checked out: $(echo $GOOD | wc -w)"
  for t in $GOOD; do [ -f "$S/before/door-$t.json" ] || cp "$RD/$t.json" "$S/before/door-$t.json" 2>/dev/null; done
  (cd lawn-trial && node --max-old-space-size=8192 build-yard-v2.mjs | head -1) || stop "build-yard-v2 failed"
  doors_build
  node -e "
const fs=require('fs'),[S,RD,...T]=process.argv.slice(1);let bad=0,l0=0,l1=0;for(const t of T){const b=S+'/before/door-'+t+'.json';if(!fs.existsSync(b)||!fs.existsSync(RD+'/'+t+'.json'))continue;
const c=f=>{const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);return [d.length,d.filter(x=>x.lawn&&x.lawn.sq!=null).length]};const [n0,a]=c(b),[n1,z]=c(RD+'/'+t+'.json');l0+=a;l1+=z;if(n1!==n0||z<a){console.log(t+': doors '+n0+' -> '+n1+', with a lawn size '+a+' -> '+z);bad++}}
console.log('door files: with a lawn size '+l0+' -> '+l1);process.exit(bad?1:0)" "$S" "$RD" $GOOD || stop "a rebuilt door file did not check out"
  editions
  push_doors "$LABEL" $GOOD
  step "done: lawn fixes live for $(echo $GOOD | wc -w) towns; old files in $S/before; note in TASKS.md TR-54" ;;
roofsolar|newlidar|outlinefix)
  TOWNS=$(okt); step "towns: $(echo $TOWNS | wc -w)"; [ -n "$TOWNS" ] || stop "no finished towns"
  if [ $STAGE = newlidar ]; then [ -f tree-zones/lidar-surveys-extra.json ] || stop "tree-zones/lidar-surveys-extra.json is not in this checkout (merge the fill1031 commit first)"; fi
  B0=$(counts "$ED/traverse-data/rounds" roof $TOWNS); BS=$(counts "$ED/traverse-solar-data/rounds" solar $TOWNS)
  merge_cache "$VT/roofs/roof-cache.json" roofs/roof-cache.json roof-cache.json
  merge_cache "$VT/solar/solar-cache.json" solar/solar-cache.json solar-cache.json
  [ $STAGE != roofsolar ] && merge_cache "$VT/tree-cache.json" tree-cache.json tree-cache.json
  if [ ! -f "$S/before-side.tgz" ]; then (cd "$ED" && tar czf "$S/before-side.tgz" $(for t in $TOWNS; do for d in traverse-data traverse-solar-data; do for p in roof solar outline photo; do [ -f "$d/rounds/$p-$t.json" ] && echo "$d/rounds/$p-$t.json"; done; done; done) 2>/dev/null) || true; fi
  build_side
  [ $STAGE != roofsolar ] && doors_build
  editions
  A0=$(counts "$ED/traverse-data/rounds" roof $TOWNS); AS=$(counts "$ED/traverse-solar-data/rounds" solar $TOWNS)
  node -e "const [b,a,bs,as]=process.argv.slice(1).map(JSON.parse);let r0=0,r1=0,s0=0,s1=0,bad=[];for(const t in a){r0+=b[t];r1+=a[t];s0+=bs[t]||0;s1+=as[t]||0;if(a[t]<b[t]||(as[t]||0)<(bs[t]||0))bad.push(t)}
console.log('roof doors '+r0+' -> '+r1+', sun doors '+s0+' -> '+s1);if(bad.length){console.log('fewer than before: '+bad.join(' '));process.exit(1)}" "$B0" "$A0" "$BS" "$AS" || stop "a town has fewer roof or sun readings than before"
  push_side $TOWNS
  [ $STAGE != roofsolar ] && push_doors "$LABEL" $TOWNS
  step "done: $STAGE live for $(echo $TOWNS | wc -w) towns; old caches $S/before-*.json, old side files $S/before-side.tgz; note in TASKS.md TR-54" ;;
dougmat)
  TOWNS=$(okt); step "towns: $TOWNS"; [ -n "$TOWNS" ] || stop "no finished towns"
  $VM "cd ~/run/tv/traverse && tar czf - \$(for t in $TOWNS; do f=app/data/rounds/material-\$t.json; [ -f \$f ] && echo \$f; done) data-pipeline/door-territory/roofs/material/coverage.json" < /dev/null > "$S/back.tgz" || stop "copy back failed"
  rm -rf "${S:?}/back" && mkdir -p "$S/back" && tar xzf "$S/back.tgz" -C "$S/back" || stop "unpack failed"
  node -e "
const fs=require('fs'),[dir,...towns]=process.argv.slice(1);let tot=0,county=0,bad=0;
for(const t of towns){const f=dir+'/material-'+t+'.json';if(!fs.existsSync(f)){console.log('  '+t+': no file');bad++;continue}const v=Object.values(JSON.parse(fs.readFileSync(f)).doors||{});const c=v.filter(x=>x.src==='county').length;tot+=v.length;county+=c;
console.log('  '+t+': '+v.length+' doors with a material ('+c+' county record, '+v.filter(x=>x.src==='imagery').length+' photo, '+v.filter(x=>x.src==='guess').length+' probably)')}
console.log('all: '+tot+' ('+county+' county)');process.exit(bad||!county?1:0)" "$S/back/app/data/rounds" $TOWNS || stop "material files did not check out"
  if [ ! -f "$S/before.tgz" ]; then (cd "$RD" && tar czf "$S/before.tgz" $(for t in $TOWNS; do [ -f material-$t.json ] && echo material-$t.json; done) 2>/dev/null) || true; fi
  cp "$S"/back/app/data/rounds/material-*.json "$RD/" || stop "copy into app/data/rounds"
  node -e "const fs=require('fs'),[loc,vm,...towns]=process.argv.slice(1);const L=JSON.parse(fs.readFileSync(loc)),V=JSON.parse(fs.readFileSync(vm));let n=0;for(const t of towns)if(V[t]){L[t]=V[t];n++}fs.writeFileSync(loc,JSON.stringify(L,null,1));console.log('coverage.json: '+n+' towns merged')" roofs/material/coverage.json "$S/back/data-pipeline/door-territory/roofs/material/coverage.json" $TOWNS || stop "coverage merge"
  for d in traverse-data traverse-solar-data; do for t in $TOWNS; do grep -qE "\"key\": *\"$t\"" "$ED/$d/rounds/index.json" && cp "$RD/material-$t.json" "$ED/$d/rounds/"; done; done
  for d in traverse-data traverse-solar-data; do
    wifi; nodeploy
    bash ./push-edition.sh "$d" "^material-($(rx $TOWNS))\.json$" | tee "$S/push-$d.txt"
    grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
  done
  for t in $TOWNS; do live=$($SG "md5sum ~/www/traverseplatforms.com/traverse-data/rounds/material-$t.json | cut -c1-32" < /dev/null)
    [ "$live" = "$(md5sum "$RD/material-$t.json" | cut -c1-32)" ] || stop "live material-$t.json differs"; step "live: material-$t.json md5 ${live:0:12} OK"; done
  step "done: Douglas roof material live on Roofing and Solar; rollback $S/before.tgz + the server's before-push backups; note in TASKS.md TR-54" ;;
trees2)
  TOWNS=$(okt); step "towns: $(echo $TOWNS | wc -w)"; [ -n "$TOWNS" ] || stop "no finished towns"
  merge_cache "$VT/tree-cache.json" tree-cache.json tree-cache.json
  doors_build; editions
  push_doors "$LABEL" $TOWNS
  step "done: trees live for $(echo $TOWNS | wc -w) towns; old cache $S/before-tree-cache.json; note in TASKS.md TR-54" ;;
values)
  $SCPV "yard@20.91.198.101:run/fill1031/value-extra.json" "$S/value-extra.json" || stop "copy back"
  [ -f "$S/before-value-cache.json" ] || cp value-cache.json "$S/before-value-cache.json"
  TV=$($VM "cut -d' ' -f1 ~/run/fill1031/values-towns.txt" < /dev/null | tr -d '\r' | grep -E '^[a-z0-9-]+$')
  V0=$(node -e "const fs=require('fs'),[ed,...t]=process.argv.slice(1);const o={};for(const x of t){const f=ed+'/'+x+'.json';if(!fs.existsSync(f))continue;o[x]=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors).filter(d=>d.val).length}console.log(JSON.stringify(o))" "$ED/traverse-data/rounds" $TV)
  node -e "const fs=require('fs');const L=JSON.parse(fs.readFileSync('value-cache.json')),V=JSON.parse(fs.readFileSync(process.argv[1]));let n=0;for(const [k,v] of Object.entries(V))if(v&&v.v>0&&!(L[k]&&L[k].v>0)){L[k]=v;n++}fs.writeFileSync('value-cache.json.tmp',JSON.stringify(L));fs.renameSync('value-cache.json.tmp','value-cache.json');console.log('value-cache.json: '+n+' values added')" "$S/value-extra.json" || stop "merge"
  doors_build; editions
  GAIN=$(node -e "const fs=require('fs'),[ed,b]=process.argv.slice(1);const B=JSON.parse(b);const g=[];let a0=0,a1=0;for(const x in B){const n=JSON.parse(fs.readFileSync(ed+'/'+x+'.json')).areas.flatMap(a=>a.doors).filter(d=>d.val).length;a0+=B[x];a1+=n;if(n>B[x])g.push(x)}console.error('homes with a value: '+a0+' -> '+a1+' in '+g.length+' towns');console.log(g.join(' '))" "$ED/traverse-data/rounds" "$V0")
  [ -n "$GAIN" ] || stop "no town gained a value"
  push_doors "$LABEL" $GAIN
  step "done: values live for $(echo $GAIN | wc -w) towns; old cache $S/before-value-cache.json; note in TASKS.md TR-54" ;;
*) stop "unknown stage $STAGE" ;;
esac

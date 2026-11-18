#!/bin/bash
# Roof material for the every-home doors, part 2 of 2 (18 Nov 2026; part 1: every1115/prep-matnew-2026-11-18.sh, cloud stage matnew).
#   bash every1115/finish-matnew-2026-11-18.sh > logs-finish-matnew.log 2>&1        (from door-territory)
# Uploads are under Matthew's standing permission for app data (backups + md5 kept). Roofing and Solar are the editions that keep
# material-, year- and naip- files; Solar also gets hailmax- (its hail line, made from Roofing's hail files, which finish-hailnew merged).
#   1. waits: off the hotspot, on AC, no other build/upload (finish-hailnew included: Solar's hail line is made from its result);
#      the cloud's matnew-result.tgz with part 1's tag;
#   2. merges, ADD-ONLY (an existing door's entry is never replaced; old files kept in push-tmp/matnew/before):
#      - towns of ours: the cloud's material-<town>-nd1118 / naip-<town>-nd1118 into material-<town> / naip-<town>; then every added door
#        with a county roof record in year-<town>.json (predict.py's county rule: the record as is, p 1) that still has none;
#      - new towns: the cloud's re-prediction (county + photo calls, now with the year file), then the county rule for every door;
#   3. builds Roofing and Solar (build-editions.cjs roofing, solar);
#   4. pushes material-, year-, naip- (Roofing) and material-, year-, naip-, hailmax- (Solar) for the new towns and the towns that gained
#      doors, exact filter, dry run and count check first, MD5 MATCH required;
#   5. live check: a new town's door list on Roofing shows roof material.
set -u
exec < /dev/null
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/matnew"; mkdir -p "$S"; SN=$(cygpath -m "$S")
RD=../../app/data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting"; sleep 120; done; }
onac() { local i=0; while [ "$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r ')" != "2" ]; do i=$((i+1)); [ $i -gt 72 ] && stop "not on AC power for 6 hours"; step "on battery: waiting for AC"; sleep 300; done; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|finish-yardgap|finish-every|rebuild-upload-all|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold|finish-hailnew|prep-matnew' }).Count" 2>/dev/null | tr -d '\r'; }
[ -s "$S/tag.txt" ] && [ -f "$S/year.ok" ] && [ -s "$S/newids.json" ] && [ -s "$S/in/plan.tsv" ] || stop "part 1 has not run (every1115/prep-matnew-2026-11-18.sh)"
TAG=$(cat "$S/tag.txt"); Q='~/run/fill1031'

## 1. the cloud result
offhot
fails=0; state=""
for i in $(seq 1 240); do   # 240 x 3 min = 12 h
  r=$($VM "cd $Q; if [ -f matnew.vmdone ] && [ \"\$(cat matnew-result.tag 2>/dev/null)\" = '$TAG' ]; then echo done; elif [ -f matnew.failed ]; then echo \"failed: \$(tail -3 matnew.log | tr '\n' ' ')\"; else echo \"waiting: \$(cat ~/run-status.txt | cut -c1-100)\"; fi") || { fails=$((fails+1)); [ $fails -ge 10 ] && stop "cloud machine unreachable for 30 minutes"; sleep 180; continue; }
  fails=0
  case "$r" in done) state=done; break;; waiting*) [ $((i % 10)) = 1 ] && step "$r";; *) stop "cloud stage $r";; esac
  sleep 180
done
[ "$state" = done ] || stop "cloud stage not done after 12 hours"
step "cloud stage done: $($VM "cat $Q/matnew-ok.txt | wc -l") keys finished of $(($(wc -l < "$S/in/plan.tsv") - 1))"
offhot; onac
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 72 ] && stop "another upload or build has run for 6 hours"; step "another upload/build is running: waiting"; sleep 300; done
rm -rf "$S/back" && mkdir -p "$S/back" || stop "scratch"
$VM "cat $Q/matnew-result.tgz" > "$S/back.tgz" && tar xzf "$S/back.tgz" -C "$S/back" || stop "copy back failed"
step "copied back $(ls "$S/back" | wc -l) files"

## 2. merge, add-only
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD',S='$SN';const J=f=>JSON.parse(fs.readFileSync(f));const has=f=>fs.existsSync(f);
const src=fs.readFileSync('roofs/material/features.py','utf8');const blk=src.match(/CLASS_OF = \{([\s\S]*?)\n\}/);if(!blk)throw new Error('CLASS_OF not found in features.py');
const CLASS={};for(const m of blk[1].matchAll(/'([^']+)':\s*'([^']+)'/g))CLASS[m[1]]=m[2];
const nw=J(S+'/newids.json');const keys=fs.readFileSync(S+'/keys.txt','utf8').split(/\s+/).filter(Boolean);const today=new Date().toISOString().slice(0,10);
fs.mkdirSync(S+'/before',{recursive:true});const keep=f=>{const b=S+'/before/'+f;if(has(R+'/'+f)&&!has(b))fs.copyFileSync(R+'/'+f,b)};
const skel=()=>({source:'County assessor roof material where the county records it (county: Douglas, Adams, Boulder, Weld, Larimer) + USDA NAIP 2023 0.3 m imagery classifier (imagery: tested 96%+ right; guess: its best guess below that); see operations/door-territory/roofs/material/README.md',built:today,classes:{asphalt:'composition shingle or roll',tile:'concrete or clay tile',shake:'wood shake',metal:'metal',flat:'built-up or membrane'},thresholds:{},doors:{}});
const tot={county:0,imagery:0,guess:0,naip:0},changed=new Set(),per=[];
function one(t,cloudKey,ids){const mf='material-'+t+'.json';const M=has(R+'/'+mf)?J(R+'/'+mf):skel();M.doors=M.doors||{};const add={county:0,imagery:0,guess:0};
  const cf=S+'/back/material-'+cloudKey+'.json';if(has(cf)){const C=J(cf);for(const [i,v] of Object.entries(C.doors||{}))if(!M.doors[i]&&(cloudKey===t||ids.has(i))){M.doors[i]=v;add[v.src]=(add[v.src]||0)+1}if(!Object.keys(M.thresholds||{}).length&&C.thresholds)M.thresholds=C.thresholds}
  const yf=R+'/year-'+t+'.json';if(has(yf)){const Y=J(yf).doors||{};for(const i of ids){const c=Y[i]&&CLASS[Y[i].mat];if(c&&!M.doors[i]){M.doors[i]={m:c,p:1,src:'county'};add.county++}}}
  let n=0;for(const k in add){tot[k]=(tot[k]||0)+add[k];n+=add[k]}
  if(n){keep(mf);M.built=today;fs.writeFileSync(R+'/'+mf+'.tmp',JSON.stringify(M));JSON.parse(fs.readFileSync(R+'/'+mf+'.tmp'));fs.renameSync(R+'/'+mf+'.tmp',R+'/'+mf);changed.add(t)}
  const nf=S+'/back/naip-'+cloudKey+'.json';let np=0;if(cloudKey!==t&&has(nf)){const C=J(nf);const pf='naip-'+t+'.json';const P=has(R+'/'+pf)?J(R+'/'+pf):{source:C.source,built:today,doors:{}};P.doors=P.doors||{};
    for(const [i,v] of Object.entries(C.doors||{}))if(!P.doors[i]&&ids.has(i)){P.doors[i]=v;np++}
    if(np){keep(pf);P.built=today;fs.writeFileSync(R+'/'+pf,JSON.stringify(P));changed.add(t);tot.naip+=np}}
  if(n||np)per.push([t,ids.size,add.county,add.imagery,add.guess,np].join('\t'))}
for(const [t,ids] of Object.entries(nw))one(t,t+'-nd1118',new Set(ids));
for(const k of keys){const ids=new Set(J(R+'/'+k+'.json').areas.flatMap(a=>a.doors.map(d=>d.id)));one(k,k,ids)}
fs.writeFileSync(S+'/changed.txt',[...changed].join('\n')+'\n');fs.writeFileSync(S+'/per-town.tsv','town\tdoors\tcounty\timagery\tguess\tnaip\n'+per.join('\n')+'\n');
console.log('roof material added: county records '+tot.county+', photo calls '+tot.imagery+', photo best guesses '+tot.guess+'; close-up photos '+tot.naip+'; towns changed '+changed.size)" || stop "the merge failed (old files in $S/before)"
# add-only check: every entry in the kept old files is still there, unchanged
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD',B='$SN/before';let bad=[],n=0;
for(const f of fs.readdirSync(B)){const O=JSON.parse(fs.readFileSync(B+'/'+f)).doors||{},N=JSON.parse(fs.readFileSync(R+'/'+f)).doors||{};for(const [i,v] of Object.entries(O)){n++;if(JSON.stringify(N[i])!==JSON.stringify(v))bad.push(f+'/'+i)}}
console.log('add-only check: '+n+' existing entries unchanged'+(bad.length?', '+bad.length+' CHANGED':''));process.exit(bad.length?1:0)" || stop "an existing entry changed"
sort -t$'\t' -k3,3nr -k4,4nr "$S/per-town.tsv" | head -12

## 3. build Roofing and Solar
T="$(cat "$S/keys.txt" "$S/merge.txt" | grep -v '^$' | sort -u)"
step "build Roofing and Solar"
for e in roofing solar; do (cd ../../app && nice -n 19 node --max-old-space-size=8192 ../editions/build-editions.cjs $e > "$S/build-$e.out" 2>&1) || { tail -5 "$S/build-$e.out"; stop "build-editions $e failed"; }; grep -E "built|rror" "$S/build-$e.out" | tail -3; done

## 4. push: exact filter, dry run and count first
alt() { echo "$*" | tr ' ' '\n' | grep -v '^$' | paste -sd'|'; }
NT=$(echo $T | wc -w)
for d in traverse-data traverse-solar-data; do
  if [ $d = traverse-data ]; then P='material|year|naip'; want=$((3 * NT)); else P='material|year|naip|hailmax'; want=$((4 * NT)); fi
  RX="^($P)-($(alt $T))\.json\$"
  offhot
  DRY=1 bash ./push-edition.sh $d "$RX" > "$S/push-dry-$d.txt" || stop "push dry run $d failed"
  n=$(grep -cE "^($P)-" "$S/push-dry-$d.txt"); step "$d: $n files to send ($(grep -E "^($P)-" "$S/push-dry-$d.txt" | sed 's/-.*//' | sort | uniq -c | tr -s ' ' | tr '\n' ' '))"
  [ "$n" -le "$want" ] || stop "$d: push would send $n files, more than the $want expected"
  retry bash ./push-edition.sh $d "$RX" | grep -vE '^traverse[a-z-]*: [0-9]+ changed' | tee "$S/push-$d.txt"
  grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push to $d did not match (MD5)"
done

## 5. live check on Roofing: the new town with the most roof material shows it on its door list
K=$(node -e "const fs=require('fs');let b=null;for(const k of fs.readFileSync('$SN/keys.txt','utf8').split(/\s+/).filter(Boolean)){const n=Object.keys(JSON.parse(fs.readFileSync('$RD/material-'+k+'.json')).doors||{}).length;if(!b||n>b[1])b=[k,n]}console.log(b&&b[1]?b[0]:'')")
if [ -n "$K" ]; then
  OUT=$(awk -v t="$K" '$1~/^traverse$/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | $SG "$(cat ./elc2.sh)")
  echo "$OUT" | grep -E "^traverse " | cut -c1-400
  echo "$OUT" | grep -qE " mat:[1-9]" || step "live check: no roof material on the middle neighbourhood of $K (it may have none there; the md5 read-back above stands)"
fi
step "done: roof material for the every-home doors live on Roofing and Solar ($(wc -l < "$S/changed.txt") towns changed); old files in $S/before and $S/year-before"

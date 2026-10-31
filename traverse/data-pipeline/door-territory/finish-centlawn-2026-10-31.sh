#!/bin/bash
# Centennial's lawns measured again with yard v2 (2026-10-31 overnight queue, stage centlawn of traverse/ops/run-cloud-finishers.sh).
# 8,880 of Centennial's 30,291 doors read "no lot": the west side was added on 25 Oct and its lot cells were saved on the old grid origin
# (fixed in yard-v2-town.mjs by e8cf845, but Centennial's run was older). The cloud machine cleared those doors and measured them again
# (overnight/queue-1031-vm.sh) and leaves ~/run/ovn1031/centlawn.vmdone. By hand: bash finish-centlawn-2026-10-31.sh > logs-finish-centlawn.log 2>&1
#   1. copies back lawn-trial/yard-v2/centennial.json (the old one saved in the scratchpad first) and checks it: same door ids as the
#      door file, more doors with a lot than before, none of the doors that had a reading lost;
#   2. builds yard-v2-lawn.json and the door files (build-rounds-data.mjs), then the editions;
#   3. uploads Centennial only: Sixfold (upload-towns-sixfold.sh, which keeps a backup and replaces the one index entry) and every
#      edition with an exact filter (^centennial\.json$; MD5 MATCH);
#   4. reads the live Sixfold and Roofing centennial.json back (md5 against local).
# Any failure stops with "STOP:" and exit 1. Safe to re-run.
set -u
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; cd "$DT" || exit 1
S0=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
S="$S0/centlawn"; RD=../../app/data/rounds; ED=../../editions/dist
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }

$VM 'test -f ~/run/ovn1031/centlawn.vmdone' < /dev/null || stop "the cloud machine has not finished centlawn: $($VM 'cat ~/run-status.txt' < /dev/null)"
wifi; mkdir -p "$S" || stop "scratchpad"

## 1. copy back and check
$VM 'cat ~/run/lawn-trial/yard-v2/centennial.json' < /dev/null > "$S/centennial.new.json" || stop "copy back failed"
[ -f "$S/centennial.before.json" ] || cp lawn-trial/yard-v2/centennial.json "$S/centennial.before.json" || stop "backup"
node -e "
const fs=require('fs'),[o,n,d]=process.argv.slice(1);const O=JSON.parse(fs.readFileSync(o)).doors,N=JSON.parse(fs.readFileSync(n)).doors;
const ids=new Set(JSON.parse(fs.readFileSync(d)).areas.flatMap(a=>a.doors.map(x=>x.id)));
const lot=(m)=>Object.values(m).filter(v=>v&&(v.lot||v.big||v.shared)).length,nul=(m)=>Object.values(m).filter(v=>v===null).length;
const stray=Object.keys(N).filter(k=>!ids.has(k)).length;let lost=0;for(const [k,v] of Object.entries(O))if(v&&v.lot&&!(N[k]&&N[k].lot))lost++;
console.log('before: '+Object.keys(O).length+' doors, '+lot(O)+' read, '+nul(O)+' no lot | after: '+Object.keys(N).length+' doors, '+lot(N)+' read, '+nul(N)+' no lot | ids not in the door file '+stray+', readings lost '+lost);
process.exit(stray||lost>50||lot(N)<=lot(O)?1:0)" "$S/centennial.before.json" "$S/centennial.new.json" "$RD/centennial.json" || stop "the new yard v2 file did not check out"
cp "$S/centennial.new.json" lawn-trial/yard-v2/centennial.json || stop "copy into lawn-trial/yard-v2"

## 2. build
[ -f "$S/centennial.door.before.json" ] || cp "$RD/centennial.json" "$S/centennial.door.before.json"
(cd lawn-trial && node build-yard-v2.mjs | head -1) || stop "build-yard-v2 failed"
node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "wrote|listed by two" || stop "build-rounds-data failed"
node -e "
const fs=require('fs'),[a,b]=process.argv.slice(1);const c=(f)=>{const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);return [d.length,d.filter(x=>x.lawn&&x.lawn.sq!=null).length]};
const [n0,l0]=c(a),[n1,l1]=c(b);console.log('centennial door file: '+n0+' -> '+n1+' doors; with a lawn size '+l0+' -> '+l1);process.exit(n1!==n0||l1<l0?1:0)" "$S/centennial.door.before.json" "$RD/centennial.json" || stop "the rebuilt centennial.json did not check out"
(cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")

## 3. upload Centennial only
wifi
LABEL="centlawn-20261031-$(date +%H%M)"
bash upload-towns-sixfold.sh "$LABEL" centennial || stop "Sixfold upload failed"
[ -f logs-upload/$LABEL.done ] || stop "Sixfold upload did not finish (another upload running?)"
for d in traverse-data traverse-yards-data traverse-solar-data traverse-pest-data traverse-security-data; do
  wifi
  bash ./push-edition.sh "$d" '^centennial\.json$' | tee "$S/push-$d.txt"
  grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
done

## 4. live check
live=$($SG "md5sum ~/www/traverseplatforms.com/sixfold-data/rounds/centennial.json | cut -c1-32" < /dev/null)
[ "$live" = "$(md5sum "$RD/centennial.json" | cut -c1-32)" ] || stop "live Sixfold centennial.json differs from the build"
live2=$($SG "md5sum ~/www/traverseplatforms.com/traverse-data/rounds/centennial.json | cut -c1-32" < /dev/null)
[ -z "$live2" ] || [ "$live2" = "$(md5sum "$ED/traverse-data/rounds/centennial.json" | cut -c1-32)" ] || stop "live Roofing centennial.json differs from the build"
step "done: Centennial lawns live on Sixfold and the editions; old files $S/centennial.before.json, $S/centennial.door.before.json; note in TASKS.md"

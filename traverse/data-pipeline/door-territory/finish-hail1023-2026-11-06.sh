#!/bin/bash
# Hail hours for 10 am and 11 pm (2026-11-06; CLOUD-PLAN-2026-11 "hail hours from 10 am to midnight, catching late storms"). Stage hail1023
# of traverse/ops/run-cloud-finishers.sh, ready when ~/run/fill1031/hail1023.vmdone exists (overnight/fill1031/hail1023.sh,
# hail/rebuild-hail-hours.mjs --step=2 --hours=10,23 on the hail2min plan). Never over the phone hotspot.
#   1. copies back hail-hours-1023.json and the plan, and checks it: every plan date present, plan towns only, hours 10 and 23 only;
#   2. merges it into the live copy's hail-hours.json (hail/merge-hail-hours.mjs: union, refuses if any old hour would be lost), into
#      app/data/rounds (old copy kept) and Roofing's built folder, then push-edition.sh traverse-data with an exact filter. MD5 MATCH required;
#   3. the server's copy read back.
# Any failure stops with a "STOP:" line and exit 1; the finisher loop tries a stage at most 3 times. Safe to re-run (the merge is a union).
set -u
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory" || exit 1
S="$LOCALAPPDATA/ProjectBackup/cloud-finish/hail1023"; RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LIVE='~/www/traverseplatforms.com/traverse-data/rounds'
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }
mkdir -p "$S" || stop "backup folder"
[ -s "$DIST/index.json" ] || stop "no Roofing build"

## 1. copy back and check
wifi
$VM "test -f ~/run/fill1031/hail1023.vmdone" < /dev/null || stop "the cloud stage is not done (no hail1023.vmdone)"
step "cloud build: $($VM 'tail -1 ~/run/fill1031/hail1023.log' < /dev/null)"
$VM "cat ~/run/fill1031/hail1023/hail-hours-1023.json" < /dev/null > "$S/hail-hours-1023.json" || stop "copy back failed"
$VM "cat ~/run/fill1031/hail1023/plan.json" < /dev/null > "$S/plan.json" || stop "plan copy back failed"
node -e "
const f=require('fs'),p=JSON.parse(f.readFileSync(process.argv[1],'utf8')),h=JSON.parse(f.readFileSync(process.argv[2],'utf8'));
const miss=Object.keys(p.days).filter(d=>!h.days[d]);if(miss.length){console.error(miss.length+' dates missing from the build');process.exit(1)}
let pairs=0,bad=0;for(const d of Object.keys(h.days))for(const [t,hrs] of Object.entries(h.days[d])){pairs++;if(!p.towns[t]||!Array.isArray(hrs)||hrs.some(x=>x!==10&&x!==23))bad++}
if(bad){console.error(bad+' entries with an unknown town or an hour other than 10 and 23');process.exit(1)}
console.log('built: '+pairs+' town-days with a 10 am or 11 pm hour')" "$S/plan.json" "$S/hail-hours-1023.json" || stop "the built file did not check out"

## 2. merge with the server's copy (the live file is the master), into place and to Roofing
$SG "cat $LIVE/hail-hours.json" < /dev/null > "$S/live-before.json" || stop "could not read the server's hail-hours.json"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).days||process.exit(1)" "$S/live-before.json" || stop "the server's hail-hours.json does not parse"
node hail/merge-hail-hours.mjs "$S/live-before.json" "$S/hail-hours-1023.json" "$S/hail-hours.json" || stop "merge refused"
[ -f "$S/hail-hours.before.json" ] || cp "$RD/hail-hours.json" "$S/hail-hours.before.json"
cp "$S/hail-hours.json" "$RD/hail-hours.json" && cp "$S/hail-hours.json" "$DIST/hail-hours.json" || stop "copying into app/data/rounds or Roofing's build folder failed"
RX='^hail-hours\.json$'
DRY=1 bash ./push-edition.sh traverse-data "$RX" > "$S/push-dry.txt" || stop "push dry run failed"
n=$(grep -cE '^[a-z0-9-]+\.json$' "$S/push-dry.txt")
[ "$n" -le 1 ] || stop "push would send $n files, more than hail-hours.json"
bash ./push-edition.sh traverse-data "$RX" | tee "$S/push.txt"
grep -qE "MD5 MATCH|: 0 files to send" "$S/push.txt" && grep -q "json ok" "$S/push.txt" || stop "push to traverse-data did not match (MD5)"

## 3. the server's copy
LIVESUM=$($SG "cd $LIVE && md5sum hail-hours.json | cut -c1-32" < /dev/null)
[ "$LIVESUM" = "$(md5sum < "$S/hail-hours.json" | cut -c1-32)" ] || stop "the server's hail-hours.json is not the one built"
step "done: 10 am and 11 pm hail hours added on Roofing (md5 ${LIVESUM:0:12}); old copy $S/live-before.json; note in TASKS.md"

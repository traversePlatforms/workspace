#!/bin/bash
# The hail hours from every 2-minute radar file (2026-11-01; Matthew picked the full hail-hours rebuild for the cloud computer). Stage
# hail2min of traverse/ops/run-cloud-finishers.sh, ready when ~/run/fill1031/hail2min.vmdone exists (overnight/fill1031/hail2min.sh,
# hail/rebuild-hail-hours.mjs --step=2 on the plan the 20-minute rebuild used). Never over the phone hotspot.
#   1. copies back hail-hours.json (small) and the plan, and checks it: every plan date present, the towns are plan towns, the hours 11-22,
#      the 2-minute source line; and against the live file: how many town-days it keeps and adds;
#   2. into app/data/rounds (the old copy saved in the scratchpad first) and Roofing's built folder (the only edition with hail- files),
#      then push-edition.sh traverse-data with an exact filter (^hail-hours\.json$, one file). MD5 MATCH required;
#   3. the server's copy read back.
# Any failure stops with a "STOP:" line and exit 1; the finisher loop tries a stage at most 3 times. Safe to re-run.
#   bash finish-hail2min-2026-11-01.sh > logs-finish-hail2min.log 2>&1
set -u
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory" || exit 1
S="$LOCALAPPDATA/ProjectBackup/cloud-finish/hail2min"; RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LIVE='~/www/traverseplatforms.com/traverse-data/rounds'
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }
mkdir -p "$S" || stop "backup folder"
[ -s "$RD/hail-hours.json" ] && [ -s "$DIST/index.json" ] || stop "no hail-hours.json in app/data/rounds or no Roofing build"

## 1. copy back and check
wifi
$VM "test -f ~/run/fill1031/hail2min.vmdone" < /dev/null || stop "the cloud stage is not done (no hail2min.vmdone)"
step "cloud build: $($VM 'tail -1 ~/run/fill1031/hail2min.log' < /dev/null)"
$VM "cat ~/run/fill1031/hail2min/hail-hours.json" < /dev/null > "$S/hail-hours.json" || stop "copy back failed"
$VM "cat ~/run/fill1031/hail2min/plan.json" < /dev/null > "$S/plan.json" || stop "plan copy back failed"
node -e "
const f=require('fs'),p=JSON.parse(f.readFileSync(process.argv[1],'utf8')),h=JSON.parse(f.readFileSync(process.argv[2],'utf8'));
const pd=Object.keys(p.days),hd=Object.keys(h.days||{});
const miss=pd.filter(d=>!h.days[d]);if(miss.length){console.error(miss.length+' dates missing from the build: '+miss.slice(0,5).join(','));process.exit(1)}
let pairs=0,bad=0;for(const d of hd)for(const [t,hrs] of Object.entries(h.days[d])){pairs++;if(!p.towns[t]||!Array.isArray(hrs)||hrs.some(x=>!(x>=11&&x<=22)))bad++}
if(bad){console.error(bad+' entries with an unknown town or an hour outside 11-22');process.exit(1)}
if(!/every 2 minutes, archived/.test(h.source||'')){console.error('not the 2-minute build: '+h.source);process.exit(1)}
console.log('built: '+hd.length+' days ('+hd.filter(d=>Object.keys(h.days[d]).length).length+' with hours), '+pairs+' town-days with hours')" "$S/plan.json" "$S/hail-hours.json" || stop "the built hail-hours.json did not check out"
node -e "
const f=require('fs'),o=JSON.parse(f.readFileSync(process.argv[1],'utf8')).days||{},n=JSON.parse(f.readFileSync(process.argv[2],'utf8')).days;let kept=0,lost=0,added=0;
for(const d of Object.keys(o))for(const t of Object.keys(o[d]))(n[d]&&n[d][t]?kept++:lost++);
for(const d of Object.keys(n))for(const t of Object.keys(n[d]))if(!(o[d]&&o[d][t]))added++;
console.log('against the live file: '+kept+' town-days kept, '+added+' added, '+lost+' not in the rebuild');
if(lost>kept*0.05){console.error('more than 5% of the old town-days are gone: check before pushing');process.exit(1)}" "$RD/hail-hours.json" "$S/hail-hours.json" || stop "the rebuild drops too much of the old file"

## 2. into place and to Roofing
[ -f "$S/hail-hours.before.json" ] || cp "$RD/hail-hours.json" "$S/hail-hours.before.json"   # a retry keeps the first try's backup
cp "$S/hail-hours.json" "$RD/hail-hours.json" && cp "$S/hail-hours.json" "$DIST/hail-hours.json" || stop "copying into app/data/rounds or Roofing's build folder failed"
RX='^hail-hours\.json$'
DRY=1 bash ./push-edition.sh traverse-data "$RX" > "$S/push-dry.txt" || stop "push dry run failed"
head -2 "$S/push-dry.txt"
n=$(grep -cE '^[a-z0-9-]+\.json$' "$S/push-dry.txt")
[ "$n" -le 1 ] || stop "push would send $n files, more than hail-hours.json"
bash ./push-edition.sh traverse-data "$RX" | tee "$S/push.txt"
grep -qE "MD5 MATCH|: 0 files to send" "$S/push.txt" && grep -q "json ok" "$S/push.txt" || stop "push to traverse-data did not match (MD5)"

## 3. the server's copy
LIVESUM=$($SG "cd $LIVE && md5sum hail-hours.json | cut -c1-32" < /dev/null)
[ "$LIVESUM" = "$(md5sum "$S/hail-hours.json" | cut -c1-32)" ] || stop "the server's hail-hours.json is not the one built"
step "done: 2-minute hail-hours.json live on Roofing (md5 ${LIVESUM:0:12}); old copy $S/hail-hours.before.json; note in TASKS.md"

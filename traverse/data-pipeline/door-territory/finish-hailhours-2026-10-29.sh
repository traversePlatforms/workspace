#!/bin/bash
# When the hail fell, for every hail town and every day (2026-10-29; Matthew: "run it on the cloud computer once it is free"). Stage
# hailhours of traverse/ops/run-cloud-finishers.sh: starts only once g3hail is done (so the Group 3 towns' hail files are in), never beside
# another stage (the finishers' lock), never over the phone hotspot.   bash finish-hailhours-2026-10-29.sh > logs-finish-hailhours.log 2>&1
#   1. the plan, on this laptop: each hail town's door box and each date's towns (hail/rebuild-hail-hours.mjs stage; no owners, no ids);
#   2. on the cloud machine, in ~/run/hailhours: hail/rebuild-hail-hours.mjs build reads Iowa State's radar archive (MRMS MESH every
#      20 minutes, 11 am to 11 pm, for every date in the plan) and writes hail-hours.json. Not gis.colorado.gov. A run with the same plan
#      that finished is reused; one that stopped resumes where it was;
#   3. copies back hail-hours.json (small) and checks it: every plan date present, the towns are plan towns, the hours 11-22;
#   4. into app/data/rounds (the old copy saved in the scratchpad first) and Roofing's built folder (the only edition with hail- files),
#      then push-edition.sh traverse-data with an exact filter (^hail-hours\.json$, one file). MD5 MATCH required;
#   5. the server's copy read back: days and towns as built.
# Any failure stops with a "STOP:" line and exit 1; the finisher loop tries a stage at most 3 times. Safe to re-run.
set -u
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory" || exit 1   # the data's folder (2026-10-31: also when run from a worktree)
S0=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
S="$S0/hailhours"; RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LIVE='~/www/traverseplatforms.com/traverse-data/rounds'
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
# never move data over the phone (memory: SSID "iPhone" = no heavy downloads); the loop checks before starting, this while running
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }

## 0. g3hail first (the loop checks g3hail.done; this says so if run by hand too)
[ -f "$LOCALAPPDATA/ProjectBackup/cloud-finish/g3hail.done" ] || stop "g3hail is not done yet (finish-g3hail-2026-10-29.sh first)"
[ -s "$RD/hail-storms.json" ] && [ -s "$DIST/index.json" ] || stop "no hail-storms.json in app/data/rounds or no Roofing build"

## 1. the plan
mkdir -p "$S" || stop "scratchpad"
node --max-old-space-size=8192 hail/rebuild-hail-hours.mjs stage "$S/plan.json" || stop "staging the plan failed"
# 2026-10-31: the plan carries its build date, so a re-stage after midnight UTC made a new tag for the same plan; the third try
# then waited on a cloud build of the identical plan and stopped at the tag check. A cloud plan that differs only in "built" is used as is.
$VM "cat ~/run/hailhours/plan.json 2>/dev/null" < /dev/null > "$S/plan.vm.json" 2>/dev/null
if [ -s "$S/plan.vm.json" ] && node -e "const f=require('fs'),r=(p)=>{const j=JSON.parse(f.readFileSync(p,'utf8'));delete j.built;return JSON.stringify(j)};process.exit(r(process.argv[1])===r(process.argv[2])?0:1)" "$S/plan.json" "$S/plan.vm.json"; then
  cp "$S/plan.vm.json" "$S/plan.json"; step "the cloud machine's plan is the same apart from its date: using it"
fi
TAG=$(md5sum "$S/plan.json" | cut -c1-16)
step "plan tag $TAG: $(node -e "const p=require(process.argv[1]);console.log(Object.keys(p.towns).length+' towns, '+Object.keys(p.days).length+' days, '+Object.values(p.days).reduce((x,t)=>x+t.length,0)+' town-days')" "$S/plan.json")"

## 2. the cloud build
wifi
state=$($VM "mkdir -p ~/run/hailhours && cd ~/run/hailhours || exit 1; if pgrep -f '[r]ebuild-hail-hours.mjs build' > /dev/null; then echo running; elif [ -f hailhours.vmdone ] && [ \"\$(cat hailhours.vmdone)\" = '$TAG' ]; then echo done; else echo start; fi" < /dev/null) || stop "cloud machine not reachable"
step "cloud build: $state"
if [ "$state" = start ]; then
  $VM "command -v node > /dev/null" < /dev/null || stop "no node on the cloud machine"
  # the plan and the two scripts; a different plan starts over (its progress goes), the same plan resumes
  (cd hail && tar czf - rebuild-hail-hours.mjs mesh.mjs -C "$S" plan.json) | $VM "cd ~/run/hailhours && mkdir -p hail new && tar xzf - -C new && mv new/rebuild-hail-hours.mjs new/mesh.mjs hail/ && if ! cmp -s new/plan.json plan.json; then rm -f hail-hours.json hail-hours.json.progress hailhours.vmdone; mv new/plan.json plan.json; fi; rm -rf new" || stop "could not copy the plan to the cloud machine"
  $VM "cd ~/run/hailhours && (nohup bash -c 'nice -n 10 node hail/rebuild-hail-hours.mjs build plan.json hail-hours.json --conc=4 > ~/run-hailhours.log 2>&1 && echo $TAG > ~/run/hailhours/hailhours.vmdone' < /dev/null > /dev/null 2>&1 &) && echo started" < /dev/null || stop "could not start the cloud build"
  state=running
fi
if [ "$state" = running ]; then
  fails=0
  for i in $(seq 1 240); do   # 240 x 2 min; one day takes about 70 s here (36 radar files), so 160 days is 2-3 hours
    sleep 120
    r=$($VM "cd ~/run/hailhours; if pgrep -f '[r]ebuild-hail-hours.mjs build' > /dev/null; then echo running; elif [ -f hailhours.vmdone ] && [ \"\$(cat hailhours.vmdone)\" = '$TAG' ]; then echo done; else echo \"ended: \$(tail -2 ~/run-hailhours.log | tr '\n' ' ')\"; fi" < /dev/null) || { fails=$((fails+1)); [ $fails -ge 10 ] && stop "cloud machine unreachable for 20 minutes"; continue; }
    fails=0
    case "$r" in done) state=done; break;; running) ;; *) stop "cloud build $r (log ~/run-hailhours.log on the cloud machine)";; esac
  done
  [ "$state" = done ] || stop "cloud build still running after 8 hours"
fi
[ "$state" = done ] || stop "cloud build state '$state'"
step "cloud build done: $($VM 'tail -1 ~/run-hailhours.log' < /dev/null)"

## 3. copy back and check
wifi
$VM "cat ~/run/hailhours/hail-hours.json" < /dev/null > "$S/hail-hours.json" || stop "copy back failed"
node -e "
const p=require(process.argv[1]),h=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));
const pd=Object.keys(p.days),hd=Object.keys(h.days||{});
const miss=pd.filter(d=>!h.days[d]);if(miss.length){console.error('dates missing from the build: '+miss.slice(0,5).join(','));process.exit(1)}
let pairs=0,bad=0;for(const d of hd)for(const [t,hrs] of Object.entries(h.days[d])){pairs++;if(!p.towns[t]||!Array.isArray(hrs)||hrs.some(x=>!(x>=11&&x<=22)))bad++}
if(bad){console.error(bad+' entries with an unknown town or an hour outside 11-22');process.exit(1)}
if(!/MRMS MESH/.test(h.source||'')){console.error('no source line');process.exit(1)}
console.log('built: '+hd.length+' days ('+hd.filter(d=>Object.keys(h.days[d]).length).length+' with hours), '+pairs+' town-days with hours')" "$S/plan.json" "$S/hail-hours.json" || stop "the built hail-hours.json did not check out"
[ -f "$RD/hail-hours.json" ] && node -e "
const o=require(process.argv[1]).days||{},n=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')).days;let kept=0,lost=0;
for(const d of Object.keys(o))for(const t of Object.keys(o[d]))(n[d]&&n[d][t]?kept++:lost++);
console.log('the old file: '+kept+' town-days kept, '+lost+' not in the rebuild (a radar file missing from the archive now, or a town whose doors changed)')" "$(cd "$RD" && pwd)/hail-hours.json" "$S/hail-hours.json"

## 4. into place and to Roofing
[ -f "$RD/hail-hours.json" ] && [ ! -f "$S/hail-hours.before.json" ] && cp "$RD/hail-hours.json" "$S/hail-hours.before.json"   # a retry keeps the first try's backup
cp "$S/hail-hours.json" "$RD/hail-hours.json" && cp "$S/hail-hours.json" "$DIST/hail-hours.json" || stop "copying into app/data/rounds or Roofing's build folder failed"
RX='^hail-hours\.json$'
DRY=1 bash ./push-edition.sh traverse-data "$RX" > "$S/push-dry.txt" || stop "push dry run failed"
head -2 "$S/push-dry.txt"
n=$(grep -cE '^[a-z0-9-]+\.json$' "$S/push-dry.txt")
[ "$n" -le 1 ] || stop "push would send $n files, more than hail-hours.json"
bash ./push-edition.sh traverse-data "$RX" | tee "$S/push.txt"
grep -qE "MD5 MATCH|: 0 files to send" "$S/push.txt" && grep -q "json ok" "$S/push.txt" || stop "push to traverse-data did not match (MD5)"

## 5. the server's copy
LIVESUM=$($SG "cd $LIVE && md5sum hail-hours.json | cut -c1-32" < /dev/null)
[ "$LIVESUM" = "$(md5sum < "$S/hail-hours.json" | cut -c1-32)" ] || stop   # stdin: a backslash path makes md5sum prefix "\" (5 Nov) "the server's hail-hours.json is not the one built"
step "done: hail-hours.json live on Roofing (md5 ${LIVESUM:0:12}); old local copy $S/hail-hours.before.json; note in TASKS.md"

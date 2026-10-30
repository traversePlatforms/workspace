#!/bin/bash
# Storm history (radar hail, ground reports, wind) for the Group 3 towns, after stage B is live (2026-10-29; Matthew: "Go ahead and run
# the storm history ... when group 3 is done"). Stage g3hail of traverse/ops/run-cloud-finishers.sh: starts only once g3b is done
# (finish-g3b-2026-10-29.sh uploaded the doors), never beside another stage (the finishers' lock), never over the phone hotspot.
# The method is BACKFILL-HAIL-2026-10-29.md "Re-running", unchanged:   bash finish-g3hail-2026-10-29.sh > logs-finish-g3hail.log 2>&1
#   1. door points only (id, lat, lon) for every Roofing town, the g3- towns and the five merged towns among them
#      (hail/backfill-hail.mjs stage); the server's own "through" (hail-storms.json);
#   2. on the cloud machine, hail/hail-backfill-vm.sh in ~/run/hailfill: the statewide radar day files already there (only the days after
#      the last one fetched are downloaded), per-door hail through the server's date, ground reports, wind. Not gis.colorado.gov;
#   3. copies back only the g3- and merged towns' hail-, hailrep- and wind- files, the two storm lists and the map squares; the map
#      squares are cut to those near the new doors (backfill-hail.mjs paths);
#   4. on the server, hail/merge-storms.py under the storm job's own lock, --dry first, with its own backup: the new towns join
#      hail-storms.json's days, the map squares join hail-paths.json, and the merged towns' (and any g3- town the storm job has already
#      started) hail files get each door's missing days. hail-storms.json is never replaced;
#   5. push-edition.sh traverse-data with an exact filter: hail- only for g3- towns with no file on the server, hailrep- and wind- for the
#      g3- and merged towns, wind-storms.json and hail-reports.json (statewide lists, built from every town). MD5 MATCH required;
#   6. live check: a g3- door list on Roofing shows hail / wind / ground reports; then the server's merged hail files are copied back to
#      app/data/rounds (backups of the old local copies in the scratchpad).
# Any failure stops with a "STOP:" line and exit 1; the finisher loop tries a stage at most 3 times. Safe to re-run: a finished cloud
# build is reused (same door points, same date), the merge only adds what is missing, push-edition sends only changed files.
set -u
cd "$(dirname "$0")"
S0=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
S="$S0/g3hail"; RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LIVE='~/www/traverseplatforms.com/traverse-data/rounds'
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
# never move gigabytes over the phone (memory: SSID "iPhone" = no heavy downloads); the loop checks before starting, this while running
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }

## 0. Group 3 must be live first
[ -s group3/registered.json ] && [ -s group3/built-counts.json ] && [ -s "$DIST/index.json" ] || stop "Group 3 is not built yet (finish-g3b-2026-10-29.sh first)"
KEYS=$(node -e "for(const r of require('$DIST/index.json').regions)if(/^g3-/.test(r.key))console.log(r.key)")
MERGE=$(node -e "const k=new Set(require('$DIST/index.json').regions.map(r=>r.key));for(const t of require('fs').readFileSync('group3/b/merge-towns.txt','utf8').split(/\s+/))if(t&&k.has(t))console.log(t)" 2>/dev/null)
[ -n "$KEYS" ] || stop "no g3- towns in Roofing's index ($DIST/index.json)"
step "towns: $(echo $KEYS | wc -w) g3- towns; merged towns: $(echo $MERGE)"
LIVEKEYS=$($SG "cd $LIVE && python3 -c \"import json;print(' '.join(r['key'] for r in json.load(open('index.json'))['regions']))\"" < /dev/null)
MISSING=$(for k in $KEYS; do case " $LIVEKEYS " in *" $k "*) ;; *) echo $k;; esac; done)
[ -z "$MISSING" ] || stop "towns not yet in Roofing's live index: $(echo $MISSING | head -c 300)"

## 1. door points and the server's date
THROUGH=$($SG "cd $LIVE && python3 -c \"import json;print(json.load(open('hail-storms.json')).get('through',''))\"" < /dev/null)
echo "$THROUGH" | grep -qE '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' || stop "could not read the server's hail through date ('$THROUGH')"
rm -rf "$S/stage" && mkdir -p "$S" || stop "scratchpad"
node --max-old-space-size=8192 hail/backfill-hail.mjs stage "$S/stage" || stop "staging the door points failed"
SUM=$(cd "$S/stage" && cat $(ls *.json | sort) | md5sum | cut -c1-16); TAG="$SUM $THROUGH"
(cd "$S/stage" && tar czf "$S/stage.tgz" *.json) || stop "packing the door points failed"
step "server through $THROUGH; staged points $(( $(stat -c %s "$S/stage.tgz") / 1048576 )) MB (tag $SUM)"

## 2. the cloud build
wifi
state=$($VM "cd ~/run/hailfill || exit 1; if pgrep -f '[h]ail-backfill-vm.sh' > /dev/null; then echo running; elif [ -f g3hail.vmdone ] && [ \"\$(cat g3hail.vmdone)\" = '$TAG' ]; then echo done; else echo start; fi" < /dev/null) || stop "cloud machine not reachable"
step "cloud build: $state"
if [ "$state" = start ]; then
  $VM "test -f ~/run/hailfill/hail-backfill-vm.sh && test -d ~/run/hailfill/days && test -f ~/run/hailfill/hail/backfill-hail.mjs" < /dev/null || stop "~/run/hailfill is not set up on the cloud machine (BACKFILL-HAIL-2026-10-29.md)"
  # old outputs and door points go (result.tgz is rewritten by the run; days/ stays); fetch.done goes so the days after the last fetch are downloaded (only missing days are fetched)
  $VM "cd ~/run/hailfill && rm -rf stormstage out hailfill.vmdone g3hail.vmdone fetch.done && mkdir stormstage && tar xzf - -C stormstage && (THROUGH='$THROUGH' nohup bash -c 'bash ~/run/hailfill/hail-backfill-vm.sh > ~/run-hailfill.log 2>&1 && echo \"$TAG\" > ~/run/hailfill/g3hail.vmdone' < /dev/null > /dev/null 2>&1 &) && echo started" < "$S/stage.tgz" || stop "could not start the cloud build"
  state=running
fi
if [ "$state" = running ]; then
  fails=0
  for i in $(seq 1 75); do   # 75 x 2 min; the 29 Oct statewide run took 13 minutes with the download
    sleep 120
    # running is asked first: the job writes g3hail.vmdone as its last act, so "not running" then "no vmdone" means it ended without it
    r=$($VM "cd ~/run/hailfill; if pgrep -f '[h]ail-backfill-vm.sh' > /dev/null; then echo running; elif [ -f g3hail.vmdone ] && [ \"\$(cat g3hail.vmdone)\" = '$TAG' ]; then echo done; else echo \"ended: \$(cat ~/run-hailfill-status.txt)\"; fi" < /dev/null) || { fails=$((fails+1)); [ $fails -ge 10 ] && stop "cloud machine unreachable for 20 minutes"; continue; }
    fails=0
    case "$r" in done) state=done; break;; running) ;; *) stop "cloud build $r (log ~/run-hailfill.log on the cloud machine)";; esac
  done
  [ "$state" = done ] || stop "cloud build still running after 150 minutes"
fi
[ "$state" = done ] || stop "cloud build state '$state'"
step "cloud build done: $($VM 'cat ~/run-hailfill-status.txt' < /dev/null)"

## 3. copy back the new towns' files only
wifi
LIST="hail-storms-backfill.json hail-paths-backfill.json wind-storms.json hail-reports.json coverage.tsv $(for k in $KEYS $MERGE; do echo hail-$k.json hailrep-$k.json wind-$k.json; done)"
rm -rf "$S/back" "$S/merge" && mkdir -p "$S/back" "$S/merge" || stop "scratchpad"
printf '%s\n' $LIST | $VM "cd ~/run/hailfill/out && tar czf - -T -" > "$S/back.tgz" || stop "copy back failed (a town file missing from the cloud build?)"
tar xzf "$S/back.tgz" -C "$S/back" || stop "copy back unreadable"
node -e "
const fs=require('fs'),p=require('path');const d=process.argv[1];let n=0;
for(const f of fs.readdirSync(d))if(f.endsWith('.json')){JSON.parse(fs.readFileSync(p.join(d,f),'utf8'));n++}
const b=JSON.parse(fs.readFileSync(p.join(d,'hail-storms-backfill.json'),'utf8'));if(b.through>process.argv[2]){console.error('backfill through',b.through,'is after the server',process.argv[2]);process.exit(1)}
const keys=process.argv.slice(3);const cov=Object.fromEntries(fs.readFileSync(p.join(d,'coverage.tsv'),'utf8').trim().split('\n').slice(1).map(l=>l.split('\t')).map(([k,a,b])=>[k,[+a,+b]]));
let doors=0,hit=0;for(const k of keys){if(!cov[k]){console.error('no coverage line for',k);process.exit(1)}doors+=cov[k][0];hit+=cov[k][1]}
console.log(n+' files read; backfill through '+b.through+', '+b.storms.length+' storm days; new and merged towns: '+doors+' doors, '+hit+' with a storm of 0.75 in+ on a kept day')" "$S/back" "$THROUGH" $KEYS $MERGE || stop "the copied-back files did not check out"
node hail/backfill-hail.mjs paths "$S/back/hail-paths-backfill.json" "$S/stage" "$S/merge/hail-paths-add.json" $KEYS $MERGE || stop "cutting the map squares failed"
cp hail/merge-storms.py "$S/back/hail-storms-backfill.json" "$S/merge/" && for k in $KEYS $MERGE; do cp "$S/back/hail-$k.json" "$S/merge/"; done || stop "packing the merge failed"

## 4. merge on the server, under the storm job's lock (merge-storms.py takes it and backs up first)
(cd "$S/merge" && tar czf - .) | $SG "rm -rf /tmp/g3hail && mkdir -p /tmp/g3hail && tar xzf - -C /tmp/g3hail && cd /tmp/g3hail && python3 merge-storms.py $LIVE /tmp/g3hail --dry" > "$S/merge-dry.txt" || { cat "$S/merge-dry.txt"; stop "merge-storms.py --dry failed"; }
grep -vE '^  hail-' "$S/merge-dry.txt"; step "towns joined on the server: $(grep -cE '^  hail-' "$S/merge-dry.txt")"
grep -q "dry run: nothing written" "$S/merge-dry.txt" || stop "merge dry run did not finish"
$SG "cd /tmp/g3hail && python3 merge-storms.py $LIVE /tmp/g3hail" < /dev/null > "$S/merge.txt" || { cat "$S/merge.txt"; stop "merge-storms.py failed (server files untouched unless it printed 'backed up')"; }
grep -E "backed up|merged|through" "$S/merge.txt"
grep -q "merged; json ok" "$S/merge.txt" || stop "merge did not finish cleanly (see the backup it printed)"

## 5. push to Roofing: hail only where the server has no file; hailrep and wind for the new and merged towns; the two statewide lists
HAVE=$($SG "cd $LIVE && ls hail-*.json" < /dev/null) || stop "could not list the server's hail files"
NEWH=$(for k in $KEYS; do echo "$HAVE" | grep -qx "hail-$k.json" || echo $k; done)
mkdir -p "$S/local-before" && for f in wind-storms.json hail-reports.json $(for k in $KEYS $MERGE; do echo hail-$k.json hailrep-$k.json wind-$k.json; done); do [ -f "$RD/$f" ] && [ ! -f "$S/local-before/$f" ] && cp "$RD/$f" "$S/local-before/$f"; done   # a retry keeps the first try's backups
for f in wind-storms.json hail-reports.json $(for k in $KEYS $MERGE; do echo hailrep-$k.json wind-$k.json; done) $(for k in $NEWH; do echo hail-$k.json; done); do cp "$S/back/$f" "$RD/$f" || stop "copy $f into app/data/rounds"; done
# into Roofing's built folder as build-editions.cjs writes it: wind-<town> packed (each door's entry as JSON text), the rest as they are
node -e "
const fs=require('fs'),p=require('path');const [src,dst,...files]=process.argv.slice(1);const towns=new Set(require(p.resolve(dst,'index.json')).regions.map(r=>r.key));
for(const f of files){let buf=fs.readFileSync(p.join(src,f));const m=f.match(/^wind-(.+)\.json$/);
 if(m&&towns.has(m[1])){const j=JSON.parse(buf.toString('utf8'));if(j&&j.doors&&typeof j.doors==='object'&&!Array.isArray(j.doors)&&!j.packed){for(const id of Object.keys(j.doors))j.doors[id]=JSON.stringify(j.doors[id]);j.packed=1;buf=Buffer.from(JSON.stringify(j))}}
 fs.writeFileSync(p.join(dst,f),buf)}
console.log('Roofing build folder: '+files.length+' files')" "$S/back" "$DIST" wind-storms.json hail-reports.json $(for k in $KEYS $MERGE; do echo hailrep-$k.json wind-$k.json; done) $(for k in $NEWH; do echo hail-$k.json; done) || stop "writing Roofing's build folder failed"
alt() { echo "$*" | tr ' ' '\n' | grep -v '^$' | paste -sd'|'; }
RX="^(hail-($(alt $NEWH))|(hailrep|wind)-($(alt $KEYS $MERGE))|wind-storms|hail-reports)\.json\$"
[ -n "$NEWH" ] || RX="^((hailrep|wind)-($(alt $KEYS $MERGE))|wind-storms|hail-reports)\.json\$"
want=$(( $(echo $NEWH | wc -w) + 2 * $(echo $KEYS $MERGE | wc -w) + 2 ))
DRY=1 bash ./push-edition.sh traverse-data "$RX" > "$S/push-dry.txt" || stop "push dry run failed"
n=$(grep -cE '^(hail|hailrep|wind)-' "$S/push-dry.txt"); head -2 "$S/push-dry.txt"
grep -E '^(hail|hailrep|wind)-' "$S/push-dry.txt" | grep -qE '^hail-(storms|paths)\.json$' && stop "the filter would send a server-owned storm list"
[ "$n" -le "$want" ] || stop "push would send $n files, more than the $want expected"
bash ./push-edition.sh traverse-data "$RX" | tee "$S/push.txt"
grep -qE "MD5 MATCH|: 0 files to send" "$S/push.txt" && grep -q "json ok" "$S/push.txt" || stop "push to traverse-data did not match (MD5)"

## 6. live check on Roofing, then the server's merged hail files back to the laptop
T=$(node -e "const fs=require('fs');const keys=new Set(process.argv.slice(2));let best=null;for(const l of fs.readFileSync(process.argv[1],'utf8').trim().split('\n').slice(1)){const [k,d,h]=l.split('\t');if(keys.has(k)&&+d>=50){const r=+h/+d;if(!best||r>best[1])best=[k,r]}}console.log(best?best[0]:'')" "$S/back/coverage.tsv" $KEYS)
[ -n "$T" ] || stop "no g3- town with 50+ doors to check"
OUT=$(awk -v t="$T" '$1~/^traverse/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | $SG "$(cat ./elc2.sh)")
echo "$OUT" | grep -E "^traverse " | cut -c1-400
echo "$OUT" | grep -qE " (hail|wind|hrep):[1-9]" || stop "live check: no hail, wind or ground report on the $T door list"
mkdir -p "$S/local-before" && for f in hail-storms.json hail-paths.json $(for k in $KEYS $MERGE; do echo hail-$k.json; done); do [ -f "$RD/$f" ] && [ ! -f "$S/local-before/$f" ] && cp "$RD/$f" "$S/local-before/$f"; done
$SG "cd $LIVE && tar czf - hail-storms.json hail-paths.json \$(for k in $(echo $KEYS $MERGE); do [ -f hail-\$k.json ] && echo hail-\$k.json; done)" < /dev/null > "$S/live-hail.tgz" && tar xzf "$S/live-hail.tgz" -C "$RD" || step "copying the server's hail files back failed (local copies only; the live side is done)"
$SG "rm -rf /tmp/g3hail" < /dev/null
step "done: storm history live for $(echo $KEYS | wc -w) g3- towns and $(echo $MERGE | wc -w) merged towns (through $THROUGH); old local copies in $S/local-before; note in BACKFILL-HAIL and TASKS.md TR-34"

#!/bin/bash
# Storm history for the every-home doors (18 Nov 2026): radar hail, ground reports and wind for the 91 new towns, and for the doors the
# every-home batch added to towns of ours (EVERY-HOME-2026-11-15.md, "still to do by hand"; finish-every's last line: "storm history for the
# new towns = the g3hail method"). Uploads are under Matthew's standing permission for app data (backups + md5 kept).
#   bash every1115/finish-hailnew-2026-11-18.sh > logs-finish-hailnew.log 2>&1        (from door-territory)
# Roofing is the only edition that keeps hail-, hailrep- and wind- files. Solar's hail line (hailmax-<town>.json) is made from Roofing's
# hail files by build-editions.cjs, so it goes up with the roof-material finisher's build (every1115/finish-matnew-2026-11-18.sh).
# The method is finish-g3hail-2026-10-29.sh's (BACKFILL-HAIL-2026-10-29.md "Re-running"), with these changes:
#   - the cloud run is fill1031 stage hailnew (overnight/fill1031/hailnew.sh): this script uploads the door points and the stage, appends
#     it to ~/run/fill1031/stages.txt (the queue looks every 10 minutes) and waits for ~/run/fill1031/hailnew.vmdone with today's tag;
#   - "merged towns" = every town of ours whose door file gained doors since the every-home snapshot (push-tmp/every1115/ids-before.json);
#     their cloud hail files are cut to the added doors before they go to the server (the old doors' history is the server's own);
#   - merge-storms.py joins one town at a time (18 Nov), so 300+ towns fit the server's memory;
#   - hailrep- and wind- for the merged towns are the cloud's whole-town rebuild: it STOPS if a town would have fewer doors with a ground
#     report or wind entry than the file it replaces (beyond 10 doors and 2%: reports past the two-year keep rule drop out).
# Steps: 1. towns and added doors; 2. door points + the server's date; 3. the cloud stage; 4. copy back + checks; 5. merge on the server
# (--dry first, its own backup); 6. push to Roofing (exact filter, MD5 MATCH); 7. live check; 8. the server's merged hail files back here.
# Any failure stops with "STOP:" and exit 1. Safe to re-run: a finished cloud run with the same tag is reused, the merge only adds what is
# missing, push-edition.sh sends only changed files.
set -u
exec < /dev/null   # md5sum fails on a closed stdin (finish-every 17 Nov, push-edition 11 Nov)
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/hailnew"; mkdir -p "$S"; SN=$(cygpath -m "$S")
EB="$(cygpath -m "$LOCALAPPDATA")/ProjectBackup/push-tmp/every1115/ids-before.json"
RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LIVE='~/www/traverseplatforms.com/traverse-data/rounds'
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting"; sleep 120; done; }
onac() { local i=0; while [ "$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r ')" != "2" ]; do i=$((i+1)); [ $i -gt 72 ] && stop "not on AC power for 6 hours"; step "on battery: waiting for AC"; sleep 300; done; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|finish-yardgap|finish-every|rebuild-upload-all|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold|finish-matnew' }).Count" 2>/dev/null | tr -d '\r'; }
offhot; onac
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 72 ] && stop "another upload or build has run for 6 hours"; step "another upload/build is running: waiting"; sleep 300; done

## 1. the towns: new (every1115/b/registered.json) and merged (gained doors since the snapshot), both in Roofing's built index
[ -s "$DIST/index.json" ] && [ -s every1115/b/registered.json ] && [ -s "$EB" ] || stop "Roofing's build, registered.json or the every-home snapshot is missing"
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD';const idx=new Set(JSON.parse(fs.readFileSync('$DIST/index.json')).regions.map(r=>r.key));
const reg=JSON.parse(fs.readFileSync('every1115/b/registered.json')).map(t=>t.key);const before=JSON.parse(fs.readFileSync('$EB'));
const keys=reg.filter(k=>idx.has(k)), miss=reg.filter(k=>!idx.has(k));if(miss.length){console.error('new towns not in Roofing index:',miss.join(' '));process.exit(1)}
const nw={};let n=0;for(const [k,ids] of Object.entries(before)){if(!idx.has(k)||keys.includes(k))continue;const b=new Set(ids);const now=JSON.parse(fs.readFileSync(R+'/'+k+'.json')).areas.flatMap(a=>a.doors.map(d=>d.id));const add=now.filter(i=>!b.has(i));if(add.length){nw[k]=add;n+=add.length}}
fs.writeFileSync('$SN/keys.txt',keys.join('\n')+'\n');fs.writeFileSync('$SN/merge.txt',Object.keys(nw).join('\n')+'\n');fs.writeFileSync('$SN/newids.json',JSON.stringify(nw));
console.log('new towns',keys.length,'| towns of ours with added doors',Object.keys(nw).length,'| added doors',n)" || stop "could not list the towns"
KEYS=$(cat "$S/keys.txt"); MERGE=$(cat "$S/merge.txt")
LIVEKEYS=$($SG "cd $LIVE && python3 -c \"import json;print(' '.join(r['key'] for r in json.load(open('index.json'))['regions']))\"")
MISSING=$(for k in $KEYS; do case " $LIVEKEYS " in *" $k "*) ;; *) echo $k;; esac; done)
[ -z "$MISSING" ] || stop "towns not yet in Roofing's live index: $(echo $MISSING | head -c 300)"

## 2. door points (id, lat, lon only) for every Roofing town, and the server's own date
THROUGH=$($SG "cd $LIVE && python3 -c \"import json;print(json.load(open('hail-storms.json')).get('through',''))\"")
echo "$THROUGH" | grep -qE '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' || stop "could not read the server's hail through date ('$THROUGH')"
rm -rf "$S/stage" || stop "scratch"
nice -n 19 node --max-old-space-size=8192 hail/backfill-hail.mjs stage "$SN/stage" | tail -1 || stop "staging the door points failed"
SUM=$(cd "$S/stage" && cat $(ls *.json | LC_ALL=C sort) | md5sum | cut -c1-16); TAG="$SUM $THROUGH"
(cd "$S/stage" && tar czf "$S/stage.tgz" *.json) || stop "packing the door points failed"
step "server through $THROUGH; staged points $(( $(stat -c %s "$S/stage.tgz") / 1048576 )) MB (tag $SUM)"

## 3. the cloud stage
offhot
Q='~/run/fill1031'; H='~/run/hailfill'
# 18 Nov: a cloud run counts when its door points match (the tag's first word); the server's date may have moved on since it was staged
# (the backfill's own "through" is checked against the server's in step 4). hailwind (wind again with a bigger heap) finishes a hailnew
# run whose wind step ran out of memory, so a queued hailwind means waiting.
PEND="{ grep -q '^hailnew' $Q/stages.txt && [ ! -f $Q/hailnew.vmdone ] && [ ! -f $Q/hailnew.failed ]; } || { grep -q '^hailwind' $Q/stages.txt && [ -f $Q/hailwind.sh ] && [ ! -f $Q/hailwind.vmdone ] && [ ! -f $Q/hailwind.failed ]; }"
DONE="[ -f $Q/hailnew.vmdone ] && [ \"\$(cut -d' ' -f1 $H/hailnew.tag 2>/dev/null)\" = '$SUM' ]"
state=$($VM "cd $H || exit 1; if $DONE; then echo done; elif $PEND; then echo queued; else echo start; fi") || stop "cloud machine not reachable"
step "cloud stage: $state"
if [ "$state" = queued ] && [ "$($VM "cut -d' ' -f1 $H/hailnew-in/tag.txt 2>/dev/null")" != "$SUM" ]; then stop "hailnew is queued or running on the cloud machine with other door points: let it end (or move it aside) first"; fi
if [ "$state" = start ]; then
  $VM "test -f $H/hail-backfill-vm.sh && test -d $H/days && test -f $H/hail/backfill-hail.mjs" || stop "~/run/hailfill is not set up on the cloud machine (BACKFILL-HAIL-2026-10-29.md)"
  $VM "mkdir -p $H/hailnew-in && cat > $H/hailnew-in/stage.tgz" < "$S/stage.tgz" || stop "could not send the door points"
  $VM "cat > $Q/hailnew.sh.new && mv $Q/hailnew.sh.new $Q/hailnew.sh" < overnight/fill1031/hailnew.sh || stop "could not send the stage script"
  $VM "cd $H/hailnew-in && echo '$THROUGH' > through.txt && echo '$TAG' > tag.txt && cd $Q && rm -f hailnew.vmdone && { [ ! -f hailnew.failed ] || mv hailnew.failed vm-backup/hailnew.failed.\$(date +%s); } && { grep -q '^hailnew' stages.txt || echo 'hailnew    # 18 Nov: storm history (hail, ground reports, wind) for the every-home doors (91 new towns + doors added to ours); laptop finisher every1115/finish-hailnew-2026-11-18.sh' >> stages.txt; } && echo queued" || stop "could not queue the stage"
  state=queued
fi
if [ "$state" = queued ]; then
  fails=0
  for i in $(seq 1 240); do   # 240 x 3 min: the queue looks every 10 minutes; hailwind may wait for the stage before it (matnew)
    sleep 180
    r=$($VM "cd $Q; if $DONE; then echo done; elif $PEND; then echo waiting; else echo \"failed: \$(tail -3 hailnew.log hailwind.log 2>/dev/null | tr '\n' ' ')\"; fi") || { fails=$((fails+1)); [ $fails -ge 10 ] && stop "cloud machine unreachable for 30 minutes"; continue; }
    fails=0
    case "$r" in done) state=done; break;; waiting) ;; *) stop "cloud stage $r";; esac
  done
fi
[ "$state" = done ] || stop "cloud stage not done after 12 hours ($state)"
step "cloud stage done: $($VM 'cat ~/run-hailfill-status.txt')"

## 4. copy back the new and merged towns' files, and check them
offhot
LIST="hail-storms-backfill.json hail-paths-backfill.json wind-storms.json hail-reports.json coverage.tsv $(for k in $KEYS $MERGE; do echo hail-$k.json hailrep-$k.json wind-$k.json; done)"
rm -rf "$S/back" "$S/merge" && mkdir -p "$S/back" "$S/merge" || stop "scratch"
printf '%s\n' $LIST | $VM "cd $H/out && tar czf - -T -" > "$S/back.tgz" || stop "copy back failed (a town file missing from the cloud build?)"
tar xzf "$S/back.tgz" -C "$S/back" || stop "copy back unreadable"
step "copied back $(( $(stat -c %s "$S/back.tgz") / 1048576 )) MB"
nice -n 19 node --max-old-space-size=8192 -e "
const fs=require('fs'),p=require('path');const d='$SN/back',R='$RD';let n=0;
for(const f of fs.readdirSync(d))if(f.endsWith('.json')){JSON.parse(fs.readFileSync(p.join(d,f),'utf8'));n++}
const b=JSON.parse(fs.readFileSync(p.join(d,'hail-storms-backfill.json'),'utf8'));if(b.through>'$THROUGH'){console.error('backfill through',b.through,'is after the server $THROUGH');process.exit(1)}
const keys=fs.readFileSync('$SN/keys.txt','utf8').split(/\s+/).filter(Boolean),merge=fs.readFileSync('$SN/merge.txt','utf8').split(/\s+/).filter(Boolean);
const cov=Object.fromEntries(fs.readFileSync(p.join(d,'coverage.tsv'),'utf8').trim().split('\n').slice(1).map(l=>l.split('\t')).map(([k,a,c])=>[k,[+a,+c]]));
let doors=0,hit=0;for(const k of keys){if(!cov[k]){console.error('no coverage line for',k);process.exit(1)}doors+=cov[k][0];hit+=cov[k][1]}
const nw=JSON.parse(fs.readFileSync('$SN/newids.json'));let nd=0,nh=0,nwd=0,nrd=0;const fewer=[],fewOk=[];   /* fewOk: up to 10 doors or 2% (reports past the keep rule drop out) */
for(const k of merge){const H=JSON.parse(fs.readFileSync(p.join(d,'hail-'+k+'.json'))).doors||{};for(const i of nw[k]){nd++;if(H[i]&&H[i].length)nh++}
  for(const pre of ['wind','hailrep']){const nf=p.join(d,pre+'-'+k+'.json'),of=p.join(R,pre+'-'+k+'.json');const N=JSON.parse(fs.readFileSync(nf)).doors||{};const cnt=o=>Object.values(o).filter(v=>v&&(Array.isArray(v)?v.length:Object.keys(v).length)).length;
    const nn=cnt(N);if(fs.existsSync(of)){const O=JSON.parse(fs.readFileSync(of)).doors||{};let oo=0;for(const [i,v] of Object.entries(O)){if(typeof v==='string')v=JSON.parse(v);if(v&&(Array.isArray(v)?v.length:Object.keys(v).length))oo++}if(nn<oo){const t=pre+'-'+k+' '+oo+'->'+nn;(oo-nn>10&&oo-nn>oo*0.02?fewer:fewOk).push(t)}}
    for(const i of nw[k])if(N[i]&&(Array.isArray(N[i])?N[i].length:Object.keys(N[i]).length)){if(pre==='wind')nwd++;else nrd++}}}
console.log(n+' files read; backfill through '+b.through+', '+b.storms.length+' storm days');
console.log('new towns: '+doors+' doors, '+hit+' with a hail storm of 0.75 in+ on a kept day');
console.log('added doors in towns of ours: '+nd+'; with radar hail '+nh+', with wind '+nwd+', with ground reports '+nrd);
if(fewOk.length)console.log('slightly fewer doors with entries (within tolerance): '+fewOk.length+' files, e.g. '+fewOk.slice(0,8).join('; '));
if(fewer.length){console.error('FEWER doors with entries than the files they replace: '+fewer.slice(0,20).join('; '));process.exit(1)}" || stop "the copied-back files did not check out"
# the method check of 29 Oct: where the cloud's and our hail files share a door and a day, the values must agree
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD',d='$SN/back';let same=0,diff=0;const ts=fs.readFileSync('$SN/merge.txt','utf8').split(/\s+/).filter(Boolean).slice(0,40);
for(const k of ts){const of=R+'/hail-'+k+'.json';if(!fs.existsSync(of))continue;const O=JSON.parse(fs.readFileSync(of)).doors||{},N=JSON.parse(fs.readFileSync(d+'/hail-'+k+'.json')).doors||{};
 for(const [i,rows] of Object.entries(O)){const m=new Map((N[i]||[]).map(e=>[e[0],JSON.stringify(e)]));for(const e of rows){if(!m.has(e[0]))continue;m.get(e[0])===JSON.stringify(e)?same++:diff++}}}
console.log('method check on '+ts.length+' merged towns: '+same+' door-days identical, '+diff+' differ');if(diff>same*0.01){process.exit(1)}" || stop "cloud hail differs from ours on shared door-days"
nice -n 19 node --max-old-space-size=8192 hail/backfill-hail.mjs paths "$SN/back/hail-paths-backfill.json" "$SN/stage" "$SN/merge/hail-paths-add.json" $KEYS $MERGE || stop "cutting the map squares failed"
cp hail/merge-storms.py "$S/back/hail-storms-backfill.json" "$S/merge/" && for k in $KEYS; do cp "$S/back/hail-$k.json" "$S/merge/"; done || stop "packing the merge failed"
# merged towns: only the added doors' storms go to the server
node --max-old-space-size=8192 -e "
const fs=require('fs');const nw=JSON.parse(fs.readFileSync('$SN/newids.json'));let n=0,e=0;
for(const [k,ids] of Object.entries(nw)){const j=JSON.parse(fs.readFileSync('$SN/back/hail-'+k+'.json'));const D={};for(const i of ids)if(j.doors&&j.doors[i]&&j.doors[i].length){D[i]=j.doors[i];n++;e+=D[i].length}j.doors=D;fs.writeFileSync('$SN/merge/hail-'+k+'.json',JSON.stringify(j))}
console.log('merge pack: added doors with storms '+n+', storm entries '+e)" || stop "cutting the merged towns' hail files failed"

## 5. merge on the server, under the storm job's lock (merge-storms.py takes it and backs up first)
(cd "$S/merge" && tar czf - .) | $SG "rm -rf /tmp/hailnew && mkdir -p /tmp/hailnew && tar xzf - -C /tmp/hailnew && cd /tmp/hailnew && python3 merge-storms.py $LIVE /tmp/hailnew --dry" > "$S/merge-dry.txt" || { cat "$S/merge-dry.txt"; stop "merge-storms.py --dry failed"; }
grep -vE '^  hail-' "$S/merge-dry.txt"; step "towns joined on the server: $(grep -cE '^  hail-' "$S/merge-dry.txt")"
grep -q "dry run: nothing written" "$S/merge-dry.txt" || stop "merge dry run did not finish"
$SG "cd /tmp/hailnew && python3 merge-storms.py $LIVE /tmp/hailnew" > "$S/merge-out.txt" || { cat "$S/merge-out.txt"; stop "merge-storms.py failed (server files untouched unless it printed 'backed up')"; }
grep -E "backed up|merged|through" "$S/merge-out.txt"
grep -q "merged; json ok" "$S/merge-out.txt" || stop "merge did not finish cleanly (see the backup it printed)"

## 6. push to Roofing: hail only where the server has no file; hailrep and wind for the new and merged towns; the two statewide lists
HAVE=$($SG "cd $LIVE && ls hail-*.json") || stop "could not list the server's hail files"
NEWH=$(for k in $KEYS; do echo "$HAVE" | grep -qx "hail-$k.json" || echo $k; done)
mkdir -p "$S/local-before" && for f in wind-storms.json hail-reports.json $(for k in $KEYS $MERGE; do echo hail-$k.json hailrep-$k.json wind-$k.json; done); do [ -f "$RD/$f" ] && [ ! -f "$S/local-before/$f" ] && cp "$RD/$f" "$S/local-before/$f"; done   # a retry keeps the first try's backups
FILES="wind-storms.json hail-reports.json $(for k in $KEYS $MERGE; do echo hailrep-$k.json wind-$k.json; done) $(for k in $NEWH; do echo hail-$k.json; done)"
for f in $FILES; do cp "$S/back/$f" "$RD/$f" || stop "copy $f into app/data/rounds"; done
# into Roofing's built folder as build-editions.cjs writes it: wind-<town> packed (each door's entry as JSON text), the rest as they are
printf '%s\n' $FILES > "$S/files.txt"
nice -n 19 node --max-old-space-size=8192 -e "
const fs=require('fs'),p=require('path');const src='$SN/back',dst='$DIST';const files=fs.readFileSync('$SN/files.txt','utf8').split(/\s+/).filter(Boolean);const towns=new Set(JSON.parse(fs.readFileSync(p.join(dst,'index.json'))).regions.map(r=>r.key));
for(const f of files){let buf=fs.readFileSync(p.join(src,f));const m=f.match(/^wind-(.+)\.json$/);
 if(m&&towns.has(m[1])){const j=JSON.parse(buf.toString('utf8'));if(j&&j.doors&&typeof j.doors==='object'&&!Array.isArray(j.doors)&&!j.packed){for(const id of Object.keys(j.doors))j.doors[id]=JSON.stringify(j.doors[id]);j.packed=1;buf=Buffer.from(JSON.stringify(j))}}
 fs.writeFileSync(p.join(dst,f),buf)}
console.log('Roofing build folder: '+files.length+' files')" || stop "writing Roofing's build folder failed"
alt() { echo "$*" | tr ' ' '\n' | grep -v '^$' | paste -sd'|'; }
RX="^(hail-($(alt $NEWH))|(hailrep|wind)-($(alt $KEYS $MERGE))|wind-storms|hail-reports)\.json\$"
[ -n "$NEWH" ] || RX="^((hailrep|wind)-($(alt $KEYS $MERGE))|wind-storms|hail-reports)\.json\$"
want=$(( $(echo $NEWH | wc -w) + 2 * $(echo $KEYS $MERGE | wc -w) + 2 ))
offhot
DRY=1 bash ./push-edition.sh traverse-data "$RX" > "$S/push-dry.txt" || stop "push dry run failed"
n=$(grep -cE '^(hail|hailrep|wind)-' "$S/push-dry.txt"); grep -E '^traverse-data: [0-9]+ files to send' "$S/push-dry.txt"
grep -E '^(hail|hailrep|wind)-' "$S/push-dry.txt" | grep -qE '^hail-(storms|paths)\.json$' && stop "the filter would send a server-owned storm list"
grep -E '^hail-' "$S/push-dry.txt" | grep -vE '^hail-reports\.json$' | sed 's/^hail-//; s/\.json$//' | while read -r k; do echo "$HAVE" | grep -qx "hail-$k.json" && echo "$k"; done > "$S/push-overwrite.txt"
[ -s "$S/push-overwrite.txt" ] && stop "the filter would replace a server-owned hail file: $(head -5 "$S/push-overwrite.txt" | tr '\n' ' ')"
[ "$n" -le "$want" ] || stop "push would send $n files, more than the $want expected"
bash ./push-edition.sh traverse-data "$RX" | grep -vE '^traverse-data: [0-9]+ changed' | tee "$S/push.txt"
grep -qE "MD5 MATCH|: 0 files to send" "$S/push.txt" && grep -q "json ok" "$S/push.txt" || stop "push to traverse-data did not match (MD5)"

## 7. live check on Roofing: a new town's door list shows hail / wind / ground reports
T=$(node -e "const fs=require('fs');const keys=new Set(fs.readFileSync('$SN/keys.txt','utf8').split(/\s+/).filter(Boolean));let best=null;for(const l of fs.readFileSync('$SN/back/coverage.tsv','utf8').trim().split('\n').slice(1)){const [k,d,h]=l.split('\t');if(keys.has(k)&&+d>=50){const r=+h/+d;if(!best||r>best[1])best=[k,r]}}console.log(best?best[0]:'')")
[ -n "$T" ] || stop "no new town with 50+ doors to check"
# 18 Nov: right after the push the server rebuilds its towns answer and the first ask can come back empty: up to 3 tries a minute apart
for try in 1 2 3; do
  OUT=$(awk -v t="$T" '$1~/^traverse$/{print $1,$2,t}' "$USERPROFILE/.ssh/claude-check-codes.txt" | $SG "$(cat ./elc2.sh)" 2>&1)
  echo "$OUT" | grep -qE " (hail|wind|hrep):[1-9]" && break; sleep 60
done
echo "$OUT" | grep -E "^traverse " | cut -c1-400
echo "$OUT" | grep -qE " (hail|wind|hrep):[1-9]" || stop "live check: no hail, wind or ground report on the $T door list"

## 8. the server's merged hail files (and storm lists) back to the laptop, old local copies kept
mkdir -p "$S/local-before" && for f in hail-storms.json hail-paths.json $(for k in $KEYS $MERGE; do echo hail-$k.json; done); do [ -f "$RD/$f" ] && [ ! -f "$S/local-before/$f" ] && cp "$RD/$f" "$S/local-before/$f"; done
$SG "cd $LIVE && tar czf - hail-storms.json hail-paths.json \$(for k in $(echo $KEYS $MERGE); do [ -f hail-\$k.json ] && echo hail-\$k.json; done)" > "$S/live-hail.tgz" && tar xzf "$S/live-hail.tgz" -C "$RD" || step "copying the server's hail files back failed (local copies only; the live side is done)"
$SG "rm -rf /tmp/hailnew"
step "done: storm history live on Roofing for $(echo $KEYS | wc -w) new towns and the added doors of $(echo $MERGE | wc -w) towns (through $THROUGH); old local copies in $S/local-before. Solar's hail line goes up with finish-matnew-2026-11-18.sh"

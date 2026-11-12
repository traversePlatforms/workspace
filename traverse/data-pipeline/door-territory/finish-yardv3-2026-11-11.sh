#!/bin/bash
# Laptop finisher for VM stage yardv3 (fill1031; Matthew 11 Nov 2026 "go ahead and run ... 3": better lawn sizes; CLOUD-JOBS-2026-11-11.md).
# The VM measured every yard v2 door again with the retuned settings (lawn-trial/yard-scan-v2.mjs V2 of 11 Nov) into ~/run/lawn-trial/yard-v3/.
#   1. copies back ~/run/fill1031/yardv3-result.tgz; the laptop's yard-v2/*.json and yard-v2-lawn.json are saved first (ProjectBackup);
#   2. checks every town (no door lost, no fewer lots, measured count not down by more than 1%) and the whole run (median new/old lawn
#      between 0.95 and 1.6: the hand-lot check expects about 1.1-1.25); a town that fails keeps its old file; more than 5 failing stops;
#   3. merges: new readings over old per door (a door only in the old file keeps its old reading: 7 keys whose laptop file had a few
#      more doors than the VM's list, about 2,000 doors);
#   4. build-yard-v2, build-rounds-data (door counts per town unchanged, lawn sizes not fewer), the editions (every edition's door
#      files present);
#   5. every town's door file to Sixfold (upload-towns-sixfold.sh, 8 at a time, each batch confirmed) and the five editions (door files
#      only, never hail-*; MD5 MATCH required), then a live md5 read-back of three towns on Sixfold and Yards.
# Runs from traverse/ops/run-cloud-finishers.sh (stage yardv3) once ~/run/fill1031/yardv3.vmdone exists, or by hand:
#   bash finish-yardv3-2026-11-11.sh > logs-finish-yardv3.log 2>&1 < /dev/null
set -u
exec < /dev/null   # md5sum (push-edition.sh) fails with a closed stdin, and a closed stdin is what a scheduled job gets (11 Nov)
cd "$(dirname "$0")" || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/yardv3"; mkdir -p "$S"   # short path ("Matthew sharpe" has a space)
BK="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/yardv3-before"; mkdir -p "$BK"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SCPV="scp -q -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; RD=../../app/data/rounds; ED=../../editions/dist
EDS="traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting to upload"; sleep 120; done; }
up6() { local label=$1 i; for i in 1 2 3; do offhot; bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$label.done" ] && return 0; step "batch $label not confirmed (try $i)"; sleep $((i * 120)); done; return 1; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold' }).Count" 2>/dev/null | tr -d '\r'; }

case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not copying back"; exit 1;; esac
$VM 'test -f ~/run/fill1031/yardv3.vmdone && test -s ~/run/fill1031/yardv3-result.tgz' || stop "yardv3 is not finished: $($VM 'cat ~/run-status.txt')"
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 36 ] && stop "another upload or build has run for 3 hours"; step "another upload/build is running: waiting"; sleep 300; done

step "copy back"
# review 12 Nov: a copy kept from an earlier try is used only when it is the cloud machine's file of now (md5): a copy cut short, or one
# from before the stage was run again, was taken as good because it was not empty. Copied to .part first, renamed when whole.
VMSUM=$($VM 'md5sum < ~/run/fill1031/yardv3-result.tgz | cut -c1-32'); [ ${#VMSUM} -eq 32 ] || stop "could not read the result's checksum on the cloud machine"
have() { [ -s "$S/result.tgz" ] && [ "$(md5sum < "$S/result.tgz" | cut -c1-32)" = "$VMSUM" ]; }
have || { rm -f "$S/result.tgz" "$S/result.tgz.part"; retry $SCPV yard@20.91.198.101:run/fill1031/yardv3-result.tgz "$S/result.tgz.part" && mv "$S/result.tgz.part" "$S/result.tgz" && have; } || stop "copy back failed, or the copy is not the cloud machine's file"
rm -rf "$S/new" && mkdir -p "$S/new" && tar xzf "$S/result.tgz" -C "$S/new" || stop "unpack"
step "backup of yard v2 (kept from the first try)"
# review 12 Nov: written to .part, read back, then renamed: a backup cut short (disk, a restart) was kept as the backup by the next try
[ -s "$BK/yard-v2-before-v3.tgz" ] || { (cd lawn-trial && tar czf "$BK/yard-v2-before-v3.tgz.part" yard-v2/*.json yard-v2-lawn.json) && tar tzf "$BK/yard-v2-before-v3.tgz.part" > /dev/null && mv "$BK/yard-v2-before-v3.tgz.part" "$BK/yard-v2-before-v3.tgz"; } || stop "backup failed"
[ -s "$BK/door-counts-before.json" ] || node -e "
const fs=require('fs'),RD=process.argv[1];const o={};for(const r of JSON.parse(fs.readFileSync(RD+'/index.json')).regions){const f=RD+'/'+r.key+'.json';if(!fs.existsSync(f))continue;const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);o[r.key]=[d.length,d.filter(x=>x.lawn&&x.lawn.sq!=null).length]}fs.writeFileSync(process.argv[2],JSON.stringify(o))" "$RD" "$BK/door-counts-before.json" || stop "door counts"

step "check and merge"
node -e "
const fs=require('fs'),[N,O]=process.argv.slice(1);let bad=[],ok=0,r=[],nOld=0,nNew=0,kept=0;
const isM=v=>!!v&&typeof v.l==='number';
for(const f of fs.readdirSync(O).filter(f=>f.endsWith('.json'))){const k=f.slice(0,-5),nf=N+'/yard-v3/'+f;
 if(!fs.existsSync(nf)){bad.push(k+' (no new file)');continue}
 const o=JSON.parse(fs.readFileSync(O+'/'+f)),n=JSON.parse(fs.readFileSync(nf));const od=o.doors||{},nd=n.doors||{};
 /* review 12 Nov: the new file must say it was made with the 11 Nov settings (a file made by the old code would pass as 'no change') */
 const st=n.settings||{};if(!(st.ndvi===0.33&&st.speck===4&&st.roofBuf===1)){bad.push(k+' (not measured with the 11 Nov settings)');continue}
 const lots=m=>Object.values(m).filter(v=>v&&(v.lot||v.big||v.shared)).length, meas=m=>Object.values(m).filter(isM).length;
 const miss=Object.keys(od).filter(id=>!(id in nd)).length;
 const gone=Object.keys(od).filter(id=>isM(od[id])&&(id in nd)&&!isM(nd[id])).length;   /* had a reading, the new run found no lot line */
 const m=Object.assign({},od,nd);
 if(lots(m)<lots(od)||meas(m)<meas(od)*0.99){bad.push(k+' lots '+lots(od)+'->'+lots(m)+' measured '+meas(od)+'->'+meas(m)+' ('+gone+' doors with a reading have none in the new run)');continue}
 for(const [id,v] of Object.entries(nd)){const w=od[id];if(v&&w&&typeof v.l==='number'&&typeof w.l==='number'&&w.l>0)r.push(v.l/w.l)}
 nOld+=meas(od);nNew+=meas(m);kept+=Object.keys(od).filter(id=>!(id in nd)&&isM(od[id])).length;
 fs.writeFileSync(O+'/'+f+'.tmp',JSON.stringify({...n,doors:m,retuned:'2026-11-11',keptOld:miss}));ok++}
r.sort((a,b)=>a-b);const med=r.length?r[r.length>>1]:NaN,q=p=>r.length?r[Math.floor(r.length*p)].toFixed(3):'none';
console.log('towns ok '+ok+', failing '+bad.length+(bad.length?': '+bad.slice(0,10).join('; '):''));
console.log('measured '+nOld+' -> '+nNew+'; new/old lawn: median '+q(.5)+', 10% '+q(.1)+', 90% '+q(.9)+' ('+r.length+' doors); readings kept from the old files because the new run never reached the door: '+kept);
/* review 12 Nov: a stage that ended early leaves town files that are only part measured; they merged cleanly (old readings kept) and the
   run counted as finished. More than 2% of readings carried over from the old files stops it (the known gap is about 2,000 doors, 0.1%). */
if(bad.length>5||!(med>=0.95&&med<=1.6)||kept>nOld*0.02){for(const f of fs.readdirSync(O).filter(f=>f.endsWith('.tmp')))fs.unlinkSync(O+'/'+f);console.log('NOT MERGED');process.exit(1)}
for(const f of fs.readdirSync(O).filter(f=>f.endsWith('.json.tmp')))fs.renameSync(O+'/'+f,O+'/'+f.slice(0,-4));" "$S/new" lawn-trial/yard-v2 || stop "the check did not pass; yard-v2 untouched"

step "build"
# review 12 Nov: pipefail, so a build that crashes stops the run. Without it the exit code was head's or grep's: a failed build-yard-v2
# left the old yard-v2-lawn.json, every later check passed on the old figures, nothing changed live and the stage was marked done.
(cd lawn-trial && set -o pipefail && node --max-old-space-size=8192 build-yard-v2.mjs | sed -n 1p) || stop "build-yard-v2 failed"
[ lawn-trial/yard-v2-lawn.json -nt "$S/result.tgz" ] && [ lawn-trial/yard-v2-lawn.json -nt "$S/new" ] || stop "yard-v2-lawn.json was not written by this run"
(set -o pipefail; node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "rented doors|wrote|listed by two") || stop "build-rounds-data failed"
node -e "
const fs=require('fs'),RD=process.argv[1],B=JSON.parse(fs.readFileSync(process.argv[2]));let bad=0,l0=0,l1=0;
for(const [k,[n0,a]] of Object.entries(B)){const f=RD+'/'+k+'.json';if(!fs.existsSync(f)){console.log(k+': door file gone');bad++;continue}const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);const z=d.filter(x=>x.lawn&&x.lawn.sq!=null).length;l0+=a;l1+=z;if(d.length!==n0||z<a){console.log(k+': doors '+n0+' -> '+d.length+', with a lawn size '+a+' -> '+z);bad++}}
console.log('door files: with a lawn size '+l0+' -> '+l1+'; towns off: '+bad);process.exit(bad?1:0)" "$RD" "$BK/door-counts-before.json" || stop "a rebuilt door file did not check out (restore: tar xzf $BK/yard-v2-before-v3.tgz -C lawn-trial, then build-yard-v2 + build-rounds-data)"
for try in 1 2; do
  # review 12 Nov: the build's own exit code counts, and every edition's door file must be the size of the one just built (they are plain
  # copies): a build that failed part way left older door files in place, "present" passed, the push found nothing to send and said done.
  (cd ../../app && set -o pipefail && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror") &&
  node -e "const fs=require('fs');let bad=0;for(const d of process.argv.slice(1)){const f='$ED/'+d+'/rounds/';const r=JSON.parse(fs.readFileSync(f+'index.json')).regions;const m=r.filter(x=>!fs.existsSync(f+x.key+'.json')).length;const s=r.filter(x=>fs.existsSync(f+x.key+'.json')&&fs.existsSync('$RD/'+x.key+'.json')&&fs.statSync(f+x.key+'.json').size!==fs.statSync('$RD/'+x.key+'.json').size).length;if(m||s){console.log(d+': '+m+' door files missing, '+s+' not the size of the new build');bad++}}process.exit(bad?1:0)" $EDS && break
  [ $try = 2 ] && stop "the editions' build folders are incomplete after two builds"
done

step "upload to Sixfold (every town)"
set -- $(node -e "console.log(JSON.parse(require('fs').readFileSync('$RD/index.json')).regions.map(r=>r.key).join(' '))")
[ $# -gt 0 ] || stop "no town keys read from index.json"   # review 12 Nov: an empty list skipped the Sixfold upload without a word
while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; up6 "yardv3-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || stop "Sixfold upload failed at $batch"; done
KEYS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ED/traverse-data/rounds/index.json')).regions.map(r=>r.key).filter(k=>!/^com-/.test(k)).join('|'))")
for d in $EDS; do
  offhot; retry bash ./push-edition.sh "$d" "^($KEYS)\.json\$" > "$S/push-$d.txt" 2>&1; cat "$S/push-$d.txt" | grep -vE "left out" | tail -4
  grep -q "md5sum:" "$S/push-$d.txt" && stop "push $d: md5sum failed"
  grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
done
for t in monument highlands-ranch welby; do
  for p in "sixfold-data:$RD" "traverse-yards-data:$ED/traverse-yards-data/rounds"; do
    live=$($SG "md5sum < ~/www/traverseplatforms.com/${p%%:*}/rounds/$t.json | cut -c1-32"); [ "$live" = "$(md5sum < "${p#*:}/$t.json" | cut -c1-32)" ] || stop "live ${p%%:*} $t.json differs from the build"
    step "live: ${p%%:*} $t.json md5 ${live:0:12} OK"
  done
done
step "done: retuned lawn sizes live on Sixfold and the five editions; old yard v2 in $BK/yard-v2-before-v3.tgz"

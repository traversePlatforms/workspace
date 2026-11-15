#!/bin/bash
# Laptop finisher for VM stage yardgap (fill1031, 15 Nov 2026; every1115/EVERY-HOME-2026-11-15.md; main session 15 Nov: "So many of these
# lawns are still check before quoting"). The VM measured, with the 11 Nov settings, the doors that had no yard reading (no entry in
# lawn-trial/yard-v2/<town>.json, or a "no lot found" answer outside the eight address-point counties) into ~/run/lawn-trial/yard-gap/.
# finish-yardv3-2026-11-11.sh's own copy-back, backup, build, checks, uploads and live md5 read-back; only the merge differs:
#   a new reading is ADDED where the door has no entry or a null one; an existing reading is never replaced.
# Runs from the Wi-Fi queue job yardgap (traverse/ops/wifi-queue/jobs/yardgap.sh), or by hand:
#   bash every1115/finish-yardgap-2026-11-15.sh > logs-finish-yardgap.log 2>&1 < /dev/null      (from door-territory)
set -u
exec < /dev/null
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/yardgap"; mkdir -p "$S"   # short path ("Matthew sharpe" has a space)
BK="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/yardgap-before"; mkdir -p "$BK"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SCPV="scp -q -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; RD=../../app/data/rounds; ED=../../editions/dist
EDS="traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting to upload"; sleep 120; done; }
up6() { local label=$1 i; for i in 1 2 3; do offhot; bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$label.done" ] && return 0; step "batch $label not confirmed (try $i)"; sleep $((i * 120)); done; return 1; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|finish-every|rebuild-upload-all|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold' }).Count" 2>/dev/null | tr -d '\r'; }

case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not copying back"; exit 1;; esac
$VM 'test -f ~/run/fill1031/yardgap.vmdone && test -s ~/run/fill1031/yardgap-result.tgz' || stop "yardgap is not finished: $($VM 'cat ~/run-status.txt')"
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 36 ] && stop "another upload or build has run for 3 hours"; step "another upload/build is running: waiting"; sleep 300; done

step "copy back"
# review 12 Nov: a copy kept from an earlier try is used only when it is the cloud machine's file of now (md5): a copy cut short, or one
# from before the stage was run again, was taken as good because it was not empty. Copied to .part first, renamed when whole.
VMSUM=$($VM 'md5sum < ~/run/fill1031/yardgap-result.tgz | cut -c1-32'); [ ${#VMSUM} -eq 32 ] || stop "could not read the result's checksum on the cloud machine"
have() { [ -s "$S/result.tgz" ] && [ "$(md5sum < "$S/result.tgz" | cut -c1-32)" = "$VMSUM" ]; }
have || { rm -f "$S/result.tgz" "$S/result.tgz.part"; retry $SCPV yard@20.91.198.101:run/fill1031/yardgap-result.tgz "$S/result.tgz.part" && mv "$S/result.tgz.part" "$S/result.tgz" && have; } || stop "copy back failed, or the copy is not the cloud machine's file"
rm -rf "$S/new" && mkdir -p "$S/new" && tar xzf "$S/result.tgz" -C "$S/new" || stop "unpack"
step "backup of yard v2 (kept from the first try)"
# review 12 Nov: written to .part, read back, then renamed: a backup cut short (disk, a restart) was kept as the backup by the next try
[ -s "$BK/yard-v2-before-gap.tgz" ] || { (cd lawn-trial && tar czf "$BK/yard-v2-before-gap.tgz.part" yard-v2/*.json yard-v2-lawn.json) && tar tzf "$BK/yard-v2-before-gap.tgz.part" > /dev/null && mv "$BK/yard-v2-before-gap.tgz.part" "$BK/yard-v2-before-gap.tgz"; } || stop "backup failed"
[ -s "$BK/door-counts-before.json" ] || node -e "
const fs=require('fs'),RD=process.argv[1];const o={};for(const r of JSON.parse(fs.readFileSync(RD+'/index.json')).regions){const f=RD+'/'+r.key+'.json';if(!fs.existsSync(f))continue;const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);o[r.key]=[d.length,d.filter(x=>x.lawn&&x.lawn.sq!=null).length]}fs.writeFileSync(process.argv[2],JSON.stringify(o))" "$RD" "$BK/door-counts-before.json" || stop "door counts"

step "check and merge (add only)"
node -e "
const fs=require('fs'),[N,O]=process.argv.slice(1);let towns=0,added=0,nulls=0,still=0,bad=[];
const isM=v=>!!v&&typeof v.l==='number';
for(const f of fs.readdirSync(N+'/yard-gap').filter(f=>f.endsWith('.json'))){const k=f.slice(0,-5);
 const n=JSON.parse(fs.readFileSync(N+'/yard-gap/'+f));const st=n.settings||{};if(!(st.ndvi===0.33&&st.speck===4&&st.roofBuf===1)){bad.push(k+' (not the 11 Nov settings)');continue}
 const of=O+'/'+f,o=fs.existsSync(of)?JSON.parse(fs.readFileSync(of)):{built:n.built,settings:n.settings,doors:{}};const od=o.doors||(o.doors={});let a=0;
 for(const [id,v] of Object.entries(n.doors||{})){if(id in od&&od[id]!==null)continue;if(od[id]===null&&v===null){still++;continue}od[id]=v;a++;if(isM(v))added++;else nulls+=v===null?1:0}
 if(a){fs.writeFileSync(of+'.tmp',JSON.stringify({...o,gapAdded:'2026-11-15'}));towns++}}
console.log('towns with new readings '+towns+', doors given a lawn reading '+added+', still no lot '+still+', new no-lot answers '+nulls+(bad.length?'; refused: '+bad.join('; '):''));
if(bad.length>5||!added){for(const f of fs.readdirSync(O).filter(f=>f.endsWith('.json.tmp')))fs.unlinkSync(O+'/'+f);console.log('NOT MERGED');process.exit(1)}
for(const f of fs.readdirSync(O).filter(f=>f.endsWith('.json.tmp')))fs.renameSync(O+'/'+f,O+'/'+f.slice(0,-4));" "$S/new" lawn-trial/yard-v2 || stop "the check did not pass; yard-v2 untouched"

step "build"
# review 12 Nov: pipefail, so a build that crashes stops the run. Without it the exit code was head's or grep's: a failed build-yard-v2
# left the old yard-v2-lawn.json, every later check passed on the old figures, nothing changed live and the stage was marked done.
(cd lawn-trial && set -o pipefail && node --max-old-space-size=8192 build-yard-v2.mjs | sed -n 1p) || stop "build-yard-v2 failed"
[ lawn-trial/yard-v2-lawn.json -nt "$S/result.tgz" ] && [ lawn-trial/yard-v2-lawn.json -nt "$S/new" ] || stop "yard-v2-lawn.json was not written by this run"
(set -o pipefail; node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "rented doors|wrote|listed by two") || stop "build-rounds-data failed"
node -e "
const fs=require('fs'),RD=process.argv[1],B=JSON.parse(fs.readFileSync(process.argv[2]));let bad=0,l0=0,l1=0;
for(const [k,[n0,a]] of Object.entries(B)){const f=RD+'/'+k+'.json';if(!fs.existsSync(f)){console.log(k+': door file gone');bad++;continue}const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);const z=d.filter(x=>x.lawn&&x.lawn.sq!=null).length;l0+=a;l1+=z;
 /* 15 Nov: a re-measure can rightly find no lawn on a few wooded lots (13 Nov: Genesee 8, Todd Creek 2, Evans 1 stopped the run three times
    while 2,388 doors gained a size); up to 25 doors or 0.5% of a town may lose one, more is a fault */
 if(d.length!==n0||a-z>Math.max(25,a*0.005)){console.log(k+': doors '+n0+' -> '+d.length+', with a lawn size '+a+' -> '+z);bad++}else if(z<a)console.log(k+': '+(a-z)+' doors now read no lawn (allowed)')}
console.log('door files: with a lawn size '+l0+' -> '+l1+'; towns off: '+bad);process.exit(bad?1:0)" "$RD" "$BK/door-counts-before.json" || stop "a rebuilt door file did not check out (restore: tar xzf $BK/yard-v2-before-gap.tgz -C lawn-trial, then build-yard-v2 + build-rounds-data)"
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
while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; up6 "yardgap-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || stop "Sixfold upload failed at $batch"; done
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
step "done: lawn readings for never-measured doors live on Sixfold and the five editions; old yard v2 in $BK/yard-v2-before-gap.tgz"

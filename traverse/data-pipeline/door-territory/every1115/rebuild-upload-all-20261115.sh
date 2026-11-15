#!/bin/bash
# 15 Nov 2026: rebuild every door file and upload every town to Sixfold and the five editions, with no new data (main session's ask:
# build-rounds-data's lawnFor() now marks lawns from the yard measurement y:1, commit 3c167158; the page already reads it, so it takes
# effect only once the door files are rebuilt and uploaded). The build, checks, uploads and live md5 read-back are finish-yardv3-2026-11-11.sh's
# own (its lines from 'step "build"' on), without its copy-back and merge. Door counts per town must not change.
#   bash every1115/rebuild-upload-all-20261115.sh > logs-rebuild-all-20261115.log 2>&1 < /dev/null     (from door-territory)
set -u
exec < /dev/null
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/rebuild-20261115"; mkdir -p "$S"   # short path ("Matthew sharpe" has a space)
BK="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/rebuild-20261115-before"; mkdir -p "$BK"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SCPV="scp -q -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; RD=../../app/data/rounds; ED=../../editions/dist
EDS="traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting to upload"; sleep 120; done; }
up6() { local label=$1 i; for i in 1 2 3; do offhot; bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$label.done" ] && return 0; step "batch $label not confirmed (try $i)"; sleep $((i * 120)); done; return 1; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|finish-every|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold' }).Count" 2>/dev/null | tr -d '\r'; }
case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not starting"; exit 1;; esac
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 36 ] && stop "another upload or build has run for 3 hours"; step "another upload/build is running: waiting"; sleep 300; done
step "door counts before, and a copy of today's door files"
(cd "$RD" && tar czf "$BK/door-files-before.tgz.part" $(node -e "console.log(JSON.parse(require('fs').readFileSync('index.json')).regions.map(r=>r.key+'.json').filter(f=>require('fs').existsSync(f)).join(' '))") index.json) && mv "$BK/door-files-before.tgz.part" "$BK/door-files-before.tgz" || stop "backup"
node -e "
const fs=require('fs'),RD=process.argv[1];const o={};for(const r of JSON.parse(fs.readFileSync(RD+'/index.json')).regions){const f=RD+'/'+r.key+'.json';if(!fs.existsSync(f))continue;const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);o[r.key]=[d.length,d.filter(x=>x.lawn&&x.lawn.sq!=null).length]}fs.writeFileSync(process.argv[2],JSON.stringify(o))" "$RD" "$BK/door-counts-before.json" || stop "door counts"
step "build"
# review 12 Nov: pipefail, so a build that crashes stops the run. Without it the exit code was head's or grep's: a failed build-yard-v2
# left the old yard-v2-lawn.json, every later check passed on the old figures, nothing changed live and the stage was marked done.
(cd lawn-trial && set -o pipefail && node --max-old-space-size=8192 build-yard-v2.mjs | sed -n 1p) || stop "build-yard-v2 failed"
[ lawn-trial/yard-v2-lawn.json -nt "$BK/door-files-before.tgz" ] || stop "yard-v2-lawn.json was not written by this run"
(set -o pipefail; node --max-old-space-size=8192 build-rounds-data.mjs | grep -E "rented doors|wrote|listed by two") || stop "build-rounds-data failed"
node -e "
const fs=require('fs'),RD=process.argv[1],B=JSON.parse(fs.readFileSync(process.argv[2]));let bad=0,l0=0,l1=0;
for(const [k,[n0,a]] of Object.entries(B)){const f=RD+'/'+k+'.json';if(!fs.existsSync(f)){console.log(k+': door file gone');bad++;continue}const d=JSON.parse(fs.readFileSync(f)).areas.flatMap(a=>a.doors);const z=d.filter(x=>x.lawn&&x.lawn.sq!=null).length;l0+=a;l1+=z;
 /* 15 Nov: a re-measure can rightly find no lawn on a few wooded lots (13 Nov: Genesee 8, Todd Creek 2, Evans 1 stopped the run three times
    while 2,388 doors gained a size); up to 25 doors or 0.5% of a town may lose one, more is a fault */
 if(d.length!==n0||a-z>Math.max(25,a*0.005)){console.log(k+': doors '+n0+' -> '+d.length+', with a lawn size '+a+' -> '+z);bad++}else if(z<a)console.log(k+': '+(a-z)+' doors now read no lawn (allowed)')}
console.log('door files: with a lawn size '+l0+' -> '+l1+'; towns off: '+bad);process.exit(bad?1:0)" "$RD" "$BK/door-counts-before.json" || stop "a rebuilt door file did not check out (restore: tar xzf $BK/door-files-before.tgz -C $RD)"
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
while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; up6 "rebuild-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || stop "Sixfold upload failed at $batch"; done
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
step "done: every door file rebuilt (lawn y:1) and live on Sixfold and the five editions; old door files in $BK/door-files-before.tgz"

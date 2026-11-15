#!/bin/bash
# 15 Nov 2026: the editions half of rebuild-upload-all-20261115.sh, run again after the laptop lost its internet at 12:37 (the Sixfold upload
# had finished; the Yards push failed on DNS). Same checks: door files only, never hail-*, MD5 MATCH and json ok per edition, then a live
# md5 read-back of three towns on Sixfold and Yards.
set -u
exec < /dev/null
cd "$(dirname "$0")/.." || exit 1
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; RD=../../app/data/rounds; ED=../../editions/dist
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/rebuild-20261115"; mkdir -p "$S"
step() { echo "$(date +%T) $*"; }; stop() { echo "$(date +%T) STOP: $*"; exit 1; }
retry() { "$@" || { sleep 120; "$@"; } || { sleep 300; "$@"; }; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting to upload"; sleep 120; done; }
KEYS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$ED/traverse-data/rounds/index.json')).regions.map(r=>r.key).filter(k=>!/^com-/.test(k)).join('|'))")
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do
  offhot; retry bash ./push-edition.sh "$d" "^($KEYS)\.json\$" > "$S/push-$d.txt" 2>&1; grep -vE "left out" "$S/push-$d.txt" | tail -4
  grep -q "md5sum:" "$S/push-$d.txt" && stop "push $d: md5sum failed"
  grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
done
for t in monument highlands-ranch welby; do
  for p in "sixfold-data:$RD" "traverse-yards-data:$ED/traverse-yards-data/rounds" "traverse-data:$ED/traverse-data/rounds"; do
    live=$($SG "md5sum < ~/www/traverseplatforms.com/${p%%:*}/rounds/$t.json | cut -c1-32"); [ "$live" = "$(md5sum < "${p#*:}/$t.json" | cut -c1-32)" ] || stop "live ${p%%:*} $t.json differs from the build"
    step "live: ${p%%:*} $t.json md5 ${live:0:12} OK"
  done
done
step "done: the five editions carry the rebuilt door files"

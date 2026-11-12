#!/bin/bash
# Stage yardv3 (fill1031, added 11 Nov 2026; Matthew 11 Nov "go ahead and run ... 3": better lawn sizes). Every door yard v2 measured,
# measured again with the retuned settings (yard-scan-v2.mjs V2 of 11 Nov: green line 0.33, despeckle 4, roof buffer 1 m; the 23 Oct
# setting is V2_1023), from the same slim door lists (~/run/lawn-trial/data) and the same saved lot-line cells (drcog-turf/parcels-*.json,
# so almost no gis.colorado.gov requests), into ~/run/lawn-trial/yard-v3/ beside the live yard-v2/ (left untouched). Keys in
# ~/run/fill1031/yardv3-keys.txt, lead towns first. Three workers (key number mod 3): one town run is one CPU core (Welby test 11 Nov:
# 9.9 houses/s, user time = real time), the machine has four; one core is left for the other work on the machine.
# Laptop finisher: traverse/data-pipeline/door-territory/finish-yardv3-2026-11-11.sh (CLOUD-JOBS-2026-11-11.md).
. "$HOME/run/fill1031/lib.sh"
cd "$LT" || exit 1
export YV2_DATA="$LT/data" YV2_OUT=yard-v3
mkdir -p yard-v3
N=$(grep -c . "$Q/yardv3-keys.txt")
work() {
  local w=$1 i=0 k ok try rc
  while read -r k; do
    [ -z "$k" ] && continue; i=$((i + 1)); [ $(( (i - 1) % 3 )) -eq "$w" ] || continue
    [ -f "yard-v3/$k.finished" ] && continue
    ok=0
    for try in $(seq 1 40); do
      prune; room
      st "yardv3: worker $w at $k (key $i of $N; $(ls yard-v3/*.finished 2>/dev/null | wc -l) finished)"
      nice -n 5 node yard-v2-town.mjs --town="$k" --mins=60 --conc=32 < /dev/null; rc=$?
      [ $rc -eq 0 ] && { touch "yard-v3/$k.finished"; ok=1; break; }
      [ $rc -eq 3 ] || { echo "$(date -u +%T) $k exit $rc (try $try)"; sleep 60; }
    done
    [ $ok = 1 ] || echo "$k" >> "$Q/yardv3-skipped.txt"
  done < "$Q/yardv3-keys.txt"
}
work 0 > "$Q/yardv3-w0.log" 2>&1 & work 1 > "$Q/yardv3-w1.log" 2>&1 & work 2 > "$Q/yardv3-w2.log" 2>&1 &
wait
[ -s "$Q/yardv3-skipped.txt" ] && echo "skipped: $(tr '\n' ' ' < "$Q/yardv3-skipped.txt")"
F=$(ls yard-v3/*.finished | wc -l)
tar czf "$Q/yardv3-result.tgz.tmp" yard-v3/*.json && mv "$Q/yardv3-result.tgz.tmp" "$Q/yardv3-result.tgz" || exit 1
st "yardv3: done, $F/$N keys finished (~/run/fill1031/yardv3-result.tgz)"

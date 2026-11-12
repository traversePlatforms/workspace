#!/bin/bash
# Stage yardv3fix (fill1031, added 12 Nov 2026; Matthew 12 Nov: "repair and re-run those one at a time"). Runs after yardv3 in
# stages.txt. Before the 12 Nov fix in lawn-trial/yard-v2-town.mjs, an empty or error answer from gis.colorado.gov was saved as a
# lot-line area with no lots and its doors written as null (yardv3 by 12 Nov 20:40 UTC: 1,745 readings lost in 9 towns, Thornton 571,
# Highlands Ranch 379, Westminster 314, Cherry Creek 278 ...). This stage: yardv3-repair.mjs --prepare (drops the bad areas and those
# doors, removes the towns' .finished), then runs each listed town again ONE AT A TIME (one parcel job on gis.colorado.gov), up to three
# rounds, then tars yard-v3 again as yardv3-result.tgz. The laptop finisher (finish-yardv3-2026-11-11.sh, via run-cloud-finishers.sh)
# waits for yardv3fix.vmdone, copies the result back by md5 and does its own checks; nothing is uploaded from here.
. "$HOME/run/fill1031/lib.sh"
cd "$LT" || exit 1
export YV2_DATA="$LT/data" YV2_OUT=yard-v3
[ -s "$Q/yardv3-skipped.txt" ] && echo "$(date -u +%T) yardv3 skipped: $(tr '\n' ' ' < "$Q/yardv3-skipped.txt")"
for round in 1 2 3; do
  node --max-old-space-size=6144 "$Q/yardv3-repair.mjs" --prepare || exit 1
  N=$(grep -c . "$Q/yardv3fix-towns.txt"); [ "$N" -eq 0 ] && break
  i=0
  while read -r k; do
    [ -z "$k" ] && continue; i=$((i + 1))
    for try in $(seq 1 10); do
      prune; room
      st "yardv3fix: round $round, town $i of $N ($k), try $try"
      nice -n 5 node yard-v2-town.mjs --town="$k" --mins=60 --conc=32 < /dev/null; rc=$?
      [ $rc -eq 0 ] && { touch "yard-v3/$k.finished"; break; }
      [ $rc -eq 3 ] || { echo "$(date -u +%T) $k exit $rc (try $try)"; sleep 60; }
    done
  done < "$Q/yardv3fix-towns.txt"
done
node --max-old-space-size=6144 "$Q/yardv3-repair.mjs" --report | tail -n 1 | tee "$Q/yardv3fix-final.txt"
F=$(ls yard-v3/*.finished | wc -l); K=$(grep -c . "$Q/yardv3-keys.txt")
tar czf "$Q/yardv3-result.tgz.tmp" yard-v3/*.json && mv "$Q/yardv3-result.tgz.tmp" "$Q/yardv3-result.tgz" || exit 1
st "yardv3fix: done, $F/$K keys finished; $(cut -c19- "$Q/yardv3fix-final.txt" | cut -c1-120) (~/run/fill1031/yardv3-result.tgz)"

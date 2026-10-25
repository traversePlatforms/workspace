#!/bin/bash
# The cloud run (2026-10-24): yard v2 for every town in yard-v2/order.txt, one after another, on the Azure machine. Started with
#   nohup bash run-all.sh 32 > ~/run-all.log 2>&1 &
# from ~/run/lawn-trial. A town is done when yard-v2-town.mjs exits 0 (then <town>.finished); exit 3 = more left, carry on; anything
# else waits a minute and tries again (5 times, then the town is skipped and logged). Safe to start again: finished towns are skipped
# and a town resumes where it stopped. ~/run-status.txt holds one line on where it is.
# 2026-10-25: the LiDAR tile cache grew to 57 GB and filled the disk at 08:11 UTC; every town after Denver then failed and was skipped.
# Now the cache is cut back to 25 GB (least recently read first) before each slice, and the run stops rather than skip towns when
# under 3 GB is free.
CONC="${1:-32}"
export YV2_DATA="$HOME/run/lawn-trial/data"
LIDAR="$HOME/run/tree-zones/lidar-cache"
prune() {
  while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do
    old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-)
    [ -z "$old" ] && break
    printf '%s\n' "$old" | xargs -r rm -f
  done
}
cd "$HOME/run/lawn-trial" || exit 1
while read -r t; do
  [ -z "$t" ] && continue
  [ -f "yard-v2/$t.finished" ] && continue
  fails=0
  while :; do
    prune
    if [ "$(df -k --output=avail / | tail -1)" -lt 3145728 ]; then
      echo "$(date -u +%FT%TZ) STOPPED at $t: disk nearly full" | tee "$HOME/run-status.txt"; exit 1
    fi
    echo "$(date -u +%FT%TZ) $t" > "$HOME/run-status.txt"
    node yard-v2-town.mjs --town="$t" --mins=60 --conc="$CONC"; rc=$?
    [ $rc -eq 0 ] && { touch "yard-v2/$t.finished"; echo "$(date -u +%T) $t finished"; break; }
    [ $rc -eq 3 ] && continue
    fails=$((fails + 1)); echo "$(date -u +%T) $t exit $rc (try $fails)"
    [ $fails -ge 5 ] && { echo "$(date -u +%T) $t SKIPPED after 5 failures"; break; }
    sleep 60
  done
done < yard-v2/order.txt
echo "$(date -u +%FT%TZ) every town done" > "$HOME/run-status.txt"; echo "all done"

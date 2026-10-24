#!/bin/bash
# The cloud run (2026-10-24): yard v2 for every town in yard-v2/order.txt, one after another, on the Azure machine. Started with
#   nohup bash run-all.sh 32 > ~/run-all.log 2>&1 &
# from ~/run/lawn-trial. A town is done when yard-v2-town.mjs exits 0 (then <town>.finished); exit 3 = more left, carry on; anything
# else waits a minute and tries again (5 times, then the town is skipped and logged). Safe to start again: finished towns are skipped
# and a town resumes where it stopped. ~/run-status.txt holds one line on where it is.
CONC="${1:-32}"
export YV2_DATA="$HOME/run/lawn-trial/data"
cd "$HOME/run/lawn-trial" || exit 1
while read -r t; do
  [ -z "$t" ] && continue
  [ -f "yard-v2/$t.finished" ] && continue
  fails=0
  while :; do
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

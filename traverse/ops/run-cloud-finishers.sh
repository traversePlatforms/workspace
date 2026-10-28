#!/bin/bash
# The cloud machine's finishing steps, run unattended (2026-10-26): the VM chains roofs/solar -> Group 1 stage A -> stage B -> roof
# material by itself, but each stage's results are copied back, built and uploaded from this laptop. The overnight check calls this
# every 30 minutes; each finisher checks its own stage is done (and refuses otherwise), runs once in the background, and is marked done
# only when it exits 0. At most 3 tries per stage, so a failing upload doesn't repeat all night. Prints one line.
set -u
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
ST="$LOCALAPPDATA/ProjectBackup/cloud-finish"; mkdir -p "$ST"
[ -f "$ST/running.lock" ] && kill -0 "$(cat "$ST/running.lock" 2>/dev/null)" 2>/dev/null && { echo "cloud finish: $(cat "$ST/running.name" 2>/dev/null) still running"; exit 0; }
rm -f "$ST/running.lock"
# g1fix (2026-10-28): the Group 1 re-clip's measuring of the doors the old 20 m rule had dropped (group1/fix-measure-vm.sh); its VM
# script also leaves ~/run/group1/g1fix.vmdone, so a later job overwriting the status line cannot hide it.
for name in layers group1 material g1fix; do
  [ -f "$ST/$name.done" ] && continue
  tries=$(cat "$ST/$name.tries" 2>/dev/null || echo 0)
  [ "$tries" -ge 3 ] && { echo "cloud finish: $name FAILED 3 times, see $DT/logs-finish-$name.log"; exit 0; }
  case $name in
    layers) VMQ='layers: every town done|group1:';;
    group1) VMQ='measuring done|material';;
    material) VMQ='material done';;
    g1fix) VMQ='group1 fix: measuring done';;
  esac
  ssh -o ConnectTimeout=15 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101 "grep -qE '$VMQ' ~/run-status.txt || test -f ~/run/group1/$name.vmdone" < /dev/null 2>/dev/null || { echo "cloud finish: waiting for $name"; exit 0; }
  echo $((tries + 1)) > "$ST/$name.tries"
  (
    cd "$DT" && bash "$(ls finish-$name-2026-*.sh | head -1)" > "logs-finish-$name.log" 2>&1 && touch "$ST/$name.done"
    rm -f "$ST/running.lock" "$ST/running.name"
  ) &
  echo $! > "$ST/running.lock"; echo "$name" > "$ST/running.name"
  echo "cloud finish: started $name (try $((tries + 1)))"; exit 0
done
echo "cloud finish: every stage uploaded"

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
# g2b (2026-10-28): Group 2 stage B (group2/stageb-vm.sh, which waits for g1fix's VM work first); it leaves ~/run/group2/g2b.vmdone.
# photos (2026-10-28): the close-up roof photos for the towns whose roof material step was skipped (group2/photos-backfill-vm.sh, after
# g2b's VM work); it leaves ~/run/group2/photos.vmdone.
# A stage that failed 3 times is reported and skipped, so a later stage still runs (2026-10-28: g1fix and g2b push different towns).
FAILED=""
for name in layers group1 material g1fix g2b photos; do
  [ -f "$ST/$name.done" ] && continue
  tries=$(cat "$ST/$name.tries" 2>/dev/null || echo 0)
  [ "$tries" -ge 3 ] && { FAILED="$FAILED $name"; continue; }
  case $name in
    layers) VMQ='layers: every town done|group1:';;
    group1) VMQ='measuring done|material';;
    material) VMQ='material done';;
    g1fix) VMQ='group1 fix: measuring done';;
    g2b) VMQ='group2 B: measuring done';;
    photos) VMQ='photos backfill: done';;
  esac
  ssh -o ConnectTimeout=15 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101 "grep -qE '$VMQ' ~/run-status.txt || test -f ~/run/group1/$name.vmdone || test -f ~/run/group2/$name.vmdone" < /dev/null 2>/dev/null || { echo "cloud finish: waiting for $name${FAILED:+ (FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log)}"; exit 0; }
  echo $((tries + 1)) > "$ST/$name.tries"
  (
    cd "$DT" && bash "$(ls finish-$name-2026-*.sh | head -1)" > "logs-finish-$name.log" 2>&1 && touch "$ST/$name.done"
    rm -f "$ST/running.lock" "$ST/running.name"
  ) &
  echo $! > "$ST/running.lock"; echo "$name" > "$ST/running.name"
  echo "cloud finish: started $name (try $((tries + 1)))"; exit 0
done
[ -n "$FAILED" ] && { echo "cloud finish: FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log"; exit 0; }
echo "cloud finish: every stage uploaded"

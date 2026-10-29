#!/bin/bash
# What runs on the cloud machine after Group 3 stage A (2026-10-29, Matthew's decisions of 29 Oct), one parcel job at a time:
#   1. waits for run-group3.sh (the 172 targets) to finish;
#   2. Teller: puts the 173-target targets.json in place (targets-173.json: the 172 + g3-divide-rural, Teller's Divide subdivision,
#      "sweep the rest of Teller"), removes g3a.vmdone and runs run-group3.sh again: it skips the 172 finished targets, pulls
#      g3-divide-rural, rewrites out/summary.tsv (173 rows) and leaves g3a.vmdone again;
#   3. Group 3b: run-group3b.sh (address-point doors for the 11 skipped counties that have address points) -> out/summary-3b.tsv,
#      g3b.vmdone.
# Nothing registered or uploaded. Start: nohup bash ~/run/group3/queue-after-g3a.sh >> ~/run-group3.log 2>&1 &
set -u
G="$HOME/run/group3"; cd "$G" || exit 1
echo "$(date -u +%T) queue: waiting for run-group3.sh"
while pgrep -f "^bash [^ ]*run-group3\.sh" > /dev/null; do sleep 120; done
if [ ! -f g3-divide-rural.done ]; then
  [ -f targets-173.json ] || { echo "queue: targets-173.json missing"; exit 1; }
  [ -f targets-172.json ] || cp targets.json targets-172.json
  cp targets-173.json targets.json && rm -f g3a.vmdone
  echo "$(date -u +%T) queue: Teller sweep (g3-divide-rural)"
  bash "$G/run-group3.sh" || { echo "queue: run-group3.sh ended badly (see above); Group 3b not started"; exit 1; }
fi
echo "$(date -u +%T) queue: Group 3b"
bash "$G/run-group3b.sh"

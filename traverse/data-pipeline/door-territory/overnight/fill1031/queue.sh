#!/bin/bash
# The cloud machine's coverage-fill queue (2026-10-31, Matthew: "Find more work for the cloud machine, we still have a lot of credit"; he
# wants it running all the time). Built from coverage-audit-2026-10-31.md. Copy on the VM: ~/run/fill1031/ (this folder), started with
#   nohup bash ~/run/fill1031/queue.sh > ~/run-fill1031.log 2>&1 < /dev/null &
# Runs the stages named in ~/run/fill1031/stages.txt, one at a time, in that order: <stage>.sh, its output in <stage>.log. A stage that
# exits 0 leaves <stage>.vmdone (the laptop's overnight check sees it: traverse/ops/run-cloud-finishers.sh, stage <stage>, runs
# finish-<stage>-2026-10-31.sh); one that fails leaves <stage>.failed and the queue moves on. stages.txt is read again after every
# stage, so a stage can be added later without stopping this; with nothing left it waits (status "idle") and looks again every
# 10 minutes. ~/run/fill1031/stop ends it; <stage>.hold skips a stage until the file is removed.
# Every stage that reads the state parcel layer (gis.colorado.gov) runs here, one after another: never two parcel jobs at once. Nothing
# else on the machine pulls parcels while this runs.
set -u
Q="$HOME/run/fill1031"
st() { echo "$(date -u +%FT%TZ) fill1031: $*" | tee "$HOME/run-status.txt"; }
idle=0
while :; do
  [ -f "$Q/stop" ] && { st "stopped (~/run/fill1031/stop)"; exit 0; }
  next=""
  for s in $(grep -vE '^[[:space:]]*(#|$)' "$Q/stages.txt" | awk '{print $1}'); do
    [ -f "$Q/$s.vmdone" ] || [ -f "$Q/$s.failed" ] || [ -f "$Q/$s.hold" ] || [ ! -f "$Q/$s.sh" ] && continue
    next=$s; break
  done
  if [ -z "$next" ]; then
    [ $idle = 0 ] && st "idle: every stage in stages.txt is done or failed; looking again every 10 minutes"
    idle=1; sleep 600; continue
  fi
  idle=0
  st "$next: started"
  if bash "$Q/$next.sh" >> "$Q/$next.log" 2>&1; then touch "$Q/$next.vmdone"; st "$next: done"
  else touch "$Q/$next.failed"; st "$next: FAILED (see ~/run/fill1031/$next.log); moving on"; fi
done

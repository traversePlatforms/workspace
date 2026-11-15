#!/bin/bash
# Quarterly new-construction refresh, laptop half (every1115/refresh-quarterly.sh queues the cloud half and names the run in
# every1115/refresh-run.txt). Waits (exit 4, about every 25 minutes) for ~/run/<run>/ehb.vmdone, then runs the every-home finisher for
# that run once (EH_RUN=<run>; log logs-finish-<run>.log). Nothing to do when no run is named.
. "$(dirname "$0")/_common.sh"
[ -s every1115/refresh-run.txt ] || { echo "$(date +%T) no quarterly run queued"; exit 0; }
RUN=$(cat every1115/refresh-run.txt); LOG="logs-finish-$RUN.log"
[ -f "$LOG" ] && tail -1 "$LOG" | grep -q "done: commit" && { echo "$(date +%T) $RUN already finished"; exit 0; }
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
$VM "test -f ~/run/$RUN/ehb.vmdone" < /dev/null || { echo "$(date +%T) $RUN still on the cloud machine: $($VM 'tail -1 ~/run-status.txt' < /dev/null)"; sleep 1380; exit 4; }
on_hotspot && { echo "$(date +%T) on the hotspot - waiting"; exit 4; }
EH_RUN="$RUN" bash every1115/finish-every-2026-11-15.sh > "$LOG" 2>&1
tail -3 "$LOG"; grep -q "done: commit" "$LOG" && exit 0; exit 1

#!/bin/bash
# Lawn readings for the doors that had none (15 Nov 2026, main session: "So many of these lawns are still check before quoting"; Matthew's
# standing go on lawn work and its uploads). Waits (exit 4, about every 25 minutes) for the cloud stage yardgap, then runs
# every1115/finish-yardgap-2026-11-15.sh once: copy back, add-only merge into lawn-trial/yard-v2, build, checks, upload every town.
. "$(dirname "$0")/_common.sh"
[ -f logs-finish-yardgap.log ] && tail -1 logs-finish-yardgap.log | grep -q "done: lawn readings" && { echo "$(date +%T) the finisher already ran to the end"; exit 0; }
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
$VM 'test -f ~/run/fill1031/yardgap.vmdone' < /dev/null || { echo "$(date +%T) yardgap still measuring: $($VM 'tail -1 ~/run-status.txt' < /dev/null)"; sleep 1380; exit 4; }
on_hotspot && { echo "$(date +%T) on the hotspot - waiting"; exit 4; }
bash every1115/finish-yardgap-2026-11-15.sh > logs-finish-yardgap.log 2>&1 < /dev/null
tail -3 logs-finish-yardgap.log
grep -q "done: lawn readings" logs-finish-yardgap.log && exit 0
exit 1

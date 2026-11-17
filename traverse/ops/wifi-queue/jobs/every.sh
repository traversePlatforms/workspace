#!/bin/bash
# Every home (15 Nov 2026, door-territory/EVERY-HOME-2026-11-15.md). Matthew 15 Nov: "I eventually want to have every
# residential property in Colorado on this list that we possibly can." Waits (exit 4, about every 25 minutes) until the cloud stage ehb
# has measured the batch, then runs every1115/finish-every-2026-11-15.sh once: copy back, build, check no town of ours lost a door,
# upload the changed towns to Sixfold and each edition. Mobile homes and buildings join only once every1115/KINDS-READY exists.
. "$(dirname "$0")/_common.sh"
[ -f logs-finish-every.log ] && tail -1 logs-finish-every.log | grep -q "done: commit" && { echo "$(date +%T) the finisher already ran to the end"; exit 0; }
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
$VM 'test -f ~/run/every1115/ehb.vmdone' < /dev/null || { echo "$(date +%T) ehb still measuring: $($VM 'tail -1 ~/run-status.txt' < /dev/null)"; sleep 1380; exit 4; }
on_hotspot && { echo "$(date +%T) on the hotspot - waiting"; exit 4; }
nice -n 19 bash every1115/finish-every-2026-11-15.sh > logs-finish-every.log 2>&1   # 17 Nov: low priority (node runs at Idle), after the 16 Nov thermal hibernate
tail -3 logs-finish-every.log
grep -q "done: commit" logs-finish-every.log && exit 0
exit 1

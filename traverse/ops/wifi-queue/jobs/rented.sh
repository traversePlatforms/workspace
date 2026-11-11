#!/bin/bash
# Rented / second-home doors (gap plan 2026-11-08, OWNER-FIELD-SPEC). Matthew 10 Nov 2026: "Go ahead and add those in when they are done".
# Waits (exit 4, retried every 30 min) until the cloud stage rentb has finished measuring, then switches on gap1108/GO-rented and runs
# gap1108/finish-rent-2026-11-08.sh once: copy back, build (every door gets occ; Sixfold shows owner-lived only by default), upload
# every town to Sixfold and each edition. GO-rented is made only here, after rentb is done: it is also the switch that makes every
# build-rounds-data.mjs run promote the homes, so making it earlier would put unmeasured homes on the lists.
. "$(dirname "$0")/_common.sh"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
# while it waits, check about every 25 minutes, not every 2 (the queue retries an exit-4 job after 2 minutes; 10 Nov)
$VM 'test -f ~/run/gap1108/rentb.vmdone' < /dev/null || { echo "$(date +%T) rentb still measuring: $($VM 'tail -1 ~/run-status.txt' < /dev/null)"; sleep 1380; exit 4; }
# another gap finisher or edition push still going: wait
BUSY=$(powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|push-edition|finish-rent' }).Count" 2>/dev/null | tr -d '\r')
[ "${BUSY:-0}" != "0" ] && { echo "$(date +%T) another town upload is running - waiting"; exit 4; }
on_hotspot && { echo "$(date +%T) on the hotspot - waiting"; exit 4; }
[ -f gap1108/GO-rented ] || echo "Matthew's go, 10 Nov 2026 (\"Go ahead and add those in when they are done\"); made by wifi-queue/jobs/rented.sh $(date '+%Y-%m-%d %H:%M') after rentb finished" > gap1108/GO-rented
bash gap1108/finish-rent-2026-11-08.sh > logs-finish-rent.log 2>&1; rc=$?
tail -3 logs-finish-rent.log
grep -q "^.* done: commit" logs-finish-rent.log && exit 0
exit 1

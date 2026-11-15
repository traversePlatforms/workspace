#!/bin/bash
# The quarterly new-construction refresh on this laptop (Matthew 15 Nov 2026; every1115/refresh-quarterly.sh). The Windows task "Traverse
# new homes refresh" names the run in every1115/refresh-run.txt; this runs it, and the queue retries an exit 4 (hotspot, no internet) later.
. "$(dirname "$0")/_common.sh"
[ -s every1115/refresh-run.txt ] || { echo "$(date +%T) no quarterly run named"; exit 0; }
RUN=$(cat every1115/refresh-run.txt)
[ -f "every1115/runs/$RUN/finish.done" ] && { echo "$(date +%T) $RUN already finished"; exit 0; }
on_hotspot && { echo "$(date +%T) on the hotspot - waiting"; exit 4; }
bash every1115/refresh-quarterly.sh "$RUN"; rc=$?
tail -2 logs-refresh-quarterly.log
exit $rc

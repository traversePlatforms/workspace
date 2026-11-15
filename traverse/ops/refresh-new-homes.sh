#!/bin/bash
# Windows task "Traverse new homes refresh" (15 Feb, 15 May, 15 Aug, 15 Nov, 02:00; Matthew 15 Nov 2026: "Go ahead and schedule that").
# Names this quarter's run (every1115/refresh-run.txt) and clears the Wi-Fi queue job everyq's marks, so the queue runs the laptop refresh
# (data-pipeline/door-territory/every1115/refresh-quarterly.sh) when the laptop is on Wi-Fi that is not the iPhone hotspot. Nothing heavy here.
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; Q="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue"
cd "$DT" || exit 1
RUN="every-$(date +%Y%m%d)"; echo "$RUN" > every1115/refresh-run.txt
rm -f "$Q/state/everyq.done" "$Q/state/everyq.fails" "$Q/state/everyq.failed" "$Q/state/everyq.units"
echo "$(date '+%F %T') $RUN: due; the Wi-Fi queue job everyq runs it off the hotspot" >> logs-refresh-quarterly.log

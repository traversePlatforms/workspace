#!/bin/bash
# One-off (2026-10-20): hand the refine from the old runner (resume4-when-wifi -> run-refine-resume) to the Wi-Fi queue. Waits for the town
# the old runner is on (the last "== refine <town>" line in its log) to finish uploading, stops the old runner and anything it started, then starts the queue.
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
Q="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue"
mkdir -p "$Q/logs"
CUR=$(grep -o "== refine [a-z-]*" "$DT/logs-refine-runner3.log" | tail -1 | sed "s/== refine //")
echo "$(date +%T) waiting for refine-$CUR to upload"
for i in $(seq 1 360); do [ -f "$DT/logs-upload/refine-$CUR.done" ] && break; sleep 30; done
echo "$(date +%T) $( [ -f "$DT/logs-upload/refine-$CUR.done" ] && echo "$CUR uploaded" || echo 'gave up waiting after 3 hours')"
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'run-refine-resume|resume4-when-wifi|hotspot-watchdog2.sh run-refine') -or (\$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'lawn-fill|sample-lawn-compact|sample-trees|build-lookup|build-rounds-data|sample-value') } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force; \$_.ProcessId }" | tr -d '\r' | tr '\n' ' ' | sed 's/^/stopped: /'; echo
echo "$(date +%T) old runner stopped; starting the queue"
nohup bash "$Q/wifi-queue.sh" > "$Q/logs/runner-console.log" 2>&1 &
echo "$(date +%T) queue started (pid $!)"

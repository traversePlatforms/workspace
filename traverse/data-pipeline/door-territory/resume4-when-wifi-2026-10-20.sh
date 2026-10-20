#!/bin/bash
# 2026-10-20: the refine stopped for Matthew's iPhone hotspot at 08:43 (17 of 61 towns done). Wait until off the hotspot with internet
# (every 2 minutes), then restart the OneDrive watcher and the refine resume (it skips the done towns and stops itself on the hotspot).
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
while true; do
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*) ;; *) curl -s -m 15 -o /dev/null https://gis.colorado.gov/ && break;; esac
  sleep 120
done
echo "$(date +%T) refine resuming on ${SSID:-wired}" >> logs-switch-fast.log
rm -f logs-paused.flag
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\SURGEI~1\AppData\Local\Temp\claude\c--Users-Surge-Inc-Desktop-claude-test-2\db3e1153-072f-46a3-b860-134f689b5a09\scratchpad\onedrive-wait-then-dump.ps1" > /dev/null 2>&1 &
bash run-refine-resume-2026-10-20.sh >> logs-refine-runner3.log 2>&1
echo "$(date +%T) refine resume ended (exit $?)" >> logs-switch-fast.log

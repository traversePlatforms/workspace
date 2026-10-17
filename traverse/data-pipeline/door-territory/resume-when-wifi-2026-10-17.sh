#!/bin/bash
# 2026-10-17: wait until off the iPhone hotspot with internet, then run-fast3 and run-refine (checks every 2 minutes)
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
while true; do
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*) ;; *) curl -s -m 15 -o /dev/null https://gis.colorado.gov/ && break;; esac
  sleep 120
done
echo "$(date +%T) resuming on ${SSID:-wired}" >> logs-switch-fast.log
rm -f logs-paused.flag
bash run-fast3-2026-10-17.sh > logs-fast3-runner.log 2>&1; echo "$(date +%T) run-fast3 finished" >> logs-switch-fast.log
bash run-refine-2026-10-16.sh > logs-refine-runner.log 2>&1; echo "$(date +%T) refine finished" >> logs-switch-fast.log

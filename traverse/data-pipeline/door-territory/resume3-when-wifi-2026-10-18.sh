#!/bin/bash
# 2026-10-18: batch 6 stopped on the iPhone hotspot at ~10:14 (after Acres Green's lawns). Wait until off the hotspot with internet
# (checks every 2 minutes), then batch 6 again: it skips the four places that finished, then values, upload, trees, and the refine pass.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
while true; do
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*) ;; *) curl -s -m 15 -o /dev/null https://gis.colorado.gov/ && break;; esac
  sleep 120
done
echo "$(date +%T) batch 6 resuming on ${SSID:-wired}" >> logs-switch-fast.log
rm -f logs-paused.flag
bash run-batch6-2026-10-18.sh >> logs-batch6-runner.log 2>&1
echo "$(date +%T) batch 6 + refine finished" >> logs-switch-fast.log

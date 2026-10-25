#!/bin/bash
# Waits for Wi-Fi that is not the iPhone hotspot (no heavy downloads on it) and a reachable gis.colorado.gov, then runs the rest of
# run-gapfix-2026-10-25.sh (towns already fixed are skipped). 2026-10-25: the first run lost the internet at 11:46 when the laptop moved
# to the hotspot; Greenwood Village and Edgewater had finished, the other seven stopped before changing anything.
#   bash gapfix-when-wifi-2026-10-25.sh > logs-gapfix-wifi.log 2>&1
cd "$(dirname "$0")"
ssid() { netsh wlan show interfaces 2>/dev/null | sed -n 's/^ *SSID *: //p' | head -1 | tr -d '\r'; }
while :; do
  s=$(ssid)
  if [ -n "$s" ] && [ "$s" != "iPhone" ] && curl -s -o /dev/null -m 20 "https://gis.colorado.gov/public/rest/services?f=json"; then break; fi
  echo "$(date +%T) waiting (network: ${s:-none})"; sleep 120
done
echo "$(date +%T) on $s, starting"
bash run-gapfix-2026-10-25.sh > logs-gapfix-2.log 2>&1
echo "$(date +%T) finished"; grep -E "done|skipped|failed|not bigger" logs-gapfix-2.log

#!/bin/bash
# Like hotspot-watchdog.sh, for any run: bash hotspot-watchdog2.sh <pattern of the runner's command line>  (2026-10-16)
# Checks every 30 s while that run is going; on Matthew's iPhone hotspot it stops the run and every pipeline node process and drops
# logs-paused.flag. Ends when the run ends.
PAT="${1:-resume-trees}"
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
running() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match '$PAT' }).Count" 2>/dev/null | tr -d '\r'; }
sleep 20
while [ "$(running)" != "0" ]; do
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*)
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match '$PAT|upload-towns') -or (\$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'prefetch-lidar|sample-trees|sample-value|sample-lawn|build-walklist|fetch-buildings|build-rounds|build-lookup') } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    touch logs-paused.flag
    echo "$(date +%T) hotspot ($SSID): $PAT stopped and paused"
    exit 0;;
  esac
  sleep 30
done
echo "$(date +%T) $PAT finished; watchdog done"

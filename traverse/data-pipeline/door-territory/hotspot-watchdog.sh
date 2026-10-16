#!/bin/bash
# Stops the town work the moment the laptop joins Matthew's iPhone hotspot (2026-10-16: twice it ran for a while on phone data before
# anyone noticed). Checks every 30 s while a resume run is going; on the hotspot it kills the runner and every pipeline node process
# and drops logs-paused.flag. Ends when the run ends.   bash hotspot-watchdog.sh
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
running() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'resume-trees' }).Count" 2>/dev/null | tr -d '\r'; }
sleep 20
while [ "$(running)" != "0" ]; do
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*)
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'resume-trees|run-batch5|upload-towns') -or (\$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'prefetch-lidar|sample-trees|sample-value|sample-lawn|build-walklist|fetch-buildings|build-rounds') } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    rm -f logs-batch5-fix/done.flag
    touch logs-paused.flag
    echo "$(date +%T) hotspot ($SSID): town work stopped and paused"
    exit 0;;
  esac
  sleep 30
done
echo "$(date +%T) run finished; watchdog done"

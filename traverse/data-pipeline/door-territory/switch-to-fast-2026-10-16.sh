#!/bin/bash
# 2026-10-16 night: when run-allsizes reaches value-denver (Denver's trees done, nothing half-written), stop it and start run-fast
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
until grep -q "start value-denver" logs-allsizes-runner.log; do sleep 10; done
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'run-allsizes-2026-10-16') -or (\$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'sample-value.mjs') } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo "$(date +%T) stopped run-allsizes at value-denver" | tee -a logs-allsizes-runner.log
sleep 3
bash run-fast-2026-10-16.sh > logs-fast-runner.log 2>&1
echo "$(date +%T) run-fast finished"

#!/bin/bash
# 2026-10-16: Boulder's trees run at ~0.4 doors/s (~10 h for the ~14,600 left) and sat in front of the 40-town upload and the
# catch-up. Boulder is already live. So: when batch 5 reaches trees-boulder, stop that one step (it has written nothing yet; the
# runner carries on to rounds2 + done.flag, which releases the upload and the catch-up). After the catch-up is done, run Boulder's
# trees alone (two tree runs at once would both write tree-cache.json), rebuild, then upload Boulder.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-boulder-trees; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
until grep -q "start trees-boulder" logs-batch5-runner.log; do sleep 30; done
sleep 5
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*sample-trees.mjs*--town=boulder*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force; 'stopped boulder tree step pid ' + \$_.ProcessId }"
until [ -f logs-batch5-fix/done.flag ]; do sleep 60; done
step trees-boulder bash -c "cd tree-zones && node sample-trees.mjs --town=boulder --conc=6"
step rounds node build-rounds-data.mjs
touch "$L/done.flag"
bash upload-towns-sixfold.sh boulder-trees-2026-10-16 boulder
echo "$(date +%H:%M:%S) boulder done"

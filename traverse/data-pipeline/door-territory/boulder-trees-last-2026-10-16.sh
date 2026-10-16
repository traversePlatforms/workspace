#!/bin/bash
# 2026-10-16: Boulder's trees run at ~0.4 doors/s (~10 h for the ~14,600 left) and sat in front of the 40-town upload and the
# catch-up. Boulder is already live. So: when batch 5 reaches trees-boulder, stop that one step (it has written nothing yet; the
# runner carries on to rounds2 + done.flag, which releases the upload and the catch-up). After the catch-up is done:
#   1. a tree retry over every new town (the 08:17-08:28 internet drop failed Superior, Watkins, Louisville, Brighton, Lafayette;
#      measured doors are skipped, so finished towns take seconds),
#   2. Boulder's trees,
# one tree run at a time (they all write tree-cache.json), then one rebuild and a final upload of all of them.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-boulder-trees; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
T40="bow-mar columbine-valley glendale columbine ken-caryl dove-valley morrison twin-lakes foxfield stonegate sherrelwood welby federal-heights roxborough-park northglenn evergreen the-pinery broomfield superior watkins louisville brighton lafayette perry-park idaho-springs lochbuie elizabeth dacono gunbarrel frederick bennett fort-lupton niwot firestone hudson nederland kiowa longmont"
SIX="strasburg platteville mead keenesburg byers lyons"
until grep -q "start trees-boulder" logs-batch5-runner.log; do sleep 30; done
sleep 5
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*sample-trees.mjs*--town=boulder*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force; 'stopped boulder tree step pid ' + \$_.ProcessId }"
until [ -f logs-batch5-fix/done.flag ]; do sleep 60; done
for t in $T40 $SIX; do [ -s "$t-areas.json" ] && step retry-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step trees-boulder bash -c "cd tree-zones && node sample-trees.mjs --town=boulder --conc=6"
step rounds node build-rounds-data.mjs
touch "$L/done.flag"
bash upload-towns-sixfold.sh towns-final-2026-10-16 $T40 $SIX boulder
echo "$(date +%H:%M:%S) all done"

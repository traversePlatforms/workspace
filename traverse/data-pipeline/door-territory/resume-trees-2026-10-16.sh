#!/bin/bash
# Resume the 45-mile tree work (paused 2026-10-16 ~08:55: the laptop was on Matthew's iPhone hotspot — LiDAR tiles are GBs of
# phone data; he chose "pause until office Wi-Fi"). Picks up where it stopped: measured doors are skipped.
#   1. building tile for Idaho Springs; trees for every new town (Boulder County tiles prefetched alongside, 24 at once)
#   2. rebuild -> logs-batch5/done.flag -> upload the 40 towns
#   3. the catch-up (six outage towns, Longmont lawns, values, their trees) -> upload
#   4. Boulder's trees (slow survey, last) -> rebuild -> final upload of everything
# One measuring run at a time (they all write tree-cache.json). Refuses to start on the hotspot or a slow line.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "still on the hotspot ($SSID) - not starting"; exit 1;; esac
BPS=$(curl -s -o /dev/null --max-time 10 -w '%{speed_download}' "https://speed.cloudflare.com/__down?bytes=20000000" | cut -d. -f1)
[ "${BPS:-0}" -lt 1000000 ] && { echo "line too slow ($BPS B/s) - not starting"; exit 1; }
echo "$(date +%T) network: ${SSID:-wired}, $((BPS/1000000)) MB/s"
rm -f logs-paused.flag
L=logs-resume; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
T40="bow-mar columbine-valley glendale columbine ken-caryl dove-valley morrison twin-lakes foxfield stonegate sherrelwood welby federal-heights roxborough-park northglenn evergreen the-pinery broomfield superior watkins louisville brighton lafayette perry-park idaho-springs lochbuie elizabeth dacono gunbarrel frederick bennett fort-lupton niwot firestone hudson nederland kiowa longmont"
SIX="strasburg platteville mead keenesburg byers lyons"
# safe to run again (2026-10-16 10:36, paused a second time on the hotspot): stages whose upload already happened are skipped
if [ ! -f logs-upload/towns-trees-2026-10-16.done ]; then
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs 023101021"
( cd tree-zones && node prefetch-lidar.mjs --towns=superior,louisville,lafayette,gunbarrel,niwot,nederland,longmont --conc=24 > "../$L/prefetch.log" 2>&1 ) &
for t in $T40; do [ -s "$t-areas.json" ] && step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
wait
step rounds1 node build-rounds-data.mjs
mkdir -p logs-batch5; touch logs-batch5/done.flag
bash upload-towns-sixfold.sh towns-trees-2026-10-16 $T40
fi
if [ ! -f logs-upload/towns-catchup-2026-10-16.done ]; then
echo "$(date +%T) catch-up"
rm -f logs-batch5-fix/done.flag logs-batch5-fix/ready.flag
bash run-batch5-fix-2026-10-16.sh > logs-batch5-fix-runner.log 2>&1
[ -f logs-batch5-fix/done.flag ] && bash upload-towns-sixfold.sh towns-catchup-2026-10-16 $T40 $SIX
fi
( cd tree-zones && node prefetch-lidar.mjs --towns=boulder --conc=24 > "../$L/prefetch-boulder.log" 2>&1 ) &
for t in $T40 $SIX; do [ -s "$t-areas.json" ] && step retry-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step trees-boulder bash -c "cd tree-zones && node sample-trees.mjs --town=boulder --conc=6"
wait
step rounds2 node build-rounds-data.mjs
mkdir -p logs-boulder-trees; touch logs-boulder-trees/done.flag
bash upload-towns-sixfold.sh towns-final-2026-10-16 $T40 $SIX boulder
echo "$(date +%T) all done"

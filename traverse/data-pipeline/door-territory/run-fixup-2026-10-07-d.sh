#!/bin/bash
# Fix-up (2026-10-07 evening): a network outage from about 18:40 to 21:09 made these steps fail in seconds (logs-2026-10-07:
# "fetch failed"). Started detached; waits for run-resume-2026-10-07.sh to finish, then reruns the failed steps (each picks up from
# its saved cache) and the shared builds after them, so every file includes the new towns. Progress in logs-2026-10-07/_fixup.out.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/fix-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/fix-$name.log" | cut -c1-140)"; }
echo "$(date '+%Y-%m-%d %H:%M:%S') fix-up waiting for the overnight run to finish"
while powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"name='bash.exe'\" | Where-Object { \$_.CommandLine -like '*run-resume-2026-10-07.sh*' }) { exit 0 } else { exit 1 }" >/dev/null 2>&1; do sleep 120; done
echo "$(date +%H:%M:%S) overnight run finished; fix-up starting"
ROOF="cs-northeast cs-southeast security-widefield fountain"
SOLAR="arvada centennial thornton"
TREES="parker windsor erie commerce-city"
LAWN="highlands-ranch parker castle-pines"
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
for t in $ROOF; do step "roofs-$t" bash -c "cd roofs && node sample-roofs.mjs --town=$t --conc=6"; done
for t in $ROOF; do step "houses-$t" bash -c "cd roofs/material && node houses.mjs --town=$t"; done
for t in $ROOF; do step "windows-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t --index-only"; done
step naip bash -c "cd roofs/material && node build-naip-photos.mjs"
for t in $SOLAR; do step "solar-$t" bash -c "cd solar && node sample-solar.mjs --town=$t --conc=6"; done
for t in $TREES; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
for t in $LAWN; do step "lawnmask-$t" bash -c "cd lawn-trial && node build-lawn-outlines.mjs --town=$t --conc=6"; done
step hoa bash -c "cd hoa-registry && node build-hoa-list.mjs"
step year bash -c "cd assessor && node build-year.mjs"
step value node sample-value.mjs
step rounds node build-rounds-data.mjs
step roofs-build bash -c "cd roofs && node sample-roofs.mjs --build"
step solar-build bash -c "cd solar && node utility-figures.mjs && node sample-solar.mjs --build"
step permits-build bash -c "cd permits && node build-permits.mjs"
step nri bash -c "cd nri && node build-nri.mjs"
step census bash -c "cd census && node build-census.mjs"
step climate bash -c "cd climate && node build-climate.mjs"
step pest bash -c "cd pest && node build-pest.mjs"
step security bash -c "cd security && node build-security.mjs"
step outlines bash -c "cd roofs && node outline-photos.mjs"
step hail-build bash -c "cd hail && node build-hail.mjs build"
step wind bash -c "cd wind && node build-wind.mjs build"
echo "$(date +%H:%M:%S) FIX-UP DONE"

#!/bin/bash
# South Denver (2.5 mi around S Pearl St & Iliff) and Englewood, for a Sixfold rep working there (2026-10-12, Matthew: "pushing
# aeration jobs"). Lawn first: the door files are written straight after it, so the towns are usable before trees land; then trees,
# values, HOAs, the door files again, mail. One parcel-heavy step at a time (2026-10-11), and never beside another lawn writer:
# it waits for any sample-lawn process still running. A log per step in logs-southdenver/. Run from this folder.
set -u
cd "$(dirname "$0")"
L=logs-southdenver; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
while tasklist //FI "IMAGENAME eq node.exe" //V //FO CSV 2>/dev/null | grep -q "sample-lawn"; do sleep 20; done
while powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'sample-lawn|sample-trees' }).Count" | grep -qv '^0'; do sleep 20; done
step wildfire node sample-wildfire.mjs
step lawn-sd bash -c "cd lawn-trial && node sample-lawn.mjs --town=south-denver --conc=16"
step lawn-en bash -c "cd lawn-trial && node sample-lawn.mjs --town=englewood --conc=16"
step rounds1 node build-rounds-data.mjs
step compact-sd bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=south-denver --conc=12"
step compact-en bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=englewood --conc=12"
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
step trees-sd bash -c "cd tree-zones && node sample-trees.mjs --town=south-denver --conc=6"
step trees-en bash -c "cd tree-zones && node sample-trees.mjs --town=englewood --conc=6"
step value node sample-value.mjs
step hoa node sample-hoa.mjs
step rounds2 node build-rounds-data.mjs
step mail-sd node build-mail-sidecar.mjs south-denver
step mail-en node build-mail-sidecar.mjs englewood
echo "$(date +%H:%M:%S) all done"

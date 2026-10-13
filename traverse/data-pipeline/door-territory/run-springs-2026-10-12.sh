#!/bin/bash
# Overnight 2026-10-12 (Matthew: aeration ranking; the Springs towns score ~2 because no lawn was ever measured there):
# lawn for the four Colorado Springs quarters, Security-Widefield and Fountain (~106,000 doors), door files, compact lawns,
# then trees near the house, door files again. One heavy step at a time; waits for any lawn/tree writer. Logs in logs-springs/.
set -u
cd "$(dirname "$0")"
L=logs-springs; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
while powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'sample-lawn|sample-trees' }).Count" | grep -qv '^0'; do sleep 20; done
T="cs-northeast cs-northwest cs-southeast cs-southwest security-widefield fountain"
for t in $T; do step lawn-$t bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"; done
step rounds1 node build-rounds-data.mjs
for t in $T; do step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=12"; done
step rounds2 node build-rounds-data.mjs
for t in $T; do step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step rounds3 node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

#!/bin/bash
# 365 Aeration & Seeding (Sixfold), phase 0 (2026-10-14, Matthew: "everything scanned and measured the same way" within 45 miles
# of 333 W Hampden Ave, Englewood). The three towns already built for the editions but never measured: Denver, Arvada, Boulder.
# Same steps as Aurora (run-aurora-2026-10-12.sh), each incremental and alone: lawn, compact and trees all ask the state's parcel
# service, which does not take several at once (2026-10-11). A log per step in logs-a365/. Run from this folder.
set -u
cd "$(dirname "$0")"
L=logs-a365; mkdir -p "$L"
TOWNS="denver arvada boulder"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
while powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'sample-lawn|sample-trees' }).Count" | grep -qv '^0'; do sleep 20; done
step wildfire node sample-wildfire.mjs
for t in $TOWNS; do step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"; done
step rounds1 node build-rounds-data.mjs
for t in $TOWNS; do step "compact-$t" bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=12"; done
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
for t in $TOWNS; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step value node sample-value.mjs
step hoa node sample-hoa.mjs
step rounds2 node build-rounds-data.mjs
for t in $TOWNS; do step "mail-$t" node build-mail-sidecar.mjs $t; done
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

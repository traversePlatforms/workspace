#!/bin/bash
# Aurora's per-door data (2026-10-12, Matthew: "start with Aurora ... a huge market and city that is currently untapped").
# The door list came from build-walklist-co.mjs (Arapahoe + Adams, by the city's legal boundary), merged into aurora.csv and
# split into 1,533 neighbourhoods (aurora-areas.json, 60,757 doors). Each step below is incremental (coordinate caches) and runs
# alone: lawn, compact and trees all ask the state's parcel service, which does not take several at once (2026-10-11).
# A log per step in logs-aurora/. Run from this folder:  bash run-aurora-2026-10-12.sh
set -u
cd "$(dirname "$0")"
L=logs-aurora; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
step wildfire node sample-wildfire.mjs
step lawn bash -c "cd lawn-trial && node sample-lawn.mjs --town=aurora --conc=16"
step lawn-compact bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=aurora --conc=12"
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
step trees bash -c "cd tree-zones && node sample-trees.mjs --town=aurora --conc=6"
step value node sample-value.mjs
step hoa node sample-hoa.mjs
step mail node build-mail-sidecar.mjs aurora
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"

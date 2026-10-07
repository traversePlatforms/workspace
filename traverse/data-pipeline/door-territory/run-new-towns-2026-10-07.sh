#!/bin/bash
# The per-door data for the three north-Douglas towns (2026-10-07): Highlands Ranch, Parker, Castle Pines.
# Each step is incremental (coordinate caches) or limited to the new towns; a log per step lands in logs-2026-10-07/.
# Run from this folder:  bash run-new-towns-2026-10-07.sh
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
NEW="highlands-ranch parker castle-pines"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
step wildfire node sample-wildfire.mjs
for t in $NEW; do step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=6"; done
for t in $NEW; do step "lawn-compact-$t" bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=6"; done
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
for t in $NEW; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step value node sample-value.mjs
step hoa node sample-hoa.mjs
step mail node build-mail-sidecar.mjs $NEW
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"

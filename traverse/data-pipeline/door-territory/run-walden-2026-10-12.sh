#!/bin/bash
# Walden (0.75 mi around Deboodt Ct, Black Forest; El Paso): the neighbourhood of a Sixfold job on Tue 13 Oct (2026-10-12, Matthew:
# the rep works the job's neighbourhood that day). 475 doors: lawn, trees, door files, mail. Run with no other lawn or tree writer
# going (they share lawn-cache.json and tree-cache.json). A log per step in logs-walden/. Run from this folder.
set -u
cd "$(dirname "$0")"
L=logs-walden; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
step wildfire node sample-wildfire.mjs
step lawn bash -c "cd lawn-trial && node sample-lawn.mjs --town=walden --conc=8"
step compact bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=walden --conc=8"
step trees bash -c "cd tree-zones && node sample-trees.mjs --town=walden --conc=6"
step rounds node build-rounds-data.mjs
step mail node build-mail-sidecar.mjs walden
echo "$(date +%H:%M:%S) all done"

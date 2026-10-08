#!/bin/bash
# Roof material for TraverseRoofing's Colorado Springs-area towns (2026-10-08). El Paso's assessor gives no roof material, so the
# photo classifier does (roofs/material/README.md): NAIP 2023 crops per house, roof features, then predict with the model already
# trained on Douglas County's recorded materials. The crops download now; features and predict wait for run-fixup-2026-10-08-e.sh
# to finish its shared builds, because they read roof-<town>.json and year-<town>.json. Progress in logs-2026-10-07/_material.out.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
PY="/c/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe"
TOWNS="cs-northeast cs-southeast security-widefield fountain"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/mat-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/mat-$name.log" | cut -c1-140)"; }
echo "$(date '+%Y-%m-%d %H:%M:%S') roof material"
for t in $TOWNS; do step "crops-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t"; done
echo "$(date +%H:%M:%S) crops done; waiting for the fix-up's shared builds"
until grep -q "SHARED BUILDS DONE" "$L/_fixup-e.out" 2>/dev/null; do sleep 60; done
step features bash -c "cd roofs/material && \"$PY\" features.py $TOWNS"
step predict bash -c "cd roofs/material && \"$PY\" predict.py $TOWNS"   # without towns it does only the original eleven
echo "$(date +%H:%M:%S) MATERIAL DONE"

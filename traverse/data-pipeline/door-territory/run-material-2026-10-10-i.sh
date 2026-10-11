#!/bin/bash
# Roof material for the five Front Range Roofing towns (2026-10-10 overnight): after the crops (run by the h step) finish,
# roof features from each crop, then the model's prediction where the county records no material.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07
PY="/c/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe"
TOWNS="thornton commerce-city erie centennial denver"
until grep -q "CROPS DONE" "$L/_crops-h.out" 2>/dev/null; do sleep 120; done
echo "$(date +%H:%M:%S) crops done"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/mat-i-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/mat-i-$name.log" | cut -c1-160)"; }
step features bash -c "cd roofs/material && \"$PY\" features.py $TOWNS"
step predict  bash -c "cd roofs/material && \"$PY\" predict.py $TOWNS"
echo "$(date +%H:%M:%S) MATERIAL I DONE"

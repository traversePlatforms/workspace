#!/bin/bash
# El Paso towns for the editions (2026-10-07): Colorado Springs split at -104.76 (the east side is where the hail falls: 22-24 days
# of 1 in+ hail since Oct 2021 between -104.76 and -104.65, against 3-9 west of -104.85), Security-Widefield and Fountain.
# Lots from 0.04 acre: any house has a roof and a door (single-family houses only).
set -u
cd "$(dirname "$0")"
run() { echo "== $1"; shift; timeout 3000 node build-walklist-ep.mjs "$@" --min-acres=0.04 2>&1 | grep -E "dropped|doors to knock|boundary"; }
run cs-east --lat=38.88 --lon=-104.68 --radius=9 --municipality="Colorado Springs" --min-lon=-104.76 --city="COLORADO SPRINGS" --out=cs-east.csv
run cs-west --lat=38.88 --lon=-104.84 --radius=9 --municipality="Colorado Springs" --max-lon=-104.76 --city="COLORADO SPRINGS" --out=cs-west.csv
echo done

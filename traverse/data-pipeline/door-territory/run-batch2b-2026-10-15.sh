#!/bin/bash
# Batch 2, restarted (2026-10-15), after the overnight run (logs-overnight/done.flag): one job at a time against the state's parcel service.
#  1. Trees for the ten towns added overnight.
#  2. The rest of the 365 area: Broomfield, Northglenn, Federal Heights, Brighton, Louisville, Lafayette, Superior, Longmont
#     (door lists by legal boundary, neighbourhoods, lawns, office-lookup lists, trees).
#  3. County values for all eighteen new towns and the Centennial top-up (sample-value --only).
#  4. Rebuild. Uploading is done by hand (Sixfold's live town list keeps admin-only towns; town groups switched on in company.json).
# A log per step in logs-batch2/. Run from this folder.
set -u
cd "$(dirname "$0")"
L=logs-batch2; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
# 2026-10-15 restart: wait for the Greenwood Village tree run left going from the first try, then redo the big towns whose tree step failed (the parcel fetch is now tiled)
while tasklist //FI "PID eq 3712" 2>/dev/null | grep -q node.exe; do sleep 60; done
NEW1="littleton lakewood greenwood-village cherry-hills-village sheridan lone-tree wheat-ridge edgewater golden westminster denver arvada boulder"
for t in $NEW1; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
pull() { node build-walklist-co.mjs --county=$1 --lat=$2 --lon=$3 --radius=$4 --min-acres=0.12 --municipality="$5" --out="$6"; }
newtown() { local t=$1; shift; step "pull-$t" bash -c "$*"; [ -s "$t.csv" ] || return
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "lookup-$t" node build-lookup.mjs "$t"
  step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; }
newtown broomfield "$(declare -f pull); pull BROOMFIELD 39.94 -105.06 6 Broomfield broomfield.csv"
newtown northglenn "$(declare -f pull); pull ADAMS 39.90 -104.98 3 Northglenn northglenn.csv"
newtown federal-heights "$(declare -f pull); pull ADAMS 39.865 -105.015 2 'Federal Heights' federal-heights.csv"
newtown brighton "$(declare -f pull); pull ADAMS 39.97 -104.80 5 Brighton brighton-adams.csv; pull WELD 40.02 -104.80 3 Brighton brighton-weld.csv; node merge-walklists.mjs brighton.csv \$(ls brighton-adams.csv brighton-weld.csv 2>/dev/null)"
newtown louisville "$(declare -f pull); pull BOULDER 39.975 -105.14 3 Louisville louisville.csv"
newtown lafayette "$(declare -f pull); pull BOULDER 39.995 -105.10 3 Lafayette lafayette.csv"
newtown superior "$(declare -f pull); pull BOULDER 39.93 -105.16 2 Superior superior.csv"
newtown longmont "$(declare -f pull); pull BOULDER 40.17 -105.11 6 Longmont longmont-boulder.csv; pull WELD 40.17 -105.03 3 Longmont longmont-weld.csv; node merge-walklists.mjs longmont.csv \$(ls longmont-boulder.csv longmont-weld.csv 2>/dev/null)"
step values node sample-value.mjs --only=centennial,littleton,lakewood,greenwood-village,cherry-hills-village,sheridan,lone-tree,wheat-ridge,edgewater,golden,westminster,northglenn,federal-heights,brighton,louisville,lafayette,superior,longmont
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

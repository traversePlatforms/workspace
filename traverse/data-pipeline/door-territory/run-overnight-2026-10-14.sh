#!/bin/bash
# Overnight 2026-10-14 (Matthew: "run the towns we need"). One job at a time against the state's parcel service (2026-10-11 rule).
#  1. Centennial: top up from the full-boundary pull (homes like 7110 S Franklin Way were missing), measure the new ones.
#  2. The missing towns around Englewood: door lists by legal boundary, neighbourhoods, lawn sizes, office-lookup lists.
#     (Not yet in the app: they still need wiring into build-rounds-data, values, HOA, trees and Sixfold's town list, done by hand after.)
#  3. Lawn sizes for the rented homes (office lookup) in the metro towns already in the app.
#  4. Trees for Denver, Arvada and Boulder (the scan covers them; they were never added).
#  5. Rebuild the app's data. Uploading is done by hand (Sixfold's live town list keeps admin-only towns).
# A log per step in logs-overnight/. Run from this folder.
set -u
cd "$(dirname "$0")"
L=logs-overnight; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
# wait for the Centennial pull (started by hand) and anything else on the parcel service
while powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'build-walklist-co|sample-lawn|sample-trees' }).Count" | grep -qv '^0'; do sleep 30; done

# 1. Centennial
if [ -s centennial-full.csv ]; then
  step cent-supplement node build-supplement.mjs centennial
  step cent-lawn bash -c "cd lawn-trial && node sample-lawn.mjs --town=centennial --conc=16"
  step cent-compact bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=centennial --conc=12"
  step cent-trees bash -c "cd tree-zones && node sample-trees.mjs --town=centennial --conc=6"
fi

# 2. New towns (legal boundary; min lot 0.12 acres like the other door lists)
pull() { node build-walklist-co.mjs --county=$1 --lat=$2 --lon=$3 --radius=$4 --min-acres=0.12 --municipality="$5" --out="$6"; }
newtown() { local t=$1; shift; step "pull-$t" bash -c "$*"; [ -s "$t.csv" ] || return
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "lookup-$t" node build-lookup.mjs "$t"; }
newtown littleton "$(declare -f pull); pull ARAPAHOE 39.605 -105.00 4 Littleton littleton-arapahoe.csv ; pull JEFFERSON 39.60 -105.06 3 Littleton littleton-jeff.csv; pull DOUGLAS 39.56 -105.02 2 Littleton littleton-douglas.csv; node merge-walklists.mjs littleton.csv \$(ls littleton-arapahoe.csv littleton-jeff.csv littleton-douglas.csv 2>/dev/null)"
newtown lakewood "$(declare -f pull); pull JEFFERSON 39.705 -105.10 7 Lakewood lakewood.csv"
newtown greenwood-village "$(declare -f pull); pull ARAPAHOE 39.615 -104.92 3 'Greenwood Village' greenwood-village.csv"
newtown cherry-hills-village "$(declare -f pull); pull ARAPAHOE 39.640 -104.955 2 'Cherry Hills Village' cherry-hills-village.csv"
newtown sheridan "$(declare -f pull); pull ARAPAHOE 39.647 -105.025 2 Sheridan sheridan.csv"
newtown lone-tree "$(declare -f pull); pull DOUGLAS 39.540 -104.885 3 'Lone Tree' lone-tree.csv"
newtown wheat-ridge "$(declare -f pull); pull JEFFERSON 39.770 -105.10 3 'Wheat Ridge' wheat-ridge.csv"
newtown edgewater "$(declare -f pull); pull JEFFERSON 39.753 -105.064 1 Edgewater edgewater.csv"
newtown golden "$(declare -f pull); pull JEFFERSON 39.745 -105.21 4 Golden golden.csv"
newtown westminster "$(declare -f pull); pull ADAMS 39.865 -105.02 5 Westminster westminster-adams.csv ; pull JEFFERSON 39.880 -105.10 4 Westminster westminster-jeff.csv; node merge-walklists.mjs westminster.csv \$(ls westminster-adams.csv westminster-jeff.csv 2>/dev/null)"

# 3. Rented homes' lawns in the towns already in the app (the office lookup)
for t in centennial englewood south-denver highlands-ranch aurora denver arvada thornton commerce-city parker erie castle-pines castle-rock boulder; do
  step "lawn-$t-lookup" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t-lookup --conc=16"
done

# 4. Trees for the three 365 towns that had none
for t in denver arvada boulder; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done

# 5. Rebuild
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

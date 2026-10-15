#!/bin/bash
# Batch 3 (2026-10-15, Matthew: "add Ken Caryl and Columbine"), after batch 2 (logs-batch2/done.flag): one job at a time against the
# state's parcel service. Both are unincorporated Jefferson County, so no town boundary: the Census boundary (TIGERweb CDP, saved as
# ken-caryl-cdp.json / columbine-cdp.json) does the same job. Door lists, neighbourhoods, lawns, office-lookup lists, trees, county
# values, then the rebuild. Uploading is by hand (keep admin-only towns; add both to Sixfold's townGroups).
set -u
cd "$(dirname "$0")"
L=logs-batch3; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
until [ -f logs-batch2/done.flag ]; do sleep 60; done
newtown() { local t=$1 lat=$2 lon=$3 r=$4
  step "pull-$t" node build-walklist-co.mjs --county=JEFFERSON --lat=$lat --lon=$lon --radius=$r --min-acres=0.12 --pieces=$t-cdp.json --out=$t.csv
  [ -s "$t.csv" ] || return
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "lookup-$t" node build-lookup.mjs "$t"
  step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; }
newtown ken-caryl 39.5796 -105.1201 3
newtown columbine 39.582 -105.0646 2.5
step values node sample-value.mjs --only=ken-caryl,columbine
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

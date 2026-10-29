#!/bin/bash
# Group 3, stage A on the cloud machine (2026-10-29; Matthew: "if the cloud computer is done with its jobs we need to put it on
# something else"): the door lists for the rest of Colorado in GROUP3-PLAN-2026-10-29.md. For each target in targets.json, in order
# (counties biggest gap first, places then rural sweeps): pull the parcels (method "co": the statewide layer with
# build-walklist-co.mjs; method "ap": build-walklist-ap.mjs, which takes the property address from the state's address points by
# parcel number), keep the ones inside the Census boundary that are not doors already (clip-group3.mjs), one target at a time (one
# parcel-heavy job at a time on gis.colorado.gov). Resumable: a finished target has out/<key>.csv and <key>.done.
# Stops at "door lists ready" + g3a.vmdone: registering the towns, lawn/trees/yard/roofs and any upload follow Matthew's look at
# the counts. NOT in run-cloud-finishers.sh: stage B needs his go.
# Start: nohup bash ~/run/group3/run-group3.sh > ~/run-group3.log 2>&1 &     status: ~/run-status.txt     counts: out/summary.tsv
set -u
G="$HOME/run/group3"; cd "$G" || exit 1; mkdir -p raw out
st() { echo "$(date -u +%FT%TZ) group3 A: $*" | tee "$HOME/run-status.txt"; }
# never two parcel pulls at once: wait while another runner is still pulling (anchored, see run-group2.sh)
while pgrep -f "^node [^ ]*build-walklist|^bash [^ ]*(run-group1|run-group2|queue2)\.sh" > /dev/null; do st "waiting: another parcel job is running"; sleep 600; done
st "starting (door lists)"
node -e "for (const t of require('./targets.json')) console.log([t.key, t.method, t.county, t.countyUpper, t.lat, t.lon, t.radius].join('\t'))" > queue.tsv
n=0; total=$(wc -l < queue.tsv)
while IFS=$'\t' read -r key method county countyUpper lat lon radius; do
  n=$((n+1))
  [ -f "$key.done" ] && continue
  [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED at $key: under 5 GB free"; exit 1; }
  for try in 1 2 3; do
    st "pull $key ($n/$total, $county, $method, r $radius mi), try $try"
    if [ "$method" = co ]; then
      node build-walklist-co.mjs --county="$countyUpper" --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --pieces="pieces-$key.json" --out="raw/$key.csv" > "raw/$key.log" 2>&1
    elif [ "$method" = ap ]; then
      node build-walklist-ap.mjs --county="$county" --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --pieces="pieces-$key.json" --out="raw/$key.csv" > "raw/$key.log" 2>&1
    else
      echo "$key: unknown method $method"; break
    fi
    rc=$?; if [ $rc -eq 0 ] && [ -s "raw/$key.csv" ]; then node clip-group3.mjs "$key" "raw/$key.csv" && touch "$key.done" && break; fi
    echo "$(date -u +%T) $key pull exit $rc (try $try)"; tail -3 "raw/$key.log"; sleep 120
  done
done < queue.tsv
# counts for the review (summary-g3.mjs): key, county, method, Census houses, owner-occupied (Census), rows, owner lives here,
# local PO box
node summary-g3.mjs
missing=$(grep -c MISSING out/summary.tsv)
if [ "$missing" -gt 0 ]; then st "ended with $missing targets MISSING: see ~/run-group3.log and ~/run/group3/out/summary.tsv"; exit 1; fi
touch "$G/g3a.vmdone"
st "door lists ready in ~/run/group3/out (waiting for Matthew's review; counts in out/summary.tsv)"; echo "stage A done"

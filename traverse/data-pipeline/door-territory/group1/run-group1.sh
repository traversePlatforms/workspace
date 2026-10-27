#!/bin/bash
# Group 1, stage A on the cloud machine (2026-10-26, Matthew: "que up group 1"): the door lists for the places and rural areas in
# GROUP1-PLAN-2026-10-26.md. Waits until the trade-layer run says "every town done" (it is not interrupted), then for each target in
# targets.json: pull the parcels (the statewide layer, or El Paso's own for El Paso), keep the ones inside the Census boundary that are
# not doors already (clip-group1.mjs), one target at a time (one parcel-heavy job at a time). Resumable: a finished target has
# out/<key>.csv and <key>.done. Stops at "door lists ready": the next stages (register the towns, lawn/trees/yard/roofs, upload) follow
# a look at the counts. Start: nohup bash ~/run/group1/run-group1.sh > ~/run-group1.log 2>&1 &     status: ~/run-status.txt
set -u
G="$HOME/run/group1"; cd "$G" || exit 1; mkdir -p raw out
st() { echo "$(date -u +%FT%TZ) group1: $*" | tee "$HOME/run-status.txt"; }
until grep -q "layers: every town done" "$HOME/run-status.txt" 2>/dev/null; do sleep 600; done
st "starting stage A (door lists)"
node -e "for (const t of require('./targets.json')) console.log([t.key, t.method, t.countyUpper, t.lat, t.lon, t.radius].join('\t'))" > queue.tsv
while IFS=$'\t' read -r key method county lat lon radius; do
  [ -f "$key.done" ] && continue
  [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED at $key: under 5 GB free"; exit 1; }
  for try in 1 2 3; do
    st "pull $key ($method, r $radius mi), try $try"
    if [ "$method" = co ]; then
      node build-walklist-co.mjs --county="$county" --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --pieces="pieces-$key.json" --out="raw/$key.csv" > "raw/$key.log" 2>&1
    else
      node build-walklist.mjs --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --out="raw/$key.csv" > "raw/$key.log" 2>&1
    fi
    rc=$?; if [ $rc -eq 0 ] && [ -s "raw/$key.csv" ]; then node clip-group1.mjs "$key" "raw/$key.csv" && touch "$key.done" && break; fi
    echo "$(date -u +%T) $key pull exit $rc (try $try)"; sleep 120
  done
done < queue.tsv
st "stage A done: door lists ready in ~/run/group1/out (waiting for review)"; echo "stage A done"

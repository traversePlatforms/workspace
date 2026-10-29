#!/bin/bash
# Group 3 stage B, the measuring on the cloud machine (2026-10-29). READY, NOT STARTED: Matthew sees the counts first (out/summary.tsv,
# out/summary-3b.tsv, and `node prep-stageb.mjs <DT> <RD> --dry` for the counts under the stage B rules). NOT in run-cloud-finishers.sh.
# Copy on the VM: ~/run/group3/stageb.sh. Modelled on group2/stageb-vm.sh.
#   0. waits for Group 3 stage A, the Teller sweep and Group 3b (g3a.vmdone, g3b.vmdone, no Group 3 runner left);
#   1. prep-stageb.mjs: the stage B rules (local PO box = lives here; no-owner-name rows kept; 3b rows kept with their "limited" mark;
#      rows that are doors of ours within 150 m dropped; Cripple Creek, Idaho Springs and the Teller sweep's Woodland Park / Florissant /
#      Divide rows split off to merge into our towns) -> b/<key>.csv, b/merge-<town>.csv, b/registered.json, b/b-towns.txt;
#   2. per new town: the neighbourhood file (build-walklist-pdf --no-pdf) and the slim door file (mkdoors.mjs); per merged town the
#      new rows' neighbourhoods only (merge-<town>-areas.json; the laptop appends them to the town, merge-into-town.mjs);
#   3. the building-outline tiles the new towns need (fetch-buildings.mjs, only tiles not on disk);
#   4. per new town: yard v2, trees (laser where Teller's survey covers the house, else the canopy map), roof size and pitch and solar
#      (Teller only: no laser survey for the other Group 3 counties in the cloud copy, as Mesa in Group 2);
#   5. appraised values (sample-value.mjs) for the towns on the statewide parcel layer (co / ap counties; not the address-point towns);
#   6. roof and house files, then per town the roof material scan and the close-up photo index (as Group 2).
# The doors merged into our towns get their lawn and roof layers when those towns are next measured (the coordinate-keyed caches fill
# trees and values at the laptop's build). Resumable (b-<key>.<step>.done), stops under 5 GB free. Status ~/run-status.txt, log
# ~/run-g3b.log. Ends at "group3 B: measuring done" + ~/run/group3/g3stageb.vmdone; then the laptop runs finish-g3b-2026-10-29.sh.
# Start (after Matthew's go): nohup bash ~/run/group3/stageb.sh > ~/run-g3b.log 2>&1 &
set -u
T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; G="$HOME/run/group3"; LT="$HOME/run/lawn-trial"; PY="$HOME/pyenv/bin/python"
LIDAR="$HOME/run/tree-zones/lidar-cache"; M="$DT/roofs/material"
st() { echo "$(date -u +%FT%TZ) group3 B: $*" | tee "$HOME/run-status.txt"; }
prune() { while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break; printf '%s\n' "$old" | xargs -r rm -f; done; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED, under 5 GB free"; exit 1; }; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do prune; room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
county() { node -e "const t=require('$G/b/registered.json').find((x)=>x.key===process.argv[1]);console.log(t?t.county:'')" "$1"; }
method() { node -e "const T=[...require('$G/targets.json'),...require('$G/targets-3b.json')];const t=T.find((x)=>x.key===process.argv[1]);console.log(t?t.method:'')" "$1"; }
## 0. wait for stage A (Group 3, the Teller sweep, Group 3b)
echo "$(date -u +%T) waiting for Group 3 stage A and 3b"
until [ -f "$G/g3a.vmdone" ] && [ -f "$G/g3b.vmdone" ] && ! pgrep -f "^bash [^ ]*(run-group3|run-group3b|queue-after-g3a)\.sh" > /dev/null; do sleep 300; done
## 1. prep
if [ ! -f "$G/b-prep.done" ]; then
  st "stage B rules (prep-stageb.mjs)"
  (cd "$G" && node --max-old-space-size=8192 prep-stageb.mjs "$DT" "$RD") && touch "$G/b-prep.done" || { st "STOPPED: prep-stageb.mjs failed"; exit 1; }
fi
mkdir -p "$LT/data"
## 2. door lists -> neighbourhoods and slim door files; merged towns: the new rows' neighbourhoods only
while read -r key; do
  [ -z "$key" ] || [ -f "$G/b-$key.areas.done" ] && continue
  st "areas $key"
  cp "$G/b/$key.csv" "$DT/$key.csv" && (cd "$DT" && node build-walklist-pdf.mjs "$key.csv" --no-pdf) && node "$HOME/run/group1/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "$G/b-$key.areas.done"
done < "$G/b/b-towns.txt"
while read -r town; do
  [ -z "$town" ] || [ -f "$G/b-merge-$town.done" ] && continue
  st "areas for the doors joining $town"
  cp "$G/b/merge-$town.csv" "$DT/merge-$town.csv" && (cd "$DT" && node build-walklist-pdf.mjs "merge-$town.csv" --no-pdf) && touch "$G/b-merge-$town.done"
done < "$G/b/merge-towns.txt"
## 3. building outlines
if [ ! -f "$G/b-buildings.done" ]; then
  st "building outline tiles"
  CORNERS=$(node "$HOME/run/group2/corner-tiles.mjs" "$DT/tree-zones" $(for k in $(cat "$G/b/b-towns.txt"); do [ -f "$RD/$k.json" ] && echo "$RD/$k.json"; done))
  tries "buildings" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch "$G/b-buildings.done"
fi
## 4. measuring
for step in yard trees roof solar; do
  while read -r key; do
    [ -z "$key" ] || [ ! -f "$G/b-$key.areas.done" ] || [ -f "$G/b-$key.$step.done" ] && continue
    if [ "$step" = roof ] || [ "$step" = solar ]; then [ "$(county "$key")" = Teller ] || { touch "$G/b-$key.$step.done"; continue; }; fi
    st "$step $key"
    case $step in
      yard)  for t in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "$G/b-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$G/b-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.solar.done" ;;
    esac
  done < "$G/b/b-towns.txt"
done
## 5. values: towns on the statewide parcel layer only (one parcel-heavy job: nothing else pulls parcels while this runs)
if [ ! -f "$G/b-values.done" ]; then
  st "values"
  ONLY=$(for k in $(cat "$G/b/b-towns.txt"); do m=$(method "$k"); [ "$m" = co ] || [ "$m" = ap ] && echo "$k"; done | paste -sd, -)
  if [ -n "$ONLY" ]; then tries "values" bash -c "cd '$DT' && node sample-value.mjs --only='$ONLY'" && touch "$G/b-values.done"; else touch "$G/b-values.done"; fi
fi
## 6. roof material + close-up photos
if [ ! -f "$G/b-mat.build.done" ]; then st "roof and house files"; (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch "$G/b-mat.build.done"; fi
while read -r town; do
  [ -z "$town" ] || [ -f "$G/b-$town.mat.done" ] || [ ! -f "$RD/$town.json" ] && continue
  st "material: $town"
  tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || continue
  tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
  (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "$G/b-$town.mat.done"; }
done < "$G/b/b-towns.txt"
(cd "$M" && node build-naip-photos.mjs $(cat "$G/b/b-towns.txt"))
touch "$G/g3stageb.vmdone"
st "measuring done: the laptop copies back with finish-g3b-2026-10-29.sh"; echo "group3 stage B measuring done"

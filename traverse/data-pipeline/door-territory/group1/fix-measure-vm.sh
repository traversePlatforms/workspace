#!/bin/bash
# Group 1 re-clip, the measuring on the cloud machine (2026-10-28, Matthew: "Go ahead and re-run the group 1 de-dup with the correct
# method"). The corrected door lists went live from the laptop the same day with every layer the laptop can build (census, FEMA, pest,
# others, year built, photo index); the doors the old 20 m rule had dropped still lack the layers measured here. Copy on the VM:
# ~/run/group1/fix-measure.sh, towns in ~/run/group1/fix-towns.txt, the laptop's <key>-areas.json already in $DT (same door ids).
#   1. waits until the Group 2 stage A run is over (one parcel-heavy job at a time on gis.colorado.gov: yard v2, trees and roofs fetch
#      lot lines from it);
#   2. per town: the slim door file from <key>-areas.json, yard v2, trees near the house, roof size and pitch, solar facts; each step
#      skips the doors it already measured (caches by point; yard v2 by door id);
#   3. roof and house files from the roof cache, then the roof material scan for those towns (houses --redo, crops, features, model;
#      crops deleted after each town) and the close-up photo index.
# Resumable (fix-<key>.<step>.done), stops under 5 GB free. Status ~/run-status.txt, log ~/run-g1fix.log. Ends at
# "group1 fix: measuring done"; the laptop's overnight check then runs finish-g1fix-2026-10-28.sh (copy back, build, upload).
# Start: nohup bash ~/run/group1/fix-measure.sh > ~/run-g1fix.log 2>&1 &
set -u
T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; G="$HOME/run/group1"; LT="$HOME/run/lawn-trial"; PY="$HOME/pyenv/bin/python"
LIDAR="$HOME/run/tree-zones/lidar-cache"; M="$DT/roofs/material"
G2NOTE="(Group 2 stage A is over: door lists in ~/run/group2/out, counts in out/summary.tsv, log ~/run-group2.log)"
st() { echo "$(date -u +%FT%TZ) group1 fix: $* $G2NOTE" | tee "$HOME/run-status.txt"; }
prune() { while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break; printf '%s\n' "$old" | xargs -r rm -f; done; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED, under 5 GB free"; exit 1; }; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do prune; room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
## 1. wait for Group 2 stage A to be over (its own status line, and no run-group2.sh left running)
echo "$(date -u +%T) waiting for Group 2 stage A"
until grep -qE "group2: stage A (done|ended)" "$HOME/run-status.txt" 2>/dev/null && ! pgrep -f "^bash [^ ]*run-group2\.sh" > /dev/null; do sleep 300; done
G2LINE=$(cat "$HOME/run-status.txt"); echo "$(date -u +%T) Group 2 said: $G2LINE"; G2NOTE="(Group 2 said: ${G2LINE#* })"
mkdir -p "$LT/data"
## 2. per town
while read -r key; do
  [ -z "$key" ] && continue
  if [ ! -f "$G/fix-$key.doors.done" ]; then node "$G/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "$G/fix-$key.doors.done"; fi
done < "$G/fix-towns.txt"
for step in yard trees roof solar; do
  while read -r key; do
    [ -z "$key" ] || [ ! -f "$G/fix-$key.doors.done" ] || [ -f "$G/fix-$key.$step.done" ] && continue
    st "$step $key"
    case $step in
      yard)  for t in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "$G/fix-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$G/fix-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/fix-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/fix-$key.solar.done" ;;
    esac
  done < "$G/fix-towns.txt"
done
## 3. roof material for the same towns
if [ ! -f "$G/fix-mat.build.done" ]; then st "roof and house files"; (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch "$G/fix-mat.build.done"; fi
while read -r town; do
  [ -z "$town" ] || [ -f "$G/fix-$town.mat.done" ] || [ ! -f "$RD/$town.json" ] && continue
  st "material: $town"
  tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town' --redo" || continue
  tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
  (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "$G/fix-$town.mat.done"; }
done < "$G/fix-towns.txt"
(cd "$M" && node build-naip-photos.mjs $(cat "$G/fix-towns.txt"))
touch "$G/g1fix.vmdone"   # the laptop's finisher also looks for this, in case a later job has overwritten ~/run-status.txt
st "measuring done: the laptop copies back with finish-g1fix-2026-10-28.sh"; echo "fix measuring done"

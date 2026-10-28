#!/bin/bash
# Group 2 stage B, the measuring on the cloud machine (2026-10-28, Matthew after seeing the counts: "we are almost at a million properties
# so i wanna hit it"). Copy on the VM: ~/run/group2/stageb.sh, beside targets.json, out/ (stage A's door lists) and prep-stageb.mjs.
#   0. waits until the Group 1 fix measuring is over (~/run/group1/g1fix.vmdone and no fix-measure.sh left running): one parcel-heavy
#      job at a time on gis.colorado.gov;
#   1. prep-stageb.mjs: registered.json + b-towns.txt (every target with doors except g2-berthoud, merged into g1-berthoud and live),
#      the towns' laser keys added to tree-zones/town-surveys-extra.json (larimer / pueblo / mesa, see tree-zones/lidar.mjs PROJECT);
#   2. per town: the neighbourhood file (build-walklist-pdf --no-pdf) and the slim door file with the door build's ids (mkdoors.mjs);
#   3. the Microsoft building-outline tiles for the new counties (fetch-buildings.mjs, only the tiles not on disk);
#   4. per town: yard v2, trees near the house (laser where a survey covers the house, else the canopy map), roof size and pitch and
#      solar facts (Larimer and Pueblo only: Mesa has no laser survey in the cloud copy);
#   5. appraised values for the Mesa and Pueblo towns (sample-value.mjs; the state layer has none for Larimer);
#   6. roof and house files, then per town the roof material scan (houses, NAIP crops, features, model; crops deleted after each town)
#      and the close-up photo index (naip-<town>.json).
# Resumable (b-<key>.<step>.done), stops under 5 GB free. Status ~/run-status.txt, log ~/run-g2b.log. Ends at "group2 B: measuring done"
# and leaves ~/run/group2/g2b.vmdone; the laptop's overnight check then runs finish-g2b-2026-10-28.sh (copy back, register, build, upload).
# Start: nohup bash ~/run/group2/stageb.sh > ~/run-g2b.log 2>&1 &
set -u
T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; G="$HOME/run/group2"; LT="$HOME/run/lawn-trial"; PY="$HOME/pyenv/bin/python"
LIDAR="$HOME/run/tree-zones/lidar-cache"; M="$DT/roofs/material"
st() { echo "$(date -u +%FT%TZ) group2 B: $*" | tee "$HOME/run-status.txt"; }
prune() { while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break; printf '%s\n' "$old" | xargs -r rm -f; done; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED, under 5 GB free"; exit 1; }; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do prune; room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
county() { node -e "const t=require('$G/registered.json').find((x)=>x.key===process.argv[1]);console.log(t?t.county:'')" "$1"; }
## 0. wait for the Group 1 fix measuring
echo "$(date -u +%T) waiting for the Group 1 fix measuring"
until [ -f "$HOME/run/group1/g1fix.vmdone" ] && ! pgrep -f "^bash [^ ]*fix-measure\.sh" > /dev/null; do sleep 300; done
## 1. prep
st "preparing towns"
node "$G/prep-stageb.mjs" "$DT" || { st "STOPPED: prep-stageb.mjs failed"; exit 1; }
mkdir -p "$LT/data"
## 2. door lists -> neighbourhoods and slim door files
while read -r key; do
  [ -z "$key" ] || [ -f "$G/b-$key.areas.done" ] && continue
  st "areas $key"
  cp "$G/out/$key.csv" "$DT/$key.csv" && (cd "$DT" && node build-walklist-pdf.mjs "$key.csv" --no-pdf) && node "$HOME/run/group1/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "$G/b-$key.areas.done"
done < "$G/b-towns.txt"
## 3. building outlines
if [ ! -f "$G/b-buildings.done" ]; then
  st "building outline tiles"
  CORNERS=$(node "$G/corner-tiles.mjs" "$DT/tree-zones" $(for k in $(cat "$G/b-towns.txt"); do [ -f "$RD/$k.json" ] && echo "$RD/$k.json"; done))
  echo "$(date -u +%T) corner tiles: $CORNERS"
  tries "buildings" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch "$G/b-buildings.done"
fi
## 4. measuring
for step in yard trees roof solar; do
  while read -r key; do
    [ -z "$key" ] || [ ! -f "$G/b-$key.areas.done" ] || [ -f "$G/b-$key.$step.done" ] && continue
    if [ "$step" = roof ] || [ "$step" = solar ]; then [ "$(county "$key")" = Mesa ] && { touch "$G/b-$key.$step.done"; continue; }; fi
    st "$step $key"
    case $step in
      yard)  for t in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "$G/b-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$G/b-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.solar.done" ;;
    esac
  done < "$G/b-towns.txt"
done
## 5. values (Mesa, Pueblo)
if [ ! -f "$G/b-values.done" ]; then
  st "values"
  ONLY=$(node -e "console.log(require('$G/registered.json').filter((t)=>t.county==='Mesa'||t.county==='Pueblo').map((t)=>t.key).join(','))")
  tries "values" bash -c "cd '$DT' && node sample-value.mjs --only='$ONLY'" && touch "$G/b-values.done"
fi
## 6. roof material + close-up photos
if [ ! -f "$G/b-mat.build.done" ]; then st "roof and house files"; (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch "$G/b-mat.build.done"; fi
while read -r town; do
  [ -z "$town" ] || [ -f "$G/b-$town.mat.done" ] || [ ! -f "$RD/$town.json" ] && continue
  st "material: $town"
  tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || continue
  tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
  (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "$G/b-$town.mat.done"; }
done < "$G/b-towns.txt"
(cd "$M" && node build-naip-photos.mjs $(cat "$G/b-towns.txt"))
touch "$G/g2b.vmdone"   # the laptop's finisher also looks for this, in case a later job has overwritten ~/run-status.txt
st "measuring done: the laptop copies back with finish-g2b-2026-10-28.sh"; echo "group2 stage B measuring done"

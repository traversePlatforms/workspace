#!/bin/bash
# Gap plan 2026-11-08: the measuring for a gap batch on the cloud machine (stage B), modelled on group3/stageb-vm.sh. MEASURING ONLY:
# it builds door lists and readings in the VM's own copy; nothing leaves the machine. The laptop finisher (gap1108/finish-gap-2026-11-08.sh)
# is NOT in run-cloud-finishers.sh and refuses to run without its go file, so no batch goes live before Matthew has seen its counts.
#   bash gapb-vm.sh <batch dir> <batch name>        e.g. ~/run/gap1108/ep ep   (fill1031 stages epb, g3pob)
# The batch dir comes from a stage A script (build-walklist-epc.mjs, g3-localpo.mjs): <key>.csv per new town, merge-<town>.csv per town of
# ours that gets doors, b-towns.txt, merge-towns.txt, registered.json ({ key, label, lat, lon, county }), limited-<key>.json.
#   1. laser keys for the new towns into tree-zones/town-surveys-extra.json (added, never replaced: El Paso -> elpaso, else the county);
#   2. per new town: neighbourhoods (build-walklist-pdf --no-pdf: "YES" rows only, organisation owners and repeats out) and the slim door
#      file (group1/mkdoors.mjs); per town of ours: the added doors' neighbourhoods, as gapadd-<batch>-<town>-areas.json (the laptop
#      appends them with group3/merge-into-town.mjs; existing doors untouched);
#   3. the building-outline tiles the new towns need;
#   4. per new town: yard v2, trees, and roof + solar where a laser survey covers the county (El Paso; elsewhere none in the cloud copy);
#   5. roof and house files, roof material and close-up photo index per new town (as Groups 2 and 3).
# Values come at the laptop build (El Paso from the assessor file by parcel number; the rest from value-cache via sample-value.mjs).
# The added doors in our towns get trees/values from the coordinate caches at the build; their lawn comes when the town is next measured.
# Resumable (<batch dir>/s-<key>.<step>.done), stops under 5 GB free. Ends with <batch dir>/gapb.vmdone.
set -u
BD=${1:?batch dir}; NAME=${2:?batch name}
. "$HOME/run/fill1031/lib.sh"
cd "$BD" || exit 1
[ -s b-towns.txt ] || [ -s merge-towns.txt ] || { st "gapb $NAME: nothing to measure"; touch gapb.vmdone; exit 0; }
mkdir -p "$LT/data"
county() { node -e "const t=require('$BD/registered.json').find((x)=>x.key===process.argv[1]);console.log(t?t.county:'')" "$1"; }
## 1. laser keys
node -e "
const fs=require('fs');const f='$DT/tree-zones/town-surveys-extra.json';const L=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};let n=0;
for(const t of require('$BD/registered.json')){if(t.key in L)continue;L[t.key]=t.county==='El Paso'?'elpaso':t.county.toLowerCase().replace(/[^a-z]/g,'');n++}
fs.writeFileSync(f,JSON.stringify(L));console.log('laser keys added',n)" || exit 1
## 2. neighbourhoods
while read -r key; do
  [ -z "$key" ] || [ -f "s-$key.areas.done" ] && continue
  st "gapb $NAME: areas $key"
  cp "$key.csv" "$DT/$key.csv" && (cd "$DT" && node build-walklist-pdf.mjs "$key.csv" --no-pdf) && node "$HOME/run/group1/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "s-$key.areas.done"
done < b-towns.txt
while read -r town; do
  [ -z "$town" ] || [ -f "s-merge-$town.done" ] && continue
  st "gapb $NAME: areas for the doors joining $town"
  cp "merge-$town.csv" "$DT/gapadd-$NAME-$town.csv" && (cd "$DT" && node build-walklist-pdf.mjs "gapadd-$NAME-$town.csv" --no-pdf) && touch "s-merge-$town.done"
done < merge-towns.txt
## 3. building outlines
if [ -s b-towns.txt ] && [ ! -f s-buildings.done ]; then
  st "gapb $NAME: building outline tiles"
  CORNERS=$(node "$HOME/run/group2/corner-tiles.mjs" "$DT/tree-zones" $(for k in $(cat b-towns.txt); do [ -f "$RD/$k.json" ] && echo "$RD/$k.json"; done))
  tries "buildings" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch s-buildings.done
fi
## 4. measuring
for step in yard trees roof solar; do
  while read -r key; do
    [ -z "$key" ] || [ ! -f "s-$key.areas.done" ] || [ -f "s-$key.$step.done" ] && continue
    if [ "$step" = roof ] || [ "$step" = solar ]; then [ "$(county "$key")" = "El Paso" ] || [ "$(county "$key")" = Teller ] || { touch "s-$key.$step.done"; continue; }; fi
    st "gapb $NAME: $step $key"
    case $step in
      yard)  for i in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "s-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "s-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "s-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "s-$key.solar.done" ;;
    esac
  done < b-towns.txt
done
## 5. roof material + close-up photos
if [ -s b-towns.txt ]; then
  [ -f s-mat.build.done ] || { st "gapb $NAME: roof and house files"; (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch s-mat.build.done; }
  while read -r town; do
    [ -z "$town" ] || [ -f "s-$town.mat.done" ] || [ ! -f "$RD/$town.json" ] && continue
    st "gapb $NAME: material $town"
    tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || continue
    tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
    (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "s-$town.mat.done"; }
  done < b-towns.txt
  (cd "$M" && node build-naip-photos.mjs $(cat b-towns.txt))
fi
touch gapb.vmdone
st "gapb $NAME: measuring done (laptop: gap1108/finish-gap-2026-11-08.sh $NAME, only after Matthew's go)"

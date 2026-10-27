#!/bin/bash
# The cloud machine's overnight queue after Group 1 stage A (2026-10-26, Matthew: "go ahead and start stage b once the others finish.
# you can que the roof material scan as well."). Unattended, resumable (a step that finished leaves a .done file), one job at a time,
# laser cache cut back to 25 GB, stops under 5 GB free. Status: ~/run-status.txt, log ~/run-queue2.log.
#   1. waits for "stage A done";
#   2. Group 1 stage B, per target with a door list: the neighbourhood file (build-walklist-pdf --no-pdf), a slim door file with the
#      door build's ids, yard v2, trees near the house, roof size and pitch, solar facts;
#   3. the roof material scan for every town that lacks it (the editions' 73 new towns + Group 1): roof and house files from the merged
#      roof caches, then per town the house centre, the NAIP crops, the features and the model's call (Python), crops deleted after
#      each town; then the close-up photo index (naip-<town>.json).
# Start: nohup bash ~/run/group1/queue2.sh > ~/run-queue2.log 2>&1 &
set -u
T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; G="$HOME/run/group1"; LT="$HOME/run/lawn-trial"; PY="$HOME/pyenv/bin/python"
LIDAR="$HOME/run/tree-zones/lidar-cache"
st() { echo "$(date -u +%FT%TZ) $*" | tee "$HOME/run-status.txt"; }
prune() { while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break; printf '%s\n' "$old" | xargs -r rm -f; done; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "queue2: STOPPED, under 5 GB free"; exit 1; }; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do prune; room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
until grep -q "stage A done" "$HOME/run-status.txt" 2>/dev/null; do sleep 600; done
mkdir -p "$LT/data"
## 2. stage B
st "group1 B: preparing towns"
cd "$G" && node -e "
const fs=require('fs');const T=require('./targets.json');const S={'Jefferson':'drcog2','Adams':'drcog2','Arapahoe':'drcog2','Denver':'drcog2','Broomfield':'drcog2','Boulder':'drcog1','Weld':'eastern-b1','El Paso':'elpaso','Douglas':'douglas'};
const ok=T.filter(t=>fs.existsSync('out/'+t.key+'.csv')&&fs.readFileSync('out/'+t.key+'.csv','utf8').split('\n').filter(l=>/^\"YES\"/.test(l)).length>0);
fs.writeFileSync('$DT/tree-zones/town-surveys-extra.json',JSON.stringify(Object.fromEntries(ok.map(t=>[t.key,S[t.county]]))));
fs.writeFileSync('registered.json',JSON.stringify(ok.map(t=>({key:t.key,label:t.label,lat:t.lat,lon:t.lon,county:t.county})),null,1));
fs.writeFileSync('b-towns.txt',ok.map(t=>t.key).join('\n')+'\n');console.log(ok.length,'towns with doors')"
while read -r key; do
  [ -z "$key" ] && continue
  if [ ! -f "$G/b-$key.areas.done" ]; then
    cp "$G/out/$key.csv" "$DT/$key.csv" && (cd "$DT" && node build-walklist-pdf.mjs "$key.csv" --no-pdf) && node "$G/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "$G/b-$key.areas.done"
  fi
done < "$G/b-towns.txt"
for step in yard trees roof solar; do
  while read -r key; do
    [ -z "$key" ] || [ ! -f "$G/b-$key.areas.done" ] || [ -f "$G/b-$key.$step.done" ] && continue
    st "group1 B: $step $key"
    case $step in
      yard)  for t in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "$G/b-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$G/b-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$G/b-$key.solar.done" ;;
    esac
  done < "$G/b-towns.txt"
done
st "group1 B: measuring done (copy back and register on the laptop: finish-group1-2026-10-26.sh)"
## 3. roof material scan
M="$DT/roofs/material"
if [ ! -f "$G/mat.build.done" ]; then
  node -e "
const fs=require('fs');for(const [a,b] of [['$HOME/run/layers/door-territory/roofs/roof-cache.json','$DT/roofs/roof-cache.json'],['$HOME/run/layers/door-territory/solar/solar-cache.json','$DT/solar/solar-cache.json']]){
 const L=fs.existsSync(b)?JSON.parse(fs.readFileSync(b)):{};const C=fs.existsSync(a)?JSON.parse(fs.readFileSync(a)):{};let n=0;for(const [k,v] of Object.entries(C))if(!L[k]||(L[k].err&&!v.err)){L[k]=v;n++}fs.writeFileSync(b,JSON.stringify(L));console.log(b,'+',n)}"
  (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch "$G/mat.build.done"
fi
cat "$G/mat-towns.txt" "$G/b-towns.txt" 2>/dev/null | sort -u > "$G/mat-all.txt"
while read -r town; do
  [ -z "$town" ] || [ -f "$G/mat-$town.done" ] || [ ! -f "$RD/$town.json" ] && continue
  st "material: $town"
  tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || continue
  tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
  (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "$G/mat-$town.done"; }
done < "$G/mat-all.txt"
(cd "$M" && node build-naip-photos.mjs $(cat "$G/mat-all.txt"))
st "material done: copy back with finish-material-2026-10-26.sh"; echo "queue2 done"

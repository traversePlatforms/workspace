#!/bin/bash
# The every-home measuring on THIS LAPTOP (15 Nov 2026, Matthew: the quarterly refresh runs here, "so no cloud machine is needed after
# 22 Nov"). ehb-vm.sh's steps with the laptop's own paths; used by every1115/refresh-quarterly.sh.
#   bash every1115/ehb-laptop.sh <run dir>     (from door-territory; <run dir>/lists from make-lists-vm.mjs)
# Exit 4 = stopped for the network (iPhone hotspot or no internet): run again later, finished steps are kept (<lists>/s-<key>.<step>.done).
# Differences from the cloud run: slim door files go to <run dir>/doors, and are copied into app/data/rounds only while a tree / roof / sun
# pass reads them, then removed (they are never in index.json, so no upload sees them); yard readings land straight in lawn-trial/yard-v2
# and the coordinate caches are this laptop's own (nothing to merge); no roof-material pass (its Python models live on the cloud copy):
# material comes at the towns' next material pass.
set -u
E=${1:?run dir}; W="$E/lists"; cd "$(dirname "$0")/.." || exit 1
DT=$(pwd); RD=../../app/data/rounds; LT="$DT/lawn-trial"; mkdir -p "$E/doors"
st() { echo "$(date '+%F %T') $*"; }
net() { case "$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')" in *iPhone*|*iphone*) st "on the iPhone hotspot: stopping (exit 4)"; exit 4;; esac
        curl -s -m 20 -o /dev/null https://gis.colorado.gov/ || { st "no internet: stopping (exit 4)"; exit 4; }; }
tries() { local n=$1 i; shift; for i in 1 2 3; do "$@" && return 0; st "$n failed (try $i)"; net; sleep 60; done; return 1; }
[ "$(df -Pm /c | awk 'NR==2{print int($4/1024)}')" -ge 20 ] || { st "under 20 GB free on C:"; exit 1; }
LIST="$W/keys.tsv"
{ for f in "$W"/add/*-add1115-areas.json; do [ -f "$f" ] || continue; t=$(basename "$f" -add1115-areas.json); printf '%s-add1115\tadd\t%s\t\n' "$t" "$t"; done
  node -e "for(const t of require(process.argv[1]))console.log([t.key,'new',t.key,t.county].join('\t'))" "$(cygpath -m "$W/new/registered.json")"; } > "$LIST"
st "ehb (laptop): $(wc -l < "$LIST") lists"
node --input-type=module -e "
import { SURVEY } from './tree-zones/town-surveys.mjs';
import fs from 'node:fs';
const f='tree-zones/town-surveys-extra.json';const L=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};let n=0;
for(const line of fs.readFileSync(process.argv[1],'utf8').trim().split('\n')){const [k,kind,t,c]=line.split('\t');if(!k||k in L)continue;
  const s=kind==='add'?(SURVEY[t]||L[t]):(c==='El Paso'?'elpaso':String(c).toLowerCase().replace(/[^a-z]/g,''));if(s){L[k]=s;n++}}
fs.writeFileSync(f,JSON.stringify(L));console.log('laser keys added',n)" "$(cygpath -m "$LIST")" || exit 1
haslaser() { node --input-type=module -e "import { SURVEY } from './tree-zones/town-surveys.mjs'; import { PROJECT } from './tree-zones/lidar.mjs'; import fs from 'node:fs'; const L=JSON.parse(fs.readFileSync('tree-zones/town-surveys-extra.json')); process.exit(PROJECT[SURVEY[process.argv[1]]||L[process.argv[1]]] ? 0 : 1)" "$1"; }
## door files
while IFS=$'\t' read -r -u 3 key kind town county; do
  [ -f "$W/s-$key.doors.done" ] && continue
  if [ "$kind" = add ]; then node group1/mkdoors.mjs "$W/add/$town-add1115-areas.json" "$E/doors/$key.json" && touch "$W/s-$key.doors.done"
  else cp "$W/new/$key.csv" "$key.csv" && node build-walklist-pdf.mjs "$key.csv" --no-pdf --include-business > /dev/null && node group1/mkdoors.mjs "$key-areas.json" "$E/doors/$key.json" && touch "$W/s-$key.doors.done"; fi
done 3< "$LIST"
## building outlines
if [ ! -f "$W/s-buildings.done" ]; then net; st "building outline tiles"
  CORNERS=$(node group2/corner-tiles.mjs tree-zones $(cut -f1 "$LIST" | while read -r k; do [ -f "$E/doors/$k.json" ] && echo "$E/doors/$k.json"; done))
  tries buildings bash -c "cd tree-zones && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch "$W/s-buildings.done"; fi
## measuring (one parcel-heavy job at a time: this script is the only one running)
for step in yard trees roof solar; do
  while IFS=$'\t' read -r -u 3 key kind town county; do
    [ -f "$W/s-$key.doors.done" ] || continue; [ -f "$W/s-$key.$step.done" ] && continue
    if [ "$step" = roof ] || [ "$step" = solar ]; then haslaser "$key" || { touch "$W/s-$key.$step.done"; continue; }; fi
    net; st "$step $key"
    case $step in
      yard)  for i in $(seq 1 20); do (cd "$LT" && YV2_DATA="$(cygpath -m "$E/doors")" node yard-v2-town.mjs --town="$key" --mins=60 --conc=16); rc=$?; [ $rc -eq 0 ] && { touch "$W/s-$key.yard.done"; break; }; [ $rc -eq 3 ] || { net; sleep 60; }; done ;;
      trees|roof|solar)
        cp "$E/doors/$key.json" "$RD/$key.json"
        case $step in
          trees) tries "trees $key" bash -c "cd tree-zones && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$W/s-$key.trees.done" ;;
          roof)  tries "roof $key" bash -c "cd roofs && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$W/s-$key.roof.done" ;;
          solar) tries "solar $key" bash -c "cd solar && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$W/s-$key.solar.done" ;;
        esac
        node -e "const k=process.argv[1];if(JSON.parse(require('fs').readFileSync('$RD/index.json')).regions.some(r=>r.key===k))process.exit(1)" "$key" && rm -f "$RD/$key.json" ;;
    esac
  done 3< "$LIST"
done
## values (state parcel layer; El Paso from the assessor file at the build)
if [ ! -f "$W/s-values.done" ]; then net; st "values"
  for k in $(cut -f1 "$LIST"); do cp "$E/doors/$k.json" "$RD/$k.json"; done
  tries values node sample-value.mjs --only="$(cut -f1 "$LIST" | paste -sd, -)" && touch "$W/s-values.done"
  for k in $(cut -f1 "$LIST"); do node -e "const k=process.argv[1];if(JSON.parse(require('fs').readFileSync('$RD/index.json')).regions.some(r=>r.key===k))process.exit(1)" "$k" && rm -f "$RD/$k.json"; done; fi
touch "$E/ehb.done"; st "ehb (laptop): measuring done"

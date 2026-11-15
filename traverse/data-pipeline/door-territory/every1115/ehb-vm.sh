#!/bin/bash
# Stage ehb (fill1031, 15 Nov 2026; EVERY-HOME-2026-11-15.md): measuring for the every-home batch before it joins the lists. MEASURING
# ONLY: nothing leaves the machine; the laptop finisher is every1115/finish-every-2026-11-15.sh. Lists from make-lists-vm.mjs in
# ~/run/every1115/lists:
#   add/<town>-add1115-areas.json  homes joining a town of ours: measured as key <town>-add1115 (rentb-vm.sh's way: slim door file,
#                                  yard v2, trees, roof + sun where the town's laser survey covers, values)
#   new/<key>.csv                  new towns (gapb-vm.sh's way: neighbourhoods with build-walklist-pdf --include-business, so landlords'
#                                  LLCs stay; yard v2, trees, roof + sun where a laser survey covers, values, roof material + photos)
#   add/<town>-bld1115-areas.json  buildings: not measured (no lawn, trees or roof pass for an apartment block)
# Resumable (lists/s-<key>.<step>.done), stops under 5 GB free. Ends with ~/run/every1115/ehb.vmdone.
. "$HOME/run/fill1031/lib.sh"
E="$HOME/run/every1115"; W="$E/lists"; cd "$W" || exit 1; mkdir -p "$LT/data"; room
LIST="$W/keys.tsv"   # key <tab> kind (add|new) <tab> town <tab> county
{ for f in add/*-add1115-areas.json; do [ -f "$f" ] || continue; t=$(basename "$f" -add1115-areas.json); printf '%s-add1115\tadd\t%s\t\n' "$t" "$t"; done
  node -e "for(const t of require('$W/new/registered.json'))console.log([t.key,'new',t.key,t.county].join('\t'))"; } > "$LIST"
st "ehb: $(wc -l < "$LIST") lists"
## 1. laser keys: an add list gets its town's survey; a new town its county's
node --input-type=module -e "
import { SURVEY } from '$DT/tree-zones/town-surveys.mjs';
import fs from 'node:fs';
const f='$DT/tree-zones/town-surveys-extra.json';const L=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};let n=0;
for(const line of fs.readFileSync('$LIST','utf8').trim().split('\n')){const [k,kind,t,c]=line.split('\t');if(k in L)continue;
  const s=kind==='add'?(SURVEY[t]||L[t]):(c==='El Paso'?'elpaso':c.toLowerCase().replace(/[^a-z]/g,''));if(s){L[k]=s;n++}}
fs.writeFileSync(f,JSON.stringify(L));console.log('laser keys added',n)" || exit 1
haslaser() { node --input-type=module -e "import { SURVEY } from '$DT/tree-zones/town-surveys.mjs'; import { PROJECT } from '$DT/tree-zones/lidar.mjs'; import fs from 'node:fs'; const L=JSON.parse(fs.readFileSync('$DT/tree-zones/town-surveys-extra.json')); process.exit(PROJECT[SURVEY[process.argv[1]]||L[process.argv[1]]] ? 0 : 1)" "$1"; }
## 2. door files
while IFS=$'\t' read -r -u 3 key kind town county; do
  [ -f "s-$key.doors.done" ] && continue
  if [ "$kind" = add ]; then
    node "$HOME/run/group1/mkdoors.mjs" "add/$town-add1115-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "s-$key.doors.done"
  else
    st "ehb: neighbourhoods $key"
    cp "new/$key.csv" "$DT/$key.csv" && (cd "$DT" && node build-walklist-pdf.mjs "$key.csv" --no-pdf --include-business) && node "$HOME/run/group1/mkdoors.mjs" "$DT/$key-areas.json" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "s-$key.doors.done"
  fi
done 3< "$LIST"
## 3. building outline tiles at the lists' corners
if [ ! -f s-buildings.done ]; then
  st "ehb: building outline tiles"
  CORNERS=$(node "$HOME/run/group2/corner-tiles.mjs" "$DT/tree-zones" $(cut -f1 "$LIST" | while read -r k; do [ -f "$RD/$k.json" ] && echo "$RD/$k.json"; done))
  tries "buildings" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch s-buildings.done
fi
## 4. measuring
for step in yard trees roof solar; do
  while IFS=$'\t' read -r -u 3 key kind town county; do
    [ -f "s-$key.doors.done" ] || continue; [ -f "s-$key.$step.done" ] && continue
    if [ "$step" = roof ] || [ "$step" = solar ]; then haslaser "$key" || { touch "s-$key.$step.done"; continue; }; fi
    st "ehb: $step $key"
    case $step in
      yard)  for i in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "s-$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "s-$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "s-$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "s-$key.solar.done" ;;
    esac
  done 3< "$LIST"
done
## 5. appraised values (state parcel layer, keyed by the point; El Paso's come from the assessor file at the laptop build)
if [ ! -f s-values.done ]; then
  ONLY=$(cut -f1 "$LIST" | paste -sd, -)
  st "ehb: values"
  [ -n "$ONLY" ] && tries "values" bash -c "cd '$DT' && node sample-value.mjs --only='$ONLY'" && touch s-values.done
fi
## 6. roof material + close-up photos for the new towns (an add list's come at its town's next material pass: keyed by door id)
NEWK=$(awk -F'\t' '$2=="new"{print $1}' "$LIST")
if [ -n "$NEWK" ]; then
  [ -f s-mat.build.done ] || { st "ehb: roof and house files"; (cd "$DT/roofs" && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) && touch s-mat.build.done; }
  for town in $NEWK; do
    [ -f "s-$town.mat.done" ] || [ ! -f "$RD/$town.json" ] && continue
    st "ehb: material $town"
    tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || continue
    tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
    (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "$M/cache/crops/$town"; touch "s-$town.mat.done"; }
  done
  (cd "$M" && node build-naip-photos.mjs $NEWK)
fi
touch "$E/ehb.vmdone"
st "ehb: measuring done (laptop: every1115/finish-every-2026-11-15.sh)"

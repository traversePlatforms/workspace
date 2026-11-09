#!/bin/bash
# Stage rentb (fill1031, 8 Nov; OWNER-FIELD-SPEC.md, GAP-PLAN-2026-11-08.md "rented doors"). Measures the homes whose owner lives elsewhere
# before they become doors, so they arrive with the same layers as every door. MEASURING ONLY: nothing leaves the machine; the laptop
# build promotes them only once gap1108/GO-rented exists, and the copy-back is gap1108/finish-rent-2026-11-08.sh (held the same way).
#   batch 1, ~/run/gap1108/rent/<town>-lookup2-areas.json (Groups 1-3 + El Paso batch, rent-lists-vm.mjs): yard v2, trees, roof + sun
#   batch 2, ~/run/gap1108/rent-core/<town>-lookup-areas.json (the core towns' office-lookup homes, from the laptop): yard v2, roof + sun
#            (their trees, old lawn and values are already in the coordinate caches)
# Each list is measured as its own town key, <town>-lookup2 / <town>-lookup (slim door file in the cloud copy, ids as group1/mkdoors.mjs
# gives them), with the town's own laser survey; roof and sun only where that survey exists (lidar.mjs PROJECT). Tree, roof and sun
# readings are keyed by the house's point, so the laptop build finds them for the promoted doors; yard v2 is read under the town key.
# Roof material and the close-up photo index are keyed by door id: they come at each town's next material pass after promotion.
# Resumable (~/run/gap1108/rentb/<key>.<step>.done), stops under 5 GB free. Ends with ~/run/gap1108/rentb.vmdone.
. "$HOME/run/fill1031/lib.sh"
G="$HOME/run/gap1108"; W="$G/rentb"; mkdir -p "$W" "$LT/data"; room
LIST="$W/keys.tsv"
# key <tab> source file <tab> town <tab> does trees
{ for f in "$G"/rent/*-lookup2-areas.json; do [ -f "$f" ] || continue; t=$(basename "$f" -lookup2-areas.json); printf '%s-lookup2\t%s\t%s\t1\n' "$t" "$f" "$t"; done
  for f in "$G"/rent-core/*-lookup-areas.json; do [ -f "$f" ] || continue; t=$(basename "$f" -lookup-areas.json); printf '%s-lookup\t%s\t%s\t0\n' "$t" "$f" "$t"; done; } > "$LIST"
st "rentb: $(wc -l < "$LIST") lists"
# laser keys: the list gets its town's survey
node --input-type=module -e "
import { SURVEY } from '$DT/tree-zones/town-surveys.mjs';
import fs from 'node:fs';
const f='$DT/tree-zones/town-surveys-extra.json';const L=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};let n=0;
for(const line of fs.readFileSync('$LIST','utf8').trim().split('\n')){const [k,,t]=line.split('\t');if(k in L)continue;const s=SURVEY[t]||L[t];if(s){L[k]=s;n++}}
fs.writeFileSync(f,JSON.stringify(L));console.log('laser keys added',n)" || exit 1
haslaser() { node --input-type=module -e "import { SURVEY } from '$DT/tree-zones/town-surveys.mjs'; import { PROJECT } from '$DT/tree-zones/lidar.mjs'; process.exit(PROJECT[SURVEY[process.argv[1]]] ? 0 : 1)" "$1"; }
# slim door files
while IFS=$'\t' read -r -u 3 key src town trees; do
  [ -f "$W/$key.doors.done" ] && continue
  node "$HOME/run/group1/mkdoors.mjs" "$src" "$RD/$key.json" && cp "$RD/$key.json" "$LT/data/$key.json" && touch "$W/$key.doors.done"
done 3< "$LIST"
# building outlines for the new lists' corners
if [ ! -f "$W/buildings.done" ]; then
  st "rentb: building outline tiles"
  CORNERS=$(node "$HOME/run/group2/corner-tiles.mjs" "$DT/tree-zones" $(cut -f1 "$LIST" | while read -r k; do [ -f "$RD/$k.json" ] && echo "$RD/$k.json"; done))
  tries "buildings" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=8192 fetch-buildings.mjs $CORNERS" && touch "$W/buildings.done"
fi
for step in yard trees roof solar; do
  while IFS=$'\t' read -r -u 3 key src town trees; do
    [ -f "$W/$key.doors.done" ] || continue; [ -f "$W/$key.$step.done" ] && continue
    if [ "$step" = trees ] && [ "$trees" = 0 ]; then touch "$W/$key.$step.done"; continue; fi
    if [ "$step" = roof ] || [ "$step" = solar ]; then haslaser "$key" || { touch "$W/$key.$step.done"; continue; }; fi
    st "rentb: $step $key"
    case $step in
      yard)  for i in $(seq 1 40); do prune; room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$key" --mins=60 --conc=32); rc=$?; [ $rc -eq 0 ] && { touch "$W/$key.yard.done"; break; }; [ $rc -eq 3 ] || sleep 60; done ;;
      trees) tries "trees $key" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$key' --conc=12" && touch "$W/$key.trees.done" ;;
      roof)  tries "roof $key" bash -c "cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$W/$key.roof.done" ;;
      solar) tries "solar $key" bash -c "cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$key' --conc=12" && touch "$W/$key.solar.done" ;;
    esac
  done 3< "$LIST"
done
# appraised values for batch 1 (state parcel layer, keyed by the point; El Paso's come from the assessor file at the laptop build)
if [ ! -f "$W/values.done" ]; then
  ONLY=$(awk -F'\t' '$4==1{print $1}' "$LIST" | paste -sd, -)
  st "rentb: values"
  [ -n "$ONLY" ] && tries "values" bash -c "cd '$DT' && node sample-value.mjs --only='$ONLY'" && touch "$W/values.done"
fi
touch "$G/rentb.vmdone"
st "rentb: measuring done (laptop: gap1108/finish-rent-2026-11-08.sh, only after Matthew's go)"

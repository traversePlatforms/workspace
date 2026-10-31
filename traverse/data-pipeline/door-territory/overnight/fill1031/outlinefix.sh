#!/bin/bash
# Stage outlinefix (fill1031, priority d/e: trees, and roofs and sun where there is a survey). 43,025 doors in 41 towns read "no house
# outline" for most of their doors (Pueblo 10,986, Pueblo West 10,321, Wellington 3,221, Sterling Ranch 2,049, Johnstown 1,177,
# Breckenridge 1,177, Berthoud 1,070, Silverthorne 984, Timnath 845, ...): the Overture tiles on this machine were cut on 26 Oct to the
# towns of that day and later towns found them "on disk" (outline-ms.mjs). The whole Microsoft tiles go into tree-zones/buildings-ms;
# the "no house outline" roof, sun and tree readings of these towns are taken out and measured again with them.
# gis.colorado.gov: lots per town, the only parcel job running. Leaves outlinefix-ok.txt for finish-outlinefix-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/outlinefix-towns.txt")
put_cache roof-cache.json "$DT/roofs/roof-cache.json" || exit 1
put_cache solar-cache.json "$DT/solar/solar-cache.json" || exit 1
put_cache tree-cache.json "$DT/tree-cache.json" || exit 1
put_areas $TOWNS
if [ ! -f "$Q/outlinefix.prepped" ]; then
  files=""; for t in $TOWNS; do [ -f "$Q/doors/$t.json" ] && files="$files $Q/doors/$t.json"; done
  tries outline-ms node "$Q/outline-ms.mjs" "$DT/tree-zones" "$DT/tree-zones/buildings-ms" $files || exit 1
  for c in roofs/roof-cache.json solar/solar-cache.json tree-cache.json; do node "$Q/cache-prep.mjs" --cache="$DT/$c" --areas="$DT" --towns="$Q/outlinefix-towns.txt" --err='^no house outline$' || exit 1; done
  touch "$Q/outlinefix.prepped"
fi
bad=0
for t in $TOWNS; do
  for pass in roof solar trees; do
    [ -f "$Q/outlinefix-$t.$pass.done" ] && continue
    st "outlinefix: $pass $t"
    case $pass in
      roof)  cmd="cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings-ms --town='$t' --conc=12" ;;
      solar) cmd="cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings-ms --town='$t' --conc=12" ;;
      trees) cmd="cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$t' --buildings=buildings-ms --conc=12" ;;
    esac
    tries "$pass $t" bash -c "$cmd" && touch "$Q/outlinefix-$t.$pass.done" || bad=$((bad + 1))
  done
done
for t in $TOWNS; do [ -f "$Q/outlinefix-$t.roof.done" ] && [ -f "$Q/outlinefix-$t.solar.done" ] && [ -f "$Q/outlinefix-$t.trees.done" ] && echo "$t"; done > "$Q/outlinefix-ok.txt"
echo "outlinefix: $(wc -l < "$Q/outlinefix-ok.txt") towns finished, $bad steps failed"
[ "$(wc -l < "$Q/outlinefix-ok.txt")" -gt 0 ]

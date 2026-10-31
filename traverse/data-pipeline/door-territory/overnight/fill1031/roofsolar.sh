#!/bin/bash
# Stage roofsolar (fill1031, priority b and c: roofs, then sun). Roof size/pitch and the sun estimate for the doors in laser-survey towns
# that were never measured (added to a town after its roof run): Denver 71,705 roof doors (its sun is done), Centennial 12,657, Castle
# Rock 12,413, Arvada 6,886, Highlands Ranch 6,854, Parker 4,829, Thornton 4,552, ... 18 towns, ~126,000 roof and ~52,000 sun doors;
# plus Colorado Springs northeast, whose roof run lost its lot download (8,467 "no parcel at the point" that the sun run does not
# have): those readings are taken out and measured again.
# The laptop sent its merged roof-cache.json and solar-cache.json (in/), the towns' door lists (areas/) and house lists (doors/). Same
# scripts as the 26 Oct layers run (USGS 3DEP laser, public domain; Overture/Microsoft building outlines). gis.colorado.gov: lots per
# town, the only parcel job running. Leaves roofsolar-ok.txt for finish-roofsolar-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/roofsolar-towns.txt")
put_cache roof-cache.json "$DT/roofs/roof-cache.json" || exit 1
put_cache solar-cache.json "$DT/solar/solar-cache.json" || exit 1
put_areas $TOWNS
if [ ! -f "$Q/roofsolar.prepped" ]; then
  node "$Q/cache-prep.mjs" --cache="$DT/roofs/roof-cache.json" --areas="$DT" --towns="$Q/roofsolar-fixparcel.txt" --err='^no parcel at the point$' || exit 1
  tries outlines outlines $TOWNS || exit 1
  touch "$Q/roofsolar.prepped"
fi
bad=0
for pass in roof solar; do
  for t in $TOWNS; do
    [ -f "$Q/roofsolar-$t.$pass.done" ] && continue
    st "roofsolar: $pass $t"
    if [ $pass = roof ]; then dir=roofs; js=sample-roofs.mjs; else dir=solar; js=sample-solar.mjs; fi
    tries "$pass $t" bash -c "cd '$DT/$dir' && node --max-old-space-size=6144 $js --all-towns --buildings=buildings --town='$t' --conc=12" && touch "$Q/roofsolar-$t.$pass.done" || bad=$((bad + 1))
  done
done
for t in $TOWNS; do [ -f "$Q/roofsolar-$t.roof.done" ] && [ -f "$Q/roofsolar-$t.solar.done" ] && echo "$t"; done > "$Q/roofsolar-ok.txt"
echo "roofsolar: $(wc -l < "$Q/roofsolar-ok.txt") towns finished, $bad steps failed"
[ "$(wc -l < "$Q/roofsolar-ok.txt")" -gt 0 ]

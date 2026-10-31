#!/bin/bash
# Stage trees2 (fill1031, priority d: trees). Trees near the house for the doors no tree run ever measured (added after their town's run):
# 14,861 doors in 46 towns (Longmont 3,882, Boulder 2,265, Erie 1,891, Brighton 1,239, Windsor 671, ...). sample-trees.mjs skips every
# door it already has, so only those are measured: USGS 3DEP laser where the town has a survey, the canopy map elsewhere.
# gis.colorado.gov: lots per town, the only parcel job running. Leaves trees2-ok.txt for finish-trees2-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/trees2-towns.txt")
put_cache tree-cache.json "$DT/tree-cache.json" || exit 1
put_areas $TOWNS
[ -f "$Q/trees2.prepped" ] || { tries outlines outlines $TOWNS && touch "$Q/trees2.prepped"; } || exit 1
bad=0
for t in $TOWNS; do
  [ -f "$Q/trees2-$t.done" ] && continue
  st "trees2: $t"
  tries "trees $t" bash -c "cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$t' --conc=12" && touch "$Q/trees2-$t.done" || bad=$((bad + 1))
done
for t in $TOWNS; do [ -f "$Q/trees2-$t.done" ] && echo "$t"; done > "$Q/trees2-ok.txt"
echo "trees2: $(wc -l < "$Q/trees2-ok.txt") towns finished, $bad failed"
[ "$(wc -l < "$Q/trees2-ok.txt")" -gt 0 ]

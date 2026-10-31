#!/bin/bash
# Stage dougmat (fill1031, priority b: roof material). Douglas County's assessor records carry the roof material (year-<town>.json `mat`,
# already used for Castle Rock, Larkspur, Sedalia, Franktown, Lone Tree), but Highlands Ranch (25,135 records), Parker (23,513) and
# Castle Pines (6,689) never got a material file, and Castle Rock's covers 7,076 of 19,531 doors (built before its all-sizes rebuild).
# Same steps as the overnight g2mat stage: houses.mjs (lot + outline, gis.colorado.gov: the only parcel job running), NAIP 2023 crops
# (Planetary Computer, public domain), features, predict (the county record where Douglas has one; the photo model's call elsewhere at
# the usual 90% bar), crops deleted. The laptop sent dougmat-in/: slim house lists (id, lat, lon), year- and roof- files, and the LiDAR
# house centres (roofs/houses-<town>.json). Leaves dougmat-ok.txt for finish-dougmat-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/dougmat-towns.txt")
if [ ! -f "$Q/dougmat.prepped" ]; then
  mkdir -p "$B/rounds" "$B/houses"
  for t in $TOWNS; do
    for f in "$t.json" "year-$t.json" "roof-$t.json" "material-$t.json"; do [ -f "$RD/$f" ] && [ ! -f "$B/rounds/$f" ] && cp "$RD/$f" "$B/rounds/"; done
    [ -f "$DT/roofs/houses-$t.json" ] && [ ! -f "$B/houses/houses-$t.json" ] && cp "$DT/roofs/houses-$t.json" "$B/houses/"
    cp "$Q/doors/$t.json" "$RD/$t.json" || exit 1
    for f in "year-$t.json" "roof-$t.json"; do [ -f "$Q/dougmat-in/$f" ] && cp "$Q/dougmat-in/$f" "$RD/$f"; done
    [ -f "$Q/dougmat-in/houses-$t.json" ] && cp "$Q/dougmat-in/houses-$t.json" "$DT/roofs/houses-$t.json"
  done
  tries outlines outlines $TOWNS || exit 1
  touch "$Q/dougmat.prepped"
fi
bad=0
for t in $TOWNS; do
  [ -f "$Q/dougmat-$t.done" ] && continue
  st "dougmat: $t"
  tries "houses $t" bash -c "cd '$M' && node houses.mjs --town='$t' --redo" || { bad=$((bad + 1)); continue; }
  tries "crops $t" bash -c "cd '$M' && node fetch.mjs --town='$t' --conc=12" || { bad=$((bad + 1)); continue; }
  if (cd "$M" && "$PY" features.py --force "$t" && "$PY" predict.py "$t"); then rm -rf "${M:?}/cache/crops/${t:?}"; touch "$Q/dougmat-$t.done"; else echo "dougmat: $t failed"; bad=$((bad + 1)); fi
done
for t in $TOWNS; do [ -f "$Q/dougmat-$t.done" ] && echo "$t"; done > "$Q/dougmat-ok.txt"
echo "dougmat: $(wc -l < "$Q/dougmat-ok.txt") towns finished, $bad failed"
[ "$(wc -l < "$Q/dougmat-ok.txt")" -gt 0 ]

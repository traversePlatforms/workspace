#!/bin/bash
# Stage matnew (fill1031, added 18 Nov 2026): the roof-material pass for the every-home doors (EVERY-HOME-2026-11-15.md, "still to do by
# hand"; ehb-vm.sh: "an add list's come at its town's next material pass: keyed by door id"). The laptop sent ~/run/fill1031/matnew-in.tgz
# (every1115/prep-matnew-2026-11-18.sh; ids, points, year built / county roof records and LiDAR roof figures only: no owners) with plan.tsv:
#   <town>-nd1118  add  <town>  n   the doors the every-home batch added to a town of ours whose own pass had year built + LiDAR (the photo
#                                   model needs both): houses.mjs (lot + outline; gis.colorado.gov, the only parcel job running), NAIP 2023
#                                   crops (Planetary Computer), features, predict, close-up index; crops deleted after
#   <new town>     new  <town>  n   a new town measured in ehb before its year file existed (predict then wrote no county records and no
#                                   photo calls): features.py --struct (re-fills the county and LiDAR columns of its csv), predict again
# Leaves matnew-result.tgz (material-<key>.json, naip-<key>.json) for every1115/finish-matnew-2026-11-18.sh, which merges them into the
# towns' files (an existing door's entry is never replaced). Resumable: matnew-<key>.done.
. "$HOME/run/fill1031/lib.sh"
I="$Q/matnew-in"; TAG=$(cat "$Q/matnew-tag.txt" 2>/dev/null)
[ -s "$Q/matnew-in.tgz" ] && [ -n "$TAG" ] || { st "matnew: nothing from the laptop (matnew-in.tgz, matnew-tag.txt)"; exit 1; }
room
if [ "$(cat "$Q/matnew.prepped" 2>/dev/null)" != "$TAG" ]; then
  rm -rf "$I" && mkdir -p "$I" && tar xzf "$Q/matnew-in.tgz" -C "$I" || exit 1
  mkdir -p "$B/matnew/rounds" "$B/matnew/houses"
  for f in "$I"/rounds/*.json; do n=$(basename "$f"); [ -f "$RD/$n" ] && [ ! -f "$B/matnew/rounds/$n" ] && cp "$RD/$n" "$B/matnew/rounds/"; cp "$f" "$RD/$n" || exit 1; done
  for f in "$I"/houses/*.json; do [ -f "$f" ] || continue; n=$(basename "$f"); [ -f "$DT/roofs/$n" ] && [ ! -f "$B/matnew/houses/$n" ] && cp "$DT/roofs/$n" "$B/matnew/houses/"; cp "$f" "$DT/roofs/$n" || exit 1; done
  rm -f "$Q"/matnew-*.done "$Q/matnew-result.tgz" "$Q/matnew-ok.txt"
  echo "$TAG" > "$Q/matnew.prepped"
fi
bad=0
while IFS=$'\t' read -r -u 3 key kind town n; do
  [ -n "$key" ] && [ "$key" != key ] || continue
  [ -f "$Q/matnew-$key.done" ] && continue
  st "matnew: $kind $key ($n doors)"
  if [ "$kind" = add ]; then
    tries "houses $key" bash -c "cd '$M' && node houses.mjs --town='$key' --redo" || { bad=$((bad + 1)); continue; }
    tries "crops $key" bash -c "cd '$M' && node fetch.mjs --town='$key' --conc=12" || { bad=$((bad + 1)); continue; }
    if (cd "$M" && "$PY" features.py --force "$key" && "$PY" predict.py "$key" && node build-naip-photos.mjs "$key"); then rm -rf "${M:?}/cache/crops/${key:?}"; touch "$Q/matnew-$key.done"; else echo "matnew: $key failed"; bad=$((bad + 1)); fi
  else
    if (cd "$M" && "$PY" features.py --struct "$key" && "$PY" predict.py "$key"); then touch "$Q/matnew-$key.done"; else echo "matnew: $key failed"; bad=$((bad + 1)); fi
  fi
done 3< "$I/plan.tsv"
: > "$Q/matnew-ok.txt"; files=""
while IFS=$'\t' read -r key kind town n; do
  [ -f "$Q/matnew-$key.done" ] || continue; echo "$key" >> "$Q/matnew-ok.txt"
  for f in "material-$key.json" "naip-$key.json"; do [ -f "$RD/$f" ] && files="$files $f"; done
done < "$I/plan.tsv"
[ -n "$files" ] || { st "matnew: no key finished ($bad failed)"; exit 1; }
(cd "$RD" && tar czf "$Q/matnew-result.tgz" $files) || exit 1
echo "$TAG" > "$Q/matnew-result.tag"
st "matnew: done, $(wc -l < "$Q/matnew-ok.txt") keys finished, $bad failed (laptop: every1115/finish-matnew-2026-11-18.sh)"

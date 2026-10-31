#!/bin/bash
# Stage lawnfix (fill1031, priority a: the lawn push). Yard v2 again where coverage-audit-2026-10-31.md shows lawn faults:
#   - doors that read "no lot" in towns on the state parcel layer (6,025 doors in 190 towns; the address-point counties of Group 3b,
#     which have no parcels at all, are left out), measured again with their lot cells asked for afresh (lawnfix-prep.mjs);
#   - doors added to a town after its yard v2 run (2,577: South Denver 1,939, Idaho Springs 403, Woodland Park 208, ...).
# The laptop sent: lawnfix-towns.txt, lawnfix-data/<town>.json (house lists: id, lat, lon only) and lawnfix-yard/<town>.json (the
# laptop's yard v2 file, the one that is live). This machine's own copies are kept in vm-backup/ first.
# gis.colorado.gov (lot lines): the only parcel job running. Leaves lawnfix-ok.txt, the towns that finished; the laptop's
# finish-lawnfix-2026-10-31.sh takes only those.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/lawnfix-towns.txt")
if [ ! -f "$Q/lawnfix.prepped" ]; then
  mkdir -p "$B/data" "$B/yard-v2" "$B/parcels"
  for t in $TOWNS; do
    [ -f "$Q/lawnfix-data/$t.json" ] || { echo "no house list for $t"; exit 1; }
    [ -f "$LT/data/$t.json" ] && [ ! -f "$B/data/$t.json" ] && cp "$LT/data/$t.json" "$B/data/"
    [ -f "$LT/yard-v2/$t.json" ] && [ ! -f "$B/yard-v2/$t.json" ] && cp "$LT/yard-v2/$t.json" "$B/yard-v2/"
    [ -f "$LT/drcog-turf/parcels-$t.json" ] && [ ! -f "$B/parcels/parcels-$t.json" ] && cp "$LT/drcog-turf/parcels-$t.json" "$B/parcels/"
    cp "$Q/lawnfix-data/$t.json" "$LT/data/$t.json"
    [ -f "$Q/lawnfix-yard/$t.json" ] && cp "$Q/lawnfix-yard/$t.json" "$LT/yard-v2/$t.json"
  done
  node "$Q/lawnfix-prep.mjs" "$LT" "$Q/lawnfix-towns.txt" || exit 1
  touch "$Q/lawnfix.prepped"
fi
n=0; bad=0
for t in $TOWNS; do
  n=$((n + 1))
  [ -f "$Q/lawnfix-$t.done" ] && continue
  st "lawnfix: $t ($n of $(echo $TOWNS | wc -w))"
  rc=1
  for i in $(seq 1 20); do
    room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town="$t" --mins=60 --conc=16); rc=$?
    [ $rc -eq 0 ] && break; [ $rc -eq 3 ] || sleep 60
  done
  if [ $rc -eq 0 ] || [ $rc -eq 3 ]; then touch "$Q/lawnfix-$t.done"; else echo "lawnfix: $t failed (rc $rc)"; bad=$((bad + 1)); fi
done
for t in $TOWNS; do [ -f "$Q/lawnfix-$t.done" ] && echo "$t"; done > "$Q/lawnfix-ok.txt"
echo "lawnfix: $(wc -l < "$Q/lawnfix-ok.txt") towns finished, $bad failed"
[ "$(wc -l < "$Q/lawnfix-ok.txt")" -gt 0 ]

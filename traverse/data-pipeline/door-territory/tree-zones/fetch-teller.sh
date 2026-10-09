#!/bin/bash
# Teller County laser scans (2026-10-08): the USGS LAZ tiles that hold doors in Woodland Park, Divide, Florissant and
# Cripple Creek (CO_CONMGaps_D24, CO_ArapahoRooseveltPikeNF_D23; not in the cloud copy the other towns read). 149 files,
# about 18.7 GB, into lidar-cache/teller-laz/ (not in git). Only USGS's rockyweb server has them, at about 50 KB/s per
# connection, so several download side by side. Resumes: a part file continues.
# 2026-10-09: every file is checked against the size the server gives. A resumed download had appended a whole new copy
# onto 26 part files (581 MB on disk for a 326 MB tile), which the LAZ decoder then choked on. A wrong size is deleted and
# fetched again from the start; a finished file of the right size is skipped.
#   bash fetch-teller.sh        then: node teller-grids.mjs
cd "$(dirname "$0")"
D=lidar-cache/teller-laz; mkdir -p "$D"
size() { curl -sIL --max-time 60 "$1" | tr -d '\r' | awk 'tolower($1)=="content-length:"{n=$2} END{print n}'; }
one() {
  u=$1; f="$D/$(basename "$u")"; want=$(size "$u")
  if [ -f "$f" ]; then
    [ -n "$want" ] && [ "$(stat -c %s "$f")" = "$want" ] && { echo "have $(basename "$u")"; return; }
    echo "wrong size $(basename "$u") ($(stat -c %s "$f") on disk, $want on the server): fetching again"; rm -f "$f" "$f.part"
  fi
  [ -f "$f.part" ] && [ -n "$want" ] && [ "$(stat -c %s "$f.part")" -gt "$want" ] && rm -f "$f.part"
  for try in 1 2 3 4 5 6; do
    curl -sS -f -C - -o "$f.part" "$u"
    got=$(stat -c %s "$f.part" 2>/dev/null)
    if [ -n "$want" ] && [ "$got" = "$want" ]; then mv "$f.part" "$f"; break; fi
    [ -n "$got" ] && [ -n "$want" ] && [ "$got" -gt "$want" ] && rm -f "$f.part"   # overshot: start that file again
    echo "retry $try $(basename "$u")"; sleep $((try * 30))
  done
  [ -f "$f" ] && echo "$(date +%H:%M) done $(basename "$u") $(du -m "$f" | cut -f1) MB" || echo "FAILED $(basename "$u")"
}
export -f one size; export D
node -e "for (const t of require('./teller-tiles.json')) console.log(t.url)" | xargs -P ${P:-6} -I{} bash -c 'one {}'
echo "ALL DONE $(ls $D/*.laz 2>/dev/null | wc -l) of 149 files"

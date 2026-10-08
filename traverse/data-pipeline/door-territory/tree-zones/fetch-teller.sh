#!/bin/bash
# Teller County laser scans (2026-10-08): the USGS LAZ tiles that hold doors in Woodland Park, Divide, Florissant and
# Cripple Creek (CO_CONMGaps_D24, CO_ArapahoRooseveltPikeNF_D23; not in the cloud copy the other towns read). 149 files,
# about 18.7 GB, into lidar-cache/teller-laz/ (not in git). Only USGS's rockyweb server has them, at about 50 KB/s per
# connection, so four download side by side (about a day in all). Resumes: a finished file is skipped, a part file continues.
#   bash fetch-teller.sh        then: node teller-grids.mjs
cd "$(dirname "$0")"
D=lidar-cache/teller-laz; mkdir -p "$D"
one() {
  u=$1; f="$D/$(basename "$u")"
  [ -f "$f" ] && { echo "have $(basename "$u")"; return; }
  for try in 1 2 3 4 5 6; do
    curl -sS -f -C - -o "$f.part" "$u" && mv "$f.part" "$f" && break
    echo "retry $try $(basename "$u")"; sleep $((try * 30))
  done
  [ -f "$f" ] && echo "$(date +%H:%M) done $(basename "$u") $(du -m "$f" | cut -f1) MB" || echo "FAILED $(basename "$u")"
}
export -f one; export D
node -e "for (const t of require('./teller-tiles.json')) console.log(t.url)" | xargs -P 4 -I{} bash -c 'one {}'
echo "ALL DONE $(ls $D/*.laz 2>/dev/null | wc -l) of 149 files"

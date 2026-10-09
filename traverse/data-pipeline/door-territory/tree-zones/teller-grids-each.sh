#!/bin/bash
# Convert each downloaded Teller tile that has no grid yet in its own node process (2026-10-09): a tile the decoder cannot
# read aborts the whole process with an uncatchable error, so one bad tile must not stop the rest. Lists what failed.
#   bash teller-grids-each.sh       (after fetch-teller.sh and node verify-teller.mjs)
cd "$(dirname "$0")"
fails=0
for f in lidar-cache/teller-laz/*.laz; do
  n=$(basename "$f" .laz)
  [ -f "lidar-cache/teller-grid/$n.grid" ] && continue
  ONLY="$n" node teller-grids.mjs 2>&1 | grep -E "points,|converted" | grep -v "^0 converted" || { echo "FAILED $n"; fails=$((fails+1)); }
done
echo "grids: $(ls lidar-cache/teller-grid/*.grid 2>/dev/null | wc -l) of 149; $fails failed"

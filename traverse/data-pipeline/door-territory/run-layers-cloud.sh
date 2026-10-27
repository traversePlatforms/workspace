#!/bin/bash
# The editions' new towns, cloud run (2026-10-26, Matthew: "have the cloud computer build that out before we delete anything"): per town
# in order.txt (biggest first), roof size and pitch (roofs/sample-roofs.mjs) then solar facts (solar/sample-solar.mjs), both from the
# USGS laser scans with Overture's building outlines. Each script caches every 200 doors and skips what it has, so a stop loses little
# and a restart carries on. The laser-tile cache is cut back to 25 GB before each town, and the run stops (not skips) under 5 GB free.
# Start: nohup bash ~/run/layers/run-layers.sh > ~/run-layers.log 2>&1 &     status: ~/run-status.txt
set -u
L="$HOME/run/layers/door-territory"; LIDAR="$HOME/run/tree-zones/lidar-cache"
st() { echo "$(date -u +%FT%TZ) layers: $*" | tee "$HOME/run-status.txt"; }
prune() {
  while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do
    old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break
    printf '%s\n' "$old" | xargs -r rm -f
  done
}
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ]; }
for pass in roof solar; do
  while read -r town doors r s; do
    [ -z "$town" ] && continue
    if [ "$pass" = roof ]; then [ "$r" = roof ] || continue; dir=roofs; js=sample-roofs.mjs; else [ "$s" = solar ] || [ "$r" = solar ] || continue; dir=solar; js=sample-solar.mjs; fi
    [ -f "$L/$dir/$town.done" ] && continue
    for try in 1 2 3 4 5; do
      prune; room || { st "STOPPED at $pass $town: under 5 GB free"; exit 1; }
      st "$pass $town ($doors doors), try $try"
      (cd "$L/$dir" && node --max-old-space-size=6144 $js --all-towns --buildings=buildings-ovt --town="$town" --conc=12) && { touch "$L/$dir/$town.done"; echo "$(date -u +%T) $pass $town finished"; break; }
      echo "$(date -u +%T) $pass $town exit $? (try $try)"; sleep 60
    done
  done < "$HOME/run/layers/order.txt"
done
st "every town done"; echo "all done"

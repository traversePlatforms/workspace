#!/bin/bash
# The close-up roof photos ("See the roof"), filled in after the doors are live (2026-10-28, Matthew: "go with option 1"). The roof material
# step was skipped for the rest of the Group 1 re-clip and all of Group 2: its model makes no calls on these towns, and its photo fetch
# (the part that builds the close-up index) ran under 1 door a second in Larimer, holding Group 2 back. This runs that fetch afterwards.
# Copy on the VM: ~/run/group2/photos-backfill.sh, towns in ~/run/group2/photos-towns.txt (written when the step was skipped).
#   1. waits until Group 2 stage B is over (~/run/group2/g2b.vmdone and no stageb.sh running): houses.mjs reads lot lines from
#      gis.colorado.gov, one parcel-heavy job at a time;
#   2. per town: houses (--redo), the NAIP crop fetch (writes cache/crops-<town>.json, the index), crops deleted after each town; the
#      model (features/predict) is not run;
#   3. the close-up photo index for those towns (app/data/rounds/naip-<town>.json).
# Resumable (photos-<town>.done), stops under 5 GB free. Status ~/run-status.txt, log ~/run-photos.log. Ends at "photos backfill: done"
# and leaves ~/run/group2/photos.vmdone; the laptop's overnight check then runs finish-photos-2026-10-28.sh (copy back, push editions).
# Start: nohup bash ~/run/group2/photos-backfill.sh > ~/run-photos.log 2>&1 &
set -u
T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; G="$HOME/run/group2"; M="$DT/roofs/material"
st() { echo "$(date -u +%FT%TZ) photos backfill: $*" > "$HOME/run-status.txt"; echo "$(date -u +%T) $*"; }
room() { while [ "$(df --output=avail -BG "$HOME" | tail -1 | tr -dc 0-9)" -lt 5 ]; do echo "$(date -u +%T) under 5 GB free, waiting"; sleep 600; done; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
echo "$(date -u +%T) waiting for Group 2 stage B"
until [ -f "$G/g2b.vmdone" ] && ! pgrep -f "^bash [^ ]*stageb\.sh" > /dev/null; do sleep 300; done
while read -r town; do
  [ -z "$town" ] || [ -f "$G/photos-$town.done" ] || [ ! -f "$RD/$town.json" ] && continue
  st "$town"
  tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town' --redo" || continue
  tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || continue
  rm -rf "$M/cache/crops/$town"; touch "$G/photos-$town.done"
done < "$G/photos-towns.txt"
(cd "$M" && node build-naip-photos.mjs $(cat "$G/photos-towns.txt"))
touch "$G/photos.vmdone"
st "done: the laptop pushes them with finish-photos-2026-10-28.sh"; echo "photos backfill done"

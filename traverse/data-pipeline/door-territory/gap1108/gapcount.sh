#!/bin/bash
# Stage gapcount (fill1031, added 8 Nov; GAP-PLAN-2026-11-08.md). Reads the whole state parcel layer once (~2.6M parcels, one page at a
# time) into ~/run/gap1108/state/<county>.tsv.gz (no owner names), then sorts every parcel against our doors and office-lookup homes
# (~/run/gap1108/door-points.tsv, sent from the laptop) into ~/run/gap1108/gap-counts.json. Counting only: nothing is built or pushed,
# and run-cloud-finishers.sh has no finisher for this stage.
. "$HOME/run/fill1031/lib.sh"
G="$HOME/run/gap1108"; room
st "gapcount: reading the state parcel layer"
cd "$G" && nice -n 10 node code/gap-pull-vm.mjs state || exit 1
if [ -s "$G/door-points.tsv" ] && [ -f "$G/code/gap-classify.mjs" ]; then
  st "gapcount: sorting parcels against our doors"
  nice -n 10 node --max-old-space-size=9000 code/gap-classify.mjs state door-points.tsv gap-counts.json --epc="$G/epc-parcel-data.txt" || exit 1
fi
st "gapcount: done"

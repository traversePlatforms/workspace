#!/bin/bash
# Stage ehpull (fill1031, 15 Nov 2026; EVERY-HOME-2026-11-15.md): reads the whole state parcel layer once more (one page at a time,
# ~2.5M parcels, ~1 h) into ~/run/every1115/state/<county>.tsv.gz + <county>-rings.ndjson.gz (every1115/pull-state-vm.mjs). Parcel-heavy:
# the only job on gis.colorado.gov while it runs. Counting input only: nothing is built or pushed. Moffat skipped (TR-36).
. "$HOME/run/fill1031/lib.sh"
E="$HOME/run/every1115"; mkdir -p "$E/state"; room
st "ehpull: reading the state parcel layer"
cd "$E" && nice -n 10 node code/pull-state-vm.mjs state || exit 1
st "ehpull: done"

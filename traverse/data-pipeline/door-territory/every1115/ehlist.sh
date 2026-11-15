#!/bin/bash
# Stage ehlist (fill1031, 15 Nov 2026; EVERY-HOME-2026-11-15.md): the recount and the lists, from the fresh pull (stage ehpull) and today's
# doors (door-points-1115.tsv from the laptop). No parcel service is called. Counts in ~/run/every1115/cls/counts.json and
# lists/summary.tsv, lists/kinds.json; the lists themselves hold owner names and stay here.
. "$HOME/run/fill1031/lib.sh"
E="$HOME/run/every1115"; room
[ "$(ls "$E"/state/*.done 2>/dev/null | wc -l)" -ge 43 ] || { st "ehlist: the pull is not complete"; exit 1; }
st "ehlist: sorting every parcel against our doors"
cd "$E" && nice -n 10 node --max-old-space-size=11000 code/classify-vm.mjs state door-points-1115.tsv cls --epc="$HOME/run/gap1108/epc-parcel-data.txt" --g3="$HOME/run/group3/targets.json" || exit 1
st "ehlist: writing the lists"
rm -rf "$E/lists" && nice -n 10 node --max-old-space-size=8000 code/make-lists-vm.mjs cls lists --g3="$HOME/run/group3/targets.json" || exit 1
st "ehlist: done (counts in ~/run/every1115/cls/counts.json, lists/summary.tsv)"

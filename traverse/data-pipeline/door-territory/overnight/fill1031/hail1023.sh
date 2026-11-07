#!/bin/bash
# Stage hail1023 (fill1031, added 6 Nov night; CLOUD-PLAN-2026-11 "hail hours from 10 am to midnight, catching late storms").
# The hail2min run read 11 am to 11 pm Colorado time. This reads the two hours either side, 10 am and 11 pm (every 2-minute file),
# for the same plan (door boxes and dates, no owners), into its own file: ~/run/fill1031/hail1023/hail-hours-1023.json.
# A laptop merge (hail/merge-hail-hours.mjs) adds those hours to the live hail-hours.json later. Iowa State's archive, not gis.colorado.gov.
. "$HOME/run/fill1031/lib.sh"
H="$Q/hail1023"; mkdir -p "$H"
[ -s "$H/plan.json" ] || cp "$Q/hail2min/plan.json" "$H/plan.json" || exit 1
st "hail1023: hail hours for 10 am and 11 pm"
cd "$H" && nice -n 10 node "$Q/hail/rebuild-hail-hours.mjs" build plan.json hail-hours-1023.json --conc=4 --step=2 --hours=10,23

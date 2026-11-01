#!/bin/bash
# Stage hail2min (fill1031, added 1 Nov; Matthew: "what can we get the cloud computer to do next, still need to use up that budget", then
# picked the full hail-hours rebuild). The hail hours again for every town and storm day, from EVERY 2-minute radar file instead of one
# each 20 minutes (hail/rebuild-hail-hours.mjs --step=2), so short storms that fell between the samples get their hours: the coverage
# audit had 66% of town storm days with hours. Trial 1 Nov, 2026-08-26 (26 towns): 16 town-days at 20 minutes, 26 at 2 (Denver,
# Centennial, Lakewood, Parker, Wheat Ridge among the new ones), 8 minutes for the day; 275 days is about 37 hours.
# Iowa State's MRMS archive (as build-hail.mjs), 4 files at a time, about 60 KB each. Not gis.colorado.gov. The plan is the one the
# 20-minute rebuild used (~/run/hailhours/plan.json: door boxes and dates, no owners). Resumes from hail-hours.json.progress.
# Leaves ~/run/fill1031/hail2min/hail-hours.json for finish-hail2min-2026-11-01.sh.
. "$HOME/run/fill1031/lib.sh"
H="$Q/hail2min"; mkdir -p "$H"
[ -s "$H/plan.json" ] || cp "$HOME/run/hailhours/plan.json" "$H/plan.json" || exit 1
st "hail2min: hail hours from every 2-minute radar file"
cd "$H" && nice -n 10 node "$Q/hail/rebuild-hail-hours.mjs" build plan.json hail-hours.json --conc=4 --step=2

#!/bin/bash
# Stage hailnew (fill1031, added 18 Nov 2026): storm history (radar hail, ground reports, wind) for the every-home doors, i.e. the 91 new
# towns and the doors the every-home batch added to towns of ours (EVERY-HOME-2026-11-15.md, "still to do by hand": "storm history for the
# new towns = the g3hail method"). The method is unchanged: hail/hail-backfill-vm.sh in ~/run/hailfill (BACKFILL-HAIL-2026-10-29.md), on
# door points only (id, lat, lon; no owners or addresses) that the laptop staged into ~/run/hailfill/hailnew-in/ (stage.tgz, through.txt =
# the live storm job's own date, tag.txt). Radar days already on this machine are kept; only the days after the last fetch are downloaded.
# Not gis.colorado.gov (Iowa State's radar archive, NOAA Storm Events, Iowa Environmental Mesonet).
# Laptop finisher: every1115/finish-hailnew-2026-11-18.sh (it uploads the door points, appends this stage and waits for hailnew.vmdone).
. "$HOME/run/fill1031/lib.sh"
H="$HOME/run/hailfill"; I="$H/hailnew-in"; cd "$H" || exit 1
[ -s "$I/stage.tgz" ] && [ -s "$I/through.txt" ] && [ -s "$I/tag.txt" ] || { st "hailnew: no staged door points in $I"; exit 1; }
THROUGH=$(cat "$I/through.txt"); TAG=$(cat "$I/tag.txt")
echo "$THROUGH" | grep -qE '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' || { st "hailnew: bad through date '$THROUGH'"; exit 1; }
room
# the 29 Oct run's result is kept once; its door points and outputs make way for today's
mkdir -p "$B/hailnew"; [ -f result.tgz ] && [ ! -f "$B/hailnew/result-20261030.tgz" ] && cp result.tgz "$B/hailnew/result-20261030.tgz"
rm -rf stormstage out hailfill.vmdone fetch.done hailnew.tag && mkdir stormstage && tar xzf "$I/stage.tgz" -C stormstage || { st "hailnew: could not unpack the door points"; exit 1; }
st "hailnew: hail, ground reports and wind for $(ls stormstage/*.json | grep -vc '/index.json$') towns, through $THROUGH"
THROUGH="$THROUGH" bash "$H/hail-backfill-vm.sh" > "$HOME/run-hailfill.log" 2>&1 || { st "hailnew: FAILED: $(cat "$HOME/run-hailfill-status.txt")"; exit 1; }
[ -f "$H/hailfill.vmdone" ] || { st "hailnew: hail-backfill-vm.sh ended without hailfill.vmdone"; exit 1; }
echo "$TAG" > "$H/hailnew.tag"
st "hailnew: done, $(cat "$HOME/run-hailfill-status.txt" | cut -c1-120) (laptop: every1115/finish-hailnew-2026-11-18.sh)"

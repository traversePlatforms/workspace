#!/bin/bash
# Centennial, the whole town (2026-10-25, Matthew: "fix it please, we cant afford to miss any").
# The 2026-10-16 all-sizes rebuild pulled Centennial from a centre in the east (radius 6.4 mi) and then kept only houses within 0.35 mi of
# the old list, which covered the east side only: 10,873 houses in west Centennial (2195 E Nichols Dr among them) were never doors.
# This pulls every parcel inside Centennial's legal boundary (no lot minimum, 10-acre cap), merges it with the current list (the parcel id
# decides a duplicate, current rows win, so nothing on the list now is lost), then the usual town steps, upload and assignment remap.
# One parcel-heavy job at a time (2026-10-11 rule). Run from this folder:  bash run-centennial-west-2026-10-25.sh > logs-centennial-west.log 2>&1
set -u
cd "$(dirname "$0")"
L=logs-centennial-west; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
LABEL=centennial-west-2026-10-25

cp centennial.csv centennial.csv.bak-2026-10-25; cp centennial-areas.json centennial-areas.json.bak-2026-10-25
OLD=$(rows centennial.csv.bak-2026-10-25)
step pull-centennial-legal node build-walklist-co.mjs --county=ARAPAHOE --lat=39.59 --lon=-104.85 --radius=9.5 --min-acres=0 --municipality='Centennial' --out=centennial-legal.csv || exit 1
[ -s centennial-legal.csv ] || { echo "$(date +%T) pull came back empty, nothing changed"; exit 1; }
step merge-centennial node merge-walklists.mjs centennial.csv centennial.csv.bak-2026-10-25 centennial-legal.csv || { cp centennial.csv.bak-2026-10-25 centennial.csv; exit 1; }
NEW=$(rows centennial.csv)
echo "$(date +%T) centennial: $OLD -> $NEW doors (legal-boundary pull $(rows centennial-legal.csv))"
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) not bigger, old files back"; cp centennial.csv.bak-2026-10-25 centennial.csv; exit 1; fi

step areas-centennial node build-walklist-pdf.mjs centennial.csv --no-pdf || exit 1
step lawn-centennial bash -c "cd lawn-trial && node sample-lawn.mjs --town=centennial --conc=16"
step compact-centennial bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=centennial --conc=6"
step trees-centennial bash -c "cd tree-zones && node sample-trees.mjs --town=centennial --conc=6"
step value-centennial node sample-value.mjs --only=centennial
step lookup-centennial node build-lookup.mjs centennial
step rounds node build-rounds-data.mjs || exit 1
bash upload-towns-sixfold.sh "$LABEL" centennial || exit 1
[ -f "logs-upload/$LABEL.done" ] || { echo "$(date +%T) upload did not finish"; exit 1; }
bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py centennial ~/upload-backups/before-$LABEL.tgz" < /dev/null
echo "$(date +%T) centennial done"

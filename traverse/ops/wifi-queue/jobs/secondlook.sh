#!/bin/bash
# Wi-Fi queue job: a second look, in the July 2021 photo, at lawns that read no green in the September 2023 one (2026-10-20). Houses we are
# visiting first (leads, walks, handed doors, assigned or recently knocked neighbourhoods), then whole towns nearest Englewood first. One
# unit = the visiting houses of one town, or up to 4,000 houses of the next town; then rebuild and upload that town. Trial: 9 of 40 Aurora
# no-green houses showed lawn in 2021. A house still without green is marked tried and not asked again.
source "$(dirname "$0")/_common.sh"
# the visiting list, fresh every 6 hours (new leads and walks)
V="$Q/state/visiting.json"
if [ ! -f "$V" ] || [ $(( $(date +%s) - $(stat -c %Y "$V") )) -gt 21600 ]; then step visiting bash "$Q/make-visiting.sh"; fi
PLAN=$(node "$Q/second-look-plan.mjs") || { echo "planner failed"; exit 1; }
echo "$(date +%T) plan: $PLAN"
set -- $PLAN
case "$1" in
  done) echo "every no-green lawn has had its second look"; exit 0;;
  priority) T=$2; IDF="$Q/state/visiting-$T.json"; step secondlook-$T bash -c "cd lawn-trial && node lawn-second-look.mjs --town=$T --ids='$IDF' --limit=$3 --conc=3";;
  town) T=$2; step secondlook-$T bash -c "cd lawn-trial && node lawn-second-look.mjs --town=$T --limit=4000 --conc=3";;
  *) echo "planner said: $PLAN"; exit 1;;
esac
step rounds-secondlook-$T node build-rounds-data.mjs
if on_hotspot; then echo "on the hotspot before the upload - stopping"; exit 4; fi
L="secondlook-$T-$(date +%Y%m%d-%H%M)"
bash upload-towns-sixfold.sh "$L" "$T"
uploaded "$L" || { echo "the upload of $T did not finish"; exit 1; }
exit 3

#!/bin/bash
# Wi-Fi queue job: the 3-inch photo trial (Matthew 2026-10-22: "add the 3-inch trial to the que"). DRAPP 2022 at 3 inches from Douglas County
# against NAIP 2023, the app's lawn and DRCOG turf, on the hand-measured lots and a spread of tree and open lots in each Douglas County town.
# 40 minutes per unit; resumes. Writes lawn-trial/drapp3-trial-2026-10-22/ only: nothing goes to the app or the server.
source "$(dirname "$0")/_common.sh"
step drapp3 bash -c 'cd lawn-trial && node drapp3-trial.mjs drapp3-trial-2026-10-22 --mins=40; rc=$?; [ $rc -eq 3 ] && { echo "more left"; exit 0; }; [ $rc -eq 0 ] && { touch drapp3-trial-2026-10-22/finished; exit 0; }; exit $rc'
[ -f "$DT/lawn-trial/drapp3-trial-2026-10-22/finished" ] && exit 0 || exit 3

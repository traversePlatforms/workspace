#!/bin/bash
# Wi-Fi queue job: yard v2 for every house (2026-10-24, Matthew: "go ahead, we need to prioritize getting the lawns as accurate as we can
# get it"). Towns in lawn-trial/yard-v2/order.txt: the towns leads came from first, then nearest Englewood. 45 minutes per unit, 16 lots at
# a time (1.6 a second on hotel Wi-Fi, 2026-10-24); resumes where it stopped. Writes lawn-trial/yard-v2/<town>.json only: the app gets
# the sizes when build-yard-v2.mjs puts them in the door files and the towns are uploaded.
source "$(dirname "$0")/_common.sh"
t=""; while read -r x; do [ -z "$x" ] && continue; [ -f "lawn-trial/yard-v2/$x.finished" ] && continue; t="$x"; break; done < lawn-trial/yard-v2/order.txt
[ -z "$t" ] && { echo "every town has yard v2"; exit 0; }
step yardv2-$t bash -c "cd lawn-trial && node yard-v2-town.mjs --town=$t --mins=45 --conc=16; rc=\$?; [ \$rc -eq 3 ] && { echo 'more left'; exit 0; }; [ \$rc -eq 0 ] && { touch yard-v2/$t.finished; exit 0; }; exit \$rc"
exit 3

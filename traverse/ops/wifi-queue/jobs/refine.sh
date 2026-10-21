#!/bin/bash
# Wi-Fi queue job: the lawn refine, one town per run (the same steps as run-refine-resume-2026-10-20.sh, which it replaces).
source "$(dirname "$0")/_common.sh"
todo=()
for t in $(grep -o "upload-towns-sixfold.sh allsizes-[a-z-]*" run-fast-2026-10-16.sh | sed 's/.*allsizes-//' | grep -v '^denver$'); do
  cat logs-fast-runner.log logs-fast2-runner.log logs-fast3-runner.log logs-fast4-runner.log logs-fast5-runner.log 2>/dev/null | grep -q "allsizes-$t uploaded" || continue
  uploaded "refine-$t" && continue
  cat logs-refine-runner*.log 2>/dev/null | grep -q "refine-$t uploaded" && continue
  todo+=("$t")
done
[ ${#todo[@]} -eq 0 ] && { echo "every town is refined"; exit 0; }
t="${todo[0]}"
echo "$(date +%T) == refine $t (${#todo[@]} towns left, this one included)"
step lawnfill-$t bash -c "cd lawn-trial && node lawn-fill.mjs --town=$t --conc=3"
[ "$t" = broomfield ] && step value-broomfield node sample-value.mjs --only=broomfield
step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=3"
step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"
step lookup-$t node build-lookup.mjs $t
step rounds-$t node build-rounds-data.mjs
if on_hotspot; then echo "on the hotspot before the upload - stopping"; exit 4; fi
bash upload-towns-sixfold.sh refine-$t $t
uploaded "refine-$t" || { echo "the upload of $t did not finish"; exit 1; }
[ ${#todo[@]} -le 1 ] && exit 0 || exit 3

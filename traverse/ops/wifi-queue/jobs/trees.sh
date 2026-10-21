#!/bin/bash
# Wi-Fi queue job: trees (USGS LiDAR, GBs) for towns the refine does not cover, one town per run.
source "$(dirname "$0")/_common.sh"
todo=(); for t in sterling-ranch glendale; do uploaded "trees-$t-20261020" || todo+=("$t"); done
[ ${#todo[@]} -eq 0 ] && { echo "all tree towns done"; exit 0; }
t="${todo[0]}"
echo "$(date +%T) == trees $t"
step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"
step lookup-$t node build-lookup.mjs $t
step rounds-trees-$t node build-rounds-data.mjs
if on_hotspot; then echo "on the hotspot before the upload - stopping"; exit 4; fi
bash upload-towns-sixfold.sh trees-$t-20261020 $t
uploaded "trees-$t-20261020" || { echo "the upload of $t did not finish"; exit 1; }
[ ${#todo[@]} -le 1 ] && exit 0 || exit 3

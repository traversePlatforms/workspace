#!/bin/bash
# Wi-Fi queue job: county home values (the state parcel map's assessed value) for towns still without them, one town per run.
# Idaho Springs (Clear Creek) and Elizabeth (Elbert) may come back thin: those counties fill the field only partly.
source "$(dirname "$0")/_common.sh"
todo=(); for t in idaho-springs elizabeth kiowa; do uploaded "values-$t-20261020" || todo+=("$t"); done
[ ${#todo[@]} -eq 0 ] && { echo "all value towns done"; exit 0; }
t="${todo[0]}"
echo "$(date +%T) == values $t"
step value-$t node sample-value.mjs --only=$t
step lookup-$t node build-lookup.mjs $t
step rounds-values-$t node build-rounds-data.mjs
if on_hotspot; then echo "on the hotspot before the upload - stopping"; exit 4; fi
bash upload-towns-sixfold.sh values-$t-20261020 $t
uploaded "values-$t-20261020" || { echo "the upload of $t did not finish"; exit 1; }
[ ${#todo[@]} -le 1 ] && exit 0 || exit 3

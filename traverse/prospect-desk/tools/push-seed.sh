#!/bin/bash
# Rebuild the Prospect Desk's seed from a prospect CSV and put it on the server (2026-10-26). Safe any time: the desk's history is in
# events.log and replays onto the new seed by company id (the state register's record number). The old seed is kept beside it.
#   bash traverse/prospect-desk/tools/push-seed.sh <csv>
#   e.g. the cloud look-up when it finishes:
#   scp -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101:prospects/prospects-step3.csv traverse/research/prospects/
#   bash traverse/prospect-desk/tools/push-seed.sh traverse/research/prospects/prospects-step3.csv
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$1" ] || { echo "usage: push-seed.sh <csv>"; exit 1; }
node "$HERE/build-seed.mjs" "$1"
base64 -w0 "$HERE/../desk-data-local/seed.json" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'W=~/www/traverseplatforms.com/traverse-prospects-data; cp $W/seed.json $W/seed.before-$(date +%Y%m%d-%H%M).json && base64 -d > $W/seed.new && php -r "\$j=json_decode(file_get_contents(\"$W/seed.new\"),true); exit(is_array(\$j[\"leads\"] ?? null) && count(\$j[\"leads\"]) > 1000 ? 0 : 1);" && mv $W/seed.new $W/seed.json && chmod 600 $W/seed.json && echo "seed on the server: $(php -r "echo count(json_decode(file_get_contents(\"$W/seed.json\"),true)[\"leads\"]);") companies"'

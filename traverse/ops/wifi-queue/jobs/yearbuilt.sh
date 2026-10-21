#!/bin/bash
# Wi-Fi queue job: year built for every Sixfold town in a county whose assessor files we hold (2026-10-20, Matthew: "metro year-built job
# in"). Builds year-<town>.json (assessor/build-year.mjs + town-county.json), then uploads them to Sixfold's live data with a backup first
# and a checksum check after. The door card uses only the year, and only for houses built in or after the aerial photo's year.
# Counties with no bulk file yet (Jefferson, Arapahoe, Broomfield, Elbert, Teller, Clear Creek) are not in this job.
source "$(dirname "$0")/_common.sh"
step build-year bash -c "cd assessor && node build-year.mjs"
DATA="/c/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
cd "$DATA" || exit 1
FILES=$(node -e "const fs=require('fs');const i=JSON.parse(fs.readFileSync('index.json','utf8'));console.log((i.regions||[]).map(r=>'year-'+r.key+'.json').filter(f=>fs.existsSync(f)&&fs.statSync(f).size>60).join(' '))")
[ -z "$FILES" ] && { echo "no year files to upload"; exit 1; }
echo "$(date +%T) uploading $(echo $FILES | wc -w) year files"
if on_hotspot; then echo "on the hotspot before the upload - stopping"; exit 4; fi
STAMP=$(date +%Y%m%d-%H%M)
$SG "cd ~/www/traverseplatforms.com/sixfold-data/rounds && tar -czf ~/upload-backups/before-yearbuilt-$STAMP.tgz \$(ls year-*.json 2>/dev/null) index.json && echo backed-up" < /dev/null || exit 1
tar -cf - $FILES | $SG 'cd ~/www/traverseplatforms.com/sixfold-data/rounds && tar -xf - && echo extracted' || exit 1
md5sum $FILES | sed 's/ \*/  /' | LC_ALL=C sort -k2 > /tmp/yb-loc; $SG "cd ~/www/traverseplatforms.com/sixfold-data/rounds && md5sum $FILES" < /dev/null | LC_ALL=C sort -k2 > /tmp/yb-srv
if diff -q /tmp/yb-loc /tmp/yb-srv > /dev/null; then echo "$(date +%T) year files uploaded and checked ($(echo $FILES | wc -w))"; else echo "CHECKSUM MISMATCH"; diff /tmp/yb-loc /tmp/yb-srv | head; exit 1; fi
exit 0

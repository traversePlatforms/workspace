#!/bin/bash
# the regression set once on FRESH data (from ptest-1030), edition then Sixfold, at the live memory limit.
#   fresh-satc.sh base|wt <label>     base = HEAD's page and rounds.php (before TR-52/TR-37), wt = this branch
P="C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-satcache"
B="C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-1030"
cd "$P" || exit 1
bash kill-ports.sh 8814 8840 8841 8842 8843 8844 8845 8846
sleep 2
for x in sixfold-data sixfold-private traverse-shared; do rm -rf "${P:?}/$x"; cp -r "$B/$x" "$P/$x"; done
rm -rf "${P:?}/sixfold-data/ratelimit" "${P:?}/www/api/.ratelimit"/* mail-mock.log
echo '{}' > stripe-mock.json
if [ "$1" = base ]; then bash sync-satc.sh base; else bash sync-satc.sh; fi
(bash serve.sh > /dev/null 2>&1 &)
sleep 3
O="$P/reg-$2.txt"
bash run-1030.sh "$2" lotprev-test.mjs aerial-test.mjs satcache-ui-test.mjs > /dev/null 2>&1
cp "$P/r1030-$2.txt" "$O"
echo "== sixfold extras" >> "$O"
node mode.cjs sixfold > /dev/null
bash run-one.sh lotprev-test.mjs aerial-test.mjs satcache-ui-test.mjs >> "$O" 2>&1
node mode.cjs edition > /dev/null
echo "== exhausted in php log: $(grep -c 'exhausted' php-8814.log)" >> "$O"
cat "$O"

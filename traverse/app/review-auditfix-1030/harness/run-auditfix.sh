#!/bin/bash
# the audit-fix regression set (30 Oct): edition then Sixfold. Usage: run-auditfix.sh <label> [extra edition suites...]
P="$(cd "$(dirname "$0")" && pwd)"; cd "$P"
L="${1:-run}"; shift
O="$P/raudit-$L.txt"; : > "$O"
rm -rf "${P:?}/sixfold-data/ratelimit"/* "${P:?}/www/api/.ratelimit"/*
echo "== edition (terms pre-accepted)" >> "$O"
bash run-ed.sh t1030-test.mjs reps-test.mjs batch1029-ui-test.mjs accounts-test.mjs payments-test.mjs card-test.mjs "$@" >> "$O" 2>&1
echo "== edition (terms not pre-accepted)" >> "$O"
node mode.cjs edition >/dev/null
bash run-one.sh roles-test.mjs billlock-test.mjs >> "$O" 2>&1
echo "== perms (matrix)" >> "$O"
bash run-perms.sh >> "$O" 2>&1
tail -1 perms-last.txt >> "$O"
echo "== sixfold" >> "$O"
node mode.cjs sixfold >/dev/null
bash run-one.sh t1030-test.mjs reps-test.mjs batch1029-ui-test.mjs roles-test.mjs accounts-test.mjs payments-test.mjs card-test.mjs billlock-test.mjs >> "$O" 2>&1
node mode.cjs edition >/dev/null
cat "$O"

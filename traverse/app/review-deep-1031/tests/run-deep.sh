#!/bin/bash
# the 31 Oct deep-review regression: the four once-per-data suites first (fresh data), then the 30 Oct set, edition then Sixfold.
# Usage: run-deep.sh <label>   (fresh data: bash fresh-deep.sh first)
P="$(cd "$(dirname "$0")" && pwd)"; cd "$P"
L="${1:-run}"; O="$P/deep-$L.txt"; : > "$O"
one() { out=$(timeout 900 node "$1" 2>&1); echo "$1: $(echo "$out" | grep -E 'passed, [0-9]+ failed' | tail -1)" >> "$O"; echo "$out" | grep -E '  FAIL  |FAILED:' | head -12 >> "$O"; }
# the Facebook stand-in on 8833 (this harness's own)
netstat -ano | grep -q "127.0.0.1:8833 .*LISTEN" || (php -S 127.0.0.1:8833 fbmock/router.php > fbmock.log 2>&1 &)
sleep 1
echo "== edition, fresh data (once per data copy)" >> "$O"
node mode.cjs edition >/dev/null; node preaccept.cjs >/dev/null
rm -rf "$P/sixfold-data/ratelimit"
for f in care-test.mjs edstats-test.mjs fbleads-test.mjs crmsync-test.mjs; do one "$f"; done
echo "== edition (isolated logs)" >> "$O"
bash run-one.sh t1030-test.mjs card-test.mjs seat-block-test.mjs deep1031-test.mjs >> "$O" 2>&1
bash run-1030.sh "$L" > /dev/null 2>&1
cat "$P/r1030-$L.txt" >> "$O"
echo "== sixfold extras" >> "$O"
node mode.cjs sixfold >/dev/null
bash run-one.sh card-test.mjs seat-block-test.mjs >> "$O" 2>&1
node mode.cjs edition >/dev/null
cat "$O"

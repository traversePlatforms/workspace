#!/bin/bash
# Run one fill1031 finisher by hand the way traverse/ops/run-cloud-finishers.sh would: refuses while another finisher holds the lock,
# holds the same lock while it runs, logs to door-territory/logs-finish-<stage>.log, and marks the stage done (so the overnight check
# does not run it again) only when it exits 0. Used on 31 Oct before the fill1031 commit was merged into the main checkout.
#   bash finish-by-hand.sh <stage> [<path to fill1031-finish.sh>]
set -u
STAGE="${1:?stage}"; F="${2:-/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory/fill1031-finish.sh}"
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
ST="$LOCALAPPDATA/ProjectBackup/cloud-finish"; mkdir -p "$ST"
[ -f "$ST/$STAGE.done" ] && { echo "$STAGE already done"; exit 0; }
if [ -f "$ST/running.lock" ] && kill -0 "$(cat "$ST/running.lock" 2>/dev/null)" 2>/dev/null; then echo "another finisher is running: $(cat "$ST/running.name" 2>/dev/null)"; exit 1; fi
echo $$ > "$ST/running.lock"; echo "$STAGE" > "$ST/running.name"
trap 'rm -f "$ST/running.lock" "$ST/running.name"' EXIT
if bash "$F" "$STAGE" > "$DT/logs-finish-$STAGE.log" 2>&1; then touch "$ST/$STAGE.done"; echo "$STAGE finished"; else echo "$STAGE failed: see $DT/logs-finish-$STAGE.log"; exit 1; fi

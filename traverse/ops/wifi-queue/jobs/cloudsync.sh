#!/bin/bash
# Wi-Fi queue job (20 Nov 2026, TASKS X-15): the first full copy of the repo and memory to the cloud J.A.R.V.I.S. (~300 MB, too heavy for
# the iPhone hotspot), then the VM's workspace (init), the watcher (deploy) and shadow mode. Matthew 20 Nov: "you can resume it" and
# "I am going to be using jarvis for a lot of person stuff so I need to be able to access what i need when the computer is not on":
# personal/ stays in the copy. Still kept off the VM by jarvis-cloud-sync.sh: Surge's restricted notes (as GitHub), his pay note and the
# Tier 1 pointer (memory). Live mode is never set here: only on Matthew's go (jarvis-cloud.sh mode live --matthew-said-go).
source "$(dirname "$0")/_common.sh"
OPS="$Q/.."; CS="$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/cloud-sync"; REPO="$(cd "$OPS/../.." && pwd)"
on_hotspot && { echo "on the hotspot - waiting"; exit 4; }
if [ ! -f "$CS/first-copy.done" ]; then
  rm -f "$CS/off"
  # the lock left by the run stopped on 19 Nov (no sync is running when this job starts it; a live one would be under 3 h old and is waited for)
  [ -d "$CS/lock.d" ] && [ $(( $(date +%s) - $(stat -c %Y "$CS/lock.d") )) -gt 3600 ] && rmdir "$CS/lock.d"
  echo "$(date +%T) start push (repo + memory)"
  bash "$OPS/jarvis-cloud-sync.sh" push; tail -n 3 "$CS/sync.log"
  if [ "$(cat "$CS/pushed-head" 2>/dev/null)" != "$(git -C "$REPO" rev-parse HEAD)" ]; then
    touch "$CS/off"   # no half-done copy left retrying on its own (the help-watch cycle would otherwise send it on the hotspot)
    on_hotspot && { echo "the push stopped on the hotspot"; exit 4; }
    echo "the push did not finish (sync.log above)"; exit 1
  fi
  date '+%F %T' > "$CS/first-copy.done"
fi
on_hotspot && { echo "on the hotspot before init - waiting"; exit 4; }
step cloud-init bash "$OPS/jarvis-cloud.sh" init
step cloud-deploy bash "$OPS/jarvis-cloud.sh" deploy
step cloud-shadow bash "$OPS/jarvis-cloud.sh" mode shadow
bash "$REPO/assistant/jarvis/tools/jarvis-status.sh" alert "Cloud J.A.R.V.I.S.: the full copy reached the cloud computer and it is running in shadow mode (watching, not answering). Live mode waits for your go." > /dev/null 2>&1
exit 0

#!/bin/bash
# Wi-Fi queue job (20 Nov 2026, TASKS X-15): the first full copy of the repo and memory to the cloud J.A.R.V.I.S. (~300 MB, too heavy for
# the iPhone hotspot), then the VM's workspace (init), the watcher (deploy) and shadow mode. Matthew 20 Nov: "you can resume it" and
# "I am going to be using jarvis for a lot of person stuff so I need to be able to access what i need when the computer is not on":
# personal/ stays in the copy. Still kept off the VM by jarvis-cloud-sync.sh: Surge's restricted notes (as GitHub), his pay note and the
# Tier 1 pointer (memory). Live mode is never set here: only on Matthew's go (jarvis-cloud.sh mode live --matthew-said-go).
source "$(dirname "$0")/_common.sh"
OPS="$Q/.."; CS="$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/cloud-sync"; REPO="$(cd "$OPS/../.." && pwd)"
on_hotspot && { echo "on the hotspot - waiting"; exit 4; }
# one copy of this job at a time (the queue, or a hand start)
JL="$Q/state/cloudsync.lock.d"; mkdir "$JL" 2>/dev/null || { echo "cloudsync already running"; exit 4; }; trap 'rmdir "$JL" 2>/dev/null' EXIT
if [ ! -f "$CS/first-copy.done" ]; then
  # the 2-minute help-watch cycle also sends once off is gone: wait for any sync to end, lift off, and retry if the cycle gets in first
  # (20 Nov 08:58: off was lifted first, the cycle took the lock, this job quit and the cycle's copy died when the laptop left the office)
  [ -d "$CS/lock.d" ] && [ $(( $(date +%s) - $(stat -c %Y "$CS/lock.d") )) -gt 10800 ] && rmdir "$CS/lock.d"
  for i in $(seq 1 30); do [ -d "$CS/lock.d" ] || break; sleep 20; done
  rm -f "$CS/off"
  echo "$(date +%T) start push (repo + memory)"
  for i in 1 2 3; do
    bash "$OPS/jarvis-cloud-sync.sh" push | grep -q "another sync is running" || break
    sleep 60   # the cycle got in first: let it finish, then FORCE push (sends only what is missing)
  done
  tail -n 3 "$CS/sync.log"
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

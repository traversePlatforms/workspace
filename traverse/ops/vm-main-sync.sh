#!/bin/bash
# ~/main on the VM and the one history (22 Nov 2026, Matthew: the VM as the main workspace; design and flip: traverse/ops/VM-MAIN-WORKSPACE.md).
# Runs ON THE VM. After the flip, ~/jarvis/repo.git (branch main) is the only history: ~/main (Matthew's own sessions, VS Code Remote-SSH)
# and ~/workspace (the cloud J.A.R.V.I.S. watcher) both push to it; the laptop only pulls from it. This keeps ~/main level with it:
#   bash traverse/ops/vm-main-sync.sh            once: push ~/main's new commits, bring in what the watcher pushed (safely, below)
#   bash traverse/ops/vm-main-sync.sh status     ahead / behind / waiting, and why
# Run every 2 minutes by the systemd user timer jarvis-main-sync.timer and after every commit in ~/main (its post-commit hook).
# Safe by construction: never rebases ~/main, never stashes, never touches uncommitted work. Bringing in = fast-forward, or a merge commit
# only when git's own dry run (merge-tree) shows no clash; git itself refuses either if a file it would change is mid-edit here, and then
# it simply waits for the next run. A clash in committed work is left for a session (one alert), nothing is lost.
# Before the flip (git config jarvis.role = standby) it does nothing.
set -u
exec < /dev/null
M="${JARVIS_MAIN:-$HOME/main}"; J="${JARVIS_HOME:-$HOME/jarvis}"; ST="$J/state"; mkdir -p "$ST"
LOG="$ST/main-sync.log"; log() { echo "$(date '+%F %T') $*" >> "$LOG"; [ -n "${VERBOSE:-}" ] && echo "$*"; return 0; }
alert_once() {   # alert_once <key> <text>: one alert per state (the key file goes when the state clears)
  [ -f "$ST/main-sync-alerted-$1" ] && return 0; touch "$ST/main-sync-alerted-$1"
  ( cd "$M" && bash assistant/jarvis/tools/jarvis-status.sh alert "$2" ) > /dev/null 2>&1 || log "alert failed: $2"
}
cleared() { rm -f "$ST/main-sync-alerted-$1"; }
[ -d "$M/.git" ] || { echo "no ~/main here"; exit 1; }
ROLE=$(git -C "$M" config --get jarvis.role 2>/dev/null)
if [ "${1:-}" = status ]; then
  git -C "$M" fetch -q origin 2>/dev/null
  echo "~/main: role ${ROLE:-?}, branch $(git -C "$M" rev-parse --abbrev-ref HEAD), ahead $(git -C "$M" rev-list --count origin/main..HEAD) / behind $(git -C "$M" rev-list --count HEAD..origin/main) of the one history"
  echo "uncommitted here: $(git -C "$M" status --porcelain -uno | wc -l) tracked file(s)"
  tail -n 5 "$LOG" 2>/dev/null; exit 0
fi
[ "$ROLE" = main ] || exit 0
exec 8> "$ST/main-sync.lock"; flock -n 8 || exit 0
cd "$M" || exit 1
[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = main ] || { log "waiting: ~/main is not on branch main"; exit 0; }
for b in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD BISECT_LOG; do [ -e ".git/$b" ] && { log "waiting: a git operation is in progress in ~/main ($b)"; exit 0; }; done
git fetch -q origin 2>>"$LOG" || { log "fetch failed"; exit 1; }
H=$(git rev-parse HEAD); O=$(git rev-parse origin/main)
if [ "$H" != "$O" ] && ! git merge-base --is-ancestor HEAD origin/main; then
  if ! git merge-base --is-ancestor origin/main HEAD; then   # both sides have new commits: a merge, only if it is clean
    git diff --cached --quiet || { log "waiting: staged changes in ~/main (a commit in progress)"; exit 0; }
    if ! git merge-tree --write-tree HEAD origin/main > /dev/null 2>&1; then
      log "STOPPED: ~/main and the watcher changed the same lines; a session must merge by hand (git merge origin/main)"
      alert_once clash "~/main on the cloud machine and the cloud J.A.R.V.I.S. changed the same lines. Nothing is lost; a session in ~/main needs to run: git merge origin/main, sort out the clash, commit. Until then the two copies wait."
      exit 0
    fi
    git -c core.hooksPath=/dev/null merge -q --no-edit -m "Merge the cloud J.A.R.V.I.S.'s commits into ~/main (vm-main-sync.sh)" origin/main >> "$LOG" 2>&1 \
      || { git merge --abort > /dev/null 2>&1; log "waiting: the merge needs files that are mid-edit in ~/main"; exit 0; }
    cleared clash; log "merged $(git rev-list --count "$H"..origin/main) commit(s) from the one history"
  fi
else
  if [ "$H" != "$O" ]; then   # behind only: fast-forward
    git merge -q --ff-only origin/main >> "$LOG" 2>&1 && log "brought in $(git rev-list --count "$H"..HEAD) commit(s)" \
      || { log "waiting: the new commits touch files that are mid-edit in ~/main"; exit 0; }
  fi
fi
# ahead (own commits, or the merge above): push. A refusal means someone pushed in between: the next run merges first.
if [ -n "$(git rev-list origin/main..HEAD | head -1)" ]; then
  git -c core.hooksPath=/dev/null push -q origin HEAD:main >> "$LOG" 2>&1 && log "pushed $(git rev-list --count "$O"..HEAD 2>/dev/null) commit(s) to the one history" \
    || log "push refused (the history moved): the next run brings it in first"
fi
exit 0

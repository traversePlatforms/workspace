#!/bin/bash
# The laptop's side of the cloud J.A.R.V.I.S.'s copies (2026-11-19, TASKS X-15; design: JARVIS-CLOUD.md "Design"). Git Bash on the laptop.
#   bash traverse/ops/jarvis-cloud-sync.sh push     the repo (filtered exactly like GitHub's: Surge's restricted notes stripped) and the
#                                                   memory folder to the VM, only when they changed. ~30 s for the repo (nice 19).
#   bash traverse/ops/jarvis-cloud-sync.sh pull     what the cloud wrote, onto this laptop: its commits (git am -3, in order, each once by
#                                                   its Cloud-Id), its notes (jarvis-learned*.md, memory: merged line by line, nothing
#                                                   overwritten), TASKS.md (3-way, only when clean); code it left uncommitted is never
#                                                   applied, only kept for review with an alert. Jobs it queued go to the watcher.
#   bash traverse/ops/jarvis-cloud-sync.sh cycle    pull, then push if anything changed (help-watch.sh runs this every 2 minutes)
#   bash traverse/ops/jarvis-cloud-sync.sh done <ticket> <at>    a queued job is finished (moves it to merged/ on the VM)
#   bash traverse/ops/jarvis-cloud-sync.sh status   what is waiting each way
# Never pushes the local repo anywhere itself (its own mirror, like github-sync.sh), never deletes on the VM (moves to ~/jarvis/outbox/merged/,
# tidied after 14 days there). Off switch: touch "$LOCALAPPDATA/ProjectBackup/cloud-sync/off".
set -u
exec < /dev/null
REPO="${JARVIS_REPO:-/c/Users/Matthew sharpe/Desktop/claude test 2}"
MEMDIR="${JARVIS_MEMDIR:-/c/Users/Matthew sharpe/.claude/projects/c--Users-Matthew-sharpe-Desktop-claude-test-2/memory}"
PB="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup"
CS="${JARVIS_SYNC_STATE:-$PB/cloud-sync}"; HST="${JARVIS_HELP_ST:-$PB/help}"; mkdir -p "$CS" "$HST/cloud-jobs"
LOGF="$CS/sync.log"
VM="${JARVIS_VM:-$(cat "$CS/vm.txt" 2>/dev/null || echo yard@20.91.198.101)}"; VK="${JARVIS_VM_KEY:-/c/Users/SURGEI~1/.ssh/azure_yard}"
KEEP_OFF=(surge/brand/notes/ surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/)   # as github-sync.sh
MEM_EXCL="matthew-pay-review.md story-tier1-restricted.md"   # kept off the VM: his pay, and the Tier 1 pointer
export PATH="$PATH:$APPDATA/Python/Python313/Scripts:/c/Users/Surge Inc/AppData/Roaming/Python/Python313/Scripts"
log() { echo "$(date '+%F %T') $*" >> "$LOGF"; [ -n "${VERBOSE:-}" ] && echo "$*"; return 0; }
v() { if [ -n "${JARVIS_VM_STANDIN:-}" ]; then bash "$JARVIS_VM_STANDIN" "$@"; else ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$VK" "$VM" "$@"; fi; }
alert() { [ -n "${JARVIS_NO_ALERT:-}" ] && { log "alert (not sent): $1"; return 0; }; bash "$REPO/assistant/jarvis/tools/jarvis-status.sh" alert "$1" > /dev/null 2>&1 || log "alert failed: $1"; }
[ -f "$CS/off" ] && [ "${1:-}" != status ] && { echo "cloud sync is off ($CS/off)"; exit 0; }
# one at a time (no flock in Git Bash): a lock folder, taken over when it is over 30 minutes old (a run that died)
LK="$CS/lock.d"
if [ "${1:-}" != status ]; then
  if ! mkdir "$LK" 2>/dev/null; then
    [ $(( $(date +%s) - $(stat -c %Y "$LK" 2>/dev/null || date +%s) )) -gt 1800 ] && rmdir "$LK" 2>/dev/null && mkdir "$LK" 2>/dev/null || { echo "another sync is running"; exit 0; }
  fi
  trap 'rmdir "$LK" 2>/dev/null' EXIT
fi

# ---- push ------------------------------------------------------------------------------------------------------------------------------
push_repo() {
  local H M; H=$(git -C "$REPO" rev-parse HEAD) || return 1
  [ "$H" = "$(cat "$CS/pushed-head" 2>/dev/null)" ] && [ -z "${FORCE:-}" ] && return 0
  # at most every 10 minutes (the filter is ~30 s of the laptop); FORCE=1 or `push` by hand sends now
  [ -z "${FORCE:-}" ] && [ -f "$CS/pushed-head" ] && [ $(( $(date +%s) - $(stat -c %Y "$CS/pushed-head") )) -lt "${JARVIS_PUSH_EVERY:-600}" ] && return 0
  M="$CS/mirror"; rm -rf "$M"
  nice -n 19 git clone -q --no-local --single-branch --branch main "$REPO" "$M" || { log "push: clone failed"; return 1; }
  local args=(); for p in "${KEEP_OFF[@]}"; do args+=(--path "$p"); done
  ( cd "$M" && nice -n 19 git filter-repo --quiet --force --invert-paths "${args[@]}" < /dev/null ) || { log "push: filter-repo failed"; return 1; }
  for p in "${KEEP_OFF[@]}"; do git -C "$M" log --all --name-only --format= | grep -q "^$p" && { log "push: STOPPED, $p still in the history"; return 1; }; done
  # laptop commit -> its twin in the filtered history; a commit the filter emptied (Tier 1 only) maps to its nearest kept ancestor
  git -C "$REPO" log --format='%H %P' main > "$CS/parents.txt"
  node -e '
    const fs = require("fs"), [cm, par, out] = process.argv.slice(1);
    const map = new Map(); for (const l of fs.readFileSync(cm, "utf8").split("\n").slice(1)) { const [o, n] = l.trim().split(/\s+/); if (o && n) map.set(o, n); }
    const P = new Map(); for (const l of fs.readFileSync(par, "utf8").split("\n")) { const [h, p] = l.trim().split(/\s+/); if (h) P.set(h, p || ""); }
    const Z = /^0+$/, res = (h, d = 0) => { const n = map.get(h); if (n && !Z.test(n)) return n; const p = P.get(h); return p && d < 5000 ? res(p, d + 1) : ""; };
    const lines = []; for (const h of P.keys()) { const n = res(h); if (n) lines.push(h + " " + n); }
    fs.writeFileSync(out, lines.join("\n") + "\n");' "$M/.git/filter-repo/commit-map" "$CS/parents.txt" "$CS/commit-map" || { log "push: commit map failed"; return 1; }
  local F; F=$(git -C "$M" rev-parse HEAD)
  GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=20 -i $VK" git -C "$M" push -q --force "${JARVIS_VM_GIT:-ssh://$VM/home/yard/jarvis/repo.git}" main:main 2>>"$LOGF" || { log "push: git push to the VM failed"; return 1; }
  v 'mkdir -p ~/jarvis/incoming && cat > ~/jarvis/incoming/commit-map.tmp && mv ~/jarvis/incoming/commit-map.tmp ~/jarvis/incoming/commit-map' < "$CS/commit-map" || { log "push: commit map upload failed"; return 1; }
  printf '%s %s %s\n' "$H" "$(date +%s)" "$F" | v 'cat > ~/jarvis/incoming/laptop-head.txt'
  echo "$H" > "$CS/pushed-head"; log "push: repo $(git -C "$REPO" log -1 --format=%h) (filtered ${F:0:10}) sent"; rm -rf "$M"
}
push_memory() {
  [ -f "$MEMDIR/MEMORY.md" ] || { log "push: no memory folder at $MEMDIR"; return 1; }
  local SIG L
  SIG=$(cd "$MEMDIR" && find . -maxdepth 1 -type f -name '*.md' -printf '%f %s %T@\n' | sort | md5sum | cut -c1-32)
  [ "$SIG" = "$(cat "$CS/pushed-memory" 2>/dev/null)" ] && [ -z "${FORCE:-}" ] && return 0
  L=$(cd "$MEMDIR" && ls *.md | grep -vxF -f <(printf "%s
" $MEM_EXCL))
  tar -C "$MEMDIR" -czf "$CS/memory.tgz" $L || { log "push: memory tar failed"; return 1; }
  v 'mkdir -p ~/jarvis/incoming && cat > ~/jarvis/incoming/memory.tgz.tmp && mv ~/jarvis/incoming/memory.tgz.tmp ~/jarvis/incoming/memory.tgz' < "$CS/memory.tgz" || { log "push: memory upload failed"; return 1; }
  echo "$SIG" > "$CS/pushed-memory"; log "push: memory sent ($(cd "$MEMDIR" && ls *.md | wc -l) notes, $(echo $MEM_EXCL | wc -w) kept back)"
}

# ---- pull ------------------------------------------------------------------------------------------------------------------------------
IN="$CS/in"; REVIEW="$CS/review"; MERGED="$CS/merged.txt"; touch "$MERGED"
laptop_ids() { git -C "$REPO" log --format='%(trailers:key=Cloud-Id,valueonly)' main 2>/dev/null | grep -E '^c[0-9]{14}-[0-9a-f]{4}$' | sort -u; }
js() { node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));$2" "$1"; }
pull_bundle() {   # 0 = merged (or nothing to do); 1 = stopped (later bundles wait: order matters)
  local B="$1" b; b=$(basename "$B"); local -a DONE_REPO=(); local p kind state base cloud ours dirty pf cid
  [ -f "$B/meta.json" ] || { log "pull: $b has no meta.json: skipped"; return 0; }
  # 1. commits, in order, each once
  if [ -d "$B/patches" ]; then
    local have; have=$(laptop_ids)
    for pf in $(ls "$B/patches"/*.patch 2>/dev/null | sort); do
      cid=$(basename "$pf" .patch | sed -E 's/^[0-9]{4}-//'); grep -qx "$cid" <<< "$have" && continue
      [ -d "$REPO/.git/rebase-apply" ] && { log "pull: a git am is already in progress in the repo: $b waits"; return 1; }
      git -C "$REPO" diff --cached --quiet || { log "pull: the repo has staged changes (a builder mid-commit): $b waits"; return 1; }
      if git -C "$REPO" am -3 --keep-cr -q "$pf" >> "$LOGF" 2>&1; then rm -f "$CS/stuck-$cid"; log "pull: applied cloud commit $cid ($(git -C "$REPO" log -1 --format=%s | cut -c1-80))"; MERGED_ANY=1
      else
        git -C "$REPO" am --abort > /dev/null 2>&1
        if [ ! -f "$CS/stuck-$cid" ]; then touch "$CS/stuck-$cid"
          alert "The cloud J.A.R.V.I.S. made a change ($cid: $(grep -m1 '^Subject:' "$pf" | cut -c10-90)) that does not go onto the laptop's copy as it is now (a file it touches is being edited here, or changed both sides). Nothing was lost: it waits in the cloud sync and is tried again every 2 minutes. If it keeps waiting, ask a session to run: bash traverse/ops/jarvis-cloud-sync.sh status"; fi
        log "pull: cloud commit $cid does not apply yet: $b waits"; return 1
      fi
    done
  fi
  # 2. files the session left (notes merged line by line; TASKS.md 3-way; code kept for review); memory notes
  while IFS=$'\t' read -r area p kind state; do
    [ -n "$p" ] || continue
    [[ "$p" =~ ^[A-Za-z0-9._/@+\ -]+$ ]] && [[ "$p" != *..* ]] || { log "pull: odd path in $b skipped"; continue; }
    base="$B/$area/$p.base"; cloud="$B/$area/$p.cloud"; [ -f "$base" ] || base=/dev/null
    if [ "$area" = memory ]; then
      [ "$state" = deleted ] && { log "pull: the cloud removed memory note $p: NOT removed here (archive, never delete)"; continue; }
      ours="$MEMDIR/$p"; [ -f "$ours" ] || : > "$ours"
      git merge-file --union -q "$ours" "$base" "$cloud" 2>/dev/null; log "pull: memory $p merged ($state)"; MERGED_ANY=1; continue
    fi
    [ "$area" = repo ] || continue
    ours="$REPO/$p"
    case "$kind" in
      notes)
        [ "$state" = deleted ] && continue
        mkdir -p "$(dirname "$ours")"; [ -f "$ours" ] || : > "$ours"
        dirty=0; git -C "$REPO" diff --quiet -- "$p" 2>/dev/null || dirty=1
        git merge-file --union -q "$ours" "$base" "$cloud" 2>/dev/null
        [ "$dirty" = 0 ] && DONE_REPO+=("$p") || log "pull: $p merged in, left uncommitted (it had changes of its own here)"; MERGED_ANY=1;;
      tasks)
        local tmp; tmp=$(mktemp); cp "$ours" "$tmp"
        if [ "$state" != deleted ] && git merge-file -q "$tmp" "$base" "$cloud" 2>/dev/null; then
          dirty=0; git -C "$REPO" diff --quiet -- "$p" 2>/dev/null || dirty=1; cp "$tmp" "$ours"; [ "$dirty" = 0 ] && DONE_REPO+=("$p"); MERGED_ANY=1; log "pull: $p merged"
        else mkdir -p "$REVIEW/$b"; cp "$cloud" "$REVIEW/$b/$(echo "$p" | tr / _).cloud" 2>/dev/null; log "pull: $p changed both sides: the cloud's version kept for review in $REVIEW/$b"; fi
        rm -f "$tmp";;
      *)
        mkdir -p "$REVIEW/$b/$(dirname "$p")"; [ -f "$cloud" ] && cp "$cloud" "$REVIEW/$b/$p"; [ "$state" = deleted ] && echo deleted > "$REVIEW/$b/$p.DELETED"
        REV_ANY="$REV_ANY $p";;
    esac
  done < <(js "$B/meta.json" 'for (const f of j.files || []) if (f.area !== "commit") console.log([f.area, f.path, f.kind, f.state].join("\t"))')
  if [ "${#DONE_REPO[@]}" -gt 0 ]; then
    git -C "$REPO" commit -q -m "J.A.R.V.I.S. cloud: notes from $(js "$B/meta.json" 'console.log(j.id)') (merged line by line by jarvis-cloud-sync.sh)" -- "${DONE_REPO[@]}" >> "$LOGF" 2>&1 \
      && log "pull: committed ${DONE_REPO[*]}" || log "pull: could not commit ${DONE_REPO[*]} (left in the working tree)"
  fi
  echo "$b" >> "$MERGED"; MARK="$MARK $b"; return 0
}
pull() {
  MERGED_ANY=0; MARK=""; REV_ANY=""
  rm -rf "$IN"; mkdir -p "$IN"
  v 'mkdir -p ~/jarvis/outbox/changes ~/jarvis/outbox/jobs && tar -C ~/jarvis/outbox -czf - changes jobs' > "$CS/in.tgz" 2>>"$LOGF" || { log "pull: the VM did not answer"; return 1; }
  tar -xzf "$CS/in.tgz" -C "$IN" 2>>"$LOGF" || { log "pull: could not unpack"; return 1; }
  local B
  for B in $(find "$IN/changes" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort); do
    grep -qx "$(basename "$B")" "$MERGED" && { MARK="$MARK $(basename "$B")"; continue; }   # merged before; the move on the VM did not land
    pull_bundle "$B" || break
  done
  [ -n "$REV_ANY" ] && alert "The cloud J.A.R.V.I.S. left code changes it did not commit ($(echo $REV_ANY | cut -c1-150)). Nothing was applied on the laptop; they are kept for review in ProjectBackup/cloud-sync/review."
  # jobs it queued: to the watcher (help-watch.sh runs each once)
  local f id at
  for f in "$IN"/jobs/h*.json; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .json); at=$(js "$f" 'console.log(j.at||0)')
    grep -qx "$id $at" "$HST/cloud-jobs/done.txt" 2>/dev/null && continue
    cp "$f" "$HST/cloud-jobs/$id.json"
  done
  return 0
}
mark_merged() { [ -n "$MARK" ] || return 0; local b c=""; for b in $MARK; do [[ "$b" =~ ^[0-9]{8}-[0-9]{6}-[A-Za-z0-9-]+$ ]] && c="$c mv ~/jarvis/outbox/changes/$b ~/jarvis/outbox/merged/ 2>/dev/null;"; done; [ -n "$c" ] && v "mkdir -p ~/jarvis/outbox/merged; $c true"; }

case "${1:-status}" in
  push) FORCE=1 push_repo; FORCE=1 push_memory;;
  pull) pull; [ "$MERGED_ANY" = 1 ] && { push_repo; push_memory; }; mark_merged;;
  cycle) pull && { push_repo; push_memory; mark_merged; } || { push_repo; push_memory; };;
  done) ID="${2:?ticket}"; AT="${3:?at}"; [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] && [[ "$AT" =~ ^[0-9]+$ ]] || exit 2
        echo "$ID $AT" >> "$HST/cloud-jobs/done.txt"; rm -f "$HST/cloud-jobs/$ID.json"
        v "f=~/jarvis/outbox/jobs/$ID.json; [ -f \$f ] && grep -q '\"at\": *$AT[,}]' \$f && mv \$f ~/jarvis/outbox/merged/job-$ID-$AT.json; true";;
  status)
    echo "laptop HEAD $(git -C "$REPO" log -1 --format='%h %cd' --date=format:'%d %b %H:%M'); last sent $(cut -c1-10 "$CS/pushed-head" 2>/dev/null || echo never)"
    echo "on the VM: $(v 'echo "$(ls ~/jarvis/outbox/changes 2>/dev/null | wc -l) bundle(s), $(ls ~/jarvis/outbox/jobs 2>/dev/null | wc -l) job(s) waiting; repo $(git -C ~/jarvis/repo.git log -1 --format=%h main 2>/dev/null || echo none)"' 2>/dev/null || echo 'not reachable')"
    echo "jobs here waiting for the watcher: $(ls "$HST/cloud-jobs"/h*.json 2>/dev/null | wc -l)"
    ls "$CS"/stuck-* > /dev/null 2>&1 && echo "STUCK cloud commits: $(ls "$CS"/stuck-* | sed 's#.*/stuck-##' | tr '\n' ' ') (they apply once the files they touch are committed here)"
    [ -d "$REVIEW" ] && echo "kept for review: $(find "$REVIEW" -type f | wc -l) file(s) in $REVIEW"
    tail -n 5 "$LOGF" 2>/dev/null;;
  *) echo "push | pull | cycle | done <ticket> <at> | status"; exit 2;;
esac

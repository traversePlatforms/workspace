#!/bin/bash
# The 6 PM backup on the cloud computer (Matthew 23 Nov 2026: "If we can get the overnight check and 6pm drive back up going on the cloud
# lets run this"). Does what shared/tools/Backup-ToGoogleDrive.ps1 did on the laptop, to the same Drive folder
# (m.sharpe@traverseplatforms.com, My Drive/Backups/claude test 2), through rclone (remote "gtrav", made once with Matthew's Google
# sign-in: rclone config create gtrav drive scope=drive).
#   1. every 7 days (or --now): ONE locked archive core-YYYY-MM-DD.7z (7-Zip AES-256, names hidden; password ~/.ssh/backup-archive-pass.txt,
#      never printed) with the git history as one bundle, the memory, ~/TraverseBackups, the door-territory working data (no caches),
#      surge/clients and Surge's restricted notes. Tested, then uploaded; only the newest 2 kept, deleted for good (not to Drive's trash:
#      the trash counted against the traverseplatforms.com storage limit, 15 Nov).
#   2. every night: the GitHub copy (shared/tools/github-sync.sh; Surge's notes stripped). Needs `gh auth login` once on this machine.
#   3. every 7 days (or --media): the media mirror (surge/brand/videos, surge/brand/photos, traverse/videos, _archive) to .../media/.
# Log: $LOCALAPPDATA/ProjectBackup/gdrive.log (the overnight check shows its last line). Timer: traverse-drive-backup (6 pm MT).
set -u -o pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
LOCALAPPDATA="${LOCALAPPDATA:-$HOME/jarvis/localappdata}"; LOGD="$LOCALAPPDATA/ProjectBackup"; mkdir -p "$LOGD"; LOG="$LOGD/gdrive.log"
DEST="gtrav:Backups/claude test 2"; PASSF="$HOME/.ssh/backup-archive-pass.txt"; MEM="$HOME/.claude/projects/-home-yard-main/memory"
KEEP=2; EVERY=7; NOW=0; MEDIA=0
for a in "$@"; do case "$a" in --now) NOW=1;; --media) MEDIA=1;; esac; done
say() { echo "$(date '+%F %T')  $*" | tee -a "$LOG"; }
RC=(rclone --config "$HOME/.config/rclone/rclone.conf" --drive-use-trash=false --retries 3 --low-level-retries 10)
"${RC[@]}" lsd gtrav: > /dev/null 2>&1 || { say "FAILED: Google Drive not connected (run once: rclone config create gtrav drive scope=drive)"; exit 1; }
"${RC[@]}" mkdir "$DEST" 2>/dev/null
fail=0

# 1. the weekly locked archive
newest=$("${RC[@]}" lsf "$DEST" --include 'core-*.7z' 2>/dev/null | sort | tail -1)
nd=$(echo "$newest" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}'); age=999
[ -n "$nd" ] && age=$(( ( $(date +%s) - $(date -d "$nd" +%s) ) / 86400 ))
if [ $NOW = 1 ] || [ "$age" -ge $EVERY ]; then
  if [ ! -s "$PASSF" ]; then say "archive FAILED: password file missing ($PASSF; it comes over with vm-move-private.sh)"; fail=1
  else
    PASS=$(head -1 "$PASSF" | tr -d '\r\n'); [ ${#PASS} -ge 20 ] || { say "archive FAILED: password looks wrong (too short)"; fail=1; }
  fi
  if [ $fail = 0 ]; then
    ST=$(mktemp -d "$HOME/backup/drv.XXXXXX"); trap 'rm -rf "$ST"' EXIT; day=$(date +%F)
    git -C "$HOME/jarvis/repo.git" bundle create "$ST/repo.bundle" --all > /dev/null 2>&1 || git -C "$REPO" bundle create "$ST/repo.bundle" --all > /dev/null 2>&1
    say "git bundle $(du -m "$ST/repo.bundle" | cut -f1) MB"
    items=("$ST/repo.bundle")
    for p in "$MEM" "$HOME/TraverseBackups" "$REPO/traverse/data-pipeline/door-territory" "$REPO/surge/clients" "$REPO/surge/brand/notes"; do [ -e "$p" ] && items+=("$p"); done
    say "archive started"
    nice -n 15 7z a -t7z -mx=5 -mhe=on -p"$PASS" -bso0 -bsp0 "$ST/core-$day.7z" "${items[@]}" \
      '-xr!lidar-cache' '-xr!buildings' '-xr!raw' '-xr!node_modules' '-xr!se-cache' '-xr!days' '-xr!days-dfw' '-xr!cache' '-xr!logs-*' \
      '-xr!*.pdf' '-xr!elpaso-imagery' '-xr!pictures' > /dev/null 2>"$ST/err" \
      && 7z t -p"$PASS" -bso0 -bsp0 "$ST/core-$day.7z" > /dev/null 2>>"$ST/err" \
      && "${RC[@]}" copyto "$ST/core-$day.7z" "$DEST/core-$day.7z" 2>>"$ST/err" \
      && say "core-$day.7z $(du -m "$ST/core-$day.7z" | cut -f1) MB, tested, in Drive" \
      || { say "archive FAILED: $(tail -c 200 "$ST/err" | tr '\n' ' ')"; fail=1; }
    unset PASS
    if [ $fail = 0 ]; then
      "${RC[@]}" lsf "$DEST" --include 'core-*.7z' | sort -r | tail -n +$((KEEP + 1)) | while read -r o; do "${RC[@]}" deletefile "$DEST/$o" && say "removed old $o"; done
    fi
    rm -rf "$ST"; trap - EXIT
  fi
else say "archive not due (newest $newest, $age day(s) old)"; fi

# 2. the nightly GitHub copy
gh=$(bash "$REPO/shared/tools/github-sync.sh" 2>&1 | tail -3 | tr '\n' ' '); r=$?
[ $r = 0 ] && say "GitHub sync ok: $gh" || say "GitHub sync FAILED (exit $r): $gh"

# 3. the weekly media mirror
mark=$("${RC[@]}" cat "$DEST/media-last-run.txt" 2>/dev/null | head -1)
mage=999; [ -n "$mark" ] && mage=$(( ( $(date +%s) - $(date -d "$mark" +%s 2>/dev/null || echo 0) ) / 86400 ))
if [ $MEDIA = 1 ] || [ "$mage" -ge 7 ]; then
  for rel in surge/brand/videos surge/brand/photos traverse/videos _archive; do
    [ -d "$REPO/$rel" ] || continue
    if "${RC[@]}" sync "$REPO/$rel" "$DEST/media/$rel" --drive-use-trash=true 2>"$LOGD/gdrive-media.err"; then say "media mirror ok: $rel"
    else say "media mirror FAILED for $rel: $(tail -c 150 "$LOGD/gdrive-media.err" | tr '\n' ' ')"; fail=1; fi
  done
  date '+%F %H:%M' | "${RC[@]}" rcat "$DEST/media-last-run.txt"
fi
[ $fail = 0 ] && say "backup done" || say "backup finished with a failure (see above)"
exit $fail

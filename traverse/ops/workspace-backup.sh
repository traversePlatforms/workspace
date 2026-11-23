#!/bin/bash
# Off-site nightly backup of the WORKSPACE on the cloud computer (Matthew 23 Nov 2026: everything moves to the cloud computer; back it up
# to Azure "like the server"). Runs on Jarvis beside server-backup.sh, into the same Azure storage (jarvisbackup4821, container
# server-backups, under workspace/). Install: cp traverse/ops/workspace-backup.sh ~/backup/; cron 45 9 * * * (2:45 am Colorado).
#
# What: the one git history (a bundle of ~/jarvis/repo.git, every branch), everything in ~/main that git does not track (door data,
#   research, caches, Surge's restricted notes, personal/pay, the editions' codes files), ~/.ssh (codes files and service keys), the
#   memory, ~/.claude/CLAUDE.md, and ~/jarvis's config and state (not its tools or repo copy).
# Left out (rebuilt, not stored): traverse/editions/dist (node ../editions/build-editions.cjs, ~4 min), node_modules, ~/main/.git (the
#   bundle has the history), *.lock, Chrome profiles.
# How: Sunday a full archive (level 0); other nights only what changed since (GNU tar --listed-incremental). Each archive is ENCRYPTED with
#   age to ~/backup/recipient.txt before it leaves; the only key that opens it is on the laptop (~/.ssh/jarvis-backup-age.key), never here.
#   Keeps 5 weeks. Restore: unpack the Sunday full, then each night after it in order (tar -x -g /dev/null), git clone the bundle.
# Log: ~/backup/backup.log (one line per run, beside the server backup's).
set -u -o pipefail
B="$HOME/backup"; LOG="$B/backup.log"; D=$(date -u +%Y-%m-%d); C=server-backups; P=workspace
R=$(cat "$B/recipient.txt"); S="$B/workspace-snap"; mkdir -p "$S"
W=$(mktemp -d "$B/wtmp.XXXXXX"); trap 'rm -rf "$W"' EXIT
log() { echo "$(date -u '+%Y-%m-%d %H:%M')Z workspace: $*" >> "$LOG"; }
LEVEL=inc; { [ "$(date -u +%u)" = 7 ] || [ ! -s "$S/snap" ] || [ "${1:-}" = --full ]; } && LEVEL=full
[ $LEVEL = full ] && rm -f "$S/snap"
cp "$S/snap" "$W/snap" 2>/dev/null || :   # work on a copy: a failed night must not move the snapshot on

git -C "$HOME/jarvis/repo.git" bundle create "$W/repo.bundle" --all > /dev/null 2>&1 || { log "FAILED: git bundle"; exit 1; }
cd "$HOME" || exit 1
git -C main ls-files --others --ignored --exclude-standard -z --directory --no-empty-directory \
  | tr '\0' '\n' | grep -v -E '^traverse/editions/dist/|(^|/)node_modules(/|$)|\.lock$|/Chrome[^/]*/|chrome-profile' | sed 's#^#main/#' > "$W/list"
git -C main ls-files --others --exclude-standard -z | tr '\0' '\n' | sed 's#^#main/#' >> "$W/list"   # untracked, not ignored (work in progress)
for p in .ssh .claude/projects/-home-yard-main/memory .claude/CLAUDE.md jarvis/config jarvis/state jarvis/secrets jarvis/memory-base jarvis/localappdata backup/secrets backup/recipient.txt; do
  [ -e "$p" ] && echo "$p" >> "$W/list"; done
sort -u -o "$W/list" "$W/list"
tar -czf "$W/w.tgz" -g "$W/snap" --ignore-failed-read --exclude='main/traverse/editions/dist' --exclude='*/node_modules' \
  -C "$HOME" -T "$W/list" "${W#$HOME/}/repo.bundle" 2> "$W/err"
rc=$?; [ $rc -le 1 ] && [ -s "$W/w.tgz" ] || { log "FAILED: tar ($rc: $(tail -c 200 "$W/err" | tr '\n' ' '))"; exit 1; }
grep -q 'jarvis-backup-age.key' <(tar -tzf "$W/w.tgz") && { log "FAILED: the backup opening key got into the archive; nothing uploaded"; exit 1; }
N=$(tar -tzf "$W/w.tgz" | grep -vc '/$'); SZ=$(du -h "$W/w.tgz" | cut -f1)
age -r "$R" -o "$W/w.tgz.age" "$W/w.tgz" || { log "FAILED: encrypting"; exit 1; }
rm -f "$W/w.tgz"
NAME="$P/$D-$LEVEL.tgz.age"
az storage blob upload -c "$C" -n "$NAME" -f "$W/w.tgz.age" --overwrite --no-progress -o none || { log "FAILED: upload to Azure"; exit 1; }
cp "$W/snap" "$S/snap"   # only now: the next night's top-up starts from this one
# keep 5 weeks (36 days, so the oldest kept nightly still has its Sunday full)
cut=$(date -u -d '36 days ago' +%Y-%m-%d)
az storage blob list -c "$C" --prefix "$P/" --query "[].name" -o tsv | while read -r n; do d=${n#$P/}; d=${d:0:10}; [[ "$d" < "$cut" ]] && az storage blob delete -c "$C" -n "$n" -o none; done
log "ok $LEVEL: $N files, $SZ, encrypted and uploaded as $NAME"

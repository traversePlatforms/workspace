#!/bin/bash
# Move the laptop's private files to the cloud computer (Matthew 23 Nov 2026: "I would rather everything be on the cloud computer ...
# so we should just move everything over"; he then said yes to codes and keys, Surge's restricted notes, and the pay and finance files).
# Run ONCE on the laptop (Git Bash), from the repo:   bash traverse/ops/vm-move-private.sh          (--dry lists, sends nothing)
#
# What goes:
#   ~/.ssh: the codes files and service keys (everything but the laptop's own SSH keys, ssh config/known_hosts, and the backup's
#     opening key jarvis-backup-age.key, which stays off the VM so a break-in there cannot open the Azure backups)
#   in the repo, files git does not track: surge/brand/notes/, surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/, personal/pay/, and
#     every file the vmdata upload left out by name (codes / secret / token / password / credential / accounts.json / .key / .pem / .env /
#     finance, and -private/ folders, e.g. the editions' real rounds-codes.php)
#   memory: matthew-pay-review.md, story-tier1-restricted.md and their two MEMORY.md lines
# On the VM: ~/.ssh files land 0600 and never replace a file the VM already has (a clash is kept beside it as <name>.from-laptop and
# listed); repo files land in ~/main, still untracked (the pre-commit hooks keep refusing Tier 1 and pay paths, so they never reach git
# or GitHub). Every file is md5-checked after it lands. Nothing on the laptop is changed or deleted.
set -u
OPS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$OPS/../.." && pwd)"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) ;; *) echo "run this on the laptop (it sends the laptop's files to the VM)"; exit 2;; esac
PB="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup"; CS="$PB/cloud-sync"
VM="${JARVIS_VM:-$(cat "$CS/vm.txt" 2>/dev/null || echo yard@40.78.175.13)}"
VK="${JARVIS_VM_KEY:-/c/Users/SURGEI~1/.ssh/azure_yard}"; [ -f "$VK" ] || VK="$HOME/.ssh/azure_yard"
SSHD="${JARVIS_SSH_DIR:-/c/Users/SURGEI~1/.ssh}"; [ -d "$SSHD" ] || SSHD="$HOME/.ssh"
MEMDIR="${JARVIS_MEMDIR:-/c/Users/Matthew sharpe/.claude/projects/c--Users-Matthew-sharpe-Desktop-claude-test-2/memory}"
NOTES="matthew-pay-review.md story-tier1-restricted.md"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1
v() { ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -i "$VK" "$VM" "$@"; }
die() { echo "STOPPED: $*"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/p/ssh" "$T/p/repo" "$T/p/mem"

# 1. ~/.ssh, minus the laptop's own SSH keys and the backup opening key
n=0
for f in "$SSHD"/*; do
  [ -f "$f" ] || continue; b=$(basename "$f")
  case "$b" in id_*|azure_yard*|known_hosts*|config|authorized_keys|jarvis-backup-age.key|*.pub|sg.sh) continue;; esac
  cp -p "$f" "$T/p/ssh/$b"; n=$((n+1))
done
echo "== ~/.ssh: $n file(s)"

# 2. the repo's untracked private files
cd "$REPO" || die "no repo"
{
  for p in surge/brand/notes surge/brand/photos/restricted-boards-DO-NOT-PUBLISH personal/pay; do [ -d "$p" ] && find "$p" -type f; done
  git ls-files --others --ignored --exclude-standard -z | tr '\0' '\n' \
    | grep -v -E '(^|/)(node_modules|\.git)/' \
    | grep -i -E '(codes|secret|token|password|credential|finance)|accounts\.json$|\.key$|\.pem$|(^|/)\.env|-private/'
} | sort -u | grep -v -E '/Chrome[^/]*/|/chrome-profile|/browser-profile|/Default/' > "$T/repo.list"
while IFS= read -r f; do git ls-files --error-unmatch -- "$f" > /dev/null 2>&1 && continue; echo "$f"; done < "$T/repo.list" > "$T/repo.send"
echo "== repo: $(wc -l < "$T/repo.send") untracked private file(s), $(tar -cf - -T "$T/repo.send" 2>/dev/null | wc -c | awk '{printf "%.1f MB", $1/1048576}')"
sed 's#/[^/]*$##' "$T/repo.send" | sort | uniq -c | sort -rn | head -15

# 3. memory: the two notes and their index lines
for m in $NOTES; do [ -f "$MEMDIR/$m" ] && cp -p "$MEMDIR/$m" "$T/p/mem/$m"; done
grep -E "\(($(echo $NOTES | sed 's/ /|/g; s/\./\\./g'))\)" "$MEMDIR/MEMORY.md" > "$T/p/mem/MEMORY.lines" 2>/dev/null || true
echo "== memory: $(ls "$T/p/mem" | grep -c '\.md$') note(s), $(wc -l < "$T/p/mem/MEMORY.lines") index line(s)"

[ $DRY = 1 ] && { echo "== dry run: nothing sent"; exit 0; }

# 4. one archive, an md5 list inside it, sent in one go
tar -cf "$T/p/repo.tar" -T "$T/repo.send" || die "could not pack the repo files"
( cd "$T/p" && find . -type f ! -name MD5 -print0 | xargs -0 md5sum > MD5 ) || die "md5 list"
( cd "$T/p" && tar -czf "$T/move.tgz" . ) || die "pack"
echo "== sending $(du -h "$T/move.tgz" | cut -f1) to $VM"
v 'set -e; D=$(mktemp -d); trap "rm -rf $D" EXIT; tar -xzf - -C $D; cd $D; md5sum -c --quiet MD5 || { echo "MD5 FAILED in transit"; exit 3; }
   mkdir -p ~/.ssh; chmod 700 ~/.ssh; kept=""
   for f in ssh/*; do [ -f "$f" ] || continue; b=$(basename "$f")
     if [ -e "$HOME/.ssh/$b" ] && ! cmp -s "$f" "$HOME/.ssh/$b"; then cp "$f" "$HOME/.ssh/$b.from-laptop"; chmod 600 "$HOME/.ssh/$b.from-laptop"; kept="$kept $b"
     else cp "$f" "$HOME/.ssh/$b"; chmod 600 "$HOME/.ssh/$b"; fi; done   # 23 Nov: quoted (key files with spaces in their names broke it)
   [ -n "$kept" ] && echo "   kept the VM own copy (laptop copy beside it as .from-laptop):$kept"
   cd ~/main && tar -xpf $D/repo.tar && tar -tf $D/repo.tar | while IFS= read -r f; do [ -d "$f" ] || [ -f "$f" ] || echo "   MISSING $f"; done
   ( cd $D && tar -xOf repo.tar > /dev/null )
   M=~/.claude/projects/-home-yard-main/memory; for f in $D/mem/*.md; do [ -f "$f" ] && cp "$f" $M/; done
   [ -s $D/mem/MEMORY.lines ] && { grep -vxF -f $M/MEMORY.md $D/mem/MEMORY.lines >> $M/MEMORY.md || true; }
   n1=$(ls $D/ssh | wc -l); n2=$(tar -tf $D/repo.tar | grep -vc "/$"); echo "   landed: $n1 ~/.ssh file(s), $n2 repo file(s), memory notes"
   cd ~/main && git status --porcelain -- surge/brand/notes personal/pay | head -3 | sed "s/^/   GIT SEES: /"; true' < "$T/move.tgz" || die "the VM side stopped (see above); nothing on the laptop was changed"
echo "== done. On the VM: ls ~/.ssh, and the Tier 1 notes are at ~/main/surge/brand/notes (untracked)."

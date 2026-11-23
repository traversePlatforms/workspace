#!/bin/bash
# The VM as the main workspace (22 Nov 2026, Matthew: "make the cloud J.A.R.V.I.S. machine my main workspace"; TASKS X-15 target design 1).
# Design, what moved, how to connect, the rules: traverse/ops/VM-MAIN-WORKSPACE.md. Git Bash, ON THE LAPTOP.
#   bash traverse/ops/vm-main.sh prep       reversible, safe to repeat: ~/main on the VM (a standby copy: no commits, no deploys), its
#                                           memory, settings, hooks, the sync timer, the VM's own CLAUDE.md, LOCALAPPDATA + a cygpath stand-in
#   bash traverse/ops/vm-main.sh status     both sides: who is the main workspace, ~/main, the watcher's write mode, the laptop's state
#   bash traverse/ops/vm-main.sh flip --matthew-said-go
#                                           THE switch (Matthew's moment): the VM's history becomes the only one, the watcher always holds the
#                                           write turn, ~/main becomes the main copy, the laptop becomes a client that pulls and never commits
#   bash traverse/ops/vm-main.sh rollback --matthew-said-go
#                                           back to today: the VM's commits since the flip are replayed onto the laptop's own history (Tier 1
#                                           included), the laptop is the main workspace again, the VM goes back to standby
# Never sends Surge's restricted notes, his pay note or the Tier 1 pointer, codes files or keys. Never deletes: what it replaces is kept
# beside it (*.before-vm*), and the laptop's own history stays in its .git as refs/before-vm/main.
set -u
OPS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$OPS/../.." && pwd)"
PB="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup"; CS="$PB/cloud-sync"; mkdir -p "$CS"
VM="${JARVIS_VM:-$(cat "$CS/vm.txt" 2>/dev/null || echo yard@40.78.175.13)}"; VK="${JARVIS_VM_KEY:-/c/Users/SURGEI~1/.ssh/azure_yard}"
MEMDIR="${JARVIS_MEMDIR:-/c/Users/Matthew sharpe/.claude/projects/c--Users-Matthew-sharpe-Desktop-claude-test-2/memory}"
MEM_EXCL="matthew-pay-review.md story-tier1-restricted.md"   # as jarvis-cloud-sync.sh: never on the VM
KEEP_OFF="surge/brand/notes/ surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/"   # as github-sync.sh: never on the VM
VMMEM='.claude/projects/-home-yard-main/memory'
v() { ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -i "$VK" "$VM" "$@"; }
up() { scp -q -o BatchMode=yes -i "$VK" "$@"; }
say() { echo "== $*"; }
die() { echo "STOPPED: $*"; exit 1; }
strip_local() { grep -vE "\((matthew-pay-review|story-tier1-restricted)\.md\)" "$1"; return 0; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

mem_pack() {   # the laptop's memory minus the two kept-back notes; MEMORY.md without their index lines (those lines summarise them)
  mkdir -p "$T/mem"; local f n
  for f in "$MEMDIR"/*.md; do n=$(basename "$f"); [[ " $MEM_EXCL " == *" $n "* ]] && continue; cp "$f" "$T/mem/$n"; done
  strip_local "$MEMDIR/MEMORY.md" > "$T/mem/MEMORY.md"
  for n in $MEM_EXCL; do [ -e "$T/mem/$n" ] && die "memory pack still holds $n"; done
  grep -qE "\((matthew-pay-review|story-tier1-restricted)\.md\)" "$T/mem/MEMORY.md" && die "memory pack's MEMORY.md still names a kept-back note"
  tar -C "$T/mem" -czf "$T/mem.tgz" . && echo "$(ls "$T/mem" | wc -l)"
}
settings_pack() {   # the project's .claude/settings.local.json for Linux: same rules, Windows-only ones dropped, the server wrapper's path mapped
  node -e '
    const fs = require("fs"), s = JSON.parse(fs.readFileSync(process.argv[1], "utf8")), out = { permissions: { allow: [] } };
    for (const r of (s.permissions && s.permissions.allow) || []) {
      if (/^PowerShell\(/.test(r) || /\.exe/.test(r)) continue;                       // Windows only
      out.permissions.allow.push(r.replace("bash /c/Users/SURGEI~1/.ssh/sg.sh", "bash /home/yard/jarvis/bin/sg.sh"));
    }
    for (const k of ["deny", "ask"]) if (s.permissions && s.permissions[k]) out.permissions[k] = s.permissions[k];
    if (out.permissions.allow.some(r => /\/c\/Users/.test(r))) { console.error("a Windows path is left"); process.exit(1); }
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
    console.log(out.permissions.allow.length + " of " + s.permissions.allow.length + " rules (Windows-only dropped)");
  ' "$REPO/.claude/settings.local.json" "$T/settings.local.json"
}
vm_claude_md() { cat > "$T/CLAUDE.md" <<'EOF'
# This machine: Jarvis, the cloud computer (Azure, Linux). Loads in every Claude Code session here.

The project rules are in ~/main/CLAUDE.md (they load too). What is different on this machine (traverse/ops/VM-MAIN-WORKSPACE.md):

- `~/main` is Matthew's own working copy (VS Code Remote-SSH). `~/workspace` belongs to the cloud J.A.R.V.I.S. watcher: never edit it by hand.
- **No Surge drafting on this machine.** Surge's restricted notes (`surge/brand/notes/`, RESTRICTED.md and the Tier 1 notes included) are
  not here, on purpose, and must never be copied here. The project rules require reading RESTRICTED.md before any Surge draft, so any
  Surge post, caption, bio, recruiting copy, website copy or other Surge wording is done in the laptop workspace by Matthew: say so and stop.
  Traverse, Sixfold, Stringline, J.A.R.V.I.S. and personal work are fine here.
- Before the flip (`git -C ~/main config jarvis.role` says standby) the laptop is still the main workspace: ~/main refuses commits and deploys.
- The server: `bash ~/jarvis/bin/sg.sh trav '<command>'` (the Traverse account only). Sixfold's own site (`six`), Surge, 365 Aeration,
  Desktop files, Drive letters, Windows tasks: the laptop's.
- Never here: codes files, keys or tokens, the pay note (personal/pay/), the finance data.
EOF
}
hooks_pack() {
  cat > "$T/pre-commit" <<'EOF'
#!/bin/bash
# ~/main (vm-main.sh): no commits before the flip; never Surge's restricted notes or the pay folder
[ "$(git config --get jarvis.role)" = main ] || { echo "REFUSED: ~/main is the standby copy until the flip (bash traverse/ops/vm-main.sh flip, on the laptop). The laptop is still the main workspace."; exit 1; }
git diff --cached --name-only | grep -qE '^(surge/brand/(notes|photos/restricted-boards-DO-NOT-PUBLISH)/|personal/pay/)' && { echo "REFUSED: Surge's restricted notes and the pay folder never live on this machine"; exit 1; }
exit 0
EOF
  cat > "$T/post-commit" <<'EOF'
#!/bin/bash
# ~/main (vm-main.sh): every commit goes into the one history at once (vm-main-sync.sh also runs every 2 minutes)
[ "$(git config --get jarvis.role)" = main ] && [ -f traverse/ops/vm-main-sync.sh ] && { nohup bash traverse/ops/vm-main-sync.sh > /dev/null 2>&1 & }
exit 0
EOF
  cat > "$T/jarvis-main-sync.service" <<'EOF'
[Unit]
Description=~/main and the one history (traverse/ops/vm-main-sync.sh)
[Service]
Type=oneshot
ExecStart=/bin/bash %h/main/traverse/ops/vm-main-sync.sh
Nice=10
EOF
  cat > "$T/jarvis-main-sync.timer" <<'EOF'
[Unit]
Description=Every 2 minutes: ~/main and the one history
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
EOF
  cat > "$T/cygpath" <<'EOF'
#!/bin/bash
# a stand-in for Git Bash's cygpath on the VM (vm-main.sh): Linux paths are already Linux paths. -u/-w/-m/-d/-a just print the path.
while [ $# -gt 1 ] && [[ "$1" == -* ]]; do shift; done; printf '%s\n' "${1:-}"
EOF
}

case "${1:-status}" in
prep)
  say "1. the repo on the VM is the laptop's newest (filtered as GitHub's)"
  [ -f "$CS/vm-main" ] && die "already flipped: prep is for before the flip"
  FORCE=1 bash "$OPS/jarvis-cloud-sync.sh" push; tail -n 2 "$CS/sync.log"
  [ "$(cat "$CS/pushed-head" 2>/dev/null)" = "$(git -C "$REPO" rev-parse HEAD)" ] || echo "   (the push did not take the newest HEAD; ~/main gets the newest the VM has)"
  say "2. ~/main: a standby clone of ~/jarvis/repo.git"
  hooks_pack; vm_claude_md
  up "$T/pre-commit" "$T/post-commit" "$T/jarvis-main-sync.service" "$T/jarvis-main-sync.timer" "$T/cygpath" "$T/CLAUDE.md" "$VM:jarvis/incoming/" || die "upload failed"
  v 'set -e; cd ~
    if [ ! -d main/.git ]; then git clone -q ~/jarvis/repo.git main; echo "   cloned ~/main"; git -C main config jarvis.role standby; fi
    cd main; R=$(git config --get jarvis.role || echo standby)
    git config core.autocrlf false; git config user.name "Matthew Sharpe"; git config user.email "m.sharpe@surgeftw.com"
    printf "%s\n" "surge/brand/notes/" "surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/" "personal/pay/" >> .git/info/exclude; sort -u -o .git/info/exclude .git/info/exclude
    printf "%s\n" "traverse/ops/jarvis-learned*.md merge=union" > .git/info/attributes
    install -m 755 ~/jarvis/incoming/pre-commit ~/jarvis/incoming/post-commit .git/hooks/
    if [ "$R" = standby ]; then
      git fetch -q origin
      if [ -z "$(git status --porcelain -uno)" ]; then git checkout -q main 2>/dev/null || git checkout -q -b main origin/main; git reset -q --hard origin/main; echo "   ~/main at $(git log -1 --format="%h %s" | cut -c1-80)"
      else echo "   ~/main has uncommitted changes: left as it is (git -C ~/main status)"; fi
    else echo "   ~/main is already the main copy (role $R): not reset"; fi
    [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ] || { nice -n 10 npm ci --no-audit --no-fund --loglevel=error > /dev/null && echo "   npm ci done"; }
    node -e "require(\"sharp\"); require(\"terser\"); require(\"csso\"); console.log(\"   node modules: OK\")"
    mkdir -p ~/.config/systemd/user ~/jarvis/compat/bin ~/jarvis/localappdata/ProjectBackup
    install -m 644 ~/jarvis/incoming/jarvis-main-sync.service ~/jarvis/incoming/jarvis-main-sync.timer ~/.config/systemd/user/
    install -m 755 ~/jarvis/incoming/cygpath ~/jarvis/compat/bin/cygpath   # not ~/.local/bin: the services have that on PATH
    systemctl --user daemon-reload; systemctl --user enable --now jarvis-main-sync.timer > /dev/null 2>&1; echo "   sync timer: $(systemctl --user is-active jarvis-main-sync.timer) (does nothing until the flip)"
    if [ -f ~/.claude/CLAUDE.md ] && ! cmp -s ~/.claude/CLAUDE.md ~/jarvis/incoming/CLAUDE.md; then cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.before-vm-$(date +%Y%m%d%H%M%S); fi
    install -m 644 ~/jarvis/incoming/CLAUDE.md ~/.claude/CLAUDE.md; echo "   ~/.claude/CLAUDE.md: the VM rules (no Surge drafting here)"
    for f in ~/.profile ~/.bashrc; do grep -q "VM-MAIN-WORKSPACE" $f || { T=$(mktemp); { echo "export LOCALAPPDATA=\"\$HOME/jarvis/localappdata\" PATH=\"\$HOME/jarvis/compat/bin:\$PATH\"   # VM-MAIN-WORKSPACE.md: the laptop scripts keep their ProjectBackup here; cygpath stand-in"; cat $f; } > $T && cat $T > $f; rm -f $T; }; done
    echo "   LOCALAPPDATA and the cygpath stand-in (~/jarvis/compat/bin) set in ~/.profile and ~/.bashrc"' || die "VM step 2 failed"
  say "3. memory for ~/main ($MEM_EXCL kept back; MEMORY.md without their lines)"
  N=$(mem_pack) || exit 1
  v "set -e; M=~/$VMMEM; if [ -d \$M ] && [ \"\$(git -C ~/main config --get jarvis.role)\" = main ]; then echo '   already the main memory: not replaced'; cat > /dev/null; exit 0; fi
     D=\$(mktemp -d); tar -xzf - -C \$D; for n in $MEM_EXCL; do rm -f \$D/\$n; done
     mkdir -p \$(dirname \$M); [ -d \$M ] && mv \$M \$M.old.\$\$; mv \$D \$M; chmod 700 \$M; rm -rf \$M.old.\$\$; echo \"   \$(ls \$M | wc -l) notes in ~/$VMMEM\"" < "$T/mem.tgz" || die "memory step failed"
  say "4. permissions: ~/main/.claude/settings.local.json"
  settings_pack || die "settings conversion failed"
  v 'mkdir -p ~/main/.claude' && up "$T/settings.local.json" "$VM:main/.claude/settings.local.json" && v 'chmod 600 ~/main/.claude/settings.local.json; git -C ~/main check-ignore -q .claude/settings.local.json && echo "   in place (gitignored)"'
  say "5. checks"
  v 'cd ~/main; for p in surge/brand/notes surge/brand/photos/restricted-boards-DO-NOT-PUBLISH personal/pay; do [ -e "$p" ] && echo "   PROBLEM: $p is on the VM"; done
     git log --all --name-only --format= | grep -qE "^surge/brand/(notes|photos/restricted-boards-DO-NOT-PUBLISH)/" && echo "   PROBLEM: Tier 1 paths in the history" || echo "   Tier 1: not in the files or the history"
     for n in matthew-pay-review.md story-tier1-restricted.md; do [ -e ~/.claude/projects/-home-yard-main/memory/$n ] && echo "   PROBLEM: $n on the VM"; done
     grep -qE "\((matthew-pay-review|story-tier1-restricted)\.md\)" ~/.claude/projects/-home-yard-main/memory/MEMORY.md && echo "   PROBLEM: MEMORY.md names a kept-back note" || echo "   memory: no kept-back note or its index line"
     echo "   ~/main: role $(git config --get jarvis.role), $(git log -1 --format=%h), $(git status --porcelain | wc -l) changed/untracked; disk free $(df -h / | awk "NR==2{print \$4}")"'
  echo "prep done. Nothing is switched: the laptop is still the main workspace. Flip: bash traverse/ops/vm-main.sh flip --matthew-said-go";;

status)
  [ -f "$CS/vm-main" ] && echo "laptop: FLIPPED $(cat "$CS/vm-main") (a client: pulls from the VM, no commits)" || echo "laptop: the main workspace (not flipped)"
  echo "laptop HEAD $(git -C "$REPO" log -1 --format='%h %cd' --date=format:'%d %b %H:%M'); tracked changes: $(git -C "$REPO" status --porcelain -uno | wc -l)"
  v 'echo "VM ~/main: role $(git -C ~/main config --get jarvis.role 2>/dev/null || echo none), $(git -C ~/main log -1 --format="%h %cd" --date=format:"%d %b %H:%M" 2>/dev/null)"
     echo "VM watcher: $(grep -E "^(MODE|WRITE)=" ~/jarvis/config | tr "\n" " ")service $(systemctl --user is-active jarvis-cloud); sync timer $(systemctl --user is-active jarvis-main-sync.timer 2>/dev/null)"
     echo "VM one history (repo.git main): $(git -C ~/jarvis/repo.git log -1 --format="%h %cd" --date=format:"%d %b %H:%M" main)"
     echo "VM memory: $(ls ~/.claude/projects/-home-yard-main/memory 2>/dev/null | wc -l) notes in ~/main'"'"'s folder; ~/workspace'"'"'s is $( [ -L ~/.claude/projects/-home-yard-workspace/memory ] && echo "a link to it" || echo "its own")"
     echo "VM data: $(du -sh ~/main/traverse/app/data 2>/dev/null | cut -f1) app data; disk free $(df -h / | awk "NR==2{print \$4}")"';;

flip)
  [ "${2:-}" = --matthew-said-go ] || { echo "The flip makes the VM the main workspace and the laptop a client that no longer commits. Matthew's go only: add --matthew-said-go"; exit 2; }
  [ -f "$CS/vm-main" ] && die "already flipped ($(cat "$CS/vm-main"))"
  say "1. checks before anything changes"
  [ -z "$(git -C "$REPO" status --porcelain -uno)" ] || { git -C "$REPO" status --short -uno | head -20; die "the laptop has uncommitted changes to tracked files (above). Commit them first (or they stay on the laptop only), then flip again."; }
  for b in rebase-apply rebase-merge MERGE_HEAD; do [ -e "$REPO/.git/$b" ] && die "a git operation is in progress in the laptop repo ($b)"; done
  [ "$(git -C "$REPO" rev-parse --abbrev-ref HEAD)" = main ] || die "the laptop repo is not on branch main"
  v 'test "$(git -C ~/main config --get jarvis.role)" = standby && test -z "$(git -C ~/main status --porcelain -uno)"' || die "~/main is missing, not standby, or has uncommitted changes (run prep, or look: git -C ~/main status)"
  say "2. every cloud commit onto the laptop, then the laptop's history to the VM one last time"
  bash "$OPS/jarvis-cloud-sync.sh" pull; ls "$CS"/stuck-* > /dev/null 2>&1 && die "cloud commits are stuck on the laptop (jarvis-cloud-sync.sh status)"
  [ "$(v 'ls ~/jarvis/outbox/changes 2>/dev/null | wc -l')" = 0 ] || die "the VM still has change bundles the laptop has not merged (jarvis-cloud-sync.sh status); run the flip again in a few minutes"
  touch "$CS/off"   # the 2-minute cycle stands still from here
  for i in 1 2 3 4 5 6 7 8 9 10; do [ -d "$CS/lock.d" ] || break; sleep 15; done; [ -d "$CS/lock.d" ] && { rm -f "$CS/off"; die "a sync is still running; try again in a minute"; }
  rm -f "$CS/off"; FORCE=1 bash "$OPS/jarvis-cloud-sync.sh" push; touch "$CS/off"
  H=$(git -C "$REPO" rev-parse HEAD); [ "$(cat "$CS/pushed-head")" = "$H" ] || { rm -f "$CS/off"; die "the last push did not go through (sync.log); nothing switched"; }
  F=$(awk -v h="$H" '$1==h {print $2}' "$CS/commit-map" | tail -1); [ -n "$F" ] || { rm -f "$CS/off"; die "no filtered twin for $H"; }
  [ "$(v 'git -C ~/jarvis/repo.git rev-parse main')" = "$F" ] || { rm -f "$CS/off"; die "the VM's history is not the laptop's newest"; }
  echo "$H $F $(date +%s)" > "$CS/flip-point"
  say "3. the VM: ~/main the main copy, the one history guarded, the watcher always holds the write turn"
  N=$(mem_pack) || exit 1
  v "set -e; cd ~/main; git fetch -q origin; git reset -q --hard origin/main; test \"\$(git rev-parse HEAD)\" = $F
     M=~/$VMMEM; D=\$(mktemp -d); tar -xzf - -C \$D; for n in $MEM_EXCL; do rm -f \$D/\$n; done; [ -d \$M ] && mv \$M \$M.before-flip-\$(date +%Y%m%d%H%M%S); mv \$D \$M; chmod 700 \$M
     W=~/.claude/projects/-home-yard-workspace/memory; if [ -d \$W ] && [ ! -L \$W ]; then mv \$W \$W.before-vm-main; fi; mkdir -p \$(dirname \$W); ln -sfn \$M \$W
     git -C ~/jarvis/repo.git config receive.denyNonFastForwards true; git -C ~/jarvis/repo.git config receive.denyDeletes true
     git config jarvis.role main; git branch -q --set-upstream-to=origin/main main
     grep -q '^WRITE=' ~/jarvis/config && sed -i 's/^WRITE=.*/WRITE=vm/' ~/jarvis/config || echo WRITE=vm >> ~/jarvis/config
     systemctl --user restart jarvis-cloud; sleep 3; echo \"   watcher: \$(systemctl --user is-active jarvis-cloud), \$(grep -E '^(MODE|WRITE)=' ~/jarvis/config | tr '\n' ' ')\"
     bash ~/jarvis/ops/help-watch-cloud.sh --check | grep -E '^(mode|write|STUCK)'" < "$T/mem.tgz" || { rm -f "$CS/off"; die "the VM step failed: see above. The laptop is unchanged; run: bash traverse/ops/vm-main.sh rollback --matthew-said-go to put the VM back"; }
  say "4. the laptop: a client of the VM's history (its own kept as refs/before-vm/main)"
  cd "$REPO" || exit 1
  git update-ref refs/before-vm/main "$H"
  git remote get-url vm > /dev/null 2>&1 || git remote add vm "ssh://$VM/home/yard/jarvis/repo.git"
  git config core.sshCommand "ssh -i $VK -o BatchMode=yes -o ConnectTimeout=20"
  git fetch -q vm || die "fetch from the VM failed (the VM is switched; the laptop is not: run the flip's step 4 again or roll back)"
  for p in $KEEP_OFF; do grep -qxF "$p" .git/info/exclude || echo "$p" >> .git/info/exclude; done   # Tier 1 stays here, untracked, never added
  git reset -q --mixed vm/main && git branch -q --set-upstream-to=vm/main main
  [ -z "$(git status --porcelain -uno)" ] || { git status --short -uno | head; echo "   (the files above differ from the VM's copy: look before working)"; }
  for p in $KEEP_OFF; do [ -e "$p" ] && echo "   $p: still here on the laptop, untracked (in the Drive backup: Backup-ToGoogleDrive.ps1)"; done
  [ -f .git/hooks/pre-commit ] && cp .git/hooks/pre-commit ".git/hooks/pre-commit.before-vm"
  printf '%s\n' '#!/bin/bash' '# vm-main.sh flip: the VM is the main workspace; the laptop only pulls (VM-MAIN-WORKSPACE.md)' \
    'echo "REFUSED: the laptop no longer commits since the flip. Work in ~/main on the VM (VS Code: Remote-SSH, jarvis-cloud). Back: bash traverse/ops/vm-main.sh rollback --matthew-said-go"; exit 1' > .git/hooks/pre-commit
  git config jarvis.role client
  mkdir -p "$CS/mem-base"; for f in "$T/mem"/*.md; do cp "$f" "$CS/mem-base/"; done   # the memory sync's starting point = what the VM just got
  echo "$(date '+%F %T') $F" > "$CS/vm-main"; rm -f "$CS/off"
  say "done: the VM is the main workspace."
  echo "   VS Code: Ctrl+Shift+P > Remote-SSH: Connect to Host > jarvis-cloud > File > Open Folder > /home/yard/main"
  echo "   Back to the laptop: bash traverse/ops/vm-main.sh rollback --matthew-said-go";;

rollback)
  [ "${2:-}" = --matthew-said-go ] || { echo "Rollback makes the laptop the main workspace again. Matthew's go only: add --matthew-said-go"; exit 2; }
  cd "$REPO" || exit 1
  if [ -f "$CS/vm-main" ]; then
    say "1. the VM's newest memory and commits here first (one last client cycle)"
    [ -z "$(git status --porcelain -uno)" ] || die "the laptop has uncommitted changes to tracked files: commit or set them aside first"
    read -r H F AT < "$CS/flip-point" || die "no flip-point record"
    v 'systemctl --user stop jarvis-main-sync.timer; git -C ~/main config jarvis.role standby'   # ~/main: no more commits from here
    bash "$OPS/jarvis-cloud-sync.sh" cycle; touch "$CS/off"
    git fetch -q vm || { rm -f "$CS/off"; die "the VM did not answer: nothing changed on the laptop (~/main is standby; vm-main.sh flip again to undo that)"; }
    say "2. the VM's commits since the flip replayed onto the laptop's own history"
    N=$(git rev-list --count "$F"..vm/main); echo "   $N commit(s) on the VM since the flip"
    K="$CS/tier1-before-rollback-$(date +%Y%m%d%H%M%S)"; mkdir -p "$K"   # the Tier 1 notes as they are now (the replay checks out the old copies)
    for p in $KEEP_OFF; do [ -d "$p" ] && { mkdir -p "$K/$(dirname "$p")"; cp -a "$p" "$K/$(dirname "$p")/"; }; done
    git reset -q --hard vm/main   # only tracked files (the tree was clean): now exactly the VM's newest
    git -c core.hooksPath=/dev/null rebase -q --onto "$H" "$F" main 2>&1 | tail -3
    { [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; } && die "the replay stopped on a clash: git status, sort it out, git rebase --continue, then run rollback again (Tier 1 notes as they were: $K)"
    git ls-files --error-unmatch surge/brand/notes/RESTRICTED.md > /dev/null 2>&1 || die "the laptop's history is not back (Tier 1 notes not tracked): look before going on (copies in $K)"
    for p in $KEEP_OFF; do [ -d "$K/$p" ] && cp -a "$K/$p/." "$p/"; done   # edits made to them since the flip come back (git shows them as changes)
    for p in $KEEP_OFF; do grep -vxF "$p" .git/info/exclude > "$T/ex"; cp "$T/ex" .git/info/exclude; done
    if [ -f .git/hooks/pre-commit.before-vm ]; then mv .git/hooks/pre-commit.before-vm .git/hooks/pre-commit; else rm -f .git/hooks/pre-commit; fi
    git config --unset jarvis.role; git branch -q --unset-upstream 2>/dev/null
    mv "$CS/vm-main" "$CS/vm-main.rolled-back-$(date +%Y%m%d%H%M%S)"
  fi
  say "3. the VM back to standby (the watcher: write turn only while the laptop is away, as before)"
  v 'set -e; sed -i "/^WRITE=/d" ~/jarvis/config; git -C ~/jarvis/repo.git config receive.denyNonFastForwards false
     W=~/.claude/projects/-home-yard-workspace/memory; if [ -L $W ]; then rm $W; [ -d $W.before-vm-main ] && mv $W.before-vm-main $W || true; fi
     git -C ~/main config jarvis.role standby; systemctl --user restart jarvis-cloud; sleep 3
     echo "   watcher: $(systemctl --user is-active jarvis-cloud), $(grep -E "^MODE=" ~/jarvis/config)"'
  rm -f "$CS/off"; FORCE=1 bash "$OPS/jarvis-cloud-sync.sh" push; tail -n 2 "$CS/sync.log"
  echo "rolled back: the laptop is the main workspace again. ~/main is a standby copy (prep refreshes it)."
  echo "   Laptop memory: notes written on the VM since the flip came down with the last cycles; check MEMORY.md if one is missing.";;
*) echo "prep | status | flip --matthew-said-go | rollback --matthew-said-go"; exit 2;;
esac

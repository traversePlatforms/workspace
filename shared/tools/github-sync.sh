#!/bin/bash
# Copies the project to GitHub (github.com/TraversePlatforms/workspace, private), set up 2026-10-25.
# Surge's restricted notes never go up (Matthew, 25 Oct: "All but Surge's notes"): each run makes a fresh copy of the local history,
# strips those paths from every commit, and pushes that. The local repo is never changed. The stripping gives the same commits
# every time, so each push only adds what's new.
#   bash shared/tools/github-sync.sh          copy and push
#   bash shared/tools/github-sync.sh --dry    copy and strip only, print what would go up
set -eu
REPO="/c/Users/Surge Inc/Desktop/claude test 2"
MIRROR="$LOCALAPPDATA/ProjectBackup/github-mirror"
REMOTE="https://github.com/traversePlatforms/workspace.git"
KEEP_OFF=(surge/brand/notes/ surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/)
export PATH="$PATH:$APPDATA/Python/Python313/Scripts:/c/Users/Surge Inc/AppData/Roaming/Python/Python313/Scripts"

rm -rf "$MIRROR"
git clone -q --no-local --single-branch --branch main "$REPO" "$MIRROR"
cd "$MIRROR"
args=(); for p in "${KEEP_OFF[@]}"; do args+=(--path "$p"); done
git filter-repo --quiet --force --invert-paths "${args[@]}"

# check: none of the kept-off paths in any commit
for p in "${KEEP_OFF[@]}"; do
  if git log --all --name-only --format= | grep -q "^$p"; then echo "STOPPED: $p still in the history" >&2; exit 1; fi
done
echo "$(git rev-list --count main) commits, $(git ls-files | wc -l) files; Surge notes not included"

[ "${1:-}" = --dry ] && { echo "dry run: nothing pushed"; exit 0; }
git remote add origin "$REMOTE"
git push -u origin main

#!/bin/bash
# safe-extract.sh DEST [ARCHIVE|-]   (lives on the server as ~/bin/safe-extract.sh; 2026-10-27, code review item 9)
# Unpacks a tar (gzip or plain) into a staging folder beside DEST, then renames each file into DEST. A rename on the same filesystem is
# atomic, so a request never reads a half-written rounds.php or town file (the PHP log held 16 parse errors from in-place `tar xzf`
# uploads on a dropping connection). The staging folder sits beside DEST, not inside it, so nothing is web-reachable mid-upload.
# Prints "md5  path" for every placed file, paths relative to DEST, sorted by path, like `cd DEST && md5sum <files>`.
set -eu
dest="${1:?usage: safe-extract.sh DEST [ARCHIVE|-]}"; src="${2:--}"
dest="$(cd "$dest" && pwd)"
inc="$(dirname "$dest")/.incoming-$(basename "$dest")-$$"
mkdir -p "$inc"
trap 'rm -rf "$inc" "$inc.tar"' EXIT
if [ "$src" = "-" ]; then cat > "$inc.tar"; src="$inc.tar"; fi
tar xf "$src" -C "$inc"
cd "$inc"
find . -type f | sed 's#^\./##' | sort > "$inc.list"
while IFS= read -r f; do
  d="$(dirname "$f")"; [ "$d" != "." ] && mkdir -p "$dest/$d"
  mv -f "$inc/$f" "$dest/$f"
done < "$inc.list"
cd "$dest"
while IFS= read -r f; do md5sum "$f"; done < "$inc.list" | sort -k2
rm -f "$inc.list"

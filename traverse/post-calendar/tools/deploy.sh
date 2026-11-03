#!/bin/bash
# Post calendar upload (2026-10-31): bash traverse/post-calendar/tools/deploy.sh [--check]
#   builds dist/ (index.html and sw.js minified like the other private desks; the rest as is), backs up what it replaces to
#   ~/upload-backups/before-postcal-<stamp>.tgz, uploads with ~/bin/safe-extract.sh (rename into place), and compares every file by md5.
#   --check: build and compare with the live copy, send nothing.
# Server: public_html/<path>/ (page, api/cal.php, media/.htaccess) and post-calendar-tools/ (lib.php, runner.php, public-path.txt) beside it;
# post-calendar-data/ (+ private/) made with chmod 700. Never touches post-calendar-data's files or the pictures in media/.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"; PC="$REPO/traverse/post-calendar"
PUBP="$(tr -d '[:space:]' < "$PC/.public-path")"; SITE='$HOME/www/traverseplatforms.com'
SG=(bash /c/Users/SURGEI~1/.ssh/sg.sh trav)
MIN="$REPO/shared/tools/minify-public.cjs"; [ -d "$REPO/node_modules/terser" ] || MIN="$REPO/../../../shared/tools/minify-public.cjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
D="$PC/dist"; rm -rf "${D:?}"; mkdir -p "$D/public/api" "$D/public/media" "$D/tools"
node "$MIN" "$PC/app" "$D/public" index.html sw.js >/dev/null
cp "$PC/app/manifest.json" "$PC/app/icon-192.png" "$PC/app/icon-512.png" "$PC/app/icon-maskable-512.png" "$PC/app/apple-touch-icon.png" "$D/public/"
cp "$PC/app/api/cal.php" "$D/public/api/"; cp "$PC/app/media/.htaccess" "$D/public/media/"
cp "$PC/server/lib.php" "$PC/server/runner.php" "$PC/server/public-path.txt" "$D/tools/"
norm() { tr -d '*' | awk '{print $1, $2}' | LC_ALL=C sort -k2; }   # "hash path", whatever md5sum's flavour
( cd "$D/public" && find . -type f | sed 's#^\./##' | xargs md5sum ) | norm > "$D/public.md5"
( cd "$D/tools" && find . -type f | sed 's#^\./##' | xargs md5sum ) | norm > "$D/tools.md5"
live() { "${SG[@]}" "cd $SITE/$1 2>/dev/null && md5sum $(awk '{printf "%s ", $2}' "$D/$2.md5") 2>/dev/null" < /dev/null | norm || true; }
if [ "${1:-}" = "--check" ]; then
  echo "page:";  diff "$D/public.md5" <(live "public_html/$PUBP" public) && echo "  same as live"
  echo "tools:"; diff "$D/tools.md5" <(live post-calendar-tools tools) && echo "  same as live"
  exit 0
fi
# back up what is there (nothing on the first upload)
"${SG[@]}" "cd $SITE && mkdir -p \$HOME/upload-backups && f=\$(ls -d public_html/$PUBP/index.html public_html/$PUBP/sw.js public_html/$PUBP/manifest.json public_html/$PUBP/api/cal.php public_html/$PUBP/media/.htaccess post-calendar-tools 2>/dev/null || true); if [ -n \"\$f\" ]; then tar czf \$HOME/upload-backups/before-postcal-$STAMP.tgz \$f && echo backed up to upload-backups/before-postcal-$STAMP.tgz; else echo nothing to back up; fi" < /dev/null
"${SG[@]}" "cd $SITE && mkdir -p public_html/$PUBP/media post-calendar-tools post-calendar-data/private && chmod 700 post-calendar-data post-calendar-data/private && chmod 755 public_html/$PUBP public_html/$PUBP/media" < /dev/null
tar -C "$D/public" -cf - . | "${SG[@]}" "\$HOME/bin/safe-extract.sh $SITE/public_html/$PUBP -" > "$D/public.placed"
tar -C "$D/tools" -cf - . | "${SG[@]}" "\$HOME/bin/safe-extract.sh $SITE/post-calendar-tools -" > "$D/tools.placed"
ok=1
diff "$D/public.md5" <(norm < "$D/public.placed") >/dev/null || { echo "page: md5 MISMATCH"; ok=0; }
diff "$D/tools.md5" <(norm < "$D/tools.placed") >/dev/null || { echo "tools: md5 MISMATCH"; ok=0; }
[ $ok = 1 ] && echo "uploaded: $(wc -l < "$D/public.md5") page files, $(wc -l < "$D/tools.md5") tool files, md5 match"
"${SG[@]}" "php -l $SITE/post-calendar-tools/lib.php && php -l $SITE/post-calendar-tools/runner.php && php -l $SITE/public_html/$PUBP/api/cal.php" < /dev/null

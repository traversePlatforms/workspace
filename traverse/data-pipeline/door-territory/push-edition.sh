#!/bin/bash
# (kept with the door-territory scripts 2026-10-26; temp files go to the session scratchpad named below)
# 2026-10-26: push one edition's new and changed town data to the live server (all Colorado towns). Never index.json/company.json
# (merged, not replaced) and never hail-storms.json (the server's storm job owns it). Backup first, md5 every file, merge, clear caches.
# 2026-10-28 (Group 1 re-clip): optional second argument, an extended regex on file names, sends only the matching changed files
# (e.g. 'g1-' for the Group 1 towns and their side files); DRY=1 lists what would go, by name, and sends nothing.
set -u
d="$1"; ONLY="${2:-}"; S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/editions/dist/$d/rounds" || exit 1
find . -maxdepth 1 -type f -name '*.json' ! -name index.json ! -name company.json ! -name hail-storms.json -printf '%f\n' | sort > $S/p-$d.all
md5sum $(cat $S/p-$d.all) | sed 's/ \*/  /' | sort -k2 > $S/p-$d.local
$SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum *.json 2>/dev/null | sort -k2" < /dev/null > $S/p-$d.live
join -1 2 -2 2 -a 1 -e NONE -o 0,1.1,2.1 $S/p-$d.local $S/p-$d.live | awk '$2!=$3{print $1}' > $S/p-$d.up
if [ -n "$ONLY" ]; then echo "$d: $(wc -l < $S/p-$d.up) changed, $(grep -cvE "$ONLY" $S/p-$d.up) left out (not matching $ONLY)"; grep -E "$ONLY" $S/p-$d.up > $S/p-$d.up2; mv $S/p-$d.up2 $S/p-$d.up; fi
n=$(wc -l < $S/p-$d.up); echo "$d: $n files to send"
if [ "${DRY:-}" = 1 ]; then cat $S/p-$d.up; exit 0; fi
if [ "$n" -gt 0 ]; then
  awk 'NR==FNR{w[$1];next} ($2 in w)' $S/p-$d.up $S/p-$d.local | sort -k2 > $S/p-$d.want
  tar czf $S/p-$d.tgz $(cat $S/p-$d.up); echo "  package $(( $(stat -c %s $S/p-$d.tgz) / 1048576 )) MB"
  cat $S/p-$d.up | $SG "cd ~/www/traverseplatforms.com/$d/rounds && tar czf ~/upload-backups/before-push-$d-$(date +%Y%m%d-%H%M%S).tgz index.json company.json \$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done) && echo '  backed up'" || exit 1
  # rename into place (2026-10-27, code review item 9): ~/bin/safe-extract.sh stages beside rounds/ and renames each file, so a phone never
  # reads a half-written town file; it prints the placed files' md5 like the old `md5sum $(tar tzf)`. Backups are time-stamped (a second
  # push the same day no longer overwrites the first one's backup).
  cat $S/p-$d.tgz | $SG "~/bin/safe-extract.sh ~/www/traverseplatforms.com/$d/rounds -" > $S/p-$d.after || exit 1
  if diff -q $S/p-$d.want $S/p-$d.after > /dev/null; then echo "  MD5 MATCH ($(wc -l < $S/p-$d.after))"; else echo "  MD5 MISMATCH"; exit 1; fi
fi
tar czf - index.json company.json | $SG "mkdir -p /tmp/mi-$d && tar xzf - -C /tmp/mi-$d && python3 ~/merge-edition-index.py ~/www/traverseplatforms.com/$d/rounds /tmp/mi-$d/index.json /tmp/mi-$d/company.json && rm -rf /tmp/mi-$d && cd ~/www/traverseplatforms.com/$d/rounds && rm -f search-index.txt && python3 -c 'import json;json.load(open(\"index.json\"));json.load(open(\"company.json\"));print(\"  json ok\")'"

#!/bin/bash
# (kept with the door-territory scripts 2026-10-26; temp files go to the session scratchpad named below)
# 2026-10-26: push one edition's new and changed town data to the live server (all Colorado towns). Never index.json/company.json
# (merged, not replaced) and never hail-storms.json (the server's storm job owns it). Backup first, md5 every file, merge, clear caches.
set -u
d="$1"; S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/editions/dist/$d/rounds" || exit 1
find . -maxdepth 1 -type f -name '*.json' ! -name index.json ! -name company.json ! -name hail-storms.json -printf '%f\n' | sort > $S/p-$d.all
md5sum $(cat $S/p-$d.all) | sed 's/ \*/  /' | sort -k2 > $S/p-$d.local
$SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum *.json 2>/dev/null | sort -k2" < /dev/null > $S/p-$d.live
join -1 2 -2 2 -a 1 -e NONE -o 0,1.1,2.1 $S/p-$d.local $S/p-$d.live | awk '$2!=$3{print $1}' > $S/p-$d.up
n=$(wc -l < $S/p-$d.up); echo "$d: $n files to send"
if [ "$n" -gt 0 ]; then
  awk 'NR==FNR{w[$1];next} ($2 in w)' $S/p-$d.up $S/p-$d.local | sort -k2 > $S/p-$d.want
  tar czf $S/p-$d.tgz $(cat $S/p-$d.up); echo "  package $(( $(stat -c %s $S/p-$d.tgz) / 1048576 )) MB"
  cat $S/p-$d.up | $SG "cd ~/www/traverseplatforms.com/$d/rounds && tar czf ~/upload-backups/before-alltowns2-$d-20261026.tgz index.json company.json \$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done) && echo '  backed up'" || exit 1
  cat $S/p-$d.tgz | $SG "cat > ~/p.tgz && cd ~/www/traverseplatforms.com/$d/rounds && tar xzf ~/p.tgz && md5sum \$(tar tzf ~/p.tgz) | sort -k2 && rm -f ~/p.tgz" > $S/p-$d.after || exit 1
  if diff -q $S/p-$d.want $S/p-$d.after > /dev/null; then echo "  MD5 MATCH ($(wc -l < $S/p-$d.after))"; else echo "  MD5 MISMATCH"; exit 1; fi
fi
tar czf - index.json company.json | $SG "mkdir -p /tmp/mi-$d && tar xzf - -C /tmp/mi-$d && python3 ~/merge-edition-index.py ~/www/traverseplatforms.com/$d/rounds /tmp/mi-$d/index.json /tmp/mi-$d/company.json && rm -rf /tmp/mi-$d && cd ~/www/traverseplatforms.com/$d/rounds && rm -f search-index.txt && python3 -c 'import json;json.load(open(\"index.json\"));json.load(open(\"company.json\"));print(\"  json ok\")'"

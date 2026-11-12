#!/bin/bash
# 2026-10-30: push one kind of per-house side file (e.g. 'moved-', the new movers) from this computer's traverse/app/data/rounds/ to the
# Sixfold 365 install's data (traverseplatforms.com sixfold-data/rounds/). Usage: push-sixfold-side.sh <prefix>   e.g.  push-sixfold-side.sh moved-
# Only the side files of towns Sixfold already has (<town>.json on the server), only new or changed ones (md5), never index.json,
# company.json or any town file itself. Backup first (~/upload-backups/before-six-<prefix>-<time>.tgz), then ~/bin/safe-extract.sh renames
# each file into place (a phone never reads half a file), then every placed file's md5 is compared. DRY=1 lists what would go and sends nothing.
# The editions get the same files from build-editions.cjs (keep() filters) and push-edition.sh; Sixfold reads data/rounds directly.
set -u
exec < /dev/null   # review 12 Nov: md5sum fails when a job is started with its input closed (push-edition.sh, 11 Nov), and here that read as "no change"
PRE="${1:-}"; [ -z "$PRE" ] && { echo "usage: push-sixfold-side.sh <prefix>   e.g. moved-"; exit 1; }
case "$PRE" in *[!a-z0-9-]*) echo "prefix: letters, digits and - only"; exit 1;; esac
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp"; mkdir -p "$S"   # short path: $S is used unquoted below
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
R="~/www/traverseplatforms.com/sixfold-data/rounds"
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds" || exit 1
T="$S/p6-$PRE"
ls "$PRE"*.json 2>/dev/null | sort > "$T.mine"
[ -s "$T.mine" ] || { echo "no $PRE*.json here"; exit 1; }
# what the server has: its town files (to keep to Sixfold's towns) and the md5 of the side files already there
$SG "cd $R && ls *.json | sed -n 's/^\([a-z0-9-]*\)\.json\$/\1/p' | sort; echo '--'; md5sum $PRE*.json 2>/dev/null | sort -k2" < /dev/null > "$T.live" || exit 1
sed -n '1,/^--$/p' "$T.live" | grep -v '^--$' > "$T.towns"
sed -n '/^--$/,$p' "$T.live" | grep -v '^--$' > "$T.livemd5"
: > "$T.want"
while read -r f; do t="${f#$PRE}"; t="${t%.json}"; grep -qx -- "$t" "$T.towns" && echo "$f" >> "$T.want"; done < "$T.mine"
echo "$PRE: $(wc -l < "$T.mine") here, $(wc -l < "$T.want") for towns Sixfold has"
md5sum $(cat "$T.want") | sed 's/ \*/  /' | sort -k2 > "$T.local"
[ "$(wc -l < "$T.local")" -eq "$(wc -l < "$T.want")" ] || { echo "$PRE: local md5 list incomplete ($(wc -l < "$T.local") of $(wc -l < "$T.want")): nothing sent"; exit 1; }   # review 12 Nov, as push-edition.sh
join -1 2 -2 2 -a 1 -e NONE -o 0,1.1,2.1 "$T.local" "$T.livemd5" | awk '$2!=$3{print $1}' > "$T.up"
n=$(wc -l < "$T.up"); echo "$PRE: $n new or changed to send"
if [ "${DRY:-}" = 1 ]; then cat "$T.up"; exit 0; fi
[ "$n" -gt 0 ] || exit 0
awk 'NR==FNR{w[$1];next} ($2 in w)' "$T.up" "$T.local" | sort -k2 > "$T.sent"
tar czf "$T.tgz" $(cat "$T.up"); echo "  package $(( $(stat -c %s "$T.tgz") / 1048576 )) MB"
cat "$T.up" | $SG "cd $R && tar czf ~/upload-backups/before-six-$PRE-\$(date +%Y%m%d-%H%M%S).tgz index.json \$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done) && echo '  backed up'" || exit 1
cat "$T.tgz" | $SG "~/bin/safe-extract.sh $R -" > "$T.after" || exit 1
if diff -q "$T.sent" "$T.after" > /dev/null; then echo "  MD5 MATCH ($(wc -l < "$T.after"))"; else echo "  MD5 MISMATCH"; exit 1; fi

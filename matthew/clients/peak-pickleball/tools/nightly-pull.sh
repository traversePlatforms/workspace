#!/usr/bin/env bash
# Peak Pickleball nightly pull (23 Nov 2026): CourtReserve + Patch Retention, READ-ONLY (GET only; Tyler's consent 4 and 11 Nov 2026).
# Safe to re-run: each run replaces the last two months' store files whole and rewrites today's dated snapshot.
# Writes data/pulls/<date>/ and data/pulls/store/ (gitignored), then recomputes the impact numbers (tools/impact.mjs).
# Meta (Facebook, Instagram, ads) and Google Business Profile (gbp-pull.mjs, since 25 Nov) are pulled after Patch; their failures are logged but never fail the run.
# Logs one line per run to data/pulls/pull.log. Exits non-zero if either pull fails.
# Backfill (once, or to rebuild the store): node cr-pull.mjs --from=2024-09-01 ; node patch-pull.mjs --full
set -uo pipefail
export TZ=America/Denver
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULLS="$TOOLS/../data/pulls"
mkdir -p "$PULLS"
DAY="$(date +%F)"
LOG="$PULLS/pull.log"
RUNLOG="$PULLS/$DAY/run.log"
mkdir -p "$PULLS/$DAY"

# one run at a time
exec 9>"$PULLS/.nightly.lock"
if ! flock -n 9; then echo "$(date -Is) SKIP another pull is still running" >> "$LOG"; exit 75; fi

NODE="$(command -v node || echo /usr/bin/node)"
start=$(date +%s)
cd "$TOOLS" || exit 1

"$NODE" cr-pull.mjs >> "$RUNLOG" 2>&1; cr=$?
"$NODE" patch-pull.mjs >> "$RUNLOG" 2>&1; pa=$?
# Facebook / Instagram / Meta ads (meta-pull.mjs, GET only). A failure here never stops the other pulls or the exit code: it is logged as meta=fail.
"$NODE" meta-pull.mjs >> "$RUNLOG" 2>&1; me=$?
# Google Business Profile (gbp-pull.mjs: fetched on the server, stored here). Same rule as Meta: logged as gbp=fail, never stops the run.
"$NODE" gbp-pull.mjs >> "$RUNLOG" 2>&1; gb=$?
im=0
if [ $cr -eq 0 ] && [ $pa -eq 0 ]; then "$NODE" impact.mjs --quiet >> "$RUNLOG" 2>&1; im=$?; fi

secs=$(( $(date +%s) - start ))
members=$(grep -o '^cr members [0-9]*' "$RUNLOG" | tail -1 | awk '{print $3}')
patchrows=$(grep -o 'store rows [0-9]*' "$RUNLOG" | tail -1 | awk '{print $3}')
if [ $cr -eq 0 ] && [ $pa -eq 0 ] && [ $im -eq 0 ]; then
  echo "$(date -Is) OK day=$DAY courtreserve=ok members=${members:-?} patch=ok patch_rows=${patchrows:-?} meta=$([ $me -eq 0 ] && echo ok || echo "fail($me)") gbp=$([ $gb -eq 0 ] && echo ok || echo "fail($gb)") impact=ok secs=$secs" >> "$LOG"
  exit 0
fi
echo "$(date -Is) FAIL day=$DAY courtreserve=$cr patch=$pa meta=$me gbp=$gb impact=$im secs=$secs see $RUNLOG" >> "$LOG"
exit 1

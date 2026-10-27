#!/bin/bash
# Overnight check (2026-10-16, Matthew: "make sure u are running periodic scans while i am asleep to make sure nothing randomly stops").
# Run every 30 minutes by the Windows task "Overnight check" (runs whether or not a Claude session is open). Reads only, except one
# thing: when a town build has finished and its Sixfold upload has not happened (the session that would have done it was closed),
# it runs that upload, which Matthew asked for. Report: %LOCALAPPDATA%\ProjectBackup\overnight-checks.log (one block per run) and
# overnight-latest.txt (the last run only). Never prints secrets; server checks go through sg.sh.
set -u
LOGDIR="$LOCALAPPDATA/ProjectBackup"; mkdir -p "$LOGDIR"
LOG="$LOGDIR/overnight-checks.log"; LATEST="$LOGDIR/overnight-latest.txt"
REPO="/c/Users/Surge Inc/Desktop/claude test 2"; DT="$REPO/traverse/data-pipeline/door-territory"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
OUT=""; BAD=0
say() { OUT="$OUT$1"$'\n'; }
ok() { say "  ok    $1"; }
bad() { say "  PROBLEM  $1"; BAD=$((BAD+1)); }
age_min() { echo $(( ( $(date +%s) - $(stat -c %Y "$1") ) / 60 )); }
say "== $(date '+%Y-%m-%d %H:%M')"

# 1. Town builds: running, finished, or stopped part-way
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*) say "  info  network: $SSID (phone hotspot: tree downloads stay paused)";; *) say "  info  network: ${SSID:-wired}";; esac
if [ -f "$DT/logs-paused.flag" ]; then ok "tree work PAUSED since $(date -r "$DT/logs-paused.flag" "+%m-%d %H:%M") (hotspot); resume: bash traverse/data-pipeline/door-territory/resume-trees-2026-10-16.sh"; else
NODES=$(tasklist //FI "IMAGENAME eq node.exe" 2>/dev/null | grep -c node.exe)
for run in batch5:run-batch5-2026-10-15.sh batch5-fix:run-batch5-fix-2026-10-16.sh; do   # boulder-trees retired 2026-10-20: the Wi-Fi queue's refine does Boulder's trees
  name=${run%%:*}; L="$DT/logs-$name"
  [ -d "$L" ] || continue
  if [ -f "$L/done.flag" ]; then ok "build $name finished $(date -r "$L/done.flag" '+%m-%d %H:%M')"; continue; fi
  newest=$(ls -t "$L"/*.log 2>/dev/null | head -1)
  last=$( [ -n "$newest" ] && basename "$newest" .log || echo none )
  if [ "$name" = batch5-fix ] && [ ! -f "$DT/logs-batch5/done.flag" ]; then ok "build $name waiting for batch5"
  elif [ "$name" = boulder-trees ] && [ ! -f "$DT/logs-batch5-fix/done.flag" ]; then ok "build $name waiting for the catch-up"
  elif [ "$NODES" -gt 0 ]; then
    m=$( [ -n "$newest" ] && age_min "$newest" || echo 0 )
    if [ "$m" -gt 180 ]; then bad "build $name: node is running but nothing written for $m min (last step: $last)"
    else ok "build $name running, step $last (written $m min ago)"; fi
  else bad "build $name STOPPED before finishing (no node running; last step: $last). Restart it from its runner script."; fi
done

fi

# 2. Uploads the builds owe the live app (only the ones Matthew asked for)
T40="bow-mar columbine-valley glendale columbine ken-caryl dove-valley morrison twin-lakes foxfield stonegate sherrelwood welby federal-heights roxborough-park northglenn evergreen the-pinery broomfield superior watkins louisville brighton lafayette perry-park idaho-springs lochbuie elizabeth dacono gunbarrel frederick bennett fort-lupton niwot firestone hudson nederland kiowa longmont"
SIX="strasburg platteville mead keenesburg byers lyons"
up() { # label flag towns...
  local label=$1 flag=$2; shift 2
  [ -f "$flag" ] || return 0
  if [ -f "$DT/logs-upload/$label.done" ]; then ok "upload $label done $(date -r "$DT/logs-upload/$label.done" '+%m-%d %H:%M')"; return; fi
  case "$SSID" in *iPhone*) ok "upload $label held: on the phone hotspot"; return;; esac
  [ -f "$DT/logs-paused.flag" ] && { ok "upload $label held: tree work paused"; return; }
  [ -f "$flag" ] || return 0
  if [ -d "$DT/logs-upload/lock" ]; then ok "upload $label in progress"; return; fi
  r=$(bash "$DT/upload-towns-sixfold.sh" "$label" "$@" 2>&1 | tail -3 | tr '\n' ' ')
  [ -f "$DT/logs-upload/$label.done" ] && ok "upload $label run by this check: $r" || bad "upload $label failed: $r"
}
up towns-trees-2026-10-16 "$DT/logs-batch5/done.flag" $T40
up towns-catchup-2026-10-16 "$DT/logs-batch5-fix/done.flag" $T40 $SIX
# up towns-final-2026-10-16 ... retired 2026-10-20: the Wi-Fi queue uploads every town it rebuilds; an upload from here could land mid-rebuild

# 2b. The Wi-Fi queue (2026-10-20): its status line, a parked job, or a runner that stopped updating
QS="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue/state/status.txt"
if [ -f "$QS" ]; then
  say "  info  Wi-Fi queue: $(sed -n 2p "$QS" | cut -c1-160)"
  grep -q "PARKED" "$QS" && bad "Wi-Fi queue: a job is parked after 3 failures (traverse/ops/wifi-queue/state/status.txt)"
  if ! grep -q "everything in the queue is done" "$QS"; then qm=$(age_min "$QS")
    if [ "$qm" -gt 60 ]; then
      # one town can take all night (Westminster's lawn fill: 9 h, 2026-10-21): the status only changes between units, so a
      # runner still writing its step log is working, not stopped
      QL="$(dirname "$(dirname "$QS")")/logs"; sl=$(ls -t "$QL"/step-*.log 2>/dev/null | head -1)
      if [ -n "$sl" ] && [ "$(age_min "$sl")" -le 20 ]; then say "  ok    Wi-Fi queue: one long unit, still working ($(basename "$sl" .log) written $(age_min "$sl") min ago)"
      else bad "Wi-Fi queue: status not updated for $qm min and no step log written in 20 min (runner stopped? the task restarts it every 30 min)"; fi
    fi
  fi
fi

# 3. The live server: app page, API answering, Sixfold town list readable, PHP fatal errors in the last hour
SRV=$($SG "cd ~/www/traverseplatforms.com && \
  echo page \$(curl -s -o /dev/null -w '%{http_code}' https://traverseplatforms.com/summit-de59ae83/); \
  echo api \$(curl -s -o /dev/null -w '%{http_code}' 'https://traverseplatforms.com/api/rounds.php?action=regions'); \
  echo towns \$(python3 -c \"import json;print(len(json.load(open('sixfold-data/rounds/index.json'))['regions']))\" 2>/dev/null || echo unreadable); \
  echo fatal \$(find public_html/api/php_errorlog -mmin -60 2>/dev/null | xargs -r tail -200 | grep -c 'PHP Fatal'); \
  echo fbsetup \$([ -f sixfold-private/meta-setup.json ] && echo waiting || echo done); \
  echo disk \$(df -P ~ | awk 'NR==2{print \$5}')" < /dev/null 2>/dev/null)
v() { echo "$SRV" | awk -v k="$1" '$1==k{print $2}'; }
[ -z "$SRV" ] && bad "could not reach the server over SSH (internet down?)" || {
  [ "$(v page)" = 200 ] && ok "app page 200" || bad "app page answered $(v page)"
  case "$(v api)" in 401|403|200) ok "API answering ($(v api) signed out, as expected)";; *) bad "API answered $(v api)";; esac
  [ "$(v towns)" -ge 84 ] 2>/dev/null && ok "Sixfold town list readable: $(v towns) towns" || bad "Sixfold town list: $(v towns) (expected 84 or more)"
  [ "$(v fatal)" = 0 ] && ok "no PHP fatal errors in the last hour" || bad "$(v fatal) PHP fatal error lines in the API log in the last hour"
  say "  info  server disk used $(v disk)"
  # SX-62 (2026-10-19): the Facebook lead setup retries hourly on the server until Meta lifts the app restriction
  [ "$(v fbsetup)" = waiting ] && say "  info  Facebook leads: still waiting on Meta (app restricted); the server retries every hour" || say "  ok    Facebook leads: CONNECTED (setup done; tell Matthew, check the backlog came in)"
}

# 4. Windows tasks on this computer (backups)
TASKS=$(powershell.exe -NoProfile -Command "foreach(\$n in 'Backup claude test 2 to Google Drive','Traverse server backup'){ \$i=Get-ScheduledTaskInfo -TaskName \$n -ErrorAction SilentlyContinue; if(\$i){ '{0}|{1:MM-dd HH:mm}|{2}' -f \$n,\$i.LastRunTime,\$i.LastTaskResult } }" 2>/dev/null | tr -d '\r')
while IFS='|' read -r n t r; do [ -z "$n" ] && continue
  [ "$r" = 0 ] && ok "$n: last run $t ok" || bad "$n: last run $t ended with code $r"
done <<< "$TASKS"
GD=$(tail -1 "$LOGDIR/gdrive.log" 2>/dev/null); say "  info  Drive backup log: ${GD:-none}"

# 5. This computer's disk
# throwaway Chrome profiles from test and print scripts (cdp-*), more than a day old (2026-10-25: 10,717 had piled up, about 170 GB)
SWEPT=$(find "$LOCALAPPDATA/Temp" -maxdepth 1 -type d -name 'cdp-*' -mtime +1 2>/dev/null | head -2000 | while IFS= read -r d; do rm -rf "$d" 2>/dev/null && echo x; done | wc -l)
[ "$SWEPT" -gt 0 ] && say "  info  removed $SWEPT old test-browser folders from Temp"
FREE=$(df -Pm /c | awk 'NR==2{print int($4/1024)}'); [ "$FREE" -lt 20 ] && bad "C: has only ${FREE} GB free" || ok "C: ${FREE} GB free"

# 6. The crews' job photos, copied once a day by address (2026-10-26, Matthew: "go ahead and set up the nightly copy")
JP=$(bash "$REPO/traverse/ops/pull-job-photos.sh" 2>&1 | tail -1)
case "$JP" in *FAILED*) bad "$JP";; *) say "  info  $JP";; esac

say "  => $( [ $BAD = 0 ] && echo 'all fine' || echo "$BAD problem(s)")"
printf '%s' "$OUT" >> "$LOG"; printf '%s' "$OUT" > "$LATEST"; printf '%s' "$OUT"

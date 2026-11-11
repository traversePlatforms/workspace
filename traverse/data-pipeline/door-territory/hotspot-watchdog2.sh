#!/bin/bash
# Like hotspot-watchdog.sh, for any run: bash hotspot-watchdog2.sh <pattern of the runner's command line>  (2026-10-16)
# Checks every 30 s while that run is going; on Matthew's iPhone hotspot it stops the run and every pipeline node process and drops
# logs-paused.flag. Ends when the run ends.
# (2026-11-10: it counted ITSELF as the run, since its own command line carries the pattern, so it never ended; 107 piled up behind the
#  Wi-Fi queue's rented job, each starting PowerShell every 30 s and slowing the laptop. Its own line is left out now.)
# (overnight check 2026-11-10, three more:
#  - one watchdog per pattern: a second one started for the same run ends at once, so they cannot pile up whatever else goes wrong;
#  - if the process list stops answering for 10 minutes it ends instead of looping for ever;
#  - on the hotspot it used to stop ITSELF along with the run (same pattern), often before it had written logs-paused.flag or its log
#    line. The flag is written first now and the watchdog is left out of the stop. The Wi-Fi queue reads the flag: a job stopped this
#    way comes back from `wait` as exit 0, which the queue was counting as "finished".)
PAT="${1:-resume-trees}"
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
PF="/tmp/hotspot-watchdog-$(printf '%s' "$PAT" | tr -c 'A-Za-z0-9' '_').pid"
OLD=$(cat "$PF" 2>/dev/null)
if [ -n "$OLD" ] && [ "$OLD" != "$$" ] && tr '\0' ' ' < "/proc/$OLD/cmdline" 2>/dev/null | grep -q 'hotspot-watchdog2'; then
  echo "$(date +%T) a watchdog for $PAT is already running (pid $OLD); this one is not needed"; exit 0
fi
echo $$ > "$PF"
trap '[ "$(cat "$PF" 2>/dev/null)" = "$$" ] && rm -f "$PF"' EXIT
running() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match '$PAT' -and \$_.CommandLine -notmatch 'hotspot-watchdog' }).Count" 2>/dev/null | tr -d '\r'; }
sleep 20
UNK=0
while :; do
  N=$(running); [ "$N" = "0" ] && break
  if [ -z "$N" ]; then UNK=$((UNK + 1)); [ $UNK -ge 20 ] && { echo "$(date +%T) the process list has not answered for 10 minutes; watchdog for $PAT ends"; exit 1; }; else UNK=0; fi
  SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
  case "$SSID" in *iPhone*|*iphone*)
    touch logs-paused.flag
    echo "$(date +%T) hotspot ($SSID): stopping $PAT"
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match '$PAT|upload-towns' -and \$_.CommandLine -notmatch 'hotspot-watchdog') -or (\$_.Name -eq 'node.exe' -and \$_.CommandLine -match 'prefetch-lidar|sample-trees|sample-value|sample-lawn|build-walklist|fetch-buildings|build-rounds|build-lookup') } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    echo "$(date +%T) hotspot ($SSID): $PAT stopped and paused"
    # a Wi-Fi queue runner started before the 10 Nov fix is still in memory until it next restarts, and it marks the job it just lost as
    # finished (state/<id>.done). A mark made in the seconds after this stop is that mistake: take it back so the job runs again on Wi-Fi.
    case "$PAT" in jobs/*.sh) QD="../../ops/wifi-queue/state/$(basename "$PAT" .sh).done"; sleep 8
      if [ -f "$QD" ] && [ "$QD" -nt logs-paused.flag ]; then rm -f "$QD"; echo "$(date +%T) the queue had marked $(basename "$PAT" .sh) finished after this stop: mark removed, it will run again"; fi;; esac
    exit 0;;
  esac
  sleep 30
done
echo "$(date +%T) $PAT finished; watchdog done"

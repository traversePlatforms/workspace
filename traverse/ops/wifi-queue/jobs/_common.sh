# shared by the Wi-Fi queue's jobs (2026-10-20). Each job does one unit and exits: 0 finished, 3 more left, 4 stopped for the network.
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
Q="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue"
cd "$DT" || exit 1
mkdir -p "$Q/state"
on_hotspot() { case "$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')" in *iPhone*|*iphone*) return 0;; esac; return 1; }
# run a step; before it, stop (exit 4) if the laptop is on the hotspot; a failed step fails the unit
step() { local name=$1; shift; if on_hotspot; then echo "$(date +%T) on the hotspot before $name - stopping"; exit 4; fi
  echo "$(date +%T) start $name"; ( "$@" ) > "$Q/logs/step-$name.log" 2>&1; local rc=$?
  echo "$(date +%T) end   $name (exit $rc) $(tail -1 "$Q/logs/step-$name.log" | tr '\r' '\n' | tail -1 | cut -c1-160)"
  [ $rc -eq 0 ] || { echo "step $name failed"; exit 1; }; }
uploaded() { [ -f "$DT/logs-upload/$1.done" ]; }
# an older pipeline run (the runners before the queue) still going: wait, two at once would write the same caches
OLDRUNS=$(powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'run-refine-resume|resume[0-9]*-when-wifi|resume-trees|run-fast|run-allsizes|run-batch' }).Count" 2>/dev/null | tr -d '\r')
[ "${OLDRUNS:-0}" != "0" ] && { echo "$(date +%T) an older pipeline run is still going ($OLDRUNS) - waiting for it"; exit 4; }

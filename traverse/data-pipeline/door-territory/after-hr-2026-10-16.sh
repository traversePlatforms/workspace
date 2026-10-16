#!/bin/bash
# After the Highlands Ranch rebuild (2026-10-16, Matthew: Highlands Ranch first, the crew is out there): finish what the 45-mile run
# had left when it was paused for it: Longmont's missing lawn sizes, the county values for the new places, then the resume script's
# last stage (tree retry, Boulder, rebuild, final upload; the catch-up block is skipped, its upload is done).
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-after-hr; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
running() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'run-hr-all' }).Count" 2>/dev/null | tr -d '\r'; }
echo "$(date +%T) waiting for the Highlands Ranch rebuild"
while [ "$(running)" != "0" ]; do sleep 60; done
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; touch logs-paused.flag; exit 1;; esac
bash hotspot-watchdog2.sh after-hr > "$L/watchdog.log" 2>&1 &
step lawn-longmont-topup bash -c "cd lawn-trial && node sample-lawn.mjs --town=longmont --conc=16"
step values node sample-value.mjs --only=bow-mar,columbine-valley,glendale,columbine,ken-caryl,dove-valley,morrison,twin-lakes,foxfield,stonegate,sherrelwood,welby,federal-heights,roxborough-park,northglenn,evergreen,the-pinery,superior,watkins,louisville,brighton,lafayette,perry-park,lochbuie,dacono,gunbarrel,frederick,bennett,fort-lupton,niwot,firestone,hudson,nederland,longmont,strasburg,platteville,mead,keenesburg,byers,lyons
bash resume-trees-2026-10-16.sh > logs-resume-runner3.log 2>&1
echo "$(date +%T) all done"

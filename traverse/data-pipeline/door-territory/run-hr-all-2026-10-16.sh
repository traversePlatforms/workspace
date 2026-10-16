#!/bin/bash
# Highlands Ranch with every residential lot (2026-10-16, Matthew: "if they are working out there they need to have access to all the
# properties in highlands ranch"; aeration sells to small lawns too). It was pulled with a 0.12-acre floor, which left out Erik's house
# (0.119 acres, 7115 Newhall Dr) and ~6,000 others. Widening only adds doors (marks survive); the neighbourhoods are redrawn, so
# Christian's assignment is moved to the new neighbourhood that holds Erik's street.
# Waits for the resume run (one parcel-heavy job on gis.colorado.gov at a time); refuses to start on the hotspot or a slow line.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-hr-all; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
running() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'resume-trees' }).Count" 2>/dev/null | tr -d '\r'; }
echo "$(date +%T) waiting for the resume run"
while [ "$(running)" != "0" ]; do sleep 60; done
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
BPS=$(curl -s -o /dev/null --max-time 10 -w '%{speed_download}' "https://speed.cloudflare.com/__down?bytes=20000000" | cut -d. -f1)
[ "${BPS:-0}" -lt 1000000 ] && { echo "line too slow ($BPS B/s) - not starting"; exit 1; }
echo "$(date +%T) network: ${SSID:-wired}, $((BPS/1000000)) MB/s"
bash hotspot-watchdog2.sh run-hr-all > "$L/watchdog.log" 2>&1 &
cp highlands-ranch.csv highlands-ranch.csv.bak-2026-10-16; cp highlands-ranch-areas.json highlands-ranch-areas.json.bak-2026-10-16
OLD=$(($(wc -l < highlands-ranch.csv.bak-2026-10-16) - 1))
step pull node build-walklist-co.mjs --place=highlands-ranch --radius=5 --min-acres=0 --cities="HIGHLANDS RANCH" --out=highlands-ranch.csv
NEW=$(($(wc -l < highlands-ranch.csv) - 1))
echo "$(date +%T) rows: was $OLD, now $NEW"
if [ "$NEW" -le "$OLD" ]; then echo "the new pull is not bigger: putting the old files back and stopping"; cp highlands-ranch.csv.bak-2026-10-16 highlands-ranch.csv; cp highlands-ranch-areas.json.bak-2026-10-16 highlands-ranch-areas.json; exit 1; fi
step areas node build-walklist-pdf.mjs highlands-ranch.csv --no-pdf
step lawn bash -c "cd lawn-trial && node sample-lawn.mjs --town=highlands-ranch --conc=16"
step lawn-compact bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=highlands-ranch --conc=6"
step trees bash -c "cd tree-zones && node sample-trees.mjs --town=highlands-ranch --conc=6"
step value node sample-value.mjs --only=highlands-ranch
step lookup node build-lookup.mjs highlands-ranch
step rounds node build-rounds-data.mjs
touch "$L/done.flag"
bash upload-towns-sixfold.sh hr-all-2026-10-16 highlands-ranch
# Christian's assignment: the new neighbourhood holding Erik's street (the doors across from 7115 Newhall Dr)
bash /c/Users/SURGEI~1/.ssh/sg.sh trav "cd ~/www/traverseplatforms.com/sixfold-data/rounds && python3 - <<'PY'
import json, urllib.request, http.cookiejar
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(a, body=None):
    req = urllib.request.Request('https://traverseplatforms.com/api/rounds.php?action=' + a, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 ClaudeCheck'})
    try: return json.loads(op.open(req, timeout=60).read())
    except urllib.error.HTTPError as e: return json.loads(e.read() or b'{}')
call('signin', {'code': '512618'})
d = json.load(open('highlands-ranch.json'))
want = None
for a in d['areas']:
    ad = [str(x.get('address', '')).upper() for x in a['doors']]
    if any(s.startswith('7115 NEWHALL') for s in ad): want = a['name']; break
if not want:
    for a in d['areas']:
        if any(str(x.get('address', '')).upper().startswith(('7126 NEWHALL', '7145 NEWHALL')) for x in a['doors']): want = a['name']; break
old = 'TOWNSEND DR 7085–7174'
names = [a['name'] for a in d['areas']]
print('Erik is in:', want, '| old name still exists:', old in names)
if want: print('assign:', call('assign', {'region': 'highlands-ranch', 'area': want, 'who': 'Christian Jensen'}))
if old not in names: print('old name cleared:', 'n/a (no longer a neighbourhood; the old row is simply not shown)')
PY" < /dev/null
echo "$(date +%T) all done"

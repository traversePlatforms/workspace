#!/bin/bash
# 2026-10-17 afternoon: Matthew paused the run at 11:20 (Erie in its lawn step). Erie from its lawn step (its pull and areas are done,
# the backups hold the old lists), then Perry Park..Cripple Creek (run-fast3 blocks), with steps that wait for the internet.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-allsizes; mkdir -p "$L"
step() { local name=$1; shift; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: ${SSID:-wired}"
bash hotspot-watchdog2.sh run-fast4 > "$L/watchdog.log" 2>&1 &
cat remap-assign.py | bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'cat > ~/remap-assign.py && echo remap-ready'
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
town() {   # town key, then the pull lines run by the caller
  :
}
curl -s -m 15 -o /dev/null https://gis.colorado.gov/ || { echo "$(date +%T) no internet - not starting"; exit 1; }


echo "$(date +%T) == erie (47, from lawn)"
  step lawn-erie bash -c "cd lawn-trial && node sample-lawn.mjs --town=erie --conc=16"
  step value-erie node sample-value.mjs --only=erie
  step lookup-erie node build-lookup.mjs erie
  step rounds-erie node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-erie erie
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py erie ~/upload-backups/before-allsizes-erie.tgz" < /dev/null

# Perry Park, 27.2 mi
echo "$(date +%T) == perry-park (48)"
cp perry-park.csv perry-park.csv.bak-allsizes 2>/dev/null; cp perry-park-areas.json perry-park-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows perry-park.csv.bak-allsizes)
  step pull-perry-park node build-walklist-co.mjs --county='DOUGLAS' --lat=39.2592 --lon=-104.9855 --radius=2.5 --min-acres=0 --pieces=perry-park-cdp.json --out=perry-park.csv
NEW=$(rows perry-park.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) perry-park: not bigger ($OLD -> $NEW), old files back"; cp perry-park.csv.bak-allsizes perry-park.csv 2>/dev/null; cp perry-park-areas.json.bak-allsizes perry-park-areas.json 2>/dev/null
else
  echo "$(date +%T) perry-park: $OLD -> $NEW doors"
  step areas-perry-park node build-walklist-pdf.mjs perry-park.csv --no-pdf
  step lawn-perry-park bash -c "cd lawn-trial && node sample-lawn.mjs --town=perry-park --conc=16"
  step value-perry-park node sample-value.mjs --only=perry-park
  step lookup-perry-park node build-lookup.mjs perry-park
  step rounds-perry-park node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-perry-park perry-park
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py perry-park ~/upload-backups/before-allsizes-perry-park.tgz" < /dev/null
fi

# Lochbuie, 28.5 mi
echo "$(date +%T) == lochbuie (49)"
cp lochbuie.csv lochbuie.csv.bak-allsizes 2>/dev/null; cp lochbuie-areas.json lochbuie-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows lochbuie.csv.bak-allsizes)
  step pull-lochbuie-1 node build-walklist-co.mjs --county='WELD' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0 --municipality='Lochbuie' --out=lochbuie-weld.csv
  step pull-lochbuie-2 node build-walklist-co.mjs --county='ADAMS' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0 --municipality='Lochbuie' --out=lochbuie-adams.csv
  node merge-walklists.mjs lochbuie.csv $(ls lochbuie-weld.csv lochbuie-adams.csv 2>/dev/null) > "$L/merge-lochbuie.log" 2>&1
NEW=$(rows lochbuie.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) lochbuie: not bigger ($OLD -> $NEW), old files back"; cp lochbuie.csv.bak-allsizes lochbuie.csv 2>/dev/null; cp lochbuie-areas.json.bak-allsizes lochbuie-areas.json 2>/dev/null
else
  echo "$(date +%T) lochbuie: $OLD -> $NEW doors"
  step areas-lochbuie node build-walklist-pdf.mjs lochbuie.csv --no-pdf
  step lawn-lochbuie bash -c "cd lawn-trial && node sample-lawn.mjs --town=lochbuie --conc=16"
  step value-lochbuie node sample-value.mjs --only=lochbuie
  step lookup-lochbuie node build-lookup.mjs lochbuie
  step rounds-lochbuie node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-lochbuie lochbuie
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py lochbuie ~/upload-backups/before-allsizes-lochbuie.tgz" < /dev/null
fi

# Idaho Springs, 28.5 mi
echo "$(date +%T) == idaho-springs (50)"
cp idaho-springs.csv idaho-springs.csv.bak-allsizes 2>/dev/null; cp idaho-springs-areas.json idaho-springs-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows idaho-springs.csv.bak-allsizes)
  step pull-idaho-springs node build-walklist-co.mjs --county='CLEAR CREEK' --lat=39.743 --lon=-105.514 --radius=1.8 --min-acres=0 --municipality='Idaho Springs' --out=idaho-springs.csv
NEW=$(rows idaho-springs.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) idaho-springs: not bigger ($OLD -> $NEW), old files back"; cp idaho-springs.csv.bak-allsizes idaho-springs.csv 2>/dev/null; cp idaho-springs-areas.json.bak-allsizes idaho-springs-areas.json 2>/dev/null
else
  echo "$(date +%T) idaho-springs: $OLD -> $NEW doors"
  step areas-idaho-springs node build-walklist-pdf.mjs idaho-springs.csv --no-pdf
  step lawn-idaho-springs bash -c "cd lawn-trial && node sample-lawn.mjs --town=idaho-springs --conc=16"
  step value-idaho-springs node sample-value.mjs --only=idaho-springs
  step lookup-idaho-springs node build-lookup.mjs idaho-springs
  step rounds-idaho-springs node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-idaho-springs idaho-springs
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py idaho-springs ~/upload-backups/before-allsizes-idaho-springs.tgz" < /dev/null
fi

# Boulder, 28.6 mi (pull rebuilt from its old list)
echo "$(date +%T) == boulder (51)"
cp boulder.csv boulder.csv.bak-allsizes 2>/dev/null; cp boulder-areas.json boulder-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows boulder.csv.bak-allsizes)
  step pull-boulder node build-walklist-co.mjs --county='BOULDER' --lat=40.0172 --lon=-105.2599 --radius=6.6 --min-acres=0 --cities='BOULDER' --out=boulder-boulder.csv
  mv -f boulder-boulder.csv boulder.csv
  [ -s boulder.csv ] && step footprint-boulder node filter-footprint.mjs boulder.csv boulder.csv.bak-allsizes 0.35
NEW=$(rows boulder.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) boulder: not bigger ($OLD -> $NEW), old files back"; cp boulder.csv.bak-allsizes boulder.csv 2>/dev/null; cp boulder-areas.json.bak-allsizes boulder-areas.json 2>/dev/null
else
  echo "$(date +%T) boulder: $OLD -> $NEW doors"
  step areas-boulder node build-walklist-pdf.mjs boulder.csv --no-pdf
  step lawn-boulder bash -c "cd lawn-trial && node sample-lawn.mjs --town=boulder --conc=16"
  step value-boulder node sample-value.mjs --only=boulder
  step lookup-boulder node build-lookup.mjs boulder
  step rounds-boulder node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-boulder boulder
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py boulder ~/upload-backups/before-allsizes-boulder.tgz" < /dev/null
fi

# Elizabeth, 29.2 mi
echo "$(date +%T) == elizabeth (52)"
cp elizabeth.csv elizabeth.csv.bak-allsizes 2>/dev/null; cp elizabeth-areas.json elizabeth-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows elizabeth.csv.bak-allsizes)
  step pull-elizabeth node build-walklist-co.mjs --county='ELBERT' --lat=39.36 --lon=-104.597 --radius=2 --min-acres=0 --municipality='Elizabeth' --out=elizabeth.csv
NEW=$(rows elizabeth.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) elizabeth: not bigger ($OLD -> $NEW), old files back"; cp elizabeth.csv.bak-allsizes elizabeth.csv 2>/dev/null; cp elizabeth-areas.json.bak-allsizes elizabeth-areas.json 2>/dev/null
else
  echo "$(date +%T) elizabeth: $OLD -> $NEW doors"
  step areas-elizabeth node build-walklist-pdf.mjs elizabeth.csv --no-pdf
  step lawn-elizabeth bash -c "cd lawn-trial && node sample-lawn.mjs --town=elizabeth --conc=16"
  step value-elizabeth node sample-value.mjs --only=elizabeth
  step lookup-elizabeth node build-lookup.mjs elizabeth
  step rounds-elizabeth node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-elizabeth elizabeth
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py elizabeth ~/upload-backups/before-allsizes-elizabeth.tgz" < /dev/null
fi

# Larkspur, 29.8 mi (pull rebuilt from its old list)
echo "$(date +%T) == larkspur (53)"
cp larkspur.csv larkspur.csv.bak-allsizes 2>/dev/null; cp larkspur-areas.json larkspur-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows larkspur.csv.bak-allsizes)
  step pull-larkspur node build-walklist-co.mjs --county='DOUGLAS' --lat=39.2495 --lon=-104.9067 --radius=3.2 --min-acres=0 --cities='LARKSPUR' --out=larkspur-douglas.csv
  mv -f larkspur-douglas.csv larkspur.csv
  [ -s larkspur.csv ] && step footprint-larkspur node filter-footprint.mjs larkspur.csv larkspur.csv.bak-allsizes 0.35
NEW=$(rows larkspur.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) larkspur: not bigger ($OLD -> $NEW), old files back"; cp larkspur.csv.bak-allsizes larkspur.csv 2>/dev/null; cp larkspur-areas.json.bak-allsizes larkspur-areas.json 2>/dev/null
else
  echo "$(date +%T) larkspur: $OLD -> $NEW doors"
  step areas-larkspur node build-walklist-pdf.mjs larkspur.csv --no-pdf
  step lawn-larkspur bash -c "cd lawn-trial && node sample-lawn.mjs --town=larkspur --conc=16"
  step value-larkspur node sample-value.mjs --only=larkspur
  step lookup-larkspur node build-lookup.mjs larkspur
  step rounds-larkspur node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-larkspur larkspur
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py larkspur ~/upload-backups/before-allsizes-larkspur.tgz" < /dev/null
fi

# Dacono, 29.9 mi
echo "$(date +%T) == dacono (54)"
cp dacono.csv dacono.csv.bak-allsizes 2>/dev/null; cp dacono-areas.json dacono-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows dacono.csv.bak-allsizes)
  step pull-dacono node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.94 --radius=2.5 --min-acres=0 --municipality='Dacono' --out=dacono.csv
NEW=$(rows dacono.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) dacono: not bigger ($OLD -> $NEW), old files back"; cp dacono.csv.bak-allsizes dacono.csv 2>/dev/null; cp dacono-areas.json.bak-allsizes dacono-areas.json 2>/dev/null
else
  echo "$(date +%T) dacono: $OLD -> $NEW doors"
  step areas-dacono node build-walklist-pdf.mjs dacono.csv --no-pdf
  step lawn-dacono bash -c "cd lawn-trial && node sample-lawn.mjs --town=dacono --conc=16"
  step value-dacono node sample-value.mjs --only=dacono
  step lookup-dacono node build-lookup.mjs dacono
  step rounds-dacono node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-dacono dacono
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py dacono ~/upload-backups/before-allsizes-dacono.tgz" < /dev/null
fi

# Gunbarrel, 30.4 mi
echo "$(date +%T) == gunbarrel (55)"
cp gunbarrel.csv gunbarrel.csv.bak-allsizes 2>/dev/null; cp gunbarrel-areas.json gunbarrel-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows gunbarrel.csv.bak-allsizes)
  step pull-gunbarrel node build-walklist-co.mjs --county='BOULDER' --lat=40.069 --lon=-105.1784 --radius=2.86 --min-acres=0 --pieces=gunbarrel-cdp.json --out=gunbarrel.csv
NEW=$(rows gunbarrel.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) gunbarrel: not bigger ($OLD -> $NEW), old files back"; cp gunbarrel.csv.bak-allsizes gunbarrel.csv 2>/dev/null; cp gunbarrel-areas.json.bak-allsizes gunbarrel-areas.json 2>/dev/null
else
  echo "$(date +%T) gunbarrel: $OLD -> $NEW doors"
  step areas-gunbarrel node build-walklist-pdf.mjs gunbarrel.csv --no-pdf
  step lawn-gunbarrel bash -c "cd lawn-trial && node sample-lawn.mjs --town=gunbarrel --conc=16"
  step value-gunbarrel node sample-value.mjs --only=gunbarrel
  step lookup-gunbarrel node build-lookup.mjs gunbarrel
  step rounds-gunbarrel node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-gunbarrel gunbarrel
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py gunbarrel ~/upload-backups/before-allsizes-gunbarrel.tgz" < /dev/null
fi

# Frederick, 30.8 mi
echo "$(date +%T) == frederick (56)"
cp frederick.csv frederick.csv.bak-allsizes 2>/dev/null; cp frederick-areas.json frederick-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows frederick.csv.bak-allsizes)
  step pull-frederick node build-walklist-co.mjs --county='WELD' --lat=40.099 --lon=-104.95 --radius=3 --min-acres=0 --municipality='Frederick' --out=frederick.csv
NEW=$(rows frederick.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) frederick: not bigger ($OLD -> $NEW), old files back"; cp frederick.csv.bak-allsizes frederick.csv 2>/dev/null; cp frederick-areas.json.bak-allsizes frederick-areas.json 2>/dev/null
else
  echo "$(date +%T) frederick: $OLD -> $NEW doors"
  step areas-frederick node build-walklist-pdf.mjs frederick.csv --no-pdf
  step lawn-frederick bash -c "cd lawn-trial && node sample-lawn.mjs --town=frederick --conc=16"
  step value-frederick node sample-value.mjs --only=frederick
  step lookup-frederick node build-lookup.mjs frederick
  step rounds-frederick node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-frederick frederick
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py frederick ~/upload-backups/before-allsizes-frederick.tgz" < /dev/null
fi

# Bennett, 31.0 mi
echo "$(date +%T) == bennett (57)"
cp bennett.csv bennett.csv.bak-allsizes 2>/dev/null; cp bennett-areas.json bennett-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows bennett.csv.bak-allsizes)
  step pull-bennett-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0 --municipality='Bennett' --out=bennett-adams.csv
  step pull-bennett-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0 --municipality='Bennett' --out=bennett-arapahoe.csv
  node merge-walklists.mjs bennett.csv $(ls bennett-adams.csv bennett-arapahoe.csv 2>/dev/null) > "$L/merge-bennett.log" 2>&1
NEW=$(rows bennett.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) bennett: not bigger ($OLD -> $NEW), old files back"; cp bennett.csv.bak-allsizes bennett.csv 2>/dev/null; cp bennett-areas.json.bak-allsizes bennett-areas.json 2>/dev/null
else
  echo "$(date +%T) bennett: $OLD -> $NEW doors"
  step areas-bennett node build-walklist-pdf.mjs bennett.csv --no-pdf
  step lawn-bennett bash -c "cd lawn-trial && node sample-lawn.mjs --town=bennett --conc=16"
  step value-bennett node sample-value.mjs --only=bennett
  step lookup-bennett node build-lookup.mjs bennett
  step rounds-bennett node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-bennett bennett
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py bennett ~/upload-backups/before-allsizes-bennett.tgz" < /dev/null
fi

# Fort Lupton, 31.3 mi
echo "$(date +%T) == fort-lupton (58)"
cp fort-lupton.csv fort-lupton.csv.bak-allsizes 2>/dev/null; cp fort-lupton-areas.json fort-lupton-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows fort-lupton.csv.bak-allsizes)
  step pull-fort-lupton node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.813 --radius=3 --min-acres=0 --municipality='Fort Lupton' --out=fort-lupton.csv
NEW=$(rows fort-lupton.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) fort-lupton: not bigger ($OLD -> $NEW), old files back"; cp fort-lupton.csv.bak-allsizes fort-lupton.csv 2>/dev/null; cp fort-lupton-areas.json.bak-allsizes fort-lupton-areas.json 2>/dev/null
else
  echo "$(date +%T) fort-lupton: $OLD -> $NEW doors"
  step areas-fort-lupton node build-walklist-pdf.mjs fort-lupton.csv --no-pdf
  step lawn-fort-lupton bash -c "cd lawn-trial && node sample-lawn.mjs --town=fort-lupton --conc=16"
  step value-fort-lupton node sample-value.mjs --only=fort-lupton
  step lookup-fort-lupton node build-lookup.mjs fort-lupton
  step rounds-fort-lupton node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-fort-lupton fort-lupton
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py fort-lupton ~/upload-backups/before-allsizes-fort-lupton.tgz" < /dev/null
fi

# Niwot, 32.2 mi
echo "$(date +%T) == niwot (59)"
cp niwot.csv niwot.csv.bak-allsizes 2>/dev/null; cp niwot-areas.json niwot-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows niwot.csv.bak-allsizes)
  step pull-niwot node build-walklist-co.mjs --county='BOULDER' --lat=40.1017 --lon=-105.1595 --radius=1.73 --min-acres=0 --pieces=niwot-cdp.json --out=niwot.csv
NEW=$(rows niwot.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) niwot: not bigger ($OLD -> $NEW), old files back"; cp niwot.csv.bak-allsizes niwot.csv 2>/dev/null; cp niwot-areas.json.bak-allsizes niwot-areas.json 2>/dev/null
else
  echo "$(date +%T) niwot: $OLD -> $NEW doors"
  step areas-niwot node build-walklist-pdf.mjs niwot.csv --no-pdf
  step lawn-niwot bash -c "cd lawn-trial && node sample-lawn.mjs --town=niwot --conc=16"
  step value-niwot node sample-value.mjs --only=niwot
  step lookup-niwot node build-lookup.mjs niwot
  step rounds-niwot node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-niwot niwot
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py niwot ~/upload-backups/before-allsizes-niwot.tgz" < /dev/null
fi

# Firestone, 33.0 mi
echo "$(date +%T) == firestone (60)"
cp firestone.csv firestone.csv.bak-allsizes 2>/dev/null; cp firestone-areas.json firestone-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows firestone.csv.bak-allsizes)
  step pull-firestone node build-walklist-co.mjs --county='WELD' --lat=40.13 --lon=-104.94 --radius=3.5 --min-acres=0 --municipality='Firestone' --out=firestone.csv
NEW=$(rows firestone.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) firestone: not bigger ($OLD -> $NEW), old files back"; cp firestone.csv.bak-allsizes firestone.csv 2>/dev/null; cp firestone-areas.json.bak-allsizes firestone-areas.json 2>/dev/null
else
  echo "$(date +%T) firestone: $OLD -> $NEW doors"
  step areas-firestone node build-walklist-pdf.mjs firestone.csv --no-pdf
  step lawn-firestone bash -c "cd lawn-trial && node sample-lawn.mjs --town=firestone --conc=16"
  step value-firestone node sample-value.mjs --only=firestone
  step lookup-firestone node build-lookup.mjs firestone
  step rounds-firestone node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-firestone firestone
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py firestone ~/upload-backups/before-allsizes-firestone.tgz" < /dev/null
fi

# Hudson, 34.5 mi
echo "$(date +%T) == hudson (61)"
cp hudson.csv hudson.csv.bak-allsizes 2>/dev/null; cp hudson-areas.json hudson-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows hudson.csv.bak-allsizes)
  step pull-hudson node build-walklist-co.mjs --county='WELD' --lat=40.074 --lon=-104.643 --radius=2 --min-acres=0 --municipality='Hudson' --out=hudson.csv
NEW=$(rows hudson.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) hudson: not bigger ($OLD -> $NEW), old files back"; cp hudson.csv.bak-allsizes hudson.csv 2>/dev/null; cp hudson-areas.json.bak-allsizes hudson-areas.json 2>/dev/null
else
  echo "$(date +%T) hudson: $OLD -> $NEW doors"
  step areas-hudson node build-walklist-pdf.mjs hudson.csv --no-pdf
  step lawn-hudson bash -c "cd lawn-trial && node sample-lawn.mjs --town=hudson --conc=16"
  step value-hudson node sample-value.mjs --only=hudson
  step lookup-hudson node build-lookup.mjs hudson
  step rounds-hudson node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-hudson hudson
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py hudson ~/upload-backups/before-allsizes-hudson.tgz" < /dev/null
fi

# Nederland, 34.9 mi
echo "$(date +%T) == nederland (62)"
cp nederland.csv nederland.csv.bak-allsizes 2>/dev/null; cp nederland-areas.json nederland-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows nederland.csv.bak-allsizes)
  step pull-nederland node build-walklist-co.mjs --county='BOULDER' --lat=39.961 --lon=-105.511 --radius=1.5 --min-acres=0 --municipality='Nederland' --out=nederland.csv
NEW=$(rows nederland.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) nederland: not bigger ($OLD -> $NEW), old files back"; cp nederland.csv.bak-allsizes nederland.csv 2>/dev/null; cp nederland-areas.json.bak-allsizes nederland-areas.json 2>/dev/null
else
  echo "$(date +%T) nederland: $OLD -> $NEW doors"
  step areas-nederland node build-walklist-pdf.mjs nederland.csv --no-pdf
  step lawn-nederland bash -c "cd lawn-trial && node sample-lawn.mjs --town=nederland --conc=16"
  step value-nederland node sample-value.mjs --only=nederland
  step lookup-nederland node build-lookup.mjs nederland
  step rounds-nederland node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-nederland nederland
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py nederland ~/upload-backups/before-allsizes-nederland.tgz" < /dev/null
fi

# Kiowa, 35.2 mi
echo "$(date +%T) == kiowa (63)"
cp kiowa.csv kiowa.csv.bak-allsizes 2>/dev/null; cp kiowa-areas.json kiowa-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows kiowa.csv.bak-allsizes)
  step pull-kiowa node build-walklist-co.mjs --county='ELBERT' --lat=39.347 --lon=-104.464 --radius=1.2 --min-acres=0 --municipality='Kiowa' --out=kiowa.csv
NEW=$(rows kiowa.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) kiowa: not bigger ($OLD -> $NEW), old files back"; cp kiowa.csv.bak-allsizes kiowa.csv 2>/dev/null; cp kiowa-areas.json.bak-allsizes kiowa-areas.json 2>/dev/null
else
  echo "$(date +%T) kiowa: $OLD -> $NEW doors"
  step areas-kiowa node build-walklist-pdf.mjs kiowa.csv --no-pdf
  step lawn-kiowa bash -c "cd lawn-trial && node sample-lawn.mjs --town=kiowa --conc=16"
  step value-kiowa node sample-value.mjs --only=kiowa
  step lookup-kiowa node build-lookup.mjs kiowa
  step rounds-kiowa node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-kiowa kiowa
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py kiowa ~/upload-backups/before-allsizes-kiowa.tgz" < /dev/null
fi

# Longmont, 36.1 mi
echo "$(date +%T) == longmont (64)"
cp longmont.csv longmont.csv.bak-allsizes 2>/dev/null; cp longmont-areas.json longmont-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows longmont.csv.bak-allsizes)
  step pull-longmont-1 node build-walklist-co.mjs --county='BOULDER' --lat=40.17 --lon=-105.11 --radius=6 --min-acres=0 --municipality='Longmont' --out=longmont-boulder.csv
  step pull-longmont-2 node build-walklist-co.mjs --county='WELD' --lat=40.17 --lon=-105.03 --radius=3 --min-acres=0 --municipality='Longmont' --out=longmont-weld.csv
  node merge-walklists.mjs longmont.csv $(ls longmont-boulder.csv longmont-weld.csv 2>/dev/null) > "$L/merge-longmont.log" 2>&1
NEW=$(rows longmont.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) longmont: not bigger ($OLD -> $NEW), old files back"; cp longmont.csv.bak-allsizes longmont.csv 2>/dev/null; cp longmont-areas.json.bak-allsizes longmont-areas.json 2>/dev/null
else
  echo "$(date +%T) longmont: $OLD -> $NEW doors"
  step areas-longmont node build-walklist-pdf.mjs longmont.csv --no-pdf
  step lawn-longmont bash -c "cd lawn-trial && node sample-lawn.mjs --town=longmont --conc=16"
  step value-longmont node sample-value.mjs --only=longmont
  step lookup-longmont node build-lookup.mjs longmont
  step rounds-longmont node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-longmont longmont
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py longmont ~/upload-backups/before-allsizes-longmont.tgz" < /dev/null
fi

# Strasburg, 36.5 mi
echo "$(date +%T) == strasburg (65)"
cp strasburg.csv strasburg.csv.bak-allsizes 2>/dev/null; cp strasburg-areas.json strasburg-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows strasburg.csv.bak-allsizes)
  step pull-strasburg-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0 --pieces=strasburg-cdp.json --out=strasburg-adams.csv
  step pull-strasburg-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0 --pieces=strasburg-cdp.json --out=strasburg-arapahoe.csv
  node merge-walklists.mjs strasburg.csv $(ls strasburg-adams.csv strasburg-arapahoe.csv 2>/dev/null) > "$L/merge-strasburg.log" 2>&1
NEW=$(rows strasburg.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) strasburg: not bigger ($OLD -> $NEW), old files back"; cp strasburg.csv.bak-allsizes strasburg.csv 2>/dev/null; cp strasburg-areas.json.bak-allsizes strasburg-areas.json 2>/dev/null
else
  echo "$(date +%T) strasburg: $OLD -> $NEW doors"
  step areas-strasburg node build-walklist-pdf.mjs strasburg.csv --no-pdf
  step lawn-strasburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=strasburg --conc=16"
  step value-strasburg node sample-value.mjs --only=strasburg
  step lookup-strasburg node build-lookup.mjs strasburg
  step rounds-strasburg node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-strasburg strasburg
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py strasburg ~/upload-backups/before-allsizes-strasburg.tgz" < /dev/null
fi

# Platteville, 39.8 mi
echo "$(date +%T) == platteville (66)"
cp platteville.csv platteville.csv.bak-allsizes 2>/dev/null; cp platteville-areas.json platteville-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows platteville.csv.bak-allsizes)
  step pull-platteville node build-walklist-co.mjs --county='WELD' --lat=40.215 --lon=-104.823 --radius=1.8 --min-acres=0 --municipality='Platteville' --out=platteville.csv
NEW=$(rows platteville.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) platteville: not bigger ($OLD -> $NEW), old files back"; cp platteville.csv.bak-allsizes platteville.csv 2>/dev/null; cp platteville-areas.json.bak-allsizes platteville-areas.json 2>/dev/null
else
  echo "$(date +%T) platteville: $OLD -> $NEW doors"
  step areas-platteville node build-walklist-pdf.mjs platteville.csv --no-pdf
  step lawn-platteville bash -c "cd lawn-trial && node sample-lawn.mjs --town=platteville --conc=16"
  step value-platteville node sample-value.mjs --only=platteville
  step lookup-platteville node build-lookup.mjs platteville
  step rounds-platteville node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-platteville platteville
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py platteville ~/upload-backups/before-allsizes-platteville.tgz" < /dev/null
fi

# Mead, 40.0 mi
echo "$(date +%T) == mead (67)"
cp mead.csv mead.csv.bak-allsizes 2>/dev/null; cp mead-areas.json mead-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows mead.csv.bak-allsizes)
  step pull-mead node build-walklist-co.mjs --county='WELD' --lat=40.233 --lon=-104.999 --radius=3 --min-acres=0 --municipality='Mead' --out=mead.csv
NEW=$(rows mead.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) mead: not bigger ($OLD -> $NEW), old files back"; cp mead.csv.bak-allsizes mead.csv 2>/dev/null; cp mead-areas.json.bak-allsizes mead-areas.json 2>/dev/null
else
  echo "$(date +%T) mead: $OLD -> $NEW doors"
  step areas-mead node build-walklist-pdf.mjs mead.csv --no-pdf
  step lawn-mead bash -c "cd lawn-trial && node sample-lawn.mjs --town=mead --conc=16"
  step value-mead node sample-value.mjs --only=mead
  step lookup-mead node build-lookup.mjs mead
  step rounds-mead node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-mead mead
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py mead ~/upload-backups/before-allsizes-mead.tgz" < /dev/null
fi

# Keenesburg, 40.2 mi
echo "$(date +%T) == keenesburg (68)"
cp keenesburg.csv keenesburg.csv.bak-allsizes 2>/dev/null; cp keenesburg-areas.json keenesburg-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows keenesburg.csv.bak-allsizes)
  step pull-keenesburg node build-walklist-co.mjs --county='WELD' --lat=40.108 --lon=-104.52 --radius=1.8 --min-acres=0 --municipality='Keenesburg' --out=keenesburg.csv
NEW=$(rows keenesburg.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) keenesburg: not bigger ($OLD -> $NEW), old files back"; cp keenesburg.csv.bak-allsizes keenesburg.csv 2>/dev/null; cp keenesburg-areas.json.bak-allsizes keenesburg-areas.json 2>/dev/null
else
  echo "$(date +%T) keenesburg: $OLD -> $NEW doors"
  step areas-keenesburg node build-walklist-pdf.mjs keenesburg.csv --no-pdf
  step lawn-keenesburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=keenesburg --conc=16"
  step value-keenesburg node sample-value.mjs --only=keenesburg
  step lookup-keenesburg node build-lookup.mjs keenesburg
  step rounds-keenesburg node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-keenesburg keenesburg
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py keenesburg ~/upload-backups/before-allsizes-keenesburg.tgz" < /dev/null
fi

# Byers, 41.4 mi
echo "$(date +%T) == byers (69)"
cp byers.csv byers.csv.bak-allsizes 2>/dev/null; cp byers-areas.json byers-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows byers.csv.bak-allsizes)
  step pull-byers node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7101 --lon=-104.219 --radius=2.31 --min-acres=0 --pieces=byers-cdp.json --out=byers.csv
NEW=$(rows byers.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) byers: not bigger ($OLD -> $NEW), old files back"; cp byers.csv.bak-allsizes byers.csv 2>/dev/null; cp byers-areas.json.bak-allsizes byers-areas.json 2>/dev/null
else
  echo "$(date +%T) byers: $OLD -> $NEW doors"
  step areas-byers node build-walklist-pdf.mjs byers.csv --no-pdf
  step lawn-byers bash -c "cd lawn-trial && node sample-lawn.mjs --town=byers --conc=16"
  step value-byers node sample-value.mjs --only=byers
  step lookup-byers node build-lookup.mjs byers
  step rounds-byers node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-byers byers
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py byers ~/upload-backups/before-allsizes-byers.tgz" < /dev/null
fi

# Lyons, 42.2 mi
echo "$(date +%T) == lyons (70)"
cp lyons.csv lyons.csv.bak-allsizes 2>/dev/null; cp lyons-areas.json lyons-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows lyons.csv.bak-allsizes)
  step pull-lyons node build-walklist-co.mjs --county='BOULDER' --lat=40.225 --lon=-105.271 --radius=1.5 --min-acres=0 --municipality='Lyons' --out=lyons.csv
NEW=$(rows lyons.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) lyons: not bigger ($OLD -> $NEW), old files back"; cp lyons.csv.bak-allsizes lyons.csv 2>/dev/null; cp lyons-areas.json.bak-allsizes lyons-areas.json 2>/dev/null
else
  echo "$(date +%T) lyons: $OLD -> $NEW doors"
  step areas-lyons node build-walklist-pdf.mjs lyons.csv --no-pdf
  step lawn-lyons bash -c "cd lawn-trial && node sample-lawn.mjs --town=lyons --conc=16"
  step value-lyons node sample-value.mjs --only=lyons
  step lookup-lyons node build-lookup.mjs lyons
  step rounds-lyons node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-lyons lyons
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py lyons ~/upload-backups/before-allsizes-lyons.tgz" < /dev/null
fi

# Woodland Park, 45.2 mi (pull rebuilt from its old list)
echo "$(date +%T) == woodland-park (71)"
cp woodland-park.csv woodland-park.csv.bak-allsizes 2>/dev/null; cp woodland-park-areas.json woodland-park-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows woodland-park.csv.bak-allsizes)
  step pull-woodland-park node build-walklist-co.mjs --county='TELLER' --lat=38.9962 --lon=-105.0590 --radius=3.9 --min-acres=0 --cities='WOODLAND PARK' --out=woodland-park-teller.csv
  mv -f woodland-park-teller.csv woodland-park.csv
  [ -s woodland-park.csv ] && step footprint-woodland-park node filter-footprint.mjs woodland-park.csv woodland-park.csv.bak-allsizes 0.35
NEW=$(rows woodland-park.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) woodland-park: not bigger ($OLD -> $NEW), old files back"; cp woodland-park.csv.bak-allsizes woodland-park.csv 2>/dev/null; cp woodland-park-areas.json.bak-allsizes woodland-park-areas.json 2>/dev/null
else
  echo "$(date +%T) woodland-park: $OLD -> $NEW doors"
  step areas-woodland-park node build-walklist-pdf.mjs woodland-park.csv --no-pdf
  step lawn-woodland-park bash -c "cd lawn-trial && node sample-lawn.mjs --town=woodland-park --conc=16"
  step value-woodland-park node sample-value.mjs --only=woodland-park
  step lookup-woodland-park node build-lookup.mjs woodland-park
  step rounds-woodland-park node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-woodland-park woodland-park
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py woodland-park ~/upload-backups/before-allsizes-woodland-park.tgz" < /dev/null
fi

# Divide, 49.6 mi (pull rebuilt from its old list)
echo "$(date +%T) == divide (72)"
cp divide.csv divide.csv.bak-allsizes 2>/dev/null; cp divide-areas.json divide-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows divide.csv.bak-allsizes)
  step pull-divide node build-walklist-co.mjs --county='TELLER' --lat=38.9427 --lon=-105.1815 --radius=4.7 --min-acres=0 --cities='DIVIDE' --out=divide-teller.csv
  mv -f divide-teller.csv divide.csv
  [ -s divide.csv ] && step footprint-divide node filter-footprint.mjs divide.csv divide.csv.bak-allsizes 0.35
NEW=$(rows divide.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) divide: not bigger ($OLD -> $NEW), old files back"; cp divide.csv.bak-allsizes divide.csv 2>/dev/null; cp divide-areas.json.bak-allsizes divide-areas.json 2>/dev/null
else
  echo "$(date +%T) divide: $OLD -> $NEW doors"
  step areas-divide node build-walklist-pdf.mjs divide.csv --no-pdf
  step lawn-divide bash -c "cd lawn-trial && node sample-lawn.mjs --town=divide --conc=16"
  step value-divide node sample-value.mjs --only=divide
  step lookup-divide node build-lookup.mjs divide
  step rounds-divide node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-divide divide
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py divide ~/upload-backups/before-allsizes-divide.tgz" < /dev/null
fi

# Florissant, 51.3 mi (pull rebuilt from its old list)
echo "$(date +%T) == florissant (73)"
cp florissant.csv florissant.csv.bak-allsizes 2>/dev/null; cp florissant-areas.json florissant-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows florissant.csv.bak-allsizes)
  step pull-florissant node build-walklist-co.mjs --county='TELLER' --lat=38.9536 --lon=-105.2857 --radius=3.8 --min-acres=0 --cities='FLORISSANT' --out=florissant-teller.csv
  mv -f florissant-teller.csv florissant.csv
  [ -s florissant.csv ] && step footprint-florissant node filter-footprint.mjs florissant.csv florissant.csv.bak-allsizes 0.35
NEW=$(rows florissant.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) florissant: not bigger ($OLD -> $NEW), old files back"; cp florissant.csv.bak-allsizes florissant.csv 2>/dev/null; cp florissant-areas.json.bak-allsizes florissant-areas.json 2>/dev/null
else
  echo "$(date +%T) florissant: $OLD -> $NEW doors"
  step areas-florissant node build-walklist-pdf.mjs florissant.csv --no-pdf
  step lawn-florissant bash -c "cd lawn-trial && node sample-lawn.mjs --town=florissant --conc=16"
  step value-florissant node sample-value.mjs --only=florissant
  step lookup-florissant node build-lookup.mjs florissant
  step rounds-florissant node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-florissant florissant
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py florissant ~/upload-backups/before-allsizes-florissant.tgz" < /dev/null
fi

# Windsor, 57.3 mi (pull rebuilt from its old list)
echo "$(date +%T) == windsor (74)"
cp windsor.csv windsor.csv.bak-allsizes 2>/dev/null; cp windsor-areas.json windsor-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows windsor.csv.bak-allsizes)
  step pull-windsor-1 node build-walklist-co.mjs --county='WELD' --lat=40.4711 --lon=-104.9264 --radius=5.4 --min-acres=0 --cities='WINDSOR' --out=windsor-weld.csv
  step pull-windsor-2 node build-walklist-co.mjs --county='LARIMER' --lat=40.4711 --lon=-104.9264 --radius=5.4 --min-acres=0 --cities='WINDSOR' --out=windsor-larimer.csv
  node merge-walklists.mjs windsor.csv $(ls windsor-weld.csv windsor-larimer.csv 2>/dev/null) > "$L/merge-windsor.log" 2>&1
  [ -s windsor.csv ] && step footprint-windsor node filter-footprint.mjs windsor.csv windsor.csv.bak-allsizes 0.35
NEW=$(rows windsor.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) windsor: not bigger ($OLD -> $NEW), old files back"; cp windsor.csv.bak-allsizes windsor.csv 2>/dev/null; cp windsor-areas.json.bak-allsizes windsor-areas.json 2>/dev/null
else
  echo "$(date +%T) windsor: $OLD -> $NEW doors"
  step areas-windsor node build-walklist-pdf.mjs windsor.csv --no-pdf
  step lawn-windsor bash -c "cd lawn-trial && node sample-lawn.mjs --town=windsor --conc=16"
  step value-windsor node sample-value.mjs --only=windsor
  step lookup-windsor node build-lookup.mjs windsor
  step rounds-windsor node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-windsor windsor
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py windsor ~/upload-backups/before-allsizes-windsor.tgz" < /dev/null
fi

# Cripple Creek, 63.3 mi (pull rebuilt from its old list)
echo "$(date +%T) == cripple-creek (75)"
cp cripple-creek.csv cripple-creek.csv.bak-allsizes 2>/dev/null; cp cripple-creek-areas.json cripple-creek-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows cripple-creek.csv.bak-allsizes)
  step pull-cripple-creek node build-walklist-co.mjs --county='TELLER' --lat=38.7539 --lon=-105.1814 --radius=4.5 --min-acres=0 --cities='CRIPPLE CREEK' --out=cripple-creek-teller.csv
  mv -f cripple-creek-teller.csv cripple-creek.csv
  [ -s cripple-creek.csv ] && step footprint-cripple-creek node filter-footprint.mjs cripple-creek.csv cripple-creek.csv.bak-allsizes 0.35
NEW=$(rows cripple-creek.csv)
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) cripple-creek: not bigger ($OLD -> $NEW), old files back"; cp cripple-creek.csv.bak-allsizes cripple-creek.csv 2>/dev/null; cp cripple-creek-areas.json.bak-allsizes cripple-creek-areas.json 2>/dev/null
else
  echo "$(date +%T) cripple-creek: $OLD -> $NEW doors"
  step areas-cripple-creek node build-walklist-pdf.mjs cripple-creek.csv --no-pdf
  step lawn-cripple-creek bash -c "cd lawn-trial && node sample-lawn.mjs --town=cripple-creek --conc=16"
  step value-cripple-creek node sample-value.mjs --only=cripple-creek
  step lookup-cripple-creek node build-lookup.mjs cripple-creek
  step rounds-cripple-creek node build-rounds-data.mjs
  bash upload-towns-sixfold.sh allsizes-cripple-creek cripple-creek
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py cripple-creek ~/upload-backups/before-allsizes-cripple-creek.tgz" < /dev/null
fi
echo "$(date +%T) all done"

#!/bin/bash
# 2026-10-17 evening: the internet came and went from ~17:30, then the iPhone hotspot stopped run-fast4 at Frederick. Elizabeth, Larkspur
# and Dacono are built (their uploads failed): upload them; Boulder (download timed out; old list put back) and Gunbarrel again; then
# Frederick..Cripple Creek. A failed download now keeps the old files; an upload is tried up to three times.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-allsizes; mkdir -p "$L"
step() { local name=$1; shift; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: ${SSID:-wired}"
bash hotspot-watchdog2.sh run-fast5 > "$L/watchdog.log" 2>&1 &
cat remap-assign.py | bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'cat > ~/remap-assign.py && echo remap-ready'
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
town() {   # town key, then the pull lines run by the caller
  :
}
curl -s -m 15 -o /dev/null https://gis.colorado.gov/ || { echo "$(date +%T) no internet - not starting"; exit 1; }

_step0=$(declare -f step); eval "${_step0/step ()/_step_inner ()}"
step() { _step_inner "$@"; local rc=$?; [ $rc -ne 0 ] && case "$1" in pull-*) touch "$L/$1.failed";; esac; return $rc; }
upl() { for i in 1 2 3; do until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done
  bash upload-towns-sixfold.sh "$@" && [ -f "logs-upload/$1.done" ] && return 0; echo "$(date +%T) upload $1 failed (try $i)"; sleep 60; done; return 1; }
for t in elizabeth larkspur dacono; do
  echo "$(date +%T) == $t (upload)"
  upl allsizes-$t $t && bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py $t ~/upload-backups/before-allsizes-$t.tgz" < /dev/null
done
# Boulder, 28.6 mi (pull rebuilt from its old list)
echo "$(date +%T) == boulder (51)"
cp boulder.csv boulder.csv.bak-allsizes 2>/dev/null; cp boulder-areas.json boulder-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows boulder.csv.bak-allsizes)
  step pull-boulder node build-walklist-co.mjs --county='BOULDER' --lat=40.0172 --lon=-105.2599 --radius=6.6 --min-acres=0 --cities='BOULDER' --out=boulder-boulder.csv
  mv -f boulder-boulder.csv boulder.csv
  [ -s boulder.csv ] && step footprint-boulder node filter-footprint.mjs boulder.csv boulder.csv.bak-allsizes 0.35
NEW=$(rows boulder.csv); if ls "$L"/pull-boulder*.failed >/dev/null 2>&1; then echo "$(date +%T) boulder: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-boulder*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) boulder: not bigger ($OLD -> $NEW), old files back"; cp boulder.csv.bak-allsizes boulder.csv 2>/dev/null; cp boulder-areas.json.bak-allsizes boulder-areas.json 2>/dev/null
else
  echo "$(date +%T) boulder: $OLD -> $NEW doors"
  step areas-boulder node build-walklist-pdf.mjs boulder.csv --no-pdf
  step lawn-boulder bash -c "cd lawn-trial && node sample-lawn.mjs --town=boulder --conc=16"
  step value-boulder node sample-value.mjs --only=boulder
  step lookup-boulder node build-lookup.mjs boulder
  step rounds-boulder node build-rounds-data.mjs
  upl allsizes-boulder boulder
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py boulder ~/upload-backups/before-allsizes-boulder.tgz" < /dev/null
fi

# Gunbarrel, 30.4 mi
echo "$(date +%T) == gunbarrel (55)"
cp gunbarrel.csv gunbarrel.csv.bak-allsizes 2>/dev/null; cp gunbarrel-areas.json gunbarrel-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows gunbarrel.csv.bak-allsizes)
  step pull-gunbarrel node build-walklist-co.mjs --county='BOULDER' --lat=40.069 --lon=-105.1784 --radius=2.86 --min-acres=0 --pieces=gunbarrel-cdp.json --out=gunbarrel.csv
NEW=$(rows gunbarrel.csv); if ls "$L"/pull-gunbarrel*.failed >/dev/null 2>&1; then echo "$(date +%T) gunbarrel: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-gunbarrel*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) gunbarrel: not bigger ($OLD -> $NEW), old files back"; cp gunbarrel.csv.bak-allsizes gunbarrel.csv 2>/dev/null; cp gunbarrel-areas.json.bak-allsizes gunbarrel-areas.json 2>/dev/null
else
  echo "$(date +%T) gunbarrel: $OLD -> $NEW doors"
  step areas-gunbarrel node build-walklist-pdf.mjs gunbarrel.csv --no-pdf
  step lawn-gunbarrel bash -c "cd lawn-trial && node sample-lawn.mjs --town=gunbarrel --conc=16"
  step value-gunbarrel node sample-value.mjs --only=gunbarrel
  step lookup-gunbarrel node build-lookup.mjs gunbarrel
  step rounds-gunbarrel node build-rounds-data.mjs
  upl allsizes-gunbarrel gunbarrel
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py gunbarrel ~/upload-backups/before-allsizes-gunbarrel.tgz" < /dev/null
fi

# Frederick, 30.8 mi
echo "$(date +%T) == frederick (56)"
cp frederick.csv frederick.csv.bak-allsizes 2>/dev/null; cp frederick-areas.json frederick-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows frederick.csv.bak-allsizes)
  step pull-frederick node build-walklist-co.mjs --county='WELD' --lat=40.099 --lon=-104.95 --radius=3 --min-acres=0 --municipality='Frederick' --out=frederick.csv
NEW=$(rows frederick.csv); if ls "$L"/pull-frederick*.failed >/dev/null 2>&1; then echo "$(date +%T) frederick: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-frederick*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) frederick: not bigger ($OLD -> $NEW), old files back"; cp frederick.csv.bak-allsizes frederick.csv 2>/dev/null; cp frederick-areas.json.bak-allsizes frederick-areas.json 2>/dev/null
else
  echo "$(date +%T) frederick: $OLD -> $NEW doors"
  step areas-frederick node build-walklist-pdf.mjs frederick.csv --no-pdf
  step lawn-frederick bash -c "cd lawn-trial && node sample-lawn.mjs --town=frederick --conc=16"
  step value-frederick node sample-value.mjs --only=frederick
  step lookup-frederick node build-lookup.mjs frederick
  step rounds-frederick node build-rounds-data.mjs
  upl allsizes-frederick frederick
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py frederick ~/upload-backups/before-allsizes-frederick.tgz" < /dev/null
fi

# Bennett, 31.0 mi
echo "$(date +%T) == bennett (57)"
cp bennett.csv bennett.csv.bak-allsizes 2>/dev/null; cp bennett-areas.json bennett-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows bennett.csv.bak-allsizes)
  step pull-bennett-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0 --municipality='Bennett' --out=bennett-adams.csv
  step pull-bennett-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0 --municipality='Bennett' --out=bennett-arapahoe.csv
  node merge-walklists.mjs bennett.csv $(ls bennett-adams.csv bennett-arapahoe.csv 2>/dev/null) > "$L/merge-bennett.log" 2>&1
NEW=$(rows bennett.csv); if ls "$L"/pull-bennett*.failed >/dev/null 2>&1; then echo "$(date +%T) bennett: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-bennett*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) bennett: not bigger ($OLD -> $NEW), old files back"; cp bennett.csv.bak-allsizes bennett.csv 2>/dev/null; cp bennett-areas.json.bak-allsizes bennett-areas.json 2>/dev/null
else
  echo "$(date +%T) bennett: $OLD -> $NEW doors"
  step areas-bennett node build-walklist-pdf.mjs bennett.csv --no-pdf
  step lawn-bennett bash -c "cd lawn-trial && node sample-lawn.mjs --town=bennett --conc=16"
  step value-bennett node sample-value.mjs --only=bennett
  step lookup-bennett node build-lookup.mjs bennett
  step rounds-bennett node build-rounds-data.mjs
  upl allsizes-bennett bennett
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py bennett ~/upload-backups/before-allsizes-bennett.tgz" < /dev/null
fi

# Fort Lupton, 31.3 mi
echo "$(date +%T) == fort-lupton (58)"
cp fort-lupton.csv fort-lupton.csv.bak-allsizes 2>/dev/null; cp fort-lupton-areas.json fort-lupton-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows fort-lupton.csv.bak-allsizes)
  step pull-fort-lupton node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.813 --radius=3 --min-acres=0 --municipality='Fort Lupton' --out=fort-lupton.csv
NEW=$(rows fort-lupton.csv); if ls "$L"/pull-fort-lupton*.failed >/dev/null 2>&1; then echo "$(date +%T) fort-lupton: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-fort-lupton*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) fort-lupton: not bigger ($OLD -> $NEW), old files back"; cp fort-lupton.csv.bak-allsizes fort-lupton.csv 2>/dev/null; cp fort-lupton-areas.json.bak-allsizes fort-lupton-areas.json 2>/dev/null
else
  echo "$(date +%T) fort-lupton: $OLD -> $NEW doors"
  step areas-fort-lupton node build-walklist-pdf.mjs fort-lupton.csv --no-pdf
  step lawn-fort-lupton bash -c "cd lawn-trial && node sample-lawn.mjs --town=fort-lupton --conc=16"
  step value-fort-lupton node sample-value.mjs --only=fort-lupton
  step lookup-fort-lupton node build-lookup.mjs fort-lupton
  step rounds-fort-lupton node build-rounds-data.mjs
  upl allsizes-fort-lupton fort-lupton
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py fort-lupton ~/upload-backups/before-allsizes-fort-lupton.tgz" < /dev/null
fi

# Niwot, 32.2 mi
echo "$(date +%T) == niwot (59)"
cp niwot.csv niwot.csv.bak-allsizes 2>/dev/null; cp niwot-areas.json niwot-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows niwot.csv.bak-allsizes)
  step pull-niwot node build-walklist-co.mjs --county='BOULDER' --lat=40.1017 --lon=-105.1595 --radius=1.73 --min-acres=0 --pieces=niwot-cdp.json --out=niwot.csv
NEW=$(rows niwot.csv); if ls "$L"/pull-niwot*.failed >/dev/null 2>&1; then echo "$(date +%T) niwot: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-niwot*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) niwot: not bigger ($OLD -> $NEW), old files back"; cp niwot.csv.bak-allsizes niwot.csv 2>/dev/null; cp niwot-areas.json.bak-allsizes niwot-areas.json 2>/dev/null
else
  echo "$(date +%T) niwot: $OLD -> $NEW doors"
  step areas-niwot node build-walklist-pdf.mjs niwot.csv --no-pdf
  step lawn-niwot bash -c "cd lawn-trial && node sample-lawn.mjs --town=niwot --conc=16"
  step value-niwot node sample-value.mjs --only=niwot
  step lookup-niwot node build-lookup.mjs niwot
  step rounds-niwot node build-rounds-data.mjs
  upl allsizes-niwot niwot
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py niwot ~/upload-backups/before-allsizes-niwot.tgz" < /dev/null
fi

# Firestone, 33.0 mi
echo "$(date +%T) == firestone (60)"
cp firestone.csv firestone.csv.bak-allsizes 2>/dev/null; cp firestone-areas.json firestone-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows firestone.csv.bak-allsizes)
  step pull-firestone node build-walklist-co.mjs --county='WELD' --lat=40.13 --lon=-104.94 --radius=3.5 --min-acres=0 --municipality='Firestone' --out=firestone.csv
NEW=$(rows firestone.csv); if ls "$L"/pull-firestone*.failed >/dev/null 2>&1; then echo "$(date +%T) firestone: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-firestone*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) firestone: not bigger ($OLD -> $NEW), old files back"; cp firestone.csv.bak-allsizes firestone.csv 2>/dev/null; cp firestone-areas.json.bak-allsizes firestone-areas.json 2>/dev/null
else
  echo "$(date +%T) firestone: $OLD -> $NEW doors"
  step areas-firestone node build-walklist-pdf.mjs firestone.csv --no-pdf
  step lawn-firestone bash -c "cd lawn-trial && node sample-lawn.mjs --town=firestone --conc=16"
  step value-firestone node sample-value.mjs --only=firestone
  step lookup-firestone node build-lookup.mjs firestone
  step rounds-firestone node build-rounds-data.mjs
  upl allsizes-firestone firestone
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py firestone ~/upload-backups/before-allsizes-firestone.tgz" < /dev/null
fi

# Hudson, 34.5 mi
echo "$(date +%T) == hudson (61)"
cp hudson.csv hudson.csv.bak-allsizes 2>/dev/null; cp hudson-areas.json hudson-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows hudson.csv.bak-allsizes)
  step pull-hudson node build-walklist-co.mjs --county='WELD' --lat=40.074 --lon=-104.643 --radius=2 --min-acres=0 --municipality='Hudson' --out=hudson.csv
NEW=$(rows hudson.csv); if ls "$L"/pull-hudson*.failed >/dev/null 2>&1; then echo "$(date +%T) hudson: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-hudson*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) hudson: not bigger ($OLD -> $NEW), old files back"; cp hudson.csv.bak-allsizes hudson.csv 2>/dev/null; cp hudson-areas.json.bak-allsizes hudson-areas.json 2>/dev/null
else
  echo "$(date +%T) hudson: $OLD -> $NEW doors"
  step areas-hudson node build-walklist-pdf.mjs hudson.csv --no-pdf
  step lawn-hudson bash -c "cd lawn-trial && node sample-lawn.mjs --town=hudson --conc=16"
  step value-hudson node sample-value.mjs --only=hudson
  step lookup-hudson node build-lookup.mjs hudson
  step rounds-hudson node build-rounds-data.mjs
  upl allsizes-hudson hudson
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py hudson ~/upload-backups/before-allsizes-hudson.tgz" < /dev/null
fi

# Nederland, 34.9 mi
echo "$(date +%T) == nederland (62)"
cp nederland.csv nederland.csv.bak-allsizes 2>/dev/null; cp nederland-areas.json nederland-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows nederland.csv.bak-allsizes)
  step pull-nederland node build-walklist-co.mjs --county='BOULDER' --lat=39.961 --lon=-105.511 --radius=1.5 --min-acres=0 --municipality='Nederland' --out=nederland.csv
NEW=$(rows nederland.csv); if ls "$L"/pull-nederland*.failed >/dev/null 2>&1; then echo "$(date +%T) nederland: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-nederland*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) nederland: not bigger ($OLD -> $NEW), old files back"; cp nederland.csv.bak-allsizes nederland.csv 2>/dev/null; cp nederland-areas.json.bak-allsizes nederland-areas.json 2>/dev/null
else
  echo "$(date +%T) nederland: $OLD -> $NEW doors"
  step areas-nederland node build-walklist-pdf.mjs nederland.csv --no-pdf
  step lawn-nederland bash -c "cd lawn-trial && node sample-lawn.mjs --town=nederland --conc=16"
  step value-nederland node sample-value.mjs --only=nederland
  step lookup-nederland node build-lookup.mjs nederland
  step rounds-nederland node build-rounds-data.mjs
  upl allsizes-nederland nederland
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py nederland ~/upload-backups/before-allsizes-nederland.tgz" < /dev/null
fi

# Kiowa, 35.2 mi
echo "$(date +%T) == kiowa (63)"
cp kiowa.csv kiowa.csv.bak-allsizes 2>/dev/null; cp kiowa-areas.json kiowa-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows kiowa.csv.bak-allsizes)
  step pull-kiowa node build-walklist-co.mjs --county='ELBERT' --lat=39.347 --lon=-104.464 --radius=1.2 --min-acres=0 --municipality='Kiowa' --out=kiowa.csv
NEW=$(rows kiowa.csv); if ls "$L"/pull-kiowa*.failed >/dev/null 2>&1; then echo "$(date +%T) kiowa: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-kiowa*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) kiowa: not bigger ($OLD -> $NEW), old files back"; cp kiowa.csv.bak-allsizes kiowa.csv 2>/dev/null; cp kiowa-areas.json.bak-allsizes kiowa-areas.json 2>/dev/null
else
  echo "$(date +%T) kiowa: $OLD -> $NEW doors"
  step areas-kiowa node build-walklist-pdf.mjs kiowa.csv --no-pdf
  step lawn-kiowa bash -c "cd lawn-trial && node sample-lawn.mjs --town=kiowa --conc=16"
  step value-kiowa node sample-value.mjs --only=kiowa
  step lookup-kiowa node build-lookup.mjs kiowa
  step rounds-kiowa node build-rounds-data.mjs
  upl allsizes-kiowa kiowa
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py kiowa ~/upload-backups/before-allsizes-kiowa.tgz" < /dev/null
fi

# Longmont, 36.1 mi
echo "$(date +%T) == longmont (64)"
cp longmont.csv longmont.csv.bak-allsizes 2>/dev/null; cp longmont-areas.json longmont-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows longmont.csv.bak-allsizes)
  step pull-longmont-1 node build-walklist-co.mjs --county='BOULDER' --lat=40.17 --lon=-105.11 --radius=6 --min-acres=0 --municipality='Longmont' --out=longmont-boulder.csv
  step pull-longmont-2 node build-walklist-co.mjs --county='WELD' --lat=40.17 --lon=-105.03 --radius=3 --min-acres=0 --municipality='Longmont' --out=longmont-weld.csv
  node merge-walklists.mjs longmont.csv $(ls longmont-boulder.csv longmont-weld.csv 2>/dev/null) > "$L/merge-longmont.log" 2>&1
NEW=$(rows longmont.csv); if ls "$L"/pull-longmont*.failed >/dev/null 2>&1; then echo "$(date +%T) longmont: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-longmont*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) longmont: not bigger ($OLD -> $NEW), old files back"; cp longmont.csv.bak-allsizes longmont.csv 2>/dev/null; cp longmont-areas.json.bak-allsizes longmont-areas.json 2>/dev/null
else
  echo "$(date +%T) longmont: $OLD -> $NEW doors"
  step areas-longmont node build-walklist-pdf.mjs longmont.csv --no-pdf
  step lawn-longmont bash -c "cd lawn-trial && node sample-lawn.mjs --town=longmont --conc=16"
  step value-longmont node sample-value.mjs --only=longmont
  step lookup-longmont node build-lookup.mjs longmont
  step rounds-longmont node build-rounds-data.mjs
  upl allsizes-longmont longmont
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py longmont ~/upload-backups/before-allsizes-longmont.tgz" < /dev/null
fi

# Strasburg, 36.5 mi
echo "$(date +%T) == strasburg (65)"
cp strasburg.csv strasburg.csv.bak-allsizes 2>/dev/null; cp strasburg-areas.json strasburg-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows strasburg.csv.bak-allsizes)
  step pull-strasburg-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0 --pieces=strasburg-cdp.json --out=strasburg-adams.csv
  step pull-strasburg-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0 --pieces=strasburg-cdp.json --out=strasburg-arapahoe.csv
  node merge-walklists.mjs strasburg.csv $(ls strasburg-adams.csv strasburg-arapahoe.csv 2>/dev/null) > "$L/merge-strasburg.log" 2>&1
NEW=$(rows strasburg.csv); if ls "$L"/pull-strasburg*.failed >/dev/null 2>&1; then echo "$(date +%T) strasburg: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-strasburg*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) strasburg: not bigger ($OLD -> $NEW), old files back"; cp strasburg.csv.bak-allsizes strasburg.csv 2>/dev/null; cp strasburg-areas.json.bak-allsizes strasburg-areas.json 2>/dev/null
else
  echo "$(date +%T) strasburg: $OLD -> $NEW doors"
  step areas-strasburg node build-walklist-pdf.mjs strasburg.csv --no-pdf
  step lawn-strasburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=strasburg --conc=16"
  step value-strasburg node sample-value.mjs --only=strasburg
  step lookup-strasburg node build-lookup.mjs strasburg
  step rounds-strasburg node build-rounds-data.mjs
  upl allsizes-strasburg strasburg
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py strasburg ~/upload-backups/before-allsizes-strasburg.tgz" < /dev/null
fi

# Platteville, 39.8 mi
echo "$(date +%T) == platteville (66)"
cp platteville.csv platteville.csv.bak-allsizes 2>/dev/null; cp platteville-areas.json platteville-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows platteville.csv.bak-allsizes)
  step pull-platteville node build-walklist-co.mjs --county='WELD' --lat=40.215 --lon=-104.823 --radius=1.8 --min-acres=0 --municipality='Platteville' --out=platteville.csv
NEW=$(rows platteville.csv); if ls "$L"/pull-platteville*.failed >/dev/null 2>&1; then echo "$(date +%T) platteville: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-platteville*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) platteville: not bigger ($OLD -> $NEW), old files back"; cp platteville.csv.bak-allsizes platteville.csv 2>/dev/null; cp platteville-areas.json.bak-allsizes platteville-areas.json 2>/dev/null
else
  echo "$(date +%T) platteville: $OLD -> $NEW doors"
  step areas-platteville node build-walklist-pdf.mjs platteville.csv --no-pdf
  step lawn-platteville bash -c "cd lawn-trial && node sample-lawn.mjs --town=platteville --conc=16"
  step value-platteville node sample-value.mjs --only=platteville
  step lookup-platteville node build-lookup.mjs platteville
  step rounds-platteville node build-rounds-data.mjs
  upl allsizes-platteville platteville
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py platteville ~/upload-backups/before-allsizes-platteville.tgz" < /dev/null
fi

# Mead, 40.0 mi
echo "$(date +%T) == mead (67)"
cp mead.csv mead.csv.bak-allsizes 2>/dev/null; cp mead-areas.json mead-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows mead.csv.bak-allsizes)
  step pull-mead node build-walklist-co.mjs --county='WELD' --lat=40.233 --lon=-104.999 --radius=3 --min-acres=0 --municipality='Mead' --out=mead.csv
NEW=$(rows mead.csv); if ls "$L"/pull-mead*.failed >/dev/null 2>&1; then echo "$(date +%T) mead: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-mead*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) mead: not bigger ($OLD -> $NEW), old files back"; cp mead.csv.bak-allsizes mead.csv 2>/dev/null; cp mead-areas.json.bak-allsizes mead-areas.json 2>/dev/null
else
  echo "$(date +%T) mead: $OLD -> $NEW doors"
  step areas-mead node build-walklist-pdf.mjs mead.csv --no-pdf
  step lawn-mead bash -c "cd lawn-trial && node sample-lawn.mjs --town=mead --conc=16"
  step value-mead node sample-value.mjs --only=mead
  step lookup-mead node build-lookup.mjs mead
  step rounds-mead node build-rounds-data.mjs
  upl allsizes-mead mead
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py mead ~/upload-backups/before-allsizes-mead.tgz" < /dev/null
fi

# Keenesburg, 40.2 mi
echo "$(date +%T) == keenesburg (68)"
cp keenesburg.csv keenesburg.csv.bak-allsizes 2>/dev/null; cp keenesburg-areas.json keenesburg-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows keenesburg.csv.bak-allsizes)
  step pull-keenesburg node build-walklist-co.mjs --county='WELD' --lat=40.108 --lon=-104.52 --radius=1.8 --min-acres=0 --municipality='Keenesburg' --out=keenesburg.csv
NEW=$(rows keenesburg.csv); if ls "$L"/pull-keenesburg*.failed >/dev/null 2>&1; then echo "$(date +%T) keenesburg: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-keenesburg*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) keenesburg: not bigger ($OLD -> $NEW), old files back"; cp keenesburg.csv.bak-allsizes keenesburg.csv 2>/dev/null; cp keenesburg-areas.json.bak-allsizes keenesburg-areas.json 2>/dev/null
else
  echo "$(date +%T) keenesburg: $OLD -> $NEW doors"
  step areas-keenesburg node build-walklist-pdf.mjs keenesburg.csv --no-pdf
  step lawn-keenesburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=keenesburg --conc=16"
  step value-keenesburg node sample-value.mjs --only=keenesburg
  step lookup-keenesburg node build-lookup.mjs keenesburg
  step rounds-keenesburg node build-rounds-data.mjs
  upl allsizes-keenesburg keenesburg
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py keenesburg ~/upload-backups/before-allsizes-keenesburg.tgz" < /dev/null
fi

# Byers, 41.4 mi
echo "$(date +%T) == byers (69)"
cp byers.csv byers.csv.bak-allsizes 2>/dev/null; cp byers-areas.json byers-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows byers.csv.bak-allsizes)
  step pull-byers node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7101 --lon=-104.219 --radius=2.31 --min-acres=0 --pieces=byers-cdp.json --out=byers.csv
NEW=$(rows byers.csv); if ls "$L"/pull-byers*.failed >/dev/null 2>&1; then echo "$(date +%T) byers: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-byers*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) byers: not bigger ($OLD -> $NEW), old files back"; cp byers.csv.bak-allsizes byers.csv 2>/dev/null; cp byers-areas.json.bak-allsizes byers-areas.json 2>/dev/null
else
  echo "$(date +%T) byers: $OLD -> $NEW doors"
  step areas-byers node build-walklist-pdf.mjs byers.csv --no-pdf
  step lawn-byers bash -c "cd lawn-trial && node sample-lawn.mjs --town=byers --conc=16"
  step value-byers node sample-value.mjs --only=byers
  step lookup-byers node build-lookup.mjs byers
  step rounds-byers node build-rounds-data.mjs
  upl allsizes-byers byers
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py byers ~/upload-backups/before-allsizes-byers.tgz" < /dev/null
fi

# Lyons, 42.2 mi
echo "$(date +%T) == lyons (70)"
cp lyons.csv lyons.csv.bak-allsizes 2>/dev/null; cp lyons-areas.json lyons-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows lyons.csv.bak-allsizes)
  step pull-lyons node build-walklist-co.mjs --county='BOULDER' --lat=40.225 --lon=-105.271 --radius=1.5 --min-acres=0 --municipality='Lyons' --out=lyons.csv
NEW=$(rows lyons.csv); if ls "$L"/pull-lyons*.failed >/dev/null 2>&1; then echo "$(date +%T) lyons: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-lyons*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) lyons: not bigger ($OLD -> $NEW), old files back"; cp lyons.csv.bak-allsizes lyons.csv 2>/dev/null; cp lyons-areas.json.bak-allsizes lyons-areas.json 2>/dev/null
else
  echo "$(date +%T) lyons: $OLD -> $NEW doors"
  step areas-lyons node build-walklist-pdf.mjs lyons.csv --no-pdf
  step lawn-lyons bash -c "cd lawn-trial && node sample-lawn.mjs --town=lyons --conc=16"
  step value-lyons node sample-value.mjs --only=lyons
  step lookup-lyons node build-lookup.mjs lyons
  step rounds-lyons node build-rounds-data.mjs
  upl allsizes-lyons lyons
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py lyons ~/upload-backups/before-allsizes-lyons.tgz" < /dev/null
fi

# Woodland Park, 45.2 mi (pull rebuilt from its old list)
echo "$(date +%T) == woodland-park (71)"
cp woodland-park.csv woodland-park.csv.bak-allsizes 2>/dev/null; cp woodland-park-areas.json woodland-park-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows woodland-park.csv.bak-allsizes)
  step pull-woodland-park node build-walklist-co.mjs --county='TELLER' --lat=38.9962 --lon=-105.0590 --radius=3.9 --min-acres=0 --cities='WOODLAND PARK' --out=woodland-park-teller.csv
  mv -f woodland-park-teller.csv woodland-park.csv
  [ -s woodland-park.csv ] && step footprint-woodland-park node filter-footprint.mjs woodland-park.csv woodland-park.csv.bak-allsizes 0.35
NEW=$(rows woodland-park.csv); if ls "$L"/pull-woodland-park*.failed >/dev/null 2>&1; then echo "$(date +%T) woodland-park: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-woodland-park*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) woodland-park: not bigger ($OLD -> $NEW), old files back"; cp woodland-park.csv.bak-allsizes woodland-park.csv 2>/dev/null; cp woodland-park-areas.json.bak-allsizes woodland-park-areas.json 2>/dev/null
else
  echo "$(date +%T) woodland-park: $OLD -> $NEW doors"
  step areas-woodland-park node build-walklist-pdf.mjs woodland-park.csv --no-pdf
  step lawn-woodland-park bash -c "cd lawn-trial && node sample-lawn.mjs --town=woodland-park --conc=16"
  step value-woodland-park node sample-value.mjs --only=woodland-park
  step lookup-woodland-park node build-lookup.mjs woodland-park
  step rounds-woodland-park node build-rounds-data.mjs
  upl allsizes-woodland-park woodland-park
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py woodland-park ~/upload-backups/before-allsizes-woodland-park.tgz" < /dev/null
fi

# Divide, 49.6 mi (pull rebuilt from its old list)
echo "$(date +%T) == divide (72)"
cp divide.csv divide.csv.bak-allsizes 2>/dev/null; cp divide-areas.json divide-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows divide.csv.bak-allsizes)
  step pull-divide node build-walklist-co.mjs --county='TELLER' --lat=38.9427 --lon=-105.1815 --radius=4.7 --min-acres=0 --cities='DIVIDE' --out=divide-teller.csv
  mv -f divide-teller.csv divide.csv
  [ -s divide.csv ] && step footprint-divide node filter-footprint.mjs divide.csv divide.csv.bak-allsizes 0.35
NEW=$(rows divide.csv); if ls "$L"/pull-divide*.failed >/dev/null 2>&1; then echo "$(date +%T) divide: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-divide*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) divide: not bigger ($OLD -> $NEW), old files back"; cp divide.csv.bak-allsizes divide.csv 2>/dev/null; cp divide-areas.json.bak-allsizes divide-areas.json 2>/dev/null
else
  echo "$(date +%T) divide: $OLD -> $NEW doors"
  step areas-divide node build-walklist-pdf.mjs divide.csv --no-pdf
  step lawn-divide bash -c "cd lawn-trial && node sample-lawn.mjs --town=divide --conc=16"
  step value-divide node sample-value.mjs --only=divide
  step lookup-divide node build-lookup.mjs divide
  step rounds-divide node build-rounds-data.mjs
  upl allsizes-divide divide
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py divide ~/upload-backups/before-allsizes-divide.tgz" < /dev/null
fi

# Florissant, 51.3 mi (pull rebuilt from its old list)
echo "$(date +%T) == florissant (73)"
cp florissant.csv florissant.csv.bak-allsizes 2>/dev/null; cp florissant-areas.json florissant-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows florissant.csv.bak-allsizes)
  step pull-florissant node build-walklist-co.mjs --county='TELLER' --lat=38.9536 --lon=-105.2857 --radius=3.8 --min-acres=0 --cities='FLORISSANT' --out=florissant-teller.csv
  mv -f florissant-teller.csv florissant.csv
  [ -s florissant.csv ] && step footprint-florissant node filter-footprint.mjs florissant.csv florissant.csv.bak-allsizes 0.35
NEW=$(rows florissant.csv); if ls "$L"/pull-florissant*.failed >/dev/null 2>&1; then echo "$(date +%T) florissant: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-florissant*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) florissant: not bigger ($OLD -> $NEW), old files back"; cp florissant.csv.bak-allsizes florissant.csv 2>/dev/null; cp florissant-areas.json.bak-allsizes florissant-areas.json 2>/dev/null
else
  echo "$(date +%T) florissant: $OLD -> $NEW doors"
  step areas-florissant node build-walklist-pdf.mjs florissant.csv --no-pdf
  step lawn-florissant bash -c "cd lawn-trial && node sample-lawn.mjs --town=florissant --conc=16"
  step value-florissant node sample-value.mjs --only=florissant
  step lookup-florissant node build-lookup.mjs florissant
  step rounds-florissant node build-rounds-data.mjs
  upl allsizes-florissant florissant
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
NEW=$(rows windsor.csv); if ls "$L"/pull-windsor*.failed >/dev/null 2>&1; then echo "$(date +%T) windsor: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-windsor*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) windsor: not bigger ($OLD -> $NEW), old files back"; cp windsor.csv.bak-allsizes windsor.csv 2>/dev/null; cp windsor-areas.json.bak-allsizes windsor-areas.json 2>/dev/null
else
  echo "$(date +%T) windsor: $OLD -> $NEW doors"
  step areas-windsor node build-walklist-pdf.mjs windsor.csv --no-pdf
  step lawn-windsor bash -c "cd lawn-trial && node sample-lawn.mjs --town=windsor --conc=16"
  step value-windsor node sample-value.mjs --only=windsor
  step lookup-windsor node build-lookup.mjs windsor
  step rounds-windsor node build-rounds-data.mjs
  upl allsizes-windsor windsor
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py windsor ~/upload-backups/before-allsizes-windsor.tgz" < /dev/null
fi

# Cripple Creek, 63.3 mi (pull rebuilt from its old list)
echo "$(date +%T) == cripple-creek (75)"
cp cripple-creek.csv cripple-creek.csv.bak-allsizes 2>/dev/null; cp cripple-creek-areas.json cripple-creek-areas.json.bak-allsizes 2>/dev/null
OLD=$(rows cripple-creek.csv.bak-allsizes)
  step pull-cripple-creek node build-walklist-co.mjs --county='TELLER' --lat=38.7539 --lon=-105.1814 --radius=4.5 --min-acres=0 --cities='CRIPPLE CREEK' --out=cripple-creek-teller.csv
  mv -f cripple-creek-teller.csv cripple-creek.csv
  [ -s cripple-creek.csv ] && step footprint-cripple-creek node filter-footprint.mjs cripple-creek.csv cripple-creek.csv.bak-allsizes 0.35
NEW=$(rows cripple-creek.csv); if ls "$L"/pull-cripple-creek*.failed >/dev/null 2>&1; then echo "$(date +%T) cripple-creek: a download failed, old files kept"; NEW=0; rm -f "$L"/pull-cripple-creek*.failed; fi
if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) cripple-creek: not bigger ($OLD -> $NEW), old files back"; cp cripple-creek.csv.bak-allsizes cripple-creek.csv 2>/dev/null; cp cripple-creek-areas.json.bak-allsizes cripple-creek-areas.json 2>/dev/null
else
  echo "$(date +%T) cripple-creek: $OLD -> $NEW doors"
  step areas-cripple-creek node build-walklist-pdf.mjs cripple-creek.csv --no-pdf
  step lawn-cripple-creek bash -c "cd lawn-trial && node sample-lawn.mjs --town=cripple-creek --conc=16"
  step value-cripple-creek node sample-value.mjs --only=cripple-creek
  step lookup-cripple-creek node build-lookup.mjs cripple-creek
  step rounds-cripple-creek node build-rounds-data.mjs
  upl allsizes-cripple-creek cripple-creek
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py cripple-creek ~/upload-backups/before-allsizes-cripple-creek.tgz" < /dev/null
fi
echo "$(date +%T) all done"

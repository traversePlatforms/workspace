#!/bin/bash
# Batch 4 (2026-10-16, Matthew: "our focus right now should be a 45 mile radius around englewood"), after batch 3 (logs-batch3/done.flag):
# 36 towns and Census places inside 45 miles of Englewood not built before, closest first. One job at a time against the state's
# parcel service. Door lists by legal boundary (towns) or Census boundary (<slug>-cdp.json), neighbourhoods, lawns, office-lookup lists,
# trees, county values (Elbert, Gilpin, Clear Creek have none wired), then the rebuild. Uploading is by hand. Made by make-batch4.cjs.
set -u
cd "$(dirname "$0")"
L=logs-batch4; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
until [ -f logs-batch3/done.flag ]; do sleep 60; done
rest() { local t=$1; [ -s "$t.csv" ] || { echo "$(date +%H:%M:%S) skip  $t (no doors)"; return; }
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "lookup-$t" node build-lookup.mjs "$t"
  step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; }
# Bow Mar, 3.7 mi
step pull-bow-mar-1 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.626 --lon=-105.051 --radius=1 --min-acres=0.12 --municipality='Bow Mar' --out=bow-mar-arapahoe.csv
step pull-bow-mar-2 node build-walklist-co.mjs --county='JEFFERSON' --lat=39.626 --lon=-105.051 --radius=1 --min-acres=0.12 --municipality='Bow Mar' --out=bow-mar-jefferson.csv
node merge-walklists.mjs bow-mar.csv $(ls bow-mar-arapahoe.csv bow-mar-jefferson.csv 2>/dev/null) > "$L/merge-bow-mar.log" 2>&1
rest bow-mar
# Columbine Valley, 4.2 mi
step pull-columbine-valley node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.601 --lon=-105.033 --radius=1.2 --min-acres=0.12 --municipality='Columbine Valley' --out=columbine-valley.csv
rest columbine-valley
# Glendale, 4.7 mi
step pull-glendale node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.705 --lon=-104.934 --radius=0.9 --min-acres=0.12 --municipality='Glendale' --out=glendale.csv
rest glendale
# Dove Valley, 10.4 mi
step pull-dove-valley node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.5804 --lon=-104.8214 --radius=2.2 --min-acres=0.12 --pieces=dove-valley-cdp.json --out=dove-valley.csv
rest dove-valley
# Morrison, 10.6 mi
step pull-morrison node build-walklist-co.mjs --county='JEFFERSON' --lat=39.654 --lon=-105.191 --radius=1.5 --min-acres=0.12 --municipality='Morrison' --out=morrison.csv
rest morrison
# Twin Lakes, 11.8 mi
step pull-twin-lakes node build-walklist-co.mjs --county='ADAMS' --lat=39.8232 --lon=-105.0041 --radius=1.28 --min-acres=0.12 --pieces=twin-lakes-cdp.json --out=twin-lakes.csv
rest twin-lakes
# Foxfield, 11.8 mi
step pull-foxfield node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.588 --lon=-104.786 --radius=1.2 --min-acres=0.12 --municipality='Foxfield' --out=foxfield.csv
rest foxfield
# Stonegate, 12.8 mi
step pull-stonegate node build-walklist-co.mjs --county='DOUGLAS' --lat=39.5369 --lon=-104.8034 --radius=1.17 --min-acres=0.12 --pieces=stonegate-cdp.json --out=stonegate.csv
rest stonegate
# Sherrelwood, 12.9 mi
step pull-sherrelwood node build-walklist-co.mjs --county='ADAMS' --lat=39.8393 --lon=-105.004 --radius=1.27 --min-acres=0.12 --pieces=sherrelwood-cdp.json --out=sherrelwood.csv
rest sherrelwood
# Welby, 12.9 mi
step pull-welby node build-walklist-co.mjs --county='ADAMS' --lat=39.8386 --lon=-104.9634 --radius=1.4 --min-acres=0.12 --pieces=welby-cdp.json --out=welby.csv
rest welby
# Roxborough Park, 14.7 mi
step pull-roxborough-park node build-walklist-co.mjs --county='DOUGLAS' --lat=39.4502 --lon=-105.0728 --radius=2.97 --min-acres=0.12 --pieces=roxborough-park-cdp.json --out=roxborough-park.csv
rest roxborough-park
# Evergreen, 18.0 mi
step pull-evergreen-1 node build-walklist-co.mjs --county='JEFFERSON' --lat=39.6363 --lon=-105.3289 --radius=3.76 --min-acres=0.12 --pieces=evergreen-cdp.json --out=evergreen-jefferson.csv
step pull-evergreen-2 node build-walklist-co.mjs --county='CLEAR CREEK' --lat=39.6363 --lon=-105.3289 --radius=3.76 --min-acres=0.12 --pieces=evergreen-cdp.json --out=evergreen-clear-creek.csv
node merge-walklists.mjs evergreen.csv $(ls evergreen-jefferson.csv evergreen-clear-creek.csv 2>/dev/null) > "$L/merge-evergreen.log" 2>&1
rest evergreen
# The Pinery, 18.8 mi
step pull-the-pinery node build-walklist-co.mjs --county='DOUGLAS' --lat=39.4491 --lon=-104.7576 --radius=3.81 --min-acres=0.12 --pieces=the-pinery-cdp.json --out=the-pinery.csv
rest the-pinery
# Watkins, 22.4 mi
step pull-watkins-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.6958 --lon=-104.5745 --radius=4.62 --min-acres=0.12 --pieces=watkins-cdp.json --out=watkins-adams.csv
step pull-watkins-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.6958 --lon=-104.5745 --radius=4.62 --min-acres=0.12 --pieces=watkins-cdp.json --out=watkins-arapahoe.csv
node merge-walklists.mjs watkins.csv $(ls watkins-adams.csv watkins-arapahoe.csv 2>/dev/null) > "$L/merge-watkins.log" 2>&1
rest watkins
# Perry Park, 27.2 mi
step pull-perry-park node build-walklist-co.mjs --county='DOUGLAS' --lat=39.2592 --lon=-104.9855 --radius=2.5 --min-acres=0.12 --pieces=perry-park-cdp.json --out=perry-park.csv
rest perry-park
# Idaho Springs, 28.5 mi
step pull-idaho-springs node build-walklist-co.mjs --county='CLEAR CREEK' --lat=39.743 --lon=-105.514 --radius=1.8 --min-acres=0.12 --municipality='Idaho Springs' --out=idaho-springs.csv
rest idaho-springs
# Lochbuie, 28.5 mi
step pull-lochbuie-1 node build-walklist-co.mjs --county='WELD' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0.12 --municipality='Lochbuie' --out=lochbuie-weld.csv
step pull-lochbuie-2 node build-walklist-co.mjs --county='ADAMS' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0.12 --municipality='Lochbuie' --out=lochbuie-adams.csv
node merge-walklists.mjs lochbuie.csv $(ls lochbuie-weld.csv lochbuie-adams.csv 2>/dev/null) > "$L/merge-lochbuie.log" 2>&1
rest lochbuie
# Black Hawk, 28.5 mi
step pull-black-hawk node build-walklist-co.mjs --county='GILPIN' --lat=39.797 --lon=-105.494 --radius=1.5 --min-acres=0.12 --municipality='Black Hawk' --out=black-hawk.csv
rest black-hawk
# Elizabeth, 29.2 mi
step pull-elizabeth node build-walklist-co.mjs --county='ELBERT' --lat=39.36 --lon=-104.597 --radius=2 --min-acres=0.12 --municipality='Elizabeth' --out=elizabeth.csv
rest elizabeth
# Central City, 29.6 mi
step pull-central-city node build-walklist-co.mjs --county='GILPIN' --lat=39.802 --lon=-105.514 --radius=2 --min-acres=0.12 --municipality='Central City' --out=central-city.csv
rest central-city
# Dacono, 30.0 mi
step pull-dacono node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.94 --radius=2.5 --min-acres=0.12 --municipality='Dacono' --out=dacono.csv
rest dacono
# Gunbarrel, 30.4 mi
step pull-gunbarrel node build-walklist-co.mjs --county='BOULDER' --lat=40.069 --lon=-105.1784 --radius=2.86 --min-acres=0.12 --pieces=gunbarrel-cdp.json --out=gunbarrel.csv
rest gunbarrel
# Frederick, 30.9 mi
step pull-frederick node build-walklist-co.mjs --county='WELD' --lat=40.099 --lon=-104.95 --radius=3 --min-acres=0.12 --municipality='Frederick' --out=frederick.csv
rest frederick
# Bennett, 30.9 mi
step pull-bennett-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0.12 --municipality='Bennett' --out=bennett-adams.csv
step pull-bennett-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0.12 --municipality='Bennett' --out=bennett-arapahoe.csv
node merge-walklists.mjs bennett.csv $(ls bennett-adams.csv bennett-arapahoe.csv 2>/dev/null) > "$L/merge-bennett.log" 2>&1
rest bennett
# Fort Lupton, 31.3 mi
step pull-fort-lupton node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.813 --radius=3 --min-acres=0.12 --municipality='Fort Lupton' --out=fort-lupton.csv
rest fort-lupton
# Niwot, 32.2 mi
step pull-niwot node build-walklist-co.mjs --county='BOULDER' --lat=40.1017 --lon=-105.1595 --radius=1.73 --min-acres=0.12 --pieces=niwot-cdp.json --out=niwot.csv
rest niwot
# Firestone, 33.1 mi
step pull-firestone node build-walklist-co.mjs --county='WELD' --lat=40.13 --lon=-104.94 --radius=3.5 --min-acres=0.12 --municipality='Firestone' --out=firestone.csv
rest firestone
# Hudson, 34.4 mi
step pull-hudson node build-walklist-co.mjs --county='WELD' --lat=40.074 --lon=-104.643 --radius=2 --min-acres=0.12 --municipality='Hudson' --out=hudson.csv
rest hudson
# Nederland, 34.8 mi
step pull-nederland node build-walklist-co.mjs --county='BOULDER' --lat=39.961 --lon=-105.511 --radius=1.5 --min-acres=0.12 --municipality='Nederland' --out=nederland.csv
rest nederland
# Kiowa, 35.2 mi
step pull-kiowa node build-walklist-co.mjs --county='ELBERT' --lat=39.347 --lon=-104.464 --radius=1.2 --min-acres=0.12 --municipality='Kiowa' --out=kiowa.csv
rest kiowa
# Strasburg, 36.4 mi
step pull-strasburg-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0.12 --pieces=strasburg-cdp.json --out=strasburg-adams.csv
step pull-strasburg-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0.12 --pieces=strasburg-cdp.json --out=strasburg-arapahoe.csv
node merge-walklists.mjs strasburg.csv $(ls strasburg-adams.csv strasburg-arapahoe.csv 2>/dev/null) > "$L/merge-strasburg.log" 2>&1
rest strasburg
# Platteville, 39.8 mi
step pull-platteville node build-walklist-co.mjs --county='WELD' --lat=40.215 --lon=-104.823 --radius=1.8 --min-acres=0.12 --municipality='Platteville' --out=platteville.csv
rest platteville
# Mead, 40.1 mi
step pull-mead node build-walklist-co.mjs --county='WELD' --lat=40.233 --lon=-104.999 --radius=3 --min-acres=0.12 --municipality='Mead' --out=mead.csv
rest mead
# Keenesburg, 40.2 mi
step pull-keenesburg node build-walklist-co.mjs --county='WELD' --lat=40.108 --lon=-104.52 --radius=1.8 --min-acres=0.12 --municipality='Keenesburg' --out=keenesburg.csv
rest keenesburg
# Byers, 41.3 mi
step pull-byers node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7101 --lon=-104.219 --radius=2.31 --min-acres=0.12 --pieces=byers-cdp.json --out=byers.csv
rest byers
# Lyons, 42.2 mi
step pull-lyons node build-walklist-co.mjs --county='BOULDER' --lat=40.225 --lon=-105.271 --radius=1.5 --min-acres=0.12 --municipality='Lyons' --out=lyons.csv
rest lyons
step values node sample-value.mjs --only=bow-mar,columbine-valley,glendale,dove-valley,morrison,twin-lakes,foxfield,stonegate,sherrelwood,welby,roxborough-park,evergreen,the-pinery,watkins,perry-park,lochbuie,dacono,gunbarrel,frederick,bennett,fort-lupton,niwot,firestone,hudson,nederland,strasburg,platteville,mead,keenesburg,byers,lyons
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

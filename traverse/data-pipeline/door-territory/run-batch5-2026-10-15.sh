#!/bin/bash
# Batch 5 (2026-10-15 night, Matthew: "our focus right now should be a 45 mile radius around englewood"). Made by make-batch5.cjs.
# 46 places, closest to Englewood first, in passes: 1 door lists/lawns/lookups, 2 values + rebuild (ready.flag), 3 trees, 4 rebuild (done.flag).
# One job at a time against the state's parcel service. Uploading is by hand.
set -u
cd "$(dirname "$0")"
L=logs-batch5; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; }
echo "== pass 1: door lists, neighbourhoods, lawns, office lookup"
# Bow Mar, 3.7 mi
if [ -s bow-mar-areas.json ] && [ -s bow-mar.csv ]; then echo "$(date +%H:%M:%S) have  bow-mar"; else
  step pull-bow-mar-1 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.626 --lon=-105.051 --radius=1 --min-acres=0.12 --municipality='Bow Mar' --out=bow-mar-arapahoe.csv
  step pull-bow-mar-2 node build-walklist-co.mjs --county='JEFFERSON' --lat=39.626 --lon=-105.051 --radius=1 --min-acres=0.12 --municipality='Bow Mar' --out=bow-mar-jefferson.csv
  node merge-walklists.mjs bow-mar.csv $(ls bow-mar-arapahoe.csv bow-mar-jefferson.csv 2>/dev/null) > "$L/merge-bow-mar.log" 2>&1
  if [ -s bow-mar.csv ]; then step areas-bow-mar node build-walklist-pdf.mjs bow-mar.csv --no-pdf; step lawn-bow-mar bash -c "cd lawn-trial && node sample-lawn.mjs --town=bow-mar --conc=16"; step lookup-bow-mar node build-lookup.mjs bow-mar; else echo "$(date +%H:%M:%S) skip  bow-mar (no doors)"; fi
fi
# Columbine Valley, 4.2 mi
if [ -s columbine-valley-areas.json ] && [ -s columbine-valley.csv ]; then echo "$(date +%H:%M:%S) have  columbine-valley"; else
  step pull-columbine-valley node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.601 --lon=-105.033 --radius=1.2 --min-acres=0.12 --municipality='Columbine Valley' --out=columbine-valley.csv
  if [ -s columbine-valley.csv ]; then step areas-columbine-valley node build-walklist-pdf.mjs columbine-valley.csv --no-pdf; step lawn-columbine-valley bash -c "cd lawn-trial && node sample-lawn.mjs --town=columbine-valley --conc=16"; step lookup-columbine-valley node build-lookup.mjs columbine-valley; else echo "$(date +%H:%M:%S) skip  columbine-valley (no doors)"; fi
fi
# Glendale, 4.7 mi
if [ -s glendale-areas.json ] && [ -s glendale.csv ]; then echo "$(date +%H:%M:%S) have  glendale"; else
  step pull-glendale node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.705 --lon=-104.934 --radius=0.9 --min-acres=0.12 --municipality='Glendale' --out=glendale.csv
  if [ -s glendale.csv ]; then step areas-glendale node build-walklist-pdf.mjs glendale.csv --no-pdf; step lawn-glendale bash -c "cd lawn-trial && node sample-lawn.mjs --town=glendale --conc=16"; step lookup-glendale node build-lookup.mjs glendale; else echo "$(date +%H:%M:%S) skip  glendale (no doors)"; fi
fi
# Columbine, 6.3 mi
if [ -s columbine-areas.json ] && [ -s columbine.csv ]; then echo "$(date +%H:%M:%S) have  columbine"; else
  step pull-columbine node build-walklist-co.mjs --county='JEFFERSON' --lat=39.582 --lon=-105.0646 --radius=2.5 --min-acres=0.12 --pieces=columbine-cdp.json --out=columbine.csv
  if [ -s columbine.csv ]; then step areas-columbine node build-walklist-pdf.mjs columbine.csv --no-pdf; step lawn-columbine bash -c "cd lawn-trial && node sample-lawn.mjs --town=columbine --conc=16"; step lookup-columbine node build-lookup.mjs columbine; else echo "$(date +%H:%M:%S) skip  columbine (no doors)"; fi
fi
# Ken Caryl, 8.5 mi
if [ -s ken-caryl-areas.json ] && [ -s ken-caryl.csv ]; then echo "$(date +%H:%M:%S) have  ken-caryl"; else
  step pull-ken-caryl node build-walklist-co.mjs --county='JEFFERSON' --lat=39.5796 --lon=-105.1201 --radius=3 --min-acres=0.12 --pieces=ken-caryl-cdp.json --out=ken-caryl.csv
  if [ -s ken-caryl.csv ]; then step areas-ken-caryl node build-walklist-pdf.mjs ken-caryl.csv --no-pdf; step lawn-ken-caryl bash -c "cd lawn-trial && node sample-lawn.mjs --town=ken-caryl --conc=16"; step lookup-ken-caryl node build-lookup.mjs ken-caryl; else echo "$(date +%H:%M:%S) skip  ken-caryl (no doors)"; fi
fi
# Dove Valley, 10.4 mi
if [ -s dove-valley-areas.json ] && [ -s dove-valley.csv ]; then echo "$(date +%H:%M:%S) have  dove-valley"; else
  step pull-dove-valley node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.5804 --lon=-104.8214 --radius=2.2 --min-acres=0.12 --pieces=dove-valley-cdp.json --out=dove-valley.csv
  if [ -s dove-valley.csv ]; then step areas-dove-valley node build-walklist-pdf.mjs dove-valley.csv --no-pdf; step lawn-dove-valley bash -c "cd lawn-trial && node sample-lawn.mjs --town=dove-valley --conc=16"; step lookup-dove-valley node build-lookup.mjs dove-valley; else echo "$(date +%H:%M:%S) skip  dove-valley (no doors)"; fi
fi
# Morrison, 10.6 mi
if [ -s morrison-areas.json ] && [ -s morrison.csv ]; then echo "$(date +%H:%M:%S) have  morrison"; else
  step pull-morrison node build-walklist-co.mjs --county='JEFFERSON' --lat=39.654 --lon=-105.191 --radius=1.5 --min-acres=0.12 --municipality='Morrison' --out=morrison.csv
  if [ -s morrison.csv ]; then step areas-morrison node build-walklist-pdf.mjs morrison.csv --no-pdf; step lawn-morrison bash -c "cd lawn-trial && node sample-lawn.mjs --town=morrison --conc=16"; step lookup-morrison node build-lookup.mjs morrison; else echo "$(date +%H:%M:%S) skip  morrison (no doors)"; fi
fi
# Twin Lakes, 11.8 mi
if [ -s twin-lakes-areas.json ] && [ -s twin-lakes.csv ]; then echo "$(date +%H:%M:%S) have  twin-lakes"; else
  step pull-twin-lakes node build-walklist-co.mjs --county='ADAMS' --lat=39.8232 --lon=-105.0041 --radius=1.28 --min-acres=0.12 --pieces=twin-lakes-cdp.json --out=twin-lakes.csv
  if [ -s twin-lakes.csv ]; then step areas-twin-lakes node build-walklist-pdf.mjs twin-lakes.csv --no-pdf; step lawn-twin-lakes bash -c "cd lawn-trial && node sample-lawn.mjs --town=twin-lakes --conc=16"; step lookup-twin-lakes node build-lookup.mjs twin-lakes; else echo "$(date +%H:%M:%S) skip  twin-lakes (no doors)"; fi
fi
# Foxfield, 11.8 mi
if [ -s foxfield-areas.json ] && [ -s foxfield.csv ]; then echo "$(date +%H:%M:%S) have  foxfield"; else
  step pull-foxfield node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.588 --lon=-104.786 --radius=1.2 --min-acres=0.12 --municipality='Foxfield' --out=foxfield.csv
  if [ -s foxfield.csv ]; then step areas-foxfield node build-walklist-pdf.mjs foxfield.csv --no-pdf; step lawn-foxfield bash -c "cd lawn-trial && node sample-lawn.mjs --town=foxfield --conc=16"; step lookup-foxfield node build-lookup.mjs foxfield; else echo "$(date +%H:%M:%S) skip  foxfield (no doors)"; fi
fi
# Stonegate, 12.8 mi
if [ -s stonegate-areas.json ] && [ -s stonegate.csv ]; then echo "$(date +%H:%M:%S) have  stonegate"; else
  step pull-stonegate node build-walklist-co.mjs --county='DOUGLAS' --lat=39.5369 --lon=-104.8034 --radius=1.17 --min-acres=0.12 --pieces=stonegate-cdp.json --out=stonegate.csv
  if [ -s stonegate.csv ]; then step areas-stonegate node build-walklist-pdf.mjs stonegate.csv --no-pdf; step lawn-stonegate bash -c "cd lawn-trial && node sample-lawn.mjs --town=stonegate --conc=16"; step lookup-stonegate node build-lookup.mjs stonegate; else echo "$(date +%H:%M:%S) skip  stonegate (no doors)"; fi
fi
# Sherrelwood, 12.9 mi
if [ -s sherrelwood-areas.json ] && [ -s sherrelwood.csv ]; then echo "$(date +%H:%M:%S) have  sherrelwood"; else
  step pull-sherrelwood node build-walklist-co.mjs --county='ADAMS' --lat=39.8393 --lon=-105.004 --radius=1.27 --min-acres=0.12 --pieces=sherrelwood-cdp.json --out=sherrelwood.csv
  if [ -s sherrelwood.csv ]; then step areas-sherrelwood node build-walklist-pdf.mjs sherrelwood.csv --no-pdf; step lawn-sherrelwood bash -c "cd lawn-trial && node sample-lawn.mjs --town=sherrelwood --conc=16"; step lookup-sherrelwood node build-lookup.mjs sherrelwood; else echo "$(date +%H:%M:%S) skip  sherrelwood (no doors)"; fi
fi
# Welby, 12.9 mi
if [ -s welby-areas.json ] && [ -s welby.csv ]; then echo "$(date +%H:%M:%S) have  welby"; else
  step pull-welby node build-walklist-co.mjs --county='ADAMS' --lat=39.8386 --lon=-104.9634 --radius=1.4 --min-acres=0.12 --pieces=welby-cdp.json --out=welby.csv
  if [ -s welby.csv ]; then step areas-welby node build-walklist-pdf.mjs welby.csv --no-pdf; step lawn-welby bash -c "cd lawn-trial && node sample-lawn.mjs --town=welby --conc=16"; step lookup-welby node build-lookup.mjs welby; else echo "$(date +%H:%M:%S) skip  welby (no doors)"; fi
fi
# Federal Heights, 14.7 mi
if [ -s federal-heights-areas.json ] && [ -s federal-heights.csv ]; then echo "$(date +%H:%M:%S) have  federal-heights"; else
  step pull-federal-heights node build-walklist-co.mjs --county='ADAMS' --lat=39.865 --lon=-105.015 --radius=2 --min-acres=0.12 --municipality='Federal Heights' --out=federal-heights.csv
  if [ -s federal-heights.csv ]; then step areas-federal-heights node build-walklist-pdf.mjs federal-heights.csv --no-pdf; step lawn-federal-heights bash -c "cd lawn-trial && node sample-lawn.mjs --town=federal-heights --conc=16"; step lookup-federal-heights node build-lookup.mjs federal-heights; else echo "$(date +%H:%M:%S) skip  federal-heights (no doors)"; fi
fi
# Roxborough Park, 14.7 mi
if [ -s roxborough-park-areas.json ] && [ -s roxborough-park.csv ]; then echo "$(date +%H:%M:%S) have  roxborough-park"; else
  step pull-roxborough-park node build-walklist-co.mjs --county='DOUGLAS' --lat=39.4502 --lon=-105.0728 --radius=2.97 --min-acres=0.12 --pieces=roxborough-park-cdp.json --out=roxborough-park.csv
  if [ -s roxborough-park.csv ]; then step areas-roxborough-park node build-walklist-pdf.mjs roxborough-park.csv --no-pdf; step lawn-roxborough-park bash -c "cd lawn-trial && node sample-lawn.mjs --town=roxborough-park --conc=16"; step lookup-roxborough-park node build-lookup.mjs roxborough-park; else echo "$(date +%H:%M:%S) skip  roxborough-park (no doors)"; fi
fi
# Northglenn, 17.1 mi
if [ -s northglenn-areas.json ] && [ -s northglenn.csv ]; then echo "$(date +%H:%M:%S) have  northglenn"; else
  step pull-northglenn node build-walklist-co.mjs --county='ADAMS' --lat=39.9 --lon=-104.98 --radius=3 --min-acres=0.12 --municipality='Northglenn' --out=northglenn.csv
  if [ -s northglenn.csv ]; then step areas-northglenn node build-walklist-pdf.mjs northglenn.csv --no-pdf; step lawn-northglenn bash -c "cd lawn-trial && node sample-lawn.mjs --town=northglenn --conc=16"; step lookup-northglenn node build-lookup.mjs northglenn; else echo "$(date +%H:%M:%S) skip  northglenn (no doors)"; fi
fi
# Evergreen, 18.0 mi
if [ -s evergreen-areas.json ] && [ -s evergreen.csv ]; then echo "$(date +%H:%M:%S) have  evergreen"; else
  step pull-evergreen-1 node build-walklist-co.mjs --county='JEFFERSON' --lat=39.6363 --lon=-105.3289 --radius=3.76 --min-acres=0.12 --pieces=evergreen-cdp.json --out=evergreen-jefferson.csv
  step pull-evergreen-2 node build-walklist-co.mjs --county='CLEAR CREEK' --lat=39.6363 --lon=-105.3289 --radius=3.76 --min-acres=0.12 --pieces=evergreen-cdp.json --out=evergreen-clear-creek.csv
  node merge-walklists.mjs evergreen.csv $(ls evergreen-jefferson.csv evergreen-clear-creek.csv 2>/dev/null) > "$L/merge-evergreen.log" 2>&1
  if [ -s evergreen.csv ]; then step areas-evergreen node build-walklist-pdf.mjs evergreen.csv --no-pdf; step lawn-evergreen bash -c "cd lawn-trial && node sample-lawn.mjs --town=evergreen --conc=16"; step lookup-evergreen node build-lookup.mjs evergreen; else echo "$(date +%H:%M:%S) skip  evergreen (no doors)"; fi
fi
# The Pinery, 18.8 mi
if [ -s the-pinery-areas.json ] && [ -s the-pinery.csv ]; then echo "$(date +%H:%M:%S) have  the-pinery"; else
  step pull-the-pinery node build-walklist-co.mjs --county='DOUGLAS' --lat=39.4491 --lon=-104.7576 --radius=3.81 --min-acres=0.12 --pieces=the-pinery-cdp.json --out=the-pinery.csv
  if [ -s the-pinery.csv ]; then step areas-the-pinery node build-walklist-pdf.mjs the-pinery.csv --no-pdf; step lawn-the-pinery bash -c "cd lawn-trial && node sample-lawn.mjs --town=the-pinery --conc=16"; step lookup-the-pinery node build-lookup.mjs the-pinery; else echo "$(date +%H:%M:%S) skip  the-pinery (no doors)"; fi
fi
# Broomfield, 20.1 mi
if [ -s broomfield-areas.json ] && [ -s broomfield.csv ]; then echo "$(date +%H:%M:%S) have  broomfield"; else
  step pull-broomfield node build-walklist-co.mjs --county='BROOMFIELD' --lat=39.94 --lon=-105.06 --radius=6 --min-acres=0.12 --municipality='Broomfield' --out=broomfield.csv
  if [ -s broomfield.csv ]; then step areas-broomfield node build-walklist-pdf.mjs broomfield.csv --no-pdf; step lawn-broomfield bash -c "cd lawn-trial && node sample-lawn.mjs --town=broomfield --conc=16"; step lookup-broomfield node build-lookup.mjs broomfield; else echo "$(date +%H:%M:%S) skip  broomfield (no doors)"; fi
fi
# Superior, 21.1 mi
if [ -s superior-areas.json ] && [ -s superior.csv ]; then echo "$(date +%H:%M:%S) have  superior"; else
  step pull-superior node build-walklist-co.mjs --county='BOULDER' --lat=39.93 --lon=-105.16 --radius=2 --min-acres=0.12 --municipality='Superior' --out=superior.csv
  if [ -s superior.csv ]; then step areas-superior node build-walklist-pdf.mjs superior.csv --no-pdf; step lawn-superior bash -c "cd lawn-trial && node sample-lawn.mjs --town=superior --conc=16"; step lookup-superior node build-lookup.mjs superior; else echo "$(date +%H:%M:%S) skip  superior (no doors)"; fi
fi
# Watkins, 22.4 mi
if [ -s watkins-areas.json ] && [ -s watkins.csv ]; then echo "$(date +%H:%M:%S) have  watkins"; else
  step pull-watkins-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.6958 --lon=-104.5745 --radius=4.62 --min-acres=0.12 --pieces=watkins-cdp.json --out=watkins-adams.csv
  step pull-watkins-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.6958 --lon=-104.5745 --radius=4.62 --min-acres=0.12 --pieces=watkins-cdp.json --out=watkins-arapahoe.csv
  node merge-walklists.mjs watkins.csv $(ls watkins-adams.csv watkins-arapahoe.csv 2>/dev/null) > "$L/merge-watkins.log" 2>&1
  if [ -s watkins.csv ]; then step areas-watkins node build-walklist-pdf.mjs watkins.csv --no-pdf; step lawn-watkins bash -c "cd lawn-trial && node sample-lawn.mjs --town=watkins --conc=16"; step lookup-watkins node build-lookup.mjs watkins; else echo "$(date +%H:%M:%S) skip  watkins (no doors)"; fi
fi
# Louisville, 23.6 mi
if [ -s louisville-areas.json ] && [ -s louisville.csv ]; then echo "$(date +%H:%M:%S) have  louisville"; else
  step pull-louisville node build-walklist-co.mjs --county='BOULDER' --lat=39.975 --lon=-105.14 --radius=3 --min-acres=0.12 --municipality='Louisville' --out=louisville.csv
  if [ -s louisville.csv ]; then step areas-louisville node build-walklist-pdf.mjs louisville.csv --no-pdf; step lawn-louisville bash -c "cd lawn-trial && node sample-lawn.mjs --town=louisville --conc=16"; step lookup-louisville node build-lookup.mjs louisville; else echo "$(date +%H:%M:%S) skip  louisville (no doors)"; fi
fi
# Brighton, 24.1 mi
if [ -s brighton-areas.json ] && [ -s brighton.csv ]; then echo "$(date +%H:%M:%S) have  brighton"; else
  step pull-brighton-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.97 --lon=-104.8 --radius=5 --min-acres=0.12 --municipality='Brighton' --out=brighton-adams.csv
  step pull-brighton-2 node build-walklist-co.mjs --county='WELD' --lat=40.02 --lon=-104.8 --radius=3 --min-acres=0.12 --municipality='Brighton' --out=brighton-weld.csv
  node merge-walklists.mjs brighton.csv $(ls brighton-adams.csv brighton-weld.csv 2>/dev/null) > "$L/merge-brighton.log" 2>&1
  if [ -s brighton.csv ]; then step areas-brighton node build-walklist-pdf.mjs brighton.csv --no-pdf; step lawn-brighton bash -c "cd lawn-trial && node sample-lawn.mjs --town=brighton --conc=16"; step lookup-brighton node build-lookup.mjs brighton; else echo "$(date +%H:%M:%S) skip  brighton (no doors)"; fi
fi
# Lafayette, 24.3 mi
if [ -s lafayette-areas.json ] && [ -s lafayette.csv ]; then echo "$(date +%H:%M:%S) have  lafayette"; else
  step pull-lafayette node build-walklist-co.mjs --county='BOULDER' --lat=39.995 --lon=-105.1 --radius=3 --min-acres=0.12 --municipality='Lafayette' --out=lafayette.csv
  if [ -s lafayette.csv ]; then step areas-lafayette node build-walklist-pdf.mjs lafayette.csv --no-pdf; step lawn-lafayette bash -c "cd lawn-trial && node sample-lawn.mjs --town=lafayette --conc=16"; step lookup-lafayette node build-lookup.mjs lafayette; else echo "$(date +%H:%M:%S) skip  lafayette (no doors)"; fi
fi
# Perry Park, 27.2 mi
if [ -s perry-park-areas.json ] && [ -s perry-park.csv ]; then echo "$(date +%H:%M:%S) have  perry-park"; else
  step pull-perry-park node build-walklist-co.mjs --county='DOUGLAS' --lat=39.2592 --lon=-104.9855 --radius=2.5 --min-acres=0.12 --pieces=perry-park-cdp.json --out=perry-park.csv
  if [ -s perry-park.csv ]; then step areas-perry-park node build-walklist-pdf.mjs perry-park.csv --no-pdf; step lawn-perry-park bash -c "cd lawn-trial && node sample-lawn.mjs --town=perry-park --conc=16"; step lookup-perry-park node build-lookup.mjs perry-park; else echo "$(date +%H:%M:%S) skip  perry-park (no doors)"; fi
fi
# Idaho Springs, 28.5 mi
if [ -s idaho-springs-areas.json ] && [ -s idaho-springs.csv ]; then echo "$(date +%H:%M:%S) have  idaho-springs"; else
  step pull-idaho-springs node build-walklist-co.mjs --county='CLEAR CREEK' --lat=39.743 --lon=-105.514 --radius=1.8 --min-acres=0.12 --municipality='Idaho Springs' --out=idaho-springs.csv
  if [ -s idaho-springs.csv ]; then step areas-idaho-springs node build-walklist-pdf.mjs idaho-springs.csv --no-pdf; step lawn-idaho-springs bash -c "cd lawn-trial && node sample-lawn.mjs --town=idaho-springs --conc=16"; step lookup-idaho-springs node build-lookup.mjs idaho-springs; else echo "$(date +%H:%M:%S) skip  idaho-springs (no doors)"; fi
fi
# Lochbuie, 28.5 mi
if [ -s lochbuie-areas.json ] && [ -s lochbuie.csv ]; then echo "$(date +%H:%M:%S) have  lochbuie"; else
  step pull-lochbuie-1 node build-walklist-co.mjs --county='WELD' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0.12 --municipality='Lochbuie' --out=lochbuie-weld.csv
  step pull-lochbuie-2 node build-walklist-co.mjs --county='ADAMS' --lat=40.007 --lon=-104.716 --radius=2 --min-acres=0.12 --municipality='Lochbuie' --out=lochbuie-adams.csv
  node merge-walklists.mjs lochbuie.csv $(ls lochbuie-weld.csv lochbuie-adams.csv 2>/dev/null) > "$L/merge-lochbuie.log" 2>&1
  if [ -s lochbuie.csv ]; then step areas-lochbuie node build-walklist-pdf.mjs lochbuie.csv --no-pdf; step lawn-lochbuie bash -c "cd lawn-trial && node sample-lawn.mjs --town=lochbuie --conc=16"; step lookup-lochbuie node build-lookup.mjs lochbuie; else echo "$(date +%H:%M:%S) skip  lochbuie (no doors)"; fi
fi
# Black Hawk, 28.5 mi
if [ -s black-hawk-areas.json ] && [ -s black-hawk.csv ]; then echo "$(date +%H:%M:%S) have  black-hawk"; else
  step pull-black-hawk node build-walklist-co.mjs --county='GILPIN' --lat=39.797 --lon=-105.494 --radius=1.5 --min-acres=0.12 --municipality='Black Hawk' --out=black-hawk.csv
  if [ -s black-hawk.csv ]; then step areas-black-hawk node build-walklist-pdf.mjs black-hawk.csv --no-pdf; step lawn-black-hawk bash -c "cd lawn-trial && node sample-lawn.mjs --town=black-hawk --conc=16"; step lookup-black-hawk node build-lookup.mjs black-hawk; else echo "$(date +%H:%M:%S) skip  black-hawk (no doors)"; fi
fi
# Elizabeth, 29.2 mi
if [ -s elizabeth-areas.json ] && [ -s elizabeth.csv ]; then echo "$(date +%H:%M:%S) have  elizabeth"; else
  step pull-elizabeth node build-walklist-co.mjs --county='ELBERT' --lat=39.36 --lon=-104.597 --radius=2 --min-acres=0.12 --municipality='Elizabeth' --out=elizabeth.csv
  if [ -s elizabeth.csv ]; then step areas-elizabeth node build-walklist-pdf.mjs elizabeth.csv --no-pdf; step lawn-elizabeth bash -c "cd lawn-trial && node sample-lawn.mjs --town=elizabeth --conc=16"; step lookup-elizabeth node build-lookup.mjs elizabeth; else echo "$(date +%H:%M:%S) skip  elizabeth (no doors)"; fi
fi
# Central City, 29.6 mi
if [ -s central-city-areas.json ] && [ -s central-city.csv ]; then echo "$(date +%H:%M:%S) have  central-city"; else
  step pull-central-city node build-walklist-co.mjs --county='GILPIN' --lat=39.802 --lon=-105.514 --radius=2 --min-acres=0.12 --municipality='Central City' --out=central-city.csv
  if [ -s central-city.csv ]; then step areas-central-city node build-walklist-pdf.mjs central-city.csv --no-pdf; step lawn-central-city bash -c "cd lawn-trial && node sample-lawn.mjs --town=central-city --conc=16"; step lookup-central-city node build-lookup.mjs central-city; else echo "$(date +%H:%M:%S) skip  central-city (no doors)"; fi
fi
# Dacono, 30.0 mi
if [ -s dacono-areas.json ] && [ -s dacono.csv ]; then echo "$(date +%H:%M:%S) have  dacono"; else
  step pull-dacono node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.94 --radius=2.5 --min-acres=0.12 --municipality='Dacono' --out=dacono.csv
  if [ -s dacono.csv ]; then step areas-dacono node build-walklist-pdf.mjs dacono.csv --no-pdf; step lawn-dacono bash -c "cd lawn-trial && node sample-lawn.mjs --town=dacono --conc=16"; step lookup-dacono node build-lookup.mjs dacono; else echo "$(date +%H:%M:%S) skip  dacono (no doors)"; fi
fi
# Gunbarrel, 30.4 mi
if [ -s gunbarrel-areas.json ] && [ -s gunbarrel.csv ]; then echo "$(date +%H:%M:%S) have  gunbarrel"; else
  step pull-gunbarrel node build-walklist-co.mjs --county='BOULDER' --lat=40.069 --lon=-105.1784 --radius=2.86 --min-acres=0.12 --pieces=gunbarrel-cdp.json --out=gunbarrel.csv
  if [ -s gunbarrel.csv ]; then step areas-gunbarrel node build-walklist-pdf.mjs gunbarrel.csv --no-pdf; step lawn-gunbarrel bash -c "cd lawn-trial && node sample-lawn.mjs --town=gunbarrel --conc=16"; step lookup-gunbarrel node build-lookup.mjs gunbarrel; else echo "$(date +%H:%M:%S) skip  gunbarrel (no doors)"; fi
fi
# Frederick, 30.9 mi
if [ -s frederick-areas.json ] && [ -s frederick.csv ]; then echo "$(date +%H:%M:%S) have  frederick"; else
  step pull-frederick node build-walklist-co.mjs --county='WELD' --lat=40.099 --lon=-104.95 --radius=3 --min-acres=0.12 --municipality='Frederick' --out=frederick.csv
  if [ -s frederick.csv ]; then step areas-frederick node build-walklist-pdf.mjs frederick.csv --no-pdf; step lawn-frederick bash -c "cd lawn-trial && node sample-lawn.mjs --town=frederick --conc=16"; step lookup-frederick node build-lookup.mjs frederick; else echo "$(date +%H:%M:%S) skip  frederick (no doors)"; fi
fi
# Bennett, 30.9 mi
if [ -s bennett-areas.json ] && [ -s bennett.csv ]; then echo "$(date +%H:%M:%S) have  bennett"; else
  step pull-bennett-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0.12 --municipality='Bennett' --out=bennett-adams.csv
  step pull-bennett-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.759 --lon=-104.427 --radius=2.5 --min-acres=0.12 --municipality='Bennett' --out=bennett-arapahoe.csv
  node merge-walklists.mjs bennett.csv $(ls bennett-adams.csv bennett-arapahoe.csv 2>/dev/null) > "$L/merge-bennett.log" 2>&1
  if [ -s bennett.csv ]; then step areas-bennett node build-walklist-pdf.mjs bennett.csv --no-pdf; step lawn-bennett bash -c "cd lawn-trial && node sample-lawn.mjs --town=bennett --conc=16"; step lookup-bennett node build-lookup.mjs bennett; else echo "$(date +%H:%M:%S) skip  bennett (no doors)"; fi
fi
# Fort Lupton, 31.3 mi
if [ -s fort-lupton-areas.json ] && [ -s fort-lupton.csv ]; then echo "$(date +%H:%M:%S) have  fort-lupton"; else
  step pull-fort-lupton node build-walklist-co.mjs --county='WELD' --lat=40.085 --lon=-104.813 --radius=3 --min-acres=0.12 --municipality='Fort Lupton' --out=fort-lupton.csv
  if [ -s fort-lupton.csv ]; then step areas-fort-lupton node build-walklist-pdf.mjs fort-lupton.csv --no-pdf; step lawn-fort-lupton bash -c "cd lawn-trial && node sample-lawn.mjs --town=fort-lupton --conc=16"; step lookup-fort-lupton node build-lookup.mjs fort-lupton; else echo "$(date +%H:%M:%S) skip  fort-lupton (no doors)"; fi
fi
# Niwot, 32.2 mi
if [ -s niwot-areas.json ] && [ -s niwot.csv ]; then echo "$(date +%H:%M:%S) have  niwot"; else
  step pull-niwot node build-walklist-co.mjs --county='BOULDER' --lat=40.1017 --lon=-105.1595 --radius=1.73 --min-acres=0.12 --pieces=niwot-cdp.json --out=niwot.csv
  if [ -s niwot.csv ]; then step areas-niwot node build-walklist-pdf.mjs niwot.csv --no-pdf; step lawn-niwot bash -c "cd lawn-trial && node sample-lawn.mjs --town=niwot --conc=16"; step lookup-niwot node build-lookup.mjs niwot; else echo "$(date +%H:%M:%S) skip  niwot (no doors)"; fi
fi
# Firestone, 33.1 mi
if [ -s firestone-areas.json ] && [ -s firestone.csv ]; then echo "$(date +%H:%M:%S) have  firestone"; else
  step pull-firestone node build-walklist-co.mjs --county='WELD' --lat=40.13 --lon=-104.94 --radius=3.5 --min-acres=0.12 --municipality='Firestone' --out=firestone.csv
  if [ -s firestone.csv ]; then step areas-firestone node build-walklist-pdf.mjs firestone.csv --no-pdf; step lawn-firestone bash -c "cd lawn-trial && node sample-lawn.mjs --town=firestone --conc=16"; step lookup-firestone node build-lookup.mjs firestone; else echo "$(date +%H:%M:%S) skip  firestone (no doors)"; fi
fi
# Hudson, 34.4 mi
if [ -s hudson-areas.json ] && [ -s hudson.csv ]; then echo "$(date +%H:%M:%S) have  hudson"; else
  step pull-hudson node build-walklist-co.mjs --county='WELD' --lat=40.074 --lon=-104.643 --radius=2 --min-acres=0.12 --municipality='Hudson' --out=hudson.csv
  if [ -s hudson.csv ]; then step areas-hudson node build-walklist-pdf.mjs hudson.csv --no-pdf; step lawn-hudson bash -c "cd lawn-trial && node sample-lawn.mjs --town=hudson --conc=16"; step lookup-hudson node build-lookup.mjs hudson; else echo "$(date +%H:%M:%S) skip  hudson (no doors)"; fi
fi
# Nederland, 34.8 mi
if [ -s nederland-areas.json ] && [ -s nederland.csv ]; then echo "$(date +%H:%M:%S) have  nederland"; else
  step pull-nederland node build-walklist-co.mjs --county='BOULDER' --lat=39.961 --lon=-105.511 --radius=1.5 --min-acres=0.12 --municipality='Nederland' --out=nederland.csv
  if [ -s nederland.csv ]; then step areas-nederland node build-walklist-pdf.mjs nederland.csv --no-pdf; step lawn-nederland bash -c "cd lawn-trial && node sample-lawn.mjs --town=nederland --conc=16"; step lookup-nederland node build-lookup.mjs nederland; else echo "$(date +%H:%M:%S) skip  nederland (no doors)"; fi
fi
# Kiowa, 35.2 mi
if [ -s kiowa-areas.json ] && [ -s kiowa.csv ]; then echo "$(date +%H:%M:%S) have  kiowa"; else
  step pull-kiowa node build-walklist-co.mjs --county='ELBERT' --lat=39.347 --lon=-104.464 --radius=1.2 --min-acres=0.12 --municipality='Kiowa' --out=kiowa.csv
  if [ -s kiowa.csv ]; then step areas-kiowa node build-walklist-pdf.mjs kiowa.csv --no-pdf; step lawn-kiowa bash -c "cd lawn-trial && node sample-lawn.mjs --town=kiowa --conc=16"; step lookup-kiowa node build-lookup.mjs kiowa; else echo "$(date +%H:%M:%S) skip  kiowa (no doors)"; fi
fi
# Longmont, 36.2 mi
if [ -s longmont-areas.json ] && [ -s longmont.csv ]; then echo "$(date +%H:%M:%S) have  longmont"; else
  step pull-longmont-1 node build-walklist-co.mjs --county='BOULDER' --lat=40.17 --lon=-105.11 --radius=6 --min-acres=0.12 --municipality='Longmont' --out=longmont-boulder.csv
  step pull-longmont-2 node build-walklist-co.mjs --county='WELD' --lat=40.17 --lon=-105.03 --radius=3 --min-acres=0.12 --municipality='Longmont' --out=longmont-weld.csv
  node merge-walklists.mjs longmont.csv $(ls longmont-boulder.csv longmont-weld.csv 2>/dev/null) > "$L/merge-longmont.log" 2>&1
  if [ -s longmont.csv ]; then step areas-longmont node build-walklist-pdf.mjs longmont.csv --no-pdf; step lawn-longmont bash -c "cd lawn-trial && node sample-lawn.mjs --town=longmont --conc=16"; step lookup-longmont node build-lookup.mjs longmont; else echo "$(date +%H:%M:%S) skip  longmont (no doors)"; fi
fi
# Strasburg, 36.4 mi
if [ -s strasburg-areas.json ] && [ -s strasburg.csv ]; then echo "$(date +%H:%M:%S) have  strasburg"; else
  step pull-strasburg-1 node build-walklist-co.mjs --county='ADAMS' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0.12 --pieces=strasburg-cdp.json --out=strasburg-adams.csv
  step pull-strasburg-2 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7168 --lon=-104.3121 --radius=3.98 --min-acres=0.12 --pieces=strasburg-cdp.json --out=strasburg-arapahoe.csv
  node merge-walklists.mjs strasburg.csv $(ls strasburg-adams.csv strasburg-arapahoe.csv 2>/dev/null) > "$L/merge-strasburg.log" 2>&1
  if [ -s strasburg.csv ]; then step areas-strasburg node build-walklist-pdf.mjs strasburg.csv --no-pdf; step lawn-strasburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=strasburg --conc=16"; step lookup-strasburg node build-lookup.mjs strasburg; else echo "$(date +%H:%M:%S) skip  strasburg (no doors)"; fi
fi
# Platteville, 39.8 mi
if [ -s platteville-areas.json ] && [ -s platteville.csv ]; then echo "$(date +%H:%M:%S) have  platteville"; else
  step pull-platteville node build-walklist-co.mjs --county='WELD' --lat=40.215 --lon=-104.823 --radius=1.8 --min-acres=0.12 --municipality='Platteville' --out=platteville.csv
  if [ -s platteville.csv ]; then step areas-platteville node build-walklist-pdf.mjs platteville.csv --no-pdf; step lawn-platteville bash -c "cd lawn-trial && node sample-lawn.mjs --town=platteville --conc=16"; step lookup-platteville node build-lookup.mjs platteville; else echo "$(date +%H:%M:%S) skip  platteville (no doors)"; fi
fi
# Mead, 40.1 mi
if [ -s mead-areas.json ] && [ -s mead.csv ]; then echo "$(date +%H:%M:%S) have  mead"; else
  step pull-mead node build-walklist-co.mjs --county='WELD' --lat=40.233 --lon=-104.999 --radius=3 --min-acres=0.12 --municipality='Mead' --out=mead.csv
  if [ -s mead.csv ]; then step areas-mead node build-walklist-pdf.mjs mead.csv --no-pdf; step lawn-mead bash -c "cd lawn-trial && node sample-lawn.mjs --town=mead --conc=16"; step lookup-mead node build-lookup.mjs mead; else echo "$(date +%H:%M:%S) skip  mead (no doors)"; fi
fi
# Keenesburg, 40.2 mi
if [ -s keenesburg-areas.json ] && [ -s keenesburg.csv ]; then echo "$(date +%H:%M:%S) have  keenesburg"; else
  step pull-keenesburg node build-walklist-co.mjs --county='WELD' --lat=40.108 --lon=-104.52 --radius=1.8 --min-acres=0.12 --municipality='Keenesburg' --out=keenesburg.csv
  if [ -s keenesburg.csv ]; then step areas-keenesburg node build-walklist-pdf.mjs keenesburg.csv --no-pdf; step lawn-keenesburg bash -c "cd lawn-trial && node sample-lawn.mjs --town=keenesburg --conc=16"; step lookup-keenesburg node build-lookup.mjs keenesburg; else echo "$(date +%H:%M:%S) skip  keenesburg (no doors)"; fi
fi
# Byers, 41.3 mi
if [ -s byers-areas.json ] && [ -s byers.csv ]; then echo "$(date +%H:%M:%S) have  byers"; else
  step pull-byers node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.7101 --lon=-104.219 --radius=2.31 --min-acres=0.12 --pieces=byers-cdp.json --out=byers.csv
  if [ -s byers.csv ]; then step areas-byers node build-walklist-pdf.mjs byers.csv --no-pdf; step lawn-byers bash -c "cd lawn-trial && node sample-lawn.mjs --town=byers --conc=16"; step lookup-byers node build-lookup.mjs byers; else echo "$(date +%H:%M:%S) skip  byers (no doors)"; fi
fi
# Lyons, 42.2 mi
if [ -s lyons-areas.json ] && [ -s lyons.csv ]; then echo "$(date +%H:%M:%S) have  lyons"; else
  step pull-lyons node build-walklist-co.mjs --county='BOULDER' --lat=40.225 --lon=-105.271 --radius=1.5 --min-acres=0.12 --municipality='Lyons' --out=lyons.csv
  if [ -s lyons.csv ]; then step areas-lyons node build-walklist-pdf.mjs lyons.csv --no-pdf; step lawn-lyons bash -c "cd lawn-trial && node sample-lawn.mjs --town=lyons --conc=16"; step lookup-lyons node build-lookup.mjs lyons; else echo "$(date +%H:%M:%S) skip  lyons (no doors)"; fi
fi
echo "== pass 2: county values, rebuild"
step values node sample-value.mjs --only=bow-mar,columbine-valley,glendale,columbine,ken-caryl,dove-valley,morrison,twin-lakes,foxfield,stonegate,sherrelwood,welby,federal-heights,roxborough-park,northglenn,evergreen,the-pinery,superior,watkins,louisville,brighton,lafayette,perry-park,lochbuie,dacono,gunbarrel,frederick,bennett,fort-lupton,niwot,firestone,hudson,nederland,longmont,strasburg,platteville,mead,keenesburg,byers,lyons
step rounds1 node build-rounds-data.mjs
touch "$L/ready.flag"
echo "== pass 3: trees, closest first, then the rest of Boulder"
[ -s bow-mar-areas.json ] && step trees-bow-mar bash -c "cd tree-zones && node sample-trees.mjs --town=bow-mar --conc=6"
[ -s columbine-valley-areas.json ] && step trees-columbine-valley bash -c "cd tree-zones && node sample-trees.mjs --town=columbine-valley --conc=6"
[ -s glendale-areas.json ] && step trees-glendale bash -c "cd tree-zones && node sample-trees.mjs --town=glendale --conc=6"
[ -s columbine-areas.json ] && step trees-columbine bash -c "cd tree-zones && node sample-trees.mjs --town=columbine --conc=6"
[ -s ken-caryl-areas.json ] && step trees-ken-caryl bash -c "cd tree-zones && node sample-trees.mjs --town=ken-caryl --conc=6"
[ -s dove-valley-areas.json ] && step trees-dove-valley bash -c "cd tree-zones && node sample-trees.mjs --town=dove-valley --conc=6"
[ -s morrison-areas.json ] && step trees-morrison bash -c "cd tree-zones && node sample-trees.mjs --town=morrison --conc=6"
[ -s twin-lakes-areas.json ] && step trees-twin-lakes bash -c "cd tree-zones && node sample-trees.mjs --town=twin-lakes --conc=6"
[ -s foxfield-areas.json ] && step trees-foxfield bash -c "cd tree-zones && node sample-trees.mjs --town=foxfield --conc=6"
[ -s stonegate-areas.json ] && step trees-stonegate bash -c "cd tree-zones && node sample-trees.mjs --town=stonegate --conc=6"
[ -s sherrelwood-areas.json ] && step trees-sherrelwood bash -c "cd tree-zones && node sample-trees.mjs --town=sherrelwood --conc=6"
[ -s welby-areas.json ] && step trees-welby bash -c "cd tree-zones && node sample-trees.mjs --town=welby --conc=6"
[ -s federal-heights-areas.json ] && step trees-federal-heights bash -c "cd tree-zones && node sample-trees.mjs --town=federal-heights --conc=6"
[ -s roxborough-park-areas.json ] && step trees-roxborough-park bash -c "cd tree-zones && node sample-trees.mjs --town=roxborough-park --conc=6"
[ -s northglenn-areas.json ] && step trees-northglenn bash -c "cd tree-zones && node sample-trees.mjs --town=northglenn --conc=6"
[ -s evergreen-areas.json ] && step trees-evergreen bash -c "cd tree-zones && node sample-trees.mjs --town=evergreen --conc=6"
[ -s the-pinery-areas.json ] && step trees-the-pinery bash -c "cd tree-zones && node sample-trees.mjs --town=the-pinery --conc=6"
[ -s broomfield-areas.json ] && step trees-broomfield bash -c "cd tree-zones && node sample-trees.mjs --town=broomfield --conc=6"
[ -s superior-areas.json ] && step trees-superior bash -c "cd tree-zones && node sample-trees.mjs --town=superior --conc=6"
[ -s watkins-areas.json ] && step trees-watkins bash -c "cd tree-zones && node sample-trees.mjs --town=watkins --conc=6"
[ -s louisville-areas.json ] && step trees-louisville bash -c "cd tree-zones && node sample-trees.mjs --town=louisville --conc=6"
[ -s brighton-areas.json ] && step trees-brighton bash -c "cd tree-zones && node sample-trees.mjs --town=brighton --conc=6"
[ -s lafayette-areas.json ] && step trees-lafayette bash -c "cd tree-zones && node sample-trees.mjs --town=lafayette --conc=6"
[ -s perry-park-areas.json ] && step trees-perry-park bash -c "cd tree-zones && node sample-trees.mjs --town=perry-park --conc=6"
[ -s idaho-springs-areas.json ] && step trees-idaho-springs bash -c "cd tree-zones && node sample-trees.mjs --town=idaho-springs --conc=6"
[ -s lochbuie-areas.json ] && step trees-lochbuie bash -c "cd tree-zones && node sample-trees.mjs --town=lochbuie --conc=6"
[ -s black-hawk-areas.json ] && step trees-black-hawk bash -c "cd tree-zones && node sample-trees.mjs --town=black-hawk --conc=6"
[ -s elizabeth-areas.json ] && step trees-elizabeth bash -c "cd tree-zones && node sample-trees.mjs --town=elizabeth --conc=6"
[ -s central-city-areas.json ] && step trees-central-city bash -c "cd tree-zones && node sample-trees.mjs --town=central-city --conc=6"
[ -s dacono-areas.json ] && step trees-dacono bash -c "cd tree-zones && node sample-trees.mjs --town=dacono --conc=6"
[ -s gunbarrel-areas.json ] && step trees-gunbarrel bash -c "cd tree-zones && node sample-trees.mjs --town=gunbarrel --conc=6"
[ -s frederick-areas.json ] && step trees-frederick bash -c "cd tree-zones && node sample-trees.mjs --town=frederick --conc=6"
[ -s bennett-areas.json ] && step trees-bennett bash -c "cd tree-zones && node sample-trees.mjs --town=bennett --conc=6"
[ -s fort-lupton-areas.json ] && step trees-fort-lupton bash -c "cd tree-zones && node sample-trees.mjs --town=fort-lupton --conc=6"
[ -s niwot-areas.json ] && step trees-niwot bash -c "cd tree-zones && node sample-trees.mjs --town=niwot --conc=6"
[ -s firestone-areas.json ] && step trees-firestone bash -c "cd tree-zones && node sample-trees.mjs --town=firestone --conc=6"
[ -s hudson-areas.json ] && step trees-hudson bash -c "cd tree-zones && node sample-trees.mjs --town=hudson --conc=6"
[ -s nederland-areas.json ] && step trees-nederland bash -c "cd tree-zones && node sample-trees.mjs --town=nederland --conc=6"
[ -s kiowa-areas.json ] && step trees-kiowa bash -c "cd tree-zones && node sample-trees.mjs --town=kiowa --conc=6"
[ -s longmont-areas.json ] && step trees-longmont bash -c "cd tree-zones && node sample-trees.mjs --town=longmont --conc=6"
[ -s strasburg-areas.json ] && step trees-strasburg bash -c "cd tree-zones && node sample-trees.mjs --town=strasburg --conc=6"
[ -s platteville-areas.json ] && step trees-platteville bash -c "cd tree-zones && node sample-trees.mjs --town=platteville --conc=6"
[ -s mead-areas.json ] && step trees-mead bash -c "cd tree-zones && node sample-trees.mjs --town=mead --conc=6"
[ -s keenesburg-areas.json ] && step trees-keenesburg bash -c "cd tree-zones && node sample-trees.mjs --town=keenesburg --conc=6"
[ -s byers-areas.json ] && step trees-byers bash -c "cd tree-zones && node sample-trees.mjs --town=byers --conc=6"
[ -s lyons-areas.json ] && step trees-lyons bash -c "cd tree-zones && node sample-trees.mjs --town=lyons --conc=6"
step trees-boulder bash -c "cd tree-zones && node sample-trees.mjs --town=boulder --conc=6"
step rounds2 node build-rounds-data.mjs
echo "$(date +%H:%M:%S) all done"; touch "$L/done.flag"

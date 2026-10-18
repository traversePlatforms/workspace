#!/bin/bash
# Batch 6 (2026-10-18, Matthew: "go ahead and pull the 10 close-in gaps places first"). Made by make-batch6.cjs. 10 unincorporated
# Census places inside 45 miles of Englewood, closest first, all lot sizes; then the refine pass resumes.
set -u
cd "$(dirname "$0")"
L=logs-batch6; mkdir -p "$L"
step() { local name=$1; shift; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: ${SSID:-wired}"
bash hotspot-watchdog2.sh run-batch6 > "$L/watchdog.log" 2>&1 &
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
[ -s "$L/shared-towns.before.json" ] || cp shared-towns.json "$L/shared-towns.before.json"
echo "== 1: door lists, neighbourhoods, lawns, lookup"
# Holly Hills, 3.7 mi
if [ -s holly-hills-areas.json ] && [ -s holly-hills-lookup-areas.json ]; then echo "$(date +%T) have  holly-hills"; else
echo "$(date +%T) == holly-hills"
step pull-holly-hills node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.6663 --lon=-104.9234 --radius=0.82 --min-acres=0 --pieces=holly-hills-cdp.json --out=holly-hills.csv
echo "$(date +%T) holly-hills: $(rows holly-hills.csv) doors"
if [ "$(rows holly-hills.csv)" -gt 0 ]; then step areas-holly-hills node build-walklist-pdf.mjs holly-hills.csv --no-pdf; step lawn-holly-hills bash -c "cd lawn-trial && node sample-lawn.mjs --town=holly-hills --conc=16"; step lawnfill-holly-hills bash -c "cd lawn-trial && node lawn-fill.mjs --town=holly-hills --conc=6"; step lookup-holly-hills node build-lookup.mjs holly-hills; else echo "$(date +%T) skip  holly-hills (no doors)"; fi
fi
# Four Square Mile, 5.7 mi
if [ -s four-square-mile-areas.json ] && [ -s four-square-mile-lookup-areas.json ]; then echo "$(date +%T) have  four-square-mile"; else
echo "$(date +%T) == four-square-mile"
step pull-four-square-mile node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.6812 --lon=-104.891 --radius=1.37 --min-acres=0 --pieces=four-square-mile-cdp.json --out=four-square-mile.csv
echo "$(date +%T) four-square-mile: $(rows four-square-mile.csv) doors"
if [ "$(rows four-square-mile.csv)" -gt 0 ]; then step areas-four-square-mile node build-walklist-pdf.mjs four-square-mile.csv --no-pdf; step lawn-four-square-mile bash -c "cd lawn-trial && node sample-lawn.mjs --town=four-square-mile --conc=16"; step lawnfill-four-square-mile bash -c "cd lawn-trial && node lawn-fill.mjs --town=four-square-mile --conc=6"; step lookup-four-square-mile node build-lookup.mjs four-square-mile; else echo "$(date +%T) skip  four-square-mile (no doors)"; fi
fi
# Cherry Creek, 7.3 mi
if [ -s cherry-creek-areas.json ] && [ -s cherry-creek-lookup-areas.json ]; then echo "$(date +%T) have  cherry-creek"; else
echo "$(date +%T) == cherry-creek"
step pull-cherry-creek node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.6106 --lon=-104.8656 --radius=1.07 --min-acres=0 --pieces=cherry-creek-cdp.json --out=cherry-creek.csv
echo "$(date +%T) cherry-creek: $(rows cherry-creek.csv) doors"
if [ "$(rows cherry-creek.csv)" -gt 0 ]; then step areas-cherry-creek node build-walklist-pdf.mjs cherry-creek.csv --no-pdf; step lawn-cherry-creek bash -c "cd lawn-trial && node sample-lawn.mjs --town=cherry-creek --conc=16"; step lawnfill-cherry-creek bash -c "cd lawn-trial && node lawn-fill.mjs --town=cherry-creek --conc=6"; step lookup-cherry-creek node build-lookup.mjs cherry-creek; else echo "$(date +%T) skip  cherry-creek (no doors)"; fi
fi
# Dakota Ridge, 8.3 mi
if [ -s dakota-ridge-areas.json ] && [ -s dakota-ridge-lookup-areas.json ]; then echo "$(date +%T) have  dakota-ridge"; else
echo "$(date +%T) == dakota-ridge"
step pull-dakota-ridge node build-walklist-co.mjs --county='JEFFERSON' --lat=39.6212 --lon=-105.141 --radius=2.54 --min-acres=0 --pieces=dakota-ridge-cdp.json --out=dakota-ridge.csv
echo "$(date +%T) dakota-ridge: $(rows dakota-ridge.csv) doors"
if [ "$(rows dakota-ridge.csv)" -gt 0 ]; then step areas-dakota-ridge node build-walklist-pdf.mjs dakota-ridge.csv --no-pdf; step lawn-dakota-ridge bash -c "cd lawn-trial && node sample-lawn.mjs --town=dakota-ridge --conc=16"; step lawnfill-dakota-ridge bash -c "cd lawn-trial && node lawn-fill.mjs --town=dakota-ridge --conc=6"; step lookup-dakota-ridge node build-lookup.mjs dakota-ridge; else echo "$(date +%T) skip  dakota-ridge (no doors)"; fi
fi
# Acres Green, 8.4 mi
if [ -s acres-green-areas.json ] && [ -s acres-green-lookup-areas.json ]; then echo "$(date +%T) have  acres-green"; else
echo "$(date +%T) == acres-green"
step pull-acres-green node build-walklist-co.mjs --county='DOUGLAS' --lat=39.5565 --lon=-104.8952 --radius=0.8 --min-acres=0 --pieces=acres-green-cdp.json --out=acres-green.csv
echo "$(date +%T) acres-green: $(rows acres-green.csv) doors"
if [ "$(rows acres-green.csv)" -gt 0 ]; then step areas-acres-green node build-walklist-pdf.mjs acres-green.csv --no-pdf; step lawn-acres-green bash -c "cd lawn-trial && node sample-lawn.mjs --town=acres-green --conc=16"; step lawnfill-acres-green bash -c "cd lawn-trial && node lawn-fill.mjs --town=acres-green --conc=6"; step lookup-acres-green node build-lookup.mjs acres-green; else echo "$(date +%T) skip  acres-green (no doors)"; fi
fi
# Inverness, 8.5 mi
if [ -s inverness-areas.json ] && [ -s inverness-lookup-areas.json ]; then echo "$(date +%T) have  inverness"; else
echo "$(date +%T) == inverness"
step pull-inverness-1 node build-walklist-co.mjs --county='ARAPAHOE' --lat=39.5768 --lon=-104.8671 --radius=0.86 --min-acres=0 --pieces=inverness-cdp.json --out=inverness-arapahoe.csv
step pull-inverness-2 node build-walklist-co.mjs --county='DOUGLAS' --lat=39.5768 --lon=-104.8671 --radius=0.86 --min-acres=0 --pieces=inverness-cdp.json --out=inverness-douglas.csv
node merge-walklists.mjs inverness.csv $(ls inverness-arapahoe.csv inverness-douglas.csv 2>/dev/null) > "$L/merge-inverness.log" 2>&1
echo "$(date +%T) inverness: $(rows inverness.csv) doors"
if [ "$(rows inverness.csv)" -gt 0 ]; then step areas-inverness node build-walklist-pdf.mjs inverness.csv --no-pdf; step lawn-inverness bash -c "cd lawn-trial && node sample-lawn.mjs --town=inverness --conc=16"; step lawnfill-inverness bash -c "cd lawn-trial && node lawn-fill.mjs --town=inverness --conc=6"; step lookup-inverness node build-lookup.mjs inverness; else echo "$(date +%T) skip  inverness (no doors)"; fi
fi
# Meridian, 10.5 mi
if [ -s meridian-areas.json ] && [ -s meridian-lookup-areas.json ]; then echo "$(date +%T) have  meridian"; else
echo "$(date +%T) == meridian"
step pull-meridian node build-walklist-co.mjs --county='DOUGLAS' --lat=39.5449 --lon=-104.8543 --radius=1.41 --min-acres=0 --pieces=meridian-cdp.json --out=meridian.csv
echo "$(date +%T) meridian: $(rows meridian.csv) doors"
if [ "$(rows meridian.csv)" -gt 0 ]; then step areas-meridian node build-walklist-pdf.mjs meridian.csv --no-pdf; step lawn-meridian bash -c "cd lawn-trial && node sample-lawn.mjs --town=meridian --conc=16"; step lawnfill-meridian bash -c "cd lawn-trial && node lawn-fill.mjs --town=meridian --conc=6"; step lookup-meridian node build-lookup.mjs meridian; else echo "$(date +%T) skip  meridian (no doors)"; fi
fi
# Berkley, 10.8 mi
if [ -s berkley-areas.json ] && [ -s berkley-lookup-areas.json ]; then echo "$(date +%T) have  berkley"; else
echo "$(date +%T) == berkley"
step pull-berkley node build-walklist-co.mjs --county='ADAMS' --lat=39.8069 --lon=-105.0297 --radius=1.44 --min-acres=0 --pieces=berkley-cdp.json --out=berkley.csv
echo "$(date +%T) berkley: $(rows berkley.csv) doors"
if [ "$(rows berkley.csv)" -gt 0 ]; then step areas-berkley node build-walklist-pdf.mjs berkley.csv --no-pdf; step lawn-berkley bash -c "cd lawn-trial && node sample-lawn.mjs --town=berkley --conc=16"; step lawnfill-berkley bash -c "cd lawn-trial && node lawn-fill.mjs --town=berkley --conc=6"; step lookup-berkley node build-lookup.mjs berkley; else echo "$(date +%T) skip  berkley (no doors)"; fi
fi
# Sterling Ranch, 11.4 mi
if [ -s sterling-ranch-areas.json ] && [ -s sterling-ranch-lookup-areas.json ]; then echo "$(date +%T) have  sterling-ranch"; else
echo "$(date +%T) == sterling-ranch"
step pull-sterling-ranch node build-walklist-co.mjs --county='DOUGLAS' --lat=39.4944 --lon=-105.0499 --radius=2.17 --min-acres=0 --pieces=sterling-ranch-cdp.json --out=sterling-ranch.csv
echo "$(date +%T) sterling-ranch: $(rows sterling-ranch.csv) doors"
if [ "$(rows sterling-ranch.csv)" -gt 0 ]; then step areas-sterling-ranch node build-walklist-pdf.mjs sterling-ranch.csv --no-pdf; step lawn-sterling-ranch bash -c "cd lawn-trial && node sample-lawn.mjs --town=sterling-ranch --conc=16"; step lawnfill-sterling-ranch bash -c "cd lawn-trial && node lawn-fill.mjs --town=sterling-ranch --conc=6"; step lookup-sterling-ranch node build-lookup.mjs sterling-ranch; else echo "$(date +%T) skip  sterling-ranch (no doors)"; fi
fi
# Derby, 13.5 mi
if [ -s derby-areas.json ] && [ -s derby-lookup-areas.json ]; then echo "$(date +%T) have  derby"; else
echo "$(date +%T) == derby"
step pull-derby node build-walklist-co.mjs --county='ADAMS' --lat=39.8396 --lon=-104.915 --radius=1.54 --min-acres=0 --pieces=derby-cdp.json --out=derby.csv
echo "$(date +%T) derby: $(rows derby.csv) doors"
if [ "$(rows derby.csv)" -gt 0 ]; then step areas-derby node build-walklist-pdf.mjs derby.csv --no-pdf; step lawn-derby bash -c "cd lawn-trial && node sample-lawn.mjs --town=derby --conc=16"; step lawnfill-derby bash -c "cd lawn-trial && node lawn-fill.mjs --town=derby --conc=6"; step lookup-derby node build-lookup.mjs derby; else echo "$(date +%T) skip  derby (no doors)"; fi
fi
echo "== 2: values, rebuild, upload"
step values node sample-value.mjs --only=holly-hills,four-square-mile,cherry-creek,dakota-ridge,acres-green,inverness,meridian,berkley,sterling-ranch,derby
step rounds1 node build-rounds-data.mjs
NEW=""; for t in holly-hills four-square-mile cherry-creek dakota-ridge acres-green inverness meridian berkley sterling-ranch derby; do [ -s "../../app/data/rounds/$t.json" ] && NEW="$NEW $t"; done
PARTNERS=$(node -e "const a=require('./$L/shared-towns.before.json'),b=require('./shared-towns.json'),n=new Set(process.argv.slice(1)),o=new Set();for(const k of n)for(const p of (b[k]||[]))if(!n.has(p))o.add(p);for(const [k,v] of Object.entries(b))if(!n.has(k))for(const p of v)if(n.has(p)&&!(a[k]||[]).includes(p))o.add(k);console.log([...o].join(' '))" $NEW)
echo "$(date +%T) new: $NEW | towns that gave doors to them: $PARTNERS"
up() { for k in 1 2 3; do bash upload-towns-sixfold.sh "$@"; [ -f "logs-upload/$1.done" ] && return 0; echo "$(date +%T) upload $1 failed, try $k"; sleep 120; done; return 1; }
up batch6-doors $NEW $PARTNERS
echo "== 3: compact lawn pass, trees, rebuild, upload"
for t in $NEW; do step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=6"; step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step rounds2 node build-rounds-data.mjs
up batch6-trees $NEW $PARTNERS
echo "$(date +%T) batch 6 done"
echo "== 4: the refine pass resumes"
bash run-refine-2026-10-16.sh > logs-refine-runner2.log 2>&1
echo "$(date +%T) refine finished"

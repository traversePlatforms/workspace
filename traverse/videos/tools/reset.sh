#!/bin/sh
# Back to a clean day on the LOCAL Roofing test copy (edcheck), then the office side of Alex's day: the neighbourhood as a
# territory and two calendar entries for today. Never touches a live install.
R=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/edcheck/traverse-data/rounds
case "$R" in *scratchpad/edcheck/*) ;; *) echo "refusing: not the test copy"; exit 1;; esac
rm -f "$R"/*.log "$R"/regions-cache-*.json "$R"/goals.json "$R"/goals-people.json "$R"/calendar*.json "$R"/sms-optout.json "$R"/billing.json
cd "$(dirname "$0")" && node -e "
import('./lib.mjs').then(async({api})=>{const D=require('./demo.json');const call=api('http://127.0.0.1:8791/api/traverse-rounds.php');
await call('a','signin',{},{code:'333333'});
let r=await call('a','assign',{},{region:D.town,area:D.area,who:'Alex Rivera'});console.log('territory',r.j&&r.j.ok,r.j&&r.j.error||'');
const today=new Date(Date.now()-6*3600e3).toISOString().slice(0,10);
for(const [time,title] of [['07:45','Team huddle at the office'],['13:00','Ride-along with your manager']]){r=await call('a','calsave',{},{who:'Alex Rivera',date:today,time,title});console.log('calendar',time,r.j&&r.j.ok,r.j&&r.j.error||'')}
const reg=(await call('a','regions')).j.regions;let v=0;for(const g of reg)for(const a of g.areas)v+=(a.done||0)+(a.noanswer||0);console.log('doors with history',v);const t=Date.now();await call('a','area',{region:D.town,area:D.area});await call('a','regions');console.log('warmed in',Date.now()-t,'ms')})"

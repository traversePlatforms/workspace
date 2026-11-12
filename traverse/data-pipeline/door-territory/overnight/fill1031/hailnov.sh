#!/bin/bash
# Stage hailnov (fill1031, added 11 Nov 2026; CLOUD-PLAN-2026-11 data refreshes, Matthew 11 Nov "go ahead and run ... 3 4").
# The radar's daily hail maximum (NOAA/NSSL MRMS MESH, Iowa State's archive; not gis.colorado.gov) for the days since the live storm
# files (through 2026-10-28) over the whole state, into ~/run/hailfill/days/ as hail-backfill-vm.sh does, then a per-day summary:
# hailnov-summary.tsv (day, file, cells with any hail, cells of 0.75 in or more, the biggest in inches). The laptop decides whether a
# rebuild is needed from that summary. No door ids or owners on this machine.
. "$HOME/run/fill1031/lib.sh"
H="$HOME/run/hailfill"; cd "$H" || exit 1
export HAIL_DAYS="$H/days" HAIL_BOX="36.95,41.05,-109.1,-102.0"
st "hailnov: radar days 2026-10-29 to 2026-11-10"
tries hailnov-fetch nice -n 10 node hail/build-hail.mjs fetch 2026-10-29 2026-11-10 || exit 1
node -e '
const fs=require("fs"), D=process.argv[1]; const out=["day\tfile\tcells_any\tcells_075\tmax_in"];
for (let t=Date.parse("2026-10-29"); t<=Date.parse("2026-11-10"); t+=86400000) { const d=new Date(t).toISOString().slice(0,10), f=D+"/"+d+".json";
  if(!fs.existsSync(f)){out.push(d+"\tNOT FETCHED\t\t\t");continue;} const j=JSON.parse(fs.readFileSync(f,"utf8"));
  if(j.missing){out.push(d+"\tmissing: "+j.missing+"\t\t\t");continue;} let a=0,b=0,m=0; for(const c of j.cells){a++; if(c[2]>=190.5)b++; m=Math.max(m,c[2]);} out.push([d,j.file,a,b,(m/254).toFixed(2)].join("\t")); }
fs.writeFileSync(process.argv[2], out.join("\n")+"\n"); console.log(out.join("\n"));' "$H/days" "$Q/hailnov-summary.tsv"
st "hailnov: done (~/run/fill1031/hailnov-summary.tsv)"

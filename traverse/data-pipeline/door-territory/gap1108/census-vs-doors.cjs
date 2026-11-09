/* Gap plan 2026-11-08: Census ACS 2020-24 houses + townhomes per county (B25024 002+003) split by tenure (B25032 owner 003+004, renter
   014+015; vacant = the rest) against our doors and office-lookup homes. Run in a folder holding acs-county.json (the Census answer)
   and door-points.tsv (export-door-points.mjs). Prints counts only. */
const fs=require('fs');const j=JSON.parse(fs.readFileSync('acs-county.json','utf8'));const h=j[0];
const ours={},look={};for(const l of fs.readFileSync('door-points.tsv','utf8').split('\n').slice(1)){if(!l)continue;const [k,c]=l.split('\t');(k==='door'?ours:look)[c]=((k==='door'?ours:look)[c]||0)+1;}
const rows=[];for(const r of j.slice(1)){const n=k=>+r[h.indexOf(k)];const name=r[0].replace(/ County, Colorado/,'');const key=name.toLowerCase().replace(/[^a-z]/g,'');
const H=n('B25024_002E')+n('B25024_003E'),O=n('B25032_003E')+n('B25032_004E'),R=n('B25032_014E')+n('B25032_015E');rows.push({name,H,O,R,V:H-O-R,d:ours[key]||0,l:look[key]||0});}
rows.sort((a,b)=>(b.H-b.d)-(a.H-a.d));let T={H:0,O:0,R:0,V:0,d:0,l:0};
console.log('county\thouses\towner\trenter\tvacant\tdoors\tlookup\tgap\towner-gap');
for(const r of rows){for(const k in T)T[k]+=r[k];console.log([r.name,r.H,r.O,r.R,r.V,r.d,r.l,r.H-r.d,r.O-r.d].join('\t'));}
console.log(['TOTAL',T.H,T.O,T.R,T.V,T.d,T.l,T.H-T.d,T.O-T.d].join('\t'));
fs.writeFileSync('percounty.json',JSON.stringify(rows));

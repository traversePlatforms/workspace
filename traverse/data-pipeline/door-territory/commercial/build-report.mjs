/* Commercial test (2026-10-05): one local review page for Matthew. Holds owner and agent names, so it is written to out/
 * (gitignored) and is never to be published as an artifact or uploaded.
 *   node build-report.mjs   ->  out/COMMERCIAL-TEST.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
const SPOTS = ['springs', 'south', 'west'];
const WHY = {
  springs: 'Most hail of any Colorado city: 24 days of 1-inch-plus hail reported within 6 km of this point, 2020-2025 (NWS storm reports). Peterson airfield is in the circle.',
  south: 'South Denver metro: 19 days of 1-inch-plus hail within 15 km of Centennial and 15 wind-damage days, 2020-2025, with dense office and retail stock.',
  west: 'West Denver / Lakewood line: 5 days of 1.75-inch-plus hail within 15 km of Lakewood and 16 wind-damage days, 2020-2025, the largest commercial and apartment stock of the three.',
};
const data = {};
for (const s of SPOTS) {
  const j = JSON.parse(readFileSync(join(OUT, `commercial-${s}.json`), 'utf8'));
  data[s] = { label: j.label, hailThrough: j.hailThrough, why: WHY[s], rows: j.buildings.map((b) => {
    const recent = b.hail.filter((h) => h[1] >= 1 && h[0] >= '2023-01-01');
    const score = (recent.length ? 3 : b.hailBigDays ? 1 : 0) + (b.roofSqft >= 20000 ? 2 : b.roofSqft >= 8000 ? 1 : 0) + (b.tier <= 2 ? 2 : b.tier === 3 ? 1 : 0);
    const agent = b.sos && b.sos.agent ? (b.sos.agent.person || b.sos.agent.org) : '';
    return { ...b, score, recentBig: recent.length, recentMax: recent.reduce((m, h) => Math.max(m, h[1]), 0), agent };
  }) };
}
const summary = (rows) => {
  const n = rows.length, c = (f) => rows.filter(f).length;
  return { n, apt: c((r) => r.kind === 'apartments'), com: c((r) => r.kind === 'commercial'), ind: c((r) => r.kind === 'industrial'),
    t: [1, 2, 3, 4, 5].map((t) => c((r) => r.tier === t)), roof: c((r) => r.roofSqft), roof20: c((r) => r.roofSqft >= 20000),
    recent: c((r) => r.recentBig), shared: c((r) => r.sharedMail), notFound: c((r) => ['llc', 'lllp', 'corp', 'lp', 'org'].includes(r.ownerType) && !r.sos) };
};
const S = Object.fromEntries(SPOTS.map((s) => [s, summary(data[s].rows)]));
const all = SPOTS.flatMap((s) => data[s].rows), TOT = summary(all);
const pct = (a, b) => (b ? Math.round(100 * a / b) : 0) + '%';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Commercial Roofing Test</title>
<style>
:root{--bg:#f6f5f2;--ink:#1d1d1b;--soft:#5d5d58;--line:#dcdad3;--card:#fff;--acc:#b44a1c;--ok:#2f7d4f;--warn:#a26b00}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#161615;--ink:#ecebe6;--soft:#a6a59e;--line:#34332f;--card:#1f1f1d;--acc:#e07a4c;--ok:#6cc08f;--warn:#e0b04c}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:24px 16px 60px}h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:34px 0 8px}h3{margin:0 0 6px;font-size:16px}
p.lede{color:var(--soft);margin:0 0 18px;max-width:80ch}.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.big{font-size:26px;font-weight:700}.soft{color:var(--soft)}
.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;margin:8px 0 4px;background:var(--line)}.bar span{display:block}
.t1{background:#2f7d4f}.t2{background:#6aa84f}.t3{background:#d1a33a}.t4{background:#b9b7ae}.t5{background:#7d7b74}
.legend span{display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:13px}.legend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.tabs button,select,input{font:inherit;padding:6px 10px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:7px}
.tabs button.on{background:var(--acc);color:#fff;border-color:var(--acc)}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px 9px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{position:sticky;top:0;background:var(--card);cursor:pointer;white-space:nowrap}
td.n{text-align:right;white-space:nowrap}.pill{display:inline-block;padding:1px 7px;border-radius:9px;font-size:12px;color:#fff}
.small{font-size:12px;color:var(--soft)}a{color:var(--acc)}details{margin-top:10px}code{font-size:12px}
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
</style></head><body><div class="wrap">
<h1>Commercial roofing test: three storm spots</h1>
<p class="lede">Apartments, commercial and industrial buildings in the three places that see the most hail and wind in Colorado, each with roof size, hail and wind history, a 2023 aerial photo, and the closest public name behind the owner. Built ${new Date().toISOString().slice(0, 10)} from public records only. <b>This page holds owner and agent names: keep it on this computer, don't publish or share it.</b></p>

<div class="grid">
<div class="card"><div class="big">${TOT.n.toLocaleString()}</div>buildings in three 4 km circles<br><span class="soft">${TOT.apt} apartments · ${TOT.com} commercial · ${TOT.ind} industrial</span></div>
<div class="card"><div class="big">${pct(TOT.t[0] + TOT.t[1], TOT.n)}</div>have a person's name without any searching<br><span class="soft">${TOT.t[0]} owned by a person · ${TOT.t[1]} with a probable owner (registered agent or c/o)</span></div>
<div class="card"><div class="big">${pct(TOT.t[3], TOT.n)}</div>stop at a mailing address<br><span class="soft">agent service, an attorney acting for many companies, or not in the Colorado register</span></div>
<div class="card"><div class="big">${TOT.recent.toLocaleString()}</div>had 1-inch-plus hail at the building since Jan 2023<br><span class="soft">radar estimate (MRMS), ${pct(TOT.recent, TOT.n)} of all</span></div>
</div>

<h2>How close each building gets to a person</h2>
<div class="legend"><span><i class="t1"></i>1 · Person on the deed</span><span><i class="t2"></i>2 · Probable owner (agent is a person acting for few companies, or a c/o line)</span><span><i class="t3"></i>3 · A company or trust to call (agent is a company, or held in trust)</span><span><i class="t4"></i>4 · Mailing address only</span><span><i class="t5"></i>5 · Public owner</span></div>
<div class="grid">${SPOTS.map((s) => { const x = S[s]; return `<div class="card"><h3>${data[s].label}</h3><div class="soft small">${data[s].why}</div>
<div class="bar">${x.t.map((v, i) => `<span class="t${i + 1}" style="width:${100 * v / x.n}%" title="tier ${i + 1}: ${v}"></span>`).join('')}</div>
<div class="small">${x.n.toLocaleString()} buildings: ${x.t.map((v, i) => `<b>${v}</b> tier ${i + 1}`).join(' · ')}</div>
<div class="small" style="margin-top:6px">${x.apt} apartments · ${x.com} commercial · ${x.ind} industrial · ${x.roof20} roofs of 20,000 sq ft+ · ${x.recent} hit by 1-inch-plus hail since 2023 · ${x.shared} share a mailing address with another owner · hail data through ${data[s].hailThrough}</div></div>`; }).join('')}</div>

<h2>The buildings</h2>
<p class="small">Sorted by a simple priority: recent big hail (3), roof size (up to 2), how close the lead is (up to 2). Click a column to sort. "Photo" opens the 2023 USDA aerial of the roof; "Register" opens the company's Colorado Secretary of State page, where its filings and history are.</p>
<div class="tabs" id="tabs">${SPOTS.map((s, i) => `<button data-s="${s}" class="${i ? '' : 'on'}">${data[s].label}</button>`).join('')}</div>
<div class="controls">
<select id="tier"><option value="">All leads</option><option value="1">1 · person on the deed</option><option value="2">2 · probable owner</option><option value="12">1 and 2</option><option value="3">3 · company or trust</option><option value="4">4 · mailing address only</option><option value="5">5 · public</option></select>
<select id="kind"><option value="">All types</option><option>apartments</option><option>commercial</option><option>industrial</option></select>
<select id="hail"><option value="">Any hail</option><option value="recent">1-inch-plus since 2023</option></select>
<select id="roof"><option value="">Any roof</option><option value="8000">8,000 sq ft+</option><option value="20000">20,000 sq ft+</option></select>
<input id="q" placeholder="Search address or owner" size="26"><span id="count" class="small"></span></div>
<div class="tablewrap"><table><thead><tr>
<th data-k="score">Priority</th><th data-k="addr">Building</th><th data-k="roofSqft">Roof sq ft</th><th data-k="recentMax">Hail since 2023</th><th data-k="hailMax">Biggest hail</th><th data-k="windMax">Top gust</th><th data-k="owner">Owner of record</th><th data-k="tier">Lead</th><th>Links</th></tr></thead><tbody id="tb"></tbody></table></div>
<p class="small" id="more"></p>

<h2>Owners behind many buildings</h2>
<p class="small">Mailing addresses that receive the tax bills for several different owners. Usually a property manager or one family/company holding each building in its own LLC: one conversation covers all of them.</p>
<div class="grid" id="ports"></div>

<h2>How it was built</h2>
<details open><summary>Sources</summary><ul class="small">
<li><b>Spots</b>: NWS Local Storm Reports 2020-2025 (Iowa Environmental Mesonet archive), days with 1-inch-plus hail and damaging wind counted around 27 Colorado cities, then the densest point in each of the top three areas with commercial building stock. Sterling and Limon rank high for hail but Logan County publishes no land use and both have little commercial stock.</li>
<li><b>Buildings and owners</b>: El Paso County assessor file (weekly) + county parcel shapes for Springs; the State of Colorado public parcel composite for Arapahoe, Douglas, Denver and Jefferson. Condominium units left out (the association owns the roof); churches, schools and exempt owners left out.</li>
<li><b>Owner to person</b>: Colorado Secretary of State business register, open data (data.colorado.gov, refreshed daily): status, where formed, principal address, registered agent. Each agent counted statewide; 25+ companies = professional agent. Colorado does not require LLC members or managers in that register, so the agent is the closest public name. Mailing addresses grouped to find portfolios. No people-search sites.</li>
<li><b>Roof size</b>: official roof outlines (City of Colorado Springs, Arapahoe County Roof Prints, Denver building outlines, Jefferson County roofprints 2022; Microsoft ML outlines for a small Douglas strip). Stacked roof levels counted once.</li>
<li><b>Hail</b>: NOAA/NSSL MRMS MESH radar estimate of the largest hail, daily, April-September 2020-2026, at the building (about 1 km). Runs small against ground reports for big stones.</li>
<li><b>Wind</b>: NWS storm reports within 10 miles: gusts of 50 mph+ and wind damage, 2020-2026. The 90-105 mph readings near Springs are measured airport sensors in the December 2021 and 2022 downslope storms.</li>
<li><b>Photo</b>: USDA NAIP 2023, 0.3 m, public domain, via Microsoft Planetary Computer.</li>
</ul></details>
<details><summary>What it does not do</summary><ul class="small">
<li>No roof material: the photo classifier learned houses (shingle vs tile); commercial roofs are mostly flat membrane or metal.</li>
<li>Year built only for Springs (El Paso's file); the statewide layer carries none for the Denver counties.</li>
<li>The owner of record is not always the buyer: on leased buildings a property manager, or the tenant under a net lease, may handle the roof.</li>
<li>A registered agent who is a person is <i>probably</i> an owner or principal, not certainly. Treat tier 2 as "the right person to ask for", not "the owner".</li>
<li>Springs' city outline layer is undated and appears to miss some newer buildings.</li>
</ul></details>
</div>
<script>
const DATA=${JSON.stringify(Object.fromEntries(SPOTS.map((s) => [s, data[s].rows.map((r) => ({ s: r.score, a: r.addr, c: r.city, k: r.kind, u: r.use, rf: r.roofSqft || 0, rb: r.recentBig, rm: r.recentMax, hm: r.hailMax || 0, hl: r.hailLastBig || '', wm: r.windMax || 0, wd: r.windDays, o: r.owner, o2: r.owner2 || '', ot: r.ownerType, t: r.tier, why: r.why, l: r.lead, ak: r.agentKind || '', ag: r.agent || '', co: r.careOf ? r.careOf + (r.careOfKind ? ' (' + r.careOfKind + ')' : '') : '', an: r.agentEntities || 0, st: r.sos && r.sos.status || '', sid: r.sos && r.sos.found !== false && r.sos.name ? r.sos.name : '', fi: r.sos && r.sos.formedIn || '', pr: r.sos && r.sos.principal || '', m: r.mail ? [r.mail.adr, r.mail.city, r.mail.st, r.mail.zip].filter(Boolean).join(', ') : '', sh: r.sharedMail ? r.sharedMail.owners : 0, nb: r.naip || null, yb: r.yb || '', pf: r.portfolio, id: r.id, eid: r.sosId || '' }))])))};
const IDS=${JSON.stringify(Object.fromEntries(SPOTS.map((s) => [s, Object.fromEntries(data[s].rows.filter((r) => r.sos && r.sos.found !== false && r.sosEntityId).map((r) => [r.id, r.sosEntityId]))])))};
let spot='${SPOTS[0]}',key='s',dir=-1;const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const naip=n=>'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/'+n[1]+','+n[2]+','+n[3]+','+n[4]+'/640x640.png?collection=naip&item=co_m_'+n[0]+'&assets=image&asset_bidx=image%7C1%2C2%2C3';
const COL=['','#2f7d4f','#6aa84f','#d1a33a','#9a988f','#7d7b74'];
function render(){const t=$('tier').value,k=$('kind').value,h=$('hail').value,rf=+$('roof').value||0,q=$('q').value.toLowerCase();
 let R=DATA[spot].filter(r=>(!t||(t==='12'?r.t<=2:r.t==+t))&&(!k||r.k===k)&&(!h||r.rb)&&r.rf>=rf&&(!q||(r.a+' '+r.o+' '+r.l+' '+r.m).toLowerCase().includes(q)));
 R.sort((a,b)=>{const x=a[key],y=b[key];return (x>y?1:x<y?-1:0)*dir||b.s-a.s||b.rf-a.rf});
 $('count').textContent=R.length.toLocaleString()+' buildings';
 $('tb').innerHTML=R.slice(0,400).map(r=>'<tr><td class="n">'+'★'.repeat(Math.max(0,Math.round(r.s/2)))+' <span class="small">'+r.s+'</span></td>'+
 '<td><b>'+esc(r.a||'(no address)')+'</b><div class="small">'+esc(r.u)+(r.yb?' · built '+r.yb:'')+'</div></td>'+
 '<td class="n">'+(r.rf?r.rf.toLocaleString():'–')+'</td><td class="n">'+(r.rb?r.rb+' day'+(r.rb>1?'s':'')+', up to '+r.rm+'"':'–')+'</td><td class="n">'+(r.hm?r.hm+'"<div class="small">'+esc(r.hl)+'</div>':'–')+'</td><td class="n">'+(r.wm?r.wm+' mph':'–')+'<div class="small">'+r.wd+' days</div></td>'+
 '<td>'+esc(r.o)+(r.o2?'<div class="small">'+esc(r.o2)+'</div>':'')+(r.pf>1?'<div class="small">owns '+r.pf+' buildings here</div>':'')+(r.sh?'<div class="small">mail shared with '+(r.sh-1)+' other owner'+(r.sh>2?'s':'')+'</div>':'')+'</td>'+
 '<td><span class="pill" style="background:'+COL[r.t]+'">'+r.t+'</span> <b>'+esc(r.l)+'</b><div class="small">'+esc(r.why)+'</div>'+(r.ag&&r.ag!==r.l?'<div class=small>Registered agent: '+esc(r.ag)+' · '+esc(r.ak)+(r.an?', agent for '+r.an+' companies':'')+'</div>':'')+(r.co&&r.l.indexOf('c/o')!==0?'<div class=small>Tax bill c/o: '+esc(r.co)+'</div>':'')+(r.st?'<div class="small">'+esc(r.st)+(r.fi&&r.fi!=='CO'?', formed in '+esc(r.fi):'')+'</div>':'')+'<div class="small">Mail: '+esc(r.m)+'</div>'+(r.pr&&r.pr.toUpperCase()!==r.m.toUpperCase()?'<div class="small">Principal office: '+esc(r.pr)+'</div>':'')+'</td>'+
 '<td class="small">'+(r.nb?'<a href="'+naip(r.nb)+'" target="_blank" rel="noopener">Photo</a><br>':'')+(IDS[spot][r.id]?'<a href="https://www.coloradosos.gov/biz/BusinessEntityDetail.do?masterFileId='+IDS[spot][r.id]+'" target="_blank" rel="noopener">Register</a>':'')+'</td></tr>').join('');
 $('more').textContent=R.length>400?'Showing the first 400; filter or sort to see others.':'';
 const P={};for(const r of DATA[spot])if(r.sh>1){(P[r.m]=P[r.m]||{o:new Set(),n:0,rf:0,rb:0}).o.add(r.o);P[r.m].n++;P[r.m].rf+=r.rf;P[r.m].rb+=r.rb?1:0}
 $('ports').innerHTML=Object.entries(P).sort((a,b)=>b[1].n-a[1].n).slice(0,9).map(([m,p])=>'<div class="card"><b>'+esc(m)+'</b><div class="small">'+p.o.size+' owners · '+p.n+' buildings · '+p.rf.toLocaleString()+' sq ft of roof · '+p.rb+' hit since 2023</div><div class="small">'+[...p.o].slice(0,5).map(esc).join(' · ')+(p.o.size>5?' …':'')+'</div></div>').join('');}
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('on'));b.classList.add('on');spot=b.dataset.s;render()});
document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{const k={score:'s',addr:'a',roofSqft:'rf',recentMax:'rm',hailMax:'hm',windMax:'wm',owner:'o',tier:'t'}[th.dataset.k];if(key===k)dir=-dir;else{key=k;dir=(k==='a'||k==='o'||k==='t')?1:-1}render()});
['tier','kind','hail','roof','q'].forEach(id=>$(id).oninput=render);render();
</script></body></html>`;
writeFileSync(join(OUT, 'COMMERCIAL-TEST.html'), html);
console.log('wrote out/COMMERCIAL-TEST.html', (html.length / 1e6).toFixed(1), 'MB');
console.log(JSON.stringify({ total: TOT, spots: S }));

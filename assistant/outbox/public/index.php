<?php
/* Outbox: every email Matthew's tools send by themselves, one section per business (served through PHP so the host's front server never
   keeps an old copy). Peak has its full controls (the Peak sender's own page, framed); Sixfold and Traverse are read only. */
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer'); header('X-Frame-Options: SAMEORIGIN');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Outbox</title>
<script>(function(){function a(){try{var t=localStorage.getItem('sixfold.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme')}catch(e){}}a();window.addEventListener('storage',function(e){if(!e.key||e.key==='sixfold.theme')a()})})();</script>
<style>
:root{--bg:#f2f4f7;--card:#fff;--ink:#17202b;--soft:#5d6878;--line:#dce1e8;--brand:#2b3a4f;--brand2:#e7ebf1;--warn:#9a5b00;--warnbg:#fff4e0;--bad:#a12a2a;--badbg:#fdeaea;--ok:#1f6b3a;--okbg:#e5f4ea;--off:#6b7280;--offbg:#eef0f3}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#10141a;--card:#181e27;--ink:#e3e8ef;--soft:#9aa5b4;--line:#2a323e;--brand:#9fb3cf;--brand2:#222b37;--warn:#f0b35a;--warnbg:#2c2414;--bad:#f08a8a;--badbg:#2e1818;--ok:#7fd29b;--okbg:#16281d;--off:#9aa5b4;--offbg:#222830}}
:root[data-theme="dark"]{--bg:#10141a;--card:#181e27;--ink:#e3e8ef;--soft:#9aa5b4;--line:#2a323e;--brand:#9fb3cf;--brand2:#222b37;--warn:#f0b35a;--warnbg:#2c2414;--bad:#f08a8a;--badbg:#2e1818;--ok:#7fd29b;--okbg:#16281d;--off:#9aa5b4;--offbg:#222830}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
header{background:#2b3a4f;color:#fff;padding:11px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{font-size:18px;margin:0;flex:1;letter-spacing:.2px}header button{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}
main{max-width:1180px;margin:0 auto;padding:16px;display:grid;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card h2{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
button{font:600 14px system-ui,sans-serif;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 13px;cursor:pointer;min-height:40px}
button.main{background:var(--brand);border-color:var(--brand);color:var(--card)}
input{font:15px system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px 10px;width:100%}
label{display:block;font-size:13px;color:var(--soft);margin:8px 0 3px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}@media(max-width:760px){.tiles{grid-template-columns:repeat(2,1fr)}}
.tile{background:var(--bg);border-radius:10px;padding:10px 12px}.tile b{display:block;font-size:26px;line-height:1.1}.tile span{font-size:13px;color:var(--soft)}.tile small{display:block;font-size:12px;color:var(--soft);margin-top:3px}
.tile.bad b{color:var(--bad)}
.att{margin:12px 0 0;padding:0;list-style:none;font-size:14px}.att li{padding:6px 10px;border-radius:8px;margin:4px 0}.att li.bad{background:var(--badbg);color:var(--bad)}.att li.info{background:var(--offbg);color:var(--soft)}
.tabs{display:flex;gap:6px;flex-wrap:wrap}.tabs button[aria-selected="true"]{background:var(--brand);border-color:var(--brand);color:var(--card)}
.tabs .n{font-size:12px;opacity:.8;margin-left:4px}
.note{font-size:13px;color:var(--soft)}.tiny{font-size:12px}
.lead{background:var(--brand2);border-radius:10px;padding:10px 12px;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:860px){.grid{grid-template-columns:1fr}}
.pill{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px}.pill.on{background:var(--okbg);color:var(--ok)}.pill.off{background:var(--offbg);color:var(--off)}.pill.mid{background:var(--warnbg);color:var(--warn)}
.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.nums div{background:var(--bg);border-radius:8px;padding:5px 8px}.nums b{display:block;font-size:18px}.nums span{font-size:12px;color:var(--soft)}
dl{margin:6px 0;font-size:13px;display:grid;grid-template-columns:92px 1fr;gap:3px 8px}dt{color:var(--soft)}dd{margin:0}
.fails{font-size:13px;margin:6px 0 0;background:var(--badbg);color:var(--bad);border-radius:8px;padding:6px 9px}
details summary{cursor:pointer;font-size:13px;color:var(--soft);margin-top:6px}
iframe{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--bg);min-height:600px;display:block}
#signin{max-width:360px;margin:60px auto}.hide{display:none!important}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
code{font:13px ui-monospace,Consolas,monospace;background:var(--bg);padding:2px 5px;border-radius:5px;word-break:break-all}
.flash{background:var(--badbg);color:var(--bad);border-radius:8px;padding:8px 10px;font-size:14px}
.trk{margin:8px 0 2px;border-top:1px solid var(--line);padding-top:8px}.trk h3{font-size:14px;margin:0 0 4px}
table.t{border-collapse:collapse;width:100%;font-size:13px;margin:4px 0}table.t th,table.t td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line);vertical-align:top}table.t th{color:var(--soft);font-weight:600}
.yes{color:var(--ok);font-weight:700}.no{color:var(--soft)}.tag{font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;background:var(--okbg);color:var(--ok);margin-left:4px}
#ed{position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:50;overflow:auto;padding:18px 10px}#ed .box{max-width:980px;margin:0 auto;background:var(--card);border-radius:14px;padding:16px 18px;border:1px solid var(--line)}
.warn{background:var(--warnbg);color:var(--warn);border-radius:10px;padding:10px 12px;font-size:14px;margin:8px 0}
.ln{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin:8px 0}.ln label{margin:0 0 4px;color:var(--ink);font-weight:600}.ln .w{font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;background:var(--offbg);color:var(--soft);margin-left:6px}
.ln textarea{font:14px system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 9px;width:100%;min-height:38px;resize:vertical}
.ln .err{color:var(--bad);font-size:13px;margin-top:3px}.ln .chg{border-color:var(--warn)}.chips{font-size:12px;color:var(--soft);margin-top:3px}.chips code{font-size:12px}
.edgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.edgrid{grid-template-columns:1fr}}
iframe.pv{min-height:520px;background:#fff}
</style>
</head>
<body>
<header><h1>Outbox</h1><span class="note" style="color:#dfe6ef" id="asof"></span><button id="reload" class="hide">Reload</button><button id="out" class="hide">Sign out</button></header>
<div id="signin" class="card hide">
  <h2>Sign in</h2>
  <label for="code">Sign-in code</label><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <div class="row" style="margin-top:10px"><button class="main" id="go">Sign in</button><span class="note" id="sinote"></span></div>
</div>
<main id="app" class="hide">
  <div id="flash"></div>
  <section class="card"><h2>Today</h2><div class="tiles" id="tiles"></div><ul class="att" id="att"></ul></section>
  <div class="tabs" role="tablist" id="tabs"></div>
  <section id="sec"></section>
</main>
<div id="ed" class="hide" role="dialog" aria-modal="true" aria-label="Change the words"></div>
<script>
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>t?new Date(t*1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'never';
const Q=new URLSearchParams(location.search);
const TABS=[['peak','Peak'],['sixfold','Sixfold'],['traverse','Traverse'],['texts','Texts']];
let V=null, tab=(TABS.some(t=>t[0]===Q.get('tab'))?Q.get('tab'):null)||(()=>{try{return localStorage.getItem('outbox.tab')}catch(e){return null}})()||'peak', peakFrame=null;
async function api(action,body){
  const o=body===undefined?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-OB':'1'},body:JSON.stringify(body)};
  const r=await fetch('api.php?action='+action,o); let j={}; try{j=await r.json()}catch(e){j={ok:false,error:r.status===202?'The server did not answer (status 202: the host sometimes turns away requests from this network). Try again from another connection.':'The server did not answer properly.'}}
  if(j.signin){show(false);throw new Error('signin')}
  if(!j.ok){const er=new Error(j.error||'Something went wrong.');er.errors=j.errors||null;throw er} return j;
}
function show(on){$('#signin').classList.toggle('hide',on);$('#app').classList.toggle('hide',!on);$('#out').classList.toggle('hide',!on);$('#reload').classList.toggle('hide',!on)}
function flash(t){$('#flash').innerHTML=t?'<div class="flash">'+t+'</div>':''}
async function load(){try{V=await api('state');show(true);flash('');draw()}catch(e){if(e.message!=='signin')flash(esc(e.message))}}
$('#go').onclick=async()=>{$('#sinote').textContent='';try{await api('signin',{code:$('#code').value});$('#code').value='';load()}catch(e){$('#sinote').textContent=e.message}};
$('#code').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};
$('#out').onclick=async()=>{try{await api('signout',{})}catch(e){}peakFrame=null;show(false)};
$('#reload').onclick=()=>{load();if(peakFrame&&tab==='peak')try{peakFrame.contentWindow.location.reload()}catch(e){}};
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.outbox==='signin')show(false)});

const sum=o=>o.peak+o.sixfold+o.traverse, split=o=>'Peak '+o.peak+' · Sixfold '+o.sixfold+' · Traverse '+o.traverse;
function drawTop(){
  const s=V.summary, bad=s.attention.filter(a=>a.level==='bad').length;
  $('#asof').textContent='as of '+when(V.now);
  $('#tiles').innerHTML=[['Sent today',sum(s.sent),split(s.sent),''],['Waiting to send',sum(s.waiting),split(s.waiting)+(s.waitingPaused?' (+'+s.waitingPaused+' on paused Peak lists)':''),''],
    ['Failed today',sum(s.failed),split(s.failed),sum(s.failed)?'bad':''],['Needs attention',bad,s.attention.length-bad+' more to know',bad?'bad':'']]
    .map(t=>'<div class="tile '+t[3]+'"><b>'+t[1]+'</b><span>'+t[0]+'</span><small>'+esc(t[2])+'</small></div>').join('');
  $('#att').innerHTML=s.attention.map(a=>'<li class="'+a.level+'">'+esc(a.text)+'</li>').join('')||'<li class="info">Nothing needs you right now.</li>';
  const cnt={peak:V.peak.today||0,sixfold:V.sixfold.items.reduce((a,i)=>a+i.today,0),traverse:V.traverse.items.reduce((a,i)=>a+i.today,0)};
  $('#tabs').innerHTML=TABS.map(t=>'<button role="tab" data-tab="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+(cnt[t[0]]?'<span class="n">'+cnt[t[0]]+' today</span>':'')+'</button>').join('');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;try{localStorage.setItem('outbox.tab',tab)}catch(e){}draw()});
}
function pill(it){const c=it.on===true?'on':it.on===false?'off':'mid';return '<span class="pill '+c+'">'+(it.on===true?'On':it.on===false?'Off':'Check')+'</span>'}
function card(it){
  let h='<section class="card"><h2>'+esc(it.name)+' '+pill(it)+'</h2><div class="note">'+esc(it.state)+'</div>';
  h+='<div class="nums">'+[['today',it.today],['last 7 days',it.d7],['last 30 days',it.d30],['waiting',it.waiting]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
  h+='<dl><dt>What</dt><dd>'+esc(it.what)+'</dd><dt>Who gets it</dt><dd>'+esc(it.who)+'</dd><dt>Sent when</dt><dd>'+esc(it.trigger)+'</dd><dt>Last sent</dt><dd>'+when(it.last)+'</dd><dt>Opens</dt><dd>'+esc(it.opens)+'</dd><dt>Clicks</dt><dd>'+esc(it.clicks)+'</dd></dl>';
  if(it.note)h+='<div class="note">'+esc(it.note)+'</div>';
  if(it.skipped30)h+='<div class="note">'+it.skipped30+' not sent in 30 days (no email on file or unsubscribed).</div>';
  if(it.fails.length)h+='<div class="fails"><b>Failed: '+it.failToday+' today, '+it.fail7+' in 7 days, '+it.fail30+' in 30 days</b><br>'+it.fails.map(f=>esc(when(f.at)+': '+f.why)).join('<br>')+'</div>';
  if(it.track)h+=trackHtml(it);
  if(it.editable)h+='<div class="row" style="margin-top:8px"><button data-ed="'+esc(it.id)+'">Change the words</button><span class="note">Opens the wording, a preview and the saved versions.</span></div>';
  h+='<details><summary>Where it is turned on or off</summary><p class="note">'+esc(it.switch)+'</p></details>';
  return h+'</section>';
}
const pc=x=>x===null||x===undefined?'-':x+'%', yn=b=>b?'<span class="yes">yes</span>':'<span class="no">no</span>';
function trackHtml(it){
  const t=it.track; if(!t.sentAll)return '<div class="trk note">Opens and clicks are counted from the next '+esc(it.name.toLowerCase())+' sent. Nothing counted yet.</div>';
  let h='<div class="trk"><div class="nums">'+[['sent, 7 days',t.sent7],['sent, 30 days',t.sent30],['opened, 30 days',t.opened30+(t.sent30?' ('+pc(t.openRate30)+')':'')],['clicked, 30 days',t.clicked30+(t.sent30?' ('+pc(t.clickRate30)+')':'')]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
  h+='<p class="note tiny">Opened may include Apple Mail\'s automatic opens (it loads every email as it arrives), so read opens as high. Clicks are the reliable number.</p>';
  if(t.links30.length)h+='<p class="note">Links clicked, 30 days: '+t.links30.map(l=>esc(l.what)+' '+l.clicks).join(' · ')+'</p>';
  const vh=it.id==='newsletter'?'Issue':'Wording';
  h+='<details'+(t.byVersion.length>1?' open':'')+'><summary>By '+vh.toLowerCase()+' ('+t.byVersion.length+')</summary><table class="t"><tr><th>'+vh+'</th><th>Sent</th><th>Opened</th><th>Clicked</th></tr>'
    +t.byVersion.map(b=>'<tr><td>'+esc(b.label)+(b.active?'<span class="tag">in use</span>':'')+'<br><span class="note tiny">'+esc(when(b.first))+(b.last!==b.first?' to '+esc(when(b.last)):'')+'</span></td><td>'+b.sent+'</td><td>'+b.opened+' ('+pc(b.openRate)+')</td><td>'+b.clicked+' ('+pc(b.clickRate)+')</td></tr>').join('')+'</table></details>';
  h+='<details><summary>Last '+t.recent.length+' sent</summary><table class="t"><tr><th>Sent</th><th>'+vh+'</th><th>Opened</th><th>Clicked</th></tr>'
    +t.recent.map(r=>'<tr><td>'+esc(when(r.at))+'</td><td>'+esc(r.v)+'</td><td>'+yn(r.opened)+'</td><td>'+yn(r.clicked)+'</td></tr>').join('')+'</table><p class="note tiny">No names here on purpose: each row is one email to one customer.</p></details>';
  return h+'</div>';
}
function drawPeak(){
  const P=V.peak, R=P.redirect||{};
  let h='<div class="lead">Peak Pickleball: your outreach emails from your Peak Outlook. Everything here works as it did on its own page: lists, the email, preview, Start and Pause, settings, Connect Microsoft and the numbers.</div>';
  if(P.ready){
    h+='<div class="nums" style="margin:12px 0">'+[['sent today',P.today],['last 7 days',P.d7],['last 30 days',P.d30],['clicks, 30 days',P.clicks30]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
    h+=(P.lists||[]).map(l=>{const r=l.rates||{};return '<p class="note"><b>'+esc(l.name)+'</b> ('+esc(l.status)+'): '+l.people+' people at '+l.orgs+' organisations, '+l.queued+' waiting, '+l.sent+' sent'
      +(l.sent?'. Opened '+r.open+'%, clicked '+r.click+'%, replied '+r.reply+'%, booked '+r.booked+'%, bounced '+r.bounce+'%':'')+'.'
      +(l.skips&&l.skips.length?' Skipped: '+l.skips.map(x=>esc(x[0])+', '+x[1]).join(' · ')+'.':'')+'</p>'}).join('');
    const TC=P.tours||{open:[]};
    h+='<p class="note" data-tours><b>Tour confirmations</b> (from the Peak desk; '+(TC.on?'on':'off until you approve the wording in the desk, More, Settings')+'): '+TC.today+' today, '+TC.d7+' in 7 days, '+TC.d30+' in 30 days'+(TC.tests?' (plus '+TC.tests+' test'+(TC.tests===1?'':'s')+')':'')+'. No open image and no tracked links on these.'
      +(TC.open.length?' <b>Not sent: '+TC.open.length+'</b>. '+TC.open.map(x=>esc((x.method==='CANCEL'?'Cancellation, ':'')+x.company+' ('+x.to+'), '+when(x.at)+': '+x.why)).join(' · ')+'. <a href="'+esc(TC.desk)+'" target="_blank" rel="noopener">Retry on the Peak desk</a>.':'')+'</p>';
    h+='<p class="note">Opens are counted with a 1x1 image and are rough: Apple Mail loads it as the email arrives (high), Outlook often blocks it (low). Every link is tracked. Last hourly run: '+esc(P.lastRun||'none yet')+'.</p>';
  }
  h+='<iframe id="pf" title="Peak email" src="peak/?embed=1'+(Q.get('ms')?'&ms='+encodeURIComponent(Q.get('ms')):'')+'"></iframe>';
  h+='<section class="card" style="margin-top:14px"><h2>Where Microsoft comes back to</h2><p class="note">After Connect Microsoft, Microsoft returns to <code>'+esc(R.now)+'</code>, which forwards here. To have it come straight back to Outbox, add <code>'+esc(R.new)+'</code> as a redirect URI in Entra (App registrations, Matthew outreach, Authentication), then switch below. The old one keeps working either way.</p>'
   +'<div class="row"><button data-ret="old"'+(R.choice==='old'?' class="main"':'')+'>The old address (registered)</button><button data-ret="outbox"'+(R.choice==='outbox'?' class="main"':'')+'>Outbox directly (add it in Entra first)</button></div></section>';
  $('#sec').innerHTML=h;
  peakFrame=$('#pf'); const fit=()=>{try{const d=peakFrame.contentDocument;if(d&&d.documentElement)peakFrame.style.height=Math.max(600,(d.body?d.body.scrollHeight:d.documentElement.scrollHeight)+8)+'px'}catch(e){}};
  peakFrame.addEventListener('load',()=>{fit();try{new ResizeObserver(fit).observe(peakFrame.contentDocument.body)}catch(e){setInterval(fit,1500)}});
  document.querySelectorAll('[data-ret]').forEach(b=>b.onclick=async()=>{const to=b.dataset.ret;if(to==='outbox'&&!confirm('Only switch once '+R.new+' is added in Entra. If it is not, Microsoft will refuse the sign-in. Switch?'))return;try{await api('peakreturn',{to});load()}catch(e){flash(esc(e.message))}});
}
function drawBiz(B,lead){
  let h='<div class="lead">'+lead+'</div>';
  if(B.bounceScan)h+='<p class="note">Bounce check, last run: '+esc(B.bounceScan)+'</p>';
  h+='<div class="grid" style="margin-top:14px">'+B.items.map(card).join('')+'</div>';
  $('#sec').innerHTML=h;
  document.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>edOpen(b.dataset.ed));
}
function draw(){
  drawTop();
  if(tab==='peak'){if(!peakFrame||!document.body.contains(peakFrame))drawPeak();else drawPeakTop()}
  else{peakFrame=null;
    if(tab==='sixfold')drawBiz(V.sixfold,'Sixfold 365 (Brandon\'s company, run by Jen). These come from the Sixfold app, and nothing here turns one on or off or changes who gets it. <b>One thing you can change here:</b> the words of the four customer emails (Change the words), which go to Jen\'s customers. Opens and clicks of the customer emails are counted from 18 Nov 2026.');
    else if(tab==='traverse')drawBiz(V.traverse,'Traverse (yours): the Prospect Desk, the website, sign-ups and the client apps. <b>Read only</b> in this version.');
    else $('#sec').innerHTML='<section class="card"><h2>Texts</h2><p class="note">'+esc(V.texts.note)+'</p></section>';}
}
/* the words of Sixfold's customer emails (2026-11-18): the lines, a preview with a made-up customer, Save, the versions and Put this back.
   The Sixfold app checks and keeps them; this only shows and sends them. */
let W=null, edK=null, edLines={}, edSample='a';
const WHERE={subject:'Subject',email:'In the email',button:'Button',text:'Plain-text copy only'};
async function edOpen(k){
  try{W=await api('sxwords')}catch(e){if(e.message!=='signin')flash(esc(e.message));return}
  const K=W.kinds&&W.kinds[k]; if(!K){flash('That email cannot be changed here.');return}
  edK=k; edLines=Object.assign({},K.now); edSample=Object.keys(K.samples)[0]||'a';
  $('#ed').classList.remove('hide'); document.body.style.overflow='hidden'; edDraw(); edPreview();
}
function edClose(){$('#ed').classList.add('hide');$('#ed').innerHTML='';document.body.style.overflow='';edK=null}
function edDraw(){
  const K=W.kinds[edK], it=(V.sixfold.items.find(i=>i.id===edK)||{}), t=it.track||{byVersion:[]};
  let h='<div class="box"><div class="row" style="justify-content:space-between"><h2 style="margin:0">'+esc(K.name)+': the words</h2><button id="edx">Close</button></div>';
  h+='<div class="warn"><b>Jen runs Sixfold: these words go to Jen\'s customers.</b> A save changes every '+esc(K.name.toLowerCase())+' from the next one on: the automatic ones and the ones Jen sends from her app. Nothing is sent now. Each save is logged as "Matthew (Outbox)", and any earlier wording can be put back. Let Jen know when you change one.</div>';
  h+='<p class="note">Fields in {curly brackets} are filled in for each customer: keep them as they are. Words in [square brackets] become the link. Lines marked "Plain-text copy only" are in the plain version a few mail apps show instead of the designed one. The boxes, buttons, the balance and the agreement itself stay as they are; only the words change.</p>';
  h+='<div class="edgrid"><div>';
  for(const [key,L] of Object.entries(K.lines)){
    const v=edLines[key]??L.def;
    h+='<div class="ln" data-lnbox="'+key+'"><label for="ln-'+key+'">'+esc(L.label)+'<span class="w">'+esc(WHERE[L.where]||L.where)+'</span></label>'
      +'<textarea id="ln-'+key+'" data-ln="'+key+'" rows="'+Math.min(4,Math.max(1,Math.ceil(v.length/55)))+'"'+(v!==K.now[key]?' class="chg"':'')+'>'+esc(v)+'</textarea>'
      +(L.when?'<div class="chips">'+esc(L.when)+'</div>':'')
      +(L.fields.length?'<div class="chips">Can use: '+L.fields.map(f=>'<code title="'+esc(W.fields[f]||'')+'">{'+f+'}</code>').join(' ')+(L.need.length?' · must keep '+L.need.map(f=>'<code>{'+f+'}</code>').join(' '):'')+'</div>':'')
      +(L.link?'<div class="chips">Must keep one pair of [square brackets]: the words that become the link.</div>':'')
      +'<div class="chips" data-defbox="'+key+'"'+(v===L.def?' style="display:none"':'')+'>Built-in: '+esc(L.def)+' <button data-def="'+key+'" style="min-height:0;padding:2px 8px;font-size:12px">Use the built-in words</button></div>'
      +'<div class="err" data-err="'+key+'"></div></div>';
  }
  h+='</div><div><div class="row"><b>Preview</b>'+Object.entries(K.samples).map(([s,l])=>'<button data-smp="'+s+'"'+(s===edSample?' class="main"':'')+'>'+esc(l)+'</button>').join('')+'<button id="edpv">Update the preview</button></div>'
    +'<p class="note" id="edsubj"></p><iframe class="pv" id="edfr" sandbox="" title="Preview"></iframe><details><summary>Plain-text copy</summary><pre id="edtxt" style="white-space:pre-wrap;font-size:12px"></pre></details>'
    +'<p class="note tiny">A made-up customer, Alex Sample. A preview\'s links are the plain ones; a real email counts opens and clicks.</p>'
    +'<label for="ednote">What changed (optional, kept with the version)</label><input id="ednote" maxlength="200">'
    +'<div class="row" style="margin-top:10px"><button class="main" id="edsave">Save for Jen\'s customers</button><span class="note" id="edmsg"></span></div></div></div>';
  const stat=v=>(t.byVersion||[]).find(b=>b.v===v);
  const vs=[{v:'v0',at:0,by:'',note:'The words this email has always had.'}].concat(K.versions.slice().reverse());
  h+='<h3 style="margin:18px 0 4px;font-size:15px">Versions: compare how each did</h3><table class="t"><tr><th>Version</th><th>Saved</th><th>Sent</th><th>Opened</th><th>Clicked</th><th></th></tr>'
    +vs.map(x=>{const s=stat(x.v);return '<tr><td>'+(x.v==='v0'?'Built-in words':'Version '+esc(x.v.slice(1)))+(K.active===x.v?'<span class="tag">in use</span>':'')+(x.note?'<br><span class="note tiny">'+esc(x.note)+'</span>':'')+'</td><td>'+(x.at?esc(when(x.at))+(x.by?'<br><span class="note tiny">'+esc(x.by)+'</span>':''):'-')+'</td><td>'+(s?s.sent:0)+'</td><td>'+(s?s.opened+' ('+pc(s.openRate)+')':'-')+'</td><td>'+(s?s.clicked+' ('+pc(s.clickRate)+')':'-')+'</td><td>'+(K.active===x.v?'':'<button data-rv="'+esc(x.v)+'">Put this back</button>')+'</td></tr>'}).join('')+'</table>'
    +'<p class="note tiny">Opened may include Apple Mail\'s automatic opens. Clicks are the number to compare. Give a wording a few weeks of sends before judging it.</p>';
  const lg=(W.log||[]).filter(r=>r.kind===edK).slice(-10).reverse();
  if(lg.length)h+='<details><summary>Changes ('+lg.length+')</summary><p class="note">'+lg.map(r=>esc(when(r.at)+': '+r.by+' '+r.what+' '+(r.v==='v0'?'the built-in words':'version '+String(r.v).slice(1)))).join('<br>')+'</p></details>';
  $('#ed').innerHTML=h+'</div>';
  $('#edx').onclick=edClose;
  document.querySelectorAll('[data-ln]').forEach(a=>a.oninput=()=>{const k=a.dataset.ln;edLines[k]=a.value;a.classList.toggle('chg',a.value!==K.now[k]);const d=document.querySelector('[data-defbox="'+k+'"]');if(d)d.style.display=a.value===K.lines[k].def?'none':''});
  document.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{const k=b.dataset.def,a=$('#ln-'+k);a.value=K.lines[k].def;a.oninput();edPreview()});
  document.querySelectorAll('[data-smp]').forEach(b=>b.onclick=()=>{edSample=b.dataset.smp;document.querySelectorAll('[data-smp]').forEach(x=>x.classList.toggle('main',x===b));edPreview()});
  $('#edpv').onclick=edPreview; $('#edsave').onclick=edSave;
  document.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>edRestore(b.dataset.rv));
}
function edErrs(errs){document.querySelectorAll('[data-err]').forEach(d=>{d.textContent=(errs&&errs[d.dataset.err])||''})}
async function edPreview(){
  const k=edK;
  try{const r=await api('sxpreview',{kind:k,lines:edLines,sample:edSample}); if(k!==edK)return;
    edErrs(r.errors); $('#edsubj').innerHTML='<b>Subject:</b> '+esc(r.subject); $('#edfr').srcdoc=r.html; $('#edtxt').textContent=r.text;
    $('#edmsg').textContent=r.errors&&Object.keys(r.errors).length?'Lines in red need fixing; the preview uses the words in use for those.':'';
  }catch(e){if(e.message!=='signin')$('#edmsg').textContent=e.message}
}
async function edSave(){
  const K=W.kinds[edK];
  if(!confirm('Save these words for the '+K.name.toLowerCase()+'?\n\nJen\'s customers get them from the next one sent. The save is logged, and you can put the old words back any time.'))return;
  try{const r=await api('sxsave',{kind:edK,lines:edLines,note:$('#ednote').value}); await edReload('Saved. Version '+r.active.slice(1)+' is in use from the next email.')}
  catch(e){if(e.message==='signin')return; edErrs(e.errors); $('#edmsg').textContent=e.message}
}
async function edRestore(v){
  const K=W.kinds[edK];
  if(!confirm('Put back '+(v==='v0'?'the built-in words':'version '+v.slice(1))+' for the '+K.name.toLowerCase()+'?\n\nJen\'s customers get those words from the next one sent. This is logged.'))return;
  try{await api('sxrestore',{kind:edK,v}); await edReload((v==='v0'?'The built-in words are':'Version '+v.slice(1)+' is')+' in use again from the next email.')}
  catch(e){if(e.message!=='signin')$('#edmsg').textContent=e.message}
}
async function edReload(msg){
  const k=edK; W=await api('sxwords'); try{V=await api('state');draw()}catch(e){}
  edK=k; edLines=Object.assign({},W.kinds[k].now); edDraw(); await edPreview(); $('#edmsg').textContent=msg;
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&edK)edClose()});
function drawPeakTop(){const n=$('#sec .nums');if(n&&V.peak.ready)n.innerHTML=[['sent today',V.peak.today],['last 7 days',V.peak.d7],['last 30 days',V.peak.d30],['clicks, 30 days',V.peak.clicks30]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')}
load(); setInterval(()=>{if(!document.hidden&&V)load()},5*60*1000);
</script>
</body>
</html>

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
  if(!j.ok)throw new Error(j.error||'Something went wrong.'); return j;
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
  h+='<details><summary>Where it is turned on or off</summary><p class="note">'+esc(it.switch)+'</p></details>';
  return h+'</section>';
}
function drawPeak(){
  const P=V.peak, R=P.redirect||{};
  let h='<div class="lead">Peak Pickleball: your outreach emails from your Peak Outlook. Everything here works as it did on its own page: lists, the email, preview, Start and Pause, settings, Connect Microsoft and the numbers.</div>';
  if(P.ready){
    h+='<div class="nums" style="margin:12px 0">'+[['sent today',P.today],['last 7 days',P.d7],['last 30 days',P.d30],['clicks, 30 days',P.clicks30]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
    h+=(P.lists||[]).map(l=>{const r=l.rates||{};return '<p class="note"><b>'+esc(l.name)+'</b> ('+esc(l.status)+'): '+l.people+' people at '+l.orgs+' organisations, '+l.queued+' waiting, '+l.sent+' sent'
      +(l.sent?'. Opened '+r.open+'%, clicked '+r.click+'%, replied '+r.reply+'%, booked '+r.booked+'%, bounced '+r.bounce+'%':'')+'.'
      +(l.skips&&l.skips.length?' Skipped: '+l.skips.map(x=>esc(x[0])+', '+x[1]).join(' · ')+'.':'')+'</p>'}).join('');
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
}
function draw(){
  drawTop();
  if(tab==='peak'){if(!peakFrame||!document.body.contains(peakFrame))drawPeak();else drawPeakTop()}
  else{peakFrame=null;
    if(tab==='sixfold')drawBiz(V.sixfold,'Sixfold 365 (Brandon\'s company, run by Jen). <b>Read only:</b> these come from the Sixfold app, and nothing here changes them. Any change there needs your go.');
    else if(tab==='traverse')drawBiz(V.traverse,'Traverse (yours): the Prospect Desk, the website, sign-ups and the client apps. <b>Read only</b> in this version.');
    else $('#sec').innerHTML='<section class="card"><h2>Texts</h2><p class="note">'+esc(V.texts.note)+'</p></section>';}
}
function drawPeakTop(){const n=$('#sec .nums');if(n&&V.peak.ready)n.innerHTML=[['sent today',V.peak.today],['last 7 days',V.peak.d7],['last 30 days',V.peak.d30],['clicks, 30 days',V.peak.clicks30]].map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')}
load(); setInterval(()=>{if(!document.hidden&&V)load()},5*60*1000);
</script>
</body>
</html>

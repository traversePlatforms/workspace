<?php
/* The Peak email admin page (served through PHP so the host's front server never keeps an old copy). */
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer'); header('X-Frame-Options: SAMEORIGIN');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Peak email</title>
<script>try{var t=localStorage.getItem('sixfold.theme');if(t)document.documentElement.dataset.theme=t}catch(e){}if(/[?&]embed=1/.test(location.search))document.documentElement.classList.add('embed')</script>
<style>
:root{--bg:#f3f6f4;--card:#fff;--ink:#14231d;--soft:#5b6b64;--line:#dbe4df;--brand:#1f5b46;--brand2:#e8f1ec;--warn:#9a5b00;--warnbg:#fff4e0;--bad:#a12a2a;--badbg:#fdeaea;--ok:#1f6b3a;--okbg:#e5f4ea}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1714;--card:#17221e;--ink:#e4ece8;--soft:#9aaba3;--line:#2a3833;--brand:#5fb08f;--brand2:#1d2e27;--warn:#f0b35a;--warnbg:#2c2414;--bad:#f08a8a;--badbg:#2e1818;--ok:#7fd29b;--okbg:#16281d}}
:root[data-theme="dark"]{--bg:#0f1714;--card:#17221e;--ink:#e4ece8;--soft:#9aaba3;--line:#2a3833;--brand:#5fb08f;--brand2:#1d2e27;--warn:#f0b35a;--warnbg:#2c2414;--bad:#f08a8a;--badbg:#2e1818;--ok:#7fd29b;--okbg:#16281d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
header{background:#1f5b46;color:#fff;padding:12px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
header h1{font-size:18px;margin:0;flex:1}header .who{font-size:13px;opacity:.9}
main{max-width:1180px;margin:0 auto;padding:16px;display:grid;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card h2{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:860px){.two{grid-template-columns:1fr}}
button{font:600 14px system-ui,sans-serif;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 13px;cursor:pointer}
button.main{background:var(--brand);border-color:var(--brand);color:#fff}button.stop{background:var(--bad);border-color:var(--bad);color:#fff}
button:disabled{opacity:.45;cursor:not-allowed}
input,textarea,select{font:14px system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 9px;width:100%}
textarea{min-height:190px;font-family:ui-monospace,Consolas,monospace;font-size:13px}
label{display:block;font-size:13px;color:var(--soft);margin:8px 0 3px}
.pill{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--brand2);color:var(--brand)}
.pill.running{background:var(--okbg);color:var(--ok)}.pill.paused{background:var(--warnbg);color:var(--warn)}.pill.done{background:var(--brand2);color:var(--brand)}
.counts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
.counts div{background:var(--bg);border-radius:8px;padding:6px 8px}.counts b{display:block;font-size:19px}.counts span{font-size:12px;color:var(--soft)}
.note{font-size:13px;color:var(--soft)}.warn{background:var(--warnbg);color:var(--warn);border-radius:8px;padding:8px 10px;font-size:13px;margin:8px 0}
.bad{background:var(--badbg);color:var(--bad);border-radius:8px;padding:8px 10px;font-size:13px;margin:8px 0}
.good{background:var(--okbg);color:var(--ok);border-radius:8px;padding:8px 10px;font-size:13px;margin:8px 0}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.grow{flex:1}
pre.msg{white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px/1.45 ui-monospace,Consolas,monospace;margin:6px 0 12px;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--soft);font-weight:600}
.tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:6px;background:var(--warnbg);color:var(--warn);margin:1px 2px 1px 0}
.tag.g{background:var(--brand2);color:var(--brand)}
.act{font-size:13px;max-height:280px;overflow:auto}.act div{padding:3px 0;border-bottom:1px dashed var(--line)}.act time{color:var(--soft);margin-right:6px}
details summary{cursor:pointer;font-weight:600;font-size:14px;margin:6px 0}
#signin{max-width:360px;margin:60px auto}.hide{display:none!important}
.days label{display:inline-flex;align-items:center;gap:4px;margin:0 10px 0 0;color:var(--ink)}.days input{width:auto}
.tiny{font-size:12px}
.embed header{display:none}.embed main{padding-top:4px}
</style>
</head>
<body>
<header><h1>Peak outreach email</h1><span class="who" id="who"></span></header>
<div id="signin" class="card hide">
  <h2>Sign in</h2>
  <label for="code">Sign-in code</label><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false">
  <div class="row" style="margin-top:10px"><button class="main" id="go">Sign in</button><span class="note" id="sinote"></span></div>
</div>
<main id="app" class="hide">
  <div id="flash"></div>
  <section class="card" id="ms"></section>
  <div class="two" id="lists"></div>
  <section class="card"><h2>Settings</h2><div id="settings"></div></section>
  <div class="two">
    <section class="card"><h2>Do not email <span class="pill" id="supn"></span></h2><div id="sup"></div></section>
    <section class="card"><h2>Inbox placement check <span class="note">(public DNS, read only)</span></h2><div id="dns"></div></section>
  </div>
  <section class="card"><h2>What happened</h2><div id="runs" class="note"></div><div class="act" id="act"></div></section>
</main>
<script>
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>t?new Date(t*1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
let V=null;
async function api(action,body,get){
  const o=body===undefined?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PM':'1'},body:JSON.stringify(body)};
  const r=await fetch('api.php?action='+action+(get||''),o); let j={}; try{j=await r.json()}catch(e){j={ok:false,error:'The server did not answer properly.'}}
  if(j.signin&&j.outbox){flash('Sign in on the Outbox page first.','warn');try{parent.postMessage({outbox:'signin'},location.origin)}catch(e){}throw new Error('signin')}
  if(j.signin){show(false);throw new Error('signin')}
  if(!j.ok)throw new Error(j.error||'Something went wrong.'); return j;
}
function flash(t,cls){$('#flash').innerHTML=t?'<div class="'+(cls||'good')+'">'+t+'</div>':'';if(t)window.scrollTo({top:0,behavior:'smooth'})}
function show(on){$('#signin').classList.toggle('hide',on);$('#app').classList.toggle('hide',!on)}
async function load(){try{V=await api('state');show(true);draw()}catch(e){if(e.message!=='signin')flash(esc(e.message),'bad')}}
$('#go').onclick=async()=>{$('#sinote').textContent='';try{await api('signin',{code:$('#code').value});$('#code').value='';load()}catch(e){$('#sinote').textContent=e.message}};
$('#code').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};

function drawMs(){
  const c=V.conn, o=V.oauth, q=new URLSearchParams(location.search).get('ms');
  let h='<h2>Microsoft (Matthew\'s Peak Outlook)</h2>';
  if(!c.app)h+='<div class="bad">The Microsoft app keys are not on the server yet.</div>';
  if(c.connected)h+='<div class="good">Connected: <b>'+esc(c.name)+'</b> &lt;'+esc(c.email)+'&gt; since '+when(c.since)+'. Emails go out from this mailbox and land in its Sent Items.</div>'+(/@peakpickleball\.us$/i.test(c.email)?'':'<div class="warn">This mailbox is not a peakpickleball.us address. Check it is the right one before starting.</div>');
  else if(c.status==='reconnect')h+='<div class="bad">The sign-in for '+esc(c.email)+' stopped working ('+esc(c.why)+'). Nothing sends until you reconnect.</div>';
  else h+='<p class="note">Not connected. Press Connect Microsoft and sign in with your Peak Pickleball account. Microsoft will ask you to allow "Matthew outreach" to read and send mail as you: the page then reads replies and bounce notices only, and never moves, marks or deletes anything.</p>';
  if(o&&o.kind==='admin'||q==='admin')h+='<div class="bad"><b>Microsoft says Peak\'s admin has to approve this app first.</b><br>'+esc(V.adminHelp)+'</div>';
  else if(o&&q&&o.kind!=='connected')h+='<div class="warn">'+esc(o.msg)+'</div>';
  else if(q==='connected'&&c.connected)h+='<div class="good">Microsoft connected.</div>';
  if(!c.connected)h+='<p class="note tiny">If Microsoft shows <b>Need admin approval</b>: you are not a Peak admin, so the app needs Peak\'s Global admin to approve it once. '+esc(V.adminHelp)+'</p>';
  h+='<div class="row"><button class="main" id="conn"'+(c.app?'':' disabled')+'>'+(c.connected?'Reconnect Microsoft':c.status==='reconnect'?'Reconnect Microsoft':'Connect Microsoft')+'</button>'+(c.email?'<button id="disc">Disconnect</button>':'')+'</div>';
  $('#ms').innerHTML=h; $('#who').textContent=c.connected?'Sending from '+c.email:'Not connected';
  /* Microsoft's sign-in page will not open inside a frame (Outbox, the hub): there it opens in a new tab and comes back to Outbox */
  $('#conn').onclick=async()=>{try{const j=await api('connect',{});if(window.top!==window){window.open(j.url,'_blank');flash('Finish the Microsoft sign-in in the new tab. It comes back to Outbox when it is done; then press Reload here.','warn')}else location.href=j.url}catch(e){flash(esc(e.message),'bad')}};
  if($('#disc'))$('#disc').onclick=async()=>{if(!confirm('Disconnect Microsoft? Running lists pause.'))return;try{const j=await api('disconnect',{});flash(esc(j.note),'warn');load()}catch(e){flash(esc(e.message),'bad')}};
}
function listCard(k,L){
  const st=L.status, n=x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>';
  let h='<section class="card"><h2>'+esc(L.name)+' <span class="pill '+st+'">'+({running:'Sending',paused:'Paused',done:'Done'}[st]||st)+'</span>'+(L.draft?'<span class="tag">template is a DRAFT</span>':'')+'</h2>';
  h+='<div class="counts">'+[['waiting',L.queued],['sent',L.sent],['opened',L.opened],['clicked',L.clicked],['replied',L.replied],['booked',L.booked],['bounced',L.bounced],['unsubscribed',L.unsubscribed],['auto-replies',L.auto],['could not send',L.failed]].map(n).join('')+'</div>';
  const R=L.rates||{};h+='<p class="note">Of the emails sent: <b>'+R.open+'%</b> opened, <b>'+R.click+'%</b> clicked, <b>'+R.reply+'%</b> replied, <b>'+R.booked+'%</b> booked a time, <b>'+R.bounce+'%</b> bounced. Opens are rough: Apple Mail loads the image as the email arrives, so opens run high; Outlook and many work mailboxes block images, so they also run low. Clicks, replies and bookings are the surer signs.</p>';
  if(L.skips&&L.skips.length)h+='<p class="note">Skipped on the desk: '+L.skips.map(x=>esc(x[0])+', '+x[1]).join(' · ')+'.</p>';
  if(L.deskError)h+='<div class="bad">'+esc(L.deskError)+'</div>';
  if(L.deskPending)h+='<div class="warn">'+L.deskPending+' updates have not reached the Peak desk yet. The next hourly run tries again; nothing is sent twice.</div>';
  h+='<p class="note">'+L.people+' people at '+L.orgs+' organisations on the list ('+L.generic+' shared inboxes like info@, '+L.guessed+' guessed addresses), '+L.held+' more held back (another contact at the same organisation, or an address that cannot be used), '+L.left+' desk organisations left out.</p>';
  if(st==='paused'&&L.pausedWhy)h+='<div class="warn">Paused: '+esc(L.pausedWhy)+'</div>';
  if(st==='running')h+='<div class="good">Sending '+(V.rampToday?'at most '+Math.min(V.settings.rate,V.rampMax)+' an hour today (first day)':V.settings.rate+' an hour')+', '+esc(V.window)+(V.inWindow?'':' (outside the window now)')+'. Started by '+esc(L.by)+' '+when(L.started)+'.</div>';
  if(st!=='running'&&L.blocks.length)h+='<div class="bad"><b>Start is blocked:</b><br>'+L.blocks.map(esc).join('<br>')+'</div>';
  h+='<div class="row">'+(st==='running'?'<button class="stop" data-pause="'+k+'">Pause</button>':'<button class="main" data-start="'+k+'"'+(L.blocks.length?' disabled':'')+'>Start sending</button>')+'<button data-prev="'+k+'">Preview the next 3</button><button data-people="'+k+'">Who is on it</button></div>';
  h+='<div id="prev-'+k+'"></div><div id="people-'+k+'"></div>';
  h+='<details'+(L.draft?' open':'')+'><summary>The email</summary><label>Subject</label><input id="sub-'+k+'" value="'+esc(L.template.subject)+'"><label>Email (merge fields: {first} {company} {town}, and {book} for the book-a-time link; every web address is tracked; your signature, Peak\'s address and the unsubscribe line are added under it)</label><textarea id="body-'+k+'">'+esc(L.template.body)+'</textarea><div class="row" style="margin-top:8px"><button class="main" data-save="'+k+'">Save the email</button><span class="note tiny">Saving pauses the list if it is sending.</span></div></details>';
  return h+'</section>';
}
function drawLists(){
  $('#lists').innerHTML=Object.keys(V.lists).map(k=>listCard(k,V.lists[k])).join('')+'<div class="note" style="grid-column:1/-1">'+(V.imported?'Lists brought in from the Peak desk '+when(V.imported)+'. ':'Lists not brought in yet. ')+'<button id="imp">Bring the lists in from the Peak desk again</button> Each hour the run also checks the desk, and checks each company again just before its email: anyone the desk moves on (Called, Tour booked, removed ...), owns, or touched in the last 14 days is skipped.</div>';
  document.querySelectorAll('[data-start]').forEach(b=>b.onclick=async()=>{const k=b.dataset.start,L=V.lists[k];
    if(!confirm('Start sending "'+L.name+'" from '+V.conn.email+'?\n\n'+L.queued+' people, '+(V.rampToday?'at most '+Math.min(V.settings.rate,V.rampMax)+' an hour today, then ':'')+V.settings.rate+' an hour, '+V.window+'.\n\nSubject: '+L.template.subject))return;
    try{V=await api('start',{list:k});flash(esc(L.name)+' started. The next hourly run sends the first ones.');draw()}catch(e){flash(esc(e.message),'bad')}});
  document.querySelectorAll('[data-pause]').forEach(b=>b.onclick=async()=>{try{V=await api('pause',{list:b.dataset.pause});flash('Paused. Nothing more goes out from this list until you press Start.','warn');draw()}catch(e){flash(esc(e.message),'bad')}});
  document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const k=b.dataset.save;try{V=await api('template',{list:k,subject:$('#sub-'+k).value,body:$('#body-'+k).value});flash('Saved. Check the preview.');draw()}catch(e){flash(esc(e.message),'bad')}});
  document.querySelectorAll('[data-prev]').forEach(b=>b.onclick=async()=>{const k=b.dataset.prev,el=$('#prev-'+k);if(el.innerHTML){el.innerHTML='';return}
    try{const j=await api('preview',undefined,'&list='+k);el.innerHTML=(j.draft?'<div class="warn">This is still the DRAFT placeholder: it cannot be sent.</div>':'')+(j.messages.length?j.messages.map(m=>'<div class="note">To <b>'+esc(m.name?m.name+' <'+m.to+'>':m.to)+'</b> at '+esc(m.company)+' '+m.flags.map(f=>'<span class="tag">'+esc(f)+'</span>').join('')+(m.fallbacks.length?' <span class="tag">no '+esc(m.fallbacks.join(', '))+': fallback used</span>':'')+(m.badph?' <span class="tag">'+esc(m.badph)+' left in</span>':'')+'</div><pre class="msg"><b>'+esc(m.subject)+'</b>\n\n'+esc(m.body)+'</pre>').join(''):'<p class="note">Nobody is waiting on this list.</p>')}catch(e){el.innerHTML='<div class="bad">'+esc(e.message)+'</div>'}});
  document.querySelectorAll('[data-people]').forEach(b=>b.onclick=async()=>{const k=b.dataset.people,el=$('#people-'+k);if(el.innerHTML){el.innerHTML='';return}
    try{const j=await api('people',undefined,'&list='+k);el.innerHTML='<div style="max-height:420px;overflow:auto;margin:8px 0"><table><tr><th>Email</th><th>Who</th><th>Organisation</th><th>Now</th><th>Opens</th><th>Clicks</th></tr>'+j.people.map(p=>'<tr'+(p.on?'':' style="opacity:.6"')+'><td>'+esc(p.to)+' '+p.flags.map(f=>'<span class="tag">'+esc(f)+'</span>').join('')+'</td><td>'+esc(p.person)+(p.role?'<div class="note tiny">'+esc(p.role)+'</div>':'')+'</td><td>'+esc(p.company)+'</td><td>'+esc(p.state)+' '+p.tags.map(t=>'<span class="tag g">'+esc(t)+'</span>').join('')+'</td><td>'+(p.opens?p.opens+'<div class="note tiny">first '+when(p.open1)+(p.opens>1?', last '+when(p.openLast):'')+'</div>':(p.sent?'0':''))+'</td><td>'+(p.clicks||(p.sent?'0':''))+'</td></tr>').join('')+'</table>'+(j.left.length?'<details><summary>'+j.left.length+' desk organisations left out</summary><table>'+j.left.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.why)+'</td></tr>').join('')+'</table></details>':'')+'</div>'}catch(e){el.innerHTML='<div class="bad">'+esc(e.message)+'</div>'}});
  $('#imp').onclick=async()=>{try{const j=await api('import',{});V=j;draw();flash('Brought in: '+Object.entries(j.diff).map(([k,d])=>V.lists[k].name+' '+d.queued+' people ('+d.added+' new)').join(', ')+'.')}catch(e){flash(esc(e.message),'bad')}};
}
function drawSettings(){
  const s=V.settings, d=['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  $('#settings').innerHTML='<div class="two"><div>'
   +'<label>Emails an hour (both lists together, up to '+V.rateMax+')</label><input id="s-rate" type="number" min="1" max="'+V.rateMax+'" value="'+s.rate+'">'
   +'<label><input type="checkbox" id="s-ramp" style="width:auto"'+(s.ramp?' checked':'')+'> First sending day: at most '+V.rampMax+' an hour (warms the mailbox up)</label>'
   +'<label>Sending days</label><div class="days">'+[1,2,3,4,5,6,7].map(i=>'<label><input type="checkbox" data-day="'+i+'"'+(s.days.includes(i)?' checked':'')+'>'+d[i]+'</label>').join('')+'</div>'
   +'<div class="row"><div class="grow"><label>From (hour, Colorado time)</label><input id="s-from" type="number" min="0" max="23" value="'+s.from+'"></div><div class="grow"><label>Until (hour)</label><input id="s-to" type="number" min="1" max="24" value="'+s.to+'"></div></div>'
   +'<label>Days off (one per line, like 2026-11-26)</label><textarea id="s-skip" style="min-height:80px">'+esc(s.skip.join('\n'))+'</textarea>'
   +'</div><div>'
   +'<label>Peak\'s postal address (the law wants it in every email)</label><input id="s-address" value="'+esc(s.address)+'">'
   +'<label>Signature</label><textarea id="s-signature" style="min-height:80px">'+esc(s.signature)+'</textarea>'
   +'<label>People emailed per organisation</label><select id="s-per">'+[1,2,3].map(i=>'<option'+(s.perOrg==i?' selected':'')+'>'+i+'</option>').join('')+'</select>'
   +'<label><input type="checkbox" id="s-notes" style="width:auto"'+(s.deskNotes?' checked':'')+'> Put every send, reply, STOP, bounce and booking on the Peak desk card (as "Peak email")</label>'
   +'<label><input type="checkbox" id="s-dskip" style="width:auto"'+(s.deskSkip?' checked':'')+'> Skip a company someone owns on the desk, or one a person touched in the last 14 days</label>'
   +'<label><input type="checkbox" id="s-opens" style="width:auto"'+(s.opens?' checked':'')+'> Count opens (each email also goes as HTML with a 1x1 image; slightly worse for landing in the inbox)</label>'
   +'</div></div><h3 style="margin:16px 0 4px">Book a time</h3><p class="note">Put {book} in an email for a link to a page where they pick a time from these hours. It goes on the Peak desk as a tour and you get a heads-up email. Nobody\x27s calendar is read: keep these hours free. '+(V.book.open?V.book.open+' open times now'+(V.book.next.length?', the first '+esc(V.book.next[0].join(' ')):'')+'.':'No open times now.')+'</p><div class="two"><div>'
   +'<label><input type="checkbox" id="b-on" style="width:auto"'+(s.book.on?' checked':'')+'> Booking is on</label>'
   +'<label>What they book</label><select id="b-kind">'+Object.keys(V.book.kinds).map(k=>'<option value="'+k+'"'+(s.book.kind===k?' selected':'')+'>'+esc(V.book.kinds[k])+'</option>').join('')+'</select>'
   +'<div class="row"><div class="grow"><label>Minutes each</label><input id="b-mins" type="number" min="15" max="120" value="'+s.book.mins+'"></div><div class="grow"><label>Days ahead shown</label><input id="b-ahead" type="number" min="1" max="60" value="'+s.book.ahead+'"></div><div class="grow"><label>Notice (hours)</label><input id="b-notice" type="number" min="0" max="168" value="'+s.book.notice+'"></div></div>'
   +'</div><div><label>Weekly hours, Colorado time (one day a line, like Tue 10:00-12:00, 13:00-16:00; the days off above are skipped)</label><textarea id="b-week" style="min-height:90px">'+esc(V.book.week)+'</textarea>'
   +'</div></div><div class="row" style="margin-top:10px"><button class="main" id="s-save">Save settings</button><span class="note">Now: '+esc(V.window)+(V.inWindow?' (inside the window)':' (outside the window)')+'.</span></div>';
  $('#s-save').onclick=async()=>{const days=[...document.querySelectorAll('[data-day]')].filter(x=>x.checked).map(x=>+x.dataset.day);
    try{V=await api('settings',{s:{rate:+$('#s-rate').value,ramp:$('#s-ramp').checked,days,from:+$('#s-from').value,to:+$('#s-to').value,skip:$('#s-skip').value.split(/\s+/).filter(Boolean),address:$('#s-address').value,signature:$('#s-signature').value,perOrg:+$('#s-per').value,deskNotes:$('#s-notes').checked,deskSkip:$('#s-dskip').checked,opens:$('#s-opens').checked,book:{on:$('#b-on').checked,kind:$('#b-kind').value,mins:+$('#b-mins').value,ahead:+$('#b-ahead').value,notice:+$('#b-notice').value,week:$('#b-week').value}}});flash('Settings saved.');draw()}catch(e){flash(esc(e.message),'bad')}};
}
function drawSup(){
  $('#supn').textContent=V.suppressedCount;
  $('#sup').innerHTML='<p class="note">Never emailed: anyone who unsubscribed, replied STOP, bounced, or you add here.</p><div class="row"><input id="sup-a" class="grow" placeholder="name@company.com" style="width:auto"><button id="sup-add">Add</button></div>'
   +(V.suppressed.length?'<div style="max-height:220px;overflow:auto;margin-top:8px"><table>'+V.suppressed.map(x=>'<tr><td>'+esc(x.to)+'</td><td class="note">'+esc(x.why)+'</td><td>'+(x.why.startsWith('added by hand')?'<button class="tiny" data-unsup="'+esc(x.to)+'">Take off</button>':'')+'</td></tr>').join('')+'</table></div>':'');
  $('#sup-add').onclick=async()=>{try{V=await api('suppress',{address:$('#sup-a').value});draw()}catch(e){flash(esc(e.message),'bad')}};
  document.querySelectorAll('[data-unsup]').forEach(b=>b.onclick=async()=>{try{V=await api('unsuppress',{address:b.dataset.unsup});draw()}catch(e){flash(esc(e.message),'bad')}});
}
function drawDns(){
  const d=V.dns; let h='';
  if(d&&d.domain){const ok=x=>x?'<span class="tag g">set</span>':'<span class="tag">missing</span>';
    h+='<table><tr><td>Domain</td><td><b>'+esc(d.domain)+'</b> <span class="note tiny">checked '+when(d.at)+'</span></td></tr><tr><td>SPF</td><td>'+ok(d.spf.length)+' '+esc(d.spf.join(' | '))+'</td></tr><tr><td>DKIM</td><td>selector1 '+ok(d.dkim.selector1)+' selector2 '+ok(d.dkim.selector2)+'</td></tr><tr><td>DMARC</td><td>'+ok(d.dmarc.length)+' '+esc(d.dmarc.join(' | '))+'</td></tr><tr><td>Mail server</td><td>'+esc(d.mx.join(', '))+'</td></tr></table>';
    h+=d.fix.length?'<div class="warn"><b>To fix:</b><br>'+d.fix.map(esc).join('<br>')+'</div>':'<div class="good">SPF, DKIM and DMARC are all published.</div>';}
  h+='<button id="dns-go">Check now</button>';
  $('#dns').innerHTML=h; $('#dns-go').onclick=async()=>{try{V=await api('dns',{});draw()}catch(e){flash(esc(e.message),'bad')}};
}
function draw(){drawMs();drawLists();drawSettings();drawSup();drawDns();
  $('#runs').innerHTML=V.runs.length?'Last hourly runs:<br>'+V.runs.map(esc).join('<br>'):'The hourly run has not run yet.';
  $('#act').innerHTML=V.activity.map(a=>'<div><time>'+when(a.at)+'</time>'+esc(a.what)+'</div>').join('')||'<p class="note">Nothing yet.</p>';}
load();
</script>
</body>
</html>

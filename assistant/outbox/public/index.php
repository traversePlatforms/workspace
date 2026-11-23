<?php
/* Outbox: every email Matthew's tools send by themselves, one section per business (served through PHP so the host's front server never
   keeps an old copy). Peak has its full controls (the Peak sender's own page, framed); Sixfold and Traverse are read only.
   Since 2026-11-23 each section is a list of automatic email streams, laid out like Patch Retention's Automations screens (Matthew finds
   them "a lot easier to understand and navigate"): filters, search, sortable columns, a column chooser and a detail drawer. */
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
main{max-width:1440px;margin:0 auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:14px}main>*{min-width:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.card h2{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
button{font:600 14px system-ui,sans-serif;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 13px;cursor:pointer;min-height:40px}
button.main{background:var(--brand);border-color:var(--brand);color:var(--card)}
input{font:15px system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px 10px;width:100%}
label{display:block;font-size:13px;color:var(--soft);margin:8px 0 3px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}@media(max-width:760px){.tiles{grid-template-columns:repeat(2,1fr)}}
.tile{background:var(--bg);border-radius:10px;padding:10px 12px}.tile b{display:block;font-size:26px;line-height:1.1}.tile span{font-size:13px;color:var(--soft)}.tile small{display:block;font-size:12px;color:var(--soft);margin-top:3px}
.tile.bad b{color:var(--bad)}
.att{margin:12px 0 0;padding:0;list-style:none;font-size:14px}.att li{padding:6px 10px;border-radius:8px;margin:4px 0}.att li.bad{background:var(--badbg);color:var(--bad)}.att li.info{background:var(--offbg);color:var(--soft)}.att li.more{padding:0 2px}
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
/* ---- the list view (2026-11-23) */
:root{--sel:#2b3a4f;--swoff:#c3cad4;--bar:#4f6b8f;--bar2:#dfe5ec;--run:#1f6b3a;--runbg:#e5f4ea;--sch:#2a4f86;--schbg:#e6eefb;--drf:#8a4b00;--drfbg:#fdf0dc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--sel:#9fb3cf;--swoff:#3a4452;--bar:#8fa8c8;--bar2:#2a323e;--run:#7fd29b;--runbg:#16281d;--sch:#9cbcf0;--schbg:#1a2436;--drf:#f0b35a;--drfbg:#2c2414}}
:root[data-theme="dark"]{--sel:#9fb3cf;--swoff:#3a4452;--bar:#8fa8c8;--bar2:#2a323e;--run:#7fd29b;--runbg:#16281d;--sch:#9cbcf0;--schbg:#1a2436;--drf:#f0b35a;--drfbg:#2c2414}
.soft{color:var(--soft)}.cnt{font-size:13px;font-weight:400}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.strip{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:12px}@media(max-width:900px){.strip{grid-template-columns:repeat(4,1fr)}}@media(max-width:520px){.strip{grid-template-columns:repeat(2,1fr)}}
.sc{background:var(--bg);border-radius:10px;padding:8px 10px;min-width:0}.sc span{display:block;font-size:12px;color:var(--soft)}.sc b{display:block;font-size:22px;line-height:1.2}.sc small{display:block;font-size:11px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.list{padding:0}.bar{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-end;padding:12px 14px;border-bottom:1px solid var(--line)}
.f{display:flex;flex-direction:column;gap:2px;margin:0;font-size:12px;color:var(--soft)}.f.grow{flex:1;min-width:160px}
select{font:14px system-ui,sans-serif;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 8px;min-height:40px}
.colw{position:relative}.colp{position:absolute;right:0;top:46px;z-index:20;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:grid;gap:2px;min-width:190px}
.colp label{display:flex;gap:8px;align-items:center;margin:0;color:var(--ink);font-size:14px;padding:3px 0}.colp input{width:auto}
button.tiny{min-height:30px;padding:3px 10px;font-size:12px}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table.lt{border-collapse:separate;border-spacing:0;width:100%;font-size:14px}
.lt th,.lt td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle;white-space:nowrap;background:var(--card)}
.lt thead th{position:sticky;top:0;z-index:2;font-size:12px;color:var(--soft);font-weight:600;background:var(--card)}
.lt th.num,.lt td.num{text-align:right}.lt td small{display:block;font-size:11px;color:var(--soft)}
.lt td[data-c="next"]{white-space:normal;min-width:150px;max-width:200px;font-size:13px}.lt td[data-c="last"]{font-size:13px}
.rol{font-size:11px;color:var(--soft);margin-left:5px;vertical-align:middle}
:root{color-scheme:light}:root[data-theme="dark"]{color-scheme:dark}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark}}
.lt .nm{position:sticky;left:0;z-index:1;min-width:230px;max-width:290px;white-space:normal;box-shadow:1px 0 0 var(--line)}.lt thead .nm{z-index:3}
.lt tbody tr:hover td{background:var(--bg)}
.lnk{background:none;border:0;padding:0;min-height:0;color:var(--ink);font-weight:650;text-align:left;font-size:14px;cursor:pointer}.lnk:hover{text-decoration:underline}
.sb{background:none;border:0;padding:0;min-height:0;font:inherit;color:inherit;cursor:pointer;display:inline-flex;gap:4px;align-items:center}.sb i{font-style:normal;font-size:10px;opacity:.55}.sb[aria-sort="ascending"] i,.sb[aria-sort="descending"] i{opacity:1;color:var(--ink)}
.lt .act{width:44px;text-align:center}.eye{min-height:34px;padding:4px 8px;color:var(--soft)}.eye:hover{color:var(--ink)}
.ch{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--brand2);color:var(--sel);display:inline-block}
.ty{font-size:12px;padding:2px 8px;border-radius:6px;border:1px solid var(--line);color:var(--soft);display:inline-block}
.st{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;display:inline-block;background:var(--offbg);color:var(--off)}
.st-running{background:var(--runbg);color:var(--run)}.st-scheduled{background:var(--schbg);color:var(--sch)}.st-draft{background:var(--drfbg);color:var(--drf)}.st-done{background:var(--brand2);color:var(--sel)}
.dash{color:var(--soft)}.badn{color:var(--bad)}.empty{text-align:center!important;color:var(--soft);padding:26px!important;white-space:normal!important}
.sw{position:relative;display:inline-block;width:40px;height:22px;min-height:0;padding:0;border-radius:99px;border:0;background:var(--swoff);vertical-align:middle;flex:none}
.sw span{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.sw.on{background:var(--run)}.sw.on span{left:21px}button.sw{cursor:pointer}button.sw:focus-visible{outline:2px solid var(--sel);outline-offset:2px}
.sw.ro{opacity:.55;cursor:not-allowed}.sw.ro.on{background:var(--off)}
#drbg{position:fixed;inset:0;background:rgba(10,14,20,.45);z-index:40}
#dr{position:fixed;top:0;right:0;bottom:0;width:min(620px,100vw);background:var(--card);border-left:1px solid var(--line);z-index:41;overflow:auto;padding:16px 18px 40px;box-shadow:-10px 0 30px rgba(0,0,0,.2)}
body.drawer{overflow:hidden}
.dh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.dh h2{margin:0 0 6px;font-size:19px}.x{min-height:36px;padding:4px 11px}
#dr h3{font-size:15px;margin:16px 0 6px}.ctl{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}
ol.how{list-style:none;margin:0;padding:0;display:grid;gap:8px;counter-reset:s}ol.how li{display:grid;grid-template-columns:62px 1fr;gap:10px;font-size:14px;align-items:start}
.k{font-size:11px;font-weight:800;letter-spacing:.4px;padding:3px 7px;border-radius:6px;background:var(--brand2);color:var(--sel);text-align:center}
.k-when{background:var(--schbg);color:var(--sch)}.k-then{background:var(--drfbg);color:var(--drf)}.k-send{background:var(--runbg);color:var(--run)}
.dtabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:18px 0 10px}.dtabs button{border:0;border-bottom:3px solid transparent;border-radius:0;background:none;color:var(--soft)}
.dtabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--sel)}
.msg{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}.ml{font-weight:700;font-size:14px;margin-bottom:4px}
.msg dl{grid-template-columns:70px 1fr}.msg dd{word-break:break-word}
pre.pv{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font:13px/1.45 ui-monospace,Consolas,monospace;margin:6px 0;max-height:360px;overflow:auto}
.flow{display:grid;gap:4px}.fn{border:1px solid var(--line);border-radius:10px;padding:8px 12px}.fn p{margin:4px 0 0;font-size:14px}.fa{text-align:center;color:var(--soft);font-size:18px;line-height:1}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.sgrid{grid-template-columns:1fr}}
.sbx{background:var(--bg);border-radius:10px;padding:10px 12px}.sbx h4{margin:0 0 6px;font-size:13px}
.br{display:grid;grid-template-columns:62px 1fr 76px;gap:8px;align-items:center;font-size:13px;margin:4px 0}.br b{text-align:right;font-weight:650}.br small{color:var(--soft);font-weight:400}
.bt{height:8px;background:var(--bar2);border-radius:99px;overflow:hidden}.bt i{display:block;height:100%;background:var(--bar);border-radius:99px}
dl.kv{grid-template-columns:70px 1fr}
.okm{color:var(--ok)}.flash.ok{background:var(--okbg);color:var(--ok)}
@media(max-width:700px){main{padding:10px}.card{padding:12px}.list{padding:0}header{padding:9px 12px;gap:8px}header button{min-height:34px;padding:5px 10px}#asof{font-size:11px}.tiles .tile b{font-size:22px}.lt th,.lt td{padding:8px 8px}.lt .nm{min-width:44vw;max-width:48vw}.lt .nm small{font-size:11px}.lnk{font-size:14px}.strip .sc b{font-size:19px}}
/* ---- colour face lift (2026-11-23): visual only. Each section has its own accent: --sec (solid, white text on it), --secink (accent text on a card), --sectint (soft fill) */
:root{--pk-s:#0f766e;--pk-i:#0f766e;--pk-t:#e1f3f1;--sx-s:#2a6f2e;--sx-i:#2a6f2e;--sx-t:#e6f3e7;--tv-s:#1e40af;--tv-i:#1e40af;--tv-t:#e5ebfb;--tx-s:#6d28d9;--tx-i:#6d28d9;--tx-t:#efe9fc;
--vio:#6d28d9;--viot:#efe9fc;--org:#b8480b;--orgt:#ffeadb;--badsoft:#fdf3f3;--slbg:#dde3ec;--sl:#2f3b4c;--zebra:#f7f9fb;--hov:#eaf1f8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--pk-s:#0f6b64;--pk-i:#5eead4;--pk-t:#12302e;--sx-s:#2a6f2e;--sx-i:#8fdc93;--sx-t:#172a1a;--tv-s:#1e40af;--tv-i:#9db9ff;--tv-t:#172138;--tx-s:#6d28d9;--tx-i:#c9afff;--tx-t:#231a38;--vio:#c9afff;--viot:#271d3d;--org:#ffa066;--orgt:#33200f;--badsoft:#241818;--slbg:#2b3442;--sl:#c3cddb;--zebra:#1b212b;--hov:#212b3a}}
:root[data-theme="dark"]{--pk-s:#0f6b64;--pk-i:#5eead4;--pk-t:#12302e;--sx-s:#2a6f2e;--sx-i:#8fdc93;--sx-t:#172a1a;--tv-s:#1e40af;--tv-i:#9db9ff;--tv-t:#172138;--tx-s:#6d28d9;--tx-i:#c9afff;--tx-t:#231a38;--vio:#c9afff;--viot:#271d3d;--org:#ffa066;--orgt:#33200f;--badsoft:#241818;--slbg:#2b3442;--sl:#c3cddb;--zebra:#1b212b;--hov:#212b3a}
[data-tab=peak],body[data-sec=peak]{--sec:var(--pk-s);--secink:var(--pk-i);--sectint:var(--pk-t)}
[data-tab=sixfold],body[data-sec=sixfold]{--sec:var(--sx-s);--secink:var(--sx-i);--sectint:var(--sx-t)}
[data-tab=traverse],body[data-sec=traverse]{--sec:var(--tv-s);--secink:var(--tv-i);--sectint:var(--tv-t)}
[data-tab=texts],body[data-sec=texts]{--sec:var(--tx-s);--secink:var(--tx-i);--sectint:var(--tx-t)}
body{--sec:var(--brand);--secink:var(--sel);--sectint:var(--brand2);--bar:var(--secink)}
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid var(--secink);outline-offset:2px}
header{background:linear-gradient(90deg,#1f2c40,#2b3a4f);border-bottom:3px solid transparent;border-image:linear-gradient(90deg,#14b8a6 0 25%,#4caf50 25% 50%,#3b63d8 50% 75%,#8b5cf6 75%) 1}
.card{box-shadow:0 1px 2px rgba(20,30,50,.06)}
/* Today */
.tile{background:var(--bg);border-top:3px solid var(--c);padding:11px 13px}.tile b{font-size:32px;font-weight:750;letter-spacing:-.5px}
.tile.ts{--c:var(--sch)}.tile.tw{--c:var(--warn)}.tile.tf{--c:var(--bad)}.tile.ta{--c:var(--org)}
.tile.ts b{color:var(--sch)}.tile.tw b{color:var(--warn)}.tile.tf b{color:var(--ink)}.tile.ta b{color:var(--ink)}.tile.tf.bad b{color:var(--bad)}.tile.ta.bad b{color:var(--org)}
.tile.tf.bad{background:var(--badsoft)}.tile.ta.bad{background:var(--orgt)}
.att li.bad{background:var(--badsoft);color:var(--bad);border-left:3px solid var(--bad)}.att li.info{border-left:3px solid var(--line)}
/* section tabs */
.tabs button{border-width:1px 1px 3px;border-bottom-color:var(--sec);padding-left:12px}.tabs button::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--secink);margin-right:7px;vertical-align:baseline}
.tabs button:hover{background:var(--sectint)}
.tabs button[aria-selected="true"]{background:var(--sec);border-color:var(--sec);color:#fff}.tabs button[aria-selected="true"]::before{background:#fff}
/* section header band */
.secc{padding:0 0 14px;overflow:hidden;border-top:0}
.secc>h2{background:var(--sec);color:#fff;margin:0 0 12px;padding:12px 16px;font-size:17px}.secc>h2 .cnt{color:#fff;opacity:.85}
.secc>*:not(h2){margin-left:16px;margin-right:16px}
.secc .lead{background:var(--sectint);border-left:4px solid var(--sec);border-radius:8px}
.secc>.row,.secc>p.note{margin-bottom:0}
/* summary strip */
.strip{margin-top:12px}
.sc{background:var(--bg);border-top:3px solid var(--c,var(--secink));padding:9px 11px}.sc b{font-size:28px;font-weight:750;letter-spacing:-.4px;color:var(--cn,var(--ink))}
.sc-sent{--c:var(--secink);--cn:var(--secink);background:var(--sectint)}
.sc-open{--c:var(--sch);--cn:var(--sch);background:var(--schbg)}
.sc-click{--c:var(--vio);--cn:var(--vio);background:var(--viot)}
.sc-reply{--c:var(--run);--cn:var(--run);background:var(--runbg)}
.sc-bounce{--c:var(--line)}.sc-bounce.bad{--c:var(--bad);--cn:var(--bad);background:var(--badsoft)}
/* the list */
.bar{background:var(--bg);border-radius:12px 12px 0 0}
.lt thead th{background:var(--sectint);color:var(--secink);font-weight:700;border-bottom:2px solid var(--sec)}.lt thead .sb{color:var(--secink)}
.lt tbody tr:nth-child(even) td{background:var(--zebra)}.lt tbody tr:hover td{background:var(--hov)}
.lt .nm .lnk{font-weight:750;color:var(--ink)}.lt .nm small{color:var(--soft);font-weight:400;margin-top:1px}
.lt td.num{font-variant-numeric:tabular-nums}.lt td.num small{color:var(--soft)}
.rb{display:block;height:4px;width:44px;background:var(--bar2);border-radius:99px;margin:3px 0 0 auto;overflow:hidden}.rb u{display:block;height:100%;background:var(--sch);border-radius:99px}
td[data-c=clicked] .rb u{background:var(--vio)}
.eye{color:var(--secink)}.eye:hover{color:var(--ink);background:var(--sectint)}
.sw.on{background:var(--run)}.sw.ro.on{background:var(--run);opacity:.5}
/* pills */
.st{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:2px 10px 2px 8px;border-radius:99px;background:var(--offbg);color:var(--soft)}
.st::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.st-running{background:var(--runbg);color:var(--run)}.st-scheduled{background:var(--schbg);color:var(--sch)}.st-paused{background:var(--warnbg);color:var(--warn)}
.st-draft{background:var(--offbg);color:var(--soft)}.st-done{background:var(--slbg);color:var(--sl)}.st-failed{background:var(--badbg);color:var(--bad)}
.ty{font-size:12px;font-weight:600;padding:1px 8px;border-radius:6px;border:1.5px solid var(--line);color:var(--soft);background:transparent}
.ty-triggered{border-color:var(--pk-i);color:var(--pk-i)}.ty-recurring{border-color:var(--org);color:var(--org)}.ty-onetime{border-color:var(--soft);color:var(--soft)}
.ch{background:var(--schbg);color:var(--sch)}.ch-sms{background:var(--runbg);color:var(--run)}
/* drawer */
#dr{padding-top:0}
.dh{background:var(--sec);color:#fff;margin:0 -18px 12px;padding:16px 18px;border-bottom:3px solid var(--secink)}.dh h2{color:#fff}.dh .soft{color:#fff;opacity:.85}
.dh .x{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.5)}.dh .x:hover{background:rgba(255,255,255,.28)}
.dh .row{gap:6px}.dh .ty{background:var(--card)}
#dr h3{color:var(--secink)}
.k-when{background:var(--schbg);color:var(--sch)}.k-then{background:var(--warnbg);color:var(--warn)}.k-send{background:var(--runbg);color:var(--run)}
ol.how li{align-items:center}
.dtabs button[aria-selected="true"]{color:var(--secink);border-bottom-color:var(--sec)}
.msg{border-left:4px solid var(--sec)}
.ctl{background:var(--sectint);border-color:transparent}
.fn{border-left:4px solid var(--soft);background:var(--bg)}.fn-when{border-left-color:var(--sch)}.fn-then{border-left-color:var(--warn)}.fn-send{border-left-color:var(--run)}
.fa{color:var(--secink);font-size:20px;font-weight:700}
.bt i{background:var(--secink)}.br-failed .bt i,.br-bounces .bt i{background:var(--bad)}.br-opened .bt i{background:var(--sch)}.br-clicked .bt i{background:var(--vio)}.br-replies .bt i{background:var(--run)}
.sbx{border-top:3px solid var(--sec)}
@media(max-width:700px){.secc>h2{padding:10px 12px}.secc>*:not(h2){margin-left:12px;margin-right:12px}.tile b{font-size:26px}.sc b{font-size:23px}.dh{margin:0 -18px 12px}.tabs button{padding:6px 10px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}
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
  <section id="sec"><div id="secTop"></div><div id="secList" style="margin-top:14px"></div><div id="secPeak"></div></section>
</main>
<div id="drbg" class="hide"></div>
<aside id="dr" class="hide" role="dialog" aria-modal="true" aria-labelledby="drt"></aside>
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
function flash(t,cls){$('#flash').innerHTML=t?'<div class="flash'+(cls?' '+cls:'')+'">'+t+'</div>':''}
async function load(){try{V=await api('state');show(true);flash('');draw()}catch(e){if(e.message!=='signin')flash(esc(e.message))}}
$('#go').onclick=async()=>{$('#sinote').textContent='';try{await api('signin',{code:$('#code').value});$('#code').value='';load()}catch(e){$('#sinote').textContent=e.message}};
$('#code').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};
$('#out').onclick=async()=>{try{await api('signout',{})}catch(e){}peakFrame=null;$('#secPeak').innerHTML='';if(drId)drClose();show(false)};
$('#reload').onclick=()=>{load();if(peakFrame&&tab==='peak')try{peakFrame.contentWindow.location.reload()}catch(e){}};
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.outbox==='signin')show(false)});

const sum=o=>o.peak+o.sixfold+o.traverse, split=o=>'Peak '+o.peak+' · Sixfold '+o.sixfold+' · Traverse '+o.traverse;
function drawTop(){
  const s=V.summary, bad=s.attention.filter(a=>a.level==='bad').length;
  $('#asof').textContent='as of '+when(V.now);
  $('#tiles').innerHTML=[['Sent today',sum(s.sent),split(s.sent),'','ts'],['Waiting to send',sum(s.waiting),split(s.waiting)+(s.waitingPaused?' (+'+s.waitingPaused+' on paused Peak lists)':''),'','tw'],
    ['Failed today',sum(s.failed),split(s.failed),sum(s.failed)?'bad':'','tf'],['Needs attention',bad,s.attention.length-bad+' more to know',bad?'bad':'','ta']]
    .map(t=>'<div class="tile '+t[4]+' '+t[3]+'"><b>'+t[1]+'</b><span>'+t[0]+'</span><small>'+esc(t[2])+'</small></div>').join('');
  /* the first four, then the rest folded (2026-11-23: the list below is the main thing on the page) */
  const li=a=>'<li class="'+a.level+'">'+esc(a.text)+'</li>', A=s.attention, F4=matchMedia('(max-width:700px)').matches?2:4;
  $('#att').innerHTML=A.length?A.slice(0,F4).map(li).join('')+(A.length>F4?'<li class="more"><details><summary>'+(A.length-F4)+' more to know</summary><ul class="att">'+A.slice(F4).map(li).join('')+'</ul></details></li>':''):'<li class="info">Nothing needs you right now.</li>';
  const cnt={peak:V.peak.today||0,sixfold:V.sixfold.items.reduce((a,i)=>a+i.today,0),traverse:V.traverse.items.reduce((a,i)=>a+i.today,0)};
  $('#tabs').innerHTML=TABS.map(t=>'<button role="tab" data-tab="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+(cnt[t[0]]?'<span class="n">'+cnt[t[0]]+' today</span>':'')+'</button>').join('');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;try{localStorage.setItem('outbox.tab',tab)}catch(e){}draw()});
}
const pc=x=>x===null||x===undefined?'-':x+'%', yn=b=>b?'<span class="yes">yes</span>':'<span class="no">no</span>';
function trackHtml(it){
  const t=it.track, oo=!!t.opensOnly; if(!t.sentAll)return '<div class="trk note">'+(oo?'Opens are':'Opens and clicks are')+' counted from the next '+esc(it.name.toLowerCase())+' sent. Nothing counted yet.</div>';
  let h='<div class="trk"><div class="nums">'+[['sent, 7 days',t.sent7],['sent, 30 days',t.sent30],['opened, 30 days',t.opened30+(t.sent30?' ('+pc(t.openRate30)+')':'')]].concat(oo?[]:[['clicked, 30 days',t.clicked30+(t.sent30?' ('+pc(t.clickRate30)+')':'')]]).map(x=>'<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
  h+=oo?'<p class="note tiny">Opens only (no link in it is counted). Opens are rough: Apple Mail loads every image as the email arrives (high), Outlook often blocks images (low).</p>':'<p class="note tiny">Opened may include Apple Mail\'s automatic opens (it loads every email as it arrives), so read opens as high. Clicks are the reliable number.</p>';
  if(t.links30.length)h+='<p class="note">Links clicked, 30 days: '+t.links30.map(l=>esc(l.what)+' '+l.clicks).join(' · ')+'</p>';
  const vh=t.by||(it.id==='newsletter'?'Issue':'Wording'), ck=x=>oo?'':'<td>'+x+'</td>';
  h+='<details'+(t.byVersion.length>1?' open':'')+'><summary>By '+vh.toLowerCase()+' ('+t.byVersion.length+')</summary><table class="t"><tr><th>'+esc(vh)+'</th><th>Sent</th><th>Opened</th>'+(oo?'':'<th>Clicked</th>')+'</tr>'
    +t.byVersion.map(b=>'<tr><td>'+esc(b.label)+(b.active?'<span class="tag">in use</span>':'')+'<br><span class="note tiny">'+esc(when(b.first))+(b.last!==b.first?' to '+esc(when(b.last)):'')+'</span></td><td>'+b.sent+'</td><td>'+b.opened+' ('+pc(b.openRate)+')</td>'+ck(b.clicked+' ('+pc(b.clickRate)+')')+'</tr>').join('')+'</table></details>';
  h+='<details><summary>Last '+t.recent.length+' sent</summary><table class="t"><tr><th>Sent</th><th>'+esc(vh)+'</th><th>Opened</th>'+(oo?'':'<th>Clicked</th>')+'</tr>'
    +t.recent.map(r=>'<tr><td>'+esc(when(r.at))+'</td><td>'+esc(r.v)+'</td><td>'+yn(r.opened)+'</td>'+ck(yn(r.clicked))+'</tr>').join('')+'</table><p class="note tiny">'+esc(t.rowNote||'No names here on purpose: each row is one email to one customer.')+'</p></details>';
  return h+'</div>';
}
/* ================= the list view (2026-11-23). Matthew finds Patch Retention's Automations screens "a lot easier to understand and
   navigate": one list per section, a row per automatic email stream, filters, search, sortable columns, a column chooser (kept in this
   browser only) and a detail drawer. Only Peak's lists have a working switch: the Peak sender's own Start and Pause (peak/api.php, with
   all of its checks). Every other switch is shown read only. The server sends plain data; every value is escaped here. */
const nf=x=>x===null||x===undefined?'<span class="dash" title="Not counted">–</span>':String(x);
const rate=(a,b)=>b?Math.round(1000*a/b)/10+'%':'';
const rb=(a,b)=>b?'<i class="rb" aria-hidden="true"><u style="width:'+Math.max(a?4:0,Math.min(100,Math.round(100*a/b)))+'%"></u></i>':'';
const COLS=[
  {k:'channels',l:'Channels',v:r=>r.channels.join(' '),h:r=>r.channels.map(c=>'<span class="ch ch-'+esc(c.toLowerCase())+'">'+esc(c)+'</span>').join(' ')},
  {k:'enabled',l:'Enabled',v:r=>r.enabled===true?1:r.enabled===false?0:-1,h:r=>sw(r)},
  {k:'status',l:'Status',v:r=>r.status,h:r=>'<span class="st st-'+esc(r.status.toLowerCase())+'" title="'+esc(r.statusWhy)+'">'+esc(r.status)+'</span>'},
  {k:'type',l:'Type',v:r=>r.type,h:r=>'<span class="ty ty-'+esc(r.type.toLowerCase().replace(/\W/g,''))+'">'+esc(r.type)+'</span>'},
  {k:'last',l:'Last run',v:r=>r.last||0,h:r=>r.last?esc(when(r.last)):'<span class="dash">never</span>'},
  {k:'next',l:'Next run',v:r=>r.next||9e12,h:r=>r.next?esc(when(r.next)):'<span class="soft">'+esc(r.nextText||'–')+'</span>'},
  {k:'sent',l:'Sent',n:1,v:r=>r.n.d30.sent,h:r=>nf(r.n.d30.sent)+(r.n.today?'<small>'+r.n.today+' today</small>':'')},
  {k:'delivered',l:'Delivered',n:1,v:r=>r.n.d30.delivered??-1,h:r=>nf(r.n.d30.delivered)},
  {k:'opened',l:'Opened',n:1,v:r=>r.n.d30.opened??-1,h:r=>nf(r.n.d30.opened)+(r.n.d30.opened!==null&&r.n.tracked30?'<small>'+rate(r.n.d30.opened,r.n.tracked30)+'</small>'+rb(r.n.d30.opened,r.n.tracked30):'')},
  {k:'clicked',l:'Clicked',n:1,v:r=>r.n.d30.clicked??-1,h:r=>nf(r.n.d30.clicked)+(r.n.d30.clicked!==null&&r.n.tracked30?'<small>'+rate(r.n.d30.clicked,r.n.tracked30)+'</small>'+rb(r.n.d30.clicked,r.n.tracked30):'')},
  {k:'replies',l:'Replies',n:1,v:r=>r.n.d30.replies??-1,h:r=>nf(r.n.d30.replies)},
  {k:'conv',l:'Booked',n:1,v:r=>r.n.d30.conv??-1,h:r=>nf(r.n.d30.conv),t:'Conversions: bookings from the email'},
  {k:'optouts',l:'Opt-outs',n:1,v:r=>r.n.d30.optouts??-1,h:r=>nf(r.n.d30.optouts),t:'Unsubscribes and STOP replies'},
  {k:'bounces',l:'Bounces',n:1,v:r=>r.n.d30.bounces??-1,h:r=>nf(r.n.d30.bounces)},
  {k:'failed',l:'Failed',n:1,v:r=>r.n.d30.failed??-1,h:r=>r.n.d30.failed?'<b class="badn">'+r.n.d30.failed+'</b>':nf(r.n.d30.failed),t:'Could not send'}];
const PHONE_HIDE=['channels','type','last','next','delivered','replies','conv','optouts','bounces','failed'];
let hidden=(()=>{try{const h=JSON.parse(localStorage.getItem('outbox.cols')||'null');if(Array.isArray(h))return h}catch(e){}return matchMedia('(max-width:700px)').matches?PHONE_HIDE.slice():[]})();
const F={ch:'',st:'',ty:'',q:''}; let SORT={k:'',dir:1}, drId=null, drTab='messages';
function sw(r){
  const on=r.enabled===true, lbl=on?'On':r.enabled===false?'Off':'?';
  if(r.control&&r.control.kind==='peaklist')return '<button type="button" class="sw'+(on?' on':'')+'" role="switch" aria-checked="'+on+'" data-peaksw="'+esc(r.control.list)+'" aria-label="'+esc((on?'Pause ':'Start ')+r.name)+'" title="'+esc(on?'Sending: press to pause':'Paused: press to start (the Peak sender checks first)')+'"><span></span></button>';
  return '<span class="sw ro'+(on?' on':'')+'" role="img" aria-disabled="true" aria-label="'+esc(lbl+', read only')+'" title="'+esc('Read only here ('+lbl+'). '+r.switchText)+'"><span></span></span><span class="rol" aria-hidden="true">'+lbl.toLowerCase()+'</span>';
}
const rows=()=>(V.streams&&V.streams[tab])||[];
function shown(){
  const q=F.q.trim().toLowerCase();
  let R=rows().filter(r=>(!F.ch||r.channels.includes(F.ch))&&(!F.st||r.status===F.st)&&(!F.ty||r.type===F.ty)&&(!q||(r.name+' '+r.desc+' '+r.who).toLowerCase().includes(q)));
  if(SORT.k){const c=COLS.find(x=>x.k===SORT.k)||{v:r=>r.name.toLowerCase()};const g=SORT.k==='name'?(r=>r.name.toLowerCase()):c.v;R=R.slice().sort((a,b)=>{const x=g(a),y=g(b);return (x<y?-1:x>y?1:0)*SORT.dir})}
  return R;
}
function strip(R){
  let t=0,d7=0,d30=0,op=0,opd=0,cl=0,cld=0,rp=0,bo=0,rpOn=false,boOn=false;
  for(const r of R){const a=r.n.d30;t+=r.n.today;d7+=r.n.d7.sent;d30+=a.sent;if(a.opened!==null&&r.n.tracked30){op+=a.opened;opd+=r.n.tracked30}if(a.clicked!==null&&r.n.tracked30){cl+=a.clicked;cld+=r.n.tracked30}if(a.replies!==null){rp+=a.replies;rpOn=true}if(a.bounces!==null){bo+=a.bounces;boOn=true}}
  return [['Sent today',t,'','sent'],['Sent, 7 days',d7,'','sent'],['Sent, 30 days',d30,'','sent'],['Open rate',opd?rate(op,opd):'–',opd?op+' of '+opd+' counted':'not counted','open'],['Click rate',cld?rate(cl,cld):'–',cld?cl+' of '+cld+' counted':'not counted','click'],['Replies',rpOn?rp:'–',rpOn?'30 days':'not counted here','reply'],['Bounces',boOn?bo:'–',boOn?'30 days':'not checked here','bounce'+(boOn&&bo>0?' bad':'')]]
    .map(x=>'<div class="sc sc-'+x[3]+'"><span>'+x[0]+'</span><b>'+x[1]+'</b>'+(x[2]?'<small>'+esc(x[2])+'</small>':'')+'</div>').join('');
}
const LEADS={
  peak:()=>'Peak Pickleball: every Peak email goes out as '+esc((V.peak.from&&V.peak.from.name)||'Peak Partnerships')+' &lt;'+esc((V.peak.from&&V.peak.from.email)||'partnerships@peakpickleball.us')+'&gt;; replies are read from there onto the Peak desk. The list blasts switch here or in the Peak controls below; tour confirmations and desk emails switch in the Peak desk.',
  sixfold:()=>'Sixfold 365 (Brandon\'s company, run by Jen). These come from the Sixfold app; nothing here turns one on or off or changes who gets it. <b>One thing you can change here:</b> the words of the four customer emails (Change the words, in each one\'s drawer), which go to Jen\'s customers.',
  traverse:()=>'Traverse (yours): the Prospect Desk, the website, sign-ups and the client apps. <b>Read only</b> here.',
  texts:()=>esc(V.texts.note)};
const TITLES={peak:'Peak',sixfold:'Sixfold',traverse:'Traverse',texts:'Texts'};
function drawSecTop(){
  const R=rows(); let h='<section class="card secc"><h2>'+TITLES[tab]+' automations <span class="soft cnt">'+R.length+' '+(R.length===1?'stream':'streams')+'</span></h2><div class="lead">'+LEADS[tab]()+'</div>';
  h+='<div class="strip" id="strip">'+strip(R)+'</div>';
  if(tab==='peak'&&V.peak.ready){const C=V.peak.conn||{};h+='<div class="row" style="margin-top:10px"><span class="note">Microsoft: '+(C.connected?'connected ('+esc(C.email)+')':C.status==='reconnect'?'<b class="badn">needs reconnecting</b>':'<b class="badn">not connected</b>')+'. Window: '+esc(V.peak.window)+', '+V.peak.rate+' an hour. Last hourly run: '+esc(V.peak.lastRun||'none yet')+'.</span><button id="gopc">Peak controls</button><button id="gort">Where Microsoft comes back to</button></div>'}
  if(tab!=='peak'&&V[tab]&&V[tab].bounceScan)h+='<p class="note">Bounce check, last run: '+esc(V[tab].bounceScan)+'</p>';
  $('#secTop').innerHTML=h+'</section>';
  if($('#gopc'))$('#gopc').onclick=()=>{const f=$('#pf');if(f)f.scrollIntoView({behavior:'smooth'})};
  if($('#gort'))$('#gort').onclick=()=>{const f=$('#ret');if(f)f.scrollIntoView({behavior:'smooth'})};
}
function opts(id,label,vals,cur){return '<label class="f"><span>'+label+'</span><select id="'+id+'"><option value="">All</option>'+vals.map(v=>'<option'+(v===cur?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'}
function drawList(){
  const R=shown(), all=rows(), vis=COLS.filter(c=>!hidden.includes(c.k));
  const uniq=(f,base)=>[...new Set(base.concat(all.map(f)))];
  let h='<section class="card list"><div class="bar">'+opts('fch','Channel',['Email','SMS'],F.ch)+opts('fst','Status',uniq(r=>r.status,['Running','Paused','Draft','Scheduled','Done']),F.st)+opts('fty','Type',uniq(r=>r.type,['Triggered','Recurring','One time']),F.ty)
    +'<label class="f grow"><span>Search</span><input id="fq" type="search" placeholder="Search by name" value="'+esc(F.q)+'"></label>'
    +'<div class="colw"><button id="colb" aria-expanded="false" aria-controls="colp">Columns</button><div id="colp" class="colp hide" role="group" aria-label="Show or hide columns">'
    +COLS.map(c=>'<label><input type="checkbox" data-col="'+c.k+'"'+(hidden.includes(c.k)?'':' checked')+'> '+esc(c.l)+'</label>').join('')+'<button id="colr" class="tiny">Reset</button></div></div></div>';
  h+='<div class="tw"><table class="lt"><thead><tr><th class="nm">'+sortb('name','Name')+'</th>'+vis.map(c=>'<th'+(c.n?' class="num"':'')+(c.t?' title="'+esc(c.t)+'"':'')+'>'+sortb(c.k,c.l)+'</th>').join('')+'<th class="act"><span class="sr">View</span></th></tr></thead><tbody>';
  h+=R.map(r=>'<tr data-row="'+esc(r.id)+'"><td class="nm"><button class="lnk" data-view="'+esc(r.id)+'">'+esc(r.name)+'</button><small>'+esc(r.who)+'</small></td>'+vis.map(c=>'<td data-c="'+c.k+'"'+(c.n?' class="num"':'')+'>'+c.h(r)+'</td>').join('')
    +'<td class="act"><button class="eye" data-view="'+esc(r.id)+'" aria-label="View '+esc(r.name)+'" title="View"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.3a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" fill="currentColor"/></svg></button></td></tr>').join('');
  if(!R.length)h+='<tr><td colspan="'+(vis.length+2)+'" class="empty">'+(all.length?'Nothing matches these filters.':tab==='texts'?'No text messages are sent automatically yet.':'Nothing here yet.')+'</td></tr>';
  h+='</tbody></table></div><p class="note tiny">'+R.length+' of '+all.length+' shown. Numbers are the emails sent in the last 30 days and what happened to them (open and click rates are out of the ones counted). <span class="dash">–</span> means not counted for that email. Opens are rough: Apple Mail opens every image (high), Outlook often blocks them (low).</p></section>';
  $('#secList').innerHTML=h;
  $('#fch').onchange=e=>{F.ch=e.target.value;drawList()};$('#fst').onchange=e=>{F.st=e.target.value;drawList()};$('#fty').onchange=e=>{F.ty=e.target.value;drawList()};
  $('#fq').oninput=e=>{F.q=e.target.value;const p=e.target.selectionStart;drawList();const n=$('#fq');n.focus();try{n.setSelectionRange(p,p)}catch(x){}};
  $('#colb').onclick=e=>{e.stopPropagation();const p=$('#colp'),o=p.classList.toggle('hide');$('#colb').setAttribute('aria-expanded',String(!o))};
  document.querySelectorAll('[data-col]').forEach(b=>b.onchange=()=>{const k=b.dataset.col;hidden=b.checked?hidden.filter(x=>x!==k):hidden.concat(k);try{localStorage.setItem('outbox.cols',JSON.stringify(hidden))}catch(e){}drawList();$('#colp').classList.remove('hide');$('#colb').setAttribute('aria-expanded','true')});
  $('#colr').onclick=()=>{hidden=[];try{localStorage.removeItem('outbox.cols')}catch(e){}drawList()};
  document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{const k=b.dataset.sort;SORT=SORT.k===k?(SORT.dir===1?{k,dir:-1}:{k:'',dir:1}):{k,dir:1};drawList()});
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>drOpen(b.dataset.view));
  document.querySelectorAll('[data-peaksw]').forEach(b=>b.onclick=()=>peakSwitch(b.dataset.peaksw));
}
function sortb(k,l){const on=SORT.k===k;return '<button class="sb" data-sort="'+k+'" aria-sort="'+(on?(SORT.dir===1?'ascending':'descending'):'none')+'">'+esc(l)+'<i aria-hidden="true">'+(on?(SORT.dir===1?'▲':'▼'):'↕')+'</i></button>'}
document.addEventListener('click',e=>{const p=$('#colp');if(p&&!p.classList.contains('hide')&&!e.target.closest('.colw')){p.classList.add('hide');$('#colb').setAttribute('aria-expanded','false')}});

/* ---- Peak's list switch: the Peak sender's own Start and Pause, with its own checks (it refuses Start while the email is a DRAFT, the
   postal address is missing or Microsoft is not connected), the same question first as on its own page */
async function peakApi(action,body,get){
  const o=body===undefined?{credentials:'same-origin'}:{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PM':'1'},body:JSON.stringify(body)};
  const r=await fetch('peak/api.php?action='+action+(get||''),o); let j={}; try{j=await r.json()}catch(e){j={ok:false,error:'The Peak sender did not answer properly.'}}
  if(j.signin){show(false);throw new Error('signin')}
  if(!j.ok)throw new Error(j.error||'Something went wrong.'); return j;
}
async function peakSwitch(k){
  const L=(V.peak.lists||[]).find(x=>x.id===k); if(!L)return; const F0=V.peak.from||{};
  let msg='',cls='ok';
  try{
    if(L.status==='running'){await peakApi('pause',{list:k});msg=esc(L.name)+' paused. Nothing more goes out from this list until you press Start.'}
    else{
      if(!confirm('Start sending "'+L.name+'" as '+(F0.email||'Peak Partnerships')+'?\n\n'+L.queued+' people, '+V.peak.rate+' an hour, '+V.peak.window+'.\n\nSubject: '+((L.template&&L.template.subject)||'')))return;
      await peakApi('start',{list:k});msg=esc(L.name)+' started. The next hourly run sends the first ones.'}
  }catch(e){if(e.message==='signin')return;msg=esc(e.message);cls=''}
  await load(); flash(msg,cls); if(peakFrame)try{peakFrame.contentWindow.location.reload()}catch(e){}
}

/* ---- the drawer */
const byId=id=>rows().find(r=>r.id===id)||Object.values(V.streams||{}).flat().find(r=>r.id===id);
function drOpen(id){drId=id;drTab='messages';$('#drbg').classList.remove('hide');$('#dr').classList.remove('hide');document.body.classList.add('drawer');drDraw();setTimeout(()=>{const x=$('#drx');if(x)x.focus()},30)}
function drClose(){const id=drId;drId=null;$('#dr').classList.add('hide');$('#drbg').classList.add('hide');$('#dr').innerHTML='';document.body.classList.remove('drawer');const b=document.querySelector('.eye[data-view="'+CSS.escape(id||'')+'"]');if(b)b.focus()}
function itemOf(r){if(r.id.startsWith('sx-'))return V.sixfold.items.find(i=>i.id===r.ref);if(r.id.startsWith('tv-'))return V.traverse.items.find(i=>i.id===r.ref);return null}
function drDraw(){
  const r=byId(drId); if(!r){drClose();return}
  let h='<div class="dh"><div><h2 id="drt">'+esc(r.name)+'</h2><div class="row"><span class="st st-'+esc(r.status.toLowerCase())+'">'+esc(r.status)+'</span><span class="ty ty-'+esc(r.type.toLowerCase().replace(/\W/g,''))+'">'+esc(r.type)+'</span>'+r.channels.map(c=>'<span class="ch ch-'+esc(c.toLowerCase())+'">'+esc(c)+'</span>').join('')+'<span class="soft tiny">'+(r.updated?'Updated '+esc(when(r.updated)):'Last change not recorded')+'</span></div></div><button id="drx" class="x" aria-label="Close">✕</button></div>';
  h+='<p class="note">'+esc(r.desc)+'</p><p class="note"><b>Now:</b> '+esc(r.statusWhy||r.status)+'. <b>Last run:</b> '+(r.last?esc(when(r.last)):'never')+'. <b>Next:</b> '+(r.next?esc(when(r.next))+(r.nextText?' ('+esc(r.nextText)+')':''):esc(r.nextText||'not described yet'))+'.</p>';
  /* the controls that belong to it */
  h+='<div class="ctl">';
  if(r.control&&r.control.kind==='peaklist'){const L=V.peak.lists.find(x=>x.id===r.ref)||{blocks:[]};
    h+='<div class="row">'+sw(r)+'<b>'+(r.enabled?'Sending':'Paused')+'</b><span class="note">The Peak sender\'s own Start and Pause.</span></div>'
      +(L.status!=='running'&&L.blocks&&L.blocks.length?'<div class="fails"><b>Start is blocked:</b><br>'+L.blocks.map(esc).join('<br>')+'</div>':'')
      +'<div class="row" style="margin-top:8px"><button id="drprev" data-list="'+esc(r.ref)+'">Preview the next 3</button><button id="drpc">Edit the email, settings, who is on it</button></div><div id="drpv"></div>'}
  else h+='<div class="row">'+sw(r)+'<span class="note"><b>Read only here.</b> '+esc(r.switchText)+'</span></div>';
  if(r.editable)h+='<div class="row" style="margin-top:8px"><button data-ed="'+esc(r.ref)+'">Change the words</button><span class="note">The wording, a preview and the saved versions.</span></div>';
  if(r.id==='peak-tours'&&V.peak.tours)h+='<p class="note"><a href="'+esc(V.peak.tours.desk)+'" target="_blank" rel="noopener">Open the Peak desk\'s Tours</a> (Retry for one not sent).</p>';
  h+='</div>';
  h+='<h3>How it works</h3><ol class="how">'+r.how.map(s=>'<li><span class="k k-'+esc(s[0].toLowerCase())+'">'+esc(s[0])+'</span><span>'+esc(s[1])+'</span></li>').join('')+'</ol>';
  const T=[['messages','Messages'],['flow','Flow'],['stats','Stats']];
  h+='<div class="dtabs" role="tablist" aria-label="Details">'+T.map(t=>'<button role="tab" id="dt-'+t[0]+'" data-dt="'+t[0]+'" aria-selected="'+(drTab===t[0])+'" aria-controls="dp">'+t[1]+'</button>').join('')+'</div><div id="dp" role="tabpanel" aria-labelledby="dt-'+drTab+'">'+drPanel(r)+'</div>';
  $('#dr').innerHTML=h;
  $('#drx').onclick=drClose;
  document.querySelectorAll('#dr [data-dt]').forEach(b=>b.onclick=()=>{drTab=b.dataset.dt;drDraw()});
  document.querySelectorAll('#dr [data-peaksw]').forEach(b=>b.onclick=()=>peakSwitch(b.dataset.peaksw));
  document.querySelectorAll('#dr [data-ed]').forEach(b=>b.onclick=()=>edOpen(b.dataset.ed));
  if($('#drpc'))$('#drpc').onclick=()=>{drClose();const f=$('#pf');if(f)f.scrollIntoView({behavior:'smooth'})};
  if($('#drprev'))$('#drprev').onclick=async()=>{const el=$('#drpv');if(el.innerHTML){el.innerHTML='';return}
    try{const j=await peakApi('preview',undefined,'&list='+encodeURIComponent($('#drprev').dataset.list));el.innerHTML=(j.draft?'<div class="warn">This is still the DRAFT placeholder: it cannot be sent.</div>':'')+(j.messages.length?j.messages.map(m=>'<div class="note">To <b>'+esc(m.name?m.name+' <'+m.to+'>':m.to)+'</b> at '+esc(m.company)+'</div><pre class="pv">'+esc(m.subject)+'\n\n'+esc(m.body)+'</pre>').join(''):'<p class="note">Nobody is waiting on this list.</p>')}catch(e){if(e.message!=='signin')el.innerHTML='<div class="fails">'+esc(e.message)+'</div>'}};
  if(drTab==='messages'&&r.words)drWords(r);
}
function drPanel(r){
  if(drTab==='messages')return r.messages.map(m=>'<div class="msg"><div class="ml">'+esc(m.label)+'</div><dl><dt>From</dt><dd>'+esc(m.from)+'</dd><dt>Subject</dt><dd data-subj>'+esc(m.subject)+'</dd></dl>'
    +(m.preview?'<pre class="pv">'+esc(m.preview)+'</pre>':r.words?'':'<p class="note tiny">Text preview: not described yet.</p>')+(m.note?'<p class="note tiny">'+esc(m.note)+'</p>':'')+'</div>').join('')+(r.words?'<div id="drw" class="note">Loading the words in use…</div>':'');
  if(drTab==='flow'){const it=itemOf(r), t=it&&it.track, pk=r.control&&r.control.kind==='peaklist';
    const tr=pk?['opens','clicks','replies','bookings','opt-outs','bounces']:r.id==='tv-desk'?['clicks','bounces','opt-outs']:r.id==='peak-tours'?['opens']:t?(t.opensOnly?['opens']:['opens','clicks']):[];
    return '<div class="flow">'+r.how.map((s,i)=>'<div class="fn fn-'+esc(s[0].toLowerCase())+'"><span class="k k-'+esc(s[0].toLowerCase())+'">'+(i+1)+'. '+esc(s[0])+'</span><p>'+esc(s[1])+'</p></div>').join('<div class="fa" aria-hidden="true">↓</div>')
      +'<div class="fa" aria-hidden="true">↓</div><div class="fn"><span class="k">COUNTED</span><p>Each send'+(tr.length?', and its '+esc(tr.join(', ')):'')+(r.n.d30.failed!==null?'; failures are listed':'')+'.</p></div></div>'}
  /* stats: 7 and 30 days, with small bars against the emails sent; then everything the old card showed */
  const B=(w,lab)=>{const a=r.n[w],tk=w==='d30'?r.n.tracked30:r.n.tracked7,mx=Math.max(1,a.sent);
    const L=[['Sent',a.sent,a.sent],['Opened',a.opened,tk],['Clicked',a.clicked,tk],['Replies',a.replies,a.sent],['Bounces',a.bounces,a.sent],['Failed',a.failed,a.sent]];
    return '<div class="sbx"><h4>'+lab+'</h4>'+L.map(x=>'<div class="br br-'+x[0].toLowerCase()+'"><span>'+x[0]+'</span><div class="bt"><i style="width:'+(x[1]===null||x[1]===undefined?0:Math.min(100,Math.round(100*x[1]/mx)))+'%"></i></div><b>'+nf(x[1])+(x[1]&&x[0]!=='Sent'&&x[2]?' <small>'+rate(x[1],x[2])+'</small>':'')+'</b></div>').join('')+'</div>'};
  let h='<div class="sgrid">'+B('d7','Last 7 days')+B('d30','Last 30 days')+'</div>';
  const it=itemOf(r);
  if(it){h+='<dl class="kv"><dt>Opens</dt><dd>'+esc(it.opens)+'</dd><dt>Clicks</dt><dd>'+esc(it.clicks)+'</dd></dl>';if(it.note)h+='<p class="note">'+esc(it.note)+'</p>';if(it.skipped30)h+='<p class="note">'+it.skipped30+' not sent in 30 days (no email on file or unsubscribed).</p>';
    if(it.fails.length)h+='<div class="fails"><b>Failed: '+it.failToday+' today, '+it.fail7+' in 7 days, '+it.fail30+' in 30 days</b><br>'+it.fails.map(f=>esc(when(f.at)+': '+f.why)).join('<br>')+'</div>';
    if(it.track)h+=trackHtml(it);}
  else if(r.control&&r.control.kind==='peaklist'){const L=V.peak.lists.find(x=>x.id===r.ref);if(L){const R=L.rates||{};
    h+='<p class="note">All time: <b>'+L.sent+'</b> sent, '+L.queued+' waiting. Of those sent: '+R.open+'% opened, '+R.click+'% clicked, '+R.reply+'% replied, '+R.booked+'% booked, '+R.bounce+'% bounced. '+L.people+' people at '+L.orgs+' organisations on the list.'+(L.skips&&L.skips.length?' Skipped on the desk: '+L.skips.map(x=>esc(x[0])+', '+x[1]).join(' · ')+'.':'')+'</p>'}}
  else if(r.id==='peak-tours'){const TC=V.peak.tours;h+='<p class="note">'+TC.today+' today, '+TC.d7+' in 7 days, '+TC.d30+' in 30 days'+(TC.tests?' (plus '+TC.tests+' test'+(TC.tests===1?'':'s')+')':'')+'. '+(TC.sentAll?'Opened (rough): '+TC.opened30+' of '+TC.sent30+' in 30 days'+(TC.sent30?' ('+pc(TC.openRate30)+')':'')+'.':'Opens are counted from the next one sent'+(TC.pixel?'':' once the desk\'s "Count opens with a 1x1 image" setting is on')+'.')+'</p>'
    +(TC.open.length?'<div class="fails"><b>Not sent: '+TC.open.length+'</b><br>'+TC.open.map(x=>esc((x.method==='CANCEL'?'Cancellation, ':'')+x.company+' ('+x.to+'), '+when(x.at)+': '+x.why)).join('<br>')+'</div>':'')}
  else if(r.id==='peak-deskmails'){const DM=V.peak.deskmails;h+='<p class="note">'+DM.today+' today, '+DM.d7+' in 7 days, '+DM.d30+' in 30 days.</p>'+(DM.open.length?'<div class="fails"><b>Not sent: '+DM.open.length+'</b> (Retry is on the card)<br>'+DM.open.map(x=>esc(x.company+' ('+x.to+', by '+x.by+'), '+when(x.at)+': '+x.why)).join('<br>')+'</div>':'')}
  return h;
}
/* the words a Sixfold customer email uses now, from the app (text only; the designed preview is in Change the words) */
async function drWords(r){
  const box=$('#drw'); if(!box)return; let W0;
  try{W0=await api('sxwords')}catch(e){if(e.message==='signin')return;box.textContent='The words in use could not be loaded ('+e.message.replace(/\.$/,'')+'). The built-in subject is shown above; the text is not described here until the app answers.';return}
  if(drId!==r.id||drTab!=='messages')return;
  const K=W0.kinds&&W0.kinds[r.words]; if(!K){box.textContent='The words in use are not described yet.';return}
  const lines=Object.entries(K.lines).map(([k,L])=>[L,(K.now&&K.now[k]!==undefined)?K.now[k]:L.def]);
  const sj=lines.find(x=>x[0].where==='subject'); const d=document.querySelector('#dp [data-subj]'); if(sj&&d)d.textContent=sj[1];
  box.innerHTML='<p class="note tiny"><b>'+(K.active&&K.active!=='v0'?'Version '+esc(K.active.slice(1))+' is in use.':'The built-in words are in use.')+'</b> Fields in {curly brackets} are filled in for each customer.</p><pre class="pv">'+lines.filter(x=>x[0].where!=='subject').map(x=>esc(x[1])).join('\n\n')+'</pre>';
}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(edK){edClose();return}if(drId)drClose()});
/* the Peak sender's own page, framed under the Peak list (every control it has, as before), and the Microsoft redirect switch */
function drawPeakFrame(){
  const R=V.peak.redirect||{};
  let h='<section class="card" style="margin-top:14px"><h2>Peak controls <span class="soft cnt">the Peak sender\'s own page: lists, the email, preview, Start and Pause, settings, do-not-email, Connect Microsoft</span></h2>';
  h+='<iframe id="pf" title="Peak email" src="peak/?embed=1'+(Q.get('ms')?'&ms='+encodeURIComponent(Q.get('ms')):'')+'"></iframe></section>';
  h+='<section class="card" id="ret" style="margin-top:14px"><h2>Where Microsoft comes back to</h2><p class="note">After Connect Microsoft, Microsoft returns to <code>'+esc(R.now)+'</code>, which forwards here. To have it come straight back to Outbox, add <code>'+esc(R.new)+'</code> as a redirect URI in Entra (App registrations, Matthew outreach, Authentication), then switch below. The old one keeps working either way.</p>'
   +'<div class="row"><button data-ret="old"'+(R.choice==='old'?' class="main"':'')+'>The old address (registered)</button><button data-ret="outbox"'+(R.choice==='outbox'?' class="main"':'')+'>Outbox directly (add it in Entra first)</button></div></section>';
  $('#secPeak').innerHTML=h;
  peakFrame=$('#pf'); const fit=()=>{try{const d=peakFrame.contentDocument;if(d&&d.documentElement)peakFrame.style.height=Math.max(600,(d.body?d.body.scrollHeight:d.documentElement.scrollHeight)+8)+'px'}catch(e){}};
  /* a change made in the Peak controls shows in the list too: Outbox's state is read again whenever the framed page has answered */
  peakFrame.addEventListener('load',()=>{fit();try{new ResizeObserver(fit).observe(peakFrame.contentDocument.body)}catch(e){setInterval(fit,1500)}});
  document.querySelectorAll('[data-ret]').forEach(b=>b.onclick=async()=>{const to=b.dataset.ret;if(to==='outbox'&&!confirm('Only switch once '+R.new+' is added in Entra. If it is not, Microsoft will refuse the sign-in. Switch?'))return;try{await api('peakreturn',{to});await load();const n=$('#ret');if(n){n.remove();peakFrame=null;drawPeakFrame()}}catch(e){flash(esc(e.message))}});
}
function draw(){
  document.body.dataset.sec=tab; drawTop();
  drawSecTop(); drawList();
  if(tab==='peak'){if(!peakFrame||!document.body.contains(peakFrame))drawPeakFrame()}
  else{peakFrame=null;$('#secPeak').innerHTML=''}
  if(drId){if(byId(drId))drDraw();else drClose()}
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
load(); setInterval(()=>{if(!document.hidden&&V)load()},5*60*1000);
</script>
</body>
</html>

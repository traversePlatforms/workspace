/* Audit crawl (30 Oct): every button reachable from Home, per install, role, viewport and theme. Read-only against the harness's
   own throwaway data (no saves, sends, deletes or payments are clicked). Writes results/<install>.jsonl and shots/<install>/.
   node crawl.mjs <install> <roles,comma> <vps,comma> <themes,comma> [deep]
   install = roofing|yards|solar|pest|security|sixfold (the harness must already be in that mode: node ed-mode.cjs <install>) */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { call, signin, sleep, jars } from './lib1030.mjs';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-audit';
const ORIGIN = 'http://127.0.0.1:8807';
const [inst, rolesArg, vpsArg, themesArg, deepArg] = process.argv.slice(2);
const ROLES = (rolesArg || 'admin').split(','), VPS = (vpsArg || 'phone').split(','), THEMES = (themesArg || 'light').split(','), DEEP = deepArg === 'deep';
const CDP_PORT = 9400 + Math.floor(Math.random() * 400);
const OUT = DIR + '/results', SH = DIR + '/shots/' + inst;
mkdirSync(OUT, { recursive: true }); mkdirSync(SH, { recursive: true });
const LOG = OUT + '/' + inst + (DEEP ? '-deep' : '') + '.jsonl';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const VP = { phone: { w: 390, h: 844, ua: IPHONE, touch: true, dev: 'm' }, tabP: { w: 820, h: 1180, ua: IPAD, touch: true, dev: 't' }, tabL: { w: 1180, h: 820, ua: IPAD, touch: true, dev: 't' }, desk: { w: 1440, h: 900, ua: null, touch: false, dev: 'c' } };
const ED = inst !== 'sixfold';
/* never clicked: anything that saves, sends, spends, deletes or signs out */
const DANGER = /sign out|log out|delete|remove|send|charge|refund|cancel|pay\b|pay now|reset|new code|turn (on|off)|archive|undo|clear|disconnect|revoke|approve|import|upload|merge|paid|book it|book this|confirm|save|accept|agree|subscribe|checkout|subscription|test (email|send)|connect|download|backup|print|install|share|call\b|text\b|email\b|start the quote|mark |won|lost|not now|no answer|booked|hand|give|assign|take off|unassign|recall|refresh data|rebuild|restore|copy link|open in|directions|google maps|map it|\bcall\b|^\(?\d{3}/i;

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdpa-'))}`, 'about:blank'], { stdio: 'ignore' });
let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
const B = { errors: [], fails: [], started: new Map(), inflight: new Map(), lastNet: Date.now(), reqs: 0, bytes: 0, dialogs: [] };
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  const P = m.params || {};
  switch (m.method) {
    case 'Page.javascriptDialogOpening': B.dialogs.push(P.type + ': ' + String(P.message).slice(0, 120)); send('Page.handleJavaScriptDialog', { accept: P.type !== 'prompt' ? true : false }); break;
    case 'Runtime.exceptionThrown': B.errors.push('exception: ' + String(P.exceptionDetails.exception?.description || P.exceptionDetails.text).split('\n').slice(0, 2).join(' | ')); break;
    case 'Runtime.consoleAPICalled': if (P.type === 'error') B.errors.push('console.error: ' + P.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200)); break;
    case 'Log.entryAdded': if (P.entry.level === 'error' && !/favicon/.test(P.entry.url || '')) B.errors.push('log: ' + String(P.entry.text).slice(0, 160) + (P.entry.url ? ' ' + P.entry.url.slice(0, 120) : '')); break;
    case 'Network.requestWillBeSent': B.inflight.set(P.requestId, P.request.url); B.started.set(P.requestId, Date.now()); B.lastNet = Date.now(); B.reqs++; break;
    case 'Network.responseReceived': { const u = P.response.url, s = P.response.status; if (s >= 400 && !/favicon/.test(u)) B.fails.push(s + ' ' + shortUrl(u)); break; }
    case 'Network.loadingFinished': B.bytes += P.encodedDataLength || 0; B.inflight.delete(P.requestId); B.lastNet = Date.now(); break;
    case 'Network.loadingFailed': { const u = B.inflight.get(P.requestId) || ''; B.inflight.delete(P.requestId); B.lastNet = Date.now(); if (!P.canceled && !/favicon/.test(u)) B.fails.push('failed(' + P.errorText + ') ' + shortUrl(u)); break; }
  }
};
function shortUrl(u) { return u.replace(ORIGIN, '').replace(/([?&](_|r|v|t)=)[^&]+/g, '$1…').slice(0, 140); }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__mut=Date.now();new MutationObserver((l)=>{window.__mut=Date.now();const t=l[0]&&l[0].target;window.__mutBy=t?(t.nodeName+'.'+String(t.className||t.id||'').slice(0,40)+' '+l[0].type+' '+(l[0].attributeName||'')):''}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});` });
const js = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }; return r.result?.value; };
/* settled: no request in flight (map tiles count) and no DOM change for 400 ms, at most cap ms */
async function firstPaint(cap) { const t0 = Date.now(); while (Date.now() - t0 < cap) { const ok = await js("(()=>{const v=document.querySelector('#view');if(!v)return false;if(v.querySelector('.skel'))return false;return (v.innerText||'').trim().length>30||!!v.querySelector('.leaflet-container,canvas,table')})()"); if (ok) return Date.now() - t0; await sleep(50); } return -cap; }
async function settle(cap = 20000) {
  const t0 = Date.now(); await sleep(120);
  while (Date.now() - t0 < cap) {
    const busy = [...B.inflight.keys()].filter((k) => Date.now() - (B.started.get(k) || 0) < 8000).length;
    const mut = await js('Date.now()-(window.__mut||0)');
    if (!busy && Date.now() - B.lastNet > 400 && mut > 400) return Date.now() - t0;
    await sleep(100);
  }
  B.why = { busy: [...B.inflight.values()].slice(0, 4).map(shortUrl), mutAge: await js('Date.now()-(window.__mut||0)'), mutBy: await js('window.__mutBy||""') };
  if (process.env.DEBUG_SETTLE) console.log('  not settled:', JSON.stringify(B.why));
  return -(Date.now() - t0);   /* negative: never settled */
}
const isHome = () => js(`!!document.querySelector('#view .choose, #view .dhome, #view .ohome, #view .crewhome')`);
const homeHint = () => js(`(()=>{const v=document.querySelector('#view');return v?(v.firstElementChild?v.firstElementChild.className:'')+'|'+(document.querySelector('#barin .ttl')||{}).textContent:''})()`);

async function shot(name, full) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 62 });
  writeFileSync(`${SH}/${name}.jpg`, Buffer.from(r.data, 'base64'));
  return `${inst}/${name}.jpg`;
}
/* what's on screen, checked against the failure classes */
const INSPECT = `(()=>{
  const W=innerWidth,H=innerHeight, out={};
  const vis=(el)=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'};
  const txt=(el)=>(el.innerText||'').replace(/\\s+/g,' ').trim();
  out.title=((document.querySelector('#barin .ttl')||{}).innerText||'').replace(/\\s+/g,' ').trim();
  const dn=document.querySelector('#dnav [aria-current], #dnav .on'); out.dnav=dn?txt(dn):'';
  const view=document.querySelector('#view'); out.viewText=view?txt(view).length:0;
  out.media=view?view.querySelectorAll('canvas,img,svg,.leaflet-container,table,iframe').length:0;
  out.scrollY=Math.round(scrollY); out.docH=document.documentElement.scrollHeight;
  out.hscroll=document.documentElement.scrollWidth-W;
  const over=[];
  for(const el of document.querySelectorAll('#view *, #barin *, #dnav *, #tabnav *, #dock *')){
    if(over.length>=6)break; if(!vis(el))continue; const r=el.getBoundingClientRect();
    if(r.right>W+2&&r.left<W&&!el.closest('.leaflet-container,.hscroll,[style*="overflow-x"],table,.tablecard,.chips,.dnl,.seg,.tabs,pre')){
      let p=el.parentElement,inScroll=false;while(p){const s=getComputedStyle(p);if(/(auto|scroll|hidden)/.test(s.overflowX)&&p.scrollWidth>p.clientWidth+2){inScroll=true;break}p=p.parentElement}
      if(!inScroll)over.push((el.tagName+'.'+(el.className&&el.className.baseVal===undefined?el.className:'')).slice(0,40)+' "'+txt(el).slice(0,30)+'" right='+Math.round(r.right));
    }
  }
  out.overflow=over;
  const clip=[];
  for(const el of document.querySelectorAll('#view button, #view h2, #view h3, #view .tt b, #barin .ttl, #dnav button, #tabnav button, #view .tag, #view label')){
    if(clip.length>=6)break; if(!vis(el))continue; const s=getComputedStyle(el);
    if((el.scrollWidth>el.clientWidth+3&&/(hidden|clip)/.test(s.overflowX)&&el.clientWidth>0)) clip.push(el.tagName+' "'+txt(el).slice(0,40)+'" '+el.clientWidth+'<'+el.scrollWidth);
  }
  out.clipped=clip;
  /* white or near-white panels in dark mode; any panel whose text colour equals its background */
  const dark=matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.getAttribute('data-theme')!=='light';
  out.dark=dark;
  const lum=(c)=>{const m=c.match(/[\\d.]+/g);if(!m)return null;if(m.length>3&&+m[3]<0.5)return null;const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(+m[0])+0.7152*f(+m[1])+0.0722*f(+m[2])};
  const white=[], lowc=[];
  for(const el of document.querySelectorAll('#view *, .modal *, .sheet *, dialog *')){
    if(white.length>=5&&lowc.length>=5)break; if(!vis(el)||el.closest('.leaflet-container,img,canvas,svg,.ti,.mk,.logo,.photo,.qr,video'))continue;
    const s=getComputedStyle(el), r=el.getBoundingClientRect(), L=lum(s.backgroundColor);
    if(dark&&L!==null&&L>0.75&&r.width*r.height>12000&&white.length<5) white.push(el.tagName+'.'+String(el.className).slice(0,30)+' "'+txt(el).slice(0,40)+'" '+Math.round(r.width)+'x'+Math.round(r.height));
    if(el.childNodes.length&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1)&&lowc.length<5){
      let p=el,bg=null;while(p&&bg===null){bg=lum(getComputedStyle(p).backgroundColor);p=p.parentElement}
      if(bg===null)bg=lum(getComputedStyle(document.body).backgroundColor);
      const fg=lum(s.color); if(fg!==null&&bg!==null){const cr=(Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05); if(cr<2.2) lowc.push(el.tagName+' "'+txt(el).slice(0,40)+'" '+cr.toFixed(1)+':1');}
    }
  }
  out.white=white; out.lowContrast=lowc;
  /* words a rep or client reads */
  const all=[view,document.querySelector('#barin'),document.querySelector('#dnav'),document.querySelector('#tabnav'),document.querySelector('#dock')].filter(Boolean).map(txt).join(' \\u2016 ');
  const grab=(re)=>{const o=[];let m;const g=new RegExp(re.source,'gi');while((m=g.exec(all))&&o.length<6)o.push(all.slice(Math.max(0,m.index-35),m.index+m[0].length+25));return o};
  out.doorWords=grab(/\\bdoors?\\b/); out.sixWords=grab(/sixfold|\\b365\\b|aeration 365|\\bjen\\b|mcpherson|brandon|clickup|meta ad|messenger/);
  out.lawnWords=grab(/\\blawn|aerat|overseed|fertili/); out.travWords=grab(/traverse/); out.routeWords=grab(/\\broutes?\\b/);
  /* small tap targets on touch screens */
  const small=[]; if(matchMedia('(pointer: coarse)').matches) for(const el of document.querySelectorAll('#view button, #view a[href], #view select, #view input, #barin button, #tabnav button')){ if(!vis(el))continue; const r=el.getBoundingClientRect(); if((r.height<32||r.width<32)&&small.length<200) small.push(el.tagName+' "'+(txt(el)||el.getAttribute('aria-label')||el.placeholder||'').slice(0,24)+'" '+Math.round(r.width)+'x'+Math.round(r.height)); }
  out.smallTaps=small.length; out.smallEx=small.slice(0,4);
  out.backVisible=!![...document.querySelectorAll('#barin button.back, #dock .dback')].find(vis);
  out.toast=((document.querySelector('#toast.show #toastMsg')||{}).innerText||'').slice(0,120);
  out.sig=(view?view.innerHTML.length:0)+':'+out.title+':'+document.body.className+':'+out.toast+':'+document.querySelectorAll('[aria-expanded="true"]').length;
  return out;})()`;

const CANDS = (scope) => `(()=>{
  const vis=(el)=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'};
  ${scope === 'home' ? `document.querySelectorAll('#view button[aria-expanded="false"]').forEach(b=>{if(/ogrp|cty|fold|grp/.test(b.className))b.click()});` : ''}
  const els=[...document.querySelectorAll(${JSON.stringify(scope === 'home' ? '#view button, #view a[href], #view [role=button], #dnav button, #dnav a, #tabnav button' : '#view button, #view a[href], #view [role=button], #view select')})].filter(vis);
  const seen=new Set(), out=[];
  for(const el of els){ if(el.disabled||el.getAttribute('aria-disabled')==='true')continue;
    const t=((el.querySelector('.tt b')||{}).innerText||el.innerText||el.getAttribute('aria-label')||el.title||'').replace(/\\s+/g,' ').trim().slice(0,60);
    const where=el.closest('#dnav')?'dnav':el.closest('#tabnav')?'tab':'view';
    const k=where+'|'+t; if(!t||seen.has(k))continue; seen.add(k);
    const href=el.tagName==='A'?el.getAttribute('href'):''; out.push({t,where,tag:el.tagName,href,dl:el.hasAttribute('download'),tgt:el.target||''}); }
  return out;})()`;
const CLICK = (c) => `(()=>{
  const vis=(el)=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'};
  document.querySelectorAll('#view button[aria-expanded="false"]').forEach(b=>{if(/ogrp/.test(b.className))b.click()});
  const sel=${JSON.stringify(c.where === 'dnav' ? '#dnav button, #dnav a' : c.where === 'tab' ? '#tabnav button' : '#view button, #view a[href], #view [role=button], #view select')};
  const el=[...document.querySelectorAll(sel)].filter(vis).find(e=>((e.querySelector('.tt b')||{}).innerText||e.innerText||e.getAttribute('aria-label')||e.title||'').replace(/\\s+/g,' ').trim().slice(0,60)===${JSON.stringify(c.t)});
  if(!el)return {found:false};
  el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2;
  const top=document.elementFromPoint(x,y); const covered=top&&top!==el&&!el.contains(top)&&!top.contains(el)?(top.tagName+'.'+String(top.className).slice(0,30)+' "'+(top.innerText||'').slice(0,30)+'"'):'';
  if(el.tagName==='SELECT'){ return {found:true,covered,select:true}; }
  el.click(); return {found:true,covered,w:Math.round(r.width),h:Math.round(r.height)};})()`;

async function openApp(who, v, theme, cold) {
  await send('Network.clearBrowserCookies');
  await send('Network.setCookie', { name: jar[who].split('=')[0], value: jar[who].slice(jar[who].indexOf('=') + 1), url: ORIGIN });
  await send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.touch });
  try { await send('Emulation.setTouchEmulationEnabled', v.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false, maxTouchPoints: 1 }); } catch (e) { console.log('touch emu', e.message); }
  if (cold) await send('Network.clearBrowserCache');
  try { await send('Emulation.setEmitTouchEventsForMouse', { enabled: v.touch }); } catch (e) { console.log('touch mouse', e.message); }
  if (v.ua) await send('Emulation.setUserAgentOverride', { userAgent: v.ua, platform: v.ua === IPHONE ? 'iPhone' : 'MacIntel' }); else await send('Emulation.setUserAgentOverride', { userAgent: '' });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'pointer', value: v.touch ? 'coarse' : 'fine' }, { name: 'hover', value: v.touch ? 'none' : 'hover' }] });
  B.errors.length = 0; B.fails.length = 0; B.reqs = 0; B.bytes = 0;
  const t0 = Date.now();
  await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() });
  await sleep(300);
  for (let k = 0; k < 300; k++) { if (await isHome()) break; await sleep(100); }
  const tHome = Date.now() - t0; const st = await settle(20000);
  return { tHome, tSettled: Date.now() - t0, settled: st >= 0, reqs: B.reqs, bytes: B.bytes };
}
async function goBack() {
  const r = await js(`(()=>{const vis=(el)=>{const r=el.getBoundingClientRect();return r.width>1&&r.height>1&&getComputedStyle(el).visibility!=='hidden'};const b=[...document.querySelectorAll('#barin button.back, #dock .dback')].find(vis);if(b){const lbl=(b.innerText||b.getAttribute('aria-label')||'').trim();b.click();return lbl||'back'}return ''})()`);
  if (r) await settle(12000);
  return r;
}
const jar = {};
const CODES = { super: '777777', admin: '222222', crew: '111111' };
async function prepRoles() {
  for (const w of ['super', 'admin', 'crew']) { const j = await signin(w, CODES[w], 'c'); if (!j.ok) throw new Error('signin ' + w + ' ' + j._status); }
const TAG = String(Date.now() % 1000000).split('').map((d) => 'abcdefghij'[+d]).join('');
  /* an office account made for this run (the codes stay in memory) */
  const add = await call('admin', 'accountadd', null, { name: 'Audit Office ' + inst + ' ' + TAG, role: 'office' });
  if (add.ok && add.code) { CODES.office = add.code; } else {
    console.log('office add failed', add._status, add.error || '');
  }
  const add2 = await call('admin', 'accountadd', null, { name: 'Audit Manager ' + inst + ' ' + TAG, role: 'manager' });
  if (add2.ok && add2.code) CODES.manager = add2.code;
}
await prepRoles();
async function freshJar(who, v) {
  const j = await signin('x' + who, CODES[who], v.dev);
  if (j.terms && j.terms.due) await call('x' + who, 'termsaccept', null, { terms: j.terms.terms, agreement: j.terms.agreement || undefined });
  jar[who] = jars['x' + who];
  return j;
}
const rec = (o) => appendFileSync(LOG, JSON.stringify(o) + '\n');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
for (const role of ROLES) {
  if (!CODES[role]) { console.log('no code for', role); continue; }
  for (const vpk of VPS) {
    const v = VP[vpk];
    for (const theme of THEMES) {
      const sj = await freshJar(role, v);
      if (!sj.ok) { console.log('signin failed', role, vpk, sj._status, sj.error); continue; }
      const ctx = { inst, role, vp: vpk, theme };
      const o = await openApp(role, v, theme, true);
      const home = await js(INSPECT);
      const hs = await shot(`${role}-${vpk}-${theme}-00-home`);
      rec({ ...ctx, kind: 'home', open: o, errors: [...B.errors], fails: [...B.fails], ...home, shot: hs });
      console.log(`${inst} ${role} ${vpk} ${theme}: home ${o.tHome} ms (settled ${o.tSettled}${o.settled ? '' : ' NOT'}), ${o.reqs} req, ${Math.round(o.bytes / 1024)} KB, errors ${B.errors.length}, fails ${B.fails.length}`);
      const homeScrollH = home.docH;
      const cands = (await js(CANDS('home'))) || [];
      let n = 0;
      for (const c of cands) {
        n++;
        if (c.dl || (c.href && /^(https?:|mailto:|tel:|sms:)/.test(c.href)) || c.tgt === '_blank') { rec({ ...ctx, kind: 'link', item: c.t, where: c.where, href: c.href }); continue; }
        if (/sign out|log out|delete|remove|download|backup|^install|not now/i.test(c.t)) { rec({ ...ctx, kind: 'skipped', item: c.t, where: c.where }); continue; }
        if (!(await isHome())) { await openApp(role, v, theme); }
        const before = await js(INSPECT);
        B.errors.length = 0; B.fails.length = 0; B.dialogs.length = 0; const r0 = B.reqs, b0 = B.bytes;
        const t0 = Date.now();
        const cl = await js(CLICK(c));
        if (!cl || !cl.found) { rec({ ...ctx, kind: 'item', item: c.t, where: c.where, found: false }); continue; }
        const tf = await firstPaint(15000); const st = await settle(c.t.match(/radar|map|office|dashboard|plan|propert|routes|doors/i) ? 20000 : 12000);
        const dt = Date.now() - t0;
        const after = await js(INSPECT);
        if (after && after.__err) { rec({ ...ctx, kind: 'item', item: c.t, inspectErr: after.__err }); continue; }
        const nowHome = await isHome();
        const noop = after.sig === before.sig && B.reqs === r0 && !B.dialogs.length;
        const url = await js('location.pathname+location.hash');
        const name = `${role}-${vpk}-${theme}-${String(n).padStart(2, '0')}-${slug(c.t)}`;
        let sh = null;
        const interesting = B.errors.length || B.fails.length || after.overflow.length || after.white.length || after.clipped.length || (after.viewText < 30 && !after.media && !nowHome) || st < 0 || (ED && (after.doorWords.length || after.sixWords.length));
        if (!nowHome || interesting) sh = await shot(name);
        let back = null;
        if (!nowHome && url.indexOf('/summit-de59ae83/') >= 0) {
          const tb = Date.now(); const lbl = await goBack(); const atHome = await isHome(); const where2 = await homeHint();
          back = { label: lbl, home: atHome, landed: atHome ? 'home' : where2, ms: Date.now() - tb };
        }
        rec({ ...ctx, kind: 'item', item: c.t, where: c.where, tag: c.tag, ms: dt, first: tf, settled: st >= 0, why: st < 0 ? B.why : undefined, reqs: B.reqs - r0, kb: Math.round((B.bytes - b0) / 1024), covered: cl.covered, tap: cl.w ? cl.w + 'x' + cl.h : '', noop, home: nowHome, title: after.title, dnav: after.dnav, viewText: after.viewText, media: after.media, scrollY: after.scrollY, hscroll: after.hscroll, overflow: after.overflow, clipped: after.clipped, white: after.white, lowContrast: after.lowContrast, doorWords: after.doorWords, sixWords: after.sixWords, lawnWords: after.lawnWords, travWords: after.travWords, routeWords: after.routeWords, smallTaps: after.smallTaps, smallEx: after.smallEx, backVisible: after.backVisible, errors: [...B.errors], fails: [...B.fails], dialogs: [...B.dialogs], toast: after.toast, url, back, shot: sh });
        /* one level down: every safe button on this screen (deep runs) */
        if (DEEP && !nowHome) {
          if (!(await isHome())) await openApp(role, v, theme);
          await js(CLICK(c)); await settle(20000);
          const screenTitle = (await js(INSPECT)).title;
          const subs = ((await js(CANDS('screen'))) || []).slice(0, 40);
          let m = 0;
          for (const s of subs) {
            m++;
            if (s.dl || (s.href && /^(https?:|mailto:|tel:|sms:|#)/.test(s.href)) || s.tgt === '_blank') { rec({ ...ctx, kind: 'sublink', screen: c.t, item: s.t, href: s.href }); continue; }
            if (DANGER.test(s.t) || s.tag === 'SELECT') { rec({ ...ctx, kind: 'subskipped', screen: c.t, item: s.t }); continue; }
            const cur = await js(INSPECT);
            if (cur.title !== screenTitle) { if (!(await isHome())) await openApp(role, v, theme); await js(CLICK(c)); await settle(20000); }
            const bf = await js(INSPECT);
            B.errors.length = 0; B.fails.length = 0; B.dialogs.length = 0; const q0 = B.reqs;
            const ts = Date.now(); const cl2 = await js(CLICK(s));
            if (!cl2 || !cl2.found) { rec({ ...ctx, kind: 'sub', screen: c.t, item: s.t, found: false }); continue; }
            const st2 = await settle(10000); const af = await js(INSPECT);
            if (af && af.__err) continue;
            const noop2 = af.sig === bf.sig && B.reqs === q0 && !B.dialogs.length;
            const moved = af.title !== bf.title;
            let sh2 = null, back2 = null;
            if (B.errors.length || B.fails.length || af.white.length || af.overflow.length || (af.viewText < 30 && !af.media)) sh2 = await shot(`${name}--${String(m).padStart(2, '0')}-${slug(s.t)}`);
            if (moved && !(await isHome())) { const lbl = await goBack(); const t2 = (await js(INSPECT)).title; back2 = { label: lbl, landed: (await isHome()) ? 'home' : t2, ok: t2 === screenTitle }; }
            rec({ ...ctx, kind: 'sub', screen: c.t, screenTitle, item: s.t, ms: Date.now() - ts, settled: st2 >= 0, noop: noop2, moved, title: af.title, covered: cl2.covered, tap: cl2.w ? cl2.w + 'x' + cl2.h : '', viewText: af.viewText, media: af.media, overflow: af.overflow, white: af.white, clipped: af.clipped, doorWords: af.doorWords, sixWords: af.sixWords, errors: [...B.errors], fails: [...B.fails], dialogs: [...B.dialogs], toast: af.toast, back: back2, shot: sh2 });
          }
          await openApp(role, v, theme);
        }
      }
      console.log(`  ${cands.length} items`);
    }
  }
}
ws.close(); chrome.kill(); process.exit(0);

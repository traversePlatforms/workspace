// Homepage screenshots of the real app (2026-10-13, Matthew: "fix all the should dos"), on the LOCAL Roofing test copy only.
// Homeowners' names AND street addresses are replaced on screen before anything is captured (names with "name hidden",
// addresses with made-up streets), so no real owner or address can be read off a picture. Never run against a live install.
//   node shots.mjs [town]      writes ../../marketing-site/site-src/shots/{phone-door,desk-workspace}.png
import { writeFileSync, mkdirSync } from 'node:fs'; import { chrome, attach, session, api, sleep } from './lib.mjs';
const TOWN = process.argv[2] || 'castle-rock', ORIGIN = 'http://127.0.0.1:8791', APP = ORIGIN + '/tr-cb2e8587/', API = ORIGIN + '/api/traverse-rounds.php';
if (!/^http:\/\/127\.0\.0\.1:/.test(ORIGIN)) throw new Error('local test copy only');
const OUT = new URL('../../marketing-site/site-src/shots/', import.meta.url); mkdirSync(OUT, { recursive: true });
/* failure pictures can show unmasked text: they go to out/ here (gitignored, never the site) */
const FAILS = new URL('out/shots-fail/', import.meta.url); mkdirSync(FAILS, { recursive: true });

/* a neighbourhood with hail, roof sizes and materials on most doors, nothing marked yet */
const call = api(API); await call('admin', 'signin', {}, { code: '333333' });
const rg = (await call('admin', 'regions')).j.regions.find((x) => x.key === TOWN);
let best = null;
for (const a of rg.areas.filter((x) => x.total >= 12 && x.total <= 30)) {
  const ds = (await call('admin', 'area', { region: TOWN, area: a.name })).j.doors || [];
  const score = ds.filter((d) => d.hail && d.hail.length >= 2).length * 2 + ds.filter((d) => d.mat).length + ds.filter((d) => d.roof).length;
  if (!best || score > best.score) best = { area: a.name, score, doors: ds };
}
await call('admin', 'signout', {}, {});
const names = [...new Set(best.doors.map((d) => String(d.owner || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
const STREETS = ['Ridge View Ct', 'Pine Hollow Dr', 'Granite Ln', 'Juniper Way', 'Aspen Bluff Ct', 'Meadowlark Dr', 'Stone Creek Ln', 'Prairie Sky Ct', 'Willow Bend Dr', 'Cedar Point Ln'];
const addrMap = {}; let k = 0;
for (const d of best.doors) { const m = String(d.address || '').match(/^(\d+)\s+(.+)$/); if (!m) continue; const st = m[2]; if (!addrMap[st]) addrMap[st] = STREETS[k++ % STREETS.length]; }
const streets = Object.keys(addrMap).sort((a, b) => b.length - a.length);
/* the neighbourhood's own name carries street names too, and the mask rewrites them on screen */
/* made-up house numbers too (2026-10-28, Matthew: "Swap it with a made up address and number"): the same digits count, odd stays odd */
const NUM = (n) => { const v = parseInt(n, 10), d = String(n).length; if (d < 3) return String(n); const lo = 10 ** (d - 1), span = 9 * lo; let x = ((v - lo + 2468) % span) + lo; if (x % 2 !== v % 2) x = x + 1 >= lo + span ? x - 1 : x + 1; return String(x); };
const ADDR = []; for (const d of best.doors) { const m = String(d.address || '').match(/^(\d+)\s+(.+)$/); if (m && addrMap[m[2]]) ADDR.push([m[1] + ' ' + m[2], NUM(m[1]) + ' ' + addrMap[m[2]]]); }
ADDR.sort((a, b) => b[0].length - a[0].length);
let AREA = best.area.replace(/\b(\d{3,6})\b/g, (n) => NUM(n)); for (const st of streets) AREA = AREA.split(st).join(addrMap[st]);
const AREA_REAL = best.area;
console.log('masked area name:', AREA, '; doors', best.doors.length, 'streets masked', streets.length, 'names masked', names.length);

const MASK = `(() => {
  const NAMES = ${JSON.stringify(names)}, ST = ${JSON.stringify(streets)}, MAP = ${JSON.stringify(addrMap)}, ADDR = ${JSON.stringify(ADDR)}, AREA_REAL = ${JSON.stringify(AREA_REAL)}, AREA = ${JSON.stringify(AREA)};
  const CODE = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;
  const fixNode = (n) => { if (n.parentNode && CODE.test(n.parentNode.nodeName)) return; const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
  const fix = (t) => { let s = t; for (const n of NAMES) if (s.indexOf(n) >= 0) s = s.split(n).join('name hidden');
    for (const [a, b] of ADDR) if (s.indexOf(a) >= 0) s = s.split(a).join(b);
    if (s.indexOf(AREA_REAL) >= 0) s = s.split(AREA_REAL).join(AREA);
    for (const st of ST) if (s.indexOf(st) >= 0) s = s.split(st).join(MAP[st]);
    /* marketing pictures never name where the data comes from (Matthew 2026-10-06) */
    s = s.replace(/ ?\\(Census[^)]*\\)/g, '').replace(/ ?\\((NOAA reports|radar estimate|county)\\)/g, '').replace(/County value/g, 'Home value').replace(/\\bNOAA\\b ?/g, '');
    return s.replace(/Owner: (?!name hidden)[A-Z][A-Z .,&'-]+/g, 'Owner: name hidden'); };
  /* the page does not exist yet when this runs: anything that touches it waits for it */
  document.addEventListener('DOMContentLoaded', () => { const css = document.createElement('style'); css.textContent = '.leaflet-control-attribution{display:none!important}'; document.head.appendChild(css); });
  document.addEventListener('DOMContentLoaded', () => { const hide = () => [...document.querySelectorAll('button')].forEach((b) => { if (/^Look up number/.test(b.textContent.trim())) b.style.display = 'none'; }); hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true }); });
  const walk = (root) => { const tw = document.createTreeWalker(root, 4); let n; while ((n = tw.nextNode())) fixNode(n); };
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fixNode(m.target); else m.addedNodes.forEach((n) => { if (n.nodeType === 3) fixNode(n); else if (n.nodeType === 1 && !CODE.test(n.nodeName)) walk(n); }); } })
    .observe(document, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', () => walk(document.documentElement));
})();`;
if (process.env.MASKCHECK) { writeFileSync(process.env.MASKCHECK, MASK); process.exit(0); }

async function shoot(W, H, DPR, mobile, file, steps) {
  const port = 9790 + Math.floor(Math.random() * 30); const ch = chrome(port);
  const P = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await P.ready;
  await P.send('Runtime.enable'); await P.send('Page.enable');
  await P.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile });
  await P.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'light' }] });
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: MASK });
  const js = async (e) => (await P.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  const until = async (e, label, ms = 20000) => { for (let i = 0; i < ms; i += 200) { if (await js(e)) return; await sleep(200); } const f = await P.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(new URL('fail-' + label + '.png', FAILS), Buffer.from(f.data, 'base64')); console.log('url', await js('location.href'), '| masked name on screen:', await js(`document.body.innerText.includes(${JSON.stringify(AREA)})`)); throw new Error('timeout ' + label); };
  await P.send('Page.navigate', { url: APP });
  await until(`!!document.querySelector('.keys')`, 'keys');
  await js(`localStorage.setItem('traverse.rounds.sort','best'); localStorage.setItem('traverse.rounds.sat','0')`);
  await js(`(()=>{for(const k of '333333'){[...document.querySelectorAll('.keys button')].find(b=>b.getAttribute('aria-label')===k).click()}return 1})()`);
  await steps(js, until);
  /* tidy: a source word that sat in its own span leaves '()' behind once masked; drop the empty spans and the brackets */
  await js(`(()=>{ document.querySelectorAll('#view *, .dkcard *, body *').forEach(e=>{ if (!e.children.length && e.textContent.trim()==='' && /^(SPAN|SMALL|I|EM|B)$/.test(e.nodeName) && !e.closest('.leaflet-container, [class*=legend], [class*=key]') && !getComputedStyle(e).backgroundColor.match(/rgba?((?!0, 0, 0, 0)/) && getComputedStyle(e).borderTopWidth === '0px') e.remove(); });
    const tw=document.createTreeWalker(document.body,4); const ns=[]; let n; while((n=tw.nextNode())) ns.push(n);
    for (let i=0;i<ns.length;i++){ const t=ns[i]; if (/^(SCRIPT|STYLE)$/.test(t.parentNode.nodeName)) continue; t.nodeValue=t.nodeValue.replace(/ ?\\(\\s*\\)/g,'');
      if (/ ?\\($/.test(t.nodeValue) && ns[i+1] && /^\\)/.test(ns[i+1].nodeValue)) { t.nodeValue=t.nodeValue.replace(/ ?\\($/,''); ns[i+1].nodeValue=ns[i+1].nodeValue.replace(/^\\)/,''); } }
    return 1 })()`);
  await sleep(300);
  /* last check: no unmasked owner name or real street on screen */
  const leak = await js(`(()=>{const t=document.body.innerText; if (${JSON.stringify(names)}.some(x=>t.includes(x))) return 'an owner name'; if (${JSON.stringify(streets)}.some(x=>t.includes(x))) return 'a real street'; if (${JSON.stringify(best.doors.map((d) => { const m = String(d.address || '').match(/^(\d+)\s+(.+)$/); return m ? m[1] + ' ' + (addrMap[m[2]] || m[2]) : null; }).filter(Boolean))}.some(x=>t.includes(x))) return 'a real house number'; const m=t.match(/NOAA|radar estimate|\(county\)|NAIP|Planetary/); return m ? 'source word: ' + m[0] : ''})()`);
  if (leak) { const f = await P.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(new URL('fail-leak.png', FAILS), Buffer.from(f.data, 'base64')); throw new Error('not saved: ' + leak + ' on screen'); }
  const s = await P.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(new URL(file, OUT), Buffer.from(s.data, 'base64'));
  console.log('saved', file); ch.kill();
}
/* to the door: the app's own address search (the town lists are long and draw as they scroll). The address typed is
   the real one, inside this local browser only; what the screen then shows is masked. */
const star = best.doors.slice().sort((a, b) => ((b.hail || []).length * 2 + (b.mat ? 1 : 0) + (b.roof ? 1 : 0)) - ((a.hail || []).length * 2 + (a.mat ? 1 : 0) + (a.roof ? 1 : 0)))[0];
const openArea = (js, until) => async () => {
  await until(`[...document.querySelectorAll('.findbox, #dnav input, input[type=search]')].some(b=>b.offsetParent)`, 'home'); await sleep(800);   /* the home screen's own search box (2026-10-28) */
  console.log('search step:', await js(`(()=>{const h=[...document.querySelectorAll('input[type=search]')].find(x=>x.offsetParent && /Find an address/.test(x.placeholder)); if(h){h.value=${JSON.stringify(star.address)}; h.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return 'home'} const f=document.querySelector('.findbox'); if(f && f.offsetParent){f.click(); return 'box'} const i=document.querySelector('#dnav input[type=search]'); if(i){i.value=${JSON.stringify(star.address)}; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return 'bar'} return 'none'})()`)); await sleep(3000); console.log('after search:', await js(`JSON.stringify({q: !!document.getElementById('searchq'), rows: document.querySelectorAll('.srow').length, text: document.body.innerText.slice(0, 160)})`));
  await until(`!!document.getElementById('searchq') || !!document.querySelector('.srow')`, 'search', 20000);
  await js(`(()=>{const i=document.getElementById('searchq'); if(i && !i.value){i.value=${JSON.stringify(star.address)}; i.dispatchEvent(new Event('input',{bubbles:true}));} return 1})()`);
  await until(`!!document.querySelector('.srow')`, 'results', 20000);
  await js(`document.querySelector('.srow').click()`);
  await until(`!!document.querySelector('#view .door, .dkrow')`, 'doors', 25000);
};
await shoot(390, 844, 2, true, 'phone-door.png', async (js, until) => { await openArea(js, until)(); await sleep(2500); await js('window.scrollTo(0,0)'); await sleep(500); });
await shoot(1440, 900, 1, false, 'desk-workspace.png', async (js, until) => { await openArea(js, until)(); await until(`document.querySelectorAll('.leaflet-tile-loaded, .leaflet-container canvas').length > 3`, 'map', 45000);
  /* no real house in the picture (2026-10-28): the map, not the aerial photo, and the house card's own photo hidden */
  await js(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Map' && x.offsetParent); if(b) b.click(); const lab=[...document.querySelectorAll('body *')].find(e=>!e.children.length && /property line/.test(e.textContent)); let p=lab; while(p && p.offsetHeight<120) p=p.parentElement; if(p && p!==document.body) p.style.display='none'; return 1 })()`); await sleep(4000); });

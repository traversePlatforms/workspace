/* Surge site — phone audit over CDP.

   v1 (2026-09-17) checked horizontal overflow and that a hamburger existed, and
   nothing else. Matthew's read on 2026-09-19 was "I don't think it's optimised
   for mobile", and a page can pass both of those and still feel wrong on a
   phone. v2 checks the things that actually produce that feeling:

     - INPUT ZOOM: any form control under 16px makes iOS Safari zoom the page on
       focus and leave it zoomed. The single most common "not built for phones"
       tell, and invisible in a desktop browser.
     - tap targets under 24px (WCAG 2.2 2.5.8), with the spacing exemption
     - text under 12px, and body-sized prose under 14px
     - a word wider than the viewport (a long display heading that cannot wrap)
     - fixed/sticky chrome eating more than a quarter of the screen
     - images sent at more than 2x the size they render at (wasted phone data),
       and images with no width/height (layout shift)
     - contrast, composited against the real painted background
     - console errors, failed requests, page weight by type
     - the hamburger: open it, and check every link in the panel has a box
     - /contact/: pick each chooser option and probe the form it reveals
     - horizontal overflow, as before

   The device emulation is real (v1's note stands: --window-size clamps and lies).

   Run (server must be up on 8080):
     node deploy/mobile-audit.mjs                       # 390px, report only
     node deploy/mobile-audit.mjs --width=360           # a narrower phone
     node deploy/mobile-audit.mjs --shots=/,/careers/   # plus full-page PNGs to deploy/dist/mobile/
     node deploy/mobile-audit.mjs --shots=all
   Exits 1 on any failure so it can gate a bundle. */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const WIDTH = Number(opt('width', 390)), HEIGHT = 844, BASE = opt('base', 'http://localhost:8080');
const shots = opt('shots', '');
const OUT = join(SITE, 'deploy', 'dist', 'mobile'); mkdirSync(OUT, { recursive: true });

function pages(dir = SITE, base = '', acc = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('_') || n === 'deploy' || n === 'node_modules' || n === 'api' || n === 'assets') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) pages(p, `${base}${n}/`, acc);
    else if (n === 'index.html') acc.push(`/${base}`);
    else if (n === '404.html') acc.push('/404.html');
  }
  return acc.sort();
}

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) throw new Error('No Chrome found');
const profile = mkdtempSync(join(tmpdir(), 'surge-mobile-'));
const PORT = 9338;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function endpoint() {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); return (await r.json()).webSocketDebuggerUrl; } catch { await sleep(200); } }
  throw new Error('Chrome never opened its debugging port');
}
function connect(url) {
  const ws = new WebSocket(url); const pending = new Map(); let id = 0; const events = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  });
  const ready = new Promise((r) => ws.addEventListener('open', r));
  /* every call raced against a timeout — a CDP reply that never comes hangs
     the whole run, and an auditor that can hang is one nobody runs */
  const send = (method, params = {}, sessionId, ms = 12000) => new Promise((res, rej) => {
    const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
    const t = setTimeout(() => { if (pending.delete(msg.id)) res({ __timeout: method }); }, ms);
    pending.set(msg.id, (m) => { clearTimeout(t); m.error ? rej(new Error(m.error.message)) : res(m.result); });
    ws.send(JSON.stringify(msg));
  });
  return { ready, send, events, close: () => ws.close() };
}

/* ------------------------------------------------------------- the probe */
const PROBE = String.raw`(() => {
  const W = innerWidth;
  const out = { fail: [], warn: [], info: {} };
  const F = (k, m) => out.fail.push(k + ': ' + m);
  const N = (k, m) => out.warn.push(k + ': ' + m);
  const tag = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
    (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const vis = e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && (e.offsetParent || cs.position === 'fixed'); };

  /* overflow */
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) {
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 && r.width > 0 && (!worst || r.right > worst.right)) worst = { sel: tag(el), right: Math.round(r.right) };
    }
    F('overflow', 'page scrolls to ' + sw + 'px, ' + (worst ? worst.sel + ' reaches ' + worst.right : '?'));
  }

  /* a word wider than the viewport: display headings that cannot wrap */
  for (const h of document.querySelectorAll('h1,h2,h3')) {
    if (!vis(h)) continue;
    const r = document.createRange();
    for (const node of h.childNodes) {
      if (node.nodeType !== 3) continue;
      const words = node.textContent.split(/\s+/); let off = 0;
      for (const wd of words) {
        if (!wd) { off += 1; continue; }
        const i = node.textContent.indexOf(wd, off); r.setStart(node, i); r.setEnd(node, i + wd.length);
        const b = r.getBoundingClientRect();
        if (b.width > W - 40) F('heading', '"' + wd + '" is ' + Math.round(b.width) + 'px wide in ' + tag(h) + ' — cannot wrap on this phone');
        off = i + wd.length;
      }
    }
  }

  /* text size */
  const small = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    /* a <p> set uppercase and letter-spaced is a label (eyebrow, kicker), not
       reading text — hold it to the 12px floor, not the 14px prose floor */
    const cs = getComputedStyle(el);
    const label = cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) > 0;
    const isProse = !label && (el.tagName === 'P' || el.tagName === 'LI' || el.tagName === 'DD');
    if (px < 12 || (isProse && px < 14)) {
      const k = tag(el) + '@' + px.toFixed(1);
      if (!small.has(k)) small.set(k, txt(el));
    }
  }
  for (const [k, s] of small) { const px = +k.split('@')[1]; (px < 12 ? F : N)('text', k.split('@')[0] + ' is ' + px + 'px — "' + s + '"'); }

  /* INPUT ZOOM — iOS Safari zooms on focus below 16px and does not zoom back */
  for (const c of document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=submit]),select,textarea')) {
    if (!vis(c) || c.closest('[aria-hidden=true]')) continue;
    const px = parseFloat(getComputedStyle(c).fontSize);
    if (px < 16) F('input-zoom', tag(c) + ' name=' + c.name + ' is ' + px.toFixed(1) + 'px — iOS zooms the page on focus');
  }

  /* tap targets — WCAG 2.2 2.5.8, with the spacing exemption */
  const targets = [...document.querySelectorAll('a[href],button,input[type=submit],input[type=radio],input[type=checkbox],[role=button],summary')].filter(vis);
  for (const el of targets) {
    if (el.closest('p,li,dd') && el.tagName === 'A') continue;            // inline links in prose are exempt
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (r.width >= 24 && r.height >= 24) continue;
    /* radio/checkbox: its label is the real target */
    if ((el.type === 'radio' || el.type === 'checkbox') && el.labels && el.labels[0]) {
      const lr = el.labels[0].getBoundingClientRect(); if (lr.width >= 24 && lr.height >= 24) continue;
    }
    const others = targets.filter(o => o !== el).map(o => o.getBoundingClientRect());
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const crowded = others.some(o => { const ox = Math.max(o.left, Math.min(cx, o.right)), oy = Math.max(o.top, Math.min(cy, o.bottom)); return Math.hypot(cx - ox, cy - oy) < 24; });
    (crowded ? F : N)('tap', tag(el) + ' is ' + Math.round(r.width) + 'x' + Math.round(r.height) + (crowded ? ' and crowded' : ' (isolated, passes on spacing)') + ' — "' + txt(el) + '"');
  }

  /* fixed / sticky chrome */
  let chrome = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if ((cs.position === 'fixed' || cs.position === 'sticky') && vis(el)) { const r = el.getBoundingClientRect(); if (r.top < innerHeight / 2 && r.width > W * 0.5) chrome += r.height; }
  }
  out.info.chromePx = Math.round(chrome);
  if (chrome > innerHeight * 0.25) F('chrome', 'fixed/sticky chrome is ' + Math.round(chrome) + 'px of an ' + innerHeight + 'px screen');

  /* images */
  for (const img of document.images) {
    const src = (img.currentSrc || img.src || '').replace(location.origin, '');
    if (!vis(img)) continue;
    const r = img.getBoundingClientRect();
    if (!img.complete || img.naturalWidth === 0) { N('img', 'not loaded (lazy?) ' + src); continue; }
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      const cs = getComputedStyle(img);
      const sized = cs.aspectRatio !== 'auto' || cs.objectFit === 'cover' || (img.parentElement && getComputedStyle(img.parentElement).aspectRatio !== 'auto');
      if (!sized) N('img', 'no width/height attrs and no CSS box (layout shift): ' + src);
    }
    const ratio = img.naturalWidth / (r.width * devicePixelRatio);
    if (r.width > 40 && ratio > 2.2) N('img-weight', src + ' is ' + img.naturalWidth + 'px for a ' + Math.round(r.width) + 'px slot at ' + devicePixelRatio + 'x (' + ratio.toFixed(1) + 'x oversize)');
    if (r.width > W + 1) {
      let clipped = false;
      for (let p = img.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflow; if (o === 'hidden' || o === 'clip') { clipped = true; break; } }
      if (!clipped) F('img', src + ' renders ' + Math.round(r.width) + 'px wide, wider than the screen');
    }
  }

  /* contrast, composited */
  const lum = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
  const rgb = s => { const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const over = (fg, bg) => fg[3] >= 1 ? fg : [0,1,2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
  const bgOf = el => { const st = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.001) { st.push(c); if (c[3] >= 0.999) break; } }
    let b = [255,255,255,1]; for (let i = st.length - 1; i >= 0; i--) b = over(st[i], b); return b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const worst = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const cs = getComputedStyle(el); if (cs.opacity === '0') continue;
    const fg = rgb(cs.color); if (!fg) continue;
    if (el.closest('.hero, [class*="hero"]') && getComputedStyle(el.closest('.hero, [class*="hero"]')).backgroundImage !== 'none') continue; // photo behind: cannot compute
    const bg = bgOf(el); const rr = ratio(over(fg, bg), bg);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    if (rr < need) { const k = tag(el); if (!worst.has(k) || rr < worst.get(k).r) worst.set(k, { r: rr, need, px, s: txt(el) }); }
  }
  for (const [k, v] of worst) F('contrast', k + ' is ' + v.r.toFixed(2) + ':1, needs ' + v.need + ' (' + v.px + 'px) — "' + v.s + '"');

  out.info.h1 = (document.querySelector('h1') || {}).textContent?.trim().slice(0, 60) || '(none)';
  out.info.h1count = document.querySelectorAll('h1').length;
  out.info.height = document.documentElement.scrollHeight;
  return out;
})()`;

/* hamburger: open it and check the panel is real */
const NAV_PROBE = String.raw`(async () => {
  const btn = document.querySelector('.nav-toggle');
  if (!btn) return { fail: ['nav: no .nav-toggle'] };
  const r0 = btn.getBoundingClientRect();
  const out = { fail: [], warn: [], info: {} };
  if (r0.width < 44 || r0.height < 44) out.warn.push('nav: toggle is ' + Math.round(r0.width) + 'x' + Math.round(r0.height) + ' (44 is the comfortable floor for the one control every phone user hits)');
  btn.click();
  await new Promise(r => setTimeout(r, 450));
  const nav = document.querySelector('nav.primary');
  const open = nav && nav.classList.contains('is-open');
  if (!open) { out.fail.push('nav: click did not open the panel'); return out; }
  const links = [...nav.querySelectorAll('a')];
  let hidden = 0, small = 0;
  for (const a of links) { const r = a.getBoundingClientRect(); if (r.height === 0) hidden++; else if (r.height < 40) small++; }
  const nr = nav.getBoundingClientRect();
  out.info.panel = links.length + ' links, panel ' + Math.round(nr.height) + 'px tall, ' + Math.round(nr.bottom) + 'px bottom edge on a ' + innerHeight + 'px screen';
  if (hidden) out.warn.push('nav: ' + hidden + ' link(s) in the open panel have no box (a closed submenu is fine; anything else is not)');
  if (small) out.warn.push('nav: ' + small + ' link(s) in the panel are under 40px tall');
  const fs = links.filter(a => a.getBoundingClientRect().height > 0).map(a => parseFloat(getComputedStyle(a).fontSize));
  out.info.linkPx = Math.min(...fs).toFixed(1) + '–' + Math.max(...fs).toFixed(1) + 'px';
  if (Math.min(...fs) < 14) out.warn.push('nav: smallest link text in the panel is ' + Math.min(...fs).toFixed(1) + 'px');
  btn.click();
  return out;
})()`;

/* ----------------------------------------------------------------- run */
const findings = new Map();
const add = (kind, msg, where) => { const k = kind + '\0' + msg; if (!findings.has(k)) findings.set(k, { kind, msg, where: new Set() }); findings.get(k).where.add(where); };
const weight = {};

try {
  const cdp = connect(await endpoint()); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = sessionId;
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S); await cdp.send('Log.enable', {}, S); await cdp.send('Network.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true }, S);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }, S);
  await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }, S);
  const wanted = shots === 'all' ? null : new Set(shots.split(',').filter(Boolean));
  const all = pages();
  console.log(`Surge phone audit — ${all.length} pages at ${WIDTH}×${HEIGHT} (2x, touch) against ${BASE}\n`);

  for (const path of all) {
    cdp.events.length = 0;
    await cdp.send('Page.navigate', { url: BASE + path }, S);
    await sleep(1100);
    /* scroll the page so lazy images and the video have a chance */
    for (let k = 0; k < 12; k++) { await cdp.send('Runtime.evaluate', { expression: `scrollTo(0, innerHeight * 0.8 * ${k})` }, S); await sleep(80); }
    await cdp.send('Runtime.evaluate', { expression: 'scrollTo(0,0)' }, S); await sleep(500);

    let bytes = 0; const byType = {};
    for (const e of cdp.events) {
      if (e.method === 'Runtime.exceptionThrown') add('js', (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text).split('\n')[0], path);
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') add('console', e.params.entry.text.slice(0, 140), path);
      if (e.method === 'Network.responseReceived' && e.params.response.status >= 400) add('http', e.params.response.status + ' ' + e.params.response.url.replace(BASE, ''), path);
      if (e.method === 'Network.loadingFinished') bytes += e.params.encodedDataLength || 0;
      if (e.method === 'Network.responseReceived') { const t = e.params.type || '?'; byType[t] = (byType[t] || 0) + 1; }
    }
    weight[path] = bytes;

    const { result } = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, S);
    if (!result) { add('probe', 'no result', path); continue; }
    const r = result.value;
    for (const m of r.fail) add('FAIL', m, path);
    for (const m of r.warn) add('warn', m, path);
    if (r.info.h1count !== 1) add('FAIL', 'h1 count is ' + r.info.h1count, path);

    /* hamburger, once per distinct chrome — home is enough, plus one sub-page */
    if (path === '/' || path === '/what-we-do/') {
      const nv = await cdp.send('Runtime.evaluate', { expression: NAV_PROBE, returnByValue: true, awaitPromise: true }, S);
      if (nv.result) { for (const m of nv.result.value.fail || []) add('FAIL', m, path); for (const m of nv.result.value.warn || []) add('warn', m, path); for (const [k, v] of Object.entries(nv.result.value.info || {})) add('info', k + ': ' + v, path); }
    }

    /* contact chooser: reveal each form and re-probe the controls */
    if (path === '/contact/') {
      const { result: ch } = await cdp.send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: String.raw`(async () => {
        const out = [];
        for (const rb of document.querySelectorAll('input[type=radio]')) {
          rb.click(); await new Promise(r => setTimeout(r, 250));
          const forms = [...document.querySelectorAll('form')].filter(f => f.offsetParent);
          const ctrls = forms.flatMap(f => [...f.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=submit]),select,textarea')]).filter(c => c.offsetParent);
          const under16 = ctrls.filter(c => parseFloat(getComputedStyle(c).fontSize) < 16).map(c => c.name + '@' + parseFloat(getComputedStyle(c).fontSize).toFixed(1));
          const over = document.documentElement.scrollWidth > innerWidth + 1;
          const submit = forms.map(f => f.querySelector('[type=submit],button')).filter(Boolean).map(b => { const r = b.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
          out.push({ opt: rb.value, forms: forms.length, ctrls: ctrls.length, under16, over, submit });
        }
        return out;
      })()` }, S);
      for (const o of ch?.value || []) {
        if (o.forms === 0) add('FAIL', 'contact: option "' + o.opt + '" reveals no form', path);
        if (o.under16.length) add('FAIL', 'input-zoom: option "' + o.opt + '" — ' + o.under16.join(', '), path);
        if (o.over) add('FAIL', 'contact: option "' + o.opt + '" causes horizontal overflow', path);
        add('info', 'contact "' + o.opt + '": ' + o.ctrls + ' controls, submit ' + o.submit.join('/'), path);
      }
    }

    if (wanted === null || (wanted && wanted.has(path))) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: Math.min(r.info.height, 12000), deviceScaleFactor: 1, mobile: true }, S);
      await sleep(300);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, S);
      const name = (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-').replace('.html', '')) + `-${WIDTH}.png`;
      writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true }, S);
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n\n');
  cdp.close();
} finally { chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {} }

/* -------------------------------------------------------------- report */
const order = { FAIL: 0, js: 0, console: 0, http: 0, probe: 0, warn: 1, info: 2 };
const rows = [...findings.values()].sort((a, b) => (order[a.kind] - order[b.kind]) || a.msg.localeCompare(b.msg));
const N = Object.keys(weight).length;
const where = s => { const a = [...s]; return a.length === N ? 'every page' : a.length > 6 ? a.length + ' pages incl. ' + a.slice(0, 3).join(' ') : a.join(' '); };
let last = null;
for (const r of rows) {
  const band = order[r.kind] === 0 ? 'FAIL' : r.kind === 'warn' ? 'WARN' : 'INFO';
  if (band !== last) { console.log('---- ' + band + ' ----'); last = band; }
  console.log('  [' + r.kind + '] ' + r.msg + '\n        ' + where(r.where));
}
console.log('---- page weight (transferred, after a full scroll) ----');
for (const [p, b] of Object.entries(weight).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  ' + (b / 1024).toFixed(0).padStart(6) + ' KB  ' + p);
const nf = rows.filter(r => order[r.kind] === 0).length, nw = rows.filter(r => r.kind === 'warn').length;
console.log(`\n${nf} failures, ${nw} warnings across ${N} pages at ${WIDTH}px.${shots ? '  Screenshots in deploy/dist/mobile/' : ''}`);
process.exit(nf ? 1 : 0);

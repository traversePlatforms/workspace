/* Sixfold site — runtime audit.

   audit-links.mjs reads the FILES: links, chrome drift, copy-rule greps. This
   one drives a real browser and checks what only exists once the page is laid
   out and painted — contrast against the actual background, broken images,
   console errors, tap targets, heading order, form semantics.

     node audit-runtime.mjs            (needs serve.mjs on :8090)
*/
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:8090';
/* Derived from disk, not listed by hand. It WAS a hand-written array, and adding
   the three per-service pages on 2026-09-21 silently left them untested: the run
   still said "6 pages" and still said 0 failures, which is the worst kind of pass.
   audit-links.mjs already walks the directory for exactly this reason. */
const SITE_ROOT = dirname(fileURLToPath(import.meta.url));
const PAGES = (function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === '_tabled' || e.name === 'assets' || e.name === 'api') continue;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), base + '/' + e.name));
    else if (e.name === 'index.html') out.push(base + '/');
  }
  return out;
})(SITE_ROOT).sort();
const WIDTHS = [390, 768, 1280, 1600];

const prof = mkdtempSync(join(tmpdir(), 'audit-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${prof}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'], { stdio: 'ignore' });

const wait = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
const events = [];
for (let i = 0; i < 80; i++) {
  try {
    const t = await (await fetch('http://127.0.0.1:9336/json/list')).json();
    const pg = t.find(x => x.type === 'page');
    if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; }
  } catch {}
  await wait(250);
}
await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  else if (m.method) events.push(m);
});
/* Every CDP call is raced against a timeout. Two runs deadlocked on a reply
   that never came because the page's execution context went away mid-call, and
   an auditor that can hang is an auditor nobody runs. */
const cmd = (method, params = {}, ms = 12000) => new Promise(r => {
  const n = ++id;
  const t = setTimeout(() => { if (pending.delete(n)) r({ __timeout: method }); }, ms);
  pending.set(n, v => { clearTimeout(t); r(v); });
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evalIn = async expr => {
  const { result, exceptionDetails, __timeout } = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (__timeout) throw new Error('CDP timeout on ' + __timeout);
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception?.description || ''));
  return result.value;
};

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Network.enable');

/* ---------------------------------------------------------------- probe */
/* Runs inside the page. Everything here needs layout or paint, which is the
   whole reason this file exists separately from audit-links.mjs. */
const PROBE = String.raw`(() => {
  const out = { errors: [], warns: [], notes: [] };
  const E = (k, m) => out.errors.push(k + ': ' + m);
  const W = (k, m) => out.warns.push(k + ': ' + m);
  const tag = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
    (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const txt = e => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 44);

  /* --- head ---------------------------------------------------------- */
  const H = document.documentElement;
  if (!H.lang) E('head', 'no <html lang>');
  const title = document.title || '';
  if (!title) E('head', 'no <title>');
  else if (title.length > 62) W('head', 'title is ' + title.length + ' chars (>62 truncates in results): ' + title);
  const desc = document.querySelector('meta[name=description]')?.content || '';
  if (!desc) E('head', 'no meta description');
  else if (desc.length < 50 || desc.length > 165) W('head', 'meta description ' + desc.length + ' chars: ' + desc);
  if (!document.querySelector('meta[name=viewport]')) E('head', 'no viewport meta');
  const robots = document.querySelector('meta[name=robots]')?.content || '';
  out.notes.push('robots=' + (robots || '(none)') + ' | title=' + title.length + 'ch | desc=' + desc.length + 'ch');
  if (!document.querySelector('link[rel*=icon]')) W('head', 'no favicon link');
  const canon = document.querySelector('link[rel=canonical]');
  if (!canon) W('head', 'no canonical link');

  /* --- ids ------------------------------------------------------------ */
  const seen = new Map();
  for (const e of document.querySelectorAll('[id]')) {
    if (seen.has(e.id)) E('id', 'duplicate id "' + e.id + '"');
    seen.set(e.id, 1);
  }

  /* --- landmarks + headings ------------------------------------------ */
  if (!document.querySelector('main')) W('landmark', 'no <main>');
  if (!document.querySelector('header')) W('landmark', 'no <header>');
  if (!document.querySelector('footer')) W('landmark', 'no <footer>');
  const h1s = [...document.querySelectorAll('h1')];
  if (h1s.length !== 1) E('heading', h1s.length + ' h1 elements (want exactly 1)');
  let prev = 0;
  for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) E('heading', 'jumps h' + prev + ' -> h' + lvl + ' at "' + txt(h) + '"');
    if (!txt(h)) E('heading', 'empty ' + h.tagName);
    prev = lvl;
  }

  /* --- images --------------------------------------------------------- */
  for (const img of document.images) {
    const src = (img.currentSrc || img.src || '').replace(location.origin, '');
    if (!img.complete || img.naturalWidth === 0) E('img', 'failed to load ' + src);
    if (img.alt === null || img.getAttribute('alt') === null) E('img', 'no alt attribute on ' + src);
    else if (!img.alt.trim() && !img.closest('[aria-hidden=true]')) W('img', 'empty alt, not marked decorative: ' + src);
    else if (img.alt.trim() && /^(photo|image|picture|img)\b/i.test(img.alt)) W('img', 'alt starts with "photo/image": ' + img.alt);
    const w = img.getAttribute('width'), h = img.getAttribute('height');
    if (!w || !h) W('img', 'no width/height attrs (layout shift) on ' + src);
    else {
      const declared = +w / +h, real = img.naturalWidth / img.naturalHeight;
      if (Math.abs(declared - real) / real > 0.02)
        E('img', 'declared ' + w + 'x' + h + ' but file is ' + img.naturalWidth + 'x' + img.naturalHeight + ' — ' + src);
    }
  }

  /* --- links ---------------------------------------------------------- */
  for (const a of document.querySelectorAll('a')) {
    const name = (a.textContent || '').trim() || a.getAttribute('aria-label') || a.querySelector('img')?.alt || '';
    if (!name) E('link', 'no accessible name: href=' + a.getAttribute('href'));
    if (!a.hasAttribute('href')) E('link', '<a> with no href: "' + txt(a) + '"');
    const href = a.getAttribute('href') || '';
    if (href === '#' || href === '') E('link', 'placeholder href on "' + txt(a) + '"');
    if (a.target === '_blank' && !/noopener/.test(a.rel || '')) W('link', 'target=_blank without rel=noopener: ' + href);
    if (/^(click here|here|read more|more|link)$/i.test(name)) W('link', 'non-descriptive link text "' + name + '"');
  }

  /* --- forms ---------------------------------------------------------- */
  for (const f of document.querySelectorAll('form')) {
    if (!f.getAttribute('action')) W('form', 'form with no action');
    for (const c of f.querySelectorAll('input,select,textarea')) {
      if (c.type === 'hidden' || c.type === 'submit') continue;
      if (c.closest('[aria-hidden=true]') || c.tabIndex < 0) continue;   // honeypot etc.
      const lab = (c.id && document.querySelector('label[for="' + CSS.escape(c.id) + '"]')) || c.closest('label');
      if (!lab && !c.getAttribute('aria-label') && !c.getAttribute('aria-labelledby'))
        E('form', 'control with no label: ' + tag(c) + ' name=' + c.name);
      if (!c.name) E('form', 'control with no name attribute: ' + tag(c));
      if (/email|tel|name/i.test(c.name || '') && !c.autocomplete)
        W('form', 'no autocomplete on ' + c.name);
      if (c.type === 'email' && c.tagName === 'INPUT' && c.getAttribute('type') !== 'email')
        W('form', 'email field not type=email: ' + c.name);
    }
    if (!f.querySelector('[type=submit],button')) E('form', 'form with no submit control');
  }

  /* --- contrast (WCAG 2.1 relative luminance) ------------------------- */
  const lum = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2]; };
  const rgb = s => { const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const over = (fg, bg) => fg[3] >= 1 ? fg : [0,1,2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1);
  /* Walk up collecting every painted layer, then composite them back down.
     Skipping anything under alpha 1 is wrong: the header is 0.9 over Bone,
     which is a real, opaque-enough colour once you actually mix it. */
  const bgOf = el => {
    const stack = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0.001) { stack.push(c); if (c[3] >= 0.999) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const worst = new Map();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const fg = rgb(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const r = ratio(over(fg, bg), bg);
    const px = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    if (r < need) {
      const k = tag(el);
      const cur = worst.get(k);
      if (!cur || r < cur.r) worst.set(k, { r, need, px, sample: txt(el) });
    }
  }
  for (const [k, v] of worst)
    E('contrast', k + ' is ' + v.r.toFixed(2) + ':1, needs ' + v.need + ' (' + v.px + 'px) — "' + v.sample + '"');

  /* --- tap targets (mobile only; caller filters) ---------------------- */
  if (innerWidth < 700) {
    for (const el of document.querySelectorAll('a,button,input[type=submit],label')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest('p,li') && el.tagName === 'A') continue;       // inline links in prose are exempt
      if (el.tagName === 'LABEL') {
        const c = el.control || el.querySelector('input,select,textarea');
        if (c && c.getBoundingClientRect().height >= 24) continue;   // the field is the target
      }
      /* WCAG 2.2 2.5.8 exempts an undersized target with >=24px of clear
         spacing around it. Approximate it with the gap to the next target. */
      let spaced = false;
      const sibs = [...el.parentElement.children].filter(x => x !== el && x.getBoundingClientRect().height > 0);
      if (sibs.length) {
        const gaps = sibs.map(x => { const q = x.getBoundingClientRect();
          return q.top >= r.bottom ? q.top - r.bottom : r.top >= q.bottom ? r.top - q.bottom : 0; });
        spaced = Math.min(...gaps.filter(g => g > 0).concat([99])) >= 24 - Math.min(r.height, r.width) / 2;
      }
      if ((r.height < 24 || r.width < 24) && !spaced)
        W('tap', tag(el) + ' is ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' — "' + txt(el) + '"');
    }
  }

  /* --- overflow ------------------------------------------------------- */
  if (document.documentElement.scrollWidth > innerWidth + 1) {
    const culprits = [...document.querySelectorAll('body *')]
      .filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(tag);
    E('overflow', 'page scrolls ' + document.documentElement.scrollWidth + ' > ' + innerWidth + ' — ' + culprits.join(', '));
  }

  /* --- focus visibility ----------------------------------------------- */
  out.focusables = [...document.querySelectorAll('a[href],button,input,select,textarea')]
    .filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed')
    .filter(e => e.tabIndex >= 0)
    .map(e => ({ t: tag(e), x: txt(e) }));

  return out;
})()`;

/* ------------------------------------------------------------------ run */
const findings = new Map();   // "key: message" -> Set of "page @width"
const add = (kind, msg, where) => {
  const k = kind + '\u0000' + msg;
  if (!findings.has(k)) findings.set(k, { kind, msg, where: new Set() });
  findings.get(k).where.add(where);
};

const netFails = [];
for (const path of PAGES) {
  for (const w of WIDTHS) {
    const where = path + ' @' + w;
    events.length = 0;
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 });
    await cmd('Page.navigate', { url: BASE + path });
    await wait(1200);
    /* Trigger every loading=lazy image, then come back to the top. Plain
       synchronous scroll calls on a timer: the first attempt awaited a promise
       inside the page and deadlocked twice when the execution context went
       away mid-eval. Nothing here can fail to return. */
    for (let k = 0; k < 14; k++) {
      await cmd('Runtime.evaluate', { expression: 'scrollTo(0, innerHeight * 0.8 * ' + k + ')' });
      await wait(110);
    }
    await cmd('Runtime.evaluate', { expression: 'scrollTo(0, 0)' });
    await wait(900);

    for (const e of events) {
      if (e.method === 'Runtime.exceptionThrown')
        add('js', e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception?.description || '').split('\n')[0], where);
      if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
        add('console', e.params.entry.text.slice(0, 160), where);
      if (e.method === 'Network.loadingFailed')
        netFails.push(where + ' — ' + e.params.errorText);
      if (e.method === 'Network.responseReceived' && e.params.response.status >= 400)
        add('http', e.params.response.status + ' ' + e.params.response.url.replace(BASE, ''), where);
    }

    let r;
    try { r = await evalIn(PROBE); }
    catch (err) { add('probe', 'threw: ' + err.message, where); continue; }
    if (w === 1280 && r.focusables) {
      const unfocusable = await evalIn(`(() => {
        const bad = [];
        const els = [...document.querySelectorAll('a[href],button,input,select,textarea')]
          .filter(e => (e.offsetParent || getComputedStyle(e).position === 'fixed') && e.tabIndex >= 0);
        for (const e of els) {
          const before = getComputedStyle(e).cssText;
          e.focus({ focusVisible: true });
          const cs = getComputedStyle(e);
          const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow !== 'none';
          const matches = e.matches(':focus-visible');
          if (!ring && !shadow && cs.cssText === before && matches) {
            const t = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
            if (!bad.includes(t)) bad.push(t);
          }
          e.blur();
        }
        return bad;
      })()`);
      for (const t of unfocusable) add('warn', 'focus: no visible focus indicator on ' + t, where);
    }
    for (const m of r.errors) add('ERROR', m, where);
    for (const m of r.warns) add('warn', m, where);
    if (w === 1280) for (const m of r.notes) add('note', m, where);
  }
  process.stderr.write('.');
}
process.stderr.write('\n');

/* ------------------------------------------------------------- report */
const order = { ERROR: 0, js: 0, console: 0, http: 0, probe: 0, warn: 1, note: 2 };
const rows = [...findings.values()].sort((a, b) => (order[a.kind] - order[b.kind]) || a.msg.localeCompare(b.msg));
const nErr = rows.filter(r => order[r.kind] === 0).length;
const nWarn = rows.filter(r => r.kind === 'warn').length;

console.log('Sixfold site — runtime audit');
console.log(PAGES.length + ' pages x ' + WIDTHS.join('/') + 'px = ' + (PAGES.length * WIDTHS.length) + ' renders\n');

const shortWhere = s => {
  const all = [...s];
  const pages = new Set(all.map(x => x.split(' @')[0]));
  if (all.length === PAGES.length * WIDTHS.length) return 'every page, every width';
  if (pages.size > 1 && all.length === pages.size * WIDTHS.length) return [...pages].join(' ') + ' (all widths)';
  return all.join(', ');
};

let last = null;
for (const r of rows) {
  const band = order[r.kind] === 0 ? 'FAIL' : r.kind === 'warn' ? 'WARN' : 'NOTE';
  if (band !== last) { console.log('---- ' + band + ' ----'); last = band; }
  console.log('  [' + r.kind + '] ' + r.msg);
  console.log('        ' + shortWhere(r.where));
}
if (netFails.length) { console.log('---- network ----'); for (const f of [...new Set(netFails)]) console.log('  ' + f); }
console.log('\n' + nErr + ' failures, ' + nWarn + ' warnings.');

ws.close(); ch.kill(); await wait(400); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(nErr ? 1 : 0);

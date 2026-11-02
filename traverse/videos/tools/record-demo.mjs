// The demo-editions video (2 Nov 2026): a YouTube sales demo of Traverse, 16:9, Roofing + Lawn & Landscape + Solar, recorded on the
// LOCAL demo copies only (demo-config.mjs; never a live install). The office and computer scenes run at 1440x900, the field scenes on a
// phone (390x844); each scene is put in the 16:9 Traverse frame (frame-16x9.html): computer screen, phone inset, or a title card.
// Homeowners' names, real streets and house numbers, and every data-source word are masked in the page first (mask-demo.mjs).
//   node record-demo.mjs --dry [--only 7,8]    one composited 1920x1080 PNG per scene -> ../demo-editions/dry/scene-NN.png + README.md
//   node record-demo.mjs --record               each scene's screens recorded (screencast) for as long as its voice line
//                                               (voice-demo.mjs first) -> out/demo-editions/rec/; then build-demo.mjs makes the video
// Before a run: bash demo-copies.sh reset (fresh copies, people, the demo leads): a run signs and books on the copies.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'; import { resolve, join } from 'node:path'; import { pathToFileURL } from 'node:url';
import { chrome, attach, session, sleep } from './lib.mjs';
import { DEMO_DIR, ADMIN, ED, origin, local } from './demo-config.mjs';
import { buildMask, maskScript, leakExpr } from './mask-demo.mjs';
import { SCENES, NOTES } from './story-demo-editions.mjs';

const DRY = process.argv.includes('--dry'), REC = process.argv.includes('--record');
const oi = process.argv.indexOf('--only'); const ONLY = oi > 0 ? process.argv[oi + 1].split(',').map(Number) : null;
if (!DRY && !REC) { console.log('Run with --dry (a picture per scene) or --record (the video, after voice-demo.mjs).'); process.exit(1); }
const OUT = resolve('out/demo-editions'), RAW = join(OUT, 'raw'), DRYDIR = resolve('../demo-editions/dry');
mkdirSync(RAW, { recursive: true }); mkdirSync(DRYDIR, { recursive: true });
const DEMO = JSON.parse(readFileSync(DEMO_DIR + '/demo.json', 'utf8'));

/* the masks, one per edition, from its own town file (the names stay in this process and the page) */
const MASK = {};
for (const ed of Object.keys(ED)) {
  const dir = `${DEMO_DIR}/${ed}/${ED[ed].data}/rounds`, town = JSON.parse(readFileSync(dir + '/index.json', 'utf8')).regions[0].key;
  const util = new Set();
  if (existsSync(`${dir}/solar-${town}.json`)) for (const v of Object.values(JSON.parse(readFileSync(`${dir}/solar-${town}.json`, 'utf8')).doors)) { try { const u = JSON.parse(v).u; if (u) util.add(u); } catch {} }
  if (existsSync(`${dir}/solar-utilities.json`)) JSON.stringify(JSON.parse(readFileSync(`${dir}/solar-utilities.json`, 'utf8'))).replace(/"name":"([^"]+)"/g, (m, n) => util.add(n));
  MASK[ed] = buildMask(`${dir}/${town}.json`, { utilities: [...util].sort((a, b) => b.length - a.length) });
  MASK[ed].town = town; MASK[ed].script = maskScript(MASK[ed]); MASK[ed].leak = leakExpr(MASK[ed]);
}

/* one Chrome; every screen (edition x computer/phone x person) in its own browser context, so each keeps its own sign-in */
const port = 9700 + Math.floor(Math.random() * 90); chrome(port);
const root = await attach(port, (x) => x.type === 'page');
const B = session((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl); await B.ready;
async function newPage(w, h, dpr, mobile) {
  const { browserContextId } = await B.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await B.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const P = session(`ws://127.0.0.1:${port}/devtools/page/${targetId}`); await P.ready;
  await P.send('Runtime.enable'); await P.send('Page.enable');
  P.on((x) => { if (x.method === 'Page.javascriptDialogOpening') P.send('Page.handleJavaScriptDialog', { accept: true }); });
  await P.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  await P.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Denver' });
  /* a phone says it is one: the app allows one phone, one tablet and one computer per code, so the admin's phone and computer both stay in */
  if (mobile) await P.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', platform: 'iPhone' });
  return P;
}
const SCR = {};
/* a screen: who = admin | a person's name in demo.json | homeowner (no sign-in) */
async function screen(ed, dev, who = 'admin') {
  const key = [ed, dev, who].join('|'); if (SCR[key]) return SCR[key];
  const desk = dev === 'desk', W = desk ? 1440 : 390, H = desk ? 900 : 844;
  const P = await newPage(W, H, desk ? 1 : 2, !desk);
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: MASK[ed].script });
  /* the browser-alert and install nudges answered "Not now" before the page asks (both editions' storage prefixes) */
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { for (const p of ['traverse.', 'tvyards.', 'tvsolar.', 'doorapp.']) { localStorage.setItem(p + 'nudge', '1'); localStorage.setItem(p + 'instno', '1'); } } catch (e) {}` });
  /* the maps made on the page, so a scene can frame its town (Leaflet sets window.L; each new map is kept in window.__maps) */
  await P.send('Page.addScriptToEvaluateOnNewDocument', { source: "(() => { let L0; Object.defineProperty(window, 'L', { configurable: true, get() { return L0; }, set(v) { L0 = v; try { if (v && v.Map && !v.__demoHook) { v.__demoHook = 1; v.Map.addInitHook(function () { (window.__maps = window.__maps || []).push(this); }); } } catch (e) {} } }); })();" });
  const s = makeScreen(P, ed, dev, who, W, H);
  if (who !== 'homeowner') {
    const code = who === 'admin' ? ADMIN : DEMO[ed][who].code;
    await s.go(local(origin(ed) + '/' + ED[ed].app + '/'));
    if (!(await s.until(`document.querySelector('.keys button')`, 90000))) throw new Error(key + ': no sign-in screen');
    await s.js(`for (const k of ${JSON.stringify(code)}) [...document.querySelectorAll('.keys button')].find((b) => b.getAttribute('aria-label') === k).click(); return 1`);
    if (!(await s.until(`!document.querySelector('.keys')`, 25000))) throw new Error(key + ': did not sign in');
    await sleep(2500); await s.dismiss();
  }
  return (SCR[key] = s);
}
function makeScreen(P, ed, dev, who, W, H) {
  const js = (e) => P.js(`(async () => { ${e} })()`);
  const until = (e, ms = 20000) => P.until(`(() => { try { return !!(${e}); } catch (x) { return false; } })()`, ms);
  const find = (sel, re) => `[...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => (x.offsetParent || x.getClientRects().length) && ${re ? `new RegExp(${JSON.stringify(re)}, 'i').test(x.textContent.trim().replace(/\\s+/g, ' '))` : 'true'})`;
  const s = {
    P, ed, dev, who, W, H, js, until,
    go: async (u) => { await P.send('Page.navigate', { url: local(u) }); await sleep(1200); },
    /* a tap: find it (waiting), bring it into view, click it */
    tap: async (sel, re, o = {}) => {
      if (!(await until(find(sel, re), o.wait ?? 15000))) throw new Error(`${ed} ${dev}: not found: ${sel} ${re || ''}`);
      await js(`const e = ${find(sel, re)}; const r = e.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 60) e.scrollIntoView({ block: 'center' });`); await sleep(300);
      await js(`const e = ${find(sel, re)}; e.focus && e.focus(); e.click();`); await sleep(o.after ?? 900);
    },
    has: (sel, re) => js(`return !!${find(sel, re)}`),
    /* typing into a field the way a person does (input events), found by selector */
    fill: async (sel, text) => { await js(`const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true }));`); await P.send('Input.insertText', { text }); await sleep(400); },
    scrollTo: async (sel, re, block = 'start') => { await js(`const e = ${find(sel, re)}; if (e) e.scrollIntoView({ block: ${JSON.stringify(block)} });`); await sleep(700); },
    scroll: async (px, sel) => { await js(`const e = ${sel ? `document.querySelector(${JSON.stringify(sel)})` : 'null'}; (e || window).scrollBy({ top: ${px} });`); await sleep(700); },
    text: (sel = 'body') => js(`return (document.querySelector(${JSON.stringify(sel)}) || document.body).innerText`),
    dismiss: async () => { for (let i = 0; i < 3; i++) { const r = await js(`const b = [...document.querySelectorAll('button, a')].find((x) => x.offsetParent && /^(Not now|Close|Got it|Skip)$/.test(x.textContent.trim()) && x.closest('.nudge, .alertbar, .pushask, .inst, .banner, .bar, #toast, .splash, .tour, [class*=nudge], [class*=push], [class*=inst]')); if (b) { b.click(); return 1 } return 0`); if (!r) break; await sleep(500); } },
    nav: async (label) => { await s.tap('#dnav button, #dnav a, nav button', '^' + label + '$', { after: 2500 }); },
    shot: async () => Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
  };
  return s;
}

/* the frame's fonts asked for by name and loaded (a check on document.fonts alone could pass before they were even asked for) */
async function waitFrame(C) {
  await C.js(`(async () => { await Promise.all(['700 112px "Familjen Grotesk"', '700 30px "Atkinson Hyperlegible"', '400 40px "Atkinson Hyperlegible"', '500 24px "JetBrains Mono"'].map((x) => document.fonts.load(x))); await document.fonts.ready; return 1; })()`);
  await C.until(`[...document.images].every((i) => i.complete)`, 20000); await sleep(400);
}
/* the composite: frame-16x9.html with the scene's screens in it, drawn by Chrome at 1920x1080 */
const C = await newPage(1920, 1080, 1, false);
async function compose(sc, files) {
  const q = new URLSearchParams({ layout: sc.layout });
  if (sc.layout === 'card') for (const k of ['eyebrow', 'title', 'sub', 'foot']) { if (sc[k]) q.set(k, sc[k]); }
  else { q.set('section', sc.section || ''); q.set('cap', sc.cap || ''); for (const [k, f] of Object.entries(files)) q.set(k, pathToFileURL(f).href); }
  await C.send('Page.navigate', { url: pathToFileURL(resolve('frame-16x9.html')).href + '?' + q.toString() });
  await waitFrame(C);
  const f = join(DRYDIR, `scene-${String(sc.n).padStart(2, '0')}.png`);
  writeFileSync(f, Buffer.from((await C.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); return f;
}

/* ---- recording: each screen's screencast for the scene's length (its voice line, plus a breath), while its show() moves ---- */
const RECDIR = join(OUT, 'rec'); if (REC) mkdirSync(RECDIR, { recursive: true });
const VOICE = existsSync(join(OUT, 'voice/voice.json')) ? JSON.parse(readFileSync(join(OUT, 'voice/voice.json'), 'utf8')) : {};
if (REC && !Object.keys(VOICE).length) { console.log('No voice clips: run node voice-demo.mjs first.'); process.exit(1); }
const sceneSecs = (sc) => Math.max(3.5, (VOICE[sc.n] ? VOICE[sc.n].secs : 0) + 2.2);   /* the voice starts 0.3 s in; a breath and a look after it */
async function recordScene(sc, got) {
  const dir = join(RECDIR, 'scene-' + String(sc.n).padStart(2, '0')); mkdirSync(dir, { recursive: true });
  const secs = sceneSecs(sc), out = {};
  const streams = Object.entries(got).map(([k, s]) => {
    const d = join(dir, k); mkdirSync(d, { recursive: true }); const frames = []; let t0 = null, done = false;
    const on = async (x) => { if (done || x.method !== 'Page.screencastFrame') return; s.P.send('Page.screencastFrameAck', { sessionId: x.params.sessionId }); if (t0 === null) return;
      const ff = join(d, String(frames.length).padStart(5, '0') + '.jpg'); writeFileSync(ff, Buffer.from(x.params.data, 'base64')); frames.push({ f: ff, t: (Date.now() - t0) / 1000 }); };
    s.P.on(on);
    return { k, s, d, frames, start: async () => {
      /* the first frame is the screen as it is (the screencast sends a frame only on a change) */
      const first = join(d, '00000.jpg'); writeFileSync(first, Buffer.from((await s.P.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })).data, 'base64'));
      t0 = Date.now(); frames.push({ f: first, t: 0 });
      const W = s.dev === 'desk' ? 1440 : 780, H = s.dev === 'desk' ? 900 : 1688;
      await s.P.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    }, stop: async () => { await s.P.send('Page.stopScreencast'); t0 = null; done = true; } };
  });
  for (const st of streams) await st.start();
  const t = Date.now();
  if (sc.show) { try { await sc.show(got, secs); } catch (e) { console.log('  (show: ' + e.message + ')'); } }
  const left = secs * 1000 - (Date.now() - t); if (left > 0) await sleep(left);
  for (const st of streams) { await st.stop(); out[st.k] = { dir: st.d, dev: st.s.dev, frames: st.frames.map((x) => ({ f: x.f, t: x.t })) }; }
  return { secs, screens: out };
}

/* ---- run ---- */
const RES = join(OUT, REC ? 'rec-results.json' : 'results.json'); const results = existsSync(RES) && ONLY ? JSON.parse(readFileSync(RES, 'utf8')) : {};
const ctx = { screen, sleep, DEMO, MASK, ED, origin, local, notes: [], signed: {}, state: {} };
/* a scene that shows what a later one makes (the signed agreement in the opening) runs after it */
const ORDER = SCENES.slice().sort((a, b) => (a.run_after ?? a.n) - (b.run_after ?? b.n) || a.n - b.n);
for (const sc of ORDER) {
  if (ONLY && !ONLY.includes(sc.n)) continue;
  const r = { n: sc.n, t: sc.t, section: sc.section || '', layout: sc.layout, cap: sc.cap || sc.title || '', vo: sc.vo || '', shows: sc.shows || '', problems: [...(sc.problems || [])], ok: true };
  process.stdout.write(`scene ${sc.n} ${sc.t} ${sc.layout} ... `);
  try {
    const files = {};
    if (sc.layout !== 'card') {
      ctx.notes = [];
      const got = await sc.run(ctx);   /* { desk: screen, phone: screen } */
      r.problems.push(...ctx.notes);
      for (const [k, s] of Object.entries(got || {})) {
        await sleep(600); await s.js("document.querySelectorAll('input[type=search]').forEach((i) => { i.value = ''; })");
        const leaks = await s.P.js(MASK[s.ed].leak); if (Array.isArray(leaks) && leaks.length) r.problems.push(`${k} screen: ${leaks.join('; ')} still on screen`);
        const f = join(RAW, `scene-${String(sc.n).padStart(2, '0')}-${k}.png`); writeFileSync(f, await s.shot()); files[k] = f;
      }
      if (REC) {
        r.rec = await recordScene(sc, got || {});
        /* and again at the end: whatever the show() brought on screen is checked too */
        for (const [k, s] of Object.entries(got || {})) { const leaks = await s.P.js(MASK[s.ed].leak); if (Array.isArray(leaks) && leaks.length) r.problems.push(`${k} screen at the end: ${leaks.join('; ')}`); }
      }
    }
    if (DRY) r.file = await compose(sc, files);
    console.log('ok' + (r.problems.length ? ' (' + r.problems.length + ' notes): ' + r.problems.join(' | ').slice(0, 300) : ''));
  } catch (e) {
    r.ok = false; r.problems.push('NOT SHOWN: ' + e.message); console.log('FAILED: ' + e.message);
    /* what the screen showed when it stopped goes to out/ (gitignored: it can be unmasked), and the frame says the beat is missing */
    for (const s of Object.values(SCR)) try { writeFileSync(join(RAW, `scene-${String(sc.n).padStart(2, '0')}-stopped-${s.ed}-${s.dev}.png`), await s.shot()); } catch {}
    if (DRY) r.file = await compose({ n: sc.n, layout: 'card', eyebrow: 'Not shown in the dry run', title: sc.shows || sc.cap || 'Scene ' + sc.n, sub: 'See README.md: ' + e.message.slice(0, 140) }, {});
  }
  results[sc.n] = r;
}
writeFileSync(RES, JSON.stringify(results, null, 1));
if (REC) { writeFileSync(join(RECDIR, 'timeline.json'), JSON.stringify({ story: 'demo-editions', scenes: Object.values(results).sort((a, b) => a.n - b.n) }, null, 1)); console.log('recorded', join(RECDIR, 'timeline.json')); process.exit(0); }

/* the README for Matthew: every scene, its time in the script, what it shows, and any problem */
const rows = Object.values(results).sort((a, b) => a.n - b.n);
let md = `# Demo video: dry run (one picture per scene)\n\nMade ${new Date().toISOString().slice(0, 10)} by \`traverse/videos/tools/record-demo.mjs --dry\` on the LOCAL demo copies (made-up companies, homeowner names hidden,\nreal streets and house numbers swapped for made-up ones, 555 phone numbers). 1920x1080, the final 16:9 look. Script: [../script.md](../script.md).\n\n`;
md += `| Scene | Script time | What it shows | Problems |\n|---|---|---|---|\n`;
for (const r of rows) md += `| [scene-${String(r.n).padStart(2, '0')}.png](scene-${String(r.n).padStart(2, '0')}.png) | ${r.t} | ${r.shows || r.cap}${r.layout !== 'card' ? ` *(${r.layout === 'deskphone' ? 'computer + phone' : r.layout === 'desk' ? 'computer' : 'phone'})*` : ''} | ${r.problems.length ? r.problems.join('<br>') : 'none'} |\n`;
md += `\n## Caption and voice line per scene\n\n| Scene | On screen | Voice |\n|---|---|---|\n`;
for (const r of rows) md += `| ${r.n} | ${r.cap || '—'} | ${r.vo || '—'} |\n`;
const extra = NOTES || '';
writeFileSync(join(DRYDIR, 'README.md'), md + (extra ? '\n' + extra : ''));
writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ story: 'demo-editions', w: 1920, h: 1080, scenes: rows }, null, 1));
console.log('README', join(DRYDIR, 'README.md'));
process.exit(0);

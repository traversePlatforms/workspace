// Records a walkthrough of the app on the LOCAL test copy (never a live install): headless Chrome's screencast, a tap dot
// on every tap, homeowners' names masked, and a timeline of captions + voice-over lines for build.mjs.
//   node record.mjs <story> [--dry]      story: roofing-crew-phone
// --dry takes one screenshot per scene instead of recording.
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'; import { chrome, attach, session, api, sleep } from './lib.mjs';
const STORY = process.argv[2] || 'roofing-crew-phone', DRY = process.argv.includes('--dry');
const ED = { roofing: { app: 'tr-cb2e8587', api: 'traverse-rounds.php', port: 8791 } };
const [edition, role, device] = STORY.split('-'); const E = ED[edition];
const ORIGIN = 'http://127.0.0.1:' + E.port, APP = ORIGIN + '/' + E.app + '/', API = ORIGIN + '/api/' + E.api;
const D = JSON.parse(readFileSync('demo.json', 'utf8'));
const OUT = 'out/' + STORY; rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT + '/frames', { recursive: true });

/* homeowners' names, to mask: every owner in the demo neighbourhood (kept in this process, never written out) */
const call = api(API); await call('admin', 'signin', {}, { code: '333333' });
const owners = new Set();
for (const d of (await call('admin', 'area', { region: D.town, area: D.area })).j.doors || []) if (d.owner) owners.add(String(d.owner).trim());
await call('admin', 'signout', {}, {});
const names = [...owners].sort((a, b) => b.length - a.length);
const PAGE_SETUP = `(() => {
  const NAMES = ${JSON.stringify(names)};
  const fix = (t) => { let s = t; for (const n of NAMES) if (s.indexOf(n) >= 0) s = s.split(n).join('name hidden'); return s.replace(/Owner: (?!name hidden)[A-Z][A-Z .,&'-]+/g, 'Owner: name hidden'); };
  const walk = (root) => { if (!root) return; const tw = (root.ownerDocument || root).createTreeWalker(root, 4); let n; while ((n = tw.nextNode())) { const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } };
  const watch = (doc) => { const mo = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') { const v = fix(m.target.nodeValue); if (v !== m.target.nodeValue) m.target.nodeValue = v; } else m.addedNodes.forEach((x) => x.nodeType === 3 ? (x.nodeValue = fix(x.nodeValue)) : walk(x)); } });
    mo.observe(doc, { childList: true, subtree: true, characterData: true }); walk(doc.documentElement); };
  watch(document);
  /* the tap dot */
  window.__tap = (x, y) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:' + (x - 26) + 'px;top:' + (y - 26) + 'px;width:52px;height:52px;border-radius:50%;background:rgba(228,112,58,.35);border:3px solid rgba(255,255,255,.95);box-shadow:0 2px 12px rgba(0,0,0,.35);z-index:2147483647;pointer-events:none;transform:scale(.6);opacity:1;transition:transform .35s ease,opacity .5s ease .25s';
    document.documentElement.appendChild(d); requestAnimationFrame(() => { d.style.transform = 'scale(1.15)'; d.style.opacity = '0'; }); setTimeout(() => d.remove(), 900); };
  /* a report that opens in a new tab opens over the page instead, so the recording sees it (same pixels a phone shows) */
  window.open = function () { const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#fff';
    const f = document.createElement('iframe'); f.style.cssText = 'border:0;width:100%;height:100%;display:block'; wrap.appendChild(f); document.body.appendChild(wrap);
    const w = f.contentWindow; w.close = () => wrap.remove(); w.print = () => {}; watch(f.contentDocument); window.__rep = f; return w; };
})();`;

const port = 9750 + Math.floor(Math.random() * 40); const ch = chrome(port);
const P = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await P.ready;
await P.send('Runtime.enable'); await P.send('Page.enable');
const W = device === 'desktop' ? 1440 : 390, H = device === 'desktop' ? 900 : 844, DPR = device === 'desktop' ? 1 : 2;
await P.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: device !== 'desktop' });
if (device !== 'desktop') await P.send('Emulation.setTouchEmulationEnabled', { enabled: false });
await P.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_SETUP });
await P.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Denver' });

/* ---- recording ---- */
const frames = []; let t0 = null; const timeline = []; let shotN = 0;
P.on(async (x) => {
  if (x.method !== 'Page.screencastFrame') return;
  P.send('Page.screencastFrameAck', { sessionId: x.params.sessionId });
  const now = Date.now(); if (t0 === null) t0 = now;
  const f = `${OUT}/frames/${String(frames.length).padStart(6, '0')}.jpg`; writeFileSync(f, Buffer.from(x.params.data, 'base64')); frames.push({ f, t: now - t0 });
});
const startRec = async () => { if (!DRY) await P.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 }); };
const stopRec = async () => { if (!DRY) await P.send('Page.stopScreencast'); };
const scene = async (clock, caption, vo) => {
  await holdForVo();
  if (DRY && shotN >= 0) { await sleep(700); writeFileSync(`${OUT}/scene-${String(++shotN).padStart(2, '0')}.png`, Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
  timeline.push({ t: t0 === null ? 0 : Date.now() - t0, clock, caption, vo });
  sceneStart = Date.now(); sceneVo = vo || '';
  console.log(`  ${clock}  ${caption}`);
};

/* a scene lasts at least as long as its voice-over line takes to say */
let sceneStart = null, sceneVo = '';
async function holdForVo() {
  if (!DRY && sceneStart !== null) { const need = sceneVo.split(/\s+/).filter(Boolean).length / 2.5 * 1000 + 800, gone = Date.now() - sceneStart; if (gone < need) await sleep(need - gone); }
}
/* ---- acting ---- */
const J = (v) => JSON.stringify(v);
/* find: a CSS selector, optionally the first visible one whose text matches a regex source; inside the report frame with inRep */
const findExpr = (sel, re, inRep) => `(() => { const doc = ${inRep ? 'window.__rep.contentDocument' : 'document'}; const re = ${re ? `new RegExp(${J(re)}, "i")` : 'null'};
  return [...doc.querySelectorAll(${J(sel)})].find((x) => (x.offsetParent || x.getClientRects().length) && (!re || re.test(x.textContent.trim()))) || null; })()`;
async function tap(sel, re, opt = {}) {
  const ok = await P.until(`!!${findExpr(sel, re, opt.inRep)}`, opt.wait || 15000);
  if (!ok) throw new Error('not found: ' + sel + ' ' + (re || ''));
  await P.js(`(() => { const e = ${findExpr(sel, re, opt.inRep)}; const r = e.getBoundingClientRect(); if (r.top < 70 || r.bottom > ${H} - 90) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); })()`);
  await sleep(650);
  const xy = await P.js(`(() => { const e = ${findExpr(sel, re, opt.inRep)}; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await P.js(`window.__tap(${xy[0]}, ${xy[1]})`); await sleep(230);
  await P.js(`(() => { const e = ${findExpr(sel, re, opt.inRep)}; e.focus && e.focus(); e.click(); })()`);
  await sleep(opt.after ?? 700);
}
async function type(text, cps = 11) { for (const ch of text) { await P.send('Input.insertText', { text: ch }); await sleep(1000 / cps + Math.random() * 45); } }
async function scroll(px, inRep) { await P.js(`(${inRep ? 'window.__rep.contentWindow' : 'window'}).scrollBy({ top: ${px}, behavior: 'smooth' })`); await sleep(900); }
const pause = (ms) => sleep(DRY ? Math.min(ms, 400) : ms);
const has = (sel, re) => P.js(`!!${findExpr(sel, re)}`);

/* ---- set up: sign out, open the sign-in screen ---- */
await P.send('Page.navigate', { url: APP }); await sleep(1500);
await P.js(`fetch('../api/${E.api}?action=signout',{method:'POST',credentials:'same-origin'}).catch(()=>{})`);
await P.send('Page.navigate', { url: APP }); await P.until(`!!document.querySelector('.signin')`, 20000); await sleep(1500);
await startRec(); await sleep(400);

const STORIES = {};
STORIES['roofing-crew-phone'] = async () => {
  const code = D['Alex Rivera'].code;
  await scene('7:30 AM', 'Alex signs in with a six-digit code', 'Seven thirty. Alex signs in with a six-digit code. No password to forget.');
  await pause(1600);
  for (const dgt of code) await tap('.signin button', '^' + dgt + '$', { after: 260 });
  await P.until(`!!document.querySelector('.choose')`, 20000); await pause(1400);
  await scene('7:31 AM', 'Everything for the day on one screen', 'Everything for the day is on one screen.');
  if (await has('.lnk', '^Not now$')) await tap('.lnk', '^Not now$', { after: 900 });
  await pause(2600);
  await scene('7:32 AM', 'A goal for today: 40 doors, 12 talks, 2 quotes', 'First, a goal for the day. Forty doors, twelve conversations, two quotes booked. The office can set one for the whole team; Alex sets their own.');
  await tap('button.tile', '^My stats'); await pause(1200);
  await tap('button.lnk', '^Set a goal$'); await pause(500);
  for (const [i, v] of [[0, '40'], [1, '12'], [2, '2']]) { await tap('.gform input', null, { after: 250 }); await P.js(`document.querySelectorAll('.gform input')[${i}].focus()`); await type(v, 6); await sleep(250); }
  await tap('.gform .save', '^Save$', { after: 1800 }); await pause(1500);
  await tap('header button.back', null, { after: 1000 });
  await scene('7:35 AM', 'The calendar: team huddle, then a ride-along', 'The calendar: a team huddle at seven forty-five, and a ride-along after lunch. Come-backs land here on their own.');
  await tap('button.tile', '^Calendar'); await pause(3800);
  await tap('header button.back', null, { after: 900 });
  await scene('7:38 AM', 'Live radar before heading out', 'A quick look at the live radar before heading out. It refreshes every five minutes.');
  await tap('button.tile', '^Live radar'); await pause(4200);
  await tap('header button.back', null, { after: 900 });
  await scene('8:15 AM', 'Opens the neighbourhood the office assigned', 'The office assigned this neighbourhood to Alex, so it sits right on the home screen.');
  await tap('#view .area, #view button', D.area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), { after: 400 });
  await P.until(`!!document.querySelector('#view .door.open')`, 60000); await pause(1800);
  await scene('8:16 AM', 'Best doors first, and each card says why', 'Best doors first, and every card says why: the hail at this house, the strongest wind nearby, the year it was built, and the roof size.');
  await pause(2200); await scroll(260); await pause(1600); await scroll(330); await pause(1800);
  await scene('8:18 AM', 'A storm report to show the homeowner', 'One tap makes a storm report for the house: every hail storm at the address, the wind nearby, and the roof. Show it at the door, or save it as a PDF.');
  await tap('#view .door.open .srbtn', null, { after: 1500 });
  await pause(1800); await scroll(520, true); await pause(1800); await scroll(620, true); await pause(1800);
  await tap('.bar button', '^Close$', { inRep: true, after: 900 });
  await scene('8:20 AM', 'No answer: one tap, and the next door opens', 'Nobody home. One tap, and the next door opens.');
  await tap('#view .door.open button', '^No answer$', { after: 1800 }); await pause(1600);
  await scene('8:24 AM', 'Not now: pick when to come back', 'Not now. Alex picks when to come back, and it lands on the calendar when it is due.');
  await tap('#view .door.open button', '^Not now$', { after: 900 });
  await tap('#view .door.open .chip', '^Spring', { after: 600 });
  await tap('#view .door.open .chip', '^Save$', { after: 1800 }); await pause(1400);
  await scene('8:31 AM', 'They want a quote. The number goes on the card', 'This one wants a quote. The number they gave at the door goes straight on the card.');
  await tap('#view .door.open button', '^Add info$', { after: 600 });
  await tap('#view .door.open button[data-cap=phone]', null, { after: 700 });
  await tap('#view .door.open .cap input[type=tel]', null, { after: 300 }); await type('(303) 555-0142', 9); await pause(700);
  await tap('#view .door.open .cap .save', '^Save$', { after: 1500 });
  await scene('8:32 AM', 'A note: speak it or type it', 'And a note. Alex can speak it instead of typing, handy with gloves on.');
  await tap('#view .door.open button[data-cap=note]', null, { after: 700 });
  await tap('#view .door.open .cap textarea', null, { after: 300 }); await type('Granules in the gutters, two dented vents. Home after 5 on weekdays.', 16); await pause(900);
  await tap('#view .door.open .cap .save', '^Save$', { after: 1400 });
  await scene('8:33 AM', 'Quote booked: the inspection, tomorrow at 5:30', 'Quote booked. Alex books the inspection on the spot, tomorrow at five thirty, and the office sees it in the pipeline.');
  await tap('#view .door.open button', '^Quote booked$', { after: 1600 });
  await tap('.walkp .wchips button', '^Tomorrow$', { after: 900 });
  await tap('.walkp .wrow select', null, { after: 300 });
  await P.js(`(() => { const s = document.querySelector('.walkp .wrow select'); s.value = '17:30'; s.dispatchEvent(new Event('change', { bubbles: true })); s.blur(); })()`); await pause(900);
  await tap('.walkp .save', '^Save the', { after: 1600 }); await pause(1200);
  if (await has('button.capdone', '^Done with this door$')) await tap('button.capdone', '^Done with this door$', { after: 1500 });
  await scene('10:05 AM', 'The map: what is done and what is left', 'Mid-morning, the map shows the street: what is done, what is waiting for a second knock, and what is left.');
  await tap('#foot button, .dock button', '^Map$', { after: 1500 }); await pause(4200);
  await tap('#foot button, .dock button', '^Back$', { after: 2500 });
  if (await has('button.tile', '^My stats')) { await pause(1200); await tap('#view .area, #view button', D.area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), { after: 400 }); await P.until(`!!document.querySelector('#view .door.open')`, 60000); await pause(900); }
  await scene('11:40 AM', 'Down the street, door after door', 'And on down the street, door after door.');
  await tap('#view .door.open button', '^No answer$', { after: 1500 });
  await tap('#view .door.open button', '^No answer$', { after: 1500 }); await pause(800);
  await scene('4:45 PM', 'End of the day: the numbers against the goal', 'End of the day. Alex sees their numbers against the goal, and so does their manager. No paper, no end-of-day report to type up.');
  await tap('header button.back', null, { after: 1200 });
  if (!(await has('button.tile', '^My stats'))) await tap('header button.back', null, { after: 1200 });
  await tap('button.tile', '^My stats', { after: 1400 }); await pause(3000); await scroll(380); await pause(3500);
};

try { await STORIES[STORY](); await holdForVo(); await sleep(1500); }
catch (e) { console.log('STOPPED: ' + e.message); writeFileSync(`${OUT}/stopped.png`, Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }
await stopRec(); await sleep(500);
const end = t0 === null ? 0 : Date.now() - t0;
writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ story: STORY, w: W * DPR, h: H * DPR, end, timeline, frames }, null, 1));
console.log(`frames ${frames.length}, ${(end / 1000).toFixed(1)} s, page errors ${P.errors.length}${P.errors.length ? ': ' + P.errors[0] : ''}`);
ch.kill(); process.exit(0);

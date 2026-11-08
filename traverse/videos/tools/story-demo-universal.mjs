// The demo-universal story (script: ../demo-universal/script.md, approved by Matthew 7 Nov 2026): one entry per beat, in script order,
// all on the ONE local demo copy ("Example Co", demo-universal-config.mjs). No trade sections and no edition names: the frame label is the
// section (House facts, Storms, Plan, At the door, The office). Each scene says what it shows and drives the real app; record-demo-universal.mjs
// captures and frames it. layout: card | desk | deskphone | phone. Nothing here fakes a screen: a beat the copy cannot show honestly
// throws, and the README says what is missing.
//
// The voice: VOICES holds every line exactly as the script writes it (never reworded), one Gemini clip each (voice-demo-universal.mjs).
// A scene names its clip per cut ({ site, yt }); a clip that runs over several scenes (a sentence whose parts need different screens) is
// split at word boundaries (part: [first word, last word + 1]); the build times each part from the clip's own word timings.
// cut: 'both' (website and YouTube) or 'yt' (YouTube only).
import { readFileSync, writeFileSync } from 'node:fs'; import { DEMO_DIR } from './demo-universal-config.mjs';

export const VOICES = {
  open: 'Every day your reps knock on doors and make calls. Traverse helps you find the properties most likely to buy, before anyone makes first contact.',
  facts: 'Every property in your area comes with the facts that matter to your business, and the best properties rise to the top.',
  storms: 'Storm days, with the hail size and the path over your map.',
  roofS: 'The roof’s size, pitch and age. New owners, with the month they moved in.',
  roofY: 'The roof’s size, pitch and age. Whether it’s been re-roofed since. New owners, with the month they moved in.',
  lawn: 'The lawn’s size, with the property line on the photo.',
  sun: 'How much sun the roof gets, and the solar system that fits it. And a whole lot more data points on every property.',
  solarDown: 'Properties that already have solar move down the list, and the town’s watering days are right there.',
  every: 'Every plan comes with every feature. Use the ones your business needs.',
  tick: 'Tick a street and assign it to a rep.',
  phone: 'It’s on their phone before they leave the lot.',
  radar: 'Live radar and weather alerts let you know the moment something hits your towns.',
  quote: 'At the door, quote from the property’s own size, at your own prices.',
  sign: 'The homeowner signs on their phone, and you can take the deposit right there, or send it back to your office team to handle, right in the same app.',
  done: 'Mark the job done, and the aftercare tips and your review link go out on their own.',
  office: 'Back at the office, every lead is in one pipeline, with territories and who knocked what.',
  fb: 'Connect your Facebook lead ads and new leads land in the pipeline.',
  eod: 'And get a picture of the day by email, every night.',
  close: 'Traverse. The all-in-one sales platform for the field and office. See it with your own area at traverseplatforms.com.',
};
/* where VOICES.sign splits: "The homeowner signs on their phone," | "and you can take the deposit right there," | "or send it back ..." */
const SIGN_W = VOICES.sign.split(/\s+/); const at = (w) => SIGN_W.indexOf(w);

/* ---- helpers on a screen (see makeScreen in record-demo-universal.mjs) ---- */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function home(s) {
  if (s.dev === 'desk') { await s.nav('Home'); return; }
  if (await s.has('#dock button, .dock button', '^Home$')) { await s.tap('#dock button, .dock button', '^Home$', { after: 2000 }); return; }
  for (let i = 0; i < 4 && !(await s.has('button.cty, button.tile')); i++) { if (await s.has('header button.back')) await s.tap('header button.back', null, { after: 1200 }); else break; }
}
/* a house by its address, through the app's own search (typed in this local browser; the screen shows it masked) */
async function openHouse(s, addr) {
  /* a phone starts again from the app's home (a screen left deep inside, the lawn photo say, has no search) */
  if (s.dev !== 'desk') { await s.go(s.appUrl); await s.until(`!document.querySelector('.keys') && document.querySelector('button.cty, button.tile, .findbox, input[type=search]')`, 60000); await wait(1500); await s.dismiss(); }
  else await home(s);
  await wait(500);
  const how = await s.js(`const h = [...document.querySelectorAll('input[type=search], input.findbox, .findbox input')].find((x) => x.offsetParent && /find/i.test(x.placeholder || ''));
    if (h) { h.focus(); h.value = ${JSON.stringify(addr)}; h.dispatchEvent(new Event('input', { bubbles: true })); h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 'box'; }
    const f = document.querySelector('.findbox'); if (f && f.offsetParent) { f.click(); return 'open'; } return 'none';`);
  if (how === 'none') throw new Error('no address search on this screen');
  await s.until(`document.getElementById('searchq') || document.querySelector('.srow')`, 20000);
  await s.js(`const i = document.getElementById('searchq'); if (i && !document.querySelector('.srow')) { i.value = ${JSON.stringify(addr)}; i.dispatchEvent(new Event('input', { bubbles: true })); }`);
  if (!(await s.until(`document.querySelector('.srow')`, 90000))) throw new Error('the search found nothing for the demo house');
  await s.js(`document.querySelector('.srow').click()`);
  if (!(await s.until(`document.querySelector('#view .door.open, .dkcard .addr, .dkcard')`, 30000))) throw new Error('the house card did not open');
  if (s.dev === 'desk') await settleCard(s);
  await clearSearch(s); await wait(2500);
}
/* the phone card scrolled so one of its blocks (a selector inside the open card) sits under the app bar; its More opened */
async function toBlock(s, sel, open = true) {
  const ok = await s.js(`const e = document.querySelector('#view .door.open ' + ${JSON.stringify(sel)}); if (!e) return 0;
    const t = e.querySelector('.ftog'); if (${open} && t && t.getAttribute('aria-expanded') !== 'true') t.click();
    e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -96); return 1;`);
  if (!ok) throw new Error('the card has no ' + sel + ' block');
  await wait(900);
}
async function settleCard(s) { await s.until(`(() => { const c = document.querySelector('.dkcard'); return c && !/Loading/i.test(c.innerText) && [...c.querySelectorAll('img')].every((i) => i.complete); })()`, 30000); await wait(1500); }
const clearSearch = (s) => s.js(`document.querySelectorAll('input[type=search]').forEach((i) => { i.value = ''; })`);
async function settleMap(s, ms = 30000) { await s.until(`document.querySelectorAll('.leaflet-tile-loaded').length > 4 || document.querySelector('.leaflet-container canvas')`, ms); await wait(2500); }
/* every map tile on screen fully loaded, nothing still fading in (8 Nov, Matthew: the opening "isnt fully loaded and its loading partially
   while the video is playing. That makes the app looks slow") */
async function settleTiles(s, ms = 90000) {
  await s.until(`(() => { const t = [...document.querySelectorAll('.leaflet-tile')]; return t.length > 4 && t.every((i) => i.classList.contains('leaflet-tile-loaded') && i.complete && i.naturalWidth > 0); })()`, ms);
  await wait(2500);
}
async function reload(s) { await s.go(s.appUrl); await s.until(`!document.querySelector('.keys') && document.querySelector('#dnav button, #dnav a, nav button, button.tile')`, 60000); await wait(2000); await s.dismiss(); }
async function deskTool(s, label) { await s.nav('Home'); await s.tap('#view button, #view a', '^' + label + '$', { after: 3000 }); }
/* a smooth scroll of the page (or one scroll box), spread over ms */
async function glide(s, px, ms, sel) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) { await s.js(`(${sel ? `document.querySelector(${JSON.stringify(sel)})` : 'null'} || window).scrollBy(0, ${px / steps})`); await wait(40); }
}
/* the storm day as the Storms list writes it ("22 Jun 2023") */
const dayLabel = (iso) => { const [y, m, d] = iso.split('-').map(Number); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y; };

/* ---- the walking order (company.json "best") for the one scene that needs Solar's: houses that already have solar sink ---- */
const CO_FILE = () => DEMO_DIR + '/one/traverse-data/rounds/company.json';
export function setBest(b) { const f = CO_FILE(), c = JSON.parse(readFileSync(f, 'utf8')); if (c.best === b) return; c.best = b; writeFileSync(f, JSON.stringify(c, null, 2) + '\n'); }

const HF = 'House facts', ST = 'Storms', PL = 'Plan', AD = 'At the door', OF = 'The office';
export const SCENES = [
  /* ---- Opening ---- */
  { n: 1, cut: 'both', layout: 'desk', section: '', voice: { site: 'open', yt: 'open' }, shows: 'The town map, properties coloured best to worst; one house card opens',
    cap: 'Find the properties most likely to buy.',
    run: async ({ screen }) => {
      const d = await screen('one', 'desk');
      await d.nav('Home'); await d.tap('button', '^Open the workspace', { after: 4000 }); await settleMap(d);
      /* warm-up (8 Nov): open the card once so its lot photo and the map tiles are cached, then start again from a clean page and
         wait for every tile, so nothing loads on camera */
      /* (no reload: the app keeps the photo search and the last card's lot map in the page, and reopening that card reuses them) */
      await d.tap('.dkrow', null, { after: 0 }); await settleCard(d);
      await d.js(`const x = document.querySelector('.dkc-x'); if (x) x.click();`); await wait(1500); await settleTiles(d);
      return { desk: d };
    },
    show: async ({ desk }) => { await wait(3500); await desk.tap('.dkrow', null, { after: 0 }); } },

  /* ---- House facts ---- */
  { n: 2, cut: 'both', layout: 'deskphone', section: HF, voice: { site: 'facts', yt: 'facts' }, shows: 'Best properties first: the Plan list on the computer, the same list on the phone',
    cap: 'The facts that matter to your business, best properties first.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk'); await d.nav('Plan'); await d.until(`document.querySelectorAll('tbody tr').length > 10`, 60000); await wait(1500);
      const p = await screen('one', 'phone'); await bestList(p, DEMO);
      return { desk: d, phone: p };
    },
    show: async ({ phone }, secs) => { await wait(1500); await glide(phone, 500, secs * 1000 * 0.6); } },
  { n: 3, cut: 'both', layout: 'deskphone', section: ST, voice: { site: 'storms', yt: 'storms' }, shows: 'Storms: every storm day with its hail size (computer); one day’s hail path over the map (phone)',
    cap: 'Every storm day, the hail size and its path.',
    run: async ({ screen, DEMO }) => {
      const day = dayLabel(DEMO.one.stormRecentISO);
      const d = await screen('one', 'desk'); await d.nav('Storms'); await d.tap('button', '^Every storm day$', { after: 2000 });
      const p = await screen('one', 'phone'); await home(p);
      await p.tap('button.cty', '^Storms and data', { after: 1500 }); await p.tap('button', '^Hail', { after: 3000 });
      if (await p.has('button', '^¾ inch or more')) await p.tap('button', '^¾ inch or more', { after: 2500 });
      /* the storm day on the phone's list (its last two years): the demo town's own if it is listed, else the nearest towns', else the biggest */
      const hit = await p.js(`const cs = [...document.querySelectorAll('.hailc')]; const n = (c) => parseInt((c.textContent.match(/([\\d,]+) properties/) || [0, '0'])[1].replace(/,/g, ''), 10);
        const c = cs.find((x) => x.textContent.includes(${JSON.stringify(day)})) || cs.find((x) => /Highlands Ranch/.test(x.textContent)) || cs.find((x) => /Lone Tree|Parker|Littleton|Centennial/.test(x.textContent) && n(x) >= 500) || cs.sort((a, b) => n(b) - n(a))[0];
        if (!c) return ''; c.scrollIntoView({ block: 'center' }); const b = [...c.querySelectorAll('button, a')].find((x) => /Show on the map/.test(x.textContent)); if (!b) return ''; b.click(); return c.querySelector('b, h3, .hd, div') ? c.textContent.slice(0, 40) : 'ok';`);
      if (!hit) throw new Error('no storm day to show on the phone');
      await p.js('const m = (window.__maps || []).slice(-1)[0]; if (m) m.setView([' + DEMO.one.house.lat + ', ' + DEMO.one.house.lon + '], 11);');
      await settleMap(p); await wait(1500);
      /* framed again once the path has drawn (the screen fits the whole state first) */
      await p.js('const m = (window.__maps || []).slice(-1)[0]; if (m) m.setView([' + DEMO.one.house.lat + ', ' + DEMO.one.house.lon + '], 10);'); await settleMap(p); await wait(2500);
      return { desk: d, phone: p };
    },
    show: async ({ desk }, secs) => { await wait(1500); await glide(desk, 400, secs * 1000 * 0.5); } },
  { n: 4, cut: 'both', layout: 'deskphone', section: HF, voice: { site: 'roofS', yt: 'roofY' }, shows: 'A house card: roof size, pitch and age, the last re-roof, the last sale (new owner)',
    cap: 'The roof, its age, a re-roof, a new owner.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk'); await openHouse(d, DEMO.one.house.address); await settleMap(d, 10000);
      const p = await screen('one', 'phone'); await openHouse(p, DEMO.one.house.address);
      await toBlock(p, '.roofx', true);
      return { desk: d, phone: p };
    },
    show: async ({ phone }) => { await wait(3200); await phone.js(`const e = document.querySelector('#view .door.open .mvx'); if (e) { e.scrollIntoView({ block: 'start', behavior: 'smooth' }); setTimeout(() => window.scrollBy({ top: -96, behavior: 'smooth' }), 600); }`); } },
  { n: 5, cut: 'both', layout: 'deskphone', section: HF, voice: { site: 'lawn', yt: 'lawn' }, shows: 'The lawn: its size, and the property line on the photo with the lawn shaded',
    cap: 'The lawn’s size and the property line.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk'); await openHouse(d, DEMO.one.house.address); await settleMap(d, 10000);
      const p = await screen('one', 'phone'); await openHouse(p, DEMO.one.house.address);
      const chip = await p.js(`const e = [...document.querySelectorAll('#view .door.open .lawn')].find((x) => /sq ft/.test(x.textContent)); if (!e) return 0; e.scrollIntoView({ block: 'center' }); e.click(); return 1;`);
      if (!chip) throw new Error('no lawn chip on the card');
      await p.tap('button', '^See the lawn on the photo', { after: 3000 });
      if (!(await p.until(`/Lawn we counted/.test(document.body.innerText)`, 30000))) throw new Error('the lawn outline did not draw');
      await settleMap(p, 20000); await wait(3000);
      return { desk: d, phone: p };
    } },
  { n: 6, cut: 'both', layout: 'deskphone', section: HF, voice: { site: 'sun', yt: 'sun' }, shows: 'The sun block: the roof facing the sun, the shade, the system that fits and a year’s output; then more of the card',
    cap: 'The sun on the roof, and the system that fits.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk'); await openHouse(d, DEMO.one.house.address); await deskTo(d, /faces the sun|system that fits|kW/);
      const p = await screen('one', 'phone'); await openHouse(p, DEMO.one.house.address);
      await toBlock(p, '.solarx', true);
      return { desk: d, phone: p };
    },
    show: async ({ phone }, secs) => { await wait(secs * 1000 * 0.55); await glide(phone, 700, secs * 1000 * 0.3); } },
  { n: 7, cut: 'yt', layout: 'deskphone', section: HF, voice: { yt: 'solarDown' }, shows: 'Best first in a solar walking order: houses with solar already sit at the foot and say so (computer); the town’s watering days on the card (phone)',
    cap: 'Solar already? It moves down. Watering days on the card.',
    problems: ['The list here is in the solar walking order (company setting "best": solar) for this scene only; the rest of the video uses the roofing order. One install has one walking order.'],
    run: async ({ screen, DEMO }) => {
      setBest('solar'); await wait(800);
      /* the same computer, the page loaded again so it reads the order (a second computer sign-in would end the first: one computer per code) */
      const d = await screen('one', 'desk'); await reload(d); if (!DEMO.one.solarArea) throw new Error('no neighbourhood with solar already picked (setup)');
      await openHouse(d, DEMO.one.solarArea.addr);
      for (let i = 0; i < 6; i++) { await d.js(`const r = [...document.querySelectorAll('.dkrow')].pop(); if (r) r.scrollIntoView({ block: 'end' });`); await wait(900); }
      let hit = false;
      for (let k = 1; k <= 14 && !hit; k++) {
        await d.js(`const rs = [...document.querySelectorAll('.dkrow')]; const r = rs[rs.length - ${k}]; if (r) { r.scrollIntoView({ block: 'center' }); r.click(); }`); await wait(1800);
        hit = await d.js(`return /has solar|solar since|already has solar/i.test((document.querySelector('.dkcard') || document.body).innerText)`);
      }
      if (!hit) throw new Error('no house with solar already near the foot of the list');
      const p = await screen('one', 'phone'); await openHouse(p, DEMO.one.house.address);
      await p.until(`document.querySelector('#view .door.open .waterl')`, 20000);
      const ok = await p.js(`const t = [...document.querySelectorAll('#view .door.open .factsx .ftog')][0]; if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); const w = document.querySelector('#view .door.open .waterl'); if (!w) return 0; w.scrollIntoView({ block: 'center' }); return 1;`);
      if (!ok) throw new Error('no watering line on the card');
      await wait(1500);
      return { desk: d, phone: p };
    },
    after: async ({ screen }) => { setBest('roof'); await reload(await screen('one', 'desk')); } },
  { n: 8, cut: 'both', layout: 'deskphone', section: HF, voice: { site: 'every', yt: 'every' }, shows: 'A quick run of house cards, one fact after another',
    cap: 'Every plan comes with every feature.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk'); await openHouse(d, DEMO.one.house.address);
      /* warm-up (8 Nov): open each card the scene flips through, so their lot photos and lines are already fetched */
      for (let k = 2; k <= 5; k++) { await d.js(`const r = [...document.querySelectorAll('.dkrow')][${k}]; if (r) { r.scrollIntoView({ block: 'nearest' }); r.click(); }`); await settleCard(d); }
      await openHouse(d, DEMO.one.house.address); await settleCard(d); await settleTiles(d);
      const p = await screen('one', 'phone'); await openHouse(p, DEMO.one.house.address);
      await p.js('window.scrollTo(0, 0)'); await wait(500);
      return { desk: d, phone: p };
    },
    show: async ({ desk, phone }, secs) => {
      const g = glide(phone, 2200, secs * 1000 * 0.85);
      for (let k = 2; k <= 5; k++) { await wait(secs * 1000 * 0.19); await desk.js(`const rs = [...document.querySelectorAll('.dkrow')]; const r = rs[${k}]; if (r) { r.scrollIntoView({ block: 'nearest' }); r.click(); }`); }
      await g;
    } },

  /* ---- Plan ---- */
  { n: 9, cut: 'both', layout: 'desk', section: PL, voice: { site: 'tick', yt: 'tick' }, shows: 'Plan: a street ticked and given to a rep',
    cap: 'Tick a street and assign it to a rep.',
    run: async ({ screen }) => {
      const d = await screen('one', 'desk'); await d.nav('Plan'); await d.until(`document.querySelectorAll('tbody tr').length > 10`, 60000);
      await d.js("const c = [...document.querySelectorAll('.card')].find((x) => /^By neighbo/.test((x.querySelector('h3') || {}).textContent || '')); const b = c && c.querySelector('button'); if (b) b.click();"); await wait(2500);
      if (!(await d.js("return document.querySelectorAll('tbody tr input[type=checkbox]').length"))) throw new Error('no rows to tick');
      await d.until("[...document.querySelectorAll('.planbar select option, select option')].some((o) => o.value === 'Alex Rivera')", 15000);
      return { desk: d };
    },
    /* the ticks and the rep picked while the line plays */
    show: async ({ desk }) => {
      await wait(600);
      for (let k = 0; k < 10; k++) { await desk.js(`const c = [...document.querySelectorAll('tbody tr input[type=checkbox]')][${k}]; if (c && !c.checked) c.click();`); await wait(140); }
      await wait(300);
      await desk.js("const s = document.querySelector('.planbar select'); if (s) { s.value = 'Alex Rivera'; s.dispatchEvent(new Event('change', { bubbles: true })); }");
    } },
  { n: 10, cut: 'both', layout: 'deskphone', section: PL, voice: { site: 'phone', yt: 'phone' }, shows: 'Assigned: the houses on the rep’s phone, tagged for him',
    cap: 'On their phone before they leave the lot.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('one', 'desk');
      if (!(await d.has('.planbar button.save', '^Assign$'))) throw new Error('nothing ticked to assign (scene 9 first)');
      await d.tap('.planbar button.save', '^Assign$', { after: 3000 });
      if (await d.has('button', '^Assigned$')) await d.tap('button', '^Assigned$', { after: 2500 });
      await d.js("const t = document.querySelector('table'); let p = t && t.parentElement; while (p && p.scrollWidth <= p.clientWidth) p = p.parentElement; if (p) p.scrollLeft = 99999;"); await wait(800);
      const log = readFileSync(DEMO_DIR + '/one/traverse-data/rounds/dassign-' + DEMO.one.town + '.log', 'utf8').trim().split(/\r?\n/).pop();
      const id = JSON.parse(log).id; if (!id) throw new Error('no assigned door in the log');
      const p = await screen('one', 'phone', 'Alex Rivera'); await openHouse(p, id.replace(/-/g, ' ').toUpperCase());
      await p.scrollTo('#view .door.open .reptag, #view .reptag', null, 'center');
      return { desk: d, phone: p };
    } },
  { n: 11, cut: 'yt', layout: 'desk', section: PL, voice: { yt: 'radar' }, shows: 'Live radar over the map',
    cap: 'Live radar and weather alerts for your towns.',
    run: async ({ screen }) => { const d = await screen('one', 'desk'); await deskTool(d, 'Live radar'); await settleMap(d); await wait(3000); return { desk: d }; },
    show: async ({ desk }) => { await wait(800); if (await desk.has('button', '^Play last 2 hours')) await desk.tap('button', '^Play last 2 hours', { after: 0 }); } },

  /* ---- At the door ---- */
  { n: 12, cut: 'both', layout: 'phone', section: AD, voice: { site: 'quote', yt: 'quote' }, shows: 'The rep’s phone at the door: the quote built from the house’s own size, Good / Better / Best at the company’s own (starter) prices',
    cap: 'Quote from the property’s own size, at your own prices.',
    problems: ['Shows the made-up company’s starter prices in dollars (the customer’s pricing, not Traverse’s).'],
    run: async (c) => ({ phone: await repQuote(c, 'Alex Rivera', WHO, false) }),
    show: async ({ phone }, secs) => { await wait(2500); await glide(phone, 520, secs * 1000 * 0.45); } },
  /* the sentence over three screens; the deposit is recorded before the form goes out (the app's order), so 14 is recorded before 13 */
  { n: 13, cut: 'both', layout: 'phone', section: AD, voice: { site: 'sign', yt: 'sign' }, part: [0, at('and')], run_after: 14.5, shows: 'The agreement on the homeowner’s phone: name typed, boxes ticked, signed',
    cap: 'The homeowner signs on their phone.',
    run: async (c) => ({ phone: await openForm(c) }),
    show: async (got) => { await signForm(got.phone); } },
  { n: 14, cut: 'both', layout: 'phone', section: AD, voice: { site: 'sign', yt: 'sign' }, part: [at('and'), at('or')], shows: 'They said yes: the deposit taken at the door by card, and the one-page form to sign',
    cap: 'Take the deposit right there,',
    problems: ['Recorded as taken at the door by card ("I took the deposit"); paying on the homeowner’s own phone needs the company’s Square or Stripe connected, which a demo copy does not have.'],
    run: async (c) => ({ phone: await depositForm(c) }),
    show: async ({ phone }) => { await wait(1600); await phone.tap('button.jtaken', null, { after: 0 }); } },
  { n: 15, cut: 'both', layout: 'deskphone', section: OF, voice: { site: 'sign', yt: 'sign' }, part: [at('or'), SIGN_W.length], shows: 'The office side: a quote a rep saved in the field, in the office Pipeline, and the office taking on the deposit and the form',
    cap: 'or send it back to your office team.',
    problems: ['There is no separate "send to office" button on the editions (the Sixfold-only Quick quote has one). What is shown: a quote a rep saved on his phone sits on the lead in the office Pipeline, and the office opens it and takes the deposit and sends the form from there (the Agreements and deposits switch in Accounts decides whether reps or only the office do this).'],
    run: async (c) => officeTakesOver(c),
    show: async ({ desk }) => { await wait(2200); await desk.tap('button', '^They said yes', { after: 0 }); } },
  /* "Mark the job done," | "and the aftercare tips and your review link go out on their own." over two screens */
  { n: 16, cut: 'yt', layout: 'desk', section: AD, voice: { yt: 'done' }, part: [0, VOICES.done.split(/\s+/).indexOf('and')], shows: 'The job marked Done on the Jobs board',
    cap: 'Mark the job done,',
    run: async (c) => jobDoneScene(c),
    /* Done picked with the time it took; saved at the start of the next scene (the save reloads the job page, longer than this 2 s line) */
  },
  { n: 22, cut: 'yt', layout: 'desk', section: AD, voice: { yt: 'done' }, part: [VOICES.done.split(/\s+/).indexOf('and'), VOICES.done.split(/\s+/).length], shows: 'Setup, Customer emails: the aftercare email after a job, with the review link, switched on',
    cap: 'and the aftercare tips and your review link go out on their own.',
    problems: ['The demo copy has no mailbox connected, so nothing is really sent; the aftercare email is shown switched on in Setup, Customer emails.'],
    run: async ({ screen }) => {
      const d = await screen('one', 'desk');
      if (await d.has('.jdone button.save')) { await d.tap('.jdone button.save', null, { after: 2500 }); if (!(await d.has('#view button', '^Undo this$'))) throw new Error('the Done did not save'); }
      await careScene(d); return { desk: d };
    } },

  /* ---- The office ---- */
  { n: 17, cut: 'both', layout: 'desk', section: OF, voice: { site: 'office', yt: 'office' }, part: [0, VOICES.office.split(/\s+/).indexOf('with')], shows: 'Every lead in one pipeline',
    cap: 'Every lead in one pipeline.',
    run: async ({ screen }) => { const d = await screen('one', 'desk'); await pipeStage(d, 'To call'); return { desk: d }; } },
  { n: 18, cut: 'both', layout: 'desk', section: OF, voice: { site: 'office', yt: 'office' }, part: [VOICES.office.split(/\s+/).indexOf('with'), VOICES.office.split(/\s+/).length], shows: 'Territories on the map, and the houses each rep knocked',
    cap: 'Territories, and who knocked what.',
    problems: ['The knocks are made-up ones, marked on the copy by the made-up reps (Alex Rivera, Sam Ortiz) before recording.'],
    run: async (c) => territoryScene(c) },
  { n: 19, cut: 'yt', layout: 'desk', section: OF, voice: { yt: 'fb' }, shows: 'Facebook lead ads: connect the Page, and leads come into the Pipeline on their own',
    cap: 'Connect your Facebook lead ads.',
    problems: ['A lead arriving from Facebook cannot be shown: the copy is not connected to a Page. Shown: the real Facebook leads screen in Setup.'],
    run: async ({ screen }) => { const d = await screen('one', 'desk'); await deskTool(d, 'Setup'); await d.tap('button, a', '^Facebook', { after: 3000 }); return { desk: d }; } },
  { n: 20, cut: 'yt', layout: 'desk', section: OF, voice: { yt: 'eod' }, shows: 'The end-of-day email: a picture of the day, every night',
    cap: 'A picture of the day by email, every night.',
    run: async ({ screen }) => {
      const d = await screen('one', 'desk'); await deskTool(d, 'Stats');
      await d.tap('button', '^(Set up|Change) the end-of-day email', { after: 3500 });
      await d.tap('#view button', '^Preview$', { after: 5000 });
      await d.scrollTo('iframe.fuframe', null, 'center');
      return { desk: d };
    } },

  /* ---- Close ---- */
  { n: 21, cut: 'both', layout: 'card', voice: { site: 'close', yt: 'close' }, eyebrow: 'Traverse', title: 'The all-in-one sales platform for the field and office.', sub: 'See it with your own area.', foot: 'Book a demo: traverseplatforms.com\n(303) 596-9515',
    shows: 'Closing card' },
];

/* ---- the screens the scenes share ---- */
/* the phone's list of the demo house's neighbourhood, best first (the door view's Best order) */
async function bestList(p, DEMO) {
  await openHouse(p, DEMO.one.house.address);
  /* the card folded back into the list, the list at its top */
  await p.js(`const o = document.querySelector('#view .door.open .dtop, #view .door.open .addr'); if (o) o.click();`); await wait(1200);
  await p.js('window.scrollTo(0, 0)'); await wait(800);
}
/* the computer's house card scrolled to a line */
async function deskTo(d, re) {
  await d.js(`const c = document.querySelector('.dkcard'); if (!c) return 0; const t = c.querySelectorAll('.ftog'); t.forEach((x) => { if (x.getAttribute('aria-expanded') !== 'true' && x.closest('.solarx')) x.click(); });
    const e = [...c.querySelectorAll('*')].find((x) => x.children.length <= 2 && ${re.toString()}.test(x.textContent)); if (e) e.scrollIntoView({ block: 'center' }); return 1;`);
  await wait(1200);
}
/* a neighbourhood's list on the computer (the workspace, the area picked from the side list) */
async function openArea(d, area) {
  await d.nav('Home'); await d.tap('button', '^Open the workspace', { after: 4000 }); await settleMap(d, 15000);
  const ok = await d.js(`const b = [...document.querySelectorAll('button, .dkarea, [role=button]')].find((x) => x.offsetParent && x.textContent.trim().startsWith(${JSON.stringify(area)})); if (!b) return 0; b.click(); return 1;`);
  if (!ok) { /* through a house of the area instead */ throw new Error('the neighbourhood ' + area + ' is not in the workspace list'); }
  await wait(3500);
}
/* a stage button reads '3To call' or 'To call 2' (the count before or after) */
const stageRe = (st) => '^\\d*\\s*' + esc(st) + '(\\s*\\d+)?$';
async function pipeStage(d, st) {
  await d.nav('Pipeline');
  if (!(await d.until("[...document.querySelectorAll('#view button')].some((b) => /To call/.test(b.textContent))", 90000))) throw new Error('the Pipeline did not load');
  await d.tap('#view button', stageRe(st), { after: 2500 });
}
async function openLead(d, name) {
  await d.nav('Pipeline');
  if (!(await d.until("[...document.querySelectorAll('#view button')].some((b) => /To call$/.test(b.textContent.trim()))", 90000))) throw new Error('the Pipeline did not load');
  for (const st of ['To call', 'Quote sent', 'Quoted', 'Inspection booked', 'Walk booked', 'Survey booked']) {
    if (!(await d.has('#view button', stageRe(st)))) continue;
    await d.tap('#view button', stageRe(st), { after: 1800 });
    if (await d.has('button, .lcard, .lead, div', '^' + esc(name))) { await d.tap('button, .lcard, .lead, div', '^' + esc(name), { after: 2000 }); return; }
  }
  throw new Error('the lead ' + name + ' is not in the Pipeline');
}
const WHO = 'Taylor Brooks', OFFICE_LEAD = 'Jamie Patel';
/* the quote builder for the door's homeowner, filled from the house card at the company's own (starter) prices */
async function quoteFor({ screen }, name = WHO) {
  const d = await screen('one', 'desk'); await openLead(d, name);
  await d.tap('button', '^(Build a|Change the) quote', { after: 4500 });
  if (!(await d.until(`[...document.querySelectorAll('#view b, #view div')].some((x) => /^(Good|Better|Best)$/.test(x.textContent.trim()))`, 20000))) throw new Error('the quote builder did not fill');
  return d;
}
/* a rep's own lead on his phone (the office gave it to him): Calendar, My leads, the lead, Build a quote, filled from the house card;
   saved too when save is true. The screen is left on the quote. */
async function repQuote(c, rep, lead, save) {
  const p = await c.screen('one', 'phone', rep);
  await p.go(p.appUrl); await p.until(`!document.querySelector('.keys') && document.querySelector('button.tile, button.cty, #dock button')`, 60000); await wait(1500); await p.dismiss();
  if (await p.has('#dock button, .dock button', '^Calendar$')) await p.tap('#dock button, .dock button', '^Calendar$', { after: 2500 });
  else await p.tap('button.tile, button', '^Calendar', { after: 2500 });
  await p.tap('button', '^My leads$', { after: 2500 });
  await p.tap('button, .lcard, .lead, div', '^' + esc(lead), { after: 2500 });
  await p.tap('button', '^(Build a|Change the) quote', { after: 4500 });
  if (!(await p.until(`[...document.querySelectorAll('#view b, #view div')].some((x) => /^(Good|Better|Best)$/.test(x.textContent.trim()))`, 20000))) throw new Error(rep + '’s quote builder did not fill');
  await p.js('window.scrollTo(0, 0)'); await wait(600);
  await p.scrollTo('#view *', '^Options for the customer', 'start');
  if (save) { await p.tap('button', '^Save the quote$', { after: 3000 }); await p.scrollTo('.kitsend', null, 'start'); }
  return p;
}
/* "They said yes" on the rep's phone at the door: the quote saved, then the deposit (taken by card) and the one-page form that needs a
   signature; the "I took the deposit" tap is left for the recording */
async function depositForm(c) {
  const p = await c.screen('one', 'phone', 'Alex Rivera');
  if (!(await p.has('button', '^Save the quote$'))) await repQuote(c, 'Alex Rivera', WHO, false);
  await p.tap('button', '^Save the quote$', { after: 3000 });
  await p.tap('button', '^They said yes', { after: 3500 });
  const today = await p.js(`const t = new Date(); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getDay()] + ' ' + t.getDate();`);
  if (await p.has('button', '^Riley Chen$')) await p.tap('button', '^Riley Chen$', { after: 800 });
  if (await p.has('button.jsd', '^' + esc(today))) await p.tap('button.jsd', '^' + esc(today), { after: 800 });
  if (await p.has('#view button', '^3:00$')) await p.tap('#view button', '^3:00$', { after: 600 });
  if (await p.has('#view button', '^Card')) await p.tap('#view button', '^Card', { after: 600 });
  await p.tap('#view button', '^Needs their signature', { after: 600 });
  await p.scrollTo('.jdep', null, 'start');
  c.state.depPhone = p;
  return p;
}
/* the form sent from the rep's phone (after the deposit tap), opened on the homeowner's own phone, ready to sign */
async function openForm(c) {
  const p0 = c.state.depPhone; if (!p0) throw new Error('no deposit form (scene 14 first)');
  if ((await p0.js(`const b = document.querySelector('button.jtaken'); return b ? b.getAttribute('aria-pressed') : 'none'`)) === 'false') await p0.tap('button.jtaken', null, { after: 500 });
  await p0.tap('#view button.save', '^Send the form', { after: 4000 });
  const link = await p0.js(`const a = [...document.querySelectorAll('a[href]')].find((x) => x.href.includes('sign.html?s=')); if (a) return a.href; const w = document.body.innerText.split(/\\s+/).find((x) => x.includes('sign.html?s=')); return w || '';`);
  if (!link) throw new Error('no form link after Send the form: ' + (await p0.text('#view')).slice(0, 160).replace(/\s+/g, ' '));
  const url = c.local(c.origin('one') + link.replace(/^https?:\/\/[^/]+/, ''));
  const p = await c.screen('one', 'phone', 'homeowner'); await p.go(url);
  if (!(await p.until(`[...document.querySelectorAll('label.name input, input')].some((i) => i.offsetParent)`, 20000))) throw new Error('the form did not open on the phone: ' + (await p.text()).slice(0, 160));
  await p.scrollTo('label.name, label.agree', null, 'center');
  c.signed.one = url;
  return p;
}
async function signForm(p) {
  /* quick: the line over this screen is about 2.5 s, and the signed card should be on screen for the last of it */
  await p.js(`const i = document.querySelector('label.name input') || [...document.querySelectorAll('input')].find((x) => x.type === 'text'); i.scrollIntoView({ block: 'center' }); i.focus();`);
  for (const ch of WHO) { await p.P.send('Input.insertText', { text: ch }); await wait(18); }
  await p.js(`document.querySelectorAll('label.agree input[type=checkbox]').forEach((x) => { if (!x.checked) x.click(); });`); await wait(200);
  await p.tap('button.btn', '^Sign$', { after: 700 });
  await p.scrollTo('.sig, .card.ok', null, 'center');
}
/* the office: the lead a rep quoted in the field (Sam Ortiz, on his own phone, before the recording), opened in the office Pipeline */
async function officeTakesOver(c) {
  const rep = c.state.repQuoted || await repQuote(c, 'Sam Ortiz', OFFICE_LEAD, true); c.state.repQuoted = rep;
  const d = await c.screen('one', 'desk'); await openLead(d, OFFICE_LEAD);
  if (!(await d.has('button', '^They said yes'))) { if (await d.has('button', '^(Change the|Build a) quote')) await d.tap('button', '^(Change the|Build a) quote', { after: 4500 }); }
  if (!(await d.has('button', '^They said yes'))) throw new Error('the office does not see the rep’s quote with They said yes');
  await d.scrollTo('button', '^They said yes', 'center');
  return { desk: d, phone: rep };
}

/* the job done: the Jobs board, the job opened, Done picked with the time (the save is the recording's) */
async function jobDoneScene(c) {
  const d = await c.screen('one', 'desk'); await d.nav('Jobs'); await wait(3000);
  /* booked for the next open day, which can be in the week after */
  if (!(await d.has('#view td', '^' + esc(WHO) + '$')) && (await d.has('button', '^Week after'))) await d.tap('button', '^Week after', { after: 3000 });
  if (!(await d.has('#view *', '^' + esc(WHO)))) throw new Error('no job for ' + WHO + ' on the Jobs board');
  await d.tap('#view td', '^' + esc(WHO) + '$', { after: 2500 });
  await d.tap('button', '^Open the job', { after: 3000 });
  /* marked done by an earlier run: undone first, so the recording shows the Done going in (the browser's confirm is accepted) */
  if (await d.has('#view button', '^Undo this$')) await d.tap('#view button', '^Undo this$', { after: 2500 });
  await d.tap('#view button', '^Done$', { after: 1200 });
  await d.js("const ss = [...document.querySelectorAll('.jdone select')].filter((x) => x.offsetParent); if (ss[0]) { ss[0].value = '1'; ss[0].dispatchEvent(new Event('change', { bubbles: true })); } if (ss[1]) { ss[1].value = '30'; ss[1].dispatchEvent(new Event('change', { bubbles: true })); }");
  return { desk: d };
}
/* Setup, Customer emails: the aftercare email after a job, switched on (the copy has no mailbox, so nothing is sent) */
async function careScene(d) {
  await deskTool(d, 'Setup');
  await d.tap('#view button, #view a', '(Customer emails|Emails to customers)', { after: 2500 });
  if (!(await d.until("document.querySelector('.careac')", 20000))) throw new Error('no aftercare section on Customer emails');
  await d.js("const b = [...document.querySelectorAll('.careac .aseg button')].find((x) => x.textContent.trim() === 'On'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click();"); await wait(1500);
  await d.js("const c = document.querySelector('.careac'); if (c) { c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }");
}
/* territories: one drawn around the demo neighbourhood and given to a rep, with the knocks showing */
async function territoryScene({ screen, DEMO }) {
  const d = await screen('one', 'desk'); await openHouse(d, DEMO.one.house.address); await settleMap(d);
  /* already drawn (a run that went on from an earlier one): nothing to draw again */
  if (await d.has('*', '^North loop')) return { desk: d };
  /* the Hail layer's storm-day list folded away first: open, it covers the map where the corners are clicked */
  if (await d.has('*', '^Storm days in ')) await d.tap('button', '^Hail layer$', { after: 1500 });
  /* drawing mode on: the map says to click the corners (tapped again if the first tap was lost while the map settled) */
  for (let k = 0; k < 3 && !(await d.has('.dknote, div', '^Click the map to add the corners')); k++) { if (await d.has('button', '^Draw a territory$')) await d.tap('button', '^Draw a territory$', { after: 1500 }); else await wait(1000); }
  if (!(await d.has('.dknote, div', '^Click the map to add the corners'))) throw new Error('drawing a territory did not start');
  /* the biggest map on the page (the card's lot photo is a small map too) */
  const box = await d.js(`const m = [...document.querySelectorAll('.leaflet-container')].map((x) => x.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return [m.left, m.top, m.width, m.height];`);
  /* corners clear of the map's own buttons (Map/Photo, Hail layer, Draw, Radar down the right; the legend bottom left) */
  const [x, y, w, h] = box; const pts = [[x + w * 0.12, y + h * 0.3], [x + w * 0.6, y + h * 0.28], [x + w * 0.62, y + h * 0.8], [x + w * 0.14, y + h * 0.82], [x + w * 0.12, y + h * 0.3]];
  for (const [px, py] of pts) { for (const type of ['mousePressed', 'mouseReleased']) await d.P.send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', clickCount: 1 }); await wait(400); }
  await d.until("[...document.querySelectorAll('select option')].some((o) => o.value === 'Alex Rivera')", 30000);
  await d.js("const i = [...document.querySelectorAll('input')].find((x) => x.offsetParent && /North loop/.test(x.placeholder || '')); if (i) { i.focus(); i.value = 'North loop'; i.dispatchEvent(new Event('input', { bubbles: true })); } const s = [...document.querySelectorAll('select')].find((x) => x.offsetParent && [...x.options].some((o) => o.value === 'Alex Rivera')); if (s) { s.value = 'Alex Rivera'; s.dispatchEvent(new Event('change', { bubbles: true })); }");
  await wait(600); if (await d.has('button', '^Save$')) await d.tap('button', '^Save$', { after: 3000 });
  if (!(await d.until(`/North loop/.test(document.body.innerText)`, 15000))) throw new Error('the territory was not saved');
  if (await d.has('*', '^Storm days in ')) await d.tap('button', '^Hail layer$', { after: 1500 });
  await wait(1500);
  return { desk: d };
}

export const NOTES = "## The one local demo copy\n\n- Made by `traverse/videos/tools/demo-universal-copy.sh` from today's built code (`traverse/editions/dist`): the Roofing edition's page and API with one town, Highlands Ranch, and the Lawn & Landscape and Solar editions' per-door layers for the same town added to its data folder (lawn outlines, sun and solar, the funding and water sheets). company.json is the live Roofing one (read once, read-only) with the Solar layer and the lawn, trees and water card parts switched on and a mixed service list; on top, the made-up company: Example Co, (303) 555-0100, office@example.com. One company and one look on every screen.\n- `bash demo-universal-copy.sh reset` remakes it, starts PHP on 127.0.0.1:8811, adds the made-up people (admin Jordan Blake, reps Alex Rivera and Sam Ortiz, technician Riley Chen; local test codes only), the made-up leads, a few made-up knocks by the two reps, and picks the demo house (the one whose card shows the most of the script's facts).\n- Dry run: `node record-demo-universal.mjs --dry` after a reset (it signs, books and assigns on the copy). Recording: `node voice-demo-universal.mjs`, a reset, `node record-demo-universal.mjs --record`, then `node build-demo-universal.mjs`.\n\n## What the copy does differently from a customer's install, and why\n\n- **Walking order.** One install has one \"best first\" order. The video uses the roofing order, except the YouTube-only line \"Properties that already have solar move down the list\", recorded with the order set to solar for that one scene (company.json \"best\").\n- **Deposit.** Taken at the door by card and recorded (\"I took the deposit\"); paying on the homeowner's own phone needs the company's Square or Stripe, which a demo copy does not have.\n- **Send it back to the office.** The editions have no separate \"send to office\" button (Sixfold 365's Quick quote has one). Shown: a rep's quote, saved on his phone on his own lead, opened by the office in the Pipeline, where the office takes the deposit and sends the form (\"They said yes: deposit and form\"). The Agreements and deposits switch in Accounts decides whether reps or only the office do this.\n";

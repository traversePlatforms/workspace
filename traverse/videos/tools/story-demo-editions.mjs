// The demo-editions story (script: ../demo-editions/script.md, 2 Nov 2026): one entry per beat, in script order. Each app scene says what it
// shows and drives the real app on the LOCAL demo copies; record-demo.mjs captures and frames it. layout: card | desk | deskphone | phone.
// `problems` are the known gaps, written into the dry run's README. Nothing here fakes a screen: a beat the demo copies cannot show
// honestly throws, and the README says what is missing.

/* ---- helpers on a screen (see makeScreen in record-demo.mjs) ---- */
import { readFileSync } from 'node:fs'; import { DEMO_DIR } from './demo-config.mjs';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function home(s) {
  if (s.dev === 'desk') { await s.nav('Home'); return; }
  if (await s.has('#dock button, .dock button', '^Home$')) { await s.tap('#dock button, .dock button', '^Home$', { after: 2000 }); return; }
  for (let i = 0; i < 4 && !(await s.has('button.cty, button.tile')); i++) { if (await s.has('header button.back')) await s.tap('header button.back', null, { after: 1200 }); else break; }
}
/* a house by its address, through the app's own search (typed in this local browser; the screen shows it masked) */
async function openHouse(s, addr) {
  await home(s); await s.sleep?.(500);
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
  await clearSearch(s); await new Promise((r) => setTimeout(r, 2500));
}
/* the phone card scrolled so one of its blocks sits under the app bar */
async function toBlock(s, re) {
  const ok = await s.js('const re = new RegExp(' + JSON.stringify(re) + '); const e = [...document.querySelectorAll("#view .door.open *")].find((x) => x.children.length <= 3 && re.test(x.textContent.trim())); if (!e) return 0; e.scrollIntoView({ block: "start" }); window.scrollBy(0, -90); return 1;');
  if (!ok) throw new Error('the card has no ' + re.replace(/[^$]/g, '') + ' block');
  await wait(900);
}
/* the computer's house card: its photo and lot line loaded (no "Loading" left on it) */
async function settleCard(s) { await s.until(`(() => { const c = document.querySelector('.dkcard'); return c && !/Loading/i.test(c.innerText) && [...c.querySelectorAll('img')].every((i) => i.complete); })()`, 30000); await wait(1500); }
const clearSearch = (s) => s.js(`document.querySelectorAll('input[type=search]').forEach((i) => { i.value = ''; })`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function settleMap(s, ms = 30000) { await s.until(`document.querySelectorAll('.leaflet-tile-loaded').length > 4 || document.querySelector('.leaflet-container canvas')`, ms); await wait(2500); }
async function deskTool(s, label) { await s.nav('Home'); await s.tap('#view button, #view a', '^' + label + '$', { after: 3000 }); }

export const NOTES = "## Beats the demo copies cannot show honestly, and the nearest real screen\n\n| Beat | What is missing | Shown instead / suggestion |\n|---|---|---|\n| Facebook lead **arriving** (3:15) | The demo copies are not connected to a Facebook Page; a lead only arrives through Meta. | The real Facebook leads screen (Setup). Either keep that, or connect a Page on a demo install and record a real test lead from Matthew's own ad. |\n| Pop-up \"Aftercare email has gone out\" (2:12) | That pop-up is Sixfold 365's (1 Nov). On an edition, aftercare goes from the hourly job a set number of hours after Done, and only once a mailbox is connected under Setup, Email. The demo copies have no mailbox. | The Done on the Jobs board, then Setup, Customer emails. |\n| \"Pays the deposit right there\" (2:07) | Paying on the homeowner's phone needs the company's own Square or Stripe connected. The demo copies have neither, and we don't put a live payment account on a demo. | The deposit is taken at the door by card and recorded (\"I took the deposit\"), then the homeowner signs. Suggested voice: \"...and the homeowner signs on their phone, with the deposit taken right there.\" |\n| \"The two-day follow-up with your review link, and your monthly plan offer\" (2:12) | On the editions the follow-up is for quotes that go quiet (not after the job); the review link rides on the aftercare email; the monthly email is the newsletter, which needs a postal address and a mailbox. All are off until the company turns them on. | Suggested voice: \"After the job, Traverse can send your aftercare tips with your review link, follow up on quotes that go quiet, and send your monthly newsletter, once you switch them on.\" |\n\n## For Matthew to decide\n\n1. **Real map and photos.** The map tiles (street names, house numbers) and the aerial photos are the real ones; only the app's own text is masked. Keep, or switch the map scenes to the plain map and crop tighter?\n2. **Prices on screen.** The Lawn and Solar quote scenes show the made-up company's starter prices in dollars (with the app's own \"Starter prices: placeholders\" note). That is the customer's pricing, not Traverse's, but say if you would rather blur the amounts.\n3. **Company names.** The demo companies are \"Example Roofing Co\", \"Example Lawn & Land Co\" and \"Example Solar Co\". Keep, or pick friendlier made-up names?\n4. **Map look.** The local copies draw the plain OpenStreetMap street map; the live installs use their own map file, so the street map looks slightly different from what customers see. The photo view is the same.\n5. **An app issue found on the way (not the video's):** the Lawn edition's water screen (Water, This town) ends with a footer that names its sources and a Sixfold file path (\"Sources and the fact-check log: sixfold/research/water-restrictions-2026.md\"). It is hidden in these pictures; customers on the live Lawn edition see it.\n6. **Live things move.** Live radar shows the weather at the moment of recording, and greetings (\"Good morning\") follow the clock.\n\n## The local demo copies\n\n- Made by `traverse/videos/tools/demo-copies.sh` from today's built code (`traverse/editions/dist`), one town each: Roofing = Parker (port 8801), Lawn & Landscape = Castle Rock (8802), Solar = Highlands Ranch (8803). Each uses the live company.json (copied down read-only) with a made-up company name on top.\n- `bash demo-copies.sh reset` remakes all three, starts them, adds the people (admin Jordan Blake, reps Alex Rivera and Sam Ortiz, technician Riley Chen; local test codes only) and the demo leads, and picks the demo houses. `stop` / `start` as named.\n- Dry run: `node record-demo.mjs --dry` (after a reset; it signs and books on the copies, so a second run needs a reset first).\n";
const RO = 'Traverse Roofing', LA = 'Traverse Lawn & Landscape', SO = 'Traverse Solar', OF = 'Traverse · The office';
export const SCENES = [
  { n: 1, t: '0:00', layout: 'card', eyebrow: 'Traverse', title: 'The sales platform for the field and the office.', shows: 'Opening card' },
  { n: 2, t: '0:03', layout: 'desk', section: RO, shows: 'A town’s doors coloured best to worst on the map, one house card open',
    cap: 'Traverse tells you which doors need you right now.',
    vo: 'Every day your reps knock on doors. Some of those houses need you right now. Most don’t. Traverse tells you which is which before anyone leaves the truck.',
    problems: ['The map and photo are real: street labels and house numbers drawn on the map tiles, and the aerial photo, cannot be masked (the text lists are). Matthew to decide: keep, or use the plain Map view and crop.'],
    run: async ({ screen }) => {
      const d = await screen('roofing', 'desk');
      await d.nav('Home'); await d.tap('button', '^Open the workspace', { after: 4000 }); await settleMap(d);
      await d.tap('.dkrow', null, { after: 3500 }); await settleCard(d); await settleMap(d, 8000);
      return { desk: d };
    } },
  { n: 3, t: '0:15', layout: 'deskphone', section: 'Traverse', shows: 'Best doors first (the Plan list on the computer) and a house card on the phone',
    cap: 'The facts for your trade on every house, and the best doors first.',
    vo: 'Traverse puts the facts that matter to your trade on every house in your area, and ranks the doors worth knocking first.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('roofing', 'desk'); await d.nav('Plan'); await d.until(`document.querySelectorAll('tbody tr').length > 10`, 60000); await wait(1500);
      const p = await screen('roofing', 'phone'); await openHouse(p, DEMO.roofing.house.address);
      return { desk: d, phone: p };
    } },
  { n: 4, t: '0:22', layout: 'deskphone', section: 'Traverse', run_after: 25, shows: 'The office pipeline on the computer; a signed agreement on the homeowner’s phone',
    cap: 'Then the quote, the signature, the deposit, the job and the follow-up.',
    vo: 'Then it runs everything after the knock: the quote, the signature, the deposit, the job and the follow-up. One app, on the phone in the field and the computer in the office. Here it is for three trades.',
    run: async ({ screen, DEMO, signed }) => {
      const d = await screen('yards', 'desk'); await pipeStage(d, 'Quote sent');
      if (!signed.yards) throw new Error('no signed agreement yet (scene 17 did not sign)');
      const p = await screen('yards', 'phone', 'homeowner'); await p.go(signed.yards); await wait(3500);
      return { desk: d, phone: p };
    } },
  { n: 5, t: '0:32', layout: 'card', eyebrow: 'Three trades', title: 'Roofing · Lawn & Landscape · Solar', shows: 'Card: the three editions' },

  /* ---- Roofing ---- */
  { n: 6, t: '0:35', layout: 'card', eyebrow: 'Traverse Roofing', title: 'Roofing', sub: 'It starts with the storm.', shows: 'Section card: Roofing', vo: 'For roofers, it starts with the storm.' },
  { n: 7, t: '0:37', layout: 'desk', section: RO, shows: 'Storms: every storm day, with hail size and the towns it reached',
    cap: 'Every storm day, with the hail size.',
    vo: 'Open Storms and every storm day is there, with the hail size and the path drawn over your map.',
    run: async ({ screen }) => {
      const d = await screen('roofing', 'desk'); await d.nav('Storms'); await d.tap('button', '^Every storm day$', { after: 2000 });
      return { desk: d };
    } },
  { n: 8, t: '0:45', layout: 'deskphone', section: RO, shows: 'One storm day: the houses it reached, biggest hail first (computer); the hail path over the map (phone)',
    cap: 'Tap a day: the houses it reached, biggest hail first.',
    vo: 'Tap a day and you get the houses it reached, biggest hail first.',
    run: async ({ screen, DEMO }) => {
      const day = DEMO.roofing.stormDay || '15 Aug 2026';
      const d = await screen('roofing', 'desk'); await d.nav('Storms'); await d.tap('button', '^Every storm day$', { after: 1500 });
      await d.tap('.door, button, [role=button]', '^' + esc(day), { after: 3000 });
      if (await d.has('.stownchips button', '^' + esc(DEMO.roofing.townLabel))) await d.tap('.stownchips button', '^' + esc(DEMO.roofing.townLabel), { after: 5000 });
      await d.until(`document.querySelector('.stormrow')`, 60000); await wait(1000);
      const p = await screen('roofing', 'phone'); await home(p);
      await p.tap('button.cty', '^Storms and data', { after: 1500 }); await p.tap('button', '^Hail', { after: 3000 });
      await p.tap('.hailc', esc(day), { after: 500 }); await p.js(`const c = [...document.querySelectorAll('.hailc')].find((x) => x.textContent.includes(${JSON.stringify(day)})); c.querySelector('button.lnk').click();`);
      /* the path where the demo town is: the map framed on it (the same as pinching in) */
      await p.js('const m = (window.__maps || []).slice(-1)[0]; if (m) m.setView([' + DEMO.roofing.house.lat + ', ' + DEMO.roofing.house.lon + '], 11);');
      await settleMap(p); await wait(3000);
      return { desk: d, phone: p };
    } },
  { n: 9, t: '0:52', layout: 'deskphone', section: RO, shows: 'A house card: hail by date, wind nearby, roof size and pitch, material and age, last re-roof, moved in',
    cap: 'Hail storm by storm, wind, the roof, its age, a new owner.',
    vo: 'Every house shows the hail it took, storm by storm, the damaging wind nearby, the roof’s size and pitch, what it’s made of and how old it is, and whether it’s been re-roofed since. New owners are flagged too, with the month they moved in.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('roofing', 'desk'); await openHouse(d, DEMO.roofing.house.address); await settleMap(d, 10000);
      const p = await screen('roofing', 'phone'); await openHouse(p, DEMO.roofing.house.address);
      await toBlock(p, '^Hail near the house');
      return { desk: d, phone: p };
    } },
  { n: 10, t: '1:12', layout: 'desk', section: RO, shows: 'Plan: a street ticked and assigned to a rep',
    cap: 'Tick a street and assign it to a rep.',
    vo: 'The best doors rise to the top. A manager ticks a street and assigns it to a rep.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('roofing', 'desk'); await d.nav('Plan'); await d.until(`document.querySelectorAll('tbody tr').length > 10`, 60000);
      /* one street from the side panel's By neighbourhood list, every row ticked, the rep picked */
      await d.js("const c = [...document.querySelectorAll('.card')].find((x) => /^By neighbo/.test((x.querySelector('h3') || {}).textContent || '')); const b = c && c.querySelector('button'); if (b) b.click();"); await wait(2500);
      const n = await d.js("let k = 0; for (const c of document.querySelectorAll('tbody tr input[type=checkbox]')) { if (k >= 12) break; if (!c.checked) c.click(); k++; } return k;");
      if (!n) throw new Error('no rows to tick');
      await d.until("[...document.querySelectorAll('.planbar select option')].some((o) => o.value === 'Alex Rivera')", 15000);
      await d.js("const s = document.querySelector('.planbar select'); s.value = 'Alex Rivera'; s.dispatchEvent(new Event('change', { bubbles: true }));"); await wait(800);
      return { desk: d };
    } },
  { n: 11, t: '1:20', layout: 'deskphone', section: RO, shows: 'Assigned: the street on the rep’s phone before they leave the lot',
    cap: 'It’s on their phone before they leave the lot.',
    vo: 'It’s on their phone before they leave the lot.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('roofing', 'desk');
      if (!(await d.has('.planbar button.save', '^Assign$'))) throw new Error('nothing ticked to assign (scene 10 first)');
      await d.tap('.planbar button.save', '^Assign$', { after: 3000 });
      /* the ones just given out, with who has them */
      if (await d.has('button', '^Assigned$')) await d.tap('button', '^Assigned$', { after: 2500 });
      await d.js("const t = document.querySelector('table'); let p = t && t.parentElement; while (p && p.scrollWidth <= p.clientWidth) p = p.parentElement; if (p) p.scrollLeft = 99999;"); await wait(800);
      /* Alex's phone: one of the houses just given to him, tagged Assigned to you (the ids from the copy's own log) */
      const log = readFileSync(DEMO_DIR + '/roofing/traverse-data/rounds/dassign-' + DEMO.roofing.town + '.log', 'utf8').trim().split(/\r?\n/).pop();
      const id = JSON.parse(log).id; if (!id) throw new Error('no assigned door in the log');
      const p = await screen('roofing', 'phone', 'Alex Rivera'); await openHouse(p, id.replace(/-/g, ' ').toUpperCase());
      await p.scrollTo('#view .door.open .reptag, #view .reptag', null, 'center');
      return { desk: d, phone: p };
    } },
  { n: 12, t: '1:27', layout: 'desk', section: RO, shows: 'Live radar over the map',
    cap: 'Live radar and storm alerts for your towns.',
    vo: 'Live radar and storm alerts let you know the moment severe weather hits your towns.',
    run: async ({ screen }) => {
      const d = await screen('roofing', 'desk'); await deskTool(d, 'Live radar'); await settleMap(d); await wait(3000);
      return { desk: d };
    } },

  /* ---- Lawn & Landscape ---- */
  { n: 13, t: '1:35', layout: 'card', eyebrow: 'Traverse Lawn & Landscape', title: 'Lawn & Landscape', sub: 'The lawn, before you pull up.', shows: 'Section card: Lawn & Landscape', vo: 'For lawn and landscape companies, the card shows the lawn before you pull up.' },
  { n: 14, t: '1:37', layout: 'deskphone', section: LA, shows: 'A house card: lawn size, the property line on the photo with the lawn shaded, how much is near the house, trees close to the house',
    cap: 'The lawn’s size, the property line, the trees by the house.',
    vo: 'Its size in square feet, the property line on the photo with the lawn shaded in, how much of it sits near the house, and the trees close to the house.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('yards', 'desk'); await openHouse(d, DEMO.yards.house.address); await settleMap(d, 10000);
      const p = await screen('yards', 'phone'); await openHouse(p, DEMO.yards.house.address);
      /* the phone: the lawn chip, then See the lawn on the photo: the counted lawn shaded green inside the property line */
      const chip = await p.js(`const e = [...document.querySelectorAll('#view .door.open .lawn')].find((x) => /sq ft/.test(x.textContent)); if (!e) return 0; e.scrollIntoView({ block: 'center' }); e.click(); return 1;`);
      if (!chip) throw new Error('no lawn chip on the Lawn card');
      await p.tap('button', '^See the lawn on the photo', { after: 3000 });
      if (!(await p.until(`/Lawn we counted/.test(document.body.innerText)`, 30000))) throw new Error('the lawn outline did not draw');
      await settleMap(p, 20000); await wait(3000);
      return { desk: d, phone: p };
    } },
  { n: 15, t: '1:52', layout: 'phone', section: LA, shows: 'The town’s watering days on the card',
    cap: 'It even knows the town’s watering days.',
    vo: 'It even knows the town’s watering days.',
    run: async ({ screen, DEMO }) => {
      const p = await screen('yards', 'phone'); await openHouse(p, DEMO.yards.house.address);
      /* the card's facts fold (funding, lawn plan, water), opened, then the water line: the town's watering rules */
      await p.until(`document.querySelector('#view .door.open .waterl')`, 20000);
      const ok = await p.js(`const t = [...document.querySelectorAll('#view .door.open .factsx .ftog')][0]; if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); const w = document.querySelector('#view .door.open .waterl'); if (!w) return 0; w.click(); return 1;`);
      if (!ok) throw new Error('no watering line on the Lawn card (the water sheet did not load)');
      if (!(await p.until(`document.getElementById('moneyv')`, 15000))) throw new Error('the water screen did not open');
      await wait(1500);
      return { phone: p };
    } },
  { n: 16, t: '1:56', layout: 'desk', section: LA, shows: 'The quote builder filled in from the lawn’s own size, at the company’s own prices',
    cap: 'Quote from the lawn’s own size, at your own prices.',
    vo: 'Quote from the lawn’s own size, at your own prices.',
    problems: ['Shows the made-up company’s starter prices in dollars (the customer’s pricing, not Traverse’s). Blur if wanted.'],
    run: async (c) => { const d = await quoteFor(c, 'yards'); return { desk: d }; } },
  { n: 17, t: '2:03', layout: 'phone', section: LA, shows: 'The agreement on the homeowner’s phone, signed',
    cap: 'The homeowner signs on their phone.',
    vo: 'The homeowner signs on their phone.',
    run: async (c) => { const p = await signOnPhone(c, 'yards'); return { phone: p }; } },
  { n: 18, t: '2:07', layout: 'deskphone', section: LA, shows: 'The deposit: what the homeowner’s page says, and the job booked on the office side',
    cap: 'Take the deposit right there. The job is booked.',
    problems: ['The deposit is recorded as taken at the door by card (paying on the homeowner’s own phone needs the company’s Square or Stripe connected).'],
    vo: 'And you take the deposit right there.',
    run: async (c) => depositScene(c, 'yards') },
  { n: 19, t: '2:12', layout: 'desk', section: LA, shows: 'The job marked Done on the Jobs board',
    cap: 'Mark the job done.',
    vo: 'Mark the job done.',
    run: async (c) => jobDoneScene(c, 'yards') },
  { n: 20, t: '2:20', layout: 'desk', section: LA, shows: 'Setup, Customer emails: the aftercare email after a job, switched on',
    cap: 'Aftercare tips and your review link go out on their own.',
    vo: 'After the job, the aftercare tips and your review link go out on their own.',
    problems: ['The demo copies have no mailbox connected, so nothing is really sent; the screen shows the aftercare email set up.'],
    run: async (c) => careScene(c, 'yards') },

  /* ---- Solar ---- */
  { n: 21, t: '2:30', layout: 'card', eyebrow: 'Traverse Solar', title: 'Solar', sub: 'Every roof, sized for sun.', shows: 'Section card: Solar' },
  { n: 22, t: '2:32', layout: 'deskphone', section: SO, shows: 'A house card: the system that fits, panels, a year’s output, shade from tall trees',
    cap: 'The system that fits, and a year’s output for that spot.',
    vo: 'For solar teams, every roof shows its sun-facing area, the shade from tall trees, the system that fits it, and a year’s output for that exact spot.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('solar', 'desk'); await openHouse(d, DEMO.solar.house.address); await settleMap(d, 10000);
      const p = await screen('solar', 'phone'); await openHouse(p, DEMO.solar.house.address);
      await p.scrollTo('#view .door.open *', '^(Solar|Sun)', 'start');
      return { desk: d, phone: p };
    } },
  { n: 23, t: '2:42', layout: 'desk', section: SO, shows: 'Best doors first: houses that already have solar sit lower, and say so',
    cap: 'Houses that already have solar move down.',
    vo: 'Houses that already have solar are moved down, so nobody wastes a knock.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('solar', 'desk'); await openHouse(d, DEMO.solar.house.address);
      /* the list scrolled to its foot, where the houses with solar sink; the first of them opened, so its card says why */
      for (let i = 0; i < 6; i++) { await d.js(`const r = [...document.querySelectorAll('.dkrow')].pop(); if (r) r.scrollIntoView({ block: 'end' });`); await wait(900); }
      /* the rows only say what scores; the card says why a row sank. From the foot up, the first whose card says it has solar */
      let hit = false;
      for (let k = 1; k <= 10 && !hit; k++) {
        await d.js(`const rs = [...document.querySelectorAll('.dkrow')]; const r = rs[rs.length - ${k}]; if (r) { r.scrollIntoView({ block: 'center' }); r.click(); }`); await wait(1800);
        hit = await d.js(`return /has solar/i.test((document.querySelector('.dkcard') || document.body).innerText)`);
      }
      if (!hit) throw new Error('no house with solar already near the foot of this neighbourhood’s list');
      await wait(2000);
      return { desk: d };
    } },
  { n: 24, t: '2:50', layout: 'desk', section: SO, shows: 'The proposal built from the roof facts on the card, at the company’s own (starter) prices',
    cap: 'The proposal starts from the roof,',
    vo: 'The proposal starts from the roof.',
    problems: ['Shows the made-up company’s starter prices in dollars (the customer’s pricing, not Traverse’s). Blur if wanted.'],
    run: async (c) => ({ desk: await quoteFor(c, 'solar') }) },
  { n: 25, t: '2:58', layout: 'phone', section: SO, shows: 'The proposal on the homeowner’s phone, signed',
    cap: 'and the homeowner signs it on the spot.',
    vo: 'And the homeowner signs it on the spot.',
    run: async (c) => ({ phone: await signOnPhone(c, 'solar') }) },

  /* ---- The office ---- */
  { n: 26, t: '3:10', layout: 'card', eyebrow: 'Traverse', title: 'The office', shows: 'Section card: The office', vo: 'Back at the office,' },
  { n: 27, t: '3:12', layout: 'desk', section: OF, shows: 'Every lead in one pipeline',
    cap: 'Every lead in one pipeline.',
    vo: 'every lead is in one pipeline.',
    run: async ({ screen }) => { const d = await screen('yards', 'desk'); await pipeStage(d, 'To call'); return { desk: d }; } },
  { n: 28, t: '3:15', layout: 'desk', section: OF, shows: 'Facebook lead ads: connect the Page, and leads come into the Pipeline on their own',
    cap: 'Connect your Facebook lead ads.',
    vo: 'Connect your Facebook lead ads and new leads land in the pipeline.',
    run: async ({ screen }) => { const d = await screen('yards', 'desk'); await deskTool(d, 'Setup'); await d.tap('button, a', '^Facebook', { after: 3000 }); return { desk: d }; } },
  { n: 29, t: '3:19', layout: 'desk', section: OF, shows: 'Territories drawn on the map',
    cap: 'Draw territories. See who knocked what.',
    vo: 'Draw territories and see who knocked what.',
    run: async ({ screen, DEMO }) => {
      const d = await screen('roofing', 'desk'); await openHouse(d, DEMO.roofing.house.address); await settleMap(d);
      await d.tap('button', '^Draw a territory$', { after: 1500 });
      /* four corners around the neighbourhood, clicked on the map the way a manager draws one */
      const box = await d.js(`const m = document.querySelector('.leaflet-container').getBoundingClientRect(); return [m.left, m.top, m.width, m.height];`);
      const [x, y, w, h] = box; const pts = [[x + w * 0.22, y + h * 0.25], [x + w * 0.78, y + h * 0.22], [x + w * 0.8, y + h * 0.72], [x + w * 0.25, y + h * 0.78], [x + w * 0.22, y + h * 0.25]];
      for (const [px, py] of pts) { for (const type of ['mousePressed', 'mouseReleased']) await d.P.send('Input.dispatchMouseEvent', { type, x: px, y: py, button: 'left', clickCount: 1 }); await wait(400); }
      /* named, given to a rep, saved */
      await d.until("[...document.querySelectorAll('select option')].some((o) => o.value === 'Alex Rivera')", 30000);
      await d.js("const i = [...document.querySelectorAll('input')].find((x) => x.offsetParent && /North loop/.test(x.placeholder || '')); if (i) { i.focus(); i.value = 'North loop'; i.dispatchEvent(new Event('input', { bubbles: true })); } const s = [...document.querySelectorAll('select')].find((x) => x.offsetParent && [...x.options].some((o) => o.value === 'Alex Rivera')); if (s) { s.value = 'Alex Rivera'; s.dispatchEvent(new Event('change', { bubbles: true })); }");
      await wait(600); if (await d.has('button', '^Save$')) await d.tap('button', '^Save$', { after: 3000 });
      /* the Hail layer's list folded away, so the territory shows */
      if (await d.has('*', '^Storm days in ')) await d.tap('button', '^Hail layer$', { after: 1500 });
      await wait(1500);
      return { desk: d };
    } },
  { n: 30, t: '3:24', layout: 'desk', section: OF, shows: 'The end-of-day email: a picture of the day, every night',
    cap: 'A picture of the day by email, every night.',
    vo: 'And get a picture of the day by email, every night.',
    run: async ({ screen }) => {
      const d = await screen('yards', 'desk'); await deskTool(d, 'Stats');
      await d.tap('button', '^(Set up|Change) the end-of-day email', { after: 3500 });
      await d.tap('#view button', '^Preview$', { after: 5000 });
      await d.scrollTo('iframe.fuframe', null, 'center');
      return { desk: d };
    } },
  { n: 31, t: '3:30', layout: 'card', eyebrow: 'Traverse', title: 'The all-in-one sales platform for the field and office.', sub: 'See it with your own area.', foot: 'Book a demo: traverseplatforms.com\n(303) 596-9515',
    shows: 'Closing card', vo: 'Traverse. The all-in-one sales platform for the field and office. See it with your own area at traverseplatforms.com.' },
];

/* ---- the quote, the signature, the deposit, the job: the real flow on the demo copy, through the app's own screens ---- */
const WHO = { yards: 'Taylor Brooks', solar: 'Casey Morgan' };
/* a stage button reads '3To call' or 'To call 2' (the count before or after) */
const stageRe = (st) => '^\\d*\\s*' + esc(st) + '(\\s*\\d+)?$';
/* a Pipeline stage opened, so its cards show */
async function pipeStage(d, st) {
  await d.nav('Pipeline');
  if (!(await d.until("[...document.querySelectorAll('#view button')].some((b) => /To call/.test(b.textContent))", 90000))) throw new Error('the Pipeline did not load');
  await d.tap('#view button', stageRe(st), { after: 2500 });
}
/* the lead's card in the Pipeline (the stage it sits in, then the card) */
async function openLead(d, name) {
  await d.nav('Pipeline');
  /* PHP's own server answers one request at a time: wait for the stages, not a clock */
  if (!(await d.until("[...document.querySelectorAll('#view button')].some((b) => /To call$/.test(b.textContent.trim()))", 90000))) throw new Error('the Pipeline did not load');
  for (const st of ['To call', 'Quote sent', 'Walk booked', 'Survey booked', 'Inspection booked']) {
    if (!(await d.has('#view button', stageRe(st)))) continue;
    await d.tap('#view button', stageRe(st), { after: 1800 });
    if (await d.has('button, .lcard, .lead, div', '^' + esc(name))) { await d.tap('button, .lcard, .lead, div', '^' + esc(name), { after: 2000 }); return; }
  }
  throw new Error('the lead ' + name + ' is not in the Pipeline');
}
/* the quote builder, filled from the house card at the company's own (starter) prices; left on screen for the picture */
async function quoteFor({ screen }, ed) {
  const d = await screen(ed, 'desk'); await openLead(d, WHO[ed]);
  await d.tap('button', '^(Build a|Change the) quote', { after: 4500 });
  if (!(await d.until(`[...document.querySelectorAll('#view b, #view div')].some((x) => /^(Good|Better|Best)$/.test(x.textContent.trim()))`, 20000))) throw new Error('the quote builder did not fill');
  return d;
}
/* "They said yes": the quote saved, the deposit and the one-page form (deposit taken at the door by card, a signature wanted), sent; then
   the homeowner opens the link on their own phone, types their name, ticks the two boxes and signs */
async function signOnPhone(c, ed) {
  const d = await c.screen(ed, 'desk');
  if (!(await d.has('button', '^Save the quote$'))) await quoteFor(c, ed);
  await d.tap('button', '^Save the quote$', { after: 3000 });
  await d.tap('button', '^They said yes', { after: 3500 });
  const today = await d.js(`const t = new Date(); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.getDay()] + ' ' + t.getDate();`);
  if (await d.has('button', '^Riley Chen$')) await d.tap('button', '^Riley Chen$', { after: 800 });
  await d.tap('button.jsd', '^' + esc(today), { after: 800 });
  await d.tap('#view button', '^3:00$', { after: 600 });
  await d.tap('#view button', '^Card', { after: 600 });
  await d.tap('button.jtaken', null, { after: 600 });
  await d.tap('#view button', '^Needs their signature', { after: 600 });
  await d.tap('#view button.save', '^Send the form', { after: 4000 });
  const link = await d.js(`const a = [...document.querySelectorAll('a[href]')].find((x) => x.href.includes('sign.html?s=')); if (a) return a.href; const w = document.body.innerText.split(/\\s+/).find((x) => x.includes('sign.html?s=')); return w || '';`);
  if (!link) throw new Error('no form link after Send the form: ' + (await d.text('#view')).slice(0, 160).replace(/\s+/g, ' '));
  /* the same page, at this copy's own address */
  const url = c.local(c.origin(ed) + link.replace(/^https?:\/\/[^/]+/, ''));
  const p = await c.screen(ed, 'phone', 'homeowner'); await p.go(url);
  if (!(await p.until(`[...document.querySelectorAll('label.name input, input')].some((i) => i.offsetParent)`, 20000))) throw new Error('the form did not open on the phone: ' + (await p.text()).slice(0, 160));
  await p.js(`const i = document.querySelector('label.name input') || [...document.querySelectorAll('input')].find((x) => x.type === 'text'); i.focus();`);
  await p.P.send('Input.insertText', { text: WHO[ed] }); await wait(400);
  await p.js(`document.querySelectorAll('label.agree input[type=checkbox]').forEach((x) => { if (!x.checked) x.click(); });`); await wait(500);
  await p.tap('button.btn', '^Sign$', { after: 3500 });
  if (!(await p.until(`document.querySelector('.sig') || /Signed electronically/.test(document.body.innerText)`, 15000))) throw new Error('not signed: ' + (await p.text()).slice(0, 200).replace(/\s+/g, ' '));
  await p.scrollTo('.sig, .card.ok', null, 'center');
  c.signed[ed] = url;
  return p;
}
/* the deposit: what the homeowner's page says about it, and the job it booked on the office side */
async function depositScene(c, ed) {
  if (!c.signed[ed]) throw new Error('nothing signed yet (scene 17)');
  const p = await c.screen(ed, 'phone', 'homeowner'); await p.go(c.signed[ed]); await wait(3000);
  await p.scrollTo('#main *', '(deposit|received|\$\d)', 'center');
  const d = await c.screen(ed, 'desk'); await d.nav('Jobs'); await wait(3500);
  return { desk: d, phone: p };
}
/* the job done: the Jobs board, the job opened, Done saved; the toast it shows */
async function jobDoneScene(c, ed) {
  const d = await c.screen(ed, 'desk'); await d.nav('Jobs'); await wait(3000);
  if (!(await d.has('#view *', '^' + esc(WHO[ed])))) throw new Error('no job for ' + WHO[ed] + ' on the Jobs board');
  await d.tap('#view td', '^' + esc(WHO[ed]) + '$', { after: 2500 });
  await d.tap('button', '^Open the job', { after: 3000 });
  await d.tap('#view button', '^Done$', { after: 1200 });
  /* how long it took (an estimate), then saved */
  await d.js("const ss = [...document.querySelectorAll('.jdone select')].filter((x) => x.offsetParent); if (ss[0]) { ss[0].value = '1'; ss[0].dispatchEvent(new Event('change', { bubbles: true })); } if (ss[1]) { ss[1].value = '30'; ss[1].dispatchEvent(new Event('change', { bubbles: true })); }");
  await d.tap('.jdone button.save', null, { after: 1200 });
  return { desk: d };
}
/* Setup, Customer emails: the aftercare and the follow-up, with the preview of the email */
async function careScene(c, ed) {
  const d = await c.screen(ed, 'desk'); await deskTool(d, 'Setup');
  await d.tap('#view button, #view a', '(Customer emails|Emails to customers)', { after: 3000 });
  if (!(await d.until("document.querySelector('.careac')", 20000))) throw new Error('no aftercare section on Customer emails');
  /* switched on, the way the company would (the demo copy has no mailbox, so nothing is sent) */
  await d.js("const b = [...document.querySelectorAll('.careac .aseg button')].find((x) => x.textContent.trim() === 'On'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click();"); await wait(2500);
  await d.js("const c = document.querySelector('.careac'); if (c) { c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }"); await wait(800);
  return { desk: d };
}

/* ---- what moves while a scene is recorded (record-demo.mjs --record): a slow scroll, the radar playing; never a new action ---- */
/* a smooth scroll of the page (or one scroll box), spread over ms */
async function glide(s, px, ms, sel) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) { await s.js(`(${sel ? `document.querySelector(${JSON.stringify(sel)})` : 'null'} || window).scrollBy(0, ${px / steps})`); await wait(40); }
}
const SHOW = {
  3: async ({ phone }, secs) => { await wait(1500); await glide(phone, 420, secs * 1000 * 0.6); },
  7: async ({ desk }, secs) => { await wait(2000); await glide(desk, 650, secs * 1000 * 0.6); },
  9: async ({ phone }, secs) => { await wait(2500); await glide(phone, 900, secs * 1000 * 0.7); },
  12: async ({ desk }) => { await wait(800); if (await desk.has('button', '^Play last 2 hours')) await desk.tap('button', '^Play last 2 hours', { after: 0 }); },
  22: async ({ phone }, secs) => { await wait(2000); await glide(phone, 600, secs * 1000 * 0.6); },
};
for (const sc of SCENES) if (SHOW[sc.n]) sc.show = SHOW[sc.n];

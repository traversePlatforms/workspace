/* Surge holiday toy drive 2026: Facebook images, 1080 x 1350 (DRAFTS ONLY: nothing posted or scheduled).
   Same look as ../november-2026 (dark ground, Surge green, Anton + Archivo from ../visual-set-2026-09-14).
   Every fact the images need comes from data.json. Anything not filled in yet renders as an amber [BRACKET],
   so an unfinished image can't pass for a finished one.
     node build-toy-drive.mjs            all posts + contact sheet
     node build-toy-drive.mjs --only 3   one post                                                              */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'posts'), TMP = join(HERE, '.render');
for (const d of [OUT, TMP]) mkdirSync(d, { recursive: true });
const KIT = pathToFileURL(resolve(HERE, '../visual-set-2026-09-14')).href;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const D = JSON.parse(readFileSync(join(HERE, 'data.json'), 'utf8'));
const GOAL = D.goal, END = Date.UTC(2026, 11, 23);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const gap = (s) => `<var class="gap">[${esc(s)}]</var>`;            // a fact still to come
const n = (x) => x.toLocaleString('en-US');
const daysLeft = (iso) => Math.round((END - Date.parse(iso + 'T00:00:00Z')) / 864e5);
const PARTNER = 'With the Veterans Association of America';            // named on Matthew's call 6 Nov, held for VAA's written OK

/* The 14 posts, Mondays and Wednesdays, clear of the Tue/Thu November set. */
const POSTS = [
  { n: 1, iso: '2026-11-09', time: '3:00 pm', slug: 'announce', kind: 'goal' },
  { n: 2, iso: '2026-11-11', time: '3:00 pm', slug: 'where-to-drop-off', kind: 'events', head: 'Where to find the boxes' },
  { n: 3, iso: '2026-11-16', time: '3:00 pm', slug: 'week-1', kind: 'tally', week: 'Week one' },
  { n: 4, iso: '2026-11-18', time: '3:00 pm', slug: 'at-the-boxes', kind: 'photo' },
  { n: 5, iso: '2026-11-23', time: '3:00 pm', slug: 'week-2', kind: 'tally', week: 'Week two' },
  { n: 6, iso: '2026-11-25', time: '3:00 pm', slug: 'thanksgiving-table', kind: 'challenge' },
  { n: 7, iso: '2026-11-30', time: '3:00 pm', slug: 'week-3', kind: 'tally', week: 'Week three' },
  { n: 8, iso: '2026-12-07', time: '3:00 pm', slug: 'week-4', kind: 'tally', week: 'Week four' },
  { n: 9, iso: '2026-12-09', time: '3:00 pm', slug: 'two-weeks-left', kind: 'countdown', head: 'Two weeks left' },
  { n: 10, iso: '2026-12-14', time: '3:00 pm', slug: 'week-5', kind: 'tally', week: 'Week five' },
  { n: 11, iso: '2026-12-16', time: '3:00 pm', slug: 'final-week', kind: 'events', head: 'Final week' },
  { n: 12, iso: '2026-12-21', time: '3:00 pm', slug: 'week-6', kind: 'tally', week: 'Week six' },
  { n: 13, iso: '2026-12-23', time: '9:00 am', slug: 'last-day', kind: 'countdown', head: 'Last day' },
  { n: 14, iso: '2026-12-28', time: '3:00 pm', slug: 'thank-you', kind: 'thanks' },
];
const dayLabel = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fileName = (p) => `toy-drive-${String(p.n).padStart(2, '0')}-${p.slug}.png`;

/* Latest count on or before a date: the weekly tally posts each carry their own. */
function countFor(p) {
  const key = p.kind === 'thanks' ? 'final' : p.iso;
  if (key in D.counts) return D.counts[key];
  const before = Object.keys(D.counts).filter((k) => k !== 'final' && k <= p.iso).sort().pop();
  return before ? D.counts[before] : null;
}

function meter(count) {
  const pct = count == null ? 0 : Math.min(100, (count / GOAL) * 100);
  return `<div class="meter"><div class="fill" style="width:${pct}%"></div></div>
    <div class="scale"><span>0</span><span>${n(GOAL)}</span></div>`;
}

function eventRows() {
  if (!D.events.length) return [1, 2, 3].map((i) => `<li><b>${gap('date ' + i)}</b><span>${gap('place, town')}</span><i>12&ndash;6 pm</i></li>`).join('');
  return D.events.map((e) => `<li><b>${esc(e.date)}</b><span>${esc(e.place)}</span><i>12&ndash;6 pm</i></li>`).join('');
}

function body(p) {
  const c = countFor(p), left = daysLeft(p.iso);
  const countHtml = c == null ? gap('count') : n(c);
  const remaining = c == null ? gap('to go') : n(Math.max(0, GOAL - c));
  switch (p.kind) {
    case 'goal': return {
      tag: 'Holiday toy drive',
      main: `<div class="huge">${n(GOAL)}</div><h1>toys by <em>December 23.</em></h1>
        <p class="partner">${esc(PARTNER)}</p>${meter(0)}
        <ul class="ask"><li>New, unwrapped toys</li><li>New clothing for kids</li><li>Holiday items and family essentials</li></ul>`,
      foot: ['Drop-off boxes at our events', '12&ndash;6 pm'] };
    case 'events': return {
      tag: p.n === 11 ? `${left} days left` : 'Holiday toy drive',
      main: `<h1 class="top">${esc(p.head)}</h1><p class="lede">${p.n === 11 ? 'The last chances to drop a toy in a box before December 23.' : 'Every event runs 12 to 6 pm. Bring a new, unwrapped toy.'}</p>
        <ul class="events">${eventRows()}</ul>`,
      foot: ['Goal', `${n(GOAL)} by Dec 23`] };
    case 'tally': return {
      tag: p.week,
      main: `<div class="huge">${countHtml}</div><h1>of ${n(GOAL)} <em>toys so far.</em></h1>${meter(c)}
        <div class="stats"><div><b>${remaining}</b><span>to go</span></div><div><b>${left}</b><span>days left</span></div></div>`,
      foot: ['Holiday toy drive', 'Ends Dec 23'] };
    case 'countdown': return {
      tag: 'Holiday toy drive',
      main: `<div class="huge">${left === 0 ? 'Today' : left}</div><h1>${left === 0 ? 'is the <em>last day.</em>' : `days <em>left.</em>`}</h1>${meter(c)}
        <div class="stats"><div><b>${countHtml}</b><span>collected</span></div><div><b>${remaining}</b><span>to go</span></div></div>`,
      foot: [left === 0 ? 'Last boxes' : 'Drop-off boxes at our events', '12&ndash;6 pm'] };
    case 'challenge': return {
      tag: 'Thanksgiving week',
      main: `<h1 class="top big">One toy for every seat at <em>your table.</em></h1>
        <p class="lede">Count the chairs at Thanksgiving. Bring that many new, unwrapped toys to one of our toy drive boxes before December 23.</p>${meter(c)}
        <div class="stats"><div><b>${countHtml}</b><span>collected</span></div><div><b>${left}</b><span>days left</span></div></div>`,
      foot: ['Holiday toy drive', `${n(GOAL)} by Dec 23`] };
    case 'photo': return {
      tag: 'Holiday toy drive',
      main: `<div class="photo-slot"><p>${gap('PHOTO from the first events: the team at the boxes')}</p>
        <small>Real photo only. No children. No client shirts, banners or signage. Everyone shown OK with it.</small></div>
        <h1 class="under">The boxes are <em>filling up.</em></h1>`,
      foot: ['So far', c == null ? gap('count') : `${n(c)} of ${n(GOAL)}`] };
    case 'thanks': return {
      tag: 'Holiday toy drive',
      main: `<h1 class="top big">Thank <em>you.</em></h1><div class="huge">${c == null ? gap('final count') : n(c)}</div>
        <p class="lede">toys collected for ${D.recipients_confirmed.length ? esc(D.recipients_confirmed.join(', ')) : gap('confirmed recipients')}.</p>
        <p class="partner">${esc(PARTNER)}</p>`,
      foot: ['Holiday toy drive 2026', 'Surge'] };
  }
}

function page(p) {
  const b = body(p);
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="${KIT}/_fonts.css"><link rel="stylesheet" href="${KIT}/_logo.css"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; color: #f5f5f5;
    background: radial-gradient(120% 90% at 85% 0%, #14301a 0%, #0d120e 50%, #0a0a0a 100%); }
  .top-bar { position: absolute; top: 0; left: 64px; right: 64px; height: 150px; display: flex; align-items: center; justify-content: space-between; }
  .top-bar .wordmark { width: 210px; height: 58px; background: #fff; }
  .tag { font: 700 24px Archivo, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #4abe4a; border: 2.5px solid #4abe4a; border-radius: 999px; padding: 12px 24px; }
  main { position: absolute; top: 190px; left: 64px; right: 64px; bottom: 150px; display: flex; flex-direction: column; justify-content: center; }
  .huge { font: 400 300px/1 Anton, 'Bahnschrift Condensed', sans-serif; color: #4abe4a; letter-spacing: -.01em; text-transform: uppercase; padding-bottom: 18px; }
  h1 { font: 400 92px/1.02 Anton, 'Bahnschrift Condensed', sans-serif; text-transform: uppercase; margin-top: 10px; }
  h1.top { margin: 0 0 28px; } h1.big { font-size: 120px; } h1.under { margin-top: 36px; font-size: 96px; }
  h1 em { font-style: normal; color: #4abe4a; }
  .partner { font: 600 32px Archivo, sans-serif; color: #cfd3d0; margin-top: 22px; }
  .lede { font: 500 36px/1.38 Archivo, sans-serif; color: #cfd3d0; max-width: 900px; margin-top: 8px; }
  .meter { height: 30px; background: #1f2621; border-radius: 999px; overflow: hidden; margin-top: 46px; }
  .meter .fill { height: 100%; background: #4abe4a; border-radius: 999px; }
  .scale { display: flex; justify-content: space-between; font: 600 24px Archivo, sans-serif; color: #8d968f; margin-top: 10px; }
  .ask { list-style: none; margin-top: 40px; font: 500 36px/1.6 Archivo, sans-serif; color: #f5f5f5; }
  .ask li::before { content: ''; display: inline-block; width: 16px; height: 16px; background: #4abe4a; margin-right: 22px; vertical-align: 6px; }
  .stats { display: flex; gap: 80px; margin-top: 44px; }
  .stats b { display: block; font: 400 96px/1 Anton, sans-serif; color: #f5f5f5; }
  .stats span { font: 700 24px Archivo, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #8d968f; }
  .events { list-style: none; margin-top: 40px; border-top: 2px solid #2b2f2c; }
  .events li { display: grid; grid-template-columns: 290px 1fr 150px; gap: 20px; align-items: baseline; padding: 30px 0; border-bottom: 2px solid #2b2f2c; }
  .events b { font: 400 50px Anton, sans-serif; color: #4abe4a; text-transform: uppercase; }
  .events span { font: 600 36px Archivo, sans-serif; } .events i { font: 600 28px Archivo, sans-serif; font-style: normal; color: #8d968f; text-align: right; }
  .photo-slot { height: 640px; border: 3px dashed #6b5a2a; background: #15130c; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; gap: 24px; }
  .photo-slot p { font: 700 40px Archivo, sans-serif; } .photo-slot small { font: 500 26px/1.4 Archivo, sans-serif; color: #cbb98a; max-width: 760px; }
  .gap { font-style: normal; color: #f2b53a; font-family: Archivo, sans-serif; font-weight: 700; font-size: .5em; letter-spacing: 0; text-transform: none; vertical-align: middle; }
  .huge .gap, .stats .gap { font-size: 56px; } .lede .gap { font-size: 36px; } .events .gap { font-size: 32px; }
  .foot { position: absolute; left: 64px; right: 64px; bottom: 52px; display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #2b2f2c; padding-top: 18px; font: 600 28px Archivo, sans-serif; color: #cfd3d0; }
  .foot b { font: 400 42px Anton, sans-serif; color: #4abe4a; letter-spacing: .02em; } .foot b .gap { font-size: 28px; }
</style></head><body>
  <div class="top-bar"><i class="wordmark"></i><span class="tag">${esc(b.tag)}</span></div>
  <main>${b.main}</main>
  <div class="foot"><span>${b.foot[0]}</span><b>${b.foot[1]}</b></div>
</body></html>`;
}

function shoot(html, png, w = 1080, h = 1350) {
  const file = join(TMP, png.split(/[\\/]/).pop().replace(/\.png$/, '.html'));
  writeFileSync(file, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    `--screenshot=${png}`, '--virtual-time-budget=5000', pathToFileURL(file).href], { stdio: 'ignore' });
}

const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? +process.argv[i + 1] : 0; })();
for (const p of POSTS) {
  if (only && p.n !== only) continue;
  shoot(page(p), join(OUT, fileName(p)));
  console.log(`post ${p.n} (${dayLabel(p.iso)} ${p.time}): ${fileName(p)}`);
}

if (!only) {
  const tiles = POSTS.map((p) => `<figure><img src="${pathToFileURL(join(OUT, fileName(p))).href}"><figcaption><b>${p.n}</b> ${esc(dayLabel(p.iso))}, ${p.time}</figcaption></figure>`).join('');
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${KIT}/_fonts.css"><style>
    * { box-sizing: border-box; margin: 0; } html, body { width: 2480px; height: 1520px; background: #1a1d1b; color: #e8ebe9; font-family: Archivo, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: baseline; padding: 30px 40px 18px; }
    header h1 { font: 400 44px Anton, sans-serif; text-transform: uppercase; } header h1 em { font-style: normal; color: #4abe4a; }
    header p { font-size: 20px; color: #aab2ac; }
    .grid { display: grid; grid-template-columns: repeat(7, 320px); gap: 24px 22px; padding: 0 40px; }
    figure img { width: 320px; height: 400px; display: block; border: 1px solid #333a35; }
    figcaption { font-size: 18px; padding-top: 8px; color: #cfd3d0; } figcaption b { color: #4abe4a; margin-right: 6px; }
  </style></head><body><header><h1>Surge &middot; <em>Holiday toy drive</em></h1><p>Facebook, Mon + Wed &middot; DRAFTS, each needs Matthew's review &middot; amber = still to fill in &middot; nothing posted or scheduled</p></header>
  <div class="grid">${tiles}</div></body></html>`;
  shoot(sheet, join(HERE, 'contact-sheet.png'), 2480, 1520);
  console.log('contact sheet: contact-sheet.png');
}

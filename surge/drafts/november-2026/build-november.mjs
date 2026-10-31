/* Surge: November 2026 Facebook posts, Tuesdays and Thursdays (DRAFTS ONLY: nothing posted or scheduled).
   Eight 1080 x 1350 images rendered by headless Chrome:
     - six photo or brand-graphic posts in layout B, the Surge look since 27 Oct (copied from
       ../fb-ig-set-2026-10/build-posts.mjs; three of them are that set's unposted posts 1, 2 and 5, reused);
     - two research boards reused from ../visual-set-2026-09-14/ (02 giving, 04 recall), patched on the way
       through: 02 loses the booth photo (Matthew 22 Oct: nothing that shows brands or booth work) and the word
       "only" in its read; both get the 31 Oct 2026 re-check date in their source lines.
   Then a contact sheet of all eight.
   Photos come from the main checkout's brand/photos (gitignored, not in the worktree) unless SURGE_PHOTOS is set.
     node build-november.mjs [--only 3]                                                                          */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'posts'), TMP = join(HERE, '.render');
for (const d of [OUT, TMP]) mkdirSync(d, { recursive: true });
const PHOTO_CANDIDATES = [process.env.SURGE_PHOTOS, join(HERE, '../../brand/photos'), 'C:/Users/Surge Inc/Desktop/claude test 2/surge/brand/photos'].filter(Boolean);
const PHOTOS = PHOTO_CANDIDATES.find((p) => existsSync(join(p, 'Office and work')));
if (!PHOTOS) throw new Error('brand/photos not found; set SURGE_PHOTOS');
const KIT_DIR = resolve(HERE, '../visual-set-2026-09-14'), KIT = pathToFileURL(KIT_DIR).href;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = '(720) 719-5495';
const CALL = { left: 'Talk to us', right: PHONE }, APPLY = { left: 'Apply online', right: 'surgeftw.com/careers' };
const SITE = { left: 'Outsourced sales & marketing', right: 'surgeftw.com' };
const CHECKED = '31 October 2026';

/* n = November post number (1-8), in posting order. */
const POSTS = [
  { n: 1, date: 'Tue 3 Nov', slug: 'we-run-your-team', kind: 'b', reused: 'fb-ig-set-2026-10 post 1',
    photo: 'Culture/D4327668-DC8B-4DCC-9DE0-327C421F0BBA.webp', pos: '50% 55%', foot: CALL, accent: 'your sales team.',
    kicker: 'Outsourced sales & marketing', head: 'We build and run your sales team.',
    sub: 'Hiring, onboarding, training and day-to-day management, handled. You focus on the business.' },
  { n: 2, date: 'Thu 5 Nov', slug: 'learn-the-business', kind: 'b',
    photo: 'Office and work/IMG_7634-cropped.jpg', pos: '50% 42%', foot: APPLY, accent: 'not just the pitch.',
    kicker: 'What we teach', head: 'Learn the business, not just the pitch.',
    sub: 'From our training: \u201cUsing the systems to perform is important, but using them to learn the business is everything.\u201d' },
  { n: 3, date: 'Tue 10 Nov', slug: 'where-giving-comes-from', kind: 'board', board: '02-where-giving-comes-from.html' },
  { n: 4, date: 'Thu 12 Nov', slug: 'day-one-last', kind: 'b', reused: 'fb-ig-set-2026-10 post 5',
    photo: 'Office and work/IMG_7637.jpg', pos: '50% 45%', foot: APPLY, accent: 'a trainer earns.',
    kicker: 'Who teaches day one', head: 'Day one is the last thing a trainer earns.',
    sub: 'Trainers start by teaching week two and work backwards. The first day is the hardest to teach.' },
  { n: 5, date: 'Tue 17 Nov', slug: 'feel-felt-found', kind: 'b',
    photo: 'Office and work/IMG_7737.jpg', pos: '50% 84%', foot: CALL, accent: 'before you answer it.',
    kicker: 'Objections', head: 'Hear it out before you answer it.',
    sub: 'Feel, felt, found. Say you understand. Say others have felt the same. Then share what they found.' },
  { n: 6, date: 'Thu 19 Nov', slug: 'recall-not-review', kind: 'board', board: '04-recall-not-review.html' },
  { n: 7, date: 'Tue 24 Nov', slug: 'field-channels', kind: 'b', reused: 'fb-ig-set-2026-10 post 2',
    photo: 'Office and work/IMG_7768.jpg', pos: '50% 18%', foot: CALL, accent: 'Events.',
    kicker: 'Field sales', head: 'Door to door. Phones. Events.',
    sub: 'Trained reps in front of your customers, for clients in multiple states.' },
  { n: 8, date: 'Thu 26 Nov', slug: 'thank-you', kind: 'quote', foot: SITE, accent: 'part of the training.',
    kicker: 'After the yes', head: 'Gratitude is part of the training.',
    quote: 'Thank you for your support.', quoteAccent: 'Here\u2019s what you did.',
    sub: 'We teach every rep to thank the person, then tell them what their support does.' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fileName = (p) => `surge-nov-${String(p.n).padStart(2, '0')}-${p.slug}.png`;

function twoTone(text, accent) {
  const h = esc(text), a = accent ? esc(accent) : '', cut = a && h.endsWith(a) ? h.length - a.length : h.length;
  return h.slice(0, cut) + (cut < h.length ? '<em>' + h.slice(cut) + '</em>' : '');
}

/* Layout B, unchanged from fb-ig-set-2026-10 apart from the 'quote' variant, which puts a brand panel where the
   photo would sit (post 8 has no photo: it is a brand graphic, per the covers/content split and no generated people). */
function pageB(p) {
  const media = p.kind === 'quote'
    ? `<div class="pic quote"><span class="qm">\u201c</span><p>${esc(p.quote)}<br><em>${esc(p.quoteAccent)}</em></p><span class="qsrc">From our training</span></div>`
    : `<div class="pic" style="background:url('${pathToFileURL(join(PHOTOS, p.photo)).href}') ${p.pos}/cover"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="${KIT}/_fonts.css"><link rel="stylesheet" href="${KIT}/_logo.css"><style>
  * { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #0a0a0a; color: #f5f5f5; }
  .top { position: absolute; top: 0; left: 64px; right: 64px; height: 150px; display: flex; align-items: center; justify-content: space-between; }
  .top .wordmark { width: 210px; height: 58px; background: #fff; }
  .tag { font: 700 24px Archivo, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #4abe4a; border: 2.5px solid #4abe4a; border-radius: 999px; padding: 12px 24px; }
  .pic { position: absolute; top: 150px; left: 64px; right: 64px; height: 690px; }
  .pic.quote { background: #121613; border: 2px solid #1f2621; padding: 70px 72px; display: flex; flex-direction: column; justify-content: center; }
  .pic.quote .qm { position: absolute; top: 28px; left: 56px; font: 400 260px/1 Anton, sans-serif; color: #4abe4a; opacity: .9; }
  .pic.quote p { font: 400 86px/1.04 Anton, 'Bahnschrift Condensed', sans-serif; text-transform: uppercase; color: #f5f5f5; margin-top: 70px; }
  .pic.quote p em { font-style: normal; color: #4abe4a; }
  .pic.quote .qsrc { position: absolute; bottom: 40px; left: 72px; font: 700 22px Archivo, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #8d968f; }
  .rule { position: absolute; top: 840px; left: 64px; width: 220px; height: 10px; background: #4abe4a; }
  .panel { position: absolute; top: 884px; left: 64px; right: 64px; bottom: 52px; display: flex; flex-direction: column; }
  h1 { font: 400 ${p.head.length > 34 ? 80 : 90}px/1.02 Anton, 'Bahnschrift Condensed', sans-serif; text-transform: uppercase; letter-spacing: .005em; margin-bottom: 20px; }
  h1 em { font-style: normal; color: #4abe4a; }
  .sub { font: 500 31px/1.38 Archivo, sans-serif; color: #cfd3d0; max-width: 930px; }
  .foot { margin-top: auto; display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #2b2f2c; padding-top: 18px; font: 600 28px Archivo, sans-serif; color: #cfd3d0; }
  .foot b { font: 400 42px Anton, sans-serif; color: #4abe4a; letter-spacing: .02em; }
</style></head><body>
  <div class="top"><i class="wordmark"></i><span class="tag">${esc(p.kicker)}</span></div>
  ${media}<div class="rule"></div>
  <div class="panel"><h1>${twoTone(p.head, p.accent)}</h1><div class="sub">${esc(p.sub)}</div>
    <div class="foot"><span>${esc(p.foot.left)}</span><b>${esc(p.foot.right)}</b></div></div>
</body></html>`;
}

/* The research boards: read the September HTML, point its stylesheets at the kit, patch, and strip the screen
   surround so the screenshot is exactly the 1080 x 1350 board. Each patch must hit, or the build stops. */
function patchOnce(html, from, to, label) {
  if (!html.includes(from)) throw new Error(`patch did not apply (${label}): ${from.slice(0, 60)}`);
  return html.replace(from, () => to);
}
function boardPage(p) {
  let h = readFileSync(join(KIT_DIR, p.board), 'utf8');
  for (const css of ['_fonts.css', '_logo.css', '_board.css']) h = patchOnce(h, `href="${css}"`, `href="${KIT}/${css}"`, css);
  if (p.n === 3) {
    // No booth photo: the masthead becomes a plain dark band with the brand glow.
    h = patchOnce(h, /<img src="photo-booth\.jpg"[^>]*>/.exec(h)?.[0] ?? '<img src="photo-booth.jpg"', '', 'booth photo');
    h = patchOnce(h, '<div class="cap">Field fundraising<br>Nonprofit sector</div>', '', 'photo caption');
    h = patchOnce(h, '.band img{', '.band{background:radial-gradient(120% 140% at 85% 0%,#17331a 0%,#0d120e 55%,#0a0a0a 100%) !important}\n  .band img{', 'band ground');
    h = patchOnce(h, '<div class="on">', '<i class="wordmark" style="position:absolute;top:48px;left:64px;width:190px;height:52px;background:#fff;z-index:2"></i>\n    <div class="on">', 'band wordmark');
    h = patchOnce(h, 'and that column moves only when somebody asks.', 'and that column moves when somebody asks.', 'read: only');
    // Correction (31 Oct): corporations grew slower (+0.5% real) than individuals (+1.4%), so "the slowest-growing" was wrong.
    h = patchOnce(h, 'the largest source and the slowest-growing one', 'the largest source and one of the slowest-growing', 'read: slowest');
    h = patchOnce(h, 'Read first-hand 14 September 2026.', `Read first-hand 14 September 2026, re-checked ${CHECKED}.`, 'check date');
  }
  if (p.n === 6) {
    h = patchOnce(h, 'Both checked 14 September 2026.', `Both checked 14 September 2026 and re-checked ${CHECKED}.`, 'check date');
  }
  const screen = '<style>@media screen{body{padding:0 !important;display:block !important;background:transparent !important}.board{box-shadow:none !important;margin:0 !important}}</style>';
  return h.replace('</style>', '</style>\n' + screen);
}

function shoot(html, png, w = 1080, hgt = 1350) {
  const file = join(TMP, png.replace(/\.png$/, '.html').split(/[\\/]/).pop());
  writeFileSync(file, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${hgt}`,
    `--screenshot=${png}`, '--virtual-time-budget=5000', pathToFileURL(file).href], { stdio: 'ignore' });
}

const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? +process.argv[i + 1] : 0; })();
for (const p of POSTS) {
  if (only && p.n !== only) continue;
  const png = join(OUT, fileName(p));
  shoot(p.kind === 'board' ? boardPage(p) : pageB(p), png);
  console.log(`post ${p.n} (${p.date}): ${png}`);
}

/* Contact sheet: 4 x 2, each tile labelled with its posting date. */
if (!only) {
  const tiles = POSTS.map((p) => `<figure><img src="${pathToFileURL(join(OUT, fileName(p))).href}"><figcaption><b>${p.n}</b> ${esc(p.date)}, 3:00 pm MT</figcaption></figure>`).join('');
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${KIT}/_fonts.css"><style>
    * { box-sizing: border-box; margin: 0; } html, body { width: 2000px; height: 1460px; background: #1a1d1b; color: #e8ebe9; font-family: Archivo, sans-serif; }
    header { display: flex; justify-content: space-between; align-items: baseline; padding: 30px 40px 18px; }
    header h1 { font: 400 44px Anton, sans-serif; text-transform: uppercase; letter-spacing: .01em; } header h1 em { font-style: normal; color: #4abe4a; }
    header p { font-size: 20px; color: #aab2ac; }
    .grid { display: grid; grid-template-columns: repeat(4, 440px); gap: 28px 40px; padding: 0 40px; }
    figure img { width: 440px; height: 550px; display: block; border: 1px solid #333a35; }
    figcaption { font-size: 20px; padding-top: 10px; color: #cfd3d0; } figcaption b { color: #4abe4a; margin-right: 6px; }
  </style></head><body><header><h1>Surge &middot; <em>November 2026</em></h1><p>Facebook, Tue + Thu 3:00 pm MT &middot; DRAFTS, each needs Matthew's review &middot; nothing posted or scheduled</p></header>
  <div class="grid">${tiles}</div></body></html>`;
  shoot(sheet, join(HERE, 'contact-sheet.png'), 2000, 1460);
  console.log(`contact sheet: ${join(HERE, 'contact-sheet.png')}`);
}

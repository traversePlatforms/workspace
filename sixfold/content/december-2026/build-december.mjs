/* 365 Aeration & Seeding: the rest of December 2026 (15-31 Dec), built 16 Nov 2026. DRAFTS ONLY: nothing posted, queued or scheduled
   to go out. Jen McPherson approves each post on the posting calendar; the editor sign-in that loads them can never approve.
   Matthew, 16 Nov: "Instead of starting the first batch at december 15th go ahead and just finish out the month of december so that we
   can just start free at the first 1 each month."
   Rules: ../jen-style.md (captions one or two sentences + the contact line; Instagram ends #coloradolawn #lawncare #frontrange; no
   urgency; real job photos only; photo sets 3-4 photos at 1440 x 1080; images seasonless, captions may be seasonal).
   What this builds:
   - 2 designed cards, Thu 3:00 pm MT, 1080 x 1350, in the Thanksgiving card's style (../november-2026/build-november.mjs, cardPage):
     Merry Christmas (Thu 24 Dec) and Happy New Year (Thu 31 Dec). Text and simple shapes only.
   - 2 photo sets, Sat 2:00 pm MT: real job photos cropped to 4:3 and re-saved by sharp at 1440 x 1080 (sharp drops EXIF/GPS).
   - manifest-dec15-31.json (ONLY these 4 new posts; manifest.json keeps the 12 Dec set and is not touched), posts.md, two contact sheets.
   The 4 Tue/Thu tip posts on 15, 17, 22 and 29 Dec are drafts already on the calendar (October job-photo posts); they are moved there
   with the API's edit action, not loaded again. They are listed in posts.md from MOVED below.
   Job photos come from the Sixfold shared drive (I:), found by job date and file name so no street address is written here (this file
   is in git). Photo sets, decoded photos and the contact sheets stay local (./.gitignore).
     node build-december.mjs */
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const PACK = join(REPO, 'sixfold/brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack');
const JOBS = 'I:/Shared drives/Sixfold/08 Photos and content/Job photos';
const OCT_POSTS = join(REPO, 'sixfold/content/365-social-2026-10/job-photo-posts');   /* the 4 moved drafts' pictures, for the contact sheet */
const sharp = createRequire(join(REPO, 'node_modules', 'x.js'))('sharp');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FONTS = pathToFileURL(join(PACK, 'Fonts')).href;
const BADGE = pathToFileURL(join(PACK, 'Full colour', '365-Badge-A-Green.svg')).href;
const PHONE = '(720) 830-4553';
const OUT = join(HERE, 'posts'), SETS = join(HERE, 'photosets'), TMP = join(HERE, '.render');
for (const d of [OUT, SETS, TMP]) mkdirSync(d, { recursive: true });
const CTA_FB = `Message us here, or text a picture of your lawn to ${PHONE} for a free quote.`;
const CTA_IG = `Send us a DM, or text a picture of your lawn to ${PHONE} for a free quote.`;
const TAGS = '#coloradolawn #lawncare #frontrange';

/* ---------- the 2 designed cards ---------- */
const POSTS = [
  { date: '2026-12-24', slug: 'christmas', kicker: 'Merry Christmas', head: 'Wishing you a warm, restful Christmas.',
    sub: 'From all of us at 365 Aeration &amp; Seeding. Thank you for having us out this year.',
    src: 'Whenever you need us: message us or text a picture of your lawn.',
    fb: `Merry Christmas from all of us at 365 Aeration & Seeding. Thank you to every customer who had us out this year, and to everyone who sent us a message or a picture of their lawn.\n\n${CTA_FB}`,
    ig: `Merry Christmas from all of us at 365 Aeration & Seeding. Thank you to every customer who had us out this year.\n\n${CTA_IG}\n\n${TAGS}`,
    alts: ['Merry Christmas from the 365 crew. Thank you for a good year.', 'From our crew to your family: Merry Christmas, and thank you for having us out this year.'],
    cut: [['"We\'re grateful for every one." (the Thanksgiving card\'s line)', 'Repeats Thanksgiving four weeks later, and makes a third sentence (jen-style: one or two).'],
      ['"Enjoy the day."', 'The card goes out on Christmas Eve, not the day itself.'],
      ['#merrychristmas on Instagram', 'jen-style: Instagram ends with the three set tags.']],
    sources: ['Christmas 2026 is Friday 25 Dec, so the Thu 24 Dec slot is Christmas Eve (calendar).', 'Customers had us out this year: 2026 job records (job-photo folders run Sept-Nov 2026).'],
    why: 'A short thank-you and a warm greeting. No prices, no offer, no urgency; the contact line is the standing one from jen-style.' },
  { date: '2026-12-31', slug: 'new-year', kicker: 'Happy New Year', head: 'Thank you for 2026. See you in the spring.',
    sub: 'From all of us at 365 Aeration &amp; Seeding. Here’s to a good year ahead.',
    src: 'Whenever you need us: message us or text a picture of your lawn.',
    fb: `Happy New Year from all of us at 365 Aeration & Seeding. Thank you to everyone who had us out in 2026, and we'll see you in the spring.\n\n${CTA_FB}`,
    ig: `Happy New Year from all of us at 365 Aeration & Seeding. Thank you to everyone who had us out in 2026, and we'll see you in the spring.\n\n${CTA_IG}\n\n${TAGS}`,
    alts: ['Happy New Year from the 365 crew. Thank you for a great 2026.', 'Thank you for 2026. Here\'s to green lawns in 2027.'],
    cut: [['"Spring is one of the two best times of year to aerate." (CSU PlantTalk 1505)', 'True and sourced, but it turns a thank-you into a sales line and makes a third sentence. Use it in a January post instead.'],
      ['"Book your spring aeration now."', 'Urgency (jen-style: none unless Jen asks).'],
      ['"our first season"', 'Not checked: the business ran before the 365 name. Left out.']],
    sources: ['New Year\'s Eve 2026 is Thursday 31 Dec (calendar).', '"See you in the spring": spring is one of the two best times to core aerate, CSU Extension PlantTalk 1505 (Lawn Aeration); no date or offer is promised.'],
    why: 'Thank-you for 2026 with spring mentioned once, softly. No claim beyond the greeting.' },
];

/* ---------- the 2 photo sets ---------- */
/* each image: { job: 'YYYY-MM-DD', file, sub (a subfolder of the job, e.g. After), crop [x, y, w, h] in source px, what }.
   Kara's job (17 Sep, landscaping) photos are iPhone HEICs: decoded with ffmpeg into .render/kara/ (local). */
const SETS_DATA = [
  { date: '2026-12-19', title: 'Landscaping: rock beds and lawn edges', images: [
      { job: '2026-09-17', sub: 'After', file: 'IMG_8207.HEIC', crop: [800, 0, 4400, 3300], what: 'Stepping stones, rock bed with grasses and a boulder, lawn under the pines. Bottom cropped: the photographer\'s shadow and the road; left edge cropped: corner of the house' },
      { job: '2026-09-17', sub: 'After', file: 'IMG_8210.HEIC', crop: [0, 700, 4284, 3213], what: 'Rock bed with grasses, a boulder and river rock. Portrait photo cut to 4:3: most of the house wall (top) and the sidewalk (bottom) taken out' },
      { job: '2026-09-17', sub: 'After', file: 'IMG_8208.HEIC', crop: [0, 2400, 4284, 3213], what: 'Lawn, boulder and the gravel strip along the curb. Portrait photo cut to 4:3: the sky, a neighbour\'s house and garage, and two utility boxes taken out' } ],
    fb: `Rock beds and lawn edges after one of our landscaping jobs this year. Bed clean-up and plant removal are a service on their own with us, no aeration booking needed.\n\n${CTA_FB}`,
    ig: `Rock beds and lawn edges after one of our landscaping jobs this year. Bed clean-up and plant removal are a service on their own, no aeration booking needed.\n\n${CTA_IG}\n\n${TAGS}`,
    alts: ['Landscaping is its own service with us. A few pictures from one of this year\'s jobs.', 'Beds, edges and lawn, cleaned up.'],
    cut: [['"...and the pines limbed up"', 'Shows tree work. Colorado Springs licenses paid pruning of trees 15 ft and up, and Sixfold does not hold that licence; tree work stays out of the copy, and the photos with fresh cuts on the trunks were not picked.'],
      ['"We built these beds."', 'Not true as far as the records show: the job was a clean-up of an existing landscape.'],
      ['IMG_8211 (lawn edge, boulder)', 'A small yellow flag with a logo sits in the bed: possibly another company\'s marker.']],
    sources: ['Kara\'s job, 17 Sep 2026: landscaping only (memory sixfold-landscaping-standalone; job notes), photos from the job\'s After folder.', '365aeration.com (fetched 16 Nov 2026): "Shrub and hedge trimming, plants and trees taken out, bed clean-up and haul-away."', 'Landscaping booked on its own, never the after-job (Matthew\'s standing rule, as in the 19 Nov landscaping post).'] },
  { date: '2026-12-26', title: 'Wide-open lawns', images: [
      { job: '2026-11-04', file: '2026-11-04 18.29 f472b313.jpg', crop: [0, 270, 1120, 840], what: 'Wide lawn with the hills behind. Right side cropped: two yellow aspens, a yield sign and the road; top cropped: sky' },
      { job: '2026-09-17', sub: 'After', file: 'IMG_8203.HEIC', crop: [0, 1224, 2400, 1800], what: 'Lawn and gravel path down to a pond. Right side cropped: the house; top cropped: sky' },
      { job: '2026-09-17', sub: 'After', file: 'IMG_8209.HEIC', crop: [0, 2300, 3400, 2550], what: 'Lawn under the pines beside the drive. Portrait photo cut to 4:3: the sky, the garage and a parked truck (right) taken out' } ],
    fb: `Wide-open lawns from two of this year's jobs. Big or small, every lawn gets its own quote.\n\n${CTA_FB}`,
    ig: `Wide-open lawns from two of this year's jobs. Big or small, every lawn gets its own quote.\n\n${CTA_IG}\n\n${TAGS}`,
    alts: ['A few big lawns from this year.', 'Room to roam: lawns from two of this year\'s jobs.'],
    cut: [['"...from Woodland Park to Colorado Springs"', 'Town names were dropped: one of the two jobs sits on the Monument / Colorado Springs line and the records name both.'],
      ['"Freshly aerated lawns"', 'The September photos are from a landscaping job, not an aeration; the November one is not a before/after.'],
      ['A fourth photo', 'No fourth clean, seasonless, unused photo was left (see FACT-CHECK.md).']],
    sources: ['Woodland Park job, 4 Nov 2026 (job-photo folder); Kara\'s job, 17 Sep 2026.', 'No flat aeration rate, every lawn quoted (standing 365 rule, as in the November posts).'] },
];

/* ---------- the 4 drafts already on the calendar, moved to dates (words unchanged) ---------- */
const MOVED = [
  { id: 'pa1d00abb55', date: '2026-12-15', head: 'Thin lawn? Check the soil.', png: 'post-06.png', why: 'Soil compaction: true all winter, and the reason for spring aeration. Nothing in it needs a growing lawn.' },
  { id: 'p8647a77958', date: '2026-12-17', head: 'Before you rip it out.', png: 'post-07.png', why: 'Planning: winter is when people think about replacing a lawn with sod. Its picture is a brown before-shot, which suits the topic.' },
  { id: 'pfe28da70ac', date: '2026-12-22', head: 'Front lawns to acreage.', png: 'post-09.png', why: 'Sizes: a "we quote any yard" post, nothing seasonal in it.' },
  { id: 'p20eb76e9e7', date: '2026-12-29', head: 'What to expect when we come.', png: 'post-08.png', why: 'What to expect on the day: useful just before spring booking starts. Its line about frozen ground moving the day reads right in December.' },
];
const LEFT = ['p46eb7c1b90 "Leave the plugs" (needs a just-aerated lawn)', 'p806050493c "Seed goes straight into the holes" (overseeding happens in spring/fall)',
  'p880768da53 "Keep the top of the soil damp" (watering new seed; nobody seeds in late December)', 'pd979151156 "Take off a third" (mowing; nobody mows in late December)'];

/* ---------- build ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const shot = (html, png, w, h) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${png}`, '--virtual-time-budget=4000', pathToFileURL(html).href], { stdio: 'ignore' });

/* a job photo by job date and file name (the folder, "<job date> <street, town>", is found on disk) */
function jobPhoto(job, file, sub) {
  const month = join(JOBS, job.slice(0, 7));
  const d = existsSync(month) && readdirSync(month).find((x) => x.startsWith(job) && statSync(join(month, x)).isDirectory() && existsSync(join(month, x, sub || '', file)));
  if (!d) throw new Error(`job photo not found: ${job} ${sub || ''} ${file}`);
  return join(month, d, sub || '', file);
}
function source(im) {   /* HEIC: decode once with ffmpeg (full size, orientation applied) into .render/kara; nothing is written to the drive */
  const src = jobPhoto(im.job, im.file, im.sub);
  if (!/\.heic$/i.test(im.file)) return src;
  const out = join(TMP, 'kara', `${im.job}-${im.file.replace(/\.\w+$/, '.jpg')}`);
  if (!existsSync(out)) { mkdirSync(dirname(out), { recursive: true }); execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', '-q:v', '2', out]); }
  return out;
}

/* the Thanksgiving card's layout (../november-2026/build-november.mjs, cardPage with big: true and no photo band) */
function cardPage(p) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Outfit; src: url('${FONTS}/Outfit.ttf'); font-weight: 100 900; }
@font-face { font-family: DMSans; src: url('${FONTS}/DMSans.ttf'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #2F5D2C; }
body { position: relative; color: #FFF8EC; font-family: DMSans, sans-serif; }
.leafbg { position: absolute; inset: 0; background: radial-gradient(1200px 700px at 85% -10%, rgba(242,193,78,.18), transparent 60%), radial-gradient(900px 600px at -10% 110%, rgba(255,248,236,.08), transparent 60%); }
.ring { position: absolute; border-radius: 50%; border: 3px solid rgba(242,193,78,.16); }
.top { position: absolute; left: 76px; right: 76px; top: 56px; display: flex; justify-content: space-between; align-items: flex-start; }
.badge { width: 150px; height: 150px; filter: drop-shadow(0 4px 12px rgba(0,0,0,.35)); }
.kicker { font: 700 28px DMSans, sans-serif; color: #F2C14E; letter-spacing: .08em; text-transform: uppercase; margin-top: 18px; background: rgba(30,61,28,.92); border-radius: 999px; padding: 12px 24px; }
.main { position: absolute; left: 76px; right: 76px; top: 250px; bottom: 200px; display: flex; flex-direction: column; gap: 30px; justify-content: center; }
h1 { font: 800 110px/1.02 Outfit, sans-serif; letter-spacing: -.012em; text-shadow: 0 2px 18px rgba(0,0,0,.25); }
.sub { font: 500 40px/1.38 DMSans, sans-serif; color: #F1EADB; }
.rule { width: 160px; height: 8px; border-radius: 4px; background: #F2C14E; }
.foot { position: absolute; left: 76px; right: 76px; bottom: 56px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; }
.foot .q { font: 600 24px/1.34 DMSans, sans-serif; color: #F1EADB; max-width: 540px; }
.foot .c { text-align: right; } .foot .c b { display: block; font: 800 46px Outfit, sans-serif; color: #F2C14E; } .foot .c span { font: 700 26px DMSans, sans-serif; }
</style></head><body><div class="leafbg"></div>
<div class="ring" style="width:620px;height:620px;right:-210px;top:-230px"></div><div class="ring" style="width:420px;height:420px;right:-110px;top:-130px"></div><div class="ring" style="width:520px;height:520px;left:-260px;bottom:120px"></div>
<div class="top"><div class="kicker">${esc(p.kicker)}</div><img class="badge" src="${BADGE}" alt=""></div>
<div class="main"><h1>${esc(p.head)}</h1><div class="rule"></div><div class="sub">${p.sub}</div></div>
<div class="foot"><div class="q">${esc(p.src)}</div><div class="c"><b>${PHONE}</b><span>365aeration.com</span></div></div>
</body></html>`;
}

const postFile = (p) => join(OUT, `${p.date}-${p.slug}.png`);
for (const p of POSTS) {
  const html = join(TMP, `${p.date}.html`);
  writeFileSync(html, cardPage(p)); shot(html, postFile(p), 1080, 1350); console.log(`card ${p.date}: ${postFile(p)}`);
}
const setFile = (s, i) => join(SETS, s.date, `${s.date}-${i + 1}.jpg`);
for (const s of SETS_DATA) {
  mkdirSync(join(SETS, s.date), { recursive: true });
  for (const [i, im] of s.images.entries()) {
    let img = sharp(source(im)).rotate();   /* sharp drops EXIF/GPS unless asked to keep it */
    if (im.crop) img = img.extract({ left: im.crop[0], top: im.crop[1], width: im.crop[2], height: im.crop[3] });
    await img.resize(1440, 1080, { fit: 'cover' }).jpeg({ quality: 88, mozjpeg: true }).toFile(setFile(s, i));
  }
  console.log(`photo set ${s.date}: ${s.images.length} photos`);
}

/* contact sheets: every single post 15-31 Dec in date order (the 4 moved drafts from their October pictures), and the 2 photo sets */
const u = (f) => pathToFileURL(f).href;
const dow = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const singles = [...MOVED.map((m) => ({ date: m.date, img: join(OCT_POSTS, m.png), label: `${m.head} (${m.id}, moved)` })),
  ...POSTS.map((p) => ({ date: p.date, img: postFile(p), label: `${p.kicker} (new card)` }))].sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(join(TMP, 'sheet.html'), `<!doctype html><body style="margin:0;background:#1e1e1e;display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:14px;font-family:sans-serif">${singles.map((p) => `<div><img src="${u(p.img)}" style="width:100%;display:block;border-radius:6px"><div style="color:#fff;font:700 18px sans-serif;margin-top:8px">${dow(p.date)} · 3:00 pm</div><div style="color:#bbb;font:15px sans-serif">${esc(p.label)}</div></div>`).join('')}</body>`);
shot(join(TMP, 'sheet.html'), join(HERE, 'contact-sheet.png'), 1900, 560);
writeFileSync(join(TMP, 'sets.html'), `<!doctype html><body style="margin:0;background:#1e1e1e;padding:14px;font-family:sans-serif">${SETS_DATA.map((s) => `<div style="color:#fff;font:700 22px sans-serif;margin:6px 0 8px">${dow(s.date)} · 2:00 pm · ${esc(s.title)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">${s.images.map((_, i) => `<img src="${u(setFile(s, i))}" style="width:100%;display:block;border-radius:4px">`).join('')}</div>`).join('')}</body>`);
shot(join(TMP, 'sets.html'), join(HERE, 'contact-sheet-photosets.png'), 1600, 1010);

/* manifest (only the 4 new posts; relative paths, read from this folder by pc.mjs) and posts.md, from the same data */
const rel = (f) => f.slice(HERE.length + 1).replace(/\\/g, '/');
const manifest = [
  ...POSTS.map((p) => ({ brand: 'sixfold', type: 'single', key: `dec-2026-${p.date}-${p.slug}`, date: p.date, time: '15:00', targets: ['fb', 'ig'], image: rel(postFile(p)), fb_caption: p.fb, ig_caption: p.ig,
    note: `${p.kicker} card (text and shapes only, no photo; holiday card, seasonal by design). DRAFT for Jen to approve.` })),
  ...SETS_DATA.map((s) => ({ brand: 'sixfold', type: 'photoset', key: `dec-2026-${s.date}-photoset`, date: s.date, time: '14:00', targets: ['fb', 'ig'], images: s.images.map((_, i) => rel(setFile(s, i))), fb_caption: s.fb, ig_caption: s.ig,
    note: `Photo set: ${s.title}. ${s.images.length} real job photos (${[...new Set(s.images.map((im) => im.job))].join(', ')} jobs), cropped to 4:3 and re-saved without EXIF/GPS. DRAFT for Jen to approve.` })),
].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
writeFileSync(join(HERE, 'manifest-dec15-31.json'), JSON.stringify(manifest, null, 2) + '\n');

const quote = (t) => t.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
const extras = (x) => ['**Alternate hooks**', '', ...x.alts.map((a) => `- ${a}`), '', '**Lines cut**', '', ...x.cut.map(([l, w]) => `- ${l}: ${w}`), '', `**Sources:** ${x.sources.join('; ')}`, ''];
const md = [`# 365 Aeration & Seeding: 15-31 December 2026 posts (DRAFT, nothing posted)`, '',
  `For the Sixfold 365 Facebook page and @365aeration Instagram. Built 2026-11-16 for Jen McPherson to approve (Matthew: finish out December so each month starts fresh on the 1st). Rules: [../jen-style.md](../jen-style.md).`, '',
  `- Rebuild: \`node build-december.mjs\`. This file and \`manifest-dec15-31.json\` are written by the script: edit captions there, not here.`,
  `- Load: \`node traverse/post-calendar/tools/pc.mjs import sixfold/content/december-2026/manifest-dec15-31.json\` (editor sign-in; can never approve). \`manifest.json\` is the 12 Dec photo set, loaded earlier, and is left alone.`,
  `- Cards (\`posts/\`) are in git. Photo sets, decoded photos (\`.render/\`) and the contact sheets stay local. Contact sheets: \`contact-sheet.png\` (every single post 15-31 Dec) and \`contact-sheet-photosets.png\`.`,
  `- Fact-check log: [FACT-CHECK.md](FACT-CHECK.md).`, '',
  '## The slots', '', '| Date (MT) | Post | What |', '|---|---|---|',
  ...[...MOVED.map((m) => [m.date, '3:00 pm', `${m.id}`, `${m.head} (October tip post, moved; words unchanged)`]),
    ...POSTS.map((p) => [p.date, '3:00 pm', 'new card', `${p.kicker}`]),
    ...SETS_DATA.map((s) => [s.date, '2:00 pm', 'new photo set', `${s.title}, ${s.images.length} photos`])].sort((a, b) => a[0].localeCompare(b[0])).map(([d, t, id, w]) => `| ${dow(d)}, ${t} | ${id} | ${w} |`), '',
  '## The 4 drafts moved onto dates', '',
  'Already written and fact-checked on 26 Oct (`../365-social-2026-10/job-photo-posts/post-0N-caption-draft.md`). Their words are not changed; only date and time were set.', '',
  ...MOVED.flatMap((m) => [`- **${dow(m.date)}, 3:00 pm: ${m.head}** (${m.id}, picture \`${m.png}\`). ${m.why}`]), '',
  'Left undated, for spring: ' + LEFT.join('; ') + '.', '',
  ...POSTS.flatMap((p) => [`## ${dow(p.date)}, 3:00 pm: ${p.kicker} card`, '',
    `**Picture:** \`posts/${p.date}-${p.slug}.png\`. Designed 365 card in the Thanksgiving card's style: text and simple shapes, no photo. On it: kicker "${p.kicker}", headline "${p.head}", line "${p.sub.replace(/&amp;/g, '&')}", footer "${p.src}", ${PHONE}, 365aeration.com, 365 badge.`, '',
    '**Facebook**', '', quote(p.fb), '', '**Instagram**', '', quote(p.ig), '', ...extras(p), `**Why:** ${p.why}`, '']),
  ...SETS_DATA.flatMap((s) => [`## ${dow(s.date)}, 2:00 pm: photo set, ${s.title}`, '',
    '**Photos** (one Facebook post with several photos + an Instagram carousel, in this order):', '',
    ...s.images.map((im, i) => `${i + 1}. \`photosets/${s.date}/${s.date}-${i + 1}.jpg\`: ${im.job} job, ${im.sub ? im.sub + '/' : ''}${im.file}, crop [${im.crop.join(', ')}]. ${im.what}.`), '',
    '**Facebook**', '', quote(s.fb), '', '**Instagram**', '', quote(s.ig), '', ...extras(s)]),
].join('\n');
writeFileSync(join(HERE, 'posts.md'), md);
console.log('manifest-dec15-31.json, posts.md, contact sheets written');

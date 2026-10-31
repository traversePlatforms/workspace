/* 365 Aeration & Seeding: November 2026 social posts (built 2026-10-31). DRAFTS ONLY: nothing posted, queued or scheduled; Matthew approves
   each one in the posting calendar.
   - 8 designed posts, Tue/Thu 3:00 pm MT, 1080 x 1350, the 365 look from ../365-social-2026-10/build-posts.mjs (forest green #2F5D2C, cream
     #FFF8EC, sun gold #F2C14E; Outfit + DM Sans; the green 365 badge), rendered by headless Chrome. No generated imagery
     (Matthew 31 Oct: real photos over AI, so Facebook doesn't flag them). Each post is either a real 365 job photo cropped so no person,
     house number, street sign, plate or close house front shows, or a designed 365 card in the clean-up card's style (text, simple
     shapes, optionally a band of a real job photo).
   - 4 Saturday photo sets, 2:00 pm MT (Matthew 31 Oct: Saturdays are photo day): 4 real job photos each, cropped and re-saved with sharp
     (no EXIF/GPS) at 1440 x 1080.
   - posts.md, manifest.json and the two contact sheets are written from the data below, so captions live in one place.
   Job photos, the posts that hold them, the photo sets and the contact sheets are gitignored (./.gitignore). The gitignored inputs (job
   photos, brand pack, sharp) are read from this checkout, or from the main checkout when run inside a worktree.
     node build-november.mjs [--only 2026-11-10] */
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MAIN = 'C:/Users/Surge Inc/Desktop/claude test 2';               /* where the gitignored inputs live, and where the manifest points */
const pick = (rel) => (existsSync(join(REPO, rel)) ? join(REPO, rel) : join(MAIN, rel));
const PACK = pick('sixfold/brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack');
const PHOTOS = pick('sixfold/brand/job-photos');
const sharp = createRequire(join(pick('node_modules'), 'x.js'))('sharp');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FONTS = pathToFileURL(join(PACK, 'Fonts')).href;
const BADGE = pathToFileURL(join(PACK, 'Full colour', '365-Badge-A-Green.svg')).href;
const PHONE = '(720) 830-4553';
const LIVE = (rel) => join(MAIN, 'sixfold/content/november-2026', rel).replace(/\//g, '\\');
const OUT = join(HERE, 'posts'), SETS = join(HERE, 'photosets'), TMP = join(HERE, '.render');
for (const d of [OUT, SETS, TMP]) mkdirSync(d, { recursive: true });
const CTA_FB = `Message us here, or text a picture of your lawn to ${PHONE} for a free quote.`;
const CTA_IG = `Send us a DM, or text a picture of your lawn to ${PHONE} for a free quote.`;

/* job photos by job date + file name. The folders are named "<job date> <street address>", so the folder is found on disk and no address
   is ever written into this file (it is in git). */
const DIRS = readdirSync(PHOTOS).filter((d) => statSync(join(PHOTOS, d)).isDirectory());
function photo(job, file) {
  const d = DIRS.find((x) => x.startsWith(job) && existsSync(join(PHOTOS, x, file)));
  if (!d) throw new Error(`job photo not found: ${job} ${file}`);
  return join(PHOTOS, d, file);
}

/* ---------- the 8 designed posts ---------- */
const POSTS = [
  { date: '2026-11-03', slug: 'spring-plan', kicker: 'Plan ahead', head: 'Aeration and overseeding, sorted early.',
    sub: 'Spring and fall are the best times to core aerate. Get your free quote in now.',
    card: { band: { kara: 'After/IMG_0198.HEIC', crop: [200, 600, 1160, 600] }, src: 'Free quote: text a picture of your lawn.',
      rows: [['Spring and fall', 'The best times of year to core aerate'], ['The plugs stay', 'They break down back into the lawn'], ['Seed goes in straight after', 'While the holes are open']] },
    seasonal: 'Seasonless words; "spring" is in the caption only.',
    fb: `Spring is the next window for aeration.\n\nSpring and fall are the two best times of year to core aerate. Here's what to expect when we come: we pull small plugs of soil out of the lawn and leave them where they fall, and they break down back into the grass. If you're overseeding too, the seed goes down straight after, while the holes are open.\n\nWant it sorted early? ${CTA_FB}`,
    ig: `Spring is the next window for aeration. We pull small plugs of soil and leave them to break down into the lawn, and if you're overseeding, the seed goes in straight after, while the holes are open.\n\nWant it sorted early? ${CTA_IG}\n\n#coloradolawn #lawnaeration #frontrange`,
    sources: ['CSU Extension PlantTalk 1505, Lawn Aeration (spring and fall best; real plugs)', 'UMass Amherst Extension, Management of Compaction and Coring (plugs left on the turf, broken up as topdressing)', 'CSU PlantTalk 1550, Rejuvenating an Existing Lawn (core aeration then overseeding; seed must contact soil)'],
    why: 'Opens the month on the next booking window without inventing a deadline. Booking early is offered, not claimed to be scarce.' },
  { date: '2026-11-05', slug: 'leaves-mow-in', kicker: 'Fallen leaves', head: 'See grass through the leaves? Mow them in.',
    sub: 'Chopped fine with the mower, a thin layer of leaves goes back into the soil.',
    card: { band: null, src: 'From CSU Extension GardenNotes #655, Using Leaves in the Landscape.',
      rows: [['Mower on its highest setting', 'And take the bag off'], ['At least two passes', 'Chop them fine; don’t leave them whole'], ['A thin layer feeds the soil', 'Research CSU cites: it can raise soil organic matter']] },
    seasonal: 'Leaves are the topic, so it reads as fall, but no season word is on the card.',
    fb: `What to do with the leaves on your lawn.\n\nCSU Extension's rule of thumb: if you can still see some grass through the leaves, the layer isn't too thick to mulch. Raise the mower to its highest setting, take the bag off and go over it at least twice, so the leaves are chopped fine rather than left whole. Research CSU cites found that mowing leaves in can raise the soil's organic matter.\n\nA thick mat is a different story. Snow mold tends to show up as the snow melts where leaves and debris piled up on the lawn over fall and winter.\n\nToo many to mow in? We do fall clean-ups. ${CTA_FB}`,
    ig: `See grass through the leaves? CSU Extension says that layer is thin enough to mow in: highest mower setting, bag off, at least two passes, so they're chopped fine. A thick mat is different: snow mold tends to show up where leaves piled up over winter.\n\nToo many to mow in? We do fall clean-ups. ${CTA_IG}\n\n#coloradolawn #fallcleanup #frontrange`,
    sources: ['CSU Extension GardenNotes #655, Using Leaves in the Landscape (O\'Connor; reviewed July 2024): see-grass rule, highest setting, bag off, two passes, shred not whole, organic matter', 'CSU PlantTalk 1543, Gray Snow Mold in Lawns: appears where leaves and debris accumulated over fall and winter'],
    why: 'Winter-lawn fact post, and an honest bridge to the clean-up: CSU says thin layers can stay, so the clean-up is offered for the thick ones.' },
  { date: '2026-11-10', slug: 'jp-real-work', kicker: 'Real work', head: 'A front lawn from a recent 365 job.',
    sub: 'Core aeration and overseeding for lawns across the Denver area. Every lawn gets its own quote.',
    job: ['2026-10-23', '2026-10-23 15.01 36414e41.jpg'], crop: [60, 330, 1044],
    seasonal: 'Seasonless: a green front lawn and walk; the street, a parked car and the houses across the road cropped out. A few stray leaves only.',
    fb: `Real work: a front lawn from one of our recent jobs.\n\nWe core aerate and overseed lawns across the Denver area, front yards and backyards, small lots and big ones. There's no flat rate: every lawn gets its own quote.\n\nWant yours done? ${CTA_FB}`,
    ig: `Real work: a front lawn from one of our recent jobs. We core aerate and overseed lawns across the Denver area, and every lawn gets its own quote.\n\nWant yours done? ${CTA_IG}\n\n#coloradolawn #lawnaeration #frontrange`,
    sources: ['Job photo: 23 Oct job (Highlands Ranch), taken by Brad, customer asked at the job; shown as a recent job, not as a before/after result', 'Service area: within 45 miles of the Englewood office (Matthew, 14 Oct); jobs to date run from Westminster and Brighton to Parker and Monument', 'No flat aeration rate, every lawn quoted (standing 365 rule)'],
    why: 'A real-work post with a real photo and no result claim. First pick was the 19 Oct drone shot captioned as plugs; dropped because the dots could not be confirmed as cores and the lawn reads brown.' },
  { date: '2026-11-12', slug: 'winter-watering', kicker: 'Winter watering', head: 'Long dry spell, no snow? Water at midday.',
    sub: 'Only above 40\u00B0F, about once or twice a month, and only where your water provider allows it.',
    card: { band: null, src: 'From CSU Extension fact sheet 7.211, Fall and Winter Watering.',
      rows: [['Above 40°F', 'Air and soil both, with no snow on the ground'], ['Once or twice a month', 'During long dry spells'], ['At midday', 'So it soaks in before the night freeze']],
      note: ['Check your water rules first', 'Only water where your water provider allows it'] },
    seasonal: 'Seasonal by design: winter advice ("Winter watering", "no snow").',
    fb: `Winter watering, the CSU way.\n\nCSU Extension notes that snow cover is often lacking here from October through March, so lawns, trees and shrubs can need some water over winter. Its advice: water during long dry spells with no snow cover, about once or twice a month, only when the air and soil are above 40\u00B0F, and at midday so it soaks in before the night freeze. New lawns are most at risk, and south- or west-facing spots and windy yards dry out faster.\n\nCheck your water rules first. Denver Water customers have been under a lawn-watering ban since Oct. 1; trees, shrubs and perennials can still be watered by hand or with drip. Other water providers set their own rules.\n\nQuestions about your lawn? ${CTA_FB}`,
    ig: `Long dry spell with no snow? CSU Extension says water about once or twice a month, only above 40\u00B0F, at midday so it soaks in before the night freeze. New lawns and south- or west-facing spots dry out first.\n\nCheck your water rules first: Denver Water customers are under a lawn-watering ban (trees and shrubs can still be hand-watered).\n\nQuestions about your lawn? ${CTA_IG}\n\n#coloradolawn #wintercare #frontrange`,
    sources: ['CSU Extension Fact Sheet 7.211, Fall and Winter Watering (Klett and Cox; reviewed Aug 2025)', 'Denver Water, "Drought conditions worsen: board declares formal end to lawn watering" (26 Aug 2026)'],
    why: 'The winter-care fact Matthew named, with the water-rules caveat that keeps it from telling Denver Water customers to break a ban. Recheck Denver Water the day before posting.' },
  { date: '2026-11-17', slug: 'cleanup-followup', kicker: 'Fall clean-up', head: 'Leaves, needles and debris, cleared.',
    sub: 'Hauled away, or left on your property if you\u2019d rather. Send us a picture for a free quote.',
    card: { band: { kara: 'Content/IMG_0215.HEIC', crop: [0, 370, 1600, 830] }, src: 'Priced by your yard’s size and how much there is. Send us a picture of your lawn for a free quote.',
      sub: '<b>We get it all:</b> leaves, pine needles and debris, anything that’s fallen onto your lawn.',
      rows: [['Haul-away', 'Or we leave it on your property, if you’d rather'], ['A free quote from a picture', 'Text it to us, or send it in a message']] },
    seasonal: 'Seasonal by design (kicker "Fall clean-up", as Matthew chose for the 31 Oct card). No prices on it.',
    fb: `Still got leaves down? Our fall clean-up takes care of leaves, pine needles and debris, anything that's fallen onto your lawn. We can haul it away, or leave it on your property if you'd prefer. The price depends on your yard's size and how much there is.\n\n${CTA_FB}`,
    ig: `Still got leaves down? Our fall clean-up covers leaves, pine needles and debris, anything that's fallen onto your lawn. Hauled away, or left on your property if you'd rather.\n\n${CTA_IG}\n\n#coloradolawn #yardcleanup #frontrange`,
    sources: ['Brad\'s clean-up scope and haul-away option (31 Oct, via Matthew), as on the 31 Oct card', 'No price list in the caption (Matthew, 31 Oct)'],
    why: 'The one clean-up follow-up, a different picture from the 31 Oct card, no prices.' },
  { date: '2026-11-19', slug: 'jp-landscaping', kicker: 'Landscaping', head: 'Landscaping, on its own.',
    sub: 'Shrub and hedge trimming, plant removal, bed clean-up and haul-away. No aeration booking needed.',
    job: ['2026-10-16', '2026-10-22 18.37 c758e370.jpg'], crop: [470, 430, 924],
    seasonal: 'Mostly seasonless: green corner lawn and a flower bed, house, flag and car cropped out. The bed has orange mums (mild fall cue).',
    fb: `Landscaping is its own service with us. You don't need an aeration booking to get it.\n\nWe do shrub and hedge trimming, take out plants you don't want, clean up beds and haul it all away. Book it on its own, or alongside your lawn work.\n\nMessage us here, or text a picture of your yard to ${PHONE} for a free quote.`,
    ig: `Landscaping is its own service with us: shrub and hedge trimming, plant removal, bed clean-up and haul-away. Book it on its own, or alongside your lawn work.\n\nSend us a DM, or text a picture of your yard to ${PHONE} for a free quote.\n\n#coloradolawn #landscaping #frontrange`,
    sources: ['365aeration.com landscaping line (fetched 31 Oct 2026): "Shrub and hedge trimming, plants and trees taken out, bed clean-up and haul-away"', 'Job photo: Brad\'s drone, 16 Oct job (Highlands Ranch), customer asked at the job; not presented as landscaping work'],
    why: 'Landscaping as a standalone service (never the after-job). "Trees" left out on purpose: see the fact-check log.' },
  { date: '2026-11-24', slug: 'snow-mold', kicker: 'After the snow', head: 'Matted, gray patches as the snow melts?',
    sub: 'Often snow mold. It rarely kills a bluegrass lawn: rake the patches lightly so they dry out.',
    card: { band: null, src: 'From CSU Extension PlantTalk 1543, Gray Snow Mold in Lawns.',
      sub: 'Often snow mold. It rarely kills a bluegrass lawn.',
      rows: [['Rake the patches lightly', 'So the matted grass dries out'], ['Skip the fungicide', 'CSU doesn’t recommend it for snow mold'], ['Slow to come back?', 'Core aeration, then overseeding']] },
    seasonal: 'Seasonal by design: snow-melt advice.',
    fb: `Snow mold: what it is and what to do.\n\nAfter a long stretch of snow cover, some lawns show circular, matted patches as the snow melts, about 6 to 12 inches across, that fade from tan to gray or white as they dry. CSU Extension says it's most common on north-facing and shaded lawns, where plowed or drifted snow piled up deep, and where leaves and debris were left on the lawn over fall and winter.\n\nThe good news: it rarely kills a bluegrass lawn, and CSU doesn't recommend fungicides for it. Rake the patches lightly so they dry out. If an area is slow to come back, CSU's next step is core aeration, then overseeding with the same kind of grass.\n\nSpot some this spring? ${CTA_FB}`,
    ig: `Matted, gray patches as the snow melts? Often snow mold. CSU Extension says it rarely kills a bluegrass lawn and doesn't recommend fungicides: rake the patches lightly so they dry out. Slow to recover? Core aeration and overseeding are the next step.\n\n${CTA_IG}\n\n#coloradolawn #lawncare #frontrange`,
    sources: ['CSU PlantTalk 1543, Gray Snow Mold in Lawns (page undated, site (c) 2026)'],
    why: 'Winter-lawn fact post that ties back to spring aeration and overseeding through CSU\'s own recovery advice.' },
  { date: '2026-11-26', slug: 'thanksgiving', kicker: 'Happy Thanksgiving', head: 'Thank you for trusting us with your lawn.',
    sub: 'From all of us at 365 Aeration & Seeding.',
    card: { band: null, big: true, src: 'Whenever you need us: message us or text a picture of your lawn.',
      sub: 'From all of us at 365 Aeration &amp; Seeding. Enjoy the day.' },
    seasonal: 'Seasonal by design (Thanksgiving).',
    fb: `Happy Thanksgiving from all of us at 365 Aeration & Seeding.\n\nThank you to every customer who had us out this fall, and to everyone who sent us a message, a picture of their lawn or a question. We're grateful for every one.\n\nEnjoy the day. Whenever you need us, message us here or text a picture of your lawn to ${PHONE} for a free quote.`,
    ig: `Happy Thanksgiving from all of us at 365 Aeration & Seeding. Thank you to every customer who had us out this fall, and to everyone who sent a message or a picture of their lawn.\n\nEnjoy the day. Whenever you need us, send us a DM or text a picture of your lawn to ${PHONE} for a free quote.\n\n#coloradolawn #frontrange #happythanksgiving`,
    sources: ['Thanksgiving 2026 is Thursday 26 Nov (fourth Thursday of November)'],
    why: 'Simple thank-you, no offer, the contact line kept soft.' },
];

/* ---------- the 4 Saturday photo sets ---------- */
/* each image: [job, file, crop [x, y, w, h] in source px or null for the whole frame, what was cropped and why] */
const SETS_DATA = [
  { date: '2026-11-07', title: 'Backyards', images: [
      ['2026-10-27', '2026-10-27 18.30 3a3afffb.jpg', null, 'Terraced backyard, stone edging'],
      ['2026-10-27', '2026-10-27 18.30 bb72379e.jpg', null, 'Tree-lined backyard'],
      ['2026-10-20', '2026-10-22 18.41 2a2927a5.jpg', null, 'Backyard, rock border'],
      ['2026-10-23', '2026-10-23 15.01 0c4638d5.jpg', null, 'Backyard with a view of the hills'] ],
    fb: `Saturday photo day: a few backyards from our recent jobs around the Denver area. Every one a little different.\n\n${CTA_FB}`,
    ig: `Saturday photo day: backyards from our recent jobs around the Denver area.\n\n${CTA_IG}\n\n#coloradolawn #lawnaeration #frontrange` },
  { date: '2026-11-14', title: 'Front lawns', images: [
      ['2026-10-26', '2026-10-26 14.28 5a04b3fc.jpg', [0, 150, 1400, 1050], 'Right edge cropped: street sign and lamp post'],
      ['2026-10-26', '2026-10-26 14.28 f6566a5f.jpg', [340, 380, 680, 510], 'Cropped to the parkway and lawn: truck and its plate, trailer, porch and house front taken out'],
      ['2026-10-27', '2026-10-27 18.32 5c56b50c.jpg', [60, 150, 1200, 900], 'Right and bottom cropped: another company\'s branded truck, trailer'],
      ['2026-10-26', '2026-10-26 14.28 06f26396.jpg', [200, 420, 1040, 780], 'Top cropped: street, parked cars, porch'] ],
    fb: `Saturday photo day: front lawns and parkways from recent 365 jobs.\n\n${CTA_FB}`,
    ig: `Saturday photo day: front lawns from recent 365 jobs.\n\n${CTA_IG}\n\n#coloradolawn #lawncare #frontrange` },
  { date: '2026-11-21', title: 'Big yards, tree-lined yards', images: [
      ['2026-10-19', '2026-10-22 18.39 64d34a61.jpg', [720, 540, 880, 660], 'House cropped out; lawn, parkway and a truck and trailer from above (no plate visible)'],
      ['2026-10-27', '2026-10-27 18.30 316b7678.jpg', null, 'Backyard beside a deck'],
      ['2026-10-27', '2026-10-27 18.30 2d94d5e8.jpg', null, 'Shaded backyard under the trees'],
      ['2026-10-16', '2026-10-22 18.37 7e647fdb.jpg', null, 'Side lawn, drone'] ],
    fb: `Saturday photo day: more yards from recent jobs, from wide front lawns to backyards under the trees.\n\n${CTA_FB}`,
    ig: `Saturday photo day: more yards from recent jobs, front lawns to backyards under the trees.\n\n${CTA_IG}\n\n#coloradolawn #lawnaeration #frontrange` },
  { date: '2026-11-28', title: 'A few more from this fall', images: [
      ['2026-10-16', '2026-10-23 14.59 0c91b7a0.jpg', null, 'Lawn by a blue spruce'],
      ['2026-10-27', '2026-10-27 18.30 95c5abb3.jpg', [480, 200, 1120, 840], 'Left cropped: house wall, porch decorations'],
      ['2026-10-23', '2026-10-23 15.01 37e10d12.jpg', [0, 480, 960, 720], 'Cropped to the lawn: the back of the house, the sky and a dry strip at the right taken out'],
      ['2026-10-16', '2026-10-22 18.38 5596d23a.jpg', [0, 560, 853, 640], 'Cropped to the lawn under the tree: pickup truck, porch and house front taken out'] ],
    fb: `Saturday photo day: a few more lawns from this fall's jobs around the Denver area.\n\n${CTA_FB}`,
    ig: `Saturday photo day: a few more lawns from this fall's jobs.\n\n${CTA_IG}\n\n#coloradolawn #lawncare #frontrange` },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const shot = (html, png, w, h) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${png}`, '--virtual-time-budget=4000', pathToFileURL(html).href], { stdio: 'ignore' });
function bg(p) {   /* CSS for the 1080 x 900 picture box of a job-photo post: the photo placed by its crop rectangle */
  const [x, y, w] = p.crop, s = 1080 / w;   /* rectangle w wide, w/1.2 tall, from a 1600 x 1200 photo */
  return `url('${pathToFileURL(photo(...p.job)).href}') ${-x * s}px ${-y * s}px / ${1600 * s}px ${1200 * s}px no-repeat`;
}
/* Kara's job (September, landscaping) photos sit as iPhone HEICs on the shared drive "Photo content dump" (read-only here), in a
   "YYYY-MM/<job date> <street, town>" folder. The folder is found on disk by the job date and the file, so no street goes into git. They are
   decoded once with ffmpeg into .render/kara/ (local, not in git) at 1600 px; nothing is written back to the drive. */
const DUMP = 'I:/Shared drives/Photo content dump', KARA_JOB = '2026-09-17';
function karaSource(rel) {
  const month = join(DUMP, KARA_JOB.slice(0, 7));
  const d = existsSync(month) && readdirSync(month).find((x) => x.startsWith(KARA_JOB) && existsSync(join(month, x, rel)));
  if (!d) throw new Error(`Kara photo not found on the shared drive: ${rel}`);
  return join(month, d, rel);
}
async function karaPhoto(rel) {
  const out = join(TMP, 'kara', rel.replace(/[\\/]/g, '-').replace(/\.\w+$/, '.jpg'));
  if (!existsSync(out)) {
    mkdirSync(dirname(out), { recursive: true });
    const raw = out.replace(/\.jpg$/, '.raw.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', karaSource(rel), '-frames:v', '1', '-q:v', '3', raw]);
    await sharp(raw).rotate().resize(1600, 1600, { fit: 'inside' }).jpeg({ quality: 90 }).toFile(out);
  }
  return out;
}
/* the band across the top of a card: a crop [x, y, w, h] of a job photo (or of Kara's), resized to 1080 x BAND and saved without EXIF */
const BAND = 560;
async function bandFile(p) {
  const b = p.card.band; if (!b) return null;
  const src = b.kara ? await karaPhoto(b.kara) : photo(b.job, b.file);
  const out = join(TMP, `band-${p.date}.jpg`);
  let img = sharp(src).rotate(); if (b.crop) img = img.extract({ left: b.crop[0], top: b.crop[1], width: b.crop[2], height: b.crop[3] });
  await img.resize(1080, BAND, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(out);
  return out;
}
/* a designed 365 card in the clean-up card's style (../365-cleanup-2026-10/build-cleanup.mjs): green ground, kicker pill and badge, the tip
   as the headline, numbered cream rows for the how-to, an optional gold-ruled note, the source and the phone in the footer. Text and
   simple shapes only, plus an optional real job-photo band. */
function cardPage(p, band) {
  const c = p.card, top = band ? 440 : 250, L = p.head.length;
  const hs = c.big ? 110 : band ? (L <= 30 ? 76 : L <= 46 ? 68 : 60) : (L <= 30 ? 96 : L <= 46 ? 86 : 74);
  const R = band ? { k: 44, d: 27, pad: '24px 34px', i: 64 } : { k: 46, d: 28, pad: '26px 36px', i: 68 };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Outfit; src: url('${FONTS}/Outfit.ttf'); font-weight: 100 900; }
@font-face { font-family: DMSans; src: url('${FONTS}/DMSans.ttf'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #2F5D2C; }
body { position: relative; color: #FFF8EC; font-family: DMSans, sans-serif; }
.leafbg { position: absolute; inset: 0; background: radial-gradient(1200px 700px at 85% -10%, rgba(242,193,78,.18), transparent 60%), radial-gradient(900px 600px at -10% 110%, rgba(255,248,236,.08), transparent 60%); }
.ring { position: absolute; border-radius: 50%; border: 3px solid rgba(242,193,78,.16); }
.photo { position: absolute; left: 0; right: 0; top: 0; height: ${BAND}px; background: ${band ? `url('${pathToFileURL(band).href}') center / cover no-repeat` : 'none'}; }
.photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,40,19,.55) 0%, rgba(20,40,19,0) 28%, rgba(47,93,44,0) 46%, #2F5D2C 96%); }
.top { position: absolute; left: 76px; right: 76px; top: 56px; display: flex; justify-content: space-between; align-items: flex-start; }
.badge { width: 150px; height: 150px; filter: drop-shadow(0 4px 12px rgba(0,0,0,.35)); }
.kicker { font: 700 28px DMSans, sans-serif; color: #F2C14E; letter-spacing: .08em; text-transform: uppercase; margin-top: 18px; background: rgba(30,61,28,.92); border-radius: 999px; padding: 12px 24px; }
.main { position: absolute; left: 76px; right: 76px; top: ${top}px; bottom: 200px; display: flex; flex-direction: column; gap: ${band ? 24 : 30}px; justify-content: center; }
h1 { font: 800 ${hs}px/1.02 Outfit, sans-serif; letter-spacing: -.012em; text-shadow: 0 2px 18px rgba(0,0,0,.25); }
.sub { font: 500 ${c.big ? 40 : band ? 31 : 34}px/1.38 DMSans, sans-serif; color: #F1EADB; } .sub b { color: #F2C14E; font-weight: 700; }
.rule { width: 160px; height: 8px; border-radius: 4px; background: #F2C14E; }
.rows { display: flex; flex-direction: column; gap: ${band ? 16 : 20}px; margin-top: 6px; }
.row { background: #FFF8EC; color: #1E3D1C; border-radius: 26px; padding: ${R.pad}; display: flex; gap: 26px; align-items: center; }
.row i { flex: none; width: ${R.i}px; height: ${R.i}px; border-radius: 50%; background: #F2C14E; color: #1E3D1C; font: 800 ${R.i * 0.55}px/${R.i}px Outfit, sans-serif; text-align: center; font-style: normal; }
.row .k { font: 800 ${R.k}px/1.05 Outfit, sans-serif; } .row .d { font: 500 ${R.d}px/1.3 DMSans, sans-serif; color: #4C6A48; margin-top: 5px; }
.note { border: 3px solid #F2C14E; border-radius: 22px; padding: 16px 32px; } .note .k { font: 700 31px DMSans, sans-serif; } .note .d { font: 500 23px DMSans, sans-serif; color: #F1EADB; margin-top: 3px; }
.foot { position: absolute; left: 76px; right: 76px; bottom: 56px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; }
.foot .q { font: 600 24px/1.34 DMSans, sans-serif; color: #F1EADB; max-width: 540px; }
.foot .c { text-align: right; } .foot .c b { display: block; font: 800 46px Outfit, sans-serif; color: #F2C14E; } .foot .c span { font: 700 26px DMSans, sans-serif; }
</style></head><body><div class="leafbg"></div>
${band ? '<div class="photo"></div>' : '<div class="ring" style="width:620px;height:620px;right:-210px;top:-230px"></div><div class="ring" style="width:420px;height:420px;right:-110px;top:-130px"></div><div class="ring" style="width:520px;height:520px;left:-260px;bottom:120px"></div>'}
<div class="top"><div class="kicker">${esc(p.kicker)}</div><img class="badge" src="${BADGE}" alt=""></div>
<div class="main"><h1>${esc(p.head)}</h1>${c.big ? '<div class="rule"></div>' : ''}${c.sub ? `<div class="sub">${c.sub}</div>` : ''}
${c.rows?.length ? `<div class="rows">${c.rows.map(([k, d], i) => `<div class="row"><i>${i + 1}</i><div><div class="k">${esc(k)}</div>${d ? `<div class="d">${esc(d)}</div>` : ''}</div></div>`).join('')}</div>` : ''}
${c.note ? `<div class="note"><div class="k">${esc(c.note[0])}</div>${c.note[1] ? `<div class="d">${esc(c.note[1])}</div>` : ''}</div>` : ''}</div>
<div class="foot"><div class="q">${esc(c.src)}</div><div class="c"><b>${PHONE}</b><span>365aeration.com</span></div></div>
</body></html>`;
}
function page(p) {
  const hs = p.head.length <= 30 ? 80 : p.head.length <= 44 ? 70 : 62;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Outfit; src: url('${FONTS}/Outfit.ttf'); font-weight: 100 900; }
  @font-face { font-family: DMSans; src: url('${FONTS}/DMSans.ttf'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #2F5D2C; }
  .pic { position: absolute; inset: 0 0 auto 0; height: 900px; background: ${bg(p)}; }
  .fade { position: absolute; left: 0; right: 0; top: 700px; height: 220px; background: linear-gradient(to bottom, rgba(47,93,44,0), #2F5D2C 92%); }
  .badge { position: absolute; top: 40px; left: 40px; width: 176px; height: 176px; filter: drop-shadow(0 6px 18px rgba(0,0,0,.35)); }
  .badge img { width: 100%; height: 100%; }
  .panel { position: absolute; left: 0; right: 0; bottom: 0; height: 540px; padding: 0 76px 56px; display: flex; flex-direction: column; justify-content: flex-end; color: #FFF8EC; }
  .kicker { font: 700 30px DMSans, sans-serif; color: #F2C14E; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 16px; }
  h1 { font: 800 ${hs}px/1.03 Outfit, sans-serif; letter-spacing: -.01em; margin-bottom: 22px; }
  .sub { font: 500 33px/1.38 DMSans, sans-serif; color: #F1EADB; max-width: 920px; }
  .foot { margin-top: 32px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; font: 700 30px DMSans, sans-serif; }
  .foot b { font: 800 40px Outfit, sans-serif; color: #F2C14E; }
</style></head><body>
  <div class="pic"></div><div class="fade"></div>
  <div class="badge"><img src="${BADGE}" alt=""></div>
  <div class="panel"><div class="kicker">${esc(p.kicker)}</div><h1>${esc(p.head)}</h1><div class="sub">${esc(p.sub)}</div>
    <div class="foot"><span>Free quote · call or text</span><b>${PHONE}</b></div></div>
</body></html>`;
}

const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : ''; })();
const postFile = (p) => join(OUT, `${p.date}-${p.slug}.png`);
for (const p of POSTS) {
  if (only && p.date !== only) continue;
  const html = join(TMP, `${p.date}.html`);
  writeFileSync(html, p.card ? cardPage(p, await bandFile(p)) : page(p));
  shot(html, postFile(p), 1080, 1350); console.log(`post ${p.date}: ${postFile(p)}`);
}
const setFile = (s, i) => join(SETS, s.date, `${s.date}-${i + 1}.jpg`);
for (const s of SETS_DATA) {
  if (only && s.date !== only) continue;
  mkdirSync(join(SETS, s.date), { recursive: true });
  for (const [i, [job, file, crop]] of s.images.entries()) {
    let img = sharp(photo(job, file)).rotate();   /* sharp drops EXIF/GPS unless asked to keep it */
    if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    await img.resize(1440, 1080, { fit: 'cover' }).jpeg({ quality: 88, mozjpeg: true }).toFile(setFile(s, i));
  }
  console.log(`photo set ${s.date}: ${s.images.length} photos`);
}

/* contact sheets: the 8 posts, and the 4 photo sets */
const u = (f) => pathToFileURL(f).href;
const dow = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
writeFileSync(join(TMP, 'sheet.html'), `<!doctype html><body style="margin:0;background:#1e1e1e;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:14px;font-family:sans-serif">${POSTS.map((p) => `<div><img src="${u(postFile(p))}" style="width:100%;display:block;border-radius:6px"><div style="color:#fff;font:700 20px sans-serif;margin-top:8px">${dow(p.date)} · 3:00 pm</div><div style="color:#bbb;font:16px sans-serif">${esc(p.head)}</div></div>`).join('')}</body>`);
shot(join(TMP, 'sheet.html'), join(HERE, 'contact-sheet.png'), 1600, 1150);
writeFileSync(join(TMP, 'sets.html'), `<!doctype html><body style="margin:0;background:#1e1e1e;padding:14px;font-family:sans-serif">${SETS_DATA.map((s) => `<div style="color:#fff;font:700 22px sans-serif;margin:6px 0 8px">${dow(s.date)} · 2:00 pm · ${esc(s.title)}</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">${s.images.map((_, i) => `<img src="${u(setFile(s, i))}" style="width:100%;display:block;border-radius:4px">`).join('')}</div>`).join('')}</body>`);
shot(join(TMP, 'sets.html'), join(HERE, 'contact-sheet-photosets.png'), 1600, 1420);

/* manifest.json (for the posting calendar) and posts.md, from the same data */
const rel = (f) => f.slice(HERE.length + 1).replace(/\\/g, '/');
const kind = (p) => (p.job ? `Real 365 job photo (${p.job[0]} job, file ${p.job[1]}), cropped; stays local, gitignored`
  : !p.card.band ? 'Designed 365 card: text and simple shapes, no photo'
  : `Designed 365 card with a band of a real job photo (${p.card.band.kara ? `Kara's job, ${p.card.band.kara}` : `${p.card.band.job} job, file ${p.card.band.file}`}); stays local, gitignored`);
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const onIt = (p) => (p.card ? [p.card.sub && `line "${strip(p.card.sub)}"`, ...(p.card.rows || []).map(([k, d], i) => `${i + 1}. "${k}" (${d})`),
  p.card.note && `note "${p.card.note[0]}: ${p.card.note[1]}"`, `footer "${p.card.src}"`].filter(Boolean).join(', ') : `line "${p.sub}"`);
const manifest = [
  ...POSTS.map((p) => ({ brand: 'sixfold', type: 'post', date: p.date, time: '15:00', targets: ['fb', 'ig'], image: LIVE(rel(postFile(p))), fb_caption: p.fb, ig_caption: p.ig,
    note: `${p.kicker}: ${p.head} ${kind(p)}. No generated imagery. ${p.seasonal} DRAFT: needs Matthew's go.` })),
  ...SETS_DATA.map((s) => ({ brand: 'sixfold', type: 'photoset', date: s.date, time: '14:00', targets: ['fb', 'ig'], images: s.images.map((_, i) => LIVE(rel(setFile(s, i)))), fb_caption: s.fb, ig_caption: s.ig,
    note: `Saturday photo day: ${s.title}. ${s.images.length} real job photos (Facebook album + Instagram carousel), cropped and re-saved without EXIF/GPS; stay local, gitignored. DRAFT: needs Matthew's go.` })),
].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const quote = (t) => t.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');
const md = [`# 365 Aeration & Seeding: November 2026 posts (DRAFT, nothing posted or scheduled)`, '',
  `For the Sixfold 365 Facebook page and @365aeration Instagram. Built 2026-10-31. **Every post needs Matthew's go in the posting calendar; approval for one is not approval for the next.**`, '',
  `- Designed posts: Tue/Thu 3:00 pm Mountain, 1080 x 1350, in \`posts/\`. Photo sets: Saturdays 2:00 pm Mountain, 4 photos each at 1440 x 1080, in \`photosets/\`.`,
  `- Rebuild: \`node build-november.mjs\` (no generated imagery: real job photos and designed cards only, Matthew 31 Oct). This file and \`manifest.json\` are written by the script: edit captions there, not here.`,
  `- Posts that hold a job photo (full photo or a card band), the photo sets and the contact sheets stay local (gitignored). Contact sheets: \`contact-sheet.png\` (the 8 posts) and \`contact-sheet-photosets.png\`.`,
  `- Fact-check log: [FACT-CHECK.md](FACT-CHECK.md).`, '',
  ...POSTS.flatMap((p) => [`## ${dow(p.date)}, 3:00 pm: ${p.head}`, '',
    `**Picture:** \`posts/${p.date}-${p.slug}.png\`. ${kind(p)}. On it: kicker "${p.kicker}", headline "${p.head}", ${onIt(p)}, ${PHONE}, 365 badge.`,
    `**Season:** ${p.seasonal}`, '', '**Facebook**', '', quote(p.fb), '', '**Instagram**', '', quote(p.ig), '',
    `**Sources:** ${p.sources.join('; ')}.`, '', `**Why:** ${p.why}`, '']),
  ...SETS_DATA.flatMap((s) => [`## ${dow(s.date)}, 2:00 pm: photo set, ${s.title}`, '',
    '**Photos** (Facebook album + Instagram carousel, in this order):', '',
    ...s.images.map(([job, file, crop, what], i) => `${i + 1}. \`photosets/${s.date}/${s.date}-${i + 1}.jpg\`: ${job} job, ${file}. ${what}.${crop ? '' : ' Whole frame.'}`), '',
    '**Facebook**', '', quote(s.fb), '', '**Instagram**', '', quote(s.ig), '']),
].join('\n');
writeFileSync(join(HERE, 'posts.md'), md);
console.log('manifest.json, posts.md, contact sheets written');

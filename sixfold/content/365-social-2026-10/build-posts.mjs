/* 365 Aeration & Seeding: six single-image posts for Facebook and Instagram (2026-10-22, Matthew: "go ahead and produce those images ...
   avoid carousels for now"). Each post = a Gemini picture (shared/tools/make-image.mjs) under our own text panel in the 365 colours and
   fonts (forest green #2F5D2C, cream #FFF8EC, sun gold #F2C14E; Outfit and DM Sans), with the 365 badge, rendered by headless Chrome at
   1080 x 1350. Facts on the posts are only the ones sourced in sixfold/marketing/aeration-ad-kit-2026-09.md (CSU PlantTalk 1505, UMass
   Extension, CSU 7.241). The new 365 · Sixfold badge (Matthew's call, 22 Oct) and the 365 phone. Pictures have no people and no results.
     node build-posts.mjs [--only 3] [--reuse]      (--reuse keeps pictures already made and only re-renders the layout)              */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { makeImage } from '../../../shared/tools/make-image.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), PIC = join(HERE, 'pictures'), OUT = join(HERE, 'posts'), TMP = join(HERE, '.render');
for (const d of [PIC, OUT, TMP]) mkdirSync(d, { recursive: true });
const FONTS = pathToFileURL(join(HERE, '../../brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack/Fonts')).href;
const BADGE = pathToFileURL(join(HERE, '../../brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack/Full colour/365-Badge-A-Green.svg')).href;   /* the new 365 · Sixfold badge (Matthew 2026-10-22: "use the new logos") */
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = '(720) 830-4553';
const NOPEOPLE = ' No people, no hands, no text, no letters, no signs, no logos, no watermark. Natural, realistic colours; not oversaturated.';
const POSTS = [
  { n: 1, slug: 'fall-window', kicker: 'Fall lawn care', head: 'Spring and fall are the windows for aeration.', sub: 'Core aeration works best while the grass is growing and the ground isn\u2019t frozen or baked hard.',
    prompt: 'Photograph of a healthy green residential front lawn in Colorado in autumn, golden afternoon light, a few yellow cottonwood leaves on the grass, a modest suburban house softly out of focus, foothills on the horizon, low camera angle with the lawn filling the lower half.' },
  { n: 2, slug: 'what-plugs', kicker: 'What are all those plugs?', head: 'They\u2019re meant to stay.', sub: 'Hollow tines pull cores 2\u20133 inches deep. They look untidy for a couple of weeks, then break down back into the lawn.',
    prompt: 'Macro photograph at grass level of several cylindrical soil cores (about 3 inches long) lying on a green lawn after core aeration, one open aeration hole visible in the foreground, soft morning light, shallow depth of field.' },
  { n: 3, slug: 'water-before', kicker: 'Before we come', head: 'Water a couple of days before.', sub: 'Dry, hard ground won\u2019t give up a deep plug. A good soak two days ahead makes a real difference.',
    prompt: 'Photograph of a lawn sprinkler watering a residential green lawn in early evening, fine water spray catching warm backlight, droplets visible, Colorado suburban backyard with a wooden fence, lawn in the lower half of the frame.' },
  { n: 4, slug: 'brown-patch', kicker: 'Why one patch goes brown first', head: 'Compacted soil sheds water.', sub: 'Instead of soaking in, water runs off hard ground. Aeration opens it up so water and fertilizer reach the roots.',
    prompt: 'Photograph of a residential lawn after watering where water is pooling on a compacted, slightly thin area near a sidewalk edge, the rest of the lawn green, overcast soft light, ground-level view, realistic and ordinary, not dramatic.' },
  { n: 5, slug: 'seed-in-holes', kicker: 'Aeration + overseeding', head: 'Seed goes down while the holes are open.', sub: 'We overseed right after aerating, so the seed lands in good contact with the soil.',
    prompt: 'Macro photograph of grass seed scattered on a lawn among small open aeration holes and soil cores, seeds resting in and around the holes, early morning light, shallow depth of field.' },
  { n: 6, slug: 'book-now', kicker: 'Denver metro', head: 'Book your aeration and overseeding.', sub: 'Core aeration and overseeding for homes across the Denver metro. Call or text for a free quote.',
    prompt: 'Photograph of an attractive, ordinary Denver-area suburban home with a green front lawn in autumn, a few trees turning gold and orange, clear blue sky, the lawn prominent in the foreground, eye-level view from the sidewalk.' },
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function page(p, picUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Outfit; src: url('${FONTS}/Outfit.ttf'); font-weight: 100 900; }
  @font-face { font-family: DMSans; src: url('${FONTS}/DMSans.ttf'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #2F5D2C; }
  .pic { position: absolute; inset: 0 0 auto 0; height: 900px; background: url('${picUrl}') center/cover; }
  .fade { position: absolute; left: 0; right: 0; top: 700px; height: 220px; background: linear-gradient(to bottom, rgba(47,93,44,0), #2F5D2C 92%); }
  .badge { position: absolute; top: 40px; left: 40px; width: 176px; height: 176px; filter: drop-shadow(0 6px 18px rgba(0,0,0,.35)); }
  .badge img { width: 100%; height: 100%; }
  .panel { position: absolute; left: 0; right: 0; bottom: 0; height: 520px; padding: 0 76px 56px; display: flex; flex-direction: column; justify-content: flex-end; color: #FFF8EC; }
  .kicker { font: 700 30px DMSans, sans-serif; color: #F2C14E; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 16px; }
  h1 { font: 800 ${p.head.length > 36 ? 70 : 80}px/1.02 Outfit, sans-serif; letter-spacing: -.01em; margin-bottom: 22px; }
  .sub { font: 500 34px/1.38 DMSans, sans-serif; color: #F1EADB; max-width: 900px; }
  .foot { margin-top: 34px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; font: 700 30px DMSans, sans-serif; }
  .foot b { font: 800 40px Outfit, sans-serif; color: #F2C14E; }
</style></head><body>
  <div class="pic"></div><div class="fade"></div>
  <div class="badge"><img src="${BADGE}" alt=""></div>
  <div class="panel"><div class="kicker">${esc(p.kicker)}</div><h1>${esc(p.head)}</h1><div class="sub">${esc(p.sub)}</div>
    <div class="foot"><span>Free quote · call or text</span><b>${PHONE}</b></div></div>
</body></html>`;
}
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? +process.argv[i + 1] : 0; })(), reuse = process.argv.includes('--reuse');
for (const p of POSTS) {
  if (only && p.n !== only) continue;
  const pic = join(PIC, `${p.n}-${p.slug}.jpg`);
  if (!reuse || !existsSync(pic)) { const r = await makeImage({ prompt: p.prompt + NOPEOPLE, out: pic, aspect: '3:4' }); console.log(`picture ${p.n}: ${r.secs}s, ${r.imageTokens} image tokens`); }
  const html = join(TMP, `${p.n}.html`); writeFileSync(html, page(p, pathToFileURL(pic).href));
  const png = join(OUT, `365-post-${p.n}-${p.slug}.png`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', `--screenshot=${png}`, '--default-background-color=00000000', '--virtual-time-budget=4000', pathToFileURL(html).href], { stdio: 'ignore' });
  console.log(`post ${p.n}: ${png}`);
}

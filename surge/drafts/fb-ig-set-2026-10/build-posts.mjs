/* Surge: six single-image posts for Facebook and Instagram (2026-10-22, Matthew: "Can we do the same thing for surge ... use some of the
   photos we have, nothing that show brands or working at a booth"). Same layout idea as the 365 set: a real photo from brand/photos/ over
   a text panel, rendered by headless Chrome at 1080 x 1350. Surge look: #0a0a0a ground, brand green #4abe4a, Anton + Archivo and the
   wordmark mask from drafts/visual-set-2026-09-14/. Every photo is a YES row in brand/photos/photos-notes.md with no client mark, no booth,
   no legible board. Copy follows brand-voice-company.md (§4 confidence, §5 no vibes / no earnings / no scale) and RESTRICTED.md.
     node build-posts.mjs [--only 3]                                                                                                   */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'posts'), TMP = join(HERE, '.render');
for (const d of [OUT, TMP]) mkdirSync(d, { recursive: true });
const PHOTOS = join(HERE, '../../brand/photos');
const KIT = pathToFileURL(join(HERE, '../visual-set-2026-09-14')).href;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = '(720) 719-5495';
const CALL = { left: 'Talk to us', right: PHONE }, APPLY = { left: 'Apply online', right: 'surgeftw.com/careers' };
const POSTS = [
  { n: 1, slug: 'we-run-your-team', photo: 'Culture/D4327668-DC8B-4DCC-9DE0-327C421F0BBA.webp', pos: '50% 55%', foot: CALL,
    kicker: 'Outsourced sales & marketing', head: 'We build and run your sales team.', sub: 'Hiring, onboarding, training and day-to-day management, handled. You focus on the business.' },
  { n: 2, slug: 'field-channels', photo: 'Office and work/IMG_7768.jpg', pos: '50% 18%', foot: CALL,
    kicker: 'Field sales', head: 'Door to door. Phones. Events.', sub: 'Trained reps in front of your customers, for clients in multiple states.' },
  { n: 3, slug: 'training-first', photo: 'Office and work/IMG_7636.jpg', pos: '50% 55%', foot: CALL,
    kicker: 'How we train', head: 'Every day starts with training.', sub: 'A subject is taught first, then drilled in pairs before anyone heads out.' },
  { n: 4, slug: 'rehearse', photo: 'Office and work/IMG_7733.jpg', pos: '50% 62%', foot: CALL,
    kicker: 'Practice', head: 'We rehearse before we sell.', sub: 'Pitches, objections and closing, practised in pairs with a trainer watching.' },
  { n: 5, slug: 'day-one-last', photo: 'Office and work/IMG_7637.jpg', pos: '50% 45%', foot: APPLY,
    kicker: 'Who teaches day one', head: 'Day one is the last thing a trainer earns.', sub: 'Trainers start by teaching week two and work backwards. The first day is the hardest to teach.' },
  { n: 6, slug: 'now-hiring', photo: 'Team/IMG_0505-scaled.png', pos: '50% 50%', foot: APPLY,
    kicker: 'Now hiring', head: 'Learn sales from people who\u2019ve done it.', sub: 'Coaching every morning, trainers who started as reps, and a clear path from rep to trainer.' },
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function page(p) {
  const pic = pathToFileURL(join(PHOTOS, p.photo)).href;
  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="${KIT}/_fonts.css"><link rel="stylesheet" href="${KIT}/_logo.css"><style>
  * { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #0a0a0a; }
  .pic { position: absolute; inset: 0 0 auto 0; height: 880px; background: url('${pic}') ${p.pos}/cover; }
  .fade { position: absolute; left: 0; right: 0; top: 660px; height: 240px; background: linear-gradient(to bottom, rgba(10,10,10,0), #0a0a0a 92%); }
  .mark { position: absolute; top: 44px; left: 44px; padding: 22px 26px; background: rgba(10,10,10,.72); border-radius: 6px; }
  .mark .wordmark { width: 190px; height: 52px; background: #fff; }
  .panel { position: absolute; left: 0; right: 0; bottom: 0; height: 560px; padding: 0 76px 56px; display: flex; flex-direction: column; justify-content: flex-end; color: #f5f5f5; }
  .kicker { font: 700 28px Archivo, sans-serif; color: #4abe4a; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 18px; }
  h1 { font: 400 ${p.head.length > 34 ? 78 : 92}px/1.0 Anton, 'Bahnschrift Condensed', sans-serif; text-transform: uppercase; letter-spacing: .005em; margin-bottom: 24px; }
  .sub { font: 500 33px/1.38 Archivo, sans-serif; color: #cfd3d0; max-width: 910px; }
  .foot { margin-top: 34px; display: flex; justify-content: space-between; align-items: center; border-top: 3px solid #4abe4a; padding-top: 22px; font: 600 30px Archivo, sans-serif; }
  .foot b { font: 400 44px Anton, sans-serif; color: #4abe4a; letter-spacing: .02em; }
</style></head><body>
  <div class="pic"></div><div class="fade"></div>
  <div class="mark"><i class="wordmark"></i></div>
  <div class="panel"><div class="kicker">${esc(p.kicker)}</div><h1>${esc(p.head)}</h1><div class="sub">${esc(p.sub)}</div>
    <div class="foot"><span>${esc(p.foot.left)}</span><b>${esc(p.foot.right)}</b></div></div>
</body></html>`;
}
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? +process.argv[i + 1] : 0; })();
for (const p of POSTS) {
  if (only && p.n !== only) continue;
  const html = join(TMP, `${p.n}.html`); writeFileSync(html, page(p));
  const png = join(OUT, `surge-post-${p.n}-${p.slug}.png`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', `--screenshot=${png}`, '--virtual-time-budget=5000', pathToFileURL(html).href], { stdio: 'ignore' });
  console.log(`post ${p.n}: ${png}`);
}

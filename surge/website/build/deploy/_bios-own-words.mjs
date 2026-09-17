/* One-off, 2026-09-17: put every bio back in the person's OWN words, first person,
   exactly as recovered from the old surgeftw.com Company page
   (website/wp-restore/recovered-copy/company-team.md). Matthew: "I would rather have
   what they wrote up there rather than what I wrote … it's not my place to speak for
   them and talk about what they do in the third person as if I am saying it."
   So: the third-person role line (added 09-15) comes out, the rewrite comes out,
   contractions stay (their voice), the separate favourite-quote field stays off, and
   the two money lines the 09-14 swap cut are back because they wrote them — flagged
   for his rounds. Brandon gets his holiday answer, the only thing the old site had
   from him. Matthew's own bio is untouched (no old-site bio existed).
   Writes both the roster JSON in team/index.html and each person page. Run once. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const SITE = dirname(dirname(fileURLToPath(import.meta.url)));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/—/g, '&mdash;').replace(/’/g, '&rsquo;').replace(/'/g, '&rsquo;').replace(/“/g, '&ldquo;').replace(/”/g, '&rdquo;').replace(/…/g, '&hellip;');
const P = (...paras) => paras.map(p => `<p>${esc(p)}</p>`).join('');

const BIOS = {
  'brandon-long': P(
    'If you could invent a holiday, what would it be and how is it celebrated?',
    '“The Off Grid Day. When a new phone comes out, the following day there would be no way of getting technology or internet… a technology detox.”'),
  'ryan-conger': P(
    'I bring clarity and direction. I take what feels chaotic and simplify it into something the team can actually execute on. Progress and ownership drive me, and I want to build enough that my wife gets to choose whether she works out of want, not necessity.',
    'Beneath the numbers focus, I think deeply about psychology, behavior, and human potential. I also love ancient alien conspiracy theories.'),
  'jon-wallace': P(
    'I know when to keep things light and when to lock in — and I bring solid dad jokes either way. I’m driven by watching people grow and helping them take control of their skills and income.',
    'Fair warning: I can freestyle rap, and most people don’t see that coming.'),
  'nneka-smith': P(
    'Connecting with people is genuinely my superpower and honestly my favorite part of the job! I’m driven by being a positive influence and leaving people better than I found them. Being remembered for kindness is something I truly care about.',
    'On the financial side, I’m all about making my money work for me and not the other way around.',
    'I am also a full-blown musical theater lover. The musical life chose me and I am not fighting it!'),
  'paige-bennett': P(
    'I’m driven by living life to the fullest and pouring that energy into the people around me every day. I’m big on growth, whether that’s personally or professionally.',
    'Each opportunity is a step in the right direction toward my ultimate goals, so I am thankful to be here.'),
  'lance-axon': P(
    'I bring foresight. I’m always operating from a 5,000-foot view, thinking strategically and positioning the team for what’s coming next. My family and new experiences drive me, whether that’s traveling, trying new foods, or stepping into something unfamiliar.',
    'Right now I’m focused on building strong pillars — financially, with family, and in my community — to set up the next 5 to 10 years right.',
    'Most people don’t know I can really cook; with a culinary chef for a sister, I’ve been around it my whole life and I take pride in throwing it down in the kitchen.'),
  'maya-ogea': P(
    'I bring strong people skills and initiative, and I enjoy building real connections with others. I’m driven by growth and always looking to create new opportunities.',
    'Right now, I’m working to build a music management company and recording studio.'),
  'myles-zoutte': P(
    'I bring versatility to everything I do, but my people are what truly drive me. Showing up for them, being my best, and providing in every way I can.',
    'I grew up riding four-wheelers fast (really fast), so the need for speed has always been part of me… which is probably why my next goal is buying my first McLaren within three years.'),
  'cai-silva': P(
    'I’m passionate about hands-on learning. I care about the insight that comes from the process, not just the end result. My parents are my biggest source of inspiration, and they push me to strive for a better quality of life every day.',
    'I’m working toward building and owning a homestead as part of a more intentional way of living. Also, I trained in ballet, tap, and jazz for over five years.'),
};

// 1. roster JSON — parse, replace, re-serialise ONLY the bio strings by string
//    surgery so the rest of the JSON's escaping is untouched.
const rosterPath = join(SITE, 'team', 'index.html');
let roster = readFileSync(rosterPath, 'utf8');
const m = roster.match(/<script id="team-data" type="application\/json">([\s\S]*?)<\/script>/);
const data = JSON.parse(m[1]);
let changed = 0;
for (const [slug, bio] of Object.entries(BIOS)) {
  if (!data[slug]) throw new Error('no roster entry ' + slug);
  const oldJson = JSON.stringify(data[slug].bio);
  const newJson = JSON.stringify(bio);
  if (roster.split(oldJson).length !== 2) throw new Error('bio JSON not unique for ' + slug);
  roster = roster.replace(oldJson, () => newJson);
  changed++;
}
writeFileSync(rosterPath, roster);

// 2. each person page: replace the <p>…</p> run inside .person-bio, before the back link
let pages = 0;
for (const [slug, bio] of Object.entries(BIOS)) {
  const p = join(SITE, 'team', slug, 'index.html');
  let h = readFileSync(p, 'utf8');
  const re = /(<div class="wrap narrow person-bio">\s*)([\s\S]*?)(\s*<p class="small" style="margin-top:1\.6rem">)/;
  if (!re.test(h)) throw new Error('bio block not found on ' + slug);
  h = h.replace(re, (_, a, _old, c) => a + bio.replace(/<\/p><p>/g, '</p>\n    <p>') + c);
  writeFileSync(p, h);
  pages++;
}
console.log(`roster bios replaced: ${changed}; person pages rewritten: ${pages}; untouched: matthew-sharpe`);

/* Peak socials, last 30 days (Tyler-facing, 3 pages) and the internal talking points (1 page).
   Same look as ../audit-2026-10-22/build-2page.mjs. Every figure is from ../report.md, ../posts-30d.csv and ../inventory-2026-11-13.csv
   (captured logged out 13 Nov 2026). Writes peak-socials-30d.html and talking-points.html; print with tools/print.mjs.
     node tools/build-pdf.mjs                                                                                                  */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = { peak: '#2a78d6', springs: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a8984', grid: '#e6e5e0', surface: '#fcfcfb',
  good: '#0ca30c', warn: '#fab219', serious: '#ec835a', critical: '#d03b3b', other: '#9bbfe9' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 9}" fill="${o.fill || C.ink2}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const hbar = (x, y, w, h, fill) => { if (w <= 0) return ''; const r = Math.min(4, w, h / 2); return `<path d="M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z" fill="${fill}"/>`; };
const vbar = (x, y0, w, h, fill) => { if (h <= 0) return ''; const r = Math.min(3, h, w / 2), y = y0 - h; return `<path d="M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z" fill="${fill}"/>`; };

/* A. 31-day posting strip: Instagram posts per day, veterans/tournament vs other topics */
function calendarChart() {
  // day index 0 = 14 Oct ... 30 = 13 Nov. [index, veterans-topic count, other count]
  const days = { 7: [0, 1], 8: [1, 0], 12: [1, 0], 15: [0, 1], 23: [1, 0], 24: [1, 0], 25: [3, 0], 27: [2, 0], 28: [1, 0] };
  const W = 690, L = 26, R = 8, top = 16, H = 64, base = top + H, n = 31, cw = (W - L - R) / n, sy = (v) => H * v / 3;
  let s = `<svg viewBox="0 0 ${W} ${base + 30}" width="100%" role="img" aria-label="Instagram posts per day, 14 October to 13 November 2026">`;
  for (const v of [0, 1, 2, 3]) s += `<line x1="${L}" x2="${W - R}" y1="${base - sy(v)}" y2="${base - sy(v)}" stroke="${C.grid}"/>` + t(L - 5, base - sy(v) + 3, v, { anchor: 'end', size: 8, fill: C.muted });
  const gap = (a, b, label) => `<rect x="${L + a * cw}" y="${top}" width="${(b - a + 1) * cw}" height="${H}" fill="#f6e9e4"/>` + t(L + (a + b + 1) / 2 * cw, top + 14, label, { anchor: 'middle', size: 8.6, fill: '#9a3a1a', weight: 600 });
  s += gap(0, 6, 'No posts, 14–20 Oct') + gap(16, 22, 'No posts, 30 Oct–5 Nov') + gap(29, 30, 'None');
  for (const [i, [v, o]] of Object.entries(days)) {
    const x = L + (+i) * cw + cw * 0.18, w = cw * 0.64;
    s += vbar(x, base, w, sy(v), C.peak);
    if (o) s += `<rect x="${x}" y="${base - sy(v) - sy(o)}" width="${w}" height="${sy(o)}" rx="2" fill="${C.springs}"/>`;
  }
  const labels = [[0, '14 Oct'], [7, '21 Oct'], [14, '28 Oct'], [21, '4 Nov'], [28, '11 Nov'], [30, '13']];
  for (const [i, l] of labels) s += t(L + (i + 0.5) * cw, base + 11, l, { anchor: 'middle', size: 7.8, fill: C.muted });
  s += t(L + 25.5 * cw, base + 23, 'Veterans Tournament, 6–8 Nov', { anchor: 'middle', size: 7.8, fill: C.ink2 });
  s += `<line x1="${L + 23 * cw}" x2="${L + 26 * cw}" y1="${base + 15}" y2="${base + 15}" stroke="${C.ink2}"/>`;
  return s + '</svg>';
}
/* B. topic mix against Peak's own goals */
function topicChart() {
  const rows = [['Veterans: tournament, programme, holiday', 10, C.peak], ['Membership offer (no price, no link)', 1, C.peak], ['Halloween social', 1, C.peak],
    ['Free Learn to Play class', 0], ['Paid classes (101/102, clinics)', 0], ['Open Play times / quiet slots', 0], ['Leagues', 0], ['Sponsors', 0], ['Pro shop', 0], ['April expo', 0]];
  const W = 330, L = 170, R = 22, top = 4, bh = 10, gap = 5, max = 10, sx = (v) => L + v / max * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${top + rows.length * (bh + gap) + 4}" width="100%" role="img" aria-label="Instagram posts by topic, 14 October to 13 November">`;
  rows.forEach(([name, v, col], i) => {
    const y = top + i * (bh + gap);
    s += t(L - 6, y + bh - 1.5, name, { anchor: 'end', size: 8.2, fill: v ? C.ink : C.ink2 });
    if (v) s += hbar(L, y, sx(v) - L, bh, col) + t(sx(v) + 4, y + bh - 1.5, v, { size: 8.4, fill: C.ink, weight: 700 });
    else s += `<line x1="${L}" x2="${L}" y1="${y}" y2="${y + bh}" stroke="${C.critical}" stroke-width="2"/>` + t(L + 5, y + bh - 1.5, '0', { size: 8.4, fill: C.critical, weight: 700 });
  });
  return s + '</svg>';
}
/* C. likes per Instagram post and reactions per Facebook post, in date order */
function likesChart() {
  const posts = [['21 Oct', 8, 5, 'Flex offer'], ['22 Oct', 7, 10], ['26 Oct', 31, 28, 'Veterans reel'], ['29 Oct', 10, 9], ['6 Nov', 29, 10], ['7 Nov', 22, 11], ['8 Nov', 20, 13], ['8 Nov', 16, 17], ['8 Nov', 18, 15], ['10 Nov', 9, 12], ['10 Nov', 10, null], ['11 Nov', 3, 8, 'Veterans Day']];
  const W = 330, L = 22, R = 6, top = 10, H = 92, base = top + H, sy = (v) => H * v / 35, slot = (W - L - R) / posts.length;
  let s = `<svg viewBox="0 0 ${W} ${base + 22}" width="100%" role="img" aria-label="Likes per Instagram post and reactions per Facebook post">`;
  for (const v of [0, 10, 20, 30]) s += `<line x1="${L}" x2="${W - R}" y1="${base - sy(v)}" y2="${base - sy(v)}" stroke="${C.grid}"/>` + t(L - 4, base - sy(v) + 3, v, { anchor: 'end', size: 7.5, fill: C.muted });
  posts.forEach(([d, ig, fb, lab], i) => {
    const x = L + i * slot + slot * 0.12, w = slot * 0.36;
    s += vbar(x, base, w, sy(ig), C.peak);
    if (fb != null) s += vbar(x + w + 1, base, w, sy(fb), C.other);
    if (lab) s += t(i === 0 ? x : i > 8 ? x + 2 * w + 1 : x + w, base - sy(Math.max(ig, fb || 0, i === 0 || i === 11 ? 17 : 0)) - 3, lab, { anchor: i === 0 ? 'start' : i > 8 ? 'end' : 'middle', size: 7.4, fill: C.ink, weight: 600 });
    if (i === 0 || posts[i - 1][0] !== d) s += t(x + w, base + 10, d, { anchor: 'middle', size: 7, fill: C.muted });
  });
  return s + '</svg>';
}
/* D. Instagram followers, Peak vs Springs Pickleball, 22 Oct and 13 Nov */
function growthChart() {
  const rows = [['Peak, 22 Oct', 918, C.peak], ['Peak, 13 Nov', 943, C.peak], ['Springs, 22 Oct', 803, C.springs], ['Springs, 13 Nov', 1193, C.springs]];
  const W = 330, L = 80, R = 70, top = 4, bh = 12, gap = 6, max = 1200, sx = (v) => L + v / max * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${top + rows.length * (bh + gap) + 2}" width="100%" role="img" aria-label="Instagram followers, Peak and Springs Pickleball">`;
  rows.forEach(([name, v, col], i) => {
    const y = top + i * (bh + gap) + (i >= 2 ? 4 : 0);
    s += t(L - 6, y + bh - 2, name, { anchor: 'end', size: 8.4, fill: C.ink });
    s += hbar(L, y, sx(v) - L, bh, col) + t(sx(v) + 4, y + bh - 2, v.toLocaleString('en-US') + (i === 1 ? '  (+25)' : i === 3 ? '  (+390)' : ''), { size: 8.4, fill: C.ink, weight: 600 });
  });
  return s + '</svg>';
}

const css = `
  @page { size: Letter; margin: 0.4in 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.3pt/1.34 "Segoe UI", Arial, sans-serif; color: ${C.ink}; background: #fff; }
  .page { height: 10.15in; display: flex; flex-direction: column; break-after: page; overflow: hidden; }
  .page:last-child { break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${C.peak}; padding-bottom: 5px; }
  h1 { font-size: 18.5pt; margin: 0; letter-spacing: -0.01em; } .by { font-size: 8.4pt; color: ${C.ink2}; text-align: right; }
  .lead { margin: 7px 0 8px; font-size: 10.3pt; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 9px; }
  .k { border: 1px solid ${C.grid}; border-radius: 7px; padding: 5px 8px; } .k b { display: block; font-size: 15pt; line-height: 1.1; } .k span { font-size: 7.8pt; color: ${C.ink2}; }
  .k.bad b { color: ${C.critical}; } .k.good b { color: ${C.good}; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px; }
  .card { border: 1px solid ${C.grid}; border-radius: 8px; padding: 7px 9px 6px; background: ${C.surface}; }
  h2 { font-size: 11pt; margin: 0 0 1px; } .sub { font-size: 8pt; color: ${C.ink2}; margin: 0 0 4px; }
  h3 { font-size: 10.6pt; margin: 7px 0 4px; color: #0b5ba8; border-bottom: 1px solid ${C.grid}; padding-bottom: 2px; }
  ul.f, ol.f { margin: 0; padding-left: 15px; } .f li { margin: 0 0 3.5px; }
  .legend { display: flex; gap: 12px; font-size: 7.8pt; color: ${C.ink2}; margin: 0 0 3px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 8.5pt; } th, td { text-align: left; padding: 2.6px 5px; border-bottom: 1px solid ${C.grid}; vertical-align: top; }
  th { font-size: 7.8pt; color: ${C.ink2}; font-weight: 600; } td.n, th.n { text-align: right; white-space: nowrap; } tr.tot td { font-weight: 700; border-top: 1.5px solid ${C.ink2}; }
  .note { font-size: 8pt; color: ${C.ink2}; }
  .box { border: 1px solid #cfe0f3; background: #f3f8fd; border-radius: 8px; padding: 7px 10px; }
  .foot { margin-top: auto; font-size: 7.3pt; color: ${C.muted}; padding-top: 5px; border-top: 1px solid ${C.grid}; } .pg { float: right; }
  .two { columns: 2; column-gap: 18px; } .two li { break-inside: avoid; }
`;
const foot = (n, of) => `<div class="foot">Sources: Peak's public Instagram, Facebook, Threads, LinkedIn, TikTok, YouTube, Google Maps, Nextdoor, Paage and CourtReserve pages, read logged out on 13 Nov 2026, compared with our 22 Oct audit. Counts change daily. Peak's own goals from the 2 Nov meeting, the 4 Nov CourtReserve baseline and Tyler's 11 Nov answers.<span class="pg">${n} / ${of}</span></div>`;

const tyler = `<!doctype html><html><head><meta charset="utf-8"><title>Peak socials, last 30 days</title><style>${css}</style></head><body>
<div class="page">
  <div class="top"><h1>Peak socials, last 30 days</h1><div class="by">14 October – 13 November 2026<br>Prepared by Matthew Sharpe</div></div>
  <p class="lead">When something big happens in the building, Peak's socials cover it well: the Veterans Tournament got 23 posts across Instagram, Facebook and Threads. Between events they go quiet, and almost nothing points people to what Peak most needs filled: the free class, paid classes, Open Play in quiet hours, memberships and sponsors.</p>
  <div class="kpis">
    <div class="k"><b>12</b><span>posts in 31 days (Instagram; most copied to Facebook and Threads)</span></div>
    <div class="k bad"><b>9 of 31</b><span>days had a post; 8 of the 12 came in one week</span></div>
    <div class="k bad"><b>0</b><span>posts with a booking or sign-up link</span></div>
    <div class="k bad"><b>0</b><span>posts on classes, Open Play, leagues or sponsors</span></div>
    <div class="k bad"><b>+25 vs +390</b><span>new Instagram followers since 22 Oct: Peak vs Springs Pickleball</span></div>
  </div>
  <div class="card" style="margin-bottom:8px"><h2>Bursts, then silence</h2><p class="sub">Instagram posts per day. Two full weeks had no posts, including the week before tournament registration closed (2 Nov).</p>
    <div class="legend"><span><i style="background:${C.peak}"></i>Veterans: tournament, programme, Veterans Day</span><span><i style="background:${C.springs}"></i>Other topics</span></div>${calendarChart()}</div>
  <div class="row">
    <div class="card"><h2>What was posted vs what Peak needs</h2><p class="sub">Instagram posts by topic, 14 Oct – 13 Nov</p>${topicChart()}</div>
    <div class="card"><h2>Why the topics matter</h2><ul class="f" style="font-size:8.6pt">
      <li><b>Classes turn into members:</b> about 45% of free-class takers go on to a paid plan (Peak's figure, 11 Nov). The free class got <b>no posts</b>.</li>
      <li><b>Open Play has room:</b> half of Open Play sessions ran with 2 or fewer players over the last year (Peak's CourtReserve data). Quiet times got <b>no posts</b>.</li>
      <li><b>The one membership post</b> (Peak Flex, 21 Oct) had no price, no detail and no link, and drew the fewest Facebook reactions of the month (5).</li>
      <li><b>Sponsors and the April expo</b> need a visible, steady audience to sell to. Neither appeared, and LinkedIn, where sponsors look, has no posts.</li>
    </ul></div>
  </div>
  <h3>What is working</h3>
  <ul class="f two" style="font-size:8.8pt">
    <li><b>Real people, real moments.</b> The Give 'Em Heaven veterans reel (26 Oct) was the best post on both platforms: 31 likes on Instagram; 28 reactions, 7 shares and 1,500 plays on Facebook.</li>
    <li><b>Event coverage is thorough</b> when it happens: six Facebook posts over the tournament, with 18- and 8-photo albums.</li>
    <li><b>Partner content travels:</b> the two veterans posts were shared 15 times on Facebook.</li>
    <li><b>The right offer is in the bios:</b> "Start here → FREE Learn to Play Class".</li>
    <li><b>The audience is there:</b> earlier Peak reels reached 13,000, 4,100 and 3,700 plays when they promoted something or taught a tip.</li>
    <li><b>The reputation is strong:</b> 4.9 stars from 585 Google reviews; 100% recommend on Facebook. Instagram's name now includes "Peak".</li>
  </ul>
  ${foot(1, 3)}
</div>
<div class="page">
  <div class="row">
    <div class="card"><h2>Engagement per post</h2><p class="sub">Likes on each Instagram post (943 followers) and reactions on the same post on Facebook (1,820 followers)</p>
      <div class="legend"><span><i style="background:${C.peak}"></i>Instagram likes</span><span><i style="background:${C.other}"></i>Facebook reactions</span></div>${likesChart()}
      <p class="sub" style="margin-top:3px">Average 15 likes per Instagram post (1.6% of followers), down from 23 in early October; 12.5 reactions per Facebook post (0.7%). The three Facebook reels reached 820–1,500 plays.</p></div>
    <div class="card"><h2>Peak is being outgrown on Instagram</h2><p class="sub">Instagram followers, 22 Oct and 13 Nov</p>${growthChart()}
      <p class="sub" style="margin-top:5px">Springs Pickleball posted at least 20 times in those 22 days, to Peak's 10, and its November posts included things to sign up for: a Thanksgiving event, a kids' camp, the Winter Classic, league sign-ups, a member perk. Why it grew so fast is not visible from outside.</p></div>
  </div>
  <h3>The holes, most costly first</h3>
  <ol class="f" style="font-size:8.9pt">
    <li><b>Posts don't promote what fills courts and plans.</b> In 31 days: no posts on the free class, paid classes, Open Play times, leagues, sponsors, the pro shop or the April expo, and one membership post without a price.</li>
    <li><b>No next step.</b> None of the 12 posts has a booking or sign-up link, and Facebook posts, where a link works, carry none. The tournament link appeared once, as a comment. The link page in the Threads bio still leads with Mother's Day open play, Breakfast Club (May) and Wheelchair Nationals (June).</li>
    <li><b>No steady rhythm.</b> Two silent weeks; two-thirds of the month's posts in six days. The silent week was the run-up to the registration deadline.</li>
    <li><b>The local-discovery channels are idle.</b> Google Business Profile: no owner updates and no owner replies visible on 585 reviews. Facebook Events: none listed, not even the tournament or the Halloween social. The 970-member Peak Pickleball Group Page on Facebook: Peak's page last posted there on 9 Sep. LinkedIn: 99 followers, no posts.</li>
    <li><b>Comments go unanswered.</b> 10 member comments on Instagram and 9 on Facebook, with no reply from Peak visible on any of them. Messages and response times can't be seen from outside.</li>
    <li><b>Dead links in Peak's own systems.</b> CourtReserve's Instagram icon opens a profile that no longer exists (@peak.pickleballco). Facebook's About section links a TikTok with no video since May. YouTube has one video from about a year ago, Peak Golf's Instagram has 8 followers and no post since April, and Nextdoor is still unclaimed.</li>
    <li><b>The same post everywhere.</b> Facebook and Threads get word-for-word copies of the Instagram caption, hashtags included. One tournament reel never reached Facebook.</li>
    <li><b>Meta tags six recent posts "AI content",</b> visible to members. The cause can't be seen from outside; it is worth checking which app adds it.</li>
  </ol>
  <h3>What we can't see from outside, and need to measure results</h3>
  <ul class="f two" style="font-size:8.6pt">
    <li><b>Meta Business Suite</b> (90 days): reach, views, profile visits, link and bio taps, follower growth, top posts, Story views, message volume and response time.</li>
    <li><b>Google Business Profile performance:</b> searches, views, calls, website and "Book online" clicks, directions, reviews by month.</li>
    <li><b>Google Analytics:</b> visits arriving from Facebook, Instagram and the link page, and what those visitors did next.</li>
    <li><b>CourtReserve:</b> weekly registrations for the free class, the tournament and socials, so posts can be matched to sign-ups.</li>
  </ul>
  <div class="box" style="margin-top:8px"><h2>Quick fixes that cost nothing</h2><ul class="f two" style="font-size:8.6pt;margin-top:3px">
    <li>Point CourtReserve's Instagram icon to @peakpickleball.us.</li>
    <li>Replace the out-of-date buttons on the link page (Paage) with the free class, court booking and the next event.</li>
    <li>Add a booking or sign-up link to every Facebook post, and a "link in bio" line on Instagram.</li>
    <li>List each public event as a Facebook event.</li>
    <li>Remove the TikTok link from Facebook's About section, or start using TikTok.</li>
    <li>Claim the Nextdoor page and start replying to Google reviews.</li>
  </ul></div>
  ${foot(2, 3)}
</div>
<div class="page">
  <h3 style="margin-top:0">What running Peak's socials properly takes each week</h3>
  <p class="note" style="margin:0 0 5px"><b>Our estimate, built task by task. It is not an industry benchmark.</b> It assumes four planned posts a week aimed at Peak's goals (two of them reels), Stories five days a week, an event listing for each public event, a weekly Google update with replies to every review, a weekly LinkedIn post for sponsors, the Facebook group, daily replies to comments and messages, and a monthly report.</p>
  <table>
    <tr><th>Task</th><th>Assumption</th><th class="n">Hours / week</th></tr>
    <tr><td>Plan the week: calendar, check the CourtReserve schedule for quiet slots and upcoming events</td><td>weekly</td><td class="n">1.5</td></tr>
    <tr><td>Shoot on the floor: classes, open play, leagues, members</td><td>2 sessions × 1.5 h</td><td class="n">3.0</td></tr>
    <tr><td>Edit reels</td><td>2 × 1.25 h</td><td class="n">2.5</td></tr>
    <tr><td>Design graphics and carousels: offers, schedules, sponsor thank-yous</td><td>2 × 45 min</td><td class="n">1.5</td></tr>
    <tr><td>Captions with a call to action and link, written for each platform</td><td>4 × 20 min</td><td class="n">1.5</td></tr>
    <tr><td>Publish or schedule on Instagram, Facebook and Threads (plus YouTube Shorts if kept), then check</td><td>4 × ~20 min</td><td class="n">1.5</td></tr>
    <tr><td>Stories</td><td>5 × 15 min</td><td class="n">1.25</td></tr>
    <tr><td>Comments, messages, tags and group questions</td><td>~20 min a day</td><td class="n">2.3</td></tr>
    <tr><td>Google Business Profile: weekly update, review replies, questions</td><td>weekly</td><td class="n">0.75</td></tr>
    <tr><td>Facebook event listings</td><td>1 × 20 min</td><td class="n">0.3</td></tr>
    <tr><td>LinkedIn post for sponsors and corporate bookings</td><td>1 × 30 min</td><td class="n">0.5</td></tr>
    <tr><td>Facebook group post and moderation</td><td>weekly</td><td class="n">0.4</td></tr>
    <tr><td>Monthly report, link page and profile upkeep</td><td>2 h a month + 30 min a week</td><td class="n">1.0</td></tr>
    <tr class="tot"><td>Normal week</td><td></td><td class="n">about 18 (15–20)</td></tr>
    <tr><td>Event weekend (tournament, social night): shooting through the day, same-day posts, recap</td><td>per event</td><td class="n">+6 to 10</td></tr>
  </table>
  <div class="row" style="margin-top:9px">
    <div class="box"><h2>Set against the current set-up</h2><ul class="f" style="font-size:8.7pt;margin-top:3px">
      <li>As described to us on 2 Nov, social media sits inside one in-house role that also covers <b>video editing, photography and video at events and daily play, graphic design, and the pro shop</b> (banners, merch, shirts, logos), with a wish for more time out front with members.</li>
      <li>Social alone, done to the list above, is <b>close to half a full-time week</b>, before any of that role's other four jobs.</li>
      <li>The last 30 days fit that picture: strong coverage when an event is in the building, then no time left for planning, promotion, replies or the quieter channels. That is a capacity problem, not a talent one.</li>
    </ul></div>
    <div class="box"><h2>Questions for Tyler</h2><ol class="f" style="font-size:8.7pt;margin-top:3px">
      <li>Roughly how many hours a week go to social now, and what else does the same person cover?</li>
      <li>Who holds admin on each account, and who answers messages and Google reviews?</li>
      <li>Can we see the Meta, Google Business Profile, Analytics and CourtReserve figures listed on page 2?</li>
      <li>Which comes first for the socials: free-class sign-ups, Open Play in quiet hours, upgrades, sponsors or the April expo?</li>
      <li>Keep or close TikTok, YouTube, Peak Golf's Instagram and the link page?</li>
      <li>Is there any budget for boosting posts? None were running on 4 Nov.</li>
    </ol></div>
  </div>
  <p class="note" style="margin-top:7px">Not known, and not assumed here: the in-house team's hours, how they split between duties, and whether anyone else posts or answers messages. Counts are the public ones on 13 Nov; reach, clicks and messages need Peak's own account data.</p>
  ${foot(3, 3)}
</div>
</body></html>`;

const tp = `<!doctype html><html><head><meta charset="utf-8"><title>Talking points - Peak socials (internal)</title><style>${css}
  .page { height: 10.15in; } .tp li { margin-bottom: 4px; } h3 { margin-top: 8px; }</style></head><body>
<div class="page">
  <div class="top"><h1>Talking points: Peak socials</h1><div class="by">INTERNAL, for Matthew. Do not hand over.<br>13 November 2026</div></div>
  <h3>The one-line case</h3>
  <p style="margin:0">Peak covers its big events well and then goes quiet. Nothing on the feed sells the free class, Open Play's empty hours, memberships or sponsors, and it can't, because social is one of five jobs held by one person.</p>
  <h3>Lead with these numbers (all public, captured 13 Nov)</h3>
  <ul class="f tp">
    <li><b>12 posts in 31 days, 9 days with a post, 8 in one week</b> (6–11 Nov, the Veterans Tournament). Silent 14–20 Oct and 30 Oct–5 Nov.</li>
    <li><b>0 posts with a booking link; 0 on the free class, classes, Open Play, leagues, sponsors, pro shop or expo.</b> Their own numbers: 45% of free-class takers join (Tyler, 11 Nov); 51% of Open Play sessions had 2 or fewer (baseline).</li>
    <li><b>Springs Pickleball's Instagram went 803 → 1,193 (+390) while Peak went 918 → 943 (+25).</b> Springs passed Peak. Don't guess why. If asked: "we can't see their ad spend from outside".</li>
    <li><b>Best post:</b> the 26 Oct Give 'Em Heaven reel (28 reactions, 7 shares, 1.5K plays on Facebook). Earlier promo and tip reels hit 13K, 4.1K and 3.7K plays, so the audience exists.</li>
  </ul>
  <h3>Cammy: how to talk about it</h3>
  <ul class="f tp">
    <li>Per the 2 Nov notes she does social, video editing, photo and video, graphic design <b>and</b> the pro shop, enjoys the creative side, and wants more floor time. The PDF says "the in-house team" and never names her. Keep it that way out loud too.</li>
    <li>Frame: <b>take the planning, posting, replies, Google, LinkedIn and reporting off her plate; she keeps shooting and design if she wants them.</b> That matches what she asked for: creative work plus time with members.</li>
    <li>Credit what she does well, and do it first: the tournament coverage and the veterans reel were the best posts of the month.</li>
    <li>Don't call anything "bad". Say "there's no time left for the quiet weeks". The "AI content" tag is a question about which app she edits in, not an accusation.</li>
  </ul>
  <h3>The hours (an estimate, so say so)</h3>
  <ul class="f tp">
    <li>About <b>18 hours a normal week</b> (15–20), and 6–10 more per event weekend. Built task by task on page 3; it is not a benchmark. Ask Tyler how many hours she has for social now before comparing.</li>
    <li>If Tyler says "give her more hours": those hours come out of the pro shop, design or floor time, which is the trade the meeting was trying to avoid.</li>
  </ul>
  <h3>Get these before anything else</h3>
  <ul class="f tp">
    <li>Admin access, or exports: <b>Meta Business Suite</b> (90 days of reach, link taps, DMs and response time), <b>Google Business Profile performance plus review replies</b>, <b>Google Analytics</b> social referrals, and <b>CourtReserve</b> weekly registrations (free class, tournament, socials).</li>
    <li>Who else posts? Facebook shared Scott's personal Golden Ticket post on 8 Nov. Ask whether Scott or anyone else posts or answers messages.</li>
    <li>Whether the Facebook group (970 members) is Peak's, and whether to keep or close TikTok, YouTube, Peak Golf IG and Paage.</li>
  </ul>
  <h3>Watch-outs</h3>
  <p style="margin:0 0 3px">Brandon carries the Tyler PDF ("Peak socials, last 30 days"). This page stays with Matthew.</p>
  <ul class="f tp">
    <li>No price is in the Tyler PDF, and no price should go in this meeting until there's a written scope. Tyler's 11 Nov go-ahead on the "six places to grow" also still needs a priced plan.</li>
    <li>Quick wins to offer even before any deal, all free: fix the CourtReserve Instagram link, update or replace the Paage buttons, unlink the dead TikTok from Facebook, and claim Nextdoor. Each needs Peak's own login, so Peak or its admin does it.</li>
    <li>Gaps in this audit: Facebook 14–20 Oct can't be seen logged out (Instagram shows nothing then), nor can Stories, DMs or the full Google review list. Don't overclaim on those.</li>
  </ul>
  <div class="foot">Sources: social-audit-2026-11-13/report.md (fact-check log there), posts-30d.csv, inventory-2026-11-13.csv; meeting-2026-11-02.md; data/peak-baseline-2026-11-04.md; data/tyler-2026-11-11/README.md.<span class="pg">1 / 1</span></div>
</div></body></html>`;

writeFileSync(join(OUT, 'peak-socials-30d.html'), tyler);
writeFileSync(join(OUT, 'talking-points.html'), tp);
console.log('written');

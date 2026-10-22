/* The two-page audit with charts (2026-10-22, Matthew: "if it needs to be two pages to provide the best results thats fine. But add
   some graphics graphs etc"). Writes peak-audit-2page.html; print it with headless Chrome to the PDF. Every figure is from the 21-22 Oct
   audit (research.md and audit-2026-10-22/ website, listings and social reports). Charts are plain SVG built here so the geometry is
   computed, not eyeballed. Colours: series 1 blue (Peak) and 2 orange (Springs Pickleball) from the data-viz reference palette (first
   three slots validated all-pairs); status colours only for account health, each with a word label.
     node build-2page.mjs                                                                                                          */
import { writeFileSync } from 'node:fs';
const C = { peak: '#2a78d6', springs: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a8984', grid: '#e6e5e0', surface: '#fcfcfb',
  good: '#0ca30c', warn: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 9}" fill="${o.fill || C.ink2}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
/* a horizontal bar with a rounded data end (4 px) anchored square to the baseline */
const hbar = (x, y, w, h, fill) => { if (w <= 0) return ''; const r = Math.min(4, w, h / 2); return `<path d="M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z" fill="${fill}"/>`; };
const vbar = (x, y0, w, h, fill) => { if (h <= 0) return ''; const r = Math.min(4, h, w / 2), y = y0 - h; return `<path d="M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z" fill="${fill}"/>`; };

/* A. phone speed: seconds until the main image shows (Lighthouse mobile), with Google's 2.5 s line */
function speedChart() {
  const rows = [['peakgolf.us home', 15.9], ['Home page', 14.3, 5.9], ['Membership', 12.4], ['Play Pickleball', 11.7], ['giveemheaven.us', 4.6], ['Contact', 3.3]];
  const W = 330, L = 104, R = 34, top = 14, bh = 11, gap = 9, max = 16, sx = (v) => L + v / max * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${top + rows.length * (bh + gap) + 18}" width="100%" role="img" aria-label="Seconds until the main image shows on a phone, by page">`;
  for (const v of [0, 4, 8, 12, 16]) s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top - 4}" y2="${top + rows.length * (bh + gap) - gap + 2}" stroke="${C.grid}"/>` + t(sx(v), top + rows.length * (bh + gap) + 9, v + ' s', { anchor: 'middle', size: 7.5, fill: C.muted });
  rows.forEach(([name, v, lo], i) => {
    const y = top + i * (bh + gap);
    s += t(L - 6, y + bh - 2, name, { anchor: 'end', size: 8.5, fill: C.ink });
    s += hbar(sx(0), y, sx(v) - sx(0), bh, v > 2.5 ? C.peak : C.good);
    if (lo) s += `<line x1="${sx(lo)}" x2="${sx(v)}" y1="${y + bh / 2}" y2="${y + bh / 2}" stroke="${C.surface}" stroke-width="2"/><line x1="${sx(lo)}" x2="${sx(lo)}" y1="${y + 2}" y2="${y + bh - 2}" stroke="${C.surface}" stroke-width="2"/>`;
    s += t(sx(v) + 4, y + bh - 2, (lo ? lo + '-' : '') + v + ' s', { size: 8.2, fill: C.ink, weight: 600 });
  });
  const x25 = sx(2.5);
  s += `<line x1="${x25}" x2="${x25}" y1="${top - 8}" y2="${top + rows.length * (bh + gap) - gap + 2}" stroke="${C.good}" stroke-width="2" stroke-dasharray="3 2"/>`;
  return s + '</svg>';
}
/* B. Instagram likes per post, 2-21 Oct, on a day axis so the 13-21 Oct gap shows, with the 23-like average */
function likesChart() {
  const posts = [[2, 77, '2 years of Peak'], [3, 14], [3, 18], [6, 13], [7, 28], [9, 8], [10, 34], [11, 20], [12, 21], [12, 14], [21, 6, 'Peak Flex offer']];
  const W = 330, L = 22, R = 8, top = 12, H = 92, base = top + H, sx = (d) => L + (d - 1.5) / 21 * (W - L - R), sy = (v) => H * v / 80;
  let s = `<svg viewBox="0 0 ${W} ${base + 26}" width="100%" role="img" aria-label="Instagram likes on each post, 2 to 21 October">`;
  for (const v of [0, 20, 40, 60, 80]) s += `<line x1="${L}" x2="${W - R}" y1="${base - sy(v)}" y2="${base - sy(v)}" stroke="${C.grid}"/>` + t(L - 4, base - sy(v) + 3, v, { anchor: 'end', size: 7.5, fill: C.muted });
  s += `<rect x="${sx(13.4)}" y="${top}" width="${sx(20.6) - sx(13.4)}" height="${H}" fill="#f1f0ec"/>` + t((sx(13.4) + sx(20.6)) / 2, top + 22, 'No posts', { anchor: 'middle', size: 8.5, fill: C.ink2, weight: 600 }) + t((sx(13.4) + sx(20.6)) / 2, top + 33, '13-21 Oct', { anchor: 'middle', size: 8, fill: C.ink2 });
  const byDay = {}; posts.forEach((p) => { (byDay[p[0]] = byDay[p[0]] || []).push(p); });
  for (const d in byDay) byDay[d].forEach((p, k, arr) => { const w = 6, x = sx(+d) - (arr.length * (w + 2) - 2) / 2 + k * (w + 2); s += vbar(x, base, w, sy(p[1]), C.peak); if (p[2]) s += x > W * 0.7 ? t(x - 3, base - sy(p[1]) - 4, p[2] + ': ' + p[1], { anchor: 'end', size: 8, fill: C.ink, weight: 600 }) : t(x + w + 3, base - sy(p[1]) + 8, p[2] + ': ' + p[1], { size: 8, fill: C.ink, weight: 600 }); });
  s += `<line x1="${L}" x2="${W - R}" y1="${base - sy(23)}" y2="${base - sy(23)}" stroke="${C.ink2}" stroke-dasharray="4 3"/>` + t(W - R, base - sy(23) - 3, 'average 23', { anchor: 'end', size: 7.8, fill: C.ink2 });
  for (const d of [2, 7, 12, 17, 21]) s += t(sx(d), base + 11, d + ' Oct', { anchor: 'middle', size: 7.5, fill: C.muted });
  return s + '</svg>';
}
/* C. audience by platform, Peak vs Springs Pickleball (followers or members, 22 Oct) */
function audienceChart() {
  const rows = [['Facebook page', 1786, 1093], ['Facebook group', 963, null], ['Instagram', 918, 803], ['LinkedIn', 96, null], ['Threads', 12, null], ['TikTok', 10, 24]];
  const W = 330, L = 84, R = 40, top = 6, bh = 7, pair = 2 * bh + 2, gap = 8, max = 2000, sx = (v) => L + v / max * (W - L - R);
  const n = rows.length, Hp = top + n * (pair + gap);
  let s = `<svg viewBox="0 0 ${W} ${Hp + 14}" width="100%" role="img" aria-label="Followers by platform, Peak and Springs Pickleball">`;
  for (const v of [0, 500, 1000, 1500, 2000]) s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top - 2}" y2="${Hp - gap + 2}" stroke="${C.grid}"/>` + t(sx(v), Hp + 8, v.toLocaleString('en-US'), { anchor: 'middle', size: 7.5, fill: C.muted });
  rows.forEach(([name, p, sp], i) => {
    const y = top + i * (pair + gap);
    s += t(L - 6, y + pair / 2 + 3, name, { anchor: 'end', size: 8.5, fill: C.ink });
    s += hbar(sx(0), y, Math.max(2, sx(p) - sx(0)), bh, C.peak) + t(Math.max(sx(p), sx(0) + 2) + 4, y + bh - 0.5, p.toLocaleString('en-US'), { size: 7.8, fill: C.ink, weight: 600 });
    if (sp != null) s += hbar(sx(0), y + bh + 2, Math.max(2, sx(sp) - sx(0)), bh, C.springs) + t(Math.max(sx(sp), sx(0) + 2) + 4, y + 2 * bh + 1.5, sp.toLocaleString('en-US'), { size: 7.8, fill: C.ink2 });
    else s += t(sx(0) + 4, y + 2 * bh + 1.5, 'none found', { size: 7.4, fill: C.muted });
  });
  return s + '</svg>';
}
/* D. Google reviews: count, with the rating written on the bar */
function reviewsChart() {
  const rows = [['Peak Pickleball', 585, '4.9', C.peak], ['Springs West', 94, '4.7', C.springs], ['Springs East', 46, '4.6', C.springs]];
  const W = 330, L = 84, R = 70, top = 4, bh = 13, gap = 8, max = 600, sx = (v) => L + v / max * (W - L - R);
  let s = `<svg viewBox="0 0 ${W} ${top + rows.length * (bh + gap)}" width="100%" role="img" aria-label="Google reviews, Peak and Springs Pickleball">`;
  rows.forEach(([name, n, r, col], i) => { const y = top + i * (bh + gap); s += t(L - 6, y + bh - 3, name, { anchor: 'end', size: 8.5, fill: C.ink }) + hbar(sx(0), y, sx(n) - sx(0), bh, col) + t(sx(n) + 4, y + bh - 3, n + ' reviews · ' + r + ' ★', { size: 8.2, fill: C.ink, weight: i ? 400 : 600 }); });
  return s + '</svg>';
}
/* E. clicks from the home page to six tasks */
function clicksGraphic() {
  const rows = [['See prices', '1 click', 'ok'], ['Sign up for a membership', '1-2 clicks', 'ok'], ['See today’s open play', '2 clicks', 'off', 'schedule only on CourtReserve'], ['Book a lesson', '2 clicks', 'off', 'no lesson prices anywhere'], ['Book a court (first visit)', 'no link', 'bad', 'account + approval on CourtReserve'], ['Plan a corporate event', 'dead end', 'bad', 'form can’t be sent']];
  const col = { ok: C.good, off: C.warn, bad: C.critical }, word = { ok: 'Easy', off: 'Off-site', bad: 'Blocked' };
  return `<div class="clicks">${rows.map(([task, n, k, note]) => `<div class="ck"><span class="dot" style="background:${col[k]}"></span><b>${esc(task)}</b><span class="cn">${esc(n)}</span><span class="cw">${word[k]}${note ? ' · ' + esc(note) : ''}</span></div>`).join('')}</div>`;
}
/* F. account health: 12 accounts, status with a word */
function healthGrid() {
  const A = [['Facebook page', '1,786', 'Active'], ['Instagram', '918', 'Active'], ['Facebook group', '963 members', 'Peak quiet since 8 Sep'], ['LinkedIn', '96', 'Stale'], ['Threads', '12', 'Copies Instagram'], ['TikTok', '10', 'Abandoned (May)'], ['YouTube', '1 video', 'Abandoned (2025)'], ['Peak Golf Instagram', '8', 'Stale'], ['Link page (paa.ge)', '—', 'Broken links'], ['Nextdoor', '7 faves', 'Unclaimed'], ['Google profile', '4.9 · 585', 'No posts or replies'], ['CourtReserve portal', '—', 'Dead Instagram link']];
  const tone = (st) => /^Active/.test(st) ? C.good : /Abandoned|Broken|Unclaimed|Dead/.test(st) ? C.critical : C.warn;
  return `<div class="health">${A.map(([n, f, st]) => `<div class="hc" style="border-left-color:${tone(st)}"><b>${esc(n)}</b><span>${esc(f)}</span><i style="color:${tone(st) === C.warn ? '#8a5a00' : tone(st)}">${esc(st)}</i></div>`).join('')}</div>`;
}
/* G. the plan as a three-phase timeline */
function planTimeline() {
  const P = [['Weeks 1–2', 'Stop the leaks', ['Book-a-Court button', 'One set of prices, rules, hours', 'Privacy, terms, waiver pages', 'Fix broken links and listings', 'One name and tagline everywhere', 'Review link on the site']],
    ['Month 1', 'Make yes easy', ['Fast, phone-first home page', 'Working corporate + scholarship forms', 'Schedules, lesson prices, app, Wellhub', 'Google markup and posts', 'Reply to every review', 'Facebook events']],
    ['Ongoing', 'Grow', ['Weekly calendar, 4–5 posts', 'Reels reposted to TikTok, YouTube, Threads', 'Weekly posts in the 963-member group', 'Review requests after visits', '"Best of" nominations, press', 'Monthly results report']]];
  return `<div class="plan">${P.map(([when, what, items], i) => `<div class="ph"><div class="phh"><span class="pn">${i + 1}</span><b>${when}</b><em>${what}</em></div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('<div class="arrow">→</div>')}</div>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Peak Pickleball: online presence audit</title>
<style>
  @page { size: Letter; margin: 0.4in 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.4pt/1.34 "Segoe UI", Arial, sans-serif; color: ${C.ink}; background: #fff; }
  .page { height: 10.15in; display: flex; flex-direction: column; break-after: page; }
  .page:last-child { break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${C.peak}; padding-bottom: 5px; }
  h1 { font-size: 18.5pt; margin: 0; letter-spacing: -0.01em; } .by { font-size: 8.4pt; color: ${C.ink2}; text-align: right; }
  .lead { margin: 7px 0 8px; font-size: 10.4pt; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 9px; }
  .k { border: 1px solid ${C.grid}; border-radius: 7px; padding: 5px 8px; } .k b { display: block; font-size: 15pt; line-height: 1.1; } .k span { font-size: 7.8pt; color: ${C.ink2}; }
  .k.bad b { color: ${C.critical}; } .k.good b { color: ${C.good}; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px; }
  .card { border: 1px solid ${C.grid}; border-radius: 8px; padding: 7px 9px 5px; background: ${C.surface}; }
  h2 { font-size: 11pt; margin: 0 0 1px; } .sub { font-size: 8pt; color: ${C.ink2}; margin: 0 0 4px; }
  h3 { font-size: 10.6pt; margin: 6px 0 3px; color: #0b5ba8; border-bottom: 1px solid ${C.grid}; padding-bottom: 2px; }
  ul.f { margin: 0; padding-left: 13px; } ul.f li { margin: 0 0 3px; } .fix { color: #0a7a0a; font-weight: 600; }
  .clicks { display: grid; gap: 3px; } .ck { display: grid; grid-template-columns: 10px 1fr auto; column-gap: 6px; align-items: baseline; font-size: 8.6pt; }
  .ck .dot { width: 9px; height: 9px; border-radius: 50%; align-self: center; } .ck .cn { font-weight: 700; } .ck .cw { grid-column: 2 / 4; font-size: 7.8pt; color: ${C.ink2}; margin-top: -1px; }
  .legend { display: flex; gap: 12px; font-size: 7.8pt; color: ${C.ink2}; margin: 0 0 3px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
  .health { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; } .hc { border: 1px solid ${C.grid}; border-left: 4px solid; border-radius: 6px; padding: 4px 6px; display: grid; font-size: 8.2pt; line-height: 1.25; background: #fff; }
  .hc span { color: ${C.ink2}; font-size: 7.8pt; } .hc i { font-style: normal; font-weight: 600; font-size: 7.8pt; }
  .plan { display: grid; grid-template-columns: 1fr 14px 1fr 14px 1fr; align-items: stretch; } .arrow { align-self: center; text-align: center; color: ${C.muted}; font-size: 13pt; }
  .ph { border: 1px solid #cfe0f3; background: #f3f8fd; border-radius: 8px; padding: 6px 8px; } .phh { display: flex; align-items: baseline; gap: 6px; margin-bottom: 3px; }
  .pn { background: ${C.peak}; color: #fff; border-radius: 50%; width: 16px; height: 16px; display: inline-grid; place-items: center; font-size: 8pt; font-weight: 700; } .phh em { color: ${C.ink2}; font-size: 8.4pt; }
  .ph ul { margin: 0; padding-left: 13px; font-size: 8.4pt; } .ph li { margin-bottom: 1.5px; }
  .foot { margin-top: auto; font-size: 7.3pt; color: ${C.muted}; padding-top: 5px; border-top: 1px solid ${C.grid}; }
  .pg { float: right; }
</style></head><body>
<div class="page">
  <div class="top"><h1>Peak Pickleball: online presence audit</h1><div class="by">22 October 2026<br>Prepared by Matthew Sharpe</div></div>
  <p class="lead">Players love Peak: <b>4.9 stars from 585 Google reviews</b>, the best rating in Colorado Springs pickleball. Online, though, the club is hard to book, slow on phones, inconsistent from page to page, and spread across 12 accounts with only two kept up. Almost every fix is setup work, not ad spend.</p>
  <div class="kpis">
    <div class="k good"><b>4.9 ★</b><span>585 Google reviews</span></div>
    <div class="k bad"><b>0</b><span>"Book a court" buttons on the site</span></div>
    <div class="k bad"><b>43–66</b><span>phone speed score out of 100</span></div>
    <div class="k"><b>12</b><span>accounts found; 2 kept up</span></div>
    <div class="k bad"><b>0</b><span>privacy, terms or waiver pages</span></div>
  </div>
  <div class="row">
    <div class="card"><h2>Slow on phones</h2><p class="sub">Seconds until the main image shows on a phone (Lighthouse, 22 Oct). Dashed green line: Google's "good", 2.5 s</p>${speedChart()}</div>
    <div class="card"><h2>Hard to get things done</h2><p class="sub">From the home page: how far each task gets</p>${clicksGraphic()}</div>
  </div>
  <h3>Website: what is wrong, and the fix</h3>
  <div class="row" style="margin-bottom:0">
    <ul class="f">
      <li><b>No way to book a court.</b> A first-timer must find CourtReserve, make an account and wait for approval. <span class="fix">"Book a Court" button in the header.</span></li>
      <li><b>The corporate-event form can't be sent</b>: 17 fields, only "Print / Save PDF", and the events email sits on a page no menu links to. <span class="fix">A real enquiry form with phone and email.</span></li>
      <li><b>Slow:</b> a 14 MB autoplay video and 4–6 MB photos. <span class="fix">Compress; load the map only on Contact.</span></li>
      <li><b>Tracking with no privacy policy</b>: Google Analytics and Meta Pixel on all 34 pages. <span class="fix">Privacy, terms, waiver, accessibility pages.</span></li>
    </ul>
    <ul class="f">
      <li><b>Pages disagree:</b> family rate $6 vs $7; cancel 24 h vs 4 h; "cancel anytime" vs 15 days' notice; walk in vs reservation; close 9pm vs 10pm. <span class="fix">One set of rules.</span></li>
      <li><b>Dead ends:</b> sponsor package buttons go to a missing page; the scholarship "application" has no form; staff personal emails and cell numbers used to book.</li>
      <li><b>Missing:</b> Peak's iPhone app, the Wellhub partnership, schedules, reviews, lesson prices, a corporate page.</li>
      <li><b>Hard to read:</b> the cyan buttons fail contrast (2.8:1; 4.5:1 needed); tap targets as small as 21 px.</li>
    </ul>
  </div>
  <h3>All 12 accounts at a glance</h3>
  ${healthGrid()}
  <div class="foot">Sources: our checks of peakpickleball.us, peakgolf.us and giveemheaven.us (34 pages, 248 links) on 21–22 Oct 2026; Lighthouse 13 lab tests (vary run to run; home page shown as the range of two runs). <span class="pg">1 / 2</span></div>
</div>
<div class="page">
  <div class="row">
    <div class="card"><h2>Biggest audiences, least attention</h2><p class="sub">Followers or members, 22 Oct</p><div class="legend"><span><i style="background:${C.peak}"></i>Peak</span><span><i style="background:${C.springs}"></i>Springs Pickleball</span></div>${audienceChart()}</div>
    <div class="card"><h2>Instagram: bursts, then silence</h2><p class="sub">Likes on each post, 2–21 Oct (918 followers)</p>${likesChart()}</div>
  </div>
  <div class="row">
    <div class="card"><h2>Reviews: Peak's biggest strength</h2><p class="sub">Google reviews and rating, 22 Oct</p>${reviewsChart()}<p class="sub" style="margin-top:4px">But no visible owner replies, no "leave a review" link on the site, and Peak is missing from every "best of" list.</p></div>
    <div class="card"><h2>Google, maps and listings</h2><ul class="f" style="font-size:8.6pt">
      <li><b>Google's "Book online"</b> lands on a page saying "Briargate, CO", open from 5 AM.</li>
      <li><b>Peak Golf's hours and description</b> appear on Peak's MapQuest and Yellow Pages pages; its own Google profile rates 3.0 (4 reviews).</li>
      <li><b>Unclaimed:</b> Nextdoor, Yellow Pages, Apple Maps (Peak Golf). Hours differ on 4 platforms.</li>
      <li><b>Wrong details elsewhere:</b> "16 courts" (DNVR), "Public / Free" (Pickleball Plus), the tournament listed twice at the wrong price (Bounce).</li>
    </ul></div>
  </div>
  <h3>Social: what we would change</h3>
  <ul class="f" style="columns:2;column-gap:16px">
    <li><b>Rename Instagram</b> to "Peak Pickleball | Colorado Springs" (no "Peak" in it today).</li>
    <li><b>Post on a calendar,</b> 4–5 a week, offer and price in the first line.</li>
    <li><b>Repost every reel</b> to Facebook, TikTok, YouTube Shorts and Threads: one Facebook reel reached 84,000 plays.</li>
    <li><b>Run the 963-member group:</b> weekly open courts, sign-ups, results.</li>
    <li><b>Claim a Facebook username;</b> fix the link page (it points to a Greensboro club's TikTok).</li>
    <li><b>One tagline everywhere</b>, not five ("top", "Colorado's largest", "nation's largest"…).</li>
  </ul>
  <h3>The plan</h3>
  ${planTimeline()}
  <div class="foot">Sources: Google Maps, Apple Maps, Bing, Facebook, Instagram, TikTok, YouTube, LinkedIn, Threads, Nextdoor, MapQuest, Yellow Pages and pickleball directories, viewed logged out on 22 Oct 2026; counts some platforms hide were not estimated. Full audit with every source available on request. <span class="pg">2 / 2</span></div>
</div>
</body></html>`;
writeFileSync(new URL('./peak-audit-2page.html', import.meta.url), html);
console.log('written');

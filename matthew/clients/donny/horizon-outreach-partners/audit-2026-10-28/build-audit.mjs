/* Horizon Outreach Partners and Events: online presence audit, four pages (2026-10-28, Matthew: "build out a similar audit that we did for
   peak. But with as much detail, things they are doing wrong, things they are doing right, activity, etc. What we can do for them and how
   we can help with their issues"; "also review how the socials and websites are function on phone and tablet"). Writes horizon-audit.html;
   print-audit.mjs prints it to the PDF. Every figure comes from this folder's website/, social/, company/ findings and indeed-policy.md
   (all viewed 28 Oct 2026). Unverified leads (the VAA job post, Donny's filings) are left out. Charts are plain SVG built here so the
   geometry is computed; colours as the Peak audit: series 1 blue (Horizon), 2 orange (the other "Horizon Outreach"); status colours only
   with a word label.
     node build-audit.mjs                                                                                                          */
import { writeFileSync } from 'node:fs';
const C = { main: '#2a78d6', other: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', muted: '#8a8984', grid: '#e6e5e0', surface: '#fcfcfb',
  good: '#0ca30c', warn: '#fab219', critical: '#d03b3b', light: '#a9c8ef' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 9}" fill="${o.fill || C.ink2}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''}>${esc(s)}</text>`;
const hbar = (x, y, w, h, fill) => { if (w <= 0) return ''; const r = Math.min(4, w, h / 2); return `<path d="M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z" fill="${fill}"/>`; };
const sq = (x, y, w, h, fill) => w > 0 ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>` : '';
const vbar = (x, y0, w, h, fill) => { if (h <= 0) return ''; const r = Math.min(4, h, w / 2), y = y0 - h; return `<path d="M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z" fill="${fill}"/>`; };

/* A. home page on a phone at three connection speeds: when the text shows and when the main photo arrives (retest 28 Oct after Matthew:
   "I feel like it loads fine on my phone"; website/speed-retest/speed-retest-*.csv, two runs each, empty cache, same figures both runs) */
function speedChart() {
  const rows = [['Wi-Fi', 0.2, 0.4], ['Typical 4G', 0.4, 2.6], ['Weak signal', 1.5, 29.6]];
  const W = 330, L = 70, R = 44, top = 6, bh = 9, pair = 2 * bh + 2, gap = 12, max = 30, sx = (v) => L + v / max * (W - L - R);
  const H = top + rows.length * (pair + gap);
  let s = `<svg viewBox="0 0 ${W} ${H + 12}" width="100%" role="img" aria-label="Home page on a phone: seconds until the text shows and until the main photo arrives, by connection">`;
  for (const v of [0, 10, 20, 30]) s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top - 3}" y2="${H - gap + 2}" stroke="${C.grid}"/>` + t(sx(v), H + 6, v + ' s', { anchor: 'middle', size: 7.5, fill: C.muted });
  rows.forEach(([name, txt, photo], i) => {
    const y = top + i * (pair + gap);
    s += t(L - 6, y + pair / 2 + 3, name, { anchor: 'end', size: 8.5, fill: C.ink });
    s += hbar(sx(0), y, Math.max(2, sx(txt) - sx(0)), bh, C.light) + t(Math.max(sx(txt), sx(0) + 2) + 4, y + bh - 1, txt + ' s', { size: 8, fill: C.ink2 });
    s += hbar(sx(0), y + bh + 2, Math.max(2, sx(photo) - sx(0)), bh, C.main) + t(Math.max(sx(photo), sx(0) + 2) + 4, y + 2 * bh + 1, photo + ' s', { size: 8.2, fill: C.ink, weight: 600 });
  });
  return s + '</svg>';
}
/* B. page weight on a phone, with the chat window's 1.52 MB split out (website/speed/*.json) */
function weightChart() {
  const rows = [['Home page', 5.55], ['Our Team', 4.18], ['About Us', 4.05], ['Business Growth Hub', 3.47], ['Contact', 2.51], ['Apply', 2.10]], chat = 1.516;
  const W = 330, L = 104, R = 40, top = 6, bh = 10, gap = 7, max = 6, sx = (v) => L + v / max * (W - L - R);
  const H = top + rows.length * (bh + gap);
  let s = `<svg viewBox="0 0 ${W} ${H + 14}" width="100%" role="img" aria-label="Megabytes each page sends to a phone, with the chat window's share">`;
  for (const v of [0, 2, 4, 6]) s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top - 3}" y2="${H - gap + 2}" stroke="${C.grid}"/>` + t(sx(v), H + 8, v + ' MB', { anchor: 'middle', size: 7.5, fill: C.muted });
  rows.forEach(([name, mb], i) => {
    const y = top + i * (bh + gap);
    s += t(L - 6, y + bh - 2, name, { anchor: 'end', size: 8.5, fill: C.ink });
    s += sq(sx(0), y, sx(chat) - sx(0) - 1, bh, C.other) + hbar(sx(chat) + 1, y, sx(mb) - sx(chat) - 1, bh, C.main);
    s += t(sx(mb) + 4, y + bh - 2, mb.toFixed(2) + ' MB', { size: 8.2, fill: C.ink, weight: 600 });
  });
  return s + '</svg>';
}
/* C. the path a job seeker takes, as steps */
function applyPath() {
  const S = [['Sees a post or ad on a phone', 'Instagram, Facebook, X and LinkedIn put a log-in / open-the-app pop-up over the profile', 'off'],
    ['Lands on the home page', 'No Apply, Jobs or Careers link; "Text Apply to 704-765-0308" is plain text in the footer', 'bad'],
    ['Opens the menu (45×29 px button)', '7 items, 2 of them legal pages; none says Apply or Jobs', 'bad'],
    ['Guesses "Our Team", taps "Join The Team!"', 'The only link to the form on the whole site', 'off'],
    ['Reaches /apply/', 'No role, pay, hours, location or next step; a "Take Me Home" button sends them back', 'bad'],
    ['Fills in 4 fields and taps Submit', 'Short form, right keyboards, labelled; the chat banner can cover Submit; Submit is 1.87:1 contrast', 'off']];
  const col = { ok: C.good, off: C.warn, bad: C.critical }, word = { ok: 'Fine', off: 'Friction', bad: 'Blocker' };
  return `<div class="path">${S.map(([a, b, k], i) => `<div class="st"><span class="sn" style="background:${col[k]}">${i + 1}</span><div><b>${esc(a)}</b> <em style="color:${k === 'off' ? '#8a5a00' : col[k]}">${word[k]}</em><br><span>${esc(b)}</span></div></div>`).join('')}</div>`;
}
/* D. followers: Horizon vs the Houston nonprofit "Horizon Outreach" (social/findings.md) */
function audienceChart() {
  const rows = [['Instagram', 11, 110], ['X', 0, 203], ['LinkedIn', 27, null], ['Facebook', 3, null]];
  const W = 330, L = 64, R = 40, top = 6, bh = 8, pair = 2 * bh + 2, gap = 6, max = 250, sx = (v) => L + v / max * (W - L - R);
  const Hp = top + rows.length * (pair + gap);
  let s = `<svg viewBox="0 0 ${W} ${Hp + 14}" width="100%" role="img" aria-label="Followers by platform, Horizon and the Houston Horizon Outreach">`;
  for (const v of [0, 50, 100, 150, 200, 250]) s += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${top - 2}" y2="${Hp - gap + 2}" stroke="${C.grid}"/>` + t(sx(v), Hp + 8, v, { anchor: 'middle', size: 7.5, fill: C.muted });
  rows.forEach(([name, h, o], i) => {
    const y = top + i * (pair + gap);
    s += t(L - 6, y + pair / 2 + 3, name, { anchor: 'end', size: 8.5, fill: C.ink });
    s += hbar(sx(0), y, Math.max(2, sx(h) - sx(0)), bh, C.main) + t(Math.max(sx(h), sx(0) + 2) + 4, y + bh - 0.5, String(h), { size: 7.8, fill: C.ink, weight: 600 });
    if (o != null) s += hbar(sx(0), y + bh + 2, sx(o) - sx(0), bh, C.other) + t(sx(o) + 4, y + 2 * bh + 1.5, String(o), { size: 7.8, fill: C.ink2 });
    else s += t(sx(0) + 4, y + 2 * bh + 1.5, 'not checked', { size: 7.4, fill: C.muted });
  });
  return s + '</svg>';
}
/* E. Instagram likes per visible post, 9-27 Oct (social/captures/ig-posts-horizonhopeinc.json: 12 posts, 9 likes, 4 comments, all spam) */
function likesChart() {
  const posts = [[9, 0], [12, 1], [13, 2], [15, 1], [16, 1], [19, 0], [20, 1], [21, 1], [22, 1], [23, 0], [26, 1], [27, 0, 'hiring post']];
  const W = 330, L = 22, R = 10, top = 10, H = 70, base = top + H, sx = (d) => L + (d - 8) / 20.5 * (W - L - R), sy = (v) => H * v / 4;
  let s = `<svg viewBox="0 0 ${W} ${base + 24}" width="100%" role="img" aria-label="Instagram likes on each post, 9 to 27 October">`;
  for (const v of [0, 1, 2, 3, 4]) s += `<line x1="${L}" x2="${W - R}" y1="${base - sy(v)}" y2="${base - sy(v)}" stroke="${C.grid}"/>` + t(L - 4, base - sy(v) + 3, v, { anchor: 'end', size: 7.5, fill: C.muted });
  for (const [d, v, lab] of posts) {
    const x = sx(d) - 4;
    if (v > 0) s += vbar(x, base, 8, sy(v), C.main); else s += `<rect x="${x}" y="${base - 1.5}" width="8" height="1.5" fill="${C.main}"/>`;
    if (lab) s += `<line x1="${x + 4}" x2="${x + 4}" y1="${base - sy(2.6)}" y2="${base - 4}" stroke="${C.ink2}" stroke-dasharray="2 2"/>` + t(x + 8, base - sy(2.6) - 3, lab + ': 0 likes', { anchor: 'end', size: 7.8, fill: C.ink, weight: 600 });
  }
  for (const d of [9, 13, 17, 21, 25]) s += t(sx(d), base + 11, d + ' Oct', { anchor: 'middle', size: 7.5, fill: C.muted });
  return s + '</svg>';
}
/* F. accounts and listings at a glance */
function healthGrid() {
  const A = [['Instagram @horizonhopeinc', '11 followers · 63 posts', 'Active, tiny reach'], ['Facebook page', '3 followers', 'Active, no username'], ['X @Horizon_opsales', '0 followers · 84 posts', 'No audience'], ['LinkedIn', '27 followers', '"Public Company", 0 jobs'],
    ['Google profile "Horizon"', '0 reviews', 'Reviews turned off'], ['Indeed / Glassdoor', 'not checked yet', 'Check by hand'], ['BBB', 'no profile', 'No data'], ['TikTok / YouTube', 'none found', 'Missing']];
  const tone = (st) => /^Active/.test(st) ? C.good : /off|No audience|Missing/.test(st) ? C.critical : C.warn;
  return `<div class="health">${A.map(([n, f, st]) => `<div class="hc" style="border-left-color:${tone(st)}"><b>${esc(n)}</b><span>${esc(f)}</span><i style="color:${tone(st) === C.warn ? '#8a5a00' : tone(st)}">${esc(st)}</i></div>`).join('')}</div>`;
}
/* G. the plan, three steps, no timeframes (as the Peak audit, Matthew 2026-10-22: "i dont wanna promise anything") */
function planTimeline() {
  const P = [['Fix the basics', ['Apply button in the header, hero and menu', 'Tap-to-call and tap-to-text links', 'Chat window stops opening by itself; images and fonts cut', 'Legal pages with the real company and texting terms', 'Dead links, contrast, headings fixed', 'One name on every account and listing']],
    ['Make it a recruiting site', ['A jobs page per role: pay, hours, location, the real work', 'Google job markup so roles show in Google Jobs', 'Real team photos and a "day in the job" section', 'One form, one inbox, fast replies to applicants', 'Instagram bio and Story highlight that lead to Apply', 'Google profile renamed, reviews sorted out']],
    ['Grow', ['A HOPE careers site that stays inside Indeed\'s rules', 'A regular posting plan built around hiring', 'Indeed and Glassdoor employer pages claimed', 'Other channels: ZipRecruiter, LinkedIn, Handshake, referrals', 'Analytics with a cookie notice', 'A monthly applicant report']]];
  return `<div class="plan">${P.map(([when, items], i) => `<div class="ph"><div class="phh"><span class="pn">${i + 1}</span><b>${when}</b></div><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('<div class="arrow">→</div>')}</div>`;
}

const css = `
  @page { size: Letter; margin: 0.4in 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.3pt/1.34 "Segoe UI", Arial, sans-serif; color: ${C.ink}; background: #fff; }
  .page { height: 10.15in; display: flex; flex-direction: column; break-after: page; overflow: hidden; }
  .page:last-child { break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${C.main}; padding-bottom: 5px; }
  h1 { font-size: 14.6pt; margin: 0; letter-spacing: -0.01em; } .by { font-size: 8.4pt; color: ${C.ink2}; text-align: right; white-space: nowrap; padding-left: 10px; }
  .ptitle { font-size: 13pt; font-weight: 700; margin: 0 0 6px; border-bottom: 3px solid ${C.main}; padding-bottom: 4px; }
  .lead { margin: 7px 0 8px; font-size: 10.2pt; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 9px; }
  .k { border: 1px solid ${C.grid}; border-radius: 7px; padding: 5px 8px; } .k b { display: block; font-size: 15pt; line-height: 1.1; } .k span { font-size: 7.8pt; color: ${C.ink2}; }
  .k.bad b { color: ${C.critical}; } .k.good b { color: ${C.good}; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 8px; }
  .card { border: 1px solid ${C.grid}; border-radius: 8px; padding: 7px 9px 5px; background: ${C.surface}; }
  h2 { font-size: 11pt; margin: 0 0 1px; } .sub { font-size: 8pt; color: ${C.ink2}; margin: 0 0 4px; }
  h3 { font-size: 10.6pt; margin: 6px 0 3px; color: #0b5ba8; border-bottom: 1px solid ${C.grid}; padding-bottom: 2px; }
  ul.f { margin: 0; padding-left: 13px; } ul.f li { margin: 0 0 3px; } .fix { color: #0a7a0a; font-weight: 600; }
  .legend { display: flex; gap: 12px; font-size: 7.8pt; color: ${C.ink2}; margin: 0 0 3px; } .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: -1px; margin-right: 4px; }
  .path { display: grid; gap: 4px; } .st { display: grid; grid-template-columns: 18px 1fr; gap: 7px; font-size: 8.5pt; line-height: 1.3; align-items: start; }
  .sn { color: #fff; border-radius: 50%; width: 17px; height: 17px; display: grid; place-items: center; font-size: 8pt; font-weight: 700; } .st em { font-style: normal; font-weight: 700; font-size: 7.6pt; } .st span { color: ${C.ink2}; font-size: 8pt; }
  .health { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; } .hc { border: 1px solid ${C.grid}; border-left: 4px solid; border-radius: 6px; padding: 4px 6px; display: grid; font-size: 8.2pt; line-height: 1.25; background: #fff; }
  .hc span { color: ${C.ink2}; font-size: 7.8pt; } .hc i { font-style: normal; font-weight: 600; font-size: 7.8pt; }
  table.t { width: 100%; border-collapse: collapse; font-size: 8.1pt; } table.t th { text-align: left; color: ${C.ink2}; font-weight: 600; border-bottom: 1px solid ${C.grid}; padding: 2px 4px; } table.t td { border-bottom: 1px solid ${C.grid}; padding: 2.5px 4px; vertical-align: top; }
  .quote { border-left: 3px solid ${C.main}; background: #f3f8fd; padding: 4px 8px; margin: 3px 0; font-size: 8.5pt; }
  .opt { border: 1px solid ${C.grid}; border-radius: 7px; padding: 5px 8px; background: #fff; font-size: 8.5pt; } .opt b { display: block; margin-bottom: 1px; }
  .tag { display: inline-block; font-size: 7.4pt; font-weight: 700; padding: 0 5px; border-radius: 3px; margin-left: 4px; vertical-align: 1px; }
  .tag.r { background: #fbe4e4; color: ${C.critical}; } .tag.g { background: #e1f4e1; color: #0a7a0a; } .tag.y { background: #fff1d0; color: #8a5a00; }
  .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .plan { display: grid; grid-template-columns: 1fr 14px 1fr 14px 1fr; align-items: stretch; } .arrow { align-self: center; text-align: center; color: ${C.muted}; font-size: 13pt; }
  .ph { border: 1px solid #cfe0f3; background: #f3f8fd; border-radius: 8px; padding: 6px 8px; } .phh { display: flex; align-items: baseline; gap: 6px; margin-bottom: 3px; }
  .pn { background: ${C.main}; color: #fff; border-radius: 50%; width: 16px; height: 16px; display: inline-grid; place-items: center; font-size: 8pt; font-weight: 700; }
  .ph ul { margin: 0; padding-left: 13px; font-size: 8.3pt; } .ph li { margin-bottom: 1.5px; }
  .right { border: 1px solid #cfe9cf; background: #f2faf2; border-radius: 8px; padding: 5px 9px; margin-bottom: 6px; font-size: 8.6pt; } .right b.h { color: #0a7a0a; }
  .foot { margin-top: auto; font-size: 7.2pt; color: ${C.muted}; padding-top: 5px; border-top: 1px solid ${C.grid}; }
  .pg { float: right; }`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Horizon Outreach Partners and Events: online presence audit</title><style>${css}</style></head><body>

<div class="page">
  <div class="top"><h1>Horizon Outreach Partners and Events: online presence audit</h1><div class="by">28 October 2026<br>Prepared by Matthew Sharpe</div></div>
  <p class="lead">Horizon has a clean, secure website, one consistent address and phone, and posts on four accounts every weekday. But the site recruits without ever saying what the job is, hides its only apply form two clicks deep, and sends phones far more than they need; the four accounts reach <b>41 followers</b> between them. Most fixes are setup work, not ad spend.</p>
  <div class="kpis">
    <div class="k bad"><b>0</b><span>Apply or Jobs links on the home page or menu</span></div>
    <div class="k bad"><b>5.5 MB</b><span>home page download on a phone; the photo alone is 2 MB</span></div>
    <div class="k bad"><b>0</b><span>tap-to-call or tap-to-text links on 13 pages</span></div>
    <div class="k"><b>41</b><span>followers across Instagram, Facebook, X and LinkedIn</span></div>
    <div class="k bad"><b>0</b><span>Google reviews: posting is turned off on the profile</span></div>
  </div>
  <div class="row">
    <div class="card"><h2>Fine on a good signal, slow on a weak one</h2><p class="sub">Home page on a phone, empty cache, 28 Oct (our test, not a Lighthouse score). The text and button show fast everywhere; the 2 MB photo is what drags</p><div class="legend"><span><i style="background:${C.light}"></i>Text and button show</span><span><i style="background:${C.main}"></i>Main photo arrives</span></div>${speedChart()}<p class="sub" style="margin-top:3px">The Apply page is done in 1.8 s on 4G.</p></div>
    <div class="card"><h2>Heavy pages, and the chat window's share</h2><p class="sub">What each page sends to a phone. The chat window alone is 1.52 MB on every page</p><div class="legend"><span><i style="background:${C.other}"></i>Chat window</span><span><i style="background:${C.main}"></i>Everything else</span></div>${weightChart()}<p class="sub" style="margin-top:3px">The home photo is a 1.99 MB PNG; 7 font families add about 700 KB.</p></div>
  </div>
  <div class="right"><b class="h">What Horizon does right:</b> HTTPS everywhere with automatic certificate renewal · the same address, phone and email on every page and on Facebook · a short apply form (4 fields, right phone keyboards, every field labelled) · text-to-apply, which suits field recruiting · no ad or analytics trackers · posting on all four accounts every weekday · real team photos on social, no income or "be your own boss" claims in anything we could see.</div>
  <h3>Website: what is wrong, and the fix</h3>
  <div class="row" style="margin-bottom:0">
    <ul class="f">
      <li><b>No way to apply from the home page.</b> The menu has 7 items, 2 of them legal pages, and no Apply. The form is reachable only from Our Team → "Join The Team!". <span class="fix">Apply button in the header, the hero and the menu.</span></li>
      <li><b>The site never says what the job is:</b> no role, pay, hours, location, duties or requirements, no jobs page, no Indeed link. <span class="fix">A jobs page per role with honest pay facts.</span></li>
      <li><b>Numbers can't be tapped.</b> 0 call or text links; "Text Apply to 704-765-0308" is plain text. <span class="fix">Tap-to-call and tap-to-text (APPLY pre-filled).</span></li>
      <li><b>The chat window opens by itself</b> over 27% of a tablet screen and sits over the phone form's Submit button; it sets a 13-month cookie nobody is told about. <span class="fix">Open on tap only; name it in the privacy policy.</span></li>
    </ul>
    <ul class="f">
      <li><b>Legal pages are unfilled templates.</b> Terms: "Country refers to: STATE OF OFFICE", dated January 2025, before the domain existed. Privacy says no data goes to third parties; the form and chat send it to an outside service. <span class="fix">Rewrite with the real company; attorney review.</span></li>
      <li><b>Dead ends:</b> "Learn More" goes to a site that doesn't exist (http://team); 18 links go nowhere, including the footer "Contact" on every page. <span class="fix">Fix or remove.</span></li>
      <li><b>Testimonials can't be checked:</b> 4 first-and-last names, no company or photo, each shown twice. <span class="fix">Real quotes with permission, or none.</span></li>
      <li><b>Hard to read and find:</b> white on the brand orange is 2.23:1 (4.5:1 needed), Submit 1.87:1; no main heading on any of the 8 pages. <span class="fix">Dark text on orange; one heading per page.</span></li>
    </ul>
  </div>
  <div class="foot">Sources: our checks of horizonoutreachpartners.com on 28 Oct 2026: 13 pages, 49 links, phone 390 px and tablet 820/1180 px; speed is our own Chrome test as an iPhone on Wi-Fi, typical 4G (20 Mbps) and a weak signal (1.6 Mbps), not Lighthouse; page sizes from Chrome's network log. Nothing was submitted. <span class="pg">1 / 5</span></div>
</div>

<div class="page">
  <div class="ptitle">What a job seeker goes through, on a phone and a tablet</div>
  <div class="row">
    <div class="card"><h2>From a post to the apply form</h2><p class="sub">Step by step, as a first-time visitor on a phone, 28 Oct</p>${applyPath()}</div>
    <div class="card"><h2>Phone and tablet: measured</h2><p class="sub">Website at 390 px (phone), 820 and 1180 px (iPad); socials logged out as an iPhone and iPad</p>
      <ul class="f" style="font-size:8.4pt">
        <li><b>Works:</b> the phone and tablet menu opens and every item can be reached; no page scrolls sideways at any width; the apply form fits all three widths.</li>
        <li><b>Small tap targets:</b> 220 of 261 tappable items on phone pages are under 44 px; footer links are 20 px tall, carousel dots 6 px, the menu button 45×29 px.</li>
        <li><b>Small text:</b> form labels are 12 px; 166 text items on phone pages are under 16 px.</li>
        <li><b>Chat window:</b> a 390×120 px banner on phones (14% of the screen); a 432×600 px panel on tablets until closed.</li>
        <li><b>Tablet landscape:</b> the 7-item menu wraps onto two lines at 1180 px.</li>
        <li><b>Socials on a phone:</b> every platform covers the profile with a log-in or open-the-app pop-up, so the website has to carry the hiring facts and the Apply button.</li>
        <li><b>Instagram on a phone:</b> the bio is cut off at "…sales systems that gen…", and speaks to clients, not recruits. The hiring post prints the apply link inside the image, where it can't be tapped, and the grid crops it off both edges.</li>
        <li><b>LinkedIn on a tablet:</b> sends a logged-out visitor straight to LinkedIn's sign-in wall.</li>
      </ul></div>
  </div>
  <h3>Trust and housekeeping: what is wrong, and the fix</h3>
  <div class="row" style="margin-bottom:4px">
    <ul class="f">
      <li><b>The name changes from place to place:</b> "Horizon" (site, X, LinkedIn, Google), "Horizon Outreach Partners and Events" (Instagram, Facebook, privacy policy), handles @horizonhopeinc and @Horizon_opsales; "HOPE" appears nowhere yet. <span class="fix">Settle one public name, then use it everywhere.</span></li>
      <li><b>Another "Horizon Outreach" owns the name online:</b> a Houston nonprofit holds the registered trademark HORIZON OUTREACH, both domains, @horizonoutreach on Instagram and X, and the Glassdoor page that comes up for the name (about 40 reviews, about 2.2 stars). <span class="fix">Always use the full name; claim Indeed and Glassdoor pages under it.</span></li>
      <li><b>The owner's personal username is public</b> in the site's user list, author page and page code on every page. <span class="fix">Change the author name and hide the author page.</span></li>
    </ul>
    <ul class="f">
      <li><b>Email may land in spam:</b> the anti-spoofing policy (DMARC) is set to "none" with no reports. <span class="fix">Turn on reports, then tighten it.</span></li>
      <li><b>Two form systems:</b> contact goes to WordPress, apply to an outside service, so leads arrive in two places; the contact message is capped at 180 characters. <span class="fix">One form system, one inbox.</span></li>
      <li><b>The blog speaks to business owners:</b> 3 long posts at exact clock times (17 Jul, 7 Aug, 15 Sep), nothing since. <span class="fix">Posts for recruits: the work, the training, the pay structure.</span></li>
      <li><b>Search basics:</b> page titles are "&lt;Page&gt; - Horizon" with no city or job; 23 of 40 images have no description; theme demo images are listed for Google. <span class="fix">"Field Sales Jobs in Charlotte, NC" style titles; clean sitemaps.</span></li>
    </ul>
  </div>
  <div class="card"><h2>What other Charlotte offices put in their job posts</h2><p class="sub">Entry-level field and event roles on SimplyHired, page 1, 28 Oct. Showing pay is the norm; Horizon shows none anywhere</p>
    <table class="t"><tr><th>Company</th><th>Title</th><th>Pay shown</th></tr>
      <tr><td>New Heights Marketing</td><td>Retail Brand Associate</td><td>$24.01–$28.92 / hour</td></tr>
      <tr><td>MAD Events &amp; Advertising</td><td>Entry Level Event Staff</td><td>$24.66–$29.70 / hour</td></tr>
      <tr><td>AlohaProduce Co</td><td>Communications Representative</td><td>$3,750–$4,425 / month</td></tr>
      <tr><td>Azalea Acquisitions</td><td>Sales Management Trainee</td><td>$700–$1,600 / week</td></tr>
      <tr><td>Horizon Outreach Partners</td><td>no live post found under the name (LinkedIn 0, SimplyHired 0)</td><td>none on the site or social</td></tr></table></div>
  <div class="foot">Sources: our checks of horizonoutreachpartners.com, Instagram, Facebook, X and LinkedIn on 28 Oct 2026 (logged out); SimplyHired and LinkedIn job searches 28 Oct; USPTO reg. 4391024; Glassdoor figures are from a search listing and approximate. Indeed and Glassdoor refused automated reads, so their pages need a check in a browser. <span class="pg">2 / 5</span></div>
</div>

<div class="page">
  <div class="ptitle">Social media and listings</div>
  <div class="row">
    <div class="card"><h2>Small audiences, and a bigger namesake</h2><p class="sub">Followers, 28 Oct</p><div class="legend"><span><i style="background:${C.main}"></i>Horizon</span><span><i style="background:${C.other}"></i>Horizon Outreach (Houston nonprofit)</span></div>${audienceChart()}</div>
    <div class="card"><h2>Instagram: steady posting, no response</h2><p class="sub">Likes on each visible post, 9–27 Oct: 12 posts, 9 likes in total. All 4 comments are spam bots, still up, unanswered</p>${likesChart()}</div>
  </div>
  <h3>Every account and listing at a glance</h3>
  ${healthGrid()}
  <div class="row" style="margin-top:8px">
    <div><h3 style="margin-top:0">Social: what is right</h3><ul class="f">
      <li>Posting on all four accounts every weekday; all posted on 27 Oct.</li>
      <li>The same orange-sun skyline logo everywhere, and every footer link works.</li>
      <li>Real team photos (ATV day, jet skis, pickleball), not stock.</li>
      <li>The X hiring post links /apply/ and the text line, and the link can be tapped.</li>
      <li>No income claims, no "be your own boss", no luxury-lifestyle posts in anything visible.</li>
    </ul></div>
    <div><h3 style="margin-top:0">Social: what is wrong, and the fix</h3><ul class="f">
      <li><b>One hiring post in 19 days</b>, with no role, pay, hours or job type. <span class="fix">A weekly hiring post with those facts.</span></li>
      <li><b>The same caption on every platform,</b> up to 12 hashtags, mostly quotes. <span class="fix">Write for each platform; 3–5 hashtags.</span></li>
      <li><b>Spam comments left up.</b> <span class="fix">Delete; turn on Instagram's comment filter.</span></li>
      <li><b>Bio and link talk to clients.</b> <span class="fix">"Now hiring in Charlotte" + link to Apply.</span></li>
    </ul></div>
  </div>
  <h3>Social and listings: housekeeping</h3>
  <ul class="f" style="columns:2;column-gap:16px">
    <li><b>Google profile</b> is named just "Horizon", lists "Ste 321" that the website leaves out, and has posting (reviews) turned off. <span class="fix">Full name, matching address; find out why reviews are off.</span></li>
    <li><b>LinkedIn</b> says "Public Company" with no headquarters; the site links it by number, which hits the sign-in wall. <span class="fix">Privately held, address, the named link.</span></li>
    <li><b>Facebook</b> has no username, and the site links it with a tracking URL. <span class="fix">Claim a username.</span></li>
    <li><b>X has 84 posts and 0 followers.</b> <span class="fix">Put the time into Instagram and LinkedIn; ask the team to follow.</span></li>
    <li><b>Post designs don't fit Instagram's grid;</b> no video at all. <span class="fix">Design at 1080 × 1350; short Reels of the team.</span></li>
  </ul>
  <h3>One company, five names: settle it before HOPE adds a sixth</h3>
  <table class="t"><tr><th>Where</th><th>Name shown</th><th>Handle or address</th><th>Category it picked</th></tr>
    <tr><td>Website</td><td>Horizon</td><td>horizonoutreachpartners.com</td><td>"sales agency" (home), "marketing agency" (blog)</td></tr>
    <tr><td>Instagram</td><td>Horizon Outreach Partners and Events</td><td>@horizonhopeinc</td><td>—</td></tr>
    <tr><td>Facebook</td><td>Horizon Outreach Partners and Events | Charlotte NC</td><td>no username (a number)</td><td>Advertising/Marketing</td></tr>
    <tr><td>X</td><td>Horizon</td><td>@Horizon_opsales</td><td>Professional Services</td></tr>
    <tr><td>LinkedIn</td><td>Horizon</td><td>/company/horizon-outreach-partners</td><td>Marketing Services, "Public Company"</td></tr>
    <tr><td>Google</td><td>Horizon</td><td>2459 Wilkinson Blvd Ste 321</td><td>Business to business service</td></tr></table>
  <div class="foot">Sources: Instagram, Facebook, X, LinkedIn, Google Maps, BBB, TikTok, YouTube and Threads, viewed logged out on 28 Oct 2026; counts a platform hides when logged out (older posts, first-post dates) were not estimated. Houston figures from its own Instagram and X profiles. <span class="pg">3 / 5</span></div>
</div>

<div class="page">
  <div class="ptitle">The HOPE site and a second Indeed account</div>
  <p style="margin:0 0 5px">The idea: a second website under HOPE so Horizon can open a second Indeed employer account and get more applicants. Indeed's own guidance speaks to this directly:</p>
  <div class="quote">Among reasons a job post may be flagged: <b>"posting identical or very similar roles from multiple employer accounts"</b>, and "listing the same vacancy multiple times with different or only slightly varied titles." <span style="color:${C.ink2}">Indeed, "Why is my job flagged", updated 26 Oct 2026</span></div>
  <div class="quote">"Each position should typically be represented by a single, active post." "Ensure the company name and job title are accurate reflections of the business and role." <span style="color:${C.ink2}">Indeed, "Job Posting Rules and Policies", updated 8 Apr 2026</span></div>
  <p style="margin:4px 0 5px;font-size:8.8pt">What can follow: posts hidden or pushed down, paid sponsorship required, free visibility lost, and Indeed "may disable any company's account, for any or no reason." With the same jobs on both accounts, <b>the main Horizon account is exposed too</b>. That it has worked elsewhere may only mean it hasn't been caught yet.</p>
  <h3>Three ways to get more applicants within the rules</h3>
  <div class="three">
    <div class="opt"><b>1. HOPE as a real second brand<span class="tag g">Within the rules</span></b>HOPE hires for genuinely different roles (for example event staff) with its own posts, once per real location, under an accurate company name.</div>
    <div class="opt"><b>2. One account, much better posts<span class="tag g">Within the rules</span></b>Real titles, pay shown and explained, the actual location, door-to-door or event work stated plainly. Sponsor the best posts. The rules above already restrict vague "marketing" titles.</div>
    <div class="opt"><b>3. A HOPE careers site that feeds the same account<span class="tag g">Within the rules</span></b>The way Vector Marketing runs workforstudents.com: a recruiting site and its own ads, naming the parent company, sending applicants to the same Indeed account and form.</div>
  </div>
  <div class="row" style="margin-top:8px">
    <div class="card"><h2>Is the HOPE name free?</h2><p class="sub">Quick checks, 28 Oct (a knockout search, not legal clearance)</p><ul class="f" style="font-size:8.3pt">
      <li><b>Trademarks:</b> 450 live US marks in marketing and business services contain HOPE; <b>HOPE EVENTS</b> is registered for arranging promotional events (Hope Media Group, reg. 8137790). Nothing filed as HORIZON OUTREACH PARTNERS.</li>
      <li><b>Handles:</b> @hope, @hope_outreach, @hope.outreach, @horizonhope taken on Instagram; @HOPEOutreach and @HorizonHOPE taken on X. @hopeoutreach and @hopeoutreachpartners look free on Instagram (confirm signed in).</li>
      <li><b>Domains:</b> hopeoutreachpartners.com, joinhopeteam.com and careerswithhope.com have no registration record; hopeoutreach.com, joinhope.com and hopeevents.com are taken. Nothing was bought.</li>
      <li><b>Advice:</b> a compound name ("HOPE Outreach Partners"), checked by an attorney before any filing or printing.</li>
    </ul></div>
    <div class="card"><h2>To settle on the Zoom call</h2><p class="sub">What we need from Horizon to start</p><ul class="f" style="font-size:8.3pt">
      <li>The exact legal name and state of the company (we found a North Carolina LLC listing but could not open the state record).</li>
      <li>Who owns the current Indeed account, and the roles, pay structure and locations being hired for.</li>
      <li>Whether staff collect donations for charities: in North Carolina, paid solicitors need a state licence (G.S. 131F-16).</li>
      <li>Why Google reviews are turned off on the profile.</li>
      <li>Access as a user (not passwords) to WordPress.com, Google, Meta, LinkedIn and Indeed, and who approves posts and spend.</li>
    </ul></div>
  </div>
  <h3>How we can help: the plan</h3>
  ${planTimeline()}
  <div class="foot">Sources: indeed.com/hire/resources/howtohub/job-flagged-on-indeed and /indeed-rules-and-policies-for-employers, viewed 28 Oct 2026; USPTO trademark search; RDAP domain records; Instagram, X and TikTok handle checks; workforstudents.com; N.C. Gen. Stat. 131F-2 and 131F-16. Full audit, evidence and fact-check logs available on request. <span class="pg">4 / 5</span></div>
</div>

<div class="page">
  <div class="ptitle">Search: how Google finds Horizon</div>
  <div class="row">
    <div class="card"><h2>Searching the company's own name</h2><p class="sub">Google, "Horizon Outreach Partners" in quotes, 28 Oct (searched from Denver; results vary by place)</p>
      <ul class="f" style="font-size:8.4pt">
        <li><b>Google's AI summary at the top gets Horizon right:</b> Charlotte address, phone, services, and a note not to confuse it with the Houston nonprofit. It cites the website and Instagram.</li>
        <li><b>But the website is not in the ten regular results on page 1.</b> They go to other "Horizon" companies: the Houston nonprofit's Facebook, Horizon Counseling, Horizon Work Partners, an investment bank, a HubSpot partner and others.</li>
        <li><b>Google suggests "Horizon outreach partners reviews"</b> as a related search. There are none to find: the Google profile has reviews turned off, and there is no Indeed, Glassdoor or BBB page we could confirm.</li>
        <li>A search for the job (for example "sales jobs Charlotte") has nothing on the site to match: no page names a job, a pay range or the city in its title or headings.</li>
      </ul></div>
    <div class="card"><h2>What Google is being sent</h2><p class="sub">The site's own indexing settings, checked 28 Oct</p>
      <table class="t"><tr><th>Check</th><th>Finding</th></tr>
        <tr><td>Google verification</td><td>2 Google records on the domain (Search Console or the Google email setup; ask which)</td></tr>
        <tr><td>Sitemaps</td><td>3 listed, from 2 plugins at once (Jetpack and Rank Math)</td></tr>
        <tr><td>Sent to Google that shouldn't be</td><td>a page-header template, the empty "Uncategorized" page, 62 images including the theme's demo pictures</td></tr>
        <tr><td>Old address</td><td>a blog post's old address still listed by search engines, now a 404</td></tr>
        <tr><td>Page titles</td><td>"Home - Horizon", "Contact - Horizon"… no city, no job</td></tr>
        <tr><td>Main headings</td><td>none on any of the 8 main pages</td></tr>
        <tr><td>Job markup for Google Jobs</td><td>none, so roles can't appear in Google's job search</td></tr>
        <tr><td>Business markup</td><td>name "Horizon" and a logo only: no address, phone or profiles</td></tr>
        <tr><td>Image descriptions</td><td>23 of 40 images have none</td></tr></table></div>
  </div>
  <h3>Search: what is wrong, and the fix</h3>
  <div class="row" style="margin-bottom:4px">
    <ul class="f">
      <li><b>"Horizon" is too common to rank for.</b> Dozens of Horizons and a same-name nonprofit outrank it. <span class="fix">Use the full name plus Charlotte in titles, headings, the Google profile and every account.</span></li>
      <li><b>Nothing targets job seekers.</b> <span class="fix">A careers page per role ("Field Sales Jobs in Charlotte, NC"), with Google job markup so each role shows free in Google's job search.</span></li>
      <li><b>Search Console status unknown.</b> <span class="fix">Confirm Search Console (and add Bing Webmaster Tools); submit one sitemap; watch which pages are indexed.</span></li>
    </ul>
    <ul class="f">
      <li><b>Mixed signals to Google:</b> two sitemap plugins, template and demo files listed, an old 404. <span class="fix">One sitemap, junk taken out, the old address redirected.</span></li>
      <li><b>Business details not marked up.</b> <span class="fix">Full company markup: legal name, address, phone, hours, links to each account.</span></li>
      <li><b>No reviews anywhere searchers look.</b> <span class="fix">Sort out why Google reviews are off; claim Indeed and Glassdoor; ask happy staff and clients for honest reviews (never paid or scripted).</span></li>
    </ul>
  </div>
  <div class="card"><h2>Usernames and links: one company, mismatched handles</h2><p class="sub">Like many new accounts, Horizon's addresses don't match its name. Pick one name and claim it everywhere before HOPE adds more</p>
    <table class="t"><tr><th>Account</th><th>Address today</th><th>Problem</th><th>Fix</th></tr>
      <tr><td>Instagram</td><td>@horizonhopeinc</td><td>Doesn't match the name; "inc" may not match the company type</td><td>@horizonoutreachpartners looked free (confirm signed in)</td></tr>
      <tr><td>X</td><td>@Horizon_opsales</td><td>"opsales" appears nowhere else; 0 followers</td><td>Rename to the shared name (X allows 15 characters)</td></tr>
      <tr><td>Facebook</td><td>facebook.com/profile.php?id=61590111627482</td><td>No username; the site links a long share URL with tracking codes</td><td>Claim a username; link the clean address</td></tr>
      <tr><td>LinkedIn</td><td>/company/horizon-outreach-partners</td><td>Good address, but the site links the numbered one, which hits the sign-in wall</td><td>Link the named address</td></tr>
      <tr><td>Website author page</td><td>/author/donnyparada1088/</td><td>The owner's personal username, public on every page</td><td>Change the author name and address</td></tr></table></div>
  <div class="foot">Sources: Google search for "Horizon Outreach Partners" (in quotes) on 28 Oct 2026, logged out, from a Denver location; the site's robots.txt, sitemaps and page code; Google public DNS records; logged-out checks of each account. Rankings vary by location and day. <span class="pg">5 / 5</span></div>
</div>
</body></html>`;
writeFileSync(new URL('./horizon-audit.html', import.meta.url), html);
console.log('written');

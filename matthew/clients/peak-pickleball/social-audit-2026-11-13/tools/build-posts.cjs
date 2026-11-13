/* Builds posts-30d.csv (one row per post, 14 Oct - 13 Nov 2026) from the logged-out captures in ../captures.
   Counts are as captured on 13 Nov 2026 (22:48-23:00 UTC). Topic and format are our reading of each post.
     node tools/build-posts.cjs                                                                                   */
const fs = require('fs'); const path = require('path');
const A = path.join(__dirname, '..'); const C = path.join(A, 'captures');

function metas(file) {
  const t = fs.readFileSync(path.join(C, file), 'utf8');
  const sec = t.split('== META ==')[1].split('== TIMES ==')[0];
  const out = {}; let k = null;
  for (const line of sec.split('\n')) {
    const m = line.match(/^([a-z:]+) = (.*)$/);
    if (m) { k = m[1]; out[k] = m[2]; } else if (k) out[k] += '\n' + line;
  }
  for (const key in out) out[key] = out[key].replace(/\n+$/, '');
  return out;
}
function igCaption(file) {
  const m = metas(file);
  const ogt = m['og:title'] || '';
  const i = ogt.indexOf(': "');
  if (i >= 0) return ogt.slice(i + 3).replace(/"$/, '');
  return m['og:description'] || '';
}
const fb = JSON.parse(fs.readFileSync(path.join(C, 'facebook-peak-posts-parsed.json'), 'utf8'));
const fbBy = (prefix) => fb.find((r) => r.msg.startsWith(prefix));
const tagCount = (s) => (s.match(/#[\p{L}\p{N}_]+/gu) || []).length;
const len = (s) => [...s].length;

// Instagram: likes/comments are the counters on each logged-out post page (description meta or the counter line).
const IG = [
  ['DexTqFyoz7e', 'p', '2026-10-21 14:51', 'photo (carousel, 4)', 'membership offer (Peak Flex)', 8, 0, 'none', '', 'Meta label "AI content"'],
  ['De0G_S6OdAE', 'p', '2026-10-22 17:03', 'photo', 'event: Veterans Tournament registration', 7, 1, 'register on website (Events)', 'link left as Peak\'s own comment', 'pinned; the 1 comment is Peak\'s own link'],
  ['De9zYdrADag', 'reel', '2026-10-26 11:26', 'reel', 'partner/nonprofit: Give \'Em Heaven, veterans open play + tournament', 31, 3, 'registration required (no link)', '', 'pinned; best IG post of the window'],
  ['DfFwEQRI0-W', 'p', '2026-10-29 13:24', 'photo + video (carousel)', 'event: Halloween Courtside Social (31 Oct)', 10, 0, 'tag your partner', '', 'Meta label "AI content"; posted 2 days before the event'],
  ['Dfab4K8o5wg', 'p', '2026-11-06 13:16', 'photo (carousel)', 'event coverage: Veterans Tournament day 1', 29, 5, 'none', '', 'no reply from Peak visible'],
  ['DfdH0aeANiw', 'reel', '2026-11-07 14:17', 'reel', 'event coverage: Veterans Tournament day 2', 22, 0, 'none', '', 'Meta label "AI content"'],
  ['DffGiMeFsjx', 'p', '2026-11-08 08:41', 'photo (carousel)', 'event coverage: medalists', 20, 0, 'none', '', ''],
  ['DffZV4Qg4DL', 'reel', '2026-11-08 11:26', 'reel', 'event coverage: veteran player story + veterans play times', 16, 0, 'veterans play times, address (no link)', '', ''],
  ['Dff_owPI_uj', 'p', '2026-11-08 17:00', 'photo (carousel)', 'event coverage: medalists', 18, 1, 'none', '', 'no reply from Peak visible'],
  ['DfkbODLIw17', 'p', '2026-11-10 10:18', 'photo (carousel)', 'event coverage: medalists', 9, 1, 'none', '', 'no reply from Peak visible'],
  ['DfkliHWAGB_', 'reel', '2026-11-10 12:02', 'reel', 'event coverage: tournament recap', 10, 0, 'none', '', 'Meta label "AI content"; not on Facebook'],
  ['DfnC9NeArUz', 'p', '2026-11-11 10:44', 'photo', 'holiday: Veterans Day', 3, 0, 'none', '', ''],
];
// Facebook page: reactions / comments / shares from the page's own timeline data (graphql), plays from the Reels tab.
const FBROWS = [
  ['2026-10-21 14:51', 'MORE PLAY', 'photo (album, 4)', 'membership offer (Peak Flex)', '', 'Meta label "AI content"'],
  ['2026-10-22 17:01', 'The 5th Annual Veterans', 'photo', 'event: Veterans Tournament registration', '', 'no link in the post'],
  ['2026-10-26 11:24', '🇺🇸 Honoring those who served', 'reel', 'partner/nonprofit: Give \'Em Heaven, veterans open play + tournament', '1.5K', 'best FB post of the window (28 reactions, 7 shares)'],
  ['2026-10-29 13:24', 'Here’s the treat', 'photo + video (album)', 'event: Halloween Courtside Social (31 Oct)', '', 'Meta label "AI content"'],
  ['2026-11-06 13:25', 'Quick look at the action', 'photo (album, 18)', 'event coverage: Veterans Tournament day 1', '', ''],
  ['2026-11-08 08:41', 'Yesterday’s top six', 'photo (album, 6)', 'event coverage: medalists', '', ''],
  ['2026-11-08 08:45', 'November 5th, 2026', 'share of owner\'s personal post', 'Golden Ticket May 2027 (owner\'s post)', '', 'shared from the owner\'s profile; counts are the owner\'s post'],
  ['2026-11-08 08:50', 'Day 2 was electric', 'reel', 'event coverage: Veterans Tournament day 2', '907', 'posted the morning after the IG version'],
  ['2026-11-08 11:26', 'Honoring Andrew Lewis', 'reel', 'event coverage: veteran player story + veterans play times', '820', ''],
  ['2026-11-08 17:00', 'Yesterdays medalist', 'photo (album, 5)', 'event coverage: medalists', '', ''],
  ['2026-11-10 10:18', 'Swipe to see your mixed', 'photo (album, 8)', 'event coverage: medalists', '', ''],
];
// Facebook 11 Nov post is in the page's first-load HTML, not the graphql capture: counts read from the rendered timeline text.
const FB_NOV11 = { t: '2026-11-11 10:44', caption: igCaption('ig-post-DfnC9NeArUz.txt'), rc: 8, cc: 1, sc: '', fmt: 'photo', topic: 'holiday: Veterans Day', note: 'counts from rendered timeline (facebook-peak.txt); no reply from Peak visible on the 1 comment' };
// Threads: the 7 threads after 22 Oct (38 -> 45), plus 21 Oct (already counted on 22 Oct). Logged-out view shows no like counts.
const TH = [
  ['2026-10-21 14:51', 'MORE PLAY'], ['2026-11-06 13:12', 'Quick look at the action'], ['2026-11-07 14:18', 'Day 2 was electric'],
  ['2026-11-08 08:41', 'Yesterday’s top six'], ['2026-11-08 11:26', 'Honoring Andrew Lewis'], ['2026-11-10 10:18', 'Swipe to see your mixed'],
  ['2026-11-10 12:02', 'The 5th Annual Veterans Tournament 💪'], ['2026-11-11 10:44', 'Today, we honor'],
];

const rows = [];
const head = ['date_mt', 'time_mt', 'platform', 'format', 'topic', 'caption_chars', 'hashtags', 'cta_or_link', 'likes_or_reactions', 'comments', 'shares', 'views_or_plays', 'peak_reply_seen', 'also_posted_on', 'url', 'evidence', 'notes'];
const igCaps = {};
for (const [id, kind, dt, fmt, topic, likes, comments, cta, link, note] of IG) {
  const cap = igCaption(`ig-post-${id}.txt`); igCaps[id] = cap;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const prefix = norm(cap).slice(0, 30);
  const onFb = fb.some((r) => norm(r.msg).startsWith(prefix)) || id === 'DfnC9NeArUz';
  const onTh = TH.some(([, p]) => cap.startsWith(p) && (p.length > 12 || !cap.startsWith('The 5th Annual Veterans P')));
  rows.push([dt.slice(0, 10), dt.slice(11), 'Instagram', fmt, topic, len(cap), tagCount(cap), cta + (link ? ` (${link})` : ''), likes, comments, '', 'not public logged out', comments > 0 && id !== 'De0G_S6OdAE' ? 'no' : 'n/a', [onFb && 'Facebook', onTh && 'Threads'].filter(Boolean).join('; '), `https://www.instagram.com/peakpickleball.us/${kind}/${id}/`, `captures/ig-post-${id}.txt`, note]);
}
for (const [dt, prefix, fmt, topic, plays, note] of FBROWS) {
  const r = fbBy(prefix); if (!r) throw new Error('no fb ' + prefix);
  const isShare = /share/.test(fmt);
  rows.push([dt.slice(0, 10), dt.slice(11), 'Facebook', fmt, topic, r.len, r.tags, '', r.rc, r.cc, r.sc, plays, (+r.cc > 0 && !isShare) ? 'no' : 'n/a', isShare ? '' : 'Instagram' + (TH.some(([, p]) => r.msg.startsWith(p)) ? '; Threads' : ''), r.url || '', 'captures/facebook-peak-posts-parsed.json; captures/facebook-peak.txt', note]);
}
rows.push([FB_NOV11.t.slice(0, 10), FB_NOV11.t.slice(11), 'Facebook', FB_NOV11.fmt, FB_NOV11.topic, len(FB_NOV11.caption), tagCount(FB_NOV11.caption), '', FB_NOV11.rc, FB_NOV11.cc, '', '', 'no', 'Instagram; Threads', '', 'captures/facebook-peak.txt', FB_NOV11.note]);
for (const [dt, prefix] of TH) {
  const ig = Object.values(igCaps).find((c) => c.startsWith(prefix)) || '';
  const igRow = rows.find((r) => r[2] === 'Instagram' && igCaps[r[14].split('/').filter(Boolean).pop()] === ig);
  rows.push([dt.slice(0, 10), dt.slice(11), 'Threads', 'copy of the Instagram post', igRow ? igRow[4] : '', len(ig), tagCount(ig), '', '', '', '', '', '', igRow && /Facebook/.test(igRow[13]) ? 'Instagram; Facebook' : 'Instagram', 'https://www.threads.com/@peakpickleball.us', dt.startsWith('2026-10-21') ? '../audit-2026-10-22/social/captures/threads-peakpickleball.us-scroll.txt' : 'captures/threads-peakpickleball.us.txt', 'likes not shown logged out']);
}
rows.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]) || a[2].localeCompare(b[2]));
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
fs.writeFileSync(path.join(A, 'posts-30d.csv'), '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n') + '\r\n');
// summary for the report
const by = (p) => rows.filter((r) => r[2] === p);
for (const p of ['Instagram', 'Facebook', 'Threads']) {
  const rs = by(p); const own = rs.filter((r) => !/share/.test(r[3]));
  console.log(p, 'posts', rs.length, 'own', own.length, 'sum likes', own.reduce((s, r) => s + (+r[8] || 0), 0), 'sum comments', own.reduce((s, r) => s + (+r[9] || 0), 0), 'sum shares', own.reduce((s, r) => s + (+r[10] || 0), 0), 'median chars', own.map((r) => +r[5]).sort((a, b) => a - b)[Math.floor(own.length / 2)], 'hashtags', own.map((r) => r[6]).join(' '));
}
console.log(rows.length, 'rows');

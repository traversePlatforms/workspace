// J.A.R.V.I.S. meeting recordings (20 Nov 2026, P-12): one running transcript from the segments whisper.cpp turned into SRT files.
// meeting-worker.sh runs it as   node meeting-assemble.cjs <work folder>   (the folder holds job.json, s<N>.srt, s<N>.dur, s<N>.bad)
// and prints the transcript: a paragraph about every 5 minutes, each starting with the time ("[2:35 pm]" for a live recording, from the
// segment's start on the phone's clock; "[0:05:00]" into an uploaded file), the gaps between segments marked ("[recording paused 2 min]"),
// and any stretch that did not arrive or could not be read said so. One running text: no speaker names. No speech at all gives one line.
'use strict';
const fs = require('fs'), path = require('path');
const W = process.argv[2]; if (!W) { console.error('usage: node meeting-assemble.cjs <work folder>'); process.exit(2); }
const job = JSON.parse(fs.readFileSync(path.join(W, 'job.json'), 'utf8'));
const TZ = job.tz || 'America/Denver', PARA = 300, live = job.source !== 'upload';
const clock = s => new Date(s * 1000).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(/\s?([AP])M$/i, (m, x) => ' ' + x.toLowerCase() + 'm');
const hms = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const len = s => { s = Math.round(s); if (s < 60) return s + ' s'; const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min'; };
const WHY = { pause: ' (paused by you)', call: ': the phone interrupted it', hidden: ': J.A.R.V.I.S. was not on screen', ended: ': the microphone was taken', muted: ': the microphone was taken', error: ': the recorder stopped', reload: ': the page was reopened' };
function srt(f) {
  if (!fs.existsSync(f)) return null;
  const out = [];
  for (const b of fs.readFileSync(f, 'utf8').replace(/\r/g, '').split(/\n\n+/)) {
    const m = /(\d+):(\d\d):(\d\d)[,.](\d{3})\s*-->/.exec(b); if (!m) continue;
    const t = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const text = b.split('\n').filter(l => l && !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join(' ')
      .replace(/\[BLANK_AUDIO\]|\[ ?silence ?\]|\(silence\)/gi, '').replace(/\s+/g, ' ').trim();
    if (text) out.push({ t, text });
  }
  return out;
}
const paras = []; let spoke = false, prevEnd = null, elapsed = 0;
for (const g of job.segs || []) {
  const dur = +(fs.existsSync(path.join(W, 's' + g.seg + '.dur')) ? fs.readFileSync(path.join(W, 's' + g.seg + '.dur'), 'utf8') : 0) || 0;
  /* the gap before this segment: from the clocks when both ends are known, else what the page said */
  let gap = 0; if (paras.length || prevEnd != null) gap = live && g.t && prevEnd != null ? g.t - prevEnd : (g.gap || 0);
  if (gap >= 20 && (paras.length || prevEnd != null)) paras.push('[recording paused ' + len(gap) + (WHY[g.why] || '') + ']');
  if (g.skip) { paras.push('[a stretch of the recording did not arrive]'); if (g.t) prevEnd = g.t; continue; }
  if (fs.existsSync(path.join(W, 's' + g.seg + '.bad'))) { paras.push('[a stretch of the recording could not be read' + (dur ? ', about ' + len(dur) : '') + ']'); prevEnd = g.t ? g.t + dur : prevEnd; elapsed += dur; continue; }
  const cues = srt(path.join(W, 's' + g.seg + '.srt')) || [];
  let cur = null, curAt = -1e9;
  for (const c of cues) {
    if (!cur || c.t - curAt >= PARA) { if (cur) paras.push(cur); curAt = c.t; cur = '[' + (live && g.t ? clock(g.t + c.t) : hms(elapsed + c.t)) + '] ' + c.text; }
    else cur += ' ' + c.text;
    spoke = true;
  }
  if (cur) paras.push(cur);
  if (g.missing > 0) paras.push('[part of this stretch did not arrive' + (live ? ', about ' + len(g.missing * 30) : '') + ']');
  prevEnd = g.t ? g.t + dur : (prevEnd != null ? prevEnd + dur : null); elapsed += dur;
}
if (!spoke) { paras.length = 0; paras.push('[No speech was heard in this recording.]'); }
process.stdout.write(paras.join('\n\n') + '\n');

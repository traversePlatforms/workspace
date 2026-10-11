// Turns a recording (out/<story>/timeline.json + frames) into the finished video: 1080x1920, the phone in a frame, a caption
// per scene with its time of day, and a held end card. Also writes the voice-over script and captions (.srt).
//   node build.mjs <story> [--name TraverseRoofing] [--tag "A day on the doors"] [--end "..."]
import { readFileSync, writeFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path';
import { chrome, attach, session, sleep } from './lib.mjs';
const STORY = process.argv[2]; const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg('name', 'TraverseRoofing'), TAG = arg('tag', 'A day on the doors'), END = arg('end', 'The whole day on the doors, in one app');
const FF = 'C:/Users/Surge Inc/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUT = resolve('out', STORY); const T = JSON.parse(readFileSync(join(OUT, 'timeline.json'), 'utf8'));
const HOLD = 3.5;                                   /* seconds the last frame is held for the end card */
const VW = 1080, VH = 1920;
const SH = 1440, SW = Math.round(T.w / T.h * SH / 2) * 2, SX = Math.round((VW - SW) / 2), SY = 400;

/* 1. the frame: a solid background with a rounded hole for the screen, drawn by Chrome with a transparent page */
{
  const port = 9800 + Math.floor(Math.random() * 40); const ch = chrome(port);
  const P = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await P.ready; await P.send('Page.enable');
  await P.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  await P.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const u = 'file:///' + resolve('frame.html').replace(/\\/g, '/') + `?x=${SX}&y=${SY}&w=${SW}&h=${SH}&name=${encodeURIComponent(NAME)}&tag=${encodeURIComponent(TAG)}`;
  await P.send('Page.navigate', { url: u }); await sleep(1200);
  writeFileSync(join(OUT, 'frame.png'), Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  ch.kill();
}

/* 2. the screen recording as a concat list: each frame lasts until the next one arrives */
const fr = T.frames; const end = T.end / 1000 + HOLD;
let list = '';
fr.forEach((f, i) => { const next = i + 1 < fr.length ? fr[i + 1].t / 1000 : end; list += `file '${resolve(f.f).replace(/\\/g, '/')}'\nduration ${Math.max(0.001, next - f.t / 1000).toFixed(3)}\n`; });
list += `file '${resolve(fr[fr.length - 1].f).replace(/\\/g, '/')}'\n`;
writeFileSync(join(OUT, 'frames.txt'), list);

/* 3. captions: one per scene, wrapped by hand (drawtext does not wrap), shown until the next scene */
const wrap = (s, n) => { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out.join('\n'); };
const caps = T.timeline.map((s, i) => ({ ...s, a: s.t / 1000, b: i + 1 < T.timeline.length ? T.timeline[i + 1].t / 1000 : T.end / 1000 }));
caps.push({ clock: '', caption: END, a: T.end / 1000, b: end, vo: '' });
const font = (f) => `fontfile='C\\:/Windows/Fonts/${f}'`;
let filt = `color=c=0x111821:s=${VW}x${VH}:r=30[bg];[0:v]fps=30,scale=${SW}:${SH}:flags=lanczos,setsar=1[scr];[bg][scr]overlay=${SX}:${SY}:shortest=1[a];[a][1:v]overlay=0:0[b]`;
let last = 'b';
caps.forEach((c, i) => {
  const ct = `cap${String(i).padStart(2, '0')}.txt`, kt = `clk${String(i).padStart(2, '0')}.txt`;
  writeFileSync(join(OUT, ct), wrap(c.caption, 30)); writeFileSync(join(OUT, kt), c.clock || ' ');
  const en = `enable='between(t,${c.a.toFixed(2)},${(c.b - 0.01).toFixed(2)})'`;
  const fade = `alpha='min(1,(t-${c.a.toFixed(2)})/0.35)'`;
  filt += `;[${last}]drawtext=${font('seguisb.ttf')}:textfile=${kt}:fontcolor=0xE4703A:fontsize=36:x=72:y=128:${fade}:${en}[k${i}]`;
  filt += `;[k${i}]drawtext=${font('segoeuib.ttf')}:textfile=${ct}:fontcolor=white:fontsize=56:line_spacing=10:x=72:y=180:${fade}:${en}[c${i}]`;
  last = 'c' + i;
});
writeFileSync(join(OUT, 'filter.txt'), filt);
const mp4 = `${STORY}.mp4`;
execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-loop', '1', '-i', 'frame.png',
  '-/filter_complex', 'filter.txt', '-map', `[${last}]`, '-t', end.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { cwd: OUT, stdio: 'inherit' });

/* 4. the voice-over script and the captions file */
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const srtT = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
let md = `# Voice-over script: ${STORY}\n\nVideo length ${mmss(end)}. Each line starts when its caption appears. "Room" is the seconds the scene lasts; at an easy pace\na line needs about one second for every 2.5 words, so a line marked TIGHT should be read quickly or trimmed.\n\n| Starts | Time of day | On screen | Say | Room |\n|---|---|---|---|---|\n`;
let srt = '';
caps.forEach((c, i) => {
  const room = c.b - c.a, words = (c.vo || '').split(/\s+/).filter(Boolean).length, need = words / 2.5;
  md += `| ${mmss(c.a)} | ${c.clock || '—'} | ${c.caption} | ${c.vo || '—'} | ${room.toFixed(0)} s${words && need > room ? ' TIGHT' : ''} |\n`;
  srt += `${i + 1}\n${srtT(c.a)} --> ${srtT(c.b)}\n${c.clock ? c.clock + ' · ' : ''}${c.caption}\n\n`;
});
writeFileSync(join(OUT, `${STORY}-voiceover.md`), md); writeFileSync(join(OUT, `${STORY}.srt`), srt);
console.log(`built ${join(OUT, mp4)} (${mmss(end)})`);

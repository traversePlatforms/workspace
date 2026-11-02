// Builds the demo-editions video from the recording (record-demo.mjs --record) and the voice (voice-demo.mjs), 2 Nov 2026:
// each scene is the 16:9 frame (frame-16x9.html: brand, edition label, caption) with its screen recordings laid in the screen boxes
// (rounded like the frame), its voice line from 0.3 s, a short fade at each end; title cards are held stills. Then one MP4 (H.264 + AAC,
// faststart, YouTube-friendly), the captions (.srt, the exact voice lines) and a 1280x720 thumbnail from a real app screen.
//   node build-demo.mjs        -> ../demo-editions/out/traverse-demo-v1.mp4, .srt, thumbnail.png
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
import { chrome, attach, session, sleep } from './lib.mjs';
import { SCENES } from './story-demo-editions.mjs';
const FF = 'C:/Users/Surge Inc/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUT = resolve('out/demo-editions'), REC = join(OUT, 'rec'), WORK = join(OUT, 'build'), FINAL = resolve('../demo-editions/out');
rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true }); mkdirSync(FINAL, { recursive: true });
const T = JSON.parse(readFileSync(join(REC, 'timeline.json'), 'utf8'));
const VOICE = JSON.parse(readFileSync(join(OUT, 'voice/voice.json'), 'utf8'));
const byN = Object.fromEntries(T.scenes.map((r) => [r.n, r]));
/* the screens' boxes: the same numbers as BOX in frame-16x9.html (keep the two in step) */
const BOX = { desk: { desk: [256, 96, 1408, 880, 10] }, deskphone: { desk: [64, 128, 1312, 820, 10], phone: [1468, 100, 390, 844, 44] }, phone: { phone: [1200, 96, 410, 888, 44] } };
const CARD_SECS = { 1: 2.8, 5: 2.4, 21: 1.7 };   /* silent cards; a voiced card lasts its line and a beat */
const VO_START = 0.3, FADE = 0.25;
const run = (args) => execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

/* 1. the frames, cards and screen masks, drawn by Chrome */
const port = 9850 + Math.floor(Math.random() * 40); chrome(port);
const C = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await C.ready; await C.send('Page.enable'); await C.send('Runtime.enable');
async function draw(url, w, h, file) {
  await C.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await C.send('Page.navigate', { url }); await sleep(600);
  await C.js(`(async () => { await Promise.all(['700 112px "Familjen Grotesk"', '700 30px "Atkinson Hyperlegible"', '400 40px "Atkinson Hyperlegible"', '500 24px "JetBrains Mono"'].map((x) => document.fonts.load(x))); await document.fonts.ready; return 1; })()`);
  await C.until(`[...document.images].every((i) => i.complete)`, 20000); await sleep(300);
  writeFileSync(file, Buffer.from((await C.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
const frameUrl = (sc) => { const q = new URLSearchParams({ layout: sc.layout }); if (sc.layout === 'card') { for (const k of ['eyebrow', 'title', 'sub', 'foot']) if (sc[k]) q.set(k, sc[k]); } else { q.set('section', sc.section || ''); q.set('cap', sc.cap || ''); } return pathToFileURL(resolve('frame-16x9.html')).href + '?' + q.toString(); };
const masks = {};
for (const [lay, bx] of Object.entries(BOX)) for (const [k, [, , w, h, r]] of Object.entries(bx)) {
  const f = join(WORK, `mask-${w}x${h}.png`); masks[lay + k] = f; if (existsSync(f)) continue;
  await draw('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:#000"><div style="width:${w}px;height:${h}px;background:#fff;border-radius:${r}px"></div></body>`), w, h, f);
}

/* 2. one clip per scene */
/* a scene lasts its voice line plus a look (a shorter look before a title card, so there is no long quiet gap); never longer than it was recorded */
const nextOf = (sc) => SCENES[SCENES.indexOf(sc) + 1];
const secsOf = (sc) => {
  const v = VOICE[sc.n] ? VOICE[sc.n].secs : 0;
  if (sc.layout === 'card') return v ? (sc.n === SCENES[SCENES.length - 1].n ? Math.max(5, v + 1.8) : Math.max(2, v + 0.9)) : (CARD_SECS[sc.n] || 2.0);
  const nx = nextOf(sc), look = nx && nx.layout === 'card' ? 1.1 : 2.2;
  return Math.max(3, Math.min(byN[sc.n].rec.secs, VO_START + v + look));
};
const clips = []; let at = 0; const srt = []; const report = [], chapters = [];
for (const sc of SCENES) {
  const r = byN[sc.n]; if (sc.layout !== 'card' && (!r || !r.ok || !r.rec)) { report.push(`scene ${sc.n}: not recorded (${r ? r.problems.join('; ') : 'missing'}), left out`); continue; }
  const id = String(sc.n).padStart(2, '0'), D = secsOf(sc), png = join(WORK, `frame-${id}.png`), clip = join(WORK, `clip-${id}.mp4`);
  await draw(frameUrl(sc), 1920, 1080, png);
  const inputs = ['-loop', '1', '-framerate', '30', '-t', D.toFixed(3), '-i', png]; let filt = '[0:v]format=rgba[b0]', last = 'b0', n = 1;
  if (sc.layout !== 'card') for (const [k, s] of Object.entries(r.rec.screens)) {
    const [x, y, w, h] = BOX[sc.layout][k]; const list = join(WORK, `frames-${id}-${k}.txt`);
    const fr = s.frames; let txt = '';
    fr.forEach((f, i) => { const next = i + 1 < fr.length ? fr[i + 1].t : D; txt += `file '${f.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.02, next - f.t).toFixed(3)}\n`; });
    txt += `file '${fr[fr.length - 1].f.replace(/\\/g, '/')}'\n`; writeFileSync(list, txt);
    /* each screen first made its own steady 30 fps clip of the scene's length (two image lists in one filter dropped the computer's
       screen in some scenes), then laid in the frame */
    const scr = join(WORK, `screen-${id}-${k}.mp4`);
    run(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-t', D.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', scr]);
    inputs.push('-i', scr, '-loop', '1', '-i', masks[sc.layout + k]);
    filt += `;[${n}:v]format=rgba[s${n}];[${n + 1}:v]format=gray,scale=${w}:${h}[m${n}];[s${n}][m${n}]alphamerge[a${n}];[${last}][a${n}]overlay=${x}:${y}:eof_action=repeat[o${n}]`;
    last = 'o' + n; n += 2;
  }
  const wav = join(OUT, `voice/scene-${id}.wav`), hasVo = !!VOICE[sc.n] && existsSync(wav);
  if (hasVo) inputs.push('-i', wav); else inputs.push('-f', 'lavfi', '-t', D.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
  filt += `;[${last}]fade=t=in:st=0:d=${FADE},fade=t=out:st=${(D - FADE).toFixed(3)}:d=${FADE},format=yuv420p[v]`;
  filt += hasVo ? `;[${n}:a]aresample=48000,adelay=${Math.round(VO_START * 1000)}:all=1,apad,atrim=0:${D.toFixed(3)},aformat=sample_rates=48000:channel_layouts=stereo[a]` : `;[${n}:a]atrim=0:${D.toFixed(3)}[a]`;
  writeFileSync(join(WORK, `filter-${id}.txt`), filt);
  run([...inputs, '-/filter_complex', join(WORK, `filter-${id}.txt`), '-map', '[v]', '-map', '[a]', '-t', D.toFixed(3), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', clip]);
  clips.push(clip);
  if (hasVo) srt.push({ a: at + VO_START, b: at + VO_START + VOICE[sc.n].secs, text: sc.vo });
  report.push(`scene ${id} ${sc.layout.padEnd(9)} ${D.toFixed(1)} s  at ${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')}`);
  const CH = { 1: 'Traverse', 6: 'Roofing', 13: 'Lawn & Landscape', 21: 'Solar', 26: 'The office', 31: 'Book a demo' }; if (CH[sc.n]) chapters.push(`${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, '0')} ${CH[sc.n]}`);
  at += D;
}

/* 3. one video */
const list = join(WORK, 'clips.txt'); writeFileSync(list, clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n') + '\n');
const mp4 = join(FINAL, 'traverse-demo-v1.mp4');
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', mp4]);
const ts = (s) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
/* a cue per sentence; a sentence of more than 16 words split at its comma nearest the middle; timed by each part's share of the words */
const cues = []; for (const c of srt) {
  const nw = (t) => t.split(' ').filter(Boolean).length, total = nw(c.text), parts = [];
  for (const sen of c.text.split(/(?<=[.!?])\s+/)) {
    if (nw(sen) <= 16) { parts.push(sen); continue; }
    const bits = sen.split(/(?<=,)\s+/); let best = 1, bd = 1e9, acc = 0;
    for (let i = 1; i < bits.length; i++) { acc += nw(bits[i - 1]); const d = Math.abs(acc - nw(sen) / 2); if (d < bd) { bd = d; best = i; } }
    parts.push(bits.slice(0, best).join(' '), bits.slice(best).join(' '));
  }
  /* very short sentences ride with the next one */
  const merged = []; for (const p of parts) { if (merged.length && nw(merged[merged.length - 1]) < 5 && nw(merged[merged.length - 1]) + nw(p) <= 18) merged[merged.length - 1] += ' ' + p; else merged.push(p); }
  let t0 = c.a; for (const p of merged) { const t1 = t0 + (c.b - c.a) * nw(p) / total; cues.push({ a: t0, b: t1, text: p }); t0 = t1; }
}
writeFileSync(join(FINAL, 'traverse-demo-v1.srt'), cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join('\n'));

/* 4. the thumbnail: a real app screen (the Roofing house card, masked as recorded) beside the name */
const shot = join(OUT, 'raw/scene-09-desk.png');
const thumbHtml = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@700&family=JetBrains+Mono:wght@500&display=swap"><style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#13294b;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:40px 40px;color:#fff;font-family:'Atkinson Hyperlegible',sans-serif}
.s{position:absolute;left:560px;top:70px;width:900px;height:562px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 10px #0b1526,0 30px 70px rgba(0,0,0,.5)}.s img{width:100%;height:100%;object-fit:cover;object-position:left top}
.e{position:absolute;left:64px;top:150px;font:500 26px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#ff7a45}
h1{position:absolute;left:60px;top:200px;margin:0;width:480px;font:700 84px/1 'Familjen Grotesk',sans-serif;letter-spacing:-.02em}
p{position:absolute;left:64px;top:430px;margin:0;width:460px;font:700 34px/1.25 'Atkinson Hyperlegible',sans-serif;color:#d9e2ef}
.t{position:absolute;left:64px;bottom:60px;font:500 22px 'JetBrains Mono',monospace;color:#c9d6ea}
</style></head><body><div class="s"><img src="${pathToFileURL(shot).href}"></div><div class="e">TRAVERSE</div><h1>Product demo</h1><p>Roofing, Lawn &amp; Landscape and Solar. The sales platform for the field and the office.</p><div class="t">traverseplatforms.com</div></body></html>`;
writeFileSync(join(WORK, 'thumb.html'), thumbHtml);
await draw(pathToFileURL(join(WORK, 'thumb.html')).href, 1280, 720, join(FINAL, 'thumbnail.png'));
writeFileSync(join(FINAL, 'chapters.txt'), chapters.join('\n') + '\n');
console.log(report.join('\n'));
console.log('chapters:\n' + chapters.join('\n'));
console.log(`built ${mp4} (${Math.floor(at / 60)}:${String(Math.round(at % 60)).padStart(2, '0')})`);
process.exit(0);

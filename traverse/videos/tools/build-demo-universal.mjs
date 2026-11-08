// Builds the two cuts of the demo-universal video (7 Nov 2026) from one recording (record-demo-universal.mjs --record) and the voice
// (voice-demo-universal.mjs): the website cut (the scenes marked both, about 1:30) and the YouTube cut (every scene, about 2:45).
// Each scene is the 16:9 frame (frame-16x9.html: the Traverse mark, the section label, a caption) with its screen recordings laid in the
// screen boxes; the closing card is a held still. The voice is one track laid on the timeline: a line starts 0.3 s into its scene, and a
// line split over several scenes runs straight on across them (its parts cut at word boundaries, voice-parts.mjs). No opening card: the
// voice starts in the first second. Then H.264 + AAC MP4 (faststart), captions (.srt, the script's exact words), a poster for the site
// cut, a 1280x720 thumbnail from a real app screen, and youtube.md (title, description, chapters).
//   node build-demo-universal.mjs [site|yt]   -> ../demo-universal/out/
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'; import { execFileSync, spawnSync } from 'node:child_process'; import { join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
import { chrome, attach, session, sleep } from './lib.mjs';
import { SCENES, VOICES } from './story-demo-universal.mjs'; import { partRange } from './voice-parts.mjs';
const FF = process.env.FFMPEG || 'ffmpeg', FP = process.env.FFPROBE || 'ffprobe';
/* --preview: a line with no checked clip yet is silence of its estimated length (2.8 words a second), and everything goes to
   out/demo-universal/preview/ (gitignored, never the finished files): to check the pictures and timing before the voice exists */
const PREVIEW = process.argv.includes('--preview');
const OUT = resolve('out/demo-universal'), REC = join(OUT, 'rec'), WORK = join(OUT, PREVIEW ? 'build-preview' : 'build'), FINAL = PREVIEW ? join(OUT, 'preview') : resolve('../demo-universal/out');
mkdirSync(WORK, { recursive: true }); mkdirSync(FINAL, { recursive: true });
const T = JSON.parse(readFileSync(join(REC, 'timeline.json'), 'utf8')); const byN = Object.fromEntries(T.scenes.map((r) => [r.n, r]));
const VOICE = existsSync(join(OUT, 'voice/voice.json')) ? JSON.parse(readFileSync(join(OUT, 'voice/voice.json'), 'utf8')) : {};
const CUTS = ['site', 'yt'].filter((c) => !process.argv.slice(2).some((a) => a === 'site' || a === 'yt') || process.argv.includes(c));
const SILENT = new Set();
for (const sc of SCENES) for (const id of Object.values(sc.voice || {})) if (!VOICE[id] || !VOICE[id].ok) {
  if (!PREVIEW) throw new Error('voice clip ' + id + ' missing or not checked (voice-demo-universal.mjs)');
  if (!SILENT.has(id)) { SILENT.add(id); const t = VOICES[id]; VOICE[id] = { text: t, secs: t.split(/\s+/).length / 2.8, ok: false, words: null }; }
}
if (SILENT.size) console.log('preview: silent stand-ins for ' + [...SILENT].join(', '));
mkdirSync(FINAL, { recursive: true });
/* the screens' boxes: the same numbers as BOX in frame-16x9.html (keep the two in step) */
const BOX = { desk: { desk: [256, 96, 1408, 880, 10] }, deskphone: { desk: [64, 128, 1312, 820, 10], phone: [1468, 100, 390, 844, 44] }, phone: { phone: [1200, 96, 410, 888, 44] } };
const VO_START = 0.3, FADE = 0.25;
const LOOK = { site: 1.1, yt: 2.4 };   /* the look after a line; shorter on the website cut */
const run = (args) => execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const probe = (f) => +execFileSync(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* the frames, card and screen masks, drawn by Chrome */
const port = 9850 + Math.floor(Math.random() * 40); chrome(port);
const C = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await C.ready; await C.send('Page.enable'); await C.send('Runtime.enable');
async function draw(url, w, h, file) {
  await C.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await C.send('Page.navigate', { url }); await sleep(700);
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
const frames = {};
for (const sc of SCENES) { const f = join(WORK, `frame-${String(sc.n).padStart(2, '0')}.png`); await draw(frameUrl(sc), 1920, 1080, f); frames[sc.n] = f; }

/* one silent clip per scene and length; fades only where the voice does not run on into the next scene */
/* a kept clip is reused only if it is newer than its scene's recording (8 Nov: a re-recorded scene came out as the old take) */
const recAt = (sc) => Math.max(0, ...Object.values((byN[sc.n] && byN[sc.n].rec && byN[sc.n].rec.screens) || {}).map((s) => statSync(s.frames[0].f).mtimeMs));
const fresh = (f, sc) => existsSync(f) && statSync(f).mtimeMs > recAt(sc);
function sceneClip(sc, D, fadeIn, fadeOut) {
  const id = String(sc.n).padStart(2, '0'), clip = join(WORK, `clip-${id}-${D.toFixed(2)}-${+fadeIn}${+fadeOut}.mp4`);
  if (fresh(clip, sc)) return clip;
  const inputs = ['-loop', '1', '-framerate', '30', '-t', D.toFixed(3), '-i', frames[sc.n]]; let filt = '[0:v]format=rgba[b0]', last = 'b0', n = 1;
  if (sc.layout !== 'card') for (const [k, s] of Object.entries(byN[sc.n].rec.screens)) {
    const [x, y, w, h] = BOX[sc.layout][k], list = join(WORK, `frames-${id}-${k}.txt`), fr = s.frames; let txt = '';
    fr.forEach((f, i) => { const next = i + 1 < fr.length ? fr[i + 1].t : Math.max(D, f.t + 0.05); txt += `file '${f.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.02, next - f.t).toFixed(3)}\n`; });
    txt += `file '${fr[fr.length - 1].f.replace(/\\/g, '/')}'\n`; writeFileSync(list, txt);
    const scr = join(WORK, `screen-${id}-${k}-${D.toFixed(2)}.mp4`);
    if (!fresh(scr, sc)) run(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-t', D.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', scr]);
    inputs.push('-i', scr, '-loop', '1', '-i', masks[sc.layout + k]);
    filt += `;[${n}:v]format=rgba[s${n}];[${n + 1}:v]format=gray,scale=${w}:${h}[m${n}];[s${n}][m${n}]alphamerge[a${n}];[${last}][a${n}]overlay=${x}:${y}:eof_action=repeat[o${n}]`;
    last = 'o' + n; n += 2;
  }
  filt += `;[${last}]` + [fadeIn ? `fade=t=in:st=0:d=${FADE}` : null, fadeOut ? `fade=t=out:st=${(D - FADE).toFixed(3)}:d=${FADE}` : null, 'format=yuv420p'].filter(Boolean).join(',') + '[v]';
  const ff = join(WORK, `filter-${id}.txt`); writeFileSync(ff, filt);
  run([...inputs, '-/filter_complex', ff, '-map', '[v]', '-t', D.toFixed(3), '-r', '30', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', clip]);
  return clip;
}
const ts = (s) => { const ms = Math.max(0, Math.round(s * 1000)); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

const made = {};
for (const cut of CUTS) {
  const list = SCENES.filter((sc) => sc.cut === 'both' || cut === 'yt').filter((sc) => sc.voice && sc.voice[cut]);
  const plan = [];
  for (const [i, sc] of list.entries()) {
    if (sc.layout !== 'card' && !(byN[sc.n] && byN[sc.n].ok && byN[sc.n].rec)) throw new Error(`scene ${sc.n}: not recorded (${byN[sc.n] ? byN[sc.n].problems.join('; ') : 'missing'})`);
    const id = sc.voice[cut], v = VOICE[id], [a, b] = partRange(v, sc.part);
    const nx = list[i + 1], runsOn = !!(nx && nx.voice[cut] === id && nx.part && sc.part && nx.part[0] === sc.part[1]);
    const cont = !!(sc.part && sc.part[0] > 0 && i > 0 && list[i - 1].voice[cut] === id);
    const lead = cont ? 0 : VO_START, look = runsOn ? 0 : (i === list.length - 1 ? 2.2 : LOOK[cut]);
    let D = lead + (b - a) + look; if (sc.layout === 'card') D = Math.max(5, D);
    if (sc.layout !== 'card') D = Math.min(D, byN[sc.n].rec.secs);
    plan.push({ sc, id, a, b, lead, D, runsOn, cont });
  }
  let at = 0; for (const p of plan) { p.at = at; at += p.D; }
  /* video */
  const clips = plan.map((p) => sceneClip(p.sc, p.D, !p.cont, !p.runsOn));
  const vlist = join(WORK, `clips-${cut}.txt`); writeFileSync(vlist, clips.map((c) => `file '${c.replace(/\\/g, '/')}'`).join('\n') + '\n');
  const vid = join(WORK, `video-${cut}.mp4`); run(['-f', 'concat', '-safe', '0', '-i', vlist, '-c', 'copy', vid]);
  /* the voice track: each part trimmed from its clip and placed */
  const ain = [], af = [];
  plan.forEach((p, k) => { if (SILENT.has(p.id)) ain.push('-f', 'lavfi', '-t', (VOICE[p.id].secs + 1).toFixed(3), '-i', 'anullsrc=r=24000:cl=mono'); else ain.push('-i', join(OUT, 'voice', p.id + '.wav')); af.push(`[${k}:a]atrim=${p.a.toFixed(3)}:${p.b.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round((p.at + p.lead) * 1000)}:all=1[a${k}]`); });
  af.push(plan.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${plan.length}:normalize=0:dropout_transition=0,apad,atrim=0:${at.toFixed(3)}[a]`);
  const aff = join(WORK, `audio-${cut}.txt`); writeFileSync(aff, af.join(';\n'));
  const wav = join(WORK, `voice-${cut}.wav`); run([...ain, '-/filter_complex', aff, '-map', '[a]', '-c:a', 'pcm_s16le', wav]);
  const name = cut === 'site' ? 'traverse-demo-site-v2' : 'traverse-demo-youtube-v2', mp4 = join(FINAL, name + '.mp4');
  run(['-i', vid, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', cut === 'site' ? '22' : '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', cut === 'site' ? '128k' : '160k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', mp4]);
  /* captions: the script's words, a cue per sentence or comma part (16 words at most), timed on the clip's own word timings */
  const cues = [];
  for (const p of plan) {
    const words = VOICES[p.id].split(/\s+/), [w0, w1] = p.sc.part || [0, words.length], W = VOICE[p.id].words && VOICE[p.id].words.length === words.length ? VOICE[p.id].words : null;
    const tOf = (k, end) => W ? (end ? W[k].t1 : W[k].t0) : p.a + (p.b - p.a) * (k - w0 + (end ? 1 : 0)) / (w1 - w0);
    let s0 = w0;
    for (let k = w0; k < w1; k++) {
      const endS = /[.!?]$/.test(words[k]) || k === w1 - 1, endC = /,$/.test(words[k]) && k - s0 >= 6 && w1 - k > 4;
      if (endS || endC || k - s0 >= 15) { cues.push({ a: p.at + p.lead + tOf(s0, false) - p.a, b: p.at + p.lead + tOf(k, true) - p.a + 0.15, text: words.slice(s0, k + 1).join(' ') }); s0 = k + 1; }
    }
  }
  /* very short cues ride with the next one (same scene line) */
  const merged = []; for (const c of cues) { const m = merged[merged.length - 1]; if (m && m.text.split(' ').length < 4 && c.a - m.b < 0.4 && (m.text + ' ' + c.text).split(' ').length <= 16) { m.text += ' ' + c.text; m.b = c.b; } else merged.push({ ...c }); }
  for (let k = 0; k + 1 < merged.length; k++) merged[k].b = Math.min(merged[k].b, merged[k + 1].a - 0.02);
  writeFileSync(join(FINAL, name + '.srt'), merged.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join('\n'));
  made[cut] = { mp4, secs: probe(mp4), plan: plan.map((p) => ({ n: p.sc.n, section: p.sc.section || (p.sc.layout === 'card' ? 'Close' : 'Opening'), shows: p.sc.shows, at: p.at, D: p.D })) };
  console.log(`${cut}: ${mp4} ${mmss(made[cut].secs)} (${made[cut].secs.toFixed(1)} s)`);
  for (const p of made[cut].plan) console.log(`  ${mmss(p.at)}  scene ${String(p.n).padStart(2)}  ${p.D.toFixed(1)} s  ${p.section}`);
  /* the silence check: the longest quiet stretch (under -40 dB) and when the voice first starts */
  const sil = []; let st = null;
  for (const line of spawnSync(FF, ['-hide_banner', '-nostats', '-i', mp4, '-af', 'silencedetect=noise=-40dB:d=0.4', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split(/\r?\n/)) {
    const a = line.match(/silence_start: ([\d.]+)/), b = line.match(/silence_end: ([\d.]+)/);
    if (a) st = +a[1]; if (b && st !== null) { sil.push([st, +b[1]]); st = null; } }
  if (st !== null) sil.push([st, made[cut].secs]);
  const inner = sil.filter(([a, b]) => a > 0.05 && b < made[cut].secs - 0.05), longest = inner.reduce((m, [a, b]) => (b - a > m[1] - m[0] ? [a, b] : m), [0, 0]);
  const first = sil.length && sil[0][0] <= 0.05 ? sil[0][1] : 0;
  console.log(`  voice starts at ${first.toFixed(2)} s; longest quiet gap ${(longest[1] - longest[0]).toFixed(2)} s at ${mmss(longest[0])}${longest[1] - longest[0] > 2.5 ? '  (OVER 2.5 s)' : ''}`);
}

/* the poster (site cut) and the thumbnail (YouTube): real app screens, masked as recorded */
if (made.site) run(['-ss', '1.6', '-i', made.site.mp4, '-frames:v', '1', '-q:v', '3', join(FINAL, 'traverse-demo-site-v2-poster.jpg')]);
if (made.yt) {
  const shot = existsSync(join(OUT, 'raw/scene-06-desk.png')) ? join(OUT, 'raw/scene-06-desk.png') : join(OUT, 'raw/scene-04-desk.png');
  const thumbHtml = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@700&family=JetBrains+Mono:wght@500&display=swap"><style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#13294b;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:40px 40px;color:#fff;font-family:'Atkinson Hyperlegible',sans-serif}
.s{position:absolute;left:560px;top:70px;width:900px;height:562px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 10px #0b1526,0 30px 70px rgba(0,0,0,.5)}.s img{width:100%;height:100%;object-fit:cover;object-position:left top}
.e{position:absolute;left:64px;top:150px;font:500 26px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#ff7a45}
h1{position:absolute;left:60px;top:200px;margin:0;width:480px;font:700 84px/1 'Familjen Grotesk',sans-serif;letter-spacing:-.02em}
p{position:absolute;left:64px;top:430px;margin:0;width:460px;font:700 34px/1.25 'Atkinson Hyperlegible',sans-serif;color:#d9e2ef}
.t{position:absolute;left:64px;bottom:60px;font:500 22px 'JetBrains Mono',monospace;color:#c9d6ea}
</style></head><body><div class="s"><img src="${pathToFileURL(shot).href}"></div><div class="e">TRAVERSE</div><h1>Product demo</h1><p>The all-in-one sales platform for the field and office.</p><div class="t">traverseplatforms.com</div></body></html>`;
  writeFileSync(join(WORK, 'thumb.html'), thumbHtml);
  await draw(pathToFileURL(join(WORK, 'thumb.html')).href, 1280, 720, join(FINAL, 'traverse-demo-youtube-v2-thumbnail.png'));
  /* chapters: where each section starts */
  const ch = []; let last = null;
  /* by the script's sections (a frame label can differ: the office side of the door sentence is labelled The office) */
  const SECT = { 1: 'What Traverse does', 2: 'House facts', 9: 'Plan', 12: 'At the door', 17: 'The office', 21: 'Book a demo' };
  for (const p of made.yt.plan) { const s = SECT[p.n]; if (s && s !== last) { ch.push(`${mmss(p.at)} ${s}`); last = s; } }
  writeFileSync(join(FINAL, 'youtube.md'), `# YouTube: Traverse product demo (v2, universal)\n\nDraft for Matthew to upload himself. Nothing has been uploaded or published.\n\n**File:** traverse-demo-youtube-v2.mp4 (${mmss(made.yt.secs)}), captions traverse-demo-youtube-v2.srt, thumbnail traverse-demo-youtube-v2-thumbnail.png (1280x720).\n\n## Title\n\nTraverse: the all-in-one sales platform for the field and office (product demo)\n\n## Description\n\nTraverse helps your team find the properties most likely to buy, before anyone makes first contact. Every property in your area comes with the facts that matter to your business: storm days with the hail size, the roof's size, pitch and age, new owners, the lawn's size with the property line, how much sun the roof gets and the solar system that fits it, and a whole lot more data points.\n\nPlan the day, assign streets to reps, quote at the door from the property's own size at your own prices, get it signed on the homeowner's phone, take the deposit or send it back to your office team, and run the whole pipeline from the office. Every plan comes with every feature.\n\nSee it with your own area: https://traverseplatforms.com\nBook a demo: (303) 596-9515\n\nThe company, people and prices in this video are made up for the demo; homeowner names and addresses are hidden or replaced.\n\n## Chapters\n\n${ch.join('\n')}\n`);
  console.log('chapters:\n' + ch.join('\n'));
}
process.exit(0);

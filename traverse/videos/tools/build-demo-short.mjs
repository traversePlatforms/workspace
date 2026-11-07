// The short website cut of the demo video (Matthew, 7 Nov 2026: "Create a reduced version for the site so that its not insanely long;
// this one we can use for youtube"). Built from the same scene clips as the full v1 (run build-demo.mjs first), no new recording or voice:
// the hook, Roofing (storm -> houses reached -> assign a street), Lawn & Landscape (the lawn -> quote -> signature -> deposit), end card.
// Left out: the silent opening card (the 3 s quiet), the general "facts / after the knock" scenes, Solar (incl. the phone-screen nit),
// the office, the watering days and job-done/aftercare. The full v1 stays the YouTube cut.
//   node build-demo-short.mjs   -> ../demo-editions/out/traverse-demo-short-v1.mp4 + .srt (+ poster.jpg from the first scene)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path';
import { SCENES } from './story-demo-editions.mjs';
const FF = process.env.FFMPEG || 'ffmpeg', FP = process.env.FFPROBE || 'ffprobe';
const OUT = resolve('out/demo-editions'), WORK = join(OUT, 'build'), FINAL = resolve('../demo-editions/out');
const KEEP = [2, 6, 7, 8, 10, 13, 14, 16, 17, 18, 31];
const VOICE = JSON.parse(readFileSync(join(OUT, 'voice/voice.json'), 'utf8')), VO_START = 0.3;
const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const clips = KEEP.map((n) => { const f = join(WORK, `clip-${String(n).padStart(2, '0')}.mp4`); if (!existsSync(f)) throw new Error('missing ' + f + ' (run build-demo.mjs)'); return { n, f, d: +run(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim() }; });
const list = join(WORK, 'clips-short.txt'); writeFileSync(list, clips.map((c) => `file '${c.f.replace(/\\/g, '/')}'`).join('\n') + '\n');
const mp4 = join(FINAL, 'traverse-demo-short-v1.mp4');
/* re-encoded (not -c copy) so the audio joins without AAC gaps; a little smaller for the web */
run(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', mp4]);
run(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1.5', '-i', clips[0].f, '-frames:v', '1', '-q:v', '3', join(FINAL, 'traverse-demo-short-poster.jpg')]);
/* captions: one cue per sentence, timed by its share of the words in the scene's voice line */
const ts = (s) => { const ms = Math.round(s * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const nw = (t) => t.split(' ').filter(Boolean).length; const cues = []; let at = 0;
for (const c of clips) {
  const sc = SCENES.find((s) => s.n === c.n), v = VOICE[c.n];
  if (v && sc.vo) { const a = at + VO_START, b = a + v.secs, total = nw(sc.vo); let t0 = a; for (const p of sc.vo.split(/(?<=[.!?])\s+/)) { const t1 = t0 + (b - a) * nw(p) / total; cues.push({ a: t0, b: t1, text: p }); t0 = t1; } }
  console.log(`scene ${String(c.n).padStart(2)}  ${c.d.toFixed(1)} s  at ${at.toFixed(1)}`); at += c.d;
}
writeFileSync(join(FINAL, 'traverse-demo-short-v1.srt'), cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.text}\n`).join('\n'));
console.log(`built ${mp4} (${Math.floor(at / 60)}:${String(Math.round(at % 60)).padStart(2, '0')})`);

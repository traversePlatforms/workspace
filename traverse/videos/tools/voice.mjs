// Adds a computer voice-over (Piper, free, runs on this computer) to a built video: each scene's line is spoken from
// its caption's start. Writes <story>-voice-<voice>.mp4 beside the video and reports any line that runs into the next.
//   node voice.mjs <story> <voice> [--rate 1.0]     voice: joe | john | kristin | norman (models in ../voices)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path';
const [STORY, VOICE] = process.argv.slice(2); const ri = process.argv.indexOf('--rate'); const RATE = ri > 0 ? +process.argv[ri + 1] : 1.0;
const PY = 'C:/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe';
const BIN = 'C:/Users/Surge Inc/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/';
const MODEL = resolve('..', 'voices', `en_US-${VOICE}-medium.onnx`);
const OUT = resolve('out', STORY); const T = JSON.parse(readFileSync(join(OUT, 'timeline.json'), 'utf8'));
const dir = join(OUT, 'vo-' + VOICE); mkdirSync(dir, { recursive: true });
const dur = (f) => +execFileSync(BIN + 'ffprobe.exe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const lines = T.timeline.map((s, i) => ({ i, text: s.vo || '', a: s.t / 1000 + 0.35, next: i + 1 < T.timeline.length ? T.timeline[i + 1].t / 1000 : T.end / 1000 + 3.5 })).filter((l) => l.text);
for (const l of lines) {
  l.wav = join(dir, `line${String(l.i).padStart(2, '0')}.wav`);
  /* length_scale > 1 is slower; 1 / RATE so --rate 1.1 is ten per cent faster */
  execFileSync(PY, ['-m', 'piper', '-m', MODEL, '-f', l.wav, '--length-scale', String(+(1 / RATE).toFixed(3)), '--sentence-silence', '0.25'], { input: l.text });
  l.len = dur(l.wav);
}
const total = dur(join(OUT, `${STORY}.mp4`));
const args = ['-y', '-loglevel', 'error', '-i', join(OUT, `${STORY}.mp4`)];
lines.forEach((l) => args.push('-i', l.wav));
const parts = lines.map((l, k) => `[${k + 1}:a]aresample=48000,adelay=${Math.round(l.a * 1000)}|${Math.round(l.a * 1000)},volume=0.8[v${k}]`);
const mix = `${parts.join(';')};${lines.map((_, k) => `[v${k}]`).join('')}amix=inputs=${lines.length}:normalize=0:dropout_transition=0,alimiter=limit=0.89,apad,atrim=0:${total.toFixed(2)}[aud]`;
writeFileSync(join(dir, 'mix.txt'), mix);
const mp4 = join(OUT, `${STORY}-voice-${VOICE}.mp4`);
execFileSync(BIN + 'ffmpeg.exe', [...args, '-/filter_complex', join(dir, 'mix.txt'), '-map', '0:v', '-map', '[aud]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4], { stdio: 'inherit' });
let over = 0;
for (const l of lines) { const room = l.next - l.a; if (l.len > room) { over++; console.log(`  line ${l.i} runs ${(l.len - room).toFixed(1)} s into the next scene: ${l.text.slice(0, 60)}`); } }
console.log(`${mp4}\n${lines.length} lines, ${over} overlapping, voice ${VOICE}, rate ${RATE}`);

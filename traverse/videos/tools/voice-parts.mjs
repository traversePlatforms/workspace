// The voice clips' word timings (7 Nov 2026, demo-universal): whisper.cpp (~/tools/whisper-cpp, Matthew's laptop) transcribes each Gemini
// clip word by word. Two uses: the listen-check (the clip says the script's words and no others: a "Say in a ... voice:" prefix was read
// aloud on about half the v1 clips) and the split of one clip over several scenes at word boundaries (a sentence whose parts need
// different screens keeps its natural reading).
import { execFileSync } from 'node:child_process'; import { existsSync, readFileSync, rmSync } from 'node:fs'; import { homedir, tmpdir } from 'node:os'; import { join } from 'node:path';
const WH = join(homedir(), 'tools', 'whisper-cpp');
export const whisperOn = () => existsSync(join(WH, 'Release', 'whisper-cli.exe')) && existsSync(join(WH, 'models', 'ggml-large-v3-turbo-q5_0.bin'));
export const norm = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* whisper's words with their times (s): [{ w, t0, t1 }] */
export function whisperWords(wav) {
  const tmp = join(tmpdir(), 'vp-' + process.pid + '-' + Date.now()), w16 = tmp + '.wav';
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-ar', '16000', '-ac', '1', w16]);
  execFileSync(join(WH, 'Release', 'whisper-cli.exe'), ['-m', join(WH, 'models', 'ggml-large-v3-turbo-q5_0.bin'), '-f', w16, '-l', 'en', '-ml', '1', '-sow', '-oj', '-of', tmp, '-np'], { stdio: ['ignore', 'ignore', 'ignore'] });
  const j = JSON.parse(readFileSync(tmp + '.json', 'utf8')); rmSync(tmp + '.json', { force: true }); rmSync(w16, { force: true });
  return j.transcription.map((x) => ({ w: x.text.trim(), t0: x.offsets.from / 1000, t1: x.offsets.to / 1000 })).filter((x) => norm(x.w));
}
/* the script's words placed on whisper's times by their letters (whisper may split or join words, so letters are the common ground) */
export function alignWords(text, ww) {
  const sw = text.split(/\s+/).filter(Boolean), out = [];
  const marks = []; let acc = 0; for (const x of ww) { const n = norm(x.w).replace(/ /g, '').length; marks.push({ a: acc, b: acc + n, t0: x.t0, t1: x.t1 }); acc += n; }
  let pos = 0;
  for (const w of sw) {
    const n = norm(w).replace(/ /g, '').length, a = pos, b = pos + Math.max(1, n); pos = b;
    const first = marks.find((m) => m.b > a) || marks[marks.length - 1], last = [...marks].reverse().find((m) => m.a < b) || first;
    out.push({ w, t0: first ? first.t0 : 0, t1: last ? last.t1 : 0 });
  }
  return out;
}
/* the clip's part [first word, last word + 1] as seconds from the clip's start: [from, to] (cut halfway into the pause between words) */
export function partRange(v, part) {
  if (!v) return null;
  if (!part) return [0, v.secs];
  const n = v.text.split(/\s+/).filter(Boolean).length, [a, b] = part;
  if (v.words && v.words.length === n) {
    const W = v.words, from = a <= 0 ? 0 : (W[a - 1].t1 + W[a].t0) / 2, to = b >= n ? v.secs : (W[b - 1].t1 + W[b].t0) / 2;
    return [Math.max(0, from), Math.min(v.secs, to)];
  }
  return [v.secs * a / n, v.secs * Math.min(b, n) / n];   /* no word timings: by the share of the words */
}
export const partSecs = (VOICE, id, part) => { const r = partRange(VOICE[id], part); return r ? r[1] - r[0] : 0; };

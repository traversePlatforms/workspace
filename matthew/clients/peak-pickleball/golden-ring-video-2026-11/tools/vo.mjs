// vo.mjs <voice-id> <out-dir> [model]: the whole script read in ONE take (so the lines flow like a real read),
// then cut into l1..l6.mp3 at the word timings ElevenLabs returns. Key in ~/.ssh/elevenlabs-key.txt, never printed.
import fs from 'fs'; import os from 'os'; import { execFileSync } from 'child_process';
const [voice, dir, model = 'eleven_v3'] = process.argv.slice(2);
const key = fs.readFileSync(os.homedir() + '/.ssh/elevenlabs-key.txt', 'utf8').trim();
const LINES = [
  'The ring is everything.',
  'Everything is on the line.',
  'Three days. The best players. One arena.',
  'One ring. One champion.',
  'The road to the ring starts here.',
  'Golden Ring National Championships. January fifteenth through seventeenth, at Peak Pickleball.',
];
const TAGS = model === 'eleven_v3' ? ['[low, intense] ', '[building] ', '', '[powerful] ', '[confident] ', '[big announcer energy] '] : LINES.map(() => '');
const text = LINES.map((l, i) => TAGS[i] + l).join(' ');
const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
  method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35 } }) });
const j = await r.json();
if (!r.ok) { console.error('error', r.status, JSON.stringify(j.detail || j).slice(0, 300)); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/full.mp3`, Buffer.from(j.audio_base64, 'base64'));
const a = j.alignment; const s = a.characters.join('');
let from = 0; const spans = [];
for (const l of LINES) {
  const i = s.indexOf(l, from); if (i < 0) { console.error('line not found in timing:', l); process.exit(1); }
  spans.push([a.character_start_times_seconds[i], a.character_end_times_seconds[i + l.length - 1]]); from = i + l.length;
}
spans.forEach(([st, en], k) => {
  const next = k + 1 < spans.length ? spans[k + 1][0] : en + 0.6;
  const a0 = Math.max(0, st - 0.06), a1 = Math.min(next - 0.02, en + 0.35);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a0.toFixed(3), '-to', a1.toFixed(3), '-i', `${dir}/full.mp3`, '-af', 'afade=out:st=' + Math.max(0, a1 - a0 - 0.08).toFixed(3) + ':d=0.08', `${dir}/l${k + 1}.mp3`]);
  console.log(`l${k + 1} ${(a1 - a0).toFixed(2)} s`);
});

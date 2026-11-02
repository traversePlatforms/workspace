// The narrator for the demo-editions video (2 Nov 2026): one Gemini clip per scene's voice line (gemini-voice.mjs, voice Despina), kept in
// out/demo-editions/voice/scene-NN.wav with voice.json (the text each was made from, so a changed line is remade and nothing else is).
// Each clip's length is checked against its words: far too long means the style prefix was read aloud, far too short means words were
// dropped; such a clip is made once more, then flagged. The key stays in ~/.ssh/gemini.json and is never printed.
//   node voice-demo.mjs [--only 2,7]
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path';
import { SCENES } from './story-demo-editions.mjs';
const VOICE = 'Despina', STYLE = 'none';   /* the words alone: even a short "Say in a ... voice" prefix was read aloud on about half the clips (2 Nov) */
const DIR = resolve('out/demo-editions/voice'); mkdirSync(DIR, { recursive: true });
const MAN = join(DIR, 'voice.json'); const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};
const oi = process.argv.indexOf('--only'); const ONLY = oi > 0 ? process.argv[oi + 1].split(',').map(Number) : null;
/* how a line is said, where the written words would be read wrong */
const spoken = (t) => t.split('traverseplatforms.com').join('traverse platforms dot com').split('’').join("'");
export const wavSecs = (f) => (statSync(f).size - 44) / 2 / 24000;
const words = (t) => t.split(/\s+/).filter(Boolean).length;
for (const sc of SCENES) {
  if (!sc.vo || (ONLY && !ONLY.includes(sc.n))) continue;
  const f = join(DIR, `scene-${String(sc.n).padStart(2, '0')}.wav`), text = spoken(sc.vo);
  if (man[sc.n] && man[sc.n].text === text && existsSync(f)) { console.log(sc.n, 'kept', wavSecs(f).toFixed(1) + ' s'); continue; }
  const want = words(text) / 2.6;   /* an easy narrator pace, seconds */
  let ok = false, secs = 0;
  for (let k = 0; k < 2 && !ok; k++) {
    /* the free tier allows 10 requests a minute: one every 7 s, and a rate-limit answer waits a minute and tries again */
    for (let t = 0; t < 3; t++) { try { execFileSync('node', ['gemini-voice.mjs', VOICE, f, text, STYLE], { stdio: ['ignore', 'ignore', 'pipe'] }); break; } catch (e) { if (t === 2) throw new Error('voice failed for scene ' + sc.n); await new Promise((r) => setTimeout(r, 60000)); } }
    await new Promise((r) => setTimeout(r, 7000));
    secs = wavSecs(f); ok = secs > want * 0.6 && secs < want * 1.45;
    console.log(sc.n, (ok ? 'ok ' : 'odd') + ' ' + secs.toFixed(1) + ' s for ' + words(text) + ' words (about ' + want.toFixed(1) + ' s expected)');
  }
  man[sc.n] = { text, secs, ok, at: new Date().toISOString() };
  writeFileSync(MAN, JSON.stringify(man, null, 1));
}

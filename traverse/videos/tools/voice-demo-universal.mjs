// The narrator for the demo-universal video (7 Nov 2026): one Gemini clip per line in VOICES (story-demo-universal.mjs), voice Despina,
// the WORDS ONLY (no style prefix: "Say in a ... voice:" was read aloud on about half the v1 clips). Kept in out/demo-universal/voice/<id>.wav
// with voice.json (the text each was made from, its length and its word timings), so a changed line is remade and nothing else is.
// Listen-check, both: the length against the word count (far too long = something extra was read, far too short = words dropped), and
// whisper.cpp's transcript against the line (voice-parts.mjs): any extra or missing word and the clip is made again (three tries), then
// flagged. The key stays in ~/.ssh/gemini.json and is never printed.
//   node voice-demo-universal.mjs [--only open,sign]
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'; import { execFileSync } from 'node:child_process'; import { join, resolve } from 'node:path';
import { VOICES } from './story-demo-universal.mjs'; import { whisperOn, whisperWords, alignWords, norm } from './voice-parts.mjs';
const VOICE = 'Despina', STYLE = 'none';
const DIR = resolve('out/demo-universal/voice'); mkdirSync(DIR, { recursive: true });
const MAN = join(DIR, 'voice.json'); const man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};
const oi = process.argv.indexOf('--only'); const ONLY = oi > 0 ? process.argv[oi + 1].split(',') : null;
/* how a line is said, where the written words would be read wrong; the words themselves are the script's */
const spoken = (t) => t.split('traverseplatforms.com').join('traverse platforms dot com').split('’').join("'");
const wavSecs = (f) => (statSync(f).size - 44) / 2 / 24000;
const words = (t) => t.split(/\s+/).filter(Boolean).length;
/* the words said that the line does not have, and the reverse (order kept: a plain longest-common-run diff) */
function diff(want, got) {
  const a = norm(want).split(' '), b = norm(got).split(' '), L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const miss = [], extra = []; let i = 0, j = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) miss.push(a[i++]); else extra.push(b[j++]); }
  while (i < a.length) miss.push(a[i++]); while (j < b.length) extra.push(b[j++]);
  return { miss, extra };
}
/* whisper hears the same word several ways; these are the same word for the check */
const SAME = [[/\bre roofed\b/g, 'reroofed'], [/\ballinone\b/g, 'all in one'], [/\btraverseplatformscom\b/g, 'traverse platforms dot com'], [/\btraverse platforms com\b/g, 'traverse platforms dot com'],
  /* 8 Nov: whisper writes the address as one word, and "roof's size" sounds exactly like "roof size" */
  [/\btraverseplatforms com\b/g, 'traverse platforms dot com'], [/\btraverseplatforms\b/g, 'traverse platforms dot'], [/\broof size\b/g, 'roofs size']];
const canon = (t) => { let v = norm(t); for (const [re, to] of SAME) v = v.replace(re, to); return v; };
const W = whisperOn(); if (!W) console.log('(whisper.cpp not found: length check only)');
for (const [id, line] of Object.entries(VOICES)) {
  if (ONLY && !ONLY.includes(id)) continue;
  const f = join(DIR, id + '.wav'), text = spoken(line);
  if (man[id] && man[id].text === text && existsSync(f) && man[id].ok) { console.log(id.padEnd(10), 'kept', man[id].secs.toFixed(1) + ' s'); continue; }
  const want = words(text) / 2.7;
  let ok = false, secs = 0, heard = '', d = null, ww = null;
  for (let k = 0; k < 3 && !ok; k++) {
    for (let t = 0; t < 3; t++) { try { execFileSync('node', ['gemini-voice.mjs', VOICE, f, text, STYLE], { stdio: ['ignore', 'ignore', 'pipe'] }); break; } catch (e) { if (t === 2) throw new Error('voice failed for ' + id); await new Promise((r) => setTimeout(r, 60000)); } }
    secs = wavSecs(f);
    const lenOk = secs > want * 0.6 && secs < want * 1.45;
    if (W) { ww = whisperWords(f); heard = ww.map((x) => x.w).join(' '); d = diff(canon(text), canon(heard)); }
    ok = lenOk && (!d || (!d.extra.length && !d.miss.length));
    console.log(id.padEnd(10), (ok ? 'ok ' : 'odd') + ' ' + secs.toFixed(1) + ' s for ' + words(text) + ' words (about ' + want.toFixed(1) + ' s)' + (d && (d.extra.length || d.miss.length) ? ' | extra: ' + d.extra.join(' ') + ' | missing: ' + d.miss.join(' ') : ''));
    if (!ok) await new Promise((r) => setTimeout(r, 7000));
  }
  man[id] = { text, secs, ok, heard, words: ww ? alignWords(text, ww) : null, at: new Date().toISOString() };
  writeFileSync(MAN, JSON.stringify(man, null, 1));
}

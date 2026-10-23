/* Make a picture with Google's Gemini image model (2026-10-22, Matthew: "the main issue i am having is that you dont make images ... i am
   struggling on the content creation side"). One prompt in, one image file out, and a line in the cost log. The key is read from
   ~/.ssh/gemini.json and never printed. Pictures only: text and logos go on afterwards with our own templates, because image models get
   lettering wrong. Rules that travel with it (said to Matthew once): no made-up people passed off as our team or customers, and no
   made-up results (a generated "after" lawn is a claim we can't make).
     node shared/tools/make-image.mjs --prompt "..." --out path.jpg [--aspect 4:5] [--model gemini-3.1-flash-image]
     import { makeImage } from './make-image.mjs';  await makeImage({ prompt, out, aspect })                                       */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const LOG = join(dirname(fileURLToPath(import.meta.url)), 'make-image-log.jsonl');   /* every image: when, model, tokens, where it went */
function key() {
  const j = JSON.parse(readFileSync(join(homedir(), '.ssh', 'gemini.json'), 'utf8').replace(/^﻿/, ''));
  const k = j.key || j.api_key; if (!k || /PASTE/.test(k)) throw new Error('no Gemini key in ~/.ssh/gemini.json'); return k;
}
export async function makeImage({ prompt, out, aspect = '4:5', model = 'gemini-3.1-flash-image', tries = 2 }) {
  let last;
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } }) });
    const d = await r.json().catch(() => ({}));
    if (d.error) { last = new Error(`${d.error.status}: ${String(d.error.message).slice(0, 200)}`); if (r.status === 403 || r.status === 400) break; continue; }
    const im = (d.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
    if (!im) { last = new Error('no image came back (' + (d.candidates?.[0]?.finishReason || 'no reason') + ')'); continue; }
    mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, Buffer.from(im.inlineData.data, 'base64'));
    const row = { at: new Date().toISOString(), model, aspect, out, secs: +((Date.now() - t0) / 1000).toFixed(1), imageTokens: d.usageMetadata?.candidatesTokensDetails?.find((x) => x.modality === 'IMAGE')?.tokenCount ?? null, prompt: prompt.slice(0, 300) };
    appendFileSync(LOG, JSON.stringify(row) + '\n');
    return row;
  }
  throw last || new Error('image failed');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  if (!A.prompt || !A.out) { console.log('usage: node make-image.mjs --prompt "..." --out file.jpg [--aspect 4:5]'); process.exit(1); }
  makeImage({ prompt: A.prompt, out: A.out, aspect: A.aspect || '4:5', model: A.model || 'gemini-3.1-flash-image' }).then((r) => console.log(JSON.stringify(r)), (e) => { console.error(e.message); process.exit(1); });
}

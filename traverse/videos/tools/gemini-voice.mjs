// Gemini text-to-speech for the demo videos (2 Nov 2026). The key is read from ~/.ssh/gemini.json and never printed.
//   node gemini-voice.mjs <voice> <out.wav> "<text>" ["<style direction>"]
// Writes 24 kHz 16-bit mono WAV. Voices are Gemini's prebuilt ones (Charon, Kore, Iapetus, Puck, ...).
import { readFileSync, writeFileSync } from 'node:fs';
const [voice, out, text, style] = process.argv.slice(2);
if (!voice || !out || !text) { console.error('usage: node gemini-voice.mjs <voice> <out.wav> "<text>" ["<style>"]'); process.exit(1); }
const key = JSON.parse(readFileSync('C:/Users/Surge Inc/.ssh/gemini.json', 'utf8')).key;
const model = process.env.TTS_MODEL || 'gemini-3.8-flash-tts';
const prompt = style === 'none' ? text : (style || 'Say in a brisk, upbeat, confident narrator voice') + ': ' + text;   /* the documented "Say ...:" form; a longer direction got read aloud (2 Nov); 'none' = the words alone (2 Nov: even the short prefix was read aloud on some clips) */
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
});
const j = await r.json();
const b64 = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
if (!b64) { console.error('no audio:', JSON.stringify(j).slice(0, 400)); process.exit(1); }
const pcm = Buffer.from(b64, 'base64'), h = Buffer.alloc(44), rate = 24000;
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
writeFileSync(out, Buffer.concat([h, pcm]));
console.log(out, (pcm.length / 2 / rate).toFixed(1) + ' s', j.usageMetadata ? JSON.stringify(j.usageMetadata) : '');

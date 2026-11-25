// lyria.mjs <out.mp3|wav> "<prompt>" [model]: one Lyria music take via the Gemini API (key in ~/.ssh/gemini.json, never printed)
import fs from 'fs'; import os from 'os';
const [out, prompt, model = 'lyria-3.5'] = process.argv.slice(2);
const key = JSON.parse(fs.readFileSync(os.homedir() + '/.ssh/gemini.json', 'utf8')).key;
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
const j = await r.json();
if (!r.ok) { console.error('error', r.status, JSON.stringify(j.error || j).slice(0, 600)); process.exit(1); }
const parts = j.candidates?.[0]?.content?.parts || [];
for (const p of parts) {
  if (p.inlineData) { fs.writeFileSync(out, Buffer.from(p.inlineData.data, 'base64')); console.log('saved', out, p.inlineData.mimeType); }
  else if (p.text) console.log('text:', p.text.slice(0, 400));
}
console.log('usage', JSON.stringify(j.usageMetadata || {}));

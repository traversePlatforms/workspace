// Concert ad E artwork (1 Nov, Matthew: "remake concert ad E using gemini so we can have some high quality designs"). Gemini draws the
// illustration only; every word, the badge and the QR go on afterwards from build.mjs. No people, no text, no "result" lawn.
// node gen.mjs <model> <name> <style key>   -> <name>.png
import { readFileSync, writeFileSync } from 'node:fs';
const KEY = JSON.parse(readFileSync('C:/Users/Surge Inc/.ssh/gemini.json', 'utf8')).key;
const [, , MODEL, NAME, STYLE] = process.argv;
const SCENE = 'A cutaway cross-section illustration explaining lawn core aeration. A strip of healthy green turf on top, and below it the brown soil in a couple of layers with fine pale grass roots. Three narrow vertical cylindrical holes are punched down through the turf into the soil. A few pulled soil plugs (short cylindrical cores of soil with a little grass on top) lie on the grass surface beside the holes. Small grass seeds sit at the bottom of the holes, and clear blue water droplets are soaking down into the holes toward the roots. ';
const PALETTE = 'Colour palette: forest green #2F5D2C, moss green #4C7A3F, warm cream #FFF8EC, ember orange #E4703A used sparingly as an accent, sun gold #F2C14E for the seeds, earthy browns for the soil. ';
const RULES = 'The cross-section sits in the lower 65% of the frame. The top 35% is plain, empty warm cream (#FFF8EC) background with nothing in it, reserved for a headline. Absolutely no text, letters, numbers, labels, arrows with words, logos, watermarks or people anywhere in the image.';
const STYLES = {
  flat: 'Style: crisp modern flat vector illustration, clean geometric shapes, subtle soft gradients and gentle shadows, like a premium agricultural brand infographic. ',
  paint: 'Style: refined editorial gouache illustration with visible soft brush texture and grain, warm natural light, like a high-end gardening magazine. ',
  clay: 'Style: soft 3D illustration, smooth rounded clay-like forms, studio lighting with soft shadows, a tidy diorama cut-away block of lawn and soil, playful but premium. ',
};
const body = { contents: [{ parts: [{ text: STYLES[STYLE] + SCENE + PALETTE + RULES }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5', imageSize: process.env.SIZE || '1K' } } };
const t0 = Date.now();
const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const j = await r.json();
const part = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
if (!part) { console.log(NAME, 'no image:', JSON.stringify(j).slice(0, 400)); process.exit(1); }
writeFileSync(NAME + '.png', Buffer.from(part.inlineData.data, 'base64'));
console.log(NAME, MODEL, ((Date.now() - t0) / 1000).toFixed(0) + ' s', part.inlineData.mimeType, JSON.stringify(j.usageMetadata || {}).slice(0, 160));

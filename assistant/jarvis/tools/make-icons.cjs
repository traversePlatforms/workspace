/* J.A.R.V.I.S.'s own app icons (2026-11-19, P-9 "its own name and icon"): the halo mark the hub's J.A.R.V.I.S. tab already uses
   (assistant/hub/index.html), drawn large on the page's night background. Plain icons have the rounded square baked in; the maskable and
   Apple ones are full squares with the mark inside the safe circle. Run: node assistant/jarvis/tools/make-icons.cjs */
const path = require('path'), fs = require('fs');
const REPO = path.resolve(__dirname, '..', '..', '..');
const sharp = require(path.join(REPO, 'node_modules', 'sharp'));
const OUT = path.join(REPO, 'assistant', 'jarvis');
/* the mark in a 64 x 64 box, as in the hub */
const mark = '<circle cx="32" cy="32" r="22" fill="none" stroke="#3ee8ff" stroke-opacity=".55" stroke-width="3" stroke-dasharray="2 4"/>'
  + '<circle cx="32" cy="32" r="13" fill="none" stroke="#3ee8ff" stroke-width="3"/>'
  + '<ellipse cx="32" cy="32" rx="6" ry="13" fill="none" stroke="#3ee8ff" stroke-opacity=".7" stroke-width="2"/>'
  + '<circle cx="32" cy="32" r="4.5" fill="#dffbff"/>';
function svg(bleed) {
  const S = 512, r = bleed ? 0 : 112, k = bleed ? 0.62 : 0.86, w = 64 * k * (S / 64), off = (S - w) / 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
    + '<defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#0b2a3e"/><stop offset=".55" stop-color="#06121e"/><stop offset="1" stop-color="#03060c"/></radialGradient>'
    + '<radialGradient id="h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3ee8ff" stop-opacity=".35"/><stop offset="1" stop-color="#3ee8ff" stop-opacity="0"/></radialGradient></defs>'
    + '<rect width="512" height="512" rx="' + r + '" fill="url(#g)"/>'
    + '<circle cx="256" cy="256" r="' + (w * 0.42) + '" fill="url(#h)"/>'
    + '<g transform="translate(' + off + ' ' + off + ') scale(' + (w / 64) + ')">' + mark + '</g></svg>';
}
(async () => {
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg(false));
  for (const [f, size, bleed] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true], ])
    await sharp(Buffer.from(svg(bleed))).resize(size, size).png().toFile(path.join(OUT, f));
  /* Android's small status-bar badge: the mark alone, white on clear */
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64">' + mark.replace(/#3ee8ff|#dffbff/g, '#ffffff') + '</svg>')).resize(96, 96).png().toFile(path.join(OUT, 'badge-96.png'));
  console.log('icons written to ' + OUT);
})();

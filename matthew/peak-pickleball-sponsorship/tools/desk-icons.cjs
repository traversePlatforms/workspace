/* The Peak Sponsor Desk's app icons (2026-10-22, Matthew: no way to put the desk on his laptop's desktop): a pickleball on the desk's
   green (#1f5b46), in the same soft-gradient style as the Traverse icons. Writes icon-192.png, icon-512.png, icon-maskable-512.png and
   apple-touch-icon.png into app/. Run: node tools/desk-icons.cjs (from this folder). */
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'sharp'));
const OUT = path.join(__dirname, '..', 'app');

function svg(bleed) {
  const R = bleed ? 0 : 112, r = bleed ? 128 : 150, c = 256;
  /* the ball's holes: one in the middle, a ring of six around it, a few half-hidden at the rim */
  const holes = [[0, 0]].concat([0, 1, 2, 3, 4, 5].map((i) => [Math.cos(i * Math.PI / 3) * 0.48, Math.sin(i * Math.PI / 3) * 0.48]))
    .concat([0, 1, 2, 3, 4, 5].map((i) => [Math.cos(i * Math.PI / 3 + Math.PI / 6) * 0.82, Math.sin(i * Math.PI / 3 + Math.PI / 6) * 0.82]));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>'
    + '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a7a62"/><stop offset="1" stop-color="#143d2f"/></linearGradient>'
    + '<radialGradient id="glow" cx="0.3" cy="0.12" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="ball" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="#f6ff9a"/><stop offset="1" stop-color="#cfe33a"/></radialGradient>'
    + '<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dy="8" result="b"/>'
    + '<feComponentTransfer><feFuncA type="linear" slope="0.32"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + '<clipPath id="ballc"><circle cx="' + c + '" cy="' + c + '" r="' + r + '"/></clipPath>'
    + (R ? '<clipPath id="c"><rect width="512" height="512" rx="' + R + '"/></clipPath>' : '') + '</defs>'
    + '<g' + (R ? ' clip-path="url(#c)"' : '') + '><rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>'
    + (R ? '<rect x="1.5" y="1.5" width="509" height="509" rx="' + (R - 1.5) + '" fill="none" stroke="#fff" stroke-opacity="0.10" stroke-width="3"/>' : '')
    + '<g filter="url(#sh)"><circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="url(#ball)"/>'
    + '<g clip-path="url(#ballc)" fill="#1f5b46" fill-opacity="0.85">' + holes.map(([x, y]) => '<circle cx="' + (c + x * r).toFixed(1) + '" cy="' + (c + y * r).toFixed(1) + '" r="' + (r * 0.11).toFixed(1) + '"/>').join('') + '</g>'
    + '</g></g></svg>';
}
(async () => {
  const plain = Buffer.from(svg(false)), full = Buffer.from(svg(true));
  await sharp(plain, { density: 144 }).resize(192, 192).png().toFile(path.join(OUT, 'icon-192.png'));
  await sharp(plain, { density: 144 }).resize(512, 512).png().toFile(path.join(OUT, 'icon-512.png'));
  await sharp(full, { density: 144 }).resize(512, 512).png().toFile(path.join(OUT, 'icon-maskable-512.png'));
  await sharp(full, { density: 144 }).resize(180, 180).png().toFile(path.join(OUT, 'apple-touch-icon.png'));
  console.log('desk icons written');
})();

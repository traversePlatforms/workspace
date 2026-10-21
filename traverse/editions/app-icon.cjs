/* The home-screen icons for every app (2026-10-21, Matthew: "Improve the looks of the mobile app icon across the board").
   One look for all six: the app's colour as a soft diagonal gradient (lighter top left, deeper bottom right) with a faint top light,
   the mark centred and large, and a soft shadow under it so it lifts off the background.
   bleed = true for the maskable and Apple icons (full square: the phone cuts its own shape, the mark stays inside the safe circle);
   false for the plain icons (rounded square baked in). Used by build-editions.cjs; build-app-icons.cjs renders them now. */
const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = parseInt(m ? m[1] : '444444', 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (h, t, a) => { const c = hex(h), d = hex(t); return '#' + c.map((v, i) => Math.round(v + (d[i] - v) * a).toString(16).padStart(2, '0')).join(''); };

/* the Traverse route mark (as build-editions.cjs), 64 x 64 */
const routeMark = (stroke, hole, end) =>
  '<polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="' + stroke + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
  + [[9, 47], [24, 31], [37, 40]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="5.2" fill="' + hole + '" stroke="' + stroke + '" stroke-width="3.6"/>').join('')
  + '<circle cx="53" cy="17" r="8" fill="' + end + '"/>';

/* the Sixfold Ridge mark, flat (sixfold/brand/sixfold-mark-ridge-flat.svg: peaks in ember, tree and ground in sage), 100 x 96 viewBox,
   drawn area x 4..98, y 14..91 */
const ridgeMark = () =>
  '<path fill="#E4703A" fill-rule="evenodd" d="M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84Z"/>'
  + '<path fill="#8AA07A" fill-rule="evenodd" d="M9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5Z"/>'
  + '<path fill="#8AA07A" d="M4 86L96 86L96 91L4 91Z"/>';

/**
 * @param {object} o  { fill: '#hex', ink: '#hex', kind: 'route' | 'ridge', bleed: bool }
 * @returns SVG string, 512 x 512
 */
function appIconSvg(o) {
  const fill = o.fill || '#1F2A25', ink = o.ink || '#ffffff', bleed = !!o.bleed;
  const light = mix(fill, '#ffffff', o.kind === 'ridge' ? 0.10 : 0.16), deep = mix(fill, '#000000', o.kind === 'ridge' ? 0.35 : 0.22);
  const S = 512, R = bleed ? 0 : 112;   /* 22% corner, close to a phone's own shape */
  /* the mark's box: the maskable safe zone is the middle 80% circle, so a bleed icon keeps the mark to ~56% of the side */
  const box = bleed ? 0.56 : 0.66;
  let mark;
  if (o.kind === 'ridge') {
    const w = 94, h = 77, sc = (S * box) / w, x = (S - w * sc) / 2 - 4 * sc, y = (S - h * sc) / 2 - 14 * sc + S * 0.01;
    mark = '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + sc.toFixed(3) + ')">' + ridgeMark() + '</g>';
  } else {
    /* the route mark's drawn area is about x 3..61, y 9..53 in its 64 box */
    const w = 58, h = 44, sc = (S * box) / w, x = (S - w * sc) / 2 - 3 * sc, y = (S - h * sc) / 2 - 9 * sc;
    mark = '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + sc.toFixed(3) + ')">' + routeMark(ink, fill, ink) + '</g>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
    + '<defs>'
    + '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + light + '"/><stop offset="1" stop-color="' + deep + '"/></linearGradient>'
    + '<radialGradient id="glow" cx="0.3" cy="0.12" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>'
    + '<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dy="8" result="b"/>'
    + '<feComponentTransfer><feFuncA type="linear" slope="0.32"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    + (R ? '<clipPath id="c"><rect width="512" height="512" rx="' + R + '"/></clipPath>' : '')
    + '</defs>'
    + '<g' + (R ? ' clip-path="url(#c)"' : '') + '>'
    + '<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>'
    + (R ? '<rect x="1.5" y="1.5" width="509" height="509" rx="' + (R - 1.5) + '" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="3"/>' : '')
    + '<g filter="url(#sh)">' + mark + '</g>'
    + '</g></svg>';
}

/** writes icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png into dir */
async function writeAppIcons(sharp, dir, o) {
  const path = require('path');
  const plain = Buffer.from(appIconSvg(Object.assign({}, o, { bleed: false }))), full = Buffer.from(appIconSvg(Object.assign({}, o, { bleed: true })));
  await sharp(plain, { density: 144 }).resize(192, 192).png().toFile(path.join(dir, 'icon-192.png'));
  await sharp(plain, { density: 144 }).resize(512, 512).png().toFile(path.join(dir, 'icon-512.png'));
  await sharp(full, { density: 144 }).resize(512, 512).png().toFile(path.join(dir, 'icon-maskable-512.png'));
  await sharp(full, { density: 144 }).resize(180, 180).png().toFile(path.join(dir, 'apple-touch-icon.png'));
}
module.exports = { appIconSvg, writeAppIcons };

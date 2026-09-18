/*
  Sixfold Colorado — merch concept board generator.

  Writes ./index.html. One garment renderer per product, plus the item data
  (title / blurb / spec) and the page shell. Same convention as the
  sixfold/brand build scripts: change a renderer here, re-run, re-screenshot.

  Realism is done with SVG only — form-shading gradients, blurred fold shadows,
  construction seams and topstitching, puffed-embroidery ghosting, a fabric
  displacement warp on screen prints, and a contact shadow under each piece.
  No raster assets, no network, no licensing questions; opens from file://.

  Run:  "C:\Users\Surge Inc\AppData\Local\nodejs\node.exe" build-merch.mjs
  (node is installed there but not on PATH — see sixfold-brand-assets memory.)
*/
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* palette — the agreed five */
const PINE = '#0E1512', EMBER = '#E4703A', EMBER_INK = '#B84C15',
      MOSS = '#8AA07A', BONE = '#EDE7DC', TIMBER = '#1F2A25';

/* ---- the Ridge crest (no roots — cleaner at garment scale) --------------- */
const CREST = `
  <path d="M18 84 L36 48 L54 84 Z" fill-opacity=".42"/>
  <path d="M30 84 L50 38 L70 84 Z" fill-opacity=".58"/>
  <path d="M44 84 L66 26 L88 84 Z" fill-opacity=".76"/>
  <path d="M60 84 L79 14 L98 84 Z"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/>
  <path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

/* crest placed at (x,y) w wide. mode: 'flat' screen print | 'emb' puffed stitch */
function crest(x, y, w, fill, mode = 'flat') {
  const h = (w * 77) / 94;
  const inner = `<g fill="${fill}">${CREST}</g>`;
  if (mode !== 'emb') {
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="4 14 94 77">${inner}</svg>`;
  }
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="4 14 94 77">
    <g fill="#000" opacity=".38" transform="translate(1.1 1.6)">${CREST}</g>
    <g fill="#fff" opacity=".22" transform="translate(-0.7 -0.9)">${CREST}</g>
    ${inner}</svg>`;
}

/* shared defs: filters + reusable gradients ------------------------------- */
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="warp" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="warpBig" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.016" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="blur2" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.4"/></filter>
  <filter id="blur5" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="blur9" x="-80%" y="-80%" width="260%" height="260%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0"/>
  </filter>
  <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#efd6a2"/><stop offset=".5" stop-color="#b9995e"/><stop offset="1" stop-color="#6f5630"/>
  </linearGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".5"/>
    <stop offset=".55" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <pattern id="ribDome" width="12" height="14" patternUnits="userSpaceOnUse">
    <rect width="12" height="14" fill="#fff" opacity="0"/>
    <rect x="1.5" width="4" height="14" rx="2" fill="#fff" opacity=".06"/>
    <rect x="7.5" width="3" height="14" rx="1.5" fill="#000" opacity=".16"/>
  </pattern>
  <pattern id="ribCuff" width="8" height="14" patternUnits="userSpaceOnUse">
    <rect width="8" height="14" fill="#fff" opacity="0"/>
    <rect x="1" width="2.6" height="14" rx="1.3" fill="#fff" opacity=".08"/>
    <rect x="5" width="2" height="14" rx="1" fill="#000" opacity=".2"/>
  </pattern>
  <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">
    <path d="M0 3h6M3 0v6" stroke="#000" stroke-opacity=".08" stroke-width="1.4"/>
    <path d="M0 0h6M0 0v6" stroke="#fff" stroke-opacity=".05" stroke-width="1"/>
  </pattern>
  <pattern id="flute" width="12" height="8" patternUnits="userSpaceOnUse">
    <rect width="12" height="8" fill="#fff" opacity="0"/><rect x="11" width="1.4" height="8" fill="#000" opacity=".14"/>
  </pattern>
  <radialGradient id="speck" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0E1512"/><stop offset="1" stop-color="#0E1512"/></radialGradient>
</defs></svg>`;

/* fabric look: returns <defs> gradients string + the two gradient ids */
let gid = 0;
function fabric(a, b, edge = 0.5, vigColor = '#000') {
  const id = `f${gid++}`;
  return {
    body: id, vig: `${id}v`,
    defs: `
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="${id}v" cx=".5" cy=".38" r=".75">
      <stop offset="0" stop-color="${vigColor}" stop-opacity="0"/>
      <stop offset=".7" stop-color="${vigColor}" stop-opacity="0"/>
      <stop offset="1" stop-color="${vigColor}" stop-opacity="${edge}"/>
    </radialGradient>`,
  };
}

const contact = (cx, cy, rx, ry) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity=".26" filter="url(#blur9)"/>`;

const wrapSvg = (vb, label, inner, defs = '') =>
  `<svg viewBox="${vb}" class="mock-svg" role="img" aria-label="${label}"><defs>${defs}</defs>${inner}</svg>`;

/* ======================================================================
   TEE  — front or back, any fabric
   ====================================================================== */
function tee({ label, view = 'front', a, b, edge = 0.5, collar = null, ring = false, print, dark = true, cid }) {
  const f = fabric(a, b, edge, dark ? '#000' : '#6b6257');
  const clip = `cl${gid++}`;
  const k = dark ? 1 : 0.72;                      // fold-shadow multiplier
  const o = (v) => (v * k).toFixed(3);
  // flat-lay tee: horizontal shoulder, short angled sleeves, slight waist, soft hem
  const bodyD = `
    M132 58 C 148 76, 192 76, 208 58
    L 234 52 C 258 56, 274 66, 298 96
    L 306 128 L 280 150 L 268 140
    C 264 190, 264 262, 260 316 C 232 324, 108 324, 80 316
    C 76 262, 76 190, 72 140 L 60 150 L 34 128
    L 42 96 C 66 66, 82 56, 106 52 L 132 58 Z`;
  const cFill = ring && collar ? collar : (dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)');
  const cHi = dark ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.8)';
  const cLo = dark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.26)';
  const neck = view === 'front'
    ? `<path d="M132 58 C 148 76, 192 76, 208 58 C 202 72, 179 84, 170 98 C 161 84, 138 72, 132 58 Z" fill="${cFill}"/>
       <path d="M132 58 C 148 75, 192 75, 208 58" fill="none" stroke="${cHi}" stroke-width="2.4"/>
       <path d="M138 66 C 151 82, 189 82, 202 66" fill="none" stroke="${cLo}" stroke-width="3.2" filter="url(#blur2)"/>
       <path d="M140 61 l3 7 M152 69 l2 8 M170 73 l0 8 M188 69 l-2 8 M200 61 l-3 7" stroke="${cLo}" stroke-width="1.1" opacity=".7"/>`
    : `<path d="M130 58 C 150 68, 190 68, 210 58 C 206 66, 150 70, 130 58 Z" fill="${cFill}"/>
       <path d="M128 59 C 150 69, 190 69, 212 59" fill="none" stroke="${cHi}" stroke-width="2.4"/>
       <path d="M124 64 C 150 76, 190 76, 216 64" fill="none" stroke="${cLo}" stroke-width="4" filter="url(#blur2)"/>`;
  const seam = dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.17)';
  const inner = `
    ${contact(170, 330, 94, 11)}
    <clipPath id="${clip}"><path d="${bodyD}"/></clipPath>
    <path d="${bodyD}" fill="url(#${f.body})"/>
    <g clip-path="url(#${clip})">
      <path d="${bodyD}" fill="url(#${f.vig})"/>
      <!-- drape: side shadows, sleeve breaks, waist crease, hem pool -->
      <path d="M92 120 C 108 190, 106 280, 88 318 L 70 300 C 72 220, 78 160, 92 120 Z" fill="#000" opacity="${o(0.17)}" filter="url(#blur5)"/>
      <path d="M248 122 C 234 190, 238 280, 256 318 L 274 296 C 270 216, 258 160, 248 122 Z" fill="#000" opacity="${o(0.15)}" filter="url(#blur5)"/>
      <path d="M70 138 C 60 150, 48 138, 44 128 C 56 140, 66 138, 74 132 Z" fill="#000" opacity="${o(0.2)}" filter="url(#blur2)"/>
      <path d="M270 138 C 280 150, 292 138, 296 128 C 284 140, 274 138, 266 132 Z" fill="#000" opacity="${o(0.18)}" filter="url(#blur2)"/>
      <path d="M96 236 C 150 250, 190 250, 244 236 C 246 250, 244 262, 240 270 C 190 282, 150 282, 100 270 C 96 262, 94 250, 96 236 Z" fill="#000" opacity="${o(0.09)}" filter="url(#blur9)"/>
      <path d="M100 300 C 150 314, 190 314, 240 300 C 240 312, 236 320, 232 322 L 108 322 C 104 320, 100 312, 100 300 Z" fill="#000" opacity="${o(0.1)}" filter="url(#blur5)"/>
      <ellipse cx="150" cy="112" rx="92" ry="58" fill="#fff" opacity="${dark ? '.08' : '.22'}" filter="url(#blur9)"/>
      <ellipse cx="160" cy="150" rx="150" ry="150" fill="#fff" opacity="${dark ? '.03' : '.06'}" filter="url(#blur9)"/>
      <rect x="0" y="0" width="340" height="350" filter="url(#grain)" opacity="${dark ? '.5' : '.14'}" style="mix-blend-mode:overlay"/>
    </g>
    <!-- topstitching -->
    <path d="M280 150 L268 140 M60 150 L72 140" stroke="${seam}" stroke-width="1.3" fill="none"/>
    <path d="M96 308 C 150 320, 190 320, 244 308" stroke="${seam}" stroke-width="1.3" stroke-dasharray="2 3" fill="none"/>
    <path d="M276 146 L266 137 M64 146 L74 137" stroke="${seam}" stroke-width="1" stroke-dasharray="2 3" fill="none"/>
    ${view === 'back' ? `<path d="M170 70 C 172 180, 172 250, 170 314" stroke="#000" stroke-opacity="${dark ? '.1' : '.05'}" stroke-width="2" fill="none"/>` : ''}
    ${neck}
    <g clip-path="url(#${clip})" filter="url(#warp)">${print}</g>`;
  return { svg: wrapSvg('0 0 340 348', label, inner, f.defs), cid };
}

/* ======================================================================
   HOODIE — back view, pullover
   ====================================================================== */
function hoodie({ label, print }) {
  const f = fabric('#211d18', '#0c0a08', 0.55);
  const clip = `cl${gid++}`;
  const bodyD = `
    M112 70 C 118 92, 222 92, 228 70 L 258 60 C 288 70, 312 96, 322 140
    L 296 196 L 274 182 C 279 214, 280 250, 277 286 L 272 344 L 68 344 L 63 286
    C 60 250, 61 214, 66 182 L 44 196 L 18 140 C 28 96, 52 70, 82 60 L 112 70 Z`;
  const inner = `
    ${contact(170, 350, 155, 20)}
    <clipPath id="${clip}"><path d="${bodyD}"/></clipPath>
    <!-- hood bunched behind the shoulders: one soft mass -->
    <path d="M108 74 C 104 40, 120 22, 170 20 C 220 22, 236 40, 232 74 C 210 58, 130 58, 108 74 Z"
          fill="url(#${f.body})"/>
    <path d="M108 74 C 104 40, 120 22, 170 20 C 220 22, 236 40, 232 74" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="4" filter="url(#blur2)"/>
    <path d="M126 34 C 150 26, 190 26, 214 34 C 196 44, 144 44, 126 34 Z" fill="#000" opacity=".28" filter="url(#blur5)"/>
    <path d="M118 68 C 140 56, 200 56, 222 68" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="7" filter="url(#blur2)"/>
    <path d="${bodyD}" fill="url(#${f.body})"/>
    <g clip-path="url(#${clip})">
      <path d="${bodyD}" fill="url(#${f.vig})"/>
      <path d="M92 96 C 120 170, 118 280, 96 344 L 66 300 C 70 210, 74 150, 92 96 Z" fill="#000" opacity=".18" filter="url(#blur5)"/>
      <path d="M250 98 C 236 170, 240 280, 262 344 L 296 250 C 288 180, 272 140, 250 98 Z" fill="#000" opacity=".16" filter="url(#blur5)"/>
      <ellipse cx="200" cy="120" rx="130" ry="80" fill="#fff" opacity=".08" filter="url(#blur9)"/>
      <rect x="0" y="0" width="340" height="380" filter="url(#grain)" opacity=".5" style="mix-blend-mode:overlay"/>
      <!-- ribbed waistband + cuffs -->
      <rect x="63" y="318" width="214" height="26" fill="url(#ribCuff)"/>
      <rect x="63" y="318" width="214" height="26" fill="#000" opacity=".12"/>
    </g>
    <!-- kangaroo pocket -->
    <path d="M96 236 h148 a6 6 0 0 1 6 6 v46 a6 6 0 0 1 -6 6 h-148 a6 6 0 0 1 -6 -6 v-46 a6 6 0 0 1 6 -6 z"
          fill="none" stroke="#000" stroke-opacity=".22" stroke-width="2"/>
    <path d="M96 240 h148" stroke="#fff" stroke-opacity=".06" stroke-width="2"/>
    <!-- drawcords + eyelets -->
    <circle cx="150" cy="60" r="3.2" fill="#000" opacity=".5"/><circle cx="190" cy="60" r="3.2" fill="#000" opacity=".5"/>
    <path d="M150 62 C 148 84, 150 104, 146 120 M190 62 C 192 84, 190 104, 194 120" stroke="${BONE}" stroke-opacity=".8" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="146" cy="122" r="3.6" fill="${TIMBER}" stroke="${BONE}" stroke-opacity=".5"/>
    <circle cx="194" cy="122" r="3.6" fill="${TIMBER}" stroke="${BONE}" stroke-opacity=".5"/>
    <path d="M56 172 L72 182 M284 172 L268 182" stroke="rgba(255,255,255,.14)" stroke-width="1.3" stroke-dasharray="2 3" fill="none"/>
    <g filter="url(#warpBig)">${print}</g>`;
  return { svg: wrapSvg('0 0 340 380', label, inner, f.defs) };
}

/* ======================================================================
   TRUCKER CAP — structured foam front, curved bill, front-raised view
   ====================================================================== */
function truckerCap({ label }) {
  const crown = fabric('#20242a', '#0d1013', 0.5);
  const bill = fabric('#191d16', '#0c0f0a', 0.4);
  const arc = `ta${gid++}`;
  const inner = `
    ${contact(170, 214, 132, 16)}
    <!-- crown -->
    <path d="M54 150 C 48 92, 90 46, 170 44 C 250 46, 292 92, 286 150 C 248 132, 92 132, 54 150 Z" fill="url(#${crown.body})"/>
    <path d="M54 150 C 48 92, 90 46, 170 44 C 250 46, 292 92, 286 150 C 248 132, 92 132, 54 150 Z" fill="url(#${crown.vig})"/>
    <ellipse cx="150" cy="86" rx="96" ry="52" fill="#fff" opacity=".07" filter="url(#blur9)"/>
    <!-- panel seams + stitching -->
    <path d="M170 132 L170 50" stroke="#000" stroke-opacity=".3" stroke-width="2"/>
    <path d="M170 130 C 150 128, 128 132, 120 138 M170 130 C 190 128, 212 132, 220 138" stroke="#000" stroke-opacity=".22" stroke-width="2" fill="none"/>
    <path d="M116 132 C 120 92, 140 60, 168 48 M224 132 C 220 92, 200 60, 172 48" stroke="#000" stroke-opacity=".18" stroke-width="1.4" stroke-dasharray="2 3" fill="none"/>
    <path d="M168 48 C 150 52, 128 96, 122 134 M172 48 C 190 52, 212 96, 218 134" stroke="#fff" stroke-opacity=".05" stroke-width="1.4" stroke-dasharray="2 3" fill="none"/>
    <!-- sweatband shadow where crown meets bill -->
    <path d="M56 148 C 92 132, 248 132, 284 148 C 248 150, 92 150, 56 148 Z" fill="#000" opacity=".3" filter="url(#blur2)"/>
    <!-- bill: top surface -->
    <path d="M56 150 C 50 182, 82 210, 156 214 C 216 214, 266 198, 296 168 L 286 150 C 248 168, 92 168, 56 150 Z" fill="url(#${bill.body})"/>
    <path d="M56 150 C 50 182, 82 210, 156 214 C 216 214, 266 198, 296 168 L 286 150 C 248 168, 92 168, 56 150 Z" fill="url(#${bill.vig})"/>
    <!-- bill stitch rows -->
    <path d="M70 158 C 110 172, 240 170, 276 154" stroke="#fff" stroke-opacity=".07" stroke-width="1.3" fill="none"/>
    <path d="M66 168 C 108 186, 244 182, 286 162" stroke="#000" stroke-opacity=".18" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <path d="M64 180 C 106 200, 236 196, 288 172" stroke="#000" stroke-opacity=".16" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <path d="M70 194 C 108 214, 214 210, 278 186" stroke="#000" stroke-opacity=".14" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <!-- sandwich trim along the bill edge -->
    <path d="M56 150 C 50 182, 82 210, 156 214 C 216 214, 266 198, 296 168" stroke="${EMBER}" stroke-opacity=".85" stroke-width="2.4" fill="none"/>
    <!-- undervisor sliver -->
    <path d="M84 210 C 130 220, 200 218, 250 202 C 205 214, 130 218, 84 210 Z" fill="${MOSS}" opacity=".5"/>
    <!-- crown button -->
    <circle cx="170" cy="46" r="6.5" fill="url(#${crown.body})" stroke="#000" stroke-opacity=".3"/>
    <path d="M166 46 h8 M170 42 v8" stroke="#000" stroke-opacity=".25" stroke-width="1"/>
    <!-- far-side eyelet + faint mesh hint -->
    <circle cx="250" cy="104" r="2.4" fill="#000" opacity=".4"/><circle cx="92" cy="104" r="2.4" fill="#000" opacity=".4"/>
    <!-- embroidery -->
    <path id="${arc}" d="M96 140 C 122 122, 218 122, 244 140" fill="none"/>
    ${crest(140, 60, 60, EMBER, 'emb')}
    <text font-family="ui-monospace, Consolas, monospace" font-size="11" letter-spacing="3.5" fill="${BONE}" filter="url(#blur2)" opacity=".5">
      <textPath href="#${arc}" startOffset="50%" text-anchor="middle">SIXFOLD COLORADO</textPath></text>
    <text font-family="ui-monospace, Consolas, monospace" font-size="11" letter-spacing="3.5" fill="${BONE}">
      <textPath href="#${arc}" startOffset="50%" text-anchor="middle">SIXFOLD COLORADO</textPath></text>`;
  return { svg: wrapSvg('0 0 340 240', label, inner, crown.defs + bill.defs) };
}

/* ======================================================================
   DAD / PATCH CAP — unstructured, low crown, applied patch
   ====================================================================== */
function dadCap({ label }) {
  const crown = fabric('#3d4b44', '#202a25', 0.4);
  const bill = fabric('#2c3832', '#141c18', 0.4);
  const crownD = 'M56 148 C 52 92, 96 52, 170 50 C 244 52, 288 92, 284 148 C 244 132, 96 132, 56 148 Z';
  const billD = 'M60 148 C 54 180, 86 206, 160 210 C 220 210, 266 194, 292 166 L 282 148 C 244 166, 96 166, 60 148 Z';
  const pw = 132, ph = 52, px = 170 - pw / 2, py = 68;
  const inner = `
    ${contact(172, 214, 120, 13)}
    <path d="${billD}" fill="url(#${bill.body})"/>
    <path d="${billD}" fill="url(#${bill.vig})"/>
    <path d="${billD}" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="2"/>
    <path d="M70 158 C 108 178, 236 174, 278 152" stroke="#000" stroke-opacity=".22" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <path d="M74 176 C 110 196, 224 192, 280 166" stroke="#000" stroke-opacity=".18" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <path d="M78 194 C 112 212, 210 208, 268 184" stroke="#000" stroke-opacity=".14" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
    <path d="${crownD}" fill="url(#${crown.body})"/>
    <path d="${crownD}" fill="url(#${crown.vig})"/>
    <path d="M60 134 C 58 90, 100 56, 170 54 C 240 56, 282 90, 280 134" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>
    <ellipse cx="142" cy="88" rx="94" ry="42" fill="#fff" opacity=".1" filter="url(#blur9)"/>
    <path d="M170 132 L170 56 M120 134 C 126 96, 146 66, 168 56 M220 134 C 214 96, 194 66, 172 56" stroke="#000" stroke-opacity=".16" stroke-width="1.3" stroke-dasharray="2 3" fill="none"/>
    <path d="M58 146 C 96 132, 244 132, 282 146 C 244 150, 96 150, 58 146 Z" fill="#000" opacity=".3" filter="url(#blur2)"/>
    <circle cx="170" cy="54" r="5.5" fill="url(#${crown.body})" stroke="#000" stroke-opacity=".3"/>
    <!-- applied patch, seated on the crown -->
    <rect x="${px}" y="${py + 3}" width="${pw}" height="${ph}" rx="9" fill="#000" opacity=".3" filter="url(#blur2)"/>
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="9" fill="#dcd3bd"/>
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="9" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.5"/>
    <rect x="${px + 1}" y="${py + 1}" width="${pw - 2}" height="16" rx="8" fill="#000" opacity=".12"/>
    <rect x="${px + 4}" y="${py + 4}" width="${pw - 8}" height="${ph - 8}" rx="6" fill="none" stroke="#8a8265" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2 2.4"/>
    ${crest(px + pw / 2 - 22, py + 6, 44, '#aa9f80')}
    <text x="${px + pw / 2}" y="${py + ph - 9}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="9" letter-spacing="3" fill="#4f4835">SIXFOLD</text>`;
  return { svg: wrapSvg('0 0 340 240', label, inner, crown.defs + bill.defs) };
}

/* ======================================================================
   BEANIE — cuffed rib knit + woven label
   ====================================================================== */
function beanie({ label }) {
  const f = fabric('#1b1712', '#0c0a08', 0.5);
  const domeD = `M66 172 C 62 76, 110 42, 152 42 C 194 42, 242 76, 238 172 Z`;
  const cuffD = `M58 158 C 100 150, 204 150, 246 158 L 246 206 C 246 218, 236 226, 224 226 L 80 226 C 68 226, 58 218, 58 206 Z`;
  const clip = `cl${gid++}`;
  const inner = `
    ${contact(152, 230, 116, 15)}
    <clipPath id="${clip}"><path d="${domeD}"/></clipPath>
    <path d="${domeD}" fill="url(#${f.body})"/>
    <g clip-path="url(#${clip})">
      <path d="${domeD}" fill="url(#ribDome)"/>
      <path d="${domeD}" fill="url(#${f.vig})"/>
      <ellipse cx="120" cy="86" rx="70" ry="54" fill="#fff" opacity=".08" filter="url(#blur9)"/>
      <path d="M150 44 C 120 90, 116 150, 128 200 L 150 200 C 140 150, 150 90, 170 44 Z" fill="#000" opacity=".12" filter="url(#blur5)"/>
    </g>
    <!-- shadow under the fold -->
    <path d="M60 158 C 100 150, 204 150, 244 158 C 200 166, 104 166, 60 158 Z" fill="#000" opacity=".35" filter="url(#blur2)"/>
    <!-- cuff -->
    <path d="${cuffD}" fill="url(#${f.body})"/>
    <path d="${cuffD}" fill="url(#ribCuff)"/>
    <path d="${cuffD}" fill="url(#${f.vig})" opacity=".7"/>
    <path d="M60 160 C 104 152, 200 152, 244 160" stroke="#fff" stroke-opacity=".1" stroke-width="2" fill="none"/>
    <!-- woven label -->
    <rect x="124" y="176" width="56" height="34" rx="3" fill="#000" opacity=".3" filter="url(#blur2)"/>
    <rect x="124" y="174" width="56" height="34" rx="3" fill="${EMBER}"/>
    <rect x="124" y="174" width="56" height="34" rx="3" fill="none" stroke="#000" stroke-opacity=".25" stroke-dasharray="2 2" stroke-width="1"/>
    ${crest(140, 178, 24, '#1b1712')}
  `;
  return { svg: wrapSvg('0 0 304 252', label, inner, f.defs) };
}

/* ======================================================================
   MERROW-BORDER PATCH
   ====================================================================== */
function patchBadge({ label }) {
  const inner = `
    ${contact(150, 210, 118, 14)}
    <rect x="42" y="30" width="216" height="188" rx="22" fill="#000" opacity=".3" filter="url(#blur5)"/>
    <rect x="40" y="26" width="216" height="188" rx="22" fill="${EMBER}"/>
    <rect x="40" y="26" width="216" height="188" rx="22" fill="none" stroke="${EMBER_INK}" stroke-width="12" stroke-dasharray="2 11" stroke-linecap="round"/>
    <rect x="40" y="26" width="216" height="188" rx="22" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>
    <rect x="54" y="40" width="188" height="160" rx="14" fill="#e8e0cf"/>
    <rect x="54" y="40" width="188" height="160" rx="14" fill="url(#weave)"/>
    <rect x="54" y="40" width="188" height="160" rx="14" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="1"/>
    ${crest(96, 66, 104, TIMBER, 'emb')}
    <text x="148" y="188" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="22" fill="${TIMBER}">Sixfold</text>
    <rect x="40" y="26" width="216" height="94" rx="22" fill="url(#sheen)" opacity=".12"/>`;
  return { svg: wrapSvg('0 0 300 252', label, inner) };
}

/* ======================================================================
   DIE-CUT STICKER SET
   ====================================================================== */
function stickerSet({ label }) {
  const die = (x, y, w, h, r, rot, body) =>
    `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
       <rect x="${x - 3}" y="${y + 3}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity=".22" filter="url(#blur2)"/>
       <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#fff"/>
       <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#cfc7b4" stroke-width="1.4"/>
       ${body}
     </g>`;
  const inner = `
    ${die(40, 40, 108, 108, 16, -7, crest(56, 52, 76, EMBER))}
    ${die(162, 50, 122, 36, 18, 6, `<rect x="162" y="50" width="122" height="36" rx="18" fill="${EMBER}"/><text x="223" y="73" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" fill="${PINE}" letter-spacing="4">LAND &amp; FIRE</text>`)}
    ${die(44, 166, 150, 46, 10, 3, `<rect x="44" y="166" width="150" height="46" rx="10" fill="${PINE}"/><text x="119" y="198" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="24" fill="${BONE}">Sixfold</text>`)}
    ${die(214, 150, 74, 66, 10, -5, `<path d="M222 208 L251 154 L280 208 Z" fill="${EMBER}"/>`)}`;
  return { svg: wrapSvg('0 0 300 252', label, inner) };
}

/* ======================================================================
   ENAMEL PIN
   ====================================================================== */
function pin({ label }) {
  const inner = `
    ${contact(150, 214, 96, 13)}
    <g transform="translate(6 10)">
      <path d="M56 34 h176 a18 18 0 0 1 18 18 v128 a18 18 0 0 1 -18 18 h-176 a18 18 0 0 1 -18 -18 v-128 a18 18 0 0 1 18 -18 z" fill="#0b0f0d"/>
      <path d="M56 34 h176 a18 18 0 0 1 18 18 v128 a18 18 0 0 1 -18 18 h-176 a18 18 0 0 1 -18 -18 v-128 a18 18 0 0 1 18 -18 z" fill="none" stroke="url(#metal)" stroke-width="6"/>
      <path d="M56 34 h176 a18 18 0 0 1 18 18 v128 a18 18 0 0 1 -18 18 h-176 a18 18 0 0 1 -18 -18 v-128 a18 18 0 0 1 18 -18 z" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.5"/>
      ${crest(78, 58, 132, EMBER)}
      <rect x="78" y="146" width="132" height="6" fill="url(#metal)"/>
      <text x="144" y="192" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="12" letter-spacing="5" fill="#e9d1a3">SIXFOLD</text>
      <path d="M40 40 L250 40 L250 96 Q 140 120 40 96 Z" fill="url(#sheen)" opacity=".22"/>
    </g>`;
  return { svg: wrapSvg('0 0 300 240', label, inner) };
}

/* ======================================================================
   CANVAS GEAR TOTE
   ====================================================================== */
function tote({ label }) {
  const f = fabric('#d8c6a0', '#b39a6d', 0.42);
  const bodyD = `M52 88 h196 a4 4 0 0 1 4 4 v168 a6 6 0 0 1 -6 6 h-192 a6 6 0 0 1 -6 -6 v-168 a4 4 0 0 1 4 -4 z`;
  const clip = `cl${gid++}`;
  const inner = `
    ${contact(150, 272, 130, 14)}
    <!-- webbing handles -->
    <path d="M86 90 C 84 36, 132 36, 132 90" fill="none" stroke="#b09765" stroke-width="11"/>
    <path d="M86 90 C 84 36, 132 36, 132 90" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="11" stroke-dasharray="1 60"/>
    <path d="M168 90 C 168 36, 216 36, 214 90" fill="none" stroke="#b09765" stroke-width="11"/>
    <clipPath id="${clip}"><path d="${bodyD}"/></clipPath>
    <path d="${bodyD}" fill="url(#${f.body})"/>
    <g clip-path="url(#${clip})">
      <path d="${bodyD}" fill="url(#weave)"/>
      <path d="${bodyD}" fill="url(#${f.vig})"/>
      <rect x="46" y="232" width="212" height="36" fill="#000" opacity=".12"/>
      <path d="M92 92 C 108 150, 104 230, 92 266 M210 92 C 198 150, 202 230, 214 266" stroke="#000" stroke-opacity=".08" stroke-width="6" filter="url(#blur2)"/>
      <ellipse cx="180" cy="120" rx="90" ry="50" fill="#fff" opacity=".14" filter="url(#blur9)"/>
    </g>
    <!-- box stitches at handle roots -->
    <rect x="80" y="86" width="14" height="14" fill="none" stroke="#6f5f3d" stroke-opacity=".6" stroke-width="1.4"/>
    <rect x="124" y="86" width="14" height="14" fill="none" stroke="#6f5f3d" stroke-opacity=".6" stroke-width="1.4"/>
    <rect x="162" y="86" width="14" height="14" fill="none" stroke="#6f5f3d" stroke-opacity=".6" stroke-width="1.4"/>
    <rect x="206" y="86" width="14" height="14" fill="none" stroke="#6f5f3d" stroke-opacity=".6" stroke-width="1.4"/>
    <g filter="url(#warp)">
      ${crest(116, 112, 68, TIMBER)}
      <text x="150" y="210" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" letter-spacing="2.5" fill="${TIMBER}">SLASH · CHIP · HAUL</text>
    </g>`;
  return { svg: wrapSvg('0 0 300 288', label, inner, f.defs) };
}

/* ======================================================================
   TRUCK DOOR DECAL
   ====================================================================== */
function truckDoor({ label }) {
  const inner = `
    <defs>
      <linearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b333a"/><stop offset=".5" stop-color="#20272d"/><stop offset="1" stop-color="#161b20"/>
      </linearGradient>
    </defs>
    <rect x="16" y="16" width="288" height="208" rx="16" fill="url(#cab)"/>
    <rect x="16" y="16" width="288" height="96" rx="16" fill="url(#sheen)" opacity=".08"/>
    <path d="M26 150 q 132 -20 264 0" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3"/>
    <path d="M26 154 q 132 -20 264 0" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="2"/>
    <rect x="16" y="188" width="288" height="36" rx="14" fill="#000" opacity=".14"/>
    <!-- handle recess -->
    <rect x="252" y="92" width="34" height="30" rx="8" fill="#000" opacity=".45"/>
    <rect x="256" y="99" width="24" height="7" rx="3.5" fill="#c9cdd0"/>
    <!-- vinyl decal, slight lift shadow -->
    <g transform="translate(1.5 2)" opacity=".35">${crest(34, 64, 66, '#000')}</g>
    ${crest(34, 62, 66, EMBER)}
    <text x="116" y="90" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="25" fill="${BONE}">Sixfold Colorado</text>
    <rect x="116" y="100" width="150" height="3" fill="${EMBER}"/>
    <text x="116" y="125" font-family="ui-monospace, Consolas, monospace" font-size="9" letter-spacing="1" fill="${MOSS}">FIRE MITIGATION · FRONT RANGE</text>
    <text x="116" y="148" font-family="ui-monospace, Consolas, monospace" font-size="13" letter-spacing="2" fill="${BONE}">(303) 915-1045</text>`;
  return { svg: wrapSvg('0 0 320 240', label, inner) };
}

/* ======================================================================
   JOB-SITE SIGN — coroplast on wire stakes
   ====================================================================== */
function yardSign({ label }) {
  const inner = `
    ${contact(150, 232, 96, 12)}
    <path d="M86 176 L82 236 M214 176 L218 236" stroke="#9aa7c2" stroke-width="5"/>
    <path d="M70 200 L230 200" stroke="#9aa7c2" stroke-width="4"/>
    <rect x="38" y="30" width="224" height="160" rx="3" fill="${PINE}"/>
    <rect x="38" y="30" width="224" height="160" rx="3" fill="url(#flute)"/>
    <rect x="38" y="30" width="224" height="160" rx="3" fill="none" stroke="#2c3a34" stroke-width="2"/>
    <rect x="38" y="30" width="224" height="70" fill="#fff" opacity=".03"/>
    ${crest(128, 42, 44, EMBER)}
    <text x="150" y="112" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" letter-spacing="2" fill="${BONE}">DEFENSIBLE SPACE</text>
    <text x="150" y="132" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" letter-spacing="2" fill="${BONE}">WORK IN PROGRESS</text>
    <rect x="96" y="146" width="108" height="3" fill="${EMBER}"/>
    <text x="150" y="172" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="17" fill="${BONE}">Sixfold Colorado</text>`;
  return { svg: wrapSvg('0 0 300 248', label, inner) };
}

/* ======================================================================
   ENAMEL CAMP MUG
   ====================================================================== */
function mug({ label }) {
  const f = fabric('#1a1512', '#0b0908', 0.35);
  const bodyD = `M60 66 C 60 60, 204 60, 204 66 L 200 186 C 200 200, 176 208, 132 208 C 88 208, 64 200, 64 186 Z`;
  const clip = `cl${gid++}`;
  const inner = `
    ${contact(132, 214, 104, 13)}
    <path d="M204 88 q 54 6 54 54 q 0 48 -54 54" fill="none" stroke="#EDE7DC" stroke-width="12"/>
    <path d="M204 88 q 54 6 54 54 q 0 48 -54 54" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/>
    <clipPath id="${clip}"><path d="${bodyD}"/></clipPath>
    <path d="${bodyD}" fill="url(#${f.body})"/>
    <g clip-path="url(#${clip})">
      <rect x="56" y="56" width="24" height="160" fill="#000" opacity=".3"/>
      <rect x="188" y="56" width="24" height="160" fill="#000" opacity=".3"/>
      <rect x="104" y="56" width="40" height="160" fill="#fff" opacity=".07"/>
      <g fill="#fff" opacity=".14">
        <circle cx="86" cy="150" r="1.4"/><circle cx="120" cy="96" r="1.2"/><circle cx="150" cy="180" r="1.5"/>
        <circle cx="172" cy="120" r="1.2"/><circle cx="100" cy="188" r="1.3"/><circle cx="158" cy="80" r="1.1"/>
      </g>
    </g>
    <!-- bone rim + a chip -->
    <ellipse cx="132" cy="66" rx="72" ry="15" fill="#14100e" stroke="#EDE7DC" stroke-width="4"/>
    <path d="M150 52 a6 5 0 0 1 10 3 a6 5 0 0 1 -10 -3 Z" fill="#14100e"/>
    <g filter="url(#warp)">
      ${crest(104, 92, 56, EMBER)}
      <text x="132" y="170" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="10" letter-spacing="5" fill="${MOSS}">LAND &amp; FIRE</text>
    </g>`;
  return { svg: wrapSvg('0 0 300 240', label, inner, f.defs) };
}

/* ---- prints for the tees -------------------------------------------------- */
const P = {
  ridge: `${crest(132, 84, 76, EMBER)}
    <text x="170" y="196" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="30" fill="${BONE}" letter-spacing="-.5">Sixfold</text>
    <text x="170" y="218" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" fill="${MOSS}" letter-spacing="6">COLORADO</text>`,
  whoPays: `${crest(154, 70, 32, MOSS)}
    <text x="170" y="150" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="22" fill="${BONE}">We do the work</text>
    <text x="170" y="178" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="22" fill="${BONE}">and show you</text>
    <text x="170" y="206" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="22" fill="${EMBER}">who pays for it.</text>`,
  band: `<g>
      <path d="M96 164 L120 120 L144 164 Z" fill="${EMBER_INK}" fill-opacity=".45"/>
      <path d="M124 164 L152 108 L180 164 Z" fill="${EMBER_INK}" fill-opacity=".64"/>
      <path d="M160 164 L192 100 L224 164 Z" fill="${EMBER_INK}" fill-opacity=".82"/>
      <path d="M200 164 L232 112 L264 164 Z" fill="${EMBER_INK}"/>
      <rect x="96" y="164" width="168" height="5" fill="#7f9270"/>
    </g>
    <text x="170" y="196" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="12" fill="${EMBER_INK}" letter-spacing="7">LAND &amp; FIRE</text>
    <text x="170" y="300" text-anchor="middle" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="16" fill="${PINE}">Sixfold</text>`,
  firstFive: `<ellipse cx="170" cy="130" rx="62" ry="30" fill="none" stroke="${BONE}" stroke-width="2.5" stroke-dasharray="3 7"/>
    <path d="M146 130 L170 108 L194 130 Z" fill="${BONE}"/><rect x="152" y="130" width="36" height="24" fill="${BONE}"/>
    <text x="170" y="204" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="12" fill="${BONE}" letter-spacing="4">IT STARTS IN THE</text>
    <text x="170" y="226" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="16" fill="${PINE}" letter-spacing="3">FIRST FIVE FEET</text>
    ${crest(156, 240, 28, BONE)}`,
  hoodie: `<text x="170" y="138" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="11" fill="${MOSS}" letter-spacing="8">FRONT RANGE</text>
    ${crest(134, 146, 72, EMBER, 'emb')}
    <text x="170" y="234" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="10" fill="${BONE}" letter-spacing="4">FIRE MITIGATION CREW</text>`,
  hivis: `<rect x="106" y="120" width="128" height="17" fill="#cfd2d5"/><rect x="98" y="266" width="144" height="17" fill="#cfd2d5"/>
    <rect x="130" y="132" width="15" height="146" fill="#cfd2d5"/><rect x="195" y="132" width="15" height="146" fill="#cfd2d5"/>
    ${crest(142, 168, 56, PINE)}
    <text x="170" y="236" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="10.5" fill="${PINE}" letter-spacing="2.5">SIXFOLD COLORADO</text>`,
};

/* ======================================================================
   ITEMS  — copy carried verbatim from the hand-authored page
   ====================================================================== */
const SECTIONS = [
  {
    kicker: 'Apparel', heading: 'Shirts &amp; caps', items: [
      { m: () => tee({ label: 'Pine Black tee, front, with the Ridge mark and Sixfold wordmark', a: '#211d18', b: '#0c0a08', print: P.ridge }),
        h: 'Ridge tee — primary', p: 'The house shirt. Mark, wordmark, service state, nothing else.',
        s: [['Placement', 'Centre chest, ~9&nbsp;in wide'], ['Colorway', 'Pine Black / Ember + Bone + Moss'], ['Method', '3-colour screen, water-based']] },
      { m: () => tee({ label: 'Timber tee, back, reading We do the work and show you who pays for it', a: '#2b3a33', b: '#131c18', collar: BONE, print: P.whoPays, view: 'back' }),
        h: '&ldquo;Who pays for it&rdquo; tee', p: 'The bio line, on the back. Small crest at the nape, mark on the left chest. The line already passed fact-check.',
        s: [['Placement', 'Upper back; left-chest crest on the front'], ['Colorway', 'Timber / Bone + Ember'], ['Method', '2-colour screen']] },
      { light: true, m: () => tee({ label: 'Bone tee with a band of four ember ridge peaks across the chest', a: '#f4f0e7', b: '#ddd5c4', edge: 0.1, dark: false, print: P.band }),
        h: 'Ridge band tee', p: 'The four peaks read as a horizon line. Light garment, descriptor set small under the band, wordmark on the hem.',
        s: [['Placement', 'Chest band; wordmark at the hem'], ['Colorway', 'Bone / Ember-on-light + Moss'], ['Method', '2-colour screen, soft-hand']] },
      { m: () => hoodie({ label: 'Pine Black pullover hoodie, back, with a large Ridge mark and Front Range Fire Mitigation Crew', print: P.hoodie }),
        h: 'Crew hoodie', p: 'Heavyweight pullover for the dormant-season work. Big mark on the back, crest on the left chest, wordmark down one sleeve.',
        s: [['Placement', 'Full back; left chest; left sleeve'], ['Colorway', 'Pine Black / Ember + Moss + Bone'], ['Method', 'Screen back, embroidered chest']] },
      { m: () => truckerCap({ label: 'Trucker cap with the Ridge crest and Sixfold Colorado embroidered on the front panel' }),
        h: 'Trucker cap', p: 'Foam front, mesh back. Crest and name embroidered on the front panel.',
        s: [['Placement', 'Front panel, centred'], ['Colorway', 'Pine Black crown / Moss mesh / Ember stitch'], ['Method', 'Flat or 3D-puff embroidery']] },
      { m: () => dadCap({ label: 'Low-profile dad cap with an etched patch of the Ridge crest' }),
        h: 'Patch cap', p: 'Low-profile dad cap with a laser-etched patch. The quiet one, for off-site.',
        s: [['Placement', 'Front, tonal patch'], ['Colorway', 'Timber cap / Bone patch, etched Pine'], ['Method', 'Sewn PU/faux-leather patch']] },
      { m: () => beanie({ label: 'Cuffed knit beanie with a woven label of the mono Ridge crest on the cuff' }),
        h: 'Cuffed beanie', p: 'Ribbed knit, woven label on the fold. Cold-morning crew wear.',
        s: [['Placement', 'Centre cuff, woven label'], ['Colorway', 'Pine Black knit / Ember + Bone label'], ['Method', 'Damask woven label, sewn']] },
      { m: () => tee({ label: 'Moss tee with a house-and-zone icon and the line It starts in the first five feet', a: '#7d9270', b: '#4f6248', edge: 0.4, collar: '#4f6248', print: P.firstFive }),
        h: '&ldquo;First five feet&rdquo; field tee', p: 'Education-forward, and true — the zone against the wall matters most, and it\u2019s the part a homeowner can do without a crew.',
        s: [['Placement', 'Centre chest; crest below'], ['Colorway', 'Moss / Bone + Pine'], ['Method', '2-colour screen']] },
      { m: () => tee({ label: 'Hi-vis orange work shirt, back, with reflective bands and a black Ridge mark', a: '#ff7a1a', b: '#e2560a', edge: 0.35, collar: '#c94e0a', print: P.hivis }),
        h: 'Hi-vis crew shirt <span style="color:var(--moss)">— look only</span>',
        p: 'A graphic direction for an on-site shirt. The real garment has to be chosen against the visibility spec the work actually calls for.',
        s: [['Placement', 'Full back, over the reflective break'], ['Colorway', 'Safety Orange / black print / silver tape'], ['Method', 'Screen on certified garment']] },
    ],
  },
  {
    kicker: 'Patches, stickers, pins', heading: 'Small goods', items: [
      { light: true, m: () => patchBadge({ label: 'Iron-on twill patch with a merrow border and the Ridge crest' }),
        h: 'Merrow-border patch', p: '3.5&nbsp;in iron- or sew-on. For jackets, packs, and the gear bag.',
        s: [['Size', '~3.5&nbsp;in, rounded rectangle'], ['Colorway', 'Bone twill / Timber thread / Ember border'], ['Method', '60&ndash;75% embroidery coverage, merrow edge']] },
      { light: true, m: () => stickerSet({ label: 'A set of die-cut stickers: the crest, a Sixfold bar, a Land and Fire strip, and a single peak' }),
        h: 'Die-cut sticker set', p: 'Hard-hat and water-bottle size. Crest, wordmark bar, descriptor strip, and a lone peak.',
        s: [['Size', '2&ndash;3&nbsp;in each'], ['Colorway', 'On Bone and on clear'], ['Method', 'Die-cut vinyl, matte laminate']] },
      { m: () => pin({ label: 'Hard enamel pin of the Ridge crest on a metal plaque' }),
        h: 'Enamel pin', p: 'Hard enamel on black-nickel. Cap, lapel, or bag strap.',
        s: [['Size', '~1.25&nbsp;in'], ['Colorway', 'Black nickel / Ember + Moss + Bone fill'], ['Method', 'Hard enamel, two rubber clutches']] },
      { m: () => tote({ label: 'Natural canvas gear tote with the crest and the words Slash Chip Haul' }),
        h: 'Canvas gear tote', p: 'Heavy natural canvas. Crest above, the work in three words below.',
        s: [['Size', '~16 &times; 14 &times; 5&nbsp;in'], ['Colorway', 'Natural canvas / Timber print'], ['Method', '1-colour screen']] },
    ],
  },
  {
    kicker: 'On the truck and the job site', heading: 'Beyond apparel', items: [
      { m: () => truckDoor({ label: 'Truck cab door with a cut-vinyl lockup: crest, Sixfold Colorado, Fire mitigation Front Range, and the phone number' }),
        h: 'Truck door decal', p: 'The standing contact line, cut in vinyl. Same wording on every surface.',
        s: [['Placement', 'Both cab doors'], ['Colorway', 'Ember + Bone + Moss on the cab'], ['Method', 'Cut vinyl, or printed + laminated']] },
      { m: () => yardSign({ label: 'Coroplast yard sign on two stakes reading Defensible space work in progress, Sixfold Colorado' }),
        h: 'Job-site sign', p: 'Coroplast on wire stakes, left at the road during a job. Doubles as the cheapest neighbourhood advertising there is.',
        s: [['Size', '18 &times; 24&nbsp;in'], ['Colorway', 'Pine Black / Ember + Bone'], ['Method', 'Direct-print coroplast, double-sided']] },
      { m: () => mug({ label: 'Speckled enamel camp mug with the crest and the words Land and Fire' }),
        h: 'Enamel camp mug', p: 'Speckled enamelware, wraparound mark. Truck-cab and gift use.',
        s: [['Size', '12&nbsp;oz'], ['Colorway', 'Pine body / Bone rim / Ember mark'], ['Method', 'Enamel transfer, kiln-fired']] },
    ],
  },
];

const BEYOND = [
  ['Magnetic door sign', 'The truck-door lockup as a removable magnet for a personal vehicle.'],
  ['Hard-hat dome stickers', 'Small curved crest decals, helmet-rated adhesive.'],
  ['Printed flagging tape', 'Moss tape printed &ldquo;SIXFOLD&rdquo; for marking keep zones and cut lines.'],
  ['Chip-truck box banner', 'Mesh vinyl for the chipper box side — the biggest flat surface on the job.'],
  ['Water bottle', 'Single-wall steel, mono crest, for the truck kit.'],
  ['Field notebook', 'Pocket book with the crest debossed on Bone board — the scope notes start here.'],
];

/* ---- assemble ---------------------------------------------------------- */
const card = (it) => `
      <article class="card${it.light ? ' light' : ''}">
        <div class="mock">${it.m().svg}</div>
        <div class="body">
          <h3>${it.h}</h3>
          <p>${it.p}</p>
          <div class="spec">
            ${it.s.map(([k, v]) => `<div><b>${k}</b> ${v}</div>`).join('\n            ')}
          </div>
        </div>
      </article>`;

const section = (sec) => `
  <section class="wrap">
    <p class="kicker">${sec.kicker}</p>
    <h2>${sec.heading}</h2>
    <div class="grid">
${sec.items.map(card).join('\n')}
    </div>
  </section>`;

const HEAD_MARK = `<svg viewBox="4 14 94 77" role="img" aria-label="Sixfold"><g fill="currentColor">${CREST}</g></svg>`;

const html = `<!doctype html>
<!--
  Sixfold Colorado — merch concept board (draft build on disk).
  GENERATED by build-merch.mjs — edit that, not this file.
  NOT a store. No pricing, no order flow, nothing printed or ordered.
  Mark = Ridge (Sweep still an open call). "Land & Fire" is the settled descriptor as of 2026-09-16.
  No garment claims a licence, certification, bond or Firewise status.
-->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sixfold Colorado — Merch board</title>
  <meta name="description" content="Design directions for Sixfold Colorado merch and branding — shirts, caps, patches, stickers, and job-site pieces. Concept board, not a store.">
  <link rel="stylesheet" href="../assets/site.css">
</head>
<body>
${DEFS}
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="../">
      ${HEAD_MARK}
      <b>Sixfold</b><span>Land &amp; Fire · Colorado</span>
    </a>
    <nav class="nav">
      <a href="../#work">The work</a>
      <a href="../#money">Who pays</a>
      <a href="./">Merch</a>
      <a class="nav-cta" href="../#contact">Contact</a>
    </nav>
  </div>
</header>

<main>

  <section class="wrap board-intro">
    <p class="kicker">Merch &amp; branding — concept board</p>
    <h1>Things that can carry the mark.</h1>
    <p class="lede">Shirts, caps, patches, stickers, and the pieces that go on a truck and a
    job site. These are directions for review, not a shop.</p>
    <ul class="notes">
      <li>Not a store. No prices and no order flow — the launch offer and the rate card
        are still open, so nothing here commits to a number.</li>
      <li>Mark shown is <b>Ridge</b>, which every Sixfold asset uses. Sweep is still
        formally an open call.</li>
      <li>"Land &amp; Fire" is the settled descriptor — it is printed on the business cards and the vehicle magnets.</li>
      <li>Nothing claims "licensed and insured", "certified", "bonded" or "Firewise" —
        none of that is true yet. The hi-vis shirt is a graphic direction only; a real
        crew garment has to meet the visibility spec the work calls for.</li>
      <li>No web address is printed anywhere — the domain isn't hosted. Contact pieces
        carry the phone and email instead.</li>
      <li>Colorways use the agreed five: Pine Black, Ember, Moss, Bone, Timber.</li>
      <li>Mockups are rendered vector, not photos — for form and placement, not final art.</li>
    </ul>
  </section>
${SECTIONS.map(section).join('\n')}

  <section class="wrap">
    <p class="kicker" style="margin-top:8px">Also worth making</p>
    <div class="beyond">
      ${BEYOND.map(([h, p]) => `<div><h3>${h}</h3><p>${p}</p></div>`).join('\n      ')}
    </div>
  </section>

  <section class="wrap">
    <p class="backlink"><a href="../">&larr; Back to the landing page</a></p>
  </section>

</main>

<footer class="site-foot">
  <div class="wrap">
    <div>
      <div class="word">Sixfold</div>
      <p class="fine">Fire mitigation · Front Range · (303) 915-1045</p>
    </div>
    <p class="fine">
      Concept board — nothing on this page is printed, ordered, priced or published.<br>
      <a href="mailto:Contact@SixfoldColorado.com">Contact@SixfoldColorado.com</a>
    </p>
  </div>
</footer>

</body>
</html>
`;

/* Written only when this file is RUN, not when it is imported. The tee renderer
   and the shared filter defs are reused by operations/build-crew-shirt-spec.mjs,
   and importing must not silently rewrite the concept board. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(here, 'index.html'), html, 'utf8');
  console.log('wrote', join(here, 'index.html'), `(${(html.length / 1024).toFixed(1)} kB)`);
}

export { tee, DEFS, crest };

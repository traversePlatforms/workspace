/* Sixfold — vehicle magnets. Asked for 2026-09-16 by the crew ("2ft long by
   1/1.5ft tall" = the two stock car-magnet sizes). Brandon has green-lit the spend.

   Outputs (this folder):
     magnet-24x12.html / .pdf         primary, Pine ground     — 2:1, the standard door magnet
     magnet-24x18.html / .pdf         primary, Pine ground     — 4:3, fills a truck door
     magnet-24x12-light.html / .pdf   Bone ground alternate    — for a dark vehicle
     proof.png                        all three from the PDFs, to send to the crew

   Print spec baked into each page (the numbers a vendor asks for):
     trim 24x12 or 24x18 in · bleed 0.125 in each side · safe area 0.75 in inside trim
     (vendors round the corners ~1 in and the safe zone clears that) · 30 mil magnetic
     stock, vehicle grade · rounded corners. Colours are the brand hex values; vendors
     print CMYK, so expect Ember to come back a touch duller than the screen — that is
     the same drift every printed piece has and is not a file problem.

   Uses the FLAT Ridge mark (sixfold-mark-ridge-flat.svg) — solid fills, no opacity —
   because a vehicle graphic is read at 30 ft and the layered translucency of the
   master is lost at that distance anyway.

   Copy is the settled lockup: mark / Sixfold / LAND & FIRE · COLORADO / the service
   line settled 2026-09-16 / the phone. No URL (not hosted), no address, no claims —
   the standing Sixfold copy constraints. Then:
     node tools/html-to-pdf.mjs magnet     (from sixfold/) for the PDFs
   Run:  node sixfold/brand/vehicle/build-magnets.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = readFileSync(join(HERE, '..', 'sixfold-mark-ridge-flat.svg'), 'utf8')
  .replace(/<title>[^<]*<\/title>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '')
  .replace(/width="500" height="480"/, 'width="100%" height="100%"');

const PINE = '#0E1512', EMBER = '#E4703A', EMBER_INK = '#B84C15', MOSS = '#8AA07A', BONE = '#EDE7DC', TIMBER = '#1F2A25';
const BLEED = 0.125, SAFE = 0.75;

const SERVICES = 'FIRE MITIGATION &middot; LAND CLEARING &middot; LANDSCAPING';
const PHONE = '(303) 915-1045';
/* Added 2026-09-18 on Matthew's instruction that the site will be live before
   anything goes out. Set at the services size, NOT the phone size: a door is read
   at 30 ft and the phone has to stay the second-largest thing on it, which is the
   decision recorded in README.md. The URL is for whoever is stopped behind you at
   a light, and it does not get to compete with the number. */
const SITE = 'SixfoldColorado.com';

function page({ w, h, ground, ink, accent, band, muted, markSvg, name }) {
  const W = w + 2 * BLEED, H = h + 2 * BLEED;
  const wide = w / h >= 1.8;           // 2:1 -> side-by-side; 4:3 -> mark above
  // Type sizes are in inches of cap-height-ish, converted to pt (72/in). Tuned per
  // shape so the phone is the second-largest thing after the name, and the lockup
  // sits inside the safe area with room to spare.
  const t = wide
    ? { name: 250, band: 38, svc: 30, svcTrack: '.07em', phone: 112, markH: 7.2, gap: 0.55 }
    : { name: 300, band: 46, svc: 50, svcTrack: '.12em', phone: 150, markH: 7.6, gap: 0.5 };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold vehicle magnet ${name}</title>
<style>
  @page{size:${W}in ${H}in;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{width:${W}in;height:${H}in;background:${ground};color:${ink};overflow:hidden;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif}
  .trim{position:absolute;inset:${BLEED}in;}
  .safe{position:absolute;inset:${BLEED + SAFE}in;display:flex;
    ${wide ? 'flex-direction:row;align-items:center;gap:0.9in' : 'flex-direction:column;align-items:center;justify-content:center;gap:0.35in;text-align:center'}}
  .mark{flex:none;height:${t.markH}in;width:${(t.markH * 100 / 96).toFixed(3)}in}
  .mark svg{display:block;width:100%;height:100%}
  .lock{display:flex;flex-direction:column;${wide ? 'align-items:flex-start' : 'align-items:center'};gap:${t.gap}in;min-width:0}
  .name{font-size:${t.name}pt;line-height:.86;letter-spacing:-.018em;color:${ink};margin:0}
  .mono{font-family:"Cascadia Mono",Consolas,"SFMono-Regular",monospace;text-transform:uppercase}
  .band{font-size:${t.band}pt;letter-spacing:.32em;color:${band};line-height:1}
  .svc{font-size:${t.svc}pt;letter-spacing:${t.svcTrack};color:${muted};line-height:1.15;white-space:nowrap}
  .phone{font-size:${t.phone}pt;letter-spacing:.02em;color:${accent};line-height:1;margin-top:.1in;white-space:nowrap}
  .url{font-size:${t.svc}pt;letter-spacing:${t.svcTrack};color:${muted};line-height:1.15;white-space:nowrap;margin-top:.06in}
  /* Screen-only guides so the proof shows trim + safe; they do not print. */
  @media screen{.trim{outline:1px dashed rgba(127,127,127,.6)}.safe{outline:1px dashed rgba(127,127,127,.35)}}
  @media print{.trim,.safe{outline:none}}
</style></head>
<body>
  <div class="trim"></div>
  <div class="safe">
    <div class="mark">${markSvg}</div>
    <div class="lock">
      <div class="name">Sixfold</div>
      <div class="mono band">Land &amp; Fire &middot; Colorado</div>
      <div class="mono svc">${SERVICES}</div>
      <div class="mono phone">${PHONE}</div>
      <div class="mono url">${SITE}</div>
    </div>
  </div>
</body></html>
`;
}

const markDark = MARK;
const markLight = MARK.replace(/#E4703A/g, EMBER_INK).replace(/#8AA07A/g, TIMBER);

const variants = [
  { file: 'magnet-24x12',       w: 24, h: 12, ground: PINE, ink: BONE, accent: EMBER,     band: MOSS,      muted: 'rgba(237,231,220,.62)', markSvg: markDark,  name: '24×12 in, Pine' },
  { file: 'magnet-24x18',       w: 24, h: 18, ground: PINE, ink: BONE, accent: EMBER,     band: MOSS,      muted: 'rgba(237,231,220,.62)', markSvg: markDark,  name: '24×18 in, Pine' },
  { file: 'magnet-24x12-light', w: 24, h: 12, ground: BONE, ink: PINE, accent: EMBER_INK, band: '#5F7A55', muted: '#5F6A62',              markSvg: markLight, name: '24×12 in, Bone (alternate)' },
];
for (const v of variants) writeFileSync(join(HERE, `${v.file}.html`), page(v));

// proof.png is rasterised from the finished PDFs (see README.md) — not from
// these HTML pages — so what the crew sees is what the printer receives.
console.log('wrote', variants.map(v => v.file + '.html').join(', '));

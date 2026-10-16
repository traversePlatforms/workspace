/* Combined Sixfold + 365 badge drafts (2026-10-15, Brandon via Matthew: keep the Sixfold Ridge mark with the orange and the roots,
   "365" across the top and "Land aeration and seeding" around the bottom, wrapped in a circle like the 365 badge is now).
   Writes option-a/b/c.svg + .html and renders PNGs with headless Chrome:  node build.mjs */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* the Ridge mark, as in sixfold/brand/sixfold-mark-ridge.svg (viewBox 0 0 100 116) */
const ridge = (ember, moss) => `
    <path d="M18 84 L36 48 L54 84 Z" fill="${ember}" fill-opacity="0.4"/>
    <path d="M30 84 L50 38 L70 84 Z" fill="${ember}" fill-opacity="0.6"/>
    <path d="M44 84 L66 26 L88 84 Z" fill="${ember}" fill-opacity="0.82"/>
    <path d="M60 84 L79 14 L98 84 Z" fill="${ember}"/>
    <g fill="${moss}"><rect x="20.4" y="77" width="3.2" height="7"/><path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/><path d="M22 62 L12 74 L32 74 Z"/><path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/></g>
    <rect x="4" y="86" width="92" height="5" fill="${moss}"/>
    <g fill="none" stroke="${moss}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M94 91 L92.2 94.4 L94.6 98 L91.4 102 L93.4 106 L90 109.4 L89.8 113" stroke-width="1.6"/>
      <path d="M90.5 91 L88.4 93.6 L85.4 95.2 L87.8 98.6 L82.4 101.4 L84.2 104.6 L79.6 108" stroke-width="1.35"/>
      <path d="M86.5 91 L83.8 92.6 L85.8 95 L80.4 96.2 L77.6 99 L74 99.2 L71.5 101" stroke-width="1.1"/>
      <path d="M96 91 L97.6 93.8 L95 96.2 L97.4 99.6 L94.8 102.4 L96 106" stroke-width="1.15"/>
      <path d="M92.6 91 L90.6 94.6 L92.4 97.6 L89.4 100.6 L90.6 104.4 L88 107.4" stroke-width="1.05"/>
      <path d="M87.8 98.6 L85.4 100.8 L86.6 103.4 L83 105.8 L83.8 109" stroke-width="0.9"/>
      <path d="M91.4 102 L94.2 103.4 L93.4 106.2 L95.8 108.6" stroke-width="0.85"/>
      <path d="M84.6 91 L82.4 92.6 L83.8 94.8 L78.4 95.6 L75.6 97.4 L72.4 97.6" stroke-width="0.8"/>
      <path d="M85.8 95 L83.4 96.8 L84.4 99.4 L80.6 100.8" stroke-width="0.75"/>
      <path d="M95 91 L96.6 94.2 L94.4 96.6 L96.4 100" stroke-width="0.85"/>
    </g>`;
const BOTTOM = 'LAND \u00b7 AERATION & SEEDING';
/* one badge: outer ring, an inner disc with a thin rim, the mark centred in the disc, 365 on the top arc, the line on the bottom arc */
function badge(o) {
  const C = 500, R = 470, IN = 292, RIM = 16;
  const top = 338, bot = 432;   /* text paths: the top text sits outside its path, the bottom text inside its path */
  /* 2026-10-16 (Matthew + Brandon): SIXFOLD inside the disc above the peaks; the mark a little smaller, bottom-aligned, roots kept */
  const s = 3.05, x = C - 51 * s, y = C + 268 - 113 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="Sixfold 365: ${o.label}">
  <defs>
    <path id="top-${o.id}" d="M ${C - top} ${C} A ${top} ${top} 0 0 1 ${C + top} ${C}"/>
    <path id="bot-${o.id}" d="M ${C - bot} ${C} A ${bot} ${bot} 0 0 0 ${C + bot} ${C}"/>
    <clipPath id="disc-${o.id}"><circle cx="${C}" cy="${C}" r="${IN}"/></clipPath>
  </defs>
  <circle cx="${C}" cy="${C}" r="${R}" fill="${o.ring}"/>
  ${o.ringLine ? `<circle cx="${C}" cy="${C}" r="${R - 12}" fill="none" stroke="${o.ringLine}" stroke-width="4"/>` : ''}
  <circle cx="${C}" cy="${C}" r="${IN + RIM}" fill="${o.rim}"/>
  <circle cx="${C}" cy="${C}" r="${IN}" fill="${o.disc}"/>
  <g clip-path="url(#disc-${o.id})"><g transform="translate(${x} ${y}) scale(${s})">${ridge(o.ember, o.moss)}
  </g></g>
  <text x="${C}" y="${C - 118}" text-anchor="middle" font-family="Outfit, 'DM Sans', sans-serif" font-weight="800" font-size="74" letter-spacing="16" fill="${o.inDisc}">SIXFOLD</text>
  <circle cx="${C - 388}" cy="${C}" r="20" fill="${o.dot}"/>
  <circle cx="${C + 388}" cy="${C}" r="20" fill="${o.dot}"/>
  <text font-family="Outfit, 'DM Sans', sans-serif" font-weight="800" font-size="150" letter-spacing="38" fill="${o.text}"><textPath href="#top-${o.id}" startOffset="50%" text-anchor="middle">365</textPath></text>
  <text font-family="Outfit, 'DM Sans', sans-serif" font-weight="700" font-size="56" letter-spacing="7" fill="${o.text2 || o.text}"><textPath href="#bot-${o.id}" startOffset="50%" text-anchor="middle">${BOTTOM.replace('&', '&amp;')}</textPath></text>
</svg>`;
}
const OPTIONS = [
  { id: 'a', label: 'Option A: 365 green ring, Sixfold mark on cream', name: 'A · 365 green', note: 'The 365 badge colours: forest green ring, cream text, gold dots. The Ridge mark sits on cream in the middle.',
    ring: '#2F5D2C', rim: '#FFF8EC', disc: '#FFF8EC', ember: '#E4703A', moss: '#4C7A3F', dot: '#F2C14E', text: '#FFF8EC', inDisc: '#2F5D2C' },
  { id: 'b', label: 'Option B: Sixfold dark ring with ember', name: 'B · Sixfold dark', note: 'Sixfold\u2019s own colours: pine black ring, bone text, ember dots. The Ridge mark on timber, exactly as on the Sixfold cards.',
    ring: '#0E1512', rim: '#EDE7DC', disc: '#1F2A25', ember: '#E4703A', moss: '#8AA07A', dot: '#E4703A', text: '#EDE7DC', text2: '#E4703A', inDisc: '#EDE7DC' },
  { id: 'c', label: 'Option C: light cream badge', name: 'C · Light (print)', note: 'Cream ring with forest green text and an ember outline. Lighter for shirts, yard signs and printing on white.',
    ring: '#FFF8EC', ringLine: '#E4703A', rim: '#2F5D2C', disc: '#FFF8EC', ember: '#E4703A', moss: '#4C7A3F', dot: '#E4703A', text: '#2F5D2C', inDisc: '#2F5D2C' },
];
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&display=block" rel="stylesheet">';
for (const o of OPTIONS) {
  const svg = badge(o);
  writeFileSync(join(HERE, `option-${o.id}.svg`), svg);
  writeFileSync(join(HERE, `option-${o.id}.html`), `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=1000,1000', '--virtual-time-budget=6000', `--screenshot=${join(HERE, `option-${o.id}.png`)}`, 'file:///' + join(HERE, `option-${o.id}.html`).replace(/\\/g, '/')], { stdio: 'ignore' });
}
/* one page to look at them side by side, on light and dark */
const cards = OPTIONS.map((o) => `<figure><div class="on light">${badge(o).replace(/id="(top|bot|disc)-/g, 'id="$1-L').replace(/#(top|bot|disc)-/g, '#$1-L')}</div><div class="on dark">${badge(o).replace(/id="(top|bot|disc)-/g, 'id="$1-D').replace(/#(top|bot|disc)-/g, '#$1-D')}</div><figcaption><b>${o.name}</b><span>${o.note}</span></figcaption></figure>`).join('\n');
writeFileSync(join(HERE, 'options.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sixfold and 365 badge drafts</title>${FONT}
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;background:#f4efe6;color:#1d2a1c;font:15px/1.5 'DM Sans',sans-serif}.wrap{max-width:1200px;margin:0 auto;padding:24px 16px 48px}h1{font:800 28px Outfit,sans-serif;margin:0 0 4px}p.sub{margin:0 0 22px;color:#5a6858}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}figure{margin:0;background:#fff;border:1px solid #e3dccf;border-radius:16px;padding:14px}
.on{display:inline-block;width:calc(50% - 6px);border-radius:12px;padding:10px;box-sizing:border-box}.on+.on{margin-left:8px}.light{background:#fff}.dark{background:#16201b}.on svg{width:100%;height:auto;display:block}
figcaption{margin-top:10px;display:grid;gap:2px}figcaption span{color:#5a6858;font-size:14px}</style></head><body><div class="wrap">
<h1>Sixfold \u00d7 365: badge drafts</h1><p class="sub">The Sixfold Ridge mark (orange peaks, tree and roots) in the middle; 365 across the top and LAND \u00b7 AERATION &amp; SEEDING around the bottom, like the 365 badge. Each shown on white and on dark. Drafts for Brandon.</p>
<div class="grid">${cards}</div></div></body></html>`);
console.log('wrote option-a/b/c .svg .html .png and options.html');

/* The Sixfold name INSIDE the combined badge (2026-10-16, Matthew: "instead of doing by sixfold maybe just include sixfold text in
   the image"). Three placements, each in the A/B/C colours, on one page:  node build-sixfold-name.mjs
     1  top arc: SIXFOLD 365, one size                      (bottom kept: LAND · AERATION & SEEDING)
     2  top arc: SIXFOLD smaller, 365 larger               (bottom kept)   [1+2 replaced the bottom-arc tries, Matthew 2026-10-16]
     3  inside the disc: SIXFOLD above the mark             (mark a little smaller, roots kept)
   Writes name-<n>-<a|b|c>.svg/.png and sixfold-name-options.html. The ridge and the colours are build.mjs's, copied. */
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const src = readFileSync(join(HERE, 'build.mjs'), 'utf8');
const ridgeBody = src.slice(src.indexOf('const ridge = '), src.indexOf('`;', src.indexOf('const ridge = ')) + 1);
const ridge = eval(ridgeBody.replace('const ridge = ', '(') + ')');
const COLOURS = {
  a: { name: 'A · 365 green', ring: '#2F5D2C', rim: '#FFF8EC', disc: '#FFF8EC', ember: '#E4703A', moss: '#4C7A3F', dot: '#F2C14E', text: '#FFF8EC', inDisc: '#2F5D2C' },
  b: { name: 'B · Sixfold dark', ring: '#0E1512', rim: '#EDE7DC', disc: '#1F2A25', ember: '#E4703A', moss: '#8AA07A', dot: '#E4703A', text: '#EDE7DC', text2: '#E4703A', inDisc: '#EDE7DC' },
  c: { name: 'C · Light', ring: '#FFF8EC', ringLine: '#E4703A', rim: '#2F5D2C', disc: '#FFF8EC', ember: '#E4703A', moss: '#4C7A3F', dot: '#E4703A', text: '#2F5D2C', inDisc: '#2F5D2C' },
};
const PLACES = {
  1: { title: '1 · Top arc: SIXFOLD 365, one size', note: 'Reads SIXFOLD 365 around the top in one line; LAND · AERATION & SEEDING kept on the bottom. The mark stays full size.', bottom: 'LAND · AERATION & SEEDING', size: 56, ls: 7, topText: '<tspan font-size="100" letter-spacing="14">SIXFOLD 365</tspan>' },
  2: { title: '2 · Top arc: SIXFOLD smaller, 365 larger', note: 'Same words, but 365 stays the big number and SIXFOLD sits before it in smaller letters. Bottom kept; mark full size.', bottom: 'LAND · AERATION & SEEDING', size: 56, ls: 7, topText: '<tspan font-size="84" letter-spacing="12">SIXFOLD</tspan><tspan font-size="140" letter-spacing="28" dx="30">365</tspan>' },
  3: { title: '3 · Inside the circle', note: 'SIXFOLD above the peaks; the mark a little smaller, roots kept. Reads as the Sixfold logo sitting inside the 365 ring.', bottom: 'LAND \u00b7 AERATION & SEEDING', size: 56, ls: 7, inside: true },
};
function badge(o, p, id) {
  const C = 500, R = 470, IN = 292, RIM = 16, top = 338, bot = 432;
  const s = p.inside ? 3.05 : 3.75;
  const x = C - 51 * s, y = p.inside ? C + 268 - 113 * s : C + 4 - 63.5 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="Sixfold 365 badge">
  <defs>
    <path id="top-${id}" d="M ${C - top} ${C} A ${top} ${top} 0 0 1 ${C + top} ${C}"/>
    <path id="bot-${id}" d="M ${C - bot} ${C} A ${bot} ${bot} 0 0 0 ${C + bot} ${C}"/>
    <clipPath id="disc-${id}"><circle cx="${C}" cy="${C}" r="${IN}"/></clipPath>
  </defs>
  <circle cx="${C}" cy="${C}" r="${R}" fill="${o.ring}"/>
  ${o.ringLine ? `<circle cx="${C}" cy="${C}" r="${R - 12}" fill="none" stroke="${o.ringLine}" stroke-width="4"/>` : ''}
  <circle cx="${C}" cy="${C}" r="${IN + RIM}" fill="${o.rim}"/>
  <circle cx="${C}" cy="${C}" r="${IN}" fill="${o.disc}"/>
  <g clip-path="url(#disc-${id})"><g transform="translate(${x} ${y}) scale(${s})">${ridge(o.ember, o.moss)}
  </g></g>
  ${p.inside ? `<text x="${C}" y="${C - 118}" text-anchor="middle" font-family="Outfit, 'DM Sans', sans-serif" font-weight="800" font-size="74" letter-spacing="16" fill="${o.inDisc}">SIXFOLD</text>` : ''}
  <circle cx="${C - 388}" cy="${C}" r="20" fill="${o.dot}"/>
  <circle cx="${C + 388}" cy="${C}" r="20" fill="${o.dot}"/>
  <text font-family="Outfit, 'DM Sans', sans-serif" font-weight="800" font-size="150" letter-spacing="38" fill="${o.text}"><textPath href="#top-${id}" startOffset="50%" text-anchor="middle">${p.topText || '365'}</textPath></text>
  <text font-family="Outfit, 'DM Sans', sans-serif" font-weight="700" font-size="${p.size}" letter-spacing="${p.ls}" fill="${o.text2 || o.text}"><textPath href="#bot-${id}" startOffset="50%" text-anchor="middle">${p.bottom.replace('&', '&amp;')}</textPath></text>
</svg>`;
}
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&display=block" rel="stylesheet">';
for (const n of Object.keys(PLACES)) for (const k of Object.keys(COLOURS)) {
  const svg = badge(COLOURS[k], PLACES[n], `n${n}${k}`), f = join(HERE, `name-${n}-${k}`);
  writeFileSync(f + '.svg', svg);
  writeFileSync(f + '.html', `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=1000,1000', '--virtual-time-budget=6000', `--screenshot=${f}.png`, 'file:///' + (f + '.html').replace(/\\/g, '/')], { stdio: 'ignore' });
}
const rows = Object.entries(PLACES).map(([n, p]) => `<section><h2>${p.title}</h2><p>${p.note}</p><div class="row">${Object.entries(COLOURS).map(([k, o]) => `<figure><img src="name-${n}-${k}.png" alt=""><figcaption>${o.name}</figcaption></figure>`).join('')}</div></section>`).join('\n');
writeFileSync(join(HERE, 'sixfold-name-options.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sixfold name in the badge</title>${FONT}
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=block" rel="stylesheet">
<style>@page{size:8.5in 11in;margin:0.4in}*{box-sizing:border-box}body{margin:0;color:#1d2a1c;font:10.5pt/1.45 'DM Sans',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font:800 20pt Outfit,sans-serif;margin:0 0 4px}.sub{color:#5a6858;margin:0 0 12px}section{margin:0 0 10px;break-inside:avoid}h2{font:800 13pt Outfit,sans-serif;margin:0}section p{margin:2px 0 6px;color:#5a6858}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;background:#ece7dd;border-radius:10px;padding:8px;text-align:center}figure img{width:100%;max-width:1.7in;display:block;margin:0 auto}figcaption{font-size:9pt;color:#5a6858;margin-top:4px}</style></head><body>
<h1>Where the Sixfold name goes in the badge</h1><p class="sub">Wording: SIXFOLD 365 / LAND · AERATION &amp; SEEDING. Three layouts, each in the three colour options; the Ridge mark (with its roots) stays in the middle.</p>
${rows}</body></html>`);
console.log('wrote 9 badges and sixfold-name-options.html');

/* Sixfold 365 — build the merged site (2026-10-20, Matthew: merge Sixfold Colorado and 365 Aeration into one site at
 * 365aeration.com, named Sixfold 365, with a basic homepage that gets people to the form, and everything else on extra pages).
 *
 *   node sixfold/site-sixfold365/build.mjs live      ->  out/live/     (laid out as 365aeration.com's public_html)
 *   node sixfold/site-sixfold365/build.mjs preview   ->  out/preview/  (the same pages under PREVIEW_BASE, noindex, form off)
 *
 * Takes Sixfold's service, funding and guide pages (../site) as they are, swaps in the Sixfold 365 header, footer and meta
 * (src/chrome-*.html), points phone, email, domain and "contact" links at 365's (the 365 number is the site's point of
 * contact since 2026-10-14), and adds the new homepage and aeration page from src/. Nothing on 365aeration.com that this
 * build does not write is touched: /sign/, /q/, the QR pages (/card/ /car/ /truck/ /yard/), /api/ and the 365 assets stay.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIX = join(HERE, '..', 'site'), A365 = join(HERE, '..', 'aeration365-site'), SRC = join(HERE, 'src');
const MODE = process.argv[2] === 'preview' ? 'preview' : 'live';
export const PREVIEW_BASE = '/s365-preview-7c2e1a';
const OUT = join(HERE, 'out', MODE), BASE = MODE === 'preview' ? PREVIEW_BASE : '';
rmSync(OUT, { recursive: true, force: true });
const ROOT = BASE ? join(OUT, BASE.slice(1)) : OUT;

const PAGES_FROM_SIX = ['services/index.html', 'services/landscaping/index.html', 'services/land-clearing/index.html', 'services/fire-mitigation/index.html', 'who-pays/index.html', 'wildfire-guide/index.html'];
const PAGES_FROM_SRC = ['index.html', 'services/aeration/index.html'];
const chrome = { MARKS: readFileSync(join(SRC, 'chrome-marks.html'), 'utf8').trim(), HEAD: readFileSync(join(SRC, 'chrome-head.html'), 'utf8').trim(), FOOT: readFileSync(join(SRC, 'chrome-foot.html'), 'utf8').trim(),
  META: [
    '  <link rel="icon" href="/assets/365-sixfold-badge.svg" type="image/svg+xml">',
    '  <meta name="theme-color" content="#2F5D2C">',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:site_name" content="Sixfold 365">',
    '  <meta property="og:locale" content="en_US">',
    '  <meta property="og:image" content="https://365aeration.com/assets/og-image.jpg">',
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="630">',
    '  <meta property="og:image:alt" content="Cleared ground on a Front Range property, slash lined up ready for chipping">'].join('\n') };

let changes = 0;
const sub = (s, a, b, label, need) => { const n = s.split(a).length - 1; if (need && n === 0) throw new Error(label + ': not found'); changes += n; return s.split(a).join(b); };
function transform(html, file) {
  for (const k of ['META', 'MARKS', 'HEAD', 'FOOT']) {
    const re = new RegExp(`(<!-- CHROME:${k} -->)[\\s\\S]*?(<!-- /CHROME:${k} -->)`);
    if (!re.test(html)) throw new Error(file + ': no CHROME:' + k);
    html = html.replace(re, (m, a, b) => a + '\n' + chrome[k] + '\n' + b);
  }
  html = sub(html, '<link rel="stylesheet" href="/assets/site.css">', '<link rel="stylesheet" href="/assets/site.css">\n  <link rel="stylesheet" href="/assets/merged.css">', file + ' css', true);
  /* 365's contact details and domain */
  html = sub(html, 'tel:+13039151045', 'tel:+17208304553');
  html = sub(html, '(303) 915-1045', '(720) 830-4553');
  html = sub(html, '"+1-303-915-1045"', '"+1-720-830-4553"');
  html = html.replace(/Contact@SixfoldColorado\.com/gi, () => { changes++; return 'contact@365aeration.com'; });
  html = sub(html, 'https://sixfoldcolorado.com', 'https://365aeration.com');
  html = sub(html, 'Sixfold Colorado', 'Sixfold 365');
  html = html.replace(/ — Sixfold<\/title>/, () => { changes++; return ' · Sixfold 365</title>'; });
  /* the contact page is the homepage form now */
  html = html.replace(/href="\/contact\/\?need=([a-z]+)"/g, (m, n) => { changes++; return `href="/?need=${n}#quote"`; });
  html = sub(html, 'href="/contact/"', 'href="/#quote"');
  /* lawns are quoted by phone, not walked (365's way) */
  html = sub(html, 'Book a lawn walk', 'Get a lawn quote');
  if (/sixfoldcolorado\.com|915-1045|\/contact\//i.test(html.replace(/<!--[\s\S]*?-->/g, ''))) throw new Error(file + ': an old Sixfold address, number or contact link is left');
  if (BASE) {
    html = html.replace(/\b(href|src|srcset)="\/(?!\/|api\/)/g, (m, a) => `${a}="${BASE}/`);
    html = html.replace('<head>', '<head>\n  <meta name="robots" content="noindex">\n  <script>window.SIXFOLD365_PREVIEW = true;</script>');
    html = html.replace(/(<body[^>]*>)/, '$1\n<div class="preview-ribbon"><b>Preview</b> · Sixfold 365 merged site · not live · the form sends nothing</div>');
  }
  return html;
}

for (const p of PAGES_FROM_SIX) { const out = join(ROOT, p); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, transform(readFileSync(join(SIX, p), 'utf8'), p)); }
for (const p of PAGES_FROM_SRC) { const out = join(ROOT, p); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, transform(readFileSync(join(SRC, p), 'utf8'), p)); }

/* assets: Sixfold's stylesheet and photos, the merged layer and fonts, the badge, the share image */
const A = join(ROOT, 'assets'); mkdirSync(join(A, 'img'), { recursive: true }); mkdirSync(join(A, 'fonts'), { recursive: true });
cpSync(join(SIX, 'assets', 'site.css'), join(A, 'site.css'));
cpSync(join(SIX, 'assets', 'og-image.jpg'), join(A, 'og-image.jpg'));
for (const f of readdirSync(join(SIX, 'assets', 'img'))) if (/\.(jpg|webp)$/.test(f)) cpSync(join(SIX, 'assets', 'img', f), join(A, 'img', f));
let css = readFileSync(join(SRC, 'assets', 'merged.css'), 'utf8'); if (BASE) css = css.split('url("/assets/').join(`url("${BASE}/assets/`);
writeFileSync(join(A, 'merged.css'), css);
for (const f of readdirSync(join(SRC, 'assets', 'fonts'))) cpSync(join(SRC, 'assets', 'fonts', f), join(A, 'fonts', f));
cpSync(join(A365, 'assets', '365-sixfold-badge.svg'), join(A, '365-sixfold-badge.svg'));
if (MODE === 'live') writeFileSync(join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  ['', 'services/', 'services/aeration/', 'services/landscaping/', 'services/land-clearing/', 'services/fire-mitigation/', 'who-pays/', 'wildfire-guide/']
    .map((u) => `  <url><loc>https://365aeration.com/${u}</loc></url>`).join('\n') + '\n</urlset>\n');
console.log(`${MODE}: ${PAGES_FROM_SIX.length + PAGES_FROM_SRC.length} pages, ${changes} replacements -> ${ROOT}`);

// The legal pages for traverseplatforms.com (2026-10-13), made from the drafts in traverse/business/:
//   node traverse/marketing-site/build-legal.cjs        (needs the npm package "marked": npm install in this folder)
// Writes site-src/{terms,terms-of-use,privacy,cancellation}/index.html, which build-site.cjs copies into public_html.
// Each page shows only the public text: the cover notes, counsel notes, business-choice notes, the questions for counsel and
// the fact-check logs stay in the .md files. Bracketed defaults are filled in; anything still undecided keeps its brackets,
// and every page carries a "draft, not yet in effect" banner until the review is done (set DRAFT = false then).
'use strict';
const fs = require('fs'); const path = require('path');
const { marked } = require(require.resolve('marked', { paths: [__dirname, process.env.MARKED_DIR || __dirname] }));
const DRAFT = true;
const BIZ = path.join(__dirname, '..', 'business'), OUT = path.join(__dirname, 'site-src');
const DATE = '13 October 2026';

const PAGES = [
  { dir: 'terms', md: 'client-agreement-DRAFT.md', start: '## Traverse Subscription Agreement', end: '## Questions for counsel', title: 'Subscription agreement' },
  { dir: 'terms-of-use', md: 'terms-of-use-DRAFT.md', start: '## Terms of Use', end: '## Questions for counsel', title: 'Terms of use' },
  { dir: 'privacy', md: 'privacy-policy-DRAFT.md', start: '## Privacy Policy', end: '## Fact-check log', title: 'Privacy policy' },
  { dir: 'cancellation', md: 'cancellation-policy-DRAFT.md', start: '## Cancellation and Refund Policy', end: '## Fact-check log', title: 'Cancellation and refunds' }
];

function publicText(src, p) {
  const i = src.indexOf(p.start), j = src.indexOf(p.end, i);
  if (i < 0 || j < 0) throw new Error(p.md + ': markers not found');
  let t = src.slice(i, j).replace(/\n---\s*$/, '').trim();
  t = t.replace(/^> \*\*(Counsel note|Business choice)[\s\S]*?(?=\n(?!>)|$)/gm, '');               /* the notes for counsel */
  const fill = [
    ['[ENTITY]', 'Traverse Platforms LLC'], ['[DATE]', DATE], ['Version [1]', 'Version 1'],
    [/\[In addition, for each property record extracted[^\]]*\]/g, ''],                                  /* optional clause, left out */
    ['[For yearly plans, notice must be given at least [30] days before renewal.]', 'For yearly plans, notice must be given at least 30 days before renewal.'],
    ['[If required, the parties will sign Traverse\'s Data Processing Addendum (Exhibit C), which then forms part of this Agreement.]', 'If required, the parties will sign Traverse\'s Data Processing Addendum (Exhibit C), which then forms part of this Agreement.'],
    ['[only with the Client\'s written permission]', 'only with the Client\'s written permission'], ['[notify the Client and]', 'notify the Client and'],
    ['**[legal@traverseplatforms.com]**', '**hello@traverseplatforms.com**'], ['[version 1, dated ___]', 'version 1'],
    ['[El Paso / Denver] County', '[county to be decided] County'],
    ['[Privacy notice: link, once written.]', 'Our [privacy policy](../privacy/) explains the rest.'],
    [' [Limitation of liability: counsel.]', ''], [' [Venue: counsel.]', ''],
    [/\[(\d+(?: hours| months)?)\]/g, '$1']
  ];
  for (const [a, b] of fill) t = typeof a === 'string' ? t.split(a).join(b) : t.replace(a, b);
  t = t.replace(/\(terms-of-use-DRAFT\.md\)/g, '(../terms-of-use/)').replace(/\(client-contract-outline-DRAFT\.md\)/g, '(../terms/)');
  return t.replace(/\n{3,}/g, '\n\n');
}

const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#13294b"/><g transform="translate(8.5 8.5) scale(0.734)"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="53" cy="17" r="8" fill="#d6400c"/></g></svg>');
const page = (p, html) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${p.title} · Traverse Platforms</title><link rel="icon" href="${icon}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@600;700&display=swap">
<style>
body{margin:0;background:#f4f6f9;color:#0f1b2d;font:17px/1.65 "Atkinson Hyperlegible",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
header{background:#fff;border-bottom:1px solid #dce2ea}
header div{max-width:860px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header a{color:#0f1b2d;text-decoration:none;font:700 19px/1 "Familjen Grotesk",sans-serif;display:flex;align-items:center;gap:10px}
header nav a{font:15px/1 "Atkinson Hyperlegible",sans-serif;color:#566476}
main{max-width:860px;margin:0 auto;padding:28px 16px 64px}
.draft{background:#fde6dc;border:1px solid #f3c2ad;border-radius:12px;padding:12px 16px;font-size:15px;margin:0 0 24px}
h2{font:700 36px/1.1 "Familjen Grotesk",sans-serif;letter-spacing:-.02em;margin:0 0 6px}
h3{font:700 22px/1.25 "Familjen Grotesk",sans-serif;margin:30px 0 8px}
p,li{max-width:72ch} a{color:#b83608}
table{border-collapse:collapse;width:100%;background:#fff;font-size:15px} td,th{border:1px solid #dce2ea;padding:8px 10px;text-align:left;vertical-align:top}
.tw{overflow-x:auto} hr{border:0;border-top:1px solid #dce2ea;margin:28px 0}
footer{border-top:1px solid #dce2ea;max-width:860px;margin:0 auto;padding:20px 16px 40px;font-size:14px;color:#566476;display:flex;flex-wrap:wrap;gap:8px 18px}
footer a{color:#566476}
</style></head><body>
<header><div><a href="../"><svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#13294b"/><g transform="translate(8.5 8.5) scale(0.734)"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="53" cy="17" r="8" fill="#d6400c"/></g></svg>Traverse Platforms</a><nav><a href="../#contact">Contact</a></nav></div></header>
<main>
${DRAFT ? '<p class="draft"><b>Draft for review.</b> This page is being reviewed and is not yet in effect.</p>' : ''}
${html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>')}
</main>
<footer>${PAGES.map((x) => x.dir === p.dir ? `<span>${x.title}</span>` : `<a href="../${x.dir}/">${x.title}</a>`).join('')}<a href="mailto:hello@traverseplatforms.com">hello@traverseplatforms.com</a><span>(803) 260-7359</span></footer>
</body></html>
`;

for (const p of PAGES) {
  const t = publicText(fs.readFileSync(path.join(BIZ, p.md), 'utf8'), p);
  const left = t.match(/Counsel note|Business choice|DRAFT\.md|\[ENTITY\]/); if (left) throw new Error(p.dir + ': left in the public text: ' + left[0]);
  fs.mkdirSync(path.join(OUT, p.dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, p.dir, 'index.html'), page(p, marked.parse(t)));
  const brackets = (t.match(/\[[^\]]{1,60}\](?!\()/g) || []).filter((b) => !/^\[ ?\]$/.test(b));
  console.log(p.dir.padEnd(14), (t.length / 1024).toFixed(1) + ' KB', brackets.length ? 'still undecided: ' + [...new Set(brackets)].slice(0, 8).join(' ') : '');
}

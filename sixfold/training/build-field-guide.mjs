/* The Sixfold Field Guide (2026-10-13, Matthew: "a better field guide ... with the branding and pdf"). Built from the SAME lesson
 * files as the app's Training section (0N-*.md), so the printed guide and the app can never say different things.
 *
 *   node sixfold/training/build-field-guide.mjs     writes sixfold/training/field-guide.html
 *   node sixfold/tools/html-to-pdf.mjs Field-Guide  prints it to sixfold/training/Sixfold-Field-Guide.pdf
 *   then copy the PDF to traverse/app/data/rounds/docs/field-guide.pdf (the app serves it to signed-in crew; Sixfold only)
 *
 * Markers drawn as cards, as in the app: "Say:" a line to say, "They say:" the customer, "Do:" / "Don't:" / "Never:" lists,
 * "Law:" the legal rule, "Tip:". Say and Never differ by label and symbol as well as colour (ember and moss fail colourblind
 * separation). "Source:" lines stay out. Internal: for the crew, never handed to a customer.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = [['01-doors.md', 'Doors', 'From the driveway to a booked walk'], ['02-sales.md', 'Sales', 'The conversation, objections and the second service'],
  ['03-quotes.md', 'Quotes', 'Walking a property; the office prices'], ['04-phones.md', 'Phones', 'The Sixfold line and calling leads back'],
  ['05-paperwork.md', 'Paperwork', 'Signing, the three-day window, getting paid'], ['06-safety.md', 'Safety', 'Every job, every time'],
  ['07-using-the-app.md', 'Using the app', 'Routes, the door card and your sign-in']];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MARK = /^(Say|They say|Do|Don't|Never|Law|Tip): (.*)$/;
const LIST_KIND = { Do: ['do', '✓', 'Do'], "Don't": ['no', '✕', "Don't"], Never: ['no', '✕', 'Never'] };

function lessonsOf(file) {
  const out = []; let cur = null;
  for (const l of readFileSync(join(HERE, file), 'utf8').replace(/\r/g, '').split('\n')) {
    if (/^## /.test(l)) { cur = { title: l.slice(3).trim(), lines: [] }; out.push(cur); continue; }
    if (!cur || /^Source:/.test(l)) continue;
    cur.lines.push(l);
  }
  return out;
}
function body(lines) {
  const h = []; let ul = null, list = null, para = [];
  const flushPara = () => { if (para.length) { h.push('<p>' + esc(para.join(' ')) + '</p>'); para = []; } };
  const closeUl = () => { if (ul) { h.push('<ul>' + ul.join('') + '</ul>'); ul = null; } };
  const closeList = () => { if (list) { const [cls, sym, label] = list.kind; h.push(`<div class="card ${cls}"><p class="lab"><span class="sym">${sym}</span> ${label}</p><ul>${list.items.map((t) => '<li>' + esc(t) + '</li>').join('')}</ul></div>`); list = null; } };
  const closeAll = () => { flushPara(); closeUl(); closeList(); };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { closeAll(); continue; }
    if (/^### /.test(t)) { closeAll(); h.push('<h3>' + esc(t.slice(4)) + '</h3>'); continue; }
    const m = t.match(MARK);
    if (m) {
      flushPara(); closeUl();
      const [, k, v] = m;
      if (LIST_KIND[k]) { if (!list || list.k !== k) { closeList(); list = { k, kind: LIST_KIND[k], items: [] }; } list.items.push(v); continue; }
      closeList();
      if (k === 'Say') h.push(`<div class="card say"><p class="lab"><span class="sym">“</span> Say</p><p class="q">${esc(v)}</p></div>`);
      else if (k === 'They say') h.push(`<div class="card they"><p class="lab">They say</p><p class="q">${esc(v)}</p></div>`);
      else if (k === 'Law') h.push(`<div class="card law"><p class="lab"><span class="sym">§</span> The law</p><p>${esc(v)}</p></div>`);
      else if (k === 'Tip') h.push(`<div class="card tip"><p class="lab">Tip</p><p>${esc(v)}</p></div>`);
      continue;
    }
    closeList();
    if (/^- /.test(t)) { flushPara(); (ul = ul || []).push('<li>' + esc(t.slice(2)) + '</li>'); continue; }
    closeUl(); para.push(t);
  }
  closeAll();
  return h.join('\n');
}

const RIDGE = `<svg class="mark" viewBox="4 14 94 99" role="img" aria-label="Sixfold"><g fill="currentColor"><path d="M18 84 L36 48 L54 84 Z" fill-opacity="0.42"/><path d="M30 84 L50 38 L70 84 Z" fill-opacity="0.55"/><path d="M44 84 L66 26 L88 84 Z" fill-opacity="0.7"/><path d="M60 84 L79 14 L98 84 Z" fill-opacity="0.85"/><rect x="20.4" y="77" width="3.2" height="7"/><path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/><path d="M22 62 L12 74 L32 74 Z"/><path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/><rect x="4" y="86" width="92" height="5"/></g><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M94 91 L92.2 94.4 L94.6 98 L91.4 102 L93.4 106 L90 109.4 L89.8 113" stroke-width="1.6"/><path d="M90.5 91 L88.4 93.6 L85.4 95.2 L87.8 98.6 L82.4 101.4 L84.2 104.6 L79.6 108" stroke-width="1.35"/><path d="M86.5 91 L83.8 92.6 L85.8 95 L80.4 96.2 L77.6 99 L74 99.2 L71.5 101" stroke-width="1.1"/><path d="M96 91 L97.6 93.8 L95 96.2 L97.4 99.6 L94.8 102.4 L96 106" stroke-width="1.15"/><path d="M92.6 91 L90.6 94.6 L92.4 97.6 L89.4 100.6 L90.6 104.4 L88 107.4" stroke-width="1.05"/></g></svg>`;

const sections = FILES.map(([f, name, sub], i) => ({ n: i + 1, name, sub, lessons: lessonsOf(f) }));
const total = sections.reduce((a, s) => a + s.lessons.length, 0);
const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Denver' });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sixfold Field Guide</title>
<!-- Generated by sixfold/training/build-field-guide.mjs from the 0N-*.md lesson files. Do not edit by hand: edit the lessons. -->
<style>
:root{--paper:#FFFFFF;--tint:#F3EFE6;--tint-edge:#DED5C4;--ink:#14201B;--ink-mid:#46534B;--ink-soft:#6E7A72;--ember:#E4703A;--ember-text:#B84C15;
  --moss:#5E7A4C;--moss-text:#45583A;--pine:#1F2A25;--bone:#EDE7DC;--law:#FBF3DD;--law-edge:#D9B85C;
  --f-display:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;--f-body:ui-sans-serif,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-data:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"Liberation Mono",monospace}
*{box-sizing:border-box}
html,body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--f-body);font-size:10.5pt;line-height:1.42}
@media screen{body{background:#4A5550;padding:24px 0}.doc{width:7.7in;margin:0 auto;background:var(--paper);padding:.35in;box-shadow:0 8px 34px rgba(0,0,0,.34)}}
.cover{height:10.1in;background:var(--pine);color:var(--bone);border-radius:14px;padding:.7in .65in;display:flex;flex-direction:column;break-after:page}
.cover .mark{width:1.35in;height:1.35in;color:var(--ember)}
.cover .word{font-family:var(--f-display);font-size:30pt;margin:.18in 0 0;letter-spacing:.01em}
.cover .desc{font-family:var(--f-data);font-size:8pt;letter-spacing:.24em;text-transform:uppercase;opacity:.8;margin:2pt 0 0}
.cover h1{font-family:var(--f-display);font-weight:400;font-size:46pt;line-height:1.02;margin:auto 0 .14in;color:#fff}
.cover .lead{font-size:13pt;max-width:5in;margin:0 0 .3in;opacity:.92}
.cover .meta{font-family:var(--f-data);font-size:8pt;letter-spacing:.14em;text-transform:uppercase;border-top:1px solid rgba(237,231,220,.3);padding-top:10pt;display:flex;justify-content:space-between;gap:12pt}
.cover .meta b{color:var(--ember);font-weight:400}
.contents{break-after:page}
.kicker{font-family:var(--f-data);font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;color:var(--ember-text);margin:0 0 4pt}
h2.big{font-family:var(--f-display);font-weight:400;font-size:26pt;margin:0 0 .18in;border-bottom:2.5pt solid var(--ember);padding-bottom:6pt}
.toc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7pt 12pt}
.toc .s{border:1px solid var(--tint-edge);border-radius:10px;padding:7pt 10pt;break-inside:avoid}
.toc .s b{font-family:var(--f-display);font-size:14pt;font-weight:400;display:block}
.toc .s small{color:var(--ink-mid);display:block;margin:2pt 0 6pt}
.toc .s ol{margin:0;padding-left:15pt;font-size:8.6pt;line-height:1.3;color:var(--ink-mid)}
.how{margin-top:.12in;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8pt}
.section{break-before:page}
.shead{background:var(--pine);color:var(--bone);border-radius:12px;padding:16pt 18pt;margin:0 0 .16in;display:flex;align-items:center;gap:14pt}
.shead .n{font-family:var(--f-display);font-size:34pt;color:var(--ember);line-height:1}
.shead b{font-family:var(--f-display);font-size:22pt;font-weight:400;display:block;color:#fff}
.shead small{font-size:10pt;opacity:.85}
.lesson{margin:0 0 .22in}
.lesson h2{font-family:var(--f-display);font-weight:400;font-size:17pt;margin:.06in 0 4pt;color:var(--ink);break-after:avoid}
.lesson h3{font-size:10.5pt;margin:10pt 0 3pt;color:var(--moss-text);text-transform:uppercase;letter-spacing:.05em;break-after:avoid}
.lesson p{margin:0 0 6pt}
.lesson ul{margin:0 0 6pt;padding-left:16pt}.lesson li{margin:0 0 2pt}
.card{border-radius:9px;padding:7pt 10pt 6pt;margin:6pt 0;break-inside:avoid;border:1px solid var(--tint-edge);border-left-width:5pt}
.card .lab{font-family:var(--f-data);font-size:7.5pt;letter-spacing:.18em;text-transform:uppercase;margin:0 0 2pt;font-weight:700}
.card .sym{font-family:var(--f-body);font-size:10pt;letter-spacing:0}
.card ul{margin:0;padding-left:14pt}
.say{background:var(--tint);border-left-color:var(--moss)}.say .lab{color:var(--moss-text)}.say .q{font-family:var(--f-display);font-size:12pt;margin:0}
.they{background:#fff;border-left-color:var(--ink-soft);border-style:dashed solid dashed solid}.they .lab{color:var(--ink-soft)}.they .q{font-style:italic;margin:0}
.do{background:#F1F5EC;border-left-color:var(--moss)}.do .lab{color:var(--moss-text)}
.no{background:#FBEDE5;border-left-color:var(--ember-text)}.no .lab{color:var(--ember-text)}
.law{background:var(--law);border-left-color:var(--law-edge)}.law .lab{color:#7A5A12}.law p:last-child{margin:0}
.tip{background:#EEF3F6;border-left-color:#5A7A90}.tip .lab{color:#3D5A6E}.tip p:last-child{margin:0}
.foot{margin-top:.3in;border-top:1px solid var(--tint-edge);padding-top:6pt;font-family:var(--f-data);font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);display:flex;justify-content:space-between}
</style></head>
<body><div class="doc">
<section class="cover">
  ${RIDGE}
  <p class="word">Sixfold</p>
  <p class="desc">Lawn, Land &amp; Fire · Monument, CO</p>
  <h1>Field<br>Guide</h1>
  <p class="lead">How we knock, what we say, and what we never say. For the Sixfold crew.</p>
  <div class="meta"><span><b>Internal</b> · never hand to a customer</span><span>${total} lessons · ${esc(today)}</span></div>
</section>
<section class="contents">
  <p class="kicker">Inside</p>
  <h2 class="big">What's in this guide</h2>
  <div class="toc">${sections.map((s) => `<div class="s"><b>${s.n}. ${esc(s.name)}</b><small>${esc(s.sub)}</small><ol>${s.lessons.map((l) => '<li>' + esc(l.title) + '</li>').join('')}</ol></div>`).join('')}</div>
  <p class="kicker" style="margin-top:.16in">How to read the cards</p>
  <div class="how">
    <div class="card say"><p class="lab"><span class="sym">“</span> Say</p><p class="q">Words that work. Say them your way.</p></div>
    <div class="card no"><p class="lab"><span class="sym">✕</span> Never</p><ul><li>Gets Sixfold in trouble, even as a joke.</li></ul></div>
    <div class="card law"><p class="lab"><span class="sym">§</span> The law</p><p>Not optional. Not legal advice either.</p></div>
  </div>
  <p style="margin-top:.1in;color:var(--ink-mid);font-size:9.5pt">The same lessons are in the app, under Training, and they always match this guide. The first lesson is the whole door visit on one page: start there.</p>
</section>
${sections.map((s) => `<section class="section">
  <div class="shead"><span class="n">${s.n}</span><span><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span></div>
  ${s.lessons.map((l) => `<article class="lesson"><h2>${esc(l.title)}</h2>\n${body(l.lines)}</article>`).join('\n')}
</section>`).join('\n')}
<div class="foot"><span>Sixfold, LLC · 17890 Sierra Way, Monument, CO 80132 · (303) 915-1045</span><span>Internal · not legal advice</span></div>
</div></body></html>
`;
writeFileSync(join(HERE, 'field-guide.html'), html, 'utf8');
console.log(`field-guide.html: ${sections.length} sections, ${total} lessons, ${(html.length / 1024).toFixed(0)} KB`);

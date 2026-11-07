/* Call sheet, 6 Nov 2026: the top 50 (25 roofing, 25 lawn) from top-50.csv, with a short script on page 1.
   node build-call-sheet.mjs   -> call-sheet.html + call-sheet.pdf (headless Chrome) */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const parse = (l) => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') { q = !q; continue; } if (ch === ',' && !q) { o.push(c); c = ''; continue; } c += ch; } o.push(c); return o; };
const lines = readFileSync(join(HERE, 'top-50.csv'), 'utf8').trim().split(/\r?\n/);
const head = parse(lines[0]);
const rows = lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const site = (u) => esc(String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''));
const title = (s) => esc(String(s).replace(/\b(LLC|L\.L\.C\.|INC|CO)\b\.?/gi, (m) => m.toUpperCase()));

const table = (trade) => rows.filter((r) => r.trade === trade).map((r, i) => `<tr>
  <td class="n">${i + 1}</td><td><b>${title(r.company)}</b><br><small>${site(r.website)}${r.other_contact ? ' &middot; on Nextdoor' : ''}</small></td>
  <td>${esc(r.city)}</td><td class="ph">${esc(r.phone)}</td><td class="c">${esc(r.formed)}</td>
  <td class="box"></td><td class="notes"></td></tr>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Traverse call sheet, 6 Nov 2026</title><style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; } body { font: 10.5pt/1.35 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 17pt; margin: 0 0 2px; } h2 { font-size: 12.5pt; margin: 14px 0 6px; border-bottom: 2px solid #111; padding-bottom: 3px; }
  .sub { color: #555; margin: 0 0 10px; }
  .script { border: 1.5px solid #111; padding: 10px 12px; border-radius: 6px; }
  .script p { margin: 0 0 7px; } .script b { font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; color: #333; }
  .say { font-size: 11pt; } ul { margin: 2px 0 0 18px; padding: 0; } li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #bbb; padding: 5px 4px; vertical-align: top; text-align: left; }
  th { font-size: 8.5pt; text-transform: uppercase; color: #444; border-bottom: 2px solid #111; }
  td.n, td.c { text-align: center; width: 26px; } td.ph { white-space: nowrap; font-weight: bold; } small { color: #555; }
  td.box { width: 22px; } td.box::before { content: ''; display: inline-block; width: 13px; height: 13px; border: 1.5px solid #111; }
  td.notes { width: 34%; } .break { page-break-before: always; }
</style></head><body>
<h1>Traverse call sheet</h1>
<p class="sub">6 Nov 2026 &middot; the top 25 roofing and top 25 lawn companies from the 30 Oct-5 Nov emails (got the email, no bounce, formed 2016 or later, phone on file). Calls: weekdays, mid-morning or after 3 pm.</p>
<div class="script">
  <p><b>Open</b><br><span class="say">"Hi, is this the owner? This is Matthew Sharpe with Traverse, here in Colorado. I emailed you last week. Got a quick minute?"</span></p>
  <p><b>Ask, then listen</b><br><span class="say">"How are you planning to find new customers for next season?"</span></p>
  <p><b>The offer</b><br><span class="say">"I built an app for small crews that maps every house in your area, the lawn size or the roof and hail history, so you know which streets to work first and can quote from your phone. I'd like to send you a free one-page map of the best streets in [their city]. No strings. What's the best email for it?"</span></p>
  <p><b>Close</b><br><span class="say">"If it looks useful, I'll show you your area in the app. Fifteen minutes, whenever suits you."</span> Book it on the spot at traverseplatforms.com/demo.</p>
  <p><b>Voicemail</b><br><span class="say">"Hi, Matthew Sharpe with Traverse. I put together a free map of the best streets in [city] for [lawn care / roofing]. Happy to send it over. Call or text me at (303) 596-9515."</span></p>
  <p><b>If they say</b></p>
  <ul>
    <li><i>"It's the off-season."</i> "That's why I'm calling now. Set up over the winter, ready the day spring starts."</li>
    <li><i>"We don't knock doors."</i> "The map still works for flyers, signs and where to quote first. Want it anyway?"</li>
    <li><i>"What does it cost?"</i> "For a small crew it's $59 a month on the yearly founding price, $74 month to month, with a 7-day money-back guarantee from the day your app is live."</li>
    <li><i>"We already use something."</i> "Fair enough. Mind if I ask what? I'll still send the map."</li>
  </ul>
  <p style="margin:6px 0 0"><b>After each call</b> write the result: map sent / demo booked / call back (when) / not interested. Map requests come to me and I send the PDF.</p>
</div>
<h2 class="break">Roofing (25)</h2>
<table><tr><th>#</th><th>Company</th><th>City</th><th>Phone</th><th>Since</th><th>&#10003;</th><th>Result / notes</th></tr>${table('roofing')}</table>
<h2 class="break">Lawn &amp; landscape (25)</h2>
<table><tr><th>#</th><th>Company</th><th>City</th><th>Phone</th><th>Since</th><th>&#10003;</th><th>Result / notes</th></tr>${table('lawn')}</table>
</body></html>`;

writeFileSync(join(HERE, 'call-sheet.html'), html);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${join(HERE, 'call-sheet.pdf')}`, pathToFileURL(join(HERE, 'call-sheet.html')).href], { stdio: 'ignore' });
console.log('call-sheet.html + call-sheet.pdf');

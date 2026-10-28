/* Prints horizon-audit.html to Horizon-Outreach-Online-Audit.pdf with headless Chrome, after checking no page's content runs past its
   page (the pages hide overflow, so a long page would lose its bottom silently) and that the PDF has exactly 4 pages. Also saves a PNG of
   each page for review (preview-p1..4.png).
     node print-audit.mjs                                                                                                           */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chrome, attach, session, sleep } from 'file:///C:/Users/Surge%20Inc/Desktop/claude%20test%202/traverse/videos/tools/lib.mjs';
const here = (f) => fileURLToPath(new URL('./' + f, import.meta.url));
const port = 9500 + Math.floor(Math.random() * 300); const ch = chrome(port);
try {
  const P = session((await attach(port, (x) => x.type === 'page')).webSocketDebuggerUrl); await P.ready;
  await P.send('Runtime.enable'); await P.send('Page.enable');
  /* letter page at 96 dpi minus the @page margins: 8.5in - 0.9in wide */
  await P.send('Emulation.setDeviceMetricsOverride', { width: Math.round(7.6 * 96), height: Math.round(10.15 * 96), deviceScaleFactor: 2, mobile: false });
  await P.send('Page.navigate', { url: pathToFileURL(here('horizon-audit.html')).href }); await sleep(1500);
  const over = JSON.parse(await P.js(`JSON.stringify([...document.querySelectorAll('.page')].map((p, i) => { const kids = [...p.children]; const last = kids[kids.length - 1]; const foot = p.querySelector('.foot'); const content = kids.filter(k => k !== foot); const bottom = Math.max(...content.map(k => k.getBoundingClientRect().bottom)) - p.getBoundingClientRect().top; return { page: i + 1, used: Math.round(bottom), room: Math.round(foot.getBoundingClientRect().top - p.getBoundingClientRect().top), pageH: p.clientHeight, scrollH: p.scrollHeight }; }))`));
  console.log(over.map((o) => `p${o.page}: content ends ${o.used}px, footer at ${o.room}px, page ${o.pageH}/${o.scrollH}`).join('\n'));
  const bad = over.filter((o) => o.used > o.room || o.scrollH > o.pageH + 1);
  if (bad.length) { console.log('OVERFLOW on page(s) ' + bad.map((b) => b.page).join(', ') + ': not printed'); process.exit(2); }
  const pages = await P.js(`document.querySelectorAll('.page').length`);
  for (let i = 0; i < pages; i++) {
    const r = JSON.parse(await P.js(`JSON.stringify(document.querySelectorAll('.page')[${i}].getBoundingClientRect())`));
    const s = await P.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: r.top + (await P.js('scrollY')), width: r.width, height: r.height, scale: 1 }, captureBeyondViewport: true });
    writeFileSync(here(`preview-p${i + 1}.png`), Buffer.from(s.data, 'base64'));
  }
  const pdf = await P.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const buf = Buffer.from(pdf.data, 'base64'); writeFileSync(here('Horizon-Outreach-Online-Audit.pdf'), buf);
  const n = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log('PDF pages:', n, n === pages ? '(matches)' : '(MISMATCH: expected ' + pages + ')');
  if (n !== pages) process.exit(3);
} finally { ch.kill(); }

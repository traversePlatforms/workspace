/* Print the two briefs to PDF, honouring the CSS @page exactly.

   NOT shared/tools/Print-Pdf.mjs: that one injects its own header/footer and
   passes explicit margins, which both override the @page rule and steal
   vertical space these sheets have already budgeted. These documents carry
   their own .foot-note with the page number in it, so a second injected footer
   is duplicate furniture AND it silently pushed every sheet onto two pages.

   preferCSSPageSize + no margin arguments + displayHeaderFooter:false means
   the PDF is exactly what @page says.

   Run:  node print.mjs            (after node build.mjs) */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = ['rebuild-brief', 'seo-explained'];
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const prof = mkdtempSync(join(tmpdir(), 'brief-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9356', `--user-data-dir=${prof}`,
  '--no-first-run', '--disable-gpu', '--force-color-profile=srgb'], { stdio: 'ignore' });

const wait = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
for (let i = 0; i < 80; i++) {
  try {
    const t = await (await fetch('http://127.0.0.1:9356/json/list')).json();
    const pg = t.find(x => x.type === 'page');
    if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; }
  } catch {}
  await wait(250);
}
await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const cmd = (m, p = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })); });

await cmd('Page.enable');
for (const name of DOCS) {
  const url = 'file:///' + join(here, `${name}.html`).replace(/\\/g, '/').replace(/ /g, '%20');
  await cmd('Page.navigate', { url });
  await wait(3000);                       // webfonts + the six JPEGs
  const { data } = await cmd('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });
  const buf = Buffer.from(data, 'base64');
  const out = join(here, `${name}.pdf`);
  writeFileSync(out, buf);
  const sheets = (readFileSync(join(here, `${name}.html`), 'utf8').match(/class="sheet"/g) || []).length;
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`${name}.pdf`.padEnd(24) + `${(buf.length / 1024).toFixed(0)} KB`.padStart(8)
    + `   ${pages} pages / ${sheets} sheets` + (pages === sheets ? '  OK' : '  ** MISMATCH **'));
}

ws.close(); ch.kill(); await wait(300); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);

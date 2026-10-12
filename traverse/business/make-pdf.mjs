// A Markdown document in traverse/business/ to a print-ready PDF beside it (2026-10-12): Markdown -> HTML with a plain document
// style, printed by headless Chrome over CDP (US Letter, a DRAFT line on every page, page numbers).
//   node traverse/business/make-pdf.mjs traverse/business/client-contract-outline-DRAFT.md
// Needs the npm package "marked" (pass its folder in MARKED_DIR, or install it next to this file).
import { spawn } from 'node:child_process'; import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path'; import { createRequire } from 'node:module';
const src = resolve(process.argv[2]); const out = src.replace(/\.md$/, '.pdf');
const require = createRequire(join(process.env.MARKED_DIR || dirname(src), 'x.js'));
const { marked } = require('marked');
const md = readFileSync(src, 'utf8'); const title = (md.match(/^# (.+)$/m) || [, basename(src)])[1];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
  @page { size: Letter; margin: 0.8in 0.85in 0.9in; }
  body { font: 10.5pt/1.5 Georgia, 'Times New Roman', serif; color: #1a1a1a; }
  h1 { font: 700 20pt/1.2 'Segoe UI', Arial, sans-serif; margin: 0 0 6pt; color: #14202e; }
  h2 { font: 700 13pt/1.3 'Segoe UI', Arial, sans-serif; margin: 18pt 0 6pt; color: #14202e; border-bottom: 1px solid #c8d0da; padding-bottom: 3pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; } ul, ol { padding-left: 18pt; } li { margin: 2pt 0; }
  strong { color: #0c1520; } hr { border: 0; border-top: 1px solid #d5dbe2; margin: 14pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; break-inside: auto; }
  th, td { border: 1px solid #c8d0da; padding: 4pt 6pt; text-align: left; vertical-align: top; } th { background: #eef2f6; font-family: 'Segoe UI', Arial, sans-serif; }
  tr { break-inside: avoid; } code { font-size: 9pt; }
</style></head><body>${marked.parse(md)}</body></html>`;
const dir = mkdtempSync(join(tmpdir(), 'pdf-')); const htmlFile = join(dir, 'doc.html'); writeFileSync(htmlFile, html);
const port = 9900 + Math.floor(Math.random() * 50);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${join(dir, 'p')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let w = null; for (let i = 0; i < 50 && !w; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((x) => x.type === 'page'); if (p) w = p.webSocketDebuggerUrl; } catch (e) {} if (!w) await sleep(200); }
const ws = new WebSocket(w); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x.result); pend.delete(x.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await send('Page.enable'); await send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') }); await sleep(1500);
const foot = `<div style="font:7.5pt Segoe UI,Arial,sans-serif;color:#6b7785;width:100%;padding:0 0.85in;display:flex;justify-content:space-between"><span>DRAFT for counsel · not legal advice · ${title.replace(/</g, '')}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
const r = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: foot });
writeFileSync(out, Buffer.from(r.data, 'base64'));
console.log('wrote ' + out + ' (' + Math.round(Buffer.from(r.data, 'base64').length / 1024) + ' KB)');
chrome.kill(); process.exit(0);

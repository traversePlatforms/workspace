// Markdown -> a clean PDF (23 Nov 2026, Matthew: "if something is created in a .md file that i need to read or that im requesting to use
// go ahead and just automatically put it in a PDF"). Uses marked from ~/jarvis/tools/md2pdf (outside the repo) and headless Chrome.
//   node shared/tools/md2pdf.mjs <file.md> [out.pdf] [--title "Title"]      (default out: same name, .pdf)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
const { marked } = await import(join(homedir(), 'jarvis/tools/md2pdf/node_modules/marked/lib/marked.esm.js'));
const a = process.argv.slice(2); const ti = a.indexOf('--title'); const title = ti >= 0 ? a.splice(ti, 2)[1] : '';
const src = resolve(a[0]); const out = resolve(a[1] || src.replace(/\.md$/, '') + '.pdf');
let md = readFileSync(src, 'utf8');
const h1 = (md.match(/^# (.+)$/m) || [])[1] || title || basename(src, '.md');
md = md.replace(/^# .+\n/m, '');
const fonts = join(dirname(new URL(import.meta.url).pathname), '../../traverse/app/tools/eod-assets');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${h1}</title><style>
@font-face{font-family:DMS;src:url(file://${fonts}/DMSans-Regular.ttf)}@font-face{font-family:DMS;font-weight:700;src:url(file://${fonts}/DMSans-Bold.ttf)}
@font-face{font-family:OUT;font-weight:800;src:url(file://${fonts}/Outfit-ExtraBold.ttf)}
@page{size:Letter;margin:0.6in}body{font:10.5pt/1.5 DMS,sans-serif;color:#15202b;margin:0}
header{background:#0f3b5f;color:#fff;padding:16px 20px;border-radius:6px;margin-bottom:14px}header h1{font:800 20pt/1.15 OUT,sans-serif;margin:0}
header p{margin:4px 0 0;font-size:9.5pt;opacity:.85}h2{font:800 13.5pt OUT,sans-serif;color:#0f3b5f;margin:18px 0 6px;break-after:avoid}
h3{font-size:11.5pt;margin:12px 0 4px;break-after:avoid}table{border-collapse:collapse;width:100%;font-size:9pt;margin:6px 0}th{background:#e8f0f7;text-align:left}
th,td{border:1px solid #c9d6e2;padding:4px 6px;vertical-align:top}tr{break-inside:avoid}code{background:#f0f3f6;padding:1px 4px;border-radius:3px;font-size:9pt}
pre{background:#f0f3f6;padding:8px;border-radius:4px;white-space:pre-wrap}a{color:#0f3b5f;word-break:break-all}li{margin:2px 0}blockquote{border-left:3px solid #0f3b5f;margin:8px 0;padding:4px 12px;background:#f5f8fb}
</style></head><body><header><h1>${h1}</h1><p>${new Date().toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'long', day: 'numeric', year: 'numeric' })}</p></header>${marked.parse(md)}</body></html>`;
const tmp = mkdtempSync(join(tmpdir(), 'md2pdf-')); const hf = join(tmp, 'doc.html'); writeFileSync(hf, html);
execFileSync('google-chrome', ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + out, 'file://' + hf], { stdio: 'ignore' });
console.log(out);

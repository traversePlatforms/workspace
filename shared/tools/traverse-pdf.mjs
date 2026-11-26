#!/usr/bin/env node
// Print an HTML page as a Traverse-branded PDF (26 Nov 2026, Matthew: "Make most of our pdf branded with traverse").
//   node shared/tools/traverse-pdf.mjs <page.html> [out.pdf]
// The page keeps only its own content (and any extra <style>); this inlines shared/brand/traverse-pdf/traverse-pdf.css with the fonts as
// data URIs, swaps <tv-mark></tv-mark> for the reverse Traverse mark (white on the navy band) and <tv-mark-color></tv-mark-color> for the
// colour mark, prints with headless Chrome, and reports the page count. Skeleton: shared/brand/traverse-pdf/README.md.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../brand/traverse-pdf');
const [inp, outArg] = process.argv.slice(2);
if (!inp) { console.error('usage: node shared/tools/traverse-pdf.mjs <page.html> [out.pdf]'); process.exit(1); }
const src = resolve(inp), out = resolve(outArg || src.replace(/\.html?$/i, '.pdf'));

let css = readFileSync(join(KIT, 'traverse-pdf.css'), 'utf8')
  .replace(/url\('fonts\/([^']+\.woff2)'\)/g, (_, f) => `url('data:font/woff2;base64,${readFileSync(join(KIT, 'fonts', f)).toString('base64')}')`);
let html = readFileSync(src, 'utf8')
  .replace('<tv-mark></tv-mark>', readFileSync(join(KIT, 'traverse-mark-reverse.svg'), 'utf8').trim())
  .replace('<tv-mark-color></tv-mark-color>', readFileSync(join(KIT, 'traverse-mark-color.svg'), 'utf8').trim());
html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => `${m}\n<style>${css}</style>`) : `<style>${css}</style>\n${html}`;

// print from the page's own folder so its relative images still load
const tmp = join(dirname(src), `.tv-print-${process.pid}-${basename(src)}`);
writeFileSync(tmp, html);
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find((c) => spawnSync('which', [c]).status === 0);
if (!chrome) { rmSync(tmp); console.error('no Chrome/Chromium found'); process.exit(1); }
const prof = mkdtempSync(join(tmpdir(), 'tvpdf-'));
const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${prof}`, `--print-to-pdf=${out}`, 'file://' + tmp], { encoding: 'utf8' });
rmSync(tmp); rmSync(prof, { recursive: true, force: true });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const pages = spawnSync('pdfinfo', [out], { encoding: 'utf8' }).stdout.match(/Pages:\s+(\d+)/);
console.log(`${out} (${pages ? pages[1] : '?'} page${pages && pages[1] === '1' ? '' : 's'})`);

// The work packet with all companies in one file that opens straight from disk (2026-10-12). The published packet carries only
// the companies whose website was found; the full list (every company, websites or not) is too big to publish, so it lives here.
// Data inlined as window.PACKET, so no server is needed. Writes out/traverse-work-packet-full.html (gitignored: company names
// include people's names).
//   node traverse/research/packet/build-packet-data.mjs <tmp> && node traverse/research/packet/make-full-page.mjs <tmp>/packet-data.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2]; if (!src) throw new Error('give the full packet-data.json');
const data = readFileSync(src, 'utf8'); if (JSON.parse(data).webOnly) throw new Error('that is the website-only data; build without --web');
const page = readFileSync(join(HERE, 'packet-page.html'), 'utf8');
const at = page.indexOf('<script>'); if (at < 0) throw new Error('no <script> in packet-page.html');
const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  page.slice(0, at) + '<script>window.PACKET = ' + data.replace(/</g, '\\u003c') + ';</script>\n' + page.slice(at) + '\n</html>\n';
mkdirSync(join(HERE, 'out'), { recursive: true });
writeFileSync(join(HERE, 'out', 'traverse-work-packet-full.html'), html);
console.log('wrote out/traverse-work-packet-full.html', (html.length / 1024).toFixed(0) + ' KB');

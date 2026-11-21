/* Print each Claire page to PDF with headless Chrome and report the page count (2026-11-21).
     node render-pdfs.cjs <dir> <name> [<name> ...]     (names without .html) */
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const CH = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const [, , DIR, ...names] = process.argv;
for (const n of names) {
  const html = path.resolve(DIR, n + '.html'), pdf = path.resolve(DIR, n + '.pdf');
  try { execFileSync(CH, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore', timeout: 60000 }); } catch (e) {}
  const pages = fs.existsSync(pdf) ? (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length : 0;
  console.log(n + ': ' + (pages ? pages + ' page(s)' : 'NOT MADE'));
}

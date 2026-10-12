// Shrinks the app's page for upload (2026-10-09, Matthew: the app ran slowly). The page is one file of script, style and
// markup, 820 KB, and goes to every phone on every open (network first, sw.js). Comments and the long names are the
// source's record and stay in traverse/app; this takes them out of the COPY that is uploaded: each <script> through terser
// (whitespace, comments, local names shortened; ES5 out, so older iPads still run it), each <style> through csso (whitespace
// and comments only; rules are left in their order). Nothing else about the page changes, and the source is never touched.
//
//   node traverse/editions/minify-page.cjs             Sixfold's copy: traverse/app/summit-de59ae83/index.html
//                                                      -> traverse/app/dist/summit-de59ae83/index.html (gitignored); upload that
//   node traverse/editions/minify-page.cjs in out      any page
//
// build-editions.cjs calls minifyPage() on each edition's page as its last step, after every swap, so the swaps always find
// their targets in the source and the checks above them still read the source as written.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const terser = require(path.join(REPO, 'node_modules', 'terser'));
const csso = require(path.join(REPO, 'node_modules', 'csso'));

function minifyPage(html) {
  let scripts = 0, styles = 0;
  html = html.replace(/(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/g, (m, open, body, close) => {
    if (!body.trim()) return m;
    if (/type\s*=\s*["']?application\/json/i.test(open)) return m;   /* data (the Spanish dictionary, 2026-10-11), not code */
    const r = terser.minify_sync(body, { ecma: 5, compress: { passes: 2 }, mangle: true, format: { comments: false, ecma: 5 } });
    if (r.error) throw r.error;
    scripts++;
    return open + r.code + close;
  });
  html = html.replace(/(<style(?:\s[^>]*)?>)([\s\S]*?)(<\/style>)/g, (m, open, body, close) => {
    if (!body.trim()) return m;
    styles++;
    return open + csso.minify(body, { restructure: false, comments: false }).css + close;
  });
  if (!scripts || !styles) throw new Error('minify-page: found ' + scripts + ' scripts and ' + styles + ' styles; expected both');
  /* HTML comments too, outside the scripts (2026-10-12): the page's header comment named Sixfold and its towns in every
     edition's source. The i18n markers are only read in the source, by sync-es.cjs. */
  html = html.split(/(<script(?:\s[^>]*)?>[\s\S]*?<\/script>)/).map((part, i) => i % 2 ? part : part.replace(/<!--[\s\S]*?-->\n?/g, '')).join('');
  return html;
}

if (require.main === module) {
  const src = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, 'traverse', 'app', 'summit-de59ae83', 'index.html');
  const out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(REPO, 'traverse', 'app', 'dist', 'summit-de59ae83', 'index.html');
  const html = fs.readFileSync(src, 'utf8');
  const min = minifyPage(html);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, min);
  const gz = (s) => require('zlib').gzipSync(Buffer.from(s)).length;
  console.log(path.relative(REPO, out) + ': ' + html.length + ' -> ' + min.length + ' bytes (gzipped ' + gz(html) + ' -> ' + gz(min) + ')');
}

module.exports = { minifyPage };

// The uploaded copy of a public page without its notes (2026-10-26, Matthew: compress the Peak desk and 365aeration.com pages so
// "view source" doesn't show them). Same idea as traverse/editions/minify-page.cjs, minus the app's build stamp: each inline <script>
// through terser (comments out, local names shortened), each <style> through csso (whitespace and comments only, rules kept in order),
// HTML comments out. A .js file goes through terser whole. The source keeps its notes and is never touched; upload the copy.
//
//   node shared/tools/minify-public.cjs <src-dir> <out-dir> <file> [<file> ...]     paths of the files relative to both dirs
//
// Pages: matthew/peak-pickleball-sponsorship/app (index.html sw.js) -> .../dist; sixfold/aeration365-site (index.html sign/index.html
// q/index.html) -> sixfold/aeration365-site-dist. Both dist folders are gitignored.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
const terser = require(path.join(REPO, 'node_modules', 'terser'));
const csso = require(path.join(REPO, 'node_modules', 'csso'));

const js = (code, module) => {
  const r = terser.minify_sync(code, { module, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  if (r.error) throw r.error;
  return r.code;
};
function minifyHtml(html) {
  const parts = html.split(/(<script(?:\s[^>]*)?>[\s\S]*?<\/script>)/);
  return parts.map((part, i) => {
    if (i % 2) {
      const m = /^(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)$/.exec(part);
      if (!m[2].trim() || /type\s*=\s*["']?application\/(ld\+)?json/i.test(m[1])) return part;   /* data, not code */
      return m[1] + js(m[2], /type\s*=\s*["']?module/i.test(m[1])) + m[3];
    }
    return part
      .replace(/(<style(?:\s[^>]*)?>)([\s\S]*?)(<\/style>)/g, (x, open, body, close) => open + csso.minify(body, { restructure: false, comments: false }).css + close)
      .replace(/<!--[\s\S]*?-->\n?/g, '');
  }).join('');
}

const [src, out, ...files] = process.argv.slice(2);
if (!src || !out || !files.length) { console.error('usage: minify-public.cjs <src-dir> <out-dir> <file> ...'); process.exit(1); }
for (const f of files) {
  const a = fs.readFileSync(path.join(src, f), 'utf8');
  const b = f.endsWith('.js') ? js(a, false) : minifyHtml(a);
  const left = (b.match(/<!--|\/\*/g) || []).length;
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.writeFileSync(path.join(out, f), b);
  console.log(`${f}: ${a.length} -> ${b.length} bytes${left ? ` (${left} comment-like strings left, check them)` : ''}`);
}

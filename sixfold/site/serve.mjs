/* Sixfold Colorado site — local preview server.

   Static files plus clean URLs, which is the bit file:// cannot do: the page
   links to "./" and "merch/", and those need a server to resolve to index.html.

   Lives in the repo rather than the session scratchpad on purpose — the Surge
   equivalent was rebuilt most sessions until it was tracked. Ctrl+C to stop.

     node sixfold/site/serve.mjs  [--port 8090]

   Port 8090 by default: 8080 is the Surge site (website/build/deploy/serve-surge.mjs),
   and both are often wanted at once.
*/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 8090;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4',
};

// Source and notes never get served, the same rule the Surge bundler enforces.
const BLOCKED = /\.(md|mjs|log|sh|map)$|(^|\/)\./;

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};

createServer(async (req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return send(res, 400, 'Bad request'); }

  // Contain the path: no traversal out of ROOT.
  const rel = normalize(path).replace(/^([/\\])+/, '');
  if (rel.split(/[/\\]/).includes('..')) return send(res, 403, 'Forbidden');
  if (BLOCKED.test(rel)) return send(res, 403, 'Forbidden');

  let fsPath = join(ROOT, rel);
  try {
    const s = await stat(fsPath);
    if (s.isDirectory()) {
      // Clean URLs: /merch -> /merch/index.html, and redirect so relative links resolve.
      if (!path.endsWith('/')) {
        res.writeHead(301, { location: path + '/' });
        return res.end();
      }
      fsPath = join(fsPath, 'index.html');
    }
    const body = await readFile(fsPath);
    send(res, 200, body, MIME[extname(fsPath).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found');
  }
}).listen(PORT, () => {
  console.log(`Sixfold site  ->  http://localhost:${PORT}/`);
  console.log(`  merch board ->  http://localhost:${PORT}/merch/`);
  console.log('Ctrl+C to stop.');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try:  node sixfold/site/serve.mjs --port ${PORT + 1}`);
    process.exit(1);
  }
  throw e;
});

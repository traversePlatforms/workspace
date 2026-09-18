/* Sixfold Colorado site — local preview server.

   Static files plus clean URLs, plus (since 2026-09-18) a stand-in for the form
   endpoint: POST /api/submit.php is answered here by logging to a temp file, the
   same contract the real api/submit.php honours on the host. So /contact/ can be
   exercised end to end locally.

   Lives in the repo rather than the session scratchpad on purpose — the Surge
   equivalent was rebuilt most sessions until it was tracked. Ctrl+C to stop.

     node sixfold/site/serve.mjs  [--port 8090]

   Port 8090 by default: 8080 is the Surge site (website/build/deploy/serve-surge.mjs),
   and both are often wanted at once.
*/
import { createServer } from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

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
// .php too: on the host PHP executes it; here it would be served as source.
// _tabled/ holds pages taken off the site but kept buildable (the merch board).
// Either slash after _tabled: on Windows normalize() hands back backslashes, and a
// forward-slash-only pattern let /_tabled/merch/ through on first test.
const BLOCKED = /\.(md|mjs|log|sh|map|php)$|(^|[\/\\])\.|^_tabled([\/\\]|$)/;

// Dev stand-in for the form endpoint. One JSON line per submission.
const FORM_LOG = join(tmpdir(), 'sixfold-submissions.log');

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};

async function parseBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = req.headers['content-type'] || '';
  const out = {};
  if (ct.startsWith('multipart/form-data')) {
    const b = ct.match(/boundary=(.+)$/)?.[1];
    if (!b) return out;
    for (const part of raw.split('--' + b)) {
      const m = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/);
      if (m) out[m[1]] = m[2];
    }
  } else {
    for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  }
  return out;
}

// Mirrors api/submit.php: same required fields, same honeypot, same two
// response shapes (JSON for fetch, 303 to /thank-you/ for a plain submit).
async function handleSubmit(req, res) {
  const b = await parseBody(req);
  const wantsJson = (req.headers.accept || '').includes('application/json');
  const ok = () => wantsJson
    ? send(res, 200, JSON.stringify({ ok: true }), 'application/json; charset=utf-8')
    : (res.writeHead(303, { location: '/thank-you/' }), res.end());
  const bad = (msg) => wantsJson
    ? send(res, 422, JSON.stringify({ ok: false, error: msg }), 'application/json; charset=utf-8')
    : send(res, 422, msg);

  if ((b._hp || '').trim() !== '') return ok();                       // honeypot
  const miss = [];
  if (!(b.name || '').trim()) miss.push('a name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((b.email || '').trim())) miss.push('a valid email');
  if (!(b.phone || '').trim()) miss.push('a phone number');
  if (!(b.message || '').trim()) miss.push('a short message');
  if (miss.length) return bad('Please include ' + miss.join(' and ') + '.');

  await appendFile(FORM_LOG, new Date().toISOString() + '\t' + JSON.stringify(b) + '\n').catch(() => {});
  console.log(`  form [${b.need || '?'}] from ${b.name} <${b.email}>  ->  logged`);
  ok();
}

createServer(async (req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return send(res, 400, 'Bad request'); }

  if (req.method === 'POST' && path === '/api/submit.php') return handleSubmit(req, res);

  // Contain the path: no traversal out of ROOT.
  const rel = normalize(path).replace(/^([/\\])+/, '');
  if (rel.split(/[/\\]/).includes('..')) return send(res, 403, 'Forbidden');
  if (BLOCKED.test(rel)) return send(res, 403, 'Forbidden');

  let fsPath = join(ROOT, rel);
  try {
    const s = await stat(fsPath);
    if (s.isDirectory()) {
      // Clean URLs: /contact -> /contact/index.html, and redirect so relative links resolve.
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
  console.log(`  contact     ->  http://localhost:${PORT}/contact/`);
  console.log(`  form log    ->  ${FORM_LOG}`);
  console.log('Ctrl+C to stop.');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try:  node sixfold/site/serve.mjs --port ${PORT + 1}`);
    process.exit(1);
  }
  throw e;
});

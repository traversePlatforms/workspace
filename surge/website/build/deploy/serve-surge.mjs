/* Surge site — local dev server.
   Mirrors the SiteGround setup closely enough to test against: clean URLs, the
   retired-URL redirects, a 404 page, blocked source files, and a working form
   endpoint (POST /api/submit.php) that logs submissions and returns the same
   JSON / 303-redirect the PHP handler does. Not the production server.

   Lived in the session scratchpad until 2026-09-14 and was lost every session;
   it sits with the rest of the deploy tooling now. Ctrl+C to stop.

     node surge/website/build/deploy/serve-surge.mjs  [--port 8080]
*/
import { createServer } from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));   // .../website/build
const LOG  = join(tmpdir(), 'surge-submissions.log');
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm',   // hero video, added 2026-09-17 — octet-stream makes <video> refuse it
};
const BLOCKED = /\.(md|log|sh|mjs|map|php|phps|inc)$|(^|\/)\./;  // php is executed on the host, never served

// The .htaccess 301s for pages retired 2026-09-07. Host redirects are not tested
// by a static serve, so they live here too — a dead nav link should 301, not 404.
const REDIRECTS = [
  [/^\/how-it-works\/?$/,   '/what-we-do/#the-stages'],
  [/^\/training\/?$/,       '/careers/#how-you-are-trained'],
  [/^\/careers\/apply\/?$/, '/careers/#apply'],
  [/^\/sectors(\/.*)?$/,    '/what-we-do/'],
];

const send = (res, code, body, type = 'text/plain; charset=utf-8', extra = {}) => {
  res.writeHead(code, { 'content-type': type, ...extra });
  res.end(body);
};

async function serveFile(res, fsPath, code = 200) {
  const body = await readFile(fsPath);
  send(res, code, body, MIME[extname(fsPath).toLowerCase()] || 'application/octet-stream');
}
async function serve404(res) {
  try { await serveFile(res, join(ROOT, '404.html'), 404); }
  catch { send(res, 404, 'Not found'); }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const out = {};
      new URLSearchParams(d).forEach((v, k) => { out[k] = v; });
      resolve(out);
    });
  });
}

async function handleSubmit(req, res) {
  const b = await parseBody(req);
  const wantsJson = (req.headers.accept || '').includes('application/json');
  const ok = (extra = {}) => wantsJson
    ? send(res, 200, JSON.stringify({ ok: true }), 'application/json', extra)
    : send(res, 303, '', 'text/plain', { location: '/thank-you/' });
  const bad = (msg, code = 422) => wantsJson
    ? send(res, code, JSON.stringify({ ok: false, error: msg }), 'application/json')
    : send(res, code, msg);

  if ((b._hp || '').trim() !== '') return ok();                       // honeypot
  const name = (b.name || '').trim();
  const email = (b.email || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const needMsg = b._form !== 'book';
  const miss = [];
  if (!name) miss.push('a name');
  if (!emailOk) miss.push('a valid email');
  if (needMsg && !(b.message || '').trim()) miss.push('a short message');
  if (miss.length) return bad('Please include ' + miss.join(' and ') + '.');

  await appendFile(LOG, new Date().toISOString() + '\t' + JSON.stringify(b) + '\n').catch(() => {});
  console.log(`  form "${b._form || 'contact'}" from ${name} <${email}>  ->  logged`);
  ok();
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);

    if (req.method === 'POST' && path === '/api/submit.php') return handleSubmit(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

    for (const [re, to] of REDIRECTS) {
      if (re.test(path)) { res.writeHead(301, { location: to }); return res.end(); }
    }

    path = normalize(path).replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
    if (BLOCKED.test(path)) return send(res, 403, 'Forbidden');

    let fsPath = join(ROOT, path);
    let s = await stat(fsPath).catch(() => null);

    if (s?.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { location: path + '/' }); return res.end(); }
      fsPath = join(fsPath, 'index.html');
      s = await stat(fsPath).catch(() => null);
    } else if (!s && !extname(fsPath)) {
      const alt = await stat(fsPath + '/index.html').catch(() => null);
      if (alt) { res.writeHead(301, { location: path.replace(/\/?$/, '/') }); return res.end(); }
    }
    if (!s) return serve404(res);
    await serveFile(res, fsPath);
  } catch (e) {
    console.error(e);
    send(res, 500, 'Server error');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — another dev server is probably still running.`);
    console.error(`Stop it, or start this one on another port:  node ${process.argv[1]} --port 8081`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, () => {
  console.log(`Surge site (dev)   http://localhost:${PORT}/`);
  console.log(`serving            ${ROOT}`);
  console.log(`form log           ${LOG}`);
  console.log('Ctrl+C to stop.');
});

// The harness front on 8814 for the satcache timings: PHP's built-in server answers one request at a time (and has no workers on
// Windows), so a screen of 16 tile misses would queue behind each other, which the live server (nginx + PHP-FPM) does not do.
// /api/satcache.php goes round-robin to six php -S workers (8841-8846); everything else to the main harness server on 8840.
const http = require('http');
const MAIN = 8840, POOL = [8841, 8842, 8843, 8844, 8845, 8846];
let rr = 0;
http.createServer((req, res) => {
  const port = req.url.startsWith('/api/satcache.php') ? POOL[rr++ % POOL.length] : MAIN;
  const up = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', (e) => { res.writeHead(502); res.end('front: ' + e.message); });
  req.pipe(up);
}).listen(8814, '127.0.0.1', () => console.log('front on 8814'));

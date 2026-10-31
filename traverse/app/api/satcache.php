<?php
declare(strict_types=1);
/* satcache.php: our server's copy of the aerial photo tiles (TR-52, 2026-10-31)
 *
 * The Photo and Hybrid map looks and the property card's lot photo show the 2023 USDA NAIP photos, which Microsoft's Planetary
 * Computer renders tile by tile on every request (about 0.5-2 s a tile, 12-20 tiles a screen). This file sits between the app and
 * Planetary Computer: the first request for a tile fetches it from there and keeps it on disk; every later request, from any phone
 * on any of the installs on this host, is served from disk with a year-long browser cache header. One copy for every install
 * (public photos, no client data): traverse-shared/satcache/, outside public_html.
 *
 * Only NAIP tiles inside Colorado are fetched, so this is not an open proxy:
 *   ?l=co2023&z=..&x=..&y=..                   the statewide 2023 mosaic (the Photo / Hybrid look on the door maps)
 *   ?i=co_m_..._2023....&z=..&x=..&y=..        one NAIP photo (the lot photo, the aerial view and the small aerial)
 * z 12-19 only, and the tile must touch Colorado's box. Anything else answers 400/404 and nothing is fetched.
 *
 * The mosaic: Planetary Computer's register answers a new id for every request (pc1.<expiry>.<hex>, the expiry a day out, checked
 * 2026-10-31), so the tiles are kept under the search (state + year), not under any one id. The server registers the same search
 * the page does and keeps the id until an hour before it expires (mosaic-<layer>.json); a 410 ("register a new search") registers
 * again once. If the server cannot register, it uses the id the page has always fallen back to (SAT_FALLBACK, registered 9 Oct,
 * still serving Colorado on 31 Oct). The page's own id is never sent here: it changes every visit, which would defeat the
 * browser's cache, and no visitor's id can put other pictures under the shared name.
 *
 * Disk: capped at SATC_CAP_MB (2.5 GB: about 16,000 PNG tiles at ~150 KB, on a host with 362 GB free and no other big use). A
 * running total sits in usage.json; when a new tile takes it past the cap, the oldest-used tiles go first until it is under 85%
 * (a tile read from disk is touched at most every 3 days, so "oldest" means least recently seen). Every clean-up, register and
 * upstream failure is a line in satcache.log; requests are counted per day in stats/ (h hit, m miss, e error,
 * n no photo). `php satcache.php usage` prints the numbers.
 *
 * Fetches from Planetary Computer are limited per visitor (SATC_RL_MAX in 5 minutes); tiles already on disk are never limited. */

const SATC_UPSTREAM = 'https://planetarycomputer.microsoft.com/api/data/v1';
const SATC_CAP_MB = 2560, SATC_CLEAN_TO = 0.85;
const SATC_TOUCH_AGE = 3 * 86400, SATC_NONE_AGE = 30 * 86400;
const SATC_RL_MAX = 600, SATC_RL_WINDOW = 300;
const SATC_CO = [-109.10, 36.95, -102.00, 41.05];   /* Colorado's box (W, S, E, N) with a few hundred metres to spare */
const SATC_Q = 'collection=naip&assets=image&asset_bidx=image%7C1%2C2%2C3&format=png';   /* exactly the page's query, so the pictures match */
const SATC_FALLBACK = 'fe04cec383767467e9a31d04fab20050';   /* the page's SAT_FALLBACK, for co2023 only */
const SATC_ID_OK ='/^(?:[a-f0-9]{16,64}|pc1\.\d{6,14}\.[a-f0-9]{8,64})$/';   /* the page's SAT_ID_OK */
const SATC_ITEM_OK = '/^co_m_\d{7}_(?:ne|nw|se|sw)_1[23]_\d{3}_\d{8}(?:_\d{8})?$/';   /* Colorado NAIP photo ids (UTM 12 and 13) */

function satcDir(): string {
    $d = getenv('SATCACHE_DIR');   /* the test harness points it at a throwaway folder */
    return ($d !== false && $d !== '') ? rtrim($d, '/\\') : dirname(__DIR__, 2) . '/traverse-shared/satcache';
}
function satcCap(): int { $m = (int) (getenv('SATCACHE_CAP_MB') ?: SATC_CAP_MB); return max(1, $m) * 1048576; }
function satcUpstream(): string { $u = getenv('SATCACHE_UPSTREAM'); return ($u !== false && $u !== '') ? rtrim($u, '/') : SATC_UPSTREAM; }
function satcLog(string $line): void {
    $f = satcDir() . '/satcache.log';
    if (@filesize($f) > 1048576) @rename($f, $f . '.1');
    @file_put_contents($f, gmdate('Y-m-d H:i:s') . 'Z ' . $line . "\n", FILE_APPEND | LOCK_EX);
}
/* one letter per request into today's stats file: an append of one byte, no lock needed */
function satcCount(string $c): void { @file_put_contents(satcDir() . '/stats/' . gmdate('Ymd') . '.txt', $c, FILE_APPEND); }

/** the tile's box in degrees (W, S, E, N) */
function satcTileBox(int $z, int $x, int $y): array {
    $n = 2 ** $z;
    $lat = fn(int $yy) => rad2deg(atan(sinh(M_PI * (1 - 2 * $yy / $n))));
    return [$x / $n * 360 - 180, $lat($y + 1), ($x + 1) / $n * 360 - 180, $lat($y)];
}
function satcInCo(int $z, int $x, int $y): bool {
    [$w, $s, $e, $nn] = satcTileBox($z, $x, $y);
    return $e >= SATC_CO[0] && $w <= SATC_CO[2] && $nn >= SATC_CO[1] && $s <= SATC_CO[3];
}

/** GET bytes; $code = HTTP status (0 = no answer) and $type = the content type */
function satcGet(string $url, int &$code, string &$type, int $timeout = 25): ?string {
    $code = 0; $type = '';
    if (!function_exists('curl_init')) return null;
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['User-Agent: TraverseSatCache/1.0 (traverseplatforms.com)', 'Accept: image/png,*/*']]);
    $b = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); $type = (string) curl_getinfo($c, CURLINFO_CONTENT_TYPE); curl_close($c);
    return $b === false ? null : (string) $b;
}

/** the server's own id for the statewide search; $failed = an id Planetary Computer just refused (410): register again, unless
    another request already did and the kept id is a newer one */
function satcMosaicId(string $state, string $year, ?string $failed = null): ?string {
    $f = satcDir() . '/mosaic-' . $state . $year . '.json';
    $fh = @fopen($f, 'c+'); if (!$fh) return null;
    @flock($fh, LOCK_EX);   /* one register at a time: the other tiles of the screen wait here and use its answer */
    $k = json_decode((string) stream_get_contents($fh), true); $k = is_array($k) ? $k : [];
    $id = (string) ($k['id'] ?? ''); $exp = (int) ($k['exp'] ?? 0);
    $ok = $id !== '' && $exp > time() + 3600 && $id !== $failed;
    if (!$ok) {
        $body = json_encode(['filter-lang' => 'cql2-json', 'filter' => ['op' => 'and', 'args' => [
            ['op' => '=', 'args' => [['property' => 'collection'], 'naip']],
            ['op' => '=', 'args' => [['property' => 'naip:state'], $state]],
            ['op' => '=', 'args' => [['property' => 'naip:year'], $year]]]],
            'sortby' => [['field' => 'properties.gsd', 'direction' => 'asc']]]);
        $new = null;
        if (function_exists('curl_init')) {
            $c = curl_init(satcUpstream() . '/mosaic/register');
            curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'User-Agent: TraverseSatCache/1.0 (traverseplatforms.com)']]);
            $j = json_decode((string) curl_exec($c), true); curl_close($c);
            $sid = is_array($j) ? (string) ($j['id'] ?? ($j['searchid'] ?? '')) : '';
            if (preg_match(SATC_ID_OK, $sid)) $new = $sid;
        }
        if ($new !== null) {
            /* pc1.<unix expiry>.<hex>; an id of the older shape has no expiry in it, so it is kept 20 hours */
            $e = preg_match('/^pc1\.(\d{6,14})\./', $new, $mm) ? (int) $mm[1] : time() + 20 * 3600;
            $k = ['id' => $new, 'exp' => $e, 'at' => time()];
            ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($k));
            satcLog('register ' . $state . $year . ' ok, good until ' . gmdate('Y-m-d H:i', $e) . 'Z');
            $id = $new;
        } else {
            satcLog('register ' . $state . $year . ' FAILED');
            $id = '';
        }
    }
    @flock($fh, LOCK_UN); fclose($fh);
    return $id !== '' ? $id : null;
}

/** add a stored tile's bytes to the running total; true when that takes the total past the cap */
function satcAdd(int $bytes, int $files): bool {
    $f = satcDir() . '/usage.json';
    $fh = @fopen($f, 'c+'); if (!$fh) return false;
    @flock($fh, LOCK_EX);
    $u = json_decode((string) stream_get_contents($fh), true);
    if (!is_array($u) || !isset($u['bytes'])) { @flock($fh, LOCK_UN); fclose($fh); return satcRecount()[0] > satcCap(); }   /* first tile, or the file was lost: count the disk once (the new tile is already on it) */
    $u['bytes'] = max(0, (int) $u['bytes'] + $bytes); $u['files'] = max(0, (int) $u['files'] + $files); $u['at'] = time();
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($u));
    @flock($fh, LOCK_UN); fclose($fh);
    return $u['bytes'] > satcCap();
}
/** every kept tile as [path, bytes, mtime] (the "no photo" markers are empty and not counted) */
function satcScan(): array {
    $out = []; $root = satcDir() . '/t';
    if (!is_dir($root)) return $out;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $p => $fi) if ($fi->isFile() && str_ends_with($p, '.png')) $out[] = [$p, $fi->getSize(), $fi->getMTime()];
    return $out;
}
function satcWriteUsage(array $u): void {
    $f = satcDir() . '/usage.json';
    $fh = @fopen($f, 'c+'); if (!$fh) return;
    @flock($fh, LOCK_EX);
    $old = json_decode((string) stream_get_contents($fh), true); $old = is_array($old) ? $old : [];
    $u = array_merge($old, $u, ['at' => time()]);
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($u));
    @flock($fh, LOCK_UN); fclose($fh);
}
function satcRecount(): array {
    $all = satcScan(); $b = 0; foreach ($all as $r) $b += $r[1];
    satcWriteUsage(['bytes' => $b, 'files' => count($all), 'counted' => time()]);
    return [$b, count($all)];
}
/** over the cap: drop the oldest-used tiles until under SATC_CLEAN_TO of it. One clean-up at a time; the others skip. */
function satcClean(): void {
    $lk = @fopen(satcDir() . '/clean.lock', 'c'); if (!$lk || !@flock($lk, LOCK_EX | LOCK_NB)) return;
    $t0 = microtime(true);
    $all = satcScan(); $b = 0; foreach ($all as $r) $b += $r[1];
    $before = $b; $n0 = count($all); $gone = 0;
    if ($b > satcCap()) {
        usort($all, fn($p, $q) => $p[2] <=> $q[2]);
        $goal = (int) (satcCap() * SATC_CLEAN_TO);
        foreach ($all as $r) {
            if ($b <= $goal) break;
            if (@unlink($r[0])) { $b -= $r[1]; $gone++; @rmdir(dirname($r[0])); }   /* the folder goes too once empty (rmdir refuses otherwise) */
        }
    }
    satcWriteUsage(['bytes' => $b, 'files' => $n0 - $gone, 'counted' => time(), 'lastClean' => time(), 'cleaned' => $gone]);
    satcLog(sprintf('clean: %d of %d tiles removed, %.1f MB -> %.1f MB (cap %d MB) in %.1f s', $gone, $n0, $before / 1048576, $b / 1048576, satcCap() / 1048576, microtime(true) - $t0));
    satcSweep();
    @flock($lk, LOCK_UN); fclose($lk);
}
/** old rate-limit buckets (over an hour) and stats past two weeks */
function satcSweep(): void {
    foreach ((array) glob(satcDir() . '/rl/*') as $f) if (@filemtime($f) < time() - 3600) @unlink($f);
    foreach ((array) glob(satcDir() . '/stats/*.txt') as $f) if (@filemtime($f) < time() - 15 * 86400) @unlink($f);
}
/** this visitor's fetches from Planetary Computer in the current 5 minutes; false when over the limit */
function satcRateOk(): bool {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
    if (mt_rand(1, 200) === 1) satcSweep();   /* the buckets would otherwise wait for the first clean-up, weeks away */
    $f = satcDir() . '/rl/' . substr(hash('sha256', $ip . '|' . intdiv(time(), SATC_RL_WINDOW)), 0, 24);
    $fh = @fopen($f, 'c+'); if (!$fh) return true;
    @flock($fh, LOCK_EX);
    $n = (int) stream_get_contents($fh) + 1;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, (string) $n);
    @flock($fh, LOCK_UN); fclose($fh);
    return $n <= (int) (getenv('SATCACHE_RL_MAX') ?: SATC_RL_MAX);   /* the tests lower it */
}

function satcFail(int $code, string $why, string $count = 'e'): void {
    satcCount($count);
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: ' . ($code === 404 ? 'public, max-age=86400' : 'no-store'));
    header('X-Content-Type-Options: nosniff');
    echo $why;
}
function satcSend(string $bytes, string $how): void {
    header('Content-Type: image/png');
    header('Content-Length: ' . strlen($bytes));
    header('Cache-Control: public, max-age=31536000, immutable');   /* the address names the photo and its year: it never changes */
    header('X-Content-Type-Options: nosniff');
    header('X-Satcache: ' . $how);
    echo $bytes;
}
/** after the answer has gone: the phone is not kept waiting for a clean-up */
function satcAfterAnswer(): void {
    if (function_exists('fastcgi_finish_request')) { @fastcgi_finish_request(); return; }
    @ob_end_flush(); @flush();
}

/** answer one tile request ($q = the query parameters) */
function satcServe(array $q): void {
    $z = filter_var($q['z'] ?? null, FILTER_VALIDATE_INT); $x = filter_var($q['x'] ?? null, FILTER_VALIDATE_INT); $y = filter_var($q['y'] ?? null, FILTER_VALIDATE_INT);
    if ($z === false || $x === false || $y === false || $z < 12 || $z > 19 || $x < 0 || $y < 0 || $x >= 2 ** $z || $y >= 2 ** $z) { satcFail(400, 'Bad tile.'); return; }
    $layer = (string) ($q['l'] ?? ''); $item = (string) ($q['i'] ?? '');
    if ($layer !== '' && $item !== '') { satcFail(400, 'One kind of tile at a time.'); return; }
    if ($layer !== '' && preg_match('/^co(20[1-3]\d)$/', $layer, $lm)) { $key = 'm-' . $layer; }
    elseif ($layer === '' && $item !== '' && preg_match(SATC_ITEM_OK, $item)) { $key = 'i-' . $item; }
    else { satcFail(400, 'Only Colorado NAIP photos.'); return; }
    if (!satcInCo($z, $x, $y)) { satcFail(404, 'Outside Colorado.', 'n'); return; }

    $dir = satcDir();
    $path = $dir . '/t/' . $key . '/' . $z . '/' . $x . '/' . $y . '.png';
    $none = substr($path, 0, -4) . '.none';
    if (is_file($path)) {
        $b = @file_get_contents($path);
        if (is_string($b) && $b !== '') {
            satcCount('h');
            satcSend($b, 'hit');
            if (@filemtime($path) < time() - SATC_TOUCH_AGE) @touch($path);   /* seen again: not "oldest" any more */
            return;
        }
    }
    if (is_file($none) && @filemtime($none) > time() - SATC_NONE_AGE) { satcFail(404, 'No photo here.', 'n'); return; }
    foreach (['t', 'rl', 'stats'] as $s) if (!is_dir($dir . '/' . $s)) @mkdir($dir . '/' . $s, 0755, true);
    if (!satcRateOk()) { satcFail(429, 'Too many new tiles at once; try again in a few minutes.'); return; }
    @ignore_user_abort(true);   /* a phone that pans away mid-fetch still leaves the tile kept for the next one */

    $code = 0; $type = '';
    $tile = '/tiles/WebMercatorQuad/' . $z . '/' . $x . '/' . $y;
    if ($item !== '') {
        $b = satcGet(satcUpstream() . '/item' . $tile . '@1x?' . SATC_Q . '&item=' . rawurlencode($item), $code, $type);
    } else {
        $state = 'co'; $year = $lm[1];
        $id = satcMosaicId($state, $year);
        $fb = false;
        if ($id === null) {   /* we cannot register: the 9 Oct id for 2023, else nothing */
            if ($year !== '2023') { satcFail(502, 'Aerial photos cannot load right now.'); return; }
            $id = SATC_FALLBACK; $fb = true;
        }
        $b = satcGet(satcUpstream() . '/mosaic/' . rawurlencode($id) . $tile . '?' . SATC_Q, $code, $type);
        if ($code === 410 && !$fb) {   /* "register a new search": the kept id expired early */
            $id = satcMosaicId($state, $year, $id);
            if ($id !== null) $b = satcGet(satcUpstream() . '/mosaic/' . rawurlencode($id) . $tile . '?' . SATC_Q, $code, $type);
        }
    }
    if ($code === 404) {   /* Planetary Computer has no photo for this tile: remembered for a month, so it is not asked again */
        @mkdir(dirname($none), 0755, true); @touch($none);
        satcFail(404, 'No photo here.', 'n'); return;
    }
    if ($b === null || $code !== 200 || substr($b, 0, 8) !== "\x89PNG\r\n\x1a\n") {
        satcLog('upstream ' . $key . ' ' . $z . '/' . $x . '/' . $y . ': HTTP ' . $code . ' ' . substr(preg_replace('/\s+/', ' ', $type), 0, 40));
        satcFail(502, 'Aerial photos cannot load right now.'); return;
    }
    satcCount('m');
    satcSend($b, 'miss');
    satcAfterAnswer();
    /* kept: written beside, then linked into place, so a tile half-written is never served. link() refuses when another phone's
       request put the same tile there first, so a tile is counted once (rename where the disk has no hard links). */
    @mkdir(dirname($path), 0755, true);
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.part';
    if (@file_put_contents($tmp, $b) !== strlen($b)) { @unlink($tmp); satcLog('cannot write ' . $path); return; }
    $new = @link($tmp, $path);
    if (!$new && !is_file($path)) $new = @rename($tmp, $path);
    if (is_file($tmp)) @unlink($tmp);
    if ($new && satcAdd(strlen($b), 1)) satcClean();
}

/** the numbers, for `php satcache.php usage` and the morning check */
function satcUsage(): array {
    $u = json_decode((string) @file_get_contents(satcDir() . '/usage.json'), true); $u = is_array($u) ? $u : [];
    $days = [];
    foreach ((array) glob(satcDir() . '/stats/*.txt') as $f) {
        $c = count_chars((string) @file_get_contents($f), 1);
        $days[basename($f, '.txt')] = ['hit' => $c[ord('h')] ?? 0, 'miss' => $c[ord('m')] ?? 0, 'none' => $c[ord('n')] ?? 0, 'error' => $c[ord('e')] ?? 0];
    }
    ksort($days);
    return ['mb' => round(((int) ($u['bytes'] ?? 0)) / 1048576, 1), 'files' => (int) ($u['files'] ?? 0), 'capMb' => intdiv(satcCap(), 1048576),
        'lastClean' => isset($u['lastClean']) ? gmdate('Y-m-d H:i', (int) $u['lastClean']) . 'Z' : null, 'days' => $days];
}

if (PHP_SAPI === 'cli') {
    if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') !== __FILE__) return;   /* required by a test: functions only */
    $cmd = $argv[1] ?? 'usage';
    if ($cmd === 'recount') { satcRecount(); }
    if ($cmd === 'clean') { satcClean(); }
    echo json_encode(satcUsage(), JSON_PRETTY_PRINT), "\n";
    exit(0);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') { satcFail(405, 'GET only.'); exit; }
satcServe($_GET);

<?php
/* Before/after check for the practice copy (2026-11-02): every file in live Sixfold's data and private folders, and the live install code,
 * with its size, time and (data and code only) md5, written to a file on the server. Run once before and once after; compare prints only
 * counts and the names of files that changed, never what is in them. The private folder gets size and time only (no hashes of codes files).
 *   php practice-snapshot.php take <file>          php practice-snapshot.php compare <before> <after> */
if (PHP_SAPI !== 'cli') exit;
$site = getenv('HOME') . '/www/traverseplatforms.com';
$mode = $argv[1] ?? '';
if ($mode === 'take') {
    $out = [];
    $walk = function (string $dir, bool $hash) use (&$out, $site) {
        if (!is_dir($dir)) return;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) if ($f->isFile()) { $p = substr($f->getPathname(), strlen($site) + 1); $out[$p] = $f->getSize() . ' ' . $f->getMTime() . ($hash ? ' ' . md5_file($f->getPathname()) : ''); }
    };
    $walk("$site/sixfold-data", true);
    $walk("$site/sixfold-private", false);
    $code = ['api/rounds.php', 'api/billing.php', 'api/sms.php', 'api/webpush.php', 'api/skiptrace.php', 'api/care-lib.php', 'api/eod-lib.php', 'api/mail-oauth-lib.php', 'api/fb-leads-lib.php', 'api/jobber-lib.php',
             'summit-de59ae83/index.html', 'summit-de59ae83/version.txt', 'summit-de59ae83/sw.js', 'api/traverse-yards-rounds.php', 'ty-25604fff/index.html', 'ty-25604fff/version.txt', 'api/traverse-rounds.php', 'tr-cb2e8587/index.html'];
    foreach ($code as $c) { $p = "$site/public_html/$c"; if (is_file($p)) $out["public_html/$c"] = filesize($p) . ' ' . filemtime($p) . ' ' . md5_file($p); }
    file_put_contents($argv[2], json_encode($out));
    echo 'snapshot: ', count($out), " files\n";
} elseif ($mode === 'compare') {
    $a = json_decode((string) file_get_contents($argv[2]), true); $b = json_decode((string) file_get_contents($argv[3]), true);
    $ch = []; $new = []; $gone = [];
    foreach ($b as $p => $v) { if (!isset($a[$p])) $new[] = $p; elseif ($a[$p] !== $v) $ch[] = $p; }
    foreach ($a as $p => $v) if (!isset($b[$p])) $gone[] = $p;
    /* names only to folder depth 3 (a photo's path names a house): sixfold-data/rounds/photos/... */
    $short = fn(array $l) => array_values(array_unique(array_map(fn($p) => str_starts_with($p, 'public_html/') ? $p : implode('/', array_slice(explode('/', $p), 0, 3)) . (substr_count($p, '/') > 2 ? '/...' : ''), $l)));
    [$ch, $new, $gone] = [$short($ch), $short($new), $short($gone)];
    echo 'files: ', count($a), ' before, ', count($b), " after\n";
    echo 'changed: ', count($ch), ($ch ? ' (' . implode(', ', $ch) . ')' : ''), "\n";
    echo 'new: ', count($new), ($new ? ' (' . implode(', ', $new) . ')' : ''), "\n";
    echo 'gone: ', count($gone), ($gone ? ' (' . implode(', ', $gone) . ')' : ''), "\n";
    $code = array_filter(array_merge($ch, $new, $gone), fn($p) => str_starts_with($p, 'public_html/'));
    echo 'live install code changed: ', $code ? implode(', ', $code) : 'none', "\n";
}

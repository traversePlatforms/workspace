<?php
/* Keep every install's door-search index fresh outside a user's request (2026-10-27, code review item 9: the index was rebuilt inside
 * the first search after a town upload; six "Allowed memory size exhausted" fatals on 25 Oct, and Sixfold's index was missing).
 * Started hourly by morning-email.php; searchIndexFile() only rebuilds when a town file is newer than the index, so most hours it is a
 * few stat calls per install. Each install runs in its own PHP process (their APIs define the same functions).
 *   php search-index-warm.php                 every install, one after another
 *   php search-index-warm.php <api file>      one install (used by the loop above) */
if (PHP_SAPI !== 'cli') exit;
@ini_set('memory_limit', '1024M');
$api = dirname(__DIR__) . '/public_html/api';
if (empty($argv[1])) {
    foreach (array_merge([$api . '/rounds.php'], glob($api . '/traverse*-rounds.php') ?: []) as $f) {
        $t = microtime(true);
        $out = []; @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($f) . ' 2>&1', $out);
        echo date('Y-m-d H:i'), ' ', basename($f), ': ', trim(implode(' ', $out)) ?: 'no output', ' (', round(microtime(true) - $t, 1), " s)\n";
    }
    exit;
}
$f = $argv[1];
if (!preg_match('#/(rounds|traverse[a-z-]*-rounds)\.php$#', $f) || !is_file($f)) { echo "not an install API\n"; exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $f; } catch (SixfoldOut $e) {}
$idx = DATA_DIR . '/search-index.txt'; $before = is_file($idx) ? filemtime($idx) : 0;
$r = searchIndexFile();
echo $r === null ? 'no index' : (filemtime($idx) !== $before ? 'rebuilt, ' . round(filesize($idx) / 1048576, 1) . ' MB' : 'fresh');

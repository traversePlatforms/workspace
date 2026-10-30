<?php
/* Build every install's towns answer (action=regions) before a phone asks for it (2026-10-29, speed check: a new day, a deploy or a
 * settings save threw the kept answer away, and whoever opened the app next waited 7-16 s while all ~185 towns were rebuilt).
 * Started hourly by morning-email.php (the midnight run catches the new day) and once by traverse/ops/deploy-app.sh after a deploy.
 * When nothing changed it is a few stat calls per town. The answer differs only by admin or not (crewSees is the same for every
 * other role), so it is asked for twice per install, as admin and as crew. Each install and role runs in its own PHP process (their
 * APIs define the same functions).
 *   php regions-warm.php                          every install, both roles, one after another
 *   php regions-warm.php <api file> <role>        one install as one role (used by the loop above) */
if (PHP_SAPI !== 'cli') exit;
@ini_set('memory_limit', '1024M');
$api = dirname(__DIR__) . '/public_html/api';
if (empty($argv[1])) {
    foreach (array_merge([$api . '/rounds.php'], glob($api . '/traverse*-rounds.php') ?: []) as $f) foreach (['admin', 'crew'] as $role) {
        $t = microtime(true);
        $out = []; @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($f) . ' ' . $role . ' 2>&1', $out);
        echo date('Y-m-d H:i'), ' ', basename($f), ' ', $role, ': ', trim(implode(' ', $out)) ?: 'no output', ' (', round(microtime(true) - $t, 1), " s)\n";
    }
    exit;
}
$f = $argv[1]; $role = $argv[2] ?? '';
if (!preg_match('#/(rounds|traverse[a-z-]*-rounds)\.php$#', $f) || !is_file($f)) { echo "not an install API\n"; exit(1); }
if (!in_array($role, ['admin', 'crew'], true)) { echo "role must be admin or crew\n"; exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
define('SIXFOLD_WARM_ROLE', $role);
$_REQUEST = ['action' => 'regions']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $f; echo 'no answer'; } catch (SixfoldOut $e) {
    $b = $e->body;
    echo empty($b['ok']) ? 'error: ' . (string) ($b['error'] ?? '?') : (!empty($b['cached']) ? 'fresh' : 'rebuilt') . ', ' . count((array) ($b['regions'] ?? [])) . ' towns';
}

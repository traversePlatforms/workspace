<?php
/* P-15 (21 Nov 2026): the laptop's side of pay stubs. assistant/jarvis/tools/paystub-watch.sh (from help-watch.sh's 5-minute beat) sends each
   PDF dropped in Desktop\paystubs over SSH:  php jvstub.php add "<file name>" < stub.pdf
   Command line only. It prints only whether the stub was taken and read, never a number from it. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'claude', 'jarvis', 'money', 'paystub'] as $f) require __DIR__ . '/lib/' . $f . '.php';
$cmd = (string) ($argv[1] ?? '');
if ($cmd === 'add') {
    $r = stAdd((string) stream_get_contents(STDIN), (string) ($argv[2] ?? 'pay stub.pdf'), 'laptop');
    echo json_encode(array_intersect_key($r, array_flip(['ok', 'dup', 'status', 'check', 'error'])), JSON_UNESCAPED_SLASHES) . "\n";
    exit($r['ok'] ? 0 : 1);
}
if ($cmd === 'report') {   /* counts only: how many read, how many to check, the pay dates covered */
    $a = stAll(); $d = array_filter(array_column($a, 'pay_date'));
    echo json_encode(['stubs' => count($a), 'read' => count(array_filter($a, fn($s) => $s['status'] === 'read')), 'check' => count(array_filter($a, fn($s) => $s['status'] === 'check')),
        'other' => count(array_filter($a, fn($s) => !in_array($s['status'], ['read', 'check'], true))), 'matched' => count(array_filter($a, fn($s) => !empty($s['tx']))), 'from' => $d ? min($d) : null, 'to' => $d ? max($d) : null]) . "\n";
    exit;
}
fwrite(STDERR, "use: php jvstub.php add <name> < file.pdf | report\n"); exit(2);

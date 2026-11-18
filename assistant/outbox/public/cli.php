<?php
declare(strict_types=1);
/* Outbox's command line (never a web page).
     php cli.php setcode < the sign-in code     makes outbox-data (0700) if needed and saves the code hashed; reads a pipe, prints nothing of it
     php cli.php summary                        one line: sent today, waiting, failed, and what needs attention
     php cli.php check                          what is set up (never a code) */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';
$cmd = $argv[1] ?? '';
if ($cmd === 'setcode') {
    if (!is_dir(obData()) && !@mkdir(obData(), 0700, true)) { fwrite(STDERR, "cannot make the data folder\n"); exit(1); }
    @chmod(obData(), 0700);
    $code = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) stream_get_contents(STDIN)));
    if (strlen($code) < 10) { fwrite(STDERR, "code too short\n"); exit(1); }
    $f = obData() . '/code.hash'; file_put_contents($f, password_hash($code, PASSWORD_DEFAULT)); chmod($f, 0600);
    echo "sign-in code saved (hashed)\n"; exit(0);
}
if ($cmd === 'check') {
    echo 'data folder: ', obReady() ? 'yes' : 'NO', "\n", 'sign-in code set: ', is_file(obData() . '/code.hash') ? 'yes' : 'NO', "\n",
         'Peak copy: ', is_file(__DIR__ . '/peak/lib.php') && is_file(__DIR__ . '/peak/site.php') ? 'yes' : 'NO', "\n", 'Microsoft returns to: ', obPeakRedirect(), "\n";
    exit(0);
}
if ($cmd === 'summary') {
    if (!obReady()) { echo "Outbox: not set up\n"; exit(1); }
    $v = obView(); $s = $v['summary']; $f = fn(array $a) => array_sum($a) . ' (Peak ' . $a['peak'] . ', Sixfold ' . $a['sixfold'] . ', Traverse ' . $a['traverse'] . ')';
    echo 'Outbox: sent today ', $f($s['sent']), '; waiting ', $f($s['waiting']), ($s['waitingPaused'] ? ' + ' . $s['waitingPaused'] . ' on paused Peak lists' : ''), '; failed today ', $f($s['failed']), "\n";
    foreach ($s['attention'] as $a) echo '  ', $a['level'] === 'bad' ? '! ' : '- ', $a['text'], "\n";
    exit(0);
}
fwrite(STDERR, "usage: php cli.php setcode | summary | check\n"); exit(1);

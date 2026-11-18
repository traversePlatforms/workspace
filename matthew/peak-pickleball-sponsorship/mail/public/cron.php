<?php
declare(strict_types=1);
/* The Peak email's command line (never a web page). The hourly SiteGround cron job (sixfold-tools/morning-email.php) starts `run` in the
   background, and the overnight check on Matthew's laptop prints `stats`.
     php cron.php run       read replies and bounce notices, then send this hour's emails (only lists Matthew started, only in the window)
     php cron.php stats     one line: connection, and per list: status, sent, waiting, replied, bounced, unsubscribed, clicked
     php cron.php import    bring the two lists in from the Peak desk again (a running list that gains people is paused)
     php cron.php check     what is set up (never a key, token or code)
     php cron.php dns       check SPF, DKIM and DMARC for peakpickleball.us (or the connected mailbox's domain) and save it for the page
   Setup, each reading from a pipe so nothing is typed on a command line or printed:
     php cron.php setapp  < 3 lines: client ID, tenant ID, secret     (writes app.json, 0600)
     php cron.php setcode < the sign-in code                          (writes code.hash, a password hash) */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';
$cmd = $argv[1] ?? '';
if ($cmd === 'setapp' || $cmd === 'setcode') {
    if (!is_dir(pmData()) && !@mkdir(pmData(), 0700, true)) { fwrite(STDERR, "cannot make the data folder\n"); exit(1); }
    @chmod(pmData(), 0700);
    $in = trim(str_replace("\r", '', (string) stream_get_contents(STDIN)));
    if ($cmd === 'setapp') {
        $l = array_map('trim', explode("\n", $in));
        if (count($l) < 3) { fwrite(STDERR, "need three lines\n"); exit(1); }
        if (!pmW('app.json', ['client_id' => $l[0], 'tenant' => $l[1], 'secret' => $l[2]]) || !pmApp()) { fwrite(STDERR, "app keys not saved (shape not right)\n"); exit(1); }
        echo "app keys saved\n"; exit(0);
    }
    $code = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $in));
    if (strlen($code) < 10) { fwrite(STDERR, "code too short\n"); exit(1); }
    $f = pmData() . '/code.hash'; file_put_contents($f, password_hash($code, PASSWORD_DEFAULT)); chmod($f, 0600);
    echo "sign-in code saved (hashed)\n"; exit(0);
}
if ($cmd === 'dns') {
    $c = pmConn(); $d = !empty($c['email']) ? substr((string) strrchr((string) $c['email'], '@'), 1) : 'peakpickleball.us';
    $r = pmDns($d); pmW('dns.json', $r);
    echo $r['domain'], ': SPF ', $r['spf'] ? 'set' : 'MISSING', ', DKIM selector1 ', $r['dkim']['selector1'] !== '' ? 'set' : 'MISSING', ', selector2 ', $r['dkim']['selector2'] !== '' ? 'set' : 'MISSING', ', DMARC ', $r['dmarc'] ? 'set' : 'MISSING', "\n";
    foreach ($r['fix'] as $f) echo '  fix: ', $f, "\n";
    exit(0);
}
if ($cmd === 'run') exit(pmCronRun());
if ($cmd === 'stats') { echo pmStatsLine(), "\n"; exit(0); }
if ($cmd === 'import') {
    $r = pmImportSave('command line'); if (isset($r['error'])) { fwrite(STDERR, $r['error'] . "\n"); exit(1); }
    foreach ($r as $k => $d) echo $k, ': ', $d['queued'], ' queued at ', $d['orgs'], ' organisations, ', $d['held'], ' held, ', $d['left'], ' left out, ', $d['added'], " new\n",
        '  skipped: ', implode('; ', array_map(fn($x) => $x[0] . ', ' . $x[1], pmSkipList($d['skips']))) ?: 'none', "\n";
    exit(0);
}
if ($cmd === 'check') {
    $c = pmConn(); $S = pmState();
    echo 'data folder: ', pmReady() ? 'yes' : 'NO', "\n", 'app keys: ', $c['app'] ? 'yes' : 'NO', "\n", 'sign-in code set: ', is_file(pmData() . '/code.hash') ? 'yes' : 'NO', "\n",
         'Microsoft: ', $c['connected'] ? 'connected as ' . $c['email'] : ($c['status'] ?? 'not connected'), "\n", 'lists imported: ', is_file(pmData() . '/lists.json') ? 'yes' : 'no', "\n";
    foreach (PM_LISTS as $k => $n) echo $k, ': ', $S['lists'][$k]['status'], ', template ', pmIsDraft($S['templates'][$k]) ? 'DRAFT' : 'set', "\n";
    exit(0);
}
fwrite(STDERR, "usage: php cron.php run | stats | import | check | dns | setapp | setcode\n"); exit(1);

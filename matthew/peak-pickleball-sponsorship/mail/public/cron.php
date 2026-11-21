<?php
declare(strict_types=1);
/* The Peak email's command line (never a web page). The hourly SiteGround cron job (sixfold-tools/morning-email.php) starts `run` in the
   background, and the overnight check on Matthew's laptop prints `stats`.
     php cron.php run       read replies and bounce notices, then send this hour's emails (only lists Matthew started, only in the window)
     php cron.php inbox     every 5 minutes (2026-11-20, started by the 5-minute cron, sixfold-tools/meta-leads.php): Peak Partnerships' Inbox
                            onto the Peak desk's Inbox and replies onto their cards, then the desk's alerts that are due (one lock: never two reads)
     php cron.php inbox-backfill [days]   once: the emails already in Peak Partnerships' Inbox (14 days) onto the desk's Inbox; no alerts
     php cron.php stats     one line: connection, and per list: status, sent, waiting, replied, bounced, unsubscribed, clicked
     php cron.php import    bring the two lists in from the Peak desk again (a running list that gains people is paused)
     php cron.php check     what is set up (never a key, token or code)
     php cron.php dns       check SPF, DKIM and DMARC for peakpickleball.us (or the connected mailbox's domain) and save it for the page
     php cron.php links     check Peak's own link address (links.peakpickleball.us: DNS, certificate, every handler); changes nothing
     php cron.php links-on  switch every Peak link to it, only if that check passes;  links-off  back to traverseplatforms.com
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
/* Peak's own link address (X-16): links checks links.peakpickleball.us and changes nothing; links-on switches every Peak email and the
   booking page to it, only when the check passes; links-off goes back to traverseplatforms.com */
if ($cmd === 'links' || $cmd === 'links-on' || $cmd === 'links-off') {
    $show = function (array $c) { foreach ($c['lines'] as [$s, $t]) echo str_pad($s, 5), ' ', $t, "\n"; };
    if ($cmd === 'links') {
        $c = pmLinksCheck(); $show($c);
        echo 'now: ', pmLinkSet() !== '' ? 'ON, emails carry ' . pmLinkSet() : 'off, emails carry ' . pmBase(), "\n";
        echo $c['ok'] ? "All checks passed. To switch on: php cron.php links-on\n" : "Not ready: nothing changed.\n";
        exit($c['ok'] ? 0 : 1);
    }
    $r = pmLinksSwitch($cmd === 'links-on', 'command line');
    if (isset($r['check'])) $show($r['check']);
    if (!$r['ok']) { fwrite(STDERR, $r['why'] . "\n"); exit(1); }
    echo $cmd === 'links-on' ? 'ON: every new Peak email and booking link now uses ' . $r['base'] . ". Links already sent keep working.\n" : 'off: back to ' . $r['base'] . "\n";
    exit(0);
}
if ($cmd === 'run') exit(pmCronRun());
if ($cmd === 'inbox') exit(pmInboxRun());
/* the one-time fill of the desk's Inbox with what is already in Peak Partnerships' Inbox (2026-11-20): read only, no alerts; counts only */
if ($cmd === 'inbox-backfill') { $r = pmInboxBackfill((int) ($argv[2] ?? 14)); echo json_encode($r), "\n"; exit($r['error'] === '' ? 0 : 1); }
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
    /* who the emails go out as (2026-11-19): a fresh look at Peak Partnerships (read only, nothing is sent) */
    if ($c['connected']) pmFromProbe(true, $S['settings']);
    $F = pmFromStatus($S['settings']);
    echo 'sends as: ', $F['shared'] ? $F['name'] . ' <' . $F['email'] . '> (shared mailbox' . (is_array($F['access'] ?? null) ? ', opens ' . ($F['access']['ok'] ? 'fine' : 'NOT') : '') . (is_array($F['sendas'] ?? null) ? ', last send ' . ($F['sendas']['ok'] ? 'ok' : 'REFUSED') : '') . ')' : 'the connected mailbox', "\n";
    if ($F['warn'] !== '') echo '  ', $F['warn'], "\n";
    echo 'links: ', pmLinkSet() !== '' ? 'on, ' . pmLinkSet() : 'off (traverseplatforms.com)', "
";
    foreach (PM_LISTS as $k => $n) echo $k, ': ', $S['lists'][$k]['status'], ', template ', pmIsDraft($S['templates'][$k]) ? 'DRAFT' : 'set', "\n";
    exit(0);
}
fwrite(STDERR, "usage: php cron.php run | inbox | stats | import | check | dns | setapp | setcode\n"); exit(1);

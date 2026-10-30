<?php
declare(strict_types=1);
/**
 * Client installs made on the server, from the command line (2026-10-29). Copied to traverse-tools/clients.php by build-editions.cjs.
 *   php traverse-tools/clients.php list              every client: id, status, edition, plan, towns, homes, address of its app
 *   php traverse-tools/clients.php regen [id]        remake each client's page folder and API files from its edition's template
 *                                                    (deploy-app.sh runs this after every deploy, so clients get every fix with the editions)
 *   php traverse-tools/clients.php relink [id]       link each client's towns again (new towns in its radius appear) and send the reminders to
 *                                                    companies that paid but never filled in the welcome page. Cron, once a day:
 *                                                    30 4 * * *  php /home/customer/www/traverseplatforms.com/traverse-tools/clients.php relink
 *   php traverse-tools/clients.php area <id> <miles> [<lat> <lon> <state>]   change a client's radius (or place it by hand), then relink
 *   php traverse-tools/clients.php setup <file with the whsec_ secret>        make traverse-shared/clients/billing-config.php from TraverseRoofing's
 *                                                    own (the same live keys and prices) with the central webhook's signing secret; prints no key
 *   php traverse-tools/clients.php check             templates, config and registry in order? (exit 1 if not)
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$_SERVER['SCRIPT_FILENAME'] = __FILE__;
require dirname(__DIR__) . '/public_html/api/traverse-clients-lib.php';
$cmd = $argv[1] ?? 'list'; $arg = $argv[2] ?? '';
$only = fn() => $arg !== '' ? array_intersect_key(tcReg(), [$arg => 1]) : tcReg();
switch ($cmd) {
    case 'list':
        foreach (tcReg() as $cid => $e) {
            $b = tcJson(tcSite() . '/' . $e['data'] . '/rounds/billing.json'); $a = (array) ($e['area'] ?? []);
            printf("%s  %-8s %-9s %-26s %-5s %-5s %s/%s  towns %d, homes %d (%s, %d mi)  %s\n", $cid, $e['status'] ?? '?', $e['edition'], mb_substr((string) $e['name'], 0, 26),
                $b['plan'] ?? $e['plan'] ?? '?', $b['interval'] ?? '', $b['status'] ?? '?', empty($b['live_at']) ? 'not live' : 'live', (int) ($a['towns'] ?? 0), (int) ($a['doors'] ?? 0), $a['status'] ?? '?', (int) ($a['miles'] ?? 0), $e['url']);
        }
        $n = 0; foreach (glob(tcDir() . '/pending/c*.json') ?: [] as $f) { $p = tcJson($f); if (!empty($p['paid_at']) && empty($p['provisioned_at'])) { $n++; echo ($p['cid'] ?? '?') . "  PAID, welcome page not filled in yet (" . ($p['email'] ?? '') . ', ' . date('Y-m-d H:i', (int) $p['paid_at']) . ")\n"; } }
        exit(0);
    case 'regen':
        $bad = 0;
        foreach ($only() as $cid => $e) { if (($e['status'] ?? '') !== 'live') continue; $r = tcRender($e); echo $cid . ' ' . (isset($r['error']) ? 'FAILED: ' . $r['error'] : 'ok, ' . $r['written'] . ' files changed') . "\n"; if (isset($r['error'])) $bad++; }
        exit($bad ? 1 : 0);
    case 'relink':
        foreach ($only() as $cid => $e) { if (($e['status'] ?? '') !== 'live') continue; $lk = tcLock((string) $cid); $r = tcLinkTowns((string) $cid); if ($lk) { flock($lk, LOCK_UN); fclose($lk); }
            echo $cid . ' ' . (isset($r['error']) ? 'FAILED: ' . $r['error'] : $r['status'] . ', ' . $r['towns'] . ' towns, ' . $r['doors'] . ' homes, ' . $r['made'] . ' new links, ' . $r['removed'] . ' removed' . ($r['failed'] ? ', ' . $r['failed'] . ' FAILED' : '') . ($r['unknownKinds'] ? ', not linked (new kinds): ' . implode(' ', $r['unknownKinds']) : '')) . "\n"; }
        if ($arg === '') echo 'reminders sent: ' . tcRemind() . "\n";
        exit(0);
    case 'link':   /* one company's towns now, made or not yet made (the welcome page's area step does this by itself) */
        if (!tcCidOk($arg)) { fwrite(STDERR, "usage: clients.php link <id>\n"); exit(1); }
        $lk = tcLock($arg); $r = tcLinkTowns($arg); echo json_encode($r) . "\n"; exit(isset($r['error']) ? 1 : 0);
    case 'area':
        $e = tcReg()[$arg] ?? null; $mi = (int) ($argv[3] ?? 0);
        if (!$e || $mi < 1 || $mi > 150) { fwrite(STDERR, "usage: clients.php area <id> <miles> [<lat> <lon> <state>]\n"); exit(1); }
        tcRegSave(function ($all) use ($arg, $mi, $argv) { $all[$arg]['area']['miles'] = $mi; if (isset($argv[6])) { $all[$arg]['area']['lat'] = (float) $argv[4]; $all[$arg]['area']['lon'] = (float) $argv[5]; $all[$arg]['area']['state'] = strtoupper($argv[6]); } return $all; });
        $r = tcLinkTowns($arg); echo json_encode($r) . "\n"; exit(isset($r['error']) ? 1 : 0);
    case 'setup':
        $sec = trim((string) @file_get_contents($arg));
        if (!preg_match('/^whsec_[A-Za-z0-9]{10,}$/D', $sec)) { fwrite(STDERR, "give a file holding the endpoint's whsec_ signing secret\n"); exit(1); }
        $src = tcSite() . '/traverse-private/billing-config.php';
        $c = (array) (function ($f) { return require $f; })($src);
        if (empty($c['secret_key']) || empty($c['prices'])) { fwrite(STDERR, "TraverseRoofing's billing-config.php has no keys or prices\n"); exit(1); }
        $c['install'] = 'site'; $c['webhook_secret'] = $sec; $c['return_url'] = ''; unset($c['mock_file']);
        $out = tcDir() . '/billing-config.php';
        if (is_file($out)) copy($out, $out . '.before-' . date('Ymd-His'));
        tcWrite($out, "<?php\n/* the website's checkout and every client install made on the server (2026-10-29): TraverseRoofing's Stripe keys and prices, the central\n   webhook's signing secret (api/traverse-hook.php). Made by traverse-tools/clients.php setup. Never in git, never in public_html. */\nreturn " . var_export($c, true) . ";\n", 0600);
        echo "wrote traverse-shared/clients/billing-config.php (" . (str_contains((string) $c['secret_key'], '_live_') ? 'LIVE' : 'TEST') . " keys, " . count((array) $c['prices']) . " prices)\n"; exit(0);
    case 'check':
        $ok = true;
        foreach (array_keys(TC_EDITIONS) as $ed) { $j = tcJson(tcTplDir($ed) . '/edition.json'); $miss = array_filter(array_merge(TC_PAGE_FILES, array_map(fn($k) => 'api-' . $k . '.php', TC_API_FILES)), fn($f) => !is_file(tcTplDir($ed) . '/' . $f));
            echo "template $ed: " . (!$j ? 'MISSING' : ($miss ? 'missing ' . implode(' ', $miss) : 'ok, built ' . $j['built'])) . "\n"; if (!$j || $miss) $ok = false; }
        echo 'shared config: ' . (tcBilling() ? 'ok' : 'MISSING (clients.php setup)') . "\n"; if (!tcBilling()) $ok = false;
        foreach (tcReg() as $cid => $e) if (($e['status'] ?? '') === 'live' && !is_file(tcPub() . '/api/' . $e['api'] . '-rounds.php')) { echo "$cid: API file MISSING\n"; $ok = false; }
        exit($ok ? 0 : 1);
}
fwrite(STDERR, "commands: list, regen, relink, area, setup, check\n"); exit(1);

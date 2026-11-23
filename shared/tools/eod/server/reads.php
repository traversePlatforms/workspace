<?php
declare(strict_types=1);
/* The rest of the weekly business report's server numbers (shared/tools/eod/weekly.mjs, 2026-11-23). READ ONLY: it opens files to read
 * them and asks the existing read commands; it writes nothing, sends nothing, and changes no setting. Not installed on the server:
 *   bash ~/jarvis/bin/sg.sh trav 'php -- <this-week-start> <this-week-end>' < shared/tools/eod/server/reads.php
 * Prints ONE JSON object of counts only (no names, addresses, emails or keys). Each part is on its own: one that fails says why and the
 * others still answer.
 *   sites      site analytics (shared/site-analytics): Traverse from this server's own data, Sixfold 365 (365aeration.com) through the same
 *              signed report request report.php --line makes; daily visitors, views and conversion events, and conversions by kind
 *   demos      Traverse demo bookings (traverse-site-private/bookings.json, written by the website's /demo/ page): booked per week, by the
 *              day they were made; cancelled ones counted apart
 *   installs   Traverse paying installs: every install's billing.json (written by Stripe's webhooks) and the website sign-up registry
 *              (traverse-shared/clients/registry.json): counts by status only
 *   prospects  the Traverse Prospect Desk's events.log: sent, bounced, unsubscribed, clicked, new leads, status changes, per week
 *   peakmail   the Peak outreach sender's events.log (peak-mail-data, the same rows cron.php stats counts): per week, per list
 *   peakdesk   the Peak sponsor desk's own counts (php desk.php check: companies and stages per pipeline, tours) */
if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Denver');
$a0 = (string) ($argv[1] ?? ''); $a1 = (string) ($argv[2] ?? '');
if (!preg_match('/^\d{4}-\d\d-\d\d$/', $a0) || !preg_match('/^\d{4}-\d\d-\d\d$/', $a1)) { echo json_encode(['ok' => false, 'error' => 'usage: php -- <start> <end>']), "\n"; exit(1); }
$S = getenv('HOME') . '/www/traverseplatforms.com';
$tz = new DateTimeZone('America/Denver');
$t0 = (new DateTime($a0 . ' 00:00', $tz))->getTimestamp(); $t1 = (new DateTime($a1 . ' 00:00', $tz))->modify('+1 day')->getTimestamp(); $l0 = $t0 - 7 * 86400;
$wk = fn(int $t) => $t >= $t0 && $t < $t1 ? 'this' : ($t >= $l0 && $t < $t0 ? 'last' : '');
$lastFrom = date('Y-m-d', $l0); $lastTo = date('Y-m-d', $t0 - 1);
$O = ['ok' => true, 'at' => time(), 'weeks' => ['this' => [$a0, $a1], 'last' => [$lastFrom, $lastTo]]];
$part = function (string $k, callable $f) use (&$O) { try { $O[$k] = $f(); } catch (Throwable $e) { $O[$k] = ['error' => mb_substr($e->getMessage(), 0, 160)]; } };
$jsonl = function (string $f): Generator { $fh = @fopen($f, 'r'); if (!$fh) return; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) yield $r; } fclose($fh); };

/* sites */
$part('sites', function () use ($S, $a0, $a1, $lastFrom, $lastTo) {
    $lib = $S . '/site-analytics/lib.php'; if (!is_file($lib)) return ['error' => 'site analytics not installed'];
    require_once $lib;
    $C = svCfg(); $o = [];
    $sumSeries = function (array $series, string $f, string $t) { $x = ['visitors' => 0, 'views' => 0, 'convEvents' => 0, 'days' => 0];
        foreach ($series as [$d, $v, $pv, $cv]) if ($d >= $f && $d <= $t) { $x['visitors'] += $v; $x['views'] += $pv; $x['convEvents'] += $cv; $x['days']++; } return $x; };
    $conv = fn(array $s) => array_combine(array_column($s['conversions'], 0), array_map(fn($c) => ['events' => $c[1], 'visitors' => $c[2]], $s['conversions'])) ?: [];
    /* this server's site: any range, straight from its data */
    $sm = fn(array $x) => ['visitors' => $x['visitors'], 'views' => $x['views'], 'convVisitors' => $x['conv_visitors'], 'conversions' => $conv($x)];
    $o[(string) $C['site']] = ['label' => (string) $C['label'], 'this' => $sm(svSummary($a0, $a1)), 'last' => $sm(svSummary($lastFrom, $lastTo)), 'how' => 'own data'];
    /* the remotes (365aeration.com): the signed report request report.php makes; it answers today, the last 7 days and a 30-day series */
    foreach ((array) $C['remotes'] as $r) {
        $ch = curl_init((string) $r['url'] . '?a=report');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['X-SV-Key: ' . (string) $r['key'], 'User-Agent: site-stats']]);
        $j = json_decode((string) curl_exec($ch), true); curl_close($ch);
        if (!is_array($j) || empty($j['ok'])) { $o[(string) $r['label']] = ['label' => (string) $r['label'], 'error' => 'report not reachable']; continue; }
        $ser = (array) ($j['series'] ?? []);
        $tw = $sumSeries($ser, $a0, $a1); $lw = $sumSeries($ser, $lastFrom, $lastTo);
        $x = ['label' => (string) $j['label'], 'this' => ['visitors' => $tw['visitors'], 'views' => $tw['views'], 'convEvents' => $tw['convEvents']], 'last' => ['visitors' => $lw['visitors'], 'views' => $lw['views'], 'convEvents' => $lw['convEvents']], 'how' => 'remote 30-day series', 'seriesDays' => count($ser)];
        /* by kind only when its 7-day range is exactly this week (the run's end day is today) */
        if (($j['today'] ?? '') === $a1 && isset($j['ranges']['7'])) { $x['this']['conversions'] = $conv($j['ranges']['7']); $x['this']['convVisitors'] = (int) $j['ranges']['7']['conv_visitors']; }
        $o[(string) $j['site']] = $x;
    }
    return $o;
});

/* demos */
$part('demos', function () use ($S, $wk) {
    $f = $S . '/traverse-site-private/bookings.json'; if (!is_file($f)) return ['error' => 'no bookings file'];
    $all = json_decode((string) file_get_contents($f), true); if (!is_array($all)) return ['error' => 'bookings file unreadable'];
    $o = ['this' => ['booked' => 0, 'cancelled' => 0], 'last' => ['booked' => 0, 'cancelled' => 0], 'allTime' => count($all)];
    foreach ($all as $b) { $k = $wk((int) ($b['at'] ?? 0)); if ($k === '') continue; $o[$k]['booked']++; if (!empty($b['cancelled_at']) || ($b['status'] ?? '') === 'cancelled') $o[$k]['cancelled']++; }
    return $o;
});

/* installs */
$part('installs', function () use ($S, $wk) {
    $st = []; $paidWeek = ['this' => 0, 'last' => 0]; $n = 0;
    foreach (glob($S . '/*-data/rounds/billing.json') ?: [] as $f) {
        $b = json_decode((string) file_get_contents($f), true); if (!is_array($b)) continue; $n++;
        $s = (string) ($b['status'] ?? 'unknown'); $st[$s] = ($st[$s] ?? 0) + 1;
        if (!empty($b['paid_at']) && ($k = $wk((int) $b['paid_at'])) !== '') $paidWeek[$k]++;
    }
    $reg = json_decode((string) @file_get_contents($S . '/traverse-shared/clients/registry.json'), true);
    $rc = is_array($reg) ? (isset($reg['clients']) && is_array($reg['clients']) ? $reg['clients'] : $reg) : [];
    $rs = []; foreach ($rc as $c) if (is_array($c)) { $s = (string) ($c['status'] ?? 'unknown'); $rs[$s] = ($rs[$s] ?? 0) + 1; }
    return ['billingFiles' => $n, 'byStatus' => $st, 'firstPaid' => $paidWeek, 'websiteSignups' => count(array_filter($rc, 'is_array')), 'signupsByStatus' => $rs];
});

/* prospects */
$part('prospects', function () use ($S, $wk, $jsonl) {
    $f = $S . '/traverse-prospects-data/events.log'; if (!is_file($f)) return ['error' => 'no events.log'];
    $keep = ['sent', 'bounce', 'unsub', 'click', 'lead', 'status', 'queued', 'sendfail'];
    $o = ['this' => array_fill_keys($keep, 0), 'last' => array_fill_keys($keep, 0)]; $last = 0;
    foreach ($jsonl($f) as $r) { $t = (string) ($r['t'] ?? ''); $at = (int) ($r['at'] ?? 0); $last = max($last, $at); if (!in_array($t, $keep, true)) continue; $k = $wk($at); if ($k !== '') $o[$k][$t]++; }
    $o['lastEventDay'] = $last ? date('Y-m-d', $last) : '';
    return $o;
});

/* peakmail */
$part('peakmail', function () use ($S, $wk, $jsonl) {
    $f = $S . '/peak-mail-data/events.log'; if (!is_file($f)) return ['error' => 'no events.log'];
    $keep = ['sent', 'reply', 'bounce', 'unsub', 'open', 'click', 'booked', 'fail'];
    $z = fn() => array_fill_keys($keep, 0);
    $o = ['this' => $z(), 'last' => $z(), 'byList' => [], 'firstSentDay' => '']; $seen = []; $first = 0; $listOf = [];
    foreach ($jsonl($f) as $r) {
        $t = (string) ($r['t'] ?? ''); if (!in_array($t, $keep, true)) continue;
        $at = (int) ($r['at'] ?? 0); $to = strtolower((string) ($r['to'] ?? '')); if ($t === 'sent') { $first = $first ?: $at; $listOf[$to] = (string) ($r['l'] ?? ''); }
        if ($t === 'fail' && empty($r['final'])) continue;   /* a retry is not a failure */
        if (in_array($t, ['open', 'click', 'reply'], true)) { if (isset($seen[$t][$to])) continue; $seen[$t][$to] = 1; }   /* people, not hits: the first open, click or reply */
        $k = $wk($at); if ($k === '') continue;
        $o[$k][$t]++; $l = $t === 'sent' ? (string) ($r['l'] ?? '') : ($listOf[$to] ?? ''); if ($l !== '') { $o['byList'][$l][$k][$t] = ($o['byList'][$l][$k][$t] ?? 0) + 1; }
    }
    $o['firstSentDay'] = $first ? date('Y-m-d', $first) : '';
    return $o;
});

/* peakdesk */
$part('peakdesk', function () use ($S) {
    $d = $S . '/public_html/peak-desk-28d38d/api'; if (!is_file($d . '/desk.php')) return ['error' => 'desk not found'];
    $out = []; exec('cd ' . escapeshellarg($d) . ' && ' . escapeshellarg(PHP_BINARY) . ' desk.php check 2>/dev/null', $out, $rc);
    $j = json_decode(implode("\n", $out), true); if ($rc !== 0 || !is_array($j)) return ['error' => 'desk.php check did not answer'];
    $o = []; foreach ($j as $w => $x) $o[$w] = array_intersect_key((array) $x, ['companies' => 1, 'removed' => 1, 'stages' => 1, 'tours' => 1, 'touches' => 1, 'owned' => 1]);
    return $o;
});

echo json_encode($O, JSON_UNESCAPED_SLASHES), "\n";

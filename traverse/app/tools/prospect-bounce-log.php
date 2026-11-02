<?php
/* Prospect Desk bounces, step 2 (hourly since 2 Nov): log the Traverse-inbox bounce notices on the Prospect Desk (t:bounce, as the 1 Nov ones), matched by email address; skip any
   already marked. Stdin: bounce-scan JSON lines. Run from the desk's api folder after backing up events.log. Prints counts + company names. */
$in = stream_get_contents(STDIN);
register_shutdown_function(function () use ($in) {
    $S = state(); $byMail = [];
    foreach ($S['leads'] as $id => $l) if (!empty($l['email'])) $byMail[strtolower(trim((string) $l['email']))][] = $id;
    $add = []; $out = ['logged' => [], 'already' => 0, 'not on desk' => []];
    foreach (preg_split('/\r?\n/', trim($in)) as $line) {
        $r = json_decode($line, true); if (!$r || empty($r['to'])) continue;
        $ids = $byMail[$r['to']] ?? []; if (!$ids) { $out['not on desk'][] = $r['to']; continue; }
        foreach ($ids as $id) {
            if (($S['leads'][$id]['emailOk'] ?? '') === 'no') { $out['already']++; continue; }
            $add[] = json_encode(['t' => 'bounce', 'id' => $id, 'to' => $r['to'], 'by' => 'Claude 2 Nov (bounce notices in the Traverse inbox: ' . $r['why'] . ')', 'at' => time()], JSON_UNESCAPED_SLASHES);
            $out['logged'][] = $S['leads'][$id]['name'] . ' (' . $r['why'] . ')';
        }
    }
    if ($add) file_put_contents(DATA_DIR . '/events.log', implode("\n", $add) . "\n", FILE_APPEND | LOCK_EX);
    $q = json_decode((string) file_get_contents(DATA_DIR . '/queue.json'), true) ?: []; $bad = 0; $S2 = state();
    foreach ($q as $m) if (($S2['leads'][$m['id']]['emailOk'] ?? '') === 'no') $bad++;
    $out['still in the queue for a bounced company'] = $bad;
    echo date('Y-m-d H:i'), ' ', json_encode(['logged' => $out['logged'], 'already' => $out['already'], 'not on desk' => count($out['not on desk'])], JSON_UNESCAPED_SLASHES), "\n";
});
$argv = ['desk.php']; include 'desk.php';

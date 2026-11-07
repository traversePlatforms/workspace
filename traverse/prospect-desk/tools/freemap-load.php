<?php
/* The free-map send (Matthew 6 Nov 2026: "go ahead and start when its ready"; paced, not all at once). Run on the server:
     php freemap-load.php dry <payload.json>    count and show samples, change nothing
     php freemap-load.php go  <payload.json>    add batch 1's companies to the desk, queue every message with its 'after' time
   Uses the desk's own code (state, noMail, firstName, unsubUrl, logAdd, jread/jwrite) so messages match what the desk sends.
   Batch 1: 11 new companies, Mon 9 Nov from 9:00 MT, then follow-ups Thu 12 Nov and Thu 19 Nov (only while still "Emailed").
   Batch 2: everyone already emailed whose town has a map, one note each, weekdays from Thu 19 Nov (not 26-27 Nov), 100 a day,
   8:30 am to 4:30 pm MT, young companies first, lawn and roofing alternating. */
$home = getenv('HOME');
$api = "$home/www/traverseplatforms.com/public_html/prospects-47bfe6/api/desk.php";
putenv("DESK_DATA=$home/www/traverseplatforms.com/traverse-prospects-data");
$_SERVER['HTTP_HOST'] = 'traverseplatforms.com'; $_SERVER['HTTPS'] = 'on'; $_SERVER['SCRIPT_NAME'] = '/prospects-47bfe6/api/desk.php';
$src = file_get_contents($api); $cut = strpos($src, '/* ---- the command line');
if ($cut === false) exit("desk.php layout changed: stopping\n");
eval(substr($src, 5, $cut - 5));   // everything before the command line and the web router: constants and functions only
/* desk.php defines unsubUrl() after the command line block; the same one line, from functions loaded above */
if (!function_exists('unsubUrl')) { function unsubUrl(string $id): string { return deskOrigin() . $_SERVER['SCRIPT_NAME'] . '?action=unsub&id=' . $id . '&t=' . unsubToken($id); } }

[$mode, $pf] = [$argv[1] ?? 'dry', $argv[2] ?? ''];
$P = json_decode((string) file_get_contents($pf), true); if (!$P) exit("no payload\n");
$BY = "Claude (Matthew's go, 6 Nov)";
$TZ = new DateTimeZone('America/Denver');
$ts = fn(string $s) => (new DateTime($s, $TZ))->getTimestamp();
$stats = $P['stats'];

function msgFor(array $l, array $stats): ?array {
    $tr = $l['trade'] === 'yards' ? 'lawn' : ($l['trade'] === 'roofing' ? 'roofing' : null); if (!$tr) return null;
    $s = $stats[$tr . '|' . strtolower(trim((string) $l['city']))] ?? null; if (!$s) return null;
    $city = $s['label']; $first = firstName((string) ($l['person'] ?? '')) ?: 'there';
    $n = number_format((int) $s['n']); $h = number_format((int) $s['homes']);
    if ($tr === 'lawn') return ['subject' => "$city lawn map", 'first' => $first, 'city' => $city, 'main' => "Hi $first,\n\nI mapped $h homes in $city and found $n with lawns over 5,000 sq ft. The biggest cluster is on {$s['street']}.\n\nI put the best streets for lawn care on a one-page map. Want me to send you the $city one? It's free."];
    return ['subject' => "hail map for $city", 'first' => $first, 'city' => $city, 'main' => "Hi $first,\n\nRadar put hail an inch or larger over $n homes in $city in the last {$s['window']}. {$s['street']} had the most.\n\nI put the hardest-hit streets on a one-page map. Want me to send you the $city one? It's free."];
}
function wrap(array $l, string $subject, string $main, array $set, int $after, string $batch, bool $fu, string $by): array {
    $u = unsubUrl((string) $l['id']);
    $body = rtrim($main) . "\n\n" . trim((string) $set['signature']) . (trim((string) $set['address']) !== '' ? "\n" . trim((string) $set['address']) : '') . "\n\nUnsubscribe: " . $u;
    return ['id' => $l['id'], 'to' => (string) $l['email'], 'subject' => $subject, 'body' => $body, 'style' => 'plain', 'unsub' => $u, 'by' => $by, 'at' => time(),
        'after' => $after, 'batch' => $batch] + ($fu ? ['followup' => 1] : []);
}

$S = state(); $set = $S['settings'];
if (trim((string) $set['address']) === '') exit("no postal address in the desk settings: stopping\n");
$queuedIds = array_flip(array_column(jread('queue.json', []), 'id'));

/* batch 1: add the companies (a 'lead' event, the desk's own way), then three messages each */
$add = []; foreach ($P['batch1'] as $l) if (!isset($S['leads'][$l['id']])) $add[] = $l;
if ($mode === 'go') { foreach ($add as $l) logAdd(['t' => 'lead', 'id' => $l['id'], 'lead' => $l, 'by' => $BY, 'at' => time()]); $S = state(); }
else foreach ($add as $l) $S['leads'][$l['id']] = $l + ['status' => 'new', 'unsub' => false, 'person' => '', 'sent' => [], 'reached' => []];
$out = []; $b1ids = [];
foreach (array_values($P['batch1']) as $i => $l0) {
    $l = $S['leads'][$l0['id']]; if (noMail($l) !== '' || isset($queuedIds[$l['id']])) continue;
    $m = msgFor($l, $stats); if (!$m) continue; $b1ids[$l['id']] = 1;
    $out[] = wrap($l, $m['subject'], $m['main'], $set, $ts('2026-11-09 09:00') + $i * 480, 'freemap-b1', false, $BY);
    $out[] = wrap($l, $m['subject'], "Hi {$m['first']}, bumping this in case it got buried. Happy to send the {$m['city']} map over, it only takes me a minute. Want it?", $set, $ts('2026-11-12 09:00') + $i * 480, 'freemap-b1-fu1', true, $BY);
    $out[] = wrap($l, $m['subject'], "Hi {$m['first']}, last note from me. If a map of your best streets would help for next season, just reply \"map\" and I'll send it. If not, no worries, I won't email again.", $set, $ts('2026-11-19 08:00') + $i * 300, 'freemap-b1-fu2', true, $BY);
}
$n1 = count($out);

/* batch 2: already emailed, nothing since that stops mail, the town has a map */
$pool = [];
foreach ($S['leads'] as $id => $l) {
    if (isset($b1ids[$id]) || isset($queuedIds[$id]) || empty($l['sent'])) continue;
    if (noMail($l) !== '' || !in_array($l['status'], ['emailed', 'called', 'nextdoor'], true)) continue;   // talking, demo, pilot, no, not now: left alone
    if (!($m = msgFor($l, $stats))) continue;
    $pool[] = ['l' => $l, 'm' => $m, 'young' => (int) substr((string) $l['formed'], 0, 4) >= 2016 ? 1 : 0, 'score' => (float) ($l['score'] ?? 0)];
}
usort($pool, fn($a, $b) => [$b['young'], $b['score']] <=> [$a['young'], $a['score']]);
$lawn = array_values(array_filter($pool, fn($p) => $p['l']['trade'] === 'yards')); $roof = array_values(array_filter($pool, fn($p) => $p['l']['trade'] !== 'yards'));
$mix = []; for ($i = 0; $i < max(count($lawn), count($roof)); $i++) { if (isset($lawn[$i])) $mix[] = $lawn[$i]; if (isset($roof[$i])) $mix[] = $roof[$i]; }
$days = []; $d = new DateTime('2026-11-19', $TZ);
while (count($days) * 100 < count($mix)) { $ymd = $d->format('Y-m-d'); if ((int) $d->format('N') <= 5 && !in_array($ymd, ['2026-11-26', '2026-11-27'], true)) $days[] = $ymd; $d->modify('+1 day'); }
foreach ($mix as $k => $p) { $day = $days[intdiv($k, 100)]; $slot = $k % 100;
    $out[] = wrap($p['l'], $p['m']['subject'], $p['m']['main'], $set, $ts("$day 08:30") + (int) round($slot * 288), 'freemap-b2', false, $BY); }

/* report (addresses shown by domain only) */
$by = []; foreach ($out as $m) $by[$m['batch']] = ($by[$m['batch']] ?? 0) + 1;
echo "mode: $mode\nbatch 1 companies added to the desk: " . count($add) . "\nmessages: " . count($out) . ' ' . json_encode($by) . "\n";
echo "batch 2: lawn " . count($lawn) . ", roofing " . count($roof) . ", days " . count($days) . ' (' . ($days[0] ?? '-') . ' to ' . (end($days) ?: '-') . ")\n";
$fmt = fn($t) => (new DateTime('@' . $t))->setTimezone($TZ)->format('D j M g:i a');
foreach (['freemap-b1', 'freemap-b2'] as $b) { $ms = array_values(array_filter($out, fn($m) => $m['batch'] === $b)); if (!$ms) continue;
    echo "\n== $b: first " . $fmt($ms[0]['after']) . ', last ' . $fmt(end($ms)['after']) . "\nSAMPLE to @" . explode('@', $ms[0]['to'])[1] . "\nSubject: {$ms[0]['subject']}\n" . preg_replace('/(Unsubscribe: ).*/', '$1[link]', $ms[0]['body']) . "\n"; }
if ($mode !== 'go') exit(0);

/* queue: under the same lock the desk uses, after a copy of the files */
$bk = "$home/upload-backups/freemap-before-" . date('Ymd-His');
@mkdir($bk, 0700, true); copy(DATA_DIR . '/queue.json', "$bk/queue.json"); copy(DATA_DIR . '/events.log', "$bk/events.log");
$lk = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($lk, LOCK_EX);
$Q = jread('queue.json', []); foreach ($out as $m) $Q[] = $m; jwrite('queue.json', $Q); flock($lk, LOCK_UN);
logAdd(['t' => 'queued', 'n' => count($out), 'style' => 'plain', 'maps' => 0, 'note' => 'free-map batches 1 and 2, timed (after)', 'by' => $BY, 'at' => time()]);
echo "\nQUEUED " . count($out) . " (waiting now: " . count($Q) . "). Backup: $bk\n";

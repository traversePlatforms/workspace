<?php
/* The practice copy's seed, moved into the past (2026-11-02): the board only books today or later, so practice-seed.mjs books the done jobs a few
 * days ahead and this moves each one, with its lead, its customer and every time on them, to N days ago. Made-up rows only: it refuses any
 * folder that is not a sixfold-practice-data folder.
 *   php practice-backdate.php <sixfold-practice-data dir> '{"j1515621a3840":21, ...}'      (the BACKDATE line practice-seed.mjs prints) */
if (PHP_SAPI !== 'cli') exit;
[$me, $dir, $map] = array_pad($argv, 3, '');
if (!preg_match('#sixfold-practice-data/?$#', str_replace('\\', '/', $dir)) || !is_dir("$dir/rounds")) { fwrite(STDERR, "usage: practice-backdate.php <sixfold-practice-data dir> '<json>'\n"); exit(1); }
$want = json_decode($map, true); if (!is_array($want) || !$want) { fwrite(STDERR, "no jobs given\n"); exit(1); }
$tz = new DateTimeZone('America/Denver');
$rows = fn($f) => is_file($f) ? array_values(array_filter(array_map(fn($l) => json_decode($l, true), file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)), 'is_array')) : [];
$save = function ($f, $rs) { $t = $f . '.tmp'; file_put_contents($t, implode('', array_map(fn($r) => json_encode($r, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", $rs))); rename($t, $f); };
$shift = function (&$v, int $d) use (&$shift) { if (!is_array($v)) return; foreach ($v as $k => &$x) { if ($k === 'at' && is_int($x)) $x += $d; elseif (is_array($x)) $shift($x, $d); } unset($x); };
$jobs = $rows("$dir/rounds/jobs.log"); $delta = []; $leadDelta = []; $newDate = [];
foreach ($jobs as $r) {
    $id = (string) ($r['id'] ?? ''); if (!isset($want[$id]) || isset($delta[$id]) || empty($r['date']) || empty($r['lead'])) continue;
    $d = new DateTime('today', $tz); $d->modify('-' . (int) $want[$id] . ' days'); if ($d->format('w') === '0') $d->modify('-1 day');   /* never a Sunday */
    $delta[$id] = $d->getTimestamp() - (new DateTime($r['date'], $tz))->getTimestamp(); $newDate[$id] = $d->format('Y-m-d'); $leadDelta[(string) $r['lead']] = $delta[$id];
}
foreach ($want as $id => $n) if (!isset($delta[$id])) { fwrite(STDERR, "no job $id\n"); exit(1); }
foreach ($jobs as &$r) { $id = (string) ($r['id'] ?? ''); if (!isset($delta[$id])) continue; $shift($r, $delta[$id]); if (isset($r['date'])) $r['date'] = $newDate[$id]; }
unset($r); $save("$dir/rounds/jobs.log", $jobs);
foreach (["$dir/leads/leads.log", "$dir/leads/leadst.log", "$dir/customers/customers.log"] as $f) {
    $rs = $rows($f); $n = 0;
    foreach ($rs as &$r) {
        $l = (string) ($r['lead'] ?? $r['f']['lead'] ?? $r['id'] ?? ''); if (!isset($leadDelta[$l])) continue;
        $shift($r, $leadDelta[$l]); $n++;
        if (isset($r['f']['start']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $r['f']['start'])) $r['f']['start'] = date('Y-m-d', strtotime($r['f']['start'] . ' 12:00') + $leadDelta[$l]);   /* a customer's start day */
    }
    unset($r); $save($f, $rs); echo basename($f), ": $n rows moved\n";
}
foreach ($newDate as $id => $d) echo "$id -> $d\n";

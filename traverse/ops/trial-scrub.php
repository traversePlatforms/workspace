<?php
/* Remove the 2026-10-10 live-trial rows (Matthew's request: trial accounts used as real users, then cleaned up).
 * Door logs: lines naming a trial account. Result / roof-job logs: lines Claude Check wrote during the trial window.
 * Every touched file is copied to ~/upload-backups/trial-scrub-2026-10-10/ first; each is rewritten whole (temp + rename).
 * Usage: php trial-scrub.php [--dry] */
$dry = in_array('--dry', $argv, true);
$site = getenv('HOME') . '/www/traverseplatforms.com';
$bak = getenv('HOME') . '/upload-backups/trial-scrub-2026-10-10';
$from = strtotime('2026-10-10 18:30:00 America/Denver');
$names = ['Trial Crew A', 'Trial Crew B', 'Trial Manager', 'Trial Team'];
$named = function (string $line) use ($names): bool { foreach ($names as $n) if (strpos($line, $n) !== false) return true; return false; };
$total = 0;
foreach (glob($site . '/*-data/rounds', GLOB_ONLYDIR) as $dir) {
  $rel = substr($dir, strlen($site) + 1);
  $jobs = [];
  foreach (['marks', 'phones', 'notes', 'dassign'] as $k) $jobs[$dir . "/$k-monument.log"] = 'named';
  $jobs[$dir . '/calendar.log'] = 'named';
  foreach (['result', 'roofjob'] as $k) $jobs[$dir . "/$k-monument.log"] = 'admin';
  foreach ($jobs as $f => $how) {
    if (!is_file($f)) continue;
    $lines = file($f); $keep = []; $drop = 0;
    foreach ($lines as $l) {
      $j = json_decode($l, true);
      $gone = $how === 'named' ? $named($l)
            : (is_array($j) && ($j['by'] ?? '') === 'Claude Check' && (int) ($j['at'] ?? 0) >= $from);
      if ($gone) $drop++; else $keep[] = $l;
    }
    if (!$drop) continue;
    echo "$rel/" . basename($f) . ": " . count($lines) . " lines, removing $drop\n";
    $total += $drop;
    if ($dry) continue;
    @mkdir($bak . '/' . $rel, 0700, true);
    if (!copy($f, $bak . '/' . $rel . '/' . basename($f))) { echo "  backup failed, skipped\n"; continue; }
    $tmp = $f . '.scrub' . getmypid();
    if (file_put_contents($tmp, implode('', $keep)) === false || !rename($tmp, $f)) { @unlink($tmp); echo "  write failed, file left as it was\n"; }
  }
}
echo ($dry ? 'would remove ' : 'removed ') . "$total lines\n";

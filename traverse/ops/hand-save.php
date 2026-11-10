<?php
/* a hand measurement Matthew sent in chat, saved as the app's "Measured it by hand" would save it (lawnhand-<region>.log, latest row wins) */
[$_, $addr, $sq, $incl, $note] = $argv; $R = getenv('HOME') . '/www/traverseplatforms.com/sixfold-data/rounds';
/* every home (2026-11-10, Matthew: "make it so the save tool can apply to all homes"): a door on the lists first, else a home not on them
   (search-index row marked L: rented or owner elsewhere), whose hand measure the app reads from the same lawnhand-<town>.log (houseFacts) */
$hit = null; $lk = null; $fh = fopen("$R/search-index.txt", 'r'); while (($l = fgets($fh)) !== false) { $p = explode("\t", rtrim($l, "\n")); if (($p[4] ?? '') !== strtoupper($addr)) continue; if (($p[9] ?? '') !== 'L') { $hit = $p; break; } if (!$lk) $lk = $p; } fclose($fh);
if (!$hit) $hit = $lk;
if (!$hit) { echo "not found: $addr\n"; exit(1); }
[$region, $id] = [$hit[0], $hit[3]]; $f = "$R/lawnhand-" . basename($region) . '.log';
$door = null;
if (($hit[9] ?? '') === 'L') { $d = json_decode((string) @file_get_contents("$R/$region-lookup.json"), true) ?: []; foreach (($d['doors'] ?? []) as $x) if (($x['id'] ?? '') === $id) $door = $x; }
else { $d = json_decode(file_get_contents("$R/$region.json"), true); foreach ($d['areas'] as $a) foreach ($a['doors'] as $x) if ($x['id'] === $id) $door = $x; }
if (is_file($f)) copy($f, getenv('HOME') . '/upload-backups/lawnhand-' . $region . '-before-' . date('Ymd-His') . '.log');
$row = ['id' => $id, 'sq' => (int) $sq, 'src' => 'ge', 'incl' => $incl, 'by' => 'Matthew Sharpe', 'at' => time(), 'note' => $note];
if (!empty($door['lawn']['sq'])) $row['photo'] = (int) $door['lawn']['sq']; if (!empty($door['trees'])) $row['trees'] = $door['trees']; if (isset($door['acres'])) $row['acres'] = $door['acres'];
file_put_contents($f, json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
echo "saved $addr -> $region/$id: " . $row['sq'] . " sq ft (app photo figure " . ($row['photo'] ?? '-') . ")\n";

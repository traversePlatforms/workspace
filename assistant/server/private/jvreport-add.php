<?php
/* Put a PDF on J.A.R.V.I.S.'s Reports shelf (25 Nov 2026). Command line only, run over ssh by the cloud computer's weekly jobs:
   php jvreport-add.php <File-name.pdf> <title> <sort date YYYY-MM-DD> < report.pdf
   Same name again replaces it. Newest sort date first. Prints one JSON line. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
foreach (['store', 'auth', 'google', 'jarvis'] as $f) require __DIR__ . '/lib/' . $f . '.php';
[$f, $title, $day] = [(string) ($argv[1] ?? ''), trim((string) ($argv[2] ?? '')), (string) ($argv[3] ?? '')];
if (!preg_match('/^[A-Za-z0-9-]{1,90}\.pdf$/D', $f) || $title === '' || !preg_match('/^\d{4}-\d\d-\d\d$/D', $day)) { echo json_encode(['ok' => false, 'error' => 'usage']), "\n"; exit(2); }
$pdf = stream_get_contents(STDIN);
if (!is_string($pdf) || strncmp($pdf, '%PDF', 4) !== 0 || strlen($pdf) > 30 << 20) { echo json_encode(['ok' => false, 'error' => 'not a PDF']), "\n"; exit(1); }
$d = rpDir(); file_put_contents("$d/$f.tmp", $pdf); @chmod("$d/$f.tmp", 0600); rename("$d/$f.tmp", "$d/$f");
$ix = array_values(array_filter(rpList(), fn($r) => ($r['f'] ?? '') !== $f));
$ix[] = ['f' => $f, 'title' => mb_substr($title, 0, 140), 'day' => $day, 'at' => time(), 'kb' => (int) round(strlen($pdf) / 1024)];
usort($ix, fn($a, $b) => strcmp((string) $b['day'], (string) $a['day']) ?: ($b['at'] <=> $a['at']));
file_put_contents("$d/index.json", json_encode($ix, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX); @chmod("$d/index.json", 0600);
echo json_encode(['ok' => true, 'count' => count($ix)]), "\n";

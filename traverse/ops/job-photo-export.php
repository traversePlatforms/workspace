<?php
// Job photos for content (2026-10-26, Matthew: "Brad has been uploading photo from jobs. How can we use those for content. How can we
// download it, make sure that they are still grouped in the address they came from"): one folder per job, "YYYY-MM-DD street, town",
// with the photos named by time, plus photos.csv (folder, file, taken, by, job date, service, crew). Writes ~/job-photos-export/.
// Lives on the server as sixfold-tools/job-photo-export.php; run nightly by traverse/ops/pull-job-photos.sh from the laptop.
if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Denver');
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/rounds.php'; } catch (SixfoldOut $e) {}
$jobs = jobsAll(); $leads = leadsAll(); $out = getenv('HOME') . '/job-photos-export'; @mkdir($out, 0700, true);
$rows = [['folder', 'file', 'taken', 'by', 'job date', 'service', 'crew']]; $n = 0;
foreach (readLines(DATA_DIR . '/jobphotos.log') as $r) {
    if (!empty($r['del'])) continue;
    $j = $jobs[$r['id']] ?? null; $src = DATA_DIR . '/jobphotos/' . $r['id'] . '/' . $r['f'];
    if (!is_file($src)) continue;
    $addr = $j ? trim((string) ($j['addr'] ?? '')) : ''; if ($addr === '' || stripos($addr, 'ask the office') !== false) { $l = $j ? ($leads[(string) ($j['lead'] ?? '')] ?? null) : null; $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . ($h['town'] ?? '') : trim((string) ($l['town'] ?? '')); if ($addr === '' || $addr === ', ') $addr = trim((string) ($j['title'] ?? '')) ?: 'job ' . $r['id']; }
    $folder = ($j['date'] ?? date('Y-m-d', (int) $r['at'])) . ' ' . preg_replace('/[^A-Za-z0-9 ,.#-]+/', '', $addr);
    @mkdir($out . '/' . $folder, 0700, true);
    $name = date('Y-m-d H.i', (int) $r['at']) . ' ' . substr($r['f'], -12);
    copy($src, $out . '/' . $folder . '/' . $name); $n++;
    $rows[] = [$folder, $name, date('Y-m-d H:i', (int) $r['at']), (string) ($r['by'] ?? ''), (string) ($j['date'] ?? ''), (string) ($j['pkg'] ?? ''), (string) ($j['crew'] ?? '')];
}
$fh = fopen($out . '/photos.csv', 'w'); foreach ($rows as $row) fputcsv($fh, $row, ',', '"', '\\'); fclose($fh);
echo "$n photos in ", count(glob($out . '/*', GLOB_ONLYDIR)), " folders\n";

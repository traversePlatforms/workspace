<?php
/* Help desk, the next ticket (2026-11-01; see Help in rounds.php). Lives on the server as sixfold-tools/help-next.php; the laptop's watcher
   (traverse/ops/help-watch.sh) runs it over SSH. Prints the oldest ticket waiting ("new") as JSON and marks it "working", or prints nothing.
   A ticket left "working" for 90 minutes (the session died) goes back to "new". php help-next.php [--peek] */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/' . (in_array('--practice', $argv, true) ? 'sixfold-practice-rounds.php' : 'rounds.php'); }   /* --practice: the practice copy (2 Nov) */ catch (SixfoldOut $e) { }
$peek = in_array('--peek', $argv, true);
$lk = fopen(helpFile() . '.lock', 'c'); flock($lk, LOCK_EX);
$T = helpAll(); $now = time();
foreach ($T as $t) if ($t['status'] === 'working' && $now - (int) $t['updated'] > 90 * 60) { appendLine(helpFile(), ['t' => 'status', 'id' => $t['id'], 'status' => 'new', 'note' => 'back to new: no reply in 90 minutes', 'at' => $now]); }
$T = helpAll(); $new = array_values(array_filter($T, fn($t) => $t['status'] === 'new')); usort($new, fn($a, $b) => $a['updated'] <=> $b['updated']);
if (!$new) { flock($lk, LOCK_UN); exit; }
$t = $new[0];
if (!$peek) appendLine(helpFile(), ['t' => 'status', 'id' => $t['id'], 'status' => 'working', 'at' => $now]);
flock($lk, LOCK_UN);
$tz = new DateTimeZone(appTz());
/* photos (3 Nov): their names, and the folder on the server; the watcher copies them to the laptop so the session can look at them */
/* voice notes (11 Nov): name, length and any transcript already made (so the watcher transcribes each note once); same folder (audioDir) */
$t['msgs'] = array_map(fn($m) => ['from' => $m['from'], 'when' => (new DateTime('@' . $m['at']))->setTimezone($tz)->format('D j M g:i a'), 'text' => $m['text']] + (!empty($m['photos']) ? ['photos' => array_column($m['photos'], 'n')] : [])
    + (!empty($m['audio']) ? ['audio' => array_map(fn($a) => ['n' => (string) ($a['n'] ?? ''), 'secs' => (int) ($a['secs'] ?? 0)] + (isset($a['text']) ? ['text' => (string) $a['text']] : []) + (!empty($a['failed']) ? ['failed' => true] : []), $m['audio'])] : []), $t['msgs']);
$t['photoDir'] = helpFilesDir() . '/' . $t['id'];
echo json_encode(['id' => $t['id'], 'by' => $t['by'], 'ctx' => $t['ctx'], 'waiting' => count($new), 'conversation' => $t['msgs'], 'photoDir' => $t['photoDir'], 'audioDir' => $t['photoDir']], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";

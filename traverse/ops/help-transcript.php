<?php
/* Help desk, a voice note's transcript (2026-11-11, Matthew: "Lets go ahead and build in the voice notes"). Lives on the server as
   sixfold-tools/help-transcript.php; the laptop's watcher (traverse/ops/help-watch.sh) runs it over SSH after whisper.cpp has turned a
   voice note into text. The transcript comes on stdin.
     php help-transcript.php <ticket id> <a....webm|ogg|m4a|mp3|aac> [--failed] [--practice] < transcript.txt
   --failed: it could not be transcribed (the chat says so; the watcher does not try that note again). Appends
   {t:transcript, id, n, text, at} to help.log; helpAll() in rounds.php puts it under its note, so the chat shows it. Nobody is pinged. */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/' . (in_array('--practice', $argv, true) ? 'sixfold-practice-rounds.php' : 'rounds.php'); } catch (SixfoldOut $e) { }
[$id, $n] = [(string) ($argv[1] ?? ''), (string) ($argv[2] ?? '')];
$T = helpAll();
if (!preg_match('/^h[0-9]{14}[0-9a-f]{4}$/D', $id) || !isset($T[$id])) { fwrite(STDERR, "no such ticket\n"); exit(2); }
$has = false; foreach ($T[$id]['msgs'] as $m) foreach (($m['audio'] ?? []) as $a) if ((string) ($a['n'] ?? '') === $n) $has = true;
if (!helpAudioName($n) || !$has) { fwrite(STDERR, "no voice note $n in this ticket\n"); exit(2); }
$failed = in_array('--failed', $argv, true);
$text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", (string) stream_get_contents(STDIN))));
if ($text === '' && !$failed) { fwrite(STDERR, "empty transcript (use --failed if it could not be made)\n"); exit(2); }
$text = mb_substr($text, 0, 4000);
appendLine(helpFile(), ['t' => 'transcript', 'id' => $id, 'n' => $n, 'text' => $text, 'at' => time()] + ($failed ? ['failed' => true] : []));
echo $failed ? "marked not transcribed: $n\n" : "transcript saved: $n (" . mb_strlen($text) . " characters)\n";

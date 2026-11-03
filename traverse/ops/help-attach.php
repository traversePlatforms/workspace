<?php
/* Help desk, a PDF for a reply (2026-11-03, Matthew: "can jarvis create pdfs and launch them in the browser"). Lives on the server as
   sixfold-tools/help-attach.php; traverse/ops/help-reply.sh runs it over SSH for each --pdf before the reply itself. The PDF comes on stdin.
     php help-attach.php <ticket id> <name.pdf> [--practice] < file.pdf
   Stored outside the web folder in <data>/help-files/<ticket>/<name.pdf> (0600); the app serves it through action=helpfile to whoever may
   see that conversation. Prints the stored name and size. */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/' . (in_array('--practice', $argv, true) ? 'sixfold-practice-rounds.php' : 'rounds.php'); } catch (SixfoldOut $e) { }
[$id, $name] = [(string) ($argv[1] ?? ''), (string) ($argv[2] ?? '')];
if (!preg_match('/^h[0-9]{14}[0-9a-f]{4}$/D', $id) || !isset(helpAll()[$id])) { fwrite(STDERR, "no such ticket\n"); exit(2); }
if (!helpFileName($name)) { fwrite(STDERR, "name: letters, digits, dot, dash or underscore, ending .pdf, up to 84 characters\n"); exit(2); }
$pdf = (string) stream_get_contents(STDIN);
if (strncmp($pdf, '%PDF-', 5) !== 0) { fwrite(STDERR, "that is not a PDF\n"); exit(2); }
if (strlen($pdf) > 20 * 1024 * 1024) { fwrite(STDERR, "over 20 MB\n"); exit(2); }
$d = helpFilesDir() . '/' . $id; if (!is_dir($d) && !@mkdir($d, 0700, true)) { fwrite(STDERR, "could not make the folder\n"); exit(1); }
$t = $d . '/.' . $name . '.tmp'; if (file_put_contents($t, $pdf) !== strlen($pdf)) { @unlink($t); fwrite(STDERR, "could not save it\n"); exit(1); }
chmod($t, 0600); rename($t, $d . '/' . $name);
echo $name, ' ', strlen($pdf), "\n";

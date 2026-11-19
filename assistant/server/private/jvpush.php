<?php
/* J.A.R.V.I.S. reminders (2026-11-19, P-8 step 3): one alert to Matthew's phones, the same one a J.A.R.V.I.S. desk reply makes. Command line
   only; lib/jarvis.php (jvPush) runs it from the 10-minute check with {title, text, url, tag} as JSON on stdin.
   It loads the Field app's own API code the way the desk's reply script does, and calls its helpAlertMatthew(), which goes to the super
   admin's devices only (Matthew) and puts the line in his bell list. It touches no chat thread (a reply there would mark a waiting message
   answered), reads nothing back, and sends no email or text. Prints "pushed" when the call was made. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
/* --check: load the Field app's code and say whether its alert is there; pushes nothing */
$jpCheck = in_array('--check', $argv ?? [], true);
$in = $jpCheck ? ['text' => 'check'] : json_decode((string) stream_get_contents(STDIN), true);
if (!is_array($in) || trim((string) ($in['text'] ?? '')) === '') { fwrite(STDERR, "nothing to push\n"); exit(2); }
$jpTitle = mb_substr(trim((string) ($in['title'] ?? 'J.A.R.V.I.S.')), 0, 60);
$jpText = mb_substr(trim(preg_replace('/\s+/', ' ', (string) $in['text'])), 0, 200);
$jpUrl = (string) ($in['url'] ?? '/a-e018bb82/jarvis/'); if (!preg_match('#^/[A-Za-z0-9/_.?=-]*$#', $jpUrl)) $jpUrl = '/a-e018bb82/jarvis/';
$jpTag = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($in['tag'] ?? 'jv-remind')) ?: 'jv-remind';
$jpApi = dirname(__DIR__) . '/public_html/api/rounds.php';
if (!is_file($jpApi)) { fwrite(STDERR, "no Field app API here\n"); exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $jpApi; } catch (SixfoldOut $e) { }
if (!function_exists('helpAlertMatthew')) { fwrite(STDERR, "the Field app has no helpAlertMatthew\n"); exit(1); }
if ($jpCheck) { echo "check ok: the Field app's alert is there (nothing pushed)\n"; exit(0); }
helpAlertMatthew($jpTitle, $jpText, $jpUrl, $jpTag);
echo "pushed\n";

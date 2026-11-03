<?php
/* Help desk, a reply (2026-11-01; see Help in rounds.php). Lives on the server as sixfold-tools/help-reply.php; the Claude Code session the
   laptop's watcher started runs it over SSH (traverse/ops/help-reply.sh). The reply text comes on stdin.
     php help-reply.php <ticket id> <answered|matthew|working> [refresh] [file=<name.pdf> ...] < reply.txt   (refresh: it changed something the person sees)
   answered: done or explained. matthew: needs Matthew (prices, money, customer-facing wording, deleting, a decision); he is alerted too.
   working: a progress note, the ticket stays with the watcher. The writer gets a push and a bell item either way. */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/' . (in_array('--practice', $argv, true) ? 'sixfold-practice-rounds.php' : 'rounds.php'); }   /* --practice: the practice copy (2 Nov) */ catch (SixfoldOut $e) { }
[$id, $status] = [(string) ($argv[1] ?? ''), (string) ($argv[2] ?? 'answered')];
if (!in_array($status, ['answered', 'matthew', 'working'], true)) { fwrite(STDERR, "status: answered, matthew or working\n"); exit(2); }
$T = helpAll(); if (!isset($T[$id])) { fwrite(STDERR, "no such ticket\n"); exit(2); }
$text = trim((string) stream_get_contents(STDIN)); if ($text === '') { fwrite(STDERR, "empty reply\n"); exit(2); }
$text = mb_substr($text, 0, 4000);
$refresh = in_array('refresh', $argv, true);   /* the session changed data or the app: the chat shows a Refresh now button (1 Nov) */
/* file=<name.pdf>: a PDF help-attach.php already stored for this ticket; the chat shows an Open button for each (3 Nov) */
$files = [];
foreach ($argv as $a) if (strncmp($a, 'file=', 5) === 0) {
    $n = substr($a, 5); $p = helpFilesDir() . '/' . $id . '/' . $n;
    if (!helpFileName($n) || !is_file($p)) { fwrite(STDERR, "no stored file $n for this ticket: run help-attach.php first\n"); exit(2); }
    $files[] = ['n' => $n, 'size' => filesize($p)];
}
appendLine(helpFile(), ['t' => 'reply', 'id' => $id, 'from' => 'J.A.R.V.I.S.', 'text' => $text, 'status' => $status, 'at' => time()] + ($refresh ? ['refresh' => true] : []) + ($files ? ['files' => $files] : []));
$who = (string) $T[$id]['by']; $title = $status === 'matthew' ? 'J.A.R.V.I.S.: passed to Matthew' : 'J.A.R.V.I.S. replied';   /* the chat's name in the app (Matthew, 1 Nov) */
$short = mb_substr(preg_replace('/\s+/', ' ', $text), 0, 140);
/* one notification: pushName also puts it in the bell list (the separate feedAdd made two, 1 Nov); a 'working' note pings nobody, the chat shows it */
if ($status !== 'working') { try { pushName($who, $title, $short, './?help=' . $id, 'help-' . $id); } catch (Throwable $e) {} }
/* Matthew's phones only (3 Nov): a365Alert's $super also told every office login, so Jen got an alert about her own request */
if ($status === 'matthew') { try { helpAlertMatthew('J.A.R.V.I.S.: ' . $who . ' needs you', $short, './?help=' . $id, 'help-matthew-' . $id); } catch (Throwable $e) {} }
echo "replied ($status) to $who\n";

<?php
/* Help desk, a reply (2026-11-01; see Help in rounds.php). Lives on the server as sixfold-tools/help-reply.php; the Claude Code session the
   laptop's watcher started runs it over SSH (traverse/ops/help-reply.sh). The reply text comes on stdin.
     php help-reply.php <ticket id> <answered|matthew|working> < reply.txt
   answered: done or explained. matthew: needs Matthew (prices, money, customer-facing wording, deleting, a decision); he is alerted too.
   working: a progress note, the ticket stays with the watcher. The writer gets a push and a bell item either way. */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/rounds.php'; } catch (SixfoldOut $e) { }
[$id, $status] = [(string) ($argv[1] ?? ''), (string) ($argv[2] ?? 'answered')];
if (!in_array($status, ['answered', 'matthew', 'working'], true)) { fwrite(STDERR, "status: answered, matthew or working\n"); exit(2); }
$T = helpAll(); if (!isset($T[$id])) { fwrite(STDERR, "no such ticket\n"); exit(2); }
$text = trim((string) stream_get_contents(STDIN)); if ($text === '') { fwrite(STDERR, "empty reply\n"); exit(2); }
$text = mb_substr($text, 0, 4000);
appendLine(helpFile(), ['t' => 'reply', 'id' => $id, 'from' => 'J.A.R.V.I.S.', 'text' => $text, 'status' => $status, 'at' => time()]);
$who = (string) $T[$id]['by']; $title = $status === 'matthew' ? 'Help: passed to Matthew' : 'Help: J.A.R.V.I.S. replied';   /* the chat's name in the app (Matthew, 1 Nov) */
$short = mb_substr(preg_replace('/\s+/', ' ', $text), 0, 140);
try { feedAdd($who, $title, $short, './?help=' . $id, 'help-' . $id . '-' . time()); } catch (Throwable $e) {}
try { pushName($who, $title, $short, './?help=' . $id, 'help-' . $id); } catch (Throwable $e) {}
if ($status === 'matthew') { try { a365Alert('Help: ' . $who . ' needs you', $short, true, false, false, true, './?help=' . $id); } catch (Throwable $e) {} }
echo "replied ($status) to $who\n";

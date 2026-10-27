<?php
// "Mark live" from the command line (2026-10-27, Matthew: setup of up to 2 business days after payment, then a 7-day money-back
// guarantee from the day the company's app is live). Records live_at in that install's billing.json, the same as the super admin's
// Mark live button on Billing. Run on the server:
//   php billing-mark-live.php traverse          (Roofing; also traverse-yards, traverse-solar, traverse-pest, traverse-security, or sixfold)
// Refuses when there is no paid plan yet or the app is already live. Refunds are never done from here.
if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Denver');
$which = (string) ($argv[1] ?? '');
$files = ['sixfold' => 'rounds.php', 'traverse' => 'traverse-rounds.php', 'traverse-yards' => 'traverse-yards-rounds.php',
          'traverse-solar' => 'traverse-solar-rounds.php', 'traverse-pest' => 'traverse-pest-rounds.php', 'traverse-security' => 'traverse-security-rounds.php'];
if (!isset($files[$which])) { fwrite(STDERR, "usage: php billing-mark-live.php <" . implode('|', array_keys($files)) . ">\n"); exit(2); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'billinglivecli']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$r = ['ok' => false, 'error' => 'The app did not answer.'];
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/' . $files[$which]; } catch (SixfoldOut $e) { $r = $e->body; }
if (!empty($r['ok'])) { echo "$which: live since " . date('j M Y H:i', (int) $r['liveAt']) . "; the money-back guarantee runs 7 days from now\n"; exit(0); }
fwrite(STDERR, "$which: " . ($r['error'] ?? 'refused') . "\n"); exit(1);

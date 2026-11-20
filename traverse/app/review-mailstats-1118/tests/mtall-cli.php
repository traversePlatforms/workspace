<?php
declare(strict_types=1);
/* The test copy's door into rounds.php for mailtrack-all-test.mjs (2026-11-20, opens and clicks for every automatic email). Command line only,
 * on a throwaway install (an edition: company a365 null; its mailbox a made-up one; CARE_MAIL_MOCK set, so a care email is written to a file).
 *   php mtall-cli.php <api/rounds.php> installon        mtInstallOn()
 *   php mtall-cli.php <api/rounds.php> care <to>        careSendCounted('followup', ...) with a made-up quote email
 *   php mtall-cli.php <api/rounds.php> travmail         travMail() to a closed local port (nothing can leave)
 * Prints one JSON answer. */
if (PHP_SAPI !== 'cli') exit(1);
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
[$_, $api, $cmd] = $argv + [null, '', '', ''];
$arg = $argv[3] ?? '';
$_REQUEST = ['action' => 'mtnone']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
try { require $api; } catch (SixfoldOut $e) { }
ob_end_clean();
$o = null;
try {
    if ($cmd === 'installon') $o = ['on' => mtInstallOn(), 'edition' => edition()];
    elseif ($cmd === 'care') {
        $t = ['subject' => 'Your quote from {company}', 'body' => "Hi {first_name},\n\nYour quote is here: [your quote]({link})\n\nOur site: https://example.com/lawn-tips"];
        $m = careRender($t, ['first_name' => 'Alex', 'company' => 'Test Lawn', 'link' => 'https://traverseplatforms.com/x/q.html?k=abc123'], $arg);
        $o = careSendCounted('followup', '', $arg, $m);
    }
    elseif ($cmd === 'travmail') $o = travMail('m@example.com', 'Traverse: a test note', "A test note.\n\nhttps://traverseplatforms.com/\n");
    else $o = ['error' => 'unknown command'];
} catch (SixfoldOut $e) { $o = $e->body; } catch (Throwable $e) { $o = ['fatal' => $e->getMessage() . ' @' . $e->getLine()]; }
echo json_encode($o, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

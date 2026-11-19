<?php
declare(strict_types=1);
/* The test copy's door into rounds.php's own functions (2026-11-18, Sixfold email opens, clicks and words). Command line only, on a throwaway
 * install (its own sixfold-data, sixfold-private with a DRY-RUN mailbox: every "send" is written to a365-dryrun.log, nothing leaves).
 *   php mt-cli.php <path to that install's api/rounds.php> <command> [json file]
 *     build <fixtures.json>   each fixture's email from the builders (no send), as JSON: the old-vs-new comparison and the previews
 *     aftercare <job id>      jobAftercare(job, 'done')
 *     followup <job id>       jobFollowup(job, 'test')
 *     deposit <lead id>       depremSend(lead, 'd1')
 *     signed <lead id>        a365SendSigned(lead, its signature, 'test')
 *     nlsweep                 nlSweep() (NL_FAST)
 *     trackon                 a365TrackOn()
 * Prints one JSON answer. */
if (PHP_SAPI !== 'cli') exit(1);
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
[$_, $api, $cmd] = $argv + [null, '', '', ''];
$arg = $argv[3] ?? '';
$_REQUEST = ['action' => 'mtnone']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
try { require $api; } catch (SixfoldOut $e) { /* the routing stops at the sign-in check; every function is defined by then */ }
ob_end_clean();
$o = null;
try {
    if ($cmd === 'build') {
        $o = [];
        foreach (json_decode((string) file_get_contents($arg), true) as $fx) {
            $k = (string) $fx['kind'];
            if ($k === 'aftercare') $m = aftercareBuild($fx['j'], $fx['l']);
            elseif ($k === 'followup') $m = array_slice(followupBuild($fx['j'], $fx['l']), 0, 3);
            elseif ($k === 'deposit') $m = depremBuild($fx['l'], (string) ($fx['dk'] ?? 'd1'));
            elseif ($k === 'signed') $m = a365SignedBuild($fx['l'], $fx['sg']);
            else $m = ['?', '', ''];
            $o[] = ['name' => (string) ($fx['name'] ?? $k), 'subject' => $m[0], 'text' => $m[1], 'html' => $m[2]];
        }
    } elseif ($cmd === 'aftercare') $o = jobAftercare($arg, 'done');
    elseif ($cmd === 'followup') $o = jobFollowup($arg, 'test');
    elseif ($cmd === 'deposit') $o = depremSend($arg, 'd1');
    elseif ($cmd === 'signed') { $l = leadsAll()[$arg] ?? []; $o = a365SendSigned($l, (array) ($l['signed'] ?? []), 'test'); }
    elseif ($cmd === 'nlsweep') { putenv('NL_FAST=1'); $o = nlSweep(); }
    elseif ($cmd === 'trackon') $o = ['on' => a365TrackOn()];
    else $o = ['error' => 'unknown command'];
} catch (SixfoldOut $e) { $o = $e->body; } catch (Throwable $e) { $o = ['fatal' => $e->getMessage() . ' @' . $e->getLine()]; }
echo json_encode($o, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

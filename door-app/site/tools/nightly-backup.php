<?php
declare(strict_types=1);
/* Nightly backup of the door app's data (Matthew 2026-10-04: "something that can store this info and be
 * used to rebuild data"). Run by a SiteGround cron job once a night; never from a browser.
 *
 * Lives OUTSIDE public_html, in sixfold-tools/ beside it:
 *   <site>/public_html/            the website, the app, api/rounds.php
 *   <site>/sixfold-data/           every log the app keeps (rounds/, leads/, customers/)
 *   <site>/sixfold-tools/          this file
 *
 * Each run writes sixfold-data/backups/sixfold-backup-YYYY-MM-DD.json.gz: the same document as the app's
 * "Download a full backup" (api/rounds.php, action=backup), compressed. Keep the two file lists in step.
 * The newest 30 are kept. Sign-in codes are never in it (they stay in sixfold-private); photos are listed,
 * not copied. Rebuilding: unzip it, and put each entry in "files" back at its path.
 *
 * A copy on the same server does not survive losing the server. The app reminds an admin to download one
 * to a device when nobody has for a week.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const KEEP = 30;
$site = dirname(__DIR__);
$data = $site . '/sixfold-data';
$rounds = $data . '/rounds';
if (!is_dir($rounds)) { fwrite(STDERR, "sixfold backup: no data folder at $rounds\n"); exit(1); }
$out = $data . '/backups';
if (!is_dir($out) && !@mkdir($out, 0700, true)) { fwrite(STDERR, "sixfold backup: cannot create $out\n"); exit(1); }

/* the same list as action=backup in api/rounds.php */
$files = [];
$add = function (string $abs, string $rel) use (&$files) { if (is_file($abs) && is_readable($abs)) $files[$rel] = (string) file_get_contents($abs); };
foreach ((glob($rounds . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/rounds/' . basename($p));
$add($rounds . '/goals.json', 'sixfold-data/rounds/goals.json');
foreach ((glob($data . '/leads/*.log') ?: []) as $p) $add($p, 'sixfold-data/leads/' . basename($p));
foreach ((glob($data . '/customers/*.log') ?: []) as $p) $add($p, 'sixfold-data/customers/' . basename($p));
$photos = [];
foreach ((glob($rounds . '/photos/*/*/*') ?: []) as $p) $photos[] = 'sixfold-data/rounds/photos/' . substr($p, strlen($rounds . '/photos/'));
$coName = (string) ((json_decode((string) @file_get_contents($rounds . '/company.json'), true) ?: [])['name'] ?? 'Door app');
$doc = ['backup' => $coName . ' field tools', 'made' => date('c'), 'by' => 'nightly',
        'restore' => 'Each entry in "files" is a log the app reads. To rebuild, put each one back at its path beside public_html (sixfold-data/...). Lines are JSON, one change per line, oldest first. Sign-in codes and the app-made sign-ins are not included (re-create those people in Accounts); photos are listed, not copied.',
        'files' => $files, 'photos' => $photos];
$json = json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
$gz = $json === false ? false : gzencode($json, 9);
if ($gz === false) { fwrite(STDERR, "sixfold backup: could not build the file\n"); exit(1); }

$name = 'sixfold-backup-' . date('Y-m-d') . '.json.gz';
$tmp = $out . '/.' . $name . '.' . bin2hex(random_bytes(4)) . '.tmp';
if (@file_put_contents($tmp, $gz, LOCK_EX) === false || !@rename($tmp, $out . '/' . $name)) {
    @unlink($tmp); fwrite(STDERR, "sixfold backup: could not write $name\n"); exit(1);
}
@chmod($out . '/' . $name, 0600);

/* keep the newest KEEP; the names sort by date */
$all = glob($out . '/sixfold-backup-*.json.gz') ?: [];
sort($all);
foreach (array_slice($all, 0, max(0, count($all) - KEEP)) as $old) @unlink($old);

@file_put_contents($out . '/backups.log', json_encode(['at' => time(), 'file' => $name, 'bytes' => strlen($gz), 'logs' => count($files)]) . "\n", FILE_APPEND | LOCK_EX);
echo "sixfold backup: $name, " . count($files) . " logs, " . strlen($gz) . " bytes, " . min(count($all), KEEP) . " kept\n";

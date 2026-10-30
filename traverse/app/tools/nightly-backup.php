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
 *
 * + the Traverse editions (Matthew 2026-10-29: "add edition back ups at night"): the same run walks each
 * edition's data folder beside sixfold-data and writes <folder>/backups/sixfold-backup-YYYY-MM-DD.json.gz,
 * the name each edition's Backups screen lists (build-editions.cjs renames only the folder). Logs and
 * settings only: the door files are rebuilt from the data pipeline, so they are never copied. A folder
 * that fails is reported and the rest still run.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const KEEP = 30;
const FOLDERS = ['sixfold-data', 'traverse-data', 'traverse-yards-data', 'traverse-solar-data', 'traverse-pest-data', 'traverse-security-data'];
$site = dirname(__DIR__);
$failed = 0;
/* + every client install made on the server (2026-10-29): traverse-c<8 hex>-data beside the others; its door files are links to its edition's,
   and only its own logs and settings are read, as for every folder */
$clients = array_map('basename', glob($site . '/traverse-c[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-data', GLOB_ONLYDIR) ?: []);
foreach (array_merge(FOLDERS, $clients) as $dir) if (!backupOne($site, $dir)) $failed++;
exit($failed ? 1 : 0);

function backupOne(string $site, string $dir): bool {
    $data = $site . '/' . $dir;
    $rounds = $data . '/rounds';
    if (!is_dir($rounds)) { fwrite(STDERR, "$dir backup: no data folder at $rounds\n"); return false; }
    $out = $data . '/backups';
    if (!is_dir($out) && !@mkdir($out, 0700, true)) { fwrite(STDERR, "$dir backup: cannot create $out\n"); return false; }

    /* the same list as action=backup in api/rounds.php */
    $files = [];
    $add = function (string $abs, string $rel) use (&$files) { if (is_file($abs) && is_readable($abs)) $files[$rel] = (string) file_get_contents($abs); };
    foreach ((glob($rounds . '/*.log') ?: []) as $p) $add($p, $dir . '/rounds/' . basename($p));
    /* the settings the app writes as whole files (review 2026-10-06: personal goals, the lessons and the roof prices were missing) */
    /* + each install's own settings (2026-10-29): kit, costs, pay ways, email templates, Company screen, team goals, crews' towns and days off; never the mailbox password */   /* + role permissions (role-perms.json, 2026-10-29) */
    foreach (['goals.json', 'goals-people.json', 'goals-teams.json', 'training.json', 'roof-settings.json', 'kit.json', 'costs.json', 'payways.json', 'mail-templates.json', 'company-local.json', 'jobdays.json', 'jobblocks.json', 'role-perms.json', 'pricing.json', 'clauses.json'] as $n) $add($rounds . '/' . $n, $dir . '/rounds/' . $n);   /* + the smart price list and the clause library (2026-10-30) */
    foreach ((glob($data . '/leads/*.log') ?: []) as $p) $add($p, $dir . '/leads/' . basename($p));
    foreach ((glob($data . '/customers/*.log') ?: []) as $p) $add($p, $dir . '/customers/' . basename($p));
    $photos = [];
    foreach ((glob($rounds . '/photos/*/*/*') ?: []) as $p) $photos[] = $dir . '/rounds/photos/' . substr($p, strlen($rounds . '/photos/'));
    $coName = (string) ((json_decode((string) @file_get_contents($rounds . '/company.json'), true) ?: [])['name'] ?? 'Door app');
    $doc = ['backup' => $coName . ' field tools', 'made' => date('c'), 'by' => 'nightly',
            'restore' => 'Each entry in "files" is a log the app reads. To rebuild, put each one back at its path beside public_html (' . $dir . '/...). Lines are JSON, one change per line, oldest first. Sign-in codes and the app-made sign-ins are not included (re-create those people in Accounts); photos are listed, not copied.',
            'files' => $files, 'photos' => $photos];
    /* the Company screen's uploaded logo (2026-10-29): an image, so base64 under "binary"; the same as action=backup */
    foreach (['png', 'jpg', 'svg'] as $lt) if (is_file($rounds . '/company-logo.' . $lt)) {
        $doc['binary'][$dir . '/rounds/company-logo.' . $lt] = base64_encode((string) file_get_contents($rounds . '/company-logo.' . $lt));
        $doc['restore'] .= ' Each entry in "binary" is a file in base64 (the company logo): decode it and put it back at its path.';
    }
    $json = json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    $gz = $json === false ? false : gzencode($json, 9);
    if ($gz === false) { fwrite(STDERR, "$dir backup: could not build the file\n"); return false; }

    $name = 'sixfold-backup-' . date('Y-m-d') . '.json.gz';
    $tmp = $out . '/.' . $name . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, $gz, LOCK_EX) === false || !@rename($tmp, $out . '/' . $name)) {
        @unlink($tmp); fwrite(STDERR, "$dir backup: could not write $name\n"); return false;
    }
    @chmod($out . '/' . $name, 0600);

    /* keep the newest KEEP; the names sort by date */
    $all = glob($out . '/sixfold-backup-*.json.gz') ?: [];
    sort($all);
    foreach (array_slice($all, 0, max(0, count($all) - KEEP)) as $old) @unlink($old);

    @file_put_contents($out . '/backups.log', json_encode(['at' => time(), 'file' => $name, 'bytes' => strlen($gz), 'logs' => count($files)]) . "\n", FILE_APPEND | LOCK_EX);
    echo "$dir backup: $name, " . count($files) . " logs, " . strlen($gz) . " bytes, " . min(count($all), KEEP) . " kept\n";
    return true;
}

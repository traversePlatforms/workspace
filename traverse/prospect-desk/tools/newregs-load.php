<?php
/* Adds the 152 newly registered companies to the Prospect Desk (Matthew 15 Nov 2026: "put companies on the prospect list"). On the server:
     php newregs-load.php dry <payload.json>   count, change nothing
     php newregs-load.php go  <payload.json>   one 'lead' event per company not already on the desk (same id, or same name and city)
   Companies only: nothing is queued or sent. Back up events.log first. */
$home = getenv('HOME');
$api = "$home/www/traverseplatforms.com/public_html/prospects-47bfe6/api/desk.php";
putenv("DESK_DATA=$home/www/traverseplatforms.com/traverse-prospects-data");
$_SERVER['HTTP_HOST'] = 'traverseplatforms.com'; $_SERVER['HTTPS'] = 'on'; $_SERVER['SCRIPT_NAME'] = '/prospects-47bfe6/api/desk.php';
$src = file_get_contents($api); $cut = strpos($src, '/* ---- the command line');
if ($cut === false) exit("desk.php layout changed: stopping\n");
eval(substr($src, 5, $cut - 5));

[$mode, $pf] = [$argv[1] ?? 'dry', $argv[2] ?? ''];
$P = json_decode((string) file_get_contents($pf), true); if (!$P || empty($P['leads'])) exit("no payload\n");
$BY = "Claude (Matthew's go, 15 Nov: new companies on the register)";
$S = state(); $before = count($S['leads']);
$seen = []; foreach ($S['leads'] as $l) $seen[strtolower(trim((string) $l['name'])) . '|' . strtolower(trim((string) $l['city']))] = 1;
$add = []; $skip = 0;
foreach ($P['leads'] as $l) {
    $k = strtolower(trim($l['name'])) . '|' . strtolower(trim($l['city']));
    if (isset($S['leads'][$l['id']]) || isset($seen[$k])) { $skip++; continue; }
    $seen[$k] = 1; $add[] = $l;
}
$tr = []; foreach ($add as $l) $tr[$l['trade']] = ($tr[$l['trade']] ?? 0) + 1;
echo "on the desk now: $before | to add: " . count($add) . " (" . json_encode($tr) . ") | already there: $skip\n";
if ($mode !== 'go') exit("dry run: nothing changed\n");
foreach ($add as $l) logAdd(['t' => 'lead', 'id' => $l['id'], 'lead' => $l, 'by' => $BY, 'at' => time()]);
$S = state(); echo "added; on the desk now: " . count($S['leads']) . "\n";

<?php
/* The practice copy's towns (2026-11-02): a handful of towns' door files, copied from Sixfold's data into the practice copy's, read-only on the
 * source. Only door data (the town, its lookup list and its side files) and the shared lists the screens need; never a log, a lead, a customer,
 * a job, a payment, an account or anything in the private folder.
 *   php practice-towns.php <source rounds dir> <practice rounds dir> [town ...]
 * On the server: php ~/practice-towns.php ~/www/traverseplatforms.com/sixfold-data/rounds ~/www/traverseplatforms.com/sixfold-practice-data/rounds
 * Its index.json is Sixfold's with only these towns in it. Prints what it copied (file names and sizes). */
if (PHP_SAPI !== 'cli') exit;
[$me, $src, $dst] = array_pad($argv, 3, '');
$towns = array_slice($argv, 3) ?: ['englewood', 'sheridan', 'cherry-hills-village', 'greenwood-village', 'columbine-valley'];
if (!is_dir($src) || $dst === '' || realpath($src) === realpath($dst)) { fwrite(STDERR, "usage: practice-towns.php <source rounds> <practice rounds> [town ...]\n"); exit(1); }
if (!preg_match('#sixfold-practice-data/rounds/?$#', str_replace('\\', '/', $dst)) && !getenv('PRACTICE_ANY_DST')) { fwrite(STDERR, "the destination must be a sixfold-practice-data/rounds folder\n"); exit(1); }
@mkdir($dst . '/docs', 0755, true);
/* the side files Sixfold's screens read per town (what live Sixfold carries for them: mail, moved, others; the rest where a town has them) */
$KINDS = ['mail', 'moved', 'others', 'lawnmask', 'census', 'nri', 'year'];
$copied = 0; $bytes = 0;
$cp = function (string $from, string $to) use (&$copied, &$bytes) {
    if (!is_file($from)) return;
    if (!@copy($from, $to)) { fwrite(STDERR, 'could not copy ' . basename($from) . "\n"); exit(1); }
    $copied++; $bytes += filesize($to); echo '  ', basename($to), ' ', round(filesize($to) / 1024), " KB\n";
};
foreach ($towns as $t) {
    if (!preg_match('/^[a-z0-9-]{2,60}$/D', $t)) { fwrite(STDERR, "bad town $t\n"); exit(1); }
    if (!is_file("$src/$t.json")) { fwrite(STDERR, "no town $t in the source\n"); exit(1); }
    $cp("$src/$t.json", "$dst/$t.json");
    $cp("$src/$t-lookup.json", "$dst/$t-lookup.json");
    foreach ($KINDS as $k) $cp("$src/$k-$t.json", "$dst/$k-$t.json");
}
/* the shared lists: HOA communities, wildfire plans, the Sample door, the funding and water sheets (review link out), the field guide */
foreach (['hoa-communities.json', 'cwpp.json', 'sample-door.json'] as $f) $cp("$src/$f", "$dst/$f");
$cp("$src/docs/field-guide.pdf", "$dst/docs/field-guide.pdf");
if (is_file("$src/docs/money.json")) {
    $m = json_decode((string) file_get_contents("$src/docs/money.json"), true);
    if (is_array($m)) { $m['links'] = ['googleReview' => '']; file_put_contents("$dst/docs/money.json", json_encode($m, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); $copied++; echo "  docs/money.json (review link out)\n"; }
}
$idx = json_decode((string) file_get_contents("$src/index.json"), true);
if (!is_array($idx) || !is_array($idx['regions'] ?? null)) { fwrite(STDERR, "no index.json in the source\n"); exit(1); }
$idx['regions'] = array_values(array_filter($idx['regions'], fn($r) => in_array($r['key'] ?? '', $towns, true)));
file_put_contents("$dst/index.json", json_encode($idx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
echo 'index.json: ', count($idx['regions']), ' towns (', implode(', ', array_map(fn($r) => $r['key'], $idx['regions'])), ")\n";
echo "copied $copied files, ", round($bytes / 1048576, 1), " MB\n";

<?php
/* J.A.R.V.I.S. desk, the laptop's side over SSH (2026-11-19; the store is lib/desk.php). Command line only. The laptop's watcher
   (traverse/ops/help-watch.sh) and reply script (assistant/jarvis/tools/jarvis-reply.sh) run it as
     php jvdesk.php next [--peek]                       the oldest thread waiting, as JSON (marked working unless --peek), or nothing
     php jvdesk.php count                               how many wait
     php jvdesk.php reply <id> <answered|matthew|working> [refresh] [file=<name.pdf> ...] < text
     php jvdesk.php attach <id> <name.pdf> < the PDF
     php jvdesk.php transcript <id> <voice note> [--failed] < text
     php jvdesk.php final-since <id> <unix time>        exit 0 when a final reply was written since then
     php jvdesk.php import < rows                       his history from the Sixfold app (one JSON row a line)
     php jvdesk.php setkey < sha256 hex                 the laptop key's hash (the key itself stays on the laptop)
     php jvdesk.php push-state                          the devices with alerts on (names only)
   Nothing here reads or writes any other app's files. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
foreach (['store', 'auth', 'google', 'jarvis', 'desk'] as $f) require __DIR__ . '/lib/' . $f . '.php';
$a = array_slice($argv, 1); $cmd = (string) ($a[0] ?? '');
$in = fn() => (string) stream_get_contents(STDIN);
$say = function (array $r, string $okLine = ''): never { if (!empty($r['ok'])) { echo ($okLine !== '' ? $okLine : json_encode($r, JSON_UNESCAPED_SLASHES)) . "\n"; exit(0); } fwrite(STDERR, (string) ($r['error'] ?? 'failed') . "\n"); exit(2); };
switch ($cmd) {
    case 'next': $t = jdNext(in_array('--peek', $a, true)); if ($t) echo json_encode($t, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0);
    case 'count': echo jdPending(), "\n"; exit(0);
    case 'reply':
        $files = []; foreach ($a as $x) if (strncmp($x, 'file=', 5) === 0) $files[] = substr($x, 5);
        $r = jdReply((string) ($a[1] ?? ''), (string) ($a[2] ?? 'answered'), $in(), in_array('refresh', $a, true), $files);
        $say($r, 'replied (' . ($a[2] ?? 'answered') . ') in J.A.R.V.I.S.' . (!empty($r['pushed']) ? ', pushed to his phone' : ''));
    case 'attach': $say(jdAttach((string) ($a[1] ?? ''), (string) ($a[2] ?? ''), $in()), 'stored');
    case 'transcript': $failed = in_array('--failed', $a, true); $say(jdTranscript((string) ($a[1] ?? ''), (string) ($a[2] ?? ''), $failed ? '' : $in(), $failed), 'saved');
    case 'final-since': exit(jdFinalSince((string) ($a[1] ?? ''), (int) ($a[2] ?? 0)) ? 0 : 1);
    case 'import':
        $rows = []; foreach (preg_split('/\r?\n/', $in()) as $l) { $r = json_decode($l, true); if (is_array($r)) $rows[] = $r; }
        $say(jdImport($rows));
    case 'setkey': $say(['ok' => jdSetKeyHash(trim($in())), 'error' => 'give the SHA-256 as 64 hex characters'], 'key set');
    case 'push-state': $s = jvPushState(); echo json_encode(['devices' => array_map(fn($d) => ['device' => $d['device'], 'phone' => $d['phone'], 'at' => $d['at']], $s['devices']), 'fallback' => $s['fallback']], JSON_UNESCAPED_SLASHES), "\n"; exit(0);
    default: fwrite(STDERR, "usage: php jvdesk.php next [--peek] | count | reply <id> <status> [refresh] [file=x.pdf] | attach <id> <name.pdf> | transcript <id> <n> [--failed] | final-since <id> <t> | import | setkey | push-state\n"); exit(2);
}

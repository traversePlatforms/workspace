<?php
/* J.A.R.V.I.S. meeting recordings, the transcribers' side over SSH (20 Nov 2026, P-12; the store is lib/meet.php). Command line only.
   assistant/jarvis/tools/meeting-worker.sh (on the laptop and on the cloud machine) runs it as
     php jvmeet.php peek <laptop|cloud>                 how many meetings that transcriber may take now (also runs the sweep)
     php jvmeet.php next <laptop|cloud>                 the oldest one it may take, claimed, as JSON (or nothing)
     php jvmeet.php hold <id> <laptop|cloud>            still working on it (every 2 minutes; a claim lapses 10 minutes after the last)
     php jvmeet.php seg <id> <n>                        segment n's audio: its pieces joined in order, to stdout
     php jvmeet.php done <id> <laptop|cloud> [model] < transcript    saved, read back, audio deleted unless kept, sent to the desk
     php jvmeet.php fail <id> <laptop|cloud> < reason   back to the queue (3 tries, then failed and the audio kept 30 days)
     php jvmeet.php transcripts                         finished transcripts (id, company, other, date), for the laptop's private copy
     php jvmeet.php text <id>                           one transcript, to stdout
     php jvmeet.php sweep                               the clock work by hand (the stalled-recording alert and the rest)
   Nothing here reads or writes any other app's files. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
foreach (['store', 'auth', 'google', 'jarvis', 'desk', 'meet'] as $f) require __DIR__ . '/lib/' . $f . '.php';
$a = array_slice($argv, 1); $cmd = (string) ($a[0] ?? '');
$who = function (int $i) use ($a): string { $w = (string) ($a[$i] ?? ''); if (!mtWho($w)) { fwrite(STDERR, "say laptop or cloud\n"); exit(2); } return $w; };
$id = function () use ($a): string { $x = (string) ($a[1] ?? ''); if (!mtIdOk($x)) { fwrite(STDERR, "no such meeting\n"); exit(2); } return $x; };
$say = function (array $r): never { if (!empty($r['ok'])) { echo json_encode($r, JSON_UNESCAPED_SLASHES), "\n"; exit(0); } fwrite(STDERR, (string) ($r['error'] ?? 'failed') . "\n"); exit(2); };
switch ($cmd) {
    case 'peek': echo mtPeek($who(1)), "\n"; exit(0);
    case 'next': $j = mtNext($who(1)); if ($j) echo json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0);
    case 'hold': exit(mtHold($id(), $who(2)) ? 0 : 1);
    case 'seg': $i = $id(); $n = (int) ($a[2] ?? -1); $out = fopen('php://stdout', 'wb'); exit(mtSegBytes($i, $n, $out) > 0 ? 0 : 1);
    case 'done': $say(mtDone($id(), $who(2), (string) stream_get_contents(STDIN), (string) ($a[3] ?? '')));
    case 'fail': $say(mtFail($id(), $who(2), (string) stream_get_contents(STDIN)));
    case 'transcripts': echo json_encode(mtDoneList(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0);
    case 'text': $f = mtDir($id()) . '/transcript.txt'; if (!is_file($f)) exit(1); readfile($f); exit(0);
    case 'sweep': echo json_encode(mtSweep(), JSON_UNESCAPED_SLASHES), "\n"; exit(0);
    default: fwrite(STDERR, "usage: php jvmeet.php peek|next <laptop|cloud> | hold <id> <who> | seg <id> <n> | done <id> <who> [model] | fail <id> <who> | transcripts | text <id> | sweep\n"); exit(2);
}

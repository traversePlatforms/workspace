<?php
/* The Prospect Desk's sender (desk.php sendQueue) on throwaway data: timed messages ('after'), follow-ups, bounced and unsubscribed
   companies, the once-only lock. No server, no network, no real mail: DESK_DATA points at a fresh temp folder and DESK_MAIL_MOCK
   writes each "sent" message to a file. Written 2026-11-06, the night the 1,117 free-map messages were queued.
   Run:  php traverse/prospect-desk/tests/desk-queue-test.php */
declare(strict_types=1);
date_default_timezone_set('America/Denver');
$DESK = dirname(__DIR__) . '/app/api/desk.php';
$T = sys_get_temp_dir() . '/desk-queue-' . bin2hex(random_bytes(4)); mkdir($T, 0777, true);
$MAIL = $T . '/mail.log';
$pass = 0; $fail = 0;
function t(bool $ok, string $m): void { global $pass, $fail; echo ($ok ? '  PASS  ' : '  FAIL  ') . $m . "\n"; $ok ? $pass++ : $fail++; }
function j(string $f) { global $T; return json_decode((string) @file_get_contents($T . '/' . $f), true); }
function rows(string $f): array { global $T; $o = []; foreach (@file($T . '/' . $f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) $o[] = json_decode($l, true); return $o; }
function sent(): array { global $MAIL; $o = []; foreach (@file($MAIL, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) $o[] = json_decode($l, true); return $o; }
function events(string $t): array { return array_values(array_filter(rows('events.log'), fn($r) => ($r['t'] ?? '') === $t)); }
/** one run of the cron job, as morning-email.php starts it: php desk.php sendqueue N */
function run(int $n = 15, string $failAt = ''): string {
    global $DESK, $T, $MAIL;
    $cmd = 'php -d display_errors=1 -d error_reporting=E_ALL ' . escapeshellarg($DESK) . ' sendqueue ' . $n . ' 2>&1';   /* every PHP warning shows in the output */
    $env = ['DESK_DATA' => $T, 'DESK_MAIL_MOCK' => $MAIL, 'DESK_GAP' => '0', 'DESK_MAIL_MOCK_FAIL' => $failAt] + getenv();
    $p = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
    $out = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    return $out;
}
function lead(string $id, string $status = 'new'): array {
    return ['id' => $id, 'name' => 'Co ' . $id, 'city' => 'Denver', 'trade' => 'roofing', 'person' => '', 'email' => $id . '@example-co.test', 'status' => $status, 'phone' => '', 'site' => ''];
}
function msg(string $id, int $after, array $x = []): array {
    return $x + ['id' => $id, 'to' => $id . '@example-co.test', 'subject' => 'Map for ' . $id, 'body' => 'Hello ' . $id, 'style' => 'plain', 'unsub' => 'https://x/u', 'by' => 'Test', 'at' => time(), 'after' => $after];
}
function fresh(array $leads, array $queue, array $events = []): void {
    global $T, $MAIL;
    foreach (glob($T . '/*') ?: [] as $f) @unlink($f);
    file_put_contents($T . '/seed.json', json_encode(['leads' => array_values($leads)]));
    file_put_contents($T . '/events.log', $events ? implode("\n", array_map(fn($e) => json_encode($e), $events)) . "\n" : '');
    file_put_contents($T . '/events.log', json_encode(['t' => 'settings', 's' => ['address' => '1 Main St, Denver CO', 'cap' => 360], 'by' => 'Test', 'at' => time() - 100]) . "\n", FILE_APPEND);
    file_put_contents($T . '/queue.json', json_encode($queue));
    @unlink($MAIL);
}
$now = time(); $H = 3600;

echo "Timed sends ('after')\n";
fresh([lead('a1'), lead('a2'), lead('a3'), lead('a4')],
      [msg('a1', $now + 2 * $H), msg('a2', $now - 60), msg('a3', $now + 5 * $H), msg('a4', $now - 10)]);
$o = run();
$s = sent(); $q = j('queue.json');
t(count($s) === 2 && $s[0]['to'] === 'a2@example-co.test' && $s[1]['to'] === 'a4@example-co.test', 'the two due messages go, in queue order, the not-due ones in front of them are passed over (' . trim($o) . ')');
t(count($q) === 2 && $q[0]['id'] === 'a1' && $q[1]['id'] === 'a3' && (int) $q[0]['after'] === $now + 2 * $H, 'the not-due messages keep their place and their time');
t(str_contains($o, 'nothing due yet (2 waiting)'), 'the run says what is still waiting');
$st = events('status');
t(count($st) === 2 && $st[0]['status'] === 'emailed' && $st[0]['id'] === 'a2', 'a Not contacted company becomes Emailed when its message goes');
fresh([lead('b1')], [msg('b1', $now + 60)]);
$o = run(); t(sent() === [] && count(j('queue.json')) === 1, 'a message due in a minute is not sent early');
fresh([lead('c1')], [msg('c1', 0)], []);
run(); t(count(sent()) === 1, "a message with no 'after' (queued from the desk) goes as before");

echo "Follow-ups\n";
$fu = fn($id) => msg($id, $now - 5, ['followup' => 1]);
fresh([lead('f1', 'emailed'), lead('f2', 'talking'), lead('f3', 'demo'), lead('f4', 'new'), lead('f5', 'notnow'), lead('f6', 'no'), lead('f7', 'called')],
      [$fu('f1'), $fu('f2'), $fu('f3'), $fu('f4'), $fu('f5'), $fu('f6'), $fu('f7')]);
$o = run();
$s = sent(); $sk = events('skipped');
t(count($s) === 1 && $s[0]['to'] === 'f1@example-co.test', 'a follow-up goes only to a company still at Emailed');
t(count($sk) === 6, 'the other six are skipped, not sent (Talking, Demo booked, Not contacted, Not now, No, Called)');
t(j('queue.json') === [], 'skipped follow-ups leave the queue (they are not retried)');
foreach ($sk as $r) t(str_starts_with((string) $r['why'], 'follow-up not needed') || str_starts_with((string) $r['why'], 'knocked off'), $r['id'] . ' skipped: ' . $r['why']);
/* the first email of a batch turns Not contacted into Emailed, so the follow-up queued behind it goes on its day */
fresh([lead('g1')], [msg('g1', $now - 20), msg('g1', $now - 10, ['followup' => 1, 'subject' => 'Follow-up g1'])]);
run(); $s = sent();
t(count($s) === 2 && $s[1]['subject'] === 'Follow-up g1', 'first email then its follow-up: both go once the company is Emailed');
/* the first email never went (the company was not contacted): its follow-up is skipped */
fresh([lead('g2')], [msg('g2', $now - 10, ['followup' => 1])]);
run(); t(sent() === [] && count(events('skipped')) === 1, 'a follow-up with no first email behind it is skipped (still Not contacted)');

echo "Never to these\n";
fresh([lead('u1'), lead('u2'), lead('u3'), lead('u4', 'customer'), lead('u5')],
      [msg('u1', $now - 1), msg('u2', $now - 1), msg('u3', $now - 1), msg('u4', $now - 1), msg('u5', $now - 1, ['to' => 'old@example-co.test'])],
      [['t' => 'unsub', 'id' => 'u1', 'by' => 'the company', 'at' => $now - 50], ['t' => 'bounce', 'id' => 'u2', 'to' => 'u2@example-co.test', 'by' => 'Bounce log', 'at' => $now - 50]]);
$o = run(); $s = sent(); $sk = events('skipped');
t(count($s) === 1 && $s[0]['to'] === 'u3@example-co.test', 'unsubscribed, bounced, customer and changed-address companies are skipped; the plain one goes');
$why = array_column($sk, 'why', 'id');
t(($why['u1'] ?? '') === 'asked not to be emailed' && ($why['u2'] ?? '') === 'email address cannot take mail' && ($why['u4'] ?? '') === 'knocked off or a customer' && ($why['u5'] ?? '') === 'email changed since it was queued', 'each skip says why');
t(j('queue.json') === [], 'nothing is left waiting');
/* a bounce logged after the message was queued (the hourly bounce scan) still stops it */
fresh([lead('u6')], [msg('u6', $now - 1)]);
file_put_contents($T . '/events.log', json_encode(['t' => 'bounce', 'id' => 'u6', 'to' => 'u6@example-co.test', 'by' => 'Bounce log', 'at' => $now]) . "\n", FILE_APPEND);
$o = run(); t(sent() === [] && count(events('skipped')) === 1, 'a bounce logged after queueing (the hourly scan) stops the send');
t(!str_contains($o, 'Warning') && !str_contains($o, 'Undefined'), 'replaying a bounce row raises no PHP warning (noteKey on a row with no note)');

echo "The mail server fails (nothing may be lost)\n";
fresh([lead('r1'), lead('r2')], [msg('r1', $now - 9), msg('r2', $now - 8)]);
$o = run(15, 'connect'); $q = j('queue.json');
t(sent() === [] && count($q) === 2 && $q[0]['id'] === 'r1' && $q[1]['id'] === 'r2' && empty($q[0]['tries']) && (int) $q[0]['after'] === $now - 9, 'cannot reach the mail server: the message goes back to the FRONT untouched (no try counted), the rest in order, nothing sent');
t(count(events('sendfail')) === 1 && str_contains($o, 'mail server problem (connect): stopped'), 'the run stops at once (one sendfail row, not three in a row)');
for ($i = 0; $i < 5; $i++) run(15, 'connect');
t(count(j('queue.json')) === 2 && sent() === [], 'an outage lasting five more runs still loses nothing');
$o = run(); t(count(sent()) === 2 && j('queue.json') === [], 'when the server is back, both go');
foreach ([['auth', 'the login'], ['starttls', 'TLS'], ['greeting', 'no greeting'], ['ehlo-tls', 'EHLO after TLS']] as [$stg, $what]) {
    fresh([lead('r3'), lead('r4')], [msg('r3', $now - 9), msg('r4', $now - 8)]);
    $o = run(15, $stg); $q = j('queue.json');
    t(str_contains($o, "mail server problem ($stg): stopped") && count($q) === 2 && $q[0]['id'] === 'r3' && count(events('sendfail')) === 1 && sent() === [], $what . ' failing: stop, front, nothing lost');
}
foreach ([['data', '421 4.7.0 Try again later, closing connection'], ['to', '550-5.4.5 Daily user sending limit exceeded'], ['data', '452 4.5.3 Too many recipients'], ['from', '451 4.3.0 Temporary system problem']] as [$stg, $said]) {
    fresh([lead('r5'), lead('r6')], [msg('r5', $now - 9), msg('r6', $now - 8)]);
    $o = run(15, $stg . '|' . $said); $q = j('queue.json');
    t(count($q) === 2 && $q[0]['id'] === 'r5' && empty($q[0]['tries']) && sent() === [] && count(events('sendfail')) === 1, "the server's own trouble at $stg (\"$said\"): stop, front, no try counted");
}
/* one address or message the server refuses: a try counted, an hour's wait, the run goes on with the others; dropped after three tries */
fresh([lead('r7'), lead('r8')], [msg('r7', $now - 9), msg('r8', $now - 8)]);
$o = run(15, 'to|550 5.1.1 The email account that you tried to reach does not exist'); $q = j('queue.json');
t(count($q) === 2 && $q[0]['id'] === 'r7' && (int) $q[0]['tries'] === 1 && (int) $q[0]['after'] >= $now + 3500 && (int) $q[1]['tries'] === 1 && count(events('sendfail')) === 2 && sent() === [], 'an address refused (5xx at RCPT TO): a try counted, it waits an hour, and the run went on to the next message (both tried once)');
$again = function () use ($T) { $Q = json_decode((string) file_get_contents($T . '/queue.json'), true); foreach ($Q as &$m) $m['after'] = time() - 1; file_put_contents($T . '/queue.json', json_encode($Q)); };   /* the hour has passed */
$again(); run(15, 'to|550 5.1.1 no such user'); $q = j('queue.json');
t(count($q) === 2 && (int) $q[0]['tries'] === 2, 'the second try the hour after: tries 2, still waiting');
$again(); run(15, 'to|550 5.1.1 no such user'); $q = j('queue.json');
t($q === [] && count(events('sendfail')) === 6, 'the third refusal drops it (three sendfail rows each), not kept for ever');
fresh([lead('r7'), lead('r8')], [msg('r7', $now - 9), msg('r8', $now - 8)]);
run(15, 'to|550 5.1.1 no such user'); $again(); $o = run(); $s = sent();
t(count($s) === 2 && j('queue.json') === [], 'a refused message is tried again the hour after and goes when the server takes it');
fresh([lead('r9')], [msg('r9', $now - 9)]);
$o = run(15, 'data|554 5.7.1 Message rejected'); t(count(j('queue.json')) === 1 && !str_contains($o, 'Warning') && !str_contains($o, 'Fatal') && !str_contains($o, 'closed'), 'a failure after the pop puts the message back cleanly (no closed-handle error)');

echo "Holds\n";
fresh([lead('h1')], [msg('h1', $now - 1)]);
file_put_contents($T . '/send-after.txt', (string) ($now + 3600));
$o = run(); t(sent() === [] && str_contains($o, 'held until'), 'send-after.txt holds everything');
fresh([lead('h2')], [msg('h2', $now - 1)]);
file_put_contents($T . '/events.log', json_encode(['t' => 'settings', 's' => ['address' => '', 'cap' => 360], 'by' => 'Test', 'at' => $now]) . "\n", FILE_APPEND);
$o = run(); t(sent() === [] && str_contains($o, 'no postal address'), 'no postal address: nothing goes');
fresh([lead('h3'), lead('h4')], [msg('h3', $now - 1), msg('h4', $now - 1)]);
file_put_contents($T . '/events.log', json_encode(['t' => 'settings', 's' => ['address' => '1 Main St', 'cap' => 1], 'by' => 'Test', 'at' => $now]) . "\n", FILE_APPEND);
$o = run(); t(count(sent()) === 1 && count(j('queue.json')) === 1 && str_contains($o, "cap reached"), "today's cap stops the run with the rest still waiting");
fresh([lead('h5')], [msg('h5', $now - 1)]);
$o = run(1); t(count(sent()) === 1 && str_contains($o, 'sent 1'), 'sendqueue 1 sends one');

echo "Two runs at once\n";
$L = []; $Q = []; for ($i = 0; $i < 6; $i++) { $L[] = lead('k' . $i); $Q[] = msg('k' . $i, $now - 1); }
fresh($L, $Q);
$env = ['DESK_DATA' => $T, 'DESK_MAIL_MOCK' => $MAIL, 'DESK_GAP' => '1'] + getenv();
$ps = []; $pipes = [];
for ($i = 0; $i < 2; $i++) { $ps[$i] = proc_open('php ' . escapeshellarg($DESK) . ' sendqueue 15 2>&1', [1 => ['pipe', 'w']], $pipes[$i], null, $env); }
$outs = []; foreach ($ps as $i => $p) { $outs[$i] = stream_get_contents($pipes[$i][1]); fclose($pipes[$i][1]); proc_close($p); }
$s = sent(); $tos = array_column($s, 'to');
t(count($s) === 6 && count(array_unique($tos)) === 6, 'six messages, six sends, none twice (' . count($s) . ' sent, ' . count(array_unique($tos)) . ' distinct)');
t(count(array_filter($outs, fn($o) => str_contains($o, 'another run is sending'))) === 1, 'the second run stepped aside');

echo "\n$pass passed, $fail failed\n";
foreach (glob($T . '/*') ?: [] as $f) @unlink($f); @rmdir($T);
exit($fail ? 1 : 0);

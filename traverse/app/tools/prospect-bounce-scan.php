<?php
/* Prospect Desk bounces, step 1 (2 Nov, Matthew: "run a bounce scan every hour"; runs from the hourly morning-email.php). Read ONLY the bounce notices
   (mailer-daemon / postmaster) in the Traverse inbox through the assistant's Gmail connection, and print the addresses that failed with
   the short reason, one JSON line each. Reads nothing else, changes nothing in Gmail. Run from assistant-private/. */
declare(strict_types=1);
$vendor = getcwd() . '/vendor/autoload.php'; if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google'] as $f) require getcwd() . '/lib/' . $f . '.php';
$acct = ''; foreach (array_keys(jget('accounts.json')) as $e) if (stripos($e, 'traverseplatforms') !== false) $acct = $e;
if ($acct === '') { fwrite(STDERR, "no Traverse inbox connected\n"); exit(1); }
$q = 'from:(mailer-daemon OR postmaster) newer_than:' . ((int) ($argv[1] ?? 3) ?: 3) . 'd';   /* the last 3 days; already-logged ones are skipped by step 2 */
$ids = []; $page = '';
do {
    $r = gmail($acct, 'GET', 'messages?maxResults=100&q=' . rawurlencode($q) . ($page !== '' ? '&pageToken=' . $page : ''));
    if (!empty($r['error'])) { fwrite(STDERR, 'gmail: ' . json_encode($r['error']) . "\n"); exit(1); }
    foreach ((array) ($r['messages'] ?? []) as $m) $ids[] = $m['id'];
    $page = (string) ($r['nextPageToken'] ?? '');
} while ($page !== '');
fwrite(STDERR, count($ids) . " bounce notices\n");
foreach ($ids as $id) {
    $m = gmail($acct, 'GET', 'messages/' . $id . '?format=metadata&metadataHeaders=X-Failed-Recipients&metadataHeaders=Subject&metadataHeaders=Date');
    $h = []; foreach ((array) ($m['payload']['headers'] ?? []) as $x) $h[strtolower($x['name'])] = $x['value'];
    $snip = html_entity_decode((string) ($m['snippet'] ?? ''), ENT_QUOTES);
    $to = trim((string) ($h['x-failed-recipients'] ?? ''));
    if ($to === '' && preg_match('/delivered to\s+([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[a-z]{2,})/i', $snip, $mm)) $to = $mm[1];
    $why = preg_match('/address couldn.t be found|address not found|unable to receive mail/i', $snip) ? 'address not found'
         : (preg_match('/domain .* couldn.t be found|DNS|no such domain/i', $snip) ? 'domain not found'
         : (preg_match('/blocked|rejected|policy|spam/i', $snip) ? 'refused' : (preg_match('/temporar|delayed|will retry/i', $snip) ? 'delayed' : 'other')));
    echo json_encode(['to' => strtolower($to), 'why' => $why, 'at' => (int) (($m['internalDate'] ?? 0) / 1000), 'subject' => mb_substr((string) ($h['subject'] ?? ''), 0, 60)], JSON_UNESCAPED_SLASHES), "\n";
}

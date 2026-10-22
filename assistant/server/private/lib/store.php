<?php
/* Matthew's assistant (2026-10-22): small JSON files in data/, beside this folder and never in public_html or git.
   config.json  the password hash, the Anthropic key, the Google client, the settings (0600)
   accounts.json  each connected Google account: its refresh token, its label, its last check
   items.json  what each email was sorted as (a summary, never the whole email), the last 21 days
   seen.json  the message ids already sorted, per account, so nothing is paid for twice */
declare(strict_types=1);

function aDataDir(): string {
    $d = dirname(__DIR__) . '/data';
    if (!is_dir($d)) mkdir($d, 0700, true);
    return $d;
}
function jget(string $name, array $def = []): array {
    $f = aDataDir() . '/' . $name;
    if (!is_file($f)) return $def;
    $j = json_decode((string) file_get_contents($f), true);
    return is_array($j) ? $j : $def;
}
function jput(string $name, array $v): bool {
    $f = aDataDir() . '/' . $name;
    $t = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) return false;
    @chmod($t, 0600);
    return rename($t, $f);
}
/** read-modify-write one file under a lock, so the 10-minute check and the page never overwrite each other */
function jedit(string $name, callable $fn): array {
    $lk = fopen(aDataDir() . '/' . $name . '.lock', 'c');
    flock($lk, LOCK_EX);
    try { $v = $fn(jget($name)); jput($name, $v); return $v; }
    finally { flock($lk, LOCK_UN); fclose($lk); }
}
function cfg(): array { return jget('config.json'); }
function alog(string $what, array $extra = []): void {
    @file_put_contents(aDataDir() . '/assistant.log', json_encode(['at' => date('c'), 'what' => $what] + $extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/** the settings, with their defaults */
function settings(): array {
    return (cfg()['settings'] ?? []) + [
        'skipTabs' => true,        // leave Gmail's Promotions, Social, Updates and Forums tabs alone (they are rarely worth paying to sort)
        'autoDraft' => true,       // write a reply draft for every email that needs one
        'perRun' => 20,            // at most this many new emails per account per check
        'voice' => "Plain and short. No exclamation marks, no filler, no 'I hope this finds you well'. Say the thing, then stop.",
    ];
}

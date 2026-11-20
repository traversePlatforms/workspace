<?php
declare(strict_types=1);
/* Opens and clicks for every automatic email, one way (2026-11-20, Matthew: "I want to track everything we can data is key").
 * Sixfold 365's customer emails were first (2026-11-18, rounds.php a365Track/a365SendTracked); this file is the same approach for every other
 * sender on traverseplatforms.com, so the one tracker (public_html/m/, source traverse/app/mailtrack/index.php) counts them all:
 *   - an email gets an id (20 hex, random; nothing about the person in it) and a 1x1 image at the end of its HTML (m/?o=<id>)
 *   - the links a caller allows go through m/?c=<id>.<n> and forward at once to that email's own address n (no open redirect)
 *   - the send is noted BEFORE it goes in <store>/mail-sends.log (t send, id, k kind, at, v, src, links), a failed send after it (t fail);
 *     the tracker writes open / click / scan rows to <store>/mail-events.log beside it. Never an address, a name or an IP.
 * Stores: Sixfold's own (sixfold-data/rounds, the same log as its customer emails: morning email, end of day, Saturday week, website form,
 * monthly profit); Traverse's (traverse-shared/mailtrack: demo bookings, sign-up and setup, notes to Matthew, the post calendar alert); and each
 * client install's own data folder (<id>-data/rounds: its customer care emails and its end-of-day report). Outbox reads them all.
 * A plain-text email gets an HTML copy of the same words (mtTextHtml) so the image has somewhere to go; the words are not changed.
 * Never wrapped: sign-in, setup, password, Stripe, pay and unsubscribe links on the emails that carry them (the caller passes no 'wrap', or a
 * rule that leaves them out); a newsletter unsubscribe (action=nlunsub) and the tracker itself are never wrapped at all.
 * Real sends only: callers do not call this for tests, previews, the practice copy, mocks or the showcase editions.
 * Opens are rough (Apple Mail loads every image as the email arrives, Outlook often blocks images); clicks are the number to trust.
 * Loaded beside every install's API (public_html/api/), by the website's demo/_lib.php, by sixfold-tools and by the post calendar. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const MT_BASE = 'https://traverseplatforms.com/m/';

function mtTestEnv(): bool { return PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server'; }
function mtEnv(string $k): string { return mtTestEnv() ? (string) getenv($k) : ''; }   /* the test copies only */
/** the tracker's address (MAILTRACK_BASE or A365_TRACK_BASE in a test copy) */
function mtBase(): string {
    foreach (['MAILTRACK_BASE', 'A365_TRACK_BASE'] as $k) { $t = mtEnv($k); if (preg_match('#^https?://[a-z0-9.:-]+/[a-z0-9/-]*$#i', $t)) return $t; }
    return MT_BASE;
}
/** the folder that holds public_html (this file sits in public_html/api) */
function mtRoot(): string { return dirname(__DIR__, 2); }
/** Traverse's own store, made on first use */
function mtTraverseDir(): string {
    $d = mtEnv('MAILTRACK_TRAVERSE_DIR') ?: mtRoot() . '/traverse-shared/mailtrack';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return is_dir($d) ? $d : '';
}
/** Sixfold's store (its customer emails' log) */
function mtSixfoldDir(): string { $d = mtEnv('MAILTRACK_SIXFOLD_DIR') ?: mtRoot() . '/sixfold-data/rounds'; return is_dir($d) ? $d : ''; }

/** the same words as simple HTML, links clickable; $mono keeps a table's columns (the profit email) */
function mtTextHtml(string $text, bool $mono = false): string {
    $e = htmlspecialchars(str_replace("\r", '', $text), ENT_QUOTES, 'UTF-8');
    $e = (string) preg_replace('~\bhttps://[^\s<>()"\']+[^\s<>().,;:!?"\']~i', '<a href="$0">$0</a>', $e);   /* already escaped: &amp; stays &amp; in the href */
    $body = $mono ? '<pre style="font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.4;white-space:pre-wrap;margin:0">' . $e . '</pre>'
        : '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">' . str_replace("\n", "<br>\n", $e) . '</div>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' . $body . '</body></html>';
}
/** a link that is an ordinary page of the Traverse website (no query, no app folder, not the sign-up or find-my-app pages): the only kind
    the sign-up and setup emails may count */
function mtSitePage(string $u): bool {
    $p = parse_url($u); if (!is_array($p) || strtolower((string) ($p['host'] ?? '')) !== 'traverseplatforms.com' || isset($p['query']) || isset($p['fragment'])) return false;
    $path = (string) ($p['path'] ?? '/');
    return !preg_match('#^/(start|find|api|m|demo/(api|manage))\b|/[a-z]{1,3}-[0-9a-f]{6,8}(/|$)|summit-|practice-|outbox-|peak-|prospects-|posts-#i', $path);
}
/** an email made countable: ['text', 'html', 'id']. $o: src (which install or sender), v (the version or the email within a kind),
    wrap (null: no link is counted; a callable(url): bool says which may be), twin (default true: a plain-text email gets an HTML copy),
    mono (the HTML copy in a fixed-width font). Nothing is changed (id '') when the note cannot be written: then the links would lead nowhere. */
function mtTrack(string $dir, string $kind, string $text, string $html, array $o = []): array {
    $plain = ['text' => $text, 'html' => $html, 'id' => ''];
    if ($dir === '' || (!is_dir($dir) && !@mkdir($dir, 0700, true))) return $plain;
    $id = bin2hex(random_bytes(10)); $base = mtBase(); $links = []; $wrap = $o['wrap'] ?? null;
    if ($html === '' && ($o['twin'] ?? true)) $html = mtTextHtml($text, !empty($o['mono']));
    $num = function (string $u) use (&$links, $base, $wrap): ?int {
        if (!is_callable($wrap) || !preg_match('#^https://[^\s<>"\'\\\\]{4,1500}$#iD', $u) || str_contains($u, 'action=nlunsub') || str_starts_with($u, $base) || !$wrap($u)) return null;
        $i = array_search($u, $links, true); if ($i === false) { $links[] = $u; $i = count($links) - 1; } return (int) $i;
    };
    $h2 = (string) preg_replace_callback('/\bhref="([^"]+)"/i', function ($m) use ($num, $base, $id) {
        $i = $num(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')); return $i === null ? $m[0] : 'href="' . htmlspecialchars($base . '?c=' . $id . '.' . $i, ENT_QUOTES, 'UTF-8') . '"';
    }, $html);
    $t2 = (string) preg_replace_callback('~\bhttps://[^\s<>()"\']+[^\s<>().,;:!?"\']~i', function ($m) use ($num, $base, $id) { $i = $num($m[0]); return $i === null ? $m[0] : $base . '?c=' . $id . '.' . $i; }, $text);
    if ($h2 !== '') {
        $img = '<img src="' . htmlspecialchars($base . '?o=' . $id, ENT_QUOTES, 'UTF-8') . '" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">';
        $p = strripos($h2, '</body>'); $h2 = $p === false ? $h2 . $img : substr($h2, 0, $p) . $img . substr($h2, $p);
    }
    $row = ['t' => 'send', 'id' => $id, 'k' => $kind, 'at' => time()] + array_filter(['v' => (string) ($o['v'] ?? ''), 'src' => (string) ($o['src'] ?? '')], 'strlen') + ['links' => $links];
    if (!@file_put_contents($dir . '/mail-sends.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX)) return $plain;
    return ['text' => $t2, 'html' => $h2, 'id' => $id];
}
/** the send did not go: its counts are left out */
function mtFail(string $dir, string $id, string $stage): void {
    if ($dir === '' || $id === '') return;
    @file_put_contents($dir . '/mail-sends.log', json_encode(['t' => 'fail', 'id' => $id, 'at' => time(), 'stage' => mb_substr($stage, 0, 40)], JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/** text + HTML as one multipart/alternative body for a sender that takes its own MIME (smtp_send with a Content-Type header):
    [body, the Content-Type header line] */
function mtMime(string $text, string $html): array {
    $b = 'mta' . bin2hex(random_bytes(8)); $e = "\r\n"; $b64 = fn(string $s) => chunk_split(base64_encode($s), 76, $e);
    $body = '--' . $b . $e . 'Content-Type: text/plain; charset=UTF-8' . $e . 'Content-Transfer-Encoding: base64' . $e . $e . $b64($text)
          . '--' . $b . $e . 'Content-Type: text/html; charset=UTF-8' . $e . 'Content-Transfer-Encoding: base64' . $e . $e . $b64($html)
          . '--' . $b . '--' . $e;
    return [$body, 'Content-Type: multipart/alternative; boundary="' . $b . '"'];
}

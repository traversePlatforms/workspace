<?php
/* Reading a Gmail message into what the sorter needs, and writing a reply draft into the same thread. */
declare(strict_types=1);

function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64uDec(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)); }

/** the newest inbox messages not yet sorted (ids only) */
function newMessageIds(string $email, array $seen, int $max): array {
    $q = 'in:inbox newer_than:3d';
    if (settings()['skipTabs']) $q .= ' -category:promotions -category:social -category:updates -category:forums';
    $r = gmail($email, 'GET', 'messages?' . http_build_query(['q' => $q, 'maxResults' => 50]));
    if (($r['_status'] ?? 0) !== 200) return ['error' => 'Gmail said ' . ($r['error']['message'] ?? ('HTTP ' . ($r['_status'] ?? 0)))];
    $ids = [];
    foreach ((array) ($r['messages'] ?? []) as $m) if (!isset($seen[$m['id']])) $ids[] = (string) $m['id'];
    return ['ids' => array_slice(array_reverse($ids), 0, $max)];   /* oldest first, so a busy morning is worked through in order */
}
/** one message: its headers, and its text with quoted history and signatures trimmed off, at most 8,000 characters */
function readMessage(string $email, string $id): ?array {
    $r = gmail($email, 'GET', 'messages/' . rawurlencode($id) . '?format=full');
    if (($r['_status'] ?? 0) !== 200) return null;
    $h = [];
    foreach ((array) ($r['payload']['headers'] ?? []) as $x) $h[strtolower((string) $x['name'])] = (string) $x['value'];
    $text = partText((array) ($r['payload'] ?? []), 'text/plain');
    if (trim($text) === '') $text = htmlToText(partText((array) ($r['payload'] ?? []), 'text/html'));
    return ['id' => $id, 'threadId' => (string) ($r['threadId'] ?? ''), 'labels' => (array) ($r['labelIds'] ?? []),
        'from' => $h['from'] ?? '', 'replyTo' => $h['reply-to'] ?? '', 'to' => $h['to'] ?? '', 'cc' => $h['cc'] ?? '', 'subject' => $h['subject'] ?? '(no subject)',
        'date' => $h['date'] ?? '', 'messageId' => $h['message-id'] ?? '', 'references' => $h['references'] ?? '',
        'listUnsubscribe' => isset($h['list-unsubscribe']), 'autoSubmitted' => ($h['auto-submitted'] ?? 'no') !== 'no' || isset($h['precedence']) && preg_match('/bulk|list|junk/i', $h['precedence']),
        'snippet' => html_entity_decode((string) ($r['snippet'] ?? ''), ENT_QUOTES | ENT_HTML5), 'text' => mb_substr(trimQuoted($text), 0, 8000)];
}
function partText(array $p, string $mime): string {
    if (($p['mimeType'] ?? '') === $mime && !empty($p['body']['data'])) return b64uDec((string) $p['body']['data']);
    foreach ((array) ($p['parts'] ?? []) as $sub) { $t = partText((array) $sub, $mime); if ($t !== '') return $t; }
    return '';
}
function htmlToText(string $html): string {
    $html = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', '', $html) ?? $html;
    $html = preg_replace('#<(br|/p|/div|/li|/tr|/h\d)[^>]*>#i', "\n", $html) ?? $html;
    return trim(preg_replace("/\n{3,}/", "\n\n", html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5)) ?? '');
}
/** cut the quoted earlier messages ("On ... wrote:", "> " lines, the original-message block) */
function trimQuoted(string $t): string {
    $t = str_replace("\r\n", "\n", $t);
    foreach (['/\nOn .{5,200}wrote:\s*\n/s', '/\n-{2,} ?Original Message ?-{2,}/i', '/\nFrom: .+\nSent: /'] as $re) { $parts = preg_split($re, $t, 2); if ($parts && count($parts) === 2 && strlen(trim($parts[0])) > 10) $t = $parts[0]; }
    $lines = array_filter(explode("\n", $t), fn($l) => !str_starts_with(ltrim($l), '>'));
    return trim(implode("\n", $lines));
}
function addrOf(string $h): string { return preg_match('/<([^>]+)>/', $h, $m) ? strtolower(trim($m[1])) : strtolower(trim($h)); }
function nameOf(string $h): string { $n = trim(preg_replace('/<[^>]+>/', '', $h) ?? '', " \"'"); return $n !== '' ? $n : addrOf($h); }
/** a reply draft in the message's own thread; Gmail fills in From. Returns the draft id, or null. */
function makeDraft(string $email, array $m, string $body): ?string {
    $to = $m['replyTo'] !== '' ? $m['replyTo'] : $m['from'];
    $subj = preg_match('/^\s*re:/i', $m['subject']) ? $m['subject'] : 'Re: ' . $m['subject'];
    $enc = fn($s) => preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $refs = trim($m['references'] . ' ' . $m['messageId']);
    $raw = 'To: ' . str_replace(["\r", "\n"], ' ', $to) . "\r\n" . 'Subject: ' . $enc(str_replace(["\r", "\n"], ' ', $subj)) . "\r\n"
        . ($m['messageId'] !== '' ? 'In-Reply-To: ' . $m['messageId'] . "\r\n" : '') . ($refs !== '' ? 'References: ' . $refs . "\r\n" : '')
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body));
    $r = gmail($email, 'POST', 'drafts', ['message' => ['raw' => b64u($raw), 'threadId' => $m['threadId']]]);
    return ($r['_status'] ?? 0) === 200 ? (string) ($r['id'] ?? '') : null;
}

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
/** the reply as a raw RFC 2822 message in the original's thread (To the sender, or its Reply-To; Re: subject; In-Reply-To and References);
    Gmail fills in From with the inbox's own address */
function replyRaw(array $m, string $body): string {
    $to = $m['replyTo'] !== '' ? $m['replyTo'] : $m['from'];
    $subj = preg_match('/^\s*re:/i', $m['subject']) ? $m['subject'] : 'Re: ' . $m['subject'];
    $enc = fn($s) => preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $refs = trim($m['references'] . ' ' . $m['messageId']);
    $one = fn($s) => str_replace(["\r", "\n"], ' ', $s);
    return 'To: ' . $one($to) . "\r\n" . 'Subject: ' . $enc($one($subj)) . "\r\n"
        . ($m['messageId'] !== '' ? 'In-Reply-To: ' . $m['messageId'] . "\r\n" : '') . ($refs !== '' ? 'References: ' . $refs . "\r\n" : '')
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($body));
}
/** a reply draft in the message's own thread. Returns the draft id, or null. */
function makeDraft(string $email, array $m, string $body): ?string {
    $r = gmail($email, 'POST', 'drafts', ['message' => ['raw' => b64u(replyRaw($m, $body)), 'threadId' => $m['threadId']]]);
    return ($r['_status'] ?? 0) === 200 ? (string) ($r['id'] ?? '') : null;
}
/** a draft's text as Gmail holds it now (Matthew may have edited it in Gmail); null when it is gone */
function draftText(string $email, string $draftId): ?string {
    $r = gmail($email, 'GET', 'drafts/' . rawurlencode($draftId) . '?format=full');
    if (($r['_status'] ?? 0) !== 200) return null;
    return partText((array) ($r['message']['payload'] ?? []), 'text/plain');
}
/** the draft rewritten with Matthew's edits; a new draft when the old one is gone. Returns the draft id. */
function saveDraft(string $email, array $m, ?string $draftId, string $body): ?string {
    if ($draftId) {
        $r = gmail($email, 'PUT', 'drafts/' . rawurlencode($draftId), ['id' => $draftId, 'message' => ['raw' => b64u(replyRaw($m, $body)), 'threadId' => $m['threadId']]]);
        if (($r['_status'] ?? 0) === 200) return (string) ($r['id'] ?? $draftId);
    }
    return makeDraft($email, $m, $body);
}
/** send the reply: as the saved draft when there is one (so Gmail drops the draft), else as a new message in the thread. Only ever called
    from the page's Send button, after Matthew confirms. */
function sendReply(string $email, array $m, ?string $draftId, string $body): array {
    $did = saveDraft($email, $m, $draftId, $body);
    if ($did) { $r = gmail($email, 'POST', 'drafts/send', ['id' => $did]); }
    else { $r = gmail($email, 'POST', 'messages/send', ['raw' => b64u(replyRaw($m, $body)), 'threadId' => $m['threadId']]); }
    return (($r['_status'] ?? 0) === 200) ? ['ok' => true, 'id' => (string) ($r['id'] ?? '')] : ['ok' => false, 'error' => 'Gmail did not send it: ' . ($r['error']['message'] ?? ('HTTP ' . ($r['_status'] ?? 0)))];
}

<?php
/* Write an email (2026-11-19, Matthew for Cai: "a follow up email ... she wants to be able to customize it to who she is talking to ... a
 * box in the peak desk app ... she can fill it out with whatever she wants to say click send and it will send it to the prospect").
 *
 * On every card (sponsors and expo): To (a contact with an email, or one typed), Subject, the message, optionally started from a saved
 * template, "Insert my booking link" ({book}), Preview, Send. It goes out as Peak Partnerships <partnerships@peakpickleball.us> (the shared
 * mailbox, since 2026-11-19; set in Outbox, Peak, Settings) through the Peak email sender (outbox-092b0f/peak/lib.php, pmDeskSend: its
 * Microsoft token, its log, its own once-only check by ref). Nothing here holds a token.
 *
 *   - OFF until an admin turns "Desk emails" on in More, Settings (desk-settings.json, key "deskmail"). While off, Send is greyed; Preview,
 *     Copy and "Open in my mail app" still work.
 *   - Signed with the sender's own signature (More, My email and booking link; their desk name and "Peak Pickleball" until they change
 *     it), then Peak's address and a one-line way to opt out (the law wants both in a sales email).
 *   - Reply-To: the sender's own address when they set one, so their replies go to them; otherwise (the default) replies come to Peak
 *     Partnerships, and the Peak email sender puts them on the card's Activity for everyone on the desk.
 *   - Reply (2026-11-19): a reply shown on the Activity has a Reply button. It opens this box filled in as a reply (to them, "RE: ..."), and
 *     Send answers their email in the same thread (Microsoft's own reply on that message in Peak Partnerships; pmReplySend).
 *   - {book} becomes a link to the desk's booking page for this email (book-lib.php): it knows the company and the person, so the page is
 *     filled in for them, the booking lands on this card, and the sender is its host. Its views are counted. An open image only when the
 *     admin setting asks for one (off).
 *   - Never to someone marked Don't contact (on the card or anywhere on the desk), nor to an address on the Peak email sender's do-not-email
 *     list (unsubscribed, bounced, replied STOP).
 *   - The words are kept on the card (row dmail), each try's result too (dmailres). Once it went: a touch "Emailed" by the sender, which
 *     moves the stage and sets the owner and follow-up as any email touch does. A failure stays on the card with Retry (the same words, the
 *     same ref, so it never goes twice) and is counted in Outbox's Peak section. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const DM_FOOTER = BK_ADDRESS . "\nIf you'd rather not get emails from Peak, reply and let me know.";

function dmConf(): array {
    $s = jread('desk-settings.json', [])['deskmail'] ?? [];
    return ['on' => !empty($s['on']), 'pixel' => !empty($s['pixel']), 'by' => (string) ($s['by'] ?? ''), 'at' => (int) ($s['at'] ?? 0)];
}
/** a person's own settings: the signature and the reply address */
function dmMine(string $name): array {
    $p = jread('people-settings.json', [])[strtolower(trim($name))] ?? [];
    return ['sig' => is_string($p['sig'] ?? null) && trim($p['sig']) !== '' ? (string) $p['sig'] : $name . "\nPeak Pickleball", 'replyto' => (string) ($p['replyto'] ?? ''), 'custom' => isset($p['sig'])];
}
function dmMineSave(string $name, array $in): array {
    $sig = trim(str_replace("\r", '', (string) ($in['sig'] ?? ''))); $rt = strtolower(clean($in['replyto'] ?? '', 160));
    if (mb_strlen($sig) > 600) return ['error' => 'Keep the signature under 600 characters.'];
    if ($rt !== '' && !filter_var($rt, FILTER_VALIDATE_EMAIL)) return ['error' => 'That reply address does not look right.'];
    $lk = fopen(DATA_DIR . '/people-settings.lock', 'c'); flock($lk, LOCK_EX);
    try {
        $all = jread('people-settings.json', []); $k = strtolower(trim($name));
        $all[$k] = ['name' => $name, 'replyto' => $rt, 'at' => time()] + ($sig !== '' && $sig !== $name . "\nPeak Pickleball" ? ['sig' => $sig] : []);
        if (!jwrite('people-settings.json', $all)) return ['error' => 'It could not be saved.'];
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return dmMine($name);
}
/** what the page needs */
function dmOut(bool $admin, string $me): array {
    $c = dmConf(); $o = ['on' => $c['on'], 'mine' => dmMine($me), 'footer' => DM_FOOTER];
    $mb = tmMailbox(); $o['from'] = $mb['email'] ?: TM_ORGANIZER; $o['fromName'] = $mb['name'] ?: TM_FROM_NAME; $o['fromWarn'] = $mb['warn'];
    if ($c['on'] || $admin) { $o['ready'] = $mb['ok']; $o['why'] = $mb['why']; }
    if ($admin) $o += ['pixel' => $c['pixel'], 'by' => $c['by'], 'at' => $c['at']];
    return $o;
}
/** '' when this address may get a desk email, else why not */
function dmMayGet(array $R, string $to): string {
    $no = tmMayGet($R, $to); if ($no !== '') return $no;
    if (tmLoad() === '' && function_exists('pmSuppressedWhy')) { $s = pmSuppressedWhy($to); if ($s !== '') return $to . ' is on the do-not-email list (' . $s . ')'; }
    return '';
}
/** the words as typed: to, name, subject, text (with {book}), template, follow-up; or ['error' => ...] */
function dmIn(array $b): array {
    $to = strtolower(clean($b['to'] ?? '', 160)); $subject = clean($b['subject'] ?? '', 160);
    $text = trim(str_replace("\r", '', (string) ($b['text'] ?? '')));
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['error' => 'Pick who it goes to, or type their email.'];
    if ($subject === '') return ['error' => 'Give it a subject.'];
    if ($text === '') return ['error' => 'Write the message first.'];
    if (mb_strlen($text) > 6000) return ['error' => 'Keep the message under 6,000 characters.'];
    if (preg_match('/\{(?!book\})[a-z_]+\}/i', $subject . "\n" . $text, $m)) return ['error' => 'The message still has ' . $m[0] . ' in it: fill it in or take it out.'];
    $fu = (string) ($b['fu'] ?? ''); if ($fu !== '' && (!okDay($fu) || $fu < date('Y-m-d'))) return ['error' => 'Pick a follow-up day from today on.'];
    $tpl = clean($b['tpl'] ?? '', 40); if ($tpl !== '' && !preg_match('/^[a-z0-9-]{1,40}$/', $tpl)) $tpl = '';
    $re = clean($b['re'] ?? '', 20); if ($re !== '' && !preg_match('/^[a-z0-9]{4,20}$/', $re)) $re = '';
    return ['to' => $to, 'name' => clean($b['name'] ?? '', 80), 'subject' => $subject, 'text' => $text, 'tpl' => $tpl, 'fu' => $fu, 'fuWhat' => clean($b['fuWhat'] ?? '', 160), 'book' => str_contains($text, '{book}'), 're' => $re];
}
/** the email of theirs a Reply answers (2026-11-19): the touch on the card that holds it, as the sender needs it; null when there is none */
function dmReOf(array $R, string $k): ?array {
    if ($k === '') return null;
    foreach ($R['touches'] ?? [] as $t) if (($t['k'] ?? '') === $k && is_array($t['mail'] ?? null) && empty($t['mail']['auto']))
        return ['k' => $k, 'mid' => (string) ($t['mail']['mid'] ?? ''), 'mb' => (string) ($t['mail']['mb'] ?? ''), 'imid' => (string) ($t['mail']['imid'] ?? ''), 'from' => (string) ($t['mail']['from'] ?? ''), 'subject' => (string) ($t['mail']['subject'] ?? '')];
    return null;
}
/** the email as it goes: subject, text, html */
function dmCompose(array $d, string $ref): array {
    $link = bkMsgUrl($ref);
    $body = str_replace('{book}', $link, (string) $d['text']);
    /* a sign-off line ("Thanks,") sits right above the signature */
    $sep = preg_match('/\n(thanks|thank you|many thanks|best|best wishes|cheers|regards|best regards|kind regards|warm regards|talk soon|see you soon),?[ \t]*$/i', "\n" . rtrim($body)) ? "\n" : "\n\n";
    $text = rtrim($body) . $sep . trim((string) $d['sig']) . "\n\n" . DM_FOOTER;
    $h = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $h = (string) preg_replace('~\bhttps?://[^\s<>"\']+[^\s<>().,;:!?"\']~i', '<a href="$0">$0</a>', $h);
    $px = dmConf()['pixel'] ? '<img src="' . htmlspecialchars(bkPixelUrl($ref), ENT_QUOTES, 'UTF-8') . '" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">' : '';
    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div style="font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;color:#111">'
        . str_replace("\n", "<br>\n", $h) . '</div>' . $px . '</body></html>';
    return ['subject' => (string) $d['subject'], 'text' => $text, 'html' => $html, 'link' => !empty($d['book']) ? $link : ''];
}
/** a preview (nothing is sent; Claude Check may look) */
function dmPreview(string $w, array $R, array $b, string $me): array {
    $d = dmIn($b); if (isset($d['error'])) return ['ok' => false, 'error' => $d['error']];
    $mine = dmMine($me); $m = dmCompose($d + ['sig' => $mine['sig']], 'dm0000000000');
    $c = dmConf(); $mb = ['email' => TM_ORGANIZER, 'name' => TM_FROM_NAME]; if (tmLoad() === '') { $x = tmMailbox(); if ($x['email'] !== '') $mb = $x; }
    $re = dmReOf($R, $d['re']);
    return ['ok' => true, 'to' => $d['to'], 'name' => $d['name'], 'from' => $mb['email'], 'fromName' => (string) ($mb['name'] ?? ''), 'replyto' => $mine['replyto'], 'subject' => $m['subject'], 'text' => $m['text'],
        'can' => dmMayGet($R, $d['to']), 'on' => $c['on'], 'book' => $d['book'] ? (bkConf()['on'] ? 'on' : 'off') : '', 're' => $re ? ['subject' => $re['subject'], 'from' => $re['from']] : null];
}
/** write it down, then send it */
function dmSend(string $w, array $R, array $b, string $me): array {
    $c = dmConf(); if (!$c['on']) return ['ok' => false, 'error' => 'Desk emails are off. They turn on once Matthew says go.'];
    $d = dmIn($b); if (isset($d['error'])) return ['ok' => false, 'error' => $d['error']];
    $no = dmMayGet($R, $d['to']); if ($no !== '') return ['ok' => false, 'error' => 'Not sent: ' . $no . '.'];
    if ($d['book'] && !bkConf()['on']) return ['ok' => false, 'error' => 'Booking links are off, so the booking link would not work. Take {book} out, or ask Matthew to turn booking links on.'];
    $mb = tmMailbox(); if (!$mb['ok']) return ['ok' => false, 'error' => 'It can\'t send right now: ' . $mb['why'] . '.'];
    $re = null; if ($d['re'] !== '') { $re = dmReOf($R, $d['re']); if (!$re) return ['ok' => false, 'error' => 'That email of theirs is no longer on the card, so this can\'t go as a reply. Close it and write a new email instead.']; }
    $d['re'] = $re ?? '';
    $mine = dmMine($me); $ref = 'dm' . bin2hex(random_bytes(5)); $id = (string) $R['id'];
    withLock(fn() => commit($w, [['t' => W($w)['T']['dmail'], 'id' => $id, 'ref' => $ref, 'sig' => $mine['sig'], 'replyto' => $mine['replyto'], 'by' => $me, 'at' => time()] + $d]));
    return ['ok' => true, 'ref' => $ref] + dmDeliver($w, $id, $ref, $me);
}
/** send (or send again) the email kept on the card under $ref; the touch once it went. Never throws. */
function dmDeliver(string $w, string $id, string $ref, string $me): array {
    try {
        $R = recs($w)[$id] ?? null; $d = $R['dmails'][$ref] ?? null; if (!$R || !$d) return ['state' => 'failed', 'why' => 'no such email'];
        if (($d['state'] ?? '') === 'sent') return ['state' => 'dup', 'why' => 'it already went', 'to' => (string) $d['to']];
        $res = function (bool $ok, string $why = '', string $kind = '') use ($w, $id, $ref, $me) { return ['t' => W($w)['T']['dmailres'], 'id' => $id, 'ref' => $ref, 'ok' => $ok, 'why' => $why, 'kind' => $kind, 'by' => $me, 'at' => time()]; };
        $no = dmMayGet($R, (string) $d['to']); if ($no !== '') { withLock(fn() => commit($w, [$res(false, $no, 'dnc')])); return ['state' => 'blocked', 'why' => $no, 'to' => (string) $d['to']]; }
        $mb = tmMailbox(); if (!$mb['ok']) { withLock(fn() => commit($w, [$res(false, $mb['why'], 'mailer')])); return ['state' => 'failed', 'why' => $mb['why'], 'to' => (string) $d['to']]; }
        $m = dmCompose($d, $ref);
        $x = pmDeskSend(['ref' => $ref, 'to' => (string) $d['to'], 'name' => (string) ($d['name'] ?? ''), 'subject' => $m['subject'], 'text' => $m['text'], 'html' => $m['html'],
            'replyTo' => (string) ($d['replyto'] ?? ''), 'replyName' => (string) ($d['by'] ?? ''), 'w' => $w, 'org' => $id, 'company' => (string) $R['name'], 'by' => (string) ($d['by'] ?? $me)]
            + (is_array($d['re'] ?? null) ? ['reply' => $d['re']] : []));
        if (empty($x['ok'])) { $why = (string) ($x['why'] ?? 'it did not send'); withLock(fn() => commit($w, [$res(false, $why, (string) ($x['kind'] ?? 'other'))])); return ['state' => 'failed', 'why' => $why, 'to' => (string) $d['to']]; }
        $by = (string) ($d['by'] ?? $me);
        $st = withLock(function () use ($w, $id, $ref, $d, $res, $by) {
            sync($w, true); $R = recs($w)[$id]; $now = time(); $rows = [$res(true)];
            $seen = false; foreach ($R['touches'] ?? [] as $t) if (($t['ref'] ?? '') === $ref) $seen = true;
            if (!$seen) {
                $fu = (string) ($d['fu'] ?? ''); if ($fu !== '' && $fu < date('Y-m-d')) $fu = '';
                $touch = ['m' => 'email', 'out' => 'sent', 'note' => (is_array($d['re'] ?? null) ? 'Replied “' : 'Emailed “') . $d['subject'] . '” to ' . ((string) ($d['name'] ?? '') !== '' ? $d['name'] . ' (' . $d['to'] . ')' : $d['to']) . ' from the desk' . (is_array($d['re'] ?? null) ? ', answering their email' : ''), 'when' => $now, 'to' => (string) $d['to'], 'ref' => $ref, 'dm' => $ref];
                if (!empty($d['tpl'])) $touch['tpl'] = (string) $d['tpl'];
                $rows = array_merge($rows, touchRows($w, $R, newKey(), $touch, $by, in_array($by, owners($w), true), $fu, (string) ($d['fuWhat'] ?? ''), $now));
            }
            commit($w, $rows); return (string) recs($w)[$id]['stage'];
        });
        return ['state' => !empty($x['dup']) ? 'dup' : 'sent', 'why' => '', 'to' => (string) $d['to'], 'stage' => $st];
    } catch (Throwable $e) {
        error_log('peak desk email: ' . $e->getMessage() . ' @' . $e->getLine());
        return ['state' => 'failed', 'why' => 'the desk hit a problem sending it'];
    }
}

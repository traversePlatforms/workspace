<?php
/* Tour confirmation emails (2026-11-19, Matthew: "when for example, cai books a tour using our app for the peak desk that it send an email
 * automatically to that persons email that she puts in stating when the meeting is etc so they have an email notification that they can
 * connect to their calendar").
 *
 * When someone books a tour (sponsors: Meeting / tour booked; expo: Tour booked) with the contact's email and leaves "Send a confirmation
 * email" ticked, the desk sends that person a short email as Peak Partnerships (the shared mailbox, since 2026-11-19; it was Matthew's
 * own Peak Outlook before), with a calendar invite attached (.ics, METHOD:REQUEST, ORGANIZER the address it goes out as,
 * one UID per tour). Moving the tour sends the invite again with the same UID and a higher SEQUENCE; cancelling it sends METHOD:CANCEL.
 *
 *   - The sending is the Peak email sender's (outbox-092b0f/peak/lib.php, pmTourSend): its Microsoft token, its log, and its own once-only
 *     check by ref. Nothing here holds a token. That file is loaded only when a confirmation goes out (or Settings asks whether Microsoft is
 *     connected).
 *   - OFF until an admin turns it on in More, Settings (desk-settings.json, key "tourmail"). Matthew approves the wording first: it is a
 *     customer-facing email. While it is off nothing is sent and the booking form says so.
 *   - One email per booking version: the ref is tc-<tour id>-<sequence>-<r|c>. The desk checks the tour's last result and the sender checks
 *     its own log under a lock, so a retry or a second click never sends twice.
 *   - Never to someone marked Don't contact (on the card or anywhere on the desk), and never without an email.
 *   - Each send is a touch on the company's Activity ("Emailed: tour confirmation", by "<booker> (via Peak email)"; it moves no stage and is
 *     not counted as the booker's own email). A failure is kept on the tour ("Confirmation not sent: ...") with a Retry, and counted in
 *     Outbox's Peak section.
 * Plain text plus the same words as simple HTML; no open image and no tracked links on this email. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const TM_NAME = 'Peak Pickleball';
const TM_ADDRESS = 'Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920';
const TM_PHONE = '(719) 377-4725';
const TM_ORGANIZER = 'partnerships@peakpickleball.us';   /* Peak Partnerships (2026-11-19); the Peak email sender's own answer is used when it can be read */
const TM_FROM_NAME = 'Peak Partnerships';
const TM_FIELDS = ['first', 'company', 'date', 'time', 'length', 'address', 'me', 'phone'];
const TM_MUST = ['date', 'time', 'address'];               /* the confirmation can't lose these */
const TM_MUST_CANCEL = ['date', 'time'];
const TM_MINS = [15, 30, 45, 60, 90, 120];

function tmDefaults(): array {
    return [
        'subject' => 'Confirmed: your visit to Peak Pickleball, {date} at {time}',
        'body' => "Hi {first},\n\nThis confirms your visit to Peak Pickleball.\n\nWhen: {date}, {time} Mountain time ({length})\nWhere: {address}\n"
            . "Entrance: from the parking lot off Jamboree Drive. We're connected to Chapel Hills Mall, but there is no way in from inside the mall.\n"
            . "You'll meet: {me}\n\nA calendar invite is attached so you can add it to your calendar. If you need to change the time, reply to this email or call Peak at {phone}.\n\nThanks,\n{me}\nPeak Pickleball",
        'csubject' => 'Cancelled: your visit to Peak Pickleball, {date} at {time}',
        'cbody' => "Hi {first},\n\nYour visit to Peak Pickleball on {date} at {time} Mountain time is cancelled, and the calendar invite is withdrawn.\n\n"
            . "If you'd like to find another time, reply to this email or call Peak at {phone}.\n\nThanks,\n{me}\nPeak Pickleball",
    ];
}
/** the switch and the wording, as saved (the defaults until an admin changes them) */
function tmConf(): array {
    $s = jread('desk-settings.json', [])['tourmail'] ?? []; $d = tmDefaults(); $wd = is_array($s['words'] ?? null) ? $s['words'] : [];
    $words = []; foreach ($d as $k => $v) $words[$k] = is_string($wd[$k] ?? null) && $wd[$k] !== '' ? $wd[$k] : $v;
    return ['on' => !empty($s['on']), 'words' => $words, 'custom' => $words !== $d, 'by' => (string) ($s['by'] ?? ''), 'at' => (int) ($s['at'] ?? 0),
        'wby' => (string) ($s['wby'] ?? ''), 'wat' => (int) ($s['wat'] ?? 0)];
}
/** '' when the wording is fine, else what is wrong with it */
function tmCheckWords(array $w): string {
    $need = ['subject' => 'The confirmation subject', 'body' => 'The confirmation email', 'csubject' => 'The cancellation subject', 'cbody' => 'The cancellation email'];
    foreach ($need as $k => $nm) {
        $v = (string) ($w[$k] ?? '');
        if (trim($v) === '') return $nm . ' is empty.';
        if (preg_match_all('/\{([^}]*)\}/', $v, $m)) foreach ($m[1] as $f) if (!in_array($f, TM_FIELDS, true)) return $nm . ' has {' . $f . '} in it. The fields are {' . implode('}, {', TM_FIELDS) . '}.';
    }
    foreach (TM_MUST as $f) if (!str_contains((string) $w['body'], '{' . $f . '}')) return 'The confirmation email must keep {' . $f . '}: it is the ' . ($f === 'address' ? 'address' : $f) . ' of the visit.';
    foreach (TM_MUST_CANCEL as $f) if (!str_contains((string) $w['cbody'], '{' . $f . '}')) return 'The cancellation email must keep {' . $f . '}.';
    if (mb_strlen((string) $w['subject']) > 160 || mb_strlen((string) $w['csubject']) > 160) return 'Keep each subject under 160 characters.';
    if (mb_strlen((string) $w['body']) > 3000 || mb_strlen((string) $w['cbody']) > 3000) return 'Keep each email under 3,000 characters.';
    return '';
}

/* ---- the Peak email sender (loaded only when needed) ---- */
function tmLibPath(): string {
    $e = (PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server') ? (string) getenv('DESK_PEAK_MAIL_LIB') : '';   /* the tests point at the repo copy */
    return $e !== '' ? $e : dirname(__DIR__, 2) . '/outbox-092b0f/peak/lib.php';
}
/** '' once the sender's code is loaded, else why not */
function tmLoad(): string {
    static $why = null; if ($why !== null) return $why;
    $f = tmLibPath();
    if (!is_file($f)) return $why = 'the Peak email sender is not on this server';
    try { require_once $f; } catch (Throwable $e) { return $why = 'the Peak email sender did not load (' . mb_substr($e->getMessage(), 0, 80) . ')'; }
    if (!function_exists('pmTourSend') || !function_exists('pmConn')) return $why = 'the Peak email sender is an older copy without tour confirmations';
    if (!pmReady()) return $why = 'the Peak email data folder is missing';
    return $why = '';
}
/** can Peak email send, and as whom: ['ok' => bool, 'email' => the address it goes out as, 'name' => its name, 'shared' => bool, 'warn' => words
    when the shared mailbox refused (a Send As refusal is said plainly; it never falls back to Matthew's own mailbox), 'why' => ...] */
function tmMailbox(): array {
    static $o = null; if ($o !== null) return $o;
    $l = tmLoad(); if ($l !== '') return $o = ['ok' => false, 'email' => '', 'name' => '', 'shared' => false, 'warn' => '', 'why' => $l];
    try { $c = pmConn(); $F = function_exists('pmFromStatus') ? pmFromStatus() : ['email' => (string) ($c['email'] ?? ''), 'name' => (string) ($c['name'] ?? ''), 'shared' => false, 'warn' => '']; }
    catch (Throwable $e) { return $o = ['ok' => false, 'email' => '', 'name' => '', 'shared' => false, 'warn' => '', 'why' => 'the Peak email sender could not be read']; }
    $as = ['email' => (string) $F['email'], 'name' => (string) $F['name'], 'shared' => (bool) $F['shared'], 'warn' => (string) $F['warn']];
    if (!empty($c['connected'])) return $o = ['ok' => true, 'why' => ''] + $as;
    return $o = ['ok' => false, 'why' => ($c['status'] ?? '') === 'reconnect' ? 'the Microsoft sign-in for Peak email needs connecting again (Outbox, Peak section)' : 'Peak email is not connected to Microsoft (Outbox, Peak section)'] + $as;
}
/** what the page needs: the switch, whether it can send, and (admins) the wording */
function tmOut(bool $admin): array {
    $c = tmConf(); $o = ['on' => $c['on'], 'mins' => TM_MINS]; $mb = tmMailbox();
    $o['from'] = $mb['email'] ?: TM_ORGANIZER; $o['fromName'] = $mb['name'] ?: TM_FROM_NAME; $o['fromWarn'] = $mb['warn'];
    if ($c['on'] || $admin) { $o['ready'] = $mb['ok']; $o['why'] = $mb['why']; }
    if ($admin) $o += ['words' => $c['words'], 'defaults' => tmDefaults(), 'custom' => $c['custom'], 'fields' => TM_FIELDS, 'must' => TM_MUST, 'by' => $c['by'], 'at' => $c['at'], 'wby' => $c['wby'], 'wat' => $c['wat']];
    return $o;
}

/* ---- the words ---- */
function tmFill(string $s, array $ctx): string { return (string) preg_replace_callback('/\{(' . implode('|', TM_FIELDS) . ')\}/', fn($m) => (string) ($ctx[$m[1]] ?? ''), $s); }
function tmLen(int $mins): string { $h = intdiv($mins, 60); $m = $mins % 60; return trim(($h ? $h . ' hour' . ($h > 1 ? 's' : '') : '') . ($h && $m ? ' ' : '') . ($m ? $m . ' minutes' : '')); }
function tmMins($v): int { $n = (int) $v; return in_array($n, TM_MINS, true) ? $n : 30; }
/** who they meet: the person who booked it (a seller or admin), else the person doing this now */
function tmMeet(string $w, array $t, string $me): string { $b = (string) ($t['by'] ?? ''); return $b !== '' && in_array($b, owners($w), true) ? $b : $me; }
function tmFirst(string $who, string $email): string {
    $n = trim(preg_replace('/\s+/', ' ', (string) preg_replace('/[<(].*$/', '', $who)) ?? '');
    if ($n !== '' && !str_contains($n, '@') && preg_match('/^[\p{L}][\p{L}\'’.-]*/u', $n, $m) && mb_strlen($m[0]) > 1) return $m[0];
    return 'there';
}
function tmCtx(array $R, array $t, string $meet): array {
    $ts = (int) strtotime($t['date'] . ' ' . $t['time']); $mins = tmMins($t['mins'] ?? 30);
    return ['first' => tmFirst((string) ($t['who'] ?? ''), (string) ($t['email'] ?? '')), 'company' => (string) ($R['name'] ?? ''),
        'date' => date('l, F j', $ts) . (date('Y', $ts) !== date('Y') ? ', ' . date('Y', $ts) : ''), 'time' => date('g:i a', $ts), 'length' => tmLen($mins),
        'address' => TM_ADDRESS, 'me' => $meet, 'phone' => TM_PHONE];
}
/** the email for one version of a tour: subject, text, html, ics, method, ref */
function tmCompose(string $w, array $R, array $t, string $meet, bool $cancel, string $organizer, array $words): array {
    $ctx = tmCtx($R, $t, $meet); $seq = (int) ($t['seq'] ?? 0); $moved = !$cancel && $seq > 0;
    $subject = tmFill($words[$cancel ? 'csubject' : 'subject'], $ctx); $text = tmFill($words[$cancel ? 'cbody' : 'body'], $ctx);
    if ($moved) {
        $subject = 'Updated: ' . preg_replace('/^(confirmed|confirmation)\s*:\s*/i', '', $subject);
        $line = 'The time has changed. The new details are below, and the calendar invite is updated.';
        $p = strpos($text, "\n\n"); $text = $p !== false && $p < 60 ? substr($text, 0, $p) . "\n\n" . $line . substr($text, $p) : $line . "\n\n" . $text;
    }
    $text = str_replace("\r", '', $text);
    return ['subject' => clean($subject, 200), 'text' => $text, 'html' => tmHtml($text), 'ics' => tmIcs($w, $R, $t, $meet, $cancel, $organizer, $ctx),
        'method' => $cancel ? 'CANCEL' : 'REQUEST', 'ref' => 'tc-' . preg_replace('/[^a-z0-9]/', '', (string) $t['tid']) . '-' . $seq . '-' . ($cancel ? 'c' : 'r'), 'seq' => $seq, 'moved' => $moved];
}
/** the same words as simple HTML: no images, no tracked links */
function tmHtml(string $text): string {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div style="font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;color:#111">'
        . str_replace("\n", "<br>\n", htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</div></body></html>';
}
const TM_VTZ = ['BEGIN:VTIMEZONE', 'TZID:America/Denver', 'X-LIC-LOCATION:America/Denver',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0600', 'TZNAME:MDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0700', 'TZNAME:MST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE'];
/** the calendar invite: one UID per tour, SEQUENCE per version, local times in America/Denver with its time zone */
function tmIcs(string $w, array $R, array $t, string $meet, bool $cancel, string $organizer, array $ctx): string {
    $st = new DateTime($t['date'] . ' ' . $t['time'], new DateTimeZone('America/Denver')); $en = (clone $st)->modify('+' . tmMins($t['mins'] ?? 30) . ' minutes');
    $to = strtolower((string) ($t['email'] ?? '')); $cn = trim((string) preg_replace('/[<(].*$/', '', (string) ($t['who'] ?? '')));
    $q = fn(string $s) => '"' . str_replace(['"', "\r", "\n", ';', ':'], '', $s) . '"';
    $L = ['BEGIN:VCALENDAR', 'PRODID:-//Peak Pickleball//Peak desk//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:' . ($cancel ? 'CANCEL' : 'REQUEST')];
    array_push($L, ...TM_VTZ);
    array_push($L, 'BEGIN:VEVENT', 'UID:peak-tour-' . preg_replace('/[^a-z0-9]/', '', (string) $t['tid']) . '@traverseplatforms.com', 'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'SEQUENCE:' . (int) ($t['seq'] ?? 0), 'DTSTART;TZID=America/Denver:' . $st->format('Ymd\THis'), 'DTEND;TZID=America/Denver:' . $en->format('Ymd\THis'),
        'SUMMARY:' . icsEsc('Visit to Peak Pickleball (meeting ' . $meet . ')'), 'LOCATION:' . icsEsc(TM_ADDRESS),
        'DESCRIPTION:' . icsEsc(($cancel ? "This visit is cancelled.\n" : '') . "You'll meet " . $meet . ".\nEntrance: from the parking lot off Jamboree Drive (no way in from inside Chapel Hills Mall).\nPeak: " . TM_PHONE . "\nTo change it, reply to the email this came with."),
        'ORGANIZER;CN=' . $q(TM_NAME) . ':mailto:' . $organizer,
        'ATTENDEE;CN=' . $q($cn !== '' && !str_contains($cn, '@') ? $cn : $to) . ';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:' . $to,
        'STATUS:' . ($cancel ? 'CANCELLED' : 'CONFIRMED'), 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR');
    return implode("\r\n", array_map('icsFold', $L)) . "\r\n";
}

/* ---- who may get it ---- */
/** '' when this address may get it, else why not */
function tmMayGet(array $R, string $email): string {
    $e = strtolower(trim($email));
    if ($e === '') return 'no email was given';
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) return $e . ' does not look like an email';
    if (isset(($R['dnc'] ?? [])['e:' . $e]) || in_array($e, deskNoContact(), true)) return $e . ' is marked Don\'t contact';
    return '';
}
/** every tour of a list, cancelled ones too (a cancellation that did not go out still needs its Retry) */
function tmTourAny(string $w, string $tid): ?array { sync($w); $q = db()->prepare('SELECT rec FROM tour WHERE world = ? AND tid = ?'); $q->execute([$w, $tid]); $r = $q->fetchColumn(); return $r === false ? null : json_decode((string) $r, true); }
function tmToursAll(string $w): array { sync($w); $q = db()->prepare('SELECT rec FROM tour WHERE world = ?'); $q->execute([$w]); return array_map(fn($r) => json_decode($r['rec'], true), $q->fetchAll()); }
/** where a tour's email stands, for the page: s = sent | failed | stale | none | blocked, with the words to show */
function tmState(array $t): array {
    $tm = $t['tm'] ?? null; $seq = (int) ($t['seq'] ?? 0); $off = !empty($t['off']); $em = (string) ($t['email'] ?? '');
    $cur = is_array($tm) && (int) ($tm['seq'] ?? -1) === $seq && ($tm['method'] ?? '') === ($off ? 'CANCEL' : 'REQUEST');
    $day = fn(int $at) => date('M j, g:i a', $at);
    if ($cur && !empty($tm['ok'])) return ['s' => 'sent', 'text' => ($off ? 'Cancellation sent to ' : ($seq > 0 ? 'Updated invite sent to ' : 'Confirmation sent to ')) . $tm['to'] . ', ' . $day((int) $tm['at']) . ' (' . $tm['by'] . ')'];
    if ($cur) return ['s' => in_array($tm['kind'] ?? '', ['dnc', 'noemail'], true) ? 'blocked' : 'failed', 'text' => ($off ? 'Cancellation' : 'Confirmation') . ' not sent: ' . $tm['why']];
    if ($off) return isset($t['tmSent']) ? ['s' => 'failed', 'text' => 'Cancellation not sent yet'] : ['s' => 'none', 'text' => ''];
    if (isset($t['tmSent'])) return ['s' => 'stale', 'text' => 'Moved since the invite went out: the new time has not been sent to ' . $em];
    if ($em === '') return ['s' => 'none', 'text' => 'No email given, so no confirmation went out'];
    return ['s' => 'none', 'text' => !empty($t['mail']) ? 'Confirmation not sent yet' : 'No confirmation email sent'];
}

/* ---- sending ---- */
/** send one version of a tour's email now and record it on the desk; never throws. $cancel: the tour was just cancelled.
    Returns ['state' => sent | dup | failed | blocked | off, 'why' => ..., 'to' => ...] */
function tmSend(string $w, string $tid, string $me, bool $cancel): array {
    try {
        $conf = tmConf(); if (!$conf['on']) return ['state' => 'off', 'why' => 'tour confirmation emails are off', 'to' => ''];
        $t = tmTourAny($w, $tid); if (!$t) return ['state' => 'failed', 'why' => 'no such tour', 'to' => ''];
        $R = recs($w)[(string) ($t['lead'] ?? '')] ?? null; if (!$R) return ['state' => 'failed', 'why' => 'the company is not on the desk', 'to' => ''];
        $to = strtolower(trim((string) ($t['email'] ?? ''))); $seq = (int) ($t['seq'] ?? 0); $method = $cancel ? 'CANCEL' : 'REQUEST';
        $tm = $t['tm'] ?? null;
        if (is_array($tm) && !empty($tm['ok']) && (int) $tm['seq'] === $seq && $tm['method'] === $method) return ['state' => 'dup', 'why' => 'it already went', 'to' => (string) $tm['to']];
        $row = fn(array $x) => ['t' => W($w)['T']['tourmail'], 'tid' => $tid, 'id' => (string) $R['id'], 'seq' => $seq, 'method' => $method, 'to' => $to, 'by' => $me, 'at' => time()] + $x;
        $no = tmMayGet($R, $to);
        if ($no !== '') { withLock(fn() => commit($w, [$row(['ok' => false, 'kind' => $to === '' ? 'noemail' : 'dnc', 'why' => $no])])); return ['state' => 'blocked', 'why' => $no, 'to' => $to]; }
        $mb = tmMailbox();
        if (!$mb['ok']) { withLock(fn() => commit($w, [$row(['ok' => false, 'kind' => 'mailer', 'why' => $mb['why']])])); return ['state' => 'failed', 'why' => $mb['why'], 'to' => $to]; }
        $meet = tmMeet($w, $t, $me); $m = tmCompose($w, $R, $t, $meet, $cancel, $mb['email'], $conf['words']);
        $x = pmTourSend(['ref' => $m['ref'], 'to' => $to, 'name' => tmFirst((string) ($t['who'] ?? ''), $to) !== 'there' ? trim((string) preg_replace('/[<(].*$/', '', (string) $t['who'])) : '',
            'subject' => $m['subject'], 'text' => $m['text'], 'html' => $m['html'], 'ics' => $m['ics'], 'method' => $method,
            'w' => $w, 'org' => (string) $R['id'], 'company' => (string) $R['name'], 'tid' => $tid, 'seq' => $seq, 'by' => $me]);
        if (empty($x['ok'])) { withLock(fn() => commit($w, [$row(['ok' => false, 'kind' => (string) ($x['kind'] ?? 'other'), 'why' => (string) ($x['why'] ?? 'it did not send'), 'ref' => $m['ref']])])); return ['state' => 'failed', 'why' => (string) ($x['why'] ?? 'it did not send'), 'to' => $to]; }
        $when = date('D M j', (int) strtotime($t['date'])) . ', ' . date('g:i a', (int) strtotime($t['date'] . ' ' . $t['time']));
        $what = $cancel ? 'tour cancellation (' . $when . ')' : ($m['moved'] ? 'tour moved, updated invite (' . $when . ')' : 'tour confirmation (' . $when . ')');
        $now = time();
        withLock(function () use ($w, $R, $row, $m, $to, $what, $me, $now, $tid, $x) {
            $rows = [$row(['ok' => true, 'ref' => $m['ref'], 'dup' => !empty($x['dup'])])];
            $R2 = recs($w)[(string) $R['id']] ?? $R; $seen = false; foreach ($R2['touches'] ?? [] as $tt) if (($tt['ref'] ?? '') === $m['ref']) $seen = true;
            if (!$seen) $rows[] = rowTouch($w, (string) $R['id'], newKey(), ['m' => 'email', 'out' => 'sent', 'note' => 'Emailed: ' . $what . ' to ' . $to, 'when' => $now, 'auto' => 1, 'tc' => 1, 'to' => $to, 'ref' => $m['ref'], 'tid' => $tid], $me . ' (via Peak email)', $now);
            commit($w, $rows);
        });
        return ['state' => !empty($x['dup']) ? 'dup' : 'sent', 'why' => '', 'to' => $to];
    } catch (Throwable $e) {
        error_log('peak desk tour mail: ' . $e->getMessage() . ' @' . $e->getLine());
        return ['state' => 'failed', 'why' => 'the desk hit a problem sending it', 'to' => ''];
    }
}
/** after a booking, a move or a cancel: whether to send, and the send. $want: the booker's tick (null: keep what the tour said). */
function tmAfter(string $op, string $w, string $tid, ?bool $want, string $me): array {
    try {
        $conf = tmConf(); if (!$conf['on']) return ['state' => 'off', 'why' => 'tour confirmation emails are off', 'to' => ''];
        $t = tmTourAny($w, $tid); if (!$t) return ['state' => 'none', 'why' => '', 'to' => ''];
        if ($op === 'tourdel') return isset($t['tmSent']) ? tmSend($w, $tid, $me, true) : ['state' => 'none', 'why' => 'no invite had gone out', 'to' => ''];
        if (!($want ?? (!empty($t['mail']) || isset($t['tmSent'])))) return ['state' => 'none', 'why' => 'not ticked', 'to' => (string) ($t['email'] ?? '')];
        if ((string) ($t['email'] ?? '') === '') return ['state' => 'blocked', 'why' => 'no email was given', 'to' => ''];
        return tmSend($w, $tid, $me, false);
    } catch (Throwable $e) { error_log('peak desk tour mail: ' . $e->getMessage()); return ['state' => 'failed', 'why' => 'the desk hit a problem sending it', 'to' => '']; }
}
/** the four bits of wording as typed in Settings (trimmed, no carriage returns) */
function tmWordsIn(array $in): array { $o = []; foreach (tmDefaults() as $k => $v) $o[$k] = trim(str_replace("\r", '', (string) ($in[$k] ?? ''))); return $o; }
/** a made-up company and tour for the Settings preview and the test: the next working day at 10 am */
function tmSample(string $me, string $email): array {
    return [['id' => 'sample', 'name' => 'Sample Company', 'dnc' => []],
        ['tid' => 'sample' . substr(sha1($me), 0, 6), 'date' => nextBizDay(), 'time' => '10:00', 'mins' => 30, 'who' => 'Pat Example', 'email' => $email !== '' ? $email : 'pat@example.com', 'by' => $me, 'seq' => 0]];
}
/** a preview: the email as it would go for these details (nothing is sent) */
function tmPreview(string $w, array $R, array $t, string $me, ?array $words = null): array {
    $conf = tmConf(); $mb = ['email' => TM_ORGANIZER];
    if (tmLoad() === '') { $x = tmMailbox(); if ($x['email'] !== '') $mb['email'] = $x['email']; }
    $t += ['tid' => 'preview', 'seq' => 0]; $m = tmCompose($w, $R, $t, tmMeet($w, $t, $me), false, $mb['email'], $words ?? $conf['words']);
    $c = tmCompose($w, $R, ['seq' => 1] + $t, tmMeet($w, $t, $me), true, $mb['email'], $words ?? $conf['words']);
    $to = strtolower(trim((string) ($t['email'] ?? '')));
    return ['ok' => true, 'subject' => $m['subject'], 'text' => $m['text'], 'ics' => $m['ics'], 'csubject' => $c['subject'], 'ctext' => $c['text'], 'to' => $to, 'on' => $conf['on'], 'from' => $mb['email'],
        'can' => $to === '' ? 'no email was given' : tmMayGet($R, $to)];
}
/** a test of the wording to an address an admin types (Settings): the sample visit, its invite, sent now even while the switch is off.
    It is logged by the sender as a test and touches no company. */
function tmTest(string $w, string $me, string $to, ?array $words): array {
    $mb = tmMailbox(); if (!$mb['ok']) return ['ok' => false, 'why' => $mb['why']];
    [$R, $t] = tmSample($me, $to); $t['tid'] .= bin2hex(random_bytes(3));
    $m = tmCompose($w, $R, $t, tmMeet($w, $t, $me), false, $mb['email'], $words ?? tmConf()['words']);
    return pmTourSend(['ref' => 'test-' . bin2hex(random_bytes(6)), 'to' => $to, 'name' => '', 'subject' => '[Test] ' . $m['subject'], 'text' => $m['text'], 'html' => $m['html'], 'ics' => $m['ics'],
        'method' => 'REQUEST', 'w' => $w, 'org' => '', 'company' => 'Sample Company (test)', 'tid' => $t['tid'], 'seq' => 0, 'by' => $me, 'test' => 1]);
}
/** the confirmations that did not go out and can be tried again (cancelled tours included), for the Tours tab */
function tmFailed(string $w): array {
    $X = recs($w); $o = [];
    foreach (tmToursAll($w) as $t) {
        $s = tmState($t); if (!in_array($s['s'], ['failed', 'stale'], true)) continue;
        $R = $X[(string) ($t['lead'] ?? '')] ?? null; if (!$R || !empty($R['off'])) continue;
        if (empty($t['off']) && (string) $t['date'] < date('Y-m-d')) continue;   /* a tour already past needs no email */
        $o[] = ['tid' => $t['tid'], 'lead' => $t['lead'], 'name' => $R['name'], 'date' => $t['date'], 'time' => $t['time'], 'off' => !empty($t['off']), 'email' => (string) ($t['email'] ?? ''), 'state' => $s];
    }
    return $o;
}

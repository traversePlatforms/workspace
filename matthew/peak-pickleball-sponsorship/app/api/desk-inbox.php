<?php
/* The Inbox and reply alerts (2026-11-20). Matthew asked how Cai sees and answers partnerships@ (she has no Peak Microsoft account, so she
 * can't open it in Outlook), and: "I think the inbox tab is better but i dont think we currently have any notification that an email reply
 * has happened other then just looking right".
 *
 * The Inbox: every email that comes into Peak Partnerships' Inbox (partnerships@peakpickleball.us), as the Peak email sender reads it
 * (outbox-092b0f/peak/lib.php pmScan, every 5 minutes: `cron.php inbox`, started by the 5-minute cron). It calls deskInboxIn() for each one,
 * which only appends a row to inbox.log (no lock on the desk). The log is the record; desk.sqlite's table inbox is read from it the same way
 * the companies are (an offset and a hash of what was read, rebuilt when the log changed underneath). Rows:
 *   in      one email: who, the subject, when, their own words (the quoted history cut, at most 3,200 characters), attachments, where it is
 *           (mid, mb, imid: never sent to the page), cat (mail | other) and why it is Other (Microsoft or system notices, bounces,
 *           auto-replies, calendar answers, CourtReserve, STOP replies, which are handled by themselves), and the card it matched (w, id)
 *   claim   on/off: "Cai is answering this". Since 2026-11-23 a lock (Matthew: "when someone claims they are answering this does that
 *           prevent others from responding? because it should"): only the claimer replies to it, from the Inbox or from a card's Write an
 *           email to that address; only the claimer or an admin releases it; an admin may take it over (take: true). Replying claims it.
 *   done    on/off: pressed Done (the Done view keeps it)
 *   back    Back to To answer (2026-11-23): we replied but still owe them something
 *   hide    on/off: Remove, for one under Other (2026-11-23); a bounce's addresses and the cards they are on go with it (bounce)
 * Which of the four lists an email is on (To answer, Waiting on them, Done, Other) is worked out when the list is read: inStates.
 *   attach  put on a company's card (a touch, as a matched reply is)
 *   rmail   the words of a reply sent from the Inbox with no card; reply: each reply's result
 *   read    the first time a seller opened it (it is then marked read in Peak Partnerships; nothing is ever moved or deleted)
 * Sellers and admins see it; the read-only Claude Check account may look and never act; the Expo-only account doesn't get it.
 *
 * Alerts: Web Push to the desk app (each person turns it on per device in More, My email & booking link) and, optionally, a short email to
 * their own reply address. Who gets what (each person's own setting): a reply on a card someone owns goes to that owner ("Replies on my
 * companies", on by default); a reply to a Peak email blast (owner "Peak email" or nobody) and new Inbox mail go to everyone who has "New
 * Inbox mail" on (on by default once they turn alerts on). STOP replies, bounces and auto-replies alert nobody. Quiet hours 9 pm to 7 am
 * Mountain (on by default): held and delivered at 7. An email alert is a heads-up only ("Acme Corp replied: open the desk"), never the
 * email's words or the sender's address, at most one every 10 minutes per person (the rest wait and go together), off by default. The
 * queue is alerts.json (alerts.lock); devices push-subs.json; the desk's own Web Push key push-vapid.json (0600, made the first time it is
 * needed and never replaced). Delivered by alertsFlush(): the 5-minute run, the hourly run, `php desk.php alerts`. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const IN_LOG = 'inbox.log';
const IN_V = '2';                   /* bump to rebuild the table from inbox.log after a change to how rows are read */
const IN_FILE_MAX = 15 * 1048576;   /* attachments up to 15 MB download through the desk; bigger ones: open in Outlook */
const AL_GAP = 600;                 /* an email alert at most once every 10 minutes per person */
const AL_KEEP = 3 * 86400;          /* an alert not delivered in 3 days is dropped */
const AL_DEVICES = 6;               /* devices per person */
const AL_FILE = 'alerts.json';

function inTestEnv(string $k): string { return in_array(PHP_SAPI, ['cli', 'cli-server'], true) ? (string) getenv($k) : ''; }
function inNow(): int { $e = inTestEnv('DESK_NOW'); return ctype_digit($e) ? (int) $e : time(); }
function inIid(string $imid, string $mid): string { return substr(sha1('in|' . ($imid !== '' ? strtolower($imid) : $mid)), 0, 12); }

/* ---- the Peak email sender's door: one email from Peak Partnerships' Inbox ---- */
/** $m: from, name, subject, at, text, files (names), att ([[name, id, size, type, kind] ...]), mid, mb, imid, cat (mail|other), why, w, id
    (the card it matched), stop, auto. Appends one row; a new email that matched no card alerts the Inbox watchers. Returns the item's id. */
function deskInboxIn(array $m): string {
    $mid = clean($m['mid'] ?? '', 400); $imid = clean($m['imid'] ?? '', 300);
    if ($mid === '' && $imid === '') return '';
    $iid = inIid($imid, $mid);
    $text = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', str_replace("\r", '', (string) ($m['text'] ?? '')));
    $att = [];
    foreach ((array) ($m['att'] ?? []) as $a) if (is_array($a) && count($att) < 12)
        $att[] = ['n' => clean($a['name'] ?? 'attachment', 120) ?: 'attachment', 'id' => clean($a['id'] ?? '', 600), 'size' => max(0, (int) ($a['size'] ?? 0)), 'type' => clean($a['type'] ?? '', 100), 'kind' => clean($a['kind'] ?? '', 60)];
    $w = in_array($m['w'] ?? '', ['sponsor', 'expo'], true) ? (string) $m['w'] : ''; $id = $w !== '' ? clean($m['id'] ?? '', 40) : '';
    $cat = ($m['cat'] ?? '') === 'other' ? 'other' : 'mail';
    $row = ['t' => 'in', 'iid' => $iid, 'at' => (int) ($m['at'] ?? 0) ?: inNow(), 'from' => strtolower(clean($m['from'] ?? '', 160)), 'name' => clean($m['name'] ?? '', 80),
        'subject' => clean($m['subject'] ?? '', 200), 'text' => mb_substr(trim($text), 0, 3200), 'att' => $att, 'mid' => $mid, 'mb' => strtolower(clean($m['mb'] ?? '', 160)), 'imid' => $imid,
        'cat' => $cat, 'why' => clean($m['why'] ?? '', 80), 'w' => $w, 'id' => $id, 'stop' => !empty($m['stop']) ? 1 : 0, 'auto' => !empty($m['auto']) ? 1 : 0, 'seen' => inNow()];
    if (!logAdd($row, IN_LOG)) return '';
    /* quiet: the one-time fill of emails already in the mailbox (`cron.php inbox-backfill`) alerts nobody; read: one already read in
       Outlook before the Inbox began goes to Done */
    if (!empty($m['read']) && $cat === 'mail') logAdd(['t' => 'done', 'iid' => $iid, 'on' => true, 'by' => 'Outlook', 'at' => inNow()], IN_LOG);
    if (!empty($m['quiet'])) return $iid;
    if ($cat === 'mail' && $id === '') { try { alertNew('in:' . $iid, 'inbox', 'New email in the Inbox', './#inbox/' . $iid, alRecipients('inbox', '')); } catch (Throwable $e) { error_log('peak desk alert: ' . $e->getMessage()); } }
    return $iid;
}

/* ---- the table, read from inbox.log ---- */
function inDb(): PDO { static $ok = false; $db = db(); if (!$ok) { $db->exec('CREATE TABLE IF NOT EXISTS inbox (iid TEXT PRIMARY KEY, at INTEGER NOT NULL, rec TEXT NOT NULL)'); $ok = true; } return $db; }
function inApply(?array $R, array $r): ?array {
    $t = (string) ($r['t'] ?? ''); $by = (string) ($r['by'] ?? ''); $at = (int) ($r['at'] ?? 0);
    if ($t === 'in') { if ($R) return $R; unset($r['t']); return $r + ['claim' => null, 'done' => null, 'replies' => [], 'card' => ($r['id'] ?? '') !== '' ? ['w' => $r['w'], 'id' => $r['id'], 'by' => 'Peak email', 'at' => (int) $r['at']] : null, 'read' => 0, 'rmails' => []]; }
    if (!$R) return null;
    switch ($t) {
        case 'claim': $R['claim'] = !empty($r['on']) ? ['by' => $by, 'at' => $at] : null; break;
        case 'done': $R['done'] = !empty($r['on']) ? ['by' => $by, 'at' => $at] : null; break;
        case 'attach': $R['card'] = ['w' => (string) $r['w'], 'id' => (string) $r['id'], 'by' => $by, 'at' => $at]; break;
        case 'read': if (empty($R['read'])) $R['read'] = $at; break;
        case 'back': $R['back'] = ['by' => $by, 'at' => $at]; break;   /* Back to To answer (2026-11-23) */
        case 'hide': $R['hide'] = !empty($r['on']) ? ['by' => $by, 'at' => $at, 'bounce' => (array) ($r['bounce'] ?? [])] : null; break;   /* Remove, from Other */
        case 'rmail': $x = $r; unset($x['t'], $x['iid']); $R['rmails'][(string) $r['ref']] = $x; break;
        case 'reply': {
            $x = ['ref' => (string) ($r['ref'] ?? ''), 'ok' => !empty($r['ok']), 'why' => (string) ($r['why'] ?? ''), 'to' => (string) ($r['to'] ?? ''), 'by' => $by, 'at' => $at];
            $R['replies'] = array_values(array_filter($R['replies'] ?? [], fn($y) => $y['ref'] !== $x['ref'])); $R['replies'][] = $x;
            if ($x['ok']) $R['back'] = null;   /* a reply after Back to To answer: Waiting again (by the log's order, not the clock) */
            break;
        }
    }
    return $R;
}
function inSync(bool $locked = false): void {
    $f = DATA_DIR . '/' . IN_LOG; clearstatcache(true, $f); $size = is_file($f) ? (int) filesize($f) : 0; inDb();
    if (metaGet('inbox:v') === IN_V && (int) (metaGet('inbox:off') ?? 0) === $size) return;
    if (!$locked) { withLock(fn() => inSync(true)); return; }
    $db = inDb(); $db->exec('BEGIN IMMEDIATE');
    try {
        clearstatcache(true, $f); $size = is_file($f) ? (int) filesize($f) : 0; $off = (int) (metaGet('inbox:off') ?? 0);
        if (metaGet('inbox:v') !== IN_V || $off > $size || prefixHash($f, $off) !== (string) (metaGet('inbox:ph') ?? '')) { $db->exec('DELETE FROM inbox'); $off = 0; }
        $C = []; $dirty = [];
        $get = function (string $iid) use (&$C, $db) {
            if (!array_key_exists($iid, $C)) { $q = $db->prepare('SELECT rec FROM inbox WHERE iid = ?'); $q->execute([$iid]); $v = $q->fetchColumn(); $C[$iid] = $v === false ? null : json_decode((string) $v, true); }
            return $C[$iid];
        };
        if ($size > $off) {
            $fh = fopen($f, 'rb'); fseek($fh, $off);
            while (($line = fgets($fh)) !== false) {
                if (substr($line, -1) !== "\n") break;
                $off += strlen($line); $r = json_decode($line, true); if (!is_array($r) || empty($r['iid'])) continue;
                $iid = (string) $r['iid']; $was = $get($iid); $now = inApply($was, $r); if ($now !== $was) { $C[$iid] = $now; $dirty[$iid] = 1; }
            }
            fclose($fh);
        }
        $q = $db->prepare('INSERT INTO inbox (iid, at, rec) VALUES (?, ?, ?) ON CONFLICT (iid) DO UPDATE SET at = excluded.at, rec = excluded.rec');
        foreach (array_keys($dirty) as $iid) if ($C[$iid]) $q->execute([$iid, (int) $C[$iid]['at'], json_encode($C[$iid], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
        metaSet('inbox:off', (string) $off); metaSet('inbox:ph', prefixHash($f, $off)); metaSet('inbox:v', IN_V);
        $db->exec('COMMIT');
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
}
function inGet(string $iid): ?array {
    if (!preg_match('/^[0-9a-f]{12}$/', $iid)) return null;
    inSync(); $q = inDb()->prepare('SELECT rec FROM inbox WHERE iid = ?'); $q->execute([$iid]); $v = $q->fetchColumn(); return $v === false ? null : json_decode((string) $v, true);
}
function inAll(): array { inSync(); return array_map(fn($r) => json_decode((string) $r['rec'], true), inDb()->query('SELECT rec FROM inbox ORDER BY at DESC, iid')->fetchAll()); }
function inRow(array $row): void { if (!logAdd($row + ['at' => time()], IN_LOG)) throw new RuntimeException('The Inbox log could not be written.'); }
/* ---- the four lists (2026-11-23, Matthew): To answer | Waiting on them | Done | Other. Worked out when the list is read, from the rows; no
   job runs. The thread an email is in: the same sender and the same subject without "Re:" / "Fw:" (the Peak email sender keeps no thread
   id for an incoming email, and a reply from the desk goes in the same thread, so their answer comes back as "RE: <subject>").
     done      pressed Done (Undo: Not done)
     open      "Back to To answer" (a back row; a reply after it clears it) not older than their newer email: we still owe them something
     done      superseded: they wrote again in the same thread (the newer email is its own row, on To answer until it is answered)
     wait      we replied (a reply that went) and nothing newer came from them: Waiting on them; 14 days of that counts as Done
               ("Closed: no reply in 14 days")
     open      the rest: nobody on our side has replied yet
   Other (notices, bounces, auto-replies): Remove hides one (a hide row; Undo puts it back); nothing leaves the log. */
const IN_WAIT_DAYS = 14;
function inSubj(string $s): string { return trim((string) preg_replace('/\s+/u', ' ', mb_strtolower((string) preg_replace('/^\s*((re|aw|fw|fwd|sv|antw|wg)\s*(\[\d+\])?\s*:\s*)+/iu', '', $s)))); }
function inThread(array $R): string { $f = strtolower(trim((string) ($R['from'] ?? ''))); return $f === '' || ($R['cat'] ?? '') === 'other' ? '' : $f . '|' . inSubj((string) ($R['subject'] ?? '')); }
function inReplyAt(array $R): int { $t = 0; foreach ($R['replies'] ?? [] as $x) if (!empty($x['ok'])) $t = max($t, (int) $x['at']); return $t; }
/** iid => ['b' => open|wait|done|other|removed, 'how' => done|auto|newer|back|'' , 'at' => when it got there, 'newer' => iid] for every email */
function inStates(array $all, ?int $now = null): array {
    $now ??= inNow(); $newest = []; $S = [];
    foreach ($all as $R) { $k = inThread($R); if ($k !== '' && (!isset($newest[$k]) || (int) $R['at'] > (int) $newest[$k]['at'])) $newest[$k] = $R; }
    foreach ($all as $R) {
        $iid = (string) $R['iid'];
        if (($R['cat'] ?? '') === 'other') { $S[$iid] = ['b' => !empty($R['hide']) ? 'removed' : 'other', 'how' => '', 'at' => (int) ($R['hide']['at'] ?? 0)]; continue; }
        if (!empty($R['done'])) { $S[$iid] = ['b' => 'done', 'how' => 'done', 'at' => (int) $R['done']['at']]; continue; }
        $k = inThread($R); $N = $k !== '' ? $newest[$k] : null; $newerAt = $N && (string) $N['iid'] !== $iid && (int) $N['at'] > (int) $R['at'] ? (int) $N['at'] : 0;
        $rep = inReplyAt($R); $back = (int) ($R['back']['at'] ?? 0);
        if ($back > 0 && $back >= $newerAt) $S[$iid] = ['b' => 'open', 'how' => 'back', 'at' => $back];
        elseif ($newerAt) $S[$iid] = ['b' => 'done', 'how' => 'newer', 'at' => $newerAt, 'newer' => (string) $N['iid']];
        elseif ($rep) $S[$iid] = $now - $rep >= IN_WAIT_DAYS * 86400 ? ['b' => 'done', 'how' => 'auto', 'at' => $rep + IN_WAIT_DAYS * 86400] : ['b' => 'wait', 'how' => '', 'at' => $rep];
        else $S[$iid] = ['b' => 'open', 'how' => '', 'at' => (int) $R['at']];
    }
    return $S;
}
function inTally(array $S): array { $n = ['open' => 0, 'wait' => 0, 'done' => 0, 'other' => 0, 'removed' => 0]; foreach ($S as $x) $n[$x['b']]++; return $n; }
function inCounts(): array { return inTally(inStates(inAll())); }
/** company names for the cards emails are on */
function inNames(array $items): array {
    $want = []; foreach ($items as $R) if (!empty($R['card']['id'])) $want[$R['card']['w']][(string) $R['card']['id']] = 1;
    $o = [];
    foreach ($want as $w => $ids) { sync($w); $q = db()->prepare('SELECT id, name, off FROM company WHERE world = ? AND id = ?'); foreach (array_keys($ids) as $id) { $q->execute([$w, (string) $id]); $x = $q->fetch(); if ($x) $o[$w . ':' . $id] = [(string) $x['name'], (int) $x['off']]; } }
    return $o;
}
/** an email as the page gets it: never where it is in the mailbox (mid, mb, imid), never an attachment's id */
function inOut(array $R, array $names, bool $full, ?array $st = null): array {
    $o = ['iid' => (string) $R['iid'], 'at' => (int) $R['at'], 'from' => (string) $R['from'], 'name' => (string) $R['name'], 'subject' => (string) $R['subject'], 'cat' => (string) $R['cat'], 'why' => (string) ($R['why'] ?? ''),
        'files' => array_map(fn($a, $i) => ['n' => $a['n'], 'i' => $i, 'dl' => inFileOk($a), 'size' => (int) $a['size']], $R['att'] ?? [], array_keys($R['att'] ?? [])),
        'claim' => $R['claim'] ?? null, 'done' => $R['done'] ?? null, 'read' => !empty($R['read']), 'stop' => !empty($R['stop']), 'auto' => !empty($R['auto']),
        'replies' => array_map(fn($x) => ['by' => $x['by'], 'at' => $x['at'], 'ok' => $x['ok'], 'why' => $x['why']], $R['replies'] ?? []), 'card' => null, 'rp' => (string) ($R['mid'] ?? '') !== '' || (string) ($R['imid'] ?? '') !== ''];
    if (!empty($R['card']['id'])) { $k = $R['card']['w'] . ':' . $R['card']['id']; $o['card'] = ['w' => (string) $R['card']['w'], 'id' => (string) $R['card']['id'], 'name' => (string) ($names[$k][0] ?? ''), 'off' => !empty($names[$k][1]), 'by' => (string) ($R['card']['by'] ?? '')]; }
    $st ??= inStates(inAll())[(string) $R['iid']] ?? ['b' => 'open', 'how' => '', 'at' => 0];
    $o['box'] = $st['b']; $o['how'] = $st['how']; $o['boxAt'] = (int) $st['at']; if (!empty($st['newer'])) $o['newer'] = $st['newer'];
    $o['back'] = $R['back'] ?? null; $o['hide'] = isset($R['hide']) ? ['by' => $R['hide']['by'], 'at' => $R['hide']['at'], 'bounce' => $R['hide']['bounce'] ?? []] : null;
    $t = (string) $R['text'];
    if ($full) $o['text'] = $t; else $o['preview'] = mb_strlen($t) > 220 ? rtrim(mb_substr($t, 0, 220)) . '…' : $t;
    return $o;
}
/** the list for the page: f = open | wait | done | other | removed | all; newest first, at most 300; each with its list (box) and why */
function inList(string $f, string $me): array {
    $all = inAll(); $S = inStates($all); $n = inTally($S);
    $f = in_array($f, ['open', 'wait', 'done', 'other', 'removed', 'all'], true) ? $f : 'open';
    $items = array_slice(array_values(array_filter($all, fn($R) => $f === 'all' ? $S[$R['iid']]['b'] !== 'removed' : $S[$R['iid']]['b'] === $f)), 0, 300);
    $names = inNames($items);
    return ['ok' => true, 'f' => $f, 'counts' => $n, 'wait' => IN_WAIT_DAYS, 'items' => array_map(fn($R) => inOut($R, $names, false, $S[$R['iid']]), $items), 'mailbox' => defined('TM_ORGANIZER') ? TM_ORGANIZER : 'partnerships@peakpickleball.us'];
}
/** a seller (not Claude Check) opening it marks it read in Peak Partnerships, once; nothing is moved or deleted */
function inOpen(string $iid, string $me, bool $act): array {
    $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
    if ($act && empty($R['read'])) {
        try { $b = inBox($R); if ($b !== '') { [$s] = pmGraph('PATCH', $b . '/messages/' . rawurlencode((string) $R['mid']), ['isRead' => true]); if ($s === 200) inRow(['t' => 'read', 'iid' => $iid, 'by' => $me]); } }
        catch (Throwable $e) { error_log('peak desk inbox read: ' . $e->getMessage()); }
    }
    return ['ok' => true, 'item' => inOut($R, inNames([$R]), true, inStates(inAll())[$iid] ?? null)];
}
/** the Graph path of the mailbox an email is in, when it is Peak Partnerships and the sender's code is here ('' otherwise) */
function inBox(array $R): string {
    if (!function_exists('tmLoad') || tmLoad() !== '' || (string) ($R['mid'] ?? '') === '' || !preg_match('#^[A-Za-z0-9+/=_-]{1,400}$#D', (string) $R['mid'])) return '';
    $F = pmFrom(); return !empty($F['shared']) && strtolower((string) $R['mb']) === strtolower((string) $F['email']) ? (string) $F['base'] : '';
}
function inFileOk(array $a): bool { return (string) ($a['id'] ?? '') !== '' && ($a['kind'] ?? '') === '#microsoft.graph.fileAttachment' && (int) ($a['size'] ?? 0) > 0 && (int) $a['size'] <= IN_FILE_MAX; }
/** one attachment, through the server: only a plain file, at most 15 MB, always as a download (never shown in the page) */
function inFile(string $iid, int $n): void {
    $R = inGet($iid); $a = $R['att'][$n] ?? null;
    if (!$R || !$a) fail('No such file.', 404);
    if (!inFileOk($a)) fail('This one opens in Outlook only (Matthew).', 409);
    $b = inBox($R); if ($b === '') fail('The mailbox can’t be reached from the desk right now. It opens in Outlook (Matthew).', 409);
    [$s, $j] = pmGraph('GET', $b . '/messages/' . rawurlencode((string) $R['mid']) . '/attachments/' . rawurlencode((string) $a['id']));
    $bytes = $s === 200 && is_string($j['contentBytes'] ?? null) ? base64_decode((string) $j['contentBytes'], true) : false;
    if ($bytes === false || $bytes === '') fail('Microsoft did not give the file just now. Try again, or open it in Outlook (Matthew).', 502);
    $nm = trim((string) preg_replace('/[\x00-\x1F\x7F"\\\\\/:*?<>|]+/', '_', (string) $a['n'])) ?: 'attachment';
    $ascii = (string) preg_replace('/[^\x20-\x7E]/', '_', $nm);
    header('Content-Type: application/octet-stream'); header('X-Content-Type-Options: nosniff'); header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Content-Disposition: attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($nm)); header('Content-Length: ' . strlen($bytes)); header('Cache-Control: private, no-store');
    echo $bytes; exit;
}
/** the claim lock (2026-11-23): who is answering it, and what someone else is told */
function inLockMsg(string $by): string { $f = strtok($by, ' ') ?: $by; return $by . ' is answering this. Ask ' . (strcasecmp($f, 'Matthew') === 0 ? 'Matthew' : $by . ' or Matthew') . ' to release it.'; }
function inLocked(?array $c, string $me): bool { return $c !== null && (string) ($c['by'] ?? '') !== $me; }
/** a card's email to $to: the newest Inbox email from that address still To answer or Waiting on them (not Done), when someone else has it
    claimed (else null) */
function inLockFor(string $to, string $me): ?array {
    $to = strtolower(trim($to)); if ($to === '') return null; $all = inAll(); $S = inStates($all);
    foreach ($all as $R) if (in_array($S[$R['iid']]['b'], ['open', 'wait'], true) && strtolower(trim((string) $R['from'])) === $to) return inLocked($R['claim'] ?? null, $me) ? ['iid' => (string) $R['iid'], 'claim' => $R['claim']] : null;
    return null;
}
/** Claim / Unclaim: a claim someone else holds is theirs; an admin may release it, or take it over (take: true) */
function inClaim(string $iid, bool $on, string $me, string $role = 'seller', bool $take = false): array {
    return withLock(function () use ($iid, $on, $me, $role, $take) {
        $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
        $c = $R['claim'] ?? null; $adm = $role === 'admin';
        if (inLocked($c, $me) && (!$adm || ($on && !$take))) return ['ok' => false, 'error' => inLockMsg((string) $c['by']), 'code' => 409, 'claim' => $c];
        if ((bool) $c === $on && (!$c || $c['by'] === $me)) return ['ok' => true, 'same' => true];
        inRow(['t' => 'claim', 'iid' => $iid, 'on' => $on, 'by' => $me]); return ['ok' => true];
    });
}
function inDone(string $iid, bool $on, string $me): array {
    return withLock(function () use ($iid, $on, $me) {
        $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
        if ((bool) ($R['done'] ?? null) !== $on) inRow(['t' => 'done', 'iid' => $iid, 'on' => $on, 'by' => $me]);
        return ['ok' => true];
    });
}
/** Back to To answer (2026-11-23): we replied, but still owe them something (or an auto-closed or superseded one wants answering after all).
    A reply after it moves it to Waiting again; their newer email in the thread takes over as before. */
function inBack(string $iid, string $me): array {
    return withLock(function () use ($iid, $me) {
        $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
        if (($R['cat'] ?? '') === 'other') return ['ok' => false, 'error' => 'This one is under Other: there is nothing to answer.', 'code' => 400];
        if (!empty($R['done'])) inRow(['t' => 'done', 'iid' => $iid, 'on' => false, 'by' => $me]);
        $all = inAll(); if ((inStates($all)[$iid]['b'] ?? '') !== 'open') inRow(['t' => 'back', 'iid' => $iid, 'by' => $me]);
        return ['ok' => true];
    });
}
/** the addresses a bounce notice names (not Peak's own) */
function inBounceAddrs(array $R): array {
    preg_match_all('/[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', (string) ($R['text'] ?? '') . ' ' . (string) ($R['subject'] ?? ''), $m);
    return array_values(array_filter(array_unique(array_map('strtolower', $m[0])), fn($e) => !preg_match('/@(.+\.)?peakpickleball\.us$/', $e) && $e !== strtolower((string) $R['from'])));
}
/** a bounce, before it is removed from Other: is it on the card of the company that address belongs to (a touch "email, bounced", as the
    Peak email sender puts it there)? If a card has the address and not the bounce, it is put on (deskBounced, once); if no card has the
    address, nothing is lost: the notice stays in inbox.log, the hide row says so, and Removed lists it. [[to, w, id, name, how]] with how
    'on card' | 'put on the card' | 'no card' */
function inBounceCheck(array $R, string $me, string $iid): array {
    $o = [];
    foreach (inBounceAddrs($R) as $e) {
        $hit = null;
        foreach (['sponsor', 'expo'] as $w) { foreach (recs($w) as $C) {
            if (!empty($C['off'])) continue;
            $bounced = false; foreach ($C['touches'] ?? [] as $t) if (($t['out'] ?? '') === 'bounced' && strtolower((string) ($t['to'] ?? '')) === $e) $bounced = true;
            if ($bounced || in_array($e, recEmails($C), true)) { $hit = [$w, $C, $bounced]; if ($bounced) break 2; }
        } }
        if (!$hit) { $o[] = ['to' => $e, 'w' => '', 'id' => '', 'name' => '', 'how' => 'no card']; continue; }
        [$w, $C, $bounced] = $hit;
        if (!$bounced) { $x = deskBounced($w, (string) $C['id'], $e, 'the notice in the Inbox, removed by ' . $me, 'Peak email', 'inbox-bounce:' . $iid . ':' . substr(sha1($e), 0, 8)); if (empty($x['ok'])) { $o[] = ['to' => $e, 'w' => '', 'id' => '', 'name' => '', 'how' => 'no card']; continue; } }
        $o[] = ['to' => $e, 'w' => $w, 'id' => (string) $C['id'], 'name' => (string) $C['name'], 'how' => $bounced ? 'on card' : 'put on the card'];
    }
    return $o;
}
/** Remove (2026-11-23): take a notice, bounce or auto-reply off Other (a hide row; on: false puts it back). Never deleted from the log. */
function inHide(string $iid, bool $on, string $me): array {
    $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
    if (($R['cat'] ?? '') !== 'other') return ['ok' => false, 'error' => 'Only the ones under Other can be removed.', 'code' => 400];
    if ((bool) ($R['hide'] ?? null) === $on) return ['ok' => true, 'same' => true, 'bounce' => $R['hide']['bounce'] ?? []];
    $b = $on && ($R['why'] ?? '') === 'bounce' ? inBounceCheck($R, $me, $iid) : [];
    withLock(fn() => inRow(['t' => 'hide', 'iid' => $iid, 'on' => $on, 'by' => $me] + ($b ? ['bounce' => $b] : [])));
    return ['ok' => true, 'bounce' => $b];
}
/** the email as a card shows one of their emails (deskMailIn's shape, mid and mailbox kept on the server for Reply) */
function inMail(array $R): array {
    return ['from' => (string) $R['from'], 'name' => (string) $R['name'], 'subject' => (string) $R['subject'], 'at' => (int) $R['at'], 'text' => (string) $R['text'], 'files' => array_map(fn($a) => (string) $a['n'], $R['att'] ?? []),
        'mid' => (string) ($R['mid'] ?? ''), 'mb' => (string) ($R['mb'] ?? ''), 'imid' => (string) ($R['imid'] ?? '')];
}
/** Attach to a company: their email on that card as a touch (as a matched reply is: by "Peak email", a follow-up today), once; no alert */
function inAttach(string $iid, string $w, string $id, string $me): array {
    $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
    if (!in_array($w, ['sponsor', 'expo'], true)) return ['ok' => false, 'error' => 'Pick a company.', 'code' => 400];
    $C = recs($w)[$id] ?? null; if (!$C || !empty($C['off'])) return ['ok' => false, 'error' => 'Pick a company that is on the desk.', 'code' => 404];
    $r = deskReplied($w, $id, (string) ($R['name'] !== '' ? $R['name'] : $R['from']), '“' . $R['subject'] . '” (put on this card from the Inbox by ' . $me . ')', 'Peak email', 'inbox:' . $iid, false, inMail($R), false);
    if (empty($r['ok'])) return $r;
    if (($R['card']['w'] ?? '') !== $w || ($R['card']['id'] ?? '') !== $id) inRow(['t' => 'attach', 'iid' => $iid, 'w' => $w, 'id' => $id, 'by' => $me]);
    return ['ok' => true, 'w' => $w, 'id' => $id, 'name' => (string) $C['name'], 'dup' => !empty($r['dup'])];
}
/** Reply from the Inbox: from Peak Partnerships with the seller's own signature, in the same thread (pmReplySend through pmDeskSend). On an
    email that is on a card it goes as a desk email on that card (logged there as a touch, "answering their email"); otherwise on the Inbox
    only. Someone else's claim is a lock (2026-11-23): only an admin gets past it, with take: true. The one who replies takes the claim. */
function inReply(string $iid, array $b, string $me, string $role = 'seller'): array {
    $R = inGet($iid); if (!$R) return ['ok' => false, 'error' => 'No such email.', 'code' => 404];
    if (!dmConf()['on']) return ['ok' => false, 'error' => 'Desk emails are off. They turn on once Matthew says go.', 'code' => 400];
    $c = $R['claim'] ?? null; if (inLocked($c, $me) && !($role === 'admin' && !empty($b['take']))) return ['ok' => false, 'error' => inLockMsg((string) $c['by']), 'code' => 409, 'claim' => $c];
    if ((string) ($R['mid'] ?? '') === '' && (string) ($R['imid'] ?? '') === '') return ['ok' => false, 'error' => 'This one can’t be answered from the desk.', 'code' => 400];
    $d = dmIn($b + ['to' => $R['from']]); if (isset($d['error'])) return ['ok' => false, 'error' => $d['error'], 'code' => 400];
    $mb = tmMailbox(); if (!$mb['ok']) return ['ok' => false, 'error' => 'It can\'t send right now: ' . $mb['why'] . '.', 'code' => 400];
    $re = ['k' => '', 'mid' => (string) $R['mid'], 'mb' => (string) $R['mb'], 'imid' => (string) $R['imid'], 'from' => (string) $R['from'], 'subject' => (string) $R['subject']];
    unset($d['re']);
    $card = !empty($R['card']['id']) ? $R['card'] : null; $C = $card ? (recs((string) $card['w'])[(string) $card['id']] ?? null) : null;
    if ($C && !empty($C['off'])) $C = null;
    if (!$c || inLocked($c, $me)) inRow(['t' => 'claim', 'iid' => $iid, 'on' => true, 'by' => $me]);
    if ($C) {
        $w = (string) $card['w'];
        $no = dmMayGet($C, $d['to']); if ($no !== '') return ['ok' => false, 'error' => 'Not sent: ' . $no . '.', 'code' => 400];
        if ($d['book'] && !bkConf()['on']) return ['ok' => false, 'error' => 'Booking links are off, so the booking link would not work. Take {book} out.', 'code' => 400];
        $mine = dmMine($me); $ref = 'dm' . bin2hex(random_bytes(5)); $id = (string) $C['id'];
        withLock(fn() => commit($w, [['t' => W($w)['T']['dmail'], 'id' => $id, 'ref' => $ref, 'sig' => $mine['sig'], 'replyto' => $mine['replyto'], 'by' => $me, 'at' => time()] + ['re' => $re] + $d]));
        $x = dmDeliver($w, $id, $ref, $me);
        inRow(['t' => 'reply', 'iid' => $iid, 'ref' => $ref, 'ok' => in_array($x['state'] ?? '', ['sent', 'dup'], true), 'why' => (string) ($x['why'] ?? ''), 'to' => $d['to'], 'w' => $w, 'id' => $id, 'by' => $me]);
        return ['ok' => true, 'ref' => $ref, 'card' => ['w' => $w, 'id' => $id, 'name' => (string) $C['name']]] + $x;
    }
    $no = dmMayGet(['dnc' => []], $d['to']); if ($no !== '') return ['ok' => false, 'error' => 'Not sent: ' . $no . '.', 'code' => 400];
    if ($d['book']) return ['ok' => false, 'error' => 'A booking link needs a company: use Attach to a company first, then reply.', 'code' => 400];
    $mine = dmMine($me); $ref = 'dm' . bin2hex(random_bytes(5));
    inRow(['t' => 'rmail', 'iid' => $iid, 'ref' => $ref, 'to' => $d['to'], 'name' => $d['name'], 'subject' => $d['subject'], 'text' => $d['text'], 'sig' => $mine['sig'], 'replyto' => $mine['replyto'], 'by' => $me]);
    $m = dmCompose($d + ['sig' => $mine['sig']], $ref);
    $x = pmDeskSend(['ref' => $ref, 'to' => $d['to'], 'name' => $d['name'], 'subject' => $m['subject'], 'text' => $m['text'], 'html' => $m['html'], 'replyTo' => $mine['replyto'], 'replyName' => $me,
        'w' => '', 'org' => '', 'company' => '', 'by' => $me, 'reply' => $re]);
    $ok = !empty($x['ok']);
    inRow(['t' => 'reply', 'iid' => $iid, 'ref' => $ref, 'ok' => $ok, 'why' => $ok ? '' : (string) ($x['why'] ?? 'it did not send'), 'to' => $d['to'], 'by' => $me]);
    return ['ok' => true, 'ref' => $ref, 'state' => $ok ? (!empty($x['dup']) ? 'dup' : 'sent') : 'failed', 'why' => $ok ? '' : (string) ($x['why'] ?? 'it did not send'), 'to' => $d['to']];
}

/* ---- alerts: who wants what ---- */
function alKey(string $name): string { return strtolower(trim($name)); }
/** a person's alert settings, with the defaults: replies on my companies ON, new Inbox mail ON, email OFF, quiet hours ON */
function alPrefs(string $name): array {
    $p = jread('people-settings.json', [])[alKey($name)]['alerts'] ?? []; $p = is_array($p) ? $p : [];
    $on = fn(string $k, bool $def) => array_key_exists($k, $p) ? !empty($p[$k]) : $def;
    return ['mine' => $on('mine', true), 'inbox' => $on('inbox', true), 'email' => $on('email', false), 'quiet' => $on('quiet', true)];
}
/** where a person's email alert goes: their own reply address (More, My email & booking link), '' when they set none */
function alAddr(string $name): string { $e = strtolower(trim((string) (jread('people-settings.json', [])[alKey($name)]['replyto'] ?? ''))); return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : ''; }
function alSave(string $name, array $in): array {
    $lk = fopen(DATA_DIR . '/people-settings.lock', 'c'); flock($lk, LOCK_EX);
    try {
        $all = jread('people-settings.json', []); $k = alKey($name); $cur = alPrefs($name);
        foreach (['mine', 'inbox', 'email', 'quiet'] as $f) if (array_key_exists($f, $in)) $cur[$f] = !empty($in[$f]);
        if ($cur['email'] && alAddr($name) === '') return ['error' => 'Put your own email in "Replies to my emails go to" first: the heads-up goes there.'];
        $all[$k] = (is_array($all[$k] ?? null) ? $all[$k] : ['name' => $name]) + ['name' => $name];
        $all[$k]['alerts'] = $cur + ['at' => time()];
        if (!jwrite('people-settings.json', $all)) return ['error' => 'It could not be saved.'];
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return alPrefs($name);
}
/** the people who can get alerts: name => role (sellers, admins, the expo-only accounts for their own companies; never Claude Check) */
function alPeople(): array { $o = []; foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) { $n = (string) ($a['name'] ?? ''); if ($n !== '' && $n !== 'Claude Check') $o[$n] = (string) ($a['role'] ?? ''); } return $o; }
function alSubs(): array { $j = jread('push-subs.json', []); return is_array($j) ? $j : []; }
function alDevices(string $who): array { $o = []; foreach (alSubs() as $h => $s) if (alKey((string) ($s['who'] ?? '')) === alKey($who)) $o[$h] = $s; return $o; }
/** can this person be reached at all: a device with alerts on, or the email heads-up */
function alReach(string $who): bool { return (bool) alDevices($who) || (alPrefs($who)['email'] && alAddr($who) !== ''); }
/** kind 'reply' on a card owned by a person: that owner; a reply to a blast (owner "Peak email" or nobody) or kind 'inbox': everyone with
    New Inbox mail on (sellers and admins) */
function alRecipients(string $kind, string $owner): array {
    $P = alPeople();
    if ($kind === 'reply' && $owner !== '' && $owner !== 'Peak email') {
        foreach ($P as $n => $role) if (alKey($n) === alKey($owner)) return alPrefs($n)['mine'] && alReach($n) ? [$n] : [];
        return [];
    }
    $o = []; foreach ($P as $n => $role) if (in_array($role, ['admin', 'seller'], true) && alPrefs($n)['inbox'] && alReach($n)) $o[] = $n;
    return $o;
}
/** queue one alert for each person (once per $key, whoever asks again) */
function alertNew(string $key, string $kind, string $text, string $url, array $who): void {
    if (!$who) return;
    alEdit(function (array $A) use ($key, $kind, $text, $url, $who) {
        if (isset($A['keys'][$key])) return $A;
        $now = inNow(); $A['keys'][$key] = $now;
        foreach ($who as $n) $A['q'][] = ['k' => $key, 'who' => (string) $n, 'at' => $now, 'kind' => $kind, 'text' => mb_substr($text, 0, 140), 'url' => $url, 'push' => 0, 'mail' => 0];
        foreach ($A['keys'] as $k => $t) if ($t < $now - 7 * 86400) unset($A['keys'][$k]);
        return $A;
    });
}
function alEdit(callable $fn) {
    $lk = fopen(DATA_DIR . '/alerts.lock', 'c'); if (!$lk) throw new RuntimeException('No alerts lock.'); flock($lk, LOCK_EX);
    try { $A = jread(AL_FILE, []); $A += ['q' => [], 'keys' => [], 'mailLast' => []]; $B = $fn($A); if (is_array($B)) { jwrite(AL_FILE, $B); @chmod(DATA_DIR . '/' . AL_FILE, 0600); } return $B; }
    finally { flock($lk, LOCK_UN); fclose($lk); }
}
/** a reply was put on a card (deskReplied): alert its owner, or the Inbox watchers when it answers a blast. Never for STOP. */
function deskAlertReply(string $w, array $R, string $ref): void {
    try {
        $id = (string) ($R['id'] ?? ''); $name = trim((string) ($R['name'] ?? '')) ?: 'A company';
        alertNew('rp:' . ($ref !== '' ? $ref : $w . ':' . $id . ':' . inNow()), 'reply', $name . ' replied', './#card/' . $w . '/' . $id, alRecipients('reply', (string) ($R['owner'] ?? '')));
    } catch (Throwable $e) { error_log('peak desk alert: ' . $e->getMessage()); }
}
function alQuiet(int $t): bool { $h = (int) date('G', $t); return $h >= 21 || $h < 7; }

/* ---- alerts: the devices and the key ---- */
function alVapid(bool $make = false): ?array {
    $f = DATA_DIR . '/push-vapid.json';
    $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    if (is_array($j) && !empty($j['publicKey']) && !empty($j['privateKey'])) return $j;
    if (!$make || file_exists($f)) return null;
    require_once __DIR__ . '/webpush.php';
    $lk = fopen($f . '.lock', 'c'); flock($lk, LOCK_EX);
    try {
        clearstatcache(); if (file_exists($f)) { $j = json_decode((string) file_get_contents($f), true); return is_array($j) ? $j : null; }
        $k = vapidKeysGenerate();
        $j = ['publicKey' => $k['publicKey'], 'privateKey' => $k['privateKey'], 'subject' => 'https://traverseplatforms.com/', 'made' => time()];
        $tmp = $f . '.tmp'; if (@file_put_contents($tmp, json_encode($j, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) return null;
        @chmod($tmp, 0600); rename($tmp, $f);
        return $j;
    } catch (Throwable $e) { error_log('peak desk push key not made: ' . mb_substr($e->getMessage(), 0, 120)); return null; }
    finally { flock($lk, LOCK_UN); fclose($lk); }
}
function alHttpOk(): bool { return inTestEnv('DESK_PUSH_ALLOW_HTTP') !== ''; }   /* the tests' push service is a plain listener on 127.0.0.1 */
function alSubAdd(string $who, array $sub, string $device, bool $phone): array {
    require_once __DIR__ . '/webpush.php';
    $chk = $sub; $ep = (string) ($sub['endpoint'] ?? '');
    if (alHttpOk() && str_starts_with($ep, 'http://127.0.0.1')) $chk['endpoint'] = 'https://' . substr($ep, 7);
    if (($e = webpushSubscriptionError($chk)) !== null) return ['ok' => false, 'error' => 'This device’s alert sign-up is not usable (' . $e . ').'];
    $h = substr(hash('sha256', $ep), 0, 16);
    $lk = fopen(DATA_DIR . '/push-subs.lock', 'c'); flock($lk, LOCK_EX);
    try {
        $a = alSubs();
        $mine = array_filter($a, fn($s) => alKey((string) ($s['who'] ?? '')) === alKey($who));
        if (!isset($a[$h]) && count($mine) >= AL_DEVICES) { uasort($mine, fn($x, $y) => ($x['seen'] ?? 0) <=> ($y['seen'] ?? 0)); unset($a[array_key_first($mine)]); }
        $a[$h] = ['who' => $who, 'sub' => ['endpoint' => $ep, 'keys' => ['p256dh' => (string) $sub['keys']['p256dh'], 'auth' => (string) $sub['keys']['auth']]],
            'device' => mb_substr((string) preg_replace('/[^A-Za-z0-9 .\'-]/', '', $device), 0, 30) ?: 'device', 'phone' => $phone, 'at' => (int) ($a[$h]['at'] ?? time()), 'seen' => time(), 'ok' => (int) ($a[$h]['ok'] ?? 0)];
        if (!jwrite('push-subs.json', $a)) return ['ok' => false, 'error' => 'It could not be saved.'];
        @chmod(DATA_DIR . '/push-subs.json', 0600);
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return ['ok' => true, 'id' => $h];
}
/** take a device off: by its endpoint (this device) or its id (the list); only the person's own */
function alSubDrop(string $who, string $endpoint, string $id): array {
    $h = $id !== '' ? $id : substr(hash('sha256', $endpoint), 0, 16);
    $lk = fopen(DATA_DIR . '/push-subs.lock', 'c'); flock($lk, LOCK_EX);
    try { $a = alSubs(); if (isset($a[$h]) && alKey((string) $a[$h]['who']) === alKey($who)) { unset($a[$h]); jwrite('push-subs.json', $a); } }
    finally { flock($lk, LOCK_UN); fclose($lk); }
    return ['ok' => true];
}
/** what the page shows: my settings, my devices (names only), where the email heads-up would go */
function alOut(string $me): array {
    $d = []; foreach (alDevices($me) as $h => $s) $d[] = ['id' => $h, 'device' => (string) ($s['device'] ?? ''), 'phone' => !empty($s['phone']), 'at' => (int) ($s['at'] ?? 0), 'ok' => (int) ($s['ok'] ?? 0)];
    return alPrefs($me) + ['devices' => $d, 'addr' => alAddr($me)];
}
/** one push to every device of one person: the number it reached */
function alPush(string $who, string $text, string $url, string $tag): int {
    $subs = alDevices($who); if (!$subs) return 0;
    $v = alVapid(false); if (!$v) return 0;
    require_once __DIR__ . '/webpush.php';
    $payload = (string) json_encode(['title' => 'Peak desk', 'body' => $text, 'url' => $url, 'tag' => $tag, 'at' => inNow()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $opts = ['urgency' => 'high', 'topic' => substr((string) preg_replace('/[^A-Za-z0-9_-]/', '', $tag), 0, 32) ?: 'peakdesk', 'timeout' => 10] + (alHttpOk() ? ['allowHttp' => true] : []);
    $n = 0; $gone = []; $ok = [];
    foreach ($subs as $h => $s) {
        $r = webpushSend((array) $s['sub'], $payload, $v, 86400, $opts);
        if ($r['ok']) { $n++; $ok[] = $h; } elseif ($r['gone']) $gone[] = $h; else error_log('peak desk push failed (' . mb_substr((string) ($s['device'] ?? ''), 0, 30) . '): ' . mb_substr((string) $r['error'], 0, 160));
    }
    if ($gone || $ok) {
        $lk = fopen(DATA_DIR . '/push-subs.lock', 'c'); flock($lk, LOCK_EX);
        try { $a = alSubs(); foreach ($gone as $h) unset($a[$h]); foreach ($ok as $h) if (isset($a[$h])) $a[$h]['ok'] = time(); jwrite('push-subs.json', $a); }
        finally { flock($lk, LOCK_UN); fclose($lk); }
    }
    return $n;
}
/** one email through the server's own mailbox (desk-mail.php, its own process); DESK_MAIL_FILE catches it in the tests */
function alMail(string $to, string $subject, string $body): array {
    $f = inTestEnv('DESK_MAIL_FILE');
    if ($f !== '') { file_put_contents($f, json_encode(['to' => $to, 'subject' => $subject, 'body' => $body], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'test file']; }
    $p = proc_open([deskPhp(), __DIR__ . '/desk-mail.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return ['ok' => false, 'stage' => 'the mail helper did not start'];
    fwrite($pipes[0], (string) json_encode(['to' => $to, 'subject' => $subject, 'body' => $body])); fclose($pipes[0]);
    $o = (string) stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    $j = json_decode(trim($o), true); return is_array($j) ? $j : ['ok' => false, 'stage' => 'no answer from the mail helper'];
}
/** the short heads-up: what happened (a company's name, or "a new email in the Inbox"), never their words or address */
function alMailText(array $items): array {
    $L = []; foreach ($items as $x) $L[] = $x['kind'] === 'inbox' ? 'A new email came to the Peak Partnerships inbox.' : $x['text'] . '.';
    $n = count($items); $one = $n === 1;
    $subject = 'Peak desk: ' . ($one ? ($items[0]['kind'] === 'inbox' ? 'a new email in the Inbox' : $items[0]['text']) : $n . ' new emails');
    $body = implode("\n", array_values(array_unique($L))) . "\n\nOpen the desk to read and answer: " . (defined('DESK_URL') ? DESK_URL : 'https://traverseplatforms.com/peak-desk-28d38d/')
        . "\n\nYou get this because you turned on email alerts in the Peak desk (More, My email & booking link). Turn them off there.";
    return ['subject' => $subject, 'body' => $body];
}
/** deliver what is due: pushes now (outside quiet hours), the email heads-up at most every 10 minutes per person. Returns counts. */
function alertsFlush(?int $now = null): array {
    $now ??= inNow(); $out = ['push' => 0, 'mail' => 0, 'held' => 0, 'dropped' => 0];
    $run = fopen(DATA_DIR . '/alerts-run.lock', 'c'); if (!$run || !flock($run, LOCK_EX | LOCK_NB)) return $out + ['busy' => 1];
    try {
        alEdit(function (array $A) use ($now, &$out) {
            $by = []; foreach ($A['q'] as $i => $x) $by[$x['who']][] = $i;
            foreach ($by as $who => $ix) {
                $P = alPrefs($who); $push = []; $mail = [];
                foreach ($ix as $i) { $x = $A['q'][$i]; if ($x['at'] < $now - AL_KEEP) { $A['q'][$i]['push'] = $A['q'][$i]['mail'] = 1; $out['dropped']++; continue; } if (!$x['push']) $push[] = $i; if (!$x['mail']) $mail[] = $i; }
                if (($push || $mail) && $P['quiet'] && alQuiet($now)) { $out['held'] += count(array_unique(array_merge($push, $mail))); continue; }
                if ($push) {
                    $it = array_map(fn($i) => $A['q'][$i], $push); $n = count($it);
                    $text = $n === 1 ? $it[0]['text'] : $n . ' new: ' . implode('; ', array_slice(array_values(array_unique(array_map(fn($x) => $x['text'], $it))), 0, 3));
                    $url = $n === 1 ? $it[0]['url'] : (count(array_filter($it, fn($x) => $x['kind'] === 'inbox')) ? './#inbox' : $it[0]['url']);
                    if (alDevices($who)) $out['push'] += alPush($who, $text, $url, $n === 1 ? substr(sha1($it[0]['k']), 0, 12) : 'peakdesk');
                    foreach ($push as $i) $A['q'][$i]['push'] = 1;
                }
                if ($mail) {
                    $addr = $P['email'] ? alAddr($who) : '';
                    if ($addr === '') { foreach ($mail as $i) $A['q'][$i]['mail'] = 1; }
                    elseif ((int) ($A['mailLast'][$who] ?? 0) <= $now - AL_GAP) {
                        $m = alMailText(array_map(fn($i) => $A['q'][$i], $mail)); $r = alMail($addr, $m['subject'], $m['body']);
                        if (!empty($r['ok'])) { $out['mail']++; $A['mailLast'][$who] = $now; foreach ($mail as $i) $A['q'][$i]['mail'] = 1; }
                        else error_log('peak desk email alert not sent: ' . mb_substr((string) ($r['stage'] ?? ''), 0, 120));
                    } else $out['held'] += count($mail);
                }
            }
            $A['q'] = array_values(array_filter($A['q'], fn($x) => !($x['push'] && $x['mail'])));
            foreach ($A['mailLast'] as $k => $t) if ($t < $now - 86400) unset($A['mailLast'][$k]);
            return $A;
        });
    } finally { flock($run, LOCK_UN); fclose($run); }
    if ($out['push'] || $out['mail']) @file_put_contents(DATA_DIR . '/alerts.log', date('Y-m-d H:i', $now) . ' push ' . $out['push'] . ', email ' . $out['mail'] . ($out['held'] ? ', held ' . $out['held'] : '') . "\n", FILE_APPEND | LOCK_EX);
    return $out;
}
/** a test alert to my own devices, now (More, Send me a test alert) */
function alTest(string $me): array {
    $n = alPush($me, 'Test alert: alerts are on for this device', './#inbox', 'peakdesk-test');
    return ['ok' => true, 'sent' => $n, 'devices' => count(alDevices($me))];
}

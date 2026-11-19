<?php
/* J.A.R.V.I.S., the merged page (2026-11-18, Matthew: "Yeah I want it them merged together. It will give jarvis application more function
   other then just the chat feature"). The page is public/jarvis/ (source assistant/jarvis/), behind this Assistant's own sign-in.
   This file serves only what the Assistant did not already have: the status the laptop pushes into data/jarvis/status.json
   (assistant/jarvis/tools/jarvis-status.sh, run by the overnight check every 30 minutes and by builders as they go), and the calendar
   placeholder. It reads no other app's files: team requests, Outbox and the Peak desk are read by the page from those apps' own
   endpoints, with their own sign-ins. No model calls here. */
declare(strict_types=1);

function jvClean($s, int $n): string { return mb_substr(trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $s)), 0, $n); }
/** the laptop's last push: whitelisted fields only, whatever the file holds */
function jvStatus(): array {
    $f = aDataDir() . '/jarvis/status.json';
    $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null; $j = is_array($j) ? $j : [];
    $now = time(); $pushed = (int) ($j['pushedAt'] ?? 0);
    $o = is_array($j['overnight'] ?? null) ? $j['overnight'] : null;
    $over = $o ? ['at' => (int) ($o['at'] ?? 0), 'ok' => max(0, (int) ($o['ok'] ?? 0)), 'problems' => array_values(array_map(fn($p) => jvClean($p, 220), array_slice(array_filter((array) ($o['problems'] ?? []), 'is_string'), 0, 12)))] : null;
    $builds = []; $hid = jvHidden();
    foreach (array_slice(array_filter((array) ($j['builds'] ?? []), 'is_array'), 0, 20) as $b) {
        $st = in_array($b['state'] ?? '', ['running', 'done', 'failed', 'stopped'], true) ? $b['state'] : 'running';
        $at = (int) ($b['at'] ?? 0);
        if (($hid[(string) ($b['id'] ?? '')] ?? -1) === $at) continue;   /* checked off by Matthew (18 Nov); any later word from it has a new time and shows again */
        if ($st !== 'running' && $at < $now - 86400) continue;          /* finished ones show for a day */
        if ($st === 'running' && $at < $now - 6 * 3600) $st = 'quiet';   /* no word for 6 hours: say so rather than show it running */
        $pct = isset($b['pct']) && is_numeric($b['pct']) ? max(0, min(100, (int) $b['pct'])) : null;
        $builds[] = ['id' => jvClean($b['id'] ?? '', 40), 'name' => jvClean($b['name'] ?? '', 90), 'state' => $st, 'pct' => $st === 'done' ? 100 : $pct,
            'step' => max(0, (int) ($b['step'] ?? 0)), 'steps' => max(0, (int) ($b['steps'] ?? 0)), 'note' => jvClean($b['note'] ?? '', 140), 'at' => $at];
    }
    /* calendar (18 Nov): only the Traverse inbox's own Google Calendar, which Matthew fills himself or asks for ("jarvis shouldnt show the
       dates from my emails in the calendar section"). No invitations from the inboxes. */
    /* 19 Nov (P-8, Matthew: "go ahead and add the 8 steps"): the laptop's heartbeat, the decisions waiting on him, the money summary, his
       reminders. The heartbeat is beat.txt (help-watch.sh, every 5 minutes while the laptop is awake) or the last push, whichever is newer. */
    $bf = aDataDir() . '/jarvis/beat.txt'; $beat = max($pushed, is_file($bf) ? (int) trim((string) file_get_contents($bf)) : 0);
    return ['ok' => true, 'now' => $now, 'pushedAt' => $pushed, 'beat' => min($beat, $now), 'overnight' => $over, 'builds' => $builds, 'teamHidden' => jvTeamHidden(),
        'calendar' => jvCalendar(), 'waiting' => jvWaiting($j), 'money' => jvMoney($j), 'reminders' => jvReminders(), 'calWrite' => jvCalAccount(true) !== null];
}

/* ---------------------------------------------------------------- Waiting on you (19 Nov, P-8 step 5)
   One list of decisions waiting on Matthew. The items come from assistant/jarvis/waiting.json on the laptop (sessions keep it; jarvis-status.sh
   pushes it inside status.json). His tap is kept here (data/jarvis/decisions.json) and the page sends it to the desk as a message, so a
   session acts on it. Each tap covers that one item only. It is never a way to approve a social post (the post calendar does that; Sixfold
   posts are Jen's) or to send an email: such items are dropped here and refused if decided. */
const JV_COMPANIES = ['Surge', 'Sixfold', 'Traverse', 'Peak', 'Personal', 'Other'];
function jvBarred(array $w): bool {
    if (in_array(strtolower((string) ($w['kind'] ?? 'decision')), ['post', 'posts', 'publish', 'schedule', 'send', 'email', 'text', 'sms'], true)) return true;
    $t = (string) ($w['title'] ?? '') . ' ' . (string) ($w['detail'] ?? '');
    return (bool) preg_match('/\b(approve|ok|okay|publish|schedule)\b[^.]{0,40}\b(post|posts|caption|reel|story|stories)\b|\bsend (the|this|these|that|an?)\b[^.]{0,20}\b(email|emails|text|texts|newsletter)\b/i', $t);
}
function jvDecisions(): array { $f = aDataDir() . '/jarvis/decisions.json'; $h = is_file($f) ? json_decode((string) file_get_contents($f), true) : []; return is_array($h) ? $h : []; }
function jvWaiting(array $j): array {
    $dec = jvDecisions(); $out = [];
    foreach (array_slice(array_filter((array) ($j['waiting'] ?? []), 'is_array'), 0, 30) as $w) {
        $id = (string) ($w['id'] ?? ''); if (!preg_match('/^[a-z0-9][a-z0-9-]{0,39}$/', $id) || jvBarred($w)) continue;
        $co = in_array($w['company'] ?? '', JV_COMPANIES, true) ? $w['company'] : 'Other';
        $at = (int) ($w['at'] ?? 0); $d = $dec[$id] ?? null;
        $out[] = ['id' => $id, 'title' => jvClean($w['title'] ?? '', 160), 'detail' => jvClean($w['detail'] ?? '', 400), 'company' => $co, 'from' => jvClean($w['from'] ?? '', 80), 'at' => $at,
            'decided' => ($d && (int) ($d['itemAt'] ?? -1) === $at) ? ['decision' => (string) $d['decision'], 'note' => jvClean($d['note'] ?? '', 400), 'at' => (int) $d['at'], 'ticket' => (string) ($d['ticket'] ?? '')] : null];
    }
    return $out;
}
/** Matthew's tap on one item: approve or decline, with an optional note; or, after the page has sent it to the desk, the ticket it went in */
function jvDecide(array $b): array {
    $id = (string) ($b['id'] ?? ''); $at = (int) ($b['at'] ?? 0);
    $f = aDataDir() . '/jarvis/status.json'; $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : null;
    $item = null; foreach ((array) (is_array($j) ? ($j['waiting'] ?? []) : []) as $w) if (is_array($w) && (string) ($w['id'] ?? '') === $id && (int) ($w['at'] ?? 0) === $at) $item = $w;
    if (!$item) return ['ok' => false, 'error' => 'That item is not on the list any more.'];
    if (jvBarred($item)) return ['ok' => false, 'error' => 'Posts are approved in the post calendar, and emails go out only from Outbox or your own Send. Not here.'];
    $ticket = (string) ($b['ticket'] ?? ''); $dec = (string) ($b['decision'] ?? '');
    if ($ticket !== '' && !preg_match('/^h[0-9]{14}[0-9a-f]{4}$/', $ticket)) return ['ok' => false, 'error' => 'Not a desk ticket.'];
    if ($ticket === '' && !in_array($dec, ['approve', 'decline'], true)) return ['ok' => false, 'error' => 'Approve or decline.'];
    $h = jvDecisions();
    if ($ticket !== '') { if (!isset($h[$id]) || (int) ($h[$id]['itemAt'] ?? -1) !== $at) return ['ok' => false, 'error' => 'Decide it first.']; $h[$id]['ticket'] = $ticket; }
    else {
        if (isset($h[$id]) && (int) ($h[$id]['itemAt'] ?? -1) === $at) return ['ok' => false, 'error' => 'Already decided: ' . $h[$id]['decision'] . '.'];
        unset($h[$id]); $h[$id] = ['decision' => $dec, 'note' => mb_substr(trim((string) ($b['note'] ?? '')), 0, 400), 'at' => time(), 'itemAt' => $at, 'ticket' => ''];
    }
    $h = array_slice($h, -200, null, true);
    $df = aDataDir() . '/jarvis/decisions.json'; @mkdir(dirname($df), 0700, true); file_put_contents($df, json_encode($h, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX); @chmod($df, 0600);
    if (function_exists('alog')) alog('jarvis decision', ['id' => $id, 'decision' => $h[$id]['decision'], 'ticket' => $ticket]);
    return ['ok' => true, 'decided' => ['decision' => $h[$id]['decision'], 'note' => $h[$id]['note'], 'at' => $h[$id]['at'], 'ticket' => $h[$id]['ticket']]];
}

/* ---------------------------------------------------------------- Money (19 Nov, P-8 step 6)
   Totals only, pushed by the laptop (jarvis-status.sh): the Spend Ledger's subscriptions (the laptop keeps a summary; the ledger itself is a
   claude.ai artifact the server cannot reach) and Traverse's Stripe (read only, with the key that stays on the laptop). Numbers only pass:
   never a card, a key, a customer or Matthew's pay. Renewals and trial ends come from the reminders. */
function jvMoney(array $j): array {
    $m = is_array($j['money'] ?? null) ? $j['money'] : [];
    $num = fn($v) => is_numeric($v) ? round((float) $v, 2) : null;
    $l = is_array($m['ledger'] ?? null) ? $m['ledger'] : null; $s = is_array($m['stripe'] ?? null) ? $m['stripe'] : null;
    $by = [];
    if ($l) foreach (['surge', 'sixfold', 'a365', 'traverse', 'unsorted'] as $k) if (isset($l['byEntity'][$k]) && is_numeric($l['byEntity'][$k])) $by[$k] = $num($l['byEntity'][$k]);
    return ['ledger' => $l ? ['perMonth' => $num($l['perMonth'] ?? null), 'monthly' => $num($l['monthly'] ?? null), 'yearly' => $num($l['yearly'] ?? null), 'once' => $num($l['once'] ?? null),
            'planned' => $num($l['planned'] ?? null), 'items' => max(0, (int) ($l['items'] ?? 0)), 'byEntity' => $by, 'asOf' => jvClean($l['asOf'] ?? '', 20)] : null,
        'stripe' => $s ? ['month' => $num($s['month'] ?? null), 'available' => $num($s['available'] ?? null), 'pending' => $num($s['pending'] ?? null), 'charges' => max(0, (int) ($s['charges'] ?? 0)),
            'at' => (int) ($s['at'] ?? 0), 'error' => jvClean($s['error'] ?? '', 120)] : null];
}

/* ---------------------------------------------------------------- Reminders (19 Nov, P-8 step 3)
   "Remind me 4 Jan about reMarkable": kept here (data/jarvis/reminders.json), pushed to Matthew's phone on the day by the 10-minute check
   (cron.php, which rides on meta-leads.php: the host has no crontab), through the same phone alert the desk uses (jvpush.php beside this
   folder). Added from the page's form, typed "remind me ...", or the Assistant's add_reminder tool. When the Traverse calendar is connected
   with write access (Connect again once), each open reminder is also put on that calendar. Nothing here sends an email or a text. */
function jvTz(): DateTimeZone { return new DateTimeZone('America/Denver'); }
/** the seven dated reminders already in TASKS.md and memory on 19 Nov; added once, only those still ahead */
function jvSeeds(): array {
    return [
        ['2026-11-24', '08:00', 'Google Business Profile: transfer ownership to the Sixfold email (SX-80), then drop the Surge email to Manager.', null],
        ['2026-11-24', '08:00', 'Sixfold 365 December newsletter: the draft is due to you today, to show Jen. It sends 1 Dec only with your go.', null],
        ['2026-12-08', '08:00', 'Traverse Google Workspace renews about 11 Dec: check admin.google.com > Billing for the date and a card on file.', ['kind' => 'renews', 'on' => '2026-12-11', 'what' => 'Traverse Google Workspace']],
        ['2026-12-10', '08:00', 'Adobe Express trial ends about 13 Dec: keep it or cancel before it charges.', ['kind' => 'trial', 'on' => '2026-12-13', 'what' => 'Adobe Express trial']],
        ['2026-12-15', '08:00', 'Sixfold January posts for Jen: produce the month (jen-learn report, then drafts she approves).', null],
        ['2027-01-04', '08:00', 'reMarkable subscription charges 7 Jan: keep it or cancel first.', ['kind' => 'charges', 'on' => '2027-01-07', 'what' => 'reMarkable subscription']],
        ['2027-10-01', '08:00', 'The Assistant\'s Anthropic key expires 22 Oct 2027: make a new one and paste it into Setup.', ['kind' => 'expires', 'on' => '2027-10-22', 'what' => 'Anthropic key (the Assistant)']],
    ];
}
function jvRemFile(): string { @mkdir(aDataDir() . '/jarvis', 0700, true); return 'jarvis/reminders.json'; }
function jvRemAll(): array {
    $all = jget(jvRemFile());
    if (empty($all['seeded'])) $all = jedit(jvRemFile(), function ($a) {
        if (!empty($a['seeded'])) return $a;
        $a['list'] = $a['list'] ?? [];
        foreach (jvSeeds() as $s) { $r = jvRemMake($s[2], $s[0], $s[1], $s[3], 'seed'); if (is_array($r) && $r['due'] > time()) $a['list'][] = $r; }
        $a['seeded'] = time(); return $a;
    });
    return $all;
}
/** a new reminder, or an error string */
function jvRemMake(string $text, string $date, string $time = '', ?array $money = null, string $by = 'page') {
    $text = jvClean($text, 200); if (mb_strlen($text) < 2) return 'Say what to remind you about.';
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $d) || !checkdate((int) $d[2], (int) $d[3], (int) $d[1])) return 'Give the date as a day, month and year.';
    if ($time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) return 'Give the time like 08:30 or 15:00.';
    $due = (new DateTime($date . ' ' . ($time !== '' ? $time : '08:00'), jvTz()))->getTimestamp();
    if ($due > time() + 3 * 366 * 86400) return 'That is more than three years away.';
    $mo = null;
    if (is_array($money) && in_array($money['kind'] ?? '', ['renews', 'trial', 'charges', 'expires'], true)) $mo = ['kind' => $money['kind'], 'on' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($money['on'] ?? '')) ? $money['on'] : $date, 'what' => jvClean($money['what'] ?? $text, 80)];
    return ['id' => 'r' . time() . bin2hex(random_bytes(3)), 'text' => $text, 'date' => $date, 'time' => $time, 'due' => $due, 'state' => 'open', 'pushedAt' => 0, 'created' => time(), 'by' => $by, 'money' => $mo, 'calId' => ''];
}
function jvRemAdd(string $text, string $date, string $time = '', ?array $money = null, string $by = 'page'): array {
    jvRemAll();
    $r = jvRemMake($text, $date, $time, $money, $by); if (!is_array($r)) return ['ok' => false, 'error' => $r];
    if ($r['due'] < time() - 3600) return ['ok' => false, 'error' => 'That date has already gone.'];
    jedit(jvRemFile(), function ($a) use ($r) { $a['list'] = array_slice(array_merge($a['list'] ?? [], [$r]), -300); return $a; });
    $cal = jvRemCalendar($r['id']);
    if (function_exists('alog')) alog('reminder added', ['id' => $r['id'], 'date' => $r['date'], 'by' => $by]);
    if ($cal) $r['calId'] = $cal;
    return ['ok' => true, 'reminder' => jvRemPublic($r), 'calendar' => (bool) $cal];
}
function jvRemPublic(array $r): array {
    return ['id' => $r['id'], 'text' => $r['text'], 'date' => $r['date'], 'time' => $r['time'], 'due' => (int) $r['due'], 'state' => $r['state'], 'pushed' => (int) ($r['pushedAt'] ?? 0) > 0,
        'money' => $r['money'] ?? null, 'onCal' => ($r['calId'] ?? '') !== '', 'doneAt' => (int) ($r['doneAt'] ?? 0)];
}
/** open ones (and those done in the last 2 days), soonest first */
function jvReminders(): array {
    $l = array_filter(jvRemAll()['list'] ?? [], fn($r) => is_array($r) && (($r['state'] ?? '') === 'open' || (int) ($r['doneAt'] ?? 0) > time() - 2 * 86400));
    usort($l, fn($a, $b) => $a['due'] <=> $b['due']);
    return array_values(array_map('jvRemPublic', array_slice($l, 0, 60)));
}
/** done, undo, snooze (a day, from now if it is already due), or delete */
function jvRemSet(string $id, string $op, int $days = 1): array {
    if (!preg_match('/^r\d{10}[0-9a-f]{6}$/', $id) || !in_array($op, ['done', 'undo', 'snooze', 'delete'], true)) return ['ok' => false, 'error' => 'Not a reminder.'];
    $hit = null;
    jedit(jvRemFile(), function ($a) use ($id, $op, $days, &$hit) {
        foreach ($a['list'] ?? [] as $k => $r) {
            if (($r['id'] ?? '') !== $id) continue;
            if ($op === 'delete') { unset($a['list'][$k]); $a['list'] = array_values($a['list']); $hit = ['id' => $id, 'deleted' => true]; return $a; }
            if ($op === 'done') { $r['state'] = 'done'; $r['doneAt'] = time(); }
            if ($op === 'undo') { $r['state'] = 'open'; unset($r['doneAt']); }
            if ($op === 'snooze') {
                $days = max(1, min(30, $days)); $tz = jvTz();
                $base = new DateTime('@' . max((int) $r['due'], time())); $base->setTimezone($tz);
                if ((int) $r['due'] <= time()) { $base = new DateTime('tomorrow ' . ($r['time'] !== '' ? $r['time'] : '08:00'), $tz); if ($days > 1) $base->modify('+' . ($days - 1) . ' days'); }
                else $base->modify('+' . $days . ' days');
                $r['due'] = $base->getTimestamp(); $r['date'] = $base->format('Y-m-d'); $r['pushedAt'] = 0; $r['state'] = 'open'; $r['snoozed'] = (int) ($r['snoozed'] ?? 0) + 1;
            }
            $a['list'][$k] = $r; $hit = jvRemPublic($r); return $a;
        }
        return $a;
    });
    return $hit ? ['ok' => true, 'reminder' => $hit] : ['ok' => false, 'error' => 'That reminder is not there any more.'];
}
/** the inbox whose calendar J.A.R.V.I.S. uses (Traverse first); $write: only if it was connected with Calendar events (write) access */
function jvCalAccount(bool $write = false): ?array {
    $acc = null;
    foreach (jget('accounts.json') as $e => $a) if (is_array($a) && !empty($a['cal']) && !empty($a['refresh']) && ($a['on'] ?? true) && (!$write || !empty($a['calWrite']))) { if (!$acc || ($a['label'] ?? '') === 'Traverse') $acc = ['email' => (string) $e] + $a; }
    return $acc;
}
/** put one open reminder on the calendar, if it can write there and it is not on it yet; returns the event id or '' */
function jvRemCalendar(string $id): string {
    $acc = jvCalAccount(true); if (!$acc) return '';
    $r = null; foreach (jget(jvRemFile())['list'] ?? [] as $x) if (($x['id'] ?? '') === $id) $r = $x;
    if (!$r || $r['state'] !== 'open' || ($r['calId'] ?? '') !== '') return '';
    $tok = gToken($acc['email']); if (!$tok) return '';
    $ev = ['summary' => 'Reminder: ' . $r['text'], 'description' => 'Added by J.A.R.V.I.S. reminders. It also pushes to your phone on the day.',
        'reminders' => ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => 0]]]];
    if ($r['time'] === '') { $next = (new DateTime($r['date'], jvTz()))->modify('+1 day')->format('Y-m-d'); $ev['start'] = ['date' => $r['date']]; $ev['end'] = ['date' => $next]; $ev['reminders']['overrides'][0]['minutes'] = 0; }
    else { $s = new DateTime('@' . $r['due']); $s->setTimezone(jvTz()); $e = (clone $s)->modify('+30 minutes'); $ev['start'] = ['dateTime' => $s->format(DATE_RFC3339), 'timeZone' => 'America/Denver']; $ev['end'] = ['dateTime' => $e->format(DATE_RFC3339), 'timeZone' => 'America/Denver']; }
    $res = http('POST', jvCalBase() . 'calendars/primary/events', null, $ev, ['Authorization: Bearer ' . $tok]);
    $eid = (string) ($res['id'] ?? '');
    if ($eid === '') { if (function_exists('alog')) alog('reminder calendar add failed', ['status' => (int) ($res['_status'] ?? 0)]); return ''; }
    jedit(jvRemFile(), function ($a) use ($id, $eid) { foreach ($a['list'] ?? [] as $k => $x) if (($x['id'] ?? '') === $id) $a['list'][$k]['calId'] = $eid; return $a; });
    @unlink(aDataDir() . '/jarvis/cal-cache.json');   /* the panel shows it at once */
    return $eid;
}
/** Google Calendar's address; PHP's own test server or the test's CLI run alone may point it at a mock. Never on the host. */
function jvCalBase(): string {
    $m = in_array(PHP_SAPI, ['cli-server', 'cli'], true) ? (string) getenv('JARVIS_CAL_MOCK') : '';
    return $m !== '' ? rtrim($m, '/') . '/' : 'https://www.googleapis.com/calendar/v3/';
}
/** the 10-minute check: push what is due to Matthew's phone (once each), and put open reminders on the calendar once it can be written */
function jvRemindersRun(): array {
    $out = ['pushed' => 0, 'failed' => 0, 'calendar' => 0];
    foreach (jvRemAll()['list'] ?? [] as $r) {
        if (($r['state'] ?? '') !== 'open') continue;
        if ((int) $r['due'] <= time() && empty($r['pushedAt'])) {
            if (jvPush('J.A.R.V.I.S. reminder', $r['text'], '/a-e018bb82/jarvis/', 'jv-remind-' . $r['id'])) {
                $out['pushed']++; jedit(jvRemFile(), function ($a) use ($r) { foreach ($a['list'] ?? [] as $k => $x) if (($x['id'] ?? '') === $r['id']) $a['list'][$k]['pushedAt'] = time(); return $a; });
            } else $out['failed']++;
        }
        if ((int) $r['due'] > time() && ($r['calId'] ?? '') === '' && jvCalAccount(true) && jvRemCalendar($r['id']) !== '') $out['calendar']++;
    }
    return $out;
}
/** one alert to Matthew's phones, the same one a desk reply makes: jvpush.php loads the Field app's own push code (its helpAlertMatthew) in a
    separate process. JARVIS_PUSH_CMD is for the test copy only. */
function jvPush(string $title, string $text, string $url, string $tag): bool {
    $cmd = (string) getenv('JARVIS_PUSH_CMD');
    $cmd = $cmd !== '' ? $cmd : escapeshellarg(PHP_BINARY ?: 'php') . ' ' . escapeshellarg(dirname(__DIR__) . '/jvpush.php');
    $p = proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return false;
    fwrite($pipes[0], json_encode(['title' => $title, 'text' => mb_substr($text, 0, 200), 'url' => $url, 'tag' => $tag], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); fclose($pipes[0]);
    $o = stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    $rc = proc_close($p);
    return $rc === 0 && str_contains((string) $o, 'pushed');
}
/** finished builds Matthew checked off (18 Nov: "allow me the option to check it off so it doesnt stay on the screen"): id => the build's time */
function jvHidden(): array { $f = aDataDir() . '/jarvis/hidden-builds.json'; $h = is_file($f) ? json_decode((string) file_get_contents($f), true) : []; return is_array($h) ? $h : []; }
function jvHide(string $id, int $at): array {
    if (!preg_match('/^[A-Za-z0-9._-]{1,40}$/', $id) || $at <= 0) return ['ok' => false, 'error' => 'Not a build.'];
    $h = jvHidden(); $h[$id] = $at; $h = array_slice($h, -60, null, true);
    $f = aDataDir() . '/jarvis/hidden-builds.json'; @mkdir(dirname($f), 0700, true); file_put_contents($f, json_encode($h), LOCK_EX); @chmod($f, 0600);
    return ['ok' => true];
}
/** team requests Matthew checked off (18 Nov: "I also need a way to check off the team request chats when they are complete"): "<desk>:<ticket>"
    => the ticket's last update. Only his J.A.R.V.I.S. view: the staff member's chat is not closed, and any newer message shows it again. */
function jvTeamHidden(): array { $f = aDataDir() . '/jarvis/hidden-team.json'; $h = is_file($f) ? json_decode((string) file_get_contents($f), true) : []; return is_array($h) ? $h : []; }
function jvTeamHide(string $key, int $upd): array {
    if (!preg_match('/^[a-z0-9-]{1,40}:h[0-9]{14}[0-9a-f]{4}$/', $key) || $upd <= 0) return ['ok' => false, 'error' => 'Not a team request.'];
    $h = jvTeamHidden(); unset($h[$key]); $h[$key] = $upd; $h = array_slice($h, -300, null, true);
    $f = aDataDir() . '/jarvis/hidden-team.json'; @mkdir(dirname($f), 0700, true); file_put_contents($f, json_encode($h), LOCK_EX); @chmod($f, 0600);
    return ['ok' => true];
}
/** the next 7 days of the Traverse inbox's primary calendar (any connected calendar if Traverse has none), cached 5 minutes. Read only. */
function jvCalendar(): array {
    $acc = jvCalAccount();
    if (!$acc) return ['source' => 'none', 'need' => 'Connect the Traverse calendar to see it here.'];
    $email = (string) $acc['email']; $label = (string) ($acc['label'] ?? $email);
    $cf = aDataDir() . '/jarvis/cal-cache.json';
    $c = is_file($cf) ? json_decode((string) file_get_contents($cf), true) : null;
    if (is_array($c) && ($c['email'] ?? '') === $email && time() - (int) ($c['at'] ?? 0) < 300) return $c['out'];
    $tz = new DateTimeZone('America/Denver'); $from = new DateTime('today', $tz); $to = (clone $from)->modify('+7 days');
    $tok = gToken($email);
    if (!$tok) return ['source' => $label, 'error' => 'The ' . $label . ' calendar needs reconnecting.', 'events' => []];
    $r = http('GET', jvCalBase() . 'calendars/primary/events?' . http_build_query(['timeMin' => $from->format(DATE_RFC3339), 'timeMax' => $to->format(DATE_RFC3339),
        'singleEvents' => 'true', 'orderBy' => 'startTime', 'maxResults' => 40, 'timeZone' => 'America/Denver']), null, null, ['Authorization: Bearer ' . $tok]);
    if (($r['_status'] ?? 0) !== 200) {
        $why = (string) ($r['error']['errors'][0]['reason'] ?? $r['error']['status'] ?? '');
        $msg = in_array($why, ['accessNotConfigured', 'SERVICE_DISABLED'], true) ? 'Google Calendar API is switched off in the Assistant\'s Google Cloud project: turn it on, then wait a minute.'
            : (in_array($why, ['insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'PERMISSION_DENIED'], true) ? 'The ' . $label . ' inbox was connected without Calendar: connect the calendar again.' : 'Google Calendar did not answer (HTTP ' . (int) ($r['_status'] ?? 0) . ').');
        if (function_exists('alog')) alog('calendar read failed', ['email' => $email, 'status' => (int) ($r['_status'] ?? 0), 'reason' => $why]);
        return ['source' => $label, 'error' => $msg, 'events' => []];
    }
    $ev = [];
    foreach ((array) ($r['items'] ?? []) as $i) {
        if (($i['status'] ?? '') === 'cancelled') continue;
        $all = isset($i['start']['date']) && !isset($i['start']['dateTime']);
        $ev[] = ['title' => jvClean($i['summary'] ?? '(busy)', 120), 'start' => (string) ($i['start']['dateTime'] ?? $i['start']['date'] ?? ''), 'end' => (string) ($i['end']['dateTime'] ?? $i['end']['date'] ?? ''),
            'allDay' => $all, 'where' => jvClean($i['location'] ?? '', 80)];
    }
    $out = ['source' => $label, 'events' => $ev];
    @mkdir(dirname($cf), 0700, true); file_put_contents($cf, json_encode(['email' => $email, 'at' => time(), 'out' => $out]), LOCK_EX); @chmod($cf, 0600);
    return $out;
}

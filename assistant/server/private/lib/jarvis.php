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
    $builds = [];
    foreach (array_slice(array_filter((array) ($j['builds'] ?? []), 'is_array'), 0, 20) as $b) {
        $st = in_array($b['state'] ?? '', ['running', 'done', 'failed', 'stopped'], true) ? $b['state'] : 'running';
        $at = (int) ($b['at'] ?? 0);
        if ($st !== 'running' && $at < $now - 86400) continue;          /* finished ones show for a day */
        if ($st === 'running' && $at < $now - 6 * 3600) $st = 'quiet';   /* no word for 6 hours: say so rather than show it running */
        $pct = isset($b['pct']) && is_numeric($b['pct']) ? max(0, min(100, (int) $b['pct'])) : null;
        $builds[] = ['id' => jvClean($b['id'] ?? '', 40), 'name' => jvClean($b['name'] ?? '', 90), 'state' => $st, 'pct' => $st === 'done' ? 100 : $pct,
            'step' => max(0, (int) ($b['step'] ?? 0)), 'steps' => max(0, (int) ($b['steps'] ?? 0)), 'note' => jvClean($b['note'] ?? '', 140), 'at' => $at];
    }
    /* calendar (18 Nov): only the Traverse inbox's own Google Calendar, which Matthew fills himself or asks for ("jarvis shouldnt show the
       dates from my emails in the calendar section"). No invitations from the inboxes. */
    return ['ok' => true, 'now' => $now, 'pushedAt' => $pushed, 'overnight' => $over, 'builds' => $builds,
        'calendar' => jvCalendar()];
}
/** the next 7 days of the Traverse inbox's primary calendar (any connected calendar if Traverse has none), cached 5 minutes. Read only. */
function jvCalendar(): array {
    $acc = null;
    foreach (jget('accounts.json') as $e => $a) if (is_array($a) && !empty($a['cal']) && !empty($a['refresh']) && ($a['on'] ?? true)) { if (!$acc || ($a['label'] ?? '') === 'Traverse') $acc = ['email' => (string) $e] + $a; }
    if (!$acc) return ['source' => 'none', 'need' => 'Connect the Traverse calendar to see it here.'];
    $email = (string) $acc['email']; $label = (string) ($acc['label'] ?? $email);
    $cf = aDataDir() . '/jarvis/cal-cache.json';
    $c = is_file($cf) ? json_decode((string) file_get_contents($cf), true) : null;
    if (is_array($c) && ($c['email'] ?? '') === $email && time() - (int) ($c['at'] ?? 0) < 300) return $c['out'];
    $tz = new DateTimeZone('America/Denver'); $from = new DateTime('today', $tz); $to = (clone $from)->modify('+7 days');
    $tok = gToken($email);
    if (!$tok) return ['source' => $label, 'error' => 'The ' . $label . ' calendar needs reconnecting.', 'events' => []];
    $r = http('GET', 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' . http_build_query(['timeMin' => $from->format(DATE_RFC3339), 'timeMax' => $to->format(DATE_RFC3339),
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

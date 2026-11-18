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
    /* calendar: the Assistant's Google sign-in has Gmail only (gmail.modify), no Calendar scope, so there is no calendar to read yet.
       Until then: the invitations and bookings the sorter filed as "calendar" in his inboxes. */
    $cal = [];
    foreach (jget('items.json') as $it) if (($it['status'] ?? 'open') === 'open' && ($it['category'] ?? '') === 'calendar')
        $cal[] = ['key' => $it['acct'] . ':' . $it['id'], 'acct' => $it['acct'], 'id' => (string) $it['id'], 'threadId' => (string) ($it['threadId'] ?? ''), 'draftId' => $it['draftId'] ?? null, 'subject' => (string) $it['subject'], 'from' => (string) $it['from'], 'date' => (int) $it['date'], 'summary' => (string) ($it['summary'] ?? '')];
    usort($cal, fn($a, $b) => $b['date'] <=> $a['date']);
    return ['ok' => true, 'now' => $now, 'pushedAt' => $pushed, 'overnight' => $over, 'builds' => $builds,
        'calendar' => ['source' => 'none', 'need' => 'Google Calendar (read only) is not part of the Assistant\'s Google sign-in yet.', 'emails' => array_slice($cal, 0, 6)]];
}

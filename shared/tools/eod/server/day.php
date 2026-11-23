<?php
declare(strict_types=1);
/* The daily Changes report's server reads (shared/tools/eod/daily.mjs --auto, 2026-11-23). READ ONLY: it opens files to read them; it writes
 * nothing, sends nothing, calls no outside service and changes no setting. Not installed on the server:
 *   bash ~/jarvis/bin/sg.sh trav 'php -- <day> <tomorrow>' < shared/tools/eod/server/day.php
 * Prints ONE JSON object. Each part is on its own: one that fails says why and the others still answer.
 *   calendar   tomorrow's events (start time and title only) from the Assistant's own calendar cache
 *              (assistant-private/data/jarvis/cal-cache.json: jvCalendar() writes it, the next 7 days of the Traverse inbox's primary
 *              calendar, refreshed at most every 5 minutes while the Assistant is in use). Never calls Google.
 *   team       what each person asked J.A.R.V.I.S. for that day, per app: the Sixfold field app's help desk (sixfold-data/rounds/help.log),
 *              the post calendar (post-calendar-data/jarvis/help.log), the Peak desk (peak-desk-data/jarvis/help.log). One entry per
 *              conversation a person wrote in that day: its first line that day (trimmed, emails and phone numbers taken out) and the
 *              conversation's status now. Matthew's own conversations and the test account are left out. */
if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Denver');
$day = (string) ($argv[1] ?? ''); $tom = (string) ($argv[2] ?? '');
if (!preg_match('/^\d{4}-\d\d-\d\d$/', $day) || !preg_match('/^\d{4}-\d\d-\d\d$/', $tom)) { echo json_encode(['ok' => false, 'error' => 'usage: php -- <day> <tomorrow>']), "\n"; exit(1); }
$S = getenv('HOME') . '/www/traverseplatforms.com';
$O = ['ok' => true, 'day' => $day, 'tomorrow' => $tom];
$part = function (string $k, callable $f) use (&$O) { try { $O[$k] = $f(); } catch (Throwable $e) { $O[$k] = ['error' => mb_substr($e->getMessage(), 0, 160)]; } };

/* calendar */
$cut = fn(string $s, int $n) => mb_strlen($s) > $n ? preg_replace('/\s+\S*$/u', '', mb_substr($s, 0, $n - 1)) . '…' : $s;
$part('calendar', function () use ($S, $tom, $cut) {
    $f = $S . '/assistant-private/data/jarvis/cal-cache.json'; if (!is_file($f)) return ['error' => 'the Assistant has no calendar cache yet (open J.A.R.V.I.S. once)'];
    $c = json_decode((string) file_get_contents($f), true); if (!is_array($c)) return ['error' => 'calendar cache unreadable'];
    $out = (array) ($c['out'] ?? []); $at = (int) ($c['at'] ?? 0);
    if (!empty($out['error'])) return ['error' => (string) $out['error']];
    if (($out['source'] ?? '') === 'none') return ['error' => 'no calendar connected to the Assistant'];
    $cacheDay = date('Y-m-d', $at); $covers = date('Y-m-d', strtotime($cacheDay . ' +6 days'));
    if ($covers < $tom) return ['error' => 'the Assistant\'s calendar cache is from ' . $cacheDay . ' and does not reach ' . $tom];
    $ev = [];
    foreach ((array) ($out['events'] ?? []) as $e) {
        $s = (string) ($e['start'] ?? ''); $en = (string) ($e['end'] ?? '');
        if (!empty($e['allDay'])) { if (!($s <= $tom && ($en === '' || $en > $tom))) continue; $ev[] = ['time' => 'all day', 'title' => $cut((string) ($e['title'] ?? ''), 140)]; continue; }
        if (substr($s, 0, 10) !== $tom) continue;
        $t = strtotime($s); $te = $en !== '' ? strtotime($en) : 0;
        $ev[] = ['time' => date('g:i a', $t) . ($te ? ' to ' . date('g:i a', $te) : ''), 'sort' => $t, 'title' => $cut((string) ($e['title'] ?? ''), 140)];
    }
    usort($ev, fn($a, $b) => ($a['sort'] ?? 0) <=> ($b['sort'] ?? 0)); foreach ($ev as &$x) unset($x['sort']); unset($x);
    return ['source' => (string) ($out['source'] ?? ''), 'cachedAt' => $at, 'events' => $ev];
});

/* team */
$part('team', function () use ($S, $day) {
    $tz = new DateTimeZone('America/Denver');
    $d1 = (new DateTime($day . ' 00:00', $tz))->modify('+1 day')->getTimestamp();
    $clean = function (string $s): string {
        $s = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email]', $s);
        $s = preg_replace('/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/', '[phone]', (string) $s);
        $s = trim((string) preg_replace('/\s+/', ' ', strtok(trim((string) $s), "\n") ?: ''));
        return mb_strlen($s) > 90 ? rtrim(mb_substr($s, 0, 88)) . '…' : $s;
    };
    $apps = ['sixfold' => ['Sixfold app help desk', $S . '/sixfold-data/rounds/help.log'], 'posts' => ['Post calendar', $S . '/post-calendar-data/jarvis/help.log'], 'peak' => ['Peak desk', $S . '/peak-desk-data/jarvis/help.log']];
    $o = [];
    foreach ($apps as $k => [$label, $f]) {
        if (!is_file($f)) { $o[$k] = ['label' => $label, 'people' => [], 'note' => 'no chats yet']; continue; }
        $T = []; $fh = fopen($f, 'r');
        while (($l = fgets($fh)) !== false) {
            $r = json_decode($l, true); if (!is_array($r)) continue;
            $id = (string) ($r['id'] ?? ''); $t = (string) ($r['t'] ?? ''); $at = (int) ($r['at'] ?? 0); if ($id === '') continue;
            $T[$id] ??= ['status' => 'new', 'first' => null];
            if ($t === 'msg') {
                $T[$id]['status'] = 'new';
                if ($at >= $d0 && $at < $d1 && $T[$id]['first'] === null) {
                    $tx = (string) ($r['text'] ?? '');
                    if (trim($tx) === '') $tx = !empty($r['audio']) ? '(a voice note)' : (!empty($r['photos']) ? '(a photo)' : '(no text)');
                    $T[$id]['first'] = ['by' => (string) ($r['from'] ?? ''), 'text' => $tx];
                }
            } elseif ($t === 'reply') $T[$id]['status'] = (string) ($r['status'] ?? 'answered');
            elseif ($t === 'status') $T[$id]['status'] = (string) ($r['status'] ?? $T[$id]['status']);
            elseif ($t === 'transcript' && $T[$id]['first'] && $T[$id]['first']['text'] === '(a voice note)' && !empty($r['text'])) $T[$id]['first']['text'] = (string) $r['text'];
        }
        fclose($fh);
        $P = [];
        foreach ($T as $x) {
            if (!$x['first']) continue; $by = trim($x['first']['by']);
            if ($by === '' || preg_match('/^(matthew|claude check)/i', $by)) continue;
            $P[$by][] = ['text' => $clean($x['first']['text']), 'status' => $x['status']];
        }
        $o[$k] = ['label' => $label, 'people' => $P];
    }
    return $o;
});

echo json_encode($O, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";

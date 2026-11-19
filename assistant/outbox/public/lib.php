<?php
declare(strict_types=1);
/* Outbox (2026-11-17, Matthew: "Can we make this peak email automatic url. attach to my hub. And can we build out the same thing for the
 * sixfold automated emails we do? and just attach it to the same url. call it something else not peak related"; which emails: "Any email
 * (and soon maybe text messages) that we automate"). One private page for every email his tools send by themselves, one section per
 * business, never mixed: Peak (Matthew's client work: the outreach sender, full controls), Sixfold (Brandon's company, run by Jen: READ
 * ONLY), Traverse (Matthew's own: READ ONLY), Texts (none automated yet). Not a page: opened directly this file answers 404.
 *
 * Where things are (live):
 *   public_html/outbox-092b0f/        index.php (the page), api.php, cli.php (command line only), lib.php (this)
 *   public_html/outbox-092b0f/peak/   the Peak outreach sender (source matthew/peak-pickleball-sponsorship/mail/public/) + site.php
 *   public_html/peak-mail-31dc56/     the old address: index.php forwards here; oauth.php, r.php, u.php, cron.php point at peak/
 *   outbox-data/ (0700, beside public_html, never in git)  code.hash, sessions.json, tries.json, settings.json
 * The Sixfold and Traverse sections only READ the senders' own logs and switch files; nothing here turns an email on or off or changes who
 * gets it. One exception (2026-11-18): the words of Sixfold's four customer emails, edited here and kept by the Sixfold app (obApp, rounds.php
 * a365words*), with opens and clicks read from its mail-sends.log and mail-events.log.
 * Tests: OUTBOX_NOW (a fixed clock), honoured only from the command line or PHP's own test server. */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const OB_PATH = '/outbox-092b0f';
const OB_ORIGIN = 'https://traverseplatforms.com';
const OB_REDIRECT_OLD = OB_ORIGIN . '/peak-mail-31dc56/oauth.php';   /* registered on the Entra app "Matthew outreach" */
const OB_REDIRECT_NEW = OB_ORIGIN . OB_PATH . '/peak/oauth.php';     /* works once Matthew adds it in Entra */
const OB_DAY = 86400;

function obTestOk(): bool { return PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server'; }
function obNow(): int { $e = obTestOk() ? (string) getenv('OUTBOX_NOW') : ''; return ctype_digit($e) ? (int) $e : time(); }
/** ~/www/traverseplatforms.com: the folder that holds public_html and every app's data */
function obRoot(): string { return dirname(__DIR__, 2); }
function obData(): string { return obRoot() . '/outbox-data'; }
function obReady(): bool { return is_dir(obData()); }
function obJ(string $f, $def) { $s = @file_get_contents(obData() . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function obW(string $f, $v): bool {
    $p = obData() . '/' . $f; $t = $p . '.tmp' . bin2hex(random_bytes(3)); $s = (string) json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (@file_put_contents($t, $s, LOCK_EX) !== strlen($s)) { @unlink($t); return false; }
    @chmod($t, 0600); return @rename($t, $p);
}
/** a JSON file somewhere under the site root (another app's), read only */
function obRead(string $rel, $def = null) { $s = @file_get_contents(obRoot() . '/' . $rel); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
/** the rows of a one-JSON-object-per-line log; $needle skips lines without it before decoding (the desk's log is a megabyte) */
function obLines(string $rel, string $needle = ''): array {
    $out = []; $fh = @fopen(obRoot() . '/' . $rel, 'r'); if (!$fh) return $out;
    while (($l = fgets($fh)) !== false) { if ($needle !== '' && !str_contains($l, $needle)) continue; $r = json_decode($l, true); if (is_array($r)) $out[] = $r; }
    fclose($fh); return $out;
}
function obTail(string $rel, int $n): array { $l = @file(obRoot() . '/' . $rel, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []; return array_slice($l, -$n); }
function obMtime(string $rel): int { return (int) @filemtime(obRoot() . '/' . $rel); }

/* ---------------------------------------------------------------- sign-in: one code, Matthew's, kept hashed */
function obCookie(): string { return 'outbox'; }
function obSignedIn(): bool {
    static $ok = null; if ($ok !== null) return $ok;
    $tok = (string) ($_COOKIE[obCookie()] ?? ''); if ($tok === '' || !obReady()) return $ok = false;
    $ses = obJ('sessions.json', []); $h = hash('sha256', $tok);
    if (!isset($ses[$h])) return $ok = false;
    if ((int) ($ses[$h]['last'] ?? 0) < obNow() - 365 * OB_DAY) return $ok = false;
    if ((int) $ses[$h]['last'] < obNow() - 3600) { $ses[$h]['last'] = obNow(); obW('sessions.json', $ses); }   /* a rolling year */
    return $ok = true;
}
function obSettings(): array { return obJ('settings.json', []) + ['peakReturn' => 'old']; }
function obPeakRedirect(): string { return obSettings()['peakReturn'] === 'outbox' ? OB_REDIRECT_NEW : OB_REDIRECT_OLD; }

/* ---------------------------------------------------------------- counting */
function obToday(): int { return (int) strtotime('today', obNow()); }
/** times -> today, last 7 days, last 30 days, the latest */
function obCount(array $times): array {
    $n = obNow(); $t0 = obToday(); $o = ['today' => 0, 'd7' => 0, 'd30' => 0, 'last' => 0];
    foreach ($times as $t) { $t = (int) $t; if ($t > $o['last']) $o['last'] = $t; if ($t >= $t0) $o['today']++; if ($t >= $n - 7 * OB_DAY) $o['d7']++; if ($t >= $n - 30 * OB_DAY) $o['d30']++; }
    return $o;
}
/** the last few failures, newest first, for the page: [{at, why}] */
function obFails(array $rows, int $max = 5): array {
    usort($rows, fn($a, $b) => (int) $b['at'] <=> (int) $a['at']);
    return array_map(fn($r) => ['at' => (int) $r['at'], 'why' => mb_substr((string) $r['why'], 0, 160)], array_slice($rows, 0, $max));
}
function obFailCounts(array $rows): array { $c = obCount(array_column($rows, 'at')); return ['failToday' => $c['today'], 'fail7' => $c['d7'], 'fail30' => $c['d30']]; }
/** one email on the page */
function obItem(array $a): array {
    return $a + ['on' => null, 'state' => '', 'switch' => '', 'today' => 0, 'd7' => 0, 'd30' => 0, 'last' => 0, 'opens' => 'not tracked', 'clicks' => 'not tracked',
        'fails' => [], 'failToday' => 0, 'fail7' => 0, 'fail30' => 0, 'skipped30' => 0, 'waiting' => 0, 'note' => '', 'attention' => []];
}
function obStageWords(string $s): string {
    return ['config' => 'the mailbox is not set up', 'connect' => 'could not reach the mail server', 'greeting' => 'the mail server did not answer', 'ehlo' => 'the mail server refused the greeting',
        'starttls' => 'secure connection failed', 'ehlo-tls' => 'secure connection failed', 'auth' => 'the mailbox password was refused', 'from' => 'the sender was refused', 'to' => 'the address was refused',
        'data' => 'the message was refused', 'noemail' => 'no email on file', 'unsub' => 'unsubscribed', 'unsubscribed' => 'unsubscribed'][$s] ?? ($s !== '' ? $s : 'did not send');
}

/* ================================================================ Sixfold (read only) */
const OB_SX = 'sixfold-data/rounds';
const OB_SXD = 'sixfold-data/digest';
/** the 365 mailbox: set up?, dry run?  Only these two facts are read; the password never is */
function obA365Box(): array {
    $c = obRead('sixfold-private/a365-mail.json', null);
    return ['set' => is_array($c) && !empty($c['user']) && array_key_exists('pass', $c) && (string) $c['pass'] !== '', 'dry' => is_array($c) && !empty($c['dryrun'])];
}
/** a Sixfold switch file: on && now >= from */
function obSxSwitch(string $f): array {
    $j = obRead(OB_SX . '/' . $f, null); if (!is_array($j)) return ['on' => false, 'text' => 'off (no ' . $f . ' yet)', 'from' => 0];
    $on = !empty($j['on']); $from = (int) ($j['from'] ?? 0);
    if (!$on) return ['on' => false, 'text' => 'off', 'from' => $from];
    if ($from > obNow()) return ['on' => false, 'text' => 'on from ' . date('M j, g:i a', $from), 'from' => $from];
    return ['on' => true, 'text' => 'on' . ($from ? ' since ' . date('M j', $from) : ''), 'from' => $from];
}
/** a365-mail.log, split by kind: sent times, failures, skipped */
function obA365Log(): array {
    $o = [];
    foreach (obLines(OB_SX . '/a365-mail.log') as $r) {
        $w = (string) ($r['what'] ?? ''); $k = str_starts_with($w, 'deposit reminder') ? 'deposit' : $w; $at = (int) ($r['at'] ?? 0);
        $o[$k] ??= ['sent' => [], 'fail' => [], 'skip' => []];
        $st = (string) ($r['stage'] ?? '');
        if (!empty($r['ok'])) $o[$k]['sent'][] = $at;
        elseif (in_array($st, ['noemail', 'unsub'], true)) $o[$k]['skip'][] = $at;
        else $o[$k]['fail'][] = ['at' => $at, 'why' => obStageWords($st) . (!empty($r['error']) && $st !== 'config' ? ' (' . mb_substr((string) $r['error'], 0, 80) . ')' : '')];
    }
    return $o;
}
function obSxFromLog(array $L, string $k, array $item): array {
    $x = $L[$k] ?? ['sent' => [], 'fail' => [], 'skip' => []];
    return obItem($item + obCount($x['sent']) + obFailCounts($x['fail']) + ['fails' => obFails($x['fail']), 'skipped30' => obCount($x['skip'])['d30']]);
}
/* ---- Sixfold's opens, clicks and words (2026-11-18, Matthew: "I think that we also need to track the analytics for the emails we send out for
   sixfold. And id also like to see the analytics under each option in the outbox app so that I can see whats working and make changes if needed
   in the outbox app"). The app keeps every counted customer send in mail-sends.log (id, kind, time, the words' version or the newsletter issue,
   the links by number) and m/index.php logs each open, click and mail-scanner visit in mail-events.log; both are read here, never written.
   Opens are rough (Apple Mail loads the image as the email arrives, so opens run high; some mail apps block images, so they run low); clicks are
   the number to trust. No customer is named: a send shows its day, its version and whether it was opened or clicked. */
const OB_SX_TRACKED = ['aftercare', 'followup', 'deposit', 'signed', 'newsletter'];
const OB_SX_EDITABLE = ['aftercare', 'followup', 'deposit', 'signed'];
/** what a link in a Sixfold email is, from its address only (the address itself is never shown: a form link carries the customer's own key) */
function obLinkWhat(string $u): string {
    $h = strtolower((string) parse_url($u, PHP_URL_HOST)); $p = (string) parse_url($u, PHP_URL_PATH);
    if (preg_match('/(^|\.)square\.(link|site)$|squareup\.com$/', $h)) return 'pay link (Square)';
    if (preg_match('/(^|\.)365aeration\.com$/', $h) && str_starts_with($p, '/sign')) return 'their form (sign or pay)';
    if (preg_match('/(^|\.)365aeration\.com$/', $h)) return 'the website';
    if (preg_match('/g\.page$|google\.[a-z.]+$|goo\.gl$/', $h)) return 'Google review';
    if (preg_match('/facebook\.com$/', $h)) return 'Facebook';
    if (preg_match('/instagram\.com$/', $h)) return 'Instagram';
    return $h !== '' ? $h : 'a link';
}
function obPct(int $a, int $b): ?float { return $b > 0 ? round(100 * $a / $b, 1) : null; }
/** per kind: sends, opens, clicks (30 days and all), each version's numbers, the links clicked, the last sends */
function obSxTrack(): array {
    $sends = []; $failed = [];
    foreach (obLines(OB_SX . '/mail-sends.log') as $r) {
        $t = (string) ($r['t'] ?? ''); $id = (string) ($r['id'] ?? ''); if ($id === '') continue;
        if ($t === 'send' && in_array((string) ($r['k'] ?? ''), OB_SX_TRACKED, true)) $sends[$id] = ['k' => (string) $r['k'], 'at' => (int) ($r['at'] ?? 0), 'v' => (string) ($r['v'] ?? 'v0'), 'links' => (array) ($r['links'] ?? [])];
        elseif ($t === 'fail') $failed[$id] = true;
    }
    foreach ($failed as $id => $_) unset($sends[$id]);
    $ev = [];
    foreach (obLines(OB_SX . '/mail-events.log') as $r) {
        $id = (string) ($r['id'] ?? ''); if (!isset($sends[$id])) continue; $t = (string) ($r['t'] ?? '');
        $ev[$id] ??= ['open' => 0, 'click' => 0, 'scan' => 0, 'firstOpen' => 0, 'links' => []];
        if ($t === 'open') { $ev[$id]['open']++; if (!$ev[$id]['firstOpen']) $ev[$id]['firstOpen'] = (int) ($r['at'] ?? 0); }
        elseif ($t === 'click') { $ev[$id]['click']++; $n = (int) ($r['n'] ?? -1); $ev[$id]['links'][$n] = ($ev[$id]['links'][$n] ?? 0) + 1; }
        elseif ($t === 'scan') $ev[$id]['scan']++;
    }
    $words = (array) (obRead(OB_SX . '/a365-words.json', [])['kinds'] ?? []); $nl = (array) (obRead(OB_SX . '/newsletter.json', [])['issues'] ?? []);
    $label = function (string $k, string $v) use ($words, $nl): string {
        if ($k === 'newsletter') { foreach ($nl as $is) if ((string) ($is['id'] ?? '') === $v) return '"' . mb_substr((string) ($is['subject'] ?? ''), 0, 60) . '"'; return 'issue ' . $v; }
        if ($v === 'v0') return 'Built-in words';
        foreach ((array) ($words[$k]['versions'] ?? []) as $x) if ((string) ($x['v'] ?? '') === $v) return 'Version ' . substr($v, 1) . ' (saved ' . date('M j', (int) ($x['at'] ?? 0)) . ((string) ($x['by'] ?? '') !== '' ? ' by ' . $x['by'] : '') . ')';
        return 'Version ' . substr($v, 1);
    };
    $n = obNow(); $out = [];
    foreach (OB_SX_TRACKED as $k) $out[$k] = ['since' => 0, 'sent7' => 0, 'sent30' => 0, 'opened30' => 0, 'clicked30' => 0, 'scans30' => 0, 'sentAll' => 0, 'openedAll' => 0, 'clickedAll' => 0,
        'active' => $k === 'newsletter' ? '' : (string) ($words[$k]['active'] ?? 'v0'), 'byVersion' => [], 'links30' => [], 'recent' => []];
    uasort($sends, fn($a, $b) => $a['at'] <=> $b['at']);
    foreach ($sends as $id => $s) {
        $o = &$out[$s['k']]; $e = $ev[$id] ?? ['open' => 0, 'click' => 0, 'scan' => 0, 'links' => []]; $op = $e['open'] > 0; $cl = $e['click'] > 0; $in30 = $s['at'] >= $n - 30 * OB_DAY;
        if (!$o['since']) $o['since'] = $s['at'];
        $o['sentAll']++; $o['openedAll'] += (int) $op; $o['clickedAll'] += (int) $cl;
        if ($s['at'] >= $n - 7 * OB_DAY) $o['sent7']++;
        if ($in30) { $o['sent30']++; $o['opened30'] += (int) $op; $o['clicked30'] += (int) $cl; $o['scans30'] += $e['scan'];
            foreach ($e['links'] as $ln => $c) { $w = obLinkWhat((string) ($s['links'][$ln] ?? '')); $o['links30'][$w] = ($o['links30'][$w] ?? 0) + $c; } }
        $o['byVersion'][$s['v']] ??= ['v' => $s['v'], 'label' => $label($s['k'], $s['v']), 'sent' => 0, 'opened' => 0, 'clicked' => 0, 'first' => $s['at'], 'last' => 0];
        $b = &$o['byVersion'][$s['v']]; $b['sent']++; $b['opened'] += (int) $op; $b['clicked'] += (int) $cl; $b['last'] = $s['at']; unset($b);
        $o['recent'][] = ['at' => $s['at'], 'v' => $label($s['k'], $s['v']), 'opened' => $op, 'clicked' => $cl];
        unset($o);
    }
    foreach ($out as $k => &$o) {
        $o['openRate30'] = obPct($o['opened30'], $o['sent30']); $o['clickRate30'] = obPct($o['clicked30'], $o['sent30']);
        $o['openRateAll'] = obPct($o['openedAll'], $o['sentAll']); $o['clickRateAll'] = obPct($o['clickedAll'], $o['sentAll']);
        foreach ($o['byVersion'] as &$b) { $b['openRate'] = obPct($b['opened'], $b['sent']); $b['clickRate'] = obPct($b['clicked'], $b['sent']); $b['active'] = $k !== 'newsletter' && $b['v'] === $o['active']; } unset($b);
        $o['byVersion'] = array_values(array_reverse($o['byVersion']));
        arsort($o['links30']); $o['links30'] = array_map(fn($w, $c) => ['what' => $w, 'clicks' => $c], array_keys($o['links30']), array_values($o['links30']));
        $o['recent'] = array_slice(array_reverse($o['recent']), 0, $k === 'newsletter' ? 5 : 10);
    }
    unset($o);
    return $out;
}
/** the Opens and Clicks lines on a card */
function obTrackWords(array $t, string $k): array {
    if (!$t['sentAll']) return ['not counted yet: counting started with the next one sent', 'not counted yet: counting started with the next one sent'];
    $since = ' since ' . date('M j', $t['since']);
    $op = $t['sent30'] ? $t['opened30'] . ' of ' . $t['sent30'] . ' opened in 30 days (' . $t['openRate30'] . '%)' : 'none sent in 30 days';
    $cl = $t['sent30'] ? $t['clicked30'] . ' of ' . $t['sent30'] . ' clicked in 30 days (' . $t['clickRate30'] . '%)' : 'none sent in 30 days';
    return [$op . '; ' . $t['openedAll'] . ' of ' . $t['sentAll'] . $since . '. May include Apple Mail\'s automatic opens, so read it as high.',
            $cl . '; ' . $t['clickedAll'] . ' of ' . $t['sentAll'] . $since . '.' . ($t['scans30'] ? ' ' . $t['scans30'] . ' mail-scanner ' . ($t['scans30'] === 1 ? 'visit' : 'visits') . ' left out.' : '')];
}
/** a call to the Sixfold app for the email words (server to server, with the key both read from the private folder): the answer, or ['ok' => false, 'error'] */
function obApp(string $action, ?array $body = null): array {
    $key = trim((string) @file_get_contents(obRoot() . '/sixfold-private/outbox-key.txt'));
    if (strlen($key) < 32) return ['ok' => false, 'error' => 'Outbox cannot reach the Sixfold app yet (its key is not on the server).'];
    $api = obTestOk() && getenv('OUTBOX_APP_API') ? (string) getenv('OUTBOX_APP_API') : OB_ORIGIN . '/api/rounds.php';   /* the env: the test copy only */
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'The server has no curl.'];
    $c = curl_init($api . '?action=' . rawurlencode($action));
    $h = ['X-Outbox-Key: ' . $key, 'Content-Type: application/json', 'User-Agent: Outbox'];
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_HTTPHEADER => $h]
        + ($body === null ? [] : [CURLOPT_POST => true, CURLOPT_POSTFIELDS => (string) json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]));
    $s = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
    $j = is_string($s) ? json_decode($s, true) : null;
    if (!is_array($j)) return ['ok' => false, 'error' => 'The Sixfold app did not answer (' . ($code ?: 'no connection') . '). Try again in a minute.'];
    return $j;
}
function obSixfold(): array {
    $box = obA365Box(); $L = obA365Log(); $items = [];
    $boxText = !$box['set'] ? 'the 365 mailbox is NOT set up, so nothing can send' : ($box['dry'] ? 'DRY RUN: the 365 mailbox only writes to a log, nothing really sends' : '');
    $e2 = obSxSwitch('emails2.json'); $fu = obSxSwitch('followup.json'); $dp = obSxSwitch('deprem.json');
    $fuJ = obRead(OB_SX . '/followup.json', []); $dpJ = obRead(OB_SX . '/deprem.json', []);

    $items[] = obSxFromLog($L, 'aftercare', ['id' => 'aftercare', 'name' => 'Aftercare email', 'what' => 'Lawn care tips after the job, with a pay link when a balance is owed.', 'who' => 'The customer',
        'trigger' => 'The moment a 365 job is marked Done (or paid, when a balance was owed).', 'on' => $box['set'] && !$box['dry'],
        'state' => $box['set'] ? ($box['dry'] ? 'dry run' : 'on (pay link at Done: ' . $e2['text'] . ')') : 'off',
        'switch' => 'No switch of its own: it goes whenever the 365 mailbox is set up (sixfold-private/a365-mail.json). emails2.json in sixfold-data/rounds turns on the pay link at Done and the logo header.']);
    $items[] = obSxFromLog($L, 'followup', ['id' => 'followup', 'name' => 'Two-day follow-up', 'what' => 'A plain note two days after the job: review link, 10% off the next service, the balance if any.', 'who' => 'The customer',
        'trigger' => 'Checked every 5 minutes, 9 am to 6 pm; due two days after the job is Done.', 'on' => $fu['on'] && $box['set'] && !$box['dry'],
        'state' => $fu['text'] . (!empty($fuJ['past']) ? ' (past customers once: yes)' : ''),
        'switch' => 'Field app: Admin > Follow-up email (sixfold-data/rounds/followup.json). Per job: Don\'t send. Also needs the 365 mailbox.']);
    $items[] = obSxFromLog($L, 'deposit', ['id' => 'deposit', 'name' => 'Deposit reminder', 'what' => 'One email 24 hours before the arrival time when the Square deposit link is still unpaid.', 'who' => 'The customer',
        'trigger' => 'Checked every 5 minutes, 8 am to 6 pm; only for forms sent 5 or more days before the job; Square is checked again first.', 'on' => $dp['on'] && $box['set'] && !$box['dry'],
        'state' => $dp['text'] . (!empty($dpJ['no']) ? ' (' . count((array) $dpJ['no']) . ' customers set to no reminder)' : ''),
        'switch' => 'Field app: Admin > Deposit reminders (sixfold-data/rounds/deprem.json). Per customer: no reminder.']);
    $items[] = obSxFromLog($L, 'signed', ['id' => 'signed', 'name' => 'Signed agreement copy', 'what' => 'A copy of the agreement the customer just signed on the website.', 'who' => 'The customer',
        'trigger' => 'When a customer signs the 365 form (also the office\'s "Email them the signed copy" button).', 'on' => $box['set'] && !$box['dry'], 'state' => $box['set'] ? ($box['dry'] ? 'dry run' : 'on') : 'off',
        'switch' => 'No switch: it goes whenever the 365 mailbox is set up (sixfold-private/a365-mail.json).']);

    /* the newsletter: one approved issue at a time; a sent log per issue */
    $nl = obRead(OB_SX . '/newsletter.json', []); $sent = []; $fail = []; $skip = []; $next = null; $sending = null; $lastIssue = null;
    foreach ((array) ($nl['issues'] ?? []) as $is) {
        $id = (string) ($is['id'] ?? ''); if ($id === '') continue;
        foreach (obLines(OB_SX . '/newsletter-sent-' . preg_replace('/[^a-z0-9]/', '', strtolower($id)) . '.log') as $r) {
            $at = (int) ($r['at'] ?? 0); $st = (string) ($r['stage'] ?? '');
            if (!empty($r['ok'])) $sent[] = $at; elseif ($st === 'unsubscribed') $skip[] = $at; else $fail[] = ['at' => $at, 'why' => '"' . mb_substr((string) ($is['subject'] ?? ''), 0, 50) . '": ' . obStageWords($st)];
        }
        $ap = $is['approved'] ?? null; $sd = $is['sent'] ?? null;
        if (is_array($sd) && !empty($sd['done'])) { if (!$lastIssue || (int) $sd['end'] > (int) $lastIssue['end']) $lastIssue = ['subject' => (string) $is['subject'], 'end' => (int) ($sd['end'] ?? 0), 'n' => (int) ($sd['ok'] ?? 0)]; continue; }
        if (is_array($sd) && !empty($sd['start'])) $sending = ['subject' => (string) $is['subject'], 'left' => count((array) ($sd['queue'] ?? [])), 'n' => (int) ($sd['ok'] ?? 0)];
        elseif (is_array($ap) && !empty($ap['for'])) if (!$next || (int) $ap['for'] < $next['for']) $next = ['subject' => (string) $is['subject'], 'for' => (int) $ap['for']];
    }
    $nlState = $sending ? 'sending now: "' . $sending['subject'] . '", ' . $sending['n'] . ' sent, ' . $sending['left'] . ' left'
        : ($next ? 'approved: "' . $next['subject'] . '" goes ' . date('D M j, g:i a', $next['for']) : 'off until an issue is approved');
    $items[] = obItem(['id' => 'newsletter', 'name' => 'Monthly newsletter', 'what' => 'The 1st-of-the-month lawn newsletter, with an unsubscribe link.', 'who' => 'Every customer and every lead with an email, minus unsubscribes',
        'trigger' => 'The 1st of the month at 9 am, only for an issue approved in the Newsletter screen.', 'on' => ($next || $sending) && $box['set'] && !$box['dry'], 'state' => $nlState,
        'switch' => 'Field app: Newsletter screen; each issue needs its own approval (sixfold-data/rounds/newsletter.json). Unsubscribes: newsletter-unsub.json.',
        'waiting' => $sending ? $sending['left'] : 0, 'note' => $lastIssue ? 'Last issue: "' . $lastIssue['subject'] . '" to ' . $lastIssue['n'] . ', ' . date('M j', $lastIssue['end']) . '. Unsubscribed so far: ' . count((array) obRead(OB_SX . '/newsletter-unsub.json', [])) . '.' : '']
        + obCount($sent) + obFailCounts($fail) + ['fails' => obFails($fail), 'skipped30' => obCount($skip)['d30']]);

    /* the website-form email to Contact@ (queued by the form, sent by the 5-minute push run) */
    $wl = obLines(OB_SX . '/weblead-mail.log'); $ws = []; $wf = [];
    foreach ($wl as $r) { if (!empty($r['ok'])) $ws[] = (int) $r['at']; else $wf[] = ['at' => (int) $r['at'], 'why' => obStageWords((string) ($r['stage'] ?? '')) . ' (tried again every 5 minutes)']; }
    $wq = count(@file(obRoot() . '/' . OB_SX . '/weblead-mail-queue.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []);
    $items[] = obItem(['id' => 'weblead', 'name' => 'New website form', 'what' => 'The details of each new 365 website form.', 'who' => 'Contact@SixfoldColorado.com (yours)',
        'trigger' => 'Within 5 minutes of someone sending the form on 365aeration.com.', 'on' => is_file(obRoot() . '/public_html/api/config.php'), 'state' => is_file(obRoot() . '/public_html/api/config.php') ? 'on' : 'off (no mail settings)',
        'switch' => 'No switch: always on while the website\'s mail settings are on the server (public_html/api/config.php).', 'waiting' => $wq]
        + obCount($ws) + obFailCounts($wf) + ['fails' => obFails($wf)]);

    /* the morning email, the end of day and the Saturday week (digest folder) */
    $dg = obLines(OB_SXD . '/digest.log'); $ds = []; $df = [];
    foreach ($dg as $r) { if (!empty($r['ok'])) $ds[] = (int) $r['at']; else $df[] = ['at' => (int) $r['at'], 'why' => obStageWords((string) ($r['stage'] ?? ''))]; }
    $items[] = obItem(['id' => 'morning', 'name' => 'Morning email', 'what' => 'Leads to call and walks for the day.', 'who' => 'Contact@SixfoldColorado.com (yours)',
        'trigger' => 'Every day, the first hourly run after 6 am.', 'on' => true, 'state' => 'on', 'switch' => 'No switch: the hourly cron (sixfold-tools/morning-email.php) sends it. Marker: sixfold-data/digest/last-sent.txt.',
        'note' => 'A failed morning email is tried again every hour until it goes, so one bad day can count up to 18 failures.']
        + obCount($ds) + obFailCounts($df) + ['fails' => obFails($df)]);
    $eod = ['day' => [[], []], 'week' => [[], []]]; $tests = 0;
    foreach (obLines(OB_SXD . '/eod.log') as $r) {
        $s = (string) ($r['subject'] ?? ''); if (str_starts_with($s, 'TEST')) { $tests++; continue; }
        $k = str_starts_with($s, 'The week') ? 'week' : 'day';
        if (!empty($r['ok'])) $eod[$k][0][] = (int) $r['at']; else $eod[$k][1][] = ['at' => (int) $r['at'], 'why' => obStageWords((string) ($r['stage'] ?? ''))];
    }
    $items[] = obItem(['id' => 'eod', 'name' => 'End-of-day report', 'what' => 'The day in one picture: jobs, money in, quotes, the six weeks ahead. Counted per copy (one per person).', 'who' => 'Brandon, Jen and you (Contact@)',
        'trigger' => 'Every day, the first hourly run after 8 pm.', 'on' => true, 'state' => 'on', 'switch' => 'No switch: the hourly cron runs sixfold-tools/eod-report.php; who gets it is set inside eod-report.php. Marker: sixfold-data/digest/eod-last-sent.txt.',
        'note' => $tests ? $tests . ' test copies are left out of the counts.' : ''] + obCount($eod['day'][0]) + obFailCounts($eod['day'][1]) + ['fails' => obFails($eod['day'][1])]);
    $items[] = obItem(['id' => 'week', 'name' => 'Saturday weekly report', 'what' => 'The same report for Monday to Saturday. Counted per copy.', 'who' => 'Brandon, Jen and you (Contact@)',
        'trigger' => 'Saturdays, right after the end-of-day report.', 'on' => true, 'state' => 'on', 'switch' => 'No switch: eod-report.php --week, started by the Saturday end-of-day run. Marker: sixfold-data/digest/eod-week-last-sent.txt.']
        + obCount($eod['week'][0]) + obFailCounts($eod['week'][1]) + ['fails' => obFails($eod['week'][1])]);

    /* the monthly profit email: sent from the laptop's overnight check; only a marker on the server */
    $pm = trim((string) @file_get_contents(obRoot() . '/' . OB_SXD . '/profit-monthly.txt')); $pt = $pm !== '' ? obMtime(OB_SXD . '/profit-monthly.txt') : 0;
    $items[] = obItem(['id' => 'profit', 'name' => 'Monthly profit email', 'what' => 'Last month\'s Sixfold profit and your 5% (from November 2026).', 'who' => 'You (Contact@SixfoldColorado.com)',
        'trigger' => 'Once after each month ends, by the laptop\'s overnight check.', 'on' => true, 'state' => 'on (runs from the laptop, not the server)',
        'switch' => 'The laptop\'s overnight check (shared/tools/overnight-check.sh) runs sixfold-tools/profit-check.php --monthly. Marker: sixfold-data/digest/profit-monthly.txt.',
        'note' => $pm !== '' ? 'Last one was for ' . date('F Y', (int) strtotime($pm . '-01')) . '. There is no send log on the server, so failures show only in the laptop\'s overnight log.' : 'None sent yet.']
        + obCount($pt ? [$pt] : []));

    /* opens, clicks, versions and the last sends under each customer email (2026-11-18) */
    $TR = obSxTrack();
    foreach ($items as &$it) if (isset($TR[$it['id']])) { [$it['opens'], $it['clicks']] = obTrackWords($TR[$it['id']], $it['id']); $it['track'] = $TR[$it['id']]; $it['editable'] = in_array($it['id'], OB_SX_EDITABLE, true); }
    unset($it);
    foreach ($items as &$it) {
        if ($boxText !== '' && in_array($it['id'], ['aftercare', 'followup', 'deposit', 'signed', 'newsletter'], true)) $it['attention'][] = ['bad', 'Sixfold ' . $it['name'] . ': ' . $boxText . '.'];
        if ($it['fail7']) $it['attention'][] = ['bad', 'Sixfold ' . $it['name'] . ': ' . $it['fail7'] . ' failed in the last 7 days.'];
    }
    unset($it);
    $h = (int) date('G', obNow()); $todayS = date('Y-m-d', obNow());
    $marker = fn(string $f) => trim((string) @file_get_contents(obRoot() . '/' . OB_SXD . '/' . $f));
    $att = [];
    if ($h >= 8 && $marker('last-sent.txt') !== $todayS) $att[] = ['bad', 'Sixfold morning email has not gone out today.'];
    if ($h >= 22 && $marker('eod-last-sent.txt') !== $todayS) $att[] = ['bad', 'Sixfold end-of-day report has not gone out tonight.'];
    $old = 0; foreach ((@file(obRoot() . '/' . OB_SX . '/weblead-mail-queue.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) as $l) { $q = json_decode($l, true); if ((int) ($q['at'] ?? 0) < obNow() - 3600) $old++; }
    if ($old) $att[] = ['bad', 'Sixfold: ' . $old . ' website-form emails have waited more than an hour.'];
    return ['items' => $items, 'attention' => $att, 'mailbox' => $box + ['text' => $boxText]];
}

/* ================================================================ Traverse (read only) */
const OB_DESK = 'traverse-prospects-data';
const OB_HOLD_FOREVER = 4102444800;   /* 1 Jan 2100: the desk's "held" value */
const OB_BOUNCE_WARN = 0.05;           /* a desk bounce rate over 5% of the last 30 days' sends (20 or more) is flagged */
function obDesk(): array {
    $sent = []; $fail = []; $bounce = []; $click = []; $unsub = []; $skip = []; $addr = ''; $cap = 40;
    /* clicks by style (2026-11-18): since then every link in every desk email is tracked (traverseplatforms.com/go/), and the sent and
       click rows carry the style; rows from before have none, and their clicks came only from the picture emails' links */
    $by = []; $d30 = obNow() - 30 * OB_DAY; $scan30 = 0;
    foreach (obLines(OB_DESK . '/events.log', '"t":"') as $r) {
        $t = (string) ($r['t'] ?? ''); $at = (int) ($r['at'] ?? 0);
        if (($t === 'sent' || $t === 'click') && $at >= $d30) { $k = (string) ($t === 'sent' ? ($r['style'] ?? '') : ($r['s'] ?? '')); $by[$k] ??= ['sent' => 0, 'clicks' => 0, 'people' => []]; if ($t === 'sent') $by[$k]['sent']++; else { $by[$k]['clicks']++; $by[$k]['people'][(string) ($r['id'] ?? '')] = 1; } }
        if ($t === 'scan' && $at >= $d30) $scan30++;
        switch ($t) {
            case 'sent': $sent[] = $at; break;
            case 'sendfail': $fail[] = ['at' => $at, 'why' => obStageWords((string) ($r['stage'] ?? '')) . (!empty($r['error']) ? ' (' . mb_substr((string) $r['error'], 0, 80) . ')' : '')]; break;
            case 'bounce': case 'mailbad': $bounce[] = $at; break;
            case 'click': $click[] = $at; break;
            case 'unsub': $unsub[] = $at; break;
            case 'skipped': $skip[] = $at; break;
            case 'settings': $s = (array) ($r['s'] ?? []); if (array_key_exists('address', $s)) $addr = trim((string) $s['address']); if (isset($s['cap'])) $cap = (int) $s['cap']; break;
        }
    }
    $q = obRead(OB_DESK . '/queue.json', []); $q = is_array($q) ? $q : []; $due = 0; foreach ($q as $m) if ((int) ($m['after'] ?? 0) <= obNow()) $due++;
    $ha = trim((string) @file_get_contents(obRoot() . '/' . OB_DESK . '/send-after.txt')); $held = ctype_digit($ha) && (int) $ha > obNow();
    $state = $held ? ((int) $ha >= OB_HOLD_FOREVER ? 'held: nothing sends until you lift the hold' : 'held until ' . date('M j, g:i a', (int) $ha))
        : ($addr === '' ? 'off: no postal address in Settings' : (!$q ? 'on, nothing waiting' : 'sending: ' . count($q) . ' waiting, ' . $due . ' due now'));
    $c = obCount($sent); $b = obCount($bounce); $u = obCount($unsub); $k = obCount($click);
    $it = obItem(['id' => 'desk', 'name' => 'Prospect Desk emails', 'what' => 'Your one-to-one emails to prospect companies (roofing, lawn and the other trades), in hourly batches.', 'who' => 'Prospect companies on the desk',
        'trigger' => 'Only what you Queue on the desk; the hourly run sends 15 an hour, at most ' . max(1, min(360, $cap)) . ' a day, 2 minutes apart.', 'on' => !$held && $addr !== '' && $q !== [], 'state' => $state,
        'switch' => 'Prospects desk: Queue and Clear. Hold: traverse-prospects-data/send-after.txt (a time in the future holds everything). Postal address and daily cap: desk Settings.',
        'waiting' => count($q), 'opens' => 'not tracked (no pixel)', 'clicks' => obDeskClicks($k['d30'], $by, $scan30),
        'note' => 'Last 30 days: ' . $b['d30'] . ' bounced, ' . $u['d30'] . ' unsubscribed, ' . obCount($skip)['d30'] . ' skipped by the desk\'s rules. Replies are not counted here (they are in your Traverse inbox). Last runs: ' . implode(' / ', obTail(OB_DESK . '/send.log', 2)) . '.']
        + $c + obFailCounts($fail) + ['fails' => obFails($fail)]);
    $it['bounce30'] = $b['d30']; $it['unsub30'] = $u['d30']; $it['click30'] = $k['d30']; $it['scan30'] = $scan30;
    $it['clicksByStyle'] = array_map(fn($k, $g) => ['style' => $k === '' ? 'earlier' : $k, 'sent30' => $g['sent'], 'clicks30' => $g['clicks'], 'people30' => count($g['people'])], array_keys($by), array_values($by));
    if ($c['d30'] >= 20 && $b['d30'] / $c['d30'] > OB_BOUNCE_WARN) $it['attention'][] = ['bad', 'Prospect Desk bounces: ' . $b['d30'] . ' of ' . $c['d30'] . ' sent in 30 days (' . round(100 * $b['d30'] / $c['d30'], 1) . '%, over 5%).'];
    if ($it['fail7']) $it['attention'][] = ['bad', 'Prospect Desk: ' . $it['fail7'] . ' could not send in the last 7 days.'];
    if ($q && $held) $it['attention'][] = ['info', 'Prospect Desk: ' . count($q) . ' emails are waiting behind the hold.'];
    return $it;
}
/** the card's Clicks line: the total, then each style's companies who clicked of those sent (30 days), then scanners left out */
function obDeskClicks(int $total, array $by, int $scans): string {
    $W = ['plain' => 'plain', 'map' => 'with map', 'phone' => 'app: phone', 'computer' => 'app: computer', 'both' => 'app: phone + computer', '' => 'before 18 Nov (only picture links tracked)'];
    $parts = [];
    foreach ($W as $k => $w) if (isset($by[$k])) { $g = $by[$k]; $p = count($g['people']);
        $parts[] = $w . ': ' . $p . ($p === 1 ? ' company' : ' companies') . ' clicked of ' . $g['sent'] . ' sent' . ($k !== '' && $g['sent'] ? ' (' . round(100 * $p / $g['sent'], 1) . '%)' : ''); }
    return $total . ' in 30 days' . ($parts ? ' (' . implode('; ', $parts) . ')' : '') . '; ' . $scans . ' mail-scanner ' . ($scans === 1 ? 'hit' : 'hits') . ' left out. Every link is tracked since 18 Nov, plain emails too.';
}
/** the edition installs (Traverse's apps for client companies): their data folders */
function obInstalls(): array {
    $o = ['traverse-data' => 'Roofing', 'traverse-yards-data' => 'Lawn and yards', 'traverse-solar-data' => 'Solar', 'traverse-pest-data' => 'Pest', 'traverse-security-data' => 'Security'];
    foreach (glob(obRoot() . '/c-*-data', GLOB_ONLYDIR) ?: [] as $d) $o[basename($d)] = 'client install ' . preg_replace('/^c-|-data$/', '', basename($d));
    return array_filter($o, fn($k) => is_dir(obRoot() . '/' . $k), ARRAY_FILTER_USE_KEY);
}
function obTraverse(): array {
    $items = [obDesk()];
    $cfg = @include obRoot() . '/traverse-site-private/site-config.php';   /* only "is a mailbox password set" is read from it */
    $mailOk = is_array($cfg) && !empty($cfg['smtp']['pass']); unset($cfg);

    /* website demo bookings */
    $bk = ['notify' => [[], []], 'confirm' => [[], []]];
    foreach (obLines('traverse-site-private/mail.log') as $r) {
        $w = (string) ($r['what'] ?? ''); $k = str_starts_with($w, 'book-confirm') ? 'confirm' : 'notify';   /* book-notify, cancel, manage-cancel, linkhelp go to Matthew */
        if (!empty($r['ok'])) $bk[$k][0][] = (int) $r['at']; else $bk[$k][1][] = ['at' => (int) $r['at'], 'why' => strtok($w, ' ') . ': ' . obStageWords((string) ($r['stage'] ?? ''))];
    }
    $sw = 'No switch: on while Traverse\'s mailbox password is in traverse-site-private/site-config.php. Days and hours: the demo page\'s settings.';
    $items[] = obItem(['id' => 'demo-confirm', 'name' => 'Demo booking confirmation', 'what' => 'The time, a calendar invite and a cancel link.', 'who' => 'Whoever books a demo on traverseplatforms.com/demo',
        'trigger' => 'The moment a demo is booked.', 'on' => $mailOk, 'state' => $mailOk ? 'on' : 'off (no mailbox password)', 'switch' => $sw] + obCount($bk['confirm'][0]) + obFailCounts($bk['confirm'][1]) + ['fails' => obFails($bk['confirm'][1])]);
    $items[] = obItem(['id' => 'demo-notify', 'name' => 'Demo booked / cancelled / app-link request', 'what' => 'A note to you for each booking, cancellation and "send me my app link" request.', 'who' => 'You (m.sharpe@traverseplatforms.com)',
        'trigger' => 'Each booking, cancel or request on the website.', 'on' => $mailOk, 'state' => $mailOk ? 'on' : 'off (no mailbox password)', 'switch' => $sw] + obCount($bk['notify'][0]) + obFailCounts($bk['notify'][1]) + ['fails' => obFails($bk['notify'][1])]);

    /* sign-up and setup mail (clients.log 'mail' rows): to the buyer, or a "Traverse: ..." note to Matthew */
    $su = ['cust' => [[], []], 'you' => [[], []]];
    foreach (obLines('traverse-shared/clients/clients.log', '"mail"') as $r) {
        if (($r['what'] ?? '') !== 'mail') continue; $s = (string) ($r['subject'] ?? ''); $k = str_starts_with($s, 'Traverse:') ? 'you' : 'cust';
        if (!empty($r['ok'])) $su[$k][0][] = (int) $r['at']; else $su[$k][1][] = ['at' => (int) $r['at'], 'why' => '"' . mb_substr($s, 0, 50) . '": ' . obStageWords((string) ($r['stage'] ?? ''))];
    }
    foreach (obLines('traverse-shared/clients/findapp.log', '"sent"') as $r) if (!empty($r['sent'])) $su['cust'][0][] = (int) ($r['at'] ?? 0);
    $bill = is_file(obRoot() . '/traverse-shared/clients/billing-config.php');
    $items[] = obItem(['id' => 'signup', 'name' => 'Sign-up and setup emails', 'what' => '"Finish setting up your Traverse", "Your Traverse is ready", up to 3 "is waiting for you" reminders, and "Your Traverse sign-in link" from the Find my app page.',
        'who' => 'New paying companies (their admin)', 'trigger' => 'Stripe checkout, the setup page, a daily 4 am reminder run, and Find my app.', 'on' => $bill && $mailOk,
        'state' => !$bill ? 'off (sign-up is closed: no billing settings)' : ($mailOk ? 'on' : 'off (no mailbox password)'),
        'switch' => 'Sign-up opens with traverse-shared/clients/billing-config.php; the reminders run from sixfold-tools/morning-email.php at 4 am (clients.php relink). Log: traverse-shared/clients/clients.log.']
        + obCount($su['cust'][0]) + obFailCounts($su['cust'][1]) + ['fails' => obFails($su['cust'][1])]);

    /* notes to Matthew: sign-ups, billing problems in the editions, the daily trial sweep */
    $nt = $su['you'][0]; $nf = $su['you'][1];
    foreach (obInstalls() as $dir => $label) foreach (obLines($dir . '/rounds/billing.log', '"mailed"') as $r) {
        if (!array_key_exists('mailed', $r)) continue; $m = $r['mailed'];
        if ($m === true || (is_array($m) && !empty($m['ok']))) $nt[] = (int) $r['at']; elseif ($m === false || is_array($m)) $nf[] = ['at' => (int) $r['at'], 'why' => $label . ' "' . ($r['what'] ?? '') . '" note: ' . obStageWords((string) ($r['stage'] ?? ''))];
    }
    foreach (obTail('sixfold-data/digest/setup-trial-sweep.log', 400) as $l) if (preg_match('/^(\d{4}-\d\d-\d\d \d\d:\d\d) (\S+): (\{.*\})$/', $l, $m)) {
        $j = json_decode($m[3], true); if (!is_array($j) || !array_key_exists('mailed', $j) || ($j['did'] ?? '') === '') continue;
        $t = (int) strtotime($m[1]); if (!empty($j['mailed'])) $nt[] = $t; else $nf[] = ['at' => $t, 'why' => $m[2] . ': the trial-sweep note did not send'];
    }
    $items[] = obItem(['id' => 'notes', 'name' => 'Sign-up and billing notes to you', 'what' => '"Traverse: new paid company", "new client live", "is over its seats", "is locked", "sign-up cancelled" and the other notes about client accounts.',
        'who' => 'You (m.sharpe@traverseplatforms.com)', 'trigger' => 'When the event happens; the trial sweep runs daily at 4 am.', 'on' => $mailOk, 'state' => $mailOk ? 'on' : 'off (no mailbox password)',
        'switch' => 'No switch. Logs: traverse-shared/clients/clients.log, each edition\'s rounds/billing.log, sixfold-data/digest/setup-trial-sweep.log.']
        + obCount($nt) + obFailCounts($nf) + ['fails' => obFails($nf)]);

    /* the client apps' own automatic emails, which go out in the client company's name: end-of-day reports and customer care mail */
    $es = []; $ef = []; $eon = []; $cs = []; $cf = []; $con = [];
    foreach (obInstalls() as $dir => $label) {
        $e = obRead($dir . '/rounds/eod-report.json', null); if (is_array($e) && !empty($e['on'])) $eon[] = $label;
        foreach (obLines($dir . '/rounds/eod.log', '"send"') as $r) if (($r['what'] ?? '') === 'send') { if (!empty($r['ok'])) $es[] = (int) $r['at']; else $ef[] = ['at' => (int) $r['at'], 'why' => $label . ': ' . obStageWords((string) ($r['stage'] ?? ''))]; }
        $c = obRead($dir . '/rounds/care-cfg.json', null); if (is_array($c)) foreach (['fu' => 'follow-up', 'ac' => 'aftercare'] as $k => $w) if (!empty($c[$k]['on'])) $con[] = $label . ' ' . $w;
        foreach (obLines($dir . '/rounds/care-mail.log') as $r) { if (!empty($r['test'])) continue; if (!empty($r['ok'])) $cs[] = (int) $r['at']; else $cf[] = ['at' => (int) $r['at'], 'why' => $label . ' ' . ($r['kind'] ?? '') . ': ' . obStageWords((string) ($r['stage'] ?? ''))]; }
    }
    $items[] = obItem(['id' => 'client-eod', 'name' => 'Client apps: end-of-day reports', 'what' => 'The end-of-day email a client company can turn on for its own people.', 'who' => 'The people each client company picks',
        'trigger' => 'Hourly check; at the hour the client chose.', 'on' => (bool) $eon, 'state' => $eon ? 'on for: ' . implode(', ', $eon) : 'off in every client app',
        'switch' => 'Each client app: Setup > End-of-day email (<install>/rounds/eod-report.json). The client company decides.'] + obCount($es) + obFailCounts($ef) + ['fails' => obFails($ef)]);
    $items[] = obItem(['id' => 'client-care', 'name' => 'Client apps: customer care emails', 'what' => 'Follow-up, aftercare and newsletter emails a client company sends its customers from its own mailbox.', 'who' => 'The client companies\' customers',
        'trigger' => 'Hourly care run (sixfold-tools/care-sweep.php).', 'on' => (bool) $con, 'state' => $con ? 'on: ' . implode(', ', $con) : 'off in every client app',
        'switch' => 'Each client app: its care settings (<install>/rounds/care-cfg.json). The client company decides.'] + obCount($cs) + obFailCounts($cf) + ['fails' => obFails($cf)]);

    /* the post calendar's failure alert */
    $ps = []; $pf = [];
    foreach (obLines('post-calendar-data/events.log', 'Matthew') as $r) {
        $w = (string) ($r['what'] ?? ''); if (str_starts_with($w, 'Emailed Matthew')) $ps[] = (int) $r['at']; elseif (str_starts_with($w, 'Could not email Matthew')) $pf[] = ['at' => (int) $r['at'], 'why' => $w];
    }
    $items[] = obItem(['id' => 'posts', 'name' => 'Post calendar: failed-post alert', 'what' => 'Tells you when a scheduled Facebook or Instagram post could not go out.', 'who' => 'You (m.sharpe@traverseplatforms.com)',
        'trigger' => 'The 5-minute post runner, when a post fails.', 'on' => $mailOk, 'state' => $mailOk ? 'on' : 'off (no mailbox password)', 'switch' => 'No switch. Log: post-calendar-data/events.log.']
        + obCount($ps) + obFailCounts($pf) + ['fails' => obFails($pf)]);

    $att = [];
    if (!$mailOk) $att[] = ['bad', 'Traverse\'s mailbox password is missing: website, sign-up and alert emails cannot send.'];
    foreach ($items as &$it) if ($it['id'] !== 'desk' && $it['fail7']) $it['attention'][] = ['bad', 'Traverse ' . $it['name'] . ': ' . $it['fail7'] . ' failed in the last 7 days.'];
    unset($it);
    return ['items' => $items, 'attention' => $att, 'bounceScan' => obTail(OB_DESK . '/bounce-scan.log', 1)[0] ?? ''];
}

/* ================================================================ Peak (the full controls are the Peak page inside Outbox) */
function obPeak(): array {
    require_once __DIR__ . '/peak/lib.php';
    if (!pmReady()) return ['ready' => false, 'attention' => [['bad', 'Peak email: the data folder is missing on the server.']], 'items' => []];
    $S = pmState(); $c = pmConn(); $st = pmStats($S); $sent = []; $fail = []; $bounce = []; $click = []; $unsub = []; $reply = [];
    foreach (pmRows() as $r) {
        $at = (int) ($r['at'] ?? 0);
        switch ((string) ($r['t'] ?? '')) {
            case 'sent': $sent[] = $at; break; case 'fail': $fail[] = ['at' => $at, 'why' => (string) ($r['why'] ?? 'could not send')]; break;
            case 'bounce': $bounce[] = $at; break; case 'click': $click[] = $at; break; case 'unsub': $unsub[] = $at; break; case 'reply': $reply[] = $at; break;
        }
    }
    $att = []; $items = []; $waiting = 0; $waitingPaused = 0;
    if (!$c['app']) $att[] = ['bad', 'Peak email: the Microsoft app keys are missing.'];
    elseif ($c['connected']) {}
    elseif (($c['status'] ?? '') === 'reconnect') $att[] = ['bad', 'Peak email: the Microsoft sign-in for ' . $c['email'] . ' stopped working. Reconnect it in the Peak section.'];
    else $att[] = ['bad', 'Peak email: Microsoft is not connected yet (Connect Microsoft in the Peak section; Peak\'s admin may need to approve the app).'];
    foreach (PM_LISTS as $k => $nm) {
        $L = $st[$k] + ['status' => $S['lists'][$k]['status']]; $pn = 'Peak email, ' . $nm . ' list';
        $draft = pmIsDraft($S['templates'][$k]);
        if ($L['status'] === 'running') $waiting += (int) $L['queued']; else $waitingPaused += (int) $L['queued'];
        $why = (string) ($L['pausedWhy'] ?? '');
        if ($L['status'] === 'paused') $att[] = [$why !== '' && !str_starts_with($why, 'the email changed') ? 'bad' : 'info', $pn . ': paused' . ($why !== '' ? ' (' . $why . ')' : ($S['lists'][$k]['started'] ? '' : ', not started yet')) . ($draft ? '; the email is still a DRAFT' : '') . '.'];
        if ((int) $L['sent'] >= 20 && (int) $L['bounced'] / max(1, (int) $L['sent']) > 0.08) $att[] = ['bad', $pn . ': bounces over 8% (' . $L['bounced'] . ' of ' . $L['sent'] . ').'];
        $items[] = ['id' => $k, 'name' => $nm, 'status' => $L['status'], 'draft' => $draft, 'queued' => (int) $L['queued'], 'sent' => (int) $L['sent'], 'replied' => (int) $L['replied'], 'bounced' => (int) $L['bounced'],
            'unsubscribed' => (int) $L['unsubscribed'], 'clicked' => (int) $L['clicked'], 'failed' => (int) $L['failed'], 'pausedWhy' => $why,
            /* 2026-11-18: list size, opens, bookings, rates, and who the Peak desk link leaves out */
            'people' => (int) $L['people'], 'orgs' => (int) ($L['orgs'] ?? 0), 'opened' => (int) ($L['opened'] ?? 0), 'booked' => (int) ($L['booked'] ?? 0), 'rates' => (array) ($L['rates'] ?? []), 'skips' => (array) ($L['skips'] ?? [])];
        if (!empty($L['deskError'])) $att[] = ['bad', $pn . ': ' . $L['deskError']];
    }
    $dp = (int) ($st['sponsors']['deskPending'] ?? 0);
    if ($dp) $att[] = ['bad', 'Peak email: ' . $dp . ' updates have not reached the Peak desk yet (the next hourly run tries again).'];
    $dns = pmJ('dns.json', null); if (is_array($dns) && !empty($dns['fix'])) $att[] = ['info', 'Peak email: ' . (string) $dns['fix'][0]];
    $f = obFailCounts($fail);
    if ($f['fail7']) $att[] = ['bad', 'Peak email: ' . $f['fail7'] . ' could not send in the last 7 days.'];
    return ['ready' => true, 'conn' => ['connected' => (bool) $c['connected'], 'email' => (string) ($c['email'] ?? ''), 'status' => (string) ($c['status'] ?? '')], 'lists' => $items,
        'window' => pmWindowText($S['settings']), 'rate' => (int) $S['settings']['rate'], 'waiting' => $waiting, 'waitingPaused' => $waitingPaused,
        'clicks30' => obCount($click)['d30'], 'bounces30' => obCount($bounce)['d30'], 'unsubs30' => obCount($unsub)['d30'], 'replies30' => obCount($reply)['d30'],
        'fails' => obFails($fail), 'attention' => $att, 'lastRun' => (string) (array_slice(@file(pmData() . '/run.log', FILE_IGNORE_NEW_LINES) ?: [], -1)[0] ?? ''),
        'redirect' => ['now' => obPeakRedirect(), 'old' => OB_REDIRECT_OLD, 'new' => OB_REDIRECT_NEW, 'choice' => obSettings()['peakReturn']]] + obCount($sent) + $f;
}

/* ================================================================ the whole page */
function obView(): array {
    $P = obPeak(); $X = obSixfold(); $T = obTraverse();
    $att = $P['attention']; foreach ([$X, $T] as $B) { $att = array_merge($att, $B['attention']); foreach ($B['items'] as $it) $att = array_merge($att, $it['attention']); }
    usort($att, fn($a, $b) => ($a[0] === 'bad' ? 0 : 1) <=> ($b[0] === 'bad' ? 0 : 1));
    $sum = fn(array $items, string $k) => array_sum(array_map(fn($i) => (int) ($i[$k] ?? 0), $items));
    $today = ['peak' => (int) ($P['today'] ?? 0), 'sixfold' => $sum($X['items'], 'today'), 'traverse' => $sum($T['items'], 'today')];
    $failed = ['peak' => (int) ($P['failToday'] ?? 0), 'sixfold' => $sum($X['items'], 'failToday'), 'traverse' => $sum($T['items'], 'failToday')];
    $wait = ['peak' => (int) ($P['waiting'] ?? 0), 'sixfold' => $sum($X['items'], 'waiting'), 'traverse' => $sum($T['items'], 'waiting')];
    return ['ok' => true, 'now' => obNow(), 'summary' => ['sent' => $today, 'waiting' => $wait, 'waitingPaused' => (int) ($P['waitingPaused'] ?? 0), 'failed' => $failed,
        'attention' => array_map(fn($a) => ['level' => $a[0], 'text' => $a[1]], $att)], 'peak' => $P, 'sixfold' => $X, 'traverse' => $T,
        'texts' => ['note' => 'No text messages are sent automatically yet. Texting is off in the Sixfold app, and where it exists it is one text at a time, typed by a person. When a tool starts texting on its own it gets a section here.']];
}

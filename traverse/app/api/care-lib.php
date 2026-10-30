<?php
declare(strict_types=1);
/* ==== PLANS AND CUSTOMER EMAILS for the editions and client installs (2026-10-30, Matthew: "RECURRING PLANS with a PLAN BUILDER" and
 * "2-DAY FOLLOW-UP, AFTERCARE, MONTHLY NEWSLETTER - all OPTIONAL and EDITABLE") ===============================================================
 * Sixfold 365 keeps its own (the plan box and saved plans, followupSweep, jobAftercare, nlSweep): nothing here runs there. careOn() = an
 * edition (company a365 null) with the jobs board. Loaded by every install's API beside it (like mail-oauth-lib.php) and uses that API's
 * own helpers (company(), sendMail(), loadCustomers(), jobsAll(), leadsAll() ...), so it only runs inside one.
 *
 * PLANS. The company builds its own (Setup, Plans): name, the services each visit includes, how often (every week, every N weeks, every
 * month, every 3 months, once a year, or set dates each year), an optional season (from a day to a day, either way round the new year),
 * optional "up to N visits a year", the price (a visit, a month, a quarter or a year) and notes. Starter examples for the install's trade
 * come marked "edit me" and cannot be given to a customer until the company has looked at them and saved (their prices are ours, not theirs).
 * Kept in <data>/care-plans.json; nothing is written there until the admin saves (the starters are made up on the fly before that).
 * A customer goes on a plan from their customer page, or from the quote: the quote can offer a plan as one more option on the customer's
 * quote page (care-qplans.json, per lead; they can tap "I'd like the plan"), and the staff start it from there. The customer keeps a copy of
 * the plan as it was (the 'care' field on their record in customers.log), so changing a plan later never changes a customer's price by
 * itself. The plan box's old fields are kept in step (planName, price, includes, next; plan 'custom' with no weeks, so the older "move the
 * next visit on" code leaves them alone) so the customer list and the morning email show it.
 * Next visit: the first planned date after the last visit done (a visit logged on the customer, or a job of theirs marked Done since the
 * plan started), allowing half a period either way so a visit a few days early or late still counts for its slot. Visits due in the next
 * three weeks with no job booked show on the Jobs board ("Plan visits to book"); Book opens the usual booking form for that customer.
 * NOT charged automatically: "Send payment link" makes a Square or Stripe link (payLink, the same as deposits) for one visit or one period,
 * to copy, text or email (care-pay.log). There is no saved card charging and no subscription.
 *
 * CUSTOMER EMAILS (Setup, Customer emails), every one OFF until the admin turns it on, every word theirs (placeholders, preview, a test to
 * their own address), all through sendMail (their connected mailbox; none connected = nothing goes and the screen says so), never to an
 * address that unsubscribed (newsletter-unsub.json, the same list and link as Sixfold's newsletter: nlunsub), logged in care-mail.log,
 * at most CARE_RUN_CAP a run and CARE_DAY_CAP a day per install. Timed by the hourly job (tools/care-sweep.php, started by morning-email.php),
 * which asks every edition and client install in turn (action caresweep, command line only).
 *   follow-up   a quote with no answer: the first after N days, then every M days, up to K (1-5), each with its own words. Stops when the
 *               lead leaves Quoted (won, lost, booked), they say yes or pick a plan on their quote page, a form is sent, a job is booked, or
 *               someone logs a call where they talked. Only quotes saved after it was turned on (less the first wait). 8 am to 6 pm.
 *   aftercare   after a job is marked Done (a set number of hours later), with words per service (matched on the job's service and quote
 *               lines, else the general one) and an optional review line with their Google review link. Jobs done after it was turned on.
 *   newsletter  to customers who said yes (ticked on their customer page, care-optin.json): the admin writes each issue (or starts from a
 *               template), previews it, sends a test, picks the day and time, and approves it; any change after approving takes the
 *               approval back. Approving is refused without the company's postal mailing address and a connected mailbox (CAN-SPAM:
 *               every issue carries the address and a one-click unsubscribe link), and while a template's "[Write ...]" is still in it. */

const CARE_ACTS = ['careplans', 'careplanset', 'carecust', 'careenrol', 'careend', 'careoptin', 'carepaylink', 'caredue', 'careqset',
    'carecfg', 'carecfgset', 'carepreview', 'caretest', 'carenews', 'carenewsset', 'carenewsapprove', 'carenewsdel', 'carenewstest', 'carelog', 'caresweep'];
const CARE_FREQ = ['week' => 'Every week', 'weeks' => 'Every few weeks', 'month' => 'Every month', 'quarter' => 'Every 3 months', 'year' => 'Once a year', 'dates' => 'On set dates each year'];
const CARE_PER = ['visit' => 'a visit', 'month' => 'a month', 'quarter' => 'a quarter', 'year' => 'a year'];
const CARE_RUN_CAP = 150;   /* emails one hourly run sends per install */
const CARE_DAY_CAP = 400;   /* and a day: under Gmail's 500 a day for a personal account */
const CARE_PH = [
    'fu' => ['first_name' => 'their first name', 'customer_name' => 'their full name', 'company' => 'your company name', 'phone' => 'your phone number', 'price' => 'the quote\'s price', 'link' => 'the link to their quote', 'quote_date' => 'the day of the quote'],
    'ac' => ['first_name' => 'their first name', 'customer_name' => 'their full name', 'company' => 'your company name', 'phone' => 'your phone number', 'job_date' => 'the day of the job', 'service' => 'what the job was', 'review_link' => 'your Google review link (in the review line)'],
    'nl' => ['first_name' => 'their first name', 'company' => 'your company name', 'phone' => 'your phone number']];
const CARE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function careOn(): bool { return edition() && feature('walkdesk'); }
function careFile(string $n): string { return DATA_DIR . '/care-' . $n . '.json'; }
function careJson(string $n): array { $j = json_decode((string) @file_get_contents(careFile($n)), true); return is_array($j) ? $j : []; }
/** read-change-write one care file under its lock */
function careEdit(string $n, callable $fn): array {
    $lk = @fopen(careFile($n) . '.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $d = $fn(careJson($n)); if (!writeJsonAtomic(careFile($n), $d)) { flock($lk, LOCK_UN); fail('Could not save that. Try again.', 500); }
    flock($lk, LOCK_UN); return $d;
}
function careClean($v, int $max): string { return mb_substr(trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", (string) $v))), 0, $max); }
function careMd(string $s): bool { return (bool) preg_match('/^(\d\d)-(\d\d)$/D', $s, $m) && checkdate((int) $m[1], (int) $m[2], 2024); }
function careMdText(string $md): string { return CARE_MONTHS[(int) substr($md, 0, 2) - 1] . ' ' . (int) substr($md, 3, 2); }
function careToday(?int $now = null): string { return (new DateTime('@' . ($now ?? time())))->setTimezone(new DateTimeZone(appTz()))->format('Y-m-d'); }
function careAddDays(string $d, int $n): string { return (new DateTime($d . ' 12:00', new DateTimeZone(appTz())))->modify(($n >= 0 ? '+' : '') . $n . ' days')->format('Y-m-d'); }
function careMoney($p): string { $p = (float) $p; return '$' . (abs($p - round($p)) < 0.005 ? number_format($p, 0) : number_format($p, 2)); }
function careDayText(string $d): string { return (new DateTime($d . ' 12:00', new DateTimeZone(appTz())))->format('D j M Y'); }

/* ---- plans ---- */
/** the starter examples for this install's trade, marked "edit me" (the prices are placeholders, not advice) */
function careStarters(): array {
    $t = (string) (company()['best'] ?? '');
    $S = fn($k, $name, $svc, $freq, $season, $price, $notes) => ['id' => 'cs-' . $k, 'name' => $name, 'services' => $svc, 'freq' => $freq, 'season' => $season, 'visits' => null,
        'price' => $price, 'per' => 'visit', 'notes' => $notes, 'starter' => true, 'off' => false, 'by' => '', 'at' => 0];
    $all = [
        'pest' => $S('pest', 'Quarterly pest control', ['Exterior perimeter treatment', 'Interior treatment if needed', 'Web and nest sweep at the entry points'], ['k' => 'quarter'], null, 120, 'Starter example: check the price and what each visit includes, then save it.'),
        'yards' => $S('lawn', 'Monthly lawn care (in season)', ['Mow, edge and blow', 'Weed check', 'Note anything that needs a quote'], ['k' => 'month'], ['from' => '04-01', 'to' => '10-31'], 75, 'Starter example: the season, the price and what each visit includes are yours to set.'),
        'security' => $S('security', 'Yearly security check', ['Test every sensor, camera and alarm', 'Replace batteries that need it', 'Walk the property for gaps'], ['k' => 'year'], null, 99, 'Starter example: check the price and what the visit includes, then save it.'),
        'roof' => $S('roof', 'Yearly roof maintenance', ['Inspect shingles, flashing and seals', 'Clear gutters and valleys', 'Photos of anything that needs a repair quote'], ['k' => 'year'], null, 249, 'Starter example: check the price and what the visit includes, then save it.'),
        'solar' => $S('solar', 'Yearly panel cleaning', ['Clean the panels', 'Check mounts, wiring and the inverter', 'Note any change in output'], ['k' => 'year'], null, 149, 'Starter example: check the price and what the visit includes, then save it.')];
    return isset($all[$t]) ? [$all[$t]] : array_values($all);
}
/** the company's plans: what it saved, or the starters while it has saved none */
function carePlans(): array { $j = careJson('plans'); return isset($j['plans']) && is_array($j['plans']) ? array_values(array_filter($j['plans'], 'is_array')) : careStarters(); }
function carePlan(string $id): ?array { foreach (carePlans() as $p) if ($p['id'] === $id) return $p; return null; }
/** how often, in words: "Every 3 months, Apr 1 to Oct 31, up to 6 visits a year" */
function careOften(array $P): string {
    $f = (array) ($P['freq'] ?? []); $k = (string) ($f['k'] ?? 'month');
    $s = $k === 'weeks' ? 'Every ' . (int) ($f['n'] ?? 2) . ' weeks' : ($k === 'dates' ? 'Each year on ' . implode(', ', array_map('careMdText', (array) ($f['dates'] ?? []))) : (CARE_FREQ[$k] ?? ''));
    if (!empty($P['season']['from'])) $s .= ', ' . careMdText((string) $P['season']['from']) . ' to ' . careMdText((string) $P['season']['to']);
    if (!empty($P['visits'])) $s .= ', up to ' . (int) $P['visits'] . ' visit' . ((int) $P['visits'] === 1 ? '' : 's') . ' a year';
    return $s;
}
function carePriceText(array $P): string { return careMoney($P['price'] ?? 0) . ' ' . (CARE_PER[$P['per'] ?? 'visit'] ?? 'a visit'); }
/** a plan as the page and the customer's quote page show it */
function carePlanOut(array $P): array { return $P + ['often' => careOften($P), 'priceText' => carePriceText($P)]; }
/** a plan from the admin's form, checked; throws fail() with what to fix */
function carePlanClean(array $in, ?array $was): array {
    $name = careClean($in['name'] ?? '', 80); if (mb_strlen($name) < 2) fail('Name the plan.');
    $svc = $in['services'] ?? []; if (is_string($svc)) $svc = preg_split('/\n/', $svc);
    $svc = array_values(array_filter(array_map(fn($x) => careClean($x, 100), (array) $svc), fn($x) => $x !== ''));
    if (count($svc) > 15) fail('Up to 15 services on one plan.');
    $f = is_array($in['freq'] ?? null) ? $in['freq'] : []; $k = (string) ($f['k'] ?? ''); if (!isset(CARE_FREQ[$k])) fail('Pick how often.');
    $freq = ['k' => $k];
    if ($k === 'weeks') { $n = $f['n'] ?? ''; if (!is_numeric($n) || (int) $n != $n || $n < 2 || $n > 52) fail('Every 2 to 52 weeks.'); $freq['n'] = (int) $n; }
    if ($k === 'dates') {
        $ds = array_values(array_unique(array_map('strval', (array) ($f['dates'] ?? [])))); sort($ds);
        if (!$ds || count($ds) > 24) fail('Add the dates each year (1 to 24).');
        foreach ($ds as $d) if (!careMd($d)) fail('That date is not right: ' . $d . '.');
        $freq['dates'] = $ds;
    }
    $season = null;
    if (is_array($in['season'] ?? null) && (($in['season']['from'] ?? '') !== '' || ($in['season']['to'] ?? '') !== '')) {
        $sf = (string) ($in['season']['from'] ?? ''); $st = (string) ($in['season']['to'] ?? '');
        if (!careMd($sf) || !careMd($st) || $sf === $st) fail('Give the season a first and a last day.');
        $season = ['from' => $sf, 'to' => $st];
    }
    $visits = $in['visits'] ?? null; if ($visits === '' || $visits === null) $visits = null; elseif (!is_numeric($visits) || (int) $visits != $visits || $visits < 1 || $visits > 365) fail('Visits a year: 1 to 365, or leave it empty.'); else $visits = (int) $visits;
    $price = $in['price'] ?? ''; if (!is_numeric($price) || $price <= 0 || $price > 100000) fail('Give the plan a price.');
    $per = (string) ($in['per'] ?? 'visit'); if (!isset(CARE_PER[$per])) fail('Price a visit, a month, a quarter or a year?');
    return ['id' => $was ? (string) $was['id'] : 'cp' . bin2hex(random_bytes(5)), 'name' => $name, 'services' => $svc, 'freq' => $freq, 'season' => $season, 'visits' => $visits,
            'price' => round((float) $price, 2), 'per' => $per, 'notes' => careClean($in['notes'] ?? '', 1000), 'starter' => false, 'off' => !empty($in['off'])];
}
function careInSeason(?array $s, string $date): bool {
    if (!$s) return true; $md = substr($date, 5, 5);
    return $s['from'] <= $s['to'] ? ($md >= $s['from'] && $md <= $s['to']) : ($md >= $s['from'] || $md <= $s['to']);
}
/** the planned dates: up to $count on or after $from, starting $start, within the season, the yearly limit and the end */
function careSched(array $P, string $start, string $from, int $count, ?string $end = null): array {
    if (!dateOk($start)) return [];
    $tz = new DateTimeZone(appTz()); $f = (array) ($P['freq'] ?? []); $k = (string) ($f['k'] ?? 'month');
    $cap = (int) ($P['visits'] ?? 0); $season = is_array($P['season'] ?? null) ? $P['season'] : null; $perYear = []; $out = [];
    $y0 = (int) substr($start, 0, 4); $sd = (int) substr($start, 8, 2); $sm = (int) substr($start, 5, 2);
    $cand = function (int $i) use ($k, $f, $start, $tz, $y0, $sd, $sm): ?string {
        if ($k === 'week' || $k === 'weeks') return (new DateTime($start . ' 12:00', $tz))->modify('+' . ($i * 7 * ($k === 'weeks' ? max(2, (int) ($f['n'] ?? 2)) : 1)) . ' days')->format('Y-m-d');
        if ($k === 'dates') {
            $ds = array_values((array) ($f['dates'] ?? [])); if (!$ds) return null;
            $y = $y0 + intdiv($i, count($ds)); $md = (string) $ds[$i % count($ds)];
            return checkdate((int) substr($md, 0, 2), (int) substr($md, 3, 2), $y) ? sprintf('%04d-%s', $y, $md) : '';
        }
        $step = $k === 'year' ? 12 : ($k === 'quarter' ? 3 : 1); $m = $sm - 1 + $i * $step; $y = $y0 + intdiv($m, 12); $m = $m % 12 + 1;
        return sprintf('%04d-%02d-%02d', $y, $m, min($sd, (int) (new DateTime(sprintf('%04d-%02d-01', $y, $m)))->format('t')));
    };
    for ($i = 0; $i < 2000 && count($out) < $count; $i++) {
        $d = $cand($i); if ($d === null) break; if ($d === '' || $d < $start) continue;
        if ((int) substr($d, 0, 4) > $y0 + 15 || ($end !== null && $end !== '' && $d > $end)) break;
        if (!careInSeason($season, $d)) continue;
        $y = substr($d, 0, 4); if ($cap > 0 && ($perYear[$y] ?? 0) >= $cap) continue; $perYear[$y] = ($perYear[$y] ?? 0) + 1;
        if ($d >= $from) $out[] = $d;
    }
    return $out;
}
/** how many days after a visit its slot is taken: half a period */
function careCover(array $P): int { $f = (array) ($P['freq'] ?? []); return ['week' => 3, 'weeks' => max(3, intdiv(7 * (int) ($f['n'] ?? 2), 2)), 'month' => 14, 'quarter' => 45, 'year' => 180, 'dates' => 14][(string) ($f['k'] ?? 'month')] ?? 14; }
/** the customer's visits done since $start: hand-logged visits and their jobs marked Done (the newest date, or '') */
function careLastDone(array $c, string $start): string {
    $last = ''; $v = [];
    foreach (jsonLines(custDir() . '/visits.log') as $r) { if (($r['cid'] ?? '') !== $c['id'] || empty($r['vid'])) continue; if (!empty($r['del'])) { unset($v[$r['vid']]); continue; } $v[$r['vid']] = $r; }
    foreach ($v as $r) if (($r['status'] ?? '') === 'done' && (string) ($r['date'] ?? '') >= $start && (string) $r['date'] > $last) $last = (string) $r['date'];
    $lead = (string) ($c['lead'] ?? '');
    if ($lead !== '') foreach (jobsAll() as $j) if (!$j['off'] && (string) $j['lead'] === $lead && (($j['done']['o'] ?? '') === 'done') && (string) $j['date'] >= $start && (string) $j['date'] > $last) $last = (string) $j['date'];
    return $last;
}
/** a job of theirs on the board, not done, on or after $after: its date, or null */
function careBooked(array $c, string $after): ?string {
    $lead = (string) ($c['lead'] ?? ''); if ($lead === '') return null; $best = null;
    foreach (jobsAll() as $j) if (!$j['off'] && (string) $j['lead'] === $lead && empty($j['done']) && (string) $j['date'] >= $after && ($best === null || $j['date'] < $best)) $best = (string) $j['date'];
    return $best;
}
/** a customer's plan as it stands: [active sub or null, next date, the next few dates, last visit, booked job date] */
function careState(array $c): array {
    $s = is_array($c['care'] ?? null) ? $c['care'] : null;
    if (!$s || !empty($s['ended']) || ($c['status'] ?? 'active') !== 'active') return [$s, null, [], '', null];
    $start = (string) $s['start']; $last = careLastDone($c, $start);
    $from = $last === '' ? $start : careAddDays($last, careCover($s) + 1);
    $list = careSched($s, $start, $from, 6, $s['end'] ?? null);
    return [$s, $list[0] ?? null, $list, $last, careBooked($c, $last === '' ? $start : careAddDays($last, 1))];
}
function careCustWrite(string $cid, array $f, string $by): void {
    if (!is_dir(custDir())) @mkdir(custDir(), 0750, true);
    if (!appendLine(custDir() . '/customers.log', ['id' => $cid, 'by' => $by, 'at' => time(), 'f' => $f])) fail('Could not save that. Try again.', 500);
}
function careOptins(): array { return careJson('optin'); }
function careEmailOf(array $x): string { $e = strtolower(trim((string) ($x['email'] ?? ''))); return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : ''; }
function careUnsub(string $e): ?array { $u = nlUnsubs(); return $e !== '' && isset($u[$e]) ? (array) $u[$e] : null; }

/* ---- the emails ---- */
function careCfg(): array {
    $j = careJson('cfg'); $d = careCfgDefaults();
    $fu = array_merge($d['fu'], array_intersect_key((array) ($j['fu'] ?? []), $d['fu'])); $ac = array_merge($d['ac'], array_intersect_key((array) ($j['ac'] ?? []), $d['ac']));
    $ac['review'] = array_merge($d['ac']['review'], array_intersect_key((array) ($ac['review'] ?? []), $d['ac']['review']));
    $nl = array_merge($d['nl'], array_intersect_key((array) ($j['nl'] ?? []), $d['nl']));
    return ['fu' => $fu, 'ac' => $ac, 'nl' => $nl];
}
function careCfgDefaults(): array {
    return [
        'fu' => ['on' => false, 'onAt' => 0, 'days' => 2, 'gap' => 3, 'max' => 2, 'by' => '', 'at' => 0, 'tpls' => [
            ['subject' => 'Your quote from {company}', 'body' => "Hi {first_name},\n\nJust checking in on the quote we sent on {quote_date} ({price}). You can see it again here: {link}\n\nAny questions, call or text {phone}. If now is not the right time, no problem at all.\n\n{company}"],
            ['subject' => 'Still thinking it over?', 'body' => "Hi {first_name},\n\nOne more note about your quote ({price}). It is here whenever you are ready: {link}\n\nIf anything would make it a better fit, call or text {phone} and we will talk it through.\n\n{company}"]]],
        'ac' => ['on' => false, 'onAt' => 0, 'hours' => 2, 'by' => '', 'at' => 0,
            'review' => ['on' => false, 'link' => '', 'line' => 'If you were happy with the work, a short Google review helps other homeowners find us: {review_link}'],
            'tpls' => [['name' => 'Every job', 'match' => '', 'subject' => 'Thanks from {company}', 'body' => "Hi {first_name},\n\nThanks for having us out on {job_date}. If anything is not right, or you have a question about the work, call or text {phone} and we will make it right.\n\n{company}"]]],
        'nl' => ['address' => '', 'by' => '', 'at' => 0]];
}
/** the {words} a message cannot fill */
function careUnknownPh(string $kind, string $s): array { preg_match_all('/\{([A-Za-z_]+)\}/', $s, $m); return array_values(array_unique(array_diff($m[1], array_keys(CARE_PH[$kind])))); }
function careTplClean(string $kind, array $t, bool $named = false): array {
    $o = ['subject' => careClean($t['subject'] ?? '', 150), 'body' => careClean($t['body'] ?? '', 4000)];
    if ($o['subject'] === '' || $o['body'] === '') fail('Each email needs a subject and words.');
    if ($bad = careUnknownPh($kind, $o['subject'] . ' ' . $o['body'])) fail('This email cannot fill {' . implode('}, {', $bad) . '}. Use the words listed under it.');
    if ($named) { $o = ['name' => careClean($t['name'] ?? '', 60) ?: 'Every job', 'match' => careClean($t['match'] ?? '', 200)] + $o; }
    return $o;
}
/** the review link: their own in this screen, else the one on the Company screen */
function careReviewLink(array $cfg): string { $r = trim((string) ($cfg['ac']['review']['link'] ?? '')); if ($r === '' && function_exists('followupReview')) $r = followupReview(); return preg_match('#^https://[^\s<>"]{8,300}$#D', $r) ? $r : ''; }
/** a follow-up or aftercare email, filled: [subject, text, html, headers] with the letterhead and an unsubscribe line */
function careRender(array $t, array $v, string $to, string $extraLine = ''): array {
    [$s, $text, $paras] = mailRender(['subject' => $t['subject'], 'body' => $t['body'] . ($extraLine !== '' ? "\n\n" . $extraLine : '')], $v);
    $un = nlUnsubUrl($to !== '' ? $to : 'you@example.com'); $e = fn($x) => htmlspecialchars((string) $x, ENT_QUOTES, 'UTF-8');
    $html = mailBrandWrap(kitBrand(), $paras . '<p style="margin:18px 0 0;color:#566476;font-size:12px">Do not want emails like this? <a href="' . $e($un) . '" style="color:#566476">Unsubscribe</a></p>');
    return [$s, $text . "\n\n--\nDo not want emails like this? Unsubscribe: " . $un . "\n", $html, ['List-Unsubscribe: <' . $un . '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']];
}
/** the values for a follow-up about this lead's quote */
function careFuVals(array $l): array {
    $B = kitBrand(); $Q = (array) ($l['quote'] ?? []);
    return ['first_name' => mailFirst((string) ($l['name'] ?? '')) ?: 'there', 'customer_name' => trim((string) ($l['name'] ?? '')), 'company' => $B['name'], 'phone' => a365Phone($l) ?: $B['phone'],
            'price' => careMoney($Q['price'] ?? 0), 'link' => a365QuoteLink((string) $l['id']), 'quote_date' => (new DateTime('@' . (int) ($Q['at'] ?? time())))->setTimezone(new DateTimeZone(appTz()))->format('F j')];
}
/** what a job was, in a few words: the service typed, else the quote's first line */
function careJobService(array $j, array $l): string {
    if (trim((string) ($j['svc'] ?? '')) !== '') return trim((string) $j['svc']);
    foreach ((array) ($l['quote']['items'] ?? []) as $x) if (!in_array($x['id'] ?? '', ['min', 'adj'], true) && trim((string) ($x['t'] ?? '')) !== '') return trim((string) $x['t']);
    return 'your job';
}
/** the aftercare words for this job: the first whose words match its service or quote lines, else the general one */
function careAcPick(array $cfg, array $j, array $l): array {
    $hay = mb_strtolower(implode(' ', array_merge([(string) ($j['svc'] ?? ''), (string) ($j['title'] ?? ''), (string) ($j['note'] ?? '')], array_map(fn($x) => (string) ($x['t'] ?? ''), (array) ($l['quote']['items'] ?? [])))));
    $def = null;
    foreach ((array) $cfg['ac']['tpls'] as $t) {
        $words = array_filter(array_map('trim', explode(',', mb_strtolower((string) ($t['match'] ?? '')))));
        if (!$words) { $def = $def ?? $t; continue; }
        foreach ($words as $w) if ($w !== '' && mb_strpos($hay, $w) !== false) return $t;
    }
    return $def ?? ((array) $cfg['ac']['tpls'])[0];
}
function careAcVals(array $j, array $l, string $review): array {
    $B = kitBrand();
    return ['first_name' => mailFirst((string) ($l['name'] ?? ($j['title'] ?? ''))) ?: 'there', 'customer_name' => trim((string) ($l['name'] ?? ($j['title'] ?? ''))), 'company' => $B['name'], 'phone' => a365Phone($l) ?: $B['phone'],
            'job_date' => (new DateTime((string) $j['date'] . ' 12:00', new DateTimeZone(appTz())))->format('F j'), 'service' => careJobService($j, $l), 'review_link' => $review];
}
/** one email through the company's own mailbox (sendMail); CARE_MAIL_MOCK (a file, the test copy only) writes it there instead */
function careSend(string $to, array $m): array {
    if (!mailCfg()) return ['ok' => false, 'stage' => 'config', 'error' => 'Email is not connected yet (Setup, Email).'];
    $mock = getenv('CARE_MAIL_MOCK');
    if ($mock) { @file_put_contents($mock, json_encode(['to' => $to, 'subject' => $m[0], 'text' => $m[1], 'html' => $m[2], 'headers' => $m[3] ?? []]) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'sent', 'error' => '']; }
    return sendMail($to, $m[0], $m[1], $m[2], $m[3] ?? []);
}
function careLog(array $row): void { appendLine(DATA_DIR . '/care-mail.log', ['id' => 'm' . bin2hex(random_bytes(5))] + $row + ['at' => time()]); }
function careSentToday(?int $now = null): int {
    $t0 = (new DateTime(careToday($now) . ' 00:00', new DateTimeZone(appTz())))->getTimestamp(); $n = 0;
    foreach (jsonLines(DATA_DIR . '/care-mail.log') as $r) if ((int) ($r['at'] ?? 0) >= $t0 && !empty($r['ok']) && empty($r['test'])) $n++;
    return $n;
}
/** has the customer answered since the quote? */
function careAnswered(array $l, int $qat, array $qp): bool {
    if (($l['status'] ?? '') !== 'quoted') return true;
    if (!empty($l['accept']) || !empty($l['sign']) || !empty($l['signed']) || !empty($qp[$l['id']]['picked'])) return true;
    if (jobForLead((string) $l['id'])) return true;
    foreach ((array) ($l['tries'] ?? []) as $t) if ((int) ($t['at'] ?? 0) >= $qat && ($t['o'] ?? '') === 'talk') return true;   /* the same second counts: quoted and talked in one go */
    return false;
}

/* ---- the newsletter ---- */
function careNews(): array { $j = careJson('news'); return array_values(array_filter((array) ($j['issues'] ?? []), 'is_array')); }
function careNewsEdit(callable $fn): array { return careEdit('news', function ($d) use ($fn) { $d['issues'] = array_values($fn(array_values(array_filter((array) ($d['issues'] ?? []), 'is_array')))); return $d; }); }
function careNlHash(array $is): string { return sha1((string) $is['subject'] . "\n" . (string) $is['pre'] . "\n" . (string) $is['body'] . "\n" . (string) $is['send']); }
function careNlTime(string $s): ?int { if (!preg_match('/^(\d{4}-\d\d-\d\d)[ T](\d\d):(\d\d)$/D', $s, $m) || !dateOk($m[1]) || (int) $m[2] > 23 || (int) $m[3] > 59) return null; return (new DateTime($m[1] . ' ' . $m[2] . ':' . $m[3], new DateTimeZone(appTz())))->getTimestamp(); }
/** customers who said yes: an email, ticked on their page, not unsubscribed, not ended; one per address */
function careNlRecipients(): array {
    $opt = careOptins(); $un = nlUnsubs(); $o = [];
    foreach (loadCustomers() as $c) {
        $e = careEmailOf($c); if ($e === '' || empty($opt[$c['id']]['on']) || isset($un[$e]) || isset($o[$e]) || ($c['status'] ?? 'active') === 'ended') continue;
        $o[$e] = ['email' => $e, 'name' => trim((string) ($c['name'] ?? '')), 'cid' => (string) $c['id']];
    }
    return array_values($o);
}
function careNlTemplates(): array {
    return [
        ['k' => 'monthly', 'name' => 'Monthly update', 'subject' => 'News from {company}', 'pre' => '[Write one line people see before they open it]',
         'body' => "# This month at {company}\n\nHi {first_name},\n\n[Write a short hello: what you have been working on this month.]\n\n## A tip for this time of year\n\n[Write one practical tip for homeowners. Only facts you can stand behind.]\n\n## Coming up\n\n- [Write a date or service to remember]\n\nQuestions? Reply to this email or call {phone}."],
        ['k' => 'season', 'name' => 'Seasonal reminder', 'subject' => 'Time to think about [Write the season]', 'pre' => '[Write one line people see before they open it]',
         'body' => "# Getting ready for [Write the season]\n\nHi {first_name},\n\n[Write why this season matters for their home, in two or three sentences.]\n\n- [Write a thing to check]\n- [Write another thing to check]\n\nWant us to take care of it? Call or text {phone}."],
        ['k' => 'thanks', 'name' => 'Thank you', 'subject' => 'Thank you from {company}', 'pre' => '[Write one line people see before they open it]',
         'body' => "# Thank you\n\nHi {first_name},\n\n[Write a thank-you to your customers for the year or the season.]\n\n[Write anything new: a service, a team member, a change in hours.]\n\nWe are always a call away: {phone}."]];
}
/** one issue as [subject, text, html, headers] for one person. Markup: # heading, ## smaller heading, - list lines, [text](https://link), **bold** */
function careNlRender(array $is, string $to, string $name, bool $test = false): array {
    $B = kitBrand(); $col = preg_match('/^#[0-9a-f]{6}$/i', (string) $B['color']) ? (string) $B['color'] : '#13294b';
    $vals = ['{first_name}' => mailFirst($name) ?: 'there', '{company}' => (string) $B['name'], '{phone}' => (string) $B['phone']];
    $e = fn($x) => htmlspecialchars((string) $x, ENT_QUOTES, 'UTF-8');
    $inline = function (string $t) use ($e, $col) { $t = $e($t); $t = preg_replace('/\*\*(.+?)\*\*/', '<b>$1</b>', $t); return preg_replace_callback('/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{4,500})\)/', fn($m) => '<a href="' . $m[2] . '" style="color:' . $col . '">' . $m[1] . '</a>', $t); };
    $plain = fn(string $t) => preg_replace('/\[([^\]]{1,200})\]\((https:\/\/[^\s)]{4,500})\)/', '$1 ($2)', str_replace('**', '', $t));
    $h = ''; $t = '';
    foreach (preg_split('/\n\s*\n/', strtr(str_replace("\r\n", "\n", trim((string) ($is['body'] ?? ''))), $vals)) as $blk) {
        $blk = trim($blk); if ($blk === '') continue;
        if (preg_match('/^(#{1,2}) (.+)$/D', $blk, $m)) { $h .= '<div style="font-size:' . ($m[1] === '#' ? '20' : '17') . 'px;font-weight:800;color:' . $col . ';margin:6px 0 10px">' . $inline($m[2]) . '</div>'; $t .= mb_strtoupper($plain($m[2])) . "\n\n"; continue; }
        $lines = explode("\n", $blk);
        if (count(array_filter($lines, fn($l) => preg_match('/^\s*- /', $l))) === count($lines)) { $h .= '<ul style="margin:0 0 16px;padding-left:20px">' . implode('', array_map(fn($l) => '<li style="margin:0 0 6px">' . $inline(preg_replace('/^\s*- /', '', $l)) . '</li>', $lines)) . '</ul>'; $t .= implode("\n", array_map($plain, $lines)) . "\n\n"; continue; }
        $h .= '<p style="margin:0 0 16px">' . implode('<br>', array_map($inline, $lines)) . '</p>'; $t .= $plain($blk) . "\n\n";
    }
    $un = nlUnsubUrl($to !== '' ? $to : 'you@example.com'); $addr = trim((string) careCfg()['nl']['address']);
    $why = 'You are getting this because you said yes to news from ' . $B['name'] . '.';
    $foot = implode(' · ', array_filter([(string) $B['name'], (string) $B['phone'], (string) $B['site']]));
    $text = ($test ? "[TEST: what each customer gets]\n\n" : '') . trim($t) . "\n\n--\n" . $foot . "\n" . $why . "\nUnsubscribe: " . $un . "\n" . $addr . "\n";
    $html = '<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#15202d;font-size:15px;line-height:1.5">'
          . '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' . $e(strtr((string) ($is['pre'] ?? ''), $vals)) . '</div>'
          . '<div style="max-width:600px;margin:0 auto;padding:24px 18px">' . mailBrandHead($B, $col) . $h
          . '<div style="margin-top:28px;padding-top:14px;border-top:1px solid #dce2ea;color:#566476;font-size:12px;line-height:1.5">' . $e($foot) . '<br>' . $e($why) . ' <a href="' . $e($un) . '" style="color:#566476">Unsubscribe</a><br>' . nl2br($e($addr)) . '</div>'
          . '</div></body></html>';
    return [($test ? '[Test] ' : '') . strtr((string) ($is['subject'] ?? ''), $vals), $text, $html, ['List-Unsubscribe: <' . $un . '>', 'List-Unsubscribe-Post: List-Unsubscribe=One-Click']];
}
function careNlOut(array $is): array {
    $ap = is_array($is['approved'] ?? null) && ($is['approved']['h'] ?? '') === careNlHash($is) ? $is['approved'] : null; $s = is_array($is['sent'] ?? null) ? $is['sent'] : null;
    $st = $s && !empty($s['done']) ? 'sent' : ($s ? 'sending' : ($ap ? 'approved' : 'draft'));
    return ['id' => $is['id'], 'subject' => $is['subject'], 'pre' => $is['pre'], 'body' => $is['body'], 'send' => $is['send'], 'state' => $st, 'approved' => $ap,
            'sent' => $s ? ['n' => (int) ($s['n'] ?? 0), 'ok' => (int) ($s['ok'] ?? 0), 'bad' => (int) ($s['bad'] ?? 0), 'of' => count((array) ($s['queue'] ?? [])), 'start' => (int) ($s['start'] ?? 0), 'end' => (int) ($s['end'] ?? 0)] : null,
            'marks' => (bool) preg_match('/\[Write[^\]]*\]/i', $is['subject'] . $is['pre'] . $is['body']), 'by' => (string) ($is['by'] ?? ''), 'at' => (int) ($is['at'] ?? 0)];
}

/* ---- the hourly part (tools/care-sweep.php -> action caresweep, command line only) ---- */
function careSweep(?int $now = null): array {
    if (!careOn()) return ['skipped' => 'not here'];
    $now = $now ?? time(); $out = ['next' => 0, 'fu' => 0, 'ac' => 0, 'nl' => 0];
    $lk = @fopen(DATA_DIR . '/care-sweep.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) return $out + ['skipped' => 'busy'];
    /* the plan box's next visit kept in step, for the customer list and the morning email */
    foreach (loadCustomers() as $c) { if (empty($c['care']) || !empty($c['care']['ended'])) continue; [, $nx] = careState($c); if ($nx !== null && (string) ($c['next'] ?? '') !== $nx) { appendLine(custDir() . '/customers.log', ['id' => $c['id'], 'by' => 'Plans', 'at' => time(), 'f' => ['next' => $nx]]); $out['next']++; } }
    $cfg = careCfg(); $left = min(CARE_RUN_CAP, CARE_DAY_CAP - careSentToday($now));
    if ($left <= 0) { flock($lk, LOCK_UN); return $out + ['skipped' => 'daily limit']; }
    $mailOk = (bool) mailCfg(); $hour = (int) (new DateTime('@' . $now))->setTimezone(new DateTimeZone(appTz()))->format('G'); $day = $hour >= 8 && $hour < 18;
    $log = jsonLines(DATA_DIR . '/care-mail.log'); $un = nlUnsubs(); $fast = PHP_SAPI !== 'cli' || getenv('CARE_FAST');
    /* follow-ups on quotes with no answer */
    if ($mailOk && $day && !empty($cfg['fu']['on'])) {
        $days = max(1, (int) $cfg['fu']['days']); $gap = max(1, (int) $cfg['fu']['gap']); $max = max(1, min(5, (int) $cfg['fu']['max'])); $tpls = array_values((array) $cfg['fu']['tpls']);
        $qp = careJson('qplans'); $sent = [];
        foreach ($log as $r) if (($r['kind'] ?? '') === 'fu' && empty($r['test']) && (!empty($r['ok']) || ($r['stage'] ?? '') !== 'config')) $sent[(string) ($r['lead'] ?? '')][] = $r;
        foreach (leadsAll() as $l) {
            if ($left <= 0) break;
            $qat = (int) ($l['quote']['at'] ?? 0); if (!$qat || empty($l['quote']['price']) || $qat < (int) $cfg['fu']['onAt'] - $days * 86400 || $qat < $now - 60 * 86400) continue;
            $to = careEmailOf($l); if ($to === '' || isset($un[$to]) || careAnswered($l, $qat, $qp)) continue;
            $mine = array_values(array_filter($sent[(string) $l['id']] ?? [], fn($r) => (int) ($r['qat'] ?? 0) === $qat)); $n = count($mine);
            if ($n >= $max || $now < $qat + $days * 86400 + $n * $gap * 86400) continue;
            $lastAt = 0; foreach ($sent[(string) $l['id']] ?? [] as $r) $lastAt = max($lastAt, (int) $r['at']); if ($lastAt && $now - $lastAt < $gap * 86400) continue;
            $t = $tpls[min($n, count($tpls) - 1)] ?? null; if (!$t) break;
            $r = careSend($to, careRender($t, careFuVals($l), $to));
            careLog(['kind' => 'fu', 'lead' => (string) $l['id'], 'qat' => $qat, 'n' => $n + 1, 'to' => $to, 'ok' => $r['ok'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 200)]);
            appendLine(leadsDir() . '/leadst.log', ['id' => (string) $l['id'], 'note' => $r['ok'] ? 'Follow-up ' . ($n + 1) . ' emailed to ' . $to . '.' : 'Follow-up ' . ($n + 1) . ' NOT emailed (' . $r['stage'] . ').', 'by' => 'Follow-up email', 'at' => time()]);
            if ($r['ok']) { $out['fu']++; $left--; }
            if (!$fast) usleep(300000);
        }
    }
    /* aftercare after a job is marked done */
    if ($mailOk && $day && !empty($cfg['ac']['on']) && $left > 0) {
        $done = []; foreach ($log as $r) if (($r['kind'] ?? '') === 'ac' && empty($r['test']) && (!empty($r['ok']) || ($r['stage'] ?? '') !== 'config')) $done[(string) ($r['job'] ?? '')] = true;
        $leads = leadsAll(); $hours = max(0, min(72, (int) $cfg['ac']['hours'])); $review = careReviewLink($cfg);
        foreach (jobsAll() as $j) {
            if ($left <= 0) break;
            $dn = $j['done'] ?? null; if ($j['off'] || !is_array($dn) || ($dn['o'] ?? '') !== 'done' || isset($done[(string) $j['id']])) continue;
            $at = (int) ($dn['at'] ?? 0); if ($at < (int) $cfg['ac']['onAt'] || $at < $now - 7 * 86400 || $now < $at + $hours * 3600) continue;
            $l = $leads[(string) $j['lead']] ?? null; if (!$l) continue; $to = careEmailOf($l); if ($to === '' || isset($un[$to])) continue;
            $t = careAcPick($cfg, $j, $l); $line = !empty($cfg['ac']['review']['on']) && $review !== '' ? (string) $cfg['ac']['review']['line'] : '';
            $r = careSend($to, careRender($t, careAcVals($j, $l, $review), $to, $line));
            careLog(['kind' => 'ac', 'job' => (string) $j['id'], 'lead' => (string) $j['lead'], 'tpl' => (string) ($t['name'] ?? ''), 'to' => $to, 'ok' => $r['ok'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 200)]);
            appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => $r['ok'] ? 'Aftercare emailed to ' . $to . '.' : 'Aftercare NOT emailed (' . $r['stage'] . ').', 'by' => 'Aftercare email', 'at' => time()]);
            if ($r['ok']) { $out['ac']++; $left--; }
            if (!$fast) usleep(300000);
        }
    }
    /* newsletter issues approved and due */
    if ($left > 0) foreach (careNews() as $is) {
        $ap = $is['approved'] ?? null; $s = $is['sent'] ?? null; $when = careNlTime((string) $is['send']);
        if (!is_array($ap) || ($ap['h'] ?? '') !== careNlHash($is) || $when === null || $when > $now || (is_array($s) && !empty($s['done']))) continue;
        if (!$mailOk || trim((string) $cfg['nl']['address']) === '') { $out['nlwait'] = !$mailOk ? 'no mailbox' : 'no mailing address'; break; }
        $id = (string) $is['id']; $logf = DATA_DIR . '/care-nl-' . preg_replace('/[^a-z0-9]/', '', $id) . '.log';
        if (!is_array($s)) { $s = ['start' => $now, 'queue' => array_column(careNlRecipients(), 'email'), 'n' => 0, 'ok' => 0, 'bad' => 0, 'done' => false]; careNewsEdit(function ($L) use ($id, $s) { foreach ($L as &$x) if ($x['id'] === $id) $x['sent'] = $s; unset($x); return $L; }); }
        $have = []; foreach (readLines($logf) as $r) $have[strtolower((string) $r['id'])] = true;
        $names = []; foreach (careNlRecipients() as $p) $names[$p['email']] = $p['name'];
        $opt = careOptins(); $optE = []; foreach (loadCustomers() as $c) if (!empty($opt[$c['id']]['on']) && ($e = careEmailOf($c)) !== '') $optE[$e] = true;
        foreach ((array) $s['queue'] as $em) {
            if (isset($have[$em])) continue; if ($left <= 0) break;
            if (isset($un[$em]) || !isset($optE[$em])) { appendLine($logf, ['id' => $em, 'ok' => false, 'stage' => isset($un[$em]) ? 'unsubscribed' : 'no longer opted in', 'at' => time()]); $have[$em] = true; continue; }
            $r = careSend($em, careNlRender($is, $em, (string) ($names[$em] ?? '')));
            appendLine($logf, ['id' => $em, 'ok' => $r['ok'], 'stage' => $r['stage'], 'at' => time()]); $have[$em] = true;
            careLog(['kind' => 'nl', 'issue' => $id, 'to' => $em, 'ok' => $r['ok'], 'stage' => $r['stage']]);
            if ($r['ok']) { $out['nl']++; $left--; }
            if (!$fast) usleep(300000);
        }
        $ok = 0; $bad = 0; foreach (readLines($logf) as $r) { if (!empty($r['ok'])) $ok++; else $bad++; }
        $fin = count(array_diff((array) $s['queue'], array_keys($have))) === 0;
        careNewsEdit(function ($L) use ($id, $ok, $bad, $fin) { foreach ($L as &$x) if ($x['id'] === $id && is_array($x['sent'] ?? null)) { $x['sent']['ok'] = $ok; $x['sent']['bad'] = $bad; $x['sent']['n'] = $ok + $bad; if ($fin) { $x['sent']['done'] = true; $x['sent']['end'] = time(); } } unset($x); return $L; });
        if ($fin) careTellAdmins('Newsletter sent: ' . (string) $is['subject'], $ok . ' sent' . ($bad ? ', ' . $bad . ' not sent (see Newsletter)' : '') . '.', 'carenl-' . $id);
        if ($left <= 0) break;
    }
    flock($lk, LOCK_UN);
    return $out;
}
/** a line in every admin's alerts */
function careTellAdmins(string $title, string $body, string $tag): void {
    global $basePeople, $acct, $sessionKey;
    if (!function_exists('acctRows') || !isset($basePeople)) return;
    foreach (acctRows($basePeople, $acct, $sessionKey) as $row) if (empty($row['off']) && ($row['role'] ?? '') === 'admin' && !boardHidden((string) $row['name'])) feedAdd((string) $row['name'], $title, $body, './', $tag);
}

/* ---- the customer's quote page (public, q.html): a plan offered beside the quote, and their "I'd like the plan" ---- */
function carePublic(): void {
    global $action, $body, $isPost;
    if (!careOn()) fail('Not here.', 404);
    header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
    if (!throttleTake(rateFile('careq|' . visitorKey()), 120, 3600)) fail('Too many tries from here. Please call or text us.', 429);
    $q = (string) ($_GET['q'] ?? ($body['q'] ?? ''));
    if (!preg_match('/^([wm]\d{14}[0-9a-f]{6})-([0-9a-f]{16})$/D', $q, $qm) || !hash_equals(a365QuoteKey($qm[1]), $qm[2])) fail('This link does not look right.', 404);
    $l = leadsAll()[$qm[1]] ?? null; $qp = careJson('qplans')[$qm[1]] ?? null;
    if (!$l || empty($l['quote']) || $l['status'] === 'lost' || !is_array($qp) || empty($qp['plan'])) out(['ok' => true, 'plan' => null]);
    $P = (array) $qp['plan'];
    if ($action === 'careqplan') out(['ok' => true, 'plan' => ['name' => (string) $P['name'], 'priceText' => carePriceText($P), 'often' => careOften($P), 'services' => array_values((array) ($P['services'] ?? [])), 'notes' => (string) ($P['notes'] ?? '')], 'picked' => !empty($qp['picked'])]);
    if (!$isPost) fail('POST required', 405);
    if (!throttleTake(rateFile('careqpick|' . visitorKey()), 10, 86400)) fail('We have had a lot of answers from here today. Please call or text us.', 429);
    if (!empty($qp['picked'])) out(['ok' => true, 'picked' => true]);
    $note = careClean($body['note'] ?? '', 300);
    careEdit('qplans', function ($d) use ($qm, $note) { if (isset($d[$qm[1]])) $d[$qm[1]]['picked'] = ['at' => time(), 'note' => $note]; return $d; });
    appendLine(leadsDir() . '/leadst.log', ['id' => $qm[1], 'note' => mb_substr('Picked the plan "' . $P['name'] . '" (' . carePriceText($P) . ') on their quote page. Start it from the quote or their customer page.' . ($note !== '' ? ' "' . $note . '"' : ''), 0, 500), 'by' => 'website', 'at' => time()]);
    careTellAdmins('Plan picked: ' . (trim((string) ($l['name'] ?? '')) ?: 'a customer'), (string) $P['name'] . ' · ' . carePriceText($P) . '. Start it from the quote or their customer page.', 'careqpick-' . $qm[1]);
    $own = (string) ($l['owner'] ?? ''); if ($own !== '') feedAdd($own, 'Plan picked: ' . (trim((string) ($l['name'] ?? '')) ?: 'a customer'), (string) $P['name'] . ' · ' . carePriceText($P), './', 'careqpick-' . $qm[1]);
    out(['ok' => true, 'picked' => true]);
}

/* ---- the signed-in actions ---- */
function careAction(): void {
    global $action, $body, $isPost, $role, $me;
    if (!in_array($action, CARE_ACTS, true)) return;
    if ($action === 'caresweep') { if (PHP_SAPI !== 'cli' || !defined('SIXFOLD_CLI')) fail('Not here.', 404); out(['ok' => true] + careSweep(isset($_GET['now']) && is_numeric($_GET['now']) ? (int) $_GET['now'] : null)); }
    if (!careOn()) fail('Plans and customer emails are not part of this app.', 404);
    $post = function () use ($isPost) { if (!$isPost) fail('POST required', 405); };
    $tz = new DateTimeZone(appTz()); $today = careToday();

    /* the plans: everyone who works with customers or quotes reads them; the admin (or a role given Plans) builds them */
    if ($action === 'careplans') {
        if (!desk() && !edRep() && !adminOr('set.plans')) fail('Not allowed.', 403);
        $all = array_map('carePlanOut', carePlans()); $setup = adminOr('set.plans');
        $lid = (string) ($_GET['lead'] ?? ''); $offer = null;   /* the plan offered on this lead's quote, for the quote builder */
        if ($lid !== '' && (desk() || edRepLead($lid))) { $qp = careJson('qplans')[$lid] ?? null; if (is_array($qp) && !empty($qp['plan'])) $offer = ['plan' => carePlanOut((array) $qp['plan']), 'picked' => $qp['picked'] ?? null]; }
        out(['ok' => true, 'plans' => $setup ? $all : array_values(array_filter($all, fn($p) => empty($p['off']) && empty($p['starter']))), 'saved' => isset(careJson('plans')['plans']), 'freq' => CARE_FREQ, 'per' => CARE_PER, 'offer' => $offer]);
    }
    if ($action === 'careplanset') {
        $post(); if (!adminOr('set.plans')) fail('Not allowed.', 403);
        $id = (string) ($body['id'] ?? ''); $cur = carePlans();
        if (!empty($body['starters'])) {   /* the starter examples back, the ones not already here */
            $have = array_column($cur, 'id'); foreach (careStarters() as $s) if (!in_array($s['id'], $have, true)) $cur[] = $s;
        } elseif (!empty($body['del'])) {
            if (!array_filter($cur, fn($p) => $p['id'] === $id)) fail('No such plan.', 404);
            $cur = array_values(array_filter($cur, fn($p) => $p['id'] !== $id));
        } else {
            $was = null; foreach ($cur as $p) if ($id !== '' && $p['id'] === $id) $was = $p;
            if ($id !== '' && !$was) fail('No such plan.', 404);
            if (count($cur) >= 40 && !$was) fail('Up to 40 plans.');
            $P = carePlanClean(is_array($body['plan'] ?? null) ? $body['plan'] : $body, $was) + ['by' => $me, 'at' => time()];
            if ($was) { foreach ($cur as &$p) if ($p['id'] === $id) $p = $P; unset($p); } else $cur[] = $P;
            $id = $P['id'];
        }
        careEdit('plans', function ($d) use ($cur) { $d['plans'] = array_values($cur); return $d; });
        out(['ok' => true, 'id' => $id, 'plans' => array_map('carePlanOut', carePlans())]);
    }
    /* a customer's plan, from their customer page */
    if ($action === 'carecust') {
        if (!desk()) fail('Not allowed.', 403);
        $cs = loadCustomers(); $c = $cs[(string) ($_GET['id'] ?? '')] ?? null; if (!$c) fail('No such customer.', 404);
        [$s, $next, $list, $last, $booked] = careState($c);
        $e = careEmailOf($c); $opt = careOptins()[$c['id']] ?? null; $un = careUnsub($e);
        $pays = []; foreach (jsonLines(DATA_DIR . '/care-pay.log') as $r) if (($r['cid'] ?? '') === $c['id']) $pays[] = array_intersect_key($r, array_flip(['label', 'amt', 'url', 'kind', 'by', 'at', 'mailed']));
        $offer = null; $lid = (string) ($c['lead'] ?? ''); $qp = $lid !== '' ? (careJson('qplans')[$lid] ?? null) : null;
        if (is_array($qp) && !empty($qp['plan'])) $offer = ['plan' => carePlanOut((array) $qp['plan']), 'picked' => $qp['picked'] ?? null];
        out(['ok' => true, 'sub' => $s ? carePlanOut($s) : null, 'next' => $next, 'list' => $list, 'last' => $last, 'booked' => $booked, 'email' => $e, 'optin' => $opt ? !empty($opt['on']) : false, 'optinAt' => (int) ($opt['at'] ?? 0),
             'unsub' => $un ? (int) ($un['at'] ?? 0) : 0, 'pays' => array_slice(array_reverse($pays), 0, 6), 'offer' => $offer, 'canPay' => canTakePay() && payLinkOk(), 'plans' => array_map('carePlanOut', array_values(array_filter(carePlans(), fn($p) => empty($p['off']) && empty($p['starter']))))]);
    }
    if ($action === 'careenrol') {
        $post(); if (!desk()) fail('Not allowed.', 403);
        $P = carePlan((string) ($body['plan'] ?? '')); if (!$P) fail('Pick a plan.', 404);
        if (!empty($P['starter'])) fail('This is a starter example. Check it and save it in Setup, Plans first.');
        if (!empty($P['off'])) fail('That plan is switched off in Setup, Plans.');
        $cid = (string) ($body['cid'] ?? ''); $lid = (string) ($body['lead'] ?? '');
        if ($cid === '' && $lid !== '') { $mk = custFromLead($lid, $me); if (!$mk) fail('No such lead.', 404); $cid = (string) $mk['id']; }
        $c = loadCustomers()[$cid] ?? null; if (!$c) fail('No such customer.', 404);
        $start = (string) ($body['start'] ?? $today); if (!dateOk($start)) fail('Pick the day the plan starts.');
        if ($start < careAddDays($today, -366)) fail('The start is more than a year ago.');
        $price = $body['price'] ?? ''; if ($price === '' || $price === null) $price = $P['price']; elseif (!is_numeric($price) || $price <= 0 || $price > 100000) fail('Give their price.');
        $sub = array_intersect_key($P, array_flip(['name', 'services', 'freq', 'season', 'visits', 'per', 'notes'])) + ['plan' => $P['id'], 'price' => round((float) $price, 2), 'start' => $start, 'end' => null, 'src' => $lid !== '' ? 'quote' : 'customer', 'by' => $me, 'at' => time(), 'ended' => null];
        if ($lid !== '') $sub['lead'] = $lid;
        $c2 = $c; $c2['care'] = $sub; [, $next] = careState($c2);
        careCustWrite($cid, ['care' => $sub, 'planName' => $sub['name'], 'plan' => 'custom', 'every' => null, 'price' => $sub['price'], 'listPrice' => $P['price'] > $sub['price'] ? $P['price'] : null, 'includes' => implode("\n", (array) $sub['services']), 'next' => $next], $me);
        if (($c['lead'] ?? '') !== '') appendLine(leadsDir() . '/leadst.log', ['id' => (string) $c['lead'], 'note' => 'Put on the plan "' . $sub['name'] . '" (' . carePriceText($sub) . '), starting ' . careDayText($start) . '.', 'by' => $me, 'at' => time()]);
        out(['ok' => true, 'cid' => $cid, 'next' => $next]);
    }
    if ($action === 'careend') {
        $post(); if (!desk()) fail('Not allowed.', 403);
        $c = loadCustomers()[(string) ($body['cid'] ?? '')] ?? null; if (!$c) fail('No such customer.', 404);
        if (empty($c['care']) || !empty($c['care']['ended'])) fail('They are not on a plan.');
        careCustWrite($c['id'], ['care' => ['ended' => time(), 'endedBy' => $me] + $c['care'], 'plan' => 'oneoff', 'next' => null], $me);
        out(['ok' => true]);
    }
    /* the newsletter: a customer said yes (or no) */
    if ($action === 'careoptin') {
        $post(); if (!desk()) fail('Not allowed.', 403);
        $c = loadCustomers()[(string) ($body['cid'] ?? '')] ?? null; if (!$c) fail('No such customer.', 404);
        $on = !empty($body['on']); $e = careEmailOf($c);
        if ($on && $e === '') fail('Add their email first.');
        if ($on && careUnsub($e)) fail('They unsubscribed, so they are not added back from here. If they ask to get it again, they can reply to any newsletter.');
        careEdit('optin', function ($d) use ($c, $on, $me) { $d[$c['id']] = ['on' => $on, 'at' => time(), 'by' => $me]; return $d; });
        out(['ok' => true, 'optin' => $on]);
    }
    /* a payment link for one visit or one period: never charged by itself */
    if ($action === 'carepaylink') {
        $post(); if (!desk() || !canTakePay()) fail('Taking payments is not part of your role here.', 403);
        if (!payLinkOk()) fail('Connect Square or Stripe in Setup, Payments to make a payment link.');
        $c = loadCustomers()[(string) ($body['cid'] ?? '')] ?? null; if (!$c) fail('No such customer.', 404);
        [$s, $next] = careState($c); if (!$s) fail('They are not on a plan.');
        $per = (string) $s['per']; $amt = (float) $s['price'];
        if (isset($body['amount']) && $body['amount'] !== '') { if (!is_numeric($body['amount']) || $body['amount'] < 1 || $body['amount'] > 100000) fail('Pick an amount from $1.'); $amt = (float) $body['amount']; }
        $d = new DateTime(($next ?? $today) . ' 12:00', $tz);
        $label = $s['name'] . ' · ' . ($per === 'visit' ? 'visit on ' . $d->format('M j') : ($per === 'month' ? $d->format('F Y') : ($per === 'quarter' ? 'quarter from ' . $d->format('M j') : $d->format('Y'))));
        if (!throttleTake(rateFile('carepay|' . $me), 60, 3600)) fail('That is a lot of links in an hour. Try again later.', 429);
        $pl = payLink($label, (int) round($amt * 100), '', careEmailOf($c));
        if (!empty($pl['err'])) fail($pl['err'], 502);
        $row = ['id' => 'y' . bin2hex(random_bytes(5)), 'cid' => $c['id'], 'plan' => (string) $s['plan'], 'label' => $label, 'amt' => round($amt, 2), 'kind' => (string) ($pl['kind'] ?? ''), 'url' => (string) $pl['url'], 'ref' => (string) ($pl['order'] ?? ''), 'by' => $me, 'mailed' => false];
        $mailed = null;
        if (!empty($body['email'])) {
            $e = careEmailOf($c); if ($e === '') fail('They have no email. Copy the link or text it.');
            $B = kitBrand(); $t = ['subject' => 'Payment link: ' . $label, 'body' => "Hi {first_name},\n\nHere is the link to pay for " . $label . ' (' . careMoney($amt) . "): " . $pl['url'] . "\n\nThank you. Questions? Call or text {phone}.\n\n{company}"];
            $r = careSend($e, careRender($t, ['first_name' => mailFirst((string) ($c['name'] ?? '')) ?: 'there', 'company' => $B['name'], 'phone' => $B['phone']], $e));
            careLog(['kind' => 'pay', 'cid' => $c['id'], 'to' => $e, 'ok' => $r['ok'], 'stage' => $r['stage']]); $mailed = $r['ok']; $row['mailed'] = $r['ok'];
            if (!$r['ok']) { appendLine(DATA_DIR . '/care-pay.log', $row + ['at' => time()]); fail(($r['stage'] === 'config' ? 'Email is not connected (Setup, Email). ' : 'The email did not go: ' . $r['stage'] . '. ') . 'The link is made: copy it instead. ' . $pl['url'], 502); }
        }
        appendLine(DATA_DIR . '/care-pay.log', $row + ['at' => time()]);
        out(['ok' => true, 'url' => $pl['url'], 'label' => $label, 'amt' => round($amt, 2), 'mailed' => $mailed]);
    }
    /* plan visits due in the next three weeks with no job booked, for the Jobs board */
    if ($action === 'caredue') {
        if (!desk()) fail('Not allowed.', 403);
        $soon = careAddDays($today, 21); $o = [];
        foreach (loadCustomers() as $c) {
            if (empty($c['care']) || !empty($c['care']['ended'])) continue;
            [$s, $next, , , $booked] = careState($c); if (!$s || $next === null || $next > $soon || $booked !== null) continue;
            $o[] = ['cid' => $c['id'], 'name' => trim((string) ($c['name'] ?? '')) ?: 'Customer', 'plan' => (string) $s['name'], 'next' => $next, 'overdue' => $next < $today, 'price' => (float) $s['price'], 'per' => (string) $s['per'],
                    'services' => implode(', ', (array) $s['services']), 'addr' => trim((string) ($c['address'] ?? '') . ((string) ($c['town'] ?? '') !== '' ? ', ' . $c['town'] : ''), ', ')];
        }
        usort($o, fn($a, $b) => strcmp($a['next'], $b['next']));
        out(['ok' => true, 'due' => $o]);
    }
    /* a plan offered on the quote (or taken off it) */
    if ($action === 'careqset') {
        $post(); $lid = (string) ($body['lead'] ?? ''); $l = leadsAll()[$lid] ?? null; if (!$l) fail('No such lead.', 404);
        if (!desk() && !edRepLead($lid)) fail('Not allowed.', 403);
        $pid = (string) ($body['plan'] ?? '');
        if ($pid === '') { careEdit('qplans', function ($d) use ($lid) { unset($d[$lid]); return $d; }); out(['ok' => true, 'offer' => null]); }
        $P = carePlan($pid); if (!$P || !empty($P['starter']) || !empty($P['off'])) fail('Pick one of your saved plans.');
        $snap = array_intersect_key($P, array_flip(['id', 'name', 'services', 'freq', 'season', 'visits', 'price', 'per', 'notes']));
        careEdit('qplans', function ($d) use ($lid, $snap, $me) { $was = $d[$lid] ?? []; $d[$lid] = ['plan' => $snap, 'by' => $me, 'at' => time(), 'picked' => (($was['plan']['id'] ?? '') === $snap['id']) ? ($was['picked'] ?? null) : null]; return $d; });
        out(['ok' => true, 'offer' => ['plan' => carePlanOut($snap), 'picked' => null]]);
    }

    /* ---- Setup, Customer emails (the admin, or a role given it) ---- */
    if (!adminOr('set.care')) fail('Not allowed.', 403);
    $cfg = careCfg();
    if ($action === 'carecfg') {
        $ph = []; foreach (CARE_PH as $k => $m) foreach ($m as $p => $d) $ph[$k][] = [$p, $d];
        out(['ok' => true, 'cfg' => $cfg, 'def' => careCfgDefaults(), 'ph' => $ph, 'mail' => mailState() + ['to' => (string) (mailOwnCfg()['user'] ?? '')], 'review' => careReviewLink($cfg), 'companyReview' => function_exists('followupReview') ? followupReview() : '',
             'counts' => ['optin' => count(careNlRecipients()), 'unsub' => count(nlUnsubs()), 'today' => careSentToday()], 'caps' => ['run' => CARE_RUN_CAP, 'day' => CARE_DAY_CAP]]);
    }
    if ($action === 'carecfgset') {
        $post(); $part = (string) ($body['part'] ?? '');
        if (!in_array($part, ['fu', 'ac', 'nl'], true)) fail('Which part?');
        $new = careEdit('cfg', function ($d) use ($part, $body, $cfg, $me) {
            $c = $cfg[$part];
            if ($part === 'nl') { $a = careClean($body['address'] ?? '', 300); if ($a !== '' && mb_strlen($a) < 10) fail('Give the whole mailing address: street (or PO box), town, state and ZIP.'); $c['address'] = $a; }
            else {
                if (array_key_exists('on', $body)) { $on = !empty($body['on']); if ($on && empty($c['on'])) $c['onAt'] = time(); $c['on'] = $on; }
                if ($part === 'fu') {
                    foreach (['days' => [1, 30, 'The first follow-up: 1 to 30 days after the quote.'], 'gap' => [1, 30, 'Between follow-ups: 1 to 30 days.'], 'max' => [1, 5, 'Up to 5 follow-ups.']] as $k => [$lo, $hi, $say])
                        if (array_key_exists($k, $body)) { $v = $body[$k]; if (!is_numeric($v) || (int) $v != $v || $v < $lo || $v > $hi) fail($say); $c[$k] = (int) $v; }
                    if (isset($body['tpls'])) { $t = array_values(array_filter((array) $body['tpls'], 'is_array')); if (!$t || count($t) > 5) fail('One to five emails.'); $c['tpls'] = array_map(fn($x) => careTplClean('fu', $x), $t); }
                } else {
                    if (array_key_exists('hours', $body)) { $v = $body['hours']; if (!is_numeric($v) || (int) $v != $v || $v < 0 || $v > 72) fail('0 to 72 hours after the job is marked done.'); $c['hours'] = (int) $v; }
                    if (isset($body['tpls'])) {
                        $t = array_values(array_filter((array) $body['tpls'], 'is_array')); if (!$t || count($t) > 12) fail('One to twelve emails.');
                        $c['tpls'] = array_map(fn($x) => careTplClean('ac', $x, true), $t);
                        if (!array_filter($c['tpls'], fn($x) => trim((string) $x['match']) === '')) fail('Keep one email with no words to match: it goes when no other one fits.');
                    }
                    if (is_array($body['review'] ?? null)) {
                        $rv = $body['review']; $c['review']['on'] = !empty($rv['on']);
                        $lnk = trim((string) ($rv['link'] ?? '')); if ($lnk !== '' && !preg_match('#^https://[^\s<>"]{8,300}$#D', $lnk)) fail('The review link should start with https://');
                        $c['review']['link'] = $lnk; $ln = careClean($rv['line'] ?? '', 300); if ($ln === '') $ln = careCfgDefaults()['ac']['review']['line'];
                        if ($bad = careUnknownPh('ac', $ln)) fail('The review line cannot fill {' . implode('}, {', $bad) . '}.');
                        $c['review']['line'] = $ln;
                    }
                    if (!empty($body['reset'])) { $c['tpls'] = careCfgDefaults()['ac']['tpls']; }
                }
                if (!empty($body['reset']) && $part === 'fu') $c['tpls'] = careCfgDefaults()['fu']['tpls'];
            }
            $c['by'] = $me; $c['at'] = time(); $d[$part] = $c; return $d;
        });
        out(['ok' => true, 'cfg' => careCfg()]);
    }
    if ($action === 'carepreview' || $action === 'caretest') {
        $post(); $part = (string) ($body['part'] ?? '');
        if ($action === 'caretest') { if (!mailCfg()) fail('Connect your email first (Setup, Email).'); if (!throttleTake(rateFile('caretest|' . $me), 20, 3600)) fail('That is a lot of tests in an hour.', 429); }
        $to = (string) (mailOwnCfg()['user'] ?? '');
        $sampleL = ['id' => 'w00000000000000sample', 'name' => 'Alex Sample', 'email' => 'alex@example.com', 'phone' => '', 'quote' => ['price' => 1200, 'at' => time() - 2 * 86400, 'items' => [['t' => ucfirst(kitTrade()) . ' work', 'amt' => 1200]]]];
        if ($part === 'fu') { $t = careTplClean('fu', (array) ($body['tpl'] ?? [])); $m = careRender($t, careFuVals($sampleL), $to); }
        elseif ($part === 'ac') {
            $t = careTplClean('ac', (array) ($body['tpl'] ?? []), true); $rv = (array) ($body['review'] ?? $cfg['ac']['review']); $lnk = trim((string) ($rv['link'] ?? '')) ?: careReviewLink($cfg);
            $j = ['id' => 'jsample000000', 'lead' => '', 'title' => 'Alex Sample', 'svc' => (string) ($t['match'] !== '' ? trim(explode(',', $t['match'])[0]) : ''), 'date' => $today, 'note' => ''];
            $m = careRender($t, careAcVals($j, $sampleL, $lnk), $to, !empty($rv['on']) && $lnk !== '' ? careClean($rv['line'] ?? '', 300) : '');
        } elseif ($part === 'nl') {
            $is = ['subject' => careClean($body['subject'] ?? '', 150), 'pre' => careClean($body['pre'] ?? '', 200), 'body' => careClean($body['body'] ?? '', 20000)];
            if ($is['subject'] === '' || $is['body'] === '') fail('Give the issue a subject and words.');
            $m = careNlRender($is, $to, 'Alex Sample', $action === 'caretest');
        } else fail('Which email?');
        if ($action === 'carepreview') out(['ok' => true, 'subject' => $m[0], 'text' => $m[1], 'html' => $m[2]]);
        if ($part !== 'nl') $m[0] = '[Test] ' . $m[0];
        $r = careSend($to, $m); careLog(['kind' => $part, 'test' => true, 'to' => $to, 'ok' => $r['ok'], 'stage' => $r['stage']]);
        if (!$r['ok']) fail('The test did not go (' . $r['stage'] . '): ' . mb_substr((string) $r['error'], 0, 160), 502);
        out(['ok' => true, 'to' => $to]);
    }
    if ($action === 'carelog') {
        $rows = array_slice(array_reverse(jsonLines(DATA_DIR . '/care-mail.log')), 0, 60);
        out(['ok' => true, 'log' => array_map(fn($r) => array_intersect_key($r, array_flip(['kind', 'to', 'ok', 'stage', 'n', 'tpl', 'test', 'at', 'issue'])), $rows)]);
    }
    /* the newsletter's issues */
    if ($action === 'carenews') {
        $nx = (new DateTime('first day of next month 09:00', $tz))->format('Y-m-d H:i');
        out(['ok' => true, 'issues' => array_map('careNlOut', array_reverse(careNews())), 'address' => (string) $cfg['nl']['address'], 'mail' => (bool) mailCfg(), 'to' => (string) (mailOwnCfg()['user'] ?? ''),
             'recipients' => count(careNlRecipients()), 'unsub' => count(nlUnsubs()), 'templates' => careNlTemplates(), 'nextFirst' => $nx]);
    }
    if ($action === 'carenewsset') {
        $post(); $id = (string) ($body['id'] ?? '');
        $is = ['subject' => careClean($body['subject'] ?? '', 150), 'pre' => careClean($body['pre'] ?? '', 200), 'body' => careClean($body['body'] ?? '', 20000), 'send' => str_replace('T', ' ', careClean($body['send'] ?? '', 16))];
        if ($is['subject'] === '' || $is['body'] === '') fail('Give the issue a subject and words.');
        if (careNlTime($is['send']) === null) fail('Pick the day and time it goes.');
        $saved = null;
        careNewsEdit(function ($L) use ($id, $is, $me, &$saved) {
            if ($id === '') { if (count($L) >= 200) fail('Remove some old issues first.'); $saved = $is + ['id' => 'n' . bin2hex(random_bytes(5)), 'by' => $me, 'at' => time(), 'approved' => null, 'sent' => null]; $L[] = $saved; return $L; }
            foreach ($L as &$x) if ($x['id'] === $id) { if (!empty($x['sent'])) fail('This issue has started sending, so it cannot change.'); $x = array_merge($x, $is, ['by' => $me, 'at' => time()]); if (is_array($x['approved'] ?? null) && ($x['approved']['h'] ?? '') !== careNlHash($x)) $x['approved'] = null; $saved = $x; }
            unset($x); if (!$saved) fail('No such issue.', 404); return $L;
        });
        out(['ok' => true, 'issue' => careNlOut($saved)]);
    }
    if ($action === 'carenewsapprove' || $action === 'carenewsdel') {
        $post(); $id = (string) ($body['id'] ?? ''); $is = null; foreach (careNews() as $x) if ($x['id'] === $id) $is = $x;
        if (!$is) fail('No such issue.', 404);
        if (!empty($is['sent'])) fail('This issue has started sending.');
        if ($action === 'carenewsdel') { careNewsEdit(fn($L) => array_filter($L, fn($x) => $x['id'] !== $id)); out(['ok' => true]); }
        $on = !empty($body['on']);
        if ($on) {
            if (trim((string) $cfg['nl']['address']) === '') fail('Add your postal mailing address first (above). The law (CAN-SPAM) says every newsletter carries it, so nothing goes without it.');
            if (!mailCfg()) fail('Connect your email first (Setup, Email).');
            if (preg_match('/\[Write[^\]]*\]/i', $is['subject'] . $is['pre'] . $is['body'])) fail('Some of the template is still in it: change every "[Write ...]" to your own words first.');
            if ($bad = careUnknownPh('nl', $is['subject'] . $is['pre'] . $is['body'])) fail('The newsletter cannot fill {' . implode('}, {', $bad) . '}.');
            $w = careNlTime((string) $is['send']); if ($w === null) fail('Pick the day and time it goes.');
            if (!careNlRecipients()) fail('Nobody has said yes to the newsletter yet. Tick "Gets the newsletter" on each customer who said yes.');
        }
        careNewsEdit(function ($L) use ($id, $on, $me) { foreach ($L as &$x) if ($x['id'] === $id) $x['approved'] = $on ? ['by' => $me, 'at' => time(), 'h' => careNlHash($x)] : null; unset($x); return $L; });
        $x = null; foreach (careNews() as $y) if ($y['id'] === $id) $x = $y;
        out(['ok' => true, 'issue' => careNlOut($x), 'recipients' => count(careNlRecipients())]);
    }
    if ($action === 'carenewstest') {
        $post(); if (!mailCfg()) fail('Connect your email first (Setup, Email).');
        if (!throttleTake(rateFile('caretest|' . $me), 20, 3600)) fail('That is a lot of tests in an hour.', 429);
        $id = (string) ($body['id'] ?? ''); $is = null; foreach (careNews() as $x) if ($x['id'] === $id) $is = $x; if (!$is) fail('No such issue.', 404);
        $to = (string) (mailOwnCfg()['user'] ?? ''); $r = careSend($to, careNlRender($is, $to, 'Alex Sample', true));
        careLog(['kind' => 'nl', 'test' => true, 'issue' => $id, 'to' => $to, 'ok' => $r['ok'], 'stage' => $r['stage']]);
        if (!$r['ok']) fail('The test did not go (' . $r['stage'] . ').', 502);
        out(['ok' => true, 'to' => $to]);
    }
}

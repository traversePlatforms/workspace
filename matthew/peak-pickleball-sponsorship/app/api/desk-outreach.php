<?php
/* Claire reaches out for Matthew (2026-11-24, Matthew: "she contacts on my behalf"), and Bria too (2026-11-24, Matthew: "I need to add bria to
 * the peak desk and expo desk. So that way she can start doing some outreach as well"). The outreach role, one account per person, is the
 * research role and a little more:
 * she logs calls, voicemails, emails and other touches and notes on sponsor and expo cards, sets a follow-up, marks a person Don't contact,
 * flags a warm reply for Matthew, and sends desk emails from Peak Partnerships ONLY from the templates below once Matthew has approved them.
 * Whatever she starts is Matthew's: her touches carry for: Matthew Sharpe; a card nobody owns becomes his; a reply to an email she sent goes
 * to his My leads (inViaOf, desk-inbox.php, reads outreach.log for the send's 'for'). Her own name stays on everything she did, so the team
 * sees "Claire" or "Bria" on the card's Activity and in "by person", and Matthew's record shows who made the contact. The scripts say
 * "this is {me}": the desk fills in the caller's first name, so one set of words (and one approval) covers every outreach account.
 *
 * The lock: a card someone else on the team owns (Brandon, Cai, Nneka, Lance, anyone but Matthew), one whose address has an Inbox email
 * claimed or in Matthew's My leads, one past first contact (a tour, a proposal, signed, Not now, Lost), or one another outreach account has
 * already reached (a touch or a warm reply: Claire's card is not Bria's, and the other way round) is not hers to contact. She sees
 * "Someone on the team is working this one" and nothing about who.
 *
 * Her emails: at most OT_CAP a day each (counted per outreach account), Monday to Friday 9 am to 4 pm Colorado time (the Peak email sender's window), only to an address already
 * on the card, never to Don't contact or the do-not-email list (dmSend's own checks), only while desk emails are on. She picks the template
 * and the person; the words are the template's, with {first} and {company} filled in here. She never edits them.
 *
 * The templates' source is matthew/claire/peak/scripts/*-DRAFT.md (the desk test checks each text matches its file). Approval is Matthew's
 * alone, on his own login in the page (More, Outreach scripts): desk-settings.json otpl, kept with a hash of the words, so a change to the
 * words needs his OK again. outreach.log keeps every send, approval and warm reply. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const OT_CAP = 25;                      /* desk emails a day */
const OT_JV_MAIN = 'h202611181123486ccb';  /* Matthew's main J.A.R.V.I.S. thread (the Traverse desk's warm path uses the same one) */
const OT_TEAM = 'Someone on the team is working this one.';
const OT_ALONG = 'This one is past first contact, so it is Matthew’s or the team’s now.';
/* what the outreach account may do: the research account's actions, and these */
const OUTREACH_OK = ['data', 'note', 'site', 'scan', 'contact', 'contactedit', 'jvlist', 'touch', 'touchdel', 'next', 'dnc', 'osend', 'opreview', 'owarm'];
const OT_OWN = ['touch', 'touchdel', 'next', 'dnc', 'osend', 'opreview', 'owarm'];

/** the templates: k, name, kind (call | vm | email | note), world (sponsor | expo | both), file (its source), subject (emails), text */
function otTemplates(): array {
    return [
        ['k' => 'spcall', 'name' => 'Sponsor call script', 'kind' => 'call', 'world' => 'sponsor', 'file' => 'sponsor-call-script-DRAFT.md', 'subject' => '', 'text' =>
"Ask for the right person:
\"Hi, this is {me} with Peak Pickleball at Chapel Hills Mall. Could I speak with whoever looks after sponsorships or community partnerships for {company}?\"

When you reach them:
\"I work with Matthew Sharpe on Peak's local sponsors. Peak is the indoor pickleball center at Chapel Hills Mall in Colorado Springs: 24 courts on two levels, and players come in every day for open play, leagues, lessons and tournaments. We're growing our group of local sponsors and I thought {company} could be a good fit. Would you be open to a short call with Matthew, or a walk-through of the building, with no commitment?\"

If they say yes, want a tour or a call:
\"Great. Matthew will be in touch to set a time. What's the best number or email for you?\" Then tap Warm reply: hand it to Matthew.

If they ask what it costs, or what's included:
\"Matthew puts the options together after a short conversation, so I'll have him reach out.\" Never give a price, a package or a date.

If they want something in writing:
\"I'll email you a short note.\" Send the approved sponsor follow-up email from the desk.

If they say no:
\"No problem. Thanks for your time.\" Log it as Talked, with a note. Don't push.

If they ask not to be contacted again:
\"Will do.\" Tap Don't contact on that person."],
        ['k' => 'xcall', 'name' => 'Expo call script', 'kind' => 'call', 'world' => 'expo', 'file' => 'expo-call-script-DRAFT.md', 'subject' => '', 'text' =>
"Ask for the right person:
\"Hi, this is {me} with Peak Pickleball at Chapel Hills Mall. Could I speak with whoever plans the venues for {company}'s events?\"

When you reach them:
\"I work with Matthew Sharpe on events at Peak. Along with our 24 indoor courts, Peak rents the building for expos, markets and community events. It's about 80,000 square feet over two levels, and in April 2026 it hosted the Senior Lifestyle Expo with more than 100 vendors. If {company} is looking at venues for an upcoming show, would a short call with Matthew or a tour of the space be useful?\"

If they say yes, want a tour or a call:
\"Great. Matthew will be in touch to set a time. What's the best number or email for you?\" Then tap Warm reply: hand it to Matthew.

If they ask the rate, or about dates:
\"Matthew goes through rates and open dates with you directly, so I'll have him reach out.\" Never give a price, a rate or a date.

If they ask about parking, power, load-in or floor space:
\"Good question. I'll note it so Matthew has the answer when he calls.\" Write it in the note.

If they want something in writing:
\"I'll email you a short note.\" Send the approved expo follow-up email from the desk.

If they say no:
\"No problem. Thanks for your time.\" Log it as Talked, with a note. Don't push.

If they ask not to be contacted again:
\"Will do.\" Tap Don't contact on that person."],
        ['k' => 'spvm', 'name' => 'Sponsor voicemail', 'kind' => 'vm', 'world' => 'sponsor', 'file' => 'voicemails-DRAFT.md', 'subject' => '', 'text' =>
"\"Hi, this is {me} with Peak Pickleball, the indoor pickleball center at Chapel Hills Mall in Colorado Springs. I'm calling about {company} partnering with Peak as one of our local sponsors. I'll send a short email too. You can reach us at partnerships@peakpickleball.us, or call me back at [CALLBACK NUMBER: Matthew to give]. Thanks.\"

Then log it as Voicemail, and send the sponsor follow-up email if the card has an email."],
        ['k' => 'xvm', 'name' => 'Expo voicemail', 'kind' => 'vm', 'world' => 'expo', 'file' => 'voicemails-DRAFT.md', 'subject' => '', 'text' =>
"\"Hi, this is {me} with Peak Pickleball at Chapel Hills Mall in Colorado Springs. I'm calling about Peak as a venue for {company}'s events: we host expos, markets and community events. I'll send a short email too. You can reach us at partnerships@peakpickleball.us, or call me back at [CALLBACK NUMBER: Matthew to give]. Thanks.\"

Then log it as Voicemail, and send the expo follow-up email if the card has an email."],
        ['k' => 'spmail', 'name' => 'Sponsor follow-up email', 'kind' => 'email', 'world' => 'sponsor', 'file' => 'sponsor-follow-up-email-DRAFT.md', 'subject' => 'Peak Pickleball and {company}', 'text' =>
"Hi {first},

I'm following up about {company} partnering with Peak Pickleball, the indoor pickleball center at Chapel Hills Mall in Colorado Springs. We have 24 courts on two levels, and players come in every day for open play, leagues, lessons and tournaments.

We're growing our group of local sponsors. Depending on what you're after, that could mean your name on a court, a presence at our events and tournaments, or memberships for your team.

Would you be open to a short call, or a walk-through of the building with no commitment? You can see the space here: https://www.peakpickleball.us/

Thanks,"],
        ['k' => 'xmail', 'name' => 'Expo follow-up email', 'kind' => 'email', 'world' => 'expo', 'file' => 'expo-follow-up-email-DRAFT.md', 'subject' => 'Event space at Peak Pickleball', 'text' =>
"Hi {first},

I'm following up about Peak Pickleball as a venue for {company}'s events. Along with our 24 indoor courts at Chapel Hills Mall in Colorado Springs, we rent the building for expos, markets and community events. It's about 80,000 square feet over two levels, and in April 2026 it hosted the Senior Lifestyle Expo with more than 100 vendors.

If {company} is looking at venues for an upcoming show, would a short call or a tour work for you? Here's a look at the building: https://www.peakpickleball.us/

Thanks,"],
        ['k' => 'warm', 'name' => 'Warm reply: hand it to Matthew', 'kind' => 'note', 'world' => 'both', 'file' => 'warm-reply-handoff-DRAFT.md', 'subject' => '', 'text' =>
"When someone says yes, wants a tour or a call, or asks the price:

1. Don't quote a price, a package, a rate or a date. Don't book a tour time. Say: \"Matthew will be in touch to set that up. What's the best number or email for you?\"
2. Write down what they said, their name, and the best number or email.
3. Tap Warm reply: hand it to Matthew, and put those in the box. Matthew gets a J.A.R.V.I.S. alert straight away, and a follow-up for today goes on his desk.
4. Stop there. Matthew takes it from here. Don't call or email them again unless he asks you to.

If they replied by email, you won't see it: replies to your emails go to Matthew's My leads, and he answers them."],
    ];
}
function otHash(array $t): string { return substr(sha1($t['subject'] . "\n" . $t['text']), 0, 16); }
function otTpl(string $k): ?array { foreach (otTemplates() as $t) if ($t['k'] === $k) return $t; return null; }
/** approved: Matthew's switch is on, for these exact words */
function otOk(array $t): bool { $a = jread('desk-settings.json', [])['otpl'][$t['k']] ?? null; return is_array($a) && !empty($a['on']) && ($a['h'] ?? '') === otHash($t); }
/** the templates for the page: each with ok (approved) and, for Matthew, who switched it and when. Matthew sees {me} as written (it is
    what he approves); an outreach account ($me) sees its own first name in its place */
function otList(bool $owner, string $me = ''): array {
    $A = jread('desk-settings.json', [])['otpl'] ?? []; $o = [];
    foreach (otTemplates() as $t) {
        $x = ['k' => $t['k'], 'name' => $t['name'], 'kind' => $t['kind'], 'world' => $t['world'], 'subject' => $t['subject'], 'text' => $owner ? $t['text'] : otMe($t['text'], $me), 'ok' => otOk($t)];
        if ($owner) { $a = $A[$t['k']] ?? null; $x['file'] = 'matthew/claire/peak/scripts/' . $t['file']; $x['set'] = is_array($a) ? ['on' => !empty($a['on']), 'by' => (string) ($a['by'] ?? ''), 'at' => (int) ($a['at'] ?? 0), 'stale' => !empty($a['on']) && ($a['h'] ?? '') !== otHash($t)] : null; }
        $o[] = $x;
    }
    return $o;
}
/** Matthew's approve switch (his own login only; desk.php checks) */
function otSet(string $k, bool $on, string $me): array {
    $t = otTpl($k); if (!$t) fail('No such template.', 404);
    $s = jread('desk-settings.json', []); $now = time();
    $s['otpl'][$k] = ['on' => $on, 'h' => otHash($t), 'by' => $me, 'at' => $now];
    if (!jwrite('desk-settings.json', $s)) fail('The setting could not be saved.', 500);
    logAdd(['t' => 'approve', 'k' => $k, 'on' => $on, 'h' => otHash($t), 'by' => $me, 'at' => $now], OT_LOG);
    return ['ok' => true, 'otpl' => otList(true)];
}
/** the outreach accounts (Claire, Bria), for "by person" and the lock */
function otHelpers(): array { static $c = null; if ($c !== null) return $c; $o = []; foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) if (($a['role'] ?? '') === 'outreach' && (string) ($a['name'] ?? '') !== '') $o[(string) $a['name']] = 1; $o = array_keys($o); sort($o); return $c = $o; }
function otCap(): int { $e = inTestEnv('DESK_OUTREACH_CAP'); return ctype_digit($e) ? (int) $e : OT_CAP; }
/** the sending window: Monday to Friday, 9 am to 4 pm Colorado time */
function otInWindow(int $t): bool { $d = (int) date('N', $t); $h = (int) date('G', $t); return $d <= 5 && $h >= 9 && $h < 16; }
function otWindowOpen(): bool { return inTestEnv('DESK_OUTREACH_ANYTIME') !== '' || otInWindow(inNow()); }
function otSentToday(string $me): int {
    $from = (int) strtotime(date('Y-m-d', inNow()) . ' 00:00:00'); $n = 0;
    foreach (logRows(OT_LOG) as $r) if (($r['t'] ?? '') === 'osend' && strcasecmp((string) ($r['by'] ?? ''), $me) === 0 && !empty($r['ok']) && (int) ($r['at'] ?? 0) >= $from) $n++;
    return $n;
}
/** the addresses whose Inbox email (To answer or Waiting on them) someone has claimed, or that is one of Matthew's My leads */
function otClaimed(): array {
    $o = []; $all = inAll(); $S = inStates($all);
    foreach ($all as $R) { $x = $S[$R['iid']] ?? null; if (!$x || !in_array($x['b'], ['open', 'wait'], true)) continue; if (!empty($x['claim']) || ($x['lane'] ?? '') === 'me') $o[strtolower(trim((string) $R['from']))] = 1; }
    return $o;
}
/** '' when this outreach account ($me) may contact this card, else what it is told (never who) */
function otLockWhy(string $w, array $R, string $me, ?array $claimed = null): string {
    $own = (string) ($R['owner'] ?? ''); if ($own !== '' && !inIsOwner($own)) return OT_TEAM;
    /* another outreach account reached them first (a touch, an email, a warm reply): theirs, even though the card is Matthew's */
    $H = array_values(array_filter(otHelpers(), fn($n) => strcasecmp($n, $me) !== 0));
    if ($H) { $other = fn($by) => in_array(strtolower((string) $by), array_map('strtolower', $H), true);
        foreach ($R['touches'] ?? [] as $t) if ($other($t['by'] ?? '')) return OT_TEAM;
        foreach ($R['notes'] ?? [] as $n) if ($other($n['by'] ?? '') && str_starts_with((string) ($n['note'] ?? ''), 'Warm reply, for Matthew:')) return OT_TEAM; }
    $claimed ??= otClaimed(); foreach (recEmails($R) as $e) if (isset($claimed[$e])) return OT_TEAM;
    $rk = stageRank($w, (string) $R['stage']); if ($rk < 0 || $rk >= (int) W($w)['reach']) return OT_ALONG;
    return '';
}
/** the outreach account's view of a list: the research view, each card with its lock; a card the team has keeps its owner to itself */
function otView(string $w, array $V, string $me): array {
    $C = otClaimed(); $X = recs($w);
    foreach ($V['recs'] as &$r) { $R = $X[$r['id']] ?? null; $why = $R ? otLockWhy($w, $R, $me, $C) : OT_TEAM; $r['olock'] = $why; if ($why === OT_TEAM) $r['owner'] = ''; }
    unset($r); return $V;
}
/** what the page needs to know: the templates (with ok), today's count and the cap, the window, whether desk emails are on */
function otOut(string $me): array {
    return ['templates' => otList(false, $me), 'sent' => otSentToday($me), 'cap' => otCap(), 'window' => otWindowOpen(), 'windowText' => 'Monday to Friday, 9 am to 4 pm Colorado time', 'mailOn' => dmConf()['on'], 'for' => IN_OWNER];
}
/** fill {me}: the caller's first name (the outreach account signed in) */
function otMe(string $s, string $me): string { return str_replace('{me}', first_name(trim($me)) ?: 'me', $s); }
/** fill {first} and {company} */
function otFill(string $s, string $first, string $company): string { return str_replace(['{first}', '{company}'], [$first, $company], $s); }
function otFirst(string $name): string { $f = trim((string) strtok(trim($name), ' ')); return $f === '' || !preg_match('/^\p{L}[\p{L}\'.-]*$/u', $f) ? 'there' : $f; }

/** J.A.R.V.I.S. tells Matthew (the Traverse desk's warm path): a message on his main thread, which alerts his phone */
function otJv(string $text): bool {
    $tool = inTestEnv('DESK_JV_TOOL') ?: dirname(__DIR__, 3) . '/assistant-private/jvdesk.php';
    if (!is_file($tool)) return false;
    $p = @proc_open([deskPhp(), $tool, 'reply', OT_JV_MAIN, 'answered'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return false;
    fwrite($pipes[0], $text); fclose($pipes[0]); stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]);
    return proc_close($p) === 0;
}

/** her actions (desk.php sends them here for the outreach role) */
function otAct(string $action, bool $isPost, array $body, string $ME): array {
    if (!$isPost) fail('POST required', 405);
    $w = ($body['world'] ?? '') === 'expo' ? 'expo' : 'sponsor'; $id = (string) ($body['id'] ?? '');
    $R = needRec(recs($w), $w, $id);
    $lock = function (array $R) use ($w, $ME) { $why = otLockWhy($w, $R, $ME); if ($why !== '') fail($why, 409); };
    $mattOwns = in_array(IN_OWNER, owners($w), true);
    switch ($action) {
        case 'touch': {
            $m = (string) ($body['m'] ?? ''); $o = (string) ($body['out'] ?? '');
            $OK = ['call' => ['noanswer', 'talked', 'wrong'], 'voicemail' => ['left'], 'email' => ['sent'], 'other' => ['contacted']];
            if (!isset($OK[$m])) fail('Pick how you reached them: a call, a voicemail, an email or other.');
            if (!in_array($o, $OK[$m], true)) fail('Pick how it went.');
            $fu = (string) ($body['fu'] ?? ''); if ($fu !== '' && (!okDay($fu) || $fu < date('Y-m-d'))) fail('Pick a follow-up day from today on.');
            $note = clean($body['note'] ?? '', 600); $fuWhat = clean($body['fuWhat'] ?? '', 160);
            $tpl = clean($body['tpl'] ?? '', 40); if ($tpl !== '' && !otTpl($tpl)) $tpl = '';
            return withLock(function () use ($w, $id, $m, $o, $fu, $note, $fuWhat, $tpl, $ME, $lock, $mattOwns) {
                sync($w, true); $R = recs($w)[$id]; $lock($R); $now = time(); $k = newKey();
                $touch = ['m' => $m, 'out' => $o, 'note' => $note, 'when' => $now, 'for' => IN_OWNER] + ($tpl !== '' ? ['tpl' => $tpl] : []);
                $rows = touchRows($w, $R, $k, $touch, $ME, false, $fu, $fuWhat, $now);
                if ((string) $R['owner'] === '' && $mattOwns) $rows[] = rowOwner($w, $id, IN_OWNER, $ME, $now);
                commit($w, $rows); $R = recs($w)[$id];
                return ['ok' => true, 'k' => $k, 'stage' => $R['stage'], 'owner' => $R['owner'], 'tries' => missCount($R)];
            });
        }
        case 'touchdel': {   /* her own touches only */
            $k = (string) ($body['k'] ?? ''); $t = null; foreach ($R['touches'] as $x) if ($x['k'] === $k) $t = $x;
            if (!$t) fail('No such touch.', 404);
            if (strcasecmp((string) $t['by'], $ME) !== 0) fail('You can remove only what you logged.', 403);
            return withLock(fn() => act('touchdel', $w, ['id' => $id, 'k' => $k], $ME, false));
        }
        case 'next': $lock($R); return withLock(fn() => act('next', $w, ['id' => $id, 'date' => (string) ($body['date'] ?? ''), 'what' => (string) ($body['what'] ?? '')], $ME, false));
        case 'dnc': {   /* she may mark a person Don't contact (they asked); only an admin or a seller takes it off */
            if (array_key_exists('on', $body) && empty($body['on'])) fail('Only Matthew or a seller takes a Don’t contact mark off.', 403);
            return withLock(fn() => act('dnc', $w, ['id' => $id, 'key' => (string) ($body['key'] ?? ''), 'on' => true, 'why' => (string) ($body['why'] ?? '')], $ME, false));
        }
        case 'opreview': case 'osend': {
            $t = otTpl((string) ($body['tpl'] ?? '')); if (!$t || $t['kind'] !== 'email') fail('Pick one of the emails.', 404);
            if ($t['world'] !== $w) fail('That email is for the ' . ($t['world'] === 'expo' ? 'expo leads' : 'sponsors') . '.');
            $to = strtolower(clean($body['to'] ?? '', 160));
            $P = people($w, $R + ['scan' => $w === 'sponsor' ? (jread('scans.json', [])[$id] ?? []) : []]); $p = null;
            foreach ($P as $x) if ($to !== '' && strtolower((string) ($x['email'] ?? '')) === $to) { $p = $x; break; }
            if (!$p) fail('Pick who it goes to from the people on the card.');
            $first = otFirst((string) ($p['name'] ?? '')); $company = trim((string) $R['name']);
            $subject = otFill(otMe($t['subject'], $ME), $first, $company); $text = otFill(otMe($t['text'], $ME), $first, $company);
            if ($action === 'opreview') return ['ok' => true, 'to' => $to, 'name' => (string) ($p['name'] ?? ''), 'subject' => $subject, 'text' => $text, 'sig' => dmMine($ME)['sig'], 'footer' => DM_FOOTER, 'approved' => otOk($t)];
            if (!otOk($t)) fail('Draft: waiting for Matthew’s OK. It can’t be sent until he approves it.', 403);
            if (!dmConf()['on']) fail('Desk emails are off. They turn on once Matthew says go.', 409);
            if (!otWindowOpen()) fail('Your emails go Monday to Friday, 9 am to 4 pm Colorado time. Log it and set a follow-up instead.', 409);
            $lock($R);
            $fu = (string) ($body['fu'] ?? ''); if ($fu !== '' && (!okDay($fu) || $fu < date('Y-m-d'))) fail('Pick a follow-up day from today on.');
            $lk = fopen(DATA_DIR . '/outreach.lock', 'c'); if (!$lk) fail('The desk hit a problem. Try again.', 500); flock($lk, LOCK_EX);
            try {
                if (otSentToday($ME) >= otCap()) fail('That is ' . otCap() . ' emails today, the most in a day. The rest wait for tomorrow.', 429);
                if (inLockFor($to, $ME)) fail(OT_TEAM, 409);
                /* Matthew's Peak email list reached them lately: the card already tells the sellers not to email again unless they reply */
                foreach (inSends() ?? [] as $y) if ($y['k'] === 'sent' && $y['to'] === $to && $y['at'] > inNow() - 14 * 86400) fail('Matthew emailed them from the Peak email list on ' . date('M j', $y['at']) . '. Call instead, or wait for their reply.', 409);
                $x = dmSend($w, $R, ['to' => $to, 'name' => (string) ($p['name'] ?? ''), 'subject' => $subject, 'text' => $text, 'tpl' => 'o-' . $t['k'], 'fu' => $fu, 'fuWhat' => clean($body['fuWhat'] ?? '', 160)], $ME, ['for' => IN_OWNER, 'otpl' => $t['k'], 'oh' => otHash($t)]);
                if (empty($x['ok'])) fail((string) $x['error']);
                $sent = in_array($x['state'] ?? '', ['sent', 'dup'], true);
                logAdd(['t' => 'osend', 'ref' => (string) $x['ref'], 'for' => IN_OWNER, 'w' => $w, 'id' => $id, 'to' => $to, 'tpl' => $t['k'], 'h' => otHash($t), 'ok' => $sent, 'state' => (string) ($x['state'] ?? ''), 'by' => $ME, 'at' => inNow()], OT_LOG);
            } finally { flock($lk, LOCK_UN); fclose($lk); }
            if ($sent && $mattOwns) withLock(function () use ($w, $id, $ME) { sync($w, true); $R = recs($w)[$id]; if ((string) $R['owner'] === '') commit($w, [rowOwner($w, $id, IN_OWNER, $ME, time())]); });
            return $x + ['sentToday' => otSentToday($ME), 'cap' => otCap()];
        }
        case 'owarm': {
            $n = clean($body['note'] ?? '', 600); if ($n === '') fail('Say what they said, and the best number or email, so Matthew knows where it stands.');
            if (otLockWhy($w, $R, $ME) === OT_TEAM) fail(OT_TEAM, 409);
            $res = withLock(function () use ($w, $id, $n, $ME, $mattOwns) {
                sync($w, true); $R = recs($w)[$id]; $now = time(); $T = W($w)['T'];
                $rows = [['t' => $T['note'], 'id' => $id, 'note' => 'Warm reply, for Matthew: ' . $n, 'by' => $ME, 'at' => $now],
                    rowNext($w, $id, ['date' => date('Y-m-d'), 'what' => 'Warm reply (' . first_name($ME) . '): get back to them'], $ME, $now)];
                if ((string) $R['owner'] === '' && $mattOwns) $rows[] = rowOwner($w, $id, IN_OWNER, $ME, $now);
                commit($w, $rows); return $R;
            });
            $txt = 'Warm reply on the Peak desk, from ' . $ME . ' (for you): ' . $res['name'] . ($w === 'expo' ? ' (expo lead)' : ' (sponsor)') . ".\n\n" . $n . "\n\nOpen the card: " . DESK_URL . '#card/' . $w . '/' . $id;
            $al = otJv($txt);
            alertNew('ow:' . $w . ':' . $id . ':' . inNow(), 'reply', $res['name'] . ': warm reply from ' . first_name($ME), './#card/' . $w . '/' . $id, inOwnerWho());
            logAdd(['t' => 'warm', 'w' => $w, 'id' => $id, 'alerted' => $al, 'by' => $ME, 'at' => inNow()], OT_LOG);
            return ['ok' => true, 'alerted' => $al];
        }
    }
    fail('Unknown action.', 404); return [];
}

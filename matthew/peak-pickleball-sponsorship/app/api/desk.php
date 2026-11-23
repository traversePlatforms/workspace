<?php
/* Peak Sponsor Desk (2026-10-21, Matthew: "my job is to build this out"; "its own interface ... just making it into what we need soley to do
 * this job"). Brandon's team works the sponsor leads and the expo leads: who to reach, every call, voicemail, email and text, tours at
 * Peak, proposals and quotes, signed sponsors, a report.
 *
 * 2026-11-17 rebuild (Matthew: "treat it like a pipeline similiar to sixfold ... there no a spot to select emailed ... whatever we do with
 * the peak sponsor deck needs to happen in the expo section as well"): both lists are pipelines with the same tools.
 *   Sponsors: To contact, Called, Left voicemail, Emailed, Texted, Meeting / tour booked, Proposal sent, Signed; Not now (a day to come
 *             back), Lost (a reason).
 *   Expo:     To contact, Contacted, Tour booked, Quote sent, Booked; Not now, Lost.
 * Every touch is logged (how, who, when, how it went, a note, a follow-up) and moves a company along while it is still being reached. Each
 * company has an owner (one of the sellers) or is Open. The records live in desk.sqlite; the append-only logs stay the permanent record
 * (desk-store.php explains). The expo leads stay a world of their own: their own log, their own counts, never in the sponsor views.
 *
 * Sign-in: a 6-digit code per person, kept hashed. admin = Matthew; seller = Brandon, Nneka, Lance, Cai: the same screens and powers; expo =
 * the Expo leads only, enforced here; Claude Check reads and saves nothing. Who can sign in is changed on the server only:
 *   php desk.php addaccount "Name" admin|seller|expo|research   (prints the code once)
 * research (2026-11-21, Claire; Matthew: "start her on ... the peak lead research"): looks companies up and writes down what she finds,
 * and nothing else (RESEARCH_OK below, enforced here for the page and for php desk.php as).
 *   php desk.php newcode "Name"                          (a lost code: a new one, same role)
 * Look-ups (2026-10-24): php desk.php rescan [15] (hourly, from the morning-email cron) | scan <lead id> [--hunter]
 * The records: php desk.php rebuild | check
 * The Peak email sender (2026-11-17): php desk.php servicekey "Peak email" (prints its key once) | emailed sponsor|expo <id> <to> [subject]
 *   | replied sponsor|expo <id> <from> [note] | bounced sponsor|expo <id> <to> [note]   (HTTP: actions emailed / emailreply / emailbounce
 *   with the X-Desk-Key header)
 *
 * 2026-11-18 (Matthew: "Lets add some stuff to the peak desk that we use in sixfold that works well for us in terms of reaching out to
 * clients"): message templates (admins edit them), the call-tries rule (4 tries, then a last message and Not now for 60 days), Priority 5 on
 * Today, duplicate warnings when a company or contact is added, Don't contact per person, a private calendar feed per person, and an
 * end-of-day email to the desk team (OFF until an admin turns it on in More, Settings):
 *   php desk.php eod [--dry-run] [--force]   (the hourly rescan also runs it: it sends once, 6 pm Colorado time, Monday to Friday)
 *
 * 2026-11-18 (Matthew: "we need a way to edit contacts that we add ... cai added a contact and she spelt the email wrong ... we all do"):
 * Edit and Remove on every person on a card, both lists, for everyone with a desk login (actions contactedit / contactdel; rows
 * contactedit / contactdel and xcontactedit / xcontactdel). A person is found by their person key (plus n when two share one). An edit keeps
 * their Don't contact mark (carried to the new key) and the company's email marks; desk-store.php explains. From the server:
 *   php desk.php contactdel sponsor|expo <id> <person key> [--dnc-off] [--dry-run] [--by "Name"]
 *
 * 2026-11-19 (Matthew: "when for example, cai books a tour ... send an email automatically to that persons email ... so they have an email
 * notification that they can connect to their calendar"): tour confirmation emails with a calendar invite, sent through the Peak email
 * sender, OFF until an admin turns them on in More, Settings. tour-mail.php explains (actions tourpreview, tourmail, tourmailset, tourmailtest).
 *
 * 2026-11-19 (Matthew for Cai: "a box in the peak desk app ... she can fill it out with whatever she wants to say click send and it will send
 * it to the prospect" and "they can click a link and book a time slot based on the availability"): Write an email on every card
 * (desk-email.php: actions dmpreview, dmsend, dmretry, dmset; myset for a person's signature and reply address) and booking links on one
 * shared schedule (book-lib.php, the public page book.php: actions booklink, bookgeneric, bookset). Both OFF until an admin turns them on.
 *
 * 2026-11-19 evening (Matthew set up the shared mailbox Peak Partnerships): every Peak email goes out as Peak Partnerships
 * <partnerships@peakpickleball.us> (set in Outbox; shown read only in More, Settings), and the Peak email sender reads replies, bounces,
 * auto-replies and STOP from its Inbox onto the card: the reply's own words, its attachments by name, for everyone with a desk sign-in, with
 * a Reply button that answers in the same thread (desk-email.php). The page never gets a message's id or mailbox, only the touch's key.
 *
 * 2026-11-20 (Matthew: "I think the inbox tab is better but i dont think we currently have any notification that an email reply has
 * happened"): the Inbox tab (every email in Peak Partnerships' Inbox, read every 5 minutes: Reply, Attach to a company, Claim, Done) and
 * alerts (Web Push to the desk app per device, an optional email heads-up), desk-inbox.php explains (actions inbox, inboxone, inboxfile,
 * inboxclaim, inboxdone, inboxattach, inboxreply, pushkey, pushsub, pushunsub, alertset, alerttest).
 *   php desk.php alerts      deliver the alerts that are due (the 5-minute and the hourly runs do this)
 *   php desk.php inboxcount  how many emails are open, done and Other (counts only) */
declare(strict_types=1);
define('DESK', 1);
const BUILD = '2026-11-21.2';
const DESK_URL = 'https://traverseplatforms.com/peak-desk-28d38d/';
const EOD_HOUR = 18;   /* the end-of-day email: 6 pm Colorado time */
/* what the research account may do (2026-11-21, handleIn explains) */
const RESEARCH_OK = ['data', 'note', 'site', 'scan', 'contact', 'contactedit', 'jvlist'];
$LOCAL = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
require __DIR__ . '/desk-store.php';
if (!is_dir(DATA_DIR)) { if ($LOCAL) @mkdir(DATA_DIR, 0770, true); else { http_response_code(500); exit('{"ok":false,"error":"No data folder."}'); } }
require __DIR__ . '/scan.php';
require __DIR__ . '/tour-mail.php';   /* tour confirmation emails (2026-11-19) */
require __DIR__ . '/book-lib.php';    /* booking links on one shared schedule (2026-11-19) */
require __DIR__ . '/desk-email.php';  /* Write an email on a card (2026-11-19) */

function codeHash(string $c): string { return hash('sha256', 'peakdesk|' . $c); }
function keyHash(string $c): string { return hash('sha256', 'peakdesk-service|' . $c); }
/* how long a sign-in lasts: 60 days, a rolling year for Matthew (2026-11-13, his account only) */
function sesDays(string $name): int { return strcasecmp($name, 'Matthew Sharpe') === 0 ? 365 : 60; }
function sesCookie(string $tok, string $name, int $now): void {
    setcookie('peakdesk', $tok, ['expires' => $now + sesDays($name) * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
}
/* ---- the command line ---- */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'seller'];
    $json = fn($v) => print(json_encode($v, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller', 'expo', 'research'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    /* a fresh code for someone who lost theirs (2026-11-13, Matthew): their old code stops working, their role stays, their sign-ins stay */
    if ($cmd === 'newcode' && $name !== '') {
        $acc = jread('accounts.json', ['codes' => []]); $old = null;
        foreach ($acc['codes'] as $h => $a) if (strcasecmp((string) $a['name'], $name) === 0) { $old = $a; unset($acc['codes'][$h]); }
        if (!$old) { fwrite(STDERR, "No account named $name.\n"); exit(1); }
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => $old['name'], 'role' => $old['role'], 'at' => time()];
        jwrite('accounts.json', $acc); echo "New code for {$old['name']} ({$old['role']}): $code\n"; exit(0);
    }
    /* a key for a program on this server that writes to the desk (the Peak email sender); kept hashed, printed once */
    if ($cmd === 'servicekey' && $name !== '') {
        $sk = jread('service-keys.json', []); $key = bin2hex(random_bytes(24));
        foreach ($sk as $h => $x) if (strcasecmp((string) $x['name'], $name) === 0) unset($sk[$h]);
        $sk[keyHash($key)] = ['name' => clean($name, 40), 'at' => time()]; jwrite('service-keys.json', $sk);
        echo "Key for $name: $key\n"; exit(0);
    }
    /* the hourly run: the end-of-day email first (it only sends when it is on and due), then the look-ups */
    if ($cmd === 'rescan') { try { $e = eodRun(time()); if ($e['sent'] || $e['failed']) echo date('Y-m-d H:i') . ' eod: ' . $e['said'] . "\n"; } catch (Throwable $x) { echo 'eod: ' . $x->getMessage() . "\n"; } exit(rescanDue(max(1, min(60, (int) ($name ?: 15))))); }
    if ($cmd === 'eod') {
        $now = ctype_digit((string) getenv('DESK_NOW')) ? (int) getenv('DESK_NOW') : time();   /* the tests pick the hour */
        if (in_array('--dry-run', $argv, true)) { $m = eodText($now); echo 'Due: ' . (eodDue($now) ?: 'yes') . "\nTo: " . (implode(', ', eodConf()['to']) ?: '(nobody yet)') . "\nSubject: " . $m['subject'] . "\n\n" . $m['text'] . "\n"; exit(0); }
        $e = eodRun($now, in_array('--force', $argv, true)); echo $e['said'] . "\n"; exit($e['failed'] ? 1 : 0);
    }
    if ($cmd === 'scan' && $name !== '') {
        $L = recs('sponsor')[$name] ?? null; if (!$L) { fwrite(STDERR, "No such lead.\n"); exit(1); }
        $json(scanAndSave($L, in_array('--hunter', $argv, true) ? 'hunter' : 'site')); exit(0);
    }
    if ($cmd === 'alerts') { $now = ctype_digit((string) getenv('DESK_NOW')) ? (int) getenv('DESK_NOW') : time(); $json(alertsFlush($now)); exit(0); }
    if ($cmd === 'inboxcount') { $json(inCounts()); exit(0); }
    if ($cmd === 'rebuild') { foreach (['sponsor', 'expo'] as $w) echo "$w: rebuilt from the lists and " . rebuild($w) . " log rows\n"; exit(0); }
    /* the counts a migration or deploy is checked against */
    if ($cmd === 'check') {
        $o = [];
        foreach (['sponsor', 'expo'] as $w) {
            $R = recs($w); $st = []; $ct = 0; $tc = 0; $own = 0;
            foreach ($R as $r) { $st[$r['stage']] = ($st[$r['stage']] ?? 0) + 1; $ct += count($r['contacts'] ?? []) + count($r['added'] ?? []); $tc += count($r['touches'] ?? []); if ($r['owner'] !== '') $own++; }
            ksort($st);
            $o[$w] = ['companies' => count($R), 'removed' => count(array_filter($R, fn($r) => !empty($r['off']))), 'contacts' => $ct, 'touches' => $tc, 'owned' => $own, 'stages' => $st,
                'tours' => count(toursOf($w)), 'logRows' => count(logRows(W($w)['log']))];
        }
        $json($o); exit(0);
    }
    if (in_array($cmd, ['emailed', 'replied', 'bounced'], true) && in_array($name, ['sponsor', 'expo'], true) && ($argv[3] ?? '') !== '') {
        [$a3, $a4, $a5] = [(string) $argv[3], (string) ($argv[4] ?? ''), (string) ($argv[5] ?? '')];
        $r = $cmd === 'emailed' ? deskEmailed($name, $a3, $a4, $a5) : ($cmd === 'replied' ? deskReplied($name, $a3, $a4, $a5) : deskBounced($name, $a3, $a4, $a5));
        $json($r); exit($r['ok'] ? 0 : 1);
    }
    /* remove one person from a card, from the server (2026-11-18, Matthew's test contact on Coca-Cola): the same row as the card's Remove.
       --dnc-off also takes off a Don't contact mark that only the test set; --dry-run shows the rows and writes nothing. */
    if ($cmd === 'contactdel' && in_array($name, ['sponsor', 'expo'], true) && ($argv[3] ?? '') !== '' && ($argv[4] ?? '') !== '') {
        $bi = array_search('--by', $argv, true); $by = $bi !== false ? clean($argv[$bi + 1] ?? '', 60) : ''; if ($by === '') $by = 'Desk admin';
        [$cid, $ckey] = [(string) $argv[3], (string) $argv[4]];
        $res = withLock(function () use ($name, $cid, $ckey, $by, $argv) {
            sync($name, true); $R = recs($name)[$cid] ?? null; if (!$R) return ['ok' => false, 'error' => 'No such lead.'];
            $now = time(); $row = contactDelRow($name, $R, $ckey, 0, $by, $now); if (!$row) return ['ok' => false, 'error' => 'No such contact on this card.'];
            $rows = [];
            if (in_array('--dnc-off', $argv, true) && isset(($R['dnc'] ?? [])[$ckey])) $rows[] = ['t' => W($name)['T']['dnc'], 'id' => $cid, 'key' => $ckey, 'on' => false, 'why' => '', 'by' => $by, 'at' => $now];
            $rows[] = $row;
            if (in_array('--dry-run', $argv, true)) return ['ok' => true, 'dry' => true, 'rows' => $rows];
            commit($name, $rows); return ['ok' => true, 'rows' => $rows];
        });
        $json($res); exit($res['ok'] ? 0 : 1);
    }
    /* J.A.R.V.I.S. does a person's desk work (2026-11-21, Matthew: "The goal is to have jarvis handle a lot of the tasks that they would reach
       out to me about"): one desk action as that person, through the same code as their button, with their role and its limits:
         php desk.php as "<Name>" <action> < body.json        (prints the action's answer as JSON; exit 0 when ok)
       Every row it writes carries via: "J.A.R.V.I.S." (desk-store.php commit). Never here, whoever asks (exit 3, "REFUSED: ..."): sending any
       email (desk emails, retries, tour confirmations, Inbox replies, tests), the booking-link and tour-confirmation and desk settings, the
       email sender's own calls, prices and money (packages, proposals, signed deals, sponsors added as signed, profit and loss), paid look-ups
       (Hunter), and a person's devices, alerts and calendar link. A tour booked, moved or cancelled through here never emails the visitor. */
    if ($cmd === 'as' && $name !== '' && ($argv[3] ?? '') !== '') {
        $act = (string) $argv[3]; $who = null;
        foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) if (strcasecmp((string) ($a['name'] ?? ''), $name) === 0) $who = $a;
        $refuse = function (string $m) { echo 'REFUSED: ', $m, "\n"; exit(3); };
        if (!$who || (string) $who['name'] === 'Claude Check') $refuse('no desk account named ' . $name);
        $NO = ['dmsend' => 'sending an email', 'dmretry' => 'sending an email', 'tourmail' => 'sending a tour confirmation', 'tourmailtest' => 'sending a test email', 'inboxreply' => 'sending an email reply',
            'dmset' => 'the desk email settings', 'bookset' => 'the booking-link rules', 'bookgeneric' => 'the booking links', 'booklink' => 'the booking links', 'tourmailset' => 'the tour confirmation settings', 'settings' => 'the desk settings',
            'emailed' => 'the email sender\'s records', 'emailreply' => 'the email sender\'s records', 'emailbounce' => 'the email sender\'s records',
            'packages' => 'prices and packages', 'proposal' => 'prices in a proposal', 'signed' => 'a signed deal\'s money', 'sponsor' => 'a signed deal\'s money', 'pl' => 'profit and loss',
            'pushsub' => 'a person\'s devices', 'pushunsub' => 'a person\'s devices', 'alertset' => 'a person\'s alerts', 'alerttest' => 'a person\'s alerts', 'callink' => 'a person\'s calendar link', 'pushkey' => 'the alert key',
            'signin' => 'signing in', 'signout' => 'signing out', 'jvsend' => 'the chat', 'jvclose' => 'the chat', 'jvlist' => 'the chat', 'jvfile' => 'the chat', 'calfeed' => 'the calendar feed', 'inboxfile' => 'downloads'];
        if (isset($NO[$act])) $refuse($NO[$act] . ' stays with Matthew');
        $body = json_decode((string) stream_get_contents(STDIN), true); $body = is_array($body) ? $body : [];
        if ($act === 'scan' && !empty($body['hunter'])) $refuse('paid look-ups (Hunter) stay with Matthew');
        if (in_array($act, ['tour', 'tourmove', 'tourdel'], true)) $body['mail'] = false;   /* never an email from here */
        $read = in_array($act, ['data', 'inbox', 'inboxone', 'tourpreview', 'dmpreview', 'eodpreview'], true);
        if ($read) foreach ($body as $k => $v) if (is_scalar($v)) $_GET[$k] = (string) $v;
        define('DESK_VIA', 'J.A.R.V.I.S.');
        try { $r = handleIn($act, !$read, $body, (string) $who['name'], (string) $who['role']); $json($r); exit(empty($r['ok']) ? 1 : 0); }
        catch (DeskFail $e) { $json(['ok' => false, 'error' => $e->getMessage(), 'code' => $e->getCode()]); exit(1); }
    }
    fwrite(STDERR, "usage: php desk.php as \"Name\" <action> < body.json | addaccount \"Name\" admin|seller|expo|research | newcode \"Name\" | servicekey \"Name\" | rescan [n] | scan <lead id> [--hunter] | rebuild | check | emailed sponsor|expo <id> <to> [subject] | replied sponsor|expo <id> <from> [note] | bounced sponsor|expo <id> <to> [note] | contactdel sponsor|expo <id> <person key> [--dnc-off] [--dry-run] [--by \"Name\"]\n");
    exit(1);
}

/* ---- the web ---- */
final class DeskFail extends Exception {}
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function out(array $a): void { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400): void { throw new DeskFail($m, $code); }
$action = (string) ($_GET['action'] ?? '');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
try { out(handle($action, $isPost, is_array($body) ? $body : [])); }
catch (DeskFail $e) { http_response_code($e->getCode() ?: 400); out(['ok' => false, 'error' => $e->getMessage()]); }
catch (Throwable $e) { error_log('peak desk: ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine()); http_response_code(500); out(['ok' => false, 'error' => 'The desk hit a problem. Try again.']); }

function handle(string $action, bool $isPost, array $body): array {
    /* the Peak email sender: a key instead of a sign-in (2026-11-17) */
    $key = (string) ($_SERVER['HTTP_X_DESK_KEY'] ?? '');
    if ($key !== '' && in_array($action, ['emailed', 'emailreply', 'emailbounce'], true)) {
        if (!$isPost) fail('POST required', 405);
        $svc = jread('service-keys.json', [])[keyHash($key)] ?? null; if (!$svc) fail('That key did not work.', 401);
        return service($action, $body, (string) $svc['name']);
    }
    /* a person's calendar (2026-11-18, Sixfold's walk feed): Google and Apple fetch it themselves, so the link carries the person and a token */
    if ($action === 'calfeed') calFeed((string) ($_GET['p'] ?? ''), (string) ($_GET['t'] ?? ''));
    if ($isPost && ($_SERVER['HTTP_X_DESK'] ?? '') !== '1') fail('Bad request.', 400);   /* a plain form post from another site cannot set this header */

    /* ---- sign-in ---- */
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($action === 'signin') {
        if (!$isPost) fail('POST required', 405);
        $tries = jread('tries.json', []); $now = time();
        $mine = array_values(array_filter($tries[$ip] ?? [], fn($t) => $t > $now - 900));
        if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
        /* the whole desk pauses after 100 wrong codes in an hour from anywhere, so many addresses can't share the guessing (security check 2026-10-25) */
        $recent = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $recent += count($tries[$k]); }
        if ($recent >= 100) fail('Sign-in is paused for a while after too many wrong codes. Try again later.', 429);
        $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
        $acc = jread('accounts.json', ['codes' => []]); $a = $acc['codes'][codeHash($code)] ?? null;
        if (!$a || strlen($code) !== 6) { $mine[] = $now; $tries[$ip] = $mine; jwrite('tries.json', $tries); fail('That code did not work.', 401); }
        $tok = bin2hex(random_bytes(24)); $ses = jread('sessions.json', []);
        foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - sesDays((string) ($s['name'] ?? '')) * 86400) unset($ses[$k]);
        $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; jwrite('sessions.json', $ses);
        sesCookie($tok, (string) $a['name'], $now);
        return ['ok' => true, 'name' => $a['name'], 'role' => $a['role']];
    }
    $ses = jread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['peakdesk'] ?? '')); $me = $ses[$tokH] ?? null;
    if (!$me) fail('Signed out.', 401);
    /* Matthew stays signed in (2026-11-13: "i also need to stay logged in"): a year from his last use, renewed at most once a day */
    if (sesDays((string) $me['name']) > 60 && (int) ($me['at'] ?? 0) < time() - 86400) {
        $ses[$tokH]['at'] = time(); jwrite('sessions.json', $ses); sesCookie((string) $_COOKIE['peakdesk'], (string) $me['name'], time());
    }
    $ME = (string) $me['name']; $ROLE = (string) ($me['role'] ?? '');
    if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('peakdesk', '', ['expires' => 1, 'path' => '/']); return ['ok' => true]; }
    if ($action === 'me') return ['ok' => true, 'name' => $ME, 'role' => $ROLE];
    return handleIn($action, $isPost, $body, $ME, $ROLE);
}
/* everything after the sign-in: the page's calls, and (2026-11-21) J.A.R.V.I.S. doing a person's desk work from the server (php desk.php as) */
function handleIn(string $action, bool $isPost, array $body, string $ME, string $ROLE): array {
    /* the research account (2026-11-21, Claire): she sees the sponsor and expo cards, adds or corrects a website (site), a phone or a general
       email (contact, contactedit), adds notes ("Looked up: ..." is a note) and runs the free look-up of a company's own website (scan, never
       Hunter). Nothing else, from the page or through J.A.R.V.I.S. (php desk.php as comes through here with her role): no touches, stages,
       owners, follow-ups, tours, proposals, prices, emails or texts, the Inbox, removing anything, Don't contact, templates, settings, alerts,
       the booking link or the chat (jvlist only answers her own, which is none). */
    if ($ROLE === 'research') {
        if (!in_array($action, RESEARCH_OK, true)) fail('This account looks companies up and notes what it finds. ' . ($action === '' ? '' : 'That is for the sellers.'), 403);
        if ($action === 'scan' && !empty($body['hunter'])) fail('Paid look-ups (Hunter) are not part of this account.', 403);
    }
    /* J.A.R.V.I.S. (2026-11-21, Matthew: "I need cai brandon and nneka to be able to make changes to the peak application"): the chat. Your
       own conversations; an admin sees everyone's. Every account with a desk sign-in may use it (Claude Check only looks). */
    if (in_array($action, ['jvlist', 'jvsend', 'jvclose', 'jvfile'], true)) return jvAction($action, $isPost, $body, $ME, $ROLE);

    /* which list an action works on; the old desk's action names still work (a page left open from before) */
    $ALIAS = ['status' => ['stage', 'sponsor'], 'lead' => ['add', 'sponsor'], 'leaddel' => ['del', 'sponsor'], 'leadback' => ['back', 'sponsor'],
        'xstage' => ['stage', 'expo'], 'xnote' => ['note', 'expo'], 'xnotedel' => ['notedel', 'expo'], 'xnext' => ['next', 'expo'], 'xcontact' => ['contact', 'expo'],
        'xlead' => ['add', 'expo'], 'xdel' => ['del', 'expo'], 'xback' => ['back', 'expo']];
    $BOTH = ['touch', 'touchdel', 'stage', 'owner', 'next', 'note', 'notedel', 'contact', 'add', 'del', 'back', 'tour', 'tourdel', 'tourmove', 'tourout', 'emailed', 'emailreply', 'emailbounce',
        'dnc', 'templates', 'contactedit', 'contactdel', 'tourmail'];
    $SPONSOR = ['site', 'scan', 'proposal', 'signed', 'sponsor', 'todo', 'tododone', 'tododel', 'packages', 'pl'];
    $legacy = isset($ALIAS[$action]);
    if ($legacy) { [$op, $w] = $ALIAS[$action]; if ($action === 'status') $body['stage'] = $body['status'] ?? ''; }
    else { $op = $action; $w = ($body['world'] ?? '') === 'expo' ? 'expo' : 'sponsor'; }
    if (in_array($op, $SPONSOR, true)) $w = 'sponsor';
    /* the expo-only account (2026-11-13): the Expo leads and nothing else, read or write */
    if ($ROLE === 'expo' && !in_array($action, ['data', 'callink', 'myset', 'booklink', 'pushkey', 'pushsub', 'pushunsub', 'alertset', 'alerttest'], true) && $w !== 'expo') fail('This account is for the Expo leads only.', 403);

    if ($action === 'data') return dataOut($ME, $ROLE);
    /* the Inbox (2026-11-20): sellers and admins; Claude Check may look (it is never marked read for it) and never acts */
    $INBOX = ['inbox', 'inboxone', 'inboxfile', 'inboxclaim', 'inboxdone', 'inboxattach', 'inboxreply'];
    if (in_array($action, $INBOX, true) && !in_array($ROLE, ['admin', 'seller'], true)) fail('The Inbox is for the sellers and admins.', 403);
    if ($action === 'inbox') return inList((string) ($_GET['f'] ?? 'open'), $ME);
    if ($action === 'inboxone') { $x = inOpen((string) ($_GET['iid'] ?? ''), $ME, $ME !== 'Claude Check'); if (empty($x['ok'])) fail($x['error'], (int) $x['code']); return $x; }
    if ($action === 'inboxfile') { inFile((string) ($_GET['iid'] ?? ''), (int) ($_GET['n'] ?? -1)); }
    /* alerts: the desk's public Web Push key (made the first time someone turns alerts on) */
    if ($action === 'pushkey') { $v = alVapid($ME !== 'Claude Check'); if (!$v) fail('The alert key is not made yet.', 503); return ['ok' => true, 'publicKey' => $v['publicKey']]; }
    /* the end-of-day email as it would go now (admins; read only, so Claude Check may look): nothing is sent */
    /* a tour confirmation as it would go (2026-11-19): read only, nothing is sent. sample: the Settings preview, with the words being edited */
    if ($action === 'tourpreview') {
        if (!empty($body['sample'])) {
            if ($ROLE !== 'admin') fail('Only an admin sees this.', 403);
            [$R, $t] = tmSample($ME, strtolower(clean($body['email'] ?? '', 160)));
        } else {
            $R = recs($w)[(string) ($body['id'] ?? '')] ?? null; if (!$R || !empty($R['off'])) fail('No such lead.', 404);
            $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
            if (!okDay($d) || !okTime($tm)) fail('Pick the day and the time first.');
            $t = ['date' => $d, 'time' => $tm, 'mins' => tmMins($body['mins'] ?? 30), 'who' => clean($body['who'] ?? '', 120), 'email' => strtolower(clean($body['email'] ?? '', 160)), 'by' => $ME];
        }
        $words = null;
        if ($ROLE === 'admin' && is_array($body['words'] ?? null)) { $words = tmWordsIn($body['words']); $e = tmCheckWords($words); if ($e !== '') fail($e); }
        return tmPreview($w, $R, $t, $ME, $words);
    }
    /* a desk email as it would go (2026-11-19): read only, nothing is sent */
    if ($action === 'dmpreview') {
        $R = recs($w)[(string) ($body['id'] ?? '')] ?? null; if (!$R || !empty($R['off'])) fail('No such lead.', 404);
        $x = dmPreview($w, $R, $body, $ME); if (empty($x['ok'])) fail($x['error']); return $x;
    }
    if ($action === 'eodpreview') { if ($ROLE !== 'admin') fail('Only an admin sees this.', 403); $m = eodText(time()); return ['ok' => true, 'subject' => $m['subject'], 'text' => $m['text'], 'due' => eodDue(time()), 'conf' => eodConf()]; }
    if ($ME === 'Claude Check') fail('This account only looks, so nothing is saved.', 403);   /* read-only check account (2026-10-26): everything below saves */
    if (!$isPost) fail('POST required', 405);
    /* desk-wide settings (2026-11-18): the end-of-day email, admins only */
    if ($action === 'settings') {
        if ($ROLE !== 'admin') fail('Only an admin changes the settings.', 403);
        $to = []; foreach ((array) ($body['to'] ?? []) as $e) { $e = strtolower(clean($e, 160)); if ($e === '') continue; if (!filter_var($e, FILTER_VALIDATE_EMAIL)) fail('“' . $e . '” does not look like an email.'); $to[$e] = 1; }
        if (count($to) > 12) fail('Twelve people at most.');
        $on = !empty($body['on']); if ($on && !$to) fail('Add at least one email before turning it on.');
        $s = jread('desk-settings.json', []); $s['eod'] = ['on' => $on, 'to' => array_keys($to), 'by' => $ME, 'at' => time()];
        if (!jwrite('desk-settings.json', $s)) fail('The setting could not be saved.', 500);
        return ['ok' => true, 'eod' => eodConf()];
    }
    /* my calendar link (2026-11-18); new: true makes a new one and the old link stops working */
    if ($action === 'callink') { $L = calLink($ME, !empty($body['new'])); if (!$L) fail('The link could not be made.', 500); return ['ok' => true] + $L; }
    /* my signature and reply address for desk emails, and my booking link (2026-11-19) */
    if ($action === 'myset') { $x = dmMineSave($ME, $body); if (isset($x['error'])) fail($x['error']); return ['ok' => true, 'mine' => $x]; }
    if ($action === 'booklink') { $L = bkLink($ME, !empty($body['new'])); if (!$L) fail('Only someone who can own companies on the desk has a booking link.', 403); return ['ok' => true] + $L; }
    /* the desk-wide switches and the shared schedule (admins) */
    if ($action === 'bookgeneric') { if ($ROLE !== 'admin') fail('Only an admin sees this.', 403); $L = bkGeneric(!empty($body['new'])); if (!$L) fail('The link could not be made.', 500); return ['ok' => true] + $L; }
    if ($action === 'dmset' || $action === 'bookset') {
        if ($ROLE !== 'admin') fail('Only an admin changes the settings.', 403);
        $key = $action === 'dmset' ? 'deskmail' : 'book'; $s = jread('desk-settings.json', []); $cur = is_array($s[$key] ?? null) ? $s[$key] : []; $now = time();
        if ($action === 'bookset') { $c = bkConfIn($body, bkConf()); if (isset($c['error'])) fail($c['error']); foreach (['week', 'mins', 'notice', 'ahead', 'blocked', 'meet'] as $k) $cur[$k] = $c[$k]; }
        if ($action === 'dmset' && array_key_exists('pixel', $body)) $cur['pixel'] = !empty($body['pixel']);
        if (array_key_exists('on', $body)) {
            $on = !empty($body['on']);
            if ($on && empty($cur['on']) && $action === 'dmset') { $mb = tmMailbox(); if (!$mb['ok']) fail('It can\'t go on yet: ' . $mb['why'] . '.'); }
            if ($on !== !empty($cur['on'])) { $cur['on'] = $on; }
        }
        $cur['by'] = $ME; $cur['at'] = $now; $s[$key] = $cur; if (!jwrite('desk-settings.json', $s)) fail('The setting could not be saved.', 500);
        @file_put_contents(DATA_DIR . '/' . $key . '-settings.log', jline(['at' => $now, 'by' => $ME] + $cur), FILE_APPEND | LOCK_EX);
        return ['ok' => true, 'deskmail' => dmOut(true, $ME), 'book' => bkOut(true, $ME)];
    }
    /* the Inbox's actions and my alerts (2026-11-20) */
    if (in_array($action, ['inboxclaim', 'inboxdone', 'inboxattach', 'inboxreply'], true)) {
        $iid = (string) ($body['iid'] ?? '');
        $x = match ($action) { 'inboxclaim' => inClaim($iid, !empty($body['on']), $ME), 'inboxdone' => inDone($iid, !empty($body['on']), $ME),
            'inboxattach' => inAttach($iid, (string) ($body['w'] ?? ''), (string) ($body['id'] ?? ''), $ME), default => inReply($iid, $body, $ME) };
        if (empty($x['ok'])) { if (isset($x['claim'])) { http_response_code((int) $x['code']); return ['ok' => false, 'error' => $x['error'], 'claim' => $x['claim']]; } fail((string) $x['error'], (int) ($x['code'] ?? 400)); }
        unset($x['code']); return $x;
    }
    if ($action === 'pushsub') { $x = alSubAdd($ME, is_array($body['subscription'] ?? null) ? $body['subscription'] : [], clean($body['device'] ?? '', 40), !empty($body['phone'])); if (!$x['ok']) fail($x['error']); return ['ok' => true, 'alerts' => alOut($ME)]; }
    if ($action === 'pushunsub') { alSubDrop($ME, (string) ($body['endpoint'] ?? ''), preg_match('/^[0-9a-f]{16}$/', (string) ($body['id'] ?? '')) ? (string) $body['id'] : ''); return ['ok' => true, 'alerts' => alOut($ME)]; }
    if ($action === 'alertset') { $x = alSave($ME, $body); if (isset($x['error'])) fail($x['error']); return ['ok' => true, 'alerts' => alOut($ME)]; }
    if ($action === 'alerttest') { $x = alTest($ME); return $x + ['alerts' => alOut($ME)]; }
    /* Write an email (2026-11-19): Send, and Retry of one that did not go */
    if ($action === 'dmsend') {
        $R = recs($w)[(string) ($body['id'] ?? '')] ?? null; if (!$R || !empty($R['off'])) fail('No such lead.', 404);
        $x = dmSend($w, $R, $body, $ME); if (empty($x['ok'])) fail($x['error']); return $x;
    }
    if ($action === 'dmretry') {
        $R = recs($w)[(string) ($body['id'] ?? '')] ?? null; $ref = (string) ($body['ref'] ?? ''); if (!$R || !isset($R['dmails'][$ref])) fail('No such email.', 404);
        if (!dmConf()['on']) fail('Desk emails are off.');
        return ['ok' => true, 'ref' => $ref] + dmDeliver($w, (string) $R['id'], $ref, $ME);
    }
    if (!in_array($op, $BOTH, true) && !in_array($op, $SPONSOR, true) && !in_array($action, ['tourmailset', 'tourmailtest'], true)) fail('Unknown action.', 404);
    if (in_array($op, ['emailed', 'emailreply', 'emailbounce'], true)) return service($op, $body + ['world' => $w], $ME);
    /* tour confirmation emails (2026-11-19): the switch and the wording (admins), a test to an address an admin types, and Retry / Send now */
    if ($action === 'tourmailset') {
        if ($ROLE !== 'admin') fail('Only an admin changes the settings.', 403);
        $s = jread('desk-settings.json', []); $cur = is_array($s['tourmail'] ?? null) ? $s['tourmail'] : []; $now = time();
        if (!empty($body['reset'])) { unset($cur['words']); $cur['wby'] = $ME; $cur['wat'] = $now; }
        elseif (is_array($body['words'] ?? null)) {
            $wd = tmWordsIn($body['words']); $e = tmCheckWords($wd); if ($e !== '') fail($e);
            if ($wd !== tmConf()['words']) { $cur['words'] = $wd === tmDefaults() ? null : $wd; if ($cur['words'] === null) unset($cur['words']); $cur['wby'] = $ME; $cur['wat'] = $now; }
        }
        if (array_key_exists('on', $body)) {
            $on = !empty($body['on']);
            if ($on && empty($cur['on'])) { $mb = tmMailbox(); if (!$mb['ok']) fail('It can\'t go on yet: ' . $mb['why'] . '.'); }
            if ($on !== !empty($cur['on'])) { $cur['on'] = $on; $cur['by'] = $ME; $cur['at'] = $now; }
        }
        $s['tourmail'] = $cur; if (!jwrite('desk-settings.json', $s)) fail('The setting could not be saved.', 500);
        @file_put_contents(DATA_DIR . '/tourmail-settings.log', jline(['at' => $now, 'by' => $ME, 'on' => !empty($cur['on']), 'custom' => isset($cur['words'])]), FILE_APPEND | LOCK_EX);
        return ['ok' => true, 'tourmail' => tmOut(true)];
    }
    if ($action === 'tourmailtest') {
        if ($ROLE !== 'admin') fail('Only an admin sends a test.', 403);
        $to = strtolower(clean($body['email'] ?? '', 160)); if (!filter_var($to, FILTER_VALIDATE_EMAIL)) fail('Type the address to send the test to.');
        $words = is_array($body['words'] ?? null) ? tmWordsIn($body['words']) : null; if ($words !== null && ($e = tmCheckWords($words)) !== '') fail($e);
        $x = tmTest($w, $ME, $to, $words); if (empty($x['ok'])) fail('The test did not send: ' . ($x['why'] ?? 'no answer') . '.');
        return ['ok' => true, 'to' => $to];
    }
    if ($op === 'tourmail') {
        $tid = (string) ($body['tid'] ?? ''); $t = tmTourAny($w, $tid); if (!$t) fail('No such tour.', 404);
        if (!tmConf()['on']) fail('Tour confirmation emails are off.');
        $st = tmState($t); if (!in_array($st['s'], ['failed', 'stale', 'none'], true)) return ['ok' => true, 'mail' => ['state' => $st['s'] === 'sent' ? 'dup' : $st['s'], 'why' => $st['text'], 'to' => (string) ($t['email'] ?? '')]];
        if (!empty($t['off']) && !isset($t['tmSent'])) fail('No invite went out for that tour, so there is nothing to cancel.');
        return ['ok' => true, 'mail' => tmSend($w, $tid, $ME, !empty($t['off']))];
    }
    if (in_array($op, ['tour', 'tourmove', 'tourdel'], true)) {
        $res = withLock(fn() => act($op, $w, $body, $ME, $legacy));
        if (!empty($res['ok'])) $res['mail'] = tmAfter($op, $w, $op === 'tour' ? (string) $res['tid'] : (string) ($body['tid'] ?? ''), array_key_exists('mail', $body) ? !empty($body['mail']) : null, $ME);
        return $res;
    }
    if ($op === 'templates' && $ROLE !== 'admin' && !defined('DESK_VIA')) fail('Only an admin changes the templates.', 403);   /* J.A.R.V.I.S. may change one for a seller who asks (2026-11-21) */
    /* Packages and Profit & loss are admins only (2026-11-20, Matthew: More shows sellers only My email & booking link, My calendar, Look) */
    if (in_array($op, ['packages', 'pl'], true) && $ROLE !== 'admin') fail('Only an admin changes ' . ($op === 'pl' ? 'profit and loss' : 'the packages') . '.', 403);
    return withLock(fn() => act($op, $w, $body, $ME, $legacy));
}

/* ---- J.A.R.V.I.S. (2026-11-21) ---- */
function jvBoot(): void {
    static $done = false; if ($done) return; $done = true;
    $e = in_array(PHP_SAPI, ['cli', 'cli-server'], true) ? (string) getenv('JV_LIB') : '';
    require_once ($e !== '' ? $e : (is_file(__DIR__ . '/jv-lib.php') ? __DIR__ . '/jv-lib.php' : dirname(__DIR__, 4) . '/shared/jv-chat/jv-lib.php'));
    jvInit(DATA_DIR . '/jarvis', 'peak');
}
function jvAction(string $action, bool $isPost, array $body, string $ME, string $ROLE): array {
    jvBoot();
    $all = $ROLE === 'admin' && $ME !== 'Claude Check';
    if ($action === 'jvfile') { $x = jvServeFile($ME, $all, (string) ($_GET['id'] ?? ''), (string) ($_GET['f'] ?? '')); fail($x['error'], (int) $x['code']); }
    if ($action === 'jvlist') return ['ok' => true, 'admin' => $all, 'tickets' => jvList($ME, $all)];
    if (!$isPost) fail('POST required', 405);
    if ($ME === 'Claude Check') fail('This account only looks, so nothing is sent.', 403);
    if ($action === 'jvclose') { $x = jvClose($ME, $all, (string) ($body['id'] ?? '')); if (isset($x['error'])) fail($x['error'], (int) $x['code']); return ['ok' => true]; }
    $x = jvSend($ME, $all, $body, ['role' => $ROLE]); if (isset($x['error'])) fail($x['error'], (int) $x['code']);
    return $x;
}

/* ---- what the page gets ---- */
function people(string $w, array $R): array {
    $o = []; $dnc = $R['dnc'] ?? [];
    /* each person carries its key (Don't contact and "add the new details to" name it); one marked Don't contact shows no email or phone */
    $mk = function (array $c, array $p) use ($dnc): array { $k = personKey($c); $p['key'] = $k; if (!empty($c['ed']['by'])) $p['edBy'] = [(string) $c['ed']['by'], (int) ($c['ed']['at'] ?? 0)]; if ($k !== '' && isset($dnc[$k])) { $p['dnc'] = $dnc[$k]; $p['email'] = ''; $p['phone'] = ''; } return $p; };
    foreach (($R['contacts'] ?? []) as $c) {
        if ($w === 'expo') { $o[] = $mk($c, ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['role'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''), 'best' => !empty($c['best']),
            'src' => 'Venue research' . (!empty($c['sdate']) ? ', source dated ' . $c['sdate'] : ''), 'conf' => (string) ($c['conf'] ?? ''), 'estat' => (string) ($c['estat'] ?? ''), 'other' => (string) ($c['other'] ?? ''), 'notes' => (string) ($c['notes'] ?? ''), 'srcs' => (array) ($c['srcs'] ?? [])]); continue; }
        $hc = is_numeric($c['conf'] ?? null);
        $o[] = $mk($c, ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''), 'best' => !empty($c['pick']),
            'src' => ($c['from'] ?? '') === 'peak' ? 'Peak’s sponsor tracker' : ($hc ? 'Hunter' : 'Our research'), 'conf' => $hc ? (int) $c['conf'] . '%' : '']);
    }
    $more = [];
    foreach (($R['added'] ?? []) as $c) {
        if (!empty($c['of'])) { $more[] = $c; continue; }   /* "add the new details to" someone already on the card (the duplicate check) */
        $o[] = $mk($c, ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['role'] ?? $c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''),
            'best' => false, 'src' => 'Added on the desk by ' . ($c['by'] ?? 'someone') . (!empty($c['at']) ? ', ' . date('M j', (int) $c['at']) : ''), 'conf' => '', 'notes' => (string) ($c['notes'] ?? ''), 'added' => true]);
    }
    foreach ($more as $c) {
        $hit = false;
        foreach ($o as &$p) {
            if ($p['key'] !== $c['of']) continue; $hit = true;
            $roleF = (string) ($c['role'] ?? '') !== '' ? 'role' : 'pos';
            foreach (['name' => 'name', 'role' => $roleF, 'email' => 'email', 'phone' => 'phone'] as $to => $from) if (($p[$to] ?? '') === '' && (string) ($c[$from] ?? '') !== '' && (empty($p['dnc']) || !in_array($to, ['email', 'phone'], true))) $p[$to] = (string) $c[$from];
            $p['more'] = 'Details added on the desk by ' . ($c['by'] ?? 'someone') . (!empty($c['at']) ? ', ' . date('M j', (int) $c['at']) : '');
        }
        unset($p);
        if (!$hit) $o[] = $mk($c, ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['role'] ?? $c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''), 'best' => false, 'src' => 'Added on the desk by ' . ($c['by'] ?? 'someone'), 'conf' => '', 'added' => true]);
    }
    /* everyone so far can be edited or removed on the card (2026-11-18): ed, and kn when two share a key (contactAt() finds them the same way) */
    $seen = [];
    foreach ($o as &$p) {
        $p['ed'] = true; $p['kn'] = $seen[$p['key']] = isset($seen[$p['key']]) ? $seen[$p['key']] + 1 : 0;
        if (!empty($p['edBy'])) { $p['src'] .= ' · edited by ' . $p['edBy'][0] . ', ' . date('M j', (int) $p['edBy'][1]); }
        unset($p['edBy']);
    }
    unset($p);
    foreach (($R['scan']['hunter']['people'] ?? []) as $c) $o[] = $mk($c, ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''),
        'best' => false, 'src' => 'Hunter, ' . date('M j', (int) ($R['scan']['hunter']['at'] ?? time())), 'conf' => (int) ($c['conf'] ?? 0) . '%']);
    return $o;
}
function shape(string $w, array $R): array {
    $R['touches'] = array_values($R['touches'] ?? []); usort($R['touches'], fn($a, $b) => $a['when'] <=> $b['when']);
    /* their emails (2026-11-19): where the message is stays on the server; rp = it can be answered with Reply */
    foreach ($R['touches'] as &$t) if (is_array($t['mail'] ?? null)) { $t['mail']['rp'] = empty($t['mail']['auto']) && (($t['mail']['mid'] ?? '') !== '' || ($t['mail']['imid'] ?? '') !== '') ? 1 : 0; unset($t['mail']['mid'], $t['mail']['mb'], $t['mail']['imid']); }
    unset($t);
    $R['last'] = lastTouch($R); $R['tries'] = missCount($R); $R['people'] = people($w, $R);
    /* desk emails (2026-11-19): newest first, with how often the booking link in each was opened */
    if (!empty($R['dmails'])) { $bs = bkStats()['ref']; $R['dmails'] = array_values(array_map(fn($x) => ['re' => is_array($x['re'] ?? null) ? ['k' => (string) ($x['re']['k'] ?? ''), 'subject' => (string) ($x['re']['subject'] ?? '')] : ''] + $x + ['views' => (int) ($bs[$x['ref']]['views'] ?? 0), 'opens' => (int) ($bs[$x['ref']]['opens'] ?? 0), 'booked' => (int) ($bs[$x['ref']]['booked'] ?? 0)], $R['dmails'])); usort($R['dmails'], fn($a, $b) => $b['at'] <=> $a['at']); }
    unset($R['log']);
    return $R;
}
function worldOut(string $w): array {
    $all = recs($w); if ($w === 'sponsor') { $sc = jread('scans.json', []); foreach ($all as $id => &$r) if (isset($sc[$id])) $r['scan'] = $sc[$id]; unset($r); }
    $live = []; $removed = [];
    foreach ($all as $R) { if (!empty($R['off'])) $removed[] = ['id' => $R['id'], 'name' => $R['name'], 'list' => $R['list'] ?? '', 'cat' => $R['cat'] ?? '', 'stage' => $R['stage'], 'at' => $R['off']['at'], 'by' => $R['off']['by']]; else $live[] = shape($w, $R); }
    $C = W($w); $st = []; foreach ($C['stages'] as $k => $v) $st[] = [$k, $v];
    return ['stages' => $st, 'path' => $C['path'], 'reach' => $C['reach'], 'recs' => $live, 'removed' => $removed, 'tours' => array_map(fn($t) => $t + ['tms' => tmState($t)], toursOf($w)), 'tmFailed' => tmFailed($w), 'owners' => owners($w),
        'week' => counts($w, weekStart()), 'weekFrom' => date('Y-m-d', weekStart()), 'month' => counts($w, monthStart()), 'monthFrom' => date('Y-m-d', monthStart()), 'team' => counts($w, 0), 'templates' => templatesOf($w), 'starters' => starterTemplates($w)];
}
function dataOut(string $ME, string $ROLE): array {
    $base = ['ok' => true, 'build' => BUILD, 'me' => ['name' => $ME, 'role' => $ROLE], 'methods' => METHODS, 'outs' => OUTS, 'mouts' => MOUTS, 'today' => date('Y-m-d'),
        'nextBiz' => nextBizDay(), 'tries' => ['max' => TRIES_MAX, 'back' => TRIES_BACK_DAYS]];
    if ($ROLE === 'admin') $base['eod'] = eodConf();
    $base['tourmail'] = tmOut($ROLE === 'admin');
    $base['deskmail'] = dmOut($ROLE === 'admin', $ME); $base['book'] = bkOut($ROLE === 'admin', $ME);
    /* the Inbox's counts for the tab, and my alerts (2026-11-20) */
    if (in_array($ROLE, ['admin', 'seller'], true)) $base['inbox'] = inCounts();
    $base['alerts'] = alOut($ME);
    /* who Peak's emails go out as (2026-11-19): set in Outbox, shown here read only */
    $mb = tmMailbox(); $base['sendFrom'] = ['email' => $mb['email'] ?: TM_ORGANIZER, 'name' => $mb['name'] ?: TM_FROM_NAME, 'shared' => (bool) ($mb['shared'] ?? false), 'warn' => (string) ($mb['warn'] ?? ''), 'ready' => (bool) $mb['ok']];
    $X = worldOut('expo'); $xs = jread('expo-seed.json', []);
    $X += ['questions' => $xs['questions'] ?? [], 'venues' => $xs['venues'] ?? [], 'venueNote' => $xs['venueNote'] ?? '', 'built' => $xs['built'] ?? '', 'from' => $xs['from'] ?? ''];
    if ($ROLE === 'expo') return $base + ['expo' => $X];   /* the expo account: the Expo leads and nothing of the sponsors' */
    $S = worldOut('sponsor'); $sd = jread('seed.json', []);
    /* the packages go to everyone: a seller's Make a proposal and Mark signed pick from them. Profit & loss, What Peak offers and What we could
       offer are admins only (2026-11-20, Matthew): a seller's page never gets them. The Report is worked out on the page from the cards. */
    $S += ['proposals' => propsOf('sponsor'), 'packages' => settingOf('sponsor', 'packages', []), 'hunterLeft' => hunterLeft()];
    if ($ROLE === 'admin') $S += ['pl' => settingOf('sponsor', 'pl', null), 'offer' => $sd['offer'] ?? [], 'better' => $sd['better'] ?? []];
    if ($ROLE === 'research') { $S = researchView($S); $X = researchView($X); $S['proposals'] = []; $S['packages'] = []; $S['hunterLeft'] = null; }
    return $base + ['sponsor' => $S, 'expo' => $X];
}
/* the research account's view of a list (2026-11-21): the cards, without what only the sellers work with: tours (visitors' names and
   emails), message templates, the desk emails sent and the words of emails received (the Inbox's) */
function researchView(array $V): array {
    $V['tours'] = []; $V['tmFailed'] = []; $V['templates'] = []; $V['starters'] = [];
    foreach ($V['recs'] as &$r) {
        unset($r['dmails']);
        foreach ($r['touches'] as &$t) if (isset($t['mail'])) { $t['note'] = ''; unset($t['mail']); }
        unset($t);
        if (isset($r['last']['mail'])) { unset($r['last']['mail']); $r['last']['note'] = ''; }
    }
    unset($r);
    return $V;
}

/* ---- the Peak email sender's actions (key or a seller's sign-in) ---- */
function service(string $op, array $body, string $by): array {
    $w = ($body['world'] ?? '') === 'expo' ? 'expo' : 'sponsor'; $id = (string) ($body['id'] ?? '');
    $r = $op === 'emailed'
        ? deskEmailed($w, $id, (string) ($body['to'] ?? ''), (string) ($body['subject'] ?? ''), $by, (string) ($body['ref'] ?? ''), (int) ($body['at'] ?? 0))
        : ($op === 'emailbounce' ? deskBounced($w, $id, (string) ($body['to'] ?? ''), (string) ($body['note'] ?? ''), $by, (string) ($body['ref'] ?? ''))
        : deskReplied($w, $id, (string) ($body['from'] ?? ''), (string) ($body['note'] ?? ''), $by, (string) ($body['ref'] ?? ''), !empty($body['stop'])));
    if (!$r['ok']) fail($r['error'], (int) ($r['code'] ?? 400));
    unset($r['code']); return $r;
}

/* ---- the saves: each reads the records (with anything new in the log), checks, writes its rows, reads them in ---- */
function needRec(array $X, string $w, string $id, bool $removedOk = false): array {
    $ok = $w === 'expo' ? preg_match('/^x[0-9a-f]{9}$/', $id) : preg_match('/^[a-z0-9]{6,24}$/', $id);
    if (!$ok || !isset($X[$id])) fail($w === 'expo' ? 'No such expo lead.' : 'No such lead.', 404);
    if (!$removedOk && !empty($X[$id]['off'])) fail($w === 'expo' ? 'That lead was removed. Bring it back first.' : 'That company was removed. Bring it back first.', 409);
    return $X[$id];
}
function needTour(string $w, string $tid): array { foreach (toursOf($w) as $t) if ($t['tid'] === $tid) return $t; fail('No such tour.', 404); return []; }
function okSite(string $site): string {
    $site = clean($site, 160); if ($site !== '' && !preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
    return $site;
}
function okMail(string $e): string { $e = clean($e, 120); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.'); return $e; }
function lines($in): array {   /* package lines for a proposal or a signed deal */
    $lines = [];
    foreach ((array) $in as $x) {
        if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 100); $pr = (int) round((float) ($x['price'] ?? 0)); $q = max(1, min(50, (int) ($x['qty'] ?? 1)));
        if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $lines[] = ['name' => $nm, 'price' => $pr, 'qty' => $q, 'per' => clean($x['per'] ?? '', 20)];
    }
    return $lines;
}
function money0($v): ?int { return ($v === null || $v === '') ? null : max(0, min(10000000, (int) round((float) preg_replace('/[^\d.]/', '', (string) $v)))); }

function act(string $op, string $w, array $body, string $ME, bool $legacy): array {
    sync($w, true);
    $X = recs($w); $C = W($w); $T = $C['T']; $now = time(); $id = (string) ($body['id'] ?? $body['lead'] ?? '');
    $canOwn = in_array($ME, owners($w), true);
    $sameName = function (string $n) use ($X, $w): void {
        if ($n === '') fail($w === 'expo' ? 'Give the organisation name.' : 'Give the company name.');
        foreach ($X as $r) if (strtolower(trim((string) $r['name'])) === strtolower(trim($n)))
            fail($w === 'expo' ? (!empty($r['off']) ? 'That lead was removed. Bring it back from Removed.' : 'That organisation is already in the Expo leads.')
                : (!empty($r['off']) ? 'That company was removed. Bring it back from Removed companies.' : 'That company is already on the list.'));
    };
    $newLead = function () use ($body, $ME): array {   /* a sponsor company we add, as a lead or as a sponsor already signed */
        $site = okSite((string) ($body['site'] ?? '')); $n = clean($body['name'] ?? '', 100);
        return ['id' => substr(sha1('added|' . $n . '|' . microtime()), 0, 10), 'list' => 'added', 'name' => $n, 'kind' => clean($body['kind'] ?? '', 60), 'score' => null, 'why' => clean($body['why'] ?? '', 400), 'route' => '', 'phone' => clean($body['phone'] ?? '', 40), 'site' => $site, 'by' => $ME];
    };
    switch ($op) {
        /* one touch: how they were reached and how it went (2026-11-17) */
        case 'touch': {
            $R = needRec($X, $w, $id); $m = (string) ($body['m'] ?? ''); $o = (string) ($body['out'] ?? '');
            if (!isset(METHODS[$m]) || $m === 'other') fail('Pick how you reached them.');
            if (!in_array($o, MOUTS[$m], true)) fail('Pick how it went.');
            $when = (int) ($body['when'] ?? 0); if ($when === 0) $when = $now; elseif ($when > $now + 600 || $when < $now - 30 * 86400) fail('Pick a time in the last 30 days.');
            $fu = (string) ($body['fu'] ?? ''); if ($fu !== '' && (!okDay($fu) || $fu < date('Y-m-d'))) fail('Pick a follow-up day from today on.');
            $k = newKey(); $touch = ['m' => $m, 'out' => $o, 'note' => clean($body['note'] ?? '', 600), 'when' => $when];
            /* sent from a message template (2026-11-18): which one, kept on the touch */
            $tpl = clean($body['tpl'] ?? '', 40); if ($tpl !== '') { if (!preg_match('/^[a-z0-9-]{1,40}$/', $tpl)) fail('No such template.'); $touch['tpl'] = $tpl; }
            commit($w, touchRows($w, $R, $k, $touch, $ME, $canOwn, $fu, clean($body['fuWhat'] ?? '', 160), $now));
            $R = recs($w)[$id]; return ['ok' => true, 'k' => $k, 'stage' => $R['stage'], 'owner' => $R['owner'], 'tries' => missCount($R)];
        }
        /* undo a touch: gone from the card (the log keeps it); the stage it moved to goes back if nothing has moved it since */
        case 'touchdel': {
            $R = needRec($X, $w, $id); $k = (string) ($body['k'] ?? ''); $t = null; foreach ($R['touches'] as $x) if ($x['k'] === $k) $t = $x;
            if (!$t) fail('No such touch.', 404);
            $rows = [['t' => $T['touchdel'], 'id' => $id, 'k' => $k, 'by' => $ME, 'at' => $now]];
            $h = end($R['hist']) ?: null;
            if ($h && ($h['tk'] ?? '') === $k && $R['stage'] === $h['to'] && isset($t['from'])) $rows[] = rowStage($w, $id, (string) $t['from'], $ME, $now, ['undo' => $k]);
            commit($w, $rows); return ['ok' => true, 'stage' => recs($w)[$id]['stage']];
        }
        case 'stage': {
            $R = needRec($X, $w, $id); $st = stageKey($w, (string) ($body['stage'] ?? '')); if (!isset($C['stages'][$st])) fail('Pick a stage.');
            $why = clean($body['why'] ?? '', 200); $extra = []; $rows = [];
            if ($st === 'notnow') {
                $back = (string) ($body['back'] ?? ''); if ($back === '' && $legacy) $back = date('Y-m-d', strtotime('+30 days'));
                if (!okDay($back) || $back < date('Y-m-d')) fail('Pick the day to come back to them.');
                $extra = ['back' => $back, 'why' => $why];
                $rows[] = rowStage($w, $id, $st, $ME, $now, $extra);
                $rows[] = rowNext($w, $id, ['date' => $back, 'what' => 'Come back to them' . ($why !== '' ? ': ' . $why : '')], $ME, $now);
            } elseif ($st === 'lost') {
                if ($why === '' && $legacy) $why = 'Said no';
                if ($why === '') fail('Say why it was lost.');
                $rows[] = rowStage($w, $id, $st, $ME, $now, ['why' => $why]);
                if (!empty($R['next'])) $rows[] = rowNext($w, $id, null, $ME, $now);
            } else {
                if ($st === $R['stage'] && !in_array($st, ['quote', 'booked'], true)) return ['ok' => true, 'stage' => $st];
                if ($w === 'expo' && $st === 'quote') $extra['quote'] = ['amount' => money0($body['amount'] ?? null), 'note' => clean($body['note'] ?? '', 300)];
                if ($w === 'expo' && $st === 'booked') { $d = (string) ($body['date'] ?? ''); if ($d !== '' && !okDay($d)) fail('Pick the event date.'); $extra['booked'] = ['date' => $d, 'amount' => money0($body['amount'] ?? null), 'note' => clean($body['note'] ?? '', 300)]; }
                $rows[] = rowStage($w, $id, $st, $ME, $now, $extra);
            }
            commit($w, $rows); return ['ok' => true, 'stage' => $st];
        }
        /* who works it: one of the sellers, or nobody (Open) */
        case 'owner': {
            needRec($X, $w, $id); $o = clean($body['owner'] ?? '', 60);
            if ($o !== '' && !in_array($o, owners($w), true)) fail('Pick someone on the desk.');
            commit($w, [rowOwner($w, $id, $o, $ME, $now)]); return ['ok' => true, 'owner' => $o];
        }
        case 'next': {
            needRec($X, $w, $id); $d = (string) ($body['date'] ?? ''); $wh = clean($body['what'] ?? '', 160);
            if ($d !== '' && !okDay($d)) fail('Pick a date.');
            commit($w, [rowNext($w, $id, $d === '' && $wh === '' ? null : ['date' => $d, 'what' => $wh], $ME, $now)]); return ['ok' => true];
        }
        case 'note': {
            needRec($X, $w, $id); $n = clean($body['note'] ?? '', 1000); if ($n === '') fail('Write the note first.');
            commit($w, [['t' => $T['note'], 'id' => $id, 'note' => $n, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'notedel': {
            $R = needRec($X, $w, $id); $nk = (string) ($body['nk'] ?? ''); if (!in_array($nk, array_column($R['notes'], 'k'), true)) fail('No such note.', 404);
            commit($w, [['t' => $T['notedel'], 'id' => $id, 'nk' => $nk, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'contact': {
            $R = needRec($X, $w, $id);
            $role = clean($body['role'] ?? $body['pos'] ?? '', 80);
            $c = ['name' => clean($body['name'] ?? '', 80), 'email' => okMail((string) ($body['email'] ?? '')), 'phone' => clean($body['phone'] ?? '', 40)];
            $c = $w === 'expo' ? $c + ['role' => $role, 'notes' => clean($body['notes'] ?? '', 400)] : $c + ['pos' => $role];
            if ($c['name'] === '' && $c['email'] === '' && $c['phone'] === '') fail('Give a name, email or phone.');
            /* Sixfold's doubles (2026-11-18): the same email, phone or name already on this card, or the same email or phone at another company.
               "Add the new details to" (of: their key) fills in what that person lacks; "Keep both" (keep) adds them anyway. */
            $P = people($w, $R + ['scan' => $w === 'sponsor' ? (jread('scans.json', [])[$id] ?? []) : []]);
            $of = clean($body['of'] ?? '', 200);
            if ($of !== '') { if (!in_array($of, array_column($P, 'key'), true)) fail('That contact is not on this card.', 404); $c['of'] = $of; }
            elseif (empty($body['keep'])) {
                $em = strtolower($c['email']); $ph = digits10($c['phone']); $nm = strtolower(trim($c['name'])); $d = [];
                foreach (array_merge($R['contacts'] ?? [], $R['added'] ?? []) as $q) {
                    if (!empty($q['of'])) continue; $k = personKey($q); $why = [];
                    $qe = strtolower(trim((string) (($q['email'] ?? '') ?: ($q['dncEmail'] ?? '')))); $qp = digits10((string) (($q['phone'] ?? '') ?: ($q['dncPhone'] ?? '')));
                    if ($em !== '' && $qe === $em) $why[] = 'the same email'; if ($ph !== '' && $qp === $ph) $why[] = 'the same phone';
                    if ($nm !== '' && strtolower(trim((string) ($q['name'] ?? ''))) === $nm) $why[] = 'the same name';
                    if ($why) { $d[] = ['same' => true, 'key' => $k, 'name' => (string) ($q['name'] ?? '') ?: ($qe ?: 'a contact'), 'why' => implode(', ', $why), 'dnc' => isset(($R['dnc'] ?? [])[$k])]; }
                }
                if (!$d && ($em !== '' || $ph !== '')) foreach (dupesOf($X, '', $c['phone'], '', $c['email'], $id) as $x) $d[] = ['same' => false, 'id' => $x['id'], 'name' => $x['name'], 'why' => $x['why'], 'removed' => $x['removed']];
                if ($d) { http_response_code(409); return ['ok' => false, 'error' => 'That person may already be on the desk.', 'dupes' => array_slice($d, 0, 5)]; }
            }
            commit($w, [['t' => $T['contact'], 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* edit a person on the card (2026-11-18): any field can be corrected or cleared, checked as when they were added (okMail; a name,
           email or phone left), with the same duplicate warning for a new email, phone or name (keep: save anyway). One row: who, when, the
           person as the card showed them and as they are now. Someone marked Don't contact keeps their hidden email and phone. */
        case 'contactedit': {
            $R = needRec($X, $w, $id); $key = clean($body['key'] ?? '', 200); $n = max(0, (int) ($body['n'] ?? 0));
            $x = contactAt($R, $key, $n); if (!$x) fail('That contact is not on this card any more. Reload and try again.', 404);
            $P = people($w, $R + ['scan' => $w === 'sponsor' ? (jread('scans.json', [])[$id] ?? []) : []]); $shown = null;
            foreach ($P as $p) if (!empty($p['ed']) && $p['key'] === $key && (int) $p['kn'] === $n) $shown = $p;
            $c = $R[$x[0]][$x[1]]; $dn = !empty($c['dnc']) || isset(($R['dnc'] ?? [])[$key]);
            $was = contactVals($w, $shown ? ['name' => $shown['name'], 'role' => $shown['role'], 'email' => $shown['email'], 'phone' => $shown['phone'], 'notes' => $shown['notes'] ?? ''] : $c);
            $nw = $was; $has = fn($f) => array_key_exists($f, $body) && $body[$f] !== null;
            if ($has('name')) $nw['name'] = clean($body['name'], 80);
            if ($has('role') || $has('pos')) $nw['role'] = clean($body['role'] ?? $body['pos'], 80);
            if ($w === 'expo' && $has('notes')) $nw['notes'] = clean($body['notes'], 400);
            if (!$dn) { if ($has('email')) $nw['email'] = okMail((string) $body['email']); if ($has('phone')) $nw['phone'] = clean($body['phone'], 40); }
            else { unset($was['email'], $was['phone'], $nw['email'], $nw['phone']); }
            $em0 = $dn ? (string) ($c['dncEmail'] ?? '') : $nw['email']; $ph0 = $dn ? (string) ($c['dncPhone'] ?? '') : $nw['phone'];
            if ($nw['name'] === '' && $em0 === '' && $ph0 === '') fail('Give a name, email or phone.');
            if ($nw === $was) return ['ok' => true, 'same' => true];
            if (empty($body['keep'])) {
                $ch = fn($f) => isset($nw[$f]) && strtolower(trim((string) $nw[$f])) !== strtolower(trim((string) ($was[$f] ?? '')));
                $em = $ch('email') ? strtolower(trim($nw['email'])) : ''; $ph = $ch('phone') ? digits10($nw['phone']) : ''; $nm = $ch('name') ? strtolower(trim($nw['name'])) : ''; $d = [];
                foreach (contactRefs($R) as $y) {
                    if ($y[0] === $x[0] && $y[1] === $x[1]) continue; $q = $R[$y[0]][$y[1]]; $why = [];
                    $qe = strtolower(trim((string) (($q['email'] ?? '') ?: ($q['dncEmail'] ?? '')))); $qp = digits10((string) (($q['phone'] ?? '') ?: ($q['dncPhone'] ?? '')));
                    if ($em !== '' && $qe === $em) $why[] = 'the same email'; if ($ph !== '' && $qp === $ph) $why[] = 'the same phone';
                    if ($nm !== '' && strtolower(trim((string) ($q['name'] ?? ''))) === $nm) $why[] = 'the same name';
                    if ($why) $d[] = ['same' => true, 'key' => $y[2], 'name' => (string) ($q['name'] ?? '') ?: ($qe ?: 'a contact'), 'why' => implode(', ', $why), 'dnc' => isset(($R['dnc'] ?? [])[$y[2]])];
                }
                if (!$d && ($em !== '' || $ph !== '')) foreach (dupesOf($X, '', $ph, '', $em, $id) as $z) $d[] = ['same' => false, 'id' => $z['id'], 'name' => $z['name'], 'why' => $z['why'], 'removed' => $z['removed']];
                if ($d) { http_response_code(409); return ['ok' => false, 'error' => 'That person may already be on the desk.', 'dupes' => array_slice($d, 0, 5)]; }
            }
            commit($w, [['t' => $T['contactedit'], 'id' => $id, 'key' => $key, 'n' => $n, 'was' => $was, 'now' => $nw, 'by' => $ME, 'at' => $now0 = time()]]);
            $A = recs($w)[$id]; $y = null; foreach (contactRefs($A) as $z) if ($z[0] === $x[0]) { $q = $A[$z[0]][$z[1]]; if (($q['ed']['at'] ?? 0) === $now0 && ($q['ed']['by'] ?? '') === $ME) $y = $z; }
            return ['ok' => true, 'key' => $y ? $y[2] : ''];
        }
        /* remove a person from the card (2026-11-18); the log keeps them */
        case 'contactdel': {
            $R = needRec($X, $w, $id); $row = contactDelRow($w, $R, clean($body['key'] ?? '', 200), max(0, (int) ($body['n'] ?? 0)), $ME, $now);
            if (!$row) fail('That contact is not on this card any more. Reload and try again.', 404);
            commit($w, [$row]); return ['ok' => true];
        }
        /* Don't contact (2026-11-18): this person asked not to be contacted. Their call, text and email buttons go, and the email sender skips
           them. on: false takes it off again. */
        case 'dnc': {
            $R = needRec($X, $w, $id); $key = clean($body['key'] ?? '', 200); $on = !empty($body['on']);
            $P = people($w, $R + ['scan' => $w === 'sponsor' ? (jread('scans.json', [])[$id] ?? []) : []]);
            if ($key === '' || (!in_array($key, array_column($P, 'key'), true) && !isset(($R['dnc'] ?? [])[$key]))) fail('No such contact on this card.', 404);
            if ($on === isset(($R['dnc'] ?? [])[$key])) return ['ok' => true, 'same' => true];
            $why = clean($body['why'] ?? '', 160); if ($on && $why === '') $why = 'Asked not to be contacted';
            commit($w, [['t' => $T['dnc'], 'id' => $id, 'key' => $key, 'on' => $on, 'why' => $on ? $why : '', 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* the message templates (admins; checked in handle): a list, or reset: true for the starters again */
        case 'templates': {
            if (!empty($body['reset'])) { commit($w, [['t' => $T['templates'], 'templates' => [], 'by' => $ME, 'at' => $now]]); return ['ok' => true, 'templates' => starterTemplates($w)]; }
            $ST = []; foreach (starterTemplates($w) as $s) $ST[$s['k']] = $s; $out = []; $seen = [];
            foreach (array_slice((array) ($body['templates'] ?? []), 0, 20) as $x) {
                if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 60); if ($nm === '') continue;
                $k = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($x['k'] ?? ''))) ?: substr(preg_replace('/[^a-z0-9]+/', '-', strtolower($nm)) ?? 't', 0, 30);
                while (isset($seen[$k])) $k .= '-2'; $seen[$k] = 1;
                $t = ['k' => substr($k, 0, 40), 'name' => $nm, 'when' => in_array($x['when'] ?? '', ['new', 'voicemail', 'tour', 'proposal', 'quote', 'toured', 'tries', ''], true) ? (string) ($x['when'] ?? '') : '',
                    'text' => mb_substr(trim(str_replace("\r", '', (string) ($x['text'] ?? ''))), 0, 600), 'subject' => clean($x['subject'] ?? '', 160), 'body' => mb_substr(trim(str_replace("\r", '', (string) ($x['body'] ?? ''))), 0, 3000)];
                if ($t['text'] === '' && $t['body'] === '') fail('“' . $nm . '” needs a text or an email.');
                if (preg_match_all('/\{([^}]*)\}/', $t['text'] . $t['subject'] . $t['body'], $mm)) foreach ($mm[1] as $f) if (!in_array($f, ['first', 'company', 'tour', 'me'], true)) fail('“' . $nm . '” has {' . $f . '} in it. The fields are {first}, {company}, {tour} and {me}.');
                $s = $ST[$t['k']] ?? null; $t['starter'] = $s && $s['name'] === $t['name'] && $s['text'] === $t['text'] && $s['subject'] === $t['subject'] && $s['body'] === $t['body'];
                $out[] = $t;
            }
            if (!$out) fail('Keep at least one template.');
            commit($w, [['t' => $T['templates'], 'templates' => $out, 'by' => $ME, 'at' => $now]]); return ['ok' => true, 'templates' => $out];
        }
        case 'add': {
            /* Merge (the duplicate check): what was typed goes onto the company already on the desk, nothing new is made */
            if (!empty($body['merge'])) {
                $mid = (string) $body['merge']; $R = needRec($X, $w, $mid); $rows = [];
                $ph = clean($body['phone'] ?? '', 40); $em = okMail((string) ($body['email'] ?? '')); $cn = clean($body['cname'] ?? '', 80);
                if (($ph !== '' && !in_array(digits10($ph), recPhones($R), true)) || ($em !== '' && !in_array(strtolower($em), recEmails($R), true)) || ($cn !== '' && $em === '' && $ph === ''))
                    $rows[] = ['t' => $T['contact'], 'id' => $mid, 'contact' => ['name' => $cn, 'email' => $em, 'phone' => $ph] + ($w === 'expo' ? ['role' => clean($body['crole'] ?? '', 80), 'notes' => ''] : ['pos' => $cn === '' ? 'Phone given when added again' : '']), 'by' => $ME, 'at' => $now];
                $site = okSite((string) ($body['site'] ?? '')); if ($site !== '' && (string) ($R['site'] ?? '') === '') $rows[] = ['t' => 'site', 'id' => $mid, 'site' => $site, 'by' => $ME, 'at' => $now];
                $said = array_filter([clean($body['why'] ?? '', 300), clean($body['kind'] ?? $body['cat'] ?? '', 60), clean($body['events'] ?? '', 200)]);
                $rows[] = ['t' => $T['note'], 'id' => $mid, 'note' => 'Added again as “' . clean($body['name'] ?? '', 100) . '” and merged into this one' . ($said ? ': ' . implode(' · ', $said) : '.'), 'by' => $ME, 'at' => $now];
                commit($w, $rows); return ['ok' => true, 'id' => $mid, 'merged' => true];
            }
            $dupe = function (string $n, string $ph, string $site, string $em) use ($X, $body) {
                if (!empty($body['keep'])) return null; $d = dupesOf($X, $n, $ph, $site, $em); if (!$d) return null;
                http_response_code(409); return ['ok' => false, 'error' => 'This may already be on the desk.', 'dupes' => $d];
            };
            if ($w === 'sponsor') {
                $sameName(clean($body['name'] ?? '', 100));
                if ($d = $dupe(clean($body['name'] ?? '', 100), clean($body['phone'] ?? '', 40), (string) ($body['site'] ?? ''), '')) return $d;
                $lead = $newLead(); $rows = [['t' => 'lead', 'id' => $lead['id'], 'lead' => $lead, 'by' => $ME, 'at' => $now]];
                if ($canOwn) $rows[] = rowOwner($w, $lead['id'], $ME, $ME, $now);
                commit($w, $rows); return ['ok' => true, 'id' => $lead['id']];
            }
            /* an expo lead added by hand: it lives in the Expo leads only */
            $n = clean($body['name'] ?? '', 100); $sameName($n);
            if ($d = $dupe($n, clean($body['phone'] ?? '', 40), (string) ($body['site'] ?? ''), (string) ($body['email'] ?? ''))) return $d;
            $site = okSite((string) ($body['site'] ?? '')); if ($site !== '' && !preg_match('#^https?://#i', $site)) $site = 'https://' . $site;
            $em = okMail((string) ($body['email'] ?? '')); $pri = (int) ($body['pri'] ?? 2); if ($pri < 1 || $pri > 3) $pri = 2;
            $nid = 'x' . substr(sha1('expo-added|' . $n . '|' . microtime()), 0, 9);
            $org = ['id' => $nid, 'pri' => $pri, 'cat' => clean($body['cat'] ?? '', 60), 'name' => $n, 'events' => clean($body['events'] ?? '', 400), 'venue' => clean($body['venue'] ?? '', 160),
                'size' => clean($body['size'] ?? '', 120), 'last' => '', 'why' => clean($body['why'] ?? '', 400), 'site' => $site, 'route' => '', 'srcs' => [], 'checked' => '', 'contacts' => [], 'by' => $ME, 'mine' => true];
            $c = ['name' => clean($body['cname'] ?? '', 80), 'role' => clean($body['crole'] ?? '', 80), 'email' => $em, 'phone' => clean($body['phone'] ?? '', 40), 'notes' => ''];
            $rows = [['t' => 'xlead', 'id' => $nid, 'org' => $org, 'by' => $ME, 'at' => $now]];
            if ($c['name'] !== '' || $c['email'] !== '' || $c['phone'] !== '') $rows[] = ['t' => 'xcontact', 'id' => $nid, 'contact' => $c, 'by' => $ME, 'at' => $now];
            if ($canOwn) $rows[] = rowOwner($w, $nid, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'id' => $nid];
        }
        /* take a company off the desk (2026-10-24); everything stays in the log, and it can come back */
        case 'del': { needRec($X, $w, $id); commit($w, [['t' => $T['del'], 'id' => $id, 'by' => $ME, 'at' => $now]]); return ['ok' => true]; }
        case 'back': {
            $R = needRec($X, $w, $id, true); if (empty($R['off'])) fail($w === 'expo' ? 'That lead is in the Expo leads already.' : 'That company is on the desk already.');
            commit($w, [['t' => $T['back'], 'id' => $id, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* tours at Peak, for a sponsor or an expo lead: booking one moves it to its tour stage */
        case 'tour': {
            $R = needRec($X, $w, $id); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
            if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
            if (!okTime($tm)) fail('Pick a time.');
            $tid = bin2hex(random_bytes(5)); $em = strtolower(okMail((string) ($body['email'] ?? '')));
            /* 2026-11-19: the contact's email, the length (default 30 minutes) and whether a confirmation email was asked for */
            $rows = [['t' => $T['tour'], 'tid' => $tid, 'id' => $id, 'lead' => $id, 'date' => $d, 'time' => $tm, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 400),
                'email' => $em, 'mins' => tmMins($body['mins'] ?? 30), 'mail' => $em !== '' && !empty($body['mail']) && tmConf()['on'], 'by' => $ME, 'at' => $now]];
            $to = forwardTo($w, (string) $R['stage'], $C['tourSt']); if ($to !== '') $rows[] = rowStage($w, $id, $to, $ME, $now);
            if ($canOwn && (string) $R['owner'] === '') $rows[] = rowOwner($w, $id, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'tid' => $tid];
        }
        case 'tourdel': { $tid = (string) ($body['tid'] ?? ''); needTour($w, $tid); commit($w, [['t' => $T['tourdel'], 'tid' => $tid, 'by' => $ME, 'at' => $now]]); return ['ok' => true]; }
        case 'tourmove': {
            $tid = (string) ($body['tid'] ?? ''); needTour($w, $tid); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
            if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
            if (!okTime($tm)) fail('Pick a time.');
            commit($w, [['t' => $T['tourmove'], 'tid' => $tid, 'date' => $d, 'time' => $tm, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* how a tour went: they came (an in-person touch) or did not show */
        case 'tourout': {
            $tid = (string) ($body['tid'] ?? ''); $t = needTour($w, $tid); $o = (string) ($body['out'] ?? '');
            if (!in_array($o, ['toured', 'noshow'], true)) fail('Pick how it went.');
            $rows = [['t' => $T['tourout'], 'tid' => $tid, 'out' => $o, 'by' => $ME, 'at' => $now]];
            $R = $X[(string) ($t['lead'] ?? '')] ?? null;
            if ($R && empty($R['off'])) {
                $when = (int) strtotime($t['date'] . ' ' . $t['time']); if ($when <= 0 || $when > $now) $when = $now;
                $rows[] = rowTouch($w, (string) $R['id'], newKey(), ['m' => 'inperson', 'out' => $o, 'note' => $o === 'toured' ? 'Came for the tour at Peak' : 'Did not come for the tour', 'when' => $when, 'tid' => $tid], $ME, $now);
            }
            commit($w, $rows); return ['ok' => true];
        }
        /* ---- sponsors only ---- */
        case 'site': {
            needRec($X, $w, $id); $site = clean($body['site'] ?? '', 160);
            if (!preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
            commit($w, [['t' => 'site', 'id' => $id, 'site' => $site, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'scan': {
            /* look a company up now: its website, or (hunter) the people Hunter knows at its domain */
            $L = needRec($X, $w, $id); $hun = !empty($body['hunter']);
            @set_time_limit(120);
            if ($hun) {
                if (hunterDomain($L) === '') fail('Add their website first: Hunter searches by it.');
                $left = hunterLeft(true); if ($left === null) fail('Hunter is not set up here.'); if ($left < 1) fail('No Hunter searches left this month.');
                $r = scanAndSave($L, 'hunter'); if ($r['hunter']['err'] !== '') fail($r['hunter']['err']);
                return ['ok' => true, 'found' => count($r['hunter']['people'])];
            }
            if (siteOf($L) === '' && srcUrl($L) === '') fail('Add their website first.');
            $prev = jread('scans.json', [])[$id] ?? null;
            if ($prev && ($prev['at'] ?? 0) > time() - 60) return ['ok' => true, 'scan' => $prev];   /* looked up a minute ago */
            return ['ok' => true, 'scan' => scanAndSave($L, 'site')];
        }
        case 'proposal': {
            $R = needRec($X, $w, $id); $lines = lines($body['lines'] ?? []);
            if (!$lines) fail('Add at least one package.');
            $pid = bin2hex(random_bytes(5)); $total = array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines));
            $rows = [['t' => 'proposal', 'pid' => $pid, 'id' => $id, 'lead' => $id, 'company' => $R['name'], 'to' => clean($body['to'] ?? '', 120), 'lines' => $lines, 'total' => $total, 'note' => clean($body['note'] ?? '', 1200), 'by' => $ME, 'at' => $now]];
            $to = forwardTo($w, (string) $R['stage'], 'proposal'); if ($to !== '') $rows[] = rowStage($w, $id, $to, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'pid' => $pid, 'total' => $total];
        }
        case 'signed':
        case 'sponsor': {
            /* signed: what they bought, from when, for how long (2026-10-24). sponsor: a sponsor we just got, in one step */
            $d = (string) ($body['start'] ?? ''); $m = (int) ($body['months'] ?? 12);
            if ($op === 'sponsor') $sameName(clean($body['name'] ?? '', 100)); else $R = needRec($X, $w, $id);
            if (!okDay($d)) fail('Pick the start date.');
            if ($m < 1 || $m > 60) fail('Give the length in months (1 to 60).');
            $lines = lines($body['lines'] ?? []);
            $sg = ['lines' => $lines, 'total' => array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines)), 'start' => $d, 'months' => $m, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 600)];
            $rows = [];
            if ($op === 'sponsor') {
                $c = ['name' => clean($body['cname'] ?? '', 80), 'pos' => clean($body['cpos'] ?? '', 80), 'email' => okMail((string) ($body['cemail'] ?? '')), 'phone' => clean($body['cphone'] ?? '', 40)];
                $lead = $newLead(); $id = $lead['id']; $R = ['stage' => 'new', 'owner' => ''];
                $rows[] = ['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => $now];
                if ($c['name'] !== '' || $c['email'] !== '' || $c['phone'] !== '') $rows[] = ['t' => 'contact', 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => $now];
            }
            $rows[] = ['t' => 'signed', 'id' => $id, 'signed' => $sg, 'by' => $ME, 'at' => $now];
            if ($R['stage'] !== 'signed') $rows[] = rowStage($w, $id, 'signed', $ME, $now);
            if ($canOwn && (string) $R['owner'] === '') $rows[] = rowOwner($w, $id, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'id' => $id];
        }
        case 'todo': {
            needRec($X, $w, $id); $tx = clean($body['text'] ?? '', 160); if ($tx === '') fail('Write the to-do first.');
            commit($w, [['t' => 'todo', 'id' => $id, 'k' => bin2hex(random_bytes(4)), 'text' => $tx, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'tododone':
        case 'tododel': {
            $R = needRec($X, $w, $id); $k = (string) ($body['k'] ?? '');
            if (!in_array($k, array_column($R['todos'], 'k'), true)) fail('No such to-do.', 404);
            commit($w, [['t' => $op, 'id' => $id, 'k' => $k, 'done' => !empty($body['done']), 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'packages': {
            /* the seller sets packages too (2026-10-21, Matthew: "brandons code gives as much permissions as mine does other then full control of the
               application"); what stays the admin's is who can sign in (accounts are made on the server only) */
            $pk = [];
            foreach ((array) ($body['packages'] ?? []) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); $pr = (int) round((float) ($x['price'] ?? 0)); if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $pk[] = ['k' => substr(sha1($nm), 0, 6), 'name' => $nm, 'price' => $pr, 'per' => clean($x['per'] ?? 'year', 20), 'note' => clean($x['note'] ?? '', 160)]; }
            if (!$pk) fail('Keep at least one package.');
            commit($w, [['t' => 'packages', 'packages' => $pk, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'pl': {
            /* profit and loss (2026-10-24): every figure is typed in by someone; the page does the sums */
            $per = fn($v, array $ok, string $def) => in_array($v, $ok, true) ? $v : $def;
            $money = fn($v) => ($v === null || $v === '') ? null : max(0, min(10000000, (int) round((float) $v)));
            $sv = []; foreach (array_slice((array) ($body['services'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $sv[] = ['name' => $nm, 'price' => $money($x['price'] ?? null), 'per' => $per($x['per'] ?? '', ['year', 'month', 'once'], 'year'), 'cost' => $money($x['cost'] ?? null), 'costPer' => $per($x['costPer'] ?? '', ['year', 'month', 'once'], 'year')]; }
            $rn = []; foreach (array_slice((array) ($body['running'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $rn[] = ['name' => $nm, 'amount' => $money($x['amount'] ?? null) ?? 0, 'per' => $per($x['per'] ?? '', ['month', 'year'], 'month')]; }
            commit($w, [['t' => 'pl', 'pl' => ['services' => $sv, 'running' => $rn], 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
    }
    fail('Unknown action.', 404); return [];
}

/* ---- the end-of-day email (2026-11-18, as Sixfold's 8 pm report): who did what today, the follow-ups due on the next working day, and
   the replies and bookings the Peak email sender brought in. OFF until an admin turns it on and picks who gets it (More, Settings). The
   hourly run (php desk.php rescan, from the server's hourly cron) sends it once, after 6 pm Colorado time, Monday to Friday. It goes out
   through the server's own mailbox (desk-mail.php). DESK_MAIL_FILE (command line only) catches it in a file for the tests. ---- */
function eodConf(): array {
    $e = jread('desk-settings.json', [])['eod'] ?? [];
    return ['on' => !empty($e['on']), 'to' => array_values(array_filter((array) ($e['to'] ?? []), 'is_string')), 'by' => (string) ($e['by'] ?? ''), 'at' => (int) ($e['at'] ?? 0),
        'last' => trim((string) @file_get_contents(DATA_DIR . '/eod-last.txt')), 'hour' => EOD_HOUR];
}
/* '' when it should go now, else why not */
function eodDue(int $now): string {
    $c = eodConf();
    if (!$c['on']) return 'it is off';
    if (!$c['to']) return 'nobody is picked to get it';
    if ((int) date('N', $now) > 5) return 'it is the weekend';
    $h = (int) date('G', $now);
    if ($h < EOD_HOUR) return 'it goes at 6 pm';
    if ($h >= 23) return 'too late tonight; it goes tomorrow at 6 pm';
    if ($c['last'] === date('Y-m-d', $now)) return 'today’s already went';
    return '';
}
function eodText(int $now): array {
    $day = date('Y-m-d', $now); $from = (int) strtotime($day . ' 00:00:00');
    $tom = nextBizDay($day); $isTom = $tom === date('Y-m-d', (int) strtotime('+1 day', $from));
    $WN = ['sponsor' => 'Sponsors', 'expo' => 'Expo leads']; $L = []; $all = 0;
    $L[] = 'Peak desk, end of day: ' . date('l j F', $now);
    $L[] = '';
    $L[] = 'WHO DID WHAT TODAY';
    foreach ($WN as $w => $wn) {
        $C = counts($w, $from); $rows = [];
        foreach ($C as $who => $a) {
            if (in_array($who, ['Peak email', 'Claude Check'], true)) continue;
            $p = [];
            if ($a['calls']) $p[] = $a['calls'] . ' call' . ($a['calls'] === 1 ? '' : 's') . ($a['vms'] ? ' (' . $a['vms'] . ' voicemail' . ($a['vms'] === 1 ? '' : 's') . ')' : '');
            foreach ([['emails', 'email'], ['texts', 'text'], ['other', 'other touch'], ['tours', 'tour'], ['proposals', $w === 'expo' ? 'quote' : 'proposal'], ['signed', $w === 'expo' ? 'booked' : 'signed']] as [$k, $nm])
                if ($a[$k]) $p[] = $a[$k] . ' ' . ($k === 'signed' ? $nm : $nm . ($a[$k] === 1 ? '' : 's'));
            if (!$p) continue;
            $all += $a['calls'] + $a['emails'] + $a['texts'] + $a['other'];
            $rows[] = '  ' . $who . ': ' . implode(', ', $p);
        }
        $L[] = $wn; if (!$rows) $L[] = '  Nothing logged today.'; else array_push($L, ...$rows);
    }
    $L[] = '';
    $L[] = 'FOLLOW-UPS DUE ' . strtoupper(($isTom ? 'tomorrow, ' : '') . date('l j M', (int) strtotime($tom)));
    $late = [];
    foreach ($WN as $w => $wn) {
        $by = []; $n = 0; $late[$w] = 0;
        foreach (recs($w, false) as $R) {
            $d = (string) ($R['next']['date'] ?? ''); if ($d === '' || in_array($R['stage'], W($w)['done'], true)) continue;
            if ($d < $day) $late[$w]++;
            if ($d !== $tom) continue;
            $n++; $by[(string) $R['owner'] ?: 'Open (nobody yet)'][] = (string) $R['name'] . ((string) ($R['next']['what'] ?? '') !== '' ? ' (' . $R['next']['what'] . ')' : '');
        }
        ksort($by); $L[] = $wn . ($n ? ' (' . $n . ')' : '');
        if (!$by) $L[] = '  None.'; else foreach ($by as $who => $cs) $L[] = '  ' . $who . ': ' . implode('; ', $cs);
    }
    if ($late['sponsor'] || $late['expo']) $L[] = 'Still late from before today: ' . ($late['sponsor'] + $late['expo']) . ' (sponsors ' . $late['sponsor'] . ', expo leads ' . $late['expo'] . ').';
    $L[] = '';
    $L[] = 'FROM THE PEAK EMAIL SENDER TODAY';
    $sent = ['sponsor' => 0, 'expo' => 0]; $rep = []; $bounce = 0; $book = [];
    foreach ($WN as $w => $wn) {
        $X = recs($w);
        foreach ($X as $R) foreach ($R['touches'] ?? [] as $t) {
            if (($t['by'] ?? '') !== 'Peak email' || (int) $t['when'] < $from) continue;
            if ($t['out'] === 'sent') $sent[$w]++; elseif ($t['out'] === 'replied') $rep[] = '  ' . $R['name'] . ($w === 'expo' ? ' (expo)' : '') . ': ' . $t['note']; elseif ($t['out'] === 'bounced') $bounce++;
        }
        foreach (toursOf($w) as $t) if (!empty($t['auto']) && (int) ($t['at'] ?? 0) >= $from)
            $book[] = '  ' . (string) (($X[(string) ($t['lead'] ?? '')]['name'] ?? '') ?: 'A company') . ($w === 'expo' ? ' (expo)' : '') . ': ' . date('D j M', (int) strtotime((string) $t['date'])) . ', ' . date('g:i a', (int) strtotime((string) $t['date'] . ' ' . (string) $t['time'])) . ((string) ($t['who'] ?? '') !== '' ? ' · ' . $t['who'] : '');
    }
    if (!$sent['sponsor'] && !$sent['expo'] && !$rep && !$book && !$bounce) $L[] = '  Nothing from the sender today.';
    else {
        $L[] = '  Emails sent: ' . ($sent['sponsor'] + $sent['expo']) . ' (sponsors ' . $sent['sponsor'] . ', expo leads ' . $sent['expo'] . ')';
        $L[] = '  Replies: ' . count($rep); array_push($L, ...$rep);
        $L[] = '  Times booked: ' . count($book); array_push($L, ...$book);
        if ($bounce) $L[] = '  Bounced: ' . $bounce . ' (the address is dead; find another way in)';
    }
    $L[] = '';
    $L[] = 'Open the desk: ' . DESK_URL;
    $L[] = 'You get this because an admin picked you in the Peak desk (More, Settings). It goes at 6 pm, Monday to Friday.';
    return ['subject' => 'Peak desk, end of day ' . date('D j M', $now) . ': ' . $all . ' touch' . ($all === 1 ? '' : 'es'), 'text' => implode("\n", $L)];
}
/* one email through the server's own mailbox, in its own process (desk-mail.php) */
function deskMail(string $to, string $subject, string $body): array {
    $f = PHP_SAPI === 'cli' ? (string) getenv('DESK_MAIL_FILE') : '';
    if ($f !== '') { file_put_contents($f, json_encode(['to' => $to, 'subject' => $subject, 'body' => $body], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'test file']; }
    $p = proc_open([deskPhp(), __DIR__ . '/desk-mail.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($p)) return ['ok' => false, 'stage' => 'the mail helper did not start'];
    fwrite($pipes[0], (string) json_encode(['to' => $to, 'subject' => $subject, 'body' => $body])); fclose($pipes[0]);
    $o = (string) stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
    $j = json_decode(trim($o), true); return is_array($j) ? $j : ['ok' => false, 'stage' => 'no answer from the mail helper'];
}
/* send it when due (or $force: now, if it is on and someone is picked); once a day, under its own lock */
function eodRun(int $now, bool $force = false): array {
    $c = eodConf(); $why = $force && $c['on'] && $c['to'] ? '' : eodDue($now);
    if ($why !== '') return ['sent' => 0, 'failed' => 0, 'said' => 'not sent: ' . $why];
    $lk = fopen(DATA_DIR . '/eod.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) return ['sent' => 0, 'failed' => 0, 'said' => 'not sent: another run is sending it'];
    try {
        if (!$force && ($why = eodDue($now)) !== '') return ['sent' => 0, 'failed' => 0, 'said' => 'not sent: ' . $why];
        $m = eodText($now); $ok = 0; $bad = [];
        foreach ($c['to'] as $to) { $r = deskMail($to, $m['subject'], $m['text']); if (!empty($r['ok'])) $ok++; else $bad[] = $to . ' (' . ($r['stage'] ?? '?') . ')'; }
        if ($ok) file_put_contents(DATA_DIR . '/eod-last.txt', date('Y-m-d', $now));   /* one went: today's is done (a total failure tries again next hour) */
        $said = 'sent to ' . $ok . ' of ' . count($c['to']) . ($bad ? '; failed: ' . implode(', ', $bad) : '');
        file_put_contents(DATA_DIR . '/eod.log', date('Y-m-d H:i', $now) . ' ' . $said . "\n", FILE_APPEND | LOCK_EX);
        return ['sent' => $ok, 'failed' => count($bad), 'said' => $said];
    } finally { flock($lk, LOCK_UN); fclose($lk); }
}

/* ---- a person's calendar (2026-11-18, Sixfold's walk feed): a private link per person to subscribe to in Google or Apple Calendar. It
   carries the tours of the companies they own or booked, and their follow-ups (all-day), 30 days back to four months ahead. The link holds
   the person's id and a token made from a salt of theirs and the desk's own secret (calfeed.json); "New link" changes the salt and the old
   link stops working. Somebody no longer on the desk gets nothing. No phone numbers or emails go in it. ---- */
function calPid(string $name): string { return substr(sha1('peakdesk-cal|' . strtolower(trim($name))), 0, 12); }
function calTok(string $pid, string $salt, string $secret): string { return substr(hash_hmac('sha256', 'cal|' . $pid . '|' . $salt, $secret), 0, 32); }
function calLink(string $name, bool $renew): ?array {
    $lk = fopen(DATA_DIR . '/calfeed.lock', 'c'); if (!$lk) return null; flock($lk, LOCK_EX);
    try {
        $all = jread('calfeed.json', []); if (empty($all['secret'])) $all['secret'] = bin2hex(random_bytes(16));
        $pid = calPid($name);
        if ($renew || empty($all['p'][$pid]['salt'])) { $all['p'][$pid] = ['name' => $name, 'salt' => bin2hex(random_bytes(8)), 'at' => time()]; if (!jwrite('calfeed.json', $all)) return null; @chmod(DATA_DIR . '/calfeed.json', 0600); }
        return ['p' => $pid, 't' => calTok($pid, (string) $all['p'][$pid]['salt'], (string) $all['secret']), 'at' => (int) $all['p'][$pid]['at']];
    } finally { flock($lk, LOCK_UN); fclose($lk); }
}
function calFeed(string $pid, string $tok): void {
    $nf = function (): void { http_response_code(404); header('Content-Type: text/plain; charset=utf-8'); echo "Not found.\n"; exit; };
    if (!preg_match('/^[0-9a-f]{12}$/D', $pid) || !preg_match('/^[0-9a-f]{32}$/D', $tok)) $nf();
    $all = jread('calfeed.json', []); $p = $all['p'][$pid] ?? null;
    if (!$p || empty($all['secret']) || !hash_equals(calTok($pid, (string) $p['salt'], (string) $all['secret']), $tok)) $nf();
    $name = (string) $p['name']; $role = null;
    foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) if (strcasecmp((string) ($a['name'] ?? ''), $name) === 0) $role = (string) ($a['role'] ?? '');
    if ($role === null) $nf();
    $from = date('Y-m-d', strtotime('-30 days')); $to = date('Y-m-d', strtotime('+120 days')); $stamp = gmdate('Ymd\THis\Z');
    $L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peak Pickleball//Peak desk//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' . icsEsc('Peak desk · ' . explode(' ', $name)[0]),
        'X-WR-TIMEZONE:America/Denver', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    $ev = function (array $e) use (&$L, $stamp): void { $L[] = 'BEGIN:VEVENT'; $L[] = 'UID:' . $e['uid'] . '@peak-desk'; $L[] = 'DTSTAMP:' . $stamp; foreach ($e['when'] as $x) $L[] = $x; $L[] = 'SUMMARY:' . icsEsc($e['sum']); if (!empty($e['loc'])) $L[] = 'LOCATION:' . icsEsc($e['loc']); $L[] = 'DESCRIPTION:' . icsEsc($e['desc']); $L[] = 'END:VEVENT'; };
    foreach ($role === 'expo' ? ['expo'] : ['sponsor', 'expo'] as $w) {
        $X = recs($w); $tag = $w === 'expo' ? ' (expo)' : '';
        foreach (toursOf($w) as $t) {
            $R = $X[(string) ($t['lead'] ?? '')] ?? null; $d = (string) ($t['date'] ?? '');
            if (!$R || !empty($R['off']) || $d < $from || $d > $to || ((string) $R['owner'] !== $name && (string) ($t['by'] ?? '') !== $name) || !okDay($d) || !okTime((string) ($t['time'] ?? ''))) continue;
            $st = new DateTime($d . ' ' . $t['time'], new DateTimeZone('America/Denver')); $st->setTimezone(new DateTimeZone('UTC'));
            $ev(['uid' => 'tour-' . preg_replace('/[^a-z0-9]/', '', (string) $t['tid']), 'when' => ['DTSTART:' . $st->format('Ymd\THis\Z'), 'DURATION:PT' . (!empty($t['mins']) ? (int) $t['mins'] . 'M' : '1H')], 'sum' => 'Peak tour' . $tag . ': ' . $R['name'],
                'loc' => 'Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920',
                'desc' => implode("\n", array_filter([(string) ($t['who'] ?? '') !== '' ? 'Coming: ' . $t['who'] : '', (string) ($t['note'] ?? ''), 'Booked by ' . ($t['by'] ?? 'someone') . '.', !empty($t['out']) ? ($t['out'] === 'toured' ? 'They came.' : 'They did not show.') : '', 'The rest is on the desk: ' . DESK_URL]))]);
        }
        foreach ($X as $R) {
            $d = (string) ($R['next']['date'] ?? '');
            if (!empty($R['off']) || (string) $R['owner'] !== $name || $d === '' || $d < $from || $d > $to || !okDay($d) || in_array($R['stage'], W($w)['done'], true)) continue;
            $what = (string) ($R['next']['what'] ?? '');
            $ev(['uid' => 'fu-' . $w . '-' . preg_replace('/[^a-z0-9]/', '', (string) $R['id']), 'when' => ['DTSTART;VALUE=DATE:' . str_replace('-', '', $d), 'DTEND;VALUE=DATE:' . date('Ymd', (int) strtotime($d . ' +1 day')), 'TRANSP:TRANSPARENT'],
                'sum' => 'Follow up' . $tag . ': ' . $R['name'] . ($what !== '' && $what !== 'Follow up' ? ' (' . $what . ')' : ''), 'desc' => 'Stage: ' . (W($w)['stages'][$R['stage']] ?? $R['stage']) . '. The rest is on the desk: ' . DESK_URL]);
        }
    }
    $L[] = 'END:VCALENDAR';
    header('Content-Type: text/calendar; charset=utf-8'); header('Cache-Control: no-cache, private'); header('Content-Disposition: inline; filename="peak-desk.ics"');
    echo implode("\r\n", array_map('icsFold', $L)) . "\r\n";
    exit;
}

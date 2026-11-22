<?php
/* Matthew's assistant (2026-10-22), first part: email. The page (public/index.html) talks to this through public/api.php.
   Lives outside public_html; nothing here is reachable by URL. */
declare(strict_types=1);

$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google', 'mail', 'claude', 'sorter', 'chat', 'groceries', 'kroger', 'jarvis', 'desk', 'voice', 'tts', 'meet', 'brief', 'money', 'paystub'] as $f) require __DIR__ . '/lib/' . $f . '.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
$action = (string) ($_GET['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
function out(array $j, int $code = 200): never { http_response_code($code); header('Content-Type: application/json; charset=utf-8'); echo json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
if ($isPost && !sameOrigin()) out(['ok' => false, 'error' => 'Not from this page.'], 403);

/* Google sends the person back here after Connect: finish, then back to the page */
if ($action === 'oauth') {
    if (!signedIn()) { header('Location: ./?err=' . rawurlencode('Sign in first, then connect.')); exit; }
    $err = isset($_GET['error']) ? 'Google said: ' . (string) $_GET['error'] : gCallback((string) ($_GET['code'] ?? ''), (string) ($_GET['state'] ?? ''));
    $back = gReturn(); header('Location: ./' . $back . ($err ? '?err=' . rawurlencode($err) : '?connected=1')); exit;
}
if ($action === 'state') {   /* what the page needs before signing in */
    $c = cfg();
    out(['ok' => true, 'signedIn' => signedIn(), 'needsPassword' => empty($c['passwordHash'])]);
}
if ($action === 'signin') {
    if (!$isPost) out(['ok' => false], 405);
    if (tooManyTries()) out(['ok' => false, 'error' => 'Too many tries. Wait 15 minutes.'], 429);
    out(signIn((string) ($body['password'] ?? '')) ? ['ok' => true] : ['ok' => false, 'error' => 'That password is not right.'], 200);
}
if ($action === 'firstpassword') {
    if (!$isPost) out(['ok' => false], 405);
    $e = firstPassword((string) ($body['code'] ?? ''), (string) ($body['password'] ?? ''));
    out($e === null ? ['ok' => true] : ['ok' => false, 'error' => $e]);
}
/* the shared grocery list: Matthew signed in, or Claire with her own grocery-only password (lib/groceries.php) */
if (in_array($action, ['gro', 'groadd', 'groset', 'groedit', 'grodel', 'groclear', 'gropick', 'grosearch', 'grologin', 'grologout', 'gropass', 'grousers'], true)) groAction($action, $body, $isPost);
/* 19 Nov: the laptop's side of the J.A.R.V.I.S. desk (lib/desk.php), with the laptop's key in an X-Jarvis-Key header (only its hash is kept
   here; the key is in the laptop's ~/.ssh). jvdpending: how many threads wait (a bare number, for help-watch.sh's 5-second look);
   jvdreply: the session's answer (assistant/jarvis/tools/jarvis-reply.sh). Wrong keys count as wrong sign-in tries. */
if ($action === 'jvdpending' || $action === 'jvdreply') {
    if (tooManyTries()) out(['ok' => false, 'error' => 'Too many tries.'], 429);
    if (!jdKeyOk((string) ($_SERVER['HTTP_X_JARVIS_KEY'] ?? ''))) { noteTry(); out(['ok' => false, 'error' => 'Not allowed.'], 403); }
    if ($action === 'jvdpending') { header('Content-Type: text/plain; charset=utf-8'); echo jdPending(); exit; }
    if (!$isPost) out(['ok' => false], 405);
    $fl = array_values(array_filter((array) ($body['files'] ?? []), 'is_string'));
    out(jdReply((string) ($body['id'] ?? ''), (string) ($body['status'] ?? 'answered'), (string) ($body['text'] ?? ''), !empty($body['refresh']), $fl));
}
/* 20 Nov (P-12): the meeting transcriber on the laptop asks over HTTPS (the same laptop key) how many recordings it may take now: a bare
   number. Over SSH it uses jvmeet.php (peek, next, seg, done). */
if ($action === 'jvmpending') {
    if (tooManyTries()) out(['ok' => false, 'error' => 'Too many tries.'], 429);
    if (!jdKeyOk((string) ($_SERVER['HTTP_X_JARVIS_KEY'] ?? ''))) { noteTry(); out(['ok' => false, 'error' => 'Not allowed.'], 403); }
    $w = (string) ($_GET['who'] ?? 'laptop'); if (!mtWho($w)) out(['ok' => false], 400);
    header('Content-Type: text/plain; charset=utf-8'); echo mtPeek($w); exit;
}
/* 19 Nov: talk without Siri (lib/voice.php): the iPhone Shortcut's door, with that device's voice key in an X-Voice-Key header. Plain text
   back, made to be heard; anything that would send or post only ever becomes a draft. */
if ($action === 'voice') { @set_time_limit(90); voiceHttp($body, $isPost); }
/* 20 Nov (P-11): the natural voice (lib/tts.php). ttsget: a signed 15-minute link to audio already made (the Shortcut's optional audio);
   tts with a voice key: the words as audio/mpeg. Anything else about the voice needs his sign-in, below. */
if ($action === 'ttsget') ttsGet((string) ($_GET['id'] ?? ''), (int) ($_GET['e'] ?? 0), (string) ($_GET['s'] ?? ''));
if ($action === 'tts' && isset($_SERVER['HTTP_X_VOICE_KEY'])) {
    if (!$isPost) out(['ok' => false], 405);
    if (tooManyTries()) out(['ok' => false, 'error' => 'Too many tries.'], 429);
    $k = voKeyCheck((string) $_SERVER['HTTP_X_VOICE_KEY']);
    if (!$k) { noteTry(); alog('voice key refused', ['ip' => ip(), 'for' => 'tts']); out(['ok' => false, 'error' => 'Not allowed.'], 401); }
    if (!voRateOk($k['id'])) out(['ok' => false, 'fallback' => true, 'why' => 'rate'], 429);
    @set_time_limit(60); ttsDirect((string) ($body['text'] ?? ($_POST['text'] ?? '')));
}
if (!signedIn()) out(['ok' => false, 'error' => 'Signed out.'], 401);
mtSweepMaybe();   /* 20 Nov (P-12): the stalled-recording alert and the rest of the meeting clock work, at most every 30 s */
/* 20 Nov (P-12): record a meeting (lib/meet.php): start (only with the consent tap), the pieces as they are made, pause/resume/stop/keep/discard,
   his recordings, a raw transcript */
if (in_array($action, ['jvmeetstart', 'jvmeetchunk', 'jvmeetstate', 'jvmeetlist', 'jvmeettext'], true)) mtHttp($action, $action === 'jvmeetchunk' ? [] : $body, $isPost);
/* 19 Nov: the voice keys (one per device, shown once, only their hash kept) and the setup page's "Try it here" */
if ($action === 'jvvoicekeys') out(['ok' => true, 'keys' => voKeyList(), 'url' => voUrl()]);
if ($action === 'jvvoicekeynew') { if (!$isPost) out(['ok' => false], 405); out(voKeyNew((string) ($body['name'] ?? ''))); }
if ($action === 'jvvoicekeydrop') { if (!$isPost) out(['ok' => false], 405); out(voKeyDrop((string) ($body['id'] ?? ''))); }
/* 20 Nov (P-11): the natural voice for the page: its state, step 1 (the words, kept privately), step 2 (play, streamed), or all in one */
if ($action === 'ttsstate') out(['ok' => true, 'tts' => ttsState()]);
if ($action === 'ttsprep') { if (!$isPost) out(['ok' => false], 405); out(ttsPrep((string) ($body['text'] ?? ''), max(0, (int) ($body['left'] ?? 0)))); }
if ($action === 'ttsplay') { session_write_close(); @set_time_limit(60); ttsPlay((string) ($_GET['id'] ?? '')); }
if ($action === 'tts') { if (!$isPost) out(['ok' => false], 405); session_write_close(); @set_time_limit(60); ttsDirect((string) ($body['text'] ?? '')); }
if ($action === 'voicetry') { if (!$isPost) out(['ok' => false], 405); @set_time_limit(90); out(voiceTry((string) ($body['text'] ?? ''))); }

if ($action === 'signout') { $_SESSION = []; session_destroy(); out(['ok' => true]); }
if ($action === 'home') {
    $accts = [];
    foreach (jget('accounts.json') as $e => $a) $accts[] = ['email' => $e, 'label' => $a['label'], 'about' => $a['about'], 'signature' => $a['signature'], 'on' => !empty($a['on']),
        'lastCheck' => (int) ($a['lastCheck'] ?? 0), 'needsReconnect' => !empty($a['needsReconnect'])];
    $items = array_values(array_filter(jget('items.json'), fn($i) => ($i['status'] ?? 'open') === 'open'));
    usort($items, fn($a, $b) => $b['date'] <=> $a['date']);
    $c = cfg();
    out(['ok' => true, 'accounts' => $accts, 'items' => $items, 'settings' => settings(), 'spend' => spendSummary(), 'tts' => ttsState(),
        'setup' => ['anthropic' => !empty($c['anthropicKey']), 'google' => !empty($c['googleClientId']) && !empty($c['googleClientSecret']), 'redirect' => gRedirect()]]);
}
/* 21 Nov (P-13): the full morning brief's weather and news (lib/brief.php): the copy made at 5:30 am, or made now when it is over 2 hours
   old (&fresh=1: his Refresh, at most every 10 minutes). The session is let go first, so the page keeps working while the feeds are read. */
if ($action === 'jvbrief') { session_write_close(); @set_time_limit(90); out(brGet(!empty($_GET['fresh'])) + ['tts' => ttsState()]); }
/* 21 Nov: the top bar's weather now (lib/brief.php brNow): kept 25 minutes on the server, so the page's own 25-minute timer reads it at most once each */
if ($action === 'jvweather') { session_write_close(); @set_time_limit(30); out(brNow()); }
/* J.A.R.V.I.S., the merged page (2026-11-18): the laptop's pushed status (overnight check, builds) and the calendar placeholder; lib/jarvis.php */
if ($action === 'jvstatus') out(jvStatus());
/* 21 Nov (P-15): money, read only (lib/money.php, lib/paystub.php): the Money sheet, his Refresh (at most every 10 minutes; SimpleFIN's fair use
   is about 24 pulls a day), his choices (a category, a company tag, the alert settings, the Bills & debts register) and a pay stub from the
   phone. Nothing here can move money. */
if ($action === 'jvmoney') { session_write_close(); out(mnView(true)); }
if ($action === 'jvmoneysync') { if (!$isPost) out(['ok' => false], 405); session_write_close(); @set_time_limit(150); $r = mnSync('manual'); out(['ok' => $r['ok'], 'error' => $r['error'] ?? '', 'cool' => !empty($r['cool']), 'counts' => $r['counts'] ?? null, 'view' => mnView(true)]); }
if ($action === 'jvmoneyset') { if (!$isPost) out(['ok' => false], 405); out(mnSet($body)); }
if ($action === 'jvstub') { if (!$isPost) out(['ok' => false], 405); session_write_close(); @set_time_limit(150); $pdf = base64_decode((string) ($body['data'] ?? ''), true);
    out($pdf === false ? ['ok' => false, 'error' => 'That file did not come through.'] : stAdd($pdf, (string) ($body['name'] ?? 'pay stub.pdf'), 'page')); }
if ($action === 'jvteamhide') { if (!$isPost) out(['ok' => false], 405); out(jvTeamHide((string) ($body['key'] ?? ''), (int) ($body['updated'] ?? 0))); }
if ($action === 'jvbuildhide') { if (!$isPost) out(['ok' => false], 405); out(jvHide((string) ($body['id'] ?? ''), (int) ($body['at'] ?? 0))); }
/* 19 Nov (P-8): reminders (add, done, undo, snooze, delete) and Matthew's tap on one "Waiting on you" item; lib/jarvis.php */
if ($action === 'jvremind') { if (!$isPost) out(['ok' => false], 405); out(jvRemAdd((string) ($body['text'] ?? ''), (string) ($body['date'] ?? ''), (string) ($body['time'] ?? ''), is_array($body['money'] ?? null) ? $body['money'] : null, 'page')); }
if ($action === 'jvremindset') { if (!$isPost) out(['ok' => false], 405); out(jvRemSet((string) ($body['id'] ?? ''), (string) ($body['op'] ?? ''), (int) ($body['days'] ?? 1))); }
if ($action === 'jvdecide') { if (!$isPost) out(['ok' => false], 405); out(jvDecide($body)); }
/* 19 Nov: his desk chats, in J.A.R.V.I.S. itself (lib/desk.php), and its own phone alerts (lib/jarvis.php jvPush) */
if ($action === 'jvdesk') out(['ok' => true, 'threads' => jdList(), 'pending' => jdPending()]);
if ($action === 'jvdeskfile') jdServeFile((string) ($_GET['id'] ?? ''), (string) ($_GET['f'] ?? ''), !empty($_GET['dl']));
if ($action === 'jvdesksend') { if (!$isPost) out(['ok' => false], 405); @set_time_limit(60); out(jdSend($body)); }
if ($action === 'jvdeskclose') { if (!$isPost) out(['ok' => false], 405); out(jdClose((string) ($body['id'] ?? ''))); }
if ($action === 'jvpushkey') { $v = jvVapid(true); out($v ? ['ok' => true, 'publicKey' => $v['publicKey']] : ['ok' => false, 'error' => 'Alerts are not set up on this server yet.'], $v ? 200 : 503); }
if ($action === 'jvpushstate') out(jvPushState());
if ($action === 'jvpushsub') { if (!$isPost) out(['ok' => false], 405); out(jvSubAdd(is_array($body['subscription'] ?? null) ? $body['subscription'] : [], (string) ($body['device'] ?? 'device'), !empty($body['phone']))); }
if ($action === 'jvpushunsub') { if (!$isPost) out(['ok' => false], 405); out(jvSubDrop((string) ($body['endpoint'] ?? ''))); }
if ($action === 'jvpushtest') { if (!$isPost) out(['ok' => false], 405); $w = jvWebPush('J.A.R.V.I.S.', 'Test: alerts reach this device. Tap to open J.A.R.V.I.S.', '/a-e018bb82/jarvis/', 'jv-test'); out(['ok' => $w['sent'] > 0, 'sent' => $w['sent'], 'error' => $w['sent'] ? '' : 'No device took it. Turn alerts on first.']); }
if (!$isPost) out(['ok' => false, 'error' => 'POST needed.'], 405);
if ($action === 'setup') {   /* keys go in here, never through chat; an empty field leaves the saved one alone */
    jedit('config.json', function ($c) use ($body) {
        foreach (['anthropicKey' => 'anthropic', 'googleClientId' => 'googleId', 'googleClientSecret' => 'googleSecret'] as $k => $f) { $v = trim((string) ($body[$f] ?? '')); if ($v !== '') $c[$k] = $v; }
        if (isset($body['settings']) && is_array($body['settings'])) {
            $s = $body['settings'];
            $c['settings'] = ['skipTabs' => !empty($s['skipTabs']), 'autoDraft' => !empty($s['autoDraft']), 'perRun' => max(1, min(50, (int) ($s['perRun'] ?? 20))), 'budget' => max(1, min(10000, (float) ($s['budget'] ?? 100))),
                'voice' => mb_substr(trim((string) ($s['voice'] ?? '')), 0, 1000) ?: settings()['voice']];
        }
        return $c;
    });
    alog('setup saved');
    out(['ok' => true]);
}
if ($action === 'connect') {
    if (empty(gClient()['id'])) out(['ok' => false, 'error' => 'Add the Google client in Setup first.']);
    out(['ok' => true, 'url' => gAuthUrl(!empty($body['cal']), !empty($body['hub']))]);
}
if ($action === 'account') {   /* label, what the inbox is for, sign-off, on or off, or disconnect */
    $email = strtolower((string) ($body['email'] ?? ''));
    $all = jedit('accounts.json', function ($a) use ($email, $body) {
        if (!isset($a[$email])) return $a;
        if (!empty($body['remove'])) { unset($a[$email]); return $a; }
        foreach (['label' => 40, 'about' => 600, 'signature' => 80] as $k => $n) if (isset($body[$k])) $a[$email][$k] = mb_substr(trim((string) $body[$k]), 0, $n);
        if (isset($body['on'])) $a[$email]['on'] = (bool) $body['on'];
        return $a;
    });
    out(['ok' => true, 'removed' => !isset($all[$email])]);
}
if ($action === 'check') { @set_time_limit(280); out(checkAll()); }
if ($action === 'draft') { @set_time_limit(120); out(draftNow((string) ($body['key'] ?? ''))); }
/* replying from the assistant (2026-10-22, Matthew: "respond right in the assistant"): open the email in full with its draft, have Claude
   write one, save it, or send it. Send happens only from the page's Send button after Matthew confirms; nothing else in this app sends. */
function itemAndMessage(string $key): array {
    $it = jget('items.json')[$key] ?? null;
    if (!$it) out(['ok' => false, 'error' => 'That email is not in the list any more.']);
    $acct = jget('accounts.json')[$it['acct']] ?? null;
    if (!$acct) out(['ok' => false, 'error' => 'That inbox is not connected.']);
    $m = readMessage($it['acct'], $it['id']);
    if (!$m) out(['ok' => false, 'error' => 'Gmail did not send that email back. Try again in a minute.']);
    return [$it, $acct, $m];
}
if ($action === 'open') {
    [$it, $acct, $m] = itemAndMessage((string) ($body['key'] ?? ''));
    $draft = !empty($it['draftId']) ? draftText($it['acct'], (string) $it['draftId']) : null;
    if ($draft === null && !empty($it['draftId'])) jedit('items.json', function ($all) use ($it) { $k = $it['acct'] . ':' . $it['id']; if (isset($all[$k])) $all[$k]['draftId'] = null; return $all; });   /* sent or deleted in Gmail */
    out(['ok' => true, 'from' => $m['from'], 'to' => $m['to'], 'cc' => $m['cc'], 'replyTo' => $m['replyTo'] !== '' ? $m['replyTo'] : $m['from'], 'subject' => $m['subject'], 'date' => $m['date'],
        'text' => $m['text'] !== '' ? $m['text'] : $m['snippet'], 'draft' => $draft, 'inbox' => $it['acct'], 'signature' => $acct['signature'] ?? 'Matthew']);
}
if ($action === 'write') {   /* Claude writes (or rewrites, with Matthew's note) a reply; it comes back to the box, nothing is saved yet */
    @set_time_limit(120);
    [$it, $acct, $m] = itemAndMessage((string) ($body['key'] ?? ''));
    $note = mb_substr(trim((string) ($body['note'] ?? '')), 0, 500);
    $text = draftReply($m, $acct, trim(($it['todo'] ?? '') . ($note !== '' ? '. Matthew says: ' . $note : '')));
    out($text === null ? ['ok' => false, 'error' => 'No reply came back. Try again in a minute.'] : ['ok' => true, 'text' => $text]);
}
if ($action === 'savedraft' || $action === 'send') {
    $key = (string) ($body['key'] ?? ''); $text = rtrim((string) ($body['text'] ?? ''));
    if (trim($text) === '') out(['ok' => false, 'error' => 'The reply is empty.']);
    if (mb_strlen($text) > 20000) out(['ok' => false, 'error' => 'That reply is too long for here: send it from Gmail.']);
    [$it, $acct, $m] = itemAndMessage($key);
    if ($action === 'savedraft') {
        $did = saveDraft($it['acct'], $m, $it['draftId'] ?? null, $text);
        if (!$did) out(['ok' => false, 'error' => 'Gmail did not take the draft.']);
        jedit('items.json', function ($all) use ($key, $did) { if (isset($all[$key])) $all[$key]['draftId'] = $did; return $all; });
        out(['ok' => true]);
    }
    if (empty($body['confirmed'])) out(['ok' => false, 'error' => 'Not confirmed.']);
    $r = sendReply($it['acct'], $m, $it['draftId'] ?? null, $text);
    if (!$r['ok']) out($r);
    jedit('items.json', function ($all) use ($key) { if (isset($all[$key])) { $all[$key]['status'] = 'done'; $all[$key]['sentAt'] = time(); $all[$key]['draftId'] = null; } return $all; });
    alog('reply sent', ['inbox' => $it['acct'], 'to' => addrOf($m['replyTo'] !== '' ? $m['replyTo'] : $m['from']), 'subject' => mb_substr($m['subject'], 0, 80)]);
    out(['ok' => true]);
}
/* the chat (2026-10-22): the conversation so far, a new message, or a fresh start */
if ($action === 'chatlog') out(['ok' => true, 'turns' => jget('chat.json')['turns'] ?? []]);
if ($action === 'chat') {
    @set_time_limit(240);
    $text = trim((string) ($body['text'] ?? ''));
    if ($text === '' || mb_strlen($text) > 4000) out(['ok' => false, 'error' => $text === '' ? 'Say something first.' : 'That is too long for one message.']);
    out(chatTurn($text));
}
if ($action === 'chatclear') { jput('chat.json', ['turns' => []]); out(['ok' => true]); }
if ($action === 'done') {
    $key = (string) ($body['key'] ?? '');
    jedit('items.json', function ($all) use ($key) { if (isset($all[$key])) $all[$key]['status'] = 'done'; return $all; });
    out(['ok' => true]);
}
out(['ok' => false, 'error' => 'No such action.'], 404);

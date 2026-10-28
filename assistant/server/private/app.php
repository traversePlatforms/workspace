<?php
/* Matthew's assistant (2026-10-22), first part: email. The page (public/index.html) talks to this through public/api.php.
   Lives outside public_html; nothing here is reachable by URL. */
declare(strict_types=1);

$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google', 'mail', 'claude', 'sorter', 'chat', 'groceries'] as $f) require __DIR__ . '/lib/' . $f . '.php';

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
    header('Location: ./' . ($err ? '?err=' . rawurlencode($err) : '?connected=1')); exit;
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
/* the shared grocery list: signed in, or with its private link (lib/groceries.php) */
if (in_array($action, ['gro', 'groadd', 'groset', 'groedit', 'grodel', 'groclear', 'groshare'], true)) groAction($action, $body, $isPost);
if (!signedIn()) out(['ok' => false, 'error' => 'Signed out.'], 401);

if ($action === 'signout') { $_SESSION = []; session_destroy(); out(['ok' => true]); }
if ($action === 'home') {
    $accts = [];
    foreach (jget('accounts.json') as $e => $a) $accts[] = ['email' => $e, 'label' => $a['label'], 'about' => $a['about'], 'signature' => $a['signature'], 'on' => !empty($a['on']),
        'lastCheck' => (int) ($a['lastCheck'] ?? 0), 'needsReconnect' => !empty($a['needsReconnect'])];
    $items = array_values(array_filter(jget('items.json'), fn($i) => ($i['status'] ?? 'open') === 'open'));
    usort($items, fn($a, $b) => $b['date'] <=> $a['date']);
    $c = cfg();
    out(['ok' => true, 'accounts' => $accts, 'items' => $items, 'settings' => settings(), 'spend' => spendSummary(),
        'setup' => ['anthropic' => !empty($c['anthropicKey']), 'google' => !empty($c['googleClientId']) && !empty($c['googleClientSecret']), 'redirect' => gRedirect()]]);
}
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
    out(['ok' => true, 'url' => gAuthUrl()]);
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

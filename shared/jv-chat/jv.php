<?php
/* J.A.R.V.I.S. for the Peak desk and the post calendar: the watcher's server tool (2026-11-21, TASKS JV-APPS). On the server it is
 * ~/www/traverseplatforms.com/jv-tools/jv.php (beside public_html, never served); the laptop's watcher (traverse/ops/help-watch.sh), the cloud
 * watcher (help-watch-cloud.sh) and the reply script (traverse/ops/jv-reply.sh) run it over SSH. Each app's chat is its own help.log in its
 * own data folder (shared/jv-chat/jv-lib.php explains); this loads the app's own copy of that code.
 *
 *   php jv.php <peak|posts> next [--peek]                     the oldest waiting conversation as JSON (marked working), or nothing
 *   php jv.php <peak|posts> count                             how many are waiting
 *   php jv.php <peak|posts> reply <id> <answered|matthew|working> [refresh] [file=<name.pdf> ...] < text
 *        the writer is told the way the app tells people (Peak: the desk's own push and email alerts; the post calendar has no alerts,
 *        so its chat button shows the dot). "matthew" is passed to Matthew by the caller (jarvis-status.sh alert), not from here.
 *   php jv.php <peak|posts> transcript <id> <a....webm> [--failed] < text
 *   php jv.php <peak|posts> attach <id> <name.pdf> < file.pdf
 *   php jv.php <peak|posts> final-since <id> <unix time>     exit 0 when a final reply was written since then
 *   php jv.php posts act <id> list [client] | show <post> | edit <post> <fb|ig|li|li_comment> < text | date <post> <YYYY-MM-DD> <HH:MM>
 *        | undate <post> | photo <post> <p....jpg> [index]
 *        the post calendar J.A.R.V.I.S.'s only way to change anything: as the person who wrote the conversation (their account as it is
 *        now: role and clients), only while that conversation is being worked on, only drafts' words, dates and photos. Never approves,
 *        never publishes, never removes, never touches holds, roll forward, pins or the Meta/LinkedIn connections. A refusal prints
 *        "REFUSED: <why>" and exits 3; the session passes it to Matthew.
 * Test hooks: JV_PEAK_API (the Peak desk's api folder), PC_LIB (the post calendar's lib.php), JV_NOW. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$SITE = rtrim((string) (getenv('JV_SITE') ?: (getenv('HOME') . '/www/traverseplatforms.com')), '/');
[$app, $cmd] = [(string) ($argv[1] ?? ''), (string) ($argv[2] ?? '')];
$a3 = (string) ($argv[3] ?? ''); $a4 = (string) ($argv[4] ?? '');
function jvOut($v): void { echo is_string($v) ? $v : json_encode($v, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; }
function jvDie(string $m, int $c = 2): void { fwrite(STDERR, $m . "\n"); exit($c); }
function jvRefuse(string $m): void { echo 'REFUSED: ' . $m . "\n"; exit(3); }

/* ---- load the app ---- */
if ($app === 'peak') {
    $api = rtrim((string) (getenv('JV_PEAK_API') ?: $SITE . '/public_html/peak-desk-28d38d/api'), '/');
    if (!is_file($api . '/desk-store.php')) jvDie('no Peak desk at ' . $api);
    define('DESK', 1);
    require $api . '/desk-store.php';
    require_once $api . '/desk-inbox.php';
    require_once (getenv('JV_LIB') ?: $api . '/jv-lib.php');
    jvInit(DATA_DIR . '/jarvis', 'peak');
} elseif ($app === 'posts') {
    define('PC', 1);
    $lib = (string) (getenv('PC_LIB') ?: $SITE . '/post-calendar-tools/lib.php'); if (!is_file($lib)) jvDie('no post calendar at ' . $lib);
    require $lib;
    require_once (getenv('JV_LIB') ?: dirname($lib) . '/jv-lib.php');
    jvInit(PC_DATA . '/jarvis', 'posts');
} else jvDie("usage: php jv.php <peak|posts> next|count|reply|transcript|attach|final-since|act ...");

/* how the writer hears of a reply, the app's own way */
function jvTell(string $app, string $who, string $status, string $short, string $id): void {
    if ($status === 'working' || $who === '') return;   /* a progress note pings nobody; the chat shows it */
    try {
        if ($app === 'peak' && function_exists('alertNew')) {
            $title = $status === 'matthew' ? 'J.A.R.V.I.S. passed it to Matthew' : 'J.A.R.V.I.S. replied';
            alertNew('jv:' . $id . ':' . jvNow(), 'jarvis', $title . ': ' . $short, './#jarvis/' . $id, [$who]);
            alertsFlush();
        }
    } catch (Throwable $e) { fwrite(STDERR, 'alert not sent: ' . $e->getMessage() . "\n"); }
}

switch ($cmd) {
    case 'next': { $t = jvNext(in_array('--peek', $argv, true)); if ($t) jvOut($t); exit(0); }
    case 'count': jvOut((string) jvCount()); exit(0);
    case 'reply': {
        $files = []; foreach (array_slice($argv, 5) as $x) if (strncmp($x, 'file=', 5) === 0) $files[] = substr($x, 5);
        $r = jvReply($a3, $a4, (string) stream_get_contents(STDIN), in_array('refresh', array_slice($argv, 5), true), $files);
        if (isset($r['error'])) jvDie($r['error']);
        jvTell($app, (string) $r['who'], $a4, (string) $r['short'], $a3);
        echo "replied ($a4) to {$r['who']}\n"; exit(0);
    }
    case 'transcript': { $r = jvTranscript($a3, $a4, (string) stream_get_contents(STDIN), in_array('--failed', $argv, true)); if (isset($r['error'])) jvDie($r['error']); echo "transcript saved: $a4\n"; exit(0); }
    case 'attach': { $r = jvAttach($a3, $a4, (string) stream_get_contents(STDIN)); if (isset($r['error'])) jvDie($r['error']); echo $r['name'], ' ', $r['size'], "\n"; exit(0); }
    case 'final-since': exit(jvFinalSince($a3, (int) $a4) ? 0 : 1);
    case 'act': if ($app === 'posts') break; jvDie('act: the post calendar only');
    default: jvDie("unknown command: $cmd");
}

/* ---- the post calendar: act as the conversation's writer ---- */
$W = jvWorking($a3); if (!$W) jvRefuse('that conversation is not being worked on');
[$TK, $LAST] = $W;
$acct = (string) ($LAST['acct'] ?? ''); $codes = (array) (pcJread('accounts.json', ['codes' => []])['codes'] ?? []);
$A = $acct !== '' ? ($codes[$acct] ?? null) : null;
if ($acct === '') {   /* a sign-in from before 16 Nov carries no account key: the one account with that name and role, if there is exactly one */
    $m = array_values(array_filter($codes, fn($a) => strcasecmp((string) ($a['name'] ?? ''), (string) $LAST['from']) === 0 && (string) ($a['role'] ?? '') === (string) ($LAST['role'] ?? '')));
    $A = count($m) === 1 ? $m[0] : null;
}
if (!$A) jvRefuse('the person who wrote has no post calendar account now');
$ROLE = (string) $A['role']; $ME = (string) $A['name'];
if (!in_array($ROLE, ['admin', 'editor', 'client'], true)) jvRefuse('that account cannot change posts');
$SCOPE = $ROLE === 'client' ? array_values(array_map('strval', (array) ($A['clients'] ?? []))) : null;
$BY = $ME . ' (by J.A.R.V.I.S.)';
$inScope = fn(string $c) => $SCOPE === null || in_array($c, $SCOPE, true);
$op = $a4; $pid = (string) ($argv[5] ?? '');
$S = pcState();
$brief = function (array $p) use ($S): array {
    return ['id' => $p['id'], 'client' => $p['client'], 'clientName' => $S['clients'][$p['client']]['name'] ?? $p['client'], 'status' => $p['status'], 'type' => $p['type'],
        'when' => $p['at'] ? pcWall((int) $p['at']) : 'not scheduled', 'targets' => $p['targets'], 'fb' => mb_substr((string) $p['fb'], 0, 160), 'pictures' => count((array) $p['images']),
        'pinned' => !empty($p['pinned']), 'card' => is_array($p['card'] ?? null), 'openRequest' => (bool) pcOpenRequest($p)];
};
$need = function () use ($S, $pid, $inScope): array {
    $p = $S['posts'][$pid] ?? null; if (!preg_match('/^p[0-9a-f]{10}$/D', $pid) || !$p || $p['status'] === 'removed' || !$inScope((string) $p['client'])) jvRefuse('no such post for this person');
    return $p;
};
if ($op === 'list') {
    $cf = $pid; $o = [];
    foreach ($S['posts'] as $p) { if ($p['status'] === 'removed' || !$inScope((string) $p['client']) || ($cf !== '' && $p['client'] !== $cf)) continue; if ($p['status'] === 'published' && (int) $p['at'] < pcNow() - 14 * 86400) continue; $o[] = $brief($p); }
    usort($o, fn($x, $y) => [$x['when'] === 'not scheduled', $S['posts'][$x['id']]['at']] <=> [$y['when'] === 'not scheduled', $S['posts'][$y['id']]['at']]);
    jvOut(['person' => $ME, 'role' => $ROLE, 'clients' => array_values(array_map(fn($c) => ['id' => $c['id'], 'name' => $c['name']], array_filter($S['clients'], fn($c) => $inScope((string) $c['id'])))), 'posts' => $o]); exit(0);
}
if ($op === 'show') {
    $p = $need(); $c = $S['clients'][$p['client']] ?? [];
    jvOut($brief($p) + ['fb' => $p['fb'], 'ig' => $p['ig'], 'li' => $p['li'] ?? '', 'li_comment' => $p['li_comment'] ?? '', 'note' => $p['note'], 'images' => array_map(fn($i) => ['url' => $i['url'] ?? '', 'kind' => $i['kind'] ?? 'picture', 'caption' => $i['caption'] ?? ''], (array) $p['images']),
        'approvedBy' => $p['approval']['by'] ?? null, 'holds' => array_keys((array) ($c['holds'] ?? [])), 'rollForward' => !empty($c['roll']), 'requests' => array_map(fn($r) => ['text' => $r['text'], 'by' => $r['by'], 'answered' => !empty($r['answered'])], (array) ($p['requests'] ?? [])),
        'history' => array_slice(array_map(fn($l) => pcWall((int) $l['at'], 'j M g:i a') . ' ' . $l['by'] . ': ' . $l['what'], (array) ($p['log'] ?? [])), -8)]); exit(0);
}
if (!in_array($op, ['edit', 'date', 'undate', 'photo'], true)) jvRefuse('J.A.R.V.I.S. can only change a draft\'s words, date and photos here (' . $op . ' goes to Matthew)');
$p0 = $need(); $c0 = $S['clients'][$p0['client']] ?? [];
if (in_array($p0['status'], ['publishing', 'published'], true)) jvRefuse('this post has gone (or is going) out, so it cannot change');
if ($p0['status'] === 'failed') jvRefuse('this post failed to go out; only an approver can move it back to draft');
if (!empty($c0['archived'])) jvRefuse('this client is archived');
if (in_array($op, ['date', 'undate'], true)) {
    if (!empty($p0['pinned'])) jvRefuse('this post is pinned to its date (Matthew\'s rule), so its date stays');
    if (!empty($c0['roll'])) jvRefuse('this client\'s schedule is rolling forward until its sign-ins are in, so dates are Matthew\'s');
    if (!empty($c0['holds'])) jvRefuse('this client\'s posting is on hold, so dates are Matthew\'s');
}
$photoTmp = null;
if ($op === 'photo') {
    $f = (string) ($argv[6] ?? '');
    if (!preg_match('/^p[0-9]{10}[0-9a-f]{6}\.(jpg|png)$/D', $f) || !is_file(jvFilesDir() . '/' . $a3 . '/' . $f)) jvRefuse('that photo is not one sent in this conversation (JPEG or PNG)');
    if (is_array($p0['card'] ?? null)) jvRefuse('this is a designed card: the photo behind its words is changed with Change photo under the card, in the app');
    if (pcHasVideo($p0)) jvRefuse('this post is a video');
    $photoTmp = sys_get_temp_dir() . '/jv-' . bin2hex(random_bytes(6)) . '.' . pathinfo($f, PATHINFO_EXTENSION); copy(jvFilesDir() . '/' . $a3 . '/' . $f, $photoTmp);
    if (function_exists('pcStripMeta')) pcStripMeta($photoTmp);
    $img = pcStoreImage($photoTmp, 'chat-photo.' . pathinfo($f, PATHINFO_EXTENSION)); @unlink($photoTmp);
    if (isset($img['error'])) jvRefuse($img['error']);
}
$val = $op === 'edit' ? (string) stream_get_contents(STDIN) : '';
$res = pcMutate(function (array &$S) use ($op, $pid, $argv, $val, $BY, &$img, $inScope) {
    $p = $S['posts'][$pid] ?? null; if (!$p || $p['status'] === 'removed' || !$inScope((string) $p['client'])) return ['error' => 'no such post for this person'];
    if (in_array($p['status'], ['publishing', 'published', 'failed'], true)) return ['error' => 'this post can no longer change'];
    $before = pcFingerprint($p); $old = null; $what = '';
    if ($op === 'edit') {
        $k = (string) ($argv[6] ?? ''); $max = ['fb' => 5000, 'ig' => PC_IG_MAX, 'li' => defined('PC_LI_MAX') ? PC_LI_MAX : 3000, 'li_comment' => defined('PC_LI_COMMENT_MAX') ? PC_LI_COMMENT_MAX : 1250][$k] ?? 0;
        if (!$max) return ['error' => 'which words: fb, ig, li or li_comment'];
        if (in_array($k, ['li', 'li_comment'], true) && !(function_exists('pcLiAllowed') && pcLiAllowed((string) $p['client']))) return ['error' => 'LinkedIn is not set up for this client'];
        $t = pcText($val, $max + 1); if (mb_strlen($t) > $max) return ['error' => 'that is over the ' . $max . '-character limit'];
        if (trim($t) === '' && $k !== 'li_comment') return ['error' => 'the words cannot be empty'];
        $p[$k] = $t; $what = ['fb' => 'Facebook words', 'ig' => 'Instagram words', 'li' => 'LinkedIn words', 'li_comment' => 'LinkedIn first comment'][$k] . ' edited';
    } elseif ($op === 'date') {
        $at = pcAt((string) ($argv[6] ?? ''), (string) ($argv[7] ?? '')); if ($at === null) return ['error' => 'that date or time does not look right (YYYY-MM-DD HH:MM, Colorado time)'];
        if ($at < pcNow() + 600) return ['error' => 'pick a time at least 10 minutes from now'];
        $p['at'] = $at; $what = 'Date set to ' . pcWall($at);
    } elseif ($op === 'undate') { $p['at'] = null; $what = 'Date taken off (not scheduled)'; }
    else {
        $rep = isset($argv[7]) && $argv[7] !== '' ? (int) $argv[7] : null;
        if ($p['type'] === 'single') { $old = $p['images'][0] ?? null; $p['images'] = [$img]; }
        elseif ($rep !== null && isset($p['images'][$rep])) { $old = $p['images'][$rep]; $img['caption'] = (string) ($old['caption'] ?? ''); $p['images'][$rep] = $img; }
        else { if (count($p['images']) >= 10) return ['error' => 'a photo set holds at most 10 pictures']; $p['images'][] = $img; }
        $what = 'Picture ' . ($old ? 'replaced' : 'added') . ' (sent in the J.A.R.V.I.S. chat)';
    }
    pcLog($p, $BY, $what);
    $dropped = false;
    if ($p['status'] === 'approved' && pcFingerprint($p) !== $before) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $BY, 'Approval dropped: edited after it was approved'); $dropped = true; }
    $S['posts'][$pid] = $p;
    if ($old && function_exists('pcDropUnused')) pcDropUnused($S, $p, $old);
    return ['ok' => true, 'what' => $what, 'status' => $p['status'], 'approvalDropped' => $dropped, 'when' => $p['at'] ? pcWall((int) $p['at']) : 'not scheduled'];
});
if (isset($res['error'])) { if ($op === 'photo' && !empty($img['file'])) @unlink(PC_MEDIA_DIR . '/' . $img['file']); jvRefuse($res['error']); }
jvOut($res); exit(0);

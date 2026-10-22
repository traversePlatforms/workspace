<?php
/* One check of every connected inbox: new emails are read, sorted and, where a reply is wanted, drafted into Gmail. Only the
   summary is kept (items.json, 21 days); the email itself stays in Gmail. A lock keeps two checks from running at once. */
declare(strict_types=1);

function checkAll(): array {
    $lk = fopen(aDataDir() . '/check.lock', 'c');
    if (!flock($lk, LOCK_EX | LOCK_NB)) return ['ok' => false, 'error' => 'A check is already running.'];
    $out = [];
    try {
        if (!claude() && empty(cfg()['stub'])) return ['ok' => false, 'error' => 'Add the Anthropic key in Setup first.'];
        foreach (jget('accounts.json') as $email => $a) {
            if (empty($a['on']) || empty($a['refresh'])) continue;
            $out[$email] = checkOne($email, $a);
        }
        pruneItems();
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return ['ok' => true, 'accounts' => $out];
}
function checkOne(string $email, array $a): array {
    $seen = jget('seen.json')[$email] ?? [];
    $n = newMessageIds($email, $seen, (int) settings()['perRun']);
    if (isset($n['error'])) { alog('check failed', ['email' => $email, 'error' => $n['error']]); return ['error' => $n['error']]; }
    $sorted = 0; $drafted = 0;
    foreach ($n['ids'] as $id) {
        $m = readMessage($email, $id);
        if (!$m) continue;
        if (in_array('SENT', $m['labels'], true) && addrOf($m['from']) === $email) { markSeen($email, $id); continue; }   /* his own messages */
        $s = sortEmail($m, $a);
        if (!$s) break;   /* the API is down or out of credit: stop, and try these again next time */
        $item = ['acct' => $email, 'id' => $id, 'threadId' => $m['threadId'], 'from' => nameOf($m['from']), 'fromAddr' => addrOf($m['from']), 'subject' => $m['subject'],
            'date' => strtotime($m['date']) ?: time(), 'category' => $s['category'], 'priority' => $s['priority'], 'summary' => $s['summary'], 'todo' => $s['todo'],
            'draftId' => null, 'status' => 'open', 'at' => time()];
        if ($s['draft'] && settings()['autoDraft']) {
            $body = draftReply($m, $a, $s['todo']);
            if ($body !== null && ($did = makeDraft($email, $m, $body))) { $item['draftId'] = $did; $drafted++; }
        }
        jedit('items.json', function ($all) use ($item) { $all[$item['acct'] . ':' . $item['id']] = $item; return $all; });
        markSeen($email, $id); $sorted++;
    }
    jedit('accounts.json', function ($x) use ($email) { if (isset($x[$email])) $x[$email]['lastCheck'] = time(); return $x; });
    if ($sorted) alog('checked', ['email' => $email, 'sorted' => $sorted, 'drafted' => $drafted]);
    return ['sorted' => $sorted, 'drafted' => $drafted, 'waiting' => max(0, count($n['ids']) - $sorted)];
}
function markSeen(string $email, string $id): void {
    jedit('seen.json', function ($s) use ($email, $id) { $s[$email][$id] = time(); if (count($s[$email]) > 3000) { asort($s[$email]); $s[$email] = array_slice($s[$email], -2500, null, true); } return $s; });
}
function pruneItems(): void {
    jedit('items.json', fn($all) => array_filter($all, fn($i) => ($i['at'] ?? 0) > time() - 21 * 86400));
}
/** a draft written when asked (the button on an item that was not drafted on its own) */
function draftNow(string $key): array {
    $it = jget('items.json')[$key] ?? null;
    if (!$it) return ['ok' => false, 'error' => 'That email is not in the list any more.'];
    $a = jget('accounts.json')[$it['acct']] ?? null;
    if (!$a) return ['ok' => false, 'error' => 'That inbox is not connected.'];
    $m = readMessage($it['acct'], $it['id']);
    if (!$m) return ['ok' => false, 'error' => 'Gmail did not send that email back.'];
    $body = draftReply($m, $a, $it['todo'] ?? '');
    if ($body === null) return ['ok' => false, 'error' => 'No draft came back. Try again in a minute.'];
    $did = makeDraft($it['acct'], $m, $body);
    if (!$did) return ['ok' => false, 'error' => 'Gmail did not take the draft.'];
    jedit('items.json', function ($all) use ($key, $did) { if (isset($all[$key])) $all[$key]['draftId'] = $did; return $all; });
    return ['ok' => true];
}

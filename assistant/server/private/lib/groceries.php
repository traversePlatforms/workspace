<?php
/* The shared grocery list (2026-10-27, Matthew: "Something simple that we can add remove and check off. Something my girlfriend and I can
   share."). groceries.json: { items: [{ id, text, done, by, at }], rev }. Matthew opens it signed in; his girlfriend opens g.html with a
   private link (?t=<token>) that reaches this list and nothing else. A new link (Make a new link) turns the old one off. */
declare(strict_types=1);

function groToken(): string { return (string) (cfg()['groToken'] ?? ''); }
/** signed in, or holding the current share link */
function groAllowed(array $body): bool {
    if (signedIn()) return true;
    $t = (string) ($body['t'] ?? ($_GET['t'] ?? ''));
    $k = groToken();
    return $k !== '' && strlen($t) >= 20 && hash_equals($k, $t);
}
function groList(): array { $g = jget('groceries.json', ['items' => [], 'rev' => 0]); return ['items' => array_values($g['items'] ?? []), 'rev' => (int) ($g['rev'] ?? 0)]; }
function groWho(array $body): string {
    if (signedIn()) return 'Matthew';
    $w = trim(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string) ($body['who'] ?? '')));
    return $w !== '' ? mb_substr($w, 0, 20) : 'Shared';
}
/** one change under the lock; returns the list after it */
function groEdit(callable $fn): array {
    $v = jedit('groceries.json', function (array $g) use ($fn) {
        $items = array_values($g['items'] ?? []);
        $items = $fn($items);
        return ['items' => array_values($items), 'rev' => (int) ($g['rev'] ?? 0) + 1];
    });
    return ['items' => $v['items'], 'rev' => $v['rev']];
}
function groAction(string $action, array $body, bool $isPost): void {
    if (!groAllowed($body)) out(['ok' => false, 'error' => 'This link no longer works. Ask Matthew for the new one.'], 401);
    if ($action === 'gro') out(['ok' => true, 'owner' => signedIn()] + groList());
    if ($action === 'groshare') {   /* Matthew only: the link to send her, or a fresh one */
        if (!signedIn() || !$isPost) out(['ok' => false, 'error' => 'Not allowed.'], 403);
        if (!empty($body['renew']) || groToken() === '') {
            $c = cfg(); $c['groToken'] = bin2hex(random_bytes(16)); jput('config.json', $c);
        }
        out(['ok' => true, 't' => groToken()]);
    }
    if (!$isPost) out(['ok' => false], 405);
    $who = groWho($body);
    if ($action === 'groadd') {
        $texts = array_filter(array_map(fn($s) => mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u', '', (string) $s)), 0, 120), preg_split('/\r?\n/', (string) ($body['text'] ?? ''))), 'strlen');
        if (!$texts) out(['ok' => false, 'error' => 'Type what to add.']);
        out(['ok' => true] + groEdit(function ($items) use ($texts, $who) {
            if (count($items) + count($texts) > 300) out(['ok' => false, 'error' => 'The list is full. Clear the checked items first.']);
            foreach ($texts as $t) $items[] = ['id' => bin2hex(random_bytes(6)), 'text' => $t, 'done' => false, 'by' => $who, 'at' => time()];
            return $items;
        }));
    }
    $id = (string) ($body['id'] ?? '');
    if ($action === 'groset') out(['ok' => true] + groEdit(function ($items) use ($id, $body, $who) {
        foreach ($items as &$it) if ($it['id'] === $id) { $it['done'] = !empty($body['done']); $it['doneBy'] = $it['done'] ? $who : null; }
        unset($it); return $items;
    }));
    if ($action === 'groedit') {
        $t = mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u', '', (string) ($body['text'] ?? ''))), 0, 120);
        if ($t === '') out(['ok' => false, 'error' => 'Type the item.']);
        out(['ok' => true] + groEdit(function ($items) use ($id, $t) { foreach ($items as &$it) if ($it['id'] === $id) $it['text'] = $t; unset($it); return $items; }));
    }
    if ($action === 'grodel') out(['ok' => true] + groEdit(fn($items) => array_filter($items, fn($it) => $it['id'] !== $id)));
    if ($action === 'groclear') out(['ok' => true] + groEdit(fn($items) => array_filter($items, fn($it) => empty($it['done']))));
    out(['ok' => false, 'error' => 'Unknown.'], 404);
}

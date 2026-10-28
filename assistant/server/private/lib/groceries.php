<?php
/* The shared grocery list (2026-10-27, Matthew: "Something simple that we can add remove and check off. Something my girlfriend and I can
   share."). groceries.json: { items: [{ id, text, done, by, at, pick? }], rev }.
   Who gets in: Matthew, signed in to the assistant; and Claire, with her own password (Matthew, same day: "make it so claire has a password
   so she can just login ... only give her access to the grocery app"). Her sign-in is a signed cookie for this list only, kept 180 days so
   her phone stays signed in; it never opens anything else in the assistant. The first version's share link is gone.
   Prices: King Soopers Federal & Belleview (store 62000109) through Kroger's Products API (lib/kroger.php). An item can carry a picked
   product (pick: productId, desc, size, price, promo, at); picks are remembered by the item's words in gro-picks.json. */
declare(strict_types=1);

const GRO_COOKIE = 'grome';
const GRO_DAYS = 180;

function groSecret(): string {
    $c = cfg();
    if (empty($c['groSecret'])) { $c = jedit('config.json', function ($c) { if (empty($c['groSecret'])) $c['groSecret'] = bin2hex(random_bytes(32)); return $c; }); }
    return (string) $c['groSecret'];
}
/** the grocery-only person signed in by cookie ('Claire'), or '' */
function groGuest(): string {
    $v = (string) ($_COOKIE[GRO_COOKIE] ?? '');
    if (!preg_match('/^([A-Za-z]{1,20})\.(\d{10})\.(\d+)\.([0-9a-f]{64})$/D', $v, $m)) return '';
    [, $name, $exp, $ver, $sig] = $m;
    if ((int) $exp < time() || !hash_equals(hash_hmac('sha256', "$name.$exp.$ver", groSecret()), $sig)) return '';
    $u = cfg()['groUsers'][$name] ?? null;   /* a changed password (new version) signs the old phone out */
    return is_array($u) && (int) ($u['ver'] ?? 0) === (int) $ver ? $name : '';
}
function groSetCookie(string $name, int $ver): void {
    $exp = time() + GRO_DAYS * 86400;
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie(GRO_COOKIE, "$name.$exp.$ver." . hash_hmac('sha256', "$name.$exp.$ver", groSecret()),
        ['expires' => $exp, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
}
function groAllowed(): bool { return signedIn() || groGuest() !== ''; }
function groWho(): string { return signedIn() ? 'Matthew' : groGuest(); }
function groNorm(string $t): string { return trim(preg_replace('/\s+/', ' ', mb_strtolower($t))); }
function groList(): array { $g = jget('groceries.json', ['items' => [], 'rev' => 0]); return ['items' => array_values($g['items'] ?? []), 'rev' => (int) ($g['rev'] ?? 0)]; }
/** one change under the lock; returns the list after it */
function groEdit(callable $fn): array {
    $v = jedit('groceries.json', function (array $g) use ($fn) {
        $items = $fn(array_values($g['items'] ?? []));
        return ['items' => array_values($items), 'rev' => (int) ($g['rev'] ?? 0) + 1];
    });
    return ['items' => $v['items'], 'rev' => $v['rev']];
}
function groClean(string $s, int $max): string { return mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $s)), 0, $max); }
function groOut(array $list): never { out(['ok' => true, 'owner' => signedIn(), 'who' => groWho(), 'store' => krStoreName(), 'prices' => krReady()] + $list); }

function groAction(string $action, array $body, bool $isPost): void {
    if ($action === 'grologin') {   /* Claire's own password: the grocery list only */
        if (!$isPost) out(['ok' => false], 405);
        if (tooManyTries()) out(['ok' => false, 'error' => 'Too many tries. Wait 15 minutes.'], 429);
        $pw = (string) ($body['password'] ?? '');
        foreach ((array) (cfg()['groUsers'] ?? []) as $name => $u) {
            if (password_verify($pw, (string) ($u['hash'] ?? ''))) { groSetCookie((string) $name, (int) ($u['ver'] ?? 1)); alog('grocery signin', ['who' => $name, 'ip' => ip()]); out(['ok' => true, 'who' => $name]); }
        }
        noteTry(); out(['ok' => false, 'error' => 'That password is not right.']);
    }
    if ($action === 'grologout') { setcookie(GRO_COOKIE, '', ['expires' => time() - 3600, 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/') . '/']); out(['ok' => true]); }
    if (!groAllowed()) out(['ok' => false, 'error' => 'Signed out.', 'needLogin' => true], 401);
    if ($action === 'gro') groOut(krRefresh(groList()));
    if ($action === 'gropass') {   /* Matthew sets (or changes) Claire's password; a change signs her other devices out */
        if (!signedIn() || !$isPost) out(['ok' => false, 'error' => 'Not allowed.'], 403);
        $name = preg_replace('/[^A-Za-z]/', '', (string) ($body['name'] ?? 'Claire')) ?: 'Claire';
        $pw = (string) ($body['password'] ?? '');
        if (mb_strlen($pw) < 8) out(['ok' => false, 'error' => 'Use at least 8 characters.']);
        jedit('config.json', function ($c) use ($name, $pw) { $old = (int) ($c['groUsers'][$name]['ver'] ?? 0); $c['groUsers'][$name] = ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'ver' => $old + 1, 'at' => time()]; unset($c['groToken']); return $c; });
        alog('grocery password set', ['for' => $name]);
        out(['ok' => true, 'name' => $name]);
    }
    if ($action === 'grousers') { if (!signedIn()) out(['ok' => false], 403); out(['ok' => true, 'users' => array_map(fn($n, $u) => ['name' => $n, 'at' => (int) ($u['at'] ?? 0)], array_keys((array) (cfg()['groUsers'] ?? [])), array_values((array) (cfg()['groUsers'] ?? [])))]); }
    if ($action === 'grosearch') {   /* matches at the store, for picking */
        $q = groClean((string) ($_GET['q'] ?? ''), 80);
        if ($q === '') out(['ok' => false, 'error' => 'Type what to look for.']);
        $r = krSearch($q); out($r === null ? ['ok' => false, 'error' => 'Prices are not available right now.'] : ['ok' => true, 'results' => $r]);
    }
    if (!$isPost) out(['ok' => false], 405);
    $who = groWho();
    if ($action === 'groadd') {
        $texts = array_values(array_filter(array_map(fn($s) => groClean((string) $s, 120), preg_split('/\r?\n/', (string) ($body['text'] ?? ''))), 'strlen'));
        if (!$texts) out(['ok' => false, 'error' => 'Type what to add.']);
        $picks = jget('gro-picks.json');
        $list = groEdit(function ($items) use ($texts, $who, $picks) {
            if (count($items) + count($texts) > 300) out(['ok' => false, 'error' => 'The list is full. Clear the checked items first.']);
            foreach ($texts as $t) { $it = ['id' => bin2hex(random_bytes(6)), 'text' => $t, 'done' => false, 'by' => $who, 'at' => time()]; $p = $picks[groNorm($t)] ?? null; if (is_array($p)) $it['pick'] = $p + ['at' => 0]; $items[] = $it; }
            return $items;
        });
        groOut(krRefresh($list));
    }
    $id = (string) ($body['id'] ?? '');
    if ($action === 'groset') groOut(groEdit(function ($items) use ($id, $body, $who) {
        foreach ($items as &$it) if ($it['id'] === $id) { $it['done'] = !empty($body['done']); $it['doneBy'] = $it['done'] ? $who : null; }
        unset($it); return $items;
    }));
    if ($action === 'groedit') {
        $t = groClean((string) ($body['text'] ?? ''), 120);
        if ($t === '') out(['ok' => false, 'error' => 'Type the item.']);
        groOut(groEdit(function ($items) use ($id, $t) { foreach ($items as &$it) if ($it['id'] === $id) $it['text'] = $t; unset($it); return $items; }));
    }
    if ($action === 'gropick') {   /* the product picked for an item (or none), remembered for next time by the item's words */
        $p = null;
        if (!empty($body['productId'])) {
            $pid = preg_replace('/[^0-9A-Za-z]/', '', (string) $body['productId']);
            $p = krProduct($pid);
            if (!$p) out(['ok' => false, 'error' => 'That product could not be priced. Try again.']);
        }
        $words = '';
        $list = groEdit(function ($items) use ($id, $p, &$words) { foreach ($items as &$it) if ($it['id'] === $id) { $words = groNorm((string) $it['text']); if ($p) $it['pick'] = $p; else unset($it['pick']); } unset($it); return $items; });
        if ($words !== '') jedit('gro-picks.json', function ($m) use ($words, $p) { if ($p) $m[$words] = ['productId' => $p['productId'], 'desc' => $p['desc'], 'size' => $p['size']]; else unset($m[$words]); return $m; });
        groOut($list);
    }
    if ($action === 'grodel') groOut(groEdit(fn($items) => array_filter($items, fn($it) => $it['id'] !== $id)));
    if ($action === 'groclear') groOut(groEdit(fn($items) => array_filter($items, fn($it) => empty($it['done']))));
    out(['ok' => false, 'error' => 'Unknown.'], 404);
}

<?php
/* Peak desk records (2026-11-17, Matthew: "data needs to be stored differently and I think infomation needs to be tracked better like it
 * is in sixfold. I would almost treat it like a pipeline similiar to sixfold. So that I and everyone else can start reaching out to these
 * companies").
 *
 * Every company is one record in desk.sqlite: a sponsor lead or an expo lead, with its contacts, every touch (call, voicemail, email,
 * text, in person, LinkedIn: who, when, how it went, a note, a follow-up), its stage and the stage history, its owner and its next
 * follow-up. Tours, proposals, packages, the P&L and an activity index (for the counts per person) sit beside them.
 *
 * The append-only logs stay the permanent record: events.log (sponsors) and expo-events.log (expo). Every save is written to the log
 * first, then read into the database, under one lock (desk.lock), so two people saving at once never lose a change. Anything else that
 * writes to a log (the Peak email sender's reply notes) is read in the same way on the next request. The database can always be rebuilt
 * from the research lists (seed.json, peak-records.json, expo-seed.json) plus the logs: it is, whenever a list is rebuilt, and on
 * `php desk.php rebuild`. Nothing is ever deleted: Remove is a log row, and so is an undone touch.
 *
 * The old desk's stages are read into the new ones (SP_LEGACY, XP_LEGACY); its rows are never rewritten. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }   /* 18 Nov: a code file, never opened on its own */
date_default_timezone_set('America/Denver');   /* Colorado time: "today" and "this week" are Peak's */
if (!defined('DATA_DIR')) {
    $deskLocal = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
    $deskOut = dirname(__DIR__, 3) . '/peak-desk-data';
    define('DATA_DIR', getenv('DESK_DATA') ?: (is_dir($deskOut) ? $deskOut : ($deskLocal ? dirname(__DIR__) . '/../desk-data-local' : $deskOut)));
}
const STORE_V = 3;   /* bump to rebuild every database from the logs after a change to how rows are read */

/* ---- the stages ---- */
const SP_STAGES = ['new' => 'To contact', 'called' => 'Called', 'voicemail' => 'Left voicemail', 'emailed' => 'Emailed', 'texted' => 'Texted',
    'meeting' => 'Meeting / tour booked', 'proposal' => 'Proposal sent', 'signed' => 'Signed', 'notnow' => 'Not now', 'lost' => 'Lost'];
const XP_STAGES = ['new' => 'To contact', 'contacted' => 'Contacted', 'tour' => 'Tour booked', 'quote' => 'Quote sent', 'booked' => 'Booked',
    'notnow' => 'Not now', 'lost' => 'Lost'];
/* the old desk's stages (before 2026-11-17), read as the new ones; the old rows stay as written */
const SP_LEGACY = ['contacted' => 'called', 'tour' => 'meeting', 'toured' => 'meeting', 'no' => 'lost'];
const XP_LEGACY = ['talking' => 'contacted', 'visit' => 'tour', 'proposal' => 'quote', 'notfit' => 'lost'];
/* how someone was reached, and how each can go */
const METHODS = ['call' => 'Call', 'voicemail' => 'Voicemail', 'email' => 'Email', 'text' => 'Text', 'inperson' => 'In person', 'linkedin' => 'LinkedIn', 'other' => 'Contacted'];
const OUTS = ['noanswer' => 'No answer', 'talked' => 'Talked', 'wrong' => 'Wrong number', 'left' => 'Left a voicemail', 'sent' => 'Sent', 'replied' => 'Replied',
    'bounced' => 'Bounced', 'met' => 'Met', 'toured' => 'Toured Peak', 'noshow' => 'Did not show', 'contacted' => 'Contacted'];
const MOUTS = ['call' => ['noanswer', 'talked', 'wrong'], 'voicemail' => ['left'], 'email' => ['sent', 'replied', 'bounced'], 'text' => ['sent', 'replied'],
    'inperson' => ['met', 'toured', 'noshow'], 'linkedin' => ['sent', 'replied'], 'other' => ['contacted']];

function W(string $w): array {
    static $C = null;
    $C ??= [
        'sponsor' => ['log' => 'events.log', 'stages' => SP_STAGES, 'legacy' => SP_LEGACY, 'field' => 'status',
            'T' => ['stage' => 'status', 'note' => 'note', 'notedel' => 'notedel', 'next' => 'next', 'contact' => 'contact', 'add' => 'lead', 'del' => 'leaddel', 'back' => 'leadback',
                'touch' => 'touch', 'touchdel' => 'touchdel', 'owner' => 'owner', 'tour' => 'tour', 'tourdel' => 'tourdel', 'tourout' => 'tourout', 'tourmove' => 'tourmove',
                'dnc' => 'dnc', 'templates' => 'templates', 'contactedit' => 'contactedit', 'contactdel' => 'contactdel'],
            /* the order a deal moves in; Not now and Lost sit outside it */
            'path' => ['new', 'called', 'voicemail', 'emailed', 'texted', 'meeting', 'proposal', 'signed'], 'reach' => 5,
            'byMethod' => ['call' => 'called', 'voicemail' => 'voicemail', 'email' => 'emailed', 'text' => 'texted', 'inperson' => 'called', 'linkedin' => 'emailed', 'other' => 'called'],
            'tourSt' => 'meeting', 'propSt' => 'proposal', 'winSt' => 'signed', 'done' => ['signed', 'lost']],
        'expo' => ['log' => 'expo-events.log', 'stages' => XP_STAGES, 'legacy' => XP_LEGACY, 'field' => 'stage',
            'T' => ['stage' => 'xstage', 'note' => 'xnote', 'notedel' => 'xnotedel', 'next' => 'xnext', 'contact' => 'xcontact', 'add' => 'xlead', 'del' => 'xdel', 'back' => 'xback',
                'touch' => 'xtouch', 'touchdel' => 'xtouchdel', 'owner' => 'xowner', 'tour' => 'xtour', 'tourdel' => 'xtourdel', 'tourout' => 'xtourout', 'tourmove' => 'xtourmove',
                'dnc' => 'xdnc', 'templates' => 'xtemplates', 'contactedit' => 'xcontactedit', 'contactdel' => 'xcontactdel'],
            'path' => ['new', 'contacted', 'tour', 'quote', 'booked'], 'reach' => 2,
            'byMethod' => array_fill_keys(array_keys(METHODS), 'contacted'),
            'tourSt' => 'tour', 'propSt' => 'quote', 'winSt' => 'booked', 'done' => ['booked', 'lost']],
    ];
    if (!isset($C[$w])) throw new InvalidArgumentException('world');
    return $C[$w];
}
function stageKey(string $w, string $raw): string { $C = W($w); return $C['legacy'][$raw] ?? $raw; }
/* where a deal is in its path (-1 for Not now and Lost) */
function stageRank(string $w, string $st): int { $i = array_search($st, W($w)['path'], true); return $i === false ? -1 : (int) $i; }
/* the stage a touch moves a company to, or '' to leave it: forward only, and only while it is still being reached (To contact .. Texted) */
function advanceFor(string $w, string $cur, string $m): string {
    $C = W($w); $to = $C['byMethod'][$m] ?? ''; $r = stageRank($w, $cur);
    if ($to === '' || $r < 0 || $r >= $C['reach']) return '';
    return stageRank($w, $to) > $r ? $to : '';
}
/* the stage a tour or a proposal moves it to: from anywhere earlier, Not now and Lost included (they are talking again) */
function forwardTo(string $w, string $cur, string $to): string { $r = stageRank($w, $cur); return ($r < 0 || $r < stageRank($w, $to)) && $cur !== $to ? $to : ''; }

/* ---- files ---- */
function jread(string $f, $def) { $s = @file_get_contents(DATA_DIR . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function jwrite(string $f, $v): bool { $t = DATA_DIR . '/' . $f . '.tmp' . bin2hex(random_bytes(3)); if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) === false) return false; return rename($t, DATA_DIR . '/' . $f); }
function jline(array $r): string { return json_encode($r, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"; }
function logAdd(array $row, string $f = 'events.log'): bool { return (bool) file_put_contents(DATA_DIR . '/' . $f, jline($row), FILE_APPEND | LOCK_EX); }
function logRows(string $f = 'events.log'): array { $out = []; $fh = @fopen(DATA_DIR . '/' . $f, 'r'); if (!$fh) return $out; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; } fclose($fh); return $out; }
function clean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function noteKey(array $r): string { return substr(sha1($r['at'] . '|' . $r['by'] . '|' . $r['note']), 0, 8); }
function newKey(): string { return bin2hex(random_bytes(5)); }
function okDay(string $d): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int) substr($d, 5, 2), (int) substr($d, 8, 2), (int) substr($d, 0, 4)); }
function okTime(string $t): bool { return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t); }

/* one writer at a time: the database and the logs change together */
function withLock(callable $fn) {
    static $held = false;
    if ($held) return $fn();   /* already ours in this request: a second flock on a new handle would wait on itself */
    $fh = fopen(DATA_DIR . '/desk.lock', 'c'); if (!$fh) throw new RuntimeException('No lock file.');
    flock($fh, LOCK_EX); $held = true;
    try { return $fn(); } finally { $held = false; flock($fh, LOCK_UN); fclose($fh); }
}

/* ---- the database ---- */
function db(): PDO {
    static $db = null; if ($db) return $db;
    $f = DATA_DIR . '/desk.sqlite'; $new = !is_file($f);
    $db = new PDO('sqlite:' . $f, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout = 10000'); $db->exec('PRAGMA journal_mode = DELETE'); $db->exec('PRAGMA synchronous = FULL');
    $db->exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS company (world TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, list TEXT NOT NULL DEFAULT \'\', stage TEXT NOT NULL,
            owner TEXT NOT NULL DEFAULT \'\', next_date TEXT NOT NULL DEFAULT \'\', last_at INTEGER NOT NULL DEFAULT 0, stage_at INTEGER NOT NULL DEFAULT 0,
            off INTEGER NOT NULL DEFAULT 0, rec TEXT NOT NULL, PRIMARY KEY (world, id));
        CREATE INDEX IF NOT EXISTS company_stage ON company (world, stage);
        CREATE INDEX IF NOT EXISTS company_owner ON company (world, owner);
        CREATE INDEX IF NOT EXISTS company_next ON company (world, next_date);
        CREATE TABLE IF NOT EXISTS tour (tid TEXT PRIMARY KEY, world TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL DEFAULT \'\', off INTEGER NOT NULL DEFAULT 0, rec TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS proposal (pid TEXT PRIMARY KEY, world TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, rec TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS setting (world TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (world, k));
        CREATE TABLE IF NOT EXISTS act (world TEXT NOT NULL, at INTEGER NOT NULL, who TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, k TEXT NOT NULL DEFAULT \'\');
        CREATE INDEX IF NOT EXISTS act_at ON act (world, at);
        CREATE INDEX IF NOT EXISTS act_k ON act (k);');
    if ($new) @chmod($f, 0660);
    return $db;
}
function metaGet(string $k): ?string { $q = db()->prepare('SELECT v FROM meta WHERE k = ?'); $q->execute([$k]); $v = $q->fetchColumn(); return $v === false ? null : (string) $v; }
function metaSet(string $k, string $v): void { db()->prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v')->execute([$k, $v]); }

/* ---- the research lists, before anything was done to them ---- */
function baseRec(): array { return ['stage' => 'new', 'stageAt' => 0, 'owner' => '', 'next' => null, 'touches' => [], 'hist' => [], 'notes' => [], 'added' => [], 'todos' => [], 'signed' => null, 'contacts' => []]; }
function seedFiles(string $w): array { return $w === 'expo' ? ['expo-seed.json'] : ['seed.json', 'peak-records.json']; }
function seedModel(string $w): array {
    $M = ['recs' => [], 'tours' => [], 'props' => [], 'set' => [], 'act' => [], 'actdel' => [], 'all' => true];
    if ($w === 'expo') {
        $seed = jread('expo-seed.json', ['orgs' => []]);
        foreach (($seed['orgs'] ?? []) as $o) if (isset($o['id'])) $M['recs'][$o['id']] = $o + baseRec();
        return $M;
    }
    $seed = jread('seed.json', ['leads' => [], 'packages' => []]);
    foreach (($seed['leads'] ?? []) as $l) if (isset($l['id'])) $M['recs'][$l['id']] = $l + baseRec();
    /* Peak's own sponsor records (2026-10-25, Nneka's tracker): the lead moves to the Peak sponsors list, a sponsor the desk lacked is added,
       its tracker emails join the contacts once */
    foreach ((jread('peak-records.json', ['leads' => []])['leads'] ?? []) as $p) {
        $id = (string) ($p['id'] ?? ''); if (!preg_match('/^[0-9a-f]{10}$/', $id) || !is_array($p['peak'] ?? null)) continue;
        if (!isset($M['recs'][$id])) $M['recs'][$id] = ['id' => $id, 'list' => 'renew', 'name' => (string) ($p['name'] ?? ''), 'kind' => '', 'score' => null, 'why' => '', 'route' => ''] + baseRec();
        $R = &$M['recs'][$id];
        $R['list'] = 'renew'; $R['peak'] = $p['peak'];
        if (!empty($p['kind'])) $R['kind'] = (string) $p['kind'];
        if (isset($p['why'])) $R['why'] = (string) $p['why'];
        $have = array_map(fn($c) => strtolower((string) ($c['email'] ?? '')), $R['contacts']);
        foreach (($p['contacts'] ?? []) as $c) if (!empty($c['email']) && !in_array(strtolower($c['email']), $have, true)) { $R['contacts'][] = $c + ['from' => 'peak']; $have[] = strtolower($c['email']); }
        unset($R);
    }
    $M['set']['packages'] = $seed['packages'] ?? [];
    return $M;
}
function loadModel(string $w): array {
    $M = ['recs' => [], 'tours' => [], 'props' => [], 'set' => [], 'act' => [], 'actdel' => [], 'all' => false, 'dirty' => [], 'tdirty' => [], 'pdirty' => [], 'sdirty' => []];
    $q = db()->prepare('SELECT id, rec FROM company WHERE world = ?'); $q->execute([$w]);
    foreach ($q as $r) $M['recs'][$r['id']] = json_decode($r['rec'], true);
    $q = db()->prepare('SELECT tid, rec FROM tour WHERE world = ?'); $q->execute([$w]);
    foreach ($q as $r) $M['tours'][$r['tid']] = json_decode($r['rec'], true);
    $q = db()->prepare('SELECT pid, rec FROM proposal WHERE world = ?'); $q->execute([$w]);
    foreach ($q as $r) $M['props'][$r['pid']] = json_decode($r['rec'], true);
    $q = db()->prepare('SELECT k, v FROM setting WHERE world = ?'); $q->execute([$w]);
    foreach ($q as $r) $M['set'][$r['k']] = json_decode($r['v'], true);
    return $M;
}

/* ---- reading one log row into the records ---- */
function apply(array &$M, string $w, array $r): void {
    $C = W($w); $t = (string) ($r['t'] ?? ''); $op = array_search($t, $C['T'], true); $op = $op === false ? $t : $op;
    $id = (string) ($r['id'] ?? ''); $at = (int) ($r['at'] ?? 0); $by = (string) ($r['by'] ?? '');
    $has = $id !== '' && isset($M['recs'][$id]);
    $act = function (string $kind, string $cid, int $when, string $k = '') use (&$M, $by) { if ($by !== '') $M['act'][] = [$when, $by, $kind, $cid, $k]; };
    $dirty = function (string $cid) use (&$M) { $M['dirty'][$cid] = 1; };
    switch ($op) {
        case 'add': {
            $p = $r[$w === 'expo' ? 'org' : 'lead'] ?? null; if (!is_array($p) || $id === '') return;
            $M['recs'][$id] = $p + baseRec(); $dirty($id); return;
        }
        case 'stage': {
            if (!$has) return; $raw = (string) ($r[$C['field']] ?? ''); $st = stageKey($w, $raw); if (!isset($C['stages'][$st])) return;
            $R = &$M['recs'][$id]; $from = (string) $R['stage'];
            $R['stage'] = $st; $R['stageAt'] = $at;
            $h = ['at' => $at, 'by' => $by, 'from' => $from, 'to' => $st]; if (!empty($r['why'])) $h['why'] = (string) $r['why']; if (!empty($r['tk'])) $h['tk'] = (string) $r['tk'];
            $R['hist'][] = $h;
            $R['lost'] = $st === 'lost' ? ['why' => (string) ($r['why'] ?? ($raw === 'notfit' ? 'Not a fit' : ($raw === 'no' ? 'Said no' : ''))), 'at' => $at, 'by' => $by] : null;
            $R['notnow'] = $st === 'notnow' ? ['back' => (string) ($r['back'] ?? ''), 'why' => (string) ($r['why'] ?? ''), 'at' => $at, 'by' => $by] : null;
            if ($st === 'quote' && is_array($r['quote'] ?? null)) $R['quote'] = $r['quote'] + ['at' => $at, 'by' => $by];
            if ($st === 'booked' && is_array($r['booked'] ?? null)) $R['booked'] = $r['booked'] + ['at' => $at, 'by' => $by];
            /* the old desk said only "Contacted": it counts as a touch, how not recorded (Brandon's two of 29 Oct) */
            if (empty($r['v']) && in_array($raw, $w === 'expo' ? ['contacted', 'talking'] : ['contacted'], true)) {
                $k = 'old' . substr(sha1($id . '|' . $at . '|' . $by), 0, 7);
                $R['touches'][] = ['k' => $k, 'at' => $at, 'when' => $at, 'by' => $by, 'm' => 'other', 'out' => 'contacted', 'note' => '', 'old' => 1];
                $act('other', $id, $at, $k);
            }
            unset($R); $dirty($id);
            $act('stage', $id, $at);
            if ($st === $C['tourSt']) $act('tour', $id, $at); elseif ($st === $C['propSt']) $act('proposal', $id, $at); elseif ($st === $C['winSt']) $act('signed', $id, $at);
            return;
        }
        case 'note': if (!$has) return; $M['recs'][$id]['notes'][] = ['k' => noteKey($r), 'at' => $at, 'by' => $by, 'note' => (string) ($r['note'] ?? '')]; $dirty($id); $act('note', $id, $at); return;
        case 'notedel': if (!$has) return; $M['recs'][$id]['notes'] = array_values(array_filter($M['recs'][$id]['notes'], fn($n) => $n['k'] !== ($r['nk'] ?? ''))); $dirty($id); return;
        case 'next': if (!$has) return; $n = $r['next'] ?? null; $M['recs'][$id]['next'] = is_array($n) ? ['date' => (string) ($n['date'] ?? ''), 'what' => (string) ($n['what'] ?? ''), 'by' => $by, 'at' => $at] : null; $dirty($id); return;
        case 'contact': if (!$has || !is_array($r['contact'] ?? null)) return; $M['recs'][$id]['added'][] = $r['contact'] + ['by' => $by, 'at' => $at]; $dirty($id); return;
        case 'del': if (!$has) return; $M['recs'][$id]['off'] = ['at' => $at, 'by' => $by]; $dirty($id); return;
        case 'back': if (!$has) return; unset($M['recs'][$id]['off']); $dirty($id); return;
        case 'touch': {
            if (!$has || !is_array($r['touch'] ?? null)) return; $x = $r['touch']; $k = (string) ($r['k'] ?? newKey()); $m = (string) ($x['m'] ?? 'other');
            $T = ['k' => $k, 'at' => $at, 'when' => (int) ($x['when'] ?? $at) ?: $at, 'by' => $by, 'm' => $m, 'out' => (string) ($x['out'] ?? ''), 'note' => (string) ($x['note'] ?? '')];
            foreach (['to', 'ref', 'auto', 'tid', 'fu', 'from', 'tpl'] as $f) if (isset($x[$f]) && $x[$f] !== '') $T[$f] = $x[$f];
            $M['recs'][$id]['touches'][] = $T; $dirty($id); $act($m, $id, $T['when'], $k); return;
        }
        case 'touchdel': {
            if (!$has) return; $k = (string) ($r['k'] ?? '');
            $M['recs'][$id]['touches'] = array_values(array_filter($M['recs'][$id]['touches'], fn($x) => $x['k'] !== $k)); $M['actdel'][] = $k; $dirty($id); return;
        }
        case 'owner': if (!$has) return; $M['recs'][$id]['owner'] = clean($r['owner'] ?? '', 60); $dirty($id); return;
        case 'tour': {
            $tid = (string) ($r['tid'] ?? ''); if ($tid === '') return;
            $M['tours'][$tid] = $r + ['world' => $w, 'off' => false, 'out' => '']; $M['tours'][$tid]['world'] = $w; $M['tdirty'][$tid] = 1;
            $act('tour', (string) ($r['lead'] ?? $id), $at); return;
        }
        case 'tourdel': $tid = (string) ($r['tid'] ?? ''); if (isset($M['tours'][$tid])) { $M['tours'][$tid]['off'] = true; $M['tdirty'][$tid] = 1; } return;
        case 'tourout': $tid = (string) ($r['tid'] ?? ''); if (isset($M['tours'][$tid])) { $M['tours'][$tid]['out'] = (string) ($r['out'] ?? ''); $M['tdirty'][$tid] = 1; } return;
        case 'tourmove': $tid = (string) ($r['tid'] ?? ''); if (isset($M['tours'][$tid])) { $M['tours'][$tid]['date'] = (string) $r['date']; $M['tours'][$tid]['time'] = (string) $r['time']; $M['tours'][$tid]['out'] = ''; $M['tdirty'][$tid] = 1; } return;
        /* sponsors only */
        case 'site': if (!$has) return; $M['recs'][$id]['site'] = (string) ($r['site'] ?? ''); $dirty($id); return;
        case 'signed': if (!$has || !is_array($r['signed'] ?? null)) return; $M['recs'][$id]['signed'] = $r['signed'] + ['by' => $by, 'at' => $at]; $dirty($id); return;
        case 'todo': if (!$has) return; $M['recs'][$id]['todos'][] = ['k' => (string) $r['k'], 'text' => (string) $r['text'], 'done' => false, 'by' => $by, 'at' => $at]; $dirty($id); return;
        case 'tododone': if (!$has) return; foreach ($M['recs'][$id]['todos'] as &$x) { if ($x['k'] === ($r['k'] ?? '')) $x['done'] = (bool) ($r['done'] ?? false); } unset($x); $dirty($id); return;
        case 'tododel': if (!$has) return; $M['recs'][$id]['todos'] = array_values(array_filter($M['recs'][$id]['todos'], fn($x) => $x['k'] !== ($r['k'] ?? ''))); $dirty($id); return;
        case 'proposal': { $pid = (string) ($r['pid'] ?? ''); if ($pid === '') return; $M['props'][$pid] = $r; $M['pdirty'][$pid] = 1; $act('proposal', (string) ($r['lead'] ?? $id), $at); return; }
        /* Don't contact (2026-11-18): one person asked not to be contacted. Their email and phone move out of the fields anything reads to
           reach them (the Peak email sender reads email from contacts and added), into dncEmail / dncPhone, and come back when it is undone */
        case 'dnc': {
            if (!$has) return; $key = (string) ($r['key'] ?? ''); if ($key === '') return;
            $on = !empty($r['on']); $R = &$M['recs'][$id];
            $mark = ['why' => (string) ($r['why'] ?? ''), 'by' => $by, 'at' => $at];
            foreach (['contacts', 'added'] as $f) foreach ($R[$f] as &$c) {
                if (personKey($c) !== $key && (string) ($c['of'] ?? '') !== $key) continue;
                if ($on) { if (($c['email'] ?? '') !== '') { $c['dncEmail'] = $c['email']; $c['email'] = ''; } if (($c['phone'] ?? '') !== '') { $c['dncPhone'] = $c['phone']; $c['phone'] = ''; } $c['dnc'] = $mark; }
                else { if (isset($c['dncEmail'])) { $c['email'] = $c['dncEmail']; unset($c['dncEmail']); } if (isset($c['dncPhone'])) { $c['phone'] = $c['dncPhone']; unset($c['dncPhone']); } unset($c['dnc']); }
            }
            unset($c);
            if ($on) $R['dnc'][$key] = $mark; else unset($R['dnc'][$key]);
            unset($R); $dirty($id); return;
        }
        /* a person edited (2026-11-18): the row carries what the card showed (was) and what it says now; every field is written onto the
           person's own entry, so "add the new details to" entries for them are folded in (and dropped, so the email sender never reads an old
           address from one). Someone marked Don't contact keeps their hidden email and phone as they were. When the key changes (a new
           email, say), their Don't contact mark moves with them. Touches, the email sender's sent, reply and bounce marks and the stage are
           the company's, so nothing there changes. */
        case 'contactedit': {
            if (!$has || !is_array($r['now'] ?? null)) return; $key = (string) ($r['key'] ?? '');
            $x = contactAt($M['recs'][$id], $key, (int) ($r['n'] ?? 0)); if (!$x) return;
            $R = &$M['recs'][$id]; $c = &$R[$x[0]][$x[1]]; $new = $r['now'];
            $dn = !empty($c['dnc']) || isset(($R['dnc'] ?? [])[$key]); $old = contactVals($w, $c);
            if (array_key_exists('name', $new)) $c['name'] = (string) $new['name'];
            if (array_key_exists('role', $new)) { if ($w === 'expo' || isset($c['role'])) $c['role'] = (string) $new['role']; if ($w !== 'expo') $c['pos'] = (string) $new['role']; }
            if ($w === 'expo' && array_key_exists('notes', $new)) $c['notes'] = (string) $new['notes'];
            if (!$dn) foreach (['email', 'phone'] as $f) if (array_key_exists($f, $new)) $c[$f] = (string) $new[$f];
            if (strtolower(trim($old['email'])) !== strtolower(trim((string) ($c['email'] ?? '')))) {   /* a new address: the old one's look-up confidence no longer applies */
                if (is_numeric($c['conf'] ?? null)) unset($c['conf']);
                if (isset($c['estat'])) $c['estat'] = '';
            }
            unset($c['of']); $c['ed'] = ['by' => $by, 'at' => $at];
            $nk = personKey($c); $nm = (string) ($c['name'] ?? '');
            $chg = [];
            foreach (contactVals($w, $c) as $f => $v) { $o = (string) (($r['was'][$f] ?? null) ?? $old[$f]); if ($dn && in_array($f, ['email', 'phone'], true)) continue; if ($o !== $v) $chg[] = [$f, $o, $v]; }
            unset($c);
            $R['added'] = array_values(array_filter($R['added'] ?? [], fn($q) => (string) ($q['of'] ?? '') !== $key || empty($q['of'])));
            if ($nk !== $key && $nk !== '' && isset($R['dnc'][$key])) {
                $R['dnc'][$nk] = $R['dnc'][$key];
                $still = false; foreach (contactRefs($R) as $y) if ($y[2] === $key) $still = true;
                if (!$still) unset($R['dnc'][$key]);
            }
            $R['cedits'][] = ['do' => 'edit', 'at' => $at, 'by' => $by, 'name' => $nm !== '' ? $nm : ($old['name'] !== '' ? $old['name'] : 'a contact'), 'chg' => $chg];
            unset($R); $dirty($id); return;
        }
        /* a person removed (2026-11-18): off the card, the email sender's lists and the duplicate checks; the log keeps them. A Don't contact
           mark stays on the record, so the address stays on the sender's no-contact list. */
        case 'contactdel': {
            if (!$has) return; $key = (string) ($r['key'] ?? '');
            $x = contactAt($M['recs'][$id], $key, (int) ($r['n'] ?? 0)); if (!$x) return;
            $R = &$M['recs'][$id]; $c = $R[$x[0]][$x[1]];
            array_splice($R[$x[0]], $x[1], 1);
            $still = false; foreach (contactRefs($R) as $y) if ($y[2] === $key) $still = true;
            if (!$still) $R['added'] = array_values(array_filter($R['added'] ?? [], fn($q) => (string) ($q['of'] ?? '') !== $key || empty($q['of'])));
            $v = contactVals($w, $c);
            $R['cedits'][] = ['do' => 'del', 'at' => $at, 'by' => $by, 'name' => $v['name'] !== '' ? $v['name'] : 'a contact', 'role' => $v['role']];
            unset($R); $dirty($id); return;
        }
        case 'templates': $M['set']['templates'] = is_array($r['templates'] ?? null) ? $r['templates'] : []; $M['sdirty']['templates'] = 1; return;
        case 'packages': $M['set']['packages'] = $r['packages'] ?? []; $M['sdirty']['packages'] = 1; return;
        case 'pl': $M['set']['pl'] = $r['pl'] ?? null; $M['sdirty']['pl'] = 1; return;
    }
}
function lastTouch(array $R): ?array { $l = null; foreach ($R['touches'] ?? [] as $t) if (!$l || $t['when'] >= $l['when']) $l = $t; return $l; }
function saveModel(string $w, array $M): void {
    $db = db();
    if ($M['all']) {
        foreach (['company', 'tour', 'proposal', 'setting', 'act'] as $tb) $db->prepare("DELETE FROM $tb WHERE world = ?")->execute([$w]);
        $ids = array_keys($M['recs']); $tids = array_keys($M['tours']); $pids = array_keys($M['props']); $sks = array_keys($M['set']);
    } else { $ids = array_keys($M['dirty']); $tids = array_keys($M['tdirty']); $pids = array_keys($M['pdirty']); $sks = array_keys($M['sdirty']); }
    $qc = $db->prepare('INSERT INTO company (world, id, name, list, stage, owner, next_date, last_at, stage_at, off, rec) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (world, id) DO UPDATE SET name = excluded.name, list = excluded.list, stage = excluded.stage, owner = excluded.owner, next_date = excluded.next_date,
        last_at = excluded.last_at, stage_at = excluded.stage_at, off = excluded.off, rec = excluded.rec');
    foreach ($ids as $id) {
        $R = $M['recs'][$id] ?? null; if (!$R) continue; $lt = lastTouch($R);
        $qc->execute([$w, (string) $id, (string) ($R['name'] ?? ''), (string) ($R['list'] ?? ''), (string) $R['stage'], (string) $R['owner'], (string) ($R['next']['date'] ?? ''),
            $lt ? (int) $lt['when'] : 0, (int) $R['stageAt'], empty($R['off']) ? 0 : 1, json_encode($R, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
    }
    $qt = $db->prepare('INSERT INTO tour (tid, world, id, date, off, rec) VALUES (?,?,?,?,?,?) ON CONFLICT (tid) DO UPDATE SET date = excluded.date, off = excluded.off, rec = excluded.rec');
    foreach ($tids as $tid) { $T = $M['tours'][$tid]; $qt->execute([(string) $tid, $w, (string) ($T['lead'] ?? $T['id'] ?? ''), (string) ($T['date'] ?? ''), empty($T['off']) ? 0 : 1, json_encode($T, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]); }
    $qp = $db->prepare('INSERT INTO proposal (pid, world, id, at, rec) VALUES (?,?,?,?,?) ON CONFLICT (pid) DO UPDATE SET rec = excluded.rec');
    foreach ($pids as $pid) { $P = $M['props'][$pid]; $qp->execute([(string) $pid, $w, (string) ($P['lead'] ?? ''), (int) ($P['at'] ?? 0), json_encode($P, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]); }
    $qs = $db->prepare('INSERT INTO setting (world, k, v) VALUES (?,?,?) ON CONFLICT (world, k) DO UPDATE SET v = excluded.v');
    foreach ($sks as $k) $qs->execute([$w, (string) $k, json_encode($M['set'][$k], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
    $qa = $db->prepare('INSERT INTO act (world, at, who, kind, id, k) VALUES (?,?,?,?,?,?)');
    foreach ($M['act'] as [$at, $who, $kind, $cid, $k]) $qa->execute([$w, $at, $who, $kind, $cid, $k]);
    $qd = $db->prepare('DELETE FROM act WHERE world = ? AND k = ?');
    foreach ($M['actdel'] as $k) if ($k !== '') $qd->execute([$w, $k]);
}

/* ---- keeping the database in step with the logs ---- */
function seedSig(string $w): string {
    static $memo = [];   /* the lists do not change during one request; size and time decide whether to hash them again */
    $s = 'v' . STORE_V; $st = '';
    foreach (seedFiles($w) as $f) { $p = DATA_DIR . '/' . $f; clearstatcache(true, $p); $st .= '|' . $f . ':' . (is_file($p) ? filesize($p) . ':' . filemtime($p) : '-'); }
    if (isset($memo[$w]) && $memo[$w][0] === $st) return $memo[$w][1];
    foreach (seedFiles($w) as $f) { $p = DATA_DIR . '/' . $f; $s .= '|' . (is_file($p) ? md5_file($p) : '-'); }
    $memo[$w] = [$st, md5($s . $st)]; return $memo[$w][1];
}
function prefixHash(string $file, int $n): string { if ($n <= 0) return ''; $fh = @fopen($file, 'rb'); if (!$fh) return ''; $h = hash_init('md5'); hash_update_stream($h, $fh, $n); fclose($fh); return hash_final($h); }
/* read whatever was added to a world's log since last time (or rebuild when a list or the log itself changed); returns rows read */
function sync(string $w, bool $locked = false): int {
    $log = DATA_DIR . '/' . W($w)['log']; clearstatcache(true, $log);
    $size = is_file($log) ? (int) filesize($log) : 0; $mt = is_file($log) ? (string) filemtime($log) : '0';
    $quick = metaGet("sig:$w") === seedSig($w) && (int) metaGet("off:$w") === $size && metaGet("mt:$w") === $mt;
    if ($quick) return 0;
    if (!$locked) return withLock(fn() => sync($w, true));
    $db = db(); $db->exec('BEGIN IMMEDIATE');
    try {
        clearstatcache(true, $log); $size = is_file($log) ? (int) filesize($log) : 0; $mt = is_file($log) ? (string) filemtime($log) : '0';
        $sig = seedSig($w); $off = (int) (metaGet("off:$w") ?? 0);
        $fresh = metaGet("sig:$w") !== $sig || $off > $size || prefixHash($log, $off) !== (string) (metaGet("ph:$w") ?? '');
        if ($fresh) { $M = seedModel($w); $off = 0; } else $M = loadModel($w);
        $n = 0;
        if ($size > $off) {
            $fh = fopen($log, 'rb'); fseek($fh, $off);
            while (($line = fgets($fh)) !== false) {
                if (substr($line, -1) !== "\n") break;   /* a line still being written: next time */
                $off += strlen($line); $r = json_decode($line, true); if (is_array($r)) { apply($M, $w, $r); $n++; }
            }
            fclose($fh);
        }
        saveModel($w, $M);
        metaSet("sig:$w", $sig); metaSet("off:$w", (string) $off); metaSet("mt:$w", $mt); metaSet("ph:$w", prefixHash($log, $off));
        $db->exec('COMMIT');
        return $n;
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
}
function rebuild(string $w): int { return withLock(function () use ($w) { metaSet("sig:$w", 'rebuild'); return sync($w, true); }); }
/* write rows to a world's log in one append, then read them in (call inside withLock) */
function commit(string $w, array $rows): void {
    if (!$rows) return;
    $s = ''; foreach ($rows as $r) $s .= jline($r + ['v' => 2]);
    if (file_put_contents(DATA_DIR . '/' . W($w)['log'], $s, FILE_APPEND | LOCK_EX) === false) throw new RuntimeException('The log could not be written.');
    sync($w, true);
}
function recs(string $w, bool $withOff = true): array {
    sync($w); $q = db()->prepare('SELECT id, rec FROM company WHERE world = ?' . ($withOff ? '' : ' AND off = 0')); $q->execute([$w]); $o = [];
    foreach ($q as $r) $o[$r['id']] = json_decode($r['rec'], true);
    return $o;
}
function toursOf(string $w): array { sync($w); $q = db()->prepare('SELECT rec FROM tour WHERE world = ? AND off = 0 ORDER BY date'); $q->execute([$w]); return array_map(fn($r) => json_decode($r['rec'], true), $q->fetchAll()); }
function propsOf(string $w): array { sync($w); $q = db()->prepare('SELECT rec FROM proposal WHERE world = ? ORDER BY at'); $q->execute([$w]); return array_map(fn($r) => json_decode($r['rec'], true), $q->fetchAll()); }
function settingOf(string $w, string $k, $def) { sync($w); $q = db()->prepare('SELECT v FROM setting WHERE world = ? AND k = ?'); $q->execute([$w, $k]); $v = $q->fetchColumn(); return $v === false ? $def : json_decode((string) $v, true); }
/* what scan.php needs (the hourly look-ups): the sponsor leads by id */
function state(): array { return ['leads' => recs('sponsor')]; }

/* ---- counts per person: calls (and voicemails), emails, texts, other touches, tours, proposals, signed ---- */
function weekStart(): int { return (int) strtotime('monday this week 00:00'); }
function counts(string $w, int $since): array {
    sync($w);
    $q = db()->prepare('SELECT who, kind, COUNT(*) n, COUNT(DISTINCT id) d FROM act WHERE world = ? AND at >= ? GROUP BY who, kind'); $q->execute([$w, $since]);
    $o = [];
    foreach ($q as $r) {
        $p = &$o[$r['who']]; $p ??= ['calls' => 0, 'vms' => 0, 'emails' => 0, 'texts' => 0, 'other' => 0, 'tours' => 0, 'proposals' => 0, 'signed' => 0, 'notes' => 0];
        $n = (int) $r['n'];
        switch ($r['kind']) {
            case 'call': $p['calls'] += $n; break; case 'voicemail': $p['calls'] += $n; $p['vms'] += $n; break;
            case 'email': $p['emails'] += $n; break; case 'text': $p['texts'] += $n; break;
            case 'inperson': case 'linkedin': case 'other': $p['other'] += $n; break;
            case 'note': $p['notes'] += $n; break;
        }
        unset($p);
    }
    /* tours, proposals and signed count companies, once each, however many rows say so */
    $q = db()->prepare('SELECT who, kind, COUNT(DISTINCT id) d FROM act WHERE world = ? AND at >= ? AND kind IN (\'tour\', \'proposal\', \'signed\') GROUP BY who, kind'); $q->execute([$w, $since]);
    foreach ($q as $r) { $o[$r['who']] ??= ['calls' => 0, 'vms' => 0, 'emails' => 0, 'texts' => 0, 'other' => 0, 'tours' => 0, 'proposals' => 0, 'signed' => 0, 'notes' => 0]; $o[$r['who']][$r['kind'] === 'tour' ? 'tours' : ($r['kind'] === 'proposal' ? 'proposals' : 'signed')] = (int) $r['d']; }
    $q = db()->prepare('SELECT who, MAX(at) m FROM act WHERE world = ? GROUP BY who'); $q->execute([$w]);
    foreach ($q as $r) if (isset($o[$r['who']])) $o[$r['who']]['last'] = (int) $r['m'];
    return $o;
}

/* ---- the rows each change writes ---- */
function rowStage(string $w, string $id, string $st, string $by, int $at, array $extra = []): array { return ['t' => W($w)['T']['stage'], 'id' => $id, W($w)['field'] => $st] + $extra + ['by' => $by, 'at' => $at]; }
function rowNext(string $w, string $id, ?array $next, string $by, int $at): array { return ['t' => W($w)['T']['next'], 'id' => $id, 'next' => $next, 'by' => $by, 'at' => $at]; }
function rowOwner(string $w, string $id, string $owner, string $by, int $at): array { return ['t' => W($w)['T']['owner'], 'id' => $id, 'owner' => $owner, 'by' => $by, 'at' => $at]; }
function rowTouch(string $w, string $id, string $k, array $touch, string $by, int $at): array { return ['t' => W($w)['T']['touch'], 'id' => $id, 'k' => $k, 'touch' => $touch, 'by' => $by, 'at' => $at]; }
/* consecutive calls with no answer since they last talked (Sixfold's missCount): an email or a text is not a missed call */
function missCount(array $R): int {
    $T = $R['touches'] ?? []; usort($T, fn($a, $b) => $a['when'] <=> $b['when']); $n = 0;
    foreach ($T as $t) { if (in_array($t['out'], ['talked', 'met', 'toured', 'replied'], true)) $n = 0; elseif (in_array($t['out'], ['noanswer', 'left'], true)) $n++; }
    return $n;
}
/* Sixfold's call-tries rule (2026-11-18): four tries in a row with no answer, then a last text or email and Not now for 60 days (one tap,
   never automatic) */
const TRIES_MAX = 4;
const TRIES_BACK_DAYS = 60;
/* the next working day after $day (Saturday and Sunday skipped): where a No answer's follow-up lands */
function nextBizDay(string $day = '', int $n = 1): string {
    $t = strtotime(($day !== '' ? $day : date('Y-m-d')) . ' 12:00');
    while ($n > 0) { $t = strtotime('+1 day', $t); if ((int) date('N', $t) < 6) $n--; }
    return date('Y-m-d', $t);
}

/* ---- one person, whoever lists them: the same key for a researched contact, one added on the desk and the email sender ---- */
function digits10(string $p): string { $d = preg_replace('/\D/', '', $p) ?? ''; if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1); return strlen($d) === 10 ? $d : ''; }
function personKey(array $c): string {
    $e = strtolower(trim((string) (($c['email'] ?? '') !== '' ? $c['email'] : ($c['dncEmail'] ?? ''))));
    if ($e !== '') return 'e:' . $e;
    $p = digits10((string) (($c['phone'] ?? '') !== '' ? $c['phone'] : ($c['dncPhone'] ?? '')));
    if ($p !== '') return 'p:' . $p;
    $n = strtolower(trim(preg_replace('/\s+/', ' ', (string) ($c['name'] ?? '')) ?? ''));
    return $n !== '' ? 'n:' . $n : '';
}
/* ---- editing and removing a person on a card (2026-11-18, Matthew: "we need a way to edit contacts that we add ... cai added a contact and she
   spelt the email wrong ... we all do") ----
   A person is found the way the card lists them: by their person key, and n (0, 1 ...) when two entries on one card share a key. The order is
   the order people() lists them: the researched contacts, the ones added on the desk, then "add the new details to" entries that found
   nobody. Hunter's look-up results are not here: they come from a look-up, not from the records. */
function contactRefs(array $R): array {
    $o = []; $keys = [];
    foreach (['contacts', 'added'] as $f) foreach (($R[$f] ?? []) as $i => $c) {
        if ($f === 'added' && !empty($c['of'])) continue;
        $k = personKey($c); $o[] = [$f, $i, $k]; $keys[$k] = 1;
    }
    foreach (($R['added'] ?? []) as $i => $c) if (!empty($c['of']) && !isset($keys[(string) $c['of']])) $o[] = ['added', $i, personKey($c)];
    return $o;
}
function contactAt(array $R, string $key, int $n): ?array { $m = 0; foreach (contactRefs($R) as $x) if ($x[2] === $key) { if ($m === $n) return $x; $m++; } return null; }
/* the fields a person can be edited on: name, role (sponsors keep it as pos), email, phone, and the expo note */
function contactVals(string $w, array $c): array {
    $v = ['name' => (string) ($c['name'] ?? ''), 'role' => $w === 'expo' ? (string) (($c['role'] ?? '') !== '' ? $c['role'] : ($c['pos'] ?? '')) : (string) (($c['pos'] ?? '') !== '' ? $c['pos'] : ($c['role'] ?? '')), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? '')];
    if ($w === 'expo') $v['notes'] = (string) ($c['notes'] ?? '');
    return $v;
}
/* the row that removes one person (the page's Remove, and `php desk.php contactdel`); a person marked Don't contact keeps that mark on the
   card's record, so their address stays on the email sender's no-contact list. Their email and phone are not copied into the row. */
function contactDelRow(string $w, array $R, string $key, int $n, string $by, int $at): ?array {
    $x = contactAt($R, $key, $n); if (!$x) return null;
    $c = $R[$x[0]][$x[1]]; $was = contactVals($w, $c);
    if (!empty($c['dnc']) || isset(($R['dnc'] ?? [])[$key])) unset($was['email'], $was['phone']);
    return ['t' => W($w)['T']['contactdel'], 'id' => (string) $R['id'], 'key' => $key, 'n' => $n, 'was' => $was, 'by' => $by, 'at' => $at];
}
/* a company name as the duplicate check compares it (Sixfold's lead doubles, 2026-11-18): case, punctuation, "&" and the legal endings
   (Inc, LLC, Co ...) do not make two companies different */
function normName(string $n): string {
    $n = strtolower(str_replace(['&', '+'], ' and ', $n));
    $n = preg_replace('/[^a-z0-9]+/', ' ', $n) ?? '';
    $n = preg_replace('/\b(the|inc|incorporated|llc|l l c|ltd|limited|co|corp|corporation|company|pllc|pc|lp|llp)\b/', ' ', $n) ?? '';
    return trim(preg_replace('/\s+/', ' ', $n) ?? '');
}
/* a website as its host, and only when the host is the company's own (a Facebook page or a link page is shared by thousands) */
const SHARED_HOSTS = ['facebook.com', 'm.facebook.com', 'instagram.com', 'linkedin.com', 'linktr.ee', 'google.com', 'sites.google.com', 'business.site', 'yelp.com', 'x.com', 'twitter.com', 'youtube.com', 'tiktok.com', 'wixsite.com', 'squarespace.com', 'godaddysites.com', 'business.google.com'];
function normSite(string $s): string {
    $h = strtolower(trim($s)); $h = preg_replace('#^[a-z]+://#', '', $h) ?? ''; $h = preg_replace('#^www\.#', '', $h) ?? ''; $h = explode('/', explode('?', $h)[0])[0];
    return $h === '' || in_array($h, SHARED_HOSTS, true) || !str_contains($h, '.') ? '' : $h;
}
/* every email and phone a company has (its own line, its contacts, Don't-contact ones included) */
function recEmails(array $R): array { $o = []; foreach (array_merge($R['contacts'] ?? [], $R['added'] ?? []) as $c) { $e = strtolower(trim((string) (($c['email'] ?? '') !== '' ? $c['email'] : ($c['dncEmail'] ?? '')))); if ($e !== '') $o[$e] = 1; } return array_keys($o); }
function recPhones(array $R): array { $o = []; $p = digits10((string) ($R['phone'] ?? '')); if ($p !== '') $o[$p] = 1; foreach (array_merge($R['contacts'] ?? [], $R['added'] ?? []) as $c) { $p = digits10((string) (($c['phone'] ?? '') !== '' ? $c['phone'] : ($c['dncPhone'] ?? ''))); if ($p !== '') $o[$p] = 1; } return array_map('strval', array_keys($o)); }   /* numeric keys come back as ints */
/* the companies a new one may already be: [[id, name, why, removed] ...] */
function dupesOf(array $X, string $name, string $phone, string $site, string $email, string $skip = ''): array {
    $nn = normName($name); $ph = digits10($phone); $hs = normSite($site); $em = strtolower(trim($email)); $o = [];
    foreach ($X as $id => $R) {
        if ((string) $id === $skip) continue; $why = [];
        if ($nn !== '' && normName((string) ($R['name'] ?? '')) === $nn) $why[] = 'the same name';
        if ($ph !== '' && in_array($ph, recPhones($R), true)) $why[] = 'the same phone';
        if ($em !== '' && in_array($em, recEmails($R), true)) $why[] = 'the same email';
        if ($hs !== '' && normSite((string) ($R['site'] ?? '')) === $hs) $why[] = 'the same website';
        if ($why) $o[] = ['id' => (string) $id, 'name' => (string) ($R['name'] ?? ''), 'why' => implode(', ', $why), 'removed' => !empty($R['off'])];
    }
    return array_slice($o, 0, 5);
}
/* for the Peak email sender: the addresses on the desk that asked not to be contacted, both lists. Their contact entries already carry no
   email (the sender's own reading skips them); this list also covers the same address found on a company's website. */
function deskNoContact(): array {
    $o = [];
    foreach (['sponsor', 'expo'] as $w) foreach (recs($w) as $R) foreach (deskNoContactOf($R) as $e) $o[$e] = 1;
    return array_map('strval', array_keys($o));
}
/* the same for one record the caller already has (the sender builds its own from seedModel() + apply(), so this writes nothing) */
function deskNoContactOf(array $R): array {
    $o = []; foreach (array_keys($R['dnc'] ?? []) as $k) if (str_starts_with((string) $k, 'e:')) $o[] = substr((string) $k, 2);
    return $o;
}

/* ---- message templates (Sixfold's, 2026-11-18): plain friendly words, no prices and nothing Peak has not published. Merge fields: {first}
   the contact's first name, {company}, {tour} the next tour booked, {me} the seller's first name. Admins change them in More, Settings. ---- */
function starterTemplates(string $w): array {
    $x = $w === 'expo'; $what = $x ? 'holding an event at Peak' : 'sponsoring at Peak';
    $T = [
        ['k' => 'first', 'name' => 'First outreach', 'when' => 'new',
            'text' => 'Hi {first}, this is {me} with Peak Pickleball at Chapel Hills Mall. I\'d like to talk with you about ' . ($x ? 'holding one of {company}\'s events at Peak' : '{company} sponsoring at Peak') . '. Do you have 10 minutes for a call this week?',
            'subject' => $x ? 'An event space for {company}' : 'Peak Pickleball and {company}',
            'body' => $x
                ? "Hi {first},\n\nI'm {me} with Peak Pickleball, the indoor pickleball center at Chapel Hills Mall in Colorado Springs. Along with our 24 courts we host events: the building is about 80,000 square feet over two levels, and in April 2026 it held the Senior Lifestyle Expo with more than 100 vendors.\n\nIf {company} is looking at venues for an upcoming show, I'd be glad to walk you through the space and talk dates. Would a short call or a tour work for you?\n\nThanks,\n{me}\nPeak Pickleball"
                : "Hi {first},\n\nI'm {me} with Peak Pickleball, the indoor pickleball center at Chapel Hills Mall in Colorado Springs. We have 24 courts on two levels, with open play, leagues, lessons and tournaments.\n\nI'd like to talk with you about {company} sponsoring at Peak. Would you have 15 minutes for a call, or time to come and see the building?\n\nThanks,\n{me}\nPeak Pickleball"],
        ['k' => 'vm', 'name' => 'After a voicemail', 'when' => 'voicemail',
            'text' => 'Hi {first}, it\'s {me} from Peak Pickleball. I just left you a voicemail about ' . $what . '. Call or text me back whenever suits you.',
            'subject' => 'Following up on my voicemail',
            'body' => "Hi {first},\n\nI just left you a voicemail and wanted to follow up here too. I'm {me} with Peak Pickleball at Chapel Hills Mall, and I'd like to talk with you about " . $what . ".\n\nIs there a good time for a quick call this week?\n\nThanks,\n{me}\nPeak Pickleball"],
        ['k' => 'tour', 'name' => 'Tour confirmation', 'when' => 'tour',
            'text' => 'Hi {first}, it\'s {me} from Peak Pickleball confirming your tour on {tour}. We\'re at 1730 Briargate Blvd, at Chapel Hills Mall. Text me if anything changes.',
            'subject' => 'Your tour of Peak Pickleball: {tour}',
            'body' => "Hi {first},\n\nThis is to confirm your tour of Peak Pickleball on {tour}. We're at 1730 Briargate Blvd, Colorado Springs, at Chapel Hills Mall.\n\nIf anything changes, just reply or call me. Looking forward to showing you around.\n\nThanks,\n{me}\nPeak Pickleball"],
        ['k' => 'proposal', 'name' => $x ? 'Quote follow-up' : 'Proposal follow-up', 'when' => $x ? 'quote' : 'proposal',
            'text' => 'Hi {first}, it\'s {me} at Peak Pickleball. Just checking you got the ' . ($x ? 'quote' : 'proposal') . ' I sent. Happy to answer any questions or change anything in it.',
            'subject' => ($x ? 'The quote' : 'The proposal') . ' for {company}',
            'body' => "Hi {first},\n\nI wanted to check that you got the " . ($x ? 'quote for your event' : 'sponsorship proposal') . " I sent. If you have any questions, or would like anything changed, just let me know.\n\nThanks,\n{me}\nPeak Pickleball"],
        ['k' => 'thanks', 'name' => 'Thank you after a tour', 'when' => 'toured',
            'text' => 'Hi {first}, thanks for coming to see Peak today. It was good to meet you. Let me know if any questions come up.',
            'subject' => 'Thanks for visiting Peak',
            'body' => "Hi {first},\n\nThanks for coming to see Peak Pickleball. It was good to meet you and show you around.\n\nIf any questions come up, just reply here or give me a call, and I'll be in touch about next steps.\n\nThanks,\n{me}\nPeak Pickleball"],
        ['k' => 'last', 'name' => 'Last try', 'when' => 'tries',
            'text' => 'Hi {first}, it\'s {me} from Peak Pickleball. I\'ve tried you a few times about ' . $what . ' and don\'t want to be a bother. If now isn\'t the right time, no problem. I\'ll check back later.',
            'subject' => 'One last note from Peak Pickleball',
            'body' => "Hi {first},\n\nI've tried to reach you a few times about " . $what . " and don't want to keep filling your inbox. If now isn't the right time, that's no problem at all. I'll check back in a couple of months.\n\nThanks,\n{me}\nPeak Pickleball"],
    ];
    return array_map(fn($t) => $t + ['starter' => true], $T);
}
function templatesOf(string $w): array { $t = settingOf($w, 'templates', null); return is_array($t) && $t ? $t : starterTemplates($w); }

/* the rows for one touch: the touch, the stage it moves to, the owner if nobody has it, the follow-up (a due follow-up is done once someone
   reaches out, so it is cleared unless a new one is set) */
function touchRows(string $w, array $R, string $k, array $touch, string $by, bool $canOwn, string $fu, string $fuWhat, int $now): array {
    $id = (string) $R['id']; $rows = [];
    $st = advanceFor($w, (string) $R['stage'], (string) $touch['m']);
    if ($st !== '') $touch['from'] = (string) $R['stage'];
    if ($fu !== '') $touch['fu'] = $fu;
    $rows[] = rowTouch($w, $id, $k, $touch, $by, $now);
    if ($st !== '') $rows[] = rowStage($w, $id, $st, $by, $now, ['tk' => $k]);
    if ($canOwn && (string) $R['owner'] === '') $rows[] = rowOwner($w, $id, $by, $by, $now);
    if ($fu !== '') $rows[] = rowNext($w, $id, ['date' => $fu, 'what' => $fuWhat !== '' ? $fuWhat : 'Follow up'], $by, $now);
    elseif (!empty($R['next']['date']) && $R['next']['date'] <= date('Y-m-d')) $rows[] = rowNext($w, $id, null, $by, $now);
    return $rows;
}

/* ---- the Peak email sender's doors (2026-11-17): mark a company Emailed when an email goes out, log a reply or a bounce ----
   Three ways in, all the same: these functions (require this file), `php desk.php emailed|replied|bounced ...`, or the HTTP actions
   `emailed` / `emailreply` / `emailbounce` with the X-Desk-Key header (php desk.php servicekey "Peak email" makes the key). $ref (the
   sender's own send id, or a message id) makes a repeat call harmless. A removed company still gets the touch: the email went out.
   Since 2026-11-18 the sender (outbox-092b0f/peak/lib.php) requires this file and calls them straight after each send, reply and bounce. */
function deskEmailed(string $w, string $id, string $to, string $subject = '', string $by = 'Peak email', string $ref = '', int $when = 0): array {
    W($w); $to = clean($to, 160); $subject = clean($subject, 160); $by = clean($by, 60) ?: 'Peak email'; $ref = clean($ref, 200);
    if ($to !== '' && !filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'error' => 'That email does not look right.', 'code' => 400];
    return withLock(function () use ($w, $id, $to, $subject, $by, $ref, $when) {
        sync($w, true); $R = recs($w)[$id] ?? null;
        if (!$R) return ['ok' => false, 'error' => 'No such lead.', 'code' => 404];
        if ($ref !== '') foreach ($R['touches'] as $t) if (($t['ref'] ?? '') === $ref) return ['ok' => true, 'dup' => true, 'k' => $t['k'], 'stage' => $R['stage']];
        $now = time(); $k = newKey();
        $touch = ['m' => 'email', 'out' => 'sent', 'note' => 'Sent' . ($subject !== '' ? ' "' . $subject . '"' : '') . ($to !== '' ? ' to ' . $to : '') . ' (automatic email)', 'when' => $when > 0 && $when <= $now ? $when : $now, 'auto' => 1];
        if ($to !== '') $touch['to'] = $to; if ($ref !== '') $touch['ref'] = $ref;
        $rows = touchRows($w, $R, $k, $touch, $by, false, '', '', $now);
        $rows = array_values(array_filter($rows, fn($r) => $r['t'] !== W($w)['T']['next']));   /* an automatic email never clears a person's follow-up */
        commit($w, $rows);
        return ['ok' => true, 'k' => $k, 'stage' => recs($w)[$id]['stage']];
    });
}
/* a reply: a touch (email, replied) and, unless a follow-up is already set for today or earlier, a follow-up today so it shows on Today.
   $stop (2026-11-18: a STOP reply or the unsubscribe link): no more emails. A company nobody has taken on that is still being reached
   (To contact .. Texted; expo To contact, Contacted) goes to Not now, back in 90 days, with the reason. One a person owns, or one further
   along, keeps its stage; its owner gets a follow-up today to see it. */
const STOP_BACK_DAYS = 90;
function deskReplied(string $w, string $id, string $from, string $note = '', string $by = 'Peak email', string $ref = '', bool $stop = false): array {
    W($w); $from = clean($from, 160); $note = clean($note, 600); $by = clean($by, 60) ?: 'Peak email'; $ref = clean($ref, 200);
    return withLock(function () use ($w, $id, $from, $note, $by, $ref, $stop) {
        sync($w, true); $R = recs($w)[$id] ?? null;
        if (!$R) return ['ok' => false, 'error' => 'No such lead.', 'code' => 404];
        if ($ref !== '') foreach ($R['touches'] as $t) if (($t['ref'] ?? '') === $ref) return ['ok' => true, 'dup' => true, 'k' => $t['k'], 'stage' => $R['stage']];
        $now = time(); $k = newKey(); $C = W($w);
        $txt = ($from !== '' ? $from . ' replied' : 'They replied') . ($stop ? ' and asked not to be emailed again' : '') . ($note !== '' ? ': ' . $note : '.');
        $touch = ['m' => 'email', 'out' => 'replied', 'note' => $txt, 'when' => $now, 'auto' => 1]; if ($ref !== '') $touch['ref'] = $ref;
        $rows = [rowTouch($w, $id, $k, $touch, $by, $now)];
        $nd = (string) ($R['next']['date'] ?? ''); $open = in_array((string) $R['owner'], ['', $by], true);
        $r = stageRank($w, (string) $R['stage']); $reaching = $r >= 0 && $r < $C['reach'];
        if ($stop && $open && $reaching) {
            $back = date('Y-m-d', strtotime('+' . STOP_BACK_DAYS . ' days', $now)); $why = 'Asked not to be emailed again';
            $rows[] = rowStage($w, $id, 'notnow', $by, $now, ['back' => $back, 'why' => $why, 'tk' => $k]);
            $rows[] = rowNext($w, $id, ['date' => $back, 'what' => 'Come back to them: ' . $why . ' (no more emails)'], $by, $now);
        } elseif (!in_array($R['stage'], $C['done'], true) && ($nd === '' || $nd > date('Y-m-d')) && (!$stop || !$open))
            $rows[] = rowNext($w, $id, ['date' => date('Y-m-d'), 'what' => $stop ? 'They asked not to be emailed again: no more emails' : 'They replied to the email: answer them'], $by, $now);
        commit($w, $rows);
        return ['ok' => true, 'k' => $k, 'stage' => recs($w)[$id]['stage']];
    });
}
/* a time booked from the email's "book a time" page (2026-11-18): a tour on the desk (a call says so in its note), the company moves to
   Meeting / tour booked (expo: Tour booked) from anywhere earlier, as a tour booked by hand does. Nobody becomes owner. $ref makes a repeat
   harmless. */
function deskBooked(string $w, string $id, string $date, string $time, string $who, string $note = '', string $by = 'Peak email', string $ref = ''): array {
    W($w); $who = clean($who, 120); $note = clean($note, 400); $by = clean($by, 60) ?: 'Peak email'; $ref = clean($ref, 200);
    if (!okDay($date) || !okTime($time)) return ['ok' => false, 'error' => 'Pick a day and a time.', 'code' => 400];
    return withLock(function () use ($w, $id, $date, $time, $who, $note, $by, $ref) {
        sync($w, true); $R = recs($w)[$id] ?? null;
        if (!$R) return ['ok' => false, 'error' => 'No such lead.', 'code' => 404];
        if ($ref !== '') foreach (toursOf($w) as $t) if (($t['ref'] ?? '') === $ref) return ['ok' => true, 'dup' => true, 'tid' => $t['tid'], 'stage' => $R['stage']];
        $now = time(); $tid = bin2hex(random_bytes(5)); $C = W($w);
        $row = ['t' => $C['T']['tour'], 'tid' => $tid, 'id' => $id, 'lead' => $id, 'date' => $date, 'time' => $time, 'who' => $who, 'note' => $note, 'by' => $by, 'at' => $now, 'auto' => 1];
        if ($ref !== '') $row['ref'] = $ref;
        $rows = [$row]; $to = forwardTo($w, (string) $R['stage'], $C['tourSt']); if ($to !== '') $rows[] = rowStage($w, $id, $to, $by, $now);
        commit($w, $rows);
        return ['ok' => true, 'tid' => $tid, 'stage' => recs($w)[$id]['stage']];
    });
}
/* a bounce (2026-11-18): the email to that address did not arrive. A touch (email, bounced) and nothing else: the stage, the owner and the
   follow-up stay, so the team sees the address is dead and finds another way in. */
function deskBounced(string $w, string $id, string $to, string $note = '', string $by = 'Peak email', string $ref = ''): array {
    W($w); $to = clean($to, 160); $note = clean($note, 400); $by = clean($by, 60) ?: 'Peak email'; $ref = clean($ref, 200);
    return withLock(function () use ($w, $id, $to, $note, $by, $ref) {
        sync($w, true); $R = recs($w)[$id] ?? null;
        if (!$R) return ['ok' => false, 'error' => 'No such lead.', 'code' => 404];
        if ($ref !== '') foreach ($R['touches'] as $t) if (($t['ref'] ?? '') === $ref) return ['ok' => true, 'dup' => true, 'k' => $t['k'], 'stage' => $R['stage']];
        $now = time(); $k = newKey();
        $touch = ['m' => 'email', 'out' => 'bounced', 'note' => 'The email' . ($to !== '' ? ' to ' . $to : '') . ' bounced: that address does not take mail' . ($note !== '' ? ' (' . $note . ')' : '') . '.', 'when' => $now, 'auto' => 1];
        if ($to !== '') $touch['to'] = $to; if ($ref !== '') $touch['ref'] = $ref;
        commit($w, [rowTouch($w, $id, $k, $touch, $by, $now)]);
        return ['ok' => true, 'k' => $k, 'stage' => recs($w)[$id]['stage']];
    });
}

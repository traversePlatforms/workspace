<?php
/* Move Matthew's own desk chats out of the Sixfold app into J.A.R.V.I.S. (2026-11-19, Matthew: "go ahead with moving the desk chats off
   sixfold app completely"). A one-off, run on the server over SSH from the laptop (by hand, 19 Nov: 14 chats, 88 rows, 1 file), in three steps:
     php desk-move.php list       the ids of his own tickets in the Sixfold app's help.log: started by him AND every person-written
                                  message his (a ticket another admin wrote in is left alone and named on stderr). Reads only.
     php desk-move.php rows       those tickets' rows, one JSON row a line (for jvdesk.php import). Reads only.
     php desk-move.php close <id...>   one status row per moved ticket on the END of help.log, through the Field app's own appendLine()
                                  (status closed, note "moved to J.A.R.V.I.S."): the Field app's own way to close a chat, so it leaves the
                                  open list. help.log is never rewritten and no row is removed; staff tickets are never touched.
   The files (photos, voice notes, PDFs) are copied, not moved (cp -p into assistant-private/data/jarvis/desk/files/<id>/). Rows: the close row it adds is never exported again. */
if (PHP_SAPI !== 'cli') exit;
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $_GET = ['action' => 'none']; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require getenv('HOME') . '/www/traverseplatforms.com/public_html/api/rounds.php'; } catch (SixfoldOut $e) { }
$ME = 'Matthew Sharpe';
$cmd = $argv[1] ?? '';
$T = helpAll(); $mine = [];
foreach ($T as $id => $t) {
    if ($t['by'] !== $ME) continue;
    $people = array_filter($t['msgs'], fn($m) => !preg_match('/^(claude|j\.?a\.?r\.?v\.?i\.?s\.?)$/i', trim((string) $m['from'])));
    if (!$people) continue;
    if (array_filter($people, fn($m) => $m['from'] !== $ME)) { fwrite(STDERR, "left alone (someone else wrote in it): $id\n"); continue; }
    $mine[$id] = true;
}
if ($cmd === 'list') { echo implode("\n", array_keys($mine)), "\n"; exit; }
if ($cmd === 'rows') {
    foreach (readLines(helpFile()) as $r) if (isset($mine[(string) ($r['id'] ?? '')]) && strpos((string) ($r['note'] ?? ''), 'moved to J.A.R.V.I.S.') !== 0) echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
    exit;
}
if ($cmd === 'close') {
    $n = 0;
    foreach (array_slice($argv, 2) as $id) {
        if (!isset($mine[$id])) { fwrite(STDERR, "not one of his own: $id (left alone)\n"); continue; }
        if (($T[$id]['status'] ?? '') === 'closed') continue;
        if (appendLine(helpFile(), ['t' => 'status', 'id' => $id, 'status' => 'closed', 'by' => $ME, 'note' => 'moved to J.A.R.V.I.S. (his own app), 19 Nov 2026', 'at' => time()])) $n++;
    }
    echo "closed $n\n"; exit;
}
fwrite(STDERR, "usage: php desk-move.php list | rows | close <id...>\n"); exit(2);

/* Every hand lawn measure on the server, from every install that keeps them (2026-11-21, with the measure-only role on Traverse Yards):
   Sixfold 365's (Matthew's and Jen's, saved from the app or with traverse/ops/hand-save.php) AND Traverse Yards' (Claire's measure-only
   account, from 21 Nov). Both live in the install's data folder as lawnhand-<town>.log (one JSON row per save, the latest row per house wins,
   sq 0 = cleared): sixfold-data/rounds/ and traverse-yards-data/rounds/ on traverseplatforms.com. Any other *-data/rounds with such logs is read
   too. Read-only on the server: it reads the logs and the search index (to name each house) and changes nothing.
     node hand-logs.mjs                  -> the table on screen, and hand-logs.json beside this script (gitignored: addresses)
   Each row says whether yard-v2-retune.mjs's KEY has the address yet. Before the next tune: add the new ones to KEY (tune or hold) and to
   yard-retune-parcels.mjs's LOTS (address, town), run that for their lot lines, then the retune. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync as __ex } from 'node:fs'; import { homedir as __home } from 'node:os';
const SGP = __ex('/c/Users/SURGEI~1/.ssh/sg.sh') ? '/c/Users/SURGEI~1/.ssh/sg.sh' : __home() + '/jarvis/bin/sg.sh';   // 23 Nov: laptop or VM
const SG = [SGP, 'trav', 'php -d memory_limit=1024M'];
const PHP = String.raw`<?php
$base = getenv('HOME') . '/www/traverseplatforms.com'; $out = [];
foreach (glob($base . '/*-data/rounds', GLOB_ONLYDIR) as $R) {
    $logs = glob($R . '/lawnhand-*.log'); if (!$logs) continue;
    $inst = basename(dirname($R)); $last = [];
    foreach ($logs as $f) {
        if (!preg_match('/^lawnhand-([a-z0-9-]+)\.log$/', basename($f), $m)) continue;   /* never the .pre-* backups */
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) { $r = json_decode($ln, true); if (!is_array($r) || !isset($r['id'])) continue; $r['region'] = $m[1]; $last[$m[1] . '|' . $r['id']] = $r; }
    }
    $last = array_filter($last, fn($r) => !empty($r['sq']));
    $need = []; foreach ($last as $k => $r) $need[$k] = true;
    $addr = [];
    $ix = @fopen($R . '/search-index.txt', 'r');
    if ($ix) { while (($l = fgets($ix)) !== false) { $p = explode("\t", rtrim($l, "\n")); $k = ($p[0] ?? '') . '|' . ($p[3] ?? ''); if (isset($need[$k]) && !isset($addr[$k])) $addr[$k] = [$p[4] ?? '', $p[1] ?? '']; } fclose($ix); }
    foreach ($last as $k => $r) $out[] = ['install' => $inst, 'region' => $r['region'], 'id' => $r['id'], 'address' => $addr[$k][0] ?? '', 'town' => $addr[$k][1] ?? $r['region'],
        'sq' => (int) $r['sq'], 'src' => $r['src'] ?? '', 'incl' => $r['incl'] ?? '', 'by' => $r['by'] ?? '', 'at' => (int) ($r['at'] ?? 0), 'photo' => $r['photo'] ?? null, 'acres' => $r['acres'] ?? null, 'note' => $r['note'] ?? ''];
}
echo json_encode($out, JSON_UNESCAPED_SLASHES);
`;
const raw = execFileSync('bash', SG, { input: PHP, encoding: 'utf8', maxBuffer: 64 << 20 });
const rows = JSON.parse(raw.slice(raw.indexOf('[')));
const keyText = readFileSync(new URL('./yard-v2-retune.mjs', import.meta.url), 'utf8');
const inKey = new Set([...keyText.matchAll(/\['([0-9][^']+)',\s*\d+/g)].map((m) => m[1]));
rows.sort((a, b) => a.at - b.at);
for (const r of rows) r.inKey = inKey.has(r.address);
writeFileSync(new URL('./hand-logs.json', import.meta.url), JSON.stringify({ read: new Date().toISOString(), rows }, null, 1));
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(pad('install', 20) + pad('town', 18) + pad('address', 28) + pad('sq ft', 8) + pad('incl', 7) + pad('by', 16) + pad('date', 12) + pad('app', 7) + 'in KEY');
for (const r of rows) console.log(pad(r.install, 20) + pad(r.town, 18) + pad(r.address || '(' + r.id + ')', 28) + pad(r.sq, 8) + pad(r.incl, 7) + pad(r.by, 16) + pad(new Date(r.at * 1000).toISOString().slice(0, 10), 12) + pad(r.photo ?? '-', 7) + (r.inKey ? 'yes' : 'NO'));
const fresh = rows.filter((r) => !r.inKey);
console.log('\n' + rows.length + ' hand measures in ' + new Set(rows.map((r) => r.install)).size + ' installs; ' + fresh.length + ' not in yard-v2-retune.mjs KEY yet.');

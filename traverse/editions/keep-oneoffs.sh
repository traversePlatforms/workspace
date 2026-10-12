#!/bin/bash
# Run AFTER any upload of Sixfold's index.json: puts back the live one-off towns ("admin": true, e.g. Bailey) from the backup the
# upload made. The PHP goes to the server as a file (stdin), never through shell quoting (2026-10-12: inline quoting lost the $s and
# Bailey dropped off the list twice).    bash keep-oneoffs.sh <backup .tgz name in ~/upload-backups>
set -u
B="$1"
bash /c/Users/SURGEI~1/.ssh/sg.sh trav "cd ~/www/traverseplatforms.com/sixfold-data/rounds && rm -rf /tmp/kof && mkdir -p /tmp/kof && tar -xzf ~/upload-backups/$B -C /tmp/kof index.json && cat > /tmp/kof/k.php && php /tmp/kof/k.php" <<'PHP'
<?php
$live = json_decode(file_get_contents('index.json'), true); $old = json_decode(file_get_contents('/tmp/kof/index.json'), true);
if (!is_array($live['regions'] ?? null) || !is_array($old['regions'] ?? null)) { echo "index unreadable: nothing changed\n"; exit(1); }
$have = array_column($live['regions'], 'key'); $n = 0;
foreach ($old['regions'] as $r) if (!empty($r['admin']) && !in_array($r['key'], $have, true)) { $live['regions'][] = $r; $n++; }
if ($n) { file_put_contents('index.json.tmp', json_encode($live, JSON_UNESCAPED_SLASHES)); rename('index.json.tmp', 'index.json'); }
$k = array_column($live['regions'], 'key');
echo "one-off towns put back: $n; towns listed: " . count($k) . "; bailey listed: " . (in_array('bailey', $k, true) ? 'yes' : 'NO') . "\n";
PHP

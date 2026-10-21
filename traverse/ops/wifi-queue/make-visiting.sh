#!/bin/bash
# Fetch the "houses we are visiting" list from the live Sixfold data (read-only) into state/visiting.json (2026-10-20).
# A throwaway copy of the app outside the website folder answers one command-line question (visiting-export.php), then is deleted.
Q="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue"
A="/c/Users/Surge Inc/Desktop/claude test 2/traverse/app/api"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
mkdir -p "$Q/state"
TMP=$(mktemp -d)
node -e "const fs=require('fs');const s=fs.readFileSync(process.argv[1],'utf8');const a='    out(squareSweep());\n';if(s.split(a).length!==2){console.error('anchor');process.exit(1)}fs.writeFileSync(process.argv[3],s.split(a).join(fs.readFileSync(process.argv[2],'utf8')))" "$A/rounds.php" "$Q/visiting-export.php" "$TMP/rounds.php" || exit 1
cat > "$TMP/run.php" <<'PHPEOF'
<?php
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true); date_default_timezone_set('America/Denver');
$_REQUEST = ['action' => 'squaresweep']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require __DIR__ . '/api/rounds.php'; } catch (SixfoldOut $e) { echo json_encode($e->body); }
PHPEOF
D='~/www/traverseplatforms.com/visit-tmp'
$SG "mkdir -p $D/api && cd $D/api && for f in config.php skiptrace.php webpush.php sms.php billing.php smtp.php; do ln -sf ../../public_html/api/\$f \$f; done" < /dev/null || exit 1
cat "$TMP/rounds.php" | $SG "cat > $D/api/rounds.php" && cat "$TMP/run.php" | $SG "cat > $D/run.php && cd $D && php run.php; cd .. && rm -r visit-tmp" > "$Q/state/visiting.json.new"
rm -rf "$TMP"
node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!j.ok)throw 'not ok';const c=o=>Object.values(o||{}).reduce((n,a)=>n+a.length,0);console.log('visiting list: '+c(j.first)+' houses tied to leads/walks/handed doors, '+c(j.areas)+' assigned neighbourhoods, '+c(j.knocked)+' doors knocked in 30 days')" "$Q/state/visiting.json.new" && mv "$Q/state/visiting.json.new" "$Q/state/visiting.json"

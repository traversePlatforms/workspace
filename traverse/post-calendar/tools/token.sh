#!/bin/bash
# The Meta (Pipeline) token on the server for the post calendar (2026-10-31). Never prints the token: it travels from the laptop file
# (~/.ssh/meta-messenger-test.json, "system_token") to the server only through a pipe.
#   bash traverse/post-calendar/tools/token.sh compare   says whether the server's sixfold-private/meta-social.json holds the same token
#                                                        (the calendar reads that file when it has none of its own)
#   bash traverse/post-calendar/tools/token.sh push      writes post-calendar-data/private/meta-token.json (chmod 600), which then wins;
#                                                        use it when the token is rotated, or to stop depending on sixfold-private
set -euo pipefail
SG=(bash /c/Users/SURGEI~1/.ssh/sg.sh trav)
TOK() { node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.ssh/meta-messenger-test.json','utf8')).system_token||'')"; }
case "${1:-}" in
  compare) TOK | "${SG[@]}" 'php -r '\''$t=stream_get_contents(STDIN); $j=json_decode((string)@file_get_contents(getenv("HOME")."/www/traverseplatforms.com/sixfold-private/meta-social.json"),true); $s=(string)($j["system_token"]??""); echo ($t!=="" && hash_equals($s,$t)) ? "same token\n" : "different token (or none on the server)\n";'\''' ;;
  push) TOK | "${SG[@]}" 'umask 077; d=$HOME/www/traverseplatforms.com/post-calendar-data/private; mkdir -p "$d" && chmod 700 "$d" && php -r '\''$t=trim(stream_get_contents(STDIN)); if($t===""){fwrite(STDERR,"empty\n");exit(1);} file_put_contents($argv[1].".tmp", json_encode(["system_token"=>$t,"at"=>time()])); chmod($argv[1].".tmp",0600); rename($argv[1].".tmp",$argv[1]); echo "written, chmod 600\n";'\'' "$d/meta-token.json"' ;;
  *) echo "usage: token.sh compare|push"; exit 1 ;;
esac

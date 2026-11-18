#!/bin/bash
# Surge's LinkedIn app keys on the server for the post calendar (2026-11-18). Never prints them: they travel from the laptop file
# ~/.ssh/surge-linkedin-app.txt (line 1 client ID, line 2 primary client secret) to the server only through a pipe.
#   bash traverse/post-calendar/tools/linkedin-app.sh push      writes post-calendar-data/private/linkedin-app.json (chmod 600)
#   bash traverse/post-calendar/tools/linkedin-app.sh compare   says whether the server holds the same keys (prints only same/different)
set -euo pipefail
SG=(bash /c/Users/SURGEI~1/.ssh/sg.sh trav)
KEYS() { node -e "const l=require('fs').readFileSync(require('os').homedir()+'/.ssh/surge-linkedin-app.txt','utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean); if(l.length<2){process.stderr.write('the keys file needs 2 lines\n');process.exit(1)} process.stdout.write(JSON.stringify({client_id:l[0],client_secret:l[1]}))"; }
case "${1:-}" in
  push) KEYS | "${SG[@]}" 'umask 077; d=$HOME/www/traverseplatforms.com/post-calendar-data/private; mkdir -p "$d" && chmod 700 "$d" && php -r '\''$j=json_decode(stream_get_contents(STDIN),true); if(!is_array($j)||($j["client_id"]??"")===""||($j["client_secret"]??"")===""){fwrite(STDERR,"empty\n");exit(1);} $f=$argv[1]; $old=json_decode((string)@file_get_contents($f),true); if(is_array($old)) foreach(["version","scopes_extra"] as $k) if(isset($old[$k])) $j[$k]=$old[$k]; $j["at"]=time(); file_put_contents($f.".tmp",json_encode($j)); chmod($f.".tmp",0600); rename($f.".tmp",$f); echo "written, chmod 600\n";'\'' "$d/linkedin-app.json"' ;;
  compare) KEYS | "${SG[@]}" 'php -r '\''$t=json_decode(stream_get_contents(STDIN),true); $s=json_decode((string)@file_get_contents(getenv("HOME")."/www/traverseplatforms.com/post-calendar-data/private/linkedin-app.json"),true); echo (is_array($s) && hash_equals((string)($s["client_id"]??""),(string)$t["client_id"]) && hash_equals((string)($s["client_secret"]??""),(string)$t["client_secret"])) ? "same keys\n" : "different keys (or none on the server)\n";'\''' ;;
  *) echo "usage: linkedin-app.sh push|compare"; exit 1 ;;
esac

#!/bin/bash
# Traverse launch pre-check, 8 am Thu 29 Oct 2026 (Matthew 28 Oct night: "8 am launch pre-check", read-only). Run once by the Windows task
# "Traverse launch pre-check"; writes "Traverse launch pre-check 29 Oct.txt" to the Desktop's "Clients & own work" folder and opens it.
# Nothing here changes, sends, queues or opens anything: the site stays private, the mail login is tested up to AUTH and then QUIT.
#   bash traverse/ops/launch-precheck-2026-10-29.sh
set -u
OUT="$USERPROFILE/Desktop/Clients & own work/Traverse launch pre-check 29 Oct.txt"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
{
echo "Traverse launch pre-check - $(date '+%a %d %b %Y %I:%M %p')"
echo "Read-only: nothing was changed, sent or queued."
echo
c=$(curl -s -o /dev/null -w "%{http_code}" https://traverseplatforms.com/)
[ "$c" = 401 ] && echo "OK    Site still private (visitors get the password box). Opening it is the next step, on your go." || echo "LOOK  Site answered $c to a visitor (expected 401 while private)."
c=$(curl -s -o /dev/null -w "%{http_code}" https://traverseplatforms.com/summit-de59ae83/)
[ "$c" = 200 ] && echo "OK    Sixfold 365 app loads." || echo "LOOK  Sixfold 365 app answered $c."
# the site's own pages, signed in with the site login (read inside the script, never printed), and the desk and mail login on the server
{ awk 'NR==2{print $2} NR==3{print $2}' "$USERPROFILE/.ssh/traverse-site-preview.txt" | tr -d '\r'; } | $SG 'read -r U; read -r P; H=~/www/traverseplatforms.com
  b=$(curl -s -u "$U:$P" "https://traverseplatforms.com/?cb=$RANDOM"); echo "$b" | grep -q "more than a million properties" && echo "OK    Homepage loads with the new FAQ." || echo "LOOK  Homepage did not show the new FAQ."
  for p in privacy cancellation; do curl -s -u "$U:$P" "https://traverseplatforms.com/$p/?cb=$RANDOM" | grep -q "Last updated" && { curl -s -u "$U:$P" "https://traverseplatforms.com/$p/" | grep -q "· Draft" && echo "LOOK  $p page still says Draft." || echo "OK    $p page loads, no Draft label."; } || echo "LOOK  $p page did not load."; done
  d=$(curl -s -o /dev/null -w "%{http_code}" -u "$U:$P" "https://traverseplatforms.com/demo/"); [ "$d" = 200 ] && echo "OK    Book a demo page loads." || echo "LOOK  Book a demo page answered $d."
  D=$H/traverse-prospects-data; h=$(cat $D/send-after.txt 2>/dev/null); [ "$h" = 1793289300 ] && echo "OK    Email hold in place: nothing sends before 9:55 am (first run 10 am)." || echo "LOOK  Email hold file is not what it should be."
  q=$(php -r "\$q=@json_decode(@file_get_contents(\"$D/queue.json\"),true); echo is_array(\$q)?count(\$q):0;"); echo "INFO  Emails waiting in the queue: $q (press Queue on the Email page to add your first 10 to 20)."
  t=$(php -r "\$n=0; foreach(@file(\"$D/events.log\")?:[] as \$l){\$r=json_decode(\$l,true); if((\$r[\"t\"]??\"\")===\"test\") \$n++;} echo \$n;"); echo "INFO  Test emails sent from the desk so far: $t."
  php -r "
    \$c=[\"host\"=>\"smtp.gmail.com\",\"port\"=>587,\"user\"=>\"m.sharpe@traverseplatforms.com\",\"pass\"=>\"\"]; \$o=@include \"$H/traverse-site-private/site-config.php\"; if(is_array(\$o[\"smtp\"]??null)) \$c=array_merge(\$c,\$o[\"smtp\"]); \$c[\"pass\"]=preg_replace(\"/\\\\s+/\",\"\",(string)\$c[\"pass\"]);
    \$f=@stream_socket_client(\"tcp://\".\$c[\"host\"].\":\".\$c[\"port\"],\$e,\$es,15); if(!\$f){echo \"LOOK  Mail server did not answer.\n\"; exit;}
    \$rd=function()use(\$f){\$x=\"\";while((\$l=fgets(\$f,2048))!==false){\$x=\$l; if(strlen(\$l)<4||\$l[3]!==\"-\")break;} return (int)substr(\$x,0,3);};
    \$w=function(\$s)use(\$f){fwrite(\$f,\$s.\"\r\n\");};
    \$rd(); \$w(\"EHLO traverseplatforms.com\"); \$rd(); \$w(\"STARTTLS\"); if(\$rd()!==220){echo \"LOOK  Mail: STARTTLS refused.\n\"; exit;}
    stream_socket_enable_crypto(\$f,true,STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT); \$w(\"EHLO traverseplatforms.com\"); \$rd();
    \$w(\"AUTH LOGIN\"); \$rd(); \$w(base64_encode(\$c[\"user\"])); \$rd(); \$w(base64_encode(\$c[\"pass\"])); \$a=\$rd(); \$w(\"QUIT\"); fclose(\$f);
    echo \$a===235 ? \"OK    Sending login works (signed in to Gmail and quit; nothing sent).\n\" : \"LOOK  Sending login was refused (code \$a).\n\";"
'
echo
echo "Still to do before 10 am: say 'open it' (the site), send yourself a test from Prospects > Email > Send yourself a test, then Queue 10 to 20."
} > "$OUT" 2>&1
cmd.exe /c start "" notepad.exe "$(cygpath -w "$OUT")" > /dev/null 2>&1

#!/bin/bash
# The laptop watcher after the move (2026-11-19): a staff ticket still goes the Sixfold/Field app way, his own thread the J.A.R.V.I.S. way.
# Runs a COPY of traverse/ops/help-watch.sh (--once) against stand-ins: the server (every SSH command is answered by stub-sg below, which
# keeps what it was asked), Claude Code (stub-claude: answers through whichever reply script the prompt names) and a throwaway repo with
# copies of the prompts and both reply scripts (help-reply.sh's SSH pointed at the stand-in). Nothing reaches the live server, Claude or a
# real ticket.   bash assistant/jarvis/tests/watch-test.sh
set -u
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
W=$(mktemp -d); [ -n "${KEEP:-}" ] || trap 'rm -rf "$W"' EXIT; echo "work: $W"
FR="$W/repo"; mkdir -p "$FR/traverse/ops" "$FR/assistant/jarvis/tools" "$W/st"
pass=0; fail=0; ok() { if eval "$1"; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $2"; fi; }
for f in help-desk-prompt.md jarvis-matthew-prompt.md jarvis-quick-prompt.md jarvis-learned.md jarvis-learned-office.md help-reply.sh; do cp "$REPO/traverse/ops/$f" "$FR/traverse/ops/" 2>/dev/null; done
cp "$REPO/assistant/jarvis/tools/jarvis-reply.sh" "$REPO/assistant/jarvis/tools/desk-moved.txt" "$FR/assistant/jarvis/tools/"
sed -i 's#^SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"#SG="bash '"$W"'/stub-sg.sh"#' "$FR/traverse/ops/help-reply.sh"
# the watcher copy: the stand-ins in place of the server, Claude and the folders; --once takes a mode
sed -e 's#^REPO=.*#REPO="'"$FR"'"; ST="'"$W"'/st"; mkdir -p "$ST"#' \
    -e 's#LOG="$ST/help-watch.log"; SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LOCK="$ST/running.lock"#LOG="$ST/help-watch.log"; SG="bash '"$W"'/stub-sg.sh"; LOCK="$ST/running.lock"#' \
    -e 's#^claude_bin() .*#claude_bin() { echo "'"$W"'/stub-claude.sh"; }#' \
    -e 's#one_ticket; exit 0; fi#one_ticket "${2:-}"; exit 0; fi#' \
    -e 's#/c/Users/SURGEI~1/.ssh/jarvis-desk-key.txt#'"$W"'/no-key.txt#g' \
    "$REPO/traverse/ops/help-watch.sh" > "$W/help-watch.sh"
grep -q "stub-sg.sh\"; LOCK" "$W/help-watch.sh" && grep -q 'stub-claude' "$W/help-watch.sh" && grep -q "ST=\"$W/st\"" "$W/help-watch.sh" || { echo "FAIL: could not make the watcher copy"; exit 1; }
STAFF=h20261119120000ab12; MINE=h20261119120100cd34; DEAD=h20261119120200dead
cat > "$W/stub-sg.sh" <<EOF
#!/bin/bash
# the server, standing in: logs each command; answers like help-next.php, help-reply.php, the help.log grep and jvdesk.php
C="\$*"; echo "\$C" >> "$W/calls.log"; IN=\$(cat)
case "\$C" in
  *"sixfold-tools/help-next.php"*) [ -f "$W/staff.json" ] && { cat "$W/staff.json"; rm -f "$W/staff.json"; } ;;
  *"sixfold-tools/help-reply.php"*) set -- \$C; echo "\$3 \$4 \$IN" >> "$W/sixfold-replies.log"; echo "{\"id\":\"\$3\",\"t\":\"reply\",\"status\":\"\$4\",\"at\":\$(date +%s)}" >> "$W/helplog"; echo "replied (\$4)" ;;
  *"help.log"*) grep "\"id\":\"\$(echo "\$C" | grep -o 'h[0-9]\{14\}[0-9a-f]\{4\}' | head -1)\"" "$W/helplog" 2>/dev/null ;;
  *"jvdesk.php next"*) [ -f "$W/mine.json" ] && { cat "$W/mine.json"; rm -f "$W/mine.json"; } ;;
  *"jvdesk.php reply"*) set -- \$C; echo "\$4 \$5 \$IN" >> "$W/jarvis-replies.log"; echo "replied (\$5) in J.A.R.V.I.S." ;;
  *"jvdesk.php final-since"*) set -- \$C; grep -q "^\$4 \(answered\|matthew\)" "$W/jarvis-replies.log" 2>/dev/null ;;
  *) : ;;
esac
EOF
cat > "$W/stub-claude.sh" <<EOF
#!/bin/bash
# Claude Code, standing in: notes its model and environment, then answers through the reply script the prompt names (or not at all)
P=\$(cat); echo "args: \$* | HELP_REPLY_SIXFOLD=\${HELP_REPLY_SIXFOLD:-unset}" >> "$W/claude.log"; printf '%s' "\$P" > "$W/prompt-\$(echo "\$P" | grep -o 'h[0-9]\{14\}[0-9a-f]\{4\}' | head -1).txt"
ID=\$(echo "\$P" | grep -o '"id": *"h[0-9]\{14\}[0-9a-f]\{4\}"' | head -1 | grep -o 'h[0-9]\{14\}[0-9a-f]\{4\}')
case "\$ID" in *dead) exit 0;; esac
if echo "\$P" | grep -q 'jarvis-reply.sh'; then printf 'Desk answer for you.' | bash "$FR/assistant/jarvis/tools/jarvis-reply.sh" "\$ID" answered
else printf 'Staff answer for Jen.' | bash "$FR/traverse/ops/help-reply.sh" "\$ID" answered; fi
EOF
chmod +x "$W/stub-sg.sh" "$W/stub-claude.sh"
export JARVIS_SG="bash $W/stub-sg.sh" JARVIS_DESK_KEYFILE="$W/no-key.txt" JARVIS_QUICK=0
tk() { printf '{"id":"%s","by":"%s","ctx":null,"waiting":1,"conversation":[{"from":"%s","when":"Thu 19 Nov 12:00 pm","text":"%s"}],"photoDir":"/x/%s","audioDir":"/x/%s"%s}\n' "$1" "$2" "$2" "$3" "$1" "$1" "${4:-}"; }

# 1. a staff ticket (Jen): the Sixfold app's path, exactly as before
tk $STAFF "Jen McPherson" "The deposit link is broken" > "$W/staff.json"
bash "$W/help-watch.sh" --once
ok 'grep -q "^$STAFF answered Staff answer for Jen." "$W/sixfold-replies.log"' 'staff: the answer goes into the Sixfold app (help-reply.php)'
ok '! grep -q jvdesk "$W/calls.log"' 'staff: nothing touches the J.A.R.V.I.S. desk'
ok 'grep -q "Sixfold app'"'"'s J.A.R.V.I.S. chat" "$W/prompt-$STAFF.txt" && grep -q "traverse/ops/help-reply.sh" "$W/prompt-$STAFF.txt"' 'staff: the prompt names the Sixfold chat and help-reply.sh'
ok 'grep -q "model sonnet" "$W/claude.log" && grep -q "HELP_REPLY_SIXFOLD=1" "$W/claude.log"' 'staff: Sonnet, and help-reply.sh answers in the Sixfold app'
ok 'grep -q "$STAFF: done" "$W/st/help-watch.log"' 'staff: the watcher logs it done'

# 2. his own thread: the J.A.R.V.I.S. desk
: > "$W/claude.log"; : > "$W/calls.log"
tk $MINE "Matthew Sharpe" "Check the Houston lot lines" ',"desk":"jarvis"' > "$W/mine.json"
bash "$W/help-watch.sh" --once jarvis
ok 'grep -q "^$MINE answered Desk answer for you." "$W/jarvis-replies.log"' 'his thread: the answer goes into J.A.R.V.I.S. (jvdesk.php reply)'
ok '! grep -q "sixfold-tools\|help.log" "$W/calls.log"' 'his thread: nothing touches the Sixfold app'
ok 'grep -q "J.A.R.V.I.S. desk: his own standalone J.A.R.V.I.S. app, NOT the Sixfold app" "$W/prompt-$MINE.txt" && grep -q "assistant/jarvis/tools/jarvis-reply.sh" "$W/prompt-$MINE.txt"' 'his thread: the prompt says J.A.R.V.I.S. and jarvis-reply.sh'
ok 'grep -q "model opus" "$W/claude.log" && grep -q "HELP_REPLY_SIXFOLD=0" "$W/claude.log"' 'his thread: Opus (his mode)'
ok 'grep -q "$MINE: done" "$W/st/help-watch.log"' 'his thread: the watcher logs it done'

# 3. a session that never answers: Jen hears it went to Matthew (Sixfold); Matthew hears it in J.A.R.V.I.S.
tk ${DEAD} "Jen McPherson" "Nothing works" > "$W/staff.json"; bash "$W/help-watch.sh" --once
ok 'grep -q "^$DEAD matthew I couldn.t finish looking into this one, so I.ve passed it to Matthew" "$W/sixfold-replies.log"' 'staff, no answer: passed to Matthew in the Sixfold app, as before'
tk ${DEAD} "Matthew Sharpe" "Nothing works" ',"desk":"jarvis"' > "$W/mine.json"; bash "$W/help-watch.sh" --once jarvis
ok 'grep -q "^$DEAD matthew I couldn.t finish this one, sir" "$W/jarvis-replies.log"' 'his thread, no answer: he is told in J.A.R.V.I.S.'

# 4. help-reply.sh on one of his moved threads goes to J.A.R.V.I.S. (a builder still using it), but not from a Sixfold-app session
MV=$(grep -m1 -E '^h[0-9]{14}[0-9a-f]{4}$' "$FR/assistant/jarvis/tools/desk-moved.txt")
if [ -n "$MV" ]; then
  : > "$W/jarvis-replies.log"; : > "$W/sixfold-replies.log"
  printf 'Builder note.' | HELP_REPLY_SIXFOLD= bash "$FR/traverse/ops/help-reply.sh" "$MV" answered > /dev/null
  ok 'grep -q "^$MV answered Builder note." "$W/jarvis-replies.log" && [ ! -s "$W/sixfold-replies.log" ]' 'help-reply.sh: a moved thread is answered in J.A.R.V.I.S.'
  printf 'Sixfold note.' | HELP_REPLY_SIXFOLD=1 bash "$FR/traverse/ops/help-reply.sh" "$MV" answered > /dev/null
  ok 'grep -q "^$MV answered Sixfold note." "$W/sixfold-replies.log"' 'help-reply.sh: from a Sixfold-app session it stays in the Sixfold app'
  printf 'Staff note.' | HELP_REPLY_SIXFOLD= bash "$FR/traverse/ops/help-reply.sh" $STAFF answered > /dev/null
  ok 'grep -q "^$STAFF answered Staff note." "$W/sixfold-replies.log"' 'help-reply.sh: a staff ticket is never redirected'
else ok false 'desk-moved.txt lists no thread'; fi
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]

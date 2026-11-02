#!/bin/bash
# The Help desk watcher (2026-11-01, Matthew: "build it as a plan only no card"). Task Scheduler "Sixfold Help watcher" runs this every
# 2 minutes (conhost --headless, like the overnight check). It asks the server for the next new Help ticket (sixfold-tools/help-next.php,
# which marks it "working"); if there is one, it starts a Claude Code session on Matthew's plan (claude -p, permission mode auto) in this
# repo with the ticket and the rules in traverse/ops/help-desk-prompt.md. The session fixes what it may and replies through
# traverse/ops/help-reply.sh. If it ends without replying, the ticket goes to Matthew with a short note to the writer.
# One session at a time. Log: %LOCALAPPDATA%/ProjectBackup/help/help-watch.log; each session's output: <ticket>.out beside it.
#   bash traverse/ops/help-watch.sh            (what the task runs)
set -u
REPO="/c/Users/Surge Inc/Desktop/claude test 2"; ST="$LOCALAPPDATA/ProjectBackup/help"; mkdir -p "$ST"
LOG="$ST/help-watch.log"; SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
LOCK="$ST/running.lock"
if [ -f "$LOCK" ]; then
  # a session is running (or died): leave it for up to 100 minutes
  [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 6000 ] && exit 0
  echo "$(date '+%F %T') stale lock removed" >> "$LOG"; rm -f "$LOCK"
fi
[ -f "$ST/pause" ] && exit 0   # touch %LOCALAPPDATA%/ProjectBackup/help/pause to stop picking up tickets
CLAUDE=$(ls -d "/c/Users/Surge Inc/.vscode/extensions"/anthropic.claude-code-*-win32-x64/resources/native-binary/claude.exe 2>/dev/null | sort -V | tail -1)
[ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { echo "$(date '+%F %T') no claude.exe found" >> "$LOG"; exit 1; }
T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php' < /dev/null 2>>"$LOG") || { echo "$(date '+%F %T') server not reachable" >> "$LOG"; exit 0; }
[ -n "$T" ] || exit 0
ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "$(date '+%F %T') could not read the ticket" >> "$LOG"; exit 1; }
touch "$LOCK"
echo "$(date '+%F %T') $ID: session started" >> "$LOG"
PROMPT="A new Help ticket from the Sixfold app. Handle it now under the rules in traverse/ops/help-desk-prompt.md (also appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
cd "$REPO" && "$CLAUDE" -p "$PROMPT" --permission-mode auto --append-system-prompt "$(cat "$REPO/traverse/ops/help-desk-prompt.md")" --output-format text > "$ST/$ID.out" 2>&1
RC=$?
LAST=$($SG "grep '\"id\":\"$ID\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log | tail -1" < /dev/null 2>/dev/null)
if ! printf '%s' "$LAST" | grep -q '"t":"reply"' || printf '%s' "$LAST" | grep -q '"status":"working"'; then
  printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you." | bash "$REPO/traverse/ops/help-reply.sh" "$ID" matthew >> "$LOG" 2>&1
  echo "$(date '+%F %T') $ID: no final reply from the session (exit $RC): passed to Matthew" >> "$LOG"
else
  echo "$(date '+%F %T') $ID: done (exit $RC)" >> "$LOG"
fi
rm -f "$LOCK"

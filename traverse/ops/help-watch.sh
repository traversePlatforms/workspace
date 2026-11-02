#!/bin/bash
# The J.A.R.V.I.S. watcher (the Sixfold Help chat; 2026-11-01, Matthew: "plan only no card"; faster replies the same evening).
# Task Scheduler "Sixfold Help watcher" starts this every 2 minutes (conhost --headless); a running copy makes the task skip (IgnoreNew),
# so one copy stays up: it asks the server every 5 seconds whether anything is waiting (api/help-pending.php, a tiny check with the key in
# ~/.ssh/help-poll-key.txt), and only then takes the ticket over SSH (sixfold-tools/help-next.php, which marks it "working") and starts a
# Claude Code session on Matthew's plan (claude -p, Sonnet, permission mode auto) with the rules in traverse/ops/help-desk-prompt.md. The
# session replies through traverse/ops/help-reply.sh; if it ends without a final reply, the ticket goes to Matthew with a note to the writer.
# Each copy runs about 58 minutes, then exits and the task starts a fresh one. One session at a time.
# Log: %LOCALAPPDATA%/ProjectBackup/help/help-watch.log; each session's output: <ticket>.out beside it. Pause: create .../help/pause.
#   bash traverse/ops/help-watch.sh           (the task)      bash traverse/ops/help-watch.sh --once   (one look, then exit)
set -u
REPO="/c/Users/Surge Inc/Desktop/claude test 2"; ST="$LOCALAPPDATA/ProjectBackup/help"; mkdir -p "$ST"
LOG="$ST/help-watch.log"; SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; LOCK="$ST/running.lock"
KEY=$(cat /c/Users/SURGEI~1/.ssh/help-poll-key.txt 2>/dev/null); CHECK="https://traverseplatforms.com/api/help-pending.php?k=$KEY"
MODEL="${HELP_MODEL:-sonnet}"   # Sonnet: quick and light on the plan; HELP_MODEL=opus for a heavier one
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
claude_bin() { ls -d "/c/Users/Surge Inc/.vscode/extensions"/anthropic.claude-code-*-win32-x64/resources/native-binary/claude.exe 2>/dev/null | sort -V | tail -1; }

one_ticket() {
  local T ID PROMPT RC LAST CLAUDE
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php' < /dev/null 2>>"$LOG") || { log "server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "could not read the ticket"; return 1; }
  touch "$LOCK"; log "$ID: session started ($MODEL)"
  PROMPT="A new message in the Sixfold app's J.A.R.V.I.S. chat. Handle it now under the rules in traverse/ops/help-desk-prompt.md (also appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
  (cd "$REPO" && "$CLAUDE" -p "$PROMPT" --model "$MODEL" --permission-mode auto --append-system-prompt "$(cat "$REPO/traverse/ops/help-desk-prompt.md")" --output-format text > "$ST/$ID.out" 2>&1); RC=$?
  LAST=$($SG "grep '\"id\":\"$ID\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log | tail -1" < /dev/null 2>/dev/null)
  if ! printf '%s' "$LAST" | grep -q '"t":"reply"' || printf '%s' "$LAST" | grep -q '"status":"working"'; then
    printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you." | bash "$REPO/traverse/ops/help-reply.sh" "$ID" matthew >> "$LOG" 2>&1
    log "$ID: no final reply from the session (exit $RC): passed to Matthew"
  else log "$ID: done (exit $RC)"; fi
  rm -f "$LOCK"
}

if [ -f "$LOCK" ]; then
  [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 6000 ] && exit 0   # a session is running (another copy): leave it
  log "stale lock removed"; rm -f "$LOCK"
fi
if [ "${1:-}" = "--once" ]; then [ -f "$ST/pause" ] || one_ticket; exit 0; fi
END=$(( $(date +%s) + 3480 ))
while [ "$(date +%s)" -lt "$END" ]; do
  if [ ! -f "$ST/pause" ]; then
    N=$(curl -s -m 8 "$CHECK" 2>/dev/null)
    if [[ "$N" =~ ^[0-9]+$ ]] && [ "$N" -gt 0 ]; then one_ticket; continue; fi
  fi
  sleep 5
done

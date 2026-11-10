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
claude_bin() { ls -d "/c/Users/Surge Inc/.vscode/extensions"/anthropic.claude-code-*-win32-*/resources/native-binary/claude.exe 2>/dev/null | sort -V | tail -1; }

# photos sent in the chat (3 Nov, Matthew: "build a photo button for everyone that uses jarvis include jen"): copied from the server's
# private folder to $ST/photos/<ticket>/ so the session can look at them; prints a line per photo for the prompt
get_photos() {
  local T="$1" ID="$2" DIR N OUT="$ST/photos/$2"
  DIR=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).photoDir||'')}catch(e){}})")
  printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{JSON.parse(s).conversation.forEach((m,i)=>(m.photos||[]).forEach(n=>console.log((i+1)+' '+n)))}catch(e){}})" | while read -r I N; do
    [[ "$N" =~ ^p[0-9]{10}[0-9a-f]{6}\.(jpg|png|webp)$ ]] && [[ "$DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] || continue
    mkdir -p "$OUT"; [ -s "$OUT/$N" ] || $SG "cat '$DIR/$N'" < /dev/null > "$OUT/$N" 2>>"$LOG"
    [ -s "$OUT/$N" ] && echo "- message $I: $(cygpath -w "$OUT/$N")"
  done
}

one_ticket() {
  local T ID PROMPT RC LAST CLAUDE PICS
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php' < /dev/null 2>>"$LOG") || { log "server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "could not read the ticket"; return 1; }
  BY=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).by||'')}catch(e){}})")
  local M="$MODEL"; [ "$BY" = "Matthew Sharpe" ] && M="${HELP_MODEL_MATTHEW:-opus}"   # Matthew's own messages: app work, the heavier model (2 Nov)
  touch "$LOCK"; log "$ID: session started ($M, from $BY)"
  PICS=$(get_photos "$T" "$ID")
  PROMPT="A new message in the Sixfold app's J.A.R.V.I.S. chat. Handle it now under the rules in traverse/ops/help-desk-prompt.md (also appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
  [ -n "$PICS" ] && PROMPT="$PROMPT

Photos sent in this conversation, copied to this laptop. Look at each one with the Read tool before you answer:
$PICS"
  (cd "$REPO" && "$CLAUDE" -p "$PROMPT" --model "$M" --permission-mode auto --append-system-prompt "$(cat "$REPO/traverse/ops/help-desk-prompt.md")" --output-format text > "$ST/$ID.out" 2>&1); RC=$?
  LAST=$($SG "grep '\"id\":\"$ID\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log | tail -1" < /dev/null 2>/dev/null)
  if ! printf '%s' "$LAST" | grep -q '"t":"reply"' || printf '%s' "$LAST" | grep -q '"status":"working"'; then
    printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you." | bash "$REPO/traverse/ops/help-reply.sh" "$ID" matthew >> "$LOG" 2>&1
    log "$ID: no final reply from the session (exit $RC): passed to Matthew"
  else log "$ID: done (exit $RC)"; fi
  rm -f "$LOCK"
}

# The practice copy's chat (2 Nov, Matthew: "make jarvis aware that it is only a tester version and give it no way to make changes but act
# like its changing things ... then give a disclaimer"). A session with NO tools, NO MCP servers and no settings or CLAUDE.md (run from a
# folder outside the user profile), only traverse/ops/help-practice-prompt.md; its text output is posted as the reply.
PCWD=/c/ProgramData/jarvis-practice
one_practice() {
  local T ID OUT CLAUDE
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php --practice' < /dev/null 2>>"$LOG") || { log "practice: server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "practice: could not read the ticket"; return 1; }
  local CONV; CONV=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);console.log(t.conversation.map(m=>m.from+' ('+m.when+'): '+m.text+((m.photos||[]).length?' [sent '+m.photos.length+' photo'+(m.photos.length>1?'s':'')+']':'')).join('\n\n'))}catch(e){}})")
  log "practice $ID: session started"
  mkdir -p "$PCWD"
  OUT=$(cd "$PCWD" && "$CLAUDE" -p "The chat so far (answer the last message):

$CONV" --tools "" --strict-mcp-config --setting-sources project --model sonnet --system-prompt "$(cat "$REPO/traverse/ops/help-practice-prompt.md")" --output-format text 2>>"$ST/p-$ID.out")
  [ -n "$OUT" ] || OUT="My apologies, I seem to have lost my train of thought. Could you send that again?"
  printf '%s' "$OUT" > "$ST/p-$ID.reply"
  printf '%s' "$OUT" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID answered --practice" >> "$LOG" 2>&1
  log "practice $ID: done"
}

if [ -f "$LOCK" ]; then
  [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 6000 ] && exit 0   # a session is running (another copy): leave it
  log "stale lock removed"; rm -f "$LOCK"
fi
if [ "${1:-}" = "--once" ]; then [ -f "$ST/pause" ] || one_ticket; exit 0; fi
# When the quick HTTPS check stops answering a number (9 Nov 2026: SiteGround's bot captcha answered this laptop's address with a 202 HTML
# page for hours, so the loop saw nothing and no ticket was picked up), the count is read over SSH instead (sixfold-tools/help-next.php
# --peek, which only looks), every 30 seconds, until HTTPS answers a number again. Logged once each way so it is seen.
BAD=0; VIA=https
peek_ssh() { $SG 'cd $HOME/www/traverseplatforms.com/sixfold-tools && { php help-next.php --peek | grep -c "\"waiting\""; echo "|"; php help-next.php --peek --practice | grep -c "\"waiting\""; }' < /dev/null 2>>"$LOG" | tr -d '\n'; }
END=$(( $(date +%s) + 3480 ))
while [ "$(date +%s)" -lt "$END" ]; do
  if [ ! -f "$ST/pause" ]; then
    N=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK" 2>/dev/null)
    if [[ "$N" =~ ^[0-9]+$ ]]; then
      BAD=0; [ "$VIA" = ssh ] && { log "https check answers again: back to the 5 s poll"; VIA=https; }
      if [ "$N" -gt 0 ]; then one_ticket; continue; fi
      P=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&p=1" 2>/dev/null)
      if [[ "$P" =~ ^[0-9]+$ ]] && [ "$P" -gt 0 ]; then one_practice; continue; fi
    else
      BAD=$(( BAD + 1 ))
      if [ "$BAD" -ge 3 ]; then
        [ "$VIA" = https ] && { log "https check is not answering a number (got: $(printf '%s' "$N" | tr -d '\r\n' | cut -c1-60)): reading over SSH every 30 s"; VIA=ssh; }
        R=$(peek_ssh); L="${R%%|*}"; PR="${R##*|}"
        if [[ "$L" =~ ^[0-9]+$ ]] && [ "$L" -gt 0 ]; then one_ticket; continue; fi
        if [[ "$PR" =~ ^[0-9]+$ ]] && [ "$PR" -gt 0 ]; then one_practice; continue; fi
        sleep 25
      fi
    fi
  fi
  sleep 5
done

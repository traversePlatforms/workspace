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

# voice notes (11 Nov, Matthew: "Lets go ahead and build in the voice notes"). transcribe <file>: ffmpeg makes a 16 kHz mono WAV, whisper.cpp
# (large-v3-turbo, English, on this laptop) makes the text; at most 3 minutes a note, so a stuck one never holds the watcher. Prints the
# text, or nothing (return 1) when it could not be made.   bash traverse/ops/help-watch.sh --transcribe <file>   (a test: prints the text)
WHISPER_DIR="/c/Users/Matthew sharpe/tools/whisper-cpp"
transcribe() {
  local IN="$1" B WAV FF WC WM TXT
  B="${IN%.*}"; WAV="$B.16k.wav"
  FF=$(command -v ffmpeg 2>/dev/null) || FF=$(ls "$LOCALAPPDATA"/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe 2>/dev/null | tail -1)
  WC="$WHISPER_DIR/Release/whisper-cli.exe"; WM="$WHISPER_DIR/models/ggml-large-v3-turbo-q5_0.bin"
  [ -n "$FF" ] && [ -f "$WC" ] && [ -f "$WM" ] || { log "transcribe: ffmpeg or whisper.cpp is missing"; return 1; }
  timeout 60 "$FF" -nostdin -loglevel error -y -i "$(cygpath -w "$IN")" -ar 16000 -ac 1 -c:a pcm_s16le "$(cygpath -w "$WAV")" < /dev/null 2>>"$LOG" || { log "transcribe: ffmpeg could not read $(basename "$IN")"; rm -f "$WAV"; return 1; }
  rm -f "$B.txt"
  timeout 180 "$WC" -m "$(cygpath -w "$WM")" -l en -t 8 -nt -np -otxt -of "$(cygpath -w "$B")" -f "$(cygpath -w "$WAV")" < /dev/null > /dev/null 2>&1 || { log "transcribe: whisper failed or ran over 3 minutes on $(basename "$IN")"; rm -f "$WAV"; return 1; }
  rm -f "$WAV"
  TXT=$(sed -e 's/\[BLANK_AUDIO\]//g' "$B.txt" 2>/dev/null | tr -s ' \r\n\t' ' ' | sed -E 's/^ +| +$//g'); rm -f "$B.txt"
  [ -n "$TXT" ] || return 1
  printf '%s' "$TXT"
}

# get_audio <ticket JSON> <ticket id> [--practice]: each voice note in the conversation is copied from the server's private folder to
# $ST/audio/<ticket>/ and transcribed once; the text is posted back (sixfold-tools/help-transcript.php) so the chat shows it under the note,
# or the note is marked not transcribed. A note the server already has text for (an earlier message) is not done again; every note's text
# ends up in $ST/audio/<ticket>/<file>.txt. Prints a line per note for the prompt.
get_audio() {
  local T="$1" ID="$2" PX="${3:-}" DIR OUT="$ST/audio/$2" I N SECS HAS WHO TXT T0
  DIR=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);console.log(t.audioDir||t.photoDir||'')}catch(e){}})")
  mkdir -p "$OUT"
  printf '%s' "$T" | OUT="$OUT" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const fs=require('fs'),p=require('path');JSON.parse(s).conversation.forEach((m,i)=>(m.audio||[]).forEach(a=>{if(!/^a[0-9]{10}[0-9a-f]{6}\.(webm|ogg|m4a|mp3|aac)$/.test(a.n||''))return;let h='0';if(a.text){h='1';fs.writeFileSync(p.join(process.env.OUT,a.n+'.txt'),a.text)}else if(a.failed)h='f';console.log([i+1,a.n,a.secs|0,h,String(m.from||'').replace(/[\t\r\n]+/g,' ')].join('\t'))}))}catch(e){}})" | while IFS=$'\t' read -r I N SECS HAS WHO; do
    TXT=""
    if [ "$HAS" = 1 ]; then TXT=$(cat "$OUT/$N.txt")
    elif [ "$HAS" = 0 ]; then
      T0=$(date +%s)
      if [ -s "$OUT/$N.txt" ]; then TXT=$(cat "$OUT/$N.txt")   # made before, but the post back did not land
      else
        [[ "$DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] && { [ -s "$OUT/$N" ] || $SG "cat '$DIR/$N'" < /dev/null > "$OUT/$N" 2>>"$LOG"; }
        [ -s "$OUT/$N" ] && TXT=$(transcribe "$OUT/$N")
      fi
      if [ -n "$TXT" ]; then
        printf '%s' "$TXT" > "$OUT/$N.txt"
        printf '%s' "$TXT" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-transcript.php $ID $N $PX" >> "$LOG" 2>&1
        log "$ID: voice note $N transcribed in $(( $(date +%s) - T0 )) s"
      else
        $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-transcript.php $ID $N --failed $PX" < /dev/null >> "$LOG" 2>&1
        log "$ID: voice note $N could not be transcribed"
      fi
    fi
    if [ -n "$TXT" ]; then echo "- Voice note from $WHO (message $I, $((SECS / 60)):$(printf '%02d' $((SECS % 60)))), transcribed: $TXT"
    else echo "- Voice note from $WHO (message $I): voice note could not be transcribed. If you need what it said, ask them to type it."; fi
  done
}

one_ticket() {
  local T ID PROMPT RC LAST CLAUDE PICS AUD
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php' < /dev/null 2>>"$LOG") || { log "server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "could not read the ticket"; return 1; }
  BY=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).by||'')}catch(e){}})")
  local M="$MODEL"; [ "$BY" = "Matthew Sharpe" ] && M="${HELP_MODEL_MATTHEW:-opus}"   # Matthew's own messages: app work, the heavier model (2 Nov)
  touch "$LOCK"; log "$ID: session started ($M, from $BY)"
  PICS=$(get_photos "$T" "$ID")
  AUD=$(get_audio "$T" "$ID")
  PROMPT="A new message in the Sixfold app's J.A.R.V.I.S. chat. Handle it now under the rules in traverse/ops/help-desk-prompt.md (also appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
  [ -n "$PICS" ] && PROMPT="$PROMPT

Photos sent in this conversation, copied to this laptop. Look at each one with the Read tool before you answer:
$PICS"
  [ -n "$AUD" ] && PROMPT="$PROMPT

Voice notes sent in this conversation, turned into text on this laptop (whisper.cpp; a word here and there may be off). Treat each as if they had typed it:
$AUD"
  # 11 Nov (Matthew): his tickets add jarvis-matthew-prompt.md (his personal assistant across Surge, Sixfold, Traverse, Peak, Donny,
  # personal); every ticket adds jarvis-learned.md (what past tickets taught; the session adds to it)
  local SYS; SYS="$(cat "$REPO/traverse/ops/help-desk-prompt.md")"
  [ "$BY" = "Matthew Sharpe" ] && [ -f "$REPO/traverse/ops/jarvis-matthew-prompt.md" ] && SYS="$SYS

$(cat "$REPO/traverse/ops/jarvis-matthew-prompt.md")"
  [ -f "$REPO/traverse/ops/jarvis-learned.md" ] && SYS="$SYS

$(tail -n 150 "$REPO/traverse/ops/jarvis-learned.md")"
  (cd "$REPO" && "$CLAUDE" -p "$PROMPT" --model "$M" --permission-mode auto --append-system-prompt "$SYS" --output-format text > "$ST/$ID.out" 2>&1); RC=$?
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
  local T ID OUT CLAUDE AUD
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php --practice' < /dev/null 2>>"$LOG") || { log "practice: server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "practice: could not read the ticket"; return 1; }
  AUD=$(get_audio "$T" "$ID" --practice)   # voice notes (11 Nov): transcribed like the live chat's, shown as [voice note: ...] below
  local CONV; CONV=$(printf '%s' "$T" | AD="$ST/audio/$ID" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);const fs=require('fs'),vt=a=>{try{return /^a[0-9]{10}[0-9a-f]{6}[.][a-z0-9]+$/.test(a.n||'')?fs.readFileSync(process.env.AD+'/'+a.n+'.txt','utf8').trim():''}catch(e){return ''}};console.log(t.conversation.map(m=>m.from+' ('+m.when+'): '+m.text+((m.photos||[]).length?' [sent '+m.photos.length+' photo'+(m.photos.length>1?'s':'')+']':'')+(m.audio||[]).map(a=>{const x=vt(a);return x?' [voice note: '+x+']':' [sent a voice note]'}).join('')).join('\n\n'))}catch(e){}})")
  log "practice $ID: session started"
  mkdir -p "$PCWD"
  OUT=$(cd "$PCWD" && "$CLAUDE" -p "The chat so far (answer the last message):

$CONV" --tools "" --strict-mcp-config --setting-sources project --model sonnet --system-prompt "$(cat "$REPO/traverse/ops/help-practice-prompt.md")" --output-format text 2>>"$ST/p-$ID.out")
  [ -n "$OUT" ] || OUT="My apologies, I seem to have lost my train of thought. Could you send that again?"
  printf '%s' "$OUT" > "$ST/p-$ID.reply"
  printf '%s' "$OUT" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID answered --practice" >> "$LOG" 2>&1
  log "practice $ID: done"
}

# a test of the transcription alone (11 Nov): prints the text of one audio file
if [ "${1:-}" = "--transcribe" ]; then transcribe "${2:?file}" && echo; exit $?; fi
if [ -f "$LOCK" ]; then
  [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 6000 ] && exit 0   # a session is running (another copy): leave it
  log "stale lock removed"; rm -f "$LOCK"
fi
if [ "${1:-}" = "--once" ]; then [ -f "$ST/pause" ] || one_ticket; exit 0; fi
# When the quick HTTPS check stops answering a number (9 Nov 2026: SiteGround's bot captcha answered this laptop's address with a 202 HTML
# page for hours, so the loop saw nothing and no ticket was picked up), the count is read over SSH instead (sixfold-tools/help-next.php
# --peek, which only looks), every 30 seconds, until HTTPS answers a number again. Logged once each way so it is seen.
BAD=0; VIA=https
# 11 Nov (Matthew, the "free fix"): while HTTPS is captcha'd, ONE long SSH connection stays open and the server prints the two counts
# every 5 s ("L|P"), instead of a fresh SSH login every 30 s. If the stream dies it is reopened; after 3 failures in a row it falls back
# to the old fresh look every 30 s until HTTPS answers again. bash sets STREAM_PID and STREAM[0] for the coproc.
SFAIL=0
stream_open() {
  coproc STREAM { $SG 'cd $HOME/www/traverseplatforms.com/sixfold-tools && for i in $(seq 1 720); do L=$(php help-next.php --peek | grep -c "\"waiting\""); P=$(php help-next.php --peek --practice | grep -c "\"waiting\""); echo "$L|$P"; sleep 5; done' < /dev/null 2>>"$LOG"; }
}
stream_close() { [ -n "${STREAM_PID:-}" ] && kill "$STREAM_PID" 2>/dev/null; wait "${STREAM_PID:-}" 2>/dev/null; unset STREAM_PID; }
stream_read() {   # the newest "L|P" line; fails if the stream is gone or silent for 20 s
  local line="" x fd="${STREAM[0]:-}"
  [ -n "$fd" ] || return 1
  read -r -t 20 -u "$fd" line || return 1
  while read -r -t 0.2 -u "$fd" x; do line="$x"; done   # skip lines that piled up during a session
  printf '%s' "$line"
}
peek_ssh() { $SG 'cd $HOME/www/traverseplatforms.com/sixfold-tools && { php help-next.php --peek | grep -c "\"waiting\""; echo "|"; php help-next.php --peek --practice | grep -c "\"waiting\""; }' < /dev/null 2>>"$LOG" | tr -d '\n'; }
END=$(( $(date +%s) + 3480 ))
while [ "$(date +%s)" -lt "$END" ]; do
  if [ ! -f "$ST/pause" ]; then
    N=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK" 2>/dev/null)
    if [[ "$N" =~ ^[0-9]+$ ]]; then
      BAD=0; [ "$VIA" = ssh ] && { log "https check answers again: back to the 5 s poll"; VIA=https; stream_close; SFAIL=0; }
      if [ "$N" -gt 0 ]; then one_ticket; continue; fi
      P=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&p=1" 2>/dev/null)
      if [[ "$P" =~ ^[0-9]+$ ]] && [ "$P" -gt 0 ]; then one_practice; continue; fi
    else
      BAD=$(( BAD + 1 ))
      if [ "$BAD" -ge 3 ]; then
        [ "$VIA" = https ] && { log "https check is not answering a number (got: $(printf '%s' "$N" | tr -d '\r\n' | cut -c1-60)): reading over one open SSH connection every 5 s"; VIA=ssh; }
        R=""
        if [ "$SFAIL" -lt 3 ]; then
          { [ -n "${STREAM_PID:-}" ] && kill -0 "$STREAM_PID" 2>/dev/null; } || { stream_close; stream_open; }
          R=$(stream_read) || R=""
          if [[ "$R" =~ ^[0-9]+\|[0-9]+$ ]]; then SFAIL=0
          else SFAIL=$(( SFAIL + 1 )); R=""; stream_close; [ "$SFAIL" -ge 3 ] && log "the open SSH connection keeps dropping: back to a fresh SSH look every 30 s"; fi
        fi
        if [ -z "$R" ]; then R=$(peek_ssh); [ "$SFAIL" -ge 3 ] && sleep 25; fi
        L="${R%%|*}"; PR="${R##*|}"
        if [[ "$L" =~ ^[0-9]+$ ]] && [ "$L" -gt 0 ]; then one_ticket; continue; fi
        if [[ "$PR" =~ ^[0-9]+$ ]] && [ "$PR" -gt 0 ]; then one_practice; continue; fi
        continue
      fi
    fi
  fi
  sleep 5
done

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
JV_INSTALLS="${JARVIS_INSTALLS:-c-houston-lawn-test}"   # client installs with their own J.A.R.V.I.S. (18 Nov), see one_install
# 19 Nov (Matthew: "go ahead with moving the desk chats off sixfold app completely. Jarvis for me needs to be in stand alone thing entirely"):
# HIS desk chats are in J.A.R.V.I.S.'s own store on the Assistant's server (assistant-private/lib/desk.php), not in the Sixfold app. The 5 s
# look asks a-e018bb82/api.php?action=jvdpending with the laptop's key (~/.ssh/jarvis-desk-key.txt, in a header file made at start, never on
# a command line); the thread comes over SSH (assistant-private/jvdesk.php next) and the session answers with assistant/jarvis/tools/
# jarvis-reply.sh. Same prompts, models and quick pass as before. Staff tickets (Jen, Brad), the practice copy and the Houston install are
# unchanged: the Sixfold/Field app path below.
JD_TOOL='$HOME/www/traverseplatforms.com/assistant-private/jvdesk.php'
JD_URL="https://traverseplatforms.com/a-e018bb82/api.php?action=jvdpending"
JD_HDR=""; if [ -s /c/Users/SURGEI~1/.ssh/jarvis-desk-key.txt ]; then
  JD_HDR=$(mktemp); chmod 600 "$JD_HDR"; printf 'X-Jarvis-Key: %s\n' "$(tr -d '\r\n' < /c/Users/SURGEI~1/.ssh/jarvis-desk-key.txt)" > "$JD_HDR"
  trap 'rm -f "$JD_HDR"' EXIT; JD_HDRW=$(cygpath -w "$JD_HDR" 2>/dev/null || echo "$JD_HDR"); fi
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
# 19 Nov (TASKS X-15, the cloud J.A.R.V.I.S. on the Azure machine; traverse/ops/JARVIS-CLOUD.md): this laptop stays the fallback.
#  - Every 60 s it reads the cloud's beat (api/help-pending.php?b=1: "<age s> <mode> <ready>", or over SSH when HTTPS is blocked) and STANDS
#    BACK only while the cloud says live, ready and has beaten in the last 4 minutes; otherwise it takes tickets as before. $ST/no-defer = never
#    stand back. (In shadow mode the cloud only watches, so nothing here changes.)
#  - Every 2 minutes (in the background, nice 19) jarvis-cloud-sync.sh cycle: the cloud's commits and notes onto this repo and memory, this
#    repo and memory to the cloud, and any job the cloud queued for the laptop into $ST/cloud-jobs/, which this loop runs first (one_job).
#  - The 5-minute beat also writes "<time> <HEAD>" to the server (jarvis-cloud/laptop.txt): the cloud changes the repo only when this is
#    over 15 minutes old (the laptop away) and it already holds that HEAD.
CSYNC="$REPO/traverse/ops/jarvis-cloud-sync.sh"; DEFER=0; CLOUD_AT=0; SYNC_AT=0
PBD="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup"
cloud_tick() {
  local now R old=$DEFER; now=$(date +%s)
  if [ $(( now - CLOUD_AT )) -ge 60 ]; then CLOUD_AT=$now; DEFER=0
    R=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&b=1" 2>/dev/null)
    if ! [[ "$R" =~ ^[0-9]+\ [a-z]+\ [01]$ ]]; then   # HTTPS blocked or old server file: the beat file itself over SSH
      R=$($SG 'cat ~/www/traverseplatforms.com/jarvis-cloud/beat.txt 2>/dev/null' < /dev/null 2>/dev/null | head -1)
      [[ "$R" =~ ^([0-9]{10})\ ([a-z]+)\ ([01])$ ]] && R="$(( now - BASH_REMATCH[1] )) ${BASH_REMATCH[2]} ${BASH_REMATCH[3]}" || R=""
    fi
    [[ "$R" =~ ^([0-9]+)\ live\ 1$ ]] && [ "${BASH_REMATCH[1]}" -lt 240 ] && [ ! -f "$ST/no-defer" ] && DEFER=1
    if [ "$DEFER" != "$old" ]; then
      if [ "$DEFER" = 1 ]; then log "the cloud J.A.R.V.I.S. is live and well: this laptop stands back (it still runs jobs the cloud queues for it)"
      else log "taking tickets here again (the cloud's beat: ${R:-none})"; fi
    fi
  fi
  if [ $(( now - SYNC_AT )) -ge 120 ] && [ -f "$CSYNC" ] && [ ! -f "$PBD/cloud-sync/off" ]; then SYNC_AT=$now
    ( nice -n 19 bash "$CSYNC" cycle > /dev/null 2>&1 & ) < /dev/null
  fi
}
# 20 Nov (P-12, J.A.R.V.I.S. "record this meeting"): once a minute, from the heartbeat loop below (so a long session never holds it up) and
# whether or not the cloud is live, the meeting transcriber (assistant/jarvis/tools/meeting-worker.sh: its own lock, log in
# ProjectBackup/meetings/) looks for a recording to turn into text. ProjectBackup/meetings/off stops it.
MEET_AT=0
meet_tick() {
  local now; now=$(date +%s)
  [ $(( now - MEET_AT )) -ge 60 ] || return 0; MEET_AT=$now
  [ -f "$REPO/assistant/jarvis/tools/meeting-worker.sh" ] && [ ! -f "$PBD/meetings/off" ] && ( nice -n 10 bash "$REPO/assistant/jarvis/tools/meeting-worker.sh" > /dev/null 2>&1 & ) < /dev/null
  return 0
}
one_job() {   # the oldest job the cloud queued for this laptop: a full session on it, then marked done (once, even if it fails)
  local F K AT; F=$(ls -tr "$ST"/cloud-jobs/h*.json 2>/dev/null | head -1); [ -n "$F" ] || return 1
  K=$(node -e "try{const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log((j.kind==='jarvis'?'jarvis':'staff')+' '+(j.at|0))}catch(e){console.log('bad 0')}" "$F")
  AT="${K#* }"; K="${K%% *}"
  if [ "$K" = bad ]; then log "cloud job $(basename "$F"): unreadable, set aside"; mv "$F" "$F.bad"; return 0; fi
  log "cloud job $(basename "$F" .json): queued by the cloud, running here"
  if [ "$K" = jarvis ]; then one_ticket jarvis "$F"; else one_ticket "" "$F"; fi
  bash "$CSYNC" done "$(basename "$F" .json)" "$AT" >> "$LOG" 2>&1 || log "cloud job: could not mark done on the cloud"
  rm -f "$F"; return 0
}
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
        if [ "$PX" = --jarvis ]; then printf '%s' "$TXT" | $SG "php $JD_TOOL transcript $ID $N" >> "$LOG" 2>&1   # his J.A.R.V.I.S. desk (19 Nov)
        else printf '%s' "$TXT" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-transcript.php $ID $N $PX" >> "$LOG" 2>&1; fi
        log "$ID: voice note $N transcribed in $(( $(date +%s) - T0 )) s"
      else
        if [ "$PX" = --jarvis ]; then $SG "php $JD_TOOL transcript $ID $N --failed" < /dev/null >> "$LOG" 2>&1
        else $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-transcript.php $ID $N --failed $PX" < /dev/null >> "$LOG" 2>&1; fi
        log "$ID: voice note $N could not be transcribed"
      fi
    fi
    if [ -n "$TXT" ]; then echo "- Voice note from $WHO (message $I, $((SECS / 60)):$(printf '%02d' $((SECS % 60)))), transcribed: $TXT"
    else echo "- Voice note from $WHO (message $I): voice note could not be transcribed. If you need what it said, ask them to type it."; fi
  done
}

# true when a final reply (status answered or matthew) to ticket $1 was written at or after unix time $2 (a few seconds' slack for clocks)
final_since() {
  [ "${3:-}" = jarvis ] && { $SG "php $JD_TOOL final-since $1 $2" < /dev/null > /dev/null 2>&1; return $?; }   # his J.A.R.V.I.S. desk (19 Nov)
  local R; R=$($SG "grep '\"id\":\"$1\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log | grep '\"t\":\"reply\"'" < /dev/null 2>/dev/null) || return 1
  printf '%s\n' "$R" | SINCE="$2" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=+process.env.SINCE;const ok=s.split('\n').some(l=>{try{const r=JSON.parse(l);return (r.status==='answered'||r.status==='matthew')&&+r.at>=t-5}catch(e){return false}});process.exit(ok?0:1)})"
}

# one_ticket [jarvis]: the next Sixfold/Field app ticket, or (jarvis) the next thread in Matthew's own J.A.R.V.I.S. desk (19 Nov). The two
# differ only in where the thread comes from, how the answer goes back (help-reply.sh / jarvis-reply.sh) and the prompt's first line.
one_ticket() {
  local T ID PROMPT RC LAST CLAUDE PICS AUD DK="${1:-}" RPL="$REPO/traverse/ops/help-reply.sh" AX="" JOBF="${2:-}" JOBNOTE=""
  local -x HELP_REPLY_SIXFOLD=1; [ "$DK" = jarvis ] && HELP_REPLY_SIXFOLD=0   # help-reply.sh: a Sixfold-app message is answered in the Sixfold app
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  if [ -n "$JOBF" ]; then   # a job the cloud J.A.R.V.I.S. queued for this laptop (19 Nov): the thread as it was then, and its note
    [ "$DK" = jarvis ] && { RPL="$REPO/assistant/jarvis/tools/jarvis-reply.sh"; AX="--jarvis"; }
    T=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(j.thread,null,2))" "$JOBF" 2>>"$LOG") || { log "cloud job: unreadable"; return 1; }
    JOBNOTE=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('queued '+new Date((j.at|0)*1000).toLocaleString('en-US',{timeZone:'America/Denver'})+' MT: '+String(j.note||'').slice(0,3000))" "$JOBF" 2>/dev/null)
  elif [ "$DK" = jarvis ]; then
    RPL="$REPO/assistant/jarvis/tools/jarvis-reply.sh"; AX="--jarvis"
    T=$($SG "php $JD_TOOL next" < /dev/null 2>>"$LOG") || { log "jarvis desk: server not reachable"; return 0; }
  else
    T=$($SG 'php $HOME/www/traverseplatforms.com/sixfold-tools/help-next.php' < /dev/null 2>>"$LOG") || { log "server not reachable"; return 0; }
  fi
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "could not read the ticket"; return 1; }
  BY=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).by||'')}catch(e){}})")
  # Matthew mode (his prompt, Opus, the quick pass) only when EVERY person-written message in the conversation is his (overnight review
  # 11 Nov: any admin login can add to any conversation, and the ticket's `by` alone let another admin speak with his powers)
  local ONLYM MM=0; ONLYM=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const c=JSON.parse(s).conversation||[];const p=c.filter(m=>!/^(claude|j\.?a\.?r\.?v\.?i\.?s\.?)$/i.test(String(m.from||'').trim()));console.log(p.length&&p.every(m=>m.from==='Matthew Sharpe')?1:0)}catch(e){console.log(0)}})")
  [ "$BY" = "Matthew Sharpe" ] && [ "$ONLYM" = 1 ] && MM=1
  local M="$MODEL"; [ "$MM" = 1 ] && M="${HELP_MODEL_MATTHEW:-opus}"   # Matthew's own messages: app work, the heavier model (2 Nov)
  touch "$LOCK"; log "$ID: session started ($M, from $BY${DK:+, J.A.R.V.I.S. desk})"
  PICS=$(get_photos "$T" "$ID")
  AUD=$(get_audio "$T" "$ID" $AX)
  if [ "$DK" = jarvis ]; then
    PROMPT="A new message in Matthew's J.A.R.V.I.S. desk: his own standalone J.A.R.V.I.S. app, NOT the Sixfold app (since 19 Nov his desk chats live there). Handle it now under the rules in traverse/ops/help-desk-prompt.md and traverse/ops/jarvis-matthew-prompt.md (both appended to your instructions), and reply with assistant/jarvis/tools/jarvis-reply.sh (same options as help-reply.sh: answered|working|matthew, refresh, --pdf). Never help-reply.sh for this thread.

Thread (JSON from the server):
$T"
  else
  PROMPT="A new message in the Sixfold app's J.A.R.V.I.S. chat. Handle it now under the rules in traverse/ops/help-desk-prompt.md (also appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
  fi
  [ -n "$PICS" ] && PROMPT="$PROMPT

Photos sent in this conversation, copied to this laptop. Look at each one with the Read tool before you answer:
$PICS"
  [ -n "$JOBNOTE" ] && PROMPT="$PROMPT

(The cloud J.A.R.V.I.S. queued this job for the laptop, $JOBNOTE
The person has been told it is queued for the laptop. The thread above is as it was then; newer messages may have come since (they reach
the cloud, not this session). Do the job here, then reply in the same chat as usual, with the final status.)"
  [ -n "$AUD" ] && PROMPT="$PROMPT

Voice notes sent in this conversation, turned into text on this laptop (whisper.cpp; a word here and there may be off). Treat each as if they had typed it:
$AUD"
  # 11 Nov (Matthew): his tickets add jarvis-matthew-prompt.md (his personal assistant across Surge, Sixfold, Traverse, Peak, Donny,
  # personal); every ticket adds jarvis-learned.md (what past tickets taught; the session adds to it)
  local SYS; SYS="$(cat "$REPO/traverse/ops/help-desk-prompt.md")"
  [ "$MM" = 1 ] && [ -f "$REPO/traverse/ops/jarvis-matthew-prompt.md" ] && SYS="$SYS

$(cat "$REPO/traverse/ops/jarvis-matthew-prompt.md")"
  [ "$BY" = "Matthew Sharpe" ] && [ "$MM" = 0 ] && PROMPT="$PROMPT

(Watcher note: someone other than Matthew has written in this conversation, so it gets the office limits, not his.)"
  # learned notes: Matthew's (hold his private work) only for his tickets; office tickets read and write jarvis-learned-office.md (review 11 Nov)
  local LF="$REPO/traverse/ops/jarvis-learned-office.md"; [ "$MM" = 1 ] && LF="$REPO/traverse/ops/jarvis-learned.md"
  [ -f "$LF" ] && SYS="$SYS

$(tail -n 150 "$LF")"
  # 11 Nov (Matthew: "respond fast ... answer questions based on data"): a quick first pass for his messages, read-only (memory, TASKS,
  # jarvis-learned, the repo), no photos. ANSWER = it replies in seconds and the full session never starts; HANDOFF = an instant
  # "on it" note, then the full session as before. Any failure of the quick pass just falls through to the full session.
  if [ "$MM" = 1 ] && [ -z "$PICS" ] && [ -z "$JOBF" ] && [ -f "$REPO/traverse/ops/jarvis-quick-prompt.md" ] && [ "${JARVIS_QUICK:-1}" = 1 ]; then
    local Q QH QT QS; QS=$(date +%s)
    Q=$(cd "$REPO" && printf '%s' "$PROMPT" | timeout 90 "$CLAUDE" -p --model "${HELP_MODEL_QUICK:-sonnet}" --tools "Read,Grep,Glob" --permission-mode auto \
        --add-dir "/c/Users/Matthew sharpe/.claude/projects/c--Users-Matthew-sharpe-Desktop-claude-test-2/memory" \
        --append-system-prompt-file "$REPO/traverse/ops/jarvis-quick-prompt.md" --output-format text 2>>"$ST/$ID.quick.err")
    printf '%s\n' "$Q" > "$ST/$ID.quick"
    QH=$(printf '%s\n' "$Q" | sed -n '1{s/[^A-Z]//g;p}'); QT=$(printf '%s\n' "$Q" | sed '1d')
    if [ "$QH" = ANSWER ] && [ -n "$(printf '%s' "$QT" | tr -d '[:space:]')" ]; then
      printf '%s' "$QT" | bash "$RPL" "$ID" answered >> "$LOG" 2>&1
      if final_since "$ID" "$QS" "$DK"; then log "$ID: quick pass answered in $(( $(date +%s) - QS )) s"; rm -f "$LOCK"; return 0; fi
      log "$ID: quick answer did not reach the chat: full session"   # review 11 Nov: a dropped SSH left the ticket 'working' for 90 min
    elif [ "$QH" = HANDOFF ] && [ -n "$(printf '%s' "$QT" | tr -d '[:space:]')" ]; then
      printf '%s' "$QT" | bash "$RPL" "$ID" working >> "$LOG" 2>&1
      log "$ID: quick pass handed off in $(( $(date +%s) - QS )) s"
      PROMPT="$PROMPT

(A quick 'on it' note has already been sent to him. Don't send another progress note unless this will take more than a few minutes.)"
    else log "$ID: quick pass gave no usable answer ($(( $(date +%s) - QS )) s): full session"; fi
  fi
  # 18 Nov: the prompt goes in on stdin and the instructions from a file. On the command line they hit Windows' 32 KB limit once Jen's
  # conversation (one thread since 5 Nov) grew long: "Argument list too long", exit 126, and every message bounced to Matthew in 4 s.
  local SS; SS=$(date +%s); printf '%s' "$SYS" > "$ST/$ID.sys.md"
  (cd "$REPO" && printf '%s' "$PROMPT" | "$CLAUDE" -p --model "$M" --permission-mode auto --append-system-prompt-file "$ST/$ID.sys.md" --output-format text > "$ST/$ID.out" 2>&1); RC=$?
  # a final reply (answered or matthew) written since the session started; the last log line alone misread a follow-up that arrived after
  # the answer as "no reply" (review 11 Nov). The follow-up itself makes the conversation new again and is picked up next round.
  if ! final_since "$ID" "$SS" "$DK"; then
    if [ "$DK" = jarvis ]; then printf "I couldn't finish this one, sir: the session on your laptop ended without a final answer (exit %s). Its notes are on the laptop in ProjectBackup/help/%s.out. Send it again, or look when you're at the computer." "$RC" "$ID" | bash "$RPL" "$ID" matthew >> "$LOG" 2>&1
    else printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you." | bash "$RPL" "$ID" matthew >> "$LOG" 2>&1; fi
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
  OUT=$(cd "$PCWD" && printf 'The chat so far (answer the last message):\n\n%s' "$CONV" | "$CLAUDE" -p --tools "" --strict-mcp-config --setting-sources project --model sonnet --system-prompt-file "$REPO/traverse/ops/help-practice-prompt.md" --output-format text 2>>"$ST/p-$ID.out")
  [ -n "$OUT" ] || OUT="My apologies, I seem to have lost my train of thought. Could you send that again?"
  printf '%s' "$OUT" > "$ST/p-$ID.reply"
  printf '%s' "$OUT" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID answered --practice" >> "$LOG" 2>&1
  log "practice $ID: done"
}

# A client install's own J.A.R.V.I.S. (2026-11-18, the Houston test install; Matthew: "Lets add jarvis"). Its chats are its own help.log
# (sixfold-tools/help-*.php --install=c-<slug>, help-pending.php?i=c-<slug>), never Sixfold's. The session knows nothing of Sixfold or anyone
# else: --restricted with only the Read tool, no MCP servers, no settings, the install's own prompt in place of Claude Code's, run from a
# folder that holds only this ticket's photos (the only files it can open). It cannot change anything; its text is posted as the reply, its
# first line saying answered or matthew. A cap per install per day (JARVIS_INSTALL_DAY_CAP, default 40) keeps it light on Matthew's plan.
jv_prompt() { case "$1" in c-houston-lawn-test) echo "$REPO/traverse/ops/jarvis-houston-prompt.md";; *) echo "";; esac; }
one_install() {
  local HI="$1" T ID CLAUDE AUD PF W N CF OUT STL BODY CONV PR STS PICS=""
  [[ "$HI" =~ ^c-[a-z0-9-]{1,40}$ ]] || return 1
  PF=$(jv_prompt "$HI"); [ -n "$PF" ] && [ -f "$PF" ] || { log "$HI: no prompt file"; return 1; }
  CLAUDE=$(claude_bin); [ -n "$CLAUDE" ] && [ -f "$CLAUDE" ] || { log "no claude.exe found"; return 1; }
  T=$($SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-next.php --install=$HI" < /dev/null 2>>"$LOG") || { log "$HI: server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){}})")
  [[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { log "$HI: could not read the ticket"; return 1; }
  CF="$ST/$HI-sessions-$(date +%F).count"; N=$(cat "$CF" 2>/dev/null || echo 0); [[ "$N" =~ ^[0-9]+$ ]] || N=0
  if [ "$N" -ge "${JARVIS_INSTALL_DAY_CAP:-40}" ]; then
    printf "I've answered a great many messages today, so this one goes to Matthew at Traverse. He'll get back to you here." | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID matthew --install=$HI" >> "$LOG" 2>&1
    log "$HI $ID: day cap ($N) reached: passed to Matthew"; return 0
  fi
  echo $(( N + 1 )) > "$CF"
  touch "$LOCK"; log "$HI $ID: session started"
  W="$ST/inst/$HI/$ID"; rm -rf "$W"; mkdir -p "$W"
  get_photos "$T" "$ID" > /dev/null
  for p in "$ST/photos/$ID"/*; do [ -f "$p" ] && cp "$p" "$W/" && PICS="$PICS
- $(basename "$p")"; done
  AUD=$(get_audio "$T" "$ID" "--install=$HI")
  CONV=$(printf '%s' "$T" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);console.log(t.conversation.map(m=>m.from+' ('+m.when+'): '+(m.text||'')+((m.photos||[]).length?' [sent '+m.photos.length+' photo(s): '+m.photos.join(', ')+']':'')+((m.audio||[]).length?' [voice note]':'')).join('\n\n'))}catch(e){}})")
  PR="The chat so far (answer the last message):

$CONV"
  [ -n "$PICS" ] && PR="$PR

Photos in this conversation, in your working folder (open each with Read):$PICS"
  [ -n "$AUD" ] && PR="$PR

Voice notes, turned into text:
$AUD"
  OUT=$(cd "$W" && printf '%s' "$PR" | timeout 600 "$CLAUDE" -p --restricted --tools "Read" --strict-mcp-config --setting-sources project --permission-mode dontAsk \
        --model "${HELP_MODEL_INSTALL:-sonnet}" --system-prompt-file "$PF" --output-format text 2>>"$ST/$HI-$ID.err")
  printf '%s' "$OUT" > "$ST/$HI-$ID.out"
  STL=$(printf '%s\n' "$OUT" | sed -n '1p' | tr -d '\r'); BODY=$(printf '%s\n' "$OUT" | sed '1d' | sed -e '/./,$!d')
  STS=answered; case "$STL" in *STATUS:*matthew*|*STATUS:*MATTHEW*) STS=matthew;; *STATUS:*) ;; *) BODY="$OUT";; esac
  if [ -z "$(printf '%s' "$BODY" | tr -d '[:space:]')" ]; then STS=matthew; BODY="I couldn't finish looking into this one, so I've passed it to Matthew at Traverse. He'll get back to you here."; fi
  printf '%s' "$BODY" | $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID $STS --install=$HI" >> "$LOG" 2>&1
  log "$HI $ID: done ($STS)"
  rm -f "$LOCK"
}

# a test of the transcription alone (11 Nov): prints the text of one audio file
if [ "${1:-}" = "--transcribe" ]; then transcribe "${2:?file}" && echo; exit $?; fi
if [ -f "$LOCK" ]; then
  [ $(( $(date +%s) - $(stat -c %Y "$LOCK") )) -lt 6000 ] && exit 0   # a session is running (another copy): leave it
  log "stale lock removed"; rm -f "$LOCK"
fi
if [ "${1:-}" = "--once" ]; then [ -f "$ST/pause" ] || one_ticket; exit 0; fi
if [ "${1:-}" = "--install" ]; then [ -f "$ST/pause" ] || one_install "${2:?install id, c-<slug>}"; exit 0; fi   # one look at a client install's chat (18 Nov)
# When the quick HTTPS check stops answering a number (9 Nov 2026: SiteGround's bot captcha answered this laptop's address with a 202 HTML
# page for hours, so the loop saw nothing and no ticket was picked up), the count is read over SSH instead (sixfold-tools/help-next.php
# --peek, which only looks), every 30 seconds, until HTTPS answers a number again. Logged once each way so it is seen.
BAD=0; VIA=https; JBAD=0
# 11 Nov (Matthew, the "free fix"): while HTTPS is captcha'd, ONE long SSH connection stays open and the server prints the two counts
# every 5 s ("L|P"), instead of a fresh SSH login every 30 s. If the stream dies it is reopened; after 3 failures in a row it falls back
# to the old fresh look every 30 s until HTTPS answers again. bash sets STREAM_PID and STREAM[0] for the coproc.
SFAIL=0
stream_open() {
  coproc STREAM { $SG 'cd $HOME/www/traverseplatforms.com/sixfold-tools && for i in $(seq 1 720); do L=$(php help-next.php --peek | grep -c "\"waiting\""); P=$(php help-next.php --peek --practice | grep -c "\"waiting\""); H=0; for x in '"$JV_INSTALLS"'; do H=$((H + $(php help-next.php --peek --install=$x | grep -c "\"waiting\""))); done; J=$(php '"$JD_TOOL"' count 2>/dev/null || echo 0); echo "$L|$P|$H|$J"; sleep 5; done' < /dev/null 2>>"$LOG"; }   # + |H: the client installs (18 Nov); + |J: his J.A.R.V.I.S. desk (19 Nov)
}
stream_close() { [ -n "${STREAM_PID:-}" ] && kill "$STREAM_PID" 2>/dev/null; wait "${STREAM_PID:-}" 2>/dev/null; unset STREAM_PID; }
stream_read() {   # the newest "L|P" line; fails if the stream is gone or silent for 20 s
  local line="" x fd="${STREAM[0]:-}"
  [ -n "$fd" ] || return 1
  read -r -t 20 -u "$fd" line || return 1
  while read -r -t 0.2 -u "$fd" x; do line="$x"; done   # skip lines that piled up during a session
  printf '%s' "$line"
}
peek_ssh() { $SG 'cd $HOME/www/traverseplatforms.com/sixfold-tools && { php help-next.php --peek | grep -c "\"waiting\""; echo "|"; php help-next.php --peek --practice | grep -c "\"waiting\""; echo "|"; H=0; for x in '"$JV_INSTALLS"'; do H=$((H + $(php help-next.php --peek --install=$x | grep -c "\"waiting\""))); done; echo $H; echo "|"; php '"$JD_TOOL"' count 2>/dev/null || echo 0; }' < /dev/null 2>>"$LOG" | tr -d '\n'; }
END=$(( $(date +%s) + 3480 ))
# 19 Nov (J.A.R.V.I.S. P-8, "Laptop asleep warning"): a heartbeat to the Assistant's server every 5 minutes while this copy runs and the
# watcher is not paused, so his J.A.R.V.I.S. page can say "Laptop asleep since 6:32 pm: desk requests will run when it wakes". Its own
# background loop, so a long session never stops it; it ends with this copy (a sleeping laptop sends nothing, which is the point).
( while kill -0 $$ 2>/dev/null; do
    [ -f "$ST/pause" ] || bash "$REPO/assistant/jarvis/tools/jarvis-status.sh" beat > /dev/null 2>&1
    printf '%s %s\n' "$(date +%s)" "$(git -C "$REPO" rev-parse HEAD 2>/dev/null)" | $SG 'mkdir -p ~/www/traverseplatforms.com/jarvis-cloud && chmod 700 ~/www/traverseplatforms.com/jarvis-cloud && cat > ~/www/traverseplatforms.com/jarvis-cloud/laptop.txt' > /dev/null 2>&1   # the cloud's write turn (19 Nov)
    for _b in $(seq 60); do kill -0 $$ 2>/dev/null || exit 0; [ -f "$ST/pause" ] || meet_tick; sleep 5; done   # gone within 5 s of this copy, so the next one starts on time
  done ) < /dev/null > /dev/null 2>&1 &
while [ "$(date +%s)" -lt "$END" ]; do
  if [ ! -f "$ST/pause" ]; then
    cloud_tick
    one_job && continue                                    # a job the cloud queued for the laptop (19 Nov)
    if [ "$DEFER" = 1 ]; then sleep 5; continue; fi        # the cloud is live and well: stand back
    N=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK" 2>/dev/null)
    if [[ "$N" =~ ^[0-9]+$ ]]; then
      BAD=0; [ "$VIA" = ssh ] && { log "https check answers again: back to the 5 s poll"; VIA=https; stream_close; SFAIL=0; }
      if [ "$N" -gt 0 ]; then one_ticket; continue; fi
      # his J.A.R.V.I.S. desk (19 Nov): its own 5 s look with the laptop key; if that does not answer a number, a fresh SSH count every 30 s
      J=""; [ -n "$JD_HDR" ] && J=$(curl -s -m 8 -A "jarvis-watch/1.0" -H @"$JD_HDRW" "$JD_URL" 2>/dev/null)
      if [[ "$J" =~ ^[0-9]+$ ]]; then [ "$JBAD" -gt 0 ] && log "jarvis desk: the https look answers again"; JBAD=0
      else JBAD=$(( JBAD + 1 )); [ "$JBAD" = 1 ] && log "jarvis desk: the https look did not answer a number$([ -z "$JD_HDR" ] && echo ' (no key file)'): an SSH count every 30 s"
        J=0; [ $(( JBAD % 6 )) = 1 ] && { J=$($SG "php $JD_TOOL count" < /dev/null 2>/dev/null | tr -d '\r\n'); [[ "$J" =~ ^[0-9]+$ ]] || J=0; }; fi
      if [ "$J" -gt 0 ]; then one_ticket jarvis; continue; fi
      P=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&p=1" 2>/dev/null)
      if [[ "$P" =~ ^[0-9]+$ ]] && [ "$P" -gt 0 ]; then one_practice; continue; fi
      HIT=""; for HI in $JV_INSTALLS; do H=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&i=$HI" 2>/dev/null); if [[ "$H" =~ ^[0-9]+$ ]] && [ "$H" -gt 0 ]; then one_install "$HI"; HIT=1; break; fi; done   # client installs (18 Nov)
      [ -n "$HIT" ] && continue
    else
      BAD=$(( BAD + 1 ))
      if [ "$BAD" -ge 3 ]; then
        [ "$VIA" = https ] && { log "https check is not answering a number (got: $(printf '%s' "$N" | tr -d '\r\n' | cut -c1-60)): reading over one open SSH connection every 5 s"; VIA=ssh; }
        R=""
        if [ "$SFAIL" -lt 3 ]; then
          { [ -n "${STREAM_PID:-}" ] && kill -0 "$STREAM_PID" 2>/dev/null; } || { stream_close; [ "$SFAIL" -gt 0 ] && sleep 10; stream_open; }   # a pause before reopening after a drop (review 11 Nov)
          R=$(stream_read) || R=""
          if [[ "$R" =~ ^[0-9]+\|[0-9]+(\|[0-9]+){0,2}$ ]]; then SFAIL=0
          else SFAIL=$(( SFAIL + 1 )); R=""; stream_close; [ "$SFAIL" -ge 3 ] && log "the open SSH connection keeps dropping: back to a fresh SSH look every 30 s"; fi
        fi
        if [ -z "$R" ]; then R=$(peek_ssh); if [ "$SFAIL" -ge 3 ]; then sleep 25; else sleep 5; fi; fi   # never straight round again (cloud review 11 Nov)
        L="${R%%|*}"; PR=$(printf '%s' "$R" | cut -d'|' -f2); HR=$(printf '%s' "$R" | cut -s -d'|' -f3); JR=$(printf '%s' "$R" | cut -s -d'|' -f4)
        if [[ "$L" =~ ^[0-9]+$ ]] && [ "$L" -gt 0 ]; then one_ticket; continue; fi
        if [[ "$JR" =~ ^[0-9]+$ ]] && [ "$JR" -gt 0 ]; then one_ticket jarvis; continue; fi   # his J.A.R.V.I.S. desk (19 Nov)
        if [[ "$PR" =~ ^[0-9]+$ ]] && [ "$PR" -gt 0 ]; then one_practice; continue; fi
        if [[ "$HR" =~ ^[0-9]+$ ]] && [ "$HR" -gt 0 ]; then for HI in $JV_INSTALLS; do one_install "$HI"; done; continue; fi   # client installs (18 Nov)
        continue
      fi
    fi
  fi
  sleep 5
done

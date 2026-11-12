#!/bin/bash
# J.A.R.V.I.S. on the Azure cloud machine: TRIAL, PRACTICE COPY ONLY (11 Nov 2026, Matthew: "run 1"; TASKS X-15; see JARVIS-CLOUD.md).
# The Linux twin of help-watch.sh's practice path (one_practice). It runs on the VM (yard@20.91.198.101) as the systemd user service
# jarvis-cloud.service, from ~/jarvis/ops/. The laptop watcher (help-watch.sh) is unchanged and still owns every LIVE ticket.
#
# ⚑ THE GUARD (in code, not config): every command this script sends to the server goes through srv(), and srv() runs only the handful of
# practice-copy commands in allowed() below (help-next.php --practice, help-reply.php ... --practice, help-transcript.php ... --practice,
# reading a voice note under sixfold-practice-data/). Anything else is refused and logged. A ticket whose files folder is not under
# sixfold-practice-data/ is dropped untouched. The HTTPS check only ever asks for the practice count (&p=1). There is no live path here
# at all: taking live tickets is a separate, later change (the switch-over in JARVIS-CLOUD.md), not a setting.
#
# It never takes a ticket unless Claude Code is signed in to Matthew's plan (no API key: those variables are cleared below), so before
# the sign-in it only watches and logs "waiting for sign-in". If it takes a practice ticket and the session gives nothing, the practice
# chat gets the same "lost my train of thought" line the laptop sends.
#
#   bash help-watch-cloud.sh                    the service: loop forever (one copy: flock on ~/jarvis/state/watch.lock)
#   bash help-watch-cloud.sh --check            readiness: poll key, HTTPS count, SSH to the server, Claude sign-in, ffmpeg + whisper, guard
#   bash help-watch-cloud.sh --guard-test       the guard against a list of live and practice commands (must print all PASS)
#   bash help-watch-cloud.sh --peek             look at the next practice ticket (TEST=1: reads only, marks nothing, posts nothing) and show what would run
#   bash help-watch-cloud.sh --test-ticket <file.json> [--run]
#                                               a dry run from a ticket JSON on disk (TEST=2): no server at all; voice notes are read from
#                                               ~/jarvis/state/audio/<ticket>/; --run also runs the Claude session and prints its reply
#   bash help-watch-cloud.sh --transcribe <file>   whisper.cpp on one audio file; prints the text
# Pause: touch ~/jarvis/state/pause. Log: ~/jarvis/state/help-watch.log.
set -u
J="$HOME/jarvis"; OPS="$J/ops"; ST="$J/state"; SEC="$J/secrets"; mkdir -p "$ST"
LOG="$ST/help-watch.log"; PCWD="$J/practice-cwd"
CLAUDE="$HOME/.local/bin/claude"
WHISPER_DIR="$J/tools/whisper.cpp"; WC="$WHISPER_DIR/build/bin/whisper-cli"
# small.en (q5_1) by default: same text as large-v3-turbo on the 12 Nov test note in 7-8 s instead of 37-38 s on this VM (turbo needs
# ~5x the CPU; on a 2-core B2s it would hold a reply up by a minute). WHISPER_MODEL=large-v3-turbo-q5_0 for the bigger one.
WM="$WHISPER_DIR/models/ggml-${WHISPER_MODEL:-small.en-q5_1}.bin"
KEY=$(cat "$SEC/help-poll-key.txt" 2>/dev/null); CHECK="https://traverseplatforms.com/api/help-pending.php?k=$KEY&p=1"   # practice count ONLY
SGKEY="$SEC/traverse_sg_cloud"; SGDEST="u3233-r4fz9nguryw0@giowm1063.siteground.biz"
TOOLS='php $HOME/www/traverseplatforms.com/sixfold-tools/'
# Matthew's plan only: never an API key, gateway or other provider, even if one turns up in the environment
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL ANTHROPIC_MODEL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_OAUTH_TOKEN
TEST=0
log() { echo "$(date '+%F %T') $*" >> "$LOG"; [ "$TEST" != 0 ] && echo "  log: $*" >&2; return 0; }

# ---- the guard -------------------------------------------------------------------------------------------------------------------------
TID='h[0-9]{14}[0-9a-f]{4}'; AUD='a[0-9]{10}[0-9a-f]{6}\.(webm|ogg|m4a|mp3|aac)'
allowed() {   # 0 = a practice-copy command this trial may run; anything else = 1
  local c="$1"
  case "$c" in *$'\n'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*|*'..'*) return 1;; esac   # one plain command, nothing chained
  [[ "$c" =~ ^"$TOOLS"help-next\.php(\ --peek)?\ --practice$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-reply\.php\ $TID\ answered\ --practice$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-transcript\.php\ $TID\ $AUD(\ --failed)?\ --practice$ ]] && return 0
  [[ "$c" =~ ^cat\ \'/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID/$AUD\'$ ]] && return 0
  return 1
}
srv() {   # srv '<command>' [< stdin]: run one allowed command on the Traverse server with the VM's own key
  if ! allowed "$1"; then log "GUARD: refused a server command that is not practice-only: $(printf '%s' "$1" | tr '\n' ' ' | cut -c1-140)"; return 97; fi
  # dry runs: TEST=1 (--peek) still reads (a peek, a voice note) but only shows what it would write; TEST=2 (--test-ticket) runs nothing
  if [ "$TEST" = 2 ] || { [ "$TEST" = 1 ] && [[ ! "$1" =~ ^cat\ |help-next\.php\ --peek\ --practice$ ]]; }; then log "test: would run on the server: $1"; cat > /dev/null; return 96; fi
  ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -o StrictHostKeyChecking=yes \
    -o "UserKnownHostsFile=$SEC/known_hosts" -o IdentitiesOnly=yes -i "$SGKEY" -p 18765 "$SGDEST" "$1"
}
is_practice_ticket() {   # the ticket's own files folder must be the practice copy's
  local D; D=$(printf '%s' "$1" | jq -r '(.photoDir // "") + "|" + (.audioDir // "")' 2>/dev/null) || return 1
  [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID\|/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID$ ]] && [[ "$D" != *..* ]]
}

# ---- readiness --------------------------------------------------------------------------------------------------------------------------
# review 12 Nov: the sign-in must be the Claude plan itself. A Console sign-in (claude auth login --console) is billed per use, so it counts as not signed in.
signed_in() { [ -x "$CLAUDE" ] && "$CLAUDE" auth status 2>/dev/null | jq -e '.loggedIn == true and .authMethod == "claude.ai"' > /dev/null 2>&1; }
# review 12 Nov: every 10 minutes, keep the log and the session error file from growing without end, and drop voice notes and reply copies after 14 days
tidy() {
  local f; for f in "$LOG" "$ST/p-session.err"; do
    [ -f "$f" ] && [ "$(stat -c %s "$f" 2>/dev/null || echo 0)" -gt 5000000 ] && { tail -n 2000 "$f" > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"; }
  done
  find "$ST/audio" -mindepth 1 -mtime +14 -delete 2>/dev/null; find "$ST" -maxdepth 1 -name 'p-h*.reply' -mtime +14 -delete 2>/dev/null
  return 0
}
disk_ok() { local a; a=$(df -k --output=avail "$ST" 2>/dev/null | tail -1 | tr -d ' '); [[ "$a" =~ ^[0-9]+$ ]] && [ "$a" -gt 512000 ]; }   # 500 MB free
READY_AT=0; READY=1; LASTSTATE=""
ready() {   # cached 10 minutes; logs only when the state changes
  local now; now=$(date +%s)
  if [ $(( now - READY_AT )) -ge 600 ]; then
    READY_AT=$now; tidy
    if ! signed_in; then READY=1; elif ! disk_ok; then READY=2; else READY=0; fi
  fi
  local s; case "$READY" in
    0) s="ready";;
    2) s="disk nearly full on this machine (under 500 MB free): no practice ticket is taken until there is room (the laptop still answers)";;
    *) s="waiting for sign-in: Claude Code on this machine is not signed in to Matthew's plan, so no practice ticket is taken";;
  esac
  [ "$s" != "$LASTSTATE" ] && { log "$s"; LASTSTATE="$s"; }
  return "$READY"
}

# ---- voice notes ------------------------------------------------------------------------------------------------------------------------
transcribe() {   # transcribe <file>: ffmpeg 16 kHz mono WAV + whisper.cpp (English, 4 threads); prints the text or returns 1
  local IN="$1" B WAV TXT
  B="${IN%.*}"; WAV="$B.16k.wav"
  command -v ffmpeg > /dev/null && [ -x "$WC" ] && [ -f "$WM" ] || { log "transcribe: ffmpeg or whisper.cpp is missing"; return 1; }
  timeout 60 ffmpeg -nostdin -loglevel error -y -i "$IN" -ar 16000 -ac 1 -c:a pcm_s16le "$WAV" < /dev/null 2>>"$LOG" || { log "transcribe: ffmpeg could not read $(basename "$IN")"; rm -f "$WAV"; return 1; }
  rm -f "$B.txt"
  timeout 180 nice -n 5 "$WC" -m "$WM" -l en -t 4 -nt -np -otxt -of "$B" -f "$WAV" < /dev/null > /dev/null 2>&1 || { log "transcribe: whisper failed or ran over 3 minutes on $(basename "$IN")"; rm -f "$WAV"; return 1; }
  rm -f "$WAV"
  TXT=$(sed -e 's/\[BLANK_AUDIO\]//g' "$B.txt" 2>/dev/null | tr -s ' \r\n\t' ' ' | sed -E 's/^ +| +$//g'); rm -f "$B.txt"
  [ -n "$TXT" ] || return 1
  printf '%s' "$TXT"
}
get_audio() {   # get_audio <ticket JSON> <ticket id>: as help-watch.sh's, practice only; leaves <file>.txt beside each note
  local T="$1" ID="$2" DIR OUT="$ST/audio/$2" I N SECS HAS TXT T0
  DIR=$(printf '%s' "$T" | jq -r '.audioDir // .photoDir // ""')
  mkdir -p "$OUT"
  printf '%s' "$T" | jq -r '.conversation | to_entries[] | .key as $i | (.value.audio // [])[] | [($i + 1), .n, (.secs // 0), (if .text then "1" elif .failed then "f" else "0" end), (.text // "")] | @tsv' 2>/dev/null |
  while IFS=$'\t' read -r I N SECS HAS TXT; do
    [[ "$N" =~ ^$AUD$ ]] || continue
    if [ "$HAS" = 1 ]; then printf '%s' "$TXT" > "$OUT/$N.txt"; continue; fi
    [ "$HAS" = f ] && continue
    T0=$(date +%s); TXT=""
    if [ -s "$OUT/$N.txt" ]; then TXT=$(cat "$OUT/$N.txt")
    else
      [ -s "$OUT/$N" ] || srv "cat '$DIR/$N'" < /dev/null > "$OUT/$N" 2>>"$LOG"
      [ -s "$OUT/$N" ] || rm -f "$OUT/$N"
      [ -s "$OUT/$N" ] && TXT=$(transcribe "$OUT/$N")
    fi
    if [ -n "$TXT" ]; then
      printf '%s' "$TXT" > "$OUT/$N.txt"
      printf '%s' "$TXT" | srv "${TOOLS}help-transcript.php $ID $N --practice" >> "$LOG" 2>&1
      log "practice $ID: voice note $N transcribed in $(( $(date +%s) - T0 )) s"
    else
      srv "${TOOLS}help-transcript.php $ID $N --failed --practice" < /dev/null >> "$LOG" 2>&1
      log "practice $ID: voice note $N could not be transcribed"
    fi
  done
}
conversation() {   # conversation <ticket JSON> <ticket id>: the chat as text, the way help-watch.sh's one_practice writes it
  printf '%s' "$1" | AD="$ST/audio/$2" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);const fs=require('fs'),vt=a=>{try{return /^a[0-9]{10}[0-9a-f]{6}[.][a-z0-9]+$/.test(a.n||'')?fs.readFileSync(process.env.AD+'/'+a.n+'.txt','utf8').trim():''}catch(e){return ''}};console.log(t.conversation.map(m=>m.from+' ('+m.when+'): '+m.text+((m.photos||[]).length?' [sent '+m.photos.length+' photo'+(m.photos.length>1?'s':'')+']':'')+(m.audio||[]).map(a=>{const x=vt(a);return x?' [voice note: '+x+']':' [sent a voice note]'}).join('')).join('\n\n'))}catch(e){}})"
}
session() {   # session <conversation text>: Claude with NO tools, NO MCP, no user settings, only help-practice-prompt.md; prints the reply
  [ -s "$OPS/help-practice-prompt.md" ] || { log "practice: help-practice-prompt.md is missing: no session (run jarvis-cloud.sh deploy)"; return 1; }
  mkdir -p "$PCWD"
  (cd "$PCWD" && timeout 300 "$CLAUDE" -p "The chat so far (answer the last message):

$1" --tools "" --strict-mcp-config --setting-sources project --model "${HELP_MODEL:-sonnet}" --system-prompt "$(cat "$OPS/help-practice-prompt.md")" --output-format text 2>>"$ST/p-session.err")
}

# ---- one practice ticket ----------------------------------------------------------------------------------------------------------------
one_practice() {
  local T ID OUT CONV T0
  DID=0
  ready || return 0
  T=$(srv "${TOOLS}help-next.php --practice" < /dev/null 2>>"$LOG") || { log "practice: server not reachable (has Matthew added the VM's SSH key in SiteGround?)"; sleep 25; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""' 2>/dev/null)
  [[ "$ID" =~ ^$TID$ ]] || { log "practice: could not read the ticket"; return 1; }
  is_practice_ticket "$T" || { log "GUARD: ticket $ID is not from the practice copy: left untouched"; return 1; }
  T0=$(date +%s); log "practice $ID: session started (cloud)"
  get_audio "$T" "$ID"
  CONV=$(conversation "$T" "$ID")
  OUT=$(session "$CONV")
  [ -n "$OUT" ] || { OUT="My apologies, I seem to have lost my train of thought. Could you send that again?"; log "practice $ID: the session gave no reply"; }
  printf '%s' "$OUT" > "$ST/p-$ID.reply"
  printf '%s' "$OUT" | srv "${TOOLS}help-reply.php $ID answered --practice" >> "$LOG" 2>&1
  log "practice $ID: done in $(( $(date +%s) - T0 )) s"; DID=1
}
# review 12 Nov: a look that took nothing (the laptop got there first, the count and the server disagree, an unreadable ticket) used to go
# straight round again with no pause: a new SSH login every second or two for as long as it lasted. Now each empty look waits 5 s longer
# than the last, up to a minute, and a ticket that was answered resets it.
MISS=0; DID=0
take() { one_practice; if [ "$DID" = 1 ]; then MISS=0; else MISS=$(( MISS + 1 )); sleep $(( MISS > 12 ? 60 : MISS * 5 )); fi; }

# ---- test modes -------------------------------------------------------------------------------------------------------------------------
guard_test() {
  local ok=0 c
  local -a NO=("${TOOLS}help-next.php" "${TOOLS}help-next.php --peek" "${TOOLS}help-reply.php h20261111120000abcd answered"
    "${TOOLS}help-reply.php h20261111120000abcd matthew --practice" "${TOOLS}help-transcript.php h20261111120000abcd a1762900000abcdef.webm"
    "cat '/home/x/www/traverseplatforms.com/sixfold-data/rounds/help-files/h20261111120000abcd/a1762900000abcdef.webm'"
    "cat '/home/x/sixfold-practice-data/rounds/help-files/../../../sixfold-data/rounds/help-files/h20261111120000abcd/a1762900000abcdef.webm'"
    "${TOOLS}help-next.php --practice; ${TOOLS}help-next.php" "${TOOLS}help-next.php --practice && cat /etc/passwd"
    "${TOOLS}help-next.php --practice"$'\n'"${TOOLS}help-next.php" "${TOOLS}help-attach.php h20261111120000abcd 'x.pdf' --practice"
    "${TOOLS}help-next.php --practice --live" "rm -rf \$HOME"
    "${TOOLS}help-reply.php h20261111120000abcd working --practice" "${TOOLS}help-reply.php h20261111120000abcd answered refresh --practice"
    "${TOOLS}help-reply.php h20261111120000abcd answered file=x.pdf --practice" "${TOOLS}help-reply.php h20261111120000abcd answered --practice extra"
    " ${TOOLS}help-next.php --practice" "${TOOLS}help-next.php  --practice" "${TOOLS}../sixfold-tools/help-next.php --practice" "${TOOLS}help-next.php --practice #"
    "${TOOLS}help-transcript.php h20261111120000abcd a1762900000abcdef.exe --practice" "cat '/home/x/sixfold-practice-data/rounds/help.log'" "scp x y"
    "cat '/home/x/sixfold-practice-data/rounds/help-files/h20261111120000abcd/a1762900000abcdef.webm' '/home/x/sixfold-data/rounds/help.log'"
    "cat '/home/x/sixfold-practice-data/rounds/help-files/h20261111120000abcd/a1762900000abcdef.webm' --practice""php \$HOME/www/traverseplatforms.com/sixfold-tools/help-next.php --practice \$(id)")
  local -a YES=("${TOOLS}help-next.php --practice" "${TOOLS}help-next.php --peek --practice" "${TOOLS}help-reply.php h20261111120000abcd answered --practice"
    "${TOOLS}help-transcript.php h20261111120000abcd a1762900000abcdef.webm --practice" "${TOOLS}help-transcript.php h20261111120000abcd a1762900000abcdef.m4a --failed --practice"
    "cat '/home/x/www/traverseplatforms.com/sixfold-practice-data/rounds/help-files/h20261111120000abcd/a1762900000abcdef.webm'")
  for c in "${NO[@]}"; do if allowed "$c"; then echo "FAIL (let through): $c"; ok=1; else echo "PASS refused: $(printf '%s' "$c" | tr '\n' ' ')"; fi; done
  for c in "${YES[@]}"; do if allowed "$c"; then echo "PASS allowed: $c"; else echo "FAIL (refused a practice command): $c"; ok=1; fi; done
  local L='{"id":"h20261111120000abcd","photoDir":"/home/x/www/traverseplatforms.com/sixfold-data/rounds/help-files/h20261111120000abcd","audioDir":"/home/x/www/traverseplatforms.com/sixfold-data/rounds/help-files/h20261111120000abcd"}'
  local P='{"id":"h20261111120000abcd","photoDir":"/home/x/www/traverseplatforms.com/sixfold-practice-data/rounds/help-files/h20261111120000abcd","audioDir":"/home/x/www/traverseplatforms.com/sixfold-practice-data/rounds/help-files/h20261111120000abcd"}'
  is_practice_ticket "$L" && { echo "FAIL: a live ticket passed the practice check"; ok=1; } || echo "PASS live ticket rejected by the practice check"
  is_practice_ticket "$P" && echo "PASS practice ticket accepted" || { echo "FAIL: a practice ticket was rejected"; ok=1; }
  [ "$ok" = 0 ] && echo "guard: all PASS" || echo "guard: FAILURES above"
  return "$ok"
}
check() {
  echo "poll key: $([ -n "$KEY" ] && echo present || echo MISSING)"
  local N; N=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK" 2>/dev/null); echo "HTTPS practice count: ${N:0:40}"
  if srv "${TOOLS}help-next.php --peek --practice" < /dev/null > /dev/null 2>"$ST/check.err"; then echo "SSH to the server: OK"; else echo "SSH to the server: NOT YET ($(tr -d '\r\n' < "$ST/check.err" | cut -c1-100))"; fi
  signed_in && echo "Claude Code: signed in" || echo "Claude Code: NOT signed in ($("$CLAUDE" --version 2>/dev/null || echo missing))"
  command -v ffmpeg > /dev/null && echo "ffmpeg: $(ffmpeg -version | head -1 | cut -d' ' -f1-3)" || echo "ffmpeg: missing"
  [ -x "$WC" ] && [ -f "$WM" ] && echo "whisper.cpp: OK ($(basename "$WM"))" || echo "whisper.cpp: missing"
  guard_test > /dev/null && echo "guard: all PASS" || echo "guard: FAILED (run --guard-test)"
  [ -f "$ST/pause" ] && echo "PAUSED (rm ~/jarvis/state/pause)"
  systemctl --user is-active jarvis-cloud.service 2>/dev/null | sed 's/^/service: /'
}
show_run() {   # what the loop would do with this ticket, without doing it
  local T="$1" ID CONV
  ID=$(printf '%s' "$T" | jq -r '.id // ""'); echo "ticket: $ID (by $(printf '%s' "$T" | jq -r '.by // ""'))"
  is_practice_ticket "$T" && echo "practice check: PASS" || { echo "practice check: FAIL, the loop would leave it untouched"; return 1; }
  get_audio "$T" "$ID"
  CONV=$(conversation "$T" "$ID")
  echo "--- conversation the session would get ---"; printf '%s\n' "$CONV"
  echo "--- would run (in $PCWD) ---"
  echo "claude -p '<the conversation>' --tools \"\" --strict-mcp-config --setting-sources project --model ${HELP_MODEL:-sonnet} --system-prompt \"\$(cat $OPS/help-practice-prompt.md)\" --output-format text"
  echo "--- then: printf '<reply>' | ${TOOLS}help-reply.php $ID answered --practice"
  if [ "${RUN:-0}" = 1 ]; then
    signed_in || { echo "(--run skipped: Claude Code is not signed in yet)"; return 0; }
    local t0; t0=$(date +%s); echo "--- the session's reply (not posted) ---"; session "$CONV"; echo; echo "(session took $(( $(date +%s) - t0 )) s)"
  fi
}

case "${1:-}" in
  --transcribe) TEST=1; transcribe "${2:?file}" && echo; exit $?;;
  --guard-test) guard_test; exit $?;;
  --check) check; exit 0;;
  --peek) T=$(srv "${TOOLS}help-next.php --peek --practice" < /dev/null) || { echo "server not reachable"; exit 1; }
          [ -n "$T" ] || { echo "no practice ticket waiting"; exit 0; }; TEST=1; show_run "$T"; exit $?;;   # TEST=1: nothing is posted
  --test-ticket) TEST=2; [ "${3:-}" = --run ] && RUN=1; show_run "$(cat "${2:?ticket.json}")"; exit $?;;
  "") ;;
  *) echo "unknown option: $1"; exit 2;;
esac

# ---- the loop (the service) -------------------------------------------------------------------------------------------------------------
exec 9> "$ST/watch.lock"; flock -n 9 || { echo "another copy is running"; exit 0; }
log "cloud watcher started (TRIAL: practice copy only; live tickets stay with the laptop)"
ready || true   # logs "ready" or "waiting for sign-in" once at the start
BAD=0
while true; do
  if [ -f "$ST/pause" ]; then sleep 5; continue; fi
  P=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK" 2>/dev/null)
  if [[ "$P" =~ ^[0-9]+$ ]]; then
    [ "$BAD" -ge 3 ] && log "https check answers again"; BAD=0
    if [ "$P" -gt 0 ] && ready; then take; continue; fi
  else
    BAD=$(( BAD + 1 ))
    if [ "$BAD" -ge 3 ]; then   # the HTTPS check is captcha'd or down: a fresh SSH look every 30 s (practice only)
      [ "$BAD" = 3 ] && log "https check is not answering a number (got: $(printf '%s' "$P" | tr -d '\r\n' | cut -c1-60)): looking over SSH every 30 s"
      if ready && srv "${TOOLS}help-next.php --peek --practice" < /dev/null 2>>"$LOG" | grep -q '"waiting"'; then take; continue; fi
      sleep 25
    fi
  fi
  sleep 5
done

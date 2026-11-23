#!/bin/bash
# J.A.R.V.I.S. meeting recordings: the transcriber (20 Nov 2026, P-12; Matthew: "can i get jarvis to record audio from meetings like i said
# hey jarvis record this meeting"). The store is on the Assistant's server (assistant-private/lib/meet.php); this asks it over SSH
# (jvmeet.php) for a recording it may take, joins each segment's pieces, makes a 16 kHz WAV (ffmpeg), turns it into text (whisper.cpp,
# English, with the Silero voice detector so long silences are skipped), builds one running transcript (meeting-assemble.cjs) and hands it
# back (jvmeet.php done): the server saves it, reads it back, deletes the audio unless he tapped Keep audio, and sends it to his desk as
# [MEETING NOTES]. Every 2 minutes while it works it says "still working" (jvmeet.php hold); a claim lapses 10 minutes after the last one,
# so a laptop that sleeps mid-way hands the meeting to the other machine.
#   Laptop (preferred: large-v3-turbo, about 3x faster than real time here): help-watch.sh starts this every minute in the background.
#   Cloud machine (small.en, about 2.5x): its own systemd timer, jarvis-meetings.timer (traverse/ops/jarvis-cloud.sh meetings), and only while
#   the cloud's mode is live.
# The laptop also keeps a private copy of every finished transcript beside that company's meeting notes, in <folder>/meetings/transcripts/
# (gitignored: never committed), checked every 10 minutes.
#   bash assistant/jarvis/tools/meeting-worker.sh           one look (and a meeting, if one waits), then exit
# Log: laptop %LOCALAPPDATA%/ProjectBackup/meetings/meeting-worker.log; cloud ~/jarvis/state/meetings/meeting-worker.log.
# Test overrides: MEET_WHO MEET_SG MEET_JM MEET_ST MEET_REPO MEET_WHISPER MEET_MODEL MEET_VAD MEET_THREADS MEET_FFMPEG MEET_FFPROBE MEET_NO_HTTPS
set -u
ONWIN=0; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) ONWIN=1;; esac   # 22 Nov: by the system, not by cygpath (the VM has a cygpath stand-in for the laptop scripts)
WHO="${MEET_WHO:-$([ "$ONWIN" = 1 ] && echo laptop || echo cloud)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "$WHO" = laptop ]; then
  REPO="${MEET_REPO:-$(cd "$HERE/../../.." && pwd)}"
  ST="${MEET_ST:-$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/meetings}"
  SG="${MEET_SG:-bash /c/Users/SURGEI~1/.ssh/sg.sh trav}"
  WD="/c/Users/Matthew sharpe/tools/whisper-cpp"; WC="${MEET_WHISPER:-$WD/Release/whisper-cli.exe}"
  WM="${MEET_MODEL:-$WD/models/ggml-large-v3-turbo-q5_0.bin}"; THR="${MEET_THREADS:-6}"
  KEYF=/c/Users/SURGEI~1/.ssh/jarvis-desk-key.txt
else
  REPO=""; ST="${MEET_ST:-$HOME/jarvis/state/meetings}"; SG="${MEET_SG:-bash $HOME/jarvis/bin/sg.sh trav}"
  WD="$HOME/jarvis/tools/whisper.cpp"; WC="${MEET_WHISPER:-$WD/build/bin/whisper-cli}"
  WM="${MEET_MODEL:-$WD/models/ggml-small.en-q5_1.bin}"; THR="${MEET_THREADS:-3}"; KEYF=""
  M=$(sed -n 's/^MODE=\([a-z]*\)[[:space:]]*$/\1/p' "$HOME/jarvis/config" 2>/dev/null | tail -1)
  [ -n "${MEET_SG:-}" ] || [ "$M" = live ] || exit 0   # the cloud transcribes only while it is live (its mode is Matthew's call)
fi
WV="${MEET_VAD:-$(dirname "$WM")/ggml-silero-v6.2.0.bin}"
JM="${MEET_JM:-php \$HOME/www/traverseplatforms.com/assistant-private/jvmeet.php}"
mkdir -p "$ST"; LOG="$ST/meeting-worker.log"
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
wp() { if [ "$ONWIN" = 1 ]; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
FF="${MEET_FFMPEG:-$(command -v ffmpeg 2>/dev/null || ls "${LOCALAPPDATA:-/nonexistent}"/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe 2>/dev/null | tail -1)}"
FP="${MEET_FFPROBE:-$(command -v ffprobe 2>/dev/null || ls "${LOCALAPPDATA:-/nonexistent}"/Microsoft/WinGet/Packages/Gyan.FFmpeg*/ffmpeg-*/bin/ffprobe.exe 2>/dev/null | tail -1)}"

# one copy at a time (a stale lock, over 8 hours old, is taken over)
LK="$ST/lock"
if ! mkdir "$LK" 2>/dev/null; then
  [ $(( $(date +%s) - $(stat -c %Y "$LK" 2>/dev/null || echo 0) )) -gt 28800 ] || exit 0
  log "stale lock taken over"; rm -rf "$LK"; mkdir "$LK" 2>/dev/null || exit 0
fi
HOLDP=""; HDR=""
cleanup() { [ -n "$HOLDP" ] && kill "$HOLDP" 2>/dev/null; [ -n "$HDR" ] && rm -f "$HDR"; rm -rf "$LK"; }
trap cleanup EXIT

jget() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const v=process.argv[1].split('.').reduce((o,k)=>o==null?o:o[k],j);console.log(v==null?'':v)}catch(e){}})" "$1"; }

one_meeting() {
  local J ID W SEGS S EXT SKIP DUR T0 RC TXT R MODELN
  J=$($SG "$JM next $WHO" < /dev/null 2>>"$LOG") || { log "next: server not reachable"; return 1; }
  [ -n "$J" ] || return 0
  ID=$(printf '%s' "$J" | jget id)
  [[ "$ID" =~ ^m[0-9]{14}[0-9a-f]{4}$ ]] || { log "next: could not read the job"; return 1; }
  W="$ST/work/$ID"; rm -rf "$W"; mkdir -p "$W"; printf '%s' "$J" > "$W/job.json"; T0=$(date +%s)
  log "$ID: taken ($(printf '%s' "$J" | jget label), $(printf '%s' "$J" | jget secs) s, try $(printf '%s' "$J" | jget attempt))"
  ( while sleep 110; do $SG "$JM hold $ID $WHO" < /dev/null > /dev/null 2>&1; done ) < /dev/null > /dev/null 2>&1 & HOLDP=$!   # its own stdio: nothing waits on it
  fail() { log "$ID: FAILED: $1"; printf '%s' "$1" | $SG "$JM fail $ID $WHO" >> "$LOG" 2>&1; kill "$HOLDP" 2>/dev/null; HOLDP=""; rm -rf "$W"; return 1; }
  [ -n "$FF" ] && [ -n "$FP" ] || { fail "ffmpeg is missing on the $WHO"; return 1; }
  [ -f "$WC" ] && [ -f "$WM" ] || { fail "whisper.cpp is missing on the $WHO"; return 1; }
  local VADA=(); [ -f "$WV" ] && VADA=(--vad -vm "$(wp "$WV")")
  SEGS=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));for(const g of j.segs||[])console.log([g.seg,g.ext||'webm',g.skip?1:0].join(' '))" "$W/job.json")
  local GOOD=0
  while read -r S EXT SKIP; do
    [ -n "$S" ] || continue
    [[ "$S" =~ ^[0-9]{1,3}$ ]] && [[ "$EXT" =~ ^(webm|ogg|m4a|aac|mp3|wav|flac)$ ]] || { fail "bad segment line"; return 1; }
    [ "$SKIP" = 1 ] && continue
    $SG "$JM seg $ID $S" < /dev/null > "$W/s$S.$EXT" 2>>"$LOG"
    [ -s "$W/s$S.$EXT" ] || { fail "segment $S did not come down"; return 1; }
    if ! timeout 1800 "$FF" -nostdin -loglevel error -y -i "$(wp "$W/s$S.$EXT")" -ar 16000 -ac 1 -c:a pcm_s16le "$(wp "$W/s$S.wav")" < /dev/null 2>>"$LOG"; then
      log "$ID: segment $S could not be read by ffmpeg"; touch "$W/s$S.bad"; rm -f "$W/s$S.wav"; continue
    fi
    DUR=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$(wp "$W/s$S.wav")" < /dev/null 2>/dev/null | tr -d '\r'); [[ "$DUR" =~ ^[0-9]+([.][0-9]+)?$ ]] || DUR=0
    printf '%s' "$DUR" > "$W/s$S.dur"
    local DI="${DUR%.*}"; DI="${DI:-0}"; timeout $(( DI * 3 + 900 )) nice -n 15 "$WC" -m "$(wp "$WM")" -l en -t "$THR" -np "${VADA[@]}" -osrt -of "$(wp "$W/s$S")" -f "$(wp "$W/s$S.wav")" < /dev/null > /dev/null 2>>"$W/whisper.err"; RC=$?
    rm -f "$W/s$S.wav" "$W/s$S.$EXT"
    [ "$RC" = 0 ] && [ -f "$W/s$S.srt" ] || { fail "whisper stopped on segment $S (exit $RC)"; return 1; }
    GOOD=$(( GOOD + 1 ))
  done <<< "$SEGS"
  [ "$GOOD" -gt 0 ] || { fail "no segment could be read"; return 1; }
  TXT=$(node "$HERE/meeting-assemble.cjs" "$W") || { fail "the transcript could not be put together"; return 1; }
  MODELN=$(basename "$WM" .bin | sed 's/^ggml-//')
  R=$(printf '%s\n' "$TXT" | $SG "$JM done $ID $WHO $MODELN" 2>>"$LOG") || { kill "$HOLDP" 2>/dev/null; HOLDP=""; log "$ID: the server did not take the transcript (kept in $W)"; printf '%s\n' "$TXT" > "$W/transcript.txt"; return 1; }
  kill "$HOLDP" 2>/dev/null; HOLDP=""
  log "$ID: done in $(( $(date +%s) - T0 )) s, $(printf '%s' "$TXT" | wc -c) bytes; $R"
  rm -rf "$W"; SYNC_NOW=1
}

# the laptop's private copy of each finished transcript, beside that company's meeting notes (gitignored; see traverse/ops/jarvis-matthew-prompt.md)
folder_of() {   # folder_of <company> <other>
  case "$1" in
    Surge) echo surge/meetings;; Sixfold) echo sixfold/meetings;; Traverse) echo traverse/business/meetings;;
    Peak) echo matthew/clients/peak-pickleball/meetings;; Personal) echo personal/meetings;;
    *) local s; s=$(printf '%s' "$2" | tr 'A-Z' 'a-z' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
       if [ -n "$s" ] && [ -d "$REPO/matthew/clients/$s" ]; then echo "matthew/clients/$s/meetings"; else echo matthew/meetings; fi;;
  esac
}
sync_copies() {
  local L ID CO OT DT D F
  L=$($SG "$JM transcripts" < /dev/null 2>>"$LOG") || return 1
  touch "$ST/saved.txt"
  printf '%s' "$L" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{for(const m of JSON.parse(s))console.log([m.id,m.company,(m.other||'-').replace(/[\t\r\n]+/g,' '),m.date].join('\t'))}catch(e){}})" | while IFS=$'\t' read -r ID CO OT DT; do
    [[ "$ID" =~ ^m[0-9]{14}[0-9a-f]{4}$ ]] && [[ "$DT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue
    grep -qx "$ID" "$ST/saved.txt" && continue
    D="$REPO/$(folder_of "$CO" "$OT")/transcripts"; F="$D/$DT-$ID.txt"; mkdir -p "$D"
    if $SG "$JM text $ID" < /dev/null > "$F.tmp" 2>>"$LOG" && [ -s "$F.tmp" ]; then mv "$F.tmp" "$F"; echo "$ID" >> "$ST/saved.txt"; log "$ID: private copy at ${F#$REPO/}"
    else rm -f "$F.tmp"; fi
  done
  touch "$ST/synced.stamp"
}

N=""; SYNC_NOW=0
if [ "$WHO" = laptop ] && [ -z "${MEET_NO_HTTPS:-}" ] && [ -s "$KEYF" ]; then   # the cheap look over HTTPS with the laptop key (a header file, never the command line)
  HDR=$(mktemp); chmod 600 "$HDR"; printf 'X-Jarvis-Key: %s\n' "$(tr -d '\r\n' < "$KEYF")" > "$HDR"
  N=$(curl -s -m 10 -A "jarvis-meet/1.0" -H @"$(wp "$HDR")" "https://traverseplatforms.com/a-e018bb82/api.php?action=jvmpending&who=laptop" 2>/dev/null)
  rm -f "$HDR"; HDR=""
fi
[[ "$N" =~ ^[0-9]+$ ]] || N=$($SG "$JM peek $WHO" < /dev/null 2>>"$LOG" | tr -d '\r\n')
if [[ "$N" =~ ^[0-9]+$ ]] && [ "$N" -gt 0 ]; then one_meeting; fi
if [ "$WHO" = laptop ] && [ -n "$REPO" ]; then
  if [ "$SYNC_NOW" = 1 ] || [ ! -f "$ST/synced.stamp" ] || [ $(( $(date +%s) - $(stat -c %Y "$ST/synced.stamp" 2>/dev/null || echo 0) )) -ge 600 ]; then sync_copies; fi
fi
exit 0

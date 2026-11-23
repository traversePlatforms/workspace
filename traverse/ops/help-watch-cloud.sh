#!/bin/bash
# J.A.R.V.I.S. on the Azure cloud machine (TASKS X-15; design and switch-over: traverse/ops/JARVIS-CLOUD.md).
# 12 Nov: trial run 1, practice copy only. 19 Nov (Matthew: go ahead with the always-on J.A.R.V.I.S. "keep it in the big one while we got it?
# then switch"): the full watcher, in three modes, set in ~/jarvis/config (MODE=...) by `jarvis-cloud.sh mode <m>` on the laptop:
#   shadow    (the default) reads the live queues (Jen and Brad's Sixfold chat, Matthew's J.A.R.V.I.S. desk, the Houston install) and only
#             LOGS what it would do: it peeks (never takes, never replies) and, for Matthew's own messages, runs the read-only quick pass and
#             keeps its answer beside the log for comparison. The practice copy is answered for real, as in the trial.
#   live      takes and answers everything, the laptop's way (help-watch.sh ported to Linux). Only after Matthew's go.
#   practice  the 12 Nov trial: practice tickets only, nothing else looked at.      off   nothing.
# The laptop watcher reads the beat this script writes (~/www/traverseplatforms.com/jarvis-cloud/beat.txt on the server, every minute, from
# its own background loop so a long session never stops it) and stands back only while the beat is fresh AND says live AND ready.
#
# ⚑ THE SPLIT (JARVIS-CLOUD.md, "Design"): the cloud answers, looks things up and does SERVER work (the office's leads, jobs, payments: the
# app's own server code over SSH). It never deploys, never commits and never builds: the deploy scripts refuse on this machine
# (JARVIS_CLOUD=1), and its repo copy (~/workspace, refreshed from the laptop) is put back to the laptop's copy before every session. A job
# that needs the repo is queued for the laptop (~/jarvis/bin/laptop-job.sh) and answered "queued for the laptop". Anything a session wrote
# anyway (memory notes, jarvis-learned*.md, TASKS.md, code) is caught after the session as a bundle in ~/jarvis/outbox/changes/ that the
# laptop merges (jarvis-cloud-sync.sh: notes line by line, never last-writer-wins; code is never applied, only shown to Matthew).
#
# ⚑ THE GUARD (in code): every command THIS script sends to the server goes through srv(), and srv() runs only what allowed() lists for
# the mode: shadow = peeks, counts and the beat (plus the practice copy's own commands); live adds taking, replying, transcripts, the
# final-reply check and reading a ticket's own files. --guard-test checks it. Sessions in live mode use ~/jarvis/bin/sg.sh (the Traverse
# account, the same reach as the laptop's key: see "What the guard does not cover").
# Never an API key: the session runs only on Matthew's Claude plan (the variables are cleared; a Console sign-in counts as not signed in).
#
#   bash help-watch-cloud.sh                 the service: loop forever (one copy: flock on ~/jarvis/state/watch.lock)
#   bash help-watch-cloud.sh --check         readiness       --guard-test   the guard (must print all PASS)     --mode   the mode in force
#   bash help-watch-cloud.sh --peek          the next ticket in each queue, what it would do (reads only)
#   bash help-watch-cloud.sh --test-ticket <file.json> [--run]    practice dry run from a ticket JSON (no server)
#   bash help-watch-cloud.sh --transcribe <file>
# Tests against stand-ins (no live server, no Claude): bash ~/jarvis/ops/cloud-test.sh (traverse/ops/tests/cloud-test.sh).
# Pause: touch ~/jarvis/state/pause. Log: ~/jarvis/state/help-watch.log; shadow rows: ~/jarvis/state/shadow/shadow.tsv.
set -u
J="${JARVIS_HOME:-$HOME/jarvis}"; OPS="$J/ops"; ST="$J/state"; SEC="$J/secrets"; BIN="$J/bin"; OUTBOX="$J/outbox"
mkdir -p "$ST" "$ST/shadow" "$OUTBOX/changes" "$OUTBOX/jobs" "$OUTBOX/merged"
LOG="$ST/help-watch.log"; PCWD="$J/practice-cwd"
WS="${JARVIS_WS:-$HOME/workspace}"                                   # the repo copy (filtered like GitHub's: no Surge Tier 1 notes)
# 22 Nov (VM-MAIN-WORKSPACE.md): WRITE=laptop (the default: the laptop's history is the truth, the write turn waits for the laptop to be
# away, the cloud's commits go back as patches) or WRITE=vm (after vm-main.sh flip: the VM's ~/jarvis/repo.git is the truth, this machine
# always holds the write turn, each session's commits are rebased and pushed straight into it, memory is ~/main's, shared directly).
write_now() { local w; w=$(sed -n 's/^WRITE=\([a-z]*\)[[:space:]]*$/\1/p' "$J/config" 2>/dev/null | tail -1); [ "$w" = vm ] && echo vm || echo laptop; }
WRITE="${JARVIS_WRITE:-$(write_now)}"
if [ "$WRITE" = vm ]; then MEM="${JARVIS_MEM:-$HOME/.claude/projects/-home-yard-main/memory}"   # the one memory folder (~/main's; the
else MEM="${JARVIS_MEM:-$HOME/.claude/projects/-home-yard-workspace/memory}"; fi                 # flip links ~/workspace's to it)
MEMBASE="$J/memory-base"; INC="$J/incoming"
CLAUDE="${JARVIS_CLAUDE:-$HOME/.local/bin/claude}"
WHISPER_DIR="$J/tools/whisper.cpp"; WC="$WHISPER_DIR/build/bin/whisper-cli"
WM="$WHISPER_DIR/models/ggml-${WHISPER_MODEL:-small.en-q5_1}.bin"   # small.en: 7-8 s a note here; turbo 37-38 s (12 Nov)
KEY=$(cat "$SEC/help-poll-key.txt" 2>/dev/null); CHECK="https://traverseplatforms.com/api/help-pending.php?k=$KEY"
SGKEY="$SEC/traverse_sg_cloud"; SGDEST="u3233-r4fz9nguryw0@giowm1063.siteground.biz"
TOOLS='php $HOME/www/traverseplatforms.com/sixfold-tools/'
JD='php $HOME/www/traverseplatforms.com/assistant-private/jvdesk.php'
SITE='$HOME/www/traverseplatforms.com'
INSTALLS="${JARVIS_INSTALLS:-c-houston-lawn-test}"
# 21 Nov (TASKS JV-APPS): the Peak desk's and the post calendar's own J.A.R.V.I.S. (jv-tools/jv.php), and the installs in FULL get a working
# session (that install's data) instead of the read-only one. Same as the laptop's one_app (help-watch.sh).
APPS="${JARVIS_APPS:-peak posts}"
FULL="${JARVIS_FULL_INSTALLS:-c-houston-lawn-test}"
JV='php $HOME/www/traverseplatforms.com/jv-tools/jv.php'
BEATCMD='cat > $HOME/www/traverseplatforms.com/jarvis-cloud/beat.txt'
LAPCMD='cat $HOME/www/traverseplatforms.com/jarvis-cloud/laptop.txt'   # the laptop's beat: "<unix time> <its HEAD>" every 5 min while it is on
JSTREAM='cd $HOME/www/traverseplatforms.com/assistant-private && for i in $(seq 1 720); do php jvdesk.php count 2>/dev/null || echo x; sleep 5; done'
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL ANTHROPIC_MODEL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_OAUTH_TOKEN
TEST=0
log() { echo "$(date '+%F %T') $*" >> "$LOG"; [ "$TEST" != 0 ] && echo "  log: $*" >&2; return 0; }

mode_now() { local m; m=$(sed -n 's/^MODE=\([a-z]*\)[[:space:]]*$/\1/p' "$J/config" 2>/dev/null | tail -1); case "$m" in live|shadow|practice|off) echo "$m";; *) echo shadow;; esac; }
MODE="${JARVIS_MODE:-$(mode_now)}"

# ---- the guard -------------------------------------------------------------------------------------------------------------------------
# RX_AUD, not AUD (20 Nov): one_ticket and the desk handler declare `local ... AUD`, and bash's dynamic scope made allowed() see that empty
# local under set -u ("AUD: unbound variable"), so every guarded call inside a ticket died. Keep the guard's patterns on names no function uses.
TID='h[0-9]{14}[0-9a-f]{4}'; RX_AUD='a[0-9]{10}[0-9a-f]{6}\.(webm|ogg|m4a|mp3|aac)'; PHO='p[0-9]{10}[0-9a-f]{6}\.(jpg|png|webp)'
inst_ok() { local x; for x in $INSTALLS; do [ "$1" = "$x" ] && return 0; done; return 1; }
app_ok() { local x; for x in $APPS; do [ "$1" = "$x" ] && return 0; done; return 1; }
RX_APPDIR='/[A-Za-z0-9/_.-]*/(peak-desk-data|post-calendar-data)/jarvis/help-files'
allowed() {   # allowed '<command>' [mode]: 0 = this script may send it in that mode
  local c="$1" m="${2:-$MODE}" i
  [ "$m" = off ] && return 1
  # two fixed strings, matched whole: the beat (text on stdin) and the desk count stream (shadow and live)
  if [ "$m" != practice ]; then [ "$c" = "$BEATCMD" ] && return 0; [ "$c" = "$JSTREAM" ] && return 0; [ "$c" = "$LAPCMD" ] && return 0; fi
  [ "$m" = practice ] && [ "$c" = "$BEATCMD" ] && return 0
  case "$c" in *$'\n'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*|*'..'*|*'*'*|*'?'*) return 1;; esac   # one plain command, nothing chained
  # the practice copy (every mode but off): as in the 12 Nov trial
  [[ "$c" =~ ^"$TOOLS"help-next\.php(\ --peek)?\ --practice$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-reply\.php\ $TID\ answered\ --practice$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-transcript\.php\ $TID\ $RX_AUD(\ --failed)?\ --practice$ ]] && return 0
  [[ "$c" =~ ^cat\ \'/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID/$RX_AUD\'$ ]] && return 0
  [ "$m" = practice ] && return 1
  # shadow and live: look only
  [[ "$c" =~ ^"$TOOLS"help-next\.php\ --peek$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-next\.php\ --peek\ --install=(c-[a-z0-9-]{1,40})$ ]] && inst_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^"$JD"\ (next\ --peek|count)$ ]] && return 0
  [[ "$c" =~ ^"$JV"\ ([a-z]+)\ (next\ --peek|count)$ ]] && app_ok "${BASH_REMATCH[1]}" && return 0   # the apps (21 Nov)
  [ "$m" = live ] || return 1
  # the apps' own chats (21 Nov): take, the watcher's own replies (day cap, no final reply, the post calendar session's text), transcripts, the
  # final-reply check, a ticket's own photos and voice notes
  [[ "$c" =~ ^"$JV"\ ([a-z]+)\ next$ ]] && app_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^"$JV"\ ([a-z]+)\ reply\ $TID\ (answered|matthew)(\ refresh)?$ ]] && app_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^"$JV"\ ([a-z]+)\ transcript\ $TID\ $RX_AUD(\ --failed)?$ ]] && app_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^"$JV"\ ([a-z]+)\ final-since\ $TID\ [0-9]{10}$ ]] && app_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^cat\ \'$RX_APPDIR/$TID/($RX_AUD|$PHO)\'$ ]] && return 0
  [[ "$c" =~ ^grep\ \'\"id\":\"$TID\"\'\ "$SITE"/(c-[a-z0-9-]{1,40})-data/rounds/help\.log$ ]] && inst_ok "${BASH_REMATCH[1]}" && return 0   # an install's final-reply check (21 Nov)
  # live only: take, reply (the watcher's own notes and the install's answers), transcripts, the final-reply check, a ticket's own files
  [[ "$c" =~ ^"$TOOLS"help-next\.php$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-next\.php\ --install=(c-[a-z0-9-]{1,40})$ ]] && inst_ok "${BASH_REMATCH[1]}" && return 0
  [[ "$c" =~ ^"$TOOLS"help-reply\.php\ $TID\ (answered|matthew)$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-reply\.php\ $TID\ (answered|matthew)\ --install=(c-[a-z0-9-]{1,40})$ ]] && inst_ok "${BASH_REMATCH[2]}" && return 0
  [[ "$c" =~ ^"$TOOLS"help-transcript\.php\ $TID\ $RX_AUD(\ --failed)?$ ]] && return 0
  [[ "$c" =~ ^"$TOOLS"help-transcript\.php\ $TID\ $RX_AUD(\ --failed)?\ --install=(c-[a-z0-9-]{1,40})$ ]] && inst_ok "${BASH_REMATCH[3]}" && return 0
  [[ "$c" =~ ^"$JD"\ next$ ]] && return 0
  [[ "$c" =~ ^"$JD"\ transcript\ $TID\ $RX_AUD(\ --failed)?$ ]] && return 0
  [[ "$c" =~ ^"$JD"\ reply\ $TID\ (answered|matthew)$ ]] && return 0
  [[ "$c" =~ ^"$JD"\ final-since\ $TID\ [0-9]{10}$ ]] && return 0
  [[ "$c" =~ ^grep\ \'\"id\":\"$TID\"\'\ "$SITE"/sixfold-data/rounds/help\.log$ ]] && return 0
  [[ "$c" =~ ^cat\ \'/[A-Za-z0-9/_.-]*/(sixfold-data|c-[a-z0-9-]{1,40}-data)/rounds/help-files/$TID/($RX_AUD|$PHO)\'$ ]] && { i="${BASH_REMATCH[1]}"; [ "$i" = sixfold-data ] || inst_ok "${i%-data}"; } && return 0
  [[ "$c" =~ ^cat\ \'/[A-Za-z0-9/_.-]*/assistant-private/data/jarvis/desk/files/$TID/($RX_AUD|$PHO)\'$ ]] && return 0
  return 1
}
SSH_OK_AT=0
srv() {   # srv '<command>' [< stdin]: one allowed command on the Traverse server with the VM's own key
  if ! allowed "$1"; then log "GUARD: refused a server command not allowed in $MODE mode: $(printf '%s' "$1" | tr '\n' ' ' | cut -c1-140)"; return 97; fi
  if [ "$TEST" = 2 ] || { [ "$TEST" = 1 ] && [[ ! "$1" =~ ^cat\ |--peek|\ count$ ]]; }; then log "test: would run on the server: $1"; cat > /dev/null; return 96; fi
  local rc
  if [ -n "${JARVIS_STANDIN:-}" ]; then bash "$JARVIS_STANDIN" "$1"; rc=$?   # tests: a stand-in server (cloud-test.sh), never the live one
  else ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -o StrictHostKeyChecking=yes \
         -o "UserKnownHostsFile=$SEC/known_hosts" -o IdentitiesOnly=yes -i "$SGKEY" -p 18765 "$SGDEST" "$1"; rc=$?; fi
  [ "$rc" != 255 ] && SSH_OK_AT=$(date +%s)
  return "$rc"
}
# the ticket's own files folder says which queue it came from; a ticket from the wrong place is dropped untouched
dir_of() { printf '%s' "$1" | jq -r '(.photoDir // "") + "|" + (.audioDir // "")' 2>/dev/null; }
is_practice_ticket() { local D; D=$(dir_of "$1") || return 1; [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID\|/[A-Za-z0-9/_.-]*/sixfold-practice-data/rounds/help-files/$TID$ ]] && [[ "$D" != *..* ]]; }
is_queue_ticket() {   # is_queue_ticket <json> <staff|jarvis|c-slug>
  local D; D=$(dir_of "$1") || return 1; [[ "$D" == *..* ]] && return 1
  case "$2" in
    staff) [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/sixfold-data/rounds/help-files/$TID\|/[A-Za-z0-9/_.-]*/sixfold-data/rounds/help-files/$TID$ ]];;
    jarvis) [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/assistant-private/data/jarvis/desk/files/$TID\|/[A-Za-z0-9/_.-]*/assistant-private/data/jarvis/desk/files/$TID$ ]] && [ "$(printf '%s' "$1" | jq -r '.desk // ""')" = jarvis ];;
    c-*) inst_ok "$2" && [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/$2-data/rounds/help-files/$TID\|/[A-Za-z0-9/_.-]*/$2-data/rounds/help-files/$TID$ ]];;
    peak) [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/peak-desk-data/jarvis/help-files/$TID\|/[A-Za-z0-9/_.-]*/peak-desk-data/jarvis/help-files/$TID$ ]] && [ "$(printf '%s' "$1" | jq -r '.app // ""')" = peak ];;
    posts) [[ "$D" =~ ^/[A-Za-z0-9/_.-]*/post-calendar-data/jarvis/help-files/$TID\|/[A-Za-z0-9/_.-]*/post-calendar-data/jarvis/help-files/$TID$ ]] && [ "$(printf '%s' "$1" | jq -r '.app // ""')" = posts ];;
    *) return 1;;
  esac
}

# ---- readiness and the beat -------------------------------------------------------------------------------------------------------------
signed_in() { [ -n "${JARVIS_SIGNED_IN:-}" ] && return 0; [ -x "$CLAUDE" ] && "$CLAUDE" auth status 2>/dev/null | jq -e '.loggedIn == true and .authMethod == "claude.ai"' > /dev/null 2>&1; }
tidy() {   # every 10 minutes: logs cut past 5 MB; voice notes, photos, reply copies, shadow files and merged bundles dropped after 14 days
  local f; for f in "$LOG" "$ST/p-session.err" "$ST/session.err"; do
    [ -f "$f" ] && [ "$(stat -c %s "$f" 2>/dev/null || echo 0)" -gt 5000000 ] && { tail -n 2000 "$f" > "$f.tmp" 2>/dev/null && mv "$f.tmp" "$f"; }
  done
  find "$ST/audio" "$ST/photos" "$ST/inst" "$ST/cur" -mindepth 1 -mtime +14 -delete 2>/dev/null
  find "$ST" -maxdepth 1 \( -name 'p-h*.reply' -o -name 'h*.out' -o -name 'h*.quick' -o -name 'h*.sys.md' -o -name 'c-*.out' \) -mtime +14 -delete 2>/dev/null
  find "$ST/shadow" -maxdepth 1 -name 'h*' -mtime +14 -delete 2>/dev/null
  find "$OUTBOX/merged" -mindepth 1 -maxdepth 1 -mtime +14 -exec rm -rf {} + 2>/dev/null
  return 0
}
disk_ok() { local a; a=$(df -k --output=avail "$ST" 2>/dev/null | tail -1 | tr -d ' '); [[ "$a" =~ ^[0-9]+$ ]] && [ "$a" -gt 512000 ]; }
ws_ok() { [ -d "$WS/.git" ] && [ -f "$WS/traverse/ops/help-desk-prompt.md" ]; }
READY_AT=0; READY=1; LASTSTATE=""
ready() {   # 0 = may take tickets. Cached 10 minutes; logged when it changes; written to state/ready for the beat
  local now s; now=$(date +%s)
  if [ $(( now - READY_AT )) -ge 600 ]; then
    READY_AT=$now; tidy
    if ! signed_in; then READY=1; elif ! disk_ok; then READY=2; elif [ "$MODE" = live ] && ! ws_ok; then READY=3; else READY=0; fi
  fi
  case "$READY" in
    0) s="ready ($MODE mode)";;
    2) s="disk nearly full on this machine (under 500 MB free): nothing is taken until there is room (the laptop still answers)";;
    3) s="no repo copy yet (~/workspace): the laptop has not sent it (jarvis-cloud-sync.sh push), so nothing live is taken";;
    *) s="waiting for sign-in: Claude Code on this machine is not signed in to Matthew's plan, so nothing is taken";;
  esac
  [ "$s" != "$LASTSTATE" ] && { log "$s"; LASTSTATE="$s"; }
  [ "$READY" = 0 ] && echo 1 > "$ST/ready" || echo 0 > "$ST/ready"
  return "$READY"
}
beat_loop() {   # its own background loop: every 60 s "<unix time> <mode> <ready 0|1>" to the server; stops within 5 s of the watcher
  local P="$1" r
  while kill -0 "$P" 2>/dev/null; do
    r=$(cat "$ST/ready" 2>/dev/null || echo 0); [ -f "$ST/pause" ] && r=0
    printf '%s %s %s\n' "$(date +%s)" "$MODE" "$r" | srv "$BEATCMD" > /dev/null 2>>"$ST/beat.err" && date +%s > "$ST/beat-sent"
    for _b in $(seq 12); do kill -0 "$P" 2>/dev/null || exit 0; sleep 5; done
  done
}

# ---- the repo copy and memory (live and shadow sessions read them; the laptop sends both: jarvis-cloud-sync.sh push) ------------------
# The repo copy is on branch "cloud": origin/main (the laptop's history, filtered) plus the cloud's own commits the laptop has not merged
# yet. Each cloud commit carries "Cloud-Id: c<time>-<4 hex>" (the commit-msg hook below adds it): the laptop applies the commit as a patch,
# so its id there differs, and the Cloud-Id is how both sides know it is in. Commits only while this machine holds the write turn.
# OVERRIDES: files put over the repo copy after each refresh (none now: the scripts check JARVIS_CLOUD themselves).
OVERRIDES=""
NOTES_RE='^traverse/ops/jarvis-learned(-office)?\.md$'
ids_in() { git -C "$WS" log --format='%(trailers:key=Cloud-Id,valueonly)' "$@" 2>/dev/null | grep -E '^c[0-9]{14}-[0-9a-f]{4}$' | sort -u; }
cloud_id_of() { git -C "$WS" log -1 --format='%(trailers:key=Cloud-Id,valueonly)' "$1" 2>/dev/null | grep -E '^c[0-9]{14}-[0-9a-f]{4}$' | head -1; }
hooks() {   # the repo copy's own hooks: every commit gets a Cloud-Id; no commit without the write turn; never Surge's restricted paths
  local H="$WS/.git/hooks"; mkdir -p "$H"
  cat > "$H/commit-msg" <<'HOOK'
#!/bin/bash
grep -qE '^Cloud-Id: c[0-9]{14}-[0-9a-f]{4}$' "$1" || git interpret-trailers --in-place --trailer "Cloud-Id: c$(date +%Y%m%d%H%M%S)-$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')" "$1"
HOOK
  cat > "$H/pre-commit" <<HOOK
#!/bin/bash
W="$ST/write-ok"
[ -s "\$W" ] && [ \$(( \$(date +%s) - \$(stat -c %Y "\$W") )) -lt 10800 ] || { echo "REFUSED: no commits on the cloud machine while the laptop is on (it holds the write turn). Queue the job: laptop-job.sh"; exit 1; }
git diff --cached --name-only | grep -qE '^surge/brand/(notes|photos/restricted-boards-DO-NOT-PUBLISH)/' && { echo "REFUSED: Surge's restricted notes never live on this machine"; exit 1; }
exit 0
HOOK
  chmod 755 "$H/commit-msg" "$H/pre-commit"
  # VM mode rebases this copy's commits onto the main history: the learned notes merge line by line there (both sides' lines kept)
  mkdir -p "$WS/.git/info"; printf '%s\n' 'traverse/ops/jarvis-learned*.md merge=union' > "$WS/.git/info/attributes"
}
laptop_state() {   # prints "<age seconds> <laptop HEAD> <its filtered twin or ->", or nothing when the laptop has never sent one
  local L t h f; L=$(srv "$LAPCMD" < /dev/null 2>/dev/null | head -1)
  [[ "$L" =~ ^([0-9]{10})\ ([0-9a-f]{40})$ ]] || return 1
  t="${BASH_REMATCH[1]}"; h="${BASH_REMATCH[2]}"; f=$(awk -v l="$h" '$1==l {print $2}' "$INC/commit-map" 2>/dev/null | tail -1)
  echo "$(( $(date +%s) - t )) $h ${f:--}"
}
WHY=""
write_turn() {   # 0 (and ~/jarvis/state/write-ok) when this machine may change, build, deploy and commit now; WHY says why not
  rm -f "$ST/write-ok"; WHY=""
  [ -f "$ST/stuck" ] && { WHY="cloud commits are stuck (they would not go on the newest history; branch stuck-* in ~/workspace): Matthew to look"; return 1; }
  if [ "$WRITE" = vm ]; then echo "${1:-?} $(date +%s)" > "$ST/write-ok"; WHY="this machine is the main workspace (VM mode)"; return 0; fi
  local S A H F; S=$(laptop_state) || { WHY="the laptop has not sent its beat (help-watch.sh too old, or never)"; return 1; }
  read -r A H F <<< "$S"
  [ "$A" -ge "${JARVIS_LAPTOP_AWAY:-900}" ] || { WHY="the laptop is on (seen $(( A / 60 )) min ago)"; return 1; }
  [ "$F" != - ] && git -C "$WS" merge-base --is-ancestor "$F" origin/main 2>/dev/null || { WHY="the laptop's last commit (${H:0:10}) never reached this machine"; return 1; }
  echo "${1:-?} $(date +%s)" > "$ST/write-ok"; WHY="the laptop is away ($(( A / 60 )) min)"; return 0
}
pending_bundles() { find "$OUTBOX/changes" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort; }
overlay() {   # overlay <repo|memory> <root>: the notes of bundles the laptop has not merged yet, merged in line by line (what the laptop will do)
  local area="$1" root="$2" b p base cloud
  for b in $(pending_bundles); do
    [ -f "$b/meta.json" ] || continue
    jq -r --arg a "$area" '.files[] | select(.area == $a and (.kind == "notes" or .kind == "memory") and .state != "deleted") | .path' "$b/meta.json" 2>/dev/null |
    while IFS= read -r p; do
      [[ "$p" =~ ^[A-Za-z0-9._/-]+$ ]] && [[ "$p" != *..* ]] || continue
      base="$b/$area/$p.base"; cloud="$b/$area/$p.cloud"; [ -f "$cloud" ] || continue
      [ -f "$base" ] || base=/dev/null
      mkdir -p "$(dirname "$root/$p")"; [ -f "$root/$p" ] || : > "$root/$p"
      git merge-file --union -q "$root/$p" "$base" "$cloud" 2>/dev/null || true
      [ "$area" = repo ] && { mkdir -p "$(dirname "$ST/overlay-base/$p")"; cp "$root/$p" "$ST/overlay-base/$p"; }   # capture compares with this, not HEAD
    done
  done
}
sync_workspace() {   # before every session: the newest copy the laptop sent, nothing left over from the last session
  ws_ok || return 1
  capture "between-sessions" > /dev/null   # anything written outside a session is kept, not lost
  git -C "$WS" fetch -q origin 2>>"$LOG" || log "workspace: fetch failed (using the copy already here)"
  # the cloud's own commits the laptop has not merged yet go back on top of the laptop's newest copy, in order
  rm -rf "$ST/overlay-base"
  local -a KEEP=(); local c id done_ids
  done_ids=$(ids_in origin/main)
  if git -C "$WS" rev-parse -q --verify refs/heads/cloud > /dev/null; then
    while read -r c; do id=$(cloud_id_of "$c"); [ -n "$id" ] && ! grep -qx "$id" <<< "$done_ids" && KEEP+=("$c"); done < <(git -C "$WS" rev-list --reverse origin/main..cloud 2>/dev/null)
  fi
  local OLD; OLD=$(git -C "$WS" rev-parse -q --verify refs/heads/cloud 2>/dev/null)
  ( cd "$WS" && git checkout -q -f -B cloud origin/main 2>>"$LOG" && git clean -fdq 2>>"$LOG" ) || { log "workspace: could not refresh"; return 1; }
  for c in "${KEEP[@]}"; do
    if ! git -C "$WS" -c core.hooksPath=/dev/null cherry-pick --allow-empty "$c" > /dev/null 2>>"$LOG"; then
      git -C "$WS" cherry-pick --abort 2>/dev/null; git -C "$WS" branch -f "stuck-$(date +%Y%m%d-%H%M%S)" "$OLD"
      git -C "$WS" checkout -q -f -B cloud origin/main; touch "$ST/stuck"
      log "workspace: a cloud commit ($(cloud_id_of "$c")) no longer goes on the laptop's copy: kept as branch stuck-*, writes stopped until Matthew looks"; break
    fi
  done
  [ "${#KEEP[@]}" -gt 0 ] && [ ! -f "$ST/stuck" ] && log "workspace: ${#KEEP[@]} cloud commit(s) the laptop has not merged yet are back on top"
  hooks
  local o; for o in $OVERRIDES; do [ -f "$OPS/override/$o" ] && cp "$OPS/override/$o" "$WS/$o"; done
  overlay repo "$WS"
  # VM mode: memory is the one folder ~/main uses, written directly; nothing comes from the laptop and nothing is captured for it
  [ "$WRITE" = vm ] && return 0
  # memory: a new copy from the laptop replaces ours (our own unmerged notes go back over it), then it is the base for the next capture
  if [ -s "$INC/memory.tgz" ]; then
    local N; N=$(mktemp -d "$J/mem.XXXX")
    if tar -xzf "$INC/memory.tgz" -C "$N" 2>>"$LOG" && [ -f "$N/MEMORY.md" ]; then
      overlay memory "$N"; mkdir -p "$(dirname "$MEM")"; rm -rf "$MEM.old"; [ -d "$MEM" ] && mv "$MEM" "$MEM.old"; mv "$N" "$MEM"; rm -rf "$MEM.old"
      mv "$INC/memory.tgz" "$INC/memory.applied.tgz"; log "memory: the laptop's newest copy is in ($(ls "$MEM" | wc -l) files)"
    else rm -rf "$N"; log "memory: the laptop's copy would not unpack: kept the old one"; fi
  fi
  [ -d "$MEM" ] && { rm -rf "$MEMBASE"; cp -a "$MEM" "$MEMBASE"; }
  return 0
}
vm_notes() {   # VM mode, after each session: the notes and TASKS.md it wrote but did not commit, committed for it
  ws_ok || return 0
  local ID="$1" p; local -a NP=()
  while IFS= read -r p; do { [[ "$p" =~ $NOTES_RE ]] || [ "$p" = TASKS.md ]; } && [ -f "$WS/$p" ] && NP+=("$p"); done \
    < <(cd "$WS" && { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
  [ "${#NP[@]}" -gt 0 ] || return 0
  echo "publish $(date +%s)" > "$ST/write-ok"   # the hook wants the write turn: held for this one commit
  git -C "$WS" add -- "${NP[@]}" 2>>"$LOG" && git -C "$WS" commit -q -m "J.A.R.V.I.S. cloud: notes from $ID" -- "${NP[@]}" >> "$LOG" 2>&1 \
    && log "$ID: committed ${NP[*]}" || log "$ID: could not commit ${NP[*]} (kept for review)"
  rm -f "$ST/write-ok"; return 0
}
vm_push() {   # VM mode: this copy's commits rebased onto the main history (~/jarvis/repo.git main) and pushed; no laptop to merge them
  ws_ok || return 0
  local ID="$1" i n; n=$(git -C "$WS" rev-list --count origin/main..HEAD 2>/dev/null || echo 0); [ "$n" -gt 0 ] || return 0
  for i in 1 2 3; do
    git -C "$WS" fetch -q origin 2>>"$LOG" || { log "$ID: fetch failed: $n commit(s) wait on branch cloud for the next session"; return 1; }
    if ! git -C "$WS" rebase -q origin/main >> "$LOG" 2>&1; then
      git -C "$WS" rebase --abort > /dev/null 2>&1; git -C "$WS" branch -f "stuck-$(date +%Y%m%d-%H%M%S)" HEAD; touch "$ST/stuck"
      log "$ID: the session's commits do not go onto the main history (a file changed both sides): kept as branch stuck-*, writes stopped until Matthew looks"
      ( session_env; cd "$WS" && bash assistant/jarvis/tools/jarvis-status.sh alert "The cloud J.A.R.V.I.S. made a change ($ID) that clashes with a newer change in the main copy. Nothing was lost: it is kept as a stuck-* branch in ~/workspace on the cloud machine, and the cloud makes no more repo changes until a session sorts it out (traverse/ops/VM-MAIN-WORKSPACE.md, Stuck)." ) > /dev/null 2>&1
      return 1
    fi
    git -C "$WS" push -q origin HEAD:main >> "$LOG" 2>&1 && { log "$ID: $n commit(s) pushed to the main history"; return 0; }
    sleep $(( i * 2 ))   # ~/main pushed in between: fetch and rebase again
  done
  log "$ID: push to the main history failed 3 times: the commits stay on branch cloud and go after the next session"; return 1
}
capture() {   # capture <ticket id>: what a session wrote in the repo copy or memory, kept as a bundle for the laptop. Prints the bundle path.
  local ID="$1" B p n=0 st k o skip; B="$OUTBOX/changes/$(date +%Y%m%d-%H%M%S)-$ID"
  # VM mode: commits and notes go straight into the main history; only code left uncommitted is kept (for review, with an alert)
  if [ "$WRITE" = vm ]; then vm_notes "$ID"; B="$OUTBOX/review/$(date +%Y%m%d-%H%M%S)-$ID"; fi
  local -a ROWS=()
  if ws_ok; then
    while IFS= read -r p; do
      [ -n "$p" ] || continue; skip=0; for o in $OVERRIDES; do [ "$p" = "$o" ] && skip=1; done; [ "$skip" = 1 ] && continue
      [[ "$p" =~ ^[A-Za-z0-9._/@+\ -]+$ ]] && [[ "$p" != *..* ]] || { log "capture: odd path skipped: $(printf '%s' "$p" | cut -c1-80)"; continue; }
      mkdir -p "$B/repo/$(dirname "$p")"
      if [ -f "$ST/overlay-base/$p" ]; then   # a note laid back over the copy (overlay): only what came after it counts
        cmp -s "$ST/overlay-base/$p" "$WS/$p" && continue; cp "$ST/overlay-base/$p" "$B/repo/$p.base"; st=changed
      elif git -C "$WS" cat-file -e "HEAD:$p" 2>/dev/null; then git -C "$WS" show "HEAD:$p" > "$B/repo/$p.base"; st=changed; else st=new; fi
      if [ -f "$WS/$p" ]; then cp "$WS/$p" "$B/repo/$p.cloud"; else st=deleted; fi
      k=code; [[ "$p" =~ $NOTES_RE ]] && k=notes; [ "$p" = TASKS.md ] && k=tasks
      ROWS+=("$(jq -cn --arg p "$p" --arg s "$st" --arg k "$k" '{area:"repo",path:$p,state:$s,kind:$k}')"); n=$((n+1))
    done < <(cd "$WS" && { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
    # the session's commits (write turn): one patch each, in order, for the laptop to apply (git am -3); each Cloud-Id once
    local c cid i=0
    [ "$WRITE" = vm ] || while read -r c; do
      cid=$(cloud_id_of "$c"); [ -n "$cid" ] || continue; grep -qx "$cid" "$ST/captured-ids" 2>/dev/null && continue
      i=$((i+1)); mkdir -p "$B/patches"; git -C "$WS" format-patch -1 --stdout "$c" > "$B/patches/$(printf '%04d' "$i")-$cid.patch"
      echo "$cid" >> "$ST/captured-ids"
      ROWS+=("$(jq -cn --arg p "$cid" --arg s "$(git -C "$WS" log -1 --format=%s "$c" | cut -c1-200)" '{area:"commit",path:$p,state:"commit",kind:"commit",subject:$s}')"); n=$((n+1))
    done < <(git -C "$WS" rev-list --reverse origin/main..HEAD 2>/dev/null)
  fi
  if [ "$WRITE" != vm ] && [ -d "$MEM" ] && [ -d "$MEMBASE" ]; then
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      [[ "$p" =~ ^[A-Za-z0-9._-]+$ ]] || continue
      mkdir -p "$B/memory"; st=changed
      [ -f "$MEMBASE/$p" ] && cp "$MEMBASE/$p" "$B/memory/$p.base" || st=new
      [ -f "$MEM/$p" ] && cp "$MEM/$p" "$B/memory/$p.cloud" || st=deleted
      ROWS+=("$(jq -cn --arg p "$p" --arg s "$st" '{area:"memory",path:$p,state:$s,kind:"memory"}')"); n=$((n+1))
    done < <( { cd "$MEM" && find . -maxdepth 1 -type f -printf '%f\n'; cd "$MEMBASE" && find . -maxdepth 1 -type f -printf '%f\n'; } 2>/dev/null | sort -u |
              while IFS= read -r f; do cmp -s "$MEM/$f" "$MEMBASE/$f" || echo "$f"; done )
  fi
  if [ "$WRITE" = vm ]; then   # leftovers kept (above), the copy put back to its commits, then the commits into the main history
    if [ "$n" -gt 0 ]; then
      printf '%s\n' "${ROWS[@]}" | jq -s --arg id "$ID" --arg at "$(date +%s)" '{id:$id,at:($at|tonumber),files:.}' > "$B/meta.json"
      log "$ID: $n file(s) the session left uncommitted kept for review ($(basename "$B")); not in the history"
      ( session_env; cd "$WS" && bash assistant/jarvis/tools/jarvis-status.sh alert "The cloud J.A.R.V.I.S. left changes it did not commit ($ID). They are not in the main copy; kept for review on the cloud machine in ~/jarvis/outbox/review/$(basename "$B")." ) > /dev/null 2>&1
      ( cd "$WS" && git reset -q --hard HEAD && git clean -fdq ) 2>>"$LOG"
    fi
    vm_push "$ID"; [ "$n" -gt 0 ] && echo "$B"; return 0
  fi
  [ "$n" = 0 ] && return 0
  printf '%s\n' "${ROWS[@]}" | jq -s --arg id "$ID" --arg at "$(date +%s)" --arg base "$(git -C "$WS" rev-parse HEAD 2>/dev/null)" \
    --arg lap "$(cat "$INC/laptop-head.txt" 2>/dev/null | head -1)" '{id:$id,at:($at|tonumber),base:$base,laptop:$lap,files:.}' > "$B/meta.json"
  [ -d "$MEM" ] && { rm -rf "$MEMBASE"; cp -a "$MEM" "$MEMBASE"; }   # the next capture shows only what came after this one
  log "$ID: $n file(s) written by the session kept for the laptop ($(basename "$B"))"
  echo "$B"
}

# ---- voice notes and photos -------------------------------------------------------------------------------------------------------------
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
# get_audio <ticket JSON> <ticket id> <practice|staff|jarvis|c-slug>: each untranscribed note fetched, transcribed once, the text posted back.
# Prints a line per note for the prompt (live sessions); leaves <file>.txt beside each note (the practice conversation reads those).
get_audio() {
  local T="$1" ID="$2" Q="$3" DIR OUT="$ST/audio/$2" I N SECS HAS TXT WHO T0 TC
  DIR=$(printf '%s' "$T" | jq -r '.audioDir // .photoDir // ""')
  mkdir -p "$OUT"
  case "$Q" in
    practice) TC="${TOOLS}help-transcript.php $ID %s%s --practice";;
    staff) TC="${TOOLS}help-transcript.php $ID %s%s";;
    jarvis) TC="$JD transcript $ID %s%s";;
    c-*) TC="${TOOLS}help-transcript.php $ID %s%s --install=$Q";;
    peak|posts) TC="$JV $Q transcript $ID %s%s";;   # the apps (21 Nov)
  esac
  printf '%s' "$T" | jq -r '.conversation | to_entries[] | .key as $i | .value.from as $w | (.value.audio // [])[] | [($i + 1), .n, (.secs // 0), (if .text then "1" elif .failed then "f" else "0" end), (.text // "" | gsub("[\t\n\r]"; " ")), ($w // "" | gsub("[\t\n\r]"; " "))] | @tsv' 2>/dev/null |
  while IFS=$'\t' read -r I N SECS HAS TXT WHO; do
    [[ "$N" =~ ^$RX_AUD$ ]] || continue
    if [ "$HAS" = 1 ]; then printf '%s' "$TXT" > "$OUT/$N.txt"
    elif [ "$HAS" = f ]; then TXT=""
    else
      T0=$(date +%s); TXT=""
      if [ -s "$OUT/$N.txt" ]; then TXT=$(cat "$OUT/$N.txt")
      else
        [[ "$DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] && { [ -s "$OUT/$N" ] || srv "cat '$DIR/$N'" < /dev/null > "$OUT/$N" 2>>"$LOG"; }
        [ -s "$OUT/$N" ] || rm -f "$OUT/$N"
        [ -s "$OUT/$N" ] && TXT=$(transcribe "$OUT/$N")
      fi
      if [ -n "$TXT" ]; then
        printf '%s' "$TXT" > "$OUT/$N.txt"
        # shellcheck disable=SC2059
        printf '%s' "$TXT" | srv "$(printf "$TC" "$N" "")" >> "$LOG" 2>&1
        log "$Q $ID: voice note $N transcribed in $(( $(date +%s) - T0 )) s"
      else
        # shellcheck disable=SC2059
        srv "$(printf "$TC" "$N" " --failed")" < /dev/null >> "$LOG" 2>&1
        log "$Q $ID: voice note $N could not be transcribed"
      fi
    fi
    if [ -n "$TXT" ]; then echo "- Voice note from $WHO (message $I, $((SECS / 60)):$(printf '%02d' $((SECS % 60)))), transcribed: $TXT"
    else echo "- Voice note from $WHO (message $I): voice note could not be transcribed. If you need what it said, ask them to type it."; fi
  done
}
get_photos() {   # get_photos <ticket JSON> <ticket id>: each photo copied to $ST/photos/<ticket>/; a line per photo for the prompt
  local T="$1" ID="$2" DIR I N OUT="$ST/photos/$2"
  DIR=$(printf '%s' "$T" | jq -r '.photoDir // ""')
  printf '%s' "$T" | jq -r '.conversation | to_entries[] | .key as $i | (.value.photos // [])[] | "\($i + 1) \(.)"' 2>/dev/null | while read -r I N; do
    [[ "$N" =~ ^$PHO$ ]] && [[ "$DIR" =~ ^/[A-Za-z0-9/_.-]+$ ]] || continue
    mkdir -p "$OUT"; [ -s "$OUT/$N" ] || srv "cat '$DIR/$N'" < /dev/null > "$OUT/$N" 2>>"$LOG"
    [ -s "$OUT/$N" ] && echo "- message $I: $OUT/$N" || rm -f "$OUT/$N"
  done
}
conversation() {   # the chat as text (practice and installs), voice notes from the .txt files get_audio left
  printf '%s' "$1" | AD="$ST/audio/$2" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const t=JSON.parse(s);const fs=require('fs'),vt=a=>{try{return /^a[0-9]{10}[0-9a-f]{6}[.][a-z0-9]+$/.test(a.n||'')?fs.readFileSync(process.env.AD+'/'+a.n+'.txt','utf8').trim():''}catch(e){return ''}};console.log(t.conversation.map(m=>m.from+' ('+m.when+'): '+(m.text||'')+((m.photos||[]).length?' [sent '+m.photos.length+' photo'+(m.photos.length>1?'s':'')+(process.env.NAMES?': '+m.photos.join(', '):'')+']':'')+(m.audio||[]).map(a=>{const x=vt(a);return x?' [voice note: '+x+']':' [sent a voice note]'}).join('')).join('\n\n'))}catch(e){}})"
}
only_matthew() {   # 1 when every person-written message is Matthew's (review 11 Nov: not just the ticket's `by`)
  printf '%s' "$1" | jq -r '[.conversation[] | select((.from // "" | ascii_downcase | test("^(claude|j\\.?a\\.?r\\.?v\\.?i\\.?s\\.?)$")) | not)] | if length > 0 and all(.from == "Matthew Sharpe") then 1 else 0 end' 2>/dev/null || echo 0
}

# ---- the practice copy (every mode but off; as the 12 Nov trial) -----------------------------------------------------------------------
practice_session() {
  [ -s "$OPS/help-practice-prompt.md" ] || { log "practice: help-practice-prompt.md is missing: no session (run jarvis-cloud.sh deploy)"; return 1; }
  mkdir -p "$PCWD"
  (cd "$PCWD" && printf 'The chat so far (answer the last message):\n\n%s' "$1" | timeout 300 "$CLAUDE" -p --tools "" --strict-mcp-config --setting-sources project \
     --model "${HELP_MODEL:-sonnet}" --system-prompt-file "$OPS/help-practice-prompt.md" --output-format text 2>>"$ST/p-session.err")
}
DID=0
one_practice() {
  local T ID OUT CONV T0
  ready || return 0
  T=$(srv "${TOOLS}help-next.php --practice" < /dev/null 2>>"$LOG") || { log "practice: server not reachable (has Matthew added the VM's SSH key in SiteGround?)"; sleep 25; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""' 2>/dev/null)
  [[ "$ID" =~ ^$TID$ ]] || { log "practice: could not read the ticket"; return 1; }
  is_practice_ticket "$T" || { log "GUARD: ticket $ID is not from the practice copy: left untouched"; return 1; }
  T0=$(date +%s); log "practice $ID: session started (cloud)"
  get_audio "$T" "$ID" practice > /dev/null
  CONV=$(conversation "$T" "$ID")
  OUT=$(practice_session "$CONV")
  [ -n "$OUT" ] || { OUT="My apologies, I seem to have lost my train of thought. Could you send that again?"; log "practice $ID: the session gave no reply"; }
  printf '%s' "$OUT" > "$ST/p-$ID.reply"
  printf '%s' "$OUT" | srv "${TOOLS}help-reply.php $ID answered --practice" >> "$LOG" 2>&1
  log "practice $ID: done in $(( $(date +%s) - T0 )) s"; DID=1
}

# ---- live: the laptop's one_ticket, ported (staff = the Sixfold app's chat, jarvis = Matthew's desk) ------------------------------------
session_env() {   # what every live session gets: this machine's server wrapper, no laptop paths, the deploy refusal switch
  export JARVIS_CLOUD=1 JARVIS_SG="bash $BIN/sg.sh trav" JARVIS_REPO="$WS" JARVIS_NO_STRIPE=1 LOCALAPPDATA="$J/localappdata"
  export JARVIS_DESK_KEYFILE="$SEC/no-desk-key" JARVIS_TICKET_DIR="$ST/cur" PATH="$BIN:$PATH"; mkdir -p "$J/localappdata"
}
final_since() {   # final_since <id> <unix time> <staff|jarvis|peak|posts|c-slug>: a final reply (answered/matthew) written since then
  if [ "$3" = jarvis ]; then srv "$JD final-since $1 $2" < /dev/null > /dev/null 2>&1; return $?; fi
  if app_ok "$3"; then srv "$JV $3 final-since $1 $2" < /dev/null > /dev/null 2>&1; return $?; fi   # the apps (21 Nov)
  local HL=sixfold-data; [[ "$3" == c-* ]] && inst_ok "$3" && HL="$3-data"
  srv "grep '\"id\":\"$1\"' $SITE/$HL/rounds/help.log" < /dev/null 2>/dev/null |
    SINCE="$2" jq -s -e --argjson t "$2" 'map(select(.t == "reply" and (.status == "answered" or .status == "matthew") and ((.at // 0) | tonumber) >= ($t - 5))) | length > 0' > /dev/null 2>&1
}
job_n() { jq -r '.n // 0' "$OUTBOX/jobs/$1.json" 2>/dev/null || echo 0; }
one_ticket() {   # one_ticket <staff|jarvis>
  local K="$1" T ID BY MM M PROMPT SYS LF RPL SS RC PICS AUD N QS Q QH QT JOBNOTE=""
  ready || return 0
  sync_workspace || { log "$K: the repo copy could not be refreshed: nothing taken"; sleep 30; return 0; }
  if [ "$K" = jarvis ]; then T=$(srv "$JD next" < /dev/null 2>>"$LOG") || { log "jarvis desk: server not reachable"; sleep 25; return 0; }
  else T=$(srv "${TOOLS}help-next.php" < /dev/null 2>>"$LOG") || { log "server not reachable"; sleep 25; return 0; }; fi
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""' 2>/dev/null)
  [[ "$ID" =~ ^$TID$ ]] || { log "$K: could not read the ticket"; return 1; }
  is_queue_ticket "$T" "$K" || { log "GUARD: ticket $ID is not from the $K queue: left untouched"; return 1; }
  mkdir -p "$ST/cur"; printf '%s' "$T" > "$ST/cur/$ID.json"; N=$(printf '%s' "$T" | jq '.conversation | length')
  # queued for the laptop already, and nothing new from them since: leave it with the laptop (the 90-minute requeue brings it back here)
  if [ -f "$OUTBOX/jobs/$ID.json" ]; then
    if [ "$(job_n "$ID")" -ge "$N" ]; then log "$ID: still queued for the laptop: left working"; DID=1; return 0; fi
    JOBNOTE="(Watcher note: part of this conversation is already queued for the laptop: $(jq -r '.note // ""' "$OUTBOX/jobs/$ID.json" | head -c 400). Answer the new message; if it adds to that job, queue again with laptop-job.sh.)"
  fi
  BY=$(printf '%s' "$T" | jq -r '.by // ""'); MM=0; [ "$BY" = "Matthew Sharpe" ] && [ "$(only_matthew "$T")" = 1 ] && MM=1
  [ "$K" = jarvis ] && [ "$MM" != 1 ] && { log "GUARD: desk thread $ID has a writer other than Matthew: left for the laptop"; return 1; }
  M="${HELP_MODEL:-sonnet}"; [ "$MM" = 1 ] && M="${HELP_MODEL_MATTHEW:-opus}"
  RPL="bash traverse/ops/help-reply.sh"; [ "$K" = jarvis ] && RPL="bash assistant/jarvis/tools/jarvis-reply.sh"
  log "$ID: session started ($M, from $BY, $K, cloud)"; SS=$(date +%s)
  PICS=$(get_photos "$T" "$ID"); AUD=$(get_audio "$T" "$ID" "$K")
  if [ "$K" = jarvis ]; then
    PROMPT="A new message in Matthew's J.A.R.V.I.S. desk: his own standalone J.A.R.V.I.S. app, NOT the Sixfold app. Handle it now under the rules in traverse/ops/help-desk-prompt.md, traverse/ops/jarvis-matthew-prompt.md and traverse/ops/jarvis-cloud-prompt.md (all appended to your instructions), and reply with assistant/jarvis/tools/jarvis-reply.sh (answered|working|matthew, refresh, --pdf). Never help-reply.sh for this thread.

Thread (JSON from the server):
$T"
  else
    PROMPT="A new message in the Sixfold app's J.A.R.V.I.S. chat. Handle it now under the rules in traverse/ops/help-desk-prompt.md and traverse/ops/jarvis-cloud-prompt.md (appended to your instructions), and reply with traverse/ops/help-reply.sh.

Ticket (JSON from the server):
$T"
  fi
  [ -n "$PICS" ] && PROMPT="$PROMPT

Photos sent in this conversation, copied to this machine. Look at each one with the Read tool before you answer:
$PICS"
  [ -n "$AUD" ] && PROMPT="$PROMPT

Voice notes sent in this conversation, turned into text on this machine (whisper.cpp; a word here and there may be off). Treat each as if they had typed it:
$AUD"
  [ -n "$JOBNOTE" ] && PROMPT="$PROMPT

$JOBNOTE"
  if write_turn "$ID"; then PROMPT="$PROMPT

(Watcher note: this machine holds the write turn ($WHY). You may change the code, build, commit and deploy here, by the rules in jarvis-cloud-prompt.md.)"; log "$ID: write turn: yes ($WHY)"
  else PROMPT="$PROMPT

(Watcher note: this machine may NOT change the repo, build, commit or deploy now: $WHY. Do what needs only an answer or server work; queue the rest for the laptop with laptop-job.sh, as jarvis-cloud-prompt.md says.)"; log "$ID: write turn: no ($WHY)"; fi
  SYS="$(cat "$WS/traverse/ops/help-desk-prompt.md")"
  [ "$MM" = 1 ] && SYS="$SYS

$(cat "$WS/traverse/ops/jarvis-matthew-prompt.md")"
  [ "$BY" = "Matthew Sharpe" ] && [ "$MM" = 0 ] && PROMPT="$PROMPT

(Watcher note: someone other than Matthew has written in this conversation, so it gets the office limits, not his.)"
  LF="$WS/traverse/ops/jarvis-learned-office.md"; [ "$MM" = 1 ] && LF="$WS/traverse/ops/jarvis-learned.md"
  [ -f "$LF" ] && SYS="$SYS

$(tail -n 150 "$LF")"
  SYS="$SYS

$(cat "$WS/traverse/ops/jarvis-cloud-prompt.md" 2>/dev/null || cat "$OPS/jarvis-cloud-prompt.md")"
  (
    session_env
    # the quick first pass for his messages (no photos): read-only; ANSWER replies at once, HANDOFF sends the "on it" note
    if [ "$MM" = 1 ] && [ -z "$PICS" ] && [ -f "$WS/traverse/ops/jarvis-quick-prompt.md" ] && [ "${JARVIS_QUICK:-1}" = 1 ]; then
      QS=$(date +%s)
      Q=$(cd "$WS" && printf '%s' "$PROMPT" | timeout 90 "$CLAUDE" -p --model "${HELP_MODEL_QUICK:-sonnet}" --tools "Read,Grep,Glob" --permission-mode auto \
          --add-dir "$MEM" --append-system-prompt-file "$WS/traverse/ops/jarvis-quick-prompt.md" --output-format text 2>>"$ST/$ID.quick.err")
      printf '%s\n' "$Q" > "$ST/$ID.quick"
      QH=$(printf '%s\n' "$Q" | sed -n '1{s/[^A-Z]//g;p}'); QT=$(printf '%s\n' "$Q" | sed '1d')
      if [ "$QH" = ANSWER ] && [ -n "$(printf '%s' "$QT" | tr -d '[:space:]')" ]; then
        (cd "$WS" && printf '%s' "$QT" | $RPL "$ID" answered >> "$LOG" 2>&1)
        if final_since "$ID" "$QS" "$K"; then log "$ID: quick pass answered in $(( $(date +%s) - QS )) s"; exit 10; fi
        log "$ID: quick answer did not reach the chat: full session"
      elif [ "$QH" = HANDOFF ] && [ -n "$(printf '%s' "$QT" | tr -d '[:space:]')" ]; then
        (cd "$WS" && printf '%s' "$QT" | $RPL "$ID" working >> "$LOG" 2>&1); log "$ID: quick pass handed off in $(( $(date +%s) - QS )) s"
        PROMPT="$PROMPT

(A quick 'on it' note has already been sent to him. Don't send another progress note unless this will take more than a few minutes.)"
      else log "$ID: quick pass gave no usable answer ($(( $(date +%s) - QS )) s): full session"; fi
    fi
    printf '%s' "$SYS" > "$ST/$ID.sys.md"
    # 23 Nov (Matthew: "I want the jarvis desk session switch over"): his own desk also sees ~/main, where the door data, the editions'
    # codes files and Surge's restricted notes live. Staff tickets (the Sixfold app's chat) never get it.
    local -a XD=(); [ "$K" = jarvis ] && [ "$WRITE" = vm ] && [ -d "$HOME/main" ] && XD=(--add-dir "$HOME/main")
    cd "$WS" && printf '%s' "$PROMPT" | timeout "${JARVIS_SESSION_MAX:-3600}" "$CLAUDE" -p --model "$M" --permission-mode auto --add-dir "$MEM" "${XD[@]}" \
      --append-system-prompt-file "$ST/$ID.sys.md" --output-format text > "$ST/$ID.out" 2>&1
  ); RC=$?
  rm -f "$ST/write-ok"
  capture "$ID" > /dev/null
  [ "$RC" = 10 ] && { DID=1; return 0; }
  # a job this session queued comes first (20 Nov): an answer a few seconds earlier falls inside final_since's 5 s slack and read as "done"
  if [ -f "$OUTBOX/jobs/$ID.json" ] && [ "$(jq -r '.at // 0' "$OUTBOX/jobs/$ID.json")" -ge "$SS" ]; then log "$ID: queued for the laptop (exit $RC)"
  elif final_since "$ID" "$SS" "$K"; then log "$ID: done (exit $RC)"
  else
    if [ "$K" = jarvis ]; then printf "I couldn't finish this one, sir: the session on the cloud machine ended without a final answer (exit %s). I've left it for the laptop; send it again if it's urgent." "$RC" | srv "$JD reply $ID matthew" >> "$LOG" 2>&1
    else printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you." | srv "${TOOLS}help-reply.php $ID matthew" >> "$LOG" 2>&1; fi
    log "$ID: no final reply from the session (exit $RC): passed to Matthew"
  fi
  DID=1
}

# ---- live: a client install's own J.A.R.V.I.S. (the Houston test install): restricted, read-only, as on the laptop ----------------------
jv_prompt() { case "$1" in c-houston-lawn-test) echo "$WS/traverse/ops/jarvis-houston-prompt.md";; *) echo "";; esac; }
one_install() {
  local HI="$1" T ID AUD PF W N CF OUT STL BODY CONV PR STS PICS="" p
  inst_ok "$HI" || return 1; ready || return 0
  sync_workspace || { log "$HI: the repo copy could not be refreshed: nothing taken"; return 0; }
  PF=$(jv_prompt "$HI"); [ -n "$PF" ] && [ -f "$PF" ] || { log "$HI: no prompt file"; return 1; }
  T=$(srv "${TOOLS}help-next.php --install=$HI" < /dev/null 2>>"$LOG") || { log "$HI: server not reachable"; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""'); [[ "$ID" =~ ^$TID$ ]] || { log "$HI: could not read the ticket"; return 1; }
  is_queue_ticket "$T" "$HI" || { log "GUARD: ticket $ID is not from $HI: left untouched"; return 1; }
  CF="$ST/$HI-sessions-$(date +%F).count"; N=$(cat "$CF" 2>/dev/null || echo 0); [[ "$N" =~ ^[0-9]+$ ]] || N=0
  if [ "$N" -ge "${JARVIS_INSTALL_DAY_CAP:-40}" ]; then
    printf "I've answered a great many messages today, so this one goes to Matthew at Traverse. He'll get back to you here." | srv "${TOOLS}help-reply.php $ID matthew --install=$HI" >> "$LOG" 2>&1
    log "$HI $ID: day cap ($N) reached: passed to Matthew"; DID=1; return 0
  fi
  echo $(( N + 1 )) > "$CF"; log "$HI $ID: session started (cloud)"
  W="$ST/inst/$HI/$ID"; rm -rf "$W"; mkdir -p "$W"
  get_photos "$T" "$ID" > /dev/null
  for p in "$ST/photos/$ID"/*; do [ -f "$p" ] && cp "$p" "$W/" && PICS="$PICS
- $(basename "$p")"; done
  AUD=$(get_audio "$T" "$ID" "$HI")
  CONV=$(NAMES=1 conversation "$T" "$ID")
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
  printf '%s' "$BODY" | srv "${TOOLS}help-reply.php $ID $STS --install=$HI" >> "$LOG" 2>&1
  log "$HI $ID: done ($STS)"; DID=1
}

# ---- live: the apps' own J.A.R.V.I.S. (21 Nov, TASKS JV-APPS): the laptop's one_app (help-watch.sh explains), ported ----------------------
#  peak and the installs in FULL: a working session like the office's (the cloud's write-turn rules for repo work); posts: the restricted session
#  whose only tool is ./jv-posts.sh (jv.php posts act as the writer). Matthew's own conversations: his treatment (opus, jarvis-matthew-prompt.md).
app_prompt() { case "$1" in peak) echo "$WS/traverse/ops/jarvis-peak-prompt.md";; posts) echo "$WS/traverse/ops/jarvis-posts-prompt.md";; c-houston-lawn-test) echo "$WS/traverse/ops/jarvis-houston-prompt.md";; *) echo "";; esac; }
app_name() { case "$1" in peak) echo "the Peak Sponsor Desk";; posts) echo "the post calendar";; c-houston-lawn-test) echo "the Houston Lawn (test) install of Traverse";; *) echo "$1";; esac; }
app_learned() { case "$1" in peak) echo "$WS/traverse/ops/jarvis-learned-peak.md";; posts) echo "$WS/traverse/ops/jarvis-learned-posts.md";; c-*) echo "$WS/traverse/ops/jarvis-learned-houston.md";; esac; }
full_ok() { local x; for x in $FULL; do [ "$1" = "$x" ] && return 0; done; return 1; }
app_reply() {   # app_reply <queue> <id> <answered|matthew> [refresh] < text: the watcher's own reply (its alert to Matthew through jarvis-status.sh)
  local Q="$1" ID="$2" S="$3" RF="${4:-}" TXT; TXT=$(cat)
  if [[ "$Q" == c-* ]]; then printf '%s' "$TXT" | srv "${TOOLS}help-reply.php $ID $S --install=$Q" >> "$LOG" 2>&1
  else printf '%s' "$TXT" | srv "$JV $Q reply $ID $S${RF:+ $RF}" >> "$LOG" 2>&1; fi
  [ "$S" = matthew ] && ( session_env; cd "$WS" && bash assistant/jarvis/tools/jarvis-status.sh alert "J.A.R.V.I.S. ($(app_name "$Q") chat, $ID) passed this to you: $(printf '%s' "$TXT" | tr -s '\r\n\t ' ' ' | cut -c1-300)" ) > /dev/null 2>&1
  return 0
}
one_app() {
  local Q="$1" T ID BY MM=0 CF N PF M PICS AUD PROMPT SYS LF SS RC
  app_ok "$Q" || { inst_ok "$Q" && full_ok "$Q"; } || return 1; ready || return 0
  sync_workspace || { log "$Q: the repo copy could not be refreshed: nothing taken"; sleep 30; return 0; }
  PF=$(app_prompt "$Q"); [ -n "$PF" ] && [ -f "$PF" ] || { log "$Q: no prompt file"; return 1; }
  if [[ "$Q" == c-* ]]; then T=$(srv "${TOOLS}help-next.php --install=$Q" < /dev/null 2>>"$LOG"); else T=$(srv "$JV $Q next" < /dev/null 2>>"$LOG"); fi || { log "$Q: server not reachable"; sleep 25; return 0; }
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""' 2>/dev/null); [[ "$ID" =~ ^$TID$ ]] || { log "$Q: could not read the ticket"; return 1; }
  is_queue_ticket "$T" "$Q" || { log "GUARD: ticket $ID is not from $Q: left untouched"; return 1; }
  mkdir -p "$ST/cur"; printf '%s' "$T" > "$ST/cur/$ID.json"
  BY=$(printf '%s' "$T" | jq -r '.by // ""'); [ "$BY" = "Matthew Sharpe" ] && [ "$(only_matthew "$T")" = 1 ] && MM=1
  if [ "$MM" = 0 ]; then
    CF="$ST/$Q-sessions-$(date +%F).count"; N=$(cat "$CF" 2>/dev/null || echo 0); [[ "$N" =~ ^[0-9]+$ ]] || N=0
    if [ "$N" -ge "${JARVIS_APP_DAY_CAP:-40}" ]; then
      printf "I've handled a great many messages today, so this one goes to Matthew. He'll get back to you here." | app_reply "$Q" "$ID" matthew
      log "$Q $ID: day cap ($N) reached: passed to Matthew"; DID=1; return 0
    fi
    echo $(( N + 1 )) > "$CF"
  fi
  SS=$(date +%s); PICS=$(get_photos "$T" "$ID"); AUD=$(get_audio "$T" "$ID" "$Q")
  if [ "$Q" = posts ] && [ "$MM" = 0 ]; then posts_session "$T" "$ID" "$PF" "$AUD"; DID=1; return 0; fi
  M="${HELP_MODEL:-sonnet}"; [ "$MM" = 1 ] && M="${HELP_MODEL_MATTHEW:-opus}"
  log "$Q $ID: session started ($M, from $BY, cloud)"
  PROMPT="A new message in the J.A.R.V.I.S. chat of $(app_name "$Q") (queue $Q). Handle it now under the rules appended to your instructions, and reply with:
  bash traverse/ops/jv-reply.sh $Q $ID <answered|working|matthew> [refresh] [--pdf <file.pdf>] <<'EOF'
  ...
  EOF
Never help-reply.sh or jarvis-reply.sh for this chat.

Ticket (JSON from the server):
$T"
  [ -n "$PICS" ] && PROMPT="$PROMPT

Photos sent in this conversation, copied to this machine. Look at each one with the Read tool before you answer:
$PICS"
  [ -n "$AUD" ] && PROMPT="$PROMPT

Voice notes sent in this conversation, turned into text on this machine (whisper.cpp; a word here and there may be off). Treat each as if they had typed it:
$AUD"
  if write_turn "$ID"; then PROMPT="$PROMPT

(Watcher note: this machine holds the write turn ($WHY). You may change the code, test, commit and deploy here, by the rules in jarvis-cloud-prompt.md.)"
  else PROMPT="$PROMPT

(Watcher note: this machine may NOT change the repo, build, commit or deploy now: $WHY. Do what needs only an answer or server work (the app's data); queue code changes for the laptop with laptop-job.sh, as jarvis-cloud-prompt.md says.)"; fi
  SYS="$(cat "$PF")"
  # the post calendar's rules are for the restricted session; Matthew's own chat there is a working session (21 Nov)
  [ "$Q" = posts ] && [ "$MM" = 1 ] && SYS="This message came from the post calendar's J.A.R.V.I.S. chat (traverse/post-calendar/README.md). You are a working session for Matthew, not the restricted one: reply with jv-reply.sh as the prompt says. Approving a post stays his own tap, and the Surge posts stay on hold."
  if [ "$MM" = 1 ]; then SYS="$SYS

$(cat "$WS/traverse/ops/jarvis-matthew-prompt.md" 2>/dev/null)"; LF="$WS/traverse/ops/jarvis-learned.md"
    PROMPT="$PROMPT

(Watcher note: every message here is Matthew's own, so none of this app's limits apply to him: his standing rules (CLAUDE.md, memory) do.)"
  else LF=$(app_learned "$Q"); [ "$BY" = "Matthew Sharpe" ] && PROMPT="$PROMPT

(Watcher note: someone other than Matthew has written in this conversation, so it gets this app's limits, not his.)"; fi
  [ -f "$LF" ] && SYS="$SYS

$(tail -n 150 "$LF")"
  SYS="$SYS

$(cat "$WS/traverse/ops/jarvis-cloud-prompt.md" 2>/dev/null || cat "$OPS/jarvis-cloud-prompt.md")"
  printf '%s' "$SYS" > "$ST/$ID.sys.md"
  ( session_env; cd "$WS" && printf '%s' "$PROMPT" | timeout "${JARVIS_SESSION_MAX:-3600}" "$CLAUDE" -p --model "$M" --permission-mode auto --add-dir "$MEM" \
      --append-system-prompt-file "$ST/$ID.sys.md" --output-format text > "$ST/$ID.out" 2>&1 ); RC=$?
  rm -f "$ST/write-ok"; capture "$ID" > /dev/null
  if [ -f "$OUTBOX/jobs/$ID.json" ] && [ "$(jq -r '.at // 0' "$OUTBOX/jobs/$ID.json")" -ge "$SS" ]; then log "$Q $ID: queued for the laptop (exit $RC)"
  elif final_since "$ID" "$SS" "$Q"; then log "$Q $ID: done (exit $RC)"
  else printf "I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you here." | app_reply "$Q" "$ID" matthew
    log "$Q $ID: no final reply from the session (exit $RC): passed to Matthew"; fi
  DID=1
}
posts_session() {   # the post calendar's restricted session (help-watch.sh run_posts): ./jv-posts.sh is its only tool
  local T="$1" ID="$2" PF="$3" AUD="$4" W OUT STL BODY STS RF="" CONV PR p PICS="" JVT='\$HOME/www/traverseplatforms.com/jv-tools/jv.php'
  W="$ST/jvposts/$ID"; rm -rf "$W"; mkdir -p "$W"
  for p in "$ST/photos/$ID"/*; do [ -f "$p" ] && cp "$p" "$W/" && PICS="$PICS
- $(basename "$p")"; done
  cat > "$W/jv-posts.sh" <<EOF
#!/bin/bash
# The post calendar J.A.R.V.I.S.'s one tool for ticket $ID (made by help-watch-cloud.sh). jv-tools/jv.php posts act, as the person who wrote.
set -u
cd "\$(dirname "\$0")"
case "\${1:-}" in list|show|edit|date|undate|photo) ;; *) echo "use: list [client] | show <post> | edit <post> <fb|ig|li|li_comment> <words.txt> | date <post> <YYYY-MM-DD> <HH:MM> | undate <post> | photo <post> <photo> [index]"; exit 2;; esac
for a in "\$@"; do [[ "\$a" =~ ^[A-Za-z0-9._:-]{0,60}\$ ]] || { echo "bad argument: \$a"; exit 2; }; done
if [ "\$1" = edit ]; then
  F="\${4:-}"; [[ "\$F" =~ ^[A-Za-z0-9._-]+\.txt\$ ]] && [ -f "\$F" ] || { echo "write the words to a .txt file in this folder first, then: edit <post> <fb|ig|li|li_comment> <file.txt>"; exit 2; }
  bash $BIN/sg.sh trav "php $JVT posts act $ID edit '\$2' '\$3'" < "\$F"; RC=\$?
else bash $BIN/sg.sh trav "php $JVT posts act $ID \$*" < /dev/null; RC=\$?; fi
case "\$1" in edit|date|undate|photo) [ "\$RC" = 0 ] && touch changed;; esac
exit \$RC
EOF
  CONV=$(NAMES=1 conversation "$T" "$ID")
  PR="The person writing: $(printf '%s' "$T" | jq -r '"\(.by) (\(.role // ""))"')

The chat so far (answer the last message):

$CONV"
  [ -n "$PICS" ] && PR="$PR

Photos in this conversation, in your working folder (open each with Read; a photo can go on a post with ./jv-posts.sh photo):$PICS"
  [ -n "$AUD" ] && PR="$PR

Voice notes, turned into text:
$AUD"
  log "posts $ID: session started (restricted, cloud)"
  OUT=$(cd "$W" && printf '%s' "$PR" | timeout 600 "$CLAUDE" -p --restricted --tools "Read,Write,Bash" --allowedTools "Bash(bash jv-posts.sh *)" "Bash(bash ./jv-posts.sh *)" "Edit(./*.txt)" \
        --strict-mcp-config --setting-sources project --permission-mode dontAsk --model "${HELP_MODEL_INSTALL:-sonnet}" --system-prompt-file "$PF" --output-format text 2>>"$ST/posts-$ID.err")
  printf '%s' "$OUT" > "$ST/posts-$ID.out"
  STL=$(printf '%s\n' "$OUT" | sed -n '1p' | tr -d '\r'); BODY=$(printf '%s\n' "$OUT" | sed '1d' | sed -e '/./,$!d')
  STS=answered; case "$STL" in *STATUS:*matthew*|*STATUS:*MATTHEW*) STS=matthew;; *STATUS:*) ;; *) BODY="$OUT";; esac
  if [ -z "$(printf '%s' "$BODY" | tr -d '[:space:]')" ]; then STS=matthew; BODY="I couldn't finish looking into this one, so I've passed it to Matthew. He'll get back to you here."; fi
  [ -f "$W/changed" ] && RF=refresh
  printf '%s' "$BODY" | app_reply posts "$ID" "$STS" $RF
  log "posts $ID: done ($STS${RF:+, changed a post})"
}

# ---- shadow: what it WOULD do, logged; nothing taken, nothing posted ---------------------------------------------------------------------
# One row a ticket version (queue, id, messages) in shadow/shadow.tsv:
#   <unix seen> <queue> <id> <messages> <writer: matthew|office|install> <would: model + quick pass> <how it saw it: stream|https|ssh>
#   <may it change the repo now: yes|no (why)|n/a>
# For his own messages (and only when signed in) the read-only quick pass runs too, its answer kept in shadow/<id>-<n>.quick, never sent.
declare -A SEEN
shadow_look() {   # shadow_look <staff|jarvis|c-slug> <how>
  local K="$1" HOW="$2" T ID N BY MM W WHAT QF QS Q
  case "$K" in jarvis) T=$(srv "$JD next --peek" < /dev/null 2>>"$LOG");; peak|posts) T=$(srv "$JV $K next --peek" < /dev/null 2>>"$LOG");; staff) T=$(srv "${TOOLS}help-next.php --peek" < /dev/null 2>>"$LOG");; *) T=$(srv "${TOOLS}help-next.php --peek --install=$K" < /dev/null 2>>"$LOG");; esac || return 0
  [ -n "$T" ] || return 0
  ID=$(printf '%s' "$T" | jq -r '.id // ""' 2>/dev/null); [[ "$ID" =~ ^$TID$ ]] || return 0
  N=$(printf '%s' "$T" | jq '.conversation | length' 2>/dev/null); [[ "$N" =~ ^[0-9]+$ ]] || N=0
  [ -n "${SEEN[$K:$ID:$N]:-}" ] && return 0; SEEN[$K:$ID:$N]=1
  grep -qF "$(printf '\t%s\t%s\t%s\t' "$K" "$ID" "$N")" "$ST/shadow/shadow.tsv" 2>/dev/null && return 0   # seen before a restart (20 Nov)
  BY=$(printf '%s' "$T" | jq -r '.by // ""'); MM=0; [ "$BY" = "Matthew Sharpe" ] && [ "$(only_matthew "$T")" = 1 ] && MM=1
  case "$K" in posts) W=app; [ "$MM" = 1 ] && WHAT="opus working session" || WHAT="restricted posts session (sonnet)";; peak) W=app; [ "$MM" = 1 ] && WHAT="opus working session" || WHAT="working session (sonnet)";; c-*) W=install; if full_ok "$K"; then WHAT="working session (sonnet), that install's data"; else WHAT="restricted read-only session (sonnet)"; fi;; *) if [ "$MM" = 1 ]; then W=matthew; WHAT="quick pass then opus"; else W=office; WHAT="office session (sonnet)"; fi;; esac
  local WT=no; case "$K" in c-*) WT=n/a;; *) ws_ok && write_turn "$ID" && WT=yes; rm -f "$ST/write-ok";; esac
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "$K" "$ID" "$N" "$W" "$WHAT" "$HOW" "$WT${WHY:+ ($WHY)}" >> "$ST/shadow/shadow.tsv"
  log "SHADOW: would take $K $ID (message $N, $W): $WHAT; may change the repo: $WT${WHY:+ ($WHY)}"
  if [ "$MM" = 1 ] && [ "${SHADOW_QUICK:-1}" = 1 ] && signed_in && ws_ok && [ -f "$WS/traverse/ops/jarvis-quick-prompt.md" ] \
     && [ "$(printf '%s' "$T" | jq '[.conversation[] | (.photos // []) | length] | add // 0')" = 0 ]; then
    QF="$ST/shadow/$ID-$N.quick"; QS=$(date +%s)
    sync_workspace > /dev/null 2>&1
    Q=$(cd "$WS" && printf '%s' "A new message ($K). Thread (JSON from the server):
$T" | timeout 90 "$CLAUDE" -p --model "${HELP_MODEL_QUICK:-sonnet}" --tools "Read,Grep,Glob" --permission-mode dontAsk --add-dir "$MEM" \
        --append-system-prompt-file "$WS/traverse/ops/jarvis-quick-prompt.md" --output-format text 2>>"$ST/shadow/quick.err")
    { echo "# shadow quick pass for $K $ID message $N, $(( $(date +%s) - QS )) s, NOT sent"; printf '%s\n' "$Q"; } > "$QF"
    log "SHADOW: quick pass for $ID: $(printf '%s' "$Q" | head -1 | tr -cd 'A-Z') in $(( $(date +%s) - QS )) s (kept, not sent)"
  fi
}

# ---- the desk count: one open SSH connection prints it every 5 s (no laptop key on this machine) ----------------------------------------
JFAIL=0
jstream_open() { coproc JS { srv "$JSTREAM" < /dev/null 2>>"$LOG"; }; }
jstream_close() { [ -n "${JS_PID:-}" ] && kill "$JS_PID" 2>/dev/null; wait "${JS_PID:-}" 2>/dev/null; unset JS_PID; }
jcount() {   # tests: from JARVIS_TEST_COUNTS
  [ -n "${JARVIS_TEST_COUNTS:-}" ] && { tcount J; return 0; }
  # prints the desk's waiting count, or nothing
  local line="" x fd
  if [ "$JFAIL" -lt 3 ]; then
    { [ -n "${JS_PID:-}" ] && kill -0 "$JS_PID" 2>/dev/null; } || { jstream_close; [ "$JFAIL" -gt 0 ] && sleep 10; jstream_open; }
    fd="${JS[0]:-}"
    if [ -n "$fd" ] && read -r -t 20 -u "$fd" line; then while read -r -t 0.2 -u "$fd" x; do line="$x"; done; fi
    if [[ "$line" =~ ^[0-9]+$ ]]; then JFAIL=0; echo "$line"; return 0; fi
    JFAIL=$(( JFAIL + 1 )); jstream_close; [ "$JFAIL" = 3 ] && log "desk count: the open SSH connection keeps dropping: a fresh SSH count every 30 s"
  fi
  JN=$(( ${JN:-0} + 1 )); [ $(( JN % 6 )) = 1 ] || return 0
  line=$(srv "$JD count" < /dev/null 2>/dev/null | tr -d '\r\n'); [[ "$line" =~ ^[0-9]+$ ]] && echo "$line"
}
tcount() { local x; for x in ${JARVIS_TEST_COUNTS:-}; do [ "${x%%=*}" = "$1" ] && { echo "${x#*=}"; return 0; }; done; echo 0; }   # tests: "L=1 J=0 P=0 c-houston-lawn-test=0"
hcount() { if [ -n "${JARVIS_TEST_COUNTS:-}" ]; then case "$1" in "") tcount L;; "&p=1") tcount P;; "&a="*) tcount "${1#&a=}";; *) tcount "${1#&i=}";; esac; return 0; fi; local n; n=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK$1" 2>/dev/null); [[ "$n" =~ ^[0-9]+$ ]] && echo "$n"; }

# ---- test modes -------------------------------------------------------------------------------------------------------------------------
guard_test() {
  local ok=0 c m X='h20261111120000abcd' A='a1762900000abcdef.webm' P='p1762900000abcdef.jpg'
  local LD='/home/x/www/traverseplatforms.com/sixfold-data/rounds/help-files' PD='/home/x/www/traverseplatforms.com/sixfold-practice-data/rounds/help-files'
  local DD='/home/x/www/traverseplatforms.com/assistant-private/data/jarvis/desk/files' HD='/home/x/www/traverseplatforms.com/c-houston-lawn-test-data/rounds/help-files'
  local KD='/home/x/www/traverseplatforms.com/peak-desk-data/jarvis/help-files' OD='/home/x/www/traverseplatforms.com/post-calendar-data/jarvis/help-files'
  # refused in EVERY mode
  local -a NEVER=("rm -rf \$HOME" "scp x y" "${TOOLS}help-next.php --practice; ${TOOLS}help-next.php" "${TOOLS}help-next.php --practice && cat /etc/passwd"
    "${TOOLS}help-next.php --practice"$'\n'"${TOOLS}help-next.php" "${TOOLS}help-attach.php $X 'x.pdf'" "${TOOLS}help-next.php --peek --install=c-other-co"
    "${TOOLS}help-next.php --install=c-other-co" "${TOOLS}help-reply.php $X working" "${TOOLS}help-reply.php $X answered refresh"
    "${TOOLS}help-reply.php $X answered file=x.pdf" "${TOOLS}help-reply.php $X answered extra" " ${TOOLS}help-next.php --peek" "${TOOLS}help-next.php  --peek"
    "${TOOLS}../sixfold-tools/help-next.php --peek" "${TOOLS}help-next.php --peek #" "$JD import" "$JD setkey" "$JD reply $X working" "$JD attach $X x.pdf"
    "$JD next --peek extra" "cat '$PD/../../../sixfold-data/rounds/help-files/$X/$A'" "cat '/home/x/sixfold-data/rounds/help.log'" "cat '$LD/$X/$A' '$LD/$X/$P'"
    "cat '$LD/$X/x.php'" "cat '$DD/$X/x.pdf'" "cat '/home/x/www/traverseplatforms.com/c-other-co-data/rounds/help-files/$X/$A'" "grep '\"id\":\"$X\"' /etc/passwd"
    "grep '\"id\":\"$X\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log | head" "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-next.php --peek \$(id)"
    "$BEATCMD; id" "$BEATCMD && id" "${JSTREAM}; id" "cat > \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log" "$JD final-since $X 1 ; id"
    "${TOOLS}help-transcript.php $X a1762900000abcdef.exe" "${TOOLS}help-next.php --peek --practice --live"
    "$JV peak reply $X working" "$JV peak act $X list" "$JV posts act $X edit p0123456789 fb" "$JV other next" "$JV peak attach $X x.pdf" "$JV posts reply $X answered extra"
    "$JV peak next; id" "$JV peak count && id" "cat '$KD/../desk.sqlite'" "cat '/home/x/www/traverseplatforms.com/peak-desk-data/accounts.json'" "cat '$KD/$X/x.pdf'"
    "grep '\"id\":\"$X\"' \$HOME/www/traverseplatforms.com/c-other-co-data/rounds/help.log" "$JV peak final-since $X 1 ; id")   # + the apps (21 Nov)
  # allowed in shadow (and live): looking only, and the practice copy
  local -a SHADOW=("${TOOLS}help-next.php --peek" "${TOOLS}help-next.php --peek --install=c-houston-lawn-test" "$JD next --peek" "$JD count" "$BEATCMD" "$JSTREAM" "$LAPCMD"
    "${TOOLS}help-next.php --practice" "${TOOLS}help-next.php --peek --practice" "${TOOLS}help-reply.php $X answered --practice"
    "${TOOLS}help-transcript.php $X $A --practice" "cat '$PD/$X/$A'" "$JV peak next --peek" "$JV posts next --peek" "$JV peak count" "$JV posts count")
  # allowed in live ONLY (each must be refused in shadow and practice)
  local -a LIVE=("${TOOLS}help-next.php" "${TOOLS}help-next.php --install=c-houston-lawn-test" "${TOOLS}help-reply.php $X answered" "${TOOLS}help-reply.php $X matthew"
    "${TOOLS}help-reply.php $X answered --install=c-houston-lawn-test" "${TOOLS}help-transcript.php $X $A" "${TOOLS}help-transcript.php $X $A --failed"
    "${TOOLS}help-transcript.php $X $A --install=c-houston-lawn-test" "$JD next" "$JD transcript $X $A" "$JD reply $X matthew" "$JD final-since $X 1763500000"
    "grep '\"id\":\"$X\"' \$HOME/www/traverseplatforms.com/sixfold-data/rounds/help.log" "cat '$LD/$X/$A'" "cat '$LD/$X/$P'" "cat '$DD/$X/$P'" "cat '$HD/$X/$A'"
    "$JV peak next" "$JV posts next" "$JV peak reply $X matthew" "$JV posts reply $X answered refresh" "$JV posts reply $X answered" "$JV peak transcript $X $A" "$JV posts transcript $X $A --failed"
    "$JV peak final-since $X 1763500000" "cat '$KD/$X/$P'" "cat '$OD/$X/$A'" "grep '\"id\":\"$X\"' \$HOME/www/traverseplatforms.com/c-houston-lawn-test-data/rounds/help.log")
  for m in practice shadow live off; do
    for c in "${NEVER[@]}"; do if allowed "$c" "$m"; then echo "FAIL ($m let through): $(printf '%s' "$c" | tr '\n' ' ')"; ok=1; else echo "PASS ($m) refused: $(printf '%s' "$c" | tr '\n' ' ' | cut -c1-110)"; fi; done
  done
  for c in "${SHADOW[@]}"; do
    if [[ "$c" == *practice* ]] || [[ "$c" == *sixfold-practice-data* ]]; then
      for m in practice shadow live; do allowed "$c" "$m" && echo "PASS ($m) allowed: ${c:0:110}" || { echo "FAIL ($m refused a practice command): $c"; ok=1; }; done
    else
      for m in shadow live; do allowed "$c" "$m" && echo "PASS ($m) allowed: ${c:0:110}" || { echo "FAIL ($m refused a look): $c"; ok=1; }; done
      if [ "$c" = "$BEATCMD" ]; then allowed "$c" practice && echo "PASS (practice) allowed: the beat" || { echo "FAIL (practice refused the beat)"; ok=1; }
      else allowed "$c" practice && { echo "FAIL (practice let a live look through): $c"; ok=1; } || echo "PASS (practice) refused: ${c:0:110}"; fi
    fi
    allowed "$c" off && { echo "FAIL (off let through): $c"; ok=1; } || echo "PASS (off) refused: ${c:0:60}"
  done
  for c in "${LIVE[@]}"; do
    allowed "$c" live && echo "PASS (live) allowed: ${c:0:110}" || { echo "FAIL (live refused): $c"; ok=1; }
    for m in shadow practice off; do allowed "$c" "$m" && { echo "FAIL ($m let a live command through): $c"; ok=1; } || echo "PASS ($m) refused: ${c:0:110}"; done
  done
  local L="{\"id\":\"$X\",\"photoDir\":\"$LD/$X\",\"audioDir\":\"$LD/$X\"}" PR="{\"id\":\"$X\",\"photoDir\":\"$PD/$X\",\"audioDir\":\"$PD/$X\"}"
  local D="{\"id\":\"$X\",\"desk\":\"jarvis\",\"photoDir\":\"$DD/$X\",\"audioDir\":\"$DD/$X\"}" DN="{\"id\":\"$X\",\"photoDir\":\"$DD/$X\",\"audioDir\":\"$DD/$X\"}"
  local H="{\"id\":\"$X\",\"photoDir\":\"$HD/$X\",\"audioDir\":\"$HD/$X\"}"
  is_practice_ticket "$L" && { echo "FAIL: a live ticket passed the practice check"; ok=1; } || echo "PASS live ticket rejected by the practice check"
  is_practice_ticket "$PR" && echo "PASS practice ticket accepted" || { echo "FAIL: a practice ticket was rejected"; ok=1; }
  is_queue_ticket "$L" staff && echo "PASS staff ticket accepted as staff" || { echo "FAIL: staff ticket rejected"; ok=1; }
  is_queue_ticket "$PR" staff && { echo "FAIL: practice ticket taken as staff"; ok=1; } || echo "PASS practice ticket not staff"
  is_queue_ticket "$D" jarvis && echo "PASS desk thread accepted as desk" || { echo "FAIL: desk thread rejected"; ok=1; }
  is_queue_ticket "$DN" jarvis && { echo "FAIL: a thread without desk:jarvis passed"; ok=1; } || echo "PASS thread without desk:jarvis rejected"
  is_queue_ticket "$L" jarvis && { echo "FAIL: staff ticket taken as desk"; ok=1; } || echo "PASS staff ticket not desk"
  is_queue_ticket "$H" c-houston-lawn-test && echo "PASS install ticket accepted" || { echo "FAIL: install ticket rejected"; ok=1; }
  is_queue_ticket "$L" c-houston-lawn-test && { echo "FAIL: staff ticket taken as install"; ok=1; } || echo "PASS staff ticket not install"
  local K="{\"id\":\"$X\",\"app\":\"peak\",\"photoDir\":\"$KD/$X\",\"audioDir\":\"$KD/$X\"}" O="{\"id\":\"$X\",\"app\":\"posts\",\"photoDir\":\"$OD/$X\",\"audioDir\":\"$OD/$X\"}"
  is_queue_ticket "$K" peak && echo "PASS Peak ticket accepted" || { echo "FAIL: Peak ticket rejected"; ok=1; }
  is_queue_ticket "$O" posts && echo "PASS post calendar ticket accepted" || { echo "FAIL: post calendar ticket rejected"; ok=1; }
  is_queue_ticket "$K" posts && { echo "FAIL: Peak ticket taken as posts"; ok=1; } || echo "PASS Peak ticket not posts"
  is_queue_ticket "$L" peak && { echo "FAIL: staff ticket taken as Peak"; ok=1; } || echo "PASS staff ticket not Peak"
  [ "$ok" = 0 ] && echo "guard: all PASS" || echo "guard: FAILURES above"
  return "$ok"
}
check() {
  echo "mode: $MODE$( [ -f "$ST/pause" ] && echo ' (PAUSED: rm ~/jarvis/state/pause)')"
  [ "$WRITE" = vm ] && echo "write: vm (this machine is the main workspace; commits go straight into ~/jarvis/repo.git main)" || echo "write: laptop (the laptop's history is the truth; write turn only while it is away)"
  [ -f "$ST/stuck" ] && echo "STUCK: cloud commits kept as stuck-* branches in ~/workspace; no repo changes until a session sorts it out (rm ~/jarvis/state/stuck after)"
  echo "poll key: $([ -n "$KEY" ] && echo present || echo MISSING)"
  local N; N=$(curl -s -m 8 -A "jarvis-watch/1.0" "$CHECK&p=1" 2>/dev/null); echo "HTTPS practice count: ${N:0:40}"
  if srv "${TOOLS}help-next.php --peek --practice" < /dev/null > /dev/null 2>"$ST/check.err"; then echo "SSH to the server: OK"; else echo "SSH to the server: NOT YET ($(tr -d '\r\n' < "$ST/check.err" | cut -c1-100))"; fi
  signed_in && echo "Claude Code: signed in" || echo "Claude Code: NOT signed in ($("$CLAUDE" --version 2>/dev/null || echo missing))"
  command -v ffmpeg > /dev/null && echo "ffmpeg: $(ffmpeg -version | head -1 | cut -d' ' -f1-3)" || echo "ffmpeg: missing"
  [ -x "$WC" ] && [ -f "$WM" ] && echo "whisper.cpp: OK ($(basename "$WM"))" || echo "whisper.cpp: missing"
  ws_ok && echo "repo copy: $(git -C "$WS" log -1 --format='%h %cd' --date=format:'%d %b %H:%M' 2>/dev/null) (laptop: $(cut -d' ' -f1,2 "$INC/laptop-head.txt" 2>/dev/null | head -1))" || echo "repo copy: NOT YET (bash traverse/ops/jarvis-cloud-sync.sh push on the laptop)"
  [ -f "$MEM/MEMORY.md" ] && echo "memory: $(ls "$MEM" | wc -l) files" || echo "memory: NOT YET"
  echo "for the laptop: $(pending_bundles | wc -l) change bundle(s), $(find "$OUTBOX/jobs" -name 'h*.json' | wc -l) job(s)"
  [ -s "$ST/beat-sent" ] && echo "beat: sent $(( $(date +%s) - $(cat "$ST/beat-sent") )) s ago" || echo "beat: not sent yet (needs SSH)"
  [ -s "$ST/shadow/shadow.tsv" ] && echo "shadow: $(wc -l < "$ST/shadow/shadow.tsv") ticket(s) seen since $(date -d "@$(head -1 "$ST/shadow/shadow.tsv" | cut -f1)" '+%d %b %H:%M')"
  guard_test > /dev/null && echo "guard: all PASS" || echo "guard: FAILED (run --guard-test)"
  systemctl --user is-active jarvis-cloud.service 2>/dev/null | sed 's/^/service: /'
}
show_run() {   # practice dry run
  local T="$1" ID CONV
  ID=$(printf '%s' "$T" | jq -r '.id // ""'); echo "ticket: $ID (by $(printf '%s' "$T" | jq -r '.by // ""'))"
  is_practice_ticket "$T" && echo "practice check: PASS" || { echo "practice check: FAIL, the loop would leave it untouched"; return 1; }
  get_audio "$T" "$ID" practice > /dev/null
  CONV=$(conversation "$T" "$ID")
  echo "--- conversation the session would get ---"; printf '%s\n' "$CONV"
  echo "--- then: printf '<reply>' | ${TOOLS}help-reply.php $ID answered --practice"
  if [ "${RUN:-0}" = 1 ]; then
    signed_in || { echo "(--run skipped: Claude Code is not signed in yet)"; return 0; }
    local t0; t0=$(date +%s); echo "--- the session's reply (not posted) ---"; practice_session "$CONV"; echo; echo "(session took $(( $(date +%s) - t0 )) s)"
  fi
}

case "${1:-}" in
  --transcribe) TEST=1; transcribe "${2:?file}" && echo; exit $?;;
  --guard-test) guard_test; exit $?;;
  --check) check; exit 0;;
  --mode) echo "$MODE"; exit 0;;
  --capture) capture "${2:-manual}"; exit 0;;           # tests and by hand
  --sync-workspace) sync_workspace; exit $?;;
  --peek) TEST=1
          for q in staff jarvis practice $INSTALLS $APPS; do
            case "$q" in staff) c="${TOOLS}help-next.php --peek";; jarvis) c="$JD next --peek";; peak|posts) c="$JV $q next --peek";; practice) c="${TOOLS}help-next.php --peek --practice";; *) c="${TOOLS}help-next.php --peek --install=$q";; esac
            T=$(srv "$c" < /dev/null 2>/dev/null) || { echo "$q: server not reachable"; continue; }
            [ -n "$T" ] && echo "$q: $(printf '%s' "$T" | jq -r '"\(.id) (\(.conversation|length) messages, by \(.by))"')" || echo "$q: nothing waiting"
          done; exit 0;;
  --test-ticket) TEST=2; [ "${3:-}" = --run ] && RUN=1; show_run "$(cat "${2:?ticket.json}")"; exit $?;;
  --once) ;;   # tests: one round of the loop, then exit
  "") ;;
  *) echo "unknown option: $1"; exit 2;;
esac

# ---- the loop (the service) -------------------------------------------------------------------------------------------------------------
exec 9> "$ST/watch.lock"; flock -n 9 || { echo "another copy is running"; exit 0; }
log "cloud watcher started ($MODE mode)"
[ "$MODE" = off ] && { log "mode off: nothing is looked at"; while [ "${1:-}" != --once ]; do sleep 300; done; exit 0; }
ready || true
[ "${1:-}" = --once ] || { beat_loop $$ < /dev/null > /dev/null 2>&1 & }
MISS=0; BAD=0
take() { "$@"; if [ "$DID" = 1 ]; then MISS=0; else MISS=$(( MISS + 1 )); sleep $(( MISS > 12 ? 60 : MISS * 5 )); fi; DID=0; }
while true; do
  [ "${1:-}" = --once ] && [ "${ROUND:-0}" -ge 1 ] && break; ROUND=$(( ${ROUND:-0} + 1 ))
  if [ -f "$ST/pause" ]; then sleep 5; continue; fi
  P=$(hcount "&p=1"); L=""; H=""; JC=""; HOW=https
  if [ "$MODE" != practice ]; then L=$(hcount ""); JC=$(jcount); for HI in $INSTALLS; do H="$H $HI:$(hcount "&i=$HI")"; done; for A in $APPS; do H="$H $A:$(hcount "&a=$A")"; done; fi   # + the apps (21 Nov)
  if [ -z "$P" ] || { [ "$MODE" != practice ] && [ -z "$L" ]; }; then
    BAD=$(( BAD + 1 ))
    if [ "$BAD" -ge 3 ]; then   # HTTPS captcha'd or down: a fresh SSH look every 30 s
      [ "$BAD" = 3 ] && log "https check is not answering a number: looking over SSH every 30 s"
      HOW=ssh; P=$(srv "${TOOLS}help-next.php --peek --practice" < /dev/null 2>/dev/null | grep -c '"waiting"')
      [ "$MODE" != practice ] && { L=$(srv "${TOOLS}help-next.php --peek" < /dev/null 2>/dev/null | grep -c '"waiting"'); H=""; for HI in $INSTALLS; do H="$H $HI:$(srv "${TOOLS}help-next.php --peek --install=$HI" < /dev/null 2>/dev/null | grep -c '"waiting"')"; done; for A in $APPS; do H="$H $A:$(srv "$JV $A count" < /dev/null 2>/dev/null | tr -cd '0-9')"; done; }
      sleep 25
    fi
  else [ "$BAD" -ge 3 ] && log "https check answers again"; BAD=0; fi
  case "$MODE" in
    live)
      if [[ "${L:-0}" =~ ^[1-9] ]]; then take one_ticket staff; continue; fi
      if [[ "${JC:-0}" =~ ^[1-9] ]]; then take one_ticket jarvis; continue; fi
      if [[ "${P:-0}" =~ ^[1-9] ]]; then take one_practice; continue; fi
      HIT=""; for x in $H; do [[ "${x#*:}" =~ ^[1-9] ]] && { q="${x%%:*}"; if app_ok "$q" || full_ok "$q"; then take one_app "$q"; else take one_install "$q"; fi; HIT=1; break; }; done; [ -n "$HIT" ] && continue;;   # installs, then the apps (21 Nov)
    shadow)
      [[ "${L:-0}" =~ ^[1-9] ]] && shadow_look staff "$HOW"
      [[ "${JC:-0}" =~ ^[1-9] ]] && shadow_look jarvis stream
      for x in $H; do [[ "${x#*:}" =~ ^[1-9] ]] && shadow_look "${x%%:*}" "$HOW"; done
      if [[ "${P:-0}" =~ ^[1-9] ]] && ready; then take one_practice; continue; fi;;
    practice)
      if [[ "${P:-0}" =~ ^[1-9] ]] && ready; then take one_practice; continue; fi;;
  esac
  [ "${1:-}" = --once ] && break
  sleep 5
done

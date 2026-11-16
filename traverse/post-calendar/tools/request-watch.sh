#!/bin/bash
# Jen's change requests on the Sixfold 365 post calendar, answered without Matthew (16 Nov 2026, Matthew: "I dont want to have to approve
# changes, so id rather you just do them for her"; "Go with the 5-10 minute option"). The Windows task "Post calendar requests" runs this
# every 10 minutes. The check itself costs nothing: one sign-in with the EDITOR code and one list of open Sixfold requests. Only when a
# request is waiting does it start a headless Claude session (Sonnet) with request-answer-prompt.md. That session can only run pc.mjs
# (editor: can never approve), python -I for pictures, and read/write in its work folder. It makes the change; the post goes back to
# draft for Jen to approve.
# One try per run. A request that is still open after 3 tries, or that the session marks "cannot", is left for a person: the overnight
# check shows it (needs-person.txt). Log: %LOCALAPPDATA%/ProjectBackup/post-requests/watch.log
set -u
REPO="/c/Users/Matthew sharpe/Desktop/claude test 2"; cd "$REPO" || exit 1
B="${POSTREQ_DIR:-$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/post-requests}"; mkdir -p "$B"   # POSTREQ_DIR: tests only
LOG="$B/watch.log"; STATE="$B/state.txt"; NEED="$B/needs-person.txt"; touch "$STATE" "$NEED"
say() { echo "$(date '+%F %T') $*" >> "$LOG"; }
mkdir "$B/lock" 2>/dev/null || { [ -n "$(find "$B/lock" -maxdepth 0 -mmin +40 2>/dev/null)" ] && rmdir "$B/lock" && mkdir "$B/lock" || exit 0; }
trap 'rmdir "$B/lock" 2>/dev/null' EXIT

REQ=$(timeout 60 node traverse/post-calendar/tools/pc.mjs requests sixfold 2>>"$LOG") || { say "could not read the calendar (offline?)"; exit 0; }
[ "$(printf '%s' "$REQ" | tr -d '[:space:]')" = "[]" ] && exit 0

# the first open request not already given up on
PICK=$(printf '%s' "$REQ" | node -e '
const fs=require("fs");const r=JSON.parse(fs.readFileSync(0,"utf8"));const st=fs.readFileSync(process.argv[1],"utf8");
const gone=new Set(st.split("\n").filter(l=>/ (cannot|gave-up)$/.test(l)).map(l=>l.split(" ")[0]));
const x=r.find(q=>!gone.has(q.request));if(x)console.log(JSON.stringify(x));' "$STATE")
[ -n "$PICK" ] || exit 0
RID=$(printf '%s' "$PICK" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).request)')
PID=$(printf '%s' "$PICK" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8")).post)')
TRIES=$(grep -c "^$RID try$" "$STATE")
if [ "$TRIES" -ge 3 ]; then echo "$RID gave-up" >> "$STATE"; echo "$(date '+%F %T') $PID request $RID: still open after 3 tries" >> "$NEED"; say "$RID gave up after 3 tries"; exit 0; fi
echo "$RID try" >> "$STATE"

WORK="$B/$RID"; mkdir -p "$WORK"; RES="$WORK/result.txt"; rm -f "$RES"
WW=$(cygpath -m "$WORK"); RW=$(cygpath -m "$RES")
C=$(ls -d "/c/Users/Matthew sharpe/.vscode/extensions/"anthropic.claude-code-*-win32-* 2>/dev/null | sort -V | tail -1)/resources/native-binary/claude.exe
[ -x "$C" ] || { say "no Claude CLI found under the VS Code extensions"; exit 0; }
PROMPT="$(sed -e "s#\$WORK#$WW#g" -e "s#\$RESULT#$RW#g" traverse/post-calendar/tools/request-answer-prompt.md)

WORK = $WW
RESULT = $RW

REQUEST_JSON:
$PICK"
say "$PID request $RID: answering (try $((TRIES + 1)))"
timeout 900 "$C" -p "$PROMPT" --model sonnet --permission-mode acceptEdits \
  --allowedTools "Read" "Glob" "Grep" "Write" "Bash(node traverse/post-calendar/tools/pc.mjs:*)" "Bash(python -I:*)" "Bash(ls:*)" "Bash(mkdir:*)" "Bash(curl -s -o:*)" \
  --add-dir "I:/Shared drives/Sixfold/08 Photos and content" --add-dir "$WW" > "$WORK/session.txt" 2>&1 < /dev/null
R=$(cat "$RES" 2>/dev/null | head -1)
case "$R" in
  cannot:*) echo "$RID cannot" >> "$STATE"; echo "$(date '+%F %T') $PID request $RID: $R" >> "$NEED"; say "$RID $R";;
  done:*) say "$RID $R";;
  *) say "$RID no result written (session: $(tail -c 300 "$WORK/session.txt" | tr '\n' ' '))";;
esac
exit 0

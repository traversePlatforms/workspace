#!/bin/bash
# Tests for the cloud J.A.R.V.I.S. (2026-11-19, TASKS X-15). Runs ON THE VM (bash ~/jarvis/ops/tests/cloud-test.sh, or jarvis-cloud.sh test
# from the laptop) against stand-ins only: a stand-in server (every command the watcher or a session sends is answered from files here and
# logged), a stand-in Claude (answers through the reply script the prompt names, or edits and commits, or queues for the laptop), and a
# throwaway copy of the repo (cloned from ~/jarvis/repo.git with shared objects). Nothing reaches the live server, Claude, or a real ticket;
# the live service is not touched (its own state folder is never used).
set -u
SRC="${CLOUD_SRC:-$HOME/jarvis/ops/help-watch-cloud.sh}"; BARE0="${CLOUD_BARE:-$HOME/jarvis/repo.git}"
W=$(mktemp -d); [ -n "${KEEP:-}" ] || trap 'rm -rf "$W"' EXIT; echo "work: $W"
pass=0; fail=0; ok() { if eval "$1"; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $2"; fi; }
export JARVIS_HOME="$W/jarvis" JARVIS_WS="$W/ws" JARVIS_MEM="$W/mem" JARVIS_CLAUDE="$W/stub-claude.sh" JARVIS_STANDIN="$W/stub-srv.sh" JARVIS_SIGNED_IN=1
mkdir -p "$W/jarvis/ops" "$W/jarvis/bin" "$W/jarvis/incoming" "$W/jarvis/secrets" "$W/srv" "$W/mem"
cp "$SRC" "$W/jarvis/ops/help-watch-cloud.sh"; cp "$(dirname "$SRC")/jarvis-cloud-prompt.md" "$W/jarvis/ops/" 2>/dev/null
cp "$HOME/jarvis/bin/laptop-job.sh" "$W/jarvis/bin/" 2>/dev/null || cp "$(dirname "$SRC")/../cloud-bin/laptop-job.sh" "$W/jarvis/bin/"
H="$W/jarvis/ops/help-watch-cloud.sh"
# the repo: a bare stand-in for ~/jarvis/repo.git and a clone of it on branch cloud
git clone -q --bare --shared "$BARE0" "$W/bare.git" && git clone -q "$W/bare.git" "$W/ws" || { echo "FAIL: no repo to clone (run jarvis-cloud.sh sync + init first)"; exit 1; }
git -C "$W/ws" config user.name T; git -C "$W/ws" config user.email t@t; git -C "$W/ws" checkout -q -B cloud origin/main
printf -- '- [Old note](old.md) — one\n' > "$W/mem/MEMORY.md"; echo "old" > "$W/mem/old.md"
# the stand-in server (also the sessions' sg.sh)
cat > "$W/stub-srv.sh" <<EOF
#!/bin/bash
C="\$*"; [ "\$1" = trav ] && { shift; C="\$*"; }; echo "\$C" >> "$W/srv/calls.log"; IN=\$(cat)
case "\$C" in
  *"help-next.php --peek --practice"*|*"help-next.php --practice"*) : ;;
  *"help-next.php --peek --install="*|*"help-next.php --install="*) : ;;
  *"help-next.php --peek") cat "$W/srv/staff.json" 2>/dev/null ;;
  *"help-next.php") [ -f "$W/srv/staff.json" ] && { cat "$W/srv/staff.json"; mv "$W/srv/staff.json" "$W/srv/staff.taken"; } ;;
  *"help-reply.php "*) set -- \$C; echo "\$3 \$4 \$IN" >> "$W/srv/staff-replies.log"; echo "{\"id\":\"\$3\",\"t\":\"reply\",\"status\":\"\$4\",\"at\":\$(date +%s)}" >> "$W/srv/helplog"; echo "replied (\$4)" ;;
  *"grep '\"id\":"*"help.log"*) grep "\$(echo "\$C" | grep -o 'h[0-9]\{14\}[0-9a-f]\{4\}' | head -1)" "$W/srv/helplog" 2>/dev/null ;;
  *"jvdesk.php next --peek"*) cat "$W/srv/desk.json" 2>/dev/null ;;
  *"jvdesk.php next"*) [ -f "$W/srv/desk.json" ] && { cat "$W/srv/desk.json"; mv "$W/srv/desk.json" "$W/srv/desk.taken"; } ;;
  *"jvdesk.php count"*) [ -f "$W/srv/desk.json" ] && echo 1 || echo 0 ;;
  *"jvdesk.php reply"*) set -- \$C; echo "\$4 \$5 \$IN" >> "$W/srv/desk-replies.log"; echo "replied (\$5) in J.A.R.V.I.S." ;;
  *"jvdesk.php final-since"*) set -- \$C; grep -q "^\$4 \(answered\|matthew\)" "$W/srv/desk-replies.log" 2>/dev/null ;;
  *"jarvis-cloud/laptop.txt") cat "$W/srv/laptop.txt" 2>/dev/null ;;
  *"jarvis-cloud/beat.txt") printf '%s' "\$IN" > "$W/srv/beat.txt" ;;
  *) : ;;
esac
EOF
cp "$W/stub-srv.sh" "$W/jarvis/bin/sg.sh"
# the stand-in Claude: STUB=reply|edit|queue|none; the quick pass (--tools Read,Grep,Glob) says HANDOFF
cat > "$W/stub-claude.sh" <<'EOF'
#!/bin/bash
P=$(cat); echo "$*" >> "$STUBLOG"; echo "JARVIS_CLOUD=${JARVIS_CLOUD:-} SG=${JARVIS_SG:-}" >> "$STUBLOG"
case " $* " in *" --tools Read,Grep,Glob "*) printf 'HANDOFF\nOn it, sir.\n'; exit 0;; esac
ID=$(printf '%s' "$P" | grep -o 'h[0-9]\{14\}[0-9a-f]\{4\}' | head -1)
RPL="bash traverse/ops/help-reply.sh"; printf '%s' "$P" | grep -q "J.A.R.V.I.S. desk" && RPL="bash assistant/jarvis/tools/jarvis-reply.sh"
printf '%s' "$P" | grep -q "holds the write turn" && echo "WRITE=yes" >> "$STUBLOG" || echo "WRITE=no" >> "$STUBLOG"
case "${STUB:-reply}" in
  reply) printf 'Done, ma%sam.' "'" | $RPL "$ID" answered >> "$STUBLOG" 2>&1;;
  edit) echo "- $(date +%F) stub learned line" >> traverse/ops/jarvis-learned-office.md; echo "cloud memory note" > "$JARVIS_MEM/new-note.md"
        echo "// stub code change" >> traverse/ops/cloud-guard.sh
        git add traverse/ops/cloud-guard.sh && git commit -q -m "stub: a code fix" >> "$STUBLOG" 2>&1; echo "commit rc=$?" >> "$STUBLOG"
        printf 'Fixed.' | $RPL "$ID" answered >> "$STUBLOG" 2>&1;;
  queue) printf 'Needs the laptop: rebuild the page.' | bash "$JARVIS_HOME/bin/laptop-job.sh" "$ID" >> "$STUBLOG" 2>&1
         printf 'Queued for the laptop.' | $RPL "$ID" working >> "$STUBLOG" 2>&1;;
  none) : ;;
esac
EOF
chmod +x "$W/stub-srv.sh" "$W/stub-claude.sh" "$W/jarvis/bin/"*.sh; export STUBLOG="$W/stub.log"
LD="/home/x/www/traverseplatforms.com/sixfold-data/rounds/help-files"; DD="/home/x/www/traverseplatforms.com/assistant-private/data/jarvis/desk/files"
STAFF=h20261119120000ab12; MINE=h20261119120100cd34; OTHER=h20261119120200ef56
staff() { echo "{\"id\":\"$STAFF\",\"by\":\"Jen McPherson\",\"conversation\":[{\"from\":\"Jen McPherson\",\"when\":\"x\",\"text\":\"fix the button\"}],\"photoDir\":\"$LD/$STAFF\",\"audioDir\":\"$LD/$STAFF\"}" > "$W/srv/staff.json"; }
desk() { echo "{\"id\":\"$1\",\"by\":\"Matthew Sharpe\",\"desk\":\"jarvis\",\"conversation\":[{\"from\":\"$2\",\"when\":\"x\",\"text\":\"hello\"}],\"photoDir\":\"$DD/$1\",\"audioDir\":\"$DD/$1\"}" > "$W/srv/desk.json"; }
run() { JARVIS_MODE="$1" JARVIS_TEST_COUNTS="$2" timeout 120 bash "$H" --once > /dev/null 2>&1; }
F0=$(git -C "$W/bare.git" rev-parse main); LAP=0123456789abcdef0123456789abcdef01234567
echo "$LAP $F0" > "$W/jarvis/incoming/commit-map"
laptop_on() { echo "$(date +%s) $LAP" > "$W/srv/laptop.txt"; }
laptop_away() { echo "$(( $(date +%s) - 3600 )) $LAP" > "$W/srv/laptop.txt"; }

echo "--- 1. the guard"
ok 'bash "$H" --guard-test | tail -1 | grep -q "all PASS"' "guard test"

echo "--- 2. shadow: looks, takes nothing, answers nothing"
staff; desk "$MINE" "Matthew Sharpe"; laptop_on; : > "$W/srv/calls.log"
run shadow "L=1 J=1 P=0"
ok 'grep -q "	staff	$STAFF	1	office	" "$W/jarvis/state/shadow/shadow.tsv"' "shadow row for the staff ticket"
ok 'grep -q "	jarvis	$MINE	1	matthew	" "$W/jarvis/state/shadow/shadow.tsv"' "shadow row for his desk thread"
ok '! grep -qE "help-next.php$|jvdesk.php next$|help-reply|jvdesk.php reply|transcript" "$W/srv/calls.log"' "shadow sent nothing but looks"
ok '[ -f "$W/srv/staff.json" ] && [ -f "$W/srv/desk.json" ]' "shadow left both tickets waiting"
ok 'grep -q "may change the repo: no (the laptop is on" "$W/jarvis/state/help-watch.log"' "shadow says the write turn is no while the laptop is on"
ok 'ls "$W/jarvis/state/shadow/"$MINE-1.quick > /dev/null 2>&1' "shadow ran the read-only quick pass for his thread"
run shadow "L=1 J=1 P=0"
ok '[ "$(grep -c "$STAFF" "$W/jarvis/state/shadow/shadow.tsv")" = 1 ]' "shadow logs a ticket version once"
rm -f "$W/srv/desk.json"

echo "--- 3. live, laptop on: answers, may not change the repo"
: > "$STUBLOG"; STUB=reply run live "L=1"
ok 'grep -q "^$STAFF answered Done" "$W/srv/staff-replies.log"' "staff ticket answered through help-reply.sh"
ok 'grep -q "WRITE=no" "$STUBLOG"' "session told: no write turn"
ok 'grep -q "JARVIS_CLOUD=1 SG=bash $W/jarvis/bin/sg.sh trav" "$STUBLOG"' "session runs with the cloud switch and its own server wrapper"
ok 'grep -q "$STAFF: done" "$W/jarvis/state/help-watch.log"' "watcher saw the final reply"
ok '[ ! -f "$W/jarvis/state/write-ok" ]' "no write turn left behind"

echo "--- 4. live, laptop on: a repo job is queued for the laptop, not passed to Matthew"
staff; : > "$STUBLOG"; STUB=queue run live "L=1"
ok '[ -s "$W/jarvis/outbox/jobs/$STAFF.json" ]' "job file written"
ok 'grep -q "queued for the laptop" "$W/jarvis/state/help-watch.log"' "watcher logged it queued"
ok '! grep -q "^$STAFF matthew" "$W/srv/staff-replies.log"' "no 'passed to Matthew' note"
staff; STUB=reply run live "L=1"
ok 'grep -q "$STAFF: still queued for the laptop" "$W/jarvis/state/help-watch.log"' "the same conversation, nothing new: left for the laptop"
mv "$W/jarvis/outbox/jobs/$STAFF.json" "$W/jarvis/outbox/merged/"

echo "--- 5. live, laptop away: edit, commit (Cloud-Id), notes and memory caught for the laptop"
staff; laptop_away; : > "$STUBLOG"; STUB=edit run live "L=1"
ok 'grep -q "WRITE=yes" "$STUBLOG"' "session told: write turn held"
ok 'grep -q "commit rc=0" "$STUBLOG"' "the commit went in"
ok 'git -C "$W/ws" log -1 --format=%B cloud | grep -qE "^Cloud-Id: c[0-9]{14}-[0-9a-f]{4}$"' "the commit carries a Cloud-Id"
B=$(ls -d "$W/jarvis/outbox/changes/"*"-$STAFF" 2>/dev/null | tail -1)
ok '[ -n "$B" ] && ls "$B/patches/"*.patch > /dev/null 2>&1' "bundle has the commit as a patch"
ok '[ -n "$B" ] && jq -e ".files[] | select(.path == \"traverse/ops/jarvis-learned-office.md\" and .kind == \"notes\")" "$B/meta.json" > /dev/null' "bundle has the learned note (notes)"
ok '[ -n "$B" ] && jq -e ".files[] | select(.area == \"memory\" and .path == \"new-note.md\" and .state == \"new\")" "$B/meta.json" > /dev/null' "bundle has the new memory note"
ok '[ ! -f "$W/jarvis/state/write-ok" ]' "write turn dropped after the session"

echo "--- 6. no commit without the write turn (the hook)"
laptop_on; ( cd "$W/ws" && echo x >> README.md 2>/dev/null; git add -A >/dev/null 2>&1; git commit -q -m "should fail" > "$W/c6" 2>&1 )
ok '! git -C "$W/ws" log -1 --format=%s | grep -q "should fail" && grep -q "REFUSED: no commits on the cloud machine" "$W/c6"' "commit refused without the write turn"
git -C "$W/ws" reset -q --hard HEAD; git -C "$W/ws" clean -fdq

echo "--- 7. the next refresh keeps the unmerged cloud commit on top; drops it once the laptop has it"
CID=$(git -C "$W/ws" log -1 --format='%(trailers:key=Cloud-Id,valueonly)' cloud | head -1)
bash "$H" --sync-workspace > /dev/null 2>&1
ok 'git -C "$W/ws" log -1 --format=%s cloud | grep -q "stub: a code fix"' "unmerged cloud commit kept on top after a refresh"
ok 'grep -q "stub learned line" "$W/ws/traverse/ops/jarvis-learned-office.md"' "unmerged learned note laid back over the fresh copy"
T2=$(mktemp -d); git clone -q "$W/bare.git" "$T2/l" && git -C "$T2/l" config user.name L && git -C "$T2/l" config user.email l@l \
  && git -C "$T2/l" -c core.hooksPath=/dev/null am -q -3 "$B"/patches/*.patch && git -C "$T2/l" push -q origin HEAD:main; rm -rf "$T2"
mv "$B" "$W/jarvis/outbox/merged/"
bash "$H" --sync-workspace > /dev/null 2>&1
ok '[ "$(git -C "$W/ws" rev-parse cloud)" = "$(git -C "$W/ws" rev-parse origin/main)" ]' "once the laptop has it (same Cloud-Id), the cloud branch is just the laptop's copy"
ok 'git -C "$W/ws" log -1 --format=%B origin/main | grep -q "Cloud-Id: $CID"' "the laptop's copy carries the same Cloud-Id"

echo "--- 8. his desk: only his own threads, his reply script"
desk "$MINE" "Matthew Sharpe"; : > "$STUBLOG"; STUB=reply run live "J=1"
ok 'grep -q "^$MINE working On it" "$W/srv/desk-replies.log"' "quick pass HANDOFF sent the 'on it' note in his desk"
ok 'grep -q "^$MINE answered Done" "$W/srv/desk-replies.log"' "desk thread answered through jarvis-reply.sh"
desk "$OTHER" "Jen McPherson"; run live "J=1"
ok 'grep -q "GUARD: desk thread $OTHER has a writer other than Matthew" "$W/jarvis/state/help-watch.log"' "a desk thread with another writer is left alone"
rm -f "$W/srv/desk.json"

echo "--- 9. no final reply: the watcher's own note"
staff; laptop_on; STUB=none run live "L=1"
ok 'grep -q "^$STAFF matthew I couldn" "$W/srv/staff-replies.log"' "a session with no reply passes it to Matthew"

echo "--- 10. the deploy guard on this machine"
( cd "$W/ws" && R="$W/ws/traverse" SG="bash $W/stub-srv.sh trav" JARVIS_CLOUD=1 bash -c '. traverse/ops/cloud-guard.sh; cloud_guard_before t' ) > "$W/g1" 2>&1
ok 'grep -q "REFUSED (cloud): the laptop is on" "$W/g1"' "deploy refused without the write turn"
echo "t $(date +%s)" > "$W/jarvis/state/write-ok"
( cd "$W/ws" && R="$W/ws/traverse" SG="bash $W/stub-srv.sh trav" JARVIS_CLOUD=1 bash -c '. traverse/ops/cloud-guard.sh; cloud_guard_before t' ) > "$W/g2" 2>&1
ok 'grep -q "REFUSED (cloud): no record of the laptop" "$W/g2"' "deploy refused with no record of the laptop's last deploy"
rm -f "$W/jarvis/state/write-ok"

echo "--- 11. beat"
echo 1 > "$W/jarvis/state/ready"; ( JARVIS_MODE=shadow bash -c ". <(sed -n '1,/^# ---- test modes/p' '$H'); beat_loop \$\$" & BP=$!; sleep 3; kill $BP 2>/dev/null ) > /dev/null 2>&1
ok 'grep -qE "^[0-9]{10} shadow 1$" "$W/srv/beat.txt"' "beat written as '<time> <mode> <ready>'"

echo "$pass passed, $fail failed"; [ "$fail" = 0 ]

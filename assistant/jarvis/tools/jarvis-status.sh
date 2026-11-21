#!/bin/bash
# J.A.R.V.I.S. status (2026-11-18): what the merged J.A.R.V.I.S. page shows under Today and Builds, kept on this laptop and pushed to the
# Assistant's private data on the server (assistant-private/data/jarvis/status.json, 0600). The page reads it through the Assistant's own
# sign-in (api.php?action=jvstatus). Nothing else reads it.
#
#   bash assistant/jarvis/tools/jarvis-status.sh push
#       the last overnight check (counts and PROBLEM lines only, from overnight-latest.txt) and the builds list, in one upload.
#       The overnight check runs this at its end, every 30 minutes, so the page also knows when the laptop was last seen.
#   bash assistant/jarvis/tools/jarvis-status.sh build start <id> "<name>" [steps]
#   bash assistant/jarvis/tools/jarvis-status.sh build step  <id> <n> "<note>"       step n of steps
#   bash assistant/jarvis/tools/jarvis-status.sh build pct   <id> <0-100> "<note>"
#   bash assistant/jarvis/tools/jarvis-status.sh build done  <id> "<note>"
#   bash assistant/jarvis/tools/jarvis-status.sh build fail  <id> "<note>"
#   bash assistant/jarvis/tools/jarvis-status.sh build drop  <id>
#   bash assistant/jarvis/tools/jarvis-status.sh build list
#       a builder (a Claude session or a long script) calls these as it goes; each change is pushed straight away (if the server is
#       out of reach it goes at the next overnight check). Finished builds show for a day; one with no word for 6 hours shows as quiet.
#   bash assistant/jarvis/tools/jarvis-status.sh beat
#       19 Nov (P-8): the laptop's heartbeat (one tiny file, beat.txt). help-watch.sh sends it every 5 minutes while it runs, so the page can
#       say "Laptop asleep since 6:32 pm: desk requests will run when it wakes". Any push counts as a beat too.
#   bash assistant/jarvis/tools/jarvis-status.sh waiting add <id> <Surge|Sixfold|Traverse|Peak|Personal|Other> "<question>" "<what Approve and Decline do>" ["<where it came from>"]
#   bash assistant/jarvis/tools/jarvis-status.sh waiting drop <id>        (after a session has acted on his decision)
#   bash assistant/jarvis/tools/jarvis-status.sh waiting list
#       19 Nov (P-8): "Waiting on you", the decisions only Matthew can make, kept in assistant/jarvis/waiting.json and pushed straight away.
#       Each of his taps (Approve or Decline, with a note) covers that one item. Never a social post (the post calendar approves those;
#       Sixfold posts are Jen's) and never an email or text to send: those are refused here and dropped by the server.
#   bash assistant/jarvis/tools/jarvis-status.sh alert "<text>"
#       19 Nov: tell Matthew something now: a message in his main J.A.R.V.I.S. desk thread, pushed to his phone (J.A.R.V.I.S.'s own alerts,
#       nothing through the Sixfold app). Same as: bash assistant/jarvis/tools/jarvis-reply.sh main answered <<< "<text>"
#   Money (19 Nov): every push also sends the money summary that jarvis-money.mjs keeps (the Spend Ledger's totals, Traverse's Stripe read
#       only, refreshed at most every 25 minutes). Totals only.
# Never prints or sends a code, key or token: the overnight report has none (its own rule), and only its counts and PROBLEM lines go.
set -u
exec < /dev/null
# 19 Nov: on the cloud J.A.R.V.I.S. machine (JARVIS_CLOUD=1) only alert works: its builds list and Waiting list are not the laptop's, and a push
# from there would replace his. Everything else is refused (the laptop keeps them).
if [ "${JARVIS_CLOUD:-}" = 1 ] && [ "${1:-}" != alert ]; then echo "jarvis-status.sh: only alert works on the cloud machine (builds, Waiting on you and beats are the laptop's)"; exit 3; fi
DIR="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup/jarvis"; mkdir -p "$DIR"
BUILDS="$DIR/builds.json"; LATEST="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup/overnight-latest.txt"
SG="${JARVIS_SG:-bash /c/Users/SURGEI~1/.ssh/sg.sh trav}"
DEST='~/www/traverseplatforms.com/assistant-private/data/jarvis'
[ -s "$BUILDS" ] || echo '[]' > "$BUILDS"

REPO="${JARVIS_REPO:-/c/Users/Matthew sharpe/Desktop/claude test 2}"
running_jobs() {   # 18 Nov: data finishers (finish-*.sh) running on this laptop, found by themselves: name <TAB> their log, if one is found
  local n b log
  for n in $(ps -ef 2>/dev/null | grep -oE 'finish-[A-Za-z0-9_-]+\.sh' | sort -u); do
    b="${n%.sh}"; b="${b%-20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]}"
    log=$(find "$REPO/traverse/data-pipeline" -maxdepth 4 -name "logs-$b*.log" 2>/dev/null | head -1)
    printf '%s\t%s\n' "$b" "$log"
  done
}
WAITING="$REPO/assistant/jarvis/waiting.json"
payload() {   # the one file the server keeps
  running_jobs > "$DIR/auto-jobs.tsv"
  [ -n "${JARVIS_NO_STRIPE:-}" ] || node "$REPO/assistant/jarvis/tools/jarvis-money.mjs" stripe >/dev/null 2>&1   # read only, at most every 25 min
  node -e '
    const fs = require("fs"), [bf, lf, af, wf, dir] = process.argv.slice(1);
    let builds = []; try { builds = JSON.parse(fs.readFileSync(bf, "utf8")); } catch (e) {}
    // 18 Nov (Matthew: "why doesnt my jarvis have these builds"): data finishers show up on their own, with their log'"'"'s last line
    try {
      for (const row of fs.readFileSync(af, "utf8").split("\n").filter(Boolean)) {
        const [name, log] = row.split("\t"); let note = "running", at = Math.floor(Date.now() / 1000);
        if (log) { try { const ls = fs.readFileSync(log, "utf8").trim().split(/\r?\n/); note = (ls[ls.length - 1] || "running").slice(0, 160); at = Math.floor(fs.statSync(log).mtimeMs / 1000); } catch (e) {} }
        if (!builds.some(b => b.id === "job-" + name)) builds.push({ id: "job-" + name, name: "Data job: " + name.replace(/^finish-/, ""), steps: 0, step: 0, pct: null, note, state: "running", at, auto: true });
      }
    } catch (e) {}
    let over = null;
    try {
      const t = fs.readFileSync(lf, "utf8"), st = fs.statSync(lf), lines = t.split(/\r?\n/);
      const ok = lines.filter(l => /^\s+ok\s/.test(l)).length, probs = lines.filter(l => /^\s+PROBLEM\s/.test(l)).map(l => l.replace(/^\s+PROBLEM\s+/, "").slice(0, 220));
      const m = /^== (\d{4}-\d\d-\d\d \d\d:\d\d)/.exec(lines[0] || "");
      over = { at: m ? Math.floor(new Date(m[1].replace(" ", "T") + ":00").getTime() / 1000) : Math.floor(st.mtimeMs / 1000), ok, problems: probs };
    } catch (e) {}
    // 19 Nov: Waiting on you, and the money totals
    let waiting = []; try { waiting = JSON.parse(fs.readFileSync(wf, "utf8")); } catch (e) {}
    const rd = f => { try { return JSON.parse(fs.readFileSync(dir + "/" + f, "utf8")); } catch (e) { return null; } };
    const money = { ledger: rd("money-ledger.json"), stripe: rd("stripe.json") };
    process.stdout.write(JSON.stringify({ pushedAt: Math.floor(Date.now() / 1000), overnight: over, builds, waiting, money }));
  ' "$BUILDS" "$LATEST" "$DIR/auto-jobs.tsv" "$WAITING" "$DIR"
}
prune() {   # 21 Nov: items he has decided on his page (the tap reached the desk) come off the laptop's list too, so a push never brings them back
  local dec; dec=$($SG "cat $DEST/decisions.json 2>/dev/null" 2>/dev/null) || return 0
  [ -n "$dec" ] || return 0
  printf '%s' "$dec" | node -e '
    const fs = require("fs"), f = process.argv[1]; let D = {}, L;
    try { D = JSON.parse(fs.readFileSync(0, "utf8")) || {}; L = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { process.exit(0); }
    if (!Array.isArray(L)) process.exit(0);
    const gone = L.filter(w => { const d = D[w.id]; return d && d.ticket && +d.itemAt === +w.at; });
    if (!gone.length) process.exit(0);
    fs.writeFileSync(f, JSON.stringify(L.filter(w => !gone.includes(w)), null, 1) + "\n");
    console.log("off the waiting list (decided on his page): " + gone.map(w => w.id).join(", "));
  ' "$WAITING"
}
push() {
  prune
  payload | $SG "umask 077; mkdir -p $DEST && cat > $DEST/status.json.tmp && mv -f $DEST/status.json.tmp $DEST/status.json && echo pushed" 2>/dev/null | grep -q pushed \
    && echo "jarvis status pushed" || { echo "jarvis status NOT pushed (server out of reach; the next overnight check sends it)"; return 1; }
}
edit() {   # edit <op> <id> [args...]: the builds list, by node
  node -e '
    const fs = require("fs"), [f, op, id, a, b, c] = process.argv.slice(1), now = Math.floor(Date.now() / 1000);
    let L = []; try { L = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
    let x = L.find(r => r.id === id);
    if (op === "start") { if (!x) { x = { id }; L.push(x); } Object.assign(x, { name: a || id, steps: +b || 0, step: 0, pct: null, note: "", state: "running", at: now }); }
    else if (op === "drop") L = L.filter(r => r.id !== id);
    else if (!x) { console.error("no build called " + id + " (start it first)"); process.exit(1); }
    else if (op === "step") Object.assign(x, { step: +a || 0, pct: x.steps ? Math.round(100 * (+a || 0) / x.steps) : x.pct, note: b || x.note, state: "running", at: now });
    else if (op === "pct") Object.assign(x, { pct: Math.max(0, Math.min(100, +a || 0)), note: b || x.note, state: "running", at: now });
    else if (op === "done") Object.assign(x, { pct: 100, note: a || "done", state: "done", at: now });
    else if (op === "fail") Object.assign(x, { note: a || "stopped", state: "failed", at: now });
    L = L.filter(r => r.state === "running" || now - (r.at || 0) < 86400 * 2).slice(-20);
    fs.writeFileSync(f, JSON.stringify(L, null, 1));
  ' "$BUILDS" "$@"
}
beat() {   # 19 Nov: the heartbeat, one line; quiet when the server is out of reach (the next one tries again)
  $SG "umask 077; mkdir -p $DEST && date +%s > $DEST/beat.txt.tmp && mv -f $DEST/beat.txt.tmp $DEST/beat.txt && echo beat" 2>/dev/null | grep -q beat && echo "jarvis beat sent" || { echo "jarvis beat NOT sent"; return 1; }
}
wedit() {   # waiting add|drop: assistant/jarvis/waiting.json, by node
  node -e '
    const fs = require("fs"), [f, op, id, co, title, detail, from] = process.argv.slice(1);
    let L = []; try { L = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
    if (op === "drop") { const n = L.length; L = L.filter(w => w.id !== id); if (L.length === n) console.log(id + " is already off the list"); }
    else {
      const C = ["Surge", "Sixfold", "Traverse", "Peak", "Personal", "Other"];
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id || "")) { console.error("the id is lower-case letters, digits and dashes"); process.exit(1); }
      if (!C.includes(co)) { console.error("the company is one of: " + C.join(", ") + " (never guessed, never blended)"); process.exit(1); }
      if (!title || !detail) { console.error("give the question and what Approve and Decline do"); process.exit(1); }
      if (/\b(approve|ok|okay|publish|schedule)\b[^.]{0,40}\b(post|posts|caption|reel|story|stories)\b|\bsend (the|this|these|that|an?)\b[^.]{0,20}\b(email|emails|text|texts|newsletter)\b/i.test(title + " " + detail)) {
        console.error("not here: posts are approved in the post calendar (Sixfold posts by Jen) and emails go out only from Outbox or his own Send"); process.exit(1); }
      L = L.filter(w => w.id !== id);
      L.push({ id, title: title.slice(0, 160), detail: detail.slice(0, 400), company: co, from: (from || "").slice(0, 80), kind: "decision", at: Math.floor(Date.now() / 1000) });
    }
    fs.writeFileSync(f, JSON.stringify(L, null, 1) + "\n");
  ' "$WAITING" "$@"
}
case "${1:-}" in
  push) push ;;
  beat) beat ;;
  alert) shift; [ -n "${1:-}" ] || { echo 'usage: jarvis-status.sh alert "<text>"'; exit 1; }
    exec 0<&-; printf '%s' "$*" | bash "$REPO/assistant/jarvis/tools/jarvis-reply.sh" main answered ;;
  waiting)
    shift; op="${1:-}"
    case "$op" in
      list) cat "$WAITING"; echo ;;
      add|drop) wedit "$@" && push ;;
      *) echo "usage: jarvis-status.sh waiting add <id> <company> \"<question>\" \"<what Approve and Decline do>\" [\"<from>\"] | drop <id> | list"; exit 1 ;;
    esac ;;
  build)
    shift; op="${1:-}"; id="${2:-}"
    case "$op" in
      list) cat "$BUILDS"; echo ;;
      start|step|pct|done|fail|drop) [[ "$id" =~ ^[A-Za-z0-9._-]{1,40}$ ]] || { echo "the build id is letters, digits, dot, dash"; exit 1; }
        shift; edit "$op" "$@" && push ;;
      *) echo "usage: jarvis-status.sh build start|step|pct|done|fail|drop|list <id> ..."; exit 1 ;;
    esac ;;
  *) echo "usage: jarvis-status.sh push | beat | alert \"<text>\" | build ... | waiting ..."; exit 1 ;;
esac

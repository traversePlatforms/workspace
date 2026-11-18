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
# Never prints or sends a code, key or token: the overnight report has none (its own rule), and only its counts and PROBLEM lines go.
set -u
exec < /dev/null
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
payload() {   # the one file the server keeps
  running_jobs > "$DIR/auto-jobs.tsv"
  node -e '
    const fs = require("fs"), [bf, lf, af] = process.argv.slice(1);
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
    process.stdout.write(JSON.stringify({ pushedAt: Math.floor(Date.now() / 1000), overnight: over, builds }));
  ' "$BUILDS" "$LATEST" "$DIR/auto-jobs.tsv"
}
push() {
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
case "${1:-}" in
  push) push ;;
  build)
    shift; op="${1:-}"; id="${2:-}"
    case "$op" in
      list) cat "$BUILDS"; echo ;;
      start|step|pct|done|fail|drop) [[ "$id" =~ ^[A-Za-z0-9._-]{1,40}$ ]] || { echo "the build id is letters, digits, dot, dash"; exit 1; }
        shift; edit "$op" "$@" && push ;;
      *) echo "usage: jarvis-status.sh build start|step|pct|done|fail|drop|list <id> ..."; exit 1 ;;
    esac ;;
  *) echo "usage: jarvis-status.sh push | build ..."; exit 1 ;;
esac

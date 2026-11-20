#!/bin/bash
# Queue a job for the laptop, from a cloud J.A.R.V.I.S. session (2026-11-19, TASKS X-15). Installed as ~/jarvis/bin/laptop-job.sh.
#   laptop-job.sh <ticket id> <<'EOF'
#   what the laptop must do, what you found, what you already did and what is left (plain words; no codes or keys)
#   EOF
# The laptop's watcher picks it up within a few minutes of being on (jarvis-cloud-sync.sh pull), runs a full session on it with this
# note and the conversation, and answers in the same chat. Then send the person a `working` reply saying it is queued for the laptop, and
# end WITHOUT a final reply: the watcher then leaves the conversation working instead of passing it to Matthew.
# Use it when this machine may not change the repo (the watcher's note says why), or for what can only run on the laptop (Sixfold's own
# site, Surge, 365 Aeration, Desktop files, Drive letters, Windows jobs, a full data build).
set -u
J="${JARVIS_HOME:-$HOME/jarvis}"; ID="${1:?ticket id}"
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "bad ticket id"; exit 2; }
T="${JARVIS_TICKET_DIR:-$J/state/cur}/$ID.json"; [ -s "$T" ] || { echo "no ticket $ID on this machine (only the one this session was started for)"; exit 2; }
NOTE=$(cat); [ -n "$(printf '%s' "$NOTE" | tr -d '[:space:]')" ] || { echo "say what the laptop must do (on stdin)"; exit 2; }
mkdir -p "$J/outbox/jobs"
printf '%s' "$NOTE" | jq -Rs --slurpfile t "$T" --arg at "$(date +%s)" \
  '{id: $t[0].id, kind: (if $t[0].desk == "jarvis" then "jarvis" else "staff" end), n: ($t[0].conversation | length), at: ($at | tonumber), note: ., thread: $t[0]}' \
  > "$J/outbox/jobs/$ID.json.tmp" && mv "$J/outbox/jobs/$ID.json.tmp" "$J/outbox/jobs/$ID.json" && echo "queued for the laptop: $ID"

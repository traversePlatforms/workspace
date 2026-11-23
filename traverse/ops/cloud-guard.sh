#!/bin/bash
# Two copies of the repo can deploy since the cloud J.A.R.V.I.S. (2026-11-19, TASKS X-15; JARVIS-CLOUD.md "Deploys from two places"): the
# laptop and the Azure machine. Sourced by deploy-app.sh, deploy-practice.sh and deploy-client.sh, which call
#   cloud_guard_before <label>    refuse a deploy that would put older code over newer live code
#   cloud_guard_after <label>     after "all checks passed": record what went up, for the other side's check
# The record lives on the server, beside public_html (never served): ~/www/traverseplatforms.com/jarvis-cloud/
#   deploy-cloud.txt     every Cloud-Id the cloud has deployed (one per line; a cloud commit carries "Cloud-Id: c..." in its message)
#   deploy-laptop.json   the laptop's last deploy: its commit, the time, the label, and the git blob of every build input that was NOT
#                        committed at that moment (data the laptop deploys before committing)
# The laptop refuses while the cloud has deployed commits the laptop has not merged (bash traverse/ops/jarvis-cloud-sync.sh pull).
# The cloud refuses unless: it holds the write turn (the laptop away, ~/jarvis/state/write-ok), its tree is committed, its copy holds the
# laptop's last deployed commit, and every uncommitted input of that deploy is in its copy byte for byte (or changed by a later commit).
# A missing record or an unreachable server never blocks the laptop (the server has to be reachable to deploy anyway); it does block the cloud.
# JARVIS_GUARD_OFF=1 skips both, for Matthew by hand only.
CG_DIR='~/www/traverseplatforms.com/jarvis-cloud'
CG_INPUTS="traverse/app traverse/editions traverse/data-pipeline/door-territory"
cg_repo() { (cd "$R/.." && pwd); }
cg_js() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let j={};try{j=JSON.parse(s)}catch(e){};$1})"; }   # cg_js '<code using j>' < JSON
cg_ids() { git -C "$1" log --format='%(trailers:key=Cloud-Id,valueonly)' "${2:-HEAD}" 2>/dev/null | grep -E '^c[0-9]{14}-[0-9a-f]{4}$' | sort -u; }
cloud_guard_before() {
  [ "${JARVIS_GUARD_OFF:-}" = 1 ] && { echo "  cloud guard: OFF (JARVIS_GUARD_OFF=1)"; return 0; }
  local RP; RP=$(cg_repo)
  if [ "${JARVIS_CLOUD:-}" = 1 ]; then
    local W="${JARVIS_HOME:-$HOME/jarvis}/state/write-ok" DJ L F p b now; now=$(date +%s)
    [ -s "$W" ] && [ $(( now - $(stat -c %Y "$W") )) -lt 10800 ] || { echo "REFUSED (cloud): the laptop is on, so it does the deploys. Queue this for the laptop (laptop-job.sh)."; return 1; }
    [ -z "$(git -C "$RP" status --porcelain -uno -- $CG_INPUTS traverse/ops 2>/dev/null)" ] || { echo "REFUSED (cloud): commit first (build, then git commit, then deploy): $(git -C "$RP" status --porcelain -uno -- $CG_INPUTS traverse/ops | head -3 | tr '\n' ' ')"; return 1; }
    DJ=$($SG "cat $CG_DIR/deploy-laptop.json" < /dev/null 2>/dev/null) || { echo "REFUSED (cloud): could not read the laptop's last deploy from the server"; return 1; }
    [ -n "$DJ" ] || { echo "REFUSED (cloud): no record of the laptop's last deploy yet (the laptop writes it on its next deploy)"; return 1; }
    L=$(printf '%s' "$DJ" | cg_js 'console.log(j.head || "")'); [[ "$L" =~ ^[0-9a-f]{40}$ ]] || { echo "REFUSED (cloud): the laptop's deploy record is unreadable"; return 1; }
    F=$(awk -v l="$L" '$1==l {print $2}' "${JARVIS_HOME:-$HOME/jarvis}/incoming/commit-map" 2>/dev/null | tail -1)
    [ -z "$F" ] && git -C "$RP" cat-file -e "$L^{commit}" 2>/dev/null && F="$L"   # VM mode (22 Nov): ~/main deploys with the one history's own ids
    [ -n "$F" ] && git -C "$RP" merge-base --is-ancestor "$F" HEAD 2>/dev/null || { echo "REFUSED (cloud): the laptop deployed commit ${L:0:10}, which this copy does not have yet. Queue it for the laptop."; return 1; }
    while IFS=$'\t' read -r p b; do
      [ -n "$p" ] || continue
      [ "$(git -C "$RP" rev-parse "HEAD:$p" 2>/dev/null)" = "$b" ] && continue
      [ -n "$(git -C "$RP" log --format=%H "$F..HEAD" -- "$p" 2>/dev/null | head -1)" ] && continue
      echo "REFUSED (cloud): the laptop deployed $p before committing it, and this copy does not have that version. Queue it for the laptop."; return 1
    done < <(printf '%s' "$DJ" | cg_js 'for (const [k, v] of Object.entries(j.dirty || {})) console.log(k + String.fromCharCode(9) + v)')
    echo "  cloud guard: OK (write turn held; holds the laptop's deploy of $(printf '%s' "$DJ" | cg_js 'console.log(new Date(j.at * 1000).toISOString())'))"
  else
    local ON MISS
    # 22 Nov (VM-MAIN-WORKSPACE.md): the VM's ~/main before the flip is a standby copy; it may look (deploy-app.sh --check), not deploy
    [ "$(git -C "$RP" config --get jarvis.role 2>/dev/null)" = standby ] && [ "${CG_CHECK:-}" != 1 ] && { echo "REFUSED: this is the VM's standby copy (~/main): the laptop is still the main workspace until bash traverse/ops/vm-main.sh flip. Deploy from the laptop."; return 1; }
    ON=$($SG "cat $CG_DIR/deploy-cloud.txt 2>/dev/null; true" < /dev/null 2>/dev/null) || { echo "  cloud guard: server not answering, not checked"; return 0; }
    MISS=$(comm -23 <(printf '%s\n' "$ON" | grep -E '^c[0-9]{14}-[0-9a-f]{4}$' | sort -u) <(cg_ids "$RP"))
    [ -z "$MISS" ] || { echo "REFUSED: the cloud J.A.R.V.I.S. deployed $(printf '%s\n' "$MISS" | wc -l) change(s) this laptop has not merged. Run: bash traverse/ops/jarvis-cloud-sync.sh pull (laptop) or bash traverse/ops/vm-main-sync.sh (the VM's ~/main), then build and deploy again."; return 1; }
    echo "  cloud guard: OK"
  fi
  return 0
}
cloud_guard_after() {
  [ "${JARVIS_GUARD_OFF:-}" = 1 ] && return 0
  local RP; RP=$(cg_repo)
  if [ "${JARVIS_CLOUD:-}" = 1 ]; then
    cg_ids "$RP" "origin/main..HEAD" | $SG "mkdir -p $CG_DIR && chmod 700 $CG_DIR && cat >> $CG_DIR/deploy-cloud.txt" > /dev/null 2>&1 \
      && echo "  cloud guard: recorded this deploy's cloud commits" || echo "  cloud guard: COULD NOT record this deploy (the laptop's next deploy may not know about it)"
  else
    local p
    { echo "$(git -C "$RP" rev-parse HEAD)"; echo "$1"
      while IFS= read -r p; do [ -n "$p" ] && printf '%s\t%s\n' "$p" "$(git -C "$RP" hash-object -- "$p" 2>/dev/null)"; done \
        < <(cd "$RP" && git status --porcelain -uno -- $CG_INPUTS 2>/dev/null | sed -E 's/^.. //; s/^"(.*)"$/\1/' | grep -v ' -> ')
    } | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=s.split('\n').filter(Boolean),d={};for(const r of l.slice(2)){const i=r.lastIndexOf('\t');if(i>0)d[r.slice(0,i)]=r.slice(i+1)}process.stdout.write(JSON.stringify({head:l[0],at:Math.floor(Date.now()/1000),label:l[1],dirty:d}))})" |
      $SG "mkdir -p $CG_DIR && chmod 700 $CG_DIR && cat > $CG_DIR/deploy-laptop.json" > /dev/null 2>&1 && echo "  cloud guard: recorded this deploy for the cloud" || true
  fi
  return 0
}

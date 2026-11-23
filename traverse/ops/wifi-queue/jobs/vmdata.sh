#!/bin/bash
# Wi-Fi queue job (22 Nov 2026, Matthew: "door data and customer files may live on the cloud machine ... start now, data upload overnight";
# traverse/ops/VM-MAIN-WORKSPACE.md): the data the VM cannot rebuild or fetch itself, from this laptop into ~/main on the VM, the same paths.
# Only files git ignores (data, never code: code goes by git) under the roots below, minus what is re-downloadable or rebuilt (the Drive
# backup's own cache list: LiDAR, building tiles, raw downloads, caches, logs, PDFs; plus the assessor downloads, built editions, videos,
# old *.before-* snapshots). NEVER: personal/pay/, Surge's restricted notes, anything Surge, codes/keys/tokens/secrets/accounts files,
# browser profiles, -private/ folders, finance files (the filter refuses them by name, and the plan is checked again before each send).
# 23 Nov 2026 (Matthew: "move everything over", yes to codes, Surge notes, pay, finance): every ignored file in the whole repo now goes,
# except what the VM rebuilds (editions/dist, node_modules, .exe) and browser profiles. Run a new pass: VMDATA_AGAIN=1 (only new files go).
# One unit = one chunk (~150 MB before compression): tar.gz -> the VM as a .part file -> md5 of the whole file -> unpacked into ~/main ->
# md5 of every file. A drop on hotel Wi-Fi costs one chunk, which is sent again next run. Exit 0 all sent, 3 more left, 4 network/hotspot.
# Run again any time: a new pass sends only files whose size or time changed since they were sent (state/vmdata/sent.tsv).
source "$(dirname "$0")/_common.sh"
OPS="$Q/.."; REPO="$(cd "$OPS/../.." && pwd)"; S="$Q/state/vmdata"; mkdir -p "$S/chunks"
PB="$(cygpath -u "$LOCALAPPDATA")/ProjectBackup"; VM="$(cat "$PB/cloud-sync/vm.txt" 2>/dev/null || echo yard@40.78.175.13)"; VK="/c/Users/SURGEI~1/.ssh/azure_yard"
v() { ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -i "$VK" "$VM" "$@"; }
JS="$REPO/assistant/jarvis/tools/jarvis-status.sh"
on_hotspot && { echo "on the hotspot - waiting"; exit 4; }
JL="$Q/state/vmdata.lock.d"; mkdir "$JL" 2>/dev/null || { [ $(( $(date +%s) - $(stat -c %Y "$JL") )) -gt 7200 ] && rmdir "$JL" && mkdir "$JL" || { echo "vmdata already running"; exit 4; }; }; trap 'rmdir "$JL" 2>/dev/null' EXIT
v 'test -d ~/main/.git' || { echo "the VM did not answer, or has no ~/main (vm-main.sh prep)"; exit 4; }

# ---- the plan: made when there is none, or the last one is all sent (then only what changed since) ------------------------------------
if [ ! -s "$S/plan.tsv" ] || [ -z "$(cd "$S/chunks" && for l in *.list; do [ -f "$l" ] && [ ! -f "${l%.list}.done" ] && echo "$l"; done 2>/dev/null | head -1)" ]; then
  [ -s "$S/plan.tsv" ] && [ -f "$S/pass.done" ] && [ "${VMDATA_AGAIN:-}" != 1 ] && { echo "all sent (VMDATA_AGAIN=1 for a new pass)"; exit 0; }
  rm -rf "$S/chunks"; mkdir -p "$S/chunks"; rm -f "$S/pass.done"
  ( cd "$REPO" && git ls-files --others --ignored --exclude-standard -z )   # 23 Nov: the whole repo (Matthew: move everything over) > "$S/ignored.z" || { echo "git listing failed"; exit 1; }
  ( cd "$REPO" && node -e '
    const fs = require("fs"), [lf, sent, dir] = process.argv.slice(1), MAX = 150e6;
    const NEVER = /chrome-profile|\/Chrome[^\/]*\/|(^|\/)\.ssh\//i;   // 23 Nov: everything else goes now (Matthew: codes, Surge notes, pay, finance too)
    const REBUILT = /^traverse\/editions\/dist\/|(^|\/)node_modules\/|\.exe$/i;   // 23 Nov: only what is rebuilt on the VM
    const ORDER = [/^traverse\/app\/data\//, /^traverse\/data-pipeline\//, /^traverse\//, /^sixfold\//, /^matthew\//, /./];   // door data first
    const done = new Map(); try { for (const l of fs.readFileSync(sent, "utf8").split("\n")) { const [p, s, t] = l.split("\t"); if (p) done.set(p, s + "\t" + t); } } catch (e) {}
    const files = []; let odd = 0;
    for (const p of fs.readFileSync(lf, "utf8").split("\0").filter(Boolean)) {
      if (NEVER.test(p) || REBUILT.test(p)) continue; if (!/^[A-Za-z0-9 ._\/@+(),&#-]+$/.test(p)) { odd++; continue; }
      let st; try { st = fs.statSync(p); } catch (e) { continue; } if (!st.isFile()) continue;
      const sig = st.size + "\t" + Math.floor(st.mtimeMs / 1000); if (done.get(p) === sig) continue;
      files.push({ p, s: st.size, sig, o: ORDER.findIndex(r => r.test(p)) });
    }
    files.sort((a, b) => a.o - b.o || (a.p < b.p ? -1 : 1));
    let n = 0, cur = [], size = 0, tot = 0; const rows = [];
    const flush = () => { if (!cur.length) return; n++; const id = String(n).padStart(4, "0");
      fs.writeFileSync(dir + "/" + id + ".list", cur.map(f => f.p).join("\0") + "\0"); fs.writeFileSync(dir + "/" + id + ".sig", cur.map(f => f.p + "\t" + f.sig).join("\n") + "\n");
      rows.push(id + "\t" + cur.length + "\t" + size); cur = []; size = 0; };
    for (const f of files) { if (size + f.s > MAX && cur.length) flush(); cur.push(f); size += f.s; tot += f.s; }
    flush();
    fs.writeFileSync(dir + "/../plan.tsv", rows.join("\n") + (rows.length ? "\n" : ""));
    console.log("plan: " + files.length + " files, " + (tot / 1e9).toFixed(2) + " GB before compression, " + n + " chunk(s)" + (odd ? "; " + odd + " file(s) with unusual characters in the name left for a hand copy" : ""));
  ' "$S/ignored.z" "$S/sent.tsv" "$S/chunks" ) || { echo "plan failed"; exit 1; }
  [ -s "$S/plan.tsv" ] || { touch "$S/pass.done"; echo "nothing to send"; exit 0; }
  date '+%F %T' > "$S/pass.started"
  bash "$JS" build start vm-data "Data upload to the cloud machine (door data, working data, customer files)" "$(wc -l < "$S/plan.tsv")" > /dev/null 2>&1
fi

# ---- one chunk ---------------------------------------------------------------------------------------------------------------------
ID=""; while IFS=$'\t' read -r id n sz; do [ -f "$S/chunks/$id.done" ] || { ID="$id"; break; }; done < "$S/plan.tsv"
[ -n "$ID" ] || { touch "$S/pass.done"; bash "$JS" build done vm-data "all sent ($(wc -l < "$S/plan.tsv") chunks)" > /dev/null 2>&1; echo "all sent"; exit 0; }
TOTAL=$(wc -l < "$S/plan.tsv"); NDONE=$(ls "$S/chunks/"*.done 2>/dev/null | wc -l)
# the refusal again, on the exact list about to go (belt and braces)
if tr '\0' '\n' < "$S/chunks/$ID.list" | grep -iqE 'chrome-profile|/Chrome[^/]*/|(^|/)\.ssh/'; then
  echo "chunk $ID holds a name that must never go: STOPPED"; exit 1; fi
cd "$REPO" || exit 1
C="$PB/vmdata-chunk.tgz"; rm -f "$C" "$C.md5"
echo "$(date +%T) chunk $ID of $TOTAL: $(tr '\0' '\n' < "$S/chunks/$ID.list" | wc -l) files, $(( $(awk -F'\t' -v i="$ID" '$1==i{print $3}' "$S/plan.tsv") / 1048576 )) MB"
tar --null -T "$S/chunks/$ID.list" -czf "$C" || { echo "tar failed"; exit 1; }
tr '\0' '\n' < "$S/chunks/$ID.list" | while IFS= read -r f; do md5sum "$f"; done | sed 's/ \*/  /' > "$C.md5"
L5=$(md5sum < "$C" | cut -c1-32); echo "  packed $(( $(stat -c %s "$C") / 1048576 )) MB"
on_hotspot && { echo "on the hotspot before the send - waiting"; exit 4; }
T0=$(date +%s)
v 'mkdir -p ~/jarvis/incoming/vmdata && cat > ~/jarvis/incoming/vmdata/c.tgz.part' < "$C" || { echo "  the send dropped after $(( $(date +%s) - T0 )) s: this chunk goes again next run"; exit 4; }
v 'cat > ~/jarvis/incoming/vmdata/c.md5' < "$C.md5" || exit 4
R=$(v "cd ~/jarvis/incoming/vmdata && [ \"\$(md5sum < c.tgz.part | cut -c1-32)\" = $L5 ] || { echo BADSUM; exit 0; }; tar -xzf c.tgz.part -C ~/main && cd ~/main && md5sum -c --quiet ~/jarvis/incoming/vmdata/c.md5 > /dev/null 2>&1 && echo OK || echo BADFILES; rm -f ~/jarvis/incoming/vmdata/c.tgz.part") || { echo "  the check dropped: again next run"; exit 4; }
case "$R" in
  OK) touch "$S/chunks/$ID.done"; cat "$S/chunks/$ID.sig" >> "$S/sent.tsv"; rm -f "$C" "$C.md5"; NDONE=$((NDONE + 1))
      echo "  sent and checked in $(( $(date +%s) - T0 )) s ($NDONE of $TOTAL)"
      bash "$JS" build step vm-data "$NDONE" "$NDONE of $TOTAL chunks on the cloud machine, every file checked" > /dev/null 2>&1;;
  BADSUM) echo "  the file arrived damaged (md5): sent again next run"; exit 4;;
  *) echo "  unpacked, but a file's md5 differs on the VM ($R)"; exit 1;;
esac
[ "$NDONE" -ge "$TOTAL" ] && { touch "$S/pass.done"; bash "$JS" build done vm-data "all $TOTAL chunks sent and checked" > /dev/null 2>&1; echo "all sent"; exit 0; }
exit 3

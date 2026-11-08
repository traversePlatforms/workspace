#!/bin/bash
# The ONE local demo copy for the demo-universal video (7 Nov 2026): the Roofing edition's built code (traverse/editions/dist) with one
# town of data (Highlands Ranch), and the Lawn & Landscape and Solar editions' per-door layers for the same town added to its data folder
# (lawn outlines, sun and solar, the funding and water sheets), so one house card shows every fact. One made-up company on every screen:
# "Example Co", (303) 555-0100, office@example.com. Served by PHP's own server on 127.0.0.1:8811. Never a live install.
#   bash demo-universal-copy.sh reset    stop, remake from dist, start, add the people and pick the house (setup-demo-universal.mjs)
#   bash demo-universal-copy.sh start | stop | make
# Rebuild dist first if the app changed:
#   cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs
# company.json is the live Roofing one (copied down read-only, once, into <DEMO_DIR>/live/), with the Solar layer, the lawn, trees and
# water card parts switched on and a mixed service list; the made-up company's name and contacts go on top in company-local.json (as the
# Company screen saves them).
set -eu
T="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$T/../.." && pwd)"; D="$R/editions/dist"
S="$(cd "$T" && node -e "import('./demo-universal-config.mjs').then((m) => process.stdout.write(m.DEMO_DIR))")"
TOWN="$(cd "$T" && node -e "import('./demo-universal-config.mjs').then((m) => process.stdout.write(m.TOWN))")"
case "$S" in *scratchpad*|*demo*) ;; *) echo "refusing: $S does not look like the scratch demo folder"; exit 1;; esac
APP=tr-cb2e8587; PRE=traverse; DATA=traverse-data; PRIV=traverse-private; PORT=8811
mkdir -p "$S/live"

make_one() {
  local root="$S/one" dst="$S/one/$DATA/rounds"; rm -rf "$root"; mkdir -p "$root/public_html/api" "$dst/docs" "$root/$PRIV" "$root/traverse-shared"
  cp -r "$D/public_html/$APP" "$root/public_html/"
  for k in rounds billing skiptrace sms webpush; do cp "$D/public_html/api/$PRE-$k.php" "$root/public_html/api/"; done
  for f in care-lib eod-lib fb-leads-lib jobber-lib mail-oauth-lib satcache square-oauth mail-oauth fb-oauth traverse-clients-lib; do [ -f "$R/app/api/$f.php" ] && cp "$R/app/api/$f.php" "$root/public_html/api/"; done
  # Roofing's files for the town and the files that are no town's; then the other editions' layers for the same town (the ones Roofing
  # leaves out: lawn outlines, solar, the solar power-company table), and Lawn & Landscape's funding and water sheets
  node -e '
    const fs=require("fs"), [dist,dst,town]=process.argv.slice(1);
    const isTown=(f,k)=>f===k+".json"||f===k+"-lookup.json"||f.endsWith("-"+k+".json");
    const idx=JSON.parse(fs.readFileSync(dist+"/traverse-data/rounds/index.json","utf8")); const keys=idx.regions.map(r=>r.key);
    let n=0; const take=(src,f)=>{ fs.copyFileSync(src+"/"+f, dst+"/"+f); n++; };
    const R=dist+"/traverse-data/rounds";
    for (const f of fs.readdirSync(R)) { if (fs.statSync(R+"/"+f).isDirectory() || f==="index.json" || f==="company.json") continue;
      if (isTown(f,town) || !keys.some(k=>isTown(f,k))) take(R,f); }
    const add=[["traverse-yards-data", (f)=>/^lawnmask-/.test(f)&&isTown(f,town)], ["traverse-solar-data", (f)=>(/^solar-/.test(f)&&isTown(f,town))||f==="solar-utilities.json"]];
    for (const [ed,ok] of add) { const E=dist+"/"+ed+"/rounds"; for (const f of fs.readdirSync(E)) if (ok(f) && !fs.existsSync(dst+"/"+f)) take(E,f); }
    const Y=dist+"/traverse-yards-data/rounds/docs/money.json"; if (!fs.existsSync(Y)) throw new Error("no Lawn & Landscape money.json in dist");
    fs.copyFileSync(Y, dst+"/docs/money.json");
    idx.regions=idx.regions.filter(r=>r.key===town); if (!idx.regions.length) throw new Error("no town "+town);
    if (idx.shared) { const sh={}; for (const [k,v] of Object.entries(idx.shared)) if (k===town) sh[k]=v; idx.shared=sh; }
    fs.writeFileSync(dst+"/index.json", JSON.stringify(idx));
    for (const k of ["hail","roof","permit","moved","lawnmask","solar"]) if (!fs.existsSync(dst+"/"+k+"-"+town+".json")) throw new Error("missing layer "+k+"-"+town);
    console.log("  "+town+": "+n+" files");
  ' "$D" "$dst" "$TOWN"
  # the live Roofing company.json, read once (read-only) from the server, never written back
  [ -s "$S/live/company-$DATA.json" ] || bash ~/.ssh/sg.sh trav "cat ~/www/traverseplatforms.com/$DATA/rounds/company.json" > "$S/live/company-$DATA.json"
  node -e '
    const fs=require("fs"), [src,dst]=process.argv.slice(1); const c=JSON.parse(fs.readFileSync(src,"utf8"));
    Object.assign(c.features, { solar: true });
    Object.assign(c.card, { lawn: true, trees: true, water: true, solar: true });
    c.services=[["roof","Roof work"],["lawn","Lawn care"],["solar","Solar install"],["inspection","Inspection"],["other","Other"]];
    c.leadNeeds=["Roof or storm damage","Lawn care","Solar quote","Question"];
    fs.writeFileSync(dst, JSON.stringify(c, null, 2) + "\n");
  ' "$S/live/company-$DATA.json" "$dst/company.json"
  node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({name:"Example Co", short:"Example Co", tagline:"Home services", phone:"(303) 555-0100", email:"office@example.com", site:"example.com"}))' "$dst/company-local.json"
  # local test codes only: one admin (333333); the people are added by setup-demo-universal.mjs
  node -e 'const [f]=process.argv.slice(1); const k=require("crypto").randomBytes(32).toString("hex");
    require("fs").writeFileSync(f, "<?php\nreturn [\n  \"session_key\" => \"" + k + "\",\n  \"session_days\" => 45,\n  \"people\" => [\n    \"333333\" => [\"Jordan Blake\", \"admin\"],\n  ],\n];\n")' "$root/$PRIV/rounds-codes.php"
  echo "made: $root"
}
# PHP is started detached through PowerShell (a nohup child kept the calling shell waiting until the server ended) and stopped by its port
start() {
  local w ca; w="$(cygpath -w "$S/one")"
  # PHP's curl needs a CA list on Windows (the aerial photo tiles, satcache.php, came back "HTTP 0" without one): Git's, copied beside the
  # copy and named in an extra ini file read through PHP_INI_SCAN_DIR (a -d value with the short path's ~ does not parse)
  for b in /c/Program\ Files/Git/*/etc/ssl/certs/ca-bundle.crt; do [ -f "$b" ] && cp "$b" "$S/cacert.pem"; done; ca="$(cygpath -w "$S/cacert.pem")"
  mkdir -p "$S/ini"; printf 'curl.cainfo="%s"\nopenssl.cafile="%s"\nmemory_limit=1024M\n' "$ca" "$ca" > "$S/ini/demo.ini"
  powershell.exe -NoProfile -Command "\$env:PHP_INI_SCAN_DIR = '$(cygpath -w "$S/ini")'; Start-Process -FilePath php -ArgumentList '-S','127.0.0.1:$PORT','-t','public_html' -WorkingDirectory '$w' -WindowStyle Hidden -RedirectStandardError '$w\\php.log' -RedirectStandardOutput '$w\\php-out.log'"
  sleep 2; echo "on http://127.0.0.1:$PORT/$APP/"
}
stop() { powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force; 'stopped $PORT' }" || true; sleep 1; return 0; }
case "${1:-}" in
  make) make_one;;
  start) start;;
  stop) stop;;
  reset) stop; rm -f "$S/demo.json"; make_one; start; (cd "$T" && node setup-demo-universal.mjs);;
  *) echo "usage: bash demo-universal-copy.sh reset | start | stop | make"; exit 1;;
esac

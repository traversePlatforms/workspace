#!/bin/bash
# The LOCAL demo copies for the demo-editions video (2 Nov 2026): Roofing (Parker), Lawn & Landscape (Castle Rock) and Solar (Highlands
# Ranch), each on today's built code (traverse/editions/dist) with one town of data, served by PHP's own server. Never a live install.
#   bash demo-copies.sh reset    stop, remake all three from dist, start, add the people and pick the houses (setup-demo.mjs)
#   bash demo-copies.sh start | stop | make
# Ports: Roofing 8801, Yards 8802, Solar 8803; local admin code 333333 (test only). Rebuild dist first if the app changed:
#   cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs
# Each copy's company.json is the live one (copied down read-only, once, into <DEMO_DIR>/live/), with a made-up company name on top
# (company-local.json, as the Company screen saves it).
set -eu
T="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$T/../.." && pwd)"; D="$R/editions/dist"
S="$(cd "$T" && node -e "import('./demo-config.mjs').then((m) => process.stdout.write(m.DEMO_DIR))")"
case "$S" in *scratchpad*|*demo*) ;; *) echo "refusing: $S does not look like the scratch demo folder"; exit 1;; esac
mkdir -p "$S/live"
EDS="roofing:tr-cb2e8587:traverse:traverse-data:traverse-private:8801:parker:Example Roofing Co:Example Roofing:Roofs and storm repair
yards:ty-25604fff:traverse-yards:traverse-yards-data:traverse-yards-private:8802:castle-rock:Example Lawn & Land Co:Example Lawn:Lawn care and yard work
solar:ts-016064fc:traverse-solar:traverse-solar-data:traverse-solar-private:8803:highlands-ranch:Example Solar Co:Example Solar:Solar and battery installs"

make_one() {
  IFS=: read -r ed app pre data priv port town name short tag <<< "$1"
  local root="$S/$ed" src="$D/$data/rounds"; rm -rf "$root"; mkdir -p "$root/public_html/api" "$root/$data/rounds" "$root/$priv" "$root/traverse-shared"
  cp -r "$D/public_html/$app" "$root/public_html/"
  for k in rounds billing skiptrace sms webpush; do cp "$D/public_html/api/$pre-$k.php" "$root/public_html/api/"; done
  for f in care-lib eod-lib fb-leads-lib jobber-lib mail-oauth-lib satcache square-oauth mail-oauth fb-oauth; do cp "$R/app/api/$f.php" "$root/public_html/api/"; done
  # every file of the one town, and the files that are no town's; index.json cut to the one town
  node -e '
    const fs=require("fs"), [src,dst,town]=process.argv.slice(1);
    const idx=JSON.parse(fs.readFileSync(src+"/index.json","utf8")); const keys=idx.regions.map(r=>r.key);
    const isTown=(f,k)=>f===k+".json"||f===k+"-lookup.json"||f.endsWith("-"+k+".json");
    let n=0; for (const f of fs.readdirSync(src)) { if (fs.statSync(src+"/"+f).isDirectory() || f==="index.json") continue;
      if (isTown(f,town) || !keys.some(k=>isTown(f,k))) { fs.copyFileSync(src+"/"+f, dst+"/"+f); n++; } }
    idx.regions=idx.regions.filter(r=>r.key===town); if (!idx.regions.length) throw new Error("no town "+town);
    if (idx.shared) { const sh={}; for (const [k,v] of Object.entries(idx.shared)) if (k===town) sh[k]=v; idx.shared=sh; }
    fs.writeFileSync(dst+"/index.json", JSON.stringify(idx)); console.log("  "+town+": "+n+" files");
  ' "$src" "$root/$data/rounds" "$town"
  [ -d "$src/docs" ] && cp -r "$src/docs" "$root/$data/rounds/"
  # the live company.json, read once (read-only) from the server, never written back
  [ -s "$S/live/company-$data.json" ] || bash /c/Users/SURGEI~1/.ssh/sg.sh trav "cat ~/www/traverseplatforms.com/$data/rounds/company.json" > "$S/live/company-$data.json"
  cp "$S/live/company-$data.json" "$root/$data/rounds/company.json"
  node -e 'const [f,n,s,t]=process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({name:n, short:s, tagline:t, phone:"(303) 555-0100", email:"office@example.com", site:"example.com"}))' \
    "$root/$data/rounds/company-local.json" "$name" "$short" "$tag"
  # local test codes only: one admin (333333); the people are added by setup-demo.mjs
  node -e 'const [f]=process.argv.slice(1); const k=require("crypto").randomBytes(32).toString("hex");
    require("fs").writeFileSync(f, "<?php\nreturn [\n  \"session_key\" => \"" + k + "\",\n  \"session_days\" => 45,\n  \"people\" => [\n    \"333333\" => [\"Jordan Blake\", \"admin\"],\n  ],\n];\n")' "$root/$priv/rounds-codes.php"
  echo "$ed made: $root"
}
start() { while IFS= read -r l; do IFS=: read -r ed app pre data priv port rest <<< "$l"
  ( cd "$S/$ed" && nohup php -d memory_limit=768M -S 127.0.0.1:$port -t public_html > php.log 2>&1 < /dev/null & ); echo "$ed on http://127.0.0.1:$port/$app/"; done <<< "$EDS"; sleep 2; }
stop() { for p in 8801 8802 8803; do pid=$(netstat -ano | awk -v p=":$p" '$2 ~ p"$" && $4=="LISTENING"{print $5}' | head -1); [ -n "$pid" ] && taskkill //PID "$pid" //F > /dev/null && echo "stopped $p"; done; return 0; }
case "${1:-}" in
  make) while IFS= read -r l; do make_one "$l"; done <<< "$EDS";;
  start) start;;
  stop) stop;;
  reset) stop; rm -f "$S/demo.json"; while IFS= read -r l; do make_one "$l"; done <<< "$EDS"; start; (cd "$T" && node setup-demo.mjs);;
  *) echo "usage: bash demo-copies.sh reset | start | stop | make"; exit 1;;
esac

#!/bin/bash
# Open traverseplatforms.com's marketing pages to the public (Matthew's go needed; staged 2026-10-28 for launch).
#   bash traverse/ops/open-site.sh          open it: password off, the 7 marketing pages indexable, robots.txt + sitemap.xml, cache flushed, checked
#   bash traverse/ops/open-site.sh undo     put back the backups taken by the last open (password and noindex back on)
# The apps (summit, the five editions), api/, maps/, the hub, the prospect and Peak desks keep X-Robots-Tag noindex; robots.txt never names them.
set -e
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
MODE="${1:-open}"
if [ "$MODE" = "undo" ]; then
  $SG 'cd $HOME/www/traverseplatforms.com/public_html && B=$(ls -d $HOME/upload-backups/open-site-* 2>/dev/null | tail -1) && [ -n "$B" ] && tar xzf $B/before.tgz && rm -f robots.txt sitemap.xml && [ -f $B/had-robots ] && cp $B/robots.txt . ; chmod 600 index.html; find demo editions privacy terms terms-of-use cancellation shots -type f -exec chmod 600 {} \; ; site-tools-client domain-all update id=traverseplatforms.com flush_cache=1 | grep -o "msg=OK"; echo "undone from $B"'
  exit 0
fi
read -r -d '' REMOTE <<'EOS' || true
set -e
cd $HOME/www/traverseplatforms.com/public_html
S=$(date +%Y%m%d-%H%M%S); B=$HOME/upload-backups/open-site-$S; mkdir -p $B
PAGES="index.html demo/index.html editions/index.html privacy/index.html terms/index.html terms-of-use/index.html cancellation/index.html"
tar czf $B/before.tgz .htaccess $PAGES; [ -f robots.txt ] && { cp robots.txt $B/; touch $B/had-robots; }
php -r '
$f = ".htaccess"; $h = file_get_contents($f);
$a = strpos($h, "<If \"%{REQUEST_URI} =~ m#^/(index"); $b = $a === false ? false : strpos($h, "</If>", $a); $c1 = 0; $n = $h;
if ($a !== false && $b !== false && strpos(substr($h, $a, $b - $a), "AuthType Basic") !== false) { $n = substr($h, 0, $a) . "# 2026-10-28: the marketing pages are public (launch); the password block that stood here is in upload-backups/open-site-*." . substr($h, $b + 5); $c1 = 1; }
$n = str_replace("Header set X-Robots-Tag \"noindex, nofollow\"\n", "", $n, $c2);
$n .= "\n# 2026-10-28 launch: only the seven marketing pages may be indexed; every app, api, map and desk keeps noindex\n<If \"%{REQUEST_URI} !~ m#^/(index\\.html)?$# && %{REQUEST_URI} !~ m#^/(demo|editions|privacy|terms|terms-of-use|cancellation)(/|$)# && %{REQUEST_URI} !~ m#^/(robots\\.txt|sitemap\\.xml|og\\.png)$#\">\n  Header set X-Robots-Tag \"noindex, nofollow\"\n</If>\n";
if ($c1 !== 1 || $c2 !== 1) { fwrite(STDERR, "htaccess: auth block $c1, robots header $c2 (expected 1 and 1): not changed\n"); exit(1); }
file_put_contents($f . ".tmp", $n); rename($f . ".tmp", $f); echo "htaccess: password block removed, noindex limited to non-marketing paths\n";'
for p in $PAGES; do php -r '$f=$argv[1]; $h=file_get_contents($f); $n=str_replace("<meta name=\"robots\" content=\"noindex, nofollow\">", "", $h, $c); file_put_contents($f, $n); echo "$f: noindex meta removed ($c)\n";' $p; done
printf 'User-agent: *\nAllow: /\nSitemap: https://traverseplatforms.com/sitemap.xml\n' > robots.txt
D=$(date +%Y-%m-%d); { echo '<?xml version="1.0" encoding="UTF-8"?>'; echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  for u in "" demo/ editions/ privacy/ terms/ terms-of-use/ cancellation/; do echo "  <url><loc>https://traverseplatforms.com/$u</loc><lastmod>$D</lastmod></url>"; done; echo '</urlset>'; } > sitemap.xml
chmod 600 index.html robots.txt sitemap.xml; find demo editions privacy terms terms-of-use cancellation shots -type f -exec chmod 600 {} \;   # no-cache from Apache, not the front server's six-month copy
site-tools-client domain-all update id=traverseplatforms.com flush_cache=1 | grep -o "msg=OK" | sed 's/^/cache flush /'
echo "backup: $B"
EOS
echo "$REMOTE" | $SG 'bash -s'
echo "--- checks, as a visitor"
for u in / /demo/ /editions/ /privacy/ /terms/ /terms-of-use/ /cancellation/ /robots.txt /sitemap.xml; do
  for q in "" "?cb=$(date +%s)"; do
    r=$(curl -s -o /tmp/os.html -D /tmp/os.h -w '%{http_code}' "https://traverseplatforms.com$u$q"); xr=$(grep -i '^x-robots-tag' /tmp/os.h | tr -d '\r' | cut -d' ' -f2-); mt=$(grep -c 'content="noindex' /tmp/os.html)
    echo "$u$q  $r  x-robots:[${xr:-none}]  meta-noindex:$mt"; done; done
for u in /summit-de59ae83/ /api/rounds.php /prospects-47bfe6/; do echo "$u keeps: $(curl -s -o /dev/null -D - "https://traverseplatforms.com$u" | grep -i '^x-robots-tag' | tr -d '\r')"; done

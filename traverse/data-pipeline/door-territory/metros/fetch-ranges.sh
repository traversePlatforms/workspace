#!/bin/bash
# The rest of a big public file in N byte ranges at once, then joined (16 Nov 2026: fbcad.org sends ~1 MB a minute per connection).
# Resumes: each part keeps what it has. The file grows only when every part is whole.
#   bash metros/fetch-ranges.sh <url> <file> [parts=4]
set -u
U="$1"; F="$2"; P="${3:-4}"
TOTAL=$(curl -sSI -L -A "Mozilla/5.0" "$U" | tr -d '\r' | awk 'tolower($1)=="content-length:"{v=$2} END{print v}')
HAVE=$( [ -f "$F" ] && stat -c %s "$F" || echo 0 )
[ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ] || { echo "no length for $U"; exit 1; }
[ "$HAVE" -ge "$TOTAL" ] && { echo "already whole: $F"; exit 0; }
LEFT=$((TOTAL - HAVE)); SZ=$(( (LEFT + P - 1) / P ))
part() { # part <i>
  local i=$1 a b want got
  a=$((HAVE + i * SZ)); b=$((a + SZ - 1)); [ $b -ge $((TOTAL - 1)) ] && b=$((TOTAL - 1)); want=$((b - a + 1))
  for t in $(seq 1 30); do
    got=$( [ -f "$F.part$i" ] && stat -c %s "$F.part$i" || echo 0 ); [ "$got" -ge "$want" ] && return 0
    curl -sS -L -A "Mozilla/5.0" -r "$((a + got))-$b" "$U" >> "$F.part$i" || sleep 20
  done
  return 1
}
for i in $(seq 0 $((P - 1))); do part "$i" & done; wait
for i in $(seq 0 $((P - 1))); do [ -f "$F.part$i" ] || { echo "part $i missing"; exit 1; }; done
for i in $(seq 0 $((P - 1))); do cat "$F.part$i" >> "$F"; done
[ "$(stat -c %s "$F")" -eq "$TOTAL" ] && { rm -f "$F".part*; echo "ok  $F $TOTAL"; } || { echo "SIZE WRONG $F"; exit 1; }

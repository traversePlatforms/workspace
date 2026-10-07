#!/bin/bash
# Door lists for the editions' own towns (2026-10-07, traverse/research/edition-towns-2026-10.md): each town drawn by its legal
# boundary (--municipality), one pull per county it spans, merged into <town>.csv by merge-walklists.mjs.
# Centennial was pulled by hand (one county). The El Paso towns (Roofing, Security) use build-walklist.mjs and come separately.
set -eu
cd "$(dirname "$0")"
pull() { node build-walklist-co.mjs --county=$1 --lat=$2 --lon=$3 --radius=$4 --min-acres=0.12 --municipality="$5" --out="$6" 2>&1 | grep -E "doors to knock|written|boundary|dropped"; }
echo "== Arvada";        pull JEFFERSON 39.83 -105.11 6 "Arvada" arvada-jeff.csv;  pull ADAMS 39.83 -105.06 3 "Arvada" arvada-adams.csv;     node merge-walklists.mjs arvada.csv arvada-jeff.csv arvada-adams.csv
echo "== Thornton";      pull ADAMS 39.91 -104.95 6 "Thornton" thornton-adams.csv; pull WELD 39.99 -104.96 3 "Thornton" thornton-weld.csv;    node merge-walklists.mjs thornton.csv thornton-adams.csv thornton-weld.csv
echo "== Windsor";       pull WELD 40.48 -104.88 5 "Windsor" windsor-weld.csv;     pull LARIMER 40.48 -104.98 4 "Windsor" windsor-larimer.csv; node merge-walklists.mjs windsor.csv windsor-weld.csv windsor-larimer.csv
echo "== Erie";          pull WELD 40.04 -105.03 4 "Erie" erie-weld.csv;           pull BOULDER 40.04 -105.08 3 "Erie" erie-boulder.csv;     node merge-walklists.mjs erie.csv erie-weld.csv erie-boulder.csv
echo "== Commerce City"; pull ADAMS 39.87 -104.85 7 "Commerce City" commerce-city.csv
echo done

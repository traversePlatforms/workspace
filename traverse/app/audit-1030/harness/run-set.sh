#!/bin/bash
# bash run-set.sh <install...>: the audit crawl matrix for each install, one after another, on this harness's server
P="$(cd "$(dirname "$0")" && pwd)"; cd "$P"
for inst in "$@"; do
  node ed-mode.cjs "$inst"
  rm -rf "$P/sixfold-data/ratelimit"; mkdir -p "$P/sixfold-data/ratelimit"
  rm -f "$P/results/$inst.jsonl"
  echo "== $inst $(date +%H:%M:%S)"
  timeout 3000 node crawl.mjs "$inst" admin phone,tabP,tabL,desk light
  timeout 1800 node crawl.mjs "$inst" admin phone,tabP,tabL,desk dark
  rm -rf "$P/sixfold-data/ratelimit"; mkdir -p "$P/sixfold-data/ratelimit"
  timeout 1800 node crawl.mjs "$inst" super tabP,desk light
  timeout 1800 node crawl.mjs "$inst" crew,office phone,tabP,tabL,desk light
  timeout 1200 node crawl.mjs "$inst" crew,office phone,tabP dark
  timeout 900 node crawl.mjs "$inst" manager phone,tabP light
  echo "== $inst done $(date +%H:%M:%S)"
done

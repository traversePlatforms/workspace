#!/bin/bash
# musicedit.sh <in> <out.wav> "<src_start>:<video_at>:<len> ..." : cuts a music track into pieces and lays each piece at a video time,
# with 0.25 s crossfades. Put the joins on the booms (14, 22, 26 s) so they are hidden. Output is 32 s, 44.1 kHz stereo.
set -e
IN="$1"; OUT="$2"; SEGS="$3"; X=0.25; FC=""; L=""; n=0
for s in $SEGS; do IFS=: read -r src at len <<< "$s"
  ms=$(printf '%.0f' $(echo "$at*1000"|bc -l)); fo=$(echo "$len-$X"|bc -l)
  FC="$FC[0]atrim=$src:$(echo "$src+$len"|bc -l),asetpts=PTS-STARTPTS,afade=in:d=$X,afade=out:st=$fo:d=$X,adelay=$ms|$ms[s$n];"; L="$L[s$n]"; n=$((n+1)); done
ffmpeg -v error -y -i "$IN" -filter_complex "${FC}${L}amix=inputs=$n:normalize=0,apad,atrim=0:32" -ar 44100 -ac 2 "$OUT"

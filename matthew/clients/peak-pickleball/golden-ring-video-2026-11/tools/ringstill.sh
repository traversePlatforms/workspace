#!/bin/bash
# ringstill.sh <in.mov> <time> <transpose 0|1> <ring-centre-y> <zoom> <dur> <push 0.06> <sweep-at s|-> <out.mp4>
# One sharp frame from a ring clip (no hand shake), ring cut onto black like ringgrade.sh, then a smooth slow push-in
# (zoompan on a 4x frame, so no pixel jitter) and an optional gold glint that sweeps across the ring only.
# The ring sits 360 px higher than centre so the text cards below it stay clear.
set -e
in=$1; t=$2; tr=$3; cy=$4; z=$5; dur=$6; push=$7; sw=$8; out=$9
W=$(dirname "$out")/rs-$$; mkdir -p $W
MX='max(r(X,Y),max(g(X,Y),b(X,Y)))'; MN='min(r(X,Y),min(g(X,Y),b(X,Y)))'
M="255*clip(((${MX}-${MN})/(${MX}+1)-0.16)*5,0,1)"
pre=""; [ "$tr" = 1 ] && pre="transpose=2,"
cw=$(printf '%.0f' $(echo "1080/$z" | bc -l)); ch=$(printf '%.0f' $(echo "1920/$z" | bc -l)); cw=$((cw/2*2)); ch=$((ch/2*2))
yy=$(( cy - ch/2 )); [ $yy -lt 0 ] && yy=0; [ $((yy+ch)) -gt 1920 ] && yy=$((1920-ch))
# 1. the still: ring on black (still.png) and its mask (mask.png), shifted up 360 px
ffmpeg -v error -y -ss $t -i "$in" -filter_complex "
[0:v]${pre}scale=1080:1920,crop=$cw:$ch:(1080-$cw)/2:$yy,scale=1080:1920:flags=lanczos,format=rgb24,split[a][b];
[b]scale=540:960,geq=r='$M':g='$M':b='$M',format=gray,dilation,dilation,dilation,dilation,erosion,erosion,gblur=sigma=4,scale=1080:1920,split[m][m2];
[a]eq=contrast=1.12:saturation=1.25:gamma=0.97,unsharp=5:5:0.6,format=rgba[c];[c][m]alphamerge[k];
color=black:s=1080x1920[bg];[bg][k]overlay,vignette=PI/4.5,crop=1080:1560:0:360,pad=1080:1920:0:0:black[o];
[m2]crop=1080:1560:0:360,pad=1080:1920:0:0:black[mo]" -map "[o]" -frames:v 1 -update 1 $W/still.png -map "[mo]" -frames:v 1 -update 1 $W/mask.png
# 2. smooth push-in on both (same zoompan, so the glint stays on the ring)
n=$(printf '%.0f' $(echo "$dur*30" | bc -l))
ZP="scale=4320:7680:flags=lanczos,zoompan=z='1+$push*on/$n':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$n:s=1080x1920:fps=30"
ffmpeg -v error -y -loop 1 -i $W/still.png -vf "$ZP,format=yuv420p" -frames:v $n -c:v libx264 -crf 15 -preset medium $W/push.mp4
if [ "$sw" = "-" ]; then mv $W/push.mp4 "$out"; rm -rf $W; exit 0; fi
ffmpeg -v error -y -loop 1 -i $W/mask.png -vf "format=gray,gblur=sigma=40,lutyuv=y='min(255,val*2.6)',$ZP,format=gray" -frames:v $n -c:v libx264 -crf 15 -preset medium $W/pmask.mp4
# 3. glint: a soft diagonal band crossing the frame in 1.1 s from time $sw, warm gold, limited to the ring by the mask
ffmpeg -v error -y -f lavfi -i "color=black:s=270x480:r=30:d=$dur" -vf "format=gray,geq=lum='255*exp(-pow(((X*4+Y*4*0.45)-(-500+2400*(T-$sw)/1.1))/110,2))*between(T,$sw,$sw+1.1)',scale=1080:1920" -c:v libx264 -crf 15 $W/band.mp4
ffmpeg -v error -y -i $W/push.mp4 -i $W/pmask.mp4 -i $W/band.mp4 -filter_complex "
[1]format=gray[m];[2]format=gray[b];[b][m]blend=all_mode=multiply,format=gbrp,colorchannelmixer=rr=1:gg=0.85:bb=0.55[g];
[0]format=gbrp[v];[v][g]blend=all_mode=screen:all_opacity=0.85,format=yuv420p" -c:v libx264 -crf 15 -preset medium "$out"
rm -rf $W

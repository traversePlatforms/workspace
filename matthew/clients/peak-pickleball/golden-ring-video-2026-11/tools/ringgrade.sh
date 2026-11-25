#!/bin/bash
# ringgrade.sh <in.mov> <out.mp4> <transpose:0|1> <ring-centre-y in 1920> [zoom] [speed]  -> 1080x1920 ring on black, slowed
in=$1; out=$2; tr=$3; cy=$4; z=${5:-1.35}; sp=${6:-0.5}
MX='max(r(X,Y),max(g(X,Y),b(X,Y)))'; MN='min(r(X,Y),min(g(X,Y),b(X,Y)))'
M="255*clip(((${MX}-${MN})/(${MX}+1)-0.16)*5,0,1)"
pre=""; [ "$tr" = 1 ] && pre="transpose=2,"
cw=$(printf '%.0f' $(echo "1080/$z" | bc -l)); ch=$(printf '%.0f' $(echo "1920/$z" | bc -l)); cw=$((cw/2*2)); ch=$((ch/2*2))
yy=$(( cy - ch/2 )); [ $yy -lt 0 ] && yy=0; [ $((yy+ch)) -gt 1920 ] && yy=$((1920-ch))
ffmpeg -v error -y -i "$in" -filter_complex "
[0:v]${pre}scale=1080:1920,crop=$cw:$ch:(1080-$cw)/2:$yy,scale=1080:1920,format=rgb24,split[a][b];
[b]scale=540:960,geq=r='$M':g='$M':b='$M',format=gray,dilation,dilation,dilation,dilation,erosion,erosion,gblur=sigma=4,scale=1080:1920[m];
[a]eq=contrast=1.12:saturation=1.25:gamma=0.97,format=rgba[c];[c][m]alphamerge[k];
color=black:s=1080x1920:r=25[bg];[bg][k]overlay=shortest=1,vignette=PI/4.5,setpts=PTS/$sp,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:vsbmc=1,format=yuv420p" -an -c:v libx264 -crf 16 -preset medium "$out"

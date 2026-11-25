#!/bin/bash
# Golden Ring ad (Cammie's brief, 24 Nov 2026): 1080x1920, 30 fps, 32 s. Two versions: voiceover and text only.
#   bash tools/build.sh            -> out/golden-ring-vo.mp4 and out/golden-ring-text.mp4
#   MUSIC=path/to/track.mp3 bash tools/build.sh   -> same, with the music bed mixed in (Meta Sound Collection track)
#   MUSIC_AT=12 shifts where the track starts (seconds into the track) so its drop lands on the 14 s competition cut.
# Real footage only for the ring and the club; the AI plates in ai/ (Gemini) are light, dust, smoke and flare only.
set -e
cd "$(dirname "$0")/.."
S=source; P=$S/library-pikes-peak; W=work; O=out; mkdir -p $W $O
ENC="-an -r 30 -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p"
V="1080:1920"
# a still plate, slowly pushing in, for D seconds
plate() { ffmpeg -v error -y -loop 1 -t $2 -i "$1" -vf "scale=1080:1920,scale=w='1080*(1+0.10*t/$2)':h=-2:eval=frame,crop=1080:1920,fps=30" $ENC "$3"; }
# match clip: start, length, out
act() { ffmpeg -v error -y -ss $2 -t $3 -i $P/IMG_$1.MOV -vf "scale=$V,eq=contrast=1.1:saturation=1.08:gamma=1.15:brightness=0.02,colorbalance=rh=0.04:bh=-0.03,vignette=PI/5.5,fps=30" $ENC "$4"; }

echo "plates"; plate ai/dust.jpg 32 $W/p-dust.mp4; plate ai/rays.jpg 6 $W/p-rays.mp4; plate ai/smoke.jpg 3 $W/p-smoke.mp4

# Scenes are made a little LONGER than their slot (handles), so each scene change can be a real transition (xfade) while
# every scene still starts on its beat: 5, 7, 9, 12.5, 14, 22, 26 s. Transition at T of length d starts at T - d/2.
echo "S1 reveal 0-5 (+0.2 tail)"   # sharp still from MVI_0151 (the clips are hand-held), smooth push and a gold glint: tools/ringstill.sh
[ -f $W/st151h.mp4 ] || bash tools/ringstill.sh $S/MVI_0151.mov 1.52 0 1500 1.12 5.2 0.08 2.6 $W/st151h.mp4
ffmpeg -v error -y -i $W/st151h.mp4 -i $W/p-dust.mp4 -filter_complex "[0]trim=0:5.2,setpts=PTS-STARTPTS,fade=in:st=0:d=2.2,format=gbrp[r];[1]trim=0:5.2,setpts=PTS-STARTPTS,format=gbrp[d];[r][d]blend=all_mode=screen:all_opacity=0.55,format=yuv420p" $ENC $W/s1.mp4
echo "S2 stakes 5-9: ring and shield together"   # the LEGEND side alone, then it eases down and back while the shield rises in above it
[ -f $W/st150k.mp4 ] || MASKOUT=$W/st150k-mask.mp4 bash tools/ringstill.sh $S/MVI_0150.mov 1.36 0 1480 1.12 4.5 0.06 0.7 $W/st150k.mp4
X="clip((t-1.3)/1.0\\,0\\,1)"; E="($X*$X*(3-2*$X))"; SC="(1-0.38*$E)"; TY="(670+260*$E)"
ffmpeg -v error -y -i $W/st150k.mp4 -loop 1 -t 4.5 -i "$S/library-golden-ring/Golden Ring Pickleball Shield Logo-2.png" -i $W/p-rays.mp4 -i $W/st150k-mask.mp4 -filter_complex "
color=black:s=1080x1920:r=30:d=4.5[bg];[1]scale=540:-2,format=rgba,fade=in:st=1.4:d=0.8:alpha=1[sh];[bg][sh]overlay=270:60,format=gbrp[b1];
[2]trim=0:4.5,setpts=PTS-STARTPTS,fade=in:st=1.4:d=0.8,format=gbrp[ry];[b1][ry]blend=all_mode=screen:all_opacity=0.5[b2];
[3]format=gray[am];[0][am]alphamerge,scale=w='1080*$SC':h='1920*$SC':eval=frame[rs];
[b2]format=rgba[b3];[b3][rs]overlay=x='540-495*$SC':y='$TY-670*$SC':eval=frame,format=yuv420p" -t 4.5 $ENC $W/s2.mp4
echo "S3 arena 9-14"
FL=$(ls $S/library-facility/*.mp4 | head -1)
ffmpeg -v error -y -ss 6.7 -t 4.0 -i "$FL" -vf "crop=608:1080:(1920-608)/2:0,scale=$V,eq=contrast=1.1:saturation=1.05:gamma=1.12:brightness=0.02,colorbalance=rh=0.05:bh=-0.04,vignette=PI/5.5,fps=30" $ENC $W/s3a.mp4
ffmpeg -v error -y -ss 25.4 -t 1.85 -i "$FL" -vf "crop=608:1080:(1920-608)/2-120:0,scale=$V,eq=contrast=1.1:saturation=1.05:gamma=1.12:brightness=0.02,colorbalance=rh=0.05:bh=-0.04,vignette=PI/5.5,fps=30" $ENC $W/s3b.mp4
echo "S4 competition 14-22 (hard cuts inside, on the beat)"
act 3730 0.65 0.95 $W/c1.mp4; act 3749 1.2 0.8 $W/c2.mp4; act 3741 0.3 0.8 $W/c3.mp4; act 3721 0.0 0.9 $W/c4.mp4
act 3731 1.2 0.9 $W/c5.mp4; act 3740 1.0 0.8 $W/c6.mp4; act 3748 2.3 0.8 $W/c7.mp4; act 3738 2.8 1.0 $W/c8.mp4
# last cut: medal podium on Peak's 1st/2nd blocks (Veterans Tournament, Day 3; Peak camera, shot sideways so transpose=2), in place of the clapping fans
ffmpeg -v error -y -ss 0.2 -t 1.45 -i "$S/library-veterans/d3/MVI_0007 (1).MOV" -vf "transpose=2,scale=$V,eq=contrast=1.08:saturation=1.1:gamma=1.25:brightness=0.04,colorbalance=rh=0.04:bh=-0.03,vignette=PI/5.5,fps=30" $ENC $W/c9.mp4
: > $W/list4.txt; for f in c1 c2 c3 c4 c5 c6 c7 c8 c9; do echo "file '$f.mp4'" >> $W/list4.txt; done
ffmpeg -v error -y -f concat -safe 0 -i $W/list4.txt -c copy $W/s4.mp4
echo "S5 road 22-26"
[ -f $W/st151bh.mp4 ] || bash tools/ringstill.sh $S/MVI_0151.mov 1.32 0 1500 1.40 4.75 0.08 1.85 $W/st151bh.mp4
ffmpeg -v error -y -i $W/st151bh.mp4 -i $W/p-rays.mp4 -filter_complex "[0]trim=0:4.75,setpts=PTS-STARTPTS,format=gbrp[r];[1]trim=0:4.75,setpts=PTS-STARTPTS,format=gbrp[y];[r][y]blend=all_mode=screen:all_opacity=0.35,format=yuv420p" $ENC $W/s5.mp4
echo "End 26-32 (+0.5 head)"
ffmpeg -v error -y -f lavfi -t 6.5 -i color=black:s=1080x1920:r=30 -i $W/p-dust.mp4 -filter_complex "[1]trim=25.5:32,setpts=PTS-STARTPTS,format=gbrp[d];[0]format=gbrp[b];[b][d]blend=all_mode=screen:all_opacity=0.7,format=yuv420p" $ENC $W/s6.mp4

echo "transitions"   # scene: next transition (type, length)
#  5 ring top -> LEGEND side: white-gold flash   9 ring and shield -> arena: cross-fade
#  12.5 courts -> sign: whip blur   14 -> matches: quick flash on the drop   22 -> ring: dip through black   26 ring -> end card: slow cross-fade
XF="fadewhite:0.4:5 fade:0.6:9 hblur:0.4:12.5 fadewhite:0.3:14 fadeblack:0.6:22 fade:1.0:26"
IN=""; for f in s1 s2 s3a s3b s4 s5 s6; do IN="$IN -i $W/$f.mp4"; done
FC=""; for i in 0 1 2 3 4 5 6; do FC="$FC[$i]fps=30,settb=1/30,format=yuv420p[n$i];"; done
prev=n0; k=1; for x in $XF; do IFS=: read -r ty d T <<< "$x"; o=$(echo "$T-$d/2"|bc -l)
  FC="$FC[$prev][n$k]xfade=transition=$ty:duration=$d:offset=$o[x$k];"; prev=x$k; k=$((k+1)); done
ffmpeg -v error -y $IN -filter_complex "${FC%;}" -map "[$prev]" -t 32 $ENC $W/base.mp4
echo "base $(ffprobe -v error -show_entries format=duration -of csv=p=0 $W/base.mp4)"

echo "flare track"   # a gold flare burst on each scene change
FB=""; for t in 4.85 8.85 13.85 21.85 25.85; do FB="$FB$t "; done
ffmpeg -v error -y -loop 1 -t 0.6 -i ai/flare.jpg -vf "scale=1080:1920,scale=w='1080*(1+1.6*t/0.6)':h=1920:eval=frame,crop=1080:1920,fps=30,fade=in:st=0:d=0.15,fade=out:st=0.2:d=0.4" $ENC $W/burst.mp4
ffmpeg -v error -y -f lavfi -t 32 -i color=black:s=1080x1920:r=30 $ENC $W/black32.mp4
IN="-i $W/black32.mp4"; FC="[0]format=yuv420p[b0]"; i=1; prev=b0
for t in $FB; do IN="$IN -itsoffset $t -i $W/burst.mp4"; FC="$FC;[$i]format=yuv420p[f$i];[$prev][f$i]overlay=eof_action=pass[b$i]"; prev=b$i; i=$((i+1)); done
ffmpeg -v error -y $IN -filter_complex "$FC" -map "[$prev]" -t 32 $ENC $W/flares.mp4

echo "text + flares"
# cards: file, in, out
T="text/t1.png 2.4 4.7|text/t2.png 5.5 8.8|text/t4.png 18.6 21.8|text/t5.png 22.5 25.8|text/end.png 26.1 32.5"
IN="-i $W/base.mp4 -i $W/flares.mp4"; FC="[0]format=gbrp[a];[1]format=gbrp[f];[a][f]blend=all_mode=screen,format=yuv420p[v0]"; i=2; prev=v0
IFS='|'; for row in $T; do IFS=' ' read -r f a b <<< "$row"; d=$(echo "$b-$a" | bc -l)
  IN="$IN -loop 1 -t $d -i $f"
  FC="$FC;[$i]format=rgba,fade=in:st=0:d=0.35:alpha=1,fade=out:st=$(echo "$d-0.3"|bc -l):d=0.3:alpha=1,setpts=PTS+$a/TB[t$i];[$prev][t$i]overlay=eof_action=pass:format=auto[v$i]"; prev=v$i; i=$((i+1)); done; unset IFS
ffmpeg -v error -y $IN -filter_complex "$FC" -map "[$prev]" -t 32 $ENC $W/picture.mp4

echo "sound"
bash tools/sound.sh
for ver in vo text; do
  A="$W/mix-$ver.wav"
  ffmpeg -v error -y -i $W/picture.mp4 -i $A -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart $O/golden-ring-$ver.mp4
  echo "$O/golden-ring-$ver.mp4 $(ffprobe -v error -show_entries format=duration -of csv=p=0 $O/golden-ring-$ver.mp4)"
done

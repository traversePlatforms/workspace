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
act() { ffmpeg -v error -y -ss $2 -t $3 -i $P/IMG_$1.MOV -vf "scale=$V,eq=contrast=1.18:saturation=1.08:gamma=0.92,colorbalance=rh=0.04:bh=-0.03,vignette=PI/4,fps=30" $ENC "$4"; }

echo "plates"; plate ai/dust.jpg 32 $W/p-dust.mp4; plate ai/rays.jpg 6 $W/p-rays.mp4; plate ai/smoke.jpg 3 $W/p-smoke.mp4
[ -f $W/r151.mp4 ] || bash tools/ringgrade.sh $S/MVI_0151.mov $W/r151.mp4 0 1560
[ -f $W/r150.mp4 ] || bash tools/ringgrade.sh $S/MVI_0150.mov $W/r150.mp4 0 1480
[ -f $W/r149.mp4 ] || bash tools/ringgrade.sh $S/MVI_0149.mov $W/r149.mp4 1 1480

echo "S1 reveal 0-5"
ffmpeg -v error -y -i $W/r151.mp4 -i $W/p-dust.mp4 -filter_complex "[0]crop=1080:1560:0:360,pad=1080:1920:0:0:black,setpts=PTS*1.12,tpad=stop_mode=clone:stop_duration=1,trim=0:5,scale=w='1080*(1+0.12*t/5)':h=-2:eval=frame,crop=1080:1920,fps=30,fade=in:st=0:d=2.2,format=gbrp[r];[1]trim=0:5,setpts=PTS-STARTPTS,format=gbrp[d];[r][d]blend=all_mode=screen:all_opacity=0.55,format=yuv420p" $ENC $W/s1.mp4
echo "S2 stakes 5-9"
ffmpeg -v error -y -i $W/r150.mp4 -t 2 -i $W/r150.mp4 -filter_complex "[0]crop=1080:1560:0:360,pad=1080:1920:0:0:black,trim=0.6:2.6,setpts=PTS-STARTPTS,scale=w='1080*(1+0.10*t/2)':h=-2:eval=frame,crop=1080:1920,fps=30" $ENC $W/s2a.mp4
ffmpeg -v error -y -loop 1 -t 2 -i "$S/library-golden-ring/Golden Ring Pickleball Shield Logo-2.png" -i $W/p-rays.mp4 -filter_complex "[0]scale=880:-2,pad=1080:1920:(ow-iw)/2:330:black,scale=w='1080*(1+0.08*t/2)':h=-2:eval=frame,crop=1080:1920,fps=30,format=gbrp[l];[1]trim=0:2,setpts=PTS-STARTPTS,format=gbrp[r];[l][r]blend=all_mode=screen:all_opacity=0.6,format=yuv420p" $ENC $W/s2b.mp4
echo "S3 arena 9-14"
FL=$(ls $S/library-facility/*.mp4 | head -1)
ffmpeg -v error -y -ss 7.0 -t 3.5 -i "$FL" -vf "crop=608:1080:(1920-608)/2:0,scale=$V,eq=contrast=1.2:saturation=1.05:gamma=0.9,colorbalance=rh=0.05:bh=-0.04,vignette=PI/4,fps=30" $ENC $W/s3a.mp4
ffmpeg -v error -y -ss 25.6 -t 1.5 -i "$FL" -vf "crop=608:1080:(1920-608)/2-120:0,scale=$V,eq=contrast=1.2:saturation=1.05:gamma=0.9,colorbalance=rh=0.05:bh=-0.04,vignette=PI/4,fps=30" $ENC $W/s3b.mp4
echo "S4 competition 14-22"
act 3730 0.8 0.8 $W/c1.mp4; act 3749 1.2 0.8 $W/c2.mp4; act 3741 0.3 0.8 $W/c3.mp4; act 3721 0.0 0.9 $W/c4.mp4
act 3731 1.2 0.9 $W/c5.mp4; act 3740 1.0 0.8 $W/c6.mp4; act 3748 2.3 0.8 $W/c7.mp4; act 3738 2.8 1.0 $W/c8.mp4; act 3743 0.4 1.2 $W/c9.mp4
echo "S5 road 22-26"
ffmpeg -v error -y -i $W/r149.mp4 -i $W/p-rays.mp4 -filter_complex "[0]crop=1080:1560:0:360,pad=1080:1920:0:0:black,tpad=stop_mode=clone:stop_duration=1,trim=0:4,setpts=PTS-STARTPTS,scale=w='1080*(1+0.10*t/4)':h=-2:eval=frame,crop=1080:1920,fps=30,format=gbrp[r];[1]trim=0:4,setpts=PTS-STARTPTS,format=gbrp[y];[r][y]blend=all_mode=screen:all_opacity=0.35,format=yuv420p" $ENC $W/s5.mp4
echo "End 26-32"
ffmpeg -v error -y -f lavfi -t 6 -i color=black:s=1080x1920:r=30 -i $W/p-dust.mp4 -filter_complex "[1]trim=26:32,setpts=PTS-STARTPTS,format=gbrp[d];[0]format=gbrp[b];[b][d]blend=all_mode=screen:all_opacity=0.7,format=yuv420p" $ENC $W/s6.mp4

echo "concat"
: > $W/list.txt; for f in s1 s2a s2b s3a s3b c1 c2 c3 c4 c5 c6 c7 c8 c9 s5 s6; do echo "file '$f.mp4'" >> $W/list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i $W/list.txt -c copy $W/base.mp4
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

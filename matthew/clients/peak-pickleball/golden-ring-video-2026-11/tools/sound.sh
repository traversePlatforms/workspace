#!/bin/bash
# sound.sh: sound design made from scratch (rising drone, booms on each scene change, whooshes before them) plus the voiceover,
# and the music bed if MUSIC is set. Writes work/mix-vo.wav and work/mix-text.wav (32 s).
set -e
cd "$(dirname "$0")/.."
W=work; R=44100
# drone: two low sines rising in volume over the reveal, holding low under the rest
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.22*(sin(2*PI*55*t)+0.6*sin(2*PI*82.5*t)+0.3*sin(2*PI*110*t+sin(2*PI*0.3*t)))*min(1,t/4.5)*if(lt(t,5),1,0.45)':s=$R:d=32" -ac 2 $W/drone.wav
# boom: a deep hit with a short noisy attack
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.95*sin(2*PI*(42+30*exp(-8*t))*t)*exp(-2.6*t)+0.25*(random(0)-0.5)*exp(-18*t)':s=$R:d=2" -af lowpass=f=900 -ac 2 $W/boom.wav
# whoosh: filtered noise swelling into the hit
ffmpeg -v error -y -f lavfi -i "anoisesrc=d=0.7:c=pink:r=$R:a=0.5" -af "highpass=f=400,lowpass=f=5000,afade=in:st=0:d=0.6:curve=exp,afade=out:st=0.6:d=0.1" -ac 2 $W/whoosh.wav
# tick: a short snap for each fast cut in the competition
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.5*(random(0)-0.5)*exp(-60*t)+0.4*sin(2*PI*120*t)*exp(-14*t)':s=$R:d=0.4" -ac 2 $W/tick.wav

HITS="5.0 9.0 14.0 22.0 26.0"
CUTS="14.8 15.6 16.4 17.3 18.2 19.0 19.8 20.8"
VOAT="2.5 5.5 9.6 19.0 22.6 26.4"

sfx() {  # ElevenLabs sound effects (sfx/*.mp3) laid at fixed times over the homemade drone: "file time gain [fade-out-at]"
  local LIST="riser 0.7 0.6
impact 5.0 0.5
hit2 9.0 0.55
braam 14.0 0.5
impact 22.0 0.5
braam 26.0 0.45
whoosh 4.78 0.6
whoosh 8.78 0.6
whoosh 13.78 0.6
whoosh 21.78 0.6
whoosh 25.78 0.6
shimmer 2.6 1.0
shimmer 5.5 1.0
shimmer 23.6 1.0
cheer 20.7 0.35 1.4"
  for t in $CUTS; do LIST="$LIST
swish $t 0.35"; done
  local IN="-i $W/drone.wav" FC="[0]volume=0.6[d];" L="[d]" n=1
  while read -r f t g fo; do ms=$(printf '%.0f' $(echo "$t*1000"|bc -l)); IN="$IN -i sfx/$f.mp3"
    fx="aresample=$R,volume=$g"; [ -n "$fo" ] && fx="$fx,afade=out:st=$fo:d=0.6"
    FC="$FC[$n]$fx,adelay=$ms|$ms[x$n];"; L="$L[x$n]"; n=$((n+1)); done <<< "$LIST"
  ffmpeg -v error -y $IN -filter_complex "${FC}${L}amix=inputs=$n:normalize=0,alimiter=limit=0.95,atrim=0:32" -ac 2 -ar $R $W/sfx.wav
}
vo() {  # VODIR picks the voice (default vo/); a line longer than its slot is sped up (at most 15%) so it never runs into the next
  local IN="" FC="" L="" n=0 i=1 D=${VODIR:-vo} A=($VOAT 31.85)
  for t in $VOAT; do ms=$(printf '%.0f' $(echo "$t*1000"|bc -l)); IN="$IN -i $D/l$i.mp3"
    len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $D/l$i.mp3); room=$(echo "${A[$i]}-$t-0.1"|bc -l)
    sp=$(python3 -c "print(min(1.15,max(1.0,$len/$room)))")
    FC="$FC[$n]aresample=$R,atempo=$sp,adelay=$ms|$ms,pan=stereo|c0=c0|c1=c0[v$n];"; L="$L[v$n]"; n=$((n+1)); i=$((i+1)); done
  ffmpeg -v error -y $IN -filter_complex "${FC}${L}amix=inputs=$n:normalize=0,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,apad,atrim=0:32" -ac 2 -ar $R $W/vo.wav
}
sfx; vo
if [ -n "$MUSIC" ]; then
  ffmpeg -v error -y -ss "${MUSIC_AT:-0}" -i "$MUSIC" -af "atrim=0:32,afade=in:st=0:d=1.5,afade=out:st=30.5:d=1.5,aresample=$R" -ac 2 $W/music.wav
  MV="-i $W/music.wav"; MT=1
else MV=""; MT=0; fi
# voiceover version: voice on top; music ducked under the voice (sidechain) when there is music
if [ $MT = 1 ]; then
  ffmpeg -v error -y -i $W/sfx.wav -i $W/vo.wav $MV -filter_complex "[1]asplit=3[v1][v2][v3];[2]volume=0.8[m];[m][v2]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=300[md];[0]volume=0.7[s0];[s0][v3]sidechaincompress=threshold=0.03:ratio=8:attack=10:release=250[s];[s][md][v1]amix=inputs=3:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11" -ar $R $W/mix-vo.wav
  ffmpeg -v error -y -i $W/sfx.wav $MV -filter_complex "[1]volume=1.0[m];[0]volume=0.7[s];[s][m]amix=inputs=2:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11" -ar $R $W/mix-text.wav
else
  ffmpeg -v error -y -i $W/sfx.wav -i $W/vo.wav -filter_complex "[1]asplit[v1][v2];[0]volume=0.8[s0];[s0][v2]sidechaincompress=threshold=0.03:ratio=8:attack=10:release=250[s];[s][v1]amix=inputs=2:normalize=0,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11" -ar $R $W/mix-vo.wav
  ffmpeg -v error -y -i $W/sfx.wav -filter_complex "[0]alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11" -ar $R $W/mix-text.wav
fi
echo "mixes done (music: $MT)"

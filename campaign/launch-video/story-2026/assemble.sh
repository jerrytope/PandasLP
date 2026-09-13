#!/bin/bash
# Builds the debt-recovery brand film.
#
#   node campaign/launch-video/story-2026/generate-frames.mjs
#   bash campaign/launch-video/story-2026/assemble.sh
#
# Timing is driven by the voiceover, not guessed: each scene is held for the
# length of its narration line plus a pause, so nothing is cut off and nothing
# feels hurried.
#
# Transitions vary by context rather than using one uniform crossfade:
#   - inside the chat, messages appear on a fast cut (they are one screen)
#   - inside the clock, steps advance on a short dissolve
#   - between acts, a long slow dissolve
# Motion is near-static on purpose. A constant Ken Burns push on every card is
# the home-video tell; here only the letter moves, because that is the one shot
# where a slow push adds intimacy.
set -e
cd "$(dirname "$0")"

FF="$HOME/ffmpeg-portable/ffmpeg-8.1.2-essentials_build/bin/ffmpeg.exe"
FP="$HOME/ffmpeg-portable/ffmpeg-8.1.2-essentials_build/bin/ffprobe.exe"
OUT="pandas-lp-debt-recovery.mp4"
FPS=30
LEADIN=0.8                 # beat of silence before the first line
PAD=0.55                   # pause after each narration line
VQ="-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p"

# frame : voiceover line it belongs to : share of that line : zoom : fade INTO this frame
# Frames sharing a vo split its duration between them.
SCENES=(
  "01-open:01:1:1.015:0"
  "02-firm:02:1:1.015:0.7"
  "03-chat1:03:1:1.000:0.7"
  "04-chat2:04:3:1.000:0.18"
  "05-chat3:04:3:1.000:0.18"
  "06-chat4:04:3:1.000:0.18"
  "07-chat5:05:1:1.000:0.18"
  "08-letter:06:1:1.050:0.7"
  "09-letter-signed:07:2:1.050:0.5"
  "10-gate:07:2:1.015:0.7"
  "11-day0:08:1:1.000:0.7"
  "12-day7:09:1:1.000:0.25"
  "13-day14:10:1:1.000:0.25"
  "14-day15:11:2:1.000:0.25"
  "15-court:11:2:1.015:0.7"
  "16-enforcement:12:1:1.015:0.7"
  "17-compare:13:2:1.000:0.7"
  "18-price:13:2:1.015:0.5"
  "19-end:14:1:1.015:0.7"
)

dur_of () { "$FP" -v error -show_entries format=duration -of csv=p=0 "vo/vo$1.mp3"; }

rm -rf seg && mkdir -p seg

echo "→ segments"
n=${#SCENES[@]}
declare -a D XF NAME
for ((i=0; i<n; i++)); do
  IFS=':' read -r name vo share zoom xf <<< "${SCENES[$i]}"
  NAME[$i]="$name"; XF[$i]="$xf"
  vod=$(dur_of "$vo")
  # each frame gets its slice of the line, plus its slice of the trailing pause
  d=$(awk "BEGIN{printf \"%.3f\", ($vod + $PAD) / $share}")
  [ "$i" -eq 0 ] && d=$(awk "BEGIN{printf \"%.3f\", $d + $LEADIN}")
  D[$i]="$d"
  frames=$(awk "BEGIN{printf \"%d\", $d * $FPS}")
  "$FF" -y -v error -loop 1 -i "frames/$name.png" \
    -filter_complex "[0:v]scale=3840:2160,zoompan=z='min(1+(on/$frames)*($zoom-1),$zoom)':d=$frames:s=1920x1080:fps=$FPS,setsar=1[v]" \
    -map "[v]" -t "$d" $VQ "seg/$(printf '%02d' $i).mp4"
  printf "   %-18s %5.2fs\n" "$name" "$d"
done

# ── where each scene lands on the final timeline (xfade overlaps eat time) ──
declare -a START
START[0]=0
for ((i=1; i<n; i++)); do
  START[$i]=$(awk "BEGIN{printf \"%.3f\", ${START[$((i-1))]} + ${D[$((i-1))]} - ${XF[$i]}}")
done
TOTAL=$(awk "BEGIN{printf \"%.3f\", ${START[$((n-1))]} + ${D[$((n-1))]}}")

echo "→ crossfading (${TOTAL}s)"
vin=""
for f in seg/*.mp4; do vin="$vin -i $f"; done
vf=""; prev="[0:v]"
for ((j=1; j<n; j++)); do
  out="[x$j]"; [ "$j" -eq $((n-1)) ] && out="[v]"
  vf="$vf$prev[$j:v]xfade=transition=fade:duration=${XF[$j]}:offset=${START[$j]}$out;"
  prev="$out"
done
"$FF" -y -v error $vin -filter_complex "${vf%;}" -map "[v]" $VQ silent.mp4

# ── narration, each line placed at the moment its first frame appears ──
echo "→ narration"
ain=""; af=""; mixn=0
declare -A PLACED
for ((i=0; i<n; i++)); do
  IFS=':' read -r name vo share zoom xf <<< "${SCENES[$i]}"
  [ -n "${PLACED[$vo]}" ] && continue      # only on the first frame of a shared line
  PLACED[$vo]=1
  at=$(awk "BEGIN{printf \"%d\", (${START[$i]} + 0.25) * 1000}")
  [ "$i" -eq 0 ] && at=$(awk "BEGIN{printf \"%d\", $LEADIN * 1000}")
  ain="$ain -i vo/vo$vo.mp3"
  af="$af[$mixn:a]adelay=$at|$at[d$mixn];"
  mixn=$((mixn+1))
done
mixins=""
for ((k=0; k<mixn; k++)); do mixins="$mixins[d$k]"; done
"$FF" -y -v error $ain -filter_complex "$af${mixins}amix=inputs=$mixn:normalize=0:dropout_transition=0[a]" \
  -map "[a]" -ac 2 -ar 48000 -c:a pcm_s16le narration.wav

echo "→ mux"
"$FF" -y -v error -i silent.mp4 -i narration.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"

rm -rf seg silent.mp4 narration.wav
d=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$OUT")
printf "\n✓ %s  %.1fs  %sKB\n" "$OUT" "$d" "$(( $(wc -c < "$OUT") / 1024 ))"

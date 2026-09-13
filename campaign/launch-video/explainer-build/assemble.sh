#!/bin/bash
set -e
FF="/c/Users/Newadmin/ffmpeg-portable/ffmpeg-8.1.2-essentials_build/bin/ffmpeg.exe"
cd "$(dirname "$0")"

# Quality: crf 16 (near-visually-lossless) + slower preset for better compression efficiency,
# up from the previous default crf 23. Same 1280x720 (matches native AI clip resolution --
# upscaling stills alone to 1080p wouldn't add real detail since they'd be composited with
# 720p video anyway).
VQ="-c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p"

# Scene 1 — image, no VO, fixed 3s, silent audio
"$FF" -y -loop 1 -i scene1.png -f lavfi -i anullsrc=r=24000:cl=mono \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.0006,1.1)':d=75:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 3.0 -shortest seg1.mp4

# Scene 2 — video, gentle stretch 5s -> 5.71s (was 2x before, now barely stretched)
"$FF" -y -i scene2.mp4 -i vo2.wav \
  -filter_complex "[0:v]setpts=(5.71/5)*PTS,scale=1280:720[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 5.71 seg2.mp4

# Scene 3 — image + VO 4.246s
"$FF" -y -loop 1 -i scene3.png -i vo3.wav \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.001,1.08)':d=106:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 4.246 seg3.mp4

# Scene 4 — image + VO 6.234s
"$FF" -y -loop 1 -i scene4.png -i vo4.wav \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.0009,1.1)':d=156:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 6.234 seg4.mp4

# Scene 5 — image + VO 8.205s
"$FF" -y -loop 1 -i scene5.png -i vo5.wav \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.0007,1.1)':d=205:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 8.205 seg5.mp4

# Scene 6 — image + VO 4.869s
"$FF" -y -loop 1 -i scene6.png -i vo6.wav \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.001,1.08)':d=122:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 4.869 seg6.mp4

# Scene 7 — video, gentle stretch 5s -> 6.317s
"$FF" -y -i scene7.mp4 -i vo7.wav \
  -filter_complex "[0:v]setpts=(6.317/5)*PTS,scale=1280:720[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 6.317 seg7.mp4

# Scene 8 — image + VO 6.48s (unchanged)
"$FF" -y -loop 1 -i scene8.png -i vo8.wav \
  -filter_complex "[0:v]scale=1280:720,zoompan=z='min(zoom+0.001,1.15)':d=162:s=1280x720:fps=25[v]" \
  -map "[v]" -map 1:a $VQ -c:a aac -t 6.48 seg8.mp4

printf "file 'seg1.mp4'\nfile 'seg2.mp4'\nfile 'seg3.mp4'\nfile 'seg4.mp4'\nfile 'seg5.mp4'\nfile 'seg6.mp4'\nfile 'seg7.mp4'\nfile 'seg8.mp4'\n" > concat_list.txt

"$FF" -y -f concat -safe 0 -i concat_list.txt -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart pandas-lp-explainer-FINAL.mp4

echo "DONE"
ls -la pandas-lp-explainer-FINAL.mp4

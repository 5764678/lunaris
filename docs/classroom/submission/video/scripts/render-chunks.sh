#!/usr/bin/env bash
# Renders a composition in 900-frame chunks (each in a fresh process, retried up to 3 times) and joins
# them without re-encoding. Long single renders stall when Remotion recycles a tab mid-render.
# Usage (from video/): scripts/render-chunks.sh <Composition> <out.mp4> [extra remotion flags...]
set -euo pipefail
COMP=$1; OUT=$2; shift 2
TOTAL=4950; STEP=900
DIR=out/chunks-$COMP; mkdir -p "$DIR"; : > "$DIR/list.txt"
for ((s=0; s<TOTAL; s+=STEP)); do
  e=$(( s+STEP-1 < TOTAL-1 ? s+STEP-1 : TOTAL-1 ))
  f="$DIR/part-$(printf %05d $s).mp4"
  if [ ! -s "$f" ]; then
    for try in 1 2 3; do
      if npx remotion render src/index.ts "$COMP" "$f" --frames=$s-$e --muted --concurrency 1 --timeout 120000 --log error "$@" 2>&1 | grep -v -i "memory\|docker\|lower amount"; then :; fi
      [ -s "$f" ] && break
      echo "chunk $s-$e failed (try $try)"
    done
  fi
  [ -s "$f" ] || { echo "chunk $s-$e failed 3 times"; exit 1; }
  echo "file '$(basename "$f")'" >> "$DIR/list.txt"
  echo "chunk $s-$e ok"
done
ffmpeg -v error -f concat -safe 0 -i "$DIR/list.txt" -c copy -movflags +faststart -y "$OUT"
ffprobe -v error -show_entries stream=width,height,r_frame_rate,nb_frames:format=duration,size -of compact "$OUT"

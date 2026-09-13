#!/bin/bash
set -e
cd "$(dirname "$0")"
N="/c/Users/Newadmin/nodejs-portable/node-v22.23.1-win-x64/node.exe"
LAYOUT="${1:-v}"
OUTDIR="frames-${LAYOUT}"
TOTAL=$($N film.mjs plan | head -1 | grep -oE '[0-9]+ frames' | grep -oE '[0-9]+')
WORKERS=7
CHUNK=$(( (TOTAL + WORKERS - 1) / WORKERS ))
rm -rf "$OUTDIR"; mkdir -p "$OUTDIR"
echo "→ $TOTAL frames, $WORKERS workers, chunk=$CHUNK, layout=$LAYOUT"
pids=()
for ((w=0; w<WORKERS; w++)); do
  from=$((w*CHUNK))
  to=$(( (w+1)*CHUNK )); [ $to -gt $TOTAL ] && to=$TOTAL
  [ $from -ge $to ] && continue
  "$N" film.mjs $from $to "$LAYOUT" "$OUTDIR" > "log-$w.txt" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
count=$(ls "$OUTDIR" | wc -l)
echo "→ done: $count/$TOTAL frames in $OUTDIR"

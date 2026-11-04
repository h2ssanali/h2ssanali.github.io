#!/usr/bin/env bash
# Import Hassan's work from Google Drive and make it web-ready.
#   1) list every video in the folders   2) download   3) transcode + poster + preview loop
# Usage:  scripts/import.sh [folder-url ...]      (defaults to the four portfolio folders)
# Needs: python3, ffmpeg. Folders must be shared as "Anyone with the link".
set -euo pipefail
cd "$(dirname "$0")/.."

FOLDERS=("$@")
if [ ${#FOLDERS[@]} -eq 0 ]; then
  FOLDERS=(
    "https://drive.google.com/drive/folders/1yGQLf6Um-bAcYJIhSmMizYjLjMlKKULx"
    "https://drive.google.com/drive/folders/1hoC9UAQQ1q_4Mu_vxLCpNdMwa9PDGt9f"
    "https://drive.google.com/drive/folders/17KF8QSKZtexkiwcB_KEMz971ojH52caF"
    "https://drive.google.com/drive/folders/1Tkd5JrEgMGlR56TFE4pp6rz6psgL0Uyn"
  )
fi

python3 -m pip install --quiet --disable-pip-version-check gdown pillow numpy ${TRANSCRIBE:+faster-whisper}

RAW="${RAW_DIR:-.raw}"
mkdir -p "$RAW"

echo "== 1/3 listing folders"
python3 scripts/drive_list.py "${FOLDERS[@]}" > "$RAW/list.tsv" || true
echo "found $(wc -l < "$RAW/list.tsv") video(s)"

echo "== 2/3 downloading"
if [ -s "$RAW/list.tsv" ]; then
  while IFS=$'\t' read -r id name; do
    base="$(basename "$name")"
    ext="${base##*.}"; [ "$ext" = "$base" ] && ext="mp4"
    out="$RAW/${id}__$(echo "${base%.*}" | tr '/\\:*?"<>|' '_________').${ext}"
    [ -s "$out" ] && { echo "  have $base"; continue; }
    echo "  get  $base"
    for try in 1 2 3; do
      python3 -m gdown --quiet "https://drive.google.com/uc?id=${id}" -O "$out" && break
      sleep $((try * 5))
    done || echo "  ! failed: $base"
  done < "$RAW/list.tsv"
else
  # fallback: let gdown walk the folders (max 50 files per folder)
  for f in "${FOLDERS[@]}"; do python3 -m gdown --folder --remaining-ok "$f" -O "$RAW/folder" || true; done
fi

echo "== 3/3 transcoding, posters, preview loops"
python3 scripts/process.py ${TRANSCRIBE:+--transcribe} "$RAW"
echo "done. Edit titles/categories in content.json or at /studio"

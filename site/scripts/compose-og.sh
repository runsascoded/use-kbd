#!/usr/bin/env bash
# Compose og:image mosaic from library component screenshots.
# Requires: ImageMagick (magick)
#
# Layout (1200x630):
#   |--- 718 ---|4|--- 478 ---|
#   |           | |           |
#   | Omnibar   | | Shortcuts |
#   | w/ results| |   Modal   |
#   |           | |           |
set -euo pipefail
cd "$(dirname "$0")/.."

dir=public/screenshots

magick -size 1200x630 xc:'#1a1a2e' \
  "$dir/og-omnibar.png" -geometry +0+0 -composite \
  "$dir/og-modal.png" -geometry +722+0 -composite \
  "$dir/og-mosaic.png"

echo "Saved: $dir/og-mosaic.png ($(du -h "$dir/og-mosaic.png" | cut -f1))"

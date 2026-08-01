#!/usr/bin/env bash
# ChromaLens cross-browser build
# Usage: ./build.sh  ->  dist/chrome/  dist/firefox/
set -euo pipefail
cd "$(dirname "$0")"

RUNTIME_FILES=(
    background.js
    content
    icons
    popup.html
    popup.js
    popup.css
    audit.js
    audit.css
    palette.css
    utils.js
    color_data.js
    storage.js
)

rm -rf dist
mkdir -p dist/chrome dist/firefox

for target in chrome firefox; do
    for f in "${RUNTIME_FILES[@]}"; do
        cp -R "$f" "dist/$target/"
    done
done

cp manifest.json "dist/chrome/manifest.json"
cp manifest.firefox.json "dist/firefox/manifest.json"

echo "Built:"
echo "  dist/chrome/  (load via chrome://extensions -> Load unpacked)"
echo "  dist/firefox/ (load via about:debugging -> Load Temporary Add-on)"

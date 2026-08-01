#!/usr/bin/env bash
# L5 check: render popup in real Chrome (headless=new supports extensions).
# Chrome 129+ requires --enable-unsafe-extension-debugging for headless extensions.
# Real extension ID is read from the profile's Preferences file.
set -euo pipefail
cd "$(dirname "$0")/.."

EXT_DIR="$PWD/.output/chrome-mv3"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$PWD/artifacts/chrome-profile"
mkdir -p artifacts

echo "=== LAUNCH WITH EXTENSION ==="
rm -f artifacts/popup-picker.png
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" \
  --disable-extensions-except="$EXT_DIR" --load-extension="$EXT_DIR" \
  --enable-unsafe-extension-debugging \
  --window-size=420,760 --screenshot="$PWD/artifacts/blank.png" \
  "about:blank" 2>/dev/null &
CHROME_PID=$!

for i in $(seq 1 25); do
  if [ -s artifacts/blank.png ]; then break; fi
  sleep 1
done

# Extract the real extension ID from the profile's Preferences
EXT_ID=$(python3 - "$EXT_DIR" <<'EOF'
import json, sys
path = sys.argv[1]
try:
    with open('artifacts/chrome-profile/Default/Preferences') as f:
        prefs = json.load(f)
    settings = prefs.get('extensions', {}).get('settings', {})
    for ext_id, info in settings.items():
        if info.get('path') == path or (info.get('path') or '').endswith('chrome-mv3'):
            print(ext_id)
            break
except Exception as e:
    print('ERR', e, file=sys.stderr)
EOF
)
echo "real extension id: ${EXT_ID:-UNKNOWN}"

if [ -z "${EXT_ID:-}" ] || [ "$EXT_ID" = "ERR" ]; then
  echo "FAIL: extension not found in profile; it may not have loaded"
  kill "$CHROME_PID" 2>/dev/null || true
  exit 1
fi

echo "=== PICKER VIEW ==="
"$CHROME" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" \
  --disable-extensions-except="$EXT_DIR" --load-extension="$EXT_DIR" \
  --enable-unsafe-extension-debugging \
  --window-size=420,760 --screenshot="$PWD/artifacts/popup-picker.png" \
  "chrome-extension://$EXT_ID/popup.html" 2>/dev/null &
CHROME_PID2=$!

for i in $(seq 1 25); do
  if [ -s artifacts/popup-picker.png ]; then
    echo "screenshot captured after ${i}s"
    break
  fi
  sleep 1
done

kill "$CHROME_PID" "$CHROME_PID2" 2>/dev/null || true
pkill -f "$PROFILE" 2>/dev/null || true
sleep 1

if [ -s artifacts/popup-picker.png ]; then
  echo "OK: $(ls -la artifacts/popup-picker.png | awk '{print $5}') bytes"
else
  echo "FAIL: no screenshot produced"
  exit 1
fi

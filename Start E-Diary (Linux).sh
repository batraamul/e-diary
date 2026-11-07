#!/bin/bash
# E-Diary for Linux: starts a small web server for this folder at http://localhost:47812 (only this computer can open it),
# then opens the diary in its own Chrome / Edge / Brave window, or your default browser. Always the same address = same data.
cd "$(dirname "$0")" || exit 1
ROOT="$(pwd -P)"; PORT=47812; URL="http://localhost:$PORT/index.html"; LOG="${TMPDIR:-/tmp}/e-diary-server.log"
running() { curl -s --max-time 2 "http://127.0.0.1:$PORT/__ediary_root" 2>/dev/null; }
if [ "$(running)" != "$ROOT" ]; then
  if [ -n "$(running)" ]; then pkill -f "ediary_serve.py $PORT" 2>/dev/null; sleep 1; fi
  if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import http.server' >/dev/null 2>&1; then
    echo "E-Diary needs python3 (sudo apt install python3). Opening the diary as a file for now."; xdg-open "$ROOT/index.html"; exit 0
  fi
  nohup python3 "$ROOT/tools/ediary_serve.py" "$PORT" "$ROOT" >"$LOG" 2>&1 &
  for i in $(seq 1 30); do [ "$(running)" = "$ROOT" ] && break; sleep 0.2; done
fi
for b in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
  if command -v "$b" >/dev/null 2>&1; then nohup "$b" --app="$URL" >/dev/null 2>&1 & exit 0; fi
done
xdg-open "$URL"

#!/usr/bin/env bash
# Put a newer E-Diary on the Pi (run from inside the new E-Diary folder's tools/pi). Your diary data is not here —
# it lives in each device's browser and in your Google Drive — so updating never touches it.
set -e
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
sudo rsync -a --delete --exclude 'tools/windows' --exclude '*.bat' --exclude '*.command' "$SRC"/ /opt/e-diary/
sudo chmod -R a+rX /opt/e-diary
echo "Updated. Each device picks up the new version the next time it opens the diary."

#!/usr/bin/env bash
# E-Diary on a Raspberry Pi (Zero 2 W or any Pi with Raspberry Pi OS), reachable from your PCs and phone
# anywhere — with a changing (dynamic) IP address, behind the ISP's CGNAT, without opening router ports.
# It uses Tailscale (free for personal use; WireGuard underneath; open-source client) and Tailscale's built-in
# HTTPS file server, which gives the diary a fixed address like  https://ediary.<your-tailnet>.ts.net
#
#   1. Copy the E-Diary folder to the Pi (e.g. with WinSCP, or a USB stick), then on the Pi:
#        cd E-Diary/tools/pi && bash install.sh
#   2. Open the link it prints and sign in to Tailscale (Google account is fine).
#   3. Install the Tailscale app on each PC and the phone, sign in with the same account.
#   4. Open the address it prints. On Android Chrome: ⋮ → Install app.
set -e
SRC="$(cd "$(dirname "$0")/../.." && pwd)"
DEST=/opt/e-diary
NAME="${1:-ediary}"          # the Pi's name in the address: https://ediary.<tailnet>.ts.net

echo "== 1/4 Copying the diary to $DEST"
sudo mkdir -p "$DEST"
sudo rsync -a --delete --exclude 'tools/windows' --exclude '*.bat' --exclude '*.command' "$SRC"/ "$DEST"/ 2>/dev/null || sudo cp -r "$SRC"/. "$DEST"/
sudo chmod -R a+rX "$DEST"

echo "== 2/4 Installing Tailscale (official installer)"
if ! command -v tailscale >/dev/null; then curl -fsSL https://tailscale.com/install.sh | sh; fi

echo "== 3/4 Joining your Tailscale network as '$NAME' (open the link shown to sign in)"
sudo tailscale up --hostname="$NAME"

echo "== 4/4 Serving the diary over HTTPS on your Tailscale network"
sudo tailscale serve --bg "$DEST"
URL="$(tailscale status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)\."$/\1/; s/.*"\([^"]*\)"$/\1/')"
echo
echo "Done. The diary is at:  https://${URL:-$NAME.<your-tailnet>.ts.net}/"
echo "If the address does not open: in the Tailscale admin console → DNS, turn on MagicDNS and HTTPS Certificates."
echo "For Google sign-in (Drive sync, Calendar) add that address (without the final /) to your OAuth Client ID's"
echo "Authorized JavaScript origins in Google Cloud Console."
echo "To update the diary later: copy the new E-Diary folder to the Pi and run  bash tools/pi/update.sh"

E-Diary Mobile (Android) — start here
=====================================
This folder is the diary as a web app for phones. Android installs it as an app from Chrome — but only from a
web address (https), not from a file opened in the Files app.

Pick one way to give it an address:

A) Raspberry Pi at home (works with a changing / dynamic IP, behind the ISP's CGNAT, no router ports):
   1. Copy this whole folder to the Pi.  2. On the Pi:  cd E-Diary/tools/pi && bash install.sh
   3. Sign in to Tailscale with the link it shows (free for personal use).
   4. Tailscale admin console → DNS: turn on MagicDNS and HTTPS Certificates.
   5. Install the Tailscale app on the phone and on your PCs; sign in with the same account.
   6. Open the address it printed (https://ediary.<your-tailnet>.ts.net) in Chrome on the phone → ⋮ → Install app.

B) GitHub Pages (free, no Pi): new repository → upload everything inside this folder → Settings → Pages →
   Deploy from a branch: main, / (root). Address: https://<your-name>.github.io/<repository>/

Then, once: add the address (without the last /) to your Google OAuth Client ID → Authorized JavaScript origins
(Google Cloud Console → APIs & Services → Credentials), so Google Drive sync and Google Calendar work on the phone.
In the diary on the phone: More → Backup & Sync → Turn on Google Drive sync.

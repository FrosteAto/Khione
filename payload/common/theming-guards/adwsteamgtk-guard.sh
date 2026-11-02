#!/bin/bash
set -euo pipefail
log() { echo "[adwsteamgtk-guard] $*"; }

CSS="$HOME/.local/share/Steam/steamui/css/library.css"
MARKER="Adwaita-for-Steam"

if [ ! -f "$CSS" ] || ! grep -q -- "$MARKER" "$CSS"; then
    log "$CSS missing or lost the $MARKER marker (likely a Steam self-update) -- reapplying"
    adwaita-steam-gtk --install
    log "AdwSteamGtk reapplied"
else
    log "AdwSteamGtk skin still applied, nothing to do"
fi

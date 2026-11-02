#!/bin/bash
set -euo pipefail
log() { echo "[adwsteamgtk-guard] $*"; }

if ! command -v adwaita-steam-gtk >/dev/null 2>&1; then
    log "adwaita-steam-gtk not installed -- nothing to do"
    exit 0
fi

if [ ! -d "$HOME/.local/share/Steam" ]; then
    log "Steam hasn't been set up yet (no ~/.local/share/Steam) -- nothing to do"
    exit 0
fi

CSS="$HOME/.local/share/Steam/steamui/css/library.css"
MARKER="Adwaita-for-Steam"

if [ ! -f "$CSS" ] || ! grep -q -- "$MARKER" "$CSS"; then
    log "$CSS missing or lost the $MARKER marker (likely a Steam self-update) -- reapplying"
    adwaita-steam-gtk --install
    log "AdwSteamGtk reapplied"
else
    log "AdwSteamGtk skin still applied, nothing to do"
fi

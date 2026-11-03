#!/bin/bash
set -euo pipefail
log() { echo "[adwsteamgtk-guard] $*"; }

if ! command -v adwaita-steam-gtk >/dev/null 2>&1; then
    log "adwaita-steam-gtk not installed -- nothing to do"
    exit 0
fi

# Seed the distro's default color before the very first --install, but only
# if the user has never touched this setting themselves. dconf read returns
# empty for a key that's never been explicitly written, unlike gsettings get,
# which always falls back to the schema's own default and so can't tell
# "never touched" from "deliberately set to the default". Once this (or the
# user's own GUI run) writes a value, the key is no longer empty and this
# stops firing on later re-triggers -- so it never clobbers a manual choice.
if command -v dconf >/dev/null 2>&1 && command -v gsettings >/dev/null 2>&1; then
    if [ -z "$(dconf read /io/github/Foldex/AdwSteamGtk/color-theme-options 2>/dev/null)" ]; then
        log "No color theme chosen yet -- defaulting to Catppuccin-Mocha"
        gsettings set io.github.Foldex.AdwSteamGtk color-theme-options 'Catppuccin-Mocha' || true
    fi
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

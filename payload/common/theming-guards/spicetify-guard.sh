#!/bin/bash
set -euo pipefail
log() { echo "[spicetify-guard] $*"; }

if ! command -v spicetify >/dev/null 2>&1; then
    log "spicetify not installed -- nothing to do"
    exit 0
fi

PREFS="$HOME/.config/spotify/prefs"
if [ ! -f "$PREFS" ]; then
    log "Spotify prefs file not found yet (Spotify hasn't been launched) -- nothing to do"
    exit 0
fi

log "Spotify prefs file present -- applying Spicetify"
spicetify backup apply
log "Spicetify applied"

#!/bin/bash
set -euo pipefail
log() { echo "[betterdiscord-guard] $*"; }

ACTIVE_APP="$(readlink -f "$HOME/.config/discord/Discord" 2>/dev/null || true)"

if [ -z "$ACTIVE_APP" ]; then
    log "Discord doesn't appear to be installed yet (no ~/.config/discord/Discord symlink) -- nothing to do"
    exit 0
fi

APP_DIR="$(dirname "$ACTIVE_APP")"
ASAR="$APP_DIR/resources/betterdiscord.app.asar"

if [ ! -f "$ASAR" ]; then
    log "BetterDiscord missing from $APP_DIR (likely a Discord self-update) -- reinstalling"
    betterdiscordctl install
    log "BetterDiscord reinstalled"
else
    log "BetterDiscord still present in $APP_DIR, nothing to do"
fi

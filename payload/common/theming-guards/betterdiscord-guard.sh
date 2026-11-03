#!/bin/bash
set -euo pipefail
log() { echo "[betterdiscord-guard] $*"; }

if ! command -v betterdiscordctl >/dev/null 2>&1; then
    log "betterdiscordctl not installed -- nothing to do"
    exit 0
fi

ACTIVE_APP="$(readlink -f "$HOME/.config/discord/Discord" 2>/dev/null || true)"

if [ -z "$ACTIVE_APP" ]; then
    log "Discord doesn't appear to be installed yet (no ~/.config/discord/Discord symlink) -- nothing to do"
    exit 0
fi

APP_DIR="$(dirname "$ACTIVE_APP")"
ASAR="$APP_DIR/resources/betterdiscord.app.asar"

if [ ! -f "$ASAR" ]; then
    log "BetterDiscord missing from $APP_DIR (likely a Discord self-update) -- reinstalling"
    # betterdiscordctl tracks "installed" via a patch marker inside Discord's
    # own app.asar, not by this sibling file's existence. If Discord's update
    # stripped the payload but left the marker, "install" refuses with
    # "Already installed" while the payload stays missing -- "reinstall"
    # forces both the uninstall and reinstall, clearing that mismatch.
    if ! betterdiscordctl install; then
        log "betterdiscordctl install refused -- forcing reinstall"
        betterdiscordctl reinstall
    fi
    log "BetterDiscord reinstalled"
else
    log "BetterDiscord still present in $APP_DIR, nothing to do"
fi
